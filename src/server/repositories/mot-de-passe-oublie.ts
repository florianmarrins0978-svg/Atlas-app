import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { codesMotDePasse } from "@/server/db/schema";
import { getEnv } from "@/server/env";
import { envoyerCourriel } from "@/server/courriel";
import { logger } from "@/server/logger";
import { identifiantPourEmailProuve } from "@/server/identite-externe";
import { fermerToutesLesSessions } from "@/server/repositories/compte";
import { poserCondensatSurJeton } from "@/server/secret-authentification";
import { ESSAIS_MAX, VALIDITE_CODE_MS, verdictDeRenvoi, verdictDuCode } from "@/lib/code-verification";
import { verifierNouveauMotDePasse, type RefusMotDePasse } from "@/lib/mot-de-passe";
import {
  empreinteDeLaSaisie,
  empreinteDuCode,
  empreinteDuJeton,
  tirerUnCode,
  tirerUnJeton,
} from "@/server/empreinte-du-code";

/**
 * MOT DE PASSE OUBLIÉ — ce qui se lit et s'écrit en base.
 *
 * Sa demande du 24 septembre 2026, et son choix sur `appli/mot-de-passe-oublie.html` :
 * l'adresse, un code par e-mail, le nouveau mot de passe, et l'on entre.
 *
 * **Les règles du code ne sont pas redites ici** : durée, essais, renvois sont
 * ceux de la création du compte (`src/lib/code-verification.ts`). Deux jeux de
 * règles pour deux codes à six chiffres finiraient par diverger (`CLAUDE.md` §3).
 *
 * **Une adresse sans compte ne se distingue pas d'une autre** à la demande du
 * code : même réponse, aucun e-mail. L'écran de création dit déjà si une
 * adresse a un compte, mais ce n'est pas une raison pour en ouvrir une seconde
 * sonde ici, qui ne coûterait rien à qui veut les lister.
 */

function texteDuCode(code: string): { objet: string; texte: string } {
  return {
    objet: `Votre code Atlas : ${code}`,
    texte:
      `Votre code pour changer de mot de passe : ${code}\n\n` +
      `Il vaut un quart d'heure. Si vous n'avez rien demandé, ignorez ce message : votre mot de passe ne change pas.`,
  };
}

/**
 * Le compte est prévenu APRÈS le changement, à son adresse.
 *
 * Si ce n'est pas lui, c'est le seul signe qu'il aura : ses appareils sont
 * déconnectés, et un message lui dit pourquoi et quoi faire.
 */
function texteDuChangement(): { objet: string; texte: string } {
  return {
    objet: "Votre mot de passe Atlas a changé",
    texte:
      "Votre mot de passe vient d'être changé, et vos autres appareils ont été déconnectés.\n\n" +
      "Si ce n'est pas vous, changez-le tout de suite depuis l'écran de connexion, avec « Mot de passe oublié ? ».",
  };
}

/**
 * « Recevoir un code », puis « Renvoyer le code » : le même geste.
 *
 * Une ligne déjà là (un essai d'hier, un appui de trop) passe par
 * `verdictDeRenvoi`, qui borne ce qu'on peut faire partir vers une adresse.
 * Un code neuf tue le précédent et le jeton éventuel : deux preuves vivantes
 * doubleraient les chances d'un devineur.
 */
export async function envoyerUnCode(email: string): Promise<{ ok: true } | { ok: false; refus: string }> {
  const utilisateurId = await identifiantPourEmailProuve(email);
  if (!utilisateurId) return { ok: true };

  const code = tirerUnCode();
  const empreinte = empreinteDuCode(code, utilisateurId, getEnv().authSecret);
  const maintenant = new Date();
  const decision = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    const [ligne] = await tx
      .select()
      .from(codesMotDePasse)
      .where(eq(codesMotDePasse.utilisateurId, utilisateurId))
      .for("update")
      .limit(1);
    const expireLe = new Date(maintenant.getTime() + VALIDITE_CODE_MS);
    if (!ligne) {
      await tx.insert(codesMotDePasse).values({ utilisateurId, empreinte, expireLe });
      return { ok: true as const };
    }
    const verdict = verdictDeRenvoi(ligne, maintenant);
    if (!verdict.ok) return verdict;
    await tx
      .update(codesMotDePasse)
      .set({
        empreinte,
        expireLe,
        essais: 0,
        envois: verdict.nouvelleFenetre ? 1 : ligne.envois + 1,
        dernierEnvoi: maintenant,
        jetonEmpreinte: null,
        jetonExpireLe: null,
        ...(verdict.nouvelleFenetre ? { creeLe: maintenant } : {}),
      })
      .where(eq(codesMotDePasse.utilisateurId, utilisateurId));
    return { ok: true as const };
  });
  if (!decision.ok) return decision;

  // La saisie, mise en minuscules, EST l'adresse du compte : c'est sur elle
  // exactement que le compte a été trouvé.
  const envoi = await envoyerCourriel({ a: email.trim().toLowerCase(), ...texteDuCode(code) });
  if (envoi.ok) return { ok: true };
  logger.error("Code de mot de passe oublié non envoyé", { raison: envoi.raison });
  return { ok: false, refus: "Le code n’a pas pu partir. Réessayez dans un instant." };
}

