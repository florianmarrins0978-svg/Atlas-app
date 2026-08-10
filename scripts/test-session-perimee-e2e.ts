import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { chromium } from "playwright";

// **La panne qui a tenu une soirée entière, tenue par un contrôle.**
//
// Le 10 août 2026 : le jeu de démonstration est refait, l'ancien compte
// supprimé, et le navigateur du patron porte toujours la session de ce fantôme.
// Le cookie est signé — donc valide : l'application le laisse entrer, puis
// TOUTE écriture est refusée. Il a vu « aucune adhésion d'entreprise », puis un
// `insert` en échec sur les documents légaux, sans que rien ne relie ces
// messages à leur cause commune.
//
// Ce que cette suite tient, et qu'aucune autre ne voyait :
//
//   1. une session dont le compte n'existe plus est renvoyée vers la route qui
//      efface le cookie — par un VRAI 307, et non par un renvoi joué en
//      JavaScript. La distinction n'est pas théorique : le premier correctif
//      posait le contrôle dans la page, sous la frontière de `loading.tsx`, où
//      l'enveloppe est déjà partie. Il rendait 200. Le contrôle passait au
//      vert ;
//   2. la route d'effacement renvoie à la connexion par une adresse RELATIVE.
//      Fabriquée depuis `request.url`, elle valait `http://0.0.0.0:3000/login`
//      — le remède aurait mené à une page morte, comme le défaut ;
//   3. elle efface pour de bon, et reste atteignable SANS session : sinon le
//      garde-fou renverrait vers `/login` avant l'effacement, et le fantôme
//      survivrait au remède ;
//   4. **une session VALIDE n'est jamais renvoyée là.** C'est le contrôle qui
//      compte le plus : un correctif qui déconnecterait tout le monde serait
//      pire que le défaut qu'il répare ;
//   5. et pour finir, un VRAI navigateur, JavaScript coupé, part du fantôme et
//      arrive sur l'écran de connexion sans plus porter de session.

const BASE = process.env.ATLAS_BASE ?? "http://127.0.0.1:3000";
const NOM_COOKIE = "authjs.session-token";
// Un identifiant qui n'existe dans aucune base : c'est tout l'objet du fantôme.
const FANTOME = "38befa76-e564-4751-9060-69ada52e720d";

// Les écrans par lesquels le patron est réellement passé ce soir-là, plus
// `/login` : c'est là qu'il revenait à chaque échec, et un cookie mort doit y
// être défait plutôt qu'y survivre.
const ECRANS = ["/", "/documents-legaux", "/planning", "/login"];

/** Fabrique un cookie de session signé pour un identifiant donné. */
async function cookiePour(utilisateurId: string, email: string) {
  const secret = process.env.AUTH_SECRET;
  assert.ok(secret, "AUTH_SECRET est nécessaire pour fabriquer une session d'essai");
  const jeton = await encode({
    // Exactement ce que pose le rappel `jwt` de `src/auth.ts`.
    token: { sub: utilisateurId, utilisateurId, email },
    secret,
    salt: NOM_COOKIE,
    maxAge: 15 * 60,
  });
  return { entete: `${NOM_COOKIE}=${jeton}`, jeton };
}

