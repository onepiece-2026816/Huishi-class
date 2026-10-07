"""Assemble an uploaded heart appearance with the offline heart-v1 anatomy."""
from __future__ import annotations

import io
import json
import subprocess
import uuid
from pathlib import Path

import biomed_models
from PIL import Image, ImageChops, ImageStat


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT / "assets" / "anatomy"
TEMPLATE_GLB = TEMPLATE_DIR / "heart-v2.glb"
TEMPLATE_MANIFEST = TEMPLATE_DIR / "heart-v2.json"
OUTPUT_DIR = ROOT / "generated" / "image-models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


BLENDER_SCRIPT = r'''
import bpy
import json
import sys
from mathutils import Vector

config_path = sys.argv[sys.argv.index("--config") + 1]
with open(config_path, "r", encoding="utf-8") as source:
    config = json.load(source)

def bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    if not points:
        raise RuntimeError("模型中没有可计算包围盒的网格")
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )

def collection(name):
    value = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(value)
    return value

def move_to_collection(obj, target):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)

def set_alpha(material, alpha):
    material = material.copy()
    material.name = material.name + " overlay"
    material.diffuse_color = (*material.diffuse_color[:3], alpha)
    try:
        material.surface_render_method = "DITHERED"
    except Exception:
        pass
    if material.use_nodes:
        shader = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if shader and "Alpha" in shader.inputs:
            shader.inputs["Alpha"].default_value = alpha
    return material

bpy.ops.wm.read_factory_settings(use_empty=True)
appearance_collection = collection("Appearance")
anatomy_collection = collection("Anatomy")
reference_collection = collection("ReferenceViews")

before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=config["appearancePath"])
appearance_imported = [obj for obj in bpy.context.scene.objects if obj not in before]
appearance_meshes = [obj for obj in appearance_imported if obj.type == "MESH"]
if not appearance_meshes:
    raise RuntimeError("外观 GLB 不包含有效网格")
appearance_root = bpy.data.objects.new("Appearance", None)
appearance_collection.objects.link(appearance_root)
for obj in appearance_imported:
    move_to_collection(obj, appearance_collection)
for obj in appearance_imported:
    if obj != appearance_root and obj.parent is None:
        obj.parent = appearance_root
for obj in appearance_meshes:
    obj["layer"] = "appearance"
    obj["semantic"] = False
    obj["source"] = config["sourceLabel"]

reference_meshes = []
for view_name, reference_path in config.get("referencePaths", {}).items():
    if view_name == "front":
        continue
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=reference_path)
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    angle = {"left": 1.57079632679, "right": -1.57079632679, "back": 3.14159265359}.get(view_name, 0.0)
    root = bpy.data.objects.new("Reference_%s" % view_name, None)
    reference_collection.objects.link(root)
    root.rotation_euler[2] = angle
    for obj in imported:
        move_to_collection(obj, reference_collection)
        if obj.parent is None:
            obj.parent = root
        obj.hide_render = True
        obj.hide_viewport = True
        obj["referenceView"] = view_name
    reference_meshes.extend(meshes)

def apply_multiview_atlas(objects, atlas_path):
    if not atlas_path:
        return False
    image = bpy.data.images.load(atlas_path, check_existing=True)
    minimum, maximum = bounds(objects)
    span = maximum - minimum
    for obj in objects:
        mesh = obj.data
        uv_layer = mesh.uv_layers.get("MultiviewUV") or mesh.uv_layers.new(name="MultiviewUV")
        normal_matrix = obj.matrix_world.to_3x3()
        for polygon in mesh.polygons:
            normal = (normal_matrix @ polygon.normal).normalized()
            if abs(normal.x) > abs(normal.y):
                view_index = 1 if normal.x < 0 else 2
            else:
                view_index = 0 if normal.y < 0 else 3
            for loop_index in polygon.loop_indices:
                point = obj.matrix_world @ mesh.vertices[mesh.loops[loop_index].vertex_index].co
                x = (point.x - minimum.x) / max(span.x, 1e-6)
                y = (point.y - minimum.y) / max(span.y, 1e-6)
                z = (point.z - minimum.z) / max(span.z, 1e-6)
                local_u = x if view_index == 0 else (1.0 - y if view_index == 1 else y if view_index == 2 else 1.0 - x)
                uv_layer.data[loop_index].uv = ((view_index + min(1.0, max(0.0, local_u))) / 4.0, min(1.0, max(0.0, z)))
        for slot_index, slot in enumerate(obj.material_slots):
            source_material = slot.material
            material = source_material.copy() if source_material else bpy.data.materials.new("MAT_Heart_SF3D")
            material.name = "%s_Multiview" % material.name
            material.use_nodes = True
            nodes = material.node_tree.nodes
            links = material.node_tree.links
            shader = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
            if not shader:
                continue
            base_input = shader.inputs["Base Color"]
            original_source = base_input.links[0].from_socket if base_input.links else None
            texture = nodes.new("ShaderNodeTexImage")
            texture.name = "Heart four-view atlas"
            texture.image = image
            uv_map = nodes.new("ShaderNodeUVMap")
            uv_map.uv_map = "MultiviewUV"
            links.new(uv_map.outputs["UV"], texture.inputs["Vector"])
            if original_source:
                mix = nodes.new("ShaderNodeMixRGB")
                mix.name = "SF3D native + four-view atlas"
                mix.blend_type = "MIX"
                # SF3D's baked texture remains the authoritative surface. The
                # four-view atlas adds side/back colour evidence without
                # washing out the coherent native bake.
                mix.inputs[0].default_value = 0.14
                links.new(original_source, mix.inputs[1])
                links.new(texture.outputs["Color"], mix.inputs[2])
                links.new(mix.outputs["Color"], base_input)
            else:
                links.new(texture.outputs["Color"], base_input)
            if "Alpha" in shader.inputs:
                shader.inputs["Alpha"].default_value = 1.0
            shader.inputs["Roughness"].default_value = 0.46
            obj.material_slots[slot_index].material = material
    return True

texture_projected = apply_multiview_atlas(appearance_meshes, config.get("atlasPath"))

before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=config["templatePath"])
anatomy_imported = [obj for obj in bpy.context.scene.objects if obj not in before]
anatomy_meshes = [obj for obj in anatomy_imported if obj.type == "MESH" and obj.get("layer") == "anatomy"]
for obj in anatomy_imported:
    move_to_collection(obj, anatomy_collection)
anatomy_roots = [obj for obj in anatomy_imported if obj.parent is None]
anatomy_root = next((obj for obj in anatomy_roots if obj.name.startswith("Anatomy")), None)
if not anatomy_root:
    anatomy_root = bpy.data.objects.new("Anatomy", None)
    anatomy_collection.objects.link(anatomy_root)
    for obj in anatomy_roots:
        if obj != anatomy_root:
            obj.parent = anatomy_root
anatomy_root.name = "Anatomy"

expected = {part["partKey"] for part in config["templateManifest"]["parts"]}
found = {str(obj.get("partKey") or "") for obj in anatomy_meshes}
if found != expected:
    missing = sorted(expected - found)
    extra = sorted(found - expected)
    raise RuntimeError("heart-v2 部件校验失败；缺少=%s，多余=%s" % (missing, extra))

appearance_min, appearance_max = bounds(appearance_meshes)
anatomy_min, anatomy_max = bounds(anatomy_meshes)
appearance_center = (appearance_min + appearance_max) / 2
anatomy_center = (anatomy_min + anatomy_max) / 2
appearance_dims = appearance_max - appearance_min
reference_dimensions = [appearance_dims]
for mesh in reference_meshes:
    try:
        ref_min, ref_max = bounds([mesh])
        reference_dimensions.append(ref_max - ref_min)
    except Exception:
        pass
if len(reference_dimensions) >= 4:
    appearance_dims = Vector(tuple(sorted(value[axis] for value in reference_dimensions)[len(reference_dimensions) // 2] for axis in range(3)))
anatomy_dims = anatomy_max - anatomy_min
ratios = [appearance_dims[i] / anatomy_dims[i] if anatomy_dims[i] > 1e-6 else 1.0 for i in range(3)]
uniform = sorted(ratios)[1]
scales = [max(uniform * 0.78, min(uniform * 1.22, value)) for value in ratios]
template_scale = anatomy_root.scale.copy()
anatomy_root.scale = tuple(template_scale[i] * scales[i] for i in range(3))
bpy.context.view_layer.update()
scaled_min, scaled_max = bounds(anatomy_meshes)
scaled_center = (scaled_min + scaled_max) / 2
anatomy_root.location += appearance_center - scaled_center
bpy.context.view_layer.update()

spread = max(ratios) / max(min(ratios), 1e-6)
confidence = max(0.2, min(0.96, 1.0 - (spread - 1.0) * 0.42))
registration_status = "aligned" if confidence >= 0.62 else "low_confidence"

# Keep source materials and textures intact. Store an alternate transparent
# material slot for the web overlay mode without replacing the default slot.
for obj in appearance_meshes:
    for mat in list(obj.data.materials):
        if mat:
            obj.data.materials.append(set_alpha(mat, 0.24))

myocardium = next(obj for obj in anatomy_meshes if obj.get("partKey") == "myocardium")
myo_min, myo_max = bounds([myocardium])
qa = {"partCount": len(anatomy_meshes), "uniquePartKeys": len(found) == 16, "chambersInsideMyocardium": True, "validMeshes": True}
for obj in anatomy_meshes:
    if not obj.data.vertices or not obj.data.polygons:
        qa["validMeshes"] = False
    if obj.get("group") == "chambers":
        chamber_min, chamber_max = bounds([obj])
        tolerance = max(myo_max - myo_min) * 0.12
        if any(chamber_min[i] < myo_min[i] - tolerance or chamber_max[i] > myo_max[i] + tolerance for i in range(3)):
            qa["chambersInsideMyocardium"] = False

if not qa["uniquePartKeys"] or not qa["validMeshes"]:
    raise RuntimeError("心脏解剖模板质检失败")

# Registration QA and the default preview must measure the SF3D appearance,
# not the larger teaching anatomy template. The anatomy objects remain visible
# and independently selectable in the Blend/GLB exports.
for obj in anatomy_meshes:
    obj.hide_render = True

scene = bpy.context.scene
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 960
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = True
scene.render.filepath = config["previewPath"]
scene.world = bpy.data.worlds.new("Heart anatomy world")
scene.world.color = (0.012, 0.016, 0.022)

combined_min, combined_max = bounds(appearance_meshes + anatomy_meshes)
center = (combined_min + combined_max) / 2
extent = max(combined_max - combined_min)
bpy.ops.object.camera_add(location=center + Vector((0.0, -3.6, 0.25)) * extent)
camera = bpy.context.object
camera.name = "Teaching Camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = extent * 1.5
camera.rotation_euler = ((center - camera.location).to_track_quat("-Z", "Y").to_euler())
scene.camera = camera
bpy.ops.object.light_add(type="AREA", location=center + Vector((3.2, -4.0, 5.0)) * extent)
bpy.context.object.data.energy = 1250
bpy.context.object.data.size = max(2.0, extent * 2.5)
bpy.ops.object.light_add(type="AREA", location=center + Vector((-3.0, -1.5, 2.5)) * extent)
bpy.context.object.data.energy = 650
bpy.context.object.data.size = max(2.0, extent * 2.0)

view_positions = {
    "front": Vector((0.0, -3.6, 0.25)),
    "left": Vector((-3.6, 0.0, 0.25)),
    "right": Vector((3.6, 0.0, 0.25)),
    "back": Vector((0.0, 3.6, 0.25)),
}
for view_name, position in view_positions.items():
    camera.location = center + position * extent
    camera.rotation_euler = ((center - camera.location).to_track_quat("-Z", "Y").to_euler())
    scene.render.filepath = config["viewRenderPaths"][view_name]
    bpy.ops.render.render(write_still=True)
scene.render.filepath = config["previewPath"]
camera.location = center + Vector((0.18, -3.6, 0.45)) * extent
camera.rotation_euler = ((center - camera.location).to_track_quat("-Z", "Y").to_euler())
bpy.ops.wm.save_as_mainfile(filepath=config["blendPath"])
bpy.ops.object.select_all(action="DESELECT")
for obj in appearance_imported + anatomy_imported + [appearance_root, anatomy_root]:
    if obj.name in bpy.context.scene.objects:
        obj.select_set(True)
bpy.context.view_layer.objects.active = myocardium
bpy.ops.export_scene.gltf(filepath=config["outputPath"], export_format="GLB", use_selection=True, export_extras=True)
bpy.ops.render.render(write_still=True)

parts = []
for item in config["templateManifest"]["parts"]:
    obj = next(obj for obj in anatomy_meshes if obj.get("partKey") == item["partKey"])
    parts.append({**item, "name": obj.name, "confidence": 1.0, "vertexCount": len(obj.data.vertices), "faceCount": len(obj.data.polygons)})
with open(config["partsPath"], "w", encoding="utf-8") as target:
    json.dump({"parts": parts, "registration": {"status": registration_status, "confidence": confidence}, "qa": qa, "textureProjected": texture_projected, "referenceMeshCount": len(reference_meshes)}, target, ensure_ascii=False, indent=2)
'''


