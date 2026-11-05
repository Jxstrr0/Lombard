"""
Lenses: the Helios-44-2 58 mm f/2 in M42 screw mount.

Placeholder convention (src/render/items.ts): barrel r ≈ 0.0235 along Z, front
glass at +Z (0.0225), screw mount at −Z (to −0.0305). Hotspots: name ring /
front element (r 0.012 at the front), aperture ring (top, z 0.006), screw mount
(on the axis at the back, where the rear element sits).

`helios()` is also used by kinds/camera.py for the Zenit's kit lens (shorter
along Z, no thread, chrome "zebra" rings).
"""

from __future__ import annotations

import math

import lib
from kinds import _optics as op

AO_DISTANCE = 0.002

# Lens-local Z stations (front +Z), standalone size.
SHOULDER = -0.0235
FRONT = 0.0227
APEX = 0.0224


def helios(mats: dict, *, zebra: bool = False, rear: bool = True, serial: str = "8231507") -> None:
    """Build the Helios-44-2 round the Z axis, front at +Z.

    mats: barrel (black anodised), paint (white lettering), glass, dark (inside),
    and for `zebra` chrome + ink (black lettering on chrome); for `rear` silver (thread)."""
    black, paint, glass, dark = mats["barrel"], mats["paint"], mats["glass"], mats["dark"]
    chrome = mats.get("chrome", black) if zebra else black
    ink = mats.get("ink", paint) if zebra else paint
    on_chrome = ink if zebra else paint

    if rear:
        silver = mats["silver"]
        op.ring("mount.base", [(0.0162, -0.0303), (0.0166, -0.0305), (0.0190, -0.0305), (0.0196, -0.0300), (0.0196, SHOULDER)], silver, segments=64)
        op.ring("mount.inner", [(0.0127, -0.0303), (0.0162, -0.0303)], black, segments=64)
        op.thread("mount.thread", 0.01965, 0.0205, -0.0299, SHOULDER - 0.0003, 0.0009, silver, segments=40)
        op.cup("rear.inside", [(0.0128, -0.0270), (0.0124, -0.0150), (0.0060, -0.0120), (0, -0.0115)], dark, facing=-1)
        op.dome("rear.glass", 0.0124, -0.0301, 0.032, glass, facing=-1, segments=48)
        op.dome("rear.inner", 0.0100, -0.0190, 0.024, glass, facing=-1, segments=40, rings=4)

    # Shoulder and focusing grip
    op.ring("shoulder", [(0.0190, SHOULDER), (0.0218, SHOULDER), (0.0222, SHOULDER + 0.0004), (0.0222, -0.0205)], black)
    op.knurl("focus.grip", 0.0229, 0.0236, -0.0205, -0.0110, 60, black, caps=(0.0222, 0.0225), top=0.35)
    # Distance scale on the focusing ring
    op.ring("focus.scale", [(0.0225, -0.0110), (0.0231, -0.0107), (0.0231, -0.0049), (0.0226, -0.0046)], chrome)
    dists = ["∞", "10", "5", "3", "2", "1,5", "1", "0,7", "0,5"]
    for i, s in enumerate(dists):
        op.cyl_text(f"dist.{i}", s, 0.0231, -0.0078, math.radians(i * 21), 0.0019 if s == "∞" else 0.0016, 0.00004, on_chrome, bold=1.2)
    # Fixed depth-of-field ring with the index
    op.ring("dof", [(0.0226, -0.0046), (0.0226, -0.0021)], black)
    op.tick("dof.index", 0.0226, -0.0046, -0.0027, 0.0, 0.0003, 0.00004, paint)
    for i, s in enumerate(["16", "8", "4", "4", "8", "16"]):
        a = math.radians((-1 if i < 3 else 1) * (6 + 6 * (2 - i if i < 3 else i - 3)))
        op.cyl_text(f"dofn.{i}", s, 0.0226, -0.0033, a, 0.0011, 0.00004, paint)
    # Preset ring (ribbed) and aperture scale ring
    op.knurl("preset", 0.0229, 0.0235, -0.0021, 0.0040, 64, chrome, caps=(0.0226, 0.0226), top=0.45, chamfer=0.0003)
    op.ring("aperture", [(0.0226, 0.0040), (0.0232, 0.0043), (0.0232, 0.0113), (0.0227, 0.0117)], chrome)
    stops = ["16", "11", "8", "5,6", "4", "2,8", "2"]
    for i, s in enumerate(stops):
        op.cyl_text(f"stop.{i}", s, 0.0232, 0.0080, math.radians(-54 + i * 18), 0.0017, 0.00004, on_chrome, bold=1.2)
    op.tick("aperture.index", 0.0226, 0.0118, 0.0135, 0.0, 0.0004, 0.00004, paint)

    # Front barrel, name ring and retaining ring
    op.ring(
        "front",
        [
            (0.0227, 0.0117),
            (0.0226, 0.0130),
            (0.0223, 0.0214),
            (0.0224, 0.0218),
            (0.0224, FRONT - 0.0003),
            (0.0221, FRONT),
            (0.0207, FRONT),
            (0.0205, 0.0222),
            (0.0140, 0.0222),
            (0.0124, 0.0219),
            (0.0118, 0.0214),
            (0.0116, 0.0192),
        ],
        black,
    )
    op.flatten(lib.arc_text("name", f"ГЕЛИОС-44-2  2/58  № {serial}", 0.0172, 0.0019, 0.00005, paint, z=0.0222, start=math.pi / 2, spacing=0.7))
    op.flatten(lib.arc_text("made", "СДЕЛАНО В СССР", 0.0172, 0.0014, 0.00004, paint, z=0.0222, start=-math.pi / 2, inward=True, spacing=0.7))

    # Glass: front element over a dark interior, an inner element catching light
    op.cup("front.inside", [(0.0116, 0.0192), (0.0108, 0.0120), (0.0090, 0.0060), (0, 0.0050)], dark)
    op.dome("front.inner", 0.0100, 0.0128, 0.024, glass, segments=40, rings=4)
    op.dome("front.glass", 0.0118, APEX, 0.030, glass)


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    mats = {
        "barrel": lib.material(it, "barrel", it.color, metal=0.15, rough=0.4),
        "paint": lib.material(it, "paint", "#ebe8de", rough=0.55, ao=False),
        "silver": lib.material(it, "silver", "#bdbdb8", metal=1.0, rough=0.3),
        "glass": lib.material(it, "glass", "#a8742c", metal=0.7, rough=0.05, alpha=0.32, ao=False),
        "dark": lib.material(it, "dark", "#050505", rough=0.65, ao=False),
    }
    helios(mats, rear=True)
