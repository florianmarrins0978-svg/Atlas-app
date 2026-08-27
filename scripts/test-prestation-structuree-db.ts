import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import * as brouillonsRepo from "../src/server/repositories/brouillons-informations";
import { confirmerBrouillon } from "../src/server/ai/services/brouillon-service";
import {
  listerLignesPrix,
  ajouterLignePrix,
  supprimerLignePrix,
  lierPrestationsALaLigne,
  prestationsDuLibelle,
} from "../src/server/repositories/lignes-prix";
import { appliquerPropositionPrix } from "../src/server/chiffrage/appliquer-proposition";
import { brouillonVide } from "../src/server/ai/schemas/extraction";
import { nettoyerBase } from "./_test-db";

// **La prestation cesse d'être une seule chaîne de texte — lot B.**
//
// Ce que cette suite tient, et que la suite pure ne peut pas tenir : que le
// chemin RÉEL — dictée, confirmation, chiffrage, écriture au détail — pose bien
// ces colonnes, que les anciennes données n'ont pas bougé d'un caractère, et
// que les suppressions ne laissent aucun identifiant orphelin.
//
// **Ce qu'elle NE prouve pas, et c'est voulu :** que la quantité arrive sur la
// ligne du devis. Elle n'y arrive pas encore — c'est le lot suivant, et le
// contrôle qui l'exige reste rouge dans `test-dictee-devis-identite-db.ts`.

let reussites = 0;
let echecs = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    reussites++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

/**
 * Une requête de vérification jouée DANS le contexte de l'entreprise.
 *
 * **Le piège, et il a mordu en écrivant cette suite.** Un `pool.query` nu n'a
 * pas de `app.entreprise_id` : la RLS ne renvoie alors aucune ligne, et un
 * `count(*)` rend zéro. Le contrôle échouait en accusant le produit alors que
 * c'est lui qui regardait sans dire qui il était — exactement le genre de
 * message qui envoie chercher au mauvais endroit (`AGENTS.md`).
 */
async function compter(entrepriseId: string, sql: string, params: unknown[] = []): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [entrepriseId]);
    const { rows } = await client.query(sql, params);
    return Number(rows[0].n);
  } finally {
    client.release();
  }
}

/** Sa dictée du 26 août, telle que le modèle la rend réellement. */
function dictee() {
  return {
    ...brouillonVide(),
    prestations: [
      { libelle: "Tonte de la pelouse", description: null, quantite: "1200", unite: "m²", aConfirmer: false },
      { libelle: "Haie (tout genre)", description: null, quantite: "800", unite: "ml", aConfirmer: true },
      { libelle: "Abattage d'un érable", description: null, quantite: null, unite: null, aConfirmer: false },
    ],
    dureePrevue: "1 jour",
    tailleEquipe: "2 hommes",
  };
}

