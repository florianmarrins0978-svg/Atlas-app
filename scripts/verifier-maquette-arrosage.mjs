#!/usr/bin/env node
/*
  Garde les trois planches du PLAN D'ARROSAGE.

  **Ce contrôle ne vérifie pas du goût : il vérifie de l'ARITHMÉTIQUE.** Une
  maquette d'apparence peut se juger à l'œil ; celle-ci affirme qu'un jardin
  demande tant de m³/h, qu'il faut tant de secteurs et que le cycle dure tant.
  Si l'un de ces nombres est faux, le patron jugera l'outil sur un calcul qui
  ne tient pas — et il n'aura aucun moyen de s'en apercevoir.

  Les six choses qu'il attrape, et pourquoi chacune est là :

  1. **Aucun JavaScript.** Son lecteur n'en exécute pas : une planche bâtie en
     JS lui arrive VIDE, et elle passe pourtant tous les contrôles ordinaires
     (`PROJECT_STATE.md`). On l'ouvre donc `javaScriptEnabled: false`.
  2. **Aucun secteur ne dépasse le débit du robinet.** C'est l'invariant du
     métier : un secteur trop chargé, et les derniers arroseurs bavent. Les
     nombres sont relus SUR LA PLANCHE, pas dans le script qui l'a écrite.
  3. **Aucun secteur ne mélange deux matériels.** Défaut réellement commis en
     écrivant ce lot : le champ `materiel` (une chaîne) était écrasé par
     l'objet du catalogue, et les deux pelouses — turbines et tuyères — se
     retrouvaient dans le même secteur. La planche s'affichait parfaitement.
     Une vanne ouvre son secteur entier pour la même durée : l'une des deux
     zones aurait reçu trois fois trop d'eau.
  4. **Les trois planches parlent du MÊME jardin.** Elles sont engendrées d'une
     seule source ; si l'une était retouchée à la main, l'écart se verrait
     exactement là où le patron compare les trois.
  5. **Le cycle annoncé est la somme des secteurs.** C'est le nombre qui décide
     de l'heure de départ, donc de l'évaporation.
  6. **Aucun prix inventé.** Règle du §4 du dépôt : la nomenclature sort avec
     ses quantités, et ce qui n'est pas dans « Mes prix » est signalé, jamais
     estimé. Le jour où un montant en euros apparaît, ce contrôle le dit.

  **Et il refuse de conclure sur du vide** (règle du 15 août 2026, payée cinq
  fois) : zéro secteur, zéro arroseur ou un plan de zéro pixel ne sont pas des
  succès, ce sont des mesures impossibles.

  Éprouvé à l'envers avant d'être gardé : chaque cas a été vu rouge sur la
  planche dégradée qu'il prétend détecter.
*/

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAQUETTES = join(RACINE, "docs", "maquettes");
const ENTREE = join(MAQUETTES, "69-le-plan-darrosage.html");
const SECTEURS = join(MAQUETTES, "70-le-debit-ne-se-partage-pas.html");
const SORTIES = join(MAQUETTES, "71-ce-qui-sort-du-plan.html");

const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
async function cas(nom, verifier) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
// Les planches écrivent en français : « 1,80 » et non « 1.80 ».
const nombre = (texte) => {
  // **La virgule décimale se lit AVANT d'être remplacée.** Une première
  // version normalisait toutes les virgules du texte, y compris celle de
  // « Demandé, tout ouvert » : le motif s'arrêtait alors sur le « 8 » de
  // « 8,47 », et le contrôle accusait la planche d'un écart qui n'existait
  // pas. Un contrôle qui désigne le mauvais coupable coûte plus cher que pas
  // de contrôle du tout.
  const t = String(texte).replace(/\s|\u00a0|\u202f/g, "");
  const m = t.match(/-?\d+(?:[.,]\d+)?/);
  assert(m, `aucun nombre à lire dans « ${texte} »`);
  return parseFloat(m[0].replace(",", "."));
};
const minutesDe = (texte) => {
  const m = String(texte).match(/(\d+)\s*h\s*(\d+)/);
  assert(m, `aucune durée « h » à lire dans « ${texte} »`);
  return Number(m[1]) * 60 + Number(m[2]);
};

console.log("=== Le plan d'arrosage — trois planches ===");

