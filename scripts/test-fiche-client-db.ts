// La fiche client, lue en base — et surtout, lue par la BONNE entreprise.
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE SUITE NAVIGATEUR NE VERRAIT.** Les
// suites navigateur démarrent leur serveur sous un rôle qui TRAVERSE la RLS
// (`CLAUDE.md` §5) : elles ne verraient jamais un défaut d'isolation. Or cet
// écran porte le chiffre d'affaires d'un client — c'est exactement la donnée
// qu'une entreprise ne doit jamais voir chez une autre.
//
// Le reste du parcours, dans l'ordre :
//
//   1. les trois chiffres viennent des factures ÉMISES, jamais des brouillons —
//      un brouillon n'a pas été envoyé, et le compter annoncerait de l'argent
//      que le client ne sait pas encore devoir ;
//   2. ce qui reste dû suit les règlements notés, par la même règle que le
//      relevé de TVA (`resteDu`) ;
//   3. un client sans facture rend `null` et non « 0 € » — la nuance décide de
//      la façon dont le patron lit sa fiche ;
//   4. un chantier supprimé ne pèse plus dans ce qu'un client a rapporté ;
//   5. **l'isolation, dans les deux sens** : la fiche d'un client d'une autre
//      entreprise n'existe pas, et les chantiers d'à côté ne s'ajoutent pas aux
//      siens.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier, supprimerChantier } from "../src/server/repositories/chantiers";
import { creerClient } from "../src/server/repositories/clients";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { ajouterPrestation } from "../src/server/repositories/prestations";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import { terminerChantier, emettreFacture, getFacturePourChantier } from "../src/server/repositories/factures";
import { noterPaiement } from "../src/server/repositories/paiements-facture";
import { chargerFicheClient } from "../src/server/repositories/fiche-client";
import { ajouterPrestation as ajouterPrestationEntretien } from "../src/server/repositories/prestations-entretien";
import {
  ouvrirPassage,
  lirePassage,
  cocherLigne,
  nommerClient,
  figerPassage,
} from "../src/server/repositories/passages-entretien";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { chantiers, devis } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function monterEntreprise(nom: string) {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `fc-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/**
 * Une fiche d'entretien REMPLIE et ENVOYÉE — par le vrai parcours.
 *
 * Pas d'`INSERT` à la main : `figerPassage` est ce qui pose `envoye_le` et le
 * jeton, et c'est sur eux que la colonne du dossier se remplit. Un montage qui
 * les écrirait directement passerait au vert sur un produit cassé.
 */
async function ficheEnvoyee(
  ctx: { utilisateurId: string; entrepriseId: string },
  clientId: string,
  jour: string,
  combienCochees = 1
) {
  await ajouterPrestationEntretien(ctx, { famille: "Pelouse", libelle: "Tonte" });
  await ajouterPrestationEntretien(ctx, { famille: "Tailles", libelle: "Taille de haie" });

  const ouvert = await ouvrirPassage(ctx, jour);
  assert.ok(ouvert.ok, "la fiche d'entretien n'a pas pu s'ouvrir");
  const passage = await lirePassage(ctx, ouvert.id);
  assert.ok(passage, "la fiche ouverte est introuvable");
  for (const ligne of passage.lignes.slice(0, combienCochees)) {
    await cocherLigne(ctx, ouvert.id, ligne.id, true);
  }
  await nommerClient(ctx, ouvert.id, clientId);
  const fige = await figerPassage(ctx, ouvert.id);
  assert.ok(fige.ok, `la fiche n'est pas partie : ${fige.ok ? "" : fige.phrase}`);
  return { id: ouvert.id, jeton: fige.jeton };
}

/** Un chantier chiffré, facturé et émis — le parcours complet. */
async function chantierFacture(
  ctx: { utilisateurId: string; entrepriseId: string },
  clientId: string,
  nom: string,
  lignes: [string, string][]
) {
  const c = await creerChantier(ctx, { nom, clientId });
  for (const [libelle, montant] of lignes) await ajouterLignePrix(ctx, c.id, libelle, montant);
  const devis = await getOuCreerDevisBrouillon(ctx, c.id);
  await envoyerDevis(ctx, devis.id);
  await terminerChantier(ctx, c.id);
  const f = await getFacturePourChantier(ctx, c.id);
  await emettreFacture(ctx, f!.facture.id);
  return { chantierId: c.id, factureId: f!.facture.id };
}

