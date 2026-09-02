"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, texteSituation } from "@/lib/design-tokens";
import { vibrer } from "@/lib/vibration";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
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

/** Les onze grains d'or projetés à l'appui : leur point d'arrivée, leur taille
 *  et leur retard.
 *
 *  **Ces nombres sont ceux de la maquette retenue**, repris tels quels
 *  (`docs/maquettes/24-le-bouton-retenu.html`). Ils sont volontairement
 *  irréguliers : onze grains à la même distance dessinent une roue de vélo, pas
 *  une gerbe. Le patron a lui-même ramené leur nombre de seize à onze et leur
 *  portée de 58 à 46 px — ne pas les « arrondir ». */
const GRAINS = [
  { x: 7.7, y: -36.9, l: 2.3, t: 9 },
  { x: 17.0, y: -44.8, l: 1.6, t: 43 },
  { x: 34.9, y: -22.6, l: 1.7, t: 22 },
  { x: 35.2, y: 2.1, l: 1.8, t: 0 },
  { x: 35.0, y: 29.0, l: 1.9, t: 34 },
  { x: 9.5, y: 38.0, l: 2.0, t: 13 },
  { x: -18.7, y: 45.7, l: 2.2, t: 47 },
  { x: -36.7, y: 22.4, l: 2.3, t: 26 },
  { x: -36.5, y: -3.1, l: 2.4, t: 5 },
  { x: -45.5, y: -11.3, l: 1.6, t: 39 },
  { x: -25.9, y: -31.2, l: 1.8, t: 18 },
] as const;

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

  function ouvrirAvecLeGeste() {
    if (anime) return;
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
        <p
          className="pt-[26px] text-center text-[11px]"
          style={{ letterSpacing: "0.52em", color: colors.ink }}
        >
          ATLAS
        </p>

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
              maintenant sur la rubrique (`test-dashboard` le lit pour savoir
              combien de chantiers sont en cours). Le laisser sur une ligne
              supprimée aurait rendu la suite muette. */}

          {/* **« La catégorie client n'a pas été créée » — 17 août 2026, au
              soir.** La fiche d'un client existait depuis la veille, mais elle
              ne s'atteignait que depuis un chantier : rien ne menait à SES
              clients. Le lien se pose ici, sous le compteur, plutôt que dans un
              cinquième onglet — la barre du bas en porte quatre et le cinquième
              est déjà décidé pour les outils métier (`ARCHITECTURE.md` §125).

              En or et en petites capitales, comme le reste de ce bloc : ce
              qu'on LIT, jamais ce qu'on FAIT. L'action de cet écran reste
              « Nouveau chantier », et rien ne doit lui disputer l'œil. */}
          <Link
            href="/clients"
            className="mt-[10px] inline-flex items-center gap-[6px] text-[9.5px] font-medium uppercase"
            style={{ color: colors.or, letterSpacing: "0.28em" }}
          >
            Vos clients
            <span
              aria-hidden="true"
              className="h-[5px] w-[5px] rotate-45"
              style={{ borderRight: `1.5px solid ${colors.or}`, borderTop: `1.5px solid ${colors.or}` }}
            />
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
        <div className="flex justify-center px-[26px] pb-0.5 pt-[22px]">
          <Link
            href="/chantiers/nouveau"
            data-atlas="nouveau-chantier"
            data-geste={anime ? "part" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              // **Sa demande du 31 août : un seul bouton pour essayer.** Le
              // retour part AVANT l'ouverture de la feuille, pas après : ce
              // qu'il veut sentir, c'est que l'appui est pris, et une feuille
              // qui monte se voit déjà toute seule.
              //
              // **Sur son iPhone, cela ne fera rien** tant qu'Atlas est servi
              // dans Safari — l'API n'y existe pas (`src/lib/vibration.ts`).
              // C'est délibéré : il a demandé à essayer plutôt qu'à attendre.
              vibrer();
              ouvrirAvecLeGeste();
            }}
            className="atlas-geste-nouveau"
          >
            <span className="atlas-mot">Créer un devis</span>
            <span className="atlas-rond">
              <span className="atlas-pouls" aria-hidden="true" />
              <span className="atlas-cerne" aria-hidden="true" />
              <span className="atlas-gerbe" aria-hidden="true">
                {GRAINS.map(({ x, y, l, t }) => (
                  <i
                    key={`${x}-${y}`}
                    style={
                      {
                        "--x": `${x}px`,
                        "--y": `${y}px`,
                        "--l": `${l}px`,
                        "--t": `${t}ms`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
              <svg className="atlas-signe" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M16 9.6v12.8M9.6 16h12.8" stroke={colors.or} strokeWidth="1.25" />
              </svg>
            </span>
          </Link>
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
        <div
          data-atlas="compteur"
          data-compte={compte}
          className="mx-[26px] mb-1 mt-[30px] flex items-baseline gap-[10px] text-[9.5px] font-medium uppercase"
          style={{ color: colors.inkSoft, letterSpacing: "0.28em" }}
        >
          <span>En cours</span>
          <span
            className="text-[12px] font-bold"
            style={{ color: colors.ink, letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums" }}
          >
            {compte}
          </span>
        </div>

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
          <div className="atlas-fil-defile pt-4">{bandeaux}</div>
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
        aria-label="Créer un devis"
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
