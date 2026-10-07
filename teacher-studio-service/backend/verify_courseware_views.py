"""Exercise the real PPT export and PowerPoint renderer with saved lesson data."""
import json
from pathlib import Path
import sys
import courseware


plan = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
model = {"modelKey": "heart", "modelUrl": sys.argv[2]}
manifest = courseware.build_manifest(plan, model)
output, report = courseware.create_ppt(manifest)
print(json.dumps({"path": str(output), "report": report}, ensure_ascii=True), flush=True)
client = courseware._load_powerpoint_client()
import pythoncom
pythoncom.CoInitialize()
app = document = None
try:
    app = client.DispatchEx("PowerPoint.Application")
    document = app.Presentations.Open(str(output), ReadOnly=True, WithWindow=False)
    for index, scene in enumerate(manifest["scenes"], 1):
        if scene.get("model") is not None:
            slide = document.Slides(index)
            picture_ids = {shape.Id for shape in slide.Shapes if shape.Type == 13}
            assert len(picture_ids) == 4
            assert not any(effect.Shape.Id in picture_ids for effect in slide.TimeLine.MainSequence)
            preview = output.with_name(output.stem + f"-slide-{index}.png")
            slide.Export(str(preview), "PNG", 1600, 900)
            print(str(preview), flush=True)
finally:
    if document is not None:
        document.Close()
    if app is not None:
        app.Quit()
    pythoncom.CoUninitialize()
