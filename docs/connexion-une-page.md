# La page Connexion tient dans un écran — ce qui a été fait

*31 août 2026 · branche `claude/connexion-single-page-layout-etkzrh`*

**Sa demande, capture à l'appui :** *« Pour la page connexion je veux qu'elle
tienne sur une seule page et supprime toutes les petites phrases en gris sous
les boutons, garde que les titres. »*

---

## Le verdict, en deux lignes

| | |
|---|---|
| avant | **1203 px** pour un écran qui en montre **664** — presque deux écrans, « Ailleurs » vivait sous le pli |
| après | **658 px** — tout d'un seul tenant, rien à faire défiler |

Mesuré sur **son** écran : 390 × 664, un iPhone barre d'adresse déduite. C'est
la mesure du dépôt depuis le 30 août, pas un chiffre choisi pour l'occasion.

---

## Ce qui a été retiré, un par un

| La phrase grise | Où elle était | État |
|---|---|---|
| « Vous resterez connecté sur cet appareil. » | sous « Changer mon mot de passe » | retirée |
| « Aucun appareil enregistré. Sur chaque appareil séparément. Votre visage ne quitte jamais votre téléphone… » | sous « Enregistrer cet appareil » | retirée |
| « Votre mot de passe reste actif et ne peut pas se retirer… » | même endroit | retirée |
| « Sur tous les téléphones et ordinateurs, y compris celui-ci » | sous « Me déconnecter partout » | retirée |
| « Un téléphone perdu, un ordinateur prêté : ce qu'on veut… » | tout en bas de l'écran | retirée |
| « Au moins 12 caractères. » | sous le champ du nouveau mot de passe | **déplacée** — voir plus bas |

**Ce qui reste :** les titres (`CHANGER DE MOT DE PASSE`, `OUVRIR AVEC FACE ID`,
`AILLEURS`), les trois champs avec leur œil, et les trois gestes.

---

## Ce qui a été GARDÉ, et pourquoi

Deux phrases restent, et aucune n'est sous un bouton :

| | |
|---|---|
| « Vous devrez vous reconnecter sur tous vos appareils, celui-ci compris. » | c'est **la question** posée avant de fermer, pas une explication. La retirer laisserait deux boutons sans savoir à quoi on répond |
| « Vos appareils enregistrés pourront rouvrir Atlas avec Face ID… » | elle n'apparaît qu'au moment de confirmer, et **seulement s'il a un appareil enregistré**. C'est le seul endroit où l'on apprend que « me déconnecter partout » ne ferme pas cette porte-là — et on y arrive un soir de téléphone perdu |

*Si tu veux qu'elles partent aussi, dis-le : c'est deux lignes.*

---

## Les 545 px repris, et d'où ils viennent

Retirer les phrases n'y suffisait pas : elles pèsent 271 px sur les 545. Le
reste était ailleurs, et le plus gros morceau était un défaut.

| | |
|---|---|
| **248 px** | les phrases grises hors des champs : Face ID (96), « Un téléphone perdu… » (84), la ligne sous « Me déconnecter partout » (43), « Vous resterez connecté… » (25) |
| **120 px** | **les trois champs.** L'œil fait 44 px — la taille qu'il faut pour ne pas le rater avec des gants — et il imposait ces 44 px à sa rangée. Il les garde comme cible, il ne les impose plus comme hauteur : **60 px**. Plus « Au moins 12 caractères » (23) et leurs marges (37) |
| **96 px** | **la barre du bas était réservée DEUX FOIS.** Le gabarit de l'application la réserve déjà pour tous les écrans ; cet écran-ci la réservait une seconde fois, en plus large. Du vide qui ne portait rien et qui poussait « Ailleurs » sous le pli |
| **81 px** | les écarts entre rubriques et autour des boutons, de 30 px à 12

---

## Ce qui a été fait AUTREMENT que demandé, et pourquoi

### « Au moins 12 caractères » : retirée de l'écran, mais pas supprimée

C'était bien une petite phrase grise sous un champ. Elle est partie de l'écran
au repos — mais **la retirer purement et simplement aurait cassé quelque
chose** : on tape huit caractères, la ligne de confirmation répond « les deux
sont identiques ✓ », le bouton reste éteint, et **plus rien à l'écran ne dit
pourquoi**. Un bouton éteint sans raison lisible, c'est une application qu'on
croit cassée.

Elle se dit donc désormais **au moment où elle mord** : rien tant que le champ
est vide, la phrase dès que la saisie est trop courte. Au repos, l'écran est
nu comme il l'a demandé.

### La promesse de Face ID : retirée pour de bon, et il faut le savoir

Les quatre lignes disaient que c'est par appareil, que le visage ne quitte
jamais le téléphone, et que le mot de passe reste actif.

**Les faits n'ont pas changé** — Atlas ne reçoit jamais d'image de visage,
seulement une preuve, et rien de biométrique n'entre dans la base. C'est la base
elle-même que le contrôle interroge, pas une phrase.

**Ce qui a disparu, c'est la promesse écrite.** Quelqu'un qui hésite à donner
son visage n'a plus rien à l'écran pour se rassurer. Elle survit dans le mode
d'emploi d'Atlas, et c'est tout.

*C'est le seul point du lot qui coûte quelque chose. S'il la veut, elle se remet
— mais ailleurs, pas en gris sous le bouton.*

---

## Ce qui a été corrigé dans les contrôles, plutôt que dans l'écran

Une suite **exigeait** la promesse de Face ID à l'écran. Elle serait devenue
rouge sur du code juste, pour une demande exaucée. Elle a été **retournée** :
elle vérifie maintenant que cette glose **ne revient pas**.

C'est la règle du dépôt : quand une suite rougit après un retrait demandé, on
adapte la suite — on ne remet pas le libellé. Écrire l'inverse rendrait son
écran impossible à changer.

Et un contrôle neuf mesure l'écran à 390 × 664 : rien à faire défiler, et le
dernier geste jamais recouvert par les onglets. Il refuse de conclure sur une
page qui n'est pas mise en page — sans quoi « 0 ≤ 664 » rendrait un vert qui ne
mesure rien.

---

## Ce que la mesure ne couvre pas

Un appareil **déjà enregistré** ajoute sa ligne à la rubrique Face ID, soit
56 px. Sur un écran de 664 px l'écran défile alors de ce qu'il faut ; sur son
téléphone, dont la hauteur utile est de l'ordre de 770 px, il tient toujours.

---

## Ce qui reste ouvert, et qui peut le trancher

| | Qui |
|---|---|
| la promesse de Face ID est-elle remise ailleurs, ou pas du tout ? | **lui** |

---

*Le détail technique, et ce qui a été écarté : `ARCHITECTURE.md` §216.*
