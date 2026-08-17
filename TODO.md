# Prochaines tâches

Par ordre de priorité. Une tâche terminée se **barre** avec sa date plutôt que
de disparaître : savoir qu'elle a été traitée évite de la rouvrir.

Ce fichier porte le travail de **développement**. Ce qui bloque et n'avancera
pas en codant est dans `docs/A-FAIRE.md` — tenu pour le patron, dans son
langage, et rien n'y entre sans son accord.

---

## Bloqué par une décision du patron

Rien à coder tant que ces points ne sont pas tranchés. Ne pas les redécouvrir :
ils sont écrits, avec leur coût et leur propriétaire, dans `docs/A-FAIRE.md`.

| | Ce qui débloque | Ce que je fais alors |
|---|---|---|
| 1 | Deux fournisseurs d'IA retenus | **Le code n'attend plus rien pour Anthropic et OpenAI** depuis le 2026-08-06 : poser `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` suffit à brancher l'IA (`ARCHITECTURE.md` §26), et `npm run verifier:ia` dit l'état réel. Les quatre autres noms restent des coquilles vides : leur raccordement serait à écrire. Ce qui bloque n'est donc plus la technique mais le **contrat** — sans lui, seules des données inventées peuvent être dictées. Sans clé, la dictée est recopiée mot à mot (`src/server/ai/lecture-litterale.ts`) : elle va jusqu'au devis chiffré, mais elle ignore qu'un chêne mort s'abat et qu'une haie se taille |
| 2 | Contrat de sous-traitance rédigé | Remplacer les canevas sans valeur par les textes réels |
| 3 | Hébergement européen choisi | Déployer — **sans quoi personne ne peut se servir de l'application** |
| 4 | Société constituée, assurance souscrite | Rien côté code |
| 5 | ~~Fournisseur SMS et e-mail~~ — **tranché le 2026-08-04 : il n'y en aura pas** | Rien de bloqué. Le devis part de la messagerie du patron (`ARCHITECTURE.md` §13). Ne restent suspendus qu'aux conforts : relance automatique, accusé de réception, code SMS |
| 6 | Outil comptable choisi — le patron n'en a **aucun** au 2026-08-08 | Brancher son API : envoyer client, lignes, montants, taux et période, récupérer le numéro et le document émis. Quelques jours. **Rien à écrire avant le choix** — chaque outil a son API, ce serait du code à jeter. Ce qui n'est PAS en jeu : qu'Atlas n'émette pas légalement est définitif (`docs/AGENT.md` §6) |

---

## Ce que je peux faire seul

### 0 triquadragies. `test-facture-impayee-e2e` tombe SOUS CHARGE, pas seule

*Constaté le 16 août 2026 en jouant la batterie complète d'un autre lot.*

```
❌ « Plus tard » fait taire le rappel, et la date part en base
   rien n'est écrit en base : le geste n'a pas porté
```

**Elle passe au vert jouée seule**, immédiatement après. Ce n'est donc pas le
produit : c'est un geste dont on lit la trace en base **avant que l'action
serveur ait répondu** — sous quatre-vingt-onze suites, la réponse arrive plus
tard qu'à vide.

**C'est le même piège que celui payé le même jour sur `test-fiche-client-e2e`** :
attendre l'écran, ou un délai fixe, c'est mesurer ce qu'on vient de taper.
La parade y a été de **relire la base en boucle jusqu'à ce qu'elle ait reçu**,
plutôt que d'attendre un nombre de millisecondes.

**Ce lot appartient à la session qui a posé le rappel des impayés** (`228572a`).
Écrit ici pour qu'elle ne reparte pas de zéro, et pour que personne ne conclue
au hasard.


### 0 unquadragies. ~~Montrer ce que l'application sait déjà d'un client~~ — **CODÉE le 16 août 2026 (fiche B)**

**Sa question du 16 août 2026**, photo d'un « graphe de connaissances » à
l'appui : *« tu peux m'expliquer et me dire si ça peut me servir pour mon
appli ? »*

**La réponse a été NON, deux fois, et il faut la garder** pour ne pas la
reprendre : comme mémoire de travail, le dépôt la tient déjà (`CLAUDE.md`,
`HANDOVER.md`…), et un graphe à côté serait une seconde vérité ; comme fonction,
ses données sont déjà reliées dans une base SQL, qui répond mieux qu'un graphe.

**Ce qu'il restait à en prendre, et qu'il a demandé de dessiner :** l'application
SAIT qu'un client est venu quatre fois, qu'il a payé 2 460 € et en doit 740,
qu'on lui fait toujours de l'élagage — **et elle ne le montre nulle part.**

Planche : `docs/maquettes/66-ce-que-je-sais-du-client.html`, éprouvée par
`scripts/verifier-maquette-fiche-client.mjs`. **Rien n'est codé** (`CLAUDE.md`
§3 bis).

| | Ce que ça montre | Ce que ça coûte |
|---|---|---|
| **A** | un encart sous le nom du client, dans la fiche du chantier | le moins de tout : aucun écran neuf. Mais on ne peut pas chercher un client |
| **B** | une vraie fiche client, atteinte en touchant son nom | un écran de plus, sans toucher à la barre du bas |
| **C** | un onglet « Clients » : la liste + la fiche | **un cinquième onglet**, et deux écrans au lieu d'un. Le seul qui réponde à « qui me doit de l'argent ? » |

**IL N'EXISTE AUCUN ÉCRAN CLIENT AUJOURD'HUI** — vérifié : quatre onglets, et le
nom d'un client ne mène nulle part. `listerClients` existe dans le dépôt et
n'est appelé par aucun écran.

**Tout est calculable, rien n'est à inventer** : `chantiers.client_id`,
`factures` + `paiements_facture`, `lignes_prix` pour les prestations qui
reviennent, `lecons_prix` pour les prix pratiqués.

**Livré** : `src/lib/fiche-client.ts`, `src/server/repositories/fiche-client.ts`,
`src/app/clients/[id]/page.tsx`, atteinte depuis le tiroir de la fiche du
chantier. Les deux chiffres sont montrés — facturé, et reste dû. Détail :
`ARCHITECTURE.md` §119.

---

### 0 duoquadragies. ⚠ UN CLIENT N'EST JAMAIS RÉUTILISÉ — et ça vide la fiche

**Trouvé le 16 août 2026 en éprouvant la fiche client, et c'est le point qui
décide de son utilité.**

`creerClient` **insère toujours**. Il n'est appelé que depuis la création d'un
chantier, et `listerClients` n'est appelé par **aucun écran**. Deux chantiers
pour « M. Bernard » créent donc **deux clients distincts** — et sa fiche
affichera « 1 chantier » à chaque fois, pour toujours.

**La fiche est juste ; c'est sa matière qui manque.** « Vous l'avez vu 4 fois »
ne se produira jamais tant que ceci n'est pas réglé.

**CE N'EST PAS UNE CORRECTION TECHNIQUE, C'EST UNE DÉCISION DU PATRON.**
Rapprocher deux clients sur leur nom fusionnerait deux personnes réellement
homonymes — deux « M. Martin » d'un même village — et **rien ne permettrait de
défaire** ce mélange. Trois chemins possibles, à lui soumettre sur planche :

| | Ce que ça fait | Ce que ça risque |
|---|---|---|
| **Proposer** | à la saisie du nom, l'application montre les clients connus qui ressemblent, et il choisit | rien : c'est lui qui tranche, chantier par chantier |
| **Rapprocher seul** | même nom + même téléphone → même client | deux homonymes qui partagent un numéro d'entreprise se mélangeraient |
| **Fusionner après coup** | un geste « c'est le même client » sur la fiche | il faut le faire, donc il ne le fera pas toujours |

**À dessiner avant de coder** (`CLAUDE.md` §3 bis). Le premier chemin est le
seul qui n'invente rien — mais c'est à lui de le dire.

### 0 quadragies. ~~Le rappel « facture impayée »~~ — CODÉ le 16 août 2026

*Dessiné (`maquettes/atlas-rappel-facture-impayee.html`, cinq écrans), tranché,
puis codé le même jour : « oui c'est bon, code le ».*

Ce qu'il demandait est en place : le **« A plus B »** (échéance = envoi + le
délai de paiement réglé, ou le jour de l'envoi sinon), le **reste dû** avec son
total quand un acompte est arrivé, l'extinction **automatique** dès que le
règlement est enregistré, et les **trois rythmes** en pastilles avec « Plus
tard » pour seul moteur.

Migration `drizzle/0050_rappel_facture_impayee.sql`, règles pures dans
`src/lib/rappels.ts`, `ARCHITECTURE.md` §118. Éprouvé par `test-rappels.ts`,
`test-rappels-db.ts` et `test-facture-impayee-e2e.ts`, photographié par
`scripts/capture-facture-impayee.mts`.

**Ce que ce lot apprend, et qui vaut au-delà de lui :**

- la date de report vit sur le **chantier**, pas sur la facture —
  `trg_facture_immuable` refuse toute écriture sur une facture émise, et
  l'affaiblir pour une commodité d'écran aurait été le contournement que
  `CLAUDE.md` §4 interdit ;
- **la valeur d'un `<input>` ne figure PAS dans `innerText`.** Un contrôle qui
  cherchait « 1 jours » dans le texte de la page ne pouvait jamais le trouver :
  vert sur l'écran fautif, il ne mesurait rien. Cinquième fois que ce dépôt paie
  un contrôle qui mesure zéro ;
- **une capture ment aussi.** `fullPage` a photographié le milieu du cadre qui
  défile, sans une seule carte, pendant que le contrôle lisait le DOM et se
  déclarait vert. Et un montage écrit `WHERE id = NULL` sans se plaindre :
  vérifier le `rowCount` de toute écriture de montage.

### 0 trigies ter. `test-reduction-devis-e2e` rougit sous charge, pas toute seule

**Vu le 16 août 2026**, sur la batterie qui suivait la fusion de son lot. Le
dernier de ses six cas — *« elle se retire, et le devis revient à son prix
plein »* — a lu **870,00 €** là où il attendait **1 044,00 €**, et « après
remise » était encore à l'écran.

**Mesuré, pas supposé :** rejouée seule dans la foulée, sur le même code et la
même base, la suite passe ses six cas. Ce n'est donc pas une règle fausse.

**Le mécanisme, lisible dans la suite elle-même** (`scripts/test-reduction-devis-e2e.ts`,
vers la ligne 156) : elle vide le champ, appuie sur Tab, attend **une seconde
fixe**, puis **recharge**. L'enregistrement part au serveur pendant cette
seconde ; sous une batterie de quatre-vingt-dix suites, il ne l'a pas toujours
finie, et le rechargement rend la page d'avant. C'est la même famille que
`test-devis-parti-signet` juste en dessous : un délai fixe qui suffit à vide et
plus sous charge.

**Ce qu'il faudrait, et c'est à la session qui tient ce lot :** attendre la
RÉPONSE de l'enregistrement plutôt qu'une seconde — c'est ce qui a réparé
`test-unite-tarif-e2e` le 16 août. Un délai plus long ne ferait que déplacer le
seuil.

**Ce lot-ci n'y touche pas**, et il faut le dire : le rappel d'impayé ne passe
nulle part près des totaux d'un devis. Corriger la suite d'un autre à sa place
ferait deux sessions écrivant le même fichier au même moment.

### 0 septvicies. La fiche d'entretien — **TOUT EST TRANCHÉ**, reste à coder

**Ses décisions des 16 août 2026**, toutes prises sur maquettes :

| Question | Sa réponse |
|---|---|
| Le geste sur le chantier | **B** — rangée par familles, avec le compte « 1/4 » |
| Ce que voit le client | **B** — seulement ce qui a été fait |
| Le temps passé | une **molette**, pas un clavier — et **la A**, celle du téléphone |
| Où la fiche se compose | dans les **Réglages**, « Ma fiche d'entretien » |
| Une fiche ou plusieurs | **UN SEUL MODÈLE**, pré-rempli à chaque envoi |

**Ses mots sur la dernière, qui valent mieux qu'un résumé :** *« ça sera un
modèle à chaque fois qu'on pré-remplira et qu'on enverra aux clients. Donc au
final, chaque client aura sa fiche parce que ça ne sera jamais la même — d'un
client à un autre on ne fait pas la même prestation — mais il n'y aura qu'une
seule fiche. »*

**LA LECTURE RETENUE, ET ELLE EST À CONFIRMER D'UN MOT.** Rien n'est rangé par
client : à chaque passage, la fiche part du modèle, s'ajuste, et devient celle
de ce client. Mais le second passage chez le même client doit retrouver son
ajustement — sinon il le referait douze fois par an. **Le pré-remplissage se
fait donc d'après SON DERNIER PASSAGE**, le modèle ne servant que la première
fois. C'est ainsi que ce sera codé sauf mot contraire.

**PAS DE SIGNATURE — décidé le 16 août 2026, et à ne pas rouvrir par bonne
volonté.** Sur SA capture de l'autre application, les deux signatures étaient
« Non signé ». Le client est absent onze fois sur douze : il travaille pendant
qu'on entretient son jardin. Un champ vide fait passer chaque rapport pour un
document inachevé, et la capture au doigt coûtait une journée (zone de dessin,
stockage, écran verrouillé quand il tend son téléphone, conservation RGPD,
survie hors réseau) pour un geste fait une fois sur vingt.

**Ce qui prouve le passage à leur place, et qui existe déjà** : la date, l'heure,
le temps passé, et l'EMPREINTE du contenu exact (`empreinteDevis`, le mécanisme
de l'acceptation d'un devis). À prévoir en plus : un bouton **« J'ai bien reçu »**
sur la page du client — un accusé horodaté, pas une signature.

**L'ENVOI : exactement celui du devis.** Sa confirmation du 16 août. Attention au
mot « automatique » : **rien ne part tout seul**, et ce n'est pas une limite
technique — c'est sa décision du 3 août (`docs/A-FAIRE.md` §5). Atlas prépare le
message avec le lien, ouvre SA messagerie, et c'est lui qui appuie. Un envoi
réellement automatique demanderait un prestataire sous contrat.

**Les invariants posés, à ne pas rouvrir :**

- **un rapport déjà envoyé ne change plus JAMAIS** quand le modèle change : il
  est signé et parti chez le client. C'est l'erreur qui ne se rattrape pas ;
- le retrait d'une ligne est **réversible** (règle du 10 août) ;
- ce qui n'est pas coché **n'est pas une faute** — aucun rouge ;
- « Vrai »/« Faux » ne sortent jamais vers le client ;
- l'envoi emprunte le chemin qui porte déjà devis et factures.

**L'ordre de construction, quand ça démarre** — c'est un troisième parcours, pas
une case à ajouter :

1. le **modèle** et son écran de Réglages (rien d'autre n'a de sens sans lui) ;
2. le **passage** : la fiche pré-remplie, cochée, le temps à la molette ;
3. le **rapport** : la page publique, le PDF, l'envoi — en réemployant ce qui
   porte déjà devis et factures ;
4. ~~les signatures~~ — **RETIRÉES le 16 août 2026**, voir ci-dessous.

Planches : `docs/maquettes/62-la-fiche-dentretien.html`,
`63-le-rapport-au-client.html`, `64-composer-sa-fiche.html`,
`65-choisir-l-heure.html`.

### 0 trigies bis. `test-devis-parti-signet` a rougi une fois sur deux batteries — instable sous charge

**Vu le 16 août 2026**, sur une batterie complète : la suite attendait le total
« 840,00 € » et a **dépassé son délai**. Ce n'est donc pas une valeur fausse —
les contrôles qui la précèdent dans la même suite étaient verts, et le numéro du
devis était bien affiché.

**Ce qui a été éliminé, mesuré et non supposé :**

- elle **passe seule** ;
- elle **passe enchaînée derrière `test-devis-complet`**, qui écrit un taux de
  TVA à 10 % — le premier soupçon, puisque 700 € HT font 840 € à 20 % et 770 € à
  10 % ;
- la batterie complète rejouée juste après : **86/86**, le rouge ne revient pas.

**Ce que ça laisse :** un écran lent à rendre pendant qu'une batterie occupe la
machine. Le `waitForSelector` de cette assertion n'a pas de délai propre, là où
ses voisines en portent un de 20 s.

**À faire, et ce n'est pas urgent :** lui donner un délai explicite, comme ses
voisines. Ne PAS la déclarer instable en la retirant — un contrôle qu'on
neutralise est un contrôle perdu, et celui-ci tient la pièce maîtresse d'un
écran que le patron a dessiné lui-même.


### 0 septvicies. La fiche d'entretien — **DEUX MAQUETTES POSÉES, sa décision attendue**

**Sa réponse du 16 août 2026 : « B et B »**, plus deux ajouts.

| Tranché | Ce qu'il a choisi |
|---|---|
| Le geste sur le chantier | **B** — rangée par familles, avec le compte « 1/4 » |
| Ce que voit le client | **B** — seulement ce qui a été fait |
| Le temps passé | **une molette**, pas un clavier (`65-choisir-l-heure.html`) — trois gestes proposés, le mien recommandé est la molette Atlas |
| Où se compose la fiche | dans les **Réglages**, « Ma fiche d'entretien » — modèle fourni, modifiable |

**Deux choses restent à trancher, et aucune n'est du rangement :**

**a) La molette** — la native du téléphone (gratuite, ressemble à un
formulaire), les quarts d'heure (un appui, mais imprécise), ou la molette Atlas
(la seule qui ressemble à l'application ; compter une demi-journée, accessibilité
comprise). Recommandation écrite dans la planche : la molette Atlas.

**b) CE QUI RESTE À TRANCHER, et ce n'est pas du rangement** (planche
`docs/maquettes/64-composer-sa-fiche.html`) :

> **Une seule fiche pour tous ses clients, ou un modèle puis une fiche par
> client ?**

Une fiche unique se tient en un endroit, mais chaque client voit les vingt
lignes — y compris celles qu'il ne paie pas, et c'est le chantier qui les fait
défiler. Une fiche par client est ce que le contrat décrit vraiment, au prix
d'un geste de plus à la signature.

**Ce qui n'est pas à trancher, et qui est déjà écrit dans les planches :**

- **un rapport déjà envoyé ne change plus jamais** — retirer une ligne du modèle
  en octobre ne touche pas aux rapports de juillet, qui sont signés et partis.
  C'est l'erreur qui ne se rattrape pas ;
- le retrait d'une ligne est **réversible** (règle du 10 août) ;
- la liste vient du contrat, ce qui n'est pas coché n'est pas une faute, et
  l'envoi emprunte le chemin qui porte déjà devis et factures.

**Ce que ce parcours suppose, s'il est retenu** : un contrat (la liste due), des
passages récurrents, un rapport par passage. C'est un troisième parcours à côté
du devis → facture, pas une case à ajouter.


### 0 quadragies bis. ~~La fiche du banc se figeait quand le veilleur travaillait~~ — **CORRIGÉ le 16 août 2026**

Trouvé en cherchant pourquoi il n'arrivait plus à ouvrir l'application. La
publication vivait dans la boucle de surveillance, qui s'arrête d'avancer dès
qu'elle appelle `npm run banc`. Elle vit désormais à côté
(`scripts/test-fiche-pendant-relance.ts`, qui sait rougir).

**Ce qui RESTE à faire, et qui n'est pas corrigé :** on ne sait toujours pas
pourquoi son serveur ne répondait pas le 16 août à 17 h 06. La fiche s'est tue
avant de le dire. **Ne pas écrire que cette panne-là est réparée** — seul
l'aveuglement l'est. Si elle revient, la fiche saura enfin la raconter.

**Le correctif est CONFIRMÉ sur sa machine :** fiche du 16 août 18 h 32,
« Écrite : par le veilleur, au quart d'heure » — la première publication
périodique jamais observée chez lui.

### 0 quadragies quater. POURQUOI sa construction échoue — la vraie question, ouverte

**Sa plainte du 16 août 2026 au soir :** *« l'appli, elle est vraiment très
lente, mais vraiment, vraiment très lente. Est-ce qu'il y a un moyen de la
rendre juste utilisable ? »*

**Ce qu'on sait, et c'est une déduction, pas une hypothèse.** La fiche lit le
témoin `.next-batie/atlas-version-batie.txt`, écrit **dès que `next build` rend
0**, avant même la bascule. Ce témoin n'existe pas chez lui. Donc sa
construction **échoue**, à chaque démarrage — et le banc retombe pour toujours
sur le mode développement, où chaque écran se compile à l'ouverture.

La même construction **réussit ici en deux minutes**, sur son commit exact
(`67b4d8e`). C'est donc son environnement, pas le code.

**Les deux suspects, et pourquoi on ne les a pas départagés :** le disque et la
mémoire. Un `next build` pendant qu'un serveur de développement sert déjà, avec
PostgreSQL et Redis à côté, sur une machine à deux cœurs. Ni l'un ni l'autre
n'était publié — c'est corrigé (voir `CHANGELOG.md` du 16 août), mais le relevé
n'arrivera **qu'au prochain démarrage de son espace**.

**La marche à suivre, dès que sa fiche republie :**

1. lire « Code SERVI » — si elle dit « la construction a ÉCHOUÉ », le bloc
   « Au moment de l'échec » donne le disque et la mémoire à cette seconde-là ;
2. disque saturé → nettoyer avant de bâtir, en épargnant `.next` que le serveur
   de développement utilise pour servir pendant ce temps ;
3. mémoire épuisée → plafonner le tas de la construction, ou ne pas bâtir
   pendant qu'un serveur sert. **Ne pas choisir la valeur au hasard** : c'est
   ainsi qu'on livre une réparation imaginée (`AGENTS.md`).

**Ne PAS écrire que la lenteur est corrigée.** Elle ne l'est pas. Seul
l'aveuglement l'est, et c'est la troisième fois en deux jours que la distinction
compte.

### 0 quadragies ter. Une PAGE BLANCHE sur son banc n'est presque jamais une panne

**Payé le 16 août 2026 au soir.** Il redémarre, l'application s'ouvre sur du
blanc, il écrit « corrige-moi ça ». Rien n'était cassé : la page de connexion
s'affichait parfaitement sur son commit exact, et la construction réussissait.

**Ce qui se passait vraiment**, et la fiche le disait en une ligne :

    Code SERVI : aucune version bâtie — le banc sert le mode développement

Tant que `.next-batie` n'existe pas, chaque écran se compile **à l'ouverture**
— 30 à 100 secondes (`scripts/banc.mjs`) — et le mandataire de GitHub renonce au
bout d'une minute. Le blanc est cet intervalle, rien d'autre. Il se dissipe seul
dès que la construction retombe, ou en rechargeant une minute plus tard : la
compilation continue côté serveur même quand le navigateur a renoncé.

**Donc, devant « page blanche » : lire la ligne « Code SERVI » AVANT tout.**
« aucune version bâtie » + « serveur : répond » = il est dans la fenêtre de
construction, il n'y a rien à réparer. Chercher un défaut de produit là-dedans,
c'est ce qui a consommé la soirée.

**Ce qui reste à faire, et qui n'est pas fait :** pendant cette fenêtre, il n'a
aucun moyen de savoir qu'il doit attendre — il voit du blanc, comme devant une
panne. Une page d'attente qui dirait « Atlas se prépare, deux minutes » vaudrait
mieux que le blanc. **À dessiner avant de coder** (`CLAUDE.md` §3 bis) et à lui
montrer : ce n'est pas à nous de décider qu'il veut un écran de plus.

### 0 quadragies. ~~La réduction accordée au client~~ — **CODÉE le 16 août 2026 (B + « Prix accordé au client »)**

**Sa demande du 16 août 2026 :** *« si jamais un client me demande une
réduction, [pouvoir] lui demander "fais cinq pour cent sur le montant du devis"
et il ajoute une petite ligne réduction ou prix accordé au client — cinq pour
cent, ou dix, ou quinze. C'est moi qui choisis le nombre de pourcentage. »*

**Rien de tel n'existe dans le produit** : aucune remise, nulle part — vérifié.

**Son choix : « sous le total et prix accordé au client »** — l'arrangement B,
le plus cher des trois, choisi en connaissance de cause. Livré :
`src/lib/reduction-devis.ts`, migration 0048, les deux PDF, l'écran du devis, et
une sixième retouche dictée. Détail : `ARCHITECTURE.md` §116.

**CE QUI RESTE, et qui n'est pas rien :**

1. **Le geste n'a pas été parcouru à la VOIX**, faute de service de
   transcription et de modèle ici — comme tout le micro du devis (§0 trigies).
   Ce qui est éprouvé : la règle, le PDF, le parcours devis → facture → relevé
   de TVA, et l'écran. Le raccord voix → réduction, non.
2. **Ses deux questions de la planche restent sans réponse**, et ne bloquent
   rien : un **montant** au lieu d'un pourcentage (« fais-moi 50 € »), et si la
   remise doit aussi apparaître sur la **facture PDF** autrement que par ses
   totaux — aujourd'hui elle y est, au même endroit que sur le devis.
3. **La ligne « + Prix accordé au client » n'a pas été demandée.** Elle a été
   ajoutée parce que sans elle une remise dictée par erreur ne se retirerait
   pas, et qu'une installation sans clé d'IA ne saurait pas en poser. À retirer
   s'il n'en veut pas.

| | Où elle se pose | Ce que ça coûte |
|---|---|---|
| **A** | une ligne du tableau, montant négatif | **presque rien** : une ligne voyage seule jusqu'à la facture, au relevé de TVA et à l'export comptable — tout ce chemin est déjà bâti pour les lignes |
| **B** | un bloc sous le total, avec « HT après remise » | **une colonne de plus** dans le devis, la facture, et tout ce qui les recopie. Chaque endroit oublié est un montant faux |
| **C** | le prix barré à côté du nouveau | même coût que B, et le vocabulaire de la promotion sur un document qui engage |

Et un second choix, indépendant : le **mot** — « Réduction » ou « Prix accordé
au client ». Il a proposé les deux.

**CE QUI N'EST PAS À CHOISIR, et qui ne se rouvre pas :**

- **la réduction s'applique sur le HT, la TVA se calcule après.** Sur le TTC,
  elle rendrait une TVA fausse sur un document qui finit dans une déclaration ;
- **elle suit jusqu'à la facture** (`factures.ts` recopie lignes et totaux du
  devis). Accordée sur le devis et absente de la facture, elle ferait payer au
  client le prix qu'on venait de lui retirer ;
- **aucun taux « habituel » ne s'invente** : 5, 10, 15, c'est lui qui le dit.

**Deux questions posées dans la planche, sans réponse et qui ne bloquent pas :**
un **montant** au lieu d'un pourcentage (« fais-moi 50 € ») — pas dans sa
demande, donc pas ajouté ; et un **bouton** sur l'écran du devis en plus de la
voix.


### 0 novivicies. ~~Le devis qui tarde~~ — **CODÉ le 16 août 2026 (B, 4 jours, « Chantier sans devis »)**

*Planche : `docs/maquettes/56-le-devis-qui-tarde.html`. Code : `src/lib/rappels.ts`,
`src/server/repositories/rappels.ts`, `src/app/reglages/notifications/`,
`src/app/Notifications.tsx`, migration `drizzle/0046_rappel_chantier_sans_devis.sql`.
Détail et raisons : `ARCHITECTURE.md` §112.*