/**
 * Le même parcours, mais DATÉ — pour pouvoir juger d'un ordre.
 *
 * **Un `UPDATE` par `pool` ne fait RIEN ici, et sans bruit.** Cette suite tourne
 * sous `atlas_app`, soumis à la RLS : hors de `withEntreprise`, la requête ne
 * touche aucune ligne et rend `rowCount: 0` sans se plaindre (`CLAUDE.md` §3).
 * La première version de ce montage décalait les dates ainsi — les trois
 * colonnes restaient au jour même, et le contrôle accusait le tri de « remonter
 * le temps » entre deux dates identiques. Le tri était juste ; c'était le
 * montage qui ne montait rien.
 *
 * `terminerChantier` et `emettreFacture` prennent déjà une date. `envoyerDevis`
 * n'en prend pas : sa date se pose donc par `withEntreprise`, qui est le cadre,
 * et non un contournement.
 */
async function chantierDate(
  ctx: { utilisateurId: string; entrepriseId: string },
  clientId: string,
  nom: string,
  lignes: [string, string][],
  jour: string
) {
  const c = await creerChantier(ctx, { nom, clientId });
  for (const [libelle, montant] of lignes) await ajouterLignePrix(ctx, c.id, libelle, montant);
  const d = await getOuCreerDevisBrouillon(ctx, c.id);

  // **La date se pose AVANT l'envoi.** Un devis envoyé est immuable
  // (`trg_devis_immuable`, migration 0001) : l'`UPDATE` d'après-coup était
  // refusé par PostgreSQL. Et `envoyerDevis` garde la date du brouillon — c'est
  // donc bien le chemin réel, pas un contournement.
  const pose = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx.update(devis).set({ dateEmission: jour }).where(eq(devis.id, d.id)).returning({ id: devis.id })
  );
  // Le montage doit savoir se plaindre : sans cette ligne, une date non posée
  // ferait accuser le tri au lieu du décor.
  assert.equal(pose.length, 1, `la date du devis n'a pas été posée pour « ${nom} »`);
  await envoyerDevis(ctx, d.id);

  const quand = new Date(`${jour}T09:00:00Z`);
  await terminerChantier(ctx, c.id, quand);
  // **`terminerChantier` n'applique PAS sa date à `termine_at`** : elle pose
  // `COALESCE(termine_at, now())` — délibérément, pour ne pas réécrire une fin
  // déjà notée — et se sert de `maintenant` pour l'échéance de la facture. La
  // date de fin se pose donc ici, dans le cadre, tant que le chantier est encore
  // modifiable : ce qui devient immuable, c'est la facture ÉMISE, plus bas.
  const fin = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx.update(chantiers).set({ termineAt: quand }).where(eq(chantiers.id, c.id)).returning({ id: chantiers.id })
  );
  assert.equal(fin.length, 1, `la date de fin n'a pas été posée pour « ${nom} »`);

  const f = await getFacturePourChantier(ctx, c.id);
  await emettreFacture(ctx, f!.facture.id, quand);
  return { chantierId: c.id, factureId: f!.facture.id, jour };
}

