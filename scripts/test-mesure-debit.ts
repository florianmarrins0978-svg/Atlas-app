import assert from "node:assert/strict";
import {
  debitRetenu,
  DEBIT_COMPTEUR,
  PRESSION_COMPTEUR,
  BAR_SUPPOSE_AU_SEAU,
  BAR_MINIMUM_DYNAMIQUE,
} from "../src/lib/arrosage/mesure-debit";

// D'où vient le débit — sa correction du 20 août 2026 au soir.
//
// **CE QUE CETTE SUITE TIENT, ET C'EST LE PIÈGE DE L'ÉCRAN.** La pression ne
// donne pas le débit. Deux robinets à 3 bar délivrent l'un 1 m³/h, l'autre 3,
// selon ce qui les alimente. Un plan bâti sur une pression prise pour un débit
// met trop d'arroseurs sur un réseau — et c'est le paysagiste qui revient.
//
// Et **toute estimation porte sa réserve** : elle remonte sous le plan, en
// rouge. Un chiffre supposé qui se présente comme mesuré est pire qu'un chiffre
// absent (`CLAUDE.md` §4).

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};

console.log("=== D'où vient le débit ===\n");

// ── Au compteur : rien n'est demandé, donc tout est estimé ──────────────────
const auCompteur = debitRetenu({ piquage: "compteur", secondes: null, barStatique: null, barDynamique: null });
dire(auCompteur.ok, "au compteur, on conclut sans rien demander — il l'a exigé");
if (auCompteur.ok) {
  dire(auCompteur.debit === DEBIT_COMPTEUR, `le débit vaut ${auCompteur.debit} m³/h`);
  dire(auCompteur.pression === PRESSION_COMPTEUR, `la pression du réseau vaut ${auCompteur.pression} bar`);
  dire(auCompteur.mesure === "compteur", "la provenance est nommée : le compteur");
  // **AUCUNE RÉSERVE, et c'est une correction du 20 août au soir.** « Si on se
  // repique directement après le compteur en Ø25, on aura au moins trois bars
  // […] tu sais d'office que tu es bien. » La première version avertissait
  // « à vérifier au seau sur place » : un avertissement inutile s'apprend à
  // être ignoré, et celui-là faisait douter de la seule situation sûre.
  dire(auCompteur.reserve === null, `le compteur ne s'excuse pas (réserve : ${auCompteur.reserve ?? "aucune"})`);
}

// **Une saisie au compteur ne change rien.** Les cases n'existent pas sur cet
// écran-là ; si elles arrivaient quand même, elles ne doivent pas décider.
const compteurAvecSaisie = debitRetenu({ piquage: "compteur", secondes: 5, barStatique: null, barDynamique: 6 });
dire(
  compteurAvecSaisie.ok && compteurAvecSaisie.debit === DEBIT_COMPTEUR,
  "au compteur, une saisie parasite ne prend pas la main",
);

// ── Ailleurs, le seau chronométré : la seule vraie mesure ───────────────────
const auSeau = debitRetenu({ piquage: "ailleurs", secondes: 20, barStatique: null, barDynamique: null });
dire(auSeau.ok && auSeau.mesure === "seau", "le seau chronométré est une MESURE");
// 10 L en 20 s = 0,5 L/s = 1,8 m³/h. C'est le chiffre de sa capture.
dire(auSeau.ok && auSeau.debit === 1.8, `10 L en 20 s font ${auSeau.ok ? auSeau.debit : "?"} m³/h`);
dire(auSeau.ok && auSeau.debit === 1.8 && auSeau.reserve !== null,
  "sans mesure de pression, la valeur supposée est signalée");

// **Sa règle du 21 août : au seau seul, on calcule à 2,5 bar — pas à 3.**
// *« Une fois que tu as dix-huit, vingt secondes, on va dire que ce n'est pas
// trop mal : tu peux faire le calcul comme si tu avais deux bars cinq. »*
// Au compteur le Ø25 garantit ses 3 bar ; à un robinet, rien ne garantit ce qui
// l'alimente, donc on retient le minimum viable. Se tromper vers le haut met un
// arroseur de trop, et c'est le gazon qui jaunit en bout de ligne.
dire(auSeau.ok && auSeau.pression === BAR_SUPPOSE_AU_SEAU,
  `au seau seul, le calcul se mène à ${auSeau.ok ? auSeau.pression : "?"} bar`);
dire(auSeau.ok && auSeau.pression !== PRESSION_COMPTEUR,
  "et ce n'est PAS la valeur du compteur : la conduite n'est pas connue");
dire(auSeau.ok && auSeau.reserve !== null && /2,5 bar/.test(auSeau.reserve),
  `la réserve dit à quelle pression on a calculé : « ${auSeau.ok ? auSeau.reserve : "?"} »`);

// **Au kit, 2,5 comme 3 bar sont impeccables** — sa règle du 21 août : « s'il y
// a marqué deux bars cinq, trois bars, là tu es impeccable ». Le seuil est donc
// atteint À 2,5, pas dépassé : une inégalité stricte le refuserait de justesse
// et ferait douter d'une mesure qu'il juge bonne.
for (const bar of [2.5, 3]) {
  const impeccable = debitRetenu({ piquage: "ailleurs", secondes: 20, barStatique: 3.5, barDynamique: bar });
  dire(impeccable.ok && impeccable.reserve === null,
    `${bar} bar en dynamique : rien à signaler`);
  dire(impeccable.ok && impeccable.pression === bar,
    `et le calcul retient bien ${bar} bar`);
}

