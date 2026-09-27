# Le contrat d'entretien, lot 2 : la facture de chaque passage

*27 septembre 2026. Branche `claude/extrabat-competitor-review-7v9r8m`, pas sur `main`.*

Ta demande : *« enchaîne le lot 2, ne lance pas de batterie »*.

## Ce qui marche

| Le geste | Où | Vérifié comment |
|---|---|---|
| un passage fait arrive « À facturer » **avec son montant** : « 25 septembre, 54,00 € prévus » | Terminés | écran regardé |
| « Créer la facture » la remplit au prix du contrat : « Tonte et ébarbage, passage du 25 septembre 2026 », 45,00 € HT, 54,00 € TTC | facture | écran regardé, et en base |
| deux appuis ne font qu'une facture | facture | en base |
| **l'automatisme** : quand le compte rendu du jour part, la facture du passage part avec, dans le même message | fiche d'entretien | en base : facture arrêtée, lien créé, une seule fois |

## Ce qui n'a pas pu être vérifié ici

- **L'envoi réel du message avec les deux liens** (compte rendu et facture) : ici Atlas tourne sur une adresse locale, qui refuse d'envoyer un lien qu'un client ne pourrait pas ouvrir. À essayer chez toi : un contrat avec l'interrupteur allumé, un passage posé, sa fiche d'entretien envoyée le même jour.

## Comment l'automatisme choisit la facture

| Condition | Pourquoi |
|---|---|
| le compte rendu du **même client**, le **même jour** que le passage posé | c'est ce qui dit que le passage a eu lieu |
| le contrat est en **B** avec l'interrupteur **allumé** | c'est ton choix, contrat par contrat |
| la personne qui envoie **peut facturer** | la règle des factures ne saute pas parce qu'on passe par la fiche |

Si la facture ne peut pas partir, le compte rendu part quand même, et la fiche reste ouverte avec la phrase : « Le compte rendu part, mais sa facture n'a pas pu partir avec. Envoyez-la depuis Terminés. »

## Ce que j'ai décidé seul, et pourquoi

- **La facture d'un passage passe par la même porte qu'un devis** (« Créer la facture » dans Terminés). Cette porte refusait le passage avec « pas de devis, rien à facturer ». J'ai d'abord voulu passer par la « facture sans devis », puis je suis revenu dessus : ce n'est pas la porte que Terminés ouvre, et elle doit rester vide pour les dépannages.
- **Le lien de la facture s'ajoute à la fin du message**, après ton texte de compte rendu, que je n'ai pas touché.

## Intégration de `main`

Sur `main`, « Autre chantier » est devenu **« Nouveau devis »** : la rangée à trois boutons porte le nouveau nom. `main` avait aussi pris les numéros de migration 0102 à 0106 : celle du contrat devient **0107**, vérifiée sur une base vide (121 migrations passent).

## Les chiffres des contrôles joués (pas la batterie)

| Contrôle | Résultat |
|---|---|
| types | verts |
| règles du contrat, sans base | 16 cas verts |
| contrat en base, sous le rôle de l'application | 15 cas verts, dont la facture du passage et l'automatisme |
| Terminés, messages, fiche d'entretien, état du planning, actions gardées, accès | verts |
| tirets, flèches, couleurs, code mort, pansements, couches | verts |

**Niveau : 3** (migration, facturation). La batterie entière est à jouer avant `main` ; tu m'as demandé de ne pas la lancer.

## Ce qui reste

| | Qui |
|---|---|
| **lot 3 : la facturation A** (mensualités le 1er du mois) : aujourd'hui elle s'enregistre et s'imprime, sans créer de facture | à coder |
| la carte d'état du contrat sur la fiche client | à coder |
| les passages d'un mois groupés sur une ligne dans « Sans date » | à coder |
| le message du contrat modifiable dans Réglages | ta décision |
| la batterie, puis `main` | ta décision |
