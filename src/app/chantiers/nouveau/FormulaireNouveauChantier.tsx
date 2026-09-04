"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, libelleCaps, smallCaps } from "@/lib/design-tokens";
import ChoixCanal from "@/components/atlas/ChoixCanal";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import ChampAdresse from "@/components/atlas/ChampAdresse";
import DicterCoordonnees from "./DicterCoordonnees";
import type { CoordonneesDictees } from "@/lib/coordonnees-dictees";
import { creerChantierAction } from "./actions";
import { reprendreChantierAction } from "../[id]/coordonnees/actions";
import { apresLesCoordonnees, retourDesCoordonnees, type Provenance } from "@/lib/retour-du-devis";
import ChoixCivilite from "@/components/atlas/ChoixCivilite";
import Pellicule, { type VignettePhoto } from "../[id]/Pellicule";
import AnneauNoteVocale from "../[id]/AnneauNoteVocale";
import DevisDepuisDictee from "../[id]/DevisDepuisDictee";
import type { Civilite } from "@/lib/civilite";
import { espacerNumero, numeroEnregistre } from "@/lib/numero-telephone";

// Intégration réelle : la création passe désormais par une Server Action
// (creerChantierAction), qui persiste le chantier (et le client s'il est
// renseigné) dans la base réelle, dans le contexte de l'entreprise active.
//
// Comportement clavier mobile : le bouton principal reste dans le flux normal de
// la page (pas de position fixed) — pas de risque de chevauchement à l'ouverture
// du clavier. Les champs utilisent une taille de police ≥16px pour éviter le zoom
// automatique d'iOS Safari au focus.

/**
 * Le formulaire de création, extrait de sa page le 10 août 2026.
 *
 * **Pourquoi il ne vit plus seulement dans une page.** L'écran retenu par le
 * patron ouvre « Nouveau chantier » en FEUILLE : la liste recule, s'assombrit,
 * et le formulaire monte devant elle. La route `/chantiers/nouveau` reste — les
 * suites de bout en bout y vont directement, et un lien profond doit continuer
 * de fonctionner. Deux formulaires auraient divergé au premier champ ajouté ;
 * il n'y en a qu'un, et il ne connaît de son hôte que deux choses : s'il est en
 * feuille, et comment se refermer.
 */
/**
 * Où l'on va en sortant de cet écran — et ce n'est plus un « choix » à faire
 * avant d'agir : depuis le 18 août 2026, chaque bouton porte sa destination.
 *
 * `fiche` mène à la fiche du chantier, là où l'on dicte. `devis` mène au devis
 * entier, à remplir soi-même. Les deux passent par la MÊME création : voir
 * `creerPuisAller`.
 */
type Destination = "fiche" | "devis";

/**
 * Un chantier DÉJÀ LÀ, que cet écran rouvre au lieu d'en créer un.
 *
 * **Sa demande du 17 août 2026 :** *« lorsque s'affiche Adresse non renseignée,
 * je puisse cliquer dessus et que ça m'amène sur la page […] RIEN DE PLUS, RIEN
 * DE MOINS »* — la page en question étant celle-ci, sa propre capture à l'appui.
 *
 * **Pourquoi le même composant, et pas un second écran.** Un formulaire jumeau
 * aurait divergé au premier champ ajouté : l'un enregistrerait le canal d'envoi,
 * l'autre l'aurait oublié. C'est la raison qui avait déjà fait extraire ce
 * formulaire de sa page le 10 août — « il n'y en a qu'un, et il ne connaît de
 * son hôte que deux choses ».
 */
export type ChantierRepris = {
  id: string;
  /** D'où il est entré — le devis le renvoie chez lui (`retour-du-devis.ts`). */
  provenance: Provenance;
  /**
   * Ce que le chantier porte DÉJÀ — 31 août 2026.
   *
   * **Sans elles, l'écran mentirait.** Une pellicule vide sur un chantier
   * photographié, un anneau muet sur une dictée existante : il croirait avoir
   * perdu ce qu'il avait posé, et recommencerait.
   */
  photos: VignettePhoto[];
  /** `null` : aucune note. `storageKey` à `null` : la note existe, l'audio a été purgé. */
  note: { storageKey: string | null; dureeSecondes: number | null } | null;
  nomClient: string;
  civilite: Civilite | null;
  telephone: string;
  email: string;
  canal: "sms" | "email" | null;
  adresseChantier: string;
  /** Vide quand elle est la même que celle du chantier — l'écran ne la montre
   *  alors pas, comme à la création. */
  adresseClient: string;
};

