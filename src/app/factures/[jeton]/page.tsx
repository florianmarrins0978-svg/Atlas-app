import { factureParJeton } from "@/server/repositories/envois-factures";
import { jourLisible } from "@/lib/jour";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
import { colors, surPlein } from "@/lib/design-tokens";

// **Aux couleurs de l'application — sa demande du 25 août 2026.** La page portait
// des couleurs écrites en dur (une terre cuite abandonnée le 3 août pour le bouton)
// qui n'étaient plus celles du produit. On passe par les jetons de la charte
// (`design-tokens`), qui retombent sur la charte d'Arborea par défaut ici, faute
// de session — c'est exactement « la couleur de l'application » (`CLAUDE.md` §3,
// aucune couleur en clair dans un écran).
const SERIF = "ui-serif, Georgia, serif";

// La page que voit le client quand il touche le lien de sa facture.
//
// Elle existe parce que rien ne portait la facture jusqu'à lui : l'écran du
// patron annonçait « facture arrêtée », il a compris « facture partie », et son
// client n'a jamais rien reçu (6 août 2026).
//
// Pourquoi une page plutôt que le PDF directement : un lien qui ouvre un PDF
// nu, sur un téléphone, ne dit ni de qui il vient ni ce qu'il faut en faire —
// et un lien périmé y répond par une erreur brute. Ici, le client reconnaît sa
// facture avant de la télécharger.
//
// `force-dynamic` est impératif : une mise en cache exposerait la facture d'un
// client à un autre visiteur.
export const dynamic = "force-dynamic";

// Une facture n'a rien à faire dans un moteur de recherche.
export const metadata = { robots: { index: false, follow: false } };

const euros = (montant: string) =>
  `${Number(montant).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function Cadre({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center p-6"
      style={{ backgroundColor: colors.cream, color: colors.ink }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 text-center shadow-sm"
        style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}` }}
      >
        <h1 className="text-[18px] font-semibold" style={{ fontFamily: SERIF }}>
          {titre}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: colors.muted }}>
          {texte}
        </p>
      </div>
    </div>
  );
}

export default async function PageFactureClient({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const facture = await factureParJeton(jeton);

  // Lien inconnu et lien expiré donnent le même message : distinguer les deux
  // apprendrait à un visiteur au hasard qu'un jeton a existé.
  if (!facture) {
    return (
      <Cadre
        titre="Ce lien n'est plus valable"
        texte="Contactez votre artisan pour en recevoir un nouveau."
      />
    );
  }

  return (
    <div
      className="flex min-h-dvh items-center justify-center p-6"
      style={{ backgroundColor: colors.cream, color: colors.ink }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 text-center shadow-sm"
        style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}` }}
      >
        <p
          className="text-[12px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: colors.muted }}
        >
          Facture
        </p>
        <h1 className="mt-1 text-[20px] font-semibold" style={{ fontFamily: SERIF }}>
          <NumeroDeDocument valeur={facture.numeroCommercial} />
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: colors.muted }}>
          {facture.entrepriseNom}
        </p>

        <p className="mt-6 text-[32px] font-semibold leading-none" style={{ fontFamily: SERIF }}>
          {euros(facture.totalTtc)}
        </p>
        {facture.echeanceLe && (
          <p className="mt-2 text-[14px]" style={{ color: colors.muted }}>
            À régler avant le {jourLisible(facture.echeanceLe)}
          </p>
        )}

        {/* Deux gestes : consulter, et GARDER. Sa demande du 25 août — « un
            bouton pour que le client puisse télécharger sa facture ». « Voir »
            ouvre le PDF ; « Télécharger » le range (l'en-tête `attachment` du
            `?telecharger=1` décide, l'attribut `download` ne suffit pas sur iOS). */}
        <a
          href={`/factures/${encodeURIComponent(jeton)}/pdf`}
          target="_blank"
          rel="noopener"
          className="mt-6 block rounded-full px-5 py-3 text-[15px] font-medium"
          style={{ backgroundColor: colors.rust, color: surPlein }}
        >
          Voir la facture en PDF
        </a>
        <a
          href={`/factures/${encodeURIComponent(jeton)}/pdf?telecharger=1`}
          download
          className="mt-3 block rounded-full px-5 py-3 text-[15px] font-medium"
          style={{ color: colors.rust, boxShadow: `inset 0 0 0 1px ${colors.rust}` }}
        >
          Télécharger ma facture
        </a>
      </div>
    </div>
  );
}
