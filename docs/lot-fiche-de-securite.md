# La fiche de sécurité — codée

*Lot ouvert le 21 septembre 2026 au soir, sur votre « tu peux coder exactement
tout ce qu'on vient de voir ensemble », CLOS le 22 au matin. La planche est
`appli/fiche-de-securite.html` ; elle a été codée mot pour mot.*

*Sa page consultable vit dans `appli/` :
`node scripts/md-en-page.mjs docs/lot-fiche-de-securite.md appli/lot-fiche-de-securite.html`.*

---

## Ce qui a été fait, en huit lignes

1. **Sur la fiche du jour, un bandeau « Fiche de sécurité »**, au-dessus de
   « Travaux à faire », sur tous les chantiers. Fermé, il dit « à remplir »,
   « 3 sur 6 », « signée », « transmise ». Rien d'imposé.
2. **À la première ouverture, « Ce que demande la loi »** : sept lignes, deux
   liens (le décret sur Légifrance, le formulaire de la MSA), et la phrase que
   vous avez demandée : ce que vous cochez et écrivez est repris sur la fiche
   suivante, vérifiez chaque case à chaque chantier.
3. **Six écrans, les mots de votre feuille** (MSA 12350_A_10/2023), dans son
   ordre. Les points de vigilance (la main rouge) se lisent, ne se cochent pas.
   « Ajouter » au bout de chaque liste ; les mots soulignés de la feuille
   ouvrent les sites officiels ; « Électrique » et les distances ont leurs
   sous-cases sous leur case ; l'heure en roue ; la photo par l'appareil ou la
   photothèque ; le GPS relevé sur place.
4. **Rien n'est coché par l'application.** Ce qu'Atlas sait est posé (chantier,
   devis, adresse, dates, équipe, téléphone, votre nom) ; tout le reste vient
   de vous, ou de votre fiche d'avant.
5. **Ce qui est vide se dit avant de signer**, et vous signez quand même :
   c'est votre fiche. **Signature au doigt**, nom et date. « Modifier » une
   fiche signée efface la signature : on re-signe.
6. **Le PDF** reprend la feuille entière, cases cochées et non cochées, la
   signature, et la note « La fiche d'intervention est : » au bas.
   « Transmettre le PDF » ouvre la feuille de partage du téléphone avec le
   fichier ; « Enregistrer » le met dans vos fichiers.
7. **Dans Paysage, « Fiches de sécurité »** : les fiches signées du mois,
   rangées par client, le mois en tête et la roue du téléphone pour en
   changer. Chacune dit jusqu'à quand elle est gardée : deux ans.
8. **En base, avec le chantier** (migration 0099), jamais purgée ; les photos
   qu'une fiche montre ne partent pas en purge. Trois suites la tiennent.

---

## 1. Vos décisions, une par une

