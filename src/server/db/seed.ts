import { eq, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { hashSync } from "bcryptjs";
import { pool, db } from "./client";
import { createHash } from "node:crypto";
import { attribuerNumeroDevis } from "../repositories/devis";
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
        await tx.insert(photos).values(
          Array.from({ length: c.photos }, (_, i) => ({
            entrepriseId: entreprise.id,
            chantierId: chantier.id,
            storageKey: `seed/${chantier.id}/photo-${i + 1}.jpg`,
            mimeType: "image/jpeg",
            tailleOctets: 1_200_000,
            nomOriginal: `photo-${i + 1}.jpg`,
            checksum: `seed-checksum-${chantier.id}-${i + 1}`,
            ordre: i,
          }))
        );
      }

      if (c.aUneNoteVocale) {
        await tx.insert(notesVocales).values({
          entrepriseId: entreprise.id,
          chantierId: chantier.id,
          storageKey: `seed/${chantier.id}/note.m4a`,
          mimeType: "audio/mp4",
          tailleOctets: 850_000,
          nomOriginal: "note.m4a",
          checksum: `seed-checksum-note-${chantier.id}`,
          dureeSecondes: 134,
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
    await tx.update(devis).set({ statut: "envoye", envoyeLe: new Date() }).where(sql`id = ${d.id}`);

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
