import copy
import unittest
from unittest.mock import patch

import courseware
import lesson_design
import server


FALLBACK = (None, {
    "engine": "builtin-template",
    "model": "gpt-5.6-sol",
    "message": "测试环境使用本地模板回退",
})


class LessonDesignWorkflowTests(unittest.TestCase):
    def generate(self, topic, duration, model_key, level="基础层", model=None):
        request = {
            "stage": "本科",
            "subject": "生物医学",
            "topic": topic,
            "duration": duration,
            "abilityLevel": level,
            "modelKey": model_key,
        }
        with patch("lesson_design.lesson_ai_adapter.generate_lesson_content", return_value=(None, FALLBACK[1])):
            return lesson_design.generate_draft(request, "quick", model)

    def data(self, workflow, step_id):
        return lesson_design._step_data(workflow, step_id)

    def test_duration_activity_and_slide_targets(self):
        cases = [
            ("心脏血流与心脏结构", 40, "heart", 2, 14),
            ("肺泡气体交换", 80, "lung", 4, 16),
            ("肾单位与尿液形成", 120, "kidney", 5, 19),
        ]
        for topic, duration, model_key, activity_count, slide_count in cases:
            with self.subTest(topic=topic):
                result = self.generate(topic, duration, model_key)
                workflow = result["workflow"]
                self.assertEqual(sum(item["time"] for item in workflow["phases"]), duration)
                self.assertEqual(len(self.data(workflow, "activities")["activities"]), activity_count)
                self.assertEqual(len(result["lessonPlan"]["slides"]), slide_count)
                self.assertEqual(result["quality"]["blocking"], [])

    def test_switching_objective_group_remaps_downstream_references(self):
        result = self.generate("心脏血流与心脏结构", 40, "heart")
        workflow = copy.deepcopy(result["workflow"])
        groups = workflow["steps"][0]["data"]["candidateGroups"]
        foundation = next(item for item in groups if item["id"] == "goal-foundation")
        workflow["selectedObjectiveGroupId"] = foundation["id"]
        workflow["selectedObjectives"] = copy.deepcopy(foundation["objectives"])
        workflow["steps"][0]["data"]["selectedGroupId"] = foundation["id"]

        validated = lesson_design.validate_payload({"workflow": workflow, "request": result["lessonPlan"]["request"]})

        blocking_codes = [item["code"] for item in validated["quality"]["blocking"]]
        self.assertNotIn("objective-activity-gap", blocking_codes)
        self.assertNotIn("objective-evidence-gap", blocking_codes)
        expected = {"obj-f1", "obj-f2"}
        activities = self.data(validated["workflow"], "activities")["activities"]
        self.assertTrue(all(set(item["objectiveIds"]) == expected for item in activities))

    def test_cell_without_model_uses_diagrams(self):
        result = self.generate("细胞器结构与功能", 40, "cell")
        activities = self.data(result["workflow"], "activities")
        self.assertFalse(activities["modelAvailable"])
        self.assertTrue(all(item["resourceMode"] == "structure-diagram" for item in activities["activities"]))
        self.assertTrue(all(not item["modelPartKeys"] for item in activities["activities"]))

    def test_unapproved_workflow_blocks_export(self):
        result = self.generate("心脏血流与心脏结构", 40, "heart")
        validated = lesson_design.validate_payload({
            "workflow": result["workflow"],
            "request": result["lessonPlan"]["request"],
            "forExport": True,
        })
        self.assertIn("review-required", [item["code"] for item in validated["quality"]["blocking"]])

    def test_old_split_workflow_is_merged_into_five_steps(self):
        result = self.generate("心脏血流与心脏结构", 40, "heart")
        five = result["workflow"]
        path = copy.deepcopy(five["steps"][2])
        activities = copy.deepcopy(five["steps"][3])
        split = copy.deepcopy(five)
        split["version"] = 1
        split["steps"] = [
            copy.deepcopy(five["steps"][0]), copy.deepcopy(five["steps"][1]),
            {**path, "id": "path", "number": 3, "data": copy.deepcopy(path["data"]["path"])},
            {**path, "id": "teaching", "number": 4, "data": copy.deepcopy(path["data"]["teaching"])},
            {**activities, "id": "activities", "number": 5, "data": {"activities": copy.deepcopy(activities["data"]["activities"]), "intro": copy.deepcopy(activities["data"].get("intro", {})), "homework": copy.deepcopy(activities["data"].get("homework", {})), "modelAvailable": activities["data"].get("modelAvailable", False)}},
            {**activities, "id": "competencies", "number": 6, "data": copy.deepcopy(activities["data"]["competencies"])},
            copy.deepcopy(five["steps"][4]),
        ]

        normalized = lesson_design.normalize_five_step_workflow(split)

        self.assertEqual(normalized["version"], 2)
        self.assertEqual(len(normalized["steps"]), 5)
        self.assertEqual([item["number"] for item in normalized["steps"]], [1, 2, 3, 4, 5])
        self.assertEqual(normalized["steps"][2]["data"]["path"], path["data"]["path"])
        self.assertEqual(normalized["steps"][2]["data"]["teaching"], path["data"]["teaching"])
        self.assertEqual(normalized["steps"][3]["data"]["activities"]["activities"], activities["data"]["activities"])
        self.assertEqual(normalized["steps"][3]["data"]["competencies"]["items"], activities["data"]["competencies"]["items"])

    def test_teacher_export_requires_ai_manuscript_about_exact_topic(self):
        result = self.generate("心脏血流与心脏结构", 40, "heart")
        approved = lesson_design.validate_payload({
            "workflow": result["workflow"], "request": result["lessonPlan"]["request"],
            "forExport": True, "approveAll": True,
        })["lessonPlan"]
        phases = approved["designWorkflow"]["phases"]
        ai_draft = {
            "overview": "本课围绕心脏血流与心脏结构展开，学生将通过观察结构图、梳理血流方向和解释结构功能关系完成学习。",
            "objectives": ["能够依据结构图标注心脏主要结构并说明血流方向。"],
            "keyPoints": ["心脏主要结构", "血流方向与结构功能关系"],
            "difficulties": ["依据结构证据解释血流方向"],
            "teacherPreparation": ["准备心脏结构图和课堂任务单"],
            "studentPreparation": ["回顾循环系统基本组成"],
            "process": [{"name": item["name"], "minutes": item["time"], "teacherActivity": "出示材料并引导学生观察、记录关键证据。", "studentActivity": "独立完成标注后与同伴核对并提交记录。", "question": "你的判断依据是什么？", "check": "检查结构标注和方向说明是否一致。"} for item in phases],
            "homework": ["完成心脏结构标注图，并用箭头标出血流方向。"],
            "blackboardDesign": ["结构 → 连接 → 血流方向 → 功能"],
        }
        with patch("lesson_design.lesson_ai_adapter.generate_json", return_value=(ai_draft, None)):
            prepared = lesson_design.prepare_teacher_lesson({"lessonPlan": approved})
        self.assertTrue(prepared["quality"]["valid"])
        self.assertEqual(len(prepared["draft"]["process"]), len(phases))
        self.assertEqual(sum(item["minutes"] for item in prepared["draft"]["process"]), 40)

        ai_draft["overview"] = "本课介绍循环系统。学生观察结构图并完成学习任务，最后用自己的话说明观察结果和判断依据。"
        with patch("lesson_design.lesson_ai_adapter.generate_json", return_value=(None, "格式校验失败")):
            failed = lesson_design.prepare_teacher_lesson({"lessonPlan": approved})
        self.assertIsNone(failed["draft"])
        self.assertEqual(failed["generation"]["engine"], "unavailable")

    def test_teacher_edit_is_preserved_and_remains_stale(self):
        result = self.generate("心脏血流与心脏结构", 40, "heart")
        workflow = copy.deepcopy(result["workflow"])
        path_step = workflow["steps"][2]
        path_step["source"] = "teacher-edited"
        path_step["status"] = "stale"
        path_step["data"]["path"]["questions"][0]["question"] = "教师自定义问题"
        with patch("lesson_design.lesson_ai_adapter.generate_lesson_content", return_value=(None, FALLBACK[1])):
            synced = lesson_design.sync_downstream({
                "workflow": workflow,
                "request": result["lessonPlan"]["request"],
                "mode": "quick",
            })
        preserved = synced["workflow"]["steps"][2]
        self.assertEqual(preserved["data"]["path"]["questions"][0]["question"], "教师自定义问题")
        self.assertEqual(preserved["status"], "stale")
        self.assertTrue(synced["conflicts"])

    def test_invalid_model_parts_are_blocking(self):
        result = self.generate("心脏血流与心脏结构", 40, "heart", model={"glbUrl": "/model.glb", "parts": []})
        self.assertNotIn("invalid-model-task", [item["code"] for item in result["quality"]["blocking"]])
        activity = self.data(result["workflow"], "activities")["activities"][0]
        self.assertEqual(activity["resourceMode"], "3d-appearance")
        self.assertEqual(activity["modelPartKeys"], [])

    def test_approved_legacy_part_tasks_are_reconciled_for_ppt(self):
        model = {
            "glbUrl": "/appearance.glb",
            "appearanceUrl": "/appearance.glb",
            "anatomyDisplayAvailable": False,
            "parts": [],
        }
        result = self.generate("心脏血流与心脏结构", 40, "heart")
        approved = lesson_design.validate_payload({
            "workflow": result["workflow"],
            "request": result["lessonPlan"]["request"],
            "forExport": True,
            "approveAll": True,
        })["lessonPlan"]
        activity = self.data(approved["designWorkflow"], "activities")["activities"][0]
        activity["resourceMode"] = "3d-model"
        activity["modelPartKeys"] = ["left_ventricle"]
        approved["designWorkflow"]["modelContext"] = {"available": True, "partKeys": ["left_ventricle"]}

        normalized = lesson_design.reconcile_model_capabilities(approved, model)

        self.assertEqual(normalized["designWorkflow"]["status"], "approved")
        normalized_activity = self.data(normalized["designWorkflow"], "activities")["activities"][0]
        self.assertEqual(normalized_activity["resourceMode"], "3d-appearance")
        self.assertEqual(normalized_activity["modelPartKeys"], [])
        self.assertEqual(lesson_design.validate_lesson(normalized, require_approval=True)["blocking"], [])

    def test_approve_all_commits_approved_workflow(self):
        result = self.generate("心脏血流与心脏结构", 40, "heart")
        validated = lesson_design.validate_payload({
            "workflow": result["workflow"],
            "request": result["lessonPlan"]["request"],
            "forExport": True,
            "approveAll": True,
        })
        self.assertEqual(validated["workflow"]["status"], "approved")
        self.assertTrue(all(step["approved"] for step in validated["workflow"]["steps"]))
        self.assertFalse(validated["workflow"]["qualityPending"])
        self.assertEqual(validated["quality"]["blocking"], [])

    def test_approve_all_does_not_hide_blocking_problem(self):
        result = self.generate("心脏血流与心脏结构", 40, "heart")
        workflow = copy.deepcopy(result["workflow"])
        workflow["steps"][3]["data"]["activities"]["activities"][0]["visibleOutput"] = ""
        validated = lesson_design.validate_payload({
            "workflow": workflow,
            "request": result["lessonPlan"]["request"],
            "forExport": True,
            "approveAll": True,
        })
        self.assertEqual(validated["workflow"]["status"], "review")
        self.assertFalse(all(step["approved"] for step in validated["workflow"]["steps"]))
        self.assertIn("activity-closure", [item["code"] for item in validated["quality"]["blocking"]])

    def test_ai_edit_preserves_contract_and_marks_downstream_stale(self):
        result = self.generate("心脏血流与心脏结构", 40, "heart")
        workflow = copy.deepcopy(result["workflow"])
        revised_data = copy.deepcopy(workflow["steps"][2]["data"])
        revised_data["path"]["questions"][0]["question"] = "先观察血流方向，再判断结构之间的连接关系。"
        ai_result = (
            {"data": revised_data, "summary": "问题链增加观察起点"},
            {"engine": "responses", "model": "gpt-5.6-sol", "message": "已使用 gpt-5.6-sol 编辑"},
        )
        with patch("lesson_design.lesson_ai_adapter.revise_lesson_step", return_value=ai_result):
            edited = lesson_design.edit_step({
                "workflow": workflow,
                "request": result["lessonPlan"]["request"],
                "step": 3,
                "instruction": "让问题链从观察开始",
            })
        edited_step = edited["workflow"]["steps"][2]
        self.assertEqual(edited_step["source"], "teacher-edited")
        self.assertFalse(edited_step["approved"])
        self.assertEqual(edited["generation"]["model"], "gpt-5.6-sol")
        self.assertTrue(all(item["status"] == "stale" for item in edited["workflow"]["steps"][3:]))

    def test_ai_edit_contract_rejects_removed_fields(self):
        original = {"items": [{"id": "item-1", "content": "原内容"}], "note": "保留"}
        revised = {"items": [{"id": "item-1", "content": "新内容"}]}
        self.assertIn("字段不一致", lesson_design._validate_revised_contract(original, revised))


