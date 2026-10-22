# Tout télécharger d'un client, et la conservation dix ans

*Lecture du 22 octobre 2026. Rien n'est codé dans `src/` : la planche attend ses choix.*

## En cinq lignes

1. **Le bouton se fait** en reprenant ce qui existe déjà : l'archive zip de « Télécharger mes données » et son rangement par dossier. Planche : `appli/telecharger-un-client.html`.
2. **Les fiches ne sont pas des PDF** aujourd'hui (ce sont des pages web). Les mettre dans le fichier demande de fabriquer leur PDF.
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

**Une question de sécurité, posée sur la planche :** les salariés. Chacun peut déjà ouvrir chaque PDF un par un ; le fichier entier n'élargit donc rien pour eux. Mais « Télécharger mes données » est réservé au patron et demande une preuve récente. Pour un seul client, je recommande : ouvert à qui voit la fiche, sans preuve supplémentaire.

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
| A, B ou C pour la place du bouton | le patron |
| Fiches en PDF dans le fichier, ou devis, factures et avoirs d'abord | le patron |
| Salariés autorisés ou non | le patron |
| Devis accepté : 5 ou 10 ans | le patron, après avis de son expert‑comptable |
| Seconde copie du stockage de production | le patron (`docs/lot-sauvegarde-cloture.md` §13) |
