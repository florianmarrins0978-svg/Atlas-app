// LES ACTIONS QUI TOUCHENT AUX MONTANTS SE GARDENT, ET AUCUNE NE S'OUBLIE.
//
// ═══════════════════════════════════════════════════════════════════════════
// **LE DÉFAUT QUE CETTE SUITE FERME** — audit final, 29 août 2026, trouvé
// **deux fois indépendamment**, ce qui est la meilleure raison de le croire.
//
// `GardeAcces` est un composant de `layout.tsx` : il ne s'exécute qu'au RENDU
// d'un écran. Une action serveur, elle, s'exécute AVANT tout rendu. Et le
// middleware ne vérifie que la session, jamais le rôle.
//
// Entre les deux il n'y avait rien — alors que `GardeAcces.tsx` affirme :
// *« Les Server Actions, de même, gardent leur exigerProprietaire »*. Vrai des
// réglages, faux de trente-quatre actions qui ouvrent un devis complet,
// calculent une marge, envoient un devis chez un client, émettent une facture
// ou suppriment un client.
//
// Un salarié ne peut pas AFFICHER `/chantiers/…` — mais l'adresse de l'action
// reste postable avec sa session, et les identifiants d'actions se lisent dans
// les fragments servis sous `_next/static`, que le `matcher` exclut. Les effets,
// eux, ne se défont pas d'une redirection au rendu.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE TIENT, EN DEUX MOITIÉS — et il faut les deux.**
//
//   1. **la garde marche vraiment**, éprouvée en base sous un VRAI salarié :
//      elle refuse lui, et elle laisse passer le patron et le commercial. Sans
//      la seconde partie, on passerait au vert en fermant la porte à tout le
//      monde ;
//   2. **aucune action ne l'oublie**, relevé dans les fichiers eux-mêmes. C'est
//      la moitié qui vaut dans six mois : la première prouve le mécanisme, la
//      seconde empêche la prochaine action de naître sans lui.

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { donnerUnAcces, listerAcces } from "../src/server/repositories/membres-entreprise";
import {
  exigerMontants,
  exigerEcran,
  exigerChantierDansSaPortee,
  ActionRefuseeError,
} from "../src/server/garde-action";
import { changerLaPortee } from "../src/server/repositories/membres-entreprise";
import { creerChantier } from "../src/server/repositories/chantiers";
import { nommerEquipe } from "../src/server/repositories/equipes";
import { pool } from "../src/server/db/client";
import type { Ctx } from "../src/server/repositories/context";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/**
 * Les fichiers d'actions qui touchent aux MONTANTS.
 *
 * **Le critère n'est pas « ce qui est sensible » mais `docs/QUESTIONS.md` §10**,
 * cité en tête d'`acces-roles.ts` : *« Les montants ne doivent pas sortir du
 * serveur pour qui n'a pas le droit de les voir — ni dans la page, ni dans le
 * PDF, ni dans une réponse d'API. »* Ces six fichiers-là lisent, écrivent ou
 * font sortir un prix, un total, une facture ou un paiement.
 *
 * **Ce que cette liste ne couvre PAS, et il faut le dire** : les autres
 * fichiers d'actions du dépôt — planning, photos, notes vocales, paysage,
 * informations — n'ont pas non plus de garde de rôle. Ils ne font pas sortir de
 * montant, donc ils ne relèvent pas de la règle ci-dessus ; mais plusieurs
 * écrivent, et le sujet reste ouvert (voir le rapport d'audit). Prétendre les
 * couvrir ici rendrait cette suite verte sur une promesse qu'elle ne tient pas.
 */
const FICHIERS_A_MONTANTS = [
  "src/app/chantiers/[id]/prix/actions.ts",
  "src/app/chantiers/[id]/devis-complet/actions.ts",
  "src/app/chantiers/[id]/facture/actions.ts",
  "src/app/chantiers/[id]/export/actions.ts",
  "src/app/clients/[id]/actions.ts",
  "src/app/termines/tva/actions.ts",
];

