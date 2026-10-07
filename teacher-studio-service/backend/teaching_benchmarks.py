"""Public-case-derived quality rules for lesson plans and editable slide decks.

The cases below are references for interaction structure and teaching rhythm only.
No third-party source code, media, or paid courseware is bundled with the project.
"""

PUBLIC_CASES = [
    {
        "title": "小学数学黄金矿工计算练习",
        "heat": "25万",
        "pattern": "游戏目标、短回合练习、即时得分、难度与节奏反馈",
        "url": "https://www.feixianglaoshi.com/#/chat?share=1&communityContentId=F7CFF00264CE695BD8F59E422F63D4FD&featureId=20",
    },
    {
        "title": "互动课件：小学数学六年级圆柱的体积",
        "heat": "14.5万",
        "pattern": "参数操作、动态转化、公式推导、例题、分步练习与作业闭环",
        "url": "https://www.feixianglaoshi.com/#/chat?share=1&communityContentId=3C647440BC90D7CA66E82B318A8659A0&featureId=20",
    },
    {
        "title": "Unit4 Healthy Food 第一课时",
        "heat": "12.5万",
        "pattern": "真实情境、可理解输入、角色选择、口语任务、游戏检测与生活迁移",
        "url": "https://www.feixianglaoshi.com/#/chat?share=1&communityContentId=3AA74718041EF43D17DB693F6C305FE8&featureId=20",
    },
    {
        "title": "AI如何“看”世界——揭秘图像识别",
        "heat": "9.8万",
        "pattern": "参数控制、中央实验画布、实时标注、可解释反馈与探究记录",
        "url": "https://www.feixianglaoshi.com/#/chat?share=1&communityContentId=62A52751231CCE7A9704B69BE22F5B76&featureId=20",
    },
]


def benchmark_profile(request):
    subject = str(request.get("subject") or "").strip()
    stage = str(request.get("stage") or "").strip()
    lesson_type = str(request.get("lessonType") or "").strip()

    if subject in ("英语", "语文"):
        experience = {
            "mode": "roleplay-stage",
            "title": "进入真实情境",
            "actions": ["观察或聆听情境并提取关键信息", "选择角色完成一轮表达", "更换对象或条件再次迁移"],
            "feedback": "给出表达支架、准确性反馈和一次立即重试机会",
        }
    elif subject in ("数学", "物理", "化学", "生物", "科学", "信息技术", "生物医学") or stage == "本科":
        experience = {
            "mode": "control-lab",
            "title": "先预测，再操作验证",
            "actions": ["改变一个变量并先写下预测", "观察图形、模型或数据的实时变化", "用证据解释变化并说明不变条件"],
            "feedback": "操作后立即显示关键变化、对应结构或判断依据",
        }
    else:
        experience = {
            "mode": "game-challenge",
            "title": "完成一轮课堂挑战",
            "actions": ["明确目标和成功标准", "在短回合任务中作答或分类", "根据反馈修正并进入迁移任务"],
            "feedback": "每轮都有明确结果、原因提示和继续挑战入口",
        }

    return {
        "name": "飞象公开课堂案例提炼标准 v1",
        "framework": ["情境钩子", "预测或选择", "观察或操作", "概念建构", "即时反馈", "迁移应用", "回扣反思"],
        "lessonRules": [
            "每个环节必须写清学生动作、可见产出和教师反馈",
            "核心问题在导入提出，在总结页用证据重新回答",
            "讲解连续不超过一个主要环节，至少安排一次操作或角色任务",
            "练习后必须解释依据，并给学生一次修订机会",
        ],
        "slideRules": [
            "每页只承担一个教学任务，标题使用动作或问题表达",
            "每三页至少出现一次学生可执行动作",
            "抽象概念优先转换为图解、模型、参数变化或对比证据",
            "答案采用分步揭示，先保留作答空间再展示依据",
            "结尾包含真实情境迁移或可提交的课后作品",
        ],
        "qualityRules": ["interaction", "feedback", "transfer", "question-loop", "editable-visual"],
        "experience": experience,
        "sourceCases": PUBLIC_CASES,
        "note": "仅学习公开演示中的教学结构与交互节奏，不复制第三方代码、图片或课件内容。",
        "lessonType": lesson_type,
    }
