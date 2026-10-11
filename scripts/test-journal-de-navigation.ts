import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PLAFOND_JOURNAL,
  cheminInterne,
  journalApresVisite,
  journalJusquACetEcran,
  journalSansCetEcran,
  lireLeJournal,
  pagePrecedente,
} from "../src/lib/journal-de-navigation";

// **« Le bouton retour doit marcher comme un vrai bouton marche arrière. »**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 9 septembre 2026, capture à l'appui : *« j'ai cliqué sur ouvrir
// le devis, une fois sur le devis je clique sur retour, j'arrive sur la page de
// la fiche client — or le bouton retour […] doit toujours renvoyer à la page
// d'où l'on vient juste avant. »*
//
// C'est le CINQUIÈME signalement de la même racine (20 août, 31 août, 7, 8 et
// 9 septembre) : chaque écran déclarait sa sortie, et chaque porte d'entrée
// neuve la démentait.
//
// **CE QUE CETTE SUITE TIENT, ET POURQUOI ELLE EST PURE.** Le journal se range
// dans le navigateur, mais la règle — ce qui s'empile, ce qui se dépile, ce
// qu'on refuse d'y lire — n'a besoin d'aucun navigateur. Les deux cas qui
// comptent le plus sont ceux qu'aucune suite navigateur ne verrait :
//
//   1. **la boucle du 7 septembre 2026** : enregistrer la fiche client ramène
//      au devis, et la flèche du devis ne doit pas renvoyer sur le formulaire
//      qu'on vient de quitter. C'est le dépilement (`journalApresVisite`) ;
//   2. **la sortie hors d'Atlas** : le journal vit dans le navigateur, et sa
//      valeur finit dans un `href`. `//ailleurs.example` y ferait une porte de
//      sortie.

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

const ACCUEIL = "/";
const DEVIS = "/chantiers/1de975a7-7f2c-43c3-98e6-63de23c61f8f/devis-complet";
const FICHE = "/chantiers/1de975a7-7f2c-43c3-98e6-63de23c61f8f/coordonnees";
const PLANNING = "/planning?chantier=1de975a7-7f2c-43c3-98e6-63de23c61f8f";

console.log("=== La flèche de retour ramène à la page d'avant ===\n");

// ─── SA PLAINTE DU 9 SEPTEMBRE, MOT POUR MOT ────────────────────────────────

cas("venu de l'accueil, le devis renvoie à l'accueil — pas à la fiche client", () => {
  const journal = journalApresVisite(journalApresVisite([], ACCUEIL), DEVIS);
  assert.deepEqual(journal, [ACCUEIL, DEVIS]);
  assert.equal(pagePrecedente(journal, DEVIS), ACCUEIL);
});

cas("venu du planning, le même devis renvoie au planning", () => {
  // Sa plainte du 8 septembre. Elle avait demandé une porte reconnue de plus ;
  // ici, elle ne demande rien — c'est la même règle qui répond.
  const journal = journalApresVisite(journalApresVisite([], PLANNING), DEVIS);
  assert.equal(pagePrecedente(journal, DEVIS), PLANNING);
});

cas("le paramètre de l'adresse SURVIT — sinon le planning s'ouvre sur le mois", () => {
  // La journée d'un chantier se lit dans `?chantier=` : ramener à `/planning`
  // tout court le déposerait sur le mois courant, à retrouver sa ligne.
  const journal = journalApresVisite([], PLANNING);
  assert.equal(journal[0], PLANNING);
  assert.match(pagePrecedente(journal, DEVIS) ?? "", /\?chantier=/);
});

// ─── LA BOUCLE DU 7 SEPTEMBRE, QUI NE DOIT PAS REVENIR ──────────────────────

