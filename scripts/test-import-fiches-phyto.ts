import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CHAMPS_QUI_ENGAGENT,
  validerLot,
  PREFIXE_FIXTURE,
  comparerFicheSourceEtEnregistree,
  decrireEcart,
} from "../src/lib/import-fiches-phyto";
import { lirePolitique, echeanceDePurge, POLITIQUE_PAR_DEFAUT } from "../src/lib/retention-diagnostic";

/**
 * Les contrôles d'import, et la politique de conservation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUI EST ÉPROUVÉ ICI, C'EST LA CAPACITÉ À REFUSER.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *« Un contrôle doit savoir échouer. Le vérifier en le confrontant à l'état
 * dégradé qu'il prétend détecter. Un contrôle jamais vu rouge ne prouve
 * rien. »* (`CLAUDE.md` §5)
 *
 * Chaque refus est donc éprouvé **contre une fiche volontairement fautive**, et
 * chacun est vérifié séparément : un contrôle qui refuserait pour la mauvaise
 * raison enverrait corriger le mauvais champ.
 *
 * Le refus fondateur est le premier : **une fiche validée sans source**. Sans
 * lui, tout ce module n'est qu'une manière élaborée d'afficher des
 * affirmations sans origine.
 */

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

const SOURCE = {
  code: "src-essai",
  organisme: "Organisme d'essai",
  titre: "Document d'essai",
  nature: "technique",
  consulteeLe: "2026-08-20",
};

/** Une fiche valide, dont chaque cas ci-dessous ne casse QU'UNE chose. */
function ficheValide(p: Record<string, unknown> = {}) {
  return {
    code: "fiche-essai",
    nomCommun: "Fiche d'essai",
    categorie: "maladie",
    partiesAtteintes: ["feuille"],
    explicationCourte: "Donnée d'essai, sans portée réelle.",
    gravite: "faible",
    diagnosticPhoto: "possible",
    conduiteRecommandee: "Donnée d'essai, sans portée réelle.",
    niveauValidation: "validee",
    sourcesAJourLe: "2026-08-20",
    symptomes: [{ nature: "symptome", partie: "feuille", motif: "tache" }],
    sources: [{ source: "src-essai", champs: ["conduite_recommandee", "gravite"] }],
    ...p,
  };
}

function lot(p: Record<string, unknown> = {}) {
  return { version: "essai", sources: [SOURCE], taxons: [], fiches: [ficheValide()], ...p };
}

function refus(brut: unknown, motifAttendu: RegExp, options = { autoriserFixtures: false }) {
  const verdict = validerLot(brut, options);
  assert.equal(verdict.ok, false, "ce lot aurait dû être refusé");
  const messages = verdict.ok ? [] : verdict.problemes.map((p) => p.message);
  assert.ok(
    messages.some((m) => motifAttendu.test(m)),
    `aucun refus ne correspond à ${motifAttendu} — reçu : ${JSON.stringify(messages)}`
  );
}

console.log("\n=== Le témoin : un lot correct passe ===");

cas("le lot de référence est accepté — sinon les refus ci-dessous ne prouvent rien", () => {
  const verdict = validerLot(lot(), { autoriserFixtures: false });
  assert.equal(verdict.ok, true, verdict.ok ? "" : JSON.stringify(verdict.problemes));
});

console.log("\n=== Refus 1 : une fiche validée sans source ===");

cas("aucune source du tout", () => {
  refus(lot({ fiches: [ficheValide({ sources: [] })] }), /sans aucune source/);
});

cas("en revanche, un BROUILLON sans source entre — c'est ainsi qu'on le travaille", () => {
  const verdict = validerLot(
    lot({ fiches: [ficheValide({ niveauValidation: "brouillon", sources: [] })] }),
    { autoriserFixtures: false }
  );
  assert.equal(verdict.ok, true);
  assert.ok(verdict.ok && verdict.avertissements.some((a) => /aucune source/.test(a.message)));
});

console.log("\n=== Refus 2 : un champ qui engage sans source qui le couvre ===");

