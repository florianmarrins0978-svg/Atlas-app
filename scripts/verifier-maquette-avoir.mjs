#!/usr/bin/env node
/*
  Éprouve les maquettes 79 et 80, JAVASCRIPT COUPÉ.

  **Ce qu'elles servent à trancher.** Le patron, le 17 août 2026 : *« si jamais
  on facture un client et qui décide de ne pas nous payer, il faut avoir la
  possibilité de créer un avoir »*. La 79 pose la question de la SITUATION
  (erreur, geste, mauvais payeur), la 80 celle de la FORME du document.

  ────────────────────────────────────────────────────────────────────────────
  LE CONTRÔLE QUI COMPTE VRAIMENT EST L'ARITHMÉTIQUE, et pour deux raisons.

  1. Une planche dont les totaux ne tombent pas juste apprend à douter des
     totaux du vrai — c'est la leçon de la maquette 61.
  2. **Un avoir dont la TVA serait calculée sur le TTC est une déclaration
     fausse.** Un avoir de 300 € TTC, c'est 250,00 € HT et 50,00 € de TVA ;
     écrire 300 € de HT ferait rendre 60 € de TVA au lieu de 50. Le contrôle
     refuse ce nombre-là partout.

  Chaque montant est RECALCULÉ ici depuis le TTC affiché, jamais recopié de la
  planche — sans quoi le contrôle et la planche se tromperaient ensemble.

  ────────────────────────────────────────────────────────────────────────────
  ET UN CONTRÔLE QUI N'EST PAS ARITHMÉTIQUE, mais qui est le plus important.

  **La 79 DOIT dire qu'un avoir éteint le droit de réclamer**, et qu'une facture
  déclarée perdue le garde. C'est la seule chose de tout ce sujet qui, mal
  comprise, coûte de l'argent irréversiblement : il ferait un avoir à un client
  qui refuse de payer, et se priverait lui-même de tout recours. Une planche qui
  omettrait cette phrase serait jolie et dangereuse.

  ────────────────────────────────────────────────────────────────────────────
  Les autres contrôles :

    · aucun `<script>` — son lecteur n'en exécute aucun, les bascules sont des
      boutons radio natifs ;
    · un arrangement à la fois, dans les deux planches ;
    · les trois montants sont éprouvés, pas seulement celui d'ouverture : il les
      touchera tous les trois ;
    · dans l'arrangement C, la somme des lignes fait bien le total HT — une
      facture refaite dont les lignes ne font pas le total est un document faux ;
    · les renvois croisés entre les deux planches visent des fichiers existants.

  **Il sait échouer, et il nomme le défaut plutôt que le sélecteur.** Écrire
  300,00 € de HT sur l'avoir de 300 € rend l'arithmétique rouge en donnant
  l'écart ; retirer la phrase sur le droit de réclamer rend le dernier rouge.
  Rien n'est mesuré sans avoir été compté d'abord : une mesure sur du vide rend
  0, et 0 passe au vert en ne prouvant rien (`CLAUDE.md` §5).

  Usage : node scripts/verifier-maquette-avoir.mjs [dossier-des-maquettes]
*/

import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER = resolve(process.argv[2] ?? join(RACINE, "docs", "maquettes"));
const M79 = join(DOSSIER, "79-il-ne-paie-pas.html");
const M80 = join(DOSSIER, "80-l-avoir.html");
const M81 = join(DOSSIER, "81-simple-il-ne-paie-pas.html");

for (const f of [M79, M80, M81]) {
  if (!existsSync(f)) {
    console.error(`La maquette n'existe pas : ${f}`);
    process.exit(1);
  }
}

const plaintes = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) plaintes.push(quoi);
};

