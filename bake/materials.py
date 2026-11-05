"""
Shop materials for the bake.

Each entry is the single source of truth for a static surface: Blender uses
the colour/roughness/metalness for the light bounce, and the exported glTF
material carries `kind` (and its texture) as extras so the game knows how to draw
it (see src/render/bakedShop.ts).

kind:
  baked    diffuse surface; gets the lightmap (uv1) and is drawn unlit-plus-
           lightmap at runtime (MeshBasicMaterial), so the two real-time
           lights don't light it twice
  dynamic  metal / glossy; not in the lightmap, lit at runtime by the env map
           and the two real-time lights (still casts shadows in the bake)
  glass    transparent; hidden during the bake (light passes), drawn
           transparent at runtime
  unlit    emissive or tiny (bulbs, door glass, cords); hidden during the
           bake, drawn flat colour at runtime

texture: optional tiling colour map for a baked surface. art/materials/prepare.py
  downloads `src` (CC0) once and writes bake/textures/<material>.jpg, normalised
  so its average is `color`; the bake maps it on uv0 at `tile` metres per
  repeat and the glb carries it to the game (KTX2 after bake-pack).
Colours are sRGB hex like the rest of the codebase. A textured surface's
texture is normalised to average `color`, so the bounce colour stays right.
"""

