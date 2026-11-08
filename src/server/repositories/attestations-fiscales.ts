/**
 * LES ATTESTATIONS FISCALES DE SES CLIENTS, côté base (migration 0179).
 *
 * Ce dépôt rassemble, pour une année : la déclaration de l'entreprise, ses
 * factures ARRÊTÉES qui portent la case, leurs avoirs et leurs règlements, les
 * heures de leurs chantiers, les noms d'aujourd'hui, et ce qui est déjà parti.
 * Il ne compte rien : `src/lib/attestation-fiscale.ts` décide du montant, des
 * lignes, de ce qui manque et de l'état. La liste, la feuille, le PDF et
 * l'envoi lisent tous ce même chargement.
 *
 * **Rien ne se lit hors de la saison** : la ligne de Terminés ne demande ses
 * chiffres que du 1er janvier au 31 mars (`anneeDesAttestations`), et pour une
 * entreprise déclarée. Le reste de l'année, aucune requête ne part ici.
 *
 * **Tout passe par `withEntreprise`** (`CLAUDE.md` §3).
 */
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import {
  attestationsFiscalesEnvoyees,
  chantiers,
  clients,
  entreprises,
  envoisFactures,
  equipes,
  factures,
  heuresDIntervention,
  paiementsFacture,
} from "../db/schema";
import type { Ctx } from "./context";
import { avoirsDesFactures } from "./avoirs";
import { logoLu } from "./entreprises";
import { patronDans } from "./membres-entreprise";
import type { LogoDocument } from "../pdf/document-commun";
import {
  anneeDesAttestations,
  calculerLAttestation,
  ceQuiManqueALAttestation,
  contenuDeLAttestationFiscale,
  empreinteDeLAttestation,
  etatDeLAttestation,
  phraseDeLaLigne,
  type AttestationCalculee,
  type ClientAttestation,
  type ContenuAttestationFiscale,
  type EtatAttestation,
  type FactureAttestable,
  type HeureEnregistree,
  type Organisme,
} from "@/lib/attestation-fiscale";
import { caseRetenue, NUMERO_DU_PATRON } from "@/lib/services-a-la-personne";
import { jourIso } from "@/lib/jour";

/** Une attestation, prête pour la liste, la feuille et le papier. */
export type AttestationDuClient = {
  clientId: string;
  client: ClientAttestation;
  calcul: AttestationCalculee;
  manques: string[];
  empreinte: string;
  etat: EtatAttestation;
  /** Le dernier envoi de l'année, ou `null`. */
  envoyeeLe: Date | null;
  /** Le canal de sa dernière facture partie : « Par e-mail, comme ses factures. » */
  canal: "sms" | "email" | null;
};

export type AttestationsDeLAnnee = {
  annee: number;
  organisme: Organisme;
  logoCle: { cle: string | null; mime: string | null };
  attestations: AttestationDuClient[];
};

/**
 * Toutes les attestations d'une année, client par client, ou `null` quand
 * l'entreprise n'est pas déclarée : elle n'en fait aucune.
 *
 * **Une facture compte** quand elle est arrêtée, porte la case, que son
 * client est un particulier (la règle de la case, `caseRetenue`, sur le nom et
 * la civilité figés sur la facture), et qu'elle a reçu un règlement dans
 * l'année. **Un client** est celui de son chantier : une facture dont le
 * chantier n'a pas de fiche client n'a personne à qui s'adresser, et ne
 * paraît pas.
 */
export async function attestationsDeLAnnee(ctx: Ctx, annee: number): Promise<AttestationsDeLAnnee | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => lireLAnnee(tx, ctx.entrepriseId, annee));
}

