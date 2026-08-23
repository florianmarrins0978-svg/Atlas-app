import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import type { NomCharte } from "../src/lib/chartes";

/**
 * LE MODE NUIT SE LIT — mesuré sur les écrans, pas sur la palette.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * *Le patron, le 22 août 2026, capture du planning à l'appui :*
 * ***« Le mode nuit est illisible. Corrige ça. »***
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **POURQUOI CETTE SUITE EXISTE À CÔTÉ DE `test-chartes-lisibles.ts`.** Celle-là
 * mesure les sept chartes — treize jetons, quelques couples, aucun navigateur.
 * Elle est indispensable et elle n'aurait rien vu du défaut qu'il a signalé :
 * la pastille d'équipe portait « Julien ＋ » en **`#faf9f5` écrit en clair dans
 * l'écran**, hors de toute charte. Aucune palette ne pouvait le dire ; seule
 * la page rendue le sait.
 *
 * **CE QU'ELLE MESURE, ET POURQUOI PAS UN SEUIL.** Elle ouvre chaque écran deux
 * fois — une fois en « Origine », une fois en « Nuit » — et compare **le même
 * texte à lui-même**. La règle est celle du dépôt et pas celle d'une norme :
 * *le sombre ne fait pas moins bien que le clair*. Un seuil écrit ici ferait
 * rougir des dessins que le patron a choisis — sur Origine, le chevron de
 * navigation tient 2,6 et le bordeaux du dépassement 1,10 contre le vert pin :
 * ce sont ses choix, et une suite qui les accuse est une suite qui empêche son
 * écran de changer (`CLAUDE.md` §5 bis).
 *
 * **ELLE REFUSE DE CONCLURE SUR RIEN.** Un contrôle qui mesure zéro ne mesure
 * rien, et il est pire qu'absent parce qu'il rassure (`CLAUDE.md` §5, payé le
 * 15 août 2026). Si un écran ne rend pas assez de textes comparables — page
 * blanche, session perdue, contenu qui a changé entre les deux passes —, elle
 * le dit et elle rougit.
 *
 * **ELLE REND « ORIGINE » EN PARTANT, même en cas d'échec.** Le compte de
 * démonstration sert aux quatre-vingts suites de la batterie : le laisser en
 * « Nuit » repeindrait tous les écrans suivants, et leurs contrôles de couleur
 * accuseraient leur propre écran.
 *
 * **Elle sait échouer**, et cela a été vérifié en la confrontant à l'état
 * qu'elle prétend détecter : en rendant à `PlanningClient` son `#faf9f5` écrit
 * en clair, elle rougit sur « Julien ＋ » en donnant les deux mesures.
 */

const BASE = "http://localhost:3000";
const ORIGINE: NomCharte = "origine";
const NUIT: NomCharte = "nuit";

/**
 * Ce qu'on accepte de perdre en passant au sombre.
 *
 * Pas zéro : deux voiles calculés — `color-mix` sur l'encre — ne rendent pas
 * exactement le même rapport d'un fond à l'autre, et un écart de quelques
 * centièmes n'est pas un défaut. Un cinquième, en revanche, se voit.
 */
const PERTE_TOLEREE = 0.8;
/** En dessous, un texte ne se lit plus, quelle que soit la charte de départ. */
const PLANCHER = 3;
/** Moins que cela sur un écran, et la mesure n'a pas eu lieu. */
const MINIMUM_MESURABLE = 6;

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

/**
 * La sonde : pour chaque texte visible, sa couleur composée sur son fond réel.
 *
 * **Le fond ne se lit pas sur l'élément** — il est presque toujours
 * transparent. On remonte ses parents en empilant ce qu'on trouve, jusqu'au
 * premier fond opaque, et on compose. Sans cela, tout se mesurerait contre du
 * blanc et le contrôle serait faux exactement sur les chartes sombres.
 *
 * **L'opacité HÉRITÉE compte, mais on l'écarte du verdict.** Le fil des
 * chantiers efface volontairement ce qui n'est pas au centre (0,45) : le
 * mesurer donnerait un rouge sur un effet voulu, et le même des deux côtés.
 */
const SONDE = `(() => {
  const lire = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some((x) => Number.isNaN(x))) return null;
    return { r: p[0], v: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const poser = (dessus, dessous) => ({
    r: dessus.r * dessus.a + dessous.r * (1 - dessus.a),
    v: dessus.v * dessus.a + dessous.v * (1 - dessus.a),
    b: dessus.b * dessus.a + dessous.b * (1 - dessus.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.v) + 0.0722 * f(c.b);
  };
  const rapport = (a, b) => {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const fondDe = (el) => {
    const pile = [];
    for (let n = el; n; n = n.parentElement) {
      const c = lire(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) pile.push(c);
      if (c && c.a === 1) break;
    }
    let fond = { r: 255, v: 255, b: 255, a: 1 };
    for (let i = pile.length - 1; i >= 0; i--) fond = poser(pile[i], fond);
    return fond;
  };
  const sortie = [];
  for (const el of document.querySelectorAll("body *")) {
    const texte = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!texte) continue;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const avant = lire(getComputedStyle(el).color);
    if (!avant) continue;
    const fond = fondDe(el);
    sortie.push({
      cle: el.tagName.toLowerCase() + "|" + (el.getAttribute("data-atlas") ?? "") + "|" + texte.slice(0, 40),
      texte: texte.slice(0, 40),
      couleur: getComputedStyle(el).color,
      contraste: Math.round(rapport(poser(avant, fond), fond) * 100) / 100,
    });
  }
  return sortie;
})()`;