async function main() {
  await nettoyerBase();

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Arborea" },
    { email: "structuree@test.local", nom: "Le patron" }
  );
  const A = { entrepriseId: entreprise.id, utilisateurId };
  await tarifsRepo.creerTarif(A, { intitule: "Main d'œuvre (jour/homme)", prix: "420", unite: "jour/homme" });

  console.log("\n=== Le chemin complet : du JSON du modèle aux colonnes ===\n");

  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier de Madame Lucie" });
  await brouillonsRepo.enregistrerGeneration(A, chantier.id, dictee(), "dictée du 26 août");
  await confirmerBrouillon(A, chantier.id);

  await test("la quantité et l'unité dictées vivent dans leurs colonnes", async () => {
    const liste = await prestationsRepo.listerPrestations(A, chantier.id);
    const haie = liste.find((p) => /haie/i.test(p.libelle));
    assert.ok(haie, "la haie n'a pas été créée");
    assert.equal(Number(haie.quantite), 800, `quantite = ${haie.quantite}`);
    assert.equal(haie.unite, "ml");
    assert.equal(haie.aConfirmer, true, "le doute signalé par le modèle s'est perdu");
  });

  await test("le libellé continue de la porter — les moteurs le relisent encore", async () => {
    // **Ce n'est pas un oubli, c'est l'ordre sûr.** Quatre lecteurs retrouvent
    // les mesures dans le libellé (`mesures-arbre.ts`). Le leur retirer avant
    // qu'ils sachent lire les colonnes ferait perdre à cette haie son prix au
    // mètre linéaire — sur un devis qui part chez un client.
    const liste = await prestationsRepo.listerPrestations(A, chantier.id);
    const haie = liste.find((p) => /haie/i.test(p.libelle));
    assert.equal(haie?.libelle, "Haie (tout genre) (800 ml)");
  });

  await test("une prestation sans mesure garde ses colonnes vides", async () => {
    const liste = await prestationsRepo.listerPrestations(A, chantier.id);
    const erable = liste.find((p) => /érable/i.test(p.libelle));
    assert.ok(erable);
    assert.equal(erable.quantite, null, "une quantité a été inventée");
    assert.equal(erable.unite, null);
    assert.equal(erable.aConfirmer, false, "le modèle a répondu false, pas null");
  });

  console.log("\n=== Les anciennes données : rien n'a été deviné ===\n");

  await test("une prestation créée à la main garde tout à NULL", async () => {
    // R13 : l'écran Informations n'envoie aucune structure. Cette prestation
    // doit s'enregistrer exactement comme avant le lot.
    const c = await chantiersRepo.creerChantier(A, { nom: "Saisie à la main" });
    const p = await prestationsRepo.ajouterPrestation(A, c.id, "Réfection d'un massif");
    assert.equal(p.quantite, null);
    assert.equal(p.unite, null);
    assert.equal(p.nature, null);
    assert.equal(p.espece, null);
    assert.equal(p.methode, null);
    assert.equal(p.caracteristiques, null);
    assert.equal(p.aConfirmer, null, "un booléen par défaut a été posé : NULL veut dire « on ne sait pas »");
  });

  await test("aucune ligne existante n'a été réécrite par la migration", async () => {
    // La preuve directe : une prestation posée AVANT (ici, avec les colonnes
    // absentes du chemin de saisie) n'a aucune valeur structurée. Si une
    // migration avait deviné quoi que ce soit, ce compte serait non nul.
    const devinees = await compter(
      A.entrepriseId,
      `SELECT count(*)::int AS n FROM prestations
        WHERE libelle = 'Réfection d''un massif'
          AND (quantite IS NOT NULL OR unite IS NOT NULL OR nature IS NOT NULL
               OR espece IS NOT NULL OR methode IS NOT NULL
               OR caracteristiques IS NOT NULL OR a_confirmer IS NOT NULL)`
    );
    assert.equal(devinees, 0, "une valeur a été posée sur une prestation qui n'en fournissait aucune");
  });

  await test("la base refuse une quantité sans unité", async () => {
    // Le garde-fou vit aussi en base : « 800 » tout seul ne veut rien dire.
    const c = await chantiersRepo.creerChantier(A, { nom: "Quantité orpheline" });
    let refus: unknown = null;
    try {
      await prestationsRepo.ajouterPrestation(A, c.id, "Sans unité", { quantite: "800" });
    } catch (e) {
      refus = e;
    }
    assert.ok(refus, "la base a accepté une quantité sans unité");
    // Le nom de la contrainte vit dans la cause : l'enveloppe de l'ORM ne le
    // reprend pas, et se contenter de « ça a échoué » laisserait passer un
    // échec pour une tout autre raison.
    const cause = String((refus as { cause?: unknown }).cause ?? refus);
    assert.match(cause, /quantite_avec_unite/i, `refusé, mais pas par la bonne contrainte : ${cause}`);
  });

  console.log("\n=== Quelles prestations une ligne de devis vend ===\n");

  await test("la ligne principale connaît les prestations qu'elle porte", async () => {
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, {
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });
    await appliquerPropositionPrix(A, chantier.id);
    const lignes = await listerLignesPrix(A, chantier.id);
    assert.ok(lignes.length > 0, "aucune ligne écrite");

    const liaisons = await compter(
      A.entrepriseId,
      `SELECT count(*)::int AS n FROM lignes_prix_prestations WHERE entreprise_id = $1`,
      [A.entrepriseId]
    );
    assert.ok(liaisons >= 2, `seulement ${liaisons} liaison(s) écrite(s)`);
  });

  await test("une prestation n'appartient qu'à UNE ligne", async () => {
    const c = await chantiersRepo.creerChantier(A, { nom: "Double rattachement" });
    const p = await prestationsRepo.ajouterPrestation(A, c.id, "Abattage d'un tilleul");
    const ligneA = await ajouterLignePrix(A, c.id, "Ligne A", "100");
    const ligneB = await ajouterLignePrix(A, c.id, "Ligne B", "200");
    assert.equal(await lierPrestationsALaLigne(A, ligneA.id, [p.id]), 1);
    // La seconde tentative ne casse rien : elle ne fait rien. Un lien n'a
    // jamais le droit de bloquer un devis.
    assert.equal(await lierPrestationsALaLigne(A, ligneB.id, [p.id]), 0);
  });

  await test("supprimer une prestation ne laisse aucun identifiant orphelin", async () => {
    // R16 : le lien disparaît, la ligne de devis survit avec son montant.
    const c = await chantiersRepo.creerChantier(A, { nom: "Suppression prestation" });
    const p = await prestationsRepo.ajouterPrestation(A, c.id, "Dessouchage");
    const ligne = await ajouterLignePrix(A, c.id, "Dessouchage", "300");
    await lierPrestationsALaLigne(A, ligne.id, [p.id]);
    await prestationsRepo.supprimerPrestation(A, p.id);

    const orphelins = await compter(
      A.entrepriseId,
      `SELECT count(*)::int AS n FROM lignes_prix_prestations WHERE prestation_id = $1`,
      [p.id]
    );
    assert.equal(orphelins, 0, "un lien orphelin est resté");
    assert.equal((await listerLignesPrix(A, c.id)).length, 1, "la ligne de devis a disparu avec la prestation");
  });

  await test("supprimer une ligne ne supprime pas la prestation", async () => {
    const c = await chantiersRepo.creerChantier(A, { nom: "Suppression ligne" });
    const p = await prestationsRepo.ajouterPrestation(A, c.id, "Élagage du tilleul");
    const ligne = await ajouterLignePrix(A, c.id, "Élagage du tilleul", "400");
    await lierPrestationsALaLigne(A, ligne.id, [p.id]);
    await supprimerLignePrix(A, ligne.id);

    assert.equal((await prestationsRepo.listerPrestations(A, c.id)).length, 1, "la prestation a été emportée");
    const restants = await compter(
      A.entrepriseId,
      `SELECT count(*)::int AS n FROM lignes_prix_prestations WHERE ligne_prix_id = $1`,
      [ligne.id]
    );
    assert.equal(restants, 0);
  });

  await test("le rapprochement se fait sur le chantier, jamais au-delà", async () => {
    // Deux chantiers portent le même libellé : la ligne de l'un ne doit pas
    // rattacher la prestation de l'autre.
    const c1 = await chantiersRepo.creerChantier(A, { nom: "Chantier 1" });
    const c2 = await chantiersRepo.creerChantier(A, { nom: "Chantier 2" });
    await prestationsRepo.ajouterPrestation(A, c1.id, "Taille de haie");
    const p2 = await prestationsRepo.ajouterPrestation(A, c2.id, "Taille de haie");
    assert.deepEqual(await prestationsDuLibelle(A, c2.id, "Taille de haie"), [p2.id]);
  });

  console.log("\n=== R23 — rejouer la dictée enrichit, ne duplique pas ===\n");

  await test("le rejeu après ses réponses ne crée pas un second arbre", async () => {
    // **Mesuré en base le 27 août 2026 : il en créait un.** Ses réponses à
    // l'arrêt allongent le libellé (« — démontage avec rétention, ⌀ 45 cm ») ;
    // l'égalité exacte ne reconnaissait plus rien, et le rejeu écrivait une
    // seconde prestation pour le même arbre.
    const c = await chantiersRepo.creerChantier(A, { nom: "Rejeu" });
    const seule = {
      ...brouillonVide(),
      prestations: [
        { libelle: "Abattage d'un érable", description: null, quantite: null, unite: null, aConfirmer: false },
      ],
    };
    await brouillonsRepo.enregistrerGeneration(A, c.id, seule, "d");
    await confirmerBrouillon(A, c.id);

    const [avant] = await prestationsRepo.listerPrestations(A, c.id);
    await prestationsRepo.modifierPrestation(A, avant.id, "Abattage d'un érable — démontage avec rétention, ⌀ 45 cm");

    await brouillonsRepo.enregistrerGeneration(A, c.id, seule, "d");
    await confirmerBrouillon(A, c.id);

    const apres = await prestationsRepo.listerPrestations(A, c.id);
    assert.equal(apres.length, 1, `${apres.length} prestations pour un seul arbre : ${apres.map((x) => x.libelle).join(" | ")}`);
    assert.equal(apres[0].id, avant.id, "la prestation d'origine a été remplacée au lieu d'être reconnue");
  });

  await test("un champ resté vide se remplit au rejeu", async () => {
    // Le cas utile : une prestation créée avant le lot B, ou avant qu'il ait
    // dicté la mesure. Le rejeu la complète — sans rien remplacer.
    const c = await chantiersRepo.creerChantier(A, { nom: "Enrichissement" });
    await prestationsRepo.ajouterPrestation(A, c.id, "Haie (tout genre) (800 ml)");
    await brouillonsRepo.enregistrerGeneration(
      A,
      c.id,
      {
        ...brouillonVide(),
        prestations: [
          { libelle: "Haie (tout genre)", description: null, quantite: "800", unite: "ml", aConfirmer: false },
        ],
      },
      "d"
    );
    await confirmerBrouillon(A, c.id);

    const liste = await prestationsRepo.listerPrestations(A, c.id);
    assert.equal(liste.length, 1, "un doublon a été créé");
    assert.equal(Number(liste[0].quantite), 800, "le champ vide n'a pas été complété");
    assert.equal(liste[0].unite, "ml");
  });

  await test("une valeur déjà posée n'est jamais remplacée par une nouvelle dictée", async () => {
    // Sa correction reste la sienne. Le dépôt n'a aucune colonne de provenance :
    // c'est le refus de remplacer qui la protège, pas une distinction d'auteur.
    const c = await chantiersRepo.creerChantier(A, { nom: "Correction préservée" });
    await prestationsRepo.ajouterPrestation(A, c.id, "Haie (tout genre) (80 ml)", {
      quantite: "80",
      unite: "ml",
    });
    await brouillonsRepo.enregistrerGeneration(
      A,
      c.id,
      {
        ...brouillonVide(),
        prestations: [
          { libelle: "Haie (tout genre)", description: null, quantite: "800", unite: "ml", aConfirmer: false },
        ],
      },
      "d"
    );
    await confirmerBrouillon(A, c.id);

    const liste = await prestationsRepo.listerPrestations(A, c.id);
    const posee = liste.find((x) => Number(x.quantite) === 80);
    assert.ok(posee, `la valeur 80 a été écrasée : ${liste.map((x) => `${x.libelle}=${x.quantite}`).join(" | ")}`);
  });

  await test("aucune ancienne prestation n'est réinterprétée en masse", async () => {
    // Le rejeu n'agit que sur les prestations que la dictée mentionne. Une
    // prestation d'un autre chantier, ou d'un autre travail, ne bouge pas.
    const c = await chantiersRepo.creerChantier(A, { nom: "Voisine intacte" });
    const voisine = await prestationsRepo.ajouterPrestation(A, c.id, "Réfection d'un mur");
    await brouillonsRepo.enregistrerGeneration(
      A,
      c.id,
      {
        ...brouillonVide(),
        prestations: [
          { libelle: "Taille de haie", description: null, quantite: "20", unite: "ml", aConfirmer: false },
        ],
      },
      "d"
    );
    await confirmerBrouillon(A, c.id);

    const relue = (await prestationsRepo.listerPrestations(A, c.id)).find((x) => x.id === voisine.id);
    assert.equal(relue?.quantite, null, "une prestation que la dictée ne mentionne pas a été touchée");
    assert.equal(relue?.libelle, "Réfection d'un mur");
  });

  console.log("\n=== L'isolation entre entreprises tient ===\n");

  await test("une autre entreprise ne voit aucune liaison", async () => {
    const { entreprise: e2, utilisateurId: u2 } = await entreprisesRepo.creerEntreprise(
      { nom: "Autre" },
      { email: "autre-structuree@test.local", nom: "B" }
    );
    const B = { entrepriseId: e2.id, utilisateurId: u2 };
    assert.deepEqual(await prestationsDuLibelle(B, chantier.id, "Haie (tout genre) (800 ml)"), []);
  });

  console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
  if (echecs > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
