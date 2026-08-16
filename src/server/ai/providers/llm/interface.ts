import type { ErreurIA } from "../../errors";
import type { ZodTypeAny } from "zod";

export type ResultatLLM = { succes: true; texte: string } | { succes: false; erreur: ErreurIA };

// --- Extension additive (Lot IA-02) : usage d'outils --------------------
// N'affecte pas genererTexte() ni ses appelants existants (extraction).

export type MessageConversation =
  | { role: "user" | "assistant"; contenu: string }
  | { role: "outil"; outil: string; resultat: unknown };

export type DefinitionOutil = {
  nom: string;
  description: string;
  schema: ZodTypeAny;
};

export type ResultatLLMAvecOutils =
  | { succes: true; type: "texte"; texte: string }
  | { succes: true; type: "appel_outil"; outil: string; parametres: unknown }
  | { succes: false; erreur: ErreurIA };

export interface FournisseurLLM extends FournisseurVision {
  nom: string;
  genererTexte(systeme: string, message: string): Promise<ResultatLLM>;
  // Optionnel : un fournisseur qui ne le supporte pas (stub) reste valide.
  genererAvecOutils?(
    systeme: string,
    historique: MessageConversation[],
    outils: DefinitionOutil[]
  ): Promise<ResultatLLMAvecOutils>;
}

// --- Extension additive (13 août 2026) : lire une IMAGE ------------------
//
// **Pourquoi elle est arrivée après coup.** L'interface ne savait manipuler que
// du texte : `genererTexte(systeme, message)`. Le patron a demandé de scanner
// ses tickets de gazole — *« on passe les tickets devant, il les scanne et les
// intègre automatiquement »* — et la vision n'existait nulle part dans ce
// dépôt.
//
// **Optionnelle, comme `genererAvecOutils`.** Un fournisseur qui ne la porte
// pas reste valide : l'écran retombe alors sur la saisie à la main plutôt que
// de refuser le geste. Faire semblant d'avoir lu serait pire que de ne rien
// lire — un chiffre faux entré tout seul coûte plus cher que pas de chiffre.

export type ImagePourLecture = {
  /** Les octets de l'image, en base64 — sans le préfixe `data:`. */
  base64: string;
  /** « image/jpeg », « image/png », « image/webp ». */
  mimeType: string;
};

export interface FournisseurVision {
  lireImage?(systeme: string, consigne: string, image: ImagePourLecture): Promise<ResultatLLM>;
}
