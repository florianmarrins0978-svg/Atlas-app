import { eq, isNotNull, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { hashSync } from "bcryptjs";
import { pool, db } from "./client";
import { createHash } from "node:crypto";
import { attribuerNumeroDevis } from "../repositories/devis";
import { genererPdfDevis } from "../pdf/devis-pdf";
import { enregistrerObjet } from "../storage";
import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import path from "node:path";
/**
 * Une image PNG d'une seule couleur, fabriquée sans aucune dépendance.
 *
 * **Pourquoi le seed dépose enfin les fichiers.** Il inscrivait des lignes de
 * photos sans jamais poser d'image : les vignettes s'affichaient cassées sur le
 * banc, et la pellicule de la fiche chantier — qui EST l'écran des photos
 * désormais — ne pouvait pas se juger. Signalé le 10 août au matin, corrigé le
 * soir même, quand cet écran en a fait un empêchement et non plus une gêne.
 */
function imageDeDemonstration(r: number, v: number, b: number): Buffer {
  const cote = 64;
  // Chaque rangée d'un PNG commence par un octet de filtre — ici zéro, « aucun
  // filtre » : c'est le seul cas qu'on peut écrire sans rien calculer.
  const brut = Buffer.alloc(cote * (cote * 3 + 1));
  let i = 0;
  for (let y = 0; y < cote; y++) {
    brut[i++] = 0;
    for (let x = 0; x < cote; x++) {
      // Un léger dégradé : une vignette parfaitement plate ne dit pas si
      // l'image est réellement décodée ou si l'on regarde un fond de secours.
      const f = 0.72 + (0.28 * (x + y)) / (2 * cote);
      brut[i++] = Math.round(r * f);
      brut[i++] = Math.round(v * f);
      brut[i++] = Math.round(b * f);
    }
  }
  const bloc = (type: string, donnees: Buffer): Buffer => {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length, 0);
    const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corps), 0);
    return Buffer.concat([longueur, corps, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cote, 0);
  ihdr.writeUInt32BE(cote, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // couleur vraie, sans transparence
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", deflateSync(brut)),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

/** Le CRC-32 du format PNG. Table calculée une fois, à la première image. */
let tableCrc: number[] | null = null;
function crc32(octets: Buffer): number {
  if (!tableCrc) {
    tableCrc = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tableCrc[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const o of octets) c = tableCrc[(c ^ o) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Quelques teintes de chantier, pour que les vignettes ne soient pas jumelles. */
const TEINTES_PHOTOS: [number, number, number][] = [
  [111, 122, 88],
  [195, 171, 132],
  [169, 168, 158],
  [142, 160, 122],
  [208, 195, 166],
  [154, 164, 168],
  [120, 134, 110],
  [186, 158, 118],
  [138, 146, 150],
];

/** La durée de la note de démonstration, en secondes. */
const DUREE_NOTE_DEMO = 12;

/**
 * Un WAV fabriqué à la volée, sans aucune dépendance.
 *
 * **Pourquoi une vraie onde plutôt qu'un silence.** L'anneau de la fiche
 * chantier fait battre ses barreaux selon le VOLUME réellement enregistré : sur
 * un fichier plat, ils resteraient immobiles et l'écran paraîtrait arrêté
 * pendant qu'il lit. L'enveloppe ci-dessous monte et descend comme une phrase,
 * avec des respirations — c'est ce qui permet de juger l'onde à l'œil.
 */
function audioDeDemonstration(secondes: number): Buffer {
  const taux = 8000;
  const total = taux * secondes;
  const donnees = Buffer.alloc(total * 2);
  for (let i = 0; i < total; i++) {
    const t = i / taux;
    // Des syllabes qui s'enchaînent, et une respiration toutes les quatre
    // secondes seulement. Une enveloppe à moitié silencieuse — le premier
    // essai — donnait une onde qui s'écrasait la moitié du temps : mesuré,
    // pas supposé, et corrigé après l'avoir vu à plat.
    const syllabe = 0.42 + 0.58 * Math.abs(Math.sin((t * Math.PI) / 0.34));
    const respiration = t % 4 > 3.55 ? 0.12 : 1;
    const porteuse = Math.sin(2 * Math.PI * 190 * t) + 0.4 * Math.sin(2 * Math.PI * 430 * t);
    const echantillon = Math.max(-1, Math.min(1, porteuse * 0.46 * syllabe * respiration));
    donnees.writeInt16LE(Math.round(echantillon * 32000), i * 2);
  }

  const entete = Buffer.alloc(44);
  entete.write("RIFF", 0);
  entete.writeUInt32LE(36 + donnees.length, 4);
  entete.write("WAVE", 8);
  entete.write("fmt ", 12);
  entete.writeUInt32LE(16, 16); // taille du bloc de format
  entete.writeUInt16LE(1, 20); // PCM
  entete.writeUInt16LE(1, 22); // mono
  entete.writeUInt32LE(taux, 24);
  entete.writeUInt32LE(taux * 2, 28); // octets par seconde
  entete.writeUInt16LE(2, 32); // alignement
  entete.writeUInt16LE(16, 34); // bits par échantillon
  entete.write("data", 36);
  entete.writeUInt32LE(donnees.length, 40);
  return Buffer.concat([entete, donnees]);
}

/**
 * Dépose un objet du jeu de démonstration à une clé CHOISIE.
 *
 * `enregistrerObjet` engendre sa propre clé aléatoire, ce qui convient au
 * produit mais pas ici : le seed doit pouvoir réécrire la même clé à chaque
 * amorçage, sinon chaque passage laisse un fichier orphelin de plus.
 */
async function ecrireObjetDeSeed(storageKey: string, octets: Buffer): Promise<void> {
  const chemin = path.join(process.cwd(), ".storage", storageKey);
  await mkdir(path.dirname(chemin), { recursive: true });
  await writeFile(chemin, octets);
}

import { creerPrestationCatalogue } from "../repositories/catalogue-prestations";
import { creerMaterielCatalogue } from "../repositories/catalogue-materiels";
import {
  entreprises,
  entrepriseCompteurs,
  users,
  membresEntreprise,
  clients,
  chantiers,
  prestations,
  materiel,
  notesVocales,
  photos,
  tarifs,
  lignesPrix,
  documentsLegaux,
  acceptationsDocuments,
  devis,
  envoisDevis,
  lignesDevis,
  agendasExternes,
} from "./schema";

// Reconstitue les données actuelles de src/lib/mock-data.ts comme de vraies
// lignes, rattachées à une entreprise et un utilisateur de démonstration —
// conformément au plan de migration (docs/ARCHITECTURE_DONNEES.md §11).
// Idempotent : peut être relancé sans dupliquer (TRUNCATE puis reconstruction).
//
// Tout se déroule dans UNE seule transaction : le contexte RLS
// (set_config('app.entreprise_id', ...)) est fixé juste après la création de
// l'entreprise, puis reste actif pour le reste des insertions — FORCE ROW LEVEL
// SECURITY s'applique même au rôle propriétaire (atlas_owner), donc même ce
// script de seed doit passer par le contexte, comme n'importe quel appel réel.

async function main() {
  await db.transaction(async (tx) => {
    // **Ce que l'artisan a tapé À LA MAIN ne se jette pas avec la démonstration.**
    //
    // Le 11 août 2026, le patron a rouvert « Mon agenda » et lu « Le
    // raccordement n'est pas encore disponible ». Il l'avait pourtant relié la
    // veille. Cause, et elle est dans la migration 0032 :
    //
    //     "entreprise_id" ... REFERENCES "entreprises"("id") ON DELETE CASCADE
    //
    // Ses identifiants Google vivent dans une ligne rattachée à son entreprise.
    // Le `TRUNCATE ... entreprises ... CASCADE` ci-dessous les emportait — le
    // même geste qui avait produit la session fantôme la veille au soir. Ces
    // identifiants ne sont pas une donnée de démonstration : il est allé les
    // créer chez Google, et les a recopiés lui-même.
    //
    // **On garde les identifiants, PAS l'autorisation.** Les jetons disent
    // « cet artisan a donné son accord pour CETTE entreprise » ; l'entreprise
    // disparaît, l'accord tombe avec elle, et c'est honnête. Le raccordement se
    // refait alors d'un seul appui, sans repasser par la console de Google.
    // **On POSE le contexte d'isolation, on ne le contourne pas.** La RLS est en
    // `FORCE` : sans `app.entreprise_id`, cette lecture rend zéro ligne — en
    // silence — et la conservation ne conserverait rien sans qu'un seul message
    // ne l'annonce. Première version, elle passait au vert pour cette raison
    // exacte. On parcourt donc les entreprises, en posant leur contexte, comme
    // le fait `withEntreprise`.
    const entreprisesAvant = await tx.select({ id: entreprises.id }).from(entreprises);
    const identifiantsGardes: {
      // Le type suit la colonne, qui accepte iCloud depuis la 0035 : le figer
      // sur « google » ferait tomber la compilation à chaque fournisseur ajouté,
      // pour un tableau qui ne fait que recopier ce qu'il vient de lire.
      fournisseur: "google" | "apple";
      clientId: string | null;
      clientSecret: string | null;
      redirection: string | null;
    }[] = [];
    for (const avant of entreprisesAvant) {
      await tx.execute(sql`SELECT set_config('app.entreprise_id', ${avant.id}, true)`);
      const lignes = await tx
        .select({
          fournisseur: agendasExternes.fournisseur,
          clientId: agendasExternes.clientId,
          clientSecret: agendasExternes.clientSecret,
          redirection: agendasExternes.redirection,
        })
        .from(agendasExternes)
        .where(isNotNull(agendasExternes.clientId));
      identifiantsGardes.push(...lignes);
    }

    console.log("Nettoyage des données de démonstration existantes...");
    await tx.execute(sql`
      TRUNCATE TABLE
        lignes_facture, factures, lignes_devis, devis, lignes_prix, photos, notes_vocales,
        materiel, prestations, chantiers, clients, tarifs,
        entreprise_compteurs, membres_entreprise, entreprises, users
      RESTART IDENTITY CASCADE
    `);

    console.log("Création de l'entreprise et de l'utilisateur de démonstration...");
    const [entreprise] = await tx
      .insert(entreprises)
      .values({
        nom: "Atelier Démo",
        siret: "123 456 789 00012",
        adresse: "10 rue des Artisans, Nantes",
        telephone: "02 40 00 00 00",
        email: "contact@atelier-demo.fr",
        iban: "FR76 3000 1000 0000 0000 0000 000",
      })
      .returning();

    // Les identifiants Google retrouvent leur place, sur la nouvelle entreprise.
    // Ni `compte` ni jetons : l'accord de l'artisan valait pour l'entreprise qui
    // vient de disparaître. Il lui restera un seul appui sur « Relier mon agenda
    // Google », sans repasser par la console.
    if (identifiantsGardes.length > 0) {
      // Même exigence à l'écriture : la politique porte un `WITH CHECK`.
      await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entreprise.id}, true)`);
      await tx.insert(agendasExternes).values(
        identifiantsGardes.map((garde) => ({
          entrepriseId: entreprise.id,
          fournisseur: garde.fournisseur,
          clientId: garde.clientId,
          clientSecret: garde.clientSecret,
          redirection: garde.redirection,
        }))
      );
      console.log(
        `Identifiants d'agenda conservés (${identifiantsGardes.length}) — le raccordement se refait en un appui.`
      );
    }

    const [utilisateur] = await tx
      .insert(users)
      .values({
        email: "demo@atlas.local",
        nom: "Compte de démonstration",
        // Mot de passe de développement uniquement — jamais utilisé en
        // production (STORAGE_PROVIDER/AUTH_SECRET imposent une configuration
        // distincte en production ; ce seed n'est de toute façon jamais
        // exécuté contre une base de production).
        passwordHash: hashSync("demo1234", 10),
      })
      .returning();

    // Contexte RLS fixé pour le reste de la transaction — obligatoire dès cet
    // instant, y compris pour le rôle propriétaire (FORCE ROW LEVEL SECURITY).
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entreprise.id}, true)`);

    await tx.insert(membresEntreprise).values({
      entrepriseId: entreprise.id,
      utilisateurId: utilisateur.id,
      role: "proprietaire",
    });

    await tx
      .insert(entrepriseCompteurs)
      .values({ entrepriseId: entreprise.id, prochainNumeroDevis: 1 })
      .onConflictDoNothing();

    // Le compte de démonstration accepte d'emblée les documents légaux en
    // vigueur, sans quoi la garde du layout redirigerait chaque écran vers
    // l'écran d'acceptation — et aucun parcours de démonstration ni de test de
    // bout en bout ne pourrait aboutir.
    //
    // Ce raccourci ne vaut QUE pour ce compte fictif, créé par ce script : un
    // vrai utilisateur passe toujours par l'écran d'acceptation, et c'est ce
    // que vérifie test-documents-legaux.ts. La preuve est marquée comme
    // provenant du seed, pour qu'on ne la confonde jamais avec un consentement
    // réellement recueilli.
    const documentsRequis = await tx
      .select({ id: documentsLegaux.id })
      .from(documentsLegaux)
      .where(eq(documentsLegaux.acceptationRequise, true));

    if (documentsRequis.length > 0) {
      await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateur.id}, true)`);
      await tx
        .insert(acceptationsDocuments)
        .values(
          documentsRequis.map((d) => ({
            utilisateurId: utilisateur.id,
            documentId: d.id,
            adresseIp: null,
            agentUtilisateur: "seed de démonstration — consentement fictif",
          }))
        )
        .onConflictDoNothing();
    }

    console.log("Insertion des tarifs...");
    await tx.insert(tarifs).values([
      { entrepriseId: entreprise.id, intitule: "Main d'œuvre (jour/homme)", prix: "280.00", unite: "jour/homme" },
      { entrepriseId: entreprise.id, intitule: "Dépose carrelage", prix: "18.00", unite: "m²" },
      { entrepriseId: entreprise.id, intitule: "Pose faïence", prix: "45.00", unite: "m²" },
      { entrepriseId: entreprise.id, intitule: "Forfait déplacement", prix: "35.00", unite: null },
    ]);

    type ChantierSeed = {
      nom: string;
      adresseChantier: string;
      client: { nom: string; telephone: string };
      photos: number;
      aUneNoteVocale: boolean;
      dateCreation: string;
      informationsVerifiees: boolean;
      prixCalcule: boolean;
      devisGenere: boolean;
      devisEnvoye: boolean;
    };

    const chantiersSeed: ChantierSeed[] = [
      {
        nom: "Rénovation salle de bain",
        adresseChantier: "12 rue des Lilas, Nantes",
        client: { nom: "M. Bernard", telephone: "06 12 34 56 78" },
        photos: 6,
        aUneNoteVocale: true,
        dateCreation: "2026-07-24",
        informationsVerifiees: false,
        prixCalcule: false,
        devisGenere: false,
        devisEnvoye: false,
      },
      {
        nom: "Terrasse bois",
        adresseChantier: "5 allée des Tilleuls, Nantes",
        client: { nom: "Mme Costa", telephone: "06 98 76 54 32" },
        photos: 3,
        aUneNoteVocale: true,
        dateCreation: "2026-07-22",
        informationsVerifiees: true,
        prixCalcule: false,
        devisGenere: false,
        devisEnvoye: false,
      },
      {
        nom: "Reprise de toiture",
        adresseChantier: "8 impasse du Moulin, Rezé",
        client: { nom: "M. Faucher", telephone: "07 11 22 33 44" },
        photos: 9,
        aUneNoteVocale: true,
        dateCreation: "2026-07-18",
        informationsVerifiees: true,
        prixCalcule: true,
        devisGenere: true,
        devisEnvoye: true,
      },
      {
        nom: "Pose de clôture",
        adresseChantier: "2 route de Vertou, Vertou",
        client: { nom: "Mme Aubry", telephone: "06 55 44 33 22" },
        photos: 0,
        aUneNoteVocale: false,
        dateCreation: "2026-07-26",
        informationsVerifiees: false,
        prixCalcule: false,
        devisGenere: false,
        devisEnvoye: false,
      },
    ];

    console.log("Insertion des clients et chantiers...");
    const chantierIdsParNom: Record<string, string> = {};

    for (const c of chantiersSeed) {
      const [client] = await tx
        .insert(clients)
        .values({ entrepriseId: entreprise.id, nom: c.client.nom, telephone: c.client.telephone })
        .returning();

      const dateBase = new Date(c.dateCreation + "T09:00:00Z");
      const [chantier] = await tx
        .insert(chantiers)
        .values({
          entrepriseId: entreprise.id,
          clientId: client.id,
          nom: c.nom,
          adresseChantier: c.adresseChantier,
          informationsVerifieesAt: c.informationsVerifiees ? dateBase : null,
          prixValideAt: c.prixCalcule ? dateBase : null,
          devisGenereAt: c.devisGenere ? dateBase : null,
          devisEnvoyeAt: c.devisEnvoye ? dateBase : null,
          createdAt: dateBase,
          updatedAt: dateBase,
        })
        .returning();
      chantierIdsParNom[c.nom] = chantier.id;

      if (c.photos > 0) {
        // Les fichiers sont réellement déposés : sans eux, les vignettes
        // s'affichent cassées et la pellicule de la fiche chantier ne peut
        // pas se juger — ni par le patron sur le banc, ni en capture.
        const vignettes = await Promise.all(
          Array.from({ length: c.photos }, async (_, i) => {
            const teinte = TEINTES_PHOTOS[i % TEINTES_PHOTOS.length];
            const image = imageDeDemonstration(teinte[0], teinte[1], teinte[2]);
            const storageKey = `seed/${chantier.id}/photo-${i + 1}.png`;
            await ecrireObjetDeSeed(storageKey, image);
            return {
              entrepriseId: entreprise.id,
              chantierId: chantier.id,
              storageKey,
              // Le type déclaré doit dire la vérité : la route sert cet
              // en-tête tel quel, et un `image/jpeg` sur un PNG ferait
              // refuser l'affichage.
              mimeType: "image/png",
              tailleOctets: image.length,
              nomOriginal: `photo-${i + 1}.png`,
              checksum: createHash("sha256").update(image).digest("hex"),
              ordre: i,
            };
          })
        );
        await tx.insert(photos).values(vignettes);
      }

      if (c.aUneNoteVocale) {
        // **Le fichier est réellement déposé, pas seulement déclaré.** Sans
        // lui, l'anneau de la fiche chantier ne joue rien : `play()` échoue en
        // silence, l'onde ne bat pas, le compteur reste à zéro — et personne,
        // ni le patron sur le banc ni le contrôle, ne peut juger cet écran.
        // C'est le même manque que pour les photos, signalé le 10 août.
        const audio = audioDeDemonstration(DUREE_NOTE_DEMO);
        const storageKey = `seed/${chantier.id}/note.wav`;
        await ecrireObjetDeSeed(storageKey, audio);
        await tx.insert(notesVocales).values({
          entrepriseId: entreprise.id,
          chantierId: chantier.id,
          storageKey,
          // Le WAV se fabrique sans aucune dépendance et se lit partout. Le
          // type déclaré doit dire la vérité : la route sert cet en-tête tel
          // quel, et un `audio/mp4` sur un WAV ferait refuser la lecture.
          mimeType: "audio/wav",
          tailleOctets: audio.length,
          nomOriginal: "note.wav",
          checksum: createHash("sha256").update(audio).digest("hex"),
          dureeSecondes: DUREE_NOTE_DEMO,
          transcription:
            c.nom === "Rénovation salle de bain"
              ? "Alors pour la salle de bain de monsieur Bernard, on va devoir déposer l'ancien carrelage " +
                "complètement, poser la nouvelle faïence sur les murs, et changer la robinetterie qui est " +
                "vraiment vétuste. Je pense deux jours de travail avec deux gars sur le chantier. Le client " +
                "fournit son carrelage, nous on prend la colle flex et le joint gris anthracite."
              : null,
          transcriptionStatut: c.nom === "Rénovation salle de bain" ? "reussie" : "non_demandee",
        });
      }
    }

    console.log("Insertion des prestations/matériel de démonstration (Rénovation salle de bain)...");
    const idRenovation = chantierIdsParNom["Rénovation salle de bain"];
    await tx.insert(prestations).values(
      ["Dépose ancien carrelage", "Pose faïence murale", "Remplacement robinetterie"].map((libelle, i) => ({
        entrepriseId: entreprise.id,
        chantierId: idRenovation,
        libelle,
        ordre: i,
      }))
    );
    await tx.insert(materiel).values(
      ["Carrelage 60x60 (fourni client)", "Colle flex", "Joint gris anthracite"].map((libelle, i) => ({
        entrepriseId: entreprise.id,
        chantierId: idRenovation,
        libelle,
        ordre: i,
      }))
    );

    console.log("Insertion du devis envoyé pour Reprise de toiture...");
    const idToiture = chantierIdsParNom["Reprise de toiture"];
    const lignesToiture = [
      { libelle: "Main d'œuvre — 2 hommes × 2 jours", montant: "1120.00" },
      { libelle: "Dépose carrelage — 8 m²", montant: "144.00" },
      { libelle: "Pose faïence — 8 m²", montant: "360.00" },
      { libelle: "Forfait déplacement", montant: "35.00" },
    ];
    await tx.insert(lignesPrix).values(
      lignesToiture.map((l, i) => ({
        entrepriseId: entreprise.id,
        chantierId: idToiture,
        libelle: l.libelle,
        montant: l.montant,
        ordre: i,
      }))
    );

    const totalHtDec = lignesToiture.reduce((s, l) => s.plus(l.montant), new Decimal(0));
    const tauxTvaDec = new Decimal(20);
    const totalTvaDec = totalHtDec.times(tauxTvaDec).dividedBy(100);
    const totalTtcDec = totalHtDec.plus(totalTvaDec);

    const numeroCommercial = await attribuerNumeroDevis(tx, entreprise.id);
    const [d] = await tx
      .insert(devis)
      .values({
        entrepriseId: entreprise.id,
        chantierId: idToiture,
        numeroCommercial,
        numeroVersion: 1,
        statut: "brouillon",
        entrepriseNom: entreprise.nom,
        entrepriseAdresse: entreprise.adresse,
        entrepriseSiret: entreprise.siret,
        entrepriseEmail: entreprise.email,
        entrepriseTelephone: entreprise.telephone,
        entrepriseIban: entreprise.iban,
        clientNom: "M. Faucher",
        clientTelephone: "07 11 22 33 44",
        adresseChantier: "8 impasse du Moulin, Rezé",
        dateEmission: "2026-07-25",
        dateValidite: "2026-08-24",
        conditionsPaiement: "Acompte de 30% à la signature, solde à réception des travaux.",
        tauxTva: tauxTvaDec.toFixed(2),
        totalHt: totalHtDec.toFixed(2),
        totalTva: totalTvaDec.toFixed(2),
        totalTtc: totalTtcDec.toFixed(2),
      })
      .returning();

    await tx.insert(lignesDevis).values(
      lignesToiture.map((l, i) => ({
        entrepriseId: entreprise.id,
        devisId: d.id,
        libelle: l.libelle,
        quantite: "1",
        prixUnitaire: l.montant,
        montant: l.montant,
        ordre: i,
      }))
    );

    // Transition brouillon -> envoye, autorisée par le trigger d'immuabilité.
    //
    // Le PDF est archivé dans le même geste, comme le fait `envoyerDevis` en
    // vrai. Sans lui, le devis était marqué envoyé mais aucun document n'existait
    // : le lien « Voir le devis complet » que le client ouvre depuis sa page
    // renvoyait un 404 sur le banc d'essai. Une démonstration qui se contredit
    // fait perdre plus de temps qu'elle n'en gagne — c'est déjà arrivé une fois
    // sur ce même devis.
    const pdfDemo = await genererPdfDevis({
      numeroCommercial: d.numeroCommercial,
      numeroVersion: d.numeroVersion,
      statut: "envoye",
      dateEmission: d.dateEmission,
      entrepriseNom: d.entrepriseNom,
      entrepriseAdresse: d.entrepriseAdresse,
      entrepriseSiret: d.entrepriseSiret,
      entrepriseTelephone: d.entrepriseTelephone,
      entrepriseEmail: d.entrepriseEmail,
      entrepriseIban: d.entrepriseIban,
      clientNom: d.clientNom,
      clientAdresse: d.clientAdresse,
      clientTelephone: d.clientTelephone,
      adresseChantier: d.adresseChantier,
      conditionsPaiement: d.conditionsPaiement,
      devise: d.devise,
      tauxTva: d.tauxTva,
      totalHt: d.totalHt,
      totalTva: d.totalTva,
      totalTtc: d.totalTtc,
      lignes: lignesToiture.map((l) => ({
        libelle: l.libelle,
        quantite: "1",
        prixUnitaire: l.montant,
        montant: l.montant,
      })),
    });
    const objetDemo = await enregistrerObjet(
      `chantiers/${d.chantierId}/devis`,
      Buffer.from(pdfDemo),
      ".pdf"
    );

    await tx
      .update(devis)
      .set({
        statut: "envoye",
        envoyeLe: new Date(),
        pdfStorageKey: objetDemo.storageKey,
        pdfChecksum: objetDemo.checksum,
      })
      .where(sql`id = ${d.id}`);

    // Et l'envoi qui va avec.
    //
    // Sans lui, la démonstration se contredisait à l'écran : le devis était
    // marqué envoyé, mais l'écran affichait « Devis non envoyé — le client n'a
    // rien reçu », faute de trouver un envoi. Deux notions distinctes se
    // télescopaient : le document émis (immuable) et le fait de l'avoir
    // transmis. Dans l'usage réel, l'un ne va jamais sans l'autre — c'est
    // l'envoi au client qui bascule le devis en « envoyé ».
    //
    // Le jeton est fixe et sans surprise : c'est une donnée de démonstration,
    // et pouvoir ouvrir la page du client d'un lien connu vaut mieux qu'un
    // secret inutile sur un banc d'essai dont le mot de passe est public.
    const dansTroisJours = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
    await tx.insert(envoisDevis).values({
      entrepriseId: entreprise.id,
      chantierId: idToiture,
      devisId: d.id,
      canal: "sms",
      jeton: "demonstration-reprise-toiture",
      datesProposees: [dansTroisJours],
      // L'empreinte fige le devis tel qu'il est parti : le client ne peut pas
      // se voir opposer une version modifiée après coup.
      empreinteDevis: createHash("sha256")
        .update("Reprise de toiture — devis de démonstration")
        .digest("hex"),
      expireAt: new Date(Date.now() + 14 * 86400_000),
      // **Le client a répondu, et il a renvoyé le devis.** Sans cette réponse,
      // le jeu de démonstration ne contenait AUCUN chantier attendant un geste
      // du patron — et la perle d'or de l'écran d'accueil, qui ne se pose que
      // sur ceux-là, restait invisible sur le banc. Une fonctionnalité qu'on ne
      // peut pas voir est une fonctionnalité qu'on croit cassée : c'est
      // exactement ce que le patron a signalé le 10 août 2026.
      reponse: "correction",
      responduAt: new Date(Date.now() - 86400_000),
      // Une correction sans motif est refusée par la base
      // (`envois_devis_correction_motivee_ck`), et c'est voulu : un devis
      // renvoyé sans un mot ne dit pas au patron ce qu'il doit changer.
      precisionClient: "Pouvez-vous retirer l'évacuation des gravats ? Je m'en occupe.",
    });

    console.log("Seed terminé.");
    console.log(`  entreprise: ${entreprise.id} (${entreprise.nom})`);
    console.log(`  utilisateur: ${utilisateur.id} (${utilisateur.email})`);
  });
}

// Catalogue partagé (lot IA-05) — global, idempotent, jamais tronqué par le
// TRUNCATE ci-dessus (aucune colonne entreprise_id sur ces tables).
async function seedCatalogue() {
  console.log("Seed du catalogue partagé (idempotent)...");
  await creerPrestationCatalogue({
    nomCanonique: "Élagage",
    synonymes: ["abattage", "démontage", "dessouchage"],
    variantes: ["sapin", "arbre", "conifère"],
    categorie: "espaces verts",
    unite: "forfait",
  });
  await creerMaterielCatalogue({
    nomCanonique: "Nacelle",
    variantes: ["plateforme élévatrice"],
    categorie: "matériel élévation",
  });
}

seedCatalogue()
  .then(() => main())
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    return pool.end().finally(() => process.exit(1));
  });
