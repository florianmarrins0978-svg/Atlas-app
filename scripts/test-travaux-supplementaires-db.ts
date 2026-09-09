import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import {
  ajouterTravauxSupplementaires,
  emettreFacture,
  majTravauxSupplementaires,
  reprendreLeDevisSurLaFacture,
  retirerTravauxSupplementaires,
  terminerChantier,
} from "../src/server/repositories/factures";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { lignesFacture } from "../src/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// LES TRAVAUX SUPPLÉMENTAIRES — sa demande du 31 août 2026, codée le 9
// ═══════════════════════════════════════════════════════════════════════════
//
// *« Si on effectue des travaux en plus chez un client, on n'a aucun moyen de
// rajouter les TS sur la facture. »* Puis, le 9 septembre : le bouton, la
// feuille, et **une seule facture** qui additionne les deux blocs.
//
// **POURQUOI UNE SUITE BASE, ET NON UNE SUITE NAVIGATEUR.** Ce qui se joue ici
// est un INVARIANT d'écriture, pas un écran : le devis accepté ne doit jamais
// se réécrire, et une facture arrêtée non plus. Les suites navigateur démarrent
// leur serveur sous un rôle qui traverse la RLS ; elles ne peuvent pas, par
// construction, éprouver ce qu'une écriture a le droit de toucher
// (`CLAUDE.md` §5). Tout ce qui suit tourne sous `atlas_app`, comme en
// production.
//
// **LE CONTRÔLE QUI COMPTE LE PLUS EST LE TROISIÈME** : reprendre le devis
// efface les lignes pour recopier la dernière version envoyée. Sans la colonne
// `supplement`, il emportait en silence le travail ajouté — au moment même où
// le patron croit ne remettre à jour que ses prix.

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
    { nom: "Atelier des suppléments" },
    { email: `ts-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un chantier dont le devis est PARTI, et sa facture en brouillon. */
async function factureEnBrouillon(ctx: Ctx, prix = "1000.00") {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Larousse", telephone: "0612345678" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Chez Mme Larousse",
    adresseChantier: "14 chemin des Vignes",
    clientId: client.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Élagage de deux tilleuls", prix);
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, brouillon.id);
  const facture = await terminerChantier(ctx, chantier.id);
  return { chantier, facture };
}

/**
 * Les lignes d'une facture, LUES DANS LE CONTEXTE DE SON ENTREPRISE.
 *
 * **Une requête hors `withEntreprise` ne rend rien, silencieusement**
 * (`CLAUDE.md` §3) — et c'est exactement ce qui est arrivé en écrivant cette
 * suite : elle annonçait « la facture ne recopie pas la ligne du devis » sur un
 * code juste, parce qu'elle interrogeait la base sans poser l'entreprise.
 */
async function lignesDe(ctx: Ctx, factureId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select({
        id: lignesFacture.id,
        libelle: lignesFacture.libelle,
        montant: lignesFacture.montant,
        taux: lignesFacture.tauxTva,
        supplement: lignesFacture.supplement,
        ordre: lignesFacture.ordre,
      })
      .from(lignesFacture)
      .where(eq(lignesFacture.factureId, factureId))
      .orderBy(asc(lignesFacture.ordre));
    return rows;
  });
}

/** La ligne née du devis — celle qu'il ne doit jamais pouvoir retoucher. */
async function ligneDuDevis(ctx: Ctx, factureId: string) {
  const l = (await lignesDe(ctx, factureId)).find((x) => !x.supplement);
  assert.ok(l, "la facture ne porte aucune ligne venue du devis : il n'y a rien à éprouver");
  return l;
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("principal");

  await test("une facture neuve n'a AUCUN supplément — et ça se vérifie", async () => {
    // **Un contrôle qui mesure zéro ne mesure rien** (`CLAUDE.md` §5) : si
    // l'état de départ en portait déjà, tous les suivants seraient verts sans
    // rien prouver.
    const { facture } = await factureEnBrouillon(ctx);
    const lignes = await lignesDe(ctx, facture.id);
    assert.equal(lignes.length, 1, "la facture ne recopie pas la ligne du devis");
    assert.equal(lignes[0].supplement, false, "une ligne née du devis se déclare supplément");
  });

  await test("on ajoute un travail en plus, et il porte son propre taux", async () => {
    const { facture } = await factureEnBrouillon(ctx);
    const r = await ajouterTravauxSupplementaires(ctx, facture.id, "10.00");
    assert.ok(r.ok, `l'ajout est refusé : ${r.ok ? "" : r.raison}`);

    const maj = await majTravauxSupplementaires(ctx, facture.id, r.ligne.id, {
      libelle: "Dessouchage de la haie",
      quantite: "1",
      prixUnitaire: "300.00",
    });
    assert.ok(maj.ok, `la correction est refusée : ${maj.ok ? "" : maj.raison}`);
    assert.equal(maj.montant, "300.00", "le montant ne suit pas la saisie");

    const lignes = await lignesDe(ctx, facture.id);
    assert.equal(lignes.length, 2, "le supplément ne s'ajoute pas à la facture");
    const sup = lignes.find((l) => l.supplement);
    assert.ok(sup, "la ligne ajoutée ne se déclare pas supplément");
    assert.equal(sup.libelle, "Dessouchage de la haie");
    assert.equal(sup.taux, "10.00", "le taux propre au supplément n'est pas gardé");
    // Le rang vient APRÈS celui du devis : les deux blocs se lisent dans l'ordre.
    assert.ok(
      sup.ordre > lignes.find((l) => !l.supplement)!.ordre,
      "le supplément se range avant le devis"
    );
  });

  await test("REPRENDRE LE DEVIS N'EMPORTE PAS LE SUPPLÉMENT — le défaut de la 0082", async () => {
    // C'est LE contrôle de ce lot. `reprendreLeDevisSurLaFacture` efface les
    // lignes pour recopier la dernière version envoyée ; sans la colonne
    // `supplement`, il emportait le travail ajouté sans un mot.
    const { chantier, facture } = await factureEnBrouillon(ctx, "1000.00");
    const ajout = await ajouterTravauxSupplementaires(ctx, facture.id);
    assert.ok(ajout.ok);
    await majTravauxSupplementaires(ctx, facture.id, ajout.ligne.id, {
      libelle: "Broyage sur place",
      prixUnitaire: "150.00",
    });

    // Un devis v2 part : le patron a corrigé son prix après coup.
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Évacuation", "200.00");
    const v2 = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    await devisRepo.envoyerDevis(ctx, v2.id);

    const r = await reprendreLeDevisSurLaFacture(ctx, facture.id);
    assert.ok(r.ok, `la reprise est refusée : ${r.ok ? "" : r.raison}`);

    const lignes = await lignesDe(ctx, facture.id);
    const sup = lignes.filter((l) => l.supplement);
    assert.equal(sup.length, 1, "la reprise du devis a emporté les travaux supplémentaires");
    assert.equal(sup[0].libelle, "Broyage sur place", "le supplément a été réécrit par la reprise");
    assert.ok(
      lignes.some((l) => !l.supplement && l.libelle.includes("Évacuation")),
      "la reprise n'a pas apporté la nouvelle ligne du devis"
    );
  });

  await test("LE DEVIS NE SE RÉÉCRIT PAS : une ligne du devis refuse d'être corrigée", async () => {
    // Sa règle du 9 septembre : *« seulement la case travaux supplémentaires ;
    // le reste, impossible de les modifier »*. Ce n'est pas une précaution
    // d'écran — la garde est dans l'écriture.
    const { facture } = await factureEnBrouillon(ctx);
    const duDevis = await ligneDuDevis(ctx, facture.id);
    const r = await majTravauxSupplementaires(ctx, facture.id, duDevis.id, { prixUnitaire: "1.00" });
    assert.equal(r.ok, false, "une ligne du devis a pu être corrigée depuis la facture");

    const apres = await lignesDe(ctx, facture.id);
    assert.equal(apres[0].montant, duDevis.montant, "le montant du devis a bougé malgré le refus");
  });

  await test("…et elle refuse aussi d'être retirée", async () => {
    const { facture } = await factureEnBrouillon(ctx);
    const duDevis = await ligneDuDevis(ctx, facture.id);
    const r = await retirerTravauxSupplementaires(ctx, facture.id, duDevis.id);
    assert.ok(r.ok, "le geste devrait aboutir, sans rien retirer");
    assert.equal(r.retirees, 0, "une ligne du devis a été retirée de la facture");
    assert.equal((await lignesDe(ctx, facture.id)).length, 1, "la ligne du devis a disparu");
  });

  await test("le « − » referme la catégorie : tous les suppléments partent, le devis reste", async () => {
    const { facture } = await factureEnBrouillon(ctx);
    for (const prix of ["100.00", "200.00"]) {
      const a = await ajouterTravauxSupplementaires(ctx, facture.id);
      assert.ok(a.ok);
      await majTravauxSupplementaires(ctx, facture.id, a.ligne.id, { libelle: "Extra", prixUnitaire: prix });
    }
    assert.equal((await lignesDe(ctx, facture.id)).filter((l) => l.supplement).length, 2);

    const r = await retirerTravauxSupplementaires(ctx, facture.id);
    assert.ok(r.ok);
    assert.equal(r.retirees, 2, "le retrait n'a pas emporté les deux lignes");
    const lignes = await lignesDe(ctx, facture.id);
    assert.equal(lignes.length, 1, "le devis n'a pas survécu au retrait des suppléments");
    assert.equal(lignes[0].supplement, false);
  });

  await test("LES TOTAUX ET LA TVA SUIVENT — deux taux sur une seule facture", async () => {
    // Rien n'a été écrit pour cela : `emettreFacture` recalcule depuis les
    // lignes par `totauxAvecReduction`, qui sait déjà grouper par taux. Ce
    // contrôle existe pour que ça reste vrai.
    const { facture } = await factureEnBrouillon(ctx, "1000.00");
    const a = await ajouterTravauxSupplementaires(ctx, facture.id, "10.00");
    assert.ok(a.ok);
    await majTravauxSupplementaires(ctx, facture.id, a.ligne.id, {
      libelle: "Dessouchage",
      prixUnitaire: "300.00",
    });

    const emise = await emettreFacture(ctx, facture.id);
    // 1 000 à 20 % = 200 ; 300 à 10 % = 30 ; HT 1 300, TVA 230, TTC 1 530.
    assert.equal(emise.totalHt, "1300.00", `HT : ${emise.totalHt}`);
    assert.equal(emise.totalTva, "230.00", `TVA : ${emise.totalTva} — les deux taux ne sont pas séparés`);
    assert.equal(emise.totalTtc, "1530.00", `TTC : ${emise.totalTtc}`);
  });

  await test("UNE FACTURE ARRÊTÉE NE REÇOIT PLUS RIEN — et le refus se dit", async () => {
    const { facture } = await factureEnBrouillon(ctx);
    await emettreFacture(ctx, facture.id);

    const a = await ajouterTravauxSupplementaires(ctx, facture.id);
    assert.equal(a.ok, false, "on a pu ajouter un travail à une facture partie");
    assert.match(
      a.ok ? "" : a.raison,
      /arrêtée/,
      "le refus n'explique pas pourquoi : le patron ne saurait pas quoi faire"
    );
    assert.equal((await lignesDe(ctx, facture.id)).filter((l) => l.supplement).length, 0);
  });

  await test("une facture d'une AUTRE entreprise n'existe pas pour celle-ci", async () => {
    // L'isolation ne se contourne pas par un identifiant deviné : ce n'est pas
    // « refusé », c'est introuvable (`withEntreprise`).
    const voisin = await contexte("voisin");
    const { facture } = await factureEnBrouillon(voisin);
    const r = await ajouterTravauxSupplementaires(ctx, facture.id);
    assert.equal(r.ok, false, "une facture d'à côté a accepté un supplément");
    assert.match(r.ok ? "" : r.raison, /introuvable/);
  });
}

main()
  .catch((e) => {
    console.error(e);
    failed++;
  })
  .finally(async () => {
    await pool.end();
    console.log(`\n${failed === 0 ? "✅" : "❌"} Travaux supplémentaires — ${passed} réussi(s), ${failed} échec(s).`);
    process.exit(failed === 0 ? 0 : 1);
  });
