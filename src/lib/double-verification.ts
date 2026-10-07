/**
 * LA DOUBLE VÉRIFICATION : le code de l'appli d'authentification, et ses
 * règles. Fonctions pures, éprouvées par `scripts/test-double-verification.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa décision du 30 septembre 2026, sur la planche
 * `appli/double-verification.html` :** l'appli d'authentification plutôt qu'un
 * code par e-mail, obligatoire pour le patron et la facturation (« la A »), et
 * « ne plus demander sur cet appareil » pendant trente jours (« oui »).
 *
 * **Pourquoi elle existe.** Jusque-là, un mot de passe volé suffisait : Face ID
 * était facultatif, et la porte du mot de passe restait ouverte à côté. Le code
 * du téléphone ferme cette porte-là ; Face ID entre toujours sans code, parce
 * qu'il vaut déjà deux preuves (le téléphone qu'on tient, le visage qui l'ouvre).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Pourquoi la norme est recodée ici plutôt que prise dans une bibliothèque.**
 * Elle tient en vingt lignes (RFC 6238 sur RFC 4226), et la suite la confronte
 * aux vecteurs publiés par la norme elle-même. Une dépendance de plus pour
 * vingt lignes vérifiables, c'est une porte de plus dans la chaîne
 * d'approvisionnement, au cœur de la connexion.
 */
import { createHmac } from "node:crypto";

/** Six chiffres, trente secondes, SHA1 : ce que toutes les applis lisent par défaut. */
export const CHIFFRES = 6;
export const PERIODE_SECONDES = 30;

/** Dix codes de secours, chacun valable une fois. */
export const NOMBRE_CODES_SECOURS = 10;

/**
 * Cinq essais par connexion en attente, puis il faut retaper le mot de passe.
 * Le mot de passe lui-même est temporisé (`src/lib/tentatives-connexion.ts`) :
 * c'est ce qui borne la devinette du code, pas ce nombre seul.
 */
export const ESSAIS_MAX_CODE = 5;

/** Le temps de sortir son téléphone et d'ouvrir l'appli. */
export const DUREE_CONNEXION_EN_ATTENTE_MS = 5 * 60 * 1000;

/** « Ne plus demander sur cet appareil » : sa réponse « oui », trente jours. */
export const DUREE_APPAREIL_RETENU_MS = 30 * 24 * 60 * 60 * 1000;

