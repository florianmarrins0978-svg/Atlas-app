"use server";

/**
 * Les gestes des dossiers du plan d'arrosage — sa demande du 21 novembre 2026,
 * planche `appli/arrosage-dossiers.html`, `ARCHITECTURE.md` §599.
 *
 * **Enregistrer demande l'option** (on enregistre un plan qu'on vient de
 * calculer) ; **revoir, renommer, supprimer et télécharger ne la demandent
 * pas** : sa réponse 5, une trace sert au moment d'un litige, souvent après
 * avoir arrêté l'option. Tous demandent l'écran « Paysage » de son rôle.
 */
import { revalidatePath } from "next/cache";
import { exigerEcran, exigerFonction } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { getConfigIA } from "@/server/ai/config";
import { logger } from "@/server/logger";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { enregistrerObjet } from "@/server/storage";
import { versionExecutee } from "@/server/version-executee";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerClients } from "@/server/repositories/clients";
import {
  creerDossier,
  enregistrerPlan,
  listerDossiers,
  ouvrirDossier,
  renommerDossier,
  supprimerDossier,
  nomDuDossier,
} from "@/server/repositories/dossiers-arrosage";
import { empreinteDuPlan, figerLePlan, lireLaSaisie, resumeDuPlan } from "@/lib/arrosage/plan-enregistre";
import { avecCivilite } from "@/lib/civilite";
import { composerLePdfDuPlan } from "@/server/pdf/plan-arrosage-pdf";
import { donneesDuPdf } from "./donnees-du-pdf";

export type DossierPourLaFeuille = { id: string; nom: string; client: string | null; plans: number; dernier: string | null };

/** Ses dossiers, pour la feuille « Dans quel dossier ? » : le plus récent en tête. */
export async function sesDossiersAction(): Promise<DossierPourLaFeuille[]> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/paysage", "voir ses dossiers d'arrosage");
  return (await listerDossiers(ctx)).map((d) => ({ id: d.id, nom: d.nom, client: d.client?.nom ?? null, plans: d.plans, dernier: d.dernier?.toISOString() ?? null }));
}

