/**
 * LA JOURNÉE DU PLANNING — les règles, à part de tout écran.
 *
 * Tout ce fichier vient de la planche 84 (`appli/planning-simple.html`),
 * essayée par le patron pendant deux soirées et retenue le 21 août 2026 :
 * *« maintenant tu peux coder cette version de la maquette, trait pour
 * trait »*. Chaque fonction porte la phrase qui l'a fait naître.
 *
 * **Elles sont pures, et c'est la règle de la maison** (`CLAUDE.md` §3) : un
 * écran n'a rien à décider. Le calendrier, la fiche du jour et la liste des
 * planifiés lisent les MÊMES fonctions — trois calculs séparés finiraient par
 * peindre une couleur qui contredit le compte écrit juste à côté.
 */

import type { Moment } from "@/server/disponibilites";

/**
 * Une demi-journée. Le même vocabulaire que `creneauDebut` en base et que
 * `Moment` dans `disponibilites.ts` : un troisième mot pour la même chose
 * obligerait à traduire à chaque frontière, et c'est en traduisant qu'on se
 * trompe.
 */
export type Demi = Moment;
export const DEMIS: readonly Demi[] = ["matin", "apres_midi"];

/** Ce qui s'écrit dans la colonne de gauche d'une ligne de la fiche du jour. */
export const MOT_DEMI: Record<Demi, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
};

/**
 * L'état d'une demi-journée : rien, incomplet, complet, ou au-delà.
 *
 * **Sa proposition du 21 août 2026, et c'est la bonne :** *« une fois qu'on a
 * mis deux chantiers avec deux gars, on dit que c'est complet. Et si
 * l'utilisateur en rajoute un troisième, on met une autre couleur pour lui
 * signaler qu'il a dépassé le quota — mais il peut quand même le faire. S'il
 * veut mettre trois chantiers par jour avec deux gars, il le fait ; nous, on
 * prévient juste. »*
 *
 * **Ce que ce modèle résout, et que ni « complet » ni « aucune limite » ne
 * réglaient :** un repère existe — une équipe, un chantier, une demi-journée —
 * sans jamais devenir une barrière. Le dépassement se VOIT ; il ne se refuse
 * pas. C'est lui qui sait qu'une taille de haie prend une heure.
 *
 * **`dispo` et non `place`** : `.place` désignait déjà les lignes de chantier
 * dans la fiche du jour, et les deux mots se sont croisés dans la légende — le
 * carré « incomplet » héritait de la marge des lignes et tombait cinq pixels
 * plus bas. Vu par lui, sur son téléphone.
 */
export type EtatDemi = "libre" | "dispo" | "plein" | "dela";

export type OccupationDemi<C> = {
  /** Les chantiers posés sur cette demi-journée. */
  pris: readonly C[];
  /** 1 = chaque équipe a son chantier. Au-delà, on prévient. */
  charge: number;
};

/**
 * Ce qu'une demi-journée porte, et à quelle charge.
 *
 * **Le week-end ne se calcule pas ici** : l'appelant ne lui passe simplement
 * aucun chantier. Faire porter le calendrier à cette fonction en ferait la
 * seconde à savoir quels jours s'ouvrent, et deux réponses finiraient par
 * diverger.
 *
 * **`equipesAbsentes` compte comme des chantiers.** *Le patron, le 14 août
 * 2026 : « une équipe qui doit partir en déplacement pour cinq jours ».* Une
 * équipe absente retire de la place, exactement comme un chantier en prend :
 * l'ignorer ferait afficher au planning un jour libre que l'écran d'envoi
 * refuse au client — deux vérités sur la même capacité, sur deux écrans qui se
 * suivent (`CLAUDE.md` §3).
 */
export function occupationDemi<C>(
  pris: readonly C[],
  nombreEquipes: number,
  equipesAbsentes = 0,
  /**
   * Combien d'équipes ce chantier mobilise sur cette demi-journée.
   *
   * **Sa question du 22 août 2026 :** *« pourquoi le matin et l'après-midi de
   * monsieur Eric s'affichent en incomplet ? »* — Julien ET Antoine y étaient.
   * La charge comptait les CHANTIERS : un chantier pour deux équipes valait la
   * moitié, et ce jour-là partait chez ses clients alors qu'il n'avait plus
   * personne à envoyer.
   *
   * **Sa règle, une fois la planche 89 vue :** *« oui si c'est des journées
   * complètes, non si c'est des demi-journées »*. Elle tombe d'elle-même du
   * comptage par demi-journée — un chantier d'une journée avec ses deux équipes
   * prend les deux créneaux et ferme le jour ; sur une seule demi-journée, il ne
   * ferme que le matin.
   *
   * Omise, chaque chantier vaut une équipe : c'est l'ancien comportement, et il
   * reste juste là où aucune affectation n'est renseignée. Le compter zéro
   * viderait le planning.
   */
  equipesDe?: (chantier: C) => number
): OccupationDemi<C> {
  // **Jamais de division par zéro.** `nombre_equipes` vaut au minimum 1 en
  // base, mais une entreprise absente rendrait `0` : la charge deviendrait
  // `Infinity`, et le calendrier peindrait « au-delà » sur une journée vide.
  const equipes = Math.max(1, nombreEquipes);
  const mobilisees = pris.reduce(
    (total, c) => total + Math.max(1, Math.trunc(equipesDe ? equipesDe(c) : 1)),
    0
  );
  return { pris, charge: (mobilisees + Math.max(0, equipesAbsentes)) / equipes };
}

