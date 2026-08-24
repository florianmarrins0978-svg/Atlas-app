import assert from "node:assert";
import {
  canalPourJoindre,
  composerMessageClient,
  composerMessageEntretien,
  composerMessageFacture,
  lienTransmission,
  refusDuMessage,
  rendreMessage,
  MESSAGE_MAX,
  MESSAGE_PAR_DEFAUT,
} from "../src/lib/message-client";
import { CIVILITE_PAR_DEFAUT, avecCivilite } from "../src/lib/civilite";

// Le message qui remet le devis au client part de la boîte du patron, en son
// nom. Ce qu'il contient n'est donc pas un détail de présentation : c'est un
// texte commercial signé par lui.

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const LIEN = "https://exemple.test/devis/jeton-abc";

test("Le message porte le lien du devis, en entier", () => {
  const m = composerMessageClient({ clientNom: "M. Bernard", entrepriseNom: "Eden Nature", lien: LIEN });
  assert.ok(m.corps.includes(LIEN), "sans le lien, le message ne sert à rien");
});

test("Le message nomme le client et signe l'entreprise", () => {
  const m = composerMessageClient({ clientNom: "M. Bernard", entrepriseNom: "Eden Nature", lien: LIEN });
  assert.ok(m.corps.startsWith("Bonjour M. Bernard,"));
  assert.ok(m.corps.trimEnd().endsWith("Eden Nature"));
  assert.ok(m.objet.includes("Eden Nature"));
});

test("Client sans nom : le message reste correct, jamais « Bonjour ,  »", () => {
  const m = composerMessageClient({ clientNom: "   ", entrepriseNom: "Eden Nature", lien: LIEN });
  assert.ok(m.corps.startsWith("Bonjour,"), "un salut bancal se remarque plus qu'il ne dérange");
});

// Le prix figure dans le devis. Le répéter ici créerait deux sources : le jour
// où le devis est repris, le message dirait encore l'ancien montant.
test("Aucun montant n'est répété dans le message", () => {
  const m = composerMessageClient({ clientNom: "M. Bernard", entrepriseNom: "Eden Nature", lien: LIEN });
  assert.equal(/\d+[.,]\d{2}\s*€|\d+\s*€/.test(m.corps), false);
});

test("E-mail : objet et corps sont transmis à l'application du patron", () => {
  const m = composerMessageClient({ clientNom: "M. Bernard", entrepriseNom: "Eden Nature", lien: LIEN });
  const url = lienTransmission({ canal: "email", destinataire: "client@exemple.fr", message: m });
  assert.ok(url.startsWith("mailto:"));
  assert.ok(url.includes(encodeURIComponent("client@exemple.fr")));
  assert.ok(url.includes("subject="));
  assert.ok(url.includes(encodeURIComponent(LIEN)), "le lien doit survivre à l'encodage");
});

test("SMS : le corps passe, et la forme accepte iOS comme Android", () => {
  const m = composerMessageClient({ clientNom: "M. Bernard", entrepriseNom: "Eden Nature", lien: LIEN });
  const url = lienTransmission({ canal: "sms", destinataire: "0612345678", message: m });
  assert.ok(url.startsWith("sms:0612345678"));
  assert.ok(url.includes("?&body="), "sans `?&`, iOS ouvre Messages mais laisse le texte de côté");
  assert.ok(url.includes(encodeURIComponent(LIEN)));
});

// Le numéro tel qu'il est RÉELLEMENT saisi sur la fiche du client — avec ses
// espaces, puisque c'est la forme que le champ propose. Un test qui n'emploie
// qu'un numéro collé « 0612345678 » reste vert sur un défaut que le patron
// rencontre à chaque envoi.
test("Un numéro espacé sur la fiche ouvre quand même le bon destinataire", () => {
  const m = composerMessageClient({ clientNom: "M. Bernard", entrepriseNom: "Eden Nature", lien: LIEN });
  const url = lienTransmission({ canal: "sms", destinataire: "06 12 34 56 78", message: m });
  assert.ok(
    url.startsWith("sms:0612345678?"),
    `un espace encodé en %20 fait perdre le destinataire — obtenu : ${url.slice(0, 40)}`
  );
});

test("Un numéro pointé ou tireté est accepté de la même façon", () => {
  const m = composerMessageClient({ clientNom: "M. Bernard", entrepriseNom: "Eden Nature", lien: LIEN });
  assert.ok(
    lienTransmission({ canal: "sms", destinataire: "06.12.34.56.78", message: m }).startsWith(
      "sms:0612345678?"
    )
  );
  assert.ok(
    lienTransmission({ canal: "sms", destinataire: "06-12-34-56-78", message: m }).startsWith(
      "sms:0612345678?"
    )
  );
});

// Ne pas s'ouvrir du tout serait pire : le patron connaît son client et peut
// compléter le destinataire lui-même.
test("Destinataire absent : le message s'ouvre quand même", () => {
  const m = composerMessageClient({ clientNom: "M. Bernard", entrepriseNom: "Eden Nature", lien: LIEN });
  assert.ok(lienTransmission({ canal: "email", destinataire: null, message: m }).startsWith("mailto:?"));
  assert.ok(lienTransmission({ canal: "sms", destinataire: "", message: m }).startsWith("sms:?"));
});


