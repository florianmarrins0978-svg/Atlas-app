# Refaire la planche des dossiers du plan d'arrosage

`appli/arrosage-dossiers.html` est posée sur le VRAI écran d'arrosage
(`CLAUDE.md` §3 bis, 2 quinquies). Pour la refaire après un changement de
l'écran, ou pour la retoucher :

```bash
source scripts/monter-base-locale.sh
DATABASE_URL=postgresql://postgres@localhost:5432/atlas_test npm run db:seed
npm run dev                                   # dans un autre terminal, port 3000
mkdir -p /tmp/fige
ATLAS_ADRESSE=http://localhost:3000 node appli/scripts/dossiers-arrosage/figer.mjs /tmp/fige
node appli/scripts/dossiers-arrosage/composer.mjs /tmp/fige /tmp/brut.html
python3 appli/scripts/dossiers-arrosage/alleger.py /tmp/brut.html appli/arrosage-dossiers.html appli/scripts/dossiers-arrosage/entete.html
node scripts/planche-figee/parcourir.mjs "$PWD/appli/arrosage-dossiers.html" /tmp '[data-atlas=mes-dossiers]=>dossiers'
```

Le serveur, la base et l'amorçage demandent son « oui » (`CLAUDE.md` §5).

| | ce qu'il fait |
|---|---|
| `figer.mjs` | fige le départ, le plan calculé (le jardin part par le champ caché `dessin`, comme « Faire le plan »), la feuille « Au fournisseur », la liste de Paysage ; donne les chiffres de la version d'avant (le jardin sans le massif) |
| `composer.mjs` | ajoute ce qui est proposé, et rien d'autre ; les chiffres de la version d'avant y sont écrits (`v1`) : les recopier de ce que `figer.mjs` dit |
| `alleger.py` | une photo une seule fois, à la taille où elle se voit (14 Mo devenus 1,1) ; les `<image href>` de la nourrice éclatée vers `appli/arrosage-photos/` (`figer.mjs` n'inline que les `src`) ; l'en-tête |
| `entete.html` | l'en-tête de la planche : ce qui est vrai, ce qui est ajouté, ce qui est posé par nous |

**Les pièges payés en la faisant.** Sans clé de lecture d'image, l'écran porte
une phrase rouge que l'appli de son espace n'a pas : `composer.mjs` la retire.
Une feuille de la planche (`data-feuille`) reprend la vraie feuille figée ;
ses gestes passent par le script de `composer.mjs`, qui écoute AVANT celui de
`scripts/planche-figee/composer.mjs` et l'arrête quand il a répondu. Les pages
du PDF ont une taille fixe (340 sur 481) : leur remplissage se MESURE, et une
réserve qui ne tient pas passe à la page suivante au lieu d'être coupée.
