import assert from "node:assert/strict";
import { lireReponseCroquis } from "../src/server/ai/services/lire-croquis";

// La lecture d'un croquis de jardin — la partie qui s'éprouve SANS clé.
//
// **Ce que cette suite tient.** L'appel au fournisseur ne peut pas être joué
// ici (aucune clé dans cet environnement, `AGENTS.md`). Ce qui s'éprouve, et
// qui est l'endroit où les défauts vivent vraiment, c'est la relecture de ce
// que le modèle a répondu : il entoure son objet de prose, il rend des chaînes
// pour des nombres, il confond les mètres et les centimètres, et **il invente
// pour faire plaisir**.
//
// **LE CONTRÔLE QUI COMPTE EST CELUI DES UNITÉS.** Un « 1200 » relevé à côté
// d'une haie et pris pour 1200 mètres fait commander cent fois trop de tuyau.
// C'est le genre d'erreur qu'on découvre à la livraison.

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};

// **Un croquis COMPLET porte aussi les places et la nourrice** — ajouté le
// 22 août 2026, sa demande : *« oui fais-le lire les proportions »*. Les places
// sont en fraction du dessin (0 à 1) ; les mètres s'en déduisent avec les cotes
// (`geometrie-croquis.ts`).
//
// **Ce jeu d'essai a rougi le jour où la nourrice est devenue obligatoire**, et
// c'était juste : un croquis sans nourrice n'est pas « lisible » au sens du
// `CLAUDE.md` §4 bis — sans elle, aucun plan ne se pose. On complète donc le
// croquis d'essai plutôt que d'assouplir la règle (`CLAUDE.md` §5 bis).
const JUSTE = JSON.stringify({
  zones: [
    {
      type: "gazon", nom: "Pelouse devant", longueur_m: 16, largeur_m: 6, metres_lineaires: null,
      x: 0.35, y: 0.4, largeur_fraction: 0.4, hauteur_fraction: 0.15,
    },
    {
      type: "haie", nom: "Haie de laurier", longueur_m: null, largeur_m: null, metres_lineaires: 22,
      x: 0.8, y: 0.5, largeur_fraction: 0.05, hauteur_fraction: 0.55,
    },
  ],
  point_d_eau: "compteur",
  nourrice: { x: 0.1, y: 0.9 },
});

console.log("=== Lire un croquis de jardin ===\n");

// ── 1. Le cas nominal ───────────────────────────────────────────────────────
const r = lireReponseCroquis(JUSTE);
dire(r.ok, "une réponse bien formée est acceptée");
if (r.ok) {
  dire(r.croquis.zones.length === 2, `${r.croquis.zones.length} zones lues`);
  dire(r.croquis.zones[0].L === 16 && r.croquis.zones[0].l === 6, "la pelouse porte ses deux cotes");
  dire(r.croquis.zones[1].ml === 22, "la haie porte ses mètres linéaires");
  dire(r.croquis.pointDEau === "compteur", "le point d'eau est lu");
  dire(
    r.croquis.reserves.length === 0,
    `aucune réserve sur un croquis lisible (${r.croquis.reserves.length}${r.croquis.reserves.length ? " : " + r.croquis.reserves.join(" · ") : ""})`,
  );
  // ── Les places, et la nourrice ────────────────────────────────────────────
  dire(
    r.croquis.zones[0].x === 0.35 && r.croquis.zones[0].largeurFraction === 0.4,
    "la place de la pelouse est lue en fraction du dessin",
  );
  dire(
    r.croquis.nourrice !== null && r.croquis.nourrice.x === 0.1 && r.croquis.nourrice.y === 0.9,
    "la nourrice est lue là où elle est dessinée",
  );
}

// ── 1 bis. LA NOURRICE ABSENTE SE DIT, ET NE SE DEVINE PAS ──────────────────
//
// `CLAUDE.md` §4 bis : elle se lit sur le croquis, jamais ne se déduit. La
// poser au point d'eau « pour dépanner » ferait creuser au mauvais endroit, et
// une tranchée ne se déplace pas.
{
  const sansNourrice = lireReponseCroquis(
    JSON.stringify({
      zones: [{ type: "gazon", nom: "P", longueur_m: 16, largeur_m: 6 }],
      point_d_eau: "compteur",
    })
  );
  dire(
    sansNourrice.ok && sansNourrice.croquis.nourrice === null,
    "sans nourrice dessinée, elle reste nulle — jamais posée au point d'eau",
  );
  dire(
    sansNourrice.ok && sansNourrice.croquis.reserves.some((x) => /nourrice/.test(x)),
    "et l'absence est dite au patron",
  );
}

// ── 1 ter. UNE PLACE HORS DE [0, 1] N'EN EST PAS UNE ────────────────────────
//
// Un modèle qui rend « 12 » pour un x n'a pas donné une fraction : il a donné
// des mètres, ou un pixel. La rogner à 1 fabriquerait une position plausible et
// fausse — et c'est une distance de tuyau qui en sortirait.
{
  const horsBornes = lireReponseCroquis(
    JSON.stringify({
      zones: [{ type: "gazon", nom: "P", longueur_m: 16, largeur_m: 6, x: 12, y: 0.5 }],
      point_d_eau: "compteur",
      nourrice: { x: 0.1, y: 0.9 },
    })
  );
  dire(
    horsBornes.ok && horsBornes.croquis.zones[0].x === null,
    "un x de 12 est refusé, pas ramené à 1",
  );
}

