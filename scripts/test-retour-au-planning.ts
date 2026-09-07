import assert from "node:assert/strict";
import {
  LIBELLE_RETOUR_PLANNING,
  PARAM_PROVENANCE,
  depuisLePlanning,
  provenanceDuPlanning,
  retourDepuisLePlanning,
} from "../src/lib/retour-au-planning";
import { lienVersLeChantierAuPlanning } from "../src/lib/lien-planning";
import { portesDuPlanning } from "../src/lib/portes-du-planning";
import {
  libelleRetourDesCoordonnees,
  provenanceDesCoordonnees,
  retourDesCoordonnees,
  apresLesCoordonnees,
  coordonneesDepuisLeDevis,
} from "../src/lib/retour-du-devis";

// **Revenir au planning quand on en vient** — son signalement du 7 septembre
// 2026 : *« quand je clique sur un client dans le planning et que je vais sur un
// des modules, lorsque je fais retour j'arrive sur la page d'accueil, or je
// devrais arriver d'où je suis parti. »*
//
// Ce que cette suite défend : les ADRESSES, jamais un libellé d'écran
// (`CLAUDE.md` §5 bis). Et elle part des portes réelles du planning plutôt que
// d'une adresse écrite à la main — sans quoi elle éprouverait la moitié qu'on
// vient d'écrire, et pas le chemin qu'il emprunte (§5 quater).

const AUJ = "2026-09-07";
const ID = "c1";
const PLANNING = lienVersLeChantierAuPlanning(ID);

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Ce que l'écran lit dans l'adresse d'une porte — comme Next.js le lui donne. */
function parametreDe(href: string): string | undefined {
  const q = href.indexOf("?");
  if (q === -1) return undefined;
  return new URLSearchParams(href.slice(q + 1)).get(PARAM_PROVENANCE) ?? undefined;
}

console.log("=== Revenir au planning quand on en vient ===");

// ── Les portes marquent bien d'où l'on part ─────────────────────────────────

cas("le devis parti, la facture et la fiche client savent d'où l'on vient", () => {
  const portes = portesDuPlanning(
    {
      id: ID,
      datePlanifiee: "2026-09-03",
      termineAt: "2026-09-03",
      factureEnvoyeeAt: null,
      envoiEnvoyeAt: "2026-09-01",
    },
    AUJ
  );
  assert.deepEqual(
    portes.map((p) => p.cle),
    ["facture", "devis", "client"]
  );
  for (const porte of portes) {
    assert.equal(
      provenanceDuPlanning(ID, parametreDe(porte.href)),
      PLANNING,
      `la porte « ${porte.libelle} » ne dit pas d'où l'on vient : ${porte.href}`
    );
  }
});

cas("le devis PAS ENCORE parti ne promet rien que son écran ne tienne", () => {
  // Sa flèche mène toujours à la fiche client — sa règle du 31 août 2026. Un
  // paramètre que personne ne relit ferait croire le cas traité.
  const devis = portesDuPlanning(
    { id: ID, datePlanifiee: "2026-09-11", termineAt: null, factureEnvoyeeAt: null },
    AUJ
  ).find((p) => p.cle === "devis")!;
  assert.equal(devis.href, `/chantiers/${ID}/devis-complet`);
});

cas("le chemin d'une porte reste celui d'avant : seule la question change", () => {
  const porte = portesDuPlanning(
    { id: ID, datePlanifiee: "2026-09-11", termineAt: null, factureEnvoyeeAt: null },
    AUJ
  ).find((p) => p.cle === "client")!;
  assert.equal(porte.href.split("?")[0], `/chantiers/${ID}/coordonnees`);
});

// ── La flèche revient au planning, et le repli ne bouge pas ─────────────────

const REPLI = { href: "/", libelle: "Retour à la liste des chantiers" };

cas("venu du planning, la flèche y ramène — sur la journée du chantier", () => {
  assert.deepEqual(retourDepuisLePlanning(ID, PLANNING, REPLI), {
    href: PLANNING,
    libelle: LIBELLE_RETOUR_PLANNING,
  });
});

