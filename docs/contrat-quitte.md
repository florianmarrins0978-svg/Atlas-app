# Le contrat d'entretien quitté : il se retrouve dans « Vos chantiers »

29 septembre 2026. Branche `claude/contrat-quitte-dans-chantiers`, **pas sur `main`**.

## Ta remarque

> « Lorsque j'ouvre un contrat d'entretien pour réaliser le devis, si je quitte, il ne s'enregistre pas dans mes chantiers en cours sur la page chantier. »

**Vrai, et pour deux raisons**, vérifiées dans le code puis rejouées dans un navigateur.

| | La cause | Le fichier |
|---|---|---|
| 1 | L'écran du contrat n'écrivait **rien** avant « Aperçu du PDF » ou « Envoyer ». Quitté, le contrat partait avec l'écran. | `src/app/clients/[id]/contrat/ContratClient.tsx` |
| 2 | La page Chantiers ne lisait **que des chantiers**. Même enregistré, un contrat en cours n'y apparaissait jamais. | `src/app/page.tsx` |

## Ce qui a été fait

| | Comment | Le fichier |
|---|---|---|
| le contrat s'enregistre tout seul | dès la première prestation, puis à chaque changement ; jamais deux brouillons pour un contrat | `ContratClient.tsx` |
| il apparaît dans « Vos chantiers » | « Contrat d'entretien », le nom du client, « Contrat à compléter » ou « Contrat prêt à envoyer » ; il compte dans « En cours » | `src/app/page.tsx`, `src/lib/contrats-entretien.ts` |
| toucher la ligne | rouvre le contrat où tu l'as laissé | `src/app/page.tsx` |
| glisser pour retirer | efface le brouillon ; un contrat déjà envoyé ne s'efface pas | `src/app/actions.ts`, `src/server/repositories/contrats-entretien.ts` |
| envoyé au client | il quitte la liste | `brouillonsDeContrat` |
| qui le voit | seulement ceux qui peuvent rédiger un devis | `src/app/page.tsx` |

**Retiré** : l'envoi créait le contrat de son côté s'il n'existait pas encore. Il passe maintenant par le même enregistrement que le reste.

## Les preuves

| Contrôle | Résultat |
|---|---|
| `test-contrat-quitte-e2e` (neuf) : ta fiche client, « Contrat d'entretien », une prestation, on quitte | **rouge sur l'ancien code** (4 cas sur 4), **vert** avec la correction |
| `test-dashboard`, `test-repartir-du-client` (écrans voisins) | verts |
| `test-contrats-entretien` et `test-contrats-entretien-db` (sous `atlas_app`, donc avec l'isolation) | verts, trois cas ajoutés |
| types, lint, pansements, code mort, couches, tirets, flèches | verts |
| l'accueil et l'écran du contrat, regardés à 390 px | la ligne est là, le contrat se rouvre avec sa prestation |

## Ce qui n'a pas été fait

**La batterie entière.** Tu l'as interdite. Le lot est de niveau 3 (le fichier des règles du contrat touche 102 écrans) : elle est obligatoire avant `main`.

## Ce qui reste ouvert

| Question | Qui tranche |
|---|---|
| Un contrat **envoyé** sans réponse doit-il rester sur l'accueil, comme un devis envoyé ? Aujourd'hui il en sort. | toi |
| Quand jouer la batterie pour le mettre sur `main` | toi |
