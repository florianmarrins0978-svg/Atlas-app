#!/usr/bin/env node
/*
  CE QUE LE PLANNING ENVOIE AU TÉLÉPHONE, selon la mémoire qu'on lui donne.

  **Sa question du 31 août 2026 :** *« combien si je décide de garder en mémoire
  2 ans ? C'est trop lourd ou pas ? »* — et une question de coût ne se répond pas
  au jugé. Ce script existe pour que le chiffre soit REFAIT plutôt que recopié le
  jour où il redemandera, ou le jour où la ligne d'un chantier grossira.

  **Ce qu'il mesure, et ce qu'il ne mesure pas.** Les champs sont exactement ceux
  que rend `listerChantiersPourPlanning` — c'est ce qui descend dans la page. Il
  ne mesure ni la base (la donnée y est déjà, et le restera : rien n'est effacé),
  ni le temps de rendu, qui est celui d'une carte de mille entrées construite une
  fois.

  **Les lignes sont VARIÉES, et c'est le cœur de la mesure.** Une première
  version fabriquait mille fois la même ligne : elle se comprimait à un taux
  qu'aucune vraie base n'atteindra, et annonçait 9 Ko là où la mesure honnête en
  donne 71. Un chiffre qui flatte est pire qu'aucun chiffre — c'est sur lui qu'on
  décide.

      node scripts/mesurer-poids-planning.mjs
*/

import { gzipSync, brotliCompressSync } from "node:zlib";
import { randomUUID } from "node:crypto";

/** Un artisan qui pose un à deux chantiers par jour ouvré. */
const CHANTIERS_PAR_AN = 500;

const NOMS = ["Taille des haies", "Tonte", "Massif", "Abattage", "Débroussaillage",
  "Arrosage", "Plantation", "Entretien annuel", "Élagage", "Terrasse bois", "Clôture", "Pose de gazon"];
const CLIENTS = ["Martins", "Bernard", "Le Cloirec", "Riou", "Guérin", "Tanguy", "Le Gall",
  "Morvan", "Rioux", "Perrot", "Jaouen", "Cadiou", "Le Bris", "Kervella"];
const RUES = ["rue des Ajoncs", "chemin du Moulin", "impasse des Genêts", "allée des Chênes",
  "route de Saillé", "boulevard de la Mer", "rue du Pré Long"];
const VILLES = ["44350 Guérande", "44420 La Turballe", "44510 Le Pouliguen",
  "44117 Saint-André-des-Eaux", "44500 La Baule"];
// Trois lignes sur neuf sans note : c'est le pense-bête, il n'est pas systématique.
const NOTES = [null, null, null, "Penser à prendre le broyeur.", "Client dispo à partir de 9 h.",
  "Portail au fond à gauche, code 4512.", "Attention au chien.",
  "Évacuation des déchets comprise, remorque nécessaire.", null];

const alea = (t, i) => t[(i * 7919) % t.length];

function lignes(n) {
  return Array.from({ length: n }, (_, i) => {
    const j = new Date(Date.UTC(2024, 0, 1) + i * (365 / (n / 2)) * 86400000);
    return {
      id: randomUUID(),
      nom: `${alea(NOMS, i)} — ${alea(CLIENTS, i + 1)}`,
      clientNom: `M. ${alea(CLIENTS, i + 1)}`,
      devisEnvoyeAt: new Date(j.getTime() - 12 * 86400000).toISOString(),
      datePlanifiee: j.toISOString().slice(0, 10),
      creneauDebut: i % 2 ? "matin" : "apres_midi",
      dureeDemiJournees: 1 + (i % 4),
      termineAt: new Date(j.getTime() + 61200000).toISOString(),
      factureEnvoyeeAt: new Date(j.getTime() + 3 * 86400000).toISOString(),
      dureePrevue: ["une demi-journée", "1 jour", "2 jours", "3 jours"][i % 4],
      adresseChantier: `${1 + (i % 90)} ${alea(RUES, i + 2)}, ${alea(VILLES, i + 4)}`,
      clientTelephone: `06${String(10000000 + ((i * 731) % 89999999)).slice(0, 8)}`,
      note: alea(NOTES, i + 3),
      envoiEnvoyeAt: new Date(j.getTime() - 12 * 86400000).toISOString(),
      envoiExpireAt: new Date(j.getTime() + 18 * 86400000).toISOString(),
      envoiReponse: "acceptee",
      equipes: { matin: i % 3 ? [1, 2] : [1], apres_midi: i % 2 ? [2] : [] },
    };
  });
}

const ko = (o) => (o / 1024).toFixed(0).padStart(5);

console.log("\nCe qu'une ouverture du planning fait descendre dans son téléphone.\n");
console.log("  chantiers │ ≈ années │    brut │    gzip │  brotli");
console.log("  ──────────┼──────────┼─────────┼─────────┼─────────");
for (const n of [250, 500, 1000, 1500, 2500, 5000]) {
  const t = JSON.stringify(lignes(n));
  console.log(
    `  ${String(n).padStart(9)} │ ${(n / CHANTIERS_PAR_AN).toFixed(1).padStart(8)} │ ${ko(
      Buffer.byteLength(t, "utf8"),
    )} Ko │ ${ko(gzipSync(t).length)} Ko │ ${ko(brotliCompressSync(t).length)} Ko`,
  );
}
console.log(`\n  (${CHANTIERS_PAR_AN} chantiers par an ; une photo de chantier pèse 2 à 3 Mo.)\n`);
