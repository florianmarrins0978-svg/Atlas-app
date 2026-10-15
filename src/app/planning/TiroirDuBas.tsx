"use client";

import { useEffect, useRef, useState } from "react";
import { VALIDITE_LIEN_JOURS } from "@/lib/etat-envoi";
import { colors, font, voile } from "@/lib/design-tokens";
import type { JourIso } from "@/lib/disponibilites";
import { jourLisibleCourt } from "@/lib/mois";
import { avecCivilite } from "@/lib/civilite";
import { DatesAEnvoyer, DatesEnAttente, type DonneesDatesDuMois } from "./DatesDuMois";
import { datesDuMois as grouperLesDatesDuMois, type EnvoiDesDates } from "@/lib/dates-du-mois";
import LigneRetirable from "@/components/atlas/LigneRetirable";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import type { ChantierPlanning } from "./types-du-planning";
import { ditCeQuIlOccupe, jourEnLettres } from "./outils-du-planning";
import { ChevronDesPortes, MotEnOr } from "./ElementsDuPlanning";

/**
 * Le titre d'une section du planning.
 *
 * **`encadre` lui donne la pastille d'un JOUR** — sa demande du 26 août 2026,
 * capture à l'appui : *« le "sans date", mets-le comme le vendredi 28 août, avec
 * le rectangle ovale qui l'entoure, même couleur, tout pareil. "En attente du
 * client", fais pareil. »*
 *
 * **Pourquoi les deux, et pas « Planifiés ».** « Sans date » et « En attente du
 * client » occupent la MÊME place dans la lecture qu'un jour : ce sont des
 * chantiers qui n'ont pas encore le leur. « Planifiés », lui, coiffe le bloc
 * DANS lequel les jours vivent — lui donner la même pastille emboîterait une
 * pastille dans une pastille et écraserait la hiérarchie qu'on vient de rendre
 * lisible.
 *
 * **Le fond et l'encre viennent des mêmes jetons que la pastille du jour**
 * (`colors.rustTint`, `colors.ink`), et jamais d'une valeur recopiée : deux
 * chartes sont sombres, et une couleur écrite en clair y serait illisible
 * (`CLAUDE.md` §3).
 */
function TitreSection({
  children,
  encadre = false,
  aGauche = false,
  ...reste
}: {
  children: React.ReactNode;
  encadre?: boolean;
  /**
   * **À GAUCHE, sur la marge du contenu** — sa demande du 11 septembre 2026 :
   * *« le sans date à gauche »*, planche `appli/tiroir-en-or.html` à l'appui.
   *
   * Centré, le titre du tiroir ne s'alignait sur rien : ni sur la poignée
   * au-dessus, ni sur les noms en dessous, qui commencent tous deux à 18 px du
   * bord. Les deux titres du tiroir le prennent — un seul des deux aurait fait
   * deux façons de titrer dans le même panneau.
   */
  aGauche?: boolean;
} & React.HTMLAttributes<HTMLParagraphElement>) {
  if (!encadre) {
    return (
      <p
        {...reste}
        className={`mx-[18px] mt-[26px] text-[13px] font-bold uppercase leading-none ${
          aGauche ? "text-left" : "text-center"
        }`}
        style={{ letterSpacing: "0.16em", color: colors.ink }}
      >
        {children}
      </p>
    );
  }
  return (
    <p
      {...reste}
      className={`mx-[18px] mt-[26px] leading-none ${aGauche ? "text-left" : "text-center"}`}
    >
      <span
        data-atlas="titre-encadre"
        className="inline-block rounded-full px-[15px] py-[7px] text-[12px] font-bold uppercase"
        style={{ letterSpacing: "0.14em", background: colors.rustTint, color: colors.ink }}
      >
        {children}
      </span>
    </p>
  );
}

/**
 * Le nom de cette liste, écrit une seule fois.
 *
 * **Il sert à DEUX endroits, et c'est tout le correctif du 7 septembre 2026 :**
 * le titre de la section, et la poignée qui l'annonce avant qu'on l'ouvre.
 * Écrits séparément, ils s'étaient mis à dire deux choses — « En attente du
 * client » dedans, « chez le client » dehors —, et c'est le raccourci du
 * dehors qu'il n'a pas compris.
 */
const EN_ATTENTE_DU_CLIENT = "En attente du client";

/** Ce que dit la poignée quand des dates du mois sont prêtes à partir. */
function pretAEnvoyer(
  groupes: readonly { contratEntretienId: string }[],
  donnees: DonneesDatesDuMois | null
): string {
  if (groupes.length > 1) return `${groupes.length} clients prêts à envoyer`;
  const contact = donnees?.contacts.find((c) => c.contratEntretienId === groupes[0]?.contratEntretienId);
  return contact ? `Prêt à envoyer à ${avecCivilite(contact.clientNom, contact.clientCivilite ?? undefined)}` : "1 client prêt à envoyer";
}

