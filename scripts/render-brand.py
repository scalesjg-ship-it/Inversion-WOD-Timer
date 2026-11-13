#!/usr/bin/env python3
"""Render Americana store art from assets/brand/americana-mark.svg.

Requires cairosvg, cairo, and Pillow. From the repo root:

    python3 scripts/render-brand.py
"""

from __future__ import annotations

from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MARK = ROOT / "assets" / "brand" / "americana-mark.svg"
FONT = ROOT / "assets" / "fonts" / "Oswald-Bold.ttf"
IMAGES = ROOT / "assets" / "images"
TV = ROOT / "assets" / "tv"
STORE = ROOT / "assets" / "store"

INK = (244, 241, 234, 255)
RED = (255, 59, 36, 255)
BG = (12, 13, 16, 255)


def svg_text() -> str:
    return MARK.read_text(encoding="utf-8")


def render_svg(svg: str, width: int, height: int) -> Image.Image:
    png = cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=width, output_height=height)
    from io import BytesIO

    return Image.open(BytesIO(png)).convert("RGBA")


def mark_only(mode: str) -> str:
    """mode: full | front | mono"""
    raw = svg_text()
    if mode == "full":
        return raw
    raw = raw.replace('<g id="back">', '<g id="back" display="none">')
    if mode == "mono":
        raw = raw.replace("#FF3B24", "#FFFFFF").replace("#F4F1EA", "#FFFFFF")
    return raw


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG")
    print(path.relative_to(ROOT), image.size)


def paste_mark(canvas: Image.Image, size: int, origin: tuple[int, int], mode: str = "front") -> None:
    mark = render_svg(mark_only(mode), size, size)
    canvas.alpha_composite(mark, origin)


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT), size)


def draw_centered(draw: ImageDraw.ImageDraw, text: str, y: int, font: ImageFont.FreeTypeFont, fill, width: int) -> None:
    box = draw.textbbox((0, 0), text, font=font)
    x = (width - (box[2] - box[0])) / 2
    draw.text((x, y), text, font=font, fill=fill)


def opaque(image: Image.Image) -> Image.Image:
    """Amazon Fire TV rejects an alpha channel on the background and the 1280×720 icon."""
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    flat = Image.new("RGB", image.size, BG[:3])
    flat.paste(image, mask=image.getchannel("A"))
    return flat