// ── 2. Le modèle entoure son objet ──────────────────────────────────────────
const entoure = lireReponseCroquis("Voici ce que je lis :\n```json\n" + JUSTE + "\n```\nBonne journée !");
dire(entoure.ok, "un objet noyé dans de la prose est retrouvé");

// ── 3. Il rend des chaînes pour des nombres ─────────────────────────────────
const chaines = lireReponseCroquis(
  JSON.stringify({ zones: [{ type: "gazon", nom: "P", longueur_m: "16,5 m", largeur_m: "6 m" }], point_d_eau: "compteur" })
);
dire(
  chaines.ok && chaines.croquis.zones[0].L === 16.5 && chaines.croquis.zones[0].l === 6,
  "« 16,5 m » devient 16.5 plutôt que d'être jeté",
);

// ── 4. LES UNITÉS — le contrôle qui compte ──────────────────────────────────
const centimetres = lireReponseCroquis(
  JSON.stringify({ zones: [{ type: "haie", nom: "Haie", metres_lineaires: 1200 }], point_d_eau: null })
);
dire(
  centimetres.ok && centimetres.croquis.zones[0].ml === null,
  "1200 « mètres » de haie est refusé — c'étaient des centimètres",
);
dire(
  centimetres.ok && centimetres.croquis.reserves.some((x) => /invraisemblable/.test(x)),
  "et la réserve le dit, au lieu de laisser un trou silencieux",
);
const grandeMaisPlausible = lireReponseCroquis(
  JSON.stringify({ zones: [{ type: "haie", nom: "Haie", metres_lineaires: 180 }], point_d_eau: null })
);
dire(
  grandeMaisPlausible.ok && grandeMaisPlausible.croquis.zones[0].ml === 180,
  "180 m de haie passe : c'est grand, mais ça existe",
);

// ── 5. Il invente, ou il se trompe de signe ─────────────────────────────────
const negatif = lireReponseCroquis(
  JSON.stringify({ zones: [{ type: "gazon", nom: "P", longueur_m: -12, largeur_m: 6 }], point_d_eau: null })
);
dire(
  negatif.ok && negatif.croquis.zones[0].L === null,
  "une longueur négative est refusée",
);

// ── 6. Une zone sans cote RESTE, et le dit ──────────────────────────────────
//
// La faire disparaître ferait croire que le croquis ne la montrait pas — et le
// patron ne saurait pas qu'il lui manque une zone.
const sansCote = lireReponseCroquis(
  JSON.stringify({
    zones: [
      { type: "gazon", nom: "Pelouse devant", longueur_m: 16, largeur_m: 6 },
      { type: "massif", nom: "Massif du fond", metres_lineaires: null },
    ],
    point_d_eau: "compteur",
  })
);
dire(sansCote.ok && sansCote.croquis.zones.length === 2, "une zone sans cote reste dans la liste");
dire(
  sansCote.ok && sansCote.croquis.zones[1].ml === null,
  "elle reste VIDE plutôt que de recevoir une mesure par défaut",
);
dire(
  sansCote.ok && sansCote.croquis.reserves.some((x) => /Massif du fond/.test(x)),
  "et la réserve la nomme, pour qu'il sache laquelle compléter",
);

// ── 7. Un type inconnu ne se traduit pas au jugé ────────────────────────────
const inconnu = lireReponseCroquis(
  JSON.stringify({
    zones: [
      { type: "verger", nom: "Verger", longueur_m: 20, largeur_m: 10 },
      { type: "gazon", nom: "P", longueur_m: 16, largeur_m: 6 },
    ],
    point_d_eau: "compteur",
  })
);
dire(
  inconnu.ok && inconnu.croquis.zones.length === 1,
  "une zone d'un type inconnu est écartée, pas rangée dans le plus proche",
);
dire(
  inconnu.ok && inconnu.croquis.reserves.some((x) => /verger/.test(x)),
  "et la réserve le nomme — poser des turbines sur des fruitiers se voit trop tard",
);

// ── 8. Ce qui doit être refusé net ──────────────────────────────────────────
dire(!lireReponseCroquis("Je ne vois pas de croquis sur cette photo.").ok, "une réponse sans objet est refusée");
dire(!lireReponseCroquis("{ zones: [").ok, "un objet mal formé est refusé");
dire(!lireReponseCroquis(JSON.stringify({ zones: [], point_d_eau: null })).ok, "un croquis sans aucune zone est refusé");
dire(
  !lireReponseCroquis(JSON.stringify({ zones: [{ type: "piscine" }], point_d_eau: null })).ok,
  "un croquis dont AUCUNE zone n'est reconnue est refusé, pas rendu vide",
);

// ── 9. Le point d'eau absent se signale ─────────────────────────────────────
const sansEau = lireReponseCroquis(
  JSON.stringify({ zones: [{ type: "gazon", nom: "P", longueur_m: 16, largeur_m: 6 }], point_d_eau: null })
);
dire(
  sansEau.ok && sansEau.croquis.reserves.some((x) => /d’où vient l’eau/.test(x)),
  "le point d'eau non lu est signalé — c'est ce qui décide de tout le reste",
);

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
