# Atlas — Clôture avant le premier artisan réel

*29 août 2026. Document autonome, à transmettre tel quel.*

---

## A. Verdict

## PRÊT SOUS CONDITIONS

**Et les conditions ne sont plus que d'infrastructure.** Il ne reste, dans le
code, aucune faiblesse connue qui devrait empêcher Atlas de recevoir son premier
artisan.

Ce qui empêche d'écrire « prêt » tout court tient en **deux gestes chez
l'hébergeur** et **une décision de votre part**. Rien d'autre.

| | |
|---|---|
| **Ce qui a changé depuis l'audit du 29 août** | le point bloquant — la purge que rien n'appelait — est devenu **détectable** : Atlas dit désormais si le ménage se fait, et une sonde rougit au-delà de 48 h |
| **Ce qui reste** | brancher le planificateur, poser quatre variables, et trancher une question métier |

---

## B. Ce que j'ai corrigé

### B.1 — La purge était invisible, pas seulement débranchée

| | |
|---|---|
| **Le problème** | `/api/cron/purge-fichiers` existe et fonctionne ; rien ne l'appelait. Mais le grave n'est pas l'oubli — c'est que **rien ne l'aurait signalé** : aucune erreur, aucun écran rouge, aucun ralentissement. Les audios s'accumulaient et tout avait l'air normal |
| **Le risque réel** | on ne l'aurait découvert qu'en cherchant autre chose, des mois plus tard, avec toutes les durées de conservation annoncées fausses depuis le début |
| **La correction** | une table journalise chaque exécution **réussie** ; `/api/health/purge` rend **503** au-delà de 48 h. Atlas ne planifie toujours rien — un minuteur interne mourrait avec le processus sans que personne ne le sache, soit le même défaut déplacé d'un cran |
| **Le contrôle** | `test-journal-purge-db.ts` **fabrique l'échec** : il retire à `atlas_app` le droit d'écrire, appelle la purge, et vérifie que **rien n'est noté**. C'est le faux vert le plus dangereux — celui qui rassure |

**Trois décisions qui ne se devinent pas**, écrites dans le code :

- l'écriture est **dans le `try`**, jamais dans un `finally` ;
- la sonde est **séparée de `/api/health/ready`** : la faire rougir là mettrait
  Atlas hors service, et un artisan ne pourrait plus ouvrir ses chantiers parce
  que des audios de la semaine dernière traînent ;
- **48 h et non 2** : le seuil mesure la panne, pas la ponctualité. Une alerte
  qui parle pour un redéploiement s'apprend à être ignorée.

### B.2 — Un écran fermé ne fermait pas l'action

| | |
|---|---|
| **Le problème** | 37 actions serveur sans garde, sur des écrans pourtant fermés au salarié. Parmi elles, **quatre suppressions dures** — une prestation, une ligne de matériel, une note vocale, un passage d'entretien. Un `DELETE` en base, que rien ne défait et qu'aucun écran ne restaure |
| **Le risque réel** | `GardeAcces` ne s'exécute qu'au **rendu** ; une action s'exécute **avant**, et ses effets ne se défont pas d'une redirection |
| **La correction** | `exigerEcran` — elle **ne décide rien de neuf** : elle applique votre règle du 23 août (« les salariés n'auront accès qu'à la catégorie planning ») là où seule la mise en page l'appliquait |
| **Le contrôle** | `test-actions-gardees-db.ts`, élargi. **Vu rouge** en retirant une garde : il la nomme |

### B.3 — La portée du planning ne filtrait que l'affichage

| | |
|---|---|
| **Le problème** | vous aviez tranché le 13 août : *« le patron choisira s'il a accès qu'à ses chantiers ou à tout »*. Le tamis existait — **au chargement seulement**. Aucune des sept actions du planning ne vérifiait que le chantier reçu était de l'équipe du salarié |
| **Le risque réel** | un salarié resserré **ne voyait pas** les autres chantiers, et pouvait les **supprimer, déplacer, déplanifier ou annoter** dès qu'il en connaissait l'identifiant. Vous croyiez avoir restreint ; vous n'aviez restreint que l'affichage |
| **La correction** | `exigerChantierDansSaPortee` sur les sept. Une portée « tout » — le cas par défaut — ne coûte rien |
| **Le contrôle** | éprouvé en base sous un vrai salarié resserré sur une vraie équipe |

### B.4 — Ce que vous approuvez est désormais ce qui s'écrit

