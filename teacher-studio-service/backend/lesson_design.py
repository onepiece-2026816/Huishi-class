"""Undergraduate biomedical lesson design workflow (five-step)."""
from __future__ import annotations

import copy
import json
import uuid

import biomed_curriculum
import lesson_ai_adapter


FIVE_STEP_IDS = ["objectives", "content", "reasoning-teaching", "activities-competencies", "final"]
FIVE_STEP_TITLES = ["专业能力目标与课程定位", "学习内容、重点难点与学情诊断", "问题链与教师教学行为", "教学活动、评价与通用能力", "完整教案组装与对齐审核"]
FORBIDDEN_VERBS = ("了解", "理解", "掌握", "熟悉")
DURATIONS = (40, 80, 120)
HOOK_TYPES = ("问题锚点", "案例冲突", "实物观察", "图像辨析", "数据异常", "操作挑战")


def _duration(value):
    try:
        requested = int(value or 40)
    except (TypeError, ValueError):
        requested = 40
    return min(DURATIONS, key=lambda item: abs(item - requested))


def _step(step_id, data, mode, step_ids=None, titles=None):
    ids = step_ids or FIVE_STEP_IDS
    labels = titles or FIVE_STEP_TITLES
    return {
        "id": step_id,
        "number": ids.index(step_id) + 1,
        "title": labels[ids.index(step_id)],
        "status": "ready",
        "approved": False,
        "source": "generated",
        "data": data,
        "systemData": copy.deepcopy(data),
    }


def _step_data(workflow, step_id):
    """Read a logical section from the five-step workflow."""
    by_id = {item.get("id"): item for item in workflow.get("steps", [])}
    if step_id in by_id:
        return (by_id[step_id].get("data") or {})
    if workflow.get("version") == 2:
        if step_id in ("path", "teaching"):
            return (by_id.get("reasoning-teaching", {}).get("data") or {}).get(step_id) or {}
        if step_id in ("activities", "competencies"):
            return (by_id.get("activities-competencies", {}).get("data") or {}).get(step_id) or {}
    return {}


def _logical_step_map(workflow):
    """Expose merged v2 data under the old logical IDs for shared validators."""
    result = {item.get("id"): item for item in workflow.get("steps", [])}
    if workflow.get("version") == 2:
        merged = result.get("reasoning-teaching", {}).get("data") or {}
        result["path"] = {"data": merged.get("path") or {}}
        result["teaching"] = {"data": merged.get("teaching") or {}}
        merged = result.get("activities-competencies", {}).get("data") or {}
        result["activities"] = {"data": merged.get("activities") or {}}
        result["competencies"] = {"data": merged.get("competencies") or {}}
    return result


def normalize_five_step_workflow(workflow):
    """Merge previously saved split sections into the current five-step shape."""
    normalized = copy.deepcopy(workflow or {})
    steps = normalized.get("steps") or []
    if len(steps) == 5 and normalized.get("version") == 2:
        return normalized
    by_id = {item.get("id"): item for item in steps}
    if len(steps) != 7:
        return normalized

    def merged(first_id, second_id, merged_id, number, title):
        first = copy.deepcopy(by_id.get(first_id) or {})
        second = copy.deepcopy(by_id.get(second_id) or {})
        data = {first_id: first.get("data") or {}, second_id: second.get("data") or {}}
        source = "teacher-edited" if "teacher-edited" in (first.get("source"), second.get("source")) else "generated"
        stale = first.get("status") == "stale" or second.get("status") == "stale"
        return {
            "id": merged_id, "number": number, "title": title,
            "status": "stale" if stale else "ready",
            "approved": bool(first.get("approved")) and bool(second.get("approved")) and not stale,
            "source": source, "data": data,
            "systemData": {
                first_id: first.get("systemData") or first.get("data") or {},
                second_id: second.get("systemData") or second.get("data") or {},
            },
        }

    objectives = copy.deepcopy(by_id.get("objectives") or {})
    content = copy.deepcopy(by_id.get("content") or {})
    final = copy.deepcopy(by_id.get("final") or {})
    remapped = [
        {**objectives, "id": "objectives", "number": 1, "title": FIVE_STEP_TITLES[0]},
        {**content, "id": "content", "number": 2, "title": FIVE_STEP_TITLES[1]},
        merged("path", "teaching", "reasoning-teaching", 3, FIVE_STEP_TITLES[2]),
        merged("activities", "competencies", "activities-competencies", 4, FIVE_STEP_TITLES[3]),
        {**final, "id": "final", "number": 5, "title": FIVE_STEP_TITLES[4]},
    ]
    for item in remapped:
        item.setdefault("data", {})
        item.setdefault("source", "generated")
        item.setdefault("status", "ready")
        item["approved"] = bool(item.get("approved")) and item["status"] != "stale"
    normalized.update({
        "version": 2,
        "standard": "teacher-ai-five-step-20260625",
        "steps": remapped,
        "currentStep": min(5, max(1, int(normalized.get("currentStep") or 1))),
        "staleSteps": [item["id"] for item in remapped if item["status"] == "stale"],
    })
    if any(item["status"] == "stale" for item in remapped):
        normalized["status"] = "review"
        normalized["qualityPending"] = True
    return normalized


def _objective_groups(request, base):
    topic = base["title"]
    audience = f"{request.get('field') or '生物医学'}专业学生"
    condition_structure = "在提供教材结构图、标注任务单和标准观察视角的条件下"
    condition_reasoning = "在提供结构示意、机制流程和教学案例证据的条件下"
    return [
        {
            "id": "goal-foundation",
            "name": "结构识别与规范表达",
            "classroomDirection": "以结构识别、连接关系和规范术语为主，适合基础层。",
            "levelFit": "基础层",
            "objectives": [
                {"id": "obj-f1", "audience": audience, "condition": condition_structure, "behavior": f"准确定位并标注{topic}的关键结构", "degree": "关键结构标注正确率不低于90%", "bloomLevel": "应用", "text": f"针对{audience}，{condition_structure}，能够准确定位并标注{topic}的关键结构，达到关键结构标注正确率不低于90%。"},
                {"id": "obj-f2", "audience": audience, "condition": condition_structure, "behavior": "按规定顺序说明关键结构的连接关系", "degree": "方向、术语和连接关系三项均无关键错误", "bloomLevel": "应用", "text": f"针对{audience}，{condition_structure}，能够按规定顺序说明关键结构的连接关系，达到方向、术语和连接关系三项均无关键错误。"},
            ],
        },
        {
            "id": "goal-mechanism",
            "name": "机制分析与证据判断",
            "classroomDirection": "以结构功能关系、变量变化和证据判断为主，适合进阶层。",
            "levelFit": "进阶层",
            "objectives": [
                {"id": "obj-m1", "audience": audience, "condition": condition_reasoning, "behavior": "分析结构变化对生理过程的影响", "degree": "结论包含结构、方向、机制三部分依据", "bloomLevel": "分析", "text": f"针对{audience}，{condition_reasoning}，能够分析结构变化对生理过程的影响，达到结论包含结构、方向、机制三部分依据。"},
                {"id": "obj-m2", "audience": audience, "condition": condition_reasoning, "behavior": "评价教学案例中的证据充分性", "degree": "能够区分直接证据、合理推断和待验证信息", "bloomLevel": "评价", "text": f"针对{audience}，{condition_reasoning}，能够评价教学案例中的证据充分性，达到能区分直接证据、合理推断和待验证信息。"},
            ],
        },
        {
            "id": "goal-balanced",
            "name": "结构、机制与应用整合",
            "classroomDirection": "先定位结构，再建立机制链，最后完成案例迁移，适合标准本科课堂。",
            "levelFit": "基础层/进阶层",
            "objectives": [
                {"id": "obj-b1", "audience": audience, "condition": condition_structure, "behavior": f"定位{topic}关键结构并重建结构功能关系图", "degree": "结构定位正确率不低于90%，关系箭头无方向错误", "bloomLevel": "应用", "text": f"针对{audience}，{condition_structure}，能够定位{topic}关键结构并重建结构功能关系图，达到结构定位正确率不低于90%、关系箭头无方向错误。"},
                {"id": "obj-b2", "audience": audience, "condition": condition_reasoning, "behavior": "依据结构和机制证据完成案例判断", "degree": "结论包含依据、适用条件和一项待验证信息", "bloomLevel": "分析", "text": f"针对{audience}，{condition_reasoning}，能够依据结构和机制证据完成案例判断，达到结论包含依据、适用条件和一项待验证信息。"},
            ],
        },
    ]


