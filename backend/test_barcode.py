"""Quick test to inspect barcode SVG output."""
import io
import re
from barcode import get_barcode_class
from barcode.writer import SVGWriter

value = "jojo-jeans-255-xxxl-260213120156"
bc_cls = get_barcode_class("code128")
obj = bc_cls(value, writer=SVGWriter())
buf = io.BytesIO()
obj.write(buf, options={
    "write_text": False,
    "module_height": 50.0,
    "module_width": 0.6,
    "quiet_zone": 6.5,
    "font_size": 0,
    "text_distance": 0,
})
svg = buf.getvalue().decode()

# Get SVG dimensions
print("=== SVG DIMENSIONS ===")
dim_w = re.search(r'width="([\d.]+)(mm)?"', svg)
dim_h = re.search(r'height="([\d.]+)(mm)?"', svg)
vb = re.search(r'viewBox="([^"]+)"', svg)
if dim_w: print(f"width: {dim_w.group(0)}")
if dim_h: print(f"height: {dim_h.group(0)}")
if vb: print(f"viewBox: {vb.group(1)}")

# Count rects
rects = re.findall(r'<rect\s+[^>]+/>', svg)
print(f"\nTotal rect elements: {len(rects)}")

# Extract widths
widths = []
for r in rects:
    m = re.search(r'width="([\d.]+)', r)
    if m:
        widths.append(float(m.group(1)))

print(f"Unique rect widths: {sorted(set(widths))}")

# Check Pillow + ImageWriter
print("\n=== IMAGEWRITER TEST ===")
try:
    from barcode.writer import ImageWriter
    from PIL import Image
    obj2 = bc_cls(value, writer=ImageWriter())
    buf2 = io.BytesIO()
    obj2.write(buf2, options={
        "write_text": False,
        "module_height": 200,
        "module_width": 3,
        "quiet_zone": 20,
        "font_size": 0,
        "text_distance": 0,
    })
    buf2.seek(0)
    img = Image.open(buf2)
    print(f"ImageWriter PNG size: {img.size} (w x h)")
    img.save("test_barcode_image.png")
    print("Saved test_barcode_image.png")
except Exception as e:
    print(f"ImageWriter error: {e}")
    import traceback
    traceback.print_exc()
