"""
The canal outside the shop: street, granite embankments with cast-iron
railings, the canal, a humpbacked bridge, and the far bank's row of
19th-century facades with a side street opening behind the bridge.

All positions are three.js coordinates (metres, y up, x across the shop with +x
on the player's left when facing the street, z from the shop towards the far
bank; the shop's street wall is z = 4..4.1). Sizes are chosen so the view from
the player's eye (0, 1.62, -3.2) through a ground-floor window reads well:
see LAYOUT notes in docs/04-ASSETS.md § Canal backdrop.
"""

from __future__ import annotations

import math
import random

import bpy

from geo import Geo, text_mesh

# --- layout -------------------------------------------------------------------

WALL_Z = 4.1  # outer face of the shop's street wall
KERB_Z = 6.3  # shop pavement -> cobbled lane
WALK_Z = 9.7  # lane -> embankment walk
COPING_Z = 10.7  # coping slab from here to NEAR_EDGE_Z
NEAR_EDGE_Z = 11.15  # near canal wall face
FAR_EDGE_Z = 41.15  # far canal wall face (canal 30 m wide)
FAR_COPING_Z = 41.6
FAR_WALK_Z = 43.1
FAR_ROAD_Z = 49.1
FACADE_Z = 51.1
WALK_TOP = 0.12
COPING_TOP = 0.22
RAIL_TOP = 1.2
# Spring water, about a metre below the coping. From a ground-floor shop the
# window sill hides everything nearer than ~20 m, so a lower canal would leave
# only a sliver of water in view.
WATER_Y = -0.65

BRIDGE_X0, BRIDGE_X1 = -15.5, -7.5  # deck, three.js x (screen right of the window)
STREET_X0, STREET_X1 = -18.0, -6.5  # side street opening on the far bank, behind the bridge
BRIDGE_ZC = (NEAR_EDGE_Z + FAR_EDGE_Z) / 2
BRIDGE_HUMP = 1.25

PEDESTAL_STEP = 3.6


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(hex_color: str) -> tuple[float, float, float, float]:
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


# --- materials ------------------------------------------------------------------

# St Petersburg pastels, sRGB albedo.
PLASTER = {
    "ochre": "#d8b064",
    "yellow": "#e3cc7c",
    "mint": "#a8cbb2",
    "salmon": "#dc9e88",
    "blue": "#a6bfd0",
    "cream": "#e8dcbc",
    "pink": "#d8a0a4",
    "sage": "#b4c29a",
    "lilac": "#bcb0c8",
    "grey": "#c4c0b6",
}
TRIM = {"white": "#ece8de", "cream": "#e4d8b8", "stone": "#cfc7b6"}
SIGNS = {"green": "#1f4a38", "blue": "#1d3550", "red": "#6e2420", "brown": "#3e2a1c", "cream": "#e8dfc6"}
LETTERS = {"white": "#f2efe6", "gold": "#d9b45a", "dark": "#2a2420", "red": "#a8302a"}
ROOFS = {"grey": "#5b605f", "green": "#4f6b5c", "red": "#7a4636", "dark": "#3c403f"}


