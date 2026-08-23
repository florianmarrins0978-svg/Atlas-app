// La temporisation après des échecs de connexion — la règle, sans base.
//
// **CE QUE CETTE SUITE PROTÈGE.** L'audit du 23 août 2026 (constat C1) a
// mesuré ce qu'un attaquant obtenait : 28 800 essais par jour et par compte, et
// autant qu'il voulait les jours où Redis tombait. Les paliers ci-dessous
// ramènent cela à quelques essais par heure — mais ils portent aussi le
// PLAFOND, qui existe pour l'artisan : sans lui, taper trois fois à côté sur
// son adresse suffirait à l'empêcher d'entrer chez lui indéfiniment.
//
// Les deux moitiés comptent, et les deux sont éprouvées ici.

import assert from "node:assert/strict";
import {
  FENETRE_OUBLI_MS,
  PALIERS_MS,
  SEUIL_AVANT_TEMPORISATION,
  attenteRestanteMs,
  delaiApresEchec,
  echecsRetenus,
  etatApresEchec,
  messageAttente,
  type EtatTentatives,
} from "../src/lib/tentatives-connexion";

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

const T0 = new Date("2026-08-23T10:00:00.000Z");
const plus = (ms: number) => new Date(T0.getTime() + ms);

console.log("=== Échecs de connexion : ce qui temporise, et ce qui s'oublie ===\n");

// ─── Les premiers essais ne coûtent rien ────────────────────────────────────

essai("sous le seuil, aucune attente : c'est quelqu'un qui cherche son mot de passe", () => {
  for (let n = 0; n < SEUIL_AVANT_TEMPORISATION; n++) {
    assert.equal(delaiApresEchec(n), 0, `${n} échec(s) ne devrait rien coûter`);
  }
});

essai("au seuil, la temporisation commence", () => {
  assert.equal(delaiApresEchec(SEUIL_AVANT_TEMPORISATION), PALIERS_MS[0]);
});

essai("chaque échec de plus coûte plus cher, dans l'ordre annoncé", () => {
  for (let i = 0; i < PALIERS_MS.length; i++) {
    assert.equal(delaiApresEchec(SEUIL_AVANT_TEMPORISATION + i), PALIERS_MS[i]);
  }
});

// ─── Le plafond : il protège le PATRON ──────────────────────────────────────

essai("le blocage est PLAFONNÉ — on ne mure pas le compte d'un artisan", () => {
  const plafond = PALIERS_MS[PALIERS_MS.length - 1];
  for (const n of [20, 100, 10_000]) {
    assert.equal(delaiApresEchec(n), plafond, `${n} échecs ne doivent pas dépasser le plafond`);
  }
  assert.ok(plafond <= 15 * 60_000, "le plafond dépasse le quart d'heure jugé supportable");
});

// ─── L'attaquant, chiffré ───────────────────────────────────────────────────

essai("une fois le seuil franchi, il reste quelques essais par heure — pas des milliers", () => {
  // On déroule une heure d'acharnement : à chaque fois, on attend juste ce
  // qu'il faut, et on retape.
  let etat: EtatTentatives | null = null;
  let instant = T0;
  const fin = T0.getTime() + 60 * 60 * 1000;
  let essaisObtenus = 0;

  while (instant.getTime() < fin) {
    const attente = attenteRestanteMs(etat, instant);
    if (attente !== null) {
      instant = new Date(instant.getTime() + attente);
      continue;
    }
    etat = etatApresEchec(etat, instant);
    essaisObtenus++;
    instant = new Date(instant.getTime() + 1);
  }

  // Avant ce lot : 300 par quart d'heure, soit 1 200 sur la même heure.
  assert.ok(essaisObtenus < 20, `l'attaquant obtient encore ${essaisObtenus} essais en une heure`);
});

// ─── L'oubli ────────────────────────────────────────────────────────────────

essai("des échecs assez vieux ne comptent plus", () => {
  const vieux: EtatTentatives = { echecs: 9, dernierEchecAt: T0, bloqueJusqua: null };
  assert.equal(echecsRetenus(vieux, plus(FENETRE_OUBLI_MS - 1)), 9);
  assert.equal(echecsRetenus(vieux, plus(FENETRE_OUBLI_MS)), 0);
});

essai("après l'oubli, le compteur repart de un — pas du plafond", () => {
  const vieux: EtatTentatives = { echecs: 9, dernierEchecAt: T0, bloqueJusqua: null };
  const suivant = etatApresEchec(vieux, plus(FENETRE_OUBLI_MS + 1));
  assert.equal(suivant.echecs, 1);
  assert.equal(suivant.bloqueJusqua, null);
});

// ─── Ce que la fonction rend, pas à pas ─────────────────────────────────────

essai("le premier échec ne bloque rien, le cinquième bloque", () => {
  let etat: EtatTentatives | null = null;
  for (let n = 1; n <= SEUIL_AVANT_TEMPORISATION; n++) {
    etat = etatApresEchec(etat, plus(n));
    assert.equal(etat.echecs, n);
  }
  assert.notEqual(etat!.bloqueJusqua, null, "le cinquième échec ne temporise pas");
  assert.equal(
    etat!.bloqueJusqua!.getTime(),
    plus(SEUIL_AVANT_TEMPORISATION).getTime() + PALIERS_MS[0]
  );
});

essai("une attente échue laisse repasser", () => {
  const etat: EtatTentatives = { echecs: 6, dernierEchecAt: T0, bloqueJusqua: plus(60_000) };
  assert.equal(attenteRestanteMs(etat, plus(59_999)), 1);
  assert.equal(attenteRestanteMs(etat, plus(60_000)), null);
  assert.equal(attenteRestanteMs(etat, plus(60_001)), null);
});

essai("sans état du tout, rien n'attend", () => {
  assert.equal(attenteRestanteMs(null, T0), null);
  assert.equal(echecsRetenus(null, T0), 0);
});

// ─── Le message ─────────────────────────────────────────────────────────────

// **« Mot de passe incorrect » à quelqu'un dont le mot de passe est bon** est
// la faute que ce dépôt s'interdit depuis le 6 août 2026, où les parents du
// patron se sont enfoncés en recommençant. Une temporisation doit se dire.
essai("le message ne dit JAMAIS que le mot de passe est faux", () => {
  const m = messageAttente(120_000);
  assert.ok(!/incorrect|faux|erron/i.test(m), `« ${m} » accuse le mot de passe`);
  assert.match(m, /2 minutes/);
});

essai("il dit aussi que quelqu'un essaie d'entrer — le taire serait pire", () => {
  assert.match(messageAttente(60_000), /quelqu'un cherche à entrer/i);
});

essai("jamais « dans 0 minute »", () => {
  assert.match(messageAttente(1), /1 minute\b/);
});

console.log("");
console.log(`Échecs de connexion — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
