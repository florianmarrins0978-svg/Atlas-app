import assert from "node:assert/strict";
import type { Page } from "playwright";
import { DELAI_MINIMAL_JOURS } from "../src/server/disponibilites";

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
    await page
      .locator(`[data-jour="${trouves[0] ?? "aucun"}"]`)
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
    .locator('[data-jour][data-etat="regardable"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-jour")!).filter(Boolean));

  const plancher = new Date();
  plancher.setDate(plancher.getDate() + DELAI_MINIMAL_JOURS + 1);
  const depuis = plancher.toISOString().slice(0, 10);
  return tous.filter((j) => j >= depuis);
}