def _content_step(request, base, objective_ids):
    items = []
    counter = 1
    analysis = base.get("contentAnalysis") or {}
    for category in ("事实性知识", "概念性知识", "程序性知识", "元认知知识"):
        for text in analysis.get(category, []):
            subtype = ""
            if category == "程序性知识":
                subtype = "动作技能" if any(word in str(text) for word in ("操作", "标注", "观察", "旋转", "定位")) else "心智技能"
            items.append({
                "id": f"content-{counter}", "content": text, "knowledgeType": category,
                "proceduralSubtype": subtype, "worthLearning": True,
                "priority": "重点" if category in ("概念性知识", "程序性知识") else "一般",
                "studentDifficulty": "容易停留在名称记忆，不能用连接、方向或证据说明判断。" if category != "元认知知识" else "自检时只核对答案，不核对推理过程。",
                "objectiveIds": objective_ids,
            })
            counter += 1
    for item in items:
        item["whyWorthLearning"] = "该内容直接支撑本课的结构定位、机制解释或证据判断；如果只记名称，学生无法完成后续活动中的观察、推理和迁移。"
        item["teachingFocus"] = "先用可观察对象建立共同表象，再要求学生说明连接关系、方向和功能依据。"
        item["breakthroughMethod"] = "采用结构标注—机制箭头—证据复核三步支架，逐步撤去提示。"
        item["assessmentEvidence"] = "学生提交带标注的结构图、机制链或证据链，并能口头说明一处判断依据。"
    profile = [
        {"dimension": "能力基础", "description": request.get("prerequisites") or "已修基础生物学，但结构定位与机制表达尚不稳定。", "strategy": "用2分钟定位任务检查真实起点，再决定术语支架数量。"},
        {"dimension": "认知特点", "description": "空间结构和过程箭头容易分开记忆，面对角度变化时可能误判。", "strategy": "使用标准视角、连接关系和机制箭头交叉核对。"},
        {"dimension": "学习偏好", "description": "模型观察、图解重建和短时讨论比连续讲授更容易保持投入。", "strategy": "每10分钟内安排一次观察、标注、排序或解释产出。"},
        {"dimension": "特别因素", "description": request.get("learningSituation") or "学生专业经验有限，不能默认具备临床判断经验。", "strategy": "案例限定为教学情境，明确证据边界和非诊断用途。"},
    ]
    for item in profile:
        item["impactOnTeaching"] = "该维度决定教师先给多少提示、何时组织同伴互核，以及评价时优先检查哪一项证据。"
        item["diagnosticEvidence"] = "通过导入定位任务和首轮结构记录单收集证据，不以自我报告代替课堂观察。"
    return {
        "items": items,
        "learningProfile": profile,
        "likelyMisconceptions": [request.get("misconceptions") or "把结构名称、血液成分或过程方向当作分类依据。", "能够复述结论，但说不出连接关系和适用条件。"],
        "diagnosticTask": "给出一张未标注结构图，要求学生在2分钟内完成定位、连线并写出一条判断依据。",
        "scopeDecision": {"focus": "关键结构、结构功能关系、机制链和证据判断", "defer": "超出模型范围的临床细节、诊断和治疗决策"},
    }


def _path_step(base, objectives, content_ids, ability_level):
    objective_ids = [item["id"] for item in objectives]
    source = base.get("questionChain") or []
    bloom_levels = {str(item.get("bloomLevel") or "") for item in objectives}
    has_analysis = bool(bloom_levels.intersection({"分析", "评价", "创造"}))
    has_understanding = bool(bloom_levels.intersection({"记忆", "理解"}))
    if has_analysis and has_understanding:
        path_type, path_label, levels = "MIXED", "知道 → 观察 → 分析 → 应用 → 表达", ["知道", "观察", "分析", "应用", "表达"]
        reason = "目标同时跨越理解与分析层级，先激活概念，再通过结构观察进入机制分析和应用。"
    elif has_analysis:
        path_type, path_label, levels = "B", "观察 → 分析 → 应用 → 表达", ["观察", "分析", "应用", "表达"]
        reason = "目标包含分析或评价层级，使用结构观察作为证据入口，再完成分析、应用和表达。"
    else:
        path_type, path_label, levels = "A", "知道 → 理解 → 应用 → 表达", ["知道", "理解", "应用", "表达"]
        reason = "目标以概念识别和规范应用为主，先建立共同概念，再进入应用与表达。"
    questions = []
    for index, level in enumerate(levels):
        original = source[min(index, len(source) - 1)] if source else {}
        question = original.get("question") or base.get("modelPlan", {}).get("classroomQuestion") or f"怎样用证据解释{base['title']}？"
        if level == "表达":
            question = "回到导入问题：现在怎样用结构、机制和证据完整回答？"
        questions.append({
            "id": f"question-{index + 1}", "level": level, "question": question,
            "followUp": original.get("followUp") or "你的依据是什么？还缺少什么信息？",
            "studentOutcome": original.get("studentGain") or "形成可检查的结构、机制或证据产出。",
            "objectiveIds": objective_ids, "contentIds": content_ids[max(0, index - 1):index + 2] or content_ids[:2],
            "basicVariant": f"按给定步骤完成：{question}",
            "advancedVariant": f"先判断条件和可能结果，再独立完成：{question}",
        })
    return {"pathType": path_type, "pathLabel": path_label, "reason": reason, "abilityLevel": ability_level, "questions": questions}


def _teaching_step(path):
    rows = []
    procedures = [
        ("演示+提问", "按演示六步骤实施：说明观察目标→呈现媒体→介绍比例与颜色→边演示边指导观察→归纳要点→核查定位。", "图解式", "边演示边写"),
        ("讲解+提问+板书", "概念性知识采用归纳法：提供结构证据→指出共同属性→概括关系→用反例辨析→再次明确。", "线索式", "边讲边写"),
        ("组织+示范+评价", "任务说明采用PREP：给出要求→说明原因→示范一个判断→重申时间和标准；随后巡视并个别纠正。", "表格式", "先写标准后活动"),
        ("提问+板书+总结", "使用分析性与评价性问题，陈述问题后停顿3秒，听答、追问依据，再让学生修订最初答案。", "提纲式", "先讲后写"),
    ]
    for question, procedure in zip(path["questions"], procedures):
        action, detail, board_type, timing = procedure
        rows.append({
            "id": "teach-" + question["id"], "questionId": question["id"], "content": question["question"],
            "primaryActions": action.split("+"), "procedure": detail,
            "board": {"type": board_type, "timing": timing, "content": question["studentOutcome"]},
            "studentAction": question["basicVariant"] if path["abilityLevel"] == "基础层" else question["advancedVariant"],
            "organization": {"mode": "2至4人小组" if question["level"] in ("分析", "应用") else "全班+个别检查", "instruction": "先独立留下答案，再交流依据；提交时必须写出结论和证据。", "duration": 8, "standard": "每名学生都有可见产出，教师抽查时能说明判断依据。"},
            "teacherRole": "示范与核查" if question["level"] == "观察" else "追问、巡视和反馈",
            "maxContinuousExplanation": 8,
        })
    return {"rows": rows, "lectureLimit": "连续讲解默认不超过10分钟，任何单次讲解不得超过15分钟。"}


def _activity_count(duration):
    return {40: 2, 80: 4, 120: 5}[duration]


def _allocate_activity_minutes(duration, count):
    intro, summary, homework = (5, 5, 5) if duration == 40 else (5, 10, 5) if duration == 80 else (5, 10, 10)
    available = duration - intro - summary - homework
    base = available // count
    values = [base] * count
    for index in range(available - base * count):
        values[-(index + 1)] += 1
    return intro, values, summary, homework