cas("LA FLÈCHE LIT UN JOURNAL QUI N'A PAS ENCORE SON PAS", () => {
  // **Deux tours de batterie pour celui-là, et il ne se voit pas en lisant.**
  // La flèche se calcule pendant le rendu ; le journal se met à jour juste
  // après. Elle lit donc un journal sans le pas qu'on vient de faire — et une
  // version qui y cherchait « notre place » trouvait la visite PRÉCÉDENTE du
  // même écran, puis rendait ce qui la précédait : deux écrans trop tôt.
  //
  // C'est la trace exacte qu'a rendue la suite navigateur.
  const journalDuNavigateur = [
    "/login",
    ACCUEIL,
    "/chantiers/nouveau",
    DEVIS,
    ACCUEIL, // il repasse par l'accueil
    // … et il rouvre le devis : la flèche lit ICI, avant que ce pas ne soit noté.
  ];
  assert.equal(
    pagePrecedente(journalDuNavigateur, DEVIS),
    ACCUEIL,
    "elle remonte à la visite d'avant du même écran, et saute deux écrans"
  );
  // Et une fois le pas noté, la réponse ne change pas d'un caractère.
  assert.equal(pagePrecedente([...journalDuNavigateur, DEVIS], DEVIS), ACCUEIL);
});

cas("ROUVRIR un écran déjà vu n'est PAS reculer — le défaut du 9 septembre", () => {
  // **C'est la suite navigateur qui a attrapé celui-là, et il valait le lot.**
  // La première version dépilait dès que l'adresse d'arrivée était celle
  // d'avant-dernière : cela ressemble à un retour. Or ouvrir un devis, passer à
  // l'accueil, puis rouvrir CE MÊME devis depuis l'accueil laisse exactement la
  // même trace — et la flèche renvoyait alors deux écrans en arrière, c'est-à-
  // dire la panne qu'on venait corriger, par l'autre bout.
  let j = journalApresVisite([], "/chantiers/nouveau");
  j = journalApresVisite(j, DEVIS);
  j = journalApresVisite(j, ACCUEIL);
  j = journalApresVisite(j, DEVIS);
  assert.equal(
    pagePrecedente(j, DEVIS),
    ACCUEIL,
    "la flèche saute par-dessus l'accueil : le journal a cru qu'il reculait"
  );
});

cas("RECULER SE DÉCLARE : la flèche appuyée retire son écran du journal", () => {
  // Sans cela, deux appuis se renverraient l'un l'autre sans jamais sortir —
  // c'est la boucle du 7 septembre 2026 (`retour-du-devis.ts`).
  let j = journalApresVisite(journalApresVisite([], ACCUEIL), DEVIS);
  j = journalSansCetEcran(j, DEVIS); // la flèche est appuyée
  j = journalApresVisite(j, ACCUEIL); // et l'on arrive sur l'accueil
  assert.deepEqual(j, [ACCUEIL]);
  assert.equal(pagePrecedente(j, ACCUEIL), null, "elle repartirait vers le devis");
});

cas("reculer trois fois de suite finit par sortir, sans tourner en rond", () => {
  let j: string[] = [];
  for (const ecran of [ACCUEIL, "/clients", "/clients/abc", DEVIS]) j = journalApresVisite(j, ecran);
  const pas: string[] = [];
  let ici = DEVIS;
  for (let i = 0; i < 3; i++) {
    const avant = pagePrecedente(j, ici);
    assert.notEqual(avant, null, `plus de retour après ${pas.length} pas`);
    pas.push(avant!);
    // Le geste complet : la flèche se déclare, puis la page arrive.
    j = journalApresVisite(journalSansCetEcran(j, ici), avant!);
    ici = avant!;
  }
  assert.deepEqual(pas, ["/clients/abc", "/clients", ACCUEIL]);
});

