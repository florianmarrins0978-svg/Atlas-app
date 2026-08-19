/**
 * La planche 82 annonce des comptes de mots. Ce contrôle les recompte.
 *
 * **Pourquoi il existe.** Toute la planche repose sur trois nombres — 92 %,
 * 92 %, 81 %. Un nombre écrit à la main dans une page HTML vieillit à la
 * première retouche, et personne ne s'en aperçoit : on continue de montrer au
 * patron un gain qui n'existe plus. Ici, le nombre annoncé est confronté au
 * texte réellement présent dans le cadre du téléphone juste au-dessus.
 *
 * **Il sait échouer** (`AGENTS.md`) : `--eprouver` retire un mot d'un cadre en
 * mémoire et exige que le contrôle rougisse. Sans cette épreuve, un contrôle
 * qui compte mal rendrait un vert éternel.
 *
 *   node scripts/verifier-maquette-moins-de-mots.mjs [--eprouver]
 */
import { readFileSync } from "node:fs";

const PLANCHE = "docs/maquettes/82-moins-de-mots.html";

/**
 * Les cadres de téléphone, dans l'ordre où ils apparaissent.
 *
 * Découpés à la main plutôt qu'avec une expression régulière « bien sentie » :
 * les `<div>` s'imbriquent, et un motif non gourmand s'arrête au premier
 * `</div>` venu. C'est exactement ce qui a fait compter 8 mots à la rubrique
 * des réglages, qui en portait 129.
 */
function cadres(html) {
  const corps = html.split("</style>")[1] ?? "";
  const trouves = [];
  const MARQUE = '<div class="tel">';
  let i = corps.indexOf(MARQUE);
  while (i !== -1) {
    // On suit la profondeur des <div> jusqu'à refermer celui qu'on vient d'ouvrir.
    let profondeur = 0;
    let j = i;
    let fin = -1;
    while (j < corps.length) {
      if (corps.startsWith("<div", j)) profondeur++;
      else if (corps.startsWith("</div>", j)) {
        profondeur--;
        if (profondeur === 0) {
          fin = j + "</div>".length;
          break;
        }
      }
      j++;
    }
    if (fin === -1) throw new Error("un cadre <div class=\"tel\"> n'est jamais refermé");
    trouves.push(corps.slice(i, fin));
    i = corps.indexOf(MARQUE, fin);
  }
  return trouves;
}

/**
 * Les mots que l'œil rencontre : le balisage ne compte pas, les entités si.
 *
 * **Ce que l'application écrit, pas ce que le patron tape.** « Dupont »,
 * « 06 12 34 56 78 », « 8 rue du Port » sont ses données : elles seraient là
 * quelle que soit la mise en page, et les compter ferait passer un écran pour
 * bavard alors que c'est son client qui a un nom long. La mesure faite dans
 * l'application les ignore déjà — `innerText` ne rend pas la valeur d'un
 * champ de saisie —, et la planche doit compter de la même façon, sans quoi les
 * deux nombres ne se comparent pas.
 */
function compterMots(fragment) {
  const texte = fragment
    .replace(/<div class="champ[^"]*">[\s\S]*?<\/div>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&hellip;/g, "…");
  return texte.split(/\s+/).filter((m) => /[0-9A-Za-zÀ-ÿ]/.test(m)).length;
}

/** Les nombres annoncés, dans l'ordre des étiquettes. */
function annonces(html) {
  const corps = html.split("</style>")[1] ?? "";
  return [...corps.matchAll(/<span class="compte">(\d+) mots/g)].map((m) => Number(m[1]));
}

const html = readFileSync(PLANCHE, "utf8");
let mesCadres = cadres(html);

// L'épreuve : on abîme un cadre et l'on exige que le contrôle le voie.
const eprouver = process.argv.includes("--eprouver");
// On retire un mot d'ÉTIQUETTE, pas une valeur de champ : les valeurs sont
// écartées du compte, et les abîmer ne prouverait rien — l'épreuve rendrait un
// vert éternel, exactement le défaut qu'elle est censée interdire.
if (eprouver) mesCadres = mesCadres.map((c, i) => (i === 1 ? c.replace("Nom", "") : c));

const attendus = annonces(html);
if (mesCadres.length !== 6) {
  console.error(`❌ ${mesCadres.length} cadres trouvés, six attendus (trois écrans, avant et après).`);
  process.exit(1);
}
if (attendus.length !== 6) {
  console.error(`❌ ${attendus.length} comptes annoncés, six attendus.`);
  process.exit(1);
}

const NOMS = [
  "Fiche client — aujourd'hui",
  "Fiche client — proposé",
  "Accueil — aujourd'hui",
  "Accueil — proposé",
  "Réglages — aujourd'hui",
  "Réglages — proposé",
];

