import { PDFDocument } from "pdf-lib";
import { contenuDeLAttestation, courrielDeLAttestation, texteDuTampon, type SaisieLue } from "@/lib/attestation-comptable";
import { jourIso } from "@/lib/jour";
import { logger } from "./logger";
import { enregistrerObjet, supprimerObjet } from "./storage";
import { composerAttestation } from "./pdf/attestation-comptable-pdf";
import { dossierASignerParJeton, rangerAttestationParJeton, type AttestationDuDossier } from "./repositories/verification-comptable";

/**
 * SIGNER L'ATTESTATION — lot 6 de « Pour mon comptable », sa planche du
 * 27 octobre 2026 (`appli/soignee/comptable-attestation.html`).
 *
 * Le chemin, dans l'ordre : relire le dossier par le jeton (refusé tant qu'une
 * ligne reste à vérifier), composer le PDF à partir des verdicts relus, le
 * ranger, puis enregistrer l'attestation, refusée si un verdict a bougé entre
 * les deux lectures. Le PDF d'une signature refusée s'efface.
 */

/** Un dessin du doigt pèse quelques dizaines de kilo-octets ; au-delà, ce n'est pas une signature. */
const SIGNATURE_MAX_OCTETS = 400_000;

export type ResultatSignature =
  | { ok: true; attestation: AttestationDuDossier; courriel: { a: string; objet: string; texte: string } | null }
  | { ok: false; raison: string };

/**
 * La signature est-elle une image que le PDF sait poser ? Le navigateur du
 * comptable n'a pas de compte : ce qu'il envoie se relit comme un fichier
 * venu d'ailleurs, par son en-tête et par la bibliothèque qui le posera.
 */
async function signatureLisible(png: Uint8Array): Promise<boolean> {
  if (png.length < 8 || png.length > SIGNATURE_MAX_OCTETS) return false;
  if (png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) return false;
  try {
    await (await PDFDocument.create()).embedPng(png);
    return true;
  } catch (err) {
    logger.warn("Une signature de comptable illisible a été refusée", { erreur: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

export async function signerLAttestation(jeton: string, saisie: SaisieLue, signaturePng: Uint8Array, maintenant: Date): Promise<ResultatSignature> {
  const lu = await dossierASignerParJeton(jeton, maintenant);
  if (!lu.ok) return lu;
  if (!(await signatureLisible(signaturePng))) return { ok: false, raison: "La signature n'est pas lisible. Signez à nouveau." };

  const d = lu.dossier;
  const jour = jourIso(maintenant);
  const contenu = contenuDeLAttestation({
    entreprise: d.entreprise,
    du: d.du,
    au: d.au,
    conclusion: saisie.conclusion,
    observations: saisie.observations,
    lignes: d.lignes,
    signataire: saisie.signataire,
    signeLe: jour,
    empreinteDuDossier: d.empreinteDuDossier,
  });
  const pdf = await composerAttestation(contenu, signaturePng, texteDuTampon(saisie.conclusion, saisie.signataire.societe, jour), saisie.signataire.societe);

  const objet = await enregistrerObjet(`entreprises/${d.entrepriseId}/attestations`, Buffer.from(pdf), ".pdf", "application/pdf");
  const r = await rangerAttestationParJeton(
    jeton,
    {
      saisie,
      etat: d.etat,
      lignes: contenu.comptes.lignes,
      rejetees: contenu.comptes.rejetees,
      fichierCle: objet.storageKey,
      tailleOctets: objet.tailleOctets,
      empreinte: objet.checksum,
    },
    maintenant
  );
  if (!r.ok) {
    await supprimerObjet(objet.storageKey);
    return r;
  }
  return {
    ok: true,
    attestation: r.attestation,
    courriel: d.email ? { a: d.email, ...courrielDeLAttestation({ nom: saisie.signataire.nom, societe: saisie.signataire.societe, du: d.du, au: d.au, conclusion: saisie.conclusion }) } : null,
  };
}
