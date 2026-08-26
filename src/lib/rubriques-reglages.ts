/**
 * Les rubriques des réglages : lesquelles existent, et QUI LES VOIT.
 *
 * **Fonction pure, dans `src/lib/`, et ce n'est pas un rangement.** La même
 * liste sert à dessiner le sommaire et — le jour où le cloisonnement sera codé
 * partout — à refuser une adresse tapée à la main. Deux implémentations d'une
 * même règle finissent toujours par diverger (`CLAUDE.md` §3), et ici la
 * divergence serait un salarié qui voit les coordonnées bancaires.
 *
 * **La règle vient du patron, le 13 août 2026 :** *« un salarié peut changer
 * ses notifications ou son mot de passe, mais il ne doit évidemment pas pouvoir
 * modifier les tarifs ou les coordonnées bancaires. »* Et `docs/QUESTIONS.md`
 * §10 va plus loin : ce qu'un rôle n'a pas le droit de voir ne doit pas SORTIR
 * DU SERVEUR. D'où deux ensembles — sans eux, il n'y a nulle part où couper.
 *
 * **`bientot` n'est pas de l'ornement.** Le dépôt interdit de laisser croire
 * qu'une chose fonctionne : une rubrique dessinée mais non codée se voit — il
 * saura qu'elle vient — et elle ne ment pas. Le jour où elle est codée, on lui
 * donne un `href` et on retire le drapeau.
 */
import type { NomIcone } from "@/app/reglages/icones";
import { cheminAutorise, type Role } from "./acces-roles";

/**
 * **Le rôle vient de `acces-roles.ts`, il ne se redéclare plus ici.**
 *
 * Cette ligne portait `"proprietaire" | "membre"`, écrit à la main — une seconde
 * liste des rôles, qui a cessé d'être vraie le jour où le commercial et le
 * salarié sont entrés en base (migration 0065). L'import est **de type
 * seulement** : il s'efface à la compilation, et les deux fichiers peuvent donc
 * se citer l'un l'autre sans tourner en rond à l'exécution.
 */
export type RoleReglages = Role;

export type Rubrique = {
  /** Le libellé, tel qu'il est sur sa planche du 14 août 2026. */
  nom: string;
  /** La ligne qui dit ce qu'on y trouve. Jamais vide : une rubrique sans
   *  explication oblige à l'ouvrir pour savoir si c'est la bonne. */
  dit: string;
  icone: NomIcone;
  /** Où elle mène. `null` tant qu'elle n'est pas codée. */
  href: string | null;
};

export type EnsembleRubriques = { titre: string; rubriques: Rubrique[] };

/** Ce qui appartient à la personne : elle l'emporte d'une entreprise à l'autre. */
const MOI: Rubrique[] = [
  {
    nom: "Mon compte",
    // **« et téléphone » a été RETIRÉ le 14 août 2026, sur sa réponse « A ».**
    // La table des comptes n'en porte pas, et rien ne l'appellerait : le numéro
    // que ses clients voient est celui de l'entreprise. Un libellé qui promet
    // un champ inexistant fait ouvrir la rubrique pour rien.
    dit: "Nom et e-mail",
    icone: "compte",
    href: "/reglages/compte",
  },
  {
    nom: "Notifications",
    dit: "Alertes et rappels",
    icone: "cloche",
    href: "/reglages/notifications",
  },
  {
    nom: "Connexion",
    // **« et appareils » a été RETIRÉ le 14 août 2026, sur sa réponse « A ».**
    // Atlas ne garde aucune session en base : il n'y avait rien à lister. Ce
    // qui existe, et qui est le geste utile, c'est « me déconnecter partout ».
    dit: "Mot de passe et sécurité",
    icone: "cadenas",
    href: "/reglages/connexion",
  },
  {
    nom: "Apparence",
    // **Le libellé ne promet plus un thème sombre qui n'existe pas.** L'écran
    // dit ce qui viendra et pourquoi ce n'est pas là ; le sommaire, lui, ne
    // doit pas laisser croire qu'on va le choisir aujourd'hui.
    dit: "Les couleurs de l'application",
    icone: "contraste",
    href: "/reglages/apparence",
  },
];

