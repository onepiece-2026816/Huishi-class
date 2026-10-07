"""Deterministic heart courseware manifest, PPTX and offline package generation."""
from __future__ import annotations

import html
import json
import re
import uuid
import zipfile
import hashlib
import posixpath
import xml.etree.ElementTree as ET
from urllib.parse import unquote, urlsplit
import model_views
from pathlib import Path

from PIL import Image, ImageFont
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
from pptx.oxml.xmlchemy import OxmlElement


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent
OUTPUT_DIR = ROOT / "generated"
OUTPUT_DIR.mkdir(exist_ok=True)

CHINESE_COPY = json.loads((PROJECT_ROOT / 'public' / 'courseware-zh.json').read_text(encoding='utf-8'))


def _chinese_copy(value):
    if isinstance(value, str):
        return CHINESE_COPY.get(value, re.sub(r'^Activity (\d+)$', r'教学活动 \1', value).replace('Reasoning:', '推理：'))
    if isinstance(value, list):
        return [_chinese_copy(item) for item in value]
    if isinstance(value, dict):
        return {key: _chinese_copy(item) for key, item in value.items()}
    return value

HEART_PARTS = [
    ("myocardium", "心肌外壳", "Myocardium", "myocardium"),
    ("left_atrium", "左心房", "Left atrium", "chambers"),
    ("right_atrium", "右心房", "Right atrium", "chambers"),
    ("left_ventricle", "左心室", "Left ventricle", "chambers"),
    ("right_ventricle", "右心室", "Right ventricle", "chambers"),
    ("atrial_septum", "房间隔", "Atrial septum", "septa"),
    ("ventricular_septum", "室间隔", "Ventricular septum", "septa"),
    ("aorta", "主动脉", "Aorta", "vessels"),
    ("pulmonary_artery", "肺动脉", "Pulmonary artery", "vessels"),
    ("pulmonary_veins", "肺静脉", "Pulmonary veins", "vessels"),
    ("superior_vena_cava", "上腔静脉", "Superior vena cava", "vessels"),
    ("inferior_vena_cava", "下腔静脉", "Inferior vena cava", "vessels"),
    ("mitral_valve", "二尖瓣", "Mitral valve", "valves"),
    ("tricuspid_valve", "三尖瓣", "Tricuspid valve", "valves"),
    ("aortic_valve", "主动脉瓣", "Aortic valve", "valves"),
    ("pulmonary_valve", "肺动脉瓣", "Pulmonary valve", "valves"),
]


def _question(question_id, question, options, correct, explanation, parts, difficulty="基础"):
    return {
        "id": question_id,
        "question": question,
        "options": options,
        "correctIndex": correct,
        "explanation": explanation,
        "subject": "生物医学",
        "category": "model-warmup",
        "modelPartKeys": parts,
        "lessonId": "",
        "difficulty": difficulty,
        "enabled": True,
        "source": "generated",
    }


def default_questions(lesson_id):
    questions = [
        _question("heart-q1", "体循环静脉血首先进入哪个心腔？", ["右心房", "左心房", "右心室", "左心室"], 0, "上、下腔静脉将体循环静脉血送入右心房。", ["right_atrium", "superior_vena_cava", "inferior_vena_cava"]),
        _question("heart-q2", "血液从右心室射出后进入哪条血管？", ["主动脉", "肺动脉", "肺静脉", "上腔静脉"], 1, "右心室经肺动脉瓣将血液射入肺动脉。", ["right_ventricle", "pulmonary_valve", "pulmonary_artery"]),
        _question("heart-q3", "二尖瓣位于哪两个结构之间？", ["右心房与右心室", "左心房与左心室", "左心室与主动脉", "右心室与肺动脉"], 1, "二尖瓣连接左心房与左心室，并限制血液逆流。", ["left_atrium", "mitral_valve", "left_ventricle"]),
        _question("heart-q4", "判断动脉和静脉最可靠的依据是什么？", ["血液颜色", "含氧量", "血流相对心脏的方向", "血管粗细"], 2, "动脉将血液带离心脏，静脉将血液送回心脏；肺动脉是重要反例。", ["aorta", "pulmonary_artery", "pulmonary_veins"], "进阶"),
        _question("heart-q5", "室间隔出现通道且左室压力高于右室时，初始分流更可能如何？", ["左向右", "右向左", "无分流", "无法形成压力差"], 0, "在给定压力条件下血流倾向由左向右，但真实判断仍需缺损大小和肺血管阻力等证据。", ["left_ventricle", "ventricular_septum", "right_ventricle"], "进阶"),
    ]
    for index, item in enumerate(questions, 1):
        item["id"] = f"{lesson_id}-warmup-{index}"
        item["lessonId"] = lesson_id
    return questions


def _scene(index, scene_type, title, claim, cue, action, output, layout, motion, model=None):
    return {
        "id": f"scene-{index:02d}",
        "type": scene_type,
        "title": title,
        "claim": claim,
        "teacherCue": cue,
        "studentAction": action,
        "expectedOutput": output,
        "layout": layout,
        "motion": {"preset": motion, "durationMs": 480 if motion == "flow" else 360, "trigger": "step" if motion in ("flow", "reveal") else "enter"},
        "pptAnimation": "wipe" if motion == "flow" else "appear" if motion == "reveal" else "fade",
        "model": model,
        "source": "generated",
        "enabled": True,
    }


