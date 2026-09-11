// LES RÈGLES DE LA JOURNÉE — éprouvées sans base et sans navigateur.
//
// Tout ce qui suit vient de la planche 84 (`appli/planning-simple.html`), que
// le patron a essayée deux soirées durant avant de dire, le 21 août 2026 :
// *« code trait pour trait cette maquette »*. Les fonctions sont pures
// (`CLAUDE.md` §3) : le calendrier, la fiche du jour et la liste des planifiés
// les lisent toutes les trois, et c'est ce qui garantit qu'une couleur ne
// contredit pas le compte écrit juste à côté.
//
// **Ce que cette suite défend, et qui a déjà été payé :**
//   · un écran qui montrerait « rien » là où une équipe est absente ;
//   · un compte de journée écrit deux fois (sa correction du 21 août) ;
//   · le nom d'un chantier répété sous ses deux demi-journées ;
//   · une demi-journée libre qui passerait AVANT le nom du client ;
//   · « Journée » qui raccourcirait, en silence, un chantier de trois jours.

import assert from "node:assert/strict";
import {
  blocsDeLaJournee,
  departDuChantier,
  estUnDemiValide,
  ditLeCompteDemi,
  ditLeCompteDuJour,
  ditLeQuand,
  ditLaDuree,
  ditQuiPart,
  etatDemi,
  occupationDemi,
  partDeLaBarre,
  rangDeLaFiche,
  type Demi,
} from "../src/lib/planning-jour";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

const chantiers = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));

console.log("=== Les règles de la journée du planning ===\n");

// ─── LES QUATRE ÉTATS ──────────────────────────────────────────────────────
essai("rien, incomplet, complet, au-delà — dans cet ordre", () => {
  assert.equal(etatDemi(occupationDemi(chantiers(0), 2)), "libre");
  assert.equal(etatDemi(occupationDemi(chantiers(1), 2)), "dispo");
  assert.equal(etatDemi(occupationDemi(chantiers(2), 2)), "plein");
  assert.equal(etatDemi(occupationDemi(chantiers(3), 2)), "dela");
});

// **Sa question du 21 août : « comment tu vas faire s'il y a dix équipes ? »**
// Trois états ne tenaient pas — avec dix équipes, « il reste de la place »
// couvre une prise comme neuf. La barre se remplit donc à la PROPORTION.
essai("la barre se remplit à la proportion, jamais au-delà de 100 %", () => {
  assert.equal(partDeLaBarre(occupationDemi(chantiers(2), 10).charge), 20);
  assert.equal(partDeLaBarre(occupationDemi(chantiers(9), 10).charge), 90);
  assert.equal(partDeLaBarre(occupationDemi(chantiers(10), 10).charge), 100);
  assert.equal(partDeLaBarre(occupationDemi(chantiers(30), 10).charge), 100);
});

essai("aucune équipe déclarée ne rend jamais une charge infinie", () => {
  const o = occupationDemi(chantiers(1), 0);
  assert.equal(Number.isFinite(o.charge), true);
  assert.equal(etatDemi(o), "plein");
});

// **Une équipe absente retire de la place**, exactement comme un chantier en
// prend. L'ignorer ferait afficher au planning un jour libre que l'écran
// d'envoi refuse au client (`ARCHITECTURE.md` §109).
essai("une équipe absente occupe la demi-journée", () => {
  assert.equal(etatDemi(occupationDemi(chantiers(0), 2, 1)), "dispo");
  assert.equal(etatDemi(occupationDemi(chantiers(1), 2, 1)), "plein");
  assert.equal(etatDemi(occupationDemi(chantiers(0), 2, 0)), "libre");
});

