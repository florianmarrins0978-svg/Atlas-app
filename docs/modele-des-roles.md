# Le modèle des utilisateurs et des rôles d'Atlas

*30 août 2026. Lot joué avant le déploiement, donc avant le premier artisan
réel.*

---

## A. Le modèle obtenu

Quatre rôles. **Chaque personne a son compte, son mot de passe, sa session et
son rôle** ; plusieurs personnes peuvent porter le même rôle. Il n'existe aucun
compte partagé « Facturation », et il ne faut pas en créer.

| Fonction | Patron | Facturation | Commercial | Salarié |
|---|---|---|---|---|
| Clients | oui | oui | oui | non |
| Chantiers | oui | oui | oui | non — sa carte au planning |
| Devis : rédiger, chiffrer | oui | oui | oui | non |
| Devis : envoyer au client | oui | oui | oui | non |
| Voir un montant | oui | oui | oui | **non** |
| Factures : créer, émettre, envoyer | oui | oui | **NON** | non |
| Relevé de TVA, paiements, achats | oui | oui | **NON** | non |
| Terminer un chantier | oui | oui | **NON** *(voir C)* | non |
| Planning : consulter | oui | oui | oui | oui |
| Planning : écrire, supprimer | oui | **non** | oui | **NON** |
| Feuille de chantier sans prix | oui | oui | oui | oui |
| Tarifs et grilles de prix | oui | non | non | non |
| Outils Paysage | oui | non | oui | non |
| Assistant IA | oui | non | non | non |
| Identité, IBAN, abonnement | oui | non | non | non |
| Gestion des accès et des rôles | oui | non | non | non |
| Ses propres réglages (mot de passe, notifications) | oui | oui | oui | oui |

**Il n'y a pas de ligne « Prospects ».** Le brief en demandait une : cet objet
n'existe nulle part dans Atlas — ni table, ni écran, ni action. On ne l'a pas
inventé pour remplir une case.

---

## B. L'architecture

**Où le rôle est stocké.** Dans `membres_entreprise`, une ligne par
(personne, entreprise). Sa clé unique porte sur **(entreprise, personne)** —
jamais sur (entreprise, rôle) : plusieurs personnes portent donc le même rôle
sans que rien n'ait eu à changer. Une contrainte `CHECK` en base tient les
quatre valeurs (migration 0071) ; le défaut d'une ligne sans rôle explicite
reste `salarie`, le plus fermé.

**Où le rôle N'EST PAS.** Il n'est pas dans le jeton Auth.js, pas dans le
cookie, pas dans une donnée transmise par le navigateur. `autorisation.ts` le
relit **à chaque requête** depuis la base, sous `withEntreprise` — et le
`cache()` de React qui évite d'y aller trois fois par écran meurt avec la
requête.

**Ce qui se passe quand le patron change un rôle pendant qu'on est connecté :**
la requête suivante applique le nouveau rôle. Rien à invalider, aucune session à
couper, et la coupure globale de M11 n'a pas été touchée.

**Comment les capacités sont calculées.** Cinq fonctions pures dans
`src/lib/acces-roles.ts` : `peutVoirLesMontants`, `peutGererDevis`,
`peutFacturer`, `peutModifierLePlanning`, `peutUtiliserLAssistant`. Plus
`cheminAutorise`, qui dit quelles adresses un rôle ouvre. **Une règle, un
endroit** — les écrans et les gardes appellent les mêmes fonctions.

**Comment les gardes les appliquent.** Une Server Action s'exécute **avant** tout
rendu : la garde de mise en page ne la voit pas. Chaque action ouvre donc sur une
garde de `src/server/garde-action.ts`, qui garde sur **ce que l'action fait**,
jamais sur l'écran d'où elle semble venir :

| La garde | Ce qu'elle demande |
|---|---|
| `exigerMontants` | avez-vous le droit de VOIR un prix ? |
| `exigerGestionDevis` | …d'en poser un sur un devis, et de l'envoyer ? |
| `exigerFacturation` | …de facturer ? |
| `exigerEcritureSurLePlanning` | …d'écrire au planning ? |
| `exigerEcran` | …d'ouvrir l'écran dont cette action relève ? |
| `exigerProprietaire` | …d'administrer l'entreprise ? |

Un contrôle relève **tout fichier « use server » du dépôt** et refuse qu'une
action neuve n'en porte aucune (`test-actions-gardees-db.ts`).

### La décision de forme qui compte le plus

Les capacités s'écrivaient `role !== "salarie"`. Elles nomment désormais qui les
a :

    // avant — un rôle neuf naît AVEC le droit
    return role !== "salarie";

    // après — un rôle neuf naît SANS aucun droit
    return role === "proprietaire" || role === "facturation";

