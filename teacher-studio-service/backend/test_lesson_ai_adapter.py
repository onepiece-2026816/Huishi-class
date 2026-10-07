import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

import lesson_ai_adapter as ai


def response(text, status="completed"):
    return {"status": status, "output": [
        {"type": "reasoning", "summary": []},
        {"type": "message", "content": [{"type": "output_text", "text": text}]},
    ]}


class LessonAIAdapterTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(ai.os.environ, {"LESSON_AI_API_KEY": "test-secret", "LESSON_AI_REASONING_EFFORT": "low"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_responses_request_preserves_schema_and_disables_storage(self):
        schema = {"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"], "additionalProperties": False}
        with patch.object(ai, "urlopen") as transport:
            transport.return_value.__enter__.return_value.read.return_value = json.dumps(response('{"ok":true}')).encode()
            result, error = ai.generate_json("System", "User", format_schema=schema)
        request = transport.call_args.args[0]
        payload = json.loads(request.data)
        self.assertEqual(request.full_url, ai.DEFAULT_BASE_URL + "/responses")
        self.assertEqual(request.get_header("Authorization"), "Bearer test-secret")
        self.assertEqual(payload["model"], "gpt-5.6-sol")
        self.assertFalse(payload["store"])
        self.assertEqual(payload["reasoning"], {"effort": "low"})
        self.assertEqual(payload["text"]["format"]["schema"], schema)
        self.assertTrue(payload["text"]["format"]["strict"])
        self.assertEqual(result, {"ok": True})
        self.assertIsNone(error)

    def test_validator_repairs_invalid_output(self):
        with patch.object(ai, "_request", side_effect=[response('{"title":""}'), response('{"title":"lesson"}')]) as request:
            result, error = ai.generate_json("System", "User", validator=lambda value: None if value.get("title") else "missing title")
        self.assertEqual(result, {"title": "lesson"})
        self.assertIsNone(error)
        self.assertIn("missing title", request.call_args.args[1]["input"][0]["content"])

    def test_missing_key_never_contacts_network(self):
        with patch.dict(ai.os.environ, {"LESSON_AI_API_KEY": ""}), patch.object(ai, "_request") as request:
            result, error = ai.generate_json("System", "User")
            state = ai.status()
        request.assert_not_called()
        self.assertIsNone(result)
        self.assertIn("LESSON_AI_API_KEY", error)
        self.assertFalse(state["available"])
        self.assertIsNone(state["serviceReachable"])

    def test_auth_error_is_not_retried_or_exposed(self):
        failure = HTTPError("https://example.test/responses", 401, "test-secret", {}, io.BytesIO(b"test-secret"))
        with patch.object(ai, "_request", side_effect=failure) as request:
            result, error = ai.generate_json("System", "User")
        self.assertEqual(request.call_count, 1)
        self.assertIsNone(result)
        self.assertIn("401", error)
        self.assertNotIn("test-secret", error)

    def test_windows_socket_permission_error_has_actionable_message(self):
        reason = OSError("socket access denied")
        reason.winerror = 10013
        with patch.object(ai, "_request", side_effect=URLError(reason)):
            result, error = ai.generate_json("System", "User")
        self.assertIsNone(result)
        self.assertIn("Windows 10013", error)
        self.assertIn("允许开发服务访问网络后重启", error)

    def test_incomplete_empty_and_refused_responses_fail(self):
        cases = [response('{"ok":true}', "incomplete"), {"output": []},
                 {"output": [{"type": "message", "content": [{"type": "refusal", "refusal": "no"}]}]}]
        for value in cases:
            with self.subTest(value=value), patch.object(ai, "_request", return_value=value):
                result, error = ai.generate_json("System", "User")
            self.assertIsNone(result)
            self.assertTrue(error)

    def test_empty_step_arrays_have_a_typed_strict_schema(self):
        schema = ai._json_schema_for({"parts": []})
        self.assertEqual(schema["properties"]["parts"], {"type": "array", "items": {"type": "string"}, "maxItems": 0})


if __name__ == "__main__":
    unittest.main()
