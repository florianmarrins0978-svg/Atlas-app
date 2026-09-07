// REGARDER LE SECOND ARRÊT — les trois états que ce lot change.
//
// **Pourquoi ce script existe.** `CLAUDE.md` §5 : *« et surtout, regarder
// l'écran »*. Quatre défauts réels de ce dépôt sont sortis d'une capture et
// d'aucun test vert. Les états qui comptent ici ne s'atteignent pas à la main
// en trente secondes : il faut un devis à deux TVA avec un prix accordé, puis
// un devis v2 envoyé APRÈS la facture.
//
// **Il ne passe pas par la fiche du chantier**, et c'est délibéré : elle est en
// train d'être retirée par un autre lot. Les états sont bâtis par les dépôts,
// et le navigateur ne fait qu'ouvrir l'adresse de la facture.
//
//   npx tsx scripts/capture-facture-impeccable.mts <dossier>
//
// Il attend un serveur sur localhost:3000 servant la MÊME base.
import { mkdirSync, readFileSync } from "node:fs";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { lignesDevis } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";
import { creerEnvoiFacture } from "../src/server/repositories/envois-factures";
import { mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import { ecrireCharte } from "../src/server/repositories/charte-personne";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-facture-impeccable.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(
  "select u.id as uid, m.entreprise_id as eid from users u join membres_entreprise m on m.utilisateur_id = u.id where u.email = 'demo@atlas.local' limit 1"
);
if (rows.length === 0) {
  console.error("Le compte de démonstration est absent : la base n'est pas amorcée.");
  process.exit(1);
}
const ctx = { utilisateurId: rows[0].uid as string, entrepriseId: rows[0].eid as string };

/** Un chantier dont le devis est parti, avec autant de lignes qu'on veut. */
async function chantier(nom: string, lignes: { libelle: string; montant: string; taux?: string }[]) {
  // **SON NOM, ET RIEN D'AUTRE.** Il portait l'horodatage qui rend les jeux
  // d'essai uniques — « Mme Grospiron 1788541773027 » —, et ce nom-là passait à
  // la ligne : la carte du haut gagnait une vingtaine de pixels, et la mesure du
  // pli annonçait 309 px au lieu de 287. Un contrôle qui mesure un écran que le
  // patron ne verra jamais mesure autre chose que ce qu'il prétend.
  const client = await clientsRepo.creerClient(ctx, {
    nom: "Mme Grospiron",
    telephone: "0612345678",
  });
  const c = await chantiersRepo.creerChantier(ctx, {
    nom,
    adresseChantier: "5 rue des Lilas",
    clientId: client.id,
  });
  for (const l of lignes) await prixRepo.ajouterLignePrix(ctx, c.id, l.libelle, l.montant);
  return c.id;
}

/** Pose le taux d'une catégorie sur les lignes du devis qui le demandent. */
async function poserLesTaux(devisId: string, taux: (string | undefined)[]) {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const l = await tx.select().from(lignesDevis).where(eq(lignesDevis.devisId, devisId));
    const ordonnees = l.sort((a, b) => a.ordre - b.ordre);
    for (let i = 0; i < ordonnees.length && i < taux.length; i++) {
      const t = taux[i];
      if (t) await tx.update(lignesDevis).set({ tauxTva: t }).where(eq(lignesDevis.id, ordonnees[i].id));
    }
  });
}

// ── A. Le cas qui montre tout : deux TVA, et un prix accordé au client ──────
const idA = await chantier("Élagage et plantation", [
  { libelle: "Élagage d'un tilleul", montant: "800.00" },
  { libelle: "Fourniture de végétaux", montant: "400.00" },
]);
const devisA = await devisRepo.getOuCreerDevisBrouillon(ctx, idA);
await poserLesTaux(devisA.id, [undefined, "10.00"]);
await devisRepo.mettreAJourEnTeteDevis(ctx, devisA.id, { reductionPourcent: "15" });
await devisRepo.envoyerDevis(ctx, devisA.id);
await terminerChantier(ctx, idA);

// ── B. La facture en retard sur son devis ───────────────────────────────────
const idB = await chantier("Taille de haie", [{ libelle: "Taille", montant: "1000.00" }]);
const devisB1 = await devisRepo.getOuCreerDevisBrouillon(ctx, idB);
await devisRepo.envoyerDevis(ctx, devisB1.id);
await terminerChantier(ctx, idB);
await prixRepo.ajouterLignePrix(ctx, idB, "Évacuation des déchets verts", "200.00");
const devisB2 = await devisRepo.getOuCreerDevisBrouillon(ctx, idB);
await devisRepo.envoyerDevis(ctx, devisB2.id);

