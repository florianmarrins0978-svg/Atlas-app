import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import Paquet from "@/components/atlas/reglages/Paquet";
import LigneReglage, { styleValeurReglage } from "@/components/atlas/reglages/LigneReglage";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import { colors, font } from "@/lib/design-tokens";
import {
  decrireEtatIA,
  decrireVision,
  aFaireIA,
  ceQuAtlasSaitFaire,
  type EtatFournisseur,
} from "@/lib/etat-ia";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getConfigIA } from "@/server/ai/config";
import { estEditeur } from "@/server/editeur";
import RubriqueReservee from "../RubriqueReservee";
import { garderLaPage } from "@/server/garde-page";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import Picto, { type NomPicto } from "@/components/atlas/reglages/Picto";

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
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Atlas IA"
        // **« … et ce qu'ils coûtent » est parti le 26 octobre 2026** : aucun
        // coût ne s'affiche sur cet écran, la phrase promettait une page qui
        // n'existe pas (relevé sur la planche des Réglages soignés).
        quoi="L'état des fournisseurs regarde celui qui les paie."
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
  const savoirs = ceQuAtlasSaitFaire(etatsIA);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran
          allure="soignee"
          titre="Atlas IA"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />

        {/* **CE QU’ATLAS SAIT FAIRE, et rien d’autre — 9 septembre 2026.**

            L’écran affichait « Mode déterministe — aucun prestataire branché »,
            deux fois, puis les noms de trois variables d’environnement. Écrit
            pour un développeur, montré à un artisan. Sa consigne du 5 septembre
            vaut ici comme partout : ces gens-là ont du mal avec leur téléphone.

            Un artisan se pose UNE question devant cet écran — est-ce que ça
            marche ? La règle qui y répond vit dans `ceQuAtlasSaitFaire`, pas
            ici : l’écran ne décide de rien.

            **Chacune a son dessin et son état écrit sous le texte** (planche
            des Réglages soignés, 26 octobre 2026) : « Oui » sur une pastille
            verte, « Pas encore » en gris, à la place de capitales espacées de
            11 px posées à droite. Le dessin suit le RÔLE, jamais le libellé :
            « Lire vos croquis » peut changer de mots, il reste la lecture
            d’image. */}
        <Paquet titre="Ce qu&apos;Atlas sait faire">
          {etatsIA.map((etat) => {
            const [s] = ceQuAtlasSaitFaire([etat]);
            return (
              <div key={etat.role} className="relative flex min-h-[76px] items-center gap-3.5 py-3">
                <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
                <PastilleIcone ton={s.marche ? "vert" : undefined}>
                  <Picto nom={DESSIN_DU_ROLE[etat.role]} />
                </PastilleIcone>
                <span className="min-w-0 flex-1">
                  <span className="block text-[19px] leading-[1.25]" style={{ fontFamily: font.display }}>
                    {s.quoi}
                  </span>
                  <span className="mt-[3px] block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                    {s.precision}
                  </span>
                  {/* **« Pas encore », jamais « non ».** Ce n’est pas un refus :
                      c’est un branchement qui n’a pas encore été fait, et il n’a
                      rien à faire pour l’obtenir. */}
                  <span className="mt-2 block">
                    <EtatEcrit ton={s.marche ? "vert" : undefined} dataAtlas="savoir-faire">
                      {s.marche ? "Oui" : "Pas encore"}
                    </EtatEcrit>
                  </span>
                </span>
              </div>
            );
          })}
        </Paquet>

        {/* **Ce qu’il peut faire, et c’est RIEN.** Un artisan ne posera jamais
            une clé d’API : lui dire ce qui manque le renverrait chercher un
            interlocuteur qui n’existe pas. La phrase le rassure et s’arrête là ;
            sur une plage bleue, une information, et non plus en 12 px gris. */}
        {savoirs.some((s) => !s.marche) && (
          <div className="mx-[22px] mt-2">
            <PlageTon ton="bleu">Rien à faire de votre côté : c&apos;est nous qui le branchons.</PlageTon>
          </div>
        )}

        {/* **LE DÉTAIL TECHNIQUE, DERRIÈRE LA PORTE DE L’ÉDITEUR.**

            Il vivait à ciel ouvert : tout propriétaire lisait
            « TRANSCRIPTION_PROVIDER » et l’exemple « dev ». C’est exactement ce
            qu’il refusait le 7 août 2026 — « est-ce que les utilisateurs auront
            accès à cette page ? Moi c’est ça que je ne veux pas. » Il ne disparaît
            pas pour autant : c’est lui qui répond, en deux secondes, le jour où
            l’on doute d’un branchement.

            **Une plage, une ligne par rôle** (planche du 26 octobre 2026). Ce
            qui ne fait pas ce qu’on croit (simulé, clé absente, raccordement
            non écrit) se dit en ambre, la couleur de ce qui reste à faire,
            comme partout dans les Réglages. */}
        {editeur && (
          <>
            <Paquet titre="Ce que l&apos;application utilise">
              {etatsIA.map((etat) => (
                <LigneReglage key={etat.role} libelle={etat.role} manque={etat.nature !== "reel"} sous={etat.explication}>
                  <span className="block" style={{ ...styleValeurReglage, fontSize: 19 }}>
                    {etat.libelle}
                  </span>
                </LigneReglage>
              ))}
            </Paquet>
            <p className="mx-[24px] mt-2.5 text-[13.5px] leading-[1.5]" style={{ color: colors.inkSoft }}>
              {aFaire ?? (
                <>
                  Poser une clé suffit à brancher le fournisseur correspondant. Les variables{" "}
                  <code className="font-mono text-[13px]">TRANSCRIPTION_PROVIDER</code>,{" "}
                  <code className="font-mono text-[13px]">LLM_PROVIDER</code> et{" "}
                  <code className="font-mono text-[13px]">VISION_PROVIDER</code> ne servent qu’à forcer un autre
                  choix, par exemple « dev » pour couper l’IA sans retirer les clés. Sans{" "}
                  <code className="font-mono text-[13px]">VISION_PROVIDER</code>, les images vont chez celui qui
                  rédige.
                </>
              )}
            </p>

            {/* **Le vocabulaire du métier — l'éditeur seulement.**
                Le patron, le 7 août 2026 : « est-ce que les utilisateurs auront
                accès à cette page ? Moi c'est ça que je ne veux pas. » Ce renvoi
                n'apparaît que pour lui — et la page elle-même refuse tout autre
                compte, parce qu'une adresse se tape (`src/server/editeur.ts`).

                Il est RANGÉ ICI, et non plus au milieu des réglages : ce vocabulaire
                est ce que l'IA sait reconnaître d'une dictée. Le laisser entre les
                tarifs et l'agenda le rendait introuvable. */}
            <Paquet titre="Ce qu&apos;elle sait reconnaître">
              <Link href="/reglages/vocabulaire" className="flex min-h-[76px] w-full items-center gap-3.5 py-3">
                <PastilleIcone>
                  <Picto nom="note" />
                </PastilleIcone>
                <span className="min-w-0 flex-1">
                  <span className="block text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                    Mon vocabulaire
                  </span>
                  <span className="mt-[3px] block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                    Les mots qu&apos;Atlas rattache à une prestation quand vous dictez.
                  </span>
                </span>
                <span style={{ color: colors.chevron }}>
                  <Picto nom="suivant" taille={20} epaisseur={2} />
                </span>
              </Link>
            </Paquet>
          </>
        )}
      </div>
    </div>
  );
}

/** Le dessin de chaque rôle : le micro écoute, le crayon rédige, l'appareil photo regarde. */
const DESSIN_DU_ROLE: Record<EtatFournisseur["role"], NomPicto> = {
  Transcription: "micro",
  Rédaction: "crayon",
  "Lecture d’image": "photo",
};
