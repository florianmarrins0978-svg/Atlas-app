/**
 * Comment on nomme un client, sur un document qui part chez lui.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le patron, le 13 août 2026, capture du devis à l'appui :** *« il faut qu'il
 * y ait écrit monsieur Martins et pas chez Martins »*, et pour la ligne du
 * client : *« c'est M. Martins »*.
 *
 * Il saisit « Martins » à la création du chantier. L'application ajoutait
 * « Chez » devant — la phrase de l'artisan qui parle de son chantier, pas celle
 * du document qu'il signe. Sur un devis, on s'adresse à quelqu'un.
 *
 * ── CE QUE CETTE FONCTION SUPPOSE, ET QU'IL FAUT SAVOIR ─────────────────────
 *
 * **La civilité est un défaut, pas une donnée.** Il n'existe aucun champ de
 * civilité dans `clients` : quand le patron tape « Martins », rien ne dit si
 * c'est un homme, une femme ou une société. Écrire « Mr. » là où il faudrait
 * « Mme » est une faute visible par le client — c'est le prix de ce choix, et
 * il est assumé parce que le patron l'a demandé en connaissance du nom qu'il
 * avait saisi.
 *
 * Ce que la fonction sait éviter, en revanche, et qui serait pire :
 *
 * - **« Mr. Mme Roux »** — un nom qui porte déjà sa civilité la garde,
 *   quelle qu'en soit la graphie (`M.`, `Mr`, `Mme`, `Mlle`, `Dr`…).
 * - **« Mr. SARL Untel »** — une raison sociale n'est pas une personne.
 *   La liste des marqueurs est volontairement courte et explicite : mieux vaut
 *   la compléter le jour où un cas passe que deviner large et se tromper sur un
 *   vrai patronyme.
 *
 * **Une seule définition, et elle sert partout** (`CLAUDE.md` §3) : le nom du
 * chantier à la création, la fiche du devis, la ligne du client. Deux copies de
 * cette règle finiraient par diverger, et le patron lirait « Mr. Martins » en
 * tête d'un écran et « Martins » trois lignes plus bas.
 */

/**
 * Les deux civilités qu'il peut choisir, et le mot qui les écrit.
 *
 * **Sa demande du 13 août 2026, au soir :** *« il faut intégrer une case
 * monsieur-madame, sous la forme Mr Mme, en cliquable, on choisit au-dessus du
 * nom. »* Depuis, la civilité est une **donnée** : elle vit sur la fiche client
 * (migration 0038) et se recopie sur le devis et la facture.
 */
export const CIVILITES = { mr: "Mr.", mme: "Mme" } as const;

export type Civilite = keyof typeof CIVILITES;

/** Ce qu'il a choisi, ou `null` s'il n'a rien choisi. Les trois états. */
export type CiviliteChoisie = Civilite | null | undefined;

/**
 * Le mot posé devant un nom nu **quand il n'a rien choisi**. Un seul endroit
 * pour en changer — et il A changé.
 *
 * **Le patron, le 13 août 2026, après avoir vu « Monsieur Martins » à l'écran :**
 * *« Mr. Martins, pas Monsieur. »* C'est sa forme, sur ses documents ; l'usage
 * français écrirait « M. », mais c'est lui qui signe les devis.
 *
 * Tout ce qui affiche un client passe par ici : changer ce mot suffit, et les
 * contrôles construisent leurs attentes à partir de cette constante plutôt que
 * de recopier le mot — sans quoi la moindre correction de sa part rougirait une
 * dizaine de suites sans rien apprendre à personne.
 */
export const CIVILITE_PAR_DEFAUT = CIVILITES.mr;

/**
 * Civilités déjà écrites, sous les graphies qu'un artisan tape vraiment.
 *
 * Comparées sans accent ni casse, et **suivies d'un séparateur** : sans cela,
 * « Merlin » commencerait par « m » et « Mathieu Dubois » passerait pour un
 * « M. » — le contrôle attrape les deux.
 */
const CIVILITES_CONNUES = [
  "m",
  "mr",
  "mme",
  "mmes",
  "mlle",
  "melle",
  "mm",
  "monsieur",
  "messieurs",
  "madame",
  "mesdames",
  "mademoiselle",
  "dr",
  "docteur",
  "me",
  "maitre",
];

