import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";

// **Rien de touchable ne doit être caché sous le mobilier fixe.**
//
// Trois défauts réels de ce dépôt sont de cette famille, et **aucun n'a été
// trouvé par un test** — tous à l'œil, sur une capture (`CLAUDE.md` §5) :
// une barre de navigation sur la page publique du client, une pile de
// notifications qui poussait le contenu hors de l'écran, et le 11 août 2026
// « ou rédiger le devis à la main » passé sous la bulle de l'assistant.
//
// Ils se ressemblent tous : **l'élément existe, il est dans le HTML, il répond
// même au clic programmé** — et le doigt ne l'atteint pas, parce que quelque
// chose flotte au-dessus. Toute vérification par le texte reste verte. Seule
// une mesure voit la différence.
//
// Un contrôle de cette sorte existait déjà, mais pour **un** bouton d'**un**
// écran (`test-agenda-reglages-e2e.ts`). Celui-ci le fait sur tous les écrans
// du parcours, et sur tout ce qui se touche.
//
// **Il ne vaut que depuis le 11 août 2026**, jour où les suites sont passées à
// la taille d'un vrai téléphone (`e2e-browser.ts`, `ECRAN_DU_PATRON`). Sur le
// cadre de 852 px qu'on employait avant, la bulle tombait 190 px plus bas et ne
// recouvrait jamais rien : ce contrôle aurait été vert d'un bout à l'autre, y
// compris le jour du défaut.

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
 * Ce que le navigateur seul peut dire d'un écran.
 *
 * Pour chaque chose touchable — lien, bouton, champ — on demande au navigateur
 * **qui répondrait au doigt** en son centre. Si ce n'est pas elle, ni un de ses
 * enfants, c'est qu'autre chose flotte par-dessus.
 *
 * **On ne conclut qu'après avoir fait ce que le doigt ferait.** C'est la
 * précaution qui a coûté le plus cher à écrire, et sans laquelle cette suite
 * accusait vingt éléments parfaitement sains : un bouton posé sous la barre du
 * bas n'est pas hors d'atteinte, il attend qu'on défile. On amène donc chaque
 * cible au centre de l'écran AVANT de mesurer. Ce qui reste recouvert après ce
 * geste l'est pour de bon — il n'existe aucune position où l'artisan
 * l'atteindrait. Une erreur qui accuse à tort coûte plus cher que pas d'erreur
 * du tout (`AGENTS.md`).
 *
 * Trois précautions de plus, chacune payée par un faux positif :
 *
 *   - **on ne juge que ce qui est visible.** Un panneau replié, un tiroir fermé
 *     portent des boutons hors écran : les compter reviendrait à crier sur des
 *     écrans parfaitement sains.
 *   - **le recouvrement par un parent ou un enfant n'en est pas un.**
 *     `elementFromPoint` rend l'élément le plus profond ; un lien dont le centre
 *     tombe sur son propre libellé rend le `<span>`, pas le `<a>`.
 *   - **ni ce qu'un parent DÉCOUPE.** Un encart replié (« à facturer », au
 *     repos) garde ses liens dans la page : `checkVisibility` les dit visibles,
 *     puisqu'ils ne sont ni masqués ni transparents — ils sont simplement
 *     rognés par un `overflow: hidden`. Onze d'entre eux étaient accusés d'être
 *     recouverts alors qu'ils n'étaient pas à l'écran du tout. On remonte donc
 *     la parenté et l'on écarte ce qui tombe hors de son découpage.
 */
