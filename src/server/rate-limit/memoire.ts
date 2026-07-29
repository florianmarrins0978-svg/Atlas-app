import type { MagasinLimite, ResultatLimite } from "./types";

type Compteur = { count: number; expireA: number };

// Un seul magasin en mémoire par process — suffisant pour dev/test (un seul
// process), inadapté à plusieurs instances en production (chacune aurait son
// propre compteur, contournable). Jamais sélectionné en production — voir
// src/server/env.ts.
export class MagasinLimiteMemoire implements MagasinLimite {
  private compteurs = new Map<string, Compteur>();

  async verifierEtIncrementer(cle: string, max: number, fenetreMs: number): Promise<ResultatLimite> {
    const maintenant = Date.now();
    const existant = this.compteurs.get(cle);

    if (!existant || existant.expireA <= maintenant) {
      this.compteurs.set(cle, { count: 1, expireA: maintenant + fenetreMs });
      return { autorise: true };
    }

    if (existant.count >= max) {
      return { autorise: false, retryAfterMs: existant.expireA - maintenant };
    }

    existant.count += 1;
    return { autorise: true };
  }

  // Réservé aux tests : vide l'état entre les cas de test.
  _reinitialiser(): void {
    this.compteurs.clear();
  }
}
