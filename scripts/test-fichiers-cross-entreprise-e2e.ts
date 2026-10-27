// L'IDENTIFIANT PASSE PAR LA RLS, LE REFUS PAR LE CODE — ET AUCUN DES DEUX
// N'AVAIT DE RÉGRESSION POUR LE GARDER.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Le trou que cette suite comble.** L'audit final du 29 août 2026 (§3.1,
// « FUITE ENTRE ENTREPRISES : le logo d'un autre artisan ») a trouvé et corrigé
// une vraie fuite : `GET /api/fichiers/[...key]` retrouvait une entreprise par
// sa seule clé de logo, sans filtrer sur l'entreprise du contexte — `entreprises`
// n'a aucune politique RLS, et c'était la seule des quatorze requêtes du dépôt
// sur cette table qui n'écrivait pas son propre `where id = …`. Le correctif
// (`src/app/api/fichiers/[...key]/route.ts`, le filtre explicite sur
// `ctx.entrepriseId`) est resté SANS régression permanente : rien, dans la
// batterie, n'aurait rougi si ce filtre avait été retiré. Trouvé en campagne
// red team (27 octobre 2026) en cherchant la régression qui aurait dû exister,
// pas en relisant seulement le commentaire qui l'annonce.
//
// **Pourquoi c'est une suite e2e, et pas une suite base.** La route appelle
// `exigerOuverture(ctx)`, qui lit `x-atlas-pathname` posé par le MIDDLEWARE —
// un en-tête qu'aucun appel direct au handler, hors d'une vraie requête HTTP,
// ne peut fournir. Seul un vrai navigateur, sur le vrai serveur, passe par le
// middleware.
//
// **Les deux natures de fichiers que la route sert**, l'une et l'autre
// attaquées : le logo de l'entreprise (la fuite d'origine) et une photo de
// chantier (la ressource que le scénario prioritaire nomme en premier).
// Chaque refus est confronté à son accès légitime : un 404 qui tomberait pour
// tout le monde ne prouverait rien (`CLAUDE.md` §5 quater).

import assert from "node:assert/strict";
import { hash as bcrypt } from "bcryptjs";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerClient } from "../src/server/repositories/clients";
import { creerChantier } from "../src/server/repositories/chantiers";
import { ajouterPhoto } from "../src/server/repositories/photos";
import { enregistrerObjet } from "../src/server/storage";
import type { Ctx } from "../src/server/repositories/context";

const BASE = ADRESSE;
const MOT_DE_PASSE = "deux-mots-mais-longs";

const temoin = new Pool({ connectionString: process.env.DATABASE_URL });

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== La frontière entre A et B, sur les fichiers servis par le serveur ===\n");

  const { entreprise: entA, utilisateurId: patronA } = await creerEntreprise(
    { nom: "REDTEAM_ENTREPRISE_A" },
    { email: `redteam-a-${Date.now()}@essai.local`, nom: "Patron A" }
  );
  const { entreprise: entB, utilisateurId: patronB } = await creerEntreprise(
    { nom: "REDTEAM_ENTREPRISE_B" },
    { email: `redteam-b-${Date.now()}@essai.local`, nom: "Patron B" }
  );
  const ctxB: Ctx = { utilisateurId: patronB, entrepriseId: entB.id };

  // Un mot de passe réel, comme `prouverIdentite` (`scripts/_test-db.ts`) :
  // c'est le seul chemin qui ouvre le VRAI formulaire de connexion.
  const hash = await bcrypt(MOT_DE_PASSE, 4);
  await temoin.query(`UPDATE users SET password_hash = $1 WHERE id = ANY($2)`, [hash, [patronA, patronB]]);
  const { rows: emails } = await temoin.query(`SELECT id, email FROM users WHERE id = ANY($1)`, [[patronA, patronB]]);
  const emailDe = (id: string) => emails.find((r) => r.id === id)!.email as string;

  // ─── Le logo de B — la fuite d'origine, reproduite à l'identique ──────────
  const logo = await enregistrerObjet("logos", Buffer.from("REDTEAM_LOGO_B"), ".png");
  await temoin.query(`UPDATE entreprises SET logo_storage_key = $1 WHERE id = $2`, [logo.storageKey, entB.id]);

  // ─── Une photo du chantier REDTEAM_CHANTIER_B, par le VRAI dépôt ──────────
  const client = await creerClient(ctxB, { nom: "REDTEAM_CLIENT_B" });
  const chantier = await creerChantier(ctxB, { nom: "REDTEAM_CHANTIER_B", clientId: client.id });
  const octetsPhoto = await enregistrerObjet("photos", Buffer.from("REDTEAM_PHOTO_B"), ".jpg");
  const photo = await ajouterPhoto(ctxB, chantier.id, {
    storageKey: octetsPhoto.storageKey,
    mimeType: "image/jpeg",
    tailleOctets: octetsPhoto.tailleOctets,
    checksum: octetsPhoto.checksum,
  });
  assert.equal(photo.ok, true, "le montage n'a pas posé la photo de B");

  const navigateur = await lancerNavigateur();
  async function connecte(email: string) {
    const contexte = await navigateur.newContext();
    const page = await contexte.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', MOT_DE_PASSE);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30_000 });
    return contexte;
  }

  try {
    await essai("A ne lit PAS le logo de B (404, jamais les octets)", async () => {
      const contexte = await connecte(emailDe(patronA));
      const r = await contexte.request.get(`${BASE}/api/fichiers/${logo.storageKey}`);
      assert.equal(r.status(), 404, `A a reçu le statut ${r.status()} sur le logo de B — FUITE ENTRE ENTREPRISES`);
      await contexte.close();
    });

    await essai("B, lui, lit SON logo (sinon le refus ci-dessus ne prouve rien)", async () => {
      const contexte = await connecte(emailDe(patronB));
      const r = await contexte.request.get(`${BASE}/api/fichiers/${logo.storageKey}`);
      assert.equal(r.status(), 200, `B n'a pas reçu son propre logo : ${r.status()}`);
      assert.equal(await r.text(), "REDTEAM_LOGO_B");
      await contexte.close();
    });

    await essai("A ne lit PAS la photo du chantier REDTEAM_CHANTIER_B", async () => {
      const contexte = await connecte(emailDe(patronA));
      const r = await contexte.request.get(`${BASE}/api/fichiers/${photo.ok ? octetsPhoto.storageKey : ""}`);
      assert.equal(r.status(), 404, `A a reçu le statut ${r.status()} sur la photo de B — FUITE ENTRE ENTREPRISES`);
      await contexte.close();
    });

    await essai("B, lui, lit sa propre photo", async () => {
      const contexte = await connecte(emailDe(patronB));
      const r = await contexte.request.get(`${BASE}/api/fichiers/${octetsPhoto.storageKey}`);
      assert.equal(r.status(), 200, `B n'a pas reçu sa propre photo : ${r.status()}`);
      await contexte.close();
    });
  } finally {
    await navigateur.close();
    await temoin.query(`DELETE FROM chantiers WHERE id = $1`, [chantier.id]);
    await temoin.query(`DELETE FROM clients WHERE id = $1`, [client.id]);
    await temoin.query(`DELETE FROM entreprises WHERE id = ANY($1)`, [[entA.id, entB.id]]);
    await temoin.end();
  }

  console.log(`\nFrontière A/B sur les fichiers — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
