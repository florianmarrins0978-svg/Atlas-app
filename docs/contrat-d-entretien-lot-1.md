# Le contrat d'entretien, lot 1

*26 septembre 2026. Branche `claude/extrabat-competitor-review-7v9r8m`, pas sur `main`.*

Ta demande : *« code ça, ne lance pas de batterie »*, sur la planche verte (129).

## Ce qui marche

| Le geste | Où | Vérifié comment |
|---|---|---|
| « Contrat d'entretien » à côté de « Autre chantier », les trois sur une ligne | fiche du client | écran regardé |
| composer le contrat : prestations de ta fiche ou écrites, mois, passages au + et au −, prix du passage | écran du contrat | écran regardé |
| début, durée en mois, reconduction | écran du contrat | écran regardé, calculs éprouvés |
| facturation A ou B en doré, B d'office, interrupteur « avec le compte rendu » en B | écran du contrat | écran regardé |
| l'aperçu PDF, dans la mise en page de tes devis | « Aperçu du PDF » | écran regardé, PDF éprouvé en base |
| l'envoi par SMS ou e-mail, avec un lien | « Envoyer à Mme Costa » | le refus en local est regardé ; **l'envoi réel reste à essayer chez toi** |
| le client lit, télécharge le PDF, accepte ou refuse, une seule fois | la page de son lien | écran regardé |
| les passages arrivent dans « Sans date » le 20 du mois d'avant | planning | écran regardé : les deux tontes d'octobre sont arrivées |
| un passage se pose sur un jour comme un chantier | planning | écran regardé : posé le mardi 29 |

## Ce qui ne marche PAS encore, et il ne faut pas le croire fait

| | Ce qui se passe aujourd'hui |
|---|---|
| **la facture B pré-remplie** | un passage fait arrive dans Terminés « À facturer », **sans montant**, et sa facture s'ouvre vide : tu la remplis à la main |
| **l'automatisme « avec le compte rendu »** | il s'enregistre sur le contrat, il n'envoie rien |
| **la facturation A** | elle s'enregistre et s'imprime sur le PDF (« Soit par mois »), **aucune facture mensuelle ne se crée** |
| la carte d'état du contrat sur la fiche client | l'état se lit sur l'écran du contrat |
| les passages d'un mois groupés sur une ligne | une ligne par passage dans « Sans date » |

C'est le lot 2 (facture B et automatisme), puis le lot 3 (facturation A).

## Ce que j'ai décidé seul, et pourquoi

- **Un passage est un chantier.** Il se pose, se termine et se facture comme les autres : aucune seconde mécanique à apprendre, ni pour toi ni pour le code.
- **Un contrat accepté en retard ne déverse pas les mois passés.** Un contrat de mars accepté en juin commence en juin. Mais un passage dû après l'accord reste dû, même si personne n'a ouvert le planning.
- **Un passage sans jour vit au planning.** Sinon chaque tonte aurait posé un « Brouillon » dans ta liste des chantiers.
- **Un contrat parti ne se modifie plus.** Ce que le client a lu est prouvé par une empreinte. Pour changer, « + Nouveau contrat » repart du même contenu.
- **Le message d'envoi n'est pas encore modifiable dans Réglages**, contrairement aux trois autres. Dis-moi si tu le veux.

## Ce qui a été trouvé en regardant l'écran

- La barre d'envoi, collée en bas, passait sous la barre d'onglets : elle est maintenant en fin de feuille.
- Le bouton disait « Envoyer à Costa » : il dit « Envoyer à Mme Costa ».

## Les chiffres des contrôles joués (pas la batterie)

| Contrôle | Résultat |
|---|---|
| types et lint des fichiers touchés | verts |
| règles du contrat, sans base | 14 cas verts (dont un vu rouge avant la correction du planning) |
| contrat en base, sous le rôle de l'application | 12 cas verts : isolation, lien, réponse unique, arrivée sans doublon même en parallèle |
| tirets, flèches, couleurs en clair, code mort, pansements, couches | verts |
| actions gardées, accès par rôle, suite d'état du planning | verts |

**Niveau du lot : 3** (une migration). La batterie entière est à jouer avant `main`. Tu m'as dit de ne pas la lancer : elle ne l'a pas été.

## Ce qui reste à trancher, et par qui

| Question | Qui |
|---|---|
| mettre le lot sur `main` après la batterie | toi |
| le message du contrat modifiable dans Réglages | toi |
| enchaîner le lot 2 (facture B pré-remplie, automatisme) | toi |
