import assert from "node:assert/strict";
import { portesDuPlanning } from "../src/lib/portes-du-planning";

// **Les portes d'un chantier, vues du planning.**
//
// Sa décision du 1er septembre 2026 : la fiche du chantier disparaît, et ce
// qu'elle portait va sur les chantiers du planning. Son choix d'allure du
// 4 septembre : la C — le chevron fait monter une feuille.
//
// Ce que cette suite défend, et qui ne dépend d'aucun libellé d'écran : QUELLES
// portes existent, et laquelle attend un geste. Une suite qui lirait le texte de
// la feuille mourrait au premier mot qu'il fait retirer (`CLAUDE.md` §5 bis).

const AUJ = "2026-09-04";
const BASE = { id: "c1", termineAt: null, factureEnvoyeeAt: null };

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

const cles = (c: Parameters<typeof portesDuPlanning>[0]) =>
  portesDuPlanning(c, AUJ).map((p) => p.cle);
const geste = (c: Parameters<typeof portesDuPlanning>[0]) =>
  portesDuPlanning(c, AUJ).find((p) => p.geste)?.libelle ?? null;

console.log("=== Les portes du planning ===");

cas("un chantier à venir n'offre pas de facture", () => {
  assert.deepEqual(cles({ ...BASE, datePlanifiee: "2026-09-11" }), ["devis", "client"]);
});

cas("aujourd'hui compte encore comme à venir — la journée n'est pas finie", () => {
  assert.deepEqual(cles({ ...BASE, datePlanifiee: AUJ }), ["devis", "client"]);
});

cas("un chantier dont le jour est passé attend sa facture", () => {
  const c = { ...BASE, datePlanifiee: "2026-09-03" };
  assert.deepEqual(cles(c), ["facture", "devis", "client"]);
  assert.equal(geste(c), "Créer la facture");
});

cas("clôturé plus tôt que prévu, il attend sa facture aussi", () => {
  // Il peut clôturer un chantier avant sa date (3 août 2026) : la date à venir
  // ne doit pas lui refuser la facture qu'il vient de gagner.
  const c = { ...BASE, datePlanifiee: "2026-09-11", termineAt: "2026-09-04" };
  assert.equal(geste(c), "Créer la facture");
});

cas("une facture déjà partie n'est plus un geste, elle se consulte", () => {
  const c = { ...BASE, datePlanifiee: "2026-09-03", factureEnvoyeeAt: "2026-09-03" };
  assert.deepEqual(cles(c), ["facture", "devis", "client"]);
  assert.equal(geste(c), null);
  assert.equal(portesDuPlanning(c, AUJ)[0].etat, "envoyée");
});

cas("au plus un geste par chantier, quel que soit l'état", () => {
  for (const date of ["2026-09-03", AUJ, "2026-09-11"]) {
    for (const facture of [null, "2026-09-03"]) {
      for (const termine of [null, "2026-09-03"]) {
        const p = portesDuPlanning(
          { ...BASE, datePlanifiee: date, factureEnvoyeeAt: facture, termineAt: termine },
          AUJ
        );
        assert.ok(p.filter((x) => x.geste).length <= 1, `${date} ${facture} ${termine}`);
      }
    }
  }
});

cas("le devis et la fiche client sont TOUJOURS joignables", () => {
  // Un chantier posé quitte l'onglet « Chantiers » : sans ces deux portes, son
  // devis n'est plus atteignable que par son adresse (8 août 2026).
  for (const date of ["2026-09-03", AUJ, "2026-09-11", null]) {
    const p = portesDuPlanning({ ...BASE, datePlanifiee: date }, AUJ);
    assert.ok(p.some((x) => x.cle === "devis"), `devis manquant pour ${date}`);
    assert.ok(p.some((x) => x.cle === "client"), `client manquant pour ${date}`);
  }
});

cas("l'état du devis distingue un refus d'une correction", () => {
  const parti = { ...BASE, datePlanifiee: AUJ, envoiEnvoyeAt: "2026-09-01" };
  const dit = (reponse: "acceptee" | "refusee" | "correction" | null) =>
    portesDuPlanning({ ...parti, envoiReponse: reponse }, AUJ).find((p) => p.cle === "devis")!.etat;
  assert.equal(dit(null), "parti");
  assert.equal(dit("acceptee"), "accepté");
  assert.equal(dit("refusee"), "refusé");
  assert.equal(dit("correction"), "correction demandée");
});

cas("un devis pas encore parti ne dit rien plutôt que d'inventer", () => {
  const p = portesDuPlanning({ ...BASE, datePlanifiee: AUJ }, AUJ);
  assert.equal(p.find((x) => x.cle === "devis")!.etat, "");
});

cas("le devis parti mène à l'envoi, pas à l'édition — la règle de la fiche", () => {
  // `getSecondarySteps` tranche ainsi depuis le 20 août 2026 : avant l'envoi,
  // `/export` renvoie de lui-même vers le devis. Deux règles ici et là auraient
  // divergé au premier remaniement (`CLAUDE.md` §3).
  const ou = (envoi: string | null) =>
    portesDuPlanning({ ...BASE, datePlanifiee: AUJ, envoiEnvoyeAt: envoi }, AUJ).find(
      (p) => p.cle === "devis"
    )!.href;
  assert.ok(ou(null).endsWith("/devis-complet"));
  assert.ok(ou("2026-09-01").endsWith("/export"));
});

cas("aucune porte ne mène à l'écran que le patron fait supprimer", () => {
  // `/chantiers/<id>` tout court : c'est la fiche du chantier, qu'il veut voir
  // disparaître depuis le 21 août. Une porte qui y mènerait la ferait renaître.
  for (const date of ["2026-09-03", AUJ, "2026-09-11"]) {
    for (const p of portesDuPlanning({ ...BASE, datePlanifiee: date, factureEnvoyeeAt: "2026-09-03" }, AUJ)) {
      assert.ok(/^\/chantiers\/[^/]+\/.+$/.test(p.href), `${p.cle} → ${p.href}`);
    }
  }
});

console.log(echecs === 0 ? "\n✅ Les portes du planning" : `\n❌ ${echecs} cas`);
process.exit(echecs === 0 ? 0 : 1);