// ─── CE QUI S'ÉCRIT ────────────────────────────────────────────────────────
essai("le pourcentage ne s'écrit QUE s'il dépasse", () => {
  assert.equal(ditLeCompteDemi(occupationDemi(chantiers(0), 2)), "libre");
  assert.equal(ditLeCompteDemi(occupationDemi(chantiers(1), 2)), "1 chantier");
  assert.equal(ditLeCompteDemi(occupationDemi(chantiers(2), 2)), "2 chantiers · complet");
  assert.equal(
    ditLeCompteDemi(occupationDemi(chantiers(3), 2)),
    "3 chantiers · 150 % de vos équipes"
  );
});

essai("le compte de la journée prend la demi-journée la plus chargée", () => {
  assert.equal(ditLeCompteDuJour(1, 0.5), "1 chantier");
  assert.equal(ditLeCompteDuJour(2, 1), "2 chantiers · complet");
  assert.equal(ditLeCompteDuJour(3, 1.5), "3 chantiers · 150 % de vos équipes");
  assert.equal(ditLeCompteDuJour(0, 0), "libre");
});

// **Au-delà de deux noms on compte**, sinon la ligne déborde sur un téléphone.
essai("la pastille compte au-delà de deux équipes", () => {
  // **« Qui ? » et non « Équipe ? » depuis le 26 août 2026** : ce qu'on coche
  // sur une demi-journée est devenu une personne, et il a demandé que le mot
  // « équipe » disparaisse de ce qui se coche.
  assert.equal(ditQuiPart([]), "Qui ?");
  assert.ok(!/[ÉE]quipe/i.test(ditQuiPart([])), "la pastille vide dit encore « équipe »");
  assert.equal(ditQuiPart(["Julien"]), "Julien");
  // **Une barre oblique, pas une virgule** — sa demande du 9 septembre 2026.
  assert.equal(ditQuiPart(["Julien", "Paul"]), "Julien / Paul");
  assert.ok(!ditQuiPart(["Julien", "Paul"]).includes(","), "la pastille énumère encore à la virgule");
  assert.equal(ditQuiPart(["Julien", "Paul", "Marc"]), "Julien +2");
});

// **« ½ journée » ne s'écrit plus** — sa remarque du 21 août : « il y a marqué
// matin, et à chaque fois demi-journée ». Un mot qui répète son voisin fait
// douter qu'il dise autre chose.
essai("un chantier se lit matin, après-midi, journée — ou en jours", () => {
  assert.equal(ditLeQuand("matin", 1), "matin");
  assert.equal(ditLeQuand("apres_midi", 1), "après-midi");
  assert.equal(ditLeQuand("matin", 2), "journée");
  assert.equal(ditLeQuand("matin", 6), "3 jours");
  assert.equal(ditLeQuand("apres_midi", 5), "3 jours");
});

// ─── « DÉPLACER » NE CHOISIT QU'UN DÉPART ────────────────────────────────
//
// **Sa décision du 10 septembre 2026 :** *« fais celui-là, juste tu retires la
// journée »*, après avoir essayé la planche `deplacer-plus-simple.html`.
//
// **Ce que ces contrôles remplacent, et pourquoi.** Ils défendaient un
// vocabulaire à TROIS mots — matin, après-midi, journée — dont le troisième ne
// décrivait pas un départ mais une ÉTENDUE. Il fallait donc une fonction pour
// traduire ces mots en départ ET durée (`departEtDuree`), une deuxième pour
// dire lequel décrivait un chantier donné (`quandDuChantier`), et une troisième
// pour retirer celui qui n'écrivait rien (`poseOfferte`). Les trois ont disparu
// avec le mot : un départ n'a que deux valeurs, celles que la base porte depuis
// la migration 0019.
essai("un chantier est décrit par son départ, quelle que soit sa durée", () => {
  assert.equal(departDuChantier({ creneauDebut: "matin" }), "matin");
  assert.equal(departDuChantier({ creneauDebut: "apres_midi" }), "apres_midi");
});

