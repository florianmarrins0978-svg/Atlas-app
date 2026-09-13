import assert from "node:assert/strict";
import { creerSonCompte, type SaisieCompte } from "../src/server/repositories/creation-compte";
import { FORMES_JURIDIQUES } from "../src/lib/formes-juridiques";
import { phraseDeLaPanne } from "../src/lib/panne-de-base";

/**
 * AUCUNE FAÇON DE REMPLIR LA PORTE NE DOIT FAIRE TOMBER L'APPLICATION.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **D'où vient cette suite — 13 septembre 2026, et elle a servi le jour même.**
 *
 * Sa plainte : *« je peux toujours pas créer de compte »*. Le premier parcours
 * joué pour la reproduire prenait le chemin le plus LISSE — toutes les cases
 * remplies, des valeurs propres —, et il passait. Le sien ne l'est pas
 * forcément : il passe des questions, il tape « 1 000 € », il colle un IBAN
 * avec ses espaces, il choisit une forme juridique qu'aucun essai n'avait
 * ouverte.
 *
 * **En balayant ces façons-là, un vrai défaut est sorti** : un capital de
 * quinze chiffres passait la règle sans un mot et PostgreSQL refusait la ligne
 * (`22003`, hors bornes de `numeric(12,2)`) — donc la création du compte
 * ENTIÈRE, pour une case facultative. Corrigé à la racine : la borne de la
 * colonne vit désormais dans `capitalEnBase`, qui décide pour l'écran comme
 * pour l'écriture.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUE CETTE SUITE EXIGE, ET POURQUOI CE N'EST PAS « ÇA NE LÈVE PAS ».**
 *
 * Depuis que `creerSonCompte` attrape les pannes de base, une saisie qui fait
 * tomber l'écriture ne lève plus : elle rend un refus. Un contrôle qui se
 * contenterait de « rien n'a levé » serait donc devenu vert le jour même où il
 * cessait de mesurer. On exige que le refus rendu soit un refus MÉTIER — un
 * mot de passe trop court, une adresse déjà prise —, jamais la phrase d'une
 * panne de base.
 */

const BASE: SaisieCompte = {
  civilite: "mr",
  prenom: "Florian",
  nom: "Marrins",
  email: "",
  motDePasse: "MotDePasseSolide12",
  entreprise: "Eden Nature",
  forme: "SASU",
  tva: "assujettie",
};

type Variante = { nom: string; saisie: Partial<SaisieCompte> };

const VARIANTES: Variante[] = [
  { nom: "tout passé, rien que l'obligatoire", saisie: {} },
  { nom: "madame", saisie: { civilite: "mme" } },
  { nom: "franchise de TVA", saisie: { tva: "franchise" } },
  { nom: "franchise, et un numéro de TVA quand même", saisie: { tva: "franchise", numeroTva: "FR123" } },
  { nom: "capital avec l'espace des milliers", saisie: { capital: "1 000" } },
  { nom: "capital collé du presse-papiers, insécable et €", saisie: { capital: "10 000 €" } },
  { nom: "capital en lettres", saisie: { capital: "mille euros" } },
  { nom: "capital négatif", saisie: { capital: "-5" } },
  { nom: "CAPITAL PLUS GRAND QUE LA COLONNE", saisie: { capital: "999999999999999" } },
  { nom: "capital à la virgule", saisie: { capital: "1500,50" } },
  { nom: "SIRET avec ses espaces", saisie: { siret: "123 456 789 01234" } },
  { nom: "IBAN collé avec ses espaces", saisie: { iban: "FR76 3000 1007 9412 3456 7890 185" } },
  { nom: "téléphone écrit à sa façon", saisie: { telephone: "06 12 34 56 78" } },
  { nom: "adresse très longue", saisie: { adresse: "3 rue des Tilleuls ".repeat(40) } },
  { nom: "nom d'entreprise très long", saisie: { entreprise: "Eden Nature ".repeat(60) } },
  { nom: "prénom très long", saisie: { prenom: "Florian".repeat(80) } },
  { nom: "moyens de paiement très longs", saisie: { moyens: "Virement, chèque, espèces, ".repeat(90) } },
  { nom: "accents et apostrophes", saisie: { entreprise: "L’Élagueur & Fils — Été", nom: "Dupré-Lévêque" } },
  { nom: "émoji dans le nom d'entreprise", saisie: { entreprise: "Eden Nature 🌿" } },
  { nom: "titulaire du compte très long", saisie: { titulaire: "Eden Nature ".repeat(60) } },
  { nom: "numéro de TVA très long", saisie: { numeroTva: "FR" + "1".repeat(300) } },
  { nom: "ville de RCS très longue", saisie: { rcs: "Versailles ".repeat(60) } },
  { nom: "capital et RCS sur une forme qui n'en a pas", saisie: { forme: "EI", capital: "1000", rcs: "Versailles" } },
  { nom: "forme laissée vide", saisie: { forme: "" } },
  { nom: "forme qu'aucune liste ne porte", saisie: { forme: "SARL à capital variable" } },
  { nom: "mot de passe accentué", saisie: { motDePasse: "Chêne-Tilleul-08é" } },
  { nom: "des espaces autour de tout", saisie: { entreprise: "  Eden Nature  ", prenom: "  Florian  ", siret: "  123  " } },
];

// **Toutes ses formes juridiques, une par une** : c'est le déroulant qu'il
// ouvre, et rien ne dit qu'il choisit celle des essais. Chacune décide si le
// capital et le RCS s'écrivent — donc chacune est un chemin différent.
for (const f of FORMES_JURIDIQUES) {
  VARIANTES.push({ nom: `forme ${f.sigle}`, saisie: { forme: f.sigle, capital: "1000", rcs: "Versailles" } });
}

/** Les phrases que rend une panne de base : aucune ne doit sortir d'ici. */
const PHRASES_DE_PANNE = [
  phraseDeLaPanne("decalage-code-base", true),
  phraseDeLaPanne("decalage-code-base", false),
  phraseDeLaPanne("inconnue", true),
  phraseDeLaPanne("inconnue", false),
].map((p) => p.replace(/\s*\(base : .*\)$/, ""));

let echecs = 0;

async function main() {
  console.log("=== Aucune saisie de la porte ne fait tomber l'application ===\n");

  for (const [rang, v] of VARIANTES.entries()) {
    const saisie: SaisieCompte = {
      ...BASE,
      ...v.saisie,
      email: `porte-${rang}-${Date.now()}@exemple.fr`,
    };
    try {
      const r = await creerSonCompte(saisie);
      if (!r.ok) {
        const panne = PHRASES_DE_PANNE.some((p) => r.refus.startsWith(p));
        assert.ok(
          !panne,
          `« ${v.nom} » fait tomber l'écriture : ${r.refus}`
        );
      }
      console.log(`  ✓ ${v.nom}`);
    } catch (e) {
      echecs += 1;
      console.error(`  ✗ ${v.nom}\n    ${(e as Error).message.split("\n")[0]}`);
    }
  }

  // Un contrôle qui ne mesure rien n'est pas un contrôle (`CLAUDE.md` §5) :
  // sans variante jouée, on ne conclut pas.
  assert.ok(VARIANTES.length > 20, "la liste des façons de remplir s'est vidée");

  console.log(`\n${VARIANTES.length} façons de remplir la porte — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main();
