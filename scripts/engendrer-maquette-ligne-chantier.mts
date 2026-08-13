// Engendre `docs/maquettes/40-la-ligne-sous-le-nom.html` à partir de VRAIES
// captures de l'application.
//
// **Pourquoi engendrer plutôt que dessiner.** Le patron, le 13 août 2026 :
// *« il faut le notifier sous le nom […] je te laisse libre de proposer des
// alternatives »*. Une maquette dessinée à la main aurait tranché la question
// la plus importante — **est-ce que ça tient sur une ligne ?** — avec de
// fausses mesures : une page HTML ordinaire rend ces mots plus larges qu'Inter
// dans l'application, et son retour à la ligne ment donc dans le sens qui
// décourage les libellés longs.
//
// Chaque variante est ici photographiée SUR L'ÉCRAN RÉEL, à deux largeurs :
// celle de son téléphone (430 px) et celle d'un téléphone plus étroit
// (390 px), où la même phrase peut passer sur deux lignes.
//
// Aucune ligne de script dans la page produite : les captures y sont
// embarquées en `data:` (leçon du 12 août — une maquette qui engendre son
// contenu en JavaScript s'ouvre vide chez lui).
//
// Usage, l'application démarrée sur le port 3000 :
//   npx tsx scripts/engendrer-maquette-ligne-chantier.mts

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lancerNavigateur } from "./e2e-browser";

const BASE = "http://localhost:3000";
const SORTIE = "docs/maquettes/40-la-ligne-sous-le-nom.html";
const LARGEURS = [430, 390] as const;

type Variante = {
  cle: string;
  lettre: string;
  nom: string;
  dit: string;
  etat: string;
  clair?: string;
  dore?: boolean;
  note: string;
  marque?: string;
};

const VARIANTES: Variante[] = [
  {
    cle: "0",
    lettre: "Aujourd’hui",
    nom: "",
    dit: "Ce que vous avez sous les yeux, nom corrigé.",
    etat: "En attente de réponse · sans photo",
    note:
      "Elle ne dit pas <b>ce qui</b> attend : « en attente de réponse » se lit aussi bien pour " +
      "un devis parti que pour un client qu’on n’a pas rappelé. Et « sans photo » n’a plus " +
      "d’utilité une fois le devis chiffré et parti.",
  },
  {
    cle: "A",
    lettre: "A",
    nom: "vos mots, et rien de plus",
    dit: "« Devis envoyé · en attente de réponse »",
    etat: "Devis envoyé · en attente de réponse",
    note:
      "Ce que vous avez demandé, au mot près. La mention des photos <b>disparaît une fois le " +
      "devis parti</b> : elle sert à savoir s’il reste de quoi chiffrer, pas après.",
    marque: "Le moins d’encre possible",
  },
  {
    cle: "B",
    lettre: "B",
    nom: "avec le temps écoulé",
    dit: "« Envoyé il y a 3 jours · sans réponse »",
    etat: "Envoyé il y a 3 jours · sans réponse",
    note:
      "<b>Le délai est la seule chose qui décide quelque chose.</b> Trois jours, on attend ; " +
      "douze, on rappelle. La date à gauche, elle, n’est pas celle de l’envoi — c’est la " +
      "dernière fois que le chantier a bougé.",
    marque: "Recommandée",
  },
  {
    cle: "C",
    lettre: "C",
    nom: "avec l’échéance du lien",
    dit: "« Envoyé le 10 août · valable jusqu’au 24 »",
    etat: "Envoyé le 10 août · valable jusqu'au 24",
    note:
      "Le lien du client expire : passée cette date, votre devis n’est plus ouvrable et le " +
      "chantier passe « caduc ». Le dire tôt évite la surprise — mais <b>deux dates sur une " +
      "ligne se relisent deux fois</b>, et celle-ci déborde même sur votre téléphone.",
    marque: "Précise, et dense",
  },
  {
    cle: "D",
    lettre: "D",
    nom: "deux lignes : l’état, puis la suite",
    dit: "« Devis envoyé · sans réponse », puis une phrase en clair",
    etat: "Devis envoyé · sans réponse",
    clair: "Parti il y a 3 jours — à relancer à partir du 17 août.",
    dore: true,
    note:
      "La plus bavarde, et la seule qui <b>dise quoi faire</b>. En or, parce qu’elle appelle " +
      "un geste. <b>Le risque est réel :</b> si chaque ligne grandit, la liste cesse de se " +
      "parcourir du pouce — et l’or, mis partout, ne désigne plus rien.",
    marque: "Utile, mais elle pèse",
  },
  {
    cle: "E",
    lettre: "E",
    nom: "avec le montant en jeu",
    dit: "« Devis 1 240 € envoyé · sans réponse depuis 3 jours »",
    etat: "Devis 1 240 € envoyé · sans réponse depuis 3 jours",
    note:
      "On voit d’un coup d’œil ce qui est en jeu, et lequel rappeler d’abord. <b>Deux " +
      "réserves :</b> c’est la seule variante qui coûte une requête de plus, et un montant en " +
      "tête de liste se lit par-dessus votre épaule.",
    marque: "À trancher par vous",
  },
];