// ── C. La page que le client ouvre ──────────────────────────────────────────
const idC = await chantier("Tonte de printemps", [{ libelle: "Tonte", montant: "300.00" }]);
const devisC = await devisRepo.getOuCreerDevisBrouillon(ctx, idC);
await devisRepo.envoyerDevis(ctx, devisC.id);
const factureC = await terminerChantier(ctx, idC);
await emettreFacture(ctx, factureC.id);
const envoiC = await creerEnvoiFacture(ctx, factureC.id, "sms");

// ── D. La même page, mais partie APRÈS qu'il a réglé l'allure ───────────────
//
// **L'ordre est tout le sujet depuis la migration 0074.** L'aspect se fige à
// l'ÉMISSION : une facture partie avant le réglage n'en porte rien, une facture
// partie après le porte pour toujours. Les deux se photographient côte à côte,
// et c'est la seule façon de VOIR sa règle du 4 septembre.
await mettreAJourEntreprise(ctx, {
  allure: { typographie: "inter", fond: "#101010", accent: "#c0392b" },
});
const idD = await chantier("Massif d'automne", [{ libelle: "Plantation", montant: "450.00" }]);
const devisD = await devisRepo.getOuCreerDevisBrouillon(ctx, idD);
await devisRepo.envoyerDevis(ctx, devisD.id);
const factureD = await terminerChantier(ctx, idD);
await emettreFacture(ctx, factureD.id);
const envoiD = await creerEnvoiFacture(ctx, factureD.id, "sms");

// ── Le navigateur : l'écran qu'il a dans la main, 390 × 664 ─────────────────
const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
const page = await contexte.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

const manques: string[] = [];

async function photographier(nom: string, chemin: string) {
  await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
  // **L'INDICATEUR DU SERVEUR DE DÉVELOPPEMENT SORT DE L'IMAGE.** Il affiche
  // tantôt « N », tantôt « Compiling … » : deux captures du MÊME écran ne se
  // comparaient donc pas, et l'on croyait voir bouger une page qui n'avait pas
  // bougé d'un pixel. Il n'existe pas chez le patron.
  await page.addStyleTag({ content: "nextjs-portal, #__next-build-watcher { display: none !important }" });
  // **Attendre la mise en page, jamais `domcontentloaded` seul.** Une capture
  // prise avant la feuille de style montre un écran qui n'existe pas — et un
  // contrôle de dimensions y mesurerait zéro (`CLAUDE.md` §5).
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dossier}/${nom}.png`, fullPage: true });
  console.log(`  · ${nom}.png`);
}

async function exiger(nom: string, texte: string) {
  if ((await page.locator(`text=${texte}`).count()) === 0) manques.push(`${nom} : « ${texte} » absent`);
}

/**
 * À quelle hauteur tombe le geste du second arrêt.
 *
 * **On MESURE, on ne fait pas échouer.** Déplacer un bouton est une affaire
 * d'apparence : elle se dessine et se choisit avant de se coder (`CLAUDE.md`
 * §3 bis). Ce chiffre est là pour qu'on lui montre le vrai, pas le supposé.
 *
 * **ET IL A TRANCHÉ, LE 4 SEPTEMBRE 2026 : « on laisse et on descend comme
 * aujourd'hui ».** Ce chiffre n'est donc plus une question ouverte — c'est une
 * VEILLE : il dit de combien l'écran s'allonge quand on lui ajoute quelque
 * chose. Ne pas « corriger » le pli au motif qu'il est mesuré ; le resserrage
 * ne rendrait qu'une soixantaine de pixels contre 287, et 53 ont déjà été pris
 * le 31 août dans les mêmes espacements (`ARCHITECTURE.md` §255).
 *
 * **Et l'on refuse de conclure sur une boîte de zéro pixel** : une capture
 * prise avant la mise en page mesurerait 0, et « 0 est au-dessus du pli »
 * serait un vert qui ne prouve rien (`CLAUDE.md` §5).
 */
async function hauteurDuGeste(nom: string) {
  const boite = await page.locator('[data-atlas="envoyer-la-facture"]').first().boundingBox();
  if (!boite || boite.height === 0) {
    manques.push(`${nom} : le bouton d'envoi est introuvable ou de hauteur nulle`);
    return;
  }
  const pli = 664;
  const dessous = Math.round(boite.y + boite.height - pli);
  console.log(
    dessous > 0
      ? `  → ${nom} : « Envoyer la facture » tombe ${dessous} px SOUS le pli (390 × 664)`
      : `  → ${nom} : « Envoyer la facture » tient dans l'écran`
  );
}