def _activities_step(request, base, path, objective_ids, model_asset, ai_content=None):
    duration = _duration(request.get("duration"))
    count = _activity_count(duration)
    intro_minutes, minutes, summary_minutes, homework_minutes = _allocate_activity_minutes(duration, count)
    model_available = bool((model_asset or {}).get("glbUrl"))
    model_parts = [part.get("partKey") or part.get("key") for part in (model_asset or {}).get("parts", []) if isinstance(part, dict)]
    semantic_model_available = model_available and bool(model_parts) and (model_asset or {}).get("anatomyDisplayAvailable") is not False
    templates = [
        ("结构观察与先修检查", "理论学习", "按标准视角或结构图完成标注，并写出一条连接关系。", "关键结构、空间关系和规范术语。"),
        ("机制链重建", "理论学习", "用箭头重建过程，在每个转折处标注结构依据。", "结构到功能、方向到机制的转换。"),
        ("变量变化预测", "实践操作", "改变一个条件，先预测受影响环节，再用流程图核对。", "条件变化与机制结果之间的因果关系。"),
        ("教学案例证据判断", "评价活动", "分栏列出直接证据、合理推断和缺失数据，并形成小组判断。", "证据充分性、结论边界和替代解释。"),
        ("迁移解释与同伴修订", "评价活动", "独立解释新情境，依据评分标准互评并修订。", "机制迁移、自检和规范表达。"),
    ]
    activities = []
    for index in range(count):
        name, kind, action, learning = templates[index]
        ai_activity = (ai_content or {}).get("activities", [])[index] if index < len((ai_content or {}).get("activities", [])) else {}
        name = ai_activity.get("name") or name
        kind = ai_activity.get("type") or kind
        action = ai_activity.get("studentAction") or action
        learning = ai_activity.get("learningContent") or learning
        question = path["questions"][min(index, len(path["questions"]) - 1)]
        activity_id = f"activity-{index + 1}"
        activities.append({
            "id": activity_id, "name": name, "questionId": question["id"], "level": question["level"],
            "type": kind, "duration": minutes[index], "studentAction": action, "learningContent": learning,
            "visibleOutput": ai_activity.get("visibleOutput") or "提交一份可检查的标注、机制图或证据链。",
            "evaluation": {"method": "教师抽查+同伴对照", "standard": ai_activity.get("evaluationStandard") or "结构、方向、依据三项中至少两项完全正确，关键方向不得错误。", "evidence": f"evidence-{index + 1}"},
            "remediation": ai_activity.get("remediation") or "未达标者使用半成品图和关键词支架重做，再口头说明一条修订依据。",
            "caseOrEvidence": ai_activity.get("caseOrEvidence") or "教材结构图和课堂任务单",
            "teacherRole": "给出清晰指令和标准，巡视记录典型错误，在活动结束时提供针对性反馈。",
            "objectiveIds": objective_ids,
            "basicAdaptation": "提供部件清单、半成品箭头和步骤卡，按标准完成后自检。",
            "advancedAdaptation": "减少提示，增加变量变化、证据不足或替代解释任务。",
            "resourceMode": ("3d-model" if semantic_model_available else "3d-appearance") if model_available and index == 0 else "structure-diagram",
            "modelPartKeys": model_parts if semantic_model_available and index == 0 else [],
        })
    # Keep the activity record usable as a real lesson script, not only as a summary.
    # These fields are deliberately deterministic so the local template remains useful
    # when Ollama is unavailable.
    activity_detail = [
        {
            "teacherProcess": "先说明观察范围和记录格式，再示范一个部件的定位方法；巡视时优先检查方向、边界和连接关系，最后邀请一组学生用证据复述判断。",
            "studentSteps": ["独立观察并圈出候选部件", "按前后、内外或近远关系核对", "写下部件名称、连接对象和判断依据", "与同伴交换记录并修订一处"],
            "questioning": ["你凭什么确定这是该部件，而不是相邻结构？", "换一个观察角度后，哪些证据仍然成立？"],
            "organizationDetail": "先个人记录，再两人互核，最后全班抽查；每组提交一张带证据的结构记录单。",
            "evidence": "结构记录单：至少标出目标部件、连接对象、观察角度和一条证据。",
            "designRationale": "把名称记忆转成可观察、可复核的定位任务，先暴露学生把外形当作结构依据的误区。",
        },
        {
            "teacherProcess": "教师把学生的结构记录转成方向箭头，逐步追问条件、变化和结果；对错误答案只指出缺失的中间环节，不直接代答。",
            "studentSteps": ["从起点结构画出方向箭头", "在每个转折点补充结构依据", "解释条件变化会影响哪一环", "用完整句式口头讲述机制链"],
            "questioning": ["如果删去这个结构，链条在哪一步中断？", "你的结论中哪一句是观察事实，哪一句是推断？"],
            "organizationDetail": "四人小组分工为标注、查证、质疑、汇报；汇报后由另一组指出一处证据缺口。",
            "evidence": "机制链图：包含起点、至少两次结构到功能转换、结果和一处条件说明。",
            "designRationale": "用机制链连接静态结构和动态功能，避免学生只会复述术语而不能解释因果。",
        },
        {
            "teacherProcess": "教师呈现一个可控变量和两种可能结果，要求学生先预测再操作；收集预测与实际观察的差异，组织学生修改机制解释。",
            "studentSteps": ["写出改变的条件和预测结果", "在模型或流程图中定位受影响环节", "用证据比较预测与结果", "提出一个能够验证的补充问题"],
            "questioning": ["你改变的是条件、结构还是方向？", "如果结果没有出现，最需要补查哪条证据？"],
            "organizationDetail": "个人预测后小组讨论，教师用投票收集不同解释，再让学生回到模型逐项验证。",
            "evidence": "预测—证据—修订三栏单：每栏至少写一条，修订必须指向具体结构或过程。",
            "designRationale": "让学生经历预测、验证和修订，形成可迁移的机制推理，而不是只记住标准答案。",
        },
        {
            "teacherProcess": "教师提供事实、推断和待验证信息混合的材料，示范一次证据分栏；小组完成判断后，教师按标准逐项反馈并记录共性错误。",
            "studentSteps": ["给材料分为事实、推断和待验证", "用结构与机制知识解释判断", "标注结论适用的条件", "根据同伴质询补写证据"],
            "questioning": ["这条信息能直接支持你的结论吗？", "还需要什么观察或数据才能把推断变成证据？"],
            "organizationDetail": "小组先形成共识，再由不同立场的小组进行一分钟交叉质询；教师最后公布评分依据。",
            "evidence": "证据链表：事实、推断、结论、适用条件和待验证问题五项齐全。",
            "designRationale": "把专业判断的过程显性化，帮助学生建立边界意识，避免把教学案例当成真实诊断结论。",
        },
        {
            "teacherProcess": "教师给出新情境和评价量表，先让学生独立作答，再按量表互评；针对高频错误提供半成品支架，要求学生完成二次表达。",
            "studentSteps": ["独立完成新情境判断", "按结构、机制、证据三项互评", "选择一项最需要修订的内容", "提交修订版并说明修改理由"],
            "questioning": ["你的解释换到另一个情境还成立吗？", "哪一项证据最能支持或推翻你的结论？"],
            "organizationDetail": "个人作答、同伴互评、二次修订、出口表达四段完成；教师只对关键节点进行点拨。",
            "evidence": "最终出口条：一个专业结论、一条结构或机制依据、一个仍待验证的问题。",
            "designRationale": "用迁移任务检验学习是否超越课堂原例，并把反馈落实为可见的二次修订。",
        },
    ]
    for index, activity in enumerate(activities):
        detail = activity_detail[min(index, len(activity_detail) - 1)]
        activity.update(detail)
        activity["teacherPrompts"] = detail["questioning"]
        activity["studentOutput"] = detail["evidence"]
        activity["remediationPlan"] = "未达标者先使用部件清单、方向箭头和句式支架重做；教师只补充缺失证据，学生必须提交修订前后对照和一句修改理由。"
        activity["teacherScript"] = [
            f"现在完成{activity['name']}。先独立记录，再与同伴核对，最后提交带依据的结果。",
            *detail["questioning"],
            "汇报时先说结论，再指出结构或机制证据，不能只报名称。",
        ]
        activity["materials"] = ["教材对应图表", "课堂任务单", "结构图或3D模型", "评价量规"]
        activity["checkpoints"] = [
            {"time": "开始", "teacherCheck": "确认每名学生理解任务和完成标准", "studentEvidence": "写下初始判断或操作计划"},
            {"time": "中段", "teacherCheck": "抽查方向、连接和证据是否对应", "studentEvidence": "修订一处不充分的判断"},
            {"time": "结束", "teacherCheck": "按量规检查产出并记录高频错误", "studentEvidence": detail["evidence"]},
        ]
        activity["evaluationRubric"] = [
            {"criterion": "结构或步骤准确", "fullMark": "关键结构、顺序和连接均正确", "support": "能在提示下完成大部分定位"},
            {"criterion": "机制或依据完整", "fullMark": "结论后给出方向明确的结构/机制依据", "support": "能说出结论但依据仍需句式支架"},
            {"criterion": "表达与修订", "fullMark": "能回应追问并根据反馈修订", "support": "能指出一处错误并完成二次表达"},
        ]
        activity["commonErrors"] = [
            "把外观颜色或部件大小当作结构判断的唯一依据。",
            "能说出结论，但遗漏连接方向、条件或中间机制。",
            "把教学案例中的推断表述成没有条件限制的事实。",
        ]
    hook_type = "实物观察" if model_available else "图像辨析"
    if request.get("includeCase", "包含") != "不包含":
        hook_type = "案例冲突"
    intro = {
        "hookType": hook_type, "hookOptions": list(HOOK_TYPES), "duration": intro_minutes,
        "selectionReason": "该钩子能在不提前给出结论的情况下暴露学生的结构定位、过程方向或证据判断起点。",
        "inclusiveness": "核心问题覆盖本课结构、机制与证据判断，是后续活动的上位任务。",
        "advance": "在呈现结构和机制结论之前先保留学生初始判断。",
        "nonArbitrary": "从学生已有的基础生物学概念和日常分类经验出发。",
        "script": (ai_content or {}).get("coreQuestion") or (base.get("introDesign") or {}).get("script") or base.get("modelPlan", {}).get("classroomQuestion", "先写下你的判断和一条理由。"),
        "studentPrediction": (base.get("introDesign") or {}).get("studentPrediction") or "学生会暴露结构、方向或分类依据方面的混淆。",
    }
    return {
        "intro": intro, "activities": activities,
        "summary": {"duration": summary_minutes, "design": "回到导入问题，让学生用结构、机制和证据重新回答，并指出一次修订。"},
        "homework": {"duration": homework_minutes, "design": (ai_content or {}).get("homework") or base.get("homework") or "提交结构图和机制解释。", "basic": "模仿课堂范例完成一份结构机制图。", "advanced": "迁移到新情境，补充证据需求和替代解释。", "submission": "结构图/机制链 + 150字解释 + 一条可追溯参考资料", "criteria": "结构准确、方向完整、依据充分、引用可追溯"},
        "modelAvailable": model_available,
    }


def _competencies_step(activities):
    first = activities[0]
    last = activities[-1]
    return {"items": [
        {"id": "competency-1", "indicator": "交流合作", "level": "基础层/进阶层", "objective": f"在完成“{first['name']}”时，能够用规范术语向同伴说明一个判断依据并根据反馈修订。", "sourceActivityId": first["id"], "cultivation": "每人先独立标注，再向同伴说明一条连接或方向依据。", "awarenessFeedback": "学生用一句话记录自己根据同伴反馈修改了什么。"},
        {"id": "competency-2", "indicator": "问题解决", "level": "基础层/进阶层", "objective": f"在完成“{last['name']}”时，能够区分事实、推断和待验证信息并形成解决路径。", "sourceActivityId": last["id"], "cultivation": "在原有证据链活动中增加三栏记录，不另设活动。", "awarenessFeedback": "教师指出一条有效判断策略，学生完成自评。"},
    ]}


