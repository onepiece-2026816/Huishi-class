"""Convert provider OBJ archives to textured GLB without extracting files."""
import io
import zipfile
from pathlib import PurePosixPath


def obj_archive_to_glb(data):
    import trimesh

    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = [item for item in archive.infolist() if not item.is_dir()]
        if len(entries) > 200 or sum(item.file_size for item in entries) > 512 * 1024 * 1024:
            raise ValueError("Express model archive exceeds size limits")
        files = {}
        for item in entries:
            name = item.filename.replace("\\", "/")
            path = PurePosixPath(name)
            if path.is_absolute() or ".." in path.parts or ":" in name:
                raise ValueError("Invalid Express archive path")
            files[name] = archive.read(item)
    objects = sorted(name for name in files if name.lower().endswith(".obj"))
    if len(objects) != 1:
        raise ValueError("Express archive must contain exactly one OBJ model")
    name = objects[0]
    parent = str(PurePosixPath(name).parent)
    prefix = "" if parent == "." else parent + "/"
    resources = {key[len(prefix):]: value for key, value in files.items() if key.startswith(prefix)}
    scene = trimesh.load(io.BytesIO(files[name]), file_type="obj", resolver=resources,
                         force="scene", process=False)
    if not scene.geometry:
        raise ValueError("Express returned an empty OBJ model")
    return scene.export(file_type="glb")