**Sa demande du 14 août :** *« un rappel lorsque le chantier a été ouvert mais le
devis n'a pas été envoyé […] comme la Mme Félicie, vue il y a quatorze jours,
aucun devis envoyé »*. **Ses quatre décisions, toutes appliquées :** *« la B et
4 »*, *« le G »*, *« le B »* (le ton, reposé capture à l'appui), *« fait la B »*
(le rang).

**LA PLACE GARANTIE : TRANCHÉE ET CODÉE** (16 août, *« ok alors fait le »*,
après deux photos). Les rappels passant devant, cinq d'entre eux masquaient
toutes les réponses de clients — la batterie l'avait dit en rougissant avant que
l'image ne le montre. Son choix B tient : la **première** place reste au rappel,
c'est la **dernière place visible** qui revient à une réponse, et seulement s'il
en existe. Règle pure dans `src/lib/ordre-notifications.ts`, éprouvée sur les cas
limites et sur les 108 combinaisons — aucune carte perdue ni dupliquée.

**Plus aucun point n'attend son avis sur ce lot.**

**Trois leçons de ce lot, à ne pas repayer :**

1. **Chercher ce qui existe AVANT de dessiner.** La planche a décrit deux fois un
   monde disparu — un écran déjà dessiné le 13, un délai déjà codé le 14. Les
   planches de l'application vivent dans `maquettes/`, celles des décisions dans
   `docs/maquettes/`, et le code est un troisième endroit.
2. **Une confusion entre deux libellés n'existe qu'en contexte.** Montrer une
   ligne seule ne prouve rien : c'est côte à côte avec sa VOISINE qu'elle se
   juge. D'où la règle tenue par `test-devis-qui-tarde-e2e` — deux réglages
   voisins ne commencent pas par le même mot —, plus étroite qu'un « toutes les
   paires » qui refuserait un choix qu'il a fait en connaissance de cause.
3. **Photographier plutôt que décrire, et sur la BONNE scène.** Deux
   descriptions que je lui avais données étaient fausses, et l'image l'a dit :
   sa carte ne passe derrière qu'à partir de DEUX réponses en attente, et
   « montrer trois cartes » met la troisième sous le bord de l'écran.
   `scripts/capture-rang-trois-cas.sh` monte la scène minimale et rend le code
   même en cas d'échec.

### 0 novovicies. ~~La TVA au PAIEMENT~~ — **CODÉE le 16 août 2026**

*Fait : `ARCHITECTURE.md` §111. Ce qui suit reste pour mémoire du raisonnement.*

**Ce qui reste, et qui n'est pas technique :** confirmer son régime auprès de son
comptable (`docs/A-FAIRE.md` §12). Le défaut posé est `encaissements`, celui de
la loi ; s'il a opté pour les débits, un appui suffit à le rétablir.

**Ce qui reste à coder :** le rapprochement bancaire qu'il a choisi
(`docs/A-FAIRE.md` §13) — il attend un prestataire agréé, donc un contrat.

#### Le raisonnement d'origine

*`maquettes/atlas-tva-au-paiement.html`, le 14 août 2026 — deux écrans, 28
contrôles. Sa question : `docs/QUESTIONS.md` §20.*

**Ce que ça corrige, et ce n'est pas un confort.** `releveTvaCollectee` prend
toutes les factures `emise` à leur **date d'émission**. Pour une prestation de
services, la TVA est exigible **à l'encaissement** (CGI art. 269-2-c) ; les
débits sont une **option** qu'il n'a probablement jamais demandée. L'application
lui fait donc avancer la TVA d'un client qui n'a pas payé.

**Ce qui se code dès qu'il a la réponse de son comptable :**

| Quoi | Ce qu'il faut |
|---|---|
| **Paiements d'une facture** | une table `paiements_facture` — date, montant, moyen. Acomptes compris : un règlement partiel n'encaisse qu'une part de la TVA |
| **Le relevé calculé dessus** | `releveTvaCollectee` prend la date du PAIEMENT, plus celle de l'émission |
| **Le réglage des deux régimes** | `entreprises.tva_exigibilite` : `encaissements` (défaut) ou `debits` |
| **Ce qui attend, annoncé** | l'écran dit combien de TVA attend son paiement — une facture absente en silence se lit comme un oubli |

**Comment Atlas saura qu'il a été payé** — sa question du 14 août, et son choix :
**la banque** (`maquettes/atlas-banque-rapprochement.html`, 28 contrôles).

| Quoi | Ce qu'il faut |
|---|---|
| **Virements lus** | un prestataire agréé DSP2 — contrat et coût à décider, `docs/A-FAIRE.md` §13 |
| **Le rapprochement PROPOSÉ** | montant exact + nom approchant + fenêtre de dates. une règle pure, éprouvable sans banque, à écrire dans `src/lib/` |
| **Jamais automatique** | un virement collé à la mauvaise facture met la TVA dans le mauvais trimestre. Atlas propose, le patron confirme |
| **Les 90 jours** | l'accès se coupe (règle européenne). Prévenir une semaine avant, et retomber sur la saisie à la main |

**La saisie à la main se code sans attendre la banque** — c'est elle qui reste
quand l'accès dort, et elle ne dépend d'aucun contrat.

**Ce qui BLOQUE**, et qui n'est pas technique : sous quel régime il est. Inscrit
dans `docs/A-FAIRE.md` §12 — son comptable le sait en une phrase.

**Ce qu'on ne codera pas tant qu'il n'a pas tranché :** deviner son régime. Le
poser au hasard ferait déclarer trop tôt ou trop tard, et c'est l'administration
qui arbitrerait.

### 0 undetricies. L'absence d'une équipe — DESSINÉE le 14 août 2026, en attente de son choix
### 0 tricies nonies. ~~`test-pastille-equipe-e2e` est ROUGE sur `main`~~ — **RÉGLÉ le 16 août 2026**

**La cause n'était ni le code ni `.first()` : c'était le CALENDRIER.** La suite
visait « aujourd'hui + 20 jours » et supposait un jour ouvré. Le 16 août, cela
tombait sur le **samedi 5 septembre** : le panneau affichait « Jamais proposé »,
aucun bouton « Poser » n'existait — comportement voulu — et la suite rougissait
sans qu'aucun code n'ait bougé. Constaté à la sonde, en lisant le panneau :
`sansDate` n'était pas vide, il en comptait cinq.

Elle avance désormais au premier jour ouvré. **Une suite qui échoue selon le
jour de la semaine s'apprend à être ignorée** — et c'est ce garde-fou-là qu'on
perd, pas seulement dix minutes.

*Le constat d'origine est gardé ci-dessous : il dit bien ce qui avait été
écarté, et la piste `.first()` reste juste dans son principe — elle n'était
simplement pas la cause ici.*

**Et une seconde fragilité, corrigée par-dessus le 16 août :** le contrôle
cliquait `[data-atlas="sans-date"]` **avec `.first()`**, alors que le jeu de
démonstration porte d'autres chantiers sans date et que les sections
précédentes de la même suite en posent. Il vise désormais le chantier **par son
nom**, horodaté donc unique. Ce n'était pas la cause du rouge — la leur l'a
élucidée — mais c'était bien une loterie.

**Le jour visé part maintenant à six mois** plutôt qu'à vingt jours, toujours
ramené au premier jour ouvré par `estWeekEndIso` : à trois semaines, on tombe
dans la plage où les autres suites posent leurs chantiers, la journée s'annonce
« pleine », et le panneau ne rend alors **aucun bouton** — le même symptôme, une
autre cause. Le contrôle lit désormais le panneau AVANT de conclure : une
journée pleine se dit en toutes lettres au lieu d'accuser le bouton.

### 0 tricies nonies bis. Deviner une cause coûte plus cher que la regarder

*Écrit le 16 août 2026, en marge du correctif de `test-pastille-equipe-e2e`.*

Devant cette suite rouge, j'ai inscrit ici un diagnostic tiré d'une
**ressemblance** avec un défaut voisin — « la suite désigne le premier chantier
sans date plutôt que le sien ». C'était faux, et cela a failli envoyer la
session suivante corriger ce qui n'était pas cassé.

**Un seul relevé de l'état réel de la page a suffi à trancher** : « Samedi
5 septembre — Jamais proposé » était écrit dans le corps de la page. La cause
était le calendrier, pas le sélecteur.

**La règle qui en sort, et elle vaut au-delà de ce cas :** devant un contrôle
rouge, relever ce que la page DIT avant d'écrire une cause. Une hypothèse
consignée dans les tâches se lit ensuite comme un fait.


### ~~0 tricies octies. Marquer une facture PAYÉE~~ — **FAIT les 15 et 16 août 2026**

*Écrit le 14 août en codant « Notifications », quand rien dans Atlas
n'enregistrait qu'une facture était réglée. Le manque bloquait alors trois
familles d'alertes de la planche.*

**Le geste existe** : « Terminés › TVA › En attente de paiement », avec « Payée »
d'un doigt et « Noter un règlement » pour un acompte (migration 0045,
`paiements_facture`, codé par une autre session).

**Et la première des trois alertes bloquées est codée** : « Facture impayée »,
le 16 août (`ARCHITECTURE.md` §118). Les deux autres restent ouvertes, et elles
ne sont plus impossibles — seulement pas demandées :

| Ce qui reste | Ce qu'il faudrait |
|---|---|
| « Facture à échéance dans trois jours » | Un rappel AVANT l'échéance, symétrique de l'actuel |
| « Client à relancer » | Se poser sur le client plutôt que sur la facture |

### 0 duodetricies quater. La couleur de la barre du navigateur ne suit pas la charte

`themeColor` vaut toujours le crème dans les métadonnées : sur « Nuit », la
barre d'adresse de l'iPhone reste claire au-dessus d'un écran noir. Ce n'est pas
dans le rendu de la page — c'est une métadonnée, et elle ne connaît pas la
personne connectée. Il faut la produire depuis `generateViewport`, ce qui ajoute
une lecture de base à chaque page : à peser avant de le faire.

### ~~0 duodetricies ter. Apparence : le mode sombre OU l'accent~~ — **FAIT le 14 août 2026**

Ni l'un ni l'autre séparément : **les sept chartes**, dont deux sombres
(`ARCHITECTURE.md` §114). Le mode sombre qu'il demandait EST Nuit et Sylve.

**Ce qu'il ne faut pas rouvrir :** un interrupteur « sombre » à côté du choix de
charte. Les deux se contrediraient à la première combinaison — « Nuit » avec le
sombre éteint ne veut rien dire.

### ~~0 duodetricies ter (d'origine). Apparence : le mode sombre OU l'accent, à trancher~~

L'écran existe et ne règle rien, délibérément (`ARCHITECTURE.md` §108). Les
deux chantiers possibles, et leur coût :

| | Ce que ça demande |
|---|---|
| **Mode sombre** | Un second jeu de jetons, et **chaque écran repris un à un**. C'est ce qu'il avait envoyé le 14 août : sa planche d'origine était sombre |
| **Accent au choix** | `colors.rust` et `colors.or` sont écrits en clair dans plus de trois cents endroits, en style en ligne. Il faut les faire passer par une variable CSS — un balayage de toute l'application, à faire et à éprouver d'un coup |

**Ne pas poser d'interrupteur en attendant.** Sa phrase sur la planche : *« on le
touche, rien ne bouge, et on croit à une panne »*.

### 0 tervicies. ~~Apparier deux demi-journées par la proximité~~ — **CODÉ le 16 août 2026, par la route**

**Sa demande du 13 août 2026** : quand une demi-journée est prise et l'autre
libre, que le planning propose le chantier en attente **le plus proche**. Son
choix du 16 : la composition **2** de la maquette (le bandeau sous la journée),
**avec plusieurs propositions comme la 3**, et **par la route**.

**La question juridique est tranchée** (`docs/A-FAIRE.md` point 11, barré) : le
service d'itinéraire de l'IGN accepte sans clé ni compte, répond en 186 ms, et
le vol d'oiseau se trompe de ×1,33 à ×1,56 — assez pour inverser un classement.
Mesuré, pas supposé : `.github/workflows/itineraire.yml`.

**Livré :** migration `0049` (coordonnées + `adresse_situee`), rattrapage
automatique au fil des ouvertures du planning, règles pures dans
`src/lib/appariement-demi-journees.ts`, appel IGN dans
`src/server/itineraire/geoplateforme.ts`, bandeau dans
`src/components/atlas/BandeauAppariement.tsx`. Détail et pourquoi :
`ARCHITECTURE.md` §117.

**Ce qui RESTE, et n'est pas dans ce lot :**

- **la proposition 4 de la maquette** — proposer au moment où l'on pose la date,
  et non seulement sur le planning. Les deux ne se disputent pas ; elle attend
  son geste ;
- **un seul trou proposé à la fois.** À plusieurs équipes, plusieurs
  demi-journées dépareillées peuvent coexister. Trois bandeaux sous une même
  journée seraient illisibles ; on complète le premier, le suivant apparaît. À
  rouvrir seulement s'il le demande ;
- **la commune affichée est déduite de l'adresse** (`communeApprochee`), pas
  lue de la Base Adresse Nationale. Se tromper coûte une ligne un peu longue,
  jamais une mauvaise décision. Une colonne de plus serait à tenir à jour à
  chaque correction d'adresse.


### 0 quatervicies. Des suites navigateur tombent en batterie et passent seules

**Constaté le 16 août 2026.** En batterie : *« le serveur de banc n'a jamais
répondu »* après trois minutes d'attente. Rejoué seul dans la foulée, sans rien
changer : **six contrôles au vert**.

**Ce que ça n'est pas.** Un défaut du produit : cette suite éprouve un écran qui
ne s'affiche que sur le banc d'essai, et l'écran répond très bien.

**Ce que c'est probablement.** Elle démarre un **second** `next dev` — le sien,
avec son propre dossier de construction — pendant que celui de la batterie
tourne déjà, et pendant qu'un navigateur est ouvert. Deux compilations Next.js
concurrentes sur cette machine dépassent les trois minutes qu'elle s'accorde.

**Ce qu'il ne faut PAS faire :** allonger le délai jusqu'à ce que ça passe. Un
contrôle qui attend dix minutes ne dit plus rien de ce qu'il mesure. La piste
juste est de **réutiliser le serveur de la batterie** avec le profil banc plutôt
que d'en lancer un second, ou de la jouer avant que le navigateur ne démarre.

**Tant que ce n'est pas fait, l'attitude est simple :** un rouge de cette suite
en batterie se rejoue seul avant d'être cru — et cette phrase-là est ce qui
manquait le 16 août, où il a fallu la découvrir.

**Elle n'est pas seule, et c'est ce qui compte.** Le même jour,
`test-pastille-equipe-e2e` est tombée en batterie sur *« Depuis la feuille du
chevron aussi, l'équipe se retire — le montage de ce cas n'a pas pris »*, puis a
donné **neuf contrôles au vert** rejouée seule, sans une ligne modifiée. Deux
suites différentes, un seul symptôme : la machine est saturée en fin de
batterie, et un montage qui attend un écran finit par renoncer.

**Donc la règle est générale, pas propre au banc :** un rouge isolé en fin de
batterie navigateur se rejoue seul **avant** d'ouvrir une enquête. Ce qui reste
rouge seul est un défaut ; ce qui passe seul est une saturation, et c'est la
batterie qu'il faut réparer, pas le produit. Ne pas confondre les deux a coûté
une soirée le 16 août.

**Et ne pas s'en satisfaire.** « Ça passe seul » n'est pas un état acceptable à
demeure : une batterie qui ment une fois sur dix finit par être crue quand elle
dit vrai. La piste ci-dessus — un seul serveur Next partagé — vaut pour les deux.


### 0 duovicies. `/chantiers/<id>/facture` ne répond plus en fin de batterie

### 0 undetricies. ~~L'absence d'une équipe~~ — **CODÉE le 14 août 2026 (proposition A)**


**Sa question :** *« Comment on fait si jamais il y a une équipe qui doit partir
en déplacement pour cinq jours ? »* Réponse complète dans `docs/QUESTIONS.md`
§19 ; trois propositions dans `docs/maquettes/55`.

**Ce qui existe déjà, et qu'il ne faut pas refaire :** si TOUTE l'entreprise
part, l'agenda Google relié suffit — une période de plusieurs jours occupe
toutes les demi-journées qu'elle traverse. **Rien à coder pour ce cas-là.**

**Ce qui manque :** une absence datée **par équipe**. L'agenda bloque tout le
monde — délibérément, `fusionnerOccupationExterne` pose l'occupation au niveau
du nombre d'équipes parce qu'Atlas ne peut pas deviner si une équipe sait partir
sans le patron — et le nombre d'équipes est un nombre **sans dates**.

**Il a retenu la A** — sous les noms, dans Réglages → Équipe. Les deux autres
restent dessinées : (B) un appui long sur un jour du planning, (C) une ligne de
déplacement posée comme un chantier. Si l'usage montre que le geste tombe au
mauvais endroit, le chemin est tracé.

**FAIT.** `drizzle/0044_absences_equipe.sql`, `src/lib/absences-equipe.ts`,
`src/server/repositories/absences-equipe.ts`, `src/app/reglages/AbsencesEquipe.tsx`.
Une absence est traitée comme une **occupation** — elle prend la place qu'un
chantier aurait prise — ce qui la fait entrer dans les quatre calculs de
capacité sans changer une seule signature. Éprouvée à trois niveaux :
`test-absences-equipe.ts` (25 cas purs), `test-absences-equipe-repo.ts`
(isolation, sous `atlas_app`), `test-absence-equipe-e2e.ts` (du doigt jusqu'au
calendrier, vu rouge quand on retire la réparation). `ARCHITECTURE.md` §109.

### 0 undetricies ter. ~~La page « toutes les maquettes » a pris du retard, en silence~~ — **le contrôle demandé existe (15 août 2026)**

**Ce que cette entrée demandait, le 14 août :** *« un contrôle qui refuse une
planche présente sur le disque et absente de la liste […]. Le rattrapage des six
se fait alors une fois, et le trou ne se rouvre plus. »* C'est écrit, et le
rattrapage est fait — détail et éprouvage en **§0 tricies septies**.

**Une seule chose a changé par rapport à ce qui était demandé, et elle compte :**
le contrôle n'exige pas d'être dans la page unique, mais **dans l'une des deux
portes**. La page unique est une *sélection* — elle laisse dehors les planches
qui se manipulent, dont `43-l-attente-a-lessai`, qui ne vaut que seule ; le
sommaire est le *catalogue*. Exiger les deux aurait fait rougir des choix
délibérés, et un contrôle qui accuse à tort finit contourné.

**Et l'entrée avait raison de ne pas rattraper à la main** : les titres écrits
ici pour `47-ou-mettre-l-assistant` et `53-le-mot-juste-sans-la-date` sont tirés
de leurs propres en-têtes, pas inventés.

### 0 undetricies bis. L'équipe d'un chantier est une étiquette, pas une contrainte

**Trouvé le 14 août 2026 en répondant à la question ci-dessus, et pas signalé
par lui.** `compterOccupation` compte les chantiers par demi-journée et compare
ce total au nombre d'équipes ; il ne regarde **jamais** `equipeId`. Deux
chantiers le même matin, tous les deux sur « Équipe 1 » : Atlas les accepte sans
rien dire.

Sans conséquence tant que le patron répartit lui-même. **Faux dès qu'une équipe
est absente** — d'où le lien avec le point précédent.

**Pourquoi ce n'est PAS dans le même lot :** le régler oblige à choisir l'équipe
**avant** de proposer une date au client, donc à toucher au parcours du devis
(trois arrêts, `docs/AGENT.md`). C'est un chantier à part, et il n'a de sens que
si le télescopage se produit vraiment. **Question posée au patron le 14 août,
sans réponse à ce jour.**

### 0 octovicies. ~~Mon compte et Connexion~~ — **CODÉS le 14 août 2026 (« A A »)**

Les deux écrans existent : `/reglages/compte` et `/reglages/connexion`
(`ARCHITECTURE.md` §107). **Ses deux réponses ont été appliquées** — pas de
téléphone dans le compte, pas de liste d'appareils dans la connexion, et les
deux mots retirés des libellés du sommaire.

**Trois choses à ne PAS rouvrir sans qu'il le demande :**

| | |
|---|---|
| Le champ **téléphone** du compte | Réponse « A ». Rien ne l'appellerait : le numéro du client est celui de l'entreprise |
| La **liste des appareils** | Réponse « A ». Il faudrait une table de sessions ; le geste utile — « me déconnecter partout » — existe et suffit |
| L'**œil à la place** de la confirmation | Il veut **les deux**. L'œil se touche après coup ; la confirmation attrape la faute au moment où elle se fait |

**Ce qui reste ouvert, et qui attend autre chose que du code :** l'e-mail ne se
change pas. Il faudrait d'abord un moyen de vérifier la nouvelle adresse — donc
un canal d'envoi, qui n'existe pas et dont il a dit qu'il n'y en aurait pas. À
rouvrir le jour où un parcours d'inscription existera.

**Un défaut antérieur vu sur la capture — ~~et réglé le même jour par une autre
session~~.** La bulle de l'assistant recouvrait le bord droit du bouton
d'enregistrement, sur cet écran comme sur « Mon entreprise ». Elle a quitté le
coin flottant pour l'en-tête (`ARCHITECTURE.md` §106, proposition B). **Rien à
faire ici**, et surtout rien à contourner : la cause n'était pas la place de mon
bouton, c'était un élément `fixed` — cinq écrans avaient déjà été déplacés cet
été pour l'éviter.

### 0 duodetricies. ~~L'assistant flottant recouvrait les écrans~~ — **réglé le 13 août 2026 (proposition B)**

*« L'onglet de l'assistant est hyper mal placé »*, puis *« la B mais de la même
couleur qu'elle est déjà »*. Le bouton a quitté le coin flottant pour l'en-tête,
en gardant son vert pin plein. `ARCHITECTURE.md` §106.

**Quatre choses à ne pas défaire :**

1. **Il ne doit plus jamais être `fixed`.** C'est la cause, pas la position :
   cinq écrans ont été déplacés cet été pour éviter cette bulle.
2. **Il reste À CÔTÉ DU TITRE, pas sur une ligne à lui.** Une ligne propre
   ajoute 72 px en tête de chaque écran et repousse la dernière semaine du
   planning sous la barre — essayé, mesuré, défait.
3. **La couleur ne vient pas du composant qui le porte** : `colors.rust` plein,
   icône blanche, c'est sa demande explicite.
4. **`useAssistant()` rend `null` hors du fournisseur** au lieu de lever :
   `EnTeteEcran` sert onze écrans, et une page hors gabarit ne doit pas tomber
   pour un bouton d'agrément.

### 0 duodetricies bis. La dernière semaine du planning déborde de onze pixels sous la barre

**Trouvé le 13 août 2026 en mesurant autre chose**, et **antérieur** à ce
travail : la dernière case du mois finit à 626 px quand la barre du bas commence
à 615. Onze pixels de la ligne « 31 » passent dessous — elle reste lisible, et le
planning défile, mais elle n'est pas entièrement là.

**Non traité, et signalé plutôt que corrigé en passant** : ce n'est pas ce qu'il
a demandé, la correction touche la hauteur réservée du calendrier, et un
contrôle qui l'aurait attrapé aurait accusé le déplacement de l'assistant — ce
qui n'est pas le coupable.

### 0 trigies. ~~Dicter dans le devis~~ — **CODÉ le 15 août 2026 (proposition A)**

Sa demande du 15 août 2026, capture du devis à l'appui : *« rajoute-moi un petit
dictaphone en haut à droite comme il y a pour les infos clients [...] pour
pouvoir dicter à l'intérieur du devis s'il y a des choses à reprendre ou à
modifier. »* Puis son vocabulaire — supprimer une ligne par son rang ou par son
nom, changer un prix, en ajouter une, corriger une faute — et sa phrase :
*« Je vais pouvoir lui parler comme ça et qu'elle comprenne. »*

