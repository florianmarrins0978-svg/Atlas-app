import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// **Le blocage du 29 août 2026, et le contrôle qui l'empêche de revenir.**
//
// *« L'appli est en mode lent, les fichiers n'arrivent pas à charger, elle bug
// souvent. »* Sa capture montrait « Version rapide en construction — 2 écrans
// sur 32 », sa fiche disait « construction en cours ». Depuis des jours.
//
// La cause, mesurée : le préchauffage prend 887 Mo au serveur de développement,
// la construction en veut 2 500, et son espace n'en a que 2 900 de disponibles.
// La construction se faisait tuer par le noyau, le veilleur en relançait une,
// et le banc restait lent indéfiniment.
//
// Ce que cette suite tient, et pourquoi chaque cas existe :
//
//   1. **la machine du patron refuse de préchauffer** — c'est le cas réel, avec
//      son chiffre à lui. Si quelqu'un abaisse le seuil, ce cas rougit ;
//   2. **une machine confortable préchauffe toujours** — le remède ne doit pas
//      punir les espaces qui n'ont aucun problème, sans quoi on ramènerait le
//      504 du 9 août sans raison ;
//   3. **le refus DIT ce qui se passe et quand ça s'arrête** — un banc lent sans
//      explication est exactement ce qu'on répare ; une phrase qui décrit sans
//      borner se relit sans rassurer ;
//   4. **une mesure impossible ne vaut pas un feu vert silencieux** ;
//   5. **`MemAvailable` est lu, jamais `MemFree`** — sur son espace le second
//      vaut 143 Mo quand 2 900 sont réellement allouables. Confondre les deux
//      refuserait de préchauffer partout, y compris là où tout va bien.

import {
  peutPrechauffer,
  memoireDisponibleMo,
  CONSTRUCTION_MO,
  PRECHAUFFAGE_MO,
  SEUIL_MO,
} from "./memoire-prechauffage.mjs";

let echecs = 0;
function verifier(intitule: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${intitule}`);
  } catch (err) {
    echecs++;
    console.error(`❌ ${intitule}`);
    console.error(`   ${(err as Error).message}`);
  }
}

// --- 1. Son espace, avec son chiffre à lui -------------------------------

verifier("son espace (2 900 Mo disponibles) NE préchauffe pas", () => {
  const { possible } = peutPrechauffer(2900);
  assert.equal(
    possible,
    false,
    "avec 2 900 Mo, préchauffer laisse 2 013 Mo à une construction qui en veut 2 500 : " +
      "elle se fait tuer, et le banc reste lent pour toujours"
  );
});

verifier("le refus laisse VRAIMENT la place à la construction", () => {
  // La vérification de fond, et elle ne dépend d'aucun seuil écrit à la main :
  // ce qui reste après le refus doit suffire à bâtir.
  const disponible = 2900;
  const { possible } = peutPrechauffer(disponible);
  assert.equal(possible, false);
  assert.ok(
    disponible >= CONSTRUCTION_MO,
    `sans préchauffage il reste ${disponible} Mo pour une construction de ${CONSTRUCTION_MO} Mo`
  );
  assert.ok(
    disponible - PRECHAUFFAGE_MO < CONSTRUCTION_MO,
    "si préchauffer laissait assez de place, ce refus n'aurait pas lieu d'être"
  );
});

// --- 2. Les machines qui ont la place ne perdent rien ---------------------

verifier("un espace confortable (13 Go) préchauffe comme avant", () => {
  const { possible, motif } = peutPrechauffer(13_000);
  assert.equal(possible, true, "le remède ne doit pas punir une machine qui n'a aucun problème");
  assert.equal(motif, null, "rien à signaler quand tout va bien : un message inutile s'apprend à être ignoré");
});

verifier("le seuil sépare bien les deux mondes", () => {
  assert.equal(peutPrechauffer(SEUIL_MO).possible, true, "au seuil exact, on préchauffe");
  assert.equal(peutPrechauffer(SEUIL_MO - 1).possible, false, "un mégaoctet en dessous, on s'abstient");
});

// --- 3. Le refus se dit, et il se dit au patron ---------------------------

verifier("le refus nomme le chiffre, et borne l'attente", () => {
  const { motif } = peutPrechauffer(2900);
  assert.ok(motif, "un refus muet laisse un banc lent sans explication — le défaut qu'on répare");
  assert.match(motif!, /2900|2 900/, "le motif doit citer la mémoire réellement mesurée");
  assert.match(
    motif!,
    /pas au-delà|le temps de la construction/,
    "sans borne, il croira que la lenteur est définitive — c'est justement ce qu'il vient de vivre"
  );
});

verifier("le refus ne parle pas de mécanisme au patron", () => {
  const { motif } = peutPrechauffer(2900);
  for (const jargon of ["Turbopack", "next build", "RSS", "V8", "worker"]) {
    assert.ok(
      !motif!.includes(jargon),
      `« ${jargon} » n'a rien à faire sous ses yeux : il veut savoir quoi attendre, pas comment ça marche`
    );
  }
});

// --- 4. Une mesure impossible n'est pas un feu vert silencieux ------------

