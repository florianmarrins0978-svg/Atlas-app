import assert from "node:assert/strict";
import { ligneEtatChantier } from "../src/lib/chantier-etat";

// **Ce qui s'écrit sous le nom d'un chantier, dans la liste.**
//
// Le patron, le 13 août 2026, capture à l'appui : *« le devis a été envoyé et
// il n'a toujours pas eu de réponse […] il faut le notifier sous le nom »*,
// puis, devant les cinq propositions : *« j'aime bien le D, mais en dessous de
// "devis envoyé" je veux qu'il y ait marqué la date à laquelle on l'a
// envoyé »*.
//
// Éprouvé ici sans base ni navigateur : c'est une règle, pas un écran.
// Ce que la suite tient, et qui est exactement ce qu'il a demandé :
//
//   1. un devis parti se DIT parti, et non « en attente » ;
//   2. la date d'envoi s'écrit dessous, en clair ;
//   3. **elle n'est jamais devinée** — sans envoi enregistré, pas de ligne ;
//   4. la mention des photos disparaît une fois le devis parti, et reste
//      partout ailleurs ;
//   5. les autres états ne bougent pas d'un mot.

let reussis = 0;
const echecs: string[] = [];
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (e) {
    console.log(`  ✗ ${nom}`);
    console.log(`     ${e instanceof Error ? e.message : e}`);
    echecs.push(nom);
  }
}

// Un jour de référence figé : « le 13 août 2026 » ne doit pas dépendre du jour
// où la suite tourne, sinon elle rougirait toute seule à minuit.
const AUJOURDHUI = new Date(Date.UTC(2026, 7, 13));

console.log("=== La ligne sous le nom d'un chantier ===");

cas("un devis parti se dit parti, et porte sa date d'envoi", () => {
  const l = ligneEtatChantier({
    statut: "en_attente_client",
    photosCount: 0,
    envoyeLe: "2026-08-10",
    aujourdHui: AUJOURDHUI,
  });
  assert.equal(l.etat, "Devis envoyé · sans réponse");
  assert.equal(l.precision, "Envoyé le lundi 10 août.");
  assert.equal(l.enOr, true);
});

cas("« devis envoyé » dit la même chose : c'est le même moment pour lui", () => {
  const l = ligneEtatChantier({ statut: "devis_envoye", photosCount: 3, envoyeLe: "2026-08-10", aujourdHui: AUJOURDHUI });
  assert.equal(l.etat, "Devis envoyé · sans réponse");
});

cas("à relancer : la ligne le dit, et garde la date", () => {
  const l = ligneEtatChantier({ statut: "a_relancer", photosCount: 0, envoyeLe: "2026-07-28", aujourdHui: AUJOURDHUI });
  assert.equal(l.etat, "Devis envoyé · à relancer");
  assert.equal(l.precision, "Envoyé le mardi 28 juillet.");
});

cas("SANS envoi enregistré, aucune date n'est inventée", () => {
  // Le piège que ce contrôle existe pour fermer : prendre la dernière
  // modification du chantier faute de mieux. Ce n'est PAS la date d'envoi, et
  // il compte ses jours d'attente dessus (`CLAUDE.md` §4).
  const l = ligneEtatChantier({ statut: "en_attente_client", photosCount: 0, envoyeLe: null });
  assert.equal(l.etat, "Devis envoyé · sans réponse");
  assert.equal(l.precision, null);
});

cas("la mention des photos disparaît une fois le devis parti", () => {
  const l = ligneEtatChantier({ statut: "en_attente_client", photosCount: 0, envoyeLe: "2026-08-10", aujourdHui: AUJOURDHUI });
  assert.doesNotMatch(l.etat, /photo/i, `La photo occupe la place de ce qui compte : « ${l.etat} »`);
});

cas("avant l'envoi, elle reste — c'est là qu'elle sert", () => {
  assert.equal(
    ligneEtatChantier({ statut: "brouillon", photosCount: 0 }).etat,
    "Brouillon · sans photo"
  );
  assert.equal(
    ligneEtatChantier({ statut: "a_verifier", photosCount: 1 }).etat,
    "À vérifier · 1 photo"
  );
  assert.equal(
    ligneEtatChantier({ statut: "verifie", photosCount: 4 }).etat,
    "Vérifié · 4 photos"
  );
});

cas("les états qui n'ont rien à voir avec un envoi ne bougent pas d'un mot", () => {
  for (const [statut, attendu] of [
    ["planifie", "Planifié · sans photo"],
    ["termine", "À facturer · sans photo"],
    ["facture", "Facturé · sans photo"],
  ] as const) {
    const l = ligneEtatChantier({ statut, photosCount: 0 });
    assert.equal(l.etat, attendu);
    assert.equal(l.precision, null);
  }
});

cas("l'or désigne ce qui appelle un geste, et pas le reste", () => {
  const or = (s: Parameters<typeof ligneEtatChantier>[0]["statut"]) =>
    ligneEtatChantier({ statut: s, photosCount: 0 }).enOr;
  // Sa décision du 13 août : un devis parti sans réponse passe en or, alors
  // qu'il n'appelle aucun geste de lui. C'était écrit sur la planche, il a
  // retenu la variante dorée. Si la liste devient trop dorée à l'usage, c'est
  // `APPELLE_UN_GESTE` qui se défait, et ce contrôle avec.
  for (const s of ["devis_envoye", "en_attente_client", "a_relancer", "devis_retourne", "devis_a_corriger", "devis_caduc"] as const) {
    assert.equal(or(s), true, `${s} devrait être en or`);
  }
  for (const s of ["brouillon", "a_verifier", "verifie", "planifie", "termine", "facture"] as const) {
    assert.equal(or(s), false, `${s} ne devrait pas être en or`);
  }
});

cas("INVARIANT — la date affichée est celle qu'on lui a donnée", () => {
  // Aucun décalage de fuseau : « 2026-08-01 » ne doit jamais s'afficher
  // « 31 juillet », ce que produirait un `new Date(iso)` naïf.
  for (const [iso, attendu] of [
    ["2026-08-01", "Envoyé le samedi 1er août."],
    ["2026-01-31", "Envoyé le samedi 31 janvier."],
    ["2026-12-25", "Envoyé le vendredi 25 décembre."],
  ] as const) {
    const l = ligneEtatChantier({ statut: "en_attente_client", photosCount: 0, envoyeLe: iso, aujourdHui: AUJOURDHUI });
    assert.equal(l.precision, attendu);
  }
});

console.log(`\n${reussis} réussi(s), ${echecs.length} échoué(s).`);
if (echecs.length > 0) process.exit(1);
console.log("✅ La ligne sous le nom dit ce qui est parti, et quand.");
