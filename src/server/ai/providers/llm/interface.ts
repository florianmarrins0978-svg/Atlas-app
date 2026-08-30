import type { ErreurIA } from "../../errors";
import type { ZodTypeAny } from "zod";

/**
 * Comment le modèle a ARRÊTÉ d'écrire.
 *
 * **L'information existait, arrivait jusqu'ici, et était jetée.** L'API
 * Anthropic renvoie `stop_reason: "max_tokens"` quand elle a coupé la réponse
 * en plein milieu ; le fournisseur ne lisait que `content`. Une réponse tronquée
 * devenait donc indiscernable d'une réponse hors sujet, et les deux tombaient
 * dans le même repli sans que rien ne dise laquelle.
 *
 * Absente, on ne sait pas : c'est le cas des fournisseurs qui ne le disent pas,
 * et rien ne prétend le contraire.
 */
export type FinDeReponse = "complet" | "tronque";

export type ResultatLLM =
  | { succes: true; texte: string; fin?: FinDeReponse }
  | { succes: false; erreur: ErreurIA };

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
  /**
   * Rédiger, à partir d'une consigne et d'un message.
   *
   * **TROIS emplacements, et la distinction est une frontière de sécurité** —
   * lot de clôture, 29 août 2026 :
   *
   * | | |
   * |---|---|
   * | `systeme` | les RÈGLES. Écrites par nous, jamais par un utilisateur |
   * | `message` | la DONNÉE à traiter — une dictée, un texte collé |
   * | `contexte` | des EXEMPTLES appris, écrits par des humains. Données, jamais instructions |
   *
   * **Pourquoi `contexte` ne peut pas être collé dans `message`.** Le repli de
   * lecture littérale (`lireLitteralement`) analyse `message` mot à mot pour en
   * tirer des prestations. Y mêler des exemples lui ferait lire les exemples
   * comme la dictée — et ce repli sert AUSSI quand un vrai fournisseur répond à
   * côté, donc en production.
   *
   * **Ni dans `systeme`.** C'est la position de plus haute autorité : un libellé
   * rédigé comme un ordre y devient une règle pour toutes les extractions
   * suivantes. C'était le cas avant ce lot.
   */
  genererTexte(systeme: string, message: string, contexte?: string): Promise<ResultatLLM>;
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

/**
 * Ce qu'on peut régler sur une lecture d'image — et pourquoi ça se règle.
 *
 * **`modele` existe parce qu'il était écrit EN DUR.** `claude-sonnet-4-6`
 * vivait dans le fournisseur Anthropic, ce qui obligeait à rebâtir
 * l'application pour changer de modèle. Absent, le fournisseur garde son
 * défaut : rien ne change pour la lecture des tickets.
 *
 * **`maxTokens` se règle parce qu'un ticket et une observation ne pèsent pas
 * pareil.** 512 suffit à cinq champs de ticket ; une observation de diagnostic
 * porte une liste de signes, et un plafond trop bas la tronque au milieu d'un
 * JSON — qui devient alors illisible, sans que rien ne dise pourquoi.
 */
export type OptionsVision = {
  maxTokens?: number;
  modele?: string;
};

export interface FournisseurVision {
  lireImage?(systeme: string, consigne: string, image: ImagePourLecture): Promise<ResultatLLM>;

  // --- Extension additive (20 août 2026) : PLUSIEURS images ----------------
  //
  // **Pourquoi elle est arrivée après `lireImage`.** Le diagnostic végétal peut
  // demander UNE photo complémentaire — « photographiez le dessous de la
  // feuille » — et doit alors présenter les deux ensemble : séparées, la
  // seconde perdrait le contexte de la première, et c'est justement leur
  // rapprochement qui départage deux hypothèses.
  //
  // Optionnelle, comme les autres : un fournisseur qui ne la porte pas reste
  // valide, et l'écran annonce que l'analyse automatique n'est pas disponible
  // plutôt que de faire semblant.
  lireImages?(
    systeme: string,
    consigne: string,
    images: ImagePourLecture[],
    options?: OptionsVision
  ): Promise<ResultatLLM>;
}
