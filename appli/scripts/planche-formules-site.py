# Fabrique appli/vente/cause-2-formules.html : le vrai site, tel quel, où l'on
# CHOISIT sa formule avant l'essai. Sa demande du 23 novembre 2026 : « il faudrait
# qu'il sélectionne. Il sélectionne la formule artisan, par exemple, plus il
# choisit la formule à 6 euros. Et ensuite, il a un prélèvement de 0 euros, il
# fait ses 15 jours d'essai. Et à la fin, s'il ne décide pas de quitter l'appli,
# l'abonnement démarre. »
#   python3 appli/scripts/planche-formules-site.py appli/vente/cause-2-visite.html appli/vente/cause-2-formules.html
# Ce qu'il retient se pose ensuite dans cause-2-visite.html, et ce script s'efface.
#
# Ce qui change, et rien d'autre : les cartes des formules se choisissent, les
# outils s'ajoutent d'un interrupteur, « Votre choix » dit le total et 0 € pour
# aujourd'hui, et une feuille montre l'essai, la carte ou l'IBAN (la place de la
# page de Stripe, sans un champ : une page publique ne recueille aucun numéro),
# puis le départ, d'où « Créer mon compte » ouvre la marche dans les vrais écrans
# de l'appli (cause-2-inscription.html). Les phrases « Sans carte bancaire » deviennent fausses dans ce
# modèle : elles changent de mots à leur place. Les boutons d'essai mènent aux
# prix, puisque c'est là qu'on choisit.
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf8").read()


def rep(old, new, n=1):
    global s
    assert s.count(old) == n, (s.count(old), old[:80])
    s = s.replace(old, new)


# ── Les phrases qui deviennent fausses : les mots changent, pas la place ──────
rep("<p class=\"rassure\">Sans carte bancaire. Tout est ouvert pendant l'essai.</p>",
    "<p class=\"rassure\">0 € aujourd'hui. Tout est ouvert pendant l'essai.</p>")
rep('<p class="rassure">Sans carte bancaire. Sans engagement.</p>',
    '<p class="rassure">0 € pendant 15 jours. Sans engagement.</p>')
rep("<p class=\"essai-note\">L'essai ouvre tout, sans carte bancaire. Vous choisissez votre formule après.</p>",
    "<p class=\"essai-note\">L'essai ouvre tout. Votre formule démarre après les 15 jours, sauf si vous arrêtez avant.</p>")
rep("<p>Rien n'est prélevé tout seul. Vous choisissez une formule, ou Cause passe en lecture seule : vos devis et vos factures restent consultables.</p>",
    "<p>La formule que vous avez choisie démarre, et son premier prélèvement part ce jour-là. Vous arrêtez avant, depuis les Réglages : rien n'est prélevé, et vos devis et vos factures restent consultables.</p>")

# ── Les cartes des formules se choisissent ────────────────────────────────────
FORMULES = [("39", "artisan", "Artisan", "bouton clair"),
            ("59", "entreprise", "Entreprise", "bouton"),
            ("159", "illimite", "Illimité", "bouton or")]
debut = s.index('<div class="formules">')
fin = s.index('<article class="option-outils"')
bloc = s[debut:fin]
COCHE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
for mois, code, nom, classe in FORMULES:
    ancien = f'data-vu="0.1" data-mois="{mois}"'
    assert bloc.count(ancien) == 1, ancien
    bloc = bloc.replace(ancien, f'{ancien} data-formule="{code}" data-nom="{nom}"')
    lien = f'<a class="{classe}" href="#essayer">Essayer 15 jours gratuits</a>'
    assert bloc.count(lien) == 1, lien
    bloc = bloc.replace(lien, f'<span class="coche" aria-hidden="true">{COCHE}</span>\n        '
                              f'<button type="button" class="{classe} choisir" data-choisir="{code}" aria-pressed="false">Choisir {nom}</button>')
s = s[:debut] + bloc + s[fin:]

# ── Les outils s'ajoutent d'un interrupteur, au-dessus de « Découvrir » ───────
rep('<div class="action"><a class="bouton or" href="outils.html">Découvrir les outils</a></div>',
    '<div class="action">\n'
    '      <button type="button" class="ajout-outils" role="switch" aria-checked="false">'
    '<span class="interrupteur" aria-hidden="true"></span><span class="ajout-mots">Ajouter les outils</span></button>\n'
    '      <a class="bouton or" href="outils.html">Découvrir les outils</a>\n'
    '    </div>')

