// LA MAQUETTE DES DEUX FICHES NE MONTRE QUE DU VRAI.
//
// Sa demande du 26 août 2026 : *« ressors-moi les deux pages côte à côte dans
// une maquette dynamique que je comprenne bien »*, pour trancher s'il faut
// supprimer « Fiche d'entretien » des Réglages.
//
// **Ce que ce contrôle défend, et pourquoi il existe.** Une maquette qui montre
// des prestations inventées le ferait juger un écran sur un contenu qu'il ne
// retrouvera pas (`CLAUDE.md` §4 bis, payé le 20 août sur l'arrosage). Les
// vingt lignes de gauche doivent donc être EXACTEMENT celles du code — le même
// témoin que `test-prestations-entretien.ts` pose sur la planche 62.
//
// **Et la page doit rester lisible sans JavaScript** : il l'ouvre sur son
// téléphone, parfois hors ligne. Les onglets sont des radios ; un `<script>`
// glissé ici rendrait la page muette sans que personne s'en aperçoive.
//
//     node scripts/verifier-maquette-deux-fiches.mjs
import { readFileSync } from "node:fs";

const CHEMIN = "appli/deux-fiches.html";
const page = readFileSync(CHEMIN, "utf8");
const echecs = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs.push(quoi);
};

console.log("=== La maquette des deux fiches ===\n");

// ── 1. Les vingt prestations sont celles du code ────────────────────────────
const source = readFileSync("src/lib/prestations-entretien.ts", "utf8");
const modele = [...source.matchAll(/\{ famille: "([^"]+)", libelle: "([^"]+)" \}/g)].map((m) => ({
  famille: m[1],
  libelle: m[2],
}));
dire(modele.length >= 20, `le code porte ${modele.length} prestations (lues dans MODELE_FOURNI)`);

const surLaPage = [...page.matchAll(/<span class="mot">([^<]+)<\/span>/g)].map((m) => m[1]);
const manquantes = modele.filter((p) => !surLaPage.includes(p.libelle));
dire(
  manquantes.length === 0,
  manquantes.length === 0
    ? "chaque prestation du code est sur la maquette"
    : `absentes de la maquette : ${manquantes.map((p) => p.libelle).join(", ")}`
);

const inventees = surLaPage.filter((l) => !modele.some((p) => p.libelle === l));
dire(
  inventees.length === 0,
  inventees.length === 0
    ? "aucune prestation inventée"
    : `inventées : ${inventees.join(", ")}`
);

// Les familles aussi : « Pelouse » mal orthographiée se lirait sans qu'on la voie.
const familles = [...new Set(modele.map((p) => p.famille))];
dire(
  familles.every((f) => page.includes(f)),
  `les ${familles.length} familles du code sont nommées`
);

// ── 2. Elle tient sans JavaScript ───────────────────────────────────────────
dire(!/<script/i.test(page), "aucun script : la page s'ouvre hors ligne");
dire(
  (page.match(/type="radio"/g) ?? []).length === 3,
  "les trois onglets sont des boutons radio, pas du script"
);

// ── 3. Elle dit bien les deux choses qu'il doit comprendre ──────────────────
dire(page.includes("Fiche de chantier"), "l'écran de droite porte son vrai nom");
dire(page.includes("Fiche d'entretien"), "le nom d'aujourd'hui est montré");
dire(page.includes("Les prestations de ma fiche"), "le nom proposé est montré");
dire(
  /refuse de s'ouvrir/.test(page),
  "la conséquence d'une suppression est écrite : la fiche ne s'ouvre plus"
);

// ── 4. Pas de flèche décorative — sa consigne du 25 août 2026 ───────────────
dire(!/→\s*<\/(span|label|a)>/.test(page), "aucune flèche décorative en fin de libellé");

console.log(`\n${echecs.length === 0 ? "✅" : "❌"} ${CHEMIN} — ${echecs.length} défaut(s).`);
process.exit(echecs.length === 0 ? 0 : 1);
