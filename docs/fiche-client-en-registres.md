# La fiche client, refaite — ce qui a changé et ce qui n'a pas bougé

*2 septembre 2026. À lire en cinq minutes ; tout le détail technique est dans
`ARCHITECTURE.md` §213.*

---

## Ce que vous avez demandé, et ce que j'ai fait

| Votre demande | Fait ? | Où |
|---|---|---|
| « Code exactement ce que tu viens de me faire comme maquette » | **oui** | toute la fiche client |
| « Je veux garder le *client* en doré » | **oui** | il est doré, et il n'y a plus que deux choses dorées sur l'écran |
| « Mets-le au-dessus du nom comme tu avais fait » | **oui** | uniquement sur cet écran ; ailleurs il reste sous le titre, comme vous l'aviez demandé le 26 août |
| « Remets le style pour supprimer le client que tu avais fait juste avant » | **oui** | la ligne discrète en capitales |
| « Garde la petite fenêtre avec le message de prévention » | **oui**, et refaite | filets au lieu du pavé teinté |
| « Quand on clique sur le n° 2026-0031, on arrive sur le PDF ? » | **non, et c'est vous qui l'avez voulu** | voir plus bas |

---

## Votre question sur le PDF

Non : un appui ouvre **Enregistrer · Ouvrir · Partager**.

C'est votre choix du 21 août, devant la planche 83 — proposition C. La raison
était la vôtre : venir relire un montant ne doit pas vous télécharger un fichier
à chaque coup d'œil. Rien n'a changé de ce côté, et la maquette le montre.

Sur l'onglet **Fiches**, « Enregistrer » n'apparaît pas : une fiche d'entretien
est une page web, pas un fichier. Le proposer ferait descendre un `.pdf` que
rien n'ouvrirait — le défaut du 7 août, à l'envers.

---

## Ce que j'ai fait autrement que vous ne l'aviez demandé

Deux points, et je préfère les écrire noir sur blanc.

### 1. Vos trois colonnes sont devenues trois onglets

Le 20 août vous aviez demandé les catégories **côte à côte**. Sur votre
téléphone, 390 px de large, cela fait 118 px par colonne — dont environ **79 px
de texte**. « n° 2026-0031 » n'y tient pas.

Le dépôt portait déjà deux rustines pour gagner quelques pixels : la vignette
montée au-dessus du numéro, et les marges réduites à 16 px. On soignait le
symptôme.

**Ce qui est gardé :** vos trois catégories, votre ordre (Devis · Facture ·
Fiche chantier), votre tri du plus récent au plus ancien, et les mots exacts
d'un registre vide.

**Ce que ça coûte :** vous ne voyez plus les trois catégories d'un seul coup
d'œil. Si vous préférez les revoir ensemble, dites-le — je refais avec les
colonnes, en sachant que les numéros se couperont.

### 2. Le noir gras a changé de ligne

Le 20 août : *« en titre noir gras, dernière prestation avec ce qu'elle
comprend »*. Le code prenait la phrase au pied de la lettre — **l'étiquette** en
noir gras, et **son contenu** en gris en dessous.

C'est l'inverse de ce que vous venez lire. « Dernière prestation » est un mot de
rangement ; ce que vous cherchez, c'est *taille de haies, évacuation des déchets
verts*. Les deux ont donc échangé : l'étiquette passe en petites capitales
grises, le contenu en serif, encre pleine.

Si vous préférez l'ancien partage, c'est une ligne à remettre.

---

## Ce que j'ai retiré, et pourquoi

**La pastille rouge « PDF ».** C'était la seule tache d'alerte de l'écran, posée
sur un document qui n'alerte rien — la même couleur qui, partout ailleurs dans
Atlas, veut dire *refus*. L'onglet dit déjà de quelle sorte de pièce il s'agit.

**La capsule rouge « Supprimer ce client », pleine largeur.** C'était le seul
objet dessiné de l'écran, et il désignait la seule chose irréparable qu'on
puisse y faire : elle appelait l'œil vers la sortie. Devenue une ligne en
capitales, elle reste parfaitement lisible et cesse d'appeler. **La zone qu'on
touche fait toujours 44 px** — c'est le mot qui a rétréci, pas la cible.

**Le pavé teinté de la fenêtre de suppression.** Un aplat de couleur au milieu
d'une feuille de suppression se lit comme un encart d'information, alors qu'il
porte la seule bonne nouvelle de l'écran : ce qui est gardé. Deux filets et un
intertitre doré séparent aussi bien.

**Rien de ce que vous aviez décidé le 27 août n'a bougé** : ce que la loi
conserve s'affiche avec son numéro, ce qui sera détruit est dit, et la case
« J'ai sauvegardé ces documents ailleurs » reste ce qui déverrouille
« Supprimer ».

