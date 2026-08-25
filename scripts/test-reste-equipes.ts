import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { equipesLibresCeJour, ditCeQuiResteCeJour } from "../src/lib/planning-jour";

/**
 * CE QUI RESTE D'ÉQUIPES SUR UN JOUR QU'IL PROPOSE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa colère du 22 août 2026 :** *« je peux proposer le 24 alors qu'un client a
 * validé le 24 — corrige-moi ça ! Ça ne doit jamais se reproduire, c'est une
 * erreur gravissime !!!! »*
 *
 * Le défaut de code a été réparé le jour même. Ce qui restait n'en était pas un :
 * **avec deux équipes, un jour à moitié pris reste proposable**, et c'est voulu.
 * Mais aucun écran ne le disait.
 *
 * **Sa réponse du 25 août : B**, avec une réserve — *« "1 chantier sur 2" on ne
 * comprend pas très bien »*. D'où « Reste 1 équipe sur 2 » : la même information,
 * tournée du côté du geste qu'il est en train de faire.
 *
 * **CE QUE CETTE SUITE TIENT, ET QUI COÛTERAIT UN CLIENT :**
 *
 *   · **le PIRE des deux demi-journées commande.** Un matin plein et un
 *     après-midi libre ne font pas « une équipe et demie » : il y a un moment de
 *     la journée où il n'y a personne, et c'est celui-là qui contraint. La
 *     moyenne annoncerait de la place là où il n'y en a pas — exactement la
 *     faute qu'il a signalée, sous une autre forme ;
 *   · **on arrondit du côté SÛR.** Annoncer une équipe libre qui ne l'est pas
 *     fait proposer un jour au client, et c'est lui qui rappelle pour
 *     décommander ;
 *   · **rien ne s'écrit quand tout est libre.** Un avertissement qui parle à tort
 *     s'apprend à être ignoré, et l'on perd le garde-fou sans s'en apercevoir.
 * ─────────────────────────────────────────────────────────────────────────────
 */

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

console.log("=== Ce qui reste d'équipes le jour qu'il propose ===\n");

essai("deux équipes, une prise le matin : il en reste une", () => {
  assert.equal(equipesLibresCeJour(0.5, 0, 2), 1);
  assert.equal(ditCeQuiResteCeJour(1, 2), "Reste 1 équipe sur 2");
});

// **LE CAS DE SA COLÈRE**, celui du 24 août : un client avait validé ce jour-là.
essai("le jour d'un chantier accepté n'est plus annoncé libre", () => {
  assert.equal(ditCeQuiResteCeJour(equipesLibresCeJour(0.5, 0.5, 2), 2), "Reste 1 équipe sur 2");
});

// **LE PIÈGE DE LA MOYENNE.** Matin plein, après-midi libre : il n'y a pas « une
// équipe et demie » de libre, il y a une demi-journée où personne n'est
// disponible.
essai("le pire moment de la journée commande, jamais la moyenne", () => {
  assert.equal(
    equipesLibresCeJour(1, 0, 2),
    0,
    "un matin plein s'efface derrière un après-midi libre : le jour paraît disponible"
  );
  assert.equal(ditCeQuiResteCeJour(0, 2), "Plus d'équipe libre sur 2");
});

essai("rien ne s'écrit sur un jour entièrement libre", () => {
  assert.equal(ditCeQuiResteCeJour(equipesLibresCeJour(0, 0, 2), 2), null);
  assert.equal(ditCeQuiResteCeJour(equipesLibresCeJour(0, 0, 3), 3), null);
});

// **UNE SEULE ÉQUIPE : on se tait.** « Reste 0 équipe sur 1 » n'apprend rien à
// qui n'a personne d'autre à envoyer, et le serveur refuse déjà ce jour-là.
essai("avec une seule équipe, la mention ne sert à rien et ne s'écrit pas", () => {
  assert.equal(ditCeQuiResteCeJour(equipesLibresCeJour(1, 1, 1), 1), null);
  assert.equal(ditCeQuiResteCeJour(equipesLibresCeJour(0, 0, 1), 1), null);
});

