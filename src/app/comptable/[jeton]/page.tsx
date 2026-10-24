import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { ligneDuTotal } from "@/lib/ticket-imprime";
import { LIBELLE_MOTIF, categorieDeLaLigne, jourComplet, jourEnMots } from "@/lib/pour-mon-comptable";
import { dossierParJeton, type LignePourLeComptable } from "@/server/repositories/verification-comptable";
import Verification, { type LigneAVerifier, type PieceAffichee } from "./Verification";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dossier justifié", robots: { index: false, follow: false } };

/**
 * LA PAGE DU COMPTABLE — écran 7 de `appli/pour-mon-comptable.html`, ses choix
 * du 24 octobre 2026 : le montant à gauche, le justificatif qui s'ouvre d'un
 * appui (à droite sur un ordinateur, en plein écran sur un téléphone),
 * Valider, Rejeter et Suivant de la même largeur.
 *
 * Elle ne décide de rien : ce qu'elle montre sort de `dossierParJeton`, la
 * lecture même du dossier du patron.
 */
function piece(l: LignePourLeComptable): PieceAffichee {
  if (l.justification === "ticket" && l.ticket) {
    const recopie = l.ticket.lignesImprimees;
    const total = recopie ? ligneDuTotal(recopie, l.ticket.totalTtc ? Number(l.ticket.totalTtc) : null) : -1;
    return {
      genre: "ticket",
      nom: l.ticket.fournisseur,
      date: jourComplet(l.ticket.dateAchat),
      total: l.ticket.totalTtc ? enEuros(l.ticket.totalTtc) : null,
      tva: enEuros(l.ticket.tvaDeductible),
      original: l.ticket.photoCle ? "photo" : null,
      lignes: recopie ? recopie.map((x, k) => ({ g: x.gauche, d: x.droite, surligne: k === total })) : null,
      totalSurUneLigne: total >= 0,
    };
  }
  if (l.justification === "facture" && l.factureRecue) {
    return {
      genre: "facture",
      nom: l.factureRecue.societe,
      detail: l.factureRecue.nom,
      total: l.factureRecue.totalTtc ? enEuros(l.factureRecue.totalTtc) : null,
      original: l.factureRecue.nature === "tableur" ? null : l.factureRecue.nature,
    };
  }
  if (l.factureEmise) return { genre: "emise", numero: l.factureEmise.numero };
  if (l.justification === "ticket_perdu") return { genre: "perdu" };
  if (l.justification === "motif" && l.motif) return { genre: "motif", libelle: LIBELLE_MOTIF[l.motif] };
  return { genre: "aucune" };
}

function etiquette(p: PieceAffichee): string {
  switch (p.genre) {
    case "ticket":
      return "Ticket";
    case "facture":
      return "Facture";
    case "emise":
      return `Facture ${p.numero}`;
    case "perdu":
      return "Ticket perdu";
    case "motif":
      return p.libelle;
    case "aucune":
      return "Aucune pièce";
  }
}

export default async function PageDuComptable({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const dossier = await dossierParJeton(jeton);

  if (!dossier) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6" style={{ backgroundColor: colors.cream, color: colors.ink }}>
        <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}` }}>
          <h1 className="text-[21px]" style={{ fontFamily: font.display }}>
            Ce lien n’est plus valable
          </h1>
          <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: colors.muted }}>
            Demandez un nouveau lien à votre client.
          </p>
        </div>
      </div>
    );
  }

  const lignes: LigneAVerifier[] = dossier.lignes.map((l) => {
    const p = piece(l);
    return {
      id: l.id,
      jour: l.jour,
      jourCourt: `${l.jour.slice(8, 10)}/${l.jour.slice(5, 7)}`,
      jourLong: jourComplet(l.jour),
      libelle: l.libelle || (l.contrepartie ?? ""),
      montant: `${l.sens === "entree" ? "+" : "−"}${enEuros(l.montant)}`,
      sens: l.sens,
      categorie: categorieDeLaLigne({ sens: l.sens, libelle: l.libelle, natureDuTicket: l.ticket?.nature ?? null, justification: l.justification }),
      piece: p,
      etiquette: etiquette(p),
      verification: l.verification,
    };
  });

  return (
    <Verification
      jeton={jeton}
      titre={`Dossier justifié, ${dossier.entreprise}`}
      periode={`Du ${jourComplet(dossier.du)} au ${jourComplet(dossier.au)}`}
      envoye={`Envoyé le ${jourEnMots(dossier.envoyeLe.toISOString().slice(0, 10))}`}
      entreprise={dossier.entreprise}
      lignes={lignes}
    />
  );
}