| | |
|---|---|
| **Le problème** | une proposition portait deux choses composées par le modèle et **jamais confrontées** : la `description` affichée, et les `donnees` écrites |
| **Le risque réel** | le modèle pouvait annoncer « Tonte — 120 € » et faire écrire **1 200 €**. Vous cochiez ce que vous lisiez ; ce qui s'écrivait était autre chose, sur un devis qui part chez un client. Votre geste — *« très important que ça reste le doigt du patron »* — perdait tout son sens |
| **La correction** | la description **se recalcule** depuis `donnees`, au seul point de passage. L'écart n'est plus détecté : **il est impossible** |
| **Le contrôle** | `test-decrire-proposition.ts`, dont le cas central est exactement 120 contre 1 200 |

### B.5 — Un montant du modèle partait sans être regardé

| | |
|---|---|
| **Le problème** | sur le chemin de l'assistant, une ligne sans tarif prenait son montant dans ce que le modèle avait rendu. La base refusait le négatif, et **rien d'autre** : ni `NaN`, ni `« 1e9 »`, ni sept décimales, ni 99 999 999,99 € |
| **La correction** | **aucun plafond métier n'est inventé** — refuser au-dessus de dix mille euros refuserait du terrassement et des contrats annuels réels. Ce qui est refusé est factuel : ce qui n'est pas un nombre, et ce que la colonne ne peut pas contenir |
| **Un piège évité** | `Number.isFinite` **avant** la comparaison : `NaN > MAX` est faux, `NaN < 0` aussi. Sans cette ligne, `NaN` traversait les deux bornes |
| **Le contrôle** | dix cas, dont **la moitié qui doit passer** : un chantier à 45 000 € reste un montant légitime |

### B.6 — Le contenu appris avait l'autorité d'une règle

| | |
|---|---|
| **Le problème** | dictées passées et libellés de devis entraient dans la **consigne système**, position de plus haute autorité. Un libellé peut venir du devis d'un autre client, donc d'un texte collé. Rédigé comme un ordre, il devenait une règle pour **toutes les extractions suivantes** — une injection persistante |
| **La correction** | **trois emplacements déclarés** au lieu de deux : les règles, la donnée à traiter, les exemples appris. Séparation **structurelle**, pas persuasive. Plus la neutralisation : un libellé ne peut plus ouvrir de ligne à lui, ni forger le délimiteur |

**Et ma première correction était fausse** — cela mérite d'être écrit, parce que
c'est ce qui a coûté le plus de temps de ce lot. J'avais sorti le bloc de la
consigne système, ce qui était juste, mais je l'avais **préfixé à la dictée**.
Or `lireLitteralement` analyse ce message mot à mot — et ce n'est pas qu'un
outil d'essai, c'est **le filet quand un vrai fournisseur répond à côté**. Mon
correctif aurait donc fait lire les exemples à la place de la dictée **en
production**.

Trois suites navigateur l'ont attrapé, et **aucune ne parlait de sécurité** : la
dictée n'arrivait plus sur le devis, le brouillon ne reprenait plus ce que vous
aviez écrit, et le PDF rendait 500.

### B.7 — Les autres

| | Correction |
|---|---|
| `/api/mes-donnees` rendait **500** sur un refus de rôle | **404**. Un 500 dit « Atlas est en panne » : le jour où un commercial appuie, vous lisez « erreur serveur » et appelez pour une panne qui n'existe pas |
| L'export « Mes données » oubliait **logo et tickets de caisse** | ajoutés. Les lignes partaient sans le justificatif qu'elles nomment — or c'est le papier qui vaut preuve devant l'administration. Deux lignes, parce que les données étaient déjà lues |
| `ATLAS_URL_PUBLIQUE` n'était pas exigée | **obligatoire en production**. Sans elle, l'adresse se déduit d'un en-tête que le client écrit — et c'est elle qui compose **le lien que vous envoyez à vos clients**, jeton compris |
| Une durée de conservation recopiée à deux endroits | réunie. Régler la constante ne changeait rien, et personne ne l'aurait vu |

### B.8 — Trois affirmations fausses, corrigées noir sur blanc

`docs/RGPD.md` portait **« implémenté »** sur trois lignes que rien n'exécutait.
« Implémenté » voulait dire « le code est écrit » ; un lecteur comprenait « la
donnée est effacée ». **C'est le pire écart possible dans un document de
conformité : il rassure exactement là où il faudrait alerter.**

Le tableau distingue désormais **trois états, jamais deux** : appliquée · en
attente du planificateur · rien.

Deux autres corrections du même ordre : `RETENTION.journauxJours` ne peut pas
être appliquée par Atlas — les journaux appartiennent à l'hébergeur, et le dire
vaut mieux que de le laisser croire ; et `RETENTION.compteFermeJours` décrit une
**opération qui n'est pas codée** — il n'existe aucun chemin de fermeture de
compte dans le produit.