def build_manifest(lesson_plan, model=None, questions=None):
    lesson_plan = lesson_plan or {}
    request = lesson_plan.get("request") or {}
    lesson_id = str(lesson_plan.get("id") or uuid.uuid4().hex)
    title = str(lesson_plan.get("title") or request.get("topic") or "心脏血流与心脏结构")
    model = model or lesson_plan.get("modelAsset") or lesson_plan.get("modelPlan") or {}
    # `modelUrl` is the model currently selected in the lesson workbench and
    # must win over stale artifact fields retained from an earlier generation.
    model_url = str(model.get("modelUrl") or model.get("appearanceUrl") or model.get("glbUrl") or "/models/heart-anatomy-v1.glb")
    preview_image_url = str(model.get("previewUrl") or model.get("previewImageUrl") or "")
    hide_template_parts = model.get("anatomyDisplayAvailable") is False or bool(model.get("appearanceUrl"))
    parts = [] if hide_template_parts else [{"partKey": key, "partLabel": label, "labelEn": en, "group": group} for key, label, en, group in HEART_PARTS]
    model_config = {
        "modelKey": "heart",
        "modelUrl": model_url,
        "previewImageUrl": preview_image_url,
        "parts": parts,
        "defaultMode": "appearance",
        "observationTasks": ["旋转 SF3D 外观，观察心尖、心底与主要血管的外部关系"],
    }
    scenes = [
        _scene(1, "hook", "肺动脉为什么叫动脉？", "动静脉的命名依据是血流方向，而不是含氧量。", "先保留学生的第一判断，不立即公布答案。", "选择一种判断并写下一条依据。", "初始判断与依据", "cinematic-question", "fade"),
        _scene(2, "outcomes", "今天要建立一条完整证据链", "结构定位、方向追踪和证据边界共同构成可靠解释。", "用可观察、可评价的动作说明学习目标。", "检查自己能否定位、追踪并解释。", "个人学习检查表", "outcome-rail", "rise"),
        _scene(3, "model-overview", "先建立心脏的整体方位", "心尖、心底和前后关系是后续定位的坐标系。", "示范前视、左侧与后视切换。", "旋转模型并确认心尖与大血管出口。", "方位标记", "model-stage", "focus", {"partKeys": ["myocardium", "aorta", "pulmonary_artery"], "camera": "front", "mode": "appearance", "exploded": False, "explosionStrength": 0}),
        _scene(4, "chambers", "四个心腔不是简单左右排列", "心房接收回流，心室负责射血，左右两侧承担不同循环。", "逐个隔离心腔并核对相邻结构。", "点击四个心腔，完成名称与位置配对。", "四腔定位表", "anatomy-focus", "explode", {"partKeys": ["left_atrium", "right_atrium", "left_ventricle", "right_ventricle"], "camera": "front", "mode": "anatomy", "exploded": True, "explosionStrength": 0.45}),
        _scene(5, "vessels", "大血管的连接决定循环方向", "腔静脉和肺静脉回到心房，肺动脉和主动脉离开心室。", "隐藏心肌外壳，只保留心腔与主要血管。", "把六条大血管连接到对应心腔。", "结构连接图", "flow-path", "focus", {"partKeys": ["aorta", "pulmonary_artery", "pulmonary_veins", "superior_vena_cava", "inferior_vena_cava"], "camera": "posterior", "mode": "overlay", "exploded": True, "explosionStrength": 0.3}),
        _scene(6, "valves", "瓣膜让压力变化转化为单向血流", "四组瓣膜位于心腔与流出道的关键连接处。", "按房室瓣到半月瓣的顺序逐步揭示。", "判断每组瓣膜阻止哪一种逆流。", "瓣膜功能说明", "anatomy-focus", "reveal", {"partKeys": ["mitral_valve", "tricuspid_valve", "aortic_valve", "pulmonary_valve"], "camera": "front", "mode": "cutaway", "exploded": True, "explosionStrength": 0.58}),
        _scene(7, "blood-flow", "一滴血完成肺循环与体循环", "血流路径必须同时满足结构连接和压力方向。", "按步骤播放静脉蓝与动脉红路径，每一步停顿提问。", "按顺序点击下一段血流路径并口述结构名称。", "完整双循环路径", "flow-path", "flow", {"partKeys": [p[0] for p in HEART_PARTS], "camera": "front", "mode": "anatomy", "exploded": False, "explosionStrength": 0}),
        _scene(8, "comparison", "异常通道改变的是流动条件", "室间隔通道的后果取决于压力差、缺损大小和血管阻力。", "先比较结构差异，再讨论功能后果。", "切换正常与异常示意，圈出新增通道。", "正常/异常对照表", "compare-split", "reveal", {"partKeys": ["left_ventricle", "ventricular_septum", "right_ventricle"], "camera": "front", "mode": "cutaway", "exploded": False, "explosionStrength": 0}),
        _scene(9, "case-evidence", "病例判断必须区分证据与推断", "给定室间交通和左右室压力，只能推出限定条件下的初始分流倾向。", "把直接证据、机制推断和待验证数据分栏。", "拖动三条信息进入正确证据栏。", "病例证据链", "evidence-board", "rise"),
        _scene(10, "model-challenge", "不用颜色也能认出结构吗？", "连接关系比表面颜色更可靠。", "随机隔离一个部件，要求学生说出名称和连接依据。", "观察模型并选择结构名称。", "部件识别记录", "quiz-stage", "focus", {"partKeys": ["left_atrium", "right_atrium", "left_ventricle", "right_ventricle", "aorta", "pulmonary_artery"], "camera": "free", "mode": "anatomy", "exploded": True, "explosionStrength": 0.35}),
        _scene(11, "gesture-quiz", "用五道题检查结构与机制", "答题结果用于决定是否返回模型补充观察。", "启动现有手势答题，答错时回到对应模型部件。", "完成五道选择题并阅读解释。", "课堂测验结果", "evidence-board", "reveal"),
        _scene(12, "summary", "回到最初的问题", "动静脉按相对心脏的血流方向定义，结构、方向和证据缺一不可。", "再次呈现开场问题，对比学生前后答案。", "用结构、方向和反例完成三句话总结。", "出口条与课后双循环图", "closing-loop", "fade"),
    ]
    if hide_template_parts:
        for scene in scenes:
            if scene.get("model"):
                scene["model"] = {
                    **scene["model"],
                    "partKeys": [],
                    "mode": "appearance",
                    "exploded": False,
                    "explosionStrength": 0,
                }
    supplied_questions = questions or lesson_plan.get("warmupQuestions") or default_questions(lesson_id)
    for item in supplied_questions:
        item.setdefault("lessonId", lesson_id)
        item.setdefault("enabled", True)
        item.setdefault("source", "generated")
    references = lesson_plan.get("references") or [{"title": "OpenStax Anatomy and Physiology 2e / Heart Anatomy", "author": "OpenStax", "year": "2022", "sourceType": "web-reference", "sourceUrl": "https://openstax.org/books/anatomy-and-physiology-2e/pages/19-1-heart-anatomy", "license": "CC BY 4.0"}]
    manifest = {
        "version": 1,
        "lessonId": lesson_id,
        "title": title,
        "theme": "biomed-dark",
        "revision": 1,
        "status": "draft",
        "scenes": scenes,
        "model": model_config,
        "questions": supplied_questions[:5],
        "assets": [{"id": "heart-model", "type": "model", "url": model_url, "altText": "可拆分心脏教学模型", "sourceType": "local-model", "license": "教学用途，模型来源见课程参考资料"}],
        "references": references,
    }
    if preview_image_url:
        manifest["assets"].append({
            "id": "model-preview",
            "type": "image",
            "url": preview_image_url,
            "altText": "本课结构观察图",
            "sourceType": "generated-preview",
            "license": "由本课上传素材生成，仅用于教学",
        })
    manifest["quality"] = quality(manifest)
    manifest["status"] = "ready" if not manifest["quality"]["blocking"] else "draft"
    return manifest


def quality(manifest):
    scenes = [scene for scene in manifest.get("scenes", []) if scene.get("enabled", True)]
    blocking, warnings = [], []
    if not 10 <= len(scenes) <= 14:
        blocking.append("互动课件必须包含10至14个启用场景")
    layouts = {scene.get("layout") for scene in scenes}
    if len(layouts) < 6:
        blocking.append("互动课件至少需要6种宏观布局")
    if len(manifest.get("questions") or []) != 5:
        blocking.append("练习题必须包含5道题")
    for index, scene in enumerate(scenes):
        if not all(str(scene.get(key) or "").strip() for key in ("title", "claim", "studentAction", "expectedOutput")):
            blocking.append(f"第{index + 1}个场景缺少标题、结论、学生动作或学习产出")
        if index and scene.get("layout") == scenes[index - 1].get("layout"):
            warnings.append(f"第{index + 1}个场景与前一场景使用相同布局")
    required = {"model-overview", "blood-flow", "case-evidence", "gesture-quiz", "summary"}
    missing = required - {scene.get("type") for scene in scenes}
    if missing:
        blocking.append("缺少关键场景：" + "、".join(sorted(missing)))
    score = max(0, 100 - len(blocking) * 30 - len(warnings) * 5)
    return {"score": score, "blocking": blocking, "warnings": warnings, "layoutCount": len(layouts)}


def regenerate_scene(manifest, scene_id):
    lesson_context = manifest.get("lessonContext") or {"id": manifest.get("lessonId"), "title": manifest.get("title"), "references": manifest.get("references")}
    baseline = build_manifest(lesson_context, manifest.get("model"), manifest.get("questions"))
    replacement = next((scene for scene in baseline["scenes"] if scene["id"] == scene_id), None)
    if not replacement:
        raise ValueError("场景不存在")
    current = next((scene for scene in manifest.get("scenes", []) if scene.get("id") == scene_id), None)
    if current and current.get("source") == "teacher-edited":
        replacement["teacherCue"] = current.get("teacherCue", replacement["teacherCue"])
    replacement["source"] = "generated"
    manifest = dict(manifest)
    manifest["scenes"] = [replacement if scene.get("id") == scene_id else scene for scene in manifest.get("scenes", [])]
    manifest["revision"] = int(manifest.get("revision") or 1) + 1
    manifest["quality"] = quality(manifest)
    return manifest


