# La feuille « Envoyer à … » — ce que j'ai trouvé, et ce qui est fait

**Sa demande du 4 septembre 2026.** Une passe complète sur la feuille qui monte
du bas quand on appuie sur « Choisir la date » : hiérarchie, densité, rythme
vertical, tailles de touche, contraste, lisibilité au soleil — **dans tous ses
états**, chartes sombres comprises.

**Sa réponse, le même jour : « 1 à 7 fais-les, et le 8 je choisis la B ».**
Les sept points sont codés, et la durée se replie. La planche reste en ligne :
elle montre l'avant et l'après, et elle se touche.

> **https://florianmarrins0978-svg.github.io/Atlas-app/la-feuille-qui-envoie.html**

---

## CE QUI A ÉTÉ DIT ET QUI ÉTAIT FAUX

**Le défaut du canal touchait CINQ chartes, pas deux.** Le premier document
annonçait « Nuit et Sylve ». Le contrôle écrit ensuite les compte lui-même, et
il en trouve **cinq** : `rust` et `ink` valent exactement la même couleur sur
**pierre, beurre, moka, sylve et nuit**. Sur ces cinq-là, les deux capsules
étaient rigoureusement identiques — même fond à 1,04-1,29 de contraste, **et la
même couleur de texte**. Le défaut était donc plus large que ce que j'ai écrit,
et c'est la mesure qui l'a dit, pas la relecture.

**Deux choses ont été faites autrement que la planche ne le montrait**, et les
deux sont expliquées à leur point : la phrase du devis vide est gardée mot pour
mot (point 2), et le bouton d'envoi a été réparé par son libellé plutôt que par
un artifice de largeur — après avoir essayé l'artifice et l'avoir jeté
(point 5).

---

## Comment j'ai regardé

`scripts/voir-envoi-au-client.mts` photographie la feuille dans **onze états**, à
**390 × 664** — son écran, barre d'adresse déduite —, pour la charte qu'on lui
donne. Il pose son propre décor : une journée à demi prise, une journée complète,
un client sans coordonnée, un devis sans ligne.

```bash
npx tsx scripts/voir-envoi-au-client.mts /tmp/vues            # sa charte
npx tsx scripts/voir-envoi-au-client.mts /tmp/vues nuit       # la sombre
```

Trois choses valent d'être notées, parce qu'elles ne se déduisent d'aucun
document du dépôt :

- **le décor demande un rôle qui traverse la RLS.** `atlas_app` ET `atlas_owner`
  sont refusés — les tables portent `FORCE ROW LEVEL SECURITY`, et l'insertion
  d'un chantier voisin rend « new row violates row-level security policy », qui
  accuse la requête alors que seul le rôle est en cause ;
- **la charte est le goût de la PERSONNE, pas un réglage d'entreprise**
  (`schema.ts`, migration 0047) : elle se pose sur `users.charte` ;
- **une série de captures finit par déclencher la limite de connexion.** Le
  garde-fou fait son travail ; le symptôme, lui, est trompeur — la connexion
  répond 200 et la page ne bouge plus. Les deux clés Redis se vident à la main.

Les contrastes ne sont pas estimés à l'œil : ils sont recalculés depuis
`src/lib/chartes.ts` sur les huit chartes.

---

## Les sept points, et ce qui a été fait

### 1 — On ne voyait pas quel canal était choisi

**Verdict : défaut réel, le plus grave du lot. Réparé.**

Quand le client n'a ni numéro ni e-mail, la feuille propose deux capsules « Par
SMS » / « Par e-mail ». Elles étaient **redessinées à la main** dans
`EnvoiAuClient.tsx`, alors que la maison a `ChoixCanal` depuis le 22 août — la
pièce du nouveau chantier et de la facture.

La copie ne marquait l'actif que par **la couleur du texte** — `rust` contre
`ink` — et son fond par `rustTint` contre `card` :

| | `rust` vs `ink` | écart entre les deux fonds |
|---|---|---|
| origine, brume, prune | différents | 1,15 à 1,27 |
| **pierre, beurre, moka, sylve, nuit** | **identiques** | 1,04 à 1,29 |

Sur **cinq chartes sur huit**, les deux capsules étaient donc indiscernables :
rien dans la page ne disait par où le devis allait partir.

**Ce qu'aucune suite ne pouvait attraper.** Trois d'entre elles vérifient que
« Par SMS » et « Par e-mail » sont présents et cliquables — ce qui était vrai.
Aucune ne demandait qu'on puisse **distinguer** lequel est pris ; la question ne
se pose pas tant qu'on regarde une seule charte.

