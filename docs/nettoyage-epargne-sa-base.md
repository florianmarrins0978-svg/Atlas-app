# Les tests n'effacent plus ta base

*25 octobre 2026.*

## Le défaut

Avant chaque essai, les tests vident la base. Ils vidaient celle que la machine désignait. Sur ton espace, c'est `atlas_dev`, là où vivent tes chantiers et tes clients.

La batterie complète posait déjà la base d'essai, elle était donc sûre. Un `npm test` ou `npm run test:e2e` tapé à la main, par toi ou par une session, effaçait tout.

## Ce qui est fait

| Point | Verdict | Fichier |
|---|---|---|
| Les tests de base refusent une base qui n'est pas d'essai | **fait** | `scripts/_test-db.ts` |
| Les tests navigateur refusent avant d'amorcer | **fait** | `scripts/run-e2e-tests.ts` |
| Une seule règle pour les deux | **fait** | `src/lib/garde-seed.ts`, `garderNettoyage` |
| `atlas_dev` n'est plus comptée comme base d'essai | **fait** | `src/lib/garde-seed.ts`, `estBaseDEssai` |

## La preuve

`scripts/test-nettoyage-epargne-sa-base.ts` crée une vraie base `atlas_dev`, y met une ligne, puis lance le nettoyage avec ton environnement.

| | Avant la correction | Après |
|---|---|---|
| La ligne dans `atlas_dev` | **effacée** | intacte |
| Le nettoyage sur la base d'essai | fonctionne | fonctionne |

## La suite le même jour : `db:seed`

`npm run db:seed` tapé à la main effaçait aussi ta base : il ne regardait que son nom. Il demande maintenant lui-même si elle contient du travail, et refuse si oui, ou s'il ne peut pas le savoir.

| | Avant | Après |
|---|---|---|
| `db:seed` sur ta base avec ton entreprise | **remplacée par « Atelier Démo »** | intacte, refus |
| Premier allumage d'un espace neuf | amorcé | amorcé |

Preuve : `scripts/test-base-habitee.ts`, sur une vraie base `atlas_dev`.

## Ce que tu dois faire

Rien.