// **Un chantier posé avant la migration 0019 n'a pas de créneau** : il se lit
// comme partant du matin, jamais comme une valeur absente qui laisserait
// l'interrupteur sans position tenue.
essai("sans créneau écrit, le chantier part du matin", () => {
  assert.equal(departDuChantier({ creneauDebut: null }), "matin");
  assert.equal(departDuChantier({ creneauDebut: "n'importe quoi" }), "matin");
});

// **Et l'assistant ne peut plus dire « journee ».** Le mot valait une étendue :
// une dictée sans heure réservait la journée entière.
essai("seuls les deux départs de la base sont acceptés", () => {
  assert.ok(estUnDemiValide("matin"));
  assert.ok(estUnDemiValide("apres_midi"));
  assert.ok(!estUnDemiValide("journee"));
  assert.ok(!estUnDemiValide("apres"));
  assert.ok(!estUnDemiValide(""));
});

// ─── COMPTER LES ÉQUIPES, ET NON LES CHANTIERS ────────────────────────────
//
// **Sa question du 22 août 2026 :** *« pourquoi le matin et l'après-midi de
// monsieur Eric s'affichent en incomplet ? »* — Julien ET Antoine y étaient, et
// la charge comptait les CHANTIERS : 1 ÷ 2 = la moitié. Ce jour-là partait donc
// chez ses clients alors qu'il n'avait plus personne à envoyer.
//
// **Sa règle, après la planche 89 :** *« oui si c'est des journées complètes,
// non si c'est des demi-journées »*.
essai("deux équipes sur un chantier remplissent la demi-journée", () => {
  const o = occupationDemi(["eric"], 2, 0, () => 2);
  assert.equal(o.charge, 1);
  assert.equal(etatDemi(o), "plein");
});

essai("une seule équipe sur deux laisse la demi-journée ouverte", () => {
  const o = occupationDemi(["eric"], 2, 0, () => 1);
  assert.equal(o.charge, 0.5);
  assert.equal(etatDemi(o), "dispo");
});

// **Un chantier sans équipe cochée vaut UNE équipe, jamais zéro.** La plupart
// des chantiers n'en portent aucune — l'affectation par demi-journée ne date que
// du 21 août. Les compter zéro viderait le planning d'un coup.
essai("un chantier sans équipe cochée prend quand même une place", () => {
  assert.equal(occupationDemi(["x"], 2, 0, () => 0).charge, 0.5);
  assert.equal(occupationDemi(["x"], 2).charge, 0.5);
});

// **Le dépassement se voit toujours.** Trois équipes mobilisées pour deux, c'est
// « au-delà » : il ne s'interdit rien, mais il le voit (sa décision du 21 août).
essai("plus d'équipes mobilisées que d'équipes se dit « au-delà »", () => {
  const o = occupationDemi(["a", "b"], 2, 0, () => 2);
  assert.equal(o.charge, 2);
  assert.equal(etatDemi(o), "dela");
});

// **LA DURÉE, ET NON LE MOMENT** — sa demande du 22 août 2026, retenue sur la
// planche 86 : *« à la place de "matin", je pense qu'il doit y avoir écrit la
// durée du chantier [...] parce que ce n'est pas clair quand il y a marqué le
// matin et l'après-midi »*.
essai("un chantier annonce le temps qu'il prend, pas l'heure où il commence", () => {
  assert.equal(ditLaDuree(1), "une demi-journée");
  assert.equal(ditLaDuree(2), "une journée");
  assert.equal(ditLaDuree(4), "2 jours");
  assert.equal(ditLaDuree(6), "3 jours");
});

// **Trois demi-journées ne s'arrondissent NI en haut NI en bas.** Arrondir à
// deux jours réserverait une journée qu'il n'a pas vendue ; arrondir à une la
// lui ferait perdre. Ce cas-là est le seul que la formule en jours ne sait pas
// dire toute seule, et c'est pourquoi il a sa ligne.
essai("une journée et demie s'écrit comme telle", () => {
  assert.equal(ditLaDuree(3), "une journée et demie");
});

