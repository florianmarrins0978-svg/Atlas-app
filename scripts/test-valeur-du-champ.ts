import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * UN CHAMP QUITTÉ REND SA VALEUR — jamais celle du dernier rendu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LE MÊME DÉFAUT, QUATRE FOIS, SUR QUATRE PIÈCES DIFFÉRENTES.**
 *
 * | quand | la pièce | ce qui partait chez le client |
 * |---|---|---|
 * | 30 août 2026 | les prix de ligne du devis | *« un prix tapé puis quitté partait à zéro »* — six enquêtes |
 * | 13 septembre | `PrixAccordeAuClient` | la remise retirée **revenait**, à l'ancien pourcentage |
 * | 13 septembre | `ChampNu` | le nom, l'adresse, l'IBAN de l'émetteur ET du client |
 * | 13 septembre | `Champ` des Réglages | le SIRET, le numéro de TVA, l'IBAN |
 *
 * **Le mécanisme, et il n'a rien d'exotique.** `onBlur` se déclenche à la perte
 * du focus. Si le gestionnaire n'emporte rien, l'appelant lit son propre état
 * React — celui du DERNIER RENDU. Or React ne rend pas à la frappe, il le
 * programme : entre la dernière touche et la sortie du champ, rien ne garantit
 * que l'état porte ce qui vient d'être tapé.
 *
 * Sur une machine reposée, le rendu arrive à temps et tout va bien. Sous
 * charge, non — et **l'écran continue d'afficher la valeur neuve** pendant que
 * le serveur range l'ancienne. Rien ne le dit. On l'apprend au rechargement, ou
 * sur la pièce partie chez le client.
 *
 * **La leçon vivait dans un commentaire depuis le 30 août, et elle a été
 * manquée trois fois de plus.** C'est exactement ce que `CLAUDE.md` §1 bis dit
 * d'une consigne en prose : elle se lit au début d'une conversation et s'oublie
 * au bout de trois heures. Elle vit donc ici désormais.
 *
 * **La règle : un `onBlur` qui appelle un rappel lui passe quelque chose.**
 * `onBlur={onFini}` donnerait l'ÉVÉNEMENT comme valeur ; `onBlur={() => onFini()}`
 * ne donne rien du tout. Ce qu'on attend est `onBlur={(e) => onFini(e.currentTarget.value)}`
 * — ou la valeur composée à partir de lui, quand ce qui s'affiche n'est pas ce
 * qui se range (`ChampTelephone`).
 *
 * Ni base, ni réseau, ni navigateur : il lit le code des écrans.
 */

const SRC = path.join(__dirname, "..", "src");

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

function fichiers(racine: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine)) {
    const complet = path.join(racine, entree);
    if (statSync(complet).isDirectory()) trouves.push(...fichiers(complet));
    else if (entree.endsWith(".tsx")) trouves.push(complet);
  }
  return trouves;
}

/**
 * Les sorties de champ qui n'emportent pas ce que le champ porte.
 *
 * **Trois formes, et trois seulement** — on ne cherche pas à lire le langage,
 * on cherche la forme qui a coûté quatre fois :
 *
 *   · `onBlur={unRappel}` — le rappel reçoit l'ÉVÉNEMENT ;
 *   · `onBlur={() => unRappel()}` — il ne reçoit rien ;
 *   · `onBlur: unRappel,` — la même chose dans un objet de propriétés.
 *
 * **Ce qui est laissé passer, et c'est délibéré** (`CLAUDE.md` §1 bis : un
 * contrôle qui parle à tort s'apprend à être ignoré) : tout `onBlur` dont le
 * corps mentionne `e.` ou `event.` — il a l'événement sous la main et fait ce
 * qu'il veut —, et les gestionnaires écrits en plusieurs lignes, qui ne sont
 * plus des passe-plats et se lisent.
 */
export function sortiesDeChampSansValeur(source: string): string[] {
  const coupables: string[] = [];

  // `onBlur={quelqueChose}` ou `onBlur: quelqueChose,` — un identifiant nu.
  for (const m of source.matchAll(/onBlur[=:]\s*\{?\s*([A-Za-z_$][\w$]*)\s*[},]/g)) {
    coupables.push(`onBlur={${m[1]}} — ${m[1]} reçoit l'événement à la place de la valeur`);
  }

  // `onBlur={() => rappel()}` — sur une seule ligne, sans argument.
  for (const m of source.matchAll(/onBlur=\{\(\)\s*=>\s*([A-Za-z_$][\w$.]*)\(\s*\)\s*\}/g)) {
    coupables.push(`onBlur={() => ${m[1]}()} — le champ ne rend pas ce qu'il porte`);
  }

  return coupables;
}

console.log("=== Un champ quitté rend SA valeur ===\n");

const lus = fichiers(SRC);

cas("il y a bien des écrans à lire — sinon ce contrôle ne mesure rien", () => {
  // Un contrôle qui parcourt zéro fichier rend un vert qui ne prouve rien
  // (`CLAUDE.md` §5, payé le 15 août 2026).
  assert.ok(lus.length > 50, `seulement ${lus.length} écran(s) lus`);
});

cas("l'heuristique reconnaît les trois formes qui ont coûté quatre fois", () => {
  // **Un contrôle doit savoir échouer** (`AGENTS.md`) : on lui montre le code
  // d'avant, celui des quatre pièces, et il doit le nommer.
  assert.deepEqual(sortiesDeChampSansValeur(`onBlur={onFini}`).length, 1);
  assert.deepEqual(sortiesDeChampSansValeur(`onBlur: onFini,`).length, 1);
  assert.deepEqual(sortiesDeChampSansValeur(`onBlur={() => onFini()}`).length, 1);
  // Et il se tait sur ce qui rend bien la valeur.
  assert.deepEqual(sortiesDeChampSansValeur(`onBlur={(e) => onFini(e.currentTarget.value)}`), []);
  assert.deepEqual(
    sortiesDeChampSansValeur(`onBlur={(e) => onFini(composerTelephone(pays, e.currentTarget.value))}`),
    []
  );
});

cas("aucun champ ne range une valeur en retard d'une frappe", () => {
  const coupables: string[] = [];
  for (const fichier of lus) {
    for (const forme of sortiesDeChampSansValeur(readFileSync(fichier, "utf8"))) {
      coupables.push(`${path.relative(path.join(__dirname, ".."), fichier)} → ${forme}`);
    }
  }
  assert.deepEqual(
    coupables,
    [],
    "une sortie de champ qui n'emporte rien : sous charge, le serveur range " +
      "l'ANCIENNE valeur pendant que l'écran affiche la neuve —\n      " +
      coupables.join("\n      ")
  );
});

console.log(
  echecs === 0 ? "\n✅ Ce qui est tapé est ce qui se range." : `\n❌ ${echecs} échec(s).`
);
process.exit(echecs === 0 ? 0 : 1);
