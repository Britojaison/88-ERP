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
    def generate_barcode_bars(value: str, barcode_type: str = "code128") -> list:
        """
        Generate barcode bars as a list of (x_mm, width_mm) tuples.
        Uses python-barcode to get the exact Code128 encoding.
        """
        try:
            from barcode import get_barcode_class
            from barcode.writer import SVGWriter
            import re

            normalized = barcode_type.lower()
            if normalized in ("gs1_128", "gs1-128"):
                normalized = "gs1_128"
            if normalized == "ean13":
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
                    "module_height": 50.0,
                    "module_width": 0.33,
                    "quiet_zone": 2.0,
                    "font_size": 0,
                    "text_distance": 0,
                },
            )
            svg_content = buffer.getvalue().decode("utf-8")

            # Parse rect elements (skip the first one which is the white background)
            bars = []
            for match in re.finditer(
                r'<rect\s+x="([\d.]+)mm"\s+y="[\d.]+mm"\s+width="([\d.]+)mm"\s+height="[\d.]+mm"',
                svg_content
            ):
                x_mm = float(match.group(1))
                w_mm = float(match.group(2))
                bars.append((x_mm, w_mm))

            return bars
        except Exception as e:
            print(f"ERROR generating barcode bars: {e}")
            import traceback
            traceback.print_exc()
            return []

    @staticmethod
    def build_label_svg(
        display_code: str, title: str, size_label: str, barcode_value: str,
        barcode_type: str, selling_price: str, mrp: str,
    ) -> str:
        """Build a label SVG with barcode bars inlined directly (no <image> embedding)."""
        # Get barcode bars as (x_mm, w_mm) tuples
        bars = BarcodeService.generate_barcode_bars(barcode_value, barcode_type)

        # Generate bar rectangles scaled to pixel coordinates
        bar_rects = ""
        if bars:
            max_x = max(x + w for x, w in bars)
            min_x = min(x for x, w in bars)
            bc_width_mm = max_x - min_x

            # Target area on label: x=100..900 (800px), y=150..370 (220px)
            target_x = 100
            target_w = 800
            target_y = 150
            target_h = 220
            scale = target_w / bc_width_mm if bc_width_mm > 0 else 1

            for x_mm, w_mm in bars:
                px_x = target_x + (x_mm - min_x) * scale
                px_w = max(w_mm * scale, 1.5)  # minimum 1.5px width
                bar_rects += f'  <rect x="{px_x:.1f}" y="{target_y}" width="{px_w:.1f}" height="{target_h}" fill="#000"/>\n'

        return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600">
  <rect width="1000" height="600" fill="#ffffff"/>
  <text x="500" y="65" text-anchor="middle" font-size="52" font-family="Arial, sans-serif" font-weight="700">{display_code}</text>
  <text x="500" y="115" text-anchor="middle" font-size="32" font-family="Arial, sans-serif">{title} – {size_label}</text>
{bar_rects}  <text x="500" y="415" text-anchor="middle" font-size="28" font-family="Arial, sans-serif">{barcode_value}</text>
  <text x="500" y="470" text-anchor="middle" font-size="42" font-family="Arial, sans-serif" font-weight="700" letter-spacing="6">{barcode_value}</text>
  <text x="300" y="555" text-anchor="middle" font-size="58" font-family="Arial, sans-serif" font-weight="700">₹{selling_price}</text>
  <text x="700" y="555" text-anchor="middle" font-size="58" font-family="Arial, sans-serif" text-decoration="line-through">₹{mrp}</text>
