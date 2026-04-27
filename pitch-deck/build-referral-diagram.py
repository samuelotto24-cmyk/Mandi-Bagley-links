#!/usr/bin/env python3
"""Build referral program flow diagram for pitch deck slide 8."""

import os
from PIL import Image, ImageDraw, ImageFont

DIR = os.path.dirname(os.path.abspath(__file__))

canvas_w, canvas_h = 1600, 900
canvas = Image.new('RGBA', (canvas_w, canvas_h), (9, 9, 7, 255))
draw = ImageDraw.Draw(canvas)

# Colors
accent = (16, 185, 129)
accent_dim = (16, 185, 129, 40)
blue = (79, 142, 247)
purple = (124, 106, 247)
gold = (245, 158, 11)
green = (34, 197, 94)
white = (235, 231, 223)
muted = (139, 149, 168)
card_bg = (14, 13, 11, 200)
border = (255, 248, 220, 23)

# ── Draw rounded rectangle helper ──
def rounded_rect(x, y, w, h, radius, fill, outline=None):
    draw.rounded_rectangle([(x, y), (x + w, y + h)], radius=radius, fill=fill, outline=outline)

# ── Draw arrow ──
def draw_arrow(x1, y1, x2, y2, color, width=3):
    draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
    # Arrowhead
    import math
    angle = math.atan2(y2 - y1, x2 - x1)
    arrow_len = 12
    arrow_angle = 0.4
    ax1 = x2 - arrow_len * math.cos(angle - arrow_angle)
    ay1 = y2 - arrow_len * math.sin(angle - arrow_angle)
    ax2 = x2 - arrow_len * math.cos(angle + arrow_angle)
    ay2 = y2 - arrow_len * math.sin(angle + arrow_angle)
    draw.polygon([(x2, y2), (int(ax1), int(ay1)), (int(ax2), int(ay2))], fill=color)

# ── Central flow diagram ──

# Step 1: Existing Client (left)
rounded_rect(60, 280, 280, 140, 16, (14, 13, 11), border)
draw.rounded_rectangle([(60, 280), (340, 286)], radius=2, fill=accent)
draw.text((110, 300), "👤", fill=white, font=None)
draw.text((140, 300), "Existing Client", fill=white)
draw.text((100, 340), "Opens Hub, copies", fill=muted)
draw.text((100, 365), "referral code", fill=muted)

# Arrow 1→2
draw_arrow(340, 350, 440, 350, accent)
draw.text((355, 325), "Sends code", fill=accent)

# Step 2: Friend/Creator (center-left)
rounded_rect(440, 280, 280, 140, 16, (14, 13, 11), border)
draw.rounded_rectangle([(440, 280), (720, 286)], radius=2, fill=blue)
draw.text((490, 300), "👋", fill=white, font=None)
draw.text((520, 300), "New Creator", fill=white)
draw.text((480, 340), "Visits packages page,", fill=muted)
draw.text((480, 365), "enters referral code", fill=muted)

# Arrow 2→3
draw_arrow(720, 350, 820, 350, blue)
draw.text((730, 325), "Books call", fill=blue)

# Step 3: Sam closes (center-right)
rounded_rect(820, 280, 280, 140, 16, (14, 13, 11), border)
draw.rounded_rectangle([(820, 280), (1100, 286)], radius=2, fill=purple)
draw.text((870, 300), "📞", fill=white, font=None)
draw.text((900, 300), "Sam Closes", fill=white)
draw.text((860, 340), "Call via Calendly,", fill=muted)
draw.text((860, 365), "sees referral code", fill=muted)

# Arrow 3→4
draw_arrow(1100, 350, 1200, 350, purple)
draw.text((1110, 325), "Signs up", fill=purple)

# Step 4: Everyone wins (right)
rounded_rect(1200, 280, 340, 140, 16, (14, 13, 11), border)
draw.rounded_rectangle([(1200, 280), (1540, 286)], radius=2, fill=gold)
draw.text((1250, 300), "🎉", fill=white, font=None)
draw.text((1280, 300), "Everyone Wins", fill=white)
draw.text((1240, 340), "Referrer: 1 free month", fill=green)
draw.text((1240, 365), "New client: $100 off", fill=gold)

# ── Bottom: Flywheel arrow back ──
# Curved arrow from Step 4 back to Step 1
draw.arc([(200, 430), (1400, 620)], start=0, end=180, fill=(*accent, 80), width=2)
draw.text((700, 545), "New client refers more creators →", fill=accent)

# ── Top stats ──
rounded_rect(200, 80, 300, 90, 12, (14, 13, 11), border)
draw.text((240, 100), "Referrer Gets", fill=muted)
draw.text((240, 125), "1 Free Month", fill=green)

rounded_rect(650, 80, 300, 90, 12, (14, 13, 11), border)
draw.text((690, 100), "New Client Gets", fill=muted)
draw.text((690, 125), "$100 Off Setup", fill=gold)

rounded_rect(1100, 80, 300, 90, 12, (14, 13, 11), border)
draw.text((1140, 100), "Months Stack", fill=muted)
draw.text((1140, 125), "No Limit", fill=accent)

# ── Title at very top ──
draw.text((60, 20), "REFERRAL FLYWHEEL", fill=accent)

# Save
output = os.path.join(DIR, 'referral-diagram.png')
canvas.save(output, 'PNG')
print(f"OK: referral-diagram.png ({canvas_w}x{canvas_h})")