**Livré** : `src/lib/retouches-devis.ts` (la règle),
`src/server/ai/services/retouches-devis-service.ts` (le modèle),
`src/app/chantiers/[id]/devis-complet/DicterDansLeDevis.tsx` (l'écran). Détail : `ARCHITECTURE.md`
§113, `CHANGELOG.md` du 15 août.

**CE QUI RESTE, et qui n'est pas un détail :**

1. **La feuille remplie n'a jamais été parcourue de bout en bout.** Cet
   environnement n'a ni transcription ni modèle : la chaîne voix → feuille n'est
   éprouvée qu'en morceaux (27 cas sans navigateur, 5 au navigateur). Le premier
   essai réel sera le sien, ou celui d'une machine avec une clé. **Le lui dire
   plutôt que de le laisser croire éprouvé.**
2. ~~Sa question de la planche 54~~ — **TRANCHÉE le 16 août 2026 : NON.**
   Il avait d'abord répondu « oui il peut néanmoins », puis s'est repris dans le
   message suivant : *« je veux que la note, elle ne remplace que les lignes de
   [devis] et rien d'autre, comme c'était déjà avant — on ne touche pas aux
   conditions. »* **C'est l'état actuel du code, et il ne bouge pas.**

   **Rien n'avait été codé entre les deux réponses**, et c'est précisément ce
   que le §3 bis protège : la première réponse aurait fait écrire un sixième
   type de retouche qu'il aurait fallu défaire douze heures plus tard. Ne pas
   rouvrir sans qu'il le demande.
3. **Aucune vérification côté serveur qu'un devis figé refuse les retouches.**
   L'écran retire le micro dès l'envoi, et c'est la seule barrière — exactement
   comme pour les autres champs de cet écran, qui n'en ont jamais eu d'autre. À
   corriger pour tous en même temps, pas pour celui-ci seul.

### 0 novemvicies. ~~L'équipe n'était pas applicable~~ — **la pastille CODÉE le 14 août 2026 (geste A)**

Sa remarque du 13 août 2026 : *« appliquer une équipe à un chantier n'est pas
intuitif »*. Elle était fondée : `planifierChantier` était alors le **seul**
chemin qui écrivait `equipeId` — six gestes pour changer une lettre, à commencer
par « Déplacer », un mot qui annonce une **date**.

**Deux choses ont été livrées le 14 août, par deux sessions :**

| | |
|---|---|
| la ligne « Équipe » dans la feuille du chevron (geste B) | par une autre session |
| **la pastille sur la ligne du planning** (geste A) — son choix | ce lot |

**Ce que la pastille règle, et que la feuille ne réglait pas :** un chantier
**sans** équipe le dit enfin — « Équipe&nbsp;? » en or pointillé. Jusque-là la
ligne n'écrivait rien du tout, et rien ne signalait qu'il en manquait une.

**Trois conséquences assumées, écrites pour ne pas être défaites par surprise :**

1. **« Déplacer » a quitté la ligne pour la feuille du chevron.** À 390 px la
   ligne ne peut porter le nom, l'occupation, l'équipe, « Déplacer » et le
   chevron — c'est le NOM qui aurait rétréci. Le geste n'est pas perdu : le
   supprimer aurait refermé la seule façon de changer une date, et le planning
   a déjà été un cul-de-sac une fois (8 août).
2. **`changerEquipeChantier` accepte `null` : l'équipe se RETIRE.** C'était
   impossible par tout chemin jusqu'à ce jour — `planifierChantier` ignore le
   cas en silence, et le geste neuf exigeait un rang. « Personne pour
   l'instant » figure sur l'écran qu'il a retenu ; le montrer sans pouvoir
   l'exécuter aurait été livrer un bouton mort.
3. **Retirer ne se refuse jamais pour occupation** : libérer une place n'en
   prend aucune, et refuser enfermerait le patron dans son erreur.
4. **Les DEUX chemins savent retirer** — la pastille et la feuille du chevron.
   Le second l'a gagné le soir même, sur sa question : le laisser manquer aurait
   donné deux portes et deux réponses, et celui qui prend la seconde en conclut
   que c'est impossible.

**Geste C — CODÉ le 14 août 2026**, à sa demande (« tu peux faire la C ») : au
moment de **poser**, les équipes sont devenues des **cases côte à côte**, et le
bouton reste à l'écran, éteint, en disant « Choisissez d'abord ». Il ne comblait
aucun trou — le choix existait — mais il ne ressemblait pas à un choix, et c'est
le geste qu'il fait à chaque nouveau chantier.

**Et le défaut de fond n'est PAS refermé :** à la **pose**, le serveur revalide
le compte de la demi-journée (`occupation < nombreEquipes`), jamais l'identité
de l'équipe demandée. Le chemin du changement, lui, la vérifie pour de bon
(`EquipeIndisponible`). Deux chemins qui protègent différemment la même chose
finissent par diverger — inatteignable par l'écran aujourd'hui, qui éteint les
lignes prises.

### 0 novemvicies bis. ~~La ligne du planning disait « matin » quoi qu'il arrive~~ — **CODÉ le 2026-08-14**

Sa capture du 13 août 2026 : *« pourquoi sous le chantier il y a marqué matin ?
Cela laisse à penser que juste le matin est bloqué alors que c'est la journée. »*

Il avait raison. `libelleQuand()` écrivait `creneauDebut`, la demi-journée de
**départ**, jamais ce que le chantier occupe — et `DUREE_PAR_DEFAUT_DEMI_JOURNEES`
valant **2**, le cas le plus courant du produit était celui qui mentait.

**Ce qui n'était PAS en cause, et n'a donc pas bougé :** `compterOccupation()`
parcourait déjà la durée. Les pastilles du calendrier et la réservation ont
toujours compté juste. **Aucune donnée touchée, aucune migration.**

**Ses mots, arrêtés en deux temps sur maquette** (`docs/maquettes/51` puis `49`) :
*« La A »*, *« matin, après-midi ou les deux, mais pas la date »*, puis *« Je
veux journée et du 21 au 25 »*.

| Ce que le chantier prend | Ce que la ligne dit |
|---|---|
| une demi-journée | « matin » · « après-midi » |
| une journée entière | « journée » |
| plus d'un jour | « du 21 au 25 août » — le week-end sauté, comme la réservation |
| à cheval sur deux mois | « du 31 août au 2 septembre » |

Écrit dans `libelleOccupation()` (`src/server/disponibilites.ts`), **fonction
pure** : elle demande à `creneauxDuChantier` ce qui est occupé plutôt que de
refaire l'arithmétique, sans quoi l'écran et la réservation finiraient par se
contredire un vendredi. Éprouvée par `scripts/test-libelle-occupation.ts`, et
**le contrôle a été vu rouge** contre l'ancien comportement avant d'être livré.

**La date tombe sur la LISTE, pas dans la feuille du chevron**, et c'est
délibéré : sa consigne (*« elle est déjà présente juste au-dessus »*) vaut du
panneau du jour, titré « Lundi 17 août ». Dans la feuille, elle n'est écrite
nulle part ailleurs — l'en retirer laisserait un chantier sans jour.
`Occupation.porteLaDate` empêche le doublon « 21 août · du 21 au 25 août ».

**Reste à lui confirmer :** que la date ait disparu de la liste **sans qu'il
l'ait redemandé explicitement après avoir vu les deux versions côte à côte**.
Un mot de lui la ramène.

### 0 novemvicies ter. L'icône installée est un A, et personne ne l'avait vu

Trouvé le 13 août 2026 en dessinant les planches du nom (ci-dessous), pas
cherché : `public/icone-source.svg` est **un A** — « un A bâti comme un chevron
de charpente », dit son propre en-tête, posé comme provisoire et jamais
remplacé. Elle est de surcroît restée en **terre cuite `#C0621F`**, la couleur
d'avant la charte vert pin du 3 août.

Deux conséquences, et elles ne dépendent pas l'une de l'autre :

- **Si un autre nom est retenu**, l'icône devient fausse — un A sur l'écran
  d'accueil d'un outil qui ne s'appelle plus Atlas. Ce serait le seul des quatre
  fichiers à reprendre qui demande un **dessin**, pas un remplacement de mot.
- **Même si le nom ne change pas**, elle est hors charte depuis dix jours.

Le remplacement est mécanique : un fichier, puis `npm run icones` régénère les
PNG. Ce qui manque est la décision de dessin. Les planches 45 proposent le
**sceau de la porte** — rose des vents dans son rond d'or sur crème —, ce qui
ferait de la porte et de l'écran d'accueil la même image. **Rien n'est décidé.**

### 0 novemvicies quater. Trois noms proposés — Gunzi, Goonzi, Gunzy

**⚠ MIS EN ATTENTE PAR LE PATRON, le 16 août 2026 :** *« Oublie le mot
Gunzy, on s'en fout pour l'instant, on verra ça plus tard. »* **Ne plus le lui
reposer** — c'est lui qui rouvrira. Les trois planches restent où elles sont.

Sa demande du 13 août : *« fais-moi une maquette avec comme nom Gunzi à la place
d'Atlas. Ne code rien. »*, puis les deux autres noms. Trois planches identiques
au mot près, avec un passage de l'une à l'autre en tête :
`docs/maquettes/50-le-nom-{gunzi,goonzi,gunzy}.html`.

**Rien n'est codé, et c'est la consigne** (`CLAUDE.md` §3 bis). Ce qu'il faudra
toucher le jour où un nom est arrêté, pour ne pas le rechercher :

| Où | Quoi |
|---|---|
| `src/components/atlas/MarqueAtlas.tsx` | `MotAtlas` — le mot sous le sceau |
| `public/manifest.json` | `name` et `short_name` — l'écran d'accueil |
| `src/app/layout.tsx` | le titre de l'onglet et la carte de partage |
| `public/icone-source.svg` | l'icône, qui est un A — voir ci-dessus |
| `src/server/documents-legaux/versions.ts` | les CGU citent le nom, et **une version acceptée ne se modifie jamais** : renommer y fait naître une version de plus, à réaccepter |

**Ce que la planche a établi, et qui n'était pas su :** le nom ne se voit qu'à
**trois endroits** dans tout le produit, et **le client de l'artisan ne le voit
nulle part** — ni la page publique d'un devis, ni celle d'une facture, ni leurs
PDF ne portent de marque (vérifié fichier par fichier). Renommer ne demande donc
de prévenir personne. Le seul coût qui grandit avec le temps est celui des CGU :
nul aujourd'hui, puisque personne n'a encore accepté la `canevas-1`.

Les largeurs sont **mesurées à l'écran**, pas estimées : ATLAS et GUNZI font
97 px, GUNZY 105, GOONZI 118. Cinq lettres ne veut pas dire la même largeur.
### ~~0 octovicies (d'origine). Mon compte et Connexion : dessinés, avec DEUX QUESTIONS~~


*`maquettes/atlas-reglages-moi.html`, le 14 août 2026 — quatre écrans, 53
contrôles. **Les onze autres rubriques du sommaire ont leur planche ; c'étaient
les deux dernières.***

**Ce qui se code dès son accord, sans rien décider :**

| Écran | Ce qu'il porte | Ce qu'il faut |
|---|---|---|
| **Mon compte** | Nom, e-mail, initiales | Rien à créer : `users.nom` et `users.email` existent |
| **Connexion** | Changer son mot de passe | Rien à créer : `users.password_hash` existe, haché |

**Ce qu'il a tranché le 14 août 2026, et qui n'est plus discutable :** *« il faut
pouvoir confirmer son mdp 2× avant de le changer et met le petit œil à côté pour
afficher ou non le mdp »*. Ma première planche proposait l'œil **à la place** de
la seconde saisie ; il veut **les deux**, et il a raison : l'œil se touche après
coup, la confirmation attrape la faute au moment où elle se fait.

L'œil est sur **les trois champs** — une confirmation qu'on ne peut pas relire ne
confirme rien. Il est **gris**, et bronze une fois ouvert : un pictogramme plein
au bord d'un champ se lirait comme un bouton d'envoi, et le seul plein de
l'écran doit rester « Changer mon mot de passe ».

**Et DEUX QUESTIONS, parce que le sommaire promet ce qui n'existe pas :**

| | La promesse | Le fait | Les deux réponses |
|---|---|---|---|
| **1** | « Nom, e-mail et **téléphone** » | `users` n'a pas de colonne téléphone, et rien n'appellerait ce numéro : ni SMS ni e-mail sortant (tranché le 4 août) | **A** retirer le mot du libellé · **B** créer la colonne |
| **2** | « Mot de passe et **appareils** » | `src/auth.ts` pose `session: {strategy: "jwt"}` — **aucune session n'est en base**, il n'y a rien à lister | **A** juste « me déconnecter partout » (une colonne) · **B** la vraie liste (une table, 2-3 jours) |

**Ne pas dessiner d'appareils en attendant.** Une liste plausible — « iPhone ·
il y a 2 h » — se valide en dix secondes et le défaut n'apparaît qu'au moment de
coder. Le contrôle de la planche l'interdit explicitement, et il sait rougir.

### 0 novemvicies quinquies. ~~« Le nombre de jour en doré »~~ — **CODÉ le 15 août 2026**

**Sa réponse finale : « je veux journée et toute la ligne. Tu peux coder. »**
La ligne du planning porte désormais la date, le moment de départ et la durée,
toute en or — `ARCHITECTURE.md` §111. Ce qui suit reste écrit parce que le
chemin importe : la question qu'il a posée n'avait pas la réponse qu'elle
supposait, et c'est la fouille de l'historique qui l'a montré.

**Ce qui reste ouvert, et lui seul le tranchera à l'usage :** la ligne ne dit
plus quand un chantier long **finit**. « du 21 au 25 août » a été remplacé par
« matin · 3 jours », et les week-ends sautés interdisent de recalculer la fin de
tête. Sa place, si elle lui manque, est la **feuille du chevron** — qui a la
largeur que la ligne n'a pas. Ne pas la remettre sur la ligne sans le lui
demander : elle en avait été retirée pour faire tenir le nombre de jours.

*Le patron, le 15 août 2026, capture du planning à l'appui : « Avant il y avait
le Nombre de jour en doré et je sais plus quoi, où c'est passé ? »*

**L'historique a été fouillé, toutes branches, avant de lui répondre.** Aucun
nombre de jours n'a jamais été écrit **en or** dans `src/`. Trois choses en
approchent, et ne pas les confondre fait gagner l'aller-retour :

| Ce qui a existé | Où | Quand c'est parti |
|---|---|---|
| « matin, 2 jours » — **en gris** (`creneauLisible`) | la ligne du planning | `064d413`, 10 août |
| « Créer la facture » — **en or**, mais ce n'est pas un nombre | la même ligne | `026e7ba`, 12 août, vers `FeuilleYAller` |
| « occupe : vendredi 21, lundi 24, mardi 25 » — **un nombre de jours en or** | `docs/maquettes/51`, envoyée le 14 août | jamais codé ; le pied de la planche le disait |

**La troisième est la plus probable** : il a manipulé cette planche la veille, et
une maquette dorée se confond avec l'application.

Ce qui est en or à cet endroit de l'écran, et qui l'est toujours : le chiffre du
jour dans le calendrier — aujourd'hui, et le jour ouvert —, les pastilles sous
les quantièmes, le chevron de la ligne, « À poser », et le pointillé
d'« Équipe ? » quand elle manque. **La date tombée le 15 août, elle, était
grise** (`colors.muted`). Et `#c2a05f` / `#8f7130` n'ont jamais existé dans
`src/` : ce sont les bronzes des vieilles maquettes « Origine ».

**Trois lots ont touché cette ligne en deux jours**, ce qui explique qu'il ne
s'y retrouve plus, et il faut les lui rappeler avant de conclure quoi que ce
soit : la date est tombée (maquette 53), « Déplacer » a quitté la ligne pour la
feuille du chevron (maquette 52), la pastille d'équipe est arrivée à sa place.

**Rien n'est codé, et ce n'est pas un oubli** (`CLAUDE.md` §3 bis) :
`docs/maquettes/58-le-nombre-de-jours-en-or.html` lui a montré **quatre
écritures de la même ligne** — A telle qu'elle est, B la date qui revient, C la
durée en or, D les deux en or.

**IL A CHOISI LA D, ET IL L'A AUGMENTÉE** — sa réponse du 15 août : *« je veux
le 54 la D mais il doit y avoir le nombre de jour, le matin, l'après-midi et la
journée comme infos possible »*. La ligne portera donc **trois** choses : la
date, le moment de départ, le nombre de jours.
`docs/maquettes/59-la-ligne-qui-dit-tout.html` les montre sur les **cinq** cas
du produit, et pose les **deux dernières questions** :

| | La question | Les deux réponses |
|---|---|---|
| **1** | le chantier d'une journée pleine | **A** « 14 août · journée » · **B** « 14 août · matin · 1 journée » (le départ, puis la durée — comme les quatre autres lignes) |
| **2** | ce qui est en or | **A** toute la phrase · **B** le seul nombre de jours |

**ET LE VOCABULAIRE NE S'INVENTE PAS : « journée », jamais « jour ».** La liste
`DUREES` (`src/lib/durees-chantier.ts`) dit « ½ journée », « 1 journée », puis
« 3 jours » — **et le dit depuis le 4 août 2026, sur une correction du patron,
capture à l'appui**. La première planche a quand même écrit « ½ jour », et il a
dû reprendre la même chose une seconde fois : *« 1/2 journée pas jour ! »*.

Le contrôle **lit désormais `DUREES` dans le dépôt** et refuse tout libellé qui
n'en vient pas — il ne recopie pas la liste, qui dériverait. Absent le fichier,
il le dit et **échoue** plutôt que de verdir en silence. Une règle déjà écrite et
enfreinte deux fois n'est pas une règle : c'est un contrôle qui manque.

**ET UN INVARIANT À NE PAS PERDRE EN CODANT.** « matin » ne doit **jamais** être
écrit sans son nombre de jours : seul, il redit exactement ce qu'il a signalé le
13 août — *« ça laisse à penser que juste le matin est bloqué alors que c'est la
journée »*. C'est le nombre accolé qui le rend honnête. Le contrôle de la
planche le garde déjà, et **la suite du code devra le garder aussi** : ce n'est
pas une préférence d'écriture, c'est la réparation d'un défaut qu'il a trouvé.

**Ne pas deviner à sa place, et ne pas coder les quatre « pour qu'il essaie ».**
C'est exactement ce qui a été refusé le 11 août.

Le contrôle de la planche existe et **a été vu rouge trois fois** avant d'être
livré (`scripts/verifier-maquette-nombre-de-jours.mjs`) : or retiré, bascule
morte, nom trop long — chacun nomme le bon coupable.

### 0 octovicies bis. L'écran du catalogue : sa flèche, et sa mémoire morte

*Les deux défauts sont sortis d'une capture du patron, le 14 août 2026 — pas
d'une suite verte. Ils sont expliqués en langage courant dans
`docs/QUESTIONS.md` §18. **En attente de son feu vert** : rien n'a été touché.*

**1. Aucune flèche de retour.** `src/app/catalogue/page.tsx` appelle
`ScreenHeader` sans lui passer `backHref`, alors que le composant sait
l'afficher. On y arrive depuis *Tarifs & catalogue* : `backHref="/reglages/tarifs"`
suffit. Une ligne.

**2. « Aucun prix encore constaté » est un mensonge de branchement, et il ne
s'éteindra jamais.** L'écran lit `historique_prix` — l'ancienne mémoire, celle
que l'application **n'écrit nulle part** (`enregistrerPrixHistorique` n'est
appelée que par `scripts/test-ia-05-catalogue.ts` et `test-ia-06-chiffrage.ts`).
La mémoire vivante est `lecons_prix` depuis la migration 0023 : écrite par
`retenirLecon` depuis `src/app/chantiers/[id]/devis-complet/actions.ts`, relue
par `leconsComparables`.

C'est **exactement** le piège que `docs/QUESTIONS.md` §17 dit avoir payé une
fois — il a survécu ici, sur un écran que personne ne regardait.

**Ce que ça veut dire pour le correctif :** ne pas se contenter de rebrancher le
`SELECT`. Le rapprochement de `lecons_prix` se fait par **signature de métier**
(`src/lib/lecons-prix.ts` : `abattage|demontage_retention|d70`), pas par
`prestationId` du catalogue. Il faut donc décider ce que la carte « Élagage »
montre : le dernier prix de **toutes** les leçons dont la nature correspond, ou
rien. Un rapprochement approximatif afficherait sous « Élagage » un prix
d'abattage — pire que la phrase actuelle, qui au moins n'invente rien.

**Et tant qu'on y est :** cet écran porte encore l'ancienne échelle (`p-4`,
`text-ink/40`, `rounded-md`) et n'a jamais été passé à la charte. Le retoucher
sans le redessiner laisserait un écran de 2026-07 au milieu des autres —
`CLAUDE.md` §3 bis : une maquette d'abord.

### 0 quinvicies bis. Faire ARRIVER les conditions jusqu'au devis

**⚠ IL L'A VU LUI-MÊME, le 16 août 2026** — et c'est la troisième fois qu'un
défaut de ce dépôt se trouve en regardant l'écran plutôt qu'en lisant un
contrôle : *« dans les réglages, lorsqu'on coche le bouton on/off pour les
formalités de devis, rien n'apparaît sur le devis, c'est normal ? »*

**Non. Et l'écran lui PROMET le contraire** : le bloc « Ce que votre devis dira »
liste les conditions choisies, ligne à ligne. C'est un aperçu de quelque chose
qui n'arrive jamais. Un écran qui décrit un document qu'il ne produit pas est
pire qu'un écran muet — il fait envoyer un devis en croyant qu'il porte un
acompte.

**Ce qui monte au devis, mesuré et non supposé :** la validité, et elle seule
(`snapshotEnTete` dans `devis.ts`, puis `devis-pdf.ts`). Les cinq autres
n'apparaissent nulle part — ni à l'écran, ni au PDF.

**Il a dit « Oui répare » le 16 août.** La planche est posée :
`docs/maquettes/60-les-conditions-sur-le-devis.html`, éprouvée par
`scripts/verifier-maquette-conditions-devis.mjs`. **Rien n'est codé tant qu'il
n'a pas désigné son arrangement** (`CLAUDE.md` §3 bis) — ce n'est pas une
précaution de style : le bloc « Notes / conditions » est un champ LIBRE qu'il a
peut-être rempli à la main, et son texte d'invite propose justement « Acompte de
30 % à la signature ». Se tromper d'arrangement, c'est soit effacer sa saisie,
soit écrire l'acompte deux fois sur un devis qui part chez un client.

| | Ce que ça fait | Ce que ça coûte |
|---|---|---|
| **A** | les conditions **remplacent** le bloc de notes | son texte écrit à la main **disparaît** |
| **B** | son texte en tête, les conditions dessous, séparées d'un filet | un acompte tapé à la main apparaîtra **deux fois** |
| **C** | deux blocs : « Notes » et « Conditions » | un bloc de plus, le devis s'allonge ; même doublon qu'en B |

**Une question posée dans la planche, sans réponse et qui ne bloque pas :** les
conditions doivent-elles aussi descendre sur la **facture** ? Aujourd'hui elle
ne porte que ses mentions légales obligatoires.


`ARCHITECTURE.md` §102 : la rubrique « Devis & factures » règle six conditions,
mais **seule la validité s'imprime**. L'acompte, le délai de paiement, les
moyens de paiement, le rappel des pénalités et le texte de pied sont
enregistrés et montrés en aperçu — ils n'atteignent pas encore le document.

**Ce qu'il faut faire, et l'ordre compte :** les figer dans le devis comme la
validité (`devis.validite_jours`), PUIS les composer dans le bloc « NOTES /
CONDITIONS ». Les lire au moment de composer le PDF réécrirait les conditions
d'un devis déjà parti.

**Le piège à ne pas rouvrir :** `devis.conditions_paiement` porte déjà un texte
que le patron peut écrire à la main. Le remplacer d'office effacerait sa saisie ;
les deux doivent cohabiter.


- **Le champ de prix d'une grille fait 14 px, et iOS agrandit alors la page.**
  Relevé le 14 août 2026 en regardant l'écran « Mes prix » sur un iPhone 13 : le
  champ du montant (`Champ`, `GrillesPrixClient`) est le seul de l'application
  sous les 16 px. Le passer à 16 élargit la colonne — donc ça touche l'allure
  d'un écran qu'il n'a pas demandé de changer, et ça se dessine avant
  (`CLAUDE.md` §3 bis).

### 0 quatervicies novies. NE PAS recoder le blocage de l'envoi sans SIRET

Décidé par le patron le matin du 14 août 2026, codé, montré — puis **retiré le
même jour à sa demande** : *« rien de plus, rien de moins »* (`ARCHITECTURE.md`
§97). Les réglages alimentent le devis ; ils ne commandent pas l'écran d'envoi.

**Cette ligne existe pour empêcher qu'on le refasse.** Un devis part aujourd'hui
sans SIRET si le patron n'en a pas saisi, et rien ne l'en avertit : ce n'est pas
un oubli, c'est un risque qu'il assume, l'argument lui ayant été donné.

### 0 quatervicies octies. ~~CODER le sommaire des réglages~~ — fait le 2026-08-14

Le sommaire est en place (`ARCHITECTURE.md` §96), en filets et dans la charte,
et tout ce qui s'empilait sur l'écran est parti dans sa rubrique.

**Ce qui reste sous « Bientôt », et qui est du vrai travail** — six rubriques :
mon compte, notifications, connexion, apparence, l'équipe au sens des COMPTES
(§88), et « Devis & factures » (les conditions, la numérotation et les mentions
sont encore écrites en dur, §91). Elles se voient à l'écran, marquées, et ne
mentent pas.

**Et le cloisonnement n'est posé QUE là.** Les réglages refusent un membre ;
les chantiers, les devis et les factures lui montrent encore tous les montants.
Ne pas lire la §96 comme si le sujet était clos.

### 0 tricies septies. ~~La page qui rassemble les maquettes a décroché~~ — **contrôlé depuis le 15 août 2026**

**C'était plus grave que ce qui était écrit ici.** L'entrée disait « les 41, 42
et 43 n'y sont pas » et concluait « sans conséquence pour le patron : les
planches s'ouvrent une par une, et c'est ainsi qu'elles lui sont envoyées ».

En mesurant plutôt qu'en supposant, **six maquettes** — 38, 39, 41, 42, 43 et
46 — n'étaient inscrites **ni dans la page unique, ni au sommaire**. Ce n'était
donc pas la comparaison qui se perdait : c'était le seul chemin qui y menait.
Elles n'existaient que pour qui connaissait leur nom de fichier.

**Ce qui l'a laissé passer :** le compte affiché. « 36 maquettes fusionnées »
reste parfaitement plausible quand il en manque six.

**Le contrôle vit maintenant dans `fusionner-maquettes.mjs`**, joué à chaque
régénération, et il refuse trois états :

- une maquette sur le disque **qu'aucune des deux portes n'atteint** — l'exigence
  porte sur leur réunion, pas sur chacune : la page unique est une *sélection*
  (elle laisse dehors les planches qui se manipulent), le sommaire est le
  *catalogue* ;
- un **lien mort** dans le sommaire — le défaut d'origine de ce dossier, trouvé
  par le patron en cliquant ;
- un **numéro porté deux fois**. Il les désigne par leur chiffre — « fais la
  34 » — et cinq numéros l'étaient déjà (33, 34, 35, 36, 37). Ces cinq-là sont
  tolérés **nommément** : les renuméroter casserait les renvois déjà écrits.
  **Le 50 aussi, et volontairement** : Gunzi, Goonzi et Gunzy sont la même
  planche sous trois noms, et les séparer les rendrait incomparables. Tout
  nouveau doublon rougit.

Éprouvé en le confrontant aux trois états : une maquette orpheline, un doublon
de numéro, un `href` vers un fichier absent. Il les nomme un par un.

**Et il a servi deux fois dans l'heure qui a suivi.** En fusionnant `main`, il a
nommé deux planches de plus tombées dans le même trou — `47-ou-mettre-l-assistant`
et `53-le-mot-juste-sans-la-date` — inscrites au sommaire dans la foulée. C'est
lui, aussi, qui a fait renommer cette planche-ci **deux fois** : le 46 était pris
par `46-pendant-que-ca-batit`, puis le 47 par `47-ou-mettre-l-assistant`. Elle
porte le **56**.

**Avant d'écrire une nouvelle planche, jouer `node scripts/fusionner-maquettes.mjs`**
: il donne le prochain numéro libre en refusant le doublon, plutôt que de le
laisser découvrir à la fusion suivante.

### 0 tricies sexies. ~~Un conflit non refermé était arrivé sur `main`~~ — **contrôlé depuis le 13 août 2026**

**Constaté en refusionnant :** `ARCHITECTURE.md` portait **trois marqueurs de
conflit** sur `main` — une session avait poussé une fusion sans la refermer.

**Pourquoi personne ne l'a vu, et c'est le cœur du sujet.** Ni les types, ni le
lint, ni les suites ne lisent les fichiers de mémoire, et la documentation se
consulte surtout par recherche : on tombe sur le passage qu'on cherche, pas sur
les marqueurs vingt lignes plus haut. Le fichier avait l'air complet — il portait
même **les deux versions** du passage, sans que rien ne dise laquelle fait foi.
C'est le pire état pour une mémoire : plus trompeur qu'une section absente.

**`verifier:memoire` les refuse désormais**, et nomme le fichier, le marqueur et
sa ligne. Éprouvé en réintroduisant l'état exact qui était passé.

**Deux sessions l'ont écrit le même jour, sans se voir** — c'est le sujet de
`CLAUDE.md` §6 en action. Celui qui est resté est **celui qui était déjà sur
`main`** : il gère en plus un faux positif que l'autre ignorait (`=======` seul
est un soulignement Markdown parfaitement légitime, et ne compte que s'il
accompagne un vrai marqueur). Le second a été retiré plutôt qu'empilé : deux
contrôles pour la même chose finissent par diverger, et l'on ne sait plus lequel
fait foi.

