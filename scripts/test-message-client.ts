import assert from "node:assert";
import { composerMessageClient, lienTransmission } from "../src/lib/message-client";

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

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
