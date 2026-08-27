// « ME DÉCONNECTER PARTOUT » TIENT-IL VRAIMENT ? — sonde M11, 25 août 2026.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE CHERCHE, ET POURQUOI ELLE EXISTE.**
//
// Atlas ne garde aucune table de sessions : fermer une session ouverte ailleurs
// consiste à avancer `users.jetons_valides_depuis`, puis à refuser tout jeton
// dont l'instant de signature (`iat`) précède cette coupure
// (`src/server/session-ctx.ts`).
//
// **Or `@auth/core` REMET `iat` à l'instant présent à chaque réémission :**
//
//     return await new EncryptJWT(token)
//         .setIssuedAt()                    // ← iat = maintenant
//         .setJti(crypto.randomUUID())      // ← jti neuf lui aussi
//
// Mesuré avec la version installée (`scripts/sonde-jeton-session.mts`) : ni
// `jti` ni `iat` ne survit à une réémission.
//
// **Et la route qui réémet est publique** : `GET /api/auth/session` est montée
// par `src/app/api/auth/[...nextauth]/route.ts`, et elle ne consulte jamais la
// coupure — elle ne regarde que la signature du cookie.
//
// La question qui décide de l'architecture de M11 est donc :
//
//   > Une session que le patron vient de couper peut-elle se redonner un jeton
//   > neuf, et rentrer ?
//
// Cette sonde y répond par un parcours réel, sans rien supposer.
//
// ─────────────────────────────────────────────────────────────────────────────
// **ELLE SE CONTOURNAIT, LE 25 AOÛT 2026 AU MATIN — reproduit au navigateur.**
//
//     → /api/auth/session a répondu 200 (sans avoir visité d'écran)
//     ✗✗ LA COUPURE SE CONTOURNE : la session refusée est revenue.
//
// **Le correctif ne touche ni la route d'Auth.js ni le middleware** — aucun des
// deux ne peut lire la base. Le jeton porte désormais `connexionLe`, posé une
// seule fois à la connexion et recopié aux réémissions, et c'est LUI que la
// coupure compare (`src/auth.ts`, `src/server/session-ctx.ts`). Réémettre
// n'avance plus rien.
//
// Cette suite est le contrôle qui empêche le défaut de revenir : elle a été vue
// ROUGE sur le code d'avant, sur ce parcours exact.

import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";

const BASE = "http://localhost:3000";

async function main() {
  console.log("=== La coupure des sessions se contourne-t-elle ? ===\n");

  const proprio = new Pool({
    connectionString:
      process.env.DATABASE_ADMIN_URL ?? "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test",
  });
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
    console.log("  ✓ connecté");

    const { rows } = await proprio.query(`SELECT id FROM users WHERE email = 'demo@atlas.local'`);
    const utilisateurId = rows[0].id as string;

    // ─── La coupure, telle que « me déconnecter partout » la pose ────────────
    await proprio.query(`UPDATE users SET jetons_valides_depuis = now() + interval '1 second' WHERE id = $1`, [
      utilisateurId,
    ]);
    await new Promise((r) => setTimeout(r, 1500));

    /**
     * **L'ORDRE DES GESTES EST TOUT, et une première version de cette sonde
     * s'est trompée dessus.** Elle visitait un écran protégé avant d'essayer le
     * contournement — or cet écran renvoie vers `/api/session-perimee`, qui
     * EFFACE le cookie. Elle mesurait donc un navigateur déjà vidé, et concluait
     * « la coupure tient » sans avoir joué l'attaque.
     *
     * Un attaquant ne visite aucun écran : il va droit à la route qui réémet.
     * C'est cet ordre-là qu'on joue ici.
     */
    const reponse = await page.request.get(`${BASE}/api/auth/session`);
    console.log(`  → /api/auth/session a répondu ${reponse.status()} (sans avoir visité d'écran)`);

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const rentre = !page.url().includes("/login") && !page.url().includes("session-perimee");

    if (rentre) {
      console.log("");
      console.log("  ✗✗ LA COUPURE SE CONTOURNE : la session refusée est revenue par la route de session.");
      console.log(`     url après contournement : ${page.url()}`);
    } else {
      console.log("  ✓ le contournement échoue : la coupure tient");
    }

    assert.ok(
      !rentre,
      "« Me déconnecter partout » se contourne : un cookie volé se redonne un jeton neuf par GET /api/auth/session"
    );

    console.log("");
    console.log("✅ La coupure des sessions tient.");
  } finally {
    await proprio
      .query(`UPDATE users SET jetons_valides_depuis = NULL WHERE email = 'demo@atlas.local'`)
      .catch(() => undefined);
    await proprio.end().catch(() => undefined);
    await contexte.close();
    await navigateur.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
