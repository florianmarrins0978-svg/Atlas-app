// AUCUNE ROUTE D'API NE DOIT OUBLIER SA GARDE DE RÔLE.
//
// **Pourquoi cette suite existe, et pourquoi elle n'a pas d'équivalent pour les
// écrans.** Un écran traverse `layout.tsx`, donc `GardeAcces` : il ne peut pas
// oublier. Une route d'API ne traverse aucune mise en page — elle doit appeler
// `exigerOuverture()` elle-même, et un oubli ne se VOIT PAS : la route marche,
// elle marche même trop bien. C'est exactement par là qu'un PDF de devis sort du
// serveur, prix compris (`docs/QUESTIONS.md` §10).
//
// **La liste des routes est LUE, jamais recopiée.** Une route neuve, écrite
// demain par une autre session, apparaît donc ici toute seule — et la suite
// rougit jusqu'à ce que quelqu'un décide, à la main, si elle porte une garde ou
// si elle rejoint les exemptées ci-dessous.
//
// **Et l'ORDRE compte** : la garde doit précéder la lecture. Refuser après avoir
// lu ne referme rien — la donnée est déjà sortie de la base, et c'est le genre
// de défaut qu'aucune capture ne montre.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

const RACINE = path.join(__dirname, "..", "src", "app", "api");

/**
 * Les routes qui n'ont PAS de garde de rôle, et la raison de chacune.
 *
 * Une exemption sans raison écrite est un trou qu'on ne rouvrira jamais : c'est
 * pourquoi la raison est dans la donnée, et non dans un commentaire à côté.
 */
const EXEMPTEES: Record<string, string> = {
  "auth/[...nextauth]": "Auth.js lui-même : c'est la porte, elle précède tout rôle.",
  "session-perimee": "Efface un cookie mort et renvoie à la connexion. Aucune donnée.",
  "cron/purge-fichiers": "Appelée par la planification, avec son propre secret — jamais par un compte.",
  "health/live": "Sonde de santé, aucune donnée d'entreprise.",
  "health/ready": "Sonde de santé, aucune donnée d'entreprise.",
  "health/banc": "État du banc d'essai. Ouvert aux trois rôles de toute façon.",
  "health/banc/etat": "État du banc d'essai. Ouvert aux trois rôles de toute façon.",
  "health/diagnostic": "État du banc d'essai. Ouvert aux trois rôles de toute façon.",
  "polices/[fichier]": "Sert un fichier de police. Ouvert aux trois rôles de toute façon.",
  "mes-donnees": "Porte déjà `exigerProprietaire` — plus strict que la garde de chemin.",
  "chantiers/[chantierId]/feuille/pdf":
    "LE devis sans un seul montant : c'est le document du salarié, ouvert à tous les rôles.",
  "agenda/google/retour":
    "Retour d'autorisation Google, reconnu par un témoin posé à l'aller — il n'y a pas encore de chemin à garder.",
};

function routes(dossier: string, prefixe = ""): { cle: string; fichier: string }[] {
  const trouvees: { cle: string; fichier: string }[] = [];
  for (const entree of readdirSync(dossier)) {
    const complet = path.join(dossier, entree);
    if (statSync(complet).isDirectory()) {
      trouvees.push(...routes(complet, prefixe ? `${prefixe}/${entree}` : entree));
    } else if (entree === "route.ts") {
      trouvees.push({ cle: prefixe, fichier: complet });
    }
  }
  return trouvees;
}

const ROUTES = routes(RACINE);

console.log("=== Les routes d'API et leur garde de rôle ===\n");

essai("les routes ont bien été trouvées — sans quoi ce qui suit ne mesure rien", () => {
  assert.ok(ROUTES.length >= 15, `seulement ${ROUTES.length} routes trouvées`);
  assert.ok(ROUTES.some((r) => r.cle === "devis/[id]/pdf"));
});

essai("chaque route sert une donnée d'entreprise sous garde, ou dit pourquoi non", () => {
  const oubliees: string[] = [];
  for (const { cle, fichier } of ROUTES) {
    if (cle in EXEMPTEES) continue;
    const source = readFileSync(fichier, "utf8");
    if (!source.includes("exigerOuverture(")) oubliees.push(cle);
  }
  assert.deepEqual(
    oubliees,
    [],
    `route(s) sans garde de rôle : ${oubliees.join(", ")}.\n` +
      "    Ajouter `const refus = await exigerOuverture(ctx); if (refus) return refus;`\n" +
      "    au début du handler, ou l'inscrire dans EXEMPTEES avec sa raison."
  );
});

essai("une exemption ne survit pas à la route qu'elle exempte", () => {
  // Une exemption laissée derrière une route supprimée finirait par couvrir une
  // route neuve du même nom, sans que personne l'ait décidé.
  const connues = new Set(ROUTES.map((r) => r.cle));
  const fantomes = Object.keys(EXEMPTEES).filter((c) => !connues.has(c));
  assert.deepEqual(fantomes, [], `exemption(s) sans route : ${fantomes.join(", ")}`);
});

essai("la garde passe AVANT la lecture", () => {
  // Refuser après avoir lu ne referme rien : la donnée est déjà sortie.
  for (const { cle, fichier } of ROUTES) {
    if (cle in EXEMPTEES) continue;
    const source = readFileSync(fichier, "utf8");
    const garde = source.indexOf("exigerOuverture(");
    const lecture = source.search(/await (withEntreprise|generer|lister|lire)/);
    if (lecture < 0) continue;
    assert.ok(garde < lecture, `${cle} lit des données AVANT de vérifier le rôle`);
  }
});

essai("la garde des écrans est bien montée dans la mise en page racine", () => {
  // Elle n'est appelée nulle part ailleurs : si quelqu'un la retire du layout,
  // TOUS les écrans s'ouvrent d'un coup, et rien à l'écran ne le montre.
  const layout = readFileSync(path.join(__dirname, "..", "src", "app", "layout.tsx"), "utf8");
  assert.ok(layout.includes("<GardeAcces />"), "GardeAcces n'est plus rendue dans layout.tsx");
});

console.log("");
console.log(`Les routes d'API et leur garde — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
