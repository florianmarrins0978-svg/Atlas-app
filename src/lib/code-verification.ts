/**
 * LE CODE QUI PROUVE QU'UNE ADRESSE EXISTE — les règles, sans base ni écran.
 *
 * Sa demande du 14 septembre 2026 : *« j'ai réussi à me connecter avec une
 * adresse fausse qui n'existe pas ! […] il faut mettre une sécurité avec un
 * numéro envoyé par email à rentrer pour pouvoir valider son compte »*.
 *
 * C'est ce que font toutes les applications qui laissent créer un compte :
 * la création est libre, mais **rien ne s'ouvre tant que l'adresse n'a pas
 * répondu**. Six chiffres, un quart d'heure, cinq essais — et « Renvoyer »
 * borné, sinon la porte devient un robinet à e-mails vers n'importe qui.
 *
 * Tout ce qui se DÉCIDE sur un code est ici, en fonctions pures : le dépôt
 * (`repositories/verification-email.ts`) lit et écrit, il ne tranche rien —
 * c'est ce qui permet d'éprouver l'expiration et les essais sans base.
 *
 * **Aucun import de `node:`** : la case du code (`SaisieDuCode`) lit ici la
 * longueur et la forme, et elle tourne dans le navigateur. Le tirage et
 * l'empreinte HMAC, qui ont besoin de `crypto`, vivent côté serveur
 * (`src/server/empreinte-du-code.ts`).
 */

export const LONGUEUR_CODE = 6;
export const VALIDITE_CODE_MS = 15 * 60 * 1000;
/** Cinq essais sur un million de codes : un devineur n'a rien. */
export const ESSAIS_MAX = 5;
/** « Renvoyer » : trois codes par quart d'heure, et pas un de plus. */
export const ENVOIS_MAX = 3;
export const FENETRE_ENVOIS_MS = 15 * 60 * 1000;
/** Deux appuis sur « Renvoyer » à une seconde d'écart n'envoient qu'un e-mail. */
export const DELAI_ENTRE_ENVOIS_MS = 30 * 1000;

/** Ce que l'écran a le droit d'envoyer : six chiffres, espaces tolérés. */
export function codeNormalise(saisie: string): string | null {
  const chiffres = saisie.replace(/\s+/g, "");
  return new RegExp(`^\\d{${LONGUEUR_CODE}}$`).test(chiffres) ? chiffres : null;
}

/**
 * Deux empreintes hexadécimales sont-elles égales — en temps constant.
 *
 * Une comparaison qui s'arrête au premier caractère différent se mesure, et
 * se devine caractère par caractère. Celle-ci parcourt tout, toujours.
 */
export function empreintesEgales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export type CodeEnBase = {
  empreinte: string;
  expireLe: Date;
  essais: number;
  envois: number;
  dernierEnvoi: Date;
  creeLe: Date;
};

export type VerdictDuCode =
  | { ok: true }
  | { ok: false; refus: string; codeMort: boolean };

/**
 * Le code saisi vaut-il celui qu'on a envoyé ?
 *
 * `empreinteDeLaSaisie` est calculée par l'appelant (serveur) avec le même
 * HMAC que celle de la base ; `null` quand la saisie n'a pas la forme d'un
 * code. **Le refus dit quoi faire, sans dire ce qui s'est passé** : « code
 * incorrect » ne révèle pas s'il reste des essais. `codeMort` est pour le
 * dépôt et l'écran : plus rien à essayer sur cette ligne, il faut renvoyer.
 */
export function verdictDuCode(
  ligne: Pick<CodeEnBase, "empreinte" | "expireLe" | "essais">,
  empreinteDeLaSaisie: string | null,
  maintenant: Date = new Date()
): VerdictDuCode {
  if (maintenant.getTime() > ligne.expireLe.getTime()) {
    return { ok: false, refus: "Ce code a expiré. Demandez-en un nouveau.", codeMort: true };
  }
  if (ligne.essais >= ESSAIS_MAX) {
    return { ok: false, refus: "Trop d’essais. Demandez un nouveau code.", codeMort: true };
  }
  if (!empreinteDeLaSaisie) {
    return { ok: false, refus: `Le code fait ${LONGUEUR_CODE} chiffres.`, codeMort: false };
  }
  if (empreintesEgales(ligne.empreinte, empreinteDeLaSaisie)) return { ok: true };
  // Le dernier essai raté tue le code : le dire tout de suite, plutôt que de
  // laisser taper un sixième code juste pour lire « trop d'essais ».
  const dernier = ligne.essais + 1 >= ESSAIS_MAX;
  return dernier
    ? { ok: false, refus: "Trop d’essais. Demandez un nouveau code.", codeMort: true }
    : { ok: false, refus: "Code incorrect.", codeMort: false };
}

/** `nouvelleFenetre` : le quart d'heure est passé, le compte d'envois repart de zéro. */
export type VerdictDeRenvoi = { ok: true; nouvelleFenetre: boolean } | { ok: false; refus: string };

/**
 * Peut-on renvoyer un code maintenant ?
 *
 * Trois par quart d'heure, et trente secondes entre deux : le premier borne
 * ce qu'un inconnu peut faire partir vers une adresse qui n'est pas la sienne,
 * le second absorbe le double appui. La fenêtre repart de la CRÉATION de la
 * ligne, pas du dernier envoi — sinon chaque renvoi la prolongerait.
 */
export function verdictDeRenvoi(
  ligne: Pick<CodeEnBase, "envois" | "dernierEnvoi" | "creeLe">,
  maintenant: Date = new Date()
): VerdictDeRenvoi {
  const depuisLeDernier = maintenant.getTime() - ligne.dernierEnvoi.getTime();
  if (depuisLeDernier < DELAI_ENTRE_ENVOIS_MS) {
    return { ok: false, refus: "Un code vient de partir. Regardez votre boîte, courrier indésirable compris." };
  }
  const dansLaFenetre = maintenant.getTime() - ligne.creeLe.getTime() < FENETRE_ENVOIS_MS;
  if (dansLaFenetre && ligne.envois >= ENVOIS_MAX) {
    return { ok: false, refus: "Trop de codes envoyés. Réessayez dans un quart d’heure." };
  }
  return { ok: true, nouvelleFenetre: !dansLaFenetre };
}
