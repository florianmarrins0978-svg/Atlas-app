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
