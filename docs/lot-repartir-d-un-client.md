# Repartir d'un client, et finir un chantier avec une preuve

*Lot ouvert le 8 septembre 2026. Ce document est à jour au **stade du code** :
les lots 1 et 2 sont écrits, éprouvés et livrés. Le lot 3 reste à ouvrir.*

*Sa page consultable vit dans `appli/`, jamais dans `docs/` : le site publié ne
sert que `appli/`. Posée ailleurs, elle n'a aucune adresse — payé le
8 septembre, un lien mort donné au patron. Régénérer avec
`node scripts/md-en-page.mjs docs/lot-repartir-d-un-client.md appli/lot-repartir-d-un-client.html`.*

---

## Ce qui a été fait, en six lignes

1. Le brief a été lu et confronté au code **avant** d'écrire quoi que ce soit —
   et **la première proposition du lot 1 a dû être refusée** : elle demandait
   exactement ce qu'il avait écarté le 17 août.
2. Depuis la fiche d'un client : **« Refaire »** recharge sa dernière prestation
   **aux tarifs d'aujourd'hui**, **« Autre chantier »** rouvre sa vraie fiche
   préremplie, avec ses anciennes photos à cocher.
3. La feuille de chantier s'appelle désormais **Fiche d'intervention**.
4. Dedans, un **bandeau déroulant « Fin de chantier »** : le salarié coche ce
   qu'il a fait, ajoute des photos, écrit un mot, appuie sur « C'est fini ».
5. Ce qu'il pose remonte dans **Terminés → Retours**, listé **par client**, avec
   un filtre en haut — et **ça se garde longtemps**.
6. **Sa confirmation ne bloque rien** : elle vaut preuve en plus, jamais
   permission.

---

## 1. Les deux questions posées avant de coder, et ses réponses

### A. La confirmation du client bloque-t-elle la facture ?

**Sa réponse :** *« oui, la confirmation du client ne bloque rien. Elle vaut
preuve en plus, jamais permission. Je ne veux pas attendre un clic qui ne
viendra pas. »*

**Pourquoi la question se posait.** Le brief demandait « le client dit oui, le
chantier est fini ». Trois choses du dépôt s'y opposaient :

| | Ce que le code ou ses décisions disent |
|---|---|
| **le client n'est pas là** | son constat du 16 août 2026, *« on tond pendant que le client est au travail »*, écrit en tête de `src/app/entretien/[jeton]/page.tsx`. C'est pour cela que la preuve est un horodatage et une empreinte, pas une signature |
| **deux arrêts, jamais trois** | `PRODUCT.md` : avant l'envoi du devis, avant le départ de la facture. Un troisième a été retiré parce qu'il ne pouvait mener qu'à « oui » |
| **sa trésorerie** | une facture suspendue à un clic que personne ne fera est une facture qui ne part pas |

### B. Le salarié peut-il déposer une preuve et clore un chantier ?

**Sa réponse :** *« oui, le salarié dépose photos et "c'est fini" sur les
chantiers de sa journée, et rien d'autre : aucun montant, ni devis, ni facture,
ni un chantier qui n'est pas le sien. Que le contrôle le prouve. »*

C'est la **première brèche** dans le modèle des rôles figé le 30 août 2026, qui
disait mot pour mot : *« aucun droit d'écriture ne lui a été rouvert »*
(`docs/modele-des-roles.md` §E). Elle est délibérée et bornée.

| Ce qu'il gagne | Ce qui ne bouge pas |
|---|---|
| déposer des photos sur un chantier de SA journée | `OUVERT_AU_SALARIE` ne s'élargit pas à `/chantiers/…` |
| poser « c'est fini », horodaté, à son nom | aucun montant ne sort du serveur pour lui — ni page, ni PDF, ni réponse d'API |
| | ni le devis, ni la facture, ni le chantier d'un autre |

Les deux réponses sont consignées dans `ARCHITECTURE.md` §285.

---

## 2. Point par point, le verdict sur le brief

