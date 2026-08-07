import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";

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
  const contexte = await navigateur.newContext({ viewport: { width: 393, height: 852 } });
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
  await page.fill('input[placeholder="M. Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', TELEPHONE);
  await page.click('button:has-text("Créer le chantier")');
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
  await page.click("text=Envoyer au client");
  await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 15000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForSelector("text=Devis prêt pour", { timeout: 15000 });

  // --- « Télécharger », pas « ouvrir un onglet de plus » -------------------
  //
  // Le patron, le 7 août 2026 : « quand je clique sur télécharger le PDF, ça me
  // propose pas de l'enregistrer, ça ouvre juste une page de plus ». Le lien
  // servait le document `inline`, et sans nom de fichier : un navigateur
  // l'affiche alors et n'offre rien.
  //
  // Les trois conditions se tiennent, et aucune ne suffit seule :
  //   - `attachment` côté serveur (`?telecharger=1`), sinon Chrome affiche ;
  //   - le nom sur le LIEN, sinon Safari nomme le fichier d'après la page —
  //     c'est le défaut de la sauvegarde, le même matin ;
  //   - pas de `target`, sinon l'onglet neuf prive Safari de sa demande
  //     d'enregistrement.
  const lienPdf = page.getByRole("link", { name: "Télécharger le PDF" });
  assert.equal(await lienPdf.count(), 1, "Le devis envoyé ne propose plus de télécharger son PDF.");
  const hrefPdf = (await lienPdf.getAttribute("href")) ?? "";
  assert.match(
    hrefPdf,
    /telecharger=1/,
    `Le lien sert le PDF en aperçu (« ${hrefPdf} ») : le navigateur l'affichera au lieu de l'enregistrer.`
  );
  const nomPdf = (await lienPdf.getAttribute("download")) ?? "";
  assert.match(
    nomPdf,
    /^devis-.+\.pdf$/,
    `Le lien n'annonce aucun nom de fichier (« ${nomPdf} ») : sur iPhone, le PDF arrivera sous le nom de la page, sans extension.`
  );
  assert.equal(
    await lienPdf.getAttribute("target"),
    null,
    "Le lien ouvre un onglet : Safari y affiche le PDF au lieu de proposer de l'enregistrer."
  );

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
  const sousLigne = await page.locator("text=/c'est vous qui l'envoyez/").first().innerText();
  assert.equal(
    sousLigne.replace(/\s+/g, " ").trim(),
    `Au ${TELEPHONE} — c'est vous qui l'envoyez.`,
    `La phrase du destinataire est mal composée : « ${sousLigne} »`
  );
  console.log("  ✓ le destinataire est annoncé sur l'écran, phrase entière");

  // --- Changer d'avis -----------------------------------------------------
  // « Si je veux l'envoyer par e-mail, je ne peux pas revenir le choisir. »
  const bascule = page.getByRole("button", { name: /Plutôt par e-mail/ });
  assert.equal(await bascule.count(), 1, "Aucun moyen de basculer vers l'e-mail depuis cet écran.");
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
