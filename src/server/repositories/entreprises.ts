import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { entreprises, entrepriseCompteurs, users, membresEntreprise } from "../db/schema";
import type { Ctx } from "./context";
import { normaliserConditions, type ConditionsLues } from "@/lib/conditions-documents";
import { refusDuMessage, MESSAGE_PAR_DEFAUT } from "@/lib/message-client";
import { estLAllureParDefaut, normaliserAllure, type Allure } from "@/lib/allure-documents";
import { lireObjet } from "../storage";
import type { LogoDocument } from "../pdf/document-commun";
import { logger } from "../logger";

// Cas particulier : à la création, l'entreprise n'existe pas encore, donc
// withEntreprise() (qui exige une adhésion préexistante) ne peut pas s'appliquer.
// Cette fonction gère elle-même sa transaction et fixe le contexte RLS dès que
// l'entreprise existe, avant toute écriture sur une table à entreprise_id.
export async function creerEntreprise(
  data: { nom: string; siret?: string; adresse?: string; telephone?: string; email?: string; iban?: string },
  utilisateur: { id?: string; email?: string; nom?: string }
) {
  return db.transaction(async (tx) => {
    const [entreprise] = await tx.insert(entreprises).values(data).returning();

    let utilisateurId = utilisateur.id;
    if (!utilisateurId) {
      if (!utilisateur.email) throw new Error("email requis pour créer un nouvel utilisateur");
      // **`returning()` NU RAMENAIT LA LIGNE ENTIÈRE**, condensat compris — et
      // `RETURNING` exige le droit de lire les colonnes rendues. Depuis M9, le
      // rôle applicatif ne l'a plus sur `password_hash` : sans cette liste
      // explicite, créer une entreprise échouerait. On ne demande que ce qu'on
      // utilise, ce qui est de toute façon la règle.
      const [u] = await tx
        .insert(users)
        .values({ email: utilisateur.email, nom: utilisateur.nom })
        .returning({ id: users.id });
      utilisateurId = u.id;
    }

    // Contexte RLS fixé dès maintenant — obligatoire avant toute écriture sur
    // membres_entreprise / entreprise_compteurs (FORCE ROW LEVEL SECURITY).
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entreprise.id}, true)`);

    await tx.insert(membresEntreprise).values({
      entrepriseId: entreprise.id,
      utilisateurId,
      role: "proprietaire",
    });

    // Provisioning atomique du compteur — ON CONFLICT DO NOTHING pour rester
    // idempotent si la fonction était rappelée avec la même entreprise (ne devrait
    // pas arriver en usage normal, mais sans risque de double-provisioning).
    await tx.insert(entrepriseCompteurs).values({ entrepriseId: entreprise.id }).onConflictDoNothing();

    return { entreprise, utilisateurId };
  });
}

/** L'entreprise active, telle que ses écrans de réglages la lisent. */
export async function getEntreprise(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select().from(entreprises).where(eq(entreprises.id, ctx.entrepriseId)).limit(1);
    return e ?? null;
  });
}

/**
 * Met à jour les réglages de l'entreprise.
 *
 * Le nombre d'équipes est borné ici en plus de la contrainte de base (migration
 * 0019) : zéro équipe rendrait tout jour indisponible et le patron ne pourrait
 * plus rien envoyer, sans qu'aucun écran ne lui dise pourquoi.
 */
/**
 * Met à jour l'identité de l'entreprise.
 *
 * Les coordonnées (adresse, SIRET, téléphone, e-mail, IBAN) se saisissent
 * depuis l'en-tête du devis : c'est là que le patron les voit imprimées, donc
 * là qu'il remarque qu'elles manquent. Sans IBAN, son client reçoit un devis
 * qu'il ne peut pas payer — et jusqu'ici aucun écran ne les demandait.
 */
export async function mettreAJourEntreprise(
  ctx: Ctx,
  data: {
    nom?: string;
    nombreEquipes?: number;
    periodiciteTva?: "mensuelle" | "trimestrielle";
    adresse?: string | null;
    siret?: string | null;
    telephone?: string | null;
    email?: string | null;
    iban?: string | null;
    formeJuridique?: string | null;
    regimeTva?: "assujettie" | "franchise";
    numeroTva?: string | null;
    titulaireCompte?: string | null;
    /**
     * Les conditions imprimées sur le devis (migration 0040).
     *
     * **Toutes passent par `normaliserConditions`**, jamais crues sur parole :
     * une adresse d'action se tape, et un acompte de 4 000 % s'imprimerait sur
     * un document que le client garde. La base porte les mêmes bornes, ceinture
     * et bretelles (`src/lib/conditions-documents.ts`).
     */
    conditions?: ConditionsLues;
    /**
     * Son message au client (migration 0062).
     *
     * **`null` REMET celui d'Atlas**, une chaîne vide aussi : c'est ainsi qu'il
     * revient au message d'origine sans avoir à le retaper de mémoire.
     */
    messageClient?: string | null;
    /**
     * L'allure de ses documents (migration 0063).
     *
     * **`null` REMET celle d'aujourd'hui** — les trois colonnes repassent à
     * vide, et la fabrique de PDF reprend le chemin d'avant le 23 août 2026.
     * C'est ce que fait son bouton « Revenir aux réglages d'aujourd'hui ».
     */
    allure?: Allure | null;
    /**
     * Son logo, déjà déposé dans le stockage — ou `null` pour l'enlever.
     *
     * **On ne reçoit ici que la CLEF, jamais les octets.** Écrire l'image et
     * écrire la ligne sont deux gestes : les mêler ferait une transaction qui
     * tient ouverte le temps d'un téléversement.
     */
    logo?: { storageKey: string; mime: string } | null;
  }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const valeurs: Record<string, unknown> & { updatedAt: Date } = { updatedAt: new Date() };
    if (data.nom !== undefined) valeurs.nom = data.nom;
    for (const champ of [
      "adresse", "siret", "telephone", "email", "iban",
      "formeJuridique", "numeroTva", "titulaireCompte",
    ] as const) {
      // Une chaîne vide vaut « effacé », pas « inchangé » : le patron doit
      // pouvoir retirer un SIRET saisi de travers.
      if (data[champ] !== undefined) valeurs[champ] = data[champ]?.trim() || null;
    }
    if (data.conditions !== undefined) {
      const c = normaliserConditions(data.conditions);
      valeurs.validiteDevisJours = c.validiteJours;
      valeurs.acomptePourcent = c.acomptePourcent;
      valeurs.delaiPaiementJours = c.delaiPaiementJours;
      valeurs.moyensPaiement = c.moyensPaiement;
      valeurs.rappelerPenalitesDevis = c.rappelerPenalites;
      valeurs.textePiedDocuments = c.textePied;
    }

    // **Le message est REFUSÉ ici aussi, pas seulement à l'écran.** La même
    // fonction sert les deux (`refusDuMessage`) : une action serveur qui
    // accepterait ce que l'écran refuse laisserait passer un message sans lien
    // — par une adresse tapée à la main, ou par un écran resté ouvert depuis
    // une version d'avant. Un refus se garde au plus près de la base.
    if (data.messageClient !== undefined) {
      const texte = data.messageClient?.trim() ?? "";
      // Vide = il revient au message d'Atlas. Ce n'est pas un refus : c'est le
      // seul moyen de retrouver l'original sans le retaper de mémoire.
      // **Le texte d'Atlas retapé à l'identique reste « celui d'Atlas ».** Sans
      // cette ligne, un aller-retour par « Remettre celui d'Atlas » figerait
      // l'entreprise sur la version du jour : une correction ultérieure ne
      // l'atteindrait plus, et personne ne s'en apercevrait.
      if (texte === "" || texte === MESSAGE_PAR_DEFAUT.trim()) valeurs.messageClient = null;
      else if (refusDuMessage(texte) === null) valeurs.messageClient = texte;
      // Sinon : on n'écrit rien. Le réglage reste celui d'avant, et l'écran a
      // déjà dit pourquoi — lever ici rendrait un identifiant opaque au patron.
    }

    if (data.allure !== undefined) {
      // **Rien n'est cru sur parole** : `normaliserAllure` retient une couleur
      // qui s'écrit et une typographie qui existe, et retombe sur le défaut
      // sinon. La base porte le même `CHECK` sur la forme des couleurs —
      // ceinture et bretelles, comme pour les conditions.
      const a = data.allure === null ? null : normaliserAllure(data.allure);
      // **Le défaut s'écrit VIDE, pas en clair.** Poser « #ece9e1 » en base
      // figerait ses documents sur le crème d'aujourd'hui : le jour où la
      // charte bougerait, ses devis ne suivraient plus, et personne ne saurait
      // qu'un réglage jamais touché en est la cause.
      const rienDeChoisi = a === null || estLAllureParDefaut(a);
      valeurs.docTypographie = rienDeChoisi ? null : a.typographie;
      valeurs.docFond = rienDeChoisi ? null : a.fond;
      valeurs.docAccent = rienDeChoisi ? null : a.accent;
    }

    if (data.logo !== undefined) {
      valeurs.logoStorageKey = data.logo?.storageKey ?? null;
      valeurs.logoMime = data.logo?.mime ?? null;
    }

    // Le régime n'est PAS traité comme les autres : il n'a pas de « vide ». Une
    // entreprise est assujettie ou en franchise, jamais ni l'un ni l'autre — et
    // la base le refuserait (contrainte `entreprises_regime_tva_ck`).
    if (data.regimeTva !== undefined) valeurs.regimeTva = data.regimeTva;
    if (data.nombreEquipes !== undefined) {
      valeurs.nombreEquipes = Math.min(20, Math.max(1, Math.trunc(data.nombreEquipes)));
    }
    // **Une valeur inattendue est ignorée, jamais écrite.** La base porte déjà
    // un `CHECK`, mais il lèverait une exception — et le message d'une exception
    // levée par une action serveur n'atteint jamais l'écran du patron
    // (`AGENTS.md`). Le refus se fait donc ici, en silence et sans casse : la
    // périodicité reste celle d'avant, et le réglage n'a simplement pas bougé.
    if (data.periodiciteTva === "mensuelle" || data.periodiciteTva === "trimestrielle") {
      valeurs.periodiciteTva = data.periodiciteTva;
    }
    const [e] = await tx
      .update(entreprises)
      .set(valeurs)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .returning();
    return e ?? null;
  });
}

/**
 * L'allure des documents de l'entreprise — ou `null` si elle n'a rien réglé.
 *
 * **Elle se lit sur la TRANSACTION en cours**, pas par une seconde connexion :
 * les PDF se composent à l'intérieur d'un `withEntreprise`, et rouvrir un
 * contexte d'isolation à l'intérieur d'un autre est le genre de chose qui
 * marche jusqu'au jour où elle ne marche plus.
 *
 * **`null` veut dire « comme aujourd'hui »** : la fabrique de PDF reprend alors
 * exactement les couleurs et les polices d'avant le 23 août 2026.
 */
export async function allureDesDocuments(
  tx: { select: typeof db.select },
  entrepriseId: string
): Promise<{ allure: Allure | null; logo: LogoDocument | null }> {
  const [e] = await tx
    .select({
      typographie: entreprises.docTypographie,
      fond: entreprises.docFond,
      accent: entreprises.docAccent,
      logoStorageKey: entreprises.logoStorageKey,
      logoMime: entreprises.logoMime,
    })
    .from(entreprises)
    .where(eq(entreprises.id, entrepriseId))
    .limit(1);
  if (!e) return { allure: null, logo: null };

  // Rien de réglé : on rend `null` plutôt que le défaut, pour que la fabrique
  // reprenne le chemin d'avant — celui qu'aucun contrôle d'apparence ne doit
  // voir changer.
  const allure =
    !e.typographie && !e.fond && !e.accent
      ? null
      : normaliserAllure({
          typographie: e.typographie ?? undefined,
          fond: e.fond ?? undefined,
          accent: e.accent ?? undefined,
        });

  return { allure, logo: await logoLu(e.logoStorageKey, e.logoMime) };
}

/**
 * Le logo lu dans le stockage — ou `null`, quoi qu'il arrive.
 *
 * **Un logo introuvable ne doit PAS empêcher le devis de sortir.** Le
 * compartiment peut avoir été vidé, la clef écrite par une autre instance : le
 * document part alors sans logo, ce qui est très largement préférable à un
 * client qui n'a pas de devis du tout. Mais l'incident se journalise — sans
 * quoi personne ne saurait jamais pourquoi le logo a disparu de ses documents
 * (`AGENTS.md` : un défaut muet se rend d'abord bavard).
 */
async function logoLu(
  storageKey: string | null,
  mime: string | null
): Promise<LogoDocument | null> {
  if (!storageKey || !mime) return null;
  try {
    return { octets: await lireObjet(storageKey), mime };
  } catch (err) {
    logger.error("Logo de l'entreprise illisible, document composé sans lui", {
      storageKey,
      erreur: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
