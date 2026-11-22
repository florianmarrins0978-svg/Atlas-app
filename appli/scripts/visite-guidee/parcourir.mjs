// Parcourt `appli/visite-guidee.html` au doigt, comme lui, et refuse de rendre
// un vert sur ce qu'il a déjà dû signaler. Aucun serveur, aucune base.
//
//   node appli/scripts/visite-guidee/parcourir.mjs            # tout, quatre largeurs
//   node appli/scripts/visite-guidee/parcourir.mjs --vite     # son écran seulement
//   node appli/scripts/visite-guidee/parcourir.mjs --seulement chrono   # un seul contrôle
//   node appli/scripts/visite-guidee/parcourir.mjs --adresse https://…/visite-guidee.html
//
// Ce que chaque contrôle tient, et la remarque qui l'a fait naître :
//   visite    chaque étape mène à la suivante ; la cible n'est jamais sous le
//             guide ni hors de l'écran ; rien ne déborde ; les 19 rubriques des
//             Réglages s'ouvrent et reviennent ; faire défiler replie le guide
//             (« la petite barre noire cache les informations », 21 novembre) ;
//             l'anneau vit dans le plan de son bouton (« la zone n'est pas vraiment
//             centrée par rapport au bouton », 22 novembre, sur Safari)
//   essais    les boutons à essayer s'enchaînent sans Retour, et Suivant fait
//             avancer (« on est obligé de faire retour », 21 novembre) ; ceux des
//             travaux en plus de la facture s'essaient aussi (« je peux pas
//             ajouter un travail ou un règlement reçu », 22 novembre)
//   portes    dans les Réglages libres, chaque porte s'ouvre et sa flèche ramène
//             (« n'importe quelle porte dans la page réglage », 21 novembre)
//   muets     chaque bouton des écrans d'essai répond (CLAUDE.md §3 bis, 2 quater)
//   chrono    à chaque étape, le guide est là en moins de 600 ms, processeur
//             ralenti quatre fois comme un téléphone (« on reste sur la page
//             plusieurs secondes », 21 novembre : 3 534 ms pendant que la fiche
//             du client s'écrivait seule)
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { lancer } from "../../../scripts/planche-figee/figer.mjs";

const { devices } = createRequire(import.meta.url)("playwright");
const ici = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const adresse = args.includes("--adresse") ? args[args.indexOf("--adresse") + 1] : pathToFileURL(path.join(ici, "../../visite-guidee.html")).href;
const vite = args.includes("--vite");
const defauts = [];
const dire = (cas, ok, quoi) => { if (!ok) defauts.push(`${cas} : ${quoi}`); };