Le doublon de section qu'il avait entraîné est défait au passage : deux `## 81`
coexistaient (la civilité, l'en-tête du SMS). La première garde son numéro,
la seconde devient `## 82` — aucun renvoi ne la visait, vérifié avant de renommer.

### 0 sexvicies. Faire confirmer par le patron que le numéro n'est plus un lien d'appel

**Livré le 13 août 2026, non éprouvé ici, et ça ne peut pas l'être.** Le numéro
du devis et celui de la facture s'écrivent désormais de façon qu'un détecteur
d'Apple n'y voie plus un téléphone (`ARCHITECTURE.md` §81). Cet environnement
n'a que Chromium, qui n'a jamais fait cette détection : les suites vérifient que
le texte aplati ne contient plus de suite de chiffres appelable, pas ce
qu'iOS en fera.

**Ce qu'il faut lui demander**, une fois le lot sur `main` : rouvrir le lien de
son devis **depuis ses SMS** — pas depuis Safari, le chemin compte — et dire si
« Hydration failed » revient, et si le numéro reste un texte ordinaire sous le
doigt. Sans cette réponse, ce défaut n'est pas clos : c'est la deuxième
tentative sur le même, et la première paraissait juste elle aussi.

### 0 quatervicies. Les réglages : les dix rubriques sont dessinées, rien n'est codé

**Le plan est dessiné et attend son accord** — `maquettes/atlas-reglages-plan.html`
(`ARCHITECTURE.md` §86). Les deux niveaux, les quatre rôles et la forme de
l'interrupteur y sont tranchés ; **aucune rubrique n'y est ouverte**.

Ordre convenu, qui suit ses quatre priorités du 13 août 2026 :

| Lot | Rubrique | Ce qu'elle porte | État |
|---|---|---|---|
| 1 | **Le plan** | Deux niveaux, trois rôles, l'interrupteur | **dessiné le 13 août — attend son accord** |
| 2 | Identité de l'entreprise | Nom, adresse, SIRET/SIREN, TVA, IBAN | **dessiné le 13 août** (`ARCHITECTURE.md` §87) |
| 3 | Équipe et rôles | Qui a accès, et à quoi | **dessiné et validé le 13 août** (`ARCHITECTURE.md` §88) |
| 4 | Tarifs & catalogue | Prestations, main-d'œuvre, matériel | **dessiné le 13 août** (`ARCHITECTURE.md` §89) |
| 5 | Documents | Conditions, acompte, logo, texte de bas de page | **dessiné le 13 août** (`ARCHITECTURE.md` §91) |
| 6 | Notifications | Huit familles d'alertes, canal par canal | **dessiné le 13 août** (`ARCHITECTURE.md` §92) — **rien n'est envoyé aujourd'hui** |
| 7 | Le reste | Atlas IA, intégrations, apparence, abonnement, sécurité | **dessiné le 13 août** (`ARCHITECTURE.md` §93) |

**La charte, depuis le 13 août :** *« toujours en respectant le style de l'appli
ultra luxe et très moderne »*. `atlas-reglages-plan.html` recopie les jetons de
`src/lib/design-tokens.ts`, et son contrôle lit le fichier de jetons pour les
comparer — un écart rougit en nommant le jeton. **Les neuf planches antérieures
gardent l'ancien nuancier** (crème `#edece6`, bronze `#8f7130`) : les reprendre
d'un coup mêlerait un changement d'identité à un changement mécanique sur des
écrans déjà validés. Elles passent à la charte **quand leur sujet est rouvert**,
pas avant (`ARCHITECTURE.md` §86).

**LE PREMIER JOUR D'UN ARTISAN — le point le plus lourd de la série.** Sa
remarque du 13 août 2026 : *« quand l'application sera commercialisée, le devis
sera vierge, et c'est avec ces informations-là qu'il devra se remplir
automatiquement ».* Six faits vérifiés, qui s'enchaînent (`ARCHITECTURE.md`
§81) :

| | Ce qui est constaté | Ce qu'il faut écrire |
|---|---|---|
| 1 | `seed.ts` pose « Atelier Démo » **complet, IBAN compris** — son banc ne montre jamais l'état vierge | un jeu de départ qui sache démarrer à vide |
| 2 | **Aucun parcours d'inscription** : `creerEntreprise` n'est appelé que par le seed et les tests | la création d'entreprise, depuis l'application |
| 3 | ~~L'identité ne s'écrit que depuis le devis à la main~~ — **fait le 13 août 2026** : `/reglages/identite` | ~~les champs d'identité dans les réglages~~ |
| 4 | **Rien ne vérifie l'identité avant l'envoi** d'un devis | un garde-fou à l'envoi, pas à la rédaction |
| 5 | `src/app/chantiers/[id]/export/page.tsx` écrit `entrepriseNom ?? "Votre entreprise"` | un manque se signale, il ne se maquille pas |
| 6 | Le devis **fige** l'identité à sa création (`devis.ts`) — c'est juste, mais muet | l'avertissement : corriger vaut pour les **prochains** devis |

**Tant que 2, 3 et 4 ne sont pas faits, Atlas ne peut pas être confié à un
artisan** : son premier document partirait irrégulier, sans un mot.

**Trois manques révélés en dessinant le lot 2, et qui sont du CODE, pas du
dessin** (`ARCHITECTURE.md` §81) :

- ~~le régime de TVA est deviné~~ — **fait le 13 août 2026** (migration 0039,
  `ARCHITECTURE.md` §94) : il se déclare, il est figé dans la facture, et le
  repli sur le taux demeure pour les factures antérieures ;
- **le numéro de TVA intracommunautaire** existe en base et se saisit depuis le
  13 août — **mais rien ne l'imprime encore**. *Réserve : les mentions
  obligatoires n'ont pas pu être vérifiées à leur source d'ici. À faire
  confirmer avant de le poser sur le document ;*
- **le téléphone et l'e-mail ne s'impriment nulle part** : le bloc ÉMETTEUR de
  `document-commun.ts` porte le nom, l'adresse et le SIRET, rien d'autre. Le
  client n'a aucun moyen d'appeler l'artisan depuis son devis.

Manquent aussi en base, et la maquette les montre : **forme juridique** et
**titulaire du compte**.

**LE DEUXIÈME CERVEAU : CE QUI NE RETIENT RIEN.** Direction posée le 13 août
2026 (`ARCHITECTURE.md` §90, `docs/QUESTIONS.md` §17). Ce qui apprend déjà est
bien alimenté — `lecons_prix`, les cinq grilles, la base documentaire. Ce qui
manque, par ordre de poids :

| | Ce qui n'est pas retenu | Le moment qui existe déjà pour le demander |
|---|---|---|
| 1 | **Le temps réel d'un chantier** — aucune colonne nulle part. Atlas ignore donc si ses estimations de durée sont justes, alors que **c'est la durée qui fait le prix** quand aucun tarif ne correspond | la clôture d'un chantier (`src/app/termines/`) |
| 2 | Les coûts de chiffrage, figés aux valeurs d'usine | l'écran « Mes coûts », dessiné mais pas codé |
| 3 | Les délais de paiement réels | l'encaissement d'une facture |
| 4 | Ce qu'un client refuse ou fait corriger | l'état existe déjà (`src/lib/etat-envoi.ts`) |

**La règle avant de coder l'un d'eux :** ne pas demander « quelle table ? » mais
**« qui l'écrit, et à quel moment ? »**. `historique_prix` était lue et jamais
écrite — une mémoire que personne n'alimente est du décor.

**LE RÉGLAGE QUI AGIT SANS EXISTER À L'ÉCRAN**, trouvé le 13 août en répondant
à sa question sur l'IA : `parametres_chiffrage` porte **cinq valeurs par
entreprise** — 200 €/jour l'ouvrier, 280 € le chef, 35 € le déplacement, 20 % de
marge, 20 % de TVA — et **aucun écran ne permet de les changer**. Elles décident
du prix proposé dès qu'aucun tarif ne correspond. Un artisan dont l'ouvrier coûte
260 € verra des prix trop bas sans savoir pourquoi (`ARCHITECTURE.md` §89).

**Ce que le lot 4 ajoute à cette liste :** `tarifs` n'a **aucune colonne de
famille** — prestations, main-d'œuvre et matériel n'existent pas —, et rien ne
signale un tarif **sans unité**, alors qu'un prix sans unité n'est pas un prix.
(Les tranches des grilles, elles, se règlent depuis le 14 août —
`ARCHITECTURE.md` §105.)
(L'unité, elle, se **choisit** depuis le 14 août au lieu de se taper —
`ARCHITECTURE.md` §101 — mais rien ne signale encore celle qui manque.)
Les cinq grilles n'affichent pas **combien de prix elles ont appris**, ni la
phrase qui dit qu'une grille vide n'est pas une panne (`ARCHITECTURE.md` §89).

**Ce qui n'est PAS acquis, et ne doit pas être codé sur la foi de la maquette :**

- **le rôle « commercial » n'existe nulle part.** `membres_entreprise.role` ne
  connaît que `proprietaire` et `membre` ; `docs/QUESTIONS.md` §10 décrit
  l'éditeur, le patron et le salarié. L'ajouter suppose une migration **et**
  une décision, pas seulement un écran ;
- **le cloisonnement par rôle est aujourd'hui inexistant** côté serveur, et le
  lot 3 l'a mesuré : `exigerProprietaire` protège **vingt-trois points
  d'écriture**, mais `getRole` n'est appelé dans **aucun écran** — rien ne filtre
  la LECTURE. Un « membre » voit tous les prix, tous les devis, tous les
  montants. `QUESTIONS.md` §10 exige que la donnée ne SORTE pas du serveur :
  c'est le vrai coût de ce lot, et il est dans les dépôts, pas dans l'affichage ;
- **aucun parcours d'invitation n'existe** : `membres-entreprise.ts` sait
  ajouter et retirer un membre, aucun écran ne l'appelle, et rien n'envoie
  d'invitation. Un patron ne peut donner aucun accès aujourd'hui ;
- ~~la question du 7 août sur la portée du salarié~~ — **tranchée le 13 août
  2026** : accès à tout par défaut, et le patron restreint **personne par
  personne** à ses seuls chantiers. Le rôle « commercial » est validé tel que
  dessiné. Il faut donc une colonne de portée sur `membres_entreprise`, en plus
  du quatrième rôle (`docs/QUESTIONS.md` §10) ;
- **le logo sur le devis n'existe pas** : `document-commun.ts` ne pose aucune
  image. `pdf-lib` sait incorporer un PNG — c'est un lot court. ~~À dire au
  patron avant de dessiner le lot 5~~ : **dit et dessiné le 13 août**, et
  « remplacer le devis par le sien » est **refusé avec sa raison** à l'écran
  (`ARCHITECTURE.md` §91) ;
- **les conditions sont aujourd'hui en dur** : « 30 jours » dans
  `devis-pdf.ts`, la mention légale dans `facture-pdf.ts`, et un seul champ
  libre `conditionsPaiement`. Les rendre réglables demande une table, pas un
  champ de plus.

---

### 0 unvicies. Le chevron de retour, dernier bouton hors charte

### 0 tricies. ~~Les trois points de la dictée~~ — **CODÉ le 13 août 2026 (proposition C)**

**Sa demande du 13 août 2026**, capture de l'écran « Un chantier » à l'appui :
*« une fois qu'on a appuyé sur le dictaphone, on ne sait pas ce qui se passe.
Les trois petits points sont fixes […] on ne sait pas si ça bug ou non. Si les
trois petits points se mettent en mouvement et font des vagues pour dire que
c'est en train de rédiger, là, on sait qu'il se passe quelque chose. »*

**Ce n'est pas une animation qui s'est arrêtée.** C'est le caractère « … », un
seul glyphe posé tel quel — `DicterCoordonnees.tsx:114`. Il n'y a rien qui
puisse bouger : trois points séparés sont à écrire pour qu'une vague existe.

**Deux choses aggravent l'attente**, qu'il n'a pas nommées mais qui tiennent au
même instant, et qui comptent peut-être plus que la vague :

1. le bouton passe à `opacity: 0.5` — le vocabulaire d'un bouton **éteint**,
   pas d'un bouton qui travaille ;
2. **aucune phrase ne s'affiche.** L'écran parle quand il écoute (« J'écoute —
   touchez pour arrêter. ») et quand il a fini (« 1 information reprise… »), et
   il se tait exactement pendant le seul moment où l'on se demande s'il est en
   panne. Les mots disent ce qu'aucune animation ne dira.

**Deux planches, et c'est la seconde qui tranche :**

| | Fichier | Ce qu'elle sert |
|---|---|---|
| 42 | `docs/maquettes/42-les-trois-points-qui-attendent.html` | Les cinq gestes côte à côte, et l'exposé du défaut. Doublée d'images animées (`docs/maquettes/images/`), pour la conversation |
| **43** | `docs/maquettes/43-l-attente-a-lessai.html` | **Celle qu'il manipule** — il appuie sur le micro, arrête, les points bougent. Sa demande du 13 août : *« juste des points que je puisse cliquer dessus […] pour voir comment ça rend »*. Engendrée par `scripts/engendrer-maquette-sequence.mjs` |

Les cinq attentes : A la vague (4 px), B la vague ample (7 px), **C le souffle**,
D le point qui court, E l'anneau qui tourne. **Il a répondu « code la C »** le
13 août — les quatre autres restent dans les planches, à reprendre de là si le
sujet se rouvre plutôt qu'à redessiner.

**Ce qui a été porté dans l'application :**

| | Fait | Où |
|---|---|---|
| 1 | Le geste, partagé | `src/components/atlas/PointsQuiSoufflent.tsx` |
| 2 | Les mesures (0,72 → 1,5 ; 1,25 s ; décalages 0,16 et 0,32) | `globals.css`, `.atlas-souffle` |
| 3 | L'écran | `src/app/chantiers/nouveau/DicterCoordonnees.tsx` |
| 4 | La suite qui le tient | `scripts/test-attente-dictee-e2e.ts` |

**Quatre choses à ne pas défaire**, chacune payée par un vrai défaut :

1. **Le geste vit dans un composant, pas dans l'écran.** Une attente recopiée
   divergerait comme les boutons peints à la main l'ont fait deux fois
   (`ARCHITECTURE.md` §66 et §73).
2. **Le bouton ne redevient PAS à demi effacé.** C'était la moitié du défaut :
   le vocabulaire d'un bouton éteint. Il reste hors d'atteinte (`disabled`) —
   ne pas le rendre pressable, un second appui lancerait une seconde dictée.
3. **La phrase reste.** C'est la seule des trois moitiés qui parvienne à qui n'a
   pas les yeux sur l'écran (`role="status"`), et probablement la plus utile.
4. **Sous « mouvement réduit », les points respirent encore.** Tout couper
   rendrait le défaut d'origine à qui a activé ce réglage.

**La suite RALENTIT le serveur de trois secondes**, sinon elle courrait plus vite
que l'attente et passerait au vert sans avoir rien regardé. Elle a été confrontée
au défaut d'origine : les quatre points rougissent, chacun **en nommant son
coupable** — et c'est le second jet, le premier sortait un « Timeout » sur un
sélecteur, ce qui envoie lire le contrôle au lieu de l'écran.

### 0 tricies ter. ~~La même attente immobile sur le bouton d'ajout de photo~~ — **fait le 13 août 2026**

Signalé en passant, puis tranché par lui le jour même : *« oui souffle aussi pour
la photo »*. `Pellicule.tsx` portait le même caractère « … » immobile que la
dictée, à la lettre près — donc le même défaut. Il prend le même composant, et
les points y sont **or** et non vert : ils héritent de `currentColor`, donc de la
couleur du bouton qui les porte. Le libellé annonce l'envoi pendant l'envoi, au
lieu de continuer à proposer d'ajouter.

**Un piège d'outillage payé ici, et qui resservira à toute suite qui RALENTIT le
serveur :** router une adresse dans Playwright **désactive le cache HTTP de toute
la page**, pas seulement des requêtes visées. La visionneuse repartait donc du
réseau pour une image déjà affichée, son `<img>` n'avait pas fini de charger, sa
boîte faisait zéro pixel — et l'échec accusait la visionneuse, qui n'y était pour
rien. Deux règles en sortent :

1. **relâcher la route dès la mesure faite** (`page.unroute`) ;
2. **la relâcher APRÈS que l'envoi soit terminé** — la couper en vol laisse un
   appel à moitié traité, et Playwright répond « Route is already handled! », une
   erreur qui n'apprend rien sur ce qu'on éprouve.

Trouvé en **affichant les images présentes** plutôt qu'en supposant : elles
étaient là, toutes les deux, au bon endroit.

**Trois choses à savoir avant d'y toucher :**

1. **Une image fixe ne peut pas montrer un mouvement.**
   `scripts/animer-maquette-points.mjs` fabrique un GIF par proposition, sans
   ffmpeg (absent d'ici) — et il relit ce qu'il vient d'écrire, parce qu'au
   premier jet il annonçait « ✓ » sur une image FIXE : `pageHeight` passé à côté
   de `raw` au lieu de dedans est ignoré **en silence**. Un script qui ne relit
   pas sa sortie certifie exactement le défaut qu'il répare.
2. **Le contrôle mesure une VAGUE, pas un mouvement.**
   `scripts/verifier-maquette-points.mjs` exige un déphasage entre le premier et
   le troisième point : trois points qui montent **ensemble** bougent de 4 px,
   passeraient tout contrôle d'amplitude, et ne feraient aucune vague. Éprouvé
   en cassant les délais — il rougit en nommant A.
3. **L'avant sert de témoin, dans les trois outils.** Il doit rester immobile
   **et à demi effacé** — le montrer à pleine encre le ferait paraître moins
   mauvais qu'il n'est, et fausserait la comparaison en sa faveur. S'il bouge,
   c'est la mesure qui ment. Le GIF le prouve tout seul : l'encodeur fusionne
   les images identiques, et l'avant se réduit à **une seule**.
4. **La 41 se PARCOURT, elle ne se constate pas.**
   `scripts/verifier-maquette-sequence.mjs` joue les deux appuis puis
   « Recommencer », sur les six. Un parcours à moitié joué ne prouve que la
   moitié qu'on joue. Deux pièges y sont écrits : le bouton d'arrêt **bat**,
   donc Playwright refuse d'appuyer dessus (`{ force: true }`, même famille que
   `locator.screenshot()`) ; et le retour du résultat est **décoché par
   défaut**, sans quoi on jugerait cinq gestes sur quatre secondes chacun.

### 0 tricies quater. ~~L'attente qui s'éternise~~ — **faite le 13 août 2026**

Sa réponse à la question laissée ouverte : *« oui fait ça »*. Une vague qui
souffle depuis trente secondes redevient une vague qui ne dit rien.

**Trois temps**, dans `src/lib/attente-longue.ts` — fonction pure, éprouvée sans
navigateur :

| | Ce que l'écran dit | Pourquoi ce moment-là |
|---|---|---|
| 0 s | « Atlas rédige… » | la chaîne prend deux à dix secondes |
| 12 s | « C'est plus long que d'habitude. » | au-delà de la bande normale, sans être soupçonneux |
| 45 s | « Pas de réponse. Réessayez. » + le micro revient | assez long pour qu'une chaîne lente aboutisse |

**Trois choses à ne pas défaire :**

1. **Renoncer n'interrompt PAS l'appel.** S'il répond enfin, les champs vides se
   remplissent. Le couper obligerait à tout redicter alors que la réponse était
   peut-être à une seconde.
2. **Une réponse en retard ne touche l'écran que si elle est encore attendue**
   (`tour` dans `DicterCoordonnees`). Sans ce garde-fou, la première dictée, en
   revenant, remettait l'écran au repos **au milieu du nouvel enregistrement**.
3. **L'étape se calcule sur le temps ÉCOULÉ**, jamais posée en dur : un téléphone
   qui s'endort étire ses minuteries, et le réveil des douze secondes peut tomber
   à la cinquantième — il faut alors rendre la main, pas dire « c'est un peu
   long ».

**LE DÉFAUT À RETENIR, et il ne se voyait qu'à la capture.** La première phrase
des douze secondes faisait cent caractères. Dans la colonne de 190 px, elle
prenait toute la largeur et **cassait « Un chantier » en deux lignes**, en plein
milieu de l'attente. Mesuré ensuite dans la vraie page, sur son écran de 390 px :
31 caractères font 163 px et tiennent sur une ligne, 33 en font 181 et passent à
deux.

Deux contrôles en sont nés, et le second existe parce que le premier a dormi :

- un **plafond de 31 caractères**, sans navigateur, qui rougit à l'écriture de la
  phrase. Posé d'abord à 60, il laissait passer la phrase de l'abandon — *un
  plafond trop généreux est un contrôle qui dort* ;
- le **nombre de lignes du titre**, mesuré à l'écran **dans les deux états**.
  Posé au seul état des douze secondes, il n'a rien vu de l'abandon : un contrôle
  posé à un seul endroit d'un parcours n'éprouve que cet endroit-là.

### 0 tricies quinquies. Le message de fin de dictée casse le titre, lui aussi

**Trouvé le 13 août 2026 en mesurant les phrases d'attente**, et **antérieur à ce
travail** : « 1 information reprise — relisez avant de créer. » fait 47 caractères
et 184 px — donc deux lignes, donc « Un chantier » cassé en deux. À chaque dictée
réussie.

**Non touché, et c'est délibéré** : c'est une phrase que le patron voit depuis
des jours sans s'en plaindre, et la raccourcir change ce qu'elle lui dit. À lui
de trancher. Une piste s'il le veut : « 3 informations reprises — relisez. »
(35 caractères), ou déplacer la ligne sous l'en-tête, où elle aurait toute la
largeur.

### 0 tricies bis. Les contrôles de maquette ne sont joués par personne

`scripts/verifier-maquette-*.mjs` (pastille, logo, bascule, bouton de la facture,
et désormais les points) ne sont appelés **ni par la batterie, ni par la CI** :
ils se lancent à la main. Un contrôle que personne ne joue est un contrôle qui
n'existe pas — il rougira le jour où plus personne ne saura pourquoi.

Non fait d'office : les brancher allonge `verifier:avant-livraison` de plusieurs
minutes pour éprouver des pages qui ne partent pas en production. Le bon endroit
est vraisemblablement la CI, sur les seuls fichiers touchés.

### ~~0 sexvicies. Le chemin vers le devis modifiable~~ — **choisi et codé le 13 août 2026**

**Sa décision, après avoir vu les cinq :** *« le modifier en or à droite du mot
devis est parfait, code celui-là »* — la proposition B. C'est fait,
`ARCHITECTURE.md` §104. Ce qui suit est gardé parce que le raisonnement, lui,
resservira.

**Sa capture du 13 août 2026, 21 h 00 :** *« J'ai un devis sur le feu. En
cliquant sur Mme Félicie, voilà où j'arrive, mais si je veux modifier mon devis
avant de l'envoyer, je peux pas. Fais en sorte qu'en cliquant sur le mot devis
en haut à gauche j'arrive sur la page de mon devis pour la modifier. Crée-moi
des visuels avant de coder, et il faut que ce soit intuitif. »*

**Le manque est réel, et vérifié dans le code.** `ExportClient` n'offre
« Modifier mon devis » que sur `EcranDevisParti`, c'est-à-dire APRÈS l'envoi.
Avant — au moment précis où l'on corrige — aucun chemin ne mène à
`/chantiers/<id>/devis-complet` depuis cet écran.

**Cinq propositions dessinées**, `docs/maquettes/45-modifier-son-devis.html` :

| | Où le geste se pose | Ce qu'elle vaut |
|---|---|---|
| A | Le mot « Devis » devient la porte — **son idée** | Zéro place. Mais un titre qui est secrètement un lien ne s'annonce pas : dessinée avec un crayon et un filet doré, sans quoi personne ne devine |
| B | « Modifier » en face du titre | Se lit sans deviner, place jusque-là vide |
| C | « Modifier » sur la carte des lignes | **On touche ce qu'on veut changer** — c'est là que l'œil est quand un prix cloche |
| D | À côté de « Aperçu du PDF » | Aucune place nouvelle : relire et corriger côte à côte |
| E | La carte des lignes entière, chevron doré | La cible la plus large ; un peu de mobilier en plus |

**Rien n'est codé.** `CLAUDE.md` §3 bis : une demande d'apparence se dessine
avant de se coder. **Il reste à en désigner une.**

**Ce qu'elle coûtera, une fois choisie** : un `<Link>` dans `ExportClient`, sur
la branche d'AVANT l'envoi uniquement — après, le devis ne se modifie plus, il
se *reprend*, et c'est un autre geste (`ARCHITECTURE.md` §66). Plus une suite
qui vérifie que le chemin existe avant l'envoi et **pas** après. Une heure.

### 0 quinvicies. Le chevron de retour, dernier bouton hors charte

<!-- Renuméroté le 13 août 2026 : « 0 unvicies » désignait DÉJÀ le raccordement
     de l'agenda iCloud, plus bas, et `HANDOVER.md` le vise sous ce numéro. Deux
     sessions avaient posé le même. C'est l'aîné qui garde le sien — la règle du
     HANDOVER, « celle qui est déjà là garde son numéro ». Aucun renvoi ne
     visait celui-ci. -->
### 0 quattuorvicies. ~~Le corps de la fiche montre encore un chantier neuf~~ — **CLOS le 13 août : « ne touche pas au centre »**

**Trouvé en corrigeant son défaut du 13 août** (`ARCHITECTURE.md` §98), et
laissé ouvert exprès. L'état dit maintenant « Devis prêt à envoyer » et l'étape
suivante « Envoyer le devis au client » — mais **le centre de l'écran affiche
toujours l'anneau de dictée** et « Appuyez et décrivez le chantier », sur un
chantier dont le devis est écrit.

**Il a tranché le jour même : « non non, mais ne touche pas au centre en fait.
Tu n'as pas compris ma requête ».** Ce qu'il voulait était ailleurs — que la
liste le ramène à l'écran où il s'est arrêté (`ARCHITECTURE.md` §98), et c'est
fait. La maquette `maquettes/atlas-centre-de-la-fiche.html` reste au placard :
elle n'a rien changé dans `src/`, et elle raconte le chemin.

**Ne pas rouvrir ce point sans qu'il le demande.**

Ce qui est déjà su, et qui cadre le dessin : l'étape suivante ne vit que dans le
tiroir, replié par défaut. Un chantier avancé devrait probablement porter son
geste au centre, là où l'anneau se trouve — mais c'est lui qui tranche.

### 0 septvicies. Cinq boutons carrés, hors des écrans du patron — à trancher

**Trouvé le 13 août 2026**, en réparant le contrôle des boutons arrondis : son
motif ne regardait ni les `<Link>`, ni les rayons NOMMÉS de Tailwind. Réparé, il
dénonce **six** boutons. Un seul était celui que le patron signalait (« Créer la
facture »), corrigé le jour même. Les cinq autres n'ont jamais été arbitrés :

- ~~`src/app/devis/[jeton]/formulaire.tsx` — accepter, demander une correction,
  refuser~~ et ~~`src/app/factures/[jeton]/page.tsx` — le téléchargement du
  PDF~~ : **tranché par le patron le 13 août 2026**, capture des deux écrans à
  l'appui. « Oui » : ses clients voient la capsule eux aussi. Les couleurs
  propres à ces écrans restent — c'est l'identité qui devait rester distincte,
  pas la forme du geste ;
