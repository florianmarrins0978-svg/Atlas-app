import { avecCivilite, type CiviliteChoisie } from "@/lib/civilite";

/**
 * « Mme Vasseur, facture F2026‑000001 » : la ligne sous le titre de « Il vous
 * a payé », « Il ne vous paiera pas » et « Mise en demeure » (planche du
 * 2 novembre 2026, `appli/soignee/facture.html`).
 *
 * **La civilité se garde** — la note de la planche : « Mme Vasseur », jamais
 * « VASSEUR ». L'en-tête commune passait le nom en capitales d'or, et la
 * civilité n'y était pas.
 *
 * Le numéro ne se coupe pas à son trait d'union : « F2026- » en fin de ligne et
 * « 000001 » au début de la suivante ne se lisent plus comme un numéro.
 */
export default function SituationDeLaFacture({
  clientNom,
  clientCivilite,
  numero,
}: {
  clientNom: string | null;
  clientCivilite: CiviliteChoisie;
  numero: string;
}) {
  const client = avecCivilite(clientNom, clientCivilite);
  const piece = <span className="whitespace-nowrap">{numero}</span>;
  return client ? (
    <>
      {client}, facture {piece}
    </>
  ) : (
    <>Facture {piece}</>
  );
}
