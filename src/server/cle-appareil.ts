import { cookies, headers } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/types";
import { getEnv } from "./env";
import { estBancDEssai } from "../profil-banc";
import { origineWebAuthn, type OrigineWebAuthn } from "../lib/origine-webauthn";
import { estRejeu, nommerAppareil, type RefusCle } from "../lib/cle-appareil";
import { ajouterCle, cleParIdentifiant, identifiantsDe, noterUsage } from "./repositories/cles-appareil";

/**
 * « Ouvrir avec Face ID » — les deux échanges avec le téléphone.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI SE PASSE, EN CLAIR.** WebAuthn tient en deux allers-retours :
 *
 *   1. Atlas envoie un **défi** — un nombre tiré au hasard, jamais réutilisé ;
 *   2. le téléphone demande le visage, **signe le défi** avec une clé privée
 *      qui ne sort jamais de sa puce, et renvoie la signature ;
 *   3. Atlas vérifie la signature avec la clé **publique** qu'il garde.
 *
 * Rien de biométrique ne circule. Le visage n'est qu'un cran de plus sur la
 * porte du téléphone, du côté du téléphone.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI LE DÉFI VIT DANS UN COOKIE, et ce que cela suppose.**
 *
 * Il doit survivre entre les deux allers-retours, et il doit être **à nous**.
 * Le laisser au navigateur en clair permettrait de le rejouer indéfiniment.
 *
 * Le cookie est donc `httpOnly` (le JavaScript de la page ne le lit pas),
 * `sameSite: strict` (un autre site ne le fait pas partir), et il est **effacé
 * dès qu'il a servi** — un défi qui resservirait n'est plus un défi.
 *
 * `secure` suit l'adresse réelle : posé en dur, il ferait disparaître le cookie
 * sur `http://localhost`, et Face ID cesserait de fonctionner en développement
 * sans qu'aucun message ne le dise.
 *
 * **Pas de table pour ça**, et c'est un choix : une table de défis se remplirait
 * de lignes que personne n'utilise (il suffit de toucher le bouton puis de
 * partir), et il faudrait la balayer. Le cookie meurt tout seul.
 */

const DEFI_ENREGISTREMENT = "atlas-defi-enregistrement";
const DEFI_CONNEXION = "atlas-defi-connexion";

/** Cinq minutes : le temps de chercher son téléphone, pas celui d'une journée. */
const DEFI_DUREE_S = 5 * 60;

export type ContexteWebAuthn = { origine: OrigineWebAuthn; refus: null } | { origine: null; refus: string };

/**
 * Sous quel domaine Atlas se nomme, pour CETTE requête.
 *
 * La règle est pure (`src/lib/origine-webauthn.ts`) ; ici on ne fait que lui
 * donner ce que la requête porte.
 */
export async function contexteWebAuthn(origineNavigateur?: string | null): Promise<ContexteWebAuthn> {
  const env = getEnv();
  const entetes = await headers();
  const verdict = origineWebAuthn({
    // `x-forwarded-host` d'abord : derrière le mandataire du banc, `host` porte
    // l'adresse interne, et une clé enregistrée dessus ne s'ouvrirait nulle part.
    hote: entetes.get("x-forwarded-host") ?? entetes.get("host"),
    protocole: entetes.get("x-forwarded-proto"),
    domaineEpingle: env.rpId ?? null,
    horsProduction: env.nodeEnv !== "production" || estBancDEssai(),
    // Le tunnel de son espace ne transmet AUCUN en-tête d'adresse publique :
    // l'écran nous donne celle de la barre d'adresse (`ARCHITECTURE.md` §177).
    origineNavigateur,
  });
  if (!verdict.ok) {
    // Journalisé, parce que ce refus-là n'est jamais la faute de l'artisan :
    // c'est une configuration. Le message qu'il lit, lui, reste doux.
    console.error(`[cle-appareil] origine refusée (${verdict.code}) : ${verdict.raison}`);
    return { origine: null, refus: verdict.raison };
  }
  return { origine: verdict.origine, refus: null };
}

/**
 * **Le défi ET l'origine sous laquelle il a été posé, dans le même cookie.**
 *
 * La vérification arrive dans une SECONDE requête, et rien ne garantit qu'elle
 * porte la même adresse — l'écran pourrait ne pas la retransmettre, un onglet
 * pourrait avoir changé. Recalculer l'origine à ce moment-là, c'est risquer de
 * vérifier sous un domaine différent de celui qui a servi à fabriquer la clé :
 * un refus incompréhensible, après un geste réussi.
 *
 * Le cookie est `httpOnly` : ce qu'on y range n'est pas modifiable depuis la
 * page, donc le suivre n'affaiblit rien.
 */
type DefiPose = { defi: string; origine: OrigineWebAuthn };

