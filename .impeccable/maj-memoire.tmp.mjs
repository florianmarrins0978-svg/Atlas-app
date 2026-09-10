import { readFileSync, writeFileSync } from "node:fs";

function inserer(fichier, ancre, bloc, { apres = true } = {}) {
  let s = readFileSync(fichier, "utf8");
  const eol = s.includes("\r\n") ? "\r\n" : "\n";
  const i = s.indexOf(ancre);
  if (i < 0) throw new Error("ancre absente dans " + fichier + " : " + ancre);
  const p = apres ? i + ancre.length : i;
  const texte = bloc.split("\n").join(eol);
  writeFileSync(fichier, s.slice(0, p) + texte + s.slice(p), "utf8");
  console.log("écrit :", fichier);
}

// ── CHANGELOG ────────────────────────────────────────────────────────────────
inserer("CHANGELOG.md", "## 2026-09-03", `

### La liste de ses clients, proposée en planche essayable

**Ce qu'elle démontre, et qui n'était pas su :** sur quatre clients nommés
Martins, l'écran d'aujourd'hui n'affiche **rien qui les distingue** — la
deuxième ligne porte « 5 chantiers · 3 200,00 € facturés », et les quatre se
ressemblent. La planche y met **le lieu**.

**Rien n'y est inventé, et c'est le point.** Les cinq informations d'une ligne
existent déjà : \`clients.nom\`, \`clients.adresse\` (colonne présente, que la
liste ne charge pas), le compte de chantiers, \`resteDu()\`, et \`dernierJour\`
— **déjà calculé par \`listerFichesClients\`, jamais transmis à l'écran**. La
proposition ne demande donc pas de données neuves : deux valeurs à faire
descendre jusqu'à l'écran.

**Ce qui change d'autre :** le montant dû quitte les capitales de 9,5 px pour
16 px à côté du nom (c'est la seule chose de l'écran qui demande un geste) ; la
liste **annonce son ordre** par bandes de mois, alors qu'elle était déjà rangée
du chantier le plus récent au plus ancien sans le dire ; le compte remonte dans
l'en-tête et suit la recherche ; le gris secondaire passe de \`muted\` à
\`inkSoft\` — **3,32 de contraste contre 8,04**, et c'est ce qui s'efface au
soleil.

**Deux réparations vues en capture, pas en test :** la ligne du compte garde sa
place quand la recherche ne trouve rien (sans quoi le champ de saisie remontait
de 24 px sous le doigt à chaque frappe infructueuse), et la barre de recherche
est collante — sur vingt et un noms, l'outil qui sert à remonter ne doit pas
être resté en haut.

**La planche porte du JavaScript, contrairement à l'usage du dépôt** : c'est le
filtrage qu'il faut juger, et la règle y est recopiée de
\`src/lib/recherche-client.ts\` plutôt que réinventée. La liste est écrite dans
le HTML : sans script, elle reste lisible.

**\`appli/vos-clients.html\`, liée depuis \`appli/essais.html\` et
\`docs/maquettes/index.html\`. Rien n'est codé dans \`src/\`** — c'est la règle
de la maquette d'abord (\`CLAUDE.md\` §3 bis).

### Deux défauts du sommaire des essais, réparés au passage

**Le premier essai de \`appli/essais.html\` n'avait pas de balise de fin.** Le
navigateur refermait donc le lien sur le titre de famille suivant, qui devenait
cliquable et menait à la mauvaise planche. Vu en regardant la page, pas en la
lisant.

**Les 141 flèches décoratives de \`docs/maquettes/index.html\` sont retirées.**
Elles tombaient sous sa règle du 25 août — *« arrête de mettre des flèches,
c'est moche »* —, que \`scripts/test-aucune-fleche.ts\` ne pouvait pas voir :
il ne parcourt que \`src/\`. La ligne entière est déjà le lien.
`);

// ── TODO ─────────────────────────────────────────────────────────────────────
inserer("TODO.md", "---\n", `
## EN ATTENTE DE SA RÉPONSE : la liste de ses clients (3 sept. 2026)

Planche essayable : \`appli/vos-clients.html\`, en ligne sur
\`https://florianmarrins0978-svg.github.io/Atlas-app/vos-clients.html\`.

**Ce qu'il doit trancher, et rien d'autre :** le total facturé par client
(« 2 400,00 € facturés ») quitte la ligne. Deux montants sur une même ligne,
l'un gris l'autre rouge, se confondent d'un coup d'œil — mais depuis que la
fiche client a été allégée le 2 septembre, **ce total ne se lit plus nulle part
ailleurs**.

**Si la proposition est retenue, ce que ça coûte en code** — et c'est peu :

| | |
|---|---|
| \`clients.adresse\` | la colonne existe ; une ligne à ajouter dans \`listerFichesClients\` |
| \`dernierJour\` | **déjà calculé** par le même dépôt ; \`page.tsx\` ne le transmet pas |
| le reste | de la mise en forme dans \`ListeClients.tsx\` |

**Ne rien coder avant sa réponse** (\`CLAUDE.md\` §3 bis).

`, { apres: true });

console.log("fait");
