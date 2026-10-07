// Les règles du mot de passe — la MÊME fonction qui allume le bouton et qui
// décide au serveur.
//
// **Ce que cette suite protège, et qui n'est pas une coquetterie.** L'écran de
// « Connexion » (`src/app/reglages/connexion/`) et l'action serveur emploient
// tous deux `verifierNouveauMotDePasse`. Le jour où l'un des deux se met à
// juger autrement, l'artisan voit un bouton allumé sur une saisie que le
// serveur refuse — ou pire, se croit protégé par un mot de passe qui n'a jamais
// été enregistré. `CLAUDE.md` §3 : jamais de règle dupliquée entre l'affichage
// et la vérification.
//
// Éprouvée SANS base et SANS navigateur : ce sont des règles pures.

import assert from "node:assert/strict";
import {
  LONGUEUR_MINIMALE,
  verifierNouveauMotDePasse,
  messageRefus,
  etatConfirmation,
  etatNouveau,
} from "../src/lib/mot-de-passe";
import { refusDeLAcces, messageRefusAcces } from "../src/lib/donner-un-acces";
import { refusDe, QUESTIONS } from "../src/lib/creation-compte";

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

console.log("=== Le mot de passe : ce qui passe, et ce qui bloque ===\n");

essai("douze caractères suffisent, confirmés", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord", []), null);
});

essai("onze caractères ne suffisent pas", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42n", "bruyere-42n", []), "trop-court");
});

// **La barre est montée de huit à douze le 23 août 2026** (audit, constat C1).
// Ce cas fige l'ancienne valeur pour qu'un retour en arrière se voie : huit
// caractères étaient acceptés, ils ne le sont plus. Sans lui, quelqu'un
// pourrait remettre 8 dans la constante et toute la suite resterait verte —
// c'est exactement ce qu'un contrôle doit empêcher.
essai("ce qui passait avant — huit caractères — est désormais refusé", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere1", "bruyere1", []), "trop-court");
});

essai("la limite annoncée à l'écran est CELLE-CI, pas une autre", () => {
  // Pas « xxxxxxxxxxxx » : depuis le 29 septembre 2026, une répétition est
  // refusée pour ce qu'elle est, et l'essai mesurerait la mauvaise règle.
  const juste = "bruyere-nord-sud-est".slice(0, LONGUEUR_MINIMALE);
  assert.equal(verifierNouveauMotDePasse(juste, juste, []), null);
  const court = juste.slice(0, -1);
  assert.equal(verifierNouveauMotDePasse(court, court, []), "trop-court");
});

essai("une confirmation différente bloque", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-sud", []), "confirmation-differente");
});

// **La longueur passe AVANT la confirmation, et l'ordre n'est pas indifférent.**
// Dire « la confirmation diffère » sur un mot de passe de trois caractères
// envoie corriger la mauvaise ligne — une erreur qui accuse à tort coûte plus
// cher que pas d'erreur du tout (`AGENTS.md`).
essai("sur une saisie doublement fautive, c'est la longueur qui est nommée", () => {
  assert.equal(verifierNouveauMotDePasse("abc", "xyz", []), "trop-court");
});

essai("reprendre son mot de passe actuel ne change rien, et se refuse", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord", [], "bruyere-42-nord"), "sans-changement");
});

essai("mais un mot de passe différent de l'actuel passe", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord", [], "chene-tordu"), null);
});

// L'actuel n'est pas toujours connu de l'appelant : l'écran, lui, ne l'a jamais
// en clair confronté au condensat. Sans cette tolérance, il devrait inventer
// une seconde règle — exactement ce que cette suite empêche.
essai("sans mot de passe actuel fourni, la règle ne s'invente rien", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord", []), null);
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord", [], ""), null);
});

// **Les espaces comptent.** Les rogner enregistrerait autre chose que ce qui a
// été tapé, et la reconnexion échouerait sans que rien ne l'explique.
essai("une espace finale fait une confirmation différente", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord ", []), "confirmation-differente");
});

