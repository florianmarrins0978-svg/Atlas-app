/**
 * « An unexpected response was received from the server. »
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **La capture du patron, le 12 août 2026 à 14 h 04.** Un panneau rouge en
 * anglais, une pile d'appel pointant `node_modules`, et rien qui lui dise ni ce
 * qui s'est passé ni quoi faire. Sa pile portait pourtant l'indice : le chemin
 * commençait par `.next/dev` — **son banc servait la version LENTE**.
 *
 * Ce que ce message veut dire, en une phrase : le navigateur a demandé quelque
 * chose au serveur, et ce qui est revenu n'était pas une réponse d'Atlas. Trois
 * causes, dans l'ordre de fréquence sur son banc :
 *
 *   1. **le relais de GitHub a abandonné.** En version lente, un écran se
 *      compile au premier appel — trente à cent secondes, davantage sur son
 *      disque — et le relais coupe au bout d'une minute en rendant SA page
 *      d'erreur. Le navigateur reçoit du HTML là où il attendait une réponse ;
 *   2. **l'application se recompile** sous la page ouverte, juste après une
 *      mise à jour ;
 *   3. le serveur a été coupé et n'est pas encore relevé.
 *
 * Aucune des trois n'est réparable depuis le navigateur, et toutes les trois se
 * résolvent de la même façon : **attendre un instant, puis recharger**. C'est
 * cela qu'il faut lui dire — en français, et sans accuser son travail.
 *
 * **Fonction pure, hors de tout écran** (`CLAUDE.md` §3) : la reconnaissance
 * d'un message d'erreur est exactement le genre de règle qu'on veut éprouver
 * sans navigateur, et qui doit dire non aussi souvent qu'elle dit oui.
 */

/**
 * Les formes que prend l'échec, selon la version de Next et le moment.
 *
 * En minuscules, et comparées en minuscules : la casse de ces messages a déjà
 * changé d'une version à l'autre du cadre, et un contrôle sensible à la casse
 * se serait tu au premier changement.
 */
const SIGNATURES = [
  "an unexpected response was received from the server",
  "failed to fetch",
  "networkerror when attempting to fetch resource",
  "load failed", // Safari, quand la connexion est coupée en cours de route.
];

/**
 * Ce message dit-il « la réponse du serveur n'a pas pu être lue » ?
 *
 * **Refuse tout ce qu'elle ne reconnaît pas**, et c'est le point important :
 * habiller en « le serveur se recompile » une erreur qui vient du code
 * enverrait chercher au mauvais endroit — la faute que ce dépôt paie le plus
 * cher (`AGENTS.md`). Un message inconnu doit rester tel quel.
 */
export function estReponseIllisible(message: unknown): boolean {
  if (typeof message !== "string") return false;
  const m = message.toLowerCase();
  return SIGNATURES.some((s) => m.includes(s));
}

/**
 * Ce qu'on affiche alors, et qui doit tenir sur un téléphone.
 *
 * Deux phrases : ce qui se passe, et le geste. Pas de « veuillez », pas de
 * « une erreur est survenue » — il sait qu'une erreur est survenue, il la
 * regarde.
 */
export const PHRASE_REPONSE_ILLISIBLE =
  "Le serveur n'a pas répondu à temps. C'est presque toujours qu'Atlas est en train " +
  "de se préparer après une mise à jour. Attendez un instant, puis rechargez.";