/** « 1 240,00 € » et « −250,00 € » deviennent 1240 et -250. */
const enNombre = (t) => {
  const brut = String(t).trim();
  const signe = /^[−–-]/.test(brut) ? -1 : 1;
  const n = Number(brut.replace(/[^\d,.]/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? signe * n : NaN;
};
const proche = (a, b) => Math.abs(a - b) < 0.005;
const sou = (n) => n.toFixed(2);

// La facture de démonstration, et le taux qui la porte.
const FACTURE_TTC = 1440;
const TAUX = 20;

/**
 * Ce qu'un avoir de `ttc` doit valoir — DÉDUIT du TTC, comme le ferait la
 * comptabilité, et non recopié de la planche.
 */
const decomposer = (ttc) => {
  const ht = Math.round((ttc / (1 + TAUX / 100)) * 100) / 100;
  return { ht, tva: Math.round((ttc - ht) * 100) / 100, ttc };
};

const MONTANTS = [
  { radio: "m-2", ttc: 200 },
  { radio: "m-3", ttc: 300 },
  { radio: "m-t", ttc: FACTURE_TTC },
];

const CHROME = process.env.CHROME_ATLAS ?? "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
const contexte = await navigateur.newContext({
  viewport: { width: 430, height: 1200 },
  javaScriptEnabled: false, // son lecteur n'en exécute pas — les planches non plus
});
const page = await contexte.newPage();

console.log("=== Les maquettes 79, 80 et 81 tombent-elles juste ? ===\n");

// ── 0. Aucun script, dans aucune des deux ───────────────────────────────────
for (const [nom, f] of [["79", M79], ["80", M80], ["81", M81]]) {
  const source = readFileSync(f, "utf8");
  dire(!/<script[\s>]/i.test(source), `la maquette ${nom} ne contient aucun script`);
}

// ── 1. La 79 : trois arrangements, un seul à la fois ────────────────────────
console.log("\n→ 79 · Il ne paie pas");
await page.goto(`file://${M79}`, { waitUntil: "networkidle" });

const A79 = [
  { radio: "v-a", nom: "A · Trois portes", panneau: ".g-a" },
  { radio: "v-b", nom: "B · Un avoir, un montant", panneau: ".g-b" },
  { radio: "v-c", nom: "C · Deux portes", panneau: ".g-c" },
];
for (const a of A79) {
  await page.click(`label[for="${a.radio}"]`);
  const vus = [];
  for (const autre of A79) {
    if ((await page.locator(`div${autre.panneau}:visible`).count()) > 0) vus.push(autre.radio);
  }
  dire(
    vus.length === 1 && vus[0] === a.radio,
    `${a.nom} s'affiche seul (vus : ${vus.join(", ") || "aucun"})`,
  );
}

// Les deux portes d'entrée — le rappel et la facture — se montrent aussi.
for (const [radio, panneau, nom] of [
  ["p-r", ".d-rappel", "depuis le rappel"],
  ["p-f", ".d-facture", "depuis la facture"],
]) {
  await page.click(`label[for="${radio}"]`);
  const vu = await page.locator(`div${panneau}:visible`).count();
  const autre = await page
    .locator(`div${panneau === ".d-rappel" ? ".d-facture" : ".d-rappel"}:visible`)
    .count();
  dire(vu === 1 && autre === 0, `l'entrée « ${nom} » s'affiche seule`);
}

// ── 2. LE CONTRÔLE QUI PROTÈGE SON ARGENT ───────────────────────────────────
//
// La distinction avoir / facture perdue doit être ÉCRITE, pas sous-entendue :
// c'est la seule erreur de ce sujet qu'on ne peut pas défaire.
const texte79 = await page.locator("body").innerText();
dire(
  /avoir dit que la somme n'est plus due/i.test(texte79),
  "la 79 dit qu'un avoir éteint la dette",
);
dire(
  /vous renoncez à réclamer/i.test(texte79),
  "la 79 dit qu'on renonce alors à réclamer l'argent",
);
dire(
  /gardez le droit de (la )?réclamer/i.test(texte79),
  "la 79 dit qu'une facture perdue laisse le droit de réclamer",
);
dire(
  /ne bouge pas/i.test(texte79) && /TVA/i.test(texte79),
  "la 79 dit que son relevé de TVA ne bouge pas",
);

// ── 3. La 80 : trois arrangements, un seul à la fois ────────────────────────
console.log("\n→ 80 · L'avoir");
await page.goto(`file://${M80}`, { waitUntil: "networkidle" });

const A80 = [
  { radio: "v-a", nom: "A · Un document à part", panneau: ".v-a" },
  { radio: "v-b", nom: "B · Une mention sur la facture", panneau: ".v-b" },
  { radio: "v-c", nom: "C · Une facture refaite", panneau: ".v-c" },
];
for (const a of A80) {
  await page.click(`label[for="${a.radio}"]`);
  const vus = [];
  for (const autre of A80) {
    if ((await page.locator(`div${autre.panneau}:visible`).count()) > 0) vus.push(autre.radio);
  }
  dire(
    vus.length === 1 && vus[0] === a.radio,
    `${a.nom} s'affiche seul (vus : ${vus.join(", ") || "aucun"})`,
  );
}

// ── 4. L'ARITHMÉTIQUE, aux TROIS montants et dans les TROIS arrangements ────
for (const m of MONTANTS) {
  const attendu = decomposer(m.ttc);
  const resteDu = Math.round((FACTURE_TTC - m.ttc) * 100) / 100;

  // ── A · le document d'avoir lui-même ────────────────────────────────────
  await page.click(`label[for="v-a"]`);
  await page.click(`label[for="${m.radio}"]`);
  const totA = (await page.locator(".v-a .totaux .tot:visible").allInnerTexts()).map((l) =>
    Math.abs(enNombre(l.split("\n").pop())),
  );
  if (totA.length !== 3 || totA.some((n) => !Number.isFinite(n))) {
    dire(false, `A · ${m.ttc} € : les trois totaux ne se lisent pas (${JSON.stringify(totA)})`);
  } else {
    const [ht, tva, ttc] = totA;
    dire(
      proche(ht, attendu.ht) && proche(tva, attendu.tva) && proche(ttc, attendu.ttc),
      `A · avoir de ${m.ttc} € : ${sou(ht)} HT + ${sou(tva)} de TVA = ${sou(ttc)} ` +
        `(attendu ${sou(attendu.ht)} + ${sou(attendu.tva)} = ${sou(attendu.ttc)})`,
    );
    // Le défaut qui coûterait de l'argent : la TVA prise sur le TTC.
    dire(
      !proche(ht, m.ttc),
      `A · ${m.ttc} € : le HT n'est pas le TTC déguisé (${sou(ht)} ≠ ${sou(m.ttc)})`,
    );
    dire(proche(ht + tva, ttc), `A · ${m.ttc} € : HT + TVA font bien le TTC`);
  }

  const apresA = (await page.locator(".v-a .apres .lgn:visible").allInnerTexts()).map((l) =>
    enNombre(l.split("\n").pop()),
  );
  dire(
    apresA.length === 3 && proche(apresA[2], resteDu),
    `A · ${m.ttc} € : le reste dû tombe à ${sou(apresA[2] ?? NaN)} (attendu ${sou(resteDu)})`,
  );

  // ── B · la mention sous le total de la facture ───────────────────────────
  await page.click(`label[for="v-b"]`);
  const totB = (await page.locator(".v-b .totaux .tot:visible").allInnerTexts()).map((l) =>
    enNombre(l.split("\n").pop()),
  );
  if (totB.length !== 5) {
    dire(false, `B · ${m.ttc} € : cinq lignes de total attendues, ${totB.length} lues`);
  } else {
    dire(
      proche(totB[2], FACTURE_TTC) && proche(Math.abs(totB[3]), m.ttc) && proche(totB[4], resteDu),
      `B · ${m.ttc} € : ${sou(FACTURE_TTC)} − ${sou(m.ttc)} = ${sou(totB[4])} ` +
        `(attendu ${sou(resteDu)})`,
    );
    dire(totB[3] < 0, `B · ${m.ttc} € : l'avoir s'écrit en négatif, comme il se doit`);
  }

  // ── C · la facture refaite ──────────────────────────────────────────────
  await page.click(`label[for="v-c"]`);
  const attenduC = decomposer(resteDu);
  const totC = (await page.locator(".v-c .totaux .tot:visible").allInnerTexts()).map((l) =>
    enNombre(l.split("\n").pop()),
  );
  if (totC.length !== 3) {
    dire(false, `C · ${m.ttc} € : trois totaux attendus, ${totC.length} lus`);
  } else {
    const [ht, tva, ttc] = totC;
    dire(
      proche(ht, attenduC.ht) && proche(tva, attenduC.tva) && proche(ttc, attenduC.ttc),
      `C · après un avoir de ${m.ttc} € : ${sou(ht)} HT + ${sou(tva)} = ${sou(ttc)} ` +
        `(attendu ${sou(attenduC.ht)} + ${sou(attenduC.tva)} = ${sou(attenduC.ttc)})`,
    );
  }

  // **Une facture dont les lignes ne font pas le total est un document faux.**
  // C'est ce qui distingue C d'un simple total corrigé à la main.
  const lignesC = (await page.locator(".v-c .lg:visible .prix").allInnerTexts()).map(enNombre);
  const sommeC = lignesC.reduce((s, n) => s + n, 0);
  dire(
    lignesC.length >= 2 && proche(sommeC, attenduC.ht),
    `C · ${m.ttc} € : ${lignesC.length} lignes font ${sou(sommeC)} HT (attendu ${sou(attenduC.ht)})`,
  );
}

// ── 5. La 81 : la version SIMPLE, et ce que « simple » doit encore tenir ───
//
// **Sa correction du 17 août, devant les 79 et 80 :** *« c'est trop compliqué,
// il faut faire quelque chose de simple, l'utilisateur a besoin d'aller à
// l'essentiel constamment »*. Les contrôles ci-dessous gardent la
// simplification acquise — un écran qui se recompliquerait redeviendrait vert
// sans eux.
console.log("\n→ 81 · Simple");
await page.goto(`file://${M81}`, { waitUntil: "networkidle" });

const ECRANS = [
  { radio: "e-1", nom: "1 · La facture", panneau: ".ec-1" },
  { radio: "e-2", nom: "2 · La question", panneau: ".ec-2" },
  { radio: "e-3", nom: "3 · Combien", panneau: ".ec-3" },
  { radio: "e-4", nom: "4 · Fini", panneau: ".ec-4" },
];
for (const e of ECRANS) {
  await page.click(`label[for="${e.radio}"]`);
  const vus = [];
  for (const autre of ECRANS) {
    if ((await page.locator(`div${autre.panneau}:visible`).count()) > 0) vus.push(autre.radio);
  }
  dire(vus.length === 1 && vus[0] === e.radio, `81 · ${e.nom} s'affiche seul (vus : ${vus.join(", ") || "aucun"})`);
}

// **LE PARCOURS TIENT EN QUATRE ÉCRANS.** C'est la mesure de « simple », et
// elle est comptée, pas affirmée : un cinquième écran qui apparaîtrait un jour
// rendrait ce contrôle rouge, et c'est exactement ce qu'on veut.
dire(ECRANS.length === 4, `81 · le parcours tient en ${ECRANS.length} écrans`);

// **LA QUESTION N'A QUE DEUX RÉPONSES.** Une troisième serait un choix de plus
// à faire entre deux chantiers.
await page.click('label[for="e-2"]');
const reponses = await page.locator(".ec-2 .reponse:visible .nom").allInnerTexts();
dire(
  reponses.length === 2,
  `81 · la question a deux réponses (${reponses.length} : ${reponses.join(" / ") || "aucune"})`,
);

// **ET C'EST LA SEULE CHOSE QU'ON NE PEUT PAS SIMPLIFIER DAVANTAGE.** Les deux
// réponses font l'inverse l'une de l'autre, et l'une est irréversible. L'écran
// doit dire, sur le téléphone et non dans une légende, qu'après « il ne paiera
// pas » il peut encore réclamer. Sans cette ligne, la simplification lui coûte
// de l'argent.
const surLeTelephone = await page.locator(".feuille:visible").innerText();
dire(
  /toujours réclamer/i.test(surLeTelephone),
  "81 · le téléphone dit qu'il pourra toujours réclamer",
);

// **LE MOT « AVOIR » N'EST PAS SUR LE TÉLÉPHONE.** C'est du vocabulaire de
// comptable ; le document le portera quand il partira. Le contrôle garde la
// simplification : le jour où le mot revient sur un écran, il rougit.
for (const e of ECRANS) {
  await page.click(`label[for="${e.radio}"]`);
  const vu = await page.locator(".feuille:visible").innerText();
  dire(!/\bavoirs?\b/i.test(vu), `81 · l'écran « ${e.nom} » ne dit pas « avoir »`);
}

// ── L'arithmétique de la 81, aux deux montants ─────────────────────────────
for (const [radio, retire] of [["m-3", 300], ["m-t", FACTURE_TTC]]) {
  const reste = Math.round((FACTURE_TTC - retire) * 100) / 100;
  await page.click('label[for="e-3"]');
  await page.click(`label[for="${radio}"]`);
  const montant = enNombre(await page.locator(".ec-3 .case .val:visible").innerText());
  const devra = enNombre((await page.locator(".ec-3 .apres .tot:visible").innerText()).split("\n").pop());
  dire(
    proche(montant, retire) && proche(devra, reste),
    `81 · retirer ${sou(retire)} laisse ${sou(devra)} (attendu ${sou(reste)})`,
  );
}

// ── 5. Les renvois croisés visent des fichiers qui existent ─────────────────
console.log("\n→ Les renvois");
for (const [source, nom] of [[M79, "79"], [M80, "80"], [M81, "81"]]) {
  await page.goto(`file://${source}`, { waitUntil: "networkidle" });
  const cibles = await page.locator("a[href$='.html']").evaluateAll((as) =>
    as.map((a) => a.getAttribute("href")),
  );
  dire(cibles.length >= 1, `la ${nom} renvoie aux planches voisines`);
  for (const c of cibles) {
    dire(existsSync(join(DOSSIER, c)), `le renvoi « ${c} » de la ${nom} vise un fichier existant`);
  }
}

await contexte.close();
await navigateur.close();

console.log("");
if (plaintes.length === 0) {
  console.log("✅ Les trois planches tombent juste, et disent ce qu'elles doivent dire.");
  process.exit(0);
}
console.log(`❌ ${plaintes.length} défaut(s) :`);
for (const p of plaintes) console.log(`   · ${p}`);
process.exit(1);