# ── « Votre choix », juste après les outils ───────────────────────────────────
rep('<a class="visite-entree sous-les-prix"',
    '''<section class="recap" id="votre-choix" aria-labelledby="recap-titre">
      <div class="recap-tete">
        <h3 id="recap-titre">Votre choix</h3>
        <dl class="recap-lignes" aria-live="polite">
          <div class="r-formule"><dt>Formule</dt><dd>à choisir</dd></div>
          <div class="r-outils" hidden><dt>Les outils de paysage</dt><dd></dd></div>
          <div class="r-total" hidden><dt>Après l'essai</dt><dd></dd></div>
        </dl>
      </div>
      <div class="recap-pied">
        <p class="aujourdhui"><span>Aujourd'hui</span><b>0 €</b></p>
        <p class="recap-date" hidden></p>
        <button type="button" class="bouton recap-bouton">Choisir ma formule</button>
      </div>
    </section>
    <a class="visite-entree sous-les-prix"''')

# Tous les boutons d'essai mènent aux prix : c'est là qu'on choisit.
s = s.replace('href="#essayer"', 'href="#prix"')

# ── La barre du pouce, une fois la formule choisie ───────────────────────────
rep('<div class="pouce" id="pouce">',
    '''<div class="pouce-choix" id="pouce-choix" aria-hidden="true">
  <p class="pc-mots"><b></b><span>0 € aujourd'hui</span></p>
  <a class="bouton" href="#votre-choix" tabindex="-1">Voir mon choix</a>
</div>
<div class="pouce" id="pouce">''')

# ── La feuille : l'essai, la carte ou l'IBAN, le départ ───────────────────────
FEUILLE = '''
<dialog class="fe" id="feuille-essai" aria-labelledby="fe-titre">
  <div class="fe-haut">
    <button type="button" class="fe-retour" hidden>Retour</button>
    <button type="button" class="fe-fermer">Fermer</button>
  </div>
  <div class="fe-etape" data-etape="1">
    <h2 id="fe-titre">Votre essai</h2>
    <p class="fe-choix"></p>
    <ol class="frise">
      <li><b>Aujourd'hui</b><span>0 €. Tout est ouvert.</span></li>
      <li><b class="f-avant"></b><span>Un message vous prévient.</span></li>
      <li><b class="f-date"></b><span class="f-depart"></span></li>
    </ol>
    <p class="fe-note">Vous arrêtez avant : rien n'est prélevé.</p>
    <button type="button" class="bouton" data-suite="2">Continuer</button>
  </div>
  <div class="fe-etape" data-etape="2" hidden>
    <h2>Votre carte ou votre IBAN</h2>
    <div class="place-stripe">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>
      <p><b>La page sécurisée de Stripe</b><span>Elle s'ouvre ici : votre carte bancaire, ou votre IBAN pour un prélèvement.</span></p>
    </div>
    <p class="fe-note">0 € prélevé aujourd'hui.</p>
    <button type="button" class="bouton" data-suite="3">Enregistrer</button>
  </div>
  <div class="fe-etape" data-etape="3" hidden>
    <span class="fe-ok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
    <h2>C'est parti.</h2>
    <p class="f-court"></p>
    <a class="bouton" href="cause-2-inscription.html">Créer mon compte</a>
  </div>
</dialog>
'''
rep('<footer class="pied nappe">', FEUILLE + '\n<footer class="pied nappe">')