| Point du brief | Verdict | Sur quoi il se fonde |
|---|---|---|
| « Le rapprochement de clients existe et il marche » | **juste** | `src/lib/rapprochement-client.ts`, appelé par `trouverOuCreerClient` (`clients.ts:46`) |
| « Depuis la fiche d'un client, aucun lien ne mène à un nouveau chantier » | **juste** | `src/app/clients/[id]/page.tsx` ne porte que les registres du dossier |
| « La feuille de chantier du salarié existe, en PDF, sans montants » | **juste** | `src/server/pdf/fiche-chantier-pdf.ts`, servie par `/api/chantiers/[id]/feuille/pdf` |
| « Le compte rendu au client existe, sans photos » | **juste** | `src/app/entretien/[jeton]/page.tsx` |
| « La validation du client entre en collision avec deux décisions » | **juste** | voir A ci-dessus |
| « Donner au salarié le droit d'écrire rouvre le modèle des rôles » | **juste** | `docs/modele-des-roles.md` §E |
| **Lot 1 · « Atlas le RECONNAÎT à l'écran et propose de le reprendre »** | **REFUSÉ, et il l'a confirmé** | voir §3 |
| Lot 1 · un chemin de la fiche client vers un chantier pour lui | **retenu, avec une réserve** | voir §3 |
| « L'intervention est rattachée au chantier, le chantier au client » | **juste pour un chantier, FAUX pour le compte rendu existant** | voir §4 |

---

## 3. Ce qui a été refusé, et ce que ça aurait coûté

### La proposition de client pendant la frappe

Le brief demandait : *« pendant qu'il tape un nom déjà connu, Atlas le
RECONNAÎT à l'écran et propose de le reprendre — avec ce qui le distingue (son
lieu, son nombre de chantiers), parce qu'il a quatre Martins »*.

**C'est exactement ce que le patron a écarté le 17 août 2026**, et c'est écrit
dans le code, pas dans un souvenir de conversation :

> *« Il a explicitement écarté qu'on lui propose une liste de correspondances
> ("non justement, il ne faut pas") : le rapprochement est automatique, sans
> geste de sa part. »*
> — `src/lib/rapprochement-client.ts`

**Ce qui a été fait à la place.** Atlas décide comme aujourd'hui, et se contente
de **dire** ce qu'il a fait, avec un moyen de séparer si c'est le mauvais. Le
patron a validé : *« tes trois remarques sont justes, et j'ai fait corriger le
prompt sur la première. »*

### La réserve sur la fiche client

Cet écran a été **délibérément vidé le 2 septembre 2026** — *« tout le reste, tu
enlèves, c'est du trop »*, sa quatrième plainte en dix jours sur le nombre de
mots. Le lot 1 y ajoute donc **un geste et aucun mot**. C'est la raison pour
laquelle les deux propositions D et E tiennent en un bouton.

---

## 4. Ce que le brief n'avait pas vu

### « Terminer un chantier » CRÉE la facture

`terminerChantier` (`src/server/repositories/factures.ts:172`) **crée la
facture**, et refuse même de le faire tant que le devis n'est pas parti. Ce
n'est pas un changement d'état : c'est l'entrée du cycle comptable.

Le « c'est fini » du salarié ne peut donc pas être ce geste-là. Il en faut deux,
et le patron l'a tranché : *« deux gestes séparés pour la fin de chantier : le
tien constate, le mien facture. »* Le besoin était déjà noté dans `TODO.md`
depuis le 30 août, pour le commercial ; il devient obligatoire.

### Le compte rendu par jeton n'est PAS rattaché à un chantier

Le brief avertissait : *« ne crée pas un troisième lien direct entre une
intervention et un client »*. L'avertissement est juste — **et le compte rendu
existant fait déjà exactement cela.**

`passages_entretien` (`src/server/db/schema.ts`) porte `client_id`, jamais
`chantier_id` : c'est l'outil des **tournées d'entretien**, pas la preuve de fin
d'un chantier. Le lot 3 devra soit l'y rattacher, soit donner au chantier sa
propre page de preuve.

*Remis au lot 3 par le patron, le 8 septembre.*

---

## 5. La planche du lot 1

**Adresse :**
`https://florianmarrins0978-svg.github.io/Atlas-app/le-client-quon-connait.html`

Cinq propositions, toutes essayables. Trois cas se touchent en haut de page — un
seul Martins, quatre Martins avec son numéro, « ce n'est pas lui » — et les cinq
écrans changent ensemble. Un bouton « Nuit » montre la charte sombre.

