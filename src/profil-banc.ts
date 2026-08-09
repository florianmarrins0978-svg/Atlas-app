/**
 * Le banc d'essai : **déclaré, jamais deviné.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette notion existe, et ce qu'elle a coûté de ne pas l'avoir.**
 *
 * Le 9 août 2026, dix-sept heures ont été passées sur des pannes du banc :
 * « HTTP ERROR 504 », « 404 », « 502 », des ports que deux serveurs se
 * disputaient, des écrans qui mettaient trente-huit secondes à s'ouvrir. Chaque
 * correctif visait un symptôme. Ils avaient **tous la même cause** : le banc
 * faisait tourner `next dev`, un serveur de développement, qui compile chaque
 * écran au moment où on l'ouvre. Ce n'est pas fait pour être utilisé.
 *
 * La version bâtie règle tout cela d'un coup — 50 à 100 ms par écran au lieu de
 * trente-huit secondes, et plus rien à compiler. Mais `next build` et
 * `next start` imposent `NODE_ENV=production`, et `src/server/env.ts` refuse
 * alors, à juste titre, une IA simulée et un stockage local.
 *
 * D'où ce profil. Il **n'affaiblit rien par défaut** : une installation qui ne
 * le déclare pas garde toutes les protections, à la lettre. Il faut le poser
 * explicitement, sur une machine qui ne contient que des données inventées.
 *
 * **Ce qu'il autorise, et rien d'autre :**
 *
 *   1. l'IA simulée (`LLM_PROVIDER=dev`) — le banc n'a pas toujours de clé ;
 *   2. le stockage local — le banc n'a pas de compartiment S3 ;
 *   3. l'alignement de l'hôte sur l'origine, qui rend les actions serveur
 *      possibles derrière le mandataire d'un espace de travail.
 *
 * **Ce qu'il n'autorise PAS, et ne doit jamais autoriser :** rien qui touche à
 * l'isolation entre entreprises. La RLS reste entière, `withEntreprise` reste
 * obligatoire, les jetons publics restent imprévisibles. Un banc qui mentirait
 * sur l'isolation ne servirait plus à éprouver quoi que ce soit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Deux noms acceptés, et c'est délibéré.** `ATLAS_BANC_ESSAI` existe déjà dans
 * `.devcontainer/docker-compose.yml`, mais une variable déclarée là **n'existe
 * pas dans un espace de travail créé avant qu'elle n'y soit écrite** — deux
 * correctifs de suite sont restés inertes pour ce motif, sans le moindre
 * message. `ATLAS_PROFIL` est donc posé par `.devcontainer/demarrer.sh`, qui vit
 * dans le dépôt et s'exécute à chaque allumage : il descend avec le code.
 *
 * Vit à la racine de `src/` parce que quatre endroits en dépendent — la
 * configuration, le proxy, l'environnement et l'écran. Quatre copies auraient
 * divergé, et c'est toujours la copie oubliée qui casse.
 */
export function estBancDEssai(
  // `process.env` est typé strictement : on le recopie plutôt que d'élargir la
  // signature, pour que les quatre appelants réels n'aient rien à savoir.
  env: { ATLAS_PROFIL?: string; ATLAS_BANC_ESSAI?: string } = {
    ATLAS_PROFIL: process.env.ATLAS_PROFIL,
    ATLAS_BANC_ESSAI: process.env.ATLAS_BANC_ESSAI,
  }
): boolean {
  return env.ATLAS_PROFIL?.trim().toLowerCase() === "banc" || env.ATLAS_BANC_ESSAI?.trim() === "1";
}