/**
 * Les gardes qui comptent — n'importe laquelle suffit.
 *
 * **`peutUtiliserLAssistant` en fait partie, et ce n'est pas une complaisance.**
 * Trouvé par ce contrôle lui-même, à sa première exécution élargie :
 * `appliquerPropositionsAction` était dénoncée comme nue alors qu'elle porte une
 * garde **plus stricte** que `exigerEcran` — l'assistant est fermé à tous sauf
 * au patron. Lui ajouter une seconde garde aurait mis deux règles pour une
 * porte, et c'est ce que `CLAUDE.md` §3 interdit.
 *
 * Elle est rendue en valeur de retour plutôt que levée, d'où le motif sur le nom
 * de la fonction et non sur un `exiger…`.
 */
const GARDES = [
  "exigerMontants(",
  "exigerEcran(",
  "exigerProprietaire(",
  "exigerPreuveRecente(",
  "peutUtiliserLAssistant(",
];

/**
 * Les fichiers d'actions dont l'ÉCRAN est fermé au salarié.
 *
 * **Ils n'étaient gardés par rien** — lot de clôture, 29 août 2026. Un écran
 * fermé ne ferme pas l'action : `GardeAcces` ne s'exécute qu'au rendu, et
 * l'adresse de l'action reste postable avec une session valide.
 *
 * Ce qui s'y trouvait de plus grave : quatre suppressions **DURES** — une
 * prestation, une ligne de matériel, une note vocale, un passage d'entretien.
 * Un `DELETE` en base, pas un `deletedAt` : rien ne les défait, et aucun écran
 * ne les restaure.
 *
 * **`/planning` n'est PAS dans cette liste, et c'est délibéré.** C'est l'écran
 * du salarié, ses actions lui sont ouvertes, et la question « peut-il supprimer
 * un chantier ? » revient au patron — elle n'a jamais été posée. La trancher
 * ici serait décider à sa place.
 */
const ECRANS_FERMES_AU_SALARIE = [
  "src/app/chantiers/[id]/informations/actions.ts",
  "src/app/chantiers/[id]/note-vocale/actions.ts",
  "src/app/chantiers/[id]/transcription/actions.ts",
  "src/app/chantiers/[id]/coordonnees/actions.ts",
  "src/app/chantiers/nouveau/actions.ts",
  "src/app/actions.ts",
  "src/app/paysage/fiche/actions.ts",
  "src/app/paysage/diagnostic/actions.ts",
  "src/app/paysage/arrosage/actions.ts",
];

/**
 * Les exports qui n'ont délibérément pas de garde, avec leur raison.
 *
 * Vide aujourd'hui, et l'entrée reste là exprès : le jour où une action de ces
 * fichiers devra s'ouvrir plus largement, sa raison s'écrit ICI plutôt que de
 * disparaître dans un `// eslint-disable` que personne ne relit.
 */
const EXEMPTIONS: Record<string, string> = {};

/** Les fonctions exportées d'un fichier d'actions, et le corps de chacune. */
function actionsDe(chemin: string): Array<{ nom: string; corps: string }> {
  const source = readFileSync(chemin, "utf8");
  const lignes = source.split("\n");
  const trouvees: Array<{ nom: string; corps: string }> = [];
  for (let i = 0; i < lignes.length; i++) {
    const m = /^export async function (\w+)/.exec(lignes[i]);
    if (!m) continue;
    // Jusqu'à la prochaine fonction exportée : le corps entier, gardes comprises.
    let j = i + 1;
    while (j < lignes.length && !/^export async function /.test(lignes[j])) j++;
    trouvees.push({ nom: m[1], corps: lignes.slice(i, j).join("\n") });
  }
  return trouvees;
}