async function main() {
  console.log("=== La fiche client, en base ===\n");

  await essai("les trois chiffres viennent des factures ÉMISES", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai fiche");
    const client = await creerClient(ctx, { nom: "Mme Bracquemont" });

    await chantierFacture(ctx, client.id, "Élagage", [["Élagage — 3 chênes", "450.00"]]);
    await chantierFacture(ctx, client.id, "Taille", [["Taille de haie", "300.00"]]);

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.ok(fiche, "la fiche est introuvable");
    assert.equal(fiche.chantiers, 2);
    // 450 + 300 = 750 HT, TVA 20 % → 900 TTC.
    assert.equal(fiche.facture, "900.00", "le total ne correspond pas aux factures émises");
    assert.equal(fiche.du, "900.00", "rien n'est réglé : tout est encore dû");
  });

  // ── Les trois colonnes de pièces, par le VRAI parcours ────────────────────
  //
  // *Sa demande du 20 août 2026 : « les devis rangés sous l'encadré devis au
  // format PDF, trié par date, de la plus récente à la moins récente », puis
  // « tu peux rajouter une colonne facture et ranger les factures dans le même
  // ordre ».*
  //
  // **Le parcours, pas des `INSERT`.** `chantierFacture` passe par
  // `envoyerDevis`, `terminerChantier` et `emettreFacture` : ce qui est éprouvé
  // ici est ce que produit l'application, pas ce qu'on aurait cru qu'elle
  // produit.
  await essai("les trois colonnes se remplissent, chacune de ses pièces", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai pièces");
    const client = await creerClient(ctx, { nom: "M. Martins" });
    await chantierFacture(ctx, client.id, "Élagage", [["Élagage — 3 chênes", "450.00"]]);
    await chantierFacture(ctx, client.id, "Taille", [["Taille de haie", "300.00"]]);
    const saFiche = await ficheEnvoyee(ctx, client.id, "2026-08-20");

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.ok(fiche, "la fiche est introuvable");
    const { devis: sesDevis, fiches, factures: sesFactures } = fiche.pieces;

    assert.equal(sesDevis.length, 2, "les deux devis envoyés doivent être là");
    assert.equal(sesFactures.length, 2, "les deux factures émises doivent être là");
    // **UNE fiche, pas trois** : les deux chantiers facturés n'en produisent
    // aucune, seule celle qu'il a remplie compte (sa règle du 23 août 2026).
    assert.equal(fiches.length, 1, "la colonne ne porte pas la seule fiche envoyée");
    assert.equal(fiches[0].id, saFiche.id, "la pièce ne désigne pas la fiche envoyée");

    // Chaque pièce mène à SON document, et l'adresse est celle que l'écran pose.
    for (const d of sesDevis) assert.match(d.href, /^\/api\/devis\/[0-9a-f-]{36}\/pdf$/, `devis : ${d.href}`);
    for (const f of sesFactures) assert.match(f.href, /^\/api\/factures\/[0-9a-f-]{36}\/pdf$/, `facture : ${f.href}`);
    // **L'adresse que le CLIENT a reçue**, pas un PDF : ce rapport n'est figé
    // nulle part en fichier, et la vignette le dit (`format: "page"`).
    assert.equal(fiches[0].href, `/entretien/${saFiche.jeton}`, `fiche : ${fiches[0].href}`);
    assert.equal(fiches[0].format, "page", "la fiche s'annonce comme un PDF qu'elle n'est pas");
    // **Le COMPTE, et c'est une capture qui a appris à l'exiger.** L'écran
    // annonçait « 0 prestation » sur une fiche qui en portait deux : la
    // sous-requête corrélée se rendait en `l.passage_id = l.id`, jamais vraie
    // (`fiche-client.ts` le raconte). Aucune assertion ne regardait ce texte —
    // et un compte de zéro se lit comme une fiche vide, pas comme un défaut.
    assert.equal(
      fiches[0].precision,
      "1 prestation",
      `la fiche annonce « ${fiches[0].precision} » au lieu de ce qu'elle porte`
    );
  });

  // ── SA RÈGLE DU 23 AOÛT 2026 ─────────────────────────────────────────────
  //
  // *« Je viens de facturer monsieur Bernard […] néanmoins il y a une fiche
  // chantier qui s'est créée en même temps. Cette catégorie est réservée
  // lorsque les paysagistes créent une fiche chantier avec les informations
  // type la tonte, la taille, ce qu'ils ont fait. À aucun moment, lorsqu'une
  // facture doit être envoyée, une fiche chantier doit être créée. »*
  //
  // **Le mécanisme, et il était invisible à la lecture :** émettre une facture
  // POSE `termine_at` (`factures.ts` : `COALESCE(termine_at, now())`), et la
  // colonne listait les chantiers terminés. Le document qu'elle ouvrait est de
  // surcroît la feuille INTERNE — équipe, créneau, note vocale — que ses
  // salariés lisent dans la camionnette : rangée au dossier d'un client, elle
  // donnait à croire qu'il l'avait reçue.
  await essai("facturer ne fabrique AUCUNE fiche de chantier", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai Bernard");
    const client = await creerClient(ctx, { nom: "M. Bernard" });
    await chantierFacture(ctx, client.id, "Haie de laurier", [["Haie de laurier (20 ml)", "400.00"]]);

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.equal(fiche!.pieces.factures.length, 1, "la facture émise doit être là");
    assert.deepEqual(
      fiche!.pieces.fiches,
      [],
      "facturer a fabriqué une fiche de chantier que personne n'a écrite"
    );
  });

  // **Une fiche d'entretien sans aucun chantier compte quand même.** Elle
  // s'ouvre depuis Paysage, se nomme, s'envoie — sans qu'aucun chantier
  // n'existe. Un retour anticipé « ce client n'a pas de chantier » la faisait
  // disparaître de son dossier.
  await essai("un client sans chantier voit tout de même sa fiche envoyée", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai sans chantier");
    const client = await creerClient(ctx, { nom: "Mme Roux" });
    const saFiche = await ficheEnvoyee(ctx, client.id, "2026-08-21");

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.ok(fiche, "la fiche du client est introuvable");
    assert.equal(fiche.pieces.fiches.length, 1, "la fiche envoyée a disparu du dossier");
    assert.equal(fiche.pieces.fiches[0].href, `/entretien/${saFiche.jeton}`);
  });

  // **Deux fiches, deux comptes DIFFÉRENTS.** Un seul compte juste peut l'être
  // par hasard — si la sous-requête rendait le total de l'entreprise, une fiche
  // à une prestation passerait au vert dans le cas ci-dessus. Deux fiches qui
  // ne portent pas le même nombre ne laissent plus cette porte ouverte.
  await essai("chaque fiche annonce SON nombre de prestations", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai comptes");
    const client = await creerClient(ctx, { nom: "Mme Aubry" });
    await ficheEnvoyee(ctx, client.id, "2026-07-02", 1);
    await ficheEnvoyee(ctx, client.id, "2026-07-30", 2);

    const fiche = await chargerFicheClient(ctx, client.id);
    const comptes = fiche!.pieces.fiches.map((f) => f.precision);
    // Du plus récent au plus ancien : la fiche à deux prestations d'abord.
    assert.deepEqual(
      comptes,
      ["2 prestations", "1 prestation"],
      `les fiches annoncent : ${comptes.join(" | ")}`
    );
  });

  // **Un brouillon n'est pas une pièce**, ici comme pour les devis : tant qu'il
  // n'est pas figé, il n'a ni date d'envoi ni adresse publique — la colonne
  // renverrait vers une page qui n'existe pas.
  await essai("une fiche d'entretien PAS ENVOYÉE reste hors du dossier", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai brouillon fiche");
    const client = await creerClient(ctx, { nom: "M. Blanc" });
    await ajouterPrestationEntretien(ctx, { famille: "Pelouse", libelle: "Tonte" });
    const ouvert = await ouvrirPassage(ctx, "2026-08-22");
    assert.ok(ouvert.ok);
    const passage = await lirePassage(ctx, ouvert.id);
    await cocherLigne(ctx, ouvert.id, passage!.lignes[0].id, true);
    await nommerClient(ctx, ouvert.id, client.id);

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.deepEqual(fiche!.pieces.fiches, [], "un brouillon de fiche est entré dans le dossier");
  });

  await essai("chaque colonne descend dans le temps, sans exception", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai ordre");
    const client = await creerClient(ctx, { nom: "M. Martins" });
    await chantierDate(ctx, client.id, "Ancien", [["Taille", "100.00"]], "2024-03-02");
    await chantierDate(ctx, client.id, "Milieu", [["Tonte", "150.00"]], "2025-06-10");
    await chantierDate(ctx, client.id, "Récent", [["Élagage", "200.00"]], "2026-07-28");
    // **Les fiches ont leurs propres dates**, et ne suivent plus les chantiers :
    // depuis le 23 août 2026 la colonne porte les fiches d'entretien envoyées,
    // pas les chantiers terminés. Trois d'entre elles, pour que le tri ait
    // quelque chose à prouver ici comme dans les deux autres colonnes.
    await ficheEnvoyee(ctx, client.id, "2024-04-05");
    await ficheEnvoyee(ctx, client.id, "2025-09-14");
    await ficheEnvoyee(ctx, client.id, "2026-06-01");

    const fiche = await chargerFicheClient(ctx, client.id);
    for (const [quoi, pieces] of Object.entries(fiche!.pieces)) {
      assert.equal(pieces.length, 3, `${quoi} : trois pièces attendues, ${pieces.length} trouvée(s)`);
      const jours = pieces.map((p) => p.jour);
      // **Trois pièces, pas deux.** Avec deux, un tri qui inverse tout passerait
      // au vert une fois sur deux ; avec trois, seul le bon ordre survit.
      assert.deepEqual(
        [...jours].sort().reverse(),
        jours,
        `${quoi} ne descend pas dans le temps : ${jours.join(" puis ")}`
      );
      assert.equal(new Set(jours).size, 3, `${quoi} porte des dates identiques : rien à ordonner`);
    }
  });

  await essai("deux versions d'un même devis ne font qu'UNE pièce — la dernière", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai versions");
    const client = await creerClient(ctx, { nom: "M. Révisé" });
    const c = await creerChantier(ctx, { nom: "Terrasse", clientId: client.id });
    await ajouterLignePrix(ctx, c.id, "Dallage", "800.00");

    const v1 = await getOuCreerDevisBrouillon(ctx, c.id);
    await envoyerDevis(ctx, v1.id);
    // Le client demande une correction : une NOUVELLE VERSION part, sous le
    // même numéro commercial — il est stable à travers les versions.
    const v2 = await getOuCreerDevisBrouillon(ctx, c.id);
    await envoyerDevis(ctx, v2.id);
    assert.notEqual(v1.id, v2.id, "le montage n'a pas produit deux versions");
    assert.equal(v1.numeroCommercial, v2.numeroCommercial, "les deux versions devraient partager leur numéro");

    const fiche = await chargerFicheClient(ctx, client.id);
    // **Trouvé par la suite navigateur, invisible à la lecture.** L'écran
    // portait deux lignes « n° 2026-0003 », à la même date, impossibles à
    // distinguer : il aurait fallu ouvrir les deux pour savoir laquelle on
    // tenait. La dernière version est celle qui vaut, pour lui comme pour son
    // client.
    assert.equal(
      fiche!.pieces.devis.length,
      1,
      `deux versions du même devis font ${fiche!.pieces.devis.length} pièces dans la colonne`
    );
    assert.equal(
      fiche!.pieces.devis[0].id,
      v2.id,
      "la pièce montrée n'est pas la dernière version envoyée"
    );
  });

  await essai("un brouillon, un chantier en cours : rien n'entre dans les colonnes", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai brouillons");
    const client = await creerClient(ctx, { nom: "M. Ledoux" });
    const c = await creerChantier(ctx, { nom: "Devis en cours", clientId: client.id });
    await ajouterLignePrix(ctx, c.id, "Abattage", "1000.00");
    await getOuCreerDevisBrouillon(ctx, c.id);

    const fiche = await chargerFicheClient(ctx, client.id);
    // **Un brouillon n'est pas une pièce.** Le client ne l'a jamais reçu, et son
    // numéro peut encore changer de version : le patron chercherait dans sa
    // colonne un document que personne n'a.
    assert.deepEqual(fiche!.pieces.devis, [], "un devis en brouillon est entré dans la colonne");
    // **Une fiche de chantier n'existe que pour un chantier TERMINÉ.** Elle rend
    // compte de travaux faits : en proposer une ici imprimerait une feuille vide.
    assert.deepEqual(fiche!.pieces.fiches, [], "un chantier non terminé a produit une fiche");
    assert.deepEqual(fiche!.pieces.factures, [], "une facture non émise est entrée dans la colonne");
  });

  await essai("la dernière prestation est la plus récente, et dit ce qu'elle comprend", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai dernière");
    const client = await creerClient(ctx, { nom: "M. Martins" });
    await chantierDate(ctx, client.id, "Taille de haie", [["Taille", "100.00"]], "2024-01-08");
    const recent = await chantierDate(
      ctx, client.id, "Élagage de trois chênes", [["Élagage", "200.00"]], "2026-08-12"
    );
    await ajouterPrestation(ctx, recent.chantierId, "Démontage en tête de chat");
    await ajouterPrestation(ctx, recent.chantierId, "Broyage sur place");

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.equal(
      fiche!.derniere?.nom,
      "Élagage de trois chênes",
      `la dernière prestation lue est « ${fiche!.derniere?.nom} »`
    );
    assert.deepEqual(
      fiche!.derniere?.comprend,
      ["Démontage en tête de chat", "Broyage sur place"],
      "ce qu'elle comprend ne remonte pas, ou pas dans l'ordre saisi"
    );
  });

  await essai("un chantier ouvert ce matin n'est PAS la dernière prestation", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai pas encore fait");
    const client = await creerClient(ctx, { nom: "M. Martins" });
    await chantierDate(ctx, client.id, "Élagage de trois chênes", [["Élagage", "200.00"]], "2026-08-12");
    // Un chantier créé aujourd'hui, sans devis parti ni date posée : il porte la
    // date du jour, mais personne n'y est encore allé.
    const neuf = await creerChantier(ctx, { nom: "Devis à faire", clientId: client.id });
    await ajouterPrestation(ctx, neuf.id, "À chiffrer");

    const fiche = await chargerFicheClient(ctx, client.id);
    // **Trouvé à l'écran, pas à la lecture.** La première version prenait les
    // chantiers « dont la date est passée » : celui du matin même en faisait
    // partie, et l'écran annonçait un travail qui n'avait pas eu lieu.
    assert.equal(
      fiche!.derniere?.nom,
      "Élagage de trois chênes",
      `l'écran annonce « ${fiche!.derniere?.nom} » comme dernière prestation`
    );
  });

  await essai("aucun chantier terminé : pas de dernière prestation du tout", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai rien de fait");
    const client = await creerClient(ctx, { nom: "M. Nouveau" });
    const c = await creerChantier(ctx, { nom: "Premier devis", clientId: client.id });
    await ajouterPrestation(ctx, c.id, "Élagage à chiffrer");

    const fiche = await chargerFicheClient(ctx, client.id);
    // Rien plutôt qu'un titre trompeur : on n'a encore rien fait chez lui.
    assert.equal(fiche!.derniere, null, "un client chez qui rien n'est fait a une « dernière prestation »");
  });

  await essai("les pièces d'une AUTRE entreprise n'apparaissent jamais", async () => {
    await nettoyerBase();
    const a = await monterEntreprise("Entreprise A");
    const b = await monterEntreprise("Entreprise B");
    const clientDeA = await creerClient(a, { nom: "M. Partagé" });
    await chantierFacture(a, clientDeA.id, "Chez A", [["Élagage", "500.00"]]);

    // **L'isolation compte ici plus qu'ailleurs.** Ces colonnes portent des
    // adresses de PDF : une fuite ne donnerait pas seulement un chiffre, elle
    // donnerait le lien pour ouvrir le devis d'un concurrent.
    const vuParB = await chargerFicheClient(b, clientDeA.id);
    assert.equal(vuParB, null, "l'entreprise B voit la fiche d'un client de A");

    const vuParA = await chargerFicheClient(a, clientDeA.id);
    assert.equal(vuParA!.pieces.devis.length, 1, "A ne voit plus son propre devis");
  });

  await essai("un devis non envoyé ne compte pas comme facturé", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai brouillon");
    const client = await creerClient(ctx, { nom: "M. Ledoux" });
    const c = await creerChantier(ctx, { nom: "Devis en cours", clientId: client.id });
    await ajouterLignePrix(ctx, c.id, "Abattage", "1000.00");
    await getOuCreerDevisBrouillon(ctx, c.id);

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.equal(fiche!.chantiers, 1, "le chantier compte, lui");
    assert.equal(fiche!.facture, null, "« 0 € » se lirait comme un mauvais client");
    assert.equal(fiche!.du, null);
  });

  await essai("ce qui reste dû suit les règlements notés", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai paiement");
    const client = await creerClient(ctx, { nom: "Mme Félicie" });
    const { factureId } = await chantierFacture(ctx, client.id, "Élagage", [["Élagage", "500.00"]]);

    // 500 HT → 600 TTC. Un acompte de 200 laisse 400.
    const r = await noterPaiement(ctx, factureId, { date: "2099-01-01", montant: "200.00" });
    assert.equal(r.ok, true, `le règlement a été refusé : ${JSON.stringify(r)}`);

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.equal(fiche!.facture, "600.00", "ce qui a été facturé ne bouge pas quand on encaisse");
    assert.equal(fiche!.du, "400.00", "ce qui reste dû doit suivre l'acompte");
  });

  await essai("les prestations qui reviennent sont comptées en chantiers", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai prestations");
    const client = await creerClient(ctx, { nom: "M. Verrier" });
    await chantierFacture(ctx, client.id, "Passage 1", [
      ["Élagage — chêne", "450.00"],
      ["Évacuation des déchets verts", "240.00"],
    ]);
    await chantierFacture(ctx, client.id, "Passage 2", [
      ["Élagage — tilleul", "550.00"],
      ["Évacuation des déchets verts", "240.00"],
    ]);

    const fiche = await chargerFicheClient(ctx, client.id);
    const elagage = fiche!.prestations.find((p) => p.libelle === "Élagage");
    assert.ok(elagage, `« Élagage » manque : ${JSON.stringify(fiche!.prestations)}`);
    assert.equal(elagage.fois, 2, "deux chantiers, donc deux fois");
    assert.equal(elagage.prixMoyen, "500.00", "(450 + 550) ÷ 2");
  });

  await essai("un chantier supprimé ne pèse plus dans ce qu'il a rapporté", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai retrait");
    const client = await creerClient(ctx, { nom: "M. Retiré" });
    await chantierFacture(ctx, client.id, "Gardé", [["Élagage", "500.00"]]);
    const jete = await creerChantier(ctx, { nom: "Jeté", clientId: client.id });
    await supprimerChantier(ctx, jete.id);

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.equal(fiche!.chantiers, 1, "le chantier supprimé compte encore");
    assert.ok(!fiche!.liste.some((c) => c.nom === "Jeté"), "le chantier supprimé s'affiche encore");
  });

  // ── L'isolation, dans les deux sens ───────────────────────────────────────

  await essai("la fiche d'un client d'une AUTRE entreprise n'existe pas", async () => {
    await nettoyerBase();
    const a = await monterEntreprise("Entreprise A");
    const b = await monterEntreprise("Entreprise B");
    const clientDeA = await creerClient(a, { nom: "Client de A" });
    await chantierFacture(a, clientDeA.id, "Chantier de A", [["Élagage", "500.00"]]);

    const vuParA = await chargerFicheClient(a, clientDeA.id);
    assert.ok(vuParA, "A ne voit plus son propre client");

    const vuParB = await chargerFicheClient(b, clientDeA.id);
    assert.equal(vuParB, null, "B lit le chiffre d'affaires d'un client de A");
  });

  await essai("les chantiers d'à côté ne s'ajoutent pas aux siens", async () => {
    await nettoyerBase();
    const a = await monterEntreprise("Entreprise A");
    const b = await monterEntreprise("Entreprise B");
    const clientDeA = await creerClient(a, { nom: "Mme Bracquemont" });
    const clientDeB = await creerClient(b, { nom: "Mme Bracquemont" }); // le même nom, exprès

    await chantierFacture(a, clientDeA.id, "Chez A", [["Élagage", "500.00"]]);
    await chantierFacture(b, clientDeB.id, "Chez B", [["Élagage", "900.00"]]);

    const fiche = await chargerFicheClient(a, clientDeA.id);
    assert.equal(fiche!.chantiers, 1, "un chantier d'une autre entreprise s'est glissé dans la fiche");
    assert.equal(fiche!.facture, "600.00", "500 HT → 600 TTC : le chantier de B ne doit rien y ajouter");
  });

  await essai("un client sans aucun chantier a quand même sa fiche", async () => {
    await nettoyerBase();
    const ctx = await monterEntreprise("Essai vide");
    const client = await creerClient(ctx, { nom: "M. Tout Neuf" });

    const fiche = await chargerFicheClient(ctx, client.id);
    assert.ok(fiche, "une fiche vide vaut mieux qu'une page introuvable");
    assert.equal(fiche.chantiers, 0);
    assert.equal(fiche.facture, null);
    assert.deepEqual(fiche.prestations, []);
    assert.equal(fiche.client.nom, "M. Tout Neuf");
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
