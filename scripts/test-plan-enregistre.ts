/**
 * UN PLAN ENREGISTRÉ, FIGÉ (`src/lib/arrosage/plan-enregistre.ts`) — sa
 * demande du 21 novembre 2026, planche `appli/arrosage-dossiers.html`.
 *
 * Ce que la règle doit tenir, sans base ni serveur :
 *   1. le plan figé est CELUI DE L'ÉCRAN : mêmes fonctions, mêmes chiffres ;
 *   2. l'empreinte dit si deux plans sont le même, et ignore le bruit des
 *      calculs flottants (un iPhone et un serveur ne rendent pas Math.pow au
 *      dernier chiffre près : sans cela, il serait refusé pour rien) ;
 *   3. ce qui arrive du téléphone se relit : une saisie bancale est refusée
 *      en le disant, jamais complétée au jugé ;
 *   4. une version s'ajoute après la plus haute, jamais à sa place.
 */
import assert from "node:assert/strict";
import {
  empreinteDuPlan,
  figerLePlan,
  lireLaSaisie,
  resumeDuPlan,
  versionSuivante,
  type SaisieDuPlan,
} from "../src/lib/arrosage/plan-enregistre";
import { calculerEtDessiner } from "../src/lib/arrosage/le-plan";
import { totalDeLaListe } from "../src/lib/arrosage/prix-de-la-liste";
import { RETOUCHES_VIERGES, supprimer } from "../src/lib/arrosage/retouches";
import type { ParametresPlan } from "../src/lib/arrosage/consignes";
import { ceQueLaSuppressionEfface, enregistreLe, quandEnregistre, resumeDuDossier } from "../src/lib/arrosage/mots-des-dossiers";
import { saisieEcrite } from "../src/lib/arrosage/saisie-ecrite";

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

// Le jardin de la planche du 18 octobre (`scripts/capture-plan-arrosage.ts`).
const JARDIN: ParametresPlan = {
  seau: 10, temps: 18, pression: 3, compteur: "oui", regardVersZone: 0, amenee: 0,
  zones: [
    { id: 1, type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 12, l: 12 },
    { id: 2, type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 },
    { id: 3, type: "massif", nom: "Massif", x: 14, y: 10, L: 20, l: 2.4, sortieGoutte: "boucle" },
    { id: 4, type: "gazon", nom: "Couloir", x: 0, y: 14, L: 10, l: 2, materiel: "tuyere" },
  ],
  nourrice: { x: 13, y: 6 },
  couronne: 50,
} as ParametresPlan;

const saisie = (patch: Partial<SaisieDuPlan> = {}): SaisieDuPlan => ({
  parametres: JARDIN,
  retouches: RETOUCHES_VIERGES,
  reservesDuCroquis: ["Amenée de 5,5 m, du piquage à la nourrice, calculée sur le croquis."],
  sansDessin: null,
  lecture: null,
  ...patch,
});

console.log("=== Un plan enregistré, figé ===\n");

cas("le plan figé est celui de l'écran : même calcul, mêmes réseaux", () => {
  const fige = figerLePlan(saisie());
  const ecran = calculerEtDessiner(JARDIN, null);
  assert.equal(fige.plan.secteurs.length, ecran.plan.secteurs.length);
  assert.ok(fige.plan.secteurs.length > 0, "aucun réseau : le contrôle ne mesure rien");
  assert.deepEqual(fige.plan.reserves, ecran.plan.reserves);
});

cas("les réserves figées sont celles du calcul PUIS celles du croquis, comme sous le plan", () => {
  const fige = figerLePlan(saisie());
  const ecran = calculerEtDessiner(JARDIN, null);
  assert.deepEqual(fige.reserves, [...ecran.plan.reserves, "Amenée de 5,5 m, du piquage à la nourrice, calculée sur le croquis."]);
});

cas("le résumé redit les chiffres de l'écran : réseaux, tranchée, pièces", () => {
  const fige = figerLePlan(saisie());
  const n = fige.plan.secteurs.length;
  const pieces = totalDeLaListe(fige.groupes, {}).pieces;
  assert.ok(pieces > 0);
  const tranchee = Math.round((fige.dessin?.metresTranchee ?? 0) * 10) / 10;
  assert.equal(resumeDuPlan(fige), `${n} réseaux, ${String(tranchee).replace(".", ",")} m de tranchée, ${pieces} pièces`);
});

cas("le même plan donne la même empreinte, deux fois", () => {
  assert.equal(empreinteDuPlan(figerLePlan(saisie())), empreinteDuPlan(figerLePlan(saisie())));
});

