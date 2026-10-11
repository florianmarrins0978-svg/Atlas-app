import assert from "node:assert/strict";
import {
  rangerDuPlusRecent,
  dernierePrestation,
  derniereTraceDuClient,
  jourCourt,
  jourDeLaLigne,
  nomDuFichierDeLaPiece,
  type PieceDuClient,
} from "../src/lib/documents-du-client";

// Le rangement des pièces d'un client — sa demande du 20 août 2026, dite deux
// fois : « trié par date, de la plus récente à la moins récente », puis « dans
// le même ordre » pour les factures.
//
// **Pourquoi cette suite existe séparément de l'écran.** Un tri se vérifie sur
// des cas qu'aucun jeu de démonstration ne produit : deux pièces le même jour,
// une pièce sans date, une liste vide, un ordre déjà inverse. Les fabriquer en
// base coûterait cher et n'éprouverait pas mieux.

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};

const p = (id: string, jour: string | null) => ({ id, jour });
const ids = (l: { id: string }[]) => l.map((x) => x.id).join(",");

console.log("=== Les pièces d'un client, rangées ===\n");

dire(ids(rangerDuPlusRecent([])) === "", "une liste vide reste vide");

dire(
  ids(rangerDuPlusRecent([p("a", "2025-09-21"), p("b", "2026-07-28"), p("c", "2026-05-14")])) ===
    "b,c,a",
  "du plus récent au plus ancien",
);

dire(
  ids(rangerDuPlusRecent([p("b", "2026-07-28"), p("c", "2026-05-14"), p("a", "2025-09-21")])) ===
    "b,c,a",
  "une liste déjà rangée ne bouge pas",
);

// **Le tri est stable à date égale.** Sans cela, deux devis du même jour
// s'interchangeraient d'un rafraîchissement à l'autre, et l'écran paraîtrait
// bouger tout seul.
dire(
  ids(rangerDuPlusRecent([p("x", "2026-07-28"), p("y", "2026-07-28"), p("z", "2026-07-28")])) ===
    "x,y,z",
  "à date égale, l'ordre d'arrivée est gardé",
);

// **Une pièce sans date passe en DERNIER.** La mettre en tête la ferait passer
// pour la plus récente — c'est le contraire de ce qu'on sait d'elle.
dire(
  ids(rangerDuPlusRecent([p("sans", null), p("vieux", "2024-01-01"), p("neuf", "2026-08-12")])) ===
    "neuf,vieux,sans",
  "une pièce sans date passe en dernier, jamais en premier",
);
dire(
  ids(rangerDuPlusRecent([p("s1", null), p("s2", null)])) === "s1,s2",
  "deux pièces sans date gardent leur ordre",
);

// **L'ordre alphabétique des dates ISO EST leur ordre chronologique**, y compris
// au passage d'année et au changement de mois à un chiffre.
dire(
  ids(
    rangerDuPlusRecent([
      p("janv", "2026-01-02"),
      p("dec", "2025-12-31"),
      p("sept", "2026-09-01"),
      p("oct", "2026-10-01"),
    ])
  ) === "oct,sept,janv,dec",
  "les mois à un et deux chiffres se rangent juste, et l'année tourne",
);

// La fonction ne modifie pas ce qu'on lui donne : l'appelant garde sa liste.
const origine = [p("a", "2024-01-01"), p("b", "2026-01-01")];
rangerDuPlusRecent(origine);
dire(ids(origine) === "a,b", "la liste d'origine n'est pas retournée sur place");

console.log("\n=== La dernière prestation ===\n");

const CHANTIERS = [
  { id: "c1", nom: "Taille de haie", jour: "2025-10-02" },
  { id: "c2", nom: "Élagage de trois chênes", jour: "2026-08-12" },
  { id: "c3", nom: "Tonte", jour: "2026-03-04" },
];
const PRESTATIONS = new Map([
  ["c2", ["Démontage en tête de chat", "  ", "Broyage sur place", ""]],
  ["c1", ["Taille au carré"]],
]);

const derniere = dernierePrestation(CHANTIERS, PRESTATIONS);
dire(derniere?.nom === "Élagage de trois chênes", `c'est le chantier le plus récent (lu : ${derniere?.nom})`);
dire(derniere?.jour === "2026-08-12", "avec son jour");
dire(
  derniere?.comprend.join(" | ") === "Démontage en tête de chat | Broyage sur place",
  `les libellés vides ne font pas de puce sans texte (lus : ${derniere?.comprend.length})`,
);

