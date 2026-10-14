# Campagne QA du 13 octobre 2026 : ce qui a été corrigé

Ce document répond aux rapports de l'établi QA (`qa/campagne`, 12 et 13
octobre 2026). Tout ce qui suit est sur `main`. Chaque point indique le fichier
qui le fonde.

**Batterie complète au vert** : 462/462 suites base, 183/183 suites navigateur,
connexion réelle derrière une origine étrangère.

---

## 1. Verdicts

| Constat de l'établi | Verdict | Ce qui a été fait | Commit |
|---|---|---|---|
| `npm audit` : trois failles critiques dans Next | vrai | Next 16.3.8 et sharp 0.35.5 (`package.json`) | `08a1d0bb` |
| « Modifier » rouvre une fiche de sécurité transmise | vrai | `peutRouvrirUneFicheTransmise` (`src/lib/acces-roles.ts`) : tout rôle sauf salarié | `49564a24` |
| la facturation change la durée d'un chantier | vrai, à moitié | sa décision « A » : permis tant que le chantier n'est pas au planning (`dureeEtEquipeModifiables`) | `49564a24` |
| ZAP bloqué | non conclu | rien à corriger dans le produit | |

## 2. Trouvé en plus, pendant la correction

Aucun de ces points n'était dans les rapports :

| | Le défaut | La correction |
|---|---|---|
| fiche | l'enregistrement réécrivait une fiche signée | `isNull(signeeLe)` dans le `WHERE` (`src/server/repositories/fiches-securite.ts`) |
| fiche | une signature se posait par-dessus une autre | même condition, dans `signerLaFiche` |
| fiche | retirer une photo effaçait n'importe quelle photo de l'entreprise | `detacherPhotoDeLaFiche` refuse une photo qui n'est pas sur la fiche |
| fiche | une photo effacée par la pellicule laissait un trou dans le PDF signé | `supprimerPhoto` refuse une photo tenue par une fiche (`src/server/repositories/photos.ts`) |
| fiche | forme et tailles non vérifiées, jusqu'à 15 Mo | `ecritureRecue`, `refusDeLaSignature` (`src/lib/fiche-securite.ts`), vrai PNG exigé |
| retours | même défaut de forme et de tailles | `retourRecu` (`src/lib/retour-intervention.ts`) |
| retours | une photo de la fiche pouvait s'accrocher à un retour | écartée à la relecture (`src/server/repositories/retours-intervention.ts`) |
| connexion | Redis coupé : 5 à 8 secondes d'attente, journal inondé | `MagasinLimiteRedis` échoue tout de suite (`src/server/rate-limit/redis.ts`) |
| tarifs | « Fermer » passait sous la barre du bas | `overflow-clip` (`src/app/reglages/ReglagesClient.tsx`) |
| batterie | la base de test restait à terre après une batterie | `setsid` dans `test-connexion-service-en-panne-e2e.ts` |

Chaque correction a son test, rouge avant, vert après : `test-fiche-securite.ts`,
`test-fiche-securite-db.ts`, `test-acces-roles.ts`, `test-roles-capacites-db.ts`,
`test-retour-intervention.ts`, `test-retour-intervention-db.ts`,
`test-rate-limit-redis-real.ts`.

## 2 bis. Corrigé le 14 octobre, en attente de la batterie commune

| | Ce qui a été fait |
|---|---|
| `npm audit --omit=dev` : trois failles hautes (`fast-uri`, `brace-expansion`, `source-map-js`) | fichier de verrouillage seul, sans version majeure. Elles ne servaient qu'à la construction |
| `test-devis-client-e2e` rouge sur son PC (P3) | les deux premiers cas attendent le verdict au lieu de lire l'écran d'attente. Rouge reproduit sur son PC seulement |

## 3. Regardé et laissé

| | Pourquoi |
|---|---|
| `@simplewebauthn/server`, faille faible | elle touche la chaîne des certificats d'attestation ; Atlas demande `attestationType: "none"` (`src/server/cle-appareil.ts`) et ne s'y fie pas. La corriger : cinq versions majeures, et `next-auth` attend la 9 |
| la 16.4.0 de Next, proposée par l'audit | une version mineure change le fonctionnement ; la 16.3.8 ferme les mêmes failles |
| un salarié dont l'accès est « tout » pose un retour sur n'importe quel chantier | voulu par le patron (13 août) |
| la mémoire des fiches, qu'un salarié alimente | elle ne fait que préremplir, et le chef relit avant de signer |

## 4. Corrections à mes propres affirmations

- J'ai dit que la campagne n'avait jamais commencé. **C'était faux** : les
  rapports existaient.
- Le 14 octobre, j'ai compté « masquer `/design` en production » parmi les
  restes. **C'était faux** : `src/app/design/layout.tsx` renvoie déjà
  `notFound()` en production (constat F12).

## 5. Ce qui reste ouvert

| | Qui tranche |
|---|---|
| charge à plusieurs processus, avec écritures | l'établi QA |
| rapport de vérification `docs/qa-rapport-2026-10-13-verification.md` | le patron, depuis son PC |
| hébergement, test d'intrusion externe, bêta, facturation électronique | le patron, son comptable |
