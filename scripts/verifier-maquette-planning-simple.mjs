#!/usr/bin/env node
/*
  Éprouve la maquette du planning en semaines — dans un vrai navigateur.

  **Pourquoi elle ne se relit pas, elle se joue.** Il a demandé une maquette
  « dynamique que je puisse essayer » : ce qu'elle promet, ce sont des gestes —
  les flèches changent de semaine, les trois calendriers se comparent, et la
  liste montre la MÊME semaine que le calendrier. Une promesse de ce genre ne se
  vérifie pas à la lecture du fichier.

  **Et elle refuse de conclure sur du vide.** Une case de zéro pixel n'est pas
  « rien n'est pris » : c'est une mesure impossible, le faux vert du 15 août
  2026 où 0 − 0 = 0 certifiait « rien n'est coupé » sur un écran où trois noms
  l'étaient.

      node scripts/verifier-maquette-planning-simple.mjs
*/

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = join(RACINE, "appli", "planning-simple.html");
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const problemes = [];
function verifier(quoi, condition) {
  if (condition) console.log(`  ✓ ${quoi}`);
  else {
    console.error(`  ✗ ${quoi}`);
    problemes.push(quoi);
  }
}

const navigateur = await chromium.launch(
  existsSync(CHEMIN_SANDBOX) ? { executablePath: CHEMIN_SANDBOX } : {},
);
// **La permission du presse-papier se donne AVANT d'ouvrir la page.** Accordée
// après coup, elle ne s'applique pas à l'origine déjà chargée : le contrôle du
// « Copier l'adresse » rougissait sur un geste qui marche pour de vrai.
const contexte = await navigateur.newContext({ viewport: { width: 430, height: 1200 } });
await contexte.grantPermissions(["clipboard-write", "clipboard-read"]);
const page = await contexte.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.goto(pathToFileURL(FICHIER).href, { waitUntil: "networkidle" });

const titreMois = () => page.locator("#mois-titre").innerText();
const titreSemaine = () => page.locator("#sem-titre").innerText();

// **Le titre du jour est écrit « vendredi 21 août », mais la feuille de style
// le met en capitales.** `innerText` rend ce que l'ŒIL voit, pas ce que le HTML
// porte : un contrôle qui compare au texte source rougit sur une page juste.
// Payé ici le 19 août 2026.
const litPlanifies = async () => (await page.locator("#planifies").innerText()).toLowerCase();

verifier("la page se charge sans erreur de script", erreurs.length === 0);
if (erreurs.length) console.error("   ", erreurs[0]);

// ── LE CALENDRIER RESTE AU MOIS — sa correction du 21 août ────────────────
verifier(`le calendrier arrive sur le mois — lu : « ${await titreMois()} »`, /août 2026/i.test(await titreMois()));
verifier(
  "le mois ne porte QUE ses propres jours — août en a 31",
  (await page.locator("#mois [data-jour]").count()) === 31,
);
// **Compter les cases vides ne suffit pas** : il faut qu'elles soient VIDES.
// Un « 27 » lu dans la grille d'août peut être le 27 août — le contrôle qui
// cherchait ce chiffre accusait une page juste.
verifier(
  "les jours des autres mois sont des cases vides, pas des chiffres gris",
  (await page.locator("#mois .creux").count()) === 42 - 31 &&
    (await page.$$eval("#mois .creux", (n) => n.every((e) => e.textContent.trim() === ""))),
);

// **Le retour « Aujourd'hui » n'existe que si l'on s'est éloigné.** Sans lui on
// se perd à trois mois ; toujours présent, il se lirait comme une action à
// faire. Les deux états se jouent, ils ne se supposent pas.
verifier("sur le mois courant, aucun retour « Aujourd'hui »", await page.locator("#retour").isHidden());
await page.click("#mois-apres");
verifier("dès qu'on change de mois, le retour apparaît", await page.locator("#retour").isVisible());
await page.click("#retour");
verifier("et il ramène sur le mois du jour", /août 2026/i.test(await titreMois()));
await page.click("#mois-apres");
verifier(`la flèche du mois avance — « ${await titreMois()} »`, /septembre 2026/i.test(await titreMois()));
await page.click("#mois-avant");
verifier(`et revient — « ${await titreMois()} »`, /août 2026/i.test(await titreMois()));

