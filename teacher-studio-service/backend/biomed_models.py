from __future__ import annotations

import json
import os
import subprocess
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GENERATED_DIR = ROOT / "generated" / "biomed"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)


MODEL_CATALOG = {
    "heart": {
        "name": "心脏结构",
        "englishName": "Heart anatomy",
        "discipline": "人体解剖学 / 生理学",
        "parts": [
            {"key": "left_atrium", "name": "左心房", "englishName": "Left atrium", "color": "atrium"},
            {"key": "right_atrium", "name": "右心房", "englishName": "Right atrium", "color": "atrium"},
            {"key": "left_ventricle", "name": "左心室", "englishName": "Left ventricle", "color": "ventricle"},
            {"key": "right_ventricle", "name": "右心室", "englishName": "Right ventricle", "color": "muscle"},
            {"key": "septum", "name": "室间隔", "englishName": "Interventricular septum", "color": "septum"},
            {"key": "aorta", "name": "主动脉", "englishName": "Aorta", "color": "artery"},
            {"key": "pulmonary_artery", "name": "肺动脉", "englishName": "Pulmonary artery", "color": "vein"},
            {"key": "vena_cava", "name": "上腔静脉", "englishName": "Superior vena cava", "color": "vein"},
            {"key": "inferior_vena_cava", "name": "下腔静脉", "englishName": "Inferior vena cava", "color": "vein"},
            {"key": "pulmonary_veins", "name": "肺静脉", "englishName": "Pulmonary veins", "color": "artery"},
        ],
        "tasks": ["前视图定位左右心房与心室；方向按受观察者的解剖左右标识", "隐藏心房、显示室间隔，解释左右循环分隔；本示意不用于测量壁厚", "追踪腔静脉至右心及肺静脉至左心的血流出口"],
        "references": [{"title": "基础医学课程内置结构模板", "author": "Teacher Studio", "year": "2026", "sourceType": "builtin-template", "sourceUrl": "", "license": "internal", "usedIn": ["model-heart"]}],
    },
    "lung": {
        "name": "肺与气道",
        "englishName": "Lung and airway",
        "discipline": "人体解剖学 / 生理学",
        "parts": [
            {"key": "left_lung", "name": "左肺", "englishName": "Left lung", "color": "lung"},
            {"key": "right_lung", "name": "右肺", "englishName": "Right lung", "color": "lung"},
            {"key": "trachea", "name": "气管", "englishName": "Trachea", "color": "airway"},
            {"key": "bronchi", "name": "支气管", "englishName": "Bronchi", "color": "airway"},
            {"key": "alveoli", "name": "肺泡区域", "englishName": "Alveoli", "color": "alveoli"},
        ],
        "tasks": ["隐藏一侧肺，比较左右肺的形态", "沿气管到支气管追踪空气通路", "放大肺泡区域，说明气体交换界面"],
        "references": [{"title": "基础医学课程内置呼吸系统模板", "author": "Teacher Studio", "year": "2026", "sourceType": "builtin-template", "sourceUrl": "", "license": "internal", "usedIn": ["model-lung"]}],
    },
    "kidney": {
        "name": "肾脏与肾单位",
        "englishName": "Kidney and nephron",
        "discipline": "人体解剖学 / 生理学",
        "parts": [
            {"key": "kidney", "name": "肾脏", "englishName": "Kidney", "color": "kidney"},
            {"key": "cortex", "name": "肾皮质", "englishName": "Renal cortex", "color": "cortex"},
            {"key": "medulla", "name": "肾髓质", "englishName": "Renal medulla", "color": "medulla"},
            {"key": "pelvis", "name": "肾盂", "englishName": "Renal pelvis", "color": "pelvis"},
            {"key": "ureter", "name": "输尿管", "englishName": "Ureter", "color": "ureter"},
            {"key": "nephron", "name": "肾单位示意", "englishName": "Nephron", "color": "airway"},
        ],
        "tasks": ["先辨认肾皮质与肾髓质的位置关系", "显示肾盂，解释尿液汇集路径", "结合肾单位示意，区分滤过与重吸收"],
        "references": [{"title": "基础医学课程内置泌尿系统模板", "author": "Teacher Studio", "year": "2026", "sourceType": "builtin-template", "sourceUrl": "", "license": "internal", "usedIn": ["model-kidney"]}],
    },
    "cell": {
        "name": "动物细胞",
        "englishName": "Animal cell",
        "discipline": "细胞生物学",
        "parts": [
            {"key": "membrane", "name": "细胞膜", "englishName": "Cell membrane", "color": "membrane"},
            {"key": "nucleus", "name": "细胞核", "englishName": "Nucleus", "color": "nucleus"},
            {"key": "mitochondria", "name": "线粒体", "englishName": "Mitochondria", "color": "mitochondria"},
            {"key": "er", "name": "内质网", "englishName": "Endoplasmic reticulum", "color": "er"},
            {"key": "golgi", "name": "高尔基体", "englishName": "Golgi apparatus", "color": "golgi"},
            {"key": "ribosome", "name": "核糖体", "englishName": "Ribosome", "color": "ribosome"},
        ],
        "tasks": ["隐藏细胞器，先观察细胞膜和细胞核", "比较线粒体与高尔基体的空间位置", "用结构解释能量供应与物质运输"],
        "references": [{"title": "基础细胞生物学课程内置模板", "author": "Teacher Studio", "year": "2026", "sourceType": "builtin-template", "sourceUrl": "", "license": "internal", "usedIn": ["model-cell"]}],
    },
}


