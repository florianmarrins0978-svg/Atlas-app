import assert from "node:assert/strict";
import {
  apresLesCoordonnees,
  coordonneesDepuisLeDevis,
  libelleRetourDuDevis,
  provenanceDesCoordonnees,
  retourDesCoordonnees,
  retourDuDevis,
} from "../src/lib/retour-du-devis";

// **« J'ai oublié de renseigner la fiche client du chantier. Lorsque je fais
// retour, je dois arriver sur la page de la fiche client ! Pas sur la page que
// je te mets en deuxième photo. »** — le patron, 31 août 2026.
//
// Cette suite tient les deux moitiés du chemin : l'aller (un devis sans client
// mène à la fiche) et le retour (la fiche ramène au devis). Elle sait échouer :
// rendre `/chantiers/${id}` sans regarder `clientId` rougit le premier cas, et
// oublier la provenance dans `apresLesCoordonnees` rougit le cinquième.
//
// **Ce qu'elle NE fixe pas, délibérément :** aucun libellé d'écran. Une
// assertion sur un mot affiché défendrait la formulation du jour plutôt que la
// règle (`CLAUDE.md` §5 bis). Ce sont des ADRESSES qui sont éprouvées ici.
//
// **À ne pas confondre avec `test-retour-fiche-client.ts`** : celle-là tient la
// flèche de `/clients/[id]`, le dossier du client. Ici c'est le formulaire
// qu'on remplit, `/chantiers/[id]/coordonnees` — deux écrans, deux règles.

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

const CHANTIER = "11111111-2222-3333-4444-555555555555";
const AUTRE = "99999999-8888-7777-6666-555555555555";
const SON_DEVIS = `/chantiers/${CHANTIER}/devis-complet`;

console.log("=== Le retour du devis quand la fiche client manque ===\n");

cas("SON CAS : aucun client rattaché — le retour mène à la fiche client", () => {
  assert.equal(
    retourDuDevis({ chantierId: CHANTIER, clientId: null }),
    `/chantiers/${CHANTIER}/coordonnees?de=${encodeURIComponent(SON_DEVIS)}`,
    "il retomberait sur la fiche du chantier, qui ne dit ni ce qui manque ni où le réparer"
  );
});

cas("un devis dont le client est renseigné garde sa sortie d'avant", () => {
  // Le renvoyer sur un formulaire déjà rempli lui poserait une question qu'il
  // n'a pas — et il n'a signalé QUE le cas où la fiche manque.
  assert.equal(
    retourDuDevis({ chantierId: CHANTIER, clientId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }),
    `/chantiers/${CHANTIER}`
  );
});

cas("la flèche n'annonce pas la même chose selon où elle mène", () => {
  assert.notEqual(libelleRetourDuDevis(null), libelleRetourDuDevis("un-client"));
});

cas("l'adresse de la fiche porte sa provenance, et elle se relit", () => {
  const de = new URL(coordonneesDepuisLeDevis(CHANTIER), "http://exemple.test").searchParams.get("de");
  assert.equal(provenanceDesCoordonnees(CHANTIER, de ?? undefined), SON_DEVIS);
});

cas("venu du devis, enregistrer la fiche RAMÈNE au devis", () => {
  // Sans cela, le document qu'il était en train de lire serait à retrouver
  // seul — un chemin qui s'ouvre et ne se referme pas.
  assert.equal(apresLesCoordonnees(CHANTIER, SON_DEVIS), SON_DEVIS);
  assert.equal(retourDesCoordonnees(SON_DEVIS), SON_DEVIS);
});

cas("SANS provenance, rien ne bouge — le chemin du 17 août 2026 est intact", () => {
  // « Adresse non renseignée » sur l'accueil entre par la même porte : sa
  // flèche rend la liste, et son enregistrement la fiche du chantier.
  assert.equal(retourDesCoordonnees(null), "/");
  assert.equal(apresLesCoordonnees(CHANTIER, null), `/chantiers/${CHANTIER}`);
});

cas("UNE PROVENANCE ÉTRANGÈRE NE FAIT PAS SORTIR D'ATLAS", () => {
  // La valeur vient de l'adresse, donc de n'importe qui. Elle n'est pas
  // comparée à une forme mais au seul chemin qu'elle a le droit de valoir.
  assert.equal(provenanceDesCoordonnees(CHANTIER, "https://ailleurs.example"), null);
  assert.equal(provenanceDesCoordonnees(CHANTIER, "//ailleurs.example"), null);
  assert.equal(provenanceDesCoordonnees(CHANTIER, "javascript:alert(1)"), null);
  assert.equal(provenanceDesCoordonnees(CHANTIER, undefined), null);
  assert.equal(provenanceDesCoordonnees(CHANTIER, ""), null);
});

cas("ET PAS DAVANTAGE SUR LE DEVIS D'UN AUTRE CHANTIER", () => {
  // Le devis d'un autre client n'a rien à voir avec la fiche qu'il remplit —
  // et ce serait un document qui s'ouvre sans qu'il l'ait demandé.
  assert.equal(provenanceDesCoordonnees(CHANTIER, `/chantiers/${AUTRE}/devis-complet`), null);
  // Un paramètre répété arrive en tableau : c'est le premier qui compte.
  assert.equal(provenanceDesCoordonnees(CHANTIER, [SON_DEVIS, "https://ailleurs.example"]), SON_DEVIS);
  assert.equal(provenanceDesCoordonnees(CHANTIER, ["https://ailleurs.example", SON_DEVIS]), null);
});

console.log(
  echecs === 0
    ? "\n✅ Le retour du devis — 0 échec(s).\n"
    : `\n❌ Le retour du devis — ${echecs} échec(s).\n`
);
process.exit(echecs === 0 ? 0 : 1);
