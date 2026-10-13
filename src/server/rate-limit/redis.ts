import Redis from "ioredis";
import type { MagasinLimite, ResultatLimite } from "./types";

// Compteur atomique via INCR + EXPIRE (posée uniquement à la création de la
// clé) — sûr sous accès concurrent, partagé entre toutes les instances de
// l'application (contrairement à l'adaptateur mémoire).
export class MagasinLimiteRedis implements MagasinLimite {
  private client: Redis;

  /** Vrai entre la première erreur d'une panne et le retour du service : une panne ne s'écrit qu'une fois. */
  private enPanne = false;

  constructor(url: string) {
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    // **Sans écouteur, chaque tentative de reconnexion ratée s'imprimait** :
    // « [ioredis] Unhandled error event », des dizaines de fois par minute de
    // panne, au point de noyer le journal qu'on lit justement à ce moment-là.
    this.client.on("error", (erreur) => {
      if (this.enPanne) return;
      this.enPanne = true;
      console.error("[limite] Redis ne répond plus ; le limiteur compte en mémoire jusqu'à son retour.", erreur.message);
    });
    this.client.on("ready", () => {
      this.enPanne = false;
    });
  }

  /**
   * **Pendant une panne, on n'attend pas Redis : on échoue tout de suite.**
   * Payé le 13 octobre 2026. Chaque commande attendait la tentative de
   * reconnexion suivante, de plus en plus espacée, et la connexion d'un artisan
   * montait à 5 puis 8 secondes pendant la panne, alors que `verifierLimite`
   * sait déjà compter en mémoire quand le magasin échoue. Seule la toute
   * première connexion (`wait`, `connecting`) peut encore faire patienter : elle
   * ne dure que le temps d'ouvrir la socket.
   */
  private exigerDisponible(): void {
    const { status } = this.client;
    if (status === "reconnecting" || status === "close" || status === "end") {
      throw new Error(`Redis indisponible (${status})`);
    }
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
    this.exigerDisponible();
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
    this.exigerDisponible();
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
