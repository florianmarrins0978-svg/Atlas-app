import assert from "node:assert/strict";
import { Client } from "pg";
import { nettoyerBase } from "./_test-db";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as photosRepo from "../src/server/repositories/photos";
import {
  contexteDuChantier,
  enregistrerLaFiche,
  ficheDuChantier,
  listerLesFichesDuMois,
  marquerTransmise,
  memoireDeLEntreprise,
  ouvrirLaFiche,
  photoTenueParUneFiche,
  rouvrirLaFiche,
  signerLaFiche,
} from "../src/server/repositories/fiches-securite";
import { cocher, contenuVide, estCoche } from "../src/lib/fiche-securite";

// LA FICHE DE SÉCURITÉ, EN BASE — sous `atlas_app`, donc sous la RLS.
//
// Ce qui se prouve ici et nulle part ailleurs : une entreprise ne voit jamais
// la fiche d'une autre ; un chantier n'a qu'une fiche ; ce qui est gardé d'une
// fiche à l'autre l'est par ENTREPRISE ; et une photo qu'une fiche montre ne
// part pas en purge quand on l'efface de la pellicule — le piège des retours
// (migration 0080), rejoué pour la fiche (migration 0099).

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

const admin = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVQIW2NkYGD4z8DAwMAAAAgEAQC6xj9EAAAAAElFTkSuQmCC";

