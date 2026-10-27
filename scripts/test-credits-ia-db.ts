// LES CRÉDITS IA, CONTRE UNE VRAIE BASE ET SOUS LE RÔLE DE L'APPLICATION.
//
// **Sa décision du 26 octobre 2026** (audit de sécurité, E13) : un plafond par
// formule, et l'IA coupée quand il est atteint. Cette suite appelle un
// fournisseur PAYANT simulé, passé par le vrai compteur (`compteur.ts`), et
// regarde trois choses : l'appel qui part se compte, l'appel au-delà du plafond
// ne part PAS (le fournisseur n'est jamais appelé), et l'application ne peut
// ni effacer ni faire baisser le compteur.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { avecCompteurLLM, avecCompteurTranscription, pourLeCompteDe } from "../src/server/ai/compteur";
import { creditsIADeLEntreprise, depenseDuMois } from "../src/server/repositories/consommation-ia";
import { MICRO, moisDu } from "../src/lib/credits-ia";
import type { FournisseurLLM } from "../src/server/ai/providers/llm/interface";

// Le montage traverse la RLS (le propriétaire, lui, ne la traverse pas) : il
// pose l'abonnement et la dépense de départ, rien d'autre.
const ADMIN = new Pool({
  connectionString: (() => {
    const u = new URL(process.env.ATLAS_BASE_SUPER ?? "postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test");
    u.pathname = new URL(process.env.DATABASE_URL ?? "postgresql://x@localhost/atlas_test").pathname;
    return u.toString();
  })(),
});

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