async function poserDefi(nom: string, defi: string, origine: OrigineWebAuthn): Promise<void> {
  const boite = await cookies();
  boite.set(nom, JSON.stringify({ defi, origine } satisfies DefiPose), {
    httpOnly: true,
    sameSite: "strict",
    secure: origine.origine.startsWith("https://"),
    path: "/",
    maxAge: DEFI_DUREE_S,
  });
}

async function prendreDefi(nom: string): Promise<DefiPose | null> {
  const boite = await cookies();
  const valeur = boite.get(nom)?.value ?? null;
  // **Consommé à la lecture, réussite ou non.** Un défi qui survivrait à un
  // essai raté se rejouerait ; on préfère faire recommencer le geste.
  if (valeur) boite.delete(nom);
  if (!valeur) return null;
  try {
    const lu = JSON.parse(valeur) as Partial<DefiPose>;
    if (typeof lu?.defi !== "string" || !lu.defi) return null;
    if (typeof lu?.origine?.rpId !== "string" || typeof lu?.origine?.origine !== "string") return null;
    return { defi: lu.defi, origine: lu.origine };
  } catch {
    // Un cookie d'avant cette version : il portait le défi nu. Le faire
    // recommencer vaut mieux que de vérifier sous une origine devinée.
    console.warn("[cle-appareil] défi illisible — geste à refaire");
    return null;
  }
}

// ─── L'ENREGISTREMENT : poser une clé sur cet appareil ───────────────────────

export type OptionsEnregistrement =
  | { ok: true; options: Awaited<ReturnType<typeof generateRegistrationOptions>> }
  | { ok: false; raison: string };

/**
 * Ce qu'il faut envoyer au navigateur pour qu'il fabrique une clé.
 *
 * **`residentKey: "required"` — et c'est ce qui rend la porte utilisable.** Une
 * clé « découvrable » est retenue par le téléphone avec le compte qu'elle
 * ouvre : Atlas peut alors demander un visage **sans savoir qui est en face**,
 * ce qui est exactement la promesse de sa proposition B — un doigt, et on est
 * dedans, sans taper une adresse. Sans elle, il faudrait d'abord saisir son
 * e-mail, et le geste rapide n'existerait plus.
 *
 * **`userVerification: "required"` — le visage, pas seulement la présence.**
 * Sans ce mot, un appareil peut se contenter d'un effleurement : la clé
 * ouvrirait alors le compte pour quiconque tient le téléphone, ce qui est moins
 * sûr que le mot de passe qu'elle remplace.
 *
 * **`excludeCredentials` — pour que l'appareil dise NON lui-même.** Sans cette
 * liste, réenregistrer un téléphone déjà enregistré fabriquerait une seconde
 * clé pour le même appareil, et la liste des Réglages se remplirait de doublons
 * indiscernables.
 */
export async function optionsEnregistrement(
  utilisateur: {
    id: string;
    email: string;
    nom: string | null;
  },
  origineNavigateur?: string | null
): Promise<OptionsEnregistrement> {
  const ctx = await contexteWebAuthn(origineNavigateur);
  if (!ctx.origine) return { ok: false, raison: ctx.refus };

  const deja = await identifiantsDe(utilisateur.id);
  const options = await generateRegistrationOptions({
    rpName: "Atlas",
    rpID: ctx.origine.rpId,
    userID: utilisateur.id,
    userName: utilisateur.email,
    userDisplayName: utilisateur.nom ?? utilisateur.email,
    attestationType: "none",
    excludeCredentials: deja.map((id) => ({ id: isoBase64URL.toBuffer(id), type: "public-key" as const })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      // **La clé reste DANS l'appareil.** Une clé USB conviendrait
      // techniquement, mais ce n'est pas ce qu'il a demandé — et l'écran
      // promet « sur cet appareil seulement ». Un écran qui promet une chose et
      // en fait une autre est pire qu'un écran muet.
      authenticatorAttachment: "platform",
    },
  });

  await poserDefi(DEFI_ENREGISTREMENT, options.challenge, ctx.origine);
  return { ok: true, options };
}

export type ResultatEnregistrement = { ok: true; nomAppareil: string } | { ok: false; refus: RefusCle };

/** Vérifier la clé que l'appareil vient de fabriquer, et la poser. */
export async function enregistrerCle(
  utilisateurId: string,
  reponse: RegistrationResponseJSON
): Promise<ResultatEnregistrement> {
  // **L'origine vient du DÉFI, pas d'un nouveau calcul.** La clé a été
  // fabriquée sous celle-là ; la recalculer ici ferait échouer la vérification
  // dès que la seconde requête ne porte pas la même adresse.
  const defi = await prendreDefi(DEFI_ENREGISTREMENT);
  if (!defi) return { ok: false, refus: "panne-activation" };

  let verifie;
  try {
    verifie = await verifyRegistrationResponse({
      response: reponse,
      expectedChallenge: defi.defi,
      expectedOrigin: defi.origine.origine,
      expectedRPID: defi.origine.rpId,
      requireUserVerification: true,
    });
  } catch (erreur) {
    console.error("[cle-appareil] enregistrement refusé par la vérification", erreur);
    return { ok: false, refus: "panne-activation" };
  }

  if (!verifie.verified || !verifie.registrationInfo) return { ok: false, refus: "panne-activation" };

  const { credentialID, credentialPublicKey, counter } = verifie.registrationInfo;
  const entetes = await headers();
  const nomAppareil = nommerAppareil(entetes.get("user-agent"));

  const pose = await ajouterCle({
    utilisateurId,
    identifiantCle: isoBase64URL.fromBuffer(credentialID),
    clePublique: isoBase64URL.fromBuffer(credentialPublicKey),
    compteur: counter,
    nomAppareil,
  });
  if (!pose.ok) return { ok: false, refus: pose.refus };
  return { ok: true, nomAppareil };
}