// **Ce contrôle a d'abord refusé « n'est pas celui-là » à cause de son trait
// d'union.** Chercher un tiret, c'était accuser le français plutôt que le code
// — et une alerte qui désigne le mauvais coupable coûte plus cher que pas
// d'alerte (`AGENTS.md`). Ce qui compte est ailleurs : la phrase ne doit pas
// ÊTRE le code, et elle doit se lire.
essai("chaque refus porte une phrase, jamais un code", () => {
  for (const r of ["trop-court", "trop-courant", "trop-personnel", "confirmation-differente", "sans-changement", "actuel-faux"] as const) {
    const m = messageRefus(r);
    assert.ok(m.length > 12, `« ${r} » rend « ${m} »`);
    assert.notEqual(m, r, `« ${r} » se rend tel quel à l'écran`);
    assert.ok(m.includes(" "), `« ${m} » n'est pas une phrase`);
    assert.ok(/[.!]$/.test(m), `« ${m} » ne se termine pas comme une phrase`);
  }
});

// « Mot de passe incorrect » sur un écran qui en porte trois envoie retaper le
// mauvais champ.
essai("le refus de l'actuel DÉSIGNE l'actuel", () => {
  assert.match(messageRefus("actuel-faux"), /actuel/i);
});

console.log("");

essai("tant que la confirmation est vide, rien ne s'affiche", () => {
  assert.equal(etatConfirmation("bruyere-42-nord", ""), null);
});

essai("dès qu'il retape, l'écran dit si les deux se rejoignent", () => {
  assert.deepEqual(etatConfirmation("bruyere-42-nord", "bru"), {
    identiques: false,
    message: "Les deux saisies ne sont pas identiques.",
  });
  assert.deepEqual(etatConfirmation("bruyere-42-nord", "bruyere-42-nord"), {
    identiques: true,
    message: "Les deux sont identiques ✓",
  });
});

// L'écran montre cette phrase ET le serveur la rend sur refus : deux
// formulations pour la même faute se lisent comme deux fautes différentes.
essai("et cette phrase est LA MÊME que celle du refus serveur", () => {
  assert.equal(etatConfirmation("a", "b")!.message, messageRefus("confirmation-differente"));
});

console.log("");

// ─── La longueur, dite au moment où elle mord ────────────────────────────────
//
// **Née du retrait des phrases grises, le 31 août 2026.** « Au moins 12
// caractères. » s'affichait en permanence sous le champ ; il l'a fait retirer
// avec les autres. Sans remplacement, un bouton serait resté éteint sans raison
// lisible — la confirmation annonçant « les deux sont identiques ✓ » sur huit
// caractères.
essai("champ vide : l'exigence ne s'annonce pas d'avance", () => {
  assert.equal(etatNouveau("", []), null);
});

essai("trop court, elle le dit — et avec les mots du refus serveur", () => {
  assert.deepEqual(etatNouveau("bruyere", []), { message: messageRefus("trop-court") });
});

essai("assez long, elle se tait", () => {
  assert.equal(etatNouveau("bruyere-42-nord", []), null);
  assert.equal(etatNouveau("bruyere-nord-sud-est".slice(0, LONGUEUR_MINIMALE), []), null);
});

// ─── Les mots de passe que tout le monde essaie ──────────────────────────────
//
// **Sa question du 29 septembre 2026 :** *« il faudrait peut-être demander un
// mot de passe très sécurisé, avec un caractère spécial, une majuscule »*.
// Réponse : non à la grammaire (« Motdepasse1! » la respecte, et c'est le
// premier essayé), oui au refus de ce qu'un attaquant essaie en premier. Douze
// caractères laissaient passer « 123456789012 ».
essai("les suites, les répétitions et les mots connus sont refusés", () => {
  for (const m of [
    "123456789012",
    "987654321098",
    "azertyuiopqs",
    "qwertyuiop12",
    "abcdefghijkl",
    "111111111111",
    "abababababab",
    "motdepasse12",
    "Motdepasse1!",
    "P4ssw0rd2026",
    "password1234",
    "azerty123456",
    "soleilsoleil",
    "Bonjour2026!!",
    "abcabcabcabc",
    "12345678azerty",
  ]) {
    assert.equal(verifierNouveauMotDePasse(m, m, []), "trop-courant", `« ${m} » est accepté`);
  }
});