async function lireLAnnee(tx: DbOrTx, entrepriseId: string, annee: number): Promise<AttestationsDeLAnnee | null> {
  const [e] = await tx
    .select({
      nom: entreprises.nom,
      adresse: entreprises.adresse,
      declaree: entreprises.sapDeclaree,
      numero: entreprises.sapNumero,
      declareeLe: entreprises.sapDeclareeLe,
      logoCle: entreprises.sapLogoCle,
      logoMime: entreprises.sapLogoMime,
    })
    .from(entreprises)
    .where(eq(entreprises.id, entrepriseId))
    .limit(1);
  if (!e?.declaree) return null;
  const organisme: Organisme = {
    nom: e.nom,
    adresse: e.adresse,
    numero: e.numero,
    declareeLe: e.declareeLe,
    signataire: await patronDans(tx, entrepriseId),
  };
  const vide = { annee, organisme, logoCle: { cle: e.logoCle, mime: e.logoMime }, attestations: [] };

  const du = `${annee}-01-01`;
  const au = `${annee + 1}-01-01`;
  const lignes = await tx
    .select({
      id: factures.id,
      numero: factures.numeroCommercial,
      chantierId: factures.chantierId,
      clientId: chantiers.clientId,
      clientNom: factures.clientNom,
      clientCivilite: factures.clientCivilite,
      dateEmission: factures.dateEmission,
      totalHt: factures.totalHt,
      totalTva: factures.totalTva,
      totalTtc: factures.totalTtc,
    })
    .from(factures)
    .innerJoin(chantiers, and(eq(chantiers.id, factures.chantierId), eq(chantiers.entrepriseId, factures.entrepriseId)))
    .where(
      and(
        eq(factures.entrepriseId, entrepriseId),
        eq(factures.statut, "emise"),
        eq(factures.servicesALaPersonne, true),
        isNotNull(chantiers.clientId),
        sql`EXISTS (SELECT 1 FROM ${paiementsFacture} WHERE ${paiementsFacture.factureId} = ${factures.id} AND ${paiementsFacture.datePaiement} >= ${du}::date AND ${paiementsFacture.datePaiement} < ${au}::date)`
      )
    );
  const retenues = lignes.filter((f) => caseRetenue(true, { declaree: true, clientNom: f.clientNom, clientCivilite: f.clientCivilite }));
  if (retenues.length === 0) return vide;

  const ids = retenues.map((f) => f.id);
  const chantierIds = [...new Set(retenues.map((f) => f.chantierId))];
  const clientIds = [...new Set(retenues.map((f) => f.clientId as string))];
  const [reglements, avoirsParFacture, heures, sesClients, noms, envois, canaux] = await Promise.all([
    tx
      .select({
        factureId: paiementsFacture.factureId,
        date: paiementsFacture.datePaiement,
        montant: paiementsFacture.montant,
        moyen: paiementsFacture.moyen,
      })
      .from(paiementsFacture)
      .where(inArray(paiementsFacture.factureId, ids))
      .orderBy(asc(paiementsFacture.datePaiement)),
    avoirsDesFactures(tx, ids),
    tx
      .select({
        chantierId: heuresDIntervention.chantierId,
        jour: heuresDIntervention.jour,
        minutes: heuresDIntervention.minutes,
        numero: heuresDIntervention.intervenantNumero,
        nom: heuresDIntervention.intervenantNom,
      })
      .from(heuresDIntervention)
      .where(and(eq(heuresDIntervention.entrepriseId, entrepriseId), inArray(heuresDIntervention.chantierId, chantierIds))),
    tx
      .select({ id: clients.id, nom: clients.nom, civilite: clients.civilite, adresse: clients.adresse })
      .from(clients)
      .where(and(eq(clients.entrepriseId, entrepriseId), inArray(clients.id, clientIds))),
    tx
      .select({ numero: equipes.numeroIntervenant, nom: equipes.nom })
      .from(equipes)
      .where(and(eq(equipes.entrepriseId, entrepriseId), isNotNull(equipes.numeroIntervenant))),
    tx
      .select({
        clientId: attestationsFiscalesEnvoyees.clientId,
        empreinte: attestationsFiscalesEnvoyees.empreinte,
        envoyeeLe: attestationsFiscalesEnvoyees.envoyeeLe,
      })
      .from(attestationsFiscalesEnvoyees)
      .where(and(eq(attestationsFiscalesEnvoyees.entrepriseId, entrepriseId), eq(attestationsFiscalesEnvoyees.annee, annee)))
      .orderBy(desc(attestationsFiscalesEnvoyees.envoyeeLe)),
    tx
      .select({ factureId: envoisFactures.factureId, canal: envoisFactures.canal })
      .from(envoisFactures)
      .where(inArray(envoisFactures.factureId, ids))
      .orderBy(desc(envoisFactures.envoyeAt)),
  ]);

  // Les noms d'aujourd'hui, sous chaque numéro : le repli d'une heure tapée
  // avant que le nom soit écrit. Le patron prend le nom de son compte.
  const nomsActuels = new Map<number, string>();
  for (const n of noms) if (n.numero !== null && n.nom?.trim()) nomsActuels.set(n.numero, n.nom.trim());
  if (organisme.signataire) nomsActuels.set(NUMERO_DU_PATRON, organisme.signataire.nom);

  const parFacture = new Map<string, FactureAttestable["reglements"][number][]>();
  for (const r of reglements) parFacture.set(r.factureId, [...(parFacture.get(r.factureId) ?? []), r]);
  const fiches = new Map(sesClients.map((c) => [c.id, c]));
  // Le plus récent d'abord : le premier vu par client est son dernier envoi.
  const dernierEnvoi = new Map<string, { empreinte: string; envoyeeLe: Date }>();
  for (const x of envois) if (!dernierEnvoi.has(x.clientId)) dernierEnvoi.set(x.clientId, x);
  const canalParFacture = new Map<string, "sms" | "email">();
  for (const c of canaux) if (!canalParFacture.has(c.factureId)) canalParFacture.set(c.factureId, c.canal);

  const attestations: AttestationDuClient[] = [];
  for (const clientId of clientIds) {
    const fiche = fiches.get(clientId);
    if (!fiche) continue;
    const siennes = retenues.filter((f) => f.clientId === clientId);
    const facturesDuClient: FactureAttestable[] = siennes.map((f) => ({
      id: f.id,
      numero: f.numero,
      chantierId: f.chantierId,
      dateEmission: f.dateEmission,
      totalHt: f.totalHt,
      totalTva: f.totalTva,
      totalTtc: f.totalTtc,
      avoirs: avoirsParFacture.get(f.id) ?? [],
      reglements: parFacture.get(f.id) ?? [],
    }));
    const chantiersDuClient = new Set(siennes.map((f) => f.chantierId));
    const heuresDuClient: HeureEnregistree[] = heures.filter((h) => chantiersDuClient.has(h.chantierId));
    const calcul = calculerLAttestation({ annee, factures: facturesDuClient, heures: heuresDuClient, nomsActuels });
    // Un client dont l'année ne porte aucun euro réglé n'a rien à attester.
    if (!(Number(calcul.montant) > 0)) continue;
    const client: ClientAttestation = { nom: fiche.nom, civilite: fiche.civilite, adresse: fiche.adresse };
    const manques = ceQuiManqueALAttestation(organisme, client, calcul);
    const empreinte = empreinteDeLAttestation(organisme, client, calcul);
    const envoi = dernierEnvoi.get(clientId) ?? null;
    // Les factures du client, de la plus récente à la plus ancienne : la
    // première qui soit partie dit son canal.
    const recentes = [...siennes].sort((a, b) => (a.dateEmission < b.dateEmission ? 1 : -1));
    const canal = recentes.map((f) => canalParFacture.get(f.id)).find((c) => c !== undefined) ?? null;
    attestations.push({
      clientId,
      client,
      calcul,
      manques,
      empreinte,
      etat: etatDeLAttestation(manques, empreinte, envoi?.empreinte ?? null),
      envoyeeLe: envoi?.envoyeeLe ?? null,
      canal,
    });
  }
  attestations.sort((a, b) => a.client.nom.localeCompare(b.client.nom, "fr"));
  return { ...vide, attestations };
}

