import { creditsIADeLEntreprise, ajouterDepense } from "../repositories/consommation-ia";
import { executerAvecContexte, getContexteRequete, idRequeteValideOuGenere } from "../request-context";
import { getCurrentCtx } from "../session-ctx";
import { logger } from "../logger";
import { coutDUnAppel, coutDUneEcoute, jetonsDe, JETONS_PAR_IMAGE, phraseCreditsEpuises } from "@/lib/credits-ia";
import { erreurIA, type ErreurIA } from "./errors";
import type { FournisseurLLM, MessageConversation, ResultatLLM } from "./providers/llm/interface";
import type { FournisseurTranscription } from "./providers/transcription/interface";
import type { Ctx } from "../repositories/context";

/**
 * LE COMPTEUR DES CRÉDITS IA, posé sur les fournisseurs PAYANTS — et nulle part
 * ailleurs (audit du 25 octobre 2026, E13 ; ses plafonds du 26 octobre).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Pourquoi ici.** L'IA est appelée depuis une soixantaine d'endroits, et
 * chacun passe par les fabriques (`getFournisseurLLM`, `getFournisseurVision`,
 * `getFournisseurTranscription`). Posé sur chaque appelant, le compteur
 * s'oublierait au premier écran neuf ; posé dans la fabrique, aucun appel payant
 * ne lui échappe. Les fournisseurs d'essai et de développement ne coûtent rien
 * et ne passent pas par lui : les suites restent sans base ni session.
 *
 * **Qui paie.** L'entreprise de la requête en cours : d'abord le contexte posé
 * par `pourLeCompteDe` (une lecture lancée après la réponse, où il n'y a plus
 * de requête), sinon la session. Hors de toute requête, en production, l'appel
 * est REFUSÉ : un appel que personne ne paie est exactement le trou que ce
 * fichier ferme. Hors production (un script de vérification lancé à la main),
 * il passe sans être compté.
 *
 * **Vérifier avant, compter après.** Deux appels simultanés à 99 % passent
 * tous les deux : le plafond peut se dépasser d'un appel, quelques centimes.
 * Le verrouiller exigerait une réservation par appel, pour rien de plus.
 */

/**
 * Pose l'entreprise qui paie pour tout ce que `fn` appellera, quand il n'y a
 * plus de requête pour la dire (un `after()`).
 */
export function pourLeCompteDe<T>(ctx: Ctx, fn: () => Promise<T>): Promise<T> {
  return executerAvecContexte(
    { requestId: idRequeteValideOuGenere(null), utilisateurId: ctx.utilisateurId, entrepriseId: ctx.entrepriseId },
    fn
  );
}

function horsRequete(e: unknown): boolean {
  // Next.js le dit en toutes lettres, et c'est la seule trace qu'il laisse :
  // « `headers` was called outside a request scope ».
  return e instanceof Error && /outside a request scope/.test(e.message);
}

async function quiPaie(): Promise<Ctx | "personne"> {
  const pose = getContexteRequete();
  if (pose?.entrepriseId && pose.utilisateurId) return { utilisateurId: pose.utilisateurId, entrepriseId: pose.entrepriseId };
  try {
    return await getCurrentCtx();
  } catch (e) {
    if (horsRequete(e)) return "personne";
    throw e;
  }
}

/** `null` : l'appel peut partir ; sinon le refus à rendre à sa place. */
async function avantLAppel(): Promise<{ payeur: Ctx | null } | { refus: ErreurIA }> {
  const payeur = await quiPaie();
  if (payeur === "personne") {
    if (process.env.NODE_ENV === "production") {
      logger.error("ia_appel_sans_payeur", {});
      return { refus: erreurIA("credits_epuises", "Appel à l'IA hors de toute entreprise : refusé.") };
    }
    return { payeur: null };
  }
  const credits = await creditsIADeLEntreprise(payeur, new Date());
  if (credits.plafonne && credits.etat === "epuise") {
    logger.warn("ia_credits_epuises", { entrepriseId: payeur.entrepriseId });
    return { refus: erreurIA("credits_epuises", phraseCreditsEpuises(credits.reprise)) };
  }
  return { payeur };
}