**Fait :** l'écran emploie `ChoixCanal`. Sa marque d'actif est un **liseré d'or**,
qui ne dépend d'aucune clarté et tient donc sur les huit chartes. Ce n'est pas
qu'un correctif de couleur — c'est un doublon en moins (`CLAUDE.md` §3).

### 2 — Le devis vide était un cul-de-sac

**Verdict : défaut réel, fonctionnel. Réparé.**

Le garde-fou du 23 août fait son travail : un devis sans ligne ne part pas. Mais
l'écran disait *« Posez d'abord vos prix sur ce chantier »* et **n'offrait aucune
porte** — un bouton éteint, « Annuler ». Il fallait refermer, sortir du devis,
retrouver l'écran des prix.

C'est **exactement** le cul-de-sac qu'il a fait fermer le 11 août pour la
coordonnée manquante. Le raisonnement d'alors visait `devis_absent` — *« il ne se
produit pas depuis ce chemin »* — et il est juste pour celui-là. Il ne l'était pas
pour `devis_vide`, qui s'atteint en **trois gestes** depuis le chemin ordinaire :
créer un chantier, « Écrire le devis », « Choisir la date ».

**Fait :** un bouton « Poser mes prix » mène aux prix de ce chantier. Le contrôle
vérifie l'adresse ET l'ouvre pour de bon — un lien juste qui ne mène nulle part
serait le même défaut dans l'autre sens.

**FAIT AUTREMENT QUE SUR LA PLANCHE.** La planche montrait la phrase raccourcie ;
elle est gardée **mot pour mot**. Elle vient de `MOTIF_DEVIS_VIDE`, celle-là même
que le serveur oppose au refus : en écrire une version courte pour l'écran
donnerait deux rédactions du même refus, qui divergeraient au premier ajustement.
La phrase nomme le geste ; le bouton le fait.

### 3 — Le refus était écrit dans la couleur de l'action

**Verdict : défaut réel. Réparé.**

Le correctif du 3 septembre marche : le bouton ne s'éteint plus faute de date, et
la phrase « Proposez au moins une date d'intervention » s'affiche enfin. Mais elle
était posée en `colors.rust` — **l'accent de ce qu'on FAIT**. Sur les cinq chartes
du tableau ci-dessus, cet accent *est* l'encre du texte courant : le refus
devenait un paragraphe ordinaire. Et quarante pixels plus haut, dans la même
feuille, l'avertissement du jour complet est en bordeaux — **deux couleurs pour
« attention » dans un seul écran**.

**Fait :** `colors.alert`. Ce n'est pas une lecture de commentaire, c'est l'usage
mesuré du dépôt — sur les blocs portant `role="alert"` dans `src/`, **36 emploient
`alert` et 5 `rust`**, et cette feuille était de la seconde catégorie. Le jeton
porte en plus sa correction de clarté sur les deux chartes sombres.

### 4 — Le gris qui porte le sens passait sous le seuil

**Verdict : défaut réel. Réparé SUR CETTE FEUILLE seulement — la cause est plus
large, et elle lui revient.**

`colors.muted` portait ici « Préparation… », « X jours ouvrés d'affilée seront
réservés », « Reste 1 équipe sur 2 », le sous-titre de l'interrupteur et
« Annuler ». Autrement dit **tout ce que l'écran lui apprend et qu'il ne peut pas
deviner**.

| | `muted` sur le fond de page |
|---|---|
| moka | **2,85** |
| pierre | 3,01 |
| beurre | 3,07 |
| origine | 3,32 |
| prune | 3,48 |
| brume | 3,59 |
| nuit | 5,19 |
| sylve | 5,80 |

Six chartes sur huit sous 4,5 — lu debout, en plein soleil.

**Fait :** ces phrases-là passent à `inkSoft` (6,6 à 10,4 partout), et l'exemple
du champ de coordonnée a rejoint la règle CSS posée le 3 septembre pour la
recherche de client, plutôt que d'en écrire une seconde. `muted` reste sur ce qui
n'est qu'un repère — la légende du calendrier, les intitulés de rubrique.

**REFUSÉ :** changer le jeton lui-même. Il vit dans trois cents endroits ; le
toucher serait un changement d'identité, pas un correctif d'écran. **C'est à
lui de le décider**, et c'est noté dans `TODO.md`.

### 5 — Le bouton rétrécissait à l'envoi

**Verdict : défaut réel. Réparé, mais pas comme annoncé.**

« Envoyer le devis » fait **246 px** ; « Envoi… » en faisait **118**. La capsule
tient à son texte, c'est tout son dessin : au moment précis du geste
irréversible, le bouton perdait la moitié de sa largeur en même temps qu'il
passait au gris. Cela se lit « ça a raté », pas « ça part ».

