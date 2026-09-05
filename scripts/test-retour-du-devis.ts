import assert from "node:assert/strict";
import {
  apresLesCoordonnees,
  coordonneesDepuisLeDevis,
  libelleRetourDuDevis,
  provenanceDesCoordonnees,
  retourDesCoordonnees,
  retourDuDevis,
} from "../src/lib/retour-du-devis";

// **« Je veux tout le temps revenir à cette page et seulement celle-là ! La
// page fiche client »** — le patron, 31 août 2026 au soir, après avoir vu le
// matin même la moitié du chemin corrigée (un devis SANS client).
//
// Cette suite tient les deux moitiés du chemin : l'aller (le retour du devis
// mène à la fiche client, avec ou sans client) et le retour (la fiche ramène au
// devis). Elle sait échouer : rendre `/chantiers/${id}` dans l'un OU l'autre cas
// rougit les deux premiers, et oublier la provenance dans `apresLesCoordonnees`
// rougit le cinquième.
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

console.log("=== Le retour du devis mène à la fiche client, toujours ===\n");

const VERS_LA_FICHE = `/chantiers/${CHANTIER}/coordonnees?de=${encodeURIComponent(SON_DEVIS)}`;

cas("SON CAS DU MATIN : aucun client rattaché — le retour mène à la fiche client", () => {
  assert.equal(
    retourDuDevis({ chantierId: CHANTIER }),
    VERS_LA_FICHE,
    "il retomberait sur la fiche du chantier, qui ne dit ni ce qui manque ni où le réparer"
  );
});

cas("SON CAS DU SOIR : la fiche du chantier n'est plus JAMAIS la sortie", () => {
  // « Tout le temps cette page et seulement celle-là. » La règle du matin
  // n'envoyait à la fiche client que faute de client ; rétablir cette
  // condition — sous n'importe quel nom — remettrait la moitié de ses retours
  // sur un écran qui ne lui propose rien. C'est ce retour en arrière que ce cas
  // barre, et non l'adresse, déjà tenue au-dessus.
  assert.notEqual(retourDuDevis({ chantierId: CHANTIER }), `/chantiers/${CHANTIER}`);
  assert.ok(retourDuDevis({ chantierId: CHANTIER }).startsWith(`/chantiers/${CHANTIER}/coordonnees`));
});

cas("la flèche n'annonce pas la même chose selon la raison d'y aller", () => {
  // Même écran, deux raisons : remplir ce qui manque, ou relire avant d'envoyer.
  // « Remplir » devant un formulaire complet ferait chercher un champ vide.
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

cas("SANS provenance, la flèche et l'enregistrement disent LA MÊME CHOSE", () => {
  // « Adresse non renseignée » sur l'accueil entre par cette porte, depuis le
  // 17 août 2026 : il vient de la liste, il y retourne.
  //
  // **L'ENREGISTREMENT RENDAIT LA FICHE DU CHANTIER, ET IL NE LE PEUT PLUS.**
  // Cette fiche est retirée le 4 septembre (`ARCHITECTURE.md` §254) et son
  // adresse ne rend qu'une redirection — laquelle, sur un chantier sans dictée,
  // ramène ICI, sur le formulaire qu'il vient d'enregistrer. Le chemin tournait
  // en rond.
  //
  // Les deux gestes s'accordent donc, ce qu'ils ne faisaient pas : la flèche
  // rendait déjà la liste.
  assert.equal(retourDesCoordonnees(null), "/");
  assert.equal(apresLesCoordonnees(CHANTIER, null), "/");
});

cas("l'enregistrement ne renvoie JAMAIS sur la fiche retirée", () => {
  // Le contrôle qui empêche la boucle de renaître, dans les deux cas.
  for (const provenance of [null, SON_DEVIS]) {
    assert.notEqual(
      apresLesCoordonnees(CHANTIER, provenance),
      `/chantiers/${CHANTIER}`,
      "enregistrer la fiche client la rouvre par redirection : le chemin tourne en rond"
    );
  }
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