class WarmupQuestionTests(unittest.TestCase):
    def setUp(self):
        self.lesson = {
            "id": "lesson-heart",
            "title": "心脏血流与心脏结构",
            "request": {"subject": "生物医学"},
            "objectives": ["依据结构图解释心脏血流路径"],
            "alignmentMatrix": [{"objectiveId": "PO-1", "activityIds": ["ACT-1"]}],
            "modelPlan": {"modelKey": "heart", "parts": ["left_atrium"]},
        }

    def test_warmup_without_model_uses_lesson_content(self):
        questions = server.generate_warmup_questions({"lessonPlan": self.lesson, "model": None})
        self.assertEqual(len(questions), 5)
        self.assertTrue(all(len(item["options"]) == 4 for item in questions))
        self.assertEqual([item["correctIndex"] for item in questions], [0, 1, 2, 3, 1])
        self.assertTrue(all(item["modelPartKeys"] == [] for item in questions))
        text = "".join(item["question"] + item["explanation"] for item in questions)
        self.assertNotIn("旋转模型", text)
        self.assertNotIn("点击部件", text)
        self.assertTrue(all(item["objectiveIds"] == ["PO-1"] for item in questions))

    def test_warmup_with_real_model_uses_part_keys(self):
        model = {
            "glbUrl": "/api/models/heart/files/glb",
            "parts": [
                {"partKey": "left_atrium", "partLabel": "左心房"},
                {"partKey": "left_ventricle", "partLabel": "左心室"},
            ],
        }
        questions = server.generate_warmup_questions({"lessonPlan": self.lesson, "model": model})
        self.assertEqual(len(questions), 5)
        self.assertTrue(any(item["modelPartKeys"] for item in questions))
        self.assertTrue(all(len(item["options"]) == 4 for item in questions))

    def test_recommended_model_plan_is_not_a_generated_model(self):
        questions = server.generate_warmup_questions({"lessonPlan": self.lesson})
        self.assertTrue(all(item["modelPartKeys"] == [] for item in questions))

    def test_warmup_responses_output_is_five_structured_questions(self):
        model = {
            "glbUrl": "/api/models/heart/files/glb",
            "parts": [{"partKey": "left_atrium", "partLabel": "左心房"}, {"partKey": "left_ventricle", "partLabel": "左心室"}],
        }
        ai = {"questions": [
            {"type": "部件识别", "question": "哪一个是左心房？", "options": ["左心房", "左心室", "主动脉", "肺动脉"], "correctIndex": 0, "explanation": "左心房接收肺静脉回流。", "difficulty": "基础", "partKeys": ["left_atrium"]},
            {"type": "位置或连接关系", "question": "判断连接关系应依据什么？", "options": ["名称和相邻结构", "背景颜色", "屏幕亮度", "文件大小"], "correctIndex": 0, "explanation": "结构连接由空间关系判断。", "difficulty": "基础", "partKeys": ["left_ventricle"]},
            {"type": "模型观察判断", "question": "隔离部件后记录什么？", "options": ["空间关系", "颜色", "亮度", "文件大小"], "correctIndex": 0, "explanation": "隔离用于观察三维空间关系。", "difficulty": "基础", "partKeys": ["left_atrium", "left_ventricle"]},
            {"type": "结构与功能", "question": "如何解释结构功能？", "options": ["结合位置形态连接", "只看颜色", "只看大小", "直接猜测"], "correctIndex": 0, "explanation": "结构功能需要多项证据。", "difficulty": "进阶", "partKeys": ["left_ventricle"]},
            {"type": "机制迁移", "question": "如何完成迁移判断？", "options": ["结构机制证据对应", "凭印象", "只找熟词", "忽略反例"], "correctIndex": 0, "explanation": "迁移要逐项对应证据。", "difficulty": "进阶", "partKeys": ["left_atrium"]},
        ]}
        with patch("server.lesson_ai_adapter.generate_json", return_value=(ai, None)):
            items, generation, warnings = server.generate_warmup_with_ai({"lessonPlan": self.lesson, "model": model})
        self.assertEqual(len(items), 5)
        self.assertEqual(generation["engine"], "responses")
        self.assertEqual(generation["model"], "gpt-5.6-sol")
        self.assertEqual(warnings, [])
        self.assertEqual(items[0]["partKeys"], ["left_atrium"])

    def test_warmup_responses_fallback_is_explicit(self):
        with patch("server.lesson_ai_adapter.generate_json", return_value=(None, "格式错误")):
            items, generation, warnings = server.generate_warmup_with_ai({"lessonPlan": self.lesson})
        self.assertEqual(len(items), 5)
        self.assertEqual(generation["engine"], "builtin-template")
        self.assertIn("格式错误", generation["message"])
        self.assertTrue(warnings)

    def test_warmup_regeneration_preserves_other_teacher_edits(self):
        current = server.generate_warmup_questions({"lessonPlan": self.lesson})
        current[1]["source"] = "teacher-edited"
        current[1]["question"] = "教师修改的第二题"
        ai = {"questions": [{"type": "位置或连接关系", "question": "新第二题", "options": ["A", "B", "C", "D"], "correctIndex": 1, "explanation": "新解析", "difficulty": "基础", "partKeys": []}]}
        with patch("server.lesson_ai_adapter.generate_json", return_value=(ai, None)):
            items, _generation, _warnings = server.generate_warmup_with_ai({"lessonPlan": self.lesson, "currentQuestions": current}, regenerate_index=1)
        self.assertEqual(items[1]["question"], "新第二题")
        self.assertEqual(items[0]["question"], current[0]["question"])
        self.assertEqual(items[2]["question"], current[2]["question"])

    def test_ai_answers_are_spread_across_options(self):
        ai = {"questions": [
            {"type": item_type, "question": f"问题{index}", "options": ["正确", "干扰一", "干扰二", "干扰三"], "correctIndex": 0, "explanation": "解析", "difficulty": "基础", "partKeys": []}
            for index, item_type in enumerate(server.WARMUP_TYPES)
        ]}
        with patch("server.lesson_ai_adapter.generate_json", return_value=(ai, None)):
            items, _generation, _warnings = server.generate_warmup_with_ai({"lessonPlan": self.lesson})
        self.assertEqual([item["correctIndex"] for item in items], [0, 1, 2, 3, 1])


