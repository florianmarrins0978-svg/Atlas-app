import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { ligneDuTotal } from "@/lib/ticket-imprime";
import { libelleMotif, categorieDeLaLigne, ecartSignale, jourComplet, jourEnMots, suiteDeLaPiece } from "@/lib/pour-mon-comptable";
import { dossierParJeton, type LignePourLeComptable } from "@/server/repositories/verification-comptable";
import Verification, { type LigneAVerifier, type PieceAffichee } from "./Verification";
import { jourIso } from "@/lib/jour";
import { garderLaPage } from "@/server/garde-page";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dossier justifié", robots: { index: false, follow: false } };

/**
 * LA PAGE DU COMPTABLE — écran 7 de `appli/pour-mon-comptable.html`, ses choix
 * du 24 octobre 2026 : le montant à gauche, le justificatif qui s'ouvre d'un
 * appui (à droite sur un ordinateur, en plein écran sur un téléphone),
 * Valider, Rejeter et Suivant de la même largeur. Refaite sur sa planche du
 * 25 octobre (`appli/soignee/comptable-verification.html`).
 *
 * Elle ne décide de rien : ce qu'elle montre sort de `dossierParJeton`, la
 * lecture même du dossier du patron.
 *
 * **La pièce montrée est celle de la JUSTIFICATION d'abord**, la facture
 * d'Atlas confirmée seulement quand rien d'autre ne justifie la ligne : c'est
 * l'ordre dans lequel `lireLesLignes` compare les montants. Montrer la facture
 * d'Atlas au-dessus de l'écart d'une autre pièce dirait au comptable que
 * l'écart porte sur elle.
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
  if (l.justification === "facture_hors_atlas" && l.pieceJointe) {
    // Un total illisible reste vide (`joindreFactureHorsAtlas`) : il s'écrit
    // « non lu », jamais deviné.
    return { genre: "hors_atlas", sortie: l.sens === "sortie", total: l.pieceJointe.total ? enEuros(l.pieceJointe.total) : null, original: l.pieceJointe.nature };
  }
  if (l.justification === "ticket_perdu") return { genre: "perdu" };
  if (l.justification === "motif" && l.motif) return { genre: "motif", libelle: libelleMotif(l.motif, l.sens) };
  if (l.factureEmise) return { genre: "emise", numero: l.factureEmise.numero, total: enEuros(l.factureEmise.totalTtc) };
  return { genre: "aucune" };
}

/** Le mot du bouton de la liste. */
function etiquette(p: PieceAffichee): string {
  switch (p.genre) {
    case "ticket":
      return "Ticket";
    case "facture":
      return "Facture";
    case "hors_atlas":
      return p.sortie ? "Facture du fournisseur" : "Facture faite hors d’Atlas";
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

/** Ce que le bouton ne dit pas du nom de la pièce : son fournisseur. */
function complementDuNom(p: PieceAffichee): string {
  return p.genre === "ticket" || p.genre === "facture" ? p.nom : "";
}

/**
 * L'écart en deux longueurs. Sous la pièce ouverte, la phrase entière
 * (« Facture Motoculture Ouest de 1 386,40 €, pas le montant ») ; sous le
 * bouton de la liste, ce qui suit son mot (« Motoculture Ouest de… »,
 * « payée en partie ») : « Facture F-2026-012 » redit dessous était du bruit.
 */
function ecartAffiche(p: PieceAffichee, suite: string, signale: boolean): LigneAVerifier["ecart"] {
  if (!suite) return null;
  const complement = complementDuNom(p);
  return {
    phrase: `${etiquette(p)}${complement ? ` ${complement}` : ""}${suite}`,
    suite: `${complement}${suite}`.replace(/^[\s,]+/, ""),
    signale,
  };
}

export default async function PageDuComptable({
  params,
  searchParams,
}: {
  params: Promise<{ jeton: string }>;
  searchParams: Promise<{ apercu?: string }>;
}) {
  await garderLaPage();
  const { jeton } = await params;
  // Le patron qui « voit la page qu'il ouvre » arrive avec `?apercu=1` : il a
  // alors un bouton Fermer vers ses dossiers. Le comptable, lui, ouvre
  // l'adresse nue et n'a rien à fermer (sa remarque du 27 octobre 2026).
  const apercu = (await searchParams).apercu === "1";
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
    // La phrase et son signal sortent des règles du relevé et du dossier
    // (`suiteDeLaPiece`, `ecartSignale`) : le comptable lit l'écart dans les
    // mots où le patron l'a accepté, avant de valider.
    const ecart = ecartAffiche(p, suiteDeLaPiece(l.ecart, l.sens), ecartSignale(l.ecart, l.sens));
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
      ecart,
      verification: l.verification,
    };
  });

  return (
    <Verification
      jeton={jeton}
      titre={`Dossier justifié, ${dossier.entreprise}`}
      periode={`Du ${jourComplet(dossier.du)} au ${jourComplet(dossier.au)}`}
      envoye={`Envoyé le ${jourEnMots(jourIso(dossier.envoyeLe))}`}
      entreprise={dossier.entreprise}
      lignes={lignes}
      apercu={apercu}
    />
  );
}