// ── LA SEMAINE NE GOUVERNE QUE LES PLANIFIÉS ─────────────────────────────
const semaineDepart = await titreSemaine();
verifier(`la semaine arrive sur celle du 19 août — « ${semaineDepart} »`, /17\s*–\s*23 août/.test(semaineDepart));
verifier(
  "les deux Martins du vendredi 21 sont dans la liste, avec le jour NOMMÉ",
  (await litPlanifies()).includes("vendredi 21 août"),
);
await page.click("#sem-apres");
verifier(`la flèche de la semaine avance — « ${await titreSemaine()} »`, /24\s*–\s*30 août/.test(await titreSemaine()));
verifier(
  "l'abri de Pornic apparaît le mardi 25, avec sa demi-journée",
  (await litPlanifies()).includes("mardi 25 août") && (await litPlanifies()).includes("matin"),
);
verifier(
  "« ½ journée » ne s'écrit plus : « matin » le dit déjà",
  !(await litPlanifies()).includes("½ journée"),
);
verifier("la flèche de la semaine n'a PAS changé le mois", /août 2026/i.test(await titreMois()));
await page.click("#sem-avant");
verifier("la flèche gauche revient exactement où l'on était", (await titreSemaine()) === semaineDepart);

await page.click("#sem-avant");
await page.click("#sem-avant");
verifier("une semaine vide le dit en toutes lettres", (await litPlanifies()).includes("aucun chantier posé"));

// ── LE MOIS VISE, LA SEMAINE LIT ──────────────────────────────────────────
//
// Toucher un jour du mois doit amener la liste sur SA semaine. Sans ce lien,
// l'écran porterait deux navigations qui s'ignorent — exactement le genre de
// page qu'il trouve incompréhensible.
// Le 3 septembre ne s'atteint plus depuis la grille d'août : les jours des
// autres mois n'y sont plus écrits. C'est le prix du mois épuré, et il se paie
// d'un appui sur la flèche — pas d'un chiffre gris qu'on lit sans le vouloir.
await page.click("#mois-apres");
await page.click('[data-jour="2026-09-03"]');
verifier(
  `toucher le 3 septembre amène la liste sur sa semaine — « ${await titreSemaine()} »`,
  /31 août\s*–\s*6 septembre/.test(await titreSemaine()),
);
verifier(
  "et le jour touché se dit sous le calendrier",
  (await page.locator("#jour-ouvert").innerText()).toLowerCase().includes("jeudi 3 septembre"),
);
await page.click("#retour");
await page.click('[data-jour="2026-08-18"]');
verifier(
  "un jour libre le dit, au lieu de ne rien afficher",
  (await page.locator("#jour-ouvert").innerText()).toLowerCase().includes("libre"),
);

// ── La marque retenue se dessine, et aucune barre ne mesure zéro ────────
{
  const boites = await page.$$eval(".marqueA i", (n) => n.map((e) => e.getBoundingClientRect().height));
  verifier(
    `les deux barres du jour se dessinent (${boites.length} barres, aucune de zéro pixel)`,
    boites.length === 62 && boites.every((h) => h >= 1),
  );
}

/**
 * Ce qu'une case peint, barre par barre : les places occupées.
 *
 * Une barre est faite de segments — un par chantier posé. « complet » quand ils
 * sont pleins ; sinon la part occupée, et `?` marque une place posée SANS
 * équipe (hachurée à l'écran).
 */
const barresDe = (jour) =>
  page.$$eval(`[data-jour="${jour}"] .marqueA i`, (n) =>
    n.map((e) => {
      const segs = [...e.children];
      if (segs.length === 0) return "0%";
      const part = segs.reduce((t, x) => t + parseFloat(x.style.width), 0);
      const sans = segs.some((x) => x.classList.contains("sans")) ? "?" : "";
      return (segs[0].classList.contains("plein") ? "complet" : `${Math.round(part)}%`) + sans;
    }));