| | Proposition | Ce qu'elle fait |
|---|---|---|
| **A** | Le mot après | le chantier s'ouvre avec une ligne : « Rangé chez M. Martins · Saint-Marc · 3 chantiers » |
| **B** | La ligne pendant qu'il tape | sous la case du nom, une phrase qui ne demande rien |
| **C** | La fiche se remplit ✦ | le nom reconnu, Atlas pose ce qu'il sait déjà — téléphone, e-mail, adresse |
| **D** | Le bouton sous son nom | « Nouveau chantier » depuis la fiche du client |
| **E** | Refaire ce qu'on lui a fait ✦ | le chantier s'ouvre avec la **prestation** déjà écrite, pas seulement le nom |

✦ *ce que nous défendons.* C répond à sa plainte réelle — « je dois tout
retaper » — au moment précis où elle se forme. E répond à ce qu'il fait neuf
fois sur dix : la même prestation, chez le même client.

**D et E ne s'opposent pas** : E porte les deux gestes. Si E est retenu, D
disparaît.

---

## 6. Ce qui a été vérifié, et ce qui ne l'a pas été

| | |
|---|---|
| les cinq écrans tiennent en **390 × 664** sans rien couper | mesuré, et le contrôle a été **vu rouge** en forçant 400 px de trop |
| aucune flèche décorative | `scripts/test-aucune-fleche.ts` — 119 032 lignes lues |
| les couleurs sont celles du produit | lues en jouant `charte("origine")` et `charte("nuit")`, pas approchées à l'œil |
| **les polices n'ont PAS pu être vues ici** | le mandataire de ce poste refuse Google Fonts : les captures montrent les replis, pas Playfair Display. Sur son téléphone, elles se chargent |
| la batterie complète | **au stade des maquettes, non jouée et sans objet** : aucun fichier de `src/` n'était touché. Les chiffres du code sont au §11 |

### Deux défauts trouvés sur la CAPTURE, et par aucune mesure

C'est la sixième fois dans ce dépôt (`CLAUDE.md` §5), et les deux méritent
d'être écrits parce qu'ils sont du même genre : **un contrôle vert sur un écran
faux.**

1. **« Ce n'est pas lui » restait affiché sur une fiche neuve.** Le bouton porte
   `display:block`, qui l'emporte sur le `[hidden]{display:none}` du navigateur.
   La propriété `hidden` valait bien `true` — le contrôle la lisait, et rendait
   un vert. L'image, elle, montrait le bouton. Le contrôle mesure désormais ce
   qui se **voit**.
2. **La coche contredisait le texte.** Sous « Nouvelle fiche », le sceau portait
   une coche : elle se lit comme une confirmation de reprise, soit l'inverse de
   ce que la ligne annonce. Elle devient un « + ».

### Un contrôle qui ne mesurait rien

Le premier contrôle de débordement comparait `.ecran.scrollHeight` au cadre. Or
`.ecran` est une colonne flexible dont la hauteur vaut **toujours** celle du
cadre : il rendait 664 = 664 quoi qu'on y mette. Le débordement se voit sur
`.corps`. Corrigé, puis confronté à un débordement forcé pour le voir rougir.

---

## 7. Son choix, et la suite — 8 septembre 2026

**Il a retenu E** : *« il faut la E car si c'est un client déjà enregistré en
tant que client on ne va pas recréer une fiche client ! »*

### Sa deuxième option est écartée, et c'est lui qui l'avait tranchée

Il proposait qu'« Autre chantier » ouvre *« une autre page que l'on rajoute avec
la note vocale plus la possibilité d'ajouter des photos »*.

**Cette page existe déjà, et c'est la fiche client.** `FormulaireNouveauChantier.tsx`
porte `AnneauNoteVocale` **et** `Pellicule` depuis le 31 août 2026. La fiche du
chantier séparée, elle, a été supprimée le 4 septembre — sa décision prise deux
fois, dont le 1er septembre : *« toutes ces infos sont déjà sur cette page, ça
fait des doublons si on garde l'autre aussi. »* En ajouter une neuve, ce serait
la recréer.

**Sa crainte est infondée, et c'est une bonne nouvelle :** « Autre chantier » ne
recrée aucun client. `trouverOuCreerClient` réutilise la fiche existante ; ce qui
naît, c'est un **chantier** de plus accroché à elle.

### Les anciennes photos, et le point qu'il n'avait pas dit

Son idée est retenue telle quelle : les photos de la dernière fois s'affichent
éteintes, non cochées elles ne partent nulle part, cochées elles sont reprises.

