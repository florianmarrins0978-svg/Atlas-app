"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { verifierTailleFichier } from "@/server/upload-limits";
import { enregistrerObjet, lireObjet } from "@/server/storage";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { retirerMetadonnees, typeImageAccepte } from "@/lib/exif";
import { lirePolitique } from "@/lib/retention-diagnostic";
import { analyser } from "@/server/diagnostic/moteur";
import {
  ajouterPhoto,
  conclureDiagnostic,
  ecrireHypotheses,
  lireDiagnostic,
  lirePhotos,
  ouvrirDiagnostic,
  rattacherAUnChantier,
} from "@/server/repositories/diagnostics";
import type { Partie } from "@/lib/diagnostic-vegetal";

/**
 * Les gestes du diagnostic végétal.
 *
 * **Les refus se RENDENT, ils ne lèvent jamais** (`HANDOVER.md`, piège 0 ter) :
 * le message d'une exception levée par une action serveur n'arrive JAMAIS
 * jusqu'au patron — Next.js le remplace en production par un identifiant
 * opaque, et son banc sert une version bâtie. Une action qui lèverait lui
 * donnerait « Une erreur est survenue » devant un arbre, et rien d'autre.
 */
export type Resultat = { ok: true; id: string } | { ok: false; phrase: string };

const PHRASE_IMAGE_REFUSEE =
  "Ce fichier n’est pas une photo lisible. Prenez une photo au format JPEG, PNG ou WebP.";

/** La politique de conservation, lue à chaque geste — jamais gravée. */
function politique() {
  const env = getEnv();
  return lirePolitique({
    libre: env.photosDiagnosticRetentionJours,
    chantier: env.photosDiagnosticRetentionJoursChantier,
  });
}

type PhotoPrete = {
  base64: string;
  mimeType: string;
  octets: Buffer;
  checksum: string;
  exifRetire: boolean;
};

/**
 * Contrôler, nettoyer, préparer — **avant** que quoi que ce soit parte.
 *
 * L'ordre n'est pas indifférent :
 *
 *  1. **la taille se vérifie sur `size`**, sans lire le contenu : un fichier
 *     surdimensionné ne doit pas passer par la mémoire avant d'être refusé ;
 *  2. **le type est une liste blanche**, et le contenu doit correspondre au
 *     type annoncé ;
 *  3. **les métadonnées sont retirées AVANT tout** — avant le rangement, avant
 *     l'envoi au fournisseur. Les coordonnées GPS du domicile d'un client n'ont
 *     à sortir nulle part, et surtout pas chez un tiers.
 *
 * **Un nettoyage qui échoue fait REFUSER la photo**, il ne la laisse pas
 * passer. Ranger un fichier qu'on n'a pas su lire, ce serait conserver des
 * métadonnées en croyant les avoir retirées — et la colonne `exif_retire`
 * affirmerait alors quelque chose de faux, ce qui est pire que de ne rien
 * affirmer.
 */
async function preparerPhoto(fichier: unknown): Promise<{ ok: true; photo: PhotoPrete } | { ok: false; phrase: string }> {
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, phrase: "Aucune photo reçue." };
  }
  const taille = verifierTailleFichier(fichier);
  if (!taille.ok) return { ok: false, phrase: taille.message };
  if (!typeImageAccepte(fichier.type)) return { ok: false, phrase: PHRASE_IMAGE_REFUSEE };

  const brut = new Uint8Array(await fichier.arrayBuffer());
  const nettoye = retirerMetadonnees(brut, fichier.type);
  if (!nettoye.nettoye) return { ok: false, phrase: PHRASE_IMAGE_REFUSEE };
  if (nettoye.retires.length > 0) {
    logger.info("Diagnostic végétal : métadonnées retirées", { blocs: nettoye.retires });
  }

  const octets = Buffer.from(nettoye.octets);
  return {
    ok: true,
    photo: {
      octets,
      base64: octets.toString("base64"),
      mimeType: fichier.type.split(";")[0].trim().toLowerCase(),
      checksum: createHash("sha256").update(octets).digest("hex"),
      exifRetire: true,
    },
  };
}

function extensionPour(mimeType: string): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

/**
 * Photographier, et obtenir une réponse.
 *
 * **La photo est rangée AVANT l'analyse, et le reste quoi qu'elle donne** —
 * même choix que pour les tickets de gazole : si le fournisseur est absent,
 * refuse ou se trompe, le geste du patron n'est jamais perdu pour une panne qui
 * n'est pas la sienne.
 */
export async function analyserPhotoAction(formData: FormData): Promise<Resultat> {
  const prete = await preparerPhoto(formData.get("photo"));
  if (!prete.ok) return { ok: false, phrase: prete.phrase };

  const ctx = await getCurrentCtx();
  const limite = await verifierLimite(`diagnostic:${ctx.entrepriseId}`, LIMITES.diagnosticVegetal);
  if (!limite.autorise) return { ok: false, phrase: limite.message };

  const diagnosticId = await ouvrirDiagnostic(ctx);
  const objet = await enregistrerObjet(
    `entreprises/${ctx.entrepriseId}/diagnostics`,
    prete.photo.octets,
    extensionPour(prete.photo.mimeType)
  );
  await ajouterPhoto(
    ctx,
    diagnosticId,
    {
      storageKey: objet.storageKey,
      mimeType: prete.photo.mimeType,
      tailleOctets: objet.tailleOctets,
      checksum: prete.photo.checksum,
      role: "initiale",
      partieDemandee: null,
      exifRetire: prete.photo.exifRetire,
    },
    politique()
  );

  await executerAnalyse(ctx, diagnosticId, [{ base64: prete.photo.base64, mimeType: prete.photo.mimeType }], false);
  revalidatePath(`/paysage/diagnostic/${diagnosticId}`);
  return { ok: true, id: diagnosticId };
}

