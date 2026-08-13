import { and, eq, isNull, isNotNull, sql, desc } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, entreprises, factures } from "../db/schema";
import {
  cleCreneau,
  compterOccupation,
  creneauxDuChantier,
  departPossible,
  dureeEnDemiJournees,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
  type Moment,
} from "../disponibilites";
import { equipes } from "../db/schema";
import type { Ctx } from "./context";

/**
 * Le créneau choisi n'est plus libre — quelqu'un l'a pris entre l'affichage et
 * l'appui.
 *
 * Une classe plutôt qu'un booléen : l'écran doit pouvoir DIRE lequel, sinon le
 * patron réessaie le même et ne comprend pas pourquoi rien ne se passe.
 */
export class CreneauIndisponible extends Error {
  constructor(
    readonly jour: string,
    readonly moment: Moment
  ) {
    super(`Le ${moment === "matin" ? "matin" : "après-midi"} du ${jour} vient d'être pris.`);
    this.name = "CreneauIndisponible";
  }
}

/**
 * L'identifiant de l'équipe de ce rang, créée au besoin.
 *
 * Créée ICI et pas à l'affichage : c'est le seul instant où l'on a besoin
 * d'une clé étrangère. Le `nom` reste `null` — on enregistre qu'une équipe de
 * rang N existe, jamais qu'elle s'appelle « Équipe B ».
 */
async function idEquipeDeRang(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  entrepriseId: string,
  rang: number
): Promise<string> {
  const borne = Math.min(20, Math.max(1, Math.trunc(rang)));
  const [existante] = await tx
    .select({ id: equipes.id })
    .from(equipes)
    .where(and(eq(equipes.entrepriseId, entrepriseId), eq(equipes.rang, borne)))
    .limit(1);
  if (existante) return existante.id;
  const [creee] = await tx
    .insert(equipes)
    .values({ entrepriseId, rang: borne })
    .returning({ id: equipes.id });
  return creee.id;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Le dernier envoi d'un chantier, en sous-requêtes corrélées plutôt qu'en
// jointure : un chantier refusé puis renvoyé porte plusieurs envois, et une
// jointure les remonterait tous, dupliquant la ligne du chantier. Seul le
// dernier décrit où en est le devis aujourd'hui — les précédents sont de
// l'histoire.
const DERNIER_ENVOI = {
  envoiEnvoyeAt: sql<Date | null>`(
    SELECT e.envoye_at FROM envois_devis e
    WHERE e.chantier_id = ${chantiers.id}
    ORDER BY e.envoye_at DESC LIMIT 1
  )`,
  envoiExpireAt: sql<Date | null>`(
    SELECT e.expire_at FROM envois_devis e
    WHERE e.chantier_id = ${chantiers.id}
    ORDER BY e.envoye_at DESC LIMIT 1
  )`,
  envoiReponse: sql<"acceptee" | "refusee" | null>`(
    SELECT e.reponse FROM envois_devis e
    WHERE e.chantier_id = ${chantiers.id}
    ORDER BY e.envoye_at DESC LIMIT 1
  )`,
} as const;

export async function listerChantiers(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(chantiers).where(isNull(chantiers.deletedAt))
  );
}

// Pour l'écran Liste des chantiers : chantier + nom du client + compteur de
// photos + présence d'une note vocale, en une seule requête (sous-requêtes
// corrélées plutôt que N+1). Tri : plus récent en premier — aucun tri métier
// n'existait auparavant pour cet écran (les données simulées n'étaient pas
// triées) ; choix par défaut raisonnable, documenté dans le compte rendu.
export async function listerChantiersPourAffichage(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        adresseChantier: chantiers.adresseChantier,
        clientNom: clients.nom,
        // Sert la date relative des cartes de l'écran d'accueil
        // (« Aujourd'hui », « Hier »). `updatedAt` et non `createdAt` : ce que
        // l'artisan cherche, c'est le chantier qu'il a touché en dernier, pas
        // celui qu'il a ouvert en premier.
        majAt: chantiers.updatedAt,
        informationsVerifieesAt: chantiers.informationsVerifieesAt,
        // **Le jalon qui manquait à la LISTE (13 août 2026).** Sans lui,
        // `getStatutAffiche` ne pouvait pas savoir qu'un devis était écrit, et
        // annonçait « Brouillon » sur un chantier qui n'attendait plus que son
        // envoi. C'est ce que le patron a lu sur sa propre liste.
        // `prixValideAt` sert la REPRISE : sans lui, un chantier chiffré mais
        // sans devis ramènerait le patron à la dictée au lieu de l'écran du
        // prix (`lienDeReprise`).
        prixValideAt: chantiers.prixValideAt,
        devisGenereAt: chantiers.devisGenereAt,
        devisEnvoyeAt: chantiers.devisEnvoyeAt,
        datePlanifiee: chantiers.datePlanifiee,
        termineAt: chantiers.termineAt,
        factureEnvoyeeAt: chantiers.factureEnvoyeeAt,
        photosCount: sql<number>`(
          SELECT COUNT(*)::int FROM photos p
          WHERE p.chantier_id = ${chantiers.id} AND p.deleted_at IS NULL
        )`,
        aUneNoteVocale: sql<boolean>`EXISTS (
          SELECT 1 FROM notes_vocales n WHERE n.chantier_id = ${chantiers.id}
        )`,
        ...DERNIER_ENVOI,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(isNull(chantiers.deletedAt))
      .orderBy(desc(chantiers.createdAt))
  );
}

