import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estEditeur } from "@/server/editeur";
import { listerTermesMetier } from "@/server/repositories/termes-metier";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import VocabulaireClient from "./VocabulaireClient";
import { garderLaPage } from "@/server/garde-page";

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
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estEditeur(ctx))) notFound();

  const termes = await listerTermesMetier({ inclureInactifs: true });

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        {/* **L'EN-TÊTE COMMUNE DEPUIS LE 6 SEPTEMBRE 2026** (`ARCHITECTURE.md`
            §263). Le retour ramène à Atlas IA, d'où l'on vient — même défaut
            que « Mes prix », signalé le 17 août 2026.

            **« Réservé à l'éditeur » reste, cerné d'or sous le titre** (planche
            des Réglages soignés, 26 octobre 2026). Ce mot-là dit qui a le droit
            d'être là : le perdre au passage aurait payé une mise en ordre par
            une perte d'information. */}
        <EnTeteEcran
          allure="soignee"
          titre="Mon vocabulaire"
          precision={<EtatEcrit ton="or">{"Réservé à l'éditeur"}</EtatEcrit>}
          retour={{ href: "/reglages/ia", libelle: "Retour à Atlas IA" }}
        />

        {/* **Une phrase en tête, le partage sur une plage bleue** (même
            planche) : « pour qu'Atlas comprenne du premier coup au lieu qu'on
            le rattrape après » est parti, le reste se lit en deux temps au lieu
            d'un paragraphe gris de quatre lignes. */}
        <p className="mx-[22px] mt-3.5 text-[16px] leading-[1.5]" style={{ color: colors.ink }}>
          Ce que vous écrivez ici part avec <strong>chaque dictée</strong>.
        </p>
        <div className="mx-[22px] mt-3.5">
          <PlageTon ton="bleu">
            Ces mots et ces règles accompagnent l&apos;application chez tous vos clients. Ils ne contiennent aucune
            donnée de client, c&apos;est ce qui les rend partageables.
          </PlageTon>
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
