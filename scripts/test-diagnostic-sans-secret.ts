// LA ROUTE DE DIAGNOSTIC NE DOIT JAMAIS LAISSER SORTIR UN SECRET — constat F3.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE CONTRÔLE EST VERT D'EMBLÉE, ET C'EST VOULU.**
//
// F3 disait « la route expose l'environnement ». Mesurée en production, elle ne
// rend que les en-têtes de CELUI QUI APPELLE, une liste vide, et `NODE_ENV` :
// aucun secret, aucun chemin, aucun fournisseur. La route n'a donc pas été
// modifiée — c'est la consigne du patron, et elle est juste : cette route est
// ce qui a permis de sortir de « Invalid Server Actions request. », la panne
// qui lui a coûté une journée entière. La casser pour un danger qui n'existe
// pas serait le pire des échanges.
//
// **Ce qu'il reste à tenir, c'est l'AVENIR.** Elle est ouverte sans session (le
// middleware laisse passer `/api/health`), et elle est faite pour montrer ce
// que le serveur voit. La tentation, le jour d'une prochaine panne, sera d'y
// ajouter « juste une variable de plus pour comprendre ». Ce contrôle est là
// pour ce jour-là.
// ═══════════════════════════════════════════════════════════════════════════

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Les seules variables d'environnement que ce corps a le droit de nommer. */
const AUTORISEES = ["NODE_ENV", "CODESPACE_NAME", "GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN"];

const FICHIER = join(__dirname, "..", "src", "app", "api", "health", "diagnostic", "route.ts");

/** Appelle la route pour de bon, avec les en-têtes d'un appelant hostile. */
async function corpsEnProduction(): Promise<Record<string, unknown>> {
  const avant = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = "production";
  try {
    const { GET } = (await import("../src/app/api/health/diagnostic/route")) as {
      GET: (r: Request) => Promise<Response>;
    };
    const reponse = await GET(
      new Request("http://atlas.exemple.fr/api/health/diagnostic", {
        headers: {
          host: "atlas.exemple.fr",
          "x-forwarded-host": "atlas.exemple.fr",
          origin: "https://evil.example",
        },
      })
    );
    return (await reponse.json()) as Record<string, unknown>;
  } finally {
    (process.env as Record<string, string>).NODE_ENV = avant ?? "test";
  }
}

async function main() {
  console.log("Diagnostic : ce que la route rend vraiment, en production");

  const corps = await corpsEnProduction();
  const texte = JSON.stringify(corps);

  await essai("le corps a bien été obtenu — sinon rien n'est mesuré", () => {
    // Un corps vide rendrait tous les contrôles suivants verts sans rien
    // éprouver. L'absence de matière à mesurer n'est pas un succès.
    assert.ok(texte.length > 100, `corps trop court pour être celui de la route : ${texte}`);
  });

  await essai("elle ne nomme QUE les trois variables documentées", () => {
    const environnement = corps.environnement as Record<string, unknown>;
    assert.deepEqual(
      Object.keys(environnement).sort(),
      [...AUTORISEES].sort(),
      "une variable d'environnement a été ajoutée à une route ouverte sans session"
    );
  });

  await essai("EN PRODUCTION, aucune origine n'est autorisée et rien de Codespaces ne sort", () => {
    assert.deepEqual(corps.origines_autorisees, [], "des origines sont ouvertes en production");
    const environnement = corps.environnement as Record<string, unknown>;
    assert.equal(environnement.NODE_ENV, "production");
    assert.equal(environnement.CODESPACE_NAME, null);
    assert.equal(environnement.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN, null);
  });

  await essai("AUCUN SECRET DE L'ENVIRONNEMENT ne se retrouve dans le corps", () => {
    /**
     * **Le contrôle qui vaut pour demain.** Les trois précédents tiennent la
     * forme d'aujourd'hui ; celui-ci cherche la VALEUR d'un secret, où qu'elle
     * se trouve dans la réponse — y compris dans une clé qu'on n'a pas prévue.
     */
    const secrets = Object.entries(process.env).filter(
      ([nom, valeur]) =>
        typeof valeur === "string" &&
        valeur.length >= 12 &&
        /SECRET|PASSWORD|_KEY|TOKEN|DATABASE_URL|REDIS_URL/i.test(nom)
    );
    // Sans secret dans l'environnement, ce contrôle ne mesure rien : il doit
    // le dire, jamais rendre un vert qui ne prouve rien.
    assert.ok(
      secrets.length >= 2,
      `seulement ${secrets.length} secret(s) dans l'environnement : ce contrôle ne peut rien éprouver. ` +
        "Jouez-le avec AUTH_SECRET et DATABASE_URL posés, comme le fait la batterie."
    );
    const fuites = secrets.filter(([, valeur]) => texte.includes(valeur as string));
    assert.deepEqual(
      fuites.map(([nom]) => nom),
      [],
      "la valeur de ces variables se retrouve dans une réponse ouverte SANS session"
    );
  });

  await essai("la source elle-même ne lit pas d'autre variable", () => {
    // La lecture de la source attrape ce que l'exécution ne montrerait pas :
    // une variable qui ne sortirait QUE dans un cas non joué ici.
    const source = readFileSync(FICHIER, "utf8");
    const lues = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    const inattendues = [...new Set(lues)].filter((v) => !AUTORISEES.includes(v));
    assert.deepEqual(
      inattendues,
      [],
      "cette route ouverte sans session lit des variables qui ne sont pas dans sa liste"
    );
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Diagnostic sans secret — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
