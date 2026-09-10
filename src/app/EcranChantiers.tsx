"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, texteSituation } from "@/lib/design-tokens";
import { vibrer } from "@/lib/vibration";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import GesteAnneau from "@/components/atlas/GesteAnneau";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import FormulaireNouveauChantier from "./chantiers/nouveau/FormulaireNouveauChantier";
import { supprimerChantierAction } from "./planning/actions";
import ListeChantiers, { type BrinChantier } from "./ListeChantiers";

// ─────────────────────────────────────────────────────────────────────────────
// L'écran des chantiers — version retenue par le patron le 10 août 2026.
//
// Il l'a arrêtée après une soirée de maquettes, en nommant ce qu'il gardait :
// la charte Origine, le fil, le trait d'or qui glisse sous les onglets, et
// l'ouverture où « l'écran des chantiers recule et s'assombrit, la feuille
// monte devant lui ».
//
// **Trois choses qu'il a explicitement refusées, et qu'il ne faut pas
// remettre :**
//
//   1. Aucun cheveu dans l'en-tête. **Y COMPRIS celui qui le fermait** : il
//      l'avait demandé le 11 août, il l'a fait retirer le 24 sur planche 95
//      — « une sans le trait gris », puis « code la mienne ». La consigne
//      d'avant disait de le garder ; elle est révoquée par son auteur, et
//      c'est écrit ici pour qu'on ne le remette pas en la citant.
//   2. Aucune boîte autour d'un chantier. Le fil remplace les cartes.
//   3. Aucune couleur qui ne veuille rien dire. L'or ne se pose que sur ce qui
//      attend un geste de lui.
//
// **Ce qui a disparu, et pourquoi ce n'est pas une perte.** La carte « Équipe »
// au pied de la liste : elle menait aux Réglages, qui sont un onglet du bandeau
// — un raccourci vers l'écran d'à côté. Et la cloche de l'en-tête, qui n'avait
// jamais eu de comportement ; les notifications, elles, restent affichées sous
// le titre, là où elles étaient.
//
// **Rien n'est écrit en dur** : noms, dates, états et compteur viennent tous de
// la base. La maquette ne fixe que la présentation.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * **LE DESSIN DU GESTE A DÉMÉNAGÉ le 10 septembre 2026** — il vit désormais
 * dans `src/components/atlas/GesteAnneau.tsx`, et les onze grains avec lui.
 *
 * La raison : cet écran en porte DEUX depuis sa demande de facturer sans devis,
 * et sa consigne sur la planche est *« l'anneau vraiment tout pareil »*. Deux
 * copies du même dessin auraient divergé au premier ajustement — sur le seul
 * écran qu'il ouvre vingt fois par jour.
 */

/** Ce que l'appui ouvre : la feuille du devis, ou celle de la facture. */
type Feuille = "devis" | "facture";

