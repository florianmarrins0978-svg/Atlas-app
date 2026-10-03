import type { CSSProperties, ReactNode } from "react";
import { charte, type NomCharte } from "@/lib/chartes";
import { variablesDesEtats, type CouleursPlanning } from "@/lib/couleurs-planning";

/**
 * Pose les couleurs du planning de l'entreprise sur ce qu'il enveloppe.
 *
 * **Au-dessus de l'écran, pas dans chaque carré** : les barres, la légende et
 * les pastilles lisent `fondDeLEtat`, qui lit la variable. Un écran qui montre
 * ces quatre états n'a qu'à être enveloppé, et aucun ne peut garder l'ancienne
 * couleur parce qu'on aurait oublié de lui passer la nouvelle.
 *
 * **`display: contents`** : l'enveloppe ne dessine rien et ne décale rien, elle
 * ne fait que transmettre ses variables.
 */
export default function CouleursDesEtats({
  couleurs,
  nomCharte,
  children,
}: {
  couleurs: CouleursPlanning;
  nomCharte: NomCharte | null;
  children: ReactNode;
}) {
  const style = { display: "contents", ...variablesDesEtats(couleurs, charte(nomCharte)) } as CSSProperties;
  return <div style={style}>{children}</div>;
}