def _safe_name(value):
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", str(value or "courseware")).strip("_") or "courseware"


def _resolve_model(model_url):
    clean_url = unquote(urlsplit(str(model_url or "")).path).replace('/api/prep/', '/api/')
    if clean_url.startswith("/models/"):
        candidate = PROJECT_ROOT / "public" / clean_url.lstrip("/")
    elif "/api/3d/download/" in clean_url:
        candidate = OUTPUT_DIR / clean_url.split("/api/3d/download/", 1)[1]
    else:
        candidate = Path()
    candidate = candidate.resolve()
    return candidate if candidate.is_file() and (PROJECT_ROOT.resolve() in candidate.parents or OUTPUT_DIR.resolve() in candidate.parents) else None


def _resolve_image(image_url):
    clean_url = unquote(urlsplit(str(image_url or "")).path).replace('/api/prep/', '/api/')
    if "/api/3d/preview/" in clean_url:
        candidate = OUTPUT_DIR / clean_url.split("/api/3d/preview/", 1)[1]
    elif clean_url.startswith("/images/"):
        candidate = PROJECT_ROOT / "public" / clean_url.lstrip("/")
    else:
        candidate = Path()
    candidate = candidate.resolve()
    return candidate if candidate.is_file() and (PROJECT_ROOT.resolve() in candidate.parents or OUTPUT_DIR.resolve() in candidate.parents) else None


def _resolve_view_images(view_urls):
    return {
        key: image
        for key, url in (view_urls or {}).items()
        if (image := _resolve_image(url)) is not None
    }


def _ppt_view_images(manifest):
    if not any(scene.get("model") is not None and scene.get("enabled", True) for scene in manifest.get("scenes", [])):
        return {}
    prepared = prepare_model_views(manifest)
    manifest.setdefault('model', {}).update({key: value for key, value in prepared.items() if key != 'status'})
    return _resolve_view_images(prepared['viewImageUrls'])


def prepare_model_views(manifest, check_only=False):
    if not any(scene.get('model') is not None and scene.get('enabled', True) for scene in manifest.get('scenes', [])):
        return {'status': 'not-required'}
    model = manifest.get('model') or {}
    path = _resolve_model(model.get('exportModelUrl') or model.get('modelUrl') or model.get('appearanceUrl') or model.get('glbUrl'))
    if path is None:
        raise ValueError('无法读取本课当前模型，无法自动截图。请重新连接模型后重试，已有模型不会删除。')
    return model_views.ensure_views(path, render=not check_only)


def _verify_embedded_views(output, expected):
    ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main",
          "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
    with zipfile.ZipFile(output) as archive:
        for slide_number, paths in expected.items():
            part = f"ppt/slides/slide{slide_number}.xml"
            relationships = ET.fromstring(archive.read(f"ppt/slides/_rels/slide{slide_number}.xml.rels"))
            targets = {rel.get("Id"): posixpath.normpath(posixpath.join("ppt/slides", rel.get("Target", "")))
                       for rel in relationships if rel.get("Type", "").endswith("/image") and rel.get("TargetMode") != "External"}
            hashes = set()
            for blip in ET.fromstring(archive.read(part)).findall(".//a:blip", ns):
                target = targets.get(blip.get("{" + ns["r"] + "}embed"))
                if target and target.startswith("ppt/media/"):
                    hashes.add(hashlib.sha256(archive.read(target)).hexdigest())
            if not all(hashlib.sha256(path.read_bytes()).hexdigest() in hashes for path in paths):
                raise RuntimeError(f"第 {slide_number} 页四视图未完整嵌入，已停止导出。")


def _ppt_static_copy(value):
    text = str(value or "")
    replacements = (
        ("旋转模型", "对照结构图片"),
        ("点击模型部件", "在结构图片中定位部件"),
        ("观察模型", "观察结构图片"),
        ("模型部件", "图片中的结构"),
        ("模型", "结构图片"),
        ("建模", "结构观察"),
        ("手势", "课堂操作"),
    )
    for source, target in replacements:
        text = text.replace(source, target)
    return text


def _add_picture_contain(slide, path, x, y, w, h):
    with Image.open(path) as image:
        source_ratio = image.width / max(1, image.height)
    box_ratio = w / h
    if source_ratio > box_ratio:
        draw_w, draw_h = w, w / source_ratio
        draw_x, draw_y = x, y + (h - draw_h) / 2
    else:
        draw_h, draw_w = h, h * source_ratio
        draw_x, draw_y = x + (w - draw_w) / 2, y
    return slide.shapes.add_picture(str(path), Inches(draw_x), Inches(draw_y), Inches(draw_w), Inches(draw_h))


def _add_four_view_grid(slide, view_images, x, y, w, h):
    labels = (("front", "正面"), ("left", "左侧"), ("right", "右侧"), ("back", "背面"))
    if "oblique" in view_images:
        labels = (("front", "前视图"), ("oblique", "侧/斜视图"), ("overhead", "上方俯视图"), ("top", "顶部正交视图"))
    gap = 0.12
    cell_w = (w - gap) / 2
    cell_h = (h - gap) / 2
    for index, (key, label) in enumerate(labels):
        path = view_images.get(key)
        if not path:
            continue
        column = index % 2
        row = index // 2
        cell_x = x + column * (cell_w + gap)
        cell_y = y + row * (cell_h + gap)
        _add_picture_contain(slide, path, cell_x, cell_y + .32, cell_w, cell_h - .32)
        _add_text(slide, label, cell_x + 0.08, cell_y, cell_w - 0.16, 0.24, 12, "60E1C2", True)