for (const champ of CHAMPS_QUI_ENGAGENT) {
  if (champ === "traitement" || champ === "statut_reglementaire") continue;
  cas(`« ${champ} » non rattaché à une source`, () => {
    const champsRestants = CHAMPS_QUI_ENGAGENT.filter((c) => c !== champ);
    refus(
      lot({ fiches: [ficheValide({ sources: [{ source: "src-essai", champs: champsRestants }] })] }),
      new RegExp(champ)
    );
  });
}

cas("un champ VIDE n'a rien à prouver — « aucun » n'est pas une affirmation", () => {
  const verdict = validerLot(lot(), { autoriserFixtures: false });
  assert.equal(verdict.ok, true, "traitement null et statut « aucun » ne réclament pas de source");
});

cas("mais un statut réglementaire DÉCLARÉ en réclame une", () => {
  refus(
    lot({ fiches: [ficheValide({ statutReglementaire: "quarantaine" })] }),
    /statut_reglementaire/
  );
});

console.log("\n=== Refus 3 : un traitement sans source qui l'autorise ===");

cas("un traitement appuyé par aucune source", () => {
  refus(lot({ fiches: [ficheValide({ traitement: "Un produit quelconque." })] }), /traitement/);
});

cas("un traitement appuyé par une source SCIENTIFIQUE seule ne suffit pas", () => {
  refus(
    {
      version: "essai",
      sources: [{ ...SOURCE, nature: "scientifique" }],
      taxons: [],
      fiches: [
        ficheValide({
          traitement: "Un produit quelconque.",
          sources: [
            { source: "src-essai", champs: ["conduite_recommandee", "gravite", "traitement"] },
          ],
        }),
      ],
    },
    /réglementaire, officielle ou technique/
  );
});

cas("appuyé par une source technique, il passe", () => {
  const verdict = validerLot(
    lot({
      fiches: [
        ficheValide({
          traitement: "Donnée d'essai.",
          sources: [
            { source: "src-essai", champs: ["conduite_recommandee", "gravite", "traitement"] },
          ],
        }),
      ],
    }),
    { autoriserFixtures: false }
  );
  assert.equal(verdict.ok, true, verdict.ok ? "" : JSON.stringify(verdict.problemes));
});

console.log("\n=== Refus 4 : un mot hors vocabulaire ===");

cas("un motif inventé est refusé — c'est le défaut le plus cher, parce qu'il est SILENCIEUX", () => {
  refus(
    lot({
      fiches: [
        ficheValide({ symptomes: [{ nature: "symptome", partie: "feuille", motif: "moisissure" }] }),
      ],
    }),
    /motif/
  );
});

cas("une partie inventée est refusée", () => {
  refus(
    lot({
      fiches: [ficheValide({ symptomes: [{ nature: "symptome", partie: "rameaux", motif: "tache" }] })],
    }),
    /partie/
  );
});

console.log("\n=== Refus 5 : une fixture qui se fait passer pour une vraie fiche ===");

cas("marquée fixture sans le préfixe : refusée", () => {
  refus(
    lot({ fiches: [ficheValide({ origine: "fixture_test" })] }),
    new RegExp(PREFIXE_FIXTURE),
    { autoriserFixtures: true }
  );
});

cas("préfixée mais se déclarant réelle : refusée AUSSI — l'équivalence va dans les deux sens", () => {
  refus(
    lot({ fiches: [ficheValide({ code: "zz-test-fiche", origine: "reelle" })] }),
    /se déclare réelle/,
    { autoriserFixtures: true }
  );
});

cas("une fixture correcte est refusée quand l'import ne les accepte pas", () => {
  refus(
    lot({ fiches: [ficheValide({ code: "zz-test-fiche", origine: "fixture_test" })] }),
    /fixture de test refusée/
  );
});

console.log("\n=== Refus 6 : une relance qui ne dit pas quoi photographier ===");

cas("une confusion avec photo mais sans partie : signalée", () => {
  const verdict = validerLot(
    lot({
      fiches: [
        ficheValide({
          confusions: [
            {
              fiche: "autre-fiche",
              critereDifferenciant: "un critère quelconque",
              photoQuiTranche: "Photographiez autre chose.",
            },
          ],
        }),
        ficheValide({ code: "autre-fiche" }),
      ],
    }),
    { autoriserFixtures: false }
  );
  assert.equal(verdict.ok, true);
  assert.ok(verdict.ok && verdict.avertissements.some((a) => /de quelle partie/.test(a.message)));
});

