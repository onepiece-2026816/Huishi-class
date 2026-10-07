"""Offline image reconstruction for the built-in local-only 3D path.

The implementation intentionally has no network dependency. It creates a visual-hull
mesh from one silhouette or four orthographic silhouettes. Parts are geometric bands,
not claimed semantic components; Blender performs the final cleanup and export.
"""
from __future__ import annotations

import io
import json
import math
import struct
from dataclasses import dataclass

from PIL import Image, ImageChops, ImageFilter, ImageOps, ImageStat


GRID_SIZE = 64


@dataclass
class ViewImage:
    image: Image.Image
    mask: Image.Image


def _foreground_mask(raw: bytes, size: int = GRID_SIZE) -> ViewImage:
    image = Image.open(io.BytesIO(raw)).convert("RGBA")
    image.thumbnail((768, 768), Image.Resampling.LANCZOS)
    alpha = image.getchannel("A")
    rgb = image.convert("RGB")
    corners = [rgb.getpixel((0, 0)), rgb.getpixel((rgb.width - 1, 0)), rgb.getpixel((0, rgb.height - 1)), rgb.getpixel((rgb.width - 1, rgb.height - 1))]
    background = tuple(sorted(pixel[channel] for pixel in corners)[len(corners) // 2] for channel in range(3))
    background_image = Image.new("RGB", rgb.size, background)
    difference = ImageChops.difference(rgb, background_image).convert("L")
    threshold = max(18, int(ImageStat.Stat(difference).mean[0] * 1.35))
    color_mask = difference.point(lambda value: 255 if value > threshold else 0)
    alpha_mask = alpha.point(lambda value: 255 if value > 20 else 0)
    mask = ImageChops.multiply(color_mask, alpha_mask).filter(ImageFilter.MedianFilter(5))
    bbox = mask.getbbox()
    if not bbox or sum(1 for value in mask.resize((32, 32)).getdata() if value > 0) < 24:
        # A conservative centered fallback is preferable to returning an empty file.
        mask = Image.new("L", image.size, 0)
        inset_x = max(1, image.width // 12)
        inset_y = max(1, image.height // 12)
        mask.paste(255, (inset_x, inset_y, image.width - inset_x, image.height - inset_y))
        bbox = mask.getbbox()
    crop = mask.crop(bbox)
    fitted = ImageOps.contain(crop, (size - 4, size - 4), Image.Resampling.LANCZOS)
    normalized = Image.new("L", (size, size), 0)
    normalized.paste(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
    return ViewImage(image=image, mask=normalized.point(lambda value: 255 if value >= 96 else 0))


def _occupied_single(view: ViewImage, size: int):
    mask = view.mask.load()
    occupied = set()
    for y in range(size):
        for x in range(size):
            if not mask[x, size - 1 - y]:
                continue
            edge_distance = min(x, size - 1 - x, y, size - 1 - y)
            half_depth = max(2, min(size // 3, 3 + edge_distance // 2))
            for z in range(size // 2 - half_depth, size // 2 + half_depth + 1):
                occupied.add((x, y, z))
    return occupied


def _occupied_multiview(views: dict[str, ViewImage], size: int):
    masks = {key: value.mask.load() for key, value in views.items()}
    occupied = set()
    for y in range(size):
        image_y = size - 1 - y
        for x in range(size):
            if not masks["front"][x, image_y] or not masks["back"][size - 1 - x, image_y]:
                continue
            for z in range(size):
                if masks["left"][size - 1 - z, image_y] and masks["right"][z, image_y]:
                    occupied.add((x, y, z))
    return occupied


def _part_index(y: int, minimum: int, maximum: int) -> int:
    span = max(1, maximum - minimum + 1)
    return min(2, int((y - minimum) * 3 / span))


FACE_DATA = (
    ((1, 0, 0), ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1))),
    ((-1, 0, 0), ((0, 0, 1), (0, 1, 1), (0, 1, 0), (0, 0, 0))),
    ((0, 1, 0), ((0, 1, 1), (1, 1, 1), (1, 1, 0), (0, 1, 0))),
    ((0, -1, 0), ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1))),
    ((0, 0, 1), ((1, 0, 1), (1, 1, 1), (0, 1, 1), (0, 0, 1))),
    ((0, 0, -1), ((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0))),
)


def _build_parts(occupied: set[tuple[int, int, int]], size: int):
    if not occupied:
        raise ValueError("参考图未提取到可重建的主体轮廓")
    minimum_y = min(point[1] for point in occupied)
    maximum_y = max(point[1] for point in occupied)
    chunks = [{"positions": [], "normals": [], "indices": []} for _ in range(3)]
    scale = 3.2 / size
    for x, y, z in occupied:
        part = _part_index(y, minimum_y, maximum_y)
        chunk = chunks[part]
        for normal, corners in FACE_DATA:
            neighbor = (x + normal[0], y + normal[1], z + normal[2])
            neighbor_part = _part_index(neighbor[1], minimum_y, maximum_y) if neighbor in occupied else -1
            if neighbor in occupied and neighbor_part == part:
                continue
            base = len(chunk["positions"]) // 3
            for corner in corners:
                chunk["positions"].extend(((x + corner[0] - size / 2) * scale, (y + corner[1] - size / 2) * scale, (z + corner[2] - size / 2) * scale))
                chunk["normals"].extend(normal)
            chunk["indices"].extend((base, base + 1, base + 2, base, base + 2, base + 3))
    labels = ("Lower geometric region", "Middle geometric region", "Upper geometric region")
    return [(labels[index], chunk) for index, chunk in enumerate(chunks) if chunk["indices"]]


def _pad(data: bytes, fill=b"\x00") -> bytes:
    return data + fill * ((4 - len(data) % 4) % 4)


def _pack_glb(parts, source: str):
    binary = bytearray()
    buffer_views = []
    accessors = []
    meshes = []
    nodes = []
    materials = []
    palette = ((0.20, 0.72, 0.72, 1.0), (0.33, 0.56, 0.92, 1.0), (0.92, 0.52, 0.30, 1.0))

    def add_view(data: bytes, target: int) -> int:
        offset = len(binary)
        binary.extend(_pad(data))
        buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data), "target": target})
        return len(buffer_views) - 1

    for part_index, (label, part) in enumerate(parts):
        position_bytes = struct.pack(f"<{len(part['positions'])}f", *part["positions"])
        normal_bytes = struct.pack(f"<{len(part['normals'])}f", *part["normals"])
        index_bytes = struct.pack(f"<{len(part['indices'])}I", *part["indices"])
        position_view = add_view(position_bytes, 34962)
        normal_view = add_view(normal_bytes, 34962)
        index_view = add_view(index_bytes, 34963)
        points = list(zip(part["positions"][0::3], part["positions"][1::3], part["positions"][2::3]))
        accessors.extend([
            {"bufferView": position_view, "componentType": 5126, "count": len(points), "type": "VEC3", "min": [min(point[i] for point in points) for i in range(3)], "max": [max(point[i] for point in points) for i in range(3)]},
            {"bufferView": normal_view, "componentType": 5126, "count": len(points), "type": "VEC3"},
            {"bufferView": index_view, "componentType": 5125, "count": len(part["indices"]), "type": "SCALAR"},
        ])
        accessor_base = len(accessors) - 3
        materials.append({"name": f"MAT_Local_{part_index + 1}", "pbrMetallicRoughness": {"baseColorFactor": palette[part_index % len(palette)], "metallicFactor": 0.0, "roughnessFactor": 0.62}})
        meshes.append({"name": label, "primitives": [{"attributes": {"POSITION": accessor_base, "NORMAL": accessor_base + 1}, "indices": accessor_base + 2, "material": part_index}]})
        nodes.append({"mesh": part_index, "name": label, "extras": {"partKey": f"geometric_region_{part_index + 1}", "partLabel": label, "source": source, "confidence": 0.35}})

    document = {
        "asset": {"version": "2.0", "generator": "Shuzhi local offline visual hull"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": materials,
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }
    json_bytes = _pad(json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8"), b" ")
    binary_bytes = _pad(bytes(binary))
    total = 12 + 8 + len(json_bytes) + 8 + len(binary_bytes)
    return b"glTF" + struct.pack("<II", 2, total) + struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes + struct.pack("<II", len(binary_bytes), 0x004E4942) + binary_bytes


def reconstruct_single(raw: bytes) -> bytes:
    view = _foreground_mask(raw)
    occupied = _occupied_single(view, GRID_SIZE)
    return _pack_glb(_build_parts(occupied, GRID_SIZE), "local-basic-single-image")


def reconstruct_multiview(raw_views: dict[str, bytes]) -> bytes:
    views = {key: _foreground_mask(value) for key, value in raw_views.items()}
    occupied = _occupied_multiview(views, GRID_SIZE)
    return _pack_glb(_build_parts(occupied, GRID_SIZE), "local-basic-four-view")


def status(blender_available: bool) -> dict:
    return {
        "provider": "local",
        "paidApi": False,
        "networkRequired": False,
        "singleImage": {"available": True, "engine": "offline-silhouette", "quality": "basic"},
        "multiview": {"available": True, "engine": "offline-visual-hull", "quality": "basic", "views": ["front", "left", "right", "back"]},
        "blenderAvailable": blender_available,
        "semanticSeparation": False,
    }