dire(dernierePrestation([], PRESTATIONS) === null, "aucun chantier : rien à afficher, et non un titre vide");
dire(
  dernierePrestation([{ id: "seul", nom: "Devis sans suite", jour: null }], PRESTATIONS)?.nom ===
    "Devis sans suite",
  "un chantier sans date reste la dernière prestation s'il est le seul",
);
dire(
  dernierePrestation(CHANTIERS, new Map())?.comprend.length === 0,
  "un chantier sans prestation notée rend une liste vide, pas une erreur",
);

// **Le futur n'est pas le passé.** Un chantier posé pour le mois prochain n'est
// pas la dernière prestation — c'est la prochaine. La fonction range sur la
// date, donc elle le placera en tête : c'est à l'appelant de ne lui donner que
// des chantiers faits. Le contrôle fige ce contrat, pour qu'il ne se perde pas.
const avecFutur = dernierePrestation(
  [...CHANTIERS, { id: "c4", nom: "Abattage prévu", jour: "2027-01-01" }],
  PRESTATIONS
);
dire(
  avecFutur?.nom === "Abattage prévu",
  "la fonction range sur la date, sans juger du futur — l'appelant filtre",
);

console.log("\n=== Une date, une seule façon de l'écrire ===\n");

// **Vu à la capture, pas au test.** L'écran portait « 12/08/2026 » au-dessus de
// la dernière prestation et « 12 août 2026 » dans les colonnes, à trois
// centimètres l'un de l'autre.
dire(jourCourt("2026-08-12") === "12 août 2026", `12 août (lu : ${jourCourt("2026-08-12")})`);
dire(jourCourt("2025-10-02") === "2 oct. 2025", `le quantième perd son zéro (lu : ${jourCourt("2025-10-02")})`);
dire(jourCourt("2026-01-31") === "31 janv. 2026", `janvier (lu : ${jourCourt("2026-01-31")})`);
dire(jourCourt("2026-12-01") === "1 déc. 2026", `décembre (lu : ${jourCourt("2026-12-01")})`);
// **Les douze mois, sans trou.** Un tableau mal indexé rendrait « undefined »
// sur l'écran d'un client — et seul le mois fautif le montrerait.
const tous = Array.from({ length: 12 }, (_, i) =>
  jourCourt(`2026-${String(i + 1).padStart(2, "0")}-15`)
);
dire(
  tous.every((t) => /^15 [^u]/.test(t) && !t.includes("undefined")),
  `les douze mois se nomment : ${tous.join(" · ")}`,
);
// Une date illisible se rend telle quelle plutôt que « undefined ».
dire(jourCourt("pas-une-date") === "pas-une-date", "une date illisible ne devient pas « undefined »");
dire(jourCourt("2026-13-01") === "2026-13-01", "un mois qui n'existe pas ne devient pas « undefined »");

// ─── Le nom sous lequel la pièce arrive dans son téléphone ─────────────────
//
// **Sa demande du 21 août 2026 :** *« je veux pouvoir l'enregistrer »*
// (planche 83, proposition C). Un fichier enregistré sans nom prend celui de la
// page — c'est le défaut du 7 août sur la facture, et il se retrouverait avec
// dix documents indistinguables dans son dossier.
const piece = (h: Partial<PieceDuClient>): PieceDuClient => ({
  id: "x", titre: "n° 2026-0029", jour: "2026-08-12", precision: null,
  href: "/api/devis/abc/pdf", ...h,
});

dire(
  nomDuFichierDeLaPiece(piece({})) === "devis-2026-0029.pdf",
  `un devis porte son numéro (lu : ${nomDuFichierDeLaPiece(piece({}))})`,
);
dire(
  nomDuFichierDeLaPiece(piece({ href: "/api/factures/abc/pdf", titre: "n° 2026-0031" })) ===
    "facture-2026-0031.pdf",
  "une facture s'appelle facture, et non devis",
);
// **La nature vient de l'ADRESSE, pas du titre.** Un libellé peut changer à la
// prochaine demande ; ce que le serveur sert, non.
dire(
  nomDuFichierDeLaPiece(piece({ href: "/api/factures/abc/pdf", titre: "n° 2026-0031" }))
    .startsWith("facture-"),
  "le genre se lit dans l'adresse",
);
// Une fiche de chantier n'a pas de numéro : elle porte son jour, au format de
// tri — dix fichiers se rangent alors d'eux-mêmes dans l'ordre du temps.
dire(
  nomDuFichierDeLaPiece(
    piece({ href: "/api/chantiers/abc/fiche/pdf", titre: "12 août 2026", jour: "2026-08-12" })
  ) === "fiche-chantier-2026-08-12.pdf",
  "une fiche de chantier porte son jour, au format qui se range",
);
// Ni numéro ni jour : on ne fabrique pas un nom qui ferait croire à une date.
dire(
  nomDuFichierDeLaPiece(piece({ href: "/api/chantiers/abc/fiche/pdf", titre: "Sans date", jour: null })) ===
    "fiche-chantier.pdf",
  "sans date, aucune date n'est inventée",
);
// Le « n° » et son espace ne traversent JAMAIS jusqu'au nom du fichier : un tel
// nom se recopie mal et se cherche encore plus mal.
for (const t of ["n° 2026-0029", "N° 2026-0029", "no 2026-0029", "2026-0029"]) {
  dire(
    nomDuFichierDeLaPiece(piece({ titre: t })) === "devis-2026-0029.pdf",
    `« ${t} » donne devis-2026-0029.pdf (lu : ${nomDuFichierDeLaPiece(piece({ titre: t }))})`,
  );
}
// Et le nom finit toujours par .pdf, sans quoi le téléphone ne sait pas l'ouvrir.
dire(
  [piece({}), piece({ jour: null, titre: "?" })].every((p) =>
    nomDuFichierDeLaPiece(p).endsWith(".pdf")
  ),
  "un nom de fichier porte toujours son extension",
);