/** L'attestation d'un client, ou `null` : pas déclarée, ou rien à attester pour lui. */
export async function attestationDuClient(
  ctx: Ctx,
  annee: number,
  clientId: string
): Promise<{ organisme: Organisme; logoCle: { cle: string | null; mime: string | null }; attestation: AttestationDuClient } | null> {
  const lu = await attestationsDeLAnnee(ctx, annee);
  const attestation = lu?.attestations.find((a) => a.clientId === clientId);
  return lu && attestation ? { organisme: lu.organisme, logoCle: lu.logoCle, attestation } : null;
}

/**
 * Le papier d'une attestation : son texte, et le logo des services à la
 * personne pour le PDF. La feuille de l'écran ne montre pas le logo (lot 1) :
 * elle ne le lit pas dans le stockage (`avecLogo: false`).
 */
export async function papierDeLAttestation(
  ctx: Ctx,
  annee: number,
  clientId: string,
  { maintenant = new Date(), avecLogo = true }: { maintenant?: Date; avecLogo?: boolean } = {}
): Promise<{ contenu: ContenuAttestationFiscale; logo: LogoDocument | null; attestation: AttestationDuClient } | null> {
  const lu = await attestationDuClient(ctx, annee, clientId);
  if (!lu) return null;
  return {
    contenu: contenuDeLAttestationFiscale(lu.organisme, lu.attestation.client, lu.attestation.calcul, jourIso(maintenant)),
    logo: avecLogo ? await logoLu(lu.logoCle.cle, lu.logoCle.mime, "Logo des services à la personne") : null,
    attestation: lu.attestation,
  };
}

