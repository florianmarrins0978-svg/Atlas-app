import type {
  FournisseurLLM,
  ResultatLLM,
  ResultatLLMAvecOutils,
  MessageConversation,
  DefinitionOutil,
  ImagePourLecture,
  OptionsVision,
} from "./interface";
import { erreurIA, type ErreurIA } from "../../errors";
import { getConfigIA } from "../../config";
import { schemaJsonDeLOutil } from "./schema-outils";

// **Pourquoi ce fichier a cessé d'être une ébauche.**
//
// Il répondait « Fournisseur LLM OpenAI non implémenté » — une phrase que
// personne ne voyait jamais, puisqu'elle ressortait sous la forme d'un devis
// recopié mot à mot. Le patron avait posé sa clé OpenAI et pouvait
// légitimement croire l'IA branchée : le nom du fournisseur était accepté, la
// clé était lue, et rien n'annonçait que le chemin s'arrêtait là.
//
// Une ébauche qui se présente comme un fournisseur est un piège. Soit elle est
// implémentée, soit elle est refusée bruyamment au moment de la configuration
// (voir `src/server/ai/diagnostic.ts`). Ici : implémentée.
//
// Modèle figé, comme chez Anthropic : ce que le patron reçoit ne doit pas
// changer parce qu'un fournisseur a déplacé son alias par défaut.
const MODELE = "gpt-4o";
const DELAI_MS = 30_000;

type ReponseChat = {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
    };
  }[];
};

// Traduit l'historique commun vers le format d'OpenAI. Le rôle « outil » y
// occupe DEUX messages — l'appel côté assistant, puis son résultat — comme
// chez Anthropic. L'identifiant est synthétique et stable par nom d'outil :
// suffisant tant qu'un outil n'est appelé qu'une fois par conversation, ce qui
// est le cas ici (même simplification que `anthropic.ts`, et même limite).
function construireMessagesOpenAI(systeme: string, historique: MessageConversation[]) {
  const messages: Record<string, unknown>[] = [{ role: "system", content: systeme }];
  for (const m of historique) {
    if (m.role === "outil") {
      const id = `outil_${m.outil}`;
      messages.push({
        role: "assistant",
        tool_calls: [{ id, type: "function", function: { name: m.outil, arguments: "{}" } }],
      });
      messages.push({ role: "tool", tool_call_id: id, content: JSON.stringify(m.resultat) });
    } else {
      messages.push({ role: m.role, content: m.contenu });
    }
  }
  return messages;
}