export async function getChantier(ctx: Ctx, id: string) {
  if (!UUID_RE.test(id)) return null; // format invalide : traité comme introuvable, aucune requête inutile
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select()
      .from(chantiers)
      .where(and(eq(chantiers.id, id), isNull(chantiers.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

// Pour la fiche chantier (hub) : chantier + client + agrégats photos/note vocale
// en une seule requête (même motif que listerChantiersPourAffichage — pas de
// requêtes en cascade). Retourne null si le chantier n'existe pas, est supprimé,
// ou n'appartient pas à l'entreprise du contexte (jamais distingué de "inexistant"
// pour l'appelant — notFound() dans les deux cas, voir la route).
export async function getChantierPourHub(ctx: Ctx, id: string) {
  if (!UUID_RE.test(id)) return null; // format invalide : traité comme introuvable, aucune requête inutile
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const rows = await tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        adresseChantier: chantiers.adresseChantier,
        clientNom: clients.nom,
        informationsVerifieesAt: chantiers.informationsVerifieesAt,
        prixValideAt: chantiers.prixValideAt,
        devisGenereAt: chantiers.devisGenereAt,
        devisEnvoyeAt: chantiers.devisEnvoyeAt,
        datePlanifiee: chantiers.datePlanifiee,
        photosCount: sql<number>`(
          SELECT COUNT(*)::int FROM photos p
          WHERE p.chantier_id = ${chantiers.id} AND p.deleted_at IS NULL
        )`,
        aUneNoteVocale: sql<boolean>`EXISTS (
          SELECT 1 FROM notes_vocales n WHERE n.chantier_id = ${chantiers.id}
        )`,
        ...DERNIER_ENVOI,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(and(eq(chantiers.id, id), isNull(chantiers.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function creerChantier(
  ctx: Ctx,
  data: { nom: string; adresseChantier?: string; clientId?: string | null }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(chantiers)
      .values({
        entrepriseId: ctx.entrepriseId,
        nom: data.nom,
        adresseChantier: data.adresseChantier,
        clientId: data.clientId ?? null,
        createdBy: ctx.utilisateurId,
        updatedBy: ctx.utilisateurId,
      })
      .returning();
    return row;
  });
}

async function marquerJalon(ctx: Ctx, chantierId: string, colonne: "informationsVerifieesAt" | "prixValideAt") {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ [colonne]: new Date(), updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}

export const marquerInformationsVerifiees = (ctx: Ctx, chantierId: string) =>
  marquerJalon(ctx, chantierId, "informationsVerifieesAt");

export const marquerPrixValide = (ctx: Ctx, chantierId: string) => marquerJalon(ctx, chantierId, "prixValideAt");

/**
 * Pose une date à la main, depuis l'écran Planning.
 *
 * **Le créneau est choisi ici, comme il l'est quand un client répond.** Sans
 * cela, un chantier planifié à la main n'aurait ni moment ni durée, donc
 * occuperait la journée entière — et le patron, qui vient justement de gagner
 * la demi-journée, la reperdrait dès qu'il cale un chantier lui-même.
 *
 * Aucun refus ici, délibérément : le patron peut surcharger sa journée s'il le
 * décide. Ce sont ses clients qu'on protège d'une date impossible, pas lui de
 * lui-même. Le créneau retombe alors sur le matin, faute de place.
 */
/**
 * Ce que le patron a choisi en posant un chantier : quand, et par qui.
 *
 * **Poser, c'est dire à la fois QUAND et QUI** — une date sans équipe laisse le
 * travail à moitié fait. `rangEquipe` reste `null` à une seule équipe : il n'y
 * a personne à désigner (`src/lib/equipes.ts`).
 */
export type ChoixDePose = { moment: Moment; rangEquipe: number | null };

export async function planifierChantier(
  ctx: Ctx,
  chantierId: string,
  datePlanifiee: string,
  choix?: ChoixDePose
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const autres = await tx
      .select({
        id: chantiers.id,
        jour: chantiers.datePlanifiee,
        moment: chantiers.creneauDebut,
        duree: chantiers.dureeDemiJournees,
      })
      .from(chantiers)
      .where(
        and(
          eq(chantiers.entrepriseId, ctx.entrepriseId),
          isNull(chantiers.deletedAt),
          isNotNull(chantiers.datePlanifiee)
        )
      );

    const [entreprise] = await tx
      .select({ nombreEquipes: entreprises.nombreEquipes })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);

    const [courant] = await tx
      .select({ duree: chantiers.dureeDemiJournees, dureePrevue: chantiers.dureePrevue })
      .from(chantiers)
      .where(eq(chantiers.id, chantierId))
      .limit(1);
    const duree =
      courant?.duree ??
      dureeEnDemiJournees(courant?.dureePrevue ?? null) ??
      DUREE_PAR_DEFAUT_DEMI_JOURNEES;

    const occupation = compterOccupation(
      autres
        .filter((a) => a.id !== chantierId && a.jour !== null)
        .map((a) => ({
          jour: a.jour as string,
          moment: a.moment === "matin" || a.moment === "apres_midi" ? a.moment : null,
          dureeDemiJournees: a.duree,
        }))
    );
    const nombreEquipes = entreprise?.nombreEquipes ?? 1;
    const automatique = departPossible(datePlanifiee, duree, occupation, nombreEquipes) ?? "matin";

    // **Le choix du patron est REVALIDÉ, jamais cru sur parole.** L'écran ne
    // propose que des demi-journées libres, mais entre l'affichage et l'appui
    // un client a pu retenir ce créneau. Sans ce contrôle, deux chantiers
    // tomberaient sur la même équipe au même moment — et rien ne le dirait.
    let creneauDebut: Moment = automatique;
    if (choix) {
      const tient = creneauxDuChantier({ jour: datePlanifiee, moment: choix.moment }, duree).every(
        (c) => (occupation.get(cleCreneau(c)) ?? 0) < nombreEquipes
      );
      if (!tient) throw new CreneauIndisponible(datePlanifiee, choix.moment);
      creneauDebut = choix.moment;
    }

    // L'équipe n'est enregistrée QUE si elle a été choisie. À une seule équipe,
    // `rangEquipe` vaut `null` : il n'y a personne à désigner, et écrire une
    // ligne « Équipe A » ferait exactement ce que le patron a interdit.
    const equipeId =
      choix?.rangEquipe != null && nombreEquipes > 1
        ? await idEquipeDeRang(tx, ctx.entrepriseId, choix.rangEquipe)
        : undefined;

    const [row] = await tx
      .update(chantiers)
      .set({
        datePlanifiee,
        creneauDebut,
        dureeDemiJournees: duree,
        ...(equipeId ? { equipeId } : {}),
        updatedBy: ctx.utilisateurId,
        updatedAt: new Date(),
      })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}

// Retire la date de planification (« suppression » d'une intervention) — le
// chantier redevient "à planifier" si un devis a déjà été envoyé.
export async function deplanifierChantier(ctx: Ctx, chantierId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ datePlanifiee: null, updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}

// Pour l'écran Planning : chantiers concernés par la planification (devis déjà
// envoyé), avec le nom du client — même motif que listerChantiersPourAffichage.
export async function listerChantiersPourPlanning(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        clientNom: clients.nom,
        devisEnvoyeAt: chantiers.devisEnvoyeAt,
        datePlanifiee: chantiers.datePlanifiee,
        // Le créneau et la durée réservée : lisibles par le patron seul. Deux
        // chantiers peuvent désormais tomber le même jour, et sans cette
        // précision son planning ne lui dirait plus lequel passe en premier.
        creneauDebut: chantiers.creneauDebut,
        dureeDemiJournees: chantiers.dureeDemiJournees,
        // Les deux jalons de fin : sans eux, le planning ne peut pas savoir
        // qu'un chantier a été clôturé et continue de l'afficher comme à venir.
        // C'est ce qui est arrivé jusqu'au 8 août 2026 — voir
        // `src/lib/onglet-chantier.ts`.
        termineAt: chantiers.termineAt,
        factureEnvoyeeAt: chantiers.factureEnvoyeeAt,
        // La durée dictée sert à savoir combien de demi-journées poser quand le
        // chantier n'a pas encore de durée réservée.
        dureePrevue: chantiers.dureePrevue,
        // Le RANG de l'équipe, jamais son identifiant : c'est le rang qui porte
        // la lettre de repli, et l'écran n'a rien à faire d'une clé étrangère.
        rangEquipe: equipes.rang,
        // L'adresse et le téléphone descendent avec la liste, et non derrière un
        // second aller-retour au moment du geste : le patron ouvre « Y aller »
        // sur un chantier, en voiture, souvent sans réseau. Une feuille qui doit
        // aller chercher l'adresse arrive vide exactement là où elle sert.
        adresseChantier: chantiers.adresseChantier,
        clientTelephone: clients.telephone,
        ...DERNIER_ENVOI,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .leftJoin(equipes, eq(chantiers.equipeId, equipes.id))
      .where(and(isNull(chantiers.deletedAt), isNotNull(chantiers.devisEnvoyeAt)))
  );
}

export async function mettreAJourDureeEquipe(
  ctx: Ctx,
  chantierId: string,
  data: { dureePrevue?: string; tailleEquipe?: string }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ ...data, updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row;
  });
}

/**
 * L'adresse du chantier, corrigée depuis le devis.
 *
 * C'est la seule adresse que le client lit sur son devis — et jusqu'ici elle ne
 * se saisissait qu'à la création, une fois pour toutes. Un chiffre de rue faux
 * ne se rattrapait plus.
 */
export async function mettreAJourAdresseChantier(ctx: Ctx, chantierId: string, adresse: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(chantiers)
      .set({ adresseChantier: adresse.trim() || null, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId))
      .returning();
    return row ?? null;
  });
}

