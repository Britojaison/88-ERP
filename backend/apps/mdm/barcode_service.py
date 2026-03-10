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
        """Build a label SVG sized to 51x26mm (2x1 inch) at 100% scale with Code 128."""
        # Force Code 128 for all barcode generation
        bars = BarcodeService.generate_barcode_bars(barcode_value, "code128")

        # 51x26mm at ~3.78 px/mm = ~193 x 98 px; we use a scaled viewBox for clarity
        # viewBox 0 0 510 260 means 1 unit = 0.1mm for easy mapping
        vw, vh = 510, 260

        # Generate bar rectangles scaled to pixel coordinates
        bar_rects = ""
        if bars:
            max_x = max(x + w for x, w in bars)
            min_x = min(x for x, w in bars)
            bc_width_mm = max_x - min_x

            # Barcode area: full width with small margins, height ~40% of label
            target_x = 30
            target_w = vw - 60  # 450 units = 45mm of barcode width
            target_y = 75
            target_h = 100  # 10mm barcode height
            scale = target_w / bc_width_mm if bc_width_mm > 0 else 1

            for x_mm, w_mm in bars:
                px_x = target_x + (x_mm - min_x) * scale
                px_w = max(w_mm * scale, 1.0)
                bar_rects += f'  <rect x="{px_x:.1f}" y="{target_y}" width="{px_w:.1f}" height="{target_h}" fill="#000"/>\n'

        title_line = f"{title}{f' - {size_label}' if size_label else ''}"
        if len(title_line) > 40:
            title_line = title_line[:38] + ".."

        return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{vw}" height="{vh}" viewBox="0 0 {vw} {vh}">
  <rect width="{vw}" height="{vh}" fill="#ffffff"/>
  <text x="{vw//2}" y="28" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" font-weight="700">{display_code}</text>
  <text x="{vw//2}" y="55" text-anchor="middle" font-size="16" font-family="Arial, sans-serif">{title_line}</text>
{bar_rects}  <text x="{vw//2}" y="195" text-anchor="middle" font-size="16" font-family="Arial, sans-serif">{barcode_value}</text>
  <text x="{vw//4}" y="240" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" font-weight="700">₹{selling_price}</text>
  <text x="{vw*3//4}" y="240" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" text-decoration="line-through">₹{mrp}</text>
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
        draw_text_centered(f"{title}{f' – {size_label}' if size_label else ''}", 100, font_reg)

        # Barcode - Force Code 128 at 100% scale
        bc_cls = get_barcode_class("code128")
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

        # Prices - centered in their respective halves
        sp_text = f"₹{selling_price}"
        sp_bbox = draw.textbbox((0, 0), sp_text, font=font_price)
        sp_w = sp_bbox[2] - sp_bbox[0]
        sp_x = (width / 2 - sp_w) / 2  # center in left half
        draw.text((sp_x, 520), sp_text, fill="black", font=font_price)

        mrp_text = f"₹{mrp}"
        mrp_bbox = draw.textbbox((0, 0), mrp_text, font=font_price)
        mrp_w = mrp_bbox[2] - mrp_bbox[0]
        mrp_x = width / 2 + (width / 2 - mrp_w) / 2  # center in right half
        draw.text((mrp_x, 520), mrp_text, fill="black", font=font_price)
        # Strikethrough for MRP
        mrp_draw_bbox = draw.textbbox((mrp_x, 520), mrp_text, font=font_price)
        draw.line((mrp_draw_bbox[0], (mrp_draw_bbox[1]+mrp_draw_bbox[3])/2, mrp_draw_bbox[2], (mrp_draw_bbox[1]+mrp_draw_bbox[3])/2), fill="black", width=4)

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
        # Label size: 51x26mm (2" x 1") at 100% scale
        w_mm_val, h_mm_val = 51, 26
        c = canvas.Canvas(buf, pagesize=(w_mm_val*mm, h_mm_val*mm))
        page_w = w_mm_val * mm
        page_h = h_mm_val * mm
        cx = page_w / 2

        # Display code (top)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(cx, page_h - 4.5 * mm, display_code)

        # Title line
        title_line = f"{title}{f' - {size_label}' if size_label else ''}"
        if len(title_line) > 35:
            title_line = title_line[:33] + ".."
        c.setFont("Helvetica", 5)
        c.drawCentredString(cx, page_h - 7.5 * mm, title_line)

        # Code 128 barcode — fills the middle at 100% scale
        try:
            bc = code128.Code128(
                barcode_value,
                barHeight=8 * mm,
                barWidth=0.18 * mm,
                quiet=False,
            )
            bc_width = bc.width
            bc_x = (page_w - bc_width) / 2
            bc.drawOn(c, bc_x, page_h - 17 * mm)
        except Exception:
            pass

        # Barcode value text
        c.setFont("Helvetica", 4)
        c.drawCentredString(cx, page_h - 18.5 * mm, barcode_value)

        # Prices at bottom
        c.setFont("Helvetica-Bold", 6.5)
        price_text = "Rs." + selling_price
        c.drawString(2 * mm, 1.5 * mm, price_text)

        c.setFont("Helvetica", 6)
        mrp_text = "MRP Rs." + mrp
        mrp_x = page_w - 2 * mm - c.stringWidth(mrp_text, "Helvetica", 6)
        c.drawString(mrp_x, 1.5 * mm, mrp_text)
        tw = c.stringWidth(mrp_text, "Helvetica", 6)
        c.line(mrp_x, 3.5 * mm, mrp_x + tw, 3.5 * mm)

        c.showPage()
        c.save()
        return buf.getvalue()

    @staticmethod
    def build_bulk_pdf(
        items: list,
        layout: str = "50x25",
    ) -> bytes:
        """
        Build a multi-page PDF — ONE barcode label per page, sized for thermal printers.
        Each page = one sticker, ready for direct thermal/barcode printing.

        items: list of dicts with keys:
            display_code, title, size_label, barcode_value,
            barcode_type, selling_price, mrp, quantity
        layout: label size
            "50x25" — 50mm x 25mm (standard retail barcode sticker)
            "50x30" — 50mm x 30mm (slightly taller)
            "38x25" — 38mm x 25mm (compact)
        """
        from reportlab.pdfgen import canvas as pdf_canvas
        from reportlab.lib.units import mm
        from reportlab.graphics.barcode import code128

        buf = io.BytesIO()

        sizes = {
            "51x26": (51, 26),
            "50x25": (50, 25),
            "50x30": (50, 30),
            "38x25": (38, 25),
        }
        w_mm, h_mm = sizes.get(layout, (51, 26))
        page_w = w_mm * mm
        page_h = h_mm * mm

        c = pdf_canvas.Canvas(buf, pagesize=(page_w, page_h))
        cx = page_w / 2

        # Expand items by quantity
        all_labels = []
        for item in items:
            qty = max(1, int(item.get('quantity', 1)))
            all_labels.extend([item] * qty)

        for idx, item in enumerate(all_labels):
            if idx > 0:
                c.showPage()

            display_code = item.get('display_code', '')
            title = item.get('title', '')
            size_label = item.get('size_label', '')
            barcode_value = item.get('barcode_value', '')
            selling_price = item.get('selling_price', '0')
            mrp_val = item.get('mrp', '0')

            title_line = title
            if size_label:
                title_line = title + ' - ' + size_label

            if w_mm >= 50:
                # ── 50mm wide labels ──
                c.setFont("Helvetica-Bold", 7)
                c.drawCentredString(cx, page_h - 4.5 * mm, display_code)

                c.setFont("Helvetica", 5)
                if len(title_line) > 35:
                    title_line = title_line[:33] + ".."
                c.drawCentredString(cx, page_h - 7.5 * mm, title_line)

                # Barcode — fills the middle
                try:
                    bc = code128.Code128(
                        barcode_value,
                        barHeight=8 * mm,
                        barWidth=0.18 * mm,
                        quiet=False,
                    )
                    bc_width = bc.width
                    bc_x = (page_w - bc_width) / 2
                    bc.drawOn(c, bc_x, page_h - 17 * mm)
                except Exception:
                    pass

                c.setFont("Helvetica", 4)
                c.drawCentredString(cx, page_h - 18.5 * mm, barcode_value)

                # Prices at bottom
                c.setFont("Helvetica-Bold", 6.5)
                price_text = "Rs." + selling_price
                c.drawString(2 * mm, 1.5 * mm, price_text)

                c.setFont("Helvetica", 6)
                mrp_text = "MRP Rs." + mrp_val
                mrp_x = page_w - 2 * mm - c.stringWidth(mrp_text, "Helvetica", 6)
                c.drawString(mrp_x, 1.5 * mm, mrp_text)
                tw = c.stringWidth(mrp_text, "Helvetica", 6)
                c.line(mrp_x, 3.5 * mm, mrp_x + tw, 3.5 * mm)
            else:
                # ── 38mm wide (compact) ──
                c.setFont("Helvetica-Bold", 6)
                c.drawCentredString(cx, page_h - 4 * mm, display_code)

                c.setFont("Helvetica", 4)
                if len(title_line) > 28:
                    title_line = title_line[:26] + ".."
                c.drawCentredString(cx, page_h - 7 * mm, title_line)

                try:
                    bc = code128.Code128(
                        barcode_value,
                        barHeight=7 * mm,
                        barWidth=0.13 * mm,
                        quiet=False,
                    )
                    bc_width = bc.width
                    bc_x = (page_w - bc_width) / 2
                    bc.drawOn(c, bc_x, page_h - 15.5 * mm)
                except Exception:
                    pass

                c.setFont("Helvetica", 3.5)
                c.drawCentredString(cx, page_h - 17 * mm, barcode_value)

                c.setFont("Helvetica-Bold", 5.5)
                c.drawString(1.5 * mm, 1 * mm, "Rs." + selling_price)
                c.setFont("Helvetica", 5)
                mrp_text = "MRP " + mrp_val
                mrp_x = page_w - 1.5 * mm - c.stringWidth(mrp_text, "Helvetica", 5)
                c.drawString(mrp_x, 1 * mm, mrp_text)
                tw = c.stringWidth(mrp_text, "Helvetica", 5)
                c.line(mrp_x, 2.5 * mm, mrp_x + tw, 2.5 * mm)

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
