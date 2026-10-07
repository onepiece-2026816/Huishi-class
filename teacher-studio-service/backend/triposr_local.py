"""Run the cached TripoSR weights locally without a paid inference service."""
from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from threading import Lock


PROJECT = Path(__file__).resolve().parents[2]
INSTALL = PROJECT / ".local-3d"
PYTHON = INSTALL / "venv" / "Scripts" / "python.exe"
SOURCE = INSTALL / "TripoSR"
CACHE = INSTALL / "cache"
INFERENCE_LOCK = Lock()


def available() -> bool:
    snapshots = CACHE / "huggingface" / "hub" / "models--stabilityai--TripoSR" / "snapshots"
    return (PYTHON.is_file() and (SOURCE / "run.py").is_file()
            and any((snap / "model.ckpt").is_file() and (snap / "config.yaml").is_file()
                    for snap in snapshots.glob("*"))
            and (CACHE / "u2net" / "u2net.onnx").is_file())


def reconstruct(raw: bytes) -> bytes:
    if not available():
        raise RuntimeError("本地 TripoSR 权重尚未安装完整；已停止生成，不会回退到粗糙体素模型")
    with tempfile.TemporaryDirectory(prefix="triposr_", dir=INSTALL) as folder:
        work = Path(folder)
        image = work / "input.png"
        image.write_bytes(raw)
        env = os.environ.copy()
        env.update({
            "PYTHONPATH": str(SOURCE),
            "HF_HOME": str(CACHE / "huggingface"),
            "U2NET_HOME": str(CACHE / "u2net"),
            "HF_HUB_OFFLINE": "1",
            "TRANSFORMERS_OFFLINE": "1",
        })
        command = [str(PYTHON), str(SOURCE / "run.py"), str(image),
                   "--output-dir", str(work / "output"), "--mc-resolution", "192",
                   "--model-save-format", "glb", "--chunk-size", "4096"]
        # Serialize GPU work so simultaneous private jobs cannot exhaust VRAM.
        with INFERENCE_LOCK:
            completed = subprocess.run(command, env=env, cwd=SOURCE, capture_output=True,
                                       text=True, encoding="utf-8", errors="replace",
                                       timeout=600, check=False)
        result = work / "output" / "0" / "mesh.glb"
        if completed.returncode or not result.is_file():
            raise RuntimeError("本地 TripoSR 重建失败：" + (completed.stderr or completed.stdout)[-1200:])
        return result.read_bytes()
