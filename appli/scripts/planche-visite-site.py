# Fabrique appli/vente/cause-2-visite.html : la vraie page Cause 2, telle quelle,
# avec la visite guidée aux deux places qu'il a retenues le 22 novembre 2026 :
# une carte dans l'ouverture, et une bande avant les prix. (Sa demande : « la
# visite guidée, il faut la mettre sur le site Cause 2 » ; la planche d'avant
# proposait trois places, la barre du haut n'a pas été retenue.)
#   python3 appli/scripts/planche-visite-site.py appli/vente/cause-2.html appli/vente/cause-2-visite.html
# Ce qu'il choisit se pose ensuite dans cause-2.html lui-même, et ce script s'efface.
import sys

src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf8").read()


def rep(old, new):
    global s
    assert s.count(old) == 1, (s.count(old), old[:70])
    s = s.replace(old, new)


VISITE = "../visite-guidee.html"

# L'entrée de la visite, la même à ses deux places : sous l'ouverture, et sous
# l'option des outils à 6 € (sa demande : « le bouton là que tu as mis, mets le
# même sous le dernier abonnement »).
def entree(classe=""):
    return f"""<a class="visite-entree{classe}" href="{VISITE}">
        <span class="visite-entree-ecran"><img src="images/visite-apercu.jpg" alt="" width="1170" height="1992" decoding="async"></span>
        <span class="visite-entree-texte">
          <b>La visite guidée de l'appli</b>
          <span class="dit">Les vrais écrans, guidés pas à pas. Dix minutes, sans compte.</span>
          <span class="visite-entree-bouton">Commencer la visite</span>
        </span>
      </a>"""

# A, retenue le 22 au soir, en entrée : « Faire la visite », seul, ne disait pas à
# quoi il menait (« il faut faire une vraie case qui explique bien que si vous
# cliquez là, vous allez faire la visite guidée ») ; puis la carte sombre n'était
# « pas jolie » (« un truc plus joli qui donne vraiment envie de cliquer »). Ce qui
# donne envie, c'est la visite elle-même : un petit téléphone montre sa vraie
# image (le planning, l'anneau doré sur le 25, « Touchez le 25. »). Pas d'anneau
# ni de pulsation dessinés par le site : il les a refusés sur cette page.
rep("""      <p class="rassure">Sans carte bancaire. Tout est ouvert pendant l'essai.</p>
    </div>""", f"""      <p class="rassure">Sans carte bancaire. Tout est ouvert pendant l'essai.</p>
      {entree()}
    </div>""")

# Sous l'option des outils, avant la note de l'essai.
rep("""    </article>
    <p class="essai-note">""", f"""    </article>
    {entree(" sous-les-prix")}
    <p class="essai-note">""")

# Une bande à elle, après « Pour commencer. », juste avant les prix.
rep("""<section class="papier" id="prix">""",
    f"""<section class="visite-bande" id="visite">
  <div class="large">
    <h2 class="mot" data-monte>Voyez l'appli en vrai.</h2>
    <p class="chapo">La visite guidée, sur les vrais écrans. Dix minutes, sans compte.</p>
    <div class="actions"><a class="bouton or" href="{VISITE}">Faire la visite</a></div>
  </div>
</section>

<section class="papier" id="prix">""")

rep("</head>", """<style data-planche>
.visite-bande{padding-block:clamp(56px,9vw,96px)}
.visite-entree{position:relative;display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center;margin-top:40px;max-width:440px;padding:18px 22px 18px 18px;border-radius:28px;background:var(--papier);color:var(--encre);text-decoration:none;text-align:left;box-shadow:inset 0 0 0 1px var(--trait),0 26px 50px -30px rgba(var(--ombre),.6);transition:transform .5s var(--sortie),box-shadow .5s var(--sortie)}
.visite-entree-ecran{display:block;width:104px;padding:4px;margin-top:-34px;border-radius:21px;background:linear-gradient(155deg,#26302a,#0d120f 40%);box-shadow:0 20px 30px -16px rgba(var(--ombre),.75),inset 0 0 0 1px #39433c;transform:rotate(-5deg);transform-origin:50% 88%;transition:transform .6s var(--sortie);animation:visite-gigote 3.2s ease-in-out .8s infinite}
@keyframes visite-gigote{0%,38%,100%{transform:rotate(-5deg)}6%{transform:rotate(4deg)}12.5%{transform:rotate(-12deg)}19%{transform:rotate(3deg)}25.5%{transform:rotate(-10deg)}32%{transform:rotate(-2deg)}}
.visite-entree.sous-les-prix{margin:56px auto 0}
.visite-entree-ecran img{display:block;width:100%;height:auto;aspect-ratio:1170/1992;border-radius:17px;object-fit:cover;object-position:top}
.visite-entree-texte{display:grid;gap:8px;justify-items:start}
.visite-entree-texte b{font:400 clamp(25px,6.6vw,30px)/1.05 var(--display);letter-spacing:-.005em;text-wrap:balance}
.visite-entree-texte .dit{font:400 15px/1.42 var(--texte);color:var(--encre-2)}
.visite-entree-bouton{display:inline-flex;align-items:center;min-height:48px;padding:0 22px;margin-top:6px;border-radius:999px;background:var(--encre);color:var(--fond);font:600 15.5px/1 var(--texte);transition:background .25s}
.visite-entree:hover{transform:translateY(-3px);box-shadow:inset 0 0 0 1px var(--trait),0 32px 60px -30px rgba(var(--ombre),.7)}
.visite-entree:hover .visite-entree-ecran,.visite-entree:focus-visible .visite-entree-ecran{animation:none;transform:rotate(0deg) translateY(-6px)}
.visite-entree:hover .visite-entree-bouton{background:var(--action)}
.visite-entree:active{transform:translateY(0) scale(.99)}
.visite-entree:focus-visible{outline:2px solid var(--action);outline-offset:4px}
@media (max-width:899px){.visite-entree{margin-inline:auto}}
@media (prefers-reduced-motion:reduce){.visite-entree,.visite-entree-ecran{transition:none;animation:none}}
</style>
</head>""")
open(dst, "w", encoding="utf8").write(s)
print("écrit", dst, len(s))