/**
 * La ligne de Terminés : l'année, et ce qui reste à envoyer. `null` hors de
 * la saison, pour une entreprise non déclarée, ou sans aucune attestation à
 * faire : la ligne n'existe pas.
 */
export async function ligneDesAttestations(
  ctx: Ctx,
  maintenant: Date = new Date()
): Promise<{ annee: number; texte: string; ton: "ambre" | "vert" } | null> {
  const annee = anneeDesAttestations(jourIso(maintenant));
  if (annee === null) return null;
  const lu = await attestationsDeLAnnee(ctx, annee);
  if (!lu || lu.attestations.length === 0) return null;
  return { annee, ...phraseDeLaLigne(lu.attestations.map((a) => a.etat)) };
}

/**
 * L'envoi d'UNE attestation, noté une fois qu'elle est partie par la feuille
 * de partage du téléphone. **Recomposée ici, pas crue sur parole** : ce qui
 * s'écrit est l'empreinte de ce qu'Atlas compose à cet instant, et une
 * attestation à compléter se refuse. Le refus se rend en valeur
 * (`AGENTS.md`).
 */
export async function noterLEnvoi(
  ctx: Ctx,
  annee: number,
  clientId: string
): Promise<{ ok: true; envoyeeLe: Date } | { ok: false; raison: string }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lu = await lireLAnnee(tx, ctx.entrepriseId, annee);
    const a = lu?.attestations.find((x) => x.clientId === clientId);
    if (!a) return { ok: false, raison: "Cette attestation n'existe plus." };
    if (a.etat === "a_completer") return { ok: false, raison: a.manques[0] ?? "Cette attestation est à compléter." };
    const [ligne] = await tx
      .insert(attestationsFiscalesEnvoyees)
      .values({
        entrepriseId: ctx.entrepriseId,
        clientId,
        annee,
        montant: a.calcul.montant,
        empreinte: a.empreinte,
        envoyeePar: ctx.utilisateurId,
      })
      .returning({ envoyeeLe: attestationsFiscalesEnvoyees.envoyeeLe });
    return { ok: true, envoyeeLe: ligne.envoyeeLe };
  });
}
