/**
 * Quand un envoi n'aboutit pas, savoir SI le serveur est joignable.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi ce détour.** Le patron, le 12 août 2026 : *« L'enregistrement n'a
 * pas pu être transmis — la connexion a été interrompue. »* Cette phrase était
 * une supposition déguisée en constat. L'écran ne savait rien de la connexion :
 * il savait seulement que l'appel avait échoué, et il en concluait le réseau.
 *
 * Or trois choses très différentes échouent de la même façon, et ne se
 * réparent pas au même endroit :
 *
 *   1. **le téléphone n'a plus de réseau** — rien à faire qu'attendre ;
 *   2. **la page a vieilli.** C'est le cas le plus probable sur son banc, et le
 *      plus contre-intuitif : quand l'espace de travail se reconstruit, les
 *      actions serveur changent d'identifiant. La page ouverte AVANT appelle
 *      alors une action qui n'existe plus, et l'appel échoue — alors que le
 *      serveur va parfaitement bien. Un simple rechargement suffit ;
 *   3. **le serveur répond, mais mal** — il redémarre, ou il est en panne.
 *
 * Une seule requête tranche entre les trois : demander au serveur s'il est
 * vivant. S'il répond, ce n'était pas la connexion — et lui dire « vérifiez
 * votre réseau » l'aurait envoyé chercher au mauvais endroit, ce qui coûte plus
 * cher que pas d'erreur du tout (`AGENTS.md`).
 */

export type EtatLiaison = "page-vieillie" | "serveur-en-peine" | "hors-ligne";

const PHRASE: Record<EtatLiaison, string> = {
  "page-vieillie":
    "L'enregistrement n'est pas parti : cette page a été ouverte avant la dernière mise à jour " +
    "de l'espace de travail. Rechargez-la, puis refaites la note — le serveur, lui, répond bien.",
  "serveur-en-peine":
    "L'enregistrement n'est pas parti : le serveur répond mal, il est sans doute en train de " +
    "redémarrer. Attendez une minute, rechargez la page, puis refaites la note.",
  "hors-ligne":
    "L'enregistrement n'est pas parti : le serveur est injoignable depuis ce téléphone. " +
    "Vérifiez votre connexion, puis refaites la note.",
};

/** La phrase à montrer, pour un état de liaison donné. */
export function phraseDeLiaison(etat: EtatLiaison): string {
  return PHRASE[etat];
}

/**
 * Interroge le serveur pour trancher, puis rend la phrase juste.
 *
 * **Ne lève jamais**, et c'est indispensable : elle est appelée depuis un
 * `catch`, et une panne du diagnostic remplacerait le message par une page
 * blanche. Dans le doute, elle conclut « hors ligne » — la seule des trois
 * conclusions qui n'accuse personne à tort.
 */
export async function diagnostiquerLiaison(
  interroger: (url: string) => Promise<Response> = (url) =>
    fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) })
): Promise<EtatLiaison> {
  try {
    const r = await interroger("/api/health/live");
    // Le serveur répond, et bien : l'appel a donc échoué pour une autre raison
    // que la connexion. Sur ce banc, c'est presque toujours la page vieillie.
    if (r.ok) return "page-vieillie";
    return "serveur-en-peine";
  } catch {
    return "hors-ligne";
  }
}
