"""Responses API adapter for structured lesson and manuscript generation."""
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _env(name, fallback=""):
    if name in os.environ:
        return os.environ[name].strip()
    root = Path(__file__).resolve().parents[1]
    for path in (root / ".env", root.parent / ".env.local", root.parent / ".env"):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            key, separator, value = line.strip().partition("=")
            if separator and key.strip() == name:
                return value.strip().strip("\"'")
    return fallback


DEFAULT_BASE_URL = _env("LESSON_AI_BASE_URL", "https://yuyiling.indevs.in").rstrip("/")
DEFAULT_MODEL = _env("LESSON_AI_MODEL", "gpt-5.6-sol")
ENGINE = "responses"


def _connection_error_message(error):
    reason = error.reason if isinstance(error, URLError) else error
    if getattr(reason, "winerror", None) == 10013:
        return "AI 服务连接被当前运行环境阻止（Windows 10013），请允许开发服务访问网络后重启"
    if isinstance(reason, TimeoutError) or isinstance(error, TimeoutError):
        return "AI 服务响应超时，请稍后重试或检查接口负载"
    return "AI 服务连接失败，请检查网络及接口地址"


def _request(path, payload=None, timeout=3):
    api_key = _env("LESSON_AI_API_KEY")
    if not api_key:
        raise ValueError("请在后端 .env.local 配置 LESSON_AI_API_KEY")
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        DEFAULT_BASE_URL + path,
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json", "Authorization": f"Bearer {api_key}", "User-Agent": "ShuzhiClassroom/1.0"},
        method="POST" if data is not None else "GET",
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def status():
    configured = bool(_env("LESSON_AI_API_KEY"))
    return {
        "available": configured,
        "configured": configured,
        "serviceReachable": None,
        "engine": ENGINE,
        "model": DEFAULT_MODEL,
        "message": f"已配置 {DEFAULT_MODEL}，连接状态以生成结果为准" if configured else "请在后端 .env.local 配置 LESSON_AI_API_KEY",
    }


def _output_text(response):
    if not isinstance(response, dict):
        raise ValueError("AI 服务返回了无效响应")
    if response.get("error") or response.get("status") not in (None, "completed"):
        raise ValueError("AI 生成未完成，请重试")
    parts = []
    for item in response.get("output", []):
        if item.get("type") != "message":
            continue
        for part in item.get("content", []):
            if part.get("type") == "refusal":
                raise ValueError("AI 未能按当前要求生成内容，请调整要求")
            if part.get("type") == "output_text":
                parts.append(part.get("text", ""))
    text = "".join(parts).strip()
    if not text:
        raise ValueError("AI 服务未返回文稿内容")
    return text


def generate_json(system_prompt, user_prompt, validator=None, timeout=120, format_schema=None):
    if not status()["configured"]:
        return None, status()["message"]
    last_error = None
    prompt = user_prompt
    for attempt in range(3):
        try:
            response = _request(
                "/responses",
                {
                    "model": DEFAULT_MODEL,
                    "instructions": system_prompt + "\n只返回 JSON 对象。",
                    "input": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "store": False,
                    "reasoning": {"effort": _env("LESSON_AI_REASONING_EFFORT", "low")},
                    "text": {"format": {"type": "json_schema", "name": "lesson_content", "strict": True, "schema": format_schema} if format_schema else {"type": "json_object"}},
                },
                timeout=timeout,
            )
            raw = _output_text(response)
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw
                raw = raw.rsplit("```", 1)[0].strip()
            result = json.loads(raw)
            if not isinstance(result, dict):
                raise ValueError("AI 输出必须是 JSON 对象")
            if validator:
                error = validator(result)
                if error:
                    last_error = error
                    prompt = user_prompt + f"\n上次输出未通过校验：{error}。只返回修正后的 JSON。"
                    continue
            return result, None
        except HTTPError as exc:
            last_error = f"AI 服务请求失败（HTTP {exc.code}），请检查密钥、模型权限及接口地址"
            if exc.code < 500 and exc.code not in (408, 429):
                break
        except (URLError, TimeoutError, OSError) as exc:
            last_error = _connection_error_message(exc)
        except (ValueError, KeyError, TypeError, AttributeError) as exc:
            last_error = str(exc)
            prompt = user_prompt + f"\n上次输出失败：{last_error}。只返回合法 JSON。"
    return None, last_error or "AI 未返回有效 JSON"


