import { notFound } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getClient } from "@/server/repositories/clients";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerLignesPrix } from "@/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, chargerDevisPourEcran } from "@/server/repositories/devis";
import DevisCompletClient from "./DevisCompletClient";

// Le devis écrit à la main, en entier.
//
// Le patron : « ça ouvre le fichier devis, le vrai ! Le fichier en entier, pas
// juste les lignes pour remplir les infos et les prix. » Cette page reprend
// `appli/devis-modele.html` champ pour champ — c'est aussi ce que reproduit le
// PDF (`ARCHITECTURE.md` §16), donc ce que son client recevra.
export const dynamic = "force-dynamic";

// Reprise telle quelle du PDF : une validité affichée qui différerait de celle
// imprimée serait un engagement faux.
const VALIDITE = "30 jours";

export default async function DevisCompletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  // Même règle que l'écran Devis : un devis déjà envoyé se relit tel quel, en
  // lecture seule — le consulter ne doit jamais ouvrir une nouvelle version.
  const devisRow = (await chargerDevisPourEcran(ctx, id)) ?? (await getOuCreerDevisBrouillon(ctx, id));

  const [entreprise, client, lignes] = await Promise.all([
    getEntreprise(ctx),
    chantier.clientId ? getClient(ctx, chantier.clientId) : Promise.resolve(null),
    listerLignesPrix(ctx, id),
  ]);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="px-6 pt-8">
        <a
          href={`/chantiers/${id}`}
          aria-label="Retour à la fiche du chantier"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.rustTint }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>

      <div className="px-6 pt-5">
        <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
          {chantier.nom}
        </p>
        <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
          Le devis, en entier
        </h1>
        <p className="pt-3 text-[13px]" style={{ color: colors.muted }}>
          Le document tel que votre client le recevra. Tout se modifie ici, et tout s&apos;enregistre au fur et à
          mesure.
        </p>
      </div>

      <DevisCompletClient
        chantierId={id}
        devisId={devisRow.id}
        numeroCommercial={devisRow.numeroCommercial}
        dateEmission={devisRow.dateEmission}
        validite={VALIDITE}
        statut={devisRow.statut as "brouillon" | "envoye"}
        emetteur={{
          nom: entreprise?.nom ?? "",
          adresse: entreprise?.adresse ?? "",
          siret: entreprise?.siret ?? "",
          telephone: entreprise?.telephone ?? "",
          email: entreprise?.email ?? "",
          iban: entreprise?.iban ?? "",
        }}
        clientId={chantier.clientId ?? null}
        client={{
          nom: client?.nom ?? "",
          adresse: client?.adresse ?? "",
          telephone: client?.telephone ?? "",
          email: client?.email ?? "",
        }}
        adresseChantier={chantier.adresseChantier ?? ""}
        lignesInitiales={lignes.map((l) => ({
          id: l.id,
          libelle: l.libelle,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          montant: l.montant,
        }))}
        tauxTva={devisRow.tauxTva}
        conditionsPaiement={devisRow.conditionsPaiement ?? ""}
      />
    </div>
  );
}
