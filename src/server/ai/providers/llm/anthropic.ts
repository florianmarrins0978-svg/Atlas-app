import type {
  FournisseurLLM,
  ResultatLLM,
  ResultatLLMAvecOutils,
  MessageConversation,
  DefinitionOutil,
  ImagePourLecture,
  OptionsVision,
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

/**
 * Le modèle employé quand rien n'est réglé.
 *
 * **Il était recopié à trois endroits de ce fichier.** Nommé ici, il se change
 * en un point — et `VISION_MODELE` permet d'en changer sans rebâtir
 * l'application, ce qui était impossible tant qu'il vivait au milieu d'une
 * requête.
 */
const MODELE_PAR_DEFAUT = "claude-sonnet-4-6";

/**
 * Le plafond de la génération de texte — extraction de dictée comprise.
 *
 * **1 024 était trop court, et le défaut était muet.** La sortie grandit avec le
 * nombre de prestations dictées ; une dictée de chantier complet — haie,
 * démontage, dessouchage, évacuation, tonte — la dépasse, et le JSON était
 * coupé en plein milieu. Le patron voyait alors un brouillon pauvre, sans que
 * rien ne distingue ce cas d'une panne de clé.
 *
 * **Relever le plafond ne suffit pas, et ce n'est pas la correction** : une
 * dictée plus longue le dépassera aussi. La correction, c'est que la coupure se
 * VOIE (`stop_reason` ci-dessous). Ce chiffre-ci ne fait que rendre le cas rare.
 */
const MAX_TOKENS_TEXTE = 4096;

// Fournisseur réel, avec usage d'outils. Domaine accessible depuis ce
// sandbox, mais aucune clé n'y est configurée (voir rapport du lot IA-01) —
// fonctionnera normalement une fois ANTHROPIC_API_KEY définie.
export const fournisseurLLMAnthropic: FournisseurLLM = {
  nom: "anthropic",
  /**
   * Lire une image — un ticket de caisse, en l'occurrence.
   *
   * **Ce n'est plus qu'un raccourci vers `lireImages`, et c'est délibéré.** Les
   * deux portaient la même requête, à un tableau près : deux copies de la même
   * règle finissent toujours par diverger (`CLAUDE.md` §3), et la divergence se
   * serait manifestée le jour où l'une gagne un correctif que l'autre n'a pas —
   * un délai, un code d'erreur, un en-tête d'API. Le plafond de 512 jetons
   * reste ici, parce qu'il appartient au ticket : on attend un objet de cinq
   * champs, pas un commentaire sur la photo.
   */
  async lireImage(systeme: string, consigne: string, image: ImagePourLecture): Promise<ResultatLLM> {
    return this.lireImages!(systeme, consigne, [image], { maxTokens: 512 });
  },

  /**
   * Lire une ou plusieurs images.
   *
   * **`temperature: 0`** : lire un chiffre ou décrire une tache n'est pas une
   * tâche créative. Deux lectures de la même photo doivent donner la même
   * description, sans quoi le patron verrait le diagnostic changer en
   * rescannant — et n'aurait aucun moyen de savoir laquelle croire.
   *
   * **Les images passent AVANT la consigne**, et l'ordre n'est pas indifférent :
   * c'est la disposition recommandée par Anthropic pour les questions portant
   * sur des images, et elle donne de meilleurs résultats qu'une consigne posée
   * en tête.
   */
  async lireImages(
    systeme: string,
    consigne: string,
    images: ImagePourLecture[],
    options?: OptionsVision
  ): Promise<ResultatLLM> {
    const cle = getConfigIA().anthropicApiKey;
    if (!cle) {
      return { succes: false, erreur: erreurIA("cle_api_absente", "ANTHROPIC_API_KEY n'est pas configurée.") };
    }
    if (images.length === 0) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Aucune image à lire.") };
    }
    try {
      const controller = new AbortController();
      // Plus long que pour du texte : une photo pèse, et le patron est souvent
      // sur le réseau du bord de route.
      const timeout = setTimeout(() => controller.abort(), 45_000);
      const reponse = await fetch(`${getConfigIA().anthropicBaseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cle,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: options?.modele ?? getConfigIA().visionModele ?? MODELE_PAR_DEFAUT,
          max_tokens: options?.maxTokens ?? 1024,
          temperature: 0,
          system: systeme,
          messages: [
            {
              role: "user",
              content: [
                ...images.map((image) => ({
                  type: "image",
                  source: { type: "base64", media_type: image.mimeType, data: image.base64 },
                })),
                { type: "text", text: consigne },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (reponse.status === 401 || reponse.status === 403) {
        return { succes: false, erreur: erreurIA("cle_api_refusee", `ANTHROPIC_API_KEY est refusée (HTTP ${reponse.status}).`) };
      }
      if (reponse.status === 429) {
        return { succes: false, erreur: erreurIA("quota_depasse", "Quota Anthropic dépassé.") };
      }
      if (!reponse.ok) {
        console.error(`Lecture d'image Anthropic échouée : HTTP ${reponse.status}`);
        return { succes: false, erreur: erreurIA("fournisseur_indisponible", `Erreur du fournisseur (${reponse.status}).`) };
      }
      const donnees = (await reponse.json()) as { content?: { type: string; text?: string }[] };
      const texte = donnees.content?.find((b) => b.type === "text")?.text;
      if (!texte) {
        return { succes: false, erreur: erreurIA("reponse_invalide", "Le fournisseur n'a rien renvoyé de lisible.") };
      }
      return { succes: true, texte };
    } catch (err) {
      const nom = err instanceof Error ? err.name : "";
      if (nom === "AbortError") {
        return { succes: false, erreur: erreurIA("fournisseur_indisponible", "La lecture a dépassé le temps imparti.") };
      }
      console.error("Lecture d'image Anthropic échouée :", err);
      return { succes: false, erreur: erreurIA("fournisseur_indisponible", "Le fournisseur n'a pas répondu.") };
    }
  },

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
          model: MODELE_PAR_DEFAUT,
          max_tokens: MAX_TOKENS_TEXTE,
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

      const donnees = (await reponse.json()) as {
        content?: { type: string; text?: string }[];
        stop_reason?: string;
      };
      const texte = donnees.content?.find((b) => b.type === "text")?.text;
      if (!texte) {
        return { succes: false, erreur: erreurIA("reponse_invalide", "Réponse du fournisseur vide.") };
      }
      // **`stop_reason` arrivait ici et était jeté.** L'API dit quand elle a
      // coupé la réponse en plein milieu ; sans cette lecture, une troncature
      // devient indiscernable d'une réponse hors sujet, et aucun correctif en
      // aval ne peut retrouver l'information.
      return { succes: true, texte, fin: donnees.stop_reason === "max_tokens" ? "tronque" : "complet" };
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
          model: MODELE_PAR_DEFAUT,
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
