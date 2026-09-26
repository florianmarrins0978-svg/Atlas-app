import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, contratsEntretien, entreprises, parametresChiffrage } from "../db/schema";
import type { Ctx } from "./context";
import { COLONNES_EMETTEUR, identiteDeLEmetteur } from "./factures";
import { allureDesDocuments } from "./entreprises";
import { composerContratPdf } from "../pdf/contrat-pdf";
import { nomDuChantier } from "@/lib/nom-chantier";
import {
  ceQuiManque,
  clePassage,
  passagesArrives,
  relireContrat,
  type ContratSaisi,
  type FacturationContrat,
  type PeriodeContrat,
  type PrestationContrat,
} from "@/lib/contrats-entretien";

/**
 * LE DÉPÔT DES CONTRATS D'ENTRETIEN.
 *
 * **Toutes les règles sont dans `src/lib/contrats-entretien.ts`** : ce fichier
 * lit, écrit, et revalide par `relireContrat` ce que l'écran envoie. Les refus
 * attendus se RENDENT en valeur, ils ne lèvent pas : le message d'une
 * exception d'action serveur n'arrive jamais jusqu'au patron (`AGENTS.md`).
 */

/** Le taux des réglages quand l'entreprise n'en a pas posé, le même que la facture. */
const TAUX_TVA_PAR_DEFAUT = "20.00";

export type StatutContrat = "brouillon" | "envoye" | "accepte" | "refuse";

export type ContratEntretien = {
  id: string;
  clientId: string;
  statut: StatutContrat;
  prestations: PrestationContrat[];
  periode: PeriodeContrat;
  reconduit: boolean;
  facturation: FacturationContrat;
  avecCompteRendu: boolean;
  tauxTva: string;
  jeton: string | null;
  envoyeLe: Date | null;
  reponduLe: Date | null;
};

type Ligne = typeof contratsEntretien.$inferSelect;

function versContrat(l: Ligne): ContratEntretien {
  return {
    id: l.id,
    clientId: l.clientId,
    statut: l.statut,
    prestations: l.prestations,
    periode: { debut: l.debut, dureeMois: l.dureeMois },
    reconduit: l.reconduit,
    facturation: l.facturation,
    avecCompteRendu: l.avecCompteRendu,
    tauxTva: l.tauxTva,
    jeton: l.jeton,
    envoyeLe: l.envoyeLe,
    reponduLe: l.reponduLe,
  };
}

/** Le dernier contrat du client, quel que soit son état. NULL : il n'en a pas. */
export async function dernierContratDuClient(ctx: Ctx, clientId: string): Promise<ContratEntretien | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [l] = await tx
      .select()
      .from(contratsEntretien)
      .where(and(eq(contratsEntretien.entrepriseId, ctx.entrepriseId), eq(contratsEntretien.clientId, clientId)))
      .orderBy(desc(contratsEntretien.createdAt))
      .limit(1);
    return l ? versContrat(l) : null;
  });
}

export type RefusContrat = { ok: false; refus: string };

/**
 * Enregistre le brouillon : le crée s'il n'existe pas, le remplace sinon.
 *
 * **Un contrat parti ne se modifie plus** : le client a lu ce qui est parti,
 * et l'empreinte le prouve. Le modifier demanderait un nouveau contrat.
 */