const nav = await lancer();
const page = async (options) => {
  const ctx = await nav.newContext(options);
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.goto(adresse);
  await p.click(".v-ouverture button");
  return { p, ctx, erreurs };
};
const suivant = (p) => p.evaluate(() => (visite.plie() ? document.querySelector(".g-suivant-plie") : document.querySelector(".g-droite")).click());
const toucherLeDoigt = async (p) => {
  const d = await p.evaluate(() => { const r = document.querySelector(".v-doigt").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.click(d.x, d.y);
};
const etat = (p) => p.evaluate(() => {
  const g = document.querySelector(".g"), gr = g.getBoundingClientRect(), d = document.querySelector(".v-doigt"), dr = d.getBoundingClientRect();
  const allume = d.style.opacity === "1";
  // L'anneau vit dans le plan de son bouton : avec la page, ou dans le calque fixe
  // quand le bouton est dans une feuille fixe. Tout entier dans le calque fixe, il
  // tombait à côté du bouton sur Safari 26, qui décale ses éléments fixes quand sa
  // barre bouge (sa capture du 22 novembre). Le bouton : ce qui se touche sous l'anneau.
  const sous = allume ? document.elementsFromPoint(dr.left + dr.width / 2, dr.top + dr.height / 2).find((x) => x.closest(".visite-ecran:not([hidden])")) : null;
  let fixe = false;
  for (let x = sous; x && !x.matches(".visite-ecran"); x = x.parentElement) if (getComputedStyle(x).position === "fixed") fixe = true;
  // Le halo qui pulse autour de l'anneau sort de 16 points de sa boîte. Posé dans
  // la page près d'un bord (le micro en haut à droite), il dépassait de l'écran :
  // Chromium le coupait (« overflow: clip »), Safari élargissait toute la page, et
  // la visite paraissait débordée et décalée (sa capture du 22 novembre, l'aperçu
  // du PDF). Seul un plan qui ne défile pas (« overflow: hidden ») le coupe partout.
  const W = document.documentElement.clientWidth;
  const halo = allume && d.parentElement.matches(".v-plan") && (dr.right + 16 > W || dr.left - 16 < 0) && getComputedStyle(d.parentElement).overflowX !== "hidden";
  return {
    planFaux: !!sous && d.parentElement.matches(".v-calque") !== fixe,
    halo,
    rang: visite.etape(), titre: g.querySelector("h2").textContent,
    sousLeGuide: allume && dr.bottom - 4 > gr.top && dr.top + 4 < gr.bottom && dr.right > gr.left && dr.left < gr.right,
    horsEcran: allume && (dr.top < -2 || dr.bottom > innerHeight + 2),
    deborde: document.documentElement.scrollWidth > innerWidth + 1, allume,
  };
});

// La visite entière, au doigt, étape par étape.
async function parcourirLaVisite(largeur, hauteur) {
  const cas = `visite ${largeur}`;
  const { p, ctx, erreurs } = await page({ viewport: { width: largeur, height: hauteur } });
  // Rien ne vit hors d'un écran : un morceau d'écran échappé de son enveloppe se voit
  // par-dessus toute la visite (une barre « Réglages » posée sur la fiche de sécurité,
  // 21 novembre : un écran sur plusieurs lignes, recomposé ligne par ligne).
  const echappes = await p.evaluate(() => [...document.body.children].filter((e) => !e.matches(".visite-ecran, .v-calque, .v-plan, .g, .v-photo, .v-ouverture, script, style")).length);
  dire(cas, echappes === 0, `${echappes} morceaux d'écran hors de leur enveloppe, visibles par-dessus la visite`);
  const n = await p.evaluate(() => visite.etapes.length);
  for (let k = 0; k < n; k++) {
    await p.waitForTimeout(450);
    if (await p.evaluate(() => visite.etapes[visite.etape()].taper)) await p.waitForTimeout(1500);
    const e = await etat(p);
    if (e.rang !== k) { dire(cas, false, `attendu l'étape ${k + 1}, on est à ${e.rang + 1}`); break; }
    dire(cas, !e.sousLeGuide, `étape ${k + 1}, la cible est sous le guide`);
    dire(cas, !e.horsEcran, `étape ${k + 1}, la cible est hors de l'écran`);
    dire(cas, !e.deborde, `étape ${k + 1}, la page déborde`);
    dire(cas, !e.planFaux, `étape ${k + 1}, l'anneau n'est pas dans le plan de son bouton`);
    dire(cas, !e.halo, `étape ${k + 1}, le halo de l'anneau sort de l'écran sans être coupé partout`);
    const etp = await p.evaluate(() => visite.etapes[visite.etape()]);
    if (etp.libre) break;
    if (e.allume && etp.cible) await toucherLeDoigt(p); else await suivant(p);
  }
  const liens = await p.evaluate(() => [...document.querySelectorAll('.visite-ecran:not([hidden]) a[href^="/reglages/"]')].map((a) => a.getAttribute("href")));
  let ouvertes = 0;
  for (const h of liens) {
    await p.evaluate((h) => { const a = document.querySelector(`.visite-ecran:not([hidden]) a[href="${h}"]`); a.scrollIntoView({ block: "center" }); a.click(); }, h);
    await p.waitForTimeout(120);
    if (await p.evaluate(() => visite.rubrique())) {
      ouvertes++;
      await p.evaluate(() => document.querySelector('.visite-ecran:not([hidden]) a[data-geste-retour], .visite-ecran:not([hidden]) a[href="/reglages"]').click());
      await p.waitForTimeout(120);
    }
    dire(cas, await p.evaluate(() => visite.libre()), `la rubrique ${h} ne ramène pas au sommaire`);
  }
  dire(cas, ouvertes === 19, `${ouvertes} rubriques ouvertes sur 19`);
  // Faire défiler replie le guide (sur ordinateur il se tient à côté, et ne se replie pas).
  await p.evaluate(() => document.querySelector(".g-gauche").click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector(".g-droite").click()); await p.waitForTimeout(400);
  await p.mouse.move(150, 200); await p.mouse.wheel(0, 300); await p.waitForTimeout(200);
  if (largeur < 1024) dire(cas, await p.evaluate(() => visite.plie()), "faire défiler ne replie pas le guide");
  else await p.evaluate(() => document.querySelector(".g-plier").click());
  await p.click(".g-deplier");
  dire(cas, !(await p.evaluate(() => visite.plie())), "toucher la ligne ne déplie pas le guide");
  dire(cas, erreurs.length === 0, `erreurs dans la page : ${erreurs.join(" ; ")}`);
  await ctx.close();
  // Quitter se fait à TOUTE étape, pas seulement à la dernière (sa remarque du
  // 22 novembre : « il faut pouvoir quitter à n'importe quel moment »). Un appui
  // demande d'abord ; « Rester » ramène à l'étape, « Quitter la visite » sort.
  const sortie = await page({ viewport: { width: largeur, height: hauteur } });
  const q = sortie.p;
  for (const rang of [0, 5, 30]) {
    await q.evaluate((r) => { while (visite.etape() < r) document.querySelector(".g-droite").click(); }, rang);
    await q.waitForTimeout(400);
    const avant = await q.evaluate(() => document.querySelector(".g h2").textContent);
    // Les deux premières étapes l'écrivent en toutes lettres, les suivantes montrent la croix
    // (sa demande du 22 novembre : « au tout début, sur une page ou deux, et après la croix »).
    const mots = await q.evaluate(() => document.querySelector(".g-haut .g-quitter").innerText.trim());
    dire(cas, rang < 2 ? mots.startsWith("Quitter") : mots === "", `étape ${rang + 1}, le bouton pour quitter dit « ${mots} »`);
    // La croix qui se voit : celle de la bulle dépliée, ou celle de la bulle repliée.
    const croix = await q.evaluate(() => { const b = [...document.querySelectorAll(".g-quitter")].find((x) => x.getBoundingClientRect().width > 0); if (b) b.click(); return !!b; });
    dire(cas, croix, `étape ${rang + 1}, rien ne permet de quitter la visite`);
    if (!croix) continue;
    dire(cas, (await q.evaluate(() => document.querySelector(".g h2").textContent)) === "Quitter la visite ?", `étape ${rang + 1}, quitter ne demande pas`);
    await q.click(".g-gauche");
    dire(cas, (await q.evaluate(() => [visite.etape(), document.querySelector(".g h2").textContent])).join() === [rang, avant].join(), `étape ${rang + 1}, « Rester » ne ramène pas à l'étape`);
  }
  await q.evaluate(() => [...document.querySelectorAll(".g-quitter")].find((x) => x.getBoundingClientRect().width > 0)?.click());
  await Promise.all([q.waitForURL((u) => !String(u).includes("visite-guidee"), { timeout: 8000 }).catch(() => {}), q.click(".g-droite").catch(() => {})]);
  dire(cas, !q.url().includes("visite-guidee"), "« Quitter la visite » ne sort pas de la visite");
  await sortie.ctx.close();
}

// Les boutons à essayer, enchaînés sans Retour, puis Suivant.
async function enchainerLesEssais(largeur, hauteur) {
  const cas = `essais ${largeur}`;
  const { p, ctx } = await page({ viewport: { width: largeur, height: hauteur } });
  // Toucher un bouton comme un doigt ; s'il est caché, faire défiler par petits pas.
  const toucher = async (sel, texte) => {
    const lire = () => p.evaluate(([sel, texte]) => {
      const e = [...document.querySelectorAll(".visite-ecran:not([hidden]) " + sel)].find((x) => x.getBoundingClientRect().width && (!texte || x.textContent.includes(texte)));
      if (!e) return null;
      const r0 = e.getBoundingClientRect(); if (r0.top < 0 || r0.bottom > innerHeight) e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, libre: !!t && (e.contains(t) || t.contains(e)) };
    }, [sel, texte]);
    let q = await lire();
    if (!q) { dire(cas, false, `introuvable : ${sel} ${texte || ""}`); return; }
    for (let k = 0; !q.libre && k < 20; k++) { await p.mouse.move(60, 150); await p.mouse.wheel(0, 60); await p.waitForTimeout(80); q = await lire(); }
    dire(cas, q.libre, `${sel} ${texte || ""} reste couvert, même en défilant`);
    await p.mouse.click(q.x, q.y); await p.waitForTimeout(400);
  };
  const essai = () => p.evaluate(() => (visite.essai() ? `${visite.essai().x.titre} ${visite.essai().phase}` : ""));
  const aller = (r) => p.evaluate((r) => { while (visite.etape() < r) document.querySelector(".g-droite").click(); }, r);
  const etapeDe = (etat) => p.evaluate((etat) => visite.etapes.findIndex((e) => e.etat === etat && e.essais), etat);

  await aller(await etapeDe("11-devis-totaux")); await p.waitForTimeout(500);
  const devis = [['[data-atlas="poser-prix-accorde"]'], ['[data-atlas="ajouter-acompte"]'], ["button", "+ Ajouter une TVA"], ['[data-atlas="poser-main-doeuvre"]']];
  for (const [sel, texte] of devis) {
    await toucher(sel, texte);
    dire(cas, (await essai()).endsWith("feuille"), `${sel} ${texte || ""} n'ouvre pas sa feuille depuis l'essai d'avant`);
    await toucherLeDoigt(p); await p.waitForTimeout(400);
    dire(cas, (await essai()).endsWith("pose"), `${sel} ${texte || ""} ne se pose pas`);
  }
  await toucher("button", "+ Ajouter une ligne");
  dire(cas, (await essai()).startsWith("Une ligne"), "Ajouter une ligne ne pose rien");
  const avant = await p.evaluate(() => visite.etape());
  await suivant(p); await p.waitForTimeout(400);
  dire(cas, (await p.evaluate(() => visite.etape())) === avant + 1 && !(await essai()), "Suivant ne fait pas avancer après les essais du devis");

  await aller(await etapeDe("27-facture")); await p.waitForTimeout(500);
  const facture = await p.evaluate(() => visite.etape());
  await toucher('[data-atlas="voir-facture"]');
  dire(cas, (await p.evaluate(() => document.querySelector(".g h2").textContent)).startsWith("Revenez"), "l'aperçu du PDF ne dit pas de revenir");
  await toucherLeDoigt(p); await p.waitForTimeout(400);
  dire(cas, !(await essai()) && (await p.evaluate(() => visite.etape())) === facture, "la flèche du PDF ne ramène pas à la facture");
  await toucher('[data-atlas="facture-acquittee"]');
  await toucher('[data-atlas="ajouter-travaux-supplementaires"]');
  dire(cas, (await essai()).startsWith("Des travaux"), "Travaux en plus ne s'ouvre pas depuis la facture acquittée");
  // Ses boutons s'essaient à leur tour (« je peux pas ajouter un travail ou un règlement
  // reçu », 22 novembre : ils faisaient seulement trembler le guide), et ce qu'ils posent
  // se retire, ou leur feuille s'annule, pour revenir aux travaux en plus.
  // Ce qu'un essai posé doit montrer (`voir`) est à l'écran en arrivant, hors du guide :
  // la visite arrivait tout en bas des travaux en plus, sous la ligne ajoutée.
  const montre = async () => {
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const x = visite.essai()?.x;
      if (visite.essai()?.phase !== "pose" || !x?.voir) return null;
      // Le premier (ce qui a été posé) se voit toujours ; le second aussi, quand les
      // deux tiennent ensemble au-dessus du guide (pas à 320 points de large).
      const g = document.querySelector(".g").getBoundingClientRect();
      const r = x.voir.map((sel) => document.querySelector(".visite-ecran:not([hidden]) " + sel)?.getBoundingClientRect());
      const vu = (b) => b && b.top >= 0 && b.bottom <= g.top;
      // Le guide garde 10 points autour de ce qu'il montre, et 6 contre le bord et contre lui (`caler`).
      const tiennent = r[0] && r.at(-1) && r.at(-1).bottom - r[0].top + 20 <= g.top - 12;
      return x.voir.filter((sel, k) => (k === 0 || tiennent) && !vu(r[k])).join(" ");
    });
    dire(cas, !r, `${await essai()} : ${r} n'est pas à l'écran en arrivant`);
  };
  await montre();
  const enPlus = async (sel, attendu, retour) => {
    await toucher(sel);
    dire(cas, (await essai()).startsWith(attendu), `${sel} ne s'essaie pas depuis les travaux en plus (${await essai()})`);
    await montre();
    await toucher(...retour);
    dire(cas, (await essai()).startsWith("Des travaux"), `${retour.join(" ")} ne ramène pas aux travaux en plus (${await essai()})`);
  };
  await enPlus('[data-atlas="ajouter-ligne-supplement"]', "Un travail en plus", ['[data-atlas="retirer-supplement"]']);
  await enPlus('[data-atlas="poser-main-doeuvre"]', "La main d'œuvre feuille", ["button", "Annuler"]);
  await enPlus('[data-atlas="ajouter-tva-supplement"]', "Un autre taux feuille", ["button", "Annuler"]);
  await enPlus('[data-atlas="poser-reglement"]', "Un règlement reçu", ['[data-atlas="retirer-reglement"]']);
  await toucher('[data-atlas="poser-main-doeuvre"]');
  await toucherLeDoigt(p); await p.waitForTimeout(400);
  dire(cas, (await essai()) === "La main d'œuvre pose", "Ajouter la main d'œuvre ne se pose pas sur les travaux en plus");
  await montre();
  await suivant(p); await p.waitForTimeout(400);
  dire(cas, (await p.evaluate(() => visite.etape())) === facture + 1, "Suivant ne fait pas avancer après les essais de la facture");
  await ctx.close();
}

