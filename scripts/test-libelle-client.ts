import assert from "node:assert/strict";
import { libelleClient } from "../src/lib/libelle-client";
import { lignesVendables } from "../src/lib/lignes-vendables";

// **CE QUE LE CLIENT DOIT LIRE — sa demande du 30 août 2026, deux fois.**
//
// D'abord : *« les caractéristiques techniques ne doivent PAS être répétées
// dans la description visible du devis client. »* Ensuite, le même jour, en
// regardant le résultat : *« les tirets ne doivent pas servir à assembler
// artificiellement plusieurs morceaux d'un libellé client. Construis une vraie
// formulation française naturelle. »*
//
// Les quatre lignes attendues, telles qu'il les a écrites :
//
//   Démontage en rétention d'un érable     Qté 1
//   Évacuation des déchets verts
//   Taille de haie de laurier              Qté 800   ml
//   Dessouchage de souches de 60 cm        Qté 2     souche
//   Tonte de la pelouse                    Qté 1200  m²
//
// **Le contrôle qui compte le plus n'est pas la rédaction, c'est le REFUS de
// rédiger** : ce que le produit ne sait pas nommer garde son texte, parce
// qu'inventer une tournure produirait du français faux sur un devis.

let reussites = 0;
let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
    reussites++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("\n=== Ses quatre lignes, rédigées en français ===\n");

cas("l'érable : la technique vient de la colonne, l'espèce suit", () => {
  // Son vrai libellé du 30 août : la méthode n'est PAS dans le texte, elle est
  // en colonne. C'est elle qui nomme le travail.
  //
  // **« en rétention », pas « avec »** : sa demande du 30 août d'harmoniser la
  // formulation visible. Le catalogue de sa grille garde « avec rétention »
  // pour ses écrans de réglage — les deux écritures vivent côte à côte dans
  // `libelle-client.ts`, pour qu'elles ne puissent pas dériver.
  assert.equal(
    libelleClient({
      libelle: "Érable (40 cm de diamètre, 12 m de haut)",
      nature: "abattage",
      espece: "érable",
      methode: "demontage_retention",
      caracteristiques: { diametreCm: 40, hauteurM: 12 },
    }),
    "Démontage en rétention d'un érable"
  );
});

cas("l'érable, quand SA dictée porte déjà la technique : ce sont SES mots", () => {
  // Le texte gagne quand il parle — on ne réécrit pas ses mots avec les nôtres,
  // et l'on n'ajoute pas une seconde fois une technique déjà dite.
  assert.equal(
    libelleClient({
      libelle: "Érable — démontage en rétention",
      nature: "abattage",
      espece: "érable",
      methode: "demontage_retention",
      caracteristiques: { diametreCm: 40, hauteurM: 12 },
    }),
    "Démontage en rétention d'un érable"
  );
});

cas("l'évacuation ne bouge pas", () => {
  assert.equal(
    libelleClient({ libelle: "Évacuation des déchets verts", nature: "evacuation" }),
    "Évacuation des déchets verts"
  );
});

cas("la haie : le travail se nomme, la mesure part", () => {
  assert.equal(
    libelleClient({
      libelle: "Haie de laurier (800 ml) (800 ml)",
      nature: "haie",
      espece: "laurier",
      quantite: "800.00",
      unite: "ml",
      caracteristiques: { longueurMl: 800 },
    }),
    "Taille de haie de laurier"
  );
});