// **Le libellé ne compte JAMAIS ce qui est visible ce jour-là.** Un chantier de
// trois jours n'occupe que deux demi-journées sur la journée qu'on regarde :
// s'il comptait celles-là, il annoncerait « une journée » — le malentendu même
// qu'il demande de faire disparaître. La première version de la planche 86 est
// tombée dedans, et le chiffre était juste par ailleurs.
essai("un chantier de trois jours n'annonce pas « une journée »", () => {
  assert.notEqual(ditLaDuree(6), "une journée");
  assert.equal(ditLaDuree(6), "3 jours");
});

// ─── L'ORDRE DES BLOCS — deux de ses corrections du 21 août ────────────────
type Faux = { id: string; demis: Demi[] };
const occupePar = (c: Faux, d: Demi) => c.demis.includes(d);

essai("un chantier à la journée n'apparaît QU'UNE fois", () => {
  const leroy: Faux = { id: "leroy", demis: ["matin", "apres_midi"] };
  const blocs = blocsDeLaJournee([leroy], occupePar);
  assert.equal(blocs.length, 1, "le chantier est écrit deux fois");
  assert.equal(blocs[0].type, "chantier");
  assert.deepEqual(
    blocs[0].type === "chantier" ? blocs[0].demis : [],
    ["matin", "apres_midi"],
    "les deux demi-journées ne sont pas sous le même nom"
  );
});

// **CE CONTRÔLE DÉFENDAIT L'INVERSE, ET C'EST LUI QUI L'A RETOURNÉ.** Il fixait
// sa règle du 21 août 2026 — *« le nom toujours en premier ! »* —, donc qu'un
// chantier de l'après-midi ouvre la fiche AVANT le matin resté libre. Personne
// n'avait vu ce que cela produisait : les deux moitiés du jour échangeaient
// leur place selon l'heure du chantier, et l'appui sur « Matin » les faisait
// sauter. Sa décision du 10 septembre : *« oui, matin puis aprèm »*.
essai("le nom reste en tête, et la journée garde son ordre", () => {
  const rocher: Faux = { id: "rocher", demis: ["apres_midi"] };
  const blocs = blocsDeLaJournee([rocher], occupePar);
  // Le nom ouvre la fiche — sa règle du 21 août, qu'il a maintenue le
  // 10 septembre : *« le nom doit rester en premier »*.
  assert.equal(blocs.length, 1, "le matin libre a été émis comme un bloc à part");
  assert.equal(blocs[0].type, "chantier");
  // …et le matin se lit SOUS son nom, avant l'après-midi qu'il occupe.
  assert.deepEqual(blocs[0].type === "chantier" ? blocs[0].libresAvant : null, ["matin"]);

  // Un chantier du matin, lui, n'a rien avant lui : l'après-midi libre reste
  // une ligne à part, après.
  const leroy: Faux = { id: "leroy", demis: ["matin"] };
  const matin = blocsDeLaJournee([leroy], occupePar);
  assert.equal(matin[0].type, "chantier");
  assert.deepEqual(matin[0].type === "chantier" ? matin[0].libresAvant : null, []);
  assert.equal(matin[1].type === "libre" ? matin[1].demi : null, "apres_midi");
});

essai("deux chantiers différents gardent chacun leur nom", () => {
  const a: Faux = { id: "a", demis: ["apres_midi"] };
  const b: Faux = { id: "b", demis: ["apres_midi"] };
  const blocs = blocsDeLaJournee([a, b], occupePar);
  assert.equal(blocs.filter((x) => x.type === "chantier").length, 2);
  // Le matin reste annoncé libre — sous le nom du PREMIER des deux, et pas du
  // second : il ne s'écrit qu'une fois.
  assert.deepEqual(blocs[0].type === "chantier" ? blocs[0].libresAvant : null, ["matin"]);
  assert.deepEqual(blocs[1].type === "chantier" ? blocs[1].libresAvant : null, []);
});