const ALPHABET_BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648, sans remplissage : c'est la forme qu'attendent les applis. */
export function base32Encode(octets: Uint8Array): string {
  let bits = 0;
  let valeur = 0;
  let sortie = "";
  for (const octet of octets) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET_BASE32[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += ALPHABET_BASE32[(valeur << (5 - bits)) & 31];
  return sortie;
}

/**
 * Relit une clé, y compris recopiée à la main (minuscules, espaces). `null`
 * quand un caractère n'appartient pas à l'alphabet : une clé fausse ne doit pas
 * produire en silence des codes qu'aucune appli ne donnera jamais.
 */
export function base32Decode(texte: string): Buffer | null {
  const propre = texte.toUpperCase().replace(/[\s=]/g, "");
  let bits = 0;
  let valeur = 0;
  const octets: number[] = [];
  for (const c of propre) {
    const i = ALPHABET_BASE32.indexOf(c);
    if (i < 0) return null;
    valeur = (valeur << 5) | i;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

/** Le numéro de la tranche de trente secondes où tombe cet instant. */
export function pasDeTemps(maintenantMs: number): number {
  return Math.floor(maintenantMs / 1000 / PERIODE_SECONDES);
}

/** RFC 4226 : le code d'une tranche, tel que l'appli l'affiche. */
export function codeTotp(secret: Buffer, pas: number): string {
  const compteur = Buffer.alloc(8);
  // Deux moitiés de 32 bits : un pas dépasse 2³¹ bien après nous, mais la
  // norme l'écrit sur huit octets et le vecteur de l'an 2603 le vérifie.
  compteur.writeUInt32BE(Math.floor(pas / 2 ** 32), 0);
  compteur.writeUInt32BE(pas >>> 0, 4);
  const hmac = createHmac("sha1", secret).update(compteur).digest();
  const decalage = hmac[hmac.length - 1] & 0x0f;
  const nombre =
    ((hmac[decalage] & 0x7f) << 24) |
    (hmac[decalage + 1] << 16) |
    (hmac[decalage + 2] << 8) |
    hmac[decalage + 3];
  return String(nombre % 10 ** CHIFFRES).padStart(CHIFFRES, "0");
}

export type VerdictCode = { ok: true; pas: number } | { ok: false };

/**
 * Le code tapé est-il celui du moment ?
 *
 * **Une tranche de chaque côté**, pas plus : le téléphone et le serveur ne sont
 * jamais à l'heure à la seconde près, et un code tapé à la 29ᵉ seconde arrive
 * à la suivante. Au-delà, c'est un vieux code.
 *
 * **`dernierPas` refuse le rejeu** : un code déjà servi ne rouvre pas, même
 * dans ses trente secondes. Lu par-dessus l'épaule, il est mort.
 */
export function verifierCodeTotp(
  secret: Buffer,
  saisie: string,
  maintenantMs: number,
  dernierPas: number | null
): VerdictCode {
  const code = saisie.replace(/\s/g, "");
  if (!new RegExp(`^\\d{${CHIFFRES}}$`).test(code)) return { ok: false };
  const centre = pasDeTemps(maintenantMs);
  for (const pas of [centre - 1, centre, centre + 1]) {
    if (dernierPas !== null && pas <= dernierPas) continue;
    if (egauxEnTempsConstant(codeTotp(secret, pas), code)) return { ok: true, pas };
  }
  return { ok: false };
}

function egauxEnTempsConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let ecart = 0;
  for (let i = 0; i < a.length; i++) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ecart === 0;
}

/**
 * L'adresse que lit l'appli d'authentification, par le code carré ou par le
 * bouton du téléphone. Le nom du compte est l'adresse e-mail : c'est ce qu'il
 * lira dans son appli, à côté d'« Atlas », s'il en a plusieurs.
 */
export function uriOtpauth(secretBase32: string, email: string): string {
  const etiquette = encodeURIComponent(`Atlas:${email}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer: "Atlas",
    algorithm: "SHA1",
    digits: String(CHIFFRES),
    period: String(PERIODE_SECONDES),
  });
  return `otpauth://totp/${etiquette}?${params.toString()}`;
}

/** La clé écrite par groupes de quatre, pour la recopier sans se perdre. */
export function ecrireCle(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * **Ni 0, ni 1, ni I, ni O** : il recopie ces codes sur un papier, puis les
 * relit un jour de panique. Trente-deux signes, donc cinq bits chacun : huit
 * signes font quarante bits, hors de portée avec cinq essais par connexion.
 */
export const ALPHABET_SECOURS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Huit signes tirés de huit octets aléatoires (le tirage est au serveur). */
export function codeSecoursDepuis(octets: Uint8Array): string {
  return Array.from(octets.slice(0, 8), (o) => ALPHABET_SECOURS[o % 32]).join("");
}

export function ecrireCodeSecours(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Ce qu'il tape, ramené à la forme enregistrée, ou `null`. Minuscules, tiret
 * ou espace : il recopie de son papier, et un tiret oublié n'est pas un code
 * faux.
 */
export function normaliserCodeSecours(saisie: string): string | null {
  const propre = saisie.toUpperCase().replace(/[\s-]/g, "");
  if (propre.length !== 8) return null;
  for (const c of propre) if (!ALPHABET_SECOURS.includes(c)) return null;
  return propre;
}

/**
 * Qui DOIT l'activer avant d'entrer.
 *
 * **Le patron et la facturation** : ceux qui voient l'IBAN, l'export complet,
 * et qui encaissent. Facultative pour les autres.
 *
 * **En production réelle seulement.** Sur le banc d'essai et dans la batterie
 * (`ATLAS_PROFIL=banc`), personne n'est forcé : la batterie entre en patron
 * dans plus de cent suites, et le banc garde ses comptes tels qu'ils sont.
 * Chacun peut quand même l'activer, partout.
 */
export function doubleVerificationObligatoire(role: string, productionReelle: boolean): boolean {
  if (!productionReelle) return false;
  return role === "proprietaire" || role === "facturation";
}