for (const valeur of [null, undefined, NaN, 0, -1, "beaucoup"]) {
  verifier(`mémoire illisible (${JSON.stringify(valeur)}) : on préchauffe, mais on le dit`, () => {
    const { possible, motif } = peutPrechauffer(valeur as number);
    assert.equal(possible, true, "refuser sur une machine inconnue ramènerait le 504 du 9 août sans raison");
    assert.ok(motif, "sans trace, un banc bloqué resterait inexpliqué — la faute qu'on vient de payer");
  });
}

// --- 5. `MemAvailable`, jamais `MemFree` ---------------------------------

// Le `/proc/meminfo` de son espace, au chiffre près (fiche du 29 août 2026).
const MEMINFO_DU_PATRON = [
  "MemTotal:        8503716 kB",
  "MemFree:          146432 kB",
  "MemAvailable:    2969600 kB",
  "Buffers:           87040 kB",
  "Cached:          3170304 kB",
].join("\n");

verifier("la mémoire lue est MemAvailable, pas MemFree", () => {
  const mo = memoireDisponibleMo(() => MEMINFO_DU_PATRON);
  assert.equal(mo, 2900, `lu ${mo} Mo — 143 signifierait qu'on a pris MemFree, et l'on refuserait partout`);
});

verifier("son espace, lu de bout en bout, refuse de préchauffer", () => {
  // Le contrôle complet : de son `/proc/meminfo` réel jusqu'à la décision.
  const mo = memoireDisponibleMo(() => MEMINFO_DU_PATRON);
  assert.equal(peutPrechauffer(mo).possible, false);
});

verifier("un /proc/meminfo sans MemAvailable ne fabrique pas un chiffre", () => {
  const sansLaLigne = "MemTotal:        8503716 kB\nMemFree:          146432 kB";
  assert.equal(memoireDisponibleMo(() => sansLaLigne), null, "on ne devine pas une mémoire");
});

verifier("un /proc illisible ne fait pas tomber le banc", () => {
  assert.equal(
    memoireDisponibleMo(() => {
      throw new Error("ENOENT");
    }),
    null,
    "sur une machine sans /proc, on ne sait pas — ce n'est pas une panne"
  );
});

// --- Le contrôle sait-il rougir ? ----------------------------------------
//
// Un contrôle jamais vu rouge ne prouve rien (`CLAUDE.md` §5). On confronte
// donc la règle à la version d'AVANT — celle qui préchauffait toujours — et
// l'on vérifie qu'elle serait refusée ici.
verifier("la règle d'avant (préchauffer toujours) serait REFUSÉE par cette suite", () => {
  const toujours = () => ({ possible: true, motif: null });
  assert.equal(
    toujours().possible,
    true,
    "garde-fou de lecture : c'est bien le comportement d'avant qu'on décrit"
  );
  assert.notEqual(
    peutPrechauffer(2900).possible,
    toujours().possible,
    "si la règle rendait le même verdict que l'ancienne sur SA machine, elle ne répare rien"
  );
});

// --- La règle est-elle BRANCHÉE, et au bon endroit ? ---------------------
//
// Une règle juste que personne n'appelle ne répare rien — ce dépôt a déjà payé
// ce défaut exact : `prechauffer.mjs` portait un rappel `avancer` documenté et
// éprouvé depuis le 9 août 2026, et **personne ne le lui passait**, si bien que
// le bandeau du patron n'a affiché aucun chiffre pendant cinq jours.
//
// Ce contrôle est structurel, et il l'assume : il ne remplace pas un banc
// démarré. Il attrape ce qu'une suite unitaire ne voit jamais — une garde
// retirée, ou déplacée APRÈS le préchauffage qu'elle doit empêcher.
const BANC = readFileSync(path.join(__dirname, "banc.mjs"), "utf8");

verifier("le banc importe la garde", () => {
  assert.match(
    BANC,
    /import \{[^}]*peutPrechauffer[^}]*\} from "\.\/memoire-prechauffage\.mjs"/,
    "la règle n'est pas importée : elle ne s'appliquera jamais"
  );
});

verifier("la garde est consultée AVANT d'ouvrir une session de préchauffage", () => {
  const garde = BANC.indexOf("peutPrechauffer(memoireDisponibleMo(");
  const session = BANC.indexOf("await cookieDeSession(");
  assert.ok(garde > 0, "l'appel à la garde a disparu de banc.mjs");
  assert.ok(session > 0, "garde-fou de lecture : le préchauffage complet a changé de forme");
  assert.ok(
    garde < session,
    "la garde passe APRÈS le préchauffage : elle constaterait le dégât au lieu de l'éviter"
  );
});

verifier("un refus ARRÊTE le préchauffage, il ne se contente pas d'un message", () => {
  const garde = BANC.indexOf("peutPrechauffer(memoireDisponibleMo(");
  const session = BANC.indexOf("await cookieDeSession(");
  const entreLesDeux = BANC.slice(garde, session);
  assert.match(
    entreLesDeux,
    /if \(!place\.possible\)[\s\S]*?return;/,
    "sans ce retour, on afficherait le refus puis on préchaufferait quand même — " +
      "et la construction se ferait tuer exactement comme avant"
  );
});

console.log(
  echecs === 0
    ? "\n✅ Mémoire et préchauffage : toutes les vérifications passent.\n"
    : `\n❌ ${echecs} vérification(s) en échec.\n`
);
process.exit(echecs === 0 ? 0 : 1);
