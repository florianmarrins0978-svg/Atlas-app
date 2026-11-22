import type { SaisieDuPlan } from "./plan-enregistre";
import { cotesEcrites } from "./lignes-du-reseau";
import { noteDesCorrections } from "./lu-sur-la-photo";
import { nomDeLaZone } from "./zones-du-plan";

/**
 * « CE QUE VOUS AVEZ SAISI », sur un plan revu — sa planche du 21 novembre
 * 2026 (`appli/arrosage-dossiers.html`). Trois rangées : le piquage, les
 * zones, ses choix. Rien ne s'y ajoute qui ne soit dans la saisie : une
 * pression non relevée ne s'écrit pas, un diamètre que l'outil a proposé ne
 * se dit pas choisi par lui.
 *
 * **Le débit est celui que le calcul a reçu.** La saisie le porte sous forme
 * de seau et de temps (`actions.ts`, une seule source du débit) : il se relit
 * en m³/h, ce qu'il a mesuré ou ce que le compteur donne.
 *
 * **Une zone lue sur la photo dit ce qu'il en a corrigé** : « (lu 2 m, corrigé
 * par vous) », à la suite de ses cotes (`noteDesCorrections`).
 */
export type RangeeDeLaSaisie = { cle: string; valeurs: { texte: string; note: string | null }[] };

const seule = (texte: string) => ({ texte, note: null });

const nombre = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",");

function enUneListe(mots: string[]): string {
  return mots.length <= 1 ? (mots[0] ?? "") : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;
}

export function saisieEcrite(saisie: SaisieDuPlan): RangeeDeLaSaisie[] {
  const p = saisie.parametres;
  const lieu = p.compteur === "oui" ? "Juste après le compteur d’eau" : "Robinet de jardin";
  const mesures = [p.pression > 0 ? `${nombre(p.pression)}\u00a0bar` : null, p.temps > 0 && p.seau > 0 ? `${nombre((p.seau / p.temps) * 3.6)}\u00a0m³/h` : null].filter((x): x is string => x !== null);

  // Les diamètres qu'il a CHOISIS, et eux seuls : le reste est la proposition de l'outil.
  const ou = [
    ...(p.diametres?.amenee === 32 ? ["sur l’amenée"] : []),
    ...Object.entries(p.diametres?.reseaux ?? {})
      .filter(([, d]) => d === 32)
      .map(([i]) => `sur le réseau ${Number(i) + 1}`),
  ];
  const diametres = ou.length > 0 ? `Ø32 ${enUneListe(ou)}.` : "Les diamètres que l’outil propose.";

  const r = saisie.retouches;
  const options = [
    ["Sonde de pluie", r.sonde],
    ["grillage", r.grillage],
    ["téflon", r.teflon],
  ] as const;
  const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const oui = options.filter(([, v]) => v).map(([n]) => n);
  const non = options.filter(([, v]) => !v).map(([n]) => n);
  const phrase = [oui.length ? `${majuscule(enUneListe(oui))} : oui.` : null, non.length ? `${majuscule(enUneListe(non))} : non.` : null].filter(Boolean).join(" ");

  return [
    { cle: "Le piquage", valeurs: [seule(mesures.length ? `${lieu}, ${enUneListe(mesures)}` : lieu)] },
    { cle: "Les zones", valeurs: p.zones.map((z) => ({ texte: `${nomDeLaZone(z)}, ${cotesEcrites(z)}`, note: noteDesCorrections(z) })) },
    { cle: "Vos choix", valeurs: [seule(diametres), seule(phrase)] },
  ];
}