const SONDE = `(async () => {
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Un parent qui rogne cache-t-il cette chose ? */
  const decoupe = (el) => {
    let p = el.parentElement;
    while (p) {
      const s = getComputedStyle(p);
      if (/hidden|clip|auto|scroll/.test(s.overflow + s.overflowX + s.overflowY)) {
        const a = el.getBoundingClientRect();
        const b = p.getBoundingClientRect();
        const largeur = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const hauteur = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (largeur < 4 || hauteur < 4) return true;
      }
      p = p.parentElement;
    }
    return false;
  };

  const gene = [];
  const cibles = [...document.querySelectorAll("a[href], button, input, select, textarea, [role='button']")];
  for (const cible of cibles) {
    if (cible.disabled) continue;
    if (!cible.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    let r = cible.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;

    // **Le geste du doigt : amener la chose au milieu de l'écran.**
    cible.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    await attendre(60);
    r = cible.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    if (decoupe(cible)) continue;

    const x = Math.min(Math.max(r.x + r.width / 2, 1), innerWidth - 1);
    const y = Math.min(Math.max(r.y + r.height / 2, 1), innerHeight - 1);
    const dessus = document.elementFromPoint(x, y);
    if (!dessus) continue;
    if (dessus === cible || cible.contains(dessus) || dessus.contains(cible)) continue;

    // **L'outillage de Next n'est pas le produit.** Son badge de développement
    // — un \`<nextjs-portal>\` — se pose en bas à gauche, exactement sur
    // l'onglet « CHANTIERS ». Il n'apparaît que lorsqu'il a quelque chose à
    // signaler, et il n'existe PAS dans la version bâtie : le 12 août 2026, la
    // CI a viré au rouge six fois pour lui, pendant que la suite passait ici où
    // rien n'était signalé.
    //
    // **Un contrôle qui échoue au hasard est pire qu'aucun contrôle** : il
    // apprend à ignorer le rouge, et c'est ainsi qu'on perd la seule suite qui
    // sache voir un bouton inatteignable. On l'écarte donc, nommément — pas en
    // relâchant la mesure, qui continue de tout attraper d'autre.
    //
    // Ce que cela ne règle PAS, et qui est dans \`TODO.md\` : sur le banc du
    // patron, qui sert le mode développement, ce badge recouvre bel et bien son
    // onglet « Chantiers » dès qu'il a un signalement.
    if (/^NEXTJS-/.test(dessus.tagName) || dessus.closest("nextjs-portal")) continue;

    const nom = (cible.innerText || cible.getAttribute("aria-label") || cible.getAttribute("placeholder") || cible.tagName).replace(/\\s+/g, " ").trim().slice(0, 48);
    const voleur = (dessus.getAttribute("data-atlas") || dessus.className || dessus.tagName).toString().replace(/\\s+/g, " ").trim().slice(0, 48);
    gene.push(nom + " ← recouvert par « " + voleur + " »");
  }
  return gene;
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
    ["mes prix", "/reglages/prix"],
    ["mon agenda", "/reglages/agenda"],
    ["mes données", "/reglages/mes-donnees"],
    ["un nouveau chantier", "/chantiers/nouveau"],
  ];
  if (chantier) {
    liste.push(
      // Ses photos n'ont plus d'écran : elles vivent dans la pellicule du
      // tiroir de la fiche, ci-dessus (11 août 2026).
      ["la fiche d'un chantier", `/chantiers/${chantier}`],
      ["sa note vocale", `/chantiers/${chantier}/note-vocale`],
      ["ses informations", `/chantiers/${chantier}/informations`],
      ["son prix", `/chantiers/${chantier}/prix`],
      ["son devis à la main", `/chantiers/${chantier}/devis-complet`]
    );
  }
  return liste;
}

async function main() {
  console.log("=== Rien de touchable n'est caché sous le mobilier fixe ===\n");

  const navigateur = await lancerNavigateur();
  // Pas de `viewport` : l'écran du patron vient de `e2e-browser`. C'est TOUT
  // l'objet de cette suite — sur un cadre plus haut, elle ne verrait rien.
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **Le contrôle doit d'abord prouver qu'il regarde le bon écran.** Sur un
  // cadre de 852 px, il serait vert partout sans rien avoir éprouvé — c'est
  // exactement ce qui est arrivé au contrôle de la bulle, en août 2026.
  const cadre = await page.evaluate(() => `${innerWidth}×${innerHeight}`);
  await cas(`l'écran mesuré est celui d'un vrai téléphone (${cadre})`, async () => {
    const [, hauteur] = cadre.split("×").map(Number);
    if (hauteur > 700) {
      throw new Error(
        `la fenêtre fait ${cadre} : plus haute que la place réelle d'un téléphone ` +
          `(390 × 664). Sur ce cadre, cette suite ne peut RIEN attraper.`
      );
    }
  });

  for (const [quoi, chemin] of await ecrans()) {
    await cas(`${quoi} — rien n'est recouvert`, async () => {
      await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      // Les entrées en scène (le tiroir qui monte, la bulle qui apparaît) se
      // jouent en quelques centaines de millisecondes : mesurer avant, c'est
      // mesurer un écran qui n'est pas encore le sien.
      await page.waitForTimeout(900);
      const genes = (await page.evaluate(SONDE)) as string[];
      if (genes.length > 0) {
        throw new Error(
          `${genes.length} élément(s) hors d'atteinte du doigt :\n      ` + genes.join("\n      ")
        );
      }
    });
  }

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Rien de recouvert — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