class Mats:
    def __init__(self) -> None:
        self.m: dict[str, bpy.types.Material] = {}
        self._build()

    def __getitem__(self, k: str) -> bpy.types.Material:
        return self.m[k]

    # node helpers
    @staticmethod
    def _new(name: str):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
        return mat, nt, bsdf

    @staticmethod
    def _pos(nt):
        return nt.nodes.new("ShaderNodeNewGeometry").outputs["Position"]

    @staticmethod
    def _noise(nt, vec, scale: tuple[float, float, float], detail: float = 3.0, roughness: float = 0.55):
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = scale
        nt.links.new(vec, mp.inputs["Vector"])
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 1.0
        nz.inputs["Detail"].default_value = detail
        nz.inputs["Roughness"].default_value = roughness
        nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
        return nz.outputs["Fac"]

    @staticmethod
    def _range(nt, value, a0: float, a1: float, b0: float, b1: float, smooth: bool = False):
        mr = nt.nodes.new("ShaderNodeMapRange")
        if smooth:
            mr.interpolation_type = "SMOOTHSTEP"
        mr.clamp = True
        nt.links.new(value, mr.inputs["Value"])
        mr.inputs["From Min"].default_value = a0
        mr.inputs["From Max"].default_value = a1
        mr.inputs["To Min"].default_value = b0
        mr.inputs["To Max"].default_value = b1
        return mr.outputs["Result"]

    @staticmethod
    def _mul(nt, a, b):
        m = nt.nodes.new("ShaderNodeMath")
        m.operation = "MULTIPLY"
        nt.links.new(a, m.inputs[0])
        if isinstance(b, float):
            m.inputs[1].default_value = b
        else:
            nt.links.new(b, m.inputs[1])
        return m.outputs["Value"]

    @staticmethod
    def _scale(nt, color, factor):
        vm = nt.nodes.new("ShaderNodeVectorMath")
        vm.operation = "SCALE"
        if isinstance(color, tuple):
            vm.inputs[0].default_value = color[:3]
        else:
            nt.links.new(color, vm.inputs[0])
        nt.links.new(factor, vm.inputs["Scale"])
        return vm.outputs["Vector"]

    @staticmethod
    def _z(nt, pos):
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(pos, sep.inputs[0])
        return sep

    def weathered(self, name: str, hex_color: str, rough: float = 0.85, streaks: float = 0.22, ground_dirt: float = 0.25, ao: float = 0.45) -> None:
        """Painted plaster or stone: vertical rain streaks, mottling, crevice grime, dirt near the ground."""
        mat, nt, bsdf = self._new(name)
        pos = self._pos(nt)
        streak = self._noise(nt, pos, (0.9, 0.9, 0.09), detail=4.0)
        mottle = self._noise(nt, pos, (3.5, 3.5, 3.5), detail=2.0)
        f1 = self._range(nt, streak, 0.3, 0.7, 1.0 - streaks, 1.0 + streaks * 0.3)
        f2 = self._range(nt, mottle, 0.3, 0.7, 0.93, 1.04)
        sep = self._z(nt, pos)
        f3 = self._range(nt, sep.outputs["Z"], 0.0, 1.8, 1.0 - ground_dirt, 1.0, smooth=True)
        aon = nt.nodes.new("ShaderNodeAmbientOcclusion")
        aon.samples = 8
        aon.inputs["Distance"].default_value = 0.5
        f4 = self._range(nt, aon.outputs["AO"], 0.0, 1.0, 1.0 - ao, 1.0)
        f = self._mul(nt, self._mul(nt, self._mul(nt, f1, f2), f3), f4)
        col = self._scale(nt, lin(hex_color), f)
        nt.links.new(col, bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = rough
        self.m[name] = mat

    def flat(self, name: str, hex_color: str, rough: float = 0.6, metal: float = 0.0, emission: tuple[str, float] | None = None, spec: float = 0.5, coat: float = 0.0, transmission: float = 0.0) -> None:
        mat, nt, bsdf = self._new(name)
        if transmission:
            bsdf.inputs["Transmission Weight"].default_value = transmission
            bsdf.inputs["IOR"].default_value = 1.5
        bsdf.inputs["Base Color"].default_value = lin(hex_color)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Specular IOR Level"].default_value = spec
        if coat:
            bsdf.inputs["Coat Weight"].default_value = coat
            bsdf.inputs["Coat Roughness"].default_value = 0.03
        if emission:
            bsdf.inputs["Emission Color"].default_value = lin(emission[0])
            bsdf.inputs["Emission Strength"].default_value = emission[1]
        self.m[name] = mat

    def granite(self, name: str, a: str, b: str, joints: bool = True) -> None:
        """Rapakivi-ish granite blocks with joints, darker and greener where wet near the waterline."""
        mat, nt, bsdf = self._new(name)
        pos = self._pos(nt)
        speck = self._noise(nt, pos, (6, 6, 6), detail=6.0, roughness=0.7)
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        nt.links.new(speck, mix.inputs["Factor"])
        mix.inputs["A"].default_value = lin(a)
        mix.inputs["B"].default_value = lin(b)
        col = mix.outputs["Result"]
        sep = self._z(nt, pos)
        if joints:
            # brick coordinates (x + y, z): works on faces looking along either horizontal axis
            add = nt.nodes.new("ShaderNodeMath")
            add.operation = "ADD"
            nt.links.new(sep.outputs["X"], add.inputs[0])
            nt.links.new(sep.outputs["Y"], add.inputs[1])
            comb = nt.nodes.new("ShaderNodeCombineXYZ")
            nt.links.new(add.outputs[0], comb.inputs["X"])
            nt.links.new(sep.outputs["Z"], comb.inputs["Y"])
            br = nt.nodes.new("ShaderNodeTexBrick")
            br.inputs["Scale"].default_value = 1.0
            br.inputs["Mortar Size"].default_value = 0.012
            br.inputs["Brick Width"].default_value = 1.25
            br.inputs["Row Height"].default_value = 0.45
            br.offset = 0.5
            nt.links.new(comb.outputs[0], br.inputs["Vector"])
            nt.links.new(col, br.inputs["Color1"])
            nt.links.new(col, br.inputs["Color2"])
            br.inputs["Mortar"].default_value = (0.08, 0.075, 0.07, 1)
            col = br.outputs["Color"]
        # wet band: from 1 m above the water down
        wet = self._range(nt, sep.outputs["Z"], WATER_Y + 1.1, WATER_Y + 0.05, 1.0, 0.42, smooth=True)
        aon = nt.nodes.new("ShaderNodeAmbientOcclusion")
        aon.samples = 8
        aon.inputs["Distance"].default_value = 0.4
        f = self._mul(nt, wet, self._range(nt, aon.outputs["AO"], 0, 1, 0.6, 1.0))
        out = self._scale(nt, col, f)
        nt.links.new(out, bsdf.inputs["Base Color"])
        rough = self._range(nt, sep.outputs["Z"], WATER_Y + 0.6, WATER_Y, 0.8, 0.35)
        nt.links.new(rough, bsdf.inputs["Roughness"])
        self.m[name] = mat

    def water(self) -> None:
        mat, nt, bsdf = self._new("water")
        bsdf.inputs["Base Color"].default_value = lin("#1b2523")
        bsdf.inputs["Roughness"].default_value = 0.035
        bsdf.inputs["IOR"].default_value = 1.333
        pos = self._pos(nt)
        n1 = self._noise(nt, pos, (0.5, 2.6, 1.0), detail=6.0, roughness=0.62)
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.3
        bump.inputs["Distance"].default_value = 0.04
        nt.links.new(n1, bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
        aov = nt.nodes.new("ShaderNodeOutputAOV")
        aov.aov_name = "water"
        aov.inputs["Value"].default_value = 1.0
        self.m["water"] = mat

    def _build(self) -> None:
        for k, v in PLASTER.items():
            self.weathered(f"plaster_{k}", v)
        for k, v in TRIM.items():
            self.weathered(f"trim_{k}", v, streaks=0.18, ao=0.5)
        self.weathered("plinth", "#7d736b", rough=0.8, streaks=0.1, ground_dirt=0.15)
        self.weathered("chimney", "#a89a8a", streaks=0.35, ground_dirt=0.0)
        self.weathered("side_plaster", "#c9b99a", streaks=0.25)
        self.granite("granite", "#5e4f4a", "#7a6760")
        self.granite("granite_plain", "#64544e", "#7d6a62", joints=False)
        self.water()
        self.flat("iron", "#141414", rough=0.42, metal=0.55)
        self.flat("tin", "#8a8e8c", rough=0.45, metal=0.5)
        self.flat("lamp_glass", "#d9d6cc", rough=0.25)
        self.flat("asphalt", "#3d3c3a", rough=0.92)
        self.flat("pavement", "#6a6660", rough=0.9)
        for k, v in ROOFS.items():
            self.flat(f"roof_{k}", v, rough=0.5, metal=0.35)
        self.flat("frame_white", "#e8e6df", rough=0.5)
        self.flat("frame_brown", "#3a2a20", rough=0.5)
        self.flat("frame_green", "#22382e", rough=0.5)
        # Window glass: the sky reflection does most of the work; the base colour is the room behind.
        self.flat("glass_dark", "#0e1012", rough=0.04, spec=0.6)
        self.flat("glass_room", "#3a332c", rough=0.05, spec=0.6)
        self.flat("glass_curtain", "#bdb6a6", rough=0.08, spec=0.5, coat=0.6)
        self.flat("glass_lit", "#4a3c2c", rough=0.05, spec=0.6, emission=("#ffd9a0", 0.35))
        # shop windows are real glass in front of a lit interior
        self.flat("shop_glass", "#ffffff", rough=0.0, transmission=1.0)
        self.flat("shop_back", "#d9cdb4", rough=0.9, emission=("#ffe3b8", 0.16))
        self.flat("shop_tube", "#ffffff", rough=0.5, emission=("#fff4e0", 6.0))
        self.flat("shop_floor", "#4a4038", rough=0.7)
        self.flat("shop_shelf", "#3a2c22", rough=0.7)
        for i, c in enumerate(("#8a3b30", "#3d5a78", "#c9b48a", "#4d6b48", "#d8d4c8", "#6a4a6e", "#b07a3a")):
            self.flat(f"goods_{i}", c, rough=0.6)
        for k, v in SIGNS.items():
            self.flat(f"sign_{k}", v, rough=0.45, coat=0.3)
        for k, v in LETTERS.items():
            self.flat(f"letters_{k}", v, rough=0.4, metal=0.3 if k == "gold" else 0.0)
        self.flat("awning", "#6e2a26", rough=0.85)
        self.flat("dome_gold", "#c9a24a", rough=0.3, metal=1.0)
        self.flat("boat_hull", "#1e3a44", rough=0.35, coat=0.5)
        self.flat("boat_trim", "#d9d3c4", rough=0.5)
        self.flat("boat_motor", "#2a2a2c", rough=0.4)
        self.weathered("tarp", "#6c705f", rough=0.9, streaks=0.15, ground_dirt=0.0, ao=0.3)
        self.flat("tree", "#2b2520", rough=0.9)


# --- embankments, railings, lamps ---------------------------------------------


def railing(geo: Geo, z: float, x_from: float, x_to: float, base_y: float, posts: bool = True, phase: float = 0.0) -> None:
    """Cast-iron railing panels between granite pedestals along x, on a coping at base_y."""
    top = base_y + (RAIL_TOP - COPING_TOP)
    xs = []
    x = math.floor((x_from - phase) / PEDESTAL_STEP) * PEDESTAL_STEP + phase
    while x <= x_to:
        xs.append(x)
        x += PEDESTAL_STEP
    for x in xs:
        if posts:
            geo.box("granite_plain", (x, base_y + 0.55, z), (0.36, 1.1, 0.36))
            geo.box("granite_plain", (x, base_y + 1.14, z), (0.44, 0.08, 0.44))
            geo.box("granite_plain", (x, base_y + 1.21, z), (0.32, 0.06, 0.32))
    for a, b in zip(xs[:-1], xs[1:]):
        x0, x1 = a + 0.2, b - 0.2
        w = x1 - x0
        geo.box("iron", ((x0 + x1) / 2, top - 0.03, z), (w, 0.05, 0.06))  # handrail
        geo.box("iron", ((x0 + x1) / 2, base_y + 0.1, z), (w, 0.04, 0.035))  # bottom rail
        # the ornament sits high, under the handrail, so the water shows between plain bars
        geo.box("iron", ((x0 + x1) / 2, top - 0.27, z), (w, 0.025, 0.03))
        n = max(2, int(w / 0.15))
        for i in range(n + 1):
            bx = x0 + w * i / n
            geo.box("iron", (bx, (base_y + 0.1 + top) / 2, z), (0.018, top - base_y - 0.1, 0.02))
        # band of roundels between the upper rail and the handrail
        for i in range(n):
            bx = x0 + w * (i + 0.5) / n
            geo.ring_xy("iron", (bx, top - 0.155, z), 0.068, 0.014, seg=12)


def lamp_post(geo: Geo, x: float, y: float, z: float, height: float = 3.9, twin: bool = False) -> None:
    """Cast-iron embankment lamp: fluted base, tapering column, one or two lanterns."""
    geo.lathe("iron", (x, y, z), [(0.2, 0.0), (0.2, 0.08), (0.15, 0.12), (0.15, 0.5), (0.1, 0.62), (0.08, 0.75)], seg=12)
    geo.cylinder("iron", (x, y + 0.75, z), 0.07, height - 0.75, seg=10, r_top=0.05)
    geo.lathe("iron", (x, y + height, z), [(0.07, 0.0), (0.11, 0.06), (0.06, 0.14)], seg=10)
    top = y + height + 0.14
    if twin:
        geo.box("iron", (x, top + 0.05, z), (0.06, 0.04, 1.0))
    for hz in (z - 0.45, z + 0.45) if twin else (z,):
        hx, ly = x, top
        geo.lathe("iron", (hx, ly, hz), [(0.04, 0.0), (0.1, 0.05), (0.1, 0.08)], seg=10)
        geo.cylinder("lamp_glass", (hx, ly + 0.08, hz), 0.14, 0.42, seg=12, r_top=0.17)
        geo.lathe("iron", (hx, ly + 0.5, hz), [(0.2, 0.0), (0.12, 0.12), (0.03, 0.22), (0.0, 0.3)], seg=12)


def embankments(geo: Geo) -> None:
    big = 120.0
    # near bank: shop pavement, road, embankment walk, coping, canal wall
    geo.span("pavement", -big, big, -0.3, WALK_TOP, WALL_Z, KERB_Z)
    geo.span("asphalt", -big, big, -0.3, 0.0, KERB_Z, WALK_Z)
    geo.span("pavement", -big, big, -0.3, WALK_TOP, WALK_Z, COPING_Z)
    geo.span("granite", -big, big, -3.0, COPING_TOP, COPING_Z, NEAR_EDGE_Z)
    # far bank
    geo.span("granite", -big, big, -3.0, COPING_TOP, FAR_EDGE_Z, FAR_COPING_Z)
    geo.span("pavement", -big, big, -0.3, WALK_TOP, FAR_COPING_Z, FAR_WALK_Z)
    geo.span("asphalt", -big, big, -0.3, 0.0, FAR_WALK_Z, FAR_ROAD_Z)
    geo.span("pavement", -big, big, -0.3, WALK_TOP, FAR_ROAD_Z, FACADE_Z + 0.2)
    # canal bed under the water (only seen through the arch)
    geo.span("granite_plain", -big, big, -3.2, -3.0, NEAR_EDGE_Z, FAR_EDGE_Z)
    # water
    geo.span("water", -big, big, WATER_Y - 0.2, WATER_Y, NEAR_EDGE_Z - 0.01, FAR_EDGE_Z + 0.01)

    # railings: near bank to the left of the bridge, far bank both sides
    near_z = (COPING_Z + NEAR_EDGE_Z) / 2
    far_z = (FAR_EDGE_Z + FAR_COPING_Z) / 2
    railing(geo, near_z, BRIDGE_X1 + 0.6, 22.0, COPING_TOP, phase=1.8)  # a pedestal hides behind the window mullion
    railing(geo, far_z, BRIDGE_X1 + 0.6, 40.0, COPING_TOP)
    railing(geo, far_z, -60.0, BRIDGE_X0 - 0.6, COPING_TOP)

    # lamps on the walks, between pedestals
    lamp_post(geo, 2.7, WALK_TOP, COPING_Z - 0.35)
    lamp_post(geo, 20.7, WALK_TOP, COPING_Z - 0.35)
    for x in (-1.8, 16.2, -27.0, -45.0):
        lamp_post(geo, x, WALK_TOP, FAR_COPING_Z + 0.35)

    # mooring rings and a drain outlet on the far wall
    for x in (-3.0, 6.9, 16.8):
        geo.ring_xy("iron", (x, WATER_Y + 0.9, FAR_EDGE_Z - 0.03), 0.11, 0.025, seg=12)
    # descent to the water on the far bank: granite steps along the wall, going down towards -x
    for i in range(8):
        y = COPING_TOP - 0.16 * (i + 1)
        geo.span("granite", 8.0, 13.0 - 0.34 * i, -3.0, y, FAR_EDGE_Z - 1.5, FAR_EDGE_Z)


def boat(geo: Geo, x0: float, x1: float) -> None:
    """A small motor launch moored along the far wall, bow towards +x, under a canvas cover."""
    zf = FAR_EDGE_Z - 0.35  # wall side, fenders' width off the granite
    beam = 1.9
    zn = zf - beam
    zm = (zf + zn) / 2
    bow = 1.7
    hull = [(x0, zn), (x1 - bow, zn), (x1 - bow * 0.35, zm - beam * 0.32), (x1, zm), (x1 - bow * 0.35, zm + beam * 0.32), (x1 - bow, zf), (x0, zf)]
    top = WATER_Y + 0.55
    geo.prism_y("boat_hull", hull, WATER_Y - 0.4, top)
    grow = [(x - 0.04 if x == x0 else (x + 0.05 if x == x1 else x), z + (0.04 if z > zm + 0.01 else (-0.04 if z < zm - 0.01 else 0.0))) for x, z in hull]
    geo.prism_y("boat_trim", grow, top - 0.02, top + 0.06)
    geo.span("boat_trim", x0 + 0.2, x1 - bow, WATER_Y + 0.04, WATER_Y + 0.12, zn - 0.015, zn + 0.02)  # boot stripe
    # canvas cover over the cockpit, a windscreen in front of it
    c0, c1 = x0 + 0.25, x1 - bow - 0.6
    geo.span("tarp", c0, c1, top, top + 0.42, zn + 0.15, zf - 0.15)
    geo.prism_x("tarp", [(zn + 0.15, top + 0.42), (zf - 0.15, top + 0.42), (zf - 0.45, top + 0.62), (zn + 0.45, top + 0.62)], c0, c1)
    geo.span("glass_dark", c1, c1 + 0.08, top, top + 0.45, zn + 0.3, zf - 0.3)
    geo.span("boat_trim", c1 - 0.02, c1 + 0.1, top + 0.45, top + 0.5, zn + 0.28, zf - 0.28)
    # outboard motor on the transom
    geo.span("boat_motor", x0 - 0.45, x0 - 0.05, top - 0.1, top + 0.45, zm - 0.22, zm + 0.22)
    geo.span("boat_motor", x0 - 0.3, x0 - 0.18, WATER_Y - 0.3, top - 0.1, zm - 0.06, zm + 0.06)
    # mooring line from the bow to a ring on the wall
    seg_box(geo, (x1 - 0.3, top + 0.05, zm + 0.3), (x1 + 1.2, WATER_Y + 0.9, FAR_EDGE_Z - 0.03), 0.012, "tarp")


def deck_y(z: float) -> float:
    half = (FAR_WALK_Z - WALK_Z) / 2 + 0.8
    t = (z - BRIDGE_ZC) / half
    return WALK_TOP + BRIDGE_HUMP * max(0.0, 1 - t * t)


def bridge(geo: Geo) -> None:
    z_a, z_b = WALK_Z - 0.8, FAR_WALK_Z + 0.8
    zs = [z_a + (z_b - z_a) * i / 40 for i in range(41)]
    bottom = -3.0
    a = 9.6  # arch half-span
    cy = WATER_Y - 0.45
    crown = deck_y(BRIDGE_ZC) - 0.8
    b = crown - cy
    arch = [(BRIDGE_ZC + a * math.cos(math.pi * i / 32), cy + b * math.sin(math.pi * i / 32)) for i in range(33)]
    poly = [(z_a, bottom)] + [(z, deck_y(z)) for z in zs] + [(z_b, bottom), (BRIDGE_ZC + a, bottom)] + arch + [(BRIDGE_ZC - a, bottom)]
    geo.prism_x("granite", poly, BRIDGE_X0, BRIDGE_X1)
    # voussoir ring and deck cornice on the visible (+x) face
    ring = arch
    normals = []
    for zz, yy in ring:
        nz, ny = (zz - BRIDGE_ZC) / (a * a), (yy - cy) / (b * b)
        ln = math.hypot(nz, ny) or 1.0
        normals.append((nz / ln * 0.75, ny / ln * 0.75))
    geo.ribbon_x("granite_plain", ring, normals, BRIDGE_X1, BRIDGE_X1 + 0.06)
    deck = [(z, deck_y(z) - 0.32) for z in zs]
    geo.ribbon_x("granite_plain", deck, [(0.0, 0.3)] * len(deck), BRIDGE_X1 - 0.1, BRIDGE_X1 + 0.12)
    # parapets: low granite curb + cast-iron railing following the hump, both sides
    for xc in (BRIDGE_X1 - 0.2, BRIDGE_X0 + 0.2):
        curb = [(z, deck_y(z)) for z in zs]
        geo.ribbon_x("granite_plain", curb, [(0.0, 0.32)] * len(curb), xc - 0.2, xc + 0.2)
        rail_lo = [(z, deck_y(z) + 0.32) for z in zs]
        geo.ribbon_x("iron", [(z, y + 0.9) for z, y in rail_lo], [(0.0, 0.06)] * len(rail_lo), xc - 0.04, xc + 0.04)
        geo.ribbon_x("iron", [(z, y + 0.45) for z, y in rail_lo], [(0.0, 0.03)] * len(rail_lo), xc - 0.02, xc + 0.02)
        geo.ribbon_x("iron", [(z, y + 0.03) for z, y in rail_lo], [(0.0, 0.04)] * len(rail_lo), xc - 0.03, xc + 0.03)
        z = z_a + 0.6
        while z < z_b - 0.6:
            y = deck_y(z) + 0.32
            geo.box("iron", (xc, y + 0.48, z), (0.025, 0.9, 0.025))
            z += 0.16
        # granite end posts with lanterns
        for zp in (z_a + 0.5, z_b - 0.5):
            y = deck_y(zp)
            geo.box("granite_plain", (xc, y + 0.75, zp), (0.6, 1.5, 0.6))
            geo.box("granite_plain", (xc, y + 1.55, zp), (0.72, 0.1, 0.72))
            lamp_post(geo, xc, y + 1.6, zp, height=2.4, twin=True)
    # deck surface (asphalt) between the parapets
    deck_top = [(z, deck_y(z)) for z in zs]
    geo.ribbon_x("asphalt", deck_top, [(0.0, 0.02)] * len(deck_top), BRIDGE_X0 + 0.4, BRIDGE_X1 - 0.4)


# --- far bank facades ------------------------------------------------------------


class Face:
    """A facade in local (u along the face, v up, w into the wall) coordinates."""

    def __init__(self, geo: Geo, origin: tuple[float, float, float], u: tuple[float, float, float], w: tuple[float, float, float]):
        self.geo, self.o, self.u, self.w = geo, origin, u, w

    def world(self, u: float, v: float, w: float) -> tuple[float, float, float]:
        o, U, W = self.o, self.u, self.w
        return (o[0] + U[0] * u + W[0] * w, o[1] + v, o[2] + U[2] * u + W[2] * w)

    def box(self, mat: str, u0: float, u1: float, v0: float, v1: float, w0: float, w1: float) -> None:
        a = self.world(u0, v0, w0)
        b = self.world(u1, v1, w1)
        self.geo.span(mat, min(a[0], b[0]), max(a[0], b[0]), v0, v1, min(a[2], b[2]), max(a[2], b[2]))

    def prism_uv(self, mat: str, pts_uv: list[tuple[float, float]], w0: float, w1: float) -> None:
        """Polygon in the facade's (u, v) plane, extruded into the wall from w0 to w1."""
        n = len(pts_uv)
        verts = [self.world(u, v, w) for w in (w0, w1) for u, v in pts_uv]
        faces = [list(range(n)), list(reversed(range(n, 2 * n)))]
        faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
        self.geo.mesh(mat, verts, faces)


def window_unit(f: Face, rng: random.Random, uc: float, v0: float, ww: float, wh: float, trim: str, hood: str = "", glass: str | None = None) -> None:
    """Window opening contents and surround: glass, white T-frame, architrave, sill, optional hood."""
    u0, u1 = uc - ww / 2, uc + ww / 2
    reveal = 0.24
    g = glass or rng.choices(["glass_dark", "glass_room", "glass_curtain", "glass_lit"], weights=[5, 3, 2.2, 0.6])[0]
    f.box(g, u0, u1, v0, v0 + wh, reveal, reveal + 0.02)
    if g == "glass_curtain" and rng.random() < 0.5:
        # half-drawn curtain: the other half shows the room
        f.box("glass_room", u0 + ww * 0.5, u1, v0, v0 + wh, reveal - 0.005, reveal)
    fw = 0.065
    fm = "frame_white"
    f.box(fm, u0, u1, v0, v0 + fw, reveal - 0.06, reveal)
    f.box(fm, u0, u1, v0 + wh - fw, v0 + wh, reveal - 0.06, reveal)
    f.box(fm, u0, u0 + fw, v0, v0 + wh, reveal - 0.06, reveal)
    f.box(fm, u1 - fw, u1, v0, v0 + wh, reveal - 0.06, reveal)
    tv = v0 + wh * 0.7
    f.box(fm, u0, u1, tv - fw / 2, tv + fw / 2, reveal - 0.06, reveal)
    f.box(fm, uc - fw / 2, uc + fw / 2, v0, tv, reveal - 0.06, reveal)
    f.box(fm, u0 + ww * 0.25 - fw / 3, u0 + ww * 0.25 + fw / 3, tv, v0 + wh, reveal - 0.05, reveal)  # fortochka
    # architrave
    t = 0.13
    f.box(trim, u0 - t, u0, v0 - 0.02, v0 + wh + t, -0.05, 0.0)
    f.box(trim, u1, u1 + t, v0 - 0.02, v0 + wh + t, -0.05, 0.0)
    f.box(trim, u0 - t, u1 + t, v0 + wh, v0 + wh + t, -0.05, 0.0)
    # sill
    f.box(trim, u0 - 0.2, u1 + 0.2, v0 - 0.12, v0 - 0.02, -0.12, 0.0)
    if hood == "cornice":
        f.box(trim, u0 - 0.25, u1 + 0.25, v0 + wh + t, v0 + wh + t + 0.12, -0.18, 0.0)
        f.box(trim, u0 - 0.3, u1 + 0.3, v0 + wh + t + 0.12, v0 + wh + t + 0.2, -0.22, 0.0)
    elif hood == "pediment":
        f.box(trim, u0 - 0.25, u1 + 0.25, v0 + wh + t, v0 + wh + t + 0.1, -0.18, 0.0)
        y = v0 + wh + t + 0.1
        f.prism_uv(trim, [(u0 - 0.3, y), (u1 + 0.3, y), (uc, y + 0.45)], -0.2, 0.0)
    elif hood == "keystone":
        f.box(trim, uc - 0.12, uc + 0.12, v0 + wh - 0.05, v0 + wh + t + 0.1, -0.09, 0.0)


def shop_interior(f: Face, rng: random.Random, uc: float, ww: float, room: float) -> None:
    """What shows through a shop window: shelves of goods on the back wall, a counter, a ceiling tube."""
    u0, u1 = uc - ww / 2 - 0.4, uc + ww / 2 + 0.4
    for sy in (1.1, 1.7, 2.3, 2.9):
        f.box("shop_shelf", u0, u1, sy - 0.04, sy, room - 0.45, room)
        u = u0 + rng.uniform(0.0, 0.15)
        while u < u1 - 0.15:
            w = rng.uniform(0.12, 0.35)
            h = rng.uniform(0.15, 0.45)
            if rng.random() < 0.8:
                f.box(f"goods_{rng.randrange(7)}", u, min(u + w, u1), sy, sy + h, room - 0.4, room - 0.05)
            u += w + rng.uniform(0.02, 0.1)
    if rng.random() < 0.7:
        cu = uc + rng.uniform(-0.4, 0.4)
        f.box("shop_shelf", cu - 0.8, cu + 0.8, 0.45, 1.4, 1.2, 1.8)
        f.box(f"goods_{rng.randrange(7)}", cu - 0.7, cu + 0.7, 1.4, 1.43, 1.25, 1.75)
    f.box("shop_tube", uc - 0.6, uc + 0.6, GROUND_H - 0.42, GROUND_H - 0.36, 1.4, 1.5)


SHOP_SIGNS = [
    ("АПТЕКА", "green", "white"),
    ("БУЛОЧНАЯ", "brown", "gold"),
    ("ПРОДУКТЫ", "blue", "white"),
    ("ЧАСЫ · РЕМОНТ", "red", "gold"),
    ("ЦВЕТЫ", "green", "white"),
    ("КНИГИ", "brown", "white"),
    ("ОПТИКА", "blue", "white"),
    ("ХОЗТОВАРЫ", "cream", "red"),
    ("ШАВЕРМА", "red", "white"),
    ("КАФЕ «ПРИЧАЛ»", "brown", "gold"),
    ("ОБУВЬ", "blue", "white"),
]


class Building:
    """One far-bank house: x0 < x1 (x0 is on the player's right), front face at FACADE_Z."""

    def __init__(
        self,
        x0: float,
        x1: float,
        storeys: int,
        color: str,
        trim: str = "white",
        roof: str = "grey",
        bays: int | None = None,
        pilasters: bool = False,
        hoods: str = "cornice",
        rustic: bool = True,
        shops: list[int] | None = None,
        signs: list[int] | None = None,
        attic: bool = False,
    ):
        self.x0, self.x1, self.storeys, self.color, self.trim, self.roof = x0, x1, storeys, color, trim, roof
        self.bays = bays
        self.pilasters, self.hoods, self.rustic = pilasters, hoods, rustic
        self.shops = shops
        self.signs = signs or []
        self.attic = attic


GROUND_H = 4.6
UPPER_H = 3.75
MAIN_H = 4.1  # piano nobile


def storey_levels(n: int) -> list[tuple[float, float]]:
    lv = [(0.0, GROUND_H)]
    y = GROUND_H
    for i in range(n - 1):
        h = MAIN_H if i == 0 else UPPER_H - 0.15 * min(i - 1, 2)
        lv.append((y, y + h))
        y += h
    return lv


def build_house(geo: Geo, b: Building, rng: random.Random, font, sign_iter) -> None:
    wall = f"plaster_{b.color}"
    trim = f"trim_{b.trim}"
    width = b.x1 - b.x0
    n = b.bays or max(2, round(width / 3.4))
    bw = width / n
    f = Face(geo, (b.x1, 0.0, FACADE_Z), (-1, 0, 0), (0, 0, 1))
    lv = storey_levels(b.storeys)
    H = lv[-1][1]
    depth = 14.0
    # body behind the front wall (the roofline; inset so a side-street wall can sit at the end)
    # The ground floor behind the shop windows is hollow: a lit room 3 m deep.
    room = 3.2
    geo.span(wall, b.x0 + 0.4, b.x1 - 0.4, GROUND_H - 0.3, H, FACADE_Z + 0.35, FACADE_Z + depth)
    geo.span(wall, b.x0 + 0.4, b.x1 - 0.4, 0.0, GROUND_H - 0.3, FACADE_Z + room + 0.05, FACADE_Z + depth)
    geo.span("shop_back", b.x0 + 0.4, b.x1 - 0.4, 0.4, GROUND_H - 0.3, FACADE_Z + room, FACADE_Z + room + 0.05)
    geo.span("shop_floor", b.x0 + 0.1, b.x1 - 0.1, 0.3, 0.45, FACADE_Z + 0.2, FACADE_Z + room)
    for xs in (b.x0 + 0.1, b.x1 - 0.5):
        geo.span("shop_back", xs, xs + 0.4, 0.4, GROUND_H - 0.3, FACADE_Z + 0.2, FACADE_Z + room)
    shops = b.shops if b.shops is not None else [i for i in range(n) if rng.random() < 0.5]

    for si, (y0, y1) in enumerate(lv):
        ground = si == 0
        for k in range(n):
            u0, u1 = k * bw, (k + 1) * bw
            uc = (u0 + u1) / 2
            if ground:
                shop = k in shops
                if shop:
                    ww, wv0, wh = min(bw - 0.9, 2.3), 0.75, 2.75
                else:
                    ww, wv0, wh = min(bw * 0.4, 1.3), 1.25, 2.2
            else:
                ww = min(bw * 0.42, 1.35)
                wv0 = y0 + 0.9
                wh = (2.45 if si == 1 else 2.15) - (0.1 * (si - 2) if si > 2 else 0)
                wv0 -= y0
            v_lo, v_hi = y0 + wv0, y0 + wv0 + wh
            # wall pieces around the opening
            mat = wall
            f.box(mat, u0, uc - ww / 2, y0, y1, 0.0, 0.35)
            f.box(mat, uc + ww / 2, u1, y0, y1, 0.0, 0.35)
            f.box(mat, uc - ww / 2, uc + ww / 2, y0, v_lo, 0.0, 0.35)
            f.box(mat, uc - ww / 2, uc + ww / 2, v_hi, y1, 0.0, 0.35)
            if ground:
                if b.rustic:
                    # rustication: protruding courses with grooves between, around the opening
                    y = 0.55
                    while y < y1 - 0.5:
                        h = 0.4
                        f.box(mat, u0, uc - ww / 2 - 0.02, y, y + h - 0.045, -0.045, 0.0)
                        f.box(mat, uc + ww / 2 + 0.02, u1, y, y + h - 0.045, -0.045, 0.0)
                        if y + h < v_lo or y > v_hi:
                            f.box(mat, uc - ww / 2, uc + ww / 2, y, min(y + h - 0.045, v_lo if y < v_lo else y1), -0.045, 0.0)
                        y += h
                if k in shops:
                    f.box("shop_glass", uc - ww / 2, uc + ww / 2, v_lo, v_hi, 0.18, 0.2)
                    shop_interior(f, rng, uc, ww, room)
                    fm = rng.choice(["frame_brown", "frame_green", "frame_white"])
                    for a0, a1 in ((uc - ww / 2, uc - ww / 2 + 0.09), (uc + ww / 2 - 0.09, uc + ww / 2), (uc - 0.03, uc + 0.03)):
                        f.box(fm, a0, a1, v_lo, v_hi, 0.12, 0.18)
                    f.box(fm, uc - ww / 2, uc + ww / 2, v_lo, v_lo + 0.4, 0.1, 0.18)
                    f.box(fm, uc - ww / 2, uc + ww / 2, v_hi - 0.08, v_hi, 0.12, 0.18)
                    f.box(fm, uc - ww / 2, uc + ww / 2, v_lo + 1.95, v_lo + 2.0, 0.12, 0.18)
                    if k in b.signs:
                        word, board, letters = next(sign_iter)
                        sy0, sy1 = v_hi + 0.12, v_hi + 0.72
                        su0, su1 = uc - ww / 2 - 0.15, uc + ww / 2 + 0.15
                        f.box(f"sign_{board}", su0, su1, sy0, sy1, -0.12, 0.0)
                        cx = f.world(uc, 0, 0)[0]
                        text_mesh(geo, f"letters_{letters}", word, (cx, (sy0 + sy1) / 2, FACADE_Z - 0.125), 0.36, font, depth=0.02, max_width=su1 - su0 - 0.3)
                else:
                    window_unit(f, rng, uc, v_lo, ww, wh, trim, hood="keystone")
            else:
                hood = b.hoods if si == 1 else ("keystone" if si == len(lv) - 1 else ("cornice" if b.hoods == "pediment" else ""))
                window_unit(f, rng, uc, v_lo, ww, wh, trim, hood=hood)
        # belt course at the top of the storey
        if ground:
            f.box(trim, -0.02, width + 0.02, y1 - 0.3, y1, -0.16, 0.0)
            f.box(trim, -0.02, width + 0.02, y1 - 0.36, y1 - 0.3, -0.1, 0.0)
        elif si < len(lv) - 1:
            f.box(trim, 0.0, width, y1 - 0.05, y1 + 0.12, -0.08, 0.0)
    # plinth
    f.box("plinth", -0.03, width + 0.03, 0.0, 0.55, -0.07, 0.0)
    # pilasters on the upper storeys
    if b.pilasters and len(lv) > 1:
        for k in range(n + 1):
            u = k * bw
            if k in (0, n):
                u = 0.3 if k == 0 else width - 0.3
            f.box(trim, u - 0.28, u + 0.28, lv[1][0], H - 0.2, -0.11, 0.0)
            f.box(trim, u - 0.36, u + 0.36, H - 0.45, H - 0.2, -0.16, 0.0)
    elif len(lv) > 1:
        # quoins at the corners
        y = lv[1][0]
        while y < H - 0.6:
            for u0, u1 in ((0.0, 0.55), (width - 0.55, width)):
                f.box(trim, u0, u1, y, y + 0.42, -0.06, 0.0)
            y += 0.5
    # main cornice
    f.box(trim, -0.05, width + 0.05, H - 0.2, H + 0.1, -0.14, 0.0)
    k = 0.0
    while k < width:
        f.box(trim, k + 0.05, k + 0.15, H + 0.1, H + 0.24, -0.24, 0.0)
        k += 0.28
    f.box(trim, -0.15, width + 0.15, H + 0.24, H + 0.52, -0.5, 0.0)
    f.box(trim, -0.2, width + 0.2, H + 0.52, H + 0.62, -0.58, 0.0)
    top = H + 0.62
    if b.attic:
        f.box(wall, 0.0, width, top, top + 0.9, 0.0, 0.3)
        f.box(trim, -0.05, width + 0.05, top + 0.9, top + 1.02, -0.08, 0.3)
        top += 1.02
    # roof: tin slope back to a ridge, with chimneys and a low roof railing
    ridge = top + (2.0 if b.storeys <= 2 else 3.2)
    rz0, rz1 = FACADE_Z + 0.25, FACADE_Z + depth * 0.5
    verts = [(b.x0, top, rz0), (b.x1, top, rz0), (b.x1, ridge, rz1), (b.x0, ridge, rz1)]
    geo.mesh(f"roof_{b.roof}", verts + [(b.x0, top - 0.01, rz1), (b.x1, top - 0.01, rz1)], [(0, 1, 2, 3), (0, 3, 4), (1, 5, 2)])
    geo.span(f"roof_{b.roof}", b.x0, b.x1, top - 0.5, ridge, rz1, rz1 + 0.4)
    x = b.x0 + 0.3
    while x < b.x1 - 0.2:
        geo.box("iron", (x, top + 0.3, rz0 + 0.1), (0.02, 0.6, 0.02))
        x += 0.35
    geo.span("iron", b.x0 + 0.2, b.x1 - 0.2, top + 0.57, top + 0.61, rz0 + 0.08, rz0 + 0.12)
    for _ in range(max(1, int(width / 6))):
        cx = rng.uniform(b.x0 + 1.0, b.x1 - 1.0)
        cz = rng.uniform(rz0 + 2.5, rz1 + 2.0)
        frac = min(1.0, (cz - rz0) / (rz1 - rz0))
        base = top + (ridge - top) * frac
        ch = rng.uniform(1.2, 2.2)
        cw = rng.uniform(0.5, 1.1)
        geo.span("chimney", cx - cw / 2, cx + cw / 2, base - 0.5, base + ch, cz - 0.3, cz + 0.3)
        geo.span("chimney", cx - cw / 2 - 0.06, cx + cw / 2 + 0.06, base + ch, base + ch + 0.1, cz - 0.36, cz + 0.36)
        if rng.random() < 0.6:
            geo.cylinder("tin", (cx, base + ch + 0.1, cz), 0.09, 0.5, seg=8)
    # dormer on the roof slope
    if width > 9 and rng.random() < 0.7:
        dx = rng.uniform(b.x0 + 2.0, b.x1 - 2.0)
        dz = rz0 + 1.6
        dy = top + (ridge - top) * (dz - rz0) / (rz1 - rz0)
        geo.span(f"roof_{b.roof}", dx - 0.7, dx + 0.7, dy - 0.6, dy + 1.0, dz, dz + 1.6)
        geo.span("glass_dark", dx - 0.4, dx + 0.4, dy - 0.4, dy + 0.6, dz - 0.02, dz)
        geo.span("frame_white", dx - 0.48, dx + 0.48, dy + 0.6, dy + 0.68, dz - 0.04, dz)
    # drainpipes at both ends
    for px in (b.x0 + 0.25, b.x1 - 0.25):
        geo.cylinder("tin", (px, 0.25, FACADE_Z - 0.16), 0.075, H - 0.1, seg=8)
        geo.cylinder("tin", (px, H - 0.25, FACADE_Z - 0.16), 0.075, 0.35, seg=8, r_top=0.16)
        geo.box("tin", (px, 0.2, FACADE_Z - 0.28), (0.15, 0.08, 0.3))


def side_wall(geo: Geo, rng: random.Random, x: float, z0: float, z1: float, storeys: int, color: str, faces_plus_x: bool = True) -> None:
    """A wall along a side street (facing +x), with windows: the receding street seen through the gap."""
    wall = f"plaster_{color}"
    trim = "trim_white"
    sgn = 1 if faces_plus_x else -1
    f = Face(geo, (x, 0.0, z0), (0, 0, 1), (-sgn, 0, 0))
    lv = storey_levels(storeys)
    H = lv[-1][1]
    length = z1 - z0
    n = max(1, round(length / 3.5))
    bw = length / n
    for si, (y0, y1) in enumerate(lv):
        for k in range(n):
            u0, u1 = k * bw, (k + 1) * bw
            uc = (u0 + u1) / 2
            ww, wh = 1.3, (2.2 if si else 2.0)
            v_lo = y0 + (1.0 if si else 1.3)
            f.box(wall, u0, uc - ww / 2, y0, y1, 0.0, 0.35)
            f.box(wall, uc + ww / 2, u1, y0, y1, 0.0, 0.35)
            f.box(wall, uc - ww / 2, uc + ww / 2, y0, v_lo, 0.0, 0.35)
            f.box(wall, uc - ww / 2, uc + ww / 2, v_lo + wh, y1, 0.0, 0.35)
            window_unit(f, rng, uc, v_lo, ww, wh, trim, hood="keystone" if si == 1 else "")
        f.box(trim, 0.0, length, y1 - 0.1, y1 + 0.1, -0.1, 0.0)
    f.box("plinth", 0.0, length, 0.0, 0.55, -0.06, 0.0)
    f.box(trim, 0.0, length, H + 0.1, H + 0.5, -0.45, 0.0)
    # roof edge
    a = f.world(0, 0, 0)
    b = f.world(length, 0, 0)
    xr = x - sgn * 6
    geo.mesh("roof_grey", [(x, H + 0.5, a[2]), (x, H + 0.5, b[2]), (xr, H + 3.5, b[2]), (xr, H + 3.5, a[2])], [(0, 1, 2, 3)])


def far_bank(geo: Geo, font) -> None:
    rng = random.Random(1907)
    signs = iter(SHOP_SIGNS)
    houses = [
        # right of the side street (screen right)
        Building(-62.0, -47.0, 5, "cream", bays=5, pilasters=True, shops=[1, 3], signs=[3]),
        Building(-47.0, -33.0, 4, "salmon", bays=4, hoods="pediment", shops=[0, 2], signs=[2]),
        Building(-33.0, STREET_X0, 5, "blue", trim="white", bays=4, shops=[1, 2], signs=[1], attic=True),
        # left of the side street: in the window (a low merchant house, so the sky shows above it)
        Building(STREET_X1, 2.5, 2, "ochre", trim="white", bays=3, shops=[0, 2], signs=[0], hoods="pediment", roof="green"),
        Building(2.5, 12.0, 4, "mint", trim="white", bays=3, hoods="cornice", shops=[0, 2], signs=[2], roof="red", pilasters=True),
        Building(12.0, 24.0, 4, "salmon", trim="cream", bays=4, shops=[1, 2], signs=[1, 2], rustic=True),
        Building(24.0, 38.0, 5, "yellow", trim="white", bays=4, pilasters=True, shops=[0, 3], signs=[3]),
        Building(38.0, 55.0, 4, "pink", trim="white", bays=5, shops=[2], signs=[2]),
        Building(55.0, 70.0, 5, "sage", bays=4, shops=[1], signs=[]),
    ]
    for h in houses:
        build_house(geo, h, rng, font, signs)
    # the side street behind the bridge: walls facing into it, a road, a far closing facade
    side_wall(geo, rng, STREET_X0, FACADE_Z + 0.35, FACADE_Z + 24, 5, "blue")
    side_wall(geo, rng, STREET_X0, FACADE_Z + 24, FACADE_Z + 46, 5, "lilac")
    side_wall(geo, rng, STREET_X0, FACADE_Z + 46, FACADE_Z + 80, 4, "grey")
    geo.span("asphalt", STREET_X0, STREET_X1, -0.3, 0.0, FACADE_Z, FACADE_Z + 120)
    for x0, x1 in ((STREET_X0 - 2.5, STREET_X0), (STREET_X1, STREET_X1 + 2.5)):
        geo.span("pavement", x0, x1, -0.3, WALK_TOP, FACADE_Z, FACADE_Z + 120)
    geo.span("plaster_grey", STREET_X0 - 30, STREET_X1 + 30, 0, 18, FACADE_Z + 120, FACADE_Z + 130)
    belfry(geo, -11.0, FACADE_Z + 160)
    # bare lime trees on the far walk (March)
    tree(geo, random.Random(11), -3.4, FAR_WALK_Z + 1.4, 9.0)
    tree(geo, random.Random(12), 28.0, FAR_WALK_Z + 1.4, 8.0)


def belfry(geo: Geo, x: float, z: float) -> None:
    """A distant church bell tower on the skyline: three tiers, a drum and a gilded cupola with a spire."""
    y = 0.0
    for w, h in ((11.0, 22.0), (8.5, 9.0), (6.5, 7.0)):
        geo.span("trim_cream", x - w / 2, x + w / 2, y, y + h, z - w / 2, z + w / 2)
        geo.span("trim_white", x - w / 2 - 0.4, x + w / 2 + 0.4, y + h - 0.8, y + h, z - w / 2 - 0.4, z + w / 2 + 0.4)
        # dark belfry openings
        for k in (-1, 0, 1):
            geo.span("glass_dark", x + k * w / 3.4 - 0.7, x + k * w / 3.4 + 0.7, y + h * 0.35, y + h * 0.8, z - w / 2 - 0.05, z - w / 2 + 0.1)
        y += h
    geo.cylinder("trim_cream", (x, y, z), 2.6, 3.0, seg=16)
    geo.lathe("dome_gold", (x, y + 3.0, z), [(2.7, 0.0), (2.9, 1.0), (2.4, 2.4), (1.2, 3.6), (0.35, 4.3), (0.25, 4.6)], seg=20)
    geo.cylinder("dome_gold", (x, y + 7.6, z), 0.22, 9.0, seg=8, r_top=0.02)


def tree(geo: Geo, rng: random.Random, x: float, z: float, height: float) -> None:
    """A pollarded, leafless lime: trunk plus a few levels of tapering branches."""

    def branch(p, d, length, r, depth):
        steps = 4
        for i in range(steps):
            q = (p[0] + d[0] * length / steps, p[1] + d[1] * length / steps, p[2] + d[2] * length / steps)
            seg_box(geo, p, q, r * (1 - 0.18 * i / steps))
            p = q
            d = norm((d[0] + rng.uniform(-0.25, 0.25), d[1] + rng.uniform(-0.1, 0.25), d[2] + rng.uniform(-0.25, 0.25)))
        if depth == 0:
            return
        for _ in range(rng.randint(2, 3)):
            nd = norm((d[0] + rng.uniform(-0.9, 0.9), d[1] + rng.uniform(0.0, 0.8), d[2] + rng.uniform(-0.9, 0.9)))
            branch(p, nd, length * rng.uniform(0.55, 0.75), r * 0.6, depth - 1)

    trunk_h = height * 0.38
    geo.cylinder("tree", (x, WALK_TOP, z), 0.2, trunk_h, seg=8, r_top=0.15)
    top = (x, WALK_TOP + trunk_h, z)
    for _ in range(4):
        d = norm((rng.uniform(-0.7, 0.7), 1.0, rng.uniform(-0.7, 0.7)))
        branch(top, d, height * 0.32, 0.09, 3)


def norm(v):
    ln = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) or 1.0
    return (v[0] / ln, v[1] / ln, v[2] / ln)


def seg_box(geo: Geo, p, q, r: float, mat: str = "tree") -> None:
    """A square-section beam from p to q (cheap branch segment)."""
    from mathutils import Vector

    a, b = Vector(p), Vector(q)
    d = b - a
    ln = d.length
    if ln < 1e-4:
        return
    z = d.normalized()
    x = z.cross(Vector((0, 1, 0)))
    if x.length < 1e-3:
        x = z.cross(Vector((1, 0, 0)))
    x.normalize()
    y = z.cross(x)
    from mathutils import Matrix

    m = Matrix((x, y, z)).transposed()
    c = (a + b) / 2
    geo.box(mat, tuple(c), (r * 2, r * 2, ln), m)


def build(font) -> dict[str, bpy.types.Material]:
    mats = Mats()
    geo = Geo()
    embankments(geo)
    bridge(geo)
    boat(geo, -3.6, 2.4)
    far_bank(geo, font)
    geo.finish(mats.m)
    return mats.m