/**
 * LE TIROIR DU BAS — ce qui n'a pas encore de jour, à portée du pouce.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa maquette du 3 septembre 2026, retenue telle quelle.**
 *
 * « Sans date » et « En attente du client » vivaient tout en bas d'un écran qui
 * porte déjà le mois, la journée ouverte et la semaine des planifiés. Or **poser
 * un chantier est le geste le plus actif de cet écran**, et il était le plus
 * loin du pouce : on touchait un jour en haut, on descendait, on posait, et l'on
 * remontait voir le résultat.
 *
 * **CE QUE ÇA COÛTE, ET IL FAUT LE DIRE :** ces deux listes étaient visibles en
 * faisant défiler ; elles demandent maintenant un appui. C'est le seul échange
 * de ce lot, et il a été accepté en connaissance de cause. La poignée les
 * NOMME et les COMPTE — « 3 sans date · 2 chez le client » —, si bien que rien
 * ne devient introuvable : ce qui se perdait était leur position, pas leur
 * existence.
 *
 * **La poignée change de mot dès qu'un jour est touché** : elle écrit alors « À
 * poser sur jeudi 3 septembre », en or. C'est la phrase que l'écran écrivait
 * déjà sous « Sans date » — rendue à l'endroit du geste plutôt qu'au bas de la
 * page.
 *
 * **Il n'existe pas quand il n'a rien à porter.** Sa règle du 23 août 2026, la
 * même qui a fait disparaître « Ajouter un chantier » : un geste qui ne peut
 * mener nulle part se retire au lieu de s'annoncer. Un salarié n'en voit que la
 * moitié « En attente du client », et rien du tout si elle est vide.
 * ───────────────────────────────────────────────────────────────────────────
 */

/**
 * L'épaisseur du bord doré du tiroir — sa version C du 11 septembre 2026.
 *
 * **Une seule valeur, parce que deux choses en dépendent** : le bord lui-même,
 * et le voile posé au-dessus, qui doit s'arrêter exactement où l'or commence.
 * Écrite deux fois, elle a divergé une fois — et l'or a disparu sous le voile.
 */
const BORD_OR_DU_TIROIR = 2;

