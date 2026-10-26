import assert from "node:assert/strict";
import {
  CHAPITRES,
  QUESTIONS,
  avanceToutSeul,
  numeroTvaDuSiret,
  phraseDeCeQuiManque,
  questionsApplicables,
  refusDe,
  reponsesProposees,
  resteAFaire,
  totalAnnonce,
  typographie,
  type Question,
} from "../src/lib/creation-compte";
import { LONGUEUR_MINIMALE } from "../src/lib/mot-de-passe";
import { MAX_EQUIPES } from "../src/lib/equipes";

/**
 * LES QUESTIONS DE LA PORTE — les règles, sans base et sans navigateur.
 *
 * **Ce qu'elle défend, et c'est une RÈGLE, pas un libellé** (`CLAUDE.md`
 * §5 bis) : ce qui se pose, ce qui se refuse, ce qui se propose, et ce qu'on
 * annonce. Si demain il fait changer un mot à l'écran, aucune ligne d'ici ne
 * doit rougir.
 *
 * **Elle sait échouer** : en remettant le plancher de huit caractères que la
 * porte portait d'abord, `mot de passe : la règle du produit` rougit ; en
 * comptant les questions applicables au lieu des possibles, `le total ne monte
 * jamais` rougit ; et contre les seize questions d'avant le 26 octobre 2026,
 * `la fin ne dit jamais « tout est prêt » sans médiateur` rougit (vérifié en la
 * jouant contre la version précédente de `creation-compte.ts`).
 */

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

const q = (id: string): Question => {
  const trouvee = QUESTIONS.find((x) => x.id === id);
  assert.ok(trouvee, `question inconnue : ${id}`);
  return trouvee;
};
const rang = (id: string) => QUESTIONS.findIndex((x) => x.id === id);
const champs = (question: Question) => (question.champs ?? []).map((c) => c.cle);

// Une société assujettie avec une décennale, tout rempli : le cas le plus long.
const SOCIETE: Record<string, string> = {
  identite: "mme",
  prenom: "Anne",
  nom: "Amiot",
  email: "anne@exemple.fr",
  mdp: "un mot de passe long",
  confirm: "un mot de passe long",
  tel: "0102030405",
  emailPro: "contact@amiot.fr",
  entreprise: "Amiot Paysage",
  forme: "SASU",
  capital: "1 000",
  rcs: "Versailles",
  siret: "12345678901234",
  adresse: "3 rue des Tilleuls",
  tva: "assujettie",
  numTva: "FR32123456789",
  rythme: "mensuelle",
  reversement: "encaissements",
  iban: "FR7612345678901234567890123",
  titulaire: "Amiot Paysage",
  moyens: "virement, chèque",
  decennale: "oui",
  attestation: "jointe",
  assureur: "Assureur de démonstration",
  adresseAssureur: "1 rue de l’Exemple, Nantes",
  couverture: "France métropolitaine",
  mediateur: "Médiateur de démonstration",
  mediateurOu: "mediateur.example",
  equipes: "1",
};

test("sept chapitres, et on parle de LUI avant sa société", () => {
  // **Sa correction du 8 septembre 2026** : « avant le nom de l'entreprise, je
  // pense qu'il faut mettre le numéro de tél ». Les deux chapitres du
  // 26 octobre viennent après l'argent, dans l'ordre de Mon entreprise.
  assert.deepEqual(
    [...CHAPITRES],
    ["Vous", "Vous joindre", "Votre entreprise", "La TVA", "Être payé", "Assurance et médiateur", "Votre équipe"]
  );
  assert.ok(rang("joindre") < rang("entreprise"), "le téléphone est demandé après le nom de l'entreprise");
});

test("trois paires sur un écran, comme les paquets de Mon entreprise", () => {
  assert.deepEqual(champs(q("joindre")), ["tel", "emailPro"]);
  assert.deepEqual(champs(q("capitalRcs")), ["capital", "rcs"]);
  assert.deepEqual(champs(q("paye")), ["iban", "titulaire"]);
  // Une case qui partage son écran porte son nom au-dessus : remplie, elle ne
  // montre plus son exemple.
  for (const question of QUESTIONS) {
    if ((question.champs?.length ?? 0) < 2) continue;
    for (const champ of question.champs ?? []) assert.ok(champ.libelle, `${champ.cle} n'a pas de nom au-dessus`);
  }
});

test("une question conditionnelle suit CELLE QUI LA COMMANDE", () => {
  for (const [conditionnelle, commande] of [
    ["capitalRcs", "forme"],
    ["numTva", "tva"],
    ["attestation", "decennale"],
  ]) {
    assert.equal(rang(conditionnelle) - rang(commande), 1, `${conditionnelle} ne suit pas ${commande}`);
  }
});

test("une case qui en REPREND une autre vient après elle", () => {
  for (const question of QUESTIONS) {
    for (const champ of question.champs ?? []) {
      if (!champ.repriseDe) continue;
      const source = QUESTIONS.findIndex((x) => champs(x).includes(champ.repriseDe!));
      assert.ok(source >= 0 && source < rang(question.id), `${champ.cle} propose ${champ.repriseDe}, pas encore posé`);
    }
  }
});

