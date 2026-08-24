/**
 * OÙ Atlas se nomme, quand il demande un visage — et pourquoi cette question
 * n'est pas un détail de configuration.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Deux valeurs, et elles ne disent pas la même chose.**
 *
 * | | |
 * |---|---|
 * | `rpId` | le **domaine** auquel la clé est attachée — `atlas.fr` |
 * | `origine` | l'**adresse complète** de la page — `https://atlas.fr` |
 *
 * Une clé créée sous un `rpId` ne s'ouvre que sur ce domaine : c'est ce qui
 * fait qu'un site pirate ne peut pas demander le visage d'un artisan pour
 * entrer chez lui. Le navigateur le vérifie de son côté, et il ne triche pas —
 * mais il refuse **en silence** si les deux ne s'accordent pas, et l'artisan ne
 * voit alors qu'un geste qui ne fait rien.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Pourquoi on ne devine PAS le domaine en production.**
 *
 * L'hôte d'une requête est écrit par le client, ou par un mandataire qui le
 * recopie. S'en servir sans réserve, c'est la faute exacte que ce dépôt vient
 * de fermer sur `x-forwarded-for` (`src/lib/source-visiteur.ts`) : on croit un
 * en-tête que celui qui frappe compose lui-même.
 *
 * Ici, le dégât resterait borné — le navigateur refuserait de créer une clé
 * pour un domaine qui n'est pas celui de la page —, mais **le résultat pour
 * l'artisan serait une porte muette**, et personne ne saurait pourquoi. D'où :
 *
 *   · en production, `ATLAS_RP_ID` **commande** et rien d'autre n'est cru ;
 *   · sans elle, on refuse plutôt que de deviner, et le refus se dit ;
 *   · hors production — développement, banc d'essai — l'hôte de la requête
 *     suffit : son adresse change à chaque espace de travail, l'y épingler
 *     rendrait Face ID inutilisable là où on l'essaie.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **`localhost` est le seul domaine que WebAuthn accepte en clair.** Partout
 * ailleurs il exige HTTPS. Le banc du patron est en HTTPS derrière son
 * mandataire, donc cela ne le concerne pas — mais un développement sur
 * `http://192.168.1.x` échouerait sans un mot, et c'est le genre de panne qui
 * coûte une soirée. On le dit ici plutôt que de le laisser découvrir.
 */

/** Ce qu'il faut à la fois au navigateur et à la vérification serveur. */
export type OrigineWebAuthn = { rpId: string; origine: string };

export type VerdictOrigine =
  | { ok: true; origine: OrigineWebAuthn }
  | { ok: false; code: CodeRefusOrigine; raison: string };

export type CodeRefusOrigine =
  | "hote-absent"
  | "hote-illisible"
  | "domaine-non-declare"
  | "domaine-discordant"
  | "sans-https";

/**
 * L'hôte tel qu'il arrive : `atlas.fr`, `atlas.fr:3000`, `[::1]:3000`.
 * Le port ne fait jamais partie du `rpId` — il fait partie de l'origine.
 */
function domaineDe(hote: string): string | null {
  const nu = hote.trim().toLowerCase();
  if (!nu) return null;

  // Une adresse IPv6 s'écrit entre crochets ; son port vient après.
  if (/^\[[0-9a-f:.]+\](:\d+)?$/.test(nu)) return nu.slice(0, nu.indexOf("]") + 1);

  /**
   * **L'hôte ENTIER est validé avant qu'on en retire quoi que ce soit**, et
   * c'est une correction que la suite a trouvée, pas une relecture.
   *
   * La première rédaction découpait sur le premier `:` puis vérifiait le
   * morceau restant. Sur `https://atlas.fr`, ce morceau valait `https` — un mot
   * fait de lettres, donc accepté : Atlas aurait enregistré des clés sous le
   * domaine « https », et aucune ne se serait jamais rouverte. Découper d'abord,
   * c'est valider autre chose que ce qu'on a reçu.
   */
  if (!/^[a-z0-9.-]+(:\d+)?$/.test(nu)) return null;
  const sansPort = nu.split(":")[0];
  // Un domaine ne commence ni ne finit par un point, et n'en double aucun.
  if (sansPort.startsWith(".") || sansPort.endsWith(".") || sansPort.includes("..")) return null;
  return sansPort;
}

