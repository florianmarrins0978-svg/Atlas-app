import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { decrireEtatIA, aFaireIA } from "@/lib/etat-ia";
import { getCurrentCtx } from "@/server/session-ctx";
import { getConfigIA } from "@/server/ai/config";
import { listerTarifs } from "@/server/repositories/tarifs";
import { getEntreprise } from "@/server/repositories/entreprises";
import { versionExecutee } from "@/server/version-executee";
import ReglagesClient from "./ReglagesClient";
import BoutonMiseAJour from "./BoutonMiseAJour";

export const dynamic = "force-dynamic";

export default async function ReglagesPage() {
  const ctx = await getCurrentCtx();
  const [tarifs, entreprise, version] = await Promise.all([listerTarifs(ctx), getEntreprise(ctx), versionExecutee()]);

  // Seuls les NOMS des fournisseurs traversent jusqu'à l'écran — jamais les
  // clés, qui n'ont rien à faire dans du HTML rendu.
  // Seuls les NOMS des variables renseignées traversent — jamais leurs valeurs.
  const config = getConfigIA();
  const clesPresentes = [
    config.anthropicApiKey ? "ANTHROPIC_API_KEY" : "",
    config.openaiApiKey ? "OPENAI_API_KEY" : "",
    config.geminiApiKey ? "GEMINI_API_KEY" : "",
    config.deepgramApiKey ? "DEEPGRAM_API_KEY" : "",
    config.googleApiKey ? "GOOGLE_API_KEY" : "",
  ].filter(Boolean);
  const etatsIA = decrireEtatIA(config.transcriptionProvider, config.llmProvider, clesPresentes);
  const aFaire = aFaireIA(etatsIA);

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

        {/*
          Qui écoute et qui rédige, dit à l'écran.

          Le patron a payé deux comptes, posé quatre clés, puis dicté — et
          l'application a continué à fabriquer ses réponses sans rien dire. Il a
          fallu qu'il pose la question pour l'apprendre. Un bloc que personne ne
          regarde tant que tout va bien, et qui répond en deux secondes le jour
          où l'on doute.
        */}
        <section className="px-6 pt-10">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Intelligence artificielle
          </p>
          <h2 className="text-[22px] leading-tight" style={{ fontFamily: font.display, marginBottom: 12 }}>
            Ce que l&apos;application utilise
          </h2>

          <div className="flex flex-col gap-3">
            {etatsIA.map((etat) => (
              <div
                key={etat.role}
                className="rounded-xl p-4"
                style={{
                  backgroundColor: colors.card,
                  // Un liseré n'apparaît que si quelque chose ne fait pas ce
                  // qu'on croit : tout va bien doit rester discret.
                  borderLeft: etat.nature === "reel" ? "none" : `3px solid ${colors.rust}`,
                }}
              >
                <p className="text-[13px]" style={{ color: colors.muted, marginBottom: 2 }}>
                  {etat.role}
                </p>
                <p className="text-[15px] font-medium" style={{ color: colors.ink }}>
                  {etat.libelle}
                </p>
                <p className="text-[13px] leading-snug" style={{ color: colors.inkSoft, marginTop: 6 }}>
                  {etat.explication}
                </p>
              </div>
            ))}
          </div>

          {/* Cette phrase disait l'inverse jusqu'au 6 août 2026 : « jamais par
              la seule présence d'une clé ». C'est précisément là que le patron
              s'est arrêté deux fois — clés posées, IA débranchée, et aucune
              raison affichée. Poser une clé suffit désormais ; les variables ne
              servent qu'à aller CONTRE (`ARCHITECTURE.md` §26). */}
          <p className="text-[12px] leading-snug" style={{ color: colors.muted, marginTop: 10 }}>
            {aFaire ??
              "Poser une clé suffit à brancher le fournisseur correspondant. Les variables TRANSCRIPTION_PROVIDER et LLM_PROVIDER ne servent qu'à forcer un autre choix — par exemple « dev » pour couper l'IA sans retirer les clés."}
          </p>
        </section>
        {/*
          Emporter ses données, en un appui.

          Le patron a perdu ses chantiers une fois, en supprimant l'espace de
          travail — sur mon conseil, deux fois donné. Il a ensuite posé la
          question qui compte avant de nourrir l'agent : « le jour où je mets ça
          en ligne, est-ce que je perds toute la mémoire ? » Tant qu'il ne peut
          pas récupérer ses données lui-même, la réponse honnête reste « peut-
          être », et il a raison de ne rien vouloir saisir. Ce lien est la
          réponse : un fichier, sur son téléphone, sans terminal ni compte.

          Un lien et non un bouton : un téléchargement n'a pas à passer par une
          action serveur (voir la route, et CLAUDE.md §5).
        */}
        <section className="px-6 pt-10">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Mes données
          </p>
          <h2 className="text-[22px] leading-tight" style={{ fontFamily: font.display, marginBottom: 12 }}>
            En garder une copie
          </h2>

          <a
            href="/api/mes-donnees"
            download
            className="inline-block rounded-xl px-5 py-3 text-[15px] font-medium"
            style={{ backgroundColor: colors.rust, color: colors.cream }}
          >
            Télécharger mes données
          </a>

          <p className="text-[13px] leading-snug" style={{ color: colors.inkSoft, marginTop: 10 }}>
            Un seul fichier, qui contient vos clients, vos chantiers, vos devis, vos factures, vos photos et vos
            enregistrements. Il s&apos;ouvre sans Atlas.
          </p>
          <p className="text-[12px] leading-snug" style={{ color: colors.muted, marginTop: 8 }}>
            Il contient les coordonnées de vos clients : à ranger comme un dossier client. La sauvegarde automatique,
            elle, attend le choix d&apos;un hébergement — sans destination extérieure, elle ne protégerait de rien.
          </p>
        </section>

        {/* La version exécutée, en bas et discrète.
            Elle existe pour une raison précise : le patron a réessayé, un jour
            plus tard, des correctifs livrés la veille, sur un espace de travail
            qui n'avait jamais récupéré le code neuf. Rien à l'écran ne le lui
            disait, et trois échanges ont été perdus à chercher un défaut déjà
            corrigé. Une capture de cet écran répond désormais à la question.

            Elle est lue DANS LE DÉPÔT servi, jamais dans une variable posée au
            démarrage : le 7 août 2026 elle affichait encore « inconnue » sur un
            espace tout neuf, et elle serait de toute façon restée périmée après
            le bouton ci-dessous (voir `src/server/version-executee.ts`). */}
        <div className="px-6 pt-10">
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 4 }}>
            Version
          </p>
          <p className="text-[13px]" style={{ color: colors.muted }}>
            {version ?? "inconnue — cette installation n'annonce pas sa version."}
          </p>
          {/* Sur le banc d'essai seulement : une application déployée ne va pas
              chercher son propre code, ce serait une porte d'entrée. */}
          {process.env.ATLAS_BANC_ESSAI === "1" && <BoutonMiseAJour />}
        </div>
      </div>
    </div>
  );
}
