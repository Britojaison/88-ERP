import sys
sys.path.insert(0, '.')

from apps.mdm.barcode_service import BarcodeService

# Test generating barcode bars
bars = BarcodeService.generate_barcode_bars("04-l-260213133956", "code128")
print(f"Got {len(bars)} bars")
if bars:
    print(f"First 3: {bars[:3]}")
    print(f"Last 3: {bars[-3:]}")
    
    # Check the scaling
    max_x = max(x + w for x, w in bars)
    min_x = min(x for x, w in bars)
    print(f"X range: {min_x:.2f}mm - {max_x:.2f}mm = {max_x-min_x:.2f}mm total")
    
    # Check gaps between consecutive bars
    gaps = []
    for i in range(1, len(bars)):
        gap = bars[i][0] - (bars[i-1][0] + bars[i-1][1])
        gaps.append(round(gap, 3))
    print(f"Gaps: min={min(gaps):.3f}mm max={max(gaps):.3f}mm")
    print(f"Unique gaps: {sorted(set(gaps))}")

# Generate label SVG
svg = BarcodeService.build_label_svg(
    display_code="04-l",
    title="jeans",
    size_label="L",
    barcode_value="04-l-260213133956",
    barcode_type="code128",
    selling_price="3000.00",
    mrp="3500.00",
)

# Save for inspection
with open("test_label_output.svg", "w", encoding="utf-8") as f:
    f.write(svg)

# Count rect elements in the SVG
import re
rects = re.findall(r'<rect [^>]*fill="#000"', svg)
print(f"\nLabel has {len(rects)} black bar rects")

# Check pixel positions of bars
bar_positions = []
for m in re.finditer(r'<rect x="([\d.]+)" y="150" width="([\d.]+)"', svg):
    bar_positions.append((float(m.group(1)), float(m.group(2))))

if bar_positions:
    print(f"Pixel X range: {bar_positions[0][0]:.1f} to {bar_positions[-1][0] + bar_positions[-1][1]:.1f}")
    print(f"Bar width range: {min(w for _,w in bar_positions):.1f}px to {max(w for _,w in bar_positions):.1f}px")
    
    # Check pixel gaps
    pgaps = []
    for i in range(1, len(bar_positions)):
        g = bar_positions[i][0] - (bar_positions[i-1][0] + bar_positions[i-1][1])
        pgaps.append(round(g, 1))
    print(f"Pixel gaps: min={min(pgaps):.1f}px max={max(pgaps):.1f}px")
    print(f"Unique pixel gaps: {sorted(set(pgaps))[:10]}")
    
print("\nSaved test_label_output.svg")