**FAIT AUTREMENT, et la première version a été jetée après l'avoir essayée.**
J'avais annoncé une largeur réservée par un libellé en creux posé sous le vrai.
Codé, puis joué : le texte se retrouvait **deux fois dans la page**, et
`text=Envoyer le devis` — qu'emploient trois suites — ne désignait plus un
élément mais deux. Un correctif d'apparence qui casse les contrôles du geste
coûte plus qu'il ne rapporte.

Le libellé d'attente est devenu **« Envoi du devis… »**, qui fait la même largeur
à huit pixels près et n'ajoute rien à la page. Le coupable n'était pas le bouton,
c'était le mot.

### 6 — « Envoyer le devis » n'était jamais à l'écran

**Verdict : défaut réel, mesuré. Réparé.**

| état | hauteur de la feuille | écran |
|---|---|---|
| préparation | 305 px | 584 px |
| une journée ordinaire | **864 px** | 584 px |
| une journée chargée | **1 349 px** | 584 px |

En arrivant il voyait le titre, la durée, deux tiers du calendrier ; le bouton
d'envoi était un écran et demi plus bas. Et pendant « Préparation… » il était
visible — puis **descendait de six cents pixels d'un coup** quand le planning
arrivait : le pouce tombait sur le calendrier.

**Fait :** le pied de la feuille — l'erreur, « Envoyer le devis », « Annuler » —
reste en bas, le contenu défile au-dessus. Un seul changement pour les deux
défauts, sans toucher au calendrier, ni à la fiche du jour, ni à une règle.
**L'erreur voyage avec le bouton** : posée au-dessus du pied, elle défilait hors
de l'écran pendant que le bouton restait, et un refus qu'on ne lit plus n'a pas
refusé.

**Un détail trouvé à la capture, et pas au raisonnement :** `bottom: 0` colle la
boîte de MARGE au bas de la zone qui défile. Avec la marge négative qui avale le
retrait de la feuille, le pied s'arrêtait **36 px trop haut** et l'on voyait la
liste des dates passer dessous. Le décalage est désormais mesuré, et le contrôle
le mesure aussi.

### 7 — Deux redites dans la fiche du jour

**Verdict : réel, et petit. Fait.**

- Une **pastille verte pleine contenant un tiret**, deux fois par chantier, dès
  qu'aucune équipe n'est posée — ce qui est le cas ordinaire d'un chantier créé
  puis daté. Elle dit désormais « équipe non posée », en texte.
- « Ce jour est proposé à votre client. » était **collée au mot « proposé »** qui
  dit exactement cela. La ligne dit maintenant ce qu'elle sait : ce qui reste —
  avec la fonction du planning, jamais une seconde rédaction.

**Le dessin validé le 22 août ne bouge pas.**

### 8 — La durée se replie (sa réponse : la B)

Elle prenait 96 px tout en haut, avant le calendrier, alors qu'elle est déjà
juste neuf fois sur dix. Repliée, elle tient en une ligne : la valeur, et
« changer ». Une fois ouverte elle le reste — la refermer sous son doigt après
qu'il a corrigé serait lui reprendre ce qu'il vient de régler.

**Ce qui reste visible même repliée :** la valeur, et la phrase du chantier long.
Celle-là parle du CHANTIER, pas de la molette.

---

## Ce que je n'ai pas touché

- **Le calendrier reste celui du planning** — même composant (`MoisCharge`),
  même calcul de charge (`useOccupation`).
- **Le serveur garde le dernier mot** : l'aller-retour de `verifierJourPropose`
  est intact.
- **Deux dates au maximum**, et l'interrupteur reste ouvert par défaut.
- **Les trois phrases retirées le 26 août ne sont pas revenues.**
- **Les repères `data-atlas`** sont conservés ; deux s'ajoutent
  (`aller-aux-prix`, `pied-envoi`), aucun ne disparaît.
- **`PrimaryButton` n'a pas bougé d'un pixel.**

## Ce que je refuse

**Sortir la durée de la feuille, ou la passer après le calendrier.** C'est elle
qui décide quels jours sont proposables : après, elle arriverait trop tard.
Repliée, elle reste au même endroit et dit la même chose en une ligne.

## Ce qui reste ouvert, et qui peut le trancher

| | qui |
|---|---|
| `colors.muted` sous 4,5 sur six chartes, **dans toute l'application** | **lui** — changement d'identité, pas correctif d'écran |
| Le bouton principal **éteint**, écrit en `muted` sur `line` : illisible sur les dix-sept écrans qui emploient `PrimaryButton` | **lui** — pièce partagée |
| `docs/maquettes/index.html` porte un bloc `<span class="quoi">` **orphelin** après la planche 91, vestige d'une fusion | à corriger, hors de ce lot |

