# Un ticket de carburant INVENTÉ (station, numéro, carte), photographié de travers :
# c'est l'image que la visite montre au moment du scan.
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H = 420, 760
im = Image.new("RGB", (W, H), (250, 248, 242)); d = ImageDraw.Draw(im)
f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 18)
fb = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 22)
y = 30
def l(t, font=f, c=False):
    global y
    x = (W - d.textlength(t, font=font)) / 2 if c else 30
    d.text((x, y), t, fill=(30, 30, 30), font=font); y += 30
l("STATION DU ROND-POINT", fb, True); l("Zone artisanale, 44300 Nantes", c=True); l("Tel 02 61 91 00 99", c=True); y += 10
l("--------------------------------"); l("17/11/2026          08:12"); l("Pompe 4"); l("GAZOLE"); l("  38,20 L x 1,895 EUR/L"); y += 6
l("TOTAL TTC            72,40 EUR", fb); y += 6
l("dont TVA 20%         12,07 EUR"); l("Montant HT           60,33 EUR"); l("--------------------------------"); l("CB  ****  ****  ****  0000"); y += 10
l("MERCI DE VOTRE VISITE", c=True); l("Ticket de démonstration", c=True)
im = im.rotate(1.2, expand=False, fillcolor=(120, 110, 95)).filter(ImageFilter.GaussianBlur(0.5))
fond = Image.new("RGB", (W + 80, H + 80), (120, 110, 95)); fond.paste(im, (40, 40)); fond.save(sys.argv[1], quality=88)
