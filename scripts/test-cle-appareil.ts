// « Ouvrir avec Face ID » — les règles, sans base, sans navigateur, sans clé.
//
// **CE QUE CETTE SUITE PROTÈGE, et c'est SA règle, pas la nôtre.** Le 23 août
// 2026 : *« bien entendu qu'il faut conserver le mot de passe »*. Tout ce qui
// suit en découle — un échec de visage ne doit accuser aucun mot de passe, ne
// doit compter aucune tentative, et ne doit jamais murer un compte.

import assert from "node:assert/strict";
import {
  CLES_MAX,
  NOM_APPAREIL_MAX,
  estAbandon,
  estRejeu,
  messageRefusCle,
  nettoyerNomAppareil,
  nommerAppareil,
  phraseAppareils,
  type RefusCle,
} from "../src/lib/cle-appareil";

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

console.log("=== Clés d'appareil : ce qui se dit, et ce qui ne se dit jamais ===\n");

// ─── LA RÈGLE QUI PRIME SUR TOUTES : ne jamais accuser le mot de passe ──────
//
// C'est la faute que ce dépôt s'interdit depuis le 6 août 2026, où les parents
// du patron ont lu « mot de passe incorrect » avec le bon mot de passe et se
// sont enfoncés en recommençant. Un visage mal reconnu ne dit RIEN du mot de
// passe : le laisser croire ferait changer un mot de passe qui n'a rien fait.

const TOUS_LES_REFUS: RefusCle[] = [
  "abandon",
  "sans-cle",
  "cle-inconnue",
  "rejeu",
  "trop-de-cles",
  "deja-enregistree",
  "indisponible",
  "panne",
  "panne-activation",
];

essai("AUCUN message n'accuse le mot de passe", () => {
  for (const refus of TOUS_LES_REFUS) {
    const m = messageRefusCle(refus);
    if (m === null) continue;
    assert.ok(
      !/mot de passe (incorrect|faux|erron)/i.test(m),
      `« ${m} » accuse le mot de passe (refus « ${refus} »)`
    );
  }
});

essai("aucun message ne laisse croire que le compte est perdu", () => {
  for (const refus of TOUS_LES_REFUS) {
    const m = messageRefusCle(refus);
    if (m === null) continue;
    assert.ok(!/bloqué|verrouillé|supprimé/i.test(m), `« ${m} » alarme pour rien`);
  }
});

