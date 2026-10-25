// CE QU'UN RÔLE NE PEUT PAS FAIRE, MÊME EN ÉCRIVANT SA REQUÊTE À LA MAIN.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Audit du 25 octobre 2026, vague 2.** Le cloisonnement ENTRE entreprises
// tenait ; les failles étaient DANS une entreprise. Une action serveur
// s'appelle directement par son identifiant, avec n'importe quel objet : ce que
// l'écran n'affiche pas ne protège rien.
//
//   · E2 : un commercial réécrivait l'identité et l'IBAN par le devis ;
//   · E3 : un salarié posait une remise sur n'importe quel devis ;
//   · E4 : « durée et équipe » écrivait n'importe quelle colonne du chantier ;
//   · E7 : client du devis et lignes de prix acceptaient des champs en trop.
//
// Chaque cas appelle la VRAIE action, sous le VRAI rôle, avec la requête qu'un
// attaquant écrirait, puis regarde la base : un refus annoncé ne prouve rien si
// la ligne a bougé.
//
// Éprouvée SOUS `atlas_app`, comme la production.

import assert from "node:assert/strict";
import { Pool } from "pg";
import { pool } from "../src/server/db/client";
import { nettoyerBase, prouverIdentite } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { donnerUnAcces } from "../src/server/repositories/membres-entreprise";
import { creerChantier } from "../src/server/repositories/chantiers";
import { creerClient } from "../src/server/repositories/clients";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon } from "../src/server/repositories/devis";
import {
  majEmetteurAction,
  appliquerRetouchesAction,
  majClientDuDevisAction,
  majLigneAction,
} from "../src/app/chantiers/[id]/devis-complet/actions";
import { mettreAJourDureeEquipeAction } from "../src/app/chantiers/[id]/informations/actions";
import { mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier as creerChantierPlanning, planifierChantier, basculerEquipeDuChantier } from "../src/server/repositories/chantiers";
import { listerEquipes, nommerEquipe } from "../src/server/repositories/equipes";
import { listerAcces, changerLaPortee } from "../src/server/repositories/membres-entreprise";
import { ouvrirLaFiche } from "../src/server/repositories/fiches-securite";
import { enregistrerLaFicheAction, retirerPhotoDeLaFicheAction } from "../src/app/planning/fiche-securite-actions";
import { GET as feuilleDuChantier } from "../src/app/api/chantiers/[chantierId]/feuille/pdf/route";
import type { Ctx } from "../src/server/repositories/context";

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

/** L'action est appelée ; qu'elle refuse en levant ou en rendant un refus, seule la base tranche. */
async function tenter(fn: () => Promise<unknown>): Promise<void> {
  await fn().catch(() => undefined);
}

const sous = async (utilisateurId: string, sessionId?: string) => {
  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;
  if (sessionId) process.env.AUTH_TEST_SESSION_ID = sessionId;
  else delete process.env.AUTH_TEST_SESSION_ID;
};

const MOT_DE_PASSE = "trois-mots-courts-mais-longs";

/**
 * **Le constat se lit sous un rôle qui traverse la RLS** : sous `atlas_app` et
 * sans contexte, la base ne montre rien, et « rien n'a bougé » serait vrai par
 * construction. Les ACTIONS, elles, tournent sous `atlas_app`.
 */
const temoin = new Pool({
  connectionString: (() => {
    const u = new URL(process.env.ATLAS_BASE_SUPER ?? "postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test");
    u.pathname = new URL(process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL ?? "postgresql://x@localhost/atlas_test").pathname;
    return u.toString();
  })(),
});

