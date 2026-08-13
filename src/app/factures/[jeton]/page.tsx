import { factureParJeton } from "@/server/repositories/envois-factures";
import { jourLisible } from "@/lib/jour";

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
    <div className="flex min-h-dvh items-center justify-center bg-[#F4EFE8] p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-[18px] font-semibold" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          {titre}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed opacity-70">{texte}</p>
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
    <div className="flex min-h-dvh items-center justify-center bg-[#F4EFE8] p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] opacity-50">Facture</p>
        <h1 className="mt-1 text-[20px] font-semibold" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          {facture.numeroCommercial}
        </h1>
        <p className="mt-1 text-[14px] opacity-70">{facture.entrepriseNom}</p>

        <p className="mt-6 text-[32px] font-semibold leading-none" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          {euros(facture.totalTtc)}
        </p>
        {facture.echeanceLe && (
          <p className="mt-2 text-[14px] opacity-70">À régler avant le {jourLisible(facture.echeanceLe)}</p>
        )}

        <a
          href={`/factures/${encodeURIComponent(jeton)}/pdf`}
          target="_blank"
          rel="noopener"
          className="mt-6 block rounded-full bg-[#8C4A2F] px-5 py-3 text-[15px] font-medium text-white"
        >
          Voir la facture en PDF
        </a>
      </div>
    </div>
  );
}
