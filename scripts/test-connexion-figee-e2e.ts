// « AUCUN SCROLL POSSIBLE » — l'écran de connexion, figé.
//
// **Sa demande du 31 août 2026, capture à l'appui :** *« la page connexion n'est
// pas fixe, elle peut bouger encore ; il ne faut pas qu'elle puisse bouger,
// aucun scroll possible »*.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE LE CONTRÔLE D'AVANT NE POUVAIT PAS VOIR.**
//
// `test-face-id-e2e.ts` mesurait déjà « la page tient dans 664 px », et il était
// VERT : 658 ≤ 664. Sur le banc du patron, au même moment, l'écran demandait
// **706 px** et « Me déconnecter partout » finissait à moitié sous la barre du
// bas.
//
// L'écart tenait à ce que la mesure ne reproduisait pas SES conditions : le
// bandeau « Version rapide en construction » n'existe que sur son banc, et
// `layout.tsx` lui retranchait **40 px** alors qu'il en mesure **49** — et
// **66** sur un écran étroit, où sa phrase passe à deux lignes.
//
// Cette suite-ci vise donc deux choses que l'autre ne visait pas : que la PAGE
// ne puisse pas défiler du tout, et que la hauteur du bandeau soit LUE plutôt
// qu'écrite à la main.
// ═══════════════════════════════════════════════════════════════════════════

import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";

const BASE = "http://localhost:3000";

