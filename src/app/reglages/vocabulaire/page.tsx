import Link from "next/link";
import { notFound } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estEditeur } from "@/server/editeur";
import { listerTermesMetier } from "@/server/repositories/termes-metier";
import VocabulaireClient from "./VocabulaireClient";

export const dynamic = "force-dynamic";

/**
 * « Le vocabulaire de mon métier » — l'écran de l'éditeur.
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
        <div className="px-6 pt-8">
          {/* Même défaut que « Mes prix », signalé le 17 août 2026 : cet écran
              ne s'atteint que depuis Atlas IA, et sa flèche renvoyait à la
              racine des réglages. */}
          <Link
            href="/reglages/ia"
            aria-label="Retour à Atlas IA"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Réservé à l&apos;éditeur
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Le vocabulaire de mon métier
          </h1>
          <p className="mt-3 text-[14px] leading-snug" style={{ color: colors.muted }}>
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