def _schedule(activities_step):
    intro = activities_step["intro"]
    result = [{
        "id": "phase-intro", "name": "导入", "time": intro["duration"],
        "teacher": f"{intro['script']} 教师先收集2至3种不同判断，暂不公布答案；板书‘初始判断—依据—待验证证据’，说明本节课最后要回到同一问题完成修订。",
        "student": "独立写下初始判断和一条理由；与同伴比较判断依据，标出自己最不确定的结构、方向或机制环节。",
        "check": "形成可在课末修订的初始答案；教师记录学生的典型误区，并将其转化为后续观察任务。",
    }]
    for item in activities_step["activities"]:
        teacher_process = item.get("teacherProcess") or item.get("teacherRole") or ""
        teacher_script = "；".join(item.get("teacherScript") or [])
        prompts = "；".join(item.get("questioning") or [])
        student_steps = "；".join(item.get("studentSteps") or [])
        rubric = "；".join(f"{row.get('criterion')}：{row.get('fullMark')}" for row in item.get("evaluationRubric") or [])
        result.append({
            "id": "phase-" + item["id"], "name": item["name"], "time": item["duration"],
            "teacher": f"{teacher_process} 授课话术：{teacher_script} 关键追问：{prompts}",
            "student": f"{item['studentAction']} 操作步骤：{student_steps} 学习重点：{item['learningContent']}",
            "check": f"可见产出：{item['visibleOutput']} 评价标准：{item['evaluation']['standard']} 评价量规：{rubric} 未达标补救：{item['remediation']}",
            "materials": item.get("materials") or [], "checkpoints": copy.deepcopy(item.get("checkpoints") or []),
        })
    result += [
        {"id": "phase-summary", "name": "总结本次课", "time": activities_step["summary"]["duration"], "teacher": activities_step["summary"]["design"] + " 逐项回扣专业能力目标、通用能力目标和课堂证据，板书保留‘结构—机制—证据—边界’四个关键词。", "student": "修订导入答案，完成结构、机制和证据三句话出口表达；说明自己修改了什么、为什么修改。", "check": "专业目标和通用能力各有一条学习证据；出口表达同时包含结论、依据和适用边界。"},
        {"id": "phase-homework", "name": "布置作业", "time": activities_step["homework"]["duration"], "teacher": "说明提交物、完成标准、引用要求和基础层/进阶层选择；提醒学生不得把教学案例结论直接当作临床诊断。", "student": activities_step["homework"]["design"] + " 提交：" + activities_step["homework"].get("submission", "结构图、机制解释和参考资料") + "；完成后按评价标准自检。", "check": "任务可提交、可核对并服务专业能力目标；评价关注结构准确、方向完整、依据充分和来源可追溯。"},
    ]
    return result


def _alignment(objectives, content, path, activities, base):
    rows = []
    for objective in objectives:
        linked_content = [item["id"] for item in content["items"] if objective["id"] in item["objectiveIds"]]
        linked_questions = [item["id"] for item in path["questions"] if objective["id"] in item["objectiveIds"]]
        linked_activities = [item["id"] for item in activities["activities"] if objective["id"] in item["objectiveIds"]]
        rows.append({"objectiveId": objective["id"], "contentIds": linked_content, "questionIds": linked_questions, "activityIds": linked_activities, "evidenceIds": [item["evaluation"]["evidence"] for item in activities["activities"] if objective["id"] in item["objectiveIds"]], "slideIds": [], "modelPartKeys": activities["activities"][0].get("modelPartKeys", []), "warmupQuestionIds": []})
    return rows


def _selected_objectives(workflow):
    objective_step = next((item for item in workflow.get("steps", []) if item.get("id") == "objectives"), {})
    objective_data = objective_step.get("data") or {}
    selected_id = workflow.get("selectedObjectiveGroupId") or objective_data.get("selectedGroupId")
    groups = objective_data.get("candidateGroups") or []
    selected_group = next((item for item in groups if item.get("id") == selected_id), None)
    if selected_group:
        workflow["selectedObjectiveGroupId"] = selected_group["id"]
        workflow["selectedObjectives"] = copy.deepcopy(selected_group.get("objectives") or [])
    return workflow.get("selectedObjectives") or []


def _remap_objective_references(workflow, selected_objectives):
    """Move generated references to the equivalent objective in a newly selected group."""
    objective_step = next((item for item in workflow.get("steps", []) if item.get("id") == "objectives"), {})
    groups = (objective_step.get("data") or {}).get("candidateGroups") or []
    selected_ids = [item.get("id") for item in selected_objectives if item.get("id")]
    if not selected_ids:
        return

    replacements = {}
    for group in groups:
        for index, objective in enumerate(group.get("objectives") or []):
            objective_id = objective.get("id")
            if objective_id and index < len(selected_ids):
                replacements[objective_id] = selected_ids[index]

    by_id = _logical_step_map(workflow)
    collections = [
        ((by_id.get("content") or {}).get("data") or {}).get("items") or [],
        ((by_id.get("path") or {}).get("data") or {}).get("questions") or [],
        ((by_id.get("activities") or {}).get("data") or {}).get("activities") or [],
    ]
    for items in collections:
        for item in items:
            if not isinstance(item.get("objectiveIds"), list):
                continue
            remapped = []
            for objective_id in item["objectiveIds"]:
                target_id = replacements.get(objective_id, objective_id)
                if target_id not in remapped:
                    remapped.append(target_id)
            item["objectiveIds"] = remapped


def _rebuild_derived(workflow):
    """Rebuild computed fields without replacing teacher-authored step content."""
    steps = workflow.get("steps") or []
    by_id = _logical_step_map(workflow)
    objectives = _selected_objectives(workflow)
    _remap_objective_references(workflow, objectives)
    activities = (by_id.get("activities") or {}).get("data") or {}
    content = (by_id.get("content") or {}).get("data") or {"items": []}
    path = (by_id.get("path") or {}).get("data") or {"questions": []}
    if activities.get("activities"):
        workflow["phases"] = _schedule(activities)
    workflow["alignmentMatrix"] = _alignment(objectives, content, path, activities, {}) if objectives and activities.get("activities") else []
    workflow["staleSteps"] = [item.get("id") for item in steps if item.get("status") == "stale"]
    workflow["qualityPending"] = False
    return workflow


def _final_lesson(base, workflow):
    by_id = _logical_step_map(workflow)
    content = (by_id.get("content") or {}).get("data", {})
    teaching = (by_id.get("teaching") or {}).get("data", {})
    activities = (by_id.get("activities") or {}).get("data", {})
    competencies = (by_id.get("competencies") or {}).get("data", {}).get("items", [])
    content_items = content.get("items") or []
    key_items = [item.get("content") for item in content_items if item.get("priority") == "重点"]
    difficult_items = [item.get("content") for item in content_items if item.get("priority") == "难点"]
    rows = teaching.get("rows") or []
    board = []
    for row in rows:
        board_item = row.get("board") or {}
        if board_item.get("content"):
            board.append(f"{board_item.get('type', '板书')}｜{board_item.get('timing', '')}｜{board_item['content']}")
    return {
        "professionalOutcomes": [item.get("text") for item in workflow.get("selectedObjectives", [])],
        "generalOutcomes": [item.get("objective") for item in competencies],
        "keyPoints": key_items or base.get("keyPoints", []),
        "difficulties": difficult_items or base.get("difficulties", []),
        "breakthroughMethods": ["通过标准视角或结构图完成定位，再用连接关系和机制箭头交叉核对。", "用可见产出、量化评价和未达标重做形成闭环。"],
        "learningPreparation": ["教师：教材依据、结构图或已校验3D模型、任务单、评价量表。", "学生：完成先修知识自检，准备记录结构、方向和证据。"],
        "sequence": copy.deepcopy(workflow.get("phases") or []),
        "activities": [{
            "id": item.get("id"), "name": item.get("name"), "duration": item.get("duration"),
            "teacherActivity": item.get("teacherRole"), "studentActivity": item.get("studentAction"),
            "studentGain": item.get("learningContent"), "visibleOutput": item.get("visibleOutput"),
            "evaluationStandard": item.get("evaluation", {}).get("standard"), "remediation": item.get("remediation"),
            "basicAdaptation": item.get("basicAdaptation"), "advancedAdaptation": item.get("advancedAdaptation"),
            "teacherScript": copy.deepcopy(item.get("teacherScript") or []),
            "studentSteps": copy.deepcopy(item.get("studentSteps") or []),
            "teacherPrompts": copy.deepcopy(item.get("teacherPrompts") or []),
            "materials": copy.deepcopy(item.get("materials") or []),
            "checkpoints": copy.deepcopy(item.get("checkpoints") or []),
            "evaluationRubric": copy.deepcopy(item.get("evaluationRubric") or []),
            "commonErrors": copy.deepcopy(item.get("commonErrors") or []),
        } for item in activities.get("activities", [])],
        "blackboardDesign": board or base.get("blackboard", []),
        "differentiation": {
            "基础层": [item.get("basicAdaptation") for item in activities.get("activities", [])],
            "进阶层": [item.get("advancedAdaptation") for item in activities.get("activities", [])],
        },
        "references": copy.deepcopy(workflow.get("groundingReferences") or base.get("references") or []),
        "generationBasis": [workflow.get("standard"), *(workflow.get("generation", {}).get("groundedSourceIds") or [])],
        "homeworkDetail": copy.deepcopy(activities.get("homework") or {}),
    }


