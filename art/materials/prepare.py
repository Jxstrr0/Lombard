"""
Room surface textures for the bake (docs/04-ASSETS.md § Surface textures).

    python3 art/materials/prepare.py [--only parquet,plaster] [--cache art/out/materials]

For every material in bake/materials.py with a `texture` entry, downloads the
CC0 source (ambientCG 1K JPG), takes its colour map, and writes
bake/textures/<material>.jpg, normalised so its average equals the material's
authored `color` (the bake's light bounce and the lit tone stay as tuned):

  mode "scale"  per-channel scale; keeps the texture's own hue variation (wood, cork)
  mode "tint"   luminance only × the authored colour (plaster, paint, fabric),
                so a red or blue source can't leak its hue
  contrast      squeezes (<1) or stretches (>1) the variation around the mean

The outputs are committed: CI never downloads anything. Rerun only when a
texture entry changes. Needs Pillow and numpy (system Python, not Blender).
"""

from __future__ import annotations

import argparse
import io
import sys
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "bake"))
from materials import MATERIALS, hex_to_linear  # noqa: E402

OUT = ROOT / "bake" / "textures"


def srgb_to_linear(a: np.ndarray) -> np.ndarray:
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(a: np.ndarray) -> np.ndarray:
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)


def fetch(src: str, cache: Path) -> Image.Image:
    lib, asset = src.split(":", 1)
    if lib != "ambientcg":
        raise ValueError(f"unknown texture library {lib}")
    cache.mkdir(parents=True, exist_ok=True)
    zpath = cache / f"{asset}_1K-JPG.zip"
    if not zpath.exists():
        url = f"https://ambientcg.com/get?file={asset}_1K-JPG.zip"
        print(f"[materials] downloading {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "lombard-asset-prep"})
        zpath.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    with zipfile.ZipFile(zpath) as z:
        name = next(n for n in z.namelist() if n.endswith("_Color.jpg"))
        return Image.open(io.BytesIO(z.read(name))).convert("RGB")


def normalise(img: Image.Image, color: str, mode: str, contrast: float) -> np.ndarray:
    lin = srgb_to_linear(np.asarray(img, dtype=np.float64) / 255.0)
    target = np.array(hex_to_linear(color))
    if mode == "tint":
        lum = lin @ np.array([0.2126, 0.7152, 0.0722])
        rel = lum / max(lum.mean(), 1e-6)
        rel = 1 + (rel - 1) * contrast
        out = rel[..., None] * target
    elif mode == "scale":
        mean = lin.reshape(-1, 3).mean(axis=0)
        rel = lin / np.maximum(mean, 1e-6)
        rel = 1 + (rel - 1) * contrast
        out = rel * target
    else:
        raise ValueError(f"unknown mode {mode}")
    return linear_to_srgb(out)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--only", default="")
    p.add_argument("--cache", default=str(ROOT / "art" / "out" / "materials"))
    args = p.parse_args()
    only = {s for s in args.only.split(",") if s}
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in MATERIALS.items():
        tex = spec.get("texture")
        if not tex or (only and name not in only):
            continue
        img = fetch(tex["src"], Path(args.cache))
        size = tex.get("size", 512)
        img = img.resize((size, size), Image.LANCZOS)
        rgb = normalise(img, spec["color"], tex.get("mode", "scale"), tex.get("contrast", 1.0))
        out = OUT / f"{name}.jpg"
        Image.fromarray((rgb * 255 + 0.5).astype(np.uint8)).save(out, quality=90, optimize=True)
        print(f"[materials] {out.relative_to(ROOT)}: {size}px, {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
