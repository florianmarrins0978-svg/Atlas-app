import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { creerClient } from "../src/server/repositories/clients";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import { terminerChantier, emettreFacture, getFacturePourChantier } from "../src/server/repositories/factures";
import { noterPaiement, facturesAvecPaiements } from "../src/server/repositories/paiements-facture";
import { declarerNonPayee } from "../src/server/repositories/factures-non-payees";
import { getOutil } from "../src/server/ai/tools/registre";

/**
 * L'ASSISTANT LIT LES FACTURES — et seulement celles de l'entreprise.
 *
 * **Sa demande du 26 septembre 2026 :** *« nourris-le de tout ce qu'il est
 * possible de le nourrir »*. Il ne voyait aucune facture.
 *
 * Ce que cette suite défend :
 * - le reste dû et le total sont ceux de l'écran « En attente », au centime ;
 * - les filtres (client, état, non payées) tiennent ;
 * - **une autre entreprise ne voit rien** : l'outil passe par le dépôt, donc
 *   par `withEntreprise`, et la suite tourne sous `atlas_app`, soumis à la RLS.
 */

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

type Ctx = { utilisateurId: string; entrepriseId: string };

async function monterEntreprise(nom: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `lf-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un chantier chiffré, facturé et émis, par le vrai parcours. */
async function chantierFacture(ctx: Ctx, clientId: string, nom: string, montant: string) {
  const c = await creerChantier(ctx, { nom, clientId });
  await ajouterLignePrix(ctx, c.id, "Taille de haie", montant);
  const devis = await getOuCreerDevisBrouillon(ctx, c.id);
  await envoyerDevis(ctx, devis.id);
  await terminerChantier(ctx, c.id);
  const f = await getFacturePourChantier(ctx, c.id);
  await emettreFacture(ctx, f!.facture.id);
  return f!.facture.id;
}

type Lu = {
  trouve: boolean;
  nombre?: number;
  totalResteDu?: string;
  factures?: { client: string | null; resteDu: string; etat: string; declareeNonPayee: boolean; paiements: unknown[] }[];
};

async function main() {
  await nettoyerBase();
  const outil = getOutil("LireFactures");
  assert.ok(outil, "LireFactures n'est pas au registre : l'assistant ne peut pas l'appeler");

  const A = await monterEntreprise("Paysages A");
  const B = await monterEntreprise("Paysages B");
  const groupiron = await creerClient(A, { nom: "Mme Huguette Groupiron" });
  const lucie = await creerClient(A, { nom: "Mme Lucie" });
  const voisin = await creerClient(B, { nom: "M. Groupiron de B" });

  const f1 = await chantierFacture(A, groupiron.id, "Haie Groupiron", "500.00");
  const f2 = await chantierFacture(A, groupiron.id, "Tonte Groupiron", "300.00");
  const f3 = await chantierFacture(A, lucie.id, "Élagage Lucie", "200.00");
  await chantierFacture(B, voisin.id, "Chantier de B", "999.00");

  const [ecran] = await Promise.all([facturesAvecPaiements(A)]);
  const ttc = (id: string) => ecran.find((f) => f.id === id)!.totalTtc;
  // Un paiement ne se date pas avant l'émission de sa facture.
  const emise = (id: string) => ecran.find((f) => f.id === id)!.dateEmission;
  // Un acompte sur la première, la troisième soldée, la deuxième déclarée non payée.
  assert.equal((await noterPaiement(A, f1, { date: emise(f1), montant: "100.00" })).ok, true);
  assert.equal((await noterPaiement(A, f3, { date: emise(f3), montant: ttc(f3) })).ok, true);
  await declarerNonPayee(A, f2);

  const lire = async (ctx: Ctx, p: Record<string, unknown>) =>
    (await outil!.executer({ ctx, chantierId: null }, outil!.schema.parse(p))) as Lu;

  await cas("« Huguette Groupiron » : ses deux factures, et ce qu'elle doit au centime", async () => {
    const r = await lire(A, { client: "Groupiron" });
    assert.equal(r.nombre, 2);
    const attendu = (await facturesAvecPaiements(A))
      .filter((f) => f.id === f1 || f.id === f2)
      .reduce((s, f) => s + Math.round(Number(f.reste) * 100), 0);
    assert.equal(Math.round(Number(r.totalResteDu) * 100), attendu, "le total ne tombe pas sur celui de l'écran");
    assert.ok(r.factures!.every((f) => f.client === "Mme Huguette Groupiron"));
  });

  await cas("les paiements reçus sont lus avec la facture", async () => {
    const r = await lire(A, { client: "Groupiron" });
    const avecAcompte = r.factures!.find((f) => f.paiements.length > 0);
    assert.ok(avecAcompte, "l'acompte de 100 € n'apparaît pas");
    assert.equal(avecAcompte.etat, "partielle");
  });

  await cas("« à encaisser » laisse de côté la facture soldée", async () => {
    const r = await lire(A, { etat: "a_encaisser" });
    assert.equal(r.nombre, 2);
    assert.ok(r.factures!.every((f) => f.etat !== "soldee"));
  });

  await cas("« non payées » ne rend que celle qu'il a déclarée", async () => {
    const r = await lire(A, { etat: "non_payees" });
    assert.equal(r.nombre, 1);
    assert.equal(r.factures![0].declareeNonPayee, true);
  });

  await cas("un client inconnu rend un NON, pas une liste vide muette", async () => {
    const r = await lire(A, { client: "Personne" });
    assert.equal(r.trouve, false);
  });

  await cas("ISOLATION : l'entreprise B ne voit aucune facture de A, et A rien de B", async () => {
    const deB = await lire(B, {});
    assert.equal(deB.nombre, 1, `B voit ${deB.nombre} facture(s)`);
    assert.ok(!deB.factures!.some((f) => /Huguette|Lucie/.test(f.client ?? "")), "B lit les clients de A");
    const deA = await lire(A, { client: "de B" });
    assert.equal(deA.trouve, false, "A lit une facture de B");
  });

  await pool.end();
  if (echecs > 0) {
    console.error(`\n❌ ${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\n✅ L'assistant lit les factures de son entreprise, et d'elle seule.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
