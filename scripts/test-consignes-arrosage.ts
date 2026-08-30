import assert from "node:assert/strict";
import {
  lireConsigne,
  appliquer,
  cotesDuPlanTiennentDebout,
  type ParametresPlan,
} from "../src/lib/arrosage/consignes";
import { calculerPlan } from "../src/lib/arrosage/calcul.js";

/**
 * CE QUE LA DISCUSSION A LE DROIT DE CHANGER — sa demande du 21 août 2026.
 *
 * **Ce que cette suite défend.** Deux bornes qu'il a posées lui-même, et qui
 * sont plus faciles à enfreindre qu'à tenir :
 *
 *   1. *« La discussion ne doit JAMAIS créer un plan avec des réseaux. »* Ce qui
 *      sort d'un message est une CONSIGNE prise dans une liste fermée, jamais un
 *      tracé ni un chiffre. Un plan retouché à la main ne se recalcule plus, et
 *      la fois d'après le tracé, les métrés et les pièces ne viennent plus de la
 *      même source.
 *   2. **Rien n'est inventé** (`CLAUDE.md` §4). Une référence absente du
 *      catalogue est refusée, jamais rapprochée de la plus proche — sans quoi un
 *      modèle qui dit « passez en 5006 » fait commander ce qui n'existe pas.
 */

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};

const PARAM: ParametresPlan = {
  seau: 10,
  temps: 20,
  pression: 3,
  compteur: "oui",
  regardVersZone: 0,
  zones: [
    { id: 1, type: "gazon", nom: "Carré", L: 12, l: 12, x: 0, y: 0 },
    { id: 2, type: "gazon", nom: "Bande", L: 8, l: 4, x: 12, y: 0 },
  ],
  nourrice: { x: 0, y: 4 },
};

console.log("\n=== Ce que la discussion peut changer ===\n");

// ── 1. Ce qui est au catalogue passe ────────────────────────────────────────
{
  const r = lireConsigne({ quoi: "marque", valeur: "hunter" }, PARAM);
  dire(r.ok && r.consigne.quoi === "marque", "changer de marque est une consigne valable");

  const b = lireConsigne({ quoi: "buse", zone: 2, valeur: "RBT648" }, PARAM);
  dire(b.ok, b.ok ? "une buse du catalogue est acceptée" : `refusée : ${b.raison}`);

  const m = lireConsigne({ quoi: "materiel", zone: 1, valeur: "tuyere" }, PARAM);
  dire(m.ok, "imposer des tuyères sur une zone est une consigne valable");
}

// ── 2. CE QUI N'EXISTE PAS EST REFUSÉ, ET NOMMÉ ─────────────────────────────
//
// **Le piège que ce bloc attrape.** Un modèle répond volontiers « 5006 » ou
// « Gardena » avec l'aplomb d'un catalogue. Rapprocher de la référence la plus
// proche ferait commander une pièce que le fournisseur n'a pas, et personne ne
// s'en apercevrait avant la livraison.
{
  const buse = lireConsigne({ quoi: "buse", zone: 1, valeur: "RBT-INEXISTANTE" }, PARAM);
  dire(!buse.ok, buse.ok ? "une buse inventée a été acceptée" : `refusée : ${buse.raison}`);
  dire(
    !buse.ok && /RBT-INEXISTANTE/.test(buse.raison),
    "et le refus NOMME la référence, pour qu'il corrige sans deviner",
  );

  const marque = lireConsigne({ quoi: "marque", valeur: "Gardena" }, PARAM);
  dire(!marque.ok, marque.ok ? "une marque inventée a été acceptée" : `refusée : ${marque.raison}`);
  dire(
    !marque.ok && /Rain Bird/.test(marque.raison),
    "et le refus dit lesquelles existent, au lieu d'un « demande invalide »",
  );

  const zone = lireConsigne({ quoi: "buse", zone: 9, valeur: "RBT648" }, PARAM);
  dire(!zone.ok, zone.ok ? "une zone inexistante a été acceptée" : `refusée : ${zone.raison}`);
}

// ── 3. RIEN D'AUTRE QUE LA LISTE FERMÉE ─────────────────────────────────────
//
// C'est la borne du 21 août : la discussion ne crée pas un plan. Un modèle qui
// tenterait de poser un tracé, un nombre de réseaux ou une pièce doit se heurter
// à un mur, pas à une conversion au jugé.
{
  for (const tentative of [
    { quoi: "reseaux", valeur: 3 },
    { quoi: "tranchee", valeur: 64 },
    { quoi: "materiel_supplementaire", valeur: "te-25-25-25" },
    // **La nourrice se place par LUI, jamais par l'outil** (`CLAUDE.md` §4 bis).
    { quoi: "nourrice", valeur: { x: 0, y: 4 } },
  ]) {
    const r = lireConsigne(tentative, PARAM);
    dire(!r.ok, r.ok ? `« ${tentative.quoi} » a été accepté comme consigne` : `« ${tentative.quoi} » est refusé`);
  }
}

