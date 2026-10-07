"""Package image-to-3D responses as editable, separable Blender assets."""
from __future__ import annotations

import json
import subprocess
import uuid
from pathlib import Path

import biomed_models
import partfield_adapter


ROOT = Path(__file__).resolve().parents[1]
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

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=config["inputPath"])
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
if not meshes:
    raise RuntimeError("GLB 中没有可编辑网格")

def split_into_regions(obj):
    """Split one connected mesh into editable geometric regions while keeping materials and UVs."""
    mesh = obj.data
    if len(mesh.polygons) < 180:
        return [obj]
    bounds = [(min((vertex.co[axis] for vertex in mesh.vertices), default=0.0),
               max((vertex.co[axis] for vertex in mesh.vertices), default=0.0)) for axis in range(3)]
    axis = max(range(3), key=lambda index: bounds[index][1] - bounds[index][0])
    minimum, maximum = bounds[axis]
    span = maximum - minimum
    if span <= 1e-5:
        return [obj]
    regions = [[] for _ in range(3)]
    for polygon in mesh.polygons:
        center = sum(mesh.vertices[index].co[axis] for index in polygon.vertices) / max(1, len(polygon.vertices))
        region = min(2, max(0, int((center - minimum) / span * 3.0)))
        regions[region].append(polygon)
    regions = [region for region in regions if region]
    if len(regions) < 2:
        return [obj]
    collection = obj.users_collection[0] if obj.users_collection else bpy.context.scene.collection
    source_uv = mesh.uv_layers.active.data if mesh.uv_layers.active else None
    created = []
    for region_index, polygons in enumerate(regions, 1):
        vertex_map = {}
        coordinates = []
        faces = []
        material_indices = []
        smooth_flags = []
        source_loops = []
        for polygon in polygons:
            face = []
            for vertex_index in polygon.vertices:
                if vertex_index not in vertex_map:
                    vertex_map[vertex_index] = len(coordinates)
                    coordinates.append(tuple(mesh.vertices[vertex_index].co))
                face.append(vertex_map[vertex_index])
            faces.append(face)
            material_indices.append(polygon.material_index)
            smooth_flags.append(polygon.use_smooth)
            source_loops.append(list(polygon.loop_indices))
        new_mesh = bpy.data.meshes.new("%s region mesh %02d" % (obj.name, region_index))
        new_mesh.from_pydata(coordinates, [], faces)
        new_mesh.update()
        for material in mesh.materials:
            new_mesh.materials.append(material)
        if source_uv:
            new_uv = new_mesh.uv_layers.new(name=mesh.uv_layers.active.name)
            for new_polygon, old_loop_indices in zip(new_mesh.polygons, source_loops):
                for new_loop_index, old_loop_index in zip(new_polygon.loop_indices, old_loop_indices):
                    new_uv.data[new_loop_index].uv = source_uv[old_loop_index].uv
        for polygon, material_index, smooth in zip(new_mesh.polygons, material_indices, smooth_flags):
            polygon.material_index = min(material_index, max(0, len(new_mesh.materials) - 1))
            polygon.use_smooth = smooth
        new_obj = bpy.data.objects.new("%s / region %02d" % (obj.name, region_index), new_mesh)
        collection.objects.link(new_obj)
        new_obj.matrix_world = obj.matrix_world.copy()
        created.append(new_obj)
    bpy.data.objects.remove(obj, do_unlink=True)
    return created

material_parts = []
for obj in list(meshes):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for other in bpy.context.selected_objects:
        if other != obj:
            other.select_set(False)
    if obj.get("partKey") or obj.name.startswith(("Lower geometric", "Middle geometric", "Upper geometric")):
        material_parts.append(obj)
    elif len(obj.data.materials) > 1:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.separate(type="MATERIAL")
        bpy.ops.object.mode_set(mode="OBJECT")
        material_parts.extend(list(bpy.context.selected_objects))
    else:
        material_parts.append(obj)

