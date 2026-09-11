import assert from "node:assert/strict";
import type { Page } from "playwright";
import { DELAI_MINIMAL_JOURS } from "../src/lib/disponibilites";
import { jourIso } from "../src/lib/jour";

/**
 * **LE MOIS QUI EST À L'ÉCRAN, ET LUI SEUL.**
 *
 * Depuis le 11 septembre 2026, le calendrier garde TROIS mois montés pour que
 * le mois suive le doigt : le précédent et le suivant sont rendus hors du
 * cadre, inertes au doigt comme au clavier (`MoisCharge`). Une suite qui
 * cherche `[data-jour]` dans toute la page en attrape donc un sur trois **hors
 * de l'écran** : Playwright le voit — il a bien une boîte —, le clique, et
 * c'est le cadre qui reçoit le doigt.
 *
 * **Quatre suites sont tombées ainsi dans la nuit du 11 septembre 2026**, sur
 * un produit sain : « intercepts pointer events », quarante-cinq secondes, sur
 * une case d'août ou du mois d'après. Le composant avait prévu la parade — seul
 * le mois du milieu porte le repère —, les suites ne s'en servaient pas.
 *
 * **Le suffixe plutôt que l'égalité** : les deux écrans qui montrent ce
 * calendrier préfixent leur repère (`grille-mois` au planning,
 * `envoi-grille-mois` à l'envoi). Les voisins, eux, n'en portent aucun.
 */
export const MOIS_A_L_ECRAN = '[data-atlas$="grille-mois"]';

/**
 * Retenir un jour au calendrier — un seul geste depuis le 25 août 2026.
 *
 * *« Je dois pouvoir sélectionner les jours juste en les touchant, pas besoin
 * de cliquer sur proposer. »* Toucher la case OUVRE la fiche — il voit qui est
 * déjà là — et engage la date du même doigt.
 *
 * **On n'appuie plus une seconde fois pour refermer** : ce second appui
 * retirerait la date qu'on vient de poser.
 *
 * Elle vivait dans `test-envoi-client-e2e.ts` ; `test-facture-au-client-e2e.ts`
 * en avait besoin aussi et cliquait à la main, sur un bouton qu'elle désignait
 * par son rang. C'est ce rang qui l'a fait tomber le 11 septembre.
 */
export async function retenirAuCalendrier(page: Page, jour: string) {
  const case_ = page.locator(`${MOIS_A_L_ECRAN} [data-jour="${jour}"]`);
  // **UN JOUR DÉJÀ RETENU NE SE RETOUCHE PAS — il se retirerait.**
  //
  // L'écran d'envoi propose de lui-même les premiers jours libres : le jour
  // qu'une suite a choisi dans la BASE peut donc être marqué avant qu'elle y
  // touche. Le clic suivant l'enlève, et la suite attend ensuite un état
  // « retenu » qui ne reviendra jamais — quarante secondes, puis un rouge qui
  // accuse un écran ayant fait exactement ce qu'on lui demandait. Mesuré le
  // 11 septembre 2026 sur `test-reste-equipes-e2e`, la case étant « retenu »
  // avant le premier geste.
  if ((await case_.first().getAttribute("data-etat")) === "retenu") return;
  await case_.click();
  await page
    .locator("text=Vérification de votre planning…")
    .waitFor({ state: "hidden", timeout: 20_000 })
    .catch(() => undefined);
  // La case se peint quand le serveur a dit oui : l'attendre vaut mieux qu'un
  // délai, et rougir ici désigne le bon coupable — le jour a été refusé.
  await page
    .locator(`${MOIS_A_L_ECRAN} [data-jour="${jour}"][data-etat="retenu"]`)
    .waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(150);
}

