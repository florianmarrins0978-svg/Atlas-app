# La fiche de sécurité complète : verdict du lot

*14 et 15 octobre 2026. Codé d'après la planche `appli/fiche-de-securite-mieux.html`,
validée par « Parfait, code ça », puis la carte d'après `appli/fiche-securite-carte-gps.html`.
Sur `main` le 15 octobre, dans une batterie commune avec les véhicules et le banc d'essai.*

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

## La carte du point GPS, ajoutée le 15 octobre

| | Verdict | Où |
|---|---|---|
| La carte IGN, centrée sur le point, plan ou photo aérienne | fait | `CarteDuPoint.tsx`, `src/lib/carte-du-point.ts` |
| Un appui déplace le point | fait | `pointSousLAppui` |
| L'adresse officielle au point | fait | `adresseAuPoint`, Base Adresse Nationale |
| La même carte dans le PDF | fait | `dessinerLaCarte` |
| Ouverte au salarié, qui remplit la fiche sur place | fait | `acces-roles.ts` |
| « Chercher une adresse » pose le point, même sur un chantier qu'Atlas n'a pas su situer (sa demande du 15 octobre) | fait | `CarteDuPoint.tsx`, `ChampAdresse.tsx` (`onChoisir`) |

**Trouvé en regardant l'écran, et c'est le plus important du lot** :
« Relever ici » n'avait **jamais** pu marcher. L'en-tête posé le premier jour,
`geolocation=()`, interdisait la position à Atlas lui-même ; le navigateur
refusait sans rien demander. C'était sa remarque du 22 septembre, *« la position
exacte fonctionne pas »*. Corrigé (`geolocation=(self)`), avec un contrôle
vu rouge d'abord, et la suite navigateur relève désormais une vraie position.
Un contrôle de sécurité exigeait l'interdiction : il exige maintenant « nos
pages seules », comme pour la caméra.

## Ce qui a été éprouvé

| Contrôle | Résultat |
|---|---|
| Types (`tsc`) | vert |
| `test-fiche-securite.ts` (règles, croquis, PDF) | 26 sur 26 |
| Pas de pansement, pas de code mort, couches, flèches, boutons, rôles | verts |
| `test-fiche-securite-db.ts` (base) | 14 sur 14 |
| `test-fiche-securite-e2e.ts` (navigateur) | 17 sur 17, puis 18 avec le relevé GPS |
| Batterie commune, 1ʳᵉ | quatre rouges de nos lots : carte fermée au salarié, trois boutons carrés, mode d'emploi périmé, contrôle des accès des véhicules. Corrigés |
| Batterie commune, 2ᵉ | base 455/464, navigateur 180/184 ; les trois rouges navigateur rejoués **verts** sur le lot, le rouge Windows **déjà rouge sur `main`** |

## Ce qui reste ouvert

| | Qui |
|---|---|
| La carte et l'adresse au point, sur son téléphone | lui, sur son espace |
| « Relever ici » sur un vrai téléphone | lui, sur son espace |
