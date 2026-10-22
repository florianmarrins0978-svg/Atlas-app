# Tout télécharger d'un client, et la conservation dix ans

*Lecture du 22 octobre 2026, puis codé le même jour sur sa réponse : « la A, et tout en PDF ».*

## En cinq lignes

1. **Le bouton est codé**, place A (sous « Modifier ses coordonnées »). Il reprend l'archive zip de « Télécharger mes données ». Planche : `appli/telecharger-un-client.html`.
2. **Les fiches d'entretien ont désormais leur PDF**, fabriqué depuis ce que le client a lu sur son lien.
3. **Dans la base, la conservation est tenue** : une facture émise, un avoir, un devis envoyé ne peuvent être ni modifiés ni supprimés, même par erreur de code. C'est la base elle-même qui refuse.
4. **Ce qui ne la garantit pas encore, c'est l'hébergement** : Atlas n'est hébergé nulle part, et dix ans de conservation dépendent des sauvegardes du stockage, pas du code.
5. **La notification à l'échéance : je la déconseille maintenant.** La première échéance d'une facture tombe en 2036 ; ce qu'il faut protéger aujourd'hui, c'est la perte, pas la date de fin.

## 1. Le bouton « Tout télécharger »

| Point | Verdict | Ce qui le fonde |
|---|---|---|
| Archive zip, écrite au fil de l'eau | **existe** | `src/lib/archive-zip.ts`, `src/app/api/mes-donnees/route.ts` |
| Rangement Devis / Factures / Avoirs | **existe** | `src/lib/rangement-sauvegarde.ts` |
| Devis envoyés, factures émises, avoirs figés en PDF au départ | **existe** | `pdfStorageKey` sur `devis`, `factures`, `avoirs` ; les routes `/api/*/pdf` remettent ce fichier-là |
| PDF manquant : jamais refait à la place de l'original | **déjà la règle** | `src/app/api/factures/[id]/pdf/route.ts` répond « Fichier introuvable » plutôt que de régénérer |
| Fiches d'entretien en PDF | **n'existe pas** | `src/server/repositories/fiche-client.ts` : la fiche ouvre `/entretien/<jeton>`, une page |

**Ce que coûte le travail :** une route par client, qui filtre l'export existant sur ce client (niveau 2, l'accès aux pièces étant déjà ouvert à qui voit la fiche). Les fiches en PDF sont un second morceau, plus long, parce qu'il faut un composeur de plus.

**Qui peut tout télécharger : tranché, et ma lecture de la planche était FAUSSE.** J'avais écrit que les salariés ouvrent déjà chaque PDF un par un. Vérifié dans `src/lib/acces-roles.ts` : **un salarié n'ouvre pas du tout les fiches clients**. La règle codée est donc plus simple et plus sûre que ma recommandation : chacun emporte exactement ce qu'il ouvre déjà une pièce à la fois, par la même règle (`piecesOuvertes`).

| Rôle | Ce qu'il emporte |
|---|---|
| patron | tout |
| facturation | devis, factures, fiches (les avoirs ne lui sont pas ouverts aujourd'hui) |
| commercial | devis et fiches, aucune facture |
| salarié | rien : il n'a pas la fiche client |

**Ce qui a été fait autrement que sur la planche** : les fichiers gardent le nom qu'ils ont quand on les télécharge un par un (`facture-2026-0009.pdf`) plutôt que « Facture F2026‑0009.pdf » : un même document sous deux noms ne se retrouve plus. Et le bouton disparaît chez un client sans aucune pièce, plutôt que de donner un fichier vide.

**Éprouvé** : `scripts/test-dossier-du-client.ts` (rôles, chemins, PDF du compte rendu, vu rouge sans le filtre), `scripts/test-dossier-client-db.ts` (sous la RLS réelle : une autre entreprise ne tire rien, un brouillon ne part pas), `scripts/test-tout-telecharger-client-e2e.ts` (le geste, jusqu'au zip ouvert par `unzip`).

## 2. La conservation dix ans : ce qui est tenu, ce qui ne l'est pas

| Pièce | Durée | Tenu par le code ? | Fondement |
|---|---|---|---|
| Facture émise | 10 ans | **oui** : un déclencheur de la base refuse modification et suppression (`drizzle/0018_factures.sql`) | Code de commerce L123-22 |
| Avoir | 10 ans | **oui** : `trg_avoir_immuable` (`drizzle/0101_…`) | idem |
| Devis envoyé | voir ci-dessous | **oui** : immuable dès l'envoi (`drizzle/0001_securite_integrite.sql`) | engagement contractuel |
| Chantier portant une facture | suit la facture | **oui** : sa suppression est refusée (`supprimerChantier`), et la clé étrangère est en RESTRICT | |
| Effacement d'un client (RGPD) | | **oui** : factures et devis acceptés restent, et l'écran le dit avec le numéro (`donnees-client.ts`) | |
| Le FICHIER PDF lui-même | 10 ans | **non garanti** | dépend du stockage et de ses sauvegardes, pas encore en place (`docs/lot-sauvegarde-cloture.md`) |

**Le vrai risque n'est pas un effacement par l'application, c'est une perte de disque.** Le fichier « fichiers-absents.txt » de la sauvegarde le dit déjà : sur son banc, un espace recréé a gardé la base et perdu les fichiers. Tant que le stockage de production n'a pas sa seconde copie, « conservé dix ans » est vrai de la base et pas des PDF.

### Un point que je corrigerais : le devis accepté à 5 ans

`src/server/retention.ts` garde un devis accepté **5 ans**. Pour un paysagiste qui construit un ouvrage (muret, terrasse, arrosage enterré), la garantie décennale court **10 ans** à compter de la réception, et le devis signé est ce qui prouve ce qui était commandé. Je recommande de l'aligner sur 10 ans. Confiance moyenne : c'est une lecture juridique, à faire confirmer par son expert‑comptable ou un juriste ; ce qui la ferait changer, c'est un avis contraire de leur part. Le coût de se tromper dans ce sens est faible (on garde un peu plus).

Ce changement touche l'effacement d'un client : lot à part, niveau 3.

## 3. La notification à l'échéance

**Refusée pour l'instant, et voici pourquoi.**

- À l'échéance, rien ne se passe en droit : la pièce **peut** être supprimée, elle ne le **doit** pas. Une alerte ne protège donc rien.
- La première facture d'Atlas atteint ses dix ans en **2036**, le premier devis accepté ses cinq ans en **2031**. Un code écrit aujourd'hui pour une date aussi lointaine ne sera éprouvé par personne.
- Le risque d'aujourd'hui est la perte, traité au §2.

**Si vous la voulez quand même**, la forme sûre : un rappel dans « Ce qui vous attend » qui dit « ces pièces ont passé leur durée légale », sans jamais rien supprimer seul. Et la date de fin est déjà calculée (`echeanceConservation`), donc l'ajout est petit le jour venu.

## Ce qui reste ouvert, et qui tranche

| Question | Qui |
|---|---|
| ~~A, B ou C pour la place du bouton~~ | **A**, codé le 22 octobre 2026 |
| ~~Fiches en PDF dans le fichier~~ | **oui**, codé le 22 octobre 2026 |
| ~~Salariés autorisés ou non~~ | tranché par la règle des portes, voir §1 |
| Devis accepté : 5 ou 10 ans | le patron, après avis de son expert‑comptable |
| Seconde copie du stockage de production | le patron (`docs/lot-sauvegarde-cloture.md` §13) |
