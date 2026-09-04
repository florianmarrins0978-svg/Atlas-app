// LA CASE OÙ IL TAPE SON PRIX — et la virgule qu'elle avalait.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE DÉFEND** — lot du 5 septembre 2026, écran des prix.
//
// La case du montant était un `<input type="number">`, relue par
// `new Decimal(saisi || "0")`. Un champ numérique **rejette la virgule** : sur
// un clavier français, « 1 400,50 » rend une valeur VIDE, `"" || "0"` vaut
// zéro, et la ligne partait à **0,00 € sans un mot** — sur le seul écran où le
// patron engage de l'argent avant de l'annoncer.
//
// C'est la même famille que le défaut corrigé sur le devis le 30 août
// (`CHANGELOG.md`, « Un prix tapé sur le devis pouvait partir à ZÉRO ») : là,
// c'était un rendu en retard ; ici, c'est le champ lui-même. Les deux
// aboutissent au même endroit — un zéro qui a l'air juste à l'écran.
//
// ─── CE QU'ELLE ÉPROUVE, ET POURQUOI CHAQUE POINT EXISTE ───────────────────
//
// 1. **L'ALLER-RETOUR DE LA CASE.** C'est le point que rien n'aurait attrapé
//    autrement : la case AFFICHE le montant à la française (`enMontant` →
//    « 1 400,50 », avec une espace insécable), et sa sortie de champ RELIT ce
//    qu'elle affiche. Si `montantEcrivable` ne reconnaissait pas cette
//    espace-là, le patron verrait son propre montant refusé en quittant la
//    case sans y avoir touché. Deux fonctions justes séparément, et un aller-
//    retour cassé entre les deux.
//
// 2. **L'ANCIENNE LECTURE, REJOUÉE.** Un contrôle qui n'a jamais échoué ne
//    prouve rien (`AGENTS.md`). On rejoue donc ici ce que faisait le champ
//    numérique — rendre du VIDE devant une virgule — et l'on vérifie que
//    l'ancienne façon de lire écrivait bien un zéro. Le jour où quelqu'un
//    remet `type="number"`, c'est cette ligne qui dira pourquoi c'est faux.
//
// 3. **CE QUI ATTEND SON PRIX**, avec la règle partagée et elle seule
//    (`ligneAttendSonPrix`) : l'écran la consomme pour teinter la ligne et
//    pour compter, le serveur pour refuser le devis, le PDF pour ne pas
//    mentir. Une quatrième lecture de la même question a déjà produit un devis
//    dont le total ne correspondait pas à ses lignes (31 août 2026).
//
// Ni base, ni réseau, ni navigateur : des fonctions pures.
// ═══════════════════════════════════════════════════════════════════════════

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Decimal from "decimal.js";
import { montantEcrivable } from "../src/lib/montant-ecrivable";
import { enMontant } from "../src/lib/euros";
import { ligneAttendSonPrix, lignesEnAttenteDePrix } from "../src/lib/preparation-devis";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/**
 * Ce que la case rend quand il y tape ce texte, SELON SON TYPE.
 *
 * Un `<input type="number">` ne rend pas ce qu'on voit : devant une saisie
 * qu'il juge invalide — et une virgule en fait partie — il rend la chaîne
 * vide. C'est le comportement du navigateur, pas une supposition : c'est la
 * raison d'être de `inputMode="decimal"` sur un champ de TEXTE, que l'écran du
 * devis avait déjà adopté.
 */
function ceQueRendLaCase(tape: string, type: "number" | "text"): string {
  if (type === "text") return tape;
  return /^-?\d*\.?\d*$/.test(tape) ? tape : "";
}

/** L'ancienne lecture de l'écran des prix, mot pour mot. */
function ancienneLecture(valeurDuChamp: string): string {
  return new Decimal(valeurDuChamp || "0").toFixed(2);
}

/** La lecture d'aujourd'hui : la règle partagée, et rien d'autre. */
function lectureActuelle(valeurDuChamp: string): string | null {
  const texte = valeurDuChamp.trim();
  if (texte === "") return "0.00";
  const lu = montantEcrivable(texte);
  return lu.ok ? lu.montant : null;
}

