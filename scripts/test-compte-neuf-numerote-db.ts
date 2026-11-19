/**
 * UN COMPTE NÉ PAR L'INSCRIPTION FAIT SON PREMIER DEVIS — sa demande du
 * 19 novembre 2026 : *« et les nouveaux comptes ne peuvent pas faire de
 * devis ???? »*, puis « corrige ça maintenant ».
 *
 * Vu le 17 novembre, sur un compte créé par la vraie porte : le premier devis
 * tombait sur « Cannot read properties of undefined (reading 'numero') ». Les
 * deux chemins qui créent une entreprise ne posaient pas la même chose :
 * `creerEntreprise` (le jeu de démonstration, les suites) posait le compteur
 * des numéros, `creerSonCompte` (la porte) l'oubliait. Le devis et la facture
 * prennent leur numéro dans ce compteur.
 *
 *   A. le compteur existe dès la création du compte ;
 *   B. le premier devis prend un numéro, le premier de l'année ;
 *   C. le second devis prend le suivant.
 *
 * **Vu rouge sur le code d'avant** : A et B tombaient.
 *
 * **N'efface rien** : un compte de plus, à une adresse neuve, sans
 * `nettoyerBase`. Elle se joue pendant l'écriture sans vider la base de personne.
 *
 *   npx tsx scripts/test-compte-neuf-numerote-db.ts   (sur atlas_test)
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { entrepriseCompteurs } from "../src/server/db/schema";
import { creerSonCompte } from "../src/server/repositories/creation-compte";
import * as clientsRepo from "../src/server/repositories/clients";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  console.log("Un compte né par l'inscription numérote ses devis\n");

  const compte = await creerSonCompte({
    civilite: "mme",
    prenom: "Camille",
    nom: "Perret",
    email: `compte-neuf-${Date.now()}-${Math.random().toString(36).slice(2)}@atlas.test`,
    motDePasse: "chene-tilleul-08-compteur",
    entreprise: "Perret Paysage",
    forme: "EI",
    tva: "franchise",
  });
  assert.ok(compte.ok, `le compte n'a pas pu être créé : ${compte.ok ? "" : compte.refus}`);
  if (!compte.ok) return;
  const ctx = { utilisateurId: compte.utilisateurId, entrepriseId: compte.entrepriseId };

  await cas("A. le compteur des numéros existe dès la création du compte", async () => {
    const lignes = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select().from(entrepriseCompteurs).where(eq(entrepriseCompteurs.entrepriseId, ctx.entrepriseId))
    );
    assert.equal(lignes.length, 1, "aucun compteur : son premier devis et sa première facture tomberont");
  });

  const premierDevis = async (nom: string) => {
    const client = await clientsRepo.creerClient(ctx, { nom: `Lefèvre ${nom}`, civilite: "mme" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom, clientId: client.id });
    return devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  };

  let premier = "";
  await cas("B. le premier devis prend un numéro, le premier de l'année", async () => {
    const d = await premierDevis("Taille de haie");
    premier = d.numeroCommercial;
    assert.match(premier, /0*1$/, `le premier devis porte « ${premier} »`);
  });

  await cas("C. le second devis prend le suivant", async () => {
    const d = await premierDevis("Tonte");
    assert.notEqual(d.numeroCommercial, premier, "deux devis portent le même numéro");
    assert.match(d.numeroCommercial, /0*2$/, `le second devis porte « ${d.numeroCommercial} »`);
  });

  await pool.end();
  console.log(echecs ? `\n❌ ${echecs} échec(s)` : "\n✅ Un compte neuf numérote ses devis.");
  process.exit(echecs ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