def generate_lesson_content(request, scaffold, duration, activity_count):
    """Generate the topic-specific lesson content used to build the workflow."""
    current = status()
    if not current["available"]:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": current["message"]}

    source_text = str(request.get("materialText") or "").strip()[:8000]
    prompt = {
        "task": "生成一份本科课程的真实教学内容，不要套用固定器官模板",
        "course": {
            "subject": request.get("subject") or "生物医学",
            "field": request.get("field"),
            "courseName": request.get("courseName"),
            "topic": request.get("topic"),
            "duration": duration,
            "abilityLevel": request.get("abilityLevel") or "基础层",
            "priorKnowledge": request.get("prerequisites") or request.get("priorKnowledge"),
        },
        "teacherMaterial": source_text,
        "outputRules": {
            "onlyJson": True,
            "language": "简体中文",
            "noGenericPlaceholders": True,
            "noUnrelatedFacts": True,
            "activityCount": activity_count,
        },
        "output": {
            "title": "本次课标题",
            "overview": "80到140字课程概览",
            "coreQuestion": "一个需要通过结构、机制、证据或操作回答的核心问题",
            "prerequisites": ["3条具体先修基础"],
            "keyPoints": ["4条本课重点"],
            "difficulties": ["3条本课难点"],
            "contentFacts": ["4条事实性知识"],
            "contentConcepts": ["4条概念性知识"],
            "contentProcedures": ["3条程序性知识，写明动作或推理步骤"],
            "contentMetacognition": ["2条元认知知识或自检策略"],
            "misconceptions": ["3条学生可能出现的具体错误"],
            "questionChain": [{"level": "观察或理解或分析或应用或表达", "question": "问题", "followUp": "教师追问", "studentGain": "学生所得"}],
            "activities": [{"name": "活动名称", "type": "活动类型", "studentAction": "学生具体任务", "learningContent": "学习内容", "visibleOutput": "可见产出", "evaluationStandard": "量化或可检查评价标准", "remediation": "未达标补救", "caseOrEvidence": "使用的案例、材料或证据"}],
            "casePrompt": "与本课主题直接相关的教学案例或应用情境",
            "homework": "可提交、可评价的课后任务"
        }
    }

    def validate(value):
        required = ("title", "overview", "coreQuestion", "prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions", "questionChain", "activities", "casePrompt", "homework")
        if not isinstance(value, dict):
            return "顶层必须是 JSON 对象"
        if any(key not in value for key in required):
            return "缺少必需字段"
        for key in ("prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions"):
            if not isinstance(value.get(key), list) or not value[key] or any(not str(item).strip() for item in value[key]):
                return f"{key} 必须是非空文本数组"
        if not isinstance(value.get("questionChain"), list) or len(value["questionChain"]) < 3:
            return "问题链至少需要3个问题"
        if not isinstance(value.get("activities"), list) or len(value["activities"]) != activity_count:
            return f"活动数量必须为 {activity_count}"
        for item in value["questionChain"]:
            if not all(str(item.get(key) or "").strip() for key in ("level", "question", "followUp", "studentGain")):
                return "问题链字段不完整"
        for item in value["activities"]:
            if not all(str(item.get(key) or "").strip() for key in ("name", "type", "studentAction", "learningContent", "visibleOutput", "evaluationStandard", "remediation", "caseOrEvidence")):
                return "活动字段不完整"
        topic = str(request.get("topic") or "").strip()
        corpus = json.dumps(value, ensure_ascii=False)
        topic_terms = [topic[index:index + 2] for index in range(max(0, len(topic) - 1)) if topic[index:index + 2].strip()]
        if topic_terms and not any(term in corpus for term in topic_terms):
            return f"生成内容与课题“{topic}”不相关，必须围绕教师输入课题重做"
        return None

    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"}, "overview": {"type": "string"}, "coreQuestion": {"type": "string"},
            **{key: {"type": "array", "items": {"type": "string"}} for key in ("prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions")},
            "questionChain": {"type": "array", "items": {"type": "object", "properties": {key: {"type": "string"} for key in ("level", "question", "followUp", "studentGain")}, "required": ["level", "question", "followUp", "studentGain"], "additionalProperties": False}},
            "activities": {"type": "array", "items": {"type": "object", "properties": {key: {"type": "string"} for key in ("name", "type", "studentAction", "learningContent", "visibleOutput", "evaluationStandard", "remediation", "caseOrEvidence")}, "required": ["name", "type", "studentAction", "learningContent", "visibleOutput", "evaluationStandard", "remediation", "caseOrEvidence"], "additionalProperties": False}},
            "casePrompt": {"type": "string"}, "homework": {"type": "string"},
        },
        "required": ["title", "overview", "coreQuestion", "prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions", "questionChain", "activities", "casePrompt", "homework"],
        "additionalProperties": False,
    }
    result, error = generate_json(
        "你是严谨的本科教学设计师。根据教师输入生成具体课程内容。不要把心脏、肺或其他固定模板内容套到不相关课题上；不确定的医学事实应依据教师资料或用教学性表述限定。只返回符合 JSON Schema 的 JSON。",
        json.dumps(prompt, ensure_ascii=False), validator=validate, timeout=180, format_schema=schema,
    )
    if result is None:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": f"远程 AI 生成失败，模板回退：{error}"}
    return result, {"engine": "responses", "model": DEFAULT_MODEL, "message": f"已使用 {DEFAULT_MODEL} 生成课程内容"}


