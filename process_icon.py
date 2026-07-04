#!/usr/bin/env python3
"""
Process Niuma icon - remove background and create all required formats
"""
from PIL import Image
import os

# Input and output paths
script_dir = os.path.dirname(os.path.abspath(__file__))
input_path = os.path.join(script_dir, "chat_gpt_niuma.png")
output_dir = os.path.join(script_dir, "src-tauri", "icons")

# Create output directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)

print("Loading image...")
img = Image.open(input_path)

# Convert to RGBA if not already
if img.mode != 'RGBA':
    img = img.convert('RGBA')

print(f"Original size: {img.size}")
print(f"Original mode: {img.mode}")

# Remove gray/white background and make transparent
print("Processing transparency...")
datas = img.getdata()
new_data = []
for item in datas:
    # If pixel is grayish/whitish (high RGB values, close to each other), make it transparent
    # Adjust threshold as needed - this targets light gray backgrounds
    if item[0] > 200 and item[1] > 200 and item[2] > 200:
        new_data.append((255, 255, 255, 0))  # Transparent
    else:
        new_data.append(item)

img.putdata(new_data)

# Find the bounding box of the non-transparent area
print("Finding wing bounds...")
bbox = img.getbbox()
if bbox:
    # Crop to content
    img = img.crop(bbox)
    print(f"Cropped to: {img.size}")

    # Add some padding (10% on each side)
    width, height = img.size
    padding = int(max(width, height) * 0.1)

    # Create new image with padding
    new_size = max(width, height) + (padding * 2)
    padded = Image.new('RGBA', (new_size, new_size), (0, 0, 0, 0))

    # Calculate position to center the wing
    x_offset = (new_size - width) // 2
    y_offset = (new_size - height) // 2
    padded.paste(img, (x_offset, y_offset), img)
    img = padded
    print(f"Padded to: {img.size}")

# Resize to square if needed
if img.size[0] != img.size[1]:
    max_dim = max(img.size)
    square = Image.new('RGBA', (max_dim, max_dim), (0, 0, 0, 0))
    offset = ((max_dim - img.size[0]) // 2, (max_dim - img.size[1]) // 2)
    square.paste(img, offset, img)
    img = square

# Create all required sizes
sizes = {
    'icon.png': 512,
    '128x128.png': 128,
    '128x128@2x.png': 256,
    '32x32.png': 32,
}

print("\nGenerating PNG files...")
for filename, size in sizes.items():
    output_path = os.path.join(output_dir, filename)
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(output_path, 'PNG')
    print(f"[OK] Created {filename} ({size}x{size})")

# Create Windows ICO file (multi-resolution)
print("\nGenerating Windows ICO file...")
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_images = []
for size in ico_sizes:
    resized = img.resize(size, Image.Resampling.LANCZOS)
    ico_images.append(resized)

ico_path = os.path.join(output_dir, 'icon.ico')
ico_images[0].save(ico_path, format='ICO', sizes=ico_sizes)
print(f"[OK] Created icon.ico (multi-resolution)")

print("\n[SUCCESS] Icon processing complete!")
print(f"\nGenerated files in {output_dir}:")
print("  - icon.png (512x512)")
print("  - 128x128.png")
print("  - 128x128@2x.png (256x256)")
print("  - 32x32.png")
print("  - icon.ico (Windows)")
print("\nNote: macOS .icns file needs to be created separately")
print("Recommended tool: https://cloudconvert.com/png-to-icns")
print(f"Upload: {os.path.join(output_dir, 'icon.png')}")
