import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { libelleMotif, bornesDePeriode, categorieDeLaLigne, jourEnMots, libellePeriode } from "@/lib/pour-mon-comptable";
import { getCurrentCtx } from "@/server/session-ctx";
import { ligneAJustifier, lignesDuReleve } from "@/server/repositories/pour-mon-comptable";
import Releve, { type LigneAffichee } from "./Releve";
import { garderLaPage } from "@/server/garde-page";

export const dynamic = "force-dynamic";

/**
 * LE RELEVÉ D'UNE PÉRIODE — écran 3 de `appli/pour-mon-comptable.html`.
 *
 * Chaque ligne de la banque, sa couleur à gauche, sa pièce dessous. La phrase
 * de la pièce se compose ICI, sur le serveur, avec les mêmes règles que le
 * dossier : l'écran ne décide de rien.
 */
export default async function PageReleve({ params }: { params: Promise<{ periode: string }> }) {
  await garderLaPage();
  const { periode } = await params;
  const bornes = bornesDePeriode(periode);
  if (!bornes) notFound();

  const ctx = await getCurrentCtx();
  const lignes = await lignesDuReleve(ctx, bornes.du, bornes.au);

  // La plus récente en haut, comme sur la planche (écran 3).
  const affichees: LigneAffichee[] = [...lignes].reverse().map((l) => {
    const categorie = categorieDeLaLigne({ sens: l.sens, libelle: l.libelle, natureDuTicket: l.ticket?.nature ?? null, justification: l.justification });
    const preuve: LigneAffichee["preuve"] = l.factureEmise
      ? { genre: "ok", texte: `Facture ${l.factureEmise.numero}` }
      : l.justification === "ticket" && l.ticket
        ? { genre: "ticket", texte: `Ticket du ${jourEnMots(l.ticket.dateAchat)}${l.reliePar === "atlas" ? ", relié par Atlas" : ""}`, ticketId: l.ticket.photoCle ? l.id : null }
        : l.justification === "facture" && l.factureRecue
          ? { genre: "ok", texte: `Facture ${l.factureRecue.societe}` }
          : l.justification === "motif" && l.motif
            ? { genre: "ok", texte: libelleMotif(l.motif, l.sens) }
            : l.justification === "ticket_perdu"
              ? { genre: "perdu", texte: "Ticket perdu, mention validée" }
              : { genre: "manque", texte: l.sens === "entree" ? "Facture à confirmer" : "Sans ticket" };
    return {
      id: l.id,
      jour: jourEnMots(l.jour),
      libelle: l.libelle || (l.contrepartie ?? ""),
      categorie,
      montant: `${l.sens === "entree" ? "+" : "−"}${enEuros(l.montant)}`,
      sens: l.sens,
      aJustifier: ligneAJustifier(l),
      preuve,
      defaisable: l.sens === "sortie" && l.justification !== null,
    };
  });

  const total = (sens: "entree" | "sortie") =>
    enEuros(lignes.filter((l) => l.sens === sens).reduce((s, l) => s + Math.round(Number(l.montant) * 100), 0) / 100);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran
          retour={{ href: "/termines/comptable", libelle: "Retour au dossier" }}
          action={<BoutonAssistant />}
          actionPlacee="retour"
          assistant={false}
          surtitre="Pour mon comptable"
          titre={libellePeriode(periode)}
        />
        <div className="mx-6 mt-4 flex gap-5 text-[13px]" style={{ color: colors.inkSoft }}>
          <span>
            Sorties
            <b className="block text-[19px] font-normal tabular-nums" style={{ fontFamily: font.display, color: colors.montantSortie }}>
              {total("sortie")}
            </b>
          </span>
          <span>
            Entrées
            <b className="block text-[19px] font-normal tabular-nums" style={{ fontFamily: font.display, color: colors.montantEntree }}>
              {total("entree")}
            </b>
          </span>
          <span>
            Sans ticket
            <b className="block text-[19px] font-normal tabular-nums" style={{ fontFamily: font.display, color: colors.alert }}>
              {affichees.filter((l) => l.aJustifier).length}
            </b>
          </span>
        </div>
        <Releve lignes={affichees} />
      </div>
    </div>
  );
}
