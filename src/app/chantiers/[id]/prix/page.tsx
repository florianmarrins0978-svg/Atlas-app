import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { listerLignesPrix } from "@/server/repositories/lignes-prix";
import { preparerPropositionPrix } from "@/server/chiffrage/proposition-prix";
import PrixClient from "./PrixClient";

export const dynamic = "force-dynamic";

export default async function PrixPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saisie?: string }>;
}) {
  const { id } = await params;

  // Arrivée par « Écrire le devis » depuis l'écran Informations.
  // La proposition de prix est alors repliée : le patron a demandé cette voie
  // parce qu'il veut écrire lui-même, pas discuter une suggestion. Elle reste à
  // un geste de distance — la replier n'est pas la supprimer.
  const saisieManuelle = (await searchParams).saisie === "manuelle";

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  // La proposition est recalculée à chaque affichage, jamais mémorisée : elle
  // ne peut donc pas se désynchroniser des données qui la fondent. L'afficher
  // ne vaut aucune validation — rien n'est écrit tant que le patron n'a pas agi.
  const [lignes, proposition] = await Promise.all([
    listerLignesPrix(ctx, id),
    preparerPropositionPrix(ctx, id),
  ]);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      {/* La bulle de l'assistant est fixée en bas à droite : avec 64 px de
          talon, elle mordait sur le coin de « Préparer le devis ». Vu en
          capture, jamais par une suite — le bouton était bien là. */}
      <div className="pb-28">
        {/* **La flèche HÉRITE de celle de la fiche du chantier**, mot pour mot,
            depuis que celle-ci a disparu (4 septembre 2026, `ARCHITECTURE.md`
            §254). Cet écran était à un cran d'elle : il prend sa place, il
            n'invente pas une destination. */}
        <EnTeteEcran
          retour={{ href: "/", libelle: "Retour à la liste des chantiers" }}
          surtitre={chantier.nom}
          titre="Prix"
        />

        <PrixClient
          chantierId={id}
          initialLignes={lignes.map((l) => ({
            id: l.id,
            libelle: l.libelle,
            montant: l.montant,
            // **Sans lui, l'écran serait plus permissif que le serveur**, et le
            // bouton échouerait sans raison lisible : le message d'une exception
            // levée par une action serveur n'arrive jamais jusqu'au patron
            // (`AGENTS.md`). Il doit voir POURQUOI avant d'appuyer.
            aChiffrer: l.aChiffrer,
          }))}
          propositionInitiale={proposition}
          saisieManuelle={saisieManuelle}
        />
      </div>
    </div>
  );
}
