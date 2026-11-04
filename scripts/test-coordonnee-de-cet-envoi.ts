import assert from "node:assert/strict";
import { coordonneeDeCetEnvoi, peutTaperSaCoordonnee } from "../src/lib/coordonnee-de-cet-envoi";

/**
 * La coordonnée tapée pour UN envoi, quand la fiche du client est supprimée.
 *
 * Sa demande du 3 novembre 2026, capture à l'appui : *« J'ai supprimé le client,
 * mais je ne l'ai pas encore facturé. Donc là, je ne peux plus lui envoyer la
 * facture. […] il faut que je puisse écrire les coordonnées pour lui envoyer la
 * facture. »* Son choix : **« Pour cet envoi seulement »**.
 *
 * La règle allume « Envoyer la facture » à l'écran ET se rejoue au serveur avant
 * l'arrêt et avant le lien (`src/lib/coordonnee-de-cet-envoi.ts`). Ce qui se
 * fixe ici : qui a le droit de taper, et ce qui part vraiment.
 */

let reussis = 0;
let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const SUPPRIME = { clientSupprime: true, partie: false };
const VIVANT = { clientSupprime: false, partie: false };
const PARTIE = { clientSupprime: true, partie: true };

console.log("=== La coordonnée de cet envoi ===\n");

cas("un client supprimé, sa facture pas encore partie : la case s'offre", () => {
  assert.equal(peutTaperSaCoordonnee(SUPPRIME), true);
});

cas("un client vivant garde sa fiche : aucune case", () => {
  assert.equal(peutTaperSaCoordonnee(VIVANT), false);
  const r = coordonneeDeCetEnvoi(VIVANT, "email", "jean@exemple.fr");
  assert.equal(r.ok, false, "une coordonnée tapée a été acceptée pour un client qui a sa fiche");
  assert.equal(r.ok === false && r.motif, "client-vivant");
});

cas("une facture déjà partie ne prend plus de coordonnée tapée", () => {
  // Elle se renvoie depuis « Renvoyer par SMS ou e-mail », sur le lien qui existe.
  assert.equal(peutTaperSaCoordonnee(PARTIE), false);
  const r = coordonneeDeCetEnvoi(PARTIE, "email", "jean@exemple.fr");
  assert.equal(r.ok === false && r.motif, "partie");
});

cas("l'e-mail tapé part tel quel, sans ses blancs autour", () => {
  const r = coordonneeDeCetEnvoi(SUPPRIME, "email", "  jean.martin@exemple.fr ");
  assert.deepEqual(r, { ok: true, destinataire: "jean.martin@exemple.fr" });
});

cas("le numéro tapé part en chiffres, comme la fiche l'enregistre (`telephoneLu`)", () => {
  const r = coordonneeDeCetEnvoi(SUPPRIME, "sms", "06 12 34 56 78");
  assert.deepEqual(r, { ok: true, destinataire: "0612345678" });
  const international = coordonneeDeCetEnvoi(SUPPRIME, "sms", "+32 470 12 34 56");
  assert.equal(international.ok, true, "un numéro international a été refusé");
});

cas("la case suit le canal : un e-mail dans la case du numéro ne passe pas, et l'inverse", () => {
  assert.equal(coordonneeDeCetEnvoi(SUPPRIME, "sms", "jean@exemple.fr").ok, false);
  assert.equal(coordonneeDeCetEnvoi(SUPPRIME, "email", "0612345678").ok, false);
});

cas("une forme fausse se refuse, avec sa phrase", () => {
  for (const [canal, saisie] of [
    ["sms", "85 45"],
    ["sms", "06 12 34"],
    ["email", "jean@"],
    ["email", "jean martin@exemple.fr"],
    ["email", "jean@exemple"],
  ] as const) {
    const r = coordonneeDeCetEnvoi(SUPPRIME, canal, saisie);
    assert.equal(r.ok, false, `« ${saisie} » a été accepté par ${canal}`);
    assert.equal(r.ok === false && r.motif, "forme", `« ${saisie} » n'est pas refusé pour sa forme`);
    assert.ok(r.ok === false && r.raison.length > 0, "le refus n'a pas de phrase");
  }
});

cas("une case vide n'est pas une faute de forme : rien à dire sous elle", () => {
  for (const canal of ["sms", "email"] as const) {
    const r = coordonneeDeCetEnvoi(SUPPRIME, canal, "   ");
    assert.equal(r.ok === false && r.motif, "vide", `une case vide (${canal}) n'est pas lue comme vide`);
  }
});

cas("les phrases de refus n'ont ni tiret ni point médian (`CLAUDE.md` §3)", () => {
  const phrases = [
    coordonneeDeCetEnvoi(VIVANT, "sms", "0612345678"),
    coordonneeDeCetEnvoi(PARTIE, "sms", "0612345678"),
    coordonneeDeCetEnvoi(SUPPRIME, "sms", "12"),
    coordonneeDeCetEnvoi(SUPPRIME, "email", "x"),
    coordonneeDeCetEnvoi(SUPPRIME, "sms", ""),
    coordonneeDeCetEnvoi(SUPPRIME, "email", ""),
  ].map((r) => (r.ok ? "" : r.raison));
  for (const p of phrases) assert.ok(!/[—–·]/.test(p), `« ${p} »`);
});

console.log(
  echecs === 0
    ? `\n✅ La coordonnée de cet envoi : ${reussis} réussis, 0 échec.\n`
    : `\n❌ La coordonnée de cet envoi : ${echecs} échec(s).\n`
);
process.exit(echecs === 0 ? 0 : 1);
