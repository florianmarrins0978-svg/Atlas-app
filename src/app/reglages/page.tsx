import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getRole } from "@/server/autorisation";
import { rubriquesReglages, surtitreReglages } from "@/lib/rubriques-reglages";
import { versionEtRetard } from "@/server/version-executee";
import { etatVersionLente } from "@/server/etat-banc";
import { panneauVersionLente } from "@/lib/version-lente";
import BoutonMiseAJour from "./BoutonMiseAJour";
import Sommaire from "./Sommaire";
import { derniereIssueMiseAJour } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Les réglages — un SOMMAIRE, et rien d'autre.
 *
 * **Refondu le 14 août 2026, à sa demande** : *« je veux que tu recrées
 * entièrement la page de réglage »*, d'après une planche qu'il avait envoyée la
 * veille — dix rubriques, une icône chacune. Avant cela, cet écran était une
 * page à défilement où s'empilait tout ce qui n'avait trouvé sa place nulle
 * part : les tarifs, les équipes du planning, la TVA, l'état de l'IA, le
 * téléchargement des données, la version. Chaque nouveau réglage l'allongeait,
 * et l'on finissait par faire défiler quatre écrans pour changer un prix.
 *
 * **Ce qui existait n'a pas été jeté : il a été RANGÉ** (`ARCHITECTURE.md`
 * §96). Chaque bloc est parti dans sa rubrique — les tarifs et les grilles de
 * prix ensemble parce que ce sont deux façons de dire le même prix, la
 * périodicité de TVA avec le régime de TVA parce que les séparer laissait deux
 * réglages fiscaux à deux endroits, les équipes du planning dans le planning.
 *
 * **Ce qui reste ici, et pourquoi.** La version exécutée : elle n'est pas un
 * réglage, c'est la réponse à « est-ce que mes correctifs sont arrivés ». Une
 * capture de cet écran doit y répondre sans qu'on ait à poser la question — la
 * cacher derrière une rubrique reviendrait à la perdre (`CLAUDE.md` §6).
 */