// Le contrôle ne doit pas refuser à tort : un refus qui tombe sur une phrase
// honnête apprend à contourner la règle, pas à la respecter.
essai("une phrase de plusieurs mots passe, même simple", () => {
  for (const m of [
    "chantier vert pelouse",
    "bruyere-42-nord",
    "tondeuse du lundi",
    "Chene tordu 1987",
    "x".repeat(4) + "yzw" + "12345",
  ]) {
    assert.equal(verifierNouveauMotDePasse(m, m, []), null, `« ${m} » est refusé`);
  }
});

// L'ordre de la saisie : trop court se dit avant trop courant, sans quoi
// « azerty » recevrait une phrase qui ne dit pas ce qui manque.
essai("sur un mot connu ET trop court, c'est la longueur qui est nommée", () => {
  assert.equal(verifierNouveauMotDePasse("azerty", "azerty", []), "trop-court");
});

essai("pendant la frappe, l'écran dit « trop courant » avec les mots du serveur", () => {
  assert.deepEqual(etatNouveau("123456789012", []), { message: messageRefus("trop-courant") });
});

essai("la phrase du refus se lit comme une phrase", () => {
  const m = messageRefus("trop-courant");
  assert.ok(m.includes(" ") && /[.!]$/.test(m), m);
});

// ─── Le nom et l'adresse du compte ───────────────────────────────────────────
//
// **29 septembre 2026, la suite du même lot.** Son nom est sur chaque devis :
// c'est le premier essai de qui en a lu un. « marrins2026! » ne contient aucun
// mot courant, et passait.
const FLORIAN = ["Florian", "Marrins", "florian.marrins85@gmail.com"];

essai("un mot de passe fait du nom ou de l'adresse est refusé", () => {
  for (const m of [
    "marrins2026!",
    "florianmarrins",
    "Florian.Marrins",
    "MarrinsFlorian85",
    "m4rrins-2026!!",
    "florian.marrins85@gmail.com",
  ]) {
    assert.equal(verifierNouveauMotDePasse(m, m, FLORIAN), "trop-personnel", `« ${m} » est accepté`);
  }
});

// Sans cet essai, le refus du dessus pourrait venir d'ailleurs que du compte.
essai("et le même, pour quelqu'un d'autre, passe", () => {
  assert.equal(verifierNouveauMotDePasse("marrins2026!", "marrins2026!", ["Anne", "Amiot", "anne@exemple.fr"]), null);
});

essai("son prénom dans une phrase qui apporte autre chose passe", () => {
  const m = "Florian taille les haies";
  assert.equal(verifierNouveauMotDePasse(m, m, FLORIAN), null);
});

// « Le », « Ba » : retenus, ils refuseraient des phrases honnêtes.
essai("un nom de moins de trois lettres n'est pas retenu", () => {
  const m = "le banc du jardin";
  assert.equal(verifierNouveauMotDePasse(m, m, ["Le", "Ba", "le@ba.fr"]), null);
});

essai("un mot de passe courant se dit courant, même avec un compte", () => {
  assert.equal(verifierNouveauMotDePasse("motdepasse12", "motdepasse12", FLORIAN), "trop-courant");
});

essai("pendant la frappe, l'écran le dit avec les mots du serveur", () => {
  assert.deepEqual(etatNouveau("marrins2026!", FLORIAN), { message: messageRefus("trop-personnel") });
});

// Les deux portes qui traduisent les refus à leur façon : un refus neuf qui
// ne s'y traduit pas passerait sans un mot.
essai("donner un accès à un salarié refuse son propre nom", () => {
  const r = refusDeLAcces({
    nom: "Florian Marrins",
    email: "florian.marrins85@gmail.com",
    role: "salarie",
    motDePasse: "marrins2026!",
    confirmation: "marrins2026!",
    emailDejaPris: false,
  });
  assert.equal(r, "mot-de-passe-trop-personnel");
  assert.equal(messageRefusAcces(r!), messageRefus("trop-personnel"));
});

essai("créer son compte refuse son propre nom", () => {
  const q = QUESTIONS.find((x) => x.id === "mdp")!;
  const reponses = { prenom: "Florian", nom: "Marrins", email: "florian.marrins85@gmail.com", mdp: "marrins2026!", confirm: "marrins2026!" };
  assert.equal(refusDe(q, reponses), messageRefus("trop-personnel"));
});

console.log("");
if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("Le mot de passe — 0 échec(s).");
