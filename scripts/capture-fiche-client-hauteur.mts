/**
 * MESURER la fiche client sur un vrai téléphone — et non deviner ses marges.
 *
 * **Sa demande du 1ᵉʳ septembre 2026 :** *« la page doit remplir tout l'espace,
 * elle n'est pas centrée. Je veux qu'une seule page mais centrée, il y a trop
 * de marge en bas et en haut, la note vocale est presque coupée tellement elle
 * est haute. »*
 *
 * **Pourquoi mesurer avant de toucher.** « Trop de marge » ne se corrige pas au
 * jugé : il faut savoir de combien la page dépasse l'écran, et où le vide se
 * trouve. Une marge retirée au hasard déplace le défaut sans le régler — c'est
 * la troisième fois que cet écran est resserré (30 août, 31 août).
 *
 *     npx tsx scripts/capture-fiche-client-hauteur.mts /tmp/captures
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const SORTIE = process.argv[2] ?? "/tmp/captures";
mkdirSync(SORTIE, { recursive: true });
const BASE = "http://localhost:3000";

/** Les téléphones qu'il tient vraiment, du plus petit au plus grand. */
const ECRANS = [
  { nom: "iphone-se", largeur: 375, hauteur: 667 },
  { nom: "iphone-13", largeur: 390, hauteur: 844 },
  { nom: "iphone-max", largeur: 430, hauteur: 932 },
];

const nav = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});

// **UNE SEULE CONNEXION pour les trois écrans.** Le limiteur borne à cinq
// tentatives par quart d'heure : une session par taille d'écran le déclenche
// dès la troisième, et le contrôle accuse alors la page alors que c'est le
// garde-fou qui a parlé.
const contexte = await nav.newContext({
  ...devices["iPhone 13"],
  viewport: { width: ECRANS[0]!.largeur, height: ECRANS[0]!.hauteur },
  permissions: ["microphone"],
});
const page = await contexte.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

for (const ecran of ECRANS) {
  await page.setViewportSize({ width: ecran.largeur, height: ecran.hauteur });
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  // La mise en page doit être posée : mesurer trop tôt rend des zéros, et un
  // zéro n'est pas une mesure (`CLAUDE.md` §5).
  await page.waitForTimeout(1200);

  // **La mesure passe par une CHAÎNE, pas une fonction.** `tsx` compile les
  // fonctions avec un `__name` qui n'existe pas dans le navigateur : passée
  // telle quelle, l'évaluation meurt sur « __name is not defined » — une erreur
  // qui accuse la page alors qu'elle vient de l'outil.
  const mesures = (await page.evaluate(`(() => {
    const h = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { haut: Math.round(r.top), bas: Math.round(r.bottom), hauteur: Math.round(r.height) };
    };
    return {
      fenetre: window.innerHeight,
      document: Math.round(document.documentElement.scrollHeight),
      deborde: Math.round(document.documentElement.scrollHeight - window.innerHeight),
      anneau: h('[data-atlas="anneau-note-vocale"]'),
      parents: (() => {
        const el = document.querySelector('form');
        const out = [];
        let n = el ? el.parentElement : null;
        while (n && n !== document.documentElement) {
          const st = getComputedStyle(n);
          out.push({
            balise: n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ').slice(0,3).join('.') : ''),
            hauteur: Math.round(n.getBoundingClientRect().height),
            padHaut: st.paddingTop, padBas: st.paddingBottom,
            margeHaut: st.marginTop, margeBas: st.marginBottom, minH: st.minHeight,
          });
          n = n.parentElement;
        }
        return out;
      })(),
      barreBas: h('nav'),
      bouton: h('[data-repere="action-creation"]'),
    };
  })()`)) as {
    fenetre: number;
    document: number;
    deborde: number;
    anneau: { haut: number; bas: number; hauteur: number } | null;
    barreBas: { haut: number; bas: number; hauteur: number } | null;
    bouton: { haut: number; bas: number; hauteur: number } | null;
  };

  console.log(
    `${ecran.nom.padEnd(11)} fenêtre ${String(mesures.fenetre).padStart(4)} · document ${String(
      mesures.document
    ).padStart(4)} · déborde de ${String(mesures.deborde).padStart(4)} px` +
      (mesures.anneau
        ? ` · anneau ${mesures.anneau.haut}→${mesures.anneau.bas} (${mesures.anneau.hauteur} px)`
        : " · anneau absent") +
      (mesures.barreBas ? ` · barre ${mesures.barreBas.hauteur} px` : "") +
      (mesures.bouton ? ` · bouton bas ${mesures.bouton.bas}` : "")
  );
  if (ecran.nom === "iphone-13") {
    for (const p of (mesures as unknown as { parents: Record<string, string>[] }).parents) {
      console.log(`    ${String(p.balise).slice(0, 46).padEnd(46)} h=${String(p.hauteur).padStart(4)} pad ${p.padHaut}/${p.padBas} marge ${p.margeHaut}/${p.margeBas} minH ${p.minH}`);
    }
  }

  await page.addStyleTag({
    content: "nextjs-portal, #__next-build-watcher { display: none !important; }",
  });
  await page.screenshot({ path: path.join(SORTIE, `fiche-${ecran.nom}.png`) });
}

await contexte.close();
await nav.close();
console.log(`\nCaptures dans ${SORTIE}`);
