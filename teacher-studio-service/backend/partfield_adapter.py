"""Subprocess adapter for the local PartField checkout.

This module intentionally does not import torch. GPU checks and inference run
inside the configured PartField runtime so the Teacher Studio service stays
lightweight and can fall back cleanly when segmentation is unavailable.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import time
from pathlib import Path


JJ_ROOT = Path(os.environ.get("JJ_ROOT", r"D:\jjr"))
CHECKOUT = Path(os.environ.get("PARTFIELD_CHECKOUT", JJ_ROOT / "third_party" / "PartField"))
RUNTIME_PYTHON = Path(os.environ.get("PARTFIELD_PYTHON", JJ_ROOT / "partfield-runtime" / "Scripts" / "python.exe"))
CHECKPOINT = Path(os.environ.get("PARTFIELD_CHECKPOINT", CHECKOUT / "model" / "model_objaverse.ckpt"))
CONFIG = Path(os.environ.get("PARTFIELD_CONFIG", CHECKOUT / "configs" / "final" / "windows-8gb.yaml"))
CACHE_DIR = Path(os.environ.get("PARTFIELD_CACHE_DIR", JJ_ROOT / "partfield-cache"))
EXPECTED_CHECKPOINT_SHA256 = "463EFC8A3AFD3913142AA025E0125C00F16EF452B8DE6A132EBE32BBE7877EE4"
LICENSE = "PartField non-commercial research/education license"


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(JJ_ROOT)).replace("\\", "/")
    except ValueError:
        return str(path)


def _tail(text: str, limit: int = 2400) -> str:
    text = text or ""
    return text[-limit:]


def _env() -> dict[str, str]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    temp_dir = CACHE_DIR / "tmp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env.update({
        "PYTHONNOUSERSITE": "1",
        "HF_HOME": str(CACHE_DIR / "hf"),
        "TORCH_HOME": str(CACHE_DIR / "torch"),
        "XDG_CACHE_HOME": str(CACHE_DIR / "xdg"),
        "TMP": str(temp_dir),
        "TEMP": str(temp_dir),
    })
    return env


def _run(args: list[str], *, cwd: Path, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=str(cwd),
        env=_env(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
    )


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def _cuda_probe() -> dict:
    if not RUNTIME_PYTHON.is_file():
        return {"available": False, "reason": "runtime_missing"}
    code = (
        "import json, torch; "
        "ok=torch.cuda.is_available(); "
        "print(json.dumps({'available': bool(ok), "
        "'device': torch.cuda.get_device_name(0) if ok else '', "
        "'cuda': getattr(torch.version, 'cuda', '')}))"
    )
    try:
        completed = _run([str(RUNTIME_PYTHON), "-c", code], cwd=JJ_ROOT, timeout=20)
    except Exception as exc:
        return {"available": False, "reason": str(exc)}
    if completed.returncode != 0:
        return {"available": False, "reason": _tail(completed.stderr or completed.stdout, 600)}
    try:
        return json.loads(completed.stdout.strip().splitlines()[-1])
    except Exception:
        return {"available": False, "reason": _tail(completed.stdout, 600)}


def status() -> dict:
    paths = {
        "runtime": RUNTIME_PYTHON.is_file(),
        "checkout": CHECKOUT.is_dir(),
        "config": CONFIG.is_file(),
        "checkpoint": CHECKPOINT.is_file(),
    }
    checkpoint_sha = _sha256(CHECKPOINT) if CHECKPOINT.is_file() else ""
    cuda = _cuda_probe() if all(paths.values()) else {"available": False, "reason": "missing_files"}
    available = (
        all(paths.values())
        and checkpoint_sha == EXPECTED_CHECKPOINT_SHA256
        and bool(cuda.get("available"))
    )
    fallback = "Blender geometric split"
    reasons = []
    for key, ok in paths.items():
        if not ok:
            reasons.append(f"{key}_missing")
    if checkpoint_sha and checkpoint_sha != EXPECTED_CHECKPOINT_SHA256:
        reasons.append("checkpoint_sha_mismatch")
    if not cuda.get("available"):
        reasons.append("cuda_unavailable")
    return {
        "provider": "partfield-local",
        "available": available,
        "license": LICENSE,
        "fallback": fallback,
        "paths": {key: _rel(path) for key, path in {
            "runtime": RUNTIME_PYTHON,
            "checkout": CHECKOUT,
            "config": CONFIG,
            "checkpoint": CHECKPOINT,
            "cache": CACHE_DIR,
        }.items()},
        "checks": paths,
        "checkpointSha256": checkpoint_sha,
        "cuda": cuda,
        "warnings": reasons,
    }


def _failure(code: str, message: str, *, warnings: list[str] | None = None, report: dict | None = None) -> dict:
    return {
        "ok": False,
        "provider": "partfield-local",
        "status": code,
        "message": message,
        "warnings": warnings or [],
        "report": report or {},
    }


def _classify_failure(completed: subprocess.CompletedProcess[str], phase: str) -> dict:
    output = f"{completed.stdout or ''}\n{completed.stderr or ''}"
    lower = output.lower()
    if "out of memory" in lower or "cuda oom" in lower or "cublas_status_alloc_failed" in lower:
        code = "cuda_oom"
        message = f"PartField {phase} hit CUDA out-of-memory"
    else:
        code = f"{phase}_failed"
        message = f"PartField {phase} failed with exit code {completed.returncode}"
    return _failure(code, message, warnings=[_tail(output)])


def segment(glb_path: Path, run_dir: Path, *, target_level: int = 8, timeout: int = 420) -> dict:
    current = status()
    if not current["available"]:
        return _failure("unavailable", "PartField is not available", warnings=current.get("warnings", []), report=current)

    run_dir.mkdir(parents=True, exist_ok=True)
    run_id = run_dir.name.replace("-", "_")
    data_dir = run_dir / "partfield_input"
    split_dir = run_dir / "partfield_split"
    cluster_dir = run_dir / "partfield_clustering"
    for folder in (data_dir, split_dir, cluster_dir):
        if folder.exists():
            shutil.rmtree(folder)
        folder.mkdir(parents=True, exist_ok=True)
    source_glb = data_dir / "source.glb"
    shutil.copyfile(glb_path, source_glb)

    result_name = f"partfield_features/teacher_studio/{run_id}"
    feature_root = CHECKOUT / "exp_results" / result_name
    if feature_root.exists():
        shutil.rmtree(feature_root)

    started = time.time()
    try:
        inference = _run([
            str(RUNTIME_PYTHON),
            "partfield_inference.py",
            "-c",
            str(CONFIG),
            "--opts",
            "dataset.data_path",
            str(data_dir),
            "result_name",
            result_name,
            "continue_ckpt",
            str(CHECKPOINT),
        ], cwd=CHECKOUT, timeout=timeout)
    except subprocess.TimeoutExpired:
        return _failure("timeout", "PartField inference timed out")
    if inference.returncode != 0:
        return _classify_failure(inference, "inference")

    try:
        clustering = _run([
            str(RUNTIME_PYTHON),
            "run_part_clustering.py",
            "--root",
            str(feature_root),
            "--source_dir",
            str(data_dir),
            "--dump_dir",
            str(cluster_dir),
            "--max_num_clusters",
            "20",
            "--use_agglo",
            "True",
            "--export_mesh",
            "False",
        ], cwd=CHECKOUT, timeout=max(180, timeout // 2))
    except subprocess.TimeoutExpired:
        return _failure("timeout", "PartField clustering timed out")
    if clustering.returncode != 0:
        return _classify_failure(clustering, "clustering")

    label_dir = cluster_dir / "cluster_out"
    preferred = label_dir / f"source_0_{target_level:02d}.npy"
    label_path = preferred if preferred.is_file() else None
    if label_path is None:
        candidates = sorted(label_dir.glob("source_0_*.npy"))
        if not candidates:
            return _failure("no_labels", "PartField did not produce face labels")
        label_path = candidates[min(len(candidates) - 1, max(0, target_level - 1))]

    try:
        splitting = _run([
            str(RUNTIME_PYTHON),
            str(Path(__file__).with_name("partfield_split.py")),
            "--glb",
            str(source_glb),
            "--labels",
            str(label_path),
            "--out",
            str(split_dir),
            "--min-faces",
            "150",
        ], cwd=CHECKOUT, timeout=120)
    except subprocess.TimeoutExpired:
        return _failure("timeout", "PartField split timed out")
    split_report_path = split_dir / "parts.json"
    report = {}
    if split_report_path.is_file():
        try:
            report = json.loads(split_report_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            report = {}
    else:
        try:
            report = json.loads((splitting.stdout or "").strip().splitlines()[-1])
        except Exception:
            report = {}
    if splitting.returncode != 0 or report.get("status") != "completed":
        failure = _classify_failure(splitting, "split") if splitting.returncode != 0 else _failure("split_failed", "PartField split did not produce enough valid parts")
        failure["report"] = report
        return failure

    return {
        "ok": True,
        "provider": "partfield-local",
        "status": "completed",
        "labelPath": str(label_path),
        "splitDir": str(split_dir),
        "partsJson": str(split_report_path),
        "partCount": int(report.get("partCount") or len(report.get("parts") or [])),
        "hierarchical": bool(report.get("hierarchical", True)),
        "elapsedSeconds": round(time.time() - started, 2),
        "warnings": list(report.get("warnings") or []),
        "report": report,
    }