test("les chapitres ne s'entrecoupent pas", () => {
  const vus = new Set<string>();
  let precedent = "";
  for (const question of QUESTIONS) {
    if (question.chapitre === precedent) continue;
    assert.ok(!vus.has(question.chapitre), `le chapitre « ${question.chapitre} » revient après en être sorti`);
    vus.add(question.chapitre);
    precedent = question.chapitre;
  }
});

test("quatorze questions pour une micro-entreprise sans décennale, vingt au plus long", () => {
  const micro = questionsApplicables({ forme: "Micro-entreprise", tva: "franchise", decennale: "non" }).map((x) => x.id);
  for (const absente of ["capitalRcs", "numTva", "rythme", "reversement", "attestation", "assureur"]) {
    assert.ok(!micro.includes(absente), `${absente} est posée à une micro-entreprise en franchise sans décennale`);
  }
  assert.equal(micro.length, 14);
  assert.equal(questionsApplicables(SOCIETE).length, 20);
  assert.equal(QUESTIONS.length, 20);
});

test("le total annoncé ne monte JAMAIS en cours de route", () => {
  assert.equal(totalAnnonce({}), 20);
  assert.equal(totalAnnonce({ forme: "SASU", tva: "assujettie", decennale: "oui" }), 20);
  assert.ok(totalAnnonce({ forme: "EI", tva: "franchise" }) < 20);
  for (const reponses of [{}, { forme: "EI" }, { forme: "SASU" }, { decennale: "non" }, SOCIETE]) {
    assert.ok(
      totalAnnonce(reponses) >= questionsApplicables(reponses).length,
      `« x sur ${totalAnnonce(reponses)} » alors qu'on pose ${questionsApplicables(reponses).length} questions`
    );
  }
});

test("mot de passe : la règle du produit, jamais une seconde", () => {
  const bon = "bruyere-nord-sud-est".slice(0, LONGUEUR_MINIMALE);
  const court = bon.slice(0, -1);
  assert.ok(refusDe(q("mdp"), { mdp: court, confirm: court }), "un mot de passe trop court est accepté");
  assert.equal(refusDe(q("mdp"), { mdp: bon, confirm: bon }), null);
  assert.ok(refusDe(q("mdp"), { mdp: "123456789012", confirm: "123456789012" }), "une suite de chiffres est acceptée");
  assert.ok(refusDe(q("mdp"), { mdp: bon, confirm: `${bon}!` }), "deux saisies différentes sont acceptées");
});

test("l'identité dit LAQUELLE des trois cases manque", () => {
  assert.match(String(refusDe(q("identite"), {})), /Madame ou Monsieur/);
  assert.match(String(refusDe(q("identite"), { identite: "mme" })), /prénom/i);
  assert.match(String(refusDe(q("identite"), { identite: "mme", prenom: "Anne" })), /nom/i);
  assert.equal(refusDe(q("identite"), { identite: "mme", prenom: "Anne", nom: "Amiot" }), null);
});

test("un capital illisible ou trop grand se refuse à la question, pas en silence", () => {
  const capital = q("capitalRcs");
  assert.equal(refusDe(capital, { capital: "1 000" }), null);
  assert.equal(refusDe(capital, { capital: "1000,50" }), null);
  assert.equal(refusDe(capital, {}), null, "vide, c'est permis");
  assert.ok(refusDe(capital, { capital: "mille euros" }), "un capital en lettres est accepté");
  // 13 septembre 2026 : quinze chiffres faisaient échouer la création ENTIÈRE.
  assert.ok(refusDe(capital, { capital: "999999999999999" }), "un capital que la base ne peut pas porter passe");
  assert.equal(refusDe(capital, { capital: "9999999999,99" }), null);
});

test("ce qu'on propose d'office est ce qui part en base", () => {
  const vues = reponsesProposees({ email: "anne@exemple.fr", entreprise: "Amiot Paysage", siret: "123 456 789 00012", tva: "assujettie" });
  assert.equal(vues.emailPro, "anne@exemple.fr");
  assert.equal(vues.titulaire, "Amiot Paysage");
  assert.equal(vues.moyens, "virement, chèque");
  assert.equal(vues.equipes, "1");
  assert.equal(vues.rythme, "mensuelle");
  assert.equal(vues.reversement, "encaissements");
  // Le numéro de TVA se tire du SIRET, par la règle qui sert déjà aux clients.
  assert.equal(vues.numTva, "FR32123456789");
  // Une case vidée à la main reste vide : c'est une réponse, pas une absence.
  assert.equal(reponsesProposees({ email: "anne@exemple.fr", emailPro: "" }).emailPro, "");
  assert.equal(reponsesProposees({ siret: "12345678900012", tva: "assujettie", numTva: "" }).numTva, "");
});

