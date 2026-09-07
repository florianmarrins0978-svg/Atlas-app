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
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { donnerUnAcces, listerAcces } from "../src/server/repositories/membres-entreprise";
import {
  exigerMontants,
  exigerEcran,
  exigerEcritureSurLePlanning,
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
 * **TOUT FICHIER « use server » DU DÉPÔT — plus aucune liste tenue à la main.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUE LES DEUX LISTES MANUELLES ONT LAISSÉ PASSER** — 30 août 2026.
 *
 * Cette suite énumérait `FICHIERS_A_MONTANTS` et `ECRANS_FERMES_AU_SALARIE`,
 * deux listes écrites à la main. Toutes deux ne nommaient que des fichiers
 * `actions.ts` — et `src/app/chantiers/[id]/photos-actions.ts` ne s'appelle pas
 * comme ça. Ses deux actions n'avaient AUCUNE garde : un salarié pouvait
 * ajouter une photo à n'importe quel chantier, et en **supprimer** n'importe
 * laquelle (un `DELETE`, pas un `deletedAt`).
 *
 * La suite était verte. Elle ne mentait pas : elle ne regardait pas.
 *
 * **Une liste tenue à la main se tait sur ce qu'on a oublié d'y écrire**, et
 * c'est le pire des silences — il ressemble à un contrôle. Le sens est donc
 * inversé : on relève TOUS les fichiers « use server », et ce qui n'a pas de
 * garde doit s'expliquer **ici**, par écrit.
 *
 * C'est le même choix qu'`acces-roles.ts` fait pour le salarié : liste blanche,
 * pour qu'un fichier neuf soit fermé d'office plutôt qu'ouvert en silence.
 */
function fichiersUseServer(): string[] {
  const trouves: string[] = [];
  const pile = [join(process.cwd(), "src")];
  while (pile.length > 0) {
    const dossier = pile.pop()!;
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, e.name);
      if (e.isDirectory()) {
        pile.push(chemin);
      } else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) {
        // La directive est en TÊTE de fichier : la chercher partout ferait
        // entrer les fichiers qui ne font qu'en PARLER — celui-ci, par exemple.
        const debut = readFileSync(chemin, "utf8").slice(0, 200);
        if (/^\s*(\/\/[^\n]*\n)*\s*["']use server["']/.test(debut)) {
          // **Toujours des barres obliques, quelle que soit la machine.** Sur
          // Windows, `relative` rend « src\app\login\actions.ts » ; les clés
          // d'`EXEMPTIONS` et la liste d'énumération, elles, sont écrites avec
          // des « / ». Aucune exemption ne correspondait donc, et ce contrôle
          // accusait TREIZE actions gardées de ne pas l'être — sur la machine
          // du patron seulement, jamais sur la CI. Une erreur qui désigne le
          // mauvais coupable coûte plus cher que pas d'erreur (`CLAUDE.md` §5).
          trouves.push(relative(process.cwd(), chemin).split(sep).join("/"));
        }
      }
    }
  }
  return trouves.sort();
}

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
 * **`estProprietaire` de même**, relevé le 30 août : les six actions de
 * `paysage/fiche/composer` passent par un `contexteAutorise()` qui rend `null`
 * pour qui n'est pas patron. Plus strict que ce qu'on leur demanderait.
 */
const GARDES = [
  "exigerMontants(",
  "exigerEcran(",
  "exigerEcritureSurLePlanning(",
  // Les deux capacités nées le 30 août 2026 avec le rôle « Facturation ».
  // **Sans elles ici, ce contrôle aurait rougi sur les actions que ce lot
  // vient précisément de mieux garder** — un contrôle qui punit le durcissement
  // pousse à revenir en arrière.
  "exigerGestionDevis(",
  "exigerFacturation(",
  "exigerProprietaire(",
  "exigerPreuveRecente(",
  "peutUtiliserLAssistant(",
  "estProprietaire(",
  // L'éditeur d'Atlas, qui n'est pas un rôle d'entreprise : plus étroit que
  // « patron », puisqu'aucun artisan ne l'est.
  "exigerEditeur(",
];

