import type { DefinitionOutil } from "./interface";

/**
 * Le schéma JSON des outils, écrit une seule fois.
 *
 * Il vivait à l'intérieur d'`anthropic.ts`. Le jour où un second fournisseur
 * réel est apparu, le recopier revenait à installer deux définitions du même
 * outil : la première correction n'aurait porté que sur l'une des deux, et
 * c'est celle qu'on relit le moins qui serait restée fausse (`CLAUDE.md` §3).
 *
 * Les schémas Zod des outils ne sont pas convertis automatiquement : la
 * conversion générique coûterait une dépendance et des cas limites, pour deux
 * outils dont un seul porte des paramètres.
 */
export function schemaJsonDeLOutil(outil: DefinitionOutil): Record<string, unknown> {
  if (outil.nom !== "ProposerModifications") {
    return { type: "object", properties: {}, required: [] };
  }
  return {
    type: "object",
    properties: {
      texteIntroduction: { type: "string" },
      propositions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            description: { type: "string" },
            donnees: { type: "object" },
          },
          required: ["type", "description"],
        },
      },
    },
    required: ["texteIntroduction", "propositions"],
  };
}