export function TiroirDuBas({
  ecriture,
  sansDate,
  morceaux,
  morceauEnMain,
  onPrendreMorceau,
  attenteClient,
  devisExpires,
  jourTouche,
  poser,
  poseADefaire,
  defairePose,
  retraits,
  demanderSuppression,
  portesOuvertes,
  onPortes,
  datesDuMois,
}: {
  ecriture: boolean;
  sansDate: ChantierPlanning[];
  /**
   * LES DEMI-JOURNÉES RENDUES qui attendent une place (10 septembre 2026).
   *
   * Elles vivent sous le même titre que « Sans date », et c'est voulu : pour
   * lui, ce sont deux formes de la même chose — du travail qui attend un jour.
   */
  morceaux: { chantier: ChantierPlanning; combien: number }[];
  morceauEnMain: string | null;
  onPrendreMorceau: (chantierId: string) => void;
  attenteClient: ChantierPlanning[];
  devisExpires: ChantierPlanning[];
  jourTouche: JourIso | null;
  poser: (chantierId: string, jour: JourIso) => void;
  /** Le dernier client posé d'ici, tant qu'il est encore sur ce jour — voir `dernierPose`. */
  poseADefaire: { chantier: ChantierPlanning; jour: JourIso } | null;
  defairePose: (chantierId: string) => void;
  /**
   * **Le type vient de la source, jamais recopié.** Une liste de champs écrite
   * ici aurait divergé au premier champ ajouté à `useRetraits` — et le tiroir
   * d'annulation se serait mis à recevoir autre chose que ce qu'il attend.
   */
  retraits: ReturnType<typeof useRetraits>;
  /** La question avant de supprimer, la même que sur la fiche du jour. */
  demanderSuppression: (c: ChantierPlanning) => void;
  /**
   * ─── LES DEUX LISTES DU BAS ONT DES PORTES, ELLES AUSSI — 4 sept. 2026 ──
   *
   * **Elles n'avaient AUCUN lien vers le chantier** : ni chevron, ni bouton,
   * ni nom cliquable. Tant que la fiche existait, cela ne se voyait pas — la
   * liste des chantiers y menait. Elle est retirée le 4 septembre, et un
   * devis parti sans date y serait devenu injoignable : exactement le
   * cul-de-sac du 8 août 2026, *« comment moi je fais pour avoir accès au
   * devis ? »*, sous un autre nom.
   *
   * **La même feuille que les journées, la même règle** (`portesDuPlanning`,
   * qui rend le devis et la fiche client sur un chantier sans date, et pas la
   * facture — un chantier qui n'a pas eu lieu ne se facture pas).
   *
   * **Le chevron, jamais le nom.** Sa consigne du 4 septembre : la feuille ne
   * s'accroche pas au nom du chantier.
   */
  portesOuvertes: boolean;
  onPortes: (c: ChantierPlanning) => void;
  /** Les dates du mois des contrats : à envoyer, et en attente du client. */
  datesDuMois: {
    donnees: DonneesDatesDuMois;
    aEnvoyer: ReturnType<typeof grouperLesDatesDuMois<ChantierPlanning>>["aEnvoyer"];
    enAttente: ReturnType<typeof grouperLesDatesDuMois<ChantierPlanning>>["enAttente"];
    onEnvoye: (e: EnvoiDesDates) => void;
  } | null;
}) {
  const [ouvert, setOuvert] = useState(false);
  const aEnvoyer = datesDuMois?.aEnvoyer ?? [];
  const datesEnAttente = datesDuMois?.enAttente ?? [];

  /**
   * **LA DERNIÈRE DATE POSÉE OUVRE LE TIROIR** — sa demande du 27 septembre
   * 2026 : *« l'onglet avec envoyer les dates s'affiche de suite, il ne faut
   * pas avoir besoin de recliquer sur le nom du client »*. Ajusté pendant le
   * rendu, sur le compte d'avant : un effet qui pose un état relancerait un
   * rendu de plus pour rien.
   */
  const [dejaAEnvoyer, setDejaAEnvoyer] = useState(aEnvoyer.length);
  if (aEnvoyer.length !== dejaAEnvoyer) {
    setDejaAEnvoyer(aEnvoyer.length);
    if (aEnvoyer.length > dejaAEnvoyer) setOuvert(true);
  }

  /**
   * **UN RETRAIT OUVRE LE TIROIR** — la B de sa planche du 7 octobre 2026 :
   * « Retiré à l'instant, Annuler » reste six secondes en bas. Supprimé depuis
   * la fiche du jour, le tiroir était fermé, et « Annuler » vivait dedans, à
   * hauteur zéro. Même ajustement pendant le rendu que la date posée.
   */
  const [dejaRetires, setDejaRetires] = useState(retraits.nombre);
  if (retraits.nombre !== dejaRetires) {
    setDejaRetires(retraits.nombre);
    if (retraits.nombre > dejaRetires) setOuvert(true);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * LE TIROIR PUBLIE SA HAUTEUR — 10 septembre 2026
   * ═══════════════════════════════════════════════════════════════════════
   *
   * **Le défaut qu'il ferme, et il traînait dans `TODO.md` :** ce tiroir est
   * `fixed`, posé sur la barre du bas. `.atlas-contenu` réserve la hauteur de
   * LA BARRE (`--atlas-barre`) et rien d'autre — le tiroir, lui, mangeait
   * cinquante pixels de plus, et ce qui tombait dessous n'était plus visable.
   * Deux gestes en ont souffert : « + Absent ? », qui passait dessous d'un
   * pixel le 10 septembre, et le « Poser » du client, qui atterrissait
   * dessous dès que sa fiche s'ouvrait.
   *
   * **On ne pousse pas la carte à la main** : le tiroir mesure ce qu'il occupe
   * et le publie, exactement comme `AtlasBottomNav` publie `--atlas-barre`.
   * Un nombre écrit dans la feuille de style aurait menti au premier
   * changement de la poignée — et c'est précisément ce que ce dépôt a déjà
   * payé sur la barre elle-même.
   *
   * **Rendue au démontage** : sur un écran sans tiroir, une hauteur survivante
   * volerait sa place au contenu pour toujours.
   */
  const cadre = useRef<HTMLDivElement>(null);
  const montre = (ecriture && sansDate.length > 0) || attenteClient.length > 0 ||
    (ecriture && devisExpires.length > 0) ||
    (ecriture && morceaux.length > 0) || aEnvoyer.length > 0 || datesEnAttente.length > 0 ||
    (ecriture && retraits.nombre > 0);
  useEffect(() => {
    const racine = document.documentElement;
    const rendre = () => racine.style.removeProperty("--atlas-tiroir");
    const noeud = cadre.current;
    if (!noeud) {
      rendre();
      return;
    }
    const publier = () =>
      racine.style.setProperty(
        "--atlas-tiroir",
        `${Math.round(noeud.getBoundingClientRect().height)}px`
      );
    publier();
    const oeil = new ResizeObserver(publier);
    oeil.observe(noeud);
    return () => {
      oeil.disconnect();
      rendre();
    };
    // **`montre` est la dépendance, et c'est ce qui rend l'effet juste** : le
    // tiroir n'est pas démonté quand il n'a rien à porter, il rend `null`. Sans
    // cette dépendance, l'effet ne se rejouerait pas au moment où il reparaît,
    // et sa hauteur resterait celle d'avant — ou zéro.
  }, [montre]);

  // **« Sans date » n'existe que pour qui peut écrire** (30 août 2026) : ses
  // deux seuls gestes — poser et supprimer — sont refusés au serveur pour un
  // salarié, et une liste accompagnée de boutons morts se lit comme une panne.
  const aSansDate = ecriture && sansDate.length > 0;
  const aAttente = attenteClient.length > 0;
  // **Ses deux gestes ne sont qu'à qui pose le planning** : supprimer, et la
  // porte « Devis expiré » de la carte du jour.
  const aExpires = ecriture && devisExpires.length > 0;
  /**
   * **LES DEMI-JOURNÉES RENDUES COMPTENT DANS CETTE PORTE — 10 sept. 2026.**
   *
   * Trouvé par la suite navigateur, à l'écran : un chantier dont on rend une
   * moitié alors que rien d'autre n'attend faisait un tiroir vide, donc ABSENT
   * — et le morceau n'existait plus nulle part. Le geste marchait, et il
   * n'était joignable qu'au hasard d'une autre liste (`CLAUDE.md` §5 quater).
   *
   * Comme « Sans date », elles ne s'offrent qu'à qui peut écrire : les reposer
   * est refusé au serveur pour un salarié, et une liste aux boutons morts se
   * lit comme une panne.
   */
  const aMorceaux = ecriture && morceaux.length > 0;
  /**
   * **Le dernier client posé tient le tiroir ouvert à lui seul.** Il vient de
   * poser le seul client qui attendait : la liste est vide, mais c'est là,
   * exactement, qu'il doit pouvoir revenir. Un tiroir qui disparaît à
   * l'instant du geste emporterait « Annuler » avec lui.
   */
  const aDefaire = ecriture && poseADefaire !== null;
  /**
   * **Un retrait qui attend tient le tiroir, lui aussi — 7 octobre 2026.** La
   * même règle que la pose juste au-dessus, qui avait oublié son pendant :
   * retirer le SEUL client de « Sans date » vidait la liste, le tiroir se
   * démontait, et « Annuler » partait avec lui. L'écriture, elle, tombait six
   * secondes plus tard : un client accepté par erreur, supprimé sans retour
   * (`test-supprimer-du-planning-e2e`).
   */
  const aRetire = ecriture && retraits.nombre > 0;
  const aDates = aEnvoyer.length > 0 || datesEnAttente.length > 0;
  if (!aSansDate && !aAttente && !aExpires && !aMorceaux && !aDefaire && !aRetire && !aDates) return null;
  /** Ceux qui attendent le client : un devis parti, ou les dates d'un mois. */
  const combienAttendent = attenteClient.length + datesEnAttente.length;

  /** Ce qui attend une place, morceaux compris — un seul compte, un seul mot. */
  const combienEnAttente =
    sansDate.length + morceaux.reduce((t, m) => t + m.combien, 0);

  /**
   * Ce que dit la poignée, et rien de plus.
   *
   * **Un jour touché change tout** : la question n'est plus « qu'ai-je en
   * attente » mais « qu'est-ce que je pose ici ». Le mot suit le geste.
   */
  const aPoser = (aSansDate || aMorceaux) && jourTouche !== null;
  const resume = aPoser
    ? `À poser sur ${jourLisibleCourt(jourTouche).toLowerCase()}`
    : [
        // **Un seul compte pour les deux**, et c'est son mot : une moitié
        // rendue et un chantier sans date sont la même chose — du travail qui
        // attend un jour. Deux comptes côte à côte auraient demandé de choisir
        // lequel est « sans date », question qui ne se pose pas pour lui.
        //
        // **« 1 client sans date », pas « 1 sans date »** — sa demande du
        // 12 septembre 2026. Le nombre seul ne disait pas de quoi il comptait ;
        // c'est le client qu'il attend de poser, et c'est le mot qu'il emploie.
        aSansDate || aMorceaux
          ? `${combienEnAttente} client${combienEnAttente > 1 ? "s" : ""} sans date`
          : null,
        // **Le TITRE de la liste, pas un raccourci** — son choix du 7 septembre
        // 2026 (planche « Deux mots du planning », variante B). « 1 chez le
        // client » ne disait ni ce qui est chez lui, ni ce qu'on attend : il
        // l'a signalé le matin même, *« on comprend pas bien ! »*. La poignée
        // annonce désormais ce qu'on trouve dedans, mot pour mot.
        // « Prêt à envoyer à Mme Costa » : le mot de sa planche 130.
        aEnvoyer.length > 0 ? pretAEnvoyer(aEnvoyer, datesDuMois?.donnees ?? null) : null,
        combienAttendent > 0 ? `${combienAttendent} ${EN_ATTENTE_DU_CLIENT.toLowerCase()}` : null,
        aExpires ? `${devisExpires.length} devis expiré${devisExpires.length > 1 ? "s" : ""}` : null,
      ]
        .filter(Boolean)
        .join(" · ") ||
      // Plus rien n'attend, et le dernier posé est encore à défaire.
      "Aucun client sans date";

  return (
    <div
      ref={cadre}
      data-atlas="tiroir-planning"
      data-ouvert={ouvert ? "1" : "0"}
      className="atlas-colonne-fixe z-[19]"
      style={{
        // **Juste au-dessus de la barre du bas, et mesuré par elle.**
        // `--atlas-barre` est sa hauteur réelle, indicateur d'accueil compris
        // (`globals.css`) : la recopier ici serait s'assurer qu'un jour l'une
        // bougera sans l'autre.
        bottom: "var(--atlas-barre)",
        // ─── ON DOIT VOIR OÙ IL COMMENCE — 11 septembre 2026 ──────────────
        //
        // **Sa remarque, capture à l'appui :** *« il faut rendre plus visible
        // la fenêtre qui s'ouvre "1 sans date" — quand elle est ouverte, on ne
        // la voit pas »*. Elle portait le fond de la PAGE (`cream`) : ouverte,
        // rien ne disait où la page finissait et où le tiroir commençait, et
        // ses listes semblaient flotter au bas de l'écran.
        //
        // **Le fond des cartes** (`card`), comme la fiche d'un jour deux
        // centimètres plus haut : c'est ce qui, dans cet écran, dit « ceci est
        // posé par-dessus ». Aucune couleur neuve, aucun trait de plus.
        background: colors.card,
        // ─── SA VERSION C, CHOISIE LE 11 SEPTEMBRE 2026 ───────────────────
        //
        // Planche `appli/tiroir-en-or.html`, quatre bords côte à côte : *« j'aime
        // bien la C »*. Deux pixels d'or et les angles qui se lèvent — l'or dit
        // « ceci s'ouvre » sans cerner tout le bas de l'écran, et les coins
        // montrent que le tiroir passe PAR-DESSUS le calendrier, ce que le fond
        // seul ne faisait pas.
        //
        // **D a été écartée, et c'est écrit sur la planche** : un cadre doré
        // complet est joli une fois et lourd tous les jours, sur un tiroir
        // présent à chaque ouverture du planning.
        borderTop: `${BORD_OR_DU_TIROIR}px solid ${colors.or}`,
        borderRadius: "14px 14px 0 0",
        // **Et l'ombre se creuse quand il est OUVERT.** Fermé, il n'est qu'une
        // poignée : une ombre soutenue en permanence salirait le bas de tous
        // les écrans du planning pour une liste que personne ne regarde.
        boxShadow: ouvert
          ? `0 -14px 34px ${voile(colors.ink, 0.18)}`
          : `0 -10px 28px ${voile(colors.ink, 0.08)}`,
      }}
    >
      {/* Le voile : sans lui, la poignée tranche net la rangée du mois qui
          passe dessous, et la coupure se lit comme un défaut d'affichage. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 h-6"
        style={{
          // **AU-DESSUS DU BORD DORÉ, pas dessus** — 12 septembre 2026, sa
          // capture à l'appui : *« j'avais demandé la planche avec le liseré
          // doré en haut, va vérifier ! »*. Le bord était bien là, et il ne se
          // voyait que dans les angles arrondis. Un élément absolu se place
          // depuis la boîte de REMPLISSAGE, sous le bord : à `-24`, les deux
          // derniers pixels du voile — pleins, couleur de carte — recouvraient
          // exactement les deux pixels d'or. On le remonte de l'épaisseur du
          // bord, et rien d'autre : le voile finit où l'or commence.
          top: -(24 + BORD_OR_DU_TIROIR),
          // **Il fond la rangée du mois dans le tiroir, donc il porte SA
          // couleur.** Resté sur le fond de page, il aurait redessiné la
          // coupure que le nouveau fond vient d'effacer.
          background: `linear-gradient(to top, ${colors.card}, ${voile(colors.card, 0)})`,
        }}
      />
      <button
        type="button"
        data-atlas="poignee-tiroir"
        aria-expanded={ouvert}
        aria-controls="tiroir-du-bas"
        onClick={() => setOuvert((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-[18px] py-[15px] text-left"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <span
          // **En noir, en gras** — sa demande du 12 septembre 2026, avec le
          // mot « client ». L'encre adoucie faisait de la poignée une note en
          // bas de page ; c'est la seule ligne qui dit ce qui attend un jour.
          // L'or reste à « À poser sur … » : là, c'est le geste qu'on annonce.
          className="min-w-0 flex-1 truncate text-[13px] font-semibold"
          style={{ color: aPoser ? colors.or : colors.ink }}
        >
          {resume}
        </span>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.chevron}
          strokeWidth="2.2"
          style={{
            flex: "none",
            transform: ouvert ? "rotate(180deg)" : "none",
            transition: "transform 320ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        id="tiroir-du-bas"
        className="overflow-hidden"
        // **FERMÉ, IL N'EXISTE PLUS POUR PERSONNE.**
        //
        // `max-height: 0` avec `overflow: hidden` ne cache rien : les boutons
        // gardent leur taille, le clavier les atteint encore par tabulation, et
        // un lecteur d'écran les annonce. Le navigateur, lui, les tient pour
        // VISIBLES — c'est ce qui a fait rougir `test-planning-e2e` : « Journée »
        // était trouvé, cliqué, et la poignée interceptait le doigt.
        //
        // `visibility` retire l'élément du doigt, du clavier et de la voix,
        // sans casser l'animation : à l'ouverture elle passe à `visible` tout de
        // suite, à la fermeture elle attend que le repli soit fini.
        style={{
          // **Une hauteur MAXIMALE, jamais une hauteur.** Le contenu varie —
          // trois chantiers sans date ou dix —, et une valeur fixe laisserait
          // soit un vide sous la dernière ligne, soit une liste coupée.
          maxHeight: ouvert ? 352 : 0,
          overflowY: ouvert ? "auto" : "hidden",
          visibility: ouvert ? "visible" : "hidden",
          transition: `max-height 420ms cubic-bezier(0.16,1,0.3,1), visibility 0s linear ${
            ouvert ? "0s" : "420ms"
          }`,
        }}
      >
        {/* ─── LE DERNIER POSÉ, ET LE MOT QUI LE DÉFAIT ────────────────────
            Sa planche du 18 septembre 2026 : « Mr. Linotte est sur jeudi 17
            septembre », et « Annuler » à droite, en gris — la même grammaire
            que le reste de la fiche. Il vit AU-DESSUS de la liste, et hors
            d'elle : quand le dernier client vient d'être posé, la liste n'a
            plus rien à montrer, et c'est précisément là qu'on veut pouvoir
            revenir. « Annuler » fait ce que fait « Retirer » sur la fiche du
            jour — un seul chemin d'écriture (`CLAUDE.md` §3). */}
        {ecriture && poseADefaire && (
          <>
            <div style={{ borderTop: `1px solid ${colors.line}` }} />
            <div
              data-atlas="pose-a-defaire"
              className="mx-[18px] flex min-h-[46px] items-center justify-between gap-3 pt-1 text-[14px]"
              style={{ color: colors.ink }}
            >
              <span className="min-w-0 flex-1">
                {poseADefaire.chantier.nom} est sur {jourLisibleCourt(poseADefaire.jour).toLowerCase()}
              </span>
              <MotEnOr doux data-atlas="defaire-la-pose" onClick={() => defairePose(poseADefaire.chantier.id)}>
                Annuler
              </MotEnOr>
            </div>
          </>
        )}

        {/* ─── LES DATES DU MOIS À ENVOYER — planche 130 ─────────────────────
            **En tête du tiroir** : c'est ce que la dernière date posée vient
            d'ouvrir, et l'écran y descend de lui-même. */}
        {datesDuMois &&
          aEnvoyer.map((g) => (
            <DatesAEnvoyer
              key={`${g.contratEntretienId}|${g.mois}`}
              groupe={g}
              donnees={datesDuMois.donnees}
              titre={
                <>
                  <div style={{ borderTop: `1px solid ${colors.line}` }} />
                  <TitreSection encadre aGauche>À envoyer</TitreSection>
                </>
              }
              onEnvoye={datesDuMois.onEnvoye}
            />
          ))}

        {/* ─── SANS DATE — et c'est d'ici qu'on POSE ──────────────────────── */}
        {/* **RIEN N'ATTEND DE JOUR : LA SECTION N'EXISTE PAS.** Sa question du
            25 août 2026 : *« est-ce que la catégorie sans date a un réel besoin
            d'exister ? »*. Elle en a un — c'est le seul endroit d'où un
            chantier reçoit sa date, et « Retirer » l'y renvoie — mais VIDE elle
            ne rend qu'un titre et un refus, au milieu d'un écran déjà long.

            C'est sa propre règle du 23 août, celle qui a fait disparaître
            « Ajouter un chantier » : un geste qui ne peut mener nulle part se
            retire au lieu de s'annoncer. La phrase du cul-de-sac vivait ici,
            et c'est elle que ce bouton promettait. */}
        {/* **PAS DE « SANS DATE » POUR UN SALARIÉ** — 30 août 2026. Cette
            section n'existe que pour deux gestes : poser un chantier sur le
            jour touché, et le supprimer. Les deux lui sont refusés au serveur.
            La laisser afficherait une liste de chantiers sans date accompagnée
            de boutons morts — sa propre règle du 23 août : un geste qui ne peut
            mener nulle part se retire au lieu de s'annoncer. */}
        {ecriture && (sansDate.length > 0 || morceaux.length > 0) && (
          <>
            {/* **Le trait qui sépare la poignée du dedans** — sa demande du
                11 septembre 2026, planche à l'appui : *« avec le trait qui
                sépare 1 sans date de sans date »*. Il vit ICI, dans le contenu
                qui se replie : posé sur le cadre, il resterait visible sous la
                poignée quand le tiroir est fermé. */}
            <div style={{ borderTop: `1px solid ${colors.line}` }} />
            {/* **PLUS DE TITRE « SANS DATE »** — sa demande du 12 septembre
                2026 : la poignée dit déjà « 1 client sans date » deux
                centimètres plus haut ; la pastille le redisait en dessous.
                Le mot en trop part, et la consigne remonte sous le trait. */}
            {/* ─── LE JOUR NE S'ÉCRIT PLUS DEUX FOIS — 17 septembre 2026 ────
                **Sa demande, capture à l'appui :** *« il y a écrit deux fois
                "à poser sur le mardi 22 septembre" : garde celle en doré,
                supprime en noir »*.

                La phrase est montée dans la poignée le 11 septembre, en or, à
                l'endroit du geste (`docs/planning-verdict.md`). Celle d'ici
                n'avait jamais été retirée : elle redisait mot pour mot la
                ligne dorée deux centimètres plus haut.

                **CE QUI RESTE, et ce n'est pas le doublon :** sans jour
                touché, la poignée ne dit que « 1 client sans date ». Rien
                n'apprend alors qu'il faut d'abord toucher un jour — et un
                « Poser » qui refuse sans dire pourquoi se lit comme une
                panne. Cette ligne-là est la seule qui l'explique, et c'est
                elle que trois suites cherchent
                (`test-planning-e2e`, `test-poser-une-date-e2e`,
                `test-salarie-planning-lecture-seule-e2e`). */}
            {!jourTouche && (
              <p
                data-atlas="ou-poser"
                // **Juste sous le trait, à gauche, en noir** — *« qu'on la voie
                // bien »*. C'est la seule ligne qui dit quoi faire de la liste ;
                // en gris, elle se lisait comme une note, et il touchait les noms.
                className="mx-[18px] mt-3 text-[12.5px]"
                style={{ color: colors.ink }}
              >
                Touchez d’abord un jour du calendrier
              </p>
            )}
            <div className="mx-[18px] mt-3">
              {sansDate.map((c, i) => (
                <LigneRetirable
                  key={c.id}
                  libelle={`le chantier ${c.nom}`}
                  retiree={retraits.estRetire(c.id)}
                  onRetirer={() => demanderSuppression(c)}
                  hauteurMax={64}
                  className="flex"
                >
                  <div
                    data-atlas="sans-date"
                    className="flex w-full items-center justify-between gap-2.5"
                    // **Le filet SÉPARE deux lignes, il ne souligne pas la
                    // dernière** — sa demande du 26 août : *« supprime le trait
                    // sous Jean Louis »*. Avec un seul chantier en attente, le
                    // trait ne séparait rien : il soulignait un nom. C'est la
                    // règle qu'emploie déjà la liste « En attente du client »
                    // deux blocs plus bas, reprise ici plutôt qu'inventée.
                    style={{
                      borderBottom:
                        i === sansDate.length - 1 ? "none" : `1px solid ${colors.line}`,
                    }}
                  >
                    {/* ─── LE NOM SEUL POSE LE CLIENT — ses réponses du 17 sept. 2026
                        *« Au lieu du "Poser" entouré, le mieux serait qu'on
                        clique sur Mr. Linotte »*, puis, le soir : *« laisse
                        juste le nom du client et retire le contour doré »*.
                        Le bouton « Poser » et le chevron « › » partent ; le
                        nom porte le geste, et `data-poser` avec lui — les
                        suites le cherchent là. Ce que le « › » emportait, il le
                        sait : le chantier s'ouvre depuis l'onglet Chantiers.

                        **Sans jour touché, rien ne s'appuie** : la ligne reste
                        un texte, et `data-poser` n'existe pas
                        (`test-poser-une-date-e2e`). La poignée dit « À poser
                        sur … » en or : c'est elle qui annonce le geste.

                        **La durée, en gris, à droite** — sa planche du 18 :
                        c'est elle qui dit qu'une demi-journée trouvera sa place
                        dans une journée déjà entamée. */}
                    {jourTouche ? (
                      /* **UN SEUL GESTE, ET LE JOUR EST DÉJÀ ÉCRIT AU-DESSUS.**
                         Les trois moments vivaient ici aussi — même question,
                         même défaut : ils écrasaient la durée que le devis avait
                         fixée (voir `poser`). Les laisser dans ce tiroir après
                         les avoir retirés de la carte du jour aurait fait deux
                         façons de poser un chantier, et c'est exactement ce que
                         `CLAUDE.md` §3 interdit : elles auraient divergé. */
                      <button
                        type="button"
                        data-poser="1"
                        aria-label={`Poser ${c.nom} sur ${jourLisibleCourt(jourTouche)}`}
                        onClick={() => poser(c.id, jourTouche)}
                        className="flex min-h-[50px] min-w-0 flex-1 cursor-pointer items-center justify-between gap-2.5 border-0 bg-transparent px-0 py-[11px] text-left"
                        style={{ color: colors.ink, WebkitTapHighlightColor: "transparent" }}
                      >
                        <span
                          className="min-w-0 flex-1 truncate"
                          style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.2 }}
                        >
                          {c.nom}
                        </span>
                        <span className="flex-none text-[12.5px]" style={{ color: colors.muted }}>
                          {ditCeQuIlOccupe(c)}
                        </span>
                      </button>
                    ) : (
                      <div className="flex min-h-[50px] min-w-0 flex-1 items-center justify-between gap-2.5 py-[11px]">
                        <span
                          className="min-w-0 flex-1 truncate"
                          style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.2 }}
                        >
                          {c.nom}
                        </span>
                        <span className="flex-none text-[12.5px]" style={{ color: colors.muted }}>
                          en attente d’un jour
                        </span>
                      </div>
                    )}
                  </div>
                </LigneRetirable>
              ))}

              {/* ─── LES DEMI-JOURNÉES RENDUES — 10 septembre 2026 ─────────
                  *« La demi-journée de Mr Julien qui a été retirée peut être
                  replacée. »* On la touche ici, puis on touche la demi-journée
                  qui l'accueille : deux gestes, comme poser un chantier.

                  **Pas de « Retirer » sur ces lignes-là**, et ce n'est pas un
                  oubli : le chantier, lui, n'est pas sans date — c'est une
                  moitié de lui qui attend. Le retirer entier se fait depuis sa
                  journée, où il est encore posé. */}
              {morceaux.map((m, i) => {
                const tenu = morceauEnMain === m.chantier.id;
                return (
                  <button
                    key={`morceau-${m.chantier.id}`}
                    type="button"
                    data-atlas="morceau-a-poser"
                    data-chantier={m.chantier.id}
                    aria-pressed={tenu}
                    onClick={() => onPrendreMorceau(m.chantier.id)}
                    className="flex w-full items-center justify-between gap-2.5 py-[11px] text-left"
                    style={{
                      borderBottom:
                        i === morceaux.length - 1 ? "none" : `1px solid ${colors.line}`,
                    }}
                  >
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{
                        fontFamily: font.display,
                        fontSize: 19,
                        lineHeight: 1.2,
                        color: tenu ? colors.or : colors.ink,
                      }}
                    >
                      {m.chantier.nom}
                    </span>
                    <span className="flex-none text-[12.5px]" style={{ color: colors.muted }}>
                      {tenu
                        ? "touchez une demi-journée"
                        : m.combien === 1
                          ? "½ journée à poser"
                          : `${m.combien} demi-journées à poser`}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Le tiroir d'annulation vit DANS celui du bas, et non plus en fin de
            page. Deux tiroirs cloués au même bord se seraient recouverts ; et
            « Retirer » se déclenche depuis cette liste-ci, donc l'annulation
            doit être là où le geste a eu lieu. */}
        {ecriture && (
          <TiroirDesRetires
            dernier={retraits.dernier}
            nombre={retraits.nombre}
            onAnnuler={retraits.annuler}
            compteARebours={retraits.compteARebours}
            className="mt-6"
          />
        )}

        {/* ─── EN ATTENTE DU CLIENT ───────────────────────────────────────── */}
        {combienAttendent > 0 && (
          <>
            <TitreSection encadre aGauche data-atlas="titre-attente-client">
              {EN_ATTENTE_DU_CLIENT}
            </TitreSection>
            <div className="mx-[18px] mt-3">
              {attenteClient.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2.5 py-[11px]"
                  style={{
                    borderBottom:
                      i === attenteClient.length - 1 ? "none" : `1px solid ${colors.line}`,
                  }}
                >
                  <span
                    className="min-w-0 flex-1 truncate"
                    style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.2 }}
                  >
                    {c.nom}
                  </span>
                  <span
                    className="flex-shrink-0 text-right text-[12.5px]"
                    style={{ color: colors.muted }}
                  >
                    Il choisit sa date
                  </span>
                  {portesOuvertes && <ChevronDesPortes chantier={c} onPortes={onPortes} />}
                </div>
              ))}
              {datesDuMois &&
                datesEnAttente.map((g, i) => (
                  <DatesEnAttente
                    key={`${g.contratEntretienId}|${g.mois}`}
                    groupe={g}
                    donnees={datesDuMois.donnees}
                    derniere={i === datesEnAttente.length - 1}
                  />
                ))}
            </div>
          </>
        )}

        {/* ─── LES DEVIS EXPIRÉS — sa planche du 7 octobre 2026 ──────────────
            (`appli/devis-expires.html`). 45 jours sans réponse : le lien est
            mort. La phrase dit pourquoi ils sont là, sa demande du même soir ;
            la croix ouvre la même question que « Sans date », puis la barre
            d'or de six secondes. Les poser se fait par la porte « Devis
            expiré » de la carte du jour. */}
        {aExpires && (
          <>
            <TitreSection encadre aGauche data-atlas="titre-devis-expires">
              Devis expirés
            </TitreSection>
            <p className="mx-[18px] mt-2 text-[12.5px] leading-[1.45]" style={{ color: colors.muted }}>
              Le lien envoyé au client n&apos;est valable que {VALIDITE_LIEN_JOURS} jours. Pour ceux-ci, il a
              expiré sans réponse.
            </p>
            <div className="mx-[18px] mt-2">
              {devisExpires.map((c, i) => (
                <LigneRetirable
                  key={c.id}
                  libelle={`le chantier ${c.nom}`}
                  retiree={retraits.estRetire(c.id)}
                  onRetirer={() => demanderSuppression(c)}
                  hauteurMax={64}
                  className="flex"
                >
                  <div
                    data-atlas="devis-expire"
                    className="flex min-h-[50px] w-full items-center justify-between gap-2.5 py-[11px]"
                    style={{
                      borderBottom: i === devisExpires.length - 1 ? "none" : `1px solid ${colors.line}`,
                    }}
                  >
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.2 }}
                    >
                      {c.nom}
                    </span>
                    {c.envoiExpireAt && (
                      <span className="flex-none text-[12.5px]" style={{ color: colors.muted }}>
                        Expiré le {jourEnLettres(c.envoiExpireAt)}
                      </span>
                    )}
                  </div>
                </LigneRetirable>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
