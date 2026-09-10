/**
 * QUI PEUT OUVRIR LA PORTE — Google, Apple, ou personne.
 *
 * Sa demande du 10 septembre 2026, la photo de la planche à l'appui : *« je
 * veux pouvoir me connecter avec Google ou Apple »*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **UN BOUTON QUI NE PEUT PAS ABOUTIR EST PIRE QU'UN BOUTON ABSENT.** C'est la
 * règle déjà appliquée à « Ouvrir avec Face ID », qui ne se montre que si
 * l'appareil sait le faire : on appuie, rien ne se passe, et l'on croit
 * l'application cassée. Google et Apple ne s'affichent donc que lorsque LEURS
 * DEUX valeurs sont posées — l'identifiant sans le secret ne mène nulle part.
 *
 * **POURQUOI C'EST UNE RÈGLE PURE, ET NON UN `if` DANS L'ÉCRAN.** La même
 * question se pose à deux endroits qui ne se voient pas : l'écran, qui décide
 * quoi dessiner, et `src/auth.ts`, qui décide quels fournisseurs déclarer.
 * Deux rédactions divergeraient, et la divergence s'appellerait ici « un bouton
 * qui mène à une page d'erreur d'Auth.js » (`CLAUDE.md` §3).
 *
 * **CE QUI RESTE À FAIRE, ET QUE PERSONNE ICI NE PEUT FAIRE À SA PLACE :**
 * ouvrir un identifiant OAuth chez Google (gratuit) et un Service ID chez
 * Apple (compte développeur payant). Voir `docs/A-FAIRE.md`.
 */

export type NomFournisseur = "google" | "apple";

/** Ce que l'écran a besoin de savoir pour dessiner un bouton. */
export type Fournisseur = {
  nom: NomFournisseur;
  /** Le mot sur le bouton — c'est la marque, elle ne se traduit pas. */
  libelle: string;
};

const CATALOGUE: Record<NomFournisseur, Fournisseur> = {
  google: { nom: "google", libelle: "Google" },
  apple: { nom: "apple", libelle: "Apple" },
};

/** L'ordre de la planche : Google à gauche, Apple à droite. */
export const ORDRE: NomFournisseur[] = ["google", "apple"];

export type ClesFournisseurs = {
  googleId?: string;
  googleSecret?: string;
  appleId?: string;
  appleSecret?: string;
};

/**
 * Une valeur d'environnement absente, vide ou faite d'espaces ne compte pas.
 *
 * Ce n'est pas de la coquetterie : un `.env` porte régulièrement
 * `AUTH_GOOGLE_ID=` sur une ligne restée là après un essai. Traitée comme
 * posée, elle ferait apparaître un bouton qui renvoie une erreur d'Auth.js.
 */
function posee(valeur: string | undefined): boolean {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

export function fournisseursDisponibles(cles: ClesFournisseurs): Fournisseur[] {
  const ouverts: Fournisseur[] = [];
  if (posee(cles.googleId) && posee(cles.googleSecret)) ouverts.push(CATALOGUE.google);
  if (posee(cles.appleId) && posee(cles.appleSecret)) ouverts.push(CATALOGUE.apple);
  return ouverts;
}

/**
 * Ce qu'on répond à quelqu'un dont l'adresse Google ou Apple n'est rattachée à
 * aucun compte Atlas.
 *
 * **Ce n'est pas un refus, c'est un aiguillage** — et c'est la décision qui
 * compte dans ce lot. Créer le compte au vol donnerait un Atlas sans
 * entreprise, sans forme juridique et sans TVA : le premier devis serait
 * impossible à émettre, et l'artisan découvrirait le trou en face d'un client.
 * Le parcours de création existe et pose ces questions ; on y envoie.
 *
 * L'adresse voyage pour être proposée d'office : la retaper alors qu'on vient
 * de la prouver chez Google est une insulte à celui qui tient un téléphone
 * d'une main.
 */
export function ouAllerSansCompte(email: string | null | undefined): string {
  const propre = (email ?? "").trim().toLowerCase();
  if (!propre) return "/creer-un-compte";
  return `/creer-un-compte?email=${encodeURIComponent(propre)}`;
}

/**
 * L'adresse que Google ou Apple viennent de PROUVER — ou rien.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **C'EST LA LIGNE DE SÉCURITÉ DE TOUT CE LOT, et elle tient en un mot :
 * `email_verified`.** Sans adaptateur de base, Atlas ne garde aucune trace du
 * compte Google employé : l'adresse est la SEULE chose qui rattache une
 * identité extérieure à un compte d'ici. Accepter une adresse non vérifiée
 * reviendrait donc à laisser n'importe qui déclarer l'adresse d'un artisan
 * chez un fournisseur complaisant, et entrer chez lui.
 *
 * Google rend un booléen, Apple une chaîne « true » : les deux formes sont
 * acceptées, **et rien d'autre**. Une valeur absente n'est pas une valeur
 * vraie — c'est le repli silencieux que `CLAUDE.md` §4 quater interdit.
 *
 * Fonction pure : elle s'éprouve sans base, sans réseau et sans clé
 * (`scripts/test-fournisseurs-connexion.ts`).
 */
export function emailProuve(profil: unknown): string | null {
  if (!profil || typeof profil !== "object") return null;
  const p = profil as Record<string, unknown>;

  const brut = typeof p.email === "string" ? p.email.trim().toLowerCase() : "";
  if (!brut || !brut.includes("@")) return null;

  const verifie = p.email_verified;
  if (verifie !== true && verifie !== "true") return null;

  return brut;
}

/**
 * Le nom rendu par un bouton est-il l'un des deux ?
 *
 * Il arrive de dehors — un bouton de la page, donc du navigateur. Le confronter
 * à la liste fermée avant qu'il n'atteigne Auth.js est la seule chose qui
 * empêche une chaîne quelconque d'y entrer.
 */
export function estNomFournisseur(nom: unknown): nom is NomFournisseur {
  return nom === "google" || nom === "apple";
}
