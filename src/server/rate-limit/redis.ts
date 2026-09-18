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

  /**
   * **En un seul script, et c'est indispensable.** `DECR` sur une clé absente
   * la CRÉE à −1, sans expiration : un compteur immortel, que plus aucune
   * fenêtre ne remettrait à zéro. On ne touche donc qu'une clé qui existe, et
   * l'on garde son TTL (`KEEPTTL`) — la fenêtre appartient au premier essai,
   * pas au dernier.
   */
  async rendre(cle: string): Promise<void> {
    await this.client.eval(
      `if redis.call('EXISTS', KEYS[1]) == 1 then
         local n = redis.call('DECR', KEYS[1])
         if n < 0 then redis.call('SET', KEYS[1], 0, 'KEEPTTL') end
       end
       return 1`,
      1,
      `ratelimit:${cle}`
    );
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
