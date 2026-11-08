"""
Game sounds (docs/04-ASSETS.md § Audio).

    python3 art/audio/build.py [--only door_bell,ambience] [--cache art/out/audio]

Downloads the CC0 sources listed in SOURCES (OpenGameArt; each page was checked
for a CC0 licence, see ATTRIBUTION.md), cuts and layers them per RECIPES, trims
silence, normalises loudness and writes mono MP3s to public/assets/audio/.
Two cues (the scale beep and the phone keypad) are generated here from sine
tones, with no third-party audio.

The ElevenLabs sound effects (Sound Effects v2, generated from Longlight's own
prompts on a paid plan) are committed as raw takes in art/audio/src/elevenlabs/
(the generation URLs expire), so their recipes read local files: swapping a
take is replacing that one file and rerunning `--only <name>`. They are
written to public/assets/audio/lazy/, which the game fetches the first time
each is needed (or when its context starts), never in the first-tap preload.
The two beds there (rain, flood) are seamless loops like the ambience.

Loudness: one-shots are normalised to a loudest-400 ms (momentary) loudness of
ONE_SHOT_LUFS (a lookahead limiter shaves at most MAX_LIMIT_DB off transient
peaks to get there; very short clicks stay a little under), the ambience to an
integrated AMBIENCE_LUFS, all with peaks under PEAK_DBFS. The final balance
between cues is a runtime gain in src/data/audio.ts, so retuning a level never
needs a rebuild.

The ambience is a seamless loop: the mix runs LOOP_XFADE seconds past the loop
length and that tail is crossfaded (equal power) into the head.

The outputs are committed: CI never downloads anything. Rerun only when a
recipe changes. Needs numpy and ffmpeg (with libmp3lame) on PATH.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "assets" / "audio"
SR = 44100

ONE_SHOT_LUFS = -20.0
MAX_LIMIT_DB = 6.0
AMBIENCE_LUFS = -26.0
PEAK_DBFS = -1.0
LOOP_XFADE = 3.0

# id -> download (zip or single file), the page its CC0 licence was read from, author.
SOURCES: dict[str, dict[str, str]] = {
    "kenney_rpg": {
        "url": "https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip",
        "page": "https://opengameart.org/content/50-rpg-sound-effects",
        "author": "Kenney (kenney.nl)",
    },
    "kenney_interface": {
        "url": "https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip",
        "page": "https://opengameart.org/content/interface-sounds",
        "author": "Kenney (kenney.nl)",
    },
    "rubberduck_100": {
        "url": "https://opengameart.org/sites/default/files/100-CC0-SFX_0.zip",
        "page": "https://opengameart.org/content/100-cc0-sfx",
        "author": "rubberduck",
    },
    "laleksic": {
        "url": "https://opengameart.org/sites/default/files/sounds_8.zip",
        "page": "https://opengameart.org/content/various-sound-effects",
        "author": "laleksic",
    },
    "legit_shop": {
        "url": "https://opengameart.org/sites/default/files/legit_audio_-_the_shop_free_sfx_wav.zip",
        "page": "https://opengameart.org/content/the-shop",
        "author": "LEGIT Audio",
    },
    "street": {
        "url": "https://opengameart.org/sites/default/files/gatve%20Varniu_2.ogg",
        "page": "https://opengameart.org/content/high-traffic-road-sounds",
        "author": "ignasd",
    },
    # Local raw takes (ElevenLabs Sound Effects v2, Longlight's prompts, paid plan): never downloaded.
    "elevenlabs": {
        "dir": "art/audio/src/elevenlabs",
        "page": "https://elevenlabs.io/sound-effects",
        "author": "Longlight Interactive (generated with ElevenLabs Sound Effects v2)",
    },
    "vistula": {
        "url": "https://opengameart.org/sites/default/files/VistulaShort_0.mp3",
        "page": "https://opengameart.org/content/sea-and-river-wave-sounds",
        "author": "randommind",
    },
}

# A layer: (source id, member in the zip or "" for a single file, at seconds into the cue,
# gain dB relative to the layer's own loudest 400 ms, ffmpeg -af chain or "").
# Optional per-cue: "trim": (start, duration) applied to every layer's source before
# placing it; "bitrate".
RECIPES: dict[str, dict] = {
    # A small brass bell on the door, three strikes as it swings.
    "door_bell": {
        "layers": [("rubberduck_100", "bell_03.ogg", 0.0, 0.0, "highpass=f=250")],
        "bitrate": "96k",
    },
    # The seller's item set on the mat over the glass counter: a soft thud with a faint glass tick.
    "set_down": {
        "layers": [
            ("kenney_rpg", "OGG/bookPlace2.ogg", 0.0, 0.0, "highpass=f=90"),
            ("rubberduck_100", "glass_02.ogg", 0.004, -20.0, "highpass=f=1500"),
        ],
        "bitrate": "80k",
    },
    # Money changes hands at the counter: the cash drawer runs out and coins are counted.
    "cash": {
        "layers": [
            ("laleksic", "drawer_open.wav", 0.0, 0.0, "highpass=f=70"),
            ("kenney_rpg", "OGG/handleCoins.ogg", 0.32, -3.0, ""),
        ],
        "bitrate": "96k",
    },
    # Coins alone (the dealer's money after closing).
    "coins": {"layers": [("kenney_rpg", "OGG/handleCoins.ogg", 0.0, 0.0, "")], "bitrate": "96k"},
    # Inspect tools.
    "tool_loupe": {"layers": [("kenney_rpg", "OGG/metalClick.ogg", 0.0, 0.0, "")], "bitrate": "80k"},
    "tool_magnet": {"layers": [("kenney_rpg", "OGG/metalLatch.ogg", 0.0, 0.0, "")], "bitrate": "80k"},
    "tool_acid": {"layers": [("rubberduck_100", "plop_01.ogg", 0.0, 0.0, "highpass=f=400")], "bitrate": "80k"},
    "tool_page": {"layers": [("kenney_rpg", "OGG/bookFlip1.ogg", 0.0, 0.0, "")], "bitrate": "80k"},
    "tool_switch": {"layers": [("laleksic", "switch_on.wav", 0.0, 0.0, "")], "bitrate": "80k"},
    "tool_scale": {"generate": "scale_beep", "bitrate": "80k"},
    "tool_phone": {"generate": "keypad", "bitrate": "80k"},
    # UI button tap.
    "ui_tap": {"layers": [("kenney_interface", "Audio/click_001.ogg", 0.0, 0.0, "")], "bitrate": "80k"},
    # --- ElevenLabs sound effects, loaded lazily (written to lazy/). ---
    # A walk-in leaves: the street door swings shut, its bell jingling.
    "door_close": {"layers": [("elevenlabs", "door_close.mp3", 0.0, 0.0, "highpass=f=60")], "bitrate": "96k", "dir": "lazy"},
    # An incoming call: the ring (the take's silent tail is trimmed off).
    "phone_ring": {"layers": [("elevenlabs", "phone_ring.mp3", 0.0, 0.0, "highpass=f=120")], "bitrate": "96k", "dir": "lazy"},
    # A pawn ticket: rubber stamp, then the receipt torn off.
    "stamp": {"layers": [("elevenlabs", "stamp.mp3", 0.0, 0.0, "highpass=f=60")], "bitrate": "96k", "dir": "lazy"},
    # The shop's roller shutter going up in the morning / down at night (ends in a bang).
    "shutter_up": {"layers": [("elevenlabs", "shutter_up.mp3", 0.0, 0.0, "highpass=f=50")], "bitrate": "80k", "dir": "lazy"},
    "shutter_down": {"layers": [("elevenlabs", "shutter_down.mp3", 0.0, 0.0, "highpass=f=50")], "bitrate": "80k", "dir": "lazy"},
    # The morning paper unfolded.
    "newspaper": {"layers": [("elevenlabs", "newspaper.mp3", 0.0, 0.0, "highpass=f=80")], "bitrate": "80k", "dir": "lazy"},
    # A mechanical watch being wound, steady ticking (inspecting a watch).
    "watch_wind": {"layers": [("elevenlabs", "watch_wind.mp3", 0.0, 0.0, "highpass=f=150")], "bitrate": "80k", "dir": "lazy"},
    # A film camera's shutter (inspecting a camera).
    "camera_shutter": {"layers": [("elevenlabs", "camera_shutter.mp3", 0.0, 0.0, "highpass=f=80")], "bitrate": "80k", "dir": "lazy"},
    # A tram passing in the distance, its bell, muffled by the glass.
    "tram_bell": {"layers": [("elevenlabs", "tram_bell.mp3", 0.0, 0.0, "highpass=f=60,lowpass=f=5000")], "bitrate": "80k", "dir": "lazy"},
}

# Beds under the ambience, from one take each (generated loopable): filtered, the last BED_XFADE s
# crossfaded (equal power) into the head so the seam is continuous whatever the take did, then
# normalised like the ambience. Written to lazy/.
BED_XFADE = 2.0
BEDS: dict[str, dict] = {
    # Rain on the street and the window: the very top rolled off so it sits behind the glass.
    "rain_loop": {"src": ("elevenlabs", "rain_loop.mp3"), "af": "highpass=f=70,lowpass=f=7000", "bitrate": "48k"},
    # Canal water in the shop on the Flood's days: drips and lapping. The take is very quiet
    # (about -41 LUFS), so it is raised ~15 dB; a gentle FFT denoise and a rumble/hiss band-limit
    # keep the raised noise floor from turning into a hiss bed.
    "flood_loop": {"src": ("elevenlabs", "flood_loop.mp3"), "af": "highpass=f=90,lowpass=f=9000,afftdn=nr=8:nf=-60", "bitrate": "48k"},
}

# The ambience: quiet room tone, a street heard through the window, canal water.
AMBIENCE = {
    "loop": 54.0,
    "bitrate": "48k",
    # (source id, member, start s, ffmpeg -af, level dB relative to the street layer's RMS)
    "layers": [
        (
            "street", "", 1.0,
            "highpass=f=45,lowpass=f=1100,lowpass=f=2600,acompressor=threshold=-30dB:ratio=2:attack=300:release=2000",
            0.0,
        ),
        ("vistula", "", 133.0, "highpass=f=90,lowpass=f=650,lowpass=f=650", -9.0),
        # 11.4 s of fridge hum, tiled with crossfades under the whole loop.
        ("legit_shop", "TheShopCollection_convenience_store_drinks_fridge_drone.wav", 0.0, "highpass=f=40,lowpass=f=380", -13.0),
    ],
}


def fetch(src_id: str, member: str, cache: Path) -> Path:
    src = SOURCES[src_id]
    if "dir" in src:  # committed local takes
        p = ROOT / src["dir"] / member
        if not p.exists():
            raise SystemExit(f"missing {p}")
        return p
    d = cache / src_id
    d.mkdir(parents=True, exist_ok=True)
    name = Path(urllib.request.url2pathname(src["url"].rsplit("/", 1)[1])).name.replace(" ", "_")
    dl = d / name
    if not dl.exists():
        print(f"  download {src['url']}")
        with urllib.request.urlopen(src["url"], timeout=300) as r:
            dl.write_bytes(r.read())
    if not member:
        return dl
    out = d / "x" / member
    if not out.exists():
        with zipfile.ZipFile(dl) as z:
            match = [n for n in z.namelist() if n == member or n.endswith("/" + member)]
            if not match:
                raise SystemExit(f"{member} not in {dl}")
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(z.read(match[0]))
    return out


def decode(path: Path, af: str = "", start: float = 0.0, dur: float | None = None) -> np.ndarray:
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start)]
    if dur is not None:
        cmd += ["-t", str(dur)]
    cmd += ["-i", str(path), "-ac", "1", "-ar", str(SR)]
    if af:
        cmd += ["-af", af]
    cmd += ["-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def write_wav(path: Path, x: np.ndarray) -> None:
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_f32le", str(path)],
        input=x.astype(np.float64).tobytes(), check=True,
    )


def loudness(x: np.ndarray) -> dict[str, float]:
    """EBU R128 integrated (I), loudest momentary (M) and true peak, measured by ffmpeg."""
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "m.wav"
        # Pad with silence so a short sound still fills whole 400 ms windows.
        pad = np.zeros(int(0.5 * SR))
        write_wav(p, np.concatenate([pad, x, pad]))
        log = subprocess.run(
            ["ffmpeg", "-hide_banner", "-nostats", "-v", "verbose", "-i", str(p), "-af", "ebur128=peak=true:framelog=verbose", "-f", "null", "-"],
            capture_output=True, text=True,
        ).stderr
    ms = [float(m) for m in re.findall(r"M:\s*(-?[\d.]+)", log)]
    i = re.findall(r"I:\s*(-?[\d.]+) LUFS", log)
    tp = re.findall(r"Peak:\s*(-?[\d.inf]+) dBFS", log)
    return {"I": float(i[-1]) if i else -70.0, "M": max(ms) if ms else -70.0, "peak": float(tp[-1]) if tp else 0.0}


def rms_db(x: np.ndarray) -> float:
    return float(20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12))


def loudest_400ms_db(x: np.ndarray) -> float:
    w = int(0.4 * SR)
    if len(x) <= w:
        return rms_db(x)
    c = np.concatenate([[0.0], np.cumsum(x**2)])
    return float(10 * np.log10((c[w:] - c[:-w]).max() / w + 1e-12))


def db_to_gain(db: float) -> float:
    return float(10 ** (db / 20))


def trim(x: np.ndarray, floor_db: float = -50.0, pre: float = 0.004, fade: float = 0.04) -> np.ndarray:
    """Cut leading/trailing audio quieter than floor_db below the peak, keep a few ms before the
    attack, fade the tail out."""
    env = np.abs(x)
    thr = env.max() * db_to_gain(floor_db)
    idx = np.where(env > thr)[0]
    a = max(0, idx[0] - int(pre * SR))
    b = min(len(x), idx[-1] + int(0.01 * SR))
    y = x[a:b].copy()
    n = min(len(y) // 4, int(fade * SR))
    if n > 0:
        y[-n:] *= np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    m = min(len(y) // 8, int(0.002 * SR))
    if m > 0:
        y[:m] *= np.linspace(0, 1, m)
    return y


def envelope(n: int, attack: float, release: float) -> np.ndarray:
    e = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    e[:a] = np.linspace(0, 1, a)
    e[n - r:] *= np.linspace(1, 0, r) ** 2
    return e


def generate(kind: str) -> np.ndarray:
    if kind == "scale_beep":
        # A digital scale settling: one short piezo beep (a sine with a little 3rd harmonic).
        n = int(0.11 * SR)
        t = np.arange(n) / SR
        f = 3150.0
        tone = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 3 * f * t)
        y = tone * envelope(n, 0.003, 0.02)
        return np.concatenate([np.zeros(int(0.004 * SR)), y, np.zeros(int(0.02 * SR))])
    if kind == "keypad":
        # Three phone keypad tones (DTMF 7, 3, 1): dialling the specialist.
        digits = [(852, 1209), (697, 1477), (697, 1209)]
        parts = [np.zeros(int(0.004 * SR))]
        for lo, hi in digits:
            n = int(0.085 * SR)
            t = np.arange(n) / SR
            parts.append((np.sin(2 * np.pi * lo * t) + np.sin(2 * np.pi * hi * t)) * 0.5 * envelope(n, 0.004, 0.012))
            parts.append(np.zeros(int(0.065 * SR)))
        return np.concatenate(parts)
    raise SystemExit(f"unknown generator {kind}")


def mix_layers(layers: list, cache: Path) -> np.ndarray:
    parts = []
    for src_id, member, at, gain_db, af in layers:
        x = decode(fetch(src_id, member, cache), af)
        x = x * db_to_gain(gain_db - loudest_400ms_db(x))
        parts.append((int(at * SR), x))
    n = max(off + len(x) for off, x in parts)
    out = np.zeros(n)
    for off, x in parts:
        out[off:off + len(x)] += x
    return out


def limit(x: np.ndarray, ceiling_db: float) -> np.ndarray:
    """Lookahead peak limiter (ffmpeg alimiter, delay-compensated)."""
    n = len(x)
    pad = np.concatenate([x, np.zeros(int(0.1 * SR))])
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-af", f"alimiter=limit={db_to_gain(ceiling_db):.4f}:attack=1:release=40:level=0:latency=1", "-f", "f64le", "-"],
        input=pad.tobytes(), capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float64)[:n].copy()


def normalise(x: np.ndarray, kind: str) -> tuple[np.ndarray, dict[str, float]]:
    """One-shots: bring the loudest 400 ms to ONE_SHOT_LUFS, limiting at most MAX_LIMIT_DB of
    transient peak to get there (short clicks that still fall short are evened out by their
    runtime gain). Ambience: integrated loudness to AMBIENCE_LUFS."""
    if kind == "one_shot":
        m = loudness(x)
        g = ONE_SHOT_LUFS - m["M"]
        over = m["peak"] + g - PEAK_DBFS
        if over > 0:
            g -= max(0.0, over - MAX_LIMIT_DB)
            x = limit(x * db_to_gain(g), PEAK_DBFS - 0.6)
        else:
            x = x * db_to_gain(g)
        m = loudness(x)
        # A sharp click can still overshoot between samples after the limiter: pull it back under.
        if m["peak"] > PEAK_DBFS - 0.5:
            x = x * db_to_gain(PEAK_DBFS - 0.5 - m["peak"])
            m = loudness(x)
        return x, m
    for _ in range(3):
        m = loudness(x)
        g = AMBIENCE_LUFS - m["I"]
        if m["peak"] + g > PEAK_DBFS - 0.5:  # headroom for the MP3 encoder's overshoot
            g = PEAK_DBFS - 0.5 - m["peak"]
        if abs(g) < 0.1:
            break
        x = x * db_to_gain(g)
    return x, loudness(x)


def encode(x: np.ndarray, name: str, bitrate: str, sub: str = "") -> Path:
    out = OUT / sub if sub else OUT
    out.mkdir(parents=True, exist_ok=True)
    dst = out / f"{name}.mp3"
    with tempfile.TemporaryDirectory() as td:
        w = Path(td) / "a.wav"
        write_wav(w, x)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(w), "-map_metadata", "-1", "-ac", "1", "-ar", str(SR),
             "-c:a", "libmp3lame", "-b:a", bitrate, "-write_xing", "1", str(dst)],
            check=True,
        )
    return dst


def build_ambience(cache: Path) -> np.ndarray:
    loop = AMBIENCE["loop"]
    total = loop + LOOP_XFADE
    n = int(total * SR)
    ref = None
    out = np.zeros(n)
    for src_id, member, start, af, level in AMBIENCE["layers"]:
        path = fetch(src_id, member, cache)
        x = decode(path, af, start, total + 1)
        if len(x) < n:  # tile a short bed with 1 s equal-power crossfades
            f = int(1.0 * SR)
            tiled = x.copy()
            fin = np.sin(np.linspace(0, np.pi / 2, f))
            while len(tiled) < n:
                head = tiled[:-f]
                seam = tiled[-f:] * fin[::-1] + x[:f] * fin
                tiled = np.concatenate([head, seam, x[f:]])
            x = tiled
        x = x[:n]
        if ref is None:
            ref = rms_db(x)
        out += x * db_to_gain(ref + level - rms_db(x))
    # Seamless loop: crossfade the tail past `loop` into the head.
    L, F = int(loop * SR), int(LOOP_XFADE * SR)
    y = out[:L].copy()
    th = np.linspace(0, np.pi / 2, F)
    y[:F] = out[:F] * np.sin(th) + out[L:L + F] * np.cos(th)
    return y


def build_bed(r: dict, cache: Path) -> np.ndarray:
    src_id, member = r["src"]
    x = decode(fetch(src_id, member, cache), r["af"])
    F = int(BED_XFADE * SR)
    L = len(x) - F
    y = x[:L].copy()
    th = np.linspace(0, np.pi / 2, F)
    y[:F] = x[:F] * np.sin(th) + x[L:] * np.cos(th)
    return y


def seam_jump(x: np.ndarray) -> float:
    """How big the step from the last sample back to the first is, against the loop's typical
    sample-to-sample step (about 1 = no click)."""
    d = np.abs(np.diff(x))
    return float(abs(x[0] - x[-1]) / (np.percentile(d, 99) + 1e-12))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--cache", default=str(ROOT / "art" / "out" / "audio"))
    args = ap.parse_args()
    only = {s for s in args.only.split(",") if s}
    cache = Path(args.cache)
    for name, r in RECIPES.items():
        if only and name not in only:
            continue
        x = generate(r["generate"]) if "generate" in r else mix_layers(r["layers"], cache)
        x = trim(x)
        x, m = normalise(x, "one_shot")
        dst = encode(x, name, r["bitrate"], r.get("dir", ""))
        print(f"{name:<12} {len(x)/SR:5.2f}s  M {m['M']:6.1f}  peak {m['peak']:5.1f}  {dst.stat().st_size:7d} B")
    if not only or "ambience" in only:
        x = build_ambience(cache)
        x, m = normalise(x, "ambience")
        dst = encode(x, "ambience", AMBIENCE["bitrate"])
        print(f"{'ambience':<12} {len(x)/SR:5.2f}s  I {m['I']:6.1f}  peak {m['peak']:5.1f}  {dst.stat().st_size:7d} B")
    for name, r in BEDS.items():
        if only and name not in only:
            continue
        x = build_bed(r, cache)
        x, m = normalise(x, "ambience")
        dst = encode(x, name, r["bitrate"], "lazy")
        print(f"{name:<12} {len(x)/SR:5.2f}s  I {m['I']:6.1f}  peak {m['peak']:5.1f}  seam {seam_jump(x):4.2f}  {dst.stat().st_size:7d} B")
    total = sum(f.stat().st_size for f in OUT.glob("*.mp3"))
    lazy = sum(f.stat().st_size for f in (OUT / "lazy").glob("*.mp3"))
    print(f"lazy {lazy} B in {OUT / 'lazy'}")
    print(f"total {total} B in {OUT}")


if __name__ == "__main__":
    main()
