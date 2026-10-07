import concurrent.futures
import json
import tempfile
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image, ImageDraw
import model_views
import courseware


def render_stub(source, output):
    for index, view in enumerate(model_views.VIEWS):
        image = Image.new('RGBA', (1024, 1024))
        ImageDraw.Draw(image).rectangle((100, 100, 900, 900), fill=(100 + index * 30, 40, 50, 255))
        image.save(output / (view + '.png'))


class ModelViewsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'model.glb'
        self.source.write_bytes(b'glTF-test-one')
        patcher = patch.object(model_views, 'CACHE', self.root / 'views')
        patcher.start()
        self.addCleanup(patcher.stop)

    def image_path(self, result, key):
        relative = result['viewImageUrls'][key].split('/model-views/', 1)[1]
        return model_views.CACHE / relative

    def test_new_old_cache_corruption_and_model_replacement(self):
        self.assertEqual(model_views.ensure_views(self.source, False)['status'], 'missing')
        with patch.object(model_views, '_render', side_effect=render_stub) as render:
            first = model_views.ensure_views(self.source)
            self.assertEqual(first, model_views.ensure_views(self.source))
            self.assertEqual(render.call_count, 1)
            self.image_path(first, 'left').unlink()
            second = model_views.ensure_views(self.source)
            self.assertEqual(render.call_count, 2)
            self.image_path(second, 'front').write_bytes(b'broken')
            third = model_views.ensure_views(self.source)
            self.assertEqual(render.call_count, 3)
            self.source.write_bytes(b'glTF-test-two')
            fourth = model_views.ensure_views(self.source)
            self.assertNotEqual(third['viewModelFingerprint'], fourth['viewModelFingerprint'])
            self.assertEqual(render.call_count, 4)

    def test_concurrent_requests_render_once(self):
        with patch.object(model_views, '_render', side_effect=render_stub) as render:
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                results = list(executor.map(lambda _: model_views.ensure_views(self.source), range(4)))
            self.assertEqual(render.call_count, 1)
            self.assertTrue(all(result == results[0] for result in results))

    def test_failure_is_not_published_and_retry_keeps_model(self):
        with patch.object(model_views, '_render', side_effect=RuntimeError('timeout')):
            with self.assertRaises(RuntimeError):
                model_views.ensure_views(self.source)
        self.assertTrue(self.source.is_file())
        self.assertFalse(list(model_views.CACHE.rglob('views.json')))
        with patch.object(model_views, '_render', side_effect=render_stub):
            self.assertEqual(model_views.ensure_views(self.source)['status'], 'ready')

    def test_renderer_timeout_and_blank_result_preserve_model(self):
        with patch.object(model_views.biomed_models, 'find_blender', return_value=Path('blender.exe')), patch.object(model_views.subprocess, 'run', side_effect=subprocess.TimeoutExpired('blender', 300)) as run:
            with self.assertRaisesRegex(RuntimeError, '300'):
                model_views.ensure_views(self.source)
            self.assertEqual(run.call_args.kwargs['timeout'], 300)
        def blank(source, output):
            for view in model_views.VIEWS:
                Image.new('RGBA', (1024, 1024)).save(output / (view + '.png'))
        with patch.object(model_views, '_render', side_effect=blank):
            with self.assertRaises(ValueError):
                model_views.ensure_views(self.source)
        self.assertTrue(self.source.is_file())
        self.assertFalse(list(model_views.CACHE.rglob('views.json')))

    def test_proxy_urls_and_current_model_win_over_stale_metadata(self):
        model = {'modelUrl': '/api/prep/3d/download/model.glb', 'viewModelFingerprint': 'old', 'viewImageUrls': {'front': '/images/old.png'}}
        with patch.object(courseware, 'OUTPUT_DIR', self.root), patch.object(model_views, '_render', side_effect=render_stub):
            self.assertEqual(courseware._resolve_model(model['modelUrl']), self.source)
            result = courseware.prepare_model_views({'model': model, 'scenes': [{'model': {}}]})
            self.assertNotEqual(result['viewModelFingerprint'], 'old')
            self.assertEqual(set(result['viewImageUrls']), set(model_views.VIEWS))
            self.assertIsNone(courseware._resolve_model('/api/prep/3d/download/../../outside.glb'))


if __name__ == '__main__':
    unittest.main()