parts = []
for object_index, obj in enumerate(list(dict.fromkeys(material_parts)), 1):
    if obj.name not in bpy.context.scene.objects:
        continue
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    preserve_part = (bool(obj.get("partKey"))
                     or obj.name.startswith(("Lower geometric", "Middle geometric", "Upper geometric"))
                     or config["sourceLabel"].startswith("Local built-in heart anatomy template"))
    if preserve_part:
        separated = [obj]
    else:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.separate(type="LOOSE")
        bpy.ops.object.mode_set(mode="OBJECT")
        separated = list(bpy.context.selected_objects)
        if len(separated) == 1:
            separated = split_into_regions(separated[0])
    for island_index, part in enumerate(separated, 1):
        vertex_count = len(part.data.vertices)
        if vertex_count < 128 or len(part.data.polygons) < 100:
            bpy.data.objects.remove(part, do_unlink=True)
            continue
        original_label = str(part.get("partLabel") or part.name)
        part.name = original_label if preserve_part else "Part %02d-%02d" % (object_index, island_index)
        part["partKey"] = str(part.get("partKey") or "part_%02d_%02d" % (object_index, island_index))
        part["partLabel"] = original_label
        part["source"] = config["sourceLabel"]
        part["confidence"] = float(part.get("confidence", 0.35 if preserve_part else 0.3))
        part["vertexCount"] = vertex_count
        parts.append(part)

if not parts:
    raise RuntimeError("拆件后没有有效网格")

