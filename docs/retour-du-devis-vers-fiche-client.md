# Le retour du devis mène à la fiche client — et la fiche du chantier reste

*31 août 2026, le soir. Deux demandes du patron, traitées ensemble.*

---

## 1. « Cette page ne sert plus à rien, si oui on la supprime »

**Verdict : NON, elle ne peut pas être supprimée.** La page de sa capture est la
fiche du chantier (`/chantiers/[id]`).

| Ce qui n'existe QUE là | |
|---|---|
| « Créer la facture » | pour un chantier planifié dont la date n'est pas passée — l'onglet Terminés ne le montre pas encore |
| le tiroir | les étapes restantes, et la porte vers la fiche du client |

**Et huit chemins y mènent** : la flèche de retour de cinq écrans, la carte du
planning, une notification de devis, et la reprise depuis la liste pour les
états qui n'ont pas d'écran à eux.

### CE QUE J'AI DIT DE FAUX, ET QU'IL A CORRIGÉ

J'ai d'abord écrit que la pellicule de photos n'existait QUE sur cette page.
**C'est faux depuis la veille** : la fiche client porte le même composant, avec
les photos du chantier — il l'a relevé le 1er septembre (*« mais maintenant on
ajoute des photos depuis cette page ? »*). L'erreur vient d'avoir cherché
l'écran supprimé le 11 août sans regarder celui ajouté la veille.

Le verdict ne change pas — la page reste —, mais la raison, si : c'est la
facture d'un chantier planifié et son tiroir, plus les photos. La supprimer
reste un vrai lot : déménager « Créer la facture », et redresser huit chemins.

Le fichier qui le fonde : `src/app/chantiers/[id]/page.tsx`. Le détail dans
`ARCHITECTURE.md` §229.

## 2. « Je veux tout le temps revenir à cette page, et seulement celle-là »

**Fait.** La flèche de retour du devis mène désormais à la fiche client, dans
tous les cas.

Le matin même, elle n'y menait **que lorsque le client manquait** ; l'autre
moitié le déposait sur la fiche du chantier, où il n'a rien à faire devant un
devis prêt à partir. C'est ce qui le faisait « retomber » sur la page du point 1.

**Ce que ça ne casse pas :**

- le chemin se referme toujours — enregistrer la fiche ramène au devis ;
- entrée depuis l'accueil, la fiche garde sa sortie vers la liste ;
- une provenance étrangère (`?de=https://ailleurs`) est toujours refusée ;
- la fiche du chantier reste joignable : la barre du bas, la liste, le planning.

**Un mot change à la flèche** : « Remplir la fiche client » quand il n'y a pas de
client, « Revenir à la fiche client » sinon. Même écran, deux raisons — et
« remplir » devant un formulaire complet ferait chercher un champ vide.

Fichiers : `src/lib/retour-du-devis.ts`,
`src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx`.
Le pourquoi : `ARCHITECTURE.md` §230, qui corrige noir sur blanc le §221 du
matin — son raisonnement (« un formulaire rempli n'a rien à lui dire ») était
faux, et c'est lui qui l'a redressé.

## Ce qui l'éprouve

| | |
|---|---|
| `scripts/test-retour-du-devis.ts` | la règle, sans base — et elle refuse désormais que la fiche du chantier soit la sortie, sous quelque condition que ce soit |
| `scripts/test-devis-sans-client-e2e.ts` | son geste, dans un vrai navigateur : 9 cas verts, dont le nouveau — le chantier y acquiert son client **par l'écran**, jamais en base |
| `scripts/test-reprise-chantier-e2e.ts` | adaptée : elle fixait l'adresse de la fiche du chantier en dur |

`retourDuDevis` ne prend plus de `clientId` : la condition a disparu de la
signature au lieu de dormir dedans. Personne ne peut la rétablir par distraction.

## Les chiffres de la batterie

| Étape | |
|---|---|
| types, lint, mémoire | vert |
| 58 suites base | vert |
| connexion derrière un proxy | vert |
| suites navigateur | **109/116**, jouées par groupes (le conteneur abat le serveur d'une traite) |

## Ce qui reste ouvert, et qui n'est pas de ce lot

**Cinq suites sont rouges sur `main` lui-même.** Vérifié en les rejouant sur
l'état de `main` puis sur la branche : elles échouent des deux côtés, à
l'identique. Quatre tournent autour du **relevé de TVA** — probablement une
seule cause. Tant qu'elles rougissent, aucune session ne peut livrer au vert, et
chacune les impute à son propre travail.

**Une sixième rougit une fois sur deux** (`test-madame-lucie-e2e.ts`), et la
cause est trouvée : l'accueil préextrait la page du devis, qui prépare le devis
en se rendant ; le contrôle compte alors des lignes « avant le clic » que le
navigateur a fabriquées seul. C'est écrit dans `TODO.md` pour qui touchera ce
domaine.

**Rien n'est sur `main`** : tout est sur la branche de session, et la fusion se
demande.
