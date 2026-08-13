# État du projet

**Dernière mise à jour :** 2026-08-13 · branche `main`
· dernière migration `drizzle/0036_monsieur_plutot_que_chez.sql`

---

**Dernière mise à jour :** 2026-08-12 · branche `claude/chantier-phototech-direct-ujt2wv`
· dernière migration `drizzle/0036_achats_tva.sql`

---


*(Le numéro du dernier commit ne figure plus ici : il était faux dès le commit
suivant, et une ligne fausse coûte plus cher qu'une ligne absente. `git log
--oneline -20` le dit sans risque de se tromper.)*

Ce fichier dit **où en est le produit**, pas ce qu'on aimerait qu'il soit. Une
ligne « fait » qui ne l'est pas coûte plus cher qu'une ligne absente.

---

## Ce qu'est Atlas

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

### Le socle (antérieur à cette série de travaux)

Chantiers, photos, note vocale, transcription, informations structurées, calcul
du prix, devis PDF, planning, catalogue, réglages tarifs. Authentification
(Auth.js), isolation par entreprise (RLS `FORCE`), stockage de fichiers,
limitation de débit, purge planifiée, journalisation. Assistant IA en lecture
seule avec quinze outils.

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
  civilité sur la fiche client, une cliente est nommée « Mr. ». À trancher
  avec lui. Le message tout prêt l'aborde de la même façon (« Bonjour
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
  environnement. `ARCHITECTURE.md` §82.
- **La TVA au mois ou au trimestre, et son calendrier** (12 août) : Réglages
  porte le choix, le mois coché d'avance — c'est le défaut légal (déclaration
  CA3 mensuelle ; le trimestre est une option sous 4 000 € de TVA due). L'écran
  de TVA et son calendrier suivent : douze pavés ou quatre. **Atlas ne dit
  jamais lequel s'applique** — le seuil porte sur la TVA due, or il ne connaît
  que la collectée. Migration `drizzle/0035_periodicite_tva.sql`.
  `ARCHITECTURE.md` §81.
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