// Chaque bouton de chaque écran d'essai répond : il ouvre, ramène, ou fait trembler le guide.
async function aucunBoutonMuet() {
  const cas = "muets";
  const { p, ctx } = await page({ viewport: { width: 390, height: 664 } });
  const groupes = await p.evaluate(() => Object.keys(visite.essais).map((g) => [visite.etapes.findIndex((e) => e.essais === g), g, visite.essais[g].length]));
  let total = 0;
  for (const [rang, groupe, nb] of groupes) for (let k = 0; k < nb; k++) {
    const poser = () => p.evaluate(([r, g, k]) => {
      if (visite.essai()) { if (visite.plie()) document.querySelector(".g-deplier").click(); document.querySelector(".g-gauche").click(); }
      while (visite.etape() !== r) document.querySelector(visite.etape() < r ? ".g-droite" : ".g-gauche").click();
      const trouver = (sel) => { const m = sel.match(/^(.*):has-text\("(.*)"\)$/); return [...document.querySelectorAll(".visite-ecran:not([hidden]) " + (m ? m[1] : sel))].find((e) => e.getBoundingClientRect().width && (!m || e.textContent.includes(m[2]))); };
      const x = visite.essais[g][k];
      // Un essai qui s'ouvre depuis l'écran d'un autre (les travaux en plus) : celui-là d'abord.
      if (x.depuis) trouver(visite.essais[g].find((z) => z.pose === x.depuis).ouvre).click();
      trouver(x.ouvre).click();
      if (visite.essai()?.phase === "feuille") trouver(x.applique).click();
    }, [rang, groupe, k]);
    await poser(); await p.waitForTimeout(200);
    const n = await p.evaluate(() => document.querySelectorAll(".visite-ecran:not([hidden]) :is(a, button, input, [role=button], label)").length);
    for (let i = 0; i < n; i++) {
      const r = await p.evaluate((i) => {
        const e = document.querySelectorAll(".visite-ecran:not([hidden]) :is(a, button, input, [role=button], label)")[i];
        if (!e || !e.getBoundingClientRect().width) return null;
        const avant = JSON.stringify([visite.etape(), visite.essai()?.x.titre, visite.essai()?.phase]);
        document.querySelector(".g").classList.remove("secoue"); e.click();
        return { ecran: document.querySelector(".visite-ecran:not([hidden])").dataset.ecran, nom: (e.getAttribute("aria-label") || e.textContent).trim().replace(/\s+/g, " ").slice(0, 40),
                 bouge: avant !== JSON.stringify([visite.etape(), visite.essai()?.x.titre, visite.essai()?.phase]), secoue: document.querySelector(".g").classList.contains("secoue") };
      }, i);
      if (!r) continue;
      total++;
      dire(cas, r.bouge || r.secoue, `${r.ecran}, « ${r.nom} » ne fait rien`);
      if (r.bouge) { await poser(); await p.waitForTimeout(120); }
    }
  }
  dire(cas, total > 200, `seulement ${total} boutons touchés`);
  await ctx.close();
  return total;
}