def _relative(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")


def _urls(glb: Path, blend: Path, preview: Path, appearance: Path | None = None, view_images: dict[str, Path] | None = None):
    result = {
        "glbUrl": "/api/3d/download/" + _relative(glb).split("generated/", 1)[1],
        "blendUrl": "/api/3d/download/" + _relative(blend).split("generated/", 1)[1],
        "previewUrl": "/api/3d/preview/" + _relative(preview).split("generated/", 1)[1],
        "appearanceUrl": "/api/3d/download/" + _relative(appearance).split("generated/", 1)[1] if appearance else "",
    }
    result["viewImageUrls"] = {
        key: "/api/3d/preview/" + _relative(path).split("generated/", 1)[1]
        for key, path in (view_images or {}).items()
        if path.is_file()
    }
    return result


def _foreground_rgba(raw: bytes, size=(1024, 1024)):
    image = Image.open(io.BytesIO(raw)).convert("RGBA")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    offset = ((size[0] - image.width) // 2, (size[1] - image.height) // 2)
    corners = [image.getpixel((0, 0)), image.getpixel((image.width - 1, 0)), image.getpixel((0, image.height - 1)), image.getpixel((image.width - 1, image.height - 1))]
    background = tuple(sum(pixel[channel] for pixel in corners) // len(corners) for channel in range(3))
    pixels = []
    for red, green, blue, alpha in image.getdata():
        distance = ((red - background[0]) ** 2 + (green - background[1]) ** 2 + (blue - background[2]) ** 2) ** 0.5
        pixels.append((red, green, blue, 0 if distance < 34 else alpha))
    image.putdata(pixels)
    canvas.alpha_composite(image, offset)
    return canvas


def _build_atlas(view_payloads, output_path: Path):
    panels = [_foreground_rgba(view_payloads[key]["image"]) for key in ("front", "left", "right", "back")]
    atlas = Image.new("RGBA", (4096, 1024), (0, 0, 0, 255))
    for index, panel in enumerate(panels):
        alpha = panel.getchannel("A")
        mean = tuple(round(value) for value in ImageStat.Stat(panel.convert("RGB"), mask=alpha).mean[:3])
        opaque_panel = Image.new("RGBA", panel.size, (*mean, 255))
        opaque_panel.alpha_composite(panel)
        atlas.alpha_composite(opaque_panel, (index * 1024, 0))
    atlas.save(output_path, "PNG", optimize=True)


def _mask_iou(reference_raw: bytes, rendered_path: Path):
    reference = _foreground_rgba(reference_raw, (256, 256)).getchannel("A")
    rendered = Image.open(rendered_path).convert("RGBA").resize((256, 256), Image.Resampling.LANCZOS).getchannel("A")
    reference_mask = reference.point(lambda value: 255 if value > 16 else 0)
    rendered_mask = rendered.point(lambda value: 255 if value > 16 else 0)
    intersection = ImageChops.multiply(reference_mask, rendered_mask)
    union = ImageChops.lighter(reference_mask, rendered_mask)
    intersection_count = sum(1 for value in intersection.getdata() if value)
    union_count = sum(1 for value in union.getdata() if value)
    return round(intersection_count / max(1, union_count), 4)


def package(glb_bytes: bytes, source_label: str, mode: str, view_payloads=None):
    if not glb_bytes.startswith(b"glTF"):
        raise ValueError("3D 服务没有返回有效 GLB 文件")
    if not TEMPLATE_GLB.is_file() or not TEMPLATE_MANIFEST.is_file():
        raise RuntimeError("heart-v2 医学模板缺失，解剖模式已停止，未回退为随机几何拆件")
    blender = biomed_models.find_blender()
    if not blender:
        raise RuntimeError("未找到 Blender，无法装配双层心脏模型")

    template_manifest = json.loads(TEMPLATE_MANIFEST.read_text(encoding="utf-8"))
    if template_manifest.get("partCount") != 16:
        raise RuntimeError("heart-v2 模板清单不是 16 个部件")
    run_dir = OUTPUT_DIR / f"{mode}_heart_anatomy_{uuid.uuid4().hex[:8]}"
    run_dir.mkdir(parents=True, exist_ok=True)
    appearance_path = run_dir / "appearance.glb"
    output_path = run_dir / "model.glb"
    blend_path = run_dir / "model.blend"
    preview_path = run_dir / "preview.png"
    parts_path = run_dir / "parts.json"
    atlas_path = run_dir / "multiview-atlas.png"
    view_render_paths = {key: run_dir / f"qa-{key}.png" for key in ("front", "left", "right", "back")}
    config_path = run_dir / "heart_assembly.json"
    runner_path = run_dir / "heart_assembly.py"
    appearance_path.write_bytes(glb_bytes)
    payloads = view_payloads or {"front": {"glb": glb_bytes, "image": b""}}
    reference_paths = {}
    for key, payload in payloads.items():
        if not payload.get("glb", b"").startswith(b"glTF"):
            raise ValueError(f"SF3D {key} 视图没有返回有效 GLB")
        path = appearance_path if key == "front" else run_dir / f"reference-{key}.glb"
        path.write_bytes(payload["glb"])
        reference_paths[key] = str(path)
        if payload.get("image"):
            (run_dir / f"source-{key}.png").write_bytes(payload["image"])
    if mode == "multiview":
        missing = [key for key in ("front", "left", "right", "back") if key not in payloads or not payloads[key].get("image")]
        if missing:
            raise ValueError("心脏四视图装配缺少：" + "、".join(missing))
        _build_atlas(payloads, atlas_path)
    config_path.write_text(json.dumps({
        "appearancePath": str(appearance_path),
        "templatePath": str(TEMPLATE_GLB),
        "templateManifest": template_manifest,
        "sourceLabel": source_label,
        "referencePaths": reference_paths,
        "atlasPath": str(atlas_path) if atlas_path.is_file() else "",
        "viewRenderPaths": {key: str(path) for key, path in view_render_paths.items()},
        "outputPath": str(output_path),
        "blendPath": str(blend_path),
        "previewPath": str(preview_path),
        "partsPath": str(parts_path),
    }, ensure_ascii=False), encoding="utf-8")
    runner_path.write_text(BLENDER_SCRIPT, encoding="utf-8")
    try:
        completed = subprocess.run(
            [str(blender), "--background", "--factory-startup", "--python-exit-code", "1", "--python", str(runner_path), "--", "--config", str(config_path)],
            cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300, check=False,
        )
        if completed.returncode != 0 or not all(path.is_file() for path in (output_path, blend_path, preview_path, parts_path)):
            (run_dir / "heart_assembly.log").write_text((completed.stdout or "") + "\n" + (completed.stderr or ""), encoding="utf-8")
            raise RuntimeError("心脏双层模型装配失败，已保留 Blender 日志；未回退为 PartField")
        report = json.loads(parts_path.read_text(encoding="utf-8"))
        registration = report["registration"]
        silhouette_iou = {
            key: _mask_iou(payload["image"], view_render_paths[key])
            for key, payload in payloads.items()
            if key in view_render_paths and payload.get("image")
        }
        if mode == "multiview":
            average_iou = sum(silhouette_iou.values()) / 4
            registration["silhouetteIoU"] = silhouette_iou
            registration["confidence"] = round(registration["confidence"] * 0.55 + average_iou * 0.45, 4)
            registration["status"] = "aligned" if registration["confidence"] >= 0.5 and min(silhouette_iou.values()) >= 0.28 else "low_confidence"
        elif silhouette_iou:
            front_iou = silhouette_iou["front"]
            registration["silhouetteIoU"] = silhouette_iou
            registration["confidence"] = round(registration["confidence"] * 0.55 + front_iou * 0.45, 4)
            if front_iou < 0.25:
                raise RuntimeError(f"SF3D 输出与上传图片轮廓不匹配（IoU={front_iou:.3f}），任务已停止，未使用内置心脏替代")
            registration["status"] = "aligned" if registration["confidence"] >= 0.5 and front_iou >= 0.42 else "low_confidence"
        warnings = ["教学用途，非诊断用途。透明心腔与教学厚度不用于解剖测量。"]
        if registration["status"] == "low_confidence":
            warnings.append("外观与解剖层未精确配准；内部结构保持标准模板关系。")
        return {
            "status": "generated" if registration["status"] == "aligned" else "needs_review",
            "editable": True,
            "message": "已完成四视图 SF3D 外观与标准解剖装配，16 个医学部件可独立操作。" if mode == "multiview" else "已生成 SF3D 外观与标准解剖双层心脏。",
            "engine": "sf3d-four-view-registration" if mode == "multiview" else "sf3d-single-image",
            "viewsUsed": list(payloads.keys()),
            "modelKind": "dual-layer-anatomy",
            "organType": "heart",
            "anatomyProfile": "heart-v2",
            "anatomyDisplayAvailable": False,
            "layers": ["appearance", "anatomy"],
            "registration": registration,
            "parts": report["parts"],
            "quality": report["qa"],
            "textureProjection": {"status": "completed" if report.get("textureProjected") else "single-view-source", "viewsUsed": 4 if report.get("textureProjected") else 1, "atlasUrl": "/api/3d/preview/" + _relative(atlas_path).split("generated/", 1)[1] if atlas_path.is_file() else ""},
            "warnings": warnings,
            "segmentation": {"provider": "heart-v2", "status": "completed", "partCount": 16, "hierarchical": True, "license": "CC BY-SA 4.0", "warnings": warnings},
            "separation": {"status": "validated", "partCount": 16, "semantic": True, "warnings": warnings},
            "references": [{
                "title": "Z-Anatomy", "author": "Z-Anatomy contributors", "sourceType": "open-anatomy-template",
                "sourceUrl": "https://github.com/LluisV/Z-Anatomy", "license": "CC BY-SA 4.0", "usedIn": ["model-heart-v2"],
            }],
            "workflow": ["sf3d-four-view" if mode == "multiview" else "sf3d-single-image", "heart-v2-anatomy", "bounded-registration", "multiview-texture-atlas", "blender-assembly", "export-pipeline", "qa-review"],
            **_urls(output_path, blend_path, preview_path, appearance_path, view_render_paths),
        }
    finally:
        config_path.unlink(missing_ok=True)
        runner_path.unlink(missing_ok=True)
