# La facture électronique comprise dans Cause

*Sa décision du 23 novembre 2026 : « il faut faire C ». Cause paie une
plateforme agréée et la met dans son prix ; l'artisan n'ouvre rien ailleurs.
Recherche faite le même soir, sur les sites des plateformes et sur la liste
officielle des impôts.*

## Sommaire

1. [Le verdict](#le-verdict)
2. [Ce que ça coûte](#ce-que-ça-coûte)
3. [Ce qui a été vérifié, et où](#ce-qui-a-été-vérifié-et-où)
4. [Les autres](#les-autres)
5. [Ce qui reste à toi, dans l'ordre](#ce-qui-reste-à-toi-dans-lordre)
6. [Ce qui change dans Cause, pour nous](#ce-qui-change-dans-cause-pour-nous)
7. [Ce que je ne sais pas](#ce-que-je-ne-sais-pas)
8. [Ce qui a été dit et se révèle faux](#ce-qui-a-été-dit-et-se-révèle-faux)
9. [Ce qui reste ouvert, et qui le tranche](#ce-qui-reste-ouvert-et-qui-le-tranche)

## Le verdict

**Super PDP**, avec Iopole en solution de secours.

| | Super PDP |
|---|---|
| immatriculée | oui, le 22 décembre 2025 (liste officielle de la DGFiP, page mise à jour le 23 novembre 2026) |
| prix publics | 0,01 € HT par facture jusqu'à 10 000 par mois, 0,005 € jusqu'à 100 000, 0,0025 € au-delà ; vérification d'identité 2 € HT ; minimum 10 € HT par an |
| pour un éditeur | « marque grise » : Cause paie le tarif de gros et refacture comme il veut ; le nom Super PDP apparaît à l'inscription de l'artisan ; marque blanche sur demande |
| la norme commune | oui : l'API AFNOR XP Z12-013 « Flow » en version 1.3.0, celle sur laquelle le branchement de Cause a été écrit |
| plusieurs artisans | chaque artisan donne son accord sur Super PDP (OAuth), Cause agit ensuite pour lui |
| ce qu'elle fait | émission, réception, statuts, e-reporting (dont les ventes aux particuliers), annuaire, archivage 10 ans |
| où | hébergée en France, ISO 27001, certifiée Peppol |

## Ce que ça coûte

| | par mois |
|---|---|
| un artisan qui fait 40 factures, chez Super PDP payé par Cause | **0,40 € HT**, plus 2 € HT une seule fois |
| le même artisan avec Pennylane Essentiel et une clé collée | **24 €**, payés par lui |

À ce prix, la plateforme se met dans l'abonnement de Cause sans le changer.

## Ce qui a été vérifié, et où

| fait | source | sûr ? |
|---|---|---|
| immatriculation de Super PDP, Iopole, B2Brouter, Pennylane, Seqino, Docoon, Serensia, Cecurity | fichier officiel `liste_pa_attente_rapport_audit.xlsx`, impots.gouv.fr | oui |
| prix, marque grise, marque blanche sur demande | superpdp.tech/tarifs | oui, lu le 23 novembre ; un prix peut changer |
| la norme AFNOR 1.3.0, adresse `https://api.superpdp.tech/afnor-flow`, jeton `https://api.superpdp.tech/oauth2/token` | contrat OpenAPI publié par Super PDP | oui |
| mêmes chemins que Cause : `/v1/healthcheck`, `/v1/flows`, `/v1/flows/{id}` | ce contrat, comparé à `src/server/plateformes/api-commune.ts` | oui |
| accès refusé (403) tant que la vérification de l'artisan n'est pas finie | leur documentation, rubrique « sessions » | oui |
| e-reporting des particuliers rempli à partir des factures B2C | leurs notes de version (1.26.0) | oui |
| un environnement d'essai (« sandbox ») existe | leur API le nomme | **ses conditions d'accès, non** |

## Les autres

| | ce qu'elle est | pourquoi pas en premier |
|---|---|---|
| **Iopole** | plateforme pour éditeurs | prix sur devis ; paliers pensés pour 5 000 et 10 000 factures par mois ; marque blanche au plus haut palier seulement. **Le secours** |
| **B2Brouter** | plateforme, offre API pour éditeurs | prix sur devis |
| **FactPulse** | une couche entre le logiciel et une plateforme | fabrique la Factur-X, ce que Cause fait déjà, et passe quand même par une plateforme ; 29 €/mois pour 500 factures. Écartée |
| **Pennylane** | plateforme, et logiciel de comptabilité | son API ne s'ouvre qu'en Essentiel. Gardée pour plus tard, pour l'artisan déjà chez Pennylane |
| Seqino, Docoon, Serensia, Cecurity | plateformes avec une offre marque blanche | non regardées en détail |

## Ce qui reste à toi, dans l'ordre

1. **Écrire à Super PDP**, contact@superpdp.tech, le message ci-dessous.
2. **Écrire à Iopole**, contact@iopole.com, pour un devis de secours.
3. Avec l'accès d'essai de Super PDP, me dire « go ».

### Le message pour Super PDP

*Réécrit le 23 novembre, à sa demande : l'objet, et la question de
l'agrément de Cause en marque blanche (`docs/faire-agreer-cause.md`).*

> **Objet : Intégration de SUPER PDP dans un logiciel pour artisans (marque grise)**
>
> Bonjour,
>
> Je suis artisan et je développe Cause, un logiciel de gestion pour artisans
> (devis, chantiers, factures). Je souhaite proposer à mes utilisateurs la
> facture électronique avec SUPER PDP, en marque grise : chaque artisan
> ouvrirait son compte SUPER PDP depuis Cause par votre flux OAuth, et Cause
> paierait le service au tarif de gros.
>
> Côté technique, Cause fabrique déjà des Factur-X au profil EN 16931 et parle
> l'API AFNOR XP Z12-013 Flow 1.3.0, que j'ai vue dans votre documentation.
>
> J'aurais quelques questions :
>
> 1. Pouvez-vous m'ouvrir un accès sandbox et enregistrer une application
>    OAuth pour Cause ?
> 2. Le tarif de gros est-il celui de votre page Tarifs (0,01 € HT par facture
>    jusqu'à 10 000 par mois) ? La vérification KYC/KYB à 2 € HT est-elle
>    facturée à Cause ou à l'artisan ?
> 3. Quel contrat signons-nous ensemble, et quelles conditions l'artisan
>    accepte-t-il de son côté ?
> 4. Les factures aux particuliers déposées par l'API (processingRule B2C)
>    alimentent-elles bien l'e-reporting de l'artisan ?
> 5. L'artisan reçoit-il ses factures fournisseurs sur ce même compte, et
>    Cause peut-il les lire par l'API ?
> 6. À quelles conditions proposez-vous la marque blanche ? Et accompagnez-vous
>    un éditeur qui voudrait, plus tard, demander sa propre immatriculation en
>    s'appuyant sur votre plateforme ?
>
> Je suis disponible pour un appel si c'est plus simple.
>
> Merci d'avance,
>
> [Prénom Nom]
> [Téléphone]

### Le message pour Iopole

> Bonjour,
>
> Je développe Cause, un logiciel de gestion pour artisans, qui fabrique déjà
> des Factur-X EN 16931 et parle l'API AFNOR XP Z12-013. Je cherche une
> plateforme agréée en marque grise ou blanche, payée par Cause pour ses
> clients. Au départ, quelques centaines de factures par mois.
>
> Pouvez-vous m'envoyer un devis pour ce volume, et m'ouvrir votre sandbox ?
> Votre API suit-elle la norme XP Z12-013 Flow 1.3.0 ?
>
> Merci.

## Ce qui change dans Cause, pour nous

Rien n'est codé. Une fois l'accès d'essai obtenu :

| | |
|---|---|
| le catalogue | Super PDP remplace Pennylane en tête (`catalogue.ts`), avec ses deux adresses |
| relier | un bouton qui ouvre Super PDP à la place des deux cases à remplir ; l'accord revient à Cause, le jeton est gardé chiffré |
| l'attente | un état « vérification en cours » tant que Super PDP vérifie l'identité de l'artisan |
| les particuliers | le dépôt part aujourd'hui en B2B seulement ; les factures aux particuliers pourront partir en B2C pour l'e-reporting (obligatoire pour les petites entreprises en septembre 2027). À trancher au moment de coder |
| la réception | obligatoire depuis le 1er septembre 2026 : les factures fournisseurs arrivent sur le compte Super PDP de l'artisan ; les montrer dans Cause est un lot à part |
| l'écran | Réglages, Facture électronique change : **planche d'abord** (`CLAUDE.md` §3 bis) |
| le niveau | 3 : argent, secret, migration ; batterie complète avec ton oui |

## Ce que je ne sais pas

- les conditions du contrat éditeur : durée, préavis, ce qui arrive si Super
  PDP ferme ou change ses prix ;
- si le tarif de gros est exactement la grille publique ;
- l'accès à leur environnement d'essai.

**Ce qui protège si Super PDP disparaît** : un artisan peut changer de
plateforme quand il veut (règle de la réforme), et le branchement de Cause
suit la norme commune. Passer à Iopole ou à B2Brouter, ce serait un nouveau
contrat et deux adresses à changer, sans tout recoder.

## Ce qui a été dit et se révèle faux

- Ce soir, j'ai d'abord écrit que le cadenas de « Connectivité » fermait la
  page. Ta seconde capture montre que la page s'ouvre, mais sans l'onglet
  Développeurs. La conclusion tenait (pas de clé sur ta formule), la raison
  était mal dite.
- `ARCHITECTURE.md` §424 prévoyait « un connecteur par outil ». Avec une
  plateforme qui suit la norme commune, un seul branchement sert pour toutes
  celles qui la suivent.

## Ce qui reste ouvert, et qui le tranche

| | qui |
|---|---|
| la réponse de Super PDP (contrat, sandbox, prix de gros) | Super PDP, sur ton message |
| un devis de secours | Iopole |
| B2C pour l'e-reporting, et les factures reçues dans Cause | toi, au moment de coder |
| l'artisan déjà chez Pennylane ou une autre plateforme | plus tard |
