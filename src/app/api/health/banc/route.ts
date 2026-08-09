import { readFileSync } from "node:fs";

// **L'état du banc, lisible depuis un téléphone.**
//
// Le 9 août 2026, le patron attend trois minutes devant un écran qui ne s'ouvre
// pas. La seule chose qui pouvait dire pourquoi était le terminal de l'éditeur
// — qu'il ne pouvait ni lire confortablement ni photographier ce jour-là. Sa
// phrase : *« Va regarder toi-même, je peux pas te l'envoyer. »*
//
// Je n'ai aucun accès à son espace de travail. L'information devait donc venir
// à lui, et non l'inverse. Cette adresse répond en quelques millisecondes, sans
// session, et dit trois choses — les seules qui comptent quand rien ne s'ouvre :
//
//   1. **quelle version tourne** — la question « le correctif est-il descendu ? »
//      a déjà coûté plusieurs journées (`ARCHITECTURE.md` §24) ;
//   2. **où en est le préchauffage** — s'il compile encore, ses clics passent
//      derrière la file, et il n'y a rien d'autre à faire qu'attendre ;
//   3. **ce qui bloque**, quand quelque chose bloque.
//
// Sous `/api/health/` à dessein : le `matcher` du middleware laisse ce préfixe
// passer sans session. Il faut pouvoir diagnostiquer précisément quand on
// n'arrive même pas à entrer.
//
// **Elle n'expose aucune donnée d'entreprise** : une version de code, un
// compteur d'écrans, une durée. Rien d'autre ne doit y entrer — cette adresse
// est ouverte à qui connaît le nom de l'espace.
//
// En HTML plutôt qu'en JSON, et c'est délibéré : sur un téléphone, du JSON brut
// se lit sur une seule ligne minuscule. Celui qui consulte cette page est en
// train de chercher pourquoi rien ne marche ; ce n'est pas le moment de lui
// demander un effort.

export const dynamic = "force-dynamic";

/** Ce que le préchauffage a déposé, ou rien s'il n'a pas commencé. */
function etatPrechauffage(): {
  faits?: number;
  total?: number;
  reussis?: number;
  echoues?: number;
  encours?: string | null;
  termine?: boolean;
  secondes?: number;
  obstacle?: string | null;
  majAt?: string;
} | null {
  try {
    return JSON.parse(readFileSync("/tmp/atlas-prechauffage.json", "utf8"));
  } catch {
    // Absent = le préchauffage n'a pas encore écrit une seule ligne. C'est une
    // information, pas une panne : on la rend telle quelle.
    return null;
  }
}

function echapper(texte: string): string {
  return texte.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export async function GET() {
  const version = process.env.ATLAS_VERSION ?? "inconnue";
  const etat = etatPrechauffage();
  const secondesDepuisDemarrage = Math.round(process.uptime());

  let titre: string;
  let explication: string;
  // **Une phrase mise en avant, plutôt que des astérisques.** Le premier jet
  // écrivait `**…**` dans le texte : lu sur le téléphone du patron, cela donnait
  // des astérisques en clair au milieu d'une phrase. Vu sur l'écran, jamais dans
  // le code — c'est le troisième défaut de cette série trouvé en regardant.
  let insiste: string | null = null;
  let ton: "bien" | "attendre" | "mal";

  if (!etat) {
    ton = "attendre";
    titre = "Le préchauffage n'a pas encore commencé";
    explication =
      "Le serveur vient de démarrer. Les écrans se compileront donc à l'ouverture, " +
      "une fois chacun — comptez jusqu'à une minute pour le premier.";
  } else if (etat.termine) {
    const echoues = etat.echoues ?? 0;
    ton = echoues > 0 ? "mal" : "bien";
    titre = echoues > 0
      ? `${etat.reussis} écran(s) prêts, ${echoues} en échec`
      : `Les ${etat.reussis} écrans sont prêts`;
    explication = etat.obstacle
      ? etat.obstacle
      : echoues > 0
        ? "Certains écrans n'ont pas pu être compilés d'avance : ils le seront à l'ouverture."
        : "Tout est compilé d'avance. Chaque écran doit s'ouvrir en moins d'une seconde. " +
          "Si ce n'est pas le cas, le problème est ailleurs — dites-le.";
  } else {
    ton = "attendre";
    const faits = etat.faits ?? 0;
    const total = etat.total ?? 0;
    titre = `Préchauffage en cours — ${faits} écran(s) prêts sur ${total}`;
    insiste = "Pendant ce temps, vos propres clics passent derrière la file.";
    explication =
      "Atlas compile ses écrans d'avance : un écran que vous ouvrez maintenant peut donc " +
      "mettre une minute. Ce n'est pas une panne, et il n'y a rien à faire — attendez que " +
      "cette page affiche « prêts »." +
      (etat.encours ? ` En train de compiler : ${etat.encours}` : "");
  }

  const couleur = ton === "bien" ? "#2f6f4f" : ton === "attendre" ? "#8a6d1f" : "#a33";

  const page = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>État du banc — Atlas</title>
<style>
 body{margin:0;padding:24px;font:16px/1.5 system-ui,sans-serif;color:#1c1a17;background:#faf7f2}
 h1{font-size:20px;margin:0 0 4px}
 .etat{border-left:4px solid ${couleur};background:#fff;border-radius:14px;padding:16px 18px;margin:18px 0}
 .etat p{margin:8px 0 0}
 dl{background:#fff;border-radius:14px;padding:16px 18px;margin:0}
 dt{font-size:13px;color:#6b645c;margin-top:12px}
 dt:first-child{margin-top:0}
 dd{margin:2px 0 0;font-family:ui-monospace,monospace;word-break:break-all}
 footer{margin-top:20px;font-size:13px;color:#6b645c}
</style></head><body>
<h1>État du banc d'essai</h1>
<div class="etat">
  <strong>${echapper(titre)}</strong>
  ${insiste ? `<p><strong>${echapper(insiste)}</strong></p>` : ""}
  <p>${echapper(explication)}</p>
</div>
<dl>
  <dt>Version exécutée</dt><dd>${echapper(version)}</dd>
  <dt>Serveur démarré depuis</dt><dd>${secondesDepuisDemarrage} s</dd>
  ${etat?.majAt ? `<dt>Dernière nouvelle du préchauffage</dt><dd>${echapper(etat.majAt)}</dd>` : ""}
</dl>
<footer>Rafraîchissez cette page pour suivre l'avancement.</footer>
</body></html>`;

  return new Response(page, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