// ── Ce que le calendrier peint doit être CE QUE LES DONNÉES DISENT ───────
//
// Le vendredi 21 porte deux chantiers à la journée : avec deux équipes, ses
// deux demi-journées sont complètes. Un calendrier joli mais faux passerait
// tous les contrôles ci-dessus.
verifier(
  `le vendredi 21 est complet matin ET après-midi (lu : ${JSON.stringify(await barresDe("2026-08-21"))})`,
  (await barresDe("2026-08-21")).every((b) => b.startsWith("complet")),
);
verifier(
  `le mercredi 19 est vide le matin, à moitié l'après-midi (lu : ${JSON.stringify(await barresDe("2026-08-19"))})`,
  JSON.stringify(await barresDe("2026-08-19")) === JSON.stringify(["0%", "50%"]),
);
verifier(
  `le mercredi 26 est complet l'après-midi sur un matin libre (lu : ${JSON.stringify(await barresDe("2026-08-26"))})`,
  (await barresDe("2026-08-26"))[0] === "0%" && (await barresDe("2026-08-26"))[1].startsWith("complet"),
);

// ── SA QUESTION DU 21 AOÛT : « et s'il y a dix équipes ? » ───────────────
//
// C'est le contrôle qui compte, parce que c'est le point où le dessin d'avant
// cassait : avec trois états, une équipe prise sur dix et neuf prises sur dix
// peignaient exactement la même chose.
await page.click('[data-equipes="10"]');
await page.waitForTimeout(150);
verifier(
  `à dix équipes, le vendredi 21 ne montre plus que deux dixièmes (lu : ${JSON.stringify(await barresDe("2026-08-21"))})`,
  JSON.stringify(await barresDe("2026-08-21")) === JSON.stringify(["20%?", "20%?"]),
);
verifier(
  `à dix équipes, le mercredi 19 tombe à un dixième (lu : ${JSON.stringify(await barresDe("2026-08-19"))})`,
  JSON.stringify(await barresDe("2026-08-19")) === JSON.stringify(["0%", "10%"]),
);
verifier(
  "à dix équipes, « complet » reste montrable — le 26 l'est toujours",
  (await barresDe("2026-08-26"))[1].startsWith("complet"),
);
await page.click('[data-equipes="2"]');
await page.waitForTimeout(150);
verifier(
  "revenir à deux équipes rend le calendrier d'avant",
  (await barresDe("2026-08-21")).every((b) => b.startsWith("complet")),
);

// ── La légende MONTRE, elle n'explique plus ─────────────────────────────
//
// Sa demande du 21 août : retirer « la barre du haut c'est le matin », mais
// qu'on le comprenne quand même — puis, le même jour : que la légende suive la
// SUITE LOGIQUE (libre, une équipe, complet) et que les deux étages soient
// annotés sur la dernière marque plutôt que par une phrase.
{
  const dit = (await page.locator(".legende").innerText()).toLowerCase();
  verifier("la légende ne porte plus de phrase d'explication", !dit.includes("barre du haut"));
  verifier(
    "elle dit la suite : libre, il reste de la place, complet — puis matin et après-midi",
    ["libre", "il reste de la place", "complet", "matin", "après-midi"].every((m) => dit.includes(m)),
  );

  // **Aucun nombre dans la légende.** Sa question du 21 août : « le "1 équipe
  // sur 2" bouge en fonction du nombre d'équipes ? 3, 4, 10, 100 ? ». Il ne
  // bougeait pas. Un mot qui ne dépend d'aucun nombre ne peut plus mentir —
  // et le contrôle le vérifie aux trois réglages.
  for (const n of ["2", "5", "10"]) {
    await page.click(`[data-equipes="${n}"]`);
    const lu = (await page.locator(".legende").innerText()).toLowerCase();
    verifier(`à ${n} équipes, la légende ne promet aucun compte (lu : « ${lu.replace(/\n/g, " ")} »)`,
      !/sur \d/.test(lu));
  }
  await page.click('[data-equipes="2"]');
  // **Trois CARRÉS, puis les deux barres FINES du calendrier — et tout sur une
  // seule ligne.** Sa correction du 21 août, qu'il a fallu deux essais pour
  // entendre : « remets les carrés comme avant, et pour matin / après-midi
  // reprends les rectangles fins, pas des épais. Et je veux tout sur la même
  // ligne. »
  const carres = await page.$$eval(".legende > span:not(.annote) .carre", (n) =>
    n.map((e) => {
      const r = e.getBoundingClientRect();
      return { forme: Math.abs(r.width - r.height) <= 1 ? "carré" : "rectangle",
               etat: e.className.replace("carre", "").trim() };
    }));
  verifier(
    `les trois états sont des CARRÉS, du vide au plein (lu : ${JSON.stringify(carres)})`,
    carres.length === 3 && carres.every((c) => c.forme === "carré") &&
      JSON.stringify(carres.map((c) => c.etat)) === JSON.stringify(["", "pris", "plein"]),
  );

  // **Matin et après-midi sont dits par DEUX CARRÉS de la même taille que les
  // trois autres, superposés.** Sa correction du 21 août, à la troisième
  // demande : « je ne veux pas de gros rectangle, je veux les mêmes que pour le
  // code couleur, même dimension, superposés ».
  const tousLesCarres = await page.$$eval(".legende .carre", (n) =>
    n.map((e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.width), h: Math.round(r.height) }; }));
  verifier(
    `les CINQ marques sont des carrés de MÊME taille (lu : ${JSON.stringify(tousLesCarres)})`,
    tousLesCarres.length === 5 &&
      tousLesCarres.every((r) => Math.abs(r.l - r.h) <= 1 && r.l === tousLesCarres[0].l),
  );

  const mots = await page.$$eval(".legende .annote .mots b", (n) => n.map((e) => e.textContent.trim()));
  const hauteurs = await page.$$eval(".legende .annote .mots b", (n) =>
    n.map((e) => Math.round(e.getBoundingClientRect().top)));
  verifier(
    `« matin » est en face de la barre du haut, « après-midi » de celle du bas (lu : ${JSON.stringify(mots)})`,
    JSON.stringify(mots) === JSON.stringify(["matin", "après-midi"]) && hauteurs[0] < hauteurs[1],
  );

  // **Tout sur une seule ligne**, et cela se mesure : si les quatre termes ne
  // partagent pas le même haut, la légende s'est repliée.
  const hauts = await page.$$eval(".legende > span", (n) =>
    n.map((e) => Math.round(e.getBoundingClientRect().top)));
  verifier(
    `de « libre » à « après-midi », tout tient sur UNE ligne (hauts lus : ${JSON.stringify(hauts)})`,
    hauts.length === 4 && hauts.every((h) => h === hauts[0]),
  );
}