cas("le dessouchage : la quantité part, le diamètre RESTE", () => {
  // Sa demande est explicite sur cette ligne : « Dessouchage de souches de
  // 60 cm ». Le 60 cm dit QUELLES souches ; le « deux » a sa colonne.
  // **Le ⌀ y compris ici — sa règle du 7 septembre 2026.**
  //
  // *« Lorsque l'on parle de diamètre, mets le signe. D'ailleurs quand on dit
  // souche de 60, ou 60 au pied, on parle de diamètre en réalité. »*
  //
  // J'avais laissé cette ligne sans signe et le lui ai dit, en pensant que
  // « de souches de ⌀ 60 cm » se lirait mal. Il a tranché l'inverse, et sa
  // raison est la bonne : ce 60 EST un diamètre, et rien ne le disait.
  assert.equal(
    libelleClient({
      libelle: "Dessouchage — deux souches de 60 cm (2 souche)",
      nature: "dessouchage",
      quantite: "2.00",
      unite: "souche",
      caracteristiques: { diametreCm: 60 },
    }),
    "Dessouchage de souches de ⌀ 60 cm"
  );
});

cas("la tonte : les deux écritures de la mesure partent", () => {
  // L'espace insécable du premier groupe est celui du modèle ; le second sort
  // d'une colonne. Les deux doivent partir.
  assert.equal(
    libelleClient({
      libelle: "Tonte de la pelouse (1 200 m²) (1200 m²)",
      nature: "tonte",
      quantite: "1200.00",
      unite: "m²",
      caracteristiques: {},
    }),
    "Tonte de la pelouse"
  );
});

console.log("\n=== AUCUN tiret d'assemblage ne survit ===\n");

cas("les quatre libellés produits ne portent aucun tiret", () => {
  const produits = [
    libelleClient({
      libelle: "Érable (40 cm de diamètre, 12 m de haut)",
      nature: "abattage", espece: "érable", methode: "demontage_retention",
      caracteristiques: { diametreCm: 40, hauteurM: 12 },
    }),
    libelleClient({
      libelle: "Haie de laurier (800 ml) (800 ml)",
      nature: "haie", espece: "laurier", quantite: "800.00", unite: "ml",
      caracteristiques: { longueurMl: 800 },
    }),
    libelleClient({
      libelle: "Dessouchage — deux souches de 60 cm (2 souche)",
      nature: "dessouchage", quantite: "2.00", unite: "souche",
      caracteristiques: { diametreCm: 60 },
    }),
    libelleClient({
      libelle: "Tonte de la pelouse (1 200 m²) (1200 m²)",
      nature: "tonte", quantite: "1200.00", unite: "m²",
    }),
  ];
  for (const l of produits) {
    assert.ok(!/[—–]/.test(l), `« ${l} » porte encore un tiret d'assemblage`);
  }
});

cas("aucune quantité ne se répète dans la description", () => {
  // Elles ont leur colonne : les réécrire dans le texte, c'est le défaut qu'il
  // a signalé en premier.
  const haie = libelleClient({
    libelle: "Haie de laurier (800 ml)", nature: "haie", espece: "laurier",
    quantite: "800.00", unite: "ml", caracteristiques: { longueurMl: 800 },
  });
  assert.ok(!/800/.test(haie), `« ${haie} » répète la quantité`);
  const tonte = libelleClient({
    libelle: "Tonte de la pelouse (1200 m²)", nature: "tonte",
    quantite: "1200.00", unite: "m²",
  });
  assert.ok(!/1\s?200/.test(tonte), `« ${tonte} » répète la quantité`);
});

cas("le diamètre et la hauteur de l'érable ne sont PAS sur le devis", () => {
  const l = libelleClient({
    libelle: "Érable (40 cm de diamètre, 12 m de haut)",
    nature: "abattage", espece: "érable", methode: "demontage_retention",
    caracteristiques: { diametreCm: 40, hauteurM: 12 },
  });
  assert.ok(!/40|12\s*m/.test(l), `« ${l} » montre une mesure technique`);
});

console.log("\n=== Ce qu'on REFUSE de rédiger ou de retirer ===\n");

cas("ni la tête ni le complément ne sont un geste connu : le texte reste", () => {
  // Inventer « Bassin de pose » ou « Pose d'un bassin » sur un travail que le
  // produit ne sait pas nommer, c'est écrire du français au hasard sur un
  // devis. Le tiret est laid, mais il se voit — donc il se corrige.
  assert.equal(
    libelleClient({
      libelle: "Bassin — pose et raccordement",
      quantite: "1.00",
      unite: "u",
    }),
    "Bassin — pose et raccordement"
  );
});

