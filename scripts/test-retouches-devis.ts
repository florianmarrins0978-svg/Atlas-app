import assert from "node:assert/strict";
import {
  changementApplicable,
  direRetouche,
  lireRetouchesDuModele,
  montantDicte,
  resoudreCible,
  resoudreRetouches,
  ressemblance,
  normaliser,
  SEUIL_RECONNAISSANCE,
  type LigneDevis,
  type Retouche,
  type RetoucheResolue,
} from "../src/lib/retouches-devis";

// Retoucher un devis à la voix : que ce qu'il DIT tombe sur la bonne ligne.
//
// **Cette suite est la liste de courses du patron, mot pour mot.** Le 15 août
// 2026, il a décrit ce qu'il voulait pouvoir dire — et il a terminé par : *« Je
// vais pouvoir lui parler comme ça et qu'elle comprenne. »* Chaque cas
// ci-dessous porte une de ses phrases en commentaire, et échoue le jour où
// cette phrase-là cesse d'être comprise.
//
// Ce qu'aucune suite navigateur ne verrait : l'écran affichera toujours
// quelque chose de plausible. C'est en comparant la phrase dite à la ligne
// touchée qu'on voit la retouche tomber à côté — et une retouche qui tombe à
// côté retire la mauvaise ligne d'un devis qui part chez un client.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** L'identifiant de la ligne touchée, ou `null` si la retouche est tombée à côté. */
const surQuelleLigne = (r: RetoucheResolue): string | null => (r.etat === "ok" ? (r.ligne?.id ?? null) : null);

const l = (id: string, libelle: string, quantite = "1", prixUnitaire = "0"): LigneDevis => ({
  id,
  libelle,
  quantite,
  prixUnitaire,
});

// Le devis type d'une de ses journées, avec la faute de frappe comprise.
const DEVIS: LigneDevis[] = [
  l("a", "Taille de haie — 12 m", "12", "250"),
  l("b", "Fendage du bois", "1", "180"),
  l("c", "Évacuation des déchets verts", "1", "90"),
];

console.log("=== Ce qu'il dit tombe-t-il sur la bonne ligne ? ===\n");

// ── Ses phrases, une par une ────────────────────────────────────────────────

// « supprime-moi la deuxième ligne »
cas("« la deuxième ligne » désigne la deuxième, pas la seconde en partant du bas", () => {
  const r = resoudreCible(DEVIS, { rang: 2 });
  assert.equal(r.etat, "ok");
  assert.equal(r.etat === "ok" && r.ligne.id, "b");
});

// « modifie-moi le prix de la taille de haie, remplace-moi le 250 par 350 »
cas("« le prix de la taille de haie » retrouve « Taille de haie — 12 m »", () => {
  const [r] = resoudreRetouches(DEVIS, [
    { type: "prix", cible: { libelle: "la taille de haie" }, prixUnitaire: "350" },
  ]);
  assert.equal(r.etat, "ok");
  assert.equal(r.ligne?.id, "a");
  const dit = direRetouche(r);
  assert.equal(dit.verbe, "Changer le prix");
  assert.equal(dit.detail, "250 € → 350 €");
});

// « rajoute-moi une ligne, broyage des branches, et tu mets cinq cents euros »
cas("« rajoute broyage des branches à 500 » ajoute sans toucher au reste", () => {
  const [r] = resoudreRetouches(DEVIS, [
    { type: "ajouter", libelle: "Broyage des branches", quantite: "1", prixUnitaire: "500" },
  ]);
  assert.equal(r.etat, "ok");
  assert.equal(r.ligne, null, "un ajout ne tombe sur aucune ligne existante");
  assert.equal(direRetouche(r).verbe, "Ajouter");
  assert.match(direRetouche(r).detail, /500 €/);
});

// « supprime-moi fondage du bois, mais en échange je veux que tu mettes
//   débitage du bois » — SON exemple, et le plus fragile : « fondage » n'existe
// nulle part, ni dans le devis, ni dans la langue.
cas("« fondage du bois » tombe sur « Fendage du bois » — une lettre d'écart", () => {
  const r = resoudreCible(DEVIS, { libelle: "fondage du bois" });
  assert.equal(r.etat, "ok");
  assert.equal(r.etat === "ok" && r.ligne.id, "b");
});