def firetv_background(width: int, height: int) -> Image.Image:
    """Put the mark in the upper-right mini-detail.

    Amazon shows this 1920×1080 image in the circle at the top right of Apps and
    subscriptions. The safe subject box is 1214×830, kept off the left side where
    the title sits. A left-aligned banner leaves that circle empty.
    """
    image = Image.new("RGBA", (width, height), BG)
    safe_w = round(width * (1214 / 1920))
    safe_h = round(height * (830 / 1080))
    safe_x = width - round(width * (64 / 1920)) - safe_w
    safe_y = max(0, (height - safe_h) // 2)
    mark = int(min(safe_w, safe_h) * 0.92)
    paste_mark(image, mark, (safe_x + (safe_w - mark) // 2, safe_y + (safe_h - mark) // 2), "full")
    return opaque(image)


def firetv_square_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), BG)
    mark = int(size * 0.86)
    paste_mark(image, mark, ((size - mark) // 2, (size - mark) // 2), "full")
    return opaque(image)


def firetv_wide_icon(width: int, height: int) -> Image.Image:
    """1280×720 Fire TV app icon. The mark is centered so a circular crop still shows it."""
    image = Image.new("RGBA", (width, height), BG)
    mark = int(height * 0.86)
    paste_mark(image, mark, ((width - mark) // 2, (height - mark) // 2), "full")
    return opaque(image)


def banner(width: int, height: int, title_size: int, sub_size: int) -> Image.Image:
    image = Image.new("RGBA", (width, height), BG)
    draw = ImageDraw.Draw(image)
    mark_size = int(height * 0.78)
    margin = int(height * 0.11)
    paste_mark(image, mark_size, (margin, (height - mark_size) // 2), "front")
    title = font(title_size)
    sub = font(sub_size)
    text_x = margin + mark_size + int(width * 0.04)
    title_box = draw.textbbox((0, 0), "AMERICANA", font=title)
    sub_box = draw.textbbox((0, 0), "ROUND TIMER", font=sub)
    block = (title_box[3] - title_box[1]) + int(height * 0.04) + (sub_box[3] - sub_box[1])
    y = (height - block) / 2
    draw.text((text_x, y), "AMERICANA", font=title, fill=INK)
    draw.text((text_x, y + (title_box[3] - title_box[1]) + int(height * 0.04)), "ROUND TIMER", font=sub, fill=RED)
    return image


def splash() -> Image.Image:
    image = Image.new("RGBA", (1024, 1024), BG)
    paste_mark(image, 720, (152, 48), "front")
    draw = ImageDraw.Draw(image)
    title = font(84)
    draw_centered(draw, "AMERICANA", 860, title, INK, 1024)
    return image


def main() -> None:
    icon = render_svg(mark_only("full"), 1024, 1024)
    save(icon, IMAGES / "icon.png")
    save(icon.resize((48, 48), Image.Resampling.LANCZOS), IMAGES / "favicon.png")

    foreground = render_svg(mark_only("front"), 1024, 1024)
    # Keep the mark inside the adaptive-icon safe zone.
    safe = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    shrunk = foreground.resize((700, 700), Image.Resampling.LANCZOS)
    safe.alpha_composite(shrunk, (162, 162))
    save(safe, IMAGES / "android-icon-foreground.png")
    save(Image.new("RGBA", (1024, 1024), BG), IMAGES / "android-icon-background.png")

    mono = render_svg(mark_only("mono"), 1024, 1024)
    mono_safe = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    mono_safe.alpha_composite(mono.resize((700, 700), Image.Resampling.LANCZOS), (162, 162))
    save(mono_safe, IMAGES / "android-icon-monochrome.png")

    note = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    note.alpha_composite(mono.resize((96, 96), Image.Resampling.LANCZOS), (0, 0))
    save(note, IMAGES / "notification-icon.png")
    save(splash(), IMAGES / "splash-icon.png")

    layers = {
        "tvos-icon-front-1280x768.png": (1280, 768),
        "tvos-icon-front-800x480.png": (800, 480),
        "tvos-icon-front-400x240.png": (400, 240),
    }
    for name, (w, h) in layers.items():
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        size = int(h * 0.92)
        paste_mark(canvas, size, ((w - size) // 2, (h - size) // 2), "front")
        save(canvas, TV / name)
        back = Image.new("RGBA", (w, h), BG)
        ImageDraw.Draw(back).ellipse(
            (w * 0.2, h * 0.05, w * 0.8, h * 0.95),
            fill=(23, 25, 31, 255),
        )
        save(back, TV / name.replace("front", "back"))

    save(banner(1920, 720, 120, 42), TV / "topshelf-1920x720.png")
    save(banner(3840, 1440, 240, 84), TV / "topshelf-3840x1440.png")
    save(banner(2320, 720, 110, 40), TV / "topshelf-wide-2320x720.png")
    save(banner(4640, 1440, 220, 80), TV / "topshelf-wide-4640x1440.png")

    save(banner(320, 180, 28, 12), TV / "android-tv-banner.png")
    # Square launcher icon. config-tv points android:icon at this file on Fire TV.
    # A 320×180 bitmap is cropped into the hero circle and the mark falls outside it.
    save(firetv_square_icon(512), TV / "android-tv-icon.png")

    save(icon.resize((512, 512), Image.Resampling.LANCZOS), STORE / "amazon-icon-512.png")
    save(icon.resize((114, 114), Image.Resampling.LANCZOS), STORE / "amazon-icon-114.png")
    save(firetv_wide_icon(1280, 720), STORE / "firetv-background-1280x720.png")
    save(firetv_background(1920, 1080), STORE / "firetv-background-1920x1080.png")

    old = list(TV.glob("placeholder-*"))
    for path in old:
        path.unlink()
        print("removed", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
