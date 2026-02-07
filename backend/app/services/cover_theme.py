import hashlib
from typing import Tuple

ICON_CHOICES = [
    "guitar",
    "music",
    "activity",
    "keyboard-music",
    "audio-waveform",
    "music-2",
    "music-4",
    "mic-vocal",
]

COLOR_CHOICES = [
    "#FF6F91",
    "#FF9671",
    "#FFC75F",
    "#F9F871",
    "#A0E7E5",
    "#B4F8C8",
    "#FBE7C6",
    "#C9B6E4",
]


def compute_theme(seed: str) -> Tuple[str, str]:
    digest = hashlib.md5(seed.encode("utf-8")).hexdigest()
    color = COLOR_CHOICES[int(digest[:8], 16) % len(COLOR_CHOICES)]
    icon = ICON_CHOICES[int(digest[8:16], 16) % len(ICON_CHOICES)]
    return color, icon
