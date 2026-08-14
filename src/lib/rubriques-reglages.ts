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

export type RoleReglages = "proprietaire" | "membre";

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
  { nom: "Mon compte", dit: "Nom, e-mail et téléphone", icone: "compte", href: null },
  { nom: "Notifications", dit: "Alertes et rappels", icone: "cloche", href: null },
  { nom: "Connexion", dit: "Mot de passe et appareils", icone: "cadenas", href: null },
  { nom: "Apparence", dit: "Thème clair, sombre et couleurs", icone: "contraste", href: null },
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
  { nom: "Équipe", dit: "Utilisateurs, rôles et permissions", icone: "personnes", href: null },
  {
    nom: "Tarifs & catalogue",
    dit: "Prestations, main-d'œuvre, matériel et marges",
    icone: "etiquette",
    href: "/reglages/tarifs",
  },
  { nom: "Devis & factures", dit: "Conditions, numérotation et mentions", icone: "feuille", href: null },
  {
    nom: "Planning",
    dit: "Horaires, équipes et disponibilités",
    icone: "calendrier",
    href: "/reglages/planning",
  },
  { nom: "Atlas IA", dit: "Automatisations et suggestions", icone: "etincelle", href: "/reglages/ia" },
  {
    nom: "Intégrations",
    dit: "Calendrier, comptabilité et services connectés",
    icone: "puzzle",
    href: "/reglages/agenda",
  },
  { nom: "Abonnement", dit: "Offre, paiement et factures", icone: "couronne", href: null },
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
  if (role !== "proprietaire") return [{ titre: "Moi", rubriques: MOI }];
  return [
    { titre: "L'entreprise", rubriques: ENTREPRISE },
    { titre: "Moi", rubriques: MOI },
  ];
}

/** Le surtitre de l'écran : l'entreprise ne lui appartient pas. */
export function surtitreReglages(role: RoleReglages | null): string {
  return role === "proprietaire" ? "Mon entreprise" : "Mon compte";
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