async function appeler(
  corps: Record<string, unknown>
): Promise<{ ok: true; donnees: ReponseChat } | { ok: false; erreur: ErreurIA }> {
  const cle = getConfigIA().openaiApiKey;
  if (!cle) {
    return { ok: false, erreur: erreurIA("cle_api_absente", "OPENAI_API_KEY n'est pas configurée.") };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELAI_MS);
    const reponse = await fetch(`${getConfigIA().openaiBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
      body: JSON.stringify({ model: MODELE, ...corps }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (reponse.status === 401 || reponse.status === 403) {
      return {
        ok: false,
        erreur: erreurIA("cle_api_refusee", "OPENAI_API_KEY est refusée par OpenAI (HTTP " + reponse.status + ")."),
      };
    }
    if (reponse.status === 429) {
      return { ok: false, erreur: erreurIA("quota_depasse", "Quota OpenAI dépassé.") };
    }
    if (!reponse.ok) {
      // Le corps de la réponse n'est jamais journalisé : il peut contenir le
      // texte envoyé, donc le nom et l'adresse du client de l'artisan.
      console.error(`LLM OpenAI échoué : HTTP ${reponse.status}`);
      return { ok: false, erreur: erreurIA("fournisseur_indisponible", `Erreur du fournisseur (${reponse.status}).`) };
    }
    return { ok: true, donnees: (await reponse.json()) as ReponseChat };
  } catch (err) {
    const estTimeout = err instanceof Error && err.name === "AbortError";
    console.error("LLM OpenAI : erreur technique", err instanceof Error ? err.message : err);
    return {
      ok: false,
      erreur: estTimeout
        ? erreurIA("timeout", "Le fournisseur n'a pas répondu à temps.")
        : erreurIA("fournisseur_indisponible", "Le fournisseur est momentanément indisponible."),
    };
  }
}

export const fournisseurLLMOpenAI: FournisseurLLM = {
  /**
   * Lire une image — un ticket de caisse.
   *
   * **Un raccourci vers `lireImages`, comme chez Anthropic.** Les deux
   * portaient la même requête à un tableau près, et deux copies de la même
   * règle finissent toujours par diverger (`CLAUDE.md` §3). Le plafond de 512
   * jetons reste ici : il appartient au ticket, pas à la lecture d'image.
   */
  async lireImage(systeme: string, consigne: string, image: ImagePourLecture): Promise<ResultatLLM> {
    return this.lireImages!(systeme, consigne, [image], { maxTokens: 512 });
  },

  /**
   * Lire une ou plusieurs images.
   *
   * **`temperature: 0`** : décrire une tache n'est pas une tâche créative. Deux
   * lectures de la même photo doivent rendre la même description, sans quoi le
   * diagnostic changerait en rescannant et rien ne dirait laquelle croire.
   *
   * Les images partent en `data:` URL, format attendu par cette API — là où
   * Anthropic veut les octets nus. C'est exactement le genre d'écart que
   * l'interface commune existe pour cacher.
   */
  async lireImages(
    systeme: string,
    consigne: string,
    images: ImagePourLecture[],
    options?: OptionsVision
  ): Promise<ResultatLLM> {
    if (images.length === 0) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Aucune image à lire.") };
    }
    const resultat = await appeler({
      ...(options?.modele || getConfigIA().visionModele
        ? { model: options?.modele ?? getConfigIA().visionModele }
        : {}),
      max_tokens: options?.maxTokens ?? 1024,
      temperature: 0,
      messages: [
        { role: "system", content: systeme },
        {
          role: "user",
          content: [
            { type: "text", text: consigne },
            ...images.map((image) => ({
              type: "image_url",
              image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
            })),
          ],
        },
      ],
    });
    if (!resultat.ok) return { succes: false, erreur: resultat.erreur };
    const texte = resultat.donnees.choices?.[0]?.message?.content?.trim();
    if (!texte) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Le fournisseur n'a rien renvoyé de lisible.") };
    }
    return { succes: true, texte };
  },

  nom: "openai",

  async genererTexte(systeme: string, message: string): Promise<ResultatLLM> {
    if (!message || message.trim().length === 0) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Message vide — rien à traiter.") };
    }

    const resultat = await appeler({
      max_tokens: 1024,
      messages: [
        { role: "system", content: systeme },
        { role: "user", content: message },
      ],
    });
    if (!resultat.ok) return { succes: false, erreur: resultat.erreur };

    const texte = resultat.donnees.choices?.[0]?.message?.content?.trim();
    if (!texte) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Réponse du fournisseur vide.") };
    }
    return { succes: true, texte };
  },

  async genererAvecOutils(
    systeme: string,
    historique: MessageConversation[],
    outils: DefinitionOutil[]
  ): Promise<ResultatLLMAvecOutils> {
    const resultat = await appeler({
      max_tokens: 1024,
      messages: construireMessagesOpenAI(systeme, historique),
      tools: outils.map((o) => ({
        type: "function",
        function: { name: o.nom, description: o.description, parameters: schemaJsonDeLOutil(o) },
      })),
    });
    if (!resultat.ok) return { succes: false, erreur: resultat.erreur };

    const message = resultat.donnees.choices?.[0]?.message;
    const appel = message?.tool_calls?.[0];
    if (appel?.function?.name) {
      // Les paramètres arrivent en TEXTE, pas en objet — c'est la différence de
      // forme avec Anthropic, et la seule occasion de planter ici. Un JSON
      // illisible ne doit pas remonter en exception : l'appelant sait traiter
      // une erreur, il ne sait pas traiter une pile d'exécution.
      let parametres: unknown = {};
      try {
        parametres = appel.function.arguments ? JSON.parse(appel.function.arguments) : {};
      } catch {
        return { succes: false, erreur: erreurIA("reponse_invalide", "Paramètres d'outil illisibles.") };
      }
      return { succes: true, type: "appel_outil", outil: appel.function.name, parametres };
    }

    const texte = message?.content?.trim();
    if (!texte) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Réponse du fournisseur vide.") };
    }
    return { succes: true, type: "texte", texte };
  },
};