async function main() {
  console.log("=== La fiche de sécurité, en base ===\n");
  await admin.connect();
  await nettoyerBase();
  const A = await entreprisesRepo.creerEntreprise({ nom: "Paysages A", telephone: "06 11 11 11 11" }, { email: `securite-a-${Date.now()}@test.local`, nom: "Anne" });
  const B = await entreprisesRepo.creerEntreprise({ nom: "Paysages B" }, { email: `securite-b-${Date.now()}@test.local`, nom: "Bruno" });
  const ctxA = { utilisateurId: A.utilisateurId, entrepriseId: A.entreprise.id };
  const ctxB = { utilisateurId: B.utilisateurId, entrepriseId: B.entreprise.id };
  const chantierA = await chantiersRepo.creerChantier(ctxA, { nom: "Chêne Rialland" });
  const autreA = await chantiersRepo.creerChantier(ctxA, { nom: "Tilleuls Bernard" });
  const chantierB = await chantiersRepo.creerChantier(ctxB, { nom: "Platane Durand" });

  await essai("un chantier sans fiche n'en a pas ; l'ouvrir en crée UNE, vide, et la rouvrir rend la même", async () => {
    assert.equal(await ficheDuChantier(ctxA, chantierA.id), null);
    const f1 = await ouvrirLaFiche(ctxA, chantierA.id);
    assert.equal(f1.chantierId, chantierA.id);
    assert.equal(f1.signeeLe, null);
    assert.equal(f1.etapeVue, 0);
    assert.equal(Object.keys(f1.contenu.coches).length, 0, "rien n'est coché sur une fiche neuve");
    const f2 = await ouvrirLaFiche(ctxA, chantierA.id);
    assert.equal(f2.id, f1.id, "une fiche par chantier, pas une par ouverture");
  });

  await essai("ce qu'Atlas sait du chantier arrive sans ressaisie : l'entreprise, son téléphone, le patron", async () => {
    const c = await contexteDuChantier(ctxA, chantierA.id);
    assert.ok(c);
    assert.equal(c.chantierNom, "Chêne Rialland");
    assert.equal(c.entreprise.nom, "Paysages A");
    assert.equal(c.entreprise.telephone, "06 11 11 11 11");
    assert.equal(c.patron.nom, "Anne");
    assert.equal(c.numeroDevis, null, "pas de devis : rien d'inventé");
    assert.equal(await contexteDuChantier(ctxB, chantierA.id), null, "le chantier de A n'existe pas pour B");
  });

  await essai("l'entreprise B ne voit pas la fiche de A, ni ne peut l'écrire", async () => {
    assert.equal(await ficheDuChantier(ctxB, chantierA.id), null);
    const ecrit = await enregistrerLaFiche(ctxB, chantierA.id, { contenu: cocher(contenuVide(), "travaux", "Haubanage"), etapeVue: 2, loiLue: true });
    assert.equal(ecrit, null, "l'UPDATE de B ne touche aucune ligne de A");
    const deA = await ficheDuChantier(ctxA, chantierA.id);
    assert.ok(deA && !estCoche(deA.contenu, "travaux", "Haubanage"));
  });

  await essai("enregistrer garde le contenu et l'étape ; ce qui est coché revient sur la fiche SUIVANTE de la même entreprise, pas chez B", async () => {
    let contenu = cocher(contenuVide(), "travaux", "Élagage d’entretien");
    contenu = { ...contenu, mainDOeuvre: "3 personnes en CDI", lieuTrousse: "camion", pointDeRencontre: "portail", gps: "48, 1" };
    const f = await enregistrerLaFiche(ctxA, chantierA.id, { contenu, etapeVue: 3, loiLue: true });
    assert.ok(f);
    assert.equal(f.etapeVue, 3);
    assert.equal(f.loiLue, true);
    const memoire = await memoireDeLEntreprise(ctxA);
    assert.equal(memoire.mainDOeuvre, "3 personnes en CDI");
    assert.deepEqual(memoire.coches.travaux, ["Élagage d’entretien"]);
    const suivante = await ouvrirLaFiche(ctxA, autreA.id);
    assert.ok(estCoche(suivante.contenu, "travaux", "Élagage d’entretien"), "*« tout ce qui se coche reste enregistré pour les fiches suivantes »*");
    assert.equal(suivante.contenu.lieuTrousse, "camion");
    assert.equal(suivante.contenu.pointDeRencontre, "", "le point de rencontre est propre au chantier");
    assert.equal(suivante.contenu.gps, "");
    const deB = await ouvrirLaFiche(ctxB, chantierB.id);
    assert.equal(deB.contenu.mainDOeuvre, "", "la mémoire de A n'est pas celle de B");
    assert.equal(Object.keys(deB.contenu.coches).length, 0);
  });

  await essai("signer pose la date, le nom, le trait ; transmettre pose sa date ; rouvrir efface tout ça", async () => {
    const signee = await signerLaFiche(ctxA, chantierA.id, { signaturePng: PNG, signataire: "  Anne Rialland " });
    assert.ok(signee?.signeeLe);
    assert.equal(signee.signataire, "Anne Rialland");
    assert.equal(signee.signaturePng, PNG);
    assert.equal(signee.transmiseLe, null);
    const transmise = await marquerTransmise(ctxA, chantierA.id);
    assert.ok(transmise?.transmiseLe);
    assert.equal(await marquerTransmise(ctxA, chantierA.id), null, "transmettre deux fois ne réécrit pas la date");
    assert.equal(await signerLaFiche(ctxB, chantierA.id, { signaturePng: PNG, signataire: "Bruno" }), null, "B ne signe pas la fiche de A");
    const rouverte = await rouvrirLaFiche(ctxA, chantierA.id);
    assert.ok(rouverte);
    assert.equal(rouverte.signeeLe, null);
    assert.equal(rouverte.signaturePng, null);
    assert.equal(rouverte.transmiseLe, null);
    assert.ok(estCoche(rouverte.contenu, "travaux", "Élagage d’entretien"), "rouvrir garde le contenu : on re-signe, on ne recommence pas");
  });

  await essai("la liste de Paysage : les fiches SIGNÉES du mois, rangées par client, de A seulement", async () => {
    await signerLaFiche(ctxA, chantierA.id, { signaturePng: PNG, signataire: "Anne" });
    await ouvrirLaFiche(ctxB, chantierB.id);
    await signerLaFiche(ctxB, chantierB.id, { signaturePng: PNG, signataire: "Bruno" });
    const maintenant = new Date();
    const mois = { annee: maintenant.getUTCFullYear(), mois: maintenant.getUTCMonth() + 1 };
    const deA = await listerLesFichesDuMois(ctxA, mois);
    assert.deepEqual(deA.map((f) => f.chantierNom), ["Chêne Rialland"], "la fiche non signée de « Tilleuls Bernard » n'y est pas, ni celle de B");
    assert.equal(deA[0].client, "Sans client");
    assert.equal(deA[0].signataire, "Anne");
    const moisDAvant = mois.mois === 1 ? { annee: mois.annee - 1, mois: 12 } : { annee: mois.annee, mois: mois.mois - 1 };
    assert.deepEqual(await listerLesFichesDuMois(ctxA, moisDAvant), [], "un autre mois, rien");
  });

  await essai("une photo qu'une fiche montre ne part pas en purge quand on l'efface de la pellicule", async () => {
    const ajout = await photosRepo.ajouterPhoto(ctxA, chantierA.id, {
      storageKey: `chantiers/${chantierA.id}/photos/fiche-securite-essai.jpg`,
      mimeType: "image/jpeg",
      tailleOctets: 10,
      nomOriginal: "fiche.jpg",
      checksum: "a".repeat(64),
    });
    assert.ok(ajout.ok);
    const photoId = ajout.photo.id;
    const fiche = await ficheDuChantier(ctxA, chantierA.id);
    assert.ok(fiche);
    await enregistrerLaFiche(ctxA, chantierA.id, { contenu: { ...fiche.contenu, photoIds: [photoId] }, etapeVue: 6, loiLue: true });
    assert.equal(await photoTenueParUneFiche(ctxA, photoId), true);
    const enPurgeAvant = Number((await admin.query<{ n: number }>("SELECT count(*)::int AS n FROM fichiers_a_purger")).rows[0].n);
    await photosRepo.supprimerPhoto(ctxA, photoId);
    const enPurgeApres = Number((await admin.query<{ n: number }>("SELECT count(*)::int AS n FROM fichiers_a_purger")).rows[0].n);
    assert.equal(enPurgeApres, enPurgeAvant, "le fichier de la fiche a été mis en purge : dans deux ans, la fiche montrerait un trou");
  });

  await essai("sans contexte d'entreprise, la table ne rend rien (FORCE ROW LEVEL SECURITY)", async () => {
    const { rows } = await admin.query("SELECT count(*)::int AS n FROM fiches_securite");
    assert.equal(Number(rows[0].n), 0, "le propriétaire voit des fiches sans contexte : la RLS n'est pas forcée");
  });

  await admin.end();
  await pool.end();
  console.log(echecs === 0 ? "\n✅ La fiche de sécurité tient en base." : `\n❌ ${echecs} cas en échec.`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
