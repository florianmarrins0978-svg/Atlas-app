import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// **« Remplace tous les boutons rectangulaires par les boutons arrondis. »**
// Le patron, le 12 août 2026 — après avoir vu, sur la feuille d'envoi de son
// devis, un bouton carré à côté d'une capsule.
//
// **Pourquoi un contrôle plutôt qu'un simple balayage.** Le balayage a été fait
// une fois ; il ne tiendra pas tout seul. Un écran neuf écrit dans six mois
// reprendra le `rounded-[4px]` du voisin — c'est exactement ce qui s'est passé :
// la capsule avait été posée sur `PrimaryButton` le 11 août, et trois écrans qui
// dessinaient leur bouton à la main ne l'ont jamais su. Le patron l'a vu avant
// nous.
//
// **Ce que ce contrôle NE dit pas.** Il ne demande pas d'employer
// `PrimaryButton` : deux boutons sont des `type="submit"` (connexion, documents
// légaux) et le composant partagé impose `type="button"`, ce qui casserait leur
// formulaire. Il ne juge que la FORME, qui est ce que le patron a demandé.
//
// **Et il ne touche pas aux plages.** Cartes, champs et tuiles gardent leurs
// 4 px : la charte les veut presque droits — « au-delà de 6 px, une plage
// devient un galet et l'écran perd sa tenue » (`ARCHITECTURE.md`). Seules les
// balises interactives sont regardées.

const RACINE = "src";

/** Un rayon rectangulaire posé sur un `<button>` ou un `<a>`. */
// Pas de drapeau `s` : la cible TypeScript du projet ne l'accepte pas, et il
// serait de toute façon inutile — une classe niée comme `[^>]` franchit déjà
// les retours à la ligne. Le typecheck l'a dit avant que quiconque ne le lise.
//
// **`(?:[^>]|=>)` et non `[^>]` — sans quoi ce contrôle ne voit presque rien.**
//
// Découvert le 12 août 2026 au soir, en lui livrant un bouton carré de plus :
// une classe niée `[^>]` s'arrête au premier chevron, **et la flèche d'une
// fonction en porte un**. Tout bouton écrit `onClick={() => …}` — c'est-à-dire
// l'immense majorité — passait donc sous le radar. Trois l'ont fait, sur la
// feuille d'envoi elle-même : exactement l'écran où le patron avait vu « un
// bouton carré à côté d'une capsule ».
//
// Le contrôle avait donc rougi une fois, sur le seul bouton qui n'avait pas de
// `onClick` — et il en laissait passer trois à côté. Un contrôle qui attrape le
// cas rare et manque le cas courant est pire qu'aucun : il fait croire que
// c'est propre.
//
// **Deux angles morts de plus, trouvés le 13 août 2026 — et c'est ENCORE le
// patron qui les a vus, sur « Créer la facture » de la feuille « Y aller ».**
// Ce bouton s'écrit `<Link className="rounded-md">` :
//
//   1. `Link` n'était pas dans la liste des balises. Or c'est la façon normale
//      d'écrire un bouton qui MÈNE quelque part, dans tout ce dépôt ;
//   2. `rounded-md` est un rayon NOMMÉ de Tailwind, pas une valeur entre
//      crochets. Le motif ne cherchait que `rounded-[Npx]`.
//
// Il passait donc deux fois entre les mailles. C'est la troisième fois que ce
// contrôle rate un cas courant en attrapant le cas rare, et la leçon est
// toujours la même : **un motif qui décrit une FAÇON D'ÉCRIRE vieillit** — il
// faut le confronter à ce que le dépôt écrit vraiment, pas à ce qu'on croit
// qu'il écrit.
const RECTANGULAIRE =
  /<(?:button|a|Link)\b(?:[^>]|=>)*?rounded-(?:\[(\d+)px\]|(sm|md|lg|xl|2xl|3xl)\b)(?:[^>]|=>)*>/g;

function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      // Les maquettes `/design/*` sont découplées du produit depuis le 1er août :
      // elles racontent un chemin, elles ne sont pas des écrans du patron.
      if (entree === "design") continue;
      sortie.push(...fichiers(chemin));
    } else if (chemin.endsWith(".tsx")) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