</svg>"""



    @staticmethod
    def build_label_png(
        display_code: str, title: str, size_label: str, barcode_value: str,
        barcode_type: str, selling_price: str, mrp: str,
    ) -> bytes:
        from PIL import Image, ImageDraw, ImageFont
        from barcode import get_barcode_class
        from barcode.writer import ImageWriter

        # Create canvas
        width, height = 1000, 600
        img = Image.new("RGB", (width, height), "white")
        draw = ImageDraw.Draw(img)
        
        # Try to load fonts
        try:
            # Use Arial if available, otherwise fallback
            font_bold = ImageFont.truetype("arialbd.ttf", 52)
            font_reg = ImageFont.truetype("arial.ttf", 32)
            font_price = ImageFont.truetype("arialbd.ttf", 58)
            font_small = ImageFont.truetype("arial.ttf", 28)
            font_barcode = ImageFont.truetype("arialbd.ttf", 42)
        except:
            font_bold = font_reg = font_price = font_small = font_barcode = ImageFont.load_default()

        # Text Drawing helpers
        def draw_text_centered(text, y, font, weight="normal"):
            bbox = draw.textbbox((0, 0), text, font=font)
            w = bbox[2] - bbox[0]
            draw.text(((width - w) / 2, y), text, fill="black", font=font)

        draw_text_centered(display_code, 40, font_bold)
        draw_text_centered(f"{title} – {size_label}", 100, font_reg)

        # Barcode - Ultra High Density
        bc_cls = get_barcode_class(barcode_type.lower() if barcode_type.lower() != "gs1_128" else "code128")
        bc_obj = bc_cls(barcode_value, writer=ImageWriter())
        bc_buffer = io.BytesIO()
        bc_obj.write(bc_buffer, options={"write_text": False, "module_height": 20.0, "module_width": 0.1, "quiet_zone": 1.0})
        bc_buffer.seek(0)
        bc_img = Image.open(bc_buffer)
        
        # Scale up the dense image to fill area
        bc_img = bc_img.resize((900, 230), Image.Resampling.LANCZOS)
        img.paste(bc_img, (50, 160))

        draw_text_centered(barcode_value, 400, font_small)
        draw_text_centered(barcode_value, 450, font_barcode)

        # Prices
        draw.text((200, 520), f"₹{selling_price}", fill="black", font=font_price)
        mrp_text = f"₹{mrp}"
        draw.text((600, 520), mrp_text, fill="black", font=font_price)
        # Strikethrough for MRP - since drawing it on text is manual in Pillow
        bbox = draw.textbbox((600, 520), mrp_text, font=font_price)
        draw.line((bbox[0], (bbox[1]+bbox[3])/2, bbox[2], (bbox[1]+bbox[3])/2), fill="black", width=4)

        out_buffer = io.BytesIO()
        img.save(out_buffer, format="PNG")
        return out_buffer.getvalue()

    @staticmethod
    def build_label_pdf(
        display_code: str, title: str, size_label: str, barcode_value: str,
        barcode_type: str, selling_price: str, mrp: str,
    ) -> bytes:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import landscape
        from reportlab.lib.units import mm
        from reportlab.graphics.barcode import code128, ean
        from reportlab.lib.colors import black

        buf = io.BytesIO()
        # Label size in mm: 100x60
        c = canvas.Canvas(buf, pagesize=(100*mm, 60*mm))
        
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(50*mm, 52*mm, display_code)
        
        c.setFont("Helvetica", 10)
        c.drawCentredString(50*mm, 46*mm, f"{title} – {size_label}")
        
        # Barcode - High Density
        if barcode_type.lower() == "ean13":
            bc = ean.Ean13BarcodeWidget(barcode_value)
        else:
            # Ultra fine lines
            bc = code128.Code128(barcode_value, barHeight=25*mm, barWidth=0.15*mm, quiet=False)
        
        # Scale and draw
        bc.drawOn(c, 2*mm, 18*mm)
        
        c.setFont("Helvetica", 8)
        c.drawCentredString(50*mm, 17*mm, barcode_value)
        
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(50*mm, 12*mm, barcode_value)
        
        c.setFont("Helvetica-Bold", 18)
        c.drawString(20*mm, 4*mm, f"₹{selling_price}")
        
        c.setFont("Helvetica", 18)
        mrp_text = f"₹{mrp}"
        c.drawString(60*mm, 4*mm, mrp_text)
        # Strikethrough
        tw = c.stringWidth(mrp_text, "Helvetica", 18)
        c.line(60*mm, 10*mm, 60*mm + tw, 10*mm)
        
        c.showPage()
        c.save()
        return buf.getvalue()

    @staticmethod
    def _fallback_svg(value: str) -> str:
        digest = hashlib.sha256(value.encode("utf-8")).digest()
        x, bars = 16, []
        for b in digest * 3:
            w, g = 2 + (b % 4), 1 + ((b // 4) % 2)
            bars.append(f'<rect x="{x}" y="10" width="{w}" height="120" fill="#000" />')
            x += w + g
            if x > 780: break
        return f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="160" viewBox="0 0 800 160"><rect width="800" height="160" fill="#fff"/>{"".join(bars)}<text x="400" y="150" text-anchor="middle" font-size="24" font-family="Arial">{value}</text></svg>'
