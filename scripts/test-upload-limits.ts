import assert from "node:assert";
import { temoinWebm } from "./_temoins-audio";
import { jpegDeTaille } from "./_images-temoins";
import { verifierTailleFichier, LIMITE_TELEVERSEMENT_OCTETS, MESSAGE_FICHIER_TROP_VOLUMINEUX } from "../src/server/upload-limits";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import { ajouterPhotoAction } from "../src/app/chantiers/[id]/photos-actions";
import { recevoirNoteVocale } from "../src/server/services/note-vocale-entrante";
import * as photosRepo from "../src/server/repositories/photos";
import { fermerLimiteur } from "../src/server/rate-limit";

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

function fichierDeTaille(octets: number, type: string, nom: string): File {
  return new File([new Uint8Array(octets)], nom, { type });
}

/**
 * **Une VRAIE photo, pas un tampon de zéros.**
 *
 * Depuis le 24 août 2026, `preparerPhotoEntrante` vérifie la signature du
 * fichier : un demi-mégaoctet de zéros annoncé `image/jpeg` est refusé, et
 * c'est exactement ce que le lot 2B ferme. Les cas qui éprouvent la BORNE DE
 * TAILLE doivent donc porter une image que le serveur peut lire, sans quoi ils
 * mesurent le refus de format et non celui de la taille.
 */
function photoDeTaille(octets: number, nom: string): File {
  return new File([new Uint8Array(jpegDeTaille(octets))], nom, { type: "image/jpeg" });
}

/**
 * **UNE VRAIE DICTÉE, pas un tampon de zéros** — exactement la même leçon que
 * pour les photos, un lot plus tard.
 *
 * Depuis le lot Audio du 26 août 2026, le format se lit dans les octets
 * (`src/lib/signature-audio.ts`) : deux cents kilo-octets de zéros annoncés
 * `audio/webm` sont refusés, et c'est précisément ce qu'on vient de fermer. Les
 * cas qui éprouvent la BORNE DE TAILLE doivent donc porter un enregistrement
 * que le serveur sait reconnaître, sans quoi ils mesurent le refus de format et
 * non celui de la taille.
 *
 * **Ce contrôle a rougi, et il avait tort.** Il exigeait qu'un faux WebM soit
 * accepté — c'est-à-dire le défaut lui-même. On adapte le contrôle, on ne
 * restaure pas l'ancien comportement (`CLAUDE.md` §5 bis).
 */
function dicteeDeTaille(octets: number, nom: string): File {
  const entete = temoinWebm();
  const total = new Uint8Array(Math.max(octets, entete.length));
  total.set(entete, 0);
  return new File([total], nom, { type: "audio/webm" });
}