BLENDER_SCRIPT = r'''
import bpy
import json
import math
import sys
from mathutils import Vector

config_path = sys.argv[sys.argv.index("--config") + 1]
with open(config_path, "r", encoding="utf-8") as source:
    config = json.load(source)

def mat(name, color, metallic=0.0, roughness=0.42):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material

COLORS = {
    "muscle": (0.55, 0.035, 0.045), "ventricle": (0.84, 0.07, 0.08), "atrium": (0.95, 0.22, 0.16),
    "artery": (0.9, 0.12, 0.08), "vein": (0.04, 0.22, 0.62), "septum": (0.45, 0.02, 0.02),
    "lung": (0.78, 0.18, 0.28), "airway": (0.86, 0.66, 0.48), "alveoli": (0.98, 0.42, 0.5),
    "kidney": (0.54, 0.08, 0.12), "cortex": (0.78, 0.21, 0.18), "medulla": (0.94, 0.47, 0.25),
    "pelvis": (0.95, 0.72, 0.28), "ureter": (0.85, 0.67, 0.32), "membrane": (0.12, 0.58, 0.74),
    "nucleus": (0.37, 0.12, 0.65), "mitochondria": (0.92, 0.28, 0.12), "er": (0.12, 0.68, 0.48),
    "golgi": (0.95, 0.66, 0.15), "ribosome": (0.9, 0.2, 0.62), "label": (0.92, 0.96, 1.0),
}
MATERIALS = {name: mat("Biomedical " + name, value) for name, value in COLORS.items()}

def apply(obj, material):
    obj.data.materials.append(material)
    if hasattr(obj.data, "polygons"):
        for face in obj.data.polygons:
            face.use_smooth = True
    return obj

def sphere(name, location, scale, color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, MATERIALS[color])

def cylinder(name, location, radius, depth, color, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    bevel = obj.modifiers.new("Rounded edges", "BEVEL")
    bevel.width = min(radius * 0.28, 0.08)
    bevel.segments = 3
    return apply(obj, MATERIALS[color])

def torus(name, location, major, minor, color, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=40, minor_segments=12, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, MATERIALS[color])

def tube(name, points, radius, color):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    return apply(obj, MATERIALS[color])

def text_object(name, body, location, size=0.22):
    bpy.ops.object.text_add(location=location, rotation=(math.radians(74), 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.008
    return apply(obj, MATERIALS["label"])

def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

key = config["modelKey"]
if key == "heart":
    sphere("Heart muscle", (0, 0, 0.4), (1.18, 0.64, 1.52), "muscle")
    sphere("Left atrium", (-0.46, -0.66, 1.32), (0.48, 0.2, 0.38), "atrium")
    sphere("Right atrium", (0.46, -0.66, 1.32), (0.44, 0.2, 0.36), "atrium")
    sphere("Left ventricle", (-0.43, -0.68, 0.22), (0.52, 0.22, 0.95), "ventricle")
    sphere("Right ventricle", (0.42, -0.68, 0.22), (0.5, 0.22, 0.88), "muscle")
    cylinder("Interventricular septum", (0, -0.93, 0.25), 0.06, 1.5, "septum")
    tube("Aorta", [(-0.03, 0, 1.55), (-0.02, 0, 2.3), (0.42, 0, 2.72), (1.06, 0, 2.6)], 0.2, "artery")
    tube("Pulmonary artery", [(0.2, -0.05, 1.55), (0.57, -0.05, 2.14), (1.12, -0.05, 2.08)], 0.15, "vein")
    tube("Superior vena cava", [(0.55, 0.02, 1.3), (0.9, 0.02, 2.45), (1.13, 0.02, 2.56)], 0.15, "vein")
    tube("Inferior vena cava", [(0.55, 0.02, 1.3), (1.1, 0.05, 0.4), (1.25, 0.05, -0.8)], 0.15, "vein")
    tube("Pulmonary veins", [(-1.5, 0, 1.6), (-0.85, 0, 1.55), (-0.46, 0, 1.32)], 0.13, "artery")
    labels = [("AORTA", (1.45, -0.34, 2.7)), ("LEFT ATRIUM", (-1.35, -0.34, 1.55)), ("LEFT VENTRICLE", (-1.3, -0.34, 0.18))]
elif key == "lung":
    sphere("Left lung", (-0.72, 0, 0.55), (0.85, 0.55, 1.48), "lung")
    sphere("Right lung", (0.72, 0, 0.55), (0.92, 0.58, 1.58), "lung")
    cylinder("Trachea", (0, 0, 2.18), 0.18, 1.15, "airway")
    tube("Bronchi", [(0, 0, 1.75), (-0.42, 0, 1.45), (-0.78, 0, 1.25)], 0.11, "airway")
    tube("Bronchi right", [(0, 0, 1.75), (0.42, 0, 1.45), (0.78, 0, 1.25)], 0.11, "airway")
    for index, location in enumerate([(-0.9, -0.55, 0.3), (-0.62, -0.58, 0.6), (0.63, -0.58, 0.72), (0.9, -0.55, 0.3)]):
        sphere("Alveoli %02d" % (index + 1), location, (0.18, 0.12, 0.18), "alveoli")
    labels = [("TRACHEA", (0, -0.4, 2.85)), ("LEFT LUNG", (-1.38, -0.4, 0.65)), ("ALVEOLI", (1.35, -0.4, 0.2))]
elif key == "kidney":
    sphere("Kidney", (0, 0, 0.45), (1.25, 0.58, 1.65), "kidney")
    sphere("Renal cortex", (0, -0.58, 0.45), (0.95, 0.12, 1.35), "cortex")
    sphere("Renal medulla", (0, -0.76, 0.4), (0.58, 0.08, 0.92), "medulla")
    torus("Renal pelvis", (0.14, -0.88, 0.35), 0.35, 0.09, "pelvis", (math.radians(90), 0, 0))
    tube("Ureter", [(0.15, 0, -0.92), (0.2, 0, -1.45), (0.23, 0, -1.95)], 0.11, "ureter")
    sphere("Nephron glomerulus", (1.6, -0.5, 1.2), (0.2, 0.2, 0.2), "artery")
    tube("Nephron tubule", [(1.6,-0.5,1.1), (1.85,-0.5,0.8), (1.5,-0.5,0.5), (1.5,-0.5,-0.6), (1.85,-0.5,-0.6), (1.85,-0.5,0.5), (2.1,-0.5,0.8)], 0.06, "airway")
    labels = [("RENAL CORTEX", (-1.45, -0.35, 1.18)), ("RENAL MEDULLA", (1.35, -0.35, 0.55)), ("URETER", (0.9, -0.35, -1.55))]
else:
    sphere("Cell membrane", (0, 0, 0.55), (2.0, 1.36, 1.58), "membrane")
    sphere("Nucleus", (0, -1.0, 0.55), (0.62, 0.22, 0.62), "nucleus")
    for index, location in enumerate([(-0.95, -0.95, 1.1), (0.9, -0.95, 0.3), (-0.7, -0.95, -0.15), (0.85, -0.95, 1.05)]):
        sphere("Mitochondria %02d" % (index + 1), location, (0.27, 0.12, 0.14), "mitochondria")
    torus("Endoplasmic reticulum", (-0.78, -0.98, 0.55), 0.48, 0.07, "er", (math.radians(90), 0, 0))
    torus("Golgi apparatus", (0.78, -0.98, 0.82), 0.42, 0.07, "golgi", (math.radians(90), 0, 0))
    for index, location in enumerate([(-1.1, -1.0, 0.55), (-0.9, -1.0, -0.5), (1.08, -1.0, -0.5), (1.25, -1.0, 0.8)]):
        sphere("Ribosome %02d" % (index + 1), location, (0.08, 0.05, 0.08), "ribosome")
    labels = [("CELL MEMBRANE", (0, -0.6, 2.25)), ("NUCLEUS", (-1.25, -0.55, 0.55)), ("MITOCHONDRIA", (1.35, -0.55, 0.1))]

# Match all meshes/curves to stable part keys, then export only anatomy.
anatomy = []
part_materials = {}
for obj in list(bpy.context.scene.objects):
    part = next((p for p in config["partDetails"] if obj.name.lower().startswith(p["englishName"].lower())), None)
    if not part or part["key"] not in config["parts"]:
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    obj["partKey"] = part["key"]
    obj["labelZh"] = part["name"]
    obj["labelEn"] = part["englishName"]
    obj.name = part["name"] + " | " + obj.name
    if part["key"] not in part_materials:
        material = MATERIALS[part["color"]].copy()
        material.name = part["key"]
        part_materials[part["key"]] = material
    obj.data.materials.clear()
    obj.data.materials.append(part_materials[part["key"]])
    obj["source"] = "Teacher Studio schematic; not to anatomical scale"
    # Anterior view: anatomical left is viewer's right.
    if key == "heart":
        obj.location.x *= -1
        obj.scale.x *= -1
    if config.get("renderMode") == "exploded":
        obj.location.x *= 1.35
        obj.location.y -= 0.12 * config["parts"].index(part["key"])
    anatomy.append(obj)

with open(config["annotationPath"], "w", encoding="utf-8") as target:
    json.dump([{"key": obj["partKey"], "text": obj["labelZh"], "position": list(obj.location)} for obj in anatomy], target, ensure_ascii=False)

bpy.ops.object.select_all(action="DESELECT")
for obj in anatomy:
    obj.select_set(True)
bpy.context.view_layer.objects.active = anatomy[0]
bpy.ops.object.convert(target="MESH")
bpy.ops.export_scene.gltf(filepath=config["glbPath"], export_format="GLB", use_selection=True, export_extras=True)

bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -2.1))
stage = bpy.context.object
stage.name = "Teaching stage"
apply(stage, mat("Stage", (0.012, 0.018, 0.028), roughness=0.58))

bpy.ops.object.light_add(type="AREA", location=(4.5, -6, 6.5))
key_light = bpy.context.object
key_light.data.energy = 1200
key_light.data.size = 5
look_at(key_light, (0, 0, 0.5))
bpy.ops.object.light_add(type="AREA", location=(-4, -2, 3.5))
fill_light = bpy.context.object
fill_light.data.energy = 900
fill_light.data.color = (0.2, 0.42, 1.0)
fill_light.data.size = 4
look_at(fill_light, (0, 0, 0.5))
bpy.ops.object.light_add(type="AREA", location=(2.5, 3, 4.5))
rim_light = bpy.context.object
rim_light.data.energy = 1000
rim_light.data.color = (1.0, 0.2, 0.08)
rim_light.data.size = 3
look_at(rim_light, (0, 0, 0.7))

bpy.ops.object.camera_add(location=(5.8, -10.8, 4.8))
camera = bpy.context.object
camera.name = "Teaching camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 7.5
look_at(camera, (0, 0, 0.55))
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = config["previewPath"]
scene.world.color = (0.005, 0.008, 0.015)
scene.view_settings.look = "AgX - Medium High Contrast"
bpy.ops.wm.save_as_mainfile(filepath=config["blendPath"])
bpy.ops.render.render(write_still=True)
'''


