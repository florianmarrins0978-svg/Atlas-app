import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { ouvrableParLeClient } from "../src/lib/adresse-du-client";
import { originePublique } from "../src/server/origine-publique";

// LE LIEN QUE REÇOIT LE CLIENT — qu'il parte, et qu'il s'ouvre CHEZ LUI.
//
// **Sa capture du 24 août 2026 : « Connexion au serveur impossible. »** Son
// client ouvre le message et tombe sur une page morte, sur `localhost`. Le
// document existait, son jeton était bon, la page fonctionnait — mais l'adresse
// envoyée désignait le téléphone du client lui-même.
//
// ─── CE QUI MANQUAIT, ET QUI SE COUVRE ICI ───────────────────────────────────
//
//   1. **L'espace ne DONNAIT PAS son adresse publique au serveur.** Le script
//      de démarrage la composait — pour l'afficher dans le terminal — sans
//      jamais la poser dans l'environnement. Ouvert par la redirection de port
//      de l'éditeur, Atlas fabriquait donc des liens en `localhost`, et rien à
//      l'écran ne le distinguait d'une session ouverte par la bonne adresse.
//
//   2. **Le garde-fou n'existait que sur la fiche d'entretien**, là où le
//      défaut avait été trouvé. Le devis et la facture partent par le même
//      chemin et prennent la même adresse : ils envoyaient le lien mort.
//
// **Le premier point rend le lien JUSTE ; le second empêche d'envoyer un lien
// faux.** Les deux sont nécessaires : une variable peut manquer sur une machine
// qu'on n'a pas prévue, et c'est alors le refus qui protège le client.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`      ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  }
}

console.log("\n=== Le lien que reçoit le client ===\n");

// ─── 1. L'ESPACE POSE SON ADRESSE PUBLIQUE ───────────────────────────────────
//
// **On EXÉCUTE le bloc du script, on ne le relit pas.** Un contrôle qui
// chercherait la chaîne « export ATLAS_URL_PUBLIQUE » passerait au vert sur un
// `export` mis en commentaire, ou placé après le démarrage du serveur. Ici, le
// bloc est extrait du fichier tel qu'il est, joué dans un bash à part avec les
// variables que GitHub pose, et l'on lit ce qu'il en sort.
const DEMARRER = ".devcontainer/demarrer.sh";

function blocDeLAdresse(): string {
  const source = readFileSync(DEMARRER, "utf8");
  const debut = source.indexOf('if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then');
  assert.notEqual(
    debut,
    -1,
    `${DEMARRER} ne compose plus l'adresse publique à partir des variables de l'espace.`
  );
  const fin = source.indexOf("\nfi", debut);
  assert.notEqual(fin, -1, `Le bloc de l'adresse dans ${DEMARRER} n'est pas refermé.`);
  return source.slice(debut, fin + 3);
}

function adresseComposee(env: Record<string, string>): string {
  return execFileSync("bash", ["-c", `${blocDeLAdresse()}\nprintf '%s' "\${ATLAS_URL_PUBLIQUE:-}"`], {
    // **Un environnement NU, et c'est le sujet.** Hériter de celui-ci y
    // laisserait l'`ATLAS_URL_PUBLIQUE` d'une session précédente, et le contrôle
    // lirait une adresse que le script n'a pas posée. `NODE_ENV` est repris
    // parce que le dépôt le déclare obligatoire ; il ne pèse sur rien ici.
    env: { PATH: process.env.PATH ?? "", NODE_ENV: process.env.NODE_ENV ?? "test", ...env },
    encoding: "utf8",
  });
}

cas("le démarrage POSE l'adresse publique de l'espace, il ne fait pas que l'afficher", () => {
  const rendue = adresseComposee({
    CODESPACE_NAME: "vjg34rv",
    GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
  });
  assert.equal(
    rendue,
    "https://vjg34rv-3000.app.github.dev",
    `Le démarrage n'a pas posé ATLAS_URL_PUBLIQUE — lu « ${rendue} ». Sans elle, Atlas ouvert ` +
      `par la redirection de port fabrique des liens en localhost, et le client reçoit une page morte.`
  );
});