const navigateur = await lancerNavigateur();
const dossier = mkdtempSync(join(tmpdir(), "atlas-ligne-"));
/** `cle@largeur` → image en `data:`. */
const captures = new Map<string, string>();

for (const largeur of LARGEURS) {
  const contexte = await navigateur.newContext({
    viewport: { width: largeur, height: 760 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 60_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready);

  for (const v of VARIANTES) {
    const boite = await page.evaluate((v) => {
      const brin = document.querySelector(".atlas-brin") as HTMLElement;
      // **On nettoie AVANT de désigner la ligne d'état.** Cherché d'abord,
      // `p:last-of-type` tombait sur la ligne injectée par la variante
      // précédente — qu'on retirait aussitôt : le texte partait alors sur un
      // nœud détaché, et la capture montrait la variante d'avant. Défaut réel,
      // vu à l'œil sur la planche assemblée.
      brin.querySelectorAll("[data-essai-ligne]").forEach((e) => e.remove());
      const etat = brin.querySelector("p:last-of-type") as HTMLElement;
      // Le nom et l'adresse de SA capture : c'est sa ligne qu'on lui montre, et
      // elle porte au passage la correction du nom (« Martins », plus « Chez »).
      (brin.querySelector("h2") as HTMLElement).textContent = "Martins";
      (brin.querySelector("p") as HTMLElement).textContent =
        "10 rues d'enfer rocheux ros 78 200 nantes la jolie";
      etat.textContent = v.etat;
      etat.style.color = v.dore ? "#B98B47" : "";
      if (v.clair) {
        const q = document.createElement("p");
        q.dataset.essaiLigne = "1";
        q.textContent = v.clair;
        q.setAttribute(
          "style",
          "margin:5px 0 0;font-size:11.5px;color:#8a8578;letter-spacing:0;text-transform:none;line-height:1.35"
        );
        etat.after(q);
      }
      const r = brin.getBoundingClientRect();
      return { y: r.y - 16, hauteur: r.height + 30, largeur: window.innerWidth };
    }, v);
    await page.waitForTimeout(150);
    const chemin = join(dossier, `${v.cle}-${largeur}.png`);
    await page.screenshot({
      path: chemin,
      clip: { x: 0, y: Math.max(0, boite.y), width: boite.largeur, height: boite.hauteur },
    });
    captures.set(
      `${v.cle}@${largeur}`,
      `data:image/png;base64,${readFileSync(chemin).toString("base64")}`
    );
  }
  await contexte.close();
}
await navigateur.close();

const blocs = VARIANTES.map(
  (v) => `
  <div class="bloc">
    <div class="tete"><span class="lettre">${v.lettre}</span><span class="nom">${v.nom}</span></div>
    <p class="dit">${v.dit}</p>
    <figure class="capture">
      <img alt="La ligne sur un téléphone de 430 px" src="${captures.get(`${v.cle}@430`)}">
      <figcaption>Sur VOTRE téléphone — 430 px</figcaption>
    </figure>
    <figure class="capture etroit">
      <img alt="La même ligne sur un téléphone de 390 px" src="${captures.get(`${v.cle}@390`)}">
      <figcaption>Sur un téléphone plus étroit — 390 px</figcaption>
    </figure>
    <p class="note">${v.note}${v.marque ? `<span class="marque">${v.marque}</span>` : ""}</p>
  </div>`
).join("\n");

const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas — la ligne sous le nom</title>
</head>
<body>
<style>
  /*
    CE QUI S'ÉCRIT SOUS LE NOM D'UN CHANTIER, DANS LA LISTE.

    « Le devis a été envoyé et il n'a toujours pas eu de réponse. Il faut le
      notifier sous le nom. Tu marques quelque chose du style devis envoyé,
      attente de réponse. Je te laisse libre de choisir et de proposer des
      alternatives si tu penses qu'il faudrait rajouter d'autres informations à
      ce niveau-là. » — le patron, le 13 août 2026

    ─── Ce qui est DÉJÀ corrigé, et n'attend pas ce choix ───────────────────

    « Chez Martins » est devenu « Martins » : le nom du client tel qu'il l'a
    écrit. C'est visible sur toutes les captures.

    **La civilité vient de lui.** « M. » déduit d'un patronyme suppose un
    genre — « Martins » peut être une femme — et le dépôt n'invente aucune
    donnée. Le champ de création propose « M. Bernard » en exemple : ce qu'il
    tape s'affiche tel quel. Pour lire « Mr Martins », il écrit « Mr Martins ».

    ─── Cette page n'est pas dessinée, elle est PHOTOGRAPHIÉE ───────────────

    Engendrée par \`scripts/engendrer-maquette-ligne-chantier.mts\`, qui joue
    chaque libellé dans l'application et la photographie à deux largeurs.
    Une maquette dessinée aurait tranché la question la plus importante — « est-ce
    que ça tient sur une ligne ? » — avec de fausses mesures : une page HTML
    ordinaire rend ces mots plus larges qu'Inter dans l'application.

    Aucune ligne de script ici : les captures sont embarquées.
  */

  :root{
    --fond:#f5f3ee; --carte:#faf9f5; --encre:#1c1c1a; --gris:#8a8578;
    --pin:#2f3b2f; --or:#B98B47; --trait:rgba(28,28,26,.12); --ombre:rgba(20,18,14,.16);
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --fond:#15140f; --carte:#1d1c17; --encre:#ece8de; --gris:#8f8a7d;
      --pin:#3b4a3a; --or:#C9A15E; --trait:rgba(236,232,222,.16); --ombre:rgba(0,0,0,.5);
    }
  }
  :root[data-theme="dark"]{
    --fond:#15140f; --carte:#1d1c17; --encre:#ece8de; --gris:#8f8a7d;
    --pin:#3b4a3a; --or:#C9A15E; --trait:rgba(236,232,222,.16); --ombre:rgba(0,0,0,.5);
  }

  *{box-sizing:border-box}
  body{margin:0;background:var(--fond);color:var(--encre);
       font:16px/1.65 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
       padding:52px 16px 110px;-webkit-font-smoothing:antialiased}
  .page{max-width:760px;margin:0 auto}

  .intro{text-align:center}
  .intro .sur{margin:0 0 18px;font-size:10px;letter-spacing:.36em;text-transform:uppercase;color:var(--or)}
  .intro h1{margin:0;font:400 clamp(28px,4vw,38px)/1.14 ui-serif,Georgia,"Iowan Old Style",serif;
            letter-spacing:-.014em;text-wrap:balance}
  .regle{width:56px;height:1px;background:var(--or);margin:20px auto 22px;opacity:.75}
  .intro p{margin:0 0 12px;color:var(--gris);font-size:15px}
  .intro b{color:var(--encre);font-weight:500}
  .appui{margin:24px 0 0;padding:16px 22px;border:1px solid var(--trait);border-radius:6px;
         font-size:13.5px;color:var(--gris);line-height:1.68;text-align:left}
  .appui b{color:var(--encre);font-weight:500}

  .famille{margin:56px 0 6px;text-align:center;font-size:10px;letter-spacing:.3em;
           text-transform:uppercase;color:var(--or)}
  .sous-titre{margin:0 auto 34px;max-width:60ch;text-align:center;color:var(--gris);font-size:14px}

  .capture{margin:0 auto 14px;max-width:430px}
  .capture img{display:block;width:100%;height:auto;border-radius:12px;
               border:1px solid var(--trait);box-shadow:0 12px 30px var(--ombre)}
  .capture figcaption{margin-top:7px;text-align:center;font-size:10px;letter-spacing:.22em;
                      text-transform:uppercase;color:var(--gris)}
  .capture.etroit{max-width:390px;opacity:.94}
  .dit{margin:0 0 14px;text-align:center;font-size:13.5px;color:var(--gris)}

  .bloc{margin:0 0 52px}
  .tete{display:flex;align-items:baseline;gap:10px;justify-content:center;margin:0 0 4px}
  .tete .lettre{font:500 13px/1 ui-serif,Georgia,serif;color:var(--or)}
  .tete .nom{font-size:13.5px;font-weight:500}
  .note{max-width:54ch;margin:14px auto 0;text-align:center;font-size:13px;color:var(--gris);line-height:1.6}
  .note b{color:var(--encre);font-weight:500}
  .marque{display:inline-block;margin-top:10px;padding:3px 11px;border-radius:9999px;
          border:1px solid var(--trait);font-size:10.5px;letter-spacing:.12em;
          text-transform:uppercase;color:var(--gris)}

  table{border-collapse:collapse;margin:40px auto 0;font-size:13px;width:100%}
  th,td{border-bottom:1px solid var(--trait);padding:10px 12px;text-align:left;vertical-align:top}
  th{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--or);font-weight:400}
  td{color:var(--gris)}
  td b{color:var(--encre);font-weight:500}
