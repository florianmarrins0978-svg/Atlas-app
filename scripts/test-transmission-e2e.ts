import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { numeroLisible } from "../src/lib/numero-lisible";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// Le dernier mètre : le message part-il au bon destinataire ?
//
// **Le défaut, vu sur sa capture du 2026-08-04.** Le bouton « Ouvrir le SMS
// tout prêt » passait d'abord par `navigator.share`. Sur iPhone, cette feuille
// de partage transmet un TEXTE — et rien d'autre : ni numéro, ni adresse. Le
// patron arrivait donc dans Messages avec le message tout écrit et un champ
// « À : » **vide**, alors qu'Atlas connaissait le numéro : « l'ajout
// automatique du numéro ne fonctionne pas ».
//
// Rien ne pouvait le voir. `test-message-client.ts` éprouve la fonction qui
// compose l'adresse `sms:0679…` — elle était juste. C'est l'écran qui ne s'en
// servait pas. Une règle juste que personne n'applique ne protège personne.
//
// D'où ce contrôle : il regarde **ce que la page propose réellement**, à
// l'endroit où le patron appuie. L'adresse est désormais portée par un vrai
// lien, donc lisible — c'est ce qui la rend vérifiable.

const BASE = "http://localhost:3000";
const TELEPHONE = "0679984514";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  // Le partage existe sur son téléphone : c'est justement ce qui déclenchait le
  // défaut. On le simule ici, sinon le contrôle éprouverait un cas qui n'est
  // pas le sien et resterait vert quoi qu'il arrive.
  await contexte.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => Promise.resolve(),
    });
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  // Un chantier complet, avec un client joignable par SMS.
  const client = `Luc ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', TELEPHONE);
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const chantierUrl = page.url();

  await page.goto(`${chantierUrl}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(400);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Élagage");
  await champs.nth(1).fill("840.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(800);

  await page.goto(`${chantierUrl}/export`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 15000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForURL(/localhost:3000\/$/, { timeout: 15000 }); // L'envoi ramène à L'ACCUEIL depuis le 21 août 2026 : c'est lui, le signal.

  // On revient sur l'écran du devis parti, comme il le fera par la carte du
  // chantier : il ne s'affiche plus de lui-même après l'envoi.
  await page.goto(`${chantierUrl}/export`, { waitUntil: "networkidle" });

  // --- « Télécharger le PDF » n'est plus sur cet écran ---------------------
  //
  // **Retiré le 21 août 2026, à sa demande** : devant cet écran il a voulu n'y
  // garder que deux gestes — ouvrir le message, et modifier le devis.
  //
  // La garantie du 7 août 2026 — *« quand je clique sur télécharger le PDF, ça
  // me propose pas de l'enregistrer, ça ouvre juste une page de plus »* — n'est
  // pas perdue pour autant : le même mécanisme (`?telecharger=1`, le nom sur le
  // lien, pas de `target`) sert la FACTURE, et il y est éprouvé par
  // `test-facture-au-client-e2e.ts`. Le devis, lui, garde son aperçu sur
  // `devis-complet`, où le patron l'a placé la veille.
  //
  // Ce qui reste ici est ce que cet écran porte encore, et qui a sa demande
  // derrière : le message tout prêt, et la bascule de canal.

  // --- Le défaut d'origine ------------------------------------------------
  const lienSms = page.locator("a[data-transmission]");
  const adresse = await lienSms.getAttribute("href");
  assert.ok(adresse, "Aucun lien de transmission : le patron n'a rien à toucher.");
  assert.ok(
    adresse.startsWith("sms:"),
    `Le lien n'ouvre pas la messagerie : « ${adresse.slice(0, 40)} »`
  );
  assert.ok(
    adresse.includes(TELEPHONE),
    `Le numéro du client n'est pas dans le lien : « ${adresse.slice(0, 60)} ». ` +
      "Le patron devra le retaper, exactement le défaut du 2026-08-04."
  );
  console.log("  ✓ le lien SMS porte le numéro du client");

  // Et il est annoncé AVANT d'ouvrir la messagerie, pas découvert dedans.
  //
  // La phrase entière, et non le seul numéro : JSX supprime l'espace en fin de
  // ligne, et cette sous-ligne a affiché « Au 0679984514— c'est vous qui
  // l'envoyez. » Même défaut que « Fin de chantieren haut » sur la fiche —
  // deux fois le même piège, donc un contrôle plutôt qu'une vigilance.
  //
  // **Et le numéro est ESPACÉ** depuis le 12 août (`src/lib/numero-lisible.ts`) :
  // collé, il ne se vérifiait pas d'un coup d'œil, et c'est pourtant la dernière
  // occasion de voir qu'on s'adresse au mauvais client. Le lien `sms:` ci-dessus,
  // lui, porte toujours le numéro brut — les deux assertions se tiennent, et
  // c'est voulu : le jour où l'affichage contaminerait le lien, la première
  // rougirait.
  const sousLigne = await page.locator("text=/c'est vous qui l'envoyez/").first().innerText();
  assert.equal(
    sousLigne.replace(/\s+/g, " ").trim(),
    `Au ${numeroLisible(TELEPHONE)} — c'est vous qui l'envoyez.`,
    `La phrase du destinataire est mal composée : « ${sousLigne} »`
  );
  console.log("  ✓ le destinataire est annoncé sur l'écran, phrase entière");

  // --- Changer d'avis -----------------------------------------------------
  // « Si je veux l'envoyer par e-mail, je ne peux pas revenir le choisir. »
  const bascule = page.getByRole("button", { name: /Plutôt par e-mail/ });
  assert.equal(await bascule.count(), 1, "Aucun moyen de basculer vers l'e-mail depuis cet écran.");

  // **Elle se VOIT, et c'est mesuré — sa demande du 13 août.** Elle était en
  // gris 13 px sous la ligne du destinataire et se lisait comme une mention
  // légale : « il faut le mettre en gras ou en doré, et légèrement plus gros ».
  // Un contrôle qui se contenterait de sa présence laisserait passer un retour
  // au gris sans rien dire — or c'est exactement la façon dont ce genre de
  // décision se perd.
  const allure = await bascule.evaluate((n) => {
    const s = getComputedStyle(n);
    return { couleur: s.color, taille: parseFloat(s.fontSize), graisse: Number(s.fontWeight) };
  });
  assert.equal(
    allure.couleur,
    "rgb(185, 139, 71)",
    `« Plutôt par e-mail » n'est plus en or (#B98B47) — mesuré « ${allure.couleur} ».`
  );
  assert.ok(
    allure.taille >= 15 && allure.taille < 16,
    `« Plutôt par e-mail » doit être à 15 px — plus gros que la rangée (13), moins que le bouton (16). Mesuré ${allure.taille}.`
  );
  assert.ok(allure.graisse >= 600, `« Plutôt par e-mail » doit être en gras. Mesuré ${allure.graisse}.`);
  console.log("  ✓ « Plutôt par e-mail » se voit : or, gras, 15 px");

  await bascule.click();
  await page.waitForTimeout(500);

  // Ce client n'a pas d'e-mail : l'écran doit le dire ET permettre de le saisir,
  // puisqu'aucun autre écran ne le permet.
  const champEmail = page.getByLabel("Adresse e-mail");
  assert.equal(await champEmail.count(), 1, "Sans adresse e-mail, aucun champ n'est offert : le patron reste bloqué.");
  await champEmail.fill("luc@exemple.fr");
  await page.getByRole("button", { name: /Enregistrer et ouvrir/ }).click();
  await page.waitForTimeout(2500);

  // La coordonnée est conservée sur la fiche du client : au chantier suivant,
  // elle ne se redemande pas.
  await page.goto(`${chantierUrl}/export`, { waitUntil: "networkidle" });
  const texte = await page.locator("body").innerText();
  assert.ok(
    texte.includes("luc@exemple.fr"),
    "L'adresse saisie n'a pas été conservée : elle serait à ressaisir à chaque envoi."
  );
  console.log("  ✓ l'adresse saisie est conservée sur la fiche du client");

  await contexte.close();
  await navigateur.close();
  console.log("✅ Le message part au bon destinataire, et le canal se change.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
