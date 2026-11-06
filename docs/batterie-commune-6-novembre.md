# Batterie commune du 6 novembre : quatre lots, une seule mesure

Ta demande : *« il y a la session 2, 3, 4 et la 5 normalement qui sont prêtes. Fusionne-les, joue qu'une seule batterie pour vous toutes et pousse une fois vert. »*

Branche : `lot/batterie-commune-6-novembre`, partie de `main`, et reposée sur `main` (`b84c05da`) avant la dernière mesure.

## Les quatre lots

| Session | Lot | Branche fusionnée | Migrations | Rouge venu du lot ? |
|---|---|---|---|---|
| 2 | Une idée pour l'appli | `lot/idees-pour-l-appli` (`4020bfd0`) | 0167, devenue **0170** | cinq, corrigés |
| 3 | Les fériés, le motif d'une absence, les jours travaillés, les zones | `lot/paie-zones-feries` (`39def216`) | 0165 à 0168 | un, corrigé |
| 4 | La Factur-X | `lot/facture-x` (`528aff98`) | 0165, devenue **0169** | un, né de la rencontre, corrigé |
| 5 | La mention de la franchise datée | `lot/mention-franchise` (`2414b943`) | aucune | aucun |

Chaque branche est entièrement dans la fusion, vérifié.

## Ce que la fusion a demandé

| Rencontre | Ce qui a été fait |
|---|---|
| **0165 pris deux fois** (Factur-X, nature d'une absence) et **0167 deux fois** (idées, zones) | La Factur-X devient **0169**, les idées **0170**. Aucune n'est jamais passée sur ta base : elles n'étaient sur aucun `main`. Chaque renvoi relu un par un : « 0167 » désignait aussi les zones |
| `ARCHITECTURE.md` : deux **§556** (`main`, les idées) | Les idées deviennent **§558** ; la suite du §555 de la Factur-X reprend sa place |
| L'écran Réglages : la Factur-X et les idées y chargeaient chacune leur donnée au même endroit | Les deux |
| **La Factur-X lisait l'ancienne phrase de la franchise**, que la session 5 a datée | Elle ne compilait plus, et une facture de 2027 aurait cité le CGI pendant que son papier citait le CIBS. Elle lit désormais la phrase du jour de sa facture, comme son PDF. `test-facture-x` le tient, vu rouge avant |

## Les trois batteries

| | Base | Navigateur | Connexion derrière un proxy |
|---|---|---|---|
| 1ʳᵉ | 567 sur 571 | 212 sur 214 | verte |
| 2ᵉ | 570 sur 571 | 213 sur 214 | verte |
| 3ᵉ | **571 sur 571** | 213 sur 214 | verte |

Types, style, mémoire du dépôt, construction, fournisseurs d'IA et données de démonstration verts aux trois.

**Pourquoi trois et pas une.** Une correction qui touche un fichier lu par beaucoup d'écrans (le limiteur), ou la sauvegarde (elle lit la base), ne se rattrape pas par un complément : le garde-fou exige la batterie entière, et c'est le côté sûr.

## Ce que la batterie a trouvé, et ce qui a été fait

| Rouge | D'où | Ce qui a été fait |
|---|---|---|
| Le limiteur des idées enfermait une heure | idées | Cinq par quart d'heure : aucune fenêtre n'enferme plus de quinze minutes (`test-connexion-limite`) |
| La table des idées manquait à la sauvegarde sans être déclarée | idées | Ta réponse : *« Non, on s'en fout. Les idées, les gens, ils s'en foutent de ça. »* Exclue de « Mes données », avec tes mots |
| L'auto-contrôle de la sauvegarde rougissait sur cette exclusion | session 3 | Il recopiait la règle sans les exclusions : une seule fonction pour les deux |
| Deux écrans des idées manquaient au préchauffage | idées | Ajoutés |
| L'écran d'une idée, ouvert à tous les rôles, n'était pas déclaré | idées | Déclaré comme une rubrique à soi : chacun n'y voit que ses idées |
| « Les idées reçues » répondaient 200 à un compte ordinaire | idées | **Pas une faille** : la page refusait bien, et Next.js rend 200 sous un écran de chargement. Le contrôle vérifie désormais qu'aucune idée n'arrive au navigateur, comme le vocabulaire de l'éditeur |
| `test-le-client-s-est-trompe` : rouge trois fois à la batterie, vert seul | la suite elle-même | Son écran, une fois qu'on l'a fait parler : « Cette date vient d'être retenue par ailleurs ». La démonstration ne propose qu'un jour, et les suites d'avant le remplissaient. Le produit répondait juste. La suite se donne son propre jour dans quarante-cinq jours, et le rend à la fin. **Prouvé** : le jour de la démonstration rempli à la main, l'ancienne version rouge, la nouvelle verte |

## Ce qui a été dit et se révèle faux

- J'ai écrit « pas d'idées dans Mes données, ta décision ». C'était la session 2 qui l'avait noté, sous une citation qui ne parlait que de la pastille. Je te l'ai demandé en propre, et ta réponse est maintenant écrite.
- J'ai d'abord cru le rouge du client « capricieux ». Il ne l'était pas : il dépendait de l'ordre des suites et du jour du mois.

## Ce qui reste, et qui le tranche

| | qui |
|---|---|
| Regarder sur ton espace : Jours travaillés (Pour mon comptable, Mes salariés), Réglages, Équipe, Zones de déplacement, la ligne Férié dans Couleurs, l'avertissement du férié au planning, Réglages, Une idée pour l'appli | **toi**, une fois ton espace à jour |
| Les deux barèmes de zones (MSA, bâtiment) à vérifier sur les textes de l'année | **toi ou ton comptable** |
| Un compte d'essai Pennylane pour la Factur-X (la ligne reste cachée sans lui) | **toi** |
| Une suite navigateur pour Jours travaillés et les zones | **moi**, au prochain lot |
| La fermeture du compte (session 1, `lot/fermeture-compte`) prend aussi une **0166** : elle devra être renumérotée en arrivant | la session qui la livrera |
