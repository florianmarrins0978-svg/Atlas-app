# On REGARDE l'écran avant d'affirmer quoi que ce soit dessus

Chargé dans **toutes** les sessions Atlas (importé par `CLAUDE.md`).

---

## La règle

**Aucune affirmation sur un écran de l'application sans l'avoir OUVERT.** Ni sur
ce qu'il montre, ni sur ce qu'il ne montre plus, ni sur l'endroit où se trouve
un bouton.

```bash
npm run voir -- /planning            # l'image ET le texte de l'écran
npm run voir -- /reglages --large    # l'écran entier, défilement compris
```

Le serveur doit tourner (`npm run dev`). La commande se connecte, franchit
l'acceptation des documents, attend que l'écran soit posé, rend le texte et
écrit l'image dans `/tmp/atlas-vu`.

## Pourquoi elle existe

**Sa colère du 14 septembre 2026 :** *« ça arrive trop souvent que tu me donnes
une info fausse parce que t'es pas vraiment allé regarder les écrans de
l'appli ! »*

Le jour même, on lui avait annoncé que **la porte du devis avait disparu de son
planning**. Elle était là. Le `grep` cherchait `data-atlas="porte-devis"` en
toutes lettres ; le repère se compose — `` data-atlas={`porte-${porte.cle}`} ``.
Une recherche vide avait été prise pour une absence.

## Ce qu'un `grep` ne prouve JAMAIS

| Ce qu'on croit avoir montré | Ce que ça montre vraiment |
|---|---|
| « ce repère n'existe plus » | **rien** : il peut se composer, ou vivre dans une constante |
| « ce composant n'est plus monté » | **rien** : il peut être monté par un parent, sous un autre nom |
| « ce texte n'est pas à l'écran » | **rien** : il peut venir d'une traduction, d'une donnée, d'une règle pure |
| « l'écran affiche X » | **rien** : ce qui est écrit dans le code n'est pas ce qui est PEINT |

Un `grep` sert à trouver **où chercher**. Il ne conclut pas.

## La racine, et elle n'était pas la paresse

Ce dépôt porte **quatre-vingts scripts `capture-*.mts`**, un par écran, écrits
au coup par coup. Regarder un écran demandait donc d'en écrire un
quatre-vingt-unième — soixante lignes, un navigateur, une connexion. Grep coûte
cinq secondes.

**C'est cet écart qui fabriquait les affirmations fausses**, pas la bonne
volonté. `npm run voir` l'a ramené à une ligne : il n'y a plus d'excuse, et l'on
n'écrit plus de script de capture pour REGARDER. *(Les `capture-*` existants
restent : ils MESURENT — une largeur, un débordement, un ordre — et vivent dans
la batterie. C'est un autre métier.)*

## Quand l'écran ne peut pas être ouvert ici

Le plan d'arrosage demande une photo et une clé de vision ; certains écrans
dépendent de données qu'on n'a pas. On le dit alors comme tel :

> « pas vérifiable ICI ; à regarder sur ton espace »

**jamais** une affirmation présentée comme un constat. C'est la même règle que
`CLAUDE.md` §1 ter, et elle vaut dans les deux sens : ne pas déclarer impossible
ce qu'on n'a pas cherché, ne pas déclarer absent ce qu'on n'a pas regardé.

## Et ce qui tient la règle

`scripts/rappel-regarder-l-ecran.mjs`, branché sur chaque message
(`.claude/settings.json`) : dès qu'il demande où est quelque chose, ou affirme
qu'un écran a changé, la commande revient sous les yeux de la session — quelle
qu'elle soit, et même trois heures après son début.
