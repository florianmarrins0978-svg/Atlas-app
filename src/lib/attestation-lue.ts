/**
 * CE QUE L'IA A LU SUR L'ATTESTATION DÉPOSÉE — sa demande du 7 octobre 2026,
 * après y avoir déposé une photo quelconque et l'avoir vue acceptée : *« je
 * sais pas vraiment à quoi ça sert »*.
 *
 * Le dépôt ne vérifie que le FORMAT (`attestation-decennale.ts`). Cette lecture
 * dit ce que le fichier porte, et **ne bloque jamais rien** : sa règle du même
 * jour, *« jamais de blocage »*. Ce qu'elle trouve se rappelle
 * (`rappelsDuDevis`), comme le reste de la décennale.
 *
 * Fonction pure, éprouvée sans clé (`scripts/test-attestation-lue.ts`) ; l'appel
 * au fournisseur vit dans `src/server/ai/services/lire-attestation.ts`.
 */

export type AttestationLue = {
  /** Le fichier est-il une attestation d'assurance décennale ? */
  estAttestationDecennale: boolean;
  /** L'assureur qui y est écrit ; `null` s'il ne se lit pas. */
  assureur: string | null;
  /** « AAAA-MM-JJ », la fin de validité écrite ; `null` si elle ne se lit pas. */
  finValidite: string | null;
};

/**
 * Le texte du modèle, transformé en lecture, ou `null` s'il n'en rend aucune.
 *
 * **`null` ne vaut jamais « pas une attestation »** : une réponse illisible ne
 * dit rien du fichier, et l'accuser à tort lui ferait douter d'un vrai papier.
 * Seul un `false` écrit par le modèle le dit.
 */
export function lireReponseAttestation(texte: string): AttestationLue | null {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut === -1 || fin <= debut) return null;
  let brut: Record<string, unknown>;
  try {
    brut = JSON.parse(texte.slice(debut, fin + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof brut.est_attestation_decennale !== "boolean") return null;
  const chaine = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const p = v.trim();
    return p === "" || p.toLowerCase() === "null" ? null : p;
  };
  const date = chaine(brut.fin_validite);
  // Une date doit avoir la forme ET exister : « 2026-02-31 » se refuse, sans
  // quoi elle annoncerait une expiration qui n'est écrite nulle part.
  const dateValide =
    date !== null && /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
      ? date
      : null;
  return {
    estAttestationDecennale: brut.est_attestation_decennale,
    assureur: chaine(brut.assureur),
    finValidite: dateValide,
  };
}

/** Sans accents, sans casse, sans ponctuation : « AXA France IARD » contient « Axa ». */
const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const enToutesLettres = (jour: string) =>
  new Date(`${jour}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Ce que la lecture invite à vérifier, en phrases pour l'écran. Vide : rien à
 * redire, ou rien n'a été lu.
 *
 * **Une seule règle pour Réglages et pour la feuille d'envoi** (`CLAUDE.md` §3) :
 * les deux lisent ces phrases.
 */
export function remarquesSurLAttestation(
  lue: AttestationLue | null | undefined,
  assureurSaisi: string | null | undefined,
  jour: string
): { cle: string; libelle: string }[] {
  if (!lue) return [];
  if (!lue.estAttestationDecennale) {
    return [{ cle: "decennale-attestation-douteuse", libelle: "Votre attestation ne ressemble pas à une attestation décennale" }];
  }
  const r: { cle: string; libelle: string }[] = [];
  if (lue.finValidite !== null && lue.finValidite < jour) {
    r.push({
      cle: "decennale-attestation-expiree",
      libelle: `Votre attestation décennale a expiré le ${enToutesLettres(lue.finValidite)}`,
    });
  }
  const saisi = normal(assureurSaisi ?? "");
  const ecrit = normal(lue.assureur ?? "");
  // Un nom qui ne se lit pas ne se compare pas : se taire plutôt qu'accuser.
  if (saisi !== "" && ecrit !== "" && !ecrit.includes(saisi) && !saisi.includes(ecrit)) {
    r.push({
      cle: "decennale-attestation-assureur",
      libelle: `Votre attestation est au nom de ${lue.assureur}, et vous avez saisi ${String(assureurSaisi).trim()}`,
    });
  }
  return r;
}