essai("trois équipes, une prise : « Reste 2 équipes sur 3 »", () => {
  assert.equal(ditCeQuiResteCeJour(equipesLibresCeJour(1 / 3, 0, 3), 3), "Reste 2 équipes sur 3");
});

// **TOUTES LES CHARGES RÉELLES, et pas trois cas choisis à la main.** La charge
// vaut toujours `prises ÷ équipes` — une fraction, donc soumise à la virgule
// flottante : `k/n × n` peut retomber juste au-dessus de `k`, et l'arrondi au
// supérieur compterait alors une équipe prise DE TROP. Il annoncerait « Reste
// 1 équipe sur 3 » un jour où il en reste deux, et lui ferait refuser du
// travail. Le grain d'epsilon est là pour ça, et c'est ce balayage qui
// l'éprouve — pas un exemple que le hasard rendrait juste.
essai("k équipes prises sur n en laissent bien n − k, pour tous les n jusqu'à 8", () => {
  for (let n = 1; n <= 8; n++) {
    for (let k = 0; k <= n; k++) {
      assert.equal(
        equipesLibresCeJour(k / n, 0, n),
        n - k,
        `${k} prise(s) sur ${n} : la règle en laisse ${equipesLibresCeJour(k / n, 0, n)} au lieu de ${n - k}`
      );
    }
  }
});

// **Et une charge PARTIELLE compte pour une équipe entière**, dans l'autre sens :
// une demi-équipe prise n'existe pas sur le terrain — quelqu'un est parti, ou
// non. Arrondir vers le bas rendrait « rien n'est pris » sur un jour occupé.
essai("une charge à peine entamée compte pour une équipe entière", () => {
  assert.equal(equipesLibresCeJour(0.01, 0, 2), 1);
  assert.equal(equipesLibresCeJour(0.2, 0, 4), 3);
});

// **Et une charge NULLE reste nulle** : l'arrondi au supérieur ne doit pas
// inventer une équipe prise sur un jour vide, sans quoi la mention parlerait
// partout et s'apprendrait à être ignorée.
essai("zéro reste zéro : l'arrondi n'invente pas une équipe prise", () => {
  assert.equal(equipesLibresCeJour(0, 0, 2), 2);
  assert.equal(equipesLibresCeJour(0, 0, 4), 4);
});

// Une absence peut porter la charge au-delà de un. Le compte ne descend jamais
// sous zéro, sans quoi la phrase annoncerait « Reste -1 équipe ».
essai("une journée surchargée ne rend jamais un nombre négatif", () => {
  assert.equal(equipesLibresCeJour(1.5, 2, 2), 0);
  assert.equal(ditCeQuiResteCeJour(0, 2), "Plus d'équipe libre sur 2");
});

// ─── LA PLANCHE ET L'ÉCRAN DISENT LA MÊME PHRASE ───────────────────────────
//
// **Payé le 22 août 2026, sur une autre planche** : la légende d'un plan citait
// du matériel que le calcul ne posait plus, et son contrôle exigeait ce libellé
// en dur — la légende ne pouvait donc plus être corrigée sans faire rougir la
// batterie (`CLAUDE.md` §4 bis). Ici, c'est l'inverse qu'on veut : la planche
// est ce qu'IL regarde pour juger, et une planche qui n'annonce plus ce que
// l'écran écrit lui fait valider une phrase qu'il ne verra jamais.
//
// La règle reste écrite UNE fois (`ditCeQuiResteCeJour`) ; la planche, sans
// module, la recopie forcément. Ce contrôle est ce qui empêche les deux de
// diverger.
essai("la planche 88 annonce exactement la phrase que l'écran écrit", () => {
  const planche = readFileSync("appli/envoi-jour-deja-pris.html", "utf8");
  const phrase = ditCeQuiResteCeJour(1, 2);
  assert.ok(phrase, "la règle ne rend plus rien pour « une prise sur deux »");
  assert.ok(
    planche.includes(phrase),
    `la planche ne porte pas « ${phrase} » : il jugerait sur une phrase que son écran n'écrit pas`
  );
});

console.log("");
if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("Ce qui reste d'équipes — 0 échec(s).");