// Les Réglages, libres : chaque porte de chaque rubrique, et des pages qu'elle
// ouvre, mène à un écran, dit ce qu'elle ferait (un téléchargement), ou ramène.
// Aucune ne fait trembler le guide (« n'importe quelle porte dans la page
// réglage », 21 novembre). La barre de l'appli, en bas, sort des Réglages : hors compte.
async function aucunePorteFermee() {
  const cas = "portes";
  const { p, ctx } = await page({ viewport: { width: 390, height: 664 } });
  await p.evaluate(() => { while (!visite.libre()) document.querySelector(visite.plie() ? ".g-suivant-plie" : ".g-droite").click(); });
  await p.waitForTimeout(300);
  const lire = () => p.evaluate(() => ({ ecran: document.querySelector(".visite-ecran:not([hidden])").dataset.ecran, phrase: document.querySelector(".g p").textContent, secoue: document.querySelector(".g").classList.contains("secoue") }));
  const liens = () => p.evaluate(() => [...new Set([...document.querySelectorAll(".visite-ecran:not([hidden]) a[href]")].filter((a) => !a.hasAttribute("data-geste-retour") && a.getBoundingClientRect().width && !a.closest("nav")).map((a) => a.getAttribute("href")))]);
  let ouvertes = 0;
  const visiter = async (profondeur) => {
    const ici = (await lire()).ecran;
    for (const h of await liens()) {
      const avant = await lire();
      await p.evaluate((h) => { const a = [...document.querySelectorAll(".visite-ecran:not([hidden]) a")].find((x) => x.getAttribute("href") === h && x.getBoundingClientRect().width); a.scrollIntoView({ block: "center" }); document.querySelector(".g").classList.remove("secoue"); a.click(); }, h);
      await p.waitForTimeout(150);
      const apres = await lire();
      if (apres.ecran !== ici) {
        ouvertes++;
        if (profondeur < 3 && apres.ecran.startsWith("r-")) await visiter(profondeur + 1);
        // Sa flèche, ou la barre du bas pour un écran qui n'en a pas (Terminés, le planning).
        await p.evaluate(() => { const r = document.querySelector(".visite-ecran:not([hidden]) a[data-geste-retour]"); if (r) r.click(); else document.querySelector('.visite-ecran:not([hidden]) nav a[href="/reglages"]')?.click(); });
        await p.waitForTimeout(150);
        const retour = (await lire()).ecran;
        // Sans flèche, la barre du bas ramène au sommaire ; on y rouvre l'écran d'où l'on venait.
        if (retour !== ici && retour === "50-reglages" && !(await p.evaluate((n) => !!document.querySelector(`.visite-ecran[data-ecran="${n}"] a[data-geste-retour]`), apres.ecran))) {
          await p.evaluate((ici) => { const a = [...document.querySelectorAll('.visite-ecran:not([hidden]) a[href^="/reglages/"]')].find((x) => "r-" + x.getAttribute("href").replace(/^\/reglages\//, "").replace(/\//g, "-") === ici); a?.click(); }, ici);
          await p.waitForTimeout(150);
        }
        dire(cas, (await lire()).ecran === ici, `en revenant de ${apres.ecran}, on n'est pas revenu à ${ici}`);
        if ((await lire()).ecran !== ici) return;
      } else dire(cas, !apres.secoue && apres.phrase !== avant.phrase, `${ici} : la porte ${h} ne mène nulle part`);
    }
  };
  await visiter(0);
  dire(cas, ouvertes >= 35, `seulement ${ouvertes} portes ouvertes`);
  await ctx.close();
  return ouvertes;
}

// À chaque étape, le temps entre l'appui et un guide lisible à l'écran : opaque
// ET immobile. Opaque seul ne suffit pas : un guide qui commence à s'effacer
// l'est encore, et la première version de ce contrôle passait au vert sur la
// visite qui le retirait trois secondes et demie.
async function chronometrer() {
  const cas = "chrono";
  const ctx = await nav.newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage(); p.setDefaultTimeout(9000);
  const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await p.goto(adresse); await p.tap(".v-ouverture button"); await p.waitForTimeout(800);
  const n = await p.evaluate(() => visite.etapes.length);
  let pire = 0;
  for (let k = 0; k < n - 1; k++) {
    const d = await p.evaluate(() => { const e = visite.etapes[visite.etape()], x = document.querySelector(".v-doigt"), r = x.getBoundingClientRect(); return { cible: !!e.cible && x.style.opacity === "1", x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.evaluate(() => {
      window.__avant = visite.etape(); window.__pret = null; const t0 = performance.now(), g = document.querySelector(".g");
      const guetter = () => { const r = g.getBoundingClientRect(); if (visite.etape() !== window.__avant && getComputedStyle(g).opacity === "1" && !g.getAnimations().length && r.bottom > 0 && r.top < innerHeight && window.__pret === null) window.__pret = Math.round(performance.now() - t0); if (window.__pret === null && performance.now() - t0 < 8000) requestAnimationFrame(guetter); };
      requestAnimationFrame(guetter);
    });
    if (d.cible) await p.touchscreen.tap(d.x, d.y); else await suivant(p);
    await p.waitForFunction(() => window.__pret !== null, null, { timeout: 9000 }).catch(() => {});
    const r = await p.evaluate(() => ({ t: window.__pret, rang: visite.etape(), taper: !!visite.etapes[visite.etape()].taper }));
    if (r.rang !== k + 1) { dire(cas, false, `bloqué à l'étape ${k + 1}`); break; }
    dire(cas, r.t !== null && r.t <= 600, `étape ${k + 2} : le guide arrive en ${r.t ?? "plus de 8000"} ms`);
    pire = Math.max(pire, r.t ?? 9999);
    await p.waitForTimeout(r.taper ? 1500 : 250);
  }
  await ctx.close();
  return pire;
}

const seul = args.includes("--seulement") ? args[args.indexOf("--seulement") + 1] : null;
const jouer = (nom) => !seul || seul === nom;
const tailles = vite ? [[390, 664]] : [[320, 568], [390, 664], [1024, 768], [1280, 800]];
for (const [l, h] of tailles) {
  if (jouer("visite")) await parcourirLaVisite(l, h);
  if (jouer("essais")) await enchainerLesEssais(l, h);
  if (jouer("visite") || jouer("essais")) console.log(`${l} × ${h} : parcourue`);
}
if (jouer("portes")) console.log(`portes des Réglages ouvertes : ${await aucunePorteFermee()}`);
if (jouer("muets")) console.log(`boutons des écrans d'essai touchés : ${await aucunBoutonMuet()}`);
if (jouer("chrono")) console.log(`le guide le plus lent à paraître : ${await chronometrer()} ms (processeur ralenti quatre fois)`);
await nav.close();
if (defauts.length) { console.log(`\n${defauts.length} défaut(s) :\n  ${defauts.join("\n  ")}`); process.exit(1); }
console.log("\nAucun défaut.");