let reussis = 0;
let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    reussis++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== La connexion ne bouge pas ===\n");

  const navigateur = await lancerNavigateur();
  // **390 × 664, et c'est son cas dur** : son iPhone quand Safari montre ses
  // deux barres. Mesurer sur un grand écran serait un vert qui ne prouve rien.
  const contexte = await navigateur.newContext({
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: 2,
  });
  const page = await contexte.newPage();

  // **Une puce Face ID simulée, sinon on mesure un écran amputé.** Sans
  // appareil capable, la rubrique ne se dessine pas et il manque une centaine
  // de pixels — c'est-à-dire tout le problème.
  const cdp = await contexte.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/reglages/connexion`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Ouvrir avec Face ID", { timeout: 30_000 });
  await page.waitForTimeout(700);

  await essai("la PAGE ne peut pas défiler — c'est sa demande, mot pour mot", async () => {
    const m = await page.evaluate(() => ({
      haut: document.documentElement.scrollHeight,
      fenetre: window.innerHeight,
      corps: document.body.scrollHeight,
    }));
    // **Refuser de conclure sur une page non mise en page** : sans ce
    // garde-fou, « 0 ≤ 664 » rendrait un vert qui ne mesure rien
    // (`CLAUDE.md` §5).
    assert.ok(m.haut > 300, `la page mesure ${m.haut} px : rien n'est mis en page`);
    assert.ok(
      m.haut <= m.fenetre,
      `la page demande ${m.haut} px pour ${m.fenetre} : elle défile encore`
    );
  });

  await essai("et un geste de doigt ne la déplace pas d'un pixel", async () => {
    // **Le geste, pas la propriété CSS.** Une hauteur qui tient n'empêche pas
    // de faire glisser : on pousse pour de bon, et l'on regarde où l'on est.
    await page.mouse.move(195, 400);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(250);
    const y = await page.evaluate(() => window.scrollY);
    assert.equal(Math.round(y), 0, `la page s'est déplacée de ${Math.round(y)} px`);
  });

  await essai("« Me déconnecter partout » n'est pas recouvert par la barre du bas", async () => {
    const m = await page.evaluate(() => {
      const barre = document.querySelector('nav[aria-label="Navigation principale"]');
      const dernier = [...document.querySelectorAll("button")].find((b) =>
        /Me déconnecter partout/.test(b.textContent ?? "")
      );
      const b = dernier?.getBoundingClientRect();
      return {
        bas: b ? b.y + b.height : null,
        hautBarre: barre ? barre.getBoundingClientRect().y : null,
      };
    });
    assert.ok(m.bas !== null && m.hautBarre !== null, "le dernier geste ou la barre est introuvable");
    assert.ok(m.bas! > 0 && m.hautBarre! > 0, "des boîtes de zéro pixel : rien n'est mesuré");
    assert.ok(
      m.bas! <= m.hautBarre!,
      `il finit à ${Math.round(m.bas!)} px, la barre commence à ${Math.round(m.hautBarre!)} px`
    );
  });

  await essai("l'écran refuse l'élastique du navigateur", async () => {
    // Cette propriété ne se VOIT pas ici — aucun navigateur de ce poste ne
    // rebondit. Ce qui se vérifie, c'est qu'elle est bien posée : c'est elle
    // qui, sur son iPhone, empêche la page de tressauter sous le doigt.
    const dit = await page.evaluate(() => {
      const e = document.querySelector(".atlas-ecran");
      return e ? getComputedStyle(e).overscrollBehaviorY : null;
    });
    assert.equal(dit, "none", `l'écran figé annonce « ${dit} »`);
  });

  await essai("LA HAUTEUR DU BANDEAU DU BANC EST LUE, PAS ÉCRITE À LA MAIN", async () => {
    /**
     * **Le cœur du défaut du 31 août.** `layout.tsx` retranchait 40 px pour un
     * bandeau qui en mesure 49 — 66 sur un écran étroit, où sa phrase passe à
     * deux lignes. Neuf pixels de trop suffisaient à repousser le dernier geste
     * sous la barre.
     *
     * Le bandeau n'existe que sur le banc, et cette batterie ne tourne pas en
     * profil banc : on ne peut donc pas le mesurer ici. **Ce qui se vérifie,
     * c'est le CHEMIN** — que `--atlas-bandeau` soit réellement consommée par
     * l'écran figé. C'était précisément ce qui manquait : la valeur existait
     * (40, en dur) et rien ne la reliait à la taille réelle.
     *
     * Vu rouge contre la version d'avant, où la variable n'existait pas : la
     * hauteur ne bougeait pas d'un pixel.
     */
    const mesure = await page.evaluate(() => {
      const e = document.querySelector(".atlas-ecran") as HTMLElement | null;
      if (!e) return null;
      const avant = e.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--atlas-bandeau", "100px");
      const apres = e.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--atlas-bandeau", "0px");
      const remis = e.getBoundingClientRect().height;
      return { avant, apres, remis };
    });
    assert.ok(mesure, "aucun écran figé sur cette page");
    assert.ok(mesure!.avant > 300, `l'écran mesure ${Math.round(mesure!.avant)} px : rien n'est mis en page`);
    assert.equal(
      Math.round(mesure!.avant - mesure!.apres),
      100,
      `cent pixels de bandeau devraient retirer cent pixels d'écran ; ` +
        `lu ${Math.round(mesure!.avant)} → ${Math.round(mesure!.apres)}`
    );
    assert.equal(
      Math.round(mesure!.remis),
      Math.round(mesure!.avant),
      "l'écran ne retrouve pas sa hauteur quand le bandeau s'efface"
    );
  });

  await essai("AVEC LE BANDEAU DU BANC — la page ne défile toujours pas, et rien n'est perdu", async () => {
    /**
     * **SANS CE CAS, LES TROIS PREMIERS CONTRÔLES NE PROUVENT RIEN.**
     *
     * Confrontés à l'écran d'avant ce lot, ils sont restés VERTS : sans le
     * bandeau, la page tient dans 664 px de justesse (658 pour 664), et le
     * défaut ne se montre pas. C'est exactement l'erreur qu'ils existent pour
     * attraper — un contrôle qui ne reproduit pas les conditions du patron.
     *
     * Le bandeau n'existe que sur le banc, et cette batterie n'y tourne pas :
     * on le REJOUE à l'identique — un bloc de 49 px en tête du corps, sa
     * hauteur mesurée à 390 px de large, et la variable que le vrai bandeau
     * publie.
     *
     * ─── CE QUE CE CONTRÔLE N'EXIGE PAS, ET IL FAUT LE DIRE ────────────────
     *
     * Que tout SOIT VISIBLE d'un coup. Avec le bandeau, l'écran dispose de
     * 664 − 49 − 68 = **547 px** pour 596 de contenu : il en manque 51, et
     * aucune ligne ne peut disparaître sans qu'il l'ait choisi
     * (`CLAUDE.md` §3 bis). La colonne glisse alors de ces 51 px — et c'est le
     * moins mauvais des deux : un bouton qu'on ne peut plus atteindre est pire
     * qu'un écran qui bouge d'un pouce.
     *
     * Ce qui est exigé, c'est ce qu'il a demandé : **la page, elle, ne bouge
     * pas** — et le dernier geste reste ATTEIGNABLE, jamais coupé.
     */
    await page.evaluate(() => {
      const faux = document.createElement("div");
      faux.id = "faux-bandeau";
      faux.style.height = "49px";
      document.body.insertBefore(faux, document.body.firstChild);
      document.documentElement.style.setProperty("--atlas-bandeau", "49px");
    });
    await page.waitForTimeout(300);
    // **On DESCEND la colonne, puis on regarde.** « Atteignable » se prouve en
    // faisant le geste, pas en comparant deux nombres dont l'origine diffère —
    // première version : elle mesurait `offsetTop`, qui compte depuis un autre
    // ancêtre, et accusait l'écran d'avoir coupé un bouton parfaitement là.
    const m = await page.evaluate(() => {
      const col = document.querySelector(".atlas-colonne-defile") as HTMLElement | null;
      if (col) col.scrollTop = col.scrollHeight;
      const barre = document.querySelector('nav[aria-label="Navigation principale"]');
      const dernier = [...document.querySelectorAll("button")].find((b) =>
        /Me déconnecter partout/.test(b.textContent ?? "")
      );
      const b = dernier?.getBoundingClientRect();
      return {
        haut: document.documentElement.scrollHeight,
        fenetre: window.innerHeight,
        colVisible: col ? col.clientHeight : null,
        colContenu: col ? col.scrollHeight : null,
        basApresDescente: b ? Math.round(b.y + b.height) : null,
        hautBarre: barre ? Math.round(barre.getBoundingClientRect().y) : null,
      };
    });
    await page.evaluate(() => {
      document.getElementById("faux-bandeau")?.remove();
      document.documentElement.style.setProperty("--atlas-bandeau", "0px");
    });
    assert.ok(m.haut > 300, `la page mesure ${m.haut} px : rien n'est mis en page`);
    assert.ok(
      m.haut <= m.fenetre,
      `bandeau posé, la page demande ${m.haut} px pour ${m.fenetre} : elle défile encore`
    );
    assert.ok(m.colContenu !== null && m.colVisible !== null, "aucune colonne : rien n'est mesuré");
    assert.ok(
      m.basApresDescente !== null && m.hautBarre !== null && m.basApresDescente! > 0,
      "le dernier geste ou la barre est introuvable : rien n'est mesuré"
    );
    assert.ok(
      m.basApresDescente! <= m.hautBarre!,
      `colonne descendue, « Me déconnecter partout » finit encore à ${m.basApresDescente} px ` +
        `alors que la barre commence à ${m.hautBarre} : il reste hors d'atteinte`
    );
  });

  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Connexion figée — ${reussis} réussi(s), ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
