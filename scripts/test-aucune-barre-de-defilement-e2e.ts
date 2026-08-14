import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";

// **Aucune zone qui défile ne montre sa barre.**
//
// Le patron, le 11 août 2026, capture à l'appui : *« quand on slide, il y a une
// espèce de bande déroulante grise qui apparaît sur le côté à droite.
// Supprime-moi ça, je ne veux pas voir ça du tout, je veux juste que ça
// slide. »*
//
// Ce n'était pas un désaccord de goût, c'était un oubli. Trois zones qui
// défilent la masquaient déjà — `.atlas-glisse`, `.atlas-glisseur`,
// `.atlas-pellicule` — et la quatrième, **la plus vue de l'application**, avait
// été sautée. Rien ne pouvait le dire : chaque zone porte la règle chez elle,
// et personne ne compte les zones.
//
// D'où le balayage. Corriger `.atlas-fil-defile` seul aurait réparé ce
// jour-là ; ce contrôle répare la classe entière, y compris la zone qui n'existe
// pas encore.
//
// **Ce qu'il regarde, et ce qu'il ne regarde pas.** Il lit `scrollbar-width` sur
// chaque zone qui défile pour de bon — pas les pixels. Ce n'est pas un choix de
// facilité : dans ce navigateur sans tête, la barre est en surimpression, elle
// ne prend aucune largeur (`offsetWidth - clientWidth` vaut zéro même quand elle
// s'affiche) et elle n'apparaît qu'en cours de geste, donc jamais sur une
// capture. La propriété calculée, elle, est exactement ce qui décide que le
// navigateur la peigne ou non — chez le patron comme ici. Le dire plutôt que de
// laisser croire à une vérification de l'image (`AGENTS.md`).

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/**
 * Les zones qui défilent VRAIMENT, et ce qu'elles déclarent.
 *
 * Deux précautions, chacune contre un faux positif :
 *
 *   - **on ne retient que ce qui déborde.** Un `overflow: auto` dont le contenu
 *     tient tout entier ne montre aucune barre ; exiger la règle sur lui serait
 *     accuser un écran sain.
 *   - **on écarte `<html>` et `<body>`.** La page entière ne défile pas dans
 *     cette application — chaque écran tient dans un cadre fixe — mais un
 *     débordement d'un pixel suffirait à les faire entrer dans la liste, et la
 *     barre de la fenêtre n'est pas de notre ressort.
 */
const SONDE = `(() => {
  const fautives = [];
  for (const el of document.querySelectorAll("*")) {
    if (el === document.documentElement || el === document.body) continue;
    const s = getComputedStyle(el);
    const deborde =
      (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) ||
      (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1);
    if (!deborde) continue;
    if (s.scrollbarWidth === "none") continue;
    const nom =
      el.tagName.toLowerCase() +
      (typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\\s+/).slice(0, 4).join(".")
        : "");
    fautives.push(nom + " (scrollbar-width: " + s.scrollbarWidth + ")");
  }
  return fautives;
})()`;

/** Les écrans du parcours, tels que l'artisan les traverse. */
async function ecrans(): Promise<Array<[string, string]>> {
  const { rows } = await pool.query(
    `select c.id
       from chantiers c
       join notes_vocales n on n.chantier_id = c.id
      limit 1`
  );
  const chantier = rows[0]?.id as string | undefined;
  const liste: Array<[string, string]> = [
    ["l'accueil", "/"],
    ["le planning", "/planning"],
    ["les terminés", "/termines"],
    ["les réglages", "/reglages"],
    ["les tarifs", "/reglages/tarifs"],
    ["le planning réglé", "/reglages/planning"],
    ["Atlas IA", "/reglages/ia"],
    ["mes prix", "/reglages/prix"],
    ["mon agenda", "/reglages/agenda"],
    // « /reglages/mes-donnees » n'a JAMAIS existé : cette ligne éprouvait une
    // page d'erreur en croyant éprouver un écran. La rubrique s'appelle
    // « /reglages/donnees » depuis le 14 août 2026 (`ARCHITECTURE.md` §96).
    ["mes données", "/reglages/donnees"],
    ["un nouveau chantier", "/chantiers/nouveau"],
  ];
  if (chantier) {
    liste.push(
      // Ses photos n'ont plus d'écran depuis le 11 août 2026 : elles vivent
      // dans la pellicule du tiroir de la fiche, ci-dessus (`ARCHITECTURE.md`
      // §60). Cette ligne a été écrite sur une branche partie avant la
      // suppression — laissée en place, elle aurait fait mesurer une page 404,
      // qui n'a évidemment aucune barre : un contrôle vert sur du vide.
      ["la fiche d'un chantier", `/chantiers/${chantier}`],
      ["sa note vocale", `/chantiers/${chantier}/note-vocale`],
      ["son devis à la main", `/chantiers/${chantier}/devis-complet`]
    );
  }
  return liste;
}

async function main() {
  console.log("=== Aucune zone qui défile ne montre sa barre ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **Un contrôle qui ne trouve jamais de zone à examiner est vert pour rien.**
  // C'est le mode de défaillance propre à un balayage : il ne dit pas « tout va
  // bien », il dit « je n'ai rien regardé » — et les deux se ressemblent à
  // l'écran. On exige donc d'en avoir vu au moins une avant de conclure.
  let zonesVues = 0;

  for (const [quoi, chemin] of await ecrans()) {
    await cas(`${quoi} — aucune barre visible`, async () => {
      await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(700);
      const compte = (await page.evaluate(`(() => {
        let n = 0;
        for (const el of document.querySelectorAll("*")) {
          if (el === document.documentElement || el === document.body) continue;
          const s = getComputedStyle(el);
          if ((/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) ||
              (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1)) n++;
        }
        return n;
      })()`)) as number;
      zonesVues += compte;
      const fautives = (await page.evaluate(SONDE)) as string[];
      if (fautives.length > 0) {
        throw new Error(
          `${fautives.length} zone(s) qui défilent laissent voir leur barre :\n      ` +
            fautives.join("\n      ") +
            `\n      Ajouter « scrollbar-width: none » et la règle ::-webkit-scrollbar,` +
            ` comme .atlas-glisse le fait déjà.`
        );
      }
    });
  }

  await cas(`le balayage a bien trouvé des zones qui défilent (${zonesVues})`, async () => {
    if (zonesVues === 0) {
      throw new Error(
        "aucune zone qui défile n'a été rencontrée sur tout le parcours. Ce n'est " +
          "pas une bonne nouvelle : ce contrôle n'a rien éprouvé. Les données de " +
          "démonstration sont-elles chargées (une liste trop courte ne déborde pas) ?"
      );
    }
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Barres de défilement — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
