import io
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors

def generate_container_pdf(container: dict) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # Title
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 50, f"Raport Kontenera: {container.get('name', 'Brak nazwy')}")

    # Meta
    c.setFont("Helvetica", 12)
    y = height - 80
    c.drawString(50, y, f"Data zamówienia: {container.get('orderDate', 'Brak')}")
    c.drawString(50, y - 20, f"Kurs wymiany: {container.get('exchangeRate', '4.0')} PLN/USD")
    
    # Products
    y -= 60
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y, "Produkty:")
    
    y -= 20
    c.setFont("Helvetica", 10)
    products = container.get('products', [])
    if not products:
        c.drawString(50, y, "Brak produktów w kontenerze.")
    else:
        # Table Header
        c.drawString(50, y, "Nazwa")
        c.drawString(250, y, "Ilość")
        c.drawString(350, y, "Cena Całk.")
        c.drawString(450, y, "CBM")
        y -= 15
        
        c.setStrokeColor(colors.gray)
        c.line(50, y + 10, 500, y + 10)
        
        for p in products:
            c.drawString(50, y, str(p.get('name', ''))[:35])
            c.drawString(250, y, str(p.get('quantity', '')))
            c.drawString(350, y, f"{p.get('totalPrice', '')} {p.get('totalPriceCurrency', 'USD')}")
            c.drawString(450, y, str(p.get('productCbm', '')))
            y -= 15
            if y < 50:
                c.showPage()
                y = height - 50
                c.setFont("Helvetica", 10)

    c.save()
    buffer.seek(0)
    return buffer.read()
