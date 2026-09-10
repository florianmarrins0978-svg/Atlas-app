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

import { DUREE_PAR_DEFAUT_DEMI_JOURNEES, type Moment } from "@/lib/disponibilites";

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

/**
 * LE MOT de chaque état, écrit UNE fois.
 *
 * **Sa demande du 31 août 2026 :** *« écrit deux chantiers par jour, planning
 * complet, et met le petit carré vert foncé avec écrit "complet" du planning »*
 * — sur l'écran Réglages, qu'il a désigné : *« c'est sur cette page que doit se
 * faire la modification »*.
 *
 * Ces quatre mots vivaient dans la légende du calendrier, en clair. Le réglage
 * des chantiers menés en même temps les emploie maintenant lui aussi : recopier
 * « complet » dans un second écran, c'est accepter qu'un jour l'un dise
 * « complet » et l'autre « plein » pour la même couleur — et c'est le genre
 * d'écart qu'on ne voit jamais, parce que les deux écrans ne se lisent pas
 * ensemble (`CLAUDE.md` §3).
 *
 * **« rien » et non « libre »** : c'est le mot de la légende, celui qu'il a sous
 * les yeux. `ditLaBarre` dit « libre » à voix haute, pour qui n'emploie pas ses
 * yeux — une phrase lue n'est pas une étiquette.
 */
export const MOT_ETAT: Record<EtatDemi, string> = {
  libre: "rien",
  dispo: "incomplet",
  plein: "complet",
  dela: "au-delà",
};

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
 * Ce qu'affiche la pastille « qui part » d'un chantier.
 *
 * **Un chantier peut porter PLUSIEURS personnes.** Sa demande du 21 août :
 * *« lorsque je choisis une équipe je dois pouvoir mettre toutes les équipes si
 * je le souhaite, le même jour ou même sur la même demi-journée — tout le monde
 * le matin, puis tout le monde l'aprem »*. Un gros chantier se fait à
 * plusieurs, et l'écran doit pouvoir le dire.
 *
 * **Vide, elle dit « Qui ? » et non plus « Équipe ? »** — sa demande du 26 août
 * 2026 : *« et plus les équipes A ou B »*. Ce qu'on coche là est devenu une
 * personne ; garder le mot « équipe » sur la case aurait laissé à l'écran le
 * vocabulaire qu'il vient de faire retirer. Elle y gagne aussi la largeur qui
 * lui manquait sur un téléphone.
 *
 * Au-delà de deux noms on compte, sinon la ligne déborde sur un téléphone.
 *
 * **La barre oblique sépare, la virgule énumérait** — sa demande du 9 septembre
 * 2026 : *« à la place de noter les salariés avec une virgule, mets Julien /
 * Antoine, un / entre chaque salarié »*. Sur une pastille pleine, la virgule
 * se lit mal : elle tombe sous la ligne de base, presque contre le nom
 * suivant, et deux noms courts finissent par se lire comme un seul.
 *
 * Une seule fonction l'écrit, pour le planning comme pour la fiche de chantier
 * (`CLAUDE.md` §3) : deux façons d'énumérer les mêmes personnes auraient
 * divergé au premier ajustement.
 */
export function ditQuiPart(noms: readonly string[]): string {
  if (noms.length === 0) return "Qui ?";
  if (noms.length <= 2) return noms.join(" / ");
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
 * **LA JOURNÉE SE LIT DANS SON ORDRE — matin, puis après-midi, TOUJOURS.** Sa
 * décision du 10 septembre 2026 : *« oui, matin puis aprèm »*.
 *
 * **Elle revient sur sa règle du 21 août**, et il faut le savoir avant de la
 * défaire à nouveau. Il avait alors demandé *« le nom toujours en premier ! »* :
 * une demi-journée vide ouvrait la fiche, et l'on lisait ce qui MANQUE avant de
 * savoir de qui il s'agit. La conséquence n'était visible sur aucune capture de
 * l'époque : les chantiers passant d'abord et les moitiés libres ensuite, un
 * chantier posé l'APRÈS-MIDI faisait lire la fiche « après-midi puis matin ».
 * Les deux lignes échangeaient donc leur place selon l'heure du chantier, et
 * l'appui sur « Matin » les faisait sauter — *« j'ai l'impression que c'est
 * inversé »*, le 9 septembre 2026.
 *
 * **Ce que cela coûte, et qu'il a accepté :** sur une journée dont seul
 * l'après-midi est pris, la fiche s'ouvre sur « libre ». Une place stable vaut
 * mieux qu'un nom en tête, parce qu'une place stable se retrouve sans lire.
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
  // **UNE SEULE PASSE, DANS L'ORDRE DE LA JOURNÉE.** Il y en avait deux — les
  // chantiers, puis ce qui restait libre —, et c'est ce qui faisait échanger
  // leurs places aux deux moitiés du jour.
  for (const demi of DEMIS) {
    for (const g of groupes.filter((g) => g.demis[0] === demi)) {
      blocs.push({ type: "chantier", chantier: g.chantier, demis: g.demis });
    }
    // Une moitié que personne n'occupe garde sa ligne, à SA place : la cacher
    // ferait croire que la journée entière est prise.
    if (!groupes.some((g) => g.demis.includes(demi))) blocs.push({ type: "libre", demi });
  }
  return blocs;
}