def enhance_lesson_language(request, lesson_context):
    current = status()
    if not current["available"]:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": current["message"]}

    source_text = str(request.get("materialText") or "").strip()[:6000]
    prompt = {
        "task": "只润色本科生物医学课堂语言，不增加未提供的医学事实",
        "topic": request.get("topic"),
        "abilityLevel": request.get("abilityLevel", "基础层"),
        "sourceMaterial": source_text,
        "groundedFacts": lesson_context,
        "output": {
            "introScript": "不超过120字，保留认知缺口",
            "studentPrediction": "不超过100字",
            "summaryPrompt": "不超过100字，回扣专业能力目标",
            "homeworkPrompt": "不超过120字，可操作、可提交",
        },
    }

    def validate(value):
        required = ("introScript", "studentPrediction", "summaryPrompt", "homeworkPrompt")
        if not isinstance(value, dict) or any(not str(value.get(key) or "").strip() for key in required):
            return "缺少必需字段"
        if any(len(str(value[key])) > 180 for key in required):
            return "字段过长"
        return None

    result, error = generate_json(
        "你是严谨的本科生物医学教师。只能改写课堂语言，不得添加诊断或治疗建议，不得伪造教材来源。",
        json.dumps(prompt, ensure_ascii=False),
        validator=validate,
    )
    if result is None:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": f"远程 AI 生成失败，模板回退：{error}"}
    return result, {"engine": "responses", "model": DEFAULT_MODEL, "message": "已使用远程 AI 增强课堂语言"}


def _json_schema_for(value):
    if isinstance(value, dict):
        return {
            "type": "object",
            "properties": {key: _json_schema_for(item) for key, item in value.items()},
            "required": list(value.keys()),
            "additionalProperties": False,
        }
    if isinstance(value, list):
        if not value:
            return {"type": "array", "items": {"type": "string"}, "maxItems": 0}
        return {"type": "array", "items": _json_schema_for(value[0])}
    if isinstance(value, bool):
        return {"type": "boolean"}
    if isinstance(value, (int, float)):
        return {"type": "number"}
    if value is None:
        return {"type": ["string", "number", "boolean", "null"]}
    return {"type": "string"}


def revise_lesson_step(request, step, instruction, context, validator=None):
    """Revise one seven-step lesson section without changing its JSON contract."""
    current = status()
    if not current["available"]:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": current["message"]}

    source_text = str(request.get("materialText") or "").strip()[:6000]
    prompt = {
        "task": "根据教师要求修改本科教案的当前步骤",
        "teacherInstruction": instruction,
        "course": {
            "stage": request.get("stage"),
            "grade": request.get("grade"),
            "subject": request.get("subject"),
            "topic": request.get("topic"),
            "duration": request.get("duration"),
            "abilityLevel": request.get("abilityLevel"),
        },
        "sourceMaterial": source_text,
        "lessonContext": context,
        "currentStep": {
            "id": step.get("id"),
            "title": step.get("title"),
            "data": step.get("data"),
        },
        "outputContract": {
            "data": "返回修改后的完整 currentStep.data；键、数组长度、ID 和数据类型必须保持不变",
            "summary": "用一句中文概括本次修改",
        },
    }
    format_schema = {
        "type": "object",
        "properties": {
            "data": _json_schema_for(step.get("data") or {}),
            "summary": {"type": "string"},
        },
        "required": ["data", "summary"],
        "additionalProperties": False,
    }
    result, error = generate_json(
        "你是严谨的本科生物医学教学设计助手。严格执行教师修改要求，只编辑当前步骤。"
        "不得改变 JSON 结构、字段名、数组长度、对象 ID 或引用关系；不得伪造教材来源、医学证据、诊断或治疗建议。"
        "教学目标必须使用可观察行为，活动必须保留学生产出、评价标准和补救措施。只返回 JSON。",
        json.dumps(prompt, ensure_ascii=False),
        validator=validator,
        timeout=180,
        format_schema=format_schema,
    )
    if result is None:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": f"AI 编辑失败：{error}"}
    return result, {"engine": "responses", "model": DEFAULT_MODEL, "message": f"已使用 {DEFAULT_MODEL} 按要求编辑当前步骤"}