await cas("aucun JavaScript dans les trois planches", () => {
  for (const [nom, chemin] of [["69", ENTREE], ["70", SECTEURS], ["71", SORTIES]]) {
    const source = readFileSync(chemin, "utf8");
    assert(!/<script/i.test(source), `la planche ${nom} porte une balise <script>`);
    assert(!/javascript:/i.test(source), `la planche ${nom} porte un lien javascript:`);
    assert(
      !/\son[a-z]+\s*=\s*["']/i.test(source),
      `la planche ${nom} porte un gestionnaire en ligne (onclick, onchange…)`
    );
  }
});

await cas("la planche 69 s'ouvre sur B — celle que je recommande", () => {
  // Une planche qui s'ouvrirait ailleurs lui montrerait, dans six mois, autre
  // chose que ce qui lui a été présenté.
  const source = readFileSync(ENTREE, "utf8");
  assert(
    /id="e-b" class="etat" checked/.test(source),
    "la planche 69 ne s'ouvre plus sur B (les zones)"
  );
});

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {}
);
// **Sans JavaScript, comme chez lui.** C'est la seule façon de voir ce qu'il
// verra : une planche bâtie en JS s'affiche parfaitement ici, et vide chez lui.
const contexte = await navigateur.newContext({ javaScriptEnabled: false });
const page = await contexte.newPage();

// `networkidle` plutôt que `domcontentloaded` : sans la mise en page appliquée,
// toute mesure de boîte vaut zéro, et « 0 − 0 = 0 » passe au vert sur un écran
// fautif (le piège payé le 15 août 2026).
const ouvrir = async (fichier) => page.goto(`file://${fichier}`, { waitUntil: "networkidle" });
const textes = async (selecteur) => page.locator(selecteur).allTextContents();

/* ── Ce que la planche 70 affirme ───────────────────────────────────────── */

await ouvrir(SECTEURS);
const debitDisponible = nombre(
  (await textes(".compare .l")).find((t) => /Disponible/i.test(t))
);
const debitDemande = nombre((await textes(".compare .l")).find((t) => /Demandé/i.test(t)));
const zonesDesSecteurs = await textes(".sec .sec-z");
const debitsDesSecteurs = (await textes(".sec .sec-q")).map(nombre);
const minutesDesSecteurs = (await textes(".sec .sec-min")).map(nombre);
const famillesDesSecteurs = await textes(".sec .sec-fam");
const cycleAffiche = minutesDe(await page.locator(".cycle").textContent());

await cas("sans JavaScript, la planche 70 affiche bien ses secteurs", async () => {
  assert(
    zonesDesSecteurs.length >= 6,
    `seulement ${zonesDesSecteurs.length} secteurs affichés — la page arrive vide ?`
  );
  assert(
    debitsDesSecteurs.length === zonesDesSecteurs.length &&
      minutesDesSecteurs.length === zonesDesSecteurs.length,
    "un secteur affiche son nom sans son débit ou sans sa durée"
  );
  assert(debitDisponible > 0 && debitDemande > 0, "les débits comparés valent zéro : rien n'est mesuré");
});

await cas("AUCUN secteur ne dépasse le débit du robinet", async () => {
  const trop = debitsDesSecteurs
    .map((d, i) => ({ d, nom: zonesDesSecteurs[i] }))
    .filter((x) => x.d > debitDisponible);
  assert(
    trop.length === 0,
    `${trop.length} secteur(s) au-dessus de ${debitDisponible} m³/h : ` +
      trop.map((x) => `${x.nom} (${x.d})`).join(", ")
  );
  // Et la marge annoncée est tenue : on ne charge pas jusqu'au robinet.
  const limite = nombre(
    (await textes(".compare .dit-le")).find((t) => /aucun/i.test(t)).split("dessus de")[1]
  );
  const auDela = debitsDesSecteurs.filter((d) => d > limite + 0.001);
  assert(
    auDela.length === 0,
    `la planche promet ${limite} m³/h au plus, et ${auDela.length} secteur(s) la dépassent : ${auDela.join(", ")}`
  );
});

await cas("le débit demandé est bien la somme des secteurs", () => {
  // Un total qui ne serait pas la somme de ses parts est le défaut qu'aucune
  // capture ne montre : chaque ligne paraît juste, et le verdict est faux.
  const somme = debitsDesSecteurs.reduce((s, d) => s + d, 0);
  assert(
    Math.abs(somme - debitDemande) < 0.05,
    `les secteurs font ${somme.toFixed(2)} m³/h, la planche annonce ${debitDemande}`
  );
});