/** Compter ne doit jamais faire échouer un appel déjà payé : un raté se journalise. */
async function compter(payeur: Ctx | null, microeuros: number): Promise<void> {
  if (!payeur) return;
  try {
    await ajouterDepense(payeur, microeuros, new Date());
  } catch (e) {
    logger.error("ia_depense_non_comptee", {
      entrepriseId: payeur.entrepriseId,
      microeuros,
      erreur: e instanceof Error ? e.message : String(e),
    });
  }
}

function longueur(...textes: (string | undefined)[]): number {
  return textes.reduce((n, t) => n + (t?.length ?? 0), 0);
}

function longueurHistorique(historique: MessageConversation[]): number {
  return historique.reduce((n, m) => n + ("contenu" in m ? m.contenu.length : JSON.stringify(m).length), 0);
}

function coutDuTexte(fournisseur: string, caracteresEntree: number, r: ResultatLLM, imagesLues = 0): number {
  const sortie = r.succes ? r.texte.length : 0;
  return coutDUnAppel(fournisseur, jetonsDe(caracteresEntree) + imagesLues * JETONS_PAR_IMAGE, jetonsDe(sortie));
}

export function avecCompteurLLM(f: FournisseurLLM): FournisseurLLM {
  const compte: FournisseurLLM = {
    nom: f.nom,
    async genererTexte(systeme, message, contexte) {
      const avant = await avantLAppel();
      if ("refus" in avant) return { succes: false, erreur: avant.refus };
      const r = await f.genererTexte(systeme, message, contexte);
      await compter(avant.payeur, coutDuTexte(f.nom, longueur(systeme, message, contexte), r));
      return r;
    },
  };
  if (f.genererAvecOutils) {
    const appeler = f.genererAvecOutils.bind(f);
    compte.genererAvecOutils = async (systeme, historique, outils) => {
      const avant = await avantLAppel();
      if ("refus" in avant) return { succes: false, erreur: avant.refus };
      const r = await appeler(systeme, historique, outils);
      const entree = longueur(systeme) + longueurHistorique(historique) + JSON.stringify(outils.map((o) => [o.nom, o.description])).length;
      const sortie = r.succes ? (r.type === "texte" ? r.texte.length : JSON.stringify(r.appels).length) : 0;
      await compter(avant.payeur, coutDUnAppel(f.nom, jetonsDe(entree), jetonsDe(sortie)));
      return r;
    };
  }
  if (f.lireImage) {
    const lire = f.lireImage.bind(f);
    compte.lireImage = async (systeme, consigne, image) => {
      const avant = await avantLAppel();
      if ("refus" in avant) return { succes: false, erreur: avant.refus };
      const r = await lire(systeme, consigne, image);
      await compter(avant.payeur, coutDuTexte(f.nom, longueur(systeme, consigne), r, 1));
      return r;
    };
  }
  if (f.lireImages) {
    const lire = f.lireImages.bind(f);
    compte.lireImages = async (systeme, consigne, images, options) => {
      const avant = await avantLAppel();
      if ("refus" in avant) return { succes: false, erreur: avant.refus };
      const r = await lire(systeme, consigne, images, options);
      await compter(avant.payeur, coutDuTexte(f.nom, longueur(systeme, consigne), r, images.length));
      return r;
    };
  }
  return compte;
}

export function avecCompteurTranscription(f: FournisseurTranscription): FournisseurTranscription {
  return {
    nom: f.nom,
    async transcrire(octets, mimeType, indice) {
      const avant = await avantLAppel();
      if ("refus" in avant) return { succes: false, erreur: avant.refus };
      const r = await f.transcrire(octets, mimeType, indice);
      await compter(avant.payeur, coutDUneEcoute(f.nom, octets.length));
      return r;
    },
  };
}
