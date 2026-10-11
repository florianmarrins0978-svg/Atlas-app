# « Ah ouais mais j'ai pas vu votre facture »

**9 septembre 2026.** Document de retour : un verdict par point, ce qui a été
fait autrement, ce qui a été refusé, les chiffres, et ce qui reste.

---

## En cinq lignes

1. Une case **« J'ai bien reçu cette facture »** sur la page que reçoit le
   client. Elle ne bloque rien, et elle est **tout en bas**.
2. Atlas note **tout seul** l'ouverture du lien — c'est la date qui vaut,
   parce qu'elle ne dépend pas de la bonne volonté du client.
3. **Sa question a fait la moitié du lot** : *« en cas de litige, où est-ce que
   l'utilisateur va rechercher cette info ? »* — nulle part, jusqu'ici.
4. « J'ai vu » n'éteint plus que la **carte** ; les deux dates restent sur
   « Terminés › En attente de paiement ».
5. Ce qui a été **refusé** : obliger à cocher pour télécharger — et c'est lui
   qui l'a écarté, le jour même où il l'a proposé.

---

## 1. Ce qu'il a demandé, et ce qui a été livré

| Sa demande | Verdict | Le fichier |
|---|---|---|
| une case d'accusé de réception sur le lien de la facture | **fait** | `src/app/factures/[jeton]/AccuseDeReception.tsx` |
| qu'elle n'empêche pas le téléchargement | **fait** | rien ne conditionne le bouton ; la case est sous « Pour régler » |
| que le message parte au premier appui | **fait** | pas de second bouton « Envoyer » |
| une notification chez lui, effaçable d'un « vu » | **fait** | `src/app/Notifications.tsx`, carte « Facture reçue » + `marquerReceptionVueAction` |
| qu'Atlas note l'ouverture tout seul | **fait** | `noterOuvertureDeLaFacture`, appelée **par le navigateur** |
| **où retrouver l'info en cas de litige** | **fait** | `src/app/termines/tva/EnAttenteDePaiement.tsx`, sous la ligne de chaque facture |
| l'IBAN visible sur la page du client | **déjà fait** | `src/app/factures/[jeton]/page.tsx` — il s'affiche dès qu'il est réglé, et rien ne s'affiche sinon |

---

## 2. Ce qui a été refusé, et ce que ça aurait coûté

**Conditionner le téléchargement à la case.** Il l'a proposé, puis écarté
lui-même : *« mais ça ne l'empêche pas de télécharger la facture s'il ne coche
pas ! »*. Quatre raisons, dans l'ordre où elles pèsent :

1. **Une facture se DONNE.** La retenir tant que le client n'a pas signé quelque
   chose met l'artisan en tort, pas le client.
2. **Ça se retourne contre lui.** Le client ne coche pas, donc ne télécharge
   pas — et là il n'a vraiment pas reçu la facture. On perd exactement ce qu'on
   voulait gagner.
3. **Une confirmation arrachée ne vaut rien.** « On m'a obligé pour avoir ma
   facture » s'annule tout seul.
4. **C'est inutile** : Atlas note déjà l'ouverture.

> Je ne suis pas juriste. Sur ce point, ce document dit ce qui est **risqué** et
> pourquoi — l'arbitrage juridique reste à son comptable.

---

## 3. Deux dates, et elles ne se valent pas

| | Qui l'écrit | Ce qu'elle vaut |
|---|---|---|
| **Ouverte le…** | Atlas, tout seul | **la plus solide** : elle ne dépend pas de la bonne volonté du client |
| **Réception confirmée le…** | le client, en cochant | plus parlante, et facultative — elle peut ne jamais venir |

**Quand le client ne coche jamais**, la ligne dit quand même « Ouverte le
9 septembre à 14 h 12 » — ou « Pas encore ouverte », qui est précisément
l'information qu'on cherche quand quelqu'un prétend n'avoir rien reçu.

### La date d'ouverture part du NAVIGATEUR, jamais du serveur

**C'est le point technique qui compte, et il ne se voit pas à l'écran.** Une
messagerie qui déplie l'aperçu d'un lien, un antivirus qui le vérifie, un robot
d'indexation : tous demandent l'adresse, **aucun n'exécute de JavaScript**.
Notée pendant le rendu du serveur, la date aurait été celle d'une machine — donc
fausse le jour précis où elle sert de preuve.

