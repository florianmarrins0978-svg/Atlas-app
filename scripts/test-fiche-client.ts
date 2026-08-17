import assert from "node:assert/strict";
import {
  composerFicheClient,
  familleDePrestation,
  type ChantierDuClient,
  type LigneDuClient,
} from "../src/lib/fiche-client";

// Ce que l'application sait d'un client : que ça tombe juste, et que rien ne
// s'invente.
//
// **Le chiffre le plus dangereux de cette fiche est « 0 € ».** Un client dont
// aucun chantier n'est encore facturé n'a pas rapporté zéro euro — il n'a pas
// encore été facturé. Affiché « 0 € », il se lit comme un mauvais client, et le
// patron déciderait sur une phrase fausse. C'est la règle du dépôt : un champ
// sans source fiable reste VIDE et signalé (`CLAUDE.md` §4).
//
// **Le second piège est le compte des prestations.** Un devis qui porte
// « Élagage chêne » et « Élagage frêne » ne fait pas deux visites. Compter les
// lignes au lieu des chantiers annoncerait « 2 fois » sur un seul passage — et
// une fiche qui se trompe là-dessus fait douter de ses montants.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const ch = (
  id: string,
  nom: string,
  jour: string | null,
  totalTtc: string | null = null,
  reste: string | null = null
): ChantierDuClient => ({ id, nom, jour, totalTtc, reste });

const li = (chantierId: string, libelle: string, montant: string): LigneDuClient => ({
  chantierId,
  libelle,
  montant,
});

console.log("=== Ce que je sais du client ===\n");

// ── Les chiffres de la maquette 66, aux mêmes valeurs ───────────────────────

const QUATRE = [
  ch("1", "Élagage — 3 chênes", "2026-08-16", "887.40", "0.00"),
  ch("2", "Taille de haie", "2026-06-02", "740.00", "740.00"),
  ch("3", "Abattage tilleul", "2026-03-14", "980.00", "0.00"),
  ch("4", "Élagage d'entretien", "2026-01-09", "592.60", "0.00"),
];

cas("les trois chiffres de la fiche tombent juste", () => {
  const f = composerFicheClient(QUATRE, []);
  assert.equal(f.chantiers, 4);
  assert.equal(f.facture, "3200.00", "887,40 + 740 + 980 + 592,60 = 3 200,00");
  assert.equal(f.du, "740.00", "un seul chantier est impayé");
});

cas("le plus récent se lit en premier", () => {
  const f = composerFicheClient(QUATRE, []);
  assert.deepEqual(
    f.liste.map((c) => c.jour),
    ["2026-08-16", "2026-06-02", "2026-03-14", "2026-01-09"],
    "c'est du dernier chantier qu'il se souvient"
  );
});

// ── Ce qui n'a pas de source reste VIDE ─────────────────────────────────────

cas("un client jamais facturé n'affiche pas « 0 € »", () => {
  const f = composerFicheClient([ch("1", "Devis en cours", "2026-08-16")], []);
  assert.equal(f.chantiers, 1);
  assert.equal(f.facture, null, "« 0 € » se lirait comme un mauvais client");
  assert.equal(f.du, null);
});

cas("un client tout neuf ne dit rien plutôt que de dire zéro", () => {
  const f = composerFicheClient([], []);
  assert.equal(f.chantiers, 0);
  assert.equal(f.facture, null);
  assert.equal(f.du, null);
  assert.deepEqual(f.prestations, []);
  assert.deepEqual(f.liste, []);
});

cas("un seul chantier facturé sur quatre suffit à donner un total", () => {
  const f = composerFicheClient(
    [ch("1", "Fait", "2026-08-16", "600.00", "600.00"), ch("2", "En cours", "2026-08-10")],
    []
  );
  assert.equal(f.facture, "600.00", "seul ce qui est facturé compte");
  assert.equal(f.du, "600.00");
});

// ── Les prestations qui reviennent ──────────────────────────────────────────

cas("« Élagage — 3 chênes » et « Élagage d'entretien » sont le même élagage", () => {
  assert.equal(familleDePrestation("Élagage — 3 chênes"), "Élagage");
  assert.equal(familleDePrestation("Élagage d'entretien"), "Élagage d'entretien");
  assert.equal(familleDePrestation("Taille de haie : 12 m"), "Taille de haie");
  assert.equal(familleDePrestation("Broyage, sur place"), "Broyage");
});

