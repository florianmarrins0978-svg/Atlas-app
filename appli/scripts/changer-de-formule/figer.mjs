// Fige le VRAI écran Abonnement (`/reglages/abonnement`) dans les états dont la
// planche « Changer de formule » a besoin. Sa demande du 23 novembre 2026, après
// avoir payé pour de vrai avec une clé de test : un appui change la formule
// sans rien dire du montant, et la descente prend effet tout de suite.
//
// L'abonnement se pose en base entre deux prises (formule, échéance), puis
// l'écran se recharge : ce qui est figé est ce que l'appli peint pour cet état.
// Les cartes et « Résilier » se touchent pour de bon. « Passer à Entreprise »
// aussi : la clé du prestataire est factice, l'appel échoue, et l'écran peint
// son vrai refus, dont la planche reprend la plage rouge.
//
// Usage, serveur lancé avec une clé de paiement factice (voir LISEZ-MOI.md) :
//   ATLAS_ADRESSE=http://localhost:3001 node appli/scripts/changer-de-formule/figer.mjs <dossier> <e-mail du compte d'essai>
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { lancer, feuilles, corps, BASE } from "../../../scripts/planche-figee/figer.mjs";

const [SORTIE, EMAIL, MDP = "Essai-Cause-2026"] = process.argv.slice(2);
if (!SORTIE || !EMAIL) throw new Error("usage : figer.mjs <dossier> <e-mail du compte d'essai> [mot de passe]");
mkdirSync(SORTIE, { recursive: true });

// Un rôle qui traverse la RLS : la ligne d'abonnement est sous FORCE.
const BASE_ADMIN = process.env.ATLAS_PSQL_ADMIN ?? "postgresql://postgres@localhost:5432/atlas_test";
// Midi UTC : `jourEnLettres` lit le jour en UTC, et minuit glisserait d'un jour
// selon le fuseau du poste.
const poser = (formule, fin) => {
  const sortie = execFileSync(
    "psql",
    [
      BASE_ADMIN,
      "-v",
      "ON_ERROR_STOP=1",
      "-tAc",
      `UPDATE abonnements SET formule='${formule}', periodicite='mensuelle', statut='actif', periode_fin='${fin}T12:00:00Z',
         annulation_demandee=false, client_prestataire='cus_planche', abonnement_prestataire='sub_planche'
       WHERE entreprise_id = (SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = '${EMAIL}')
       RETURNING formule`,
    ],
    { encoding: "utf8" }
  ).trim();
  // Une mise à jour qui ne touche rien ne doit pas laisser figer l'état d'avant.
  if (!sortie.startsWith(formule)) throw new Error(`aucun abonnement posé pour ${EMAIL} (${sortie || "zéro ligne"})`);
};

const nav = await lancer();
const contexte = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await contexte.newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', MDP);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 });

const ecran = async () => {
  await page.goto(`${BASE}/reglages/abonnement`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-atlas="etat-abonnement"]');
  await page.waitForTimeout(1200);
};
const figer = async (nom) => {
  await page.waitForTimeout(500);
  writeFileSync(`${SORTIE}/${nom}.json`, JSON.stringify(await corps(page, contexte)));
  console.log("figé", nom, "|", await page.locator('[data-atlas="etat-abonnement"]').innerText());
};
const toucher = (atlas) => page.click(`[data-atlas="${atlas}"]`);

// Artisan, prochain paiement le 23 décembre 2026 : son état de départ.
poser("artisan", "2026-12-23");
await ecran();
writeFileSync(`${SORTIE}/css.txt`, await feuilles(page, contexte));
await figer("artisan");
await toucher("formule-entreprise");
await figer("monter");
await toucher("formule-illimite");
await figer("monter-illimite");

// Le vrai refus : la clé est factice, le prestataire ne répond pas.
await toucher("formule-entreprise");
await toucher("choisir-entreprise");
await page.waitForSelector('[role="alert"]', { timeout: 90000 });
await figer("refus-reel");

// La vraie feuille de l'écran, « Avant de partir » : la planche y pose la sienne.
await ecran();
await toucher("resilier");
await page.waitForSelector('[data-atlas="avant-de-partir"]');
await figer("feuille-reelle");

// Entreprise : après la montée, au même 23 décembre, puis la descente touchée.
poser("entreprise", "2026-12-23");
await ecran();
await figer("entreprise");
await toucher("formule-artisan");
await figer("descendre");

poser("illimite", "2026-12-23");
await ecran();
await figer("illimite");

poser("artisan", "2026-12-23");
await nav.close();
