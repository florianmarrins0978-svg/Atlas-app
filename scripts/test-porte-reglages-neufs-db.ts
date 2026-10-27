import assert from "node:assert/strict";
import { creerSonCompte, type SaisieCompte } from "../src/server/repositories/creation-compte";
import { getEntreprise } from "../src/server/repositories/entreprises";
import { MAX_EQUIPES } from "../src/lib/equipes";

/**
 * LES RÉGLAGES NÉS APRÈS SEPTEMBRE ARRIVENT DANS LEURS CASES — 26 octobre 2026.
 *
 * La porte soignée (`src/lib/creation-compte.ts`) demande le rythme et le
 * reversement de la TVA, la décennale, le médiateur et les chantiers par jour.
 * Cette suite vérifie le bout qui compte : qu'ils arrivent dans la colonne que
 * Mon entreprise et Équipe relisent, sous le rôle de l'appli (RLS comprise).
 *
 * **Elle sait échouer** : jouée avant que `creerSonCompte` écrive ces
 * colonnes, la première vérification rougit (la décennale reste vide, le
 * rythme reste au mois, une seule équipe).
 */

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs += 1;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message.split("\n")[0]}`);
  }
}

const BASE: SaisieCompte = {
  civilite: "mr",
  prenom: "Lucas",
  nom: "Bernard",
  email: "",
  motDePasse: "Haie-de-buis-taillee",
  entreprise: "Jardins Démo",
  forme: "SARL",
  tva: "assujettie",
};

async function ouvrir(saisie: Partial<SaisieCompte>) {
  const r = await creerSonCompte({ ...BASE, ...saisie, email: `reglages-neufs-${Date.now()}-${Math.random()}@exemple.fr` });
  assert.ok(r.ok, `le compte n'a pas pu s'ouvrir : ${r.ok ? "" : r.refus}`);
  const e = await getEntreprise({ utilisateurId: r.utilisateurId, entrepriseId: r.entrepriseId });
  assert.ok(e, "l'entreprise ouverte ne se relit pas");
  return e;
}

async function main() {
  console.log("=== Les réglages demandés à la porte arrivent dans leurs cases ===\n");

  await cas("le rythme, le reversement, la décennale, le médiateur et les équipes s'écrivent", async () => {
    const e = await ouvrir({
      periodiciteTva: "trimestrielle",
      tvaExigibilite: "debits",
      assureur: "Assureur de démonstration",
      adresseAssureur: "1 rue de l’Exemple, 44000 Nantes",
      couverture: "France métropolitaine",
      mediateur: "Médiateur de démonstration",
      mediateurCoordonnees: "1 place de la Médiation, Nantes",
      nombreEquipes: 3,
    });
    assert.equal(e.periodiciteTva, "trimestrielle");
    assert.equal(e.tvaExigibilite, "debits");
    assert.equal(e.assureurDecennale, "Assureur de démonstration");
    assert.equal(e.adresseAssureurDecennale, "1 rue de l’Exemple, 44000 Nantes");
    assert.equal(e.couvertureDecennale, "France métropolitaine");
    assert.equal(e.mediateurNom, "Médiateur de démonstration");
    assert.equal(e.mediateurCoordonnees, "1 place de la Médiation, Nantes");
    assert.equal(e.nombreEquipes, 3);
  });

  await cas("rien de répondu : chaque colonne garde sa valeur d'office", async () => {
    const e = await ouvrir({});
    assert.equal(e.nombreEquipes, 1);
    assert.equal(e.assureurDecennale, null);
    assert.equal(e.mediateurNom, null);
  });

  await cas("une franchise ne reçoit pas de réglage de TVA", async () => {
    const avec = await ouvrir({ tva: "assujettie", periodiciteTva: "trimestrielle" });
    const sans = await ouvrir({ tva: "franchise", periodiciteTva: "trimestrielle", tvaExigibilite: "debits" });
    assert.equal(avec.periodiciteTva, "trimestrielle");
    assert.notEqual(sans.periodiciteTva, "trimestrielle", "une franchise a reçu un rythme de déclaration");
    assert.notEqual(sans.tvaExigibilite, "debits", "une franchise a reçu un régime de reversement");
  });

  await cas("les chantiers par jour gardent les bornes de Réglages", async () => {
    assert.equal((await ouvrir({ nombreEquipes: 99 })).nombreEquipes, MAX_EQUIPES);
    assert.equal((await ouvrir({ nombreEquipes: 0 })).nombreEquipes, 1);
  });

  await cas("une valeur qui ne vient pas de la liste ne s'écrit pas", async () => {
    // Ce que l'action reçoit vient du navigateur : rien n'y garantit le type.
    const venuDuReseau: Partial<SaisieCompte> = JSON.parse('{"periodiciteTva":"annuelle","tvaExigibilite":"demain"}');
    const e = await ouvrir(venuDuReseau);
    assert.notEqual(e.periodiciteTva, "annuelle");
    assert.notEqual(e.tvaExigibilite, "demain");
  });

  console.log(`\nLes réglages de la porte — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main();
