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
  // La fin du parcours : la visite guidée continue dans l'appli.
  const fin = document.createElement("a");
  fin.className = "suite-visite";
  fin.href = "../visite-guidee.html";
  fin.dataset.lien = "../visite-guidee.html";
  fin.textContent = "Continuer dans la visite guidée";
  etat("accueil").appendChild(fin);
};

const scriptEnPlus = `
document.addEventListener("click", (ev) => {
  const lien = ev.target.closest("[data-lien]");
  if (!lien) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  location.href = lien.dataset.lien;
}, true);
`;

const css = enHauteurStable(readFileSync(`${S}/css.txt`, "utf8")) + `
.suite-visite{position:fixed;left:16px;right:16px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:80;max-width:420px;margin:0 auto;display:flex;align-items:center;justify-content:center;min-height:56px;border-radius:999px;background:var(--atlas-ink,#1c1c1a);color:var(--atlas-cream,#f5f3ee);font-weight:600;font-size:17px;text-decoration:none;box-shadow:0 18px 40px -16px rgba(0,0,0,.55)}
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
