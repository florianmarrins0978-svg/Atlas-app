"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { poserLogoServicesALaPersonne, reglerServicesALaPersonne } from "@/server/repositories/services-a-la-personne";
import { saisieServicesALaPersonneLue, type SaisieServicesALaPersonne } from "@/lib/services-a-la-personne";
import { refusDuLogo } from "@/lib/allure-documents";
import { jourIso } from "@/lib/jour";
import { enregistrerObjet, supprimerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { logger } from "@/server/logger";

/**
 * LES SERVICES À LA PERSONNE, depuis Mon entreprise (migration 0178).
 *
 * **Réservé au patron**, comme le reste de l'identité : le numéro de
 * déclaration s'imprime sur chaque pièce. **La saisie passe par la règle de
 * l'écran** (`saisieServicesALaPersonneLue`) : ce que l'écran refuse, le
 * serveur le refuse aussi, et rien d'autre.
 *
 * **Le refus se rend en valeur**, jamais en exception : le message d'une
 * exception d'action serveur n'arrive pas jusqu'à lui (`AGENTS.md`).
 */
export async function majServicesALaPersonneAction(
  saisie: SaisieServicesALaPersonne
): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "régler les services à la personne");
  } catch {
    return { ok: false, raison: "Seul le patron peut modifier ces informations." };
  }
  const lue = saisieServicesALaPersonneLue(saisie, jourIso(new Date()));
  if (!lue.ok) return lue;
  try {
    await reglerServicesALaPersonne(ctx, lue.valeurs);
    return { ok: true };
  } catch (erreur) {
    logger.error("Services à la personne non enregistrés", {
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return { ok: false, raison: "L'enregistrement n'a pas abouti. Réessayez." };
  }
}

/**
 * Dépose le logo des services à la personne, téléchargé sur NOVA.
 *
 * **Le même chemin que son logo** (`poserLogoAction`) : le format se refuse
 * d'abord par la règle du papier (`refusDuLogo`, PNG ou JPEG), puis la porte
 * commune retire les métadonnées, puisqu'il part chez chaque client. L'ancien
 * fichier s'efface APRÈS que le nouveau soit écrit en base.
 */
export async function deposerLogoServicesALaPersonneAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "déposer le logo des services à la personne");
  } catch {
    return { ok: false, raison: "Seul le patron peut déposer ce logo." };
  }
  try {
    const fichier = formData.get("fichier");
    if (!(fichier instanceof File)) return { ok: false, raison: "Aucune image reçue." };
    const refus = refusDuLogo(fichier.type, fichier.size);
    if (refus) return { ok: false, raison: refus };

    const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
    if (!limite.autorise) return { ok: false, raison: limite.message };

    const prete = await preparerPhotoEntrante(fichier, "logo des services à la personne");
    if (!prete.ok) return { ok: false, raison: prete.raison };

    const objet = await enregistrerObjet(
      `entreprises/${ctx.entrepriseId}/logo-services-a-la-personne`,
      prete.photo.octets,
      prete.photo.extension,
      prete.photo.mimeType
    );
    const { avant } = await poserLogoServicesALaPersonne(ctx, { cle: objet.storageKey, mime: prete.photo.mimeType });
    if (avant) await supprimerObjet(avant);
    return { ok: true };
  } catch (erreur) {
    logger.error("Logo des services à la personne non enregistré", {
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return { ok: false, raison: "Cette image n'a pas pu être enregistrée. Réessayez." };
  }
}

/** Retire le logo des services à la personne. Le fichier part avec la ligne : rien ne le lit plus. */
export async function retirerLogoServicesALaPersonneAction(): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "retirer le logo des services à la personne");
  } catch {
    return { ok: false, raison: "Seul le patron peut retirer ce logo." };
  }
  try {
    const { avant } = await poserLogoServicesALaPersonne(ctx, null);
    if (avant) await supprimerObjet(avant);
    return { ok: true };
  } catch (erreur) {
    logger.error("Logo des services à la personne non retiré", {
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return { ok: false, raison: "Ce logo n'a pas pu être retiré. Réessayez." };
  }
}
