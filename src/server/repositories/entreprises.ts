import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { entreprises, entrepriseCompteurs, users, membresEntreprise } from "../db/schema";
import type { Ctx } from "./context";
import { normaliserConditions, type ConditionsLues } from "@/lib/conditions-documents";
import { refusDuMessage, MESSAGE_PAR_DEFAUT } from "@/lib/message-client";
import {
  allureDepuisColonnes,
  estLAllureParDefaut,
  normaliserAllure,
  type Allure,
} from "@/lib/allure-documents";
import { FORMATS_NUMERO } from "@/lib/numero-documents";
import { MAX_EQUIPES, MAX_SALARIES } from "@/lib/equipes";
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
/**
 * Les coordonnées bancaires vont-elles VRAIMENT changer ?
 *
 * **Comparé à ce qui est en base, jamais à ce que l'écran renvoie.** Un écran
 * qui réenvoie tous ses champs à chaque enregistrement — ce que fait celui de
 * l'identité — ferait sinon réclamer un mot de passe pour une virgule dans
 * l'adresse. La garde ne doit se déclencher que sur un vrai changement, sinon
 * elle apprend à être ignorée (`CLAUDE.md` §4 ter).
 *
 * Même normalisation que l'écriture — `trim()` puis `|| null` — sans quoi une
 * espace en fin de saisie passerait pour un changement.
 */
export async function coordonneesBancairesChangent(
  ctx: Ctx,
  data: { iban?: string; titulaireCompte?: string }
): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({ iban: entreprises.iban, titulaireCompte: entreprises.titulaireCompte })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    const normaliser = (v: string | null | undefined) => v?.trim() || null;
    if (data.iban !== undefined && normaliser(data.iban) !== normaliser(ligne?.iban)) return true;
    if (
      data.titulaireCompte !== undefined &&
      normaliser(data.titulaireCompte) !== normaliser(ligne?.titulaireCompte)
    ) {
      return true;
    }
    return false;
  });
}