export default async function ReglagesPage() {
  const ctx = await getCurrentCtx();
  const [role, etatVersion] = await Promise.all([getRole(ctx), versionEtRetard()]);
  const version = etatVersion.ligne;

  // Le rôle décide de ce que le SERVEUR rend, pas de ce que la feuille de style
  // cache : ce qu'un membre n'a pas le droit de voir ne sort pas d'ici
  // (`docs/QUESTIONS.md` §10).
  const ensembles = rubriquesReglages(role);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran surtitre={surtitreReglages(role)} titre="Réglages" />

        <Sommaire ensembles={ensembles} />

        {/* **Un écran court dit pourquoi il est court.** Sans cette phrase, le
            salarié lit une application amputée et va demander au patron de
            « lui ouvrir les droits ». Elle était sur la planche du 14 août, et
            l'oublier en codant l'aurait rendue introuvable. */}
        {role !== "proprietaire" && (
          <p
            className="mx-[26px] mt-[30px] border-t pt-[18px] text-[12px] leading-[1.75]"
            style={{ borderColor: colors.line, color: colors.muted }}
          >
            Rien de l&apos;entreprise ici, et ce n&apos;est pas un écran amputé : vous voyez le
            planning et vos chantiers. Les tarifs, les coordonnées bancaires et les documents
            appartiennent au patron.
          </p>
        )}

        {/* La version exécutée, en bas et discrète.
            Elle existe pour une raison précise : le patron a réessayé, un jour
            plus tard, des correctifs livrés la veille, sur un espace de travail
            qui n'avait jamais récupéré le code neuf. Rien à l'écran ne le lui
            disait, et trois échanges ont été perdus à chercher un défaut déjà
            corrigé. Une capture de cet écran répond désormais à la question.

            Le dernier mot de la ligne est la BRANCHE, et il est là depuis le
            11 août au soir : ce jour-là un travail livré sur une branche n'est
            jamais arrivé jusqu'à lui, dont l'espace suit `main`. Il a lu une
            date de la même heure — les deux avançaient en parallèle — et conclu
            qu'il avait tout. La date ne mentait pas ; elle ne suffisait pas. */}
        <div className="mx-[26px] mt-[30px] border-t pt-[18px]" style={{ borderColor: colors.line }}>
          <p className={`mb-[6px] ${libelleCaps}`} style={{ color: colors.muted }}>
            Version
          </p>
          <p className="text-[13px]" style={{ color: colors.muted }}>
            {version ?? "inconnue — cette installation n'annonce pas sa version."}
          </p>

          {/* **LE CAS QUI LUI A COÛTÉ UNE SOIRÉE, dit en toutes lettres.**

              Le 21 août 2026 : *« Ça n'a pas marché, j'ai encore l'ancienne
              version. Pourtant j'ai rechargé les mises à jour. »* Les deux
              étaient vrais — le code neuf était bien arrivé sur le disque, et
              le serveur exécutait bien celui de la veille. La ligne ci-dessus
              lisait le disque : elle confirmait la mise à jour à l'instant
              précis où elle aurait dû avertir que rien de neuf n'était servi.

              En or, comme tout ce qui attend un geste de lui (`CLAUDE.md`) —
              et il y a bien un geste à faire : rouvrir l'espace de travail. */}
          {etatVersion.enRetard && (
            <div className="mt-3 py-1 pl-[15px]" style={{ borderLeft: `1px solid ${colors.or}` }}>
              <p className="text-[13px]" style={{ color: colors.ink }}>
                Du code plus récent est déjà là, mais l&apos;application exécute encore la
                version ci-dessus : elle a été construite avant.
              </p>
              <p className="mt-1 text-[12px]" style={{ color: colors.muted }}>
                En attente : {etatVersion.enAttente}. Arrêtez puis rouvrez l&apos;espace de
                travail — il se reconstruira au démarrage.
              </p>
            </div>
          )}

          {/* Dit en toutes lettres, parce que « main » tout seul ne veut rien
              dire pour lui : le dernier mot est la branche suivie, et un travail
              livré ailleurs n'arrivera JAMAIS ici, quelle que soit la date.

              **Sur le banc d'essai SEULEMENT**, comme le bouton ci-dessous. Une
              application déployée n'a pas de dépôt : sa version vient de la
              chaîne de livraison et ne porte aucune branche
              (`src/server/version-executee.ts`). Cette phrase y serait donc du
              jargon, et un jargon FAUX — le pire des deux. */}
          {process.env.ATLAS_BANC_ESSAI === "1" && (
            <p className="mt-1 text-[12px]" style={{ color: colors.muted, opacity: 0.85 }}>
              Le dernier mot est la branche suivie. Un correctif livré sur une autre
              branche n&apos;arrivera pas ici, même en cherchant les corrections.
            </p>
          )}

          {/* **La version LENTE se dit, parce qu'elle explique ses propres
              pannes.** Le 12 août 2026, le patron photographie « An unexpected
              response was received from the server. » — et sa pile d'appel
              commence par `.next/dev` : son banc servait la version lente, où
              chaque écran se compile au premier appel pendant que le relais de
              GitHub abandonne au bout d'une minute. Ce panneau était donc le
              symptôme de cet état-là, que rien à l'écran n'annonçait.

              **Et il promettait de trop — corrigé le 20 août 2026.** Sa phrase
              se terminait par « la version rapide prend le relais dès que la
              construction aboutit ». Ce soir-là, elle n'aboutissait pas et
              n'allait jamais aboutir : son veilleur était tombé, et c'est lui
              qui construit. Le panneau lui demandait d'attendre quelque chose
              qui n'arriverait pas. Ce qu'il a le droit de promettre vit
              désormais dans `src/lib/version-lente.ts`. */}
          {process.env.ATLAS_BANC_ESSAI === "1" && process.env.NODE_ENV !== "production" && (
            <p className="mt-3 text-[12px] leading-snug" style={{ color: colors.alert }}>
              Vous êtes sur la <b>version lente</b>, celle qui se construit encore.{" "}
              {panneauVersionLente(etatVersionLente()).phrase}
            </p>
          )}

          {/* Sur le banc d'essai seulement : une application déployée ne va pas
              chercher son propre code, ce serait une porte d'entrée. */}
          {process.env.ATLAS_BANC_ESSAI === "1" && <BoutonMiseAJour derniereIssue={await derniereIssueMiseAJour()} />}
        </div>
      </div>
    </div>
  );
}
