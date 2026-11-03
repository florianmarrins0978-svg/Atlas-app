# Ma banque soignée, codée (1er novembre 2026)

Ta demande : *« code ça, pas de batterie »*, devant la planche
`appli/soignee/reglages-banque.html`.

**Où c'est :** sur la branche `lot/ma-banque-soignee`. **Pas sur `main`** :
le lot touche l'argent et ajoute une colonne en base, donc il lui faut la
batterie entière avant de partir chez toi. Elle n'a pas été jouée, à ta
demande.

## Ce qui est codé, point par point

| Point de la planche | Verdict | Fichier |
|---|---|---|
| « Lue » et l'heure à côté de la pastille | codé | `src/app/reglages/banque/page.tsx`, `src/lib/ma-banque-en-mots.ts` |
| « Pas lue » et l'heure, la raison dessous | codé | idem |
| « À renouveler » et « dans 5 jours » à côté, la date dessous | codé | idem |
| La ligne « Dernière lecture » retirée | codé | idem |
| « Relevé lu depuis » retiré, une phrase seulement si la banque refuse | codé | idem |
| Le relevé du dossier en cours, entrées et sorties comptées | codé | idem |
| Chaque virement : jour en grand, montant en vert, état en pastille | codé | idem |
| Le nom d'un virement sans payeur, sans « VIR INST » ni « VIR SEPA » | codé | `nomDuVirement` |
| « Atlas lit les entrées et les sorties » | codé | page |
| Délier en bas, en rouge | codé | page |
| Ma banque dans les Réglages, seulement reliée | codé | `src/lib/rubriques-reglages.ts`, `src/app/reglages/page.tsx` |

## Ce qui a été fait autrement, et pourquoi

- **Les boutons Oui et Non** de la carte « Virement reçu » gardent la forme
  de l'accueil (Oui en pilule verte, Non écrit). Ce bouton est le même à
  l'accueil, dans Ma TVA et dans Ma banque : le changer ici le changeait
  aussi sur les deux autres écrans, que tu n'as pas demandés.

## Ce que j'ai trouvé en le codant, et corrigé

**Après une lecture ratée, Ma banque affichait « Lue ».** Atlas note
l'heure de lecture AVANT d'appeler la banque. Si la banque ne répond pas,
puis que tu rouvres Ma banque dans la demi-heure, l'écran ne relit pas : il
voyait seulement l'heure, et affichait « Lue ». C'est exactement ton cas de
ce soir (« quand je scanne, il ne trouve pas de nouvelles lignes »).

Corrigé : le refus de la banque est maintenant gardé en base (une colonne
ajoutée, rien de réécrit, migration 0156) jusqu'à la prochaine lecture
réussie. Je l'ai rejoué ici dans les vraies conditions : la lecture échoue à
l'accueil, Ma banque rouverte affiche « Pas lue à 22 h 07 » et la raison.

## Ce qui a été éprouvé

| Contrôle | Résultat |
|---|---|
| Types, style | verts |
| Règles de Ma banque (`test-ma-banque-en-mots`) | 19 sur 19, dont le cas « Lue » après un refus, vu rouge avant la correction |
| Suite banque en base, rôle de production (`test-banque-db`) | 13 sur 13 |
| Rubriques des Réglages (`test-rubriques-reglages`) | vert, vu rouge contre l'ancienne version |
| Migrations, export, couches, code mort, tirets, flèches, chartes | verts |
| Écrans regardés ici, données de démonstration | reliée, accord bientôt fini, pas lue, un client a payé, le sommaire des Réglages |
| **Batterie entière** | **pas jouée**, à ta demande |

## Ce qui reste ouvert

- **La batterie**, puis `main` : à lancer avec ton accord.
- **Le Check up** de Pour mon comptable ne relit pas la banque si elle a été
  lue il y a moins d'une demi-heure, et ne le dit pas. Pas touché ici.
- **« Relier ma banque »** dans Pour mon comptable s'affiche chez tous les
  artisans, alors qu'eux ne peuvent pas relier tant que le contrat Enable
  Banking n'est pas signé. Pas touché ici.
