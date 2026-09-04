import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { CHARTES } from "../src/lib/chartes";

// CE QUE LA FEUILLE « ENVOYER À … » DOIT TENIR, ET QU'AUCUN TEST NE VOYAIT.
//
// **Trois défauts trouvés le 4 septembre 2026 en la photographiant dans ses onze
// états** — aucun n'était visible autrement, et les trois sont réparés :
//
// 1. **On ne voyait pas quel canal était choisi.** Les capsules « Par SMS » /
//    « Par e-mail » étaient redessinées ici au lieu d'employer `ChoixCanal`, et
//    leur seule marque d'actif était la COULEUR DU TEXTE — `rust` contre `ink`.
//    Or sur Nuit et Sylve ces deux jetons valent le même `#e9e8de`, et les deux
//    fonds tiennent 1,05 de contraste : les capsules étaient indiscernables, et
//    le patron ne pouvait pas savoir par où son devis partait.
// 2. **Le devis vide était un cul-de-sac** : la phrase disait d'aller poser ses
//    prix, aucune porte n'y menait.
// 3. **« Envoyer le devis » n'était jamais à l'écran** : 882 px de feuille pour
//    584 px d'écran.
//
// **Ce que cette suite vise, et pourquoi ce n'est pas un libellé.** Un contrôle
// accroché aux mots « Par SMS » défendrait une tournure ; celui-ci mesure LA
// RÈGLE — que la marque d'actif ne dépende d'aucune clarté, que la porte mène
// bien à l'écran des prix, et que le pied touche le bas de la feuille
// (`CLAUDE.md` §5 bis).
//
// **Et il refuse de conclure sur une mesure impossible.** Une feuille plus
// courte que l'écran ne prouve rien du pied collé : elle n'a rien à faire
// tenir. Un zéro n'est pas un succès (`CLAUDE.md` §5).

