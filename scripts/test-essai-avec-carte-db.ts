import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { abonnements } from "../src/server/db/schema";
import { creerSonCompte } from "../src/server/repositories/creation-compte";
import {
  abonnementDeLEntreprise,
  carteAPoser,
  enregistrerLAbonnement,
  retenirLaSessionDeCarte,
  type EtatVenuDuPrestataire,
} from "../src/server/repositories/abonnements";
import { CHOIX_PAR_DEFAUT } from "../src/lib/essai-avec-carte";
import { FORMULE_DE_LESSAI } from "../src/lib/abonnements";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// L'ESSAI AVEC LA CARTE, EN BASE (le modèle A, migration 0199)
// ═══════════════════════════════════════════════════════════════════════════
//
// Sa réponse du 24 novembre 2026 : *« Oui appli fermée ! »*. Ce que la suite
// défend, par les portes qu'emprunte l'appli, sous `atlas_app` et la RLS :
//   · un compte créé avec la carte à poser est fermé, et propose la formule
//     la moins chère ; un compte créé sans est ouvert, comme avant ;
//   · la session de paiement se retient, **même en lecture seule** (le SIREN
//     déjà essayé l'y met dès sa création, et c'est la carte qui l'en sort) ;
//   · l'abonnement enregistré ouvre l'appli et oublie la session ;
//   · une session ne se retient plus sur un abonnement déjà posé.

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const SIRET = "123 456 782 00010";

async function compte(suffixe: string, carteRequise: boolean, siret?: string) {
  const r = await creerSonCompte(
    {
      civilite: "mr",
      prenom: "Lucien",
      nom: "Vidal",
      email: `carte-${suffixe}-${Date.now()}@essai.local`,
      motDePasse: "trois-mots-tres-courts",
      entreprise: `Jardins Vidal ${suffixe}`,
      forme: "EI",
      tva: "franchise",
      ...(siret ? { siret } : {}),
    },
    { siretConfirme: false },
    { carteRequise }
  );
  assert.ok(r.ok, `le compte n'a pas pu être créé : ${r.ok ? "" : r.refus}`);
  return { utilisateurId: r.utilisateurId, entrepriseId: r.entrepriseId };
}

/** Lu sous le contexte de l'entreprise : `abonnements` est sous FORCE RLS. */
async function ligne(c: { utilisateurId: string; entrepriseId: string }) {
  const [a] = await withEntreprise(c.utilisateurId, c.entrepriseId, (tx) =>
    tx
      .select({ sessionDeCarte: abonnements.sessionDeCarte, carteRequise: abonnements.carteRequise })
      .from(abonnements)
      .where(eq(abonnements.entrepriseId, c.entrepriseId))
  );
  assert.ok(a, "aucun abonnement : rien n'a été éprouvé");
  return a;
}

const posee = (id: string): EtatVenuDuPrestataire => ({
  formule: "artisan",
  modules: [],
  periodicite: "mensuelle",
  statut: "actif",
  periodeFin: new Date(Date.now() + 15 * 24 * 3600 * 1000),
  annulationDemandee: false,
  clientPrestataire: `cus_${id}`,
  abonnementPrestataire: `sub_${id}`,
  changementPrevu: false,
  essaiJusquAu: new Date(Date.now() + 15 * 24 * 3600 * 1000),
});

async function main() {
  await nettoyerBase();

  await test("avec la carte à poser : fermé, et la formule la moins chère proposée", async () => {
    const c = await compte("a", true);
    assert.equal(await carteAPoser(c), true);
    const a = await abonnementDeLEntreprise(c);
    assert.equal(a?.carteRequise, true);
    assert.equal(a?.formule, CHOIX_PAR_DEFAUT.formule);
    assert.equal(a?.periodicite, CHOIX_PAR_DEFAUT.periodicite);
    assert.deepEqual(a?.modules, []);
  });

  await test("sans paiement branché : ouvert, l'essai d'avant, sur sa formule d'avant", async () => {
    const c = await compte("b", false);
    assert.equal(await carteAPoser(c), false);
    assert.equal((await abonnementDeLEntreprise(c))?.formule, FORMULE_DE_LESSAI);
  });

  await test("la session se retient, puis l'abonnement enregistré ouvre l'appli et l'oublie", async () => {
    const c = await compte("c", true);
    await retenirLaSessionDeCarte(c, "cs_test_c");
    assert.equal((await ligne(c)).sessionDeCarte, "cs_test_c");
    await enregistrerLAbonnement(c, posee("c"));
    assert.equal(await carteAPoser(c), false);
    const apres = await ligne(c);
    assert.equal(apres.sessionDeCarte, null);
    assert.equal(apres.carteRequise, true, "la ligne garde qu'elle est née avec la carte");
    assert.ok((await abonnementDeLEntreprise(c))?.essaiJusquAu, "la fin de l'essai du prestataire n'est pas écrite");
  });

  await test("LE SIREN DÉJÀ ESSAYÉ : lecture seule dès la création, et la session se retient quand même", async () => {
    await compte("d1", true, SIRET);
    const second = await compte("d2", true, SIRET);
    assert.equal((await abonnementDeLEntreprise(second))?.essaiDejaPris, true);
    await retenirLaSessionDeCarte(second, "cs_test_d2");
    assert.equal((await ligne(second)).sessionDeCarte, "cs_test_d2");
  });

  await test("une session ne se retient plus sur un abonnement déjà posé", async () => {
    const c = await compte("e", true);
    await enregistrerLAbonnement(c, posee("e"));
    await retenirLaSessionDeCarte(c, "cs_test_e");
    assert.equal((await ligne(c)).sessionDeCarte, null);
  });

  console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