test("le numéro de TVA ne se tire que d'un SIRET entier", () => {
  assert.equal(numeroTvaDuSiret("123 456 789 00012"), "FR32123456789");
  assert.equal(numeroTvaDuSiret("123 456 789"), null);
  assert.equal(numeroTvaDuSiret(undefined), null);
  // Une franchise n'a pas de numéro : rien ne se propose hors de sa question.
  assert.equal(reponsesProposees({ siret: "12345678900012", tva: "franchise" }).numTva, undefined);
});

test("LA FIN NE DIT JAMAIS « TOUT EST PRÊT » SANS MÉDIATEUR — 26 octobre 2026", () => {
  // Vu à la capture : la porte disait « Vos réglages sont remplis », et Mon
  // entreprise disait juste après le médiateur manquant et obligatoire.
  const sansMediateur = { ...SOCIETE, mediateur: "", mediateurOu: "" };
  assert.ok(resteAFaire(sansMediateur).includes("le médiateur"), "un médiateur passé n'est pas réclamé à la fin");
  assert.ok(phraseDeCeQuiManque(resteAFaire(sansMediateur)), "la fin n'a rien à dire sans médiateur");
});

test("la décennale se réclame seulement chez qui en a une", () => {
  const avec = resteAFaire({ ...SOCIETE, attestation: "", assureur: "" });
  assert.ok(avec.includes("l’attestation") && avec.includes("l’assureur"));
  const sans = resteAFaire({ ...SOCIETE, decennale: "non", attestation: "", assureur: "" });
  assert.ok(!sans.includes("l’attestation") && !sans.includes("l’assureur"), "une décennale réclamée à qui n'en a pas");
});

test("ce qui a été proposé ne se compte pas comme manquant", () => {
  const reste = resteAFaire({ email: "anne@exemple.fr", entreprise: "Amiot Paysage" });
  assert.ok(!reste.includes("l’e-mail de l’entreprise"), "une réponse proposée est comptée comme manquante");
  assert.ok(!reste.includes("le titulaire du compte"));
  assert.ok(reste.includes("le SIRET"), "le SIRET non saisi n'est pas signalé");
});

test("tout rempli : plus rien à dire", () => {
  assert.deepEqual(resteAFaire(SOCIETE), []);
  assert.equal(phraseDeCeQuiManque([]), null);
});

test("trois manques nommés au plus, le reste se compte", () => {
  assert.equal(phraseDeCeQuiManque(["le SIRET"]), "Il manque le SIRET.");
  assert.equal(phraseDeCeQuiManque(["le SIRET", "l’adresse"]), "Il manque le SIRET et l’adresse.");
  assert.equal(phraseDeCeQuiManque(["a", "b", "c", "d"]), "Il manque a, b et c, et 1 autre.");
  assert.match(String(phraseDeCeQuiManque(["a", "b", "c", "d", "e"])), /2 autres\.$/);
});

test("une question obligatoire ne se réclame jamais à la fin", () => {
  for (const question of QUESTIONS) {
    if (!question.requis) continue;
    assert.ok(!question.reste, `${question.id} est obligatoire ET réclamée à la fin`);
    for (const champ of question.champs ?? []) assert.ok(!champ.reste, `${champ.cle} est obligatoire ET réclamé`);
  }
});

test("Oui ou Non et la forme avancent tout seuls ; ce qui est proposé, non", () => {
  assert.equal(avanceToutSeul(q("tva")), true);
  assert.equal(avanceToutSeul(q("decennale")), true);
  assert.equal(avanceToutSeul(q("forme")), true);
  assert.equal(avanceToutSeul(q("identite")), false);
  for (const id of ["moyens", "rythme", "reversement", "equipes"]) {
    assert.equal(avanceToutSeul(q(id)), false, `${id} quitte l'écran alors qu'une réponse est déjà entourée`);
  }
});

test("ce qui est proposé ne se refuse jamais, et ne se réclame jamais", () => {
  for (const id of ["moyens", "rythme", "reversement", "equipes"]) {
    const question = q(id);
    assert.ok(question.propose !== undefined && question.requis, `${id} n'a pas de réponse proposée`);
    assert.equal(refusDe(question, reponsesProposees(SOCIETE)), null);
  }
  assert.deepEqual(
    q("moyens").liste?.map((o) => o.valeur),
    ["virement, chèque", "virement", "virement, chèque, espèces"]
  );
});

test("les chantiers par jour gardent les bornes de Réglages", () => {
  assert.deepEqual(q("equipes").compteur, { min: 1, max: MAX_EQUIPES });
});

test("l'espace insécable colle le « ? », et « reversez-vous » ne se coupe pas", () => {
  assert.equal(typographie("Facturez-vous la TVA ?"), "Facturez‑vous la TVA ?");
  assert.equal(typographie("Choisissez un mot de passe"), "Choisissez un mot de passe");
  for (const question of QUESTIONS) {
    assert.ok(!question.question.includes(" "), `${question.id} écrit l'insécable à la main`);
  }
});

console.log(`\n${passed} réussis, ${failed} échoués`);
if (failed > 0) process.exit(1);
