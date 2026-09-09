import type { FournisseurTranscription, ResultatTranscription } from "./interface";
import { erreurIA } from "../../errors";

/**
 * LE FOURNISSEUR DES SUITES — il rend un texte ORDINAIRE, non marqué.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Pourquoi il a fallu l'écrire, le 9 septembre 2026.**
 *
 * Le 5 septembre, un lot a corrigé un vrai danger : le texte de remplacement du
 * fournisseur `dev` était traité comme une VRAIE transcription, découpé en
 * segments, et chaque segment ressortait en PRESTATION sur le devis du patron
 * (`etat-transcription.ts` : `if (simulee) return "non_transcrite"`). La
 * correction est juste et ne bouge pas d'un pouce.
 *
 * **Mais les suites navigateur n'avaient que `dev`.** Depuis ce jour, la chaîne
 * dictée → devis s'arrête chez elles sur *« aucun prestataire de transcription
 * n'est encore raccordé »* — l'écran le dit, personne ne l'avait lu. Quatorze
 * suites rougissaient, sur les machines comme en CI, et le paquet passait pour
 * un « flottement » depuis quatre jours.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QU'IL N'AFFAIBLIT PAS, ET C'EST L'ESSENTIEL.**
 *
 * | | |
 * |---|---|
 * | `dev` | inchangé : il marque son texte, et l'application le refuse |
 * | la production | le refuse aussi — `essai` n'est pas dans `CLES_TRANSCRIPTION`, donc `env.ts` rend « n'est pas un fournisseur reconnu » |
 * | le réseau | aucun appel, jamais |
 *
 * Il ne se choisit que par `TRANSCRIPTION_PROVIDER=essai`, et un seul endroit du
 * dépôt l'écrit : le serveur que `run-e2e-tests.ts` allume pour les suites.
 *
 * **Le texte est celui d'un vrai chantier de paysagiste**, et il est FIXE : une
 * suite qui éprouve un devis doit pouvoir dire ce qu'elle attend. Il ne dit
 * exprès ni la longueur de la haie ni le diamètre du tronc — les deux seules
 * choses qui font le prix —, pour que l'arrêt d'avant-chiffrage se déclenche
 * comme chez le patron.
 */
export const TEXTE_DE_LESSAI =
  "Taille de la haie de thuyas le long du chemin, ramassage des déchets verts, " +
  "et élagage du tilleul devant la maison.";

export const fournisseurTranscriptionEssai: FournisseurTranscription = {
  nom: "essai",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcrire(octets: Buffer, _mimeType: string): Promise<ResultatTranscription> {
    // **Un fichier vide reste un échec**, comme chez `dev` et chez les vrais :
    // une suite qui envoie zéro octet doit voir ce que le patron verrait.
    if (octets.length === 0) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Fichier audio vide.") };
    }
    return { succes: true, texte: TEXTE_DE_LESSAI };
  },
};
