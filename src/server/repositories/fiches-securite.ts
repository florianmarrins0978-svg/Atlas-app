import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import {
  chantiers,
  clients,
  devis,
  entreprises,
  equipes,
  equipesDuChantier,
  fichesSecurite,
  fichesSecuriteMemoire,
  fichesSecuritePhotos,
  lignesDevis,
  photos,
  users,
} from "../db/schema";
import type { Ctx } from "./context";
import {
  appliquerLaMemoire,
  contenuVide,
  memoireDepuis,
  memoireVide,
  type ContenuFiche,
  type MemoireDesFiches,
} from "../../lib/fiche-securite";

// LE DÉPÔT DE LA FICHE DE SÉCURITÉ — une par chantier, gardée deux ans.
//
// Tout passe par `withEntreprise` : hors de ce cadre, une requête ne renvoie
// rien, silencieusement (`CLAUDE.md` §3). Le contenu est un jsonb typé par
// `ContenuFiche` ; ce dépôt ne le lit pas case par case, il le rend entier.

export type FicheEnregistree = {
  id: string;
  chantierId: string;
  contenu: ContenuFiche;
  etapeVue: number;
  loiLue: boolean;
  signaturePng: string | null;
  signataire: string | null;
  signeeLe: Date | null;
  transmiseLe: Date | null;
};

function lireContenu(brut: unknown): ContenuFiche {
  // Un contenu enregistré par une version plus ancienne du formulaire n'a pas
  // forcément tous les champs : les manquants prennent leur valeur vide, jamais
  // une valeur devinée — c'est une fiche de sécurité.
  return { ...contenuVide(), ...(brut as Partial<ContenuFiche>) };
}

function versFiche(ligne: typeof fichesSecurite.$inferSelect): FicheEnregistree {
  return {
    id: ligne.id,
    chantierId: ligne.chantierId,
    contenu: lireContenu(ligne.contenu),
    etapeVue: ligne.etapeVue,
    loiLue: ligne.loiLue,
    signaturePng: ligne.signaturePng,
    signataire: ligne.signataire,
    signeeLe: ligne.signeeLe,
    transmiseLe: ligne.transmiseLe,
  };
}

export async function ficheDuChantier(ctx: Ctx, chantierId: string): Promise<FicheEnregistree | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx.select().from(fichesSecurite).where(eq(fichesSecurite.chantierId, chantierId)).limit(1);
    return ligne ? versFiche(ligne) : null;
  });
}

/**
 * Ce qu'Atlas sait déjà du chantier, pour ne rien faire ressaisir — *« plus de
 * vingt par an »*. Ce qui n'est pas connu reste `null` : le formulaire le
 * laisse vide, il ne l'invente pas.
 */
export type ContexteDuChantier = {
  chantierNom: string;
  adresse: string | null;
  datePlanifiee: string | null;
  numeroDevis: string | null;
  lignesDuDevis: string[];
  client: { nom: string; telephone: string | null } | null;
  equipes: string[];
  entreprise: { nom: string; telephone: string | null };
  patron: { nom: string | null; prenom: string | null };
};

export async function contexteDuChantier(ctx: Ctx, chantierId: string): Promise<ContexteDuChantier | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [c] = await tx
      .select({
        nom: chantiers.nom,
        adresse: chantiers.adresseChantier,
        datePlanifiee: chantiers.datePlanifiee,
        clientNom: clients.nom,
        clientTelephone: clients.telephone,
      })
      .from(chantiers)
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(and(eq(chantiers.id, chantierId), isNull(chantiers.deletedAt)))
      .limit(1);
    if (!c) return null;
    const [dernierDevis] = await tx
      .select({ numero: devis.numeroCommercial, id: devis.id })
      .from(devis)
      .where(eq(devis.chantierId, chantierId))
      .orderBy(desc(devis.numeroVersion))
      .limit(1);
    const lignes = dernierDevis
      ? await tx
          .select({ libelle: lignesDevis.libelle })
          .from(lignesDevis)
          .where(eq(lignesDevis.devisId, dernierDevis.id))
          .orderBy(asc(lignesDevis.ordre))
      : [];
    const siennes = await tx
      .select({ nom: equipes.nom, rang: equipes.rang })
      .from(equipesDuChantier)
      .innerJoin(equipes, eq(equipesDuChantier.equipeId, equipes.id))
      .where(eq(equipesDuChantier.chantierId, chantierId));
    const [entreprise] = await tx
      .select({ nom: entreprises.nom, telephone: entreprises.telephone })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    const [patron] = await tx
      .select({ nom: users.nom, prenom: users.prenom })
      .from(users)
      .where(eq(users.id, ctx.utilisateurId))
      .limit(1);
    const nomsDEquipes = [...new Set(siennes.map((e) => e.nom?.trim() || `Équipe ${e.rang}`))];
    return {
      chantierNom: c.nom,
      adresse: c.adresse,
      datePlanifiee: c.datePlanifiee,
      numeroDevis: dernierDevis?.numero ?? null,
      lignesDuDevis: lignes.map((l) => l.libelle),
      client: c.clientNom ? { nom: c.clientNom, telephone: c.clientTelephone } : null,
      equipes: nomsDEquipes,
      entreprise: { nom: entreprise?.nom ?? "", telephone: entreprise?.telephone ?? null },
      patron: { nom: patron?.nom ?? null, prenom: patron?.prenom ?? null },
    };
  });
}

