import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  FICHIER_VERDICT,
  commandeDuNiveau,
  evaluerLeLot,
  poussseVersMain,
  rougesToleres,
  verdictSuffit,
} from "./_niveau-de-risque.mjs";
import { cheminDeLaReference, commitCourant, ecrireReference } from "./_reference-batterie.mjs";
import { construireLeGraphe, routeDeLEcran } from "./_rayon-impact.mjs";
import { suitesDesRoutes } from "./_suites-ciblees.mjs";

/**
 * **LE GARDE-FOU QUI NE DÉPEND PAS DE LA MÉMOIRE DE LA SESSION.**
 *
 * Sa demande du 13 septembre 2026 : une session ne doit pas pouvoir fusionner
 * un lot dont les contrôles de son niveau de risque ont échoué. Une consigne en
 * prose s'oublie au bout de trois heures — or c'est à ce moment-là qu'on livre.
 *
 * Cette suite montre au garde-fou **autant de gestes à laisser passer qu'à
 * refuser** : un garde-fou qui parle à tort s'apprend à être ignoré, et l'on
 * perd alors la protection sans s'en apercevoir (`CLAUDE.md` §1 bis).
 */

const RACINE = path.join(__dirname, "..");
const HOOK = path.join(__dirname, "garde-fusion-main.mjs");

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

/** Joue le hook avec une commande, et rend ce qu'il a décidé. */
function jouer(commande: string): { refuse: boolean; message: string } {
  try {
    // Ce qu'il DIT en laissant passer compte aussi : un rouge toléré s'annonce.
    const sortie = execFileSync("node", [HOOK], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command: commande } }),
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: RACINE },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { refuse: false, message: sortie };
  } catch (e) {
    const erreur = e as { status?: number; stderr?: string };
    return { refuse: erreur.status === 2, message: erreur.stderr ?? "" };
  }
}

console.log("=== MAX(plancher, rayon, gravité) — sur un graphe FABRIQUÉ ===");

/**
 * Un graphe d'essai, pour que ces cas-là ne dépendent pas de l'arbre du jour.
 *
 * Une suite qui interroge le vrai dépôt rougirait le jour où un écran gagne un
 * import — sur du code juste, et pour une raison qui n'a rien à voir avec elle
 * (`CLAUDE.md` §5 bis). Ce qui se fixe ici, c'est la RÈGLE ; les cas réels sont
 * éprouvés plus bas, sur le vrai graphe.
 */
function grapheFabrique(rayons: Record<string, string[]>) {
  return {
    connait: (f: string) => f in rayons,
    connaît: (f: string) => f in rayons,
    estPointDentrée: (f: string) => (rayons[f] ?? []).includes(f),
    pointsAtteints: (f: string) => rayons[f] ?? [],
    rayon: (f: string) => (rayons[f] ?? []).length,
  };
}

/** Un écran local, couvert par une suite : le cas du lot client. */
const LOCAL = "src/app/clients/[id]/page.tsx";
/** Onze points d'entrée : un de plus que le seuil. */
const PARTAGE = "src/lib/quelque-chose-de-partage.ts";

const graphe = grapheFabrique({
  [LOCAL]: [LOCAL],
  [PARTAGE]: Array.from({ length: 11 }, (_, i) => `src/app/ecran-${i}/page.tsx`),
  "src/app/chantiers/[id]/facture/actions.ts": ["src/app/chantiers/[id]/facture/page.tsx"],
  "src/server/db/with-entreprise.ts": ["src/app/planning/page.tsx"],
  "src/auth.ts": ["src/app/planning/page.tsx"],
});
const evaluer = (chemins: string[]) => evaluerLeLot(chemins, { racine: RACINE, graphe });

cas("changement LOCAL client → niveau 2", () => {
  const lot = evaluer([LOCAL, "scripts/test-modifier-client-e2e.ts", "CHANGELOG.md"]);
  assert.equal(lot.niveau, 2, `attendu 2, obtenu ${lot.niveau} — ${lot.raison}`);
  assert.equal(lot.risque, "moyen");
  assert.equal(lot.rayonMaximal, 1);
  assert.deepEqual(lot.routes, ["/clients"], "l'écran atteint doit être nommé, pour savoir quoi jouer");
});