/**
 * Marqueurs de raison sociale. Courte à dessein : chaque entrée est un mot
 * qu'aucun patronyme français ne porte seul.
 */
const MARQUEURS_SOCIETE = [
  "sarl",
  "sas",
  "sasu",
  "sa",
  "eurl",
  "sci",
  "scp",
  "snc",
  "ei",
  "eirl",
  "scop",
  "gaec",
  "association",
  "asso",
  "syndic",
  "copropriete",
  "mairie",
  "commune",
  "ville",
  "societe",
  "entreprise",
  "etablissements",
  "ets",
  "cabinet",
  "groupe",
  "cie",
];

/** Sans accents, sans casse : « Rivière » et « RIVIERE » sont le même mot. */
function aplati(texte: string): string {
  return texte
    .normalize("NFD")
    // Les signes combinants écrits en clair : la même classe posée avec de
    // vrais accents ne se relit pas, et se casse au premier outil qui
    // normalise le fichier.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Le nom porte-t-il DÉJÀ une civilité écrite à la main ?
 *
 * Séparée de la détection de société depuis le 13 août 2026, et ce n'est pas
 * un rangement : un choix explicite doit primer sur « ça ressemble à une
 * société », **jamais** sur « la civilité y est déjà ». Les deux questions
 * mêlées, toucher « Mme » sur « Mme Roux » écrivait « Mme Mme Roux ».
 */
export function aDejaUneCivilite(nom: string): boolean {
  const mots = aplati(nom.trim()).split(/[^0-9a-z]+/).filter(Boolean);
  if (mots.length === 0) return true;
  // La civilité ne compte que **devant** : « Jean-Marie » n'en est pas une, et
  // « Dupont Me Untel » non plus.
  return CIVILITES_CONNUES.includes(mots[0]);
}

/** Le nom porte-t-il déjà une civilité, ou est-ce une raison sociale ? */
export function porteDejaSonAppellation(nom: string): boolean {
  const mots = aplati(nom.trim()).split(/[^0-9a-z]+/).filter(Boolean);
  if (mots.length === 0) return true;
  if (aDejaUneCivilite(nom)) return true;

  // Un marqueur de société, lui, peut se trouver n'importe où — « Untel SARL »
  // se rencontre autant que « SARL Untel ».
  return mots.some((mot) => MARQUEURS_SOCIETE.includes(mot));
}

/**
 * « Martins » → « Mr. Martins », ou « Mme Martins » s'il l'a choisi.
 *
 * **Idempotente** : l'appliquer deux fois donne le même résultat. C'est ce qui
 * permet de la poser sur un nom déjà stocké sans risquer « Mr. Mr. Martins » —
 * cas réel, puisque les chantiers créés avant le 13 août 2026 portent leur nom
 * en base.
 *
 * **Un choix explicite prime sur tout le reste, y compris sur la détection.**
 * S'il a touché « Mme » pour une cliente que la liste des sociétés attrapait à
 * tort (« Mme Boulangerie du Bourg »), c'est lui qui a raison : la détection
 * n'existe que pour combler son silence, pas pour le contredire. Un nom qui
 * porte DÉJÀ sa civilité n'en reçoit pas une seconde, choix ou non — sans quoi
 * « Mme Roux » deviendrait « Mme Mme Roux » au premier appui.
 *
 * @param nom Ce que le patron a saisi. Vide ou absent : rien n'est fabriqué.
 * @param civilite Ce qu'il a CHOISI, ou `null`/`undefined` s'il n'a rien dit —
 *   auquel cas la règle d'avant le 13 août 2026 s'applique encore : civilité
 *   par défaut sur un patronyme nu, rien sur une société. C'est ce qui fait que
 *   les clients d'avant ne changent pas d'apparence du jour au lendemain.
 */
export function avecCivilite(nom: string | null | undefined, civilite?: CiviliteChoisie): string {
  const propre = nom?.trim() ?? "";
  if (propre === "") return "";
  if (aDejaUneCivilite(propre)) return propre;
  if (civilite) return `${CIVILITES[civilite]} ${propre}`;
  if (porteDejaSonAppellation(propre)) return propre;
  return `${CIVILITE_PAR_DEFAUT} ${propre}`;
}
