#!/usr/bin/env python3
"""Generate mic-idle and mic-active icons for bacon-voice AHK tray."""
from pathlib import Path

try:
    from PIL import Image, ImageDraw
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

def make_icon(path: Path, active: bool):
    """Draw a simple microphone icon. active=True -> red, False -> gray."""
    size = 32
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background circle
    bg_color = (200, 50, 50, 220) if active else (80, 80, 80, 200)
    draw.ellipse([1, 1, size-2, size-2], fill=bg_color)

    # Microphone body (rounded rectangle)
    mic_color = (255, 255, 255, 255)
    draw.rounded_rectangle([11, 4, 21, 18], radius=5, fill=mic_color)

    # Stand / arc
    draw.arc([8, 10, 24, 24], start=0, end=180, fill=mic_color, width=2)

    # Stem
    draw.line([16, 24, 16, 28], fill=mic_color, width=2)
    draw.line([12, 28, 20, 28], fill=mic_color, width=2)

    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(path), format="PNG")
    print(f"Created: {path}")

if not HAS_PIL:
    print("Pillow not installed. Install with: pip install Pillow")
    print("Creating placeholder text files instead...")
    icons_dir = Path("tools/icons")
    icons_dir.mkdir(exist_ok=True)
    (icons_dir / "mic-idle.png").write_text("placeholder")
    (icons_dir / "mic-active.png").write_text("placeholder")
else:
    make_icon(Path("tools/icons/mic-idle.png"), active=False)
    make_icon(Path("tools/icons/mic-active.png"), active=True)
    print("Icons generated successfully.")