/**
 * Ce que ce contrôle ne juge PAS, et pourquoi — chaque ligne a sa raison.
 *
 * **Écrit le 13 août 2026, quand le motif réparé a dénoncé six boutons d'un
 * coup.** Un seul était celui que le patron signalait. Les cinq autres n'ont
 * jamais été arbitrés par lui : les restyler au passage aurait changé
 * l'apparence d'écrans qu'il n'a pas demandés — c'est exactement ce que
 * `CLAUDE.md` §3 bis interdit.
 *
 * **Une exception nommée n'affaiblit pas le contrôle** : un bouton NEUF écrit
 * carré ailleurs le fera toujours rougir. Ce qui l'affaiblirait, ce serait de
 * relâcher le motif — on ne verrait alors plus rien nulle part.
 *
 * Ces cinq points sont dans `TODO.md`, en attente de sa décision.
 */
const HORS_CHARTE: Array<{
  motif: RegExp;
  pourquoi: string;
  /**
   * Ce qui restreint l'exception À L'INTÉRIEUR du fichier.
   *
   * **Ajouté le 21 août 2026, et c'est une réponse à un défaut de ce contrôle
   * lui-même :** une exception portant sur le fichier entier laisse passer tous
   * les boutons qu'on y écrira demain. `ChoixUnite.tsx` le disait en toutes
   * lettres, et c'était acceptable parce qu'il ne tenait qu'une case. Le
   * planning, lui, porte une vingtaine de boutons : l'exempter en entier
   * reviendrait à retirer l'écran le plus consulté de la surveillance.
   *
   * Quand ce champ est là, seul ce qui LUI correspond est pardonné ; tout autre
   * bouton carré du même fichier fait toujours rougir.
   */
  seulement?: RegExp;
}> = [
  // **L'exception des écrans du CLIENT a été LEVÉE le 13 août 2026**, et c'est
  // lui qui a tranché : capture des deux écrans côte à côte, question posée,
  // réponse « oui ». Les quatre boutons que voit son client — accepter,
  // demander une correction, refuser, télécharger la facture — portent
  // désormais la capsule comme les siens. Ils gardent leurs couleurs propres :
  // ce qui devait rester distinct, c'est l'identité, pas la forme du geste.
  //
  // Le champ de saisie de la même page, lui, garde ses coins doux : la charte
  // ne donne la capsule qu'à ce qu'on APPUIE, jamais à ce qu'on remplit.
  {
    /**
     * **Une PLAGE qu'on touche, et non un geste qu'on appuie.**
     *
     * La carte « Ma TVA à déclarer », en tête de « Terminés » depuis le 23 août
     * 2026 (sa proposition B, `ARCHITECTURE.md` §149). Elle mène quelque part,
     * donc elle s'écrit `<Link>` — mais ce qu'on voit est une carte pleine
     * largeur portant un libellé, une période et un montant, et elle se tient à
     * côté des plages du relevé, qui portent leurs 4 px.
     *
     * **En capsule, elle serait le galet que la charte refuse** — « au-delà de
     * 6 px, une plage devient un galet et l'écran perd sa tenue » —, et sur
     * toute la largeur de l'écran l'effet est maximal. La charte ne donne la
     * capsule qu'à ce qu'on APPUIE ; elle n'a jamais été demandée pour ce qu'on
     * PARCOURT.
     *
     * **L'exception est bornée au repère de cette carte** : tout autre bouton
     * carré de `termines/page.tsx` fait toujours rougir, et c'est vérifié plus
     * bas contre un bouton voisin.
     *
     * **La carte « Pour mon comptable », juste dessous, depuis le 24 octobre
     * 2026** : son choix sur la planche (`appli/pour-mon-comptable.html`,
     * écran 1), « la même forme que la carte de la TVA ». Même nature, même
     * raison, et le même repère borné.
     */
    motif: /^src[/\\]app[/\\]termines[/\\]page\.tsx$/,
    pourquoi: "cartes pleine largeur qu'on parcourt (TVA, comptable), plages à 4 px et non gestes en capsule",
    seulement: /data-atlas="carte-(?:tva|comptable)"/,
  },
  {
    /**
     * **La même chose, en tête de la fiche de chantier** — « Composer ma fiche »,
     * depuis le 26 août 2026 (`ARCHITECTURE.md` §190).
     *
     * Elle était une phrase ; il l'a dit introuvable — *« c'est bien mais juste
     * une phrase, on la trouve difficilement »* —, puis a choisi la carte, *« mais
     * fais-la moins large »*. Elle mène quelque part, donc `<Link>` ; ce qu'on
     * voit est une plage qu'on parcourt, et la charte lui donne 4 px.
     *
     * **Bornée à son repère** : tout autre bouton carré de cet écran fait
     * toujours rougir.
     */
    motif: /^src[/\\]app[/\\]paysage[/\\]fiche[/\\]page\.tsx$/,
    pourquoi: "carte qu'on parcourt, plage à 4 px et non geste en capsule",
    seulement: /data-atlas="carte-composer-ma-fiche"/,
  },
  {
    // **UNE VIGNETTE PHOTO, PAS UN BOUTON D'ACTION.** Arrivée le 8 septembre
    // 2026 avec « repartir d'un client » : un carré de 62 px qui montre une
    // photo de l'ancien chantier, et qu'on touche pour la reprendre. La charte
    // donne la capsule à ce qu'on APPUIE ; ici on ne presse pas un geste, on
    // COCHE une image — l'état se lit d'ailleurs au liseré d'or, pas à la
    // forme.
    //
    // **Et l'arrondir entièrement abîmerait ce qu'elle montre** : un cercle
    // rogne les quatre coins d'une photo déjà réduite à 62 px, c'est-à-dire
    // précisément ce qui permet de la reconnaître. La même raison que la tuile
    // du calendrier deux entrées plus bas : une image n'est pas un geste.
    //
    // Le motif vise la LIGNE — la vignette —, pas le fichier : un vrai bouton
    // rectangulaire écrit demain dans cet écran serait toujours dénoncé.
    motif: /^src[/\\]app[/\\]chantiers[/\\]nouveau[/\\]FormulaireNouveauChantier\.tsx$/,
    seulement: /h-\[62px\] w-\[62px\]/,
    pourquoi: "vignette d'une photo qu'on reprend : un cercle rognerait l'image",
  },
  {
    // **LES DOUZE MOIS ET LES DEUX CARTES A ET B DU CONTRAT D'ENTRETIEN** —
    // sa planche 129 (`appli/contrat-d-entretien-vert.html`), retenue le
    // 26 septembre 2026 : les mois sont douze CASES d'une grille, comme les
    // tuiles d'un calendrier, et A et B sont deux CARTES de choix qui portent
    // un titre et une phrase. En capsule, douze mois ne tiennent plus sur une
    // ligne, et une carte de deux lignes devient un galet. Trouvé par la
    // batterie du 27 septembre. Le motif vise leurs repères, pas le fichier.
    motif: /^src[/\\]app[/\\]clients[/\\]\[id\][/\\]contrat[/\\]ContratClient\.tsx$/,
    seulement: /aria-label=\{MOIS_LONGS\[i\]\}|data-atlas="choix-facturation"/,
    pourquoi: "cases des mois et cartes A et B de sa planche 129",
  },
  {
    // **UNE VIGNETTE DE PHOTO, PAS UN BOUTON** — la troisième, arrivée le
    // 9 septembre 2026 avec les photos d'un retour d'intervention sur la fiche
    // du jour. Même arbitrage que les deux autres : un cercle rogne les quatre
    // coins d'une photo réduite à 74 px, c'est-à-dire ce qui permet de
    // reconnaître ce qu'elle montre. Une image n'est pas un geste.
    //
    // **Déclarée ici parce qu'elle ne l'avait pas été**, et que ce contrôle
    // rougissait donc sur `main` pour tout le monde. Le motif vise la LIGNE :
    // un vrai bouton rectangulaire écrit demain dans cet écran serait toujours
    // dénoncé.
    // **ET LES QUATRE CASES DE LA FICHE D'INTERVENTION — sa planche du
    // 19 septembre 2026** (`appli/fiche-intervention-sixieme.html`, codée sur
    // son « tu peux coder exactement cette planche ») : Maps, Waze, Copier
    // l'adresse, Appeler le client sont quatre CASES sur une ligne, le dessin
    // au-dessus du mot. Il a choisi cette forme planche en main, contre une
    // version en capsules qu'il avait sous les yeux la veille (la deuxième).
    // Le motif vise leur repère, pas le fichier.
    motif: /^src[/\\]app[/\\]planning[/\\]PlanningClient\.tsx$/,
    seulement: /h-\[74px\] w-\[74px\]|data-atlas="geste-de-la-fiche"/,
    pourquoi: "vignette d'une photo de retour, et les quatre cases de sa fiche d'intervention",
  },
  {
    // **UNE VIGNETTE DE PHOTO, PAS UN BOUTON** — exactement la même raison que
    // celle de 62 px trois entrées plus haut, et le même arbitrage : un cercle
    // rogne les quatre coins d'une photo réduite à 46 px, c'est-à-dire
    // précisément ce qui permet de reconnaître le chantier qu'elle montre. Une
    // image n'est pas un geste.
    //
    // **Ce qu'elle ne couvre PAS** : la case à cocher de la même liste, à vingt
    // lignes de là. Celle-là est un geste, elle a été arrondie le 9 septembre
    // 2026 quand ce contrôle l'a dénoncée.
    //
    // Le motif vise la LIGNE — la vignette —, pas le fichier : un vrai bouton
    // rectangulaire écrit demain dans cet écran serait toujours dénoncé.
    motif: /^src[/\\]app[/\\]planning[/\\]TravauxAFaire\.tsx$/,
    seulement: /h-\[46px\] w-\[46px\]/,
    pourquoi: "vignette d'une photo du retour : un cercle rognerait l'image",
  },
  {
    // **LA MÊME VIGNETTE, SUR LA FICHE DE SÉCURITÉ** — arrivée le 22 septembre
    // 2026 avec sa demande : *« les photos de la fiche de sécurité, je ne peux
    // pas cliquer dessus pour les voir en grand »*. Elle était un `<span>`
    // jusque-là ; la rendre cliquable en a fait un bouton, et ce contrôle l'a
    // dénoncée aussitôt — c'est ce qu'on lui demande.
    //
    // Même arbitrage que les quatre au-dessus, au pixel près : un cercle rogne
    // les quatre coins d'une photo réduite à 46 px, c'est-à-dire ce qui permet
    // de reconnaître le croquis du terrain. Une image n'est pas un geste.
    //
    // **Ce qu'elle ne couvre PAS** : le « Retirer » de la visionneuse, dans le
    // même fichier — celui-là est un geste, et il porte la capsule.
    motif: /^src[/\\]app[/\\]planning[/\\]fiche-de-securite[/\\]\[chantierId\][/\\]FormulaireFicheDeSecurite\.tsx$/,
    seulement: /h-\[46px\] w-\[46px\]/,
    pourquoi: "vignette d'une photo du terrain : un cercle rognerait l'image",
  },
  {
    // **L'APERÇU DU CROQUIS — 14 octobre 2026.** Le dessin du chantier, en 4 sur 3, qu'on
    // touche pour le rouvrir. Même arbitrage que les vignettes : c'est une IMAGE, et une
    // capsule rognerait les coins du plan, là où se posent souvent l'accès et la limite.
    // Les outils du croquis, eux, sont des gestes : ils portent la capsule.
    motif: /^src[/\\]app[/\\]planning[/\\]fiche-de-securite[/\\]\[chantierId\][/\\]FormulaireFicheDeSecurite\.tsx$/,
    seulement: /data-atlas="apercu-du-croquis"/,
    pourquoi: "aperçu du croquis qu'on rouvre : une capsule rognerait les coins du plan",
  },
  {
    // **UNE PHOTO QU'ON OUVRE, PAS UN BOUTON** — la quatrième de cette famille,
    // arrivée le 11 septembre 2026 avec sa demande : *« ce qui serait bien,
    // c'est qu'on puisse cliquer dessus pour qu'elle apparaisse en grand »*.
    //
    // Même arbitrage que les trois autres, et il est plus fort ici : la photo
    // fait 132 px de haut sur la moitié de l'écran, et c'est SUR ELLE qu'il
    // décide de facturer. Un cercle rognerait les quatre coins de ce qu'il
    // regarde. Une image n'est pas un geste — la charte donne la capsule à ce
    // qu'on APPUIE.
    //
    // **Elle garde le rayon qu'elle avait quand elle n'était qu'une image** :
    // rien n'a changé à l'écran, seul le fait qu'on puisse l'ouvrir.
    //
    // Le motif vise la LIGNE — son repère —, pas le fichier : un vrai bouton
    // rectangulaire écrit demain dans cet écran serait toujours dénoncé, et
    // « Replier » juste en dessous porte bien sa capsule.
    motif: /^src[/\\]app[/\\]termines[/\\]retours[/\\]ListeDesRetours\.tsx$/,
    seulement: /data-atlas="ouvrir-la-photo"/,
    pourquoi: "photo d'un retour qu'on ouvre en grand : un cercle rognerait l'image",
  },
  {
    // **LA RANGÉE DE LA VISIONNEUSE — la « bibliothèque » qu'il a retenue le
    // 11 septembre 2026 au soir**, planche en main (*« Voilà je veux ça ! »*,
    // `appli/photo-en-bibliotheque.html`, variante avec la rangée). Cinq
    // vignettes de 56 px sous la photo ; celle qu'on regarde est cerclée d'or.
    //
    // Même arbitrage que les quatre autres : ce sont des IMAGES qu'on touche,
    // et un cercle rognerait ce qu'elles montrent. La croix et les chevrons du
    // même écran, eux, sont de vrais boutons — et bien ronds.
    motif: /^src[/\\]components[/\\]atlas[/\\]VisionneusePhoto\.tsx$/,
    seulement: /data-atlas="vignette-de-la-rangee"/,
    pourquoi: "vignette de la rangée sous la photo : un cercle rognerait l'image",
  },
  {
    // **UNE CASE DU CALENDRIER, PAS UN BOUTON.** La charte est citée deux fois
    // plus haut : la capsule va à ce qu'on APPUIE, les 4 px à ce qu'on remplit —
    // et une case de calendrier n'est ni l'un ni l'autre. C'est une TUILE : un
    // chiffre, deux barres de charge dessous, quarante-deux fois de suite. En
    // capsule, la grille du mois devient un chapelet de galets et cesse de se
    // lire comme un calendrier.
    //
    // **Le patron l'a arbitrée** : la planche 84 (`appli/planning-simple.html`)
    // porte `border-radius:10px` sur `.case`, il l'a essayée deux soirées et
    // tranché le 21 août 2026 — *« code trait pour trait cette maquette »*.
    // C'est donc une décision de sa part, comme l'était celle du 12 août sur
    // les boutons ; les deux ne se contredisent que si l'on prend une tuile
    // pour un bouton.
    //
    // **`seulement` la borne à la case elle-même** : elle seule porte
    // `data-jour=`. Les vingt autres boutons du planning restent surveillés.
    // **Le dessin a DÉMÉNAGÉ le 22 août 2026**, quand l'écran d'envoi s'est mis
    // à montrer le même calendrier que le planning (`MoisCharge`). L'exception
    // suit la tuile, elle ne la suivait pas : sans cela, ce contrôle dénonçait
    // une décision que le patron avait prise et qui n'avait pas bougé d'un
    // pixel — le pire des rouges, celui qui accuse à tort (`AGENTS.md`).
    motif: /^src[/\\]components[/\\]atlas[/\\]MoisCharge\.tsx$/,
    seulement: /data-jour=/,
    pourquoi: "case du calendrier : une tuile de 44 px, ni geste ni champ",
  },
  {
    /**
     * **L'ENVOI N'EST PLUS UN BOUTON, C'EST UN RÉGLAGE — sa planche
     * « A — Épurée », retenue le 2 septembre 2026 et codée le 4.**
     *
     * *« L'envoi n'est plus une action : c'est un réglage. Il en prend la forme
     * — une ligne, deux mots — et rend 40 px à l'anneau. »* Deux capsules
     * pleine largeur se lisaient comme des boutons d'ENVOI alors qu'elles ne
     * disent que par où le devis partira. Le canal retenu porte donc un trait
     * d'or SOUS son mot, comme le marqueur d'onglet de la barre du bas — et
     * plus aucun fond ni aucun contour.
     *
     * **Sa règle du 12 août ne s'applique pas à ce qu'on ne lit pas comme un
     * bouton.** Ce rendu n'a ni fond, ni liseré, ni capsule : les 2 px sont ce
     * qui reste d'une forme qu'on a retirée, pas un galet. Le dénoncer, c'est
     * accuser une décision qu'il a prise lui-même, planche en main — le pire
     * des rouges (`AGENTS.md`).
     *
     * **`seulement` la borne à ce rendu-là** : la capsule pleine largeur, qui
     * vit dans le même fichier et sert la facture, reste surveillée, et elle
     * est bien `rounded-full`.
     */
    motif: /^src[/\\]components[/\\]atlas[/\\]ChoixCanal\.tsx$/,
    seulement: /rounded-\[2px\]/,
    pourquoi: "l'envoi en réglage : un mot souligné d'or, ni fond ni contour",
  },
  {
    // **UNE CARTE QUI SUIT L'IMPORT, PAS UN BOUTON** (22 octobre 2026, lot
    // « Importer devis et factures »). Trois lignes et une jauge de lecture,
    // au rayon de 16 px de sa planche (`.bandeau`, `appli/importer-ancienne-appli.html`) :
    // en capsule, la jauge et le texte se rogneraient aux deux bouts.
    motif: /^src[/\\]app[/\\]clients[/\\]BandeImport\.tsx$/,
    seulement: /data-atlas="bande-import"/,
    pourquoi: "carte de suivi de l'import : trois lignes et une jauge, une capsule les rognerait",
  },
  {
    // **LES TUILES D'OUTILS DE « DESSINER LE PLAN »** (22 octobre 2026, lot des
    // lignes de goutte-à-goutte, planche `appli/arrosage-dessiner-le-plan-revu.html`) :
    // une icône sur un mot, 72 px de haut, rangées en grille comme les cases du
    // calendrier. En capsule, la grille deviendrait un chapelet de galets.
    motif: /^src[/\\]app[/\\]paysage[/\\]arrosage[/\\]DessinerLePlan\.tsx$/,
    seulement: /data-outil=/,
    pourquoi: "tuile d'outil du dessin : une icône sur un mot, rangée en grille",
  },
  {
    // **LES CARTES DU RÔLE** (Réglages soignés, planche du 26 octobre 2026,
    // `appli/soignee/reglages-equipe.html`) : trois cartes de 80 px sur une
    // ligne, la coche ronde au-dessus du mot, Patron à part. Ce sont des choix
    // qu'on lit côte à côte, comme les cartes de la TVA : en capsule, « Facturation »
    // toucherait les bords arrondis d'une carte de 98 px. Le bouton qui AGIT,
    // « Créer le compte », garde sa capsule.
    motif: /^src[/\\]app[/\\]reglages[/\\]equipe[/\\]ChoixRole\.tsx$/,
    seulement: /data-atlas=\{`carte-role-/,
    pourquoi: "cartes de choix du rôle, rangées côte à côte (planche du 26 octobre 2026)",
  },
  {
    // **LA LIGNE DU FICHIER DU DOSSIER JUSTIFIÉ** (27 octobre 2026, option A de
    // `appli/comptable-voir-le-dossier-pdf.html`, choisie par le patron : « je ne
    // sais pas où est le dossier »). Une tuile PDF, le nom et la taille : c'est le
    // fichier qu'on montre, à 18 px comme sur la planche (`.fichier`), pas un
    // geste. Télécharger et Envoyer, juste dessous, gardent leur capsule.
    motif: /^src[/\\]app[/\\]termines[/\\]comptable[/\\]dossiers[/\\]MesDossiers\.tsx$/,
    seulement: /data-atlas="ouvrir-dossier"/,
    pourquoi: "ligne du fichier du dossier, à 18 px comme la planche choisie",
  },
  {
    // **LA PLAGE DE L'AGENDA À RELIER** (même planche) : seul, la phrase qui
    // renvoie à l'agenda devient une plage qui se touche tout entière. C'est
    // une plage qu'on parcourt, à 6 px comme ses voisines, et non un geste.
    motif: /^src[/\\]app[/\\]reglages[/\\]AbsencesEquipe\.tsx$/,
    seulement: /data-atlas="agenda-a-relier"/,
    pourquoi: "plage qui se touche tout entière, à 6 px comme les autres plages",
  },
  {
    // **LA CARTE DE CHOIX DES RÉGLAGES SOIGNÉS** (`CarteChoix`, planches du 25
    // et du 26 octobre 2026) : franchise ou assujettie, la police d'un devis.
    // Deux choix qu'on lit côte à côte, chacun avec sa pastille, un titre et
    // une ligne dessous : en capsule, deux lignes dans une demi-largeur font
    // un ovale. Le bouton qui AGIT sur ces écrans garde sa capsule.
    motif: /^src[/\\]components[/\\]atlas[/\\]reglages[/\\]CarteChoix\.tsx$/,
    pourquoi: "carte de choix lue côte à côte, la forme des cartes du rôle et de la TVA",
  },
  {
    // **LES CARTES DES FORMULES** (Abonnement soigné, même série) : une carte
    // par formule, qui se touche pour se choisir et porte son prix et ce qui
    // la distingue. Le geste, « S'abonner à … », est la capsule du bas.
    motif: /^src[/\\]app[/\\]reglages[/\\]abonnement[/\\]AbonnementClient\.tsx$/,
    seulement: /data-atlas=\{`formule-/,
    pourquoi: "cartes des formules qu'on choisit avant d'appuyer sur le bouton du bas",
  },
  {
    // **LA FORMULE MOINS CHÈRE, DANS « AVANT DE PARTIR »** : une plage verte
    // qui porte le prix et la phrase, et qu'on touche tout entière. Une plage,
    // pas un geste en capsule.
    motif: /^src[/\\]app[/\\]reglages[/\\]abonnement[/\\]AvantDePartir\.tsx$/,
    seulement: /data-atlas="passer-a-moins-chere"/,
    pourquoi: "plage verte de la formule moins chère, qu'on touche tout entière",
  },
  {
    // **L'APERÇU DU PAPIER, DANS « SUR VOS PAPIERS »** (Mon entreprise soignée) :
    // l'en-tête du devis dessiné en miniature, qu'on touche pour ouvrir
    // l'exemple. C'est une feuille, pas un bouton.
    motif: /^src[/\\]app[/\\]reglages[/\\]identite[/\\]IdentiteClient\.tsx$/,
    seulement: /data-atlas="apercu-du-papier"/,
    pourquoi: "miniature du papier du devis, qu'on touche pour ouvrir l'exemple",
  },
  {
    // **LES HUIT CHARTES EN PETITS ÉCRANS** (Réglages soignés, planche du
    // 26 octobre 2026, `appli/soignee/reglages-apparence.html`) : deux cartes
    // par rangée, chacune portant un petit écran à ses couleurs, son nom, sa
    // phrase. Une carte de choix qu'on regarde avant de la prendre, comme les
    // cartes du rôle : en capsule, ses coins rogneraient le petit écran.
    motif: /^src[/\\]app[/\\]reglages[/\\]apparence[/\\]ApparenceClient\.tsx$/,
    seulement: /data-charte=\{charte\.nom\}/,
    pourquoi: "cartes des chartes, rangées deux par deux avec leur petit écran (planche du 26 octobre 2026)",
  },
];

/**
 * Le fichier, débarrassé de ses lignes de commentaire.
 *
 * **Sans cela, le contrôle accuse un COMMENTAIRE — vécu le 13 août 2026.** En
 * arrondissant « Créer la facture », la ligne d'explication écrite juste
 * au-dessus citait le rayon qu'on venait de retirer. Le motif l'a lue et a
 * dénoncé un bouton parfaitement rond. Une erreur qui accuse à tort coûte plus
 * cher que pas d'erreur du tout (`AGENTS.md`), et celle-là aurait fait perdre
 * du temps à chercher un défaut inexistant.
 *
 * On ne retire que les lignes qui COMMENCENT par `//` : un `https://` au milieu
 * d'une chaîne n'est pas un commentaire, et le couper casserait le texte
 * examiné juste après.
 */
function sansCommentaires(texte: string): string {
  return texte
    .split("\n")
    .map((l) => (/^\s*\/\//.test(l) ? "" : l))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function main() {
  console.log("=== Tous les boutons sont arrondis ===\n");

  const coupables: string[] = [];
  for (const f of fichiers(RACINE)) {
    // TOUTES les exceptions du fichier, pas la première : la fiche de sécurité en porte deux (ses
    // vignettes et l'aperçu du croquis), et `find` taisait la seconde (14 octobre 2026).
    const exceptions = HORS_CHARTE.filter((e) => e.motif.test(f));
    // Sans `seulement`, l'exception couvre le fichier entier — c'est le cas des
    // deux premières, écrites avant que ce champ n'existe.
    if (exceptions.some((e) => !e.seulement)) continue;
    const t = sansCommentaires(readFileSync(f, "utf8"));
    for (const m of t.matchAll(RECTANGULAIRE)) {
      if (exceptions.some((e) => e.seulement?.test(m[0]))) continue;
      const ligne = t.slice(0, m.index).split("\n").length;
      const rayon = m[1] ? `rayon ${m[1]} px` : `rounded-${m[2]}`;
      coupables.push(`${f}:${ligne} — ${rayon}`);
    }
  }

  const nom = "aucun bouton du produit ne garde un rayon rectangulaire";
  try {
    assert.equal(
      coupables.length,
      0,
      `${coupables.length} bouton(s) rectangulaire(s) :\n    ${coupables.join("\n    ")}\n` +
        "  Le patron a demandé la même forme partout le 12 août 2026. Employez " +
        "`rounded-full`, ou `PrimaryButton` quand ce n'est pas un bouton de formulaire."
    );
    console.log(`  ✓ ${nom}`);
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    console.log("\n❌ Boutons arrondis — 1 échec.");
    process.exit(1);
  }

  // **Le contrôle doit savoir ce qu'il compte.** Un motif qui ne trouverait
  // plus rien — parce qu'on aurait changé la façon d'écrire les classes —
  // passerait au vert sur une application entièrement carrée. On vérifie donc
  // qu'il sait encore reconnaître un bouton rectangulaire quand on lui en
  // montre un.
  //
  // **Quatre témoins, un par angle mort déjà payé.** Un seul témoin ne prouve
  // que le cas qu'il montre : les trois défauts trouvés par le patron sont
  // passés à côté d'un motif qui reconnaissait pourtant « un bouton carré ».
  const temoins: Array<[string, string]> = [
    ["valeur entre crochets", '<button className="rounded-[4px] py-3">Essai</button>'],
    ["flèche de fonction avant la classe", '<button onClick={() => f()} className="rounded-[4px]">E</button>'],
    ["rayon NOMMÉ de Tailwind", '<button className="rounded-md py-3">Essai</button>'],
    ["balise Link, celle du 13 août", '<Link href="/x" className="mt-4 rounded-md py-3">Essai</Link>'],
  ];
  for (const [quoi, temoin] of temoins) {
    const nom2 = `le motif reconnaît encore : ${quoi}`;
    assert.equal(
      [...temoin.matchAll(RECTANGULAIRE)].length,
      1,
      `Le motif ne reconnaît plus « ${quoi} » : ce contrôle passerait au vert sur ce cas-là.`
    );
    console.log(`  ✓ ${nom2}`);
  }

  // **Et l'inverse : la capsule ne doit JAMAIS être dénoncée.** Sans ce cas, un
  // motif trop large rendrait le contrôle rouge en permanence, et l'on
  // apprendrait à l'ignorer — on perdrait alors la forme unique qu'il garde.
  // Le commentaire qui a piégé le contrôle le 13 août : il cite un rayon carré
  // et ne doit plus rien déclencher.
  const enCommentaire = sansCommentaires(
    '        // il était resté en rounded-md\n        <Link href="/x" className="rounded-full">E</Link>'
  );
  assert.equal(
    [...enCommentaire.matchAll(RECTANGULAIRE)].length,
    0,
    "Le motif lit encore les commentaires : il dénoncerait un bouton parfaitement rond."
  );
  console.log("  ✓ un rayon cité dans un COMMENTAIRE ne déclenche rien");

  // **Une exception bornée doit rester bornée.** Sans ce témoin, une expression
  // `seulement` trop large — `/./` par exemple — pardonnerait tout le fichier
  // sans que rien ne le dise, et l'on croirait le planning surveillé.
  {
    const bornee = HORS_CHARTE.find((e) => e.seulement);
    assert.ok(bornee, "l'exception bornée a disparu : le mécanisme n'est plus éprouvé");
    const voisin = '<button onClick={() => f()} className="rounded-md">Déplacer</button>';
    assert.equal(
      bornee.seulement!.test(voisin),
      false,
      "l'exception bornée pardonne un bouton ordinaire : elle ne borne plus rien"
    );
    console.log("  ✓ une exception bornée ne pardonne QUE ce qu'elle nomme");
  }

  const capsule = '<Link href="/x" className="rounded-full py-3">Essai</Link>';
  assert.equal(
    [...capsule.matchAll(RECTANGULAIRE)].length,
    0,
    "Le motif dénonce une capsule : le contrôle deviendrait rouge quoi qu'on fasse."
  );
  console.log("  ✓ une capsule `rounded-full` n'est jamais dénoncée");

  console.log("\n✅ Boutons arrondis — 0 échec.");
}

main();
