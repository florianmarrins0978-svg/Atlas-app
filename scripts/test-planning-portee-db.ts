// CE QU'UN SALARIÉ VOIT DU PLANNING — et le tamis est posé au SERVEUR.
//
// **Sa règle du 13 août 2026 :** *« Accès à tout, mais le patron choisira s'il a
// accès qu'à ses chantiers ou à tout. »* Un réglage par PERSONNE : deux salariés
// peuvent ne pas voir le même planning.
//
// **Pourquoi une suite BASE et pas une suite navigateur.** Filtrer au navigateur
// laisserait la liste entière descendre dans la page : les noms de clients, les
// adresses et les pense-bêtes de tous les chantiers seraient là, sous les yeux
// de qui sait regarder. C'est exactement ce que `docs/QUESTIONS.md` §10 refuse
// pour les montants — *« ne doivent pas SORTIR DU SERVEUR »* —, et une suite
// navigateur ne saurait pas distinguer « pas affiché » de « pas envoyé ».
//
// **Le contrôle qui compte le plus est celui du milieu** : une portée resserrée
// SANS équipe rattachée ne montre RIEN, jamais tout. L'inverse rendrait le
// resserrement silencieusement inopérant, et le patron croirait avoir restreint.

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { membresEntreprise } from "../src/server/db/schema";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier, planifierChantier, basculerEquipeDuChantier } from "../src/server/repositories/chantiers";
import { mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import { listerEquipes, nommerEquipe } from "../src/server/repositories/equipes";
import { donnerUnAcces, listerAcces, changerLaPortee } from "../src/server/repositories/membres-entreprise";
import { contextePlanning } from "../src/server/contexte-planning";
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

/** Un jour à venir, pour que le chantier tombe dans la fenêtre du planning. */
function dansHuitJours(): string {
  const d = new Date();
  d.setDate(d.getDate() + 8);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("=== Ce qu'un salarié voit du planning ===\n");

  await nettoyerBase();

  const a = await creerEntreprise({ nom: "Chez A" }, { email: "patron@essai.local", nom: "Le patron" });
  const ctxPatron: Ctx = { utilisateurId: a.utilisateurId, entrepriseId: a.entreprise.id };

  // Deux files du planning, et un chantier posé sur chacune.
  await mettreAJourEntreprise(ctxPatron, { nombreEquipes: 2 });
  await nommerEquipe(ctxPatron, 1, "Malik");
  await nommerEquipe(ctxPatron, 2, "Sofia");

  const jour = dansHuitJours();
  const chezDupont = await creerChantier(ctxPatron, { nom: "Chantier Dupont" });
  const chezLeroy = await creerChantier(ctxPatron, { nom: "Chantier Leroy" });
  await planifierChantier(ctxPatron, chezDupont.id, jour);
  await planifierChantier(ctxPatron, chezLeroy.id, jour);
  await basculerEquipeDuChantier(ctxPatron, chezDupont.id, "matin", 1);
  await basculerEquipeDuChantier(ctxPatron, chezLeroy.id, "matin", 2);

  await donnerUnAcces(ctxPatron, {
    nom: "Malik Benali",
    email: "malik@essai.local",
    motDePasse: "trois-mots-courts",
      confirmation: "trois-mots-courts",
    role: "salarie",
  });
  const malik = (await listerAcces(ctxPatron)).find((l) => l.email === "malik@essai.local")!;
  const ctxMalik: Ctx = { utilisateurId: malik.utilisateurId, entrepriseId: a.entreprise.id };

  const maintenant = new Date();
  const nomsVus = async (ctx: Ctx) =>
    (await contextePlanning(ctx, maintenant)).chantiers.map((c) => c.nom).sort();

  await essai("les deux chantiers sont bien là — sans quoi ce qui suit ne mesure rien", async () => {
    // Un contrôle qui compare deux listes vides rend un vert qui ne prouve rien
    // (`CLAUDE.md` §5 : « un contrôle qui mesure ZÉRO ne mesure rien »).
    assert.deepEqual(await nomsVus(ctxPatron), ["Chantier Dupont", "Chantier Leroy"]);
  });

  await essai("le défaut est « tout » : un salarié voit le planning entier", async () => {
    // Restreindre est un geste, pas un état de départ (sa décision du 13 août).
    assert.deepEqual(await nomsVus(ctxMalik), ["Chantier Dupont", "Chantier Leroy"]);
  });

  await essai("resserré sur son équipe, il ne voit que SES chantiers", async () => {
    const rang1 = (await listerEquipes(ctxPatron)).find((e) => e.rang === 1)!;

    assert.deepEqual(await changerLaPortee(ctxPatron, malik.id, "ses_equipes", rang1.id), { ok: true });
    assert.deepEqual(await nomsVus(ctxMalik), ["Chantier Dupont"]);
    // Et le patron, lui, n'a rien perdu : la portée est PAR PERSONNE.
    assert.deepEqual(await nomsVus(ctxPatron), ["Chantier Dupont", "Chantier Leroy"]);
  });

  await essai("resserré SANS équipe rattachée, il ne voit RIEN — jamais tout", async () => {
    // L'écran refuse déjà cet état (`refusDeLaPortee`), mais la base peut y
    // arriver autrement : une file du planning supprimée met `equipe_id` à NULL
    // en laissant la portée resserrée (migration 0065). Le chargement doit
    // trancher du côté fermé, sinon la suppression d'une équipe ROUVRIRAIT le
    // planning entier à un salarié restreint, sans un mot.
    // **Écrit par `withEntreprise`, jamais par `db` en direct.** La première
    // version de ce contrôle passait par `db` : sans contexte d'isolation, la
    // RLS a refusé l'écriture — SANS ERREUR, zéro ligne touchée —, et le
    // contrôle a rougi en accusant le chargement du planning, qui n'y était pour
    // rien. C'est le piège que `CLAUDE.md` §3 nomme, rencontré dans un test.
    await withEntreprise(ctxPatron.utilisateurId, ctxPatron.entrepriseId, (tx) =>
      tx.update(membresEntreprise).set({ equipeId: null }).where(eq(membresEntreprise.id, malik.id))
    );

    assert.deepEqual(await nomsVus(ctxMalik), []);
  });

  await essai("rendu à « tout », il revoit le planning entier", async () => {
    assert.deepEqual(await changerLaPortee(ctxPatron, malik.id, "tout", null), { ok: true });
    assert.deepEqual(await nomsVus(ctxMalik), ["Chantier Dupont", "Chantier Leroy"]);
  });

  console.log("");
  console.log(`Ce qu'un salarié voit du planning — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
