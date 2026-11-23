import os
from PIL import Image, ImageDraw

def create_icon(size):
    # Create image with transparent background
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Padding and geometry
    pad = int(size * 0.08)
    radius = int(size * 0.22)
    
    # Background rounded square with gradient effect (deep modern indigo/violet to emerald)
    # We'll draw concentric rounded rectangles or a clean shield background
    bg_color = (24, 28, 42, 255) # Sleek dark navy
    draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=bg_color)
    
    # Draw border accent (emerald cyan gradient color)
    border_color = (16, 185, 129, 255) # Emerald green (scam detector / savings)
    draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, outline=border_color, width=max(1, int(size * 0.05)))

    # Draw Magnifying Glass + Shield / Warning symbol
    # Center coordinates
    cx, cy = size / 2, size / 2
    scale = size / 128.0

    # Magnifying glass circle
    glass_r = int(24 * scale)
    glass_cx = int(cx - 8 * scale)
    glass_cy = int(cy - 8 * scale)
    glass_width = max(2, int(7 * scale))

    draw.ellipse(
        [glass_cx - glass_r, glass_cy - glass_r, glass_cx + glass_r, glass_cy + glass_r],
        outline=(56, 189, 248, 255), # Sky blue
        width=glass_width
    )

    # Magnifying glass handle
    handle_start_x = glass_cx + int(glass_r * 0.7)
    handle_start_y = glass_cy + int(glass_r * 0.7)
    handle_end_x = int(cx + 34 * scale)
    handle_end_y = int(cy + 34 * scale)
    draw.line(
        [handle_start_x, handle_start_y, handle_end_x, handle_end_y],
        fill=(56, 189, 248, 255),
        width=max(2, int(9 * scale))
    )

    # Inner symbol: Dollar sign or exclamation badge inside lens
    # Draw a small warning lightning or price slash inside
    slash_color = (245, 158, 11, 255) # Amber / gold
    draw.line(
        [glass_cx - int(10 * scale), glass_cy, glass_cx + int(10 * scale), glass_cy],
        fill=slash_color,
        width=max(2, int(5 * scale))
    )
    draw.line(
        [glass_cx, glass_cy - int(12 * scale), glass_cx, glass_cy + int(12 * scale)],
        fill=slash_color,
        width=max(2, int(5 * scale))
    )

    return img

def main():
    icons_dir = "/Users/codermauro/.gemini/antigravity/scratch/dropship-detector-extension/icons"
    os.makedirs(icons_dir, exist_ok=True)
    for s in [16, 48, 128]:
        icon = create_icon(s)
        icon.save(os.path.join(icons_dir, f"icon{s}.png"))
        print(f"Created icon{s}.png")

if __name__ == "__main__":
    main()
