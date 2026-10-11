import type { QuestionChiffrage } from "./questions-chiffrage";

/**
 * Attendre un devis sans dépendre d'un aller-retour tenu ouvert.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le patron, le 12 août 2026 :** *« entre le moment où je clique mon devis et
 * le moment où le devis apparaît, la première fois il s'est passé plus de six
 * minutes et j'ai dû recharger la page pour que le devis arrive. »*
 *
 * Le serveur avait fini depuis longtemps : chaque appel à un modèle est borné à
 * trente secondes, la chaîne entière ne peut pas durer six minutes. Ce qui a
 * duré six minutes, c'est son ATTENTE — la réponse n'est jamais revenue, et le
 * bouton est resté sur « Atlas prépare le devis… » indéfiniment.
 *
 * **Deux défauts, et le second est le vrai.** Le premier : une longue requête
 * tenue ouverte se perd (un mandataire qui coupe, un serveur qui redémarre —
 * `ARCHITECTURE.md` §63 et §65). Le second, plus grave : quand elle se perd,
 * l'écran n'a AUCUN moyen de savoir que le travail a abouti. Il attend une
 * réponse qui ne viendra plus, pendant que le devis existe déjà en base.
 *
 * D'où cette attente : on demande périodiquement si le devis est là. C'est
 * moins élégant qu'un aller-retour, et infiniment plus solide — la question
 * peut être reposée, l'aller-retour perdu ne peut pas l'être.
 *
 * **Et elle sait renoncer.** Une attente sans fin est le défaut qu'on répare :
 * passé le délai, elle rend `"abandon"`, et l'écran dit quoi faire au lieu de
 * tourner pour toujours.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **ELLE NE REGARDAIT QU'UNE ISSUE SUR SIX — sa capture du 1ᵉʳ septembre 2026.**
 *
 * *« Atlas prépare toujours votre devis… (96 s) »*, et rien ne vient.
 *
 * **Ce compteur ne s'atteint que par une seule voie** : le rattrapage ci-dessus,
 * c'est-à-dire une réponse d'action serveur PERDUE. Sa capture prouve donc que
 * la chaîne a répondu dans le vide — pas qu'elle a bouclé.
 *
 * Or ce rattrapage n'avait qu'un seul signal de réussite : « le devis est
 * écrit ». La chaîne, elle, s'arrête légitimement **sans écrire de devis** dans
 * cinq cas sur six (`devis-depuis-dictee.ts`) — dictée non transcrite,
 * transcription simulée, brouillon corrigé à la main, échec, et surtout
 * **l'arrêt d'avant-chiffrage**, celui qui lui pose les deux questions valant
 * 800 €. Sur une vraie dictée d'arbre, c'est le cas le PLUS fréquent.
 *
 * Réponse perdue **+** arrêt d'avant-chiffrage = une attente qui ne peut jamais
 * aboutir. Cinq minutes de compteur, puis « la préparation n'a pas abouti » —
 * alors que le serveur avait fini son travail et l'attendait avec ses questions.
 *
 * **Elle rapporte donc désormais l'arrêt, et l'écran le montre.** Répondre
 * termine le devis sans relire la dictée (`enregistrerPrecisionsEtReprendre`) :
 * le rattrapage rattrape pour de bon, au lieu de renoncer poliment.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export type IssueAttente =
  /** Le devis porte des lignes : il y a de quoi l'ouvrir. */
  | { type: "pret" }
  /**
   * La chaîne est allée jusqu'à l'arrêt d'avant-chiffrage et l'y attend.
   *
   * Ce n'est pas un échec : c'est le seul arrêt du parcours avant l'envoi, et
   * il vaut de l'argent (`docs/AGENT.md` §2).
   */
  | { type: "questions"; questions: QuestionChiffrage[] }
  /** Rien de concluant dans le délai imparti. */
  | { type: "abandon" };

/**
 * Ce que la route rend — et ce que l'attente sait en faire.
 *
 * **`pret` compte les LIGNES, plus la date de génération**, et ce n'est pas un
 * détail : `devis_genere_at` est posé par `getOuCreerDevisBrouillon`, que la
 * page du devis appelle elle-même en s'ouvrant. Sur cette page-là, le témoin
 * était donc vrai AVANT que la chaîne ait rien produit, et l'attente y répondait
 * « prêt » devant une feuille vide.
 *
 * L'écran, lui, décidait déjà sur le nombre de lignes (`devis-a-preparer.ts`).
 * Deux lectures d'une même question, dont une fausse — `CLAUDE.md` §3. Il n'en
 * reste qu'une, et c'est celle de l'écran.
 */
type ReponseDevisPret = { pret?: boolean; questions?: QuestionChiffrage[] } | null;

export async function attendreLeDevis(
  chantierId: string,
  options: {
    /** Combien de temps au total avant de renoncer. */
    limiteMs?: number;
    /** Combien de temps entre deux questions. */
    intervalleMs?: number;
    interroger?: (url: string) => Promise<Response>;
    patienter?: (ms: number) => Promise<void>;
    /** Rendu à chaque tour, pour que l'écran puisse dire depuis combien de temps. */
    surAttente?: (secondesEcoulees: number) => void;
  } = {}
): Promise<IssueAttente> {
  const limiteMs = options.limiteMs ?? 5 * 60_000;
  const intervalleMs = options.intervalleMs ?? 4_000;
  const interroger =
    options.interroger ?? ((url: string) => fetch(url, { cache: "no-store" }));
  const patienter =
    options.patienter ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let ecoule = 0;
  while (ecoule < limiteMs) {
    await patienter(intervalleMs);
    ecoule += intervalleMs;
    options.surAttente?.(Math.round(ecoule / 1000));
    try {
      const r = await interroger(`/api/chantiers/${chantierId}/devis-pret`);
      // Une réponse qui n'est pas du JSON — page de connexion rendue par un
      // mandataire, par exemple — ne doit pas passer pour un « prêt ».
      const corps = (await r.json()) as ReponseDevisPret;
      if (!r.ok || !corps) continue;
      // **Le devis d'abord.** S'il est écrit, il n'y a plus rien à demander :
      // les questions qui resteraient sans réponse y sont déjà signalées
      // (`chiffrerEtPreparer`, `aSignaler`), et le renvoyer à l'arrêt lui
      // ferait refaire un chemin qu'il a déjà franchi.
      if (corps.pret === true) return { type: "pret" };
      if (Array.isArray(corps.questions) && corps.questions.length > 0) {
        return { type: "questions", questions: corps.questions };
      }
    } catch {
      // Injoignable pour l'instant : on retentera. C'est précisément ce qu'un
      // aller-retour unique ne savait pas faire.
    }
  }
  return { type: "abandon" };
}
