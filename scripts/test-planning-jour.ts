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
  departEtDuree,
  ditLeCompteDemi,
  ditLeCompteDuJour,
  ditLeQuand,
  ditLaDuree,
  ditLesEquipes,
  etatDemi,
  occupationDemi,
  partDeLaBarre,
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
  assert.equal(ditLesEquipes([]), "Équipe ?");
  assert.equal(ditLesEquipes(["Julien"]), "Julien");
  assert.equal(ditLesEquipes(["Julien", "Paul"]), "Julien, Paul");
  assert.equal(ditLesEquipes(["Julien", "Paul", "Marc"]), "Julien +2");
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

essai("le nom passe AVANT la demi-journée restée libre", () => {
  const rocher: Faux = { id: "rocher", demis: ["apres_midi"] };
  const blocs = blocsDeLaJournee([rocher], occupePar);
  assert.equal(blocs[0].type, "chantier", "« libre » ouvre la fiche");
  assert.equal(blocs[1].type, "libre");
  assert.equal(blocs[1].type === "libre" ? blocs[1].demi : null, "matin");
});

essai("deux chantiers différents gardent chacun leur nom", () => {
  const a: Faux = { id: "a", demis: ["apres_midi"] };
  const b: Faux = { id: "b", demis: ["apres_midi"] };
  const blocs = blocsDeLaJournee([a, b], occupePar);
  assert.equal(blocs.filter((x) => x.type === "chantier").length, 2);
  assert.equal(blocs[2].type, "libre", "le matin libre n'est plus annoncé");
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

// ─── DÉPLACER ──────────────────────────────────────────────────────────────
essai("« Déplacer » écrit le bon départ et la bonne durée", () => {
  assert.deepEqual(departEtDuree("matin", 1), { moment: "matin", duree: 1 });
  assert.deepEqual(departEtDuree("apres", 1), { moment: "apres_midi", duree: 1 });
  assert.deepEqual(departEtDuree("journee", 1), { moment: "matin", duree: 2 });
  assert.deepEqual(departEtDuree("journee", 2), { moment: "matin", duree: 2 });
});

// **Un chantier plus long qu'une journée garde sa durée.** « Journée » sur un
// chantier de trois jours le raccourcirait à deux demi-journées, sans qu'un mot
// le dise : le patron perdrait deux jours de travail en silence.
essai("un chantier de trois jours n'est jamais raccourci", () => {
  assert.deepEqual(departEtDuree("journee", 6), { moment: "matin", duree: 6 });
  assert.deepEqual(departEtDuree("matin", 6), { moment: "matin", duree: 6 });
  assert.deepEqual(departEtDuree("apres", 6), { moment: "apres_midi", duree: 6 });
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Règles de la journée — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
