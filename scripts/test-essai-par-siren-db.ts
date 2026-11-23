import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { abonnements, entreprises } from "../src/server/db/schema";
import { creerSonCompte } from "../src/server/repositories/creation-compte";
import { SiretMalFormeError, mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import { etatDeLEssai, texteDuRuban, phraseLectureSeule } from "../src/lib/abonnements";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// UN ESSAI PAR ENTREPRISE, RECONNUE À SON SIREN (migration 0195)
// ═══════════════════════════════════════════════════════════════════════════
//
// Sa décision du 23 novembre 2026 : *« on part sur le SIREN comme tu as dit »*,
// et *« il ne faut pas le bloquer ; il ne faut pas non plus qu'il puisse créer
// des comptes gratuits à tire-larigot »*. Ce que la suite défend, par la porte
// qu'il emprunte (`creerSonCompte`, `mettreAJourEntreprise`) :
//   · le premier compte d'un SIREN a son essai ;
//   · un second compte du MÊME SIREN, autre établissement compris, se crée,
//     mais son essai est fini, et le ruban dit pourquoi ;
//   · un compte créé sans SIRET a son essai, qui s'arrête quand il tape le
//     SIRET d'une entreprise déjà essayée ;
//   · retaper son propre SIRET ne lui retire rien ;
//   · un SIRET qui ne peut pas exister ne s'écrit pas, mais un SIRET faux
//     déjà en base n'empêche pas d'enregistrer le reste de la fiche ;
//   · `atlas_app` ne lit jamais la table des SIREN : il ne fait que demander.

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

const MOT_DE_PASSE = "trois-mots-tres-courts";
const SIRET_A = "123 456 782 00010";
const SIRET_A_AUTRE_ETABLISSEMENT = "123 456 782 00127";
const SIRET_B = "987 654 324 00019";

async function compte(suffixe: string, siret?: string) {
  const r = await creerSonCompte({
    civilite: "mr",
    prenom: "Lucien",
    nom: "Vidal",
    email: `siren-${suffixe}-${Date.now()}@essai.local`,
    motDePasse: MOT_DE_PASSE,
    entreprise: `Jardins Vidal ${suffixe}`,
    forme: "EI",
    tva: "franchise",
    ...(siret ? { siret } : {}),
  });
  assert.ok(r.ok, `le compte d'essai n'a pas pu être créé : ${r.ok ? "" : r.refus}`);
  return r;
}

// Lu sous le contexte de l'entreprise, comme l'appli le lit : `abonnements` est
// sous FORCE ROW LEVEL SECURITY, et sans contexte la lecture ne rendrait rien.
async function abonnementDe(c: { utilisateurId: string; entrepriseId: string }) {
  const [a] = await withEntreprise(c.utilisateurId, c.entrepriseId, (tx) =>
    tx
      .select({ statut: abonnements.statut, periodeFin: abonnements.periodeFin, essaiDejaPris: abonnements.essaiDejaPris })
      .from(abonnements)
      .where(eq(abonnements.entrepriseId, c.entrepriseId))
  );
  assert.ok(a, "aucun abonnement : rien n'a été éprouvé");
  return a;
}

async function main() {
  await nettoyerBase();
  const maintenant = () => new Date(Date.now() + 1000);

  await test("le premier compte d'un SIREN a ses 15 jours", async () => {
    const a = await compte("a", SIRET_A);
    const ab = await abonnementDe(a);
    const etat = etatDeLEssai(ab, maintenant());
    assert.equal(etat?.statut, "en-cours");
    assert.equal(ab.essaiDejaPris, false);
  });

  await test("un second compte du même SIREN, autre établissement, se crée sans essai, et le ruban dit pourquoi", async () => {
    const b = await compte("b", SIRET_A_AUTRE_ETABLISSEMENT);
    const ab = await abonnementDe(b);
    const etat = etatDeLEssai(ab, maintenant());
    assert.equal(etat?.statut, "termine", "l'essai d'un SIREN déjà essayé reste ouvert");
    assert.equal(ab.essaiDejaPris, true);
    assert.ok(etat);
    assert.equal(texteDuRuban(etat), "Essai déjà utilisé par votre entreprise");
    assert.equal(phraseLectureSeule(etat), "Votre entreprise a déjà eu son essai. Choisissez une formule pour créer.");
  });

  await test("sans SIRET, l'essai démarre ; taper ensuite le SIRET d'une entreprise déjà essayée l'arrête", async () => {
    const c = await compte("c");
    const avant = await abonnementDe(c);
    assert.equal(etatDeLEssai(avant, maintenant())?.statut, "en-cours");
    await mettreAJourEntreprise({ utilisateurId: c.utilisateurId, entrepriseId: c.entrepriseId }, { siret: SIRET_A });
    const apres = await abonnementDe(c);
    assert.equal(etatDeLEssai(apres, maintenant())?.statut, "termine", "le chemin de « Passer » reste ouvert");
    assert.equal(apres.essaiDejaPris, true);
  });

  await test("retaper son propre SIRET, autrement espacé, ne retire rien", async () => {
    const d = await compte("d", SIRET_B);
    await mettreAJourEntreprise({ utilisateurId: d.utilisateurId, entrepriseId: d.entrepriseId }, { siret: SIRET_B.replace(/\s/g, "") });
    const ab = await abonnementDe(d);
    assert.equal(etatDeLEssai(ab, maintenant())?.statut, "en-cours");
    assert.equal(ab.essaiDejaPris, false);
  });

  await test("un SIRET qui ne peut pas exister ne s'écrit pas, à la porte comme dans Réglages", async () => {
    const r = await creerSonCompte({
      civilite: "mr",
      prenom: "Lucien",
      nom: "Vidal",
      email: `siren-faux-${Date.now()}@essai.local`,
      motDePasse: MOT_DE_PASSE,
      entreprise: "Jardins faux",
      forme: "EI",
      tva: "franchise",
      siret: "123 456 789 00012",
    });
    assert.equal(r.ok, false);
    const e = await compte("e");
    await assert.rejects(
      mettreAJourEntreprise({ utilisateurId: e.utilisateurId, entrepriseId: e.entrepriseId }, { siret: "12345678901234" }),
      SiretMalFormeError
    );
  });

  await test("un SIRET faux déjà en base n'empêche pas d'enregistrer le reste de la fiche", async () => {
    // Un compte d'avant le 23 novembre 2026, au chiffre de travers : l'écran
    // renvoie toute la fiche, SIRET inchangé compris, avec le téléphone changé.
    const f = await compte("f");
    const ctx = { utilisateurId: f.utilisateurId, entrepriseId: f.entrepriseId };
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.update(entreprises).set({ siret: "123 456 789 00012" }).where(eq(entreprises.id, ctx.entrepriseId))
    );
    const e = await mettreAJourEntreprise(ctx, { siret: "12345678900012", telephone: "02 40 99 99 99" });
    assert.equal(e?.telephone, "02 40 99 99 99");
  });

  await test("le rôle de l'appli ne lit jamais la table des SIREN : il ne fait que demander", async () => {
    await assert.rejects(pool.query("SELECT siren FROM essais_par_siren"), /permission denied/);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
