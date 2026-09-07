# La porte en plein air — ce qui a été fait, et ce qui vous attend

**8 septembre 2026.** Votre demande, avec une capture de l'application Hinge :

> « J'aimerais quelque chose dans cet esprit, une belle photo libre de droit
> bien sûr en rapport avec la nature. La phrase pour accepter les conditions
> d'utilisation. Ensuite si on clique sur créer un compte il faut que tu me
> fasses une maquette pour cela qu'on réfléchisse ensemble et que je te valide.
> Et si on clique sur se connecter on arrive sur la proposition B de la planche
> comme-ta-capture. »

**Rien n'est codé.** `src/app/login/` n'a pas bougé d'une ligne.

**L'adresse à ouvrir :**
https://florianmarrins0978-svg.github.io/Atlas-app/la-porte-en-plein-air.html

---

## 1. Un verdict par point

| Ce que vous avez demandé | Fait | Où |
|---|---|---|
| Une porte dans l'esprit de votre capture | **oui** | photo bord à bord, marque au centre, gros bouton clair, « Se connecter » en texte dessous |
| Une belle photo **libre de droit**, nature | **oui** | `appli/images/porte-foret.jpg` — voir §2 |
| La phrase pour accepter les conditions | **oui** | juste au-dessus des boutons, ses deux liens soulignés |
| « Créer un compte » ouvre une maquette à valider | **oui, et deux** | voir §3 — le choix est à vous |
| « Se connecter » mène à la proposition B | **oui** | recopiée au caractère près depuis `porte-comme-ta-capture.html` |

---

## 2. La photo, et pourquoi on peut la garder

| | |
|---|---|
| **Licence** | **CC0 1.0** — domaine public |
| **Ce que ça permet** | usage commercial, modification, aucune mention obligatoire |
| **Auteur** | Midhun P |
| **Source** | WordPress Photo Directory — https://wordpress.org/photos/photo/5476968b3f/ |
| **Trouvée par** | l'API Openverse, filtre `license=cc0` |
| **Poids** | 196 Ko (840 × 1120), redimensionnée depuis l'originale |

La licence a été vérifiée à la source, pas supposée. L'auteur est écrit en tête
du fichier de la planche alors que CC0 ne l'exige pas : c'est ce qui permettra
de refaire le chemin dans six mois.

**Elle se change en une ligne** si elle ne vous plaît pas.

---

## 3. Créer un compte : les deux propositions

C'est le vrai objet de ce lot, et **le choix est le vôtre**.

### Proposition 1 — tout sur un écran

Quatre champs, un bouton, terminé.

- **Ce qu'elle a pour elle :** rapide pour quelqu'un d'à l'aise, un seul appui.
- **Ce qu'elle coûte :** quatre cases vides d'un coup. Pour quelqu'un qui n'est
  pas à l'aise avec un téléphone, c'est le moment où il repose l'appareil.

### Proposition 2 — une question à la fois

Le même compte, posé en quatre temps, avec une barre qui montre où on en est.

- **Ce qu'elle a pour elle :** une seule chose à comprendre par écran, un retour
  à chaque étape, impossible de se perdre.
- **Ce qu'elle coûte :** quatre appuis au lieu d'un.

### Ce qu'on défend, et pourquoi

**La proposition 2.** Votre consigne du 5 septembre — *« imagine que la plupart
des patrons qui vont utiliser l'app sont des vieux qui ont du mal à se servir de
leur téléphone »* — est la contrainte la plus forte du produit, et elle prime
sur le fait de gagner trois appuis. Un formulaire de quatre cases vides est
exactement l'écran devant lequel on abandonne.

**Mais c'est votre appel.** Les deux sont sur la planche, à toucher.

### Quatre renseignements, et pas un de plus

Nom · e-mail · mot de passe · nom de l'entreprise.

Le SIRET, l'adresse, la TVA, l'IBAN et les tarifs **existent déjà dans les
réglages** et s'y remplissent au moment où ils servent. Tout demander à la porte
perdrait celui qui essaie l'application un soir, avant même d'avoir vu à quoi
elle ressemble.

---

## 4. Ce qui a été décidé tout seul, et se défait d'un mot