**Ce qu'il faut ajouter, et qui n'est pas un détail :** une photo cochée doit
être **RECOPIÉE** sur le nouveau chantier, jamais partagée avec l'ancien.
`photos.chantier_id` rattache une photo à un seul chantier
(`src/server/db/schema.ts:809`) : partagée, elle disparaîtrait de la fiche
d'intervention du salarié le jour où l'ancien chantier est effacé.

### « Refaire » : tranché — **aux tarifs d'aujourd'hui**

**Non, pas l'ancien devis tel quel** — ce serait facturer aux prix de l'an
dernier, et c'est son argent. Sur l'exemple de la planche, l'identique coûtait
**28 € perdus sans les voir** sur la haie.

#### CE QUE JE LUI AI DIT ET QUI ÉTAIT FAUX

J'ai écrit qu'une ligne **dont le tarif a disparu reviendrait « à chiffrer »**.
**C'est faux, et il faut le lire avant de croire le reste.**

`lignes_prix` ne porte **aucun renvoi vers un tarif** : rien, en base, ne
distingue « son tarif a été supprimé » de « ce prix a été mis à la main ». Or il
en met à la main constamment. Rendre ces lignes vides aurait effacé des prix
justes, et l'aurait obligé à re-chiffrer un devis qui n'avait aucun problème.

**Ce qui a été codé à la place** (`src/lib/reprise-des-prix.ts`) — quatre sorts,
et un seul efface quelque chose :

| Le sort | Quand | Ce qui arrive au prix |
|---|---|---|
| `retarife` | un tarif du jour porte le même intitulé, à un autre prix | il prend le prix d'aujourd'hui, **l'ancien s'affiche barré** |
| `inchange` | le tarif existe, au même prix | rien |
| `prix-garde` | **aucun tarif ne correspond** | **le prix est gardé**, et signalé |
| `attend-son-prix` | la ligne était déjà `aChiffrer` | elle le reste |

La reconnaissance des intitulés réutilise `memeMot` (`src/lib/mots-catalogue.ts`)
plutôt qu'une seconde normalisation — deux façons de comparer deux mots
finiraient par diverger (`CLAUDE.md` §3).

**Planche :**
`https://florianmarrins0978-svg.github.io/Atlas-app/repartir-de-son-chantier.html`

---

## 8. Le lot 1, codé — « Refaire » et « Autre chantier »

| Ce qui a été écrit | Où |
|---|---|
| la règle pure de reprise des prix, sans base | `src/lib/reprise-des-prix.ts` |
| les deux boutons sur la fiche du client | `src/app/clients/[id]/RepartirDeCeClient.tsx` |
| « Refaire » : recopie le chantier, ses lignes et ses photos | `src/app/clients/[id]/actions.ts` |
| « Autre chantier » : rouvre la **vraie** fiche, préremplie | `src/app/chantiers/nouveau/page.tsx` (lit `?client=<id>`) |
| les anciennes photos, éteintes et cochables | `src/app/chantiers/nouveau/FormulaireNouveauChantier.tsx` |
| la recopie des photos, **fichier compris** | `src/server/repositories/photos.ts` — `recopierPhotos` |

**Deux choses que le code a dû trancher, et qui ne sont pas des détails :**

1. **Quand on part d'un client connu, aucun rapprochement n'est joué.**
   `CreerChantierInput.clientId` court-circuite `trouverOuCreerClient` : rejouer
   la reconnaissance sur un client qu'on vient de désigner, c'est lui offrir une
   chance de se tromper pour rien.
2. **Les lignes de prix se réinsèrent en série**, pas en parallèle : leur champ
   `ordre` est ce qui tient l'ordre du devis, et des insertions concurrentes le
   rendraient au hasard.

---

## 9. Le lot 2, codé — la fiche d'intervention et ses retours

### Ce qu'il a demandé, ligne par ligne