# The offline four-view hull is deliberately made from coarse cells. Join and
# voxel-remesh it before export so the preview is a continuous editable surface
# instead of a stack of visible cubes. This does not create semantic anatomy.
if config["sourceLabel"].startswith("Local offline four-view visual hull") and len(parts) > 1:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    parts = [bpy.context.object]
    parts[0].name = "Four-view visual hull surface"
    parts[0]["partKey"] = "visual_hull_surface"
    parts[0]["partLabel"] = "Four-view visual hull surface"
    parts[0]["confidence"] = 0.2
    remesh = parts[0].modifiers.new("Continuous surface reconstruction", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = 0.045
    remesh.use_smooth_shade = True
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    for polygon in parts[0].data.polygons:
        polygon.use_smooth = True

for obj in bpy.context.scene.objects:
    if obj not in parts and obj.type not in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(obj, do_unlink=True)

for obj in bpy.context.scene.objects:
    obj.select_set(obj in parts)
if parts:
    bpy.context.view_layer.objects.active = parts[0]

scene = bpy.context.scene
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 900
scene.render.resolution_y = 700
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = config["previewPath"]
scene.world = bpy.data.worlds.new("Image model world")
scene.world.color = (0.015, 0.02, 0.03)
minimum = Vector((min((obj.matrix_world @ Vector(corner))[axis] for obj in parts for corner in obj.bound_box) for axis in range(3)))
maximum = Vector((max((obj.matrix_world @ Vector(corner))[axis] for obj in parts for corner in obj.bound_box) for axis in range(3)))
center = (minimum + maximum) / 2
extent = max(maximum - minimum)
bpy.ops.object.camera_add(location=center + Vector((0.15, -3.8, 0.55)) * extent)
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = extent * 1.55
camera.rotation_euler = ((center - camera.location).to_track_quat("-Z", "Y").to_euler())
scene.camera = camera
bpy.ops.object.light_add(type="AREA", location=(4, -4, 6))
key_light = bpy.context.object
key_light.data.energy = 1100
key_light.data.size = 5
key_light.rotation_euler = ((Vector((0, 0, 0)) - key_light.location).to_track_quat("-Z", "Y").to_euler())
bpy.ops.object.light_add(type="AREA", location=(-4, -2, 3))
bpy.context.object.data.energy = 700
bpy.context.object.data.size = 4
bpy.ops.wm.save_as_mainfile(filepath=config["blendPath"])
bpy.ops.object.select_all(action="DESELECT")
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.export_scene.gltf(filepath=config["outputPath"], export_format="GLB", use_selection=True, export_extras=True)
bpy.ops.render.render(write_still=True)

# Store standard rendered viewpoints for PPT/static courseware use. These are
# renderer views of the generated mesh, not additional source-image views.
view_directions = {
    "front": Vector((0.15, -3.8, 0.55)),
    "left": Vector((-3.8, -0.15, 0.55)),
    "right": Vector((3.8, 0.15, 0.55)),
    "back": Vector((0.15, 3.8, 0.55)),
}
for view_name, direction in view_directions.items():
    camera.location = center + direction * extent
    camera.rotation_euler = ((center - camera.location).to_track_quat("-Z", "Y").to_euler())
    scene.render.filepath = config["viewPaths"][view_name]
    bpy.ops.render.render(write_still=True)
with open(config["partsPath"], "w", encoding="utf-8") as target:
    json.dump([{"name": obj.name, "partKey": obj["partKey"], "partLabel": obj["partLabel"], "source": obj["source"], "confidence": obj["confidence"], "vertexCount": obj["vertexCount"]} for obj in parts], target, ensure_ascii=False)
'''


PARTFIELD_BLENDER_SCRIPT = r'''
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

config_path = sys.argv[sys.argv.index("--config") + 1]
with open(config_path, "r", encoding="utf-8") as source:
    config = json.load(source)

bpy.ops.wm.read_factory_settings(use_empty=True)
split_dir = Path(config["splitDir"])
part_report = config["partReport"]
parts = []

def material_for(part, index):
    mat = bpy.data.materials.new(part.get("partLabel") or part.get("partKey") or ("Part %02d" % index))
    mat.use_nodes = True
    color = part.get("color") or [0.45, 0.72, 0.86]
    rgba = (float(color[0]), float(color[1]), float(color[2]), 1.0)
    mat.diffuse_color = rgba
    shader = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if shader:
        if "Base Color" in shader.inputs:
            shader.inputs["Base Color"].default_value = rgba
        if "Roughness" in shader.inputs:
            shader.inputs["Roughness"].default_value = 0.72
        if "Metallic" in shader.inputs:
            shader.inputs["Metallic"].default_value = 0.0
    return mat

def repair_mesh(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    except Exception:
        pass
    try:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=0.00001)
        bpy.ops.mesh.delete_loose()
        bpy.ops.mesh.dissolve_degenerate(threshold=0.00001)
        try:
            bpy.ops.mesh.fill_holes(sides=16)
        except Exception:
            pass
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
    except Exception:
        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass
    obj.data.update()

for index, part in enumerate(part_report.get("parts") or [], 1):
    part_file = split_dir / part["file"]
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(part_file))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before and obj.type == "MESH"]
    if not imported:
        continue
    if len(imported) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in imported:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = imported[0]
        bpy.ops.object.join()
        obj = bpy.context.object
    else:
        obj = imported[0]
    repair_mesh(obj)
    label = part.get("partLabel") or ("Part %02d" % index)
    key = part.get("partKey") or ("part-%02d" % index)
    obj.name = label
    obj["partKey"] = key
    obj["partLabel"] = label
    obj["method"] = "partfield"
    obj["confidence"] = float(part.get("confidence", 0.72))
    obj["source"] = config["sourceLabel"]
    obj["license"] = config["license"]
    obj["faceCount"] = int(part.get("faceCount", len(obj.data.polygons)))
    obj["vertexCount"] = int(part.get("vertexCount", len(obj.data.vertices)))
    # Keep the source SF3D/TripoSR material and UV texture imported with each
    # PartField submesh. Use the part palette only when no usable material was
    # present in the source asset.
    if not obj.data.materials:
        obj.data.materials.append(material_for(part, index))
        for poly in obj.data.polygons:
            poly.material_index = 0
        poly.use_smooth = True
    parts.append(obj)

if not parts:
    raise RuntimeError("PartField split produced no importable parts")

for obj in bpy.context.scene.objects:
    if obj not in parts and obj.type not in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(obj, do_unlink=True)

minimum = Vector((min((obj.matrix_world @ Vector(corner))[axis] for obj in parts for corner in obj.bound_box) for axis in range(3)))
maximum = Vector((max((obj.matrix_world @ Vector(corner))[axis] for obj in parts for corner in obj.bound_box) for axis in range(3)))
center = (minimum + maximum) / 2
extent = max(maximum - minimum)
if extent <= 0:
    extent = 1

scene = bpy.context.scene
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except Exception:
        pass
