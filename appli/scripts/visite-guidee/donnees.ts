// Pose, sur la base de démonstration, ce que les écrans neufs de la visite
// montrent : l'équipe, le chantier de M. Lefèvre et sa fiche de sécurité,
// les véhicules. TOUT EST INVENTÉ (sa consigne du 20 novembre, redite le 21 :
// « tu mets que des informations bidons ») : numéros de la tranche de fiction
// de l'ARCEP, plaques « DE-…-MO », example.com.
//
// À jouer sur une base de démonstration NEUVE, jamais sur la sienne :
//   DATABASE_URL=… (rôle atlas_app) DATABASE_ADMIN_URL=… npx tsx appli/scripts/visite-guidee/donnees.ts avant
//   … puis `figer.mjs` fige la fiche en cours (son croquis), et :
//   npx tsx appli/scripts/visite-guidee/donnees.ts signer
// Demande son « oui » : il faut l'appli et une base (CLAUDE.md §5).
import { Client } from "pg";
import { cocher, contenuVide, LIBELLES, RIEN_A_SIGNALER, type ContenuFiche } from "../../../src/lib/fiche-securite";
import type { Marque } from "../../../src/lib/croquis-securite";
import { completerLaFicheSignee, enregistrerLaFiche, ouvrirLaFiche, signerLaFiche } from "../../../src/server/repositories/fiches-securite";
import { creerVehicule, mettreAJourVehicule } from "../../../src/server/repositories/vehicules";
import { pool } from "../../../src/server/db/client";
import { lancer } from "../../../scripts/planche-figee/figer.mjs";

const quoi = process.argv[2];
const admin = new Client({ connectionString: "postgresql://postgres@localhost:5432/atlas_test" });

// Le croquis du chantier Lefèvre : la parcelle, la maison, le tilleul et sa
// zone de chute, la haie dessinée au crayon le long du chemin, l'accès, le
// stockage, le réseau, les secours. Pas de ligne électrique : la fiche dit
// « Rien à signaler » pour les réseaux, et le croquis ne la contredit pas.
const CROQUIS: Marque[] = [
  { t: "limite", x: 24, y: 22, x2: 376, y2: 262 },
  { t: "voie", x: 0, y: 284, x2: 400, y2: 284 },
  { t: "acces", x: 312, y: 284, x2: 312, y2: 236 },
  { t: "maison", x: 112, y: 92 },
  { t: "tailler", x: 214, y: 118 },
  { t: "danger", x: 252, y: 150, mot: "Chute de branches" },
  { t: "crayon", pts: [40, 250, 90, 252, 140, 249, 190, 251, 240, 249, 290, 251] },
  { t: "stockage", x: 336, y: 196 },
  { t: "reseau", x: 72, y: 206 },
  { t: "secours", x: 352, y: 232 },
];

// Une signature tracée au doigt sur une toile, rendue en PNG, comme la signe l'écran.
async function signatures(): Promise<Record<string, string>> {
  const nav = await lancer();
  const page = await nav.newPage();
  const traces: Record<string, number[][]> = {
    chef: [[10, 60, 30, 20, 50, 70, 70, 25, 95, 65, 120, 30, 150, 62, 190, 40, 240, 55]],
    Paul: [[15, 55, 40, 25, 60, 60, 85, 30, 110, 58], [125, 40, 170, 42]],
    Kévin: [[12, 30, 35, 65, 60, 30], [80, 50, 120, 35, 150, 60, 185, 45]],
  };
  const png: Record<string, string> = await page.evaluate((traces: Record<string, number[][]>) => {
    const r: Record<string, string> = {};
    for (const [nom, lignes] of Object.entries(traces)) {
      const c = document.createElement("canvas"); c.width = 260; c.height = 90;
      const g = c.getContext("2d")!; g.lineWidth = 2.4; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#1c1c1a";
      for (const l of lignes) { g.beginPath(); g.moveTo(l[0], l[1]); for (let i = 2; i < l.length; i += 2) g.quadraticCurveTo(l[i - 2], l[i - 1], (l[i - 2] + l[i]) / 2, (l[i - 1] + l[i + 1]) / 2); g.lineTo(l.at(-2)!, l.at(-1)!); g.stroke(); }
      r[nom] = c.toDataURL("image/png");
    }
    return r;
  }, traces);
  await nav.close();
  return png;
}

