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
        Generate barcode SVG.
        Uses python-barcode when available; otherwise returns a deterministic fallback SVG.
        """
        try:
            from barcode import get_barcode_class
            from barcode.writer import SVGWriter

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
                    "write_text": True,
                    "module_height": 15.0,
                    "module_width": 0.3,
                    "quiet_zone": 3.0,
                },
            )
            return buffer.getvalue().decode("utf-8")
        except Exception:
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
        return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600">
  <rect width="1000" height="600" fill="#ffffff"/>
  <text x="500" y="70" text-anchor="middle" font-size="56" font-family="Arial" font-weight="700">{display_code}</text>
  <text x="500" y="130" text-anchor="middle" font-size="44" font-family="Arial">{title}</text>
  <text x="500" y="180" text-anchor="middle" font-size="44" font-family="Arial">- {size_label}</text>
  <image x="140" y="200" width="720" height="230" href="data:image/svg+xml;base64,{encoded}" />
  <text x="500" y="465" text-anchor="middle" font-size="48" font-family="Arial">{barcode_value}</text>
  <text x="300" y="545" text-anchor="middle" font-size="62" font-family="Arial" font-weight="700">Rs{selling_price}</text>
  <text x="700" y="545" text-anchor="middle" font-size="62" font-family="Arial" fill="#000">{mrp}</text>
  <line x1="620" y1="522" x2="780" y2="522" stroke="#000" stroke-width="5"/>
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
