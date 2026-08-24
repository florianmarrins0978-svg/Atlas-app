/**
 * Face ID, côté règles — ce qui se décide sans base, sans navigateur, et sans
 * clé de fournisseur.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa demande du 23 août 2026 :** *« je veux bien que tu me codes le Face ID
 * pour le mot de passe, et bien entendu qu'il faut conserver le mot de passe.
 * L'utilisateur va commencer par créer son compte avec son mot de passe et
 * ensuite il décidera s'il veut ouvrir sa session avec le mot de passe ou le
 * Face ID. »*
 *
 * Sa réponse à la planche 94, le 24 août : **B** — la porte d'aujourd'hui, plus
 * une ligne au-dessus. Rien ne change de place.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI NE SE ROUVRE PAS, et pourquoi.**
 *
 * | | |
 * |---|---|
 * | le mot de passe ne se retire jamais | une clé vit dans un appareil ; l'appareil se perd, se remplace, se casse. Retirer le mot de passe, c'est murer le compte le jour où le téléphone tombe |
 * | le compte se crée au mot de passe | l'inscription ne doit dépendre d'aucun matériel |
 * | un échec de visage ne compte AUCUNE tentative ratée | sinon un téléphone qui ne reconnaît pas son propriétaire ferait temporiser son propre compte — la panne du 6 août 2026, refaite par l'autre bord |
 *
 * Ce dernier point est une règle de code autant qu'une règle métier :
 * `noterEchec` (`src/server/repositories/tentatives-connexion.ts`) **ne doit
 * jamais être appelé** sur le chemin d'une clé d'appareil.
 */

/** Ce qu'une clé porte, une fois posée. */
export type CleAppareil = {
  id: string;
  nomAppareil: string;
  creeLe: Date;
  dernierUsageLe: Date | null;
};

/**
 * Combien de clés un même compte peut poser.
 *
 * Un artisan a un téléphone, parfois une tablette, parfois l'ordinateur du
 * bureau. Au-delà, ce n'est plus lui : c'est une liste qu'on ne relit jamais,
 * et chaque ligne est une porte ouverte de plus. La borne existe surtout pour
 * qu'un défaut de l'écran ne puisse pas en faire naître mille.
 */
export const CLES_MAX = 10;

/** Ce qu'un nom d'appareil peut peser, pour qu'il tienne sur une ligne. */
export const NOM_APPAREIL_MAX = 40;

/**
 * Comment s'appelle l'appareil qu'on vient d'enregistrer.
 *
 * **Deviné depuis le navigateur, et il faut le dire tel quel.** L'en-tête que
 * le téléphone envoie n'est pas une identité : il se falsifie, et il ment
 * régulièrement (un iPad se déclare Mac depuis 2019). Ce nom ne sert donc qu'à
 * s'y retrouver dans une liste de deux ou trois lignes — **aucune décision ne
 * s'y appuie**, et l'écran laisse le renommer.
 *
 * Rendre « Cet appareil » plutôt qu'une chaîne brute : afficher
 * `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5…)` dans un écran de réglages, c'est
 * montrer à un artisan quelque chose qu'il ne peut ni lire ni corriger.
 */
export function nommerAppareil(agent: string | null | undefined): string {
  const a = (agent ?? "").toLowerCase();
  if (!a) return "Cet appareil";
  if (a.includes("ipad")) return "iPad";
  if (a.includes("iphone")) return "iPhone";
  if (a.includes("android")) return "Téléphone Android";
  if (a.includes("mac os") || a.includes("macintosh")) return "Mac";
  if (a.includes("windows")) return "Ordinateur Windows";
  if (a.includes("linux")) return "Ordinateur Linux";
  return "Cet appareil";
}

/** Un nom saisi à la main : borné, débarrassé de ce qui casserait la ligne. */
export function nettoyerNomAppareil(saisi: string, defaut: string): string {
  const propre = saisi.replace(/\s+/g, " ").trim().slice(0, NOM_APPAREIL_MAX);
  return propre || defaut;
}

/**
 * L'artisan a-t-il ABANDONNÉ, ou est-ce une panne ?
 *
 * **La distinction commande ce qu'il lit, et c'est tout ce qui compte ici.**
 * Toucher « Ouvrir avec Face ID » puis fermer la fenêtre d'iOS est un geste
 * ordinaire — on s'est trompé de bouton, on préfère taper son mot de passe. Y
 * répondre par un message rouge, c'est accuser quelqu'un qui n'a rien fait, et
 * c'est ainsi qu'on apprend à ne plus lire les messages (`CLAUDE.md` §4 ter).
 *
 * Le navigateur nomme les deux de la même façon — `NotAllowedError` — qu'on ait
 * refusé, laissé passer le délai, ou qu'aucune clé ne réponde. On ne peut donc
 * pas les distinguer, et **on retient le cas le plus doux** : silence, retour
 * au mot de passe.
 */
