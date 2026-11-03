/**
 * La mise en demeure : ce qu'elle réclame, et à qui (src/lib/mise-en-demeure.ts).
 * Les chiffres sont ceux de sa planche du 24 septembre 2026
 * (`appli/mise-en-demeure.html`) : F2026-000012, M. Martin, 1 440,00 € TTC.
 */
import assert from "node:assert/strict";
import type { PDFFont } from "pdf-lib";
import { couperLaLettre, type Polices } from "../src/server/pdf/mise-en-demeure-pdf";
import {
  lettreDeMiseEnDemeure,
  phraseDeLAttente,
  quandLaMiseEnDemeure,
  villeDeLAdresse,
  type FacturePourMiseEnDemeure,
} from "../src/lib/mise-en-demeure";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const FACTURE: FacturePourMiseEnDemeure = {
  numero: "F2026-000012",
  dateEmission: "2026-10-09",
  dateEcheance: "2026-10-24",
  totalTtc: "1440.00",
  reste: "1440.00",
  clientNom: "Martin",
  clientCivilite: "mr",
  clientAdresse: "5 rue des Lilas, 44000 Nantes",
  adresseChantier: "5 rue des Lilas, Nantes",
  entrepriseNom: "Atelier Démo",
  entrepriseAdresse: "10 rue des Artisans, 44000 Nantes",
};

const texte = (l: ReturnType<typeof lettreDeMiseEnDemeure>) =>
  l.paragraphes.map((p) => p.map((s) => s.texte).join("")).join("\n");

cas("la lettre de sa planche : la facture, sa date, le montant, l'échéance, huit jours", () => {
  const l = lettreDeMiseEnDemeure(FACTURE, "2026-10-27");
  assert.equal(l.lieuEtDate, "Nantes, le 27 octobre 2026");
  assert.equal(l.appellation, "Monsieur Martin,");
  assert.equal(l.formule, "Je vous prie d'agréer, Monsieur, mes salutations distinguées.");
  const t = texte(l);
  assert.match(t, /Le 9 octobre 2026, je vous ai adressé la facture n° F2026-000012 pour les travaux réalisés à l'adresse 5 rue des Lilas, Nantes, d'un montant de 1\s440,00\s€ TTC, payable avant le 24 octobre 2026\./);
  assert.doesNotMatch(t, /Par facture/);
  assert.match(t, /cette somme reste impayée/);
  assert.match(t, /la somme de 1\s440,00\s€ dans un délai de huit jours/);
  assert.deepEqual(l.destinataire, ["Mr. Martin", "5 rue des Lilas, 44000 Nantes"]);
});

cas("UN ACOMPTE OU UN AVOIR : elle réclame le RESTE, jamais le total", () => {
  const t = texte(lettreDeMiseEnDemeure({ ...FACTURE, reste: "1140.00" }, "2026-10-27"));
  assert.match(t, /il reste à régler 1\s140,00\s€/);
  assert.match(t, /la somme de 1\s140,00\s€/);
  assert.doesNotMatch(t, /la somme de 1\s440/);
});

cas("sans civilité choisie, ou une société : « Madame, Monsieur », jamais un « Monsieur » deviné", () => {
  assert.equal(lettreDeMiseEnDemeure({ ...FACTURE, clientCivilite: null }, "2026-10-27").appellation, "Madame, Monsieur,");
  assert.equal(lettreDeMiseEnDemeure({ ...FACTURE, clientNom: "SCI Les Tilleuls", clientCivilite: null }, "2026-10-27").appellation, "Madame, Monsieur,");
  const l = lettreDeMiseEnDemeure({ ...FACTURE, clientNom: "Mme Roux", clientCivilite: null }, "2026-10-27");
  assert.equal(l.appellation, "Madame Roux,");
  assert.match(l.formule, /agréer, Madame,/);
});