- `src/components/ScreenHeader.tsx` — le chevron de retour, 32 × 32 en
  `rounded-md`. **Seul point restant.** Une icône encadrée, pas un bouton
  d'action : l'arrondir entièrement en ferait une pastille ronde, ce qui n'a
  été demandé nulle part. Question posée le 13 août, sans réponse à ce jour.

Ils sont **déclarés comme exceptions nommées** dans
`scripts/test-boutons-arrondis.ts`, chacune avec sa raison : un bouton NEUF écrit
carré ailleurs fait toujours rougir le contrôle.

**Répondu le 13 août 2026 :** la capsule descend jusqu'à son client. Reste le
chevron, sur lequel il ne s'est pas prononcé — et qui n'est pas un bouton
d'action, d'où l'hésitation.


### 0 quinvicies. Deux migrations portent le même numéro — à ranger avant que ça morde

**Constaté le 13 août 2026, en fusionnant.** `drizzle/` contient deux `0035` et
deux `0036` :

```
0035_agenda_apple.sql          0036_achats_tva.sql
0035_periodicite_tva.sql       0036_monsieur_plutot_que_chez.sql
```

Nées de sessions parallèles qui ont pris le numéro suivant chacune de leur côté.

**Ce n'est pas cassé aujourd'hui**, et il faut le dire aussi : le lanceur trie
sur le nom de fichier ENTIER, donc l'ordre est déterministe, et ces quatre-là
touchent des tables différentes. Toutes se sont appliquées.

**Ce qui mordra un jour :** deux migrations de même numéro qui toucheraient la
même table s'appliqueraient dans un ordre décidé par l'alphabet du libellé —
« achats » avant « monsieur » — et non par celui où elles ont été écrites. Une
conversation qui lit `ls drizzle/ | tail -1` pour trouver « la dernière » se
trompera aussi.

**Ce qu'on ne fait pas :** renuméroter. Ces fichiers sont **déjà appliqués**,
ici et peut-être sur son banc ; un fichier renommé serait rejoué de zéro.

**Ce qui reste à faire :** un contrôle qui refuse deux migrations de même
numéro, pour que la prochaine collision se voie à l'écriture et non six mois
plus tard. Une demi-heure. Qui peut le faire : n'importe quelle conversation.

### 0 tervicies. ~~`test-planning-vers-facture-e2e` échoue par intermittence~~ — **CAUSE TROUVÉE ET CORRIGÉE le 13 août 2026**

**Constaté le 13 août 2026, en éprouvant autre chose.** Le dernier cas de cette
suite — *« clôturé AVANT sa date : il quitte le planning pour les terminés »* —
échoue **par intermittence** sur `page.goto` au bout de 45 s, tantôt sur
`/termines`, tantôt sur `/planning`. Sur **six exécutions** ce jour-là : quatre
rouges, deux vertes.

**Et « le serveur est chargé » n'explique plus.** `ouvrir()` fait déjà DEUX
tentatives de 45 s : la page reste donc muette **plus de quatre-vingt-dix
secondes**, alors qu'elle répond en 333 ms mesurées hors batterie. Ce n'est pas
de la lenteur, c'est un blocage. Piste non écartée, faute de l'avoir creusée :
l'épuisement du bassin de connexions (`poolMax`) en fin de batterie — cette
suite bâtit sept chantiers avec devis et PDF, et c'est la plus lourde du lot.

**Ce n'est PAS la civilité** : vérifié en remisant toutes les modifications du
jour et en rejouant la suite sur `main` intact — même échec, au même endroit.
Le défaut lui est antérieur.

**Et son message n'explique pas tout.** Il affirme : *« C'est le serveur de
développement qui n'a pas suivi, pas l'écran : il répond en quelques centaines
de millisecondes hors batterie »*. Or **la suite a aussi échoué jouée seule**,
sans aucune autre en parallèle — la charge de la batterie ne suffit donc pas à
l'expliquer. Un message qui donne une cause certaine là où elle ne l'est pas
envoie chercher au mauvais endroit (`AGENTS.md`).

**LA CAUSE, et elle donne raison à cette fiche sur toute la ligne.** Ce n'était
ni ce cas-là, ni la charge : `run-e2e-tests.ts` recueillait la sortie du serveur
par un **tuyau**, drainé par son propre processus — lequel lance chaque suite
avec `spawnSync`, **qui bloque sa boucle d'événements**. Pendant une suite,
personne ne vidait le tuyau ; à 64 Ko, le serveur se bloquait **en écriture** et
cessait de répondre. Le dépassement tombait alors sur l'écran suivant, au
hasard : `/planning` une fois, `/termines` la fois d'avant.

**C'est exactement pourquoi elle échouait aussi jouée seule** — l'observation de
cette fiche, celle que le message d'origine ne pouvait pas expliquer. Et
pourquoi elle passait toujours lancée à la main : le serveur écrit alors dans un
terminal, que personne ne bloque.

La sortie va désormais dans un fichier, par descripteur passé à l'enfant.
Mesuré des deux côtés : rouge 3 fois sur 3 avec le tuyau, vert avec le fichier,
à code applicatif identique.

### ~~0 duovicies. La civilité du client~~ — **tranchée et codée le 13 août 2026**

**Sa décision, le soir même :** *« Tu as raison, il faut intégrer une case
monsieur-madame. Mais je veux que ça soit sous la forme Mr Mme, en cliquable, on
choisit au-dessus du nom. »* C'est fait — deux pastilles à la création et sur
l'écran du devis, `ARCHITECTURE.md` §81.

**Ce qui reste ouvert, et qu'il faudra lui poser un jour :** une civilité choisie
de travers **ne se corrige plus** après la création. Les pastilles avaient été
posées sur l'écran du devis pour cela ; il les y a fait retirer le jour même —
*« il ne faut pas qu'il y ait les pastilles cliquables sur le devis »* — et il a
raison sur le fond : cet écran est le document, pas la fiche. Il manque donc un
**écran de fiche client**, qui n'existe nulle part aujourd'hui. Tant qu'il ne le
demande pas, on ne l'invente pas. Qui peut le faire : lui.

**Et un second point ouvert :** il n'y a que deux pastilles. Une société se dit donc en n'en touchant aucune — l'application
reconnaît alors « SARL », « SCI », « Mairie »… et se tait. Cela suffit
aujourd'hui : ses clients sont des particuliers. **À rouvrir le jour où il
facture des entreprises**, où une troisième pastille dirait la chose au lieu de
la laisser deviner. Qui peut le faire : lui.

*Ce qui suit est gardé parce que le raisonnement resservira le jour de cette
question-là.*

### ~~0 duovicies bis. La civilité du client — l'arbitrage d'origine~~

Le 13 août 2026, il a demandé que le devis dise « Mr. Martins » et non « Chez
Martins ». C'est **fait**, écran et message tout prêt compris
(`ARCHITECTURE.md` §77). Mais la fiche client ne porte **aucun champ de
civilité** : « Mr. » est un défaut posé sur tout nom qui n'en annonce pas
d'autre.

**Ce que ça veut dire concrètement, et pourquoi ça ne peut pas rester ainsi
indéfiniment :** une cliente saisie « Roux » verra « Mr. Roux » sur son devis,
**et le message qui part chez elle dira « Bonjour Mr. Roux »**. L'application sait déjà se taire devant « Mme Roux » ou « SARL Untel » —
ces deux cas sont couverts — mais elle ne devine pas un patronyme nu.

| | Piste | Ce que ça vaut |
|---|---|---|
| a | **Un choix à la création du client** : trois pastilles — Mr., Mme, ni l'un ni l'autre (société). Un appui. | La seule qui dise la vérité. Coûte une colonne, une migration, et trois pastilles sur un écran déjà chargé. |
| b | Laisser le patron écrire « Mme Roux » lui-même dans le nom | Gratuit, marche déjà — mais il faut qu'il y pense à chaque fois, et un oubli part chez la cliente. |
| c | Ne rien mettre du tout et revenir au nom nu | Annule sa demande du 13 août. |

**Qui peut le faire : lui seul.** C'est un arbitrage de produit, pas un choix
technique — et rien ne sera ajouté sans son accord (`CLAUDE.md` §4).

*(La seconde question — le message qui part chez le client — a été tranchée le
soir même : il dit désormais « Bonjour Mr. Martins ». C'est ce que ses clients
lisent, et c'est donc là que l'erreur de civilité se verra en premier.)*

### ~~0 octodecies. Le message du devis figé désignait une porte invisible~~ — **codé le 2026-08-13 (proposition A)**

**Rien n'est codé** (`CLAUDE.md` §3 bis). Le patron, le 13 août, capture à
l'appui : *« le message dit de consulter la case devis mais aucune case devis
existe »*, et il demande un avis — créer la case, ou retirer le message ?

**Ce qui est vrai, vérifié dans le code :** l'écran Devis existe bien
(`/chantiers/[id]/export`, `chantier-etat.ts` le pose comme étape « Devis »),
mais il vit dans le **tiroir** de la fiche, et **aucune porte n'y mène depuis
`devis-complet`** — où le message s'affiche. De plus, **deux écrans s'appellent
« Devis »** de son point de vue : celui qu'il regarde, et celui où l'on corrige.

`docs/maquettes/40-le-message-du-devis-fige.html` — témoin + trois façons :

| | Ce que c'est | Ce que ça coûte |
|---|---|---|
| A | le message devient la porte (lien sous la phrase) | rien — la retouche la plus courte |
| B | un vrai bouton en capsule | il attire l'œil avant le devis qu'on vient lire |
| C | plus de message du tout | le jour où il touche un prix, rien ne se passe et rien ne le dit |

**Mon avis, donné et assumé : A.** Ne PAS créer de nouvelle case — l'écran
existe, et lui donner un second accès permanent ferait deux portes vers la même
pièce, ce qu'on vient d'éviter sur l'écran du devis.

**Les mots ne sont pas tranchés** : « Le corriger et le renvoyer », « Corriger
ce devis », « Reprendre le devis ». Ils lui appartiennent.
### 0 duovicies. ~~`/chantiers/<id>/facture` ne répond plus en fin de batterie~~ **élucidé le 13 août 2026**

**Ce n'était ni la base, ni le pool, ni l'écran.** Le contrôle « clôturé AVANT
sa date » de `test-planning-vers-facture-e2e.ts` échouait **trois fois sur
cinq** en batterie complète et passait **7/7 joué seul**.

| Piste | Comment elle a été écartée |
|---|---|
| `networkidle` attendait un silence qui n'arrive jamais | Remplacé par `domcontentloaded` — **sans effet** |
| Simple lenteur | Délai porté à 120 s — **dépassé aussi** |
| Verrou en base | Guetteur sur `pg_stat_activity` : **aucune** requête bloquée. Deux transactions arrêtées dès leur `begin`, PostgreSQL attendant que l'application lui reparle |
| Pool de connexions saturé | Relevé à l'instant même : **2 connexions, 1 libre, 0 en attente** |

**Ce que la sonde posée dans la page a montré :** elle lit la session, le
chantier et la facture existante en **193 ms**, puis le premier `await` suivant
prend **44 920 ms** — et repart **à la milliseconde où le navigateur
abandonne**. Le serveur de DÉVELOPPEMENT met ce rendu en attente jusqu'à ce que
le client s'en aille.

**Ce que ça ne concerne pas :** le banc du patron sert une version **bâtie**, où
ce comportement n'existe pas. Aucun défaut de produit ici.

**Corrigé** en appliquant à cette navigation le `ouvrir()` qui vivait déjà plus
haut dans le fichier, écrit pour exactement cette raison : il retente une fois,
et nomme le vrai coupable s'il échoue encore.

### 0 unvicies. La feuille d'envoi montre deux boutons pleins à la fois

**Sa capture du 13 août 2026**, sur un devis dont le client demandait une
correction : « Ouvrir le SMS tout prêt » et « Corriger et renvoyer », l'un sous
l'autre, tous deux pleins. *« Il faut qu'il y ait juste qu'un seul bouton. »*

**Le second n'est pas un doublon, et c'est ce qui rend l'arbitrage réel :**
`ExportClient` le rend dès que `etatEnvoi` vaut `retourne`, `a_corriger` ou
`caduc` — et **c'est le seul endroit d'Atlas où naît une version corrigée**. La
carte du chantier dit « Corriger le devis » et mène ici
(`src/lib/suite-de-la-reponse.ts`, qui explique pourquoi elle ne reprend pas à
sa place). Le retirer purement et simplement supprime la correction.

**Le vrai défaut est ailleurs** : après un envoi réussi, `etatEnvoi` n'est pas
recalculé — l'écran reste sur l'état d'avant et propose de corriger un devis
qu'on vient de corriger et d'envoyer.

**Deux autres demandes, elles, ne se discutent pas :** « Copier le lien » quitte
la rangée des trois actions, et « Plutôt par e-mail → » passe du gris 13 px à
l'or, en gras, un peu plus gros.

**Maquette `docs/maquettes/44-la-feuille-denvoi.html`** — deux lectures (A : le
bouton quitte la page ; B : un seul bouton par moment) montrées dans les DEUX
moments, plus trois dosages de la ligne dorée. **En attente de sa lettre et de
son numéro. Rien n'est posé dans `src/`.**


### 0 unvicies. ~~Relier l'agenda iCloud~~ — **codé le 12 août 2026**, reste à éprouver chez lui

**Sa question du 12 août 2026**, capture du Calendrier d'Apple à l'appui : *« je
peux connecter ce calendrier à mon appli ? »* Réponses obtenues : le compte
derrière la vitrine est **iCloud**, et il veut **les deux sens** — Atlas lit ses
rendez-vous, Atlas y écrit ses chantiers.

**Codé, éprouvé pour tout ce qui décide, et pas au-delà** — le détail et le
pourquoi sont dans `ARCHITECTURE.md` §75, la réponse en langage courant dans
`docs/QUESTIONS.md` §14.

| | Fait | Où |
|---|---|---|
| 1 | Migration : `fournisseur IN ('google','apple')`, mot de passe chiffré, agendas lus, calendrier d'écriture | `drizzle/0035_agenda_apple.sql` |
| 2 | CalDAV : découverte, `calendar-query`, `PUT`, `DELETE` | `src/server/agenda/apple.ts` |
| 3 | Lecture et écriture de l'iCalendar | `src/lib/ics.ts`, `src/lib/caldav.ts` |
| 4 | L'écran, d'après la maquette | `src/app/reglages/agenda/AgendaAppleClient.tsx` |
| 5 | Les chantiers montent et redescendent avec le planning | `src/server/repositories/agenda-apple.ts` |

**CE QUI RESTE, et qui ne peut pas être fait ici :** aucun échange réel avec
iCloud n'a eu lieu — le réseau refuse `caldav.icloud.com` (essayé le 12 août,
connexion refusée). Restent à éprouver **sur son banc**, avec un vrai mot de
passe pour les apps : la découverte des agendas, la lecture, le dépôt, le
retrait. **Ne pas annoncer le raccordement comme éprouvé avant.**

**Ce qui se cassera en premier, si quelque chose casse**, et par où commencer :

1. **la découverte** — iCloud redirige de `caldav.icloud.com` vers le serveur du
   compte ; les redirections sont suivies à la main pour que `PROPFIND` ne
   devienne pas `GET` ;
2. **la double authentification** — sans elle, Apple n'émet pas de mot de passe
   pour les apps, et le refus arrive en 401 comme un mot de passe faux ;
3. **le dépôt** — un agenda partagé en lecture seule est déjà écarté de la
   liste, mais un serveur qui n'annonce pas ses privilèges est supposé
   inscriptible : le refus n'arriverait alors qu'au `PUT`.

Ce que le patron verra dans les trois cas : la phrase d'Apple, telle quelle, sur
l'écran des réglages. C'est voulu — une erreur reformulée envoie chercher au
mauvais endroit.

### 0 vicies. Le badge de Next recouvre son onglet « Chantiers »

**Mesuré le 12 août 2026**, en cherchant pourquoi la CI virait au rouge six
fois de suite sur `test-rien-de-recouvert-e2e.ts`.

Le badge de développement de Next — celui qui affiche « 1 Issue », et par lequel
le patron a trouvé l'erreur d'hydratation de Safari — se pose **en bas à
gauche**, exactement sur l'onglet « CHANTIERS » (mesuré : l'onglet occupe
x 14→105, y 632→654 ; le badge, 56 px dans le coin, le recouvre). Il
n'apparaît que lorsqu'il a quelque chose à signaler — d'où une CI rouge par
intermittence, et une suite verte ici où rien n'était signalé.

**La suite l'écarte désormais nommément** : ce badge n'existe pas dans la
version bâtie, et un contrôle qui échoue au hasard apprend à ignorer le rouge.
Le témoin vérifie qu'un vrai recouvrement est toujours attrapé.

**Mais chez lui, le problème est réel** : son banc sert le mode développement,
donc le badge est sur son écran, sur sa navigation.

Trois pistes, aucune tranchée — et aucune bonne telle quelle :

- le **déplacer** (`devIndicators: { position }`) : les deux coins du bas sont
  pris par la barre d'onglets, et sur l'accueil les deux coins du haut portent
  déjà un bouton. Mesuré, pas supposé ;
- l'**éteindre** (`devIndicators: false`) : on perdrait le « 1 Issue » — or
  c'est par lui qu'il a signalé la panne de Safari. Mauvais échange ;
- faire **servir une version bâtie** à son banc, où le badge n'existe pas. C'est
  probablement la bonne réponse, et elle dépasse ce point.

### 0 quindecies. ~~La ligne « Planifiés » porte un geste de trop~~ — **réglé le 12 août 2026**

Vu en capture en posant le chevron : la ligne portait trois gestes et un nom sur
390 px, et c'est le nom qui cédait — « Chez M. Bernard » s'affichait
« Chez M. Be… ».

**Il a tranché le jour même**, en regardant la capture : *« il faut que le créer
la facture, tu le mettes dans le chevron. Il faut cliquer sur le chevron, la
page s'ouvre avec le GPS et tout machin, et là tu mets créer la facture. »*
« Créer la facture » est donc passé dans la feuille ; la ligne ne garde que le
nom, la date, « Déplacer » et le chevron. Le nom passe d'environ 110 px à plus
de 250. `ARCHITECTURE.md` §70.

### 0 quaterdecies bis. ~~Un chantier sans adresse n'a plus de chemin pour la saisir~~ — **réglé le 13 août 2026**

Il a tranché sur maquette (`docs/maquettes/34`, variante B) : *« ça, c'est au cas
où la fiche entière n'a pas été rentrée. Dans ce cas-là, tu peux faire ça, mais
avec le bouton, tu le mets arrondi. »*

Un bouton **« Saisir l'adresse »** en pastille creuse, qui n'apparaît que sans
adresse et mène au devis complet — seul écran où elle s'édite.
`ARCHITECTURE.md` §70.

### 0 nonies. ~~L'écran de connexion est resté dans l'ancienne identité~~ **fait le 12 août 2026**

**Vu en capture le 12 août 2026**, en vérifiant que les boutons arrondis
n'avaient rien cassé. `src/app/login/page.tsx` n'a jamais été repris par la
refonte du 10 août :

- son bouton est en **terre cuite `#B5502F`**, couleur abandonnée le 3 août
  quand l'application est passée à Arborea — écrite en dur, hors
  `design-tokens.ts` ;
- carte blanche, bordures grises, aucune serif de titre, aucun jeton de la
  charte.

**C'est le PREMIER écran qu'il voit**, et le seul qui ne ressemble pas à Atlas.
Même remarque pour `src/app/documents-legaux/formulaire.tsx`, qui porte la même
couleur en dur.

**Fait le 12 août 2026** : maquettes 32, 33 et 34, puis `src/app/login/page.tsx`.
Reste `src/app/documents-legaux/formulaire.tsx`, qui porte la même terre cuite en
dur et n'a pas été repris — il échappe au parcours pour la même raison que la
porte (`ARCHITECTURE.md` §71).

**Il a choisi, et demandé une suite le 12 août 2026 au soir :** la proposition 4
**sans son titre ni sa sous-ligne**, avec **le sceau et ATLAS du modèle 3**, plus
**une animation de la marque d'une demi-seconde à l'entrée**. Six animations lui
sont proposées dans `docs/maquettes/36-le-logo-qui-sanime.html` — **en attente de
son numéro**. Rien n'est encore posé.

**Il a retenu « le tour » le 12 août au soir**, et demandé d'autres gravures
dans le rond d'or : huit motifs dans
`docs/maquettes/37-le-motif-du-sceau.html` — **son numéro est attendu**.
L'écran, le rond et l'animation n'y bougent plus ; seul le tracé change.

**Ce qu'il faudra trancher avec lui au moment de coder** (écrit sur la maquette) :
la demi-seconde est un **plancher**, pas la durée de l'attente. Le serveur répond
quand il répond ; l'animation ne doit ni être coupée en son milieu, ni se figer
si la réponse tarde. Les propositions 3, 4 et 6 bouclent d'elles-mêmes ; les 1, 2
et 5 se dessinent d'un bout à l'autre et demandent une décision explicite.

**Maquette livrée le 12 août 2026 — `docs/maquettes/35-l-ecran-de-connexion.html`**
(« oui, fais-moi une maquette avant/après »). L'avant reproduit, puis quatre
après : la carte gardée, sans carte, le sceau, la ligne d'imprimé. **En attente
de son choix — `src/` n'a pas été touché.**

**Et un défaut de plus, trouvé en dessinant :** les champs sont écrits en
**15 px**, alors que `styleChampPlage` impose 16 px depuis le 10 août précisément
parce qu'**en dessous, iOS agrandit la page dès qu'un champ prend le focus**. Il
tape son adresse et l'écran lui saute au visage. Ce défaut-là ne dépend d'aucune
proposition : il se corrige avec celle qu'il retiendra. Même remarque pour le
refus de connexion, peint en `text-red-600` (rouge de Tailwind) au lieu du
`colors.alert` de la charte.

### 0 octies. Les actions principales encore dessinées à la main

**Trouvé le 12 août 2026, parce que le patron l'a vu avant nous.** La feuille
d'envoi du devis dessinait son bouton sur place ; la capsule ne l'avait donc
jamais atteinte. Corrigé pour le parcours d'envoi (`EnvoiAuClient`,
`TransmettreAuClient`).

**Restent, repérées mais NON converties :** `DevisDepuisDictee`,
`BrouillonSection` (informations), `PropositionPrixSection` (prix), et les
écrans de réglages (agenda, vocabulaire, import de tarifs). Chacune est un
`<button>` peint en `colors.rust` au lieu d'un `PrimaryButton`.

**Pourquoi ce n'est pas fait d'office :** sa règle du 11 août — *« montre-moi
avant de faire, plutôt que de faire pour revenir en arrière »*. Il faut donc lui
montrer ces écrans avant/après, puis convertir. `scripts/capture-bouton-partout.mjs`
sait le faire pour les écrans qui ont une ADRESSE ; les feuilles qui montent sur
un geste demandent d'ouvrir le tiroir — c'est ce qui manque au script, et c'est
exactement le trou par lequel ce défaut est passé.

### ~~0 quindecies. Un serveur fantôme sur le port 3000, et la batterie accusait le prix~~ — **corrigé le 11 août 2026**

**Vu sur une batterie qui venait de passer entièrement au vert.** La même
commande, rejouée sur le même code, a donné deux rouges :

| Ce qu'on lisait | Ce que c'était |
|---|---|
| `test-prix-e2e` : `'0.00' == '34.50'` | un enregistrement qui n'a pas eu le temps de partir — l'occupant du port compilait |
| `❌ Le port 3000 est déjà pris.` | la vraie cause, mais annoncée **en dernier**, deux étapes trop tard |

**La cause, établie et non supposée.** Une sentinelle a noté ce qui tournait au
moment où le serveur apparaissait : parent déjà mort (`ppid = 1`), aucune suite
en cours, `/tmp/atlas-banc.pid` à la même minute. Ce n'était donc **pas** une
suite oublieuse — l'hypothèse écrite d'abord, et fausse — mais
`verifier-connexion-avec-serveur.mts`, qui lance `npm run banc` puis tue son
groupe dès la connexion éprouvée.

Pourquoi le serveur survivait : `banc.mjs` **sert d'abord et bâtit ensuite**, et
ses gestionnaires de `SIGTERM` vivaient en **fin de fichier**, c'est-à-dire après
la construction. Entre le lancement du serveur et leur installation, il
s'écoulait plusieurs minutes ; un signal reçu dans cette fenêtre tuait le script
net, et le serveur — **détaché**, pour d'excellentes raisons — survivait,
accroché au port. Un gardien juste, arrivé en retard.

**Corrigé en deux endroits :**

1. `scripts/banc.mjs` — les gardiens sont posés **ligne suivante après le
   lancement**, avant toute attente.
2. `scripts/run-e2e-tests.ts` — la batterie **refuse** désormais un port déjà
   pris, au lieu de se rabattre en silence sur l'occupant. C'était le plus grave
   : cinquante suites avaient travaillé, une fois, sur un serveur qu'elle
   n'avait pas lancé, **sans un mot**.

**Éprouvé, dans les deux sens** (`test-prechauffage.ts`, section « deux serveurs
ne se battent plus pour le port ») :

- gardiens remis en fin de fichier → rouge, en nommant la fenêtre ;
- garde neutralisée d'un `if (false && …)` → rouge. La première version du
  contrôle cherchait le nom de la fonction et restait verte : **un contrôle qui
  se contente de trouver un mot ne protège que du mot** ;
- et en vrai : le script de connexion rejoué rend le port (`000`), là où il
  laissait un serveur ; la batterie navigateur, lancée sur un port occupé,
  s'arrête en une seconde avec le remède à taper.

### ~~0 sexdecies. Des suites dépassent leur délai en batterie et font rejouer 25 minutes~~ — **CAUSE TROUVÉE le 2026-08-12**

**Quatre faux rouges dans la journée, sur trois suites sans rapport** —
« clôturé AVANT sa date » (deux fois), « Créer la facture », puis « un appui
dicte, un second enregistre ». Chacune diagnostiquait la même chose et avait
raison — le serveur de développement n'avait pas suivi — et chacune passait au
vert jouée seule. Coût : une batterie complète rejouée à chaque fois.

**Ce n'était pas la machine** : 13 Go libres, charge à 1,2. C'était le
préchauffage de `run-e2e-tests.ts`, et il avait deux défauts qui n'en font
qu'un :

1. **il tournait sans session.** Un appel anonyme sur `/termines` est renvoyé
   vers `/login` par le middleware : la route visée n'est jamais rendue, donc
   jamais compilée. Il ne préchauffait que `/login` — et faisait croire au
   contraire ;
2. **sa liste était incomplète.** `/termines`, justement, n'y figurait pas.

**Les deux venaient d'une deuxième implémentation.** `scripts/prechauffer.mjs`
sait ouvrir une session et parcourir la liste complète, écrans de chantier
compris — c'est ce que le banc d'essai fait depuis toujours. La batterie avait
sa propre version naïve. Deux copies de la même idée finissent toujours par
diverger, et c'est la plus faible qui servait ici.