cas("l'échange fondage → débitage se lit en toutes lettres", () => {
  const [r] = resoudreRetouches(DEVIS, [
    { type: "libelle", cible: { libelle: "fondage du bois" }, libelle: "Débitage du bois" },
  ]);
  const dit = direRetouche(r);
  assert.equal(dit.verbe, "Corriger");
  assert.equal(dit.quoi, "Fendage du bois");
  assert.equal(dit.detail, "→ Débitage du bois");
});

// « tu as fait une faute à tel endroit, corrige la faute »
cas("une correction d'orthographe se dit sur le libellé, sans toucher au prix", () => {
  const [r] = resoudreRetouches(DEVIS, [
    { type: "libelle", cible: { libelle: "evacuation des dechets vert" }, libelle: "Évacuation des déchets verts" },
  ]);
  assert.equal(r.etat, "ok");
  assert.equal(r.ligne?.id, "c");
  assert.equal(r.ligne?.prixUnitaire, "90", "corriger un mot ne touche à aucun chiffre");
});

// ── Ce qu'on refuse de deviner ──────────────────────────────────────────────

// **`CLAUDE.md` §4 : on n'invente jamais un prix.** Le jour où ce module
// devinerait « le prix habituel du broyage », un devis partirait chez un client
// avec un chiffre que personne n'a dit.
cas("un ajout sans montant arrive VIDE, et le dit", () => {
  const [r] = resoudreRetouches(DEVIS, [
    { type: "ajouter", libelle: "Broyage des branches", quantite: null, prixUnitaire: null },
  ]);
  assert.equal(r.retouche.type === "ajouter" && r.retouche.prixUnitaire, null);
  assert.match(direRetouche(r).detail, /Aucun prix dicté/);
  assert.doesNotMatch(direRetouche(r).detail, /\d+ €/, "aucun chiffre ne doit apparaître");
});

// Le devis d'un élagueur porte souvent deux lignes qui commencent pareil.
// Choisir la première parce qu'elle arrive en tête, c'est retirer la mauvaise
// une fois sur deux.
const DEUX_ELAGAGES: LigneDevis[] = [
  l("x", "Élagage chêne", "1", "400"),
  l("y", "Élagage frêne", "1", "380"),
];

cas("« l'élagage » quand il y en a deux rend « ambigu », jamais un choix au hasard", () => {
  const r = resoudreCible(DEUX_ELAGAGES, { libelle: "élagage" });
  assert.equal(r.etat, "ambigu");
  assert.equal(r.etat === "ambigu" && r.candidates.length, 2);
});

cas("… et l'écran le dit avec les deux noms, pour qu'il tranche", () => {
  const [r] = resoudreRetouches(DEUX_ELAGAGES, [{ type: "retirer", cible: { libelle: "élagage" } }]);
  const dit = direRetouche(r);
  assert.equal(dit.verbe, "À préciser");
  assert.match(dit.detail, /Élagage chêne/);
  assert.match(dit.detail, /Élagage frêne/);
});

cas("« la deuxième, l'élagage » : le rang départage ce que le nom laisse ambigu", () => {
  const r = resoudreCible(DEUX_ELAGAGES, { rang: 2, libelle: "élagage" });
  assert.equal(r.etat, "ok");
  assert.equal(r.etat === "ok" && r.ligne.id, "y");
});

cas("un nom dit mais reconnu nulle part ne se rabat PAS sur le rang", () => {
  // Il a nommé quelque chose. Prendre la ligne n° 1 « puisqu'il a dit première »
  // alors qu'il parlait d'une prestation absente, c'est modifier une ligne au
  // hasard sans qu'il s'en aperçoive.
  const r = resoudreCible(DEVIS, { rang: 1, libelle: "pose de clôture" });
  assert.equal(r.etat, "introuvable");
});

cas("un rang hors du devis ne se rabat pas sur la dernière ligne", () => {
  assert.equal(resoudreCible(DEVIS, { rang: 9 }).etat, "introuvable");
  assert.equal(resoudreCible(DEVIS, { rang: 0 }).etat, "introuvable");
  assert.equal(resoudreCible(DEVIS, { rang: -2 }).etat, "introuvable");
});

cas("une cible vide ne désigne rien", () => {
  assert.equal(resoudreCible(DEVIS, {}).etat, "introuvable");
  assert.equal(resoudreCible(DEVIS, { libelle: "   ", rang: null }).etat, "introuvable");
  assert.equal(resoudreCible([], { rang: 1 }).etat, "introuvable");
});

// ── L'ordre, tel qu'il le voit ──────────────────────────────────────────────