console.log("\n=== Refus 7 : une image sans origine, ou dont la licence est un aveu ===");

cas("une licence « à vérifier » est refusée — ce n'est pas une licence", () => {
  // `licence` est NOT NULL en base, mais rien n'empêchait d'y écrire n'importe
  // quoi : le champ obligatoire aurait servi à rassurer plutôt qu'à protéger.
  refus(
    lot({
      fiches: [
        ficheValide({
          images: [{ fichier: "donnees/phyto/images/x.jpg", licence: "à vérifier", credit: "Quelqu'un" }],
        }),
      ],
    }),
    /c’est un aveu/
  );
});

for (const aveu of ["licence inconnue", "droits ?", "à définir"]) {
  cas(`« ${aveu} » est refusé aussi`, () => {
    refus(
      lot({
        fiches: [
          ficheValide({ images: [{ fichier: "x/y.jpg", licence: aveu, credit: "Quelqu'un" }] }),
        ],
      }),
      /aveu/
    );
  });
}

for (const copyright of ["© GIRAUDEL Arnaud", "(c) Jean-Pierre Henry", "Tous droits réservés", "All rights reserved"]) {
  cas(`« ${copyright} » est refusé : c'est un copyright, pas une licence`, () => {
    // Le cas réel du 20 août : les figures d'Ephytia portent des crédits
    // nominatifs. Écrite dans `licence`, une telle mention passerait tous les
    // contrôles en affirmant précisément ce qui INTERDIT l'usage.
    refus(
      lot({
        fiches: [
          ficheValide({ images: [{ fichier: "x/y.jpg", licence: copyright, credit: "Quelqu'un" }] }),
        ],
      }),
      /mention de copyright, pas une licence/
    );
  });
}

cas("mais un « © » dans le CRÉDIT reste normal — c'est sa forme habituelle", () => {
  const verdict = validerLot(
    lot({
      fiches: [
        ficheValide({
          images: [{ fichier: "x/y.jpg", licence: "CC BY-SA 4.0", credit: "© Prénom Nom" }],
        }),
      ],
    }),
    { autoriserFixtures: false }
  );
  assert.equal(verdict.ok, true, verdict.ok ? "" : JSON.stringify(verdict.problemes));
});

cas("une image qui ne désigne ni fichier ni adresse est refusée", () => {
  refus(
    lot({ fiches: [ficheValide({ images: [{ licence: "CC-BY 4.0", credit: "Quelqu'un" }] })] }),
    /ne désigne rien/
  );
});

cas("une image en règle passe", () => {
  const verdict = validerLot(
    lot({
      fiches: [
        ficheValide({
          images: [
            {
              fichier: "donnees/phyto/images/x.jpg",
              licence: "CC BY-SA 4.0",
              credit: "Prénom Nom",
              legende: "Une légende",
            },
          ],
        }),
      ],
    }),
    { autoriserFixtures: false }
  );
  assert.equal(verdict.ok, true, verdict.ok ? "" : JSON.stringify(verdict.problemes));
});

console.log("\n=== Renvois et cohérence ===");

cas("une confusion vers une fiche qu’aucun lot ne déclare est refusée", () => {
  refus(
    lot({
      fiches: [
        ficheValide({
          confusions: [{ fiche: "fantome", critereDifferenciant: "un critère quelconque" }],
        }),
      ],
    }),
    /n’existe dans aucun lot/
  );
});

/**
 * **Les fiches qui se confondent vivent rarement dans le même fichier.**
 *
 * L'anthracnose du platane et celle du chêne donnent la même nécrose brune sur
 * une feuille ; elles ont été écrites à deux jours d'écart, à partir de deux
 * pages de source différentes, donc dans deux lots. Tant que le contrôle
 * n'admettait que les renvois internes à un fichier, déclarer cette confusion
 * était impossible — et sans confusion, pas de demande de photo complémentaire,
 * c'est-à-dire la moitié de ce que le module sait faire.
 */
