import assert from "node:assert/strict";
import { asc, eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import {
  ajouterLigneDeFacture,
  creerFactureSansDevis,
  emettreFacture,
  FactureDirecteImpossibleError,
  genererPdfFacturePourApercu,
  getFacturePourChantier,
  majLigneDeFacture,
  reprendreLeDevisSurLaFacture,
  retirerLignesDeFacture,
  terminerChantier,
} from "../src/server/repositories/factures";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { chantiers, lignesFacture } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import { texteDuPdf } from "./_lecteur-pdf-protege";
import { TITRE_TRAVAUX_SUPPLEMENTAIRES } from "../src/lib/reduction-devis";

// ═══════════════════════════════════════════════════════════════════════════
// FACTURER SANS PASSER PAR LA CASE DEVIS — sa demande du 10 septembre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// *« Il faut que l'on puisse facturer sans avoir besoin de passer par la case
// devis. »* Un dépannage fait dans la journée, réglé sur place.
//
// **POURQUOI UNE SUITE BASE, ET NON UNE SUITE NAVIGATEUR.** Ce qui se joue ici
// est un invariant d'ÉCRITURE : `factures.devis_id` vient de perdre son NOT
// NULL (migration 0086), et le WHERE qui protège les lignes du devis vient de
// s'ouvrir sur un cas. Les suites navigateur démarrent leur serveur sous un
// rôle qui traverse la RLS ; elles ne peuvent pas, par construction, éprouver
// ce qu'une écriture a le droit de toucher (`CLAUDE.md` §5). Tout ce qui suit
// tourne sous `atlas_app`, comme chez lui.
//
// **LE CONTRÔLE QUI COMPTE LE PLUS EST LE DERNIER GROUPE** — « ce qui n'a pas
// bougé ». Élargir une garde est le geste le plus facile à faire déborder : si
// l'ouverture accordée aux factures directes atteignait les factures nées d'un
// devis, le prix que le client a ACCEPTÉ redeviendrait réécrivable. Personne ne
// s'en apercevrait avant qu'un client compare son devis à sa facture — et ce
// jour-là, c'est le patron qui n'a rien à répondre.

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

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Dépannage express" },
    { email: `sansdevis-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/**
 * LE CHEMIN DU PATRON, et non celui de la fonction qu'on vient d'écrire.
 *
 * Il tape le nom de son client sur la fiche, puis « Faire la facture ». Côté
 * serveur, cela fait exactement ces deux gestes-ci : un client et un chantier
 * naissent (`creerChantierAction`), puis la facture est posée. Court-circuiter
 * le premier éprouverait une porte que lui n'emprunte jamais (`CLAUDE.md`
 * §5 quater).
 */
async function commeSurLaFiche(ctx: Ctx, nom = "M. Julien") {
  const client = await clientsRepo.creerClient(ctx, { nom, telephone: "0614228730" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: `Chez ${nom}`,
    adresseChantier: "12 rue des Lilas, Saint-Marc",
    clientId: client.id,
  });
  return { client, chantier };
}

/** Un chantier ORDINAIRE : devis écrit, devis parti, facture en brouillon. */
async function avecDevis(ctx: Ctx, prix = "1000.00") {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Larousse" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Chez Mme Larousse",
    clientId: client.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Élagage de deux tilleuls", prix);
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, brouillon.id);
  return { chantier, facture: await terminerChantier(ctx, chantier.id) };
}

/**
 * Les lignes d'une facture, LUES DANS LE CONTEXTE DE SON ENTREPRISE.
 *
 * Une requête hors `withEntreprise` ne rend rien, *silencieusement* — une suite
 * écrite ainsi annonce « aucune ligne » sur du code juste.
 */
async function lignesDe(ctx: Ctx, factureId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: lignesFacture.id,
        libelle: lignesFacture.libelle,
        montant: lignesFacture.montant,
        taux: lignesFacture.tauxTva,
        supplement: lignesFacture.supplement,
      })
      .from(lignesFacture)
      .where(eq(lignesFacture.factureId, factureId))
      .orderBy(asc(lignesFacture.ordre))
  );
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("principal");

  // ── CE QU'ELLE EST À SA NAISSANCE ────────────────────────────────────────

  await test("elle naît SANS devis, et sans aucune ligne", async () => {
    const { chantier } = await commeSurLaFiche(ctx);
    const facture = await creerFactureSansDevis(ctx, chantier.id);

    assert.equal(facture.devisId, null, "une facture directe s'est trouvé un devis");
    assert.ok(facture.numeroCommercial, "elle part sans numéro de facture");
    // **L'état de départ se MESURE**, sinon les contrôles suivants sont verts
    // sans rien prouver (`CLAUDE.md` §5, « un contrôle qui mesure zéro »).
    const lignes = await lignesDe(ctx, facture.id);
    assert.equal(lignes.length, 0, "elle arrive préremplie : personne n'a demandé ces lignes");
  });

  await test("elle recopie le client de sa fiche, et le FIGE", async () => {
    const { client, chantier } = await commeSurLaFiche(ctx, "Mme Berger");
    const facture = await creerFactureSansDevis(ctx, chantier.id);
    assert.equal(facture.clientNom, "Mme Berger");
    assert.equal(facture.adresseChantier, "12 rue des Lilas, Saint-Marc");

    // Corriger la fiche NE réécrit pas une pièce comptable (migration 0038).
    await clientsRepo.mettreAJourClient(ctx, client.id, { nom: "Mme Berger-Dupont" });
    const relue = await getFacturePourChantier(ctx, chantier.id);
    assert.equal(relue?.facture.clientNom, "Mme Berger", "la facture a suivi la fiche du client");
  });

  await test("le chantier part DIRECTEMENT dans les terminés", async () => {
    // Sa décision, portée sur la planche : « le chantier créé part directement
    // dans Terminés ». Sans cela, il resterait à l'accueil comme un travail en
    // cours alors qu'il est fait, payé, et facturé.
    const { chantier } = await commeSurLaFiche(ctx, "M. Roche");
    await creerFactureSansDevis(ctx, chantier.id);
    const [relu] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select({ termineAt: chantiers.termineAt }).from(chantiers).where(eq(chantiers.id, chantier.id))
    );
    assert.ok(relu.termineAt, "le chantier d'une facture directe est resté en cours");
  });

  // ── CE QU'IL PEUT Y ÉCRIRE ───────────────────────────────────────────────

  await test("il saisit ses lignes, et ce ne sont PAS des suppléments", async () => {
    const { chantier } = await commeSurLaFiche(ctx, "M. Pons");
    const facture = await creerFactureSansDevis(ctx, chantier.id);

    const r = await ajouterLigneDeFacture(ctx, facture.id, "10.00");
    assert.ok(r.ok, `la ligne est refusée : ${r.ok ? "" : r.raison}`);

    // **Le point qui décide de ce que le CLIENT lit.** Marquée « supplément »,
    // la ligne s'imprimerait sous le titre « TRAVAUX SUPPLÉMENTAIRES » — au
    // -dessus de la seule chose qu'on lui facture. Supplémentaire à quoi ?
    assert.equal(r.ligne.supplement, false, "une ligne de facture directe se déclare supplément");

    const maj = await majLigneDeFacture(ctx, facture.id, r.ligne.id, {
      libelle: "Dépannage arrosage — remplacement électrovanne",
      quantite: "1",
      prixUnitaire: "145.00",
    });
    assert.ok(maj.ok, `la correction est refusée : ${maj.ok ? "" : maj.raison}`);
    assert.equal(maj.montant, "145.00");
  });

  await test("il retire une ligne qu'il vient de saisir", async () => {
    const { chantier } = await commeSurLaFiche(ctx, "M. Aubert");
    const facture = await creerFactureSansDevis(ctx, chantier.id);
    const r = await ajouterLigneDeFacture(ctx, facture.id);
    assert.ok(r.ok);

    const retrait = await retirerLignesDeFacture(ctx, facture.id, r.ligne.id);
    assert.ok(retrait.ok, `le retrait est refusé : ${retrait.ok ? "" : retrait.raison}`);
    assert.equal(retrait.retirees, 1, "le retrait n'a touché aucune ligne");
    assert.equal((await lignesDe(ctx, facture.id)).length, 0);
  });

  await test("chaque ligne porte SA TVA, et la facture s'émet dessus", async () => {
    const { chantier } = await commeSurLaFiche(ctx, "Mme Chaix");
    const facture = await creerFactureSansDevis(ctx, chantier.id);

    const a = await ajouterLigneDeFacture(ctx, facture.id, "10.00");
    const b = await ajouterLigneDeFacture(ctx, facture.id, "20.00");
    assert.ok(a.ok && b.ok);
    await majLigneDeFacture(ctx, facture.id, a.ligne.id, {
      libelle: "Main-d'œuvre",
      quantite: "1",
      prixUnitaire: "100.00",
    });
    await majLigneDeFacture(ctx, facture.id, b.ligne.id, {
      libelle: "Électrovanne 9 V",
      quantite: "1",
      prixUnitaire: "50.00",
    });

    const emise = await emettreFacture(ctx, facture.id);
    // 100 à 10 % = 10 · 50 à 20 % = 10 → 20 de TVA, 170 TTC. Recomposable à la
    // main : c'est ce qu'il défend devant son client.
    assert.equal(emise.totalHt, "150.00");
    assert.equal(emise.totalTva, "20.00");
    assert.equal(emise.totalTtc, "170.00");
  });

  await test("son PDF ne cite AUCUN devis, et ne parle pas de suppléments", async () => {
    const { chantier } = await commeSurLaFiche(ctx, "M. Vidal");
    const facture = await creerFactureSansDevis(ctx, chantier.id);
    const l = await ajouterLigneDeFacture(ctx, facture.id);
    assert.ok(l.ok);
    await majLigneDeFacture(ctx, facture.id, l.ligne.id, {
      libelle: "Remplacement d'un programmateur",
      quantite: "1",
      prixUnitaire: "210.00",
    });

    const texte = await texteDuPdf(await genererPdfFacturePourApercu(ctx, facture.id));
    assert.match(texte, /Remplacement d'un programmateur|Remplacement d’un programmateur/);
    // Le papier écrit « Établie à partir du devis n° … » quand il y en a un. Ici
    // il n'y en a pas : citer un devis absent enverrait le client en chercher un.
    assert.doesNotMatch(texte, /partir du devis/i, "le PDF cite un devis qui n'existe pas");
    assert.ok(
      !texte.includes(TITRE_TRAVAUX_SUPPLEMENTAIRES),
      "le PDF titre « travaux supplémentaires » sur la seule chose qu'on facture"
    );
  });

  // ── CE QU'ELLE REFUSE, ET LE GESTE QUE CHAQUE REFUS DÉSIGNE ──────────────

  async function refus(fn: () => Promise<unknown>): Promise<string> {
    try {
      await fn();
      return "AUCUN REFUS";
    } catch (err) {
      if (err instanceof FactureDirecteImpossibleError) return err.motif;
      throw err;
    }
  }

  await test("un chantier QUI A un devis est refusé — il se facture par sa fin", async () => {
    // Sa décision, portée sur la planche : « on ne touche pas aux chantiers
    // existants ». Le laisser passer facturerait à côté du prix que le client a
    // accepté, sans que rien ne le dise.
    const { chantier } = await avecDevis(ctx);
    assert.equal(await refus(() => creerFactureSansDevis(ctx, chantier.id)), "chantier_avec_devis");
  });

  await test("un chantier déjà facturé est refusé", async () => {
    const { chantier } = await commeSurLaFiche(ctx, "M. Ferrand");
    await creerFactureSansDevis(ctx, chantier.id);
    assert.equal(await refus(() => creerFactureSansDevis(ctx, chantier.id)), "deja_facture");
  });

  await test("le chantier du voisin n'est pas « refusé » : il n'existe pas", async () => {
    const voisin = await contexte("voisin");
    const { chantier } = await commeSurLaFiche(voisin, "Mme Ailleurs");
    assert.equal(await refus(() => creerFactureSansDevis(ctx, chantier.id)), "chantier_absent");
  });

  await test("« Reprendre le devis » est refusé, et n'efface RIEN", async () => {
    // **Le refus qui vaut le plus cher.** La reprise commence par effacer les
    // lignes non-supplément pour recopier le devis : sur une facture directe,
    // c'est TOUTE la facture. Sans ce refus, un devis écrit après coup sur le
    // même chantier lui ferait perdre sa saisie d'un seul appui.
    const { chantier } = await commeSurLaFiche(ctx, "M. Sabatier");
    const facture = await creerFactureSansDevis(ctx, chantier.id);
    const l = await ajouterLigneDeFacture(ctx, facture.id);
    assert.ok(l.ok);
    await majLigneDeFacture(ctx, facture.id, l.ligne.id, {
      libelle: "Purge du réseau",
      quantite: "1",
      prixUnitaire: "80.00",
    });

    const r = await reprendreLeDevisSurLaFacture(ctx, facture.id);
    assert.equal(r.ok, false, "la reprise a été acceptée sur une facture sans devis");
    assert.match(r.ok ? "" : r.raison, /sans devis/);

    const apres = await lignesDe(ctx, facture.id);
    assert.equal(apres.length, 1, "la reprise refusée a quand même emporté la saisie");
    assert.equal(apres[0].libelle, "Purge du réseau");
  });

  await test("arrêtée, elle ne se réécrit plus", async () => {
    const { chantier } = await commeSurLaFiche(ctx, "Mme Nogaret");
    const facture = await creerFactureSansDevis(ctx, chantier.id);
    const l = await ajouterLigneDeFacture(ctx, facture.id);
    assert.ok(l.ok);
    await majLigneDeFacture(ctx, facture.id, l.ligne.id, {
      libelle: "Pose d'un regard",
      quantite: "1",
      prixUnitaire: "90.00",
    });
    await emettreFacture(ctx, facture.id);

    const ajout = await ajouterLigneDeFacture(ctx, facture.id);
    assert.equal(ajout.ok, false, "on ajoute une ligne à une facture partie chez le client");
    assert.match(ajout.ok ? "" : ajout.raison, /arrêtée/);

    const retrait = await retirerLignesDeFacture(ctx, facture.id);
    assert.equal(retrait.ok, false, "on vide une facture inscrite au relevé de TVA");
  });

  // ── CE QUI N'A PAS BOUGÉ : LE PRIX QUE LE CLIENT A ACCEPTÉ ───────────────

  await test("RÉGRESSION — sur une facture née d'un devis, ses lignes restent intouchables", async () => {
    const { facture } = await avecDevis(ctx, "1000.00");
    const lignes = await lignesDe(ctx, facture.id);
    const duDevis = lignes.find((l) => !l.supplement);
    assert.ok(duDevis, "la facture ne porte aucune ligne du devis : il n'y a rien à éprouver");

    const maj = await majLigneDeFacture(ctx, facture.id, duDevis.id, { prixUnitaire: "1.00" });
    assert.equal(maj.ok, false, "le prix accepté par le client vient d'être réécrit");
    assert.match(maj.ok ? "" : maj.raison, /vient du devis/);

    const relue = await lignesDe(ctx, facture.id);
    assert.equal(
      relue.find((l) => l.id === duDevis.id)?.montant,
      duDevis.montant,
      "le montant du devis a bougé malgré le refus"
    );
  });

  await test("RÉGRESSION — « retirer la catégorie » n'emporte pas le devis", async () => {
    const { facture } = await avecDevis(ctx, "800.00");
    const sup = await ajouterLigneDeFacture(ctx, facture.id);
    assert.ok(sup.ok);
    assert.equal(sup.ligne.supplement, true, "un ajout sur une facture avec devis n'est plus un supplément");

    const r = await retirerLignesDeFacture(ctx, facture.id);
    assert.ok(r.ok);
    assert.equal(r.retirees, 1, "le retrait a emporté plus que les suppléments");

    const restantes = await lignesDe(ctx, facture.id);
    assert.equal(restantes.length, 1, "la ligne du devis a disparu avec les suppléments");
    assert.equal(restantes[0].supplement, false);
  });
}

main()
  .catch((e) => {
    console.error(e);
    failed++;
  })
  .finally(async () => {
    await pool.end();
    console.log(
      `\n${failed === 0 ? "✅" : "❌"} Facture sans devis — ${passed} réussi(s), ${failed} échec(s).`
    );
    process.exit(failed === 0 ? 0 : 1);
  });