cas("venu d'ailleurs, RIEN ne change — le repli de l'écran tient", () => {
  for (const de of [undefined, null, "", "/", "/termines"]) {
    assert.deepEqual(retourDepuisLePlanning(ID, de, REPLI), REPLI, `pour ${JSON.stringify(de)}`);
  }
});

cas("le planning d'UN AUTRE chantier ne vaut pas provenance", () => {
  assert.deepEqual(
    retourDepuisLePlanning(ID, lienVersLeChantierAuPlanning("un-autre"), REPLI),
    REPLI
  );
});

cas("une adresse étrangère ne fait pas de la flèche une porte de sortie", () => {
  // Cette valeur vient de l'adresse, donc de n'importe qui.
  for (const hostile of [
    "https://ailleurs.example",
    "//ailleurs.example",
    "javascript:alert(1)",
    `${PLANNING}&puis=https://ailleurs.example`,
    "/planning?chantier=c1&x=1",
  ]) {
    assert.deepEqual(retourDepuisLePlanning(ID, hostile, REPLI), REPLI, `pour ${hostile}`);
  }
});

cas("le premier des deux quand l'adresse en porte deux", () => {
  assert.equal(provenanceDuPlanning(ID, [PLANNING, "/ailleurs"]), PLANNING);
  assert.equal(provenanceDuPlanning(ID, ["/ailleurs", PLANNING]), null);
});

// ── La fiche client accepte les DEUX provenances ────────────────────────────

cas("la fiche client reconnaît le planning sans oublier le devis", () => {
  const devis = new URL(coordonneesDepuisLeDevis(ID), "https://x").searchParams.get(
    PARAM_PROVENANCE
  )!;
  assert.equal(provenanceDesCoordonnees(ID, devis), `/chantiers/${ID}/devis-complet`);
  assert.equal(provenanceDesCoordonnees(ID, PLANNING), PLANNING);
  assert.equal(provenanceDesCoordonnees(ID, "/ailleurs"), null);
});

cas("sa flèche ANNONCE la bonne destination, et non « le devis » pour tout", () => {
  assert.equal(libelleRetourDesCoordonnees(ID, PLANNING), LIBELLE_RETOUR_PLANNING);
  // **Venu du DEVIS, la flèche sort vers la liste — sa correction du
  // 7 septembre 2026 :** *« je refais retour arrière et je retourne sur le
  // devis et non sur la page chantier »*. Les deux flèches se pointaient l'une
  // l'autre. Le PLANNING, lui, ne ramène pas ici : il garde son retour.
  assert.equal(
    libelleRetourDesCoordonnees(ID, `/chantiers/${ID}/devis-complet`),
    "Retour à la liste des chantiers"
  );
  assert.equal(libelleRetourDesCoordonnees(ID, null), "Retour à la liste des chantiers");
});

cas("enregistrée depuis le planning, la fiche client y repart", () => {
  // Il est venu du planning pour remplir ce qui manquait : il y retourne, et
  // c'est la même règle que pour le devis depuis le 31 août.
  assert.equal(retourDesCoordonnees(ID, PLANNING), PLANNING);
  // Et la borne qui va avec : le devis, lui, ne se reçoit plus en retour.
  assert.equal(retourDesCoordonnees(ID, `/chantiers/${ID}/devis-complet`), "/");
  assert.equal(apresLesCoordonnees(ID, PLANNING), PLANNING);
  assert.equal(apresLesCoordonnees(ID, null), "/");
});

// ── Le contrôle sait-il rougir ? ────────────────────────────────────────────

cas("il rougirait contre la version d'avant", () => {
  // La version d'avant : une adresse sans provenance, et une flèche en dur.
  // Si ce contrôle passait quand même, il ne prouverait rien.
  assert.equal(provenanceDuPlanning(ID, parametreDe(`/chantiers/${ID}/export`)), null);
  assert.deepEqual(retourDepuisLePlanning(ID, undefined, REPLI), REPLI);
  assert.notEqual(depuisLePlanning(`/chantiers/${ID}/export`, ID), `/chantiers/${ID}/export`);
});

console.log(echecs === 0 ? "\n✅ Revenir au planning" : `\n❌ ${echecs} cas`);
process.exit(echecs === 0 ? 0 : 1);