cas("une confusion vers une fiche d’un AUTRE lot est admise", () => {
  const verdict = validerLot(
    lot({
      fiches: [
        ficheValide({
          confusions: [{ fiche: "fiche-de-lautre-lot", critereDifferenciant: "un critère quelconque" }],
        }),
      ],
    }),
    { autoriserFixtures: false, codesConnus: new Set(["fiche-de-lautre-lot"]) }
  );
  assert.equal(verdict.ok, true, verdict.ok ? "" : JSON.stringify(verdict.problemes));
});

cas("le renvoi hors lot reste refusé si AUCUN lot ne porte ce code", () => {
  const verdict = validerLot(
    lot({
      fiches: [
        ficheValide({
          confusions: [{ fiche: "fantome", critereDifferenciant: "un critère quelconque" }],
        }),
      ],
    }),
    { autoriserFixtures: false, codesConnus: new Set(["un-autre-code-encore"]) }
  );
  assert.equal(verdict.ok, false, "le contrôle a disparu au lieu de s’élargir");
});

cas("une fiche ne se confond pas avec elle-même", () => {
  refus(
    lot({
      fiches: [
        ficheValide({
          confusions: [{ fiche: "fiche-essai", critereDifferenciant: "un critère quelconque" }],
        }),
      ],
    }),
    /elle-même/
  );
});

cas("un hôte inconnu du lot est refusé", () => {
  refus(
    lot({ fiches: [ficheValide({ hotes: [{ taxon: "inconnu" }] })] }),
    /hôte « inconnu » inconnu/
  );
});

cas("une même fiche déclarée deux fois est refusée", () => {
  refus(lot({ fiches: [ficheValide(), ficheValide()] }), /deux fois/);
});

cas("une période incomplète est refusée — un début sans fin ne se lit pas", () => {
  refus(lot({ fiches: [ficheValide({ periodeDebutMois: 5 })] }), /période d’observation incomplète/);
});

cas("une fiche validée sans symptôme est refusée : elle ne sortirait jamais", () => {
  refus(lot({ fiches: [ficheValide({ symptomes: [] })] }), /sans aucun symptôme/);
});

console.log("\n=== Les fixtures livrées passent leurs propres contrôles ===");

cas("donnees/phyto/fixtures/moteur.json est valide", () => {
  const brut = JSON.parse(readFileSync("donnees/phyto/fixtures/moteur.json", "utf-8"));
  const verdict = validerLot(brut, { autoriserFixtures: true });
  assert.equal(verdict.ok, true, verdict.ok ? "" : JSON.stringify(verdict.problemes));
});

cas("et elles sont refusées par un import qui n'accepte pas les fixtures", () => {
  const brut = JSON.parse(readFileSync("donnees/phyto/fixtures/moteur.json", "utf-8"));
  const verdict = validerLot(brut, { autoriserFixtures: false });
  assert.equal(verdict.ok, false);
});

console.log("\n=== La comparaison champ par champ : « aucune perte d’information » ===");

// ═══════════════════════════════════════════════════════════════════════════
// **Sa consigne du 20 août 2026 :** *« vérifie qu'aucune information n'a été
// perdue, modifiée, déplacée ou interprétée différemment ; si une différence,
// une perte d'information ou une ambiguïté apparaît, bloque la validation et
// indique précisément l'écart. »*
//
// Chaque cas ci-dessous fabrique UNE altération et vérifie que le contrôle la
// nomme. C'est la seule manière de savoir qu'il sait échouer (`CLAUDE.md` §5) —
// et il l'a prouvé en vrai le jour de son écriture, en attrapant deux pertes
// que personne n'avait vues : le chemin des images, et l'ordre des listes
// (`ARCHITECTURE.md` §138).
// ═══════════════════════════════════════════════════════════════════════════

/** Une fiche valide, passée par le schéma — donc avec tous ses défauts posés. */
function ficheAnalysee(p: Record<string, unknown> = {}) {
  const verdict = validerLot(lot({ fiches: [ficheValide(p)] }), { autoriserFixtures: false });
  assert.equal(verdict.ok, true, verdict.ok ? "" : JSON.stringify(verdict.problemes));
  if (!verdict.ok) throw new Error("inatteignable");
  return verdict.lot.fiches[0];
}