export function estAbandon(nomErreur: string | null | undefined): boolean {
  const n = (nomErreur ?? "").trim();
  return n === "NotAllowedError" || n === "AbortError";
}

export type RefusCle =
  | "abandon"
  | "sans-cle"
  | "cle-inconnue"
  | "rejeu"
  | "trop-de-cles"
  | "deja-enregistree"
  | "indisponible"
  | "panne"
  | "panne-activation";

/**
 * Ce que l'artisan lit — et ce qu'il ne doit JAMAIS lire.
 *
 * **Aucun de ces messages n'accuse le mot de passe.** C'est la règle du dépôt
 * depuis le 6 août 2026, née du jour où les parents du patron ont lu « mot de
 * passe incorrect » avec le bon mot de passe et se sont enfoncés en
 * recommençant. Un visage mal reconnu ne dit rien du mot de passe, et le
 * laisser croire ferait changer un mot de passe qui n'a rien fait.
 */
export function messageRefusCle(refus: RefusCle): string | null {
  switch (refus) {
    case "abandon":
      // **Rien.** Il a fermé la fenêtre : l'écran revient au mot de passe, et
      // se tait. Un message ici serait un reproche pour un geste normal.
      return null;
    case "sans-cle":
      return "Aucun appareil n’est encore enregistré sur ce compte. Entrez votre mot de passe, puis activez Face ID dans Réglages › Connexion.";
    case "cle-inconnue":
      return "Cet appareil n’est plus reconnu. Entrez votre mot de passe, puis réactivez Face ID.";
    case "rejeu":
      // Le compteur a reculé : soit la clé a été copiée, soit l'authentificateur
      // ment. Dans les deux cas on refuse, et on le DIT — le taire laisserait
      // l'artisan devant une porte qui s'ouvre parfois.
      return "Cet appareil a répondu quelque chose d’inattendu. Par précaution, entrez votre mot de passe et réactivez Face ID.";
    case "trop-de-cles":
      return `Vous avez déjà ${CLES_MAX} appareils enregistrés. Retirez-en un avant d’en ajouter un autre.`;
    case "deja-enregistree":
      return "Cet appareil est déjà enregistré.";
    case "indisponible":
      return "Cet appareil ne propose pas Face ID (ni empreinte). Vous pouvez toujours entrer avec votre mot de passe.";
    case "panne":
      return "Face ID n’a pas pu aboutir. Entrez votre mot de passe — votre compte n’a rien perdu.";
    case "panne-activation":
      /**
       * **Le même incident, mais on est DÉJÀ entré** — et « entrez votre mot de
       * passe » n'aurait alors aucun sens : il vient de le faire. Un message
       * qui demande un geste impossible se lit comme une panne d'Atlas, et
       * l'artisan cherche ce qu'il a mal fait.
       */
      return "Impossible d’enregistrer cet appareil pour l’instant. Réessayez — vous restez connecté, et rien n’a changé.";
  }
}

/**
 * Le compteur d'usage a-t-il reculé — c'est-à-dire : sent-on un rejeu ?
 *
 * Un authentificateur incrémente ce nombre à chaque signature. Le voir stagner
 * ou reculer trahit une clé copiée. **Mais zéro ne trahit rien** : une bonne
 * partie des clés de plateforme — celles d'Apple, précisément celles que le
 * patron va employer — n'en tiennent aucun et rendent toujours `0`. Refuser sur
 * `0` fermerait la porte à tous les iPhone.
 */
export function estRejeu(compteurGarde: number, compteurRendu: number): boolean {
  if (compteurRendu === 0 && compteurGarde === 0) return false;
  return compteurRendu <= compteurGarde;
}

/**
 * Ce que la ligne des Réglages annonce — « Activé sur cet appareil et 2 autres ».
 *
 * Écrit ici parce que l'écran ET la page qui la relit doivent en dire la même
 * chose ; deux rédactions divergeraient (`CLAUDE.md` §3).
 */
export function phraseAppareils(nombre: number): string {
  if (nombre <= 0) return "Aucun appareil enregistré";
  if (nombre === 1) return "1 appareil enregistré";
  return `${nombre} appareils enregistrés`;
}
