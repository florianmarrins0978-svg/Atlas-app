import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  CONSERVATION_ANNEES,
  LIBELLES,
  NOTE_DE_LA_FEUILLE,
  POINTS_DE_VIGILANCE,
  SOULIGNES,
  ajouter,
  appliquerLaMemoire,
  cocher,
  compteDuBandeau,
  contenuVide,
  estCoche,
  gardeeJusquAu,
  libellesAvecLesSiens,
  manques,
  memoireDepuis,
  memoireVide,
  refusDuReleveGps,
} from "../src/lib/fiche-securite";
import { composerFicheSecuritePdf } from "../src/server/pdf/fiche-securite-pdf";

// LA FICHE DE SÉCURITÉ — les règles pures, et le PDF qu'elles produisent.
//
// **Ce que cette suite fixe, et pourquoi.** Les mots des cases sont ceux du
// formulaire MSA 12350_A_10/2023, relus sur la feuille rendue en image le
// 21 septembre 2026 — sa règle : *« mot pour mot »*. Un mot qui bouge ici
// n'est pas une coquille, c'est une fiche qu'un contrôleur ne reconnaît plus.
// Les points de vigilance ne sont PAS des cases : il l'a relevé trois fois.

let echecs = 0;
function cas(nom: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${nom}`))
    .catch((e) => {
      echecs++;
      console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
    });
}

async function main() {
  console.log("=== La fiche de sécurité — règles et PDF ===\n");

  await cas("les mots de la feuille, dans son ordre : la page 1", () => {
    assert.deepEqual(LIBELLES.travaux.slice(0, 5), ["Éhoupage", "Élagage de formation", "Élagage d’entretien", "Haubanage", "Démontage avec rétention"]);
    assert.equal(LIBELLES.travaux.at(-1), "Rognage / essouchage", "la faute de la feuille (« essoussage ») n'est pas recopiée");
    assert.deepEqual([...LIBELLES.elevation], ["Nacelle (PEMP)", "PIRL", "EPI de grimper", "Échelle"]);
    assert.equal(LIBELLES.matieres.length, 3, "trois vérifications sur l'arbre, pas une de plus : le décret n'en impose aucune");
  });

  await cas("les points de vigilance ne sont dans AUCUNE liste à cocher", () => {
    const toutesLesCases = Object.values(LIBELLES).flat() as string[];
    for (const vigilance of Object.values(POINTS_DE_VIGILANCE)) {
      assert.ok(!toutesLesCases.includes(vigilance), `« ${vigilance} » est une main rouge sur la feuille, pas une case`);
    }
    assert.ok(!toutesLesCases.includes("Co-activité dans la zone de sécurité du chantier"), "la co-activité est un titre, pas une case");
    assert.ok(!toutesLesCases.some((x) => x === "Autres" || x.startsWith("Autres (")), "« Autres » a laissé la place à « Ajouter »");
  });

  await cas("les mots soulignés de la feuille sont des liens, dans la case, et jebalise.fr y est écrit tel quel", () => {
    assert.ok(LIBELLES.environnementMesures[0].includes("https://www.jebalise.fr/"));
    for (const [libelle, liens] of Object.entries(SOULIGNES)) {
      const toutesLesCases = Object.values(LIBELLES).flat() as string[];
      assert.ok(toutesLesCases.includes(libelle), `le lien est posé sur une case qui n'existe pas : ${libelle.slice(0, 40)}`);
      for (const [mot, url] of liens) {
        assert.ok(libelle.includes(mot), `le mot souligné n'est pas dans sa case : ${mot}`);
        assert.match(url, /^https:\/\//);
      }
    }
  });

  await cas("rien n'est coché sur une fiche neuve, et cocher ne touche qu'une case", () => {
    const vide = contenuVide();
    assert.equal(Object.keys(vide.coches).length, 0);
    assert.equal(vide.photoIds.length, 0);
    const c = cocher(vide, "travaux", "Haubanage");
    assert.ok(estCoche(c, "travaux", "Haubanage"));
    assert.ok(!estCoche(c, "travaux", "Éhoupage"));
    assert.ok(!estCoche(cocher(c, "travaux", "Haubanage"), "travaux", "Haubanage"), "un second appui décoche");
  });

  await cas("un mot ajouté entre au bout de la liste, coché, et ne se dédouble pas", () => {
    const c = ajouter(contenuVide(), "elevation", "  Camion-grue ");
    assert.deepEqual([...libellesAvecLesSiens(c, "elevation")].slice(-1), ["Camion-grue"]);
    assert.ok(estCoche(c, "elevation", "Camion-grue"));
    const encore = ajouter(c, "elevation", "Camion-grue");
    assert.equal(encore.ajouts.elevation?.length, 1, "le même mot deux fois ne fait qu'une case");
    assert.equal(ajouter(c, "elevation", "   ").ajouts.elevation?.length, 1, "un mot vide n'ajoute rien");
    assert.equal(libellesAvecLesSiens(c, "elevation").length, LIBELLES.elevation.length + 1, "les mots de la MSA restent devant");
  });

  await cas("ce qui manque : les sept éléments du décret, et une catégorie vide n'est pas un manque", () => {
    const rien = manques(contenuVide());
    assert.ok(rien.some((m) => m.quoi === "Travaux à réaliser"));
    assert.ok(rien.some((m) => m.quoi === "Point de Rencontre des Secours"));
    let c = contenuVide();
    c = { ...c, donneur: "client", heureDebut: "08:00", photoIds: ["p1"], pointDeRencontre: "devant le portail", lieuTrousse: "camion" };
    c = cocher(c, "travaux", "Haubanage");
    c = cocher(c, "coupe", "Sécateur");
    c = cocher(c, "balisage", LIBELLES.balisage[0]);
    c = cocher(c, "meteo", LIBELLES.meteo[0]);
    c = cocher(c, "secours", LIBELLES.secours[0]);
    assert.deepEqual(manques(c), [], `complète sans co-activité ni risque biologique : ${manques(c).map((m) => m.quoi).join(", ")}`);
    const sansDonneur = { ...c, donneur: "autre" as const, donneurNom: "" };
    assert.ok(manques(sansDonneur).some((m) => m.quoi === "Donneur d’ordre"), "« quelqu'un d'autre » sans nom est un manque");
  });

  await cas("ce qui est gardé d'une fiche à l'autre : les cases, les textes, les ajouts — pas ce qui est propre au chantier", () => {
    let c = contenuVide();
    c = cocher(ajouter(c, "coupe", "Perche élagueuse"), "travaux", "Élagage d’entretien");
    c = { ...c, mainDOeuvre: "3 en CDI", lieuTrousse: "camion", risquesAutres: "vent", mesuresAutres: "rubalise", observations: "prévenir", pointDeRencontre: "portail", gps: "48, 1", heureDebut: "08:00", photoIds: ["p1"], donneur: "autre", donneurNom: "Mairie" };
    const memoire = memoireDepuis(c);
    const suivante = appliquerLaMemoire(contenuVide(), memoire);
    assert.ok(estCoche(suivante, "travaux", "Élagage d’entretien"), "*« tout ce qui se coche reste enregistré pour les fiches suivantes »*");
    assert.ok(estCoche(suivante, "coupe", "Perche élagueuse"));
    assert.equal(suivante.mainDOeuvre, "3 en CDI");
    assert.equal(suivante.lieuTrousse, "camion");
    assert.equal(suivante.observations, "prévenir");
    assert.equal(suivante.pointDeRencontre, "", "le point de rencontre est propre au chantier");
    assert.equal(suivante.gps, "");
    assert.equal(suivante.heureDebut, "");
    assert.deepEqual(suivante.photoIds, []);
    assert.equal(suivante.donneur, null);
    assert.equal(suivante.donneurNom, "");
    assert.deepEqual(appliquerLaMemoire(contenuVide(), memoireVide()), contenuVide(), "sans mémoire, la fiche est vide");
  });

  await cas("le nom et le prénom sont repris d'une fiche à l'autre : le signataire et le responsable sur place", () => {
    // *« La case nom et prénom ne s'enregistre pas d'une fiche à l'autre ! »*
    // (22 septembre 2026). Le signataire ne vivait que dans l'état de l'écran,
    // jamais dans le contenu : ni enregistré en cours de route, ni gardé.
    const c = { ...contenuVide(), signataire: "Martins Florian", responsableNom: "Martins", responsablePrenom: "Florian", responsableTel: "06 79 98 45 14" };
    const suivante = appliquerLaMemoire(contenuVide(), memoireDepuis(c));
    assert.equal(suivante.signataire, "Martins Florian");
    assert.equal(suivante.responsableNom, "Martins");
    assert.equal(suivante.responsablePrenom, "Florian");
    assert.equal(suivante.responsableTel, "06 79 98 45 14");
  });

  await cas("deux ans à compter de la signature, et le bandeau dit où on en est", () => {
    const signee = new Date(2026, 8, 18, 8, 5);
    const garde = gardeeJusquAu(signee);
    assert.equal(garde.getFullYear(), 2026 + CONSERVATION_ANNEES);
    assert.equal(garde.getMonth(), 8);
    assert.equal(garde.getDate(), 18);
    assert.equal(compteDuBandeau(null), "à remplir");
    assert.equal(compteDuBandeau({ signeeLe: null, transmiseLe: null, etapeVue: 0 }), "à remplir");
    assert.equal(compteDuBandeau({ signeeLe: null, transmiseLe: null, etapeVue: 3 }), "3 sur 6");
    assert.equal(compteDuBandeau({ signeeLe: signee, transmiseLe: null, etapeVue: 6 }), "signée");
    assert.equal(compteDuBandeau({ signeeLe: signee, transmiseLe: signee, etapeVue: 6 }), "transmise");
  });

  await cas("le PDF se compose, cases cochées et non cochées, signature et note de la feuille comprises", async () => {
    let c = contenuVide();
    c = cocher(ajouter(c, "reseaux", "Fibre"), "reseaux", "Électrique");
    c = cocher(c, "tensions", LIBELLES.tensions[2]);
    c = cocher(c, "reseauxMesures", LIBELLES.reseauxMesures[2]);
    c = cocher(c, "distances", LIBELLES.distances[2]);
    c = { ...c, donneur: "autre", donneurNom: "Dubeaujardin", donneurPrenom: "Marc", mainDOeuvre: "3 personnes en CDI", observations: "Prévenir le chef si quelque chose change", heureDebut: "08:00", heureFin: "12:30" };
    // un PNG minuscule et valide (2 × 2), en guise de trait
    const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVQIW2NkYGD4z8DAwMAAAAgEAQC6xj9EAAAAAElFTkSuQmCC";
    const pdf = await composerFicheSecuritePdf({
      chantierNom: "Pagnol",
      numeroDevis: "D-2026-041",
      adresse: "12 rue des Lilas, Mantes-la-Jolie",
      jour: "2026-09-18",
      entrepriseNom: "Eden Nature",
      clientNom: "Marcel Pagnol",
      contenu: c,
      signataire: "Florian Marrins",
      signeeLe: new Date(2026, 8, 18, 8, 5),
      signaturePng: signature,
      photos: [],
    });
    const doc = await PDFDocument.load(pdf);
    assert.ok(doc.getPageCount() >= 2, `une fiche entière tient sur plusieurs pages, pas ${doc.getPageCount()}`);
    assert.equal(doc.getTitle(), "Fiche de sécurité, Pagnol");
    assert.equal(NOTE_DE_LA_FEUILLE.lignes.length, 4, "la note au bas de la feuille a quatre lignes");
  });

  await cas("le refus du relevé GPS nomme sa cause, et chaque cause donne un geste différent", () => {
    // Le 22 septembre 2026, le patron : « la position exacte fonctionne pas ».
    // L'écran répondait la même phrase aux trois causes — dont deux qu'aucun
    // réglage ne répare.
    const refuse = refusDuReleveGps(1);
    const sansSignal = refusDuReleveGps(2);
    const tropLong = refusDuReleveGps(3);
    assert.match(refuse, /réglages/i, "un refus de permission renvoie aux réglages");
    assert.doesNotMatch(sansSignal, /réglages/i, "sans signal, les réglages n’y peuvent rien");
    assert.doesNotMatch(tropLong, /réglages/i, "un délai dépassé n’est pas un refus");
    assert.equal(new Set([refuse, sansSignal, tropLong, refusDuReleveGps(undefined)]).size, 4, "quatre causes, quatre phrases");
    for (const m of [refuse, sansSignal, tropLong, refusDuReleveGps(undefined)]) {
      assert.match(m, /écrivez les coordonnées/i, "chaque refus laisse la sortie : les écrire à la main");
    }
  });

  console.log(echecs === 0 ? "\n✅ La fiche de sécurité tient ses règles." : `\n❌ ${echecs} cas en échec.`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
