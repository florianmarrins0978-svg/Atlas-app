// Le rapport que l'espace publie peut-il laisser fuir une clé ?
//
// **Ce contrôle existe avant tout pour dire non.** Le 12 août 2026, le patron
// demande que l'agent voie son espace. La réponse retenue est une fiche GitHub
// que sa machine écrit toute seule — sens unique : il pousse, l'agent lit. Mais
// une machine qui publie son journal de démarrage publie tout ce qui s'y trouve,
// y compris ce qui n'aurait jamais dû sortir.
//
// La censure est volontairement GROSSIÈRE : une ligne innocente retirée ne coûte
// qu'une gêne de lecture, une clé publiée coûte une clé. Ces cas tiennent les
// deux bouts — ce qui doit disparaître, et ce qui doit rester lisible.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  expurger,
  corpsDuRapport,
  TITRE_FICHE,
  extraireDepot,
  choisirFiche,
} from "./rapporter-espace.mjs";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Le rapport de l'espace ne publie pas de secret ===");

cas("une clé d'IA dans le journal ne sort pas", () => {
  const journal = [
    "→ Démarrage",
    "ANTHROPIC_API_KEY=sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "L'application répond",
  ].join("\n");
  const sorti = expurger(journal);
  assert.ok(!sorti.includes("sk-ant-api03"), "la clé est passée dans le rapport publié");
  assert.ok(sorti.includes("L'application répond"), "la censure a emporté une ligne utile");
});

cas("une adresse de base de données ne sort pas", () => {
  const sorti = expurger("DATABASE_URL=postgresql://atlas:motdepasse@10.0.0.4:5432/atlas");
  assert.ok(!sorti.includes("motdepasse"), "le mot de passe de la base est publié");
  assert.ok(!sorti.includes("10.0.0.4"), "l'adresse interne de la base est publiée");
});

cas("un jeton GitHub ne sort pas", () => {
  for (const jeton of ["ghp_abcdefghijklmnopqrstuvwxyz0123456789", "github_pat_11ABCDEF_xyz"]) {
    assert.ok(!expurger(`token: ${jeton}`).includes(jeton), `le jeton ${jeton.slice(0, 8)}… est publié`);
  }
});

cas("le compte de démonstration RESTE lisible : il est public", () => {
  // Le censurer ne protégerait rien — il est écrit dans le dépôt et affiché à
  // chaque démarrage — et rendrait le rapport inutilisable pour diagnostiquer.
  const sorti = expurger("     demo@atlas.local  /  demo1234");
  assert.ok(sorti.includes("demo@atlas.local"), "le compte de démonstration a été censuré pour rien");
});

cas("le journal de démarrage NE PART PAS : le dépôt est public", () => {
  // **Tranché par le patron le 12 août 2026**, une fois découvert que son dépôt
  // est public. La fiche y est lisible par n'importe qui et indexée ; une
  // censure faite au jugé laisse forcément passer l'imprévu, et le prix d'un
  // oubli n'est plus une gêne de lecture mais une clé publiée sur la place.
  //
  // Ce cas existe parce que la tentation reviendra : devant un serveur muet, on
  // voudra « juste les dernières lignes ». Ce qu'il faudra écrire alors est une
  // extraction STRUCTURÉE — le nom de l'erreur, pas les lignes autour.
  const corps = corpsDuRapport({
    diagnostic: "Serveur : répond",
    quand: "2026-08-12T06:00:00.000Z",
  });
  assert.ok(
    !/dernières lignes du démarrage/.test(corps),
    "le journal de démarrage est revenu dans la fiche — sur un dépôt PUBLIC"
  );
  assert.match(
    corps,
    /journal de démarrage n'est \*\*pas\*\* publié/,
    "rien n'explique dans la fiche pourquoi le journal en est absent : " +
      "quelqu'un le remettra en croyant réparer un oubli"
  );

  // Le témoin : si `corpsDuRapport` acceptait encore un journal et le recopiait
  // en silence, les deux affirmations ci-dessus resteraient vraies pour rien.
  const avecJournal = corpsDuRapport({
    diagnostic: "Serveur : répond",
    // @ts-expect-error — on passe volontairement ce que la fiche ne doit plus lire.
    journal: "SECRET_A_NE_PAS_PUBLIER=xyz",
    quand: "2026-08-12T06:00:00.000Z",
  });
  assert.ok(
    !avecJournal.includes("SECRET_A_NE_PAS_PUBLIER"),
    "un journal passé à la fonction ressort quand même dans la fiche"
  );
});