def find_blender():
    candidates = [
        os.environ.get("BIOMED_BLENDER_PATH", ""),
        r"D:\blender\blender.exe",
        r"C:\Program Files\Blender Foundation\Blender\blender.exe",
    ]
    return next((Path(candidate) for candidate in candidates if candidate and Path(candidate).is_file()), None)


def catalog():
    return [{"modelKey": key, **value} for key, value in MODEL_CATALOG.items()]


def model_plan(model_key, requested_parts=None, render_mode="exploded"):
    if model_key not in MODEL_CATALOG:
        raise ValueError("未知的生物医学模型")
    definition = MODEL_CATALOG[model_key]
    valid_keys = {part["key"] for part in definition["parts"]}
    if requested_parts is not None and (not isinstance(requested_parts, list) or any(part not in valid_keys for part in requested_parts)):
        raise ValueError("包含未知模型部件")
    selected = list(dict.fromkeys(requested_parts or []))
    return {
        "modelKey": model_key,
        "modelName": definition["name"],
        "englishName": definition["englishName"],
        "discipline": definition["discipline"],
        "parts": selected or [part["key"] for part in definition["parts"]],
        "partDetails": [part for part in definition["parts"] if not selected or part["key"] in selected],
        "labels": [{"key": part["key"], "text": part["name"], "englishName": part["englishName"]} for part in definition["parts"] if not selected or part["key"] in selected],
        "defaultCamera": {"position": [5.8, -10.8, 4.8], "target": [0, 0, 0.55]},
        "quality": "教学结构示意，非解剖扫描；不按真实比例，不用于诊断或壁厚测量",
        "observationTasks": definition["tasks"],
        "renderMode": render_mode if render_mode in ("assembled", "exploded") else "exploded",
        "references": definition["references"],
    }