export default function FormulaireNouveauChantier({
  enFeuille = false,
  onFermer,
  reprise,
}: {
  enFeuille?: boolean;
  onFermer?: () => void;
  /** Présent : l'écran ENREGISTRE sur ce chantier au lieu d'en créer un. */
  reprise?: ChantierRepris;
} = {}) {
  const router = useRouter();
  const [nomClient, setNomClient] = useState(reprise?.nomClient ?? "");
  const [civilite, setCivilite] = useState<Civilite | null>(reprise?.civilite ?? null);
  const [telephone, setTelephone] = useState(reprise?.telephone ?? "");
  const [email, setEmail] = useState(reprise?.email ?? "");
  const [canalChoisi, setCanalChoisi] = useState<"sms" | "email" | null>(reprise?.canal ?? null);
  const [adresseChantier, setAdresseChantier] = useState(reprise?.adresseChantier ?? "");
  const [adresseClient, setAdresseClient] = useState(reprise?.adresseClient ?? "");
  // Déjà dépliée quand elle porte quelque chose : la replier cacherait une
  // adresse qu'il a saisie, et il la croirait perdue.
  const [adresseClientVisible, setAdresseClientVisible] = useState(
    (reprise?.adresseClient ?? "").length > 0
  );
  // **Quel bouton travaille**, et pas seulement « ça travaille ». Les deux
  // capsules sont identiques ; sans cela, « Création… » s'afficherait sur celle
  // qu'il n'a pas touchée, et il croirait s'être trompé de geste.
  const [enCoursVers, setEnCoursVers] = useState<Destination | null>(null);
  const enCours = enCoursVers !== null;
  const [erreur, setErreur] = useState<string | null>(null);

  // Plus rien n'est obligatoire : le chantier prend le nom de ce qui a été
  // donné, et la date s'il n'y a rien (`src/lib/nom-chantier.ts`).
  const peutCreer = !enCours;

  // Le canal se devine dans la plupart des cas : une seule coordonnée renseignée
  // ne laisse pas d'ambiguïté. Le choix explicite du patron prime toujours —
  // c'est un accord passé avec son client, pas une déduction de l'application.
  const aTelephone = telephone.trim().length > 0;
  const aEmail = email.trim().length > 0;
  const canal = canalChoisi ?? (aTelephone ? "sms" : aEmail ? "email" : null);

  /**
   * Ce que la dictée a compris entre dans les champs VIDES seulement.
   *
   * Écraser une saisie parce qu'on a dicté ensuite serait la pire façon
   * d'aider : le patron aurait tapé le numéro, dicté l'adresse, et perdu le
   * numéro sans comprendre pourquoi.
   */
  function appliquerDictee(c: CoordonneesDictees) {
    if (c.nom && !nomClient.trim()) setNomClient(c.nom);
    if (c.telephone && !telephone.trim()) setTelephone(c.telephone);
    if (c.email && !email.trim()) setEmail(c.email);
    if (c.adresse && !adresseChantier.trim()) setAdresseChantier(c.adresse);
  }

  /**
   * Crée le chantier, puis mène là où le patron a dit vouloir aller.
   *
   * **Une seule création, deux destinations.** Le patron, le 11 août 2026 :
   * *« si je clique sur "ou rédiger le devis à la main", ça m'ouvre la page du
   * devis complet, avec les informations du client qui se seront ajoutées
   * automatiquement ? »* — oui, et c'est justement parce que le chantier est
   * créé d'abord que ça marche : `devis-complet` lit le client rattaché au
   * chantier (`devis-complet/page.tsx`). Sauter la création pour « gagner du
   * temps » produirait le devis orphelin qu'il redoutait.
   *
   * Écrire deux fonctions de création aurait fait diverger les deux chemins au
   * premier champ ajouté — l'un enregistrerait le téléphone, l'autre l'aurait
   * oublié.
   */
  /**
   * Le chantier créé par un geste de l'écran — photo ou dictée — s'il l'a été.
   *
   * **Il ne peut y en avoir qu'un.** Trois photos et une dictée, c'est un seul
   * chantier : la promesse en cours est gardée pour que deux gestes simultanés
   * n'en fabriquent pas deux (`creationEnCours`).
   */
  const [chantierCree, setChantierCree] = useState<string | null>(null);
  const [dicteeFaite, setDicteeFaite] = useState(false);
  /**
   * Une dictée est-elle en cours ?
   *
   * **Sa demande du 30 août 2026 :** *« lorsque l'utilisateur clique sur le
   * bouton de la note vocale, le bouton "Je rédige à la main" disparaît pour ne
   * plus avoir de confusion possible. L'utilisateur ne pourra donc plus se
   * tromper. »* Deux issues offertes en même temps, c'est une occasion de se
   * tromper ; il n'en reste qu'une pendant qu'on parle.
   */
  const [dicteeEnCours, setDicteeEnCours] = useState(false);
  const creationEnCours = useRef<Promise<string> | null>(null);

  /**
   * Fait exister le chantier, maintenant, avec ce qui est saisi.
   *
   * **Sa demande du 21 août 2026 :** il photographie et il dicte AVANT que le
   * chantier existe — c'est le geste qui le crée, pas un bouton. *« Dès que je
   * rappuie sur la note vocale pour stopper l'enregistrement, il faut
   * impérativement que les infos aillent s'enregistrer »*, parce qu'il est en
   * rendez-vous et qu'il va fermer l'application.
   *
   * **En reprise, il n'y a rien à créer** : le chantier est déjà là.
   */
  async function assurerChantier(): Promise<string> {
    if (reprise) return reprise.id;
    if (chantierCree) return chantierCree;
    if (creationEnCours.current) return creationEnCours.current;

    const promesse = creerChantierAction({
      nomClient,
      civilite: civilite ?? undefined,
      telephone: numeroEnregistre(telephone),
      email,
      canal: canal ?? undefined,
      adresseChantier,
      adresseClient,
    }).then(({ id }) => {
      setChantierCree(id);
      creationEnCours.current = null;
      return id;
    });
    creationEnCours.current = promesse;
    return promesse;
  }

  /**
   * Reporte la saisie sur un chantier déjà créé par un geste de l'écran.
   *
   * **Le cas est courant, pas théorique :** il dicte d'abord — le chantier
   * naît alors avec un nom vide —, puis il tape le nom du client avant de
   * toucher le bouton. Sans ce report, tout ce qui a été saisi APRÈS le premier
   * geste serait perdu, en silence.
   */
  async function enregistrerSurLeChantier(id: string): Promise<string> {
    const r = await reprendreChantierAction(id, {
      nomClient,
      civilite: civilite ?? undefined,
      telephone: numeroEnregistre(telephone),
      email,
      canal: canal ?? undefined,
      adresseChantier,
      adresseClient,
    });
    if (!r.ok) throw new Error(r.raison);
    return id;
  }

  async function creerPuisAller(vers: Destination) {
    if (enCours) return;
    setEnCoursVers(vers);
    setErreur(null);

    // **Rouvert, l'écran ENREGISTRE — il ne crée pas un second chantier.** La
    // saisie est la même, la destination aussi ; seul le chemin d'écriture
    // change, et il vit côté serveur (`coordonnees/actions.ts`).
    if (reprise) {
      const r = await reprendreChantierAction(reprise.id, {
        nomClient,
        civilite: civilite ?? undefined,
        // Espacé à l'écran, en chiffres en base — voir `numeroEnregistre`.
        telephone: numeroEnregistre(telephone),
        email,
        canal: canal ?? undefined,
        adresseChantier,
        adresseClient,
      });
      if (!r.ok) {
        // Le refus se dit en toutes lettres, jamais un `catch {}` muet : le
        // 11 août 2026, « impossible d'enregistrer la note » ne pouvait être
        // expliqué par personne (`AGENTS.md`).
        setErreur(r.raison);
        setEnCoursVers(null);
        return;
      }
      // **Enregistré, on repart d'où l'on venait** — 31 août 2026. Entré
      // depuis un devis sans client, il retrouve son devis, qui porte
      // désormais la fiche qui lui manquait ; entré depuis l'accueil, la fiche
      // du chantier, comme depuis le 17 août.
      router.push(
        vers === "devis"
          ? `/chantiers/${reprise.id}/devis-complet`
          : apresLesCoordonnees(reprise.id, reprise.provenance)
      );
      return;
    }

    try {
      // **Un chantier déjà né d'une photo ou d'une dictée n'est pas recréé** —
      // sinon la moitié de ce qu'il vient de faire resterait sur un chantier
      // fantôme, et il verrait deux lignes à l'accueil pour un seul client.
      const id = chantierCree
        ? await enregistrerSurLeChantier(chantierCree)
        : await assurerChantier();
      router.push(vers === "devis" ? `/chantiers/${id}/devis-complet` : `/chantiers/${id}`);
    } catch {
      setErreur("Impossible de créer le chantier pour l'instant. Réessayez.");
      setEnCoursVers(null);
    }
  }

  return (
    <div
      style={{
        backgroundColor: enFeuille ? "transparent" : colors.cream,
        color: colors.ink,
        fontFamily: font.body,
        minHeight: enFeuille ? undefined : "100%",
      }}
    >
      {/* **La bulle de l'assistant flotte au-dessus du bas de l'écran — mais
          seulement EN PAGE.** Mesuré le 11 août 2026 : la phrase de pied
          tombait sous elle, et `finDePage: 0` — aucun défilement ne l'en
          dégageait. Elle était donc illisible en permanence, sur la moitié de
          sa largeur.

          En FEUILLE, rien à réserver : celle-ci est `fixed` en `z-[50]` et
          recouvre déjà la bulle et le bandeau du bas (`EcranChantiers.tsx`).
          Y poser la même réserve ajoutait quatre-vingts pixels de vide sous le
          formulaire, pour se protéger de quelque chose qui n'y arrive pas. */}
      {/* ═══════════════════════════════════════════════════════════════════
          **UNE SEULE PAGE, CENTRÉE — sa demande du 1ᵉʳ septembre 2026 :**
          *« la page doit remplir tout l'espace, elle n'est pas centrée. Je veux
          qu'une seule page mais centrée, il y a trop de marge en bas et en
          haut, la note vocale est presque coupée tellement elle est haute. »*

          **MESURÉ AVANT DE TOUCHER** (`scripts/capture-fiche-client-hauteur.mts`) :
          la page faisait 933 px pour un écran de 844, dont **272 px de réserve
          en bas** — un `pb-40` ici PLUS un `pb-28` sur le formulaire, cumulés
          sans que rien ne les additionne jamais. La barre d'onglets, elle,
          mesure **48 px**. On réservait donc près de six fois ce qu'il fallait,
          et tout le contenu était poussé vers le haut : d'où le micro « presque
          coupé » et le grand vide sous le bouton.

          **LA HAUTEUR SE CALCULE, elle ne se copie pas — et deux essais l'ont
          appris.** Une hauteur d'écran entière (`100svh`) s'AJOUTE à la réserve
          que le gabarit pose déjà (`main.atlas-contenu`, 68 px) : la page
          faisait alors 912 px pour 844 de fenêtre. Et `min-h-full` ne vaut
          rien du tout — un pourcentage sur un parent qui n'a lui-même qu'un
          `min-height` ne résout pas, si bien que la page cessait de déborder
          mais restait collée en haut, tout le vide en dessous.

          On retire donc la réserve du gabarit à la hauteur d'écran, en lisant
          SA variable : le jour où la barre d'onglets change de taille, ce
          calcul suit tout seul.

          **`my-auto` plutôt que `justify-center`, et ce n'est pas un détail.**
          Un centrage par `justify-content` déborde des DEUX côtés quand le
          contenu dépasse : sur un petit iPhone, le haut de la fiche passerait
          au-dessus du pli, inatteignable même en défilant. Les marges
          automatiques, elles, n'absorbent que la place LIBRE — s'il n'y en a
          pas, elles valent zéro et l'écran se lit normalement depuis le haut.
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        className={enFeuille ? "" : "flex flex-col"}
        style={enFeuille ? undefined : { minHeight: "calc(100svh - var(--atlas-barre))" }}
      >
      <div className={enFeuille ? "" : "my-auto w-full"}>
        {/* Retour discret — même style que la fiche chantier. En feuille il
            referme sans quitter l'accueil ; en page il y revient. Le dessin est
            le même : c'est le même geste pour le patron. */}

        {/* **`items-center` et non plus `items-start`.** Sans le surtitre, le
            bloc de gauche n'a plus qu'une ligne : le micro aligné par le haut
            se posait au-dessus du titre au lieu d'en face. Mesuré à l'écran —
            les deux centres tombent maintenant sur le même pixel. */}
        <div className="flex items-center justify-between gap-3 px-6">
          {/* **Le retour est SUR la ligne du titre, et c'est un chevron nu** —
              22 août 2026, sa maquette codée trait pour trait (`.entete` dans
              `appli/fiche-client-vocale.html`). Il occupait auparavant une
              ligne à lui, dans un rond beige : deux lignes d'en-tête là où sa
              planche n'en veut qu'une, et le titre repoussé d'autant. */}
          {enFeuille ? (
            <button
              type="button"
              onClick={onFermer}
              aria-label="Retour à la liste des chantiers"
              className="-ml-1 flex h-8 w-6 flex-shrink-0 items-center justify-center"
            >
              <FlecheRetour />
            </button>
          ) : (
            /* **La flèche repart d'où il est entré.** Depuis un devis sans
               client (31 août 2026), elle y retourne — sans quoi le devis
               qu'il lisait serait à retrouver seul. Partout ailleurs, la
               liste : c'est la sortie de l'écran de création, et celle de la
               reprise ouverte depuis l'accueil. */
            <Link
              href={retourDesCoordonnees(reprise?.provenance ?? null)}
              aria-label={
                reprise?.provenance ? "Retour au devis" : "Retour à la liste des chantiers"
              }
              className="-ml-1 flex h-8 w-6 flex-shrink-0 items-center justify-center"
            >
              <FlecheRetour />
            </Link>
          )}
          <div className="flex-shrink-0">
            {/* **« Fiche client », et plus de surtitre du tout.** Sa demande du
                16 août 2026, capture à l'appui : *« Enlève nouveau un chantier
                et remplace par fiche client. »*

                **Le surtitre disparaît avec le mot qui le justifiait.** Il
                portait « Nouveau » — que le titre ne reprend plus — et « Les
                coordonnées » en reprise, écrit la veille pour la seule raison
                que « nouveau » aurait été faux au-dessus d'un chantier ouvert
                trois jours plus tôt. Ce contre-mot n'a plus rien à contrer :
                « Fiche client » est vrai dans les deux cas, à la création
                comme à la reprise. Lui garder une ligne au-dessus obligerait
                à inventer un mot qu'il n'a pas demandé (`CLAUDE.md` §4). */}
            {/* **Le titre ne se brise JAMAIS en deux** — `test-attente-dictee-e2e`
                tient cette promesse, et il l'a fait rougir le 22 août : la
                flèche de retour, ramenée sur cette ligne, lui a pris trente-six
                pixels, et la phrase d'attente de la dictée (190 px, à droite) a
                fini de le casser. Un titre qui se réorganise pendant qu'il
                attend donne l'impression d'un écran qui part en morceaux.
                « Fiche client » est une étiquette, pas du texte : elle garde sa
                largeur, et c'est la phrase qui se replie. */}
            <h1
              className="whitespace-nowrap text-[27px] leading-[1.05]"
              style={{ fontFamily: font.display }}
            >
              Fiche client
            </h1>
          </div>
          {/* Le raccourci pour qui a les mains prises — jamais l'action
              principale de cet écran, d'où le rond discret plutôt qu'un
              bouton. */}
          <DicterCoordonnees onCoordonnees={appliquerDictee} />
        </div>

        <form
          // **Le talon du bas n'est pas décoratif** (21 août 2026, vu à la
          // capture) : la barre d'onglets est FIXÉE au bas de l'écran, et sans
          // lui elle coupait l'anneau en deux — le geste principal de l'écran,
          // à moitié sous une barre. Ni les types ni les suites ne voient cela.
          className={`flex flex-col gap-[4px] px-6 pt-1.5 pb-2`}
          onSubmit={(e) => {
            e.preventDefault();
            // « Entrée » fait ce que fait le bouton, et il n'y en a plus qu'un.
            creerPuisAller("devis");
          }}
        >
          {/* 1 — Nom du client.
              Le champ « Nom du chantier » a été retiré le 2026-08-05, à la
              demande du patron. C'était le seul champ obligatoire, et le seul
              qui lui demandait d'inventer quelque chose : un élagueur ne
              baptise pas ses chantiers, il dit « chez M. Bernard ». Le nom se
              déduit désormais du client, sinon de l'adresse, sinon de la date
              (`src/lib/nom-chantier.ts`). Rien n'est fabriqué : c'est une
              étiquette, pas une donnée sur le chantier. */}
          {/* **La civilité se choisit AU-DESSUS du nom**, comme il l'a demandé
              le 13 août 2026. Rien n'est présélectionné : son silence ne doit
              pas devenir un choix (`src/components/atlas/ChoixCivilite.tsx`).

              **Son intitulé part le 21 août 2026** : *« enlève civilité »*,
              puis *« non, remets le Mr et Mme, je voulais juste que tu enlèves
              le TITRE »*. Les deux pastilles se comprennent seules, et c'est
              une ligne de petites capitales de moins en haut de l'écran. */}
          <ChoixCivilite valeur={civilite} onChange={setCivilite} sansLegende />

          {/* **Le nom et le numéro sur la MÊME ligne** — sa demande du 21 août
              2026, qu'il avait déjà essayée lui-même en tapant le numéro dans
              la case du nom : *« je pense que ça passe »*.

              Ça passe, à une condition : que le numéro ne se comprime pas. Il
              est donc à largeur FIXE et c'est le nom qui prend ce qui reste —
              un nom trop long se tronque à l'affichage sans rien coûter, un
              numéro tronqué ne se rappelle pas. La largeur est mesurée, pas
              estimée : à 132 px, « 06 79 98 45 14 » perdait son dernier
              chiffre, en silence.

              **Le champ « Téléphone » seul a disparu** dans le même geste : le
              numéro est ici. */}
          {/* **Ces deux-là gardent leur intitulé, et ce n'est pas une exception
              arbitraire : sa planche l'écrit** (`.duo-titres` dans
              `appli/note-vocale-choix.html`). Une case vide de 152 px alignée à
              droite ne dit pas d'elle-même qu'elle attend un numéro, et « Nom du
              client » est la donnée qui crée la fiche. Les quatre autres
              intitulés, eux, sont partis : sa planche les met en `aria-label`. */}
          <div
            aria-hidden="true"
            className={`flex items-end gap-[9px] ${libelleCaps}`}
            style={{ color: colors.muted }}
          >
            <span className="min-w-0 flex-1 leading-[1.35]">Nom du client</span>
            <span className="w-[152px] flex-shrink-0 text-right leading-[1.35]">Téléphone</span>
          </div>
          <div className="-mt-[3px] flex gap-[9px]">
            {/* **`flex-1 min-w-0`, et c'est ce qui empêchait l'écran de se
                balader de droite à gauche.** Le nom était `flex-shrink-0` sans
                `flex-1` : il gardait la largeur NATURELLE d'un `<input>` — 273 px
                — et poussait le téléphone de 148 px à 421, soit 31 px hors d'un
                écran qui en fait 390. Le viewport de mise en page s'élargissait
                pour l'accueillir, la barre du bas suivait, et toute la page
                glissait latéralement. Mesuré le 30 août 2026
                (`scripts/capture-dictee-fiche-client.mts`) ; sa maquette, elle,
                l'écrivait juste depuis le début : `.duo .nom{flex:1;min-width:0}`.

                `min-w-0` n'est pas décoratif : sans lui, un élément de flex
                refuse de descendre sous la largeur de son contenu, et le
                `flex-1` ne sert à rien. */}
            <div className="min-w-0 flex-1">
              {/* **Plus de `big`** : sa maquette écrit toutes les cases au même
                  corps (`input{font-size:16px}`), et la case du nom y a donc la
                  même hauteur que celle du téléphone. Le serif de 20 px la
                  faisait dépasser de six pixels — visible à la capture, et
                  c'est ce qu'il montrait du doigt le 22 août. */}
              <Field
                label="Nom du client"
                placeholder="Bernard"
                value={nomClient}
                onChange={setNomClient}
                sansLibelle
              />
            </div>
            <div className="w-[152px] flex-shrink-0">
              <Field
                label="Téléphone"
                placeholder="06 12 34 56 78"
                type="tel"
                value={telephone}
                onChange={(v) => setTelephone(v)}
                aLaFrappe={espacerNumero}
                aDroite
                sansLibelle
              />
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              **LES QUATRE CASES PORTENT DE NOUVEAU LEUR NOM — son choix du
              2 septembre 2026**, planche « A — Épurée »
              (`appli/fiche-client-haut-de-gamme.html`).

              **C'EST UN REVIREMENT, ET IL EST ASSUMÉ.** Les intitulés avaient
              été retirés le 30 août à sa demande : *« je veux que tout tienne
              sur une seule page »*. Deux d'entre eux seulement étaient restés
              (le nom et le numéro), et les deux autres cases ne tenaient qu'à
              leur exemple en gris — qui disparaît à la première touche. Au
              soleil, on ne savait plus laquelle attendait quoi.

              **CE QUI REND SA CONTRAINTE DU 30 AOÛT TENABLE MALGRÉ TOUT :** les
              trente-six pixels des deux libellés sont payés, pas ajoutés —
              vingt-huit rendus par la rangée « + Ajouter une adresse client
              différente », qui remonte au bout de l'intitulé « Chantier », et
              vingt-sept par l'écart des blocs, ramené de 7 à 4 px. L'écran
              reste dans la feuille, et `scripts/capture-fiche-client-hauteur.mts`
              le mesure.
              ═══════════════════════════════════════════════════════════════ */}
          <div>
            <div className={`mb-1 ${libelleCaps}`} style={{ color: colors.muted }}>
              E-mail
            </div>
            <Field
              label="E-mail"
              placeholder="bernard@exemple.fr"
              type="email"
              value={email}
              onChange={setEmail}
              sansLibelle
            />
          </div>

          {/* 6 — Adresse du chantier : facultative, et proposée pendant la
              frappe. Le champ reste libre : un lieu-dit ou un chemin de
              campagne ne figure dans aucune base, et le patron y travaille
              (`src/components/atlas/ChampAdresse.tsx`). */}
          <div>
            {/* **« + CLIENT » VIT AU BOUT DE L'INTITULÉ, plus sur sa propre
                rangée.** C'est là qu'on y pense — en écrivant l'adresse — et
                cela rend vingt-huit pixels à l'écran. Les deux mots ne se
                coupent jamais : « Chantier » et « + Client » tiennent sur une
                ligne à 390 px, là où « Adresse du chantier » et « + Adresse
                client » se brisaient tous les deux (vu à la capture). */}
            <div className="mb-1 flex items-baseline justify-between gap-2.5">
              <span className={`whitespace-nowrap ${libelleCaps}`} style={{ color: colors.muted }}>
                Chantier
              </span>
              {!adresseClientVisible && (
                <button
                  type="button"
                  onClick={() => setAdresseClientVisible(true)}
                  data-atlas="adresse-client"
                  className={`whitespace-nowrap ${libelleCaps}`}
                  style={{ color: colors.rust }}
                >
                  + Client
                </button>
              )}
            </div>
            <ChampAdresse
              label="Adresse du chantier"
              placeholder="12 rue des Lilas, Nantes"
              value={adresseChantier}
              onChange={setAdresseChantier}
              sansLibelle
            />
          </div>

          {/* 7 — Adresse client, demandée au bout de l'intitulé ci-dessus.
              Elle porte son nom comme les quatre autres : une case sans
              intitulé est exactement ce que cet écran vient de corriger, et
              une exception suffit à défaire la règle. */}
          {adresseClientVisible && (
            <div>
              <div className={`mb-1 ${libelleCaps}`} style={{ color: colors.muted }}>
                Client
              </div>
              <ChampAdresse
                label="Adresse du client"
                placeholder="Si différente de l'adresse du chantier"
                value={adresseClient}
                onChange={setAdresseClient}
                sansLibelle
              />
            </div>
          )}

          {/* 8 — Les deux actions.

              **Sa demande du 18 août 2026 :** *« supprime "je dicterai" et
              "je l'écris", remplace par un bouton cliquable "je dicte mon
              devis" et un autre "j'écris mon devis", en gardant le chemin »* —
              puis, devant la planche (`appli/deux-boutons-devis.html`) :
              *« la 5, mais sans les flèches »*.

              **Ce que ça change, et qui n'est pas qu'une affaire de dessin.**
              Jusqu'ici il y avait un CHOIX (la bascule) puis une ACTION (le
              bouton) : deux gestes pour qui écrit son devis. Le choix est
              maintenant l'action — un seul geste dans les deux cas.

              **Les deux capsules sont identiques, à dessein.** Il a écarté la
              hiérarchie (une pleine, une cernée) qu'on lui proposait : ici les
              deux chemins se valent. C'est la proposition 5 de la planche.

              **Pas de flèche.** Sa correction, littérale. Le reste de
              l'application en portait encore, et il a fallu qu'il le redise le
              25 août 2026 devant « Créer la facture → » : elles sont parties
              partout ce jour-là, et `scripts/test-aucune-fleche.ts` les
              refuse désormais.

              **« Créer le chantier » a disparu de l'écran, et c'est assumé.**
              C'était le seul endroit qui annonçait la création. Les deux
              boutons créent le chantier avant d'aller où ils disent — sans quoi
              le devis serait orphelin (`creerPuisAller`).

              **Elles ne remplacent pas la porte du tiroir**, sur la fiche
              chantier, et ce n'est pas un doublon : ce sont deux MOMENTS. Ici,
              « je sais déjà que je l'écrirai moi-même » ; là-bas, « j'ai
              commencé, finalement je l'écris ».

              **En reprise, « Enregistrer » — et c'est la SEULE différence qui
              reste.** Le 31 août 2026, tout le reste de l'écart a été supprimé à
              sa demande : la reprise porte désormais les photos, l'anneau et la
              chaîne du devis, comme la création. Ce bouton-ci subsiste parce
              qu'il répond à un besoin que la création n'a pas — enregistrer ce
              qu'il vient de TAPER, sur un chantier qui existe déjà. Sans lui,
              une adresse corrigée au clavier ne partirait nulle part. */}
          {/* **Le canal d'envoi vit SOUS l'adresse depuis le 21 août 2026** —
              sa place, choisie par lui : *« comment lui envoyer son devis, tu
              le mets sous l'adresse »*. Il n'apparaît toujours qu'une fois une
              coordonnée saisie : poser la question avant serait sans objet. */}
          {/* **Il ne s'efface plus faute de coordonnée** — 22 août 2026. Sa
              maquette le montre en permanence, et son absence sur un écran
              neuf faisait bouger toute la page dès la première touche du
              numéro. Les deux capsules restent inertes tant qu'il n'y a rien
              pour envoyer : proposer un canal sans coordonnée est sans objet,
              le masquer laisse chercher pourquoi le choix a disparu. */}
          {/* ═══ L'ENVOI EST UN RÉGLAGE, PAS UNE ACTION — planche « A — Épurée »
              ═══════════════════════════════════════════════════════════════
              **Son choix du 2 septembre 2026, appliqué le 4.** La planche
              l'écrit en une phrase : *« l'envoi n'est plus une action : c'est un
              réglage. Il en prend la forme — une ligne, deux mots — et rend
              40 px à l'anneau. »*

              Deux capsules pleine largeur se lisaient comme des boutons
              d'envoi ; elles ne disent que par où le devis partira. Le libellé
              « ENVOI » les nomme, et le canal retenu porte un trait d'or sous
              son mot.

              **Le filet du dessus vient avec** : c'est lui qui sépare les
              coordonnées de ce réglage, et il est dans la planche
              (`.b-envoi{border-top}`). Il n'existe pas comme élément à part —
              le poser séparément ferait deux séparateurs pour une couture. */}
          <fieldset
            aria-label="Comment lui envoyer son devis ?"
            data-atlas="envoi-canal"
            className="mt-2.5 flex min-h-[34px] items-center justify-between gap-3 pt-2"
            style={{ borderTop: `1px solid ${colors.lineSoft}` }}
          >
            <span className={libelleCaps} style={{ color: colors.muted }}>
              Envoi
            </span>
            <span className="flex gap-1">
              <ChoixCanal
                apparence="reglage"
                libelle="SMS"
                actif={canal === "sms"}
                disponible={aTelephone}
                onClick={() => setCanalChoisi("sms")}
              />
              <ChoixCanal
                apparence="reglage"
                libelle="E-mail"
                actif={canal === "email"}
                disponible={aEmail}
                onClick={() => setCanalChoisi("email")}
              />
            </span>
          </fieldset>

          {/* **LES PHOTOS ET L'ANNEAU, sur la fiche client — 21 août 2026.**

              Sa demande, capture à l'appui : *« tu vas m'ajouter la possibilité
              de mettre des photos exactement comme il y a sur la page d'après.
              Ensuite, avant les deux touches, le bouton de la note vocale qui
              se trouve sur la page d'après. On appuie, on dicte les tâches à
              effectuer, celles qu'on voit tout de suite avec le client. »*

              **Les deux pièces sont celles de la fiche chantier**, pas des
              copies : `Pellicule` et `AnneauNoteVocale`, aux mêmes fichiers.
              Deux dessins du même geste se liraient comme deux fonctions
              différentes — et le second aurait divergé au premier ajustement
              (`CLAUDE.md` §3).

              **Elles fonctionnent AVANT que le chantier existe** : c'est le
              geste qui le crée (`assurerChantier`). L'ordre est celui de sa
              maquette (`appli/fiche-client-vocale.html`), qu'il a demandé de
              coder trait pour trait : photos, puis anneau, puis le devis.

              **ET ELLES SONT LÀ EN REPRISE AUSSI — 31 août 2026.** Sa demande,
              deux captures à l'appui : *« lorsque je fais retour j'arrive sur la
              page 1re photo alors que je veux arriver sur la 2e. Je sais pas
              d'où sort la 1re photo ? Si elle sert à rien il faut la
              supprimer. »* La première était CET écran privé de ses photos et de
              son anneau ; la seconde, le même écran entier. Il n'y a donc plus
              qu'une fiche client, et c'est la bonne — deux versions du même
              écran se lisaient comme deux écrans, dont un amputé sans raison
              visible.

              Ce que la reprise change, et rien d'autre : les pièces partent de
              ce que le chantier porte DÉJÀ. Les nourrir de vide afficherait une
              pellicule vide sur un chantier photographié, et il croirait ses
              photos perdues. */}
          {/* **Le carré de photo cesse d'être orphelin.** Il flottait seul,
              en pointillé doré, sans un mot — le seul objet « brouillon » d'un
              écran par ailleurs net. Son intitulé le fait rentrer dans le
              rythme des quatre cases au-dessus. */}
          <div aria-label="Photos du chantier" role="group">
            <div className={`mb-1 ${libelleCaps}`} style={{ color: colors.muted }}>
              Photos
            </div>
            <Pellicule
              chantierId={reprise?.id ?? chantierCree}
              assurerChantier={assurerChantier}
              initiales={reprise?.photos ?? []}
            />
          </div>

          {/* **L'anneau disparaît quand la note existe mais que son audio a été
              purgé** — même garde que la fiche du chantier : un lecteur sans
              rien à lire est une promesse fausse. */}
          {(!reprise?.note || reprise.note.storageKey) && (
            <div>
              <AnneauNoteVocale
                chantierId={reprise?.id ?? chantierCree}
                assurerChantier={assurerChantier}
                onDicte={() => setDicteeFaite(true)}
                onDictee={setDicteeEnCours}
                // Dès que la note est partie, la chaîne du devis démarre seule
                // (`auto`, plus bas) : l'anneau cesse alors d'inviter à dicter.
                preparationEnCours={dicteeFaite}
                storageKey={reprise?.note?.storageKey ?? null}
                dureeSecondes={reprise?.note?.dureeSecondes ?? null}
              />
            </div>
          )}

          {/* **L'AVION FAIT TOUT : envoyer, préparer, arriver sur le devis.**
              Sa demande du 30 août 2026 : *« appuyer sur la flèche pour envoyer
              de suite la transcription et arriver sur la page du devis comme
              c'est déjà le cas »*.

              Il n'y a donc plus de « Mon devis » à toucher après coup : dès que
              la note est partie, la chaîne démarre seule (`auto`) et le chemin
              se fait (`surLeDevis={false}`). Ce composant ne rend plus alors que
              ce qui se PASSE — le travail en cours, l'arrêt d'avant-chiffrage,
              ou ce qui a échoué. */}
          {dicteeFaite && (reprise?.id ?? chantierCree) && (
            <div>
              <DevisDepuisDictee
                chantierId={(reprise?.id ?? chantierCree)!}
                transcriptionDisponible
                auto
                surLeDevis={false}
              />
            </div>
          )}

          <div className="flex flex-col gap-3">
            {reprise ? (
              <PrimaryButton
                disabled={!peutCreer}
                onClick={() => creerPuisAller("fiche")}
                repere="action-creation"
              >
                {enCours ? "Enregistrement…" : "Enregistrer"}
              </PrimaryButton>
            ) : (
              /* **UN SEUL bouton — sa demande du 21 août 2026** : *« garde un
                 seul bouton, garde je rédige mon devis »*.

                 « Je dicte mon devis » n'a plus d'objet : la dictée se fait
                 ICI, à l'anneau, sans quitter l'écran. Deux façons de dicter
                 côte à côte se liraient comme deux fonctions différentes, et il
                 faudrait choisir laquelle toucher avant de savoir ce qu'on va
                 dire. */
              /* **SECONDAIRE, ET IL S'EFFACE PENDANT QU'ON DICTE.** Ses deux
                 demandes du 30 août 2026 : *« ça doit être un bouton
                 secondaire, car l'idée c'est qu'il utilise en priorité la note
                 vocale »*, et *« lorsque l'utilisateur clique sur le bouton de
                 la note vocale, le bouton "Je rédige à la main" disparaît pour
                 ne plus avoir de confusion possible »*.

                 **Il DISPARAÎT, il ne se grise pas** : un bouton éteint reste
                 un bouton — on l'appuie, il ne répond pas, et l'on croit
                 l'écran cassé. Sa place n'est pas réservée non plus : il est le
                 dernier de la page, donc rien au-dessus ne bouge, et l'écran
                 se raccourcit sans que rien ne saute sous le doigt.

                 **66 % de large** — sa proposition 4, choisie sur planche parmi
                 quatre (`appli/note-vocale-choix.html`). */
              !dicteeEnCours && (
                <PrimaryButton
                  disabled={!peutCreer}
                  onClick={() => creerPuisAller("devis")}
                  repere="action-ecrire"
                  pleineLargeur
                  secondaire
                  part="66%"
                >
                  {enCoursVers === "devis" ? "Création…" : "Je rédige à la main"}
                </PrimaryButton>
              )
            )}
          </div>
          {/* **Cette ligne ne parle plus que quand il y a quelque chose à dire.**
              Elle portait aussi, en permanence, « Le nom crée la fiche du
              client. Le reste se corrige ensuite, sur le devis. » — retirée le
              11 août 2026 à la demande du patron : l'écran est plus net sans
              elle, et il connaît son application.

              Ce qu'elle disait reste vrai et n'est écrit nulle part ailleurs à
              l'écran : **c'est le NOM qui crée la fiche client**. Sans lui,
              aucun client n'est rattaché, et le devis n'offre pas d'en ajouter
              un après coup. Si ce cas devait un jour se voir, c'est sur l'écran
              du devis qu'il faudrait le dire — pas en remettant une phrase
              permanente ici.

              **Sa place n'est plus réservée, depuis le 30 août 2026.** Elle
              l'était pour qu'une erreur ne fasse pas sauter la mise en page
              sous le doigt qui vient d'appuyer — mais cette ligne est la
              DERNIÈRE de l'écran : rien ne la suit, donc rien ne bouge quand
              elle paraît. Dix-neuf pixels de vide permanents au bas d'un écran
              qui doit tenir dans la feuille (`CLAUDE.md` §5, sa demande du
              30 août) sont un prix payé pour une protection qui ne protège
              rien. */}
          <p
            className="text-center text-[13px] empty:hidden"
            style={{ color: colors.alert }}
            role="alert"
            aria-live="polite"
          >
            {erreur}
          </p>
        </form>
      </div>
      </div>
    </div>
  );
}