cas("le rapport dit QUAND il a été écrit, et de ne pas y répondre", () => {
  // Une fiche sans date ne dit pas si l'on regarde l'état d'aujourd'hui ou
  // celui d'avant-hier — c'est précisément la question qu'elle doit trancher.
  const corps = corpsDuRapport({
    diagnostic: "Serveur : répond",
    quand: "2026-08-12T06:00:00.000Z",
  });
  assert.match(corps, /2026-08-12T06:00:00/, "le rapport ne porte pas sa date");
  assert.match(corps, /réécrite entièrement/, "rien ne prévient qu'une réponse serait effacée");
});

cas("le titre de la fiche est fixe : une seule fiche, pas une par allumage", () => {
  // C'est ce titre qui sert à la retrouver. S'il devenait variable, chaque
  // démarrage ouvrirait une fiche de plus, et le dépôt se remplirait de bruit.
  assert.ok(TITRE_FICHE.length > 10, "le titre de la fiche est vide ou trop court pour être cherché");
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(TITRE_FICHE), "le titre porte une date : il créera une fiche par jour");
});

cas("les consignes de reprise DISENT de lire la fiche avant de parler au patron", () => {
  // **Le canal ne sert à rien si les sessions ne savent pas qu'il existe.** Le
  // patron en fait tourner trois ou quatre en parallèle ; aucune n'a lu cette
  // conversation. Ce qui les atteint toutes, c'est `CLAUDE.md`, lu au début de
  // chacune — d'où ce contrôle, qui refuse que la règle en disparaisse.
  const regles = readFileSync("CLAUDE.md", "utf8");
  assert.match(
    regles,
    /rapporter-espace\.mjs/,
    "CLAUDE.md ne dit plus où se trouve la fiche d'état : les autres sessions " +
      "recommenceront à formuler des hypothèses sur une machine qu'elles ne voient pas"
  );
  assert.match(
    regles,
    /claude/,
    "CLAUDE.md ne dit plus de lui faire lancer `claude` quand un geste est nécessaire " +
      "chez lui : on retombera à lui dicter des commandes depuis un téléphone"
  );
});

cas("le veilleur rafraîchit la fiche, il ne la laisse pas vieillir", () => {
  // Écrite au seul allumage, elle décrirait l'état d'il y a six heures — et une
  // session qui s'y fie conclut de travers. C'est le reproche exact que ce
  // dépôt fait à une documentation périmée : on s'y fie encore.
  const veilleur = readFileSync(".devcontainer/veiller.sh", "utf8");
  assert.match(
    veilleur,
    /rapporter-espace\.mjs/,
    "le veilleur ne republie plus l'état : la fiche vieillira sans que rien ne le dise"
  );
});

cas("la publication ne dépend plus de `gh`", () => {
  // **Deux redémarrages pour rien, le 12 août 2026.** Le patron rallume son
  // espace deux fois et la fiche reste introuvable : `gh` n'y est pas. Il
  // arrive par une fonctionnalité déclarée dans `devcontainer.json`, et **une
  // déclaration ne répare pas un espace déjà né**. Le sien est plus ancien que
  // la ligne — redémarrer récupère le code, jamais les outils.
  //
  // Le chemin par jeton ne dépend de rien : Codespaces le pose dans chaque
  // terminal. Ce cas garde l'ORDRE, qui est tout : `gh` d'abord reviendrait à
  // ne rien publier chez la seule personne pour qui la fiche existe.
  const source = readFileSync("scripts/rapporter-espace.mjs", "utf8");
  const parJeton = source.indexOf("publierParHttp(corps, jeton)");
  const parGh = source.indexOf("publierParGh(corps)");
  assert.ok(parJeton > 0, "le chemin par jeton a disparu : l'espace du patron redeviendra muet");
  assert.ok(parGh > 0, "le second recours par `gh` a disparu");
  assert.ok(
    parJeton < parGh,
    "`gh` est tenté avant le jeton : dans l'espace du patron, `gh` n'existe pas — " +
      "la fiche ne sera plus jamais publiée chez lui"
  );
  assert.match(
    source,
    /GITHUB_TOKEN/,
    "le jeton que Codespaces pose dans chaque terminal n'est plus lu"
  );
});

