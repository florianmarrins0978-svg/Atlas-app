"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { adresseDeLaVisionneuse } from "@/lib/visionneuse-pdf";
import { colors, font, voile } from "@/lib/design-tokens";
import TravauxAFaire from "./TravauxAFaire";
import FicheDeSecurite from "./FicheDeSecurite";
import { lienAppel, liensItineraire } from "@/lib/itineraire";
import { NOTE_MAX } from "@/lib/note-chantier";
import { ecrireNoteChantierAction } from "./actions";
import type { ChantierPlanning, FeuilleEtRetour } from "./types-du-planning";

/**
 * LE PENSE-BÊTE DU CHANTIER — « penser à prendre le broyeur ».
 *
 * **Sa demande du 23 août 2026**, et la planche 93 retenue : *« un petit
 * encadré où l'utilisateur peut marquer quelque chose [...] client plus
 * disponible à partir de neuf heures »*. Variante **A** : le cadre est ouvert
 * en permanence.
 *
 * **Pourquoi A plutôt que B**, et la raison n'est pas le confort. La planche
 * proposait aussi une ligne discrète « ＋ Ajouter une note », plus économe de
 * 96 px. Devant l'image, il a répondu : *« B, y'a rien ? Je vois rien »* — et
 * c'était le renseignement décisif. Une invitation qu'il ne voit pas sur une
 * capture, il ne la trouvera pas davantage sur un chantier.
 *
 * **Elle ne part sur AUCUN document.** Sa décision : *« elle peut rester là,
 * car les salariés auront accès au planning ; justement, c'est pour cela que je
 * voulait le devis sans les prix »*. Le PDF est le devis expurgé de ses prix ;
 * la note, elle, vit ici — et ses équipes la lisent en ouvrant la feuille.
 */
function NoteDuChantier({
  chantier,
  ecriture,
}: {
  chantier: ChantierPlanning;
  /**
   * **Un salarié LIT la note, il ne l'écrit pas** — 30 août 2026.
   *
   * Et il faut qu'il la lise : c'est la raison même pour laquelle elle existe.
   * Sa décision du 23 août : *« elle peut rester là, car les salariés auront
   * accès au planning »*. Le broyeur à prendre, le client dispo à 9 h — c'est
   * l'équipe sur place qui en a besoin.
   *
   * **Un cadre de saisie grisé aurait été le mauvais choix** : il se touche, il
   * ne répond pas, et l'on croit à une panne. Sans note, rien ne s'affiche —
   * un titre « Ma note » au-dessus du vide n'apprend rien (`CLAUDE.md` §3).
   */
  ecriture: boolean;
}) {
  // Semée depuis la liste, jamais relue au montage : la note descend déjà avec
  // le planning, et un second aller-retour l'afficherait vide une seconde.
  const [texte, setTexte] = useState(chantier.note ?? "");
  const [etat, setEtat] = useState<"repos" | "ecrit" | "enregistre" | "perdu">("repos");
  const [, enTransition] = useTransition();

  /**
   * **Ce que le cadre porte, pas ce que le rendu en gardait.** Sans la valeur,
   * on écrivait `texte` — l'état du DERNIER RENDU — et la dernière touche tapée
   * avant de ranger son téléphone pouvait n'y être pas encore. Une note perdue
   * en silence, c'est le broyeur oublié (`test-valeur-du-champ.ts`).
   */
  function enregistrer(duCadre: string) {
    const texte = duCadre.slice(0, NOTE_MAX);
    if (texte === (chantier.note ?? "")) return;
    enTransition(async () => {
      const r = await ecrireNoteChantierAction(chantier.id, texte);
      if (!r.succes) {
        // **Le refus se DIT.** Une note perdue en silence, c'est le broyeur
        // oublié — et il croirait l'avoir noté.
        setEtat("perdu");
        return;
      }
      chantier.note = r.note;
      setEtat("enregistre");
    });
  }

  if (!ecriture) {
    const ecrite = (chantier.note ?? "").trim();
    if (ecrite === "") return null;
    return (
      <div className="mt-3.5 pt-3" style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
        <p
          className="m-0 mb-2 text-[10px] font-semibold uppercase leading-none"
          style={{ letterSpacing: "0.16em", color: colors.ink }}
        >
          La note
        </p>
        <p
          data-atlas="note-lecture"
          className="m-0 whitespace-pre-wrap break-words text-[14.5px] leading-[1.45]"
          style={{ color: colors.ink }}
        >
          {ecrite}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3.5 pt-3" style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
      {/* **En NOIR, comme « Matin » et « Après-midi »** — sa remarque du
          20 septembre 2026 : en or, *« j'aime pas sa couleur »*. Ce sont les
          mêmes capitales que la carte du jour. */}
      <p
        className="m-0 mb-2 text-[10px] font-semibold uppercase leading-none"
        style={{ letterSpacing: "0.16em", color: colors.ink }}
      >
        Ma note
      </p>
      <textarea
        data-atlas="note-chantier"
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value.slice(0, NOTE_MAX));
          setEtat("ecrit");
        }}
        // **Enregistré en SORTANT du cadre, jamais par un bouton.** Il range
        // son téléphone et démarre : un bouton non touché perdrait la note.
        onBlur={(e) => enregistrer(e.currentTarget.value)}
        placeholder="Penser à prendre le broyeur. Client dispo à partir de 9 h."
        rows={3}
        className="w-full resize-none rounded-[10px] px-3 py-2.5 outline-none"
        // **Un papier doré** — sa planche du 19 septembre 2026 : la note est ce
        // qui se LIT, et l'or est la couleur de ce qui se lit sur cette fiche.
        // Le curseur aussi ; à la mise au point, le liseré se fonce.
        style={{
          boxShadow: `inset 0 0 0 1px ${voile(colors.or, 0.22)}`,
          background: voile(colors.or, 0.13),
          color: colors.ink,
          caretColor: colors.or,
          // **16 px au moins.** En dessous, iOS grossit la page à la mise au
          // point et l'écran saute sous le doigt — un piège déjà payé ici.
          fontSize: 16,
          lineHeight: 1.45,
          WebkitTapHighlightColor: "transparent",
        }}
      />
      <p
        data-atlas="note-etat"
        className="m-0 mt-1.5 min-h-[17px] text-[12.5px]"
        style={{ color: etat === "perdu" ? colors.bordeaux : colors.rust }}
      >
        {etat === "enregistre"
          ? "Enregistré."
          : etat === "perdu"
            ? "La note n’a pas pu être enregistrée. Réessayez."
            : ""}
      </p>
    </div>
  );
}

