# Atlas : une session fermée ne se rouvre plus

**Document de retour** du lot « session révoquée », 23 octobre 2026. Il répond
au défaut trouvé par la batterie commune du 22 octobre
(`docs/batterie-commune-22-octobre.md` §3). Chaque affirmation porte le fichier
qui la fonde.

**État :** codé, éprouvé, batterie jouée (§6). Branche
`claude/session-revocation-security-b8ulo7`.

---

## 1. Le défaut, en une phrase

**Se déconnecter effaçait le cookie, et rien d'autre.** Chaque réponse du
serveur repose ce cookie pour prolonger la session. Une réponse partie avant la
sortie et revenue après le reposait : la session revivait. Le même trou laissait
un cookie relevé avant la sortie valable après.

## 2. Verdicts, point par point

| | Verdict | Ce qui a été fait | Fichier |
|---|---|---|---|
| **1. Un test rouge d'abord** | fait | la course jouée à coup sûr : une réponse tenue en vol par la suite, relâchée après la sortie ; puis le cookie d'avant la sortie reposé dans un navigateur neuf. **Rouge sur le code d'avant** : « la réponse en retard a rouvert la session » | `scripts/test-se-deconnecter-e2e.ts`, cas 6 |
| **2. Révoquer côté serveur** | fait | la sortie écrit le `sessionId` du jeton dans une liste des sessions fermées, AVANT d'effacer le cookie ; `getCurrentCtx` refuse ce jeton comme une session coupée, et le cookie est effacé au premier écran gardé | `src/app/login/actions.ts`, `src/server/repositories/compte.ts`, `src/server/session-ctx.ts` |
| **2 bis. Les autres appareils** | tenu | seule CETTE session est refusée : le téléphone reste connecté, Face ID reste posé, les appareils de confiance aussi | cas 6 (second appareil), `test-compte-db.ts` |
| **3. Un préchargement ne prolonge pas** | **refusé**, voir §3 | rien | `ARCHITECTURE.md` §488 |
| **4. Migration en expand** | fait | une table neuve, aucune écriture de données | `drizzle/0138_sessions_fermees.sql` |

## 3. La piste refusée : qu'un préchargement ne prolonge jamais la session

**Elle ne fermait qu'une porte sur plusieurs.** Une action serveur, une
navigation, le sondage du bandeau du banc, partis avant la sortie, reposent le
cookie exactement comme un préchargement. La piste aurait tari la source
mesurée le 22 octobre, pas le défaut.

**Et elle coûtait cher là où elle se posait.** Il aurait fallu, dans le
middleware, une seconde lecture de la session qui ne réémet pas, à côté de
celle d'Auth.js : deux règles pour une seule question, dans le fichier le plus
risqué de l'application.

**La révocation la rend inutile** : un cookie revenu par N'IMPORTE quel chemin
est inerte.

## 4. Ce qui a été trouvé en chemin, et qui n'était dans aucun point

**Le `GRANT` de la migration ne retirait rien.** La première version accordait
`SELECT, INSERT` au rôle de l'application, et croyait lui refuser l'effacement.
Or les privilèges par défaut du schéma lui donnent les quatre droits sur toute
table neuve. Le contrôle écrit pour le vérifier (« `atlas_app` ne peut ni
effacer ni modifier une session fermée ») **a rougi** : il a effacé la ligne.
Une injection SQL aurait donc pu rouvrir une session fermée. La migration retire
désormais tout (`REVOKE ALL`) avant d'accorder.

**L'ancienne parade de la suite a été retirée.** Le 22 octobre, la suite
attendait que la page se pose avant de confirmer, et laissait cinq secondes au
cookie pour mourir : elle esquivait la course au lieu de la gagner. Elle
confirme désormais dès que la feuille s'ouvre, au pire moment, et exige que la
porte soit fermée.

## 5. Ce qui a été décidé, et ce que ça coûte

| Décision | Pourquoi | Ce qu'elle coûte |
|---|---|---|
| **pas de purge de la liste** | un jeton présenté régulièrement est réémis sans fin, il ne meurt pas de vieillesse ; sa révocation doit lui survivre | une ligne d'une centaine d'octets par sortie ; le compte supprimé emporte les siennes |
| **un jeton d'avant le 25 août 2026 n'est pas révocable seul** | il ne porte pas de `sessionId` ; le refuser d'office mettrait dehors des gens qu'aucune sortie ne visait | sa sortie n'efface que son cookie, comme avant ; il prend un identifiant à la connexion suivante |
| **si l'écriture échoue, la sortie échoue** | l'inverse annoncerait « sorti » avec une porte encore ouverte | une panne de base empêche de se déconnecter ; elle est journalisée |
| **une lecture de plus par requête** | lue en parallèle de la coupure, par la clé primaire | négligeable |

## 6. Les chiffres

| | |
|---|---|
| **test rouge d'abord** | cas 6 de `test-se-deconnecter-e2e` rouge sur le code d'avant : « la réponse en retard a rouvert la session » |
| **`test-se-deconnecter-e2e`, seule** | verte 4 fois sur 4 après le correctif |
| **dans la batterie** | verte, 5 cas sur 5 |
| **suites base** | 490 sur 491 |
| **suites navigateur** | 190 sur 191 |
| **connexion derrière un proxy** (`verifier:connexion`) | verte |
| **types, lint, mémoire, construction** | verts |

**Les deux rouges ne viennent pas de ce lot**, et c'est mesuré, pas supposé :

- `test-prechauffage` est **rouge de la même façon sur `main`** : il ne connaît
  pas l'écran `/reglages/banque`, que le lot banque a ajouté ;
- `test-le-client-s-est-trompe-e2e` (la page publique du devis, qui ne lit
  aucune session) est tombé une fois dans la batterie, puis a été rejoué
  **vert** seul et par `verifier-ce-qui-a-bouge`. Son refus dans la batterie
  (« C'est noté » jamais affiché) n'a pas pu être reproduit ici.

**Une première batterie n'a rien mesuré** : le conteneur de travail avait
redémarré entre deux messages, et PostgreSQL avec lui. Base remontée, batterie
rejouée en entier ; ce sont ses chiffres ci-dessus.

## 7. Ce qui reste ouvert

**Huit lectures directes de la session ne passent pas par `getCurrentCtx`**
(gardes du gabarit, documents légaux, vérification de l'adresse, charte). Elles
ne consultent ni la coupure de « me déconnecter partout » ni la fermeture de
« se déconnecter ». Un cookie révoqué y obtient peu (lire sa charte, accepter
les documents légaux, saisir le code de l'adresse), et rien des données de
l'entreprise. Mais la règle « une session fermée n'ouvre rien » n'y tient pas.
Inscrit dans `TODO.md` comme un lot de niveau 3 à part ; c'est à nous de le
mener, il n'y a rien à trancher pour le patron.

**Avant de livrer sur `main`** : la migration 0138 doit passer chez lui. Elle
ne peut pas échouer sur sa base (une table neuve, sans données), mais le code
qui la lit est sur CHAQUE écran : si une migration plus ancienne restait
bloquée chez lui, 0138 ne passerait pas, et tous les écrans tomberaient.

Sa fiche d'espace (lue le 23 octobre) date du 22 octobre à 06 h 38 : l'espace
est arrêté depuis. Sa base était alors à jour **jusqu'à 0134**. Au prochain
allumage, il appliquera 0135, 0136 et 0137 (les lots d'autres sessions) avant
0138. **L'ordre sûr** : qu'il rallume son espace AVANT que ce lot arrive sur
`main`, que la fiche dise « Base : à jour » sur 0137, puis pousser. Rallumer
ne détruit rien.