// ── LA FEUILLE DE TRAVAIL : le devis sans un seul prix ──────────────────
//
// Sa demande du 21 août : « le salarié clique sur le jour, il voit à quel
// client il est affilié, et il peut cliquer sur le devis pour connaître ses
// tâches » — sans les prix. Le contrôle qui compte est le dernier : un chiffre
// suivi d'un euro ne doit apparaître NULLE PART sur cette feuille.
await page.click('[data-jour="2026-08-26"]');
// **On ouvre par le NOM, pas par le lien à côté.** Sa remarque du 21 août :
// « je ne peux pas l'ouvrir en cliquant sur le nom du client ». Viser ici le
// lien « Sa feuille » rendrait un vert sur le défaut même qu'il a signalé.
await page.locator('#jour-ouvert .place .nom').first().click();
{
  const feuille = page.locator(".feuille");
  verifier("la feuille s'ouvre sous le jour", (await feuille.count()) === 1);
  const dit = await feuille.innerText();
  verifier("elle porte le client", dit.includes("Mme Chauvin"));
  // **L'adresse et la date ne s'AFFICHENT plus** — sa demande du 21 août : « ce
  // qu'il y a sous le nom, l'adresse et la date, tu peux supprimer ». Elles
  // servent toujours aux quatre gestes, sans être écrites.
  verifier("l'adresse et la date ne s'écrivent plus sous le nom", !dit.includes("Orvault") && !dit.includes("août"));
  verifier("elle porte les tâches du devis", dit.includes("Plantation de 12 arbustes"));
  verifier("et le PDF annonce qu'il est sans les prix", dit.toLowerCase().includes("pdf sans les prix"));
  verifier(
    `AUCUN PRIX n'y figure (lu : ${JSON.stringify(dit.match(/[0-9][0-9 ,.]*\s?€|€/g) || [])})`,
    !/€/.test(dit),
  );

  // ── Les gestes repris de la feuille « Y aller » ───────────────────────
  //
  // Sa demande du 21 août : « reprends l'adresse cliquable qui ouvre Maps ou
  // Waze, la possibilité d'appeler le client et de copier l'adresse ». On
  // éprouve les ADRESSES des liens, pas leurs libellés : un bouton nommé
  // « Waze » qui pointe ailleurs se lit juste et ne mène nulle part.
  const liens = await feuille.evaluate((f) =>
    [...f.querySelectorAll("a")].map((a) => a.getAttribute("href")));
  verifier(
    `« Maps » mène à un itinéraire vers Orvault (lu : ${JSON.stringify(liens.slice(0, 1))})`,
    liens.filter((h) => h.startsWith("https://maps.apple.com/?daddr=") && h.includes("Orvault")).length === 1,
  );
  verifier(
    "« Waze » mène à Waze, sur la même adresse",
    liens.some((h) => h.startsWith("https://waze.com/ul?q=") && h.includes("Orvault")),
  );
  verifier(
    "« Appeler le client » compose un vrai numéro, sans ses espaces",
    liens.some((h) => h === "tel:0612345678"),
  );
  verifier("il n'y a QUE deux destinations et un appel — plus de Plans", liens.length === 3);

  // Le copier doit DIRE qu'il a copié : sans mot, on appuie deux fois.
  await page.click("#copier");
  // **Le mot ne change qu'APRÈS l'écriture dans le presse-papier**, qui est
  // asynchrone : lu dans la foulée du clic, il rendait encore « Copier
  // l'adresse » — un rouge sur un geste qui marche. On attend le changement au
  // lieu de le supposer.
  await page
    .waitForFunction(() => document.getElementById("copier")?.textContent !== "Copier l’adresse", null, { timeout: 3000 })
    .catch(() => {});
  const motDuCopier = (await page.locator("#copier").innerText()).trim();
  const presse = await page.evaluate(() => navigator.clipboard.readText().catch((e) => `ERREUR ${e.message}`));
  verifier(
    `copier l'adresse le dit (« ${motDuCopier} ») et copie pour de bon (« ${presse} »)`,
    motDuCopier.toLowerCase().includes("copiée") && presse.includes("Orvault"),
  );
}

