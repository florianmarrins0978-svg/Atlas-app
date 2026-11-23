// Compose « De l'essai à l'appli » sur les écrans VRAIS figés par figer.mjs :
// chaque bouton mène à l'écran que l'appli montre après lui, et rien n'est
// redessiné. Usage :
//   node appli/scripts/parcours-inscription/composer.mjs <dossier de figer.mjs> <sortie.html>
import { readFileSync, readdirSync } from "node:fs";
import { composer } from "../../../scripts/planche-figee/composer.mjs";

const [S, SORTIE] = process.argv.slice(2);
const fichiers = readdirSync(S).filter((f) => /^\d\d-.+\.json$/.test(f)).sort();
// La porte (`/bienvenue`) n'est pas du parcours : depuis le site, « Créer mon
// compte » ouvre directement la première question.
// LA HAUTEUR STABLE DE L'ÉCRAN, ET NON LA HAUTEUR VIVANTE. Sa remarque du
// 23 novembre : « quand je monte et je descends, elle frise et elle saute ».
// Les écrans de la porte prennent `100dvh`, la hauteur visible, qui change en
// continu sur iPhone quand Safari rentre ou ressort sa barre d'adresse au
// défilement. Dans l'appli installée, il n'y a pas de barre, et l'écran tient
// sans défiler ; ici, l'en-tête de la planche le fait défiler, dans Safari :
// chaque écran grandissait et rétrécissait sous le doigt. `100svh`, la petite
// hauteur, ne bouge pas. Seules les VALEURS changent : le nom de la classe
// (`min-h-[100dvh]`, précédé de « [ ») reste celui que l'appli pose.
const enHauteurStable = (texte) => texte.replace(/(?<=[:(\s])(\d+)dvh/g, "$1svh");

const etats = fichiers
  .map((f) => ({ nom: f.slice(3, -5), corps: JSON.parse(readFileSync(`${S}/${f}`, "utf8")) }))
  .map((e) => ({ ...e, corps: { ...e.corps, html: enHauteurStable(e.corps.html) } }))
  .filter((e) => e.nom !== "porte");
const noms = etats.map((e) => e.nom);
const etape = (nom) =>
  /^q\d+$/.test(nom) ? "q0" : /^code/.test(nom) ? "code" : nom;
etats.forEach((e) => (e.etape = etape(e.nom)));

const ETAPES = [
  { va: "q0", mot: "Le compte" },
  { va: "code", mot: "Le code" },
  { va: "conditions", mot: "Les conditions" },
  { va: "pret", mot: "C'est fait" },
  { va: "accueil", mot: "L'appli" },
];

// Les questions à choix : le choix suivi dans la planche, et ce que les autres
// auraient demandé de plus dans l'appli (`src/lib/creation-compte.ts`).
const CHOIX = {
  q5: { garde: "EI", dit: "Dans la planche, on suit l'entreprise individuelle. Une société demande en plus son capital et la ville du RCS." },
  q8: { garde: "Non", dit: "Dans la planche, on suit la franchise. Facturer la TVA ajoute trois questions : le numéro, le rythme, le moment." },
  q11: { garde: "Non", dit: "Dans la planche, on suit « Non ». « Oui » demande la photo de l'attestation, puis l'assureur." },
};

const retouches = (etat, d) => {
  const SUITE = /^(Continuer|Passer|Créer mon compte|Accepter|Entrer dans Cause)$/;
  const mot = (b) => (b.textContent || "").replace(/\s+/g, " ").trim();
  d.noms.forEach((nom, i) => {
    const el = etat(nom);
    const suivant = d.noms[i + 1];
    const precedent = d.noms[i - 1];
    const choix = d.choix[nom];
    el.querySelectorAll("button, a").forEach((b) => {
      const m = mot(b);
      if (m === "Retour") {
        if (precedent) b.dataset.va = precedent;
        else b.dataset.dit = "Dans l'appli : revient au site.";
      } else if (choix && m) {
        b.dataset.va = suivant;
        if (!m.startsWith(choix.garde)) b.dataset.dit = choix.dit;
      } else if (suivant && SUITE.test(m)) {
        b.dataset.va = suivant;
      }
    });
  });
  // Les boutons sans mot : ce qu'ils font dans l'appli, en une ligne.
  etat("q2").querySelectorAll('button[aria-label="Afficher le mot de passe"]').forEach((b) => (b.dataset.dit = "Dans l'appli : montre le mot de passe."));
  etat("q13").querySelectorAll('button[aria-label="Un de moins"], button[aria-label="Un de plus"]').forEach((b) => (b.dataset.dit = "Dans l'appli : change le nombre de chantiers par jour."));
  etat("q10").querySelectorAll("button").forEach((b) => {
    if (/^Virement/.test(mot(b))) { delete b.dataset.va; b.dataset.dit = "Dans l'appli : coche ce choix. La planche garde « Virement et chèque »."; }
  });
  // Le code arrive par e-mail : toucher la case le tape, comme il le ferait.
  const caseCode = etat("code").querySelector("input");
  if (caseCode) { caseCode.closest("label, div").dataset.va = "code-tape"; caseCode.closest("label, div").dataset.dit = "Le code arrive par e-mail. Ici, il se tape tout seul."; }
  etat("code").querySelectorAll("button").forEach((b) => { if (mot(b) === "Continuer") { b.dataset.va = "code-tape"; b.dataset.dit = "Touchez d'abord la case : le code se tape tout seul."; } });
  etat("code").querySelectorAll("button, a").forEach((b) => { if (mot(b) === "Renvoyer le code") b.dataset.dit = "Dans l'appli : renvoie un nouveau code par e-mail."; });
  etat("code-tape").querySelectorAll("button, a").forEach((b) => { if (mot(b) === "Renvoyer le code") b.dataset.dit = "Dans l'appli : renvoie un nouveau code par e-mail."; });
  etat("conditions").querySelectorAll("button, a").forEach((b) => { if (mot(b) === "Se déconnecter") b.dataset.dit = "Dans l'appli : ferme la session sans accepter."; });
  // LA PROPOSITION : une carte de la visite guidée sur l'accueil d'un compte
  // neuf, qu'on peut refuser. Ses mots du 23 novembre : « il faut permettre à
  // l'utilisateur, s'il ne veut pas faire la visite guidée, d'enlever le
  // bouton ». Elle se pose dans le vide qui sépare « Vos clients » de « Créer
  // un devis », aux couleurs de l'appli, et nulle part ailleurs.
  const accueil = etat("accueil");
  const vide = accueil.querySelector('div[aria-hidden="true"].flex-\\[2\\]');
  const carte = document.createElement("div");
  carte.dataset.atlas = "carte-visite";
  carte.className = "carte-visite";
  carte.innerHTML =
    '<b class="cv-titre">La visite guidée</b>' +
    '<p class="cv-dit">Dix minutes, sur des données d’essai.</p>' +
    '<div class="cv-gestes">' +
    '<a class="atlas-plein cv-faire" href="../visite-guidee.html" data-vers-la-visite>Faire la visite</a>' +
    '<button type="button" class="cv-non" data-non-merci>Non merci</button>' +
    "</div>";
  vide.parentNode.insertBefore(carte, vide);
};

// Ce qui tourne dans la planche publiée.
//
// LE RETOUR DE LA VISITE REVIENT OÙ IL ÉTAIT. Sa remarque du 23 novembre :
// « quand je quitte la visite guidée, ça me remet au début à la création du
// compte ; une fois qu'on quitte, il faut rester dans l'appli ». « Quitter la
// visite » rouvre la page d'où l'on vient (`visite-guidee.html`, `quitter`),
// et cette page repartait de son premier écran. L'adresse porte donc l'écran
// où l'on est (`?etat=accueil`) au moment de partir, et la page le rouvre :
// une adresse se garde quand l'onglet se recharge, une variable non.
const scriptEnPlus = `
(() => {
  const ici = new URLSearchParams(location.search);
  const cacherLaCarte = () => document.querySelectorAll("[data-atlas=carte-visite]").forEach((c) => (c.hidden = true));
  document.addEventListener("click", (ev) => {
    const vers = ev.target.closest("[data-vers-la-visite]");
    const non = ev.target.closest("[data-non-merci]");
    if (!vers && !non) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (vers) {
      history.replaceState(null, "", "?etat=accueil&visite=faite");
      location.href = vers.getAttribute("href");
      return;
    }
    history.replaceState(null, "", "?etat=accueil&visite=non");
    cacherLaCarte();
    const dit = document.querySelector(".planche-dit");
    dit.textContent = "Dans l'appli, elle ne revient plus.";
    dit.classList.add("visible"); setTimeout(() => dit.classList.remove("visible"), 2600);
  }, true);
  if (ici.get("visite")) cacherLaCarte();
  const etat = ici.get("etat");
  if (etat) setTimeout(() => {
    const aller = document.createElement("button");
    aller.dataset.va = etat; aller.hidden = true;
    document.body.appendChild(aller); aller.click(); aller.remove();
  }, 0);
})();
`;

const css = enHauteurStable(readFileSync(`${S}/css.txt`, "utf8")) + `
.carte-visite{margin:28px 26px 0;padding:18px 18px 14px;border-radius:6px;background-color:var(--atlas-card,#faf9f5);box-shadow:inset 0 0 0 1px var(--atlas-line,rgba(28,28,26,0.12))}
.carte-visite[hidden]{display:none}
.cv-titre{display:block;font-family:var(--font-display);font-weight:400;font-size:22px;line-height:1.2;color:var(--atlas-ink,#1c1c1a)}
.cv-dit{margin:4px 0 0;font-size:15px;line-height:1.45;color:var(--atlas-inkSoft,#4a4a44)}
.cv-gestes{display:flex;align-items:center;gap:8px;margin-top:14px}
.cv-faire{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:999px;background-color:var(--atlas-plein,#7d9a6d);color:var(--atlas-card,#faf9f5);font-size:16px;font-weight:600;text-decoration:none}
.cv-non{min-height:48px;padding:0 14px;border:0;background:none;color:var(--atlas-inkSoft,#4a4a44);font:inherit;font-size:16px;font-weight:600;cursor:pointer}
`;

const taille = await composer({
  css,
  etats,
  etapes: ETAPES,
  titre: "De l'essai à l'appli",
  surtitre: "Planche, les vrais écrans",
  retouches,
  donnees: { noms, choix: CHOIX },
  scriptEnPlus,
  sortie: SORTIE,
});
console.log("écrit", SORTIE, taille);
