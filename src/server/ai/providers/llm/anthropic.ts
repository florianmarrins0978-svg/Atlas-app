import type {
  FournisseurLLM,
  ResultatLLM,
  ResultatLLMAvecOutils,
  MessageConversation,
  DefinitionOutil,
} from "./interface";
import { erreurIA } from "../../errors";
import { getConfigIA } from "../../config";
import { schemaJsonDeLOutil } from "./schema-outils";

type BlocContenuAnthropic =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };

function construireMessagesAnthropic(historique: MessageConversation[]): { role: string; content: BlocContenuAnthropic[] | string }[] {
  const messages: { role: string; content: BlocContenuAnthropic[] | string }[] = [];
  for (const m of historique) {
    if (m.role === "outil") {
      // Simplification documentée : identifiant synthétique stable par nom
      // d'outil (suffisant pour une conversation où chaque outil n'est appelé
      // qu'une fois — voir rapport du lot IA-02).
      messages.push({
        role: "assistant",
        content: [{ type: "tool_use", id: `outil_${m.outil}`, name: m.outil, input: {} }],
      });
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: `outil_${m.outil}`, content: JSON.stringify(m.resultat) }],
      });
    } else {
      messages.push({ role: m.role, content: m.contenu });
    }
  }
  return messages;
}

// Fournisseur réel, avec usage d'outils. Domaine accessible depuis ce
// sandbox, mais aucune clé n'y est configurée (voir rapport du lot IA-01) —
// fonctionnera normalement une fois ANTHROPIC_API_KEY définie.
export const fournisseurLLMAnthropic: FournisseurLLM = {
  nom: "anthropic",
  async genererTexte(systeme: string, message: string): Promise<ResultatLLM> {
    const cle = getConfigIA().anthropicApiKey;
    if (!cle) {
      return { succes: false, erreur: erreurIA("cle_api_absente", "ANTHROPIC_API_KEY n'est pas configurée.") };
    }
    if (!message || message.trim().length === 0) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Message vide — rien à traiter.") };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const reponse = await fetch(`${getConfigIA().anthropicBaseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cle,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systeme,
          messages: [{ role: "user", content: message }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (reponse.status === 401 || reponse.status === 403) {
        return {
          succes: false,
          erreur: erreurIA("cle_api_refusee", "ANTHROPIC_API_KEY est refusée par Anthropic (HTTP " + reponse.status + ")."),
        };
      }
      if (reponse.status === 429) {
        return { succes: false, erreur: erreurIA("quota_depasse", "Quota Anthropic dépassé.") };
      }
      if (!reponse.ok) {
        console.error(`LLM Anthropic échoué : HTTP ${reponse.status}`);
        return { succes: false, erreur: erreurIA("fournisseur_indisponible", `Erreur du fournisseur (${reponse.status}).`) };
      }

      const donnees = (await reponse.json()) as { content?: { type: string; text?: string }[] };
      const texte = donnees.content?.find((b) => b.type === "text")?.text;
      if (!texte) {
        return { succes: false, erreur: erreurIA("reponse_invalide", "Réponse du fournisseur vide.") };
      }
      return { succes: true, texte };
    } catch (err) {
      const estTimeout = err instanceof Error && err.name === "AbortError";
      console.error("LLM Anthropic : erreur technique", err instanceof Error ? err.message : err);
      return {
        succes: false,
        erreur: estTimeout
          ? erreurIA("timeout", "Le fournisseur n'a pas répondu à temps.")
          : erreurIA("fournisseur_indisponible", "Le fournisseur est momentanément indisponible."),
      };
    }
  },

  async genererAvecOutils(
    systeme: string,
    historique: MessageConversation[],
    outils: DefinitionOutil[]
  ): Promise<ResultatLLMAvecOutils> {
    const cle = getConfigIA().anthropicApiKey;
    if (!cle) {
      return { succes: false, erreur: erreurIA("cle_api_absente", "ANTHROPIC_API_KEY n'est pas configurée.") };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const reponse = await fetch(`${getConfigIA().anthropicBaseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cle,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systeme,
          messages: construireMessagesAnthropic(historique),
          tools: outils.map((o) => ({
            name: o.nom,
            description: o.description,
            input_schema: schemaJsonDeLOutil(o),
          })),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (reponse.status === 401 || reponse.status === 403) {
        return {
          succes: false,
          erreur: erreurIA("cle_api_refusee", "ANTHROPIC_API_KEY est refusée par Anthropic (HTTP " + reponse.status + ")."),
        };
      }
      if (reponse.status === 429) {
        return { succes: false, erreur: erreurIA("quota_depasse", "Quota Anthropic dépassé.") };
      }
      if (!reponse.ok) {
        console.error(`LLM Anthropic (outils) échoué : HTTP ${reponse.status}`);
        return { succes: false, erreur: erreurIA("fournisseur_indisponible", `Erreur du fournisseur (${reponse.status}).`) };
      }

      const donnees = (await reponse.json()) as { content?: BlocContenuAnthropic[] };
      const blocOutil = donnees.content?.find((b): b is Extract<BlocContenuAnthropic, { type: "tool_use" }> => b.type === "tool_use");
      if (blocOutil) {
        return { succes: true, type: "appel_outil", outil: blocOutil.name, parametres: blocOutil.input };
      }
      const blocTexte = donnees.content?.find((b): b is Extract<BlocContenuAnthropic, { type: "text" }> => b.type === "text");
      if (!blocTexte) {
        return { succes: false, erreur: erreurIA("reponse_invalide", "Réponse du fournisseur vide.") };
      }
      return { succes: true, type: "texte", texte: blocTexte.text };
    } catch (err) {
      const estTimeout = err instanceof Error && err.name === "AbortError";
      console.error("LLM Anthropic (outils) : erreur technique", err instanceof Error ? err.message : err);
      return {
        succes: false,
        erreur: estTimeout
          ? erreurIA("timeout", "Le fournisseur n'a pas répondu à temps.")
          : erreurIA("fournisseur_indisponible", "Le fournisseur est momentanément indisponible."),
      };
    }
  },
};