cas("la casse et les accents ne font pas deux familles", () => {
  const f = composerFicheClient(QUATRE, [
    li("1", "Élagage — 3 chênes", "450.00"),
    li("3", "elagage — tilleul", "500.00"),
  ]);
  assert.equal(f.prestations.length, 1, `deux familles au lieu d'une : ${JSON.stringify(f.prestations)}`);
  assert.equal(f.prestations[0].fois, 2);
});

// **Le piège du compte.** Deux lignes sur UN chantier ne font pas deux visites.
cas("les prestations se comptent en CHANTIERS, pas en lignes", () => {
  const f = composerFicheClient([ch("1", "Un seul passage", "2026-08-16", "830.00", "0.00")], [
    li("1", "Élagage — chêne", "450.00"),
    li("1", "Élagage — frêne", "380.00"),
  ]);
  assert.equal(f.prestations.length, 1);
  assert.equal(f.prestations[0].fois, 1, "un seul chantier, donc une seule fois");
  assert.equal(f.prestations[0].prixMoyen, "415.00", "la moyenne se fait sur les LIGNES : (450 + 380) ÷ 2");
});

// **Ce que la règle NE fait PAS, écrit pour que ce soit un choix et non un
// hasard.** Sans séparateur, « Élagage chêne » et « Élagage frêne » restent deux
// prestations. Les regrouper demanderait de deviner que le premier mot porte le
// métier — c'est le travail de `signatureLecon`, qui le fait déjà pour les prix.
// Le refaire ici en moins bien créerait deux vérités sur le même sujet.
cas("sans séparateur, deux libellés proches restent distincts — et c'est voulu", () => {
  const f = composerFicheClient([ch("1", "Un passage", "2026-08-16", "830.00", "0.00")], [
    li("1", "Élagage chêne", "450.00"),
    li("1", "Élagage frêne", "380.00"),
  ]);
  assert.equal(f.prestations.length, 2, "le jour où l'on voudra les regrouper, ce sera par signatureLecon");
  assert.equal(f.prestations[0].fois, 1);
});

cas("le prix moyen est celui pratiqué chez CE client", () => {
  const f = composerFicheClient(QUATRE, [
    li("1", "Élagage — 3 chênes", "450.00"),
    li("3", "Élagage — tilleul", "550.00"),
  ]);
  assert.equal(f.prestations[0].prixMoyen, "500.00", "(450 + 550) ÷ 2");
});

cas("les plus fréquentes se lisent en premier", () => {
  const f = composerFicheClient(QUATRE, [
    li("1", "Évacuation des déchets verts", "240.00"),
    li("2", "Évacuation des déchets verts", "240.00"),
    li("3", "Évacuation des déchets verts", "240.00"),
    li("1", "Broyage des branches", "180.00"),
  ]);
  assert.equal(f.prestations[0].libelle, "Évacuation des déchets verts");
  assert.equal(f.prestations[0].fois, 3);
  assert.equal(f.prestations[1].libelle, "Broyage des branches");
});

cas("une ligne vide n'est pas une prestation", () => {
  // Le devis en porte : « + Ajouter une ligne » en crée une avant qu'on écrive.
  const f = composerFicheClient(QUATRE, [li("1", "", "0.00"), li("1", "   ", "0.00")]);
  assert.deepEqual(f.prestations, [], "des lignes vides ne racontent rien");
});

// ── L'arithmétique, à l'euro près ───────────────────────────────────────────

cas("les centimes ne se perdent pas en route", () => {
  const f = composerFicheClient(
    [
      ch("1", "A", "2026-08-01", "0.10", "0.10"),
      ch("2", "B", "2026-08-02", "0.20", "0.00"),
    ],
    []
  );
  assert.equal(f.facture, "0.30", "0,1 + 0,2 vaut 0,30 et non 0,30000000000000004");
  assert.equal(f.du, "0.10");
});

cas("ce qui reste dû ne dépasse jamais ce qui a été facturé", () => {
  const f = composerFicheClient(QUATRE, []);
  assert.ok(Number(f.du) <= Number(f.facture), `${f.du} € dus pour ${f.facture} € facturés`);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
