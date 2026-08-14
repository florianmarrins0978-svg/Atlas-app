import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import BoutonAssistant from "./BoutonAssistant";

/**
 * L'en-tête d'un écran, dans la grammaire retenue le 10 août 2026.
 *
 * **Il existe pour que les écrans ne divergent plus.** Chacun se dessinait son
 * propre titre — corps différents, marges différentes, filets présents ou non.
 * Sur l'accueil refait, l'écart sautait aux yeux d'un onglet à l'autre. Une
 * seule pièce, et la refonte se propage sans être recopiée.
 *
 * **Trois règles, et pas une de plus :**
 *
 *   - un surtitre en capitales espacées, en or — ce qu'on LIT ;
 *   - un titre en serif, 36 px, sur une seule ligne ;
 *   - un cheveu qui FERME l'en-tête, en retrait de 26 px des bords. Jamais de
 *     trait au-dessus du titre : le patron l'a refusé explicitement sur
 *     l'accueil, et un écran qui en porterait un jurerait avec les autres.
 */
export default function EnTeteEcran({
  surtitre,
  titre,
  precision,
  precisionPlacee = "sous",
  cheveu = true,
  retour,
  action,
  actionPlacee = "titre",
  assistant = true,
}: {
  /** Le mot d'accroche, en capitales d'or. Absent, la ligne disparaît. */
  surtitre?: string;
  titre: string;
  /** Une ligne de contexte sous le titre : un compte, une période. */
  precision?: string;
  /**
   * Où se pose la précision, et de quelle voix.
   *
   * `"sous"` — capitales espacées, sous le titre : la grammaire commune, posée
   * le 10 août 2026 pour tous les écrans.
   *
   * `"avant"` — serif gris, AU-DESSUS du titre. C'est ce que montre la maquette
   * de la fiche chantier (`maquettes/atlas-note-vocale.html`) : « M. Bernard —
   * 12 rue des Lilas » précède « Intervention prévue vendredi 15 août. ». Le
   * patron l'a demandé le 11 août 2026, maquette en main : *« je veux que ça
   * ressemble exactement à la maquette »*. Réservé à cet écran ; ailleurs, la
   * grammaire commune reste.
   */
  precisionPlacee?: "sous" | "avant";
  /** Le cheveu qui ferme l'en-tête. La maquette de la fiche n'en a pas. */
  cheveu?: boolean;
  /** Où revient la flèche. Absente sur les écrans de la barre du bas. */
  retour?: { href: string; libelle: string };
  /** Ce qui se pose à droite du titre — un bouton de dictée, par exemple. */
  action?: React.ReactNode;
  /**
   * Où se pose l'action.
   *
   * `"titre"` — à droite du titre, la place commune.
   *
   * `"retour"` — sur la ligne de la flèche, tout en haut. C'est ce que montre
   * la maquette de la fiche chantier, et ce n'est pas qu'une question de goût :
   * posée à côté du titre, la pastille lui prend la moitié de la largeur et
   * « Intervention prévue vendredi 15 août. » se casse en QUATRE lignes au lieu
   * de deux. Vu en capture le 11 août 2026.
   */
  actionPlacee?: "titre" | "retour";
  /**
   * L'assistant se pose-t-il sur cette en-tête ?
   *
   * Vrai partout, et c'est le but : un recours qui n'est pas là quand on en a
   * besoin ne sert à rien. Le réglage existe pour les écrans qui n'ont pas de
   * gabarit derrière eux — une page publique par jeton, par exemple, où il n'y
   * a ni panneau à ouvrir ni raison d'en proposer un au client.
   */
  assistant?: boolean;
}) {
  return (
    <header>
      {(retour || actionPlacee === "retour") && (
      <div className="flex items-center justify-between gap-4 px-[26px] pt-7">
        {retour ? (
          <Link
            href={retour.href}
            aria-label={retour.libelle}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : (
          <span />
        )}
        {actionPlacee === "retour" && action}
      </div>
      )}

      <div className={`flex items-start justify-between gap-4 px-[26px] ${retour ? "pt-5" : "pt-[34px]"}`}>
        <div className="min-w-0">
          {surtitre && (
            <p
              className="text-[9.5px] font-medium uppercase"
              style={{ color: colors.or, letterSpacing: "0.28em" }}
            >
              {surtitre}
            </p>
          )}
          {precision && precisionPlacee === "avant" && (
            <p
              className="mt-3 text-[19px] leading-[1.25]"
              style={{ color: colors.muted, fontFamily: font.display }}
            >
              {precision}
            </p>
          )}
          <h1
            className="mt-3.5 text-[36px] leading-[1.02]"
            style={{ fontFamily: font.display, letterSpacing: "-0.018em" }}
          >
            {titre}
          </h1>
          {precision && precisionPlacee === "sous" && (
            <p
              className="mt-3.5 text-[9.5px] font-medium uppercase"
              style={{ color: colors.muted, letterSpacing: "0.28em" }}
            >
              {precision}
            </p>
          )}
        </div>
        {/*
          **L'assistant se pose à côté du titre**, sur la ligne du titre —
          proposition B, choisie le 13 août 2026.

          **Il a d'abord été posé sur une ligne à lui, au-dessus**, et la mesure
          l'a renvoyé ici : cette ligne ajoutait 72 px en tête de CHAQUE écran,
          et sur le planning la dernière semaine du mois passait sous la barre
          du bas. On aurait échangé « deux jours recouverts » contre « une
          semaine repoussée hors de l'écran » — un mauvais marché, et invisible
          sans capture.

          Le risque de cette place est connu, et il est surveillé : sur la fiche
          chantier, une pastille posée ici prenait la moitié de la largeur du
          titre (11 août 2026). C'est pourquoi `test-assistant-en-tete-e2e.ts`
          compte les lignes du titre sur chaque écran.
        */}
        <div className="flex flex-shrink-0 items-center gap-3">
          {actionPlacee === "titre" && action}
          {assistant && <BoutonAssistant />}
        </div>
      </div>

      {/* Le seul trait de l'en-tête : celui qui le ferme. La fiche chantier s'en
          passe — sa maquette n'en montre aucun. */}
      {cheveu && <div className="mx-[26px] mt-[26px] h-px" style={{ backgroundColor: colors.line }} />}
    </header>
  );
}