cas("fichier partagé à FORT RAYON → niveau 3", () => {
  const lot = evaluer([PARTAGE]);
  assert.equal(lot.niveau, 3, "un fichier qui atteint onze écrans est passé en niveau 2");
  assert.match(lot.raison, /rayon de 11/);
});

cas("le seuil est franchi À 10, pas à 11", () => {
  const dix = grapheFabrique({ [PARTAGE]: Array.from({ length: 10 }, (_, i) => `src/app/e${i}/page.tsx`) });
  const neuf = grapheFabrique({ [PARTAGE]: Array.from({ length: 9 }, (_, i) => `src/app/e${i}/page.tsx`) });
  assert.equal(evaluerLeLot([PARTAGE], { racine: RACINE, graphe: dix }).niveau, 3);
  // Neuf écrans : le rayon dit 2 — mais aucune suite ne les ouvre, donc 3.
  // C'est la règle « rien ne pourrait le regarder », éprouvée juste en dessous.
  assert.equal(evaluerLeLot([PARTAGE], { racine: RACINE, graphe: neuf }).rayonMaximal, 9);
});

cas("une MIGRATION → niveau 3, même seule", () => {
  const lot = evaluer(["drizzle/0092_une_colonne.sql"]);
  assert.equal(lot.niveau, 3);
  assert.match(lot.raison, /données/, "la raison doit dire pourquoi une migration échappe au graphe");
});

cas("AUTH, sessions, RLS, isolation → niveau 3", () => {
  for (const chemin of [
    "src/auth.ts",
    "src/auth.config.ts",
    "src/middleware.ts",
    "src/server/db/with-entreprise.ts",
    "src/server/session-ctx.ts",
    "src/server/repositories/context.ts",
    "src/lib/acces-roles.ts",
  ]) {
    assert.equal(evaluer([chemin]).niveau, 3, `${chemin} n'a pas été vu comme dangereux`);
  }
});

cas("FACTURATION, TVA, règlements → niveau 3 même à rayon 1", () => {
  const lot = evaluer(["src/app/chantiers/[id]/facture/actions.ts"]);
  assert.equal(lot.rayonMaximal, 1, "ce fichier n'atteint qu'un écran…");
  assert.equal(lot.niveau, 3, "…et il doit quand même valoir la batterie entière");
  assert.match(lot.raison, /argent|factur/i);
  for (const chemin of [
    "src/lib/tva.ts",
    "src/server/repositories/reglements.ts",
    "src/lib/montant-du-devis.ts",
    "src/app/chantiers/[id]/prix/actions.ts",
  ]) {
    assert.equal(evaluer([chemin]).niveau, 3, `${chemin} touche à l'argent et est passé en dessous de 3`);
  }
});

