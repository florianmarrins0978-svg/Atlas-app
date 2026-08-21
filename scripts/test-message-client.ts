import assert from "node:assert";
import { canalPourJoindre, composerMessageClient, composerMessageFacture, lienTransmission } from "../src/lib/message-client";
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