cas("l'adresse du dépôt se lit sous ses DEUX formes", () => {
  // Les deux vivent côte à côte sur la même machine : `git clone` par HTTPS
  // écrit l'une, un accès par clé écrit l'autre. N'en reconnaître qu'une, c'est
  // marcher chez soi et se taire chez le patron.
  const attendu = { proprietaire: "florianmarrins0978-svg", depot: "Atlas-app" };
  for (const adresse of [
    "https://github.com/florianmarrins0978-svg/Atlas-app.git",
    "https://github.com/florianmarrins0978-svg/Atlas-app",
    "git@github.com:florianmarrins0978-svg/Atlas-app.git",
    "https://github.com/florianmarrins0978-svg/Atlas-app/\n",
  ]) {
    assert.deepEqual(extraireDepot(adresse), attendu, `adresse non reconnue : ${adresse.trim()}`);
  }
  assert.equal(extraireDepot("https://exemple.local/depot.git"), null, "un hôte étranger est accepté");
  assert.equal(extraireDepot(undefined), null, "une adresse absente n'est pas refusée");
});

cas("la fiche se retrouve par son titre EXACT, jamais par ressemblance", () => {
  // Une correspondance approchante ouvrirait une SECONDE fiche à chaque
  // allumage, et le dépôt se remplirait de bruit — c'est ce que le titre fixe
  // sert précisément à éviter.
  const fiches = [
    { number: 7, title: "Autre chose" },
    { number: 12, title: TITRE_FICHE },
    { number: 19, title: `${TITRE_FICHE} (ancien)` },
  ];
  assert.equal(choisirFiche(fiches, TITRE_FICHE), 12, "la bonne fiche n'est pas retrouvée");
  assert.equal(choisirFiche([], TITRE_FICHE), undefined, "une liste vide ne rend pas « aucune »");
  assert.equal(choisirFiche(null, TITRE_FICHE), undefined, "une liste absente fait tomber le script");
});

cas("la fiche part AVANT que le serveur ait répondu, pas seulement après", () => {
  // **Le défaut le plus bête, et le plus coûteux.** La première version
  // attendait que le serveur réponde — jusqu'à dix minutes — avant d'écrire
  // quoi que ce soit. Or le cas pour lequel cette fiche existe est celui où le
  // serveur NE répond pas. Elle se taisait exactement quand elle servait.
  const demarrage = readFileSync(".devcontainer/demarrer.sh", "utf8");
  const bloc = demarrage.slice(demarrage.indexOf("rapporter-espace.mjs") - 400);
  const premier = bloc.indexOf("rapporter-espace.mjs");
  const attente = bloc.indexOf("health/live");
  assert.ok(premier >= 0 && attente >= 0, "le bloc de publication a changé de forme : cas à revoir");
  assert.ok(
    premier < attente,
    "la fiche n'est plus publiée avant l'attente du serveur : en cas de panne au " +
      "démarrage — le seul cas qui compte — elle arrivera dix minutes trop tard"
  );
  assert.equal(
    (demarrage.match(/node scripts\/rapporter-espace\.mjs/g) ?? []).length,
    2,
    "la seconde publication (une fois le serveur debout) a disparu : la fiche resterait " +
      "sur un état d'avant démarrage"
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Rapport de l'espace — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
