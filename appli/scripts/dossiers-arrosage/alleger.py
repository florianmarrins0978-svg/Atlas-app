"""Allège une planche figée : chaque photo une seule fois, à la taille où elle se voit.

Les photos des pièces arrivent en 600 ou 1000 px et se montrent en 60 : on les
réduit à 200 px (le double de leur place, pour un écran à deux pixels par point),
les images larges à 760 px. Chaque image distincte n'est écrite qu'une fois,
et un petit script la pose sur chaque <img> qui la porte.
"""
import base64
import io
import re
import sys

from PIL import Image

# Usage : python3 alleger.py <brut.html> <appli/arrosage-dossiers.html> [entete.html]
source, sortie = sys.argv[1], sys.argv[2]
html = open(source, encoding="utf-8").read()
VIDE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
table: dict[str, int] = {}
images: list[str] = []


def reduire(uri: str) -> str:
    entete, donnees = uri.split(",", 1)
    im = Image.open(io.BytesIO(base64.b64decode(donnees)))
    w, h = im.size
    plafond = 200 if abs(w - h) < 20 else 760
    if max(w, h) > plafond:
        r = plafond / max(w, h)
        im = im.resize((round(w * r), round(h * r)), Image.LANCZOS)
    tampon = io.BytesIO()
    if im.mode in ("RGBA", "LA", "P"):
        im.save(tampon, "PNG", optimize=True)
        type_ = "image/png"
    else:
        im.convert("RGB").save(tampon, "JPEG", quality=84, optimize=True, progressive=True)
        type_ = "image/jpeg"
    return f"data:{type_};base64," + base64.b64encode(tampon.getvalue()).decode()


def remplacer(m: re.Match) -> str:
    uri = m.group(1)
    if uri not in table:
        table[uri] = len(images)
        images.append(reduire(uri))
    return f'src="{VIDE}" data-i="{table[uri]}"'


# Les photos de la nourrice éclatée sont des <image> SVG de l'appli (`/arrosage-photos/`) :
# la planche vit dans `appli/`, qui publie les mêmes photos à côté d'elle.
html = html.replace('href="/arrosage-photos/', 'href="arrosage-photos/')
html = re.sub(r'src="(data:image/(?:jpeg|png|webp);base64,[^"]+)"', remplacer, html)
pose = (
    "<script>(() => { const I = ["
    + ",".join(f'"{u}"' for u in images)
    + "]; document.querySelectorAll('img[data-i]').forEach((i) => { i.src = I[+i.dataset.i]; }); })();</script>"
)
dernier = html.rfind("<script>")
html = html[:dernier] + pose + html[dernier:]
if len(sys.argv) > 3:
    # L'en-tête de la planche : ce qui est vrai, ce qui est ajouté, ce qui est posé par nous.
    html = html.replace("<!doctype html>\n", "<!doctype html>\n" + open(sys.argv[3], encoding="utf-8").read(), 1)
open(sortie, "w", encoding="utf-8").write(html)
print(f"{len(images)} images distinctes, {len(html) / 1024 / 1024:.2f} Mo")
