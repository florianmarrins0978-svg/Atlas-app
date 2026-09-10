import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **LE FICHIER DE SECOURS QUI NE SE METTAIT JAMAIS À JOUR.**
//
// `demarrer.sh` écrit d'avance un `.env.local` pour que le patron n'ait qu'à
// coller ses clés. La première version l'écrivait sous un `if [ ! -f ]` : né au
// premier démarrage, il gardait pour toujours les seuls noms connus ce jour-là.
//
// Payé le 10 septembre 2026. La porte affiche Google et Apple dès que leurs
// clés sont posées ; son écran ne les montrait pas, et il n'y avait nulle part
// où coller `AUTH_GOOGLE_ID` — le fichier de secours créé pour lui épargner un
// geste était devenu la raison pour laquelle le geste revenait.
//
// Cette suite éprouve les deux moitiés, et la seconde est celle qui compte :
// **compléter sans jamais toucher à ce qui est déjà collé.**

const SCRIPT = path.join(__dirname, "..", ".devcontainer", "completer-env-local.sh");
const CHARGER = path.join(__dirname, "..", ".devcontainer", "charger-cles.sh");

const NOMS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_APPLE_ID",
  "AUTH_APPLE_SECRET",
];

let echecs = 0;

function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Joue le script sur un fichier au contenu donné (ou absent) et rend le résultat. */
function completer(contenu?: string): string {
  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-env-"));
  const fichier = path.join(dossier, ".env.local");
  if (contenu !== undefined) writeFileSync(fichier, contenu);
  execFileSync("bash", [SCRIPT, fichier], { encoding: "utf8" });
  return readFileSync(fichier, "utf8");
}

console.log("=== Le fichier de clés naît complet, et le reste ===");

cas("un espace neuf reçoit un emplacement pour CHAQUE clé", () => {
  const apres = completer();
  for (const nom of NOMS) {
    assert.match(apres, new RegExp(`^${nom}=$`, "m"), `Aucun emplacement pour ${nom}.`);
  }
});

cas("**un fichier d'hier reçoit les clés d'aujourd'hui** — le défaut du 10 septembre", () => {
  // Exactement ce que porte son espace : le modèle de l'époque, deux clés.
  const apres = completer("# Collez vos clés\nOPENAI_API_KEY=\nANTHROPIC_API_KEY=\n");
  assert.match(apres, /^AUTH_GOOGLE_ID=$/m, "Google n'a toujours nulle part où se coller.");
  assert.match(apres, /^AUTH_APPLE_ID=$/m, "Apple n'a toujours nulle part où se coller.");
});

cas("une clé DÉJÀ COLLÉE n'est ni effacée ni dupliquée", () => {
  const apres = completer("OPENAI_API_KEY=sk-la-sienne\n");
  assert.match(apres, /^OPENAI_API_KEY=sk-la-sienne$/m, "Sa clé a été perdue.");
  const combien = apres.split("\n").filter((l) => l.startsWith("OPENAI_API_KEY=")).length;
  assert.equal(combien, 1, "La clé apparaît deux fois : la seconde, vide, la contredit.");
});

cas("rejoué deux fois, il n'ajoute rien la seconde", () => {
  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-env-"));
  const fichier = path.join(dossier, ".env.local");
  execFileSync("bash", [SCRIPT, fichier]);
  const premier = readFileSync(fichier, "utf8");
  execFileSync("bash", [SCRIPT, fichier]);
  assert.equal(readFileSync(fichier, "utf8"), premier, "Le fichier enfle à chaque allumage.");
});

cas("un nom qui n'est cité qu'en commentaire ne compte pas pour posé", () => {
  // Le piège d'un `grep` trop large : la phrase d'explication cite le nom, et
  // l'emplacement n'est alors jamais écrit — le patron n'a rien à remplir.
  const apres = completer("# Pour entrer avec Google, posez AUTH_GOOGLE_ID ici\n");
  assert.match(apres, /^AUTH_GOOGLE_ID=$/m, "Le commentaire a été pris pour une ligne posée.");
});

console.log("=== Et ce qu'il écrit n'efface rien au chargement ===");

cas("les emplacements vides qu'il ajoute ne ressortent pas de `charger-cles.sh`", () => {
  // La garantie qui rend l'ajout sans danger : une ligne vide ajoutée à côté
  // d'une clé venue des secrets de l'espace ne doit pas la débrancher.
  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-env-"));
  const fichier = path.join(dossier, ".env.local");
  execFileSync("bash", [SCRIPT, fichier]);
  const sortie = execFileSync("bash", [CHARGER, fichier], {
    encoding: "utf8",
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "/usr/bin:/bin", AUTH_GOOGLE_ID: "venu-des-secrets" },
  });
  assert.equal(sortie.trim(), "", "Une ligne vide du modèle a été ressortie, donc exportée.");
});

console.log(echecs === 0 ? "\n✅ Le fichier de clés suit Atlas." : `\n❌ ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