cas("après ENREGISTREMENT, la flèche ne renvoie pas sur le formulaire validé", () => {
  // devis → fiche client → (enregistrer, qui RAMÈNE au devis). C'est l'objection
  // que `retour-au-planning.ts` opposait à `history.back()`, et elle se tient
  // par le geste : l'enregistrement DÉCLARE qu'il revient d'où il vient
  // (`FormulaireNouveauChantier.tsx`), au lieu de laisser le journal le
  // supposer — un retour et une réouverture laissent la même trace.
  let j = journalApresVisite([], ACCUEIL);
  j = journalApresVisite(j, DEVIS);
  j = journalApresVisite(j, FICHE);
  j = journalApresVisite(journalSansCetEcran(j, FICHE), DEVIS); // enregistré
  assert.deepEqual(j, [ACCUEIL, DEVIS], "le formulaire est resté dans le journal");
  assert.equal(
    pagePrecedente(j, DEVIS),
    ACCUEIL,
    "la flèche renvoie sur le formulaire qu'il vient de valider"
  );
});

// ─── RECHARGER N'EST PAS AVANCER ────────────────────────────────────────────

cas("recharger vingt fois ne demande pas vingt retours", () => {
  // Son onglet reste ouvert des heures et son banc redémarre plusieurs fois par
  // soirée (`HANDOVER.md`, piège 0) : chaque rechargement empilerait un pas.
  let j = journalApresVisite([], ACCUEIL);
  j = journalApresVisite(j, DEVIS);
  for (let i = 0; i < 20; i++) j = journalApresVisite(j, DEVIS);
  assert.deepEqual(j, [ACCUEIL, DEVIS]);
  assert.equal(pagePrecedente(j, DEVIS), ACCUEIL);
});

cas("le journal survit au rechargement — c'est ce que `history.back()` ne fait pas", () => {
  const range = JSON.stringify(journalApresVisite(journalApresVisite([], ACCUEIL), DEVIS));
  assert.equal(pagePrecedente(lireLeJournal(range), DEVIS), ACCUEIL);
});

// ─── UN ÉCRAN QU'ON FEUILLETTE RESTE UN SEUL ÉCRAN ──────────────────────────

cas("les trimestres de TVA ne se rembobinent pas un par un", () => {
  // `/termines/tva?annee=2026&t=…` se feuillette sur place. Si chaque trimestre
  // comptait pour une page, il faudrait quatre retours pour quitter l'écran.
  let j = journalApresVisite([], "/termines");
  for (const t of [1, 2, 3, 4]) j = journalApresVisite(j, `/termines/tva?annee=2026&t=${t}`);
  assert.equal(pagePrecedente(j, "/termines/tva?annee=2026&t=4"), "/termines");
});

cas("LE BOUTON DU NAVIGATEUR employé, la flèche ne repart pas en avant", () => {
  // **Le défaut le plus vicieux de ce lot, et il ne se voit pas en lisant.**
  // La flèche se calcule PENDANT le rendu, et le bouton du navigateur ne passe
  // par aucun de nos gestes : le journal porte alors des écrans POSTÉRIEURS au
  // nôtre. Une lecture qui partirait de la fin rendrait l'un d'eux — et la
  // flèche « retour » avancerait.
  let j = journalApresVisite(journalApresVisite([], ACCUEIL), "/clients");
  j = journalApresVisite(j, DEVIS);
  // Il appuie sur le bouton du navigateur et atterrit sur `/clients`. Le
  // journal porte encore le devis, POSTÉRIEUR à sa place : le geste se déclare
  // sur `popstate` (`JournalDeNavigation.tsx`), et ce qui suit s'en va.
  j = journalSansCetEcran(j, "/clients");
  assert.deepEqual(j, [ACCUEIL], "le devis est resté après sa place");
  j = journalApresVisite(j, "/clients");
  assert.equal(pagePrecedente(j, "/clients"), ACCUEIL, "elle repart vers le devis");
});

cas("la flèche ne renvoie JAMAIS sur l'écran où l'on est", () => {
  const j = journalApresVisite(journalApresVisite([], DEVIS), FICHE);
  assert.notEqual(pagePrecedente(j, FICHE), FICHE);
  assert.equal(pagePrecedente(j, FICHE), DEVIS);
});

// ─── SANS JOURNAL, L'ÉCRAN GARDE SA SORTIE DÉCLARÉE ─────────────────────────

