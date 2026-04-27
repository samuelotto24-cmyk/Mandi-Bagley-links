#!/usr/bin/env python3
"""Pre-process screenshots for pitch deck: rounded corners, shadows, and slide 2 composite."""

import os
from PIL import Image, ImageDraw, ImageFilter

DECK_DIR = os.path.dirname(os.path.abspath(__file__))

def round_corners(img, radius):
    """Apply rounded corners using an alpha mask."""
    img = img.convert('RGBA')
    w, h = img.size
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (w, h)], radius=radius, fill=255)
    img.putalpha(mask)
    return img

def add_shadow(img, offset=(8, 10), blur_radius=20, opacity=90):
    """Add a drop shadow behind the image."""
    img = img.convert('RGBA')
    w, h = img.size
    # Create larger canvas for shadow
    pad = blur_radius * 2 + max(abs(offset[0]), abs(offset[1]))
    canvas = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    # Shadow layer
    shadow = Image.new('RGBA', (w, h), (0, 0, 0, opacity))
    # Use the image's alpha as shadow shape
    shadow.putalpha(img.split()[3])
    shadow_canvas = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    shadow_canvas.paste(shadow, (pad + offset[0], pad + offset[1]))
    shadow_canvas = shadow_canvas.filter(ImageFilter.GaussianBlur(blur_radius))
    # Composite: shadow first, then image on top
    canvas = Image.alpha_composite(canvas, shadow_canvas)
    canvas.paste(img, (pad, pad), img)
    # Crop to remove excess padding (keep some for shadow visibility)
    crop_pad = blur_radius
    canvas = canvas.crop((crop_pad, crop_pad, w + pad + crop_pad, h + pad + crop_pad))
    return canvas

def process_screenshot(input_name, output_name, radius=16, shadow=True):
    """Process a single screenshot: rounded corners + optional shadow."""
    input_path = os.path.join(DECK_DIR, input_name)
    output_path = os.path.join(DECK_DIR, output_name)
    if not os.path.exists(input_path):
        print(f"  SKIP: {input_name} not found")
        return False
    img = Image.open(input_path)
    img = round_corners(img, radius)
    if shadow:
        img = add_shadow(img)
    img.save(output_path, 'PNG')
    print(f"  OK: {output_name} ({img.size[0]}x{img.size[1]})")
    return True

def build_slide2_composite():
    """Build the scattered-screenshots composite for slide 2."""
    print("\nBuilding slide 2 composite...")
    canvas_w, canvas_h = 2400, 1350
    canvas = Image.new('RGBA', (canvas_w, canvas_h), (10, 14, 26, 255))  # #0A0E1A

    screenshots = [
        ('youtube-analytics.png', (900, 560), -4, (80, 120)),
        ('instagram-insights.png', (780, 490), 6, (1480, 80)),
        ('tiktok-analytics.png', (820, 520), -5, (680, 680)),
    ]

    for filename, (tw, th), rotation, (px, py) in screenshots:
        path = os.path.join(DECK_DIR, filename)
        if not os.path.exists(path):
            print(f"  SKIP: {filename} not found for composite")
            continue
        img = Image.open(path).convert('RGBA')
        img = img.resize((tw, th), Image.LANCZOS)
        img = round_corners(img, 20)
        img = add_shadow(img, offset=(8, 10), blur_radius=20, opacity=90)
        if rotation != 0:
            img = img.rotate(-rotation, resample=Image.BICUBIC, expand=True)
        canvas.paste(img, (px, py), img)

    # Text overlays using simple drawing (no custom fonts needed)
    draw = ImageDraw.Draw(canvas)

    # Bottom dark strip for text readability
    overlay = Image.new('RGBA', (canvas_w, 250), (10, 14, 26, 220))
    canvas.paste(overlay, (0, canvas_h - 250), overlay)

    # Save
    output_path = os.path.join(DECK_DIR, 'slide2-composite.png')
    canvas.save(output_path, 'PNG')
    print(f"  OK: slide2-composite.png ({canvas_w}x{canvas_h})")

# ── Main ──
print("Processing screenshots for pitch deck...\n")

# Process individual screenshots
files = [
    ('mandi-hero.png', 'processed-mandi-hero.png'),
    ('mandi-codes.png', 'processed-mandi-codes.png'),
    ('hub-dashboard.png', 'processed-hub-dashboard.png'),
    ('hub-ai.png', 'processed-hub-ai.png'),
    ('bysamotto-hero.png', 'processed-bysamotto-hero.png'),
    ('bysamotto-comparison.png', 'processed-bysamotto-comparison.png'),
    ('linktree-screenshot.png', 'processed-linktree-screenshot.png'),
]

for input_name, output_name in files:
    process_screenshot(input_name, output_name)

# Build slide 2 composite
build_slide2_composite()

print("\nDone! All processed images saved to pitch-deck/")
