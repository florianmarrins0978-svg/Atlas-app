// Les trois façons de placer le rappel sur l'accueil, PHOTOGRAPHIÉES.
//
// **Sa question du 16 août 2026 :** *« fais-moi la capture des trois cas »* —
// après que l'accueil lui a été décrit : il ne montre que DEUX cartes, et les
// rappels ferment la marche. Avec deux réponses de clients en cours, la sienne
// passe derrière « 1 autre devis à regarder ».
//
// **Pourquoi photographier plutôt que dessiner.** Une maquette dirait ce que je
// crois ; ces trois images disent ce que l'application fait. Le montage pose
// exactement l'état qui l'inquiète — deux réponses de clients ET son rappel —
// puis joue les trois dispositions sur l'écran réel.
//
// **Une image par appel**, le cas étant nommé par `ATLAS_CAS`. Les variantes B
// et C se jouent en changeant vraiment le code entre deux appels
// (`scripts/capture-rang-trois-cas.sh`) : voir plus bas pourquoi le navigateur
// ne peut pas les simuler.
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerChantier } from "../src/server/repositories/chantiers";
import { getOuCreerDevisBrouillon } from "../src/server/repositories/devis";
import { creerEnvoi } from "../src/server/repositories/envois-devis";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-rang-du-rappel.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";
const echecs: string[] = [];

// **La base est remise à neuf avant de poser la scène.** Sans cela, les essais
// des heures précédentes s'accumulent : la première tentative a rendu une image
// à « 72 en cours » et neuf cartes repliées — vraie, mais illisible, et surtout
// pas la situation du patron. Une capture qui exagère fait décider sur du faux
// autant qu'une capture qui ment.
if (process.env.ATLAS_REMETTRE_A_NEUF === "1") {
  await nettoyerBase();
  const { execSync } = await import("node:child_process");
  execSync("npx tsx src/server/db/seed.ts", { stdio: "inherit" });
}

const navigateur = await lancerNavigateur();
const page = await (await navigateur.newContext({ ...devices["iPhone 13"] })).newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

// Le chantier qui dort : ouvert il y a quatorze jours, aucun devis parti.
await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.locator('input[placeholder="Bernard"]').fill("Felicie");
await page.locator('input[placeholder="06 12 34 56 78"]').fill("0679984514");
await page.click('button:has-text("Créer le chantier")');
await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
const chantierId = page.url().split("/").pop()!.split("?")[0];
const vieilli = await pool.query(
  `UPDATE chantiers SET created_at = now() - interval '14 days' WHERE id = $1`,
  [chantierId]
);
if (vieilli.rowCount !== 1) {
  throw new Error("le montage n'a pas pu vieillir le chantier : les trois images seraient fausses");
}

// **La scène minimale où le défaut apparaît : DEUX réponses de clients.**
//
// Mesuré sur le jeu de démonstration seul : avec UNE seule réponse en attente,
// sa carte se voit très bien — elle prend la seconde place. Il en faut deux pour
// la repousser derrière le repli. Le dire autrement serait exagérer le défaut,
// et le faire décider sur du faux.
//
// On ne fabrique donc pas une pile : on ramène l'écran à EXACTEMENT deux
// réponses non vues, et on regarde ce qu'il advient de son rappel.
// D'abord on n'en garde au plus que deux…
await pool.query(
  `WITH deux AS (
     SELECT id FROM envois_devis
      WHERE reponse IS NOT NULL AND vu_par_patron_at IS NULL
      ORDER BY repondu_at DESC LIMIT 2
   )
   UPDATE envois_devis SET vu_par_patron_at = now()
    WHERE reponse IS NOT NULL AND vu_par_patron_at IS NULL AND id NOT IN (SELECT id FROM deux)`
);
// …puis on en complète jusqu'à deux, si le jeu de démonstration n'en donne
// qu'une. Les contraintes de la table exigent la date ET le motif : une
// correction sans précision du client est refusée, et c'est très bien ainsi.
const manque = await pool.query(
  `SELECT count(*)::int AS n FROM envois_devis WHERE reponse IS NOT NULL AND vu_par_patron_at IS NULL`
);
if (manque.rows[0].n < 2) {
  // **Le second devis part par le VRAI chemin**, pas par un `INSERT` à la main :
  // le jeu de démonstration n'en porte qu'un seul, et fabriquer la ligne
  // éprouverait une forme de donnée que l'application ne produit pas.
  const { rows } = await pool.query(
    `SELECT me.utilisateur_id AS utilisateur, me.entreprise_id AS entreprise
       FROM membres_entreprise me
      ORDER BY me.role = 'proprietaire' DESC
      LIMIT 1`
  );
  const ctx = { utilisateurId: rows[0].utilisateur as string, entrepriseId: rows[0].entreprise as string };
  const chantier = await creerChantier(ctx, { nom: "Reprise de toiture" });
  const devis = await getOuCreerDevisBrouillon(ctx, chantier.id);
  const dansTroisMois = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const envoi = await creerEnvoi(ctx, {
    chantierId: chantier.id,
    devisId: devis.id,
    canal: "email",
    datesProposees: [dansTroisMois],
    contenuDevis: "devis reprise de toiture",
  });
  // La réponse du client : la table exige la date ET le motif ensemble.
  await pool.query(
    `UPDATE envois_devis SET reponse = 'correction', repondu_at = now(),
            precision_client = $2
      WHERE id = $1`,
    [envoi.id, "Pouvez-vous retirer l'évacuation des gravats ? Je m'en occupe."]
  );
}
const restantes2 = await pool.query(
  `SELECT count(*)::int AS n FROM envois_devis WHERE reponse IS NOT NULL AND vu_par_patron_at IS NULL`
);
if (restantes2.rows[0].n !== 2) {
  echecs.push(
    `${restantes2.rows[0].n} réponse(s) en attente au lieu de 2 : la scène n'est pas celle ` +
      "qu'on prétend comparer, et les trois images ne diraient rien"
  );
}

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);