export async function enregistrerContrat(
  ctx: Ctx,
  params: { id: string | null; clientId: string; saisi: ContratSaisi }
): Promise<{ ok: true; contrat: ContratEntretien } | RefusContrat> {
  const relu = relireContrat(params.saisi);
  if (!relu.ok) return relu;
  const c = relu.contrat;

  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [client] = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, params.clientId), eq(clients.entrepriseId, ctx.entrepriseId), isNull(clients.deletedAt)))
      .limit(1);
    if (!client) return { ok: false as const, refus: "Ce client n'existe plus." };

    const champs = {
      prestations: c.prestations,
      debut: c.periode.debut,
      dureeMois: c.periode.dureeMois,
      reconduit: c.reconduit,
      facturation: c.facturation,
      avecCompteRendu: c.avecCompteRendu,
      updatedAt: new Date(),
    };

    if (params.id) {
      const [avant] = await tx
        .select({ statut: contratsEntretien.statut, clientId: contratsEntretien.clientId })
        .from(contratsEntretien)
        .where(eq(contratsEntretien.id, params.id))
        .limit(1);
      if (!avant || avant.clientId !== params.clientId) return { ok: false as const, refus: "Ce contrat n'existe plus." };
      if (avant.statut !== "brouillon") {
        return { ok: false as const, refus: "Ce contrat est parti chez le client : il ne se modifie plus." };
      }
      const [l] = await tx
        .update(contratsEntretien)
        .set(champs)
        .where(and(eq(contratsEntretien.id, params.id), eq(contratsEntretien.statut, "brouillon")))
        .returning();
      return { ok: true as const, contrat: versContrat(l) };
    }

    const [reglage] = await tx
      .select({ taux: parametresChiffrage.tauxTvaDefaut })
      .from(parametresChiffrage)
      .where(eq(parametresChiffrage.entrepriseId, ctx.entrepriseId))
      .limit(1);
    const [l] = await tx
      .insert(contratsEntretien)
      .values({
        ...champs,
        entrepriseId: ctx.entrepriseId,
        clientId: params.clientId,
        tauxTva: reglage?.taux ?? TAUX_TVA_PAR_DEFAUT,
        createdBy: ctx.utilisateurId,
      })
      .returning();
    return { ok: true as const, contrat: versContrat(l) };
  });
}

/** Ce qui part chez le client, sérialisé dans un ordre fixe : c'est ce que l'empreinte prouve. */
function empreinteDuContrat(l: Ligne): string {
  const contenu = JSON.stringify({
    client: l.clientId,
    prestations: l.prestations,
    debut: l.debut,
    dureeMois: l.dureeMois,
    reconduit: l.reconduit,
    facturation: l.facturation,
    avecCompteRendu: l.avecCompteRendu,
    tauxTva: l.tauxTva,
  });
  return createHash("sha256").update(contenu).digest("hex");
}

/**
 * Fige le contrat et lui donne son lien. **Idempotent** : un second appui
 * (réseau lent, double toucher) rend le MÊME jeton, jamais un second lien.
 */
export async function envoyerContrat(
  ctx: Ctx,
  id: string,
  maintenant: Date = new Date()
): Promise<{ ok: true; jeton: string } | RefusContrat> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [l] = await tx.select().from(contratsEntretien).where(eq(contratsEntretien.id, id)).limit(1);
    if (!l) return { ok: false as const, refus: "Ce contrat n'existe plus." };
    if (l.statut !== "brouillon") {
      return l.jeton ? { ok: true as const, jeton: l.jeton } : { ok: false as const, refus: "Ce contrat est déjà parti." };
    }
    const manque = ceQuiManque(l.prestations, { debut: l.debut, dureeMois: l.dureeMois });
    if (manque) return { ok: false as const, refus: manque };

    const jeton = randomBytes(32).toString("base64url");
    await tx
      .update(contratsEntretien)
      .set({ statut: "envoye", jeton, empreinte: empreinteDuContrat(l), envoyeLe: maintenant, updatedAt: maintenant })
      .where(and(eq(contratsEntretien.id, id), eq(contratsEntretien.statut, "brouillon")));
    return { ok: true as const, jeton };
  });
}

/** Ce que la page du client montre, et d'où son PDF se compose. */
export type ContratPourClient = {
  contrat: ContratEntretien;
  entrepriseNom: string;
  clientNom: string;
  clientCivilite: "mr" | "mme" | null;
};

/**
 * Lit un contrat par son lien, SANS compte : le jeton exact ouvre la ligne
 * (`contrats_entretien_lecture_par_jeton`), et seulement elle. Un brouillon
 * n'a pas de jeton, donc ne se lit jamais d'ici.
 */