def _slides(base, workflow):
    slides = copy.deepcopy(base.get("slides") or [])
    activities_data = _step_data(workflow, "activities")
    activities = activities_data.get("activities", [])
    model_available = activities_data.get("modelAvailable", False)
    for slide in slides:
        slide.setdefault("id", "slide-" + uuid.uuid4().hex[:8])
        slide["objectiveIds"] = [item["id"] for item in workflow["selectedObjectives"]]
        if slide.get("type") == "观察" and not model_available:
            slide["title"] = "结构图观察"
            slide["items"] = base.get("knowledgeMap", [])[:3]
            slide["purpose"] = "使用结构图完成定位与连接关系核对；当前未绑定3D模型。"
            slide["modelPartKeys"] = []
    target = {40: 14, 80: 16, 120: 19}[workflow["duration"]]
    insert_at = next((index for index, slide in enumerate(slides) if slide.get("type") == "总结"), len(slides))
    details = []
    for activity in activities:
        details.append({"id": "slide-" + activity["id"], "type": "活动", "title": activity["name"], "items": [activity["studentAction"], "学习内容：" + activity["learningContent"], "教师过程：" + activity.get("teacherProcess", ""), "操作步骤：" + "；".join(activity.get("studentSteps") or []), "关键追问：" + "；".join(activity.get("questioning") or []), "产出：" + activity["visibleOutput"], "评价：" + activity["evaluation"]["standard"], "补救：" + activity["remediation"]], "layout": "step-flow", "phaseId": "phase-" + activity["id"], "purpose": "活动、产出与评价对齐", "proof": "student-output", "visual": "任务步骤、产出区域和评价标准", "interaction": activity["studentAction"], "activityId": activity["id"], "objectiveIds": activity["objectiveIds"], "modelPartKeys": activity["modelPartKeys"]})
    # The base curriculum already owns the target page count. Enrich those
    # pages in place so detailed lesson-script content is not discarded when
    # no extra activity pages can be inserted.
    if activities:
        enrichment = {
            "观察": activities[0],
            "机制": activities[min(1, len(activities) - 1)],
            "案例": activities[-1],
            "练习": activities[-1],
        }
        for slide in slides:
            activity = enrichment.get(slide.get("type"))
            if not activity:
                continue
            slide["activityId"] = activity["id"]
            slide["activityDetail"] = {
                "teacherScript": copy.deepcopy(activity.get("teacherScript") or []),
                "studentSteps": copy.deepcopy(activity.get("studentSteps") or []),
                "teacherPrompts": copy.deepcopy(activity.get("questioning") or []),
                "evaluationRubric": copy.deepcopy(activity.get("evaluationRubric") or []),
                "commonErrors": copy.deepcopy(activity.get("commonErrors") or []),
            }
            slide["items"] = list(slide.get("items") or []) + [
                "教师步骤：" + "；".join(activity.get("teacherScript") or []),
                "学生操作：" + "；".join(activity.get("studentSteps") or []),
                "追问：" + "；".join(activity.get("questioning") or []),
                "评价：" + "；".join(rubric.get("criterion", "") + "—" + rubric.get("fullMark", "") for rubric in activity.get("evaluationRubric") or []),
            ]
    needed = max(0, target - len(slides))
    slides[insert_at:insert_at] = details[:needed]
    return slides[:target]


def validate_workflow(workflow, require_approval=False):
    blocking, warnings = [], []
    steps = workflow.get("steps") or []
    by_id = _logical_step_map(workflow)
    objectives = workflow.get("selectedObjectives") or []
    if not objectives:
        blocking.append({"code": "missing-objective-selection", "message": "必须从三组专业能力目标中选择一组"})
    for objective in objectives:
        for field in ("audience", "condition", "behavior", "degree", "bloomLevel"):
            if not str(objective.get(field) or "").strip():
                blocking.append({"code": "invalid-abcd", "message": f"目标 {objective.get('id')} 缺少 {field}"})
        if any(word in str(objective.get("behavior") or "") for word in FORBIDDEN_VERBS):
            blocking.append({"code": "hidden-verb", "message": f"目标 {objective.get('id')} 使用了不可观察动词"})
    content = (by_id.get("content") or {}).get("data", {}).get("items", [])
    if not content or any(not item.get("objectiveIds") for item in content):
        blocking.append({"code": "content-alignment", "message": "学习内容必须对应专业能力目标"})
    knowledge_types = {item.get("knowledgeType") for item in content}
    missing_types = set(("事实性知识", "概念性知识", "程序性知识", "元认知知识")) - knowledge_types
    if missing_types:
        blocking.append({"code": "knowledge-types", "message": "学习内容分析缺少：" + "、".join(sorted(missing_types))})
    profile = (by_id.get("content") or {}).get("data", {}).get("learningProfile", [])
    profile_dimensions = {item.get("dimension") for item in profile}
    missing_dimensions = set(("能力基础", "认知特点", "学习偏好", "特别因素")) - profile_dimensions
    if missing_dimensions:
        blocking.append({"code": "learner-profile", "message": "学情分析缺少：" + "、".join(sorted(missing_dimensions))})
    if any(not item.get("strategy") for item in profile):
        blocking.append({"code": "learner-strategy", "message": "每项学情分析必须给出对应教学对策"})
    content_data = (by_id.get("content") or {}).get("data", {})
    if not content_data.get("diagnosticTask"):
        blocking.append({"code": "diagnostic-task", "message": "学情分析必须包含诊断任务"})
    path_data = (by_id.get("path") or {}).get("data", {})
    if path_data.get("pathType") not in ("A", "B", "MIXED") or not path_data.get("questions"):
        blocking.append({"code": "question-path", "message": "问题链必须采用路径A、路径B或符合条件的混合路径"})
    for question in path_data.get("questions", []):
        required = (question.get("question"), question.get("followUp"), question.get("studentOutcome"), question.get("basicVariant"), question.get("advancedVariant"))
        if not all(str(value or "").strip() for value in required):
            blocking.append({"code": "question-chain-fields", "message": f"问题 {question.get('id')} 缺少追问、学生所得或分层版本"})
    teaching_rows = (by_id.get("teaching") or {}).get("data", {}).get("rows", [])
    if not teaching_rows:
        blocking.append({"code": "teacher-behavior", "message": "必须为问题链配置教师行为"})
    for row in teaching_rows:
        if int(row.get("maxContinuousExplanation") or 0) > 15:
            blocking.append({"code": "lecture-too-long", "message": f"教师行为 {row.get('id')} 连续讲解超过15分钟"})
        if not row.get("board") or not row.get("organization", {}).get("standard"):
            blocking.append({"code": "teacher-procedure", "message": f"教师行为 {row.get('id')} 缺少板书或完成标准"})
    activities = (by_id.get("activities") or {}).get("data", {}).get("activities", [])
    expected_count = _activity_count(int(workflow.get("duration") or 40))
    if len(activities) != expected_count:
        blocking.append({"code": "activity-count", "message": f"当前课时必须包含 {expected_count} 个核心活动"})
    for item in activities:
        if not item.get("visibleOutput") or not item.get("evaluation", {}).get("standard") or not item.get("remediation"):
            blocking.append({"code": "activity-closure", "message": f"活动“{item.get('name')}”缺少产出、评价标准或补救措施"})
        if not item.get("objectiveIds"):
            blocking.append({"code": "activity-objective", "message": f"活动“{item.get('name')}”没有对应专业能力目标"})
        if not item.get("evaluation", {}).get("evidence"):
            blocking.append({"code": "activity-evidence", "message": f"活动“{item.get('name')}”没有评价证据编号"})
    for objective in objectives:
        linked = [item for item in activities if objective.get("id") in item.get("objectiveIds", [])]
        if not linked:
            blocking.append({"code": "objective-activity-gap", "message": f"目标 {objective.get('id')} 没有对应学生活动"})
        elif not any(item.get("evaluation", {}).get("evidence") for item in linked):
            blocking.append({"code": "objective-evidence-gap", "message": f"目标 {objective.get('id')} 没有对应评价证据"})
    phases = workflow.get("phases") or []
    if sum(int(item.get("time") or 0) for item in phases) != int(workflow.get("duration") or 40):
        blocking.append({"code": "duration-mismatch", "message": "教学环节时间总和与课时不一致"})
    stale = [item["title"] for item in steps if item.get("status") == "stale"]
    if stale:
        blocking.append({"code": "stale-steps", "message": "以下步骤需要同步：" + "、".join(stale)})
    if require_approval:
        pending = [item["title"] for item in steps if not item.get("approved")]
        if pending:
            blocking.append({"code": "review-required", "message": "导出前请确认五步设计：" + "、".join(pending)})
    intro = (by_id.get("activities") or {}).get("data", {}).get("intro", {})
    if intro.get("hookType") not in HOOK_TYPES or not all(intro.get(field) for field in ("inclusiveness", "advance", "nonArbitrary", "script", "studentPrediction")):
        blocking.append({"code": "intro-hook", "message": "导入必须从六类钩子中选择，并说明包摄性、先行性、非任意性、话术和反应预判"})
    competencies = (by_id.get("competencies") or {}).get("data", {}).get("items", [])
    if not 1 <= len(competencies) <= 2:
        blocking.append({"code": "general-competency-count", "message": "通用能力只能选择1至2项"})
    for item in competencies:
        if not item.get("sourceActivityId") or not item.get("awarenessFeedback"):
            blocking.append({"code": "general-competency-link", "message": f"通用能力 {item.get('id')} 必须绑定专业活动和反馈方式"})
    model_context = workflow.get("modelContext") or {}
    valid_part_keys = set(model_context.get("partKeys") or [])
    for item in activities:
        part_keys = set(item.get("modelPartKeys") or [])
        if item.get("resourceMode") == "3d-model" and (not model_context.get("available") or not part_keys):
            blocking.append({"code": "invalid-model-task", "message": f"活动“{item.get('name')}”引用了不可用的3D模型任务"})
        missing_parts = part_keys - valid_part_keys
        if missing_parts:
            blocking.append({"code": "missing-model-part", "message": f"活动“{item.get('name')}”引用了不存在的模型部件：{'、'.join(sorted(missing_parts))}"})
    references = workflow.get("groundingReferences") or []
    if not references:
        blocking.append({"code": "missing-reference", "message": "本科教案必须包含可追溯的生成依据"})
    elif any(not item.get("title") or not item.get("sourceType") for item in references):
        blocking.append({"code": "invalid-reference", "message": "参考资料缺少标题或来源类型"})
    if workflow.get("generation", {}).get("engine") not in ("responses", "ollama"):
        warnings.append({"code": "template-fallback", "message": workflow.get("generation", {}).get("message") or "当前使用本地模板回退"})
    score = max(0, 100 - len(blocking) * 25 - len(warnings) * 5)
    return {"blocking": blocking, "warnings": warnings, "score": score, "valid": not blocking}


