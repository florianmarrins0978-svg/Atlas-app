/*
  Contrôle de « la banque dit qui a payé » — JavaScript coupé, iPhone 13, meta
  viewport injectée.

  Sa question, le 14 août 2026 : *« comment tu vas savoir quand est-ce que j'ai
  été payé ? »*, puis son choix parmi les trois réponses : *« j'aimerais bien
  qu'on essaie de partir sur la trois »* — la banque.

  CE QUE CES CONTRÔLES TIENNENT, et qui n'est pas l'allure :

    · **RIEN NE SE RAPPROCHE TOUT SEUL.** Un virement collé à la mauvaise
      facture met la TVA dans le mauvais trimestre, et cela se répare devant
      l'administration, pas dans l'application. La planche doit montrer une
      PROPOSITION et un geste, jamais un fait accompli ;
    · **le cas où Atlas ne sait pas est MONTRÉ**, et c'est lui qui décide si
      l'idée tient : 500 € qui ne correspondent à aucune facture entière. Une
      planche qui ne montrerait que le cas facile mentirait sur ce que vaut le
      raccordement ;
    · **les 90 jours sont dits d'avance.** L'accès bancaire se renouvelle tous
      les trois mois (règle européenne). Le taire, c'est promettre un
      automatisme qui s'arrête tout seul, et une TVA sous-déclarée derrière ;
    · **ce qu'Atlas NE FERA PAS est écrit** : aucun paiement, aucun ordre. C'est
      ce qui rend le raccordement acceptable, et ça ne se devine pas.

  CHACUN SAIT ÉCHOUER : retirer les boutons « C'est ça » rougit le premier ;
  retirer le virement de M. Leroy rougit le second ; retirer l'encart des
  90 jours rougit le troisième.

  RÉSERVE : ceci éprouve un DESSIN. Le prestataire agréé, son contrat et son
  coût restent à décider (`docs/A-FAIRE.md` §12), et rien n'est posé dans `src/`
  (`CLAUDE.md` §3 bis).
*/
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const FICHIER = process.argv[2] || "maquettes/atlas-banque-rapprochement.html";
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

// ── 0. L'entête pose les deux faits qui commandent le reste ──────────────
try {
  const cle = await txt(".cle");
  verifie("l'entête dit qu'un relevé ne porte pas de numéro de facture",
    /numéro de facture/i.test(cle), `lu : « ${cle.slice(0, 90)}… »`);
  verifie("l'entête dit qu'Atlas PROPOSE et que le patron confirme",
    /propose/i.test(cle) && /confirmez|doigt/i.test(cle));
  verifie("l'entête annonce les 90 jours", /90 jours/.test(cle));
} catch (e) { echecs.push("entête · interrompu — " + String(e.message).split("\n")[0]); }

// ── 1. LE contrôle : rien ne se rapproche tout seul ──────────────────────
try {
  await cadrer(P1);
  verifie("le virement de M. Bernard est PROPOSÉ, pas rapproché",
    (await vu(`${P1} [data-s="propose-1"]`)) && !(await vu(`${P1} [data-s="marque-1"]`)),
    "un fait accompli ne se relit pas");
  const propose = await txt(`${P1} [data-s="propose-1"]`);
  verifie("la proposition nomme la facture qu'elle vise", /F-2026-042/.test(propose),
    `lu : « ${propose.replace(/\n/g, " ")} »`);
  verifie("elle dit POURQUOI elle propose celle-là",
    /montant tombe juste|nom correspond/i.test(propose));
  verifie("le refus est offert à côté de l'accord",
    (await txt(`${P1} [data-s="propose-1"]`)).toLowerCase().includes("non"));

  const jamais = await txt(`${P1} [data-s="jamais"]`);
  verifie("l'écran écrit qu'Atlas ne rapproche jamais tout seul",
    /jamais tout seul/i.test(jamais), `lu : « ${jamais.replace(/\n/g, " ")} »`);
  await (await page.$(P1)).screenshot({ path: `${SORTIE}/banque-a-confirmer.png` });
} catch (e) { echecs.push("proposition · interrompu — " + String(e.message).split("\n")[0]); }