**Et elle ne s'écrit qu'une fois** (garde en base, pas à l'écran) : sans cela,
chaque rechargement de la page aurait repoussé la date jusqu'à aujourd'hui, et
un client aurait pu la faire glisser lui-même.

---

## 4. Ce qui a été fait autrement que la maquette

| Sur la planche | Dans l'application | Pourquoi |
|---|---|---|
| un cadre à coins de 12 px | une **pastille arrondie** | sa règle du 12 août 2026 : la même forme pour tout ce qui s'appuie, tenue par `scripts/test-boutons-arrondis.ts` |
| un liseré doré sur les lignes neuves | rien | le doré ne servait qu'à **montrer ce qui s'ajoutait** sur la planche ; dans l'écran, c'est une ligne parmi les autres |
| la carte mène à « Voir la facture » | elle mène à **« Voir les factures qui attendent »** | c'est là que vivent les deux dates et le geste suivant. Une carte qui mène ailleurs que là où est la suite fait chercher — il l'avait relevé le 12 août |

---

## 5. Un pansement retiré au passage

`adresseClient` — celle qui écrit l'adresse du client sur une preuve — était
**recopiée à l'identique** dans `devis/[jeton]/actions.ts` et
`documents-legaux/actions.ts`. La réception en aurait fait une troisième copie.

Elle vit maintenant dans `src/lib/adresse-client.ts`, et **les deux copies ont
disparu**. Ce n'est pas du rangement : trois versions de « quelle adresse on
garde » seraient trois preuves qui ne se ressemblent pas, sur des documents
qu'on relit des mois plus tard.

---

## 6. Corrections noir sur blanc

**J'ai failli écrire une contre-vérité dans la migration.** Le premier jet
affirmait que le rôle applicatif n'avait pas le droit d'écrire sur
`envois_factures` depuis 2024, et donc que « corriger le canal d'un envoi » ne
pouvait pas fonctionner. **C'est faux** : `ALTER DEFAULT PRIVILEGES` du bootstrap
donne déjà ce droit à toute table créée ensuite. Vérifié sur la base avant de
l'écrire, pas après :

```
SELECT privilege_type FROM information_schema.role_table_grants
 WHERE grantee='atlas_app' AND table_name='envois_factures';
→ DELETE, INSERT, SELECT, UPDATE
```

**Et une heure perdue sur un défaut qui n'en était pas un.** La case ne
réagissait pas dans l'application : ni ouverture notée, ni confirmation. Ce
n'était pas le code — j'avais ouvert la page sur `127.0.0.1`, et Next refuse
alors de servir le JavaScript de la page. Le dépôt le documentait déjà
(`scripts/capturer-tva.ts`, payé le 3 septembre) ; je l'ai repayé.

---

## 7. Les chiffres

**Batterie complète, jouée le 9 septembre 2026 :**

| Étape | Résultat |
|---|---|
| Types | **vert** |
| Lint | **rouge**, et pas sur du code : `eslint` a buté sur `voir-planche.tmp.mjs`, un fichier temporaire créé puis effacé par une session voisine pendant le scan |
| Mémoire du dépôt | **vert** |
| Suites base | **320 / 333** |
| Suites navigateur | **110 / 134** |
| Connexion derrière un proxy | **vert** |

**DEUX ROUGES VENAIENT DE CE LOT. Les deux sont corrigés :**

1. `test-actions-gardees-db` — **un bon rouge, et il a fait son travail.** Mes
   deux actions publiques n'avaient aucune garde de rôle. C'est délibéré (le
   client de l'artisan n'a pas de compte), mais cela doit être **écrit avec sa
   raison** dans les exemptions, pas laissé au silence. Fait — et la suite est
   repassée verte, seule.
2. `test-facture-au-client-e2e` — il **exigeait le montant** sur la page du
   client, celui-là même qu'il a fait retirer le 8 septembre. Il rougissait donc
   sur une demande exaucée. Le contrôle a été adapté, jamais le libellé remis
   (`CLAUDE.md` §5 bis) : il vise maintenant le NUMÉRO de la facture, et vérifie
   **l'absence** du montant — il défend sa décision au lieu de la contredire.
   Rejoué seul : **1/1**.

**Les autres rouges ne viennent pas de ce lot**, et je le dis sans esquive :
`test-boutons-arrondis` désigne `src/app/planning/FinDeChantier.tsx` ;
`test-carte-reponse-mene-au-geste-e2e` échoue sur un bouton de calendrier qui
intercepte le clic ; `test-tva-multiple-e2e` sur l'appui long d'un devis. Aucun
de ces fichiers n'est touché ici. Le reste est de l'outillage déjà rouge sur
`HEAD` avant ce lot.

**Un premier lancement a été jeté.** Docker s'est arrêté dans les secondes qui
ont suivi : 85 erreurs de connexion, et un verdict qui n'accusait personne. C'est
lui qui a posé la question — *« t'as pas besoin de Docker ? »* — et elle a évité
de lire des chiffres faux.

Ce qui est acquis, suite par suite :

| | |
|---|---|
| `scripts/test-reception-facture-db.ts` | **12 / 12**, sous `atlas_app` |
| `scripts/test-reception-facture.ts` | **6 / 6** |
| `npx tsc --noEmit` | aucune erreur |
| `npm run lint` | 0 erreur |
| `npm run verifier:memoire` | cohérente |

**La suite sait échouer**, et sur le bon défaut : garde `IS NULL` retiré, elle
rougit sur « l'ouverture ne se réécrit pas » — et sur elle seule (11/12).

**Et elle est une suite BASE, pas navigateur.** Le client écrit sans session ;
les suites navigateur tournent sous un rôle qui traverse la RLS et ne peuvent
pas, par construction, voir un défaut d'isolation. C'est la leçon du 8 août
2026, où le lien de facture était mort en production pendant qu'une suite
navigateur restait verte.

**Les deux écrans ont été regardés**, pas seulement testés :
`scripts/capture-reception-facture.mts` (la page du client, avant et après
l'appui, et après rechargement) et `scripts/capture-trace-reception.mts` (les
trois états côte à côte sur « En attente de paiement », plus la carte).

---

## 8. Ce qui reste ouvert

| Point | Qui tranche |
|---|---|
| **Le mot exact de la case** — « J'ai bien reçu cette facture » ou sa formule, « Informer votre artisan de la bonne réception » | lui |
| **Faut-il la même ligne sur l'écran de la facture du chantier**, en plus de « En attente de paiement » | lui |
| **Prévenir sur le téléphone** (notifications) — cette confirmation est l'un des deux événements qui mériteraient de sonner, avec « devis accepté » | lot suivant, déjà cadré |
| **La valeur juridique** de la trace | son comptable |
