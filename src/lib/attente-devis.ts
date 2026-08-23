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
 */
export type IssueAttente = "pret" | "abandon";

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
      const corps = (await r.json()) as { pret?: boolean } | null;
      if (r.ok && corps?.pret === true) return "pret";
    } catch {
      // Injoignable pour l'instant : on retentera. C'est précisément ce qu'un
      // aller-retour unique ne savait pas faire.
    }
  }
  return "abandon";
}