cas("une mesure que les colonnes NE portent PAS reste écrite", () => {
  assert.equal(
    libelleClient({ libelle: "Haie de laurier (800 ml)", quantite: null, unite: null }),
    "Haie de laurier (800 ml)"
  );
});

cas("une valeur DIFFÉRENTE de la colonne n'est pas retirée", () => {
  // La colonne dit 80, le texte dit 800 : `mesures-prestation.ts` refuse de
  // trancher, et ce n'est pas à l'affichage de le faire. Effacer le texte
  // ferait disparaître la contradiction sans la résoudre.
  const l = libelleClient({
    libelle: "Haie de laurier (800 ml)",
    nature: "haie",
    quantite: "80.00",
    unite: "ml",
    caracteristiques: { longueurMl: 80 },
  });
  assert.ok(l.includes("800 ml"), `« ${l} » a effacé une contradiction`);
});

console.log("\n=== La compatibilité : rien d'ancien n'est réinterprété ===\n");

cas("une prestation d'avant, sans aucune colonne, garde son texte entier", () => {
  for (const ancien of [
    "Abattage d'un chêne — ⌀ 45 cm, 18 m de haut",
    "Haie (tout genre) (800 ml)",
    "Élagage du tilleul",
  ]) {
    assert.equal(
      libelleClient({ libelle: ancien }),
      ancien,
      `« ${ancien} » ne doit pas bouger sans colonnes`
    );
  }
});

cas("un libellé qui ne dirait QUE sa mesure n'est jamais vidé", () => {
  assert.equal(
    libelleClient({ libelle: "(800 ml)", quantite: "800.00", unite: "ml" }),
    "(800 ml)"
  );
});

cas("un libellé vide reste vide, sans planter", () => {
  assert.equal(libelleClient({ libelle: "   ", quantite: "800.00", unite: "ml" }), "");
});

cas("« Abattage » ne remplace pas « Démontage » — le libellé s'ouvre déjà sur un geste", () => {
  // La substitution ne vise QUE les libellés qui s'ouvrent sur leur objet
  // (« Haie de laurier »). Un texte qui nomme déjà un geste garde ses mots.
  assert.equal(
    libelleClient({
      libelle: "Démontage du grand chêne",
      nature: "abattage",
      caracteristiques: { diametreCm: 45 },
    }),
    "Démontage du grand chêne"
  );
});

console.log("\n=== ROBUSTESSE : la nature structurée, et l'article qui ne se devine pas ===\n");

cas("« Taille de haie » vient de la COLONNE nature, pas d'une ressemblance", () => {
  // Sa consigne du 30 août : la substitution doit venir de la nature
  // structurée. Même texte, nature absente : rien ne se substitue.
  assert.equal(
    libelleClient({
      libelle: "Haie de laurier (800 ml)",
      nature: "haie",
      quantite: "800.00", unite: "ml", caracteristiques: { longueurMl: 800 },
    }),
    "Taille de haie de laurier"
  );
  assert.equal(
    libelleClient({
      libelle: "Haie de laurier (800 ml)",
      nature: null,
      quantite: "800.00", unite: "ml", caracteristiques: { longueurMl: 800 },
    }),
    "Haie de laurier",
    "sans nature en colonne, on ne nomme pas le travail à la place du texte"
  );
});

cas("une nature dont l'objet n'est pas déclaré ne substitue rien", () => {
  // `tonte` n'a pas d'`objet` : « Tonte de la pelouse » ne devient pas autre
  // chose, et une nature ajoutée demain sans objet ne produira pas de phrase
  // fausse par accident.
  assert.equal(
    libelleClient({
      libelle: "Pelouse du fond", nature: "tonte",
      quantite: "300.00", unite: "m²",
    }),
    "Pelouse du fond"
  );
});