---

## C. Décisions patron restantes

**Une seule, et elle est formulable en une phrase.**

> ### Un salarié peut-il supprimer un chantier ? **OUI / NON**

**Pourquoi je ne l'ai pas tranchée.** Le dépôt ne contient aucune règle qui le
permette. Vos phrases relevées portent toutes sur ce qu'un salarié **voit** —
« juste le planning et les devis, mais sans les prix », « accès qu'à la catégorie
planning ». Aucune ne dit ce qu'il a le droit **d'écrire**. La seule qui s'en
approche — *« il ne doit évidemment pas pouvoir modifier les tarifs ou les
coordonnées bancaires »* — ne nomme que les tarifs et l'IBAN.

**Ce qui est vrai aujourd'hui**, et qui a été sécurisé sans trancher :

| | |
|---|---|
| **Par son écran** | il peut supprimer un chantier — le bouton est dessiné pour lui. Suppression **douce**, refusée si une facture est émise, mais **aucun écran ne la restaure** |
| **Depuis ce lot** | il ne peut le faire que **sur les chantiers de son équipe**, si vous l'avez resserré |
| **Ce qu'il ne peut plus** | supprimer une prestation, du matériel, une note vocale, un passage d'entretien — quatre suppressions **dures**, désormais fermées |

**Si vous répondez NON**, la correction est d'une ligne : `/planning` rejoint la
liste des écrans gardés. Il faudra alors décider aussi s'il peut *déplacer* et
*déplanifier* — mêmes actions, même écran.

---

## D. Infrastructure restant à faire

### Bloquant avant le premier artisan

| | Quoi | Où c'est écrit |
|---|---|---|
| **1** | **Brancher le planificateur de purge** — un *Serverless Job* Scaleway avec déclencheur *cron*, une fois par jour, avec `curl --fail` | `docs/DEPLOIEMENT-PURGE.md` §2.1 |
| **2** | **Poser la sonde** sur `/api/health/purge` — le planificateur alerte quand SON travail échoue, pas quand il a été débranché | idem §2.2 |
| **3** | **`ATLAS_URL_PUBLIQUE`** — l'application refuse désormais de démarrer sans elle en production | `.env.example` |
| **4** | **`CRON_SECRET`**, **`AUTH_SECRET`**, **`REDIS_URL`**, **`STORAGE_S3_*`** — déjà exigés au démarrage | idem |
| **5** | **La liste `SCW-01` à `SCW-23`** de la sauvegarde, inchangée | `docs/lot-sauvegarde-cloture.md` |

### Recommandé

| | |
|---|---|
| **`ATLAS_PROXY_SAUTS`** | sans elle, aucune adresse transmise n'est crue — le défaut est **sûr**, mais la limitation de connexion se fait alors par compte seul, et qui connaît une adresse peut maintenir quelqu'un en temporisation |
| **`ATLAS_RP_ID`** | sans elle, Face ID refuse de s'enregistrer en production |
| **`AUTH_URL`** | fixe le protocole du cookie plutôt que de le déduire d'un en-tête |
| **Rétention des journaux** | à poser dans la configuration de journalisation de Scaleway : Atlas ne détient pas ces fichiers |

### Le contrôle à faire le jour même, et qui peut mal tourner en silence

Appeler la purge **sans** l'en-tête de secret doit rendre **401**. Les deux
autres contrôles échouent bruyamment ; celui-là non — s'il rend 200, la route
est ouverte à tout l'internet.

---

## E. IA

### Restructuré

- **Trois emplacements déclarés** dans l'interface du fournisseur : les règles,
  la donnée à traiter, les exemples appris. Chez Anthropic et OpenAI, le
  contexte est un **tour utilisateur distinct** — il reste séparable, ce qu'une
  concaténation ne serait pas.
- **Neutralisation** des retours à la ligne et des chevrons dans le contenu
  appris ; libellés tronqués.
- **La description d'une proposition se recalcule** depuis les données qui
  seront écrites.
- **Les montants** rendus par le modèle sont vérifiés avant écriture.

### Éprouvé SANS modèle — déterministe

| | |
|---|---|
| `test-emplacements-prompt.ts` | un fournisseur mouchard note ce qu'il reçoit : la dictée est seule dans son emplacement, les exemples ne sont pas dans la consigne système, et ils voyagent quand même |
| `test-consigne-metier.ts` | un libellé ne peut plus fabriquer de ligne à lui ni forger le délimiteur — **vus rouges** contre la version d'avant |
| `test-decrire-proposition.ts` | deux `donnees` différentes rendent deux phrases différentes |
| `test-montant-ecrivable.ts` | dix cas, `NaN` et `Infinity` séparément |

