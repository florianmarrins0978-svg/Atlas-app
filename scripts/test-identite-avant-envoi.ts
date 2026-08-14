// Un devis ne part pas sans SIRET — et le SERVEUR le refuse, pas seulement
// l'écran.
//
// **Décision du patron, le 14 août 2026**, planche `atlas-trois-questions.html`,
// question 3, réponse « A » : on bloque l'ENVOI, jamais la rédaction. La raison
// est irréversible et c'est ce qui la rend décisive — un devis FIGE l'identité
// de l'émetteur au moment où il part. Le corriger le lendemain ne change pas
// celui que le client a sous les yeux, ni le PDF qu'il a téléchargé.
//
// **Deux moitiés, et la seconde compte plus que la première.** La règle pure
// (`src/lib/identite-entreprise.ts`) dit ce qui manque ; la préparation d'envoi
// la lit en base et rend le blocage. Éprouver seulement la règle laisserait
// passer une préparation qui oublierait de l'appeler — c'est-à-dire un devis
// qui part quand même.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise, mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { creerClient } from "../src/server/repositories/clients";
import { getOuCreerDevisBrouillon } from "../src/server/repositories/devis";
import { preparerEnvoi } from "../src/server/repositories/preparation-envoi";
import {
  manquesIdentite,
  identiteComplete,
  refusIdentiteIncomplete,
  empechePar,
} from "../src/lib/identite-entreprise";

