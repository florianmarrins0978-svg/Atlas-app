# Lire au soleil — premier morceau

**6 septembre 2026.** Vous avez dit oui à la planche
`https://florianmarrins0978-svg.github.io/Atlas-app/lire-au-soleil.html`.
Voici ce qui est codé, et ce qui ne l'est pas encore.

---

## Ce qui change, et où

**Deux choses, et elles n'ont pas la même portée.** C'est le point important de
ce document.

| Ce qui change | Où ça s'applique |
|---|---|
| **la TAILLE** — 9,5 → 11 px pour les intertitres, 11,5 → 13 px pour les lignes de situation | **partout dans l'application**, d'un seul coup : c'est un jeton, il n'existe qu'à un endroit |
| **la COULEUR** — le gris cède la place à l'encre douce pour ce qui doit se lire | **les Réglages seulement**, 82 emplois |

**Pourquoi pas la couleur partout tout de suite.** La taille est une valeur
unique : la changer une fois la change bien. La couleur, elle, se décide emploi
par emploi — le gris reste juste pour ce qui n'a pas à être lu, un exemple dans
un champ vide, un réglage éteint, une rubrique « bientôt ». Cinq cent
vingt-cinq emplois passés en revue d'un coup seraient invérifiables, et
croiseraient le travail de vos autres sessions. **C'est ce que je vous avais
dit : écran par écran.**

---

## Ce que ça donne, mesuré

Relevé au navigateur, à 390 × 664, avant et après :

| Écran | Avant | Après | Coût |
|---|---|---|---|
| le sommaire des réglages | 1 145 px | 1 152 px | **+0,6 %** |
| Mon entreprise | 2 145 px | 2 199 px | **+2,5 %** |
| Devis & factures | 4 117 px | 4 350 px | **+5,7 %** |
| l'accueil | 664 px | 664 px | **0** |

**C'est exactement ce que la planche annonçait** — entre 0 et 6 %. La prévision
avait été faite en surchargeant les tailles dans le navigateur ; la mesure après
codage la confirme au dixième près.

---

## Ce que je n'ai pas touché

- **Votre palette.** Le gris est le vôtre, relevé sur le site d'Arborea. Il n'a
  pas bougé d'un chiffre, et il ne bougera pas. Ce qui change, c'est **où** on
  l'emploie.
- **Le texte principal.** Titres, noms de rubrique, montants : déjà à la bonne
  taille.
- **Les trois choses du lot 3** — le découpage de « Devis & factures », les deux
  façons d'enregistrer, l'aperçu collé. Vous avez dit de ne pas y toucher.
- **Le gris là où il a raison d'être.** Sur le sommaire, le nom d'une rubrique
  « bientôt » reste gris : elle n'est pas encore là, et le dire est son rôle.
  Sur l'écran des Réglages, les deux phrases qui n'existent que sur votre banc
  d'essai — la branche suivie, la version lente — restent grises aussi : elles
  ne sont pas pour vous, elles sont pour la machine.

---

## Les chiffres de la batterie

`npm run verifier:avant-livraison`, jouée en entier sur votre poste.

| Étape | Résultat |
|---|---|
| Types, lint, construction, mémoire | **verts** — 0 erreur |
| Suites base de données | **306 / 314** — une de mieux qu'au lot précédent |
| Suites navigateur | **116 / 130** |
| Connexion derrière un proxy | **n'a toujours pas mesuré** — la panne d'outillage Windows |

**Les deux suites qui pouvaient m'accuser sont vertes**, et ce sont exactement
celles qu'un texte plus gros ferait tomber : `test-aucun-texte-coupe-e2e` (rien
n'est coupé sur aucun écran) et `test-aucune-barre-de-defilement-e2e` (aucune
zone ne déborde). `test-chartes-lisibles` est verte aussi : la charte n'a pas
bougé.

**Deux rouges neufs par rapport à hier — et j'ai vérifié plutôt que supposé.**
`test-dictee-invite-e2e` et `test-devis-doublon-e2e` sont apparus dans la
batterie. **Je les ai rejoués seuls, sur ce même code : les deux passent au
vert.** Ce sont des suites qui se gênent entre elles quand la batterie les
enchaîne — c'est consigné dans `TODO.md` depuis le 26 août, et
`test-devis-doublon-e2e` y est nommément listé depuis le 29.

C'est la première fois que je peux vous le dire avec une preuve plutôt qu'avec
une intuition : hier j'écrivais « ils ne citent pas mes écrans », ce qui est
plus faible.

**Les huit rouges en base** sont les rouges de machine habituels, un de moins
qu'hier.

---

## Ce qui reste de « lire au soleil »

**La couleur, hors des Réglages** : l'accueil, le planning, les terminés, le
devis, la facture, la fiche client, le pôle Paysage. Chacun est un petit
passage, à faire quand on touche l'écran — jamais un balayage aveugle.

Le compte à ce jour : **525** emplois du gris dans l'application, **82** repris.