| Sa demande | Verdict | Le fichier |
|---|---|---|
| renommer la feuille en **Fiche d'intervention** | **fait** | `src/app/planning/PlanningClient.tsx` |
| un **bandeau déroulant** dedans : cocher, photo, écrire | **fait** | `src/app/planning/FinDeChantier.tsx` |
| une sous-catégorie **« Retours »** à côté d'« À facturer » | **fait** | `src/app/termines/ListeTermines.tsx` |
| une page qui les liste **par client**, filtre en haut | **fait** | `src/app/termines/retours/ListeDesRetours.tsx` |
| **« il faut pouvoir les garder longtemps »** | **fait** | aucune fenêtre de temps, et la photo est protégée de la purge (§10) |
| le patron décide si la preuve est demandée, et si la photo est exigée | **fait** | `src/app/reglages/equipe/FinDeChantierReglage.tsx` |

### « Que le contrôle le prouve » — trois gardes, pas une

Le salarié pose un retour sur les chantiers de **sa journée**, et rien d'autre.
Dans `src/app/planning/retour-actions.ts`, trois gardes **cumulatives** :

| La garde | Ce qu'elle arrête |
|---|---|
| `exigerEcran(ctx, "/planning")` | un rôle qui n'a pas cet écran |
| `peutPoserUnRetour(role)` | un rôle qui n'a pas le droit d'écrire |
| `exigerChantierDansSaPortee` | **un chantier qui n'est pas le sien** |

Et `scripts/test-acces-roles.ts` vérifie que cette écriture n'ouvre **rien
d'autre** : ni les montants, ni le planning complet, ni la facture, ni
`/termines`, ni `/chantiers/…/devis-complet`, ni `/chantiers/…/facture`.

### Trois décisions d'écran, et leur raison

| Ce qui a été fait | Pourquoi |
|---|---|
| les deux réglages partent **éteints** | les allumer d'office aurait bloqué, dès la mise à jour, un salarié dont le téléphone est mort à 18 h — sur un chantier, sans personne à qui demander |
| le second interrupteur **disparaît** quand le premier est éteint | un interrupteur grisé se touche quand même, et son silence se lit comme une panne |
| le refus s'affiche **avant** l'appui, pas après | « il manque une photo » sur un bouton déjà pressé se lit comme une panne du produit |

### SON RAISONNEMENT A BATTU LE MIEN

> *« vu que les chantiers, une fois la date d'intervention passée, finissent
> dans terminé, je risque de pas avoir le temps de tout voir ? »*

Je proposais de garder les retours **visibles dans le planning**. C'était faux :
un chantier terminé quitte le planning, et le retour serait parti avec lui. Sa
seconde option — **une catégorie à part** — est celle qui a été codée, et c'est
la seule qui tienne dans le temps.

---

## 10. CE QUE PERSONNE N'AVAIT VU : la photo qui disparaît

Une photo supprimée d'un chantier partait en **file de purge** : le fichier est
effacé du rangement, des mois plus tard, sur un écran que personne ne regardait
ce jour-là.

Une photo posée sur un retour d'intervention est une **preuve**. La purger, c'est
vider la preuve de son contenu — et le défaut ne se verrait qu'au moment où il
compte.

`supprimerPhoto` demande donc d'abord `photoTenueParUnRetour` : la ligne est
marquée supprimée, mais **la clé n'entre pas dans la file** si un retour la
tient. Éprouvé **dans les deux sens** — une photo de retour ne part pas, **et une
photo ordinaire part bien**. Sans ce second cas, une garde qui retiendrait tout
passerait au vert.

**Le même piège existait à l'autre bout**, pour « Autre chantier » : reprendre
une ancienne photo en **partageant son fichier** l'aurait fait disparaître du
nouveau chantier le jour où l'ancien est nettoyé. `recopierPhotos` relit l'objet
et le **réécrit** : les deux fichiers sont indépendants.

---

## 11. Les chiffres

**Suites propres à ces deux lots :**

| La suite | Ce qu'elle tient | Résultat |
|---|---|---|
| `scripts/test-retour-intervention.ts` | la règle pure : ce qui manque, ce qui autorise « C'est fini », le rangement par client, les années | **21 contrôles, 0 échec** |
| `scripts/test-retour-intervention-db.ts` | isolation entre entreprises, un seul retour par chantier, **la photo protégée dans les deux sens** | **6 contrôles, 0 échec** |
| `scripts/test-reprise-des-prix.ts` | reprendre un devis aux tarifs du jour | **16 contrôles, 0 échec** |
| `scripts/test-acces-roles.ts` | le salarié pose un retour, **et rien d'autre** | **3 contrôles neufs, 0 échec** |

