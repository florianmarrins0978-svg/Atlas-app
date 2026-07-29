import Redis from "ioredis";
import type { MagasinLimite, ResultatLimite } from "./types";

// Compteur atomique via INCR + EXPIRE (posée uniquement à la création de la
// clé) — sûr sous accès concurrent, partagé entre toutes les instances de
// l'application (contrairement à l'adaptateur mémoire).
export class MagasinLimiteRedis implements MagasinLimite {
  private client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  async fermer(): Promise<void> {
    await this.client.quit();
  }

  async verifierEtIncrementer(cle: string, max: number, fenetreMs: number): Promise<ResultatLimite> {
    const cleRedis = `ratelimit:${cle}`;
    const compte = await this.client.incr(cleRedis);
    if (compte === 1) {
      await this.client.pexpire(cleRedis, fenetreMs);
    }
    if (compte > max) {
      const ttl = await this.client.pttl(cleRedis);
      return { autorise: false, retryAfterMs: ttl > 0 ? ttl : fenetreMs };
    }
    return { autorise: true };
  }
}