export function etatDemi<C>(o: OccupationDemi<C>): EtatDemi {
  // La charge peut être non nulle sans un seul chantier : une équipe absente en
  // prend aussi. On peint alors l'occupation, pas « rien » — sinon le
  // calendrier montrerait une journée vide là où l'on ne peut plus rien poser.
  if (o.pris.length === 0 && o.charge === 0) return "libre";
  if (o.charge < 1) return "dispo";
  return o.charge === 1 ? "plein" : "dela";
}

/**
 * De combien la barre du calendrier se remplit, en pourcentage.
 *
 * **Plafonnée à 100 % pour le DESSIN** : au-delà, c'est la couleur qui parle.
 * Une barre qui déborderait de sa case rendrait le mois illisible là où il doit
 * justement se lire d'un coup d'œil.
 */
export function partDeLaBarre(charge: number): number {
  return Math.round(Math.min(charge, 1) * 100);
}

/**
 * Ce que dit une demi-journée, en toutes lettres.
 *
 * **Le pourcentage ne s'écrit QUE s'il dépasse.** À 100 % il n'apprendrait rien
 * de plus que « complet » ; en dessous, il ferait lire un calcul là où il
 * suffit de compter.
 */
export function ditLeCompteDemi<C>(o: OccupationDemi<C>): string {
  if (o.pris.length === 0) return "libre";
  const chantiers = `${o.pris.length} chantier${o.pris.length > 1 ? "s" : ""}`;
  if (o.charge > 1) return `${chantiers} · ${Math.round(o.charge * 100)} % de vos équipes`;
  if (o.charge === 1) return `${chantiers} · complet`;
  return chantiers;
}

/**
 * Ce que dit la JOURNÉE, en un seul endroit.
 *
 * **Sa correction du 21 août :** *« "1 chantier" de l'aprem, supprime, c'est
 * déjà écrit pour le matin »*. Le compte était rendu deux fois — une par
 * demi-journée — et sur un chantier à la journée les deux lignes disaient le
 * même mot.
 *
 * La charge se prend sur la demi-journée la plus chargée : c'est elle qui
 * décide de la couleur du calendrier, et c'est elle qu'il faut savoir.
 */
export function ditLeCompteDuJour(nombreChantiers: number, chargeMax: number): string {
  if (nombreChantiers === 0) return "libre";
  const texte = `${nombreChantiers} chantier${nombreChantiers > 1 ? "s" : ""}`;
  if (chargeMax > 1) return `${texte} · ${Math.round(chargeMax * 100)} % de vos équipes`;
  if (chargeMax === 1) return `${texte} · complet`;
  return texte;
}

/**
 * Ce qu'affiche la pastille d'équipe d'un chantier.
 *
 * **Un chantier peut porter PLUSIEURS équipes.** Sa demande du 21 août :
 * *« lorsque je choisis une équipe je dois pouvoir mettre toutes les équipes si
 * je le souhaite, le même jour ou même sur la même demi-journée — tout le monde
 * le matin, puis tout le monde l'aprem »*. Un gros chantier se fait à
 * plusieurs, et l'écran doit pouvoir le dire.
 *
 * Au-delà de deux noms on compte, sinon la ligne déborde sur un téléphone.
 */
export function ditLesEquipes(noms: readonly string[]): string {
  if (noms.length === 0) return "Équipe ?";
  if (noms.length <= 2) return noms.join(", ");
  return `${noms[0]} +${noms.length - 1}`;
}

export type BlocChantier<C> = { type: "chantier"; chantier: C; demis: Demi[] };
export type BlocLibre = { type: "libre"; demi: Demi };
export type BlocJour<C> = BlocChantier<C> | BlocLibre;

/**
 * Ce que montre la fiche d'une journée, dans l'ordre.
 *
 * **Le chantier passe AU-DESSUS de ses demi-journées** — sa correction du
 * 21 août, capture à l'appui : *« Mr. Leroy au-dessus du carré vert clair
 * matin ; supprime le Mr. Leroy pour l'aprem, c'est le même chantier, pas
 * besoin de répéter ; et supprime le trait entre le matin et l'après-midi, là
 * on a l'impression que c'est deux chantiers différents. »*
 *
 * L'écran était bâti sur les demi-journées : deux blocs séparés par un filet,
 * chacun rejouant le nom du client. Un chantier qui dure la journée s'y
 * écrivait deux fois — l'écran FABRIQUAIT deux chantiers là où il n'y en a
 * qu'un.
 *
 * **Et le nom passe devant ce qui reste libre :** *« fais pareil pour les
 * autres, le nom toujours en premier ! »*. Une demi-journée vide ouvrait la
 * fiche, et l'on lisait ce qui MANQUE avant de savoir de qui il s'agit — alors
 * que c'est le client qu'il cherche.
 *
 * Une demi-journée que personne n'occupe garde sa ligne : la cacher ferait
 * croire que la journée entière est prise.
 */
