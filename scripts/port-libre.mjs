import { createServer } from "node:net";

/**
 * **Le PORT est-il libre — pas « la santé se tait-elle ».**
 *
 * La version précédente interrogeait `/api/health/live` et concluait « port
 * rendu » dès qu'il ne répondait plus. C'est faux, et c'est ce qui a fait
 * revenir « EADDRINUSE » chez le patron le 10 août 2026 au soir, APRÈS une
 * construction réussie : un serveur qu'on vient de tuer cesse de répondre bien
 * avant de rendre sa socket, et un processus qui tient le port sans servir
 * Atlas ne répond à cette route dans aucun cas. Le banc lançait donc
 * `next start` sur un port encore occupé.
 *
 * On demande maintenant au système, en essayant d'ÉCOUTER dessus : c'est la
 * seule question dont la réponse engage `next start`. La socket d'essai est
 * refermée aussitôt.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sortie de `banc.mjs` le 2 septembre 2026, pour que la fiche s'en serve
 * aussi.** Sa ligne « Serveur : NE RÉPOND PAS » recouvrait deux états qui
 * n'appellent pas du tout le même geste : plus rien n'écoute (le banc n'a pas
 * démarré), ou quelque chose tient le port sans répondre (un serveur enlisé,
 * que le veilleur va déloger). La recopier dans le diagnostic aurait fait deux
 * implémentations d'une même question, qui finissent toujours par diverger
 * (`CLAUDE.md` §3) — et c'est justement celle-ci qui a déjà été fausse une
 * fois.
 *
 * Ne lève jamais : un port qu'on n'arrive pas à sonder se dit occupé, ce qui
 * est le côté prudent — on ne conclura pas « rien n'écoute » à tort.
 */
export function portLibre(port) {
  return new Promise((resoudre) => {
    const essai = createServer();
    essai.once("error", () => resoudre(false));
    essai.once("listening", () => essai.close(() => resoudre(true)));
    essai.listen(Number(port), "0.0.0.0");
  });
}