La batterie emprunte désormais le même préchauffage que le banc.

**Ce qui reste à surveiller :** si un faux rouge de ce genre revient malgré le
préchauffage, ne pas allonger les délais — cela cacherait un écran devenu lent
au lieu de le dire. Mesurer d'abord quel écran, et pourquoi.

### 0 quaterdecies. Deux maquettes `/design` décrivent un écran supprimé

**Né le 11 août 2026**, en supprimant `/chantiers/[id]/photos` (`ARCHITECTURE.md`
§60). Restent derrière lui :

- `src/app/design/photos/page.tsx` — la maquette d'un écran qui n'existe plus ;
- `src/app/design/hub/page.tsx` — un lien `/chantiers/1/photos` désormais mort
  (tous les liens de cette maquette le sont déjà : elle vise un chantier « 1 »
  imaginaire) ;
- le tableau du §4 bis de `docs/INTEGRER-ORIGINE.md`, qui cite le fichier
  supprimé — mais ce document raconte un **état daté**, et le réécrire
  falsifierait ce qu'on savait ce jour-là.

**Volontairement pas touché dans le même lot** : ces maquettes ne sont ni des
écrans du produit ni de la mémoire, et le patron avait demandé qu'on ne corrige
pas ce qui n'était pas demandé. À trancher : les supprimer, ou les marquer
« maquette historique ».

### ~~0. « Impossible d'enregistrer la note »~~ — **CAUSE TROUVÉE ET REPRODUITE le 2026-08-12**
### ~~0 septdecies. L'écran du devis parti~~ — **codé et éprouvé le 2026-08-12**

*« Code le 5 »* — le signet d'or. `ExportClient.tsx`, `TransmettreAuClient.tsx`,
`src/lib/numero-lisible.ts`, `scripts/test-devis-parti-signet-e2e.ts`. Les mesures
viennent de `docs/maquettes/34-le-devis-sur-sa-base.html` : **les reprendre de là**
si on y retouche, jamais de mémoire.

**Cinq choses à ne pas défaire, chacune payée par un défaut réel :**

1. **`atlas-ecran` sur la page, pas de hauteur écrite à la main.** Deux
   tentatives ont débordé avant — un en-tête « mesuré » à 232 px, puis
   `min-h-screen` + `pb-16` qui comptait deux fois la barre du bas
   (`main.atlas-contenu` la réserve déjà). 100 px, puis 68.
2. **L'avertissement de « Modifier mon devis ».** Rouvrir un devis parti crée une
   version mais **n'annule pas l'envoi** : le client voit toujours celle qu'il a
   reçue et peut l'accepter au prix d'avant. Refuser ne doit créer AUCUNE version.
3. **Le voile de la feuille est `aria-hidden`** — sinon deux boutons s'appellent
   « Annuler », et qui ne voit pas l'écran en entend deux.
4. **La bascule de canal reste.** Elle manquait à mes cinq maquettes ; la livrer
   ainsi aurait défait sa demande du 4 août.
5. **`numeroLisible` refuse de grouper ce qu'elle ne reconnaît pas.** Un numéro
   étranger découpé par paires aurait l'air juste sans l'être — pire que rien sur
   une ligne dont le seul rôle est la vérification.

**Ce qui reste ouvert, et n'a pas été tranché :** le rayon du bouton. Tout est au
rayon d'aujourd'hui (4 px). La bande de comparaison — 4, 8, 12, pilule — est au
bas de `docs/maquettes/33-le-devis-parti-allege.html`. Son choix vaudra pour
**vingt-sept écrans** (`PrimaryButton`) : ne pas le poser sur ce seul écran.

*Ce qui suit est l'énoncé d'origine, gardé parce qu'il porte la mesure.*

### ~~0 septdecies bis. L'énoncé~~ — le CONTENU arrêté par lui le 12 août

**Arrêté par lui le 12 août** — c'est acquis, ne pas le rediscuter :

- ne garder que **le nom du devis et le total** ;
- **retirer les lignes de prestations** ;
- un lien **« Modifier mon devis »** sous le total, qui ramène au devis ;
- « Télécharger le PDF », « Copier le lien », « Partager » **en encre foncée**,
  visiblement cliquables.