console.log("La case du prix");

essai("sa virgule arrive jusqu'en base — c'est le défaut du 5 septembre", () => {
  const tape = "1 400,50";

  // L'ancien champ : ce qu'il voit à l'écran n'est pas ce qui part.
  const ancienChamp = ceQueRendLaCase(tape, "number");
  assert.equal(ancienChamp, "", "le champ numérique devrait avaler la virgule — sinon ce contrôle ne prouve rien");
  assert.equal(
    ancienneLecture(ancienChamp),
    "0.00",
    "l'ancienne lecture devrait écrire zéro : c'est le défaut que ce lot corrige"
  );

  // Le champ d'aujourd'hui : ce qu'il tape est ce qui part.
  assert.equal(lectureActuelle(ceQueRendLaCase(tape, "text")), "1400.50");
});

essai("le point continue de passer — les suites et ses habitudes en dépendent", () => {
  // `test-devis-e2e.ts` remplit « 1000.00 » : un lot qui ne ferait passer que
  // la virgule casserait la batterie en croyant réparer.
  assert.equal(lectureActuelle("1000.00"), "1000.00");
  assert.equal(lectureActuelle("1400,50"), "1400.50");
  assert.equal(lectureActuelle("1 400,50 €"), "1400.50");
});

essai("la case relit ce qu'elle affiche — l'aller-retour tient", () => {
  // **Le piège que rien d'autre n'aurait vu.** Au repos la case porte
  // « 1 400,50 » avec l'espace INSÉCABLE d'`Intl` ; quitter la case sans y
  // toucher relance la lecture sur ce texte-là. S'il était refusé, le patron
  // verrait son propre montant rejeté sans avoir rien tapé.
  for (const montant of ["1400.50", "1000.00", "0.00", "99999999.99", "45000.00"]) {
    const affiche = enMontant(montant);
    const relu = lectureActuelle(affiche);
    assert.equal(relu, montant, `« ${affiche} » n'est pas relu comme ${montant}`);
  }

  // Et l'espace en cause est bien une insécable, pas une ordinaire : si un
  // jour `enMontant` cessait d'en poser, ce contrôle deviendrait muet sans
  // qu'on le sache.
  assert.ok(enMontant("1400.50").includes(" "), "l'aller-retour n'éprouve plus l'espace insécable");
});

essai("une case vidée remet la ligne sans prix, elle ne refuse rien", () => {
  // Vider n'est pas une faute : c'est une ligne qui redevient à chiffrer. Un
  // refus ici bloquerait le geste le plus ordinaire de l'écran.
  assert.equal(lectureActuelle(""), "0.00");
  assert.equal(lectureActuelle("   "), "0.00");
});

essai("ce qui n'est pas un montant est refusé, et nommé", () => {
  assert.equal(lectureActuelle("mille quatre cents"), null);
  assert.equal(lectureActuelle("1400,505"), null, "trois décimales : un euro n'en a que deux");
  assert.equal(lectureActuelle("-40"), null);
  // Le refus doit NOMMER ce qu'il refuse : « cette modification n'a pas pu être
  // appliquée » envoie chercher une panne là où il s'agit d'une valeur.
  const refus = montantEcrivable("1400,505");
  assert.ok(!refus.ok && refus.raison.includes("1400,505"), "le refus ne nomme pas le montant en cause");
});

console.log("");
console.log("Ce qui attend son prix");

const ligne = (libelle: string, montant: string, aChiffrer?: boolean) => ({ libelle, montant, aChiffrer });

