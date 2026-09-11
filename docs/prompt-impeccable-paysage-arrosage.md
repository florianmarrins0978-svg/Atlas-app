# Le prompt `/impeccable` pour le plan d'arrosage

À coller après `/impeccable` dans une session neuve. Il tient seul.

Écrit le 11 septembre 2026. L'arrosage est **le seul outil du pôle Paysage qui
tourne pour de bon**, et il n'a jamais été repris depuis son entrée dans
l'application le 20 août 2026. Le prompt des Réglages le disait déjà en
dernière ligne : *« Paysage — arrosage, diagnostic, fiches d'entretien : le pôle
métier, jamais repris ».*

## Le rangement, lui, est DÉJÀ fait

Vérifié dans le code avant d'écrire ce prompt (`CLAUDE.md` §1, *le code fait
foi*). Il n'y a rien à déplacer, et le prompt ci-dessous commence par le redire
pour qu'aucune session ne refasse le travail :

| | |
|---|---|
| la route | `src/app/paysage/arrosage/page.tsx` |
| l'entrée dans la catégorie | `src/app/paysage/page.tsx` — « Plan d'arrosage automatique » vers `/paysage/arrosage` |
| l'onglet | `AtlasBottomNav.tsx` — « Paysage », monté dans `src/app/layout.tsx` |
| la décision | `docs/QUESTIONS.md` §22, du 17 août 2026 : un cinquième onglet |

---