async function main() {
  console.log("=== Les crédits IA, contre une vraie base ===\n");
  const marque = Date.now();
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Crédits ${marque}` },
    { email: `credits-${marque}@test.local`, nom: "Patron" }
  );
  const autre = await entreprisesRepo.creerEntreprise({ nom: `Autre ${marque}` }, { email: `autre-${marque}@test.local`, nom: "Autre" });
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const mois = moisDu(new Date());
  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;

  // L'essai : 5 €.
  await ADMIN.query(
    `INSERT INTO abonnements (entreprise_id, formule, periodicite, statut, periode_fin) VALUES ($1, 'illimite', 'mensuelle', 'essai', now() + interval '10 days')`,
    [entreprise.id]
  );
  const poserDepense = (euros: number) =>
    ADMIN.query(
      `INSERT INTO consommation_ia (entreprise_id, mois, microeuros) VALUES ($1, $2, $3)
       ON CONFLICT (entreprise_id, mois) DO UPDATE SET microeuros = EXCLUDED.microeuros`,
      [entreprise.id, mois, Math.round(euros * MICRO)]
    );
  // Le déclencheur refuse de faire baisser, y compris au propriétaire : on repart d'une ligne neuve.
  const remettreAZero = () => ADMIN.query(`DELETE FROM consommation_ia WHERE entreprise_id = $1`, [entreprise.id]);

  let appels = 0;
  const paye: FournisseurLLM = {
    nom: "anthropic",
    async genererTexte() {
      appels++;
      return { succes: true, texte: "x".repeat(3000) };
    },
  };
  const compte = avecCompteurLLM(paye);

  try {
    await essai("sous le plafond, l'appel part et SE COMPTE", async () => {
      await remettreAZero();
      const r = await compte.genererTexte("consigne ".repeat(1000), "dictée");
      assert.equal(r.succes, true);
      assert.equal(appels, 1);
      const depense = await depenseDuMois(ctx, new Date());
      assert.ok(depense > 0, "l'appel n'a rien compté");
      assert.ok(depense < 0.1 * MICRO, `un appel compté ${depense / MICRO} € : l'estimation déraille`);
    });

    await essai("l'essai est plafonné à 5 € : à 4,90 €, la barre dit « presque »", async () => {
      await remettreAZero();
      await poserDepense(4.9);
      const e = await creditsIADeLEntreprise(ctx, new Date());
      assert.deepEqual({ ...e, reprise: undefined }, { plafonne: true, pourcent: 98, etat: "presque", reprise: undefined });
    });

    await essai("au plafond, l'appel est REFUSÉ et le fournisseur n'est JAMAIS appelé", async () => {
      await remettreAZero();
      await poserDepense(5);
      const avant = appels;
      const r = await compte.genererTexte("consigne", "dictée");
      assert.equal(r.succes, false);
      assert.equal(!r.succes && r.erreur.type, "credits_epuises");
      // La phrase que la dictée, l'assistant et la note vocale relaient telle quelle.
      assert.match(!r.succes ? r.erreur.message : "", /^Crédits IA épuisés\. Atlas IA reprend le 1er \S+\. D'ici là, tout s'écrit à la main\.$/);
      assert.equal(appels, avant, "LE FOURNISSEUR A ÉTÉ PAYÉ AU-DELÀ DU PLAFOND");
    });

    await essai("la dictée aussi : au plafond, rien ne part à la transcription", async () => {
      let ecoutes = 0;
      const t = avecCompteurTranscription({ nom: "openai", async transcrire() { ecoutes++; return { succes: true, texte: "x" }; } });
      const r = await t.transcrire(Buffer.alloc(1000), "audio/webm");
      assert.equal(r.succes, false);
      assert.equal(ecoutes, 0);
    });

    await essai("son entreprise, désignée par le réglage de l'espace, n'est jamais coupée", async () => {
      process.env.ATLAS_IA_SANS_PLAFOND = entreprise.id;
      try {
        const r = await compte.genererTexte("consigne", "dictée");
        assert.equal(r.succes, true);
        assert.deepEqual(await creditsIADeLEntreprise(ctx, new Date()), { plafonne: false });
      } finally {
        delete process.env.ATLAS_IA_SANS_PLAFOND;
      }
    });

    await essai("après la réponse (after), l'entreprise posée paie, même sans session", async () => {
      delete process.env.AUTH_TEST_UTILISATEUR_ID;
      try {
        await ADMIN.query(`DELETE FROM consommation_ia WHERE entreprise_id = $1`, [autre.entreprise.id]);
        const ctxAutre = { utilisateurId: autre.utilisateurId, entrepriseId: autre.entreprise.id };
        const r = await pourLeCompteDe(ctxAutre, () => compte.genererTexte("consigne", "dictée"));
        assert.equal(r.succes, true);
        assert.ok((await depenseDuMois(ctxAutre, new Date())) > 0, "la lecture lancée après la réponse n'a pas été comptée");
      } finally {
        process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;
      }
    });

    await essai("l'application ne peut ni effacer ni faire baisser son compteur", async () => {
      await assert.rejects(
        pool.query(`BEGIN; SELECT set_config('app.entreprise_id', $1, true); DELETE FROM consommation_ia; COMMIT;`.replace("$1", `'${entreprise.id}'`)),
        /permission denied/
      );
      await pool.query("ROLLBACK").catch(() => undefined);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entreprise.id]);
        await assert.rejects(c.query(`UPDATE consommation_ia SET microeuros = 0 WHERE entreprise_id = $1`, [entreprise.id]), /ne baisse pas/);
      } finally {
        await c.query("ROLLBACK");
        c.release();
      }
    });

    await essai("une entreprise ne lit pas le compteur d'une autre", async () => {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query(`SELECT set_config('app.entreprise_id', $1, true)`, [autre.entreprise.id]);
        const { rows } = await c.query(`SELECT 1 FROM consommation_ia WHERE entreprise_id = $1`, [entreprise.id]);
        assert.equal(rows.length, 0, "LE COMPTEUR D'UNE AUTRE ENTREPRISE SE LIT");
      } finally {
        await c.query("ROLLBACK");
        c.release();
      }
    });

    await essai("« npm run ia:sans-plafond » désigne SON entreprise par son adresse, et le banc la passe au serveur", async () => {
      const dossier = mkdtempSync(path.join(tmpdir(), "atlas-sans-plafond-"));
      try {
        const lancer = (...args: string[]) =>
          spawnSync(process.execPath, [path.join(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs"), path.join(__dirname, "ia-sans-plafond.ts"), ...args], {
            env: { ...process.env, ATLAS_SECRETS_DIR: dossier, DATABASE_SUPER_URL: ADMIN.options.connectionString },
            encoding: "utf8",
          });
        const r = lancer(`credits-${marque}@test.local`);
        assert.equal(r.status, 0, r.stderr);
        assert.equal(readFileSync(path.join(dossier, "ia-sans-plafond"), "utf8"), entreprise.id);
        assert.equal(lancer("personne@nulle.part").status, 1, "une adresse inconnue n'exempte personne");
        assert.equal(lancer("--retirer").status, 0);
        const banc = readFileSync(path.join(__dirname, "banc.mjs"), "utf8");
        assert.ok(banc.indexOf("ia-sans-plafond") < banc.indexOf("let serveur = "), "le banc ne lit pas le réglage avant de lancer le serveur");
        assert.match(banc, /process\.env\.ATLAS_IA_SANS_PLAFOND\s*=/);
      } finally {
        rmSync(dossier, { recursive: true, force: true });
      }
    });

    await essai("aucun fournisseur payant ne sort des fabriques sans le compteur", async () => {
      for (const f of ["llm/fabrique.ts", "transcription/fabrique.ts"]) {
        const source = readFileSync(path.join(__dirname, "..", "src", "server", "ai", "providers", f), "utf8");
        const nus = source.match(/return fournisseur(LLM|Transcription)(Anthropic|OpenAI|Gemini|Deepgram|Google)\b/g) ?? [];
        assert.deepEqual(nus, [], `${f} rend un fournisseur payant sans compteur`);
      }
    });
  } finally {
    delete process.env.AUTH_TEST_UTILISATEUR_ID;
    for (const id of [entreprise.id, autre.entreprise.id]) {
      await ADMIN.query(`DELETE FROM consommation_ia WHERE entreprise_id = $1`, [id]);
      await ADMIN.query(`DELETE FROM abonnements WHERE entreprise_id = $1`, [id]);
    }
    await ADMIN.end();
    await pool.end();
  }

  console.log(`\nCrédits IA en base — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