Ce n'est pas du style. **Sous l'ancienne forme, le rôle « facturation » créé ce
jour-là serait né avec le droit d'émettre des factures et de supprimer des
chantiers**, sans qu'une ligne change et sans qu'un test rougisse. Un contrôle
lit maintenant la source et refuse toute règle écrite par la négative — c'est lui
qui a fait remonter le cas du planning, le jour même.

---

## C. Le rôle Facturation

**Il peut :** consulter et créer les clients, les corriger ; rédiger, chiffrer,
modifier, finaliser et envoyer un devis ; créer, modifier, émettre et envoyer une
facture ; tenir le relevé de TVA, les paiements, les achats et les tickets ;
terminer un chantier ; **consulter** le planning ; changer son propre mot de
passe et ses notifications.

**Il ne peut pas :** gérer les utilisateurs ni les rôles ; toucher l'identité de
l'entreprise, son IBAN, son abonnement ou l'export de ses données ; administrer
les tarifs et les grilles de prix ; ouvrir la mise en page des devis ; ouvrir les
outils Paysage ni l'assistant IA ; **écrire au planning**.

**Sur l'IBAN, le point où le brief demandait qu'on s'arrête :** rien dans le
produit n'exige que la facturation modifie les coordonnées bancaires. L'IBAN vit
dans `/reglages/identite`, il est protégé par une preuve d'authentification
récente (M11), et il n'entre dans aucune action de facturation — la facture le
lit, elle ne l'écrit pas. **Aucun droit ne lui a donc été ouvert dessus**, et
aucune décision n'est nécessaire.

**Sur les prix, la distinction demandée** — et elle existait déjà dans le dépôt :

