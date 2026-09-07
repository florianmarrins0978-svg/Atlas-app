import assert from "node:assert/strict";
import { quoiServir, echangerLesDossiers } from "./relais-version-batie.mjs";

// **« L'appli est lente, corrige ça. »** — le patron, le 31 août 2026 au soir,
// et c'était la huitième fois (14, 16, 17, 20, 25, 29 août, puis deux fois le
// 31). Chaque fois la même mécanique : son banc jetait sa version rapide pour
// en bâtir une neuve, et le renvoyait pendant ce temps sur un mode où un écran
// neuf met plus longtemps à compiler que le relais de GitHub n'accepte
// d'attendre. Il ne pouvait ouvrir aucun écran qu'il n'avait pas déjà ouvert.
//
// Ce que cette suite tient :
//
//   1. une version bâtie utilisable n'est PLUS jetée pour en bâtir une autre ;
//   2. le tout premier démarrage — quand il n'y a rien à garder — se comporte
//      exactement comme avant : rien n'est retiré aux espaces neufs ;
//   3. **l'échange ne peut pas le laisser sans application.** C'est le seul
//      engagement qui compte, et il s'éprouve sur les deux chutes qu'un vrai
//      disque ne produit pas sur commande.

let echecs = 0;
function cas(intitule: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${intitule}`);
  } catch (err) {
    echecs++;
    console.error(`  ✗ ${intitule}\n    ${(err as Error).message}`);
  }
}

const DOSSIERS = { dist: ".next-batie", neuve: ".next-batie-neuve" };

// ── Ce qu'on sert pendant la construction ───────────────────────────────────

cas("rien à rebâtir : on sert la version bâtie, sans chantier", () => {
  const d = quoiServir({ raison: null, versionDavantUtilisable: true, ...DOSSIERS });
  assert.deepEqual(d, {
    servirDavant: false,
    modeDeveloppement: false,
    dossierDeConstruction: ".next-batie",
  });
});

cas("le code a changé ET une version bâtie existe : elle RESTE en service", () => {
  const d = quoiServir({
    raison: "le code a changé depuis la dernière construction",
    versionDavantUtilisable: true,
    ...DOSSIERS,
  });
  assert.equal(d.modeDeveloppement, false, "c'est tout le correctif : plus de repli sur le mode lent");
  assert.equal(d.servirDavant, true);
  assert.equal(
    d.dossierDeConstruction,
    ".next-batie-neuve",
    "bâtir dans le dossier servi retirerait le sol au serveur en marche : next build efface sa destination"
  );
});

cas("premier démarrage, rien de bâti : on reste sur le mode développement", () => {
  // Il n'y a pas de version d'avant à garder. Rien ne doit être retiré à un
  // espace neuf — le correctif ne vaut que quand il y a quelque chose à sauver.
  const d = quoiServir({
    raison: "aucune version bâtie",
    versionDavantUtilisable: false,
    ...DOSSIERS,
  });
  assert.deepEqual(d, {
    servirDavant: false,
    modeDeveloppement: true,
    dossierDeConstruction: ".next-batie",
  });
});

// ── L'échange, et ses deux chutes ───────────────────────────────────────────

/** Un disque en carton : on dit quel renommage doit tomber, et on note le reste. */
function disque({ renommageQuiTombe = null as string | null } = {}) {
  const gestes: string[] = [];
  return {
    gestes,
    ops: {
      ...{ dist: "D", neuve: "N", vieille: "V" },
      renommer: (de: string, vers: string) => {
        const geste = `${de}→${vers}`;
        if (geste === renommageQuiTombe) throw new Error("disque plein");
        gestes.push(geste);
      },
      effacer: (d: string) => gestes.push(`effacer ${d}`),
      effacerEnFond: (d: string) => gestes.push(`effacer en fond ${d}`),
    },
  };
}

cas("l'échange nominal : deux renommages, l'ancienne effacée EN FOND", () => {
  const { gestes, ops } = disque();
  assert.deepEqual(echangerLesDossiers(ops), { echange: true, motif: null });
  assert.deepEqual(gestes, ["effacer V", "D→V", "N→D", "effacer en fond V"]);
  // En fond, et pas autrement : 351 Mo à retirer bloqueraient la bascule des
  // dizaines de secondes — la fenêtre exacte où le veilleur lance un second banc.
  assert.ok(!gestes.includes("effacer V" as never) || gestes.at(-1) === "effacer en fond V");
});

cas("l'ancienne ne peut pas être écartée : RIEN n'a bougé, elle sert encore", () => {
  const { gestes, ops } = disque({ renommageQuiTombe: "D→V" });
  const r = echangerLesDossiers(ops);
  assert.equal(r.echange, false);
  assert.match(r.motif ?? "", /pas pu être écartée/);
  assert.ok(!gestes.includes("N→D"), "on ne met jamais la neuve en place sans avoir libéré le nom");
});

cas("la neuve ne peut pas prendre la place : l'ancienne REVIENT", () => {
  const { gestes, ops } = disque({ renommageQuiTombe: "N→D" });
  const r = echangerLesDossiers(ops);
  assert.equal(r.echange, false);
  assert.deepEqual(
    gestes,
    ["effacer V", "D→V", "V→D"],
    "sans ce retour en arrière, le patron se retrouverait SANS version bâtie du tout"
  );
});

cas("un échange manqué se DIT, il ne se devine pas", () => {
  // Un échange silencieux ferait croire au code neuf servi. La fiche de son
  // espace dirait alors « tout concorde » sur une version d'avant — la faute
  // qu'on vient de corriger dans `diagnostiquer-espace.mjs`.
  for (const quiTombe of ["D→V", "N→D"]) {
    const { ops } = disque({ renommageQuiTombe: quiTombe });
    assert.ok(echangerLesDossiers(ops).motif, `${quiTombe} : un échec sans motif est un échec muet`);
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Relais de version bâtie — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