MATERIALS = {
    # room shell
    "parquet": {"color": "#5c3d28", "roughness": 0.62, "kind": "baked", "texture": {"src": "ambientcg:WoodFloor034", "tile": 1.1, "size": 1024, "mode": "scale"}},
    "plaster": {"color": "#e9e0cc", "roughness": 0.95, "kind": "baked", "texture": {"src": "ambientcg:Plaster001", "tile": 2.0, "size": 1024, "mode": "tint", "contrast": 1.6}},
    "ceiling": {"color": "#c9c1b0", "roughness": 1.0, "kind": "baked", "texture": {"src": "ambientcg:Plaster002", "tile": 2.0, "size": 512, "mode": "tint", "contrast": 1.5}},
    "dado": {"color": "#33473f", "roughness": 0.45, "kind": "baked", "texture": {"src": "ambientcg:PaintedPlaster017", "tile": 1.5, "size": 512, "mode": "tint", "contrast": 2.0}},
    "dado_rail": {"color": "#1f2b26", "roughness": 0.5, "kind": "baked"},
    "skirting": {"color": "#2a1c14", "roughness": 0.7, "kind": "baked"},
    # counter
    "counter_wood": {"color": "#3b2417", "roughness": 0.55, "kind": "baked", "texture": {"src": "ambientcg:Wood051", "tile": 1.0, "size": 512, "mode": "scale"}},
    "felt": {"color": "#2d3a2c", "roughness": 1.0, "kind": "baked", "texture": {"src": "ambientcg:Fabric034", "tile": 0.5, "size": 256, "mode": "tint"}},
    "mat_rubber": {"color": "#1c2a24", "roughness": 0.9, "kind": "baked", "texture": {"src": "ambientcg:Rubber001", "tile": 0.5, "size": 256, "mode": "tint", "contrast": 0.6}},
    "brass": {"color": "#b08a45", "roughness": 0.35, "metalness": 1.0, "kind": "dynamic"},
    "gold": {"color": "#d4a64a", "roughness": 0.25, "metalness": 1.0, "kind": "dynamic"},
    "steel": {"color": "#b9bcbf", "roughness": 0.3, "metalness": 1.0, "kind": "dynamic"},
    "glass": {"color": "#dfeee8", "roughness": 0.05, "kind": "glass", "opacity": 0.18},
    # cases and shelves
    "case_wood": {"color": "#4a2f1e", "roughness": 0.6, "kind": "baked", "texture": {"src": "ambientcg:Wood066", "tile": 1.0, "size": 512, "mode": "scale"}},
    "box_dark": {"color": "#222222", "roughness": 0.5, "kind": "baked"},
    "box_grey": {"color": "#5a5148", "roughness": 0.5, "kind": "baked"},
    "prop_brown": {"color": "#6b4b2e", "roughness": 0.5, "kind": "baked"},
    "prop_slate": {"color": "#2f3438", "roughness": 0.5, "kind": "baked"},
    "prop_sand": {"color": "#8a7a64", "roughness": 0.5, "kind": "baked"},
    "prop_plum": {"color": "#3c2a3a", "roughness": 0.5, "kind": "baked"},
    # window, door, fixtures
    "frame": {"color": "#e7e1d3", "roughness": 0.6, "kind": "baked"},
    "sign_board": {"color": "#2a201a", "roughness": 0.8, "kind": "baked"},
    "door_paint": {"color": "#2c3b35", "roughness": 0.55, "kind": "baked", "texture": {"src": "ambientcg:PaintedWood007A", "tile": 1.0, "size": 512, "mode": "tint"}},
    # see-through so the canal backdrop shows in the door, like the window
    "door_glass": {"color": "#dfe8ea", "roughness": 0.05, "kind": "glass", "opacity": 0.12},
    "radiator": {"color": "#d9d4c7", "roughness": 0.5, "kind": "baked"},
    "cord": {"color": "#111111", "kind": "unlit"},
    "shade": {"color": "#2b2b26", "roughness": 0.6, "metalness": 0.3, "kind": "dynamic", "doubleSided": True},
    "bulb": {"color": "#ffd8a0", "kind": "unlit", "emissive": True},
    "lamp_metal": {"color": "#1f3a2c", "roughness": 0.4, "metalness": 0.6, "kind": "dynamic"},
    "safe": {"color": "#3a3d3a", "roughness": 0.45, "metalness": 0.7, "kind": "dynamic"},
    "office_door": {"color": "#4a3526", "roughness": 0.6, "kind": "baked", "texture": {"src": "ambientcg:PaintedWood005", "tile": 1.0, "size": 512, "mode": "scale", "contrast": 0.8}},
    "cork": {"color": "#8f6a45", "roughness": 0.95, "kind": "baked", "texture": {"src": "ambientcg:Cork003", "tile": 0.5, "size": 256, "mode": "scale"}},
    "tag_paper": {"color": "#e8e0c8", "roughness": 0.9, "kind": "baked"},
    # back room (storeroom)
    "lino": {"color": "#5b5a4c", "roughness": 0.7, "kind": "baked", "texture": {"src": "ambientcg:Tiles131", "tile": 1.2, "size": 512, "mode": "tint", "contrast": 0.7}},
    "plaster_back": {"color": "#c8cbbb", "roughness": 0.95, "kind": "baked", "texture": {"src": "ambientcg:PaintedPlaster015", "tile": 2.0, "size": 1024, "mode": "tint"}},
    "shelf_metal": {"color": "#5f6462", "roughness": 0.55, "kind": "baked"},
    "cardboard": {"color": "#9a7a52", "roughness": 0.9, "kind": "baked", "texture": {"src": "ambientcg:Cardboard004", "tile": 0.8, "size": 512, "mode": "scale"}},
}

KINDS = {"baked", "dynamic", "glass", "unlit"}


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b))


def validate() -> None:
    for name, m in MATERIALS.items():
        if m["kind"] not in KINDS:
            raise ValueError(f"material {name}: unknown kind {m['kind']}")
        if m["kind"] == "baked" and m.get("metalness", 0) > 0.5:
            raise ValueError(f"material {name}: a metal can't be lightmapped; use kind 'dynamic'")
        tex = m.get("texture")
        if tex:
            if m["kind"] != "baked":
                raise ValueError(f"material {name}: only baked surfaces take a texture")
            if tex.get("mode", "scale") not in ("scale", "tint") or tex["tile"] <= 0:
                raise ValueError(f"material {name}: bad texture entry {tex}")
