# Fournisseurs et partenaires : ce qui est codé (19 octobre 2026)

La planche validée : https://claude.ai/artifact/HfsXhoFq4iLtS8FMyrvJqt.
Branche `claude/reglages-fournisseurs-partenaires`, **pas encore sur `main`**.

## Ses règles, une par une

| Sa règle | Verdict | Où |
|---|---|---|
| Prix d'achat tenus à part des prix de vente | fait, cinq tables neuves, rien dans `tarifs` | `drizzle/0132_fournisseurs_partenaires.sql` |
| Son prix de vente d'abord, puis achat × marge, puis « à chiffrer », jamais zéro | fait | `prixDUneLigneDictee`, `src/lib/prix-achat.ts` |
| Une marge matériel, une marge main d'œuvre, chacune dans son onglet, en coefficient | fait | `marges_achat`, `FournisseursPartenaires.tsx` |
| Une marge propre par société | fait, « Ma marge chez … » en tête de sa fiche | `societes_achat.marge` |
| Au-dessus de × 3 : « pour 20 % de marge, tapez 1,20 » | fait, à l'écran ET en base | `lireMarge`, `CHECK` |
| Recherche et A à Z de la liste des clients, réemployés | fait, rien recopié | `filtrerClientsParNom`, `rangerParNom`, `grouperEnBandes`, `ChampRecherche` |
| Filtre de date `FiltreDeDate`, aucun bouton de filtre | fait, sur « Devis reçus » et « Demandes envoyées » | |
| Un devis reçu se prend en photo ou en PDF, se nomme, se garde | fait, et éprouvé au navigateur | `deposerDevisRecuAction` |
| Rien n'est enregistré d'un devis lu avant son accord | fait : les lignes lues se cochent, « Mettre N prix dans « Mes prix » » | `accepterLignesDuDevisAction` |
| Le devis dicté prend ses prix là | fait, et l'outil de l'assistant aussi | `proposition-prix.ts`, `rechercher-tarifs-compatibles.ts` |

## Ce qui a été fait autrement, et pourquoi

- **« Je dicte » n'est pas dans les réglages.** Sur la planche, c'était la
  démonstration du devis. Dans l'application, c'est le devis qu'il dicte déjà.
- **Aqua Plus et France Bonhomme ne sont pas créés d'office** : l'application
  sert tous les artisans. Il les ajoute en une ligne.
- **Le matériel dicté ne prend sa ligne que si au moins un prix d'achat
  existe** : sans cela, les devis de tous les artisans changeaient d'un coup.
  À trancher par lui (`TODO.md`).

## Ce que la suite rouge a corrigé

« 3 sacs de ciment » ne retrouvait son tarif « Sac de ciment » qu'à la lettre,
alors que l'achat se retrouvait par les mots : **l'achat passait devant sa
vente**, à l'envers de sa règle. Les deux suivent désormais la même règle.

## Ce qui est éprouvé

| Contrôle | Résultat |
|---|---|
| `test-fournisseurs-partenaires-rls` (isolation, clé croisée refusée, × 3 refusé en base, sauvegarde) | 9 sur 9 |
| `test-prix-achat` (ses chiffres : 8 € × 3 × 1,30 = 31,20 €, vente 12 € d'abord) | 13 sur 13 |
| `test-devis-fournisseur-lu` | 5 sur 5 |
| `test-devis-prix-achat-db` (le devis dicté, sous `atlas_app`) | 6 sur 6 |
| proposition, grilles, cloisonnement, sauvegarde, rubriques, rôles, pansements, code mort, couches, tirets, flèches, chartes, boutons | verts |
| types, lint | verts |
| l'écran regardé : liste, recherche, marge 20 refusée, fiche et ses trois parties, Origine, Nuit, Sylve, dépôt d'une photo | vu |

**Pas vérifiable ICI** : la lecture IA d'un vrai devis (aucune clé sur ce poste).
À jouer sur ton espace avec un devis Aqua Plus en photo puis en PDF.

## Ce qui reste

1. La batterie entière : `npm run verifier:avant-livraison` (niveau 3, migration et argent).
2. Puis `main`, avec ton accord.
3. Le lot B : importer un devis et les prix sur le plan d'arrosage.
