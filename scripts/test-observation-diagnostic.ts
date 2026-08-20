import assert from "node:assert/strict";
import {
  lireObservation,
  SYSTEME_OBSERVATION,
} from "../src/server/diagnostic/observation";
import { MOTIFS, PARTIES, COULEURS, LOCALISATIONS } from "../src/lib/diagnostic-vegetal";

/**
 * Ce que le modèle rend RÉELLEMENT, et ce qu'on en fait.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Ce qui est éprouvé ici est la seule chose éprouvable ici.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Il n'y a **aucune clé d'IA dans cet environnement** : l'appel réel au
 * fournisseur ne sera pas vérifié ici, exactement comme pour la lecture des
 * tickets (`lire-ticket.ts`). Il devra l'être sur le banc du patron, avec de
 * vraies photos — et tant que ce n'est pas fait, ça s'écrit « non vérifié »
 * (`AGENTS.md`).
 *
 * Ce qui EST éprouvable, et c'est là que vivent les vrais pièges : la lecture
 * de ce qu'un modèle écrit. Les trois travers observés dans ce dépôt (voir
 * `lire-ticket.ts`) sont tous rejoués :
 *
 *   1. il **entoure** son objet — prose, balises de code, mot d'excuse ;
 *   2. il rend des valeurs **hors énumération** ;
 *   3. il rend une réponse **vide déguisée en réponse**.
 *
 * Et un quatrième, propre à ce module et le plus grave : **il essaie de
 * conclure**. On vérifie que sa conclusion n'a nulle part où aller.
 */

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

const BONNE_REPONSE = JSON.stringify({
  partie: "feuille",
  signes: [
    { partie: "feuille", motif: "tache", couleurs: ["brun"], localisation: "face_superieure" },
  ],
  essence: { nom_scientifique: "Quercus robur", nom_commun: "chêne", port: "feuillu", certitude: "probable" },
  qualite_photo: "bonne",
  reserves: [],
});

console.log("\n=== La consigne elle-même ===");

cas("le vocabulaire est INJECTÉ, jamais recopié — sinon il divergerait au premier mot ajouté", () => {
  for (const mot of [...PARTIES, ...MOTIFS, ...COULEURS, ...LOCALISATIONS]) {
    assert.ok(
      SYSTEME_OBSERVATION.includes(mot),
      `« ${mot} » du vocabulaire n’est pas proposé au modèle : une fiche l’employant ne sortirait jamais`
    );
  }
});

cas("la consigne interdit explicitement de nommer un problème", () => {
  assert.match(SYSTEME_OBSERVATION, /TU NE POSES AUCUN DIAGNOSTIC/);
  assert.match(SYSTEME_OBSERVATION, /Ne rends aucun nom de maladie/);
});

console.log("\n=== Lecture d'une réponse ordinaire ===");

cas("une réponse conforme est lue", () => {
  const r = lireObservation(BONNE_REPONSE);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.observation.partie, "feuille");
  assert.equal(r.observation.signes.length, 1);
  assert.equal(r.observation.signes[0].motif, "tache");
  assert.deepEqual(r.observation.signes[0].couleurs, ["brun"]);
  assert.equal(r.observation.essence?.nomScientifique, "Quercus robur");
  assert.equal(r.observation.qualitePhoto, "bonne");
});

console.log("\n=== Travers 1 : il entoure son objet ===");

cas("balises de code", () => {
  const r = lireObservation("```json\n" + BONNE_REPONSE + "\n```");
  assert.equal(r.ok, true);
});

cas("prose avant et après", () => {
  const r = lireObservation(`Voici ma description :\n${BONNE_REPONSE}\nJ'espère que cela aide.`);
  assert.equal(r.ok, true);
});

console.log("\n=== Travers 2 : des valeurs hors énumération ===");

cas("un motif inventé est JETÉ, pas rattrapé sous un autre nom", () => {
  const r = lireObservation(
    JSON.stringify({
      partie: "feuille",
      signes: [
        { partie: "feuille", motif: "moisissure", couleurs: [], localisation: null },
        { partie: "feuille", motif: "tache", couleurs: [], localisation: null },
      ],
      qualite_photo: "bonne",
    })
  );
  assert.equal(r.ok, true);
  // Le rattraper « au plus proche » serait interpréter à la place du modèle,
  // et faire entrer un motif inventé par la porte de service.
  assert.equal(r.ok && r.observation.signes.length, 1);
  assert.equal(r.ok && r.observation.signes[0].motif, "tache");
});

