import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estEditeur } from "@/server/editeur";
import { listerTermesMetier } from "@/server/repositories/termes-metier";
import VocabulaireClient from "./VocabulaireClient";

export const dynamic = "force-dynamic";

/**
 * « Mon vocabulaire » — l'écran de l'éditeur.
 *
 * Le patron, le 7 août 2026 : *« est-ce que je pourrais pas avoir accès à une
 * page que seul le développeur peut voir, un truc du genre le langage de
 * l'artisanat pour l'IA, et moi dedans je rentre tous les mots techniques qu'on
 * utilise et leur définition, pour qu'elle apprenne plus vite ? »*
 *
 * **`notFound()` plutôt qu'un message de refus.** Une page qui répond « accès
 * refusé » annonce son existence : elle apprend à qui n'y a pas droit qu'il y a
 * quelque chose à trouver. Ici, pour tout autre compte, l'adresse n'existe tout
 * simplement pas.
 *
 * La garde est **côté serveur**, avant toute lecture. Masquer le lien dans les
 * réglages n'aurait rien protégé : l'adresse se tape.
 */
export default async function VocabulairePage() {
  const ctx = await getCurrentCtx();
  if (!(await estEditeur(ctx))) notFound();

  const termes = await listerTermesMetier({ inclureInactifs: true });

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        {/* **L'EN-TÊTE COMMUNE DEPUIS LE 6 SEPTEMBRE 2026** (`ARCHITECTURE.md`
            §263). Le retour ramène à Atlas IA, d'où l'on vient — même défaut
            que « Mes prix », signalé le 17 août 2026.

            **« Réservé à l'éditeur » descend en PRÉCISION, il ne disparaît
            pas.** Le surtitre doré dit d'où l'on vient ; ce mot-là dit qui a le
            droit d'être là, et c'est une autre chose. Le perdre au passage
            aurait été payer une mise en ordre par une perte d'information. */}
        <EnTeteEcran
          surtitre="Atlas IA"
          titre="Mon vocabulaire"
          precision="Réservé à l'éditeur"
          retour={{ href: "/reglages/ia", libelle: "Retour à Atlas IA" }}
        />

        <div className="px-[26px] pt-4">
          <p className="text-[14px] leading-snug" style={{ color: colors.muted }}>
            Ce que vous écrivez ici part avec <strong>chaque dictée</strong>, pour qu&apos;Atlas comprenne du premier
            coup au lieu qu&apos;on le rattrape après. Ces mots et ces règles accompagnent l&apos;application chez tous
            vos clients — ils ne contiennent aucune donnée de client, c&apos;est ce qui les rend partageables.
          </p>
        </div>

        <VocabulaireClient
          initiaux={termes.map((t) => ({
            id: t.id,
            nature: t.nature,
            intitule: t.intitule,
            definition: t.definition,
            consigne: t.consigne,
            ordre: t.ordre,
            actif: t.actif,
          }))}
        />
      </div>
    </div>
  );
}
