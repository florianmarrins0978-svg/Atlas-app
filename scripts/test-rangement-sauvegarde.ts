import assert from "node:assert/strict";
import { rangerLesFichiers, type FichierARanger } from "../src/lib/rangement-sauvegarde";

// Où chaque fichier se range dans la sauvegarde. Règle pure, sans base : sa
// capture du 26 septembre 2026 montrait des dossiers nommés par identifiant,
// et « un utilisateur va rien comprendre ».

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const CH = "0b2034d5-11bb-4a9c-8a9c-bfab46c53450";
const chantiers = new Map([
  [CH, { nom: "Taille de haie", client: "Mme Costa" }],
  ["sans-client", { nom: "Tonte", client: null }],
]);
const f = (o: Partial<FichierARanger>): FichierARanger => ({
  storageKey: `chantiers/${CH}/photos/abc.jpg`,
  origine: "photo",
  chantierId: CH,
  libelle: null,
  jour: "2026-09-12",
  ...o,
});

cas("client, puis chantier, puis la nature du fichier", () => {
  assert.deepEqual(
    rangerLesFichiers(
      [
        f({}),
        f({ storageKey: "d/1.pdf", origine: "devis-pdf", libelle: "D-2026-012", jour: null }),
        f({ storageKey: "f/1.pdf", origine: "facture-pdf", libelle: "F-2026-004", jour: null }),
        f({ storageKey: "n/1.webm", origine: "note-vocale" }),
      ],
      chantiers
    ),
    [
      "fichiers/Mme Costa/Taille de haie/Photos/Photo 2026-09-12.jpg",
      "fichiers/Mme Costa/Taille de haie/Devis/Devis D-2026-012.pdf",
      "fichiers/Mme Costa/Taille de haie/Factures/Facture F-2026-004.pdf",
      "fichiers/Mme Costa/Taille de haie/Notes vocales/Note vocale 2026-09-12.webm",
    ]
  );
});

cas("aucun identifiant dans les chemins", () => {
  const [chemin] = rangerLesFichiers([f({})], chantiers);
  assert.ok(!chemin.includes(CH), chemin);
});

cas("deux photos du même jour ne s'écrasent pas, casse comprise", () => {
  assert.deepEqual(
    rangerLesFichiers([f({ storageKey: "a.jpg" }), f({ storageKey: "b.JPG" }), f({ storageKey: "c.jpg" })], chantiers),
    [
      "fichiers/Mme Costa/Taille de haie/Photos/Photo 2026-09-12.jpg",
      "fichiers/Mme Costa/Taille de haie/Photos/Photo 2026-09-12 (2).jpg",
      "fichiers/Mme Costa/Taille de haie/Photos/Photo 2026-09-12 (3).jpg",
    ]
  );
});

cas("un / dans un nom ne crée pas de dossier de plus", () => {
  const [chemin] = rangerLesFichiers([f({})], new Map([[CH, { nom: "Haie: côté rue", client: "Dupont / Martin" }]]));
  assert.equal(chemin, "fichiers/Dupont Martin/Haie côté rue/Photos/Photo 2026-09-12.jpg");
});

cas("sans client, sans chantier, logo et tickets ont leur dossier", () => {
  assert.deepEqual(
    rangerLesFichiers(
      [
        f({ chantierId: "sans-client" }),
        f({ chantierId: null, storageKey: "diag/x.jpg", libelle: "diagnostic" }),
        f({ chantierId: null, storageKey: "logos/l.png", origine: "logo", jour: null }),
        f({ chantierId: null, storageKey: "t/1.jpg", origine: "ticket-tva", libelle: "Total Access" }),
      ],
      chantiers
    ),
    [
      "fichiers/Sans client/Tonte/Photos/Photo 2026-09-12.jpg",
      "fichiers/Sans chantier/Photos/Photo diagnostic 2026-09-12.jpg",
      "fichiers/Entreprise/Logo.png",
      "fichiers/Tickets de caisse/Ticket Total Access 2026-09-12.jpg",
    ]
  );
});

if (echecs > 0) {
  console.error(`\n❌ ${echecs} cas en échec`);
  process.exit(1);
}
console.log("\n✅ Rangement de la sauvegarde");