// ── 2. Le cas qu'Atlas NE SAIT PAS trancher — celui qui décide de tout ───
try {
  const doute = await txt(`${P1} [data-s="doute"]`);
  verifie("un virement qui ne correspond à rien est montré", doute !== "",
    "une planche qui ne montre que le cas facile ment sur ce que vaut le raccordement");
  verifie("Atlas dit qu'il NE SAIT PAS, au lieu de deviner",
    /ne sait pas/i.test(doute), `lu : « ${doute.replace(/\n/g, " ")} »`);
  verifie("l'acompte est nommé comme explication possible", /acompte/i.test(doute));
  verifie("et rien n'entre au relevé sans son geste",
    /sans votre geste|à vous de dire/i.test(doute));
} catch (e) { echecs.push("doute · interrompu — " + String(e.message).split("\n")[0]); }

// ── 3. Confirmé, l'effet est DIT — et chiffré ────────────────────────────
try {
  await page.click(`${P1} [data-s="oui-1"]`);
  await page.waitForTimeout(280);
  verifie("confirmé, le virement se marque « rapproché »", await vu(`${P1} [data-s="marque-1"]`));
  verifie("et la proposition disparaît — rien à redécider",
    !(await vu(`${P1} [data-s="propose-1"]`)));
  const fait = await txt(`${P1} [data-s="fait-1"]`);
  verifie("l'écran dit ce qui vient d'entrer au relevé, en euros",
    /240,00 €/.test(fait) && /trimestre/i.test(fait), `lu : « ${fait.replace(/\n/g, " ")} »`);
  await (await page.$(P1)).screenshot({ path: `${SORTIE}/banque-rapproche.png` });
} catch (e) { echecs.push("confirmation · interrompu — " + String(e.message).split("\n")[0]); }

// ── 4. Le raccordement : ce qu'il lit, ce qu'il ne fera pas, et les 90 jours
try {
  await cadrer(P2);
  const lit = await txt(`${P2} [data-s="lit"]`);
  verifie("l'écran dit qu'Atlas lit les virements REÇUS", /virements reçus/i.test(lit));
  verifie("il écrit noir sur blanc qu'aucun paiement ne partira",
    /aucun paiement|aucun ordre/i.test(lit), `lu : « ${lit.replace(/\n/g, " ")} »`);
  verifie("il dit que les identifiants restent chez la banque",
    /identifiants/i.test(lit) && /banque/i.test(lit));

  const quatreVingtDix = await txt(`${P2} [data-s="quatre-vingt-dix"]`);
  verifie("les 90 jours sont annoncés AVANT le raccordement", /90 jours/.test(quatreVingtDix));
  verifie("et l'écran dit ce qui se passe quand l'accès dort",
    /à la main/i.test(quatreVingtDix), `lu : « ${quatreVingtDix.replace(/\n/g, " ")} »`);
  verifie("le prestataire agréé est annoncé, et non caché",
    /prestataire agréé/i.test(await txt(`${P2} [data-s="tiers"]`)));
  await (await page.$(P2)).screenshot({ path: `${SORTIE}/banque-relier.png` });
} catch (e) { echecs.push("raccordement · interrompu — " + String(e.message).split("\n")[0]); }

// ── 5. Le doigt, et la largeur ───────────────────────────────────────────
try {
  const petits = await page.$$eval(".oui, .non, .banque", (l) =>
    l.filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
     .map((e) => ({ h: e.getBoundingClientRect().height, t: e.textContent.trim().slice(0, 24) }))
     .filter((m) => m.h < 40));
  verifie("aucune cible trop petite pour le doigt", petits.length === 0,
    petits.map((m) => `« ${m.t} » ${m.h.toFixed(0)} px`).join(" | "));

  for (const [s, nom] of [[P1, "virements"], [P2, "raccordement"]]) {
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