cas("premier écran d'un onglet : on ne sait pas, et on le dit", () => {
  // `null` veut dire « on ne sait pas », jamais « pas de retour » : c'est ce qui
  // laisse la sortie déclarée reprendre la main — signet, notification à froid.
  assert.equal(pagePrecedente([], DEVIS), null);
  assert.equal(pagePrecedente(journalApresVisite([], DEVIS), DEVIS), null);
});

cas("un journal illisible n'est pas une panne : c'est un onglet neuf", () => {
  for (const brut of [null, undefined, "", "pas du json", "{}", "42", '"/"', "[[]]"]) {
    assert.deepEqual(lireLeJournal(brut), [], `pour ${JSON.stringify(brut)}`);
  }
});

// ─── CE QUI NE DOIT PAS ENTRER DANS UN `href` ───────────────────────────────

cas("aucune sortie hors d'Atlas, même si le rangement a été trafiqué", () => {
  const hostiles = [
    "//ailleurs.example",
    "/\\ailleurs.example",
    "https://ailleurs.example",
    "javascript:alert(1)",
    "ailleurs.example",
    "",
    "   ",
    42,
    null,
    { href: "/" },
  ];
  for (const h of hostiles) assert.equal(cheminInterne(h), null, `« ${String(h)} » a été accepté`);
  const journal = lireLeJournal(JSON.stringify([...hostiles, ACCUEIL]));
  assert.deepEqual(journal, [ACCUEIL], "une adresse étrangère a traversé le journal");
  assert.equal(pagePrecedente(JSON.parse(JSON.stringify(hostiles)) as string[], DEVIS), null);
});

cas("une adresse démesurée est refusée — le rangement d'un onglet n'est pas un dépotoir", () => {
  assert.equal(cheminInterne(`/${"a".repeat(600)}`), null);
  assert.equal(cheminInterne(`/${"a".repeat(400)}`), `/${"a".repeat(400)}`);
});

cas("le journal ne grandit pas indéfiniment", () => {
  let j: string[] = [];
  for (let i = 0; i < PLAFOND_JOURNAL * 3; i++) j = journalApresVisite(j, `/ecran-${i}`);
  assert.equal(j.length, PLAFOND_JOURNAL);
  assert.equal(j[j.length - 1], `/ecran-${PLAFOND_JOURNAL * 3 - 1}`);
});

// ─── LA SEULE PAGE QUI DISPARAÎT SOUS LES PIEDS ─────────────────────────────

cas("une fiche client supprimée quitte le journal, et n'est plus promise", () => {
  let j = journalApresVisite([], "/chantiers/abc");
  j = journalApresVisite(j, "/clients/def");
  j = journalSansCetEcran(j, "/clients/def");
  j = journalApresVisite(j, "/clients");
  assert.equal(
    pagePrecedente(j, "/clients"),
    "/chantiers/abc",
    "la flèche déposerait sur une fiche effacée"
  );
});

// ─── ET LA RÈGLE RESTE HORS DE TOUT ÉCRAN ───────────────────────────────────