/**
 * LA FEUILLE DE CHANTIER — le devis, sans un seul prix.
 *
 * Sa question du 21 août 2026 : *« le salarié ne doit pas avoir accès au prix.
 * Est-ce que tu peux me faire un PDF du devis sans les prix, ou est-ce que le
 * plus simple c'est de créer une fiche prestations sous le client ? »* — puis sa
 * réponse : *« je pense que le plus simple, ça serait de mettre le devis en PDF
 * sans les prix »*.
 *
 * **C'est le bon choix, et pour une raison de fond :** une fiche
 * « prestations » saisie à côté serait une SECONDE liste de ce qui est à faire.
 * Le devis change — une ligne ajoutée au téléphone, une quantité corrigée — et
 * les deux divergent en silence ; l'équipe part alors avec la version d'avant.
 *
 * **Les gestes de « Y aller » sont repris, pas réinventés** : sa demande du même
 * jour — *« reprends l'adresse cliquable qui ouvre Maps ou Waze — pas besoin
 * d'en mettre trois —, la possibilité d'appeler le client et de copier
 * l'adresse. Le reste, on n'en aura pas besoin. »* Les liens viennent de
 * `src/lib/itineraire.ts`, jamais recopiés à la main.
 *
 * **L'adresse ne s'AFFICHE plus** — sa demande du même message — mais elle sert
 * toujours : les quatre gestes la lisent sans la montrer.
 */