/** L'identifiant du compte de démonstration, lu en base sous le superutilisateur. */
async function compteReel(): Promise<{ id: string; email: string }> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select id, email from users
        order by (email = 'demo@atlas.local') desc, created_at asc
        limit 1`
    );
    assert.ok(rows[0], "aucun compte en base : le jeu de démonstration a-t-il été posé ?");
    return rows[0];
  } finally {
    await client.end();
  }
}

async function aller(chemin: string, cookie?: string) {
  return fetch(BASE + chemin, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
}

async function main() {
  const fantome = await cookiePour(FANTOME, "fantome@atlas.local");

  // 1. Les écrans où le fantôme mordait — et un vrai 307, pas un 200.
  for (const ecran of ECRANS) {
    const r = await aller(ecran, fantome.entete);
    const ou = r.headers.get("location") ?? "";
    assert.ok(
      r.status >= 300 && r.status < 400,
      `${ecran} a rendu ${r.status} au lieu d'un renvoi. Un 200 ici, c'est un renvoi ` +
        `joué en JavaScript sous la frontière de loading.tsx — le contrôle doit vivre ` +
        `dans le layout, qui précède le premier octet.`
    );
    assert.ok(
      ou.includes("/api/session-perimee"),
      `${ecran} devrait mener à la route qui efface la session — reçu « ${ou} »`
    );
  }
  console.log(`✓ ${ECRANS.length} écrans : une session dont le compte n'existe plus est renvoyée par un vrai 307`);

  // 2 et 3. La route efface, renvoie à la connexion, et n'exige aucune session.
  for (const [quoi, cookie] of [
    ["avec le fantôme", fantome.entete],
    ["sans aucune session", undefined],
  ] as const) {
    const r = await aller("/api/session-perimee", cookie);
    assert.equal(r.status, 303, `${quoi} : la route devrait rendre 303, pas ${r.status}`);

    const ou = r.headers.get("location") ?? "";
    assert.ok(ou.includes("/login"), `${quoi} : elle devrait renvoyer à l'écran de connexion`);
    // L'adresse d'écoute n'est pas celle du patron : derrière son relais, un
    // renvoi absolu le déposerait sur une page morte.
    assert.ok(
      ou.startsWith("/"),
      `${quoi} : le renvoi doit être relatif, sinon il porte l'adresse d'écoute — reçu « ${ou} »`
    );

    const poses = r.headers.getSetCookie().join(" | ");
    for (const nom of [NOM_COOKIE, `__Secure-${NOM_COOKIE}`]) {
      assert.ok(
        new RegExp(`${nom.replace(".", "\\.")}=;`).test(poses) && /Max-Age=0/.test(poses),
        `${quoi} : « ${nom} » devrait être effacé — reçu « ${poses} »`
      );
    }
  }
  console.log("✓ la route efface les deux familles de cookies et renvoie à la connexion, même sans session");

  // 4. **Le contrôle qui protège du remède.** Un correctif qui déconnecterait
  //    un compte valide serait pire que le défaut.
  const reel = await compteReel();
  const valide = await cookiePour(reel.id, reel.email);
  for (const ecran of ECRANS) {
    const r = await aller(ecran, valide.entete);
    const ou = r.headers.get("location") ?? "";
    assert.ok(
      !ou.includes("/api/session-perimee"),
      `un compte valide ne doit JAMAIS être déconnecté — ${ecran} l'a renvoyé vers « ${ou} »`
    );
  }
  console.log("✓ une session valide n'est jamais renvoyée vers l'effacement");

  // 5. **Le parcours entier, dans un vrai navigateur, JavaScript coupé.**
  //    Les quatre contrôles ci-dessus lisent des en-têtes ; celui-ci regarde
  //    ce que le patron verrait. JavaScript coupé délibérément : c'est ce qui
  //    distingue un vrai 307 d'un renvoi joué après coup.
  const navigateur = await chromium.launch({
    executablePath: process.env.ATLAS_CHROMIUM ?? "/opt/pw-browsers/chromium",
  });
  try {
    const contexte = await navigateur.newContext({ javaScriptEnabled: false });
    const hote = new URL(BASE);
    await contexte.addCookies([
      { name: NOM_COOKIE, value: fantome.jeton, domain: hote.hostname, path: "/" },
    ]);
    const page = await contexte.newPage();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });

    assert.ok(
      page.url().includes("/login"),
      `un navigateur portant le fantôme devrait aboutir à la connexion — il est sur « ${page.url()} »`
    );
    const restants = (await contexte.cookies()).filter(
      (c) => c.name.endsWith("authjs.session-token") && c.value !== ""
    );
    assert.equal(
      restants.length,
      0,
      `la session fantôme survit dans le navigateur : ${restants.map((c) => c.name).join(", ")}`
    );
    // L'écran de connexion doit être là, pas une page d'erreur.
    const texte = (await page.textContent("body")) ?? "";
    assert.ok(
      /connexion|se connecter|mot de passe/i.test(texte),
      "l'écran atteint ne ressemble pas à la connexion"
    );
  } finally {
    await navigateur.close();
  }
  console.log("✓ un vrai navigateur, JavaScript coupé, part du fantôme et arrive à la connexion");

  console.log("\nSession périmée : 5 contrôles au vert.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