export async function lireContratParJeton(jeton: string): Promise<ContratPourClient | null> {
  if (!jeton) return null;
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_contrat', ${jeton}, true)`);
    const [l] = await tx.select().from(contratsEntretien).where(eq(contratsEntretien.jeton, jeton)).limit(1);
    if (!l) return null;
    // Le client vit sous l'isolation de son entreprise : on la pose, comme la
    // réponse d'un devis, d'après la ligne que le jeton vient d'ouvrir.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${l.entrepriseId}, true)`);
    const [client] = await tx
      .select({ nom: clients.nom, civilite: clients.civilite })
      .from(clients)
      .where(eq(clients.id, l.clientId))
      .limit(1);
    const [e] = await tx.select({ nom: entreprises.nom }).from(entreprises).where(eq(entreprises.id, l.entrepriseId)).limit(1);
    return {
      contrat: versContrat(l),
      entrepriseNom: e?.nom ?? "",
      clientNom: client?.nom ?? "",
      clientCivilite: client?.civilite ?? null,
    };
  });
}

/**
 * La réponse du client. **Une seule** : un contrat accepté ne se refuse pas
 * ensuite par le même lien, et l'inverse non plus. Ce qui prouve l'accord :
 * l'empreinte posée à l'envoi, l'heure, l'adresse et le navigateur.
 */
