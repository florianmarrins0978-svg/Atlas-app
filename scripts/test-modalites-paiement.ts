// COMMENT LE CLIENT NOUS RÈGLE — la règle pure, éprouvée sans base.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE DÉFEND, ET POURQUOI ELLE COMPTE.** Le client reçoit DEUX
// pièces pour une seule facture : la page ouverte par son lien, et le PDF
// archivé qu'elle télécharge. Les deux composent leurs mentions de paiement
// avec les fonctions de ce module. Si elles divergeaient d'un caractère — un
// IBAN groupé autrement, un ordre de chèque calculé deux fois —, le client
// aurait deux consignes pour un seul règlement, et personne ne saurait laquelle
// suivre.
//
// C'est pour cela que la règle vit dans `src/lib/` et pas dans les deux écrans
// (`CLAUDE.md` §3), et c'est pour cela qu'on l'éprouve ici, sans base et sans
// navigateur.

import assert from "node:assert/strict";
import {
  LIBELLE_APRES,
  LIBELLE_AVANT,
  consigneDuLibelle,
  ibanEnGroupes,
  ibanSansEspace,
  modalitesDeLaFacture,
  modalitesDePaiement,
  ordreDuCheque,
  phraseDuCheque,
} from "../src/lib/modalites-paiement";

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

console.log("=== Les modalités de paiement ===\n");

// ─── L'IBAN : ce qui se lit, ce qui se copie ────────────────────────────────

essai("un IBAN se relit par paquets de quatre", () => {
  assert.equal(
    ibanEnGroupes("FR7630006000011234567890189"),
    "FR76 3000 6000 0112 3456 7890 189"
  );
});

essai("il se saisit comme on veut, il se lit toujours pareil", () => {
  // Trois façons de taper le MÊME IBAN. Sans normalisation, « FR76 30006 »
  // décalerait tous les paquets d'un caractère et le client ne pourrait plus le
  // comparer à son relevé.
  const attendu = "FR76 3000 6000 0112 3456 7890 189";
  assert.equal(ibanEnGroupes("fr7630006000011234567890189"), attendu);
  assert.equal(ibanEnGroupes("FR76 30006 000011234567890189"), attendu);
  assert.equal(ibanEnGroupes("  FR76 3000 6000 0112 3456 7890 189  "), attendu);
});

essai("aucune espace en trop à la fin, même quand la longueur tombe juste", () => {
  // Vingt-quatre caractères : un multiple de quatre exact. Sans le `trim()`
  // final, la chaîne finirait par une espace — invisible à l'œil, et recopiée
  // telle quelle dans un virement.
  const vingtQuatre = "FR7630006000011234567890";
  assert.equal(ibanEnGroupes(vingtQuatre).endsWith(" "), false);
  assert.equal(ibanEnGroupes(vingtQuatre), "FR76 3000 6000 0112 3456 7890");
});

essai("CE QU'ON COPIE N'A PAS D'ESPACE — beaucoup de banques les refusent", () => {
  const m = modalitesDePaiement({
    iban: "FR76 3000 6000 0112 3456 7890 189",
    titulaireCompte: null,
    nomEntreprise: "Jardins du Val",
  });
  assert.equal(m.ibanACopier, "FR7630006000011234567890189");
  assert.equal(/\s/.test(m.ibanACopier ?? ""), false, "l'IBAN copié porte une espace");
  // Et ce n'est PAS la même chaîne que celle qu'on montre : les confondre ferait
  // soit un IBAN illisible à l'écran, soit un virement refusé.
  assert.notEqual(m.ibanACopier, m.ibanLisible);
});

essai("un IBAN absent, vide ou blanc ne rend rien — jamais une case vide", () => {
  for (const rien of [null, "", "   "]) {
    const m = modalitesDePaiement({
      iban: rien,
      titulaireCompte: null,
      nomEntreprise: "Jardins du Val",
    });
    assert.equal(m.ibanLisible, null, `« ${rien} » devrait ne rien rendre`);
    assert.equal(m.ibanACopier, null);
  }
});

essai("l'IBAN nu passe en majuscules", () => {
  // Un IBAN se lit et se compare en majuscules ; une saisie en minuscules ne
  // doit pas produire deux valeurs différentes pour le même compte.
  assert.equal(ibanSansEspace("fr76 3000"), "FR763000");
});

// ─── L'ordre du chèque ──────────────────────────────────────────────────────

