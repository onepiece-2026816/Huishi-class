import io
import json
import struct
import unittest
import zipfile
import tempfile
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from express_model import obj_archive_to_glb


class ExpressModelTests(unittest.TestCase):
    def archive(self, files):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            for name, data in files.items():
                archive.writestr(name, data)
        return output.getvalue()

    def test_textured_obj_becomes_embedded_glb(self):
        image = io.BytesIO()
        Image.new("RGB", (2, 2), "red").save(image, format="PNG")
        data = self.archive({
            "model/a.obj": "mtllib a.mtl\nv 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nusemtl surface\nf 1/1 2/2 3/3\n",
            "model/a.mtl": "newmtl surface\nKd 1 1 1\nmap_Kd texture.png\n",
            "model/texture.png": image.getvalue(),
        })
        result = obj_archive_to_glb(data)
        self.assertEqual(result[:4], b"glTF")
        self.assertEqual(struct.unpack_from("<I", result, 8)[0], len(result))
        length = struct.unpack_from("<I", result, 12)[0]
        document = json.loads(result[20:20 + length])
        self.assertTrue(document["meshes"])
        self.assertTrue(document["images"][0].get("bufferView") is not None)

    def test_rejects_unsafe_archive_paths(self):
        with self.assertRaises(ValueError):
            obj_archive_to_glb(self.archive({"../a.obj": ""}))

    def test_rejects_missing_obj(self):
        with self.assertRaises(ValueError):
            obj_archive_to_glb(self.archive({"readme.txt": "no model"}))

    def test_express_retry_queries_existing_task_and_converts_obj(self):
        import server
        completed = {"id": "existing-task", "status": "completed", "data": [
            {"type": "obj", "url": "https://example.tencentcos.cn/model.zip"}]}
        with tempfile.TemporaryDirectory() as directory, patch.object(server, "OUTPUT_DIR", Path(directory)), \
             patch.object(server, "hunyuan3d_model_config", return_value=("https://example.test", "test", "hy-3d-express")), \
             patch.object(server, "_validate_hunyuan_image", return_value="image"), \
             patch.object(server, "_hunyuan_json_request", return_value=completed) as request, \
             patch.object(server, "_hunyuan_download_glb", return_value=b"converted") as download:
            for _ in range(2):
                self.assertEqual(server._generate_hunyuan3d({}, {"model": "hy-3d-express"}, "single"), b"converted")
            self.assertTrue(request.call_args_list[0].args[0].endswith("/submit"))
            self.assertTrue(request.call_args_list[1].args[0].endswith("/query"))
            self.assertEqual(request.call_args_list[1].args[1]["model"], "hy-3d-express")
            download.assert_called_with("https://example.tencentcos.cn/model.zip", archive=True)


if __name__ == "__main__":
    unittest.main()
