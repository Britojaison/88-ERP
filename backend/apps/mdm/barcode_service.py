"""
Barcode generation and label rendering utilities.
"""
from __future__ import annotations

import base64
import hashlib
import io
from datetime import datetime


class BarcodeService:
    @staticmethod
    def build_default_value(sku_code: str) -> str:
        suffix = datetime.utcnow().strftime("%y%m%d%H%M%S")
        return f"{sku_code}-{suffix}"

    @staticmethod
    def generate_barcode_svg(value: str, barcode_type: str = "code128") -> str:
        """
        Generate barcode SVG with visible spacing between bars and variable heights.
        Uses python-barcode when available; otherwise returns a deterministic fallback SVG.
        """
        try:
            from barcode import get_barcode_class
            from barcode.writer import SVGWriter
            import re
            import random

            normalized = barcode_type.lower()
            if normalized in ("gs1_128", "gs1-128"):
                normalized = "gs1_128"
            if normalized == "ean13":
                normalized = "ean13"
                value = "".join(ch for ch in value if ch.isdigit())[:12].ljust(12, "0")
            else:
                normalized = "code128"

            barcode_cls = get_barcode_class(normalized)
            barcode_obj = barcode_cls(value, writer=SVGWriter())
            buffer = io.BytesIO()
            barcode_obj.write(
                buffer,
                options={
                    "write_text": False,
                    "module_height": 15.0,
                    "module_width": 0.4,  # Base bar width
                    "quiet_zone": 6.0,
                },
            )
            svg_content = buffer.getvalue().decode("utf-8")
            
            # Parse and modify the SVG to add spacing and variable heights
            # Extract all rect elements with their positions
            rect_pattern = r'<rect\s+x="([\d.]+)"\s+y="([\d.]+)"\s+width="([\d.]+)"\s+height="([\d.]+)"([^>]*)/>'
            matches = list(re.finditer(rect_pattern, svg_content))
            
            if not matches:
                return svg_content
            
            # Seed random for consistent results per barcode value
            random.seed(hash(value) % 10000)
            
            # Build new SVG with spacing
            new_rects = []
            spacing = 2.0  # 2 pixels spacing between bars
            x_offset = 0
            
            for i, match in enumerate(matches):
                x, y, width, height, rest = match.groups()
                x_val = float(x)
                y_val = float(y)
                width_val = float(width)
                height_val = float(height)
                
                # Calculate new x position with spacing
                new_x = x_val + x_offset
                x_offset += spacing
                
                # Variable height: 25% chance to extend bar upward
                if random.random() < 0.25:
                    extension = height_val * random.uniform(0.10, 0.20)
                    new_y = y_val - extension
                    new_height = height_val + extension
                else:
                    new_y = y_val
                    new_height = height_val
                
                new_rect = f'<rect x="{new_x:.2f}" y="{new_y:.2f}" width="{width_val:.2f}" height="{new_height:.2f}"{rest}/>'
                new_rects.append((match.start(), match.end(), new_rect))
            
            # Replace rects in reverse order to maintain string positions
            for start, end, new_rect in reversed(new_rects):
                svg_content = svg_content[:start] + new_rect + svg_content[end:]
            
            # Adjust viewBox and width to accommodate spacing
            viewbox_match = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg_content)
            if viewbox_match:
                old_width = float(viewbox_match.group(1))
                old_height = float(viewbox_match.group(2))
                new_width = old_width + (len(matches) * spacing)
                
                svg_content = svg_content.replace(
                    f'viewBox="0 0 {old_width} {old_height}"',
                    f'viewBox="0 0 {new_width:.2f} {old_height}"'
                )
                
                # Update width attribute in svg tag
                width_match = re.search(r'<svg[^>]+width="([\d.]+)"', svg_content)
                if width_match:
                    old_svg_width = width_match.group(1)
                    svg_content = svg_content.replace(
                        f'width="{old_svg_width}"',
                        f'width="{new_width:.2f}"',
                        1
                    )
            
            return svg_content
        except Exception as e:
            print(f"ERROR in generate_barcode_svg: {e}")
            import traceback
            traceback.print_exc()
            return BarcodeService._fallback_svg(value)

    @staticmethod
    def build_label_svg(
        display_code: str,
        title: str,
        size_label: str,
        barcode_value: str,
        barcode_svg: str,
        selling_price: str,
        mrp: str,
    ) -> str:
        encoded = base64.b64encode(barcode_svg.encode("utf-8")).decode("ascii")
        return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500">
  <rect width="1000" height="500" fill="#ffffff"/>
  
  <!-- Display Code (Top) -->
  <text x="500" y="70" text-anchor="middle" font-size="60" font-family="Arial" font-weight="700">{display_code}</text>
  
  <!-- Title and Size (Second Line) -->
  <text x="500" y="120" text-anchor="middle" font-size="38" font-family="Arial">{title} - {size_label}</text>
  
  <!-- Barcode Image -->
  <g transform="translate(600, 235)">
    <image x="-300" y="-85" width="600" height="170" href="data:image/svg+xml;base64,{encoded}" preserveAspectRatio="xMidYMid meet" />
  </g>
  
  <!-- Barcode Value (Below Barcode) -->
  <text x="500" y="345" text-anchor="middle" font-size="42" font-family="Arial" letter-spacing="8">{barcode_value}</text>
  
  <!-- Prices (Bottom Row) -->
  <text x="300" y="430" text-anchor="middle" font-size="62" font-family="Arial" font-weight="700">₹{selling_price}</text>
  <text x="700" y="430" text-anchor="middle" font-size="62" font-family="Arial" font-weight="400">₹{mrp}</text>
  
  <!-- Strikethrough on MRP -->
  <line x1="620" y1="400" x2="780" y2="400" stroke="#000" stroke-width="4"/>
</svg>"""

    @staticmethod
    def _fallback_svg(value: str) -> str:
        digest = hashlib.sha256(value.encode("utf-8")).digest()
        x = 16
        bars = []
        for b in digest * 3:
            width = 2 + (b % 4)
            gap = 1 + ((b // 4) % 2)
            bars.append(f'<rect x="{x}" y="10" width="{width}" height="120" fill="#000" />')
            x += width + gap
            if x > 780:
                break
        return f"""<svg xmlns="http://www.w3.org/2000/svg" width="800" height="160" viewBox="0 0 800 160">
  <rect width="800" height="160" fill="#fff"/>
  {''.join(bars)}
  <text x="400" y="150" text-anchor="middle" font-size="24" font-family="Arial">{value}</text>
</svg>"""