export async function repondreAuContrat(
  jeton: string,
  reponse: { decision: "accepte" | "refuse"; adresseIp?: string | null; agent?: string | null },
  maintenant: Date = new Date()
): Promise<{ ok: true } | { ok: false; motif: "introuvable" | "deja_repondu" }> {
  if (!jeton) return { ok: false, motif: "introuvable" };
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_contrat', ${jeton}, true)`);
    const [l] = await tx
      .select({ id: contratsEntretien.id, statut: contratsEntretien.statut, entrepriseId: contratsEntretien.entrepriseId })
      .from(contratsEntretien)
      .where(eq(contratsEntretien.jeton, jeton))
      .limit(1);
    if (!l) return { ok: false as const, motif: "introuvable" as const };
    if (l.statut !== "envoye") return { ok: false as const, motif: "deja_repondu" as const };
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${l.entrepriseId}, true)`);
    await tx
      .update(contratsEntretien)
      .set({
        statut: reponse.decision,
        reponduLe: maintenant,
        reponseAdresseIp: reponse.adresseIp ?? null,
        reponseAgent: reponse.agent?.slice(0, 500) ?? null,
        updatedAt: maintenant,
      })
      .where(and(eq(contratsEntretien.id, l.id), eq(contratsEntretien.statut, "envoye")));
    return { ok: true as const };
  });
}

function jourIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Pose dans « Sans date » les passages ARRIVÉS des contrats acceptés : un
 * chantier par passage, rattaché à son contrat par sa clé.
 *
 * **Rejouable sans crainte** : l'index unique (contrat, passage) refuse le
 * doublon et `ON CONFLICT DO NOTHING` l'ignore. Deux ouvertures du planning au
 * même instant posent donc chaque passage une fois, et une seule.
 *
 * Rend le nombre de passages posés par CET appel.
 */
export async function poserLesPassagesArrives(ctx: Ctx, aujourdhui: string): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // **Un essai terminé met la transaction en lecture seule** (`withEntreprise`).
    // Les passages n'arrivent pas, et le planning s'ouvre quand même : poser
    // n'est pas ce qu'il est venu faire, et le refus ferait tomber l'écran.
    const mode = await tx.execute(sql`SELECT current_setting('transaction_read_only') AS lecture`);
    if (mode.rows[0]?.lecture === "on") return 0;

    const acceptes = await tx
      .select({
        contrat: contratsEntretien,
        clientNom: clients.nom,
        clientCivilite: clients.civilite,
        clientAdresse: clients.adresse,
      })
      .from(contratsEntretien)
      .innerJoin(clients, eq(clients.id, contratsEntretien.clientId))
      .where(
        and(
          eq(contratsEntretien.entrepriseId, ctx.entrepriseId),
          eq(contratsEntretien.statut, "accepte"),
          isNull(clients.deletedAt)
        )
      );

    let poses = 0;
    for (const a of acceptes) {
      const l = a.contrat;
      if (!l.reponduLe) continue;
      const dus = passagesArrives(l.prestations, { debut: l.debut, dureeMois: l.dureeMois }, aujourdhui, jourIso(l.reponduLe));
      if (dus.length === 0) continue;
      const nomClient = nomDuChantier({
        nomClient: a.clientNom,
        civilite: a.clientCivilite ?? undefined,
        adresseChantier: a.clientAdresse,
        jour: aujourdhui,
      });
      const inseres = await tx
        .insert(chantiers)
        .values(
          dus.map((d) => ({
            entrepriseId: ctx.entrepriseId,
            clientId: l.clientId,
            // « Mme Costa, Tonte et ébarbage » : au planning comme dans
            // Terminés, il lit QUI et QUOI sans ouvrir.
            nom: `${nomClient}, ${l.prestations[d.prestation]?.libelle ?? "entretien"}`,
            adresseChantier: a.clientAdresse ?? undefined,
            contratEntretienId: l.id,
            contratPassage: clePassage(d),
            createdBy: ctx.utilisateurId,
            updatedBy: ctx.utilisateurId,
          }))
        )
        .onConflictDoNothing()
        .returning({ id: chantiers.id });
      poses += inseres.length;
    }
    return poses;
  });
}

/** Le PDF du contrat, pour l'aperçu du patron comme pour le client. */
async function pdfDuContrat(
  tx: Parameters<Parameters<typeof withEntreprise>[2]>[0],
  l: Ligne,
  maintenant: Date
): Promise<Uint8Array> {
  const [e] = await tx.select(COLONNES_EMETTEUR).from(entreprises).where(eq(entreprises.id, l.entrepriseId)).limit(1);
  const [client] = await tx
    .select({ nom: clients.nom, civilite: clients.civilite, adresse: clients.adresse, telephone: clients.telephone })
    .from(clients)
    .where(eq(clients.id, l.clientId))
    .limit(1);
  const habillage = await allureDesDocuments(tx, l.entrepriseId);
  return composerContratPdf(
    {
      ...identiteDeLEmetteur(e),
      clientNom: client?.nom ?? null,
      clientCivilite: client?.civilite ?? null,
      clientAdresse: client?.adresse ?? null,
      clientTelephone: client?.telephone ?? null,
      adresseChantier: client?.adresse ?? null,
      prestations: l.prestations,
      periode: { debut: l.debut, dureeMois: l.dureeMois },
      reconduit: l.reconduit,
      facturation: l.facturation,
      tauxTva: l.tauxTva,
      statut: l.statut,
      dateDuDocument: jourIso(l.envoyeLe ?? maintenant),
    },
    habillage
  );
}

export async function pdfDuContratPourLePatron(ctx: Ctx, id: string, maintenant: Date = new Date()): Promise<Uint8Array | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [l] = await tx.select().from(contratsEntretien).where(eq(contratsEntretien.id, id)).limit(1);
    return l ? pdfDuContrat(tx, l, maintenant) : null;
  });
}

export async function pdfDuContratParJeton(jeton: string, maintenant: Date = new Date()): Promise<Uint8Array | null> {
  if (!jeton) return null;
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.jeton_contrat', ${jeton}, true)`);
    const [l] = await tx.select().from(contratsEntretien).where(eq(contratsEntretien.jeton, jeton)).limit(1);
    if (!l) return null;
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${l.entrepriseId}, true)`);
    return pdfDuContrat(tx, l, maintenant);
  });
}
