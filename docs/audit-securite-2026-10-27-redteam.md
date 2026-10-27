# Campagne red team du 27 octobre 2026 : franchir la frontière entre entreprises

*Menée dans l'environnement cloud de l'agent (pas l'espace du patron). Base PostgreSQL et Redis
montées localement (`scripts/monter-base-locale.sh`), rôle applicatif `atlas_app` — jamais un
superutilisateur — pour toute vérification en base.*

## A. Résumé exécutif

**Périmètre réellement testé** : l'isolation entre entreprises (lecture, écriture, création,
suppression, accès indirect) sous le rôle applicatif réel, sur une base PostgreSQL réelle avec RLS
forcée ; les mécanismes de session et de révocation (JWT, « déconnecter partout ») ; la chaîne
logicielle (dépendances, permissions CI) ; deux secrets d'espace (`AUTH_SECRET`, `CRON_SECRET`) ;
le périmètre de l'assistant IA. **Non testé** : la production (elle n'existe pas encore), les
en-têtes HTTP d'un hébergeur réel, un scan dynamique (ZAP), une charge réelle.

**Verdict sur la frontière entre entreprises (la demande prioritaire)** : **tient**. Ni dans les
suites existantes rejouées pour de vrai, ni dans ma propre lecture adversariale du code (paiements,
fichiers, sessions), aucun chemin de lecture ou d'écriture cross-entreprise n'a pu être établi sous
le rôle applicatif réel. Ce n'est pas une garantie d'absence de faille — voir §F — mais aucune n'a
été trouvée malgré une recherche réelle, pas une relecture de façade.

**Deux failles confirmées et corrigées** (E1-E15, voir tableau C) : `CRON_SECRET` public dans un
dépôt public ouvrait la purge planifiée à qui lit GitHub ; `pages.yml` donnait les droits de
publication GitHub Pages au job qui installe des paquets tiers.

**Deux failles confirmées par analyse, non corrigées, qui attendent une décision produit** : les
liens de contrat et de compte-rendu d'entretien n'expirent jamais ; les tables `paiements_facture`
et consorts n'ont pas de contrainte de clé étrangère (la protection tient par relecture RLS dans le
code applicatif, mais rien dans le schéma ne l'empêcherait si un futur code l'oubliait).

## B. Ce qui a déjà été fait avant cette session, et que je n'ai pas refait

Le dépôt porte déjà une campagne d'audit (25-26 octobre 2026, `docs/audit-2026-10-etape-2.md`,
`docs/audit-2026-10-etape-3-inventaire.md`, `docs/audit-securite-prompt-renforce.md`) qui couvre
quasiment la même liste que la demande de cette session. **Je ne l'ai pas rejouée depuis zéro** :
je l'ai lue, j'ai vérifié que ses corrections sont bien sur `main` (elles le sont), j'ai rejoué ses
suites pour de vrai plutôt que de croire ses verdicts, et j'ai repris exactement là où elle s'était
arrêtée (« vague 3 »).

