import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { bornesDePeriode, categorieDeLaLigne, ecartSignale, jourEnMots, libelleMotif, libellePeriode, suiteDeLaPiece } from "@/lib/pour-mon-comptable";
import { getCurrentCtx } from "@/server/session-ctx";
import { ligneAJustifier, lignesDuReleve, pieceDeLaLigne, type LigneDuReleve } from "@/server/repositories/pour-mon-comptable";
import Releve, { type LigneAffichee } from "./Releve";
import { garderLaPage } from "@/server/garde-page";
import { facturesARapprocher } from "@/server/banque/questions";
import { facturesRecuesLibres } from "@/server/repositories/pour-mon-comptable";
import { carteDeLaLigne, facturesAffichees } from "../a-regarder";

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
  const [lignes, factures, enAttente] = await Promise.all([lignesDuReleve(ctx, bornes.du, bornes.au), facturesRecuesLibres(ctx), facturesARapprocher(ctx)]);

  // La plus récente en haut, comme sur la planche (écran 3).
  const affichees: LigneAffichee[] = [...lignes].reverse().map((l) => {
    const piece = pieceDeLaLigne(l);
    return {
      id: l.id,
      jour: jourEnMots(l.jour),
      libelle: l.libelle || (l.contrepartie ?? ""),
      categorie: categorieDeLaLigne({ sens: l.sens, libelle: l.libelle, natureDuTicket: l.ticket?.nature ?? null, justification: l.justification }),
      montant: `${l.sens === "entree" ? "+" : "−"}${enEuros(l.montant)}`,
      sens: l.sens,
      aJustifier: ligneAJustifier(l),
      preuve: preuveDe(l),
      piece: piece ? { nature: piece.nature, quoi: l.justification === "ticket" ? "ticket" : "facture" } : null,
      // Ce que le patron a posé se défait d'un appui ; la facture d'Atlas
      // confirmée, elle, porte un règlement noté, qui se retire sur la facture.
      defaisable: l.justification !== null,
      carte: ligneAJustifier(l) ? carteDeLaLigne(l, [], enAttente) : null,
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
          titre={libellePeriode(periode)}
        />
        <p className="mx-6 mt-2 text-[15px]" style={{ color: colors.inkSoft }}>
          Pour mon comptable
        </p>
        <div className="mx-6 mt-5 grid grid-cols-3 gap-2 rounded-[18px] px-4 py-3.5" style={{ backgroundColor: colors.card }} data-atlas="totaux-du-releve">
          {[
            { nom: "Sorties", valeur: total("sortie"), couleur: colors.montantSortie },
            { nom: "Entrées", valeur: total("entree"), couleur: colors.montantEntree },
            { nom: "À justifier", valeur: String(affichees.filter((l) => l.aJustifier).length), couleur: colors.alert },
          ].map((t) => (
            <span key={t.nom} className="min-w-0 text-[14px]" style={{ color: colors.inkSoft }}>
              {t.nom}
              <b className="mt-1 block whitespace-nowrap text-[21px] font-normal leading-[1.1] tabular-nums" style={{ fontFamily: font.display, color: t.couleur }}>
                {t.valeur}
              </b>
            </span>
          ))}
        </div>
        <Releve lignes={affichees} factures={facturesAffichees(factures)} />
      </div>
    </div>
  );
}

/**
 * Ce que dit la pièce d'une ligne, et son signe. La phrase se compose ICI, avec
 * les mêmes règles que le dossier et la page du comptable (`suiteDeLaPiece`) :
 * une pièce jointe malgré l'écart le porte, partout pareil.
 */
function preuveDe(l: LigneDuReleve): LigneAffichee["preuve"] {
  const suite = suiteDeLaPiece(l.ecart, l.sens);
  const genre = (base: "ok" | "ticket") => (ecartSignale(l.ecart, l.sens) ? "ecart" : base);
  if (l.factureEmise) return { genre: genre("ok"), texte: `Facture ${l.factureEmise.numero}${suite}` };
  if (l.justification === "ticket" && l.ticket) {
    return { genre: genre("ticket"), texte: `Ticket du ${jourEnMots(l.ticket.dateAchat)}${suite}${l.reliePar === "atlas" ? ", relié par Atlas" : ""}` };
  }
  if (l.justification === "facture" && l.factureRecue) return { genre: genre("ok"), texte: `Facture ${l.factureRecue.societe}${suite}` };
  if (l.justification === "facture_hors_atlas") return { genre: genre("ok"), texte: `${l.sens === "sortie" ? "Facture du fournisseur" : "Facture faite hors d’Atlas"}${suite}` };
  if (l.justification === "motif" && l.motif) return { genre: "ok", texte: libelleMotif(l.motif, l.sens) };
  if (l.justification === "ticket_perdu") return { genre: "perdu", texte: "Ticket perdu, mention validée" };
  return { genre: "manque", texte: l.sens === "entree" ? "Facture à confirmer" : "Sans ticket" };
}
