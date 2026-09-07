"use server";

import { revalidatePath } from "next/cache";
import { exigerMontants } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { effacerClient } from "@/server/repositories/donnees-client";
import { exigerEcran } from "@/server/garde-action";
import { getClient } from "@/server/repositories/clients";
import { creerChantier, getChantier } from "@/server/repositories/chantiers";
import { reprendreLesLignesPrix } from "@/server/repositories/lignes-prix";
import { nomDuChantier } from "@/lib/nom-chantier";
import { jourIso } from "@/lib/jour";

/**
 * SUPPRIMER UN CLIENT — sa proposition C, tranchée le 27 août 2026.
 *
 * *« Je pense la C ; lorsqu'un client a des documents il faut mettre la phrase
 * de prévention, et une phrase disant avez-vous sauvegardé ses documents autre
 * part — et s'il dit oui il peut supprimer quand même. »*
 *
 * **Un refus attendu se REND, il ne se lève pas** (`AGENTS.md`, piège 0 ter) :
 * le message d'une exception levée par une action serveur n'arrive jamais
 * jusqu'à lui — Next.js le remplace en production par un identifiant opaque, et
 * son banc sert une version bâtie. « Ce client n'existe plus » est un refus
 * attendu : il descend en valeur de retour.
 *
 * **Aucune confirmation ne se rejoue ici.** L'écran a déjà posé la question de
 * la sauvegarde ; la refaire côté serveur voudrait dire transporter un « oui »
 * dans la requête, qu'un appel direct poserait tout aussi bien. Ce qui protège
 * pour de bon, c'est la loi appliquée en base — la facture émise que la clé
 * étrangère refuse de lâcher —, pas une case cochée.
 */
export async function supprimerClientAction(
  clientId: string
): Promise<
  | { ok: true; disparu: boolean; conserve: { numero: string; pourquoi: string }[] }
  | { ok: false; message: string }
> {
  const ctx = await getCurrentCtx();
  await exigerMontants(ctx, "supprimer un client");

  let rapport;
  try {
    rapport = await effacerClient(ctx, clientId);
  } catch (err) {
    // **Une panne imprévue se journalise AVANT de rendre une phrase.** Sans
    // cette ligne, le patron lirait « impossible pour l'instant » et personne,
    // nulle part, ne saurait pourquoi (`AGENTS.md` : rendre le défaut bavard).
    console.error("[supprimerClientAction] échec", { clientId, err });
    return {
      ok: false,
      message: "La suppression n'a pas abouti. Rien n'a été retiré — réessayez.",
    };
  }

  if (!rapport) {
    return { ok: false, message: "Ce client n'existe plus." };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);

  return {
    ok: true,
    disparu: rapport.disparu,
    conserve: rapport.pieces.map((p) => ({ numero: p.numero, pourquoi: p.pourquoi })),
  };
}

/**
 * REFAIRE CE QU'ON LUI A DÉJÀ FAIT — sa décision du 8 septembre 2026.
 *
 * *« Il faut la E car si c'est un client déjà enregistré en tant que client on
 * ne va pas recréer une fiche client ! »*, puis : *« si on clique sur refaire
 * il faut que ça se mette au prix d'aujourd'hui, la 1 »*.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE ACTION CRÉE, ET CE QU'ELLE NE CRÉE PAS.**
 *
 * Elle crée **un chantier**, accroché à la fiche client qu'on a sous les yeux.
 * Elle ne crée **aucun client** : c'est sa crainte, et elle est infondée ici
 * plus qu'ailleurs — on ne passe même pas par `trouverOuCreerClient`, puisque
 * l'identifiant du client est connu. Aucun rapprochement, donc aucun risque
 * d'atterrir chez un homonyme.
 *
 * **Et elle ouvre la VRAIE page du devis**, jamais un récapitulatif. Sa raison,
 * le 8 septembre : *« si l'utilisateur veut rajouter des lignes, modifier des
 * prix, rajouter une TVA ou faire un prix au client, il peut le faire qu'à
 * partir de la page devis la vraie ! »* Cette action ne redirige pas
 * elle-même — elle rend l'identifiant, et l'écran navigue, comme
 * `creerChantierAction`.
 *
 * **Les photos ne suivent PAS ici.** « Refaire » reprend le TRAVAIL ; les
 * photos de la dernière fois se cochent sur la fiche client, écran par écran
 * (`photosDesAutresChantiers`). Les emporter d'office mettrait dans le dossier
 * du salarié des images d'un chantier qu'il n'a pas fait.
 */
export async function refaireLeChantierAction(
  clientId: string,
  depuisChantierId: string
): Promise<
  { ok: true; chantierId: string; repris: number; retarifees: number } | { ok: false; raison: string }
> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/clients", "repartir d'un chantier");

  const client = await getClient(ctx, clientId);
  // Un client d'une autre entreprise et un client effacé sont indiscernables,
  // et c'est très bien ainsi : la RLS ne rend rien, silencieusement.
  if (!client) return { ok: false, raison: "Ce client n'existe plus." };

  const ancien = await getChantier(ctx, depuisChantierId);
  if (!ancien || ancien.clientId !== clientId) {
    // **Le chantier doit appartenir à CE client.** Sans ce contrôle, un
    // identifiant deviné recopierait le détail — donc les prix — d'un chantier
    // d'un autre client de la même entreprise sur une fiche qu'on regarde.
    return { ok: false, raison: "Ce chantier n'est plus rattaché à ce client." };
  }

  const chantier = await creerChantier(ctx, {
    nom: nomDuChantier({
      nomClient: client.nom,
      civilite: client.civilite ?? undefined,
      adresseChantier: ancien.adresseChantier ?? client.adresse ?? undefined,
      jour: jourIso(new Date()),
    }),
    adresseChantier: ancien.adresseChantier ?? client.adresse ?? undefined,
    clientId,
  });

  const reprises = await reprendreLesLignesPrix(ctx, depuisChantierId, chantier.id);

  revalidatePath("/");
  revalidatePath(`/clients/${clientId}`);
  return {
    ok: true,
    chantierId: chantier.id,
    repris: reprises.length,
    retarifees: reprises.filter((l) => l.sort === "retarife").length,
  };
}
