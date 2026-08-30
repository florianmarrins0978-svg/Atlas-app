# Atlas — Audit final de sécurité, avant le premier artisan réel

*29 août 2026. Document autonome, à transmettre tel quel.*

---

## En six lignes

1. **Neuf défauts réels trouvés**, dont **une fuite entre entreprises** et **une
   porte ouverte au bourrage de mots de passe**. Tous corrigés.
2. Chacun a été **mesuré**, jamais déduit : la fuite a été reproduite en base,
   le déni de service chronométré, la porte dérobée lue dans le code d'Auth.js.
3. **Trois suites neuves et trois élargies**, toutes **vues rouges** avant
   d'être vertes.
4. Ce qui tient déjà tient bien : isolation par la base, jetons, nettoyage des
   photos, traversée de répertoire, injection SQL — rien à reprendre.
5. **Trois constats n'ont pas été corrigés**, et c'est délibéré : ils demandent
   soit une décision du patron, soit une clé d'IA que cet environnement n'a pas.
6. **La batterie est entièrement verte** : 262 suites base, 116 suites
   navigateur, 0 erreur de types.
7. **Verdict : PRÊT SOUS CONDITIONS.** Les conditions sont d'infrastructure, pas
   de code.

---

# 1. Verdict

## PRÊT SOUS CONDITIONS

Le code peut être mis entre les mains d'artisans réels **une fois les points du
§4 réglés**. Aucun d'eux ne demande d'écrire du code.

**Ce qui a changé la nature du verdict.** Avant cet audit, deux défauts
rendaient la réponse « non » : un artisan pouvait lire le logo d'une autre
société, et n'importe qui pouvait essayer des mots de passe en boucle sans
qu'aucun compteur n'avance. Les deux sont fermés et éprouvés.

**Ce qui empêche de dire « prêt » tout court** n'est pas dans le code : la purge
des données n'est appelée par aucun planificateur, et les variables
d'environnement de production n'ont pas encore été posées.

---

# 2. Défauts critiques restants

**Aucun défaut critique de code ne reste ouvert.**

Un point d'infrastructure est cependant **bloquant**, et il n'a rien à voir avec
du code :

| | |
|---|---|
| **La purge ne tourne pas** | La route `/api/cron/purge-fichiers` existe et fonctionne. **Rien ne l'appelle.** Ni `vercel.json`, ni aucun planificateur de `.github/workflows/`. Tant que c'est le cas, aucun audio de dictée n'est jamais effacé, aucune photo de diagnostic échue, aucun fichier en attente. Toutes les durées de conservation annoncées sont des promesses vides — et personne ne s'en apercevrait, puisque la purge « marche » quand on l'appelle. |

C'est un `schedule:` à écrire, plus une sonde qui rougit si la dernière purge
remonte à plus de 48 h. Sans la sonde, le planificateur se débranchera un jour
sans bruit.

---

# 3. Défauts corrigés

## 3.1 — FUITE ENTRE ENTREPRISES : le logo d'un autre artisan

| | |
|---|---|
| **Où** | `src/app/api/fichiers/[...key]/route.ts` |
| **Le problème** | La route servait n'importe quel fichier dont la clé était trouvée en base. Pour les photos et les dictées, la RLS bornait la recherche. Pour le **logo**, non : la table `entreprises` **n'a aucune politique RLS** — ni `ENABLE`, ni `FORCE`, ni la moindre politique, et aucune des 78 migrations n'en pose. |
| **Pourquoi c'était dangereux** | Un artisan authentifié demandant la clé du logo d'une autre société recevait les octets. C'était la seule des quatorze requêtes du dépôt sur cette table à ne pas écrire son propre filtre. |
| **Ce qui l'avait caché** | Un commentaire, juste au-dessus : *« la ligne `entreprises` est déjà bornée par l'isolation »*. Il rassurait quiconque venait vérifier. **C'est la phrase qui a coûté le plus cher de tout cet audit.** |
| **La mesure** | Sous `atlas_app`, contexte posé sur l'entreprise A : `SELECT nom FROM entreprises WHERE logo_storage_key = '<clé de B>'` rend « Entreprise B ». La route rendait alors `true`. |
| **La correction** | Un filtre explicite sur `entreprises.id`. Plus le retrait des photos supprimées, qui restaient servables — la suppression est douce, et la purge ne tourne pas. |
| **Le contrôle** | `test-toute-table-est-cloisonnee.ts` (§3.6) relève désormais ce genre d'écart. |

