# Audit de sécurité d'octobre 2026, étape 2 : ce qui tient des audits précédents

*25 octobre 2026. Lecture du code, sans modification. Les suites avaient été jouées vertes le jour même (506 suites base, 194 navigateur sur 195).*

## Le bilan

**Lots 2, 2B et 3 : 31 points** déclarés corrigés, instruits un par un (fichier de la protection et test ouverts) :

| | Nombre |
|---|---|
| **tient** : la protection est dans le code, et un test la fait rougir si on la retire | 20 |
| **fragile** : la protection est là, mais aucun test ne rougirait si on la retirait | 8 |
| **rouvert** : la faille revient par une autre porte | 2 |
| **décision ouverte** : présenté comme corrigé, c'est en fait un choix qui t'attend | 1 |

**Audit final du 29 août : 11 points.** Les quatre tests principaux existent et sont joués par la batterie (`test-toute-table-est-cloisonnee`, `test-bourrage-porte-derobee-e2e`, `test-actions-gardees-db`, `test-classeur-bombe`), tous verts ce jour. Les sept autres n'ont pas été instruits ligne par ligne : **NON VÉRIFIÉ** dans le détail, à reprendre à l'étape 3.

## Ce qui est rouvert

| # | Faille | Où | Gravité | Ce qui la rouvre |
|---|---|---|---|---|
| **R1** | L'IBAN de l'entreprise se change **sans redemander le mot de passe** | `src/app/chantiers/[id]/devis-complet/actions.ts:49` (`majEmetteurAction`) | **élevée** | Le lot M11 a mis la preuve d'identité sur Réglages, Identité. Le champ IBAN de l'écran du devis écrit la même colonne par une autre porte, et le rôle **commercial** y a accès. Un compte volé, ou un salarié malveillant, détourne les paiements des clients vers son compte. |
| **R2** | Un envoi de fichier lu **sans plafond réel** | `src/app/api/pieces-importees/route.ts:38` | moyenne | La route regarde la taille **annoncée** par l'expéditeur, puis lit tout. Une taille annoncée fausse, ou absente, fait tout charger en mémoire. Il faut un patron connecté, et la cadence limite la répétition. |
| **R3** | Même défaut sur une route **publique** | `src/app/api/paiement/route.ts:53` | moyenne | `request.text()` lit le corps entier **avant** de vérifier la signature. N'importe qui peut l'appeler. |

## La décision qui t'attend

**F11, les adresses e-mail dans les journaux du serveur.** À chaque échec de connexion, l'adresse est écrite en clair (`src/app/login/actions.ts`). C'est délibéré (`src/server/logger.ts`) : c'est ce qui permet de comprendre un « je n'arrive pas à entrer ». L'audit du 29 août l'avait déjà posé (§4.1) : la question n'est pas de masquer la ligne, c'est **combien de temps garder le journal**. Elle se tranche avec l'hébergeur.

## Les protections fragiles (à couvrir par un test)

| Point | Ce qui manque |
|---|---|
| M4, cadence de l'import de tarifs et du croquis | aucun test ne rougit si on retire la cadence |
| M6, route des dictées | le test éprouve la fonction de plafond, pas que la route l'emploie |
| F9, seuil par source sur la réponse au devis | le cas « source inconnue » n'est éprouvé nulle part |
| M11 geste 4, export complet | le test passe par l'écran ; la route appelée directement sans preuve n'est jamais essayée |
| M3, nettoyage des photos | le contrôle ne vérifie que 5 chemins ; 9 chemins arrivés depuis passent bien par la porte commune (vérifié à la lecture), mais rien ne le tient |
| Toutes les routes de `src/app/api` | aucun contrôle ne vérifie qu'elles plafonnent leur corps (c'est ce qui a laissé passer R2 et R3) |

## Déjà ouvert depuis août, toujours ouvert

| Point | État |
|---|---|
| La purge des fichiers n'est appelée par aucun planificateur | ouvert, dépend de l'hébergeur |
| La table `entreprises` n'a pas de RLS (filtre explicite à chaque requête) | ouvert, vérifié en base ce jour |
| La CSP autorise `unsafe-inline` | ouvert |
| Trois constats d'IA (contenu appris dans la consigne système, description affichée et donnée écrite non confrontées, prix sans borne) | ouverts (`TODO.md`) |

## Une erreur relevée dans un ancien document

`docs/lot-3-cloture-definitive.md` §3 donne pour F4, F7, F10 et F11 des raisons qui sont celles du lot 2. Le code n'est pas en cause, seulement le document.

## La suite

1. **R1 : CORRIGÉ le 25 octobre.** La preuve d'identité est exigée par l'écriture de l'IBAN elle-même, quelle que soit la porte. L'écran du devis ouvre la même fenêtre de mot de passe que Réglages. Test rouge avant, vert après (`ARCHITECTURE.md` §500).
2. **R2 et R3 : CORRIGÉS le 25 octobre**, et un contrôle vérifie désormais que **chaque** route plafonne son corps.
3. **Les protections fragiles : TENUES** par un test chacune, vu rouge en retirant la protection.
4. **F11, ta décision** : les adresses s'écrivent dans le journal en empreinte (`courriel:…`). Pour retrouver les tentatives d'une personne : `npm run empreinte -- son.adresse@exemple.fr`. Reste à fixer la durée de conservation du journal chez l'hébergeur.
5. L'étape 3 : l'inventaire complet.
