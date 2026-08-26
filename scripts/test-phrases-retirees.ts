import assert from "node:assert";
import { readFileSync } from "node:fs";

/**
 * LES PHRASES QU'IL A FAIT RETIRER NE REVIENNENT PAS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI UNE SEULE SUITE POUR TOUTES, ET NON UNE PAR PHRASE.**
 *
 * Il en a fait retirer deux en deux jours, et il en fera retirer d'autres : un
 * fichier de contrôle par phrase finirait en vingt fichiers qui disent la même
 * chose. Ici, une ligne par retrait — sa demande, la date, le fichier — et le
 * tableau est la documentation.
 *
 * **UN RETRAIT NE SE VÉRIFIE QUE PAR L'ABSENCE.** Sans cela, la phrase revient
 * au premier rebasage sans que rien ne rougisse. C'est arrivé deux fois dans ce
 * dépôt (`CLAUDE.md` §5 bis), et c'est d'autant plus vicieux qu'un retour de
 * phrase ne casse rien : tout reste vert, et c'est LUI qui le revoit à l'écran.
 *
 * **POURQUOI ON LIT LA SOURCE, ET NON L'ÉCRAN.** Certains de ces états sont hors
 * de portée des suites navigateur — l'accueil VIDE, par exemple, alors que le
 * compte de démonstration porte toujours des chantiers. Une suite qui
 * « vérifierait » l'absence sur un accueil plein serait verte sans avoir rien
 * mesuré, et rassurerait à tort (`CLAUDE.md` §5). Lire le fichier est grossier,
 * et c'est plus honnête qu'un vert qui ne prouve rien.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **Sait échouer** : remettre l'une des phrases fait tomber sa ligne en la
 * citant, avec le fichier et la date de sa demande.
 */

type Retrait = {
  /** Ce qu'il a dit, à la lettre. */
  demande: string;
  quand: string;
  fichier: string;
  /**
   * Ce qu'on cherche. Les apostrophes s'écrivent `&apos;` en JSX : le motif
   * accepte les deux formes, sans quoi le contrôle passerait à côté du retour
   * exact de la phrase.
   */
  motif: RegExp;
  /** Pour qu'un rouge dise DE QUELLE phrase il parle. */
  phrase: string;
};

const RETRAITS: Retrait[] = [
  {
    demande: "supprime la phrase « aucun chantier pour l'instant »",
    quand: "25 août 2026",
    fichier: "src/app/EcranChantiers.tsx",
    motif: /Aucun chantier pour l(?:&apos;|')instant/,
    phrase: "Aucun chantier pour l'instant. Créez votre premier chantier pour commencer.",
  },
  {
    demande: "supprime la phrase en gris « tout s'enregistre au fur et à mesure »",
    quand: "25 août 2026",
    fichier: "src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx",
    motif: /s(?:&apos;|')enregistre au fur et à mesure/,
    phrase: "Tout s'enregistre au fur et à mesure. Rien ne part avant que vous ne le décidiez.",
  },
];

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

console.log("=== Les phrases qu'il a fait retirer ne reviennent pas ===\n");

for (const r of RETRAITS) {
  essai(`« ${r.phrase.slice(0, 46)}… » (${r.quand})`, () => {
    const source = readFileSync(r.fichier, "utf8");
    const trouve = source.match(r.motif);
    assert.equal(
      trouve,
      null,
      `elle est revenue dans ${r.fichier}.\n` +
        `      Sa demande du ${r.quand} : « ${r.demande} »`
    );
  });
}

console.log("");

// ─── CE QUI DOIT RESTER, et c'est la moitié qui compte ──────────────────────
//
// Retirer la phrase de l'accueil ET les bandeaux laisserait un écran mort là où
// il y a une action à faire : les bandeaux portent les réponses de ses clients
// — un devis accepté, une autre date proposée — et elles arrivent justement
// quand plus aucun chantier n'est en cours.
essai("les bandeaux restent affichés sur un accueil vide", () => {
  const source = readFileSync("src/app/EcranChantiers.tsx", "utf8");
  const depuis = source.indexOf("restants.length === 0 ?");
  assert.ok(depuis > 0, "la branche « liste vide » a disparu de l'accueil");
  const branche = source.slice(depuis, source.indexOf(") : (", depuis));
  assert.ok(
    branche.includes("{bandeaux}"),
    "la branche « liste vide » ne rend plus les bandeaux : les réponses des clients seraient perdues"
  );
});

// L'aperçu du PDF vivait juste au-dessus de la phrase retirée : c'est le seul
// chemin vers le document depuis cet écran, et il ne doit pas partir avec elle.
essai("« Aperçu du PDF » reste sur l'écran du devis", () => {
  const source = readFileSync("src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx", "utf8");
  assert.ok(source.includes("Aperçu du PDF"), "le lien vers le PDF est parti avec la phrase");
});

console.log("");
if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("Phrases retirées — 0 échec(s).");
