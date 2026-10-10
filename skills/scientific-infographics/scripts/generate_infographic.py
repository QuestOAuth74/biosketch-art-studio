#!/usr/bin/env python3
"""
Scientific Infographic Generator
Generates a 1200x680 PNG scientific infographic from a JSON configuration file.
Usage: python generate_infographic.py <config.json> <output.png>
"""

import sys
import json
import os
from PIL import Image, ImageDraw, ImageFont

# ─── Font Helpers ─────────────────────────────────────────────────────────────

FONT_PATHS = {
    "regular": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ],
    "bold": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ],
}


def load_font(style="regular", size=14):
    for path in FONT_PATHS.get(style, FONT_PATHS["regular"]):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


# ─── Drawing Helpers ──────────────────────────────────────────────────────────

def get_text_height(font):
    """Return approximate line height for a font."""
    try:
        ascent, descent = font.getmetrics()
        return ascent + descent
    except Exception:
        return font.size + 4


def draw_text_wrapped(draw, text, x, y, font, max_width, fill, line_spacing=1.3):
    """Draw text with word-wrap and newline support. Returns final y position."""
    paragraphs = text.split("\n")
    y_cursor = y
    lh = int(get_text_height(font) * line_spacing)

    for para in paragraphs:
        if para.strip() == "":
            y_cursor += lh // 2
            continue
        words = para.split()
        current_line = []
        for word in words:
            test_line = " ".join(current_line + [word])
            try:
                w = draw.textlength(test_line, font=font)
            except Exception:
                w = len(test_line) * (font.size // 2)
            if w > max_width and current_line:
                draw.text((x, y_cursor), " ".join(current_line), font=font, fill=fill)
                y_cursor += lh
                current_line = [word]
            else:
                current_line.append(word)
        if current_line:
            draw.text((x, y_cursor), " ".join(current_line), font=font, fill=fill)
            y_cursor += lh

    return y_cursor


def draw_rounded_rect(draw, x1, y1, x2, y2, radius=8, fill=None, outline=None, width=1):
    """Draw a rounded rectangle."""
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill, outline=outline, width=width)


# ─── Panel Rendering ──────────────────────────────────────────────────────────