/**
 * **UNE GARDE PEUT VIVRE DANS UN AIDE LOCAL — et ce n'en est pas moins une.**
 *
 * Relevé le 30 août 2026 par ce contrôle lui-même : les six actions de
 * `paysage/fiche/composer` étaient dénoncées comme nues alors qu'elles ouvrent
 * toutes sur `contexteAutorise()`, quatre lignes plus haut dans le même
 * fichier, qui rend `null` à qui n'est pas patron.
 *
 * **Exiger la garde en toutes lettres dans chaque action aurait été le mauvais
 * correctif** : il aurait fallu écrire deux fois la même règle, et
 * `CLAUDE.md` §3 l'interdit — c'est exactement la duplication qui finit par
 * diverger. Le contrôle suit donc UN niveau d'indirection : un aide du même
 * fichier dont le corps porte une garde en est une.
 *
 * **Un seul niveau, délibérément.** Descendre plus loin obligerait à suivre les
 * imports, et un contrôle qui suit les imports finit par tout accepter.
 */
function porteUneGarde(corps: string, aides: Map<string, string>): boolean {
  if (GARDES.some((g) => corps.includes(g))) return true;
  for (const [nom, corpsAide] of aides) {
    if (corps.includes(`${nom}(`) && GARDES.some((g) => corpsAide.includes(g))) return true;
  }
  return false;
}

/** Les fonctions NON exportées d'un fichier — celles qui peuvent porter la garde. */
function aidesDe(chemin: string): Map<string, string> {
  const source = readFileSync(chemin, "utf8");
  const aides = new Map<string, string>();
  const motif = /^(?:async )?function (\w+)/gm;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(source)) !== null) {
    const suite = source.slice(m.index);
    const fin = suite.indexOf("\n}");
    aides.set(m[1], fin === -1 ? suite : suite.slice(0, fin));
  }
  return aides;
}

/**
 * Les actions qui n'ont délibérément pas de garde de rôle, et **pourquoi**.
 *
 * Trois familles, et aucune quatrième n'est acceptable :
 *
 * | | |
 * |---|---|
 * | **avant la connexion** | il n'y a pas encore de rôle à vérifier |
 * | **public par jeton** | le client d'un artisan n'a pas de compte |
 * | **ses propres réglages** | ils n'écrivent que sur la personne elle-même |
 *
 * S'y ajoute une lecture, nommément.
 *
 * **La raison n'est pas une formalité** : c'est elle qu'on relira le jour où
 * quelqu'un se demandera pourquoi cette action-là est ouverte. Une exemption
 * sans raison est un `// eslint-disable` déguisé.
 */