essai("une journée vide annonce ses deux demi-journées, dans l'ordre", () => {
  const blocs = blocsDeLaJournee<Faux>([], occupePar);
  assert.deepEqual(
    blocs.map((b) => (b.type === "libre" ? b.demi : b.type)),
    ["matin", "apres_midi"]
  );
});

essai("le chantier du matin passe avant celui de l'après-midi", () => {
  const aprem: Faux = { id: "aprem", demis: ["apres_midi"] };
  const matin: Faux = { id: "matin", demis: ["matin"] };
  const blocs = blocsDeLaJournee([aprem, matin], occupePar);
  assert.equal(blocs[0].type === "chantier" ? blocs[0].chantier.id : null, "matin");
  assert.equal(blocs[1].type === "chantier" ? blocs[1].chantier.id : null, "aprem");
});

// ─── OÙ SE COLLE LA FICHE D'INTERVENTION ───────────────────────────────────
//
// **Sa correction du 10 septembre 2026**, capture à l'appui : *« quand il y a
// plusieurs chantiers le même jour on a un problème ! Quand je clique sur sa
// fiche d'intervention, ça doit se coller en dessous, pas en dessous de
// Frédéric, ça porte à confusion. »*
//
// Le défaut ne se voyait qu'à DEUX chantiers dans la même journée — un cas
// qu'aucune capture ni aucune suite ne montrait. Il tient en une ligne ici.
essai("la fiche se colle sous SON chantier, pas sous le dernier du jour", () => {
  const julien: Faux = { id: "julien", demis: ["matin", "apres_midi"] };
  const frederic: Faux = { id: "frederic", demis: ["matin", "apres_midi"] };
  const blocs = blocsDeLaJournee([julien, frederic], occupePar);
  assert.equal(rangDeLaFiche(blocs, "julien"), 0, "elle est passée sous Frédéric");
  assert.equal(rangDeLaFiche(blocs, "frederic"), 1);
});

// **Sa correction du 22 août 2026 :** *« l'après-midi de libre passe sous la
// feuille de chantier, or il doit rester en dessous du matin même s'il est
// libre »*. Une moitié libre appartient à la journée, pas au chantier.
essai("sous le dernier chantier, elle repasse après les moitiés libres", () => {
  const matin: Faux = { id: "matin", demis: ["matin"] };
  const blocs = blocsDeLaJournee([matin], occupePar);
  assert.deepEqual(
    blocs.map((b) => (b.type === "libre" ? b.demi : b.chantier.id)),
    ["matin", "apres_midi"]
  );
  assert.equal(rangDeLaFiche(blocs, "matin"), 1, "l'après-midi libre est retombé sous la fiche");
});

// Les deux règles se croisent ici, et c'est le seul cas où elles pourraient se
// contredire : un premier chantier ouvert, un second, puis rien de libre.
essai("le premier de deux garde sa place quand le jour est plein", () => {
  const matin: Faux = { id: "matin", demis: ["matin"] };
  const aprem: Faux = { id: "aprem", demis: ["apres_midi"] };
  const blocs = blocsDeLaJournee([matin, aprem], occupePar);
  assert.equal(rangDeLaFiche(blocs, "matin"), 0);
  assert.equal(rangDeLaFiche(blocs, "aprem"), 1);
});

essai("aucune fiche ouverte : aucun rang", () => {
  const a: Faux = { id: "a", demis: ["matin"] };
  assert.equal(rangDeLaFiche(blocsDeLaJournee([a], occupePar), null), -1);
});

// Un chantier du jour qui n'occupe aucune demi-journée n'a pas de bloc : la
// fiche garde la queue plutôt que de disparaître sans un mot.
essai("un chantier sans demi-journée laisse la fiche en queue", () => {
  const a: Faux = { id: "a", demis: ["matin"] };
  const blocs = blocsDeLaJournee([a], occupePar);
  assert.equal(rangDeLaFiche(blocs, "fantome"), blocs.length - 1);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Règles de la journée — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