</style>

<div class="page">

  <div class="intro">
    <p class="sur">Écran chantiers · la ligne sous le nom</p>
    <h1>Dire qu’un devis attend</h1>
    <div class="regle"></div>
    <p>Le nom est <b>déjà corrigé</b> partout : « Martins », plus « Chez Martins ».
       Ce qui suit est la <b>troisième ligne</b> — celle qui dit où en est le
       chantier. <b>Rien n’est codé.</b></p>

    <div class="appui">
      <b>Pourquoi cette ligne est grise et non dorée.</b> L’or est réservé à ce qui
      <b>attend un geste de vous</b> : un devis retourné, une correction demandée,
      une relance due. Un devis parti dont le client n’a pas encore répondu
      n’attend rien de vous — le laisser gris, c’est vous dire « rien à faire
      ici ». La variante <b>D</b> rouvre ce choix, et elle est la seule.
      <br><br>
      <b>Aucune ne coûte une requête de plus, sauf E</b> : l’écran charge déjà la
      date d’envoi du devis et la date d’expiration du lien. Le montant, non.
      <br><br>
      <b>Ce ne sont pas des dessins.</b> Chaque ligne est une capture de
      l’application, prise à la largeur de votre téléphone puis à celle d’un plus
      étroit — c’est là qu’on voit ce qui tient sur une ligne et ce qui déborde.
    </div>
  </div>

  <p class="famille">Les propositions</p>
  <p class="sous-titre">La première est l’état actuel, pour comparer.</p>
${blocs}

  <table>
    <tr><th>Ce qui les sépare</th><th>Ce qu’elle apprend</th><th>Ce qu’elle coûte</th></tr>
    <tr><td><b>A · vos mots</b></td><td>ce qui s’est passé, et ce qu’on attend</td><td>rien</td></tr>
    <tr><td><b>B · le délai</b></td><td>quand rappeler — la seule chose qui décide</td><td>rien</td></tr>
    <tr><td><b>C · l’échéance</b></td><td>quand le devis cessera d’être ouvrable</td><td>deux dates à relire, et ça déborde</td></tr>
    <tr><td><b>D · deux lignes</b></td><td>ce qu’il y a à faire, en toutes lettres</td><td>la liste s’allonge, l’or se dilue</td></tr>
    <tr><td><b>E · le montant</b></td><td>lequel rappeler en premier</td><td>une requête de plus, et un prix visible</td></tr>
  </table>

</div>
</body>
</html>
`;

writeFileSync(SORTIE, page);
console.log(`✅ ${SORTIE} — ${captures.size} captures réelles embarquées.`);