def _assemble(base, workflow):
    result = copy.deepcopy(base)
    selected = workflow["selectedObjectives"]
    activities_data = _step_data(workflow, "activities")
    competencies = _step_data(workflow, "competencies").get("items", [])
    result["professionalOutcomes"] = [item["text"] for item in selected]
    result["generalOutcomes"] = [item["objective"] for item in competencies]
    result["objectives"] = result["professionalOutcomes"]
    result["learningOutcomes"] = result["professionalOutcomes"]
    result["contentItems"] = _step_data(workflow, "content").get("items", [])
    result["learningProfile"] = _step_data(workflow, "content").get("learningProfile", [])
    result["contentAnalysisDetail"] = [
        {
            "type": item.get("knowledgeType"),
            "content": item.get("content"),
            "worthLearning": item.get("whyWorthLearning"),
            "focus": item.get("teachingFocus"),
            "breakthrough": item.get("breakthroughMethod"),
            "evidence": item.get("assessmentEvidence"),
            "difficulty": item.get("studentDifficulty"),
        }
        for item in result["contentItems"]
    ]
    result["teachingPainPoints"] = [
        "学生容易把结构名称当成学习终点，能指出部件却不能说明连接关系和功能依据。",
        "面对三维视角或过程变化时，学生容易把观察事实、合理推断和待验证信息混在一起。",
        "同一班级的先修基础差异较大，需要同时提供基础层支架和进阶层迁移任务。",
    ]
    result["designRationale"] = [
        "本课以一个可观察、可解释、可评价的专业问题贯穿全程，先保留学生初始判断，再用结构、机制和证据逐步修订。",
        "教学活动按照观察—分析—应用—表达推进，每次活动都留下可检查产出，确保教案中的目标能够被课堂证据验证。",
        "3D模型仅承担结构观察和关系核对功能；没有可用模型时使用结构图或流程图，不虚构模型观察结果。",
    ]
    result["reflectionPrompts"] = [
        "哪些学生仍停留在名称记忆？他们缺少的是结构定位、方向判断还是机制连接？",
        "哪一项活动的产出最能证明专业能力目标已经达成？是否需要调整时间或支架？",
        "学生的结论中哪些是事实、哪些是推断、哪些问题仍需证据？下一课如何衔接？",
    ]
    result["questionChain"] = _step_data(workflow, "path").get("questions", [])
    result["teacherActions"] = _step_data(workflow, "teaching").get("rows", [])
    result["activities"] = activities_data["activities"]
    result["introDesign"] = activities_data["intro"]
    result["generalCompetencies"] = competencies
    result["phases"] = workflow["phases"]
    result["homework"] = activities_data["homework"]["design"]
    result["alignmentMatrix"] = workflow["alignmentMatrix"]
    result["designWorkflow"] = workflow
    result["generation"] = workflow["generation"]
    result["finalLesson"] = _final_lesson(base, workflow)
    result["slides"] = _slides(result, workflow)
    for row in result["alignmentMatrix"]:
        row["slideIds"] = [slide["id"] for slide in result["slides"] if row["objectiveId"] in slide.get("objectiveIds", [])]
    return result


def generate_draft(request, mode="quick", model_asset=None):
    request = dict(request or {})
    request["duration"] = _duration(request.get("duration"))
    request["abilityLevel"] = request.get("abilityLevel") if request.get("abilityLevel") in ("基础层", "进阶层") else "基础层"
    base = biomed_curriculum.build_lesson(request)
    activity_count = _activity_count(request["duration"])
    ai_content, generation = lesson_ai_adapter.generate_lesson_content(request, base, request["duration"], activity_count)
    if ai_content:
        # The teacher's topic is the authoritative lesson identity. Let the
        # model write the overview and content, but never let it rename the
        # course to an unrelated title.
        base["title"] = str(request.get("topic") or ai_content.get("title") or base.get("title"))
        base["overview"] = ai_content.get("overview") or base.get("overview")
        base["casePrompt"] = ai_content.get("casePrompt") or base.get("casePrompt")
        base["homework"] = ai_content.get("homework") or base.get("homework")
        base["prerequisites"] = ai_content.get("prerequisites") or base.get("prerequisites")
        base["keyPoints"] = ai_content.get("keyPoints") or base.get("keyPoints")
        base["difficulties"] = ai_content.get("difficulties") or base.get("difficulties")
        base["objectives"] = ai_content.get("keyPoints") or base.get("objectives")
        base["learningOutcomes"] = ai_content.get("keyPoints") or base.get("learningOutcomes")
        base["contentAnalysis"] = {
            "事实性知识": ai_content.get("contentFacts") or base.get("contentAnalysis", {}).get("事实性知识", []),
            "概念性知识": ai_content.get("contentConcepts") or base.get("contentAnalysis", {}).get("概念性知识", []),
            "程序性知识": ai_content.get("contentProcedures") or base.get("contentAnalysis", {}).get("程序性知识", []),
            "元认知知识": ai_content.get("contentMetacognition") or base.get("contentAnalysis", {}).get("元认知知识", []),
        }
        base["questionChain"] = [{
            "level": item.get("level", "理解"), "question": item.get("question", ""),
            "followUp": item.get("followUp", "你的依据是什么？"), "studentGain": item.get("studentGain", "形成可检查的学习产出。"),
        } for item in ai_content.get("questionChain", [])]
        base["misconceptions"] = ai_content.get("misconceptions") or base.get("misconceptions")
    else:
        generation = {**generation, "engine": "builtin-template", "model": lesson_ai_adapter.DEFAULT_MODEL, "message": generation.get("message") or "AI 未生成有效课程内容，已使用内置模板回退"}
    groups = _objective_groups(request, base)
    requested_group = request.get("selectedObjectiveGroupId")
    selected_group = requested_group if any(item["id"] == requested_group for item in groups) else "goal-balanced"
    selected = next(item["objectives"] for item in groups if item["id"] == selected_group)
    objective_ids = [item["id"] for item in selected]
    content = _content_step(request, base, objective_ids)
    path = _path_step(base, selected, [item["id"] for item in content["items"]], request["abilityLevel"])
    teaching = _teaching_step(path)
    activities = _activities_step(request, base, path, objective_ids, model_asset or request.get("modelAsset"), ai_content)
    competencies = _competencies_step(activities["activities"])
    five_titles = FIVE_STEP_TITLES
    steps = [
        _step("objectives", {"candidateGroups": groups, "selectedGroupId": selected_group, "coursePosition": request.get("coursePosition") or "基础生物医学课程中的结构、机制与应用衔接课"}, mode, FIVE_STEP_IDS, five_titles),
        _step("content", content, mode, FIVE_STEP_IDS, five_titles),
        _step("reasoning-teaching", {"path": path, "teaching": teaching}, mode, FIVE_STEP_IDS, five_titles),
        _step("activities-competencies", {"activities": activities, "competencies": competencies}, mode, FIVE_STEP_IDS, five_titles),
        _step("final", {"structure": ["专业能力目标与通用能力目标", "重点难点及突破方法", "学习准备", "导入→活动→总结→作业", "板书设计", "能力分层", "参考资料", "PPT和3D联动关系"]}, mode, FIVE_STEP_IDS, five_titles),
    ]
    phases = _schedule(activities)
    workflow = {
        "version": 2, "standard": "teacher-ai-five-step-20260625", "mode": mode,
        "status": "review", "currentStep": 1, "duration": request["duration"], "abilityLevel": request["abilityLevel"],
        "selectedObjectiveGroupId": selected_group, "selectedObjectives": selected,
        "steps": steps, "phases": phases, "staleSteps": [], "generation": {**generation, "groundedSourceIds": [reference.get("title", "") for reference in base.get("references", [])]},
        "groundingReferences": copy.deepcopy(base.get("references") or []),
        "modelContext": {
            "available": bool((model_asset or request.get("modelAsset") or {}).get("parts")) and (model_asset or request.get("modelAsset") or {}).get("anatomyDisplayAvailable") is not False,
            "appearanceAvailable": bool((model_asset or request.get("modelAsset") or {}).get("glbUrl")),
            "partKeys": [part.get("partKey") or part.get("key") for part in (model_asset or request.get("modelAsset") or {}).get("parts", []) if isinstance(part, dict) and (part.get("partKey") or part.get("key"))],
        },
    }
    _rebuild_derived(workflow)
    workflow["quality"] = validate_workflow(workflow)
    lesson = _assemble(base, workflow)
    return {"workflow": workflow, "lessonPlan": lesson, "quality": workflow["quality"], "generation": workflow["generation"]}