cas("posée, elle COMMANDE : le lien ne dépend plus de la porte par laquelle il entre", () => {
  const avant = process.env.ATLAS_URL_PUBLIQUE;
  process.env.ATLAS_URL_PUBLIQUE = "https://vjg34rv-3000.app.github.dev";
  try {
    // Le navigateur a demandé `localhost:3000` — la redirection de port de son
    // éditeur. C'est EXACTEMENT le cas de sa capture.
    const entetes = new Map([["host", "localhost:3000"]]);
    const origine = originePublique({ get: (n) => entetes.get(n) ?? null });
    assert.equal(origine, "https://vjg34rv-3000.app.github.dev");
    assert.equal(ouvrableParLeClient(origine), true, "l'adresse déclarée reste jugée inouvrable");
  } finally {
    if (avant === undefined) delete process.env.ATLAS_URL_PUBLIQUE;
    else process.env.ATLAS_URL_PUBLIQUE = avant;
  }
});

cas("SANS elle, le cas de sa capture se reproduit — et se fait refuser", () => {
  const avant = process.env.ATLAS_URL_PUBLIQUE;
  delete process.env.ATLAS_URL_PUBLIQUE;
  try {
    const entetes = new Map([["host", "localhost:3000"]]);
    const origine = originePublique({ get: (n) => entetes.get(n) ?? null });
    assert.equal(origine, "http://localhost:3000", "l'origine ne rend plus honnêtement localhost");
    assert.equal(
      ouvrableParLeClient(origine),
      false,
      "localhost est jugé donnable à un client : c'est la page morte de sa capture."
    );
  } finally {
    if (avant !== undefined) process.env.ATLAS_URL_PUBLIQUE = avant;
  }
});

// ─── 2. LES TROIS ÉCRANS QUI ÉCRIVENT AU CLIENT REFUSENT UNE ADRESSE LOCALE ──
//
// **Le contrôle lit la SOURCE, et il faut dire pourquoi.** Le seul moyen de
// l'éprouver au navigateur serait d'y servir Atlas sur une adresse locale — or
// la batterie pose délibérément `ATLAS_URL_PUBLIQUE` pour que les suites aient
// des liens valides (`scripts/run-e2e-tests.ts`). Le refus ne s'y déclencherait
// donc jamais, et un vert n'y prouverait rien.
//
// Ce qu'il défend n'est pas une ligne de code mais une RÈGLE : les trois écrans
// qui écrivent à un client passent par le même verdict. Un quatrième écran qui
// naîtrait sans lui est exactement ce que ce cas doit faire remarquer.
const ECRANS_QUI_ECRIVENT_AU_CLIENT: [string, string][] = [
  ["le devis", "src/app/chantiers/[id]/export/TransmettreAuClient.tsx"],
  ["la facture", "src/app/chantiers/[id]/facture/TransmettreLaFacture.tsx"],
  ["la fiche d'entretien", "src/app/paysage/fiche/[id]/FicheChantierClient.tsx"],
];

for (const [quoi, chemin] of ECRANS_QUI_ECRIVENT_AU_CLIENT) {
  cas(`${quoi} refuse d'envoyer une adresse qui n'existe que chez lui`, () => {
    const source = readFileSync(chemin, "utf8");
    assert.ok(
      source.includes("ouvrableParLeClient("),
      `${chemin} compose un message pour un client sans passer par ouvrableParLeClient : ` +
        `il enverra le lien mort de sa capture du 24 août.`
    );
    assert.ok(
      source.includes("PHRASE_ADRESSE_LOCALE"),
      `${chemin} refuse peut-être, mais sans phrase : un écran qui se tait passe pour cassé.`
    );
  });
}

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le lien que reçoit le client — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
