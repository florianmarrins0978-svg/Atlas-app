import { z } from "zod";
import type { DefinitionOutil } from "./interface";

/**
 * Le schéma JSON des outils, écrit une seule fois.
 *
 * Il vivait à l'intérieur d'`anthropic.ts`. Le jour où un second fournisseur
 * réel est apparu, le recopier revenait à installer deux définitions du même
 * outil : la première correction n'aurait porté que sur l'une des deux, et
 * c'est celle qu'on relit le moins qui serait restée fausse (`CLAUDE.md` §3).
 *
 * **Il se DÉDUIT du schéma Zod de l'outil, il ne s'écrit plus à la main.** Une
 * fiche vide (`properties: {}`) partait pour tous les outils sauf un : le
 * modèle devinait les noms des champs, Zod jetait en silence ceux qui
 * tombaient à côté, et l'outil répondait « il faut au moins un mot » à qui
 * venait de lui en donner deux (sa capture du 26 septembre 2026,
 * `scripts/test-schema-outils.ts`). Zod 4 sait écrire ce schéma lui-même :
 * c'est la même définition qui annonce les champs et qui les relit.
 *
 * `io: "input"` : ce que le modèle ENVOIE, donc un champ muni d'un `default`
 * reste facultatif. `unrepresentable: "any"` : un raffinement (`.refine`) ne se
 * traduit pas en JSON ; il continue de s'appliquer à la relecture, et son
 * message revient au modèle s'il n'est pas tenu.
 */
export function schemaJsonDeLOutil(outil: DefinitionOutil): Record<string, unknown> {
  const schema = z.toJSONSchema(outil.schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  // L'en-tête de version ne décrit aucun champ ; les fournisseurs n'en veulent pas.
  delete schema.$schema;
  // Les deux fournisseurs exigent un objet à la racine, même pour un outil
  // sans paramètre.
  return { ...schema, type: "object", properties: schema.properties ?? {} };
}