await cas("le cycle annoncé est la somme des durées de secteur", () => {
  const somme = minutesDesSecteurs.reduce((s, m) => s + m, 0);
  assert(
    somme === cycleAffiche,
    `les secteurs font ${somme} min, la planche annonce ${cycleAffiche} min — ` +
      "c'est ce nombre qui décide de l'heure de départ"
  );
});

/* ── Aucun secteur ne mélange deux matériels ────────────────────────────── */

await ouvrir(ENTREE);
await page.locator('label[for="e-b"]').click();
const nomsDesZones = await textes(".eb .zc-nom");
const materielsDesZones = await textes(".eb .zc-mat");

await cas("AUCUN secteur ne mélange deux matériels", () => {
  // Le défaut réellement commis en écrivant ce lot. Une vanne ouvre son
  // secteur entier pour la même durée : turbines (11 mm/h) et tuyères
  // (38 mm/h) ensemble, c'est trois fois trop d'eau d'un côté.
  //
  // **Ce contrôle porte sur le MATÉRIEL, pas sur la pluviométrie** — et cette
  // distinction compte depuis le 23 août 2026, où le patron a retiré la
  // pluviométrie de la clé de secteur (*« ne prends pas en compte la
  // pluviométrie »*). Deux turbines de buses différentes peuvent maintenant
  // partager une vanne ; une turbine et une tuyère, jamais.
  assert(nomsDesZones.length > 0, "la planche 69 n'affiche aucune zone : rien à comparer");
  // Le matériel est comparé TEL QUE LE PATRON LE LIT (« turbine », « tuyère »),
  // pas sur une clé technique cachée : un contrôle qui regarde autre chose que
  // l'écran finit par garder un écran faux.
  const materielDe = new Map(nomsDesZones.map((n, i) => [n.trim(), materielsDesZones[i].trim()]));
  for (const [i, libelle] of zonesDesSecteurs.entries()) {
    const dansCeSecteur = libelle.split(" + ").map((n) => n.trim());
    const materiels = new Set(
      dansCeSecteur.map((n) => {
        assert(materielDe.has(n), `le secteur S${i + 1} nomme « ${n} », qui n'est pas une zone de la planche 69`);
        return materielDe.get(n);
      })
    );
    assert(
      materiels.size === 1,
      `le secteur S${i + 1} (${libelle}) mélange ${[...materiels].join(" et ")} — ` +
        "un seul matériel par secteur"
    );
  }
});

await cas("les secteurs de goutte-à-goutte sont annoncés comme tels", () => {
  assert(
    famillesDesSecteurs.length === zonesDesSecteurs.length,
    "un secteur n'annonce pas sa famille de matériel"
  );
  const familles = new Set(famillesDesSecteurs.map((f) => f.trim()));
  assert(
    familles.size >= 2,
    `toutes les familles affichées sont « ${[...familles][0]} » : le découpage ne distingue plus rien`
  );
});

/* ── Les trois planches parlent du même jardin ──────────────────────────── */

await cas("la planche 69 annonce le même jardin que la 70", async () => {
  const pastilles = await textes(".eb .recap span");
  const combien = nombre(pastilles.find((t) => /secteur/i.test(t)));
  const cycle = minutesDe(pastilles.find((t) => /cycle/i.test(t)));
  const demande = nombre(pastilles.find((t) => /m³\/h/.test(t)));
  assert(
    combien === zonesDesSecteurs.length,
    `la 69 annonce ${combien} secteurs, la 70 en dessine ${zonesDesSecteurs.length}`
  );
  assert(cycle === cycleAffiche, `la 69 annonce un cycle de ${cycle} min, la 70 de ${cycleAffiche} min`);
  assert(
    Math.abs(demande - debitDemande) < 0.02,
    `la 69 annonce ${demande} m³/h demandés, la 70 ${debitDemande}`
  );
});