export default function EcranChantiers({
  chantiers,
  bandeaux,
}: {
  chantiers: BrinChantier[];
  /** Notifications et annonces, rendues par le serveur et posées sous le titre. */
  bandeaux: ReactNode;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  /**
   * LAQUELLE DES DEUX FEUILLES MONTE — sa demande du 10 septembre 2026.
   *
   * *« Il faut que l'on puisse facturer sans avoir besoin de passer par la case
   * devis. »* Les deux gestes ouvrent la MÊME fiche client ; seule change ce
   * qu'on fait en sortant. Un second composant de feuille aurait recopié
   * l'animation, le voile, la touche Échap et le rafraîchissement — et le
   * premier ajustement ne serait allé que sur l'un des deux.
   */
  const [feuille, setFeuille] = useState<Feuille>("devis");

  // ── Le geste du bouton ─────────────────────────────────────────────────
  //
  // Une demi-seconde sépare l'appui de la feuille : c'est le temps du tour et
  // de la gerbe. Trois précautions, et aucune n'est décorative :
  //
  //   · un second appui pendant le geste est ignoré — sinon deux feuilles, et
  //     le patron crée deux fois le même chantier ;
  //   · sous « mouvement réduit », la feuille monte TOUT DE SUITE : attendre
  //     une animation qui ne joue pas ferait passer un réglage d'accessibilité
  //     pour une lenteur ;
  //   · les minuteries sont annulées au démontage, sinon React reçoit un
  //     changement d'état sur un écran qui n'existe plus.
  const [anime, setAnime] = useState(false);
  const minuteries = useRef<number[]>([]);
  useEffect(() => {
    const encours = minuteries.current;
    return () => encours.forEach((m) => window.clearTimeout(m));
  }, []);

  function ouvrirAvecLeGeste(laquelle: Feuille) {
    if (anime) return;
    // **Le choix est posé AVANT l'animation, pas à son terme.** Posé après, un
    // appui sur « Créer une facture » aurait fait monter la feuille du devis
    // pendant un demi-tour — et c'est le premier mot qu'il lit en haut.
    setFeuille(laquelle);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOuvert(true);
      return;
    }
    setAnime(true);
    // 520 ms : la mesure de la maquette retenue. Le tour dure 560 ms, la
    // feuille part donc juste avant qu'il ne s'achève — attendre la fin
    // complète ajoutait un temps mort qui se sentait.
    minuteries.current.push(window.setTimeout(() => setOuvert(true), 520));
    minuteries.current.push(window.setTimeout(() => setAnime(false), 940));
  }

  // Le retrait, et le tiroir qui le retient. L'écriture n'a lieu qu'à la
  // fermeture du tiroir : d'ici là la ligne n'est que masquée, et « Annuler »
  // la rend vraiment — elle n'a jamais quitté l'état de l'écran.
  const retraits = useRetraits({
    valider: async (id) => {
      const resultat = await supprimerChantierAction(id);
      // La liste a changé : on la redemande au serveur plutôt que de deviner.
      if (resultat.succes) router.refresh();
      return resultat;
    },
  });

  // **Le décompte suit ce qui reste, sans attendre le serveur.** Un « 8 »
  // au-dessus de sept lignes ferait douter que le retrait ait eu lieu.
  // Tous les chantiers de la liste n'y entrent pas : `enCours` le dit ligne par
  // ligne, et c'est la seule façon de recompter juste ici.
  const restants = chantiers.filter((c) => !retraits.estRetire(c.id));
  const compte = restants.filter((c) => c.enCours).length;

  // ── « En cours 4 », COLLÉ À LA LISTE — 6 septembre 2026 ──────────────────
  //
  // **Sa remarque, deux fois de suite :** *« mets En cours au-dessus du
  // 4 septembre »*. Je lui avais répondu que c'était fait, mesure à l'appui —
  // et ma mesure ne regardait que l'ORDRE des éléments. La rubrique était posée
  // AVANT les bandeaux : au-dessus dans le marquage, à un demi-écran de
  // distance pour l'œil, parce qu'une notification de trois cents pixels
  // s'intercalait entre elle et la première ligne.
  //
  // Elle vit donc DANS le fil, après les bandeaux, collée à ce qu'elle compte :
  // 27 px entre son bas et le haut de la première date, quel que soit le matin.
  //
  // **La leçon vaut plus que le correctif** : un contrôle qui compare des
  // positions dans l'arbre ne dit rien de ce qu'on voit (`CLAUDE.md` §5).
  //
  // **Le repère `data-atlas="compteur"` voyage avec elle** — `test-dashboard`
  // le lit pour savoir combien de chantiers sont en cours, et lit AUSSI le
  // chiffre à l'écran. Le laisser derrière aurait rendu la suite muette.
  //
  // **11 px et non 9,5** : la consigne du 5 septembre n'avait pas atteint cet
  // écran, qui écrit ses tailles à la main plutôt que par le jeton commun.
  const rubriqueEnCours = (
    <div
      data-atlas="compteur"
      data-compte={compte}
      className="mx-[26px] mb-1 mt-[18px] flex items-baseline gap-[10px] text-[11px] font-medium uppercase"
      style={{ color: colors.inkSoft, letterSpacing: "0.28em" }}
    >
      <span>En cours</span>
      <span
        className="text-[13.5px] font-bold"
        style={{ color: colors.ink, letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums" }}
      >
        {compte}
      </span>
    </div>
  );

  // Échapper referme, comme partout ailleurs. Sans cela, une personne au
  // clavier se retrouve enfermée dans la feuille.
  useEffect(() => {
    if (!ouvert) return;
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [ouvert]);

  return (
    <div
      className="atlas-ecran"
      style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}
    >
      {/* ── L'écran des chantiers ─────────────────────────────────────────
          Il recule et s'assombrit quand la feuille monte : c'est la profondeur
          qui dit « on est passé au-dessus », pas le voile. */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{
          transformOrigin: "50% 44%",
          transform: ouvert ? "scale(0.93) translateY(-10px)" : "none",
          filter: ouvert ? "brightness(0.78)" : "none",
          transition: "transform 560ms cubic-bezier(0.22,0.61,0.36,1), filter 560ms",
        }}
        // Rendu inerte tant que la feuille est ouverte : sans cela, le doigt
        // peut atteindre un chantier à travers le voile.
        aria-hidden={ouvert || undefined}
        inert={ouvert || undefined}
      >
        {/* **« ATLAS » A ÉTÉ RETIRÉ LE 6 SEPTEMBRE 2026**, sur la planche
            `appli/l-accueil-a-bout-de-bras.html`, qu'il a retenue.

            C'était le nom de l'application, écrit en haut de l'application
            qu'il vient d'ouvrir. Il coûtait 39 px sur les 596 de son écran, et
            l'accueil n'en montrait aucun chantier sur un matin chargé.

            La marque n'est pas perdue : elle reste dans les Réglages et sur
            l'écran de lancement. **Ne pas la remettre** —
            `scripts/test-accueil-en-tete.ts` la refuse désormais, comme il
            refuse déjà le « Bonjour » et le trait gris. */}

        {/* **« Bonjour … » a été RETIRÉ le 24 août 2026**, sur planche 95, à sa
            demande : *« supprime le bonjour compte »*.

            Ce qu'il voyait n'était pas son prénom mais le mot « Compte » — le
            nom du compte de démonstration, faute de prénom renseigné. Un salut
            qui se trompe de nom vaut moins que pas de salut, et il occupait la
            première ligne de l'écran qu'il ouvre vingt fois par jour.

            **Le prénom n'est plus lu du tout** : le garder pour ne rien en
            faire aurait laissé croire, à la prochaine lecture, qu'il servait
            encore quelque part. */}
        {/* **44 px au-dessus du titre, et non 34 — sa demande du 2 septembre
            2026**, après avoir manipulé la planche d'accueil : *« garde l'air,
            les 44 px, 40 px et 21 px, par contre ne touche à rien d'autre »*.
            Les dix pixels vont AU TITRE, pas à la marque : c'est la première
            ligne qu'il lit, et elle démarrait collée au bord. */}
        <div className="px-[26px] pt-[44px]">
          {/*
            **L'assistant se pose à côté du titre**, comme sur les autres écrans
            — cet accueil ne passe pas par `EnTeteEcran`, la pièce partagée ne
            peut donc pas le poser ici.

            `whitespace-nowrap` sur le titre : « Vos chantiers » ne doit pas se
            replier, et il ne le fait pas — mesuré, il reste sur une ligne avec
            les 44 px du bouton à côté.
          */}
          <div className="flex items-start justify-between gap-4">
            <h1
              // 40 px depuis le 2 septembre 2026, comme la fiche client : le nom
              // de l'écran est ce qu'on lit en premier, et les 44 px au-dessus
              // ne servent à rien si le titre reste au format d'un sous-titre.
              className="mt-3.5 whitespace-nowrap text-[40px] leading-[1.02]"
              style={{ fontFamily: font.display, letterSpacing: "-0.018em" }}
            >
              Vos chantiers
            </h1>
            <div className="mt-3.5 flex-shrink-0">
              <BoutonAssistant />
            </div>
          </div>
          {/* **Le compte ne se dit plus ici, et il ne se dit plus qu'UNE fois.**
              Sa demande du 19 août 2026, capture à l'appui : il lisait le même
              nombre trois fois sur le même écran — « Un en cours » sous le
              titre, « En cours » à gauche de la rubrique, « Un » à sa droite.
              Il reste la rubrique, avec le chiffre collé au mot.

              Le repère `data-atlas="compteur"` a suivi le compte : il vit
              sur la rubrique (`test-dashboard` le lit pour savoir combien de
              chantiers sont en cours). Le laisser sur une ligne supprimée
              aurait rendu la suite muette.

              **Et la rubrique n'est plus ici depuis le 6 septembre 2026** :
              elle est descendue DANS le fil, après les bandeaux, collée à la
              liste qu'elle compte — voir `rubriqueEnCours`, plus haut dans ce
              fichier. */}

          {/* **« La catégorie client n'a pas été créée » — 17 août 2026, au
              soir.** La fiche d'un client existait depuis la veille, mais elle
              ne s'atteignait que depuis un chantier : rien ne menait à SES
              clients. Le lien se pose ici, sous le titre, plutôt que dans un
              cinquième onglet — la barre du bas en porte quatre et le cinquième
              est déjà décidé pour les outils métier (`ARCHITECTURE.md` §125).

              En or et en petites capitales, comme le reste de ce bloc : ce
              qu'on LIT, jamais ce qu'on FAIT. L'action de cet écran reste
              « Nouveau chantier », et rien ne doit lui disputer l'œil. */}
          {/* **Deux corrections du 6 septembre 2026**, sur la planche qu'il a
              retenue :

              1. **11 px et non 9,5.** Sa consigne du 5 septembre — « des vieux
                 qui ont du mal à se servir de leur téléphone » — a grossi le
                 petit texte de l'application le 6 au matin, mais l'accueil
                 écrit ses tailles à la main : il n'avait pas suivi.
              2. **Le chevron reste, mais il est DÉCLARÉ.** Il était dessiné en
                 CSS — un carré tourné à 45° —, et c'est pour cela que
                 `scripts/test-aucune-fleche.ts` ne le voyait pas : il cherche
                 des caractères. Une exception qu'un contrôle ne peut pas voir
                 n'est pas une exception, c'est un trou.

                 **Il l'a redemandé le 6 septembre au soir, et sa raison est
                 juste :** *« il faut rajouter un chevron après Vos clients je
                 pense, pour qu'on sache qu'on puisse cliquer dessus »*. C'est
                 le seul mot de cet en-tête qui mène ailleurs — rien d'autre ne
                 le dit. Sa consigne du 25 août visait l'ORNEMENT (« Créer le
                 devis → ») ; celui-ci porte une fonction.

                 Il s'écrit donc avec le caractère « › », que le contrôle SAIT
                 lire, et il est inscrit dans sa liste d'exceptions avec sa
                 raison. Le jour où quelqu'un voudra le retirer, il saura
                 pourquoi il est là.

              **44 px de haut, et la marge négative les reprend à
              l'affichage** : un mot de 11 px ne s'attrape pas sous un pouce
              ganté, et sa cible ne doit pas pour autant décaler la ligne.
              Mesuré à 14 px avant ce lot. */}
          <Link
            href="/clients"
            className="inline-flex min-h-[44px] items-center text-[11px] font-medium uppercase"
            // Les marges sont écrites ici, et non en classes : deux classes de
            // marge sur le même axe (`-my-` puis `mt-`) laissent l'ordre du
            // rendu décider laquelle gagne, ce qui n'est pas une décision.
            // Le mot reste où il était ; seule sa cible grandit autour.
            style={{
              color: colors.or,
              letterSpacing: "0.28em",
              marginTop: -5,
              marginBottom: -15,
            }}
          >
            Vos clients
            {/* **19 px et graisse 700 — sa remarque du 6 septembre au soir :**
                *« il est trop petit le chevron »*. À la taille du libellé
                (11 px), le glyphe « › » de la police du système fait une
                virgule : c'est un signe maigre, et une capitale espacée à
                0,28 em l'écrase. Il porte une fonction — dire que ce mot mène
                ailleurs —, donc il doit se voir.

                L'interlettrage est remis à zéro (à 0,28 em il flottait à cinq
                pixels du mot) et le signe remonte d'un pixel : son centre
                optique tombe alors sur celui des capitales, et non une ligne
                en dessous. Vu en capture, à trois fois la taille. */}
            <span
              aria-hidden="true"
              className="ml-[5px] text-[19px] font-bold leading-none"
              style={{ letterSpacing: 0, position: "relative", top: -1 }}
            >
              ›
            </span>
          </Link>
        </div>

        {/* **LE TRAIT DE L'EN-TÊTE A ÉTÉ RETIRÉ le 24 août 2026**, sur planche
            95 : *« une sans le trait gris »*, puis *« code la mienne »*.

            **C'est bien le trait qu'il avait DEMANDÉ le 11 août**, et c'est
            délibéré des deux côtés — le point 1 de l'en-tête de ce fichier a
            été récrit en conséquence. Ne pas le remettre en citant l'ancienne
            consigne : elle a été révoquée par son auteur, planche à l'appui.

            L'espace suffit désormais à fermer l'en-tête. */}

        {/* ── L'action ───────────────────────────────────────────────────
            **L'aplat vert a été refusé le 11 août 2026** — « ce gros bouton en
            plein milieu, ça ne fait pas très luxe » — et ce qui le remplace a
            été arrêté par le patron après onze maquettes : le mot écrit, un
            anneau d'un cheveu à sa droite qui BAT tant qu'on ne l'a pas touché,
            et à l'appui trois tours avec onze grains d'or, puis la feuille une
            demi-seconde plus tard.

            Toutes les mesures viennent de `docs/maquettes/24-le-bouton-retenu.html`,
            où elles sont chiffrées une à une : il les a resserrées lui-même
            (l'onde d'attente, la taille du rond, le nombre de grains). Ne pas
            les réinventer ici — les deux finiraient par diverger.

            **Le MOT, lui, a grossi le 16 août 2026** — « les capitales, gros et
            très gras », d'après `docs/maquettes/67-le-nouveau-chantier-plus-gros.html` :
            13 px, graisse 800, interlettrage 0,22 em, rond de 42 px. Les
            valeurs vivent dans `globals.css` ; ce fichier-ci ne porte que la
            structure.

            L'action reste un LIEN : sans JavaScript, ou en ouvrant dans un
            nouvel onglet, elle mène à l'écran entier. Le clic ordinaire est
            détourné pour jouer le geste puis faire monter la feuille — la route
            ne disparaît pas, elle change de porte. */}
        <div
          data-atlas="les-deux-gestes"
          className={`px-[26px] pb-0.5 pt-[22px] ${restants.length === 0 ? "mt-auto pb-[52px]" : ""}`}
        >
          {/* **« CRÉER UN DEVIS » GARDE EXACTEMENT SA PLACE** dès que la liste
              porte des chantiers — sa condition, mot pour mot, sur la planche
              du 10 septembre 2026. C'est ce que fait le rang centré : rien ne
              bouge pour lui tant qu'il a du travail en cours.

              **Liste vide, les deux DESCENDENT** (`mt-auto`) : c'est l'autre
              moitié de sa condition, et elle referme le grand vide qu'un écran
              sans chantier laissait sous le titre. */}
          <div className="flex justify-center">
            <GesteAnneau
              href="/chantiers/nouveau"
              mot="Créer un devis"
              repere="nouveau-chantier"
              anime={anime && feuille === "devis"}
              onAppui={() => {
                // **Sa demande du 31 août : un seul bouton pour essayer.** Le
                // retour part AVANT l'ouverture de la feuille, pas après : ce
                // qu'il veut sentir, c'est que l'appui est pris, et une feuille
                // qui monte se voit déjà toute seule.
                //
                // **Sur son iPhone, cela ne fera rien** tant qu'Atlas est servi
                // dans Safari — l'API n'y existe pas (`src/lib/vibration.ts`).
                // C'est délibéré : il a demandé à essayer plutôt qu'à attendre.
                vibrer();
                ouvrirAvecLeGeste("devis");
              }}
            />
          </div>

          {/* ── LE SECOND GESTE, COLLÉ AU BORD GAUCHE ─────────────────────
              **Sa correction du 10 septembre 2026 :** *« tu peux encore plus
              décaler créer une facture sur la gauche »*.

              **Il s'ALIGNE sur le bord, il ne recule pas d'un nombre de
              pixels** — et c'est la planche qui l'a payé. Un décalage écrit en
              dur à 78 px coupait le libellé (« RÉER UNE FACTURE », vu à la
              capture) : « Créer une facture » est plus long que « Créer un
              devis », et le même chiffre ne va pas aux deux. Aligné, le
              décalage est maximal ET ne peut plus déborder, quelle que soit la
              largeur de l'écran ou la longueur du mot.

              **L'adresse porte `?facture=1`**, et ce n'est pas un ornement :
              sans JavaScript, ou ouvert dans un nouvel onglet, ce lien doit
              mener à la fiche client qui FACTURE, pas à celle qui devise. Un
              lien qui ment sur sa destination dès que le geste ne joue pas est
              un cul-de-sac silencieux. */}
          <div className="mt-2 flex justify-start">
            <GesteAnneau
              href="/chantiers/nouveau?facture=1"
              mot="Créer une facture"
              repere="facture-sans-devis"
              anime={anime && feuille === "facture"}
              onAppui={() => {
                vibrer();
                ouvrirAvecLeGeste("facture");
              }}
            />
          </div>
        </div>

        {/* **Le mot, puis le chiffre — et plus rien à droite.** Sa demande du
            19 août 2026. Trois choix, tous les trois de lui :

            1. **le nombre en CHIFFRE**, plus en lettres. « Un » à l'autre bout
               de la ligne se lisait comme un mot de plus, pas comme un compte ;
            2. **le chiffre est le seul élément en gras** : c'est lui qu'on
               vient lire, le mot ne fait que le nommer ;
            3. **le mot passe au gris du second plan** — `inkSoft` au lieu de
               `muted`. C'est le **C** de la planche
               (`appli/en-cours-le-chiffre.html`), qu'il a choisi entre trois
               gris ; le B, plus court d'un demi-ton, aurait demandé un jeton de
               plus dans les sept chartes. Jamais une valeur écrite en clair
               ici : elle serait juste sur « Origine » et fausse sur les deux
               chartes sombres. */}
        {restants.length === 0 ? (
          /* **AUCUNE PHRASE QUAND LA LISTE EST VIDE** — sa demande du 25 août
             2026 : *« supprime la phrase "aucun chantier pour l'instant" »*.

             Elle disait deux choses, et les deux étaient déjà à l'écran : que
             la liste est vide — on le voit —, et par où commencer — « CRÉER UN
             DEVIS » et son rond doré sont juste au-dessus. Une phrase qui
             répète ce qu'on voit occupe la place des bandeaux, qui, eux,
             appellent une action.

             Les bandeaux restent : ce sont les réponses de ses clients, et
             elles arrivent justement quand plus aucun chantier n'est en cours. */
          <div className="atlas-fil-defile pt-4">
            {bandeaux}
            {rubriqueEnCours}
          </div>
        ) : (
          <div className="atlas-fil-defile pb-3 pt-2.5">
            {/* **Les bandeaux défilent AVEC la liste, ils ne la repoussent
                pas.** Posés dans l'en-tête, une notification de trois lignes
                mangeait deux cents pixels : la liste se réduisait à une bande,
                et la perle se retrouvait sous le bord. Le défaut n'était
                visible que sur une capture — la structure semblait juste, et
                les suites étaient vertes. C'est le même défaut qu'en juillet,
                à un autre endroit. */}
            {bandeaux}
            {rubriqueEnCours}
            <ListeChantiers
              chantiers={chantiers}
              estRetire={retraits.estRetire}
              onRetirer={retraits.retirer}
            />
          </div>
        )}

        {/* Un refus du serveur ramène la ligne : le dire, sinon elle
            réapparaît sans raison apparente. */}
        {Object.entries(retraits.refuses).map(([id, motif]) => (
          <p
            key={id}
            role="alert"
            className={`px-[26px] pb-2 ${texteSituation}`}
            style={{ color: colors.alert }}
          >
            {motif}
          </p>
        ))}

        {/* Le tiroir est le DERNIER enfant de la colonne : il pousse la liste
            vers le haut au lieu de la recouvrir. Posé par-dessus, il masquerait
            la dernière ligne — celle qu'on vient justement de toucher. */}
        <TiroirDesRetires
          dernier={retraits.dernier}
          nombre={retraits.nombre}
          onAnnuler={retraits.annuler}
        />
      </div>

      {/* ── Le voile ──────────────────────────────────────────────────────
          Il assombrit à peine : c'est le recul de l'écran qui porte la
          profondeur. Il sert surtout de cible pour refermer d'un doigt. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setOuvert(false)}
        className="fixed inset-0 z-[45]"
        style={{
          backgroundColor: "rgba(20,18,14,0.12)",
          opacity: ouvert ? 1 : 0,
          visibility: ouvert ? "visible" : "hidden",
          transition: ouvert
            ? "opacity 460ms, visibility 0s 0s"
            : "opacity 460ms, visibility 0s 460ms",
        }}
      />

      {/* ── La feuille ────────────────────────────────────────────────────
          Elle s'arrête à 60 px du haut : l'écran des chantiers reste visible
          derrière, et l'on sait d'où l'on vient. */}
      <div
        role="dialog"
        aria-modal="true"
        // **Le nom de la feuille suit le geste qui l'a ouverte.** Un lecteur
        // d'écran annonce ce mot-là en premier : « Créer un devis » sur ce
        // qu'on vient de demander à facturer serait le même mensonge que le
        // titre « devis » qu'il a fait retirer de la planche.
        aria-label={feuille === "facture" ? "Créer une facture" : "Créer un devis"}
        // `fixed`, et non `absolute` : la feuille doit RECOUVRIR le bandeau du
        // bas et la bulle de l'assistant, qui sont fixés au-dessus de l'écran.
        // En absolu elle passait dessous, et sa dernière ligne — celle qui
        // prévient que les coordonnées ne seront plus modifiables — se
        // retrouvait cachée derrière les onglets.
        className="fixed inset-x-0 bottom-0 top-[60px] z-[50] mx-auto flex max-w-md flex-col overflow-hidden"
        style={{
          backgroundColor: colors.cream,
          borderRadius: "26px 26px 0 0",
          boxShadow: "0 -22px 50px rgba(20,18,14,0.22)",
          transform: ouvert ? "translateY(0)" : "translateY(100%)",
          visibility: ouvert ? "visible" : "hidden",
          transition: ouvert
            ? "transform 560ms cubic-bezier(0.22,0.61,0.36,1), visibility 0s 0s"
            : "transform 560ms cubic-bezier(0.22,0.61,0.36,1), visibility 0s 560ms",
        }}
        inert={!ouvert || undefined}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Remonté à la fermeture : le formulaire garde son état tant qu'il
              est monté, et rouvrir une feuille encore remplie de la saisie
              précédente est le meilleur moyen de créer un chantier en double.
              La clé change à chaque ouverture, donc l'état repart à zéro. */}
          {ouvert && (
            <FormulaireNouveauChantier
              enFeuille
              pour={feuille}
              onFermer={() => {
                setOuvert(false);
                // La liste peut avoir changé pendant que la feuille était
                // ouverte : on la redemande au serveur plutôt que d'espérer.
                router.refresh();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
