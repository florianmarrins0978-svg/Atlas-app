import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Rapporte, ligne à ligne, l'écart entre les modèles publiés sur le site du
// patron et les copies versées dans `appli/`.
//
// **Pourquoi ce contrôle existe.** Les modèles de devis et de facture ont été
// repris d'Arborea au début du projet, puis reproduits en PDF d'après la copie
// locale. Or une copie ne prouve rien sur son original : deux explications
// successives d'un écart de couleur ont été affirmées puis démenties, chacune
// parce qu'elle raisonnait sur la copie plutôt que sur la source.
//
// L'environnement de développement ne peut pas atteindre `github.io`
// (`403 à CONNECT — policy denial`). Ce script tourne donc sur une machine qui,
// elle, y a accès, et son rapport se lit par l'API — comme `relever-palette`.
//
// Il ne corrige rien : il montre. Une reprise automatique écraserait la copie
// locale avec ce qui se trouve en ligne, y compris les adaptations faites ici
// à dessein.

const SITE = process.env.SITE || "https://florianmarrins0978-svg.github.io/Arborea-";

const MODELES = [
  { nom: "devis-modele.html", local: "appli/devis-modele.html" },
  { nom: "facture-modele.html", local: "appli/facture-modele.html" },
  { nom: "tva-modele.html", local: "appli/tva-modele.html" },
  { nom: "mes-tarifs.html", local: "appli/mes-tarifs.html" },
  { nom: "app.html", local: "appli/app.html" },
  { nom: "devis-vocal.html", local: "appli/devis-vocal.html" },
];

const DOSSIER = "/tmp/modeles-en-ligne";
if (!existsSync(DOSSIER)) mkdirSync(DOSSIER, { recursive: true });

let ecarts = 0;
let absents = 0;

for (const { nom, local } of MODELES) {
  const url = `${SITE}/${nom}`;
  console.log(`\n${"═".repeat(74)}`);
  console.log(`  ${nom}`);
  console.log(`${"═".repeat(74)}`);

  let distant;
  try {
    const reponse = await fetch(url, { redirect: "follow" });
    if (!reponse.ok) {
      console.log(`  ❌ ${reponse.status} sur ${url} — pas de modèle à cette adresse`);
      absents++;
      continue;
    }
    distant = await reponse.text();
  } catch (e) {
    console.log(`  ❌ injoignable — ${e.message}`);
    absents++;
    continue;
  }

  if (!existsSync(local)) {
    console.log(`  ⚠  ${local} n'existe pas ici : le modèle en ligne n'a jamais été repris.`);
    ecarts++;
    continue;
  }

  const copie = readFileSync(local, "utf8");
  if (copie === distant) {
    console.log(`  ✅ identique à la copie locale (${copie.length} octets)`);
    continue;
  }

  ecarts++;
  const cheminDistant = `${DOSSIER}/${nom}`;
  writeFileSync(cheminDistant, distant);
  console.log(`  ⚠  DIFFÉRENT — en ligne ${distant.length} octets, ici ${copie.length}`);

  // Le diff est tronqué : sur un écart massif, mille lignes de journal ne
  // disent rien de plus que les cinquante premières, et noient le reste.
  try {
    execFileSync("diff", ["-u", local, cheminDistant], { encoding: "utf8" });
  } catch (e) {
    const lignes = String(e.stdout || "").split("\n");
    console.log(`  ${lignes.length} lignes de différence. Les 60 premières :\n`);
    for (const l of lignes.slice(0, 60)) console.log(`    ${l}`);
    if (lignes.length > 60) console.log(`    … et ${lignes.length - 60} de plus.`);
  }
}

console.log(`\n${"═".repeat(74)}`);
if (ecarts === 0 && absents === 0) {
  console.log("  Toutes les copies locales sont conformes aux modèles en ligne.");
} else {
  console.log(`  ${ecarts} modèle(s) divergent(s), ${absents} injoignable(s).`);
  console.log("  Rien n'a été modifié : ce contrôle montre, il ne corrige pas.");
}
console.log(`${"═".repeat(74)}\n`);