**Et les contrôles savent rougir** : la règle de reprise des prix a été cassée
volontairement deux fois pour le vérifier, et la garde de purge est éprouvée par
un cas qui **doit** partir en purge.

**La batterie complète**, jouée en entier le 9 septembre 2026 :

| Étape | Résultat |
|---|---|
| Types | **vert** |
| Lint | **vert** — 0 erreur |
| Atelier | **vert** |
| Construction | **vert** |
| Mémoire du dépôt | **vert** — 8 fichiers vérifiés |
| Fournisseurs d'IA | **vert** |
| Suites base de données | **314 / 325** |
| Données de démonstration | **vert** |
| Suites navigateur | **115 / 133** |
| Connexion derrière un proxy | **vert** |

**Aucun des rouges n'appartient à ce lot**, et c'est vérifiable : les onze
rouges base sont d'infrastructure (des suites qui ouvrent des ports ou relancent
des serveurs, et se gênent entre elles) ou d'un lot voisin déjà sur `main`. Ils
sont nommés un par un dans `TODO.md`, avec ce qui reste à en faire.

### TROIS DÉFAUTS DE CE LOT, QUE LA BATTERIE A ATTRAPÉS

Aucun n'aurait été vu à la relecture, et les trois sont corrigés :

| Le défaut | Ce qu'il aurait coûté |
|---|---|
| **la sauvegarde RGPD ignorait les trois tables des retours** | un client qui demande ses données n'aurait pas reçu ce qu'on a constaté chez lui ; une base restaurée aurait rendu des chantiers sans preuve |
| `/termines/retours` manquait aux adresses refusées au commercial | l'adresse héritait bien du refus, mais **en silence** — le jour où l'on pose sous `/termines` une page qui ne doit PAS l'hériter, rien ne le dirait |
| ma suite de bout en bout réclamait « Refaire » sur un chantier **pas terminé** | elle éprouvait un cas que l'application ne produit pas |

### ET DEUX DÉFAUTS QUI N'ÉTAIENT PAS DE CE LOT

Corrigés quand même, parce qu'ils font perdre du temps à toutes les sessions :

1. **L'atelier ne migrait jamais une base déjà existante.** Une base créée avant
   une migration neuve restait périmée pour toujours : la batterie annonçait
   **222/325**, et une centaine de suites accusaient le code sur une colonne
   jamais posée. Le défaut se déguise en régression du lot en cours, et il se
   déplace — le rang de l'atelier change d'une session à l'autre. Confronté à la
   base fautive, le correctif a rattrapé **cinq migrations de retard**.
2. **Une suite réclamait le mot que vous aviez fait enlever** :
   `test-fiche-chantier-e2e` exigeait « compte rendu de passage » alors que la
   page du client s'appelle « retour d'intervention » depuis un renommage que
   vous aviez demandé. Deux rouges permanents sur du code juste.

---

## 12. Ce qui reste ouvert, et qui peut le trancher

| Ce qui reste | Qui |
|---|---|
| ~~quelle proposition pour le lot 1~~ | **tranché le 8 septembre : E** |
| ~~« Refaire » : tarifs d'aujourd'hui ou à l'identique~~ | **tranché : aux tarifs d'aujourd'hui** |
| ~~quelle proposition pour la partie 1 — A, B ou C~~ | **tranché le 9 septembre : C**, et codée (§14) |
| **la carte d'un retour ne mène nulle part** : elle montre, elle n'ouvre pas — pour ne pas dupliquer les règles d'accès du planning | **lui**, s'il veut y entrer |
| **aucune suite de bout en bout ne joue le chemin du salarié** : le jeu de démonstration n'a pas de compte salarié. C'est exactement le défaut du 28 août (`CLAUDE.md` §5 quater) | **nous** — il faut un salarié dans le jeu de démonstration |
| le compte rendu du lot 3 : rattacher `passages_entretien` au chantier, ou page propre | **nous**, au lot 3 |
| le lot 3 — ce que le client reçoit | **lui**, il l'a reporté |

---

## 13. Les planches, toutes en ligne

Sous `https://florianmarrins0978-svg.github.io/Atlas-app/` :

