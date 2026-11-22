# Fabrique appli/vente/cause-2-visite.html : la vraie page Cause 2, telle quelle,
# avec trois places possibles pour la visite guidée, à choisir d'un geste
# (sa demande du 22 novembre 2026 : « la visite guidée, il faut la mettre sur le
# site Cause 2 [...] avec un bouton, je sais pas trop où »).
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

# A. Dans l'ouverture : « Voir les prix » cède sa place ; les prix restent dans la barre du haut.
rep("""        <a class="bouton clair" href="#prix">Voir les prix</a>""",
    f"""        <a class="bouton clair" href="#prix" data-sans="a">Voir les prix</a>
        <a class="bouton clair" href="{VISITE}" data-variante="a">Faire la visite</a>""")

# B. Dans la barre du haut (ordinateur) et dans le menu (téléphone).
rep("""      <a href="#fonctionnement">Comment ça marche</a>
      <a href="#prix">Les prix</a>""",
    f"""      <a href="#fonctionnement">Comment ça marche</a>
      <a href="{VISITE}" data-variante="b">La visite</a>
      <a href="#prix">Les prix</a>""")
rep("""  <a href="#fonctionnement" style="--i:0">Comment ça marche</a>""",
    f"""  <a href="#fonctionnement" style="--i:0">Comment ça marche</a>
  <a href="{VISITE}" style="--i:0" data-variante="b">La visite</a>""")

# C. Une bande à elle, après « Pour commencer. », juste avant les prix.
rep("""<section class="papier" id="prix">""",
    f"""<section class="visite-bande" id="visite" data-variante="c">
  <div class="large">
    <h2 class="mot" data-monte>Voyez l'appli en vrai.</h2>
    <p class="chapo">La visite guidée, sur les vrais écrans. Dix minutes, sans compte.</p>
    <div class="actions"><a class="bouton or" href="{VISITE}">Faire la visite</a></div>
  </div>
</section>

<section class="papier" id="prix">""")

# Le choix : trois boutons fixés sous la barre. Ce qui n'est pas choisi est retiré
# par un style posé sur l'élément lui-même : un style de feuille perdrait contre
# ceux de la page (« .bouton » est en inline-flex).
rep("</head>", """<style data-planche>
.visite-bande{padding-block:clamp(56px,9vw,96px)}
.choix-planche{position:fixed;left:50%;top:74px;transform:translateX(-50%);z-index:40;display:flex;gap:4px;padding:4px;border-radius:999px;background:var(--encre);box-shadow:0 10px 28px -12px rgba(var(--ombre),.7);max-width:calc(100% - 24px)}
.choix-planche button{border:0;border-radius:999px;padding:10px 14px;min-height:40px;font:600 14px/1 var(--texte);background:transparent;color:var(--fond);cursor:pointer;white-space:nowrap}
.choix-planche button[aria-pressed="true"]{background:var(--fond);color:var(--encre)}
</style>
</head>""")
rep("<body>", """<body>
<div class="choix-planche" role="group" aria-label="Où poser la visite">
  <button type="button" data-choisir="a" aria-pressed="true">L'ouverture</button>
  <button type="button" data-choisir="b" aria-pressed="false">La barre</button>
  <button type="button" data-choisir="c" aria-pressed="false">Une bande</button>
</div>""")
rep("</body>", """<script data-planche>
(() => {
  const boutons = document.querySelectorAll("[data-choisir]");
  const menu = document.getElementById("menu"), ouvre = document.querySelector(".ouvre-menu");
  const poser = (c) => {
    document.querySelectorAll("[data-variante]").forEach((e) => { e.style.display = e.dataset.variante === c ? "" : "none"; });
    document.querySelectorAll("[data-sans]").forEach((e) => { e.style.display = e.dataset.sans === c ? "none" : ""; });
    boutons.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.choisir === c)));
  };
  poser("a");
  boutons.forEach((b) => b.addEventListener("click", () => {
    const c = b.dataset.choisir;
    poser(c);
    if (menu.classList.contains("ouvert")) menu.querySelector(".ferme").click();
    if (c === "c") document.getElementById("visite").scrollIntoView({ behavior: "smooth", block: "center" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
    // Sur un téléphone, la barre ne montre que « Menu » : on l'ouvre pour qu'il voie où la visite se range.
    if (c === "b" && getComputedStyle(document.querySelector(".liens")).display === "none") setTimeout(() => ouvre.click(), 450);
  }));
})();
</script>
</body>""")
open(dst, "w", encoding="utf8").write(s)
print("écrit", dst, len(s))
