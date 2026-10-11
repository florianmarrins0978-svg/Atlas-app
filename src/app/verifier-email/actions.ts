"use server";

import { auth } from "@/auth";
import {
  adresseDuCompte,
  renvoyerLeCode,
  verifierLeCode,
  type ResultatVerification,
} from "@/server/repositories/verification-email";

/**
 * Les deux gestes de l'écran du code : entrer le code, ou le faire renvoyer.
 *
 * **Tout part de la session, rien du navigateur** : le compte est celui qui
 * est connecté, l'adresse est celle lue en base. Une action qui accepterait
 * un identifiant ou une adresse en paramètre laisserait vérifier — ou
 * arroser — le compte d'un autre.
 *
 * Les refus sont des VALEURS, pas des exceptions : une exception sortie d'une
 * action serveur arrive à l'écran sous un numéro opaque (`HANDOVER.md`,
 * piège 0 ter), et il ne saurait pas quoi faire.
 */

export type EtatCode = ResultatVerification | { ok: false; refus: string; codeMort: false };

export async function verifierLeCodeAction(saisie: string): Promise<EtatCode> {
  const session = await auth();
  const utilisateurId = session?.user?.id;
  if (!utilisateurId) return { ok: false, refus: "Votre session a expiré. Reconnectez-vous.", codeMort: false };
  return verifierLeCode(utilisateurId, saisie);
}

export async function renvoyerLeCodeAction(): Promise<{ ok: true } | { ok: false; refus: string }> {
  const session = await auth();
  const utilisateurId = session?.user?.id;
  if (!utilisateurId) return { ok: false, refus: "Votre session a expiré. Reconnectez-vous." };
  const adresse = await adresseDuCompte(utilisateurId);
  if (!adresse) return { ok: false, refus: "Ce compte n’existe plus." };
  return renvoyerLeCode(utilisateurId, adresse);
}
