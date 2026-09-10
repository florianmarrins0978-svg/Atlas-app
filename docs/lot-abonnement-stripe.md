# L'abonnement se paie — Stripe

**9 septembre 2026.** Sa demande : *« et que si on clique sur s'abonner qu'on
puisse payer, mets tout le système en place »*, puis, après la comparaison des
prestataires : *« fais-moi Stripe »*.

---

## En trois lignes

L'écran « Abonnement » ne décrit plus ce qu'il y aura un jour : il porte les
trois formules de sa planche, l'état de son abonnement, et de quoi le régler.
Le paiement passe par Stripe, aucun numéro de carte ne traverse Atlas. La
sixième personne aux devis est refusée en « Entreprise » — sa règle. **Rien ne
se ferme pour ceux qui n'ont pas d'abonnement.**

---

## Ce qui a été fait, point par point

| Point | Verdict | Ce qui le fonde |
|---|---|---|
| Les trois formules à l'écran | **fait** | `src/lib/abonnements.ts`, `src/app/reglages/abonnement/` |
| Cliquer sur « S'abonner » et payer | **fait** | `src/server/paiement/stripe.ts`, page de paiement hébergée |
| Voir où en est son abonnement | **fait** | l'état, le prix, la date du prochain paiement |
| Gérer sa carte, ses factures Atlas, résilier | **fait** | le guichet hébergé par Stripe |
| Changer de formule | **fait**, au prorata | `changerDeFormuleAction` |
| Limiter à 5 commerciaux, illimité à 120 € | **fait** | le plafond mord sur deux portes, pas une |
| Cloisonner les fonctions par formule | **refusé pour l'instant** | voir « Ce que j'ai refusé » |
| Un essai gratuit | **pas fait, exprès** | sa durée n'est pas décidée |

---

## Les décisions que j'ai prises, et pourquoi

### 1. Le prix ne vient PAS de Stripe — c'est la décision structurante

Brancher Stripe se fait d'ordinaire ainsi : on crée trois tarifs à la main dans
son tableau de bord, on copie les identifiants dans la configuration, et
l'application les cite.

**Je l'ai refusé.** Ce serait deux grilles tarifaires : l'une dans le code,
l'autre chez Stripe. Le jour où l'une change sans l'autre — et cela arrive —
l'écran affiche 29 € pendant que la banque prélève autre chose. Sur le seul
écran d'Atlas où une erreur se compte en euros, c'est le défaut à éviter avant
tous les autres.

**À la place :** le montant vit dans un seul fichier, et Atlas demande à Stripe
un tarif à cette image, sous une clé qui **contient le montant**. Tant que le
prix ne bouge pas, le même est réemployé. Le jour où il bouge, un tarif neuf
naît tout seul et l'ancien reste attaché aux abonnements en cours — personne
n'est jamais reprélevé d'un montant qu'il n'a pas accepté.

**Ce que cela coûte, et je le dis :** le portail de Stripe ne sait proposer un
changement de formule que parmi des tarifs déclarés à la main. J'ai donc écrit
le changement de formule **dans Atlas**, au prorata. C'est une quarantaine de
lignes de plus, et cela règle aussi un risque plus grave : rouvrir un paiement
pour quelqu'un de déjà abonné créerait un **second abonnement vivant**, prélevé
tous les mois à côté du premier.

### 2. Ce qui se compte, c'est qui FABRIQUE — votre correction

Vous aviez dit : *« je pense pas qu'il faut de limite d'utilisateur à 5, ou
alors limiter à 5 commerciaux »*. C'est ce qui est codé, et cela va plus loin
que la formulation : le plafond compte le patron, la facturation et les
commerciaux. **Jamais les salariés.**

Un paysagiste avec huit gars sur le terrain n'utilise pas huit fois Atlas — il
coche huit cases dans un planning. Les compter reviendrait à facturer la taille
de ses chantiers au lieu de l'usage de l'outil.

**Deux portes, et j'ai gardé les deux.** Ajouter quelqu'un est la porte
évidente. **Promouvoir un salarié en commercial** est celle par laquelle on
franchirait le plafond sans s'en apercevoir : personne ne s'ajoute, un rôle
change. Elle est fermée aussi.

### 3. Rien ne se ferme aujourd'hui

Sans abonnement, **aucun plafond ne s'applique et aucun écran ne disparaît**.
Un plafond est la conséquence d'une formule choisie, pas un état par défaut :
couper l'application de ceux qui s'en servent déjà, le jour où l'offre naît,
serait la pire façon de la lancer.

### 4. Aucun état « essai », et c'est délibéré

La durée de l'essai gratuit est l'une des seize cases `[À COMPLÉTER]` de vos
conditions générales. L'écrire dans le code aurait fait décider par une machine
d'un engagement qui vous engage. La base **refuse** la valeur tant que la
décision n'est pas prise — un refus franc plutôt qu'un chiffre qui dort.