// **Le même incident se dit différemment selon OÙ l'on est**, et c'est la seule
// chose qui distingue ces deux refus. Sur la porte, « entrez votre mot de
// passe » est le geste utile ; dans les Réglages, il est absurde — on vient de
// le taper. Un message qui demande un geste impossible se lit comme une panne
// d'Atlas, et l'artisan cherche ce qu'il a mal fait.
essai("le refus des RÉGLAGES ne renvoie pas à un mot de passe déjà tapé", () => {
  const m = messageRefusCle("panne-activation") ?? "";
  assert.ok(!/entrez votre mot de passe/i.test(m), `« ${m} » demande un geste impossible ici`);
  assert.match(m, /rien n’a changé|rien n'a changé/i);
});

essai("le refus de la PORTE, lui, dit bien de taper son mot de passe", () => {
  assert.match(messageRefusCle("panne") ?? "", /mot de passe/i);
});

essai("chaque message dit QUOI FAIRE, ou se tait", () => {
  for (const refus of TOUS_LES_REFUS) {
    const m = messageRefusCle(refus);
    if (m === null) continue;
    // Un refus qui ne dit pas quoi faire laisse devant une porte fermée.
    assert.ok(m.length > 20, `« ${m} » est trop court pour dire quoi faire`);
  }
});

essai("REFERMER LA FENÊTRE NE DIT RIEN — c'est un geste ordinaire", () => {
  // Un message rouge pour quelqu'un qui a simplement changé d'avis, c'est
  // l'alarme qui hurle à vide : on apprend à ne plus les lire.
  assert.equal(messageRefusCle("abandon"), null);
});

// ─── Abandon : le navigateur ne distingue pas, nous non plus ────────────────

essai("« NotAllowedError » et « AbortError » sont des abandons", () => {
  assert.equal(estAbandon("NotAllowedError"), true);
  assert.equal(estAbandon("AbortError"), true);
});

essai("tout le reste est une vraie panne — on ne se tait pas alors", () => {
  for (const nom of ["SecurityError", "InvalidStateError", "NotSupportedError", "TypeError", "", null, undefined]) {
    assert.equal(estAbandon(nom), false, `« ${nom} » ne devrait pas passer pour un abandon`);
  }
});

// ─── Le rejeu : zéro n'est pas un soupçon ───────────────────────────────────

essai("un compteur qui RECULE est un rejeu", () => {
  assert.equal(estRejeu(10, 9), true);
  assert.equal(estRejeu(10, 10), true);
});

essai("un compteur qui AVANCE est normal", () => {
  assert.equal(estRejeu(10, 11), false);
  assert.equal(estRejeu(0, 1), false);
});

essai("ZÉRO CONTRE ZÉRO N'EST PAS UN REJEU — sinon aucun iPhone n'entre", () => {
  // Les clés de plateforme d'Apple ne tiennent aucun compteur et rendent
  // toujours 0. Refuser là-dessus fermerait la porte à tous les téléphones du
  // patron — et c'est exactement l'appareil pour lequel il l'a demandé.
  assert.equal(estRejeu(0, 0), false);
});

// ─── Le nom de l'appareil : il ne décide de rien ────────────────────────────

essai("les appareils du patron se reconnaissent", () => {
  assert.equal(nommerAppareil("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)"), "iPhone");
  assert.equal(nommerAppareil("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)"), "iPad");
  assert.equal(nommerAppareil("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "Mac");
  assert.equal(nommerAppareil("Mozilla/5.0 (Linux; Android 14; Pixel 8)"), "Téléphone Android");
  assert.equal(nommerAppareil("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "Ordinateur Windows");
});

essai("un iPad qui se déclare Mac reste un iPad", () => {
  // Depuis 2019, iPadOS annonce « Macintosh » : la chaîne contient les deux, et
  // l'ordre des essais tranche. Ce n'est pas un détail cosmétique — c'est ce
  // qui distingue deux lignes de la liste au moment d'en retirer une.
  assert.equal(nommerAppareil("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit"), "iPad");
});

essai("un agent inconnu ne se recopie JAMAIS à l'écran", () => {
  // Montrer « Mozilla/5.0 (X11; Exotique) » dans un écran de réglages, c'est
  // montrer à un artisan quelque chose qu'il ne peut ni lire ni corriger.
  const rendu = nommerAppareil("Mozilla/5.0 (X11; Exotique 1.0)");
  assert.equal(rendu, "Cet appareil");
  for (const vide of ["", null, undefined]) {
    assert.equal(nommerAppareil(vide), "Cet appareil");
  }
});

essai("un nom saisi est borné et ne casse pas la ligne", () => {
  const long = "a".repeat(NOM_APPAREIL_MAX + 50);
  assert.equal(nettoyerNomAppareil(long, "iPhone").length, NOM_APPAREIL_MAX);
  assert.equal(nettoyerNomAppareil("  Le   téléphone  du   camion ", "iPhone"), "Le téléphone du camion");
  // Vidé, on retombe sur le nom deviné plutôt que sur une ligne blanche.
  assert.equal(nettoyerNomAppareil("    ", "iPhone"), "iPhone");
});

// ─── La phrase de l'écran ───────────────────────────────────────────────────

essai("la phrase des appareils s'accorde, et dit « aucun » plutôt que « 0 »", () => {
  assert.equal(phraseAppareils(0), "Aucun appareil enregistré");
  assert.equal(phraseAppareils(1), "1 appareil enregistré");
  assert.equal(phraseAppareils(3), "3 appareils enregistrés");
});

// ─── La borne ───────────────────────────────────────────────────────────────

essai("la borne du nombre de clés est annoncée dans son propre message", () => {
  // Un refus qui dit « trop d'appareils » sans dire combien laisse recommencer.
  assert.match(messageRefusCle("trop-de-cles") ?? "", new RegExp(String(CLES_MAX)));
});

essai("la borne reste au-dessus de ce qu'un artisan possède", () => {
  assert.ok(CLES_MAX >= 5, "un téléphone, une tablette, l'ordinateur du bureau, et de la marge");
});

console.log("");
console.log(`Clés d'appareil — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
