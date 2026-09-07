/* =======================================================================
   Rend un document Markdown en une page consultable, au sommaire cliquable.

   Pourquoi un générateur plutôt qu'une seconde version écrite à la main :
   le document vit et s'enrichit à chaque question. Deux versions tenues
   séparément divergent toujours, et c'est la mauvaise qu'on finit par lire.
   Le Markdown reste la source unique ; cette page en est une projection.

   Conversion volontairement minimale — elle ne couvre que ce que ce document
   emploie réellement (titres, listes, tableaux, citations, gras, code, liens).
   Y ajouter un moteur Markdown complet serait disproportionné pour un fichier
   dont on maîtrise la forme.

   Usage :
     node scripts/md-en-page.mjs docs/QUESTIONS.md [sortie.html]
     node scripts/md-en-page.mjs docs/A-FAIRE.md
   ======================================================================= */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE = process.argv[2];
if (!SOURCE) {
  console.error("Usage : node scripts/md-en-page.mjs <source.md> [sortie.html]");
  process.exit(1);
}
// Par défaut, la page prend le nom du document, en minuscules et en .html —
// docs/A-FAIRE.md donne docs/a-faire.html.
const SORTIE =
  process.argv[3] ??
  path.join(
    path.dirname(SOURCE),
    path.basename(SOURCE, ".md").toLowerCase() + ".html"
  );

const echapper = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Identifiant d'ancre, calculé comme le fait GitHub : minuscules, ponctuation
 * retirée, espaces en tirets, accents conservés. Le calculer ici plutôt que de
 * l'écrire à la main garantit que le sommaire vise toujours juste, y compris
 * après reformulation d'un titre.
 */
function ancre(titre) {
  return (
    titre
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      // CHAQUE espace devient un tiret, sans jamais en fusionner deux : là où
      // GitHub a retiré un « : », il reste deux espaces, donc deux tirets.
      // Les fusionner produirait une ancre qui fonctionne dans cette page mais
      // plus sur GitHub — deux liens divergents pour un même document.
      .replace(/ /g, "-")
  );
}

/** Gras, italique, code, liens — après échappement pour ne rien réintroduire. */
function enligne(texte) {
  return echapper(texte)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // L'italique APRÈS le gras : `**` a déjà disparu, il ne reste que les
    // simples. L'inverse ferait de `**mot**` un italique contenant un astérisque.
    //
    // Il ne s'agit pas de complétude : dans ces deux documents, l'italique porte
    // **les paroles du patron**, citées mot pour mot. Les astérisques restaient
    // affichés tels quels — une vingtaine de citations défigurées sur les pages
    // qu'il consulte le plus. Vu sur une capture, jamais par un contrôle.
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, libelle, cible) => {
      const sur = cible.startsWith("#") ? "" : ' target="_blank" rel="noopener"';
      return `<a href="${cible}"${sur}>${libelle}</a>`;
    });
}