/**
 * La photo complémentaire — **une seule, jamais deux**.
 *
 * L'invariant se vérifie ICI, contre la base, et pas contre ce que l'écran
 * croit savoir : recharger la page ne doit pas remettre le compteur à zéro. La
 * migration porte la même limite en contrainte CHECK, pour qu'elle ne dépende
 * pas du seul code.
 */
export async function ajouterComplementAction(diagnosticId: string, formData: FormData): Promise<Resultat> {
  const prete = await preparerPhoto(formData.get("photo"));
  if (!prete.ok) return { ok: false, phrase: prete.phrase };

  const ctx = await getCurrentCtx();
  const diagnostic = await lireDiagnostic(ctx, diagnosticId);
  if (!diagnostic) return { ok: false, phrase: "Ce diagnostic n’existe plus." };
  if (diagnostic.statut !== "complement_demande") {
    return { ok: false, phrase: "Ce diagnostic n’attend pas de photo complémentaire." };
  }

  const limite = await verifierLimite(`diagnostic:${ctx.entrepriseId}`, LIMITES.diagnosticVegetal);
  if (!limite.autorise) return { ok: false, phrase: limite.message };

  const objet = await enregistrerObjet(
    `entreprises/${ctx.entrepriseId}/diagnostics`,
    prete.photo.octets,
    extensionPour(prete.photo.mimeType)
  );
  await ajouterPhoto(
    ctx,
    diagnosticId,
    {
      storageKey: objet.storageKey,
      mimeType: prete.photo.mimeType,
      tailleOctets: objet.tailleOctets,
      checksum: prete.photo.checksum,
      role: "complement",
      partieDemandee: (diagnostic.complementPartie as Partie | null) ?? null,
      exifRetire: prete.photo.exifRetire,
    },
    politique()
  );

  // **Les deux photos repartent ENSEMBLE.** Séparée, la seconde perdrait le
  // contexte de la première — et c'est justement leur rapprochement qui
  // départage les deux hypothèses.
  const photos = await lirePhotos(ctx, diagnosticId);
  const images = await Promise.all(
    photos
      .filter((p) => p.storageKey)
      .map(async (p) => ({ base64: await relireBase64(p.storageKey!), mimeType: p.mimeType }))
  );

  await executerAnalyse(ctx, diagnosticId, images.filter((i) => i.base64 !== null) as { base64: string; mimeType: string }[], true);
  revalidatePath(`/paysage/diagnostic/${diagnosticId}`);
  return { ok: true, id: diagnosticId };
}

async function relireBase64(storageKey: string): Promise<string | null> {
  try {
    const objet = await lireObjet(storageKey);
    return Buffer.from(objet).toString("base64");
  } catch (err) {
    // Une photo purgée entre-temps, un stockage momentanément muet. On continue
    // avec ce qu'on a plutôt que de perdre le geste — et on le journalise, sans
    // quoi le diagnostic dégradé serait inexplicable.
    logger.warn("Diagnostic végétal : photo illisible dans le stockage", { erreur: err });
    return null;
  }
}

/**
 * Lancer l'analyse et écrire son issue.
 *
 * **Toute panne imprévue est JOURNALISÉE avant d'être rendue.** Un défaut muet
 * est un défaut qu'on répare à l'aveugle (`AGENTS.md`), et celui-ci se
 * produira chez le patron, pas ici.
 */
async function executerAnalyse(
  ctx: { utilisateurId: string; entrepriseId: string },
  diagnosticId: string,
  images: { base64: string; mimeType: string }[],
  complementDejaDemande: boolean
) {
  try {
    const analyse = await analyser(images, { complementDejaDemande });
    await conclureDiagnostic(ctx, diagnosticId, analyse.issue, analyse.observation, analyse.traces, analyse.essence);
    await ecrireHypotheses(ctx, diagnosticId, analyse.hypotheses);
  } catch (err) {
    logger.error("Diagnostic végétal : analyse échouée", { diagnosticId, erreur: err });
    await conclureDiagnostic(
      ctx,
      diagnosticId,
      { type: "echoue", phrase: "L’analyse n’a pas abouti. Réessayez dans un instant." },
      null,
      { moteur: "inconnu", modele: "inconnu", versionBase: "non lue" },
      { taxonId: null, certitude: null }
    );
  }
}

export type ResultatSimple = { ok: true } | { ok: false; phrase: string };

/**
 * Rattacher le diagnostic à un chantier — **après coup, et facultativement**.
 *
 * Sa règle du 20 août : aucun chantier n'est nécessaire pour diagnostiquer.
 * Ce geste-là vient ensuite, quand il sait chez qui il est.
 */
export async function rattacherAction(diagnosticId: string, chantierId: string): Promise<ResultatSimple> {
  const ctx = await getCurrentCtx();
  const r = await rattacherAUnChantier(ctx, diagnosticId, chantierId, politique());
  if (!r.ok) {
    return {
      ok: false,
      phrase:
        r.refus === "chantier_absent" ? "Ce chantier n’existe plus." : "Ce diagnostic n’existe plus.",
    };
  }
  revalidatePath(`/paysage/diagnostic/${diagnosticId}`);
  return { ok: true };
}
