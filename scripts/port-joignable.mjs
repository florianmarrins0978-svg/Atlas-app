#!/usr/bin/env node
/**
 * Le téléphone du patron atteint-il Atlas ? — une question, trois réponses.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa nuit du 30 au 31 août 2026.** Son espace tournait, Atlas répondait sur
 * `127.0.0.1:3000`, la version rapide était bâtie sur le dernier commit — et
 * son adresse publique rendait un 404 du relais. De son téléphone, l'appli
 * « ne se lançait plus ».
 *
 * **Pourquoi rien ne l'a réparé :** le veilleur redemandait l'ouverture du port
 * jusqu'à ce que `gh` réponde « ouvert », puis retenait `PORT_OUVERT=oui` et
 * n'y revenait **jamais**. Or ce mot ne dit pas que le port est joignable : il
 * dit qu'une commande a réussi, à un instant. Le relais peut perdre le port
 * ensuite — un serveur remplacé, une bascule, une reprise après veille — et
 * plus rien ne le remarque. C'est le même défaut que celui du 22 août, d'un cran
 * plus loin : on retenait encore un RÉGLAGE là où il fallait une MESURE.
 *
 * Ce script rend cette mesure au veilleur, qui ne sait pas lire du JSON.
 *
 *   0  Atlas répond à l'adresse publique — il n'y a rien à faire
 *   1  MESURÉ, et il ne répond pas — le port est à redemander
 *   2  pas mesurable (hors Codespace, variables absentes) — ne rien conclure
 *
 * **Le 2 n'est pas un détail.** Une ignorance prise pour un refus ferait
 * rappeler `gh` toutes les cinq minutes sur une machine qui n'a pas de port à
 * ouvrir — un garde-fou qui parle à tort s'apprend à être ignoré.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { regarderDuDehors } from "./_verdict-port.mjs";

const dehors = await regarderDuDehors();
if (!dehors) process.exit(2);
process.exit(dehors.joignable ? 0 : 1);
