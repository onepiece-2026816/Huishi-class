"""Split a mesh into editable parts using PartField face labels."""
from __future__ import annotations
import argparse, json
from pathlib import Path
import numpy as np, trimesh

PALETTE = [[0.85,0.30,0.30],[0.30,0.55,0.85],[0.35,0.75,0.45],[0.90,0.65,0.25],
           [0.60,0.45,0.80],[0.25,0.75,0.78],[0.85,0.50,0.70],[0.55,0.60,0.30],
           [0.75,0.75,0.40],[0.40,0.40,0.55],[0.90,0.45,0.20],[0.30,0.65,0.60]]

def load_mesh(path):
    m = trimesh.load(str(path), force="mesh", process=False)
    if isinstance(m, trimesh.Scene):
        geoms = [g for g in m.geometry.values() if len(g.faces) > 0]
        m = trimesh.util.concatenate(geoms) if len(geoms) > 1 else geoms[0]
    return m

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", required=True)
    ap.add_argument("--labels", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--min-faces", type=int, default=150)
    a = ap.parse_args()
    rep = {"method": "partfield", "status": "failed", "warnings": [], "parts": []}
    m = load_mesh(a.glb)
    F = np.asarray(m.faces)
    L = np.load(a.labels).reshape(-1).astype(np.int64)
    if L.shape[0] != F.shape[0]:
        rep["status"] = "label_mismatch"
        rep["warnings"].append("mesh=%d labels=%d" % (F.shape[0], L.shape[0]))
        print(json.dumps(rep)); return 2
    out = Path(a.out); (out / "parts").mkdir(parents=True, exist_ok=True)
    C = np.asarray(m.vertices)[F].mean(axis=1)
    uniq = [int(v) for v in np.unique(L)]
    cnt = {l: int((L == l).sum()) for l in uniq}
    big = [l for l in uniq if cnt[l] >= a.min_faces]
    small = [l for l in uniq if cnt[l] < a.min_faces]
    if not big:
        rep["status"] = "no_valid_parts"; print(json.dumps(rep)); return 3
    if small:
        bc = np.stack([C[L == l].mean(axis=0) for l in big])
        for l in small:
            s = L == l
            L[s] = big[int(np.argmin(np.linalg.norm(bc - C[s].mean(axis=0), axis=1)))]
        rep["warnings"].append("merged %d small clusters" % len(small))
    big.sort(key=lambda l: -int((L == l).sum()))
    for i, l in enumerate(big):
        ids = np.where(L == l)[0]
        sub = m.submesh([ids], append=True)
        if isinstance(sub, trimesh.Scene):
            sub = trimesh.util.concatenate(list(sub.geometry.values()))
        col = PALETTE[i % len(PALETTE)]
        # submesh() preserves the source TextureVisuals, including UVs and the
        # embedded PBR image. The palette is metadata for selection/highlight
        # only; replacing sub.visual here destroys the generated texture.
        fn = "parts/part_%02d.glb" % (i + 1)
        sub.export(str(out / fn))
        rep["parts"].append({"partKey": "part-%02d" % (i + 1), "index": i, "labelId": int(l),
            "faceCount": int(len(sub.faces)), "vertexCount": int(len(sub.vertices)),
            "color": [round(c, 3) for c in col], "file": fn, "method": "partfield"})
    rep["status"] = "completed" if len(rep["parts"]) >= 2 else "too_few_parts"
    rep["partCount"] = len(rep["parts"]); rep["hierarchical"] = True
    (out / "parts.json").write_text(json.dumps(rep, indent=2), encoding="utf-8")
    print(json.dumps(rep)); return 0

if __name__ == "__main__":
    raise SystemExit(main())