let faux = 0;
mesCadres.forEach((cadre, i) => {
  const reel = compterMots(cadre);
  const dit = attendus[i];
  const bon = reel === dit;
  if (!bon) faux++;
  console.log(`${bon ? "  " : "❌"} ${NOMS[i].padEnd(28)} annoncé ${String(dit).padStart(3)} · compté ${String(reel).padStart(3)}`);
});

// Un cadre VIDE rendrait « 0 mot », donc « −100 % », donc un gain magnifique et
// faux. Zéro n'est pas une mesure (`CLAUDE.md` §5).
const vide = mesCadres.findIndex((c) => compterMots(c) === 0);
if (vide !== -1) {
  console.error(`❌ ${NOMS[vide]} : cadre vide — un compte de zéro ne mesure rien.`);
  process.exit(1);
}

// Et l'argument lui-même : chaque « après » doit être plus court que son « avant ».
for (const [avant, apres] of [[0, 1], [2, 3], [4, 5]]) {
  if (compterMots(mesCadres[apres]) >= compterMots(mesCadres[avant])) {
    console.error(`❌ ${NOMS[apres]} n'est pas plus court que ${NOMS[avant]} — la planche ne démontre rien.`);
    faux++;
  }
}

if (eprouver) {
  if (faux > 0) {
    console.log("\n✅ Épreuve concluante : le contrôle rougit bien quand un cadre change.");
    process.exit(0);
  }
  console.error("\n❌ Épreuve ratée : le cadre a été abîmé et le contrôle n'a rien vu.");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Et le tableau, lui, doit dire ce que la MESURE a rendu.
//
// **C'est le contrôle qui compte le plus.** Les nombres des cadres se vérifient
// tout seuls — ils sont dans le même fichier. Ceux du tableau viennent de
// l'application, et rien n'empêcherait la planche de continuer à annoncer 135
// mots six mois après qu'un écran en porte 210. Une planche périmée est pire
// qu'absente : on décide encore d'après elle.
const mesures = JSON.parse(readFileSync("docs/maquettes/82-mesures.json", "utf8"));
const parNom = Object.fromEntries(mesures.releves.map((r) => [r.nom, r]));

const LIGNES = [
  ["Accueil", parNom["Accueil"].mots, parNom["Accueil"].touchables],
  ["La fiche client", mesures.ficheClientRemplie.mots, null],
  ["Le devis", parNom["Le devis"].mots, parNom["Le devis"].touchables],
  ["Réglages", parNom["Onglet Réglages"].mots, parNom["Onglet Réglages"].touchables],
  ["Planning", parNom["Onglet Planning"].mots, parNom["Onglet Planning"].touchables],
];

const corpsPlanche = html.split("</style>")[1] ?? "";
for (const [nom, mots, touchables] of LIGNES) {
  // La ligne du tableau qui porte ce nom, et les nombres qu'elle affiche.
  const ligne = corpsPlanche
    .split("<tr>")
    .find((l) => l.includes(`<td>${nom}`));
  if (!ligne) {
    console.error(`❌ le tableau ne porte aucune ligne « ${nom} ».`);
    faux++;
    continue;
  }
  const nombres = [...ligne.matchAll(/<td class="n">([\d,—-]+)<\/td>/g)].map((m) => m[1]);
  if (nombres[0] !== String(mots)) {
    console.error(`❌ tableau, ${nom} : ${nombres[0]} mots annoncés, ${mots} mesurés.`);
    faux++;
  }
  if (touchables !== null && nombres[1] !== String(touchables)) {
    console.error(`❌ tableau, ${nom} : ${nombres[1]} choses touchables annoncées, ${touchables} mesurées.`);
    faux++;
  }
}

// Le parcours : les gestes et les mots traversés.
if (!corpsPlanche.includes(`<b>${mesures.total.gestes} gestes</b>`)) {
  console.error(`❌ la planche n'annonce pas les ${mesures.total.gestes} gestes mesurés.`);
  faux++;
}
if (!corpsPlanche.includes(`<b>${mesures.total.motsDuParcours} mots</b>`)) {
  console.error(`❌ la planche n'annonce pas les ${mesures.total.motsDuParcours} mots mesurés du parcours.`);
  faux++;
}

if (faux > 0) {
  console.error(`\n❌ ${faux} écart(s) entre ce que la planche annonce et ce qu'elle montre.`);
  process.exit(1);
}
console.log("\n✅ Planche 82 : les six comptes des cadres et les cinq lignes du tableau");
console.log("   correspondent au texte dessiné et au relevé de l'application.");
