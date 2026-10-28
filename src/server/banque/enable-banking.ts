import { createSign } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { logger } from "../logger";
import { lireToutesLesPages, lireTransactions, type MouvementLu, type Transaction } from "@/lib/releve-bancaire";

/**
 * LIRE LES VIREMENTS REÇUS, PAR ENABLE BANKING — l'essai du 22 octobre 2026.
 *
 * Personne ne se branche directement à une banque : la loi européenne (DSP2)
 * impose un prestataire agréé (`docs/A-FAIRE.md` §13). Enable Banking laisse,
 * sans contrat, le propriétaire d'une application relier SES PROPRES comptes,
 * pour essayer. C'est ce que fait ce module, et rien de plus : il LIT. Aucun
 * paiement, aucun virement, aucune écriture au relevé de TVA.
 *
 * **LA CLÉ EST UN FICHIER, PAS UNE VARIABLE.** Enable Banking la fait
 * télécharger à l'inscription de l'application, sous le nom
 * `<identifiant de l'application>.pem`. Le patron la dépose dans
 * `cles-banque/`, à la racine de son espace, et c'est tout : l'identifiant se
 * lit dans le nom du fichier. Une clé de vingt-huit lignes à recoller dans
 * `.env.local` se casserait au premier retour à la ligne perdu, et rien ne
 * dirait pourquoi. `*.pem` est ignoré par git (`.gitignore`) : elle ne part
 * jamais sur GitHub.
 *
 * **Aucun refus ne lève.** Une exception en action serveur arrive chez lui en
 * identifiant opaque (`AGENTS.md`) : tout passe par une valeur de retour, avec
 * sa phrase, et la cause part au journal.
 */

const API = "https://api.enablebanking.com";
const DOSSIER_CLE = "cles-banque";
const NOM_DE_CLE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.pem$/i;

export type Refus = { ok: false; raison: string };

type Cle = { appId: string; pem: string };

/**
 * La clé déposée, ou ce qui ne va pas avec le dossier.
 *
 * Deux fichiers, c'est un refus et non un choix : prendre le premier venu
 * pourrait signer avec une application révoquée, et l'erreur d'Enable Banking
 * ne dirait jamais laquelle.
 */
export function cleDeposee(racine = process.cwd()): ({ ok: true } & Cle) | Refus {
  const dossier = path.join(racine, DOSSIER_CLE);
  let noms: string[];
  try {
    noms = readdirSync(dossier);
  } catch {
    return { ok: false, raison: `Le dossier ${DOSSIER_CLE} n'existe pas encore dans votre espace.` };
  }
  const cles = noms.filter((n) => NOM_DE_CLE.test(n));
  if (cles.length === 0) {
    return { ok: false, raison: `Aucun fichier .pem d'Enable Banking dans le dossier ${DOSSIER_CLE}.` };
  }
  if (cles.length > 1) {
    return { ok: false, raison: `Il y a ${cles.length} fichiers .pem dans ${DOSSIER_CLE}. Gardez seulement le dernier.` };
  }
  const appId = NOM_DE_CLE.exec(cles[0])![1];
  return { ok: true, appId, pem: readFileSync(path.join(dossier, cles[0]), "utf8") };
}

function base64url(contenu: string | Buffer): string {
  return Buffer.from(contenu).toString("base64url");
}

/** Le jeton RS256 qu'Enable Banking exige à chaque appel, valable une heure. */
function jeton(cle: Cle): string {
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = base64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: cle.appId }));
  const corps = base64url(
    JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: maintenant, exp: maintenant + 3600 })
  );
  const signature = createSign("RSA-SHA256").update(`${entete}.${corps}`).sign(cle.pem);
  return `${entete}.${corps}.${base64url(signature)}`;
}

async function appeler<T>(methode: "GET" | "POST", chemin: string, corps?: unknown): Promise<({ ok: true } & { donnees: T }) | Refus> {
  const cle = cleDeposee();
  if (!cle.ok) return cle;
  let reponse: Response;
  try {
    reponse = await fetch(`${API}${chemin}`, {
      method: methode,
      headers: { Authorization: `Bearer ${jeton(cle)}`, "Content-Type": "application/json" },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      cache: "no-store",
    });
  } catch (e) {
    logger.error("Enable Banking injoignable", { chemin, err: String(e) });
    return { ok: false, raison: "Enable Banking ne répond pas. Réessayez dans un moment." };
  }
  const texte = await reponse.text();
  if (!reponse.ok) {
    // Le corps part au journal tel quel : c'est lui qui dit « clé inconnue »
    // ou « adresse de retour non déclarée », et l'écran ne peut pas le deviner.
    logger.error("Enable Banking a refusé", { chemin, statut: reponse.status, reponse: texte.slice(0, 600) });
    return { ok: false, raison: `Enable Banking a refusé (${reponse.status}). ${raisonLisible(texte)}` };
  }
  try {
    return { ok: true, donnees: JSON.parse(texte) as T };
  } catch {
    logger.error("Réponse d'Enable Banking illisible", { chemin, statut: reponse.status });
    return { ok: false, raison: "La réponse d'Enable Banking est illisible." };
  }
}