STYLE = '''<style>
/* Choisir sa formule avant l'essai (planche du 23 novembre 2026). */
.formule{cursor:pointer;transition:box-shadow .35s var(--sortie)}
.formule .coche{position:absolute;top:20px;right:20px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--action);color:var(--action-texte);opacity:0;transform:scale(.4);transition:opacity .2s ease,transform .45s var(--sortie)}
.formule .coche svg,.fe-ok svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.formule.choisie{box-shadow:0 0 0 3px var(--action),0 34px 60px -38px rgba(var(--ombre),.55)}
.formule.choisie .coche{opacity:1;transform:none}
/* Une fois le choix fait, Entreprise perd son cerne vert de mise en avant :
   deux cernes verts se liraient comme deux formules choisies. */
body.a-choisi .formule.mise:not(.choisie){box-shadow:0 0 0 1px rgba(var(--ombre),.09)}
.formule.reine .coche{background:var(--or-clair);color:var(--nuit)}
.formule.reine.choisie{box-shadow:0 0 0 3px var(--or-clair),0 34px 60px -30px rgba(var(--ombre),.7)}
.formule.choisie .choisir{background:var(--action);color:var(--action-texte);box-shadow:none}
.formule.reine.choisie .choisir{background:var(--or-clair);color:var(--nuit)}
.option-outils .action{display:grid;gap:12px}
.ajout-outils{pointer-events:auto;display:flex;align-items:center;gap:14px;width:100%;min-height:58px;padding:0 22px 0 12px;border:0;border-radius:999px;background:var(--papier);color:var(--encre);font:600 17px/1.2 var(--texte);text-align:left;cursor:pointer;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--encre) 22%,transparent);transition:box-shadow .3s var(--sortie),background .3s}
.interrupteur{flex:none;position:relative;width:54px;height:34px;border-radius:999px;background:color-mix(in srgb,var(--encre) 22%,var(--papier));transition:background .3s}
.interrupteur::after{content:"";position:absolute;top:4px;left:4px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 2px 6px -1px rgba(var(--ombre),.45);transition:transform .4s var(--sortie)}
.ajout-outils[aria-checked="true"]{box-shadow:inset 0 0 0 2px var(--action)}
.ajout-outils[aria-checked="true"] .interrupteur{background:var(--action)}
.ajout-outils[aria-checked="true"] .interrupteur::after{transform:translateX(20px)}
.option-outils.ajoutee{box-shadow:0 0 0 3px var(--action),0 30px 60px -36px rgba(var(--ombre),.55)}
.recap{margin-top:22px;display:grid;gap:24px;padding:32px 26px 28px;border-radius:28px;background:var(--papier);box-shadow:0 0 0 1px rgba(var(--ombre),.09),0 34px 60px -40px rgba(var(--ombre),.5)}
.recap h3{font-size:clamp(38px,4vw,44px);line-height:1}
.recap-lignes{margin:18px 0 0}
.recap-lignes div[hidden]{display:none}
.recap-lignes div{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:13px 0;border-top:1px solid var(--trait);font-size:17px}
.recap-lignes dt{color:var(--encre-2)}
.recap-lignes dd{margin:0;text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.recap-lignes .r-formule dd{font-weight:600}
.recap-lignes .r-total{border-top:1.5px solid color-mix(in srgb,var(--encre) 30%,transparent)}
.recap-lignes .r-total dt{color:var(--encre);font-weight:600}
.r-formule.vide dd{color:var(--encre-2);font-weight:400}
.aujourdhui{display:flex;justify-content:space-between;align-items:baseline;gap:16px}
.aujourdhui span{font:600 17px/1 var(--texte)}
.aujourdhui b{font:400 64px/1 var(--display);color:var(--feuille);font-variant-numeric:tabular-nums}
.recap-date{margin-top:8px;font-size:16px;color:var(--encre-2)}
.recap-date b{color:var(--encre)}
.recap-bouton{width:100%;margin-top:20px}
@media (min-width:960px){.recap{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);column-gap:64px;padding:44px 48px 40px;align-items:end}}
.pouce-choix{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:16;display:flex;align-items:center;gap:12px;max-width:520px;margin-inline:auto;padding:10px 10px 10px 20px;border-radius:999px;background:var(--nuit);color:var(--sur-nuit);box-shadow:0 20px 44px -16px rgba(var(--ombre),.75);transform:translateY(calc(100% + 24px + env(safe-area-inset-bottom)));visibility:hidden;pointer-events:none;transition:transform .5s var(--sortie),visibility 0s linear .5s}
.pouce-choix.vu{transform:none;visibility:visible;pointer-events:auto;transition:transform .5s var(--sortie),visibility 0s}
.pc-mots{flex:1;min-width:0;display:grid;gap:3px}
.pc-mots b{font:600 16px/1.2 var(--texte);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc-mots span{font-size:14px;color:var(--sur-nuit-2)}
.pouce-choix .bouton{flex:none;min-height:52px;padding:0 22px;font-size:16px}
body.a-choisi .pouce{display:none}
@media (min-width:960px){.pouce-choix{display:none}}
.fe{width:min(100%,560px);max-width:none;max-height:min(92dvh,760px);margin:auto auto 0;padding:14px 24px calc(28px + env(safe-area-inset-bottom));border:0;border-radius:28px 28px 0 0;background:var(--papier);color:var(--encre);box-shadow:0 -24px 60px -30px rgba(var(--ombre),.6);overflow:auto}
.fe::backdrop{background:rgba(14,42,27,.55)}
.fe[open]{animation:fe-monte .55s var(--sortie)}
@keyframes fe-monte{from{transform:translateY(40px);opacity:0}}
@media (min-width:640px){.fe{margin:auto;border-radius:28px;padding:18px 36px 36px}}
.fe-haut{display:flex;justify-content:space-between;min-height:48px;margin:0 -10px 8px}
.fe-haut button{min-height:48px;padding:0 10px;border:0;background:none;color:var(--encre-2);font:600 16px/1 var(--texte);cursor:pointer}
.fe-haut .fe-fermer{margin-left:auto}
.fe h2{font:400 clamp(38px,9vw,46px)/1.02 var(--display);letter-spacing:-.01em}
.fe-choix{margin-top:10px;font-size:17px;color:var(--encre-2)}
.frise{list-style:none;margin:26px 0 0;padding:0}
.frise li{position:relative;display:grid;gap:4px;padding:0 0 22px 36px}
.frise li::before{content:"";position:absolute;left:5px;top:5px;width:14px;height:14px;border-radius:50%;background:var(--papier);box-shadow:inset 0 0 0 2.5px var(--action)}
.frise li:first-child::before{background:var(--action)}
.frise li:not(:last-child)::after{content:"";position:absolute;left:11px;top:24px;bottom:2px;width:2px;background:var(--trait)}
.frise b{font:600 17px/1.25 var(--texte)}
.frise span{font-size:16px;color:var(--encre-2)}
.fe-note{margin-top:4px;font-size:16px;color:var(--encre-2)}
.fe .bouton{width:100%;margin-top:22px}
.place-stripe{display:flex;gap:16px;align-items:flex-start;margin-top:22px;padding:22px 20px;border-radius:20px;background:var(--fond);box-shadow:inset 0 0 0 1.5px var(--trait)}
.place-stripe svg{flex:none;width:30px;height:30px;fill:none;stroke:var(--encre);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.place-stripe p{display:grid;gap:4px}
.place-stripe b{font:600 17px/1.25 var(--texte)}
.place-stripe span{font-size:16px;color:var(--encre-2)}
.fe-ok{display:grid;place-items:center;width:64px;height:64px;margin:6px 0 18px;border-radius:50%;background:var(--action);color:var(--action-texte)}
.f-court{margin-top:10px;font-size:17px;color:var(--encre-2)}
@media (prefers-reduced-motion:reduce){.formule .coche,.interrupteur::after,.pouce-choix,.ajout-outils{transition:none}.fe[open]{animation:none}}
</style>
</head>'''
rep('</head>', STYLE)