cas("les grumes : l'objet déclaré vaut aussi pour elles", () => {
  assert.equal(
    libelleClient({
      libelle: "Grumes de chêne", nature: "grumes",
      quantite: "6.00", unite: "tonne", caracteristiques: { tonnageT: 6 },
    }),
    "Enlèvement des grumes de chêne"
  );
});

cas("une espèce ABSENTE de la liste des genres n'est jamais mal accordée", () => {
  // **Le point qu'il a relevé.** « d'un » par défaut aurait écrit « d'un
  // aubépine ». La tournure sans article est correcte dans les deux genres —
  // c'est celle de « Taille de haie DE LAURIER », qu'il a validée.
  const inconnues: [string, string][] = [
    ["Sophora", "Démontage en rétention de sophora"],
    ["Ostrya", "Démontage en rétention d'ostrya"],
    ["Zelkova", "Démontage en rétention de zelkova"],
  ];
  for (const [espece, attendu] of inconnues) {
    assert.equal(
      libelleClient({ libelle: espece, nature: "abattage", methode: "demontage_retention",
        caracteristiques: { diametreCm: 40 } }),
      attendu,
      `« ${espece} » ne doit pas recevoir d'article deviné`
    );
  }
});

cas("un mot féminin connu reçoit « d'une », un masculin « d'un »", () => {
  assert.equal(
    libelleClient({ libelle: "Aubépine", nature: "abattage", methode: "demontage_retention",
      caracteristiques: { diametreCm: 20 } }),
    "Démontage en rétention d'une aubépine"
  );
  assert.equal(
    libelleClient({ libelle: "Chêne", nature: "abattage", methode: "demontage_retention",
      caracteristiques: { diametreCm: 70 } }),
    "Démontage en rétention d'un chêne"
  );
});

cas("aucun libellé produit ne porte « d'un » devant un mot féminin connu", () => {
  const l = libelleClient({ libelle: "Haie — abattage", nature: "haie",
    quantite: "50.00", unite: "ml", caracteristiques: { longueurMl: 50 } });
  assert.ok(!/d'un haie/i.test(l), `« ${l} » accorde mal`);
});

console.log("\n=== Sur la ligne de devis : le client lit propre, le moteur lit brut ===\n");

cas("la ligne vendable rédige son libellé et GARDE ses membres bruts", () => {
  // **C'est l'invariant qui protège le prix.** `mesuresResolues` relit
  // `membres` quand les colonnes ne suffisent pas ; les nettoyer ferait perdre
  // à la haie sa longueur, donc son prix au mètre linéaire.
  const { lignes } = lignesVendables([
    {
      id: "p1",
      libelle: "Haie de laurier (800 ml) (800 ml)",
      nature: "haie",
      espece: "laurier",
      quantite: "800.00",
      unite: "ml",
      caracteristiques: { longueurMl: 800 },
    },
  ]);
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].libelle, "Taille de haie de laurier", "ce que le client lit");
  assert.equal(
    lignes[0].membres[0],
    "Haie de laurier (800 ml) (800 ml)",
    "ce que les moteurs relisent — INTACT"
  );
});

cas("l'abattage et son évacuation : une ligne, deux descriptions rédigées", () => {
  const { lignes } = lignesVendables([
    {
      id: "p1",
      libelle: "Érable (40 cm de diamètre, 12 m de haut)",
      nature: "abattage",
      espece: "érable",
      methode: "demontage_retention",
      caracteristiques: { diametreCm: 40, hauteurM: 12 },
    },
    { id: "p2", libelle: "Évacuation des déchets verts", nature: "evacuation" },
  ]);
  const principale = lignes.find((l) => l.cle === "abattage");
  assert.ok(principale, "la ligne d'abattage doit exister");
  assert.equal(
    principale.libelle,
    "Démontage en rétention d'un érable\nÉvacuation des déchets verts"
  );
});