function convertir(markdown) {
  // **Les fins de ligne Windows sont retirées ICI, et c'est une BOUCLE SANS
  // FIN qu'on ferme.**
  //
  // Découpé sur le seul saut de ligne, chaque ligne d'un fichier CRLF garde
  // son retour chariot. Le motif du séparateur de tableau exige un « | » en
  // FIN de chaîne : il ne reconnaît alors plus rien, la branche « tableau »
  // est sautée — et la branche « paragraphe », qui refuse les lignes
  // commençant par « | », ne la ramasse pas davantage. Plus personne
  // n'avance l'index, et le script tourne pour toujours, sans écrire une
  // ligne ni se plaindre.
  //
  // Trouvé le 4 septembre 2026 sur un document que `git stash` venait de
  // convertir en CRLF (`core.autocrlf`, poste Windows). Le même document
  // passait la veille : rien n'avait changé dans le Markdown.
  const lignes = markdown.split(/\r?\n/);
  const sortie = [];
  const sections = [];
  let i = 0;

  const fermer = (balise) => sortie.push(`</${balise}>`);

  while (i < lignes.length) {
    const ligne = lignes[i];

    // Séparateur horizontal
    if (/^---\s*$/.test(ligne)) {
      sortie.push("<hr>");
      i++;
      continue;
    }

    // Titres
    const titre = ligne.match(/^(#{1,4})\s+(.*)$/);
    if (titre) {
      const niveau = titre[1].length;
      const texte = titre[2];
      const id = ancre(texte);
      if (niveau === 2) sections.push({ id, texte });
      sortie.push(`<h${niveau} id="${id}">${enligne(texte)}</h${niveau}>`);
      // Retour au sommaire après chaque question : sans lui, il faut remonter
      // la page à la main, ce qui décourage la consultation.
      if (niveau === 2 && !/^sommaire$/i.test(texte)) {
        sortie.push('<a class="retour" href="#sommaire">↑ Sommaire</a>');
      }
      i++;
      continue;
    }

    // Tableau
    if (ligne.startsWith("|") && lignes[i + 1]?.match(/^\|[\s:|-]+\|$/)) {
      const cellules = (l) =>
        l.slice(1, -1).split("|").map((c) => c.trim());
      const entetes = cellules(ligne);
      i += 2;
      const corps = [];
      while (i < lignes.length && lignes[i].startsWith("|")) {
        corps.push(cellules(lignes[i]));
        i++;
      }
      sortie.push('<div class="tablewrap"><table><thead><tr>');
      entetes.forEach((c) => sortie.push(`<th>${enligne(c)}</th>`));
      sortie.push("</tr></thead><tbody>");
      corps.forEach((r) => {
        sortie.push("<tr>");
        r.forEach((c) => sortie.push(`<td>${enligne(c)}</td>`));
        sortie.push("</tr>");
      });
      sortie.push("</tbody></table></div>");
      continue;
    }

    // Citation
    if (ligne.startsWith(">")) {
      const bloc = [];
      while (i < lignes.length && lignes[i].startsWith(">")) {
        bloc.push(lignes[i].replace(/^>\s?/, ""));
        i++;
      }
      sortie.push(`<blockquote>${enligne(bloc.join(" ")).trim()}</blockquote>`);
      continue;
    }

    // Liste ordonnée
    if (/^\d+\.\s/.test(ligne)) {
      sortie.push("<ol>");
      while (i < lignes.length && /^\d+\.\s/.test(lignes[i])) {
        let element = lignes[i].replace(/^\d+\.\s/, "");
        i++;
        while (i < lignes.length && /^\s{3,}\S/.test(lignes[i])) {
          element += " " + lignes[i].trim();
          i++;
        }
        sortie.push(`<li>${enligne(element)}</li>`);
      }
      fermer("ol");
      continue;
    }

    // Liste à puces
    if (/^[-*]\s/.test(ligne)) {
      sortie.push("<ul>");
      while (i < lignes.length && /^[-*]\s/.test(lignes[i])) {
        let element = lignes[i].replace(/^[-*]\s/, "");
        i++;
        while (i < lignes.length && /^\s{2,}\S/.test(lignes[i])) {
          element += " " + lignes[i].trim();
          i++;
        }
        sortie.push(`<li>${enligne(element)}</li>`);
      }
      fermer("ul");
      continue;
    }

    // Ligne vide
    if (ligne.trim() === "") {
      i++;
      continue;
    }

    // Paragraphe : les retours à la ligne du Markdown ne coupent pas le texte.
    const bloc = [];
    while (
      i < lignes.length &&
      lignes[i].trim() !== "" &&
      !/^(#{1,4}\s|>|[-*]\s|\d+\.\s|\||---\s*$)/.test(lignes[i])
    ) {
      bloc.push(lignes[i].trim());
      i++;
    }
    sortie.push(`<p>${enligne(bloc.join(" "))}</p>`);
  }

  return { corps: sortie.join("\n"), sections };
}

const markdown = readFileSync(SOURCE, "utf8");
const { corps } = convertir(markdown);
// Le titre de l'onglet reprend le titre du document plutôt qu'une constante :
// deux pages nommées « Atlas » seraient indiscernables dans les onglets.
const titrePage = (markdown.match(/^#\s+(.*)$/m)?.[1] ?? path.basename(SOURCE)).trim();

const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas — ${titrePage}</title>
<style>
  :root{
    --ground:#f5f3ee; --surface:#faf9f5; --raised:#ece9e1;
    --ink:#1c1c1a; --ink-soft:#4a4a44; --muted:#8a8578;
    --accent:#2f3b2f; --alert:#b5562a; --line:rgba(28,28,26,0.13);
    --serif:Georgia,'Times New Roman',serif;
    --sans:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  }
  @media (prefers-color-scheme:dark){
    :root{
      --ground:#161815; --surface:#1d201c; --raised:#252924;
      --ink:#eae7df; --ink-soft:#c2bdb1; --muted:#948f83;
      --accent:#9fbd82; --alert:#e0885a; --line:rgba(234,231,223,0.17);
    }
  }
  *{box-sizing:border-box;}
  body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--sans);
    line-height:1.65;}
  main{max-width:44rem;margin:0 auto;padding:2.5rem 1.2rem 5rem;}
  h1,h2,h3,h4{font-family:var(--serif);font-weight:600;line-height:1.2;
    text-wrap:balance;margin:2rem 0 0.6rem;scroll-margin-top:1rem;}
  h1{font-size:2rem;margin-top:0;}
  h2{font-size:1.5rem;padding-top:1.2rem;border-top:1px solid var(--line);}
  h3{font-size:1.12rem;}
  h4{font-size:1rem;}
  p{margin:0 0 0.9rem;}
  a{color:var(--accent);text-underline-offset:3px;}
  a:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:3px;}
  ul,ol{margin:0 0 1rem;padding-left:1.3rem;}
  li{margin-bottom:0.4rem;}
  li::marker{color:var(--muted);}
  /* Le sommaire : des cibles larges, confortables au doigt sur téléphone. */
  ol li a{display:inline-block;padding:0.15rem 0;}
  blockquote{margin:1rem 0;padding:0.85rem 1.05rem;background:var(--raised);
    border-left:3px solid var(--accent);border-radius:0 10px 10px 0;color:var(--ink-soft);}
  code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.87em;
    background:var(--raised);padding:0.1rem 0.35rem;border-radius:5px;}
  hr{border:0;border-top:1px solid var(--line);margin:2rem 0;}
  .tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;
    background:var(--surface);margin:0 0 1.2rem;}
  table{border-collapse:collapse;width:100%;font-size:0.92rem;min-width:22rem;}
  th,td{text-align:left;padding:0.55rem 0.8rem;border-bottom:1px solid var(--line);
    vertical-align:top;}
  th{font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;
    color:var(--muted);white-space:nowrap;}
  tr:last-child td{border-bottom:none;}
  .retour{display:inline-block;font-size:0.76rem;color:var(--muted);
    text-decoration:none;margin:-0.3rem 0 1rem;}
  .retour:hover{color:var(--accent);text-decoration:underline;}
</style>
</head>
<body>
<main>
${corps}
</main>
</body>
</html>
`;

writeFileSync(SORTIE, page, "utf8");
console.log(`Page écrite : ${SORTIE}`);
