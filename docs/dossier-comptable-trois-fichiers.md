# Le dossier du comptable en trois fichiers : la planche et ses vérifications

Demande du 24 novembre 2026. Planche :
https://florianmarrins0978-svg.github.io/Atlas-app/soignee/comptable-trois-fichiers.html
(fichier `appli/soignee/comptable-trois-fichiers.html`). **Rien n'est codé dans `src/`.**

## Ce que la planche montre

| Demandé | Sur la planche | Où |
|---|---|---|
| Les pages du PDF | la première page, le registre des ventes, chaque catégorie (choisie dans une liste), les salaires ; « Imprimer le PDF d'essai » sort les 34 pages | onglet Le PDF |
| L'Excel à quatre onglets | Ventes, Achats, Banque, Comptes, tels qu'Excel les ouvre ; « Télécharger l'Excel d'essai » écrit un vrai `.xlsx` (totaux en formules, dates en dates, filtres, première ligne figée) | onglet L'Excel |
| Le FEC | lu en colonnes ou tel quel (la tabulation montrée par un trait d'or) ; « Télécharger le FEC d'essai » écrit le vrai fichier | onglet Le FEC |
| Le réglage des numéros | l'écran Réglages dans le téléphone : chaque ligne s'ouvre, le numéro se change, l'intitulé du plan comptable s'affiche, une classe inattendue est signalée ; le numéro changé se retrouve dans le PDF, l'Excel et le FEC | onglet Numéros de compte |
| Un numéro par pièce, le même partout | A 181 à A 205 pour octobre ; toucher un numéro le surligne et donne sa page, sa ligne d'onglet, sa ligne de banque et ses lignes de FEC | partout |
| Le FEC officiel reste celui du comptable | écrit au dessus du FEC, et en bas de la première page du PDF | onglet Le FEC |

**Aucun texte gris** (sa demande du 24 novembre, après la première version) : les trois documents s'écrivent en noir, et ce qui doit ressortir passe par le gras ou la serif. Le vrai PDF (`src/server/pdf/dossier-comptable-pdf.ts`) écrit encore en gris : à reprendre au codage.

**Un seul jeu de données** (octobre 2026, inventé) nourrit les trois fichiers.
Vérifié sur les fichiers téléchargés, pas sur l'écran :

| Contrôle | Résultat |
|---|---|
| FEC : 18 colonnes à chaque ligne | 122 lignes sur 122 |
| FEC : chaque écriture équilibrée | 48 écritures sur 48 ; débit 44 957,83 € = crédit 44 957,83 € |
| FEC : numéros d'écriture continus et dans l'ordre des dates, par journal | oui |
| FEC : compte fournisseurs soldé (tout est lettré) | 401 à 0,00 |
| Excel ouvert par openpyxl et recalculé par LibreOffice | Ventes 12 030,00 HT, TVA 458,00 + 1 490,00, TTC 13 978,00, reste dû 6 258,00 ; balance à 0 |
| Chaque geste de la planche touché dans Chromium à 390 px | aucun muet, aucune erreur de console, aucun débordement |

## Les numéros de compte : verdict, source, confiance

Source principale : le plan de comptes PCG 2025 de l'ANC
(https://www.anc.gouv.fr/files/anc/files/1_Normes_fran%C3%A7aises/Plans%20comptables/Plan-de-comptes-PCG-2025.pdf),
lu par extraits (le site de l'ANC est bloqué depuis ce poste). **À faire relire
par un comptable avant le codage**, comme `TODO.md` le demandait déjà.

| Catégorie | Proposé | Pourquoi, et ce que disent les sources | Confiance |
|---|---|---|---|
| Ventes | **706** | 704 (Travaux) pour la création, 706 pour l'entretien : c'est l'usage, aucun texte ne tranche pour un paysagiste. 707 seulement pour des plants revendus sans pose. Réglable. | moyenne |
| Matériaux et plants | **601** | Le BOFiP (BOI-BIC-CHG-40-10 § 10) définit le **605** comme ce qui est « incorporé directement aux ouvrages » ; l'usage le plus courant reste 601. Les deux se défendent, le comptable choisit et garde. | moyenne |
| Petit outillage | **6063** | Confirmé. Le seuil de 500 € HT par outil est la tolérance de BOI-BIC-CHG-20-30-10 § 20. | haute |
| Sous-traitance | **604** | Ce qui entre dans l'ouvrage du client va au 604 ; le **611** sert au reste. Brouillon précédent : 611, corrigé. | moyenne à haute |
| Matériel de plus de 500 € | **2154** | « Matériels industriels » (pluriel en 2025, même numéro). Une remorque ou un camion va au 2182 quel que soit son prix : le matériel de transport est exclu de la tolérance. | haute |
| Carburant | **6061** | **Le 60622 n'existe pas dans le PCG** (il n'y a pas de compte 6062) : c'est un sous compte de logiciel. Du carburant stocké dans une cuve irait au 60221. | haute |
| Repas | **6256** | Repas sur un chantier : 6256 (Missions). Avec un client : 6257 (Réceptions). **Le 6251 n'est pas le bon compte pour un repas.** Pratique, pas texte. | moyenne |
| Hôtel | **6256** | Brouillon précédent : 6251, corrigé. Sa TVA ne se déduit pas (CGI ann. II art. 206 IV 2 3°, BOI-TVA-DED-30-30-10) : l'appli le fait déjà. | haute (TVA), moyenne (compte) |
| Train, taxi | **6251** | Voyages et déplacements. | haute |
| Loyer | **6132** | Locations immobilières. | haute |
| Assurances | **616** | Le 6168 de certains logiciels n'est pas dans le PCG. | haute |
| Téléphone et internet | **626** | | haute |
| Frais de banque | **627** | | haute |
| Impôts et taxes | **635** | CFE au 63511. | haute |
| TVA versée | **44551** | **Ajoutée.** Jamais au 635 : la TVA n'est pas une charge. | haute |
| Salaires | **421** | Sa décision, confirmée : le virement solde le 421 que le cabinet a crédité depuis la fiche de paie (641). | haute |
| Cotisations sociales | **431** | URSSAF des salariés. Les cotisations du patron vont au **646** : voir « ce qui reste ». | haute |
| Emprunt | **164** | La part d'intérêts (6611) se lit sur le tableau d'amortissement. | haute |
| Prélèvement personnel | **108** ou **4551** | 108 en entreprise individuelle, compte courant d'associé (4551) en société : lu dans Mon entreprise, jamais deviné. | haute |
| À classer | **471** | Compte d'attente, toujours dans le PCG 2025. | haute |
| Aide, subvention | **741** | PCG 2025 : 741 « Subventions d'exploitation » (le 74 seul ne suffit plus). | moyenne à haute |
| Entre mes comptes | **580** | Le PCG ne définit que le 58 ; 580 est l'usage, et le FEC veut trois chiffres au début du compte. | haute |
| TVA en attente du paiement | **44574** | **Absent du PCG**, mais d'usage (Qonto, Dougs) ; d'autres prennent un 4458x. Le comptable a peut être le sien : réglable. | moyenne |
| TVA due, déductible, sur immobilisations | **44571, 44566, 44562** | | haute |

### Ajoutées après sa question « est-ce qu'il ne manque rien ? » (24 novembre au soir)

**Non, il en manquait.** La première liste reprenait ses catégories ; elle
oubliait des dépenses que presque tout artisan paie. Quatorze de plus, rangées
dans Réglages par familles (le chantier, le camion et la route, l'entreprise,
vos salariés, les impôts, prêt et argent perso) :

| Catégorie | Proposé | Pourquoi, et la source | Confiance |
|---|---|---|---|
| Vêtements de travail, protection | **6063** | petit équipement non stocké ; 6068 ou 6022 (stocké) chez d'autres. [Pennylane](https://www.pennylane.com/fr/fiches-pratiques/plan-comptable/comment-comptabiliser-les-vetement-de-travail-liste-de-compte-comptable-a) | moyenne à haute |
| Location de matériel (mini pelle, nacelle, benne) | **6135** | Locations mobilières (PCG) | haute |
| Évacuation des déchets verts | **6288** | usage de praticiens, **absent du PCG** (628 n'y porte que 6281 et 6284) ; d'autres prennent le 611. [Copeps](https://copeps.fr/actualites/comptabilisation-decontamination-produits/) | basse |
| Entretien et réparations (garage, pneus, tondeuse) | **6155** | Entretien et réparations sur biens mobiliers (PCG) | haute |
| Leasing du camion | **6122** | Crédit bail mobilier ; une location longue durée sans achat va au 6135 | haute |
| Électricité, eau, gaz du dépôt | **6061** | Fournitures non stockables, comme le carburant | haute |
| Fournitures de bureau | **6064** | Fournitures administratives ; les timbres au 626 | haute |
| Logiciels et abonnements | **6135** | les sources hésitent (613, 6135, parfois 6281) ; le 651 est pour une licence, pas un abonnement. [Pennylane, 6135](https://www.pennylane.com/fr/fiches-pratiques/plan-comptable/compte-6135-locations-mobilieres), [Finom](https://finom.co/fr-fr/blog/comptabiliser-abonnement-logiciel/) | moyenne |
| Publicité | **623** | Publicité, publications, relations publiques | haute |
| Honoraires (comptable, avocat) | **6226** | Honoraires | haute |
| Cotisations professionnelles | **6281** | Concours divers, cotisations | haute |
| Formation (CACES, Certiphyto) | **6228** | facture de l'organisme ; la contribution OPCO va au 6333. [Pennylane](https://www.pennylane.com/fr/fiches-pratiques/plan-comptable/comment-comptabiliser-les-frais-de-formation-professionnelle) | moyenne |
| Retraite, prévoyance, mutuelle des salariés | **437** | Autres organismes sociaux | haute |
| Impôt prélevé sur les salaires | **4421** | Prélèvements à la source ; la DGFiP le prélève chaque mois. **Sans cette catégorie, il tombait dans Impôts et taxes (635), comme une charge.** [Dougs](https://www.dougs.fr/ressources/pcg/classe-4/compte-4421/), [net-entreprises](https://www.net-entreprises.fr/media/documentation/guide-dsn-pas.pdf) | haute |

Retouchés dans la même passe : « Petit outillage » devient **« Petit outillage,
petites fournitures »** (vis, colliers, ficelle : même 6063) ; « Train, taxi »
couvre aussi **péages et parking** (6251) ; les **agios** d'un découvert vont au
**6615**, pas avec les frais de banque.

**Le paysage cotise à la MSA, pas à l'URSSAF** (code rural, L. 722-1 et L. 722-2 ;
[réponse ministérielle](https://questions.assemblee-nationale.fr/dyn/12/questions/QANR5L12QE33996.pdf)) :
la ligne d'essai de la planche était fausse pour un paysagiste, elle est
corrigée. Le compte (431) ne change pas.

**Toujours pas couvert, et dit tel quel :** des plants revendus sans pose
(achat 607, vente 707), les cadeaux aux clients (6234), les amendes (non
déductibles). Ils tombent en À classer, et le comptable les range.

## Le FEC : ce qui est normé, et ce que Cause en fait

Textes : article A47 A-1 du LPF, BOI-CF-IOR-60-40-20 (lu en entier).

| Point | La norme | Le fichier de Cause |
|---|---|---|
| Colonnes | 18, dans cet ordre : JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, Montantdevise, Idevise | les 18 |
| Séparateur | tabulation ou barre verticale, un seul par fichier ; noms des champs en première ligne | tabulation, en-tête |
| Dates | AAAAMMJJ | AAAAMMJJ |
| Montants | virgule décimale, aucun séparateur de milliers ; Debit et Credit tous deux remplis | « 1284,00 » et « 0,00 » |
| Champ vide | reste vide, jamais « 0 » ni une espace | Montantdevise, Idevise vides |
| Encodage | ASCII, ISO 8859-15 ou EBCDIC. Pennylane dit UTF-8 : les sources divergent | **ISO 8859-15**, le texte légal |
| Nom | `SirenFECAAAAMMJJ`, la date étant la clôture de l'exercice | **`123456789_import_FEC_2026-10.txt`**, exprès : voir ci-dessous |
| ValidDate | la date de validation de l'écriture | **vide** : les écritures se valident dans le logiciel du comptable, pas dans Cause |

**Pourquoi le fichier de Cause n'est pas « le » FEC.** Le BOFiP (§ 40) définit le
FEC comme le livre journal unique de l'exercice, couvrant tous les journaux du
système comptable, avec les à nouveaux et les écritures d'inventaire (§ 50). Une
appli de facturation n'en tient qu'une partie et ne fait aucune clôture.
Pennylane l'écrit pour ses propres exports : ils « n'ont pas la valeur
réglementaire d'un FEC ». Le fichier de Cause est donc un **fichier d'import au
format FEC**. Lui donner le nom légal l'aurait fait passer pour le FEC de
l'exercice : il porte un nom à lui.

**Les écritures.** Trois journaux : VT les ventes (client au 411, TVA en attente
au 44574), HA les achats qui ont une pièce de fournisseur (lettrés avec leur
paiement), BQ la banque. Au paiement d'un client, la TVA de ce qui est payé passe
du 44574 au 44571, au prorata pour un paiement partiel : c'est la règle de
l'exigibilité aux encaissements que `src/lib/exigibilite-tva.ts` applique déjà.

## Ce que font les autres

| Outil | Ce qui en est retenu |
|---|---|
| Pennylane | export FEC en `.txt` tabulé dans un ZIP, avec en option les pièces **nommées par leur PieceRef**. Ses exports vers d'autres logiciels n'ont pas valeur de FEC, le logiciel d'arrivée produit le légal. |
| Qonto | CSV, XLSX, FEC ; les pièces jointes dans un ZIP, leur nom dans une colonne ; plan de comptes réglable par l'utilisateur (ajout à la main ou import CSV). |
| Tiime | le comptable travaille dans Tiime Expert ; vers Quadra, **un numéro de pièce de 8 caractères au plus, sans « / »**. |
| Indy | FEC, grand livre et journal téléchargeables ; le réglage des comptes par l'utilisateur n'a pas pu être confirmé. |

Les quatre se rejoignent : un fichier d'écritures, les pièces à côté nommées par
leur numéro, une correspondance catégorie et compte que l'utilisateur règle, et
le FEC légal laissé au logiciel comptable.

## Fait autrement que demandé, et pourquoi

| Demandé ou supposé | Fait | Pourquoi |
|---|---|---|
| « Matériel » reste une catégorie | partagé en trois : matériaux et plants, petit outillage, matériel de plus de 500 € | ses trois nouvelles catégories le recouvrent en entier |
| Hôtel au 6251 (brouillon d'une session précédente) | 6256 | usage des sources lues |
| Sous-traitance au 611 (même brouillon) | 604 | BOFiP : ce qui entre dans l'ouvrage |
| Le fichier s'appelle « le FEC » | il garde ce nom à l'écran, mais son nom de fichier n'imite pas le légal | ne jamais laisser croire au FEC de l'exercice |

## Ajouté sans demande

- **TVA versée (44551).** Sans elle, le paiement de la TVA tombait dans Impôts et taxes (635) et passait pour une charge.
- **Les autres entrées** (apport, prêt reçu, aide, entre mes comptes, remboursement) : le FEC ne peut pas laisser une ligne de banque sans compte, et l'appli connaît déjà ces motifs (`MOTIFS_RECUS`).
- **La TVA en attente du paiement (44574)**, pour suivre l'exigibilité aux encaissements.

## Ce qui reste ouvert, et qui le tranche

| Point | Qui |
|---|---|
| La liste des numéros, relue une fois | son comptable |
| Cotisations du patron (646) et des salariés (431) dans une seule catégorie : le comptable sépare, ou Cause en fait deux | lui |
| L'autoliquidation d'un sous-traitant (clôture, terrassement) : facture sans TVA, le FEC doit l'ajouter des deux côtés. Aucun texte ne nomme l'aménagement paysager ; l'élagage seul n'y est pas soumis (rescrit BOI-RES-TVA-000269 du 9 septembre 2026) | à vérifier avec son comptable avant le codage |
| Les photos des pièces nommées A 189, A 190, en plus des trois fichiers, comme Pennylane | lui |
| Un numéro de facture comme `F-2026-041` fait 10 caractères : Quadra en refuse plus de 8 | à vérifier si son comptable est sur Quadra |
| Où se posent les trois fichiers dans Pour mon comptable | la planche suivante, sur son vrai écran |

**Vu en lisant les sources, hors de ce lot :** l'appli ne déduit pas la TVA d'un
repas sans client (`src/lib/achat-tva.ts`, « repas perso, 0 % »). Le repas d'un
salarié sur un chantier n'est ni « perso » ni « d'affaires » : la règle peut
faire perdre une TVA déductible. Non tranché ici, à regarder avec son comptable.

## Limites de la vérification

Légifrance, l'ANC, impots.gouv.fr et les sites de Pennylane et des cabinets
étaient bloqués depuis ce poste : seul le BOFiP a été lu en entier. Le reste
vient d'extraits de moteur de recherche de ces pages. Les verdicts « moyenne »
sont ceux où les sources se contredisent.