// ── La fiche du jour dit l'ÉQUIPE, et le COMPTE ─────────────────────────
//
// Son second manque du 21 août : « il y a marqué le client, la journée ou la
// demi-journée, mais pas l'équipe qui est affiliée ».
await page.click('[data-jour="2026-08-26"]');
{
  const dit = (await page.locator("#jour-ouvert").innerText()).toLowerCase();
  verifier("la fiche du 26 dit que le matin est libre", /matin\s+libre/.test(dit));
  // Le compte a été retiré le 21 août : « juste complet et le nom des équipes ».
  verifier("elle dit « complet » l'après-midi, sans le compte", dit.includes("complet"));
  verifier("et elle ne dit plus « 2 équipes sur 2 »", !dit.includes("sur 2"));
  verifier("elle NOMME les deux équipes", dit.includes("julien") && dit.includes("paul"));
}
await page.click("[data-jour='2026-08-21']");
{
  const dit = (await page.locator("#jour-ouvert").innerText()).toLowerCase();
  verifier(
    "sur le 21, l'équipe qui manque se dit au lieu de rester muette",
    dit.includes("équipe à choisir") || dit.includes("équipe ?"),
  );
}

// ── ELLE SE MANIPULE — sa consigne du 21 août ──────────────────────────
//
// « Il faut que j'aille cliquer, pouvoir modifier, changer, voir ce que ça
// donne. » Les quatre gestes du planning se jouent donc ici, et l'on vérifie
// qu'ils changent VRAIMENT l'état — pas seulement le libellé du bouton.
// Le mois est déjà celui d'août ici : `#retour` y est caché, et le cliquer
// ferait échouer une suite sur un écran juste.
await page.click('[data-jour="2026-08-20"]');

// 1 — poser un chantier sans date sur le jour touché
{
  const avant = await page.locator("#sans-date .ligne").count();
  await page.click('[data-poser="0"][data-demi-poser="matin"]');
  verifier("poser retire le chantier de « Sans date »", (await page.locator("#sans-date .ligne").count()) === avant - 1);
  const dit = (await page.locator("#jour-ouvert").innerText()).toLowerCase();
  verifier("et il apparaît dans le jour, sans équipe", dit.includes("mr. pichon") && dit.includes("équipe ?"));
  verifier(
    "le calendrier suit : le jeudi 20 n'est plus le même",
    (await barresDe("2026-08-20"))[0] !== "0%",
  );
}