/**
 * Ce qui appartient à l'entreprise.
 *
 * **L'ordre est le sien**, et il porte ses quatre priorités du 13 août 2026 —
 * entreprise, équipe, tarifs, documents — plus le planning qu'il a ajouté sur
 * sa planche. Les ranger autrement obligerait à parcourir la liste pour trouver
 * ce qu'on vient chercher neuf fois sur dix.
 */
const ENTREPRISE: Rubrique[] = [
  {
    nom: "Mon entreprise",
    dit: "Identité, coordonnées et informations légales",
    icone: "immeuble",
    href: "/reglages/identite",
  },
  {
    nom: "Équipe",
    // **Le libellé dit ce qu'on y trouve VRAIMENT.** « Utilisateurs, rôles et
    // permissions » promettait trois choses qui n'existent pas, et le patron
    // ouvrait la rubrique pour n'y rien voir. Ce qui s'y règle aujourd'hui,
    // c'est combien d'équipes partent en même temps (§99).
    //
    // **ET LES ABSENCES DEPUIS LE 16 AOÛT**, parce que la rubrique « Planning »
    // a été supprimée ce jour-là : elle montrait le MÊME bloc que celle-ci, et
    // rien d'autre. Le patron : *« quelle est la différence entre planning et
    // équipe ? »* — il n'y en avait pas. Sa promesse — « horaires, équipes et
    // disponibilités » — ne tenait que par le mot du milieu : les horaires ne se
    // règlent pas (le planning raisonne en demi-journées), et les
    // disponibilités, ce sont les absences, qui vivent ici.
    //
    // **Ne pas la recréer pour y mettre les horaires le jour où ils viendront**
    // sans se poser la question : deux portes vers les mêmes équipes, c'est ce
    // qu'on vient de refermer.
    dit: "Combien partent en même temps, leurs noms et leurs absences",
    icone: "personnes",
    href: "/reglages/equipe",
  },
  {
    nom: "Tarifs & catalogue",
    dit: "Prestations, main-d'œuvre, matériel et marges",
    icone: "etiquette",
    href: "/reglages/tarifs",
  },
  {
    nom: "Devis & factures",
    // Le libellé dit ce qui s'y règle vraiment : la numérotation, elle, est
    // continue et ne se touche pas — elle est scellée comme les mentions.
    dit: "Validité, acompte, délai de paiement et mentions",
    icone: "feuille",
    href: "/reglages/documents",
  },
  // **« FICHE D'ENTRETIEN » A QUITTÉ LES RÉGLAGES le 26 août 2026**, à sa
  // demande : *« est-ce qu'on peut la déplacer dans la fiche de chantier, dans
  // la catégorie Paysage ? Et comme ça on ne la voit plus dans la catégorie
  // Réglages. »* Elle vit désormais sous `/paysage/fiche/composer`, en tête de
  // l'écran qui s'en sert.
  //
  // **Ne pas la remettre ici.** Elle y avait été rangée le 16 août parce qu'il
  // avait dit « dans les réglages, un endroit où l'utilisateur pourra créer
  // cette fiche » ; dix jours d'usage lui ont fait changer d'avis, et c'est
  // cette décision-là qui vaut. Le motif d'origine, laissé tel quel, aurait
  // suffi à l'y ramener de bonne foi.
  { nom: "Atlas IA", dit: "Automatisations et suggestions", icone: "etincelle", href: "/reglages/ia" },
  {
    nom: "Intégrations",
    dit: "Calendrier, comptabilité et services connectés",
    icone: "puzzle",
    href: "/reglages/agenda",
  },
  {
    nom: "Abonnement",
    dit: "Offre, paiement et factures Atlas",
    icone: "couronne",
    href: "/reglages/abonnement",
  },
  {
    nom: "Sécurité & données",
    dit: "Export, effacement et RGPD",
    icone: "bouclier",
    href: "/reglages/donnees",
  },
];

