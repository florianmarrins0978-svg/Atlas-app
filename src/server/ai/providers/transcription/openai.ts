import type { FournisseurTranscription, ResultatTranscription } from "./interface";
import { erreurIA } from "../../errors";
import { getConfigIA } from "../../config";

// Fournisseur réel, prêt pour la production. Non fonctionnel dans cet
// environnement de développement : api.openai.com n'est pas accessible depuis
// le réseau sandbox (confirmé : 403 host_not_allowed), et aucune clé n'y est
// configurée. Fonctionnera normalement une fois déployé avec un accès réseau
// standard et OPENAI_API_KEY définie.
export const fournisseurTranscriptionOpenAI: FournisseurTranscription = {
  nom: "openai",
  async transcrire(octets: Buffer, mimeType: string): Promise<ResultatTranscription> {
    const cle = getConfigIA().openaiApiKey;
    if (!cle) {
      return { succes: false, erreur: erreurIA("cle_api_absente", "OPENAI_API_KEY n'est pas configurée.") };
    }

    try {
      const extension = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "audio";
      const formData = new FormData();
      formData.set("file", new Blob([new Uint8Array(octets)], { type: mimeType }), `note.${extension}`);
      formData.set("model", "whisper-1");
      formData.set("language", "fr");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const reponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${cle}` },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (reponse.status === 429) {
        return { succes: false, erreur: erreurIA("quota_depasse", "Quota OpenAI dépassé.") };
      }
      if (!reponse.ok) {
        console.error(`Transcription OpenAI échouée : HTTP ${reponse.status}`);
        return {
          succes: false,
          erreur: erreurIA("fournisseur_indisponible", `Le service de transcription a répondu une erreur (${reponse.status}).`),
        };
      }

      const donnees = (await reponse.json()) as { text?: string };
      if (!donnees.text) {
        return { succes: false, erreur: erreurIA("reponse_invalide", "Réponse du service de transcription invalide.") };
      }
      return { succes: true, texte: donnees.text };
    } catch (err) {
      const estTimeout = err instanceof Error && err.name === "AbortError";
      console.error("Transcription OpenAI : erreur technique", err instanceof Error ? err.message : err);
      return {
        succes: false,
        erreur: estTimeout
          ? erreurIA("timeout", "Le service de transcription n'a pas répondu à temps.")
          : erreurIA("fournisseur_indisponible", "Le service de transcription est momentanément indisponible."),
      };
    }
  },
};
