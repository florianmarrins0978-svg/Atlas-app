# État du projet

**Dernière mise à jour :** 2026-08-20 · branche `main`
· dernière migration `drizzle/0055_passage_entretien.sql`

*(Le numéro du dernier commit ne figure plus ici : il était faux dès le commit
suivant, et une ligne fausse coûte plus cher qu'une ligne absente. `git log
--oneline -20` le dit sans risque de se tromper.)*

Ce fichier dit **où en est le produit**, pas ce qu'on aimerait qu'il soit. Une
ligne « fait » qui ne l'est pas coûte plus cher qu'une ligne absente.

---

## Ce qu'est Atlas

**La direction, dans ses mots (13 août 2026) :** *« créer un deuxième cerveau au
sein de l'application, pour qu'elle s'utilise comme un assistant de gestion /
devis, facture, planning. Elle doit apprendre, enregistrer, s'améliorer,
s'auto-alimenter. »*

**Ce qui apprend déjà :** la mémoire des prix facturés (`lecons_prix`), les cinq
grilles (remplies par les devis réels), la base documentaire. **Ce qui ne retient
rien, par ordre de poids :** le temps réel d'un chantier — donc Atlas ignore si
ses estimations de durée sont justes, alors que c'est la durée qui fait le prix —,
les coûts de chiffrage, les délais de paiement réels, et ce qu'un client refuse.
Le détail est dans `ARCHITECTURE.md` §90 et `docs/QUESTIONS.md` §17.

**La leçon qui commande ce chantier :** `historique_prix` était lue et jamais
écrite. Devant toute idée d'apprentissage, la question n'est pas « avons-nous une
table ? » mais **« qui l'écrit, et à quel moment du parcours ? »**

Un agent au service de l'artisan patron, « comme un comptable » : il prépare les
devis, les envoie au client avec une proposition de date, recueille la réponse,
planifie le chantier, construit la facture à la fin, et tient le relevé de TVA
collectée.

Le parcours complet et ses points d'arrêt sont décrits dans **`docs/AGENT.md`** —
c'est le document de référence du produit.

**Trois arrêts, décidés et non négociables :**

1. Avant l'envoi du devis — une seule question : *une date, ou deux au choix du
   client ?*
2. À la réponse du client — le chantier se planifie, ou revient au patron.
3. Avant le départ de la facture — *rien n'a changé depuis le devis ?*

---

## Terminé et vérifié

**Chercher un client (20 août 2026).** La liste des clients porte une barre de
recherche : il tape un nom, la liste se réduit à chaque frappe. Sans accents,
sans casse, sans ponctuation, et dans n'importe quel ordre de mots. Règle pure
dans `src/lib/recherche-client.ts` (`ARCHITECTURE.md` §134), éprouvée sans
navigateur **et** au navigateur.

### Le socle (antérieur à cette série de travaux)

Chantiers, photos, note vocale, transcription, informations structurées, calcul
du prix, devis PDF, planning, catalogue, réglages tarifs. Authentification
(Auth.js), isolation par entreprise (RLS `FORCE`), stockage de fichiers,
limitation de débit, purge planifiée, journalisation. Assistant IA en lecture
seule avec quinze outils.

### Le parcours entretien : modèle → passage → rapport

Le troisième parcours du produit, à côté de devis → facture. Demandé le 16 août
2026, arbitré sur maquettes, codé les 16 et 18. Le récit complet, les décisions
et ce qui a été écarté : `ARCHITECTURE.md` §128.

| Brique | Où c'est |
|---|---|
| Le modèle de fiche — **un seul par entreprise**, jamais rangé par client | `src/server/repositories/prestations-entretien.ts` (migration `0051`) |
| L'écran où il le compose, retrait réversible | `src/app/reglages/fiche-entretien/` |
| Les règles pures du passage — repli sur le client, temps, empêchements d'envoi | `src/lib/passage-entretien.ts` |
| Le passage et ses lignes **copiées** du modèle | `src/server/repositories/passages-entretien.ts` (migration `0055`) |
| L'outil, dans l'onglet Paysage : ouvrir, cocher, nommer le client, envoyer | `src/app/paysage/fiche/` |
| La page que le client reçoit, lue par jeton sans session | `src/app/entretien/[jeton]/` |

**Trois invariants à ne pas rouvrir :**

- **un rapport parti ne change plus jamais** — les lignes et le nom du client
  sont copiés, pas relus. C'est ce qui en fait une preuve de passage ;
- **le client ne lit que ce qui a été fait**, et le tri est en base ;
- **rien ne part tout seul** : le message se prépare, il l'envoie de sa
  messagerie (`docs/A-FAIRE.md` §5).

**Ce qui n'est PAS fait, et qu'il ne faut pas annoncer** : le PDF du rapport, et
le bouton « J'ai bien reçu » horodaté sur la page du client.

### Le parcours devis → facture

| Brique | Où c'est |
|---|---|
| Envoi du devis au client, une ou deux dates | `src/app/chantiers/[id]/export/EnvoiAuClient.tsx` |
| Canal de communication recueilli à la création du chantier | `src/app/chantiers/nouveau/` |
| Jours libres du patron, calculés une seule fois pour tous les usages | `src/server/disponibilites.ts` |
| Page publique de réponse du client (sans session) | `src/app/devis/[jeton]/` |
| Cycle d'envoi, jeton, expiration, réponse | `src/server/repositories/envois-devis.ts` |
| Suivi de ce que devient le devis (5 états) | `src/lib/etat-envoi.ts` |
| Statut affiché d'un chantier, de brouillon à facturé | `src/lib/chantier-etat.ts` |
| Retoucher le devis à la voix — elle propose, il coche (15 août) | `src/lib/retouches-devis.ts`, `src/server/ai/services/retouches-devis-service.ts`, `src/app/chantiers/[id]/devis-complet/DicterDansLeDevis.tsx` |
| **Et DICTER le chantier dans le devis** (20 août) — il raconte les travaux, hésitations comprises, et obtient des lignes rédigées avec leurs mesures. Aucun prix inventé. La rédaction dépend d'un modèle : `npm run verifier:dictee` la vérifie **là où il y a une clé**, et refuse de rendre un vert sans (`ARCHITECTURE.md` §113) | `src/lib/redaction-lignes.ts`, `src/lib/unites-tarif.ts`, `scripts/verifier-dictee-devis.mts` |
| Le prix accordé au client — remise en % sous le total, jusqu'à la facture (16 août) | `src/lib/reduction-devis.ts`, migration `0048` |
| La fiche d'un client — ses chantiers, ce qu'il doit, ce qu'on lui fait (16 août) | `src/lib/fiche-client.ts`, `src/app/clients/[id]/page.tsx` |
| **Un client est RETROUVÉ, plus recréé** à chaque chantier — rapprochement automatique, refusé si une coordonnée contredit (17 août) | `src/lib/rapprochement-client.ts`, `trouverOuCreerClient` |
| **Et il se RETIRE pour de bon** (17 août) — un « − » en face de la ligne (sa proposition B), écrire 0 %, vider la case, ou le dire à la voix. Les deux derniers chemins étaient cassés : l'écran gardait une remise que la base n'avait plus, et la réécrivait au passage suivant (`ARCHITECTURE.md` §120) | `src/app/chantiers/[id]/devis-complet/` |
| Notification « devis retourné » à l'accueil | `src/app/Notifications.tsx` |
| Reprise d'un devis retourné en nouvelle version | `src/app/chantiers/[id]/export/actions.ts` |
| Onglet « Terminés » et fin de chantier | `src/app/termines/` |
| Facture bâtie depuis le devis, arrêt 3 | `src/app/chantiers/[id]/facture/` |
| **Facture transmise par SMS ou par e-mail**, au choix, coordonnée saisie sur place | `src/app/chantiers/[id]/facture/TransmettreLaFacture.tsx` |
| **Facture téléchargeable**, sous un nom qui porte son numéro | `src/app/api/factures/[id]/pdf/route.ts` |
| **Chemin du planning vers la facture**, et rangement en un seul onglet | `src/lib/onglet-chantier.ts`, `src/app/planning/PlanningClient.tsx` |
| Installation sur téléphone : icône, plein écran, marges de sécurité | `src/app/layout.tsx`, `src/app/globals.css`, `scripts/generer-icones.mjs` |
| Relevé de TVA collectée, par trimestre | `src/app/termines/tva/` + `src/server/trimestre.ts` |
| Devis PDF reprenant le modèle du patron, sur autant de pages qu'il faut | `src/server/pdf/devis-pdf.ts` |
| Découpage de la dictée en prestations, matériel, déchets, durée, équipe | `src/server/orchestrateur/analyse-demande.ts` |
| Planning en demi-journées et nombre d'équipes (le client ne voit que la date) | `src/server/disponibilites.ts` + `drizzle/0019_creneaux_et_equipes.sql` |
| Correction demandée par le client, avec son message porté au patron | `src/app/devis/[jeton]/formulaire.tsx` + `src/lib/etat-envoi.ts` |
| Écrire le devis soi-même, sans passer par la proposition de prix | `src/app/chantiers/[id]/informations/InformationsClient.tsx` → `prix?saisie=manuelle` |
| Transmission au client : messagerie ouverte **au bon destinataire**, canal changeable, coordonnée saisissable sur place | `src/app/chantiers/[id]/export/TransmettreAuClient.tsx` |
| **Le contact manquant se saisit dans la feuille d'envoi**, au lieu de renvoyer vers un écran retiré du tiroir (11 août 2026, `ARCHITECTURE.md` §62) | `src/app/chantiers/[id]/export/EnvoiAuClient.tsx` |
| **De la dictée au devis en un seul geste** : prestations, durée, équipe, prix, devis | `src/server/services/devis-depuis-dictee.ts` + `src/app/chantiers/[id]/DevisDepuisDictee.tsx` |
| La dictée est lue mot à mot quand aucun modèle ne répond — et l'écran le dit | `src/server/ai/lecture-litterale.ts` + `drizzle/0021_lecture_dictee.sql` |
| Rédiger le devis **entièrement à la main**, depuis la fiche du chantier | `src/app/chantiers/[id]/page.tsx` → `prix?saisie=manuelle` |
| Durée du chantier à la molette (½ journée → 100 jours), sur les deux écrans | `src/lib/durees-chantier.ts` + `src/app/chantiers/[id]/BandeDuree.tsx` |
| L'espace d'essai se met à jour seul, et l'application annonce sa version | `.devcontainer/mettre-a-jour.sh` + `src/server/version-executee.ts` |
| Créer un chantier sans rien saisir : son nom se déduit du client, de l'adresse, ou de la date | `src/lib/nom-chantier.ts` |
| **Le devis écrit à la main, document entier** : émetteur, IBAN, client, quantités, prix unitaires, TVA, conditions | `src/app/chantiers/[id]/devis-complet/` |
| **Emporter toutes ses données**, en un appui : un ZIP avec les 26 tables, les photos, les enregistrements et les PDF | `src/server/repositories/export-entreprise.ts` + `src/app/api/mes-donnees/` + `src/lib/archive-zip.ts` |
| **L'agent s'arrête et demande ce qui fait le prix** (technique, diamètre), et se tait sur le reste | `src/lib/questions-chiffrage.ts` + `drizzle/0022_precisions_chantier.sql` |
| **Il retient ce que le patron chiffre**, et le lui rappelle sur le chantier comparable suivant | `src/lib/lecons-prix.ts` + `drizzle/0023_lecons_prix.sql` |
| **L'adresse se propose pendant la frappe** et se choisit d'un doigt — Base Adresse Nationale, jamais Google, et le champ reste libre | `src/components/atlas/ChampAdresse.tsx` + `src/server/adresses/base-adresse-nationale.ts` |
| **La note vocale lit un numéro et un e-mail dictés en toutes lettres**, sans qu'il ait à les annoncer | `src/lib/nombres-dictes.ts` + `src/lib/coordonnees-dictees.ts` |
| **L'agenda extérieur, au choix de l'artisan** — Atlas tient compte d'un agenda Google s'il le relie, lit ses créneaux occupés **et leurs intitulés**, et les affiche sur le planning. Ses identifiants Google se collent dans l'application. Sans raccordement, rien ne change | `src/lib/agenda-externe.ts` + `src/server/agenda/` + `src/app/reglages/agenda/` + `drizzle/0032_agendas_externes.sql` + `drizzle/0033_identifiants_google_par_entreprise.sql` |
| **L'agenda iCloud, dans les deux sens** — Atlas lit les créneaux occupés du compte Apple et **n'y propose plus** de date ; s'il l'allume, il pose ses chantiers dans le calendrier qu'il désigne et les retire quand il déplanifie. Les deux fournisseurs se fondent en une seule carte d'occupation. **Réserve : aucun échange réel avec iCloud n'a eu lieu ici** (réseau refusé) — voir `ARCHITECTURE.md` §75 | `src/lib/ics.ts` + `src/lib/caldav.ts` + `src/server/agenda/apple.ts` + `src/server/repositories/agenda-apple.ts` + `drizzle/0035_agenda_apple.sql` |
| **Le vocabulaire du métier**, écrit une fois et envoyé avec chaque dictée — réservé à l'éditeur. Vingt-sept entrées tirées de devis réels (huit règles, dix-neuf mots) ; budget de 9 000 caractères dont un quart réservé à ses corrections, et tout tient aujourd'hui à cinq cents caractères près | `src/app/reglages/vocabulaire/` + `src/lib/consigne-metier.ts` + `drizzle/0030_vocabulaire_devis_reels.sql` + `drizzle/0031_vocabulaire_corrige.sql` |
| **Le devis se découpe en lignes vendables** : abattage + broyage + évacuation ensemble, la fente à part, sans point-virgule | `src/lib/lignes-vendables.ts` |
| **Cinq grilles de prix** — abattage (technique × diamètre), fendage (hauteur × diamètre), dessouchage (diamètre), haie (au ml), grumes (à la tonne) — nées vides et remplies par ses devis | `src/lib/grille-prix.ts` + `src/app/reglages/prix/` + `drizzle/0029_grumes_a_la_tonne.sql` |
| **Le retour de la messagerie ramène à l'accueil**, avec un mot qui dit ce qui a été transmis | `src/lib/annonce-transmission.ts` + `src/components/atlas/AnnonceTransmission.tsx` |
| **Proposer une date jusqu'à 18 mois**, sans montrer au client plus de trois semaines autour | `src/server/disponibilites.ts` (`fenetrePatron`, `bandesVisibles`) |
| **Un calendrier des deux côtés**, où les jours déjà pris sont barrés et ne se choisissent pas | `src/lib/calendrier.ts` + `src/components/atlas/Calendrier.tsx` |
| **Déposer sa liste de prix Excel ou CSV**, avec aperçu avant écriture | `src/app/reglages/ImportTarifs.tsx` + `src/lib/import-tarifs.ts` + `src/server/import/lire-classeur.ts` |
| **La TVA quand le client PAIE, et non quand la facture part** — le relevé se calcule sur la date du règlement (défaut légal d'une prestation de services, CGI art. 269-2-c) ; les factures parties attendent dans « Ma TVA » et y entrent d'un appui. Les acomptes n'apportent que leur part. Réglage encaissements / débits. Le passé ne bouge pas : la migration a supposé réglées les factures déjà émises, et le dit (`ARCHITECTURE.md` §110) | `src/lib/exigibilite-tva.ts` + `src/server/repositories/paiements-facture.ts` + `src/app/termines/tva/` + `drizzle/0045_paiements_et_exigibilite.sql` |
| **Ses tranches et ses travaux, au lieu des nôtres** — les diamètres, les hauteurs, les façons d'abattre et les travaux s'ajoutent et se retirent (écran « Mes prix » et écran « Mes mesures »). Retirer n'efface aucun prix : les cases sont rangées et reviennent. Un travail ajouté n'est PAS reconnu par le chiffrage depuis une dictée, et l'écran le dit (`ARCHITECTURE.md` §105) | `src/lib/grille-prix.ts` + `src/server/repositories/grilles-reglables.ts` + `src/app/reglages/prix/` + `drizzle/0041_tranches_et_natures_de_grille.sql` |
| **L'unité d'un tarif se CHOISIT** dans un bandeau déroulant (jour/homme, m², ml, heure, forfait, tonne, « aucune ») — la case reste libre pour le stère et l'arbre. Ce qu'elle évite : le rapprochement se fait à la lettre près, et « jours/homme » mal tapé faisait cesser la multiplication en silence (`ARCHITECTURE.md` §101) | `src/lib/unites-tarif.ts` + `src/components/atlas/ChoixUnite.tsx` + `src/app/reglages/ReglagesClient.tsx` |

### Le plan d'arrosage automatique — ESSAYABLE le 17 août 2026, rien n'est codé

**Du croquis au plan, sa demande du 18 août :** *« une fois que j'ai envoyé la
photo, il y a le petit encart où on choisit la marque. Tout ce qu'il y a en
dessous, tu peux le supprimer. Et tu me fais le plan en couleur avec les
différents réseaux [...] et la liste des pièces à acheter. »*
→ **`appli/arrosage-croquis.html`** : un seul écran de saisie (la photo, la
marque), puis le plan en couleur et les pièces rangées en casiers. La lecture de
la photo y est **simulée**, et la page le dit en rouge ; le plan et la liste,
eux, sont vraiment calculés.

**Le calcul est commun aux deux pages : `appli/arrosage-calcul.js`.** Il n'a pas
été recopié — cette liste est ce qu'il commande chez son fournisseur, et deux
versions qui divergent font deux camions de pièces (`ARCHITECTURE.md` §126).

**La page qui calcule pour de bon : `appli/arrosage.html`**, publiée avec
l'appli, donc ouvrable au téléphone. Point d'eau, zones, secteurs, durées par
saison, plan et liste du matériel : tout se refait à chaque frappe.

**Sa décision sur la sortie, le 17 août :** *« il faut simplement créer le plan
et la liste du matos à acheter, ensuite moi j'envoie à mes fournisseurs, ils me
font un devis, puis je repasse par le circuit normal de l'application. »* Donc
**aucun prix** dans cet outil — le devis client emprunte le parcours qui existe.

### Le raisonnement, en trois planches sans JavaScript

**Sa demande :** *« un outil pour les paysagistes pour réaliser des plans
d'arrosage automatique. »* Terrain neuf : le produit ne parlait pas d'arrosage.

Trois planches, **aucune ligne de `src/`** : `docs/maquettes/69` (par où il entre
son jardin : la feuille, les zones, le plan dessiné), `70` (le découpage en
secteurs — rien à y choisir, c'est de l'arithmétique), `71` (ce qui en sort : le
devis, la carte du coffret, le plan client).

**Ce qui attend sa décision** : par où il entre, et par quelle sortie on
commence. Ma recommandation, écrite sur les planches : **les zones**, puis **le
devis** — c'est la seule entrée qui rend du temps de bureau, et la seule sortie
qui n'ouvre aucune plomberie nouvelle. Le détail est dans `TODO.md`
§ « 0 quaterquadragies ».

**Ce qui est déjà su du métier, et qui ne se rediscutera pas** : le débit se
mesure au seau ; une seule pluviométrie et un seul rythme par secteur ; aucun
prix inventé ; rien ne part tout seul. Les pertes de charge restent hors du
calcul, et c'est dit sur la planche plutôt que passé sous silence.

### Apparier deux demi-journées, par la route (16 août 2026)

Sa demande du 13 août — *« proposer deux demi-journées pour faire une journée,
mais de deux chantiers qui sont les plus proches »* — et sa décision du 16 :
**par la route**, après vérification du service de l'IGN sur une machine qui a
le réseau.

| Brique | Où c'est |
|---|---|
| Les règles pures : vol d'oiseau, seuil, classement, phrase affichée | `src/lib/appariement-demi-journees.ts` |
| Le trajet demandé à la Géoplateforme de l'IGN — sans clé, sans compte | `src/server/itineraire/geoplateforme.ts` |
| L'assemblage : rattrapage des coordonnées, présélection, appels, classement | `src/server/planning/appariement.ts` |
| Les coordonnées d'un chantier, et l'adresse qui les a produites | `drizzle/0049_coordonnees_chantier.sql` |
| Le bandeau sous la journée dépareillée, avec ses trois états muets | `src/components/atlas/BandeauAppariement.tsx` |
| La vérification du vrai service, là où il y a du réseau | `.github/workflows/itineraire.yml` |

**Ce qui protège le service public** : le vol d'oiseau classe et écarte d'abord,
chez nous, sans appel ; la route ne départage que les trois premiers. **Ce qui
ne sort pas d'Atlas** : deux paires de nombres, jamais un nom ni une adresse en
clair — tenu par un contrôle (`scripts/test-itineraire-ign.ts`).
`ARCHITECTURE.md` §117.

### Conformité RGPD

| Brique | Où c'est |
|---|---|
| Registre des traitements, sous-traitants, conservation | `docs/RGPD.md` |
| Grille de choix des fournisseurs d'IA, et leurs tarifs relevés | `docs/TRANSCRIPTION.md` |
| Relevé des tarifs d'IA à leur source (le réseau de l'agent les refuse) | `.github/workflows/relever-tarifs-ia.yml` |
| Refus de démarrer en production avec l'IA simulée | `src/server/env.ts` |
| Ce que l'application utilise vraiment, dit à l'écran | `src/lib/etat-ia.ts`, `src/app/reglages/` |
| Acceptation des documents légaux, avec empreinte | `src/app/documents-legaux/` |
| Purge de l'audio après transcription réussie | `src/server/retention.ts` |
| Export des données d'un client | `src/server/repositories/donnees-client.ts` |
| Effacement d'un client, respectant la conservation légale | idem |

### Le numéro du client, pris pour un téléphone (13 août 2026)

Deuxième passe sur le même défaut. Le 12 août, l'en-tête `format-detection`
avait été posée et annoncée comme réglant l'affaire ; le 13, le patron ouvre son
devis **depuis un SMS** et reçoit la même « Hydration failed », signature d'iOS
comprise — sur un banc à jour, vérifié par sa fiche d'état. Une vue intégrée à
Messages ne lit pas cette en-tête, et c'est le seul chemin par lequel son client
arrive sur la page.

| Brique | Où c'est |
|---|---|
| La règle : découper un numéro pour qu'il ne ressemble plus à un téléphone | `src/lib/numero-document.ts` |
| Ce qui répare vraiment — la coupure du texte aplati par `inline-flex` | `src/components/atlas/NumeroDeDocument.tsx` |
| Contrôles purs, sans navigateur | `scripts/test-numero-document.ts` |
| Le texte réellement aplati, lu sur un VRAI devis | `scripts/test-detection-automatique-e2e.ts` |
| Le pourquoi, le coût assumé et ce qui reste non prouvé | `ARCHITECTURE.md` §81 |

**Non éprouvé ici, et ça ne peut pas l'être** : la détection appartient à un
logiciel fermé d'Apple, absent de cet environnement. À faire confirmer par le
patron, depuis ses SMS (`TODO.md`).

### Le jour barré qui se faisait passer pour un jour pris (16 août 2026)

L'écran refusait une date sans dire pourquoi, et la phrase désignait une
occupation qui n'existait pas. La règle, elle, était juste : un jour vide se
barre quand la durée du chantier déborderait sur un lendemain plein.

| Brique | Où c'est |
|---|---|
| La phrase, et le cas reproduit qui la justifie | `src/lib/jours-barres.ts` |
| Le calendrier — le même pour le patron et pour son client | `src/components/atlas/Calendrier.tsx` |
| Contrôles purs : le fait, la phrase, et la consigne côté client | `scripts/test-jours-barres.ts` |
| Le pourquoi, et ce qui n'a PAS changé | `ARCHITECTURE.md` §115 |

### L'écran d'erreur qui ne menait nulle part (11 août 2026)

Un serveur redémarré sous un onglet resté ouvert, et les morceaux de code
changent de nom. Le patron a lu « Failed to load chunk » avec pour seul recours
un « Réessayer » qui refait le même rendu, avec les mêmes adresses mortes.

| Brique | Où c'est |
|---|---|
| La décision : reconnaître, recharger une fois, savoir s'arrêter | `src/lib/reprise-erreur.ts` |
| Le corps commun des neuf écrans d'erreur | `src/components/atlas/CorpsErreur.tsx` |
| Contrôles purs, dont son message exact et les cinq formulations de navigateurs | `scripts/test-reprise-erreur.ts` |
| La panne rejouée dans un vrai navigateur, à l'écran du patron | `scripts/test-reprise-morceau-e2e.ts` |
| La capture, pour regarder l'écran | `scripts/capture-reprise-morceau.mts` |
| Le pourquoi, et ce qui n'est pas couvert | `ARCHITECTURE.md` §63 |

### La session fantôme (10 août 2026)

Un cookie Auth.js est signé : il survit à la disparition du compte qu'il
désigne. Refaire le jeu de démonstration suffisait à enfermer le patron
dehors — l'application le laissait entrer, puis refusait toute écriture.

| Brique | Où c'est |
|---|---|
| Route qui efface les cookies et renvoie à la connexion | `src/app/api/session-perimee/route.ts` |
| Contrôle du compte, dans le **layout** (307 sans JavaScript) | `src/components/atlas/GardeDocumentsLegaux.tsx` |
| Compte disparu ≠ compte sans entreprise | `src/server/session-ctx.ts` |
| Contrôle, cinq points dont un navigateur sans JavaScript | `scripts/test-session-perimee-e2e.ts` |
| Le pourquoi, et les trois défauts trouvés à l'essai | `ARCHITECTURE.md` §54 |
| Le port du banc, rendu public à **chaque allumage** (le déclarer ne suffit pas) | `.devcontainer/ouvrir-port.sh` + `scripts/test-ouvrir-port.ts` |
| Un seul banc à la fois, et le veilleur ne tue plus la bascule | `.devcontainer/bascule-en-cours.sh` + `scripts/verrou-banc.mjs` + `scripts/test-bascule-veilleur.ts` (`ARCHITECTURE.md` §56) |

### La refonte de l'interface (10 août 2026)

**Mise à jour du 16 août 2026 :** « Nouveau chantier » a grossi — *« les
capitales, gros et très gras »*, choisi sur `docs/maquettes/67` : 13 px,
graisse 800, 0,22 em, rond de 42 px. `docs/maquettes/24-le-bouton-retenu.html`
n'est plus la référence du libellé et porte un bandeau qui le dit ; elle reste
celle du geste (onde, tours, grains), qui n'a pas bougé.

Le patron a arrêté un écran après une soirée de maquettes
(`docs/maquettes/`, treize propositions), puis l'a fait poser dans
l'application. Ce qui est **fait** :

- **L'accueil** : le fil qui porte les jours, la perle d'or qui se tient à
  mi-hauteur et désigne le chantier qu'on regarde, puis descend sur le dernier
  jour quand on arrive au bout (corrigé le 11 août 2026 : elle était posée sur le
  chantier en attente, donc tout en bas chez le patron — `ARCHITECTURE.md` §59),
  le trait qui glisse sous les onglets, et « Nouveau chantier » qui monte en
  feuille pendant que la liste recule. **Le fil glisse librement depuis le 11
  août 2026** : `scroll-snap-stop: always` l'arrêtait à chaque chantier — le
  patron le lisait comme du saccadé — et aucune zone qui défile ne montre plus
  sa barre grise. Le masque en dégradé et l'animation d'opacité sont hors de
  cause, c'est **mesuré** (`scripts/mesurer-fluidite-fil.mts`) : ne pas les
  accuser sans relancer la mesure.
- **Le devis, en tête et dans sa synthèse** (13 août) : le chantier ne s'appelle
  plus « Chez Martins » mais « Mr. Martins », et la carte pose le nom
  au-dessus du détail au lieu de les coller par un tiret. La civilité vit dans
  `src/lib/civilite.ts` — **et c'est un défaut, pas une donnée** : sans champ de
  civilité sur la fiche client, une cliente était nommée « Mr. ». **Tranché le
  soir même** : deux pastilles « Mr » / « Mme » au-dessus du nom, **à la création
  seulement** — sur le devis, le mot s'écrit, il ne se choisit pas (le devis est
  le document, pas la fiche). Recopiées sur le devis et la facture. Un client sur
  lequel il n'a rien touché garde l'apparence qu'il avait avant. Le message tout prêt l'aborde de la même façon (« Bonjour
  Mr. Martins »), et l'encart du client porte une phrase qui l'invite à écrire.
  `ARCHITECTURE.md` §77.
- **Le devis à la main** : ses trois zones de texte mesurent leur hauteur au
  lieu de l'estimer (11 août 2026). Elles comptaient les caractères ou les
  retours à la ligne, alors qu'un texte se coupe au mot : le devis cachait 24 px
  de ce que le patron venait d'y écrire.
- **Planning, Terminés, Réglages, relevé de TVA, fiche chantier** : même
  en-tête, mêmes rayons, mêmes capitales.
- **Les six écrans d'étape** : en-tête et boutons. Les corps de **Photos**, de
  **Note vocale**, d'**Informations** et de **Prix** aussi — plus l'en-tête
  d'Informations, oublié le matin même parce que cet écran ne fait pas partie
  des « six ».
- **La typographie** : plus aucune police téléchargée. L'application prend
  celles de l'appareil, comme la maquette que le patron a validée.
- **Le retrait, partout** (10 août, au soir) : le texte glisse, « Retirer » se
  découvre, la ligne tombe, un tiroir la retient. **Huit** endroits, une seule
  mécanique là où il y en avait trois. Les panneaux « Supprimer … ? »
  disparaissent : la sécurité passe d'une confirmation avant à une
  réversibilité après, et **rien n'est écrit tant que le tiroir est ouvert**.
  `ARCHITECTURE.md` §48.
- **L'anneau muet et la pellicule** (10 août, au soir) : sur la fiche
  chantier, la ligne « Note vocale » devient un anneau qu'on touche pour
  écouter — le compteur suit la lecture réelle et l'onde le volume réellement
  enregistré, pas un décor — et les photos une pellicule dans le tiroir du bas,
  case « + » en tête. `ARCHITECTURE.md` §49.
- **La pellicule ajoute sur place, et l'écran Photos n'existe plus** (11 août) :
  le « + » du tiroir ouvre directement le menu du téléphone — *Photothèque ·
  Prendre une photo · Choisir les fichiers* — au lieu de charger un écran puis
  d'y poser une feuille maison. Quatre gestes deviennent deux. Ajouter, regarder
  et retirer se font dans la pellicule ; `/chantiers/[id]/photos` répond 404, et
  une suite le vérifie. `ARCHITECTURE.md` §60.
- **La TVA due, les achats et le scanner de tickets** (13 août) : l'écran porte
  collectée, déductible et reste à payer — chacun copiable. Les achats entrent
  par l'appareil photo ou au clavier (`achats_tva`, migration
  `drizzle/0036_achats_tva.sql`). La lecture d'un ticket est branchée sur les
  clés du patron ; **la vision a dû être ajoutée à la couche IA**, qui ne
  manipulait que du texte. Ce qu'elle rend est une proposition : c'est ce qu'il
  confirme qui compte. Un crédit de TVA s'affiche en négatif, signe et phrase.
  **NON VÉRIFIÉ ICI : la lecture d'un vrai ticket** — aucune clé dans cet
  environnement. `ARCHITECTURE.md` §84.
- **Un ticket daté d'un autre mois ne disparaît plus** (13 août) : le patron
  ajoute un ticket du 24 juillet depuis l'écran d'août ; il était enregistré —
  dans juillet — et **invisible**, l'écran ne montrant qu'une période. La
  feuille annonce désormais la destination avant qu'il appuie, et l'écran l'y
  emmène après. `scripts/test-achat-hors-periode-e2e.ts`, `ARCHITECTURE.md` §91.
- **Une équipe peut partir cinq jours** (14 août) : les absences se notent dans
  Réglages → Équipe, sous les noms (`docs/maquettes/55`, proposition A). Une
  équipe absente **ne compte plus** dans les dates proposées — l'absence est
  traitée comme une occupation, ce qui la fait entrer dans les **quatre**
  calculs de capacité sans changer une signature. Migration
  `drizzle/0044_absences_equipe.sql`. Si toute l'entreprise part, l'agenda
  Google suffisait déjà et rien n'a été écrit pour ça. **Reste faux, et dit :**
  l'équipe d'un chantier est une étiquette, pas une contrainte.
  `ARCHITECTURE.md` §109.
- **Poser une date à la main, enfin possible** (17 août) : *« je peux toujours
  pas poser de date sur les chantiers test »*. Le geste marchait de bout en bout ;
  c'est le RACCORD qui manquait — en touchant un chantier de « Sans date »,
  l'écran écrivait « À poser » et ne bougeait pas, le calendrier restant 231 px
  au-dessus du haut de la fenêtre. `amenerAuCalendrier` existait déjà et
  annonçait servir « depuis deux endroits » : la liste ne l'a jamais appelée.
  **Aucune suite ne le voyait parce que Playwright fait défiler avant de
  cliquer** — un contrôle qui clique éprouve qu'une cible existe, jamais qu'elle
  est atteignable. `ARCHITECTURE.md` §127.
- **« Adresse non renseignée » ouvre l'écran du chantier** (17 août) : la mention
  de l'accueil devient un lien vers `/chantiers/[id]/coordonnees` — l'écran de
  création rouvert, prérempli, qui **enregistre** au lieu de créer. Sa demande,
  puis sa correction : *« que ça m'amène sur la page que je t'ai envoyée sur la
  deuxième photo. Rien de plus, rien de moins. »* **La mention SEULE est la
  cible** : le nom du chantier garde sa reprise du 13 août. **Le nom du chantier
  se recalcule** à l'enregistrement — sans quoi la ligne dirait « Chantier du … »
  pour toujours, le défaut corrigé partout sauf là où il l'a vu. Deux mots
  changent parce qu'ils mentiraient : « Nouveau » et « Créer le chantier ».
  `ARCHITECTURE.md` §124. **Leçon : devant une demande qui touche à un écran,
  chercher d'abord si l'écran existe** — une première planche avait dessiné une
  fiche client de toutes pièces.
- **Le rappel « facture impayée »** (16 août) : le **quatrième** rappel, et le
  seul qui porte un **rythme**. Sa demande : *« faut faire a plus b, mais il faut
  également qu'on puisse régler […] toutes les semaines ou tous les quinze jours,
  mais pas qu'il y ait la notification tous les jours. »* Il paraît à l'échéance
  — envoi **+ le délai de paiement** réglé, ou le jour de l'envoi sinon —, montre
  le **reste dû** (avec le total quand un acompte est arrivé), et s'éteint tout
  seul dès que le règlement est enregistré. « Plus tard » ne classe rien : il
  espace le rappel du rythme choisi, et c'est le **seul moteur** de ce rythme —
  sans geste, la carte reste, parce qu'une carte qui s'endort seule peut passer
  un jour où il n'ouvre pas l'application. La date de report vit sur le
  **chantier**, pas sur la facture : `trg_facture_immuable` refuse toute écriture
  sur une facture émise, et l'affaiblir aurait été un contournement. Migration
  `drizzle/0050_rappel_facture_impayee.sql`, `ARCHITECTURE.md` §118.
  **Deux défauts trouvés sur la capture et par aucun test** — « 1 jours après
  l'échéance », et deux espaces mangées par JSX autour d'un `<b>`. Le contrôle
  écrit contre le premier ne mesurait rien : la valeur d'un `<input>` ne figure
  pas dans `innerText`.
- **Le rappel du devis qui tarde** (16 août) : un **troisième** rappel dans
  Réglages → Notifications — *« Chantier sans devis »*, 4 jours, allumé
  d'origine —, et sa carte **teintée** à l'accueil avec le compte des jours dans
  l'étiquette (« DEVIS EN ATTENTE · 14 JOURS »). Sa demande du 14 août, ses
  décisions du 16 : *« la B et 4 »*, puis *« le G »*. Il ne se déduit d'aucun des
  deux rappels codés le 14 : ceux-là partent d'un ENVOI, et un devis jamais parti
  n'en laisse aucun — celui-ci se lit sur le chantier. Deux règles y sont
  gratuites : il s'efface seul quand le devis part, et un chantier terminé sans
  devis ne réclame plus rien. Migration `drizzle/0046_rappel_chantier_sans_devis.sql`.
  **Le ton lui a été reposé, capture à l'appui — il garde le sien** (« le B »,
  16 août) : c'est le seul des trois rappels où rien n'est encore parti au
  client. **Et le rang est tranché aussi** (« fait la B », 16 août, après trois
  photos) : sur l'accueil, **les rappels passent devant les réponses de
  clients** — ce qu'il doit faire avant ce qu'on lui a répondu —, **avec une
  place garantie à chaque sorte** pour qu'une pile de rappels ne puisse pas
  enterrer un refus (`src/lib/ordre-notifications.ts`). `TODO.md` §0 novivicies.
- **Une carte ne peut plus se reposer à moitié coupée** (16 août) : sa capture —
  *« le premier message est trop haut et le début n'est pas visible »*. Le cadre
  qui défile déclarait `scroll-snap-type` sans qu'aucun enfant n'ait jamais
  déclaré de point d'accroche : la propriété était **inerte depuis le premier
  jour**. Une carte s'arrête désormais à 24 px du bord, hors du fondu de 18 px.
- **« Surtout la page équipe » : l'écran jamais préparé d'avance** (14 août) :
  le banc compile ses écrans à l'avance, mais la liste — écrite à la main —
  ignorait les **sept sous-écrans de Réglages** créés depuis. « Équipe »
  s'ouvrait donc à froid pendant la construction, au-delà de la minute que le
  relais de GitHub accepte. La liste est désormais confrontée aux dossiers
  réels. Et un **bandeau** dit « Version rapide en construction — 12 écrans sur
  19 » puis s'efface seul, pour ne plus confondre « ça bâtit » et « c'est
  cassé ». **Écarté après mesure : bâtir en priorité basse** (aucun gain, la
  contention est le disque). `ARCHITECTURE.md` §103, `docs/maquettes/46`.
- **La TVA au mois ou au trimestre, et son calendrier** (12 août) : Réglages
  porte le choix, le mois coché d'avance — c'est le défaut légal (déclaration
  CA3 mensuelle ; le trimestre est une option sous 4 000 € de TVA due). L'écran
  de TVA et son calendrier suivent : douze pavés ou quatre. **Atlas ne dit
  jamais lequel s'applique** — le seuil porte sur la TVA due, or il ne connaît
  que la collectée. Migration `drizzle/0035_periodicite_tva.sql`.
  `ARCHITECTURE.md` §83.
- **« Y aller » : l'adresse du chantier jusqu'au GPS** (12 août) : au bout de
  chaque ligne des chantiers planifiés, un **chevron doré** ouvre une feuille —
  Plans, Google Maps, Waze, copier l'adresse, appeler le client — sans quitter
  le planning. Liens universels et jamais `waze://`, qui échoue en silence
  quand l'application manque. Sans adresse, rien ne s'invente : les
  destinations disparaissent et la feuille dit où la saisir. Retenu après
  quatre maquettes (`docs/maquettes/29` à `32`). **Et « Créer la facture » a
  quitté la ligne pour la feuille**, à sa demande du même jour : la ligne ne
  garde que le nom, la date, « Déplacer » et le chevron. `ARCHITECTURE.md` §70.
- **Le planning au mois, et les équipes nommées** (10 août, au soir) : sept
  colonnes sans bordure, cinq marques d'occupation, et la journée qui s'ouvre
  sous le calendrier. Réglages laisse nommer les équipes — mais **seulement à
  partir de deux** : seul, le mot « équipe » ne s'écrit nulle part. Une table
  `equipes` (`nom` nullable), une colonne `chantiers.equipe_id`, et une seule
  fonction pure qui décide du libellé. `ARCHITECTURE.md` §51 et §52.
- **« Terminés » et le parcours de facturation** (10 août, au soir) : un fil par
  mois, l'encart « à facturer » posé DANS le mois et replié au repos, le relevé
  de TVA en simple ligne au pied. « Fin de chantier » s'appelle désormais
  **« Créer la facture »** — mais créer n'est toujours pas envoyer.
  `ARCHITECTURE.md` §53.
- **La fiche chantier tenue à sa maquette, et l'anneau qui dicte** (11 août) :
  le corps ne porte plus que l'anneau, au centre, **présent dès l'arrivée**.
  Sans note il est un micro — un appui dicte, un second enregistre, la fiche se
  rafraîchit sur place ; avec, il redevient le lecteur. Le bouton principal, la
  rédaction à la main et les étapes descendent dans le tiroir : la fiche dit
  toujours quoi faire ensuite, mais depuis son bandeau. L'en-tête suit la
  maquette (client en serif **avant** le titre, pastille sur la ligne de la
  flèche, pas de trait de fermeture), par trois réglages **facultatifs** de
  `EnTeteEcran` qui laissent les autres écrans intacts. `ARCHITECTURE.md` §57.
- **De l'anneau au devis, en une touche** (11 août, soir) : un appui dicte, un
  second arrête, et « MON DEVIS → » naît sous l'anneau — transcription,
  informations, prix, rédaction, et l'on arrive sur `devis-complet` sans écran
  intermédiaire. La chaîne lance elle-même la transcription, ce qui manquait.
  Le tiroir ne garde que Photos, Note vocale et Devis à la main ; les écrans
  retirés restent joignables par leur adresse.
  `scripts/test-anneau-vers-devis-e2e.ts`.
- **Le devis à la main s'ouvre depuis la création du chantier** (11 août) : un
  lien discret sous « Créer le chantier ». Le chantier est créé, puis le devis
  s'ouvre avec le client déjà en en-tête — nom, adresse, téléphone. La porte du
  tiroir reste : ce sont deux moments, pas deux chemins.
  `scripts/test-devis-main-depuis-creation-e2e.ts`.
- **Les suites mesurent l'écran du patron, et cherchent ce que le doigt
  n'atteint pas** (11 août) : le cadre vit à un seul endroit
  (`ECRAN_DU_PATRON`, 390 × 664 au lieu des 393 × 852 qu'on posait — la dalle
  d'un iPhone, pas la place réelle d'une page). Quarante-et-une suites et
  vingt-neuf scripts de capture en héritent. Le cadre honnête n'a révélé aucun
  défaut caché, mais il rendait enfin possible
  `scripts/test-rien-de-recouvert-e2e.ts` : quatorze écrans, et sur chacun la
  question « qui répondrait au doigt ? » posée à chaque lien, bouton et champ.
  C'est la famille des trois seuls défauts que ce dépôt n'a jamais su attraper
  autrement qu'à l'œil. `ARCHITECTURE.md` §58.
- **Une seule forme d'action, et un contrôle qui la garde** (12 août) : la
  capsule est posée sur les dix-sept écrans du produit, et
  `scripts/test-boutons-arrondis.ts` refuse tout bouton rectangulaire ajouté
  ensuite — c'est le patron qui avait vu, sur la feuille d'envoi, un carré à
  côté d'une capsule. Les champs et les cartes gardent leurs 4 px : le rayon
  distingue ce qu'on touche de ce qu'on lit. `ARCHITECTURE.md` §67.
- **Le devis qui ne partait pas** (12 août) : le banc d'essai sert une version
  **bâtie**, donc `NODE_ENV=production` sans qu'aucun déploiement existe — et la
  seconde barrière du stockage, plus stricte que la première, refusait tout
  envoi. Une règle écrite deux fois qui avait divergé. `ARCHITECTURE.md` §66.
- **L'écran de connexion, dessiné mais PAS posé** (12 août) : le seul écran
  resté dans l'identité d'avant le 3 août, parce qu'il est le seul vu **avant**
  d'être connecté. `docs/maquettes/35-l-ecran-de-connexion.html` — l'avant, puis
  quatre après. **Son choix est attendu ; `src/app/login/` n'a pas bougé.**
  Trois corrections partiront quoi qu'il choisisse, dont les champs à 16 px, en
  dessous desquels iOS lui agrandit la page. `TODO.md` §0 nonies.

Ce qui **reste**, avec l'ordre, les valeurs, les sept pièges et les deux
réserves : **`TODO.md` §7**. Le dessin fait foi dans
`docs/maquettes/13-le-fil-quatre-couleurs.html`, qui est du HTML pur.

**Cinq pièces partagées portent toute la grammaire** — `EnTeteEcran`,
`PrimaryButton`, `src/lib/design-tokens.ts`, et depuis le 10 août au soir
`LigneRetirable` + `TiroirDesRetires` (avec le crochet `useRetraits`). Une allure ne se recopie pas dans
un écran : elle s'ajoute à ces pièces, sinon les écrans divergent de nouveau.
Les deux voix de l'écran retenu y sont depuis le 10 août : **`libelleCaps`**
(les libellés, états et actions secondaires) et **`texteSituation`** (ce qui se
lit sans se toucher). `smallCaps`, l'ancienne voix, ne sert plus qu'aux
maquettes `/design/*` — un écran qui l'importe encore n'est pas refait.

### Le banc d'essai (9 août 2026)

- **Il se relève seul.** `.devcontainer/veiller.sh` contrôle la santé toutes les
  quinze secondes et relance le serveur quand il tombe. Avant, un serveur mort
  le restait : le patron lisait « HTTP ERROR 404 », qui sur cette adresse veut
  dire « plus rien n'écoute ».
- **Il compile seize écrans d'avance.** `scripts/prechauffer.mjs`, au démarrage,
  avec une session fabriquée — jamais par le formulaire de connexion, dont le
  limiteur aurait verrouillé le patron au bout de cinq redémarrages. Jamais en
  production.
- **Deux serveurs ne se disputent plus le port.** `npm run essai` s'arrête si
  quelque chose répond déjà.
- **L'application est enfin constructible** sans les secrets de production
  (`ARCHITECTURE.md` §43), donc mesurable : démarrage 212 ms, écrans entre 50 et
  100 ms sur une machine à 4 cœurs.

### Mise en ligne

L'application-coque statique (`appli/`) est publiée sur GitHub Pages à
`https://florianmarrins0978-svg.github.io/Atlas-app/`. Le workflow `.github/workflows/pages.yml`
vérifie le site **à son adresse publique** après déploiement.

**Ce site n'est PAS le produit.** Ce sont cinq maquettes reprises d'Arborea —
Nouveau devis, Devis, Factures, TVA déductible, Mes tarifs — sans base ni
serveur, et qui portent encore le nom d'Arborea. Elles ne montrent ni les
chantiers, ni le planning, ni l'envoi au client, ni la facture, ni la TVA
collectée. Un bandeau le dit désormais en tête de chaque écran : le patron
lui-même s'y était trompé, ce qui était prévisible et entièrement de notre
faute.

L'application Next.js, elle, **n'est hébergée nulle part** — voir « Ce qui
bloque ». Mais elle est **essayable en entier dès maintenant**, y compris depuis
un téléphone, via l'espace de travail décrit dans
[`docs/ESSAYER.md`](docs/ESSAYER.md). Distinguer les deux importe : l'essai ne
demande aucune décision, aucun compte et aucun budget ; seule la mise en
production les demande.

---

## Les maquettes essayables : une seule adresse, et `appli/` en est la racine

**Ce qu'on lui donne, et rien d'autre :**
`https://florianmarrins0978-svg.github.io/Atlas-app/essais.html`

`.github/workflows/pages.yml` publie **`appli/` comme racine du site** — tout ce
qui y est déposé part en ligne, et rien d'autre du dépôt. `appli/essais.html`
est la page d'entrée : elle liste toutes les maquettes manipulables, chacune sur
un pavé d'au moins 64 px.

**Deux règles payées cher :**

- **Une adresse se donne entière, jamais avec des points de suspension.** Le
  18 août 2026 il a répondu : *« quand je fais pour cliquer, je ne peux pas
  cliquer »*. Un lien tronqué n'est pas un lien.
- **Toute maquette neuve s'inscrit à trois endroits, sans quoi elle n'existe
  pas :** `appli/essais.html` (le patron y arrive), la liste vérifiée après
  déploiement dans `pages.yml` (elle répond vraiment), et
  `npm run verifier:maquette` (elle tient ce qu'elle promet). C'est la même
  leçon que les huit planches introuvables trouvées par
  `scripts/fusionner-maquettes.mjs`.

## Atlas fabrique TROIS documents en PDF

**Le troisième est né le 20 août 2026**, sur sa demande : *« fais en sorte que
les fiches chantiers soient au format PDF maintenant »*. Jusque-là il n'y en
avait que deux, et le vocabulaire du dépôt trompait.

| Le document | Où il vit | Ce qu'il porte |
|---|---|---|
| **Devis** | `src/server/pdf/devis-pdf.ts`, `/api/devis/[id]/pdf` | prix, totaux, TVA, **cadre de signature** |
| **Facture** | `facture-pdf.ts`, `/api/factures/[id]/pdf` | prix, totaux, TVA, mention légale, **pas de signature** |
| **Fiche de chantier** | `fiche-chantier-pdf.ts`, `/api/chantiers/[chantierId]/fiche/pdf` | ce qui a été fait, le matériel, les observations, les photos — **aucun prix** |

Les trois sortent du **même moteur** (`document-commun.ts`) : même papier, même
en-tête, même bloc émetteur/client, même pied. Trois moteurs auraient produit
trois mises en page qui divergent, et c'est le client qui verrait la différence
entre les feuilles d'un même artisan.

**Ce qui distingue la fiche : `sansChiffrage`.** Ni colonnes de prix, ni totaux,
ni TVA, ni IBAN, ni signature. Ce n'est pas une économie de place — c'est ce qui
la rend **transmissible** : on peut la donner à un locataire, à un syndic, à
l'assurance d'un voisin, sans divulguer ce que le propriétaire a payé.

**AVANT DE TOUCHER À `document-commun.ts`, LIRE CECI.** Le devis et la facture
sont les pièces que le client reçoit, et l'une est ce qu'il paie. Un `if` mal
placé y décalerait un total sans que personne le voie avant l'impression. Une
**empreinte de leur trace entière** — chaque texte, sa position au centième de
point, sa taille, sa couleur, sa page — est figée dans
`scripts/test-fiche-chantier-pdf.ts` et refuse le moindre écart. Elle a été
relevée avant la première ligne de `sansChiffrage`, et éprouvée rouge en
décalant le moteur d'un seul point.

**Trois mots proches désignent encore trois choses différentes :**

| Le mot | Ce que c'est |
|---|---|
| **fiche de chantier (PDF)** | le document ci-dessus, depuis le 20 août 2026 |
| **fiche chantier (écran)** | `src/app/chantiers/[id]/` — photos, note vocale, étapes |
| **fiche d'entretien** | un MODÈLE de prestations à cocher, un par entreprise (migration 0051) |

**Un piège de Next.js payé le 20 août :** la route a d'abord été écrite sous
`/api/chantiers/[id]/`, alors que le dossier voisin emploie `[chantierId]`.
Next.js refuse deux noms pour le même segment dynamique — et **le serveur entier
ne démarre plus**. Cinq écrans échouaient au préchauffage, et la suite accusait
un bouton introuvable trois écrans plus loin. Le message du serveur, lui, disait
juste : *« You cannot use different slug names for the same dynamic path »*.
Aller le lire a pris trente secondes ; le deviner aurait pris une heure.

## Le lecteur du patron n'exécute pas JavaScript — les maquettes doivent s'en passer

**Constaté le 2026-08-10, et payé une fois.** Trois bancs d'essai lui ont été
envoyés avec leurs barres d'onglets construites en JavaScript. Chez lui, ils
arrivaient **vides** : les textes s'affichaient, les téléphones étaient des
rectangles nus. La contrainte était déjà écrite dans son propre fichier de
maquettes — « son lecteur n'en exécute pas ; les pages engendrées en JavaScript
lui arrivaient vides » — et n'existait nulle part ici.

Ce que cela impose à **toute maquette qui lui est destinée** :

- **Aucune balise `<script>`, aucun gestionnaire en ligne.** Le contrôle est
  mécanique : chercher `<script`, ` on…=`, `javascript:` dans la source.
- **Ce qui doit réagir au doigt se fait en CSS.** Une barre d'onglets se bâtit
  avec quatre `input[type=radio]`, des `label`, et
  `input:nth-of-type(n):checked ~ .trait`. Les colonnes étant égales, un onglet
  vaut exactement `translateX(100%)` : rien à mesurer.
- **Un repère qui suit le défilement se fait avec `position: sticky`**, pas
  avec un calcul. Une pastille collée à `top: 50%` dans la liste **est**, par
  construction, sur l'élément centré ; avec `scroll-snap-align: center` sur
  chaque ligne, celui-ci vient se caler dessous. Rien à mesurer, et surtout
  rien qui puisse se désynchroniser du défilement — ce qu'un suivi image par
  image finit toujours par faire sur un téléphone chargé. Trois pièges,
  éprouvés le 2026-08-10 :
  - **Le point d'ancrage détermine la position au repos.** Placé en tête de
    liste, le repère est déjà au centre avant tout défilement ; placé dans le
    flux à hauteur d'une ligne précise, il s'y tient jusqu'à ce qu'elle
    remonte. C'est ce second placement que le patron demande.
  - **Le `50 %` se calcule sur la boîte de contenu de la zone de défilement.**
    Un rembourrage bas posé sur cette zone la rétrécit et décale le repère de
    la moitié — la marge de fin qui permet à la dernière ligne d'atteindre le
    centre doit donc être posée sur le **contenu**, jamais sur le conteneur.
  - **`scroll-snap-stop: always` a été RETIRÉ de l'application le 11 août 2026,
    et il ne faut pas le remettre.** Il tenait bien « un élément à la fois »
    dans la maquette, mais chez le patron il arrêtait le fil à chaque chantier
    et il l'a lu comme du saccadé — *« je trouve que ça manque de fluidité […]
    c'est saccadé »*. L'accroche reste, en `proximity` : la ligne se recentre,
    mais le geste ne se fait plus couper. Ce paragraphe décrit donc la maquette
    d'origine, pas le code d'aujourd'hui.
  - **L'accroche ne se vérifie pas à la molette synthétique.** Chromium sans
    interface ne l'applique pas : le contrôle rend la même valeur quelle que
    soit la correction. L'éprouver par un défilement programmé, auquel le
    moteur applique bien l'accroche.
- **Éprouver avec `javaScriptEnabled: false`.** Une page bâtie en JS passe tous
  les contrôles ordinaires et arrive quand même vide chez lui. Le contrôle
  ouvre la page dans ce mode, compte les onglets, et **charge en contre-épreuve
  une page bâtie en JS pour vérifier qu'il y en trouve zéro** — sans quoi il ne
  prouverait rien. Aucun script du dépôt ne le fait à ce jour : il vit dans
  l'espace de travail de la conversation, et devra être rapatrié ici le jour où
  des maquettes seront produites depuis le dépôt.

Cela ne concerne pas l'application elle-même, qui est un Next.js qu'il ouvre
dans Safari. Uniquement ce qu'on lui **transmet à lire**.

---

## Une identité visuelle est en cours de remplacement — ne pas se fier au code seul

**Constaté le 2026-08-10, hors du dépôt**, puis précisé en lisant ses maquettes.
Le patron explore une identité que rien ici ne mentionne. Elle est engendrée de
son côté par un script nommé `engendrer-maquette-fil.mjs`, **absent du dépôt**,
et ses pages portent la consigne « ne pas les modifier à la main ».

**Quatre chartes**, pas une, et l'accent n'est jamais le vert pin d'Arborea :

| Charte | Fond | Encre | Accent |
|---|---|---|---|
| Origine | `#edece6` | `#16170f` | `#8f7130` |
| Ivoire | `#efece6` | `#221f1a` | `#8a7452` |
| Sylve (sombre) | `#16241c` | `#e6e6da` | `#c3b184` |
| Océan | `#e6ecf2` | `#0d1b2c` | `#1e4f86` |

**Trois formes de liste** sont mises en concurrence : *le fil* (une tige
verticale porte les jours, une seule perle sur ce qui attend une réponse),
*l'ourlet* (un cheveu vertical qui prend la couleur d'attente là où un geste est
dû), *la plage amincie*.

Ce que cela change pour le code, et pourquoi c'est écrit ici :

- **La navigation basse perd ses icônes.** Quatre libellés en petites capitales
  — 9,5 px, `letter-spacing: .28em`, graisse 500 — en grille de quatre colonnes
  égales. L'onglet actif prend la couleur d'encre et **un trait d'un pixel sur
  toute la largeur de sa colonne** (`box-shadow: inset 0 -1px 0`), pas sous le
  seul mot. `AtlasBottomNav` code aujourd'hui l'inverse : icône + libellé,
  accent porté par la couleur du texte.
- **Deux refus explicites, à ne pas défaire :** aucun cheveu sous « ATLAS » —
  seul reste celui qui ferme l'en-tête, au-dessus de « Nouveau chantier » ; et
  la couleur ne décore pas, elle ne se pose que là où un geste est attendu.
- `src/lib/design-tokens.ts` et `docs/DESIGN_SYSTEM.md` décrivent donc une
  identité que le patron est en train de quitter.

### Ce que le patron a arrêté le 2026-08-10, sur maquettes

Cinq choix faits, après avoir touché chaque variante sur son téléphone :

| | Retenu | Ce que ça veut dire |
|---|---|---|
| Charte | **Origine** | fond `#edece6`, encre `#16170f`, bronze `#8f7130` |
| Trait du bandeau | **G** | il dépasse sa cible et revient ; le mot choisi monte de 2 px, le mot quitté redescend |
| La perle du fil | **elle suit** | posée devant le 22 juillet au repos, accrochée à mi-hauteur dès que ce chantier remonte, **un chantier par glissement** |
| « Nouveau chantier » | **l'écran recule** | la liste passe à 93 % et s'assombrit, la feuille monte devant, son contenu arrive après elle dans l'ordre de lecture |
| Retirer un chantier | **le tiroir des retirés** (P) | on fait glisser **le texte** de la ligne vers la gauche, « Retirer » se découvre ; la ligne **tombe** et un tiroir s'ouvre au-dessus du bandeau : « Retiré à l'instant — Annuler » |

**Ce que le retrait retenu suppose.** Le geste n'efface pas : il déplace vers
un état réversible tant qu'on est sur l'écran. Trois règles en découlent, et
elles ont été payées à l'essai sur la maquette :

- **La date et le fil ne glissent pas avec le texte.** Faire partir la ligne
  d'un bloc coupe le nom en plein mot et laisse le fil traverser les lettres :
  ça se lit comme un défaut d'affichage, pas comme un geste. Seule la colonne
  du texte bouge, et un voile de 16 px la fait se **dissoudre** au bord plutôt
  que d'être tranchée. La marge négative du glisseur et le retrait intérieur du
  volet s'annulent, sinon la première lettre est mangée **au repos**.
- **« Annuler » doit viser la ligne réellement retirée.** Un libellé unique
  pointant toujours la même case rend la première ligne quand on retire la
  deuxième — l'annulation *supprime*. Chaque ligne porte son libellé, et on
  n'affiche que celui du dernier retrait, détecté par
  `:has(#cN:checked ~ .sup:checked)`.
- **Le décompte suit ce qui reste.** « Huit en cours » au-dessus de six lignes
  est le genre de détail qui décide seul du sentiment de soin. Sans script, une
  chaîne de `~ .sup:checked` compte les cases cochées.

**Réserve :** le tiroir et le décompte reposent sur `:has()`. S'il manque, la
ligne part quand même mais le tiroir ne s'ouvre pas — dégradation acceptable,
à confirmer sur l'iPhone du patron. Dans l'application, le tiroir devra porter
un délai réel avant l'écriture en base ; la maquette, elle, ne fait que cacher.

**Aucun chantier facturé n'apparaît sur cet écran** — ils vivent sous
« Terminés ». Le refus (« sa facture figure au relevé de TVA ») se joue donc
là-bas, et c'est là qu'il faudra l'écrire.

**Conséquence assumée sur la perle**, signalée deux fois et maintenue : elle ne
désigne plus le chantier dont le devis est revenu, puisqu'elle suit le doigt.
Seul reste le libellé « Devis retourné », en bronze. Ne pas « corriger » cela
par erreur en croyant retrouver l'intention d'origine.

**Réserve non levée :** « Nouveau chantier » est aujourd'hui une **page**
(`/chantiers/nouveau`, avec sa flèche de retour vers la liste), pas une
feuille modale. L'ouverture retenue raconte une feuille. Soit l'écran devient
une vraie feuille — et la flèche cède la place à un geste de fermeture vers le
bas —, soit l'ouverture devra changer le jour de l'intégration. Le patron a
tranché sur le style ; ce point de produit reste ouvert.

### Le planning, et les équipes nommées — 2026-08-10

Deux écrans de plus ont été arrêtés le même jour, sur maquettes :
`maquettes/atlas-planning.html` (le mois, les demi-journées, les équipes) et
`maquettes/atlas-equipes.html` (Réglages : nommer les équipes). Les deux sont
tenus par `npm run verifier:maquette` ; la spécification d'intégration est dans
`docs/INTEGRER-ORIGINE.md` §6 ter, la suite technique dans `TODO.md` §5.

**La règle du nommage, qui n'est pas un détail d'affichage** — elle vient d'une
demande explicite du patron : *« s'il n'a pas d'équipe et qu'il ne met rien, il
ne faut pas qu'il y ait quand même écrit équipe A équipe B »*.

- **À une équipe**, le planning n'écrit **aucun nom d'équipe** : une
  demi-journée est libre, ou elle porte le nom de son chantier. Réglages ne
  propose même pas de la nommer — offrir un champ dont la valeur ne sera jamais
  lue est un piège.
- **À deux et plus**, chaque équipe a sa ligne dans Réglages. Le champ vide
  affiche déjà « Équipe A » en gris : le repli est **montré** avant d'être subi.

Le principe qui tient les deux cas : **on n'invente jamais un nom, et on ne
laisse jamais deux lignes indiscernables.** Conséquence pour la base :
`equipes.nom` sera **nullable** — un nom absent est un état normal, pas une
donnée manquante — et **une seule fonction pure** décidera du libellé, pour le
planning comme pour la revalidation.

**Rien d'autre n'est tranché, et rien n'a été codé dans ce sens.** Mais une conversation
qui lirait le dépôt seul repartirait en vert pin avec des icônes, c'est-à-dire à
contresens. Quand le choix sera arrêté, ce sont `design-tokens.ts`,
`globals.css`, `manifest.json`, `AtlasBottomNav` et `docs/DESIGN_SYSTEM.md` qui
changent ensemble — les cinq, sinon deux chartes coexisteront comme en juillet.

---

## Ce qui reste, et que je peux faire seul

Voir `TODO.md` pour le détail et l'ordre.

- **Les clients ont enfin une porte — FAIT le 17 août au soir.** Sa remarque :
  *« la catégorie client n'a pas été créée »*. La fiche existait depuis la
  veille mais ne s'atteignait que depuis un chantier ; la **liste** s'ouvre
  maintenant depuis l'accueil (« Vos clients »), avec pour chacun ses chantiers,
  ce qui a été facturé et ce qui reste dû. **Pas de cinquième onglet** : il est
  réservé aux outils métier (`ARCHITECTURE.md` §125).

- **Le catalogue s'écrit — FAIT le 17 août** (`ARCHITECTURE.md` §122, migration
  0052). Il a posé deux fois la même question sur cet écran : *« À quoi sert
  cette page ?? On peut rien modifier rajouter »*. Ses mots s'accrochent
  désormais aux entrées d'Atlas (arrangement B de la planche 72), le catalogue
  partagé reste intouché, et **un mot ajouté est reconnu par la dictée** — les
  quatre chemins de recherche passent par la même fonction. Réparés au passage :
  la flèche de retour, et « aucun prix encore constaté », une phrase qui lisait
  une mémoire jamais écrite et ne se serait jamais éteinte. **Et Atlas PROPOSE
  désormais de retenir les mots qu'il entend** quand il sait à quoi ils se
  rapportent (migration 0053) : deux boutons, le « non » retenu pour toujours,
  et jamais rien dans le vocabulaire commun. **Une décision reste à lui**
  (`TODO.md` §0 octovicies bis) : faut-il remettre un prix sur ces cartes, alors
  que la mémoire des prix range par nature de chantier et non par mot.

