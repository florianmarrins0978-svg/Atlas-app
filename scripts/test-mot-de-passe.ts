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
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord"), null);
});

essai("onze caractères ne suffisent pas", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42n", "bruyere-42n"), "trop-court");
});

// **La barre est montée de huit à douze le 23 août 2026** (audit, constat C1).
// Ce cas fige l'ancienne valeur pour qu'un retour en arrière se voie : huit
// caractères étaient acceptés, ils ne le sont plus. Sans lui, quelqu'un
// pourrait remettre 8 dans la constante et toute la suite resterait verte —
// c'est exactement ce qu'un contrôle doit empêcher.
essai("ce qui passait avant — huit caractères — est désormais refusé", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere1", "bruyere1"), "trop-court");
});

essai("la limite annoncée à l'écran est CELLE-CI, pas une autre", () => {
  const juste = "x".repeat(LONGUEUR_MINIMALE);
  assert.equal(verifierNouveauMotDePasse(juste, juste), null);
  const court = "x".repeat(LONGUEUR_MINIMALE - 1);
  assert.equal(verifierNouveauMotDePasse(court, court), "trop-court");
});

essai("une confirmation différente bloque", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-sud"), "confirmation-differente");
});

// **La longueur passe AVANT la confirmation, et l'ordre n'est pas indifférent.**
// Dire « la confirmation diffère » sur un mot de passe de trois caractères
// envoie corriger la mauvaise ligne — une erreur qui accuse à tort coûte plus
// cher que pas d'erreur du tout (`AGENTS.md`).
essai("sur une saisie doublement fautive, c'est la longueur qui est nommée", () => {
  assert.equal(verifierNouveauMotDePasse("abc", "xyz"), "trop-court");
});

essai("reprendre son mot de passe actuel ne change rien, et se refuse", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord", "bruyere-42-nord"), "sans-changement");
});

essai("mais un mot de passe différent de l'actuel passe", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord", "chene-tordu"), null);
});

// L'actuel n'est pas toujours connu de l'appelant : l'écran, lui, ne l'a jamais
// en clair confronté au condensat. Sans cette tolérance, il devrait inventer
// une seconde règle — exactement ce que cette suite empêche.
essai("sans mot de passe actuel fourni, la règle ne s'invente rien", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord"), null);
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord", ""), null);
});

// **Les espaces comptent.** Les rogner enregistrerait autre chose que ce qui a
// été tapé, et la reconnexion échouerait sans que rien ne l'explique.
essai("une espace finale fait une confirmation différente", () => {
  assert.equal(verifierNouveauMotDePasse("bruyere-42-nord", "bruyere-42-nord "), "confirmation-differente");
});

// **Ce contrôle a d'abord refusé « n'est pas celui-là » à cause de son trait
// d'union.** Chercher un tiret, c'était accuser le français plutôt que le code
// — et une alerte qui désigne le mauvais coupable coûte plus cher que pas
// d'alerte (`AGENTS.md`). Ce qui compte est ailleurs : la phrase ne doit pas
// ÊTRE le code, et elle doit se lire.
essai("chaque refus porte une phrase, jamais un code", () => {
  for (const r of ["trop-court", "confirmation-differente", "sans-changement", "actuel-faux"] as const) {
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
  assert.equal(etatNouveau(""), null);
});

essai("trop court, elle le dit — et avec les mots du refus serveur", () => {
  assert.deepEqual(etatNouveau("bruyere"), { message: messageRefus("trop-court") });
});

essai("assez long, elle se tait", () => {
  assert.equal(etatNouveau("bruyere-42-nord"), null);
  assert.equal(etatNouveau("a".repeat(LONGUEUR_MINIMALE)), null);
});

console.log("");
if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("Le mot de passe — 0 échec(s).");