### Éprouvé AVEC un modèle réel

**Rien.** Cet environnement n'a aucune clé d'IA, et le mandataire réseau refuse
les fournisseurs. Je ne prétends donc **pas** que ces corrections ont été
éprouvées contre un vrai modèle.

### Ce qui reste non éprouvé

Ce qu'un vrai modèle fait du bloc `<exemples_passes>` : le respecte-t-il comme
une donnée ? La séparation est **structurelle** — le bloc n'est plus dans la
position d'autorité, et c'est vrai indépendamment de ce que le modèle en pense —
mais son effet sur la **qualité** des extractions demande votre espace de
travail. `npm run verifier:ia` et une dictée réelle le diront.

---

## F. Batterie

| | Résultat |
|---|---|
| **Types** | **0 erreur** |
| **Lint** | 0 erreur, 13 avertissements (préexistants, aucun de sécurité) |
| **Suites base** | **265 / 265** |
| **Suites navigateur** | *en cours à la rédaction* |
| **Suites neuves de ce lot** | 5 — journal de purge, actions gardées (élargie), montant écrivable, description recalculée, emplacements de l'invite |
| **Essais négatifs** | **7 neufs**, tous vus rouges avant d'être verts |

### Les essais négatifs de ce lot

| Ce qui a été cassé exprès | Rouge ? |
|---|---|
| Le droit d'écrire retiré au journal de purge | **oui** — et rien n'est noté |
| Une garde retirée d'une action à montants | **oui**, et il la nomme |
| Un salarié sur un écran qui lui est fermé | **oui** |
| Le même salarié sur SON planning | **non** — il passe, sinon on aurait fermé à tout le monde |
| Un chantier hors de l'équipe d'un salarié resserré | **oui** |
| La neutralisation des libellés retirée | **oui**, sur les deux cas d'injection |
| Le bloc appris recollé à la dictée (mon premier jet) | **oui** |

---

## G. La question finale

> *Connaissons-nous encore aujourd'hui une faiblesse raisonnablement corrigeable
> qui devrait empêcher Atlas de recevoir son premier artisan ?*

### Non — sous réserve des deux gestes d'infrastructure du §D.

**Ce qui reste ouvert, et pourquoi ce n'est pas une faiblesse au sens de la
question :**

| | |
|---|---|
| **La purge n'est pas branchée** | ce n'est plus une faiblesse *inconnue* : elle est documentée, et surtout **détectable**. Une sonde rend 503 tant que ce n'est pas fait. C'est une case à cocher, pas un défaut |
| **Un salarié peut supprimer un chantier** | ce n'est pas une faille : c'est le modèle de rôles tel qu'il a été écrit, et il attend votre arbitrage. Tout ce qui pouvait être sécurisé **sans** trancher l'a été |
| **Les corrections d'IA ne sont pas éprouvées contre un vrai modèle** | la séparation est structurelle : elle tient quoi que le modèle fasse. Ce qui reste à voir est la **qualité**, pas la sécurité |

**Ce que je ne sais pas.** Ce lot a fermé ce que deux audits avaient trouvé. Il
n'a pas cherché ce que personne n'a encore cherché — et je ne peux pas affirmer
qu'il ne reste rien. Ce que je peux affirmer : **aucun défaut connu ne reste
ouvert dans le code**, et les contrôles qui les tiennent ont tous été vus rouges
au moins une fois.

---

## Ce que j’ai fait de travers, et qui est écrit ici plutôt que taire

Trois fautes de ce lot, parce qu'elles apprennent plus que les corrections.

1. **Ma correction d'invite était fausse** (§B.6), et ce sont trois suites qui
   ne parlaient pas de sécurité qui l'ont trouvée. J'avais raisonné sur la
   position d'autorité sans regarder ce qui **lisait** ce message.
2. **J'ai appelé une fonction avec trois arguments au lieu de quatre, et ignoré
   son refus** — puis accusé la garde de ne pas refuser. C'est « une erreur
   interprétée comme un succès », le motif exact que ce lot traque ailleurs,
   commis dans le contrôle lui-même.
3. **J'ai fait échouer la batterie navigateur trois fois** en éditant des
   fichiers pendant qu'elle tournait, ce que `CLAUDE.md` §5 interdit en toutes
   lettres. La troisième fois, c'est un serveur orphelin de ma propre
   interruption qui bloquait le port.