/** Ses clients, pour relier un dossier à une fiche (facultatif, sa réponse 1). */
export async function sesClientsAction(): Promise<{ id: string; nom: string }[]> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/paysage", "relier un dossier d'arrosage à un client");
  return (await listerClients(ctx))
    .filter((c) => !c.effaceLe)
    .map((c) => ({ id: c.id, nom: avecCivilite(c.nom, c.civilite ?? undefined) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

export type EtatEnregistrement =
  | { etat: "enregistre"; dossierId: string; dossier: string; version: number; le: string }
  | { etat: "deja"; dossierId: string; dossier: string }
  | { etat: "refus"; raison: string };

const clientDe = (f: FormData): string | null => {
  const v = f.get("clientId");
  return typeof v === "string" && v !== "" ? v : null;
};

/**
 * ENREGISTRER LE PLAN DE L'ÉCRAN. Le serveur ne croit pas le plan qu'on lui
 * envoie : il reçoit la saisie, refait le plan avec les mêmes fonctions que
 * l'écran (`plan-enregistre.ts`) et compare l'empreinte. Différente, il refuse
 * et le journal le dit : c'est une page restée ouverte sur un code ancien, ou
 * un envoi bricolé, et rien des deux ne s'enregistre.
 */
export async function enregistrerLePlanAction(formulaire: FormData): Promise<EtatEnregistrement> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/paysage", "enregistrer un plan d'arrosage");
  await exigerFonction(ctx, "arrosage", "enregistrer un plan d'arrosage");
  // Chaque enregistrement range une photo et un PDF composé ici : la cadence
  // des fichiers téléversés, avant tout (`test-cadences-gardees.ts`).
  const limite = await verifierLimite(`plan-arrosage:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) return { etat: "refus", raison: limite.message };

  let brut: unknown;
  try {
    brut = JSON.parse(String(formulaire.get("saisie") ?? ""));
  } catch {
    return { etat: "refus", raison: "Ce plan n’est pas lisible. Rechargez la page, puis enregistrez-le de nouveau." };
  }
  const lu = lireLaSaisie(brut);
  if (!lu.ok) return { etat: "refus", raison: lu.raison };
  const saisie = lu.saisie;

  const fige = figerLePlan(saisie);
  const empreinte = empreinteDuPlan(fige);
  if (empreinte !== formulaire.get("empreinte")) {
    logger.warn("Plan d'arrosage refusé à l'enregistrement : l'écran ne montre pas le plan que le serveur calcule", {
      entrepriseId: ctx.entrepriseId,
      empreinteEcran: String(formulaire.get("empreinte") ?? ""),
      empreinteServeur: empreinte,
    });
    return { etat: "refus", raison: "Ce plan a changé depuis son affichage. Rechargez la page, puis enregistrez-le de nouveau." };
  }

  // Le dossier : celui qu'il a choisi, ou un nouveau, nommé par lui.
  const dossierId = formulaire.get("dossierId");
  let nomDuDossierChoisi: string;
  let ou: { dossierId: string } | { nouveau: { nom: unknown; clientId: string | null } };
  if (typeof dossierId === "string" && dossierId !== "") {
    const d = await ouvrirDossier(ctx, dossierId);
    if (!d) return { etat: "refus", raison: "Ce dossier n’existe plus." };
    nomDuDossierChoisi = d.nom;
    ou = { dossierId };
  } else {
    const nom = nomDuDossier(formulaire.get("nom"));
    if (!nom.ok) return { etat: "refus", raison: nom.raison };
    nomDuDossierChoisi = nom.nom;
    ou = { nouveau: { nom: nom.nom, clientId: clientDe(formulaire) } };
  }

  // La photo du croquis (sa réponse 3) : nettoyée par la porte commune, GPS retiré.
  let photoCle: string | null = null;
  const photo = formulaire.get("croquis");
  if (photo instanceof File && photo.size > 0) {
    const prete = await preparerPhotoEntrante(photo, "croquis d'arrosage");
    if (!prete.ok) return { etat: "refus", raison: prete.raison };
    photoCle = (await enregistrerObjet(`arrosage/${ctx.entrepriseId}/croquis`, prete.photo.octets, prete.photo.extension, prete.photo.mimeType)).storageKey;
  }

  // Le PDF, archivé maintenant et jamais reconstruit (comme celui d'une facture).
  const entreprise = await getEntreprise(ctx);
  const maintenant = new Date();
  const pdf = await composerLePdfDuPlan(donneesDuPdf({ entreprise: entreprise?.nom ?? "", dossier: nomDuDossierChoisi, enregistreLe: maintenant, saisie, fige }));
  const pdfCle = (await enregistrerObjet(`arrosage/${ctx.entrepriseId}/plans`, Buffer.from(pdf), ".pdf", "application/pdf")).storageKey;

  const r = await enregistrerPlan(ctx, ou, {
    saisie,
    resultat: fige,
    empreinte,
    resume: resumeDuPlan(fige),
    photoCle,
    pdfCle,
    // Le commit servi : « inconnue » est vrai quand le serveur ne sait pas le dire, jamais un numéro supposé.
    versionCalcul: (await versionExecutee()) ?? "inconnue",
    modele: photoCle ? getConfigIA().visionModele ?? null : null,
  });
  if (!r.ok) return { etat: "refus", raison: r.raison };
  revalidatePath("/paysage/dossiers-arrosage");
  if (r.deja) return { etat: "deja", dossierId: r.dossierId, dossier: nomDuDossierChoisi };
  return { etat: "enregistre", dossierId: r.dossierId, dossier: nomDuDossierChoisi, version: r.version, le: maintenant.toISOString() };
}

export type EtatDuGeste = { ok: true; id?: string } | { ok: false; raison: string };

export async function creerDossierAction(formulaire: FormData): Promise<EtatDuGeste> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/paysage", "créer un dossier d'arrosage");
  const r = await creerDossier(ctx, { nom: formulaire.get("nom"), clientId: clientDe(formulaire) });
  if (!r.ok) return r;
  revalidatePath("/paysage/dossiers-arrosage");
  return { ok: true, id: r.id };
}

export async function renommerDossierAction(id: string, formulaire: FormData): Promise<EtatDuGeste> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/paysage", "renommer un dossier d'arrosage");
  const r = await renommerDossier(ctx, id, { nom: formulaire.get("nom"), clientId: clientDe(formulaire) });
  if (!r.ok) return r;
  revalidatePath("/paysage/dossiers-arrosage");
  return { ok: true };
}

export async function supprimerDossierAction(id: string): Promise<EtatDuGeste> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/paysage", "supprimer un dossier d'arrosage");
  const r = await supprimerDossier(ctx, id);
  if (!r.ok) return r;
  revalidatePath("/paysage/dossiers-arrosage");
  return { ok: true };
}
