import assert from "node:assert/strict";
import {
  conclusionProposee,
  contenuDeLAttestation,
  courrielDeLAttestation,
  lireLaSaisie,
  texteDeLaCarte,
  texteDuTampon,
  type LigneAttestee,
} from "../src/lib/attestation-comptable";

// ═══════════════════════════════════════════════════════════════════════════
// L'ATTESTATION DU COMPTABLE — la règle pure (sa planche du 27 octobre 2026)
// ═══════════════════════════════════════════════════════════════════════════
//
// Ce que la suite défend :
//   · la saisie du comptable se relit au serveur, et chaque refus se dit ;
//   · les comptes de l'attestation se font sur les verdicts, pas sur l'écran ;
//   · le courriel ne transporte rien du dossier : ni ligne, ni montant ;
//   · aucune phrase ne devine le genre du signataire.

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

const SIGNATAIRE = {
  nom: "  Claire   Bernard ",
  fonction: "expert_comptable",
  societe: "Cabinet Bernard & Associés",
  ordre: "14-0087654",
  siren: "812345678",
  adresse: "14 rue du Commerce, 49100 Angers",
  email: "claire@cabinet-bernard.fr",
  telephone: "02 41 00 00 00",
};

test("une saisie complète se relit, propre", () => {
  const r = lireLaSaisie({ conclusion: "reserves", observations: "  Bon   dossier.  ", signataire: SIGNATAIRE });
  assert.ok(r.ok);
  assert.equal(r.valeur.signataire.nom, "Claire Bernard");
  assert.equal(r.valeur.signataire.siren, "812 345 678");
  assert.equal(r.valeur.observations, "Bon dossier.");
});

test("chaque manque se dit en mots", () => {
  const sans = (cle: string, v: unknown) => lireLaSaisie({ conclusion: "conforme", observations: null, signataire: { ...SIGNATAIRE, [cle]: v } });
  assert.deepEqual(sans("nom", " "), { ok: false, raison: "Votre nom manque." });
  assert.deepEqual(sans("societe", ""), { ok: false, raison: "La dénomination sociale manque." });
  assert.deepEqual(sans("email", "claire@"), { ok: false, raison: "Cette adresse e-mail n'est pas lisible." });
  assert.deepEqual(sans("siren", "8123"), { ok: false, raison: "Le SIREN compte neuf chiffres." });
  assert.deepEqual(sans("fonction", "patron"), { ok: false, raison: "Choisissez votre fonction." });
  assert.deepEqual(lireLaSaisie({ conclusion: "parfait", observations: null, signataire: SIGNATAIRE }), { ok: false, raison: "Choisissez une conclusion." });
});

test("un numéro d'Ordre ne s'imprime que sous Expert-comptable", () => {
  const r = lireLaSaisie({ conclusion: "conforme", observations: null, signataire: { ...SIGNATAIRE, fonction: "comptable" } });
  assert.ok(r.ok);
  assert.equal(r.valeur.signataire.ordre, null);
});

test("Atlas propose des réserves dès un rejet, jamais « non conforme »", () => {
  assert.equal(conclusionProposee(0), "conforme");
  assert.equal(conclusionProposee(1), "reserves");
  assert.equal(conclusionProposee(40), "reserves");
});

const LIGNES: LigneAttestee[] = [
  { jour: "2026-10-01", libelle: "VIR INST WERO", montant: "40.00", sens: "sortie", verdict: "valide", note: null },
  { jour: "2026-10-05", libelle: "PRLV SEPA TOTALENERGIES", montant: "9.28", sens: "sortie", verdict: "rejete", note: "Contrat du domicile." },
  { jour: "2026-10-20", libelle: "VIR SCI DU PARC", montant: "2940.00", sens: "entree", verdict: "valide", note: null },
];

