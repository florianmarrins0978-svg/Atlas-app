import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerTarifs } from "@/server/repositories/tarifs";
import { getEntreprise } from "@/server/repositories/entreprises";
import { getEnv } from "@/server/env";
import { etatIA } from "@/server/ai/diagnostic";
import ReglagesClient from "./ReglagesClient";

export const dynamic = "force-dynamic";

export default async function ReglagesPage() {
  const ctx = await getCurrentCtx();
  const [tarifs, entreprise] = await Promise.all([listerTarifs(ctx), getEntreprise(ctx)]);
  const version = getEnv().versionAffichee;
  const ia = etatIA();

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <div className="px-6 pt-8">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Mon entreprise
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Réglages
          </h1>
        </div>

        <ReglagesClient
          initialTarifs={tarifs.map((t) => ({ id: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite }))}
          initialNombreEquipes={entreprise?.nombreEquipes ?? 1}
        />

        <div className="px-6 pt-8">
          <Link href="/catalogue" className="text-[14px] font-medium" style={{ color: colors.rust }}>
            Voir le catalogue des prestations et matériels →
          </Link>
        </div>

        {/* **L'IA est-elle branchée ?** Écrit ici pour la même raison que la
            version juste en dessous : la question s'est posée, et il a fallu
            lire quatre fichiers du dépôt pour y répondre. Le patron avait posé
            ses clés, l'application n'en tenait aucun compte, et rien à l'écran
            ne le disait. Une capture de cet écran tranche désormais. */}
        <div className="px-6 pt-10">
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 4 }}>
            Intelligence artificielle
          </p>
          <p className="text-[13px]" style={{ color: ia.toutBranche ? colors.ink : colors.rust }}>
            {ia.resume}
          </p>
          {/* Ce qui manque, nommément — mais une seule fois. Répéter « aucune
              clé n'est configurée » pour chacun des deux rôles était exact et
              inutile : c'est le geste à faire qui manquait. Les motifs par rôle
              ne reparaissent donc que lorsqu'ils désignent quelque chose de
              précis : une variable absente, un nom fautif, une ébauche. */}
          {ia.aFaire ? (
            <p className="text-[12px]" style={{ color: colors.muted, marginTop: 4 }}>
              {ia.aFaire}
            </p>
          ) : (
            [ia.transcription, ia.redaction]
              .filter((r) => !r.branche && r.motif)
              .map((r) => (
                <p key={r.role} className="text-[12px]" style={{ color: colors.muted, marginTop: 4 }}>
                  {r.role === "transcription" ? "Transcription" : "Rédaction"} — {r.motif}
                </p>
              ))
          )}
        </div>

        {/* La version exécutée, en bas et discrète.
            Elle existe pour une raison précise : le patron a réessayé, un jour
            plus tard, des correctifs livrés la veille, sur un espace de travail
            qui n'avait jamais récupéré le code neuf. Rien à l'écran ne le lui
            disait, et trois échanges ont été perdus à chercher un défaut déjà
            corrigé. Une capture de cet écran répond désormais à la question. */}
        <div className="px-6 pt-10">
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 4 }}>
            Version
          </p>
          <p className="text-[13px]" style={{ color: colors.muted }}>
            {version ?? "inconnue — cette installation n'annonce pas sa version."}
          </p>
        </div>
      </div>
    </div>
  );
}