| La planche | Ce qu'elle montre |
|---|---|
| `le-client-quon-connait.html` | comment Atlas dit sous quel client il a rangé — **A, B ou C, sans réponse** |
| `repartir-de-son-chantier.html` | « Autre chantier » et « Refaire » |
| `fiche-d-intervention.html` | la feuille renommée, et où vont les retours |
| `fin-de-chantier.html` | trois façons de poser la fin de chantier |
| `termines-et-les-retours.html` | la vraie page Terminés, photographiée, et trois propositions |
| `parcours-fin-de-chantier.html` | le parcours cliquable, du salarié au patron |
| `retours-d-intervention.html` | la sous-catégorie et sa page, filtres compris |

---

## 14. La proposition C, codée — 9 septembre 2026

### Sa question, et la réponse qui a décidé du lot

> *« Lorsque je clique sur créer un devis j'écris Martins, il reconnaît et
> entre les infos de lui-même — mais il ne va donc pas me créer un deuxième
> client appelé Martins ? »*

**Non.** Atlas réunit les homonymes depuis le 17 août. Ce qui manquait n'était
pas la règle, c'était de la **voir** : rien à l'écran ne disait qu'il avait
reconnu quelqu'un, et vous croyiez devoir retaper un client connu.

C'est éprouvé en base, pas déduit : la suite crée deux chantiers sous le même
nom et vérifie qu'il n'existe **qu'une fiche**, et que les deux chantiers y sont
accrochés (`scripts/test-client-reconnu-e2e.ts`).

### Ce que vous voyez

| | |
|---|---|
| vous tapez un nom connu | un bandeau : **« Repris de sa fiche · Saint-Marc · 3 chantiers »** |
| les cases | téléphone, e-mail, adresse posés seuls — **les vides seulement**, jamais par-dessus ce que vous avez tapé |
| un seul geste | **« Ce n'est pas lui »**, qui retire ce qu'Atlas avait posé et **rien d'autre** |
| personne de reconnu | **rien du tout** — pas de « Nouveau client », qui serait du bruit à chaque frappe |

### CE QUI A DEMANDÉ LE PLUS DE SOIN : SE TAIRE

Le rapprochement tranche à l'enregistrement, quand tout est tapé, et il a le
droit de départager deux homonymes par le plus récent : au pire le chantier va
chez le mauvais Martins, et cela se répare.

**Pré-remplir est d'une autre nature.** On écrit le numéro d'un homme sur la
fiche d'un autre, à l'écran — et vous ne le relirez pas, puisque c'est justement
pour ne plus retaper que vous avez demandé cet écran. Le devis partirait au
mauvais numéro, et personne ne saurait d'où ça vient.

**Donc : quatre Martins et aucune coordonnée, Atlas ne pose rien.** Il attend le
numéro, qui tranche de lui-même. Le contrôle qui tient cette ligne a été **vu
rouge** en retirant le compte d'homonymes.

### « Ce n'est pas lui » : un mot, pas un geste d'écran

Vider les cases ne suffisait pas. Le nom restant seul, la règle du nom seul
retrouvait le même homme à la frappe suivante — Atlas aurait répondu « si, c'est
lui », puis aurait rangé le chantier chez celui qu'on venait d'écarter. Le refus
entre donc **dans la règle**, et voyage jusqu'à l'enregistrement.

### Trouvé à la capture, par aucune mesure

Le numéro repris sortait **collé** — `0679984514` —, la base le rangeant sans
espaces. Le seul chiffre illisible de l'écran, à côté de ceux tapés à la main.
C'est le **septième** défaut de ce dépôt sorti d'une image et d'aucun test vert.

### Le mot du bouton

*« La phrase Refaire, c'est pas bizarre ? »* — c'était juste : cela se lit comme
*recommencer parce que c'était raté*. C'est **« Dernier devis »**, avec la flèche
qui tourne.

*La réserve, noir sur blanc* : le mot peut se lire « ouvrir mon dernier devis »
alors qu'il en crée un neuf. L'icône porte le « de nouveau », et l'écran suivant
est un devis sans numéro — l'ambiguïté ne survit pas au premier usage.

### Les chiffres de ce lot

| La suite | Résultat |
|---|---|
| `test-rapprochement-client.ts` (la règle, sans base) | **14 contrôles, 0 échec** — dont celui des quatre Martins, vu rouge exprès |
| `test-client-reconnu-e2e.ts` (votre parcours, au navigateur) | **7 contrôles, 0 échec** |

---

*Tenu à jour à chaque avancée du lot. Un document périmé le ferait travailler
sur une version disparue.*
