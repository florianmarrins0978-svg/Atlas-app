# Campagne QA : fusion de main et reprise (11 octobre 2026)

## État du dépôt

- Worktree : `Atlas-qa`, branche `qa/campagne`
- Commit de fusion : `5907899a`, qui réunit la sauvegarde de la campagne (`656e1193`) et `main` (`cb05b052`)
- Ni reset, ni rebase, rien de jeté. **Rien n'est poussé.**
- Arbre de travail propre après la fusion

## Les 3 conflits et leur résolution

| Fichier | Résolution |
|---|---|
| `.impeccable/config.local.json` | Les deux clés réunies : `buildPath: "code"` (main) et `hook.consent: "declined"` (campagne) |
| `scripts/run-e2e-tests.ts` | Le lancement de main est conservé : `next start` sur la version bâtie, `arreterArbre`, profil `banc`. Les options de la campagne s'y greffent : `ATLAS_E2E_EXTERNAL_SERVER=1` (aucun serveur démarré) et `--only-start-server` (démarre, montre le journal, arrête, vérifie que le port est libéré). Remplacés au passage : `as any` et `process.kill(-pid)` par `arreterArbre(serveur?.pid)`, qui tue l'arbre sous Windows ; le port 3000 écrit en dur par `sante()` / `atelier.port`. Le préchauffage `prechaufferLesEcrans`, supprimé sur main, reste supprimé (la campagne n'y avait changé qu'une indentation) |
| `scripts/test-poser-une-date-e2e.ts` | Version de la campagne gardée aux deux endroits : une date `Date` est formatée en heure locale, sinon `String(jour)`. Elle couvre aussi le cas de main, où la date arrive déjà en texte |

## Ce qui a été vérifié

| Contrôle | Résultat |
|---|---|
| Marqueurs de conflit restants | aucun |
| `tsc --noEmit` | aucune erreur dans les fichiers fusionnés. Avant `npm install`, 2 erreurs ailleurs, dues à des paquets absents (`qrcode-generator`, `pdfjs-dist`) |
| `eslint` sur les 2 scripts | propre |
| `npm install` | code 0 |
| `npm run qa:up` | conteneurs `atlas-qa-postgres` et `atlas-qa-redis` démarrés |
| `npm run qa:setup` | 58 migrations appliquées (84 déjà à jour, jusqu'à `0128_numero_rm`), jeu de démonstration semé |
| `npm run qa:preuve` | `═══ QA : 15/15 — VERT. L'établi est isolé. ═══` |

**Pas vérifié** : aucune suite navigateur n'a été jouée sur le code fusionné.

## Limite connue, laissée telle quelle

Dans `run-e2e-tests.ts`, le contrôle « quelque chose écoute déjà sur le port » s'exécute **avant** l'option `ATLAS_E2E_EXTERNAL_SERVER`. Avec un serveur déjà allumé, le lanceur refuse donc de tourner, et l'option ne sert à rien en pratique. C'était déjà le cas dans `656e1193` ; la fusion n'y a pas touché. Pour corriger : ne faire ce contrôle que si l'option n'est pas posée.

## Où la campagne s'était arrêtée (31 août 2026)

Source : `QA_EXECUTION_LOG.md` et `QA_FINDINGS.md`.

La batterie navigateur complète a tourné. Presque tout est passé, sauf deux suites :

1. **`test-pages-publiques-sans-navigation-e2e.ts`** : plantage natif de Node sous Windows (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, code 3221226505). Gravité non classée. Pas encore reproduit seul.
2. **`test-tva-au-paiement-e2e.ts`** (P2) : `page.waitForFunction` dépasse son délai en marquant la facture payée. L'enquête s'est arrêtée sur une incohérence :
   - la trace Playwright montre des POST vers `/chantiers/<uuid>/prix` et `/devis-complet` ;
   - le journal serveur (`%TEMP%\atlas-serveur-e2e.log`) ne fait que 590 octets, sans aucune ligne de requête ;
   - la base `atlas_qa` ne contient aucun des 7 UUID.

   Hypothèse retenue : la trace et le journal ne viennent pas du même lancement.

## Ce que main change pour cette enquête (hypothèse, non vérifiée)

- Le serveur des suites est désormais `next start` sur la version bâtie, et non plus `next dev` (Turbopack). Le plantage n° 1 venait peut-être du mode développement.
- Main a corrigé un défaut du lanceur : passer par `npm` imposait un shell sous Windows, et ce shell **avalait le journal du serveur**. Le journal de 590 octets du n° 2 vient très probablement de là, et non d'un décalage entre deux lancements.

Conséquence : les deux constats sont peut-être périmés. **On relance avant de reprendre l'enquête.**

## Prochaines étapes

1. `npx tsx --env-file=.env scripts/run-e2e-tests.ts --seulement test-tva-au-paiement-e2e.ts`, avec trace Playwright. Recouper ensuite trace, journal serveur et base.
2. Même chose pour `test-pages-publiques-sans-navigation-e2e.ts`.
3. Relancer la batterie complète, sans la tronquer par `tail` : rediriger vers un fichier.
4. Mettre à jour `QA_EXECUTION_LOG.md` et `QA_FINDINGS.md` : classer chaque constat comme résolu par main ou toujours présent.
5. Pousser ou fusionner : uniquement avec l'accord du patron.