type Mesure = { cle: string; texte: string; couleur: string; contraste: number };

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  return page;
}

/**
 * Les écrans parcourus.
 *
 * **Le planning ouvre un jour**, parce que c'est là que le défaut vivait : la
 * pastille d'équipe ne s'affiche qu'une fois la fiche du jour dépliée, et un
 * parcours qui se contente du mois n'aurait jamais vu « Julien ＋ ».
 */
const ECRANS: { nom: string; route: string; apres?: (p: Page) => Promise<void> }[] = [
  { nom: "l'accueil", route: "/" },
  {
    nom: "le planning, une journée ouverte",
    route: "/planning",
    apres: async (page) => {
      await page.waitForSelector("[data-atlas='grille-mois']", { timeout: 30_000 });
      const jour = (await page.evaluate(`(() => {
        const cases = [...document.querySelectorAll("[data-atlas='grille-mois'] [data-jour]")];
        const occupe = cases.find((c) =>
          [...c.querySelectorAll("[data-demi]")].some((b) => b.getAttribute("data-etat") !== "libre"));
        return (occupe ?? cases[10])?.getAttribute("data-jour") ?? null;
      })()`)) as string | null;
      if (jour) {
        await page.click(`[data-atlas='grille-mois'] [data-jour="${jour}"]`);
        await page.waitForTimeout(900);
      }
    },
  },
  { nom: "les terminés", route: "/termines" },
  // La TVA porte la bande d'accent et le voile d'or — deux endroits qui
  // posaient un fond clair écrit en dur, donc une bande blanche sous une encre
  // claire sur les deux chartes sombres.
  { nom: "la TVA", route: "/termines/tva" },
  { nom: "les clients", route: "/clients" },
  { nom: "le paysage", route: "/paysage" },
  { nom: "les réglages", route: "/reglages" },
  { nom: "l'apparence", route: "/reglages/apparence" },
  { nom: "l'agenda", route: "/reglages/agenda" },
];

async function mesurer(page: Page, ecran: (typeof ECRANS)[number]): Promise<Map<string, Mesure>> {
  await page.goto(`${BASE}${ecran.route}`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.evaluate(() => document.fonts.ready);
  await ecran.apres?.(page);
  await page.waitForTimeout(400);
  const mesures = (await page.evaluate(SONDE)) as Mesure[];
  return new Map(mesures.map((m) => [m.cle, m]));
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await seConnecter(context);

  const poser = async (nom: NomCharte) => {
    await page.goto(`${BASE}/reglages/apparence`, { waitUntil: "networkidle" });
    await page.locator(`button[data-charte="${nom}"]`).click();
    await page.waitForTimeout(900);
  };

  try {
    await poser(ORIGINE);
    const clair = new Map<string, Map<string, Mesure>>();
    for (const e of ECRANS) clair.set(e.nom, await mesurer(page, e));

    await poser(NUIT);
    for (const e of ECRANS) {
      const avant = clair.get(e.nom)!;
      const apres = await mesurer(page, e);

      await test(`${e.nom} — rien n'y est moins lisible en Nuit qu'en Origine`, async () => {
        const compares = [...apres.values()].filter((m) => avant.has(m.cle));
        assert.ok(
          compares.length >= MINIMUM_MESURABLE,
          `seulement ${compares.length} texte(s) comparables sur ${e.nom} : la mesure n'a pas eu lieu, ` +
            "l'écran n'a rien rendu ou son contenu a changé entre les deux passes"
        );
        const perdus = compares
          .map((m) => ({ ...m, clair: avant.get(m.cle)!.contraste }))
          .filter((m) => m.contraste < m.clair * PERTE_TOLEREE || m.contraste < PLANCHER)
          // Ce qui était déjà sous le plancher en clair est un choix du patron,
          // pas une perte due au sombre : on ne le lui reproche pas deux fois.
          .filter((m) => !(m.clair < PLANCHER && m.contraste >= m.clair * PERTE_TOLEREE));
        assert.equal(
          perdus.length,
          0,
          `${e.nom} — ${perdus.length} texte(s) moins lisibles en Nuit :\n` +
            perdus
              .sort((a, b) => a.contraste - b.contraste)
              .slice(0, 12)
              .map(
                (m) =>
                  `      « ${m.texte} » : ${m.contraste} en Nuit (${m.couleur}) ` +
                  `contre ${m.clair} en Origine`
              )
              .join("\n")
        );
      });
    }
  } finally {
    // Hors du `try` des mesures : un échec ne doit pas laisser le compte de
    // démonstration en Nuit pour les suites suivantes.
    await poser(ORIGINE);
  }

  console.log(`\n${failed === 0 ? "✅" : "❌"} Le mode nuit se lit — ${passed} réussi(s), ${failed} échec(s).`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