const seauRapide = debitRetenu({ piquage: "ailleurs", secondes: 10, barStatique: null, barDynamique: null });
dire(seauRapide.ok && seauRapide.debit === 3.6, `10 L en 10 s font ${seauRapide.ok ? seauRapide.debit : "?"} m³/h`);
const seauLent = debitRetenu({ piquage: "ailleurs", secondes: 60, barStatique: null, barDynamique: null });
dire(seauLent.ok && seauLent.debit === 0.6, `10 L en 60 s font ${seauLent.ok ? seauLent.debit : "?"} m³/h`);

// **Le seau PRIME sur le manomètre**, et sans réserve : les deux sont donnés,
// l'un mesure le débit, l'autre la pression. Rien n'est supposé.
const lesDeux = debitRetenu({ piquage: "ailleurs", secondes: 20, barStatique: 3.5, barDynamique: 2.5 });
dire(lesDeux.ok && lesDeux.debit === 1.8 && lesDeux.pression === 2.5, "seau et manomètre se complètent");
dire(lesDeux.ok && lesDeux.reserve === null, "rien n'est supposé : aucune réserve");

// ── Ailleurs, le manomètre seul : on estime, ET ON LE DIT ───────────────────
const auManometre = debitRetenu({ piquage: "ailleurs", secondes: null, barStatique: null, barDynamique: 2 });
dire(auManometre.ok && auManometre.pression === 2, "la pression relevée est gardée telle quelle");
dire(auManometre.ok && auManometre.mesure === "estime", "mais le débit reste une ESTIMATION");
dire(
  auManometre.ok && auManometre.reserve !== null && /ne donne pas le débit/.test(auManometre.reserve),
  `la réserve nomme le piège : « ${auManometre.ok ? auManometre.reserve : ""} »`,
);

// ── Ailleurs, rien du tout : on REFUSE ──────────────────────────────────────
const rien = debitRetenu({ piquage: "ailleurs", secondes: null, barStatique: null, barDynamique: null });
dire(!rien.ok, "hors compteur, sans aucune mesure, on refuse plutôt que d'inventer");
dire(!rien.ok && /seau/.test(rien.raison) && /kit buse 5/.test(rien.raison),
  `et la raison dit QUOI FAIRE : « ${!rien.ok ? rien.raison : ""} »`);

// Les valeurs absurdes ne passent pas pour des mesures.
for (const [secondes, bar, quoi] of [
  [0, null, "zéro seconde"],
  [-5, null, "un temps négatif"],
  [null, 0, "zéro bar"],
  [null, -1, "une pression négative"],
] as [number | null, number | null, string][]) {
  const r = debitRetenu({ piquage: "ailleurs", secondes, barStatique: null, barDynamique: bar });
  dire(!r.ok, `${quoi} n'est pas une mesure`);
}

console.log("\n=== Le seuil des 2,5 bar, et la chute ===\n");

// **Sa règle du 20 août au soir :** « si il y a 2,5 bar, 3 bar en dynamique,
// alors c'est parfait, c'est ce qu'il faut pour que les arroseurs se lèvent
// correctement ». En dessous, une turbine sort mal de son fourreau et le gazon
// fait des taches en arc de cercle.
const faible = debitRetenu({ piquage: "ailleurs", secondes: 20, barStatique: null, barDynamique: 1.8 });
dire(faible.ok, "sous le seuil, on calcule quand même — c'est son métier de décider");
dire(
  faible.ok && faible.reserve !== null && /ne pas se lever/.test(faible.reserve),
  `mais l'écran le DIT : « ${faible.ok ? faible.reserve : ""} »`,
);

const pile = debitRetenu({ piquage: "ailleurs", secondes: 20, barStatique: null, barDynamique: BAR_MINIMUM_DYNAMIQUE });
dire(
  pile.ok && (pile.reserve === null || !/ne pas se lever/.test(pile.reserve)),
  `à ${BAR_MINIMUM_DYNAMIQUE} bar pile, aucune alerte : c'est ce qu'il faut`,
);

// **La chute accuse la CONDUITE, pas le réseau.** Plus d'un bar et demi entre
// statique et dynamique veut dire que ce qui alimente ce robinet est trop
// étroit ou trop long — un piquage plus en amont réglerait tout.
const chute = debitRetenu({ piquage: "ailleurs", secondes: 20, barStatique: 5, barDynamique: 3 });
dire(
  chute.ok && chute.reserve !== null && /chute/.test(chute.reserve),
  `2 bar de chute sont signalés : « ${chute.ok ? chute.reserve : ""} »`,
);
const petiteChute = debitRetenu({ piquage: "ailleurs", secondes: 20, barStatique: 3.5, barDynamique: 3 });
dire(
  petiteChute.ok && petiteChute.reserve === null,
  "une demi-barre de chute est normale, et ne dit rien",
);

// **La DYNAMIQUE décide, jamais la statique.** La statique, robinet fermé, est
// toujours flatteuse : bâtir la portée des arroseurs dessus en poserait trop.
dire(chute.ok && chute.pression === 3, `la pression retenue est la dynamique (${chute.ok ? chute.pression : "?"} bar)`);

// **Deux problèmes se disent tous les deux.** Un débit estimé ET une pression
// trop faible : n'en dire qu'un laisserait l'autre se découvrir sur le chantier.
const deuxSoucis = debitRetenu({ piquage: "ailleurs", secondes: null, barStatique: null, barDynamique: 1.5 });
dire(
  deuxSoucis.ok && deuxSoucis.reserve !== null && /ne pas se lever/.test(deuxSoucis.reserve) && /ESTIMÉ/.test(deuxSoucis.reserve),
  "un débit estimé et une pression faible sont signalés ENSEMBLE",
);

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