export async function memoireDeLEntreprise(ctx: Ctx): Promise<MemoireDesFiches> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select({ contenu: fichesSecuriteMemoire.contenu })
      .from(fichesSecuriteMemoire)
      .where(eq(fichesSecuriteMemoire.entrepriseId, ctx.entrepriseId))
      .limit(1);
    return ligne ? { ...memoireVide(), ...(ligne.contenu as Partial<MemoireDesFiches>) } : memoireVide();
  });
}

/**
 * Une fiche neuve part de ce qui a été gardé ; une fiche existante est rendue
 * telle quelle. C'est le seul endroit qui CRÉE une fiche.
 */
export async function ouvrirLaFiche(ctx: Ctx, chantierId: string): Promise<FicheEnregistree> {
  const existante = await ficheDuChantier(ctx, chantierId);
  if (existante) return existante;
  const memoire = await memoireDeLEntreprise(ctx);
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .insert(fichesSecurite)
      .values({
        entrepriseId: ctx.entrepriseId,
        chantierId,
        contenu: appliquerLaMemoire(contenuVide(), memoire),
      })
      .onConflictDoNothing({ target: fichesSecurite.chantierId })
      .returning();
    if (ligne) return versFiche(ligne);
    // Deux ouvertures au même instant : la seconde relit celle de la première.
    const [deja] = await tx.select().from(fichesSecurite).where(eq(fichesSecurite.chantierId, chantierId)).limit(1);
    return versFiche(deja);
  });
}

/**
 * Enregistrer ce qui est rempli — à chaque « Suivant », et à chaque retour au
 * planning. Ce qu'il a demandé de garder d'une fiche à l'autre repart dans la
 * mémoire de l'entreprise au même moment : la prochaine fiche en partira.
 */
export async function enregistrerLaFiche(
  ctx: Ctx,
  chantierId: string,
  quoi: { contenu: ContenuFiche; etapeVue: number; loiLue: boolean }
): Promise<FicheEnregistree | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .update(fichesSecurite)
      .set({ contenu: quoi.contenu, etapeVue: quoi.etapeVue, loiLue: quoi.loiLue, updatedAt: new Date() })
      .where(eq(fichesSecurite.chantierId, chantierId))
      .returning();
    if (!ligne) return null;
    await tx
      .insert(fichesSecuriteMemoire)
      .values({ entrepriseId: ctx.entrepriseId, contenu: memoireDepuis(quoi.contenu) })
      .onConflictDoUpdate({
        target: fichesSecuriteMemoire.entrepriseId,
        set: { contenu: memoireDepuis(quoi.contenu), updatedAt: new Date() },
      });
    // Les photos de la fiche sont celles du chantier : on ne garde en liaison
    // que celles qui existent vraiment, dans l'ordre où il les a posées.
    await tx.delete(fichesSecuritePhotos).where(eq(fichesSecuritePhotos.ficheId, ligne.id));
    if (quoi.contenu.photoIds.length > 0) {
      const siennes = await tx
        .select({ id: photos.id })
        .from(photos)
        .where(and(eq(photos.chantierId, chantierId), isNull(photos.deletedAt), inArray(photos.id, quoi.contenu.photoIds)));
      const ordre = new Map(quoi.contenu.photoIds.map((id, i) => [id, i]));
      if (siennes.length > 0) {
        await tx.insert(fichesSecuritePhotos).values(
          siennes.map((p) => ({
            entrepriseId: ctx.entrepriseId,
            ficheId: ligne.id,
            photoId: p.id,
            ordre: ordre.get(p.id) ?? 0,
          }))
        );
      }
    }
    return versFiche(ligne);
  });
}