const BASE = "http://localhost:3000";

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== La feuille d'envoi se lit, sur les huit chartes ===\n");

  // ─── Ce qui se mesure SANS navigateur : les deux jetons du défaut ────────
  //
  // Le contrôle du navigateur, plus bas, vérifie que la marque d'actif ne tient
  // pas à la couleur du texte. Celui-ci dit POURQUOI c'était nécessaire, et il
  // le redira si une charte future ramène le même piège ailleurs.
  await cas(
    "l'accent et l'encre se confondent sur au moins une charte — la marque d'actif ne peut donc pas être une couleur de texte",
    async () => {
      const confondues = CHARTES.filter((c) => c.jetons.rust === c.jetons.ink).map((c) => c.nom);
      if (confondues.length === 0) {
        throw new Error(
          "plus aucune charte ne confond l'accent et l'encre : le commentaire de cette suite " +
            "décrit un piège qui n'existe plus, et il doit être corrigé plutôt que laissé à mentir"
        );
      }
      console.log(`    (chartes concernées : ${confondues.join(", ")})`);
    }
  );

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // ─── 1. Le devis vide, et sa porte ──────────────────────────────────────
  await cas("un devis vide offre la porte des prix, au lieu d'un bouton éteint et muet", async () => {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', `Feuille vide ${Date.now()}`);
    await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
    await creerPuisFiche(page);
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const id = page.url().split("/").pop()!.split("?")[0];

    await page.goto(`${BASE}/chantiers/${id}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector("text=recevrait un document vide", { timeout: 30_000 });

    const porte = page.locator('[data-atlas="aller-aux-prix"]');
    if (!(await porte.count())) {
      throw new Error(
        "aucune porte : le refus dit d'aller poser ses prix, et il faut refermer la feuille, " +
          "sortir du devis et retrouver l'écran des prix pour le faire"
      );
    }
    const vers = await porte.first().getAttribute("href");
    if (vers !== `/chantiers/${id}/prix`) {
      throw new Error(
        `la porte ne mène pas aux prix de CE chantier : « ${vers ?? "sans adresse"} ». ` +
          "Une porte qui ouvre ailleurs est pire qu'une porte fermée."
      );
    }
    // Elle s'ouvre pour de bon : un lien juste qui ne mène nulle part est le
    // défaut du 11 août, dans l'autre sens.
    await porte.first().click();
    await page.waitForURL(new RegExp(`/chantiers/${id}/prix`), { timeout: 30_000 });
  });

  // ─── Un chantier chiffré, pour tout le reste ────────────────────────────
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Feuille lisible ${Date.now()}`);
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!.split("?")[0];

  await page.goto(`${BASE}/chantiers/${chantierId}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(400);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Taille de haie");
  await champs.nth(1).fill("900.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(800);

  // ─── 2. Le canal choisi se VOIT, sans dépendre d'une clarté ─────────────
  //
  // Ce chantier-ci n'a aucune coordonnée : c'est le bloc de réparation qui
  // s'ouvre, avec les deux capsules.
  await cas("la capsule active porte une marque que la couleur du texte ne fait pas", async () => {
    await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
    await page.click("text=Choisir la date");
    await page.waitForSelector('[data-atlas="canal-sms"]', { timeout: 30_000 });

    const lu = async (repere: string) =>
      page.locator(`[data-atlas="${repere}"]`).first().evaluate((e) => {
        const s = getComputedStyle(e);
        return { ombre: s.boxShadow, texte: s.color, fond: s.backgroundColor };
      });
    const actif = await lu("canal-sms");
    const inerte = await lu("canal-email");

    if (actif.ombre === inerte.ombre) {
      throw new Error(
        "les deux capsules portent le même liseré : la seule différence retomberait sur la " +
          `couleur du texte (« ${actif.texte} » contre « ${inerte.texte} »), qui est la MÊME ` +
          "sur Nuit et Sylve — le patron ne saurait plus par où part son devis"
      );
    }
    if (actif.ombre === "none") {
      throw new Error("la capsule active ne porte aucun liseré : c'est elle qu'on doit reconnaître");
    }
  });

  // ─── 3. Le pied touche le bas, et le bouton est là en arrivant ──────────
  await cas("le pied de la feuille reste au bas de l'écran, sur une feuille plus haute que lui", async () => {
    // Une coordonnée, pour que la feuille montre le calendrier — c'est lui qui
    // la rend plus haute que l'écran.
    await page.fill('[data-atlas="coordonnee-client"]', "0611223344");
    await page.getByRole("button", { name: /Enregistrer et continuer/i }).click();
    await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 30_000 });
    await page.waitForTimeout(800);

    const m = await page.evaluate(() => {
      const zone = document.querySelector("div.overflow-y-auto") as HTMLElement | null;
      const pied = document.querySelector('[data-atlas="pied-envoi"]') as HTMLElement | null;
      if (!zone || !pied) return null;
      const z = zone.getBoundingClientRect();
      const p = pied.getBoundingClientRect();
      return { zoneBas: z.bottom, zoneH: z.height, contenu: zone.scrollHeight, piedBas: p.bottom };
    });
    if (!m) throw new Error("la feuille ou son pied sont introuvables");

    // **Refuser de conclure sur une mesure impossible.** Une feuille qui tient
    // dans l'écran ne prouve rien d'un pied collé.
    if (m.contenu <= m.zoneH + 8) {
      throw new Error(
        `la feuille (${Math.round(m.contenu)} px) ne dépasse pas l'écran (${Math.round(m.zoneH)} px) : ` +
          "cette mesure ne prouve rien, et un vert ici serait un faux vert"
      );
    }
    const ecart = Math.abs(m.piedBas - m.zoneBas);
    if (ecart > 2) {
      throw new Error(
        `le pied s'arrête à ${Math.round(ecart)} px du bas de la feuille : le contenu se voit ` +
          "passer dessous, et « Envoyer le devis » n'est plus au ras du pouce"
      );
    }

    const bouton = page.getByRole("button", { name: "Envoyer le devis" });
    if (!(await bouton.isVisible())) {
      throw new Error("« Envoyer le devis » n'est pas à l'écran en arrivant sur la feuille");
    }
  });

  await navigateur.close();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Feuille d'envoi lisible — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
