import assert from "node:assert/strict";
import {
  JOURS_AVANT_EFFACEMENT,
  commentRouvrir,
  compteFerme,
  dateDEffacement,
  dateDeFermeture,
  etatDeLaFermeture,
  jourEnMots,
  abonnementRouvreLeCompte,
  resteAEffacer,
} from "../src/lib/fermeture-compte";

// ═══════════════════════════════════════════════════════════════════════════
// FERMER SON COMPTE : LES RÈGLES, SANS BASE
// ═══════════════════════════════════════════════════════════════════════════
//
// Ses décisions du 5 novembre 2026 (`docs/QUESTIONS.md`, question 33). Ce qui
// compte le plus ici, et qui coûterait le plus cher à rater :
//
//   · son choix A : fermer en cours de mois ne lui retire pas ce qu'il a payé ;
//   · rien ne s'efface avant les trente jours, et rien ne s'efface deux fois ;
//   · une fermeture seulement DEMANDÉE ne ferme rien.

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

const jour = (iso: string) => new Date(`${iso}T12:00:00Z`);
const MAINTENANT = jour("2026-11-05");

console.log("=== Quand le compte se ferme (son choix A) ===\n");

cas("abonné jusqu'au 1er décembre : il garde tout jusque-là", () => {
  const fin = jour("2026-12-01");
  assert.equal(dateDeFermeture({ statut: "actif", periodeFin: fin }, MAINTENANT).getTime(), fin.getTime());
});

cas("en essai : rien n'est payé, la fermeture prend effet tout de suite", () => {
  assert.equal(dateDeFermeture({ statut: "essai", periodeFin: jour("2026-11-15") }, MAINTENANT).getTime(), MAINTENANT.getTime());
});

cas("impayé ou déjà résilié : tout de suite, rien n'est prolongé", () => {
  for (const statut of ["impaye", "resilie"] as const) {
    assert.equal(dateDeFermeture({ statut, periodeFin: jour("2026-12-01") }, MAINTENANT).getTime(), MAINTENANT.getTime());
  }
});

cas("actif sans date de fin connue : tout de suite, on ne devine pas une échéance", () => {
  assert.equal(dateDeFermeture({ statut: "actif", periodeFin: null }, MAINTENANT).getTime(), MAINTENANT.getTime());
});

cas("sans aucune ligne d'abonnement (compte d'avant l'offre) : tout de suite", () => {
  assert.equal(dateDeFermeture(null, MAINTENANT).getTime(), MAINTENANT.getTime());
});

console.log("\n=== Où en est la fermeture ===\n");

const demandee = { demandeeLe: MAINTENANT, effectiveLe: jour("2026-12-01"), resteEffaceLe: null };

cas("rien demandé : ouvert", () => {
  assert.equal(etatDeLaFermeture(null, MAINTENANT).statut, "ouvert");
  assert.equal(etatDeLaFermeture({ demandeeLe: null, effectiveLe: null, resteEffaceLe: null }, MAINTENANT).statut, "ouvert");
});

cas("demandée, échéance pas atteinte : programmée, et le compte N'EST PAS fermé", () => {
  assert.equal(etatDeLaFermeture(demandee, MAINTENANT).statut, "programmee");
  assert.equal(compteFerme(demandee, MAINTENANT), false);
});

cas("l'échéance passée : fermé, lecture seule", () => {
  assert.equal(etatDeLaFermeture(demandee, jour("2026-12-01")).statut, "fermee");
  assert.equal(compteFerme(demandee, jour("2026-12-02")), true);
});

cas("le reste effacé : archivé, toujours fermé", () => {
  const archive = { ...demandee, resteEffaceLe: jour("2026-12-31") };
  assert.equal(etatDeLaFermeture(archive, jour("2027-01-01")).statut, "archivee");
  assert.equal(compteFerme(archive, jour("2027-01-01")), true);
});

console.log("\n=== L'effacement du reste ===\n");

cas(`${JOURS_AVANT_EFFACEMENT} jours pleins après la fermeture, pas un de moins`, () => {
  assert.equal(JOURS_AVANT_EFFACEMENT, 30);
  assert.equal(dateDEffacement(jour("2026-12-01")).toISOString(), jour("2026-12-31").toISOString());
});

cas("rien ne s'efface pendant les trente jours", () => {
  assert.equal(resteAEffacer(demandee, jour("2026-12-30")), false);
  assert.equal(resteAEffacer(demandee, MAINTENANT), false, "une fermeture seulement demandée n'efface rien");
});

cas("le trentième jour, le reste s'efface", () => {
  assert.equal(resteAEffacer(demandee, jour("2026-12-31")), true);
});

cas("déjà effacé : jamais une seconde fois", () => {
  assert.equal(resteAEffacer({ ...demandee, resteEffaceLe: jour("2026-12-31") }, jour("2027-06-01")), false);
});

cas("rien demandé : rien à effacer, même des années après", () => {
  assert.equal(resteAEffacer(null, jour("2040-01-01")), false);
});

console.log("\n=== Rouvrir ===\n");

cas("fermeture programmée : on annule, il reste abonné", () => {
  assert.equal(commentRouvrir(etatDeLaFermeture(demandee, MAINTENANT), true), "annuler");
});

cas("fermé, passé par l'abonnement : rouvrir, c'est se réabonner", () => {
  assert.equal(commentRouvrir(etatDeLaFermeture(demandee, jour("2027-01-01")), true), "se-reabonner");
});

cas("fermé, compte d'avant l'offre : il rouvre sans payer, comme avant", () => {
  assert.equal(commentRouvrir(etatDeLaFermeture(demandee, jour("2027-01-01")), false), "rouvrir");
});

cas("ouvert : rien à rouvrir", () => {
  assert.equal(commentRouvrir(etatDeLaFermeture(null, MAINTENANT), true), null);
});

console.log("\n=== Un abonnement repris rouvre le compte ===\n");

cas("réabonné : la fermeture part", () => {
  assert.equal(abonnementRouvreLeCompte({ statut: "actif", annulationDemandee: false }), true);
});

cas("résiliation encore demandée, l'état exact d'une fermeture en cours : rien ne rouvre", () => {
  assert.equal(abonnementRouvreLeCompte({ statut: "actif", annulationDemandee: true }), false);
});

cas("essai, impayé, résilié : rien ne rouvre", () => {
  for (const statut of ["essai", "impaye", "resilie"] as const) {
    assert.equal(abonnementRouvreLeCompte({ statut, annulationDemandee: false }), false);
  }
});

console.log("\n=== Le jour dit à l'écran ===\n");

cas("minuit en temps universel se lit le bon jour à Paris", () => {
  assert.equal(jourEnMots(new Date("2026-12-04T23:30:00Z")), "5 décembre 2026");
});

console.log(`\n${echecs === 0 ? "✅ 0 échec" : `❌ ${echecs} échec(s)`}`);
process.exit(echecs === 0 ? 0 : 1);
