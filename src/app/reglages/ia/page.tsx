import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { decrireEtatIA, decrireVision, aFaireIA } from "@/lib/etat-ia";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getConfigIA } from "@/server/ai/config";
import { estEditeur } from "@/server/editeur";
import RubriqueReservee from "../RubriqueReservee";

export const dynamic = "force-dynamic";

/**
 * « Atlas IA » — qui écoute, qui rédige, et ce qui manque pour que ça marche.
 *
 * **Ce bloc existe parce que le patron a payé deux comptes, posé quatre clés,
 * puis dicté — et l'application a continué à fabriquer ses réponses sans rien
 * dire.** Il a fallu qu'il pose la question pour l'apprendre. Personne ne le
 * regarde tant que tout va bien ; il répond en deux secondes le jour où l'on
 * doute.
 *
 * **Seuls les NOMS des fournisseurs et des variables renseignées traversent
 * jusqu'à l'écran** — jamais les clés, qui n'ont rien à faire dans du HTML
 * rendu, ni leurs valeurs.
 */
export default async function IAPage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Atlas IA"
        quoi="L'état des fournisseurs et ce qu'ils coûtent regardent celui qui les paie."
      />
    );
  }

  const editeur = await estEditeur(ctx);
  const config = getConfigIA();
  const clesPresentes = [
    config.anthropicApiKey ? "ANTHROPIC_API_KEY" : "",
    config.openaiApiKey ? "OPENAI_API_KEY" : "",
    config.geminiApiKey ? "GEMINI_API_KEY" : "",
    config.deepgramApiKey ? "DEEPGRAM_API_KEY" : "",
    config.googleApiKey ? "GOOGLE_API_KEY" : "",
  ].filter(Boolean);
  // **Trois rôles, pas deux** — sa question du 21 août : « va voir ce qu'il y a
  // de posé et dis-moi si c'est bon ou s'il faut rajouter une clé ». L'écran
  // nommait qui écoute et qui rédige, jamais qui REGARDE — alors que c'est un
  // réglage à part depuis `VISION_PROVIDER`, et que c'est lui qui décide si un
  // croquis d'arrosage sera lu.
  const etatsIA = [
    ...decrireEtatIA(config.transcriptionProvider, config.llmProvider, clesPresentes),
    decrireVision(config.visionProvider, clesPresentes),
  ];
  const aFaire = aFaireIA(etatsIA);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran
          surtitre="Réglages"
          titre="Atlas IA"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />

        <section className="mx-[26px] mt-[26px]">
          <p className={`mb-[10px] ${libelleCaps}`} style={{ color: colors.muted }}>
            Ce que l&apos;application utilise
          </p>

          <div className="flex flex-col gap-3">
            {etatsIA.map((etat) => (
              <div
                key={etat.role}
                className="rounded-[4px] p-4"
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
          <p className="mt-[10px] text-[12px] leading-snug" style={{ color: colors.muted }}>
            {aFaire ??
              "Poser une clé suffit à brancher le fournisseur correspondant. Les variables TRANSCRIPTION_PROVIDER, LLM_PROVIDER et VISION_PROVIDER ne servent qu'à forcer un autre choix — par exemple « dev » pour couper l'IA sans retirer les clés. Sans VISION_PROVIDER, les images vont chez celui qui rédige."}
          </p>
        </section>

        {/* **Le vocabulaire du métier — l'éditeur seulement.**
            Le patron, le 7 août 2026 : « est-ce que les utilisateurs auront
            accès à cette page ? Moi c'est ça que je ne veux pas. » Ce renvoi
            n'apparaît que pour lui — et la page elle-même refuse tout autre
            compte, parce qu'une adresse se tape (`src/server/editeur.ts`).

            Il est RANGÉ ICI, et non plus au milieu des réglages : ce vocabulaire
            est ce que l'IA sait reconnaître d'une dictée. Le laisser entre les
            tarifs et l'agenda le rendait introuvable. */}
        {editeur && (
          <section className="mx-[26px] mt-[30px] border-t pt-[18px]" style={{ borderColor: colors.line }}>
            <p className={`mb-[10px] ${libelleCaps}`} style={{ color: colors.muted }}>
              Ce qu&apos;elle sait reconnaître
            </p>
            <Link href="/reglages/vocabulaire" className="flex min-h-[56px] w-full items-center gap-[15px] py-[13px]">
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                  Le vocabulaire de mon métier
                </span>
                <span className="mt-[3px] block text-[11.5px] leading-[1.5]" style={{ color: colors.muted }}>
                  Les mots qu&apos;Atlas rattache à une prestation quand vous dictez.
                </span>
              </span>
              <span
                aria-hidden="true"
                className="h-2 w-2 rotate-45"
                style={{
                  flex: "none",
                  borderRight: `1.5px solid ${colors.chevron}`,
                  borderTop: `1.5px solid ${colors.chevron}`,
                }}
              />
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
