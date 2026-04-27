#!/usr/bin/env python3
"""Build composite images for pitch deck slides."""

import os
from PIL import Image, ImageDraw, ImageFilter

DIR = os.path.dirname(os.path.abspath(__file__))

def round_corners(img, radius):
    img = img.convert('RGBA')
    w, h = img.size
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (w, h)], radius=radius, fill=255)
    img.putalpha(mask)
    return img

def add_shadow(img, offset=(8, 10), blur_radius=15, opacity=100):
    img = img.convert('RGBA')
    w, h = img.size
    pad = blur_radius * 2 + max(abs(offset[0]), abs(offset[1]))
    canvas = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shadow = Image.new('RGBA', (w, h), (0, 0, 0, opacity))
    shadow.putalpha(img.split()[3])
    shadow_canvas = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    shadow_canvas.paste(shadow, (pad + offset[0], pad + offset[1]))
    shadow_canvas = shadow_canvas.filter(ImageFilter.GaussianBlur(blur_radius))
    canvas = Image.alpha_composite(canvas, shadow_canvas)
    canvas.paste(img, (pad, pad), img)
    crop_pad = blur_radius
    canvas = canvas.crop((crop_pad, crop_pad, w + pad + crop_pad, h + pad + crop_pad))
    return canvas

def load_and_process(filename, size, radius=16):
    path = os.path.join(DIR, filename)
    if not os.path.exists(path):
        print(f"  SKIP: {filename} not found")
        return None
    img = Image.open(path).convert('RGBA')
    img = img.resize(size, Image.LANCZOS)
    img = round_corners(img, radius)
    img = add_shadow(img, offset=(6, 8), blur_radius=12, opacity=80)
    return img

# ═══ Composite 1: Competition slide — messy tools ═══
print("Building competition composite (messy tools)...")
canvas_w, canvas_h = 2400, 1350
canvas = Image.new('RGBA', (canvas_w, canvas_h), (9, 9, 7, 255))

# Scatter multiple overlapping screenshots at different angles
items = [
    ('linktree-screenshot.png', (700, 440), -8, (50, 50)),
    ('ga-screenshot.png', (750, 470), 5, (500, 30)),
    ('youtube-analytics.png', (680, 430), -3, (1150, 100)),
    ('instagram-insights.png', (620, 390), 7, (100, 500)),
    ('tiktok-analytics.png', (700, 440), -6, (700, 480)),
    ('chatgpt-screenshot.png', (650, 410), 4, (1400, 450)),
    ('linktree-screenshot.png', (500, 315), -10, (1650, 20)),
    ('ga-screenshot.png', (550, 345), 8, (1100, 600)),
]

for filename, (tw, th), rotation, (px, py) in items:
    img = load_and_process(filename, (tw, th), radius=14)
    if img is None:
        continue
    if rotation != 0:
        img = img.rotate(-rotation, resample=Image.BICUBIC, expand=True)
    canvas.paste(img, (px, py), img)

# Add a red "X" / confusion overlay feel — scattered red lines
draw = ImageDraw.Draw(canvas)
for i in range(8):
    x1 = 200 + i * 280
    y1 = 100 + (i % 3) * 300
    draw.line([(x1, y1), (x1 + 60, y1 + 60)], fill=(239, 68, 68, 40), width=3)
    draw.line([(x1 + 60, y1), (x1, y1 + 60)], fill=(239, 68, 68, 40), width=3)

# Dark vignette edges
vignette = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
vdraw = ImageDraw.Draw(vignette)
# Top and bottom dark gradient strips
for i in range(200):
    alpha = int(180 * (1 - i / 200))
    vdraw.rectangle([(0, i), (canvas_w, i + 1)], fill=(9, 9, 7, alpha))
    vdraw.rectangle([(0, canvas_h - i), (canvas_w, canvas_h - i + 1)], fill=(9, 9, 7, alpha))
for i in range(150):
    alpha = int(140 * (1 - i / 150))
    vdraw.rectangle([(i, 0), (i + 1, canvas_h)], fill=(9, 9, 7, alpha))
    vdraw.rectangle([(canvas_w - i, 0), (canvas_w - i + 1, canvas_h)], fill=(9, 9, 7, alpha))
canvas = Image.alpha_composite(canvas, vignette)

output = os.path.join(DIR, 'messy-tools-composite.png')
canvas.save(output, 'PNG')
print(f"  OK: messy-tools-composite.png ({canvas_w}x{canvas_h})")

# ═══ Composite 2: Problem slide — 3 disconnected tools ═══
print("\nBuilding problem composite (3 disconnected tools)...")
canvas_w, canvas_h = 1800, 1000
canvas = Image.new('RGBA', (canvas_w, canvas_h), (9, 9, 7, 255))

tools = [
    ('ga-screenshot.png', (520, 330), -3, (30, 180)),
    ('linktree-screenshot.png', (520, 330), 2, (640, 180)),
    ('chatgpt-screenshot.png', (520, 330), -2, (1250, 180)),
]

for filename, (tw, th), rotation, (px, py) in tools:
    img = load_and_process(filename, (tw, th), radius=14)
    if img is None:
        continue
    if rotation != 0:
        img = img.rotate(-rotation, resample=Image.BICUBIC, expand=True)
    canvas.paste(img, (px, py), img)

# Draw disconnection lines (dashed red lines between them)
draw = ImageDraw.Draw(canvas)
# Between tool 1 and 2
for i in range(0, 100, 12):
    draw.line([(560 + i, 350), (570 + i, 350)], fill=(239, 68, 68, 80), width=2)
# Between tool 2 and 3
for i in range(0, 100, 12):
    draw.line([(1170 + i, 350), (1180 + i, 350)], fill=(239, 68, 68, 80), width=2)

# Red X between each
draw.line([(590, 330), (630, 370)], fill=(239, 68, 68, 120), width=3)
draw.line([(630, 330), (590, 370)], fill=(239, 68, 68, 120), width=3)
draw.line([(1200, 330), (1240, 370)], fill=(239, 68, 68, 120), width=3)
draw.line([(1240, 330), (1200, 370)], fill=(239, 68, 68, 120), width=3)

output = os.path.join(DIR, 'disconnected-tools.png')
canvas.save(output, 'PNG')
print(f"  OK: disconnected-tools.png ({canvas_w}x{canvas_h})")

print("\nDone!")
