import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import courseware


class OfflineExportTests(unittest.TestCase):
    def test_owned_model_uses_staged_file_in_offline_package(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            model = root / 'model.glb'
            model.write_bytes(b'glTF-test-model')
            viewer = root / 'node_modules/@google/model-viewer/dist/model-viewer-module.min.js'
            viewer.parent.mkdir(parents=True)
            viewer.write_text('// viewer', encoding='utf-8')
            manifest = {'title': 'Export test', 'model': {'modelUrl': '/api/models/private/files/model', 'exportModelUrl': '/api/3d/download/staged.glb'}, 'scenes': [{'enabled': True, 'model': {}}]}
            with patch.object(courseware, 'PROJECT_ROOT', root), patch.object(courseware, 'OUTPUT_DIR', root), patch.object(courseware, '_resolve_model', return_value=model) as resolve:
                output = courseware.create_offline_zip(manifest)
            resolve.assert_called_once_with('/api/3d/download/staged.glb')
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(archive.read('model.glb'), model.read_bytes())
                self.assertIn(b'server.server_port', archive.read('serve.py'))

    def test_missing_model_blocks_export(self):
        manifest = {'title': 'Missing', 'model': {'modelUrl': '/api/models/missing/files/model'}, 'scenes': [{'model': {}}]}
        with patch.object(courseware, '_resolve_model', return_value=None):
            with self.assertRaises(ValueError):
                courseware.create_offline_zip(manifest)
