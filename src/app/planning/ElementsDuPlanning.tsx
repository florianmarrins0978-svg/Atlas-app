"use client";

import { poseSansAccord } from "@/lib/chantier-etat";
import { colors, surPlein } from "@/lib/design-tokens";
import TeteRonde from "@/components/atlas/TeteRonde";
import { styleDuCarre } from "@/components/atlas/MoisCharge";
import { communeDeLAdresse } from "@/lib/commune-adresse";
import type { EtatDemi } from "@/lib/planning-jour";
import type { ChantierPlanning } from "./types-du-planning";

/**
 * CE QUE LE CHANTIER OCCUPE ENCORE — et non ce qu'il demande.
 *
 * **La planche `appli/liberer-une-demi-journee.html` compte les demi-journées
 * POSÉES**, et elle a raison : une fois le matin rendu, lire « une journée »
 * sous le nom pendant que le tiroir annonce « ½ journée à poser » fait une
 * journée et demie pour un chantier d'un jour. Deux vérités à trois
 * centimètres, c'est ce qu'il a photographié le 7 septembre 2026.
 *
 * **Sa durée, elle, ne bouge pas** : c'est ce que le devis a vendu, et c'est
 * l'écart entre les deux qui fait apparaître le morceau en bas.
 *
 * Tant qu'aucune date n'est posée, il n'occupe rien : c'est alors sa durée
 * qu'on annonce, faute d'autre chose à dire.
 */
/**
 * « PAS ENCORE SIGNÉ », sous la durée — son choix B du 7 octobre 2026.
 *
 * Il l'a posé lui-même, le client n'a pas encore accepté sur son lien. Un
 * chantier posé ne doit jamais se lire comme un chantier vendu. La règle vit
 * dans `poseSansAccord`, l'écran ne fait que la montrer.
 */