// ── 4. Une consigne posée REFAIT le plan, elle ne le retouche pas ───────────
//
// **Le contrôle qui compte.** Imposer une buse doit changer le plan ENTIER —
// arroseurs, débits, réseaux —, pas seulement une ligne de la liste de pièces.
{
  const avant = calculerPlan(PARAM as never) as never as { secteurs: unknown[]; dessin: { buse: string | null; points: unknown[] }[] };
  const c = lireConsigne({ quoi: "materiel", zone: 1, valeur: "tuyere" }, PARAM);
  dire(c.ok, "la consigne se lit");
  if (c.ok) {
    const apres = calculerPlan(appliquer(PARAM, c.consigne) as never) as never as {
      secteurs: unknown[];
      dessin: { buse: string | null; points: unknown[] }[];
    };
    dire(
      apres.dessin[0].buse !== avant.dessin[0].buse || apres.dessin[0].points.length !== avant.dessin[0].points.length,
      `le carré passe de ${avant.dessin[0].points.length}× ${avant.dessin[0].buse} ` +
        `à ${apres.dessin[0].points.length}× ${apres.dessin[0].buse}`,
    );
    // **Et les paramètres d'origine n'ont pas bougé** : ils repartent vers
    // l'écran, et les modifier sur place ferait diverger ce qu'il voit de ce
    // que le calcul a reçu.
    dire(PARAM.zones[0].materiel === undefined, "les paramètres d'origine sont intacts — on rend une copie");
  }
}

// ── 5. Changer de marque relâche ce qui appartenait à l'ancienne ────────────
//
// Une buse Rain Bird gardée après un passage chez Hunter ferait commander une
// référence que le fournisseur n'a pas.
{
  const avec = appliquer({ ...PARAM, zones: [{ ...PARAM.zones[0], buse: "RBT648" }, PARAM.zones[1]] }, {
    quoi: "marque",
    valeur: "hunter",
  });
  dire(avec.zones[0].buse === undefined, "changer de marque relâche les buses imposées de l'ancienne");
  dire(avec.corps === undefined, "et le corps, qui appartenait lui aussi à l'ancienne marque");
}


// ─── LES COTES QUI ARRIVENT DU NAVIGATEUR ───────────────────────────────────
//
// **Un déni de service, trouvé à l'audit final du 29 août 2026.**
// `discuterDuPlan` recevait `parametres` du navigateur et les passait au calcul
// sans les regarder — avec un `as never` qui retirait jusqu'au typage. Or
// `poser()` empile `nx × ny` points : avec 100 000 m de côté et une portée de
// cinq mètres, cela fait de l'ordre de deux cent quarante millions d'objets sur
// le fil de l'événement. Le processus tombe, et il emporte les requêtes de
// toutes les entreprises servies par cette instance.
//
// La lecture de croquis plafonnait déjà à 100 m ; ce chemin-ci contournait le
// plafond parce que ses cotes ne passent pas par la photo.

{
  const socle = { seau: 10, temps: 30, pression: 3, compteur: "25", regardVersZone: 0, nourrice: null };
  const plan = (zones: unknown) => ({ ...socle, zones }) as unknown as ParametresPlan;

  // **La moitié qui empêche de passer au vert en refusant tout.**
  dire(
    cotesDuPlanTiennentDebout(plan([{ id: 1, type: "gazon", L: 16, l: 13 }])).ok,
    "un jardin ordinaire passe — la borne ne casse pas l'outil"
  );
  dire(
    cotesDuPlanTiennentDebout(plan([{ id: 1, type: "haie", ml: 40 }])).ok,
    "une haie ordinaire passe aussi"
  );

  dire(
    !cotesDuPlanTiennentDebout(plan([{ id: 1, type: "gazon", L: 100000, l: 100000 }])).ok,
    "CENT MILLE MÈTRES DE CÔTÉ EST REFUSÉ — c'est la bombe"
  );
  // **`NaN` et `Infinity` séparément, et ce n'est pas du zèle :** `NaN > 100`
  // est FAUX. Sans le `Number.isFinite` de la fonction, une cote non numérique
  // franchissait la borne en silence et repartait vers le calcul — le contrôle
  // aurait été vert sur le cas même qu'il existe pour attraper.
  dire(
    !cotesDuPlanTiennentDebout(plan([{ id: 1, type: "gazon", L: NaN, l: 10 }])).ok,
    "une cote NaN est refusée — NaN > 100 est faux, la comparaison seule ne suffit pas"
  );
  dire(
    !cotesDuPlanTiennentDebout(plan([{ id: 1, type: "gazon", L: Infinity, l: 10 }])).ok,
    "une cote infinie est refusée"
  );
  dire(
    !cotesDuPlanTiennentDebout(
      plan(Array.from({ length: 800 }, (_, i) => ({ id: i, type: "gazon", L: 5, l: 5 })))
    ).ok,
    "huit cents zones sont refusées"
  );
  dire(
    !cotesDuPlanTiennentDebout({ ...socle } as unknown as ParametresPlan).ok,
    "un plan sans zones est refusé, pas parcouru"
  );
}

console.log(`\n${echecs === 0 ? "✅" : "❌"} Les consignes de la discussion — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