```
Rends impeccable LE PLAN D'ARROSAGE d'Atlas — /paysage/arrosage, et l'entrée qui
y mène depuis /paysage. C'est le seul outil du pôle Paysage qui tourne, et il n'a
jamais été repris depuis le 20 août 2026.

COMMENCE PAR NE PAS REFAIRE CE QUI EST FAIT

L'écran est DÉJÀ dans la catégorie Paysage : route src/app/paysage/arrosage/,
entrée « Plan d'arrosage automatique » dans src/app/paysage/page.tsx, onglet
« Paysage » dans AtlasBottomNav monté par src/app/layout.tsx. Le rangement a été
tranché le 17 août 2026 (docs/QUESTIONS.md §22) : cinquième onglet, ni dans les
Réglages, ni attaché au chantier. Vérifie-le en trente secondes, puis passe à la
suite — ne le redéplace pas, ne le reproposes pas.

LES DEUX CONTRAINTES QUI PRIMENT SUR TOUT LE RESTE

1. L'ARROSAGE N'A PAS LE DROIT À L'ERREUR (CLAUDE.md §4 ter). Sa consigne du
   22 août 2026 : « si jamais il se trompe dans les calculs et que les réseaux
   d'arrosage ne se lèvent pas, moi je vais être dans la merde ». Ailleurs un
   devis se rectifie ; un réseau d'arrosage est ENTERRÉ. Le défaut se voit en
   juillet, sur un gazon jauni, chez un client qui a déjà payé — et c'est le
   paysagiste qui rouvre la tranchée à ses frais.

   Ce qu'elle impose : aucune valeur ne se devine ; ce qu'on ignore se tranche
   vers le SÛR (moins d'arroseurs par vanne, plus de réseaux, la perte la plus
   forte, la portée la plus courte) ; ce qu'on CALCULE reste exact, sans marge
   ajoutée — retirer un arroseur « pour être tranquille » est un trou
   d'arrosage, pas de la prudence ; et ce qui n'est pas calculé se DIT à
   l'écran, sous le plan, là où il le lit.

2. « DES VIEUX QUI ONT DU MAL AVEC LEUR TÉLÉPHONE » (PRODUCT.md, sa consigne du
   5 septembre 2026). Un homme de soixante-cinq ans, seul dans un jardin, son
   téléphone à contre-jour, comprend-il cet écran sans qu'on le lui explique ?
   S'il faut une phrase d'explication, l'écran n'est pas juste — et la phrase
   est du bruit (CLAUDE.md §3).

LE PÉRIMÈTRE

  l'écran        src/app/paysage/arrosage/ : ArrosageClient.tsx (464 l.),
                 PlanDessine.tsx (327), DiscuterLePlan.tsx (193),
                 actions.ts (475), page.tsx (46)
  l'entrée       src/app/paysage/page.tsx (190)
  le calcul      src/lib/arrosage/ : calcul.js (1 715), catalogue.js (1 128),
                 plan-dessine.ts (476), geometrie-croquis.ts (442),
                 trace.ts (252), consignes.ts (270), mesure-debit.ts (244),
                 terrain.ts (147)
  l'IA           src/server/ai/services/lire-croquis.ts (275),
                 discuter-plan.ts (189)
  les maquettes  appli/arrosage-simple.html (celle qui a arrêté l'écran),
                 arrosage-plan.html, arrosage-discuter.html, arrosage.html

DÉJÀ TRANCHÉ PAR LE PATRON — ne pas rouvrir, ne pas redemander

L'écran (20 août 2026, en trois demandes de plus en plus courtes) :
- « un titre, un déroulant, trois cases, un bouton ». Tout ce qui était entre le
  titre et le piquage a été supprimé à sa demande, les numéros d'étape aussi.
  Un contrôle compte les mots pour qu'ils ne reviennent pas ;
- les mesures ne s'affichent QUE si le piquage n'est pas au compteur : après le
  compteur, la pression du réseau de ville est connue ;
- le débit s'affiche dès qu'il est calculable, et rien avant — trois cases vides
  n'annoncent pas « 0,00 m³/h ».

Le plan (CLAUDE.md §4 bis, à relire en entier avant d'y toucher) :
- SANS MÉTRÉS, SANS PIQUAGE, SANS L'ENDROIT DÉFINITIF DE LA NOURRICE : aucun
  plan. On le RETIRE, on ne le grise pas — un plan pâle se photographie et se
  pose quand même ;
- LA NOURRICE SE PLACE PAR LUI, jamais par l'outil. Elle se lit sur le croquis ;
  si le modèle ne la trouve pas, il refuse et le dit ;
- la discussion POSE UN PARAMÈTRE, elle ne dessine jamais, et elle ne crée
  jamais un plan ;
- aucune phrase pré-écrite : un champ libre, rien d'autre ;
- la PLUVIOMÉTRIE ne sépare pas deux vannes (retirée le 23 août) — ne pas la
  remettre. Ce qui sépare, c'est le MATÉRIEL : turbine et tuyère ne s'ouvrent
  jamais ensemble ;
- le moins de VANNES d'abord, le moins d'arroseurs ensuite (« cinq réseaux pour
  ça ??????? », 208 m² de pelouse) ;
- 80 % de recouvrement suffit, et le quinconce ne se resserre jamais sous la
  portée ;
- le débit d'une TURBINE ne dépend pas de son arc ; celui d'une buse VAN, si ;
- 9 V partout : tous ses programmateurs sont à pile ;
- ce qu'on minimise, c'est la TRANCHÉE, pas le tuyau — et on ne traverse pas le
  jardin dans sa largeur ;
- « 13x », jamais « 13 u ». Pas de gras dans une liste de pièces.

Le calcul :
- il n'existe qu'UNE seule fois. appli/arrosage-calcul.js a été REPRIS tel quel
  dans src/lib/arrosage/calcul.js ; verifier-arrosage-une-seule-source.mjs
  compare les deux ligne à ligne. Ne récris pas le calcul en TypeScript : deux
  façons de calculer un plan se paient en matériel commandé de travers.

CE QUI EST OUVERT — à lui montrer, jamais à appliquer d'office

- Lire les POSITIONS sur une vraie photo n'a été éprouvé sur aucune : cet
  environnement n'a pas de clé de vision. Si le modèle ne tient pas un repère
  cohérent, le repli est une saisie à la main, jamais un placement inventé.
- Le trajet du regard à la première tête n'est donné par aucune saisie. Le coder
  rendrait les plans plus sévères, donc plus d'arroseurs, donc des devis plus
  chers : c'est une décision de métier, pas de code (TODO.md, 22 août).
- Un plan fait en visite de devis doit pouvoir rejoindre son chantier ensuite.
  Resté ouvert depuis le 17 août (docs/QUESTIONS.md §22).
- appli/arrosage.html et ses deux scripts sont un SURSIS : une fois l'écran de
  l'application validé par lui, ils n'ont plus de raison d'être, ni leur
  contrôle. Ça se décide avec lui, pas en passant.

CE QUE « IMPECCABLE » VEUT DIRE ICI

1. Le REFUS compte autant que le plan. Un croquis incomplet se refuse en nommant
   ce qui manque et le geste qui débloque — jamais un plan « pour dépanner ».
2. Chaque quantité se recompose à la main. « 22 u Coude SBE 075 » était un
   chiffre JUSTE, et il a quand même fallu qu'il demande d'où il sortait : une
   pièce qui sert à deux endroits s'écrit en deux lignes, chacune nommant sa
   position.
3. Ce que le réseau ANNONCE est ce que le plan DESSINE. Par réseau, un par un,
   jamais sur le total : tés + coudes = arroseurs, coudes = nombre de lignes.
   C'est lui qui a relevé « quatre arroseurs qui ne sont pas alimentés », sur un
   plan qui paraissait juste.
4. La LÉGENDE montre, elle ne décrit pas : le symbole se dessine à côté du mot,
   et il nomme la pièce à visser. Elle s'accorde au catalogue ET à ce que la
   liste facture — les trois ont déjà divergé (22 août).
5. Le plan dit QUEL arroseur, OÙ, et POURQUOI. La buse se nomme comme au
   catalogue — « 12-VAN », pas « une tuyère » : on ne commande pas avec le
   second.
6. Deux chartes sombres (Nuit, Sylve) où l'accent est CLAIR : aucune couleur
   écrite en clair, surPlein sur un aplat, voile() pour un voile. Aucune flèche
   décorative. Le moins de mots possible.

LES INVARIANTS

- Toute lecture passe par withEntreprise(utilisateurId, entrepriseId, fn). Hors
  de ce cadre, une requête ne renvoie rien, silencieusement.
- Français partout. src/lib/arrosage reste PUR : il ne connaît ni src/server ni
  un écran (CLAUDE.md §4 sexies).
- Pas de pansement : on corrige à la racine, et un contournement inévitable
  s'écrit « pansement assumé : <raison> » avec une entrée dans TODO.md.
- Pas de code mort : ce qui ne sert plus se supprime, avec ce qui le tenait en
  vie.

LA MÉTHODE

1. Lis CLAUDE.md §4 bis et §4 ter EN ENTIER, PRODUCT.md, docs/QUESTIONS.md §22,
   ARCHITECTURE.md §144, §145, §147, §167, puis git log -20.
2. Dis-moi ce que tu as trouvé AVANT d'écrire une ligne : les trois choses les
   moins compréhensibles pour quelqu'un qui n'aime pas les téléphones, et les
   trois endroits où le calcul peut rendre un plan faux — chacun avec le fichier
   et la ligne qui le prouvent.
3. Toute apparence ou tout geste nouveau se DESSINE d'abord : une maquette HTML
   dans appli/, un lien dans appli/essais.html, et l'adresse ENTIÈRE une fois
   qu'elle répond 200 — jamais une capture de la maquette.
4. REGARDE LE DESSIN, avec au moins TROIS réseaux :
   npx tsx scripts/capture-plan-arrosage.ts /tmp/captures
   Deux défauts du 23 août ne se montrent qu'à partir de trois — deux tuyaux
   d'une même tranchée dessinaient le même trait, et la tranchée avait la
   couleur du troisième réseau. La maquette validée n'en portait que deux.
5. Capture l'écran à 390 × 664, en Origine ET en Nuit.

LA BATTERIE, SUR SON POSTE WINDOWS

- Préviens-le AVANT de la lancer ; son accord vaut ensuite pour toute la
  séquence, sans le relancer à chaque étape.
- Sa base vit dans Docker : docker start atlas-postgres atlas-redis
- Puis :

  export ATLAS_BASE_SUPER="postgresql://postgres:postgres_dev_pw@localhost:5432/atlas_test"
  npm run verifier:avant-livraison

- Les contrôles propres à l'arrosage, à lire un par un dans le journal :
  test-arrosage-calcul, test-trace-arrosage, test-consignes-arrosage,
  test-arrosage-e2e, verifier-arrosage-une-seule-source,
  verifier-croquis-arrosage, et les quatre verifier-maquette-arrosage-*.
- test-arrosage-e2e fait partie des suites qui lâchent SOUS CHARGE : le 25 août,
  l'étape navigateur jouée sur main NU rendait 107/110, elle comprise. Verte
  seule ne veut pas dire produit cassé — vérifie avant d'accuser ton lot, et ne
  corrige pas un défaut imaginé.

LE RENDU

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : un verdict par point, le fichier qui le fonde, ce qui a été fait
autrement et pourquoi, ce qui a été refusé et ce que ça aurait coûté, les
chiffres exacts de la batterie, et ce qui reste ouvert avec qui peut le
trancher.
```

---

## Ce qui restera après l'arrosage, dans la même catégorie

| | |
|---|---|
| Le **diagnostic végétal** — `/paysage/diagnostic` | la photo, et ce qu'elle dit de la plante |
| La **fiche de chantier** — `/paysage/fiche` | le premier outil qui vit dans Atlas, rien depuis le 18 août |
| La **terrasse bois** | annoncée le 17 août, jamais commencée |
