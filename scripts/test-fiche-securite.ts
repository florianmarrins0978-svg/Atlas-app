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
  lecturesManquantes,
  minimumLegal,
  memoireDepuis,
  refusDeFinaliser,
  validite,
  PROTOCOLE_MODELE,
  RIEN_A_SIGNALER,
  type ContenuFiche,
  memoireVide,
  ecritureRecue,
  refusDeLaSignature,
  refusDuReleveGps,
} from "../src/lib/fiche-securite";
import { composerFicheSecuritePdf } from "../src/server/pdf/fiche-securite-pdf";
import { croquisRecu, manquesDuCroquis, type Marque } from "../src/lib/croquis-securite";
import configurationDeNext from "../next.config";
import { ecrireLeGps, lireLeGps, pointSousLAppui, tuileDemandee, tuilesAutour, versTuile } from "../src/lib/carte-du-point";

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
    assert.equal(LIBELLES.travaux[12], "Rognage / essouchage", "la faute de la feuille (« essoussage ») n'est pas recopiée");
    // Les mots de la MSA restent dans leur ordre ; ceux du 14 octobre s'ajoutent autour, sans les réécrire.
    assert.deepEqual(LIBELLES.elevation.slice(1, 5), ["Nacelle (PEMP)", "PIRL", "EPI de grimper", "Échelle"]);
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

  // ─── LE MINIMUM LÉGAL — sa règle du 14 octobre 2026 : sans lui, la fiche ne se signe pas ───
  const chantier = { adresse: "12 rue des Lilas", datePlanifiee: "2026-10-14" };
  const croquisComplet: Marque[] = [
    { t: "acces", x: 10, y: 10, x2: 50, y2: 50 },
    { t: "voie", x: 0, y: 280, x2: 400, y2: 280 },
    { t: "abattre", x: 200, y: 100 },
  ];
  const ficheComplete = (): ContenuFiche => {
    let c: ContenuFiche = { ...contenuVide(), pointDeRencontre: "devant le portail", lieuTrousse: "camion", croquis: { fond: "blanc", fondPhotoId: null, marques: croquisComplet } };
    c = cocher(c, "travaux", "Haubanage");
    c = cocher(c, "coupe", "Sécateur");
    c = cocher(c, "balisage", LIBELLES.balisage[0]);
    for (const f of ["risquesArbres", "biologique", "reseaux", "environnement"] as const) c = cocher(c, f, RIEN_A_SIGNALER);
    c = cocher(c, "noyade", "Pas de risque de noyade");
    c = cocher(c, "meteo", LIBELLES.meteo[0]);
    c = cocher(c, "secours", LIBELLES.secours[0]);
    return c;
  };

  await cas("le minimum légal : une fiche vide liste chaque élément, avec quoi faire et où", () => {
    const rien = minimumLegal(contenuVide(), chantier).map((m) => m.quoi);
    assert.deepEqual(rien, ["Les travaux", "Le matériel", "Le croquis", "La délimitation du chantier", "Les risques", "La météo", "Les secours"]);
    for (const m of minimumLegal(contenuVide(), chantier)) assert.ok(m.faire.length > 10 && m.etape >= 1 && m.bloc, `« ${m.quoi} » ne dit pas quoi faire ni où`);
    assert.ok(minimumLegal(contenuVide(), { adresse: null, datePlanifiee: null }).some((m) => m.quoi === "Le lieu"), "sans adresse ni GPS, le lieu manque");
  });

  await cas("le minimum légal : rempli, il ne bloque plus ; et le reste ne bloque jamais", () => {
    assert.deepEqual(minimumLegal(ficheComplete(), chantier), [], minimumLegal(ficheComplete(), chantier).map((m) => m.quoi).join(", "));
    // Sans EPI, sans sous-traitants, sans arbres dangereux, sans co-activité : conseillé, pas exigé.
    assert.equal(ficheComplete().coches.epi, undefined);
  });

  await cas("« Rien à signaler » est une réponse ; un risque oublié n'en est pas une", () => {
    let c = ficheComplete();
    c = { ...c, coches: { ...c.coches, noyade: [] } };
    const m = minimumLegal(c, chantier).find((x) => x.quoi === "Les risques");
    assert.ok(m, "un risque sans réponse doit bloquer");
    assert.match(m.faire, /la noyade/);
    assert.equal(m.bloc, "risques-noyade", "la ligne emmène au risque qui manque");
  });

  await cas("« Rien à signaler » décoche le reste de sa famille, et un risque coché le décoche", () => {
    let c = cocher(contenuVide(), "biologique", "Tiques sp");
    c = cocher(c, "biologique", RIEN_A_SIGNALER);
    assert.deepEqual(c.coches.biologique, [RIEN_A_SIGNALER]);
    c = cocher(c, "biologique", "Tiques sp");
    assert.deepEqual(c.coches.biologique, ["Tiques sp"]);
    c = cocher(cocher(contenuVide(), "elevation", "Pas besoin pour ce chantier"), "elevation", "Échelle");
    assert.deepEqual(c.coches.elevation, ["Échelle"], "« Pas besoin » et une échelle ne se contredisent pas");
  });

  await cas("le croquis : les trois éléments de la loi, et rien d'autre ne bloque", () => {
    assert.deepEqual(manquesDuCroquis({ fond: "blanc", fondPhotoId: null, marques: [] }), ["accès", "voie de circulation", "arbres à traiter"]);
    assert.deepEqual(manquesDuCroquis({ fond: "blanc", fondPhotoId: null, marques: croquisComplet }), []);
    const sansVoie = croquisComplet.filter((m) => m.t !== "voie");
    assert.deepEqual(manquesDuCroquis({ fond: "blanc", fondPhotoId: null, marques: sansVoie }), ["voie de circulation"]);
    assert.deepEqual(manquesDuCroquis({ fond: "blanc", fondPhotoId: null, marques: [...sansVoie, { t: "tailler", x: 1, y: 1 }, { t: "voie", x: 0, y: 0, x2: 1, y2: 1 }] }), [], "un arbre à tailler compte comme arbre à traiter");
  });

  await cas("le croquis reçu se vérifie : forme, bornes, trop de points", () => {
    assert.ok(croquisRecu({ fond: "photo", fondPhotoId: "8f5c2a0e-1b2c-4d3e-9f40-123456789abc", marques: croquisComplet }).ok);
    const faux: unknown[] = [
      { fond: "dessin", fondPhotoId: null, marques: [] },
      { fond: "blanc", fondPhotoId: "pas-un-id", marques: [] },
      { fond: "blanc", fondPhotoId: null, marques: [{ t: "inventee", x: 1, y: 1 }] },
      { fond: "blanc", fondPhotoId: null, marques: [{ t: "acces", x: 1, y: 1 }] },
      { fond: "blanc", fondPhotoId: null, marques: [{ t: "maison", x: 9_999, y: 1 }] },
      { fond: "blanc", fondPhotoId: null, marques: [{ t: "crayon", pts: [1, 2, 3] }] },
      { fond: "blanc", fondPhotoId: null, marques: [{ t: "danger", x: 1, y: 1, mot: "a".repeat(500) }] },
      { fond: "blanc", fondPhotoId: null, marques: Array.from({ length: 20 }, () => ({ t: "crayon", pts: Array.from({ length: 3_000 }, () => 10) })) },
    ];
    for (const x of faux) assert.equal(croquisRecu(x).ok, false, `accepté : ${JSON.stringify(x).slice(0, 100)}`);
  });

  await cas("l'équipe : chacun signe l'avoir lue, sauf le chef qui a signé la fiche ; un absent ne signe pas", () => {
    const c: ContenuFiche = {
      ...ficheComplete(),
      signataire: "Florian Martins",
      equipe: [
        { nom: "Florian Martins", present: true, formations: [], sst: "", gsa: "" },
        { nom: "Kevin Morel", present: true, formations: [], sst: "", gsa: "" },
        { nom: "Lucas Petit", present: false, formations: [], sst: "", gsa: "" },
      ],
    };
    assert.deepEqual(lecturesManquantes(c), ["Kevin Morel"]);
    assert.match(refusDeFinaliser(c, true, chantier) ?? "", /Kevin Morel doit signer/);
    const lue = { ...c, lectures: [{ nom: "kevin  morel", png: "x", le: "2026-10-14T07:55:00Z" }] };
    assert.deepEqual(lecturesManquantes(lue), [], "le nom se compare sans casse ni espaces en trop");
    assert.equal(refusDeFinaliser(lue, true, chantier), null);
    assert.match(refusDeFinaliser(lue, false, chantier) ?? "", /Signez la fiche/);
    assert.match(refusDeFinaliser({ ...lue, coches: {} }, true, chantier) ?? "", /que la loi exige/, "le minimum légal se revérifie à l'enregistrement");
  });

  await cas("le SST et le GSA durent 24 mois, comptés depuis leur date", () => {
    const ceJour = new Date("2026-10-14T12:00:00Z");
    assert.equal(validite("2024-11-01", ceJour).ok, true);
    assert.equal(validite("2024-09-02", ceJour).ok, false, "obtenu il y a plus de 24 mois");
    assert.equal(validite("", ceJour).ok, false);
    assert.equal(validite("2025-03-03", ceJour).fin?.toISOString().slice(0, 10), "2027-03-03");
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

  await cas("sa règle du 14 octobre : l'équipe, les entreprises et le protocole reviennent ; leur présence non", () => {
    const c: ContenuFiche = {
      ...contenuVide(),
      equipe: [{ nom: "Kevin Morel", present: false, formations: ["CACES nacelle"], sst: "2025-01-18", gsa: "" }],
      entreprises: [{ nom: "Élec Services", tel: "02 41", quoi: "coupe la ligne", presente: true, montree: true }],
      protocole: "Mon protocole",
      autresResponsables: [{ nom: "Jean", tel: "06" }],
      arbres: [{ groupe: false, intervention: "Abattage", dangers: ["Arbre mort"], consignes: [], autres: "" }],
      croquis: { fond: "blanc", fondPhotoId: null, marques: croquisComplet },
    };
    const suivante = appliquerLaMemoire(contenuVide(), memoireDepuis(c));
    assert.deepEqual(suivante.equipe, [{ nom: "Kevin Morel", present: true, formations: ["CACES nacelle"], sst: "2025-01-18", gsa: "" }], "l'équipe revient, cochée");
    assert.deepEqual(suivante.entreprises, [{ nom: "Élec Services", tel: "02 41", quoi: "coupe la ligne", presente: false, montree: false }], "l'entreprise revient, pas sa présence");
    assert.equal(suivante.protocole, "Mon protocole");
    assert.deepEqual(suivante.autresResponsables, [{ nom: "Jean", tel: "06" }]);
    assert.deepEqual(suivante.arbres, [], "les arbres dangereux sont propres au chantier");
    assert.deepEqual(suivante.croquis.marques, [], "le croquis est propre au chantier");
    assert.equal(appliquerLaMemoire(contenuVide(), memoireVide()).protocole, PROTOCOLE_MODELE, "sans protocole gardé, le modèle");
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
    const equipe = [{ nom: "Kevin", present: true, formations: [], sst: "", gsa: "" }];
    assert.equal(compteDuBandeau({ signeeLe: signee, transmiseLe: null, etapeVue: 6, contenu: { ...contenuVide(), equipe } }), "à faire lire");
    assert.equal(compteDuBandeau({ signeeLe: signee, transmiseLe: null, etapeVue: 6, contenu: { ...contenuVide(), equipe, lectures: [{ nom: "Kevin", png: "", le: "" }] } }), "à enregistrer");
    assert.equal(compteDuBandeau({ signeeLe: signee, transmiseLe: null, etapeVue: 6, contenu: { ...contenuVide(), equipe, finaliseeLe: "2026-10-14" } }), "signée");
  });

  await cas("le PDF se compose, cases cochées et non cochées, signature et note de la feuille comprises", async () => {
    let c = contenuVide();
    c = cocher(ajouter(c, "reseaux", "Fibre"), "reseaux", "Électrique");
    c = cocher(c, "tensions", LIBELLES.tensions[2]);
    c = cocher(c, "reseauxMesures", LIBELLES.reseauxMesures[2]);
    c = cocher(c, "distances", LIBELLES.distances[2]);
    c = { ...c, donneur: "autre", donneurNom: "Dubeaujardin", donneurPrenom: "Marc", mainDOeuvre: "3 personnes en CDI", observations: "Prévenir le chef si quelque chose change", heureDebut: "08:00", heureFin: "12:30" };
    const toutesLesMarques: Marque[] = [
      ...croquisComplet,
      { t: "crayon", pts: [10, 10, 20, 30, 40, 35] },
      { t: "ligne", x: 0, y: 20, x2: 400, y2: 40 },
      { t: "limite", x: 380, y: 280, x2: 20, y2: 20 },
      { t: "ruisseau", x: 0, y: 150, x2: 170, y2: 140 },
      { t: "tailler", x: 336, y: 170 },
      { t: "maison", x: 80, y: 70 },
      { t: "danger", x: 262, y: 110, mot: "chute du frêne" },
      { t: "stockage", x: 80, y: 200 },
      { t: "reseau", x: 370, y: 230 },
      { t: "secours", x: 200, y: 230 },
    ];
    c = {
      ...c,
      croquis: { fond: "blanc", fondPhotoId: null, marques: toutesLesMarques },
      equipe: [{ nom: "Kevin Morel", present: true, formations: ["CACES nacelle"], sst: "2025-01-18", gsa: "" }],
      entreprisesSurPlace: "oui",
      entreprises: [{ nom: "Élec Services", tel: "02 41", quoi: "coupe la ligne", presente: true, montree: true }],
      arbresDangereux: "oui",
      arbres: [{ groupe: false, intervention: "Abattage", dangers: ["Arbre mort"], consignes: ["Rubalise autour du tronc"], autres: "" }],
      lectures: [{ nom: "Kevin Morel", png: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVQIW2NkYGD4z8DAwMAAAAgEAQC6xj9EAAAAAElFTkSuQmCC", le: "2026-09-18T06:10:00Z" }],
      gps: "48.99387, 1.71077",
      adresseDuPoint: "10 Rue Denfert Rochereau 78200 Mantes-la-Jolie",
    };
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
      // Une tuile de carte en guise de vraie (la vraie demande le réseau) : le rognage doit passer.
      carte: { largeur: 640, hauteur: 250, tuiles: [{ gauche: -40, haut: -60, octets: Buffer.from(signature.split(",")[1], "base64"), mime: "image/png" }] },
    });
    const doc = await PDFDocument.load(pdf);
    assert.ok(doc.getPageCount() >= 2, `une fiche entière tient sur plusieurs pages, pas ${doc.getPageCount()}`);
    assert.equal(doc.getTitle(), "Fiche de sécurité, Pagnol");
    assert.equal(NOTE_DE_LA_FEUILLE.lignes.length, 4, "la note au bas de la feuille a quatre lignes");
  });

  // ─── LA CARTE DU POINT GPS — sa planche du 14 octobre 2026 ───
  // Trouvé le 14 octobre 2026 en regardant l'écran : « Relever ici » n'a JAMAIS pu marcher. L'en-tête
  // posé au premier jour (`geolocation=()`) interdisait la position à toutes les pages, la nôtre comprise ;
  // le navigateur refusait sans rien demander, et l'écran disait « refusé ». C'est sa remarque du
  // 22 septembre : « la position exacte fonctionne pas ».
  await cas("les pages d'Atlas ont le droit de demander la position du téléphone", async () => {
    const regles = (await configurationDeNext.headers?.()) ?? [];
    const politique = regles.flatMap((r) => r.headers).find((h) => h.key === "Permissions-Policy")?.value ?? "";
    assert.ok(politique, "aucune politique des permissions : le contrôle ne mesure rien");
    assert.match(politique, /(^|,\s*)geolocation=\(self\)/, `la position est interdite aux pages d'Atlas : « ${politique} »`);
  });

  await cas("la carte : le GPS se lit, l'appui retombe sur le point touché, les tuiles couvrent la vue", () => {
    assert.deepEqual(lireLeGps("48.99387, 1.71077"), { lat: 48.99387, lon: 1.71077 });
    assert.deepEqual(lireLeGps(" 48,99387 ; 1,71077 "), { lat: 48.99387, lon: 1.71077 }, "les virgules à la française se lisent");
    for (const faux of ["", "derrière l'église", "48.9", "91, 2", "48.9, 200", "48.9, 1.7, 3"]) assert.equal(lireLeGps(faux), null, `« ${faux} » a donné un point`);
    const p = { lat: 48.99387, lon: 1.71077 };
    assert.equal(ecrireLeGps(p), "48.99387, 1.71077");
    // Un appui au centre ne déplace rien ; un appui de 256 pixels à droite avance d'une tuile.
    assert.equal(ecrireLeGps(pointSousLAppui(p, 17, 0, 0)), ecrireLeGps(p), "un appui au centre a déplacé le point");
    const aDroite = pointSousLAppui(p, 17, 256, 0);
    assert.ok(Math.abs(versTuile(aDroite, 17).x - versTuile(p, 17).x - 1) < 1e-9, "l'appui ne retombe pas où il a été fait");
    assert.ok(Math.abs(aDroite.lat - p.lat) < 1e-9, "un appui horizontal a changé la latitude");
    // Toute la vue est couverte, sans trou : chaque pixel sous une tuile.
    const tuiles = tuilesAutour(p, 17, 390, 260);
    for (const [px, py] of [[0, 0], [389, 0], [0, 259], [389, 259], [195, 130]]) {
      assert.ok(tuiles.some((t) => px >= t.gauche && px < t.gauche + 256 && py >= t.haut && py < t.haut + 256), `le pixel ${px},${py} n'a pas de tuile`);
    }
  });

  await cas("la route des tuiles ne demande à l'IGN que des tuiles qui existent", () => {
    assert.deepEqual(tuileDemandee("plan", "17", "66338", "45076"), { fond: "plan", z: 17, x: 66338, y: 45076 });
    assert.equal(tuileDemandee("satellite", "17", "1", "1"), null, "un fond inconnu passe");
    assert.equal(tuileDemandee("plan", "25", "1", "1"), null, "un zoom hors bornes passe");
    assert.equal(tuileDemandee("plan", "12", "4096", "1"), null, "une colonne hors de la carte passe");
    assert.equal(tuileDemandee("photo", "17", "1.5", "1"), null, "une colonne non entière passe");
    assert.equal(tuileDemandee("plan", null, "1", "1"), null, "un zoom absent passe");
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

  // ─── CE QUE LE TÉLÉPHONE ENVOIE SE VÉRIFIE — campagne de sécurité, 13 octobre 2026
  //
  // Le formulaire envoie toujours une fiche bien formée. Un appel fait à la
  // main, non : il pouvait poser n'importe quoi en base, jusqu'à 15 Mo toutes
  // les deux secondes, et une forme fausse rendait la fiche et son PDF
  // illisibles. Ce qui est vérifié ici l'est avant toute écriture.
  await cas("ce que le formulaire envoie passe tel quel", () => {
    const contenu = ajouter(cocher(contenuVide(), "travaux", "Abattage"), "travaux", "Rognage de souche");
    const r = ecritureRecue({ contenu: { ...contenu, observations: "Ligne électrique au fond", photoIds: ["8f5c2a0e-1b2c-4d3e-9f40-123456789abc"] }, etapeVue: 3, loiLue: true });
    assert.ok(r.ok, r.ok ? "" : r.raison);
    assert.equal(r.ecriture.etapeVue, 3);
    assert.ok(estCoche(r.ecriture.contenu, "travaux", "Rognage de souche"));
  });

  await cas("une forme fausse est refusée, avant d'atteindre la base", () => {
    const vide = contenuVide();
    const fausses: unknown[] = [
      null,
      "texte",
      { contenu: "pas une fiche", etapeVue: 1, loiLue: true },
      { contenu: { ...vide, coches: "abattage" }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, coches: { travaux: [42] } }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, coches: { inventee: ["x"] } }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, photoIds: "abc" }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, photoIds: ["pas-un-identifiant"] }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, observations: 12 }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, donneur: "voisin" }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, nombreDeTravailleurs: -3 }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, nombreDeTravailleurs: 2.5 }, etapeVue: 1, loiLue: true },
      { contenu: vide, etapeVue: -1, loiLue: true },
      { contenu: vide, etapeVue: 99, loiLue: true },
      { contenu: vide, etapeVue: 1, loiLue: "oui" },
    ];
    for (const f of fausses) assert.equal(ecritureRecue(f).ok, false, `accepté : ${JSON.stringify(f)?.slice(0, 120)}`);
  });

  await cas("les parties neuves se vérifient aussi : l'équipe, les entreprises, les arbres, le croquis", () => {
    const vide = contenuVide();
    const fausses: unknown[] = [
      { contenu: { ...vide, equipe: [{ nom: "Kevin", present: true, formations: [], sst: "hier", gsa: "" }] }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, equipe: "Kevin" }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, entreprises: [{ nom: "Élec", tel: "", quoi: "", presente: "oui", montree: false }] }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, arbres: [{ groupe: false, intervention: "Dessouchage", dangers: [], consignes: [], autres: "" }] }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, arbresDangereux: "peut-être" }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, croquis: { fond: "blanc", fondPhotoId: null, marques: "dessin" } }, etapeVue: 1, loiLue: true },
    ];
    for (const f of fausses) assert.equal(ecritureRecue(f).ok, false, `accepté : ${JSON.stringify(f)?.slice(0, 120)}`);
  });

  await cas("une lecture ou un enregistrement ne se déclarent pas avec le contenu : ils ont leurs propres gestes", () => {
    const r = ecritureRecue({ contenu: { ...contenuVide(), lectures: [{ nom: "Kevin", png: "x", le: "x" }], finaliseeLe: "2026-10-14", envois: ["client"], prevention: "oui" }, etapeVue: 1, loiLue: true });
    assert.ok(r.ok);
    assert.deepEqual(r.ecriture.contenu.lectures, []);
    assert.equal(r.ecriture.contenu.finaliseeLe, null);
    assert.deepEqual(r.ecriture.contenu.envois, []);
    assert.equal(r.ecriture.contenu.prevention, null);
  });

  await cas("trop long est refusé : un texte, un mot ajouté, une liste, des photos", () => {
    const vide = contenuVide();
    const tropLongues: unknown[] = [
      { contenu: { ...vide, observations: "a".repeat(5_000) }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, ajouts: { travaux: ["a".repeat(500)] } }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, coches: { travaux: Array.from({ length: 500 }, (_, i) => `mot ${i}`) } }, etapeVue: 1, loiLue: true },
      { contenu: { ...vide, photoIds: Array.from({ length: 200 }, () => "8f5c2a0e-1b2c-4d3e-9f40-123456789abc") }, etapeVue: 1, loiLue: true },
    ];
    for (const f of tropLongues) assert.equal(ecritureRecue(f).ok, false, "un envoi démesuré est passé");
  });

  await cas("ce qui ne fait pas partie de la fiche ne s'écrit pas", () => {
    const r = ecritureRecue({ contenu: { ...contenuVide(), intrus: "x".repeat(1_000) }, etapeVue: 1, loiLue: true });
    assert.ok(r.ok);
    assert.equal("intrus" in r.ecriture.contenu, false);
  });

  await cas("la signature : un vrai PNG, de taille raisonnable, tracé au doigt", () => {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVQIW2NkYGD4z8DAwMAAAAgEAQC6xj9EAAAAAElFTkSuQmCC";
    assert.equal(refusDeLaSignature(png, 50), null);
    assert.ok(refusDeLaSignature(png, 2), "un point n'est pas une signature");
    assert.ok(refusDeLaSignature("data:image/png;base64,PHN2Zz48L3N2Zz4=", 50), "du SVG déguisé en PNG est passé");
    assert.ok(refusDeLaSignature("data:image/png;base64,iVBORw0KGgo%%%", 50), "du base64 cassé est passé");
    assert.ok(refusDeLaSignature(`data:image/png;base64,iVBORw0KGgo${"A".repeat(2_000_000)}`, 50), "une signature de 2 Mo est passée");
  });

  console.log(echecs === 0 ? "\n✅ La fiche de sécurité tient ses règles." : `\n❌ ${echecs} cas en échec.`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
