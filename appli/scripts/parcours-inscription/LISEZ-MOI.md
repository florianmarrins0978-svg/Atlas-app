# Refaire la marche « De l'essai à l'appli »

`appli/vente/cause-2-inscription.html` est faite des VRAIS écrans de la
création d'un compte (`CLAUDE.md` §3 bis, 2 quinquies) : les vingt questions
(sur le chemin de l'entreprise individuelle en franchise, sans décennale), le
code reçu par e-mail, les conditions, « C'est fait », puis l'accueil d'un
compte neuf. Elle s'ouvre depuis « Créer mon compte », au bout de la planche des
formules du site (`appli/vente/cause-2-visite.html`). Pour la refaire après un
changement de ces écrans :

```bash
source scripts/monter-base-locale.sh
DATABASE_URL=postgresql://postgres@localhost:5432/atlas_test npm run db:seed
npx next dev -p 3000 > /tmp/dev.log 2>&1      # dans un autre terminal ; le code de l'e-mail s'y écrit
ATLAS_ADRESSE=http://localhost:3000 node appli/scripts/parcours-inscription/figer.mjs /tmp/fige /tmp/dev.log
node appli/scripts/parcours-inscription/composer.mjs /tmp/fige appli/vente/cause-2-inscription.html
node scripts/planche-figee/parcourir.mjs "$PWD/appli/vente/cause-2-inscription.html" /tmp '[data-va="q1"]=>q1'
```

Le serveur, la base et l'amorçage demandent son « oui » (`CLAUDE.md` §5).

| | ce qu'il fait |
|---|---|
| `figer.mjs` | crée un compte pour de bon sur la base de démonstration, avec des réponses inventées (le téléphone est dans la tranche que l'Arcep réserve à la fiction), lit le code dans le journal du serveur et fige chaque écran |
| `composer.mjs` | branche chaque bouton sur l'écran qui le suit ; les autres choix disent en une ligne ce qu'ils auraient demandé de plus ; pose sur l'accueil la carte proposée de la visite guidée (« Non merci » la retire) ; rouvre l'écran que l'adresse nomme (`?etat=accueil`), pour que « Quitter la visite » ramène dans l'appli |

**Ce que ce navigateur ne montre pas** : Face ID ne se propose que sur un
appareil qui sait le faire, donc pas ici ; sur son iPhone, l'écran « Activer
Face ID » vient entre les conditions et « C'est fait ».