export type VerdictDuCodeOublie =
  | { ok: true; jeton: string }
  | { ok: false; refus: string; codeMort: boolean };

/**
 * Le code saisi. Juste : il meurt, et un jeton naît.
 *
 * **Le code est tué en portant ses essais au maximum**, pas en effaçant la
 * ligne : elle porte le jeton, et « Renvoyer » doit toujours y lire le compte
 * de ses envois. Retaper le même code rend donc « Trop d’essais », jamais un
 * second jeton.
 *
 * Une adresse sans compte, ou sans code demandé, rend « Code incorrect. » :
 * la même phrase qu'un mauvais code.
 */
export async function verifierLeCodeOublie(email: string, saisie: string): Promise<VerdictDuCodeOublie> {
  const incorrect = { ok: false as const, refus: "Code incorrect.", codeMort: false };
  const utilisateurId = await identifiantPourEmailProuve(email);
  if (!utilisateurId) return incorrect;

  return db.transaction(async (tx): Promise<VerdictDuCodeOublie> => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    const [ligne] = await tx
      .select()
      .from(codesMotDePasse)
      .where(eq(codesMotDePasse.utilisateurId, utilisateurId))
      .for("update")
      .limit(1);
    if (!ligne) return incorrect;

    const verdict = verdictDuCode(ligne, empreinteDeLaSaisie(saisie, utilisateurId, getEnv().authSecret));
    if (!verdict.ok) {
      await tx
        .update(codesMotDePasse)
        .set({ essais: ligne.essais + 1 })
        .where(eq(codesMotDePasse.utilisateurId, utilisateurId));
      return verdict;
    }
    const jeton = tirerUnJeton();
    await tx
      .update(codesMotDePasse)
      .set({
        essais: ESSAIS_MAX,
        jetonEmpreinte: empreinteDuJeton(jeton),
        jetonExpireLe: new Date(Date.now() + VALIDITE_CODE_MS),
      })
      .where(eq(codesMotDePasse.utilisateurId, utilisateurId));
    return { ok: true, jeton };
  });
}

export type ResultatNouveauMotDePasse =
  | { ok: true }
  | { ok: false; refus: RefusMotDePasse }
  | { ok: false; refus: "jeton-mort" };

/**
 * Le nouveau mot de passe, sur présentation du jeton.
 *
 * La règle de longueur est celle du changement dans les réglages, la même
 * fonction. Le condensat est posé EN BASE, par `reinitialiser_mot_de_passe`,
 * qui consomme le jeton : `atlas_app` n'a pas le droit d'écrire
 * `password_hash` lui-même (migrations 0064 et 0100).
 *
 * **Puis tout ce qui était ouvert se ferme**, comme « me déconnecter
 * partout » : sessions, preuves récentes, clés Face ID. Un mot de passe qu'on
 * remplace est peut-être connu d'un autre. **La coupure est la seconde
 * entière en cours, arrondie vers le BAS** : la session que l'appelant ouvre à
 * l'instant d'après porte une seconde égale ou postérieure, et survit.
 * Arrondie vers le haut (comme « partout »), elle la couperait aussitôt.
 */
export async function poserLeNouveauMotDePasse(
  email: string,
  jeton: string,
  nouveau: string,
  confirmation: string
): Promise<ResultatNouveauMotDePasse> {
  const refus = verifierNouveauMotDePasse(nouveau, confirmation);
  if (refus) return { ok: false, refus };

  const utilisateurId = await identifiantPourEmailProuve(email);
  if (!utilisateurId) return { ok: false, refus: "jeton-mort" };

  const pose = await poserCondensatSurJeton(utilisateurId, empreinteDuJeton(jeton), await hash(nouveau, 10));
  if (!pose) return { ok: false, refus: "jeton-mort" };

  await fermerToutesLesSessions(utilisateurId, new Date(Math.floor(Date.now() / 1000) * 1000));

  const envoi = await envoyerCourriel({ a: email.trim().toLowerCase(), ...texteDuChangement() });
  if (!envoi.ok) logger.error("Avis de changement de mot de passe non envoyé", { raison: envoi.raison });
  return { ok: true };
}