export async function mettreAJourEntreprise(
  ctx: Ctx,
  data: {
    nom?: string;
    nombreEquipes?: number;
    nombreSalaries?: number;
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
     * Le capital social et le RCS (migration 0072) — n'ont de sens que pour
     * une société (`formeADuCapital`), jamais pour une EI ou une
     * micro-entreprise. Voir `src/lib/mentions-legales.ts`.
     */
    capitalSocial?: string | null;
    villeRcs?: string | null;
    /** Où — ou si — les trois mentions s'impriment. Par défaut « aucune ». */
    mentionsLegalesPosition?: "sous_nom" | "bas" | "aucune";
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
    /**
     * Le format de ses numéros (migration 0066).
     *
     * **Rien n'est cru sur parole** : une clef inconnue est ignorée, et le
     * réglage reste celui d'avant. Écrire n'importe quoi ici ferait des numéros
     * que personne n'a choisis sur des documents qui engagent — et un numéro
     * parti chez un client ne se réécrit pas.
     */
    formatNumero?: string | null;
  }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const valeurs: Record<string, unknown> & { updatedAt: Date } = { updatedAt: new Date() };
    if (data.nom !== undefined) valeurs.nom = data.nom;
    for (const champ of [
      "adresse", "siret", "telephone", "email", "iban",
      "formeJuridique", "numeroTva", "titulaireCompte", "villeRcs",
    ] as const) {
      // Une chaîne vide vaut « effacé », pas « inchangé » : le patron doit
      // pouvoir retirer un SIRET saisi de travers.
      if (data[champ] !== undefined) valeurs[champ] = data[champ]?.trim() || null;
    }
    // **Le capital n'est pas un texte : un « 1 500 € » saisi de travers ne
    // s'écrit pas en base**, sans quoi il romprait le calcul des mentions
    // légales (`enEuros` sur du texte). Une saisie qu'on ne comprend pas
    // laisse le capital tel qu'il était plutôt que d'écrire n'importe quoi —
    // même règle que la périodicité de TVA plus bas.
    if (data.capitalSocial !== undefined) {
      const brut = data.capitalSocial?.trim() ?? "";
      if (brut === "") {
        valeurs.capitalSocial = null;
      } else {
        const nombre = Number(brut.replace(",", "."));
        if (Number.isFinite(nombre) && nombre >= 0) valeurs.capitalSocial = nombre.toFixed(2);
      }
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

    if (data.formatNumero !== undefined) {
      // `null` remet le format par défaut ; une clef inconnue ne rentre pas.
      if (data.formatNumero === null) valeurs.formatNumero = null;
      else if (FORMATS_NUMERO.some((f) => f.clef === data.formatNumero)) {
        valeurs.formatNumero = data.formatNumero;
      }
    }

    if (data.logo !== undefined) {
      valeurs.logoStorageKey = data.logo?.storageKey ?? null;
      valeurs.logoMime = data.logo?.mime ?? null;
    }

    // Le régime n'est PAS traité comme les autres : il n'a pas de « vide ». Une
    // entreprise est assujettie ou en franchise, jamais ni l'un ni l'autre — et
    // la base le refuserait (contrainte `entreprises_regime_tva_ck`).
    if (data.regimeTva !== undefined) valeurs.regimeTva = data.regimeTva;
    if (data.mentionsLegalesPosition !== undefined) {
      valeurs.mentionsLegalesPosition = data.mentionsLegalesPosition;
    }
    if (data.nombreEquipes !== undefined) {
      valeurs.nombreEquipes = Math.min(MAX_EQUIPES, Math.max(1, Math.trunc(data.nombreEquipes)));
    }
    // **Le plancher est ZÉRO ici, et un pour les équipes** : un artisan seul n'a
    // aucun salarié, alors qu'il mène toujours au moins un chantier à la fois.
    // Aligner les deux bornes lui ferait apparaître une case « Salarié 1 » à
    // cocher sur chaque demi-journée, pour se nommer lui-même.
    if (data.nombreSalaries !== undefined) {
      valeurs.nombreSalaries = Math.min(MAX_SALARIES, Math.max(0, Math.trunc(data.nombreSalaries)));
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

  return { allure: allureLue(e), logo: await logoLu(e.logoStorageKey, e.logoMime) };
}

/**
 * L'allure SANS le logo — pour la page web que le client ouvre.
 *
 * **Pourquoi une seconde porte plutôt que `allureDesDocuments`.** Celle-là va
 * chercher le logo dans le stockage : un aller-retour réseau à chaque
 * consultation, pour une image que la page n'affiche pas. Sur un téléphone au
 * bord d'une route, cela se paie en secondes d'attente devant une facture.
 *
 * **La RÈGLE, elle, n'est pas dupliquée** : les deux passent par `allureLue`.
 */
export async function allureSeuleDesDocuments(
  tx: { select: typeof db.select },
  entrepriseId: string
): Promise<Allure | null> {
  const [e] = await tx
    .select({
      typographie: entreprises.docTypographie,
      fond: entreprises.docFond,
      accent: entreprises.docAccent,
    })
    .from(entreprises)
    .where(eq(entreprises.id, entrepriseId))
    .limit(1);
  return e ? allureLue(e) : null;
}

/**
 * Ce que les trois colonnes de l'ENTREPRISE valent, ou `null`.
 *
 * **Rien de réglé rend `null`, jamais le défaut.** La fabrique reprend alors le
 * chemin d'avant — celui qu'aucun contrôle d'apparence ne doit voir changer, et
 * c'est ce qui garantit que le réglage neuf ne repeint rien tant qu'il n'y a pas
 * touché (`allure-documents.ts`, sa règle du 23 août 2026).
 *
 * **La lecture elle-même vit dans `src/lib`** : la facture porte les mêmes trois
 * colonnes depuis la migration 0074, et deux lectures écrites séparément
 * auraient fini par ne plus filtrer pareil.
 */
const allureLue = allureDepuisColonnes;

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
/**
 * Le format de numéro de l'entreprise — ou `null` si elle n'a rien réglé.
 *
 * **Lue sur la TRANSACTION en cours**, comme l'allure : les numéros
 * s'attribuent à l'intérieur d'un `withEntreprise`, et rouvrir un contexte
 * d'isolation dans un autre est le genre de chose qui marche jusqu'au jour où
 * elle ne marche plus.
 */
export async function formatNumeroDe(
  tx: { select: typeof db.select },
  entrepriseId: string
): Promise<string | null> {
  const [e] = await tx
    .select({ format: entreprises.formatNumero })
    .from(entreprises)
    .where(eq(entreprises.id, entrepriseId))
    .limit(1);
  return e?.format ?? null;
}

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