// ─── LA CONNEXION : ouvrir avec une clé déjà posée ───────────────────────────

export type OptionsConnexion =
  | { ok: true; options: Awaited<ReturnType<typeof generateAuthenticationOptions>> }
  | { ok: false; raison: string };

/**
 * Le défi qu'on envoie à la porte.
 *
 * **`allowCredentials` est délibérément VIDE.** À cet instant, personne ne
 * s'est nommé : c'est au téléphone de proposer les comptes qu'il connaît. En
 * poser une liste supposerait de savoir de qui il s'agit — donc de le
 * demander — et cela dirait au passage, à n'importe qui, quelles clés sont
 * enregistrées sur une adresse donnée.
 */
export async function optionsConnexion(origineNavigateur?: string | null): Promise<OptionsConnexion> {
  const ctx = await contexteWebAuthn(origineNavigateur);
  if (!ctx.origine) return { ok: false, raison: ctx.refus };

  const options = await generateAuthenticationOptions({
    rpID: ctx.origine.rpId,
    userVerification: "required",
  });
  await poserDefi(DEFI_CONNEXION, options.challenge, ctx.origine);
  return { ok: true, options };
}

export type CompteOuvert = { id: string; email: string; nom: string | null };

/**
 * Vérifier la signature, et dire QUI vient d'entrer.
 *
 * **Rend `null` pour tous les refus, et c'est assumé.** Distinguer « cette clé
 * n'existe pas » de « le compteur a reculé » à l'écran obligerait à refaire ici
 * la moitié du raisonnement pour composer un message — soit deux rédactions de
 * la même règle, ce que `CLAUDE.md` §3 interdit. La cause exacte part au
 * journal, qui est fait pour ça ; l'artisan, lui, retombe sur son mot de passe,
 * qui marche.
 *
 * **Ce qui n'arrive JAMAIS ici : `noterEchec`.** Un visage mal reconnu ne doit
 * pas temporiser le compte de son propriétaire — ce serait la panne du 6 août
 * 2026 refaite par l'autre bord (`src/lib/cle-appareil.ts`).
 */
export async function ouvrirAvecCle(reponse: AuthenticationResponseJSON): Promise<CompteOuvert | null> {
  // Même raison qu'à l'enregistrement : l'origine qui a servi à SIGNER est
  // celle du défi, jamais celle que la seconde requête laisse deviner.
  const defi = await prendreDefi(DEFI_CONNEXION);
  if (!defi) {
    console.warn("[cle-appareil] connexion sans défi en cours — geste trop tardif, ou cookie perdu");
    return null;
  }

  const cle = await cleParIdentifiant(reponse.id);
  if (!cle) {
    console.warn("[cle-appareil] clé inconnue présentée à la connexion");
    return null;
  }

  let verifie;
  try {
    verifie = await verifyAuthenticationResponse({
      response: reponse,
      expectedChallenge: defi.defi,
      expectedOrigin: defi.origine.origine,
      expectedRPID: defi.origine.rpId,
      requireUserVerification: true,
      authenticator: {
        // L'identifiant TEL QU'IL EST EN BASE, jamais celui que la réponse
        // porte : c'est la ligne retrouvée qui fait foi, pas ce qu'on nous
        // présente.
        credentialID: isoBase64URL.toBuffer(cle.identifiantCle),
        credentialPublicKey: isoBase64URL.toBuffer(cle.clePublique),
        counter: cle.compteur,
      },
    });
  } catch (erreur) {
    console.warn("[cle-appareil] signature refusée", erreur);
    return null;
  }

  if (!verifie.verified) return null;

  if (estRejeu(cle.compteur, verifie.authenticationInfo.newCounter)) {
    // On ne retire pas la clé pour autant : un authentificateur qui compte mal
    // n'est pas forcément une clé volée, et effacer la porte de quelqu'un sur
    // un soupçon lui coûterait son accès rapide sans preuve.
    console.error("[cle-appareil] compteur en recul — rejeu possible, connexion refusée");
    return null;
  }

  await noterUsage(cle.id, verifie.authenticationInfo.newCounter);
  return { id: cle.utilisateurId, email: cle.email, nom: cle.nom };
}