- **Les réglages, dix rubriques** — **toutes dessinées, la première est codée**
  (`ARCHITECTURE.md` §94) : `/reglages/identite` existe, et le **régime de TVA
  se déclare au lieu d'être deviné d'après le taux**. **Le sommaire lui-même est CODÉ le
  14 août** (`ARCHITECTURE.md` §96), d'après une planche que le patron a envoyée
  de lui-même : dix rubriques, une icône chacune, « Devis & factures » et
  « Planning », en filets et dans la charte — sa planche était sombre, il a
  tranché « crème, comme le reste ». **Tout ce qui s'empilait sur l'écran est
  parti dans sa rubrique** : tarifs, grilles de prix et catalogue ensemble ;
  périodicité de TVA auprès du régime ; équipes du planning dans « Planning » ;
  vocabulaire sous « Atlas IA » ; données sous « Sécurité & données ». La
  version exécutée reste sur le sommaire, parce qu'une capture doit y répondre.
  **C'est aussi le premier écran d'Atlas où `getRole` décide de ce qui est
  RENDU** : un membre ne reçoit que l'ensemble « Moi », et chaque rubrique de
  l'entreprise refuse un non-propriétaire avant de lire une valeur. Le reste de
  l'application, lui, ne cloisonne toujours rien. **Les TREIZE rubriques sont
  ouvertes au 14 août 2026** — plus aucune ne porte « Bientôt »
  (`ARCHITECTURE.md` §108). Deux d'entre elles ne règlent rien et l'assument :
  *Abonnement* (ni prix ni offre décidés). **Apparence, elle, règle désormais
  les SEPT CHARTES DE COULEURS** — Origine, Pierre, Beurre, Moka, Prune, Sylve,
  Nuit, dont deux sombres (`ARCHITECTURE.md` §114). Elles repeignent toute
  l'application ; les devis et factures gardent l'identité d'Atlas. Par défaut,
  rien ne change : « Origine » reprend les valeurs d'avant au caractère près. *Notifications*,
  elle, porte **quatre rappels réels** qui apparaissent sur l'accueil — chantier
  sans devis, devis sans réponse, chantier fini non facturé, **facture impayée**.
  Ce dernier est arrivé le 16 août avec la donnée qui lui manquait — le paiement,
  noté depuis « Terminés › TVA » —, et c'est le seul qui porte un **rythme**
  (`ARCHITECTURE.md` §118). Les deux dernières ouvertes sont
  **« Mon compte »** et **« Connexion »** (`ARCHITECTURE.md` §107) : changer son
  nom, changer son mot de passe, et **« me déconnecter partout »** — une colonne
  plutôt qu'une table de sessions. Leurs libellés promettaient un *téléphone* et
  une liste d'*appareils* qui n'existent nulle part ; le patron a tranché « A A »
  le 14 août, les deux mots sont retirés. **L'e-mail ne se change pas encore**,
  et l'écran le dit : rien ne permettrait de vérifier une nouvelle adresse, et
  une faute de frappe fermerait le compte sans recours. Ce qui suit décrit l'état
  d'avant ce lot, et reste vrai pour les neuf autres rubriques : (`maquettes/atlas-reglages-plan.html`, `ARCHITECTURE.md` §86). Ce qui
  y est tranché : les deux niveaux « Moi » / « Mon entreprise », qui voit quoi,
  et ce qui n'aura jamais d'interrupteur. Ce qui ne l'est pas : le rôle
  **commercial** n'existe ni en base (`membres_entreprise.role` : propriétaire
  ou membre) ni dans les décisions écrites, et **le cloisonnement par rôle n'est
  pas codé** — un écran qui n'affiche pas une rubrique ne protège rien
  (`docs/QUESTIONS.md` §10). L'ordre des lots est dans `TODO.md` §0 quatervicies.
  **Lot 2 dessiné le 13 août** (l'identité) : il a révélé que le **régime de TVA
  est deviné d'après le taux appliqué** — donc faux dans les deux sens sur une
  pièce comptable —, que le **numéro de TVA intracommunautaire n'existe nulle
  part**, et que le **téléphone et l'e-mail ne s'impriment sur aucun document**
  (`ARCHITECTURE.md` §87). **Et surtout : le premier jour d'un artisan n'a
  jamais été vu.** Le jeu de départ pose une entreprise complète, il n'existe
  aucun parcours d'inscription, l'identité ne se saisit que dans le devis écrit
  à la main, et **rien ne la vérifie avant l'envoi** — le premier devis d'un vrai
  artisan part sans SIRET ni IBAN. Un blocage a été codé le 14 août puis
  **retiré le même jour à sa demande** : *« rien de plus, rien de moins »*
  (`ARCHITECTURE.md` §97). Ce n'est donc pas un oubli, c'est un risque qu'il
  assume. **Restent bloquants pour la commercialisation** : aucun écran ne
  permet de créer son entreprise, le jeu de départ en pose une déjà remplie, et
  le nom manquant s'écrit encore « Votre entreprise » au lieu d'être signalé
  (`docs/A-FAIRE.md` §10).
  **Lot 3 dessiné le 13 août** (l'équipe) : « équipe » désigne déjà une file du
  planning et non un compte — deux listes séparées —, et le **cloisonnement en
  lecture n'existe pas** : `getRole` n'est appelé dans aucun écran, un membre
  voit aujourd'hui tous les montants (`ARCHITECTURE.md` §88). **Lot 4 dessiné le
  13 août** (tarifs) : **les quatre priorités du patron sont dessinées**. Restent
  à coder la colonne de famille sur `tarifs`, le signalement d'une unité
  manquante, et le nombre de prix appris par grille (`ARCHITECTURE.md` §89).
  **L'unité, elle, est codée le 14 août** : elle se choisit dans un bandeau
  déroulant, sans se refermer sur une liste (`ARCHITECTURE.md` §101). **Et les
  tranches des grilles se règlent depuis le 14 août** : elles ne sont plus
  écrites dans le code (`ARCHITECTURE.md` §105).
  **Et surtout : `parametres_chiffrage` — cinq valeurs qui décident du prix
  proposé — n'a aucun écran.** Un artisan dont l'ouvrier coûte 260 €/jour verra
  des prix trop bas sans savoir d'où ils viennent.

- **Agenda Google** — la connexion du compte demande des identifiants que je n'ai
  pas ; le reste (lecture des disponibilités, écriture de l'intervention) est
  codable.
- **Agenda iCloud** — demandé le 12 août 2026 **dans les deux sens**, et
  **codé le jour même** : lecture des créneaux occupés, écriture des chantiers,
  retrait au débranchement (`ARCHITECTURE.md` §75). Ce qui **reste** : aucun
  échange réel avec iCloud n'a eu lieu — le réseau d'ici refuse
  `caldav.icloud.com`. Les trois appels HTTP ne seront éprouvés que sur son banc,
  avec un vrai mot de passe pour les apps. Tout ce qui décide, lui, est couvert
  ici. Ne pas l'annoncer vérifié avant.
- **Code SMS en renfort de l'acceptation** — l'empreinte, l'horodatage et
  l'adresse sont déjà conservés. **Sans objet en l'état**, pour la même raison.
- **Relance automatique** — l'état « à relancer » existe et s'affiche, le lien
  reste proposé pour un renvoi. **Sans objet en l'état** : aucun fournisseur
  d'envoi ne sera branché (`ARCHITECTURE.md` §13), la relance part de la
  messagerie du patron comme l'envoi.

---

## L'application est jugée trop chargée — mesuré, pas encore tranché (19 août)

**Sa plainte, la troisième** (11, 17 puis 19 août) : *« beaucoup trop de mots
dans tous les sens »*. Trois écrans ont été regardés à la taille de son
téléphone et leurs mots comptés :

| Écran | Aujourd'hui | Proposé |
|---|---|---|
| Fiche client | 39 mots | 19 |
| Accueil | 35 mots | 21 |
| Réglages | 89 mots | 26 |

**Proposé, pas codé** — `appli/moins-de-mots.html` est **Atlas dépouillé et
utilisable** : la barre du bas marche, « Créer un devis » ouvre la fiche, les
champs se remplissent, le devis part ; un bouton « Avant » remet l'écran
d'aujourd'hui. Sans JavaScript. Liée depuis `appli/essais.html` — la seule
adresse qu'il puisse ouvrir. Et `docs/QUESTIONS.md` §23. **Rien dans `src/`**
tant qu'il n'a pas choisi (`CLAUDE.md` §3 bis).

Ce qui compte le plus n'est pas les trois écrans : c'est que **rien n'empêche
l'application de regrossir**. Les deux fois précédentes, un écran a été corrigé
et la gêne est revenue ailleurs.

## Ce qui bloque, et qui n'avancera pas en codant

**Cinq** points, tous dans **`docs/A-FAIRE.md`**, tous en attente d'une
décision du patron. Celui du fournisseur d'envoi a été tranché le
2026-08-04 : il n'y en aura pas, et il est laissé barré ci-dessous pour éviter
qu'on le rouvre.

1. Choisir les deux fournisseurs d'IA définitifs (transcription, raisonnement).
   **Ce point a un effet visible tous les jours** : sans modèle, la dictée est
   seulement *recopiée*, jamais comprise. La recopie ne perd plus rien (voir
   `scripts/test-analyse-dictee.ts`) et elle mène désormais jusqu'au devis
   chiffré, mais elle ne sait pas qu'un chêne mort s'abat et qu'une haie se
   taille — et l'écran l'annonce plutôt que de la faire passer pour une analyse.
2. Faire rédiger le contrat de sous-traitance par un juriste.
3. Choisir un hébergement européen — **sans lui, personne d'autre que le patron
   ne peut se servir de l'application**. N'empêche NI d'essayer NI de finir le
   produit : voir `docs/ESSAYER.md`. La marche à suivre, les fournisseurs
   candidats et le partage des tâches sont détaillés dans `docs/A-FAIRE.md` §3.
4. Constituer une société et souscrire une assurance cyber.
5. ~~Brancher un fournisseur SMS et e-mail~~ — **tranché le 2026-08-04 : il n'y
   en aura pas** (`ARCHITECTURE.md` §13). Le patron ouvre lui-même sa
   messagerie, message et destinataire déjà remplis, et appuie sur envoyer.
   Ce point ne bloque donc plus, et il **allège** les points 2 et 3 : aucune
   donnée de client ne transitant chez un tiers, il n'y a aucun sous-traitant de
   plus à autoriser. Restent hors de portée, en conforts et non en blocages :
   relance automatique à sept jours, départ automatique de la facture, accusé de
   réception, code SMS à l'acceptation.
6. Choisir l'outil comptable qui **émet** les factures — le patron n'en a aucun
   à ce jour (8 août 2026). Ne pas confondre avec la réserve ci-dessous : que
   Atlas n'émette pas est **définitif** ; ce qui est ouvert, c'est seulement sur
   quoi se brancher. Chaque outil ayant son API, il n'y a rien à coder avant le
   choix. Deux obligations distinctes en dépendent — la conformité des factures
   des artisans à qui Atlas sera vendu, et celle d'Eden Nature pour ses propres
   factures, qu'Atlas existe ou non.

---

## Le terrain n'est pas vierge : deux concurrents directs

Découverts le 2026-08-03 **en cherchant un nom** — pas au cours d'une étude de
marché. C'est écrit ici parce qu'une conversation qui l'ignore raisonnerait
comme si le créneau était libre, et il ne l'est pas.

| Concurrent | Ce qu'il a pris | Ce qu'on en apprend |
|---|---|---|
| [`ouvra.app`](https://ouvra.app/) — SAS Automate, Paris | **Un métier** : plombiers-chauffagistes uniquement. Devis signé sur place, Factur-X 2026, relances automatiques. Catalogue de prestations pré-rempli, TVA du secteur. | Se restreindre à un métier permet de livrer un catalogue et des mentions légales *déjà justes*. C'est exactement ce que notre §3 d'`AGENT.md` refuse de deviner. |
| [`fabro.app`](https://fabro.app/en/) — app iOS artisans | **L'absence de réseau** : 100 % hors ligne, données sur le téléphone, multi-pays. | Sur un chantier, il n'y a pas de réseau. Notre parcours suppose l'inverse à chaque étape. |

**Notre angle reste distinct** : ni l'un ni l'autre ne part de la **dictée** ni
ne fait travailler un **agent** entre la note vocale et la facture. Ils
numérisent un formulaire ; nous supprimons le formulaire. Mais l'angle n'est
plus une évidence à ne pas défendre.

## Le nom « Atlas » est provisoire, et probablement indéposable

« Atlas » n'a jamais été choisi ni vérifié : c'est un nom de travail. Le mot est
massivement occupé dans les classes 9 et 42, ce qui rend le dépôt de marque et
la visibilité App Store douteux. **Un nom définitif est en cours d'arbitrage
avec le patron** (branche `claude/app-name-choice-hk5jz4`) ; rien n'est renommé
tant qu'il n'a pas tranché.

Onze candidats ont déjà été écartés sur occupation vérifiée — Silex, Ouvra,
Vulcain, Sève, Orme, Fabro, Amadou, Braise (voisin de Braze), entre autres. La
leçon vaut pour les suivants : **vérifier l'occupation avant de proposer**, un
mot ordinaire libre en classes 9/42 est devenu l'exception.

---

## Réserves assumées, à ne pas « corriger » par erreur

- **Atlas prépare, il n'émet pas.** La facture et le relevé de TVA sont
  préparés ; l'émission légale et la déclaration reviennent à l'outil comptable
  (`docs/AGENT.md` §6). Ce n'est pas « pas encore » : c'est définitif, et la
  réserve est affichée à l'écran du relevé.
- **Le dépôt est public**, décision du patron du 2026-08-01. `docs/RGPD.md` y
  compris. Voir `docs/QUESTIONS.md` §6 et §7.
- **La signature des commits est impossible** dans l'environnement d'exécution :
  la clé SSH configurée est un fichier vide sans partie privée. Signalé une fois,
  non contourné.
- **Une réponse à l'arrêt d'avant-chiffrage ne change pas encore le montant.**
  Ce n'est pas un oubli : `docs/EXEMPLE-DICTEE.md` §9c l'exige tant qu'aucun
  rapport n'a été observé entre les techniques et les prix. Ce qui manque est la
  mémoire (`TODO.md` §0 bis a et c), pas la question.
- **La sauvegarde *automatique* n'existe pas, et c'est un blocage réel** — pas
  un oubli. Elle exige une destination extérieure, donc l'hébergeur (point 3
  ci-dessus). Le bouton « Télécharger mes données » couvre l'essentiel en
  attendant. Voir `ARCHITECTURE.md` §25 et `TODO.md` §0.

---

## Éprouver ici : PostgreSQL et Redis tournent, sans Docker

**Corrigé le 2026-08-05, contre ce que le dépôt affirmait.** Docker manque bien,
mais les binaires PostgreSQL 16 et `redis-server` sont installés dans
l'environnement d'exécution de l'agent. Une commande monte le tout :

```bash
source scripts/monter-base-locale.sh   # cluster, rôles, Redis, migrations
npm test
```

La croyance inverse coûtait cher : « c'est la CI qui vérifiera » a été dit trois
fois alors que la CI n'avait jamais tourné, et les suites base n'étaient donc
éprouvées nulle part. **Cela ne remplace pas la CI** — le mandataire réseau et
l'absence de Docker restent réels pour le reste (voir `ARCHITECTURE.md` §15
et §17).

---

## Vérifications au dernier point

| | |
|---|---|
| Suites base de données | **99/99**, jouées dans l'environnement de l'agent |
| Suites navigateur (bout en bout) | **44/44**, jouées dans l'environnement de l'agent |
| Types, lint | propres |
| CI GitHub | verte au commit `78c746a` ; `07fa28c` en cours au moment d'écrire |
