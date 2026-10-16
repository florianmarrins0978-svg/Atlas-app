# Arrosage : les buses choisies à la pression qui arrive

16 octobre 2026. Branche `claude/pression-de-choix`, commit `c4e12dc`.

## Ce qui était faux

| | avant | maintenant |
|---|---|---|
| la pression qui choisit les buses | jusqu'à 0,31 bar au-dessus de ce qui arrive au dernier arroseur | jamais au-dessus pour la portée : la portée réelle de chaque buse est vérifiée |
| le compte des vannes au choix des buses | le débit total divisé par la limite, comme si un arroseur se partageait | tête par tête, par la même coupe que le plan |

Fichiers : `src/lib/arrosage/calcul.js` (`decouper`, `couperEnVannes`, `porteeALaPression`), recopié dans `appli/arrosage-calcul.js`.

## Ce que ça change sur 392 jardins d'essai

| | jardins |
|---|---|
| une vanne de moins | 68 |
| une vanne de plus | 5, tous des plans que l'ancien calcul rendait faux (portée comptée que la pression ne donne pas) |
| alerte nouvelle | 0 |
| son jardin du 23 août (12 × 12 et 8 × 8, 3 bar) | toujours 2 vannes |

## Ce qui a été essayé et écarté

Trois autres façons de chercher la pression, chacune donnait un plan absurde sur un jardin précis (six ou sept vannes quand trois tenaient). Le détail est dans `ARCHITECTURE.md` §467.

## Batterie

Base 464/465, navigateur 183/184, connexion derrière un proxy : verte.

| rouge | verdict |
|---|---|
| `test-prechauffage` (un écran de réglages des véhicules) | rouge de la même façon sur `main` : pas ce lot |
| `test-le-client-s-est-trompe-e2e` (la page du devis client) | rejouée seule deux fois : verte les deux fois. Ce lot ne touche pas cette page |

## Ce qui reste ouvert

| | qui |
|---|---|
| une pelouse de 20 × 12 reçoit six vannes dès 3,7 bar (déjà vrai avant). Ta règle « l'écart ne descend jamais sous la portée » empêche une turbine de 10,1 m de paver 20 m. Faut-il permettre de réduire la portée d'une turbine à la vis ? | toi |
| les débits affichés peuvent être jusqu'à 5 % sous le réel (la limite du tuyau est vérifiée au débit réel) | nous |
| un plan se calcule en 0,1 à 0,5 seconde | nous |
| le lot de tes tubes (19,0 et 26,0 mm) se repose sur celui-ci | nous, ensuite |
