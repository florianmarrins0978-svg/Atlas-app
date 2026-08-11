/**
 * Ce que coûte, image par image, le défilement de la liste des chantiers.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le patron, le 11 août 2026 :** *« je trouve que ça manque de fluidité.
 * Quand je slide en haut ou en bas, c'est saccadé. »*
 *
 * Trois choses se superposent sur ce même défilement, toutes délibérées :
 *
 *   1. `scroll-snap-stop: always` — un geste vif n'avance que d'un chantier ;
 *   2. un `mask-image` en dégradé **sur le cadre qui défile** — le fondu des
 *      deux bouts ;
 *   3. une animation d'opacité pilotée par le défilement (`animation-timeline:
 *      view()`), sur **chaque** ligne.
 *
 * Les trois peuvent produire la même plainte, et pour des raisons opposées : la
 * première est un choix de comportement, les deux autres un coût de rendu.
 * Corriger la mauvaise, c'est abîmer l'écran sans rien gagner — et c'est
 * exactement ce qu'on ferait en devinant.
 *
 * Ce script mesure. Il défile la liste par petits pas, relève la durée de
 * chaque image rendue, et rend le pire cas et la part d'images en retard. Une
 * image doit tenir en 16,7 ms pour donner 60 par seconde ; au-delà, l'œil voit
 * le saut.
 *
 *   npx tsx scripts/mesurer-fluidite-fil.mts [--sans-masque] [--sans-animation]
 *
 * Les deux drapeaux retirent une cause à la fois, dans le navigateur seulement :
 * le dépôt n'est pas touché. C'est ce qui permet de comparer avant de choisir.
 */
import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";

const BASE = "http://localhost:3000";
const sansMasque = process.argv.includes("--sans-masque");
const sansAnimation = process.argv.includes("--sans-animation");
const sansAccroche = process.argv.includes("--sans-accroche");

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  await page.waitForSelector(".atlas-fil-defile", { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  const retraits: string[] = [];
  if (sansMasque) retraits.push(".atlas-fil-defile{mask-image:none!important;-webkit-mask-image:none!important}");
  if (sansAnimation) retraits.push(".atlas-fil-defile .atlas-ligne{animation:none!important;opacity:1!important}");
  if (sansAccroche) retraits.push(".atlas-ligne{scroll-snap-stop:normal!important}");
  if (retraits.length) await page.addStyleTag({ content: retraits.join("\n") });

  // **`__name is not defined`, et ce n'est pas le navigateur qui a tort.** `tsx`
  // compile ce fichier avec esbuild, qui enveloppe chaque fonction nommée dans
  // un `__name(...)` pour préserver son nom — utile ici, absent là-bas, puisque
  // le corps de `page.evaluate` part seul dans la page. On pose donc l'identité
  // avant. La chaîne littérale est délibérée : elle échappe au compilateur.
  await page.evaluate("globalThis.__name = globalThis.__name || ((f) => f)");

  // **On mesure les images RÉELLEMENT rendues**, pas une horloge posée à côté :
  // `requestAnimationFrame` ne se déclenche que lorsque le navigateur peint, et
  // c'est précisément ce qui manque quand l'écran saccade.
  const mesure = await page.evaluate(async () => {
    const fil = document.querySelector(".atlas-fil-defile") as HTMLElement | null;
    if (!fil) return null;

    const durees: number[] = [];
    let precedente = performance.now();
    let court = true;
    const compter = () => {
      const t = performance.now();
      durees.push(t - precedente);
      precedente = t;
      if (court) requestAnimationFrame(compter);
    };
    requestAnimationFrame(compter);

    // Un défilement continu, comme un doigt qui pousse : soixante pas de huit
    // pixels, un par image. Un `scrollTo` unique ne mesurerait qu'un saut.
    fil.scrollTop = 0;
    await new Promise((r) => setTimeout(r, 250));
    durees.length = 0;
    precedente = performance.now();
    for (let i = 0; i < 60; i++) {
      fil.scrollTop += 8;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    await new Promise((r) => setTimeout(r, 150));
    court = false;

    const utiles = durees.filter((d) => d > 0).sort((a, b) => a - b);
    if (!utiles.length) return null;
    const centile = (p: number) => utiles[Math.min(utiles.length - 1, Math.floor(utiles.length * p))];
    return {
      images: utiles.length,
      mediane: +centile(0.5).toFixed(1),
      p90: +centile(0.9).toFixed(1),
      pire: +utiles[utiles.length - 1].toFixed(1),
      enRetard: +((utiles.filter((d) => d > 16.7).length / utiles.length) * 100).toFixed(0),
    };
  });

  const quoi =
    [sansMasque && "sans masque", sansAnimation && "sans animation", sansAccroche && "sans accroche"]
      .filter(Boolean)
      .join(" + ") || "tel quel";

  if (!mesure) {
    console.log(`  ${quoi} : liste introuvable — rien mesuré.`);
  } else {
    console.log(
      `  ${quoi.padEnd(34)} médiane ${String(mesure.mediane).padStart(5)} ms · ` +
        `p90 ${String(mesure.p90).padStart(5)} ms · pire ${String(mesure.pire).padStart(6)} ms · ` +
        `${String(mesure.enRetard).padStart(3)} % d'images au-delà de 16,7 ms`
    );
  }

  await navigateur.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
