# La fiche de sécurité complète : verdict du lot

*14 octobre 2026. Codé d'après la planche `appli/fiche-de-securite-mieux.html`,
validée par « Parfait, code ça ». Aucune batterie jouée : sa consigne.*

## Ce qui est codé

| Point de la planche | Verdict | Où |
|---|---|---|
| Les six écrans gardés, tout à la suite, sans sous-catégories | fait | `FormulaireFicheDeSecurite.tsx` |
| Rôle du donneur d'ordre, adresse des secours, autres responsables | fait | écran 1 |
| Entreprises sur place, retenues d'une fiche à l'autre par leur nom | fait | écran 1, mémoire de l'entreprise |
| Équipe et compétences écrites dans la fiche, SST et GSA valables 24 mois | fait | `validite`, `src/lib/fiche-securite.ts` |
| EPI, situation des travaux, arbres dangereux un par un, noyade | fait | écrans 2 et 4 |
| « Rien à signaler » compte comme une réponse | fait | `REPONSES_VIDES` |
| Croquis en plein écran, 13 outils, repères qui suivent le doigt | fait | `Croquis.tsx` |
| « Retirer le dernier », limite en rectangle, maison posée seule | fait | `Croquis.tsx` |
| « Terminé » refusé sans accès, voie et arbre à traiter | fait | `manquesDuCroquis` |
| Signature refusée sans le minimum légal, chaque manque emmène où remplir | fait | `minimumLegal`, `signerLaFicheAction` |
| Chaque présent signe qu'il a lu ; « Enregistrer » refusé sinon | fait | `refusDeFinaliser`, `finaliserLaFicheAction` |
| « Absent » pour qui n'est pas venu | fait | `marquerAbsentAction` |
| « À qui l'envoyer », expliqué pour qui ne connaît pas la loi | fait | écran signé |
| Le PDF porte tout, croquis compris, et les signatures de lecture | fait | `fiche-securite-pdf.ts` |

## Ce qui a été fait autrement

- **Les lectures ne viennent jamais de l'écran.** Un enregistrement ordinaire
  aurait pu écrire la signature d'un ouvrier qui n'a rien lu. Elles passent par
  leur propre action, sur une fiche signée verrouillée le temps de l'écrire.
- **Paysage ne liste que les fiches enregistrées.** Les fiches signées avant ce
  lot n'ont pas d'équipe : elles restent visibles, sans migration.
- **Rouvrir une fiche efface les lectures** : elles portaient sur la version
  d'avant.

## Ce qui n'est pas fait

- **La carte du point GPS.** Celle de la planche était dessinée ; une vraie
  carte demande un fournisseur de fonds de carte. À décider s'il la veut.

## Ce qui a été éprouvé

| Contrôle | Résultat |
|---|---|
| Types (`tsc`) | vert |
| `test-fiche-securite.ts` (règles, croquis, PDF) | 26 sur 26 |
| Pas de pansement, pas de code mort, couches, flèches, boutons, rôles | verts |
| `test-fiche-securite-db.ts` (base) | réécrit, **pas joué** |
| `test-fiche-securite-e2e.ts` (navigateur) | réécrit, **pas joué** |
| Batterie | **pas jouée**, sa consigne |

## Ce qui reste ouvert

| | Qui |
|---|---|
| Jouer les suites base et navigateur | lui : son « oui » |
| Regarder les écrans dans l'application | nous, une fois le serveur autorisé |
| La batterie (niveau 3) puis `main` | lui : son « oui » |
