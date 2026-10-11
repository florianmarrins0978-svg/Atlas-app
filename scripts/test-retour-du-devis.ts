import assert from "node:assert/strict";
import { lienVersLeChantierAuPlanning } from "../src/lib/lien-planning";
import { LIBELLE_RETOUR_PLANNING } from "../src/lib/retour-au-planning";
import {
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
// Cette suite tient l'aller du chemin : le retour du devis mène à la fiche
// client, avec ou sans client. Elle sait échouer : rendre `/chantiers/${id}`
// rougit les deux premiers cas.
//
// **Le retour (la fiche ramène au devis) ne se calcule plus — 17 septembre
// 2026.** « Enregistrer » a été retiré de la fiche rouverte à sa demande ; le
// bouton « Je rédige à la main » enregistre et mène au devis, d'où qu'on
// vienne. Il n'y a donc plus de provenance à relire à l'enregistrement, et
// `test-devis-sans-client-e2e.ts` éprouve ce chemin dans un vrai navigateur.
//
// **Et depuis le 8 septembre 2026, la moitié qui manquait** : venu du planning,
// le devis y ramène (quatre cas en fin de fichier). Sa règle du 31 août n'est
// pas défaite pour autant — c'est la SEULE porte qui sait dire d'où elle vient,
// et l'un des cas le fixe.
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
const SON_PLANNING = lienVersLeChantierAuPlanning(CHANTIER);

console.log("=== Le retour du devis : la fiche client, ou le planning d'où il vient ===\n");

const VERS_LA_FICHE = `/chantiers/${CHANTIER}/coordonnees?de=${encodeURIComponent(SON_DEVIS)}`;

cas("SON CAS DU MATIN : aucun client rattaché — le retour mène à la fiche client", () => {
  assert.equal(
    retourDuDevis({ chantierId: CHANTIER, clientId: null }).href,
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
  const sansProvenance = retourDuDevis({ chantierId: CHANTIER, clientId: "un-client" }).href;
  assert.notEqual(sansProvenance, `/chantiers/${CHANTIER}`);
  assert.ok(sansProvenance.startsWith(`/chantiers/${CHANTIER}/coordonnees`));
});

cas("la flèche n'annonce pas la même chose selon la raison d'y aller", () => {
  // Même écran, deux raisons : remplir ce qui manque, ou relire avant d'envoyer.
  // « Remplir » devant un formulaire complet ferait chercher un champ vide.
  assert.notEqual(libelleRetourDuDevis(null), libelleRetourDuDevis("un-client"));
  assert.equal(
    retourDuDevis({ chantierId: CHANTIER, clientId: null }).libelle,
    libelleRetourDuDevis(null)
  );
});

cas("l'adresse de la fiche porte sa provenance, et elle se relit", () => {
  const de = new URL(coordonneesDepuisLeDevis(CHANTIER), "http://exemple.test").searchParams.get("de");
  assert.equal(provenanceDesCoordonnees(CHANTIER, de ?? undefined), SON_DEVIS);
});

// **CE CAS A CHANGÉ DE SENS LE 7 SEPTEMBRE 2026, et c'est lui qui l'a
// provoqué :** *« j'appuie une fois sur le retour du devis, j'arrive sur la
// fiche client, et si je refais retour arrière je retourne sur le devis et non
// sur la page chantier. Il faut rectifier ça !! »*
//
// La ligne qui vivait ici exigeait l'inverse — `retourDesCoordonnees(CHANTIER, devis)
// === devis` —, et elle aurait donc empêché la correction. Deux de ses
// règles du 31 août, justes séparément, se pointaient l'une l'autre.
cas("la FLÈCHE, elle, sort toujours : plus aucune boucle", () => {
  assert.equal(retourDesCoordonnees(CHANTIER, SON_DEVIS), "/");
  assert.equal(retourDesCoordonnees(CHANTIER, null), "/");
});

// **Le contrôle qui tient la règle, et pas seulement une valeur.** Le défaut
// n'était pas une mauvaise adresse : c'était un cycle. On le dit comme tel —
// si demain une troisième porte renvoyait vers le devis, ce cas rougirait.
cas("aller au devis puis revenir ne peut plus tourner en rond", () => {
  const versLaFiche = retourDuDevis({ chantierId: CHANTIER, clientId: null }).href;
  const de = new URL(versLaFiche, "http://exemple.test").searchParams.get("de");
  const provenance = provenanceDesCoordonnees(CHANTIER, de ?? undefined);
  assert.notEqual(
    retourDesCoordonnees(CHANTIER, provenance),
    SON_DEVIS,
    "la flèche de la fiche renvoie au devis dont la flèche mène ici : il n'y a plus de sortie"
  );
});

cas("SANS provenance, la flèche sort vers la liste", () => {
  // « Adresse non renseignée » sur l'accueil entre par cette porte, depuis le
  // 17 août 2026 : il vient de la liste, la flèche l'y ramène.
  //
  // **Elle ne rend JAMAIS la fiche du chantier**, retirée le 4 septembre
  // (`ARCHITECTURE.md` §254) : son adresse ne rend qu'une redirection —
  // laquelle, sur un chantier sans dictée, ramène ICI, sur le formulaire qu'il
  // vient de quitter. Le chemin tournerait en rond.
  assert.equal(retourDesCoordonnees(CHANTIER, null), "/");
  assert.notEqual(retourDesCoordonnees(CHANTIER, null), `/chantiers/${CHANTIER}`);
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


// ─── SA DEMANDE DU 8 SEPTEMBRE 2026 ────────────────────────────────────────
//
// Capture à l'appui : partir du planning sur un devis PAS ENCORE ENVOYÉ, puis
// reculer, le déposait sur la fiche client — d'où il lui fallait un second
// retour pour retrouver sa journée. *« Oui fais la 1 »* : le devis en rédaction
// se souvient d'où l'on vient, comme le devis parti depuis le 7 septembre.
//
// **Ces cas savent échouer** : rendre la fiche client sans regarder `de` rougit
// le premier, et annoncer la fiche client en menant au planning rougit le
// second — c'est exactement la faute que la fiche client a payée le
// 7 septembre.
cas("VENU DU PLANNING, la flèche du devis y ramène", () => {
  assert.equal(
    retourDuDevis({ chantierId: CHANTIER, clientId: "un-client", de: SON_PLANNING }).href,
    SON_PLANNING,
    "il lui faut deux retours pour retrouver sa journée"
  );
});

cas("et elle ANNONCE le planning, pas la fiche client", () => {
  // Une flèche qui nomme une destination et en prend une autre est pire qu'une
  // flèche muette : c'est ce que `libelleRetourDesCoordonnees` a corrigé.
  assert.equal(
    retourDuDevis({ chantierId: CHANTIER, clientId: "un-client", de: SON_PLANNING }).libelle,
    LIBELLE_RETOUR_PLANNING
  );
});

cas("VENU D'AILLEURS, sa règle du 31 août ne bouge pas d'un pouce", () => {
  // C'est la moitié qui compte : la porte du planning est la SEULE qui sait
  // dire d'où elle vient. Depuis la liste, une notification ou un signet, la
  // fiche client reste la sortie.
  for (const de of [undefined, null, "", "/", "https://ailleurs.example", "//ailleurs.example"]) {
    assert.equal(
      retourDuDevis({ chantierId: CHANTIER, clientId: null, de }).href,
      VERS_LA_FICHE,
      `« ${String(de)} » a détourné la flèche`
    );
  }
});

cas("ET PAS DAVANTAGE VERS LE PLANNING D'UN AUTRE CHANTIER", () => {
  // La valeur vient de l'adresse, donc de n'importe qui : elle se compare au
  // seul chemin qu'elle a le droit de valoir, pour CE chantier.
  assert.equal(
    retourDuDevis({
      chantierId: CHANTIER,
      clientId: null,
      de: lienVersLeChantierAuPlanning(AUTRE),
    }).href,
    VERS_LA_FICHE
  );
});

console.log(
  echecs === 0
    ? "\n✅ Le retour du devis — 0 échec(s).\n"
    : `\n❌ Le retour du devis — ${echecs} échec(s).\n`
);
process.exit(echecs === 0 ? 0 : 1);
