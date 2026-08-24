/**
 * D'où vient une requête — **et seulement quand on peut le savoir.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le défaut réparé le 23 août 2026** (audit de sécurité, constat C1). La
 * limitation des tentatives de connexion se calait là-dessus :
 *
 *     entetes.get("x-forwarded-for")?.split(",")[0]?.trim()
 *
 * `x-forwarded-for` est un en-tête **que celui qui frappe écrit lui-même**. En
 * prendre la première valeur, c'était offrir un compteur neuf à chaque essai :
 * il suffisait d'incrémenter un chiffre pour ne jamais atteindre aucun seuil.
 * « Cinq tentatives par quart d'heure » n'existait pas dès qu'on y pensait.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le raisonnement, parce qu'il commande la forme de cette fonction.**
 *
 * Une adresse transmise ne vaut que par le mandataire qui l'a écrite. La liste
 * se lit donc **par la droite** : chaque mandataire y ajoute l'adresse de qui
 * s'est connecté à lui. Avec un seul mandataire de confiance devant Atlas,
 * c'est la dernière valeur qui vient de lui ; avec deux chaînés,
 * l'avant-dernière. Tout ce qui est à gauche a été écrit par quelqu'un qu'on ne
 * connaît pas — c'est-à-dire, potentiellement, par l'attaquant.
 *
 * **Sans savoir combien de mandataires nous précèdent, aucune position n'est
 * fiable.** On ne devine donc pas : on rend une valeur commune, et le seuil
 * redevient partagé. C'est exactement ce que faisait l'ancienne version quand
 * aucun en-tête n'arrivait — jamais plus permissif qu'aujourd'hui, et jamais
 * une confiance que personne n'a accordée.
 *
 * Fonction pure, dans `src/lib/`, pour que cela s'éprouve sans requête HTTP
 * (`scripts/test-source-visiteur.ts`).
 */

/** Ce qu'on rend quand rien ne permet d'établir la source. Un seau commun. */
export const SOURCE_NON_ETABLIE = "source-non-etablie";

export function sourceDepuisEntetes(entree: {
  /** La valeur brute de `x-forwarded-for`, telle qu'elle arrive. */
  xff: string | null | undefined;
  /** Combien de mandataires de CONFIANCE se trouvent devant Atlas. 0 = aucun. */
  sauts: number;
  /**
   * Vrai hors production et sur un banc d'essai déclaré.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * **CE PARAMÈTRE EXISTE POUR NE PAS REFAIRE LA PANNE DU 6 AOÛT 2026**, et il
   * a été ajouté en relisant ce lot d'un œil hostile.
   *
   * Ce jour-là, le patron donne l'adresse de l'application à ses parents. Ils
   * saisissent les bons identifiants et lisent « Email ou mot de passe
   * incorrect » : le compteur était tenu par e-mail seul, le banc partage un
   * compte unique, et les essais des uns bloquaient les autres.
   *
   * La correction d'alors distinguait les visiteurs par leur adresse. En
   * cessant de croire `x-forwarded-for`, on la défaisait — sur le banc, tout le
   * monde serait retombé dans le même seau, cinq essais à se partager. Le
   * remède aurait recréé la panne, exactement comme le §1 bis de `CLAUDE.md`
   * le raconte pour la fiche d'état.
   *
   * **Ce que cela n'affaiblit pas.** Un banc d'essai n'a rien à protéger : son
   * mot de passe est public et son adresse est ouverte. En production, ce
   * paramètre vaut faux, et seul `ATLAS_PROXY_SAUTS` peut accorder une
   * confiance — qui se déclare, jamais qui se devine.
   */
  horsProduction?: boolean;
}): string {
  const { xff, sauts, horsProduction = false } = entree;

  const valeurs = (xff ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (!Number.isFinite(sauts) || sauts <= 0) {
    // Hors production seulement : on reprend le comportement d'avant — la
    // première valeur, celle que le mandataire de l'espace de travail écrit.
    // Le préfixe dit ce qu'elle vaut, pour qu'on ne la prenne jamais pour une
    // adresse vérifiée en lisant un journal.
    if (horsProduction && valeurs[0]) return `essai:${valeurs[0]}`;
    return SOURCE_NON_ETABLIE;
  }

  // Moins de valeurs que de mandataires annoncés : la chaîne ne correspond pas
  // à ce qu'on croyait avoir devant soi. **On refuse d'en tirer quoi que ce
  // soit** plutôt que de prendre la première venue — c'est précisément par là
  // qu'un attaquant entrerait, en envoyant une liste plus courte que prévu.
  if (valeurs.length < sauts) return SOURCE_NON_ETABLIE;

  const fiable = valeurs[valeurs.length - sauts];
  return fiable ? `ip:${fiable}` : SOURCE_NON_ETABLIE;
}
