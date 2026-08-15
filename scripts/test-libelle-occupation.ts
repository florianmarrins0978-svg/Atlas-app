import assert from "node:assert/strict";
import { libelleOccupation, libelleDureeCourt, type JourIso } from "../src/server/disponibilites";
import { DUREES } from "../src/lib/durees-chantier";

// Ce qu'un chantier OCCUPE, dit en toutes lettres.
//
// **LE DÉFAUT QUE CETTE SUITE EMPÊCHE DE REVENIR.** La ligne du planning
// écrivait la demi-journée de DÉPART. Comme un chantier posé dure une journée
// entière par défaut, le cas le plus courant du produit annonçait « matin »
// pour une journée pleine — et un chantier de trois jours l'annonçait aussi.
// Le patron, capture à l'appui le 13 août 2026 : « ça laisse à penser que juste
// le matin est bloqué alors que c'est la journée ».
//
// Rien de tout cela ne se voit sur une suite navigateur : l'écran affichait un
// mot parfaitement plausible. C'est en le comparant à la durée qu'il ment.
//
// **CE QUI A CHANGÉ LE 15 AOÛT 2026, ET POURQUOI CETTE SUITE A ÉTÉ RÉÉCRITE.**
// Le patron, sur `docs/maquettes/55-la-ligne-qui-dit-tout.html` : « je veux
// journée et toute la ligne », après « il doit y avoir le nombre de jour, le
// matin, l'après-midi et la journée comme infos possible ». Le moment de départ
// revient donc sur la ligne — mais JAMAIS SEUL : accolé à la durée, il ne dit
// plus ce qui est bloqué mais quand ça part. C'est cet accolement qui répare le
// défaut du 13 août, et c'est lui que la suite garde désormais.
//
// Les repères de dates, tous vérifiés :
//   ven. 14 août 2026 · lun. 17 · jeu. 20 · ven. 21 · lun. 24 · mar. 25

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

const j = (s: string) => s as JourIso;

console.log("=== Ce que le chantier occupe, et non son heure de départ ===\n");

// ── Le cas qui a motivé tout le lot ─────────────────────────────────────────
cas("une journée entière dit « journée », JAMAIS « matin »", () => {
  const o = libelleOccupation(j("2026-08-14"), "matin", 2);
  assert.equal(o.texte, "journée");
});

cas("une vraie demi-journée dit son moment ET sa durée", () => {
  assert.equal(libelleOccupation(j("2026-08-17"), "matin", 1).texte, "matin · ½ journée");
  assert.equal(libelleOccupation(j("2026-08-20"), "apres_midi", 1).texte, "après-midi · ½ journée");
});

// ── Plusieurs jours : les mots qu'il a arrêtés le 15 août 2026 ──────────────
cas("trois jours partis un vendredi disent « matin · 3 jours »", () => {
  assert.equal(libelleOccupation(j("2026-08-21"), "matin", 6).texte, "matin · 3 jours");
});

// **LE PIÈGE QUE PERSONNE NE VOIT VENIR.** Deux demi-journées à partir de
// l'APRÈS-MIDI, ce n'est pas une journée : c'est cet après-midi-là plus le
// matin suivant. « journée » serait faux, et l'artisan croirait sa matinée du
// lendemain libre.
cas("deux demi-journées parties l'après-midi ne sont PAS une « journée »", () => {
  const o = libelleOccupation(j("2026-08-17"), "apres_midi", 2);
  assert.notEqual(o.texte, "journée");
  assert.equal(o.texte, "après-midi · 1 journée");
});

cas("une journée et demie partie l'après-midi garde sa durée impaire", () => {
  assert.equal(libelleOccupation(j("2026-08-24"), "apres_midi", 3).texte, "après-midi · 1 journée ½");
});