/**
 * Retire un chantier de la vue du patron — sans effacer quoi que ce soit.
 *
 * Le patron, le 6 août 2026 : « je veux pouvoir supprimer un chantier mis au
 * planning ». Un essai raté, un doublon, un client qui se désiste : sans ce
 * geste, sa liste se remplit de choses mortes qu'il ne peut plus enlever.
 *
 * **Suppression douce**, comme pour les photos : `deleted_at` est posé, les
 * lignes restent. Une suppression physique emporterait le devis, ses envois et
 * la réponse du client — des traces qui ont valeur de preuve.
 *
 * **Refusée dès qu'une facture est émise.** Une facture est une pièce
 * comptable numérotée : elle figure au relevé de TVA, et rien ne doit pouvoir
 * la faire disparaître d'un glissement du doigt. La correction passe par un
 * avoir, jamais par un effacement (`docs/AGENT.md` §2.3).
 */
export class SuppressionChantierRefusee extends Error {
  constructor(readonly motif: "facture_emise" | "introuvable") {
    super(motif);
    this.name = "SuppressionChantierRefusee";
  }
}

export async function supprimerChantier(ctx: Ctx, chantierId: string): Promise<void> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [chantier] = await tx
      .select()
      .from(chantiers)
      .where(and(eq(chantiers.id, chantierId), isNull(chantiers.deletedAt)))
      .limit(1);
    if (!chantier) throw new SuppressionChantierRefusee("introuvable");

    const [factureEmise] = await tx
      .select({ id: factures.id })
      .from(factures)
      .where(and(eq(factures.chantierId, chantierId), eq(factures.statut, "emise")))
      .limit(1);
    if (factureEmise) throw new SuppressionChantierRefusee("facture_emise");

    await tx
      .update(chantiers)
      .set({ deletedAt: new Date(), updatedBy: ctx.utilisateurId, updatedAt: new Date() })
      .where(eq(chantiers.id, chantierId));
  });
}