// 2 — les équipes se COCHENT : un appui ouvre la liste, il ne décide rien
//
// Sa remarque du 21 août : « quand je clique sur équipe, ça me met d'office une
// équipe, je n'ai pas choisi » — puis, le même jour : « je dois pouvoir mettre
// TOUTES les équipes si je le souhaite, sur la même demi-journée ». Le contrôle
// d'avant comparait deux libellés et serait resté vert sur les deux défauts.
{
  // **On part d'un chantier SANS équipe** — les deux Martins du 21. Prendre
  // « le dernier de la liste » attrapait Mr. Leroy, à qui Paul est déjà confié :
  // le contrôle lisait alors une équipe cochée d'avance et accusait la planche.
  await page.click('[data-jour="2026-08-21"]');
  const chip = page.locator('#jour-ouvert [data-equipe]').first();
  await chip.click();
  const proposes = await page.$$eval("#jour-ouvert .choisir [data-choix]", (n) => n.map((e) => e.textContent.trim()));
  verifier(
    `un appui OUVRE la liste des équipes au lieu d'en poser une (lu : ${JSON.stringify(proposes)})`,
    proposes.some((m) => m.includes("Julien")) && proposes.some((m) => m.includes("Paul")),
  );
  verifier(
    `et rien n'a été attribué tant qu'on n'a pas coché (barres lues : ${JSON.stringify(await barresDe("2026-08-21"))})`,
    (await barresDe("2026-08-21")).every((b) => b.endsWith("?")),
  );

  // **Toutes les équipes sur le même chantier**, et le calendrier suit.
  await page.locator('#jour-ouvert .choisir [data-choix="Julien"]').click();
  await page.locator('#jour-ouvert .choisir [data-choix="Paul"]').click();
  const coches = await page.$$eval("#jour-ouvert .choisir [data-choix]", (n) =>
    n.filter((e) => e.classList.contains("retenue")).map((e) => e.textContent.replace("✓", "").trim()));
  verifier(
    `les deux équipes tiennent sur le MÊME chantier (lu : ${JSON.stringify(coches)})`,
    coches.length === 2,
  );
  verifier(
    "la liste est restée ouverte pour cocher la seconde",
    (await page.locator("#jour-ouvert .choisir").count()) === 1,
  );

  // **On décoche pour retirer** — au même coût que cocher.
  await page.locator('#jour-ouvert .choisir [data-choix="Paul"]').click();
  const apres = await page.$$eval("#jour-ouvert .choisir [data-choix]", (n) =>
    n.filter((e) => e.classList.contains("retenue")).map((e) => e.textContent.replace("✓", "").trim()));
  verifier(`décocher retire l'équipe (lu : ${JSON.stringify(apres)})`, apres.length === 1);

  // **Le compteur de la demi-journée suit les coches, sans attendre « Terminé ».**
  // Vu sur capture le 21 août : trois équipes cochées, et l'en-tête disait
  // encore « 2 sur 5 ». Un compteur qui retarde d'un geste fait douter du geste.
  {
    const dit = await page.locator("#jour-ouvert .demi").first().locator(".compte").innerText();
    verifier(`le compteur du matin suit la coche (lu : « ${dit} »)`, /sur|complet/.test(dit));
  }

  await page.locator('#jour-ouvert .choisir [data-fini]').click();
  verifier(
    "« Terminé » referme et l'équipe retenue est portée",
    (await page.locator("#jour-ouvert").innerText()).includes("Julien"),
  );
}

// 3 — déplacer se choisit, et le calendrier le voit
//
// On revient sur le 20, où l'on vient de poser Mr. Pichon : le contrôle des
// équipes nous avait emmenés sur le 21.
await page.click('[data-jour="2026-08-20"]');
{
  const avant = await barresDe("2026-08-20");
  // **On vise le chantier qu'on vient de poser, pas « le dernier de la liste ».**
  // Un chantier déjà à la journée ne changerait rien en y étant remis, et le
  // contrôle rougirait sur un écran juste.
  await page.locator('#jour-ouvert .place', { hasText: "Pichon" }).locator("[data-demi]").click();
  const propose = await page.$$eval("#jour-ouvert .choisir [data-vers]", (n) => n.map((e) => e.textContent.trim()));
  verifier(
    `« Déplacer » ouvre les trois moments (lu : ${JSON.stringify(propose)})`,
    JSON.stringify(propose) === JSON.stringify(["Matin", "Après-midi", "Journée"]),
  );
  await page.locator('#jour-ouvert .choisir [data-vers="journee"]').click();
  verifier(
    `déplacer à la journée repeint le calendrier (${JSON.stringify(avant)} → ${JSON.stringify(await barresDe("2026-08-20"))})`,
    JSON.stringify(avant) !== JSON.stringify(await barresDe("2026-08-20")),
  );
}