// ── L'INVARIANT, et c'est le cœur de cette suite ────────────────────────────
//
// « matin » ou « après-midi » écrits SEULS, c'est exactement le défaut du
// 13 août qui revient. Ce contrôle balaie toutes les durées jusqu'à la borne de
// la liste plutôt que trois cas choisis : un alignement d'écriture qui
// oublierait la durée sur une seule valeur passerait entre trois cas, jamais
// entre deux cents.
cas("aucun moment n'est JAMAIS écrit sans sa durée — sur toutes les durées", () => {
  for (const depart of ["matin", "apres_midi"] as const) {
    for (let duree = 1; duree <= 200; duree++) {
      const { texte } = libelleOccupation(j("2026-08-14"), depart, duree);
      if (texte === "journée") continue; // le seul mot qui porte sa durée
      assert.match(
        texte,
        /^(matin|après-midi) · .+$/,
        `départ ${depart}, durée ${duree} : « ${texte} » — un moment sans durée redit le défaut du 13 août`
      );
    }
  }
});

cas("« journée » n'est employé QUE pour une journée pleine partie le matin", () => {
  for (const depart of ["matin", "apres_midi"] as const) {
    for (let duree = 1; duree <= 200; duree++) {
      const pleine = libelleOccupation(j("2026-08-14"), depart, duree).texte === "journée";
      assert.equal(
        pleine,
        depart === "matin" && duree === 2,
        `départ ${depart}, durée ${duree} : « journée » est ${pleine ? "écrit" : "absent"} à tort`
      );
    }
  }
});

// ── Le vocabulaire vient de la LISTE, jamais d'une recopie ──────────────────
//
// Le patron a corrigé « jour » en « journée » DEUX FOIS : le 4 août 2026 sur la
// liste elle-même, puis le 15 août sur une maquette qui l'avait réenfreinte.
// Une règle écrite dans le dépôt et enfreinte deux fois n'est pas une règle :
// c'est un contrôle qui manque.
cas("les durées de la liste s'écrivent exactement comme dans la liste", () => {
  for (const d of DUREES) {
    assert.equal(
      libelleDureeCourt(d.demiJournees),
      d.libelle,
      `${d.demiJournees} demi-journée(s) : la ligne et la liste déroulante doivent dire le même mot`
    );
  }
});

cas("aucune durée n'écrit « jour » là où la liste dit « journée »", () => {
  assert.equal(libelleDureeCourt(1), "½ journée");
  assert.equal(libelleDureeCourt(2), "1 journée");
  assert.equal(libelleDureeCourt(4), "2 jours");
  // Impaires : impossibles à CHOISIR, possibles à DICTER (« une journée et
  // demie » → 3). Une ligne muette vaudrait pire qu'un mot approximatif.
  assert.equal(libelleDureeCourt(3), "1 journée ½");
  assert.equal(libelleDureeCourt(5), "2 jours ½");
});

// ── Ce qui existait avant les créneaux, et ne doit pas changer de sens ──────
// Un chantier posé avant la migration des créneaux n'a ni moment ni durée. Il
// valait « journée entière à partir du matin » partout ailleurs
// (`compterOccupation`) : le libellé doit dire exactement la même chose, sinon
// l'écran et la réservation se contrediraient sur les mêmes lignes.
cas("sans moment ni durée : une journée entière, comme le reste du produit", () => {
  assert.equal(libelleOccupation(j("2026-08-14"), null, null).texte, "journée");
});

cas("une durée absurde ne fait pas tomber l'écran", () => {
  assert.equal(libelleOccupation(j("2026-08-14"), "matin", 0).texte, "matin · ½ journée");
  assert.equal(libelleOccupation(j("2026-08-14"), "matin", -3).texte, "matin · ½ journée");
  assert.equal(libelleOccupation(j("2026-08-14"), "matin", 1.7).texte, "matin · ½ journée");
});

// Cent jours, la borne haute de la liste des durées : rien ne doit s'emballer.
cas("cent jours restent lisibles sur une ligne", () => {
  assert.equal(libelleOccupation(j("2026-08-14"), "matin", 200).texte, "matin · 100 jours");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
