"use server";

import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { getCurrentCtx, getCurrentCtxPourActiver } from "@/server/session-ctx";
import { getRole } from "@/server/autorisation";
import { horsProductionReelle } from "@/server/source-visiteur";
import { codeCarre } from "@/server/code-carre";
import { doubleVerificationObligatoire, ecrireCle } from "@/lib/double-verification";
import { commencerActivation, confirmerActivation, desactiver } from "@/server/repositories/double-verification";

/**
 * ACTIVER ET DÉSACTIVER LA DOUBLE VÉRIFICATION — `appli/double-verification.html`.
 *
 * **Les refus attendus reviennent en VALEUR** : le message d'une exception levée
 * par une action serveur n'arrive jamais jusqu'à l'écran (`HANDOVER.md`,
 * piège 0 ter).
 *
 * **L'activation passe par `getCurrentCtxPourActiver`** : c'est l'écran où le
 * patron est envoyé tant qu'il ne l'a pas activée, et `getCurrentCtx` l'y
 * renverrait en boucle.
 */

export type DebutActivationEcran =
  | { ok: true; cle: string; uri: string; carre: { cotes: number; chemin: string } }
  | { ok: false; message: string };

export async function commencerActivationAction(): Promise<DebutActivationEcran> {
  const ctx = await getCurrentCtxPourActiver();
  const [compte] = await db.select({ email: users.email }).from(users).where(eq(users.id, ctx.utilisateurId)).limit(1);
  const r = await commencerActivation(ctx.utilisateurId, compte?.email ?? "");
  if (!r.ok) return { ok: false, message: "La double vérification est déjà activée." };
  return { ok: true, cle: ecrireCle(r.secretBase32), uri: r.uri, carre: codeCarre(r.uri) };
}

export async function confirmerActivationAction(
  code: string
): Promise<{ ok: true; codesSecours: string[] } | { ok: false; message: string }> {
  const ctx = await getCurrentCtxPourActiver();
  const r = await confirmerActivation(ctx.utilisateurId, code);
  if (r.ok) return r;
  return {
    ok: false,
    message: r.refus === "code-faux" ? "Ce code n'est pas le bon." : "Recommencez depuis le début.",
  };
}

export async function desactiverAction(code: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await getCurrentCtx();
  // Le serveur refuse ce que l'écran ne propose pas : un interrupteur inerte se
  // contourne en appelant l'action à la main.
  const role = await getRole(ctx);
  if (doubleVerificationObligatoire(role ?? "", !horsProductionReelle())) {
    return { ok: false, message: "Elle est obligatoire pour votre rôle." };
  }
  const r = await desactiver(ctx.utilisateurId, code);
  return r.ok ? { ok: true } : { ok: false, message: "Ce code n'est pas le bon." };
}