scene.render.resolution_x = 900
scene.render.resolution_y = 700
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = config["previewPath"]
world = bpy.data.worlds.new("PartField assembly world")
world.color = (0.015, 0.018, 0.022)
scene.world = world

bpy.ops.object.camera_add(location=center + Vector((0.12, -3.6, 0.58)) * extent)
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = extent * 1.55
camera.rotation_euler = ((center - camera.location).to_track_quat("-Z", "Y").to_euler())
scene.camera = camera
bpy.ops.object.light_add(type="AREA", location=center + Vector((3.5, -4, 5)) * extent)
key = bpy.context.object
key.data.energy = 1200
key.data.size = max(3, extent * 3)
bpy.ops.object.light_add(type="AREA", location=center + Vector((-3, -2, 3)) * extent)
fill = bpy.context.object
fill.data.energy = 520
fill.data.size = max(2.5, extent * 2.5)

bpy.ops.wm.save_as_mainfile(filepath=config["blendPath"])
bpy.ops.object.select_all(action="DESELECT")
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.export_scene.gltf(filepath=config["outputPath"], export_format="GLB", use_selection=True, export_extras=True)
bpy.ops.render.render(write_still=True)

view_directions = {
    "front": Vector((0.12, -3.6, 0.58)),
    "left": Vector((-3.6, -0.12, 0.58)),
    "right": Vector((3.6, 0.12, 0.58)),
    "back": Vector((0.12, 3.6, 0.58)),
}
for view_name, direction in view_directions.items():
    camera.location = center + direction * extent
    camera.rotation_euler = ((center - camera.location).to_track_quat("-Z", "Y").to_euler())
    scene.render.filepath = config["viewPaths"][view_name]
    bpy.ops.render.render(write_still=True)

with open(config["partsPath"], "w", encoding="utf-8") as target:
    json.dump([
        {
            "name": obj.name,
            "partKey": obj["partKey"],
            "partLabel": obj["partLabel"],
            "method": obj["method"],
            "confidence": obj["confidence"],
            "faceCount": obj["faceCount"],
            "vertexCount": obj["vertexCount"],
        }
        for obj in parts
    ], target, ensure_ascii=False)