/**
 * Un jour écrit « 2026-08-31 », et rien d'autre.
 *
 * **Écrit ici, avec le reste de la règle du planning.** L'agent conversationnel
 * peut proposer une date (sa demande du 26 août 2026) : sans ce contrôle, un
 * « lundi prochain » mal traduit deviendrait une chaîne quelconque écrite en
 * base, et le chantier disparaîtrait du calendrier sans qu'on sache pourquoi.
 *
 * **Il refuse aussi un jour qui n'existe pas** — le 31 février s'écrit
 * parfaitement sur dix caractères. `Date` le décale au 3 mars ; on compare donc
 * ce qu'elle rend à ce qu'on lui a donné.
 */
export function estUnJourValide(jour: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return false;
  const d = new Date(`${jour}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === jour;
}

/**
 * « matin » ou « apres_midi » — les deux seuls départs possibles.
 *
 * **Ils portent les mots de la BASE, et c'est le lot du 10 septembre 2026 qui
 * l'a ramené là.** Un troisième mot vivait ici, « journee », et il ne décrivait
 * pas un départ mais une ÉTENDUE : le choisir réécrivait la durée du chantier.
 * Sa décision — *« tu retires la journée »* — supprime le mélange, et avec lui
 * la traduction qui existait pour le rattraper.
 */
export function estUnDemiValide(demi: string): demi is Demi {
  return demi === "matin" || demi === "apres_midi";
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

/**
 * D'OÙ PART CE CHANTIER — la seule question que « Déplacer » pose encore.
 *
 * **Sa décision du 10 septembre 2026 :** *« il faut garder le bouton déplacer ;
 * quand on clique dessus on arrive sur ce bouton matin - aprem, on clique sur
 * l'un ou l'autre et le bouton disparaît »*. Un interrupteur à deux positions,
 * et rien d'autre.
 *
 * **Ce que cela retire, et qui était un vrai piège :** le troisième mot,
 * « Journée », ne décrivait pas un départ mais une ÉTENDUE. Le choisir
 * réécrivait `dureeDemiJournees` — « Matin » sur un chantier d'une journée le
 * ramenait donc à une demi-journée, en silence, et l'après-midi redevenait
 * vendable. La durée vient du devis (§308) ; « Déplacer » n'y touche plus, et
 * la traduction qui existait pour rattraper ce mélange a disparu avec lui.
 */
export function departDuChantier(c: { creneauDebut: string | null }): Demi {
  return c.creneauDebut === "apres_midi" ? "apres_midi" : "matin";
}

/**
 * CE QUI RESTE D'ÉQUIPES SUR UN JOUR QU'IL S'APPRÊTE À PROPOSER.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa colère du 22 août 2026 :** *« je peux proposer le 24 alors qu'un client a
 * validé le 24 — corrige-moi ça ! »* Le défaut de code a été réparé le jour
 * même ; ce qui restait n'en était pas un : **avec deux équipes, un jour où une
 * seule est prise reste proposable**, et c'est voulu. Mais aucun écran ne le
 * disait, et rien ne distinguait un jour vide d'un jour à moitié pris.
 *
 * **Sa réponse du 25 août : B**, avec une réserve — *« par contre "1 chantier
 * sur 2" on ne comprend pas très bien, comment on peut faire pour comprendre
 * mieux ? »*
 *
 * **Et il a raison.** « 1 chantier sur 2 équipes » compte ce qui est PRIS, alors
 * que ce qu'il décide dépend de ce qui RESTE : il est en train de proposer une
 * date, la question est « puis-je encore envoyer quelqu'un ce jour-là ». D'où
 * « Reste 1 équipe sur 2 » — même information, tournée du côté du geste.
 *
 * **On retient le PIRE des deux demi-journées.** Un jour dont le matin est plein
 * et l'après-midi libre n'a pas « une équipe et demie » de libre : il a un
 * moment où il n'y a personne, et c'est celui-là qui contraint. Faire la moyenne
 * annoncerait de la place là où il n'y en a pas — l'erreur exacte qu'il a
 * signalée, sous une autre forme.
 *
 * **Rien ne s'écrit quand tout est libre.** Un avertissement qui parle à tort
 * s'apprend à être ignoré, et l'on perd le garde-fou sans s'en apercevoir
 * (`CLAUDE.md` §4 ter). Rien non plus quand il n'a qu'une équipe : « Reste
 * 0 équipe sur 1 » n'apprend rien à qui n'a personne d'autre à envoyer, et le
 * serveur refuse déjà le jour.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function equipesLibresCeJour(
  chargeMatin: number,
  chargeApresMidi: number,
  nombreEquipes: number
): number {
  const equipes = Math.max(1, Math.trunc(nombreEquipes));
  // La charge est une part d'équipes ; on la ramène en équipes entières. On
  // ARRONDIT AU SUPÉRIEUR le nombre de prises — se tromper vers « il reste
  // moins » est le sens sûr : annoncer une équipe libre qui ne l'est pas fait
  // proposer un jour au client, et c'est lui qui rappelle pour décommander.
  const prises = Math.ceil(Math.max(chargeMatin, chargeApresMidi) * equipes - 1e-9);
  return Math.max(0, equipes - Math.min(equipes, prises));
}

/** « Reste 1 équipe sur 2 » — ou rien du tout, quand il n'y a rien à signaler. */
export function ditCeQuiResteCeJour(libres: number, nombreEquipes: number): string | null {
  const equipes = Math.max(1, Math.trunc(nombreEquipes));
  if (equipes < 2) return null;
  if (libres >= equipes) return null;
  if (libres <= 0) return `Plus d'équipe libre sur ${equipes}`;
  return `Reste ${libres} équipe${libres > 1 ? "s" : ""} sur ${equipes}`;
}