cas("la casse et les espaces sont tolérés — un mot juste mal écrit reste juste", () => {
  const r = lireObservation(
    JSON.stringify({
      partie: "Feuille",
      signes: [{ partie: "FEUILLE", motif: "Feutrage blanc", couleurs: ["Blanc"], localisation: "Face inférieure" }],
      qualite_photo: "bonne",
    })
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.observation.partie, "feuille");
  assert.equal(r.observation.signes[0].motif, "feutrage_blanc");
  assert.deepEqual(r.observation.signes[0].couleurs, ["blanc"]);
  assert.equal(r.observation.signes[0].localisation, "face_inferieure");
});

cas("une qualité de photo inconnue retombe sur « moyenne », jamais sur « bonne »", () => {
  const r = lireObservation(
    JSON.stringify({ partie: "feuille", signes: [], qualite_photo: "excellente" })
  );
  assert.equal(r.ok && r.observation.qualitePhoto, "moyenne");
});

cas("une couleur inventée disparaît sans emporter le signe entier", () => {
  const r = lireObservation(
    JSON.stringify({
      partie: "feuille",
      signes: [{ partie: "feuille", motif: "tache", couleurs: ["turquoise", "brun"], localisation: null }],
      qualite_photo: "bonne",
    })
  );
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.observation.signes.length, 1);
  assert.deepEqual(r.ok && r.observation.signes[0].couleurs, ["brun"]);
});

console.log("\n=== Travers 3 : une réponse vide déguisée en réponse ===");

cas("du texte sans objet JSON est refusé", () => {
  const r = lireObservation("Je ne peux pas analyser cette photo, désolé.");
  assert.equal(r.ok, false);
});

cas("un JSON malformé est refusé", () => {
  assert.equal(lireObservation("{ partie: feuille, ").ok, false);
});

cas("un tableau à la place d'un objet est refusé", () => {
  assert.equal(lireObservation("[1, 2, 3]").ok, false);
});

cas("un objet vide est LU, et rend une observation sans signe", () => {
  const r = lireObservation("{}");
  assert.equal(r.ok, true);
  // C'est l'arbitrage qui en tirera « aucune piste » — pas cette fonction, qui
  // n'a pas à décider de ce que l'absence de signe signifie.
  assert.equal(r.ok && r.observation.signes.length, 0);
  assert.equal(r.ok && r.observation.essence, null);
});

console.log("\n=== Travers 4, le plus grave : il essaie de conclure ===");

cas("un champ « diagnostic » ajouté par le modèle est IGNORÉ — il n'a nulle part où aller", () => {
  const r = lireObservation(
    JSON.stringify({
      partie: "feuille",
      signes: [{ partie: "feuille", motif: "feutrage_blanc", couleurs: ["blanc"], localisation: null }],
      qualite_photo: "bonne",
      diagnostic: "Oïdium du chêne",
      maladie_probable: "Erysiphe alphitoides",
      gravite: "faible",
      recommandation: "Traiter au soufre",
    })
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const rendu = JSON.stringify(r.observation);
  for (const inventé of ["Oïdium", "Erysiphe", "soufre", "gravite", "recommandation"]) {
    assert.equal(
      rendu.includes(inventé),
      false,
      `« ${inventé} » a traversé : le schéma de sortie ne doit offrir AUCUNE case où conclure`
    );
  }
});

cas("une essence vide n'est pas une essence — on ne devine pas", () => {
  const r = lireObservation(
    JSON.stringify({
      partie: "feuille",
      signes: [],
      essence: { nom_scientifique: "", nom_commun: null, port: null, certitude: "sure" },
      qualite_photo: "bonne",
    })
  );
  assert.equal(r.ok && r.observation.essence, null);
});

cas("les réserves sont bornées — un modèle bavard ne remplit pas la base", () => {
  const r = lireObservation(
    JSON.stringify({
      partie: "feuille",
      signes: [],
      qualite_photo: "bonne",
      reserves: Array.from({ length: 40 }, (_, i) => `réserve ${i}`),
    })
  );
  assert.equal(r.ok && r.observation.reserves.length, 5);
});

console.log(
  echecs === 0 ? `\n✅ Toutes les vérifications passent.` : `\n❌ ${echecs} vérification(s) en échec.`
);
process.exit(echecs === 0 ? 0 : 1);
