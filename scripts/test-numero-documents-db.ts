import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { sql } from "drizzle-orm";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise, mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import { attribuerNumeroDevis } from "../src/server/repositories/devis";
import { attribuerNumeroFacture } from "../src/server/repositories/factures";

/**
 * LA SUITE DES NUMÉROS, EN BASE — ce qu'un contrôle fiscal regarde.
 *
 * *Sa décision du 26 août 2026 : le compteur repart à 1 au 1ᵉʳ janvier.*
 *
 * **Ce qu'aucune règle pure ne peut dire.** `numero-documents.ts` éprouve
 * l'écriture d'un numéro ; il ne peut rien dire de la SUITE — qu'elle ne saute
 * pas, qu'elle ne se répète pas, qu'elle repart au bon moment, et qu'elle tient
 * quand deux documents naissent à la même seconde. Tout cela se lit en base, et
 * nulle part ailleurs.
 */

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function monter(nom: string) {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `num-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { ctx: { utilisateurId, entrepriseId: entreprise.id }, id: entreprise.id };
}

type Contexte = { utilisateurId: string; entrepriseId: string };

/**
 * **On numérote DANS le contexte d'isolation, comme le produit.**
 *
 * Appelées sur le client nu, ces fonctions ne voient aucune ligne — la RLS les
 * masque, et l'UPDATE ne rend rien. Le contrôle accusait alors « Cannot read
 * properties of undefined » : une erreur qui envoie chercher au mauvais
 * endroit, exactement ce que `AGENTS.md` demande d'éviter.
 */
const numeroDevis = (c: Contexte) =>
  withEntreprise(c.utilisateurId, c.entrepriseId, (tx) => attribuerNumeroDevis(tx, c.entrepriseId));
const numeroFacture = (c: Contexte) =>
  withEntreprise(c.utilisateurId, c.entrepriseId, (tx) => attribuerNumeroFacture(tx, c.entrepriseId));

/**
 * Fait croire au compteur qu'il date d'une autre année.
 *
 * **DANS le contexte d'isolation, et le contrôle EXIGE sa ligne.** Écrit hors
 * de ce cadre, cet `UPDATE` ne touche AUCUNE ligne — ni sous le rôle
 * applicatif, ni sous le propriétaire : `FORCE ROW LEVEL SECURITY` s'applique
 * au propriétaire aussi. Il ne levait rien pour autant : le compteur n'était
 * jamais vieilli, la remise à 1 jamais éprouvée, et trois contrôles
 * rougissaient en accusant le produit.
 *
 * C'est le piège de `CLAUDE.md` §5 : une aide qui ne mesure rien est pire
 * qu'absente. D'où le `rowCount` vérifié — il fait parler l'aide, pas le code.
 */
async function vieillirCompteur(c: Contexte, annee: number) {
  const r = await withEntreprise(c.utilisateurId, c.entrepriseId, (tx) =>
    tx.execute(sql`
      UPDATE entreprise_compteurs
      SET annee_devis = ${annee}, annee_facture = ${annee}
      WHERE entreprise_id = ${c.entrepriseId}
    `)
  );
  assert.equal(
    (r as { rowCount: number }).rowCount,
    1,
    "le compteur n'a pas été vieilli : le contrôle ne prouverait rien"
  );
}

const anneeCourante = new Date().getFullYear();

async function main() {
  console.log("=== La suite des numéros ===\n");

  await essai("le format par défaut donne six chiffres, et le « F » aux factures", async () => {
    await nettoyerBase();
    const { ctx } = await monter("Six chiffres");
    assert.equal(await numeroDevis(ctx), `${anneeCourante}-000001`);
    assert.equal(await numeroFacture(ctx), `F${anneeCourante}-000001`);
  });

  await essai("LA SUITE NE SAUTE JAMAIS UN NUMÉRO — c'est ce que la loi exige", async () => {
    await nettoyerBase();
    const { ctx } = await monter("Suite continue");
    const numeros: string[] = [];
    for (let i = 0; i < 12; i++) numeros.push(await numeroFacture(ctx));
    const rangs = numeros.map((n) => Number(n.slice(-6)));
    assert.deepEqual(rangs, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], numeros.join(" "));
    assert.equal(new Set(numeros).size, 12, "un numéro est sorti deux fois");
  });

  await essai("LES DEUX SUITES NE SE MÊLENT PAS", async () => {
    // Mêler devis et factures rendrait illisible la numérotation continue
    // qu'attend un contrôle. Chacune avance de son côté.
    await nettoyerBase();
    const { ctx } = await monter("Deux suites");
    await numeroDevis(ctx);
    await numeroDevis(ctx);
    assert.equal(await numeroFacture(ctx), `F${anneeCourante}-000001`);
    assert.equal(await numeroDevis(ctx), `${anneeCourante}-000003`);
  });

  await essai("AU 1ᵉʳ JANVIER, LE COMPTEUR REPART À 1 — sa décision du 26 août", async () => {
    await nettoyerBase();
    const { ctx } = await monter("Passage d'année");
    await numeroFacture(ctx);
    await numeroFacture(ctx);
    // On fait croire au compteur qu'il date de l'an dernier : c'est la seule
    // façon d'éprouver ici un geste qui n'arrive qu'une fois par an.
    await vieillirCompteur(ctx, anneeCourante - 1);
    assert.equal(
      await numeroFacture(ctx),
      `F${anneeCourante}-000001`,
      "le compteur n'est pas reparti : ses factures de janvier suivraient celles de décembre"
    );
    assert.equal(await numeroFacture(ctx), `F${anneeCourante}-000002`);
  });

  await essai("les DEUX suites repartent, chacune de son côté", async () => {
    // Un devis peut partir en décembre et sa facture en janvier : les deux
    // années sont donc distinctes, et une seule qui repart ne suffit pas.
    await nettoyerBase();
    const { ctx } = await monter("Deux passages");
    await numeroDevis(ctx);
    await numeroFacture(ctx);
    await vieillirCompteur(ctx, anneeCourante - 1);
    assert.equal(await numeroDevis(ctx), `${anneeCourante}-000001`);
    assert.equal(await numeroFacture(ctx), `F${anneeCourante}-000001`);
  });

  await essai("SANS ANNÉE AU NUMÉRO, LE COMPTEUR NE REPART PAS", async () => {
    // **Le contrôle qui empêche un DOUBLON.** « Une suite sans année » remise à
    // 1 donnerait deux « 0001 » à un an d'écart, ce que la loi interdit.
    await nettoyerBase();
    const { ctx } = await monter("Suite sans année");
    await mettreAJourEntreprise(ctx, { formatNumero: "suite" });
    assert.equal(await numeroFacture(ctx), "F0001");
    assert.equal(await numeroFacture(ctx), "F0002");
    await vieillirCompteur(ctx, anneeCourante - 1);
    assert.equal(
      await numeroFacture(ctx),
      "F0003",
      "la suite est repartie à 1 : deux factures porteraient le même numéro"
    );
  });

  await essai("changer de format ne réécrit AUCUN numéro déjà attribué", async () => {
    // Un numéro parti chez un client est sur sa facture et dans sa
    // comptabilité. Le changement ne vaut que pour les suivants.
    await nettoyerBase();
    const { ctx } = await monter("Changement de format");
    const avant = await numeroFacture(ctx);
    assert.equal(avant, `F${anneeCourante}-000001`);
    await mettreAJourEntreprise(ctx, { formatNumero: "court" });
    const apres = await numeroFacture(ctx);
    assert.equal(apres, `F${String(anneeCourante % 100)}-0002`, "le rang doit CONTINUER, pas repartir");
  });

  await essai("DEUX FACTURES À LA MÊME SECONDE NE PARTAGENT PAS UN NUMÉRO", async () => {
    // Le 1ᵉʳ janvier, deux créations concurrentes voient toutes deux « l'année a
    // changé ». Lire d'abord pour écrire ensuite leur donnerait le numéro 1 à
    // toutes les deux. Le `CASE` tranche à l'intérieur du verrou de ligne.
    await nettoyerBase();
    const { ctx } = await monter("Concurrence au nouvel an");
    await numeroFacture(ctx);
    await vieillirCompteur(ctx, anneeCourante - 1);
    const ensemble = await Promise.all(
      Array.from({ length: 8 }, () => numeroFacture(ctx))
    );
    assert.equal(new Set(ensemble).size, 8, `des numéros en double : ${ensemble.join(" ")}`);
    const rangs = ensemble.map((n) => Number(n.slice(-6))).sort((a, b) => a - b);
    assert.deepEqual(rangs, [1, 2, 3, 4, 5, 6, 7, 8], ensemble.join(" "));
  });

  await essai("UNE ENTREPRISE NE TOUCHE PAS AU COMPTEUR D'UNE AUTRE", async () => {
    await nettoyerBase();
    const a = await monter("Chez Dupont");
    const b = await monter("Chez Martin");
    await numeroFacture(a.ctx);
    await numeroFacture(a.ctx);
    assert.equal(
      await numeroFacture(b.ctx),
      `F${anneeCourante}-000001`,
      "le compteur de B a suivi celui de A"
    );
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
