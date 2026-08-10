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

// Les écrans par lesquels le patron est réellement passé ce soir-là.
//
// **`/login` n'en fait PAS partie, et c'est un correctif.** L'y inclure a
// produit une boucle infinie chez lui — `/login` → `/api/session-perimee` →
// `/login`, sans fin — le soir même. Un remède qui boucle est pire que le
// défaut qu'il répare.
const ECRANS = ["/", "/documents-legaux", "/planning"];

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

  // **La boucle : le défaut que ce correctif a lui-même créé, le 10 août 2026.**
  //
  // Le patron a vu tourner en rond, indéfiniment :
  //     GET /login?session=perimee 307 → /api/session-perimee
  //     GET /api/session-perimee  303 → /login?session=perimee
  //
  // Deux causes, et il fallait les deux : `/login` était soumis au contrôle du
  // compte, et l'effacement du cookie était REFUSÉ par le navigateur faute de
  // l'attribut `Secure` sur un nom `__Secure-`. Ce contrôle suit la chaîne
  // jusqu'au bout : ce qui compte n'est pas par où l'on passe, c'est qu'on
  // s'arrête.
  {
    let chemin = "/";
    const passages: string[] = [];
    let arrive = false;
    for (let saut = 0; saut < 6; saut++) {
      const r = await aller(chemin, fantome.entete);
      const ou = r.headers.get("location");
      if (!ou) {
        arrive = true;
        assert.ok(r.status < 400, `le parcours s'arrête sur ${r.status} au lieu d'un écran`);
        break;
      }
      assert.ok(
        !passages.includes(ou),
        `BOUCLE : « ${ou} » est traversé deux fois — ${[...passages, ou].join(" → ")}`
      );
      passages.push(ou);
      chemin = ou.startsWith("http") ? new URL(ou).pathname + new URL(ou).search : ou;
    }
    assert.ok(arrive, `le fantôme tourne encore après six sauts : ${passages.join(" → ")}`);
    assert.ok(
      passages.some((p) => p.includes("/login")),
      `le parcours devrait aboutir à la connexion — ${passages.join(" → ")}`
    );
  }
  console.log("✓ le fantôme aboutit à la connexion, sans jamais repasser au même endroit");

  // **`__Secure-` EXIGE l'attribut `Secure`, sinon le navigateur REFUSE.**
  // C'est la cause première de la boucle : l'en-tête paraissait parfait à
  // `curl`, et le navigateur le jetait. Derrière le relais du patron tout est
  // en HTTPS, donc c'est CE nom-là qui porte sa session.
  {
    const r = await aller("/api/session-perimee");
    for (const pose of r.headers.getSetCookie()) {
      const nom = pose.split("=")[0];
      if (nom.startsWith("__Secure-") || nom.startsWith("__Host-")) {
        assert.match(
          pose,
          /;\s*Secure/i,
          `« ${nom} » est effacé sans l'attribut Secure : le navigateur refusera, et le fantôme survivra`
        );
      } else {
        assert.ok(
          !/;\s*Secure/i.test(pose),
          `« ${nom} » porte Secure : il ne s'effacerait plus en clair, c'est-à-dire sur le banc local`
        );
      }
    }
  }
  console.log("✓ chaque cookie est effacé avec l'attribut que son nom exige");



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

  console.log("\nSession périmée : 7 contrôles au vert.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
