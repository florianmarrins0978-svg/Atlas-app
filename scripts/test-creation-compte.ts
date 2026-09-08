import assert from "node:assert/strict";
import {
  CHAPITRES,
  QUESTIONS,
  avanceToutSeul,
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

/**
 * LES QUESTIONS DE LA PORTE — les règles, sans base et sans navigateur.
 *
 * **Ce qu'elle défend, et c'est une RÈGLE, pas un libellé** (`CLAUDE.md`
 * §5 bis) : ce qui se pose, ce qui se refuse, ce qui se propose, et ce qu'on
 * annonce. Si demain il fait changer un mot à l'écran, aucune ligne d'ici ne
 * doit rougir.
 *
 * **Elle sait échouer**, et cela a été vérifié en la confrontant à l'état
 * qu'elle prétend détecter : en remettant le plancher de huit caractères que
 * la porte portait d'abord, `mot de passe : la règle du produit` rougit ; en
 * comptant les questions applicables au lieu des possibles, `le total ne monte
 * jamais` rougit.
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

// Une société assujettie, tout rempli — le cas le plus long.
const SOCIETE: Record<string, string> = {
  identite: "mme",
  prenom: "Anne",
  nom: "Amiot",
  email: "anne@exemple.fr",
  mdp: "un mot de passe long",
  confirm: "un mot de passe long",
  entreprise: "Amiot Paysage",
  forme: "SASU",
  siret: "12345678901234",
  adresse: "3 rue des Tilleuls",
  capital: "1 000",
  rcs: "Versailles",
  tel: "0102030405",
  emailPro: "contact@amiot.fr",
  tva: "assujettie",
  numTva: "FR12345678901",
  iban: "FR7612345678901234567890123",
  titulaire: "Amiot Paysage",
  moyens: "Virement, chèque",
};

test("seize questions, cinq chapitres, et on parle de LUI avant sa société", () => {
  assert.equal(QUESTIONS.length, 16);
  // **Sa correction du 8 septembre 2026** : « avant le nom de l'entreprise, je
  // pense qu'il faut mettre le numéro de tél ». On finit de parler de la
  // personne avant de parler de sa société.
  assert.deepEqual([...CHAPITRES], ["Vous", "Vous joindre", "Votre entreprise", "La TVA", "Être payé"]);
});

test("le téléphone se demande AVANT le nom de l'entreprise", () => {
  const rang = (id: string) => QUESTIONS.findIndex((q) => q.id === id);
  assert.ok(rang("tel") < rang("entreprise"), "le téléphone est demandé après le nom de l'entreprise");
  assert.ok(rang("tel") > rang("identite"), "le téléphone est demandé avant de savoir qui il est");
});

test("une question conditionnelle suit CELLE QUI LA COMMANDE", () => {
  // Choisir « SASU » puis se voir demander son capital deux questions plus loin
  // rompt le fil — et l'on ne voit plus POURQUOI on le demande.
  const rang = (id: string) => QUESTIONS.findIndex((q) => q.id === id);
  for (const [conditionnelle, commande] of [
    ["capital", "forme"],
    ["rcs", "forme"],
    ["numTva", "tva"],
  ]) {
    const ecart = rang(conditionnelle) - rang(commande);
    assert.ok(ecart > 0, `${conditionnelle} est posée AVANT ${commande}, dont elle dépend`);
    assert.ok(
      ecart <= 2,
      `${ecart - 1} question(s) séparent ${commande} de ${conditionnelle} : on ne voit plus pourquoi elle est posée`
    );
  }
});

test("une question qui en REPREND une autre vient après elle", () => {
  const rang = (id: string) => QUESTIONS.findIndex((q) => q.id === id);
  for (const question of QUESTIONS) {
    if (!question.repriseDe) continue;
    assert.ok(
      rang(question.repriseDe) < rang(question.id),
      `${question.id} propose la réponse de ${question.repriseDe}, qui n'a pas encore été posée`
    );
  }
});

test("les chapitres ne s'entrecoupent pas", () => {
  // Un chapitre repris plus loin ferait reculer la jauge, qui compte un segment
  // par chapitre : on repasserait en arrière en avançant.
  const vus = new Set<string>();
  let precedent = "";
  for (const question of QUESTIONS) {
    if (question.chapitre === precedent) continue;
    assert.ok(!vus.has(question.chapitre), `le chapitre « ${question.chapitre} » revient après en être sorti`);
    vus.add(question.chapitre);
    precedent = question.chapitre;
  }
});

test("on ne demande jamais le capital d'une micro-entreprise", () => {
  const micro = questionsApplicables({ forme: "Micro-entreprise", tva: "franchise" }).map((x) => x.id);
  assert.ok(!micro.includes("capital"), "le capital est posé à une micro-entreprise");
  assert.ok(!micro.includes("rcs"), "le RCS est posé à une micro-entreprise");
  assert.ok(!micro.includes("numTva"), "le numéro de TVA est posé à une franchise");
  assert.equal(micro.length, 13);

  const societe = questionsApplicables({ forme: "SASU", tva: "assujettie" }).map((x) => x.id);
  assert.ok(societe.includes("capital") && societe.includes("rcs") && societe.includes("numTva"));
  assert.equal(societe.length, 16);
});

test("le total annoncé ne monte JAMAIS en cours de route", () => {
  // Avant d'avoir répondu, on compte tout ce qui POURRAIT se poser.
  const auDepart = totalAnnonce({});
  assert.equal(auDepart, 16);
  // Choisir une SAS ne doit pas faire grossir le compteur…
  assert.equal(totalAnnonce({ forme: "SASU", tva: "assujettie" }), 16);
  // …et choisir une micro-entreprise le fait DESCENDRE, ce qui est une bonne
  // nouvelle : c'est le sens interdit qui est l'unique.
  assert.ok(totalAnnonce({ forme: "EI", tva: "franchise" }) < auDepart);
  // Et il ne descend jamais sous ce qu'on va réellement poser.
  for (const reponses of [{}, { forme: "EI" }, { forme: "SASU" }, SOCIETE]) {
    assert.ok(
      totalAnnonce(reponses) >= questionsApplicables(reponses).length,
      `« x sur ${totalAnnonce(reponses)} » alors qu'on pose ${questionsApplicables(reponses).length} questions`
    );
  }
});

test("mot de passe : la règle du produit, jamais une seconde", () => {
  const court = "a".repeat(LONGUEUR_MINIMALE - 1);
  assert.ok(refusDe(q("mdp"), { mdp: court, confirm: court }), "un mot de passe trop court est accepté");
  const bon = "a".repeat(LONGUEUR_MINIMALE);
  assert.equal(refusDe(q("mdp"), { mdp: bon, confirm: bon }), null);
  assert.ok(refusDe(q("mdp"), { mdp: bon, confirm: `${bon}!` }), "deux saisies différentes sont acceptées");
});

test("l'identité dit LAQUELLE des trois cases manque", () => {
  assert.match(String(refusDe(q("identite"), {})), /Madame ou Monsieur/);
  assert.match(String(refusDe(q("identite"), { identite: "mme" })), /prénom/i);
  assert.match(String(refusDe(q("identite"), { identite: "mme", prenom: "Anne" })), /nom/i);
  assert.equal(refusDe(q("identite"), { identite: "mme", prenom: "Anne", nom: "Amiot" }), null);
});

test("un capital illisible se refuse à la question, pas en silence", () => {
  assert.equal(refusDe(q("capital"), { capital: "1 000" }), null);
  assert.equal(refusDe(q("capital"), { capital: "1000,50" }), null);
  // Vide : c'est permis, la question n'est pas obligatoire.
  assert.equal(refusDe(q("capital"), {}), null);
  assert.ok(refusDe(q("capital"), { capital: "mille euros" }), "un capital en lettres est accepté");
});

test("ce qu'on propose d'office est ce qui part en base", () => {
  const vues = reponsesProposees({ email: "anne@exemple.fr", entreprise: "Amiot Paysage" });
  assert.equal(vues.emailPro, "anne@exemple.fr");
  assert.equal(vues.titulaire, "Amiot Paysage");
  // Une case vidée à la main reste vide : c'est une réponse, pas une absence.
  const efface = reponsesProposees({ email: "anne@exemple.fr", emailPro: "" });
  assert.equal(efface.emailPro, "");
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
  assert.equal(
    phraseDeCeQuiManque(["a", "b", "c", "d"]),
    "Il manque a, b et c, et 1 autre."
  );
  assert.match(String(phraseDeCeQuiManque(["a", "b", "c", "d", "e"])), /2 autres\.$/);
});

test("une question obligatoire ne se passe jamais", () => {
  // « Passer » ne s'affiche que sur les questions facultatives : celles qui
  // sont obligatoires ne portent donc jamais de `reste` à réclamer plus tard.
  for (const question of QUESTIONS) {
    if (question.requis && question.id !== "forme" && question.id !== "tva") {
      assert.ok(!question.reste, `${question.id} est obligatoire ET réclamé à la fin`);
    }
  }
  assert.deepEqual(
    resteAFaire({ ...SOCIETE, forme: "", tva: "" }).filter((r) => r === "la forme juridique"),
    [],
    "une question obligatoire est réclamée à la fin"
  );
});

test("une liste de deux avance toute seule, les autres non", () => {
  assert.equal(avanceToutSeul(q("tva")), true);
  assert.equal(avanceToutSeul(q("identite")), false);
  assert.equal(avanceToutSeul(q("forme")), false);
});

test("l'espace insécable colle le « ? » à son dernier mot", () => {
  assert.equal(typographie("Facturez-vous la TVA ?"), "Facturez-vous la TVA ?");
  assert.equal(typographie("Choisissez un mot de passe"), "Choisissez un mot de passe");
  // Toutes les questions passent par là : aucune ne porte l'espace en dur.
  for (const question of QUESTIONS) {
    assert.ok(!question.question.includes(" "), `${question.id} écrit l'insécable à la main`);
  }
});

console.log(`\n${passed} réussis, ${failed} échoués`);
if (failed > 0) process.exit(1);