async function main() {
  await admin.connect();
  const { rows: [demo] } = await admin.query(`SELECT u.id AS "utilisateurId", m.entreprise_id AS "entrepriseId" FROM users u JOIN membres_entreprise m ON m.utilisateur_id = u.id WHERE u.email = 'demo@atlas.local' LIMIT 1`);
  const ctx = { utilisateurId: demo.utilisateurId as string, entrepriseId: demo.entrepriseId as string };
  const e = ctx.entrepriseId;

  if (quoi === "avant") {
    // L'entreprise de démonstration porte « 02 40 00 00 00 » et « contact@atelier-demo.fr »
    // (le jeu de `seed.ts`) : un numéro et un domaine qui peuvent exister. Ceux de la
    // visite d'origine sont fictifs (tranche de l'ARCEP, example.com). Les exemples de
    // facture les imprimaient en PDF : vu le 22 novembre, en ligne.
    await admin.query(`UPDATE entreprises SET telephone = '02 61 91 00 00', email = 'contact@example.com' WHERE id = $1`, [e]);
    // L'équipe : Paul, Kévin, Hugo.
    const equipe: Record<string, string> = {};
    for (const [rang, nom] of [[1, "Paul"], [2, "Kévin"], [3, "Hugo"]] as const) {
      const { rows: [x] } = await admin.query(`INSERT INTO equipes (entreprise_id, rang, nom) VALUES ($1, $2, $3) ON CONFLICT (entreprise_id, rang) DO UPDATE SET nom = EXCLUDED.nom RETURNING id`, [e, rang, nom]);
      equipe[nom] = x.id;
    }
    // M. Lefèvre et son chantier du mercredi 25 novembre, la journée.
    // Le numéro sans espaces : tel que la fiche client dictée de la visite d'origine l'a
    // enregistré, et tel que son devis l'imprime.
    const { rows: [client] } = await admin.query(
      `INSERT INTO clients (entreprise_id, nom, civilite, telephone, email, adresse) VALUES ($1, 'Lefèvre', 'mr', '0639981234', 'lefevre@example.com', '7 chemin du Verger, 44300 Nantes') RETURNING id`, [e]);
    const { rows: [chantier] } = await admin.query(
      `INSERT INTO chantiers (entreprise_id, nom, client_id, adresse_chantier, date_planifiee, creneau_debut, duree_demi_journees)
       VALUES ($1, 'Lefèvre', $2, '7 chemin du Verger, 44300 Nantes', '2026-11-25', 'matin', 2) RETURNING id`, [e, client.id]);
    for (const demi of ["matin", "apres_midi"]) {
      await admin.query(`INSERT INTO creneaux_chantier (entreprise_id, chantier_id, jour, demi) VALUES ($1, $2, '2026-11-25', $3)`, [e, chantier.id, demi]);
      for (const nom of ["Paul", "Kévin"]) await admin.query(`INSERT INTO equipes_du_chantier (entreprise_id, chantier_id, jour, demi, equipe_id) VALUES ($1, $2, '2026-11-25', $3, $4)`, [e, chantier.id, demi, equipe[nom]]);
    }
    // Les prix du chantier, ceux de la visite d'origine : le DEVIS, c'est l'appli qui le
    // fait en ouvrant sa page (`getOuCreerDevisBrouillon`), avec tout ce qu'elle y copie
    // de l'entreprise et du client. Un devis écrit ici à la main n'en portait rien, et
    // sa page ne montrait aucune ligne (22 novembre). Le compteur à 4 : « 2026-000004 ».
    const lignes = [["Taille de la haie de thuyas le long du chemin", 25, "ml", 12, 300], ["Ramassage et évacuation des déchets verts", 1, "forfait", 90, 90], ["Élagage du tilleul devant la maison", 1, "u", 380, 380]] as const;
    let ordre = 0;
    for (const [libelle, q, u, pu, m] of lignes) await admin.query(`INSERT INTO lignes_prix (entreprise_id, chantier_id, libelle, quantite, unite, prix_unitaire, montant, ordre) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [e, chantier.id, libelle, q, u, pu, m, ordre++]);
    await admin.query(`UPDATE chantiers SET informations_verifiees_at = '2026-11-21T09:00:00Z', prix_valide_at = '2026-11-21T09:05:00Z' WHERE id = $1`, [chantier.id]);
    await admin.query(`UPDATE entreprise_compteurs SET prochain_numero_devis = 4, prochain_numero_facture = 2 WHERE entreprise_id = $1`, [e]);

    // La fiche, remplie : tout ce que la loi demande, et le croquis.
    await ouvrirLaFiche(ctx, chantier.id);
    let c: ContenuFiche = {
      ...contenuVide(),
      donneur: "client", donneurNom: "Lefèvre", donneurPrenom: "Michel", donneurTel: "06 39 98 12 34", donneurRole: "Propriétaire",
      responsableNom: "Morel", responsablePrenom: "Julien", responsableTel: "06 39 98 00 11", telephoneIncident: "06 39 98 00 11",
      nombreDeTravailleurs: 3, pointDeRencontre: "Devant le portail, chemin du Verger", lieuTrousse: "Dans le camion, sous le siège passager",
      observations: "Tilleul de 14 m, deux charpentières au-dessus du toit.", signataire: "Julien Morel",
      equipe: [
        { nom: "Paul", present: true, formations: [], sst: "2025-09-12", gsa: "" },
        { nom: "Kévin", present: true, formations: [], sst: "2025-03-04", gsa: "" },
      ],
      croquis: { fond: "blanc", fondPhotoId: null, marques: CROQUIS },
    };
    for (const t of ["Élagage d’entretien", "Broyage", "Évacuation des rémanents"]) c = cocher(c, "travaux", t);
    for (const t of LIBELLES.coupe.slice(0, 2)) c = cocher(c, "coupe", t);
    for (const t of LIBELLES.epi.slice(0, 5)) c = cocher(c, "epi", t);
    c = cocher(c, "balisage", LIBELLES.balisage[0]);
    for (const f of ["risquesArbres", "biologique", "reseaux", "environnement"] as const) c = cocher(c, f, RIEN_A_SIGNALER);
    c = cocher(c, "noyade", "Pas de risque de noyade");
    c = cocher(c, "meteo", LIBELLES.meteo[0]);
    c = cocher(c, "secours", LIBELLES.secours[0]);
    await enregistrerLaFiche(ctx, chantier.id, { contenu: c, etapeVue: 1, loiLue: true });

    // Les véhicules, avec des contrôles proches : le rappel de l'accueil part deux mois avant.
    const vehicules = [
      { nom: "Camion benne", plaque: "DE-123-MO", modele: "Renault Master benne", controleTechniqueAvant: "2026-12-03", pollutionAvant: "2027-03-15" },
      { nom: "Fourgon", plaque: "DE-456-MO", modele: "Peugeot Boxer", controleTechniqueAvant: "2027-06-30", pollutionAvant: "2026-12-20" },
      { nom: "Petit utilitaire", plaque: "DE-789-MO", modele: "Renault Kangoo", controleTechniqueAvant: "2027-09-10", pollutionAvant: null },
    ];
    for (const { nom, ...champs } of vehicules) {
      const v = await creerVehicule(ctx, nom);
      await mettreAJourVehicule(ctx, v.id, champs as never);
    }
    console.log(JSON.stringify({ chantier: chantier.id }));
  }

  // Ce que l'appli date « aujourd'hui » se recale sur la visite d'origine, faite le 21 novembre.
  const chantierLefevre = async () => (await admin.query(`SELECT id FROM chantiers WHERE entreprise_id = $1 AND nom = 'Lefèvre' AND deleted_at IS NULL LIMIT 1`, [e])).rows[0].id as string;
  // L'aperçu du PDF, comme au moment de la visite d'origine : le devis porte son titre,
  // et le chantier n'a pas encore de durée (elle se choisit avec la date, à l'étape
  // suivante) ; sans quoi le PDF imprimerait une « Durée estimée » que l'ancien n'avait pas.
  if (quoi === "apercu") {
    const id = await chantierLefevre();
    await admin.query(`UPDATE devis SET titre = 'Entretien du jardin', date_emission = '2026-11-21', date_validite = '2026-12-21' WHERE chantier_id = $1`, [id]);
    await admin.query(`UPDATE chantiers SET duree_demi_journees = NULL WHERE id = $1`, [id]);
  }
  if (quoi === "apres-apercu") {
    await admin.query(`UPDATE chantiers SET duree_demi_journees = 2 WHERE id = $1`, [await chantierLefevre()]);
  }
  // Pour facturer : le devis envoyé (la facture reprend la dernière version ENVOYÉE),
  // et le chantier passé au 18 novembre, comme la visite d'origine l'avait fait.
  if (quoi === "facturer") {
    const id = await chantierLefevre();
    await admin.query(`UPDATE devis SET statut = 'envoye', envoye_le = '2026-11-21T10:00:00Z' WHERE chantier_id = $1`, [id]);
    await admin.query(`UPDATE chantiers SET date_planifiee = '2026-11-18', devis_genere_at = '2026-11-21T09:30:00Z', devis_envoye_at = '2026-11-21T10:00:00Z' WHERE id = $1`, [id]);
    for (const t of ["creneaux_chantier", "equipes_du_chantier"]) await admin.query(`UPDATE ${t} SET jour = '2026-11-18' WHERE chantier_id = $1`, [id]);
  }
  if (quoi === "dater-facture") {
    await admin.query(`UPDATE factures SET date_emission = '2026-11-21', date_echeance = '2026-12-21' WHERE chantier_id = $1`, [await chantierLefevre()]);
  }

  if (quoi === "signer") {
    const { rows: [ch] } = await admin.query(`SELECT id FROM chantiers WHERE entreprise_id = $1 AND nom = 'Lefèvre' AND deleted_at IS NULL LIMIT 1`, [e]);
    const png = await signatures();
    await signerLaFiche(ctx, ch.id, { signaturePng: png.chef, signataire: "Julien Morel" });
    // Les lectures de l'équipe et la réponse « plan de prévention » viennent APRÈS la
    // signature, par leurs propres gestes : écrites avant, elles ne sont pas gardées.
    // « Oui » fait paraître « Envoyer au client » sur la fiche signée.
    await completerLaFicheSignee(ctx, ch.id, (c) => ({ ...c, prevention: "oui", lectures: ["Paul", "Kévin"].map((nom) => ({ nom, png: png[nom], le: "2026-11-25T06:52:00.000Z" })) }));
    // Signée le matin du chantier, avant le départ (7 h 45, heure de Paris), et
    // non à l'heure où ce script tourne.
    await admin.query(`UPDATE fiches_securite SET signee_le = '2026-11-25T06:45:00Z' WHERE chantier_id = $1`, [ch.id]);
    console.log(JSON.stringify({ chantier: ch.id, signee: true }));
  }
  await admin.end();
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