def generate_model(model_key, requested_parts=None, render_mode="exploded"):
    plan = model_plan(model_key, requested_parts, render_mode)
    run_id = f"{model_key}_{uuid.uuid4().hex[:8]}"
    output_dir = GENERATED_DIR / run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    blend_path = output_dir / f"{model_key}.blend"
    glb_path = output_dir / f"{model_key}.glb"
    preview_path = output_dir / "preview.png"
    manifest_path = output_dir / "manifest.json"
    blender = find_blender()
    result = {**plan, "runId": run_id, "status": "fallback", "editable": False, "message": "Blender 不可用，仅提供通用演示模型，不能用于器官结构观察", "blendPath": "", "glbPath": "", "previewPath": "", "manifestPath": str(manifest_path.relative_to(ROOT)).replace(os.sep, "/")}
    if blender:
        config_path = output_dir / "config.json"
        runner_path = output_dir / "runner.py"
        config_path.write_text(json.dumps({**plan, "blendPath": str(blend_path), "glbPath": str(glb_path), "previewPath": str(preview_path), "annotationPath": str(output_dir / "annotations.json")}, ensure_ascii=False), encoding="utf-8")
        runner_path.write_text(BLENDER_SCRIPT, encoding="utf-8")
        try:
            completed = subprocess.run([str(blender), "--background", "--factory-startup", "--python-exit-code", "1", "--python", str(runner_path), "--", "--config", str(config_path)], cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=240, check=False)
            if completed.returncode == 0 and blend_path.is_file() and glb_path.is_file() and preview_path.is_file():
                result.update({"status": "generated", "editable": True, "message": "已生成可分部件编辑的教学示意模型", "blendPath": str(blend_path.relative_to(ROOT)).replace(os.sep, "/"), "glbPath": str(glb_path.relative_to(ROOT)).replace(os.sep, "/"), "previewPath": str(preview_path.relative_to(ROOT)).replace(os.sep, "/")})
            else:
                (output_dir / "blender.log").write_text((completed.stdout or "") + "\n" + (completed.stderr or ""), encoding="utf-8", errors="replace")
                result["message"] = "Blender 生成失败；已保留日志，回退为通用演示模型"
        except (OSError, subprocess.TimeoutExpired) as exc:
            result["message"] = "Blender 不可用或超时；回退为通用演示模型"
            (output_dir / "blender.log").write_text(str(exc), encoding="utf-8")
        finally:
            config_path.unlink(missing_ok=True)
            runner_path.unlink(missing_ok=True)
    fallback = ROOT / "generated" / "sample-3d-teaching-prism.glb"
    if result["status"] == "fallback" and fallback.is_file():
        result["glbPath"] = str(fallback.relative_to(ROOT)).replace(os.sep, "/")
    if result["status"] == "generated":
        result["labels"] = json.loads((output_dir / "annotations.json").read_text(encoding="utf-8"))
    for key, prefix in (("blend", "download"), ("glb", "download"), ("preview", "preview")):
        relative = result[key + "Path"]
        result[key + "Url"] = "/api/3d/" + prefix + "/" + str(Path(relative).relative_to("generated")).replace(os.sep, "/") if relative else ""
    manifest_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result