'''


def _relative(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")


def _urls(output_dir: Path, glb: Path, blend: Path | None, preview: Path | None, view_images: dict[str, Path] | None = None):
    result = {
        "glbUrl": "/api/3d/download/" + _relative(glb).split("generated/", 1)[1],
        "blendUrl": "/api/3d/download/" + _relative(blend).split("generated/", 1)[1] if blend else "",
        "previewUrl": "/api/3d/preview/" + _relative(preview).split("generated/", 1)[1] if preview else "",
    }
    if view_images:
        result["viewImageUrls"] = {
            name: "/api/3d/preview/" + _relative(path).split("generated/", 1)[1]
            for name, path in view_images.items()
            if path.is_file()
        }
        result["viewImageSource"] = "model-rendered-standard-views"
    return result


def _package_glb_partfield(glb_bytes: bytes, source_label: str, mode: str):
    if not glb_bytes.startswith(b"glTF"):
        raise ValueError("3D 服务没有返回有效 GLB 文件")
    run_dir = OUTPUT_DIR / f"{mode}_partfield_{uuid.uuid4().hex[:8]}"
    run_dir.mkdir(parents=True, exist_ok=True)
    input_path = run_dir / "source.glb"
    output_path = run_dir / "model.glb"
    blend_path = run_dir / "model.blend"
    preview_path = run_dir / "preview.png"
    view_paths = {name: run_dir / f"qa-{name}.png" for name in ("front", "left", "right", "back")}
    parts_path = run_dir / "parts.json"
    input_path.write_bytes(glb_bytes)

    segmentation = partfield_adapter.segment(input_path, run_dir / "segmentation")
    if not segmentation.get("ok"):
        return {"ok": False, "runDir": run_dir, "segmentation": segmentation}

    blender = biomed_models.find_blender()
    if not blender:
        failed = {
            **segmentation,
            "ok": False,
            "status": "assembly_unavailable",
            "message": "PartField completed but Blender was not found for GLB assembly",
        }
        return {"ok": False, "runDir": run_dir, "segmentation": failed}

    report = segmentation.get("report") or {}
    for index, part in enumerate(report.get("parts") or [], 1):
        part.setdefault("partLabel", f"PartField part {index:02d}")
        part.setdefault("confidence", 0.72)
    config_path = run_dir / "partfield_assembly.json"
    runner_path = run_dir / "partfield_assembly.py"
    config_path.write_text(json.dumps({
        "splitDir": segmentation["splitDir"],
        "partReport": report,
        "sourceLabel": source_label,
        "license": partfield_adapter.LICENSE,
        "outputPath": str(output_path),
        "blendPath": str(blend_path),
        "previewPath": str(preview_path),
        "viewPaths": {name: str(path) for name, path in view_paths.items()},
        "partsPath": str(parts_path),
    }, ensure_ascii=False), encoding="utf-8")
    runner_path.write_text(PARTFIELD_BLENDER_SCRIPT, encoding="utf-8")
    try:
        completed = subprocess.run([str(blender), "--background", "--factory-startup", "--python-exit-code", "1", "--python", str(runner_path), "--", "--config", str(config_path)], cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300, check=False)
        if completed.returncode != 0 or not output_path.is_file() or not blend_path.is_file() or not preview_path.is_file() or not all(path.is_file() for path in view_paths.values()):
            (run_dir / "partfield_blender.log").write_text((completed.stdout or "") + "\n" + (completed.stderr or ""), encoding="utf-8")
            failed = {
                **segmentation,
                "ok": False,
                "status": "assembly_failed",
                "message": "PartField completed but Blender assembly failed",
            }
            return {"ok": False, "runDir": run_dir, "segmentation": failed}
        parts = json.loads(parts_path.read_text(encoding="utf-8"))
        warnings = list(segmentation.get("warnings") or [])
        license_warning = "PartField segmentation is licensed for non-commercial research and educational use."
        return {
            "ok": True,
            "status": "generated",
            "editable": True,
            "message": f"PartField 已完成语义候选拆件，共 {len(parts)} 个独立部件；请按研究/教学许可使用。",
            "parts": parts,
            "warnings": warnings + [license_warning],
            "segmentation": {
                "provider": "partfield-local",
                "status": "completed",
                "partCount": len(parts),
                "hierarchical": bool(segmentation.get("hierarchical", True)),
                "labelPath": segmentation.get("labelPath", ""),
                "license": partfield_adapter.LICENSE,
                "warnings": warnings + [license_warning],
            },
            "separation": {
                "status": "validated" if len(parts) >= 2 else "low_confidence",
                "partCount": len(parts),
                "semantic": True,
                "warnings": warnings,
            },
            "workflow": ["partfield-local", "mesh-repair", "blender-assembly", "export-pipeline", "qa-review"],
            **_urls(run_dir, output_path, blend_path, preview_path, view_paths),
        }
    finally:
        config_path.unlink(missing_ok=True)
        runner_path.unlink(missing_ok=True)


def _package_glb_legacy(glb_bytes: bytes, source_label: str, mode: str):
    if not glb_bytes.startswith(b"glTF"):
        raise ValueError("3D 服务没有返回有效 GLB 文件")
    run_dir = OUTPUT_DIR / f"{mode}_{uuid.uuid4().hex[:8]}"
    run_dir.mkdir(parents=True, exist_ok=True)
    input_path = run_dir / "source.glb"
    output_path = run_dir / "model.glb"
    blend_path = run_dir / "model.blend"
    preview_path = run_dir / "preview.png"
    view_paths = {name: run_dir / f"qa-{name}.png" for name in ("front", "left", "right", "back")}
    parts_path = run_dir / "parts.json"
    input_path.write_bytes(glb_bytes)
    blender = biomed_models.find_blender()
    if not blender:
        return {"status": "uneditable", "editable": False, "message": "模型已生成，但未找到 Blender，暂不能拆分部件", "glbUrl": "", "blendUrl": "", "previewUrl": "", "parts": []}
    config_path = run_dir / "config.json"
    runner_path = run_dir / "runner.py"
    config_path.write_text(json.dumps({"inputPath": str(input_path), "outputPath": str(output_path), "blendPath": str(blend_path), "previewPath": str(preview_path), "viewPaths": {name: str(path) for name, path in view_paths.items()}, "partsPath": str(parts_path), "sourceLabel": source_label}, ensure_ascii=False), encoding="utf-8")
    runner_path.write_text(BLENDER_SCRIPT, encoding="utf-8")
    try:
        completed = subprocess.run([str(blender), "--background", "--factory-startup", "--python-exit-code", "1", "--python", str(runner_path), "--", "--config", str(config_path)], cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300, check=False)
        if completed.returncode != 0 or not output_path.is_file() or not blend_path.is_file() or not preview_path.is_file() or not all(path.is_file() for path in view_paths.values()):
            (run_dir / "blender.log").write_text((completed.stdout or "") + "\n" + (completed.stderr or ""), encoding="utf-8")
            return {"status": "failed", "editable": False, "message": "Blender 拆分失败，已保留生成日志", "glbUrl": "", "blendUrl": "", "previewUrl": "", "parts": []}
        parts = json.loads(parts_path.read_text(encoding="utf-8"))
        separable = len(parts) >= 2
        warnings = [] if separable else ["仅识别到一个有效网格，模型可以编辑，但不能可靠拆解为多个语义部件"]
        return {
            "status": "generated" if separable else "low_confidence",
            "editable": True,
            "message": f"已生成可拆分模型，共 {len(parts)} 个部件" if separable else warnings[0],
            "parts": parts,
            "separation": {"status": "validated" if separable else "low_confidence", "partCount": len(parts), "warnings": warnings},
            "workflow": ["blender-director", "blender-modeler", "retopology", "materials", "asset-optimization", "export-pipeline", "qa-review"],
            **_urls(run_dir, output_path, blend_path, preview_path, view_paths),
        }
    finally:
        config_path.unlink(missing_ok=True)
        runner_path.unlink(missing_ok=True)


def package_glb(glb_bytes: bytes, source_label: str, mode: str):
    partfield_result = _package_glb_partfield(glb_bytes, source_label, mode)
    if partfield_result.get("ok"):
        return partfield_result

    result = _package_glb_legacy(glb_bytes, source_label, mode)
    if not isinstance(result, dict):
        return result
    partfield_segmentation = partfield_result.get("segmentation") or {}
    fallback_warning = "PartField segmentation was not used; fell back to Blender geometric splitting."
    if partfield_segmentation.get("status"):
        fallback_warning = f"{fallback_warning} ({partfield_segmentation.get('status')})"
    result.setdefault("warnings", []).append(fallback_warning)
    result["segmentation"] = {
        "provider": "partfield-local",
        "status": "fallback",
        "partCount": 0,
        "hierarchical": False,
        "license": partfield_adapter.LICENSE,
        "fallback": "Blender geometric split",
        "warnings": list(partfield_segmentation.get("warnings") or [fallback_warning]),
    }
    if not result.get("editable"):
        return result
    parts = result.get("parts") or []
    separable = len(parts) >= 2
    template = source_label.startswith("Local built-in heart anatomy template")
    sf3d = source_label.startswith("SF3D API")
    # Geometric islands and visual-hull bands do not establish anatomical identity.
    semantic = False
    warnings = []
    if not separable:
        warnings.append("仅检测到一个有效网格：可以编辑，但尚不能可靠拆分部件。")
    elif not semantic:
        warnings.append("几何区域可单独选择，但尚未验证其解剖或语义边界。")
    validated_parts = separable
    result.update({
        "status": "generated" if validated_parts else "low_confidence",
        "message": f"本机心脏模板已保留 {len(parts)} 个可独立选择的网格对象；图片逐结构匹配仍需人工校核。" if template and separable else (f"生成 {len(parts)} 个可独立选择的几何区域；语义拆件仍需人工校核。" if separable else warnings[0]),
        "separation": {
            "status": "validated" if validated_parts else "low_confidence",
            "partCount": len(parts),
            "semantic": semantic,
            "warnings": ([] if validated_parts else warnings) + (["这是本机内置心脏教学模板，不是从参考图逐结构重建。"] if template else []),
        },
    })
    return result