cas("une pièce supprimée change l'empreinte : ce n'est plus le même plan", () => {
  const avant = figerLePlan(saisie());
  const cle = avant.postes.amenee[0]?.cle ?? avant.postes.reseaux[0]?.pe.cle;
  assert.ok(cle, "aucune pièce à supprimer : le contrôle ne mesure rien");
  const apres = figerLePlan(saisie({ retouches: supprimer(RETOUCHES_VIERGES, cle) }));
  assert.notEqual(empreinteDuPlan(avant), empreinteDuPlan(apres));
});

cas("l'empreinte ignore le bruit flottant au-delà du centième", () => {
  const fige = figerLePlan(saisie());
  const bruite = structuredClone(fige);
  for (const g of bruite.groupes) for (const l of Object.values(g.lignes)) l.q = l.q + 1e-9;
  assert.equal(empreinteDuPlan(bruite), empreinteDuPlan(fige));
});

cas("une saisie juste se relit telle quelle", () => {
  const brut = JSON.parse(JSON.stringify(saisie()));
  const lu = lireLaSaisie(brut);
  assert.ok(lu.ok, lu.ok ? "" : lu.raison);
  assert.deepEqual(lu.saisie, brut);
});

cas("une saisie bancale est refusée en le disant, jamais complétée", () => {
  const juste = JSON.parse(JSON.stringify(saisie()));
  const refus = (x: unknown) => {
    const lu = lireLaSaisie(x);
    assert.equal(lu.ok, false, `acceptée : ${JSON.stringify(x).slice(0, 80)}`);
    if (!lu.ok) assert.ok(lu.raison.length > 10, "un refus sans phrase n'aide personne");
  };
  refus(null);
  refus("du texte");
  refus({ ...juste, parametres: undefined });
  refus({ ...juste, retouches: { retirees: {} } });
  refus({ ...juste, reservesDuCroquis: [42] });
  refus({ ...juste, sansDessin: 3 });
  refus({ ...juste, parametres: { ...juste.parametres, zones: [{ ...juste.parametres.zones[0], L: 9999 }] } });
  refus({ ...juste, lecture: "x".repeat(400_000) });
});

cas("une version s'ajoute après la plus haute", () => {
  assert.equal(versionSuivante([]), 1);
  assert.equal(versionSuivante([1, 2]), 3);
  assert.equal(versionSuivante([3, 1]), 4);
});

cas("les mots d'un dossier sont ceux de sa planche, à l'heure de Paris", () => {
  const maintenant = new Date("2026-11-21T10:00:00Z");
  assert.equal(resumeDuDossier(0, null, maintenant), "Aucun plan encore");
  assert.equal(resumeDuDossier(1, new Date("2026-11-14T16:05:00Z"), maintenant), "1 plan, le 14 novembre 2026");
  assert.equal(resumeDuDossier(2, new Date("2026-11-21T08:41:00Z"), maintenant), "2 plans, le dernier aujourd’hui");
  assert.equal(quandEnregistre(new Date("2026-11-21T08:41:00Z"), maintenant), "Aujourd’hui, 9 h 41");
  assert.equal(quandEnregistre(new Date("2026-11-14T16:05:00Z"), maintenant), "14 novembre 2026, 17 h 05");
  // Minuit passé à Paris, pas encore à Londres : c'est déjà le lendemain pour lui.
  assert.equal(quandEnregistre(new Date("2026-11-20T23:30:00Z"), maintenant), "Aujourd’hui, 0 h 30");
  // Le bandeau du plan revu, mot pour mot celui de la planche.
  assert.equal(enregistreLe(new Date("2026-11-21T08:41:00Z"), maintenant), "Enregistré aujourd’hui à 9 h 41");
  assert.equal(enregistreLe(new Date("2026-11-14T16:05:00Z"), maintenant), "Enregistré le 14 novembre 2026 à 17 h 05");
  // « Supprimer ce dossier ? » ne nomme que ce qui existe : un plan dessiné n'a pas de photo.
  assert.equal(ceQueLaSuppressionEfface({ plans: 2, photo: true, client: true }), "Ses 2 plans disparaissent de vos dossiers. Le nom du dossier, la photo du croquis et le lien à la fiche sont effacés.");
  assert.equal(ceQueLaSuppressionEfface({ plans: 1, photo: false, client: false }), "Son plan disparaît de vos dossiers. Le nom du dossier est effacé.");
  assert.equal(ceQueLaSuppressionEfface({ plans: 0, photo: false, client: true }), "Il disparaît de vos dossiers. Le nom du dossier et le lien à la fiche sont effacés.");
});