---

## Ce que j'ai trouvé en chemin, et que personne n'avait vu

**`npm run verifier:avant-livraison` ne pouvait pas tourner sous Windows.**

La batterie lançait ses étapes d'une façon que Windows ne comprend pas. Résultat :
elle affichait **ses neuf étapes en échec, en une seconde**, y compris celles qui
passent quand on les joue à la main. Un verdict faux, complet et instantané —
c'est-à-dire le pire, parce qu'on le croit.

Corrigé : une ligne, sans effet sur Linux ni sur l'intégration continue. La
batterie tourne maintenant sur cette machine, et c'est elle qui donne les
chiffres ci-dessous.

---

## Les chiffres de la batterie

**Ce qui a été joué sur cette machine, et ce qui n'a pas pu l'être.**

| Étape | Verdict |
|---|---|
| Types | ✅ |
| Lint | ✅ 0 erreur |
| Construction (`next build`) | ✅ |
| Mémoire du dépôt | ✅ |
| Fournisseurs d'IA | ✅ |
| Suites base de données | **278 sur 288** — les 10 tombées sont détaillées plus bas |
| Suites navigateur | ❌ **ne démarrent pas sous Windows** |
| Connexion derrière un proxy | ❌ **ne démarre pas sous Windows** |

**Les suites de CET écran, jouées une par une, serveur démarré à la main :**

| Suite | Verdict |
|---|---|
| `test-fiche-client-e2e` (17 contrôles) | ✅ **0 échec** |
| `test-enregistrer-piece-e2e` | ✅ 5 réussis |
| `test-retour-fiche-client-e2e` | ✅ |
| `test-assistant-en-tete-e2e` | ✅ |
| `test-accueil-en-tete` (l'en-tête partagé) | ✅ |
| `test-fiche-client`, `test-fiche-client-db`, `test-liste-clients` | ✅ |
| `test-aucune-fleche`, `test-boutons-arrondis`, `test-chartes-lisibles` | ✅ |

**Deux défauts trouvés par ces suites, et corrigés — les deux étaient de moi :**

1. **J'avais mis les dates en capitales.** « 12 AOÛT 2026 » s'épelle au lieu de
   se lire, et cela cassait votre règle d'une seule façon d'écrire une date.
   Les dates sont repassées en bas de casse — c'est exactement l'argument que
   j'avais utilisé pour votre adresse.
2. **Les onglets faisaient 24 px de haut.** On les rate au doigt. Ils font
   maintenant 44 px, sans que le mot ait bougé.

**Un troisième défaut, trouvé en REGARDANT la capture** (aucun test ne le
voyait) : à l'ouverture de la fiche, « Supprimer ce client » tombe juste sous la
barre du bas. Il se découvre en faisant défiler de quelques centimètres.
**C'était déjà le cas avant ce lot** — le bouton a toujours été le dernier
élément de la page. Je ne l'ai pas changé, parce que le corriger voudrait dire
retirer de l'air à l'écran, c'est-à-dire défaire ce que vous venez de retenir.
Dites-le si vous voulez qu'il soit visible sans défiler.

**Les 10 suites tombées, et pourquoi ce n'est pas ce lot.** Je les ai rejouées
sur le dépôt SANS mes changements : **les dix tombent aussi**. Ce sont des
incompatibilités Windows qui préexistaient — chemins écrits avec des `\` au lieu
de `/`, et des contrôles qui surveillent des processus à la manière de Linux :

`test-actions-gardees-db`, `test-mise-a-jour-role-db`, `test-reglages-gardes`,
`test-roles-capacites-db`, `test-salarie-planning-lecture-seule-db`,
`test-seed-conserve-identifiants`, `test-ouvrir-port`,
`test-relance-construction`, `test-verrou-construction`,
`test-fiche-pendant-relance`.

**Aucune ne touche la fiche client.** Elles passent en intégration continue, qui
tourne sous Linux — c'est pour cela que personne ne les avait vues.

**Ce que je n'ai PAS corrigé, et que vous devez savoir :** les suites navigateur
et le contrôle de connexion ne démarrent toujours pas sous Windows, pour la même
raison que la batterie (trois scripts de plus à toucher). Je les ai contournés
en démarrant le serveur moi-même ; c'est ce qui a permis de jouer les suites de
cet écran. À trancher séparément.

---

## Ce qui reste ouvert, et qui peut le trancher

| Point | Qui tranche |
|---|---|
| Voir les trois catégories ensemble plutôt qu'une à la fois | **vous** |
| Rendre le noir gras à l'étiquette plutôt qu'à son contenu | **vous** |
| Étendre l'allure « ample » (nom à 40 px, surtitre doré au-dessus) à d'autres écrans | **vous**, écran par écran |