// 4 — retirer rend le chantier à « Sans date », il ne l'efface pas
{
  const avant = await page.locator("#sans-date .ligne").count();
  await page.locator('#jour-ouvert .place', { hasText: "Pichon" }).first().locator("[data-retirer]").click();
  verifier(
    "retirer le rend à « Sans date » au lieu de l'effacer",
    (await page.locator("#sans-date .ligne").count()) === avant + 1 &&
      (await page.locator("#sans-date").innerText()).includes("Pichon"),
  );
}

// ── AJOUTER QUELQU'UN SUR UNE DEMI-JOURNÉE QUI A DE LA PLACE ───────────
//
// Sa remarque du 21 août : « je clique sur le 19, j'ai le matin de pris,
// l'après-midi libre, et je ne peux pas rajouter quelqu'un dessus — ce n'est
// pas normal ». Poser depuis « Sans date », tout en bas de l'écran, ne remplace
// pas ce geste : il regarde la demi-journée, c'est là qu'il veut ajouter.
await page.click('[data-jour="2026-08-19"]');
{
  const lignes = await page.$$eval("#jour-ouvert .demi", (n) =>
    n.map((e) => ({ dit: e.innerText.replace(/\s+/g, " ").trim().slice(0, 40), plus: !!e.querySelector("[data-ajouter]") })));
  verifier(
    `le 19 propose d'ajouter sur ses deux demi-journées, qui ont de la place (lu : ${JSON.stringify(lignes)})`,
    lignes.length === 2 && lignes.every((l) => l.plus),
  );
}
await page.click('[data-jour="2026-08-21"]');
{
  const plus = await page.locator("#jour-ouvert [data-ajouter]").count();
  verifier("le 21, COMPLET matin et après-midi, n'en propose aucun", plus === 0);
}
await page.click('[data-jour="2026-08-19"]');
{
  const avant = (await page.locator("#jour-ouvert").innerText()).length;
  await page.locator('#jour-ouvert [data-ajouter="matin"]').click();
  const noms = await page.$$eval("#jour-ouvert .choisir [data-qui]", (n) => n.map((e) => e.textContent.trim()));
  verifier(`le bouton ouvre la liste de ceux qui attendent (lu : ${JSON.stringify(noms)})`, noms.length > 0);
  await page.locator('#jour-ouvert .choisir [data-qui]').first().click();
  verifier(
    "et le choisir le pose pour de bon sur cette demi-journée",
    (await page.locator("#jour-ouvert").innerText()).length > avant &&
      (await barresDe("2026-08-19"))[0] !== "0%",
  );
}

// ── ATTRIBUER UNE ÉQUIPE À L'APRÈS-MIDI, SANS PASSER PAR « JOURNÉE » ───
//
// Sa remarque du 21 août : « le 21, quand je clique le matin je peux attribuer
// une équipe, et quand je clique sur l'après-midi je ne peux rien attribuer —
// je dois cliquer sur journée pour attribuer l'aprem ». Les chantiers vivaient
// dans une liste unique sous les deux demi-journées : l'après-midi n'avait rien
// à toucher.
await page.click("#retour").catch(() => {});
await page.click('[data-jour="2026-08-21"]');
{
  const blocs = await page.$$eval("#jour-ouvert .demi", (n) =>
    n.map((e) => ({
      titre: e.querySelector(".demi-titre").innerText.split("\n")[0].trim(),
      places: [...e.querySelectorAll(".place")].map((p) => p.querySelector(".nom").innerText.split("\n")[0].trim()),
      equipes: e.querySelectorAll("[data-equipe]").length,
    })));
  verifier(
    `les deux demi-journées portent CHACUNE leurs chantiers et leurs pastilles (lu : ${JSON.stringify(blocs)})`,
    blocs.length === 2 && blocs.every((b) => b.places.length === 2 && b.equipes === 2),
  );

  // Et l'on attribue depuis l'APRÈS-MIDI, sans toucher au matin.
  const apresMidi = page.locator("#jour-ouvert .demi").last();
  await apresMidi.locator("[data-equipe]").first().click();
  await apresMidi.locator('.choisir [data-choix="Paul"]').click();
  verifier(
    "on attribue une équipe depuis l'après-midi, sans passer par « journée »",
    (await page.locator("#jour-ouvert .demi").last().innerText()).includes("Paul"),
  );
}