def offline_html(manifest):
    manifest = _chinese_copy(manifest)
    payload = json.dumps(manifest, ensure_ascii=False).replace("</", "<\\/")
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(manifest["title"])}</title><script type="module" src="vendor/model-viewer.min.js"></script><style>
.evidence{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:24px;max-width:900px}}.evidence section{{padding:14px 16px;border:1px solid rgba(111,205,201,.2);border-left:3px solid #60e1c2;background:#132125}}.evidence b{{display:block;color:#60e1c2;font-size:13px;margin-bottom:7px}}.evidence p{{margin:0;color:#dce8e4;line-height:1.55;overflow-wrap:anywhere}}@media(max-width:800px){{.evidence{{grid-template-columns:1fr}}}}
*{{box-sizing:border-box}}body{{margin:0;background:#080d10;color:#f5f0e7;font-family:SimSun,"宋体",serif;overflow:hidden}}button{{font:inherit}}.app{{height:100vh;display:grid;grid-template-columns:230px 1fr}}aside{{padding:24px 18px;background:#101719;border-right:1px solid #274146;overflow:auto}}aside h1{{font-size:17px;margin:0 0 20px}}.nav{{display:grid;gap:7px}}.nav button{{padding:11px;text-align:left;color:#9eb1b5;background:transparent;border:0;border-left:2px solid transparent}}.nav button.active{{color:#fff;border-color:#60e1c2;background:#162326}}main{{position:relative;overflow:hidden}}.scene{{position:absolute;inset:0;padding:80px 32px 120px;display:grid;align-content:start;overflow:auto;opacity:0;transform:translateY(18px);transition:.4s ease;pointer-events:none}}.scene.active{{opacity:1;transform:none;pointer-events:auto}}.kicker{{color:#60e1c2;font-size:12px;font-weight:800}}h2{{font-size:32px;overflow-wrap:anywhere;max-width:960px;margin:18px 0}}.claim{{font-size:18px;overflow-wrap:anywhere;line-height:1.55;max-width:860px;color:#d9e2df}}.task{{margin-top:32px;border-left:4px solid #ff6961;padding:14px 20px;background:#131e21;max-width:760px}}.model-layout{{grid-template-columns:minmax(320px,1fr) minmax(300px,560px);gap:36px;align-items:center}}model-viewer{{width:100%;height:62vh;background:#0d1518}}.flow{{display:flex;gap:8px;flex-wrap:wrap;margin-top:30px}}.flow span{{padding:12px 15px;background:#142327;border-bottom:3px solid #60e1c2}}.arterial{{color:#ff7b72}}.venous{{color:#71b7ff}}.controls{{position:absolute;left:260px;right:28px;bottom:22px;display:flex;justify-content:space-between;align-items:center}}.controls button{{border:1px solid #37535a;background:#132025;color:#fff;padding:10px 16px}}.progress{{color:#9eb1b5}}@media(max-width:800px){{.app{{grid-template-columns:1fr}}aside{{display:none}}.scene{{padding:24px 20px 90px}}.model-layout{{grid-template-columns:1fr}}model-viewer{{height:42vh}}.controls{{left:20px}}}}
</style></head><body><div class="app"><aside><h1>{html.escape(manifest["title"])}</h1><div class="nav" id="nav"></div></aside><main id="stage"></main></div><div class="controls"><button id="prev">上一步</button><span class="progress" id="progress"></span><button id="next">下一步</button></div><script>
const manifest={payload};let current=0;const stage=document.querySelector('#stage'),nav=document.querySelector('#nav');
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[c]));
const join=v=>Array.isArray(v)?v.filter(Boolean).join('；'):String(v||'');
const detailHtml=s=>{{const d=s.detail||{{}};const blocks=[['学习内容',d.learningContent||s.claim],['学习步骤',join(d.studentSteps)||s.studentAction],['教师追问',join(d.questioning)||s.teacherCue],['预期产出',d.visibleOutput||s.expectedOutput],['评价标准',join(d.evaluationRubric)||s.expectedOutput],['补救措施',d.remediation||'']].filter(([,v])=>String(v||'').trim()).slice(0,4);return `<div class="evidence">${{blocks.map(([label,value])=>`<section><b>${{esc(label)}}</b><p>${{esc(value)}}</p></section>`).join('')}}</div>`}};
manifest.scenes.filter(s=>s.enabled!==false).forEach((s,i)=>{{const b=document.createElement('button');b.textContent=`${{String(i+1).padStart(2,'0')}}  ${{s.title}}`;b.onclick=()=>show(i);nav.appendChild(b);const e=document.createElement('section');e.className='scene '+(s.model?'model-layout':'');let visual='';if(s.model)visual=`<model-viewer src="${{manifest.model.modelUrl==='model.glb'?'model.glb':'model.glb'}}" camera-controls auto-rotate shadow-intensity="1" exposure="1"></model-viewer>`;else if(s.type==='blood-flow')visual='<div class="flow"><span class="venous">腔静脉</span><span>右心房</span><span>右心室</span><span class="venous">肺动脉</span><span>肺</span><span class="arterial">肺静脉</span><span>左心房</span><span>左心室</span><span class="arterial">主动脉</span></div>';e.innerHTML=`<div><div class="kicker">课堂场景</div><h2>${{esc(s.title)}}</h2><p class="claim">${{esc(s.claim)}}</p><div class="task"><b>学生任务</b><br>${{esc(s.studentAction)}}<br><small>学习产出：${{esc(s.expectedOutput)}}</small></div></div>${{visual}}`;stage.appendChild(e)}});
function show(i){{const scenes=[...stage.children],buttons=[...nav.children];current=Math.max(0,Math.min(i,scenes.length-1));scenes.forEach((e,n)=>e.classList.toggle('active',n===current));buttons.forEach((e,n)=>e.classList.toggle('active',n===current));document.querySelector('#progress').textContent=`${{current+1}} / ${{scenes.length}}`;document.querySelector('#prev').disabled=current===0;document.querySelector('#next').textContent=current===scenes.length-1?'完成':'下一步'}}
document.querySelector('#prev').onclick=()=>show(current-1);document.querySelector('#next').onclick=()=>show(current+1);document.addEventListener('keydown',e=>{{if(e.key==='ArrowRight')show(current+1);if(e.key==='ArrowLeft')show(current-1)}});show(0);
manifest.scenes.filter(s=>s.enabled!==false).forEach((s,i)=>stage.children[i]?.insertAdjacentHTML('beforeend',detailHtml(s)));
</script></body></html>'''


def create_offline_zip(manifest):
    filename = f"{_safe_name(manifest.get('title'))}_interactive_{uuid.uuid4().hex[:8]}.zip"
    output = OUTPUT_DIR / filename
    model = manifest.get("model") or {}
    model_path = _resolve_model(model.get("exportModelUrl") or model.get("modelUrl", ""))
    if any(scene.get("model") is not None and scene.get("enabled", True) for scene in manifest.get("scenes", [])) and not model_path:
        raise ValueError("课件模型文件不可用，请重新连接模型后导出")
    viewer_script = PROJECT_ROOT / "node_modules" / "@google" / "model-viewer" / "dist" / "model-viewer-module.min.js"
    if not viewer_script.is_file():
        raise RuntimeError("离线运行时缺少 @google/model-viewer")
    packaged = json.loads(json.dumps(manifest, ensure_ascii=False))
    packaged["model"]["modelUrl"] = "model.glb"
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("index.html", offline_html(packaged))
        archive.writestr("courseware.json", json.dumps(packaged, ensure_ascii=False, indent=2))
        archive.write(viewer_script, "vendor/model-viewer.min.js")
        if model_path:
            archive.write(model_path, "model.glb")
        archive.writestr("start-course.cmd", "@echo off\r\npy -3 serve.py\r\nif errorlevel 1 python serve.py\r\n")
        archive.writestr("serve.py", "import http.server,webbrowser,threading\nserver=http.server.ThreadingHTTPServer(('127.0.0.1',0),http.server.SimpleHTTPRequestHandler)\nthreading.Timer(1,lambda:webbrowser.open('http://127.0.0.1:'+str(server.server_port))).start()\nserver.serve_forever()\n")
        archive.writestr("README.txt", "双击 start-course.cmd 启动离线互动课件。内容用于教学，不用于临床诊断。\n")
    return output


def _add_text(slide, value, x, y, w, h, size, color, bold=False, align=PP_ALIGN.LEFT):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = box.text_frame
    frame.clear(); frame.word_wrap = True
    frame.margin_left = frame.margin_right = frame.margin_top = frame.margin_bottom = 0
    text = _ppt_static_copy(_chinese_copy(str(value)))
    font_path = Path('C:/Windows/Fonts/simsun.ttc')
    if font_path.is_file():
        while size > 8:
            font = ImageFont.truetype(str(font_path), size * 4)
            lines = 0
            for paragraph in text.split('\n'):
                lines += 1
                line = ''
                for char in paragraph:
                    if line and font.getlength(line + char) > w * 72 * 4:
                        lines += 1
                        line = char
                    else:
                        line += char
            if lines * size * 1.5 <= h * 72:
                break
            size -= 1
    p = frame.paragraphs[0]; p.alignment = align
    p.line_spacing = 1.2
    p.space_before = p.space_after = Pt(0)
    run = p.add_run(); run.text = text; run.font.name = "宋体"; run.font.size = Pt(size); run.font.bold = bold; run.font.color.rgb = RGBColor.from_string(color)
    properties = run._r.get_or_add_rPr()
    for tag in ('a:ea', 'a:cs'):
        face = OxmlElement(tag)
        face.set('typeface', '宋体')
        properties.append(face)
    return box


def create_ppt(manifest):
    manifest = _chinese_copy(manifest)
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333333), Inches(7.5)
    bg, ink, cyan = "0A1013", "F5F0E7", "60E1C2"
    image = _resolve_image(manifest.get("model", {}).get("previewImageUrl"))
    view_images = _ppt_view_images(manifest)
    expected_views = {}
    labels = {"hook": "问题导入", "outcomes": "学习目标", "content-map": "知识结构",
              "question-chain": "问题链", "activity": "教学活动", "assessment": "学习评价",
              "model-challenge": "结构观察", "model-overview": "整体结构", "gesture-quiz": "课堂答题",
              "summary": "课堂总结", "homework": "课后任务", "blood-flow": "血流路径",
              "chambers": "心腔定位", "vessels": "血管连接", "valves": "瓣膜功能",
              "comparison": "结构对比", "case-evidence": "案例证据"}
    for scene in manifest["scenes"]:
        if not scene.get("enabled", True):
            continue
        detail = scene.get("detail") or {}
        sections = [
            ("核心结论", scene.get("claim", "")),
            ("学习内容", detail.get("learningContent", "")),
            ("本场任务", scene.get("studentAction", "")),
            ("学习步骤", _cw_join(detail.get("studentSteps") or [], "；")),
            ("预期产出", scene.get("expectedOutput", "")),
            ("评价标准", _cw_join(detail.get("evaluationRubric") or [], "；")),
        ]
        if scene.get("type") == "gesture-quiz":
            for number, question in enumerate(manifest.get("questions") or [], 1):
                if question.get("enabled", True):
                    sections.append((f"第{number}题", question.get("question", "") + "\n" +
                                     "\n".join(f"{i + 1}. {option}" for i, option in enumerate(question.get("options") or []))))
        # Web and PPT use the same ordered scene content contract.
        sections = [(block["label"], block["value"]) for block in scene_content_blocks(scene)]
        if scene.get("type") == "gesture-quiz":
            for number, question in enumerate(manifest.get("questions") or [], 1):
                if question.get("enabled", True):
                    sections.append((f"第{number}题", question.get("question", "") + "\n" + "\n".join(f"{i + 1}. {option}" for i, option in enumerate(question.get("options") or []))))
        # Keep one editable slide per enabled courseware scene.
        sections = [(block["label"], block["value"]) for block in scene_content_blocks(scene)]
        if scene.get("type") == "gesture-quiz":
            question_text = []
            for number, question in enumerate(manifest.get("questions") or [], 1):
                if question.get("enabled", True):
                    question_text.append(f"第{number}题：{question.get('question', '')}\n" + "；".join(f"{i + 1}. {option}" for i, option in enumerate(question.get("options") or [])))
            if question_text:
                sections = sections[:3] + [("练习题", "\n".join(question_text))]
        blocks = []
        seen = set()
        for label, value in sections:
            value = _ppt_static_copy(_chinese_copy(value))
            if not value or value in seen:
                continue
            seen.add(value)
            # Keep readable type by paginating long content instead of discarding it.
            for offset in range(0, len(value), 260):
                blocks.append((label if offset == 0 else label + "（续）", value[offset:offset + 260]))
        blocks = [(label, _ppt_static_copy(_chinese_copy(value))) for label, value in sections if _ppt_static_copy(_chinese_copy(value))]
        page = blocks or [("教学内容", scene.get("claim", ""))]
        for page_index in (0,):
            slide = prs.slides.add_slide(prs.slide_layouts[6])
            slide.background.fill.solid()
            slide.background.fill.fore_color.rgb = RGBColor.from_string(bg)
            _add_text(slide, "互动课程 · " + labels.get(scene["type"], "课堂学习"), .65, .25, 10, .35, 12, cyan)
            _add_text(slide, str(len(prs.slides)), 12, .25, .65, .35, 12, cyan, align=PP_ALIGN.RIGHT)
            title = _ppt_static_copy(scene["title"]) + (f"（续 {page_index}）" if page_index else "")
            _add_text(slide, title, .65, .85, 12, 1.0, 30, ink, True)
            scene_model = scene.get("model") or {}
            camera_key = "back" if scene_model.get("camera") == "posterior" else scene_model.get("camera", "free")
            scene_image = view_images.get(camera_key) or image
            show_four_views = bool(scene.get("model") is not None and len(view_images) >= 4 and page_index == 0)
            show_image = show_four_views or bool(scene.get("model") and scene_image and page_index == 0)
            if show_four_views:
                _add_four_view_grid(slide, view_images, .7, 2.0, 6.1, 4.65)
                keys = ("front", "oblique", "overhead", "top") if "oblique" in view_images else ("front", "left", "right", "back")
                expected_views[len(prs.slides)] = [view_images[key] for key in keys]
            elif show_image:
                _add_picture_contain(slide, scene_image, .7, 2.0, 4.4, 4.65)
            for block_index, (label, text) in enumerate(page):
                if show_image:
                    step = 4.8 / max(1, len(page))
                    x, y, width, height = 7.1, 1.95 + block_index * step, 5.5, step - .44
                else:
                    column = block_index % 2
                    row = block_index // 2
                    x, y, width, height = .75 + column * 6.15, 1.95 + row * 2.25, 5.65, 1.85
                _add_text(slide, label, x, y, width, .35, 15, cyan, True)
                _add_text(slide, text, x, y + .38, width, height, 16 if show_image else 18, ink)
            _add_text(slide, manifest["title"], .65, 7.0, 11.9, .25, 10, "8EA2A8")
            notes = "\n".join(f"{label}：{value}" for label, value in sections)
            notes += "\n教师提示：" + str(scene.get("teacherCue", ""))
            notes += "\n教师过程：" + _cw_join(detail.get("teacherScript") or [], "；")
            notes += "\n补救措施：" + str(detail.get("remediation") or "")
            if scene.get("model"):
                notes += "\n模型静态视角：" + (("前视、侧/斜视、上方俯视、顶部正交" if "oblique" in view_images else "正面、左侧、右侧、背面") if show_four_views else camera_key)
            slide.notes_slide.notes_text_frame.text = _ppt_static_copy(notes)
    output = OUTPUT_DIR / f"{_safe_name(manifest['title'])}_courseware_{uuid.uuid4().hex[:8]}.pptx"
    prs.save(output)
    try:
        _verify_embedded_views(output, expected_views)
    except Exception:
        output.unlink(missing_ok=True)
        raise
    scene_count = len([scene for scene in manifest.get("scenes", []) if scene.get("enabled", True)])
    slide_count = len(prs.slides)
    export_warnings = []
    for scene in manifest.get("scenes", []):
        if not scene.get("enabled", True) or not scene.get("model"):
            continue
        camera_key = "back" if scene["model"].get("camera") == "posterior" else scene["model"].get("camera", "free")
        if len(view_images) >= 4:
            continue
        if scene.get("type") == "model-overview":
            missing = [key for key in ("front", "left", "right", "back") if key not in view_images]
            if missing:
                export_warnings.append("建模整体场景缺少视角截图：" + "、".join(missing))
        elif camera_key != "free" and camera_key not in view_images:
            export_warnings.append(f"建模场景 {scene.get('id', '')} 缺少{camera_key}视角截图，已回退总预览图")
    if scene_count != slide_count:
        output.unlink(missing_ok=True)
        raise RuntimeError(f"课件与 PPT 页数不一致：课件 {scene_count} 页，PPT {slide_count} 页")
    export_result = {
        "status": "direct",
        "verified": True,
        "message": "已生成 PPTX，浏览器已开始下载",
        "sceneCount": scene_count,
        "slideCount": slide_count,
        "aligned": True,
        "modelViewCount": len(view_images),
        "warnings": export_warnings,
    }
    return output, export_result


# The original heart demonstrator is kept above for backwards compatibility
# with old manifests. New manifests are built from the approved lesson plan.
def _cw_text(value, fallback=""):
    if isinstance(value, str):
        return value.strip() or fallback
    if isinstance(value, (int, float)):
        return str(value)
    return fallback


def _cw_items(value):
    if isinstance(value, list):
        return value
    return []


def _cw_join(values, separator="；", fallback=""):
    if isinstance(values, str):
        return values.strip() or fallback
    result = []
    for value in values:
        if isinstance(value, dict):
            value = value.get("text") or value.get("name") or value.get("title") or value.get("question") or ""
        value = _cw_text(value)
        if value and value not in result:
            result.append(value)
    return separator.join(result) or fallback


def scene_content_blocks(scene):
    """Return the single ordered content contract shared by web and PPT output."""
    detail = scene.get("detail") or {}
    candidates = {
        "learningContent": ("学习内容", _cw_text(detail.get("learningContent"), scene.get("claim", ""))),
        "studentSteps": ("学习步骤", _cw_join(detail.get("studentSteps"), "；", scene.get("studentAction", ""))),
        "questioning": ("教师追问", _cw_join(detail.get("questioning"), "；", scene.get("teacherCue", ""))),
        "visibleOutput": ("预期产出", _cw_text(detail.get("visibleOutput"), scene.get("expectedOutput", ""))),
        "evaluationRubric": ("评价标准", _cw_join(detail.get("evaluationRubric"), "；", scene.get("expectedOutput", ""))),
        "remediation": ("补救措施", _cw_text(detail.get("remediation"))),
    }
    preferred = {
        "question-chain": ["learningContent", "studentSteps", "questioning", "evaluationRubric"],
        "activity": ["learningContent", "studentSteps", "visibleOutput", "evaluationRubric"],
        "assessment": ["evaluationRubric", "questioning", "remediation", "visibleOutput"],
        "homework": ["learningContent", "studentSteps", "visibleOutput", "evaluationRubric"],
        "case-evidence": ["learningContent", "studentSteps", "questioning", "evaluationRubric"],
    }.get(scene.get("type"), ["learningContent", "studentSteps", "visibleOutput", "evaluationRubric"])
    ordered = []
    for key in preferred + list(candidates):
        label, value = candidates[key]
        if value and key not in {item["key"] for item in ordered}:
            ordered.append({"key": key, "label": label, "value": value})
    return ordered[:4]


def _cw_lesson_data(plan):
    """Collect both direct lesson fields and v1/v2 workflow fields."""
    plan = plan or {}
    workflow = plan.get("designWorkflow") or {}
    merged = {}
    for step in workflow.get("steps") or []:
        data = step.get("data") or {}
        if isinstance(data, dict):
            merged.update(data)
            # Some step payloads wrap the real content one level deeper.
            for value in data.values():
                if isinstance(value, dict):
                    merged.update(value)
    result = dict(merged)
    result.update({key: value for key, value in plan.items() if value not in (None, "", [], {})})
    result["workflow"] = workflow
    result["objectives"] = result.get("selectedObjectives") or result.get("professionalOutcomes") or result.get("objectives") or workflow.get("selectedObjectives") or []
    result["activities"] = result.get("activities") or []
    if isinstance(result["activities"], dict):
        result["activities"] = result["activities"].get("activities") or []
    result["questionChain"] = result.get("questionChain") or []
    if isinstance(result["questionChain"], dict):
        result["questionChain"] = result["questionChain"].get("items") or result["questionChain"].get("questions") or []
    result["teacherActions"] = result.get("teacherActions") or []
    result["phases"] = result.get("phases") or workflow.get("phases") or []
    return result


def _cw_activity_detail(activity, index):
    activity = activity if isinstance(activity, dict) else {"name": str(activity)}
    name = _cw_text(activity.get("name") or activity.get("title"), f"Activity {index + 1}")
    student_steps = activity.get("studentSteps")
    student = _cw_text(activity.get("studentAction") or activity.get("student"), "Complete the assigned observation and explanation task.")
    if isinstance(student_steps, list):
        student = _cw_join(student_steps, "；", student)
    content = _cw_text(activity.get("learningContent") or activity.get("content"), "Connect the activity evidence to the lesson objective.")
    output = _cw_text(activity.get("visibleOutput") or activity.get("studentOutput") or activity.get("expectedOutput") or activity.get("output"), "A written conclusion or observable performance.")
    evaluation_value = activity.get("evaluationStandard") or activity.get("evaluationRubric") or activity.get("evaluation") or activity.get("check")
    if isinstance(evaluation_value, dict):
        evaluation_value = evaluation_value.get('standard') or evaluation_value.get('evidence')
    if isinstance(evaluation_value, list):
        evaluation = _cw_join([item.get("fullMark") if isinstance(item, dict) else item for item in evaluation_value], "；", "The learner states the evidence, reasoning and conclusion clearly.")
    else:
        evaluation = _cw_text(evaluation_value, "The learner states the evidence, reasoning and conclusion clearly.")
    remediation = _cw_text(activity.get("remediation") or activity.get("support"), "Revisit the key example and complete the task with a scaffold.")
    teacher_steps = activity.get("teacherScript") or activity.get("teacherProcess") or activity.get("teacherRole")
    teacher = _cw_text(activity.get("teacherAction") or activity.get("teacher"), "Model the process, ask a follow-up question and collect evidence of learning.")
    if isinstance(teacher_steps, list):
        teacher = _cw_join(teacher_steps, "；", teacher)
    else:
        teacher = _cw_text(teacher_steps, teacher)
    prompts = activity.get("teacherPrompts") or activity.get("questioning")
    follow_up = _cw_join(prompts, "；", _cw_text(activity.get("followUp") or activity.get("question"), "What evidence supports your conclusion?")) if isinstance(prompts, list) else _cw_text(prompts, _cw_text(activity.get("followUp") or activity.get("question"), "What evidence supports your conclusion?"))
    errors = _cw_join(activity.get("commonErrors") or activity.get("misconceptions") or [], "；", "Confusing a description with an explanation.")
    return name, {"learningContent": content, "teacherScript": [teacher], "studentSteps": [student], "questioning": [follow_up], "evaluationRubric": [evaluation], "remediation": remediation, "commonErrors": [errors], "materials": [_cw_text(activity.get("caseOrEvidence") or activity.get("materials"), "教材、结构图或课堂模型")], "visibleOutput": output}


def _cw_scene(index, scene_type, title, claim, cue, action, output, layout, motion="rise", detail=None, model=None):
    scene = _scene(index, scene_type, title, claim, cue, action, output, layout, motion, model)
    scene["detail"] = detail or {"learningContent": claim, "teacherScript": [cue], "studentSteps": [action], "questioning": [], "evaluationRubric": [output], "remediation": "根据评价证据补充示范、提示或再次练习。", "commonErrors": [], "materials": []}
    return _chinese_copy(scene)


def build_manifest(lesson_plan, model=None, questions=None):
    """Build a courseware storyboard from the final lesson, not a subject demo."""
    plan = lesson_plan or {}
    data = _cw_lesson_data(plan)
    request = plan.get("request") or {}
    lesson_id = str(plan.get("id") or uuid.uuid4().hex)
    title = _cw_text(plan.get("title") or request.get("topic"), "Interactive lesson")
    model = model or plan.get("modelAsset") or {}
    model_url = _cw_text(model.get("modelUrl") or model.get("appearanceUrl") or model.get("glbUrl"))
    imported_model = model.get("source") == "imported"
    has_model = bool(model_url and (imported_model or not model_url.endswith("heart-anatomy-v1.glb")))
    preview = _cw_text(model.get("previewUrl") or model.get("previewImageUrl"))
    raw_parts = model.get("parts") if isinstance(model.get("parts"), list) else []
    parts = []
    for part in raw_parts:
        if not isinstance(part, dict):
            continue
        key = _cw_text(part.get("partKey") or part.get("key"))
        if key:
            parts.append({"partKey": key, "partLabel": _cw_text(part.get("partLabel") or part.get("label"), key), "labelEn": _cw_text(part.get("labelEn"), key), "group": _cw_text(part.get("group"), "structure")})
    view_urls = model.get("viewImageUrls") if isinstance(model.get("viewImageUrls"), dict) else {}
    if imported_model:
        parts = []
    model_config = {"modelKey": _cw_text(model.get("modelKey") or request.get("topic"), "lesson-model"), "modelUrl": model_url, "modelType": _cw_text(model.get("modelType"), "glb"), "source": "imported" if imported_model else "generated", "previewImageUrl": preview, "viewImageUrls": {key: _cw_text(value) for key, value in view_urls.items() if _cw_text(value)}, "parts": parts, "defaultMode": "appearance", "observationTasks": []}
    for field in ("localModelId", "assetUrls"):
        if model.get(field):
            model_config[field] = model[field]
    for field in ('viewModelFingerprint', 'viewRenderVersion', 'viewImageSource'):
        if model.get(field):
            model_config[field] = model[field]
    if has_model:
        default_observation = "旋转、缩放并观察模型的整体结构和外观关系。" if imported_model else "旋转模型、观察结构并结合本课目标说明你的发现。"
        model_config["observationTasks"] = [_cw_text(task) for task in (model.get("observationTasks") or []) if _cw_text(task)] or [default_observation]

    objectives = _cw_items(data.get("objectives"))
    objective_text = _cw_join(objectives, "；", "Describe, apply and explain the key idea of this lesson.")
    contents = []
    for key in ("contentItems", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "keyPoints", "difficulties", "misconceptions"):
        values = data.get(key)
        if isinstance(values, dict):
            values = list(values.values())
        contents.extend(_cw_items(values))
    content_text = _cw_join(contents, "；", _cw_text(data.get("overview"), "Connect the lesson evidence, concepts and procedure."))
    chain = _cw_items(data.get("questionChain"))
    activities = _cw_items(data.get("activities"))
    phases = _cw_items(data.get("phases"))
    if not activities and phases:
        activities = phases
    scenes = []
    scenes.append(_cw_scene(1, "hook", _cw_text(data.get("coreQuestion") or data.get("introDesign") or request.get("coreQuestion"), "Start with the lesson question"), content_text, "Use the lesson question to activate prior knowledge and collect an initial prediction.", "State an initial prediction and one reason.", "Initial prediction and evidence", "cinematic-question", "fade", {"learningContent": content_text, "teacherScript": [_cw_text(data.get("introScript"), "Present the authentic question and clarify the task.")], "studentSteps": ["Make an initial prediction and explain the basis."], "questioning": ["What do you already know that can help answer this question?"], "evaluationRubric": ["Prediction includes a relevant reason."], "remediation": "Provide a visual cue and ask the learner to identify one known fact first.", "commonErrors": [_cw_text(data.get("misconceptions"), "Jumping to a conclusion without evidence.")], "materials": ["Lesson question and prior-knowledge prompt"]}))
    scenes.append(_cw_scene(2, "outcomes", "What you will be able to do", objective_text, "Make the observable outcomes and success criteria explicit before the main task.", "Restate the target in your own words and identify the evidence you will produce.", "Personal success criteria", "outcome-rail", "rise", {"learningContent": objective_text, "teacherScript": ["Link each outcome to a later activity and assessment."], "studentSteps": ["Mark the outcome that requires the most attention."], "questioning": ["What would count as convincing evidence?"], "evaluationRubric": ["Success criteria are observable and connected to an outcome."], "remediation": "Rewrite the outcome as an observable action.", "commonErrors": [], "materials": []}))
    scenes.append(_cw_scene(3, "content-map", "Content map: from concept to evidence", content_text, "Reveal the knowledge types, key points and difficult points in the order used by the lesson.", "Sort the content into facts, concepts, procedures and reasoning, then mark the difficult link.", "Annotated content map", "three-column", "reveal", {"learningContent": content_text, "teacherScript": ["Explicitly connect the key point to the difficult point and the selected outcome."], "studentSteps": ["Annotate the content map and circle the link that needs evidence."], "questioning": ["Which part is a fact, and which part requires reasoning?"], "evaluationRubric": ["Annotations distinguish content types and identify the key difficulty."], "remediation": "Use one worked example to separate description from mechanism.", "commonErrors": [_cw_join(data.get("misconceptions") if isinstance(data.get("misconceptions"), list) else [data.get("misconceptions")], "；", "Treating a label as an explanation.")], "materials": ["Lesson content analysis"]}))
    for idx, item in enumerate(chain[:4], 4):
        item = item if isinstance(item, dict) else {"question": str(item)}
        level = _cw_text(item.get("level") or item.get("stage"), "Reasoning")
        question = _cw_text(item.get("question"), "Explain the relationship using evidence.")
        follow = _cw_text(item.get("followUp") or item.get("teacherFollowUp"), "What evidence supports that answer?")
        gain = _cw_text(item.get("studentGain") or item.get("learningGain"), "A reasoned explanation connected to the lesson content.")
        scenes.append(_cw_scene(idx, "question-chain", f"{level}: {question}", gain, follow, question, gain, "question-split" if idx % 2 else "evidence-board", "focus", {"learningContent": content_text, "teacherScript": [follow], "studentSteps": [question], "questioning": [follow], "evaluationRubric": ["Answer includes a claim and evidence."], "remediation": "Return to the previous question and supply one relevant piece of evidence.", "commonErrors": [], "materials": []}))
    start = len(scenes) + 1
    model_mode = "anatomy" if parts else "appearance"
    for offset, activity in enumerate(activities[:5]):
        name, detail = _cw_activity_detail(activity, offset)
        scenes.append(_cw_scene(start + offset, "activity", name, detail["learningContent"], detail["teacherScript"][0], detail["studentSteps"][0], detail["visibleOutput"], ["step-flow", "observation-stage", "compare-duo", "task-timer"][offset % 4], "explode" if has_model and offset == 0 else "rise", detail, {"partKeys": [p["partKey"] for p in parts[:6]], "camera": "free", "mode": model_mode, "exploded": bool(parts and offset == 0), "explosionStrength": 0.0} if has_model and (model.get("parts") or offset == 0) else None))
    while len(scenes) < 10:
        idx = len(scenes) + 1
        scenes.append(_cw_scene(idx, "assessment", "Evidence check", _cw_text(data.get("assessment"), "Use the lesson criteria to check the explanation."), "Collect the visible output and give feedback against the stated criteria.", "Compare your work with the criteria and revise one part.", "Revised response with evidence", "answer-rail", "reveal", {"learningContent": content_text, "teacherScript": ["Give feedback tied to the objective, not just correctness."], "studentSteps": ["Self-check, revise and submit the response."], "questioning": ["Which criterion does your revision improve?"], "evaluationRubric": [_cw_text(data.get("assessment"), "Claim, evidence and reasoning are all present.")], "remediation": "Provide a sentence frame and one worked example.", "commonErrors": [], "materials": []}))
    if has_model:
        model_claim = "使用模型作为观察证据，完成旋转、缩放和外观关系记录。" if imported_model else "使用模型作为结构观察证据，解释结构与本课目标的关系。"
        model_question = "观察记录是否写清了模型的整体外观和相互位置。" if imported_model else "观察记录是否指出了有效结构并联系了本课目标。"
        scenes.append(_cw_scene(len(scenes) + 1, "model-challenge", "观察模型并记录发现", model_claim, "先演示旋转、缩放和复位，再让学生完成观察任务。", model_config["observationTasks"][0], "模型观察记录", "model-stage", "focus", {"learningContent": content_text, "teacherScript": ["提醒学生依据可见形态记录观察证据，不把外观模型当作医学部件清单。" if imported_model else "引导学生指出结构、关系和功能。"], "studentSteps": [model_config["observationTasks"][0]], "questioning": [model_question], "evaluationRubric": ["观察记录包含具体可见证据，并与任务要求对应。"], "remediation": "回到标准视角，逐步完成一次观察记录。", "commonErrors": [], "materials": ["互动三维模型"]}, {"partKeys": [p["partKey"] for p in parts], "camera": "free", "mode": model_mode, "exploded": False, "explosionStrength": 0.25}))
    question_count = len(scenes) + 1
    scenes.append(_cw_scene(question_count, "gesture-quiz", "Check the lesson with five warm-up questions", "Use the approved questions to check the objectives and decide what needs reteaching.", "Launch the existing gesture quiz and return to the relevant activity when an answer is incorrect.", "Complete the five questions and read the explanation after each response.", "Five-question response record", "quiz-stage", "reveal", {"learningContent": objective_text, "teacherScript": ["Use each explanation to connect the answer back to the lesson evidence."], "studentSteps": ["Answer, inspect the explanation and identify one correction if needed."], "questioning": ["Which part of the lesson supports this answer?"], "evaluationRubric": ["Answer and explanation are consistent with the approved lesson."], "remediation": "Return to the linked activity or model observation task.", "commonErrors": [], "materials": ["Approved warm-up questions"]}))
    scenes.append(_cw_scene(len(scenes) + 1, "summary", "Return to the core question", _cw_text(data.get("summaryPrompt") or data.get("overview"), objective_text), "Ask learners to answer the opening question again using the evidence collected in the lesson.", "Give a concise conclusion and name the evidence that supports it.", "Exit response", "loop-summary", "fade", {"learningContent": objective_text, "teacherScript": ["Compare the initial prediction with the final explanation."], "studentSteps": ["Write a three-sentence conclusion."], "questioning": ["What changed in your explanation and why?"], "evaluationRubric": ["Conclusion answers the question and cites relevant evidence."], "remediation": "Use the objective and content map as a writing scaffold.", "commonErrors": [], "materials": []}))
    scenes.append(_cw_scene(len(scenes) + 1, "homework", "Continue with an assessable task", _cw_text(data.get("homework"), "Submit a short application or transfer task."), "Explain the submission requirements and the evidence that will be assessed.", _cw_text(data.get("homework"), "Complete and submit the transfer task."), "A submitted transfer response", "task-timer", "rise", {"learningContent": _cw_text(data.get("homework"), "Transfer the lesson method to a new case."), "teacherScript": ["Clarify the deliverable, criteria and deadline."], "studentSteps": [_cw_text(data.get("homework"), "Complete and submit the transfer task.")], "questioning": ["How will you show the method works in a new case?"], "evaluationRubric": ["Submission contains a conclusion and supporting evidence."], "remediation": "Provide an optional scaffolded version of the task.", "commonErrors": [], "materials": []}))
    supplied_questions = questions or plan.get("warmupQuestions")
    if not supplied_questions:
        # Do not leak the legacy heart question bank into another subject.
        supplied_questions = []
        for q_index, prompt in enumerate((
            f"关于{title}，哪一项最能概括本课的核心问题？",
            f"学习{title}时，首先应观察或确认什么？",
            f"哪条证据最能支持对{title}的解释？",
            f"{title}中的结构、过程或概念与功能如何联系？",
            f"把{title}迁移到新情境时，最需要检查什么？",
        ), 1):
            supplied_questions.append({
                "id": f"{lesson_id}-warmup-{q_index}", "question": prompt,
                "options": ["核心概念与证据", "无关信息", "只看结论", "暂时无法判断"],
                "correctIndex": 0, "explanation": f"应回到教案中的目标、内容和评价证据，解释{title}。",
                "subject": _cw_text(request.get("subject"), "课程"), "category": "model-warmup",
                "modelPartKeys": [], "lessonId": lesson_id, "difficulty": "基础", "enabled": True, "source": "generated",
            })
    supplied_questions = supplied_questions[:5]
    for item in supplied_questions:
        item.setdefault("lessonId", lesson_id); item.setdefault("enabled", True); item.setdefault("source", "generated")
    references = plan.get("references") or []
    assets = []
    if has_model:
        assets.append({"id": "lesson-model", "type": "model", "url": model_url, "altText": f"{title} interactive model", "sourceType": "local-model", "license": "teaching use"})
    if preview:
        assets.append({"id": "model-preview", "type": "image", "url": preview, "altText": f"{title} structure preview", "sourceType": "generated-preview", "license": "teaching use"})
    manifest = {"version": 1, "lessonId": lesson_id, "title": title, "theme": "biomed-dark", "revision": 1, "status": "draft", "scenes": scenes, "model": model_config, "questions": supplied_questions, "assets": assets, "references": references, "lessonContext": plan}
    manifest["quality"] = quality(manifest)
    manifest["status"] = "ready" if not manifest["quality"]["blocking"] else "draft"
    return manifest


def quality(manifest):
    scenes = [scene for scene in manifest.get("scenes", []) if scene.get("enabled", True)]
    blocking, warnings = [], []
    if not 10 <= len(scenes) <= 16:
        blocking.append("课件须包含 10 至 16 个启用场景。")
    if len({scene.get("layout") for scene in scenes}) < 6:
        blocking.append("课件须使用至少六种布局。")
    if len(manifest.get("questions") or []) != 5:
        blocking.append("课件须包含五道练习题。")
    for index, scene in enumerate(scenes):
        required = ("title", "claim", "teacherCue", "studentAction", "expectedOutput")
        if not all(_cw_text(scene.get(key)) for key in required):
            blocking.append(f"第 {index + 1} 个场景缺少必要的教学内容。")
        detail = scene.get("detail") or {}
        if not _cw_text(detail.get("learningContent")) or not _cw_items(detail.get("studentSteps")):
            warnings.append(f"第 {index + 1} 个场景需要补充教学细节。")
        if index and scene.get("layout") == scenes[index - 1].get("layout"):
            warnings.append(f"第 {index + 1} 个场景与前一场景布局相同。")
    if not manifest.get("references"):
        warnings.append("教案尚未提供参考资料。")
    score = max(0, 100 - len(blocking) * 30 - len(warnings) * 3)
    return {"score": score, "blocking": blocking, "warnings": warnings, "layoutCount": len({scene.get("layout") for scene in scenes})}