export function blocsDeLaJournee<C>(
  chantiers: readonly C[],
  occupe: (chantier: C, demi: Demi) => boolean
): BlocJour<C>[] {
  const groupes = chantiers
    .map((chantier) => ({ chantier, demis: DEMIS.filter((d) => occupe(chantier, d)) }))
    .filter((g) => g.demis.length > 0);

  const blocs: BlocJour<C>[] = [];
  // Les chantiers d'abord, dans l'ordre où ils commencent.
  for (const demi of DEMIS) {
    for (const g of groupes.filter((g) => g.demis[0] === demi)) {
      blocs.push({ type: "chantier", chantier: g.chantier, demis: g.demis });
    }
  }
  // Puis ce qui reste libre, avant le bouton d'ajout — qui est justement le
  // geste qu'appelle une demi-journée vide.
  for (const demi of DEMIS) {
    if (!groupes.some((g) => g.demis.includes(demi))) blocs.push({ type: "libre", demi });
  }
  return blocs;
}

/**
 * Le moment d'un chantier, tel qu'il se choisit et se lit : matin,
 * après-midi, ou la journée.
 *
 * **Trois mots, parce que ce sont les trois boutons de « Déplacer ».** La base,
 * elle, porte un départ et une durée en demi-journées : c'est plus riche — un
 * chantier peut durer trois jours — et c'est pourquoi la traduction se fait ici
 * une fois pour toutes, plutôt que dans chaque écran.
 */
export type QuandChantier = "matin" | "apres" | "journee";

export const MOT_QUAND: Record<QuandChantier, string> = {
  matin: "Matin",
  apres: "Après-midi",
  journee: "Journée",
};

/**
 * Le départ et la durée qu'écrit chacun des trois boutons.
 *
 * **Un chantier plus long qu'une journée garde sa durée.** « Journée » sur un
 * chantier de trois jours le raccourcirait à deux demi-journées sans que rien
 * ne le dise : le patron déplacerait son chantier et perdrait deux jours de
 * travail en silence. Le bouton ne fait alors que changer le DÉPART.
 */
export function departEtDuree(
  quand: QuandChantier,
  dureeActuelle: number
): { moment: Demi; duree: number } {
  if (dureeActuelle > 2) {
    return { moment: quand === "apres" ? "apres_midi" : "matin", duree: dureeActuelle };
  }
  if (quand === "journee") return { moment: "matin", duree: 2 };
  return { moment: quand === "apres" ? "apres_midi" : "matin", duree: 1 };
}

/**
 * Comment se lit, en un mot, un chantier déjà posé.
 *
 * **« ½ journée » ne s'écrit plus.** Sa remarque du 21 août : *« il y a marqué
 * matin, et à chaque fois demi-journée — on sait que c'est une demi-journée »*.
 * Un mot qui répète son voisin se lit quand même, et fait douter qu'il dise
 * autre chose.
 *
 * Au-delà de deux demi-journées, le chantier dure plus d'une journée et l'écrire
 * « journée » serait faux : on dit alors combien de jours.
 */
/**
 * COMBIEN DE TEMPS PREND CE CHANTIER — et non pas à quelle heure il commence.
 *
 * **Sa demande du 22 août 2026**, capture à l'appui : *« à la place de "matin",
 * je pense qu'il doit y avoir écrit la durée du chantier [...] parce que ce
 * n'est pas clair quand il y a marqué le matin et l'après-midi »*. Éprouvée sur
 * la planche 86, puis retenue le jour même — *« c'est exactement ce que je
 * veux »*.
 *
 * **Elle compte la DURÉE du chantier, jamais les demi-journées visibles ce
 * jour-là.** Un chantier de trois jours n'occupe que deux demi-journées sur la
 * journée qu'on regarde : compter ce qu'on voit lui ferait annoncer « une
 * journée », c'est-à-dire exactement le malentendu qu'il demande de faire
 * disparaître. La première version de la planche tombait dans ce piège.
 *
 * Trois demi-journées valent « une journée et demie » : arrondir à deux jours
 * ferait réserver une journée qu'on n'a pas vendue, et l'arrondir à une la
 * ferait perdre.
 */
export function ditLaDuree(duree: number): string {
  if (duree <= 1) return "une demi-journée";
  if (duree === 2) return "une journée";
  if (duree === 3) return "une journée et demie";
  return `${Math.ceil(duree / 2)} jours`;
}

export function ditLeQuand(moment: Demi, duree: number): string {
  if (duree > 2) {
    const jours = Math.ceil(duree / 2);
    return `${jours} jours`;
  }
  if (duree === 2) return "journée";
  return moment === "matin" ? "matin" : "après-midi";
}