| | Qui |
|---|---|
| **utiliser** un prix (le lire sur un devis, un total) | patron, facturation, commercial |
| **poser** un prix sur un devis | patron, facturation, commercial |
| **administrer la grille tarifaire** de l'entreprise | patron seul |
| consulter une marge interne | patron seul (l'assistant, `/reglages/prix`) |

La facturation n'a donc **pas** été ouverte aux écrans de réglage des prix parce
qu'un devis contient des montants. C'était le piège que le brief signalait.

**Le planning en lecture, et pourquoi c'est le minimum :** elle a besoin de la
date d'un chantier avant de facturer. L'écran s'ouvre, l'écriture est refusée —
c'est le même partage que celui posé pour le salarié la veille, et il n'est écrit
qu'une fois.

---

## D. Le commercial

> **Le commercial peut gérer les clients nécessaires à son travail, rédiger,
> modifier et envoyer les devis, et modifier le planning — y compris supprimer un
> chantier selon les règles existantes d'Atlas. Il ne peut pas gérer la
> facturation.**

Son droit d'écrire au planning a été **confirmé** par le patron le 30 août au
matin, et non simplement laissé en place ; la nuance est écrite dans le code pour
qu'un prochain lot de sécurité ne le resserre pas « par prudence ».

**Ce qu'il perd, et c'est le seul retrait du lot.** Il ne clôture plus un
chantier. « Créer la facture » n'est pas un changement d'état : `terminerChantier`
**crée la facture**, et refuse même de le faire tant que le devis n'est pas parti.
C'est l'entrée du cycle comptable. La conséquence est honnête, elle se paie, et
elle est écrite ici plutôt que découverte par un utilisateur.

Si vous voulez qu'un commercial puisse marquer un chantier comme fait **sans**
que la facture naisse, il faut séparer le geste en deux. C'est un travail de
produit, il n'était pas demandé, et il est noté dans `TODO.md`.

---

## E. Le salarié

> **Le salarié conserve son planning en lecture seule. Aucun droit d'écriture ne
> lui a été rouvert.**

Rien n'a été réimplémenté. La garde du 30 août au matin
(`exigerEcritureSurLePlanning`) est intacte, sa suite aussi, et sa portée — tout
le planning, ou les seuls chantiers de son équipe — n'a pas bougé. Il garde sa
feuille de chantier sans un seul montant.

Un compte à rebours a même joué en notre faveur : sa suite portait un contrôle
`ROLES.length === 3`, posé exprès pour forcer une relecture le jour où un rôle
naîtrait. Il a rougi, et c'est ce qui a fait rouvrir `peutModifierLePlanning`.

---

## F. La sécurité : les contournements réellement essayés

| Ce qui a été tenté | Résultat |
|---|---|
| **Rejouer une requête de facturation avec le cookie d'un commercial** — en-tête `Next-Action` et corps interceptés au vol sur la vraie requête du patron | **refusé** ; rien n'entre en base |
| La même requête rejouée par la **facturation** | acceptée — on n'a pas cassé le rôle |
| Le commercial tape `/termines/tva` à la main | renvoyé ; l'onglet a aussi disparu de sa barre |
| Le commercial ouvre `/api/factures/<id>/pdf` | refusé par `cheminAutorise` |
| Le commercial ouvre `/planning`, `/clients`, ses devis | **ouverts** — on ne l'a pas amputé |
| La facturation tape `/paysage`, `/reglages/identite`, `/reglages/tarifs`, `/reglages/equipe` | renvoyée ; ses propres réglages restent à elle |
| Envoyer un rôle inventé depuis le formulaire (`admin`, `PROPRIETAIRE`, `patron`, vide, `proprietaire ` avec espace) | refusé — `role-inconnu`, et le rôle en base n'a pas bougé |
| Un patron de A change le rôle d'un accès de **l'entreprise B** dont il connaît l'identifiant | refusé ; rien n'a bougé chez B |
| Un patron de A retire un accès de B | refusé |
| Le **dernier patron** se rétrograde en facturation, commercial ou salarié | refusé — `dernier-patron` |
| Le dernier patron se retire lui-même | refusé |
| À **deux** patrons, rétrograder l'un des deux | accepté — l'entreprise garde un administrateur |

### Les faux verts : ce qui a été cassé exprès pour voir rouge

| La protection retirée | Ce qui a rougi |
|---|---|
| `facturation` retirée de `peutFacturer` | 3 contrôles — dont « le patron et la facturation passent » |
| la facturation **donnée** au commercial | 3 contrôles — dont « le commercial est refusé » |
| l'écriture du planning **donnée** au salarié | 3 contrôles — dont « aucune capacité en liste noire » |
| `exigerProprietaire` retirée du changement de rôle | « chaque action serveur porte une garde » |
| le changement de rôle ouvert aux accès d'une autre entreprise | « un identifiant d'une autre entreprise ne se touche pas » |
| l'ancienne promesse « Les factures et le relevé de TVA » remise à l'écran du commercial | « l'écran ne promet pas ce que la règle refuse » |

Le code sain a été rétabli à chaque fois, et **vérifié à l'octet près**.

### Deux choses qui cachaient le défaut, et qui sont corrigées

1. **L'écran des accès PROMETTAIT le contraire de la règle.** Il annonçait au
   patron que le commercial pouvait faire « Les factures et le relevé de TVA ».
   Le contrôle qui surveille ces promesses ne regardait pas les mots : il
   vérifiait que les listes n'étaient pas vides. Il compare désormais chaque
   promesse à la capacité, **des deux côtés** — promettre ce qu'on refuse, et
   taire une restriction réelle.
2. **Une suite DÉFENDAIT le défaut.** `test-acces-roles.ts` exigeait que la TVA
   soit ouverte au commercial, au nom de « l'entièreté de l'application »
   (23 août), sans voir que la table du 13 août disait le contraire dans le même
   document. Une suite qui réclame ce que la règle interdit est pire qu'une
   absence de suite : elle rassure celui qui vient vérifier.

---

## G. La batterie

`npm run verifier:avant-livraison`, jouée en entier sur l'arbre du lot.

| Étape | Résultat |
|---|---|
| TypeScript | **0 erreur** |
| lint | **0 erreur** (16 avertissements, tous antérieurs) |
| mémoire du dépôt | cohérente, 8 fichiers vérifiés |
| suites base | **287 / 287** — dont les 22 du modèle des rôles |
| suites navigateur | **119 / 119** — dont les 6 de la requête forgée |
| connexion derrière une origine étrangère | **réussie**, dans un vrai navigateur |
| **verdict** | **✅ Batterie complète au vert — 0 échec** |

Les 287 suites base comptaient 286 avant le lot : une seule est née
(`test-roles-capacites-db.ts`). Les 119 navigateur en comptaient 118 : une seule
également (`test-roles-facturation-e2e.ts`).

**Aucun test n'a été désactivé ni assoupli.** Trois contrôles ont été
*adaptés*, et dans le sens du durcissement : deux exigeaient que la TVA soit
ouverte au commercial — c'est-à-dire l'inverse de la règle du patron — et le
troisième a été rendu plus sévère, pas moins.

---

## H. Les décisions restantes

**Aucune décision de rôle restante.**

Deux choses sont seulement à savoir, et aucune n'appelle un arbitrage :

- **un commercial ne clôture plus un chantier** (voir D). Le séparer en deux
  gestes est un travail de produit, pas de sécurité ;
- **les tarifs restent fermés au commercial en LECTURE**, faute d'un écran en
  lecture seule — la note existait déjà dans `TODO.md`, et ce lot ne l'a pas
  élargie. La facturation n'y a pas accès non plus.