`docs/maquettes/34-le-devis-sur-sa-base.html` : sa base au mot près, plus quatre
mises en page du même contenu (sans carte · dans le titre · actions empilées ·
signet d'or). **Rien n'est codé** tant qu'il n'a pas donné un numéro.

**Trois points ouverts, à ne pas trancher seul :**

1. **Reprendre un devis déjà parti crée une nouvelle version** et rend l'ancien
   lien caduc. Faut-il le prévenir au clic sur « Modifier mon devis » ? Une
   phrase courte, une seule fois, est proposée — pas décidée.
2. **« Partager autrement (WhatsApp… ) » ne tient pas** à trois sur une ligne. Il
   devient « Partager », ou les trois s'empilent (idée 4). Son choix.
3. **Le rayon du bouton reste sans réponse** (bande de la maquette 33 : 4, 8, 12,
   pilule). Tout est dessiné à 4 px pour ne rien présumer.

### ~~0 sexdecies. L'écran du devis parti : quatre maquettes~~ — **dépassée le 2026-08-12 par la 26**

*Gardée parce qu'elle porte la mesure d'origine : onze blocs, 382 px de trop.*

**Rien n'est codé, et rien ne doit l'être avant qu'il ait désigné une lettre**
(`CLAUDE.md` §3 bis). Il a demandé la maquette explicitement : *« fabrique-moi la
maquette et montre-la-moi avant de coder quoi que ce soit »*.

`docs/maquettes/33-le-devis-parti-allege.html`. Mesuré : l'écran porte **onze
blocs** et déborde de **382 px** sur sa dalle.

| | Blocs | Ce qu'elle retranche | Ce qu'elle coûte |
|---|---|---|---|
| A | 6 | l'adresse illisible, la phrase en double, la carte Chantier/Client | il ne relit plus l'adresse à l'œil |
| B | 4 | la carte d'état, montée dans le titre | un appui pour les autres canaux |
| C | 5 | le devis replié derrière une ligne | un appui pour le détail |
| D | 3 | tout sauf le montant et le geste | rien du devis sans un appui |

**Trois choses que la maquette propose et qui ne sont PAS acquises :** « il y a
2 jours » (la date d'envoi est en base, jamais affichée) ; le libellé qui passe
d'« Ouvrir le SMS tout prêt » à « Relancer par SMS » une fois le devis parti ; et
le numéro écrit espacé plutôt que collé.

**Et le rayon du bouton, qui se choisit en même temps.** Il a dit *« le bouton
est toujours carré »*. Vérifié : il est **déjà au rayon des cartes** (4 px,
`radius.card`, posé le 10 août à sa demande). Ce n'est pas un oubli — c'est que
sur un aplat vert foncé, 4 px ne se voient pas. La bande du bas de la maquette
montre 4 / 8 / 12 / pilule. **Son choix vaudra pour vingt-sept écrans**
(`PrimaryButton`) : ne pas le poser sur ce seul écran, deux formes de bouton
dans la même application est précisément ce qui vient d'être démêlé.

### ~~0 quindecies bis. « Le mail n'est pas parti »~~ — **ce n'était pas un défaut, 2026-08-12**

**Ne pas rouvrir, et surtout ne rien « réparer ».** Signalé comme une panne —
*« lorsque le mail est parti je n'ai pas de message qui prouve qu'il est bien
parti, la page reste figée »* — puis démenti par lui-même dans la foulée :
*« en fait le mail n'était pas parti […] il y avait une faute sur l'adresse
mail »*.

Sa messagerie s'est bien ouverte ; l'adresse du destinataire était fausse.
Vérifié avant de conclure : la CSP ne régit pas la navigation `mailto:`
(`next.config.ts`), et l'adresse construite pour son cas exact fait
574 caractères — très en deçà de toute limite. `useRetourDeMessagerie` n'a donc
pas renvoyé à l'accueil pour la seule bonne raison : **il n'est jamais parti de
la page**.

### 0. Si « Impossible d'enregistrer la note » revient : lire la phrase, ne pas la deviner
**Ouvert le 11 août 2026, et volontairement laissé ouvert.** Le patron a signalé
ce message ; il n'a **pas pu être reproduit ici** — la dictée passe avec un micro
simulé, en développement comme sur la version bâtie derrière une origine
étrangère. Ce qui a été corrigé, c'est le silence : l'écran nommait le refus
« Impossible… Réessayez » quelle qu'en fût la cause, et rien n'était journalisé.

**Le 12 août, le patron a rapporté la phrase — et elle accusait le mauvais
coupable.** Il a lu *« L'enregistrement n'a pas pu être transmis — la connexion
a été interrompue »*. C'était la branche `catch` de l'écran, c'est-à-dire la
seule catégorie que le correctif de la veille avait laissée muette : les refus
ATTENDUS étaient devenus bavards, les pannes IMPRÉVUES continuaient de lever.
**Le correctif était à moitié fait, et la moitié manquante était exactement
celle qui se produisait.**

Pire que muet : cette phrase désignait le réseau alors que l'aller-retour avait
peut-être très bien eu lieu. Elle envoyait chercher au mauvais endroit.

Deux choses ont changé le 12 août :

1. **L'action ne lève plus rien.** Toute panne rend une phrase qui **nomme le
   maillon** — session, cadence, lecture, stockage, base (`src/lib/panne-note-vocale.ts`).
   Le disque plein, le droit d'écriture refusé et le service absent ont leur
   propre phrase, parce qu'ils appellent chacun un geste différent.
2. **L'écran ne conclut plus, il demande.** Quand l'appel lui-même échoue, il
   interroge le serveur avant de parler (`src/lib/diagnostic-liaison.ts`) :
   s'il répond, ce n'était pas la connexion mais une **page vieillie** — le cas
   le plus probable sur ce banc, où l'espace se reconstruit et où les actions
   changent d'identifiant sous une page déjà ouverte.

**Puis la cause a été trouvée, le 12 août, en reproduisant son parcours plutôt
qu'en raisonnant dessus.** Une action serveur porte un identifiant fabriqué à la
construction ; son banc se met à jour tout seul ; une page restée ouverte appelle
un identifiant disparu, et l'envoi échoue sans atteindre le serveur.
`scripts/eprouver-page-vieillie.mts` le rejoue : code d'avant, `500` et le
message du patron mot pour mot. L'enregistrement passe désormais par une URL
(`ARCHITECTURE.md`, `HANDOVER.md`).

**Ce qui reste utile si une panne d'un autre ordre survient :** les phrases
ci-dessous désignent chacune un endroit différent, et aucune ne demande de
deviner.

| Ce qu'il lit | Ce que ça désigne |
|---|---|
| « (étape : session) » | sa session a expiré — recharger et se reconnecter |
| « (étape : stockage) », disque plein | l'espace de travail n'a plus de place |
| « (étape : cadence) » ou un service qui ne répond pas | Redis absent — l'espace est à relancer |
| « (étape : base) » | la fiche n'a pas pu être mise à jour — le journal porte le détail |
| « cette page a été ouverte avant la dernière mise à jour » | il suffit de recharger |
| « le serveur est injoignable depuis ce téléphone » | c'est bien le réseau, cette fois |

**Ne rien supposer avant d'avoir la phrase** : trois diagnostics à distance ont
déjà coûté un aller-retour chacun.

**Ce qui n'est toujours pas fait, et qui coûte à chaque échec :** la note captée
est **perdue** quand l'envoi échoue — il faut tout redicter. La garder en local
(IndexedDB) et la reproposer au retour serait le vrai confort ; ce n'est pas
fait, et ce n'est pas un détail pour quelqu'un qui dicte debout sur un chantier.


### ~~0 bis. Si le fil accroche ENCORE chez le patron : le masque, sur iOS~~ — **close le 2026-08-11 par le patron lui-même**

**Ouvert puis refermé le même soir, et c'est le refermer qui compte.** Le
saccadé avait pour cause `scroll-snap-stop: always`, retiré ; la mesure
(`scripts/mesurer-fluidite-fil.mts`) mettait le masque en dégradé et l'animation
d'opacité hors de cause — mais elle avait mesuré **Chromium sans tête sur cette
machine**, pas Safari sur son iPhone, et elle ne pouvait pas produire l'élan d'un
vrai doigt. Ce point restait donc ouvert par honnêteté, pas par doute.

**Le patron a tranché, sur son téléphone :** *« la fluidité de l'iPhone, ça
aussi, ça a été corrigé. »* Le retrait de l'accroche suffisait ; le masque
n'était pour rien dans la plainte.

**Ce qu'il faut en retenir, et pourquoi ce point reste écrit plutôt que
supprimé :** le `mask-image` de `.atlas-fil-defile` est **hors de cause, vérifié
sur le vrai appareil**. Quelqu'un finira par le soupçonner — c'est le suspect
qui vient à l'esprit dès qu'on parle de défilement qui accroche sur iOS. Le
déplacer coûterait du travail et du risque pour rien. Le correctif de repli
reste décrit ci-dessous **au cas où une plainte NOUVELLE apparaîtrait**, pas
pour celle-ci, qui est réglée.

Repli, si et seulement si le sujet revient : **déplacer le fondu sur
`.atlas-ecran`**, en deux dégradés posés PAR-DESSUS (couleur `--card`,
`pointer-events: none`), plutôt qu'en masque SUR le cadre qui défile. Deux
précautions alors : les dégradés se placent aux bords de la zone qui défile, pas
du cadre (l'en-tête n'est pas dedans), et une capture avant/après doit être
identique — sinon on aura échangé un défaut contre un autre.

### ~~0 septies. Les deux portes de la création~~ — **close le 2026-08-11**

Il a choisi, maquettes en main : la **bascule « le trait qui glisse »**
(`docs/maquettes/26-la-bascule-affinee.html`, déclinaison 1) et le bouton **« la
capsule »** (`docs/maquettes/28-le-bouton.html`, proposition 5). Les deux sont en
place sur l'écran de création, et « Je l'écris » mène à la page du devis entier
avec le client déjà en en-tête. Le raisonnement complet est dans
`ARCHITECTURE.md` §64.

**Tranché le 11 août au soir : « partout ».** La capsule est la seule forme
d'action principale de l'application, sur les dix-sept écrans, et la variante
rectangulaire a été retirée. Elle lui a été montrée **sur ses vrais écrans avant
d'être posée** — sa règle : « montre-moi avant de faire, plutôt que de faire pour
revenir en arrière ». `scripts/capture-bouton-partout.mjs` refait la planche.

### ~~0 ter. Les suites navigateur mesuraient un écran que personne ne possède~~ — **close le 2026-08-11**

**Trouvé le 11 août 2026, et le patron l'a payé.** Les suites posaient un cadre
de 393 × 852. La hauteur **utile** d'un vrai iPhone 13, barre du navigateur
déduite, est de 390 × **664** (`devices["iPhone 13"]` de Playwright). Sur ce
cadre trop haut, un contrôle de chevauchement passait au vert alors que, sur son
téléphone, la bulle de l'assistant recouvrait « ou rédiger le devis à la main ».

**Fait.** L'écran vit désormais dans `ECRAN_DU_PATRON` (`scripts/e2e-browser.ts`)
et toutes les suites en héritent ; deux tolérances écrites à la main sont tombées
avec (« 400 px » de débordement toléré sur un écran de 393 ; une grille cadrée à
393 au lieu de 390).

**Ce que ça a trouvé : rien.** 46/47, l'unique rouge étant un dépassement de
délai du serveur de développement. Il fallait quand même le faire — un contrôle
qui mesure un écran inventé ne prouve rien, vert ou rouge — mais le dire tel
quel : le cadre honnête n'a révélé aucun défaut caché.

**Ce qui manquait vraiment**, et qui existe maintenant :
`scripts/test-rien-de-recouvert-e2e.ts`, qui cherche sur quatorze écrans ce que
le doigt n'atteint pas. Un seul écran vérifiait cela auparavant, pour un seul
bouton.

### ~~0 quater. Le bandeau d'alerte est coupé en haut, à l'arrivée sur l'accueil~~ — **tranché le 2026-08-11 : on laisse tel quel**

**Le patron, après avoir vu le raisonnement :** *« Dans ce cas-là, laisse tel
quel. »* Ne pas rouvrir ce point sans lui : ce n'est pas un défaut oublié, c'est
un arbitrage rendu. Le raisonnement qui l'a emporté est conservé ci-dessous —
c'est lui qui évitera de le refaire.

**Vu en regardant les captures de la perle, le 11 août 2026 — aucune suite ne le
disait.** À l'ouverture de « Vos chantiers », le fil est déjà défilé de 61 px :
le navigateur pose la liste sur son premier point d'accroche, qui centre le
premier chantier. Le bandeau « CORRECTION DEMANDÉE », qui vit **dans** la liste,
perd donc sa première ligne — et il n'existe aucune position de repos où on la
revoie : forcer le défilement à zéro y ramène.

Ce n'est **pas** une conséquence du travail sur la perle : mesuré avant, c'était
déjà 61 px.

L'arbitrage, et pourquoi il ne se tranche pas en codant : les deux moitiés ne
peuvent pas être vraies ensemble.

| Choix | Ce qu'on gagne | Ce qu'on perd |
|---|---|---|
| **Laisser tel quel** (retenu) | la perle désigne un chantier dès l'ouverture | le bandeau perd sa ligne de capitales — son nom, sa phrase et ses deux boutons restent entiers |
| Ajouter un point d'accroche en haut | le bandeau entier | on arrive sur une liste où la perle ne désigne rien, à **chaque** ouverture |

Un repère abîmé à chaque ouverture coûte plus cher qu'une ligne de capitales
coupée : c'est ce qui a emporté la décision.

### ~~0 bis. Une session périmée~~ — **close le 2026-08-10, test compris**

`GET /api/session-perimee` efface les cookies et renvoie à la connexion ;
`GardeDocumentsLegaux` (layout racine) et `getCurrentCtx` y mènent.
`scripts/test-session-perimee-e2e.ts` le tient en cinq contrôles, dont un
parcours dans un vrai navigateur, JavaScript coupé.

**Trois défauts que ce test a trouvés, et qu'il faut connaître avant de toucher
à ce coin du code** (le détail est dans `CHANGELOG.md` du 2026-08-10) :

1. Une redirection lancée depuis une **page** ne peut pas être un 307 : elle
   rend sous la frontière de `src/app/loading.tsx`, où l'enveloppe est déjà
   partie. Next.js répond alors 200, et le renvoi est joué en JavaScript. Tout
   contrôle d'accès qui doit valoir sans JavaScript vit dans le **layout**.
2. `NextResponse.redirect` fabrique une adresse absolue depuis `request.url`,
   c'est-à-dire l'adresse d'**écoute** (`0.0.0.0`). Derrière le relais du
   patron, elle ne mène nulle part. Renvoyer relatif.
3. « Compte disparu » et « compte sans entreprise » ne se traitent pas pareil :
   effacer la session du second l'enfermerait dans une boucle
   connexion → effacement → connexion.

#### La forme d'origine du défaut, pour mémoire

**Constaté chez le patron le 10 août 2026, sur son banc.** Son navigateur
portait la session d'un compte de démonstration supprimé par un nouveau seed.
Le cookie restait valide, `auth()` rendait donc un `utilisateurId` — et
`resoudreEntrepriseId` levait `AucuneEntrepriseError`, qui n'est **attrapée
nulle part** (`src/server/session-ctx.ts`). Résultat : toutes les pages en 500,
et un écran qui ne dit rien de ce qu'il faut faire.

**Ce qu'il faut, et pourquoi ce n'est pas une ligne de code :** une session
valide sans adhésion doit ramener à l'écran de connexion, **et la session doit
être révoquée** — sinon la page de connexion renvoie vers l'accueil, qui
renvoie vers la connexion, en boucle. `getCurrentCtx` sert aussi les actions
serveur et les routes d'API : le remède doit valoir pour les trois, sans
affaiblir l'isolation. À écrire avec un test qui reproduit la panne : session
signée d'un utilisateur sans adhésion.

**En attendant**, le contournement est écrit dans `docs/ESSAYER.md` : ouvrir en
navigation privée, ou rejouer le seed.


### 0. Le banc d'essai tient debout — ~~à faire~~ **fait le 9 août 2026**

Veilleur qui relance le serveur mort, préchauffage de seize écrans, garde contre
un second serveur, et construction possible sans les secrets de production.
`ARCHITECTURE.md` §43 et §44.

**Ce qui reste sur ce sujet, et que je dois encore faire :**

- **Le chemin de MISE À JOUR n'est toujours pas éprouvé par la CI.** Elle bâtit
  un banc neuf à chaque fois ; le défaut des migrations du 9 août est passé par
  ce trou, et un autre y passera. Il faut un banc qui existe déjà, qui reçoit du
  code neuf, migrations comprises.
- ~~**Le navigateur d'essai manque au conteneur.**~~ — **réglé le 2026-08-12.**
  Il s'installe dans la commande du workflow (`npx playwright install --with-deps
  chromium`), et non dans l'image : l'espace du patron ne porte pas trois cents
  mégaoctets dont il ne se sert jamais, la machine de GitHub les paie une fois
  par exécution. Ce qui l'a débloqué : `.devcontainer/verifier.sh` **se connecte
  désormais pour de vrai** sur le banc, derrière une origine étrangère — le
  contrôle qui manquait quand le patron a écrit « je n'arrive pas à me
  connecter ».
- **Les PDF et la dictée ne sont pas mesurés** — le premier exige un vrai
  stockage, la seconde un appel facturé. Dit plutôt que supposé.


### 0. La sauvegarde des données — À FAIRE, dans cet ordre

**Décidé avec le patron le 5 août 2026.** Il a demandé explicitement que ce
point soit écrit : *« oublie pas de le faire, note-le, enregistre-le ! »*

| | Quoi | Quand | État |
|---|---|---|---|
| **a** | ~~**Bouton « Télécharger mes données »** dans Réglages. Un fichier arrive sur son téléphone. Aucun terminal, aucun compte, aucune dépendance.~~ | | **fait le 2026-08-05** |
| **b** | **Sauvegarde automatique**, sans qu'il ait à y penser. | **Dès que l'hébergement est choisi** (point 3 de `docs/A-FAIRE.md`) | bloqué |

**(a) est livré.** Un ZIP contenant les vingt-trois tables de l'entreprise, ses
photos, ses enregistrements et ses PDF, plus un mode d'emploi qui dit ce que le
fichier contient de sensible. Les choix et ce qu'ils écartent sont dans
`ARCHITECTURE.md` §26 ; le code dans `src/server/repositories/export-entreprise.ts`,
`src/app/api/mes-donnees/route.ts` et `src/lib/archive-zip.ts`.

**Ce qui le garde honnête, et qu'il ne faut pas défaire :**
`test-export-entreprise.ts` interroge `information_schema` et **échoue si une
table portant un `entreprise_id` n'est pas exportée**. Une table ajoutée demain
et oubliée disparaîtrait sinon des sauvegardes sans un bruit. En ajouter une
sans l'exporter fera rougir la batterie — c'est voulu.

**Pourquoi (b) ne peut pas se faire maintenant, et il faut le redire à chaque
fois que la question revient :** une sauvegarde automatique doit déposer son
fichier quelque part.

- **Pas dans le dépôt** : il est public. Y écrire une base contenant les noms et
  adresses des clients serait une fuite, pas une sauvegarde.
- **Pas sur le disque de l'espace de travail** : c'est précisément ce dont on
  cherche à se protéger, puisqu'il disparaît avec l'espace.
- **Il faut donc une destination extérieure** — celle de l'hébergeur, ou un
  stockage objet que le patron n'a pas encore.

**Ce que (a) débloque :** il pourra nourrir la mémoire de l'agent sans craindre
de tout perdre au passage en ligne. C'est la condition qu'il a posée lui-même
pour commencer — voir `docs/A-FAIRE.md` §1 bis.

**Ne pas confondre avec l'export RGPD existant.**
`src/server/repositories/donnees-client.ts` exporte les données **d'un client**,
pour répondre à une demande d'accès. Ce qu'il faut ici est l'inverse : **toutes
les données de l'entreprise**, pour les emporter ailleurs.

### 0 ter. L'agent demande ce qui coûte de l'argent — ~~à faire~~ **fait le 6 août 2026**

**Choisi par le patron en QCM le 6 août 2026**, devant la mémoire des
corrections et l'entretien de départ : *« Les questions qui coûtent de
l'argent. »* Et la règle, confirmée le même jour : *« il demande si ça change le
prix, il signale sinon »* (`docs/EXEMPLE-DICTEE.md` §7).

L'agent s'arrête désormais **avant de chiffrer** quand il manque ce qui fait le
prix. Sur la dictée du chêne mort : la technique et le diamètre, absents de la
note, et qui font passer l'abattage de 600 à 1 400 €.

| Où | Quoi |
|---|---|
| `src/lib/questions-chiffrage.ts` | Les règles du métier, pures — ce qu'on demande **et ce qu'on tait** |
| `drizzle/0022_precisions_chantier.sql` | Ses réponses, qui survivent à une relecture de la dictée |
| `src/server/services/devis-depuis-dictee.ts` | L'arrêt, et la reprise **sans rappeler le modèle** |

**Ce que ça ne fait PAS — à ne pas croire acquis.** La réponse est enregistrée
et s'écrit sur la prestation ; **elle ne change pas encore le montant**. C'est la
règle du patron lui-même (`EXEMPLE-DICTEE.md` §9c) : tant qu'aucun rapport n'a
été observé entre les techniques et les prix, l'agent demande le prix plutôt que
d'en fabriquer un. Il manque la mémoire, pas la question.

**Ce qui le débloquerait**, dans l'ordre : (a) puis (c) ci-dessous. Dès qu'il
existe deux devis d'abattage avec leur technique, le rapport se calcule et le
montant peut se proposer — arrondi à la dizaine d'euros HT (`§9b`), et présenté
comme un **rappel** de la dernière fois, jamais comme un calcul non sourcé.

### 0 quater. La mémoire des corrections — ~~à faire~~ **faite le 6 août 2026**

**Choisi par le patron le 6 août 2026**, devant l'entretien de départ et les
photos. Ce qu'il chiffre sur un devis est désormais retenu, et lui revient sur
le chantier comparable suivant.

**Ce que ça a révélé :** `historique_prix` existait, était lue par le chiffrage
— et **n'était jamais écrite par l'application**. Seuls les tests l'alimentaient.
Une mémoire que personne ne remplit n'est pas une mémoire.

| Où | Quoi |
|---|---|
| `src/lib/lecons-prix.ts` | Ce qui se rapproche, ce qui ne se rapproche **pas**, et le rappel |
| `src/lib/arrondi-prix.ts` | « En HT on fait des prix ronds » (§9b), enfin appliqué |
| `drizzle/0023_lecons_prix.sql` | Une leçon par ligne de devis, jamais une de plus |
| `devis-complet` | Le rappel sous la ligne, et « Reprendre ce prix » |

**Pourquoi une table de plus plutôt qu'`historique_prix`.** Celle-ci s'appuie
sur `catalogue_prestations`, catalogue **partagé** repéré par nom canonique :
elle ne sait pas distinguer un abattage au pied d'un démontage avec rétention —
les deux seules choses qui font passer le même chêne de 600 à 1 400 €. Une
mémoire aveugle à cette distinction rappellerait un prix faux de 800 € avec
l'autorité de l'expérience.

**Trois garde-fous à ne pas défaire :**

- **Un rappel, jamais un calcul** (`EXEMPLE-DICTEE.md` §9c). La phrase dit d'où
  vient le chiffre et de quel chantier. Rien ne s'applique tout seul.
- **Le rapprochement se trompe dans le bon sens.** Les diamètres sont groupés
  par tranche de dix centimètres, au plus proche ; une frontière subsiste, et
  elle fait **manquer** un rappel, jamais en fabriquer un faux. Élargir le
  rapprochement échangerait un manque contre une erreur.
- **L'apprentissage ne gêne jamais le travail.** Une ligne dont on ne sait rien
  tirer s'enregistre quand même.

**Ce qui reste ouvert :** le rapport entre techniques (×1,67, ×2,33 — §9a),
qui demande plusieurs devis comparables. La mémoire l'accumule désormais ; la
règle se calculera quand il y aura de quoi.

### 0 quinquies. Lignes vendables et grille de fendage — ~~à faire~~ **fait le 8 août 2026**

Ce qui est en place, et qu'il ne faut pas refaire :

- le découpage en lignes vendables (`src/lib/lignes-vendables.ts`), avec le
  billonnage compris dans l'abattage ;
- la grille de fendage hauteur × diamètre, 8 × 6 cases, née vide, remplie à la
  main **et** par ses devis (`src/lib/grille-prix.ts`).

Détail des choix : `ARCHITECTURE.md` §29.

**Ce qui reste ouvert, et qu'il faut lui demander plutôt que de trancher seul :**

| | Question | Pourquoi ça presse un peu |
|---|---|---|
| a | **Les tranches lui conviennent-elles ?** 8 diamètres × 6 hauteurs, bornes hautes incluses. | Changer les bornes plus tard rend introuvables les prix déjà rangés. C'est facile aujourd'hui, coûteux après trente devis. |
| b | **L'abattage mérite-t-il la même grille ?** Il se chiffre déjà à la technique et au diamètre, mais sans liste que le patron puisse voir et compléter. | Question posée le 8 août, restée sans réponse. |
| c | **La taille de haie devrait-elle avoir sa propre ligne ?** Son devis de référence du 5 août en compte trois — haie 350 €, abattage 600 €, fendage 300 € — quand l'application en produit deux. | Séparer la haie du chêne demanderait de répartir un tarif global entre eux, c'est-à-dire d'inventer deux prix. La fente a le droit à sa ligne parce qu'elle a une grille ; la haie n'en a pas encore. |
| d | **Autre chose que la fente se détache-t-il ?** Le dessouchage, l'évacuation seule, l'enlèvement des grumes. | Aujourd'hui la fente est le seul cas connu — parce que c'est le seul qu'il ait décrit. |

**Et une limite à connaître avant de promettre quoi que ce soit :** seuls les
devis **nés d'une dictée** nourrissent `corrections_dictee`. Un devis écrit
entièrement à la main n'apprend rien sur la façon de LIRE une dictée — c'est
délibéré (il n'y a pas d'écart à mesurer), mais cela veut dire que sa phrase
*« je fais plein de devis et dans un mois tu sauras les remplir tout seul »* ne
vaut que pour les devis dictés. La grille de fendage, elle, se remplit dans les
deux cas.

### 0 sexies. Le PDF d'une liste de prix — à trancher avec le patron

L'import d'une liste de prix accepte **Excel et CSV** (`ARCHITECTURE.md` §31).
Le **PDF est refusé**, avec un message qui donne la sortie : « Ouvrez la liste
dans Excel puis Enregistrer sous → CSV ».

**Pourquoi refusé plutôt que deviné.** Un PDF est une image de tableau : plus de
colonnes, seulement des morceaux de texte à des coordonnées, souvent dans un
encodage propre au document. Un prix lu de travers arrive sur le devis d'un
client — c'est précisément ce que `docs/AGENT.md` §3 interdit.

**Question posée le 8 août, et tranchée : « le tableur suffit ».** Le sujet est
donc clos, et ce point ne se rouvre que s'il change d'avis. Les deux pistes sont
gardées ci-dessous pour qu'on n'ait pas à les réinventer ce jour-là.

| | Piste | Ce que ça vaut |
|---|---|---|
| a | Faire lire le PDF par le modèle déjà branché, et lui faire valider l'aperçu comme aujourd'hui | Marche sur les PDF scannés comme sur les autres. Coûte des jetons, et demande d'envoyer le fichier chez un sous-traitant — donc l'accord du patron (`docs/A-FAIRE.md` point 2) |
| b | Extraire la couche texte à la main (flux `Tj`/`TJ`, positions `Td`/`Tm`) | Sans dépendance ni réseau, mais muet sur un PDF scanné, et fragile sur les encodages de sous-ensembles de polices |

### 0 nonies. Le calendrier, des deux côtés — ~~à faire~~ **fait le 9 août 2026**

Le client ne peut plus choisir un jour déjà pris : il est barré et ne répond
pas. Le patron a le même calendrier, jusqu'à dix-huit mois. `ARCHITECTURE.md`
§36.

**À savoir avant d'y toucher** : le composant ne décide de rien, tout vient de
`src/lib/calendrier.ts`. Et l'ordre des raisons dans `etatDuJour` n'est pas
indifférent — un jour hors fenêtre ne doit JAMAIS se dire « déjà pris » chez le
client, sinon la page laisse filtrer le planning du patron.

**~~Ce qui restait ouvert~~ — tranché le 9 août 2026 : « tu peux aller jusqu'à
douze mois d'occupation ».** Son calendrier barre donc ses journées complètes sur
365 jours. Au-delà, c'est toujours le serveur qui refuse après coup, et un
contrôle tient cette borne pour qu'on ne l'élargisse pas sans le décider.

**Ce que voit le client n'a pas bougé** — deux nombres, deux personnes. Ne jamais
les réunir « pour simplifier » : `HORIZON_OCCUPATION_PATRON_JOURS` est à lui,
`FENETRE_PROPOSITION_JOURS` est à son client.

### 0 octies. Ce qui se détache d'un chantier — ~~à trancher~~ **tranché le 8 août 2026**

Question posée : « autre chose se détache-t-il — dessouchage, évacuation seule,
enlèvement des grumes ? » Sa réponse : **« le dessouchage oui, et les grumes
aussi »**. L'évacuation seule reste donc avec l'abattage et le broyage.

Fait : cinq natures de grille, trois formes, 82 cases (`ARCHITECTURE.md` §35).

**~~Ce qui restait ouvert~~ — tranché le 9 août 2026 : « à la tonne ».** La case
porte un prix unitaire, multiplié par le tonnage lu dans la dictée. L'ancien
forfait a été **effacé** et non converti (migration 0029) : on ne sait pas
combien pesait le chantier qui l'avait produit.

La réserve, écrite à l'écran plutôt que dans un commentaire, aura tenu moins de
vingt-quatre heures. À imiter : une question posée là où le patron la lit se
répond ; enfouie dans le code, elle attend qu'un devis sorte faux.

### 0 septies. Du planning à la facture — ~~à faire~~ **fait le 8 août 2026**

Le patron ne pouvait pas atteindre le devis d'un chantier planifié : toucher sa
carte n'ouvrait qu'un sélecteur de date. La chaîne facture → TVA existait
pourtant en entier — elle était seulement injoignable depuis son écran.

Fait : la carte mène au chantier, porte « Fin de chantier », et garde le
changement de date sur un lien à part. Plus deux défauts de rangement corrigés à
la racine, et un libellé de facture qui n'était plus coupé.

**Ce qu'il faut savoir avant d'y toucher** — `ARCHITECTURE.md` §33 :

- La règle de rangement vit dans `src/lib/onglet-chantier.ts` et **nulle part
  ailleurs**. Trois portes selon la donnée disponible ; **ne jamais la recopier
  dans un écran**, c'est exactement ce qui a produit les deux défauts.
- Aucune barrière de date sur « Fin de chantier », et c'est délibéré depuis le
  3 août : c'est le patron qui sait quand un chantier est fait.

**Ce qui reste ouvert, et qu'il faudra lui demander** : un chantier passé au
planning n'affiche rien tant qu'il n'est pas clôturé. Faut-il un rappel — « ce
chantier était prévu hier » — sur l'écran d'accueil ? Aujourd'hui il bascule
silencieusement dans « Terminés », ce qui est correct mais discret.

### 0 decies. La nouvelle direction graphique — en attente de son choix

Le 9 août au soir, le patron a trouvé l'écran refait « trop application créée
en 2013 » et demandé quelque chose de **minimaliste et luxueux**, en s'appuyant
sur `aman.com`. Huit maquettes ont suivi ; il a retenu la mise en page **« la
colonne »** — la date à gauche, le chantier à droite — et gardé **trois** de ses
déclinaisons : le repère, en plages, l'action au pouce.

**Rien n'est codé.** L'application porte toujours la reproduction de sa première
capture (`ARCHITECTURE.md` §46). Il n'a pas encore désigné laquelle des trois.

Tout est dans `docs/maquettes/`, et d'un coup dans
`docs/maquettes/toutes-les-maquettes.html` — engendrée, jamais éditée à la
main : `node scripts/fusionner-maquettes.mjs`, puis
`node scripts/verifier-maquettes-page-unique.mjs`.

Ce que la bascule coûtera, quand il aura choisi : la charte de
`src/lib/design-tokens.ts` change de fond en comble (ivoire au lieu du gris-vert,
encre au lieu du vert pin pour l'action, bronze au lieu de l'or), et **tous** les
écrans suivent — pas seulement Chantiers. À ne pas entamer écran par écran.

### ~~0 quindecies. Le bouton était codé mais PAS chez lui~~ — **fusionné dans `main` le 2026-08-11, sur son accord**

**C'était le seul point qui le séparait de son bouton, et il n'était pas
technique.** Il a répondu *« fusionne dans main »* : c'est fait (`6059641`), et
son espace le prendra au prochain allumage — ou tout de suite par « Chercher les
dernières corrections ».

*Ce qui suit est gardé parce que le piège, lui, resservira.*

Le 11 août au soir : *« la modification du bouton nouveau chantier n'est pas
effectuée. Corrige ça. Et pourtant, j'ai la nouvelle dernière mise à jour, celle
de dix-neuf heures et quelques. »* Les deux moitiés de la phrase étaient vraies.

- Le bouton vit sur `claude/nouveau-chantier-button-design-2vuu9h`.
- Son espace de travail suit **`main`** — `.devcontainer/mettre-a-jour.sh` fait
  un `git merge --ff-only origin/<branche courante>`, à chaque allumage et
  derrière le bouton « Chercher les dernières corrections ». **Les deux suivent
  la branche courante.** Aucun des deux n'ira jamais chercher ailleurs.
- `main` n'a jamais reçu ce travail, et avançait en parallèle ce soir-là
  (19:02, 19:11, 19:13, 19:37). D'où sa « mise à jour de dix-neuf heures ».

**Ce qu'il a fallu faire, et qui n'appartenait pas à l'agent :** fusionner la
branche dans `main` — **fait le 2026-08-11, sur son accord explicite**
(`6059641`, en avance rapide, `main` fusionné dans la branche juste avant).

**Ne pas contourner en lui demandant de changer de branche** : ce serait des
commandes git tapées au doigt sur six pouces, ce que tout ce dépôt s'emploie à
lui épargner (`.devcontainer/demarrer.sh`).

**Ce qui, lui, a été corrigé sans attendre :** la ligne « Version » de Réglages
nomme désormais la **branche** suivie, et le bandeau du terminal ne l'annonce
plus périmée. Un espace en retard d'une branche se voit maintenant sur une
capture, sans avoir à poser la question — c'est précisément ce à quoi cette
ligne servait, et ce qu'elle n'a pas su faire ce soir-là.

### ~~0 terdecies. L'action « Nouveau chantier »~~ — **close le 2026-08-11, codée et éprouvée**

Le 11 août 2026, capture à l'appui : *« j'aime pas le gros bouton nouveau
chantier […] ce gros bouton en plein milieu, ça ne fait pas très luxe »*. Le
reste de l'écran lui convient — c'est **l'aplat vert seul** qui est en cause.

**Treize** remplaçants sont dessinés, en trois tournées — et l'un d'eux est
maintenant à moitié choisi : **le sceau clair** (maquette 16, deuxième
habillage), *« j'aime beaucoup la deuxième »*. Puis il a écarté le sceau
lui-même — *« le fond blanc me dérange »* — et demandé de l'innovation, pas une
variante. `docs/maquettes/18-six-matieres.html` répond sur deux axes : **des
matières** (laque, or brossé, cire, encre vivante, ou pas de disque du tout) et
**deux ouvertures où le bouton devient la page** au lieu de faire monter une
feuille.

**FAIT.** Le bouton est dans l'application depuis le 11 août au soir :
`src/app/EcranChantiers.tsx` et `src/app/globals.css`. Éprouvé par
`scripts/test-bouton-nouveau-chantier-e2e.ts` (la demi-seconde, le double appui,
le mouvement réduit), regardé par
`scripts/capture-bouton-nouveau-chantier.mts` (attente, geste, feuille). 108
suites base et 49 suites navigateur au vert, connexion réelle comprise.

**Ce qui a été retenu, pour mémoire :** C'est
`docs/maquettes/24-le-bouton-retenu.html` : **« Nouveau chantier » écrit, le
rond d'un cheveu qui bat à sa droite**, et à l'appui **trois tours avec onze
grains d'or**, puis la feuille une demi-seconde plus tard. Toutes les mesures
sont dans le tableau au bas de cette maquette — les reprendre telles quelles.

Il reste à **le coder** : le bloc `<Link>` de `EcranChantiers.tsx`, une
trentaine de lignes de `globals.css`, le délai avant l'ouverture de la feuille,
une suite qui mesure la demi-seconde et une capture. Une demi-journée. Deux
choses à ne pas oublier : l'appui doit s'enfoncer tout de suite (140 ms), et un
second appui pendant le tour doit être ignoré, sans quoi deux chantiers naissent
au lieu d'un.

**L'historique du choix (pour ne pas rouvrir ce qui est clos) :** C'est **l'anneau d'un cheveu avec
son « + »**, qui doit **tourner à fond puis ouvrir la page**. Sa place a été
tranchée juste après : **au centre**, à l'endroit qu'occupait l'aplat vert — et
non en haut à droite comme il l'avait d'abord montré — avec **un petit trait de
chaque côté, qui s'écarte à l'appui**. La dernière tournée ajoute **le mot** au geste
(`docs/maquettes/23-le-mot-et-le-rond-qui-bat.html`) : « Nouveau chantier »
écrit, le rond qui bat en attendant le doigt, et au clic le tour et la
poussière — sept dispositions du libellé. **Huit** autres déclinaisons du tour
seul restent dans `docs/maquettes/22-le-rond-entre-deux-traits.html` — dont deux qui reprennent
l'anneau de la note vocale (un cercle dehors, un cercle dedans), et une qui met
les crans de la dictée à la place des traits ; il ne reste qu'à en
désigner une, et le tour franc suffirait. (La version en haut à droite reste
dans la maquette 21, si jamais il y revenait.)

**Ce que coûtera la bascule, une fois la déclinaison choisie** : le bloc
`<Link>` de `EcranChantiers.tsx` devient un anneau posé dans l'en-tête (grille à
deux colonnes, aligné sur la ligne de base du titre), plus une trentaine de
lignes de `globals.css` pour le tour, plus le délai avant l'ouverture de la
feuille. Une demi-journée. Deux choses à ne pas oublier : l'appui doit s'enfoncer
tout de suite (140 ms), et un second appui pendant le tour doit être ignoré,
sans quoi deux chantiers naissent au lieu d'un.

**L'ancien squelette (rond plein au milieu, explosion, agrandissement) n'est plus
d'actualité** : il est resté une soirée. Ne pas le ressortir — maquette 20.

**Le squelette était arrêté par lui le 11 août en fin d'après-midi** : un rond plein avec un
« + », une explosion de débris à l'appui, et le rond qui s'agrandit jusqu'à
devenir la page. Six gerbes sont à l'essai dans
`docs/maquettes/20-le-rond-qui-eclate.html` ; il ne reste qu'à en désigner une.

La maquette 18 a été jugée trop démonstrative — *« tu as primé sur l'originalité
au détriment de l'élégance »*. `docs/maquettes/19-six-gestes-tenus.html` revient
donc à la retenue : plus de gerbe, plus de matière imitée, une seule chose qui
bouge à la fois.

**Ce qu'il faudra prévoir si une matière est retenue :** la teinte de laque
(#10150f → #263025) n'existe pas dans `src/lib/design-tokens.ts`, et l'ouverture
par agrandissement du disque n'est pas la transition actuelle — c'est un
changement de `FormulaireNouveauChantier` en feuille, pas seulement du bouton.
Compter une journée plutôt qu'une demi. La première
(`docs/maquettes/14-le-geste-nouveau-chantier.html`) amincit le bouton : le
filet qui se trace, le sceau, le premier brin, le cartouche gravé, la pastille
au pouce, la légende sur le trait. Elle n'a pas convaincu — *« je ne suis pas
encore hyper convaincu »* — et le pourquoi vaut d'être retenu : **six façons
d'amincir un bouton ne font qu'une idée**. La seconde
(`docs/maquettes/15-encore-six-gestes.html`) change donc de nature à chaque
fois : la ligne du registre, le titre qui porte l'action, la marque
d'imprimeur, le cinquième onglet, tirer pour ouvrir, le signet sur la tranche.
La troisième vient de lui : il a décrit le geste lui-même — *« une sorte de
pastille un peu ronde »*, qui *« se mette à tourner super vite »*, *« dégage
comme une sorte d'onde ou de petits fragments »*, et ouvre la feuille *« au bout
d'une demi-seconde »*. Elle est dessinée, et **pressable**, dans
`docs/maquettes/16-la-pastille-qui-tourne.html` — trois habillages, plus une
version sous le pouce.

**Rien n'est codé** tant qu'il n'a pas désigné le sien. Le 11 août, la pastille
avait été portée d'un coup dans l'application ; il l'a arrêté net — *« crée-moi
une maquette avant de changer quoi que ce soit »* — et le changement a été
défait. La règle est désormais dans `CLAUDE.md` §3 bis.

**Ce que coûtera la pastille, le jour où il la choisit** (mesuré, puis défait) :
le bloc `<Link>` de `EcranChantiers.tsx`, une trentaine de lignes de
`globals.css` pour le tour, l'onde et les éclats, une variable `--or` dans la
palette, une suite qui mesure la demi-seconde, et un script de capture. Une
demi-journée, sans surprise connue. Deux points à ne pas oublier : l'appui doit
s'enfoncer **tout de suite** (140 ms) sinon la demi-seconde passe pour une
panne, et un second appui pendant le geste doit être ignoré, sans quoi deux
chantiers naissent au lieu d'un.

Ce que coûtera la bascule, une fois le choix fait : **un seul endroit**, le
bloc `<Link>` de `src/app/EcranChantiers.tsx` (lignes 151-167). Vérifié plutôt
que supposé : les suites navigateur atteignent `/chantiers/nouveau` **par son
adresse**, aucune ne cherche le libellé — changer la présentation n'en casse
donc aucune, et **c'est justement le risque** : rien ne se plaindra si l'action
devient introuvable au doigt. Prendre une capture (`CLAUDE.md` §5) et rejouer
`test-rien-de-recouvert-e2e` — la suite qui mesure ce que le mobilier fixe
recouvre, et la seule qui verrait le défaut de la proposition E.

**Trois réserves à ne pas perdre.** La pastille flottante (E) entre en conflit
avec la bulle de l'assistant, qui occupe déjà ce coin — la maquette le montre
plutôt qu'elle ne le tait. Le cinquième onglet (J) **supprime** cette bulle :
c'est une décision à prendre avec lui, pas un détail de mise en page. Et le
geste de traction (K) ne doit jamais partir seul : un geste caché est élégant le
premier jour et coûteux le trentième, quand un remplaçant prend le téléphone.

### 0 duodecies. `test-devis-papier-e2e` échoue sur le banc local

`TypeError: Cannot read properties of undefined (reading 'id')` — la suite
cherche une ligne dans `devis` pour son chantier et n'en trouve aucune.

**Ce n'est PAS la refonte** : vérifié en remisant les modifications et en
rejouant la suite sur le code d'avant — même échec, à la même ligne. Le défaut
lui est antérieur. Reste à savoir s'il tient au harnais (`run-e2e-tests` monte
son propre serveur et son propre jeu de données) ou à la suite elle-même. À
reproduire d'abord par `npm run test:e2e` complet avant de conclure.

### 0 bis. L'agent qui apprend — LA SUITE, demandée explicitement

**Consigne du patron, le 6 août 2026, après la fusion de la mémoire des
corrections :** *« Ok, garde ça en mémoire et on fera ça après. N'oublie pas de
le faire. »*

C'est donc **le prochain travail**, pas une liste d'idées. Une conversation qui
reprend à froid enchaîne sur (b), puis (c), puis (d) — sans reposer la question.
C'est la deuxième fois qu'il demande expressément qu'un point soit consigné
plutôt que retenu (la première : la sauvegarde, §0) ; le lui faire répéter une
troisième serait une défaillance de ce fichier.

Le tapis roulant (dictée → devis, d'un seul geste) est en place, l'arrêt
d'avant-chiffrage aussi (§0 ter), et la mémoire des corrections également
(§0 quater). Reste, dans l'ordre décidé avec lui le 5 août 2026 :

| | Quoi | Pourquoi maintenant |
|---|---|---|
| a | ~~**Mémoire des corrections.**~~ **Fait le 6 août 2026** — voir §0 quater. | |
| a bis | ~~**Le découpage des lignes, et la grille de fendage.**~~ **Fait le 8 août 2026** — voir §0 quinquies. | |
| b | **Entretien de départ.** Il n'a aucun ancien devis à donner en référence — c'est donc l'agent qui l'interroge une fois et écrit ses règles. | Sans ça, l'agent démarre en ne sachant rien et apprend aux frais du patron. |
| c | **Écart devis / facture.** Les données existent déjà des deux côtés. | La meilleure leçon qui soit : ce qui avait été mal estimé s'y voit tout seul. |
| d | **Photos ↔ prix.** Conserver le lien entre les photos d'un chantier et le devis qui a suivi. | Objectif du patron : « à force de comparer les photos des arbres et les devis, il devra proposer un prix juste ». Impossible aujourd'hui — mais **l'accumulation doit commencer maintenant**, sinon dans six mois il n'y aura toujours rien à apprendre. |

**Et un cinquième point, né du lot du 6 août :** le **rapport entre techniques**
(×1,67, ×2,33 — `docs/EXEMPLE-DICTEE.md` §9a). Il ne s'écrit pas en dur : c'est
une moyenne mobile, recalculée sur les devis réellement faits. Il ne peut donc
exister qu'à partir de plusieurs chantiers comparables — `lecons_prix` les
accumule depuis le 6 août. **À reprendre quand la mémoire est fournie**, pas
avant : un rapport tiré d'une seule observation serait une règle inventée.

**Réserve levée le 5 août 2026.** Un prix déduit d'une photo est une estimation,
ce que `docs/AGENT.md` §3 interdisait. Le patron a tranché : *« rien ne sera
jamais envoyé sans vérification du patron, ça restera qu'une proposition. »* La
règle est assouplie — l'estimation est permise **à condition d'être signalée
comme telle**, et c'est l'arrêt 1 qui porte la garantie. Voir `AGENT.md` §3.

**Et une contrainte de fond, soulevée par le patron le même jour :** *« si
l'appli n'a aucune mémoire, comment l'IA va enregistrer et se souvenir ? »* Il a
raison, et ça conditionne (a) à (d). L'application a bien une mémoire — une base
PostgreSQL sur volume persistant — mais **celle du banc d'essai meurt avec
l'espace de travail**, qui est jetable par construction. Tout ce qui s'apprend
ne sera durable qu'une fois l'hébergement choisi (point 3 de `A-FAIRE.md`).
Construire l'apprentissage sur le banc reste utile pour l'éprouver ; ce qui s'y
accumule ne doit pas être présenté comme conservé.


### 1. Agenda Google — au choix de chaque artisan

> **Fait le 9 août 2026, sauf les identifiants.** L'écran « Mon agenda », le
> stockage chiffré, la fusion dans la disponibilité et les deux chemins du
> client sont écrits et éprouvés (`ARCHITECTURE.md` §39). **Ce qui reste tient
> en une chose, et elle n'est pas codable** : les identifiants OAuth, que seul
> le patron peut créer (`docs/A-FAIRE.md` §7). Tant qu'ils manquent, l'écran
> l'annonce et ne propose aucun bouton.
>
> **Et ce qui n'a pas pu être éprouvé ici** : l'aller-retour réel avec Google —
> autorisation, échange du code, renouvellement du jeton. Trois appels HTTP, pas
> davantage : tout ce qui décide en a été sorti exprès. À vérifier chez lui, le
> jour où les identifiants existent.

**Partiellement bloqué.** La connexion du compte demande des identifiants OAuth
que le patron doit créer ; le reste est codable. Le point bloquant est détaillé
dans `docs/A-FAIRE.md` §7.

Aujourd'hui, les jours libres se déduisent des seuls chantiers planifiés dans
Atlas (`src/server/disponibilites.ts`). Un patron qui tient son agenda ailleurs
verra donc proposer des jours où il est déjà pris — et c'est le client qui
choisira ce jour-là.

**Décision du patron, le 9 août 2026** — *« ce qui serait bien, c'est que
l'utilisateur puisse, s'il le souhaite ou non, connecter son planning à son
agenda Google »* — et elle contraint la conception :

- **C'est un choix par artisan, pas un réglage de l'application.** Chacun relie
  son agenda ou ne le relie pas. Celui qui ne relie rien garde exactement
  l'Atlas d'aujourd'hui : pas d'écran en plus, pas de compte à créer, aucun
  chemin de code nouveau à traverser.
- **Le jeton de raccordement appartient à l'entreprise**, donc il vit en base
  sous RLS, comme tout le reste — jamais dans une variable d'environnement
  partagée, qui vaudrait pour tout le monde à la fois.
- **Atlas ne lit que les créneaux occupés.** Jamais l'intitulé, jamais les
  participants. Un agenda personnel porte les rendez-vous médicaux et les
  vacances de la famille ; Atlas n'en a pas besoin pour savoir qu'une journée
  est prise. Même règle qu'à la page du client, qui reçoit des dates et rien
  d'autre (`docs/AGENT.md` §2.2 bis).
- **Une seule fonction de disponibilité**, jamais deux. La fusion des créneaux
  Google et des chantiers Atlas se fait *dans* `src/server/disponibilites.ts`.
  Un second calcul à côté finirait par diverger du premier — c'est exactement le
  défaut qui a produit, le 9 août, un chantier rangé dans deux onglets à la fois
  (`ARCHITECTURE.md` §33).

À faire une fois les identifiants disponibles : le bouton « Relier mon agenda »
dans les réglages, le raccordement du compte, la lecture des créneaux sur la
fenêtre de proposition, la fusion ci-dessus, et l'écriture de l'intervention
après acceptation.

**Ce qui ne pourra pas être éprouvé ici :** sans compte Google raccordé, aucun
contrôle local ne parcourt le vrai chemin. La partie fusion, elle, est une
fonction pure et s'éprouve entièrement (`CLAUDE.md` §5).

### 2. Code SMS en renfort de l'acceptation

L'acceptation conserve déjà l'empreinte du PDF, l'horodatage, l'adresse IP et le
canal (`docs/AGENT.md` §5, ligne « Acceptation tracée »). Ce qui manque est un
code à usage unique envoyé au client au moment où il accepte.

**Sans objet en l'état** : le patron a écarté tout fournisseur d'envoi
(`ARCHITECTURE.md` §13), et un code qu'il devrait transmettre lui-même
n'apporterait rien. À rouvrir seulement si un fournisseur est un jour souscrit.

### 3. Relance automatique d'un devis sans réponse

L'état « à relancer » existe, s'affiche, et le lien reste proposé pour un renvoi
manuel. **Sans objet en l'état**, pour la même raison qu'au point 2 : la relance
part de la messagerie du patron, comme l'envoi.

### 4. L'assistant répond en JSON brut

Interrogé « Comment a été envoyé le devis ? », il a répondu :
`D'après LireDevis, voici ce que j'ai trouvé : {"existe":true,"numeroCommercial":"2026-0003",…}`.
Le patron n'a pas à lire du JSON. L'assistant doit répondre en français, ou dire
qu'il ne sait pas — et jamais recracher la sortie d'un outil telle quelle.

### 5. ~~Les équipes nommées~~ — fait le 10 août 2026

**Demandé par le patron le 10 août** : *« il faut que dans le fichier réglages
on puisse mettre le nom des équipes — soit équipe A équipe B, soit des noms et
prénoms. Mais s'il n'a pas d'équipe et qu'il ne met rien, il ne faut pas qu'il y
ait quand même écrit équipe A équipe B. »*

Table `equipes` (`nom` **nullable**), colonne `chantiers.equipe_id`, et une
seule fonction pure qui décide du libellé (`src/lib/equipes.ts`). Le planning se
lit désormais au mois, avec une ligne par équipe sous chaque demi-journée.
Détail et pièges dans `ARCHITECTURE.md` §51 et §52.

**Ce qui n'a PAS bougé, et qu'il ne faut pas « corriger » :**

- **`entreprises.nombre_equipes` fait toujours autorité sur le NOMBRE.** La
  table ne porte que des noms. Un `COUNT(*)` ferait dépendre le calcul des
  disponibilités de lignes qu'aucun écran n'oblige à créer.
- **Aucun nom n'est écrit en base au moment de l'insertion.** Le repli
  « Équipe A » est un affichage — l'écrire en donnée le rendrait indiscernable
  d'un nom choisi, et un retour à une seule équipe le ferait parler.

Écarté aussi, et volontairement : les **heures réelles** (« la demi-journée
suffit ») et la **capacité en hommes** — `taille_equipe` est du texte libre, il
faudrait le fiabiliser avant d'en faire une contrainte. Voir `ARCHITECTURE.md`
§22 pour les arbitrages.

### 5 bis. ~~« Terminés » et le parcours de facturation~~ — fait le 10 août 2026

Le §6 quinquies de `docs/INTEGRER-ORIGINE.md` : l'écran devient un **fil par
mois**, l'encart « à facturer » se pose **dans le mois** plutôt qu'à côté, et le
relevé de TVA cesse d'être un pavé pour devenir une ligne au pied.
`ARCHITECTURE.md` §53.

**Trois décisions du patron, prises le 10 août et à ne pas rouvrir :**

1. **« Fin de chantier » devient « Créer la facture »**, sur les trois écrans
   qui portaient le mot (fiche, planning, écran de facture). Le nom dit
   désormais ce que la touche fabrique.
2. **Une facture à 0,00 € s'affiche telle quelle**, sans mention ni
   avertissement. Il en a une dans ses données réelles (F2026-0001) : un
   montant nul se lit, il ne se commente pas.
3. **La bulle de l'assistant s'écarte du bandeau** — elle venait toucher la
   dernière ligne de l'écran.

**Ce qui a été vérifié et qui n'était PAS un défaut :** `listerChantiersTermines`
compte bien un chantier du 20 comme terminé **le 21**, jamais le 20 à minuit
(`ongletDepuisJalons` : `datePlanifiee < aujourdHui`). La journée entière reste
au planning — c'est de là que le patron clôture en rentrant.

### 7 bis. ~~Le retrait, partout~~ — fait le 10 août 2026

Le cinquième choix du patron sur les maquettes : « le tiroir des retirés »,
appliqué aux **huit** endroits qui suppriment (le recensement de
`docs/INTEGRER-ORIGINE.md` §4 bis en annonçait sept — le planning manquait).
Détail et pièges dans `ARCHITECTURE.md` §48.

**Ce qui reste de la fiche `docs/INTEGRER-ORIGINE.md` :** son §6, l'ouverture
de « Nouveau chantier » — et il porte un point de PRODUIT non tranché, à poser
au patron avant de coder : cet écran est aujourd'hui une page avec sa flèche de
retour, quand l'ouverture retenue raconte une feuille modale.

**Deux choses laissées telles quelles, et dites plutôt que tues :**

- **Les maquettes `/design/prix`** montrent encore l'ancienne croix nue et le
  bandeau flottant (`AnimatedRow`, `UndoToast`, qui ne servent plus qu'à
  elles). Elles sont découplées du produit depuis le 1er août ; les reprendre
  ou les retirer reste à décider, mais elles contredisent l'application.
- **Le geste en diagonale n'a pas pu être éprouvé ici** : le glissement
  horizontal du texte et l'accroche verticale du fil ne portent pas sur le même
  axe, mais un pouce, lui, bouge en biais. Un navigateur piloté ne le
  reproduit pas — à essayer sur un vrai téléphone.

### 7 ter. ~~L'anneau muet et la pellicule~~ — fait le 10 août 2026, au soir

Le §6 bis de `docs/INTEGRER-ORIGINE.md` : sur la fiche chantier, un **anneau
muet** remplace la ligne « Note vocale » comme accès direct — on le touche, la
note se lit ; on le pousse vers le haut, « Retirer » se découvre. Les photos
deviennent une **pellicule** dans le tiroir du bas, case « + » en tête, et la
ligne « Photos · 6 photos » disparaît. Détail et pièges dans
`ARCHITECTURE.md` §49.

**L'en-tête de la fiche ne bouge pas — ~~à trancher~~ TRANCHÉ le 10 août 2026.**

La maquette `atlas-note-vocale.html` raconte en plus de l'anneau une **scène**
entière : grand titre serif, phrase de situation (« Intervention prévue vendredi
15 août »), à la place de l'en-tête commun. La question lui a été posée en
image ; sa réponse : **« N'y touche pas. »**

**Ne pas la rouvrir en découvrant l'écart avec la maquette.** L'écart est connu
et voulu. `EnTeteEcran` est **une seule pièce partagée** par la fiche, le
planning, les terminés, les réglages et les six écrans d'étape : la refaire
pour la seule fiche désaccorderait cet écran de tous les autres, et la refaire
partout serait un lot en soi, touchant l'accueil — que le patron a arrêté et
qu'il ne veut pas revoir.

Si le sujet revient, c'est **lui** qui le rouvre, et alors c'est « partout »
ou rien.

### ~~9. La ligne sous le nom, dans la liste des chantiers~~ — **tranché et codé le 13 août 2026 : le D, avec la date d'envoi**

**Le patron, le 13 août 2026 :** *« le devis a été envoyé et il n'a toujours pas
eu de réponse […] tu marques quelque chose du style devis envoyé, attente de
réponse, je te laisse libre de choisir et de proposer des alternatives si tu
penses qu'il faudrait rajouter d'autres informations à ce niveau-là. »*

**Il a retenu D**, en remplaçant le délai par la date : « DEVIS ENVOYÉ · SANS
RÉPONSE » en or, et dessous « Envoyé le jeudi 13 août. » La règle vit dans
`ligneEtatChantier` (`src/lib/chantier-etat.ts`), éprouvée sans base ni
navigateur. `ARCHITECTURE.md` §79.

**Les quatre autres restent dans la planche** — `docs/maquettes/41-la-ligne-sous-le-nom.html`,
engendrée par `scripts/engendrer-maquette-ligne-chantier.mts`. Si le sujet se
rouvre, repartir de là :

| | Libellé | Ce qu'elle apprend |
|---|---|---|
| A | « Devis envoyé · en attente de réponse » | ses mots, au plus court |
| B | « Envoyé il y a 3 jours · sans réponse » | **le délai — la seule chose qui décide une relance** |
| C | « Envoyé le 10 août · valable jusqu'au 24 » | quand le devis cessera d'être ouvrable |
| D | deux lignes, la seconde en clair | ce qu'il y a à faire, en toutes lettres |
| E | avec le montant | lequel rappeler en premier |

**Ce qui contraint le choix, et qui a été MESURÉ sur l'écran** (`ARCHITECTURE.md`
§78) : le libellé actuel tient sur une ligne à 430 px — la largeur de son
téléphone — et déborde à 390. A et B tiennent chez lui ; C et E débordent
partout.

**Deux points à lui redire quand il tranchera :**

- la mention « sans photo » n'a plus d'utilité une fois le devis parti : elle
  disparaît dans toutes les propositions ;
- l'or est réservé à ce qui **attend un geste de lui**. Un devis parti sans
  réponse n'attend rien de lui, d'où le gris. **D est la seule qui rouvre ce
  choix**, et c'est délibéré.

E est la seule qui coûte une sous-requête de plus (le montant n'est pas chargé
par l'écran d'accueil).

### 8. L'écran Facture — trois manques signalés par le patron le 10 août 2026

Constatés par lui sur son banc, capture à l'appui. Aucun n'est corrigé.

1. **Impossible d'enregistrer la facture.** Sous « Voir la facture en PDF », il
   veut **un petit lien pour la télécharger** sur son téléphone ou son
   ordinateur. Aujourd'hui il ne peut que l'ouvrir. Un `<a download>` vers la
   route du PDF suffit, avec un nom de fichier qui porte le numéro de facture —
   « F2026-0001.pdf », pas « facture.pdf » : il en aura des centaines.
2. **« Ouvrir le SMS tout prêt » est carré**, alors qu'il le veut **ovale comme
   tous les autres**. À éclaircir avant de coder : depuis le 10 août tous les
   boutons sont à 5 px de rayon (`radius.button`). Lui montrer deux variantes
   plutôt que deviner — et si c'est bien un bouton en gélule qu'il veut,
   **c'est la charte entière qui change**, pas ce bouton-là.
3. **On ne propose que le SMS.** Il veut pouvoir **envoyer la facture par
   e-mail**. `composerMessageFacture` et `lienTransmission` savent déjà faire
   les deux (`src/lib/message-client.ts`, canal `"email"`) : c'est l'écran de
   la facture qui n'offre pas le choix. Voir comment l'écran du devis propose
   SMS **ou** e-mail, et faire pareil.

Le troisième est le plus important : une facture qu'on ne peut pas envoyer par
courriel, c'est un client sur deux qu'on ne peut pas facturer.
Constatés par lui sur son banc, capture à l'appui.

**⚠ Ce point avait été consigné sur `claude/migrate-app-atlas-zz31ac` et n'a
jamais rejoint `main`** : cette branche est restée deux commits derrière une
après-midi de travail, et le point était donc invisible de toute conversation
qui lisait `TODO.md`. Il a fallu qu'il le redemande. **La leçon est celle de
`CLAUDE.md` §6 : rien n'est livré tant que ce n'est pas sur `main`** — pas même
une ligne de mémoire.

1. ~~**Impossible d'enregistrer la facture.**~~ — **fait le 12 août 2026.**
   Sous « Voir la facture en PDF », un lien « Télécharger (F2026-0001.pdf) ».
   Le nom porte le numéro — il en aura des centaines — et dit « brouillon »
   tant que la facture n'est pas arrêtée. **C'est le SERVEUR qui range le
   fichier** (`Content-Disposition: attachment` sur `?telecharger=1`) : le seul
   attribut `download` du lien est ignoré par certaines versions d'iOS, et le
   PDF s'ouvrait alors dans un onglet sans rien enregistrer.
2. ~~**« Ouvrir le SMS tout prêt » est carré**, alors qu'il le veut **ovale
   comme tous les autres**.~~ — **tranché et codé le 12 août 2026 : « code la
   A », la capsule.** Le bouton passe par `PrimaryButton`, jamais par un dessin
   recopié sur place : c'est le défaut même qu'on répare (§0 octies), et le
   repeindre à la main le ferait revenir au prochain changement de charte.

   **Deux réglages facultatifs ont été ajoutés à `PrimaryButton`**, sans
   toucher au dessin : `onClick` est désormais honoré sur la variante `href`
   (elle le perdait en silence — le départ vers la messagerie n'aurait plus été
   retenu), et `repere` pose un `data-atlas` pour que les suites désignent ce
   lien autrement que par son texte.

   *Les planches restent, elles racontent le chemin :*

   - `docs/maquettes/38-le-bouton-de-la-facture.html` — deux dessins immobiles :
     **A**, la capsule exacte des dix-sept autres écrans ; **B**, la même
     capsule cernée d'un filet ;
   - `docs/maquettes/39-le-bouton-de-la-facture-a-lessai.html` — **cinq gestes
     qui se pressent pour de vrai**, demandés le 12 août : *« plusieurs versions
     cliquables et dynamiques […] une appli hyper luxe et moderne »*. A la
     capsule nue, B la lueur qui traverse la laque, C le cachet qui tourne et
     sème l'or, D l'encre qui remplit, E le trait qui s'ouvre. Éprouvée au doigt
     par `scripts/verifier-maquette-bouton-facture.mjs`.

   **Il a retenu A**, la capsule nue — la retenue, encore une fois, comme à
   chaque tournée depuis le 11 août. Les quatre gestes écartés (la lueur, le
   cachet, l'encre, le trait) restent dans la maquette : s'il rouvre le sujet,
   c'est là qu'il faut repartir, et non les redessiner.

   **Ce qu'il faut lui dire, et qui a changé depuis sa demande :** le 10 août,
   tous les boutons étaient à 5 px de rayon et « ovale » aurait voulu dire
   changer la charte entière. Le 11 août au soir il a choisi la capsule, et
   « partout » — ce bouton-là est simplement passé au travers, parce qu'il est
   **peint à la main dans l'écran** (`TODO.md` §0 octies, même défaut que la
   feuille d'envoi du devis). **Choisir A ne rouvre donc aucune décision.**

   *Une capsule pleine largeur avait été dessinée d'abord : mesurée, elle est
   indiscernable de A — le libellé remplit la carte à deux pixels près. Deux
   dessins identiques ne font pas un choix, d'où le changement d'axe.*
3. ~~**On ne propose que le SMS.**~~ — **fait le 12 août 2026, et c'était le
   plus grave.** Une facture qu'on ne peut pas envoyer par courriel, c'est un
   client sur deux qu'on ne peut pas facturer. L'écran offre désormais les deux
   voies (`src/app/chantiers/[id]/facture/TransmettreLaFacture.tsx`), et **la coordonnée manquante se
   saisit sur place** — il n'existe aucun écran de fiche client où l'envoyer.
   `ARCHITECTURE.md` §73.

### 7. Finir la refonte — l'ordre, les pièges, les valeurs

**Ce point existe pour qu'une conversation neuve puisse reprendre le travail
sans rien redemander.** Le CSS n'est pas recopié ici : il est dans la maquette
publiée, `docs/maquettes/13-le-fil-quatre-couleurs.html`, qui est du HTML pur —
ouvrez-la, lisez la feuille de style, elle fait foi pour le dessin.

#### L'ordre, et où l'on en est

| | Écran | État |
|---|---|---|
| — | Accueil, Planning, Terminés, Réglages, relevé de TVA | **fait** le 10 août 2026 |
| — | Fiche chantier, entièrement | **fait** |
| — | En-tête + boutons des six écrans d'étape | **fait**, par remplacement de motif |
| — | Corps de Photos | **fait** |
| ~~1~~ | ~~Corps de **Note vocale**~~ | **fait** le 10 août 2026 |
| ~~2~~ | ~~Corps d'**Informations** puis de **Prix**~~ | **fait** le 10 août 2026 |
| — | Fiche chantier : **l'anneau muet** et **la pellicule** | **fait** le 10 août 2026, au soir |
| **3** | Corps de **Devis**, **Export**, **Facture** | à faire |

**Ce que l'étape 2 a appris, et qui sert à l'étape 3.**

- **Les deux voix sont désormais des jetons** : `libelleCaps` et
  `texteSituation` dans `src/lib/design-tokens.ts`. Ne plus les retaper à la
  main. `smallCaps`, l'ancienne voix, ne sert plus qu'aux maquettes
  `/design/*` — un écran qui l'importe encore n'est pas refait.
- **L'écran Informations n'était pas dans « les six »** : son en-tête avait été
  oublié le 10 août au matin, et il est passé à `EnTeteEcran` avec son corps.
  Vérifier que **Transcription** ne dort pas dans le même angle mort.
- **Une action en capitales prend deux fois la place.** « Voir la
  transcription » à droite du titre repliait le nom du chantier sur deux
  lignes ; une flèche de plus faisait passer « Aller jusqu'au devis d'un seul
  geste » à deux lignes, la flèche seule sur la seconde. Mesurer avant, ou
  déplacer l'action.
- **Une plage occupe la largeur ; une action en toutes lettres s'aligne à
  gauche.** Sans `self-start`, un bouton texte s'étire et se centre tout seul.
- **`innerText` rend le texte TEL QU'IL S'AFFICHE.** Trois contrôles cherchaient
  « Prix Calculé » ou « Déjà au détail » ; les capitales les ont cassés sans
  qu'aucun défaut n'existe. Le réflexe utile : avant de corriger le produit,
  regarder si le contrôle lit du rendu ou de la donnée.
- **Prendre la capture d'abord, et à deux endroits** :
  `npx tsx scripts/capture-etape.mts <dossier> <chantierId> <étape…>` écrit le
  haut ET le bas de chaque écran. Les deux défauts réels de l'étape 2 — une
  croix hors de l'écran, la bulle sur le bouton — n'étaient visibles que là.
- **Le jeu de démonstration ne pose ni brouillon ni dictée analysable ici** :
  pour regarder un écran plein, insérer soi-même une ligne dans
  `brouillons_informations`. Sans cela on juge un écran vide.

Il n'y a plus de motif commun à remplacer : chacun a sa structure, donc plus de
codemod possible. C'est du cas par cas, **et chaque écran se regarde en capture
avant d'être déclaré fait** — trois défauts réels de cette refonte n'ont été
trouvés que là (`CLAUDE.md` §5).

#### Les valeurs de la grammaire

Elles ne s'inventent pas écran par écran : elles viennent des trois pièces
partagées — `EnTeteEcran`, `PrimaryButton`, `src/lib/design-tokens.ts`.

| Quoi | Valeur |
|---|---|
| Marge horizontale | **26 px** partout (`px-[26px]`), jamais 24 |
| Rayon | **4 px** pour une plage, **5 px** pour une action. Rien au-delà |
| Ombre | **aucune** (`cardShadow` vaut `"none"`) |
| Titre d'écran | serif, **36 px**, `letter-spacing: -0.018em` |
| Nom d'un chantier, intitulé d'étape | serif, **19 px** |
| Libellé, état, action secondaire | capitales, **9,5 px**, `letter-spacing: 0.28em` |
| Texte de situation (adresse, meta) | **11,5 px**, en `colors.muted` |
| Séparateur | un cheveu d'1 px, `colors.line` |
| Couleur d'attente | l'or, **et uniquement sur ce qui réclame un geste du patron** |

#### Les pièges, tous rencontrés une fois

1. **`npm run banc` ne rebâtit que si le commit a changé.** Tant que le travail
   n'est pas commité, il ressert la version d'avant : on mesure du code qui
   n'est pas sur le disque. `rm .next/atlas-version-batie.txt` force le rebâti.
2. **`npm test` abîme le jeu de démonstration.** Après la batterie, la connexion
   `demo@atlas.local` échoue jusqu'à un nouveau
   `DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:seed`.
3. **Un bandeau posé dans l'en-tête écrase la liste.** Tout ce qui peut
   apparaître (notifications, annonces) va DANS la zone qui défile.
4. **`CarteGlissante` repeint ce qui est dessous** : sa couche porte le fond de
   la page. Un trait dessiné sous une liste glissante disparaît — le dessiner
   ligne par ligne.
5. **`position: sticky` est borné par le PARENT**, pas par le conteneur qui
   défile. Un élément collant enfermé dans un `div` d'une ligne ne colle que sur
   cette ligne : utiliser un fragment.
6. **Une feuille en `absolute` passe SOUS le bandeau et la bulle**, tous deux
   fixés. Une feuille modale se pose en `fixed`, au-dessus de `z-40`.
7. **Le navigateur d'essai** : `chromium.launch({ executablePath:
   "/opt/pw-browsers/chromium" })`, sinon Playwright réclame une installation
   qui est pourtant là (voir §0).

#### Les deux réserves — ce qui ne doit PAS suivre

- **Les maquettes `/design/*`** : découplées du produit depuis le 1er août,
  elles ne sont pas des écrans du patron.
- **Les pages que le CLIENT reçoit** — `devis/[jeton]`, `factures/[jeton]`, et
  le PDF. Un devis n'est pas un écran : c'est la pièce que le client garde,
  imprime et signe, et le patron a choisi sa terre cuite le 3 août **en
  connaissance de cause**, puis l'a maintenue.

**~~Question ouverte~~ — tranchée par le patron le 10 août 2026 :** *« il faut
que toutes les écritures de l'appli changent de police, on harmonise le tout. »*
Le devis et la facture suivent donc l'écran, et il n'y a plus d'exception de
typographie nulle part.

**Et la couleur suit aussi**, tranchée dans la foulée : *« oui, harmonise aussi
le devis »*. La terre cuite disparaît, l'accent des documents devient l'or.
`couleursDocument` reste néanmoins un jeton à part — papier et encre d'une
pièce imprimée ne suivront pas forcément un futur écran sombre.

Le **PDF**, lui, n'a jamais chargé Playfair ni Inter : il embarque Times et
Helvetica, les polices standard du format — il était déjà d'accord avec ce que
l'écran est devenu.

### 6. Rien ne mène le patron d'un écran au suivant

**Le tronçon principal est réglé** (2026-08-04) : depuis la transcription, un
seul appui va jusqu'au devis chiffré. Restent les marches d'à côté — après une
photo, après un tarif enregistré, après une facture émise, rien n'indique où
l'on va. Un écran qui ne dit pas la suite se lit comme une application en panne,
et c'est déjà arrivé.

---

## Terminé

- ~~La TVA n'entre au relevé qu'au paiement, avec l'endroit où les factures attendent~~ — 2026-08-16
- ~~Ajouter et retirer des cases : tranches, façons d'abattre et travaux se règlent~~ — 2026-08-14
- ~~L'unité d'un tarif se choisit dans un bandeau déroulant, sans fermer la case~~ — 2026-08-14
- ~~Reprendre l'application Arborea sans le site vitrine, et la publier~~ — 2026-07-31
- ~~Vérifier le site publié à son adresse publique~~ — 2026-07-31
- ~~Cadrer l'agent (`docs/AGENT.md`) et la conformité (`docs/RGPD.md`)~~ — 2026-08-01
- ~~Acceptation des documents légaux avec empreinte~~ — 2026-08-01
- ~~Page publique de réponse du client, jeton, expiration, contre-proposition~~ — 2026-08-01
- ~~Purge de l'audio, export et effacement d'un client~~ — 2026-08-01
- ~~Envoi du devis au client, canal recueilli à la création~~ — 2026-08-01
- ~~Onglet « Terminés », fin de chantier, facture, relevé de TVA~~ — 2026-08-01
- ~~Suivi du devis parti : cinq états, notification, reprise~~ — 2026-08-01
- ~~Mémoire permanente du dépôt (ces fichiers)~~ — 2026-08-01
- ~~Caducité distincte du refus, et remontée à l'accueil~~ — 2026-08-01
- ~~Compteur d'accueil : ne plus compter les chantiers facturés~~ — 2026-08-01
- ~~Découpler les maquettes `/design/*` du type de statut vivant~~ — 2026-08-01
- ~~Le devis PDF reprend le modèle d'Arborea, et se pagine~~ — 2026-08-03
- ~~`test-reglages-e2e.ts` : attendre l'enregistrement, pas un délai fixe~~ — 2026-08-03
- ~~Document PDF pour la facture, sur le moteur partagé avec le devis~~ — 2026-08-03
- ~~Le devis à 0 € : bouton grisé, marche à suivre, et refus côté serveur~~ — 2026-08-03
- ~~Navigation : la barre du bas reste (décidé) ; l'action principale prend la carte d'Arborea~~ — 2026-08-03
- ~~La dictée arrivait amputée à l'écran : découpage, durée, vocabulaire, déchets~~ — 2026-08-03
- ~~Écrire le devis soi-même depuis l'écran Informations~~ — 2026-08-03
- ~~Le devis doublait au retour arrière du navigateur (4 017,60 € au lieu de 2 008,80 €)~~ — 2026-08-03
- ~~« Fin de chantier » injoignable sur un chantier planifié~~ — 2026-08-03
- ~~Planifier en demi-journées, et compter les équipes (le client ne voit que la date)~~ — 2026-08-03
- ~~Le client peut demander une correction, et son message parvient au patron~~ — 2026-08-03
- ~~La durée du chantier se choisit à la molette (½ journée à 100 jours)~~ — 2026-08-03
- ~~La durée dictée n'entrait pas dans la planification : un chantier de 2 jours n'en bloquait qu'un~~ — 2026-08-03
- ~~Le SMS s'ouvrait sans destinataire ; le canal se change désormais, et la coordonnée manquante se saisit sur place~~ — 2026-08-04
- ~~De la dictée au devis en un seul geste, et plus aucun écran mort quand le fournisseur répond à côté~~ — 2026-08-04
- ~~L'espace d'essai récupère le code neuf à chaque allumage, et l'application annonce sa version~~ — 2026-08-04
- ~~La date des documents s'écrit jour/mois/année~~ — 2026-08-04
- ~~La bande des durées est aussi sur l'écran Informations, là où il la cherchait~~ — 2026-08-04
- ~~Rédiger le devis entièrement à la main, depuis la fiche du chantier~~ — 2026-08-04
- ~~Retirer la case « Nom du chantier » : plus rien n'est obligatoire à la création~~ — 2026-08-05
- ~~« Rédiger à la main » ouvre le devis ENTIER, à l'image du modèle, et il reste dans Atlas~~ — 2026-08-05