| Décision | Pourquoi |
|---|---|
| La porte **vouvoie** | votre capture tutoie, mais toute l'application vouvoie — une porte qui tutoie devant un produit qui vouvoie se remarque tout de suite |
| **Pas de troisième lien « cookies »** | votre capture en a trois ; Atlas n'a pas de régie publicitaire. À rouvrir le jour où il y en a une |
| La photo est **fixe** | la porte serait le seul écran qui ne suit pas la charte choisie dans les réglages |
| Aucune flèche décorative | votre règle du 25 août. Le « ‹ » du retour en est une vraie : il montre un sens |

---

## 5. Ce qui est SIMULÉ, et qu'il ne faut pas croire acquis

- **Google et Apple ne mènent nulle part.** Cette entrée-là n'existe pas dans
  l'application aujourd'hui. Ce qui est fidèle, c'est la place et la taille.
- **Les deux pages légales n'existent pas** — voir §6.
- **« Ouvrir avec Face ID », en revanche, existe pour de bon** depuis le 24 août
  (`src/app/login/LigneFaceId.tsx`), et garde sa place sur la connexion.

---

## 6. Ce qui reste ouvert, et qui peut le trancher

| Point | Qui |
|---|---|
| **Proposition 1 ou 2** pour la création de compte | **vous** |
| **L'accroche** sous ATLAS — trois choix sur la planche, ou aucune | **vous** |
| **Une phrase, ou une case à cocher** pour les conditions | **vous** — la case se prouve mieux en cas de litige, mais c'est un geste de plus |
| La photo reste-t-elle fixe malgré les huit chartes | **vous** |
| « Créer un compte » crée un **patron et son entreprise** — un salarié reçoit son accès de son patron dans les réglages. À confirmer | **vous** |

### Bloquant, et ce n'est pas du code

**Les pages « Conditions d'utilisation » et « Politique de confidentialité »
n'existent pas dans le dépôt.** La porte les lie ; les liens ne mènent nulle
part, exprès — rien ne se fabrique pour faire joli.

Aucune mise en ligne publique n'est possible sans elles, et ce n'est pas un
travail qui s'écrit en codant. **Qui les rédige ?**

---

## 7. Les chiffres, et ce qu'ils valent

| Contrôle | Résultat |
|---|---|
| `appli` · **la nouvelle suite** (`test:porte-plein-air`) | **37 vert, 0 rouge** |
| `appli` · la suite de la planche du 30 août (`test:porte-capture`) | **vert**, non touchée |
| `appli` · la batterie des maquettes (`test:e2e`) | **107 vert, 0 rouge** |
| Les quatre écrans **regardés**, à 390 px de large | rien de coupé, rien hors cadre |

**Ce qui n'a pas été joué, et pourquoi.** La grande batterie de l'application
(`npm run verifier:avant-livraison`) n'a pas été lancée : ce lot ne touche que
`appli/`, `.github/workflows/pages.yml` et la documentation — aucun fichier de
`src/`, aucune migration. Elle prend dix minutes et occupe la base et le port
3000, que vos autres sessions partagent (votre consigne du 4 septembre).

**Ce que la nouvelle suite garde, et qu'aucun test de hauteur n'aurait vu :**

1. **La photo a de vrais pixels.** Une image qui ne charge pas laisse un écran
   *noir* avec du texte blanc dessus — donc lisible, donc invisible à toute
   mesure de débordement. La suite exige `naturalWidth`, pas une balise.
2. **Les deux boutons mènent à deux endroits différents.** Une porte dont
   « Créer un compte » et « Se connecter » ouvriraient le même écran passerait
   toutes les mesures sans qu'on s'en aperçoive.
3. **Tout tient dans le cadre**, sur les quatre écrans. Une porte est le seul
   écran qu'on ne peut pas faire défiler avant d'être entré.

Et `pages.yml` interroge en plus `images/porte-foret.jpg` **sur le site
publié**, comme il le fait déjà pour le PDF de l'anthracnose : une image absente
de l'artefact ne se verrait pas autrement.

---

## 8. Un défaut trouvé au passage, sans rapport avec la demande

Dans `appli/essais.html`, l'entrée « La porte d'Atlas » n'était pas refermée —
un `</a>` manquant, 113 ancres ouvertes pour 112 fermées. Le navigateur
refermait tout seul, donc rien ne se voyait à l'œil ; le lien suivant s'en
trouvait avalé dans la même zone cliquable. Corrigé.
