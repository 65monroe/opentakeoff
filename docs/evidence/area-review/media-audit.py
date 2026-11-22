"""Decode each public evidence image/frame; never edit the media.

Requires Pillow. Run from the checkout root. This validates file integrity,
not visual quality; the primary exhibits also need direct visual inspection.
"""
from collections import Counter
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageSequence

root = Path(__file__).resolve().parents[3]
commands = [
    ["git", "diff", "--name-only", "8a31fb4..HEAD"],
    ["git", "diff", "--name-only", "HEAD"],
    ["git", "ls-files", "--others", "--exclude-standard", "docs/evidence/area-review", "docs/evidence/planting-suite/screenshots"],
]
paths = set()
for command in commands:
    paths.update(subprocess.check_output(command, cwd=root, text=True).splitlines())

formats = Counter()
errors = []
images = frames = 0
for name in sorted(paths):
    path = root / name
    if not name.startswith("docs/evidence/") or path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".gif"} or not path.is_file():
        continue
    try:
        with Image.open(path) as image:
            expected = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".gif": "GIF"}[path.suffix.lower()]
            if image.format != expected:
                errors.append({"file": name, "error": f"Expected {expected}, found {image.format}"})
            formats[image.format] += 1
            for frame in ImageSequence.Iterator(image):
                frame.load()
                frames += 1
        images += 1
    except Exception as error:
        errors.append({"file": name, "error": str(error)})

result = {
    "scope": "Public evidence images changed on this fork since 8a31fb4, including working changes",
    "decoded_images": images,
    "decoded_frames": frames,
    "formats": dict(formats),
    "errors": errors,
    "limit": "Decoding is an integrity check, not a claim that every historical screenshot was visually re-reviewed.",
}
(Path(__file__).parent / "media-audit.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2))
raise SystemExit(bool(errors))