/** Combien de cartes l'écran porte en tout, et lesquelles se voient. */
async function etat() {
  return page.evaluate(() => {
    const titres = [...document.querySelectorAll<HTMLElement>('[data-atlas="carte-reponse"]')].map(
      (c) => (c.querySelector("p")?.textContent ?? "").trim()
    );
    const replie = document.body.innerText.match(/(\d+) autres? devis à regarder/);
    return { visibles: titres, repliees: replie ? Number(replie[1]) : 0 };
  });
}

const avant = await etat();
if (avant.visibles.length + avant.repliees < 3) {
  echecs.push(
    `l'accueil ne porte que ${avant.visibles.length + avant.repliees} carte(s) : ` +
      "le cas qui l'inquiète — deux réponses ET son rappel — n'est pas reproduit, " +
      "et les trois images ne compareraient rien"
  );
}

// ── A. Ce qui existe aujourd'hui ───────────────────────────────────────────
await page.screenshot({ path: `${dossier}/${process.env.ATLAS_CAS ?? "A-aujourdhui"}.png` });
const cas = process.env.ATLAS_CAS ?? "A-aujourdhui";
const rappelVisible = avant.visibles.some((t) => /DEVIS EN ATTENTE/i.test(t));
console.log(`${cas} · visibles : ${avant.visibles.join(" | ")} — repliées : ${avant.repliees}`);

// **Chaque image doit montrer ce qu'elle prétend**, et le dire elle-même. Une
// capture qui illustre le mauvais cas est pire qu'une capture absente : elle
// fait décider sur du faux.
if (cas.startsWith("A") && rappelVisible) {
  echecs.push("A prétend que son rappel est caché, et il est visible");
}
if (!cas.startsWith("A") && !rappelVisible) {
  echecs.push(`${cas} prétend montrer son rappel, et il est absent de l'écran`);
}

// **B et C ne se photographient PAS depuis le navigateur.** Les cartes repliées
// ne sont pas rendues du tout — l'écran n'en pose que deux dans le document —,
// donc il n'y a rien à réordonner ni à révéler après coup. La première tentative
// l'a prouvé : le rappel restait absent, et l'image aurait montré B en disant A.
//
// Les deux variantes sont donc jouées en changeant VRAIMENT le code, le temps de
// la photo, par `scripts/capture-rang-trois-cas.sh` qui rappelle ce script. Ce
// que les images montrent est alors le rendu réel de chaque disposition.
await navigateur.close();
await pool.end();

console.log(`image écrite dans ${dossier}/${cas}.png`);

if (echecs.length > 0) {
  console.error(`\n❌ ${echecs.length} défaut(s) :`);
  for (const e of echecs) console.error(`   • ${e}`);
  process.exit(1);
}
