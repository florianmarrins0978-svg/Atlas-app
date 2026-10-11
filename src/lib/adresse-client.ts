/**
 * L'adresse du visiteur, telle qu'elle s'écrit sur une preuve.
 *
 * **Pourquoi cette fonction existe, et pourquoi elle est ICI.** Elle était
 * recopiée à l'identique dans `src/app/devis/[jeton]/actions.ts` et
 * `src/app/documents-legaux/actions.ts` ; la réception d'une facture en aurait
 * fait une troisième copie. Deux implémentations d'une même règle finissent
 * toujours par diverger (`CLAUDE.md` §3), et celle-ci écrit dans un registre
 * qu'on relira le jour d'un litige : trois versions de « quelle adresse on
 * garde » seraient trois preuves qui ne se ressemblent pas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QU'ELLE VAUT, ET CE QU'ELLE NE VAUT PAS — à ne pas confondre avec
 * `source-visiteur.ts`.**
 *
 * | | |
 * |---|---|
 * | `sourceDepuisEntetes` | sert à COMPTER (les seuils de cadence). Elle refuse de deviner : un attaquant qui choisit son adresse s'offrirait un compteur neuf à chaque essai |
 * | celle-ci | sert à DOCUMENTER. La première valeur de `x-forwarded-for`, c'est-à-dire ce que le client a dit de lui |
 *
 * La différence est délibérée : une adresse d'appoint sur un accusé de
 * réception n'a pas à être infalsifiable — elle accompagne un horodatage et un
 * appareil, et c'est l'ensemble qui pèse. Une valeur commune, elle, ne
 * documenterait rien du tout. **Elle ne FONDE jamais une preuve**, elle
 * l'accompagne.
 *
 * Fonction pure — elle ne lit que ce qu'on lui passe, et s'éprouve sans requête
 * HTTP (`scripts/test-adresse-client.ts`).
 */
export function adresseClient(entetes: Headers): string | null {
  const transmis = entetes.get("x-forwarded-for");
  if (transmis) {
    // Les suivantes sont les mandataires traversés : elles n'identifient
    // personne.
    const premiere = transmis.split(",")[0]?.trim();
    if (premiere) return premiere;
  }
  return entetes.get("x-real-ip");
}