function altere(modifier: (f: ReturnType<typeof ficheAnalysee>) => void) {
  const source = ficheAnalysee();
  const enregistree = JSON.parse(JSON.stringify(source)) as ReturnType<typeof ficheAnalysee>;
  modifier(enregistree);
  return comparerFicheSourceEtEnregistree(source, enregistree);
}

cas("identiques : aucun écart — sans quoi tout le reste ne prouverait rien", () => {
  assert.deepEqual(altere(() => {}), []);
});

cas("une valeur MODIFIÉE est nommée, avec le champ exact", () => {
  const ecarts = altere((f) => {
    f.gravite = "importante";
  });
  assert.equal(ecarts.length, 1);
  assert.equal(ecarts[0].champ, "gravite");
  assert.match(decrireEcart(ecarts[0]), /le fichier dit "faible".*a enregistré "importante"/);
});

cas("un texte TRONQUÉ est vu — c'est le défaut d'une colonne trop courte", () => {
  const ecarts = altere((f) => {
    f.conduiteRecommandee = f.conduiteRecommandee.slice(0, 12);
  });
  assert.equal(ecarts.length, 1);
  assert.equal(ecarts[0].champ, "conduiteRecommandee");
});

cas("un `null` devenu chaîne vide est un ÉCART, pas un détail", () => {
  // C'est le défaut silencieux par excellence : à l'écran, « rien » et « vide »
  // se ressemblent. En base, l'un dit « la source ne le dit pas » et l'autre
  // dit « la source dit : rien ». Ce n'est pas la même affirmation.
  const ecarts = altere((f) => {
    f.traitement = "";
  });
  assert.equal(ecarts.length, 1);
  assert.equal(ecarts[0].champ, "traitement");
});

cas("une ligne PERDUE dans une liste est comptée avant d'être détaillée", () => {
  const ecarts = altere((f) => {
    f.symptomes = [];
  });
  assert.equal(ecarts.length, 1);
  assert.equal(ecarts[0].champ, "symptomes.length");
  assert.equal(ecarts[0].attendu, 1);
  assert.equal(ecarts[0].trouve, 0);
});

cas("une ligne DÉPLACÉE est vue — sa consigne dit « déplacée », pas seulement « perdue »", () => {
  const source = ficheAnalysee({
    criteresDiscriminants: ["Le premier critère, celui qu’on lit d’abord.", "Le second critère."],
  });
  const permutee = JSON.parse(JSON.stringify(source)) as typeof source;
  permutee.criteresDiscriminants = [...source.criteresDiscriminants].reverse();
  const ecarts = comparerFicheSourceEtEnregistree(source, permutee);
  assert.equal(ecarts.length, 1);
  assert.equal(ecarts[0].champ, "criteresDiscriminants");
});

cas("une image DÉCLARÉE mais rangée nulle part est un écart", () => {
  // « Dérivé » ne veut pas dire « non vérifié » : une photo qui n'aurait pas
  // été rangée disparaîtrait de l'écran sans un mot.
  const source = ficheAnalysee({
    images: [{ fichier: "donnees/phyto/images/x.jpg", licence: "Domaine public", credit: "Essai" }],
  });
  const sansCle = JSON.parse(JSON.stringify(source)) as typeof source;
  sansCle.images[0].storageKey = null;
  const ecarts = comparerFicheSourceEtEnregistree(source, sansCle);
  assert.equal(ecarts.length, 1);
  assert.match(ecarts[0].champ, /images\[0\]\.storageKey/);
});

cas("la clé de stockage, elle, ne se compare PAS : elle est dérivée", () => {
  // Sinon le contrôle rougirait sur toutes les fiches à photo, à chaque import
  // — et un contrôle qui rougit toujours s'apprend à être ignoré.
  const source = ficheAnalysee({
    images: [{ fichier: "donnees/phyto/images/x.jpg", licence: "Domaine public", credit: "Essai" }],
  });
  const avecCle = JSON.parse(JSON.stringify(source)) as typeof source;
  avecCle.images[0].storageKey = "phyto/images/8f3c….jpg";
  assert.deepEqual(comparerFicheSourceEtEnregistree(source, avecCle), []);
});