// ─── Ce que le CLIENT lit, et que le patron a corrigé le 13 août 2026 ────────
//
// Sa capture du SMS tout prêt : *« Bonjour Martins »*, et *« vous pourrez en
// proposer une autre »*. Deux corrections, mot pour mot : *« pareil pour le
// message tout prêt, c'est Bonjour Mr Martins »* et *« vous pouvez en proposer
// une autre »*.
//
// Ce texte-là est le seul que le client voie de nous avant d'ouvrir le devis :
// il n'a aucune suite de rattrapage.

test("Le message aborde le client par sa civilité", () => {
  const m = composerMessageClient({ clientNom: "Martins", entrepriseNom: "Atelier Démo", lien: LIEN });
  assert.ok(
    m.corps.startsWith(`Bonjour ${CIVILITE_PAR_DEFAUT} Martins,`),
    `le message s'ouvre sur « ${m.corps.split("\n")[0]} »`
  );
});

test("Une civilité déjà saisie n'est jamais doublée dans le message", () => {
  // « Bonjour Mr. Mme Roux » serait pire que pas de civilité du tout.
  for (const nom of ["Mme Roux", "M. Bernard", "SARL Untel"]) {
    const m = composerMessageClient({ clientNom: nom, entrepriseNom: "Atelier Démo", lien: LIEN });
    assert.ok(m.corps.startsWith(`Bonjour ${nom},`), `« ${m.corps.split("\n")[0]} »`);
  }
});

test("La facture aborde le client de la même façon que le devis", () => {
  // Deux règles séparées finiraient par diverger, et le client se demanderait
  // si le devis et la facture viennent bien du même artisan.
  const f = composerMessageFacture({
    clientNom: "Martins",
    entrepriseNom: "Atelier Démo",
    numeroFacture: "F2026-0001",
    lien: LIEN,
  });
  assert.ok(f.corps.startsWith(`Bonjour ${avecCivilite("Martins")},`), f.corps.split("\n")[0]);
});

test("La date se propose AU PRÉSENT : « vous pouvez », jamais « vous pourrez »", () => {
  const m = composerMessageClient({ clientNom: "Martins", entrepriseNom: "Atelier Démo", lien: LIEN });
  assert.ok(
    m.corps.includes("vous pouvez en proposer une autre"),
    "la phrase des dates ne dit plus ce que le patron a demandé"
  );
  // Le futur repoussait le geste à plus tard, comme s'il fallait d'abord faire
  // autre chose. Il ne doit pas revenir par une reformulation.
  assert.ok(!m.corps.includes("pourrez"), "le futur est revenu dans le message");
});

// ═══ SON MESSAGE, ÉCRIT PAR LUI — sa décision du 23 août 2026 ═══════════
//
// *« Message client A. Liens obligatoire. Et message pour tous. »* puis, devant
// les six bulles de la planche : *« façon 1 »*.

test("le lien est OBLIGATOIRE : un message sans lui est refusé", () => {
  // **Sa règle, et c'est un refus, pas un avertissement.** Sans lien, le
  // message part et le client ne peut rien ouvrir : le patron ne l'apprend
  // qu'au téléphone, une semaine plus tard.
  const refus = refusDuMessage("Bonjour [client], voici [document]. [entreprise]");
  assert.ok(refus, "un message sans lien a été accepté");
  assert.ok(/lien/i.test(refus), `le refus ne nomme pas le lien : « ${refus} »`);
  assert.equal(refusDuMessage(MESSAGE_PAR_DEFAUT), null, "le message d'Atlas est refusé");
});

test("un message vide ou démesuré est refusé, et le dit", () => {
  assert.ok(refusDuMessage("   "), "un message vide a été accepté");
  // Tronquer serait pire que refuser : un message coupé part QUAND MÊME, et
  // c'est le client qui lit la moitié d'une phrase.
  const trop = "[lien] " + "b".repeat(MESSAGE_MAX);
  const refus = refusDuMessage(trop);
  assert.ok(refus, "un message de plus de 2 000 caractères a été accepté");
  assert.ok(String(MESSAGE_MAX) === "2000" && refus.includes("2000"),
    `le refus ne dit pas la borne : « ${refus} »`);
});

