#!/usr/bin/env python3
"""Tạo bộ icon cho Hai Trái Tim.

Cách dùng:
  python3 scripts/make-icons.py                 # icon trái tim mặc định
  python3 scripts/make-icons.py <ảnh-của-bạn>   # dùng ảnh của bạn làm icon (cần Pillow)

Ảnh nguồn phải là ảnh bạn có quyền sử dụng. Kết quả ghi vào thư mục assets/.
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)
PINK = (230, 73, 128)
DEEP = (168, 7, 67)
SOFT = (255, 228, 236)


def heart_points(size, scale=0.46, samples=600):
    points = []
    for index in range(samples):
        t = 2 * math.pi * index / samples
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        points.append((size / 2 + x * size * scale / 34, size / 2 - y * size * scale / 34))
    return points


def gradient(size, top=SOFT, bottom=(255, 241, 242)):
    image = Image.new("RGB", (size, size), top)
    draw = ImageDraw.Draw(image)
    for y in range(size):
        ratio = y / max(1, size - 1)
        draw.line(
            [(0, y), (size, y)],
            fill=(
                int(top[0] + (bottom[0] - top[0]) * ratio),
                int(top[1] + (bottom[1] - top[1]) * ratio),
                int(top[2] + (bottom[2] - top[2]) * ratio),
            ),
        )
    return image


def heart_mask(size, scale=0.62, samples=1200):
    big = size * 2
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).polygon(heart_points(big, scale, samples), fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def vertical_gradient(size, top, bottom):
    image = Image.new("RGB", (size, size), top)
    draw = ImageDraw.Draw(image)
    for y in range(size):
        ratio = y / max(1, size - 1)
        draw.line(
            [(0, y), (size, y)],
            fill=(
                int(top[0] + (bottom[0] - top[0]) * ratio),
                int(top[1] + (bottom[1] - top[1]) * ratio),
                int(top[2] + (bottom[2] - top[2]) * ratio),
            ),
        )
    return image


def photo_icon(source, size):
    photo = ImageOps.exif_transpose(Image.open(source)).convert("RGB")
    width, height = photo.size
    side = min(width, height)
    left = (width - side) // 2
    top = int((height - side) * 0.18)
    photo = photo.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)
    vignette = Image.new("L", (size, size), 0)
    ImageDraw.Draw(vignette).ellipse(
        [-size * 0.15, -size * 0.15, size * 1.15, size * 1.15], fill=255
    )
    vignette = vignette.filter(ImageFilter.GaussianBlur(size * 0.08))
    pink = Image.new("RGB", (size, size), SOFT)
    return Image.composite(photo, pink, vignette)


def circular(image, size, ratio=0.66):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * ratio)
    avatar = image.convert("RGBA").resize((inner, inner), Image.LANCZOS)
    mask = Image.new("L", (inner, inner), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, inner, inner], fill=255)
    avatar.putalpha(mask)
    offset = (size - inner) // 2
    canvas.alpha_composite(avatar, (offset, offset))
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse(
        [offset - size * 0.012, offset - size * 0.012, size - offset + size * 0.012, size - offset + size * 0.012],
        outline=PINK + (255,),
        width=max(2, int(size * 0.018)),
    )
    canvas.alpha_composite(ring)
    return canvas


def notification_icon(size=96):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(layer).polygon(
        heart_points(size, 0.45), fill=(255, 255, 255, 255)
    )
    return layer


def default_logo(size):
    canvas = vertical_gradient(size, SOFT, (255, 250, 251)).convert("RGBA")
    mask = heart_mask(size, 0.62)
    heart = vertical_gradient(size, (246, 106, 160), (186, 12, 74)).convert("RGBA")
    shade = Image.new("L", (size, size), 0)
    ImageDraw.Draw(shade).ellipse(
        [size * 0.3, size * 0.18, size * 0.62, size * 0.42], fill=120
    )
    shade = shade.filter(ImageFilter.GaussianBlur(size * 0.035))
    highlight = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    highlight.putalpha(Image.composite(shade, Image.new("L", (size, size), 0), mask))
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(size * 0.035)).point(lambda v: int(v * 0.35)))
    shadowed = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadowed.alpha_composite(shadow, (0, int(size * 0.03)))
    canvas.alpha_composite(shadowed)
    heart.putalpha(mask)
    canvas.alpha_composite(heart)
    canvas.alpha_composite(highlight)
    return canvas


def build(source=None):
    size = 1024
    if source:
        print(f"Đang dùng ảnh người dùng: {source}")
        logo = photo_icon(source, size).convert("RGBA")
    else:
        print("Đang dùng icon trái tim mặc định (chưa có ảnh người dùng).")
        logo = default_logo(size)
    logo.convert("RGB").save(ASSETS / "icon.png")
    logo.convert("RGB").resize((64, 64), Image.LANCZOS).save(ASSETS / "favicon.png")
    circular(logo, size, 0.62).save(ASSETS / "adaptive-icon.png")
    circular(logo.resize((512, 512), Image.LANCZOS), 512, 0.9).save(ASSETS / "splash-icon.png")
    notification_icon().save(ASSETS / "notification-icon.png")
    print("Đã ghi:", ", ".join(sorted(p.name for p in ASSETS.glob("*.png"))))


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else None)