export function PasEncoreSigne({ chantier }: { chantier: ChantierPlanning }) {
  if (!poseSansAccord(chantier)) return null;
  return (
    <span data-atlas="pas-encore-signe" className="block text-[12.5px]" style={{ color: colors.muted }}>
      Pas encore signé
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LES PIÈCES DE L'ÉCRAN
// ─────────────────────────────────────────────────────────────────────────

/**
 * Le chevron qui fait monter les portes d'un chantier — son allure C.
 *
 * **Il vit dans une pièce, et non recopié à trois endroits.** Trois listes le
 * portent depuis le 4 septembre 2026 — les journées, « Sans date » et « En
 * attente du client » —, et un chevron recopié aurait changé de couleur ou de
 * taille dans l'une des trois le jour où l'on retouche les deux autres.
 *
 * **Le NOM ne le remplace pas** : sa consigne du 4 septembre. Un chevron
 * promet qu'on part quelque part, un nom qu'il s'ouvre.
 */
export function ChevronDesPortes({
  chantier,
  onPortes,
}: {
  chantier: ChantierPlanning;
  onPortes: (c: ChantierPlanning) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPortes(chantier)}
      aria-label={`Ouvrir le chantier ${chantier.nom}`}
      className="flex-shrink-0 cursor-pointer border-0 bg-transparent px-0.5 text-[19px]"
      style={{ color: colors.chevron }}
    >
      ›
    </button>
  );
}

export function Pastille({ etat }: { etat: EtatDemi }) {
  return (
    <i
      data-atlas="pastille"
      data-etat={etat}
      className="inline-block h-[11px] w-[11px] flex-shrink-0 rounded-[3px]"
      style={styleDuCarre(etat)}
    />
  );
}

export function Petit({
  children,
  onClick,
  retenue,
  fini,
  serre,
  absente,
  partielle,
  ...reste
}: {
  children: React.ReactNode;
  onClick: () => void;
  retenue?: boolean;
  fini?: boolean;
  /**
   * **Cette personne n'est pas là ce jour-là** — son signalement du
   * 7 septembre 2026 : *« il doit être grisé et on ne doit pas pouvoir le
   * sélectionner »*.
   *
   * **Grise TOUJOURS, n'interdit que la COCHE.** Une pastille déjà cochée
   * reste cliquable pour être retirée : c'est le seul chemin qui existe pour
   * réparer une coche antérieure au congé, et c'est exactement l'état qu'il a
   * photographié. Le gris dit alors qu'il faut la retirer, il n'enferme pas
   * dedans.
   *
   * **Ce que l'écran décide ici, c'est l'apparence, jamais la règle** : le
   * refus vit dans `equipe-absente.ts` et le serveur l'applique aussi
   * (`CLAUDE.md` §3).
   */
  absente?: boolean;
  /**
   * **Cochée, mais pas sur tous les jours du chantier** — sa proposition C,
   * retenue le 8 septembre 2026.
   *
   * **Un aplat ne peut pas porter une exception**, et c'est lui qui l'a relevé
   * sur la maquette : *« la phrase dit Julien en congé mais il est quand même
   * coché en vert, c'est normal ? »* Non — on lit l'aplat, pas ce qui
   * l'accompagne. Le cerne vert sans fond dit « oui, mais pas partout », et la
   * pastille porte alors les jours.
   */
  partielle?: boolean;
  /**
   * Resserré à 9 px, comme `.demi .petit` sur la planche 84.
   *
   * **Trois pixels par côté, et c'est la ligne entière qui tient ou se replie.**
   * Sur une ligne de demi-journée, l'écran aligne : pastille (11) + mot (70) +
   * équipe (75) + « Déplacer » + « Retirer », dans 324 px. Aux 12 px par défaut,
   * les deux boutons mesurent 74 et 62 — le total fait 324 pile, et « Retirer »
   * bascule à la ligne suivante. À 9 px ils font 68 et 56, et tout tient sur un
   * trait, comme sur la planche qu'il a validée.
   *
   * Trouvé en REGARDANT la capture, jamais par un test — la quatrième fois dans
   * ce dépôt (`CLAUDE.md` §5). La planche portait déjà la règle ; c'est la
   * transcription qui l'avait perdue.
   */
  serre?: boolean;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...reste}
      disabled={absente && !retenue}
      aria-disabled={absente && !retenue ? true : undefined}
      data-absente={absente ? "1" : undefined}
      className={`flex-shrink-0 rounded-full py-[7px] text-[12px] ${
        absente && !retenue ? "cursor-not-allowed" : "cursor-pointer"
      } ${serre ? "px-[9px]" : "px-3"}`}
      style={{
        border: `1px solid ${
          absente
            ? colors.line
            : retenue || partielle
              ? colors.plein
              : fini
                ? colors.or
                : colors.line
        }`,
        background: retenue && !absente ? colors.plein : colors.card,
        color: absente
          ? colors.muted
          : retenue
            ? surPlein
            : partielle
              ? colors.plein
              : fini
                ? colors.or
                : colors.inkSoft,
        // **Le gris se voit, sans effacer.** À 0,5 la pastille disparaissait sur
        // les deux chartes sombres, mesuré : un nom qu'on ne lit plus ne dit pas
        // « absent », il dit « rien ».
        opacity: absente ? 0.72 : undefined,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}

/**
 * Les têtes, serrées l'une contre l'autre : trois gars tiennent dans la place
 * d'un prénom. Rien quand personne n'a de photo.
 */
function TetesQuiPartent({ tetes }: { tetes: { rang: number; photo: string }[] }) {
  if (tetes.length === 0) return null;
  return (
    <span className="flex -space-x-1.5" aria-hidden="true">
      {tetes.map((t) => (
        <span key={t.rang} className="rounded-full" style={{ boxShadow: `0 0 0 2px ${colors.cream}` }}>
          <TeteRonde repli={t.rang} photo={t.photo} taille={24} />
        </span>
      ))}
    </span>
  );
}

/**
 * QUI PART — des prénoms, et un « + » en or.
 *
 * **Le « + » qui dit qu'on peut en ajouter un autre.** Sa remarque du 21 août :
 * *« l'utilisateur voit marqué Paul, mais il ne se dit pas qu'il peut cliquer
 * dessus pour ajouter un autre gars »*. Un signe collé au nom coûte huit pixels
 * et se lit comme une invitation ; une phrase aurait pris une ligne.
 *
 * **Plus de pastille verte, plus de pointillé — sa planche du 18 septembre
 * 2026** (`appli/planning-tout-ensemble-en-mieux.html`) : les prénoms en noir,
 * un fait ; le « + » en or, un geste. Et quand personne n'est posé, **« +
 * Salarié »** — son choix du 18 au soir à la place de « Qui ? » : le même mot
 * et le même « + » que « + Salarié absent ? » juste au-dessus, un seul geste à
 * apprendre. Le contrat des suites ne bouge pas : `data-atlas="equipe"`,
 * `data-vide`, et le texte porte les prénoms.
 */
export function PastilleEquipe({
  libelle,
  vide,
  onClick,
  avecPlus = true,
  ecriture = true,
  tetes = [],
}: {
  libelle: string;
  /**
   * Les têtes de ceux qui partent, collées devant leurs noms : sa demande du
   * 27 septembre 2026. **Le nom reste** : une photo ne se lit pas au soleil,
   * un nom si.
   */
  tetes?: { rang: number; photo: string }[];
  vide: boolean;
  /** L'événement est transmis : l'appelant y trouve la ligne à garder immobile. */
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  avecPlus?: boolean;
  /**
   * Faux pour un salarié (30 août 2026) : il LIT qui part, il ne le change pas.
   *
   * **Le nom reste**, c'est ce qui lui dit avec qui il travaille — mais rendu
   * en texte plutôt qu'en bouton. Un bouton d'apparence identique invite à un
   * geste que le serveur refuse, et le refus se lit alors comme une panne.
   *
   * **Et rien du tout quand personne n'est coché** : la pastille « vide » est
   * une invitation à cocher, et lui ne peut pas.
   */
  ecriture?: boolean;
}) {
  if (!ecriture) {
    if (vide) return null;
    return (
      <span
        data-atlas="equipe-lecture"
        className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap text-[14.5px]"
        style={{ color: colors.ink }}
      >
        <TetesQuiPartent tetes={tetes} />
        {libelle}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-atlas="equipe"
      data-vide={vide ? "1" : "0"}
      onClick={onClick}
      className="inline-flex min-h-[44px] flex-shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-0 bg-transparent px-0 text-[14.5px]"
      style={{ color: vide ? colors.or : colors.ink, WebkitTapHighlightColor: "transparent" }}
    >
      {vide ? (
        <>
          <span className="text-[17px] leading-none" aria-hidden="true">
            +
          </span>
          Salarié
        </>
      ) : (
        <>
          <TetesQuiPartent tetes={tetes} />
          {libelle}
          {avecPlus && (
            <span className="text-[17px] leading-none" style={{ color: colors.or }} aria-hidden="true">
              +
            </span>
          )}
        </>
      )}
    </button>
  );
}

/**
 * OÙ VA CE CHANTIER — la commune, sous sa durée.
 *
 * **Sa maquette du 3 septembre 2026.** L'adresse existait en base et ne servait
 * qu'aux boutons de la feuille : Maps, Waze, « copier l'adresse » la lisaient
 * sans jamais la montrer. Sur une liste où quatre clients s'appellent Martins,
 * c'est pourtant la seule chose qui dit LEQUEL.
 *
 * **Rien quand on ne sait pas.** `communeDeLAdresse` rend `null` plutôt que de
 * deviner, et la ligne disparaît alors : un nom de rue écrit à la place d'une
 * commune ferait partir le patron au mauvais endroit (`CLAUDE.md` §4).
 *
 * **Elle ne peut pas déborder.** La ligne des planifiés est mesurée au pixel
 * (`test-ligne-planning-e2e.ts`) : une commune longue est coupée plutôt que de
 * pousser la colonne — c'est le nom du client qui commande la largeur.
 */
export function LieuDuChantier({ chantier }: { chantier: ChantierPlanning }) {
  const commune = communeDeLAdresse(chantier.adresseChantier);
  if (!commune) return null;
  return (
    <span
      data-atlas="lieu-du-chantier"
      className="mt-[2px] block truncate text-[11.5px] leading-[1.5]"
      style={{ color: colors.muted }}
    >
      {commune}
    </span>
  );
}

/**
 * « Retour à envoyer », sous le lieu du chantier du jour — sa planche du
 * 26 septembre 2026, réponse A. Il se tait dès que le retour du jour part.
 */
export function RetourAEnvoyer() {
  return (
    <span
      data-atlas="retour-a-envoyer"
      className="mt-[5px] flex items-center gap-[7px] text-[12.5px] font-semibold"
      style={{ color: colors.or }}
    >
      <span aria-hidden="true" className="h-[7px] w-[7px] flex-none rounded-full" style={{ backgroundColor: colors.or }} />
      Retour à envoyer
    </span>
  );
}

/** La rangée de boutons qui remplace ce qu'on vient de toucher. */
export function Choisir({ children, mots }: { children: React.ReactNode; mots?: boolean }) {
  return (
    <div
      data-atlas="choisir"
      // **Des mots s'espacent, des pastilles se serrent** : dix-huit pixels
      // entre deux prénoms en or (sa planche du 18 septembre 2026), six entre
      // deux capsules — le même conteneur, deux respirations.
      className={`mt-1 flex flex-wrap items-center justify-start ${mots ? "gap-x-[18px] pl-[46px]" : "gap-1.5"}`}
      style={{ flexBasis: "100%" }}
    >
      {children}
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA RÈGLE DE LA FICHE DU JOUR — noir un fait, or un geste, gris le reste.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Sa planche du 18 septembre 2026**, `appli/planning-tout-ensemble-en-mieux`,
 * et son oui du 19 : *« j'en ai marre des gros boutons ! Je veux une page
 * élégante et minimaliste qu'on comprend direct »*. La fiche empilait cinq
 * formes pour dire « ça s'appuie » — une pastille verte pleine, un pointillé,
 * un interrupteur, des capsules, un rond cerné d'or — et l'œil devait
 * apprendre chacune.
 *
 * Une seule règle les remplace, sans cadre ni aplat : un mot en OR est un
 * geste ; un mot NOIR est un fait ; le GRIS est le reste. Les deux dessins
 * ci-dessous sont les seuls qu'un geste prenne sur cette fiche :
 *
 * - `MotEnOr` — un mot qu'on touche ;
 * - `MotAChoisir` — un mot parmi d'autres, dont un seul est retenu : le retenu
 *   passe en noir, souligné d'or ; les autres restent en or.
 *
 * **44 px de haut, toujours** : l'encre rétrécit, la cible non. Un mot nu
 * n'offre rien au pouce.
 */
export function MotEnOr({
  children,
  onClick,
  doux,
  ...reste
}: {
  children: React.ReactNode;
  onClick: () => void;
  /** Gris plutôt qu'or — « Fermer », « Annuler » : une sortie, pas un geste. */
  doux?: boolean;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...reste}
      className="inline-flex min-h-[44px] flex-shrink-0 cursor-pointer items-center gap-1.5 border-0 bg-transparent px-0 text-[14px]"
      style={{ color: doux ? colors.muted : colors.or, WebkitTapHighlightColor: "transparent" }}
    >
      {children}
    </button>
  );
}

export function MotAChoisir({
  children,
  onClick,
  retenu,
  absente,
  ...reste
}: {
  children: React.ReactNode;
  onClick: () => void;
  retenu: boolean;
  /**
   * **Cette personne n'est pas là** — son signalement du 7 septembre 2026 :
   * *« il doit être grisé et on ne doit pas pouvoir le sélectionner »*. Grise
   * toujours, n'interdit que la coche : un nom déjà retenu reste touchable
   * pour être retiré (voir `Petit`, où la règle est écrite en entier).
   */
  absente?: boolean;
} & Record<string, unknown>) {
  const inerte = absente && !retenu;
  return (
    <button
      type="button"
      onClick={onClick}
      {...reste}
      disabled={inerte}
      aria-disabled={inerte ? true : undefined}
      aria-pressed={retenu}
      data-absente={absente ? "1" : undefined}
      className={`inline-flex min-h-[44px] flex-shrink-0 items-center border-0 bg-transparent px-0 text-[14px] ${
        inerte ? "cursor-not-allowed" : "cursor-pointer"
      }`}
      style={{
        color: absente ? colors.muted : retenu ? colors.ink : colors.or,
        textDecoration: retenu ? "underline" : "none",
        textDecorationColor: colors.or,
        textDecorationThickness: 1.5,
        textUnderlineOffset: 6,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}