export function FeuilleChantier({
  chantier,
  feuille,
  ecriture = true,
  travauxChanges,
}: {
  chantier: ChantierPlanning | null;
  feuille?: FeuilleEtRetour;
  /** Faux pour un salarié : la note se LIT, elle ne s'écrit pas (30 août 2026). */
  ecriture?: boolean;
  travauxChanges: (liste: string[]) => void;
}) {
  // **`key={chantier.id}` là où elle est rendue** : changer de chantier remonte
  // le composant, et « Adresse copiée » repart à zéro sans qu'un effet ait à le
  // remettre à la main — un effet qui appelle `setState` fait un rendu de plus
  // pour rien.
  const [copie, setCopie] = useState<"non" | "faite" | "refusee">("non");

  if (!chantier) return null;
  const adresse = chantier.adresseChantier?.trim() || null;
  // **Deux destinations, plus trois.** Sa demande du 21 août : « pas besoin
  // d'en mettre trois ». Et « Maps », c'est **Google Maps** — sa demande du
  // 31 août 2026, capture à l'appui : *« pour Maps c'est Google Maps que je
  // veux »*. Le bouton servait Plans d'Apple, qui est ce que son iPhone appelle
  // « Plans » ; ce n'est pas ce qu'il ouvre pour aller sur un chantier.
  const liens = liensItineraire(adresse);
  const tel = lienAppel(chantier.clientTelephone);

  // **Aucune marge à elle** : elle vit DANS la carte du jour, entre les
  // chantiers, et c'est le retrait de la carte qui l'aligne.
  //
  // **SA PLANCHE DU 19 SEPTEMBRE 2026 — la sixième de la fiche**
  // (`appli/fiche-intervention-sixieme.html`) : *« tu peux coder exactement
  // cette planche »*. La carte est blanche, cernée d'or à 2 px — le sien,
  // `colors.or`, celui de « une journée » —, en VRAIE bordure : un ombrage
  // intérieur s'épaississait dans l'angle au lieu de suivre le rayon, et c'est
  // lui qui l'a vu, photo à l'appui (*« les bords, je les trouve mal
  // arrondis »*).
  return (
    <div
      data-atlas="feuille"
      className="mt-3 rounded-[14px] px-3 pb-3.5 pt-4"
      style={{
        background: colors.card,
        border: `2px solid ${colors.or}`,
        boxShadow: `0 2px 10px ${voile(colors.ink, 0.07)}`,
      }}
    >
      <p
        className="m-0 text-center text-[10.5px] font-bold uppercase leading-none"
        style={{ letterSpacing: "0.22em", color: colors.or }}
      >
        {/* **« Fiche d'intervention » depuis le 8 septembre 2026** — sa demande,
            capture à l'appui : *« qui d'ailleurs devrait s'appeler fiche
            d'intervention, change le nom »*. */}
        Fiche d&apos;intervention
      </p>
      <p
        className="mb-0 mt-2.5 text-center"
        style={{ fontFamily: font.display, fontSize: 22, lineHeight: 1.15 }}
      >
        {chantier.clientNom ?? chantier.nom}
      </p>

      {/* **LES QUATRE GESTES SUR UNE SEULE LIGNE — sa planche du 19.** Quatre
          cases en deux rangées se lisaient comme deux choix à faire ; une seule
          rangée, le dessin au-dessus du mot, dit d'un coup d'œil qu'il y a
          quatre gestes. Le dessin garde sa couleur, sans rond derrière (sa
          retouche du soir) : vert pin pour y aller et appeler, or pour copier
          l'adresse — ce qui se fait, et ce qui se lit. */}
      <div className="mt-3.5 grid grid-cols-4 gap-1.5">
        <Geste href={liens?.google ?? null} dessin="maps" teinte={colors.rust}>
          Maps
        </Geste>
        <Geste href={liens?.waze ?? null} dessin="waze" teinte={colors.rust}>
          Waze
        </Geste>
        <Geste
          dessin="copier"
          teinte={colors.or}
          onClick={
            adresse
              ? async () => {
                  try {
                    await navigator.clipboard.writeText(adresse);
                    setCopie("faite");
                  } catch {
                    setCopie("refusee");
                  }
                }
              : null
          }
        >
          {copie === "faite"
            ? "Adresse copiée"
            : copie === "refusee"
              ? "Copie refusée"
              : "Copier l’adresse"}
        </Geste>
        <Geste href={tel} dessin="appeler" teinte={colors.rust}>
          Appeler le client
        </Geste>
      </div>

      <NoteDuChantier chantier={chantier} ecriture={ecriture} />

      {/* ─── LA FICHE DE SÉCURITÉ — avant les travaux, parce qu'elle se remplit
          avant de commencer. Sur TOUS les chantiers, au bon vouloir — sa
          décision du 21 septembre 2026 (`FicheDeSecurite.tsx`). */}
      <FicheDeSecurite chantierId={chantier.id} />
      {/* ─── LES TRAVAUX À FAIRE — le bandeau qui se déplie ─────────────────
          Les lignes du devis vivent DEDANS, et nulle part ailleurs : *« un
          devis de trois pages, ça va faire trop long sur le planning si c'est
          visible tout le temps »* (19 septembre 2026). Fermé, il tient une
          ligne et dit où on en est. Un chantier sans devis y lit « aucune
          ligne » et peut quand même poser une photo et un mot. */}
      {feuille === undefined ? (
        <p className="mb-0 mt-3.5 text-[13.5px]" style={{ color: colors.muted }}>
          Lecture du devis…
        </p>
      ) : (
        <TravauxAFaire
          chantierId={chantier.id}
          lignes={feuille.taches}
          aLaMain={feuille.aLaMain && ecriture}
          travauxChanges={travauxChanges}
          retoursEnvoyes={feuille.retours}
          dernierRetourLe={feuille.dernierRetourLe}
        />
      )}

      {/* **Le lien n'existe QUE s'il y a un devis à imprimer.** Sans devis, la
          route répond 404 : un lien qui ouvre une erreur est pire qu'un lien
          absent — il fait douter de l'application entière. */}
      {feuille?.avecDevis && (
        /* **Dans l'application, pas dans un onglet de Safari — 13 septembre
           2026** : sans en-tête ni flèche, *« j'ai pas de touche retour »*.

           **En NOIR gras, comme « Déplacer  Retirer » — sa remarque du
           20 septembre 2026 à 2 h** : en or, il faisait *« ton sur ton avec le
           contour doré de la fiche »*. Et « le devis », pas « le PDF » — son
           mot, le même jour : *« change PDF sans les prix par : ouvrir le
           devis sans les prix »*. C'est bien le devis, expurgé de ses prix, que
           l'équipe emporte (sa décision du 21 août). */
        <Link
          data-atlas="pdf-sans-prix"
          href={adresseDeLaVisionneuse(`/api/chantiers/${chantier.id}/feuille/pdf`, {
            surtitre: "Feuille de chantier",
            titre: chantier.nom,
          })}
          className="mx-auto mt-3 block w-max px-3 py-2 text-[14px] font-bold"
          style={{ color: colors.ink }}
        >
          Ouvrir le devis sans les prix
        </Link>
      )}
    </div>
  );
}