test("UN SEUL message, et chaque document dit ce qu'il doit dire", () => {
  // **Le cœur de sa « façon 1 ».** Le même gabarit sert les trois envois ; ce
  // qui les distingue vient d'Atlas, à l'endroit où il a posé `[document]`.
  const commun = { clientNom: "Larousse", entrepriseNom: "Eden Nature", lien: LIEN };
  const devis = composerMessageClient(commun).corps;
  const facture = composerMessageFacture({
    ...commun,
    numeroFacture: "F2026-0008",
    echeanceLisible: "21 septembre",
  }).corps;
  const rapport = composerMessageEntretien(commun).corps;

  // Le cadre est le même : c'est ce qu'il a demandé.
  for (const corps of [devis, facture, rapport]) {
    // **« Mr. Larousse », pas « Larousse ».** La civilité vient de
    // `src/lib/civilite.ts`, sa règle du 13 août : ce contrôle l'attendait sans
    // elle, et c'est LUI qui avait tort. Un contrôle qui exige moins que le
    // produit finit par autoriser une régression.
    assert.ok(corps.startsWith("Bonjour Mr. Larousse,"), `le cadre diffère : ${corps.slice(0, 40)}`);
    assert.ok(corps.includes(LIEN), "le lien manque");
    assert.ok(corps.trimEnd().endsWith("Eden Nature"), "la signature manque");
  }

  // Le milieu, lui, ne l'est PAS — et c'est ce que la façon 2 lui coûtait.
  assert.ok(/votre devis/i.test(devis), "le devis ne se nomme pas");
  assert.ok(/votre facture F2026-0008/i.test(facture), "la facture ne porte pas son numéro");
  assert.ok(/à régler avant le 21 septembre/i.test(facture),
    "l'échéance manque : c'est précisément ce qu'il a refusé de perdre");
  assert.ok(/compte rendu de mon passage/i.test(rapport), "le compte rendu ne se nomme pas");

  // **Et aucun ne parle du document d'un autre.** Une facture qui annonce un
  // devis, c'est le client qui rappelle pour comprendre.
  assert.ok(!/votre devis/i.test(facture), "la facture parle d'un devis");
  assert.ok(!/votre devis|facture/i.test(rapport), "le compte rendu parle d'un autre document");
});

test("SON message remplace celui d'Atlas, partout", () => {
  const sien = "Salut [client] !\n[document]\n[lien]\nÀ bientôt, [entreprise]";
  const commun = { clientNom: "Larousse", entrepriseNom: "Eden Nature", lien: LIEN, modele: sien };
  const devis = composerMessageClient(commun).corps;
  const facture = composerMessageFacture({ ...commun, numeroFacture: "F2026-0008" }).corps;

  assert.ok(devis.startsWith("Salut Mr. Larousse !"), `son message n'est pas servi : ${devis.slice(0, 40)}`);
  assert.ok(devis.includes("À bientôt, Eden Nature"), "sa signature n'est pas servie");
  // Le sien sert AUSSI la facture : c'est « un message pour tous ».
  assert.ok(facture.startsWith("Salut Mr. Larousse !"), "la facture garde l'ancien message");
  assert.ok(/votre facture F2026-0008/i.test(facture), "la phrase du document n'est plus posée");
  // Et une pastille inconnue reste en clair plutôt que de disparaître : il la
  // voit à l'aperçu et se corrige, au lieu de perdre un mot sans savoir où.
  assert.ok(
    rendreMessage("[client] [inconnue] [lien]", {
      client: "A", document: "D", lien: "L", entreprise: "E",
    }) === "A [inconnue] L",
    "une pastille inconnue ne survit pas telle quelle"
  );
});

test("un message vide RETOMBE sur celui d'Atlas, il ne part pas nu", () => {
  // Il efface tout, enregistre, et part en chantier : le client doit recevoir
  // un message, pas une ligne vide.
  const corps = composerMessageClient({
    clientNom: "Larousse", entrepriseNom: "Eden Nature", lien: LIEN, modele: "   ",
  }).corps;
  assert.ok(corps.includes(LIEN) && corps.includes("Bonjour"), `message nu : « ${corps} »`);
});

test("Le canal se DÉDUIT, il ne s'invente pas", () => {
  // **Son défaut du 20 août 2026** : *« sur la fiche client j'ai choisi
  // d'envoyer le devis par email […] c'est l'application SMS qui s'est
  // ouverte »*. Les écrans portaient un `?? "sms"` écrit à la main.

  // 1. Le canal convenu prime — c'est un accord avec la personne.
  assert.equal(
    canalPourJoindre({ canal: "email", telephone: "0612345678", email: "a@b.c" }),
    "email",
    "le canal convenu sur la fiche du client ne prime pas"
  );
  assert.equal(canalPourJoindre({ canal: "sms", telephone: "0612345678", email: "a@b.c" }), "sms");

  // 2. Un canal convenu SANS sa coordonnée ne vaut rien : il ouvrirait un
  //    message sans destinataire.
  assert.equal(canalPourJoindre({ canal: "sms", telephone: null, email: "a@b.c" }), "email");
  assert.equal(canalPourJoindre({ canal: "email", telephone: "0612345678", email: "" }), "sms");

  // 3. Une seule coordonnée : deviner est sans risque.
  assert.equal(canalPourJoindre({ telephone: null, email: "a@b.c" }), "email");
  assert.equal(canalPourJoindre({ telephone: "0612345678", email: null }), "sms");

  // 4. Deux coordonnées et aucun accord : on ne SAIT PAS, et on le dit.
  //    C'est là que le `?? "sms"` mentait.
  assert.equal(
    canalPourJoindre({ telephone: "0612345678", email: "a@b.c" }),
    null,
    "sans canal convenu, l'application choisit encore à sa place"
  );
  assert.equal(canalPourJoindre({ telephone: null, email: null }), null);
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
