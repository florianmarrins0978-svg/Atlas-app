# Les dates du mois d'un contrat, validées par le client

*27 septembre 2026. Branche `claude/extrabat-competitor-review-7v9r8m`, pas sur `main`.*

Ta demande : *« très bien, code ça, ne lance pas de batterie »*, sur la planche 130.

## Ce qui marche

| Le geste | Où | Vérifié comment |
|---|---|---|
| tu poses la dernière date d'octobre : le tiroir s'ouvre seul sur « À envoyer », la poignée dit « Prêt à envoyer à Mme Costa » | Planning | écran regardé |
| les lignes, puis « Votre client peut proposer une autre date » (allumé d'office), SMS ou e-mail, et le bouton « Envoyer les dates d'octobre » dessous | Planning | écran regardé |
| envoyé, le client passe « En attente du client » ; deux appuis donnent le même lien | Planning | en base |
| le client ouvre son lien : ses trois dates, « Une autre date ? » sur le mois entier, jours pris barrés, « Ces dates me vont » | page du client | écran regardé, date déplacée au 8 octobre, planning suivi en base |
| interrupteur éteint : aucune autre date, il ne peut que valider | page du client | en base |
| un jour qui vient d'être pris refuse toute la réponse, rien n'est écrit à moitié | page du client | en base |
| sans réponse, les dates tiennent jusqu'au jour prévu | tiroir | règle éprouvée |

## Ce qui n'a pas pu être vérifié ici

- **L'envoi réel du SMS ou du courriel** : ici Atlas tourne sur une adresse locale, qui refuse d'envoyer un lien que ton client ne pourrait pas ouvrir. À essayer chez toi : un contrat accepté, les passages d'octobre posés, « Envoyer les dates d'octobre ».

## Ce que j'ai décidé seul, et pourquoi

- **Les dates ne sont pas recopiées dans l'envoi.** La page du client lit le planning. Si tu déplaces un passage après l'envoi, le client voit la nouvelle date.
- **Le client choisit à partir de demain**, jamais un jour passé ni aujourd'hui.
- **Le nom du client n'est pas répété** sur chaque ligne du bloc : il est écrit juste au-dessus.
- **L'envoi est permis à qui pose le planning**, comme poser une date.

## Ce qui n'est pas codé

| | Pourquoi |
|---|---|
| le trait en or pointillé « proposé » au calendrier avant la réponse | le calendrier est partagé par tous les écrans ; je ne l'ai pas touché dans ce lot |
| le rappel du 20 sur l'accueil | un autre écran, un autre lot |
| une notification quand le client valide ou déplace | le planning bouge seul ; à toi de dire si tu veux être prévenu |

## Ce que la batterie a trouvé, et que j'avais faux

La première batterie (169/170 navigateur, 427/433 base) a rougi six fois, **toutes sur le contrat d'entretien et ce lot** :

| Rouge | Corrigé comment |
|---|---|
| **le jour d'aujourd'hui se comptait en heure anglaise** sur l'écran du contrat et les dates du mois : entre minuit et 2 h, la veille | compté à ton heure partout (`jourIso`), et le contrôle attrape désormais aussi cette forme-là |
| la sauvegarde de tes données oubliait les contrats et les envois de dates | ajoutés à l'export |
| le PDF du contrat s'ouvrait par un lien direct : sur iPhone il s'affiche au lieu de se ranger | passe par le bouton de téléchargement de l'appli |
| le mode d'emploi ne retrouvait plus « Nouveau devis » et « Dernier devis » | les libellés s'écrivent entiers dans le code, toujours sur deux lignes à l'écran |
| les cases des mois et les cartes A et B du contrat n'étaient pas en capsule | gardées telles que ta planche 129, exception écrite et bornée à elles |
| les pages du contrat n'étaient pas dans le contrôle des pages publiques | ajoutées |

## Les chiffres des contrôles joués

| Contrôle | Résultat |
|---|---|
| types, style | verts |
| règles des dates du mois, sans base | 10 cas verts |
| dates du mois en base, sous le rôle de l'application | 9 cas verts |
| contrat en base, actions gardées, messages | verts |
| tirets, flèches, couleurs, code mort, pansements, couches | verts |

**Niveau : 3** (migration 0108). La batterie entière est à jouer avant `main` ; tu m'as demandé de ne pas la lancer.

## Ce qui reste

| | Qui |
|---|---|
| essayer l'envoi réel chez toi | toi |
| le trait « proposé », le rappel du 20, la notification | ta décision |
| la batterie, puis `main` | ta décision |