let echecs = 0;
async function essai(nom: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Un devis ne part pas sans identité ===\n");

  // ── La règle, sans base ──────────────────────────────────────────────────
  await essai("une entreprise vide manque des quatre champs, dans l'ordre de l'écran", () => {
    const m = manquesIdentite({});
    assert.deepEqual(
      m.map((x) => x.champ),
      ["nom", "adresse", "siret", "iban"]
    );
  });

  await essai("une entreprise complète ne manque de rien", () => {
    assert.equal(
      identiteComplete({ nom: "A", adresse: "B", siret: "C", iban: "D" }),
      true
    );
  });

  // Un champ rempli d'espaces est un champ vide : sinon une barre d'espace
  // suffirait à faire partir un devis sans SIRET.
  await essai("un champ rempli d'espaces ne compte pas comme rempli", () => {
    const m = manquesIdentite({ nom: "A", adresse: "B", siret: "   ", iban: "D" });
    assert.deepEqual(m.map((x) => x.champ), ["siret"]);
  });

  // Ce qui n'empêche RIEN ne doit pas bloquer : un garde-fou qui agace finit
  // contourné, et le téléphone manque chez la moitié des artisans.
  await essai("le téléphone, l'e-mail et la forme juridique n'empêchent rien", () => {
    assert.equal(
      identiteComplete({ nom: "A", adresse: "B", siret: "C", iban: "D" }),
      true,
      "des champs facultatifs bloquent l'envoi"
    );
  });

  await essai("chaque manque dit ce qu'il empêche, jamais « obligatoire »", () => {
    for (const m of manquesIdentite({})) {
      assert.ok(m.empeche.length > 20, `« ${m.champ} » n'explique rien`);
      assert.ok(!/obligatoire/i.test(m.empeche), `« ${m.champ} » se contente de « obligatoire »`);
    }
  });

  // L'écran de l'identité et l'écran d'envoi affichent LA MÊME phrase pour un
  // même champ. Recopiées, elles auraient fini par se contredire.
  await essai("la phrase d'un champ est la même partout", () => {
    assert.equal(empechePar("siret"), manquesIdentite({}).find((m) => m.champ === "siret")!.empeche);
  });

  await essai("le refus du serveur nomme les champs et promet le devis", () => {
    const phrase = refusIdentiteIncomplete(manquesIdentite({ nom: "A", adresse: "B" }));
    assert.match(phrase, /SIRET/);
    assert.match(phrase, /IBAN/);
    assert.match(phrase, /attend/i, "le refus ne rassure pas sur le devis déjà écrit");
    assert.ok(!/nom de l'entreprise/i.test(phrase), "il nomme un champ qui ne manque pas");
  });

  // ── La règle, branchée sur la base ───────────────────────────────────────
  async function monterChantier(identite: Parameters<typeof mettreAJourEntreprise>[1]) {
    // **L'entreprise naît VIDE, puis l'identité s'écrit.** C'est le parcours
    // réel d'un artisan : `creerEntreprise` ne prend qu'un nom, et tout le reste
    // se saisit ensuite dans les réglages — c'est exactement le trou que ce
    // blocage vient boucher (`ARCHITECTURE.md` §87).
    const { entreprise, utilisateurId } = await creerEntreprise(
      { nom: "Essai identité" },
      { email: `patron-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
    );
    const ctx = { utilisateurId, entrepriseId: entreprise.id };
    await mettreAJourEntreprise(ctx, identite);
    const client = await creerClient(ctx, {
      nom: "M. Bernard",
      canalCommunication: "email",
      email: "bernard@essai.local",
    });
    const chantier = await creerChantier(ctx, { nom: "Abattage", clientId: client.id });
    await getOuCreerDevisBrouillon(ctx, chantier.id);
    return { ctx, chantierId: chantier.id };
  }

  const COMPLETE = {
    nom: "Atelier Essai",
    adresse: "10 rue des Artisans, Nantes",
    siret: "12345678900012",
    iban: "FR7630001007941234567890185",
  };

  await essai("sans SIRET, la préparation d'envoi BLOQUE", async () => {
    await nettoyerBase();
    const { ctx, chantierId } = await monterChantier({ ...COMPLETE, siret: "" });
    const p = await preparerEnvoi(ctx, chantierId);
    assert.equal(p.blocage, "identite_incomplete");
    assert.deepEqual(p.manquesIdentite.map((m) => m.champ), ["siret"]);
  });

  await essai("sans IBAN non plus, et le manque est nommé", async () => {
    await nettoyerBase();
    const { ctx, chantierId } = await monterChantier({ ...COMPLETE, iban: "" });
    const p = await preparerEnvoi(ctx, chantierId);
    assert.equal(p.blocage, "identite_incomplete");
    assert.deepEqual(p.manquesIdentite.map((m) => m.champ), ["iban"]);
  });

  // **L'IDENTITÉ PASSE AVANT LE CANAL**, et ce n'est pas cosmétique : elle se
  // règle une fois pour toute l'entreprise quand le canal se repose à chaque
  // client. Signalée après, elle ne serait corrigée qu'au dixième envoi.
  await essai("l'identité se signale avant le canal du client", async () => {
    await nettoyerBase();
    const { entreprise, utilisateurId } = await creerEntreprise(
      { nom: "Essai ordre" },
      { email: `ordre-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
    );
    const ctx = { utilisateurId, entrepriseId: entreprise.id };
    await mettreAJourEntreprise(ctx, { ...COMPLETE, siret: "" });
    // Un client SANS canal : les deux blocages sont réunis en même temps.
    const client = await creerClient(ctx, { nom: "Sans canal" });
    const chantier = await creerChantier(ctx, { nom: "Abattage", clientId: client.id });
    await getOuCreerDevisBrouillon(ctx, chantier.id);
    const p = await preparerEnvoi(ctx, chantier.id);
    assert.equal(p.blocage, "identite_incomplete", "le canal est signalé avant l'identité");
  });

  await essai("identité complète : plus aucun blocage d'identité", async () => {
    await nettoyerBase();
    const { ctx, chantierId } = await monterChantier(COMPLETE);
    const p = await preparerEnvoi(ctx, chantierId);
    assert.notEqual(p.blocage, "identite_incomplete", "un devis complet reste bloqué");
    assert.deepEqual(p.manquesIdentite, []);
  });

  // **Le manque se lit MÊME quand le blocage est autre.** Sans cela, le patron
  // corrigerait son canal, reviendrait, et découvrirait le SIRET seulement là.
  await essai("ce qui manque se lit même quand rien ne bloque", async () => {
    await nettoyerBase();
    const { ctx, chantierId } = await monterChantier(COMPLETE);
    const p = await preparerEnvoi(ctx, chantierId);
    assert.ok(Array.isArray(p.manquesIdentite));
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Identité avant envoi — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