// ─── LA DERNIÈRE CHOSE QUI S'EST PRODUITE CHEZ UN CLIENT ────────────────────
//
// **Sa demande du 9 septembre 2026 :** *« Remplace par la dernière chose qui
// s'est produit »*, en remplacement du compte de chantiers de la liste, qui
// annonçait du travail là où la fiche n'avait rien à montrer.

// Le plus récent gagne, quel que soit son genre.
dire(
  derniereTraceDuClient({ devis: "2026-09-07", facture: "2026-08-02", fiche: null })?.quoi === "Devis",
  "le document le plus récent est celui qu'on annonce",
);
dire(
  derniereTraceDuClient({ devis: "2026-06-01", facture: "2026-09-02", fiche: null })?.jour === "2026-09-02",
  "le jour annoncé est celui du document retenu",
);
dire(
  derniereTraceDuClient({ devis: null, facture: null, fiche: "2026-05-12" })?.quoi === "Fiche",
  "une fiche d'entretien compte autant que le reste — elle est sur la fiche du client",
);

// **RIEN ne s'invente quand rien n'est parti** (`CLAUDE.md` §4). La ligne se
// tait ; elle n'annonce pas un « aucun document » que personne n'a demandé.
dire(
  derniereTraceDuClient({ devis: null, facture: null, fiche: null }) === null,
  "un client sans aucun document ne fait dire à la ligne que ce qu'elle sait",
);

// **À égalité de jour, le point le plus AVANCÉ du parcours.** Un devis envoyé
// puis facturé le même jour — c'est le cas d'un chantier fait dans la journée —
// est un chantier facturé. L'ordre d'arrivée en base ne promet rien.
dire(
  derniereTraceDuClient({ devis: "2026-09-09", facture: "2026-09-09", fiche: "2026-09-09" })?.quoi ===
    "Facture",
  "à jour égal, la facture passe devant le devis, qui passe devant la fiche",
);
dire(
  derniereTraceDuClient({ devis: "2026-09-09", facture: null, fiche: "2026-09-09" })?.quoi === "Devis",
  "à jour égal, le devis passe devant la fiche",
);

// **Une date PLUS ANCIENNE ne remonte pas parce qu'elle est plus avancée** :
// c'est la chronologie qui commande, le parcours ne fait que départager.
dire(
  derniereTraceDuClient({ devis: "2026-09-09", facture: "2026-01-02", fiche: null })?.quoi === "Devis",
  "une vieille facture ne recouvre pas un devis d'hier",
);


// ─── LA DATE D'UNE LIGNE DE LISTE ───────────────────────────────────────────
//
// **Mesurée sur son téléphone, pas choisie** : la deuxième ligne d'un client
// dispose de 316 px, et l'année de trop y coupait l'adresse — celle qui sépare
// quatre clients du même nom.
dire(
  jourDeLaLigne("2026-09-05", "2026-09-09") === "5 sept.",
  "l'année qui court ne s'écrit pas : elle prend la place de l'adresse",
);
dire(
  jourDeLaLigne("2025-06-12", "2026-09-09") === "12 juin 2025",
  "une autre année s'écrit — c'est le client qu'on n'a pas revu",
);
// Une date illisible se rend telle quelle plutôt que d'être amputée au hasard.
dire(
  jourDeLaLigne("pas-une-date", "2026-09-09") === "pas-une-date",
  "ce qui n'est pas une date ne se rogne pas",
);

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