/**
 * Trouver, au calendrier du patron, assez de jours qu'on puisse lui proposer —
 * **en tournant la page du mois quand celui-ci est trop entamé.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI CETTE PIÈCE EXISTE, ET CE QU'ELLE NE FAIT PAS.**
 *
 * Elle ne relâche AUCUNE règle métier. Ce qu'elle règle est en amont de toute
 * règle : **trouver de la matière à mesurer.** Le mois affiché s'ouvre au 1er ;
 * ses premiers jours sont derrière nous, le délai minimal en écarte deux de
 * plus, et les week-ends ne se proposent pas. En fin de mois il ne reste donc
 * parfois qu'un seul jour ouvrable — et la suite s'arrêtait là, sur un écran
 * parfaitement juste.
 *
 * **Mesuré plutôt que supposé, le 26 août 2026 :** rejoué sur les 365 jours de
 * 2026, le contrôle d'alors rougissait **57 jours** — toujours les derniers du
 * mois, jusqu'à six d'affilée en août. Un contrôle qui rougit un jour sur six
 * sans que rien ne soit cassé est pire qu'absent : on apprend à ignorer son
 * rouge, et le vrai passe avec (`AGENTS.md`).
 *
 * **Le geste imité est celui du patron :** quand son mois est plein, il passe
 * au suivant. Trois mois consultés suffisent largement ; au-delà, c'est la
 * navigation elle-même qui est bornée trop tôt, et le message le dit.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **UNE SEULE IMPLÉMENTATION, ET C'EST LE SUJET.**
 *
 * `test-deux-dates-calendrier-e2e.ts` portait déjà ce tour de page, sous le nom
 * `troisJoursAuMoins()` ; `test-envoi-client-e2e.ts` ne l'avait pas, et c'est
 * elle qui rougissait. Le recopier aurait fait une troisième version de la même
 * règle, qui aurait divergé (`CLAUDE.md` §3). Les deux suites appellent
 * désormais celle-ci.
 *
 * @param combien combien de jours proposables la suite a besoin de trouver
 * @returns les jours trouvés, dans le mois où ils l'ont été — la page y reste
 */
export async function joursAProposer(page: Page, combien: number): Promise<string[]> {
  const MOIS_CONSULTES = 3;
  let dernierCompte = 0;

  for (let mois = 0; mois < MOIS_CONSULTES; mois++) {
    const trouves = await joursDuMoisAffiche(page);
    if (trouves.length >= combien) return trouves;
    dernierCompte = trouves.length;

    const suivant = page.getByRole("button", { name: /^Mois suivant/ });
    assert.ok(
      await suivant.isEnabled(),
      `Le calendrier n'offre que ${dernierCompte} jour(s) proposable(s) et ne va pas plus loin. ` +
        `Ce n'est plus une affaire de calendrier : la navigation est bornée trop tôt.`
    );
    await suivant.click();
    // Le mois se repeint côté client : on attend que la grille ait changé,
    // plutôt qu'un délai fixe qui échouerait au hasard sous la batterie.
    // **Détaché DE L'ÉCRAN, pas de la page** : le mois qu'on quitte reste monté
    // en voisin depuis le glissement du 11 septembre 2026, donc l'attendre
    // ailleurs qu'ici ne finissait jamais — dix secondes brûlées à chaque tour.
    await page
      .locator(`${MOIS_A_L_ECRAN} [data-jour="${trouves[0] ?? "aucun"}"]`)
      .waitFor({ state: "detached", timeout: 10_000 })
      .catch(() => undefined);
  }

  assert.fail(
    `${MOIS_CONSULTES} mois consultés sans trouver ${combien} jour(s) à proposer ` +
      `(dernier mois : ${dernierCompte}).`
  );
}

/**
 * Les journées du mois AFFICHÉ qu'on peut aller regarder, et qui sont assez
 * loin pour que le serveur les accepte.
 *
 * **`regardable`, et non « choisissable ».** Depuis le 22 août 2026 aucune case
 * n'est éteinte — sa demande, planche 91 : *« un jour complet reste touchable,
 * c'est justement celui sur lequel vous voulez regarder avant de décider »*. Ce
 * qui reste, c'est ce que la case EST ; le serveur tranche ensuite.
 *
 * **Le plancher vient de `DELAI_MINIMAL_JOURS`, jamais d'un 3 écrit à la main.**
 * Les deux suites en portaient un chacune ; le jour où le délai changera, un
 * chiffre en dur ferait rougir sur un refus parfaitement juste — le pire des
 * rouges.
 */
async function joursDuMoisAffiche(page: Page): Promise<string[]> {
  const tous = await page
    .locator(`${MOIS_A_L_ECRAN} [data-jour][data-etat="regardable"]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-jour")!).filter(Boolean));

  const plancher = new Date();
  plancher.setDate(plancher.getDate() + DELAI_MINIMAL_JOURS + 1);
  /**
   * **`jourIso`, jamais `toISOString`** — corrigé le 27 août 2026, en reprenant
   * la mesure d'une session voisine (`ARCHITECTURE.md` §182). Entre minuit et
   * 2 h du matin en France, Greenwich est encore la veille : le plancher tombait
   * d'un jour, la suite retenait un jour que le serveur refuse, et le rouge
   * accusait un produit sain — un rouge qui n'apparaît que la nuit.
   *
   * Ce module portait le défaut ; la version que `main` a écrite en place
   * portait la correction. Les deux sont ici : une seule implémentation, et
   * elle est juste.
   */
  const depuis = jourIso(plancher);
  return tous.filter((j) => j >= depuis);
}