// **Les lignes ne bougent pas d'une retouche à l'autre.** Il dicte l'écran sous
// les yeux : « supprime la deuxième et change le prix de la troisième » se lit
// sur le devis AFFICHÉ, pas sur celui qu'on obtiendrait après le retrait.
cas("« supprime la deuxième, change la troisième » ne décale pas les rangs", () => {
  const rs = resoudreRetouches(DEVIS, [
    { type: "retirer", cible: { rang: 2 } },
    { type: "prix", cible: { rang: 3 }, prixUnitaire: "120" },
  ]);
  assert.equal(surQuelleLigne(rs[0]), "b");
  assert.equal(surQuelleLigne(rs[1]), "c", "la troisième reste la troisième, pas celle d'après le retrait");
});

cas("chaque retouche dite rend exactement une retouche résolue, dans l'ordre", () => {
  const dictees: Retouche[] = [
    { type: "retirer", cible: { rang: 2 } },
    { type: "ajouter", libelle: "Broyage", quantite: null, prixUnitaire: "500" },
    { type: "quantite", cible: { libelle: "taille de haie" }, quantite: "18" },
  ];
  const rs = resoudreRetouches(DEVIS, dictees);
  assert.equal(rs.length, 3);
  rs.forEach((r, i) => assert.equal(r.retouche, dictees[i]));
  assert.equal(direRetouche(rs[2]).detail, "12 → 18");
});

// ── La reconnaissance elle-même ─────────────────────────────────────────────

cas("les accents ne décident de rien — la transcription les met au hasard", () => {
  assert.equal(normaliser("Évacuation des déchets"), "evacuation des dechets");
  assert.equal(resoudreCible(DEVIS, { libelle: "evacuation des dechets verts" }).etat, "ok");
});

cas("les petits mots sautés ne font pas rater la ligne", () => {
  // On dicte « broyage branches », jamais « broyage des branches ».
  assert.ok(ressemblance("broyage branches", "Broyage des branches") >= SEUIL_RECONNAISSANCE);
  assert.ok(ressemblance("taille haie", "Taille de haie — 12 m") >= SEUIL_RECONNAISSANCE);
});

cas("deux prestations sans rapport restent sans rapport", () => {
  assert.ok(ressemblance("pose de clôture", "Fendage du bois") < SEUIL_RECONNAISSANCE);
  assert.ok(ressemblance("tonte", "Évacuation des déchets verts") < SEUIL_RECONNAISSANCE);
  assert.equal(ressemblance("", "Fendage du bois"), 0);
});

cas("la ressemblance reste entre 0 et 1, quoi qu'on lui donne", () => {
  for (const dit of ["", "a", "fendage", "fendage du bois", "x".repeat(200)]) {
    for (const ligne of DEVIS) {
      const n = ressemblance(dit, ligne.libelle);
      assert.ok(n >= 0 && n <= 1, `${dit} / ${ligne.libelle} → ${n}`);
    }
  }
});

// ── Ce que le modèle rend, et ce qu'on en garde ─────────────────────────────

cas("un montant s'écrit à la virgule, au point, ou avec son euro", () => {
  assert.equal(montantDicte("350"), "350");
  assert.equal(montantDicte("350,50"), "350.50");
  assert.equal(montantDicte("350.50"), "350.50");
  assert.equal(montantDicte("350 €"), "350");
  assert.equal(montantDicte(500), "500");
});

cas("tout ce qui n'est pas un nombre n'est PAS un prix", () => {
  // « environ », « à voir », « le prix habituel » : autant de façons de ne pas
  // dire un montant. Aucune ne doit finir en chiffre sur un devis.
  for (const faux of ["environ 500", "à voir", "le prix habituel", "", "trois cents", null, undefined, {}]) {
    assert.equal(montantDicte(faux), null, JSON.stringify(faux));
  }
});

cas("la réponse du modèle se lit, telle qu'il l'écrit", () => {
  const r = lireRetouchesDuModele({
    retouches: [
      { type: "retirer", rang: 2, cible: null },
      { type: "prix", rang: null, cible: "la taille de haie", prixUnitaire: "350" },
      { type: "ajouter", libelle: "Broyage des branches", quantite: null, prixUnitaire: "500 €" },
    ],
  });
  assert.equal(r.length, 3);
  assert.equal(r[0].type, "retirer");
  assert.equal(r[1].type === "prix" && r[1].prixUnitaire, "350");
  assert.equal(r[2].type === "ajouter" && r[2].prixUnitaire, "500");
});

