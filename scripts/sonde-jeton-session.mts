// SONDE — que vaut vraiment l'identité d'une session Atlas ? (M11, 25 août 2026)
//
// **Elle ne prouve rien du produit : elle CONSTATE le comportement d'Auth.js**,
// pour qu'une décision d'architecture repose sur ce que la pile fait, et non sur
// ce qu'on croit qu'elle fait.
//
// Trois questions, posées à la version réellement installée :
//
//   1. `jti` est-il stable pendant une session ?
//   2. `iat` l'est-il ?
//   3. que se passe-t-il quand le jeton est réémis ?
//
// Se joue à la main : `npx tsx scripts/sonde-jeton-session.mts`

import { encode, decode } from "next-auth/jwt";

const SECRET = process.env.AUTH_SECRET ?? "ci-secret-not-a-real-production-value-000000000000";
const SALT = "authjs.session-token";

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("=== Ce qu'Auth.js met vraiment dans un jeton ===\n");

  // Ce que le fournisseur `Credentials` produit : un contenu métier, sans jti
  // ni iat — ceux-là sont posés par `encode`.
  const contenu = { utilisateurId: "11111111-1111-1111-1111-111111111111", email: "a@essai.local" };

  const premier = await encode({ token: contenu, secret: SECRET, salt: SALT });
  const p = await decode({ token: premier, secret: SECRET, salt: SALT });
  console.log(`1er jeton   → jti=${p?.jti}  iat=${p?.iat}`);

  await attendre(1100);

  // **La réémission telle qu'Auth.js la fait** : il redonne à `encode` le
  // contenu DÉCODÉ, jti et iat compris (`lib/actions/session.js:46`).
  const second = await encode({ token: p!, secret: SECRET, salt: SALT });
  const s = await decode({ token: second, secret: SECRET, salt: SALT });
  console.log(`réémis      → jti=${s?.jti}  iat=${s?.iat}`);

  console.log("");
  console.log(`jti STABLE à la réémission ? ${p?.jti === s?.jti ? "OUI" : "NON"}`);
  console.log(`iat STABLE à la réémission ? ${p?.iat === s?.iat ? "OUI" : "NON"}`);

  await attendre(1100);
  const troisieme = await encode({ token: s!, secret: SECRET, salt: SALT });
  const t = await decode({ token: troisieme, secret: SECRET, salt: SALT });
  console.log(`3e passage  → jti=${t?.jti}  iat=${t?.iat}`);

  // Deux connexions distinctes du MÊME utilisateur : que partagent-elles ?
  const autreSession = await decode({
    token: await encode({ token: contenu, secret: SECRET, salt: SALT }),
    secret: SECRET,
    salt: SALT,
  });
  console.log("");
  console.log(`deux connexions : même jti ? ${p?.jti === autreSession?.jti ? "OUI" : "NON"}`);
  console.log(`deux connexions : même iat ? ${p?.iat === autreSession?.iat ? "OUI — dans la même seconde" : "NON"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