cas("le regroupement ne change pas — la rédaction ne touche QUE le texte", () => {
  const { lignes } = lignesVendables([
    {
      id: "p1", libelle: "Érable (40 cm de diamètre)", nature: "abattage",
      espece: "érable", methode: "demontage_retention", caracteristiques: { diametreCm: 40 },
    },
    {
      id: "p2", libelle: "Tonte de la pelouse (1200 m²)", nature: "tonte",
      quantite: "1200.00", unite: "m²",
    },
  ]);
  assert.equal(lignes.length, 2, "la tonte ne rejoint pas l'abattage");
  assert.equal(lignes.find((l) => l.cle === "tonte")?.libelle, "Tonte de la pelouse");
});

console.log("" + String.fromCharCode(10) + "=== La quantité n'est JAMAIS dans le libellé (7 septembre 2026) ===");

// **Sa règle, en colère :** *« il met entre parenthèses (1 arbre), ça il ne
// doit jamais le faire, la quantité (Qté) est là pour ça !!! »*
//
// Ce qu'il a lu : « Démontage d'un chêne mort (1 arbre) de ⌀ 60 cm ».
//
// La règle existait, et ne regardait que la FIN du libellé. Une parenthèse
// posée au milieu passait sans être vue.
cas("SON cas : « (1 arbre) » au MILIEU du libellé s'en va aussi", () => {
  assert.equal(
    libelleClient({
      libelle: "Démontage d'un chêne mort (1 arbre) — ⌀ 60 cm",
      quantite: "1",
      unite: "arbre",
      nature: "abattage",
      caracteristiques: { diametreCm: 60 },
    }),
    "Démontage d'un chêne mort"
  );
});

// **La borne : une parenthèse qui apprend quelque chose reste.** Et elle ne
// doit pas empêcher d'examiner celles qui suivent — c'est ce que la première
// version de la boucle faisait, en s'arrêtant à la première rencontrée.
cas("une parenthèse qui dit autre chose reste, et la suivante part quand même", () => {
  assert.equal(
    libelleClient({
      libelle: "Taille (haie mixte) (800 ml)",
      quantite: "800",
      unite: "ml",
      nature: "haie",
      caracteristiques: {},
    }),
    "Taille (haie mixte)"
  );
});

console.log("" + String.fromCharCode(10) + "=== Un fragment de MESURES s'en va en entier (7 septembre 2026) ===");

// **Ce qu'il a lu sur son devis, et le mot qui manquait était SA réponse.**
//
//   « Fente du gros bois de m de haut, ⌀ 80 cm »
//
// Il avait bien saisi 20 m. Le nettoyage a retiré le « 20 » — la colonne le
// portait — et gardé la phrase autour de lui. Un libellé amputé part chez le
// client tel quel, et celui-là annonce en plus une hauteur que la fente ne
// devrait même pas porter : « la hauteur, c'est pour un arbre ».
cas("un fragment qui ne dit QUE les mesures disparaît, il ne s'ampute pas", () => {
  assert.equal(
    libelleClient({
      libelle: "Fente du gros bois — 20 m de haut, ⌀ 80 cm",
      quantite: "1",
      unite: null,
      nature: "fendage",
      caracteristiques: { hauteurM: 20, diametreCm: 80 },
    }),
    "Fente du gros bois"
  );
});

// **La borne : un fragment qui apprend quelque chose reste entier.** C'est ce
// qui distingue cette règle d'un « retire tout après le tiret » — la technique
// ne se lit nulle part ailleurs, et la perdre priverait le client de ce qu'on
// lui facture.
cas("mais un fragment qui apprend quelque chose n'est pas touché", () => {
  assert.equal(
    libelleClient({
      libelle: "Érable — démontage en rétention",
      quantite: "1",
      unite: null,
      nature: "abattage",
      caracteristiques: { diametreCm: 40 },
    }),
    "Démontage en rétention d'un érable"
  );
});

console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
if (echecs > 0) process.exitCode = 1;