/** Signer : la date, le nom, le trait. C'est ce qui engage sa responsabilité. */
export async function signerLaFiche(
  ctx: Ctx,
  chantierId: string,
  quoi: { signaturePng: string; signataire: string }
): Promise<FicheEnregistree | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .update(fichesSecurite)
      .set({
        signaturePng: quoi.signaturePng,
        signataire: quoi.signataire.trim(),
        signeePar: ctx.utilisateurId,
        signeeLe: new Date(),
        transmiseLe: null,
        updatedAt: new Date(),
      })
      .where(eq(fichesSecurite.chantierId, chantierId))
      .returning();
    return ligne ? versFiche(ligne) : null;
  });
}

/** Rouvrir une fiche signée pour la modifier : la signature part, on re-signe. */
export async function rouvrirLaFiche(ctx: Ctx, chantierId: string): Promise<FicheEnregistree | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .update(fichesSecurite)
      .set({ signaturePng: null, signataire: null, signeePar: null, signeeLe: null, transmiseLe: null, updatedAt: new Date() })
      .where(eq(fichesSecurite.chantierId, chantierId))
      .returning();
    return ligne ? versFiche(ligne) : null;
  });
}

/**
 * « Transmettre le PDF » a ouvert la feuille de partage du téléphone : Atlas
 * n'envoie rien lui-même (`TransmettreAuClient.tsx`), il note que c'est fait.
 */
export async function marquerTransmise(ctx: Ctx, chantierId: string): Promise<FicheEnregistree | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .update(fichesSecurite)
      .set({ transmiseLe: new Date(), updatedAt: new Date() })
      .where(and(eq(fichesSecurite.chantierId, chantierId), isNull(fichesSecurite.transmiseLe)))
      .returning();
    return ligne ? versFiche(ligne) : null;
  });
}

export type FicheEnListe = {
  chantierId: string;
  chantierNom: string;
  client: string;
  signataire: string | null;
  signeeLe: Date;
  transmiseLe: Date | null;
};

/**
 * Les fiches SIGNÉES d'un mois, rangées par client puis de la plus récente à la
 * plus ancienne — la liste de Paysage. Une fiche commencée et non signée n'y
 * est pas : elle vit sur la fiche du jour du planning, tant qu'elle n'est pas
 * signée.
 */
export async function listerLesFichesDuMois(ctx: Ctx, mois: { annee: number; mois: number }): Promise<FicheEnListe[]> {
  const debut = new Date(Date.UTC(mois.annee, mois.mois - 1, 1));
  const fin = new Date(Date.UTC(mois.annee, mois.mois, 1));
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({
        chantierId: fichesSecurite.chantierId,
        chantierNom: chantiers.nom,
        client: clients.nom,
        signataire: fichesSecurite.signataire,
        signeeLe: fichesSecurite.signeeLe,
        transmiseLe: fichesSecurite.transmiseLe,
      })
      .from(fichesSecurite)
      .innerJoin(chantiers, eq(fichesSecurite.chantierId, chantiers.id))
      .leftJoin(clients, eq(chantiers.clientId, clients.id))
      .where(and(gte(fichesSecurite.signeeLe, debut), lt(fichesSecurite.signeeLe, fin)))
      .orderBy(desc(fichesSecurite.signeeLe));
    return lignes
      .filter((l): l is typeof l & { signeeLe: Date } => l.signeeLe !== null)
      .map((l) => ({ ...l, client: l.client?.trim() || "Sans client" }));
  });
}

export async function photoTenueParUneFiche(ctx: Ctx, photoId: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .select({ id: fichesSecuritePhotos.id })
      .from(fichesSecuritePhotos)
      .where(eq(fichesSecuritePhotos.photoId, photoId))
      .limit(1);
    return lignes.length > 0;
  });
}
