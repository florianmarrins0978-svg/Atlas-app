/**
 * QUI PEUT OUVRIR LA PORTE — Google, Apple, ou personne.
 *
 * Sa demande du 10 septembre 2026, la photo de la planche à l'appui : *« je
 * veux pouvoir me connecter avec Google ou Apple »*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **DEUX QUESTIONS, ET ELLES NE SE CONFONDENT PLUS — 11 septembre 2026.**
 *
 *   · `fournisseursAAfficher` : ce que l'ÉCRAN dessine — les deux marques,
 *     toujours. **Sa décision**, prise en connaissance du coût ;
 *   · `fournisseursDisponibles` : ce qui peut RÉELLEMENT ouvrir une session —
 *     ce que `src/auth.ts` déclare à Auth.js, et lui seul.
 *
 * **Elles avaient l'air d'une seule parce qu'elles COÏNCIDAIENT**, tant qu'on
 * n'affichait que le branché. Les séparer n'est donc pas dupliquer une règle
 * (`CLAUDE.md` §3) : c'est cesser de répondre à deux questions différentes avec
 * la même phrase. La seconde reste dérivée de la première — un seul endroit dit
 * ce qu'est « branché ».
 *
 * **CE QUI REMPLACE L'ANCIENNE RÈGLE.** Ce fichier portait : *« un bouton qui
 * ne peut pas aboutir est pire qu'un bouton absent »*, parce qu'on appuyait
 * dans le vide. Ce n'est plus le cas : `entrerAvecAction` refuse un fournisseur
 * non branché AVANT Auth.js et rend une phrase qui nomme ce qui manque et ce
 * qui marche. **La règle tient toujours pour Face ID**, qui n'a personne à qui
 * poser la question — l'appareil sait, ou ne sait pas.
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
  /** Ses DEUX clés sont-elles posées ? Faux = le bouton se dessine, mais refuse. */
  branche: boolean;
};

const LIBELLES: Record<NomFournisseur, string> = {
  google: "Google",
  apple: "Apple",
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

/** Ses deux clés sont-elles posées ? La moitié d'une paire ne compte pas. */
export function estBranche(nom: NomFournisseur, cles: ClesFournisseurs): boolean {
  return nom === "google"
    ? posee(cles.googleId) && posee(cles.googleSecret)
    : posee(cles.appleId) && posee(cles.appleSecret);
}

/**
 * **CE QUI PEUT RÉELLEMENT OUVRIR UNE SESSION** — et rien d'autre.
 *
 * C'est `src/auth.ts` qui s'en sert, pour ne déclarer à Auth.js que des
 * fournisseurs dont les clés existent. Déclarer Google sans son identifiant
 * ferait lever la configuration au démarrage : plus personne n'entrerait, pas
 * même par mot de passe.
 *
 * **Ne pas confondre avec `fournisseursAAfficher`.** Ce sont deux questions
 * distinctes, et elles ne l'étaient devenues qu'en coïncidant — voir l'en-tête
 * de ce fichier, et `ARCHITECTURE.md` §325.
 */
export function fournisseursDisponibles(cles: ClesFournisseurs): Fournisseur[] {
  return fournisseursAAfficher(cles).filter((f) => f.branche);
}

/**
 * **CE QUE L'ÉCRAN DESSINE** — les deux marques, toujours, branchées ou non.
 *
 * **Sa décision du 11 septembre 2026**, après trois messages et sa maquette
 * remise en photo : *« je veux que lorsque l'utilisateur clique sur se
 * déconnecter qu'il arrive direct sur cet écran »* — celui qui porte Google et
 * Apple. Le choix lui a été posé en toutes lettres, avec son coût : il a
 * retenu « les afficher quand même, dès maintenant ».
 *
 * **Ce que cela renverse, et il faut le dire.** Ce fichier portait l'inverse —
 * *« un bouton qui ne peut pas aboutir est pire qu'un bouton absent »*. La
 * raison invoquée était qu'on appuie, que rien ne se passe, et qu'on croit
 * l'application cassée. **Elle n'est plus vraie ici** : `entrerAvecAction`
 * refuse un fournisseur non branché AVANT Auth.js et rend une phrase qui dit
 * ce qui manque. On n'appuie donc plus dans le vide — on lit une réponse.
 *
 * Reste ce que la décision coûte, et qui est réel : l'écran montre deux
 * chemins dont aucun n'ouvre encore. C'est ce qu'il a choisi de voir, plutôt
 * qu'un écran qui ne ressemble pas à ce qu'il a dessiné.
 */
export function fournisseursAAfficher(cles: ClesFournisseurs): Fournisseur[] {
  return ORDRE.map((nom) => ({
    nom,
    libelle: LIBELLES[nom],
    branche: estBranche(nom, cles),
  }));
}

/**
 * Ce qu'on répond à qui appuie sur une marque dont les clés ne sont pas posées.
 *
 * **La phrase nomme ce qui manque et ce qui marche**, parce que c'est le seul
 * écran qu'on voit avant d'être entré : y lire « une erreur » ferait conclure
 * que l'application est cassée, et fermer l'onglet.
 */
export function messageNonBranche(nom: NomFournisseur): string {
  return `${LIBELLES[nom]} n'est pas encore branché. Entrez avec votre adresse et votre mot de passe.`;
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