---

## Le contrôle, et ce qu'il a attrapé

`scripts/test-feuille-envoi-lisible-e2e.ts` tient les trois points qui comptent :

1. la capsule active porte une marque que **la couleur du texte ne fait pas** —
   et il commence par compter les chartes où `rust` et `ink` se confondent, pour
   que le jour où ce piège disparaîtrait, ce soit lui qui le dise ;
2. le devis vide offre une porte, et **elle mène bien aux prix de ce chantier** ;
3. le pied touche le bas de la feuille — et il **refuse de conclure** si la
   feuille tient dans l'écran, parce qu'un zéro n'est pas un succès.

**Il a été vu rouge**, contre la version d'avant :

```
✗ un devis vide offre la porte des prix, au lieu d'un bouton éteint et muet
  aucune porte : le refus dit d'aller poser ses prix, et il faut refermer la
  feuille, sortir du devis et retrouver l'écran des prix pour le faire
✗ le pied de la feuille reste au bas de l'écran
  le pied s'arrête à 36 px du bas de la feuille : le contenu se voit passer
  dessous, et « Envoyer le devis » n'est plus au ras du pouce
```

`scripts/verifier-maquette-feuille-qui-envoie.mts` garde la planche honnête : il
recalcule ses couleurs et ses chiffres depuis `chartes.ts`. À sa première
exécution il a attrapé **une erreur dans ma propre planche** — elle annonçait
« 2,85 à 3,86 », or 3,86 est la mesure du gris sur la plage et non sur le fond de
page. La fourchette juste est **2,85 à 3,59**.

## Les chiffres de la batterie

`npm run verifier:avant-livraison`, joué sur `atlas_test` :

| étape | résultat |
|---|---|
| Types | **vert** |
| Lint | **vert** — 0 erreur, 16 avertissements, tous antérieurs |
| Mémoire du dépôt | **vert** |
| Suites base | **295 / 306** |
| Suites navigateur | **118 / 126** |
| Connexion derrière un proxy | **vert** |

**Les rouges ont été mesurés, pas supposés.** Mon lot a été mis de côté
(`git stash`) et les huit suites navigateur rouges rejouées sur l'arbre nu :

```
0/8 suites réussies.
```

**Les mêmes huit, avant comme après.** Aucune ne vient de ce lot. Côté base, une
session voisine avait déjà consigné les onze rouges le même jour (commit
`b15a65d4`) : huit d'infrastructure, plus `test-mode-emploi` et
`test-boutons-arrondis`, qui viennent de la planche « A — Épurée ».

**Les six suites qui gardent cet écran sont vertes**, la nouvelle comprise :

| | |
|---|---|
| `test-choisir-la-date-e2e` | 7 / 7 |
| `test-envoi-client-e2e` | 11 / 11 |
| `test-envoi-contact-sur-place-e2e` | 0 échec |
| `test-dates-envoi` | 9 / 9 |
| `test-feuille-envoi-lisible-e2e` *(neuve)* | 0 échec |
| `test-deux-dates-calendrier-e2e`, `test-date-lointaine-e2e` | rouges **avant comme après** — voir ci-dessous |

### Pourquoi huit suites navigateur sont rouges sur ce poste, et pas en CI

**Ce n'est pas le produit.** Les suites lisent une date de chantier ainsi :

```js
rows[0].jour.toISOString().slice(0, 10)
```

Or le pilote PostgreSQL rend une colonne `date` comme un `Date` JavaScript à
**minuit LOCAL**. Sur ce poste, réglé à UTC+2, `toISOString()` recule d'une
journée. La preuve tient en trois lignes :

```
en base : 2026-09-07
rendu JS : Mon Sep 07 2026 00:00:00
toISOString().slice(0,10) : 2026-09-06
décalage du poste : 2 h
```

**La base garde la bonne date ; c'est la suite qui la relit de travers.** En CI,
où la machine est à UTC, le décalage est nul et tout passe.

**Ce n'est pas de ce lot, et je ne l'ai pas corrigé** — huit suites de domaines
qui ne sont pas le mien, pendant que d'autres sessions travaillent. Mais c'est
**un faux rouge qui cache les vrais** : tant qu'il est là, personne ne distingue
une vraie régression du bruit. C'est écrit dans `TODO.md` et dans `HANDOVER.md`,
avec la preuve, pour que la prochaine session ne cherche pas une demi-heure dans
son propre travail.