def prepare_teacher_lesson(payload):
    """Turn an approved design into a readable, teacher-facing lesson manuscript."""
    plan = payload.get("lessonPlan") or {}
    request = plan.get("request") or {}
    workflow = plan.get("designWorkflow") or {}
    workflow = normalize_five_step_workflow(workflow)
    if request.get("stage") != "本科" or workflow.get("version") != 2 or len(workflow.get("steps") or []) != 5:
        raise ValueError("AI 成稿审核仅接受五步本科教案")
    quality = validate_workflow(workflow, require_approval=True)
    if workflow.get("status") != "approved" or quality.get("blocking"):
        raise ValueError("请先完成本科教案审核，再生成教师版教案")

    logical = _logical_step_map(workflow)
    content = (logical.get("content") or {}).get("data") or {}
    path = (logical.get("path") or {}).get("data") or {}
    teaching = (logical.get("teaching") or {}).get("data") or {}
    activities_data = (logical.get("activities") or {}).get("data") or {}
    activities = activities_data.get("activities") or []
    competencies = (logical.get("competencies") or {}).get("data") or {}
    objectives = workflow.get("selectedObjectives") or []
    phases = workflow.get("phases") or []
    topic = str(request.get("topic") or plan.get("title") or "").strip()
    course_name = str(request.get("courseName") or request.get("subject") or "").strip()
    if not topic or not phases or not objectives:
        raise ValueError("教案缺少课题、已确认目标或教学流程，无法生成成稿")

    reference_items = workflow.get("groundingReferences") or plan.get("references") or []
    references = []
    for item in reference_items:
        if not isinstance(item, dict) or not item.get("title"):
            continue
        label = str(item["title"])
        author = str(item.get("author") or "").strip()
        year = str(item.get("year") or "").strip()
        if author:
            label += f"，{author}"
        if year:
            label += f"，{year}"
        url = str(item.get("sourceUrl") or "").strip()
        if url:
            label += f"（{url}）"
        references.append(label)

    def public_question(item):
        return {key: item.get(key, "") for key in ("level", "question", "followUp", "studentOutcome")}

    prompt_context = {
        "teacherBackground": {
            "courseName": course_name,
            "subjectArea": request.get("field") or request.get("subject"),
            "lessonTopic": topic,
            "lessonDuration": int(workflow.get("duration") or request.get("duration") or 40),
            "learnerStartingPoint": request.get("learningSituation") or request.get("prerequisites"),
            "priorKnowledge": request.get("prerequisites") or request.get("priorKnowledge"),
            "teacherMaterial": str(request.get("materialText") or "")[:8000],
            "modelObservationAvailable": bool((workflow.get("modelContext") or {}).get("appearanceAvailable")),
            "verifiedModelParts": (workflow.get("modelContext") or {}).get("partKeys") or [],
        },
        "confirmedDesign": {
            "objectives": [{key: item.get(key, "") for key in ("audience", "condition", "behavior", "degree", "text")} for item in objectives],
            "learningContent": content.get("items") or [],
            "learnerProfile": content.get("learningProfile") or [],
            "diagnosticTask": content.get("diagnosticTask", ""),
            "questionChain": [public_question(item) for item in path.get("questions", [])],
            "teacherActions": teaching.get("rows") or [],
            "activities": activities,
            "generalCompetencies": competencies.get("items") or [],
            "schedule": [{"name": str(item.get("name") or ""), "minutes": int(item.get("time") or 0)} for item in phases],
            "homework": activities_data.get("homework") or {},
            "references": references,
        },
        "writingRequirements": [
            "把已确认的教学设计重新编写为教师拿来即可备课和上课的自然中文教案，不是字段说明、审核报告或数据清单。",
            "表单背景只用于理解课程和学生，不得照抄本科、学期、能力层次、学分、学时、专业档案等标签。课程名称、课题和总时长可按普通教案的自然方式呈现。",
            "不要出现目标编号、内容编号、活动编号、ABCD、布鲁姆层级、目标对齐矩阵、生成依据、内置模板、模板回退等系统或审核术语。",
            "目标用简洁、可观察的课堂语言表达；流程要写清教师具体怎么做、学生具体做什么、教师怎样检查理解。避免空泛的‘讲解知识、积极参与、加深理解’。",
            "医学事实只能来自教师材料或已确认学习内容；不得添加诊断、治疗建议或未经材料支持的数据。不得杜撰参考资料。",
            "流程名称、顺序、每段分钟数必须与给定课时安排一致，分钟数不得更改；各段合计必须等于本课总时长。",
            "若没有可用模型部件，不得安排学生辨认或操作不存在的模型部件；可以使用结构图或流程图。",
        ],
        "requiredOutput": {
            "overview": "用普通教师能理解的语言说明本课从什么问题出发，学生最后能做什么，约80至140字。",
            "objectives": ["与已确认目标数量相同，改写为自然、可检查的课堂目标，不要保留目标编号和分类标签。"],
            "keyPoints": ["2至4条具体教学重点"],
            "difficulties": ["1至3条学生可能遇到的具体难点"],
            "teacherPreparation": ["课前需要准备的具体材料或设备"],
            "studentPreparation": ["学生课前需要完成的具体准备"],
            "process": [{"name": "必须与安排中的环节名称一致", "minutes": 0, "teacherActivity": "教师可直接照着实施的具体步骤", "studentActivity": "学生要完成的具体动作或产出", "question": "教师在本环节提出的关键问题", "check": "教师现场如何判断学生是否做到"}],
            "homework": ["可完成、可提交的课后任务及要求"],
            "blackboardDesign": ["适合课堂板书的短语或关系式，按出现顺序排列"]
        }
    }

    expected_process = prompt_context["confirmedDesign"]["schedule"]
    forbidden_output = ["内置基础医学教学模板", "模板回退", "目标对齐矩阵", "生成依据", "布鲁姆层级", "本科生物医学", "基础层", "进阶层", "ABCD"]
    for key in ("semester", "courseType", "abilityLevel"):
        value = str(request.get(key) or "").strip()
        if value:
            forbidden_output.append(value)

    def validate(value):
        required = ("overview", "objectives", "keyPoints", "difficulties", "teacherPreparation", "studentPreparation", "process", "homework", "blackboardDesign")
        if not isinstance(value, dict) or any(key not in value for key in required):
            return "教师版教案缺少必需部分"
        for key in ("overview",):
            if not isinstance(value.get(key), str) or len(value[key].strip()) < 35:
                return "课程说明过短或缺失"
        for key in ("objectives", "keyPoints", "difficulties", "teacherPreparation", "studentPreparation", "homework", "blackboardDesign"):
            if not isinstance(value.get(key), list) or not value[key] or any(not isinstance(item, str) or not item.strip() for item in value[key]):
                return f"{key} 必须是非空文本数组"
        if len(value["objectives"]) != len(objectives):
            return "目标数量必须与教师已确认的目标一致"
        if not 2 <= len(value["keyPoints"]) <= 4 or not 1 <= len(value["difficulties"]) <= 3:
            return "教学重点或难点数量不符合要求"
        generated_process = value.get("process")
        if not isinstance(generated_process, list) or len(generated_process) != len(expected_process):
            return "教学流程环节数量必须与已确认课时安排一致"
        for generated, expected in zip(generated_process, expected_process):
            if str(generated.get("name") or "").strip() != expected["name"] or int(generated.get("minutes") or 0) != expected["minutes"]:
                return "教学流程名称、顺序或分钟数与已确认安排不一致"
            if any(not str(generated.get(key) or "").strip() for key in ("teacherActivity", "studentActivity", "question", "check")):
                return "每个教学环节都必须写清教师活动、学生活动、关键问题和检查方式"
        texts = json.dumps(value, ensure_ascii=False)
        if any(term in texts for term in forbidden_output) or __import__("re").search(r"\b(?:obj|content|activity|question)-[a-z0-9-]+\b", texts, __import__("re").I):
            return "输出包含不应出现在教师教案中的系统字段或编号"
        if topic not in texts:
            return "生成内容没有围绕教师填写的课题"
        return None

    schema = {
        "type": "object",
        "properties": {
            "overview": {"type": "string"},
            "objectives": {"type": "array", "items": {"type": "string"}},
            "keyPoints": {"type": "array", "items": {"type": "string"}},
            "difficulties": {"type": "array", "items": {"type": "string"}},
            "teacherPreparation": {"type": "array", "items": {"type": "string"}},
            "studentPreparation": {"type": "array", "items": {"type": "string"}},
            "process": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "minutes": {"type": "integer"}, "teacherActivity": {"type": "string"}, "studentActivity": {"type": "string"}, "question": {"type": "string"}, "check": {"type": "string"}}, "required": ["name", "minutes", "teacherActivity", "studentActivity", "question", "check"], "additionalProperties": False}},
            "homework": {"type": "array", "items": {"type": "string"}},
            "blackboardDesign": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["overview", "objectives", "keyPoints", "difficulties", "teacherPreparation", "studentPreparation", "process", "homework", "blackboardDesign"],
        "additionalProperties": False,
    }
    generated, error = lesson_ai_adapter.generate_json(
        "你是一位经验丰富、表达朴实清楚的本科任课教师。请把审核通过的设计整理成普通教师一看就能照着上的教案。只输出符合结构的 JSON。不要输出说明、编号或后台设计术语。",
        json.dumps(prompt_context, ensure_ascii=False),
        validator=validate,
        timeout=240,
        format_schema=schema,
    )
    if generated is None:
        return {"draft": None, "generation": {"engine": "unavailable", "message": f"AI 教案成稿失败：{error or '未返回有效内容'}"}, "quality": {"valid": False, "blocking": [error or "AI 未返回有效教案"]}}

    draft = {
        "title": topic,
        "courseName": course_name,
        "duration": int(workflow.get("duration") or 40),
        **generated,
        "references": references,
    }
    return {
        "draft": draft,
        "generation": {"engine": "responses", "model": lesson_ai_adapter.DEFAULT_MODEL, "message": "AI 教案成稿已完成"},
        "quality": {"valid": True, "blocking": [], "checks": ["内容结构完整", "教学流程与课时一致", "活动包含教师指导、学生任务和检查方式", "未包含后台编号及模板话术"]},
    }


def generate_step(payload):
    existing_payload = normalize_five_step_workflow(payload.get("workflow") or {})
    step_number = max(1, min(5, int(payload.get("step") or 1)))
    request = dict(payload.get("request") or {})
    request["selectedObjectiveGroupId"] = (payload.get("workflow") or {}).get("selectedObjectiveGroupId")
    fresh = generate_draft(request, payload.get("mode") or "guided", payload.get("model"))
    existing = existing_payload
    if not existing.get("steps"):
        fresh["workflow"]["currentStep"] = step_number
        return fresh
    replacement = fresh["workflow"]["steps"][step_number - 1]
    existing["steps"][step_number - 1] = replacement
    for index in range(step_number, len(existing["steps"])):
        existing["steps"][index]["status"] = "stale"
        existing["steps"][index]["approved"] = False
    existing["currentStep"] = step_number
    if step_number == 1:
        existing["selectedObjectiveGroupId"] = replacement["data"].get("selectedGroupId")
    existing["generation"] = fresh["generation"]
    existing["groundingReferences"] = fresh["workflow"].get("groundingReferences", [])
    existing["modelContext"] = fresh["workflow"].get("modelContext", {})
    _rebuild_derived(existing)
    existing["quality"] = validate_workflow(existing)
    base = biomed_curriculum.build_lesson(payload.get("request") or {})
    return {"workflow": existing, "lessonPlan": _assemble(base, existing), "quality": existing["quality"], "generation": existing.get("generation", fresh["generation"])}


