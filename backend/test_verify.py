import re

with open("test_label_output.svg", "r") as f:
    svg = f.read()

# Count bars
bars_found = re.findall(r'<rect x="[\d.]+" y="150"', svg)
print(f"Total bars: {len(bars_found)}")

# Extract bar positions
positions = []
for m in re.finditer(r'<rect x="([\d.]+)" y="150" width="([\d.]+)" height="220"', svg):
    positions.append((float(m.group(1)), float(m.group(2))))

if positions:
    print(f"Bar width range: {min(w for _,w in positions):.1f}px - {max(w for _,w in positions):.1f}px")
    gaps = []
    for i in range(1, len(positions)):
        g = positions[i][0] - (positions[i-1][0] + positions[i-1][1])
        gaps.append(round(g, 1))
    print(f"Gap range: {min(gaps):.1f}px - {max(gaps):.1f}px")
    print(f"Unique gaps (sorted): {sorted(set(gaps))}")
    total_bar_width = sum(w for _,w in positions)
    total_gap_width = sum(gaps)
    print(f"Total bar width: {total_bar_width:.1f}px")
    print(f"Total gap width: {total_gap_width:.1f}px")
    if total_gap_width > 0:
        print(f"Bar to gap ratio: {total_bar_width/total_gap_width:.2f}")
    
    # Show first few bars
    for i in range(min(5, len(positions))):
        print(f"  Bar {i}: x={positions[i][0]:.1f} w={positions[i][1]:.1f}")