/** `localhost` et les bouclages sont les seuls tolérés en clair. */
function estLocal(domaine: string): boolean {
  return domaine === "localhost" || domaine === "127.0.0.1" || domaine === "[::1]";
}

export function origineWebAuthn(entree: {
  /** L'en-tête `host` (ou `x-forwarded-host`) de la requête. */
  hote: string | null | undefined;
  /** `https` ou `http`, tel que le mandataire l'annonce. */
  protocole: string | null | undefined;
  /** `ATLAS_RP_ID` — le domaine épinglé. Obligatoire en production. */
  domaineEpingle?: string | null;
  /** Vrai en développement et sur le banc d'essai. */
  horsProduction: boolean;
}): VerdictOrigine {
  const epingle = entree.domaineEpingle?.trim().toLowerCase() || null;

  if (!entree.horsProduction && !epingle) {
    return {
      ok: false,
      code: "domaine-non-declare",
      // Le message nomme le bon coupable : la configuration, pas le téléphone
      // de l'artisan (`AGENTS.md` — « une erreur qui accuse à tort coûte plus
      // cher que pas d'erreur du tout »).
      raison:
        "ATLAS_RP_ID n'est pas posé : Atlas ne sait pas sous quel domaine enregistrer une clé d'appareil.",
    };
  }

  const hote = entree.hote?.trim();
  if (!hote) {
    return { ok: false, code: "hote-absent", raison: "La requête n'annonce aucun hôte." };
  }

  const domaineDeLaRequete = domaineDe(hote);
  if (!domaineDeLaRequete) {
    return { ok: false, code: "hote-illisible", raison: "L'hôte annoncé n'est pas un domaine." };
  }

  const rpId = epingle ?? domaineDeLaRequete;

  /**
   * **Le domaine épinglé doit COUVRIR celui de la requête, sinon rien ne
   * marchera et personne ne saura pourquoi.**
   *
   * WebAuthn autorise un `rpId` plus court que le domaine de la page —
   * `atlas.fr` pour une page servie sur `app.atlas.fr` : c'est ce qui permet à
   * une clé de suivre l'artisan d'un sous-domaine à l'autre. Il n'autorise rien
   * d'autre. Un `ATLAS_RP_ID` mal recopié — l'ancien domaine, une faute de
   * frappe — produit alors un bouton qui ne fait rien, et le navigateur ne dit
   * pas un mot. On refuse ici, en nommant les deux valeurs qui ne s'accordent
   * pas.
   */
  if (epingle && domaineDeLaRequete !== epingle && !domaineDeLaRequete.endsWith(`.${epingle}`)) {
    return {
      ok: false,
      code: "domaine-discordant",
      raison: `ATLAS_RP_ID vaut « ${epingle} », mais la page est servie depuis « ${domaineDeLaRequete} » : le navigateur refuserait sans rien afficher.`,
    };
  }

  const protocole = (entree.protocole ?? "").trim().toLowerCase() || (estLocal(domaineDeLaRequete) ? "http" : "https");

  if (protocole !== "https" && !estLocal(domaineDeLaRequete)) {
    return {
      ok: false,
      code: "sans-https",
      raison:
        "Face ID exige une adresse en https (seul localhost fait exception) — le navigateur refuserait sans rien dire.",
    };
  }

  /**
   * **L'origine se compose de l'hôte REÇU, jamais du domaine épinglé.** Le port
   * en fait partie, et le navigateur compare caractère pour caractère : bâtir
   * `https://atlas.fr` quand la page est sur `https://atlas.fr:8443` ferait
   * échouer chaque vérification, sans que rien ne dise pourquoi.
   */
  return { ok: true, origine: { rpId, origine: `${protocole}://${hote.toLowerCase()}` } };
}
