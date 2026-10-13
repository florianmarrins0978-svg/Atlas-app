# La TVA qui ne se récupère pas

*Lot du 13 octobre 2026. Planche : `appli/tva-ticket-carburant.html`.*

## Ce que vous avez demandé

« Chaque entrée et chaque sortie doit être notée, mais si c'est une catégorie
où il ne récupère pas la TVA, elle ne doit pas être comptabilisée. »

Avant ce lot, **tout achat comptait en entier** : un hôtel ou un repas perso
faisait baisser la TVA à payer.

## Ce qui est fait

| | Ce que fait l'appli |
|---|---|
| Chaque achat | dit ce qu'il est : Carburant, Matériel, Repas, Hôtel, Train ou taxi, Autre. Au scan, l'IA le propose ; vous confirmez |
| Carburant | Utilitaire coché d'office, toute la TVA. Voiture à côté : 80 % |
| Matériel, Autre | toute la TVA, comme avant |
| Hôtel, train, taxi, repas perso | notés, avec « Non récupérable » ; jamais comptés |
| Repas d'affaires | compte seulement avec : avec qui, pourquoi, et la case « nom et adresse de l'entreprise écrits sur la note » (ou « facture au nom de l'entreprise » au delà de 150 € HT). Sinon « Pas encore » et un bouton « Compléter » dans la liste |
| Les achats déjà saisis | ne changent pas, ils comptent comme avant |

## Ce qui a été vérifié

| Contrôle | Résultat |
|---|---|
| La règle du calcul (`test-achat-tva`) | rouge sans elle (12 échecs), verte avec elle |
| L'enregistrement en base, isolation entre entreprises (`test-achats-tva-repo`) | 16 sur 16 |
| La migration sur une table qui a déjà des achats | les anciens achats restent intacts, le total ne bouge pas |
| Votre geste dans le navigateur (`test-tva-non-recuperable-e2e`, neuve) | 6 sur 6 |
| Les deux suites de l'écran TVA déjà existantes | 6 sur 6, 11 sur 11 |
| Les écrans regardés | la feuille du ticket et la liste, à la largeur d'un téléphone |

## Ce qui n'a pas été fait, et pourquoi

- **La batterie complète n'a pas été lancée**, à votre demande. Sans elle,
  le garde-fou refuse la mise sur `main` : le lot attend sur sa branche,
  `claude/tva-non-recuperable`.
- **La lecture d'un vrai ticket qui propose la nature** n'a pas pu être
  essayée ici (pas de clé IA sur ce poste). À regarder sur votre espace.

## Ce qui reste à votre comptable

L'alcool d'un repas, le repas pris seul, le gazole non routier des machines :
aucun texte officiel lu ne tranche. Atlas ne les décide pas.