async function main() {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Upload Limits" },
    { email: `upload-limits-${Date.now()}@test.local`, nom: "U" }
  );
  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;
  const chantier = await chantiersRepo.creerChantier({ entrepriseId: entreprise.id, utilisateurId }, { nom: "Chantier upload limits" });

  await test("Fonction pure : un fichier sous la limite est accepté", async () => {
    const fichier = fichierDeTaille(1024, "image/jpeg", "photo.jpg");
    const resultat = verifierTailleFichier(fichier);
    assert.equal(resultat.ok, true);
  });

  await test("Fonction pure : un fichier au-dessus de la limite est rejeté avec un message clair", async () => {
    const fichier = fichierDeTaille(LIMITE_TELEVERSEMENT_OCTETS + 1, "image/jpeg", "photo.jpg");
    const resultat = verifierTailleFichier(fichier);
    assert.equal(resultat.ok, false);
    if (!resultat.ok) {
      assert.equal(resultat.message, MESSAGE_FICHIER_TROP_VOLUMINEUX);
      assert.ok(!/stack|Error:|at /.test(resultat.message), "Aucun détail technique ne doit être présent dans le message");
    }
  });

  await test("Fonction pure : un fichier exactement à la limite est accepté (limite inclusive)", async () => {
    const fichier = fichierDeTaille(LIMITE_TELEVERSEMENT_OCTETS, "image/jpeg", "photo.jpg");
    const resultat = verifierTailleFichier(fichier);
    assert.equal(resultat.ok, true);
  });

  await test("Régression : une photo normale (sous la limite) est toujours acceptée par l'action réelle", async () => {
    const formData = new FormData();
    formData.set("fichier", photoDeTaille(500 * 1024, "photo-normale.jpg"));
    const photo = await ajouterPhotoAction(chantier.id, formData);
    assert.ok(photo);
    const liste = await photosRepo.listerPhotos({ entrepriseId: entreprise.id, utilisateurId }, chantier.id);
    assert.ok(liste.some((p) => p.id === photo.id));
  });

  await test("Upload photo : un fichier surdimensionné est rejeté par l'action réelle, message utilisateur propre", async () => {
    const formData = new FormData();
    formData.set("fichier", photoDeTaille(LIMITE_TELEVERSEMENT_OCTETS + 1024, "photo-trop-grosse.jpg"));
    let leve = false;
    let message = "";
    try {
      await ajouterPhotoAction(chantier.id, formData);
    } catch (err) {
      leve = true;
      message = err instanceof Error ? err.message : String(err);
    }
    assert.ok(leve, "Un fichier surdimensionné doit être rejeté");
    assert.equal(message, MESSAGE_FICHIER_TROP_VOLUMINEUX);
  });

  await test("Régression : un enregistrement vocal normal (sous la limite) est toujours accepté", async () => {
    const formData = new FormData();
    formData.set("fichier", dicteeDeTaille(200 * 1024, "note.webm"));
    formData.set("dureeSecondes", "12");
    const note = await recevoirNoteVocale(chantier.id, formData);
    assert.equal(note.ok, true);
  });

  // **Un refus n'est plus une exception, et ce contrôle a changé avec lui**
  // (11 août 2026). Le message d'une exception levée par une action serveur
  // n'atteint jamais l'écran du patron : Next.js le remplace en production par
  // un identifiant opaque, et son banc sert une version bâtie. Le refus est
  // donc une valeur de retour — c'est ce qu'on vérifie ici, message compris,
  // puisque c'est précisément ce qu'il doit pouvoir lire.
  await test("Upload note vocale : un fichier surdimensionné est refusé avec un message clair", async () => {
    const formData = new FormData();
    // Trop grosse ET reconnaissable : c'est la TAILLE qu'on éprouve ici, et la
    // borne de taille passe avant la reconnaissance dans la porte commune.
    formData.set("fichier", dicteeDeTaille(LIMITE_TELEVERSEMENT_OCTETS + 1024, "note-trop-grosse.webm"));
    const resultat = await recevoirNoteVocale(chantier.id, formData);
    assert.equal(resultat.ok, false, "Un fichier surdimensionné doit être refusé");
    assert.equal(resultat.ok === false && resultat.raison, MESSAGE_FICHIER_TROP_VOLUMINEUX);
  });

  await test("Upload note vocale : un format refusé NOMME le format reçu", async () => {
    const formData = new FormData();
    formData.set("fichier", fichierDeTaille(1024, "application/pdf", "faux.pdf"));
    const resultat = await recevoirNoteVocale(chantier.id, formData);
    assert.equal(resultat.ok, false);
    // Sans le format reçu, un type que le téléphone du patron produit et que la
    // liste blanche ignore resterait introuvable : il faudrait le lui demander.
    assert.ok(
      resultat.ok === false && resultat.raison.includes("application/pdf"),
      `le refus doit nommer le format reçu, or il dit : ${resultat.ok === false ? resultat.raison : ""}`
    );
  });

  await test("Upload note vocale : un enregistrement vide est refusé, pas rangé", async () => {
    const formData = new FormData();
    formData.set("fichier", fichierDeTaille(0, "audio/webm", "note-vide.webm"));
    const resultat = await recevoirNoteVocale(chantier.id, formData);
    assert.equal(resultat.ok, false, "Zéro octet n'est pas un enregistrement");
    assert.ok(resultat.ok === false && /vide/i.test(resultat.raison));
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  // Le limiteur de débit ouvre une connexion Redis dès qu'une action protégée
  // est traversée. Sans cette fermeture, le processus ne rend jamais la main —
  // tests tous verts, batterie arrêtée pour toujours (8 août 2026).
  await pool.end();
  await fermerLimiteur();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
