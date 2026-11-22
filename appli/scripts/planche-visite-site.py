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

# A, retenue le 22 au soir, mais en carte : « Faire la visite », seul, ne disait pas
# à quoi il menait (« il faut faire une vraie case qui explique bien que si vous
# cliquez là, vous allez faire la visite guidée »). La carte se pose sous
# l'ouverture, « Voir les prix » garde sa place.
rep("""      <p class="rassure">Sans carte bancaire. Tout est ouvert pendant l'essai.</p>
    </div>""", f"""      <p class="rassure">Sans carte bancaire. Tout est ouvert pendant l'essai.</p>
      <a class="visite-carte" href="{VISITE}">
        <span class="visite-carte-icone" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 6.5v11l9-5.5z" fill="currentColor"/></svg></span>
        <span class="visite-carte-texte"><b>La visite guidée de l'appli</b><span>Les vrais écrans, pas à pas. Dix minutes, sans compte.</span></span>
        <span class="visite-carte-bouton">Commencer la visite</span>
      </a>
    </div>""")

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
.visite-carte{position:relative;display:grid;grid-template-columns:auto 1fr;gap:14px 14px;align-items:center;margin-top:28px;max-width:440px;padding:18px;border-radius:22px;background:var(--encre);color:var(--fond);text-decoration:none;text-align:left;box-shadow:0 18px 40px -22px rgba(var(--ombre),.85);transition:transform .3s var(--sortie),box-shadow .3s var(--sortie)}
.visite-carte:hover{transform:translateY(-2px);box-shadow:0 24px 48px -22px rgba(var(--ombre),.9)}
.visite-carte-icone{position:relative;display:grid;place-items:center;width:52px;height:52px;border-radius:999px;background:var(--or-clair);color:var(--encre)}
.visite-carte-icone::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:0 0 0 0 color-mix(in srgb,var(--or-clair) 55%,transparent);animation:visite-pouls 2.4s var(--sortie) infinite}
@keyframes visite-pouls{to{box-shadow:0 0 0 14px transparent}}
.visite-carte-texte{display:grid;gap:4px}
.visite-carte-texte b{font:400 24px/1.1 var(--display)}
.visite-carte-texte span{font:400 15px/1.4 var(--texte);color:color-mix(in srgb,var(--fond) 78%,transparent)}
.visite-carte-bouton{grid-column:1/-1;display:flex;align-items:center;justify-content:center;min-height:50px;border-radius:999px;background:var(--or-clair);color:var(--encre);font:600 16px/1 var(--texte)}
@media (max-width:899px){.visite-carte{margin-inline:auto}}
@media (prefers-reduced-motion:reduce){.visite-carte-icone::after{animation:none}}
</style>
</head>""")
open(dst, "w", encoding="utf8").write(s)
print("écrit", dst, len(s))