essai("l'écran compte avec la règle partagée, pas avec la sienne", () => {
  // Les trois formes que l'écran rencontre, et elles ne se ressemblent pas :
  const marqueeSansPrix = ligne("Dessouchage", "0.00", true);
  const marqueeAvecPrix = ligne("Tonte", "560.00", true);
  const ordinaireAZero = ligne("Ligne neuve", "0.00", false);

  assert.equal(ligneAttendSonPrix(marqueeSansPrix), true);
  // **Un montant posé RÉPOND à la question, quel que soit le drapeau** —
  // sa troisième capture du 31 août 2026, où le total contredisait le tableau.
  assert.equal(ligneAttendSonPrix(marqueeAvecPrix), false);
  // Une ligne qu'on vient d'ajouter n'attend rien : elle est vide, pas due.
  // Les teinter toutes ferait parler l'avertissement à tort, et on l'ignorerait.
  assert.equal(ligneAttendSonPrix(ordinaireAZero), false);

  const enAttente = [marqueeSansPrix, marqueeAvecPrix, ordinaireAZero].filter(ligneAttendSonPrix);
  assert.equal(enAttente.length, 1, "le compte affiché à côté de « Détail » ne suit pas la règle");
});

essai("poser le montant éteint l'attente, sans passer par le serveur", () => {
  // Ce que fait l'écran quand il quitte la case : le compte doit tomber tout
  // de suite, sinon il croit que son geste n'a pas été pris.
  const avant = ligne("Dessouchage", "0.00", true);
  assert.equal(ligneAttendSonPrix(avant), true);

  const montant = lectureActuelle("1 400,50");
  assert.ok(montant);
  const apres = { ...avant, montant, aChiffrer: Number(montant) > 0 ? false : avant.aChiffrer };
  assert.equal(ligneAttendSonPrix(apres), false);
  assert.equal(lignesEnAttenteDePrix([apres]), null);
});

console.log("");
console.log("L'écran lui-même");

// **Sans ces trois-là, cette suite ne défendrait qu'une bibliothèque.** Tout ce
// qui précède éprouve des fonctions pures — elles étaient déjà justes AVANT ce
// lot, et le défaut vivait dans l'écran qui ne les employait pas. Un contrôle
// qui entre par une porte de service ne dit rien de la porte d'entrée
// (`CLAUDE.md` §5 quater).
const SOURCE_ECRAN = readFileSync(
  new URL("../src/app/chantiers/[id]/prix/PrixClient.tsx", import.meta.url),
  "utf8"
);

/**
 * L'écran SANS ses commentaires.
 *
 * **Ce contrôle a rougi à sa première exécution, sur du code juste**, et c'est
 * ce qui l'a rendu utile : la case porte bien `type="text"`, mais le
 * commentaire qui raconte le défaut cite `<input type="number">` en toutes
 * lettres. Un contrôle qui accuse la prose d'être le code envoie chercher au
 * mauvais endroit (`AGENTS.md`) — et pousserait, pour se taire, à effacer
 * l'explication qui a le plus de valeur.
 */
const ECRAN = SOURCE_ECRAN.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join("\n");

essai("la case du montant n'est plus un champ numérique", () => {
  assert.ok(
    !/type="number"/.test(ECRAN),
    "un `type=\"number\"` est revenu sur l'écran des prix : il avale la virgule du clavier français, " +
      "et le montant part à zéro sans un mot"
  );
  assert.ok(/inputMode="decimal"/.test(ECRAN), "la case doit sortir le pavé de chiffres sans interdire la virgule");
});

essai("l'écran ne relit pas les montants à sa façon", () => {
  assert.ok(
    /montantEcrivable/.test(ECRAN),
    "l'écran doit lire les montants avec la règle partagée, pas avec un `new Decimal` de son cru"
  );
  assert.ok(
    /ligneAttendSonPrix/.test(ECRAN),
    "l'attente de prix se lit avec `preparation-devis`, la même règle que le serveur, le PDF et l'envoi"
  );
});

essai("le refus ne renvoie aux réglages que s'il n'y a aucune ligne", () => {
  // Le refus « 2 lignes attendent leur prix » offrait « Ouvrir mes tarifs » :
  // le seul geste proposé QUITTAIT l'écran où se trouve la réparation.
  assert.ok(
    /visibles\.length === 0 \?/.test(ECRAN),
    "la porte du refus ne suit plus sa raison : « Ouvrir mes tarifs » doit être réservé au cas sans ligne"
  );
  assert.ok(/data-prix-ligne/.test(ECRAN), "le refus doit pouvoir emmener le doigt sur la case en attente");
});

console.log("");
console.log(`${echecs === 0 ? "✅" : "❌"} La case du prix — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