| Déjà fait, vérifié vrai aujourd'hui | Preuve |
|---|---|
| E1-E9, E11, E16 corrigés | sur `main` (`git log`), suites rejouées vertes |
| E13 (injection de consigne par les lignes d'un devis) | moitié faite, l'autre moitié attend une clé IA réelle |
| « Déconnecter partout » contournable par réémission du JWT | **trouvé et corrigé le 25 août 2026**, avant cette session — `scripts/sonde-coupure-contournable.mts`, régression `scripts/test-coupure-sessions-e2e.ts` |
| Cookie de déconnexion qui revenait | **trouvé et corrigé le 23 octobre 2026** |
| Fuite du logo d'une entreprise à l'autre par la route de fichiers | **trouvée et corrigée le 29 août 2026** — lue, confirmée dans le code, pas de régression |

## C. Ce qui a été fait DANS cette session

| ID | Titre | Gravité | Statut | Fichiers |
|---|---|---|---|---|
| RT-1 | `CRON_SECRET` public dans `docker-compose.yml` ouvrait la purge planifiée | élevée (sur l'espace exposé publiquement) | **CONFIRMÉE PAR ANALYSE, CORRIGÉE** | `scripts/secret-de-l-espace.ts`, `scripts/banc.mjs`, `scripts/test-secret-de-l-espace-db.ts` |
| RT-2 | `pages.yml` donnait `pages: write` + `id-token: write` au job qui `npm ci`/`playwright install` | moyenne (chaîne logicielle) | **CONFIRMÉE PAR ANALYSE, CORRIGÉE** | `.github/workflows/pages.yml` |
| RT-3 (E12) | Liens de contrat/passage d'entretien sans expiration, jeton en clair en base | moyenne | **CONFIRMÉE PAR ANALYSE, décision requise** | `src/server/repositories/contrats-entretien.ts`, `passages-entretien.ts` |
| RT-4 (E10) | Pas de contrainte FK sur `paiements_facture.facture_id` (et consorts) | moyenne (défense en profondeur) | **CONFIRMÉE PAR ANALYSE, NON exploitable dans les chemins vérifiés** | `src/server/db/schema.ts`, `src/server/repositories/paiements-facture.ts` |
| E14 | Seuils par source communs à tous sans `ATLAS_PROXY_SAUTS` | moyenne | **confirmée, dépend de l'hébergeur — pas de code à changer ici** | `src/server/rate-limit/`, `src/server/env.ts` |
| E15 (3 sur 4) | Actions GitHub épinglées par étiquette, pas de `min-release-age`, repli `npm install` dans `demarrer.sh` | moyenne | **confirmées, DÉLIBÉRÉMENT non corrigées cette session** — voir §E | `.github/workflows/*.yml`, `.devcontainer/demarrer.sh` |

## D. L'attaque prioritaire : A contre B, en détail

Voir `docs/audit-securite-2026-10-27-isolation.md` pour le détail scénario par scénario.

## E. Pourquoi certains points ne sont pas corrigés cette session

- **RT-3 (E12)** : raccourcir la durée d'un lien, c'est une décision produit (un client veut parfois
  revoir son contrat accepté un an après). Je ne tranche pas un arbitrage qui touche à l'usage réel
  sans le patron.
- **RT-4 (E10)** : poser une vraie contrainte composite demande une colonne `UNIQUE(id, entreprise_id)`
  sur chaque table parente, donc une migration par table, sur une base qui peut être habitée
  (`.claude/rules/migrations.md`). Le gain est réel mais défensif seulement (aucun chemin trouvé qui
  l'exploite aujourd'hui) : ouvrir ce chantier sans lui en a semblé disproportionné pour ce qu'il
  répare.
- **E15, 3 items restants** : le pin par empreinte de onze actions GitHub ne peut pas se vérifier ici
  (le mandataire réseau refuse l'API GitHub pour ces dépôts tiers sans y être explicitement attaché) —
  deviner une empreinte serait pire que ne pas pin. Le repli `npm install` de `demarrer.sh` est un
  choix délibéré de robustesse sur SON poste (un `npm ci` qui échoue ne doit pas le laisser sans
  application) : le retirer est un arbitrage, pas un bug.

## F. Limites de cette campagne

- Faite dans l'environnement cloud de l'agent, pas sur l'espace réel du patron : la vraie
  exposition (port public, mandataire, limiteur) n'a pas pu être rejouée ici.
- Aucune clé IA réelle : l'isolation du CONTEXTE IA a été vérifiée par le code et par les suites
  existantes (`test-ia-0X-*`, « Isolation : B ne voit… »), jamais par un vrai appel au fournisseur.
- Pas de scan dynamique (ZAP), pas de test de charge, pas de production réelle à attaquer.
- Absence de preuve n'est pas preuve d'absence : voir §A.

---

*Rédigé par l'agent, `claude-code-remote` session af42c0cb-7594-59ed-bd96-11aed5c2797e.*