async function main() {
  console.log("=== Ce qu'un rôle ne peut pas faire, requête écrite à la main ===\n");
  await nettoyerBase();

  const { entreprise, utilisateurId: patron } = await creerEntreprise(
    { nom: "Jardins du Val" },
    { email: "patron-roles@essai.local", nom: "Patron" }
  );
  const ctx: Ctx = { utilisateurId: patron, entrepriseId: entreprise.id };
  const IBAN = "FR7630001007941234567890185";
  await temoin.query(`UPDATE entreprises SET iban = $1 WHERE id = $2`, [IBAN, entreprise.id]);

  const membre = async (role: "commercial" | "salarie" | "facturation", email: string) => {
    const r = await donnerUnAcces(ctx, { nom: role, email, motDePasse: MOT_DE_PASSE, confirmation: MOT_DE_PASSE, role });
    assert.equal(r.ok, true, `le montage n'a pas créé le ${role}`);
    const { rows } = await temoin.query(`SELECT id FROM users WHERE email = $1`, [email]);
    return rows[0].id as string;
  };
  const commercial = await membre("commercial", "commercial-roles@essai.local");
  const salarie = await membre("salarie", "salarie-roles@essai.local");

  const client = await creerClient(ctx, { nom: "Mme Martin" });
  const chantier = await creerChantier(ctx, { nom: "Taille de haie", clientId: client.id });
  const autre = await creerChantier(ctx, { nom: "Autre chantier", clientId: client.id });
  await ajouterLignePrix(ctx, chantier.id, "Taille", "300.00", { quantite: "1", prixUnitaire: "300.00" });
  const devis = await getOuCreerDevisBrouillon(ctx, chantier.id);
  const { rows: lignes } = await temoin.query(`SELECT id FROM lignes_prix WHERE chantier_id = $1`, [chantier.id]);
  const ligneId = lignes[0].id as string;

  const lire = async (sql: string, ...v: unknown[]) => (await temoin.query(sql, v)).rows[0];
  const ibanEnBase = async () => (await lire(`SELECT iban FROM entreprises WHERE id = $1`, entreprise.id))?.iban;

  // ─── E2 : l'identité et l'IBAN ─────────────────────────────────────────────

  await essai("E2 : un COMMERCIAL ne change pas l'IBAN par le devis, même avec SA preuve d'identité", async () => {
    await sous(commercial, await prouverIdentite(commercial));
    await tenter(() => majEmetteurAction({ iban: "FR1420041010050500013M02606" }));
    assert.equal(await ibanEnBase(), IBAN, "L'IBAN DE L'ENTREPRISE A ÉTÉ CHANGÉ PAR UN COMMERCIAL");
  });

  await essai("E2 : un COMMERCIAL ne change pas le nom de l'entreprise par le devis", async () => {
    await sous(commercial);
    await tenter(() => majEmetteurAction({ nom: "Autre société" }));
    assert.equal((await lire(`SELECT nom FROM entreprises WHERE id = $1`, entreprise.id)).nom, "Jardins du Val");
  });

  await essai("E2 : un champ que l'écran n'envoie jamais (régime de TVA) ne passe pas, même pour le patron", async () => {
    await sous(patron, await prouverIdentite(patron));
    await tenter(() => majEmetteurAction({ regimeTva: "franchise" } as never));
    assert.equal((await lire(`SELECT regime_tva FROM entreprises WHERE id = $1`, entreprise.id)).regime_tva, "assujettie");
  });

  await essai("E2 : le PATRON change toujours l'en-tête de son devis", async () => {
    await sous(patron);
    await majEmetteurAction({ telephone: "06 11 22 33 44" });
    assert.equal((await lire(`SELECT telephone FROM entreprises WHERE id = $1`, entreprise.id)).telephone, "06 11 22 33 44");
  });

  // ─── E3 : la remise ────────────────────────────────────────────────────────

  await essai("E3 : un SALARIÉ ne pose pas de remise sur le devis", async () => {
    await sous(salarie);
    await tenter(() => appliquerRetouchesAction(chantier.id, [{ type: "reduction", pourcent: "100" } as never]));
    const r = await lire(`SELECT reduction_pourcent FROM devis WHERE id = $1`, devis.id);
    assert.equal(r.reduction_pourcent, null, `remise posée par un salarié : ${r.reduction_pourcent} %`);
  });

  // ─── E4 : durée et équipe ──────────────────────────────────────────────────

  await essai("E4 : « durée et équipe » n'écrit QUE la durée et l'équipe", async () => {
    await sous(commercial);
    await tenter(() =>
      mettreAJourDureeEquipeAction(chantier.id, {
        dureePrevue: "2",
        autoliquidation: true,
        datePlanifiee: "2026-11-02",
        termineAt: new Date(),
      } as never)
    );
    const c = await lire(`SELECT autoliquidation, date_planifiee, termine_at FROM chantiers WHERE id = $1`, chantier.id);
    assert.equal(c.autoliquidation, false, "l'autoliquidation a été posée par la porte de la durée");
    assert.equal(c.date_planifiee, null, "le chantier a été planifié par la porte de la durée");
    assert.equal(c.termine_at, null, "le chantier a été clos par la porte de la durée");
  });

  // ─── E7 : champs en trop ───────────────────────────────────────────────────

  await essai("E7 : le client du devis n'accepte pas une date d'effacement", async () => {
    await sous(commercial);
    await tenter(() => majClientDuDevisAction(client.id, { telephone: "06 00 00 00 01", deletedAt: new Date() } as never));
    assert.equal((await lire(`SELECT deleted_at FROM clients WHERE id = $1`, client.id)).deleted_at, null, "le client a été effacé par la porte du devis");
  });

  await essai("E7 : une ligne de prix ne se déplace pas vers un autre chantier", async () => {
    await sous(commercial);
    await tenter(() => majLigneAction(ligneId, { libelle: "Taille soignée", chantierId: autre.id } as never));
    assert.equal((await lire(`SELECT chantier_id FROM lignes_prix WHERE id = $1`, ligneId)).chantier_id, chantier.id, "la ligne a changé de chantier");
  });

  // ─── E5 et E6 : un salarié réglé sur SON équipe ───────────────────────────

  await sous(patron);
  await mettreAJourEntreprise(ctx, { nombreEquipes: 2 });
  await nommerEquipe(ctx, 1, "Malik");
  await nommerEquipe(ctx, 2, "Sofia");
  const jour = new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10);
  const sien = await creerChantierPlanning(ctx, { nom: "Chantier de son équipe", clientId: client.id });
  const horsPortee = await creerChantierPlanning(ctx, { nom: "Chantier d'une autre équipe", clientId: client.id });
  await planifierChantier(ctx, sien.id, jour);
  await planifierChantier(ctx, horsPortee.id, jour);
  await basculerEquipeDuChantier(ctx, sien.id, "matin", 1);
  await basculerEquipeDuChantier(ctx, horsPortee.id, "matin", 2);
  await ajouterLignePrix(ctx, horsPortee.id, "Élagage", "500.00", { quantite: "1", prixUnitaire: "500.00" });
  await getOuCreerDevisBrouillon(ctx, horsPortee.id);
  const rang1 = (await listerEquipes(ctx)).find((e) => e.rang === 1)!;
  const acces = (await listerAcces(ctx)).find((l) => l.utilisateurId === salarie)!;
  assert.deepEqual(await changerLaPortee(ctx, acces.id, "ses_equipes", rang1.id), { ok: true });

  await essai("E5 : la feuille d'un chantier HORS de sa portée ne s'ouvre pas au salarié", async () => {
    await sous(salarie);
    const r = await feuilleDuChantier(new Request("http://essai.local/"), { params: Promise.resolve({ chantierId: horsPortee.id }) });
    assert.notEqual(r.status, 200, "le salarié a reçu la feuille d'un chantier qui n'est pas le sien");
  });

  await essai("E5 : la même feuille s'ouvre au patron (sinon le refus ne prouve rien)", async () => {
    await sous(patron);
    const r = await feuilleDuChantier(new Request("http://essai.local/"), { params: Promise.resolve({ chantierId: horsPortee.id }) });
    assert.equal(r.status, 200, `le patron n'a pas reçu la feuille : ${r.status}`);
  });

  await essai("E6 : la photo d'un chantier hors de sa portée ne s'efface pas par SA fiche", async () => {
    const { rows } = await temoin.query(
      `INSERT INTO photos (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum)
       VALUES ($1, $2, 'essai/photo-hors-portee.jpg', 'image/jpeg', 10, 'x') RETURNING id`,
      [entreprise.id, horsPortee.id]
    );
    const photoHorsPortee = rows[0].id as string;
    await sous(salarie);
    const fiche = await ouvrirLaFiche({ utilisateurId: salarie, entrepriseId: entreprise.id }, sien.id);
    await tenter(() =>
      enregistrerLaFicheAction(sien.id, {
        contenu: { ...fiche.contenu, photoIds: [photoHorsPortee] },
        etapeVue: 1,
        loiLue: false,
        rafraichirLesEcrans: false,
      })
    );
    await tenter(() => retirerPhotoDeLaFicheAction(sien.id, photoHorsPortee));
    const p = await lire(`SELECT deleted_at FROM photos WHERE id = $1`, photoHorsPortee);
    assert.equal(p.deleted_at, null, "LA PHOTO D'UN AUTRE CHANTIER A ÉTÉ EFFACÉE par la fiche du salarié");
  });

  await pool.end();
  await temoin.end();
  console.log(`\nRôles dans l'entreprise — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