cas("une liste nue se lit aussi bien qu'un objet enveloppé", () => {
  assert.equal(lireRetouchesDuModele([{ type: "retirer", rang: 1 }]).length, 1);
  assert.equal(lireRetouchesDuModele({ retouches: [] }).length, 0);
  for (const rien of [null, undefined, "du texte", 42, {}]) {
    assert.equal(lireRetouchesDuModele(rien).length, 0, JSON.stringify(rien));
  }
});

cas("une retouche bancale est JETÉE, pas rattrapée", () => {
  // Il verra qu'un changement manque et le redira. Il ne verrait pas, en
  // revanche, qu'un chiffre a été mal repris — c'est ce déséquilibre qui décide.
  const r = lireRetouchesDuModele({
    retouches: [
      { type: "prix", cible: "taille de haie" }, // sans montant
      { type: "prix", cible: "taille de haie", prixUnitaire: "à voir" },
      { type: "ajouter", quantite: "1", prixUnitaire: "500" }, // sans nom
      { type: "retirer" }, // sans rien pour désigner
      { type: "renommer", cible: "x", libelle: "y" }, // type inconnu
      "supprime la deuxième",
      null,
    ],
  });
  assert.equal(r.length, 0);
});

// ── Du coché à l'appliqué ───────────────────────────────────────────────────

cas("ce qui n'est pas résolu n'est pas applicable — jamais", () => {
  const [ambigu] = resoudreRetouches(DEUX_ELAGAGES, [{ type: "retirer", cible: { libelle: "élagage" } }]);
  assert.equal(changementApplicable(ambigu), null);
  const [absent] = resoudreRetouches(DEVIS, [{ type: "retirer", cible: { libelle: "pose de clôture" } }]);
  assert.equal(changementApplicable(absent), null);
});

cas("un changement applicable porte l'identifiant de la ligne, pas son rang", () => {
  const [r] = resoudreRetouches(DEVIS, [
    { type: "prix", cible: { libelle: "taille de haie" }, prixUnitaire: "350" },
  ]);
  const c = changementApplicable(r);
  assert.deepEqual(c, { type: "prix", ligneId: "a", prixUnitaire: "350" });
});

cas("un ajout reste applicable sans prix, et le prix reste nul", () => {
  const [r] = resoudreRetouches(DEVIS, [
    { type: "ajouter", libelle: "Broyage des branches", quantite: null, prixUnitaire: null },
  ]);
  assert.deepEqual(changementApplicable(r), {
    type: "ajouter",
    libelle: "Broyage des branches",
    quantite: null,
    prixUnitaire: null,
  });
});

// ── Le prix accordé au client — sa demande du 16 août ───────────────────────

cas("« fais cinq pour cent » ne vise aucune ligne, et le dit", () => {
  const [r] = resoudreRetouches(DEVIS, [{ type: "reduction", pourcent: "5" }]);
  assert.equal(r.etat, "ok");
  assert.equal(r.ligne, null, "la réduction porte sur le devis entier, pas sur une ligne");
  const dit = direRetouche(r);
  assert.equal(dit.verbe, "Accorder");
  assert.match(dit.quoi, /Prix accordé au client 5 %/);
  assert.doesNotMatch(dit.quoi, /[Rr]éduction/, "c'est le mot qu'il a écarté le 16 août");
});

cas("« enlève la remise » se dit aussi, et repart du prix plein", () => {
  const [r] = resoudreRetouches(DEVIS, [{ type: "reduction", pourcent: null }]);
  const dit = direRetouche(r);
  assert.equal(dit.verbe, "Retirer");
  assert.match(dit.detail, /prix plein/);
  assert.deepEqual(changementApplicable(r), { type: "reduction", pourcent: null });
});

cas("le modèle sait rendre une réduction, et ses bornes sont celles du devis", () => {
  const r = lireRetouchesDuModele({
    retouches: [
      { type: "reduction", pourcent: "10" },
      { type: "reduction", pourcent: "150" },
      { type: "reduction", pourcent: null },
      { type: "reduction", pourcent: "beaucoup" },
      { type: "reduction" },
    ],
  });
  // 10 %, le 150 borné à 100, et le retrait explicite. « beaucoup » et l'absence
  // de champ ne sont pas des ordres : ils tombent.
  assert.deepEqual(r, [
    { type: "reduction", pourcent: "10" },
    { type: "reduction", pourcent: "100" },
    { type: "reduction", pourcent: null },
  ]);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
