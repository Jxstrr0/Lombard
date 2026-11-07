"""
Voice pilot lines (docs/04-ASSETS.md § Voice).

    python3 art/audio/voice.py [--src art/out/voice]

The lines were made with ElevenLabs text to speech (the script sheet is
art/audio/voice-lines.csv: line id, character, trigger, text, voice and the
picked take). Download each picked take as its `file_name` into --src
(gitignored), then run this: it trims the silence at both ends, normalises
loudness and writes mono 64 kbps MP3s to public/assets/audio/voice/.

Loudness: integrated VOICE_LUFS with true peaks under PEAK_DBTP. Speech reads
quieter than the one-shot foley at the same meter level, so it sits a little
above them; the runtime gain is VOICE_MIX.gain in src/data/voice.ts.

The outputs are committed: CI never runs this. Needs ffmpeg with libmp3lame.
"""

from __future__ import annotations

import argparse
import csv
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SHEET = ROOT / "art" / "audio" / "voice-lines.csv"
OUT = ROOT / "public" / "assets" / "audio" / "voice"
VOICE_LUFS = -18
PEAK_DBTP = -1.5
BITRATE = "64k"
# Silence trim: below -45 dB for 0.08 s at the start; the same at the end (reversed).
TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08"
PAD = "apad=pad_dur=0.06"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(ROOT / "art" / "out" / "voice"))
    args = ap.parse_args()
    src = Path(args.src)
    OUT.mkdir(parents=True, exist_ok=True)
    with SHEET.open(newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r["status"] == "picked"]
    for r in rows:
        name = r["file_name"]
        chain = f"{TRIM},areverse,{TRIM},areverse,{PAD},loudnorm=I={VOICE_LUFS}:TP={PEAK_DBTP}:LRA=11"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src / name), "-af", chain,
             "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", BITRATE, "-map_metadata", "-1",
             str(OUT / name)],
            check=True,
        )
    total = sum((OUT / r["file_name"]).stat().st_size for r in rows)
    print(f"{len(rows)} lines, {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