cas("aucune ligne de navigateur dans la règle", () => {
  // `CLAUDE.md` §4 sexies : `src/lib` ignore les écrans. Un `window` ici, et la
  // règle ne s'éprouverait plus qu'en démarrant un navigateur — c'est-à-dire
  // plus du tout dans cette suite.
  const source = readFileSync(
    path.join(__dirname, "..", "src", "lib", "journal-de-navigation.ts"),
    "utf8"
  );
  for (const interdit of ["window", "sessionStorage", "document", "usePathname"]) {
    assert.equal(
      new RegExp(`\\b${interdit}\\b`).test(source.replace(/\/\*[\s\S]*?\*\//g, "")),
      false,
      `« ${interdit} » est entré dans la règle pure`
    );
  }
});

// ─── DEUX FOIS LE MÊME GESTE, ET IL RETOMBE SUR L'ACCUEIL ──────────────────
//
// **Sa panne du 10 septembre 2026 :** *« quand je fais deux fois le geste
// client → retour puis client → retour, je reviens à la page d'accueil. »*
//
// **Deux pièces du même lot se marchaient dessus.** La flèche recule désormais
// par `router.back()` quand elle le peut — c'est ce qui rend au patron sa place
// dans la liste. Or `router.back()` déclenche un `popstate`, et le `popstate`
// était écouté pour le bouton DU NAVIGATEUR : il retirait alors du journal
// l'écran d'ARRIVÉE, c'est-à-dire la destination que la flèche venait de
// choisir. Un pas de trop, à chaque retour.
//
// **La confusion est dans la QUESTION, pas dans le mécanisme** : « je quitte
// cet écran en arrière » (on le retire) et « je viens d'atterrir ici » (on le
// GARDE, on ne retire que ce qui le suit) ne sont pas la même chose. Une seule
// fonction répondait aux deux.
cas("deux fois client → retour laisse la liste sous les pieds", () => {
  const LISTE = "/clients";
  const UN = "/clients/aaa";
  const DEUX = "/clients/bbb";
  let j = ["/", LISTE];

  for (const client of [UN, DEUX]) {
    j = journalApresVisite(j, client);
    // La flèche annonce la liste, et c'est déjà le cas aujourd'hui.
    assert.equal(pagePrecedente(j, client), LISTE, `depuis ${client}`);

    // On appuie : l'écran quitté sort du journal…
    j = journalSansCetEcran(j, client);
    // …puis `router.back()` fait parler le `popstate`, qui ne doit RIEN retirer
    // de plus — on vient d'atterrir sur la liste.
    j = journalJusquACetEcran(j, LISTE);
    j = journalApresVisite(j, LISTE);

    assert.ok(
      j.includes(LISTE),
      `la liste a disparu du journal alors qu'on est dessus : ${JSON.stringify(j)}`
    );
  }
});

// **Et le bouton DU NAVIGATEUR garde ce pour quoi cette écoute existe** : après
// un vrai retour du navigateur, les écrans POSTÉRIEURS s'en vont, sinon la
// flèche d'Atlas repartirait en avant.
cas("le retour du navigateur retire ce qui SUIT, pas l'écran d'arrivée", () => {
  // **Le journal porte DEUX fois l'écran d'arrivée**, et ce n'est pas un
  // artifice de contrôle : la visite se note avant que l'événement n'arrive.
  // Une version qui prenait la dernière ligne ne coupait rien, et la flèche
  // annonçait l'écran qu'on venait de quitter.
  const j = ["/", "/clients", "/clients/aaa", "/clients/aaa/devis", "/clients"];
  assert.deepEqual(journalJusquACetEcran(j, "/clients"), ["/", "/clients"]);
  // Et depuis cette place, la flèche annonce bien l'accueil — jamais la fiche.
  assert.equal(pagePrecedente(journalJusquACetEcran(j, "/clients"), "/clients"), "/");
});

// **Rien à couper quand la flèche d'Atlas a déjà fait le ménage** : elle retire
// l'écran qu'elle quitte au moment de l'appui, et l'arrivée n'a alors pas de
// jumelle plus haut.
cas("après la flèche d'Atlas, l'atterrissage ne retire plus rien", () => {
  const j = ["/", "/clients"];
  assert.deepEqual(journalJusquACetEcran(j, "/clients"), j);
});

// Un écran qui n'est pas dans le journal — le bouton « suivant » du navigateur,
// un onglet neuf — ne retire rien : il n'y a rien à tronquer.
cas("un écran absent du journal ne tronque rien", () => {
  const j = ["/", "/clients"];
  assert.deepEqual(journalJusquACetEcran(j, "/paysage"), j);
});

// Et l'écran se reconnaît sans son interrogation : `/termines/tva?t=2` et
// `/termines/tva?t=3` sont le MÊME écran feuilleté.
cas("l'interrogation ne fait pas un écran différent", () => {
  const j = ["/", "/termines/tva?t=2", "/clients", "/termines/tva?t=3"];
  assert.deepEqual(journalJusquACetEcran(j, "/termines/tva"), ["/", "/termines/tva?t=2"]);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le journal de navigation — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
