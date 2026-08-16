/*
  Contrôle de « la TVA au paiement » — JavaScript coupé, iPhone 13, meta
  viewport injectée.

  Sa question, le 14 août 2026 : *« si un client décide de ne pas me payer la
  facture, je vais avoir des problèmes. Est-ce que la facture peut rentrer au
  relevé seulement une fois que le client m'a payé ? »*

  CE QUE CES CONTRÔLES TIENNENT, et qui n'est pas l'allure :

    · **une facture impayée ne figure PAS au relevé**, sous le régime des
      encaissements. C'est toute sa demande, et c'est la seule chose que cette
      planche doit démontrer ;
    · **le paiement la fait entrer**, et le total change du bon montant. Un
      écart faux ici serait pire qu'un écran vide : il lui ferait croire à un
      calcul qu'on n'a pas fait ;
    · **aux débits, le paiement ne change RIEN** — et l'écran le dit. C'est ce
      qui lui permet de comparer les deux régimes plutôt que de nous croire ;
    · **ce qui n'est pas au relevé est ANNONCÉ**, avec son montant. Une facture
      silencieusement absente se lirait comme un oubli de l'application.

  CHACUN SAIT ÉCHOUER : retirer `.l-enc-oui{display:flex}` rougit le second ;
  retirer le bloc `.attente` rougit le quatrième ; intervertir les deux totaux
  rougit le premier.

  RÉSERVE : ceci éprouve un DESSIN, et un dessin ne dit pas le droit. Sous quel
  régime le patron se trouve, lui seul peut le dire (`docs/A-FAIRE.md` §11).
  Rien n'est posé dans `src/` (`CLAUDE.md` §3 bis).
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-tva-au-paiement.html";
const SORTIE = "maquettes/vues";

const echecs = [], ok = [];
const verifie = (n, c, d = "") => (c ? ok.push(n) : echecs.push(`${n}${d ? " — " + d : ""}`));

const source = fs.readFileSync(FICHIER, "utf8");
verifie("aucune balise <script>", !/<script/i.test(source));
verifie("aucun gestionnaire en ligne", !/\son[a-z]+\s*=/i.test(source));
verifie("les libellés portent cursor:pointer (Safari l'exige)",
  /(^|[\s,{}])label\s*\{[^}]*cursor:\s*pointer/m.test(source));
verifie("aucun commentaire JSX égaré (il s'afficherait à l'écran)", !/\{\/\*/.test(source));

const ESSAI = FICHIER.replace(/\.html$/, "-essai.html");
fs.writeFileSync(ESSAI, '<meta name="viewport" content="width=device-width, initial-scale=1">\n' + source);

const nav = await chromium.launch(
  process.env.CHROMIUM_BIN === "playwright"
    ? {}
    : { executablePath: process.env.CHROMIUM_BIN || "/opt/pw-browsers/chromium" }
);
const ctx = await nav.newContext({ ...devices["iPhone 13"], javaScriptEnabled: false, colorScheme: "light" });
const page = await ctx.newPage();
await page.goto("file://" + path.resolve(ESSAI));

