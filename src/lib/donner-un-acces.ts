/**
 * CE QUI FAIT QU'UN ACCÈS PEUT ÊTRE DONNÉ, RETIRÉ, OU CHANGÉ.
 *
 * **Fonction pure, dans `src/lib/`, et ce n'est pas un rangement.** La même
 * règle allume le bouton et fait accepter l'action serveur. Deux rédactions
 * divergent toujours (`CLAUDE.md` §3) — et ici la divergence se lirait ainsi :
 * un patron qui croit avoir retiré un accès, ou un formulaire qui refuse une
 * saisie que le serveur aurait acceptée.
 *
 * **Le mot de passe n'est PAS revérifié ici** : `src/lib/mot-de-passe.ts` porte
 * cette règle depuis le 14 août, et la redire ici en ferait la seconde.
 */
import { ROLES, type PorteePlanning, type Role } from "./acces-roles";

export type RefusAcces =
  /** Aucun nom : la liste des accès deviendrait une liste d'adresses e-mail. */
  | "nom-vide"
  /** L'adresse ne ressemble à rien qu'on puisse envoyer. */
  | "email-invalide"
  /** Un compte Atlas porte déjà cette adresse. */
  | "email-deja-pris"
  /** Le rôle demandé n'existe pas. */
  | "role-inconnu"
  /** Le mot de passe provisoire ne tient pas la règle du dépôt. */
  | "mot-de-passe-trop-court"
  /** Le dernier patron ne peut ni se rétrograder ni se retirer. */
  | "dernier-patron"
  /** On ne se retire pas soi-même : ce serait s'enfermer dehors. */
  | "soi-meme"
  /** Une portée resserrée sans équipe rattachée ne montrerait rien. */
  | "equipe-manquante";

/**
 * L'adresse est-elle envoyable ?
 *
 * **Volontairement simple.** Une expression sévère refuse des adresses valides
 * (apostrophes, extensions longues, sous-domaines), et personne ne comprend
 * pourquoi. Ce qui protège vraiment, c'est que l'adresse serve à ouvrir une
 * session : une adresse fantaisiste n'ouvre rien, et cela se voit tout de suite.
 */
export function adresseEnvoyable(email: string): boolean {
  const propre = email.trim();
  if (propre.length < 5 || propre.length > 254) return false;
  if (/\s/.test(propre)) return false;
  const arobase = propre.indexOf("@");
  if (arobase <= 0 || arobase !== propre.lastIndexOf("@")) return false;
  const domaine = propre.slice(arobase + 1);
  return domaine.includes(".") && !domaine.startsWith(".") && !domaine.endsWith(".");
}

/**
 * L'adresse, telle qu'elle entre en base.
 *
 * **Minuscules et sans espaces autour, exactement comme à la connexion**
 * (`src/auth.ts`). Sans cela, un accès donné à « Camille@… » ne s'ouvrirait
 * jamais : le compte existerait, et la connexion chercherait « camille@… ».
 */
export function adresseNormalisee(email: string): string {
  return email.trim().toLowerCase();
}

export function estPorteePlanning(valeur: string): valeur is PorteePlanning {
  return valeur === "tout" || valeur === "ses_equipes";
}

/**
 * Ce qui bloque la création d'un accès, ou `null` si rien ne bloque.
 *
 * `emailDejaPris` est passé par l'appelant : c'est la seule chose que cette
 * fonction ne peut pas savoir seule, et aller la chercher ici ferait de cette
 * règle une fonction qui touche la base — donc intestable sans elle.
 */
export function refusDeLAcces(saisie: {
  nom: string;
  email: string;
  role: string;
  motDePasse: string;
  longueurMinimale: number;
  emailDejaPris: boolean;
}): RefusAcces | null {
  if (saisie.nom.trim() === "") return "nom-vide";
  if (!adresseEnvoyable(saisie.email)) return "email-invalide";
  if (!(ROLES as readonly string[]).includes(saisie.role)) return "role-inconnu";
  if (saisie.motDePasse.length < saisie.longueurMinimale) return "mot-de-passe-trop-court";
  if (saisie.emailDejaPris) return "email-deja-pris";
  return null;
}

/**
 * Ce qui bloque un changement de rôle.
 *
 * **Une entreprise garde toujours au moins un patron.** Sans ce contrôle, le
 * seul patron pourrait se nommer commercial et l'entreprise n'aurait plus
 * personne pour donner un accès, changer un tarif, ou revenir en arrière — un
 * état dont on ne sort qu'en touchant la base à la main.
 */
export function refusDuChangementDeRole(etat: {
  roleActuel: Role;
  roleVoulu: string;
  nombreDePatrons: number;
}): RefusAcces | null {
  if (!(ROLES as readonly string[]).includes(etat.roleVoulu)) return "role-inconnu";
  if (etat.roleActuel === "proprietaire" && etat.roleVoulu !== "proprietaire" && etat.nombreDePatrons <= 1) {
    return "dernier-patron";
  }
  return null;
}

/**
 * Ce qui bloque le retrait d'un accès.
 *
 * **On ne se retire pas soi-même**, même quand on n'est pas le dernier patron :
 * le geste se lit comme « retirer quelqu'un », et personne ne s'attend à sortir
 * de son entreprise en l'appuyant. La sortie volontaire, si elle vient un jour,
 * sera un autre geste, à un autre endroit, avec sa propre confirmation.
 */
export function refusDuRetrait(etat: {
  cible: string;
  soi: string;
  roleCible: Role;
  nombreDePatrons: number;
}): RefusAcces | null {
  if (etat.cible === etat.soi) return "soi-meme";
  if (etat.roleCible === "proprietaire" && etat.nombreDePatrons <= 1) return "dernier-patron";
  return null;
}

/**
 * Ce qui bloque un changement de portée du planning.
 *
 * **Resserrer sans dire sur quelle équipe ne montrerait RIEN.** Accepter
 * quand même donnerait un planning vide sans un mot — et le patron croirait
 * avoir restreint alors qu'il aurait effacé.
 */
export function refusDeLaPortee(etat: { portee: string; equipeId: string | null }): RefusAcces | null {
  if (!estPorteePlanning(etat.portee)) return "role-inconnu";
  if (etat.portee === "ses_equipes" && !etat.equipeId) return "equipe-manquante";
  return null;
}

/** Ce que le patron lit. Une phrase, pas un code. */
export function messageRefusAcces(refus: RefusAcces, longueurMinimale: number): string {
  switch (refus) {
    case "nom-vide":
      return "Il faut un nom.";
    case "email-invalide":
      return "Cette adresse e-mail n'est pas valable.";
    case "email-deja-pris":
      return "Un compte Atlas utilise déjà cette adresse.";
    case "role-inconnu":
      return "Ce rôle n'existe pas.";
    case "mot-de-passe-trop-court":
      return `Il faut au moins ${longueurMinimale} caractères.`;
    case "dernier-patron":
      return "Il faut au moins un patron dans l'entreprise.";
    case "soi-meme":
      return "Vous ne pouvez pas retirer votre propre accès.";
    case "equipe-manquante":
      return "Choisissez l'équipe dont il voit les chantiers.";
  }
}