cas("`niveauValidation` est hors comparaison : c'est CE contrôle qui l'accorde", () => {
  const source = ficheAnalysee();
  const promue = JSON.parse(JSON.stringify(source)) as typeof source;
  promue.niveauValidation = "en_revue";
  assert.deepEqual(comparerFicheSourceEtEnregistree(source, promue), []);
});

console.log("\n=== Le plafond de certitude ne peut pas contredire la source ===");

cas("une confirmation exigée AVEC une certitude « elevee » est refusée", () => {
  refus(
    lot({
      fiches: [
        ficheValide({
          methodeConfirmation: "La détection en laboratoire est nécessaire pour confirmer.",
          certitudeMax: "elevee",
        }),
      ],
    }),
    /autorise une certitude/
  );
});

cas("une information requise qui RÉPÈTE la méthode de confirmation est refusée", () => {
  // Défaut trouvé sur une capture, pas par un test : l'écran affichait la même
  // phrase deux fois de suite. Le contrôle existe pour que cela ne revienne pas.
  refus(
    lot({
      fiches: [
        ficheValide({
          methodeConfirmation: "La détection en laboratoire est nécessaire pour confirmer.",
          certitudeMax: "probable",
          informationsRequises: ["La détection en laboratoire est nécessaire pour confirmer."],
        }),
      ],
    }),
    /répète mot pour mot/
  );
});

cas("la même fiche, plafonnée à « probable », passe", () => {
  const verdict = validerLot(
    lot({
      fiches: [
        ficheValide({
          methodeConfirmation: "La détection en laboratoire est nécessaire pour confirmer.",
          certitudeMax: "probable",
        }),
      ],
    }),
    { autoriserFixtures: false }
  );
  assert.equal(verdict.ok, true, verdict.ok ? "" : JSON.stringify(verdict.problemes));
});

console.log("\n=== La conservation des photos : configurable, jamais gravée ===");

cas("les valeurs par défaut : 90 jours libre, jamais purgé si rattaché", () => {
  assert.equal(POLITIQUE_PAR_DEFAUT.libreJours, 90);
  assert.equal(POLITIQUE_PAR_DEFAUT.chantierJours, 0);
});

cas("une politique se lit depuis la configuration", () => {
  assert.deepEqual(lirePolitique({ libre: "30", chantier: "365" }), {
    libreJours: 30,
    chantierJours: 365,
  });
});

cas("une valeur ILLISIBLE retombe sur le défaut, jamais sur zéro", () => {
  // Zéro signifierait « ne jamais purger » — soit exactement le contraire de ce
  // que cherche quelqu'un qui règle cette variable.
  assert.equal(lirePolitique({ libre: "trois" }).libreJours, 90);
  assert.equal(lirePolitique({ libre: "-5" }).libreJours, 90);
  assert.equal(lirePolitique({ libre: "1.5" }).libreJours, 90);
  assert.equal(lirePolitique({ libre: "" }).libreJours, 90);
  assert.equal(lirePolitique({}).libreJours, 90);
});

cas("zéro EXPLICITE veut bien dire « ne pas purger »", () => {
  assert.equal(lirePolitique({ libre: "0" }).libreJours, 0);
  assert.equal(echeanceDePurge(new Date("2026-08-20"), false, { libreJours: 0, chantierJours: 0 }), null);
});

cas("l'échéance change selon que la photo est rattachée à un chantier", () => {
  const cree = new Date("2026-08-20T10:00:00Z");
  const politique = { libreJours: 90, chantierJours: 365 };
  const libre = echeanceDePurge(cree, false, politique);
  const rattachee = echeanceDePurge(cree, true, politique);
  assert.ok(libre && rattachee && rattachee > libre);
});

cas("par défaut, une photo rattachée à un chantier n'a AUCUNE échéance", () => {
  assert.equal(echeanceDePurge(new Date(), true), null);
  assert.notEqual(echeanceDePurge(new Date(), false), null);
});

console.log(
  echecs === 0 ? `\n✅ Toutes les vérifications passent.` : `\n❌ ${echecs} vérification(s) en échec.`
);
process.exit(echecs === 0 ? 0 : 1);