/** Le message d'Enable Banking, quand il en donne un — c'est le seul qui sache. */
function raisonLisible(texte: string): string {
  try {
    const d = JSON.parse(texte) as { message?: unknown; detail?: unknown };
    const m = typeof d.message === "string" ? d.message : typeof d.detail === "string" ? d.detail : "";
    return m.slice(0, 200);
  } catch {
    return "";
  }
}

export type Banque = { nom: string };

/** Les banques françaises qu'Enable Banking sait relier, pour un compte pro. */
export async function banquesFrancaises(): Promise<({ ok: true; banques: Banque[] }) | Refus> {
  const r = await appeler<{ aspsps: { name: string; psu_types?: string[] }[] }>("GET", "/aspsps?country=FR&service=AIS");
  if (!r.ok) return r;
  const banques = r.donnees.aspsps
    .map((a) => ({ nom: a.name }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return { ok: true, banques };
}

/**
 * Ouvre la demande d'accord chez la banque. Rend l'adresse où l'envoyer.
 *
 * `business` et non `personal` : c'est son compte pro que le patron relie, et
 * certaines banques séparent les deux portes de connexion.
 */
export async function demanderAccord(demande: {
  banque: string;
  etat: string;
  retour: string;
  typeDeCompte: "business" | "personal";
}): Promise<({ ok: true; adresse: string }) | Refus> {
  const jusquA = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
  const r = await appeler<{ url: string }>("POST", "/auth", {
    access: { valid_until: jusquA },
    aspsp: { name: demande.banque, country: "FR" },
    state: demande.etat,
    redirect_url: demande.retour,
    psu_type: demande.typeDeCompte,
    language: "fr",
  });
  if (!r.ok) return r;
  return { ok: true, adresse: r.donnees.url };
}

/** Ce qu'il faut pour relire la banque : la session ouverte, et ses comptes. */
export type Liaison = { session: string; comptes: string[]; banque: string };

/** Échange le code rendu par la banque contre l'accès aux comptes cochés. */
export async function ouvrirSession(code: string): Promise<({ ok: true } & Liaison) | Refus> {
  const r = await appeler<{ session_id: string; accounts: { uid: string }[]; aspsp?: { name?: string } }>(
    "POST",
    "/sessions",
    { code }
  );
  if (!r.ok) return r;
  if (r.donnees.accounts.length === 0) {
    return { ok: false, raison: "La banque n'a donné accès à aucun compte. Recommencez en cochant votre compte pro." };
  }
  return {
    ok: true,
    session: r.donnees.session_id,
    comptes: r.donnees.accounts.map((a) => a.uid),
    banque: r.donnees.aspsp?.name ?? "",
  };
}

/**
 * Toutes les lignes du relevé depuis `depuis`, sur tous les comptes reliés, la plus récente d'abord.
 *
 * **Tout ou rien** : un compte dont une page échoue fait échouer la lecture
 * entière. Rien ne se range à moitié, puisque la lecture suivante ne relit pas
 * la part manquante (`fenetresDeLecture` repart du début du dossier, mais
 * l'écran afficherait sinon un relevé incomplet sans le dire).
 */
export async function mouvementsBancaires(liaison: Liaison, depuis: string): Promise<({ ok: true; mouvements: MouvementLu[] }) | Refus> {
  const mouvements: MouvementLu[] = [];
  for (const compte of liaison.comptes) {
    // Les pages d'un compte sont lues ENSEMBLE avant d'être rangées : les
    // répétitions sans référence se comptent sur tout le compte, pas page par page.
    const r = await lireToutesLesPages((suite) => {
      const parametres = new URLSearchParams({ date_from: depuis });
      if (suite) parametres.set("continuation_key", suite);
      return appeler<{ transactions: Transaction[]; continuation_key?: string | null }>(
        "GET",
        `/accounts/${encodeURIComponent(compte)}/transactions?${parametres}`
      ).then((x) => (x.ok ? { ok: true as const, ...x.donnees } : x));
    });
    if (!r.ok) return r;
    mouvements.push(...lireTransactions(compte, r.transactions));
  }
  mouvements.sort((a, b) => b.date.localeCompare(a.date));
  return { ok: true, mouvements };
}