cas("sans ville lisible, pas de ville inventée ; sans échéance ni adresse, la phrase reste entière", () => {
  const l = lettreDeMiseEnDemeure({ ...FACTURE, entrepriseAdresse: "Chemin du bois", dateEcheance: null, adresseChantier: null }, "2026-10-01");
  assert.equal(l.lieuEtDate, "Le 1er octobre 2026");
  assert.match(texte(l), /les travaux réalisés, d'un montant de 1\s440,00\s€ TTC\.\n/);
  assert.equal(villeDeLAdresse("12 av. Foch\n44400 Rezé"), "Rezé");
});

cas("LE PAPIER GARDE L'ESPACE AVANT UN MOT EN GRAS, et colle la virgule qui le suit", () => {
  // Vu sur le PDF avant livraison : « pour un montant de1 440,00 € ».
  const police = { widthOfTextAtSize: (t: string) => t.length * 5 } as unknown as PDFFont;
  const p: Polices = { normale: police, grasse: police };
  const ligne = (largeur: number) =>
    couperLaLettre(lettreDeMiseEnDemeure(FACTURE, "2026-10-27").paragraphes[0]!, p, largeur)
      .map((l) => l.map((m) => m.texte).join(""))
      .join(" ");
  assert.match(ligne(10_000), /montant de 1\s440,00\s€ TTC, payable/);
  // Coupé étroit, le montant ne se casse pas en deux lignes.
  assert.ok(ligne(120).split(" ").every((m) => !/^440/.test(m)), "le montant s'est coupé à son espace insécable");
});

// **AVANT L'ÉCHÉANCE, LA LETTRE ATTEND** — défaut vu le 2 novembre 2026 en
// ouvrant le vrai écran (planche `appli/soignee/facture.html`, état « Pas
// encore échue ») : la lettre se téléchargeait le jour même de l'envoi, et
// disait pourtant « reste impayée ». Un client en retard l'est dès le
// lendemain de l'échéance (`RAPPELS_PAR_DEFAUT.factureImpayeeJours`), pas
// avant : le jour même, il peut encore payer sans être en faute.
cas("AVANT L'ÉCHÉANCE, ET LE JOUR MÊME, LA LETTRE ATTEND ; LE LENDEMAIN, ELLE PART", () => {
  assert.deepEqual(quandLaMiseEnDemeure(FACTURE, "2026-10-09"), { possible: false, echeance: "2026-10-24" });
  assert.deepEqual(quandLaMiseEnDemeure(FACTURE, "2026-10-23"), { possible: false, echeance: "2026-10-24" });
  assert.deepEqual(quandLaMiseEnDemeure(FACTURE, "2026-10-24"), { possible: false, echeance: "2026-10-24" });
  assert.deepEqual(quandLaMiseEnDemeure(FACTURE, "2026-10-25"), { possible: true });
  // Le passage d'un mois et d'une année ne se compte pas en chiffres.
  assert.deepEqual(quandLaMiseEnDemeure({ ...FACTURE, dateEcheance: "2026-12-31" }, "2027-01-01"), { possible: true });
  assert.equal(quandLaMiseEnDemeure({ ...FACTURE, dateEcheance: "2026-12-31" }, "2026-12-31").possible, false);
});

cas("SANS ÉCHÉANCE, C'EST LA DATE DE LA FACTURE QUI COMPTE (aucun délai : payable à réception)", () => {
  const sans = { ...FACTURE, dateEcheance: null };
  assert.deepEqual(quandLaMiseEnDemeure(sans, "2026-10-09"), { possible: false, echeance: "2026-10-09" });
  assert.deepEqual(quandLaMiseEnDemeure(sans, "2026-10-10"), { possible: true });
});

cas("une date illisible ne fait pas partir la lettre : ne pas savoir n'est jamais « échue »", () => {
  assert.equal(quandLaMiseEnDemeure({ ...FACTURE, dateEcheance: "24/10/2026" }, "2026-11-30").possible, false);
  assert.equal(quandLaMiseEnDemeure(FACTURE, "").possible, false);
});

cas("la phrase de l'attente dit le jour, et l'année seulement si ce n'est pas la nôtre", () => {
  assert.equal(
    phraseDeLAttente("2026-12-02", "2026-11-02"),
    "L'échéance tombe le mercredi 2 décembre. Jusque-là, la facture n'est pas impayée : la lettre attend le lendemain."
  );
  assert.match(phraseDeLAttente("2027-01-08", "2026-12-20"), /tombe le vendredi 8 janvier 2027\./);
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