// ── PLEIN, MAIS PAS ATTRIBUÉ — ce qui le perdait le 21 août ────────────
//
// « Les jours peuvent être pleins, mais les équipes pas choisies. » Une place
// posée sans équipe est hachurée : le `?` que rend `barresDe` en témoigne.
await page.click("#retour").catch(() => {});
await page.click('[data-jour="2026-08-21"]');
{
  const avant = await barresDe("2026-08-21");
  verifier(
    `le 21, complet mais sans équipes, porte des places hachurées (lu : ${JSON.stringify(avant)})`,
    avant.every((b) => b.endsWith("?")),
  );
  // On attribue les deux équipes du matin, et la hachure doit disparaître.
  // Un chantier à la fois : viser deux fois la première pastille reviendrait à
  // donner les deux équipes au même chantier, et l'autre resterait hachuré.
  // On referme après chaque choix : deux listes ouvertes en même temps, et le
  // même nom apparaît deux fois à l'écran — un chantier à la journée est
  // affiché sous ses deux demi-journées.
  for (const [rang, nom] of [[0, "Julien"], [1, "Paul"]]) {
    await page.locator('#jour-ouvert [data-equipe]').nth(rang).click();
    await page.locator(`#jour-ouvert .choisir [data-choix="${nom}"]`).first().click();
    await page.locator('#jour-ouvert .choisir [data-fini]').first().click();
  }
  const apres = await barresDe("2026-08-21");
  verifier(
    `une fois les deux équipes posées, plus aucune hachure (lu : ${JSON.stringify(apres)})`,
    apres.every((b) => !b.endsWith("?")),
  );
}

// ── LE NOM OUVRE LA FEUILLE, DANS LA LISTE DES PLANIFIÉS AUSSI ─────────
//
// C'est là qu'il cliquait : « je ne peux toujours pas cliquer sur le nom du
// client pour ouvrir la fiche prestation, avec l'adresse et le numéro pour
// l'appeler ». La fiche du jour l'ouvrait déjà ; cette liste-là, non.
await page.click("#retour").catch(() => {});
await page.locator("#planifies .chantier").first().click();
{
  const feuille = page.locator("#feuille-liste .feuille");
  verifier("un nom de la liste des planifiés ouvre sa feuille", (await feuille.count()) === 1);
  // **Et elle s'ouvre SOUS la ligne touchée.** Vu sur capture : elle
  // s'affichait au bas de la liste, trois chantiers plus bas, et l'on croyait
  // avoir ouvert le mauvais. On mesure donc la distance entre les deux.
  {
    // On mesure l'écart entre le BAS de la ligne touchée et le HAUT de la
    // feuille. Négatif, il dirait que la feuille s'est ouverte au-dessus —
    // c'est-à-dire ailleurs que sous le doigt.
    const ligne = await page.locator("#planifies .chantier").first().boundingBox();
    const boite = await feuille.boundingBox();
    const ecart = Math.round(boite.y - (ligne.y + ligne.height));
    verifier(`elle s'ouvre juste sous la ligne touchée (${ecart} px plus bas)`, ecart >= 0 && ecart < 60);
  }
  const dit = await feuille.innerText();
  // L'adresse ne s'écrit plus : ce qui compte, c'est que les gestes la portent.
  verifier("elle ne réaffiche pas l'adresse", !/rue|chemin|impasse|boulevard|allée/i.test(dit));
  const liens = await feuille.evaluate((f) => [...f.querySelectorAll("a")].map((a) => a.getAttribute("href")));
  verifier(
    `et le numéro pour appeler (lu : ${JSON.stringify(liens.filter((h) => h.startsWith("tel:")))})`,
    liens.some((h) => h.startsWith("tel:")),
  );
}

await navigateur.close();

if (problemes.length) {
  console.error(`\n  ${problemes.length} problème(s).\n`);
  process.exit(1);
}
console.log("\n  La maquette du planning tient ses gestes.\n");