SCRIPT = '''<script>
/* Choisir sa formule avant l'essai (planche du 23 novembre 2026). Le choix ne
   quitte pas la page : rien n'est envoyé, rien n'est gardé. */
(function(){
  var JOURS_ESSAI = 15, OUTILS = { mois: 6, an: 72 };
  var un = function(s, d){ return (d || document).querySelector(s); };
  var tous = function(s, d){ return Array.prototype.slice.call((d || document).querySelectorAll(s)); };
  var etat = { formule: null, outils: false };
  var cartes = tous(".formule[data-formule]"), outils = un(".option-outils"), interrupteur = un(".ajout-outils");
  var recap = un("#votre-choix"), bouton = un(".recap-bouton"), feuille = un("#feuille-essai"), barre = un("#pouce-choix");
  var euros = function(n){ return n.toLocaleString("fr-FR") + " €"; };
  var periode = function(){ var b = un("[data-periode][aria-pressed='true']"); return b ? b.getAttribute("data-periode") : "mois"; };
  var finEssai = new Date(); finEssai.setDate(finEssai.getDate() + JOURS_ESSAI);
  var date = finEssai.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  var carte = function(){ return cartes.filter(function(c){ return c.getAttribute("data-formule") === etat.formule; })[0]; };
  var prix = function(c, p){ return Number(c.getAttribute(p === "an" ? "data-an" : "data-mois")); };
  var rythme = function(p){ return p === "an" ? "HT par an" : "HT par mois"; };
  var nomDuChoix = function(){ var c = carte(); return c ? c.getAttribute("data-nom") + (etat.outils ? ", avec les outils" : "") : ""; };
  var total = function(){ var c = carte(), p = periode(); return c ? euros(prix(c, p) + (etat.outils ? OUTILS[p] : 0)) + " " + rythme(p) : ""; };

  var peindre = function(){
    var c = carte(), p = periode();
    cartes.forEach(function(k){
      var oui = k === c;
      k.classList.toggle("choisie", oui);
      var b = un(".choisir", k);
      b.setAttribute("aria-pressed", String(oui));
      b.textContent = oui ? "Formule choisie" : "Choisir " + k.getAttribute("data-nom");
    });
    interrupteur.setAttribute("aria-checked", String(etat.outils));
    un(".ajout-mots", interrupteur).textContent = etat.outils ? "Outils ajoutés" : "Ajouter les outils";
    outils.classList.toggle("ajoutee", etat.outils);
    var lf = un(".r-formule", recap), lo = un(".r-outils", recap), lt = un(".r-total", recap), ld = un(".recap-date", recap);
    lf.classList.toggle("vide", !c);
    un("dt", lf).textContent = c ? c.getAttribute("data-nom") : "Formule";
    un("dd", lf).textContent = c ? euros(prix(c, p)) : "à choisir";
    lo.hidden = !etat.outils;
    un("dd", lo).textContent = "+ " + euros(OUTILS[p]);
    lt.hidden = !c;
    un("dd", lt).textContent = total();
    ld.hidden = !c;
    ld.innerHTML = c ? "Premier prélèvement le <b>" + date + "</b>, sauf si vous arrêtez avant." : "";
    bouton.textContent = c ? "Commencer l'essai gratuit" : "Choisir ma formule";
    document.body.classList.toggle("a-choisi", !!c);
    un("b", barre).textContent = nomDuChoix();
    voirBarre();
  };

  var choisir = function(code){ etat.formule = code; peindre(); };
  cartes.forEach(function(k){
    k.addEventListener("click", function(e){ if (e.target.closest("a")) return; choisir(k.getAttribute("data-formule")); });
  });
  interrupteur.addEventListener("click", function(e){ e.preventDefault(); e.stopPropagation(); etat.outils = !etat.outils; peindre(); });
  // La bascule mois ou année change les prix : « Votre choix » les suit.
  tous("[data-periode]").forEach(function(b){ b.addEventListener("click", function(){ setTimeout(peindre, 0); }); });

  // Sans formule, le bouton ramène aux cartes ; avec, il ouvre la feuille.
  bouton.addEventListener("click", function(){
    if (!carte()) { un(".formules").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    ouvrir();
  });

  // La barre du pouce : dès qu'une formule est choisie, et tant que « Votre
  // choix » n'est pas à l'écran.
  var recapVu = false, piedVu = false;
  var voirBarre = function(){ var oui = !!carte() && !recapVu && !piedVu; barre.classList.toggle("vu", oui); barre.setAttribute("aria-hidden", String(!oui)); un("a", barre).tabIndex = oui ? 0 : -1; };
  if ("IntersectionObserver" in window){
    new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.target === recap) recapVu = e.isIntersecting; else piedVu = e.isIntersecting; }); voirBarre(); })
      .observe(recap);
    new IntersectionObserver(function(es){ es.forEach(function(e){ piedVu = e.isIntersecting; }); voirBarre(); }).observe(un(".pied"));
  }

  // La feuille de l'essai.
  var etape = 1, retour = un(".fe-retour", feuille);
  var montrer = function(n){
    etape = n;
    tous(".fe-etape", feuille).forEach(function(e){ e.hidden = Number(e.getAttribute("data-etape")) !== n; });
    retour.hidden = n === 1 || n === 3;
    var h = un(".fe-etape:not([hidden]) h2", feuille); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    feuille.scrollTop = 0;
  };
  var ouvrir = function(){
    var c = carte(), p = periode();
    un(".fe-choix", feuille).textContent = nomDuChoix() + ", " + total() + ".";
    un(".f-avant", feuille).textContent = "Avant le " + date;
    un(".f-date", feuille).textContent = "Le " + date;
    un(".f-depart", feuille).textContent = "Votre formule démarre : " + total() + ".";
    un(".f-court", feuille).textContent = "Votre essai court jusqu'au " + date + ". Tout est ouvert.";
    montrer(1);
    if (feuille.showModal) feuille.showModal(); else feuille.setAttribute("open", "");
  };
  tous("[data-suite]", feuille).forEach(function(b){ b.addEventListener("click", function(){ montrer(Number(b.getAttribute("data-suite"))); }); });
  retour.addEventListener("click", function(){ montrer(etape - 1); });
  un(".fe-fermer", feuille).addEventListener("click", function(){ feuille.close ? feuille.close() : feuille.removeAttribute("open"); });
  feuille.addEventListener("click", function(e){ if (e.target === feuille) feuille.close(); });

  peindre();
})();
</script>
</body>'''
rep('</body>', SCRIPT)

open(dst, "w", encoding="utf8").write(s)
print("écrit", dst, len(s))