def _validate_revised_contract(original, revised, path="data"):
    if isinstance(original, dict):
        if not isinstance(revised, dict):
            return f"{path} 必须是对象"
        if set(revised) != set(original):
            missing = sorted(set(original) - set(revised))
            extra = sorted(set(revised) - set(original))
            return f"{path} 字段不一致，缺少 {missing}，新增 {extra}"
        for key, value in original.items():
            error = _validate_revised_contract(value, revised[key], f"{path}.{key}")
            if error:
                return error
        return None
    if isinstance(original, list):
        if not isinstance(revised, list) or len(revised) != len(original):
            return f"{path} 数组长度必须保持为 {len(original)}"
        for index, value in enumerate(original):
            error = _validate_revised_contract(value, revised[index], f"{path}[{index}]")
            if error:
                return error
        return None
    if isinstance(original, bool):
        return None if isinstance(revised, bool) else f"{path} 必须是布尔值"
    if isinstance(original, (int, float)) and not isinstance(original, bool):
        return None if isinstance(revised, (int, float)) and not isinstance(revised, bool) else f"{path} 必须是数字"
    if original is None:
        return None if revised is None or isinstance(revised, (str, int, float, bool)) else f"{path} 类型不合法"
    if not isinstance(revised, str):
        return f"{path} 必须是文本"
    leaf = path.rsplit(".", 1)[-1]
    if leaf in {"id", "objectiveId", "contentId", "activityId", "sourceActivityId", "partKey"} and revised != original:
        return f"{path} 是引用标识，不能修改"
    return None


def edit_step(payload):
    workflow = normalize_five_step_workflow(payload.get("workflow") or {})
    request = dict(payload.get("request") or {})
    instruction = str(payload.get("instruction") or "").strip()
    step_number = max(1, min(len(workflow.get("steps") or []) or 5, int(payload.get("step") or workflow.get("currentStep") or 1)))
    if not workflow.get("steps") or len(workflow["steps"]) < step_number:
        raise ValueError("教案工作流不存在，请先生成教案")
    if not instruction:
        raise ValueError("请输入具体的教案修改要求")
    if len(instruction) > 1000:
        raise ValueError("修改要求不能超过 1000 字")

    step = workflow["steps"][step_number - 1]
    original_data = copy.deepcopy(step.get("data") or {})

    def validate(value):
        if not isinstance(value, dict) or not isinstance(value.get("data"), dict):
            return "缺少完整的 data 对象"
        return _validate_revised_contract(original_data, value["data"])

    context = {
        "selectedObjectives": workflow.get("selectedObjectives") or [],
        "previousSteps": [
            {"id": item.get("id"), "title": item.get("title"), "data": item.get("data")}
            for item in workflow.get("steps", [])[:step_number - 1]
        ],
        "modelContext": workflow.get("modelContext") or {},
        "references": workflow.get("groundingReferences") or [],
    }
    revised, generation = lesson_ai_adapter.revise_lesson_step(
        request,
        step,
        instruction,
        context,
        validator=validate,
    )
    if revised is None:
        raise RuntimeError(generation.get("message") or "AI 未能完成教案编辑")

    step["data"] = revised["data"]
    step["source"] = "teacher-edited"
    step["approved"] = False
    step["status"] = "ready"
    for downstream in workflow["steps"][step_number:]:
        downstream["status"] = "stale"
        downstream["approved"] = False
    if step.get("id") == "objectives":
        selected_group_id = step["data"].get("selectedGroupId") or workflow.get("selectedObjectiveGroupId")
        selected_group = next(
            (item for item in step["data"].get("candidateGroups", []) if item.get("id") == selected_group_id),
            None,
        )
        if selected_group:
            workflow["selectedObjectiveGroupId"] = selected_group_id
            workflow["selectedObjectives"] = copy.deepcopy(selected_group.get("objectives") or [])
    workflow["currentStep"] = step_number
    workflow["status"] = "review"
    workflow["qualityPending"] = True
    workflow["generation"] = {**generation, "groundedSourceIds": workflow.get("generation", {}).get("groundedSourceIds", [])}
    _rebuild_derived(workflow)
    workflow["quality"] = validate_workflow(workflow)
    base = biomed_curriculum.build_lesson(request)
    return {
        "workflow": workflow,
        "lessonPlan": _assemble(base, workflow),
        "quality": workflow["quality"],
        "generation": workflow["generation"],
        "editSummary": str(revised.get("summary") or "已按教师要求修改当前步骤"),
    }


def sync_downstream(payload):
    existing = normalize_five_step_workflow(payload.get("workflow") or {})
    request = dict(payload.get("request") or {})
    request["selectedObjectiveGroupId"] = existing.get("selectedObjectiveGroupId")
    fresh = generate_draft(request, payload.get("mode") or "quick", payload.get("model"))
    preserved, conflicts = [], []
    old_by_id = {item.get("id"): item for item in existing.get("steps", [])}
    for index, step in enumerate(fresh["workflow"]["steps"]):
        old = old_by_id.get(step["id"])
        if old and old.get("source") == "teacher-edited":
            fresh["workflow"]["steps"][index] = copy.deepcopy(old)
            preserved.append(step["id"])
            if old.get("status") == "stale":
                fresh["workflow"]["steps"][index]["approved"] = False
                conflicts.append({"stepId": step["id"], "message": "已保留教师编辑内容，请核对新的上游依据并人工确认"})
    _rebuild_derived(fresh["workflow"])
    fresh["workflow"]["quality"] = validate_workflow(fresh["workflow"])
    base = biomed_curriculum.build_lesson(payload.get("request") or {})
    lesson = _assemble(base, fresh["workflow"])
    return {**fresh, "lessonPlan": lesson, "preservedSteps": preserved, "conflicts": conflicts}


def validate_payload(payload):
    workflow = normalize_five_step_workflow(payload.get("workflow") or {})
    require_approval = bool(payload.get("forExport"))
    approve_all = bool(payload.get("approveAll"))
    if workflow.get("steps"):
        _rebuild_derived(workflow)
    base_quality = validate_workflow(workflow, require_approval=False)
    if approve_all and not base_quality["blocking"]:
        for step in workflow["steps"]:
            step["approved"] = True
            step["status"] = "ready"
        workflow["staleSteps"] = []
        workflow["status"] = "approved"
        workflow["qualityPending"] = False
    elif approve_all:
        workflow["status"] = "review"
        workflow["qualityPending"] = False
    workflow["quality"] = validate_workflow(workflow, require_approval=require_approval)
    if workflow.get("steps"):
        base = biomed_curriculum.build_lesson(payload.get("request") or {})
        lesson = _assemble(base, workflow)
    else:
        lesson = None
    return {"workflow": workflow, "lessonPlan": lesson, "quality": workflow["quality"], "generation": workflow.get("generation", {"engine": "builtin-template"})}


def validate_lesson(plan, require_approval=True):
    workflow = normalize_five_step_workflow(plan.get("designWorkflow") or {})
    if not workflow:
        return {"blocking": [], "warnings": [{"code": "legacy-plan", "message": "旧版教案未包含五步设计工作流"}], "score": 95, "valid": True}
    return validate_workflow(workflow, require_approval=require_approval)


def reconcile_model_capabilities(plan, model_asset=None):
    """Remove stale semantic-part references when only an SF3D appearance mesh is available."""
    normalized = copy.deepcopy(plan or {})
    model = model_asset if isinstance(model_asset, dict) else normalized.get("modelAsset") or {}
    part_keys = [
        part.get("partKey") or part.get("key")
        for part in model.get("parts", [])
        if isinstance(part, dict) and (part.get("partKey") or part.get("key"))
    ]
    appearance_available = bool(model.get("appearanceUrl") or model.get("glbUrl") or model.get("modelUrl"))
    semantic_available = bool(part_keys) and model.get("anatomyDisplayAvailable") is not False
    workflow = normalized.get("designWorkflow")
    if not isinstance(workflow, dict) or not workflow.get("steps"):
        return normalized

    workflow = normalize_five_step_workflow(workflow)
    workflow["modelContext"] = {
        "available": semantic_available,
        "appearanceAvailable": appearance_available,
        "partKeys": part_keys if semantic_available else [],
    }
    activities_step = next((step for step in workflow["steps"] if step.get("id") in ("activities", "activities-competencies")), None)
    activities_data = _step_data(workflow, "activities")
    activities = activities_data.get("activities") or []
    if not semantic_available:
        for activity in activities:
            if activity.get("resourceMode") == "3d-model" or activity.get("modelPartKeys"):
                activity["resourceMode"] = "3d-appearance" if appearance_available else "structure-diagram"
                activity["modelPartKeys"] = []
        if activities_step:
            if activities_step.get("id") == "activities-competencies":
                activities_step["data"].setdefault("activities", {})["modelAvailable"] = appearance_available
            else:
                activities_step["data"]["modelAvailable"] = appearance_available

    _rebuild_derived(workflow)
    workflow["quality"] = validate_workflow(workflow, require_approval=workflow.get("status") == "approved")
    normalized["designWorkflow"] = workflow
    normalized["alignmentMatrix"] = copy.deepcopy(workflow.get("alignmentMatrix") or [])
    normalized["activities"] = copy.deepcopy(activities)
    for slide in normalized.get("slides") or []:
        if not semantic_available:
            slide["modelPartKeys"] = []
    if isinstance(normalized.get("modelAsset"), dict) and not semantic_available:
        normalized["modelAsset"]["parts"] = []
        normalized["modelAsset"]["anatomyDisplayAvailable"] = False
    return normalized