## 3.2 — BOURRAGE D'IDENTIFIANTS : la porte d'à côté n'était pas gardée

| | |
|---|---|
| **Où** | `src/app/api/auth/[...nextauth]/route.ts` |
| **Le problème** | Le fichier montait les gestionnaires d'Auth.js en entier. `/api/auth` étant public, `POST /api/auth/callback/credentials` appelait `authorize()` **directement** — sans passer par aucune des trois défenses, qui vivent toutes dans l'action serveur de l'écran de connexion. |
| **Pourquoi c'était dangereux** | On pouvait essayer des mots de passe en boucle, aussi vite que le hachage le permettait, **sans qu'aucun compteur n'avance et sans qu'aucune temporisation ne se pose**. Le succès se distingue de l'échec au cookie renvoyé. Tout le lot « bourrage » et toute la migration 0062 étaient contournés par une adresse que personne ne regardait. |
| **Ce qui l'avait caché** | Les deux suites censées couvrir le sujet **ne pouvaient pas le voir** : l'une pilote le formulaire (donc l'action serveur), l'autre appelle le compteur en direct. Aucune ne frappait la route. Elles restaient vertes. |
| **La correction** | Les deux rappels d'identifiants sont **murés** (404). Pas gardés deux fois : `signIn()` importé côté serveur appelle Auth.js **en processus**, il n'émet aucune requête HTTP vers cette route, et aucun `signIn()` de navigateur n'existe dans ce dépôt. Recopier les seuils dans `authorize()` aurait créé deux implémentations de la même règle, ce que le dépôt interdit. |
| **Le contrôle** | `test-bourrage-porte-derobee-e2e.ts` : le rappel ne délivre pas de session **même avec les bons identifiants** — éprouver avec un mauvais mot de passe n'aurait rien prouvé —, **et** le formulaire ouvre toujours. Sans la seconde moitié, on aurait fermé la porte à tout le monde en croyant l'application sûre. |

## 3.3 — TRENTE-QUATRE ACTIONS SANS GARDE DE RÔLE

| | |
|---|---|
| **Où** | `prix/`, `devis-complet/`, `facture/`, `export/`, `clients/[id]/`, `termines/tva/` |
| **Le problème** | `GardeAcces` est un composant de mise en page : il ne s'exécute qu'au **rendu**. Une action serveur s'exécute **avant** tout rendu, et ses effets ne se défont pas d'une redirection. Le middleware, lui, ne vérifie que la session — jamais le rôle. Entre les deux, il n'y avait rien. |
| **Pourquoi c'était dangereux** | Un salarié ne peut pas *afficher* `/chantiers/…`, mais l'adresse de l'action reste postable avec sa session, et les identifiants d'actions se lisent dans les fragments servis sous `_next/static`, que le filtre du middleware exclut. Étaient atteignables : ouvrir un devis complet et ses lignes, calculer une marge, modifier ou supprimer une ligne de prix, **envoyer un devis chez un client**, **émettre une facture**, **supprimer un client**. |
| **Ce qui l'avait caché** | Le commentaire de `GardeAcces` affirmait : *« Les Server Actions, de même, gardent leur `exigerProprietaire` »*. Vrai des réglages, faux de ces trente-quatre. |
| **Trouvé deux fois** | Deux relectures indépendantes ont abouti au même constat, ce qui est la meilleure raison de le croire. |
| **La correction** | `src/server/garde-action.ts` — `exigerMontants(ctx, …)` en première ligne des trente-quatre. La garde porte sur **ce que l'action fait**, jamais sur le chemin d'où elle semble venir : un salarié posté sur `/planning`, chemin qui lui est ouvert, franchirait une garde par chemin tout en appelant une action de `/chantiers/…`. |
| **Le contrôle** | `test-actions-gardees-db.ts`, en deux moitiés : la garde **refuse un vrai salarié en base** et laisse passer le patron et le commercial ; **et** aucune action de ces fichiers ne l'oublie. Vu rouge en retirant la garde d'émission de facture — il la nomme. |

## 3.4 — DÉNI DE SERVICE À 258 OCTETS

| | |
|---|---|
| **Où** | `src/server/import/lire-classeur.ts` |
| **Le problème** | La référence d'une cellule vient du fichier déposé. `r="ZZZZZ1"` vaut 12 356 630, et le code empilait autant de chaînes vides — sur le fil de l'événement, hors de tout `try`. |
| **La mesure** | Un classeur forgé de **258 octets** : **1,7 seconde et 196 Mo** de mémoire. Une lettre de plus mène à cinq gigaoctets. |
| **Pourquoi les protections existantes ne suffisaient pas** | La borne de 5 Mo à l'écran borne ce qui *entre* ; le plafond de 32 Mo borne ce qui *sort* de l'archive ; la cadence borne le *rythme*. Aucune ne bornait **l'allocation qui suit la lecture** — et le fichier hostile est minuscule, un seul appel suffit. C'est le **processus** qui tombe, donc les requêtes de toutes les entreprises servies par cette instance. |
| **La correction** | Une référence au-delà de `XFD` (16 384 colonnes, la dernière d'Excel) fait ignorer la cellule. La ligne reste, le reste du classeur se lit. |
| **Le contrôle** | Trois cas dans `test-classeur-bombe.ts`, dont **la dernière colonne légitime**, qui doit passer — sinon on passe au vert en refusant tout. Vu rouge contre la version d'avant : 12 356 630 cellules, puis `Invalid array length`. |

## 3.5 — MÊME FAMILLE, AUTRE PORTE : les cotes du plan d'arrosage

| | |
|---|---|
| **Où** | `src/app/paysage/arrosage/actions.ts` |
| **Le problème** | `discuterDuPlan` recevait ses cotes du navigateur et les passait au calcul sans les regarder, avec un `as never` qui retirait jusqu'au typage. Avec 100 000 m de côté : de l'ordre de **deux cent quarante millions** d'objets empilés. C'était aussi **la seule porte d'IA du produit sans cadence**. |
| **La correction** | Une fonction pure, aux **mêmes plafonds que la lecture de croquis** — jamais réinventés. Plus la cadence manquante. |
| **Un piège évité** | `Number.isFinite` avant la comparaison : **`NaN > 100` est faux**. Sans cette ligne, une cote non numérique franchissait la borne en silence — le contrôle aurait été vert sur le cas même qu'il existe pour attraper. La suite éprouve `NaN` et `Infinity` séparément. |

## 3.6 — CE QUI ARRIVE À LA PROCHAINE TABLE

| | |
|---|---|
| **Le problème** | Le rôle propriétaire a posé des privilèges par défaut : **toute table créée demain est immédiatement lisible et modifiable par le rôle applicatif**, celui que tous les artisans partagent. La `ROW LEVEL SECURITY`, elle, est **éteinte par défaut**. Les deux réglages vont en sens contraire : les droits arrivent tout seuls, le cloisonnement non. |
| **Pourquoi c'est grave** | Une migration qui crée une table portant `entreprise_id` et oublie ses trois lignes de RLS produit une table où **chaque artisan lit et modifie les lignes de tous les autres** — sans erreur, sans avertissement. La batterie reste verte, les écrans marchent, et la fuite ne se voit qu'au moment où deux entreprises réelles cohabitent. |
| **L'état actuel** | **Sain** : les 42 tables portant `entreprise_id` sont toutes cloisonnées ; les deux files de purge qui font exception le sont pour une raison écrite. Il n'y avait rien à réparer — **il n'y avait aucun contrôle.** |
| **Le contrôle** | `test-toute-table-est-cloisonnee.ts`. Le critère est **factuel, pas décrété** : une table qui porte `entreprise_id` désigne elle-même le cloisonnement qu'elle attend. Aucune liste à tenir à la main. Vu rouge en créant la table qu'une migration distraite produirait, puis sur l'oubli de `FORCE` et de la politique. |

## 3.7 — Trois replis permissifs dans la configuration

| Variable | Ce qui se passait | Correction |
|---|---|---|
| `ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL` | Documentées « pour les essais uniquement », **rien ne l'imposait**. Une variable posée en production détournait chaque appel : la clé d'API part dans l'en-tête, et avec elle les dictées de chantier, les photos de tickets, les croquis, les **noms et adresses des clients**. Une ligne dans un fichier d'environnement, et tout le carnet d'un paysagiste s'en va — sans erreur, sans trace, sans ralentissement. | Refusées en production si elles ne valent pas l'adresse officielle |
| `NODE_ENV` | Passait par un `as`, qui est une affirmation et jamais une vérification : **`Production` avec sa majuscule valait `development`**. Cela éteignait d'un coup l'exigence d'`AUTH_SECRET` (repli sur un secret écrit en dur), de `CRON_SECRET`, de Redis, du stockage distant, le refus de l'IA simulée — et rouvrait la porte de test qui donne le compte de son choix. | Une valeur inattendue est refusée au démarrage |
| `REDIS_URL` | Lue en brut : une valeur blanche est *truthy*, elle franchissait son propre garde-fou, puis la limitation retombait sur un compteur en mémoire — l'état que ce garde-fou déclare « jamais autorisé en production ». | Passe par le lecteur qui traite le blanc comme l'absence |

## 3.8 — Deux fermetures à trois caractères

- **Le filtre du middleware** n'ancrait pas `api/health` à la fin d'un segment :
  `/api/healthXYZ` n'aurait traversé ni la garde de session, ni la pose de
  l'en-tête dont dépend la garde des routes. Aucune route de ce nom n'existe —
  la porte est fermée avant qu'elle serve.
- **`jeton` rejoint les clés que le journal masque.** La liste ne portait que
  `token` : dans un dépôt entièrement en français, le premier
  `logger.info(…, { jeton })` serait parti en clair — et un jeton d'envoi ouvre à
  lui seul la page publique d'un devis, nom et montants du client compris.

## 3.9 — Une clé de stockage crue sur parole

`ajouterAchatAction` reprenait `photoCle` du formulaire sans rien vérifier :
**la seule clé de stockage d'origine client de tout le dépôt**. Aucune route ne
sert cette colonne aujourd'hui, donc rien ne fuit — mais `TODO.md` prescrit noir
sur blanc d'ajouter les photos de tickets à l'export « Mes données ». Le jour où
cette ligne sera écrite, la clé sera lue et servie **sans contrôle
d'appartenance**. La fuite était armée, et se serait déclenchée avec un
correctif que le dépôt s'est lui-même prescrit.


## 3.10 — Un en-tête forgé battait l'adresse déclarée

| | |
|---|---|
| **Où** | `src/server/agenda/adresse-publique.ts` |
| **Le problème** | Deux fonctions répondent à la même question — quelle est l'adresse publique du site — et elles y répondaient **dans l'ordre inverse** : l'une croyait l'en-tête d'abord, l'autre l'adresse déclarée d'abord. |
| **Pourquoi c'était dangereux** | `x-forwarded-host` est écrit par le **client** quand le mandataire de tête ne le réécrit pas — le cas par défaut de plusieurs hébergeurs. Or cette adresse compose la **redirection de retour de Google** : une valeur forgée renvoyait le navigateur, au retour d'une autorisation, vers l'hôte de qui l'avait écrite. |
| **La correction** | L'adresse déclarée passe d'abord. **Et le banc continue de marcher**, ce qui était toute la raison de l'ordre d'origine : la variable n'y est pas posée, l'en-tête reprend donc la main. Une suite tient ce cas explicitement, pour que le défaut du 9 août ne revienne pas par la porte du correctif. |

## 3.11 — Un outil de diagnostic qui mentait

| | |
|---|---|
| **Où** | `src/app/api/health/diagnostic/route.ts` |
| **Le problème** | La page recopiait le calcul de `next.config.ts`, et son commentaire l'affirmait — *« reproduit exactement le calcul de next.config.ts »*. Les deux avaient divergé : la copie avait perdu une condition. |
| **Pourquoi c'était grave** | Sur le banc, la page annonçait « aucune origine autorisée » et « connexion impossible » **pendant que la connexion marchait**. L'outil écrit précisément pour ne pas accuser le mauvais coupable accusait le mauvais coupable — et il avait été écrit après une journée perdue sur « Invalid Server Actions request. ». |
| **La correction** | Une seule fonction, appelée des deux côtés. |

---

# 4. Points ouverts

## 4.1 — Ce qui demande une décision du patron

| Point | Pourquoi nous ne tranchons pas |
|---|---|
| **Un salarié peut-il supprimer un chantier ?** | `/planning` lui est ouvert, et les actions de suppression et de déplacement y vivent. Ce n'est pas un contournement : c'est le modèle de rôles tel qu'il a été écrit. Mais il n'a jamais été posé comme une question. |
| **L'adresse e-mail dans les journaux** | Elle est écrite à chaque échec de connexion, et c'est ce qui permet de répondre à « je n'arrive pas à entrer » — la panne où ses parents lisaient « mot de passe incorrect » avec les bons identifiants. La masquer rendrait ces lignes muettes quand on en a besoin. Ce qu'il faut régler, c'est la **durée de conservation** du journal, pas la ligne. |
| **La conservation déclarée et jamais appliquée** | Trois durées sur quatre ne sont référencées nulle part, et l'une décrit une fermeture de compte **qui n'existe pas**. Une durée déclarée sans mécanisme est une promesse fausse : soit on écrit le chemin, soit on retire la durée. |

## 4.2 — Ce qui demande de l'infrastructure

| Point | |
|---|---|
| **Brancher la purge** | Bloquant (§2) |
| **Poser `ATLAS_URL_PUBLIQUE`** | Sans elle, l'adresse publique se déduit d'un en-tête que le client peut écrire — et c'est cette adresse qui compose **le lien que le patron recopie et envoie à son client**, jeton compris |
| **Poser `ATLAS_PROXY_SAUTS` et `ATLAS_RP_ID`** | Dette connue. Sans la première, aucune adresse transmise n'est crue — le défaut est sûr, mais la limitation de connexion se fait alors par compte seul |
| **`AUTH_URL`** | Fixe le protocole du cookie de session plutôt que de le déduire d'un en-tête |

## 4.3 — Ce que nous n'avons **pas** corrigé, et pourquoi

**Trois constats réels restent ouverts, délibérément.** Les taire aurait été
pire que de les laisser.

| Constat | Pourquoi il n'a pas été corrigé ici |
|---|---|
| **Du contenu appris entre dans la consigne système de l'IA** | Les corrections passées et les libellés de lignes de devis sont recopiés dans la consigne système — la position de plus haute autorité. Un libellé rédigé comme une instruction en devient une. La correction demande de restructurer les invites, et **rien de cela ne se vérifie ici** : cet environnement n'a aucune clé d'IA. Livrer un remaniement d'invite non éprouvé serait exactement ce que le dépôt interdit. |
| **Le patron approuve un texte, et c'est une autre donnée qui s'écrit** | L'écran affiche la `description` rendue par le modèle ; l'application lit le champ `donnees`. Rien ne confronte les deux. La correction — recomposer la description côté serveur — change ce qu'il voit à l'écran, donc relève de la maquette avant le code. |
| **Un prix venu du modèle est écrit sans borne de vraisemblance** | La base refuse les négatifs, mais pas 99 999 999,99 €. La lecture d'un ticket de caisse valide déjà ses montants ; le chemin qui écrit vraiment un prix sur un devis en fait moins. Une borne se pose — mais le seuil est un arbitrage métier. |

---

# 5. Ce qui a été explicitement vérifié, et qui tient

Écrit pour qu'un lot suivant ne « corrige » pas ce qui va bien.

| Protection | Constat |
|---|---|
| **Isolation entre entreprises** | 42 tables en `FORCE ROW LEVEL SECURITY`, qui s'applique **même au propriétaire**. Éprouvé sous le vrai rôle applicatif : DDL refusé, désactivation de la RLS refusée, `SET ROLE` refusé, `TRUNCATE` refusé, `COPY` vers un fichier refusé, lecture de `pg_authid` refusée. |
| **Clés étrangères composites** | `(chantier_id, entreprise_id)` : un identifiant inventé par l'IA **ne peut pas** rattacher une écriture au chantier d'une autre société. La base refuse. |
| **Le condensat des mots de passe** | Le rôle applicatif n'a ni lecture ni écriture sur la colonne. Vérifié : `AUCUN DROIT`. La vérification se fait dans une fonction en base, au `search_path` épinglé. |
| **Jetons publics** | 256 bits de source cryptographique, dans les trois familles. Clés de stockage : identifiants aléatoires. **Rien n'est devinable, aucun identifiant séquentiel.** |
| **Injection SQL** | Les 78 occurrences de requêtes littérales relues une par une : toutes paramétrées. Zéro concaténation, zéro identifiant dynamique. |
| **XSS** | Aucun rendu de HTML brut dans tout le dépôt. Les PDF sont dessinés, pas composés en HTML. |
| **Traversée de répertoire** | Fermée **après résolution** du chemin, pas par recherche de `..` — la seule méthode qui tienne. |
| **Métadonnées des photos** | Les coordonnées GPS sont retirées **avant** stockage, et une image qu'on ne sait pas nettoyer est **refusée** plutôt que rangée telle quelle. Les cinq chemins d'image passent par cette porte unique. |
| **SSRF** | Les destinations d'agenda sont analysées, pas comparées par préfixe : liste blanche, refus des adresses privées et de l'adresse de métadonnées des hébergeurs, y compris ses formes IPv6, et **revérification à chaque redirection** avant de poser l'en-tête d'authentification. |
| **La limitation de débit ne s'ouvre pas** | Redis absent en production = refus au démarrage. Redis qui tombe en service = bascule sur un compteur mémoire, jamais « tout passe ». |
| **Fixation de session** | L'identifiant de session est neuf **uniquement** quand une identité vient d'être vérifiée. |
| **« Me déconnecter partout »** | Ne se contourne plus par la route qui réémet le jeton — la coupure compare une marque posée une fois, pas une date rajeunie à chaque appel. |

---

# 6. Tests

| | Résultat |
|---|---|
| **Types** | **0 erreur** |
| **Lint** | 0 erreur, 13 avertissements (préexistants, aucun de sécurité) |
| **Suites base** | **262 / 262** — dont les deux neuves |
| **Suites navigateur** | **116 / 116**, aucune non jouée |
| **Essais négatifs** | **11**, détaillés ci-dessous |

## Les essais négatifs, un par un

Un contrôle qui n'a jamais échoué ne prouve rien. Chacun de ceux-ci a été
confronté à l'état dégradé qu'il prétend détecter.

| Ce qui a été cassé exprès | Le contrôle a-t-il rougi ? |
|---|---|
| Une table portant `entreprise_id` créée sans RLS | **oui**, et il la nomme |
| La même, avec la RLS mais sans `FORCE` | **oui** |
| La même, avec `FORCE` mais sans politique | **oui** |
| Un classeur à `r="ZZZZZ1"` | **oui** — 12 356 630 cellules relevées |
| Un classeur à `r="ZZZZZZ1"` | **oui** — `Invalid array length` |
| La dernière colonne légitime d'Excel (`XFD`) | **non**, et c'est le point : la borne ne casse pas les vrais classeurs |
| La garde retirée de l'émission de facture | **oui**, et il la nomme |
| Un vrai salarié appelant une action à montants | **oui** — refusé |
| Le patron et le commercial sur la même action | **non** — ils passent, sinon la porte serait fermée à tous |
| Un compte d'une autre entreprise | **oui**, une couche plus bas — par la garde d'isolation, avant même qu'un rôle soit lu |
| Une cote `NaN` sur un plan d'arrosage | **oui** — sans `Number.isFinite`, elle serait passée |

## Deux choses apprises en écrivant les contrôles

Écrites parce qu'elles ont failli produire un vert faux.

1. **Ma première borne sur les files de purge était devinée, pas relevée.** Elle
   énumérait les colonnes attendues et a rougi à sa première exécution sur trois
   colonnes parfaitement légitimes. Une liste de noms se corrige en l'élargissant
   — et l'on finit par l'élargir sans la lire. Elle a été refaite **par la
   forme** : un identifiant et une date ne peuvent pas porter le nom d'un client.
2. **Le refus d'un compte étranger ne vient pas de la garde.** Il vient d'une
   couche plus profonde, qui lève avant qu'un rôle soit lu. C'est correct — le
   doute se tranche du côté fermé, à deux étages plutôt qu'un — mais l'assertion
   a dû être corrigée pour dire la vérité plutôt qu'assouplie en silence.

---

# 7. La question posée, et la réponse

> *Peut-on mettre Atlas entre les mains de vrais artisans sans laisser une faille
> connue, une rupture d'isolation, une perte de données évitable, ou une
> protection qui semble fonctionner sans fonctionner ?*

**Sur les trois premières : oui**, une fois la purge branchée.

**Sur la quatrième, il faut être précis** — c'est là que se trouvaient les vrais
défauts de cet audit, et ils avaient tous la même forme :

| Ce qui semblait protégé | Ce qui protégeait vraiment |
|---|---|
| « `entreprises` est bornée par l'isolation » | rien |
| « les actions gardent leur `exigerProprietaire` » | rien, sur trente-quatre d'entre elles |
| « la connexion est limitée à quatre essais » | vrai du formulaire, faux de la porte d'à côté |
| « le classeur est borné à 32 Mo » | vrai des octets, faux de l'allocation |

**Dans les quatre cas, un commentaire affirmait la protection.** C'est ce qui les
avait rendus invisibles : on ne vérifie pas ce qu'une phrase déclare déjà acquis.
Les quatre phrases ont été corrigées en même temps que le code — une
documentation périmée est pire qu'absente, parce qu'on s'y fie encore.