const EXEMPTIONS: Record<string, string> = {
  // ─── Avant la connexion : aucun rôle n'existe encore ────────────────────
  "src/app/login/actions.ts#connexionAction":
    "C'est l'action qui CRÉE la session. Exiger un rôle avant elle enfermerait tout le monde dehors.",
  "src/app/login/actions.ts#defiConnexionAction":
    "Le défi Face ID se demande avant d'être connecté — c'est ce qui permet de se connecter sans mot de passe.",
  "src/app/login/actions.ts#connexionParCleAction":
    "Même famille : elle ouvre la session par la clé d'appareil, donc elle s'appelle sans session.",
  "src/app/login/actions.ts#deconnexionAction":
    "Se déconnecter est ouvert à qui est connecté, quel que soit son rôle — et refuser reviendrait à retenir les gens dedans.",

  // ─── Public par jeton : le client de l'artisan n'a pas de compte ────────
  "src/app/devis/[jeton]/actions.ts#repondreAction":
    "L'écran du devis s'ouvre par un jeton, sans compte : le client de l'artisan n'a pas de rôle. Le jeton EST la garde (chemins-publics.ts).",
  "src/app/documents-legaux/actions.ts#accepterDocumentsAction":
    "Accepter les documents légaux est la porte d'entrée : la fermer par rôle enfermerait dehors le salarié qui n'a pas encore accepté.",

  // ─── Ses propres réglages : elles n'écrivent que sur la personne ────────
  "src/app/reglages/compte/actions.ts#renommerCompteAction":
    "Écrit le nom de la personne connectée, sur elle seule. « Un salarié peut changer ses notifications ou son mot de passe » (13 août 2026).",
  "src/app/reglages/apparence/actions.ts#choisirCharteAction":
    "La charte de couleurs de la personne connectée. Aucune donnée d'entreprise, aucun autre compte touché.",
  "src/app/reglages/connexion/actions.ts#changerMotDePasseAction":
    "Son propre mot de passe, et il exige l'ancien. Le fermer par rôle interdirait à un salarié de changer le sien.",
  "src/app/reglages/connexion/actions.ts#deconnecterPartoutAction":
    "Ferme SES propres sessions. C'est un geste de sécurité : le refuser à un rôle le laisserait sans recours après un vol de téléphone.",
  "src/app/reglages/connexion/actions.ts#defiEnregistrementAction":
    "Le défi Face ID pour SON appareil, sur sa propre session. Aucune écriture sur l'entreprise.",
  "src/app/reglages/connexion/actions.ts#enregistrerCleAction":
    "Enregistre une clé d'appareil sur son propre compte — et exige déjà une preuve récente pour le geste sensible.",
  "src/app/reglages/connexion/actions.ts#retirerCleAction":
    "Retire une de SES clés. Même raison que « se déconnecter partout » : c'est un geste défensif qui doit rester ouvert.",
  "src/app/reglages/connexion/preuve-actions.ts#prouverParMotDePasseAction":
    "Elle sert à PROUVER qui l'on est ; la garder par rôle mettrait la preuve derrière ce qu'elle doit établir.",
  "src/app/reglages/connexion/preuve-actions.ts#preuveDejaRecenteAction":
    "Une lecture : elle répond oui ou non sur SA propre session, et ne touche rien.",

  // ─── Une lecture, nommément ─────────────────────────────────────────────
  "src/app/planning/actions.ts#tachesDuChantierAction":
    "Elle LIT la feuille de chantier sans un seul montant — le document du salarié, décidé le 21 août 2026. La fermer lui retirerait le seul papier qu'il ait.",
};

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
  //
  // **Plus de liste tenue à la main.** Celle d'avant ne nommait que des
  // `actions.ts`, et `photos-actions.ts` lui a échappé pendant tout un lot.
  const FICHIERS = fichiersUseServer();

  await essai("l'ÉNUMÉRATION trouve les fichiers « use server » — sinon rien n'est mesuré", () => {
    // Refuser de conclure sur zéro (`CLAUDE.md` §5) : si la marche du dossier
    // casse un jour, tous les contrôles ci-dessous passeraient sur une liste
    // vide, en vert, sans avoir rien regardé.
    assert.ok(
      FICHIERS.length >= 30,
      `seulement ${FICHIERS.length} fichier(s) « use server » relevé(s) : la marche a échoué`
    );
    // Le fichier qui a échappé aux listes manuelles : s'il ressort de
    // l'énumération, c'est que le motif ne se limite plus aux `actions.ts`.
    assert.ok(
      FICHIERS.includes("src/app/chantiers/[id]/photos-actions.ts"),
      "photos-actions.ts n'est pas relevé : l'énumération retrouve le trou de la version d'avant"
    );
    assert.ok(FICHIERS.includes("src/app/planning/actions.ts"));
  });

  await essai("CHAQUE action serveur du dépôt porte une garde, ou une raison écrite", () => {
    const nues: string[] = [];
    let comptees = 0;
    for (const f of FICHIERS) {
      const aides = aidesDe(join(process.cwd(), f));
      for (const { nom, corps } of actionsDe(join(process.cwd(), f))) {
        comptees++;
        if (`${f}#${nom}` in EXEMPTIONS) continue;
        if (!porteUneGarde(corps, aides)) nues.push(`${f}#${nom}`);
      }
    }
    assert.ok(comptees >= 100, `seulement ${comptees} action(s) relevée(s) : la lecture a échoué`);
    assert.deepEqual(
      nues,
      [],
      `Ces actions serveur n'ont aucune garde de rôle :\n      ${nues.join("\n      ")}\n` +
        "    L'écran ne les protège pas : GardeAcces ne s'exécute qu'au RENDU, et l'adresse de\n" +
        "    l'action reste postable avec une session valide. Ajouter en première ligne la garde\n" +
        "    qui convient — exigerMontants, exigerEcran, exigerEcritureSurLePlanning…\n" +
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
    // **Et ce n'est PAS en contradiction avec la lecture seule** : `/planning`
    // lui reste ouvert en LECTURE. Ce qui refuse l'écriture est une autre
    // garde, éprouvée dans `test-salarie-planning-lecture-seule-db.ts`.
    const ctx: Ctx = { utilisateurId: salarie!.utilisateurId, entrepriseId: a.entreprise.id };
    await exigerEcran(ctx, "/planning", "ouvrir la feuille d'un chantier");
  });

  await essai("le commercial passe sur /chantiers, le patron aussi", async () => {
    const c: Ctx = { utilisateurId: commercial!.utilisateurId, entrepriseId: a.entreprise.id };
    await exigerEcran(c, "/chantiers", "supprimer une prestation");
    await exigerEcran(ctxPatron, "/chantiers", "supprimer une prestation");
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
