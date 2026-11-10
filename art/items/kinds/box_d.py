"""
Box-kind items, the 1.4 trio. Each has its own module, so three people can work
at once: army binoculars (d_binoculars.py), a ship's aneroid barometer
(d_barometer.py) and a programmable calculator (d_calculator.py).

box.py's `build` falls back to box_c and then to BUILDERS here, so the
placeholder stays `box` and the conventions are box.py's: `model.size` [w, h, d]
centred on the origin, front +Z. All three rest flat (front up on the counter).
"""

from __future__ import annotations

import importlib


def _lazy(module: str):
    def fn(it):
        importlib.import_module(f"kinds.{module}").build(it)

    return fn


BUILDERS = {
    "binoculars_army_8x30": _lazy("d_binoculars"),
    "barometer_mostpribor_ship": _lazy("d_barometer"),
    "calculator_priboy_pm61": _lazy("d_calculator"),
}