cas("impact INDÉTERMINABLE → niveau 3", () => {
  // Une route d'API : ses appelants passent par « fetch », qu'aucun import ne relie.
  assert.equal(evaluer(["src/app/api/adresses/route.ts"]).niveau, 3);
  // Un fichier que le graphe ne sait pas lire.
  assert.equal(evaluer(["src/app/un-style.css"]).niveau, 3);
  // Un fichier que l'arbre ne porte plus : effacé ou renommé.
  const lot = evaluer(["src/lib/disparu.ts"]);
  assert.equal(lot.niveau, 3);
  assert.match(lot.raison, /absent de l'arbre/);
});

cas("un écran qu'AUCUNE suite n'ouvre → niveau 3", () => {
  // Le niveau 2 ne tient que parce qu'une suite navigateur regarde l'écran
  // atteint. Sans elle, il n'y a rien à jouer qui le regarde.
  const orphelin = "src/app/design/a/page.tsx";
  const lot = evaluerLeLot([orphelin], {
    racine: RACINE,
    graphe: grapheFabrique({ [orphelin]: [orphelin] }),
  });
  assert.equal(lot.niveau, 3);
  assert.match(lot.raison, /aucune suite navigateur/);
});

cas("l'outillage → niveau 2", () => {
  assert.equal(evaluer(["scripts/test-x.ts"]).niveau, 2);
  assert.equal(evaluer([".claude/rules/testing.md"]).niveau, 2);
  assert.equal(evaluer([".devcontainer/demarrer.sh"]).niveau, 2);
});

cas("ce qui ne s'exécute pas → niveau 1", () => {
  const lot = evaluer(["docs/rapport.md", "appli/essais.html", "CHANGELOG.md"]);
  assert.equal(lot.niveau, 1);
  assert.equal(lot.risque, "faible");
});

cas("et chaque niveau nomme SA commande", () => {
  assert.equal(commandeDuNiveau(3), "npm run verifier:avant-livraison");
  assert.equal(commandeDuNiveau(2), "npm run verifier:avant-fusion");
  assert.equal(commandeDuNiveau(1), null);
});

console.log("\n=== Le rayon se mesure sur le VRAI dépôt ===");

const vrai = construireLeGraphe(RACINE);

cas("une pièce partagée que personne ne liste est vue quand même", () => {
  // `civilite.ts` ne figure sur AUCUNE liste de « fichiers centraux » — c'est
  // précisément pourquoi une liste écrite à la main a été refusée.
  const r = vrai.rayon("src/lib/civilite.ts");
  assert.ok(r >= 10, `civilite.ts n'atteint que ${r} point(s) d'entrée : le calcul ne voit plus rien`);
  assert.equal(evaluerLeLot(["src/lib/civilite.ts"], { racine: RACINE, graphe: vrai }).niveau, 3);
});

cas("un écran de bout de chaîne reste local", () => {
  assert.equal(vrai.rayon("src/app/clients/[id]/page.tsx"), 1);
});

cas("l'adresse d'un écran se déduit de son chemin, coupée au premier paramètre", () => {
  assert.equal(routeDeLEcran("src/app/clients/[id]/page.tsx"), "/clients");
  assert.equal(routeDeLEcran("src/app/page.tsx"), "/");
  assert.equal(routeDeLEcran("src/app/reglages/notifications/page.tsx"), "/reglages/notifications");
  assert.equal(routeDeLEcran("src/server/repositories/clients.ts"), null);
});

cas("les suites d'un écran se DÉRIVENT de ce qu'elles ouvrent", () => {
  const suites = suitesDesRoutes(RACINE, ["/clients"]);
  assert.ok(suites.includes("fiche-client"), `« /clients » ne rend pas fiche-client : ${suites.join(", ")}`);
  assert.equal(suitesDesRoutes(RACINE, ["/une-adresse-qui-n-existe-pas"]).length, 0);
});

console.log("\n=== Ce qui est visé, et ce qui ne l'est pas ===");

cas("les trois façons de pousser sur main sont vues", () => {
  assert.ok(poussseVersMain("git push origin ma-branche:main", "ma-branche"));
  assert.ok(poussseVersMain("git push origin main", "autre"));
  assert.ok(poussseVersMain("git push", "main"));
});

cas("une poussée sur SA branche passe — on y met son travail à l'abri", () => {
  assert.ok(!poussseVersMain("git push -u origin claude/mon-lot", "claude/mon-lot"));
  assert.ok(!poussseVersMain("git push", "claude/mon-lot"));
});

cas("et tout le reste passe : lire, commiter, fusionner en local", () => {
  for (const commande of [
    "git status",
    "git commit -m 'un message qui parle de git push origin main'",
    "git merge origin/main",
    "npm test",
    "git fetch origin main",
  ]) {
    assert.ok(!poussseVersMain(commande, "claude/mon-lot"), `refusé à tort : ${commande}`);
  }
});

console.log("\n=== Le verdict doit être VERT, au bon niveau, sur CET arbre ===");

const VERT_3 = { quand: 2_000, vert: true, niveau: 3 };

cas("aucune vérification jouée : refus", () => {
  const { suffit, raison } = verdictSuffit(null, { niveau: 3, derniereEcriture: 1_000 });
  assert.equal(suffit, false);
  assert.match(raison, /aucune vérification/);
});

cas("une vérification ROUGE ne vaut pas une vérification", () => {
  // Un rouge qu'on laisse derrière soi ne doit pas ouvrir la fusion : c'est
  // exactement ce que le patron a demandé le 13 septembre.
  const { suffit, raison } = verdictSuffit({ ...VERT_3, vert: false }, { niveau: 3, derniereEcriture: 1_000 });
  assert.equal(suffit, false);
  assert.match(raison, /ROUGE/);
});

cas("un fichier touché APRÈS le verdict : refus", () => {
  const { suffit, raison } = verdictSuffit(VERT_3, { niveau: 3, derniereEcriture: 9_000 });
  assert.equal(suffit, false);
  assert.match(raison, /l'arbre a changé/);
});

cas("un niveau 2 ne suffit pas pour un lot de niveau 3", () => {
  const { suffit, raison } = verdictSuffit({ ...VERT_3, niveau: 2 }, { niveau: 3, derniereEcriture: 1_000 });
  assert.equal(suffit, false);
  assert.match(raison, /niveau 2/);
});

cas("une trace d'AVANT le champ « niveau » ne suffit pas non plus", () => {
  const { suffit } = verdictSuffit({ quand: 2_000, vert: true }, { niveau: 2, derniereEcriture: 1_000 });
  assert.equal(suffit, false, "un verdict sans niveau a été pris pour suffisant");
});

cas("le bon niveau sur un arbre inchangé passe", () => {
  assert.equal(verdictSuffit(VERT_3, { niveau: 3, derniereEcriture: 1_000 }).suffit, true);
  assert.equal(verdictSuffit(VERT_3, { niveau: 2, derniereEcriture: 1_000 }).suffit, true);
});

console.log("\n=== Un ROUGE n'ouvre la porte que s'il n'a AUCUN rouge nouveau par rapport à main ===");
// Sa règle du 16 septembre 2026 : « état de référence connu + nouveau lot →
// aucun nouveau rouge autorisé. Un test qui était vert avant et devient rouge
// doit bloquer. Un nouveau test rouge doit bloquer. Un rouge préexistant
// identique ne doit pas empêcher éternellement toutes les futures fusions. »

const REFERENCE = { quand: 1_500, commit: "abcdef0123456789", rouges: ["test-outil-a.ts", "test-outil-b.ts"], niveau: 3 };
const ROUGE_CONNU = { quand: 2_000, vert: false, niveau: 3, rouges: ["test-outil-a.ts", "test-outil-b.ts"], rougesHorsSuites: [] };

cas("les MÊMES rouges que main, et rien d'autre : la fusion s'ouvre, et dit ce qu'elle tolère", () => {
  const r = verdictSuffit(ROUGE_CONNU, { niveau: 3, derniereEcriture: 1_000, reference: REFERENCE, referenceEstAncetre: true });
  assert.equal(r.suffit, true, r.raison);
  assert.deepEqual(r.toleres, ["test-outil-a.ts", "test-outil-b.ts"]);
});

cas("un sous-ensemble des rouges de main passe aussi — un rouge réparé n'est pas un rouge nouveau", () => {
  const r = rougesToleres({ ...ROUGE_CONNU, rouges: ["test-outil-b.ts"] }, REFERENCE, true);
  assert.equal(r.ok, true);
});

cas("une suite VERTE SUR MAIN devenue rouge : refus, et elle est NOMMÉE", () => {
  const r = rougesToleres({ ...ROUGE_CONNU, rouges: ["test-outil-a.ts", "test-facture-e2e.ts"] }, REFERENCE, true);
  assert.equal(r.ok, false);
  assert.match(r.raison, /1 nouveau\(x\) rouge\(s\)/);
  assert.match(r.raison, /test-facture-e2e\.ts/);
  assert.doesNotMatch(r.raison, /test-outil-a/, "un rouge connu a été présenté comme nouveau");
});

cas("une suite NOUVELLE et rouge : refus — elle n'existait pas sur main, donc elle n'y était pas rouge", () => {
  const r = rougesToleres({ ...ROUGE_CONNU, rouges: ["test-outil-a.ts", "test-toute-neuve.ts"] }, REFERENCE, true);
  assert.equal(r.ok, false);
  assert.match(r.raison, /test-toute-neuve\.ts/);
});

cas("une étape HORS SUITES tombée (types, construction, connexion) : refus, quoi que dise la référence", () => {
  const r = rougesToleres({ ...ROUGE_CONNU, rougesHorsSuites: ["Construction"] }, REFERENCE, true);
  assert.equal(r.ok, false);
  assert.match(r.raison, /hors des suites : Construction/);
});

cas("un bilan INCOMPLET (le serveur est mort au milieu) : refus — un rouge sans nom est un rouge nouveau", () => {
  const r = rougesToleres({ ...ROUGE_CONNU, rougesHorsSuites: ["Suites navigateur (bilan incomplet)"] }, REFERENCE, true);
  assert.equal(r.ok, false);
});

cas("un verdict d'AVANT le champ « rouges » : refus, on rejoue", () => {
  const r = rougesToleres({ quand: 2_000, vert: false, niveau: 3 }, REFERENCE, true);
  assert.equal(r.ok, false);
  assert.match(r.raison, /sans la liste/);
});

cas("SANS référence mesurée sur main : la règle d'avant — un rouge ne passe pas", () => {
  const r = rougesToleres(ROUGE_CONNU, null, false);
  assert.equal(r.ok, false);
  assert.match(r.raison, /aucun état de référence/);
});

cas("une référence qui n'est PAS dans l'histoire du lot ne dit rien de lui : refus", () => {
  const r = rougesToleres(ROUGE_CONNU, REFERENCE, false);
  assert.equal(r.ok, false);
  assert.match(r.raison, /n'est pas dans l'histoire/);
});

cas("tolérer un rouge connu ne dispense ni du niveau ni de l'arbre inchangé", () => {
  assert.equal(
    verdictSuffit({ ...ROUGE_CONNU, niveau: 2 }, { niveau: 3, derniereEcriture: 1_000, reference: REFERENCE, referenceEstAncetre: true }).suffit,
    false
  );
  assert.equal(
    verdictSuffit(ROUGE_CONNU, { niveau: 3, derniereEcriture: 9_000, reference: REFERENCE, referenceEstAncetre: true }).suffit,
    false
  );
});

console.log("\n=== Le hook, joué pour de vrai ===");

const TEMOIN = path.join(RACINE, FICHIER_VERDICT);
const SAUVEGARDE = `${TEMOIN}.epreuve`;
const avaitUnVerdict = existsSync(TEMOIN);
if (avaitUnVerdict) renameSync(TEMOIN, SAUVEGARDE);
// La référence de la machine est mise de côté de la même façon : ces cas en
// écrivent une à eux, et celle qui existait doit revenir intacte.
const REFERENCE_MACHINE = cheminDeLaReference(RACINE)!;
const REFERENCE_SAUVEE = `${REFERENCE_MACHINE}.epreuve`;
const avaitUneReference = existsSync(REFERENCE_MACHINE);
if (avaitUneReference) renameSync(REFERENCE_MACHINE, REFERENCE_SAUVEE);
// **Un lot à éprouver, quel que soit l'arbre du jour — 16 septembre 2026.** Ces
// cas jouent le hook sur le VRAI diff avec origin/main. Sur un main propre —
// exactement l'état où l'on mesure la référence — ce diff est vide, le lot vaut
// niveau 1, et le hook laisse tout passer : la suite rougissait donc sur main,
// et un rouge sur main devient un rouge « connu ». Un fichier d'outillage en
// attente suffit à faire un lot de niveau 2, et il part avec la suite.
const LOT_D_EPREUVE = path.join(__dirname, "_epreuve-garde-fusion-en-cours.mjs");
writeFileSync(LOT_D_EPREUVE, "// écrit par test-garde-fusion-main.ts, effacé par elle\n");

try {
  cas("sans verdict, une poussée sur main est REFUSÉE, et le refus dit quoi faire", () => {
    rmSync(TEMOIN, { force: true });
    const { refuse, message } = jouer("git push origin claude/mon-lot:main");
    assert.ok(refuse, "le hook a laissé passer une fusion non éprouvée");
    assert.match(message, /verifier:avant-(fusion|livraison)/, "le refus ne dit pas la commande à jouer");
    assert.match(message, /Niveau requis : [23]/, "le refus ne dit pas le niveau exigé");
    assert.match(message, /Risque : (faible|moyen|élevé)/, "le refus n'annonce pas le risque");
    assert.match(message, /Raison : /, "le refus ne dit pas CE QUI a décidé du niveau");
    assert.match(message, /Contrôles exigés : /, "le refus ne dit pas les contrôles à jouer");
  });

  cas("une poussée sur la branche de session passe, même sans verdict", () => {
    rmSync(TEMOIN, { force: true });
    assert.equal(jouer("git push -u origin claude/mon-lot").refuse, false);
  });

  cas("avec le verdict de CET arbre au bon niveau, la fusion passe", () => {
    // Un verdict vert de niveau 3, postérieur à tout ce que l'arbre porte.
    writeFileSync(TEMOIN, JSON.stringify({ quand: Date.now() + 60_000, vert: true, niveau: 3, empreinte: [] }));
    assert.equal(jouer("git push origin claude/mon-lot:main").refuse, false);
  });

  cas("un verdict ROUGE dont chaque rouge est déjà rouge sur main OUVRE la fusion, en le disant", () => {
    // La référence est écrite dans le .git commun de CE dépôt, sur le commit
    // courant — donc forcément un ancêtre. Sauvegardée et rendue plus bas.
    ecrireReference(RACINE, { quand: 1_000, commit: commitCourant(RACINE)!, rouges: ["test-outil-windows.ts"], niveau: 3 });
    writeFileSync(
      TEMOIN,
      JSON.stringify({ quand: Date.now() + 60_000, vert: false, niveau: 3, empreinte: [], rouges: ["test-outil-windows.ts"], rougesHorsSuites: [] })
    );
    const { refuse, message } = jouer("git push origin claude/mon-lot:main");
    assert.equal(refuse, false, `refusé : ${message}`);
    assert.match(message, /Fusion ouverte avec 1 rouge\(s\)/, "ce qui est toléré doit être DIT");
    assert.match(message, /test-outil-windows\.ts/);
  });

  cas("le même verdict avec UN rouge de plus est refusé, et le refus nomme le nouveau", () => {
    writeFileSync(
      TEMOIN,
      JSON.stringify({
        quand: Date.now() + 60_000,
        vert: false,
        niveau: 3,
        empreinte: [],
        rouges: ["test-outil-windows.ts", "test-facture-e2e.ts"],
        rougesHorsSuites: [],
      })
    );
    const { refuse, message } = jouer("git push origin claude/mon-lot:main");
    assert.ok(refuse, "un rouge nouveau a ouvert la fusion");
    assert.match(message, /test-facture-e2e\.ts/);
  });

  cas("un verdict d'un autre arbre ne suffit plus", () => {
    // Le même, mais rendu AVANT le dernier fichier écrit : l'arbre a bougé.
    writeFileSync(TEMOIN, JSON.stringify({ quand: 1_000, vert: true, niveau: 3, empreinte: [] }));
    const { refuse, message } = jouer("git push origin claude/mon-lot:main");
    assert.ok(refuse, "un verdict périmé a été accepté");
    assert.match(message, /l'arbre a changé/);
  });

  cas("les deux commandes de vérification déposent bien ce témoin", () => {
    // Ce qui n'est pas MONTÉ ne sert à rien (la leçon du 28 août).
    for (const fichier of ["verifier-avant-livraison.ts", "verifier-avant-fusion.ts"]) {
      const source = readFileSync(path.join(__dirname, fichier), "utf8");
      assert.match(
        source,
        /ecrireDernierVerdict\(/,
        `${fichier} ne dépose aucun témoin : le garde-fou refusera toujours`
      );
      assert.match(source, /niveau: [23]/, `${fichier} ne dit pas à quel niveau il a mesuré`);
    }
  });
} finally {
  rmSync(LOT_D_EPREUVE, { force: true });
  rmSync(TEMOIN, { force: true });
  if (avaitUnVerdict) renameSync(SAUVEGARDE, TEMOIN);
  rmSync(REFERENCE_MACHINE, { force: true });
  if (avaitUneReference) renameSync(REFERENCE_SAUVEE, REFERENCE_MACHINE);
}

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le garde-fou de la fusion — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