def render_panel(img, draw, panel, fonts):
    px, py = panel["x"], panel["y"]
    pw, ph = panel["width"], panel["height"]
    pbg = panel.get("background_color", "#FFFFFF")
    border_color = panel.get("border_color", "#BDC3C7")
    header_color = panel.get("header_color", "#2980B9")

    # Panel shadow (subtle)
    shadow_offset = 2
    draw_rounded_rect(draw, px + shadow_offset, py + shadow_offset,
                      px + pw + shadow_offset, py + ph + shadow_offset,
                      radius=6, fill="#D5D8DC")

    # Panel background
    draw_rounded_rect(draw, px, py, px + pw, py + ph,
                      radius=6, fill=pbg, outline=border_color, width=1)

    # Panel title bar
    if "title" in panel:
        header_h = panel.get("header_height", 28)
        draw_rounded_rect(draw, px, py, px + pw, py + header_h,
                          radius=6, fill=header_color)
        # Square off the bottom corners of the header bar
        draw.rectangle([px, py + header_h // 2, px + pw, py + header_h], fill=header_color)
        # Auto-shrink title font to fit panel width
        for title_size in [15, 13, 11, 9]:
            title_font = load_font("bold", title_size)
            try:
                title_w = draw.textlength(panel["title"], font=title_font)
            except Exception:
                title_w = len(panel["title"]) * (title_size // 2)
            if title_w <= pw - 20:
                break
        draw.text((px + 10, py + 5), panel["title"], font=title_font, fill="#FFFFFF")

    # Panel content
    for item in panel.get("content", []):
        render_content_item(img, draw, item, px, py, pw, ph, fonts)


def render_content_item(img, draw, item, px, py, pw, ph, fonts):
    ix = px + item["x"]
    iy = py + item["y"]
    item_type = item["type"]

    if item_type == "text":
        is_bold = item.get("bold", False)
        size = item.get("font_size", 13)
        font = load_font("bold" if is_bold else "regular", size)
        color = item.get("color", "#2C3E50")
        max_w = item.get("max_width", pw - item["x"] - 10)
        draw_text_wrapped(draw, item["text"], ix, iy, font, max_w, color)

    elif item_type == "image":
        img_path = item["path"]
        tw = item.get("width", 100)
        th = item.get("height", 100)
        if os.path.exists(img_path):
            try:
                content_img = Image.open(img_path).convert("RGBA")
                content_img = content_img.resize((tw, th), Image.LANCZOS)
                # Composite onto white background to handle transparency
                bg = Image.new("RGBA", (tw, th), (255, 255, 255, 0))
                bg.paste(content_img, (0, 0), content_img)
                img.paste(bg, (ix, iy), bg)
            except Exception as e:
                print(f"  [Warning] Could not load image '{img_path}': {e}")
                draw.rectangle([ix, iy, ix + tw, iy + th], outline="#E74C3C", width=2)
                draw.text((ix + 4, iy + 4), "Image Error", fill="#E74C3C", font=fonts["small"])
        else:
            print(f"  [Warning] Image not found: {img_path}")
            draw.rectangle([ix, iy, ix + tw, iy + th], outline="#E74C3C", width=2)
            draw.text((ix + 4, iy + 4), "Not Found", fill="#E74C3C", font=fonts["small"])

    elif item_type == "table":
        render_table(draw, item, ix, iy, fonts)

    elif item_type == "divider":
        color = item.get("color", "#BDC3C7")
        draw.line([(ix, iy), (ix + item.get("width", pw - item["x"] - 10), iy)],
                  fill=color, width=1)

    elif item_type == "badge":
        text = item.get("text", "")
        bg = item.get("background", "#E8F8F5")
        fg = item.get("color", "#1E8449")
        font = load_font("bold", item.get("font_size", 12))
        try:
            tw = draw.textlength(text, font=font)
        except Exception:
            tw = len(text) * 7
        th = get_text_height(font)
        pad = 6
        draw_rounded_rect(draw, ix, iy, ix + tw + pad * 2, iy + th + pad,
                          radius=4, fill=bg, outline=fg, width=1)
        draw.text((ix + pad, iy + pad // 2), text, font=font, fill=fg)


def render_table(draw, item, x, y, fonts):
    headers = item.get("headers", [])
    rows = item.get("rows", [])
    col_widths = item.get("col_widths", [100] * len(headers))
    row_height = item.get("row_height", 24)
    header_bg = item.get("header_bg", "#D6EAF8")
    alt_row_bg = item.get("alt_row_bg", "#F2F3F4")
    border_color = item.get("border_color", "#AEB6BF")

    header_font = fonts["table_header"]
    cell_font = fonts["table_cell"]

    # Draw header row
    cx = x
    for i, header in enumerate(headers):
        draw.rectangle([cx, y, cx + col_widths[i], y + row_height],
                       fill=header_bg, outline=border_color, width=1)
        draw.text((cx + 5, y + 4), str(header), font=header_font, fill="#1A252F")
        cx += col_widths[i]

    # Draw data rows
    ry = y + row_height
    for r_idx, row in enumerate(rows):
        row_bg = alt_row_bg if r_idx % 2 == 1 else "#FFFFFF"
        cx = x
        for i, cell in enumerate(row):
            draw.rectangle([cx, ry, cx + col_widths[i], ry + row_height],
                           fill=row_bg, outline=border_color, width=1)
            cell_str = str(cell)
            cell_color = "#E74C3C" if cell_str == "X" else ("#27AE60" if cell_str in ("OK", "✓") else "#2C3E50")
            draw.text((cx + 5, ry + 5), cell_str, font=cell_font, fill=cell_color)
            cx += col_widths[i]
        ry += row_height


# ─── Main Generator ───────────────────────────────────────────────────────────

def generate_infographic(config_path, output_path):
    with open(config_path, "r") as f:
        config = json.load(f)

    width, height = 1200, 680
    bg_color = config.get("background_color", "#EAF2F8")

    img = Image.new("RGB", (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)

    # Preload font sizes
    fonts = {
        "title":        load_font("bold", 30),
        "subtitle":     load_font("regular", 16),
        "panel_title":  load_font("bold", 15),
        "body":         load_font("regular", 13),
        "body_bold":    load_font("bold", 13),
        "small":        load_font("regular", 11),
        "table_header": load_font("bold", 12),
        "table_cell":   load_font("regular", 12),
    }

    # Draw main title
    if "title" in config:
        draw.text((20, 14), config["title"], font=fonts["title"], fill="#1A252F")
    if "subtitle" in config:
        draw.text((20, 50), config["subtitle"], font=fonts["subtitle"], fill="#5D6D7E")

    # Draw citation at bottom if provided
    if "citation" in config:
        cite_font = load_font("regular", 9)
        draw.text((20, height - 14), config["citation"], font=cite_font, fill="#7F8C8D")

    # Draw panels
    for panel in config.get("panels", []):
        render_panel(img, draw, panel, fonts)

    img.save(output_path, "PNG", optimize=True)
    print(f"✅ Infographic saved to: {output_path}  ({width}x{height}px)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python generate_infographic.py <config.json> <output.png>")
        sys.exit(1)
    generate_infographic(sys.argv[1], sys.argv[2])