class CoursewareAppearanceTests(unittest.TestCase):
    def test_sf3d_appearance_never_exposes_hidden_anatomy_parts(self):
        model = {
            "glbUrl": "/appearance.glb",
            "appearanceUrl": "/appearance.glb",
            "anatomyDisplayAvailable": False,
            "parts": [],
        }
        manifest = courseware.build_manifest({"id": "heart", "title": "心脏血流与心脏结构"}, model)
        model_scenes = [scene["model"] for scene in manifest["scenes"] if scene.get("model")]
        self.assertTrue(model_scenes)
        self.assertTrue(all(item["mode"] == "appearance" for item in model_scenes))
        self.assertTrue(all(item["partKeys"] == [] for item in model_scenes))
        self.assertTrue(all(item["exploded"] is False for item in model_scenes))


class HunyuanOnlyTests(unittest.TestCase):
    def test_missing_key_blocks(self):
        with patch("server.parse_multipart", return_value=({}, [])), patch("server.hunyuan3d_config", return_value=("https://tokenhub.tencentmaas.com", "", "hy-3d-3.1")), patch("server.package_reconstruction") as legacy:
            with self.assertRaises(RuntimeError):
                server.generate_image_model(b"x", "multipart/form-data", "single")
            legacy.assert_not_called()

    def test_multiview_never_submits_front_only(self):
        with patch("server.hunyuan3d_config", return_value=("https://tokenhub.tencentmaas.com", "test", "hy-3d-3.1")), patch("server.generate_hunyuan3d") as generate:
            with self.assertRaises(ValueError):
                server.generate_image_model(b"x", "multipart/form-data", "multiview")
            generate.assert_not_called()

    def test_polling_and_precision(self):
        import io
        import tempfile
        from pathlib import Path
        from PIL import Image
        output = io.BytesIO()
        Image.new("RGB", (128, 128)).save(output, format="PNG")
        image = {"content": output.getvalue()}
        replies = [{"id": "test", "status": "queued"}, {"status": "in_progress"}, {"status": "completed", "data": [{"type": "glb", "url": "https://example.tencentcos.cn/model.glb"}]}]
        with tempfile.TemporaryDirectory() as tmp, patch("server.OUTPUT_DIR", Path(tmp)), patch("server.hunyuan3d_config", return_value=("https://tokenhub.tencentmaas.com", "test", "hy-3d-3.1")), patch("server._hunyuan_json_request", side_effect=replies) as request, patch("server.time.sleep"), patch("server._hunyuan_download_glb", return_value=b"glTF-original"):
            self.assertEqual(server.generate_hunyuan3d(image, {}, "single"), b"glTF-original")
            self.assertEqual(request.call_args_list[0].args[1]["face_count"], 1500000)
            self.assertTrue(request.call_args_list[0].args[1]["enable_pbr"])
            self.assertEqual(request.call_count, 3)

    def test_original_glb_not_replaced_by_template(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp, patch("server.OUTPUT_DIR", Path(tmp)), patch("server.hunyuan3d_config", return_value=("https://tokenhub.tencentmaas.com", "test", "hy-3d-3.1")), patch("server.parse_multipart", return_value=({"separationMode": "anatomical"}, {})), patch("server.generate_hunyuan3d", return_value=b"glTF-original"), patch("server.attach_standard_views", side_effect=lambda result: {**result, "viewStatus": "ready"}), patch("server.package_reconstruction") as legacy:
            _, _, raw = server.generate_image_model(b"x", "multipart/form-data", "single")
            result = __import__("json").loads(raw)
            self.assertEqual(result["engine"], "hunyuan3d")
            self.assertEqual(result["parts"], [])
            self.assertEqual(next(Path(tmp).rglob("model.glb")).read_bytes(), b"glTF-original")
            legacy.assert_not_called()


if __name__ == "__main__":
    unittest.main()