async function main() {
  console.log("=== Les actions qui touchent aux montants ===\n");

  // ─── MOITIÉ 1 : LA GARDE REFUSE-T-ELLE VRAIMENT ? ─────────────────────────
  await nettoyerBase();
  const a = await creerEntreprise(
    { nom: "Chez A" },
    { email: "patron-garde@essai.local", nom: "Patron" }
  );
  const ctxPatron: Ctx = { utilisateurId: a.utilisateurId, entrepriseId: a.entreprise.id };

  await donnerUnAcces(ctxPatron, {
    nom: "Salarié Essai",
    email: "salarie-garde@essai.local",
    motDePasse: "mot-de-passe-assez-long-1234",
    confirmation: "mot-de-passe-assez-long-1234",
    role: "salarie",
  });
  await donnerUnAcces(ctxPatron, {
    nom: "Commercial Essai",
    email: "commercial-garde@essai.local",
    motDePasse: "mot-de-passe-assez-long-1234",
    confirmation: "mot-de-passe-assez-long-1234",
    role: "commercial",
  });

  const membres = await listerAcces(ctxPatron);
  const salarie = membres.find((m) => m.role === "salarie");
  const commercial = membres.find((m) => m.role === "commercial");

  await essai("les comptes d'essai existent — sinon rien n'est éprouvé", () => {
    assert.ok(salarie, "le salarié n'a pas été créé : la suite ne mesurerait rien");
    assert.ok(commercial, "le commercial n'a pas été créé");
  });

  await essai("LE SALARIÉ est refusé — c'est tout l'objet de la garde", async () => {
    // **`utilisateurId`, pas `id`.** `listerAcces` rend les deux : `id` est
    // celui de l'ADHÉSION, `utilisateurId` celui de la personne. Se tromper ici
    // faisait échouer la garde pour la mauvaise raison — « pas membre » au lieu
    // de « pas le droit » —, et le contrôle aurait été vert sur un malentendu.
    const ctx: Ctx = { utilisateurId: salarie!.utilisateurId, entrepriseId: a.entreprise.id };
    await assert.rejects(
      () => exigerMontants(ctx, "ouvrir le devis"),
      (e: unknown) => e instanceof ActionRefuseeError,
      "un salarié a franchi la garde : il peut donc lire les marges du patron"
    );
  });

  await essai("le PATRON passe — sinon on a fermé la porte à tout le monde", async () => {
    await exigerMontants(ctxPatron, "ouvrir le devis");
  });

  await essai("le COMMERCIAL passe aussi — « il en a besoin pour vendre »", async () => {
    const ctx: Ctx = { utilisateurId: commercial!.utilisateurId, entrepriseId: a.entreprise.id };
    await exigerMontants(ctx, "ouvrir le devis");
  });

  await essai("un compte ÉTRANGER à l'entreprise est refusé, une couche plus bas", async () => {
    // **Le refus n'est PAS `ActionRefuseeError` ici, et c'est correct.**
    // Éprouvé le 29 août 2026 : `getRole` passe par `withEntreprise`, qui LÈVE
    // « n'est pas membre » avant même qu'un rôle soit lu. La garde n'a donc
    // jamais l'occasion de rendre son propre refus.
    //
    // Ce qui compte n'est pas la classe de l'exception mais qu'elle EXISTE :
    // le doute se tranche du côté fermé, à deux étages plutôt qu'un. On
    // l'écrit plutôt que d'assouplir l'assertion en silence — un contrôle qui
    // accepte n'importe quelle erreur finit par accepter une panne.
    const b = await creerEntreprise(
      { nom: "Chez B" },
      { email: "patron-b-garde@essai.local", nom: "Patron B" }
    );
    const intrus: Ctx = { utilisateurId: b.utilisateurId, entrepriseId: a.entreprise.id };
    await assert.rejects(
      () => exigerMontants(intrus, "ouvrir le devis"),
      (e: unknown) => e instanceof Error && /n'est pas membre/.test(e.message),
      "un compte d'une AUTRE entreprise a franchi la garde"
    );
  });

  // ─── MOITIÉ 2 : AUCUNE ACTION NE L'OUBLIE ─────────────────────────────────
  await essai("les fichiers d'actions à montants existent tous", () => {
    // Un chemin périmé rendrait tous les contrôles suivants verts sur rien —
    // le garde-fou de `CLAUDE.md` §5.
    for (const f of FICHIERS_A_MONTANTS) {
      assert.ok(existsSync(join(process.cwd(), f)), `${f} n'existe plus : la liste est périmée`);
    }
  });

  await essai("CHAQUE action à montants porte une garde de rôle", () => {
    const nues: string[] = [];
    let comptees = 0;
    for (const f of FICHIERS_A_MONTANTS) {
      for (const { nom, corps } of actionsDe(join(process.cwd(), f))) {
        comptees++;
        if (`${f}#${nom}` in EXEMPTIONS) continue;
        if (!GARDES.some((g) => corps.includes(g))) nues.push(`${f}#${nom}`);
      }
    }
    // Refuser de conclure sur rien : si la lecture des fichiers casse un jour,
    // `comptees` vaudrait 0 et ce contrôle passerait sans avoir rien regardé.
    assert.ok(comptees >= 30, `seulement ${comptees} action(s) relevée(s) : la lecture a échoué`);
    assert.deepEqual(
      nues,
      [],
      `Ces actions font sortir ou modifient un montant sans garde de rôle :\n      ${nues.join("\n      ")}\n` +
        "    Un salarié peut les poster avec sa session : GardeAcces ne s'exécute qu'au RENDU,\n" +
        "    et le middleware ne regarde que la session. Ajouter en première ligne :\n" +
        "      await exigerMontants(ctx, \"ce que fait l'action\");\n" +
        "    Si l'ouverture est délibérée, l'écrire dans EXEMPTIONS avec sa raison."
    );
  });

  await essai("chaque exemption désigne une action qui existe encore", () => {
    for (const [cle, pourquoi] of Object.entries(EXEMPTIONS)) {
      const [f, nom] = cle.split("#");
      assert.ok(
        actionsDe(join(process.cwd(), f)).some((a) => a.nom === nom),
        `${cle} n'existe plus : son exemption est périmée et couvrirait une homonyme future`
      );
      assert.ok(pourquoi.length > 40, `${cle} : l'exemption n'explique pas ce qu'elle coûte`);
    }
  });

  // ─── MOITIÉ 3 : LES ÉCRANS FERMÉS AU SALARIÉ ─────────────────────────────
  await essai("la garde d'ÉCRAN refuse un salarié sur un écran qui lui est fermé", async () => {
    const ctx: Ctx = { utilisateurId: salarie!.utilisateurId, entrepriseId: a.entreprise.id };
    await assert.rejects(
      () => exigerEcran(ctx, "/chantiers", "supprimer une prestation"),
      (e: unknown) => e instanceof ActionRefuseeError,
      "un salarié franchit la garde d'écran : il peut donc effacer une prestation pour de bon"
    );
  });

  await essai("la même garde LAISSE PASSER le salarié sur SON écran", async () => {
    // Sans cette moitié, on aurait fermé au salarié jusqu'à son propre planning.
    const ctx: Ctx = { utilisateurId: salarie!.utilisateurId, entrepriseId: a.entreprise.id };
    await exigerEcran(ctx, "/planning", "déplacer un chantier");
  });

  await essai("le commercial passe sur /chantiers, le patron aussi", async () => {
    const c: Ctx = { utilisateurId: commercial!.utilisateurId, entrepriseId: a.entreprise.id };
    await exigerEcran(c, "/chantiers", "supprimer une prestation");
    await exigerEcran(ctxPatron, "/chantiers", "supprimer une prestation");
  });

  await essai("CHAQUE action d'un écran fermé au salarié porte une garde", () => {
    const nues: string[] = [];
    let comptees = 0;
    for (const f of ECRANS_FERMES_AU_SALARIE) {
      assert.ok(existsSync(join(process.cwd(), f)), `${f} n'existe plus : la liste est périmée`);
      for (const { nom, corps } of actionsDe(join(process.cwd(), f))) {
        comptees++;
        if (`${f}#${nom}` in EXEMPTIONS) continue;
        if (!GARDES.some((g) => corps.includes(g))) nues.push(`${f}#${nom}`);
      }
    }
    assert.ok(comptees >= 30, `seulement ${comptees} action(s) relevée(s) : la lecture a échoué`);
    assert.deepEqual(
      nues,
      [],
      `Ces actions vivent sur un écran fermé au salarié, sans garde :\n      ${nues.join("\n      ")}\n` +
        "    L'écran ne les protège pas : GardeAcces ne s'exécute qu'au RENDU, et l'adresse de\n" +
        "    l'action reste postable. Ajouter en première ligne :\n" +
        "      await exigerEcran(ctx, \"/chantiers\", \"ce que fait l'action\");"
    );
  });

  // ─── MOITIÉ 4 : LA PORTÉE DU PLANNING S'APPLIQUE AUX ÉCRITURES ───────────
  //
  // Le patron a tranché le 13 août 2026 : « le patron choisira s'il a accès
  // qu'à ses chantiers ou à tout ». Le tamis existait — au CHARGEMENT
  // seulement. Un salarié resserré ne VOYAIT pas les autres chantiers, et
  // pouvait pourtant les supprimer dès qu'il en connaissait l'identifiant.
  const chantierDuPatron = await creerChantier(ctxPatron, { nom: "Chantier hors portée" });

  await essai("portée « tout » : le salarié passe — c'est le cas par DÉFAUT", async () => {
    // Sans cette moitié, on aurait pu tout fermer et croire l'application sûre :
    // resserrer n'est pas l'état de départ, c'est un geste du patron.
    const ctx: Ctx = { utilisateurId: salarie!.utilisateurId, entrepriseId: a.entreprise.id };
    await exigerChantierDansSaPortee(ctx, chantierDuPatron.id, "déplacer ce chantier");
  });

  await essai("PORTÉE RESSERRÉE : un chantier hors de son équipe est REFUSÉ", async () => {
    // **La valeur de retour se VÉRIFIE.** Premier jet : `changerLaPortee` était
    // appelée à trois arguments au lieu de quatre, elle rendait un refus, et
    // la suite l'ignorait — puis accusait la garde de ne pas refuser. C'est
    // « une erreur interprétée comme un succès », le motif exact que ce lot
    // traque ailleurs, commis ici dans le contrôle lui-même.
    const equipe = await nommerEquipe(ctxPatron, 1, "Équipe A");
    const r = await changerLaPortee(ctxPatron, salarie!.id, "ses_equipes", equipe.id);
    assert.deepEqual(r, { ok: true }, "le resserrement de la portée a été refusé");
    const ctx: Ctx = { utilisateurId: salarie!.utilisateurId, entrepriseId: a.entreprise.id };
    await assert.rejects(
      () => exigerChantierDansSaPortee(ctx, chantierDuPatron.id, "supprimer ce chantier"),
      (e: unknown) => e instanceof ActionRefuseeError,
      "un salarié resserré peut écrire sur un chantier qu'il ne voit même pas"
    );
  });

  await essai("un chantier INCONNU est refusé, même resserré sur une équipe", async () => {
    // L'inverse rendrait le resserrement silencieusement inopérant, et le
    // patron croirait avoir restreint (migration 0065).
    const ctx: Ctx = { utilisateurId: salarie!.utilisateurId, entrepriseId: a.entreprise.id };
    await assert.rejects(
      () => exigerChantierDansSaPortee(ctx, "00000000-0000-0000-0000-000000000000", "déplacer"),
      (e: unknown) => e instanceof ActionRefuseeError
    );
  });

  await essai("le PATRON n'est jamais borné par une portée", async () => {
    await exigerChantierDansSaPortee(ctxPatron, chantierDuPatron.id, "supprimer ce chantier");
  });

  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Actions gardées — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("❌ Suite interrompue :", e instanceof Error ? e.message : e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
