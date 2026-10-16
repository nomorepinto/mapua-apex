import base64
import struct
import shutil
import os

src_path = r"C:\Users\john benedict\.gemini\antigravity-ide\brain\0f1554a1-f84e-4f3f-9cb8-d7b20ca0525e\.user_uploaded\media_1792117551777.png"
public_dir = r"f:\mapua-apex\mapua-apex-frontend\public"

# Also check if file exists
if not os.path.exists(src_path):
    print(f"File not found: {src_path}")
    exit(1)

# Read PNG dimensions from header
with open(src_path, "rb") as f:
    data = f.read()

# PNG header check
if data[:8] == b'\x89PNG\r\n\x1a\n':
    w, h = struct.unpack('>II', data[16:24])
    print(f"PNG dimensions: {w}x{h}")
else:
    w, h = 970, 720
    print("Not standard PNG header, using fallback dimensions")

# Copy raw PNG to public folder
shutil.copy2(src_path, os.path.join(public_dir, "mapua_logo.png"))
print("Saved mapua_logo.png")

# Base64 encode
b64 = base64.b64encode(data).decode('ascii')

# Create SVG with crisp rendering and proper viewBox
svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" height="100%">
  <image href="data:image/png;base64,{b64}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet" />
</svg>
'''

svg_path = os.path.join(public_dir, "mapua_logo.svg")
with open(svg_path, "w", encoding="utf-8") as f:
    f.write(svg_content)

print(f"Saved {svg_path} successfully!")
