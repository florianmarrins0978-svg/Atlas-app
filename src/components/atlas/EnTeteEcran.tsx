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
 *   - **et AUCUN trait.** Le cheveu qui fermait l'en-tête a été retiré le
 *     25 août 2026, à sa demande : *« souvent sous les titres il y avait un
 *     trait comme celui-là, supprime tous les traits sous les titres »*.
 *
 * **Il avait déjà fait retirer celui de l'accueil la veille**, et il n'a pas
 * eu à demander deux fois : la règle vaut pour tous les écrans, et elle vit
 * ici pour n'être appliquée qu'une fois. Ne pas le remettre écran par écran —
 * c'est exactement ce que cette pièce partagée existe pour empêcher.
 */
export default function EnTeteEcran({
  surtitre,
  titre,
  precision,
  precisionPlacee = "sous",
  retour,
  action,
  actionPlacee = "titre",
  assistant = true,
  allure = "commune",
}: {
  /** Le mot d'accroche, en capitales d'or. Absent, la ligne disparaît. */
  surtitre?: string;
  titre: string;
  /** Une ligne de contexte sous le titre : un compte, une période. */
  // **Un nœud, pas une chaîne — 26 août 2026.** La fiche d'un client y met son
  // adresse ET son téléphone, et il les veut sur DEUX lignes : *« le tel doit
  // être à la ligne sous l'adresse »*. Un séparateur suffisait quand la
  // précision tenait sur une ligne ; il ne peut pas produire un retour.
  precision?: React.ReactNode;
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
  /**
   * La GRAMMAIRE de l'en-tête, et il n'y en a que deux.
   *
   * `"commune"` — celle du 10 août 2026, et le repli : titre 36 px, surtitre
   * doré SOUS le titre (sa demande du 26 août), précision en capitales
   * espacées, flèche de retour sur un rond plein. **Ne change pas d'un
   * caractère** : un écran qui ne dit rien reste exactement ce qu'il était.
   *
   * `"ample"` — celle qu'il a retenue sur maquette le 2 septembre 2026 pour la
   * fiche d'un client, et qu'il a nommée point par point :
   *
   *   - le surtitre doré repasse AU-DESSUS du nom (*« le client en doré, mets
   *     le au-dessus du nom comme tu avais fait »*). Il annonce ce qu'on ouvre ;
   *     le nom, lui, porte la page ;
   *   - le titre passe à 40 px — le nom du client EST l'écran ;
   *   - la précision quitte les capitales espacées pour du bas de casse à
   *     13 px. **Une adresse en capitales se déchiffre, elle ne se lit pas** :
   *     c'est ce que la maquette a montré côte à côte ;
   *   - la flèche de retour est cernée d'un cheveu au lieu d'être posée sur un
   *     aplat, parce que rien sur cet écran n'a besoin d'un aplat.
   *
   * **Un réglage, pas quatre.** Ces quatre traits forment UNE décision, prise
   * en une fois sur une maquette ; quatre interrupteurs indépendants inviteraient
   * à en mélanger deux sur un troisième écran, et la grammaire commune finirait
   * par n'être plus commune (`CLAUDE.md` §3).
   */
  allure?: "commune" | "ample";
}) {
  const ample = allure === "ample";
  return (
    <header>
      {(retour || actionPlacee === "retour") && (
      <div className="flex items-center justify-between gap-4 px-[26px] pt-7">
        {retour ? (
          <Link
            href={retour.href}
            aria-label={retour.libelle}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={
              ample
                ? { border: `1px solid ${colors.line}` }
                : { backgroundColor: colors.rustTint }
            }
          >
            <svg
              width={ample ? "15" : "16"}
              height={ample ? "15" : "16"}
              viewBox="0 0 24 24"
              fill="none"
              stroke={ample ? colors.inkSoft : colors.rust}
              strokeWidth={ample ? "1.8" : "2.4"}
            >
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
          {/* **Le titre D'ABORD, le surtitre doré EN DESSOUS — sa demande du
              26 août 2026 :** *« sur plusieurs catégories le titre était en
              dessous du sous-titre en doré, inversez-les »*. La grammaire du
              10 août posait l'accroche dorée au-dessus ; il la veut sous le
              titre, là où on lit un sous-titre. La précision « avant » (serif
              gris de la fiche chantier) n'est pas visée : elle reste au-dessus,
              c'est sa maquette du 11 août. */}
          {precision && precisionPlacee === "avant" && (
            <p
              className="text-[19px] leading-[1.25]"
              style={{ color: colors.muted, fontFamily: font.display }}
            >
              {precision}
            </p>
          )}
          {/* En allure ample, le surtitre doré précède le nom : c'est son choix
              du 2 septembre 2026, sur la fiche d'un client. Partout ailleurs il
              reste dessous, comme il l'a demandé le 26 août. */}
          {surtitre && ample && (
            <p
              className="mb-[13px] text-[9.5px] font-medium uppercase"
              style={{ color: colors.or, letterSpacing: "0.28em" }}
            >
              {surtitre}
            </p>
          )}
          <h1
            className={`${precision && precisionPlacee === "avant" ? "mt-3 " : ""}${
              ample ? "text-[40px] leading-[1.04]" : "text-[36px] leading-[1.02]"
            }`}
            style={{ fontFamily: font.display, letterSpacing: "-0.018em" }}
          >
            {titre}
          </h1>
          {surtitre && !ample && (
            <p
              className="mt-3 text-[9.5px] font-medium uppercase"
              style={{ color: colors.or, letterSpacing: "0.28em" }}
            >
              {surtitre}
            </p>
          )}
          {precision && precisionPlacee === "sous" && (
            <p
              className={
                ample
                  ? "mt-3.5 text-[13px] leading-[1.65]"
                  : "mt-2.5 text-[9.5px] font-medium uppercase"
              }
              style={
                ample
                  ? { color: colors.muted }
                  : { color: colors.muted, letterSpacing: "0.28em" }
              }
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
        {/*
          **`self-stretch`, et c'est une réparation, pas un ornement.**

          Ce groupe est né le 13 août 2026 pour que l'assistant tienne à côté
          d'une action existante. Or « Modifier », posé la veille par une autre
          session, s'aligne par `self-end` — c'est-à-dire sur le BAS de son
          conteneur, choisi pour tomber sur la ligne d'écriture du titre plutôt
          qu'à côté du surtitre. Enfermé dans un groupe haut de 44 px, son bas
          n'était plus celui de la ligne : le mot descendait de 21 px.

          Le groupe s'étire donc à la hauteur de la ligne, et `self-end` retrouve
          le repère qu'il visait. `items-start` garde le bouton en haut.

          **Trouvé par leur suite, au pixel près** — aucune relecture ne l'aurait
          vu, et aucune capture non plus : vingt et un pixels sur un mot d'or, ça
          ressemble à une marge.
        */}
        <div className="flex flex-shrink-0 items-start gap-3 self-stretch">
          {actionPlacee === "titre" && action}
          {assistant && <BoutonAssistant />}
        </div>
      </div>

    </header>
  );
}