---

## Ce que j'ai refusé, et ce que cela aurait coûté

**Le cloisonnement des fonctions par formule.** Votre planche annonce « les
absences de vos équipes » et « les retours d'intervention » comme un plus
d'« Entreprise ». Je ne l'ai **pas** appliqué.

Le poser en silence aurait retiré à un artisan abonné « Artisan » des écrans
dont il se sert déjà aujourd'hui — sans qu'il comprenne pourquoi, et sans que
personne le lui ait annoncé. C'est une décision commerciale, pas une décision
de code.

**La question est pour vous :** voulez-vous vraiment fermer les absences et les
retours d'intervention à un abonné « Artisan » ? Tant que vous n'avez pas
répondu, la carte promet un peu **moins** que ce que l'application donne — dans
votre sens, jamais l'inverse.

---

## Ce qui a été vérifié, et ce qui ne l'a pas été

**C'est le paragraphe le plus important de ce document.**

| Vérifié ici | Comment |
|---|---|
| Les prix du code sont ceux de votre planche | 22 contrôles, dont un qui compare les deux fichiers |
| La signature du crochet de paiement | 16 contrefaçons, toutes refusées |
| L'isolation entre entreprises | 15 contrôles en base, sous le rôle réel |
| Un même paiement ne compte pas deux fois | idem |
| Le plafond, ses deux portes, et les salariés qui n'y entrent pas | idem |
| Ce qu'Atlas envoie à Stripe, paramètre par paramètre | 31 contrôles contre un faux Stripe monté en local |
| L'écran, dans ses trois états | captures regardées, à la largeur de votre téléphone |

**CE QUI N'A PAS PU ÊTRE VÉRIFIÉ, ET QUI NE DOIT PAS ÊTRE PRÉSENTÉ COMME
ACQUIS : aucun compte Stripe n'existe encore.** Les suites vérifient ce
qu'Atlas *envoie* ; que Stripe *accepte* ces paramètres se verra au premier
essai avec une vraie clé de test. Tant que ce n'est pas fait, l'écran dit
lui-même que le paiement n'est pas branché, et aucun bouton ne promet ce qu'il
ne peut pas tenir.

**Un défaut trouvé par la capture, et par aucun test :** trois cents pixels de
vide sous la dernière carte — deux retraits qui s'additionnaient. Corrigé.

**Et deux rouges qui n'étaient pas les miens, réparés en passant.** Deux
contrôles rougissaient **sur votre machine seulement**, jamais sur le serveur :
ils cherchaient des fins de ligne Unix dans des fichiers Windows. Ils
accusaient donc du code parfaitement sain. C'est la deuxième fois que ce dépôt
paie exactement cette faute — je l'ai corrigée aux deux endroits, et écrit
pourquoi dans le code pour qu'on ne la recommence pas une troisième fois.

---

## Ce qu'il vous reste à faire

### 1. Créer le compte Stripe, et poser trois lignes

    ATLAS_PAIEMENT_CLE=sk_test_…            Stripe › Développeurs › Clés d'API
    ATLAS_PAIEMENT_SECRET_CROCHET=whsec_…   Stripe › Développeurs › Webhooks
    ATLAS_URL_PUBLIQUE=https://…            l'adresse de votre Atlas

Le crochet à déclarer chez Stripe : **votre adresse + `/api/paiement`**, et les
événements `customer.subscription.*` et `invoice.*`.

Commencez avec une clé de **test** (`sk_test_`) et la carte `4242 4242 4242
4242` : rien n'est débité, et tout le parcours se joue en vrai.

### 2. Trancher le cloisonnement par formule

Voir plus haut. Une phrase suffit.

### 3. La durée de l'essai gratuit

Sept jours ? Quatorze ? Trente ? Le chiffre entre alors dans les conditions
générales et dans le code, du même coup.

### 4. Les seize `[À COMPLÉTER]` de vos conditions générales

Votre raison sociale, votre siège, votre SIRET, l'hébergeur. Elles s'affichent
telles quelles à qui lit le document — c'est voulu : les cacher ferait accepter
un contrat qui a l'air fini alors qu'il ne l'est pas.

---

## Ce que ça vous coûtera, quand ça tournera

| Formule | Ce que Stripe prend | Il vous reste |
|---|---|---|
| Artisan 29 € | 0,89 € | 28,11 € |
| Entreprise 59 € | 1,55 € | 57,45 € |
| Illimité 120 € | 2,89 € | 117,11 € |

*1,5 % + 0,25 € par carte européenne, plus 0,7 % de frais d'abonnement. En
prélèvement SEPA, c'est moins : environ 0,78 € sur 29 €. Ces taux se vérifient
sur leur page de tarifs le jour où vous signez — ils bougent.*