cas("« Voir la saisie » dit ce qu'il a saisi, sans rien ajouter", () => {
  const p = {
    seau: 10, temps: 18, pression: 3, compteur: "oui", regardVersZone: 0, amenee: 0,
    zones: [
      { id: 1, type: "gazon", nom: "Pelouse arrière", L: 12, l: 12 },
      { id: 2, type: "massif", L: 20, l: 2.4 },
      { id: 3, type: "haie", nom: "Haie du fond", ml: 15.5 },
    ],
    nourrice: { x: 13, y: 6 },
    diametres: { amenee: 32 as const, reseaux: { 1: 32 as const } },
  } as unknown as ParametresPlan;
  const lignes = saisieEcrite({ parametres: p, retouches: { ...RETOUCHES_VIERGES, sonde: true }, reservesDuCroquis: [], sansDessin: null, lecture: null });
  const texte = (r: { cle: string; valeurs: { texte: string }[] }) => ({ cle: r.cle, valeurs: r.valeurs.map((v) => v.texte) });
  assert.deepEqual(lignes.map(texte), [
    { cle: "Le piquage", valeurs: ["Juste après le compteur d’eau, 3\u00a0bar et 2\u00a0m³/h"] },
    { cle: "Les zones", valeurs: ["Pelouse arrière, 12 m sur 12 m", "Massif, 20 m sur 2,4 m", "Haie du fond, 15,5 m"] },
    { cle: "Vos choix", valeurs: ["Ø32 sur l’amenée et sur le réseau 2.", "Sonde de pluie : oui. Grillage et téflon : non."] },
  ]);
  // Un plan sans photo n'a rien à dire de la lecture.
  assert.ok(lignes.every((r) => r.valeurs.every((v) => v.note === null)));
  // Au robinet, sans pression relevée ni diamètre choisi : rien d'inventé.
  // Le débit est celui que le calcul a reçu (seau et temps le portent, `actions.ts`).
  const robinet = saisieEcrite({ parametres: { ...p, compteur: "non", pression: 0, diametres: undefined }, retouches: RETOUCHES_VIERGES, reservesDuCroquis: [], sansDessin: null, lecture: null });
  assert.deepEqual(texte(robinet[0]), { cle: "Le piquage", valeurs: ["Robinet de jardin, 2\u00a0m³/h"] });
  assert.deepEqual(texte(robinet[2]), { cle: "Vos choix", valeurs: ["Les diamètres que l’outil propose.", "Sonde de pluie, grillage et téflon : non."] });
});

cas("« Voir la saisie » dit ce qu'il a corrigé de la lecture de l'IA, comme sa planche (« lu 2 m, corrigé par vous »)", () => {
  const lu = (L: number | null, l: number | null, deduites: ("L" | "l")[] = []) => ({ L, l, deduites });
  const zones = [
    { id: 1, type: "gazon", nom: "Pelouse arrière", L: 12, l: 12, luSurLaPhoto: lu(12, 12) },
    { id: 2, type: "massif", nom: "Massif", L: 20, l: 2.4, luSurLaPhoto: lu(20, 2) },
    // Tournée d'un quart de tour sans rien changer : rien n'est corrigé.
    { id: 3, type: "gazon", nom: "Couloir", L: 2, l: 10, luSurLaPhoto: lu(10, 2) },
    // Tournée ET corrigée : la cote corrigée est celle qui a changé.
    { id: 4, type: "massif", nom: "Bordure", L: 2.4, l: 20, luSurLaPhoto: lu(20, 2) },
    { id: 5, type: "gazon", nom: "Allée", L: 3, l: 1.5, luSurLaPhoto: lu(3.5, 1, ["l"]) },
    { id: 6, type: "gazon", nom: "Fond", L: 11, l: 3, luSurLaPhoto: lu(10, 2) },
    // Ajoutée à la main : la photo n'en disait rien.
    { id: 7, type: "gazon", nom: "Ajoutée", L: 4, l: 4 },
    // Une cote que l'IA n'a PAS lue, tapée par lui : « lu » serait faux.
    { id: 8, type: "gazon", nom: "Sans cote lue", L: 5, l: 6, luSurLaPhoto: lu(null, 6) },
  ];
  const r = saisieEcrite({ parametres: { ...JARDIN, zones } as ParametresPlan, retouches: RETOUCHES_VIERGES, reservesDuCroquis: [], sansDessin: null, lecture: null });
  assert.deepEqual(r[1].valeurs.map((v) => v.note), [
    null,
    "(lu 2 m, corrigé par vous)",
    null,
    "(lu 2 m, corrigé par vous)",
    "(lu 3,5 m, déduit 1 m, corrigé par vous)",
    "(lu 10 m sur 2 m, corrigé par vous)",
    null,
    null,
  ]);
  assert.equal(r[1].valeurs[1].texte, "Massif, 20 m sur 2,4 m");
});

console.log(echecs ? `\n❌ ${echecs} échec(s)` : "\n✅ Un plan enregistré se fige, se relit et se compte juste.");
process.exit(echecs ? 1 : 0);
