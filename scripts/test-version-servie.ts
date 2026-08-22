import assert from "node:assert/strict";
import { versionServie } from "../src/lib/version-servie";

// **Le cas du patron, le 21 août 2026, rejoué ligne à ligne.**
//
// *« Ça n'a pas marché, j'ai encore l'ancienne version. Pourtant j'ai rechargé
// les mises à jour. »* — et la ligne « Version » de son écran annonçait bien la
// date du jour et la branche `main`.
//
// Les deux étaient vrais. Le code neuf était arrivé sur le disque ; le serveur,
// lui, exécutait encore la version bâtie de la veille. L'écran censé trancher
// lisait le disque, pas ce qui tournait — il confirmait donc la mise à jour au
// moment précis où il aurait dû signaler qu'elle n'était pas servie.

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

console.log("=== Quelle version l'application exécute ===\n");

const VEILLE = "20/08/2026 14:12 · c9abb50 · main";
const JOUR = "21/08/2026 09:41 · 02fca3e · main";

cas("SON CAS : bâtie la veille, dépôt avancé — l'écran annonce CE QUI TOURNE", () => {
  const r = versionServie({ duDepot: JOUR, duDemarrage: VEILLE, versionBatie: true });
  assert.equal(r.ligne, VEILLE, "l'écran annonce le disque, pas ce qui s'exécute");
  assert.equal(r.enRetard, true, "le retard n'est pas signalé : il croira essayer la version neuve");
  assert.equal(r.enAttente, JOUR, "le code qui attend n'est pas nommé");
});

cas("bâtie et à jour : rien à signaler, et surtout aucun faux avertissement", () => {
  const r = versionServie({ duDepot: JOUR, duDemarrage: JOUR, versionBatie: true });
  assert.equal(r.ligne, JOUR);
  assert.equal(r.enRetard, false, "un avertissement qui parle à tort s'apprend à ignorer");
  assert.equal(r.enAttente, null);
});

cas("en développement, le dépôt EST ce qui s'exécute — jamais de retard", () => {
  // `next dev` recompile chaque écran à l'ouverture : du code neuf apparaît de
  // lui-même au rechargement. Annoncer un retard ici enverrait reconstruire
  // pour rien.
  const r = versionServie({ duDepot: JOUR, duDemarrage: VEILLE, versionBatie: false });
  assert.equal(r.ligne, JOUR);
  assert.equal(r.enRetard, false);
});

cas("bâtie sans marque de démarrage : on annonce le dépôt, on ne promet rien", () => {
  // On ne sait pas avec quoi elle a été bâtie. Inventer un retard serait deviner.
  const r = versionServie({ duDepot: JOUR, duDemarrage: null, versionBatie: true });
  assert.equal(r.ligne, JOUR);
  assert.equal(r.enRetard, false);
});

cas("dépôt muet : on retombe sur la marque du démarrage plutôt que sur rien", () => {
  const r = versionServie({ duDepot: null, duDemarrage: VEILLE, versionBatie: true });
  assert.equal(r.ligne, VEILLE);
  assert.equal(r.enRetard, false, "sans dépôt, il n'y a rien à comparer — donc rien à annoncer");
});

cas("rien du tout : `null`, et l'écran dira « inconnue » de lui-même", () => {
  const r = versionServie({ duDepot: null, duDemarrage: null, versionBatie: true });
  assert.equal(r.ligne, null);
  assert.equal(r.enRetard, false);
});

cas("une branche différente compte comme un retard — c'est le piège de §6", () => {
  // Un espace resté sur une branche de session n'aura JAMAIS ce qui est poussé
  // sur `main`, quoi qu'on y pousse. La ligne doit donc trahir la différence,
  // pas seulement la date.
  const r = versionServie({
    duDepot: "21/08/2026 09:41 · 02fca3e · claude/vieille-branche",
    duDemarrage: "21/08/2026 09:41 · 02fca3e · main",
    versionBatie: true,
  });
  assert.equal(r.enRetard, true);
});

console.log(
  echecs === 0
    ? "\n✅ Version servie — 0 échec(s).\n"
    : `\n❌ Version servie — ${echecs} échec(s).\n`
);
process.exit(echecs === 0 ? 0 : 1);