const P1 = '.rangee .prop:nth-of-type(1)', P2 = '.rangee .prop:nth-of-type(2)';
const txt = async (s) => page.$eval(s, (e) => e.innerText.trim()).catch(() => "");
const vu = async (s) => page.$eval(s, (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).catch(() => false);
const cadrer = async (s) => { const e = await page.$(s); if (e) { await e.scrollIntoViewIfNeeded(); await page.waitForTimeout(240); } };

fs.mkdirSync(SORTIE, { recursive: true });

// ── 0. L'entête pose la règle, et sa réserve ─────────────────────────────
try {
  const cle = await txt(".cle");
  verifie("l'entête dit que la TVA est due à l'encaissement",
    /encaissement/i.test(cle), `lu : « ${cle.slice(0, 80)}… »`);
  verifie("l'entête dit que les débits sont une OPTION", /option/i.test(cle));
  verifie("l'entête renvoie la question du régime au patron", /comptable|A-FAIRE/i.test(cle));
} catch (e) { echecs.push("entête · interrompu — " + String(e.message).split("\n")[0]); }

// ── 1. LE contrôle : l'impayée n'est PAS au relevé ───────────────────────
try {
  await cadrer(P1);
  verifie("au départ, le régime « quand le client me paie » est retenu",
    await vu(`${P1} [data-s="total-enc"]`));
  verifie("la facture impayée de M. Bernard N'EST PAS au relevé",
    !(await vu(`${P1} [data-s="bernard-deb"]`)) && !(await vu(`${P1} [data-s="bernard-enc"]`)),
    "c'est toute sa demande");
  verifie("le total ne compte que ce qui a été encaissé",
    (await txt(`${P1} [data-s="total-enc"]`)).includes("160"),
    `lu : « ${await txt(`${P1} [data-s="total-enc"]`)} »`);

  // **Ce qui manque au relevé est ANNONCÉ**, sinon ça se lit comme un oubli.
  const attente = await txt(`${P1} [data-s="attente"]`);
  verifie("l'écran annonce ce qui attend son paiement, avec son montant",
    /240/.test(attente) && /attend/i.test(attente), `lu : « ${attente.replace(/\n/g, " ")} »`);
  await (await page.$(P1)).screenshot({ path: `${SORTIE}/tva-encaissements.png` });
} catch (e) { echecs.push("impayée · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Le paiement la fait entrer, et le total suit ──────────────────────
try {
  await page.click(`${P1} .bascule`);
  await page.waitForTimeout(280);
  verifie("payée, la facture rejoint le relevé", await vu(`${P1} [data-s="bernard-enc"]`));
  const total = await txt(`${P1} [data-s="total-enc-paye"]`);
  verifie("et le total passe bien à 400 € (160 + 240)", /400/.test(total), `lu : « ${total} »`);
  verifie("l'ancien total a disparu — un seul montant à l'écran",
    !(await vu(`${P1} [data-s="total-enc"]`)));
  verifie("le rappel de ce qui attend a disparu, lui aussi",
    !(await vu(`${P1} [data-s="attente"]`)));
  await (await page.$(P1)).screenshot({ path: `${SORTIE}/tva-encaissee.png` });
} catch (e) { echecs.push("paiement · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Aux débits, le paiement ne change rien — et c'est dit ─────────────
try {
  await page.click(`${P1} .regime.r-deb`);
  await page.waitForTimeout(280);

  // **On repose l'interrupteur du paiement.** Il est resté levé du contrôle
  // précédent : le rebasculer sans le savoir éprouvait l'état inverse, et
  // l'échec accusait la planche de ne rien dire — alors qu'elle le disait, une
  // touche plus loin.
  await page.click(`${P1} .bascule`);
  await page.waitForTimeout(280);

  verifie("aux débits, la facture est au relevé même impayée",
    await vu(`${P1} [data-s="bernard-deb"]`));
  const total = await txt(`${P1} [data-s="total-deb"]`);
  verifie("et le total vaut 400 € dès l'émission", /400/.test(total), `lu : « ${total} »`);
  const avance = await txt(`${P1} [data-s="avance"]`);
  verifie("impayée, l'écran dit ce qu'il AVANCE de sa poche",
    /avancez/i.test(avance) && /240/.test(avance), `lu : « ${avance.replace(/\n/g, " ")} »`);

  // Le contraste qui lui permet de choisir : payer ne change rien, ici.
  await page.click(`${P1} .bascule`);
  await page.waitForTimeout(280);
  const apres = await txt(`${P1} [data-s="releve"]`);
  verifie("l'écran dit que le paiement n'a rien changé aux débits",
    /n'a rien changé|déjà déclarée/i.test(apres), `lu : « ${apres.replace(/\n/g, " ").slice(0, 160)} »`);
  await (await page.$(P1)).screenshot({ path: `${SORTIE}/tva-debits.png` });
} catch (e) { echecs.push("débits · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. Le geste, sur la facture ──────────────────────────────────────────
try {
  await cadrer(P2);
  verifie("au départ, la saisie du paiement est repliée", !(await vu(`${P2} [data-s="saisie"]`)));
  verifie("et la facture se dit en attente", /EN ATTENTE/.test(await txt(P2)));
  verifie("l'écran rappelle qu'une facture non payée reste hors du relevé",
    /hors du relevé/i.test(await txt(`${P2} [data-s="rappel"]`)));

  await page.click(`${P2} [data-s="geste"]`);
  await page.waitForTimeout(280);
  verifie("« Noter un paiement » ouvre une date et un montant",
    await vu(`${P2} [data-s="saisie"]`));
  const saisie = await txt(`${P2} [data-s="saisie"]`);
  verifie("l'acompte est prévu, et dit comment il se compte", /acompte/i.test(saisie),
    `lu : « ${saisie.replace(/\n/g, " ")} »`);
  await (await page.$(P2)).screenshot({ path: `${SORTIE}/tva-noter-paiement.png` });
} catch (e) { echecs.push("geste · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. Le doigt, et la largeur ───────────────────────────────────────────
try {
  const petits = await page.$$eval(".regime, .bascule, .geste", (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .map((e) => ({ h: e.getBoundingClientRect().height, t: e.textContent.trim().slice(0, 24) }))
     .filter((m) => m.h < 40));
  verifie("aucune cible trop petite pour le doigt", petits.length === 0,
    petits.map((m) => `« ${m.t} » ${m.h.toFixed(0)} px`).join(" | "));

  const corps = await page.$$eval("input[type=text]", (l) =>
    l.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  verifie("les champs font 16 px — sinon iOS agrandit la page",
    corps.length > 0 && corps.every((c) => c >= 16), corps.join(" / "));

  for (const [s, nom] of [[P1, "relevé"], [P2, "facture"]]) {
    const debord = await page.$eval(`${s} .ecran`, (e) => e.scrollWidth - e.clientWidth);
    verifie(`rien ne déborde en largeur (${nom})`, debord <= 1, `${debord} px`);
  }
} catch (e) { echecs.push("forme · interrompu — " + String(e.message).split("\n")[0]); }

await nav.close();
fs.unlinkSync(ESSAI);

console.log(ok.map((n) => "  ✓ " + n).join("\n"));
if (echecs.length) {
  console.error("\n" + echecs.map((n) => "  ✗ " + n).join("\n"));
  console.error(`\n${echecs.length} contrôle(s) en échec sur ${ok.length + echecs.length}.`);
  process.exit(1);
}
console.log(`\n${ok.length} contrôles au vert. Vues dans ${SORTIE}/.`);
