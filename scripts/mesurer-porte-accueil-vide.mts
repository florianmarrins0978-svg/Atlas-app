// ═══════════════════════════════════════════════════════════════════════════
// LA PLACE DE « CRÉER UN DEVIS » SUR UN ACCUEIL VIDE — la mesure, à la main
// ═══════════════════════════════════════════════════════════════════════════
//
// **Pourquoi ce script existe, et pourquoi la batterie ne le fait pas.** Le
// serveur des suites navigateur tourne sous un rôle qui TRAVERSE la RLS : un
// compte neuf y voit les chantiers du jeu de démonstration, et son accueil
// n'est jamais vide (`CLAUDE.md` §5). La place de la porte sur un écran vide —
// *« découpe l'écran en 3 parts égales, en partant du bas mets-le en haut de la
// deuxième »*, 17 septembre 2026 — se mesure donc ici, sous le rôle du produit.
//
//   npm run dev                       (serveur sous « atlas_app », RLS active)
//   npx tsx scripts/mesurer-porte-accueil-vide.mts
//
// Il crée un compte sans chantier, retire son abonnement d'essai (le ruban vaut
// quarante pixels que son Atlas à lui n'a pas), mesure le centre de l'anneau en
// fraction de la hauteur, écrit l'image, puis efface le compte.
import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";
import { Pool } from "pg";
import { creerSonCompte } from "../src/server/repositories/creation-compte";
import { documentsAAccepter, enregistrerAcceptations } from "../src/server/repositories/documents-legaux";
import { ADRESSE } from "./_adresse";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;
const MOT_DE_PASSE = "trois-mots-tres-courts";
const CIBLE = 1 / 3;

const email = `mesure-accueil-${Date.now()}@essai.local`;
const compte = await creerSonCompte({
  civilite: "mr",
  prenom: "Lucien",
  nom: "Vidal",
  email,
  motDePasse: MOT_DE_PASSE,
  entreprise: "Jardins Vidal",
  forme: "EI",
  tva: "franchise",
});
if (!compte.ok) {
  console.error(`Le compte de mesure n'a pas pu être créé : ${compte.refus}`);
  process.exit(1);
}
// **Le contexte d'entreprise est POSÉ pour retirer l'essai.** `abonnements` est
// sous FORCE RLS : sans lui, le DELETE touche zéro ligne SANS lever d'erreur
// (`CLAUDE.md` invariant 7), le ruban d'essai reste, et il vaut trente-six
// pixels — la mesure annonçait alors 38,5 % au lieu de 33,4 %. Vu à l'image.
{
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [compte.entrepriseId]);
    const r = await client.query(`DELETE FROM abonnements WHERE entreprise_id = $1`, [compte.entrepriseId]);
    if (r.rowCount === 0) console.warn("⚠ aucun abonnement retiré : le ruban d'essai va fausser la mesure.");
    await client.query("COMMIT");
  } finally {
    client.release();
  }
}
const aAccepter = await documentsAAccepter(compte.utilisateurId);
if (aAccepter.length > 0) {
  await enregistrerAcceptations(
    compte.utilisateurId,
    aAccepter.map((d) => d.id),
    { adresseIp: "127.0.0.1", agentUtilisateur: "mesure" }
  );
}

const navigateur = await lancerNavigateur();
const page = await (await navigateur.newContext({ ...ECRAN_DU_PATRON })).newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', MOT_DE_PASSE);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);

const lignes = await page.locator(".atlas-ligne").count();
const anneau = page.locator('[data-atlas="nouveau-chantier"] .atlas-rond');
const boite = await anneau.boundingBox();
const vue = page.viewportSize();
await page.screenshot({ path: "/tmp/atlas-vu/accueil-vide.png" }).catch(() => {});

if (lignes > 0) {
  console.error(`❌ ${lignes} chantier(s) à l'écran : ce serveur traverse la RLS, la mesure ne veut rien dire.`);
} else if (!boite || boite.height < 1 || !vue) {
  console.error("❌ l'anneau ne se mesure pas : rien n'a été éprouvé.");
} else {
  const place = (boite.y + boite.height / 2) / vue.height;
  const verdict = Math.abs(place - CIBLE) <= 0.04 ? "✅" : "❌";
  console.log(`${verdict} porte mesurée à ${(place * 100).toFixed(1)} % de la hauteur (visée : 33 %).`);
  console.log("   image : /tmp/atlas-vu/accueil-vide.png");
}

await navigateur.close();
await pool.query(`DELETE FROM entreprises WHERE id = $1`, [compte.entrepriseId]);
await pool.query(`DELETE FROM users WHERE email = $1`, [email]);
await pool.end();