test("les comptes se font sur les verdicts, et les rejets s'écrivent avec leur raison", () => {
  const lu = lireLaSaisie({ conclusion: "reserves", observations: null, signataire: SIGNATAIRE });
  assert.ok(lu.ok);
  const c = contenuDeLAttestation({
    entreprise: "Atelier Démo",
    du: "2026-01-01",
    au: "2026-10-27",
    conclusion: "reserves",
    observations: null,
    lignes: LIGNES,
    signataire: lu.valeur.signataire,
    signeLe: "2026-10-27",
    empreinteDuDossier: "9f3c21ab7d40e8b55a1c03fe6b92d7a4".repeat(2),
  });
  assert.deepEqual(c.comptes, { lignes: 3, validees: 2, rejetees: 1 });
  assert.equal(c.motConclusion, "Conforme avec réserves");
  assert.equal(c.rejets.length, 1);
  assert.equal(c.rejets[0].jour, "05/10");
  assert.equal(c.rejets[0].note, "Contrat du domicile.");
  assert.match(c.rejets[0].montant, /^−9,28/);
  assert.equal(c.phrase, "J’atteste avoir contrôlé les 3 lignes de ce dossier et leurs justificatifs, tels que présentés dans Atlas.");
  assert.deepEqual(c.signataire.slice(0, 2), ["Claire Bernard", "Expert-comptable, Ordre n° 14-0087654"]);
  assert.equal(c.fait, "Fait le 27 octobre 2026");
  assert.ok(c.empreinte.startsWith("Empreinte du dossier 9f3c21ab 7d40e8b5"));
});

test("une seule ligne ne s'écrit pas « les 1 lignes »", () => {
  const lu = lireLaSaisie({ conclusion: "conforme", observations: null, signataire: SIGNATAIRE });
  assert.ok(lu.ok);
  const c = contenuDeLAttestation({ entreprise: "A", du: "2026-01-01", au: "2026-01-31", conclusion: "conforme", observations: null, lignes: [LIGNES[0]], signataire: lu.valeur.signataire, signeLe: "2026-02-01", empreinteDuDossier: "a".repeat(64) });
  assert.match(c.phrase, /^J’atteste avoir contrôlé la ligne de ce dossier/);
  assert.equal(texteDeLaCarte({ nom: "Claire Bernard", lignes: 1, rejetees: 0 }), "Claire Bernard a vérifié la ligne du dossier.");
});

test("aucune phrase ne devine le genre du signataire", () => {
  const lu = lireLaSaisie({ conclusion: "conforme", observations: null, signataire: SIGNATAIRE });
  assert.ok(lu.ok);
  const c = contenuDeLAttestation({ entreprise: "A", du: "2026-01-01", au: "2026-01-31", conclusion: "conforme", observations: null, lignes: LIGNES, signataire: lu.valeur.signataire, signeLe: "2026-02-01", empreinteDuDossier: "a".repeat(64) });
  const tout = [c.phrase, ...c.signataire, c.fait, c.pied].join(" ");
  assert.doesNotMatch(tout, /soussign|inscrite?\b|\bMme\b|\bM\./);
});

test("le courriel ne transporte rien du dossier", () => {
  const m = courrielDeLAttestation({ nom: "Claire Bernard", societe: "Cabinet Bernard", du: "2026-01-01", au: "2026-10-27", conclusion: "reserves" });
  assert.equal(m.objet, "Votre dossier est vérifié : conforme avec réserves");
  for (const l of LIGNES) {
    assert.ok(!m.texte.includes(l.libelle), `le libellé « ${l.libelle} » est parti dans le courriel`);
  }
  assert.doesNotMatch(m.texte, /€|\d+,\d\d/);
});

test("le tampon : le cabinet en haut, la conclusion au centre, la date en bas", () => {
  assert.deepEqual(texteDuTampon("reserves", "Cabinet Bernard", "2026-10-27"), { haut: "CABINET BERNARD", centre: ["CONFORME", "AVEC RÉSERVES"], bas: "LE 27 OCTOBRE 2026" });
  assert.deepEqual(texteDuTampon("non_conforme", "X", "2026-01-01").centre, ["NON", "CONFORME"]);
  assert.equal(texteDuTampon("conforme", "X", "2026-01-01").bas, "LE 1ER JANVIER 2026");
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