console.log("Captures :");

// A — le total se recompose : prix accordé, deux taux, TTC
await photographier("a-totaux-origine", `/chantiers/${idA}/facture`);
await exiger("a", "Prix accordé au client 15 %");
await exiger("a", "Total HT après remise");
await exiger("a", "TVA 20 %");
await exiger("a", "TVA 10 %");
await hauteurDuGeste("a");

// B — la facture en retard, et son geste
await photographier("b-en-retard-origine", `/chantiers/${idB}/facture`);
await exiger("b", "Reprendre ce devis");
await hauteurDuGeste("b");

// C — la page du client, partie AVANT tout réglage : elle n'en portera jamais
await photographier("c-client-defaut", `/factures/${envoiC.jeton}`);
// D — partie APRÈS le réglage : elle le porte, et elle le gardera
await photographier("d-client-allure-figee", `/factures/${envoiD.jeton}`);

// ── Les deux mêmes écrans en NUIT — l'accent y est CLAIR, le fond SOMBRE ────
await ecrireCharte(ctx.utilisateurId, "nuit");
await photographier("a-totaux-nuit", `/chantiers/${idA}/facture`);
await photographier("b-en-retard-nuit", `/chantiers/${idB}/facture`);
// La page du client ne suit PAS sa charte : elle doit rester identique.
await photographier("c-client-en-nuit", `/factures/${envoiC.jeton}`);
await ecrireCharte(ctx.utilisateurId, null);

// ── SIX MOIS PLUS TARD, IL REFAIT SON ALLURE ───────────────────────────────
//
// **Ni C ni D ne doivent bouger d'un pixel.** C reste sans allure, D garde
// celle du jour de son envoi. C'est sa règle du 4 septembre, photographiée :
// *« un changement de réglage ne rattrape pas les anciennes »*.
await mettreAJourEntreprise(ctx, {
  allure: { typographie: "lato", fond: "#ffffff", accent: "#1a5c2e" },
});
await photographier("c-client-defaut-apres-reglage", `/factures/${envoiC.jeton}`);
await photographier("d-client-allure-figee-apres-reglage", `/factures/${envoiD.jeton}`);
await mettreAJourEntreprise(ctx, { allure: null });

/**
 * DEUX CAPTURES DU MÊME ÉCRAN DOIVENT ÊTRE LE MÊME FICHIER.
 *
 * **C'est sa règle du 4 septembre, éprouvée sur l'image et pas sur une colonne
 * de base :** *« une facture partie ne change plus d'aspect ; un changement de
 * réglage ne rattrape pas les anciennes »*. Une comparaison d'octets suffit, et
 * elle attrape ce qu'aucune assertion ne verrait — une couleur relue ailleurs,
 * une police qui retombe, un fond calculé au vol.
 *
 * **Elle n'a été fiable qu'une fois l'indicateur du serveur de développement
 * masqué** : il affiche tantôt « N », tantôt « Compiling … », et faisait
 * conclure qu'une page avait bougé alors qu'elle était identique au pixel près.
 */
for (const nom of ["c-client-defaut", "d-client-allure-figee"]) {
  const avant = readFileSync(`${dossier}/${nom}.png`);
  const apres = readFileSync(`${dossier}/${nom}-apres-reglage.png`);
  if (!avant.equals(apres)) {
    manques.push(`${nom} : la page a changé d'aspect après un changement de réglage`);
  }
}
// Et les deux ne doivent PAS se ressembler : sinon le figeage ne prouve rien,
// c'est le même écran photographié deux fois.
if (
  readFileSync(`${dossier}/c-client-defaut.png`).equals(
    readFileSync(`${dossier}/d-client-allure-figee.png`)
  )
) {
  manques.push("l'allure réglée ne se voit pas : les deux pages sont identiques");
}

await contexte.close();
await navigateur.close();
await pool.end();

if (manques.length > 0) {
  console.error("\n❌ Ce que l'écran devait porter et ne porte pas :");
  for (const m of manques) console.error(`   · ${m}`);
  process.exit(1);
}
console.log("\n✅ Les six planches sont dans " + dossier);