| Vous avez dit | Ce qui est fait | Où |
|---|---|---|
| « faut pas l'appeler fiche d'élagage » | « Fiche de sécurité », partout | `fiche-securite.ts` |
| « avec des salariés — et des fois je travaille seul » | le nombre de travailleurs vient des équipes du planning ; seul, c'est 1 | `contexteDuChantier` |
| « le donneur d'ordre, pas toujours le client » | « Le client du devis » ou « Quelqu'un d'autre » (nom, prénom, téléphone) | écran 1 |
| « au bon vouloir, en arrivant sur le chantier » | le bandeau sur la fiche du jour, jamais imposé | `FicheDeSecurite.tsx` |
| « disponible partout, sur tous les chantiers » | tous les chantiers du planning | `PlanningClient.tsx` |
| « au doigt, à chaque fiche » | la toile de signature, le PNG dans la fiche | `Signature.tsx` |
| « oui, un bouton pour l'envoyer » | « Transmettre le PDF », feuille de partage avec le fichier | `transmettre-le-pdf.ts` |
| « plus de 20 par an » | ce qu'Atlas sait est posé ; ce qui est coché revient | `appliquerLaMemoire` |
| « garde Fiche de sécurité » (le décret dit « fiche d'intervention ») | gardé | — |
| « mot pour mot, seuls les titres et les explications changent » | `LIBELLES`, relus sur la feuille rendue en image | `fiche-securite.ts`, `test-fiche-securite.ts` |
| « co-activité, manuel d'utilisation, bulletins : c'est pas des cases » | des titres et des points de vigilance | `POINTS_DE_VIGILANCE` |
| « les liens là où ils ont mis les soulignés » | le mot souligné est le lien, dans la case | `SOULIGNES` |
| « une catégorie dans Paysage » | la ligne « Fiches de sécurité » dans Paysage | `paysage/page.tsx` |
| « pas un bouton 2026, un calendrier ; tout ça par défaut » | le mois en tête, la roue du téléphone | `ListeDesFiches.tsx` |
| « faut avoir la possibilité de l'enregistrer » | « Enregistrer le PDF » | `?telecharger=1` |
| « la main d'œuvre : la B, et le préciser » | un texte, gardé, et l'écran le dit | écran 1 |
| « tout ce qui se coche reste enregistré pour les suivantes ? » | oui, les cases aussi, et l'écran de la loi le dit | `MemoireDesFiches` |
| « plus de tirets, des phrases » ; « explique chaque chose » | une phrase sous chaque titre | `Bloc` |
| « supprime les Atlas » | aucun « Atlas » à l'écran | — |

## 2. Ce qui a été décidé sans vous, et pourquoi

- **La fiche vit sous `/planning`, pas sous `/paysage`.** Paysage est fermé aux
  salariés ; or la loi veut que la fiche leur soit *« présentée »* et soit
  *« disponible sur le chantier »*. Le formulaire et son PDF s'ouvrent donc à
  tous ceux qui voient le planning ; la liste, elle, est dans Paysage comme
  vous l'avez dit. Le lien « Voir où elle est gardée » n'apparaît qu'à ceux
  qui peuvent ouvrir Paysage.
- **Un PDF à part, pas le moteur du devis.** Le moteur commun dessine des
  pièces qu'on paie (lignes, totaux, TVA) ; la fiche est quatre pages de cases
  et une signature dessinée. Elle a son propre moteur, avec les mêmes teintes
  et la même marge.
- **Ce qui n'est pas repris d'une fiche à l'autre** : ce qui est propre au
  chantier — le donneur d'ordre, le lieu, les heures, la photo, le point de
  rencontre. Tout le reste l'est.
- **Deux fautes de la feuille ne sont pas recopiées** : « essoussage »,
  « sauvatage ».
- **Le formulaire de découverte fortuite** renvoie au guichet unique des
  réseaux, pas à un numéro de cerfa : je n'en ai pas trouvé de sûr.

## 3. Ce que ça défait, et qui était juste avant

Rien. La fiche du jour garde tout ce qu'elle avait ; le bandeau s'ajoute
au-dessus de « Travaux à faire ». `supprimerPhoto` regarde désormais aussi si
une fiche montre la photo avant de la mettre en purge — le même geste que pour
les retours.

## 4. La fenêtre à connaître

Votre espace applique les migrations à l'allumage : la 0099 crée trois tables
vides, rien à transiter. Tant qu'il n'a pas redémarré, le bandeau du planning
répondrait « relation fiches_securite does not exist » : **redémarre ton
espace** après la fusion.

## 5. Les chiffres

Batterie entière jouée dans la nuit du 22 septembre 2026, dans le dossier du
lot (atelier 4), sur le code tel que poussé :

| Étape | Résultat |
|---|---|
| Types, lint, mémoire du dépôt, construction | verts |
| Suites base | 397 vertes sur 405, 8 non mesurables sur ce PC (outillage Windows) |
| Suites navigateur | 160 vertes sur 165, 1 non mesurable, 4 rouges |
| Connexion derrière un proxy | verte |

Les quatre rouges, rejoués seuls puis sur la base de `main` sans ce lot
(`verifier-rouge-prealable`) : `papier-facture` vert seul (un appui lu avant le
rendu, en charge) ; `devis-client`, `ligne-du-client`, `recherche-client`
rouges de la même façon des deux côtés — ils ne viennent pas de ce lot, et
sont connus sur ce PC. Aucune régression nouvelle.

Après la fusion de `main` (le refus de retirer un chantier facturé, la
planche de la fiche 4), la rencontre a été rejouée : types, lint, atelier,
398 suites base sur 406, la coupure des sessions, les écrans. Même sort.

Les trois suites du lot — `test-fiche-securite`, `test-fiche-securite-db`,
`test-fiche-securite-e2e` — sont vertes, en batterie et seules.

## 6. Ce qui reste ouvert

- **Le formulaire de découverte fortuite** : si vous connaissez le cerfa, il
  se pose en une ligne (`DECOUVERTE_FORTUITE`).
- **Le nombre de travailleurs** part du nombre d'équipes posées sur le chantier
  au planning, pas du nombre de personnes : les équipes n'ont pas de liste de
  personnes en base. Vous le corrigez d'un appui.

---

## 7. Ce que vous avez relevé le 22 septembre, et ce qui a été fait

Trois remarques depuis votre iPhone, plus une question. Un verdict par point.

### La question : les liens qui sortent de l'application

*« Une fois l'appli hébergée, comment je retourne sur l'appli ? Et est-ce que
les liens fonctionneront ? »*

**Les liens fonctionnent, et ils ne dépendent pas de l'hébergement.** Les cinq
adresses sont publiques et extérieures : le décret sur Légifrance, le
formulaire MSA, la découverte fortuite de réseau chez l'Ineris, le formulaire
de service-public, jebalise. Votre capture du formulaire MSA le prouve déjà.
Elles n'ont pas pu être interrogées depuis le poste de travail : son réseau
refuse ces domaines.

**Pour revenir**, les boutons portent déjà `target="_blank"`. Une fois
l'application sur votre écran d'accueil, iOS 16.4 et au-dessus ouvre le lien
dans une fenêtre posée par-dessus, avec « OK » en haut à gauche ; un appui et
vous retombez sur votre fiche au même endroit. Sur un iOS plus ancien, ça
bascule vers Safari et le retour se fait par le sélecteur d'applications.
**À confirmer sur votre téléphone** : c'est votre version d'iOS qui décide.

Ce qui a été trouvé en cherchant, et que personne n'avait demandé : la fiche
n'était enregistrée qu'au « Suivant ». Sortir vers un de ces liens en plein
remplissage pouvait donc coûter l'étape en cours. C'est le point suivant.

### 1. La saisie s'enregistre pendant que vous écrivez — FAIT

Deux secondes de silence et la fiche part toute seule, plus un envoi au moment
où l'application passe en arrière-plan. Vous pouvez ouvrir un lien, refuser un
appel, verrouiller le téléphone : ce qui est tapé est déjà en base.

Le contrôle qui le tient tape un numéro, **ne touche ni « Suivant » ni
« Retour »**, vérifie en base, rouvre l'écran et le retrouve
(`test-fiche-securite-e2e.ts`). Il a été vu rouge sans le correctif.

Ce qui n'a PAS été fait, et pourquoi : le bandeau du planning ne se rafraîchit
pas à chaque frappe. Le faire, c'était recharger trois écrans toutes les deux
secondes sous vos doigts, pour un écran que vous avez déjà devant vous.

### 2. Le relevé GPS — QUATRE DÉFAUTS, PAS UN

*« La position exacte fonctionne pas. »*

| Ce qui n'allait pas | Ce qui change |
|---|---|
| une seule phrase pour les trois causes du navigateur | refus de localisation, pas de signal, délai dépassé : trois phrases, trois gestes |
| la haute précision abandonnait au bout de 15 secondes | elle réessaie une fois en précision normale, celle du réseau, qui répond sous un couvert d'arbres ou dans une camionnette |
| aucun retour pendant l'attente | le bouton dit « Relevé en cours… » |
| « ou écrivez-la » alors qu'aucun champ ne le permettait | un champ apparaît dès qu'un relevé échoue, et une position relevée devient corrigeable |

**Ce que cela ne dit pas : pourquoi ça a raté chez vous.** Les trois causes
restent possibles, et ce poste n'a pas de puce GPS pour en décider. À la
prochaine tentative, la phrase le dira — envoyez-la.

### 3. Les deux heures — FAIT, MAIS NON REPRODUIT ICI

*« Pour l'h ça serait bien d'avoir deux encarts séparés. »*

Le navigateur du poste de travail les dessine **déjà** séparées : le défaut
est propre à Safari, qui habille `input[type="time"]` à sa façon et jette le
cadre qu'on pose dessus. C'est pour cela que Nom et Prénom, deux lignes plus
bas et **le même composant**, montraient bien deux cadres sur votre capture.

Le cadre a donc été sorti du champ : il vit maintenant sur une boîte
qu'aucun navigateur ne rhabille. **Une capture prise ici ne prouve rien de
votre iPhone** — c'est à regarder chez vous.

### Les chiffres de la batterie, le 22 septembre au soir

| | |
|---|---|
| Types, lint, construction, mémoire du dépôt | verts |
| Suites base de données | **405 vertes sur 406**, 1 non mesurable ici |
| Suites navigateur | **165 sur 165** |
| Connexion derrière un proxy | verte |

Aucun rouge. Le lot est de niveau 3 (`src/lib/fiche-securite.ts` atteint
15 points d'entrée), donc la batterie entière était obligatoire.

Les deux contrôles neufs ont été **vus rouges avant d'être verts** : la phrase
unique du GPS fait échouer `test-fiche-securite.ts`, et retirer
l'enregistrement au fil de l'eau fait échouer `test-fiche-securite-e2e.ts`
(« 02 40 00 00 00 » au lieu du numéro tapé).

## 8. Ce qui reste ouvert après le 22 septembre

- **Le rendu des deux heures sur votre iPhone**, à confirmer.
- **Le formulaire MSA est un fichier posé sur leur site.** Le jour où ils le
  déplacent, le bouton donnera une page d'erreur et rien ne nous préviendra.
  Un contrôle qui interroge les cinq adresses depuis GitHub reste à faire.