await cas("le plan dessiné pose autant d'arroseurs qu'il en annonce", async () => {
  await page.locator('label[for="e-c"]').click();
  const annonce = nombre((await page.locator(".ec .sous").first().textContent()));
  const tetes = await page.locator(".ec .plan .tete").count();
  assert(tetes > 0, "le plan ne dessine aucune tête : rien à mesurer");
  assert(tetes === annonce, `le plan dessine ${tetes} arroseurs pour ${annonce} annoncés`);
  // **Refuser de conclure sur une boîte de zéro pixel** (15 août 2026).
  const boite = await page.locator(".ec .plan").boundingBox();
  assert(boite && boite.width > 100 && boite.height > 60, `le plan mesure ${boite?.width} × ${boite?.height} px : mesure impossible`);
  // **Et refuser une cote ROGNÉE.** Défaut réellement commis ici : « 12 m »
  // sortait du viewBox et s'affichait « 2 m ». Le texte était entier dans la
  // page — seul un contrôle qui compare les BOÎTES pouvait le voir, et c'est
  // la capture qui l'a trouvé en premier.
  const cotes = page.locator(".ec .plan .cote");
  const combienDeCotes = await cotes.count();
  assert(combienDeCotes >= 2, `${combienDeCotes} cote(s) sur le plan : il en faut deux`);
  for (let i = 0; i < combienDeCotes; i++) {
    const c = await cotes.nth(i).boundingBox();
    const mot = (await cotes.nth(i).textContent()).trim();
    assert(c && c.width > 0, `la cote « ${mot} » ne mesure rien`);
    assert(
      c.x >= boite.x - 0.5 && c.x + c.width <= boite.x + boite.width + 0.5 &&
        c.y >= boite.y - 0.5 && c.y + c.height <= boite.y + boite.height + 0.5,
      `la cote « ${mot} » déborde du plan : elle est rognée à l'affichage`
    );
  }
});

await cas("la nomenclature de la 71 compte ce que la 70 a découpé", async () => {
  await ouvrir(SORTIES);
  const noms = await textes(".sa .nl-nom");
  const quantites = await textes(".sa .nl-q");
  assert(noms.length >= 6, `seulement ${noms.length} lignes de nomenclature — la page arrive vide ?`);
  const ligne = (motif) => {
    const i = noms.findIndex((n) => motif.test(n));
    assert(i >= 0, `la nomenclature n'a plus de ligne « ${motif} »`);
    return nombre(quantites[i]);
  };
  assert(
    ligne(/Électrovannes/i) === zonesDesSecteurs.length,
    `${ligne(/Électrovannes/i)} électrovannes pour ${zonesDesSecteurs.length} secteurs — une par secteur, pas une de plus`
  );
  const voies = ligne(/Programmateur/i);
  assert(voies >= 1, "le programmateur a disparu de la nomenclature");
  const intitule = noms.find((n) => /Programmateur/i.test(n));
  assert(
    nombre(intitule) >= zonesDesSecteurs.length,
    `${intitule} pour ${zonesDesSecteurs.length} secteurs : il en manque`
  );
});

await cas("la carte de programmation porte les mêmes durées que la 70", async () => {
  await page.locator('label[for="s-b"]').click();
  const durees = (await textes(".sb .pl-m")).map(nombre);
  assert(durees.length > 0, "la carte de programmation arrive vide");
  assert(
    durees.length === minutesDesSecteurs.length,
    `la carte porte ${durees.length} lignes pour ${minutesDesSecteurs.length} secteurs`
  );
  const ecarts = durees.filter((d, i) => d !== minutesDesSecteurs[i]);
  assert(ecarts.length === 0, `${ecarts.length} durée(s) ont divergé entre la 70 et la carte du coffret`);
});

await cas("aucun prix inventé dans la nomenclature", async () => {
  // Règle du §4 : ni prix, ni donnée client, ni prestation inventés. Ce qui
  // n'est pas dans « Mes prix » part vide ET signalé (`docs/AGENT.md` §3).
  await ouvrir(SORTIES);
  const devis = await page.locator(".sa").innerText();
  assert(
    !/\d[\d\s.,]*\s*€/.test(devis),
    "un montant en euros est apparu dans la nomenclature : Atlas n'invente pas de prix"
  );
  const aMesurer = await page.locator(".sa .nl-p.manque").count();
  assert(aMesurer > 0, "plus aucune ligne « à mesurer » : les longueurs de tuyau sont redevenues devinées");
  // **Sa décision du 17 août** : la sortie est une liste de quantités qui part
  // chez le fournisseur. Le jour où cette planche reparle de chiffrer, elle
  // contredit le parcours qu'il a choisi.
  assert(/fournisseur/i.test(devis), "la planche ne dit plus que la liste part chez le fournisseur");
});

await contexte.close();
await navigateur.close();

console.log(`\n${echecs === 0 ? "✅" : "❌"} Plan d'arrosage — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