/**
 * Un des quatre gestes de la fiche — une case, le dessin au-dessus du mot.
 *
 * **Éteint plutôt qu'absent quand la donnée manque** : un bouton qui disparaît
 * fait chercher où il est passé ; éteint, il dit que c'est l'adresse qui
 * manque, et non l'application qui a changé.
 *
 * **Les dessins sont tracés ici, d'un même trait** (`stroke-width` 1,6) : le
 * repère, la flèche de navigation, les deux feuilles, le combiné. Aucun glyphe
 * de police, aucune image — un dessin de police change de forme d'un téléphone
 * à l'autre.
 */
const DESSINS_DES_GESTES = {
  maps: (
    <>
      <path d="M10 17.5s-5.5-5-5.5-9a5.5 5.5 0 0 1 11 0c0 4-5.5 9-5.5 9z" />
      <circle cx="10" cy="8.5" r="2" />
    </>
  ),
  waze: <path d="M16.5 3.5 3.5 9l6 1.5 1.5 6z" />,
  copier: (
    <>
      <rect x="7" y="7" width="9.5" height="9.5" rx="2" />
      <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    </>
  ),
  appeler: (
    <path d="M4 3.5h3l1.5 3.5-2 1.2a9 9 0 0 0 5.3 5.3l1.2-2 3.5 1.5v3a1.5 1.5 0 0 1-1.6 1.5A13 13 0 0 1 2.5 5.1 1.5 1.5 0 0 1 4 3.5z" />
  ),
} as const;

function Geste({
  href,
  onClick,
  dessin,
  teinte,
  children,
}: {
  href?: string | null;
  onClick?: (() => void) | null;
  dessin: keyof typeof DESSINS_DES_GESTES;
  /** La couleur du dessin : vert pin pour ce qu'on fait, or pour ce qui se lit. */
  teinte: string;
  children: React.ReactNode;
}) {
  const actif = Boolean(href || onClick);
  const style = {
    background: colors.rustTint,
    boxShadow: `inset 0 0 0 1px ${colors.lineSoft}`,
    color: actif ? colors.ink : colors.muted,
    opacity: actif ? 1 : 0.45,
  } as const;
  // Une CASE, pas une capsule : c'est la forme de sa planche du 19 septembre
  // 2026, déclarée comme telle dans `test-boutons-arrondis.ts`.
  const classe =
    "flex min-h-[78px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[12px] px-1 py-2 text-center text-[11.5px] leading-[1.15] no-underline";
  const dedans = (
    <>
      <svg
        width="22"
        height="22"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="flex-none"
        style={{ color: actif ? teinte : colors.muted }}
      >
        {DESSINS_DES_GESTES[dessin]}
      </svg>
      <span className="flex min-h-[2.3em] items-center">{children}</span>
    </>
  );

  if (href) {
    return (
      <a
        data-atlas="geste-de-la-fiche"
        className={classe}
        style={style}
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {dedans}
      </a>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        data-atlas="geste-de-la-fiche"
        className={classe}
        style={style}
        onClick={onClick}
      >
        {dedans}
      </button>
    );
  }
  return (
    <span data-atlas="geste-de-la-fiche" className={classe} style={style}>
      {dedans}
    </span>
  );
}