essai("LE TITULAIRE L'EMPORTE — un chèque à l'enseigne se fait refuser au guichet", () => {
  assert.equal(
    ordreDuCheque({ iban: null, titulaireCompte: "Marcel Dupont", nomEntreprise: "Jardins du Val" }),
    "Marcel Dupont"
  );
});

essai("sans titulaire, l'ordre est le nom de l'entreprise", () => {
  for (const rien of [null, "", "   "]) {
    assert.equal(
      ordreDuCheque({ iban: null, titulaireCompte: rien, nomEntreprise: "Jardins du Val" }),
      "Jardins du Val",
      `« ${rien} » n'est pas un nom, et ne doit pas passer pour un titulaire`
    );
  }
});

essai("les blancs de saisie ne se retrouvent pas sur le chèque", () => {
  assert.equal(
    ordreDuCheque({ iban: null, titulaireCompte: "  Marcel Dupont  ", nomEntreprise: "X" }),
    "Marcel Dupont"
  );
  assert.equal(
    ordreDuCheque({ iban: null, titulaireCompte: null, nomEntreprise: "  Jardins du Val " }),
    "Jardins du Val"
  );
});

essai("« à l'ordre de : X » — deux points, et donc aucune élision à deviner", () => {
  // Écrit « à l'ordre d'Atlas », il faudrait deviner l'apostrophe au nom près :
  // « d'Atlas » mais « de Dupont », « d'Élagage » mais « de Herbier » — et le h
  // aspiré n'est décidable par aucune règle mécanique.
  assert.equal(phraseDuCheque("Atlas"), "Par chèque, à l'ordre de : Atlas.");
  assert.equal(phraseDuCheque("Dupont Paysage"), "Par chèque, à l'ordre de : Dupont Paysage.");
  for (const nom of ["Atlas", "Élagage du Val", "Herbier & Fils"]) {
    assert.equal(
      /à l'ordre d'/.test(phraseDuCheque(nom)),
      false,
      `« ${nom} » a reçu une élision devinée`
    );
  }
});

// ─── La consigne du libellé ─────────────────────────────────────────────────

essai("LA CONSIGNE DIT LE NUMÉRO, ET CE QUI ARRIVE SANS LUI", () => {
  const phrase = consigneDuLibelle("F2026-000002");
  assert.ok(phrase.includes("F2026-000002"), "le numéro ne figure pas dans la consigne");
  // « Merci d'indiquer le numéro » se lit comme une politesse et s'oublie. La
  // conséquence est ce qui la fait respecter.
  assert.ok(
    phrase.includes("ne peut pas être rattaché"),
    "la consigne ne dit plus ce qu'il en coûte de l'ignorer"
  );
});

essai("LA PAGE ET LE PDF DISENT LA MÊME PHRASE, au caractère près", () => {
  // L'écran met le numéro en gras et compose donc la phrase en deux morceaux ;
  // le papier l'écrit d'un trait. Ce contrôle est ce qui empêche les deux de
  // dériver — c'est-à-dire de donner deux consignes au même client.
  const numero = "F2026-000014";
  assert.equal(`${LIBELLE_AVANT} ${numero} ${LIBELLE_APRES}`, consigneDuLibelle(numero));
});

// ─── Ce que la facture porte ────────────────────────────────────────────────

essai("les colonnes FIGÉES de la facture donnent les mêmes modalités", () => {
  const m = modalitesDeLaFacture({
    entrepriseIban: "FR7630006000011234567890189",
    entrepriseTitulaireCompte: "Marcel Dupont",
    entrepriseNom: "Jardins du Val",
  });
  assert.equal(m.ibanLisible, "FR76 3000 6000 0112 3456 7890 189");
  assert.equal(m.ibanACopier, "FR7630006000011234567890189");
  assert.equal(m.ordreDuCheque, "Marcel Dupont");
});

essai("une facture sans IBAN garde quand même un ordre de chèque", () => {
  // C'est le cas d'un artisan qui n'a jamais rempli ses coordonnées bancaires :
  // le pavé « Pour régler » perd le virement, pas le chèque. Rendre un ordre
  // vide ferait imprimer « à l'ordre de :  » sur une facture.
  const m = modalitesDeLaFacture({
    entrepriseIban: null,
    entrepriseTitulaireCompte: null,
    entrepriseNom: "Jardins du Val",
  });
  assert.equal(m.ibanLisible, null);
  assert.equal(m.ordreDuCheque, "Jardins du Val");
  assert.notEqual(m.ordreDuCheque.trim(), "");
});

console.log("");
console.log(`Les modalités de paiement — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