/**
 * **Ce qui vivait ici jusqu'au 18 août 2026 : la bascule, et le bouton dont le
 * libellé la suivait.**
 *
 * `BasculePorte` — deux mots en serif, un filet d'or qui glissait de l'un à
 * l'autre — et `LibelleDeLaPorte`, qui gardait les deux libellés superposés
 * dans le bouton, l'un à `opacity:0`, pour que sa largeur ne saute pas au
 * moment du choix. Les deux ont été retirés d'un bloc : deux boutons portent
 * désormais chacun leur destination, et il n'y a plus de choix à refléter.
 *
 * **Rien n'en est gardé « au cas où ».** Un dessin que plus rien n'emploie
 * finit repris au hasard par un écran futur — c'est la raison qui avait déjà
 * fait supprimer la variante « plaque » du bouton principal le 11 août.
 * L'historique les garde ; le code, non.
 */

// Un canal sans sa coordonnée est proposé mais inerte : le masquer laisserait
// le patron chercher pourquoi le choix qu'il attend n'est pas là.

function Field({
  label,
  placeholder,
  type = "text",
  big = false,
  value,
  onChange,
  required = false,
  aLaFrappe,
  aDroite = false,
  sansLibelle = false,
}: {
  label: string;
  placeholder: string;
  type?: string;
  big?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  required?: boolean;
  /**
   * Remet en forme ce qui est tapé, à mesure — et rend où reposer le curseur.
   *
   * **Le curseur fait partie de la règle, il n'est pas un détail.** Sans lui,
   * corriger un chiffre au milieu d'un numéro renverrait le curseur au bout à
   * chaque touche, et la correction deviendrait impossible. La règle elle-même
   * vit hors de cet écran (`src/lib/numero-telephone.ts`), qui l'éprouve sans
   * navigateur.
   */
  aLaFrappe?: (brut: string, curseur: number) => { valeur: string; curseur: number };
  /** Le numéro se lit aligné à droite, contre le nom qui le précède. */
  aDroite?: boolean;
  /**
   * L'étiquette ne se DESSINE plus — elle reste en `aria-label`.
   *
   * **Sa demande du 30 août 2026 :** *« je veux que tout tienne sur une seule
   * page, qu'on n'ait pas à scroller pour voir les infos en bas »*. Chaque
   * intitulé en petites capitales coûte vingt-sept pixels avec son interligne,
   * et la fiche en portait six : cent soixante-deux pixels pour redire ce que
   * la case montre déjà — exactement les « phrases inutiles qui expliquent »
   * du 25 août (`CLAUDE.md` §3).
   *
   * **Le nom ne disparaît pas pour autant** : il passe en `aria-label`. Le
   * retirer vraiment fermerait l'écran à qui l'écoute — et sur cette fiche,
   * deux champs gardent en plus leur titre DESSINÉ, parce que sa planche les y
   * met (`.duo-titres`) : une case vide alignée à droite ne dit pas d'elle-même
   * qu'elle attend un numéro.
   */
  sansLibelle?: boolean;
}) {
  const champ = useRef<HTMLInputElement>(null);

  function saisie(e: React.ChangeEvent<HTMLInputElement>) {
    if (!onChange) return;
    if (!aLaFrappe) {
      onChange(e.target.value);
      return;
    }
    const { valeur, curseur } = aLaFrappe(e.target.value, e.target.selectionStart ?? e.target.value.length);
    onChange(valeur);
    // **Après le rendu, sinon React repose le curseur à la fin.** La valeur
    // affichée vient de l'état ; tant qu'il n'est pas rendu, écrire la sélection
    // n'a aucun effet visible.
    requestAnimationFrame(() => champ.current?.setSelectionRange(curseur, curseur));
  }

  return (
    <label className={sansLibelle ? "block" : "flex flex-col gap-1.5"}>
      {!sansLibelle && (
        <span className={smallCaps} style={{ color: colors.muted }}>
          {label}
        </span>
      )}
      <input
        ref={champ}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? saisie : undefined}
        aria-label={sansLibelle ? label : undefined}
        aria-required={required || undefined}
        // La case vient de `.atlas-case` (`globals.css`) — « la carte douce »,
        // son choix du 21 août 2026. Ne reste ici que ce qui distingue CE
        // champ : la police et la taille du nom, plus grandes que le reste.
        className="atlas-case"
        style={{
          fontFamily: big ? font.display : font.body,
          ...(big ? { fontSize: "20px" } : null),
          ...(aDroite ? { textAlign: "right" as const, fontVariantNumeric: "tabular-nums" } : null),
        }}
      />
    </label>
  );
}

function FlecheRetour() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
      <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