/**
 * Les ensembles qu'un rôle a le droit de voir.
 *
 * **L'ENTREPRISE VIENT EN PREMIER POUR LE PATRON, et c'est délibéré.** Sur la
 * planche, « Moi » ouvrait la liste ; à l'écran, ses quatre lignes sont encore
 * à venir, et quatre rubriques inertes en tête d'un écran le font paraître
 * cassé. Le patron ouvre les réglages pour ses tarifs et son identité — ils
 * sont donc sous son pouce. Pour un salarié, « Moi » est le SEUL ensemble, et
 * il ouvre naturellement.
 *
 * **Un membre ne reçoit pas une liste plus courte : il reçoit une AUTRE liste.**
 * Rien de l'entreprise n'en sort — ni grisé, ni masqué, ni rendu puis caché par
 * une feuille de style.
 */
export function rubriquesReglages(role: RoleReglages | null): EnsembleRubriques[] {
  /**
   * **Un rôle illisible est traité comme un SALARIÉ**, jamais comme rien.
   *
   * Devant une valeur qu'on ne sait pas lire, on prend le rôle le plus fermé —
   * l'inverse ouvrirait l'entreprise entière à une faute de frappe en base.
   * Mais « le plus fermé » n'est pas « vide » : les quatre réglages de la
   * rubrique « Moi » appartiennent à la PERSONNE (son mot de passe, ses
   * notifications) et ne portent aucune donnée d'entreprise. Les lui retirer
   * l'enfermerait dehors — il ne pourrait plus changer son propre mot de passe
   * parce qu'une lecture de rôle a hoqueté.
   *
   * **Écrit d'abord « ferme tout », et c'est `test-rubriques-reglages.ts` qui
   * l'a redressé** : il exige depuis toujours que le rôle inconnu reçoive
   * exactement ce que reçoit un membre. Le contrôle avait raison.
   */
  const effectif: Role = role ?? "salarie";
  const visible = (r: Rubrique) => r.href !== null && cheminAutorise(effectif, r.href);

  /**
   * **Le sommaire OBÉIT à `cheminAutorise`, il ne redit pas la règle.**
   *
   * Chaque rubrique passe par la fonction qui REFUSERA son adresse si elle est
   * tapée à la main. Une rubrique affichée qui mènerait à un refus se lit comme
   * une panne ; une rubrique cachée dont l'adresse répondrait quand même serait
   * un mensonge. Les deux viennent désormais du même endroit.
   *
   * **Une rubrique pas encore codée (`href: null`) reste visible au patron
   * seul** — c'est le drapeau « bientôt », et il n'a de sens que pour lui.
   */
  const entreprise = ENTREPRISE.filter((r) => (r.href === null ? effectif === "proprietaire" : visible(r)));
  const moi = MOI.filter(visible);

  // Un salarié ne reçoit pas une liste plus courte : il reçoit une AUTRE liste.
  // Rien de l'entreprise n'en sort — ni grisé, ni masqué, ni rendu puis caché.
  if (entreprise.length === 0) return [{ titre: "Moi", rubriques: moi }];

  return [
    { titre: "L'entreprise", rubriques: entreprise },
    { titre: "Moi", rubriques: moi },
  ];
}

/** Le surtitre de l'écran : l'entreprise ne lui appartient pas. */
export function surtitreReglages(role: RoleReglages | null): string {
  return role === "proprietaire" ? "Mon entreprise" : "Mon compte";
}

/**
 * L'écran des réglages est-il réservé au patron pour ce rôle ?
 *
 * Sert aux pages qui ne SONT pas des rubriques du sommaire — « Mes prix », le
 * vocabulaire — et qui doivent quand même refuser, côté serveur.
 */
export function reservéAuPatron(role: RoleReglages | null): boolean {
  return role !== "proprietaire";
}

/**
 * Les adresses qu'un rôle a le droit d'ouvrir dans les réglages.
 *
 * Sert à ce qu'une page ne se garde pas elle-même « à peu près » : la liste des
 * rubriques est l'unique source, et une rubrique retirée ferme son adresse au
 * même instant.
 */
export function adressesAutorisees(role: RoleReglages | null): string[] {
  return rubriquesReglages(role)
    .flatMap((e) => e.rubriques)
    .map((r) => r.href)
    .filter((h): h is string => h !== null);
}
