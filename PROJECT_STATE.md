# État du projet

**Dernière mise à jour :** 2026-08-10 · branche `claude/migrate-app-atlas-zz31ac`
· dernière migration `drizzle/0033_identifiants_google_par_entreprise.sql`

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
| **Chemin du planning vers la facture**, et rangement en un seul onglet | `src/lib/onglet-chantier.ts`, `src/app/planning/PlanningClient.tsx` |
| Installation sur téléphone : icône, plein écran, marges de sécurité | `src/app/layout.tsx`, `src/app/globals.css`, `scripts/generer-icones.mjs` |
| Relevé de TVA collectée, par trimestre | `src/app/termines/tva/` + `src/server/trimestre.ts` |
| Devis PDF reprenant le modèle du patron, sur autant de pages qu'il faut | `src/server/pdf/devis-pdf.ts` |
| Découpage de la dictée en prestations, matériel, déchets, durée, équipe | `src/server/orchestrateur/analyse-demande.ts` |
| Planning en demi-journées et nombre d'équipes (le client ne voit que la date) | `src/server/disponibilites.ts` + `drizzle/0019_creneaux_et_equipes.sql` |
| Correction demandée par le client, avec son message porté au patron | `src/app/devis/[jeton]/formulaire.tsx` + `src/lib/etat-envoi.ts` |
| Écrire le devis soi-même, sans passer par la proposition de prix | `src/app/chantiers/[id]/informations/InformationsClient.tsx` → `prix?saisie=manuelle` |
| Transmission au client : messagerie ouverte **au bon destinataire**, canal changeable, coordonnée saisissable sur place | `src/app/chantiers/[id]/export/TransmettreAuClient.tsx` |
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

### La refonte de l'interface (10 août 2026)

Le patron a arrêté un écran après une soirée de maquettes
(`docs/maquettes/`, treize propositions), puis l'a fait poser dans
l'application. Ce qui est **fait** :

- **L'accueil** : le fil qui porte les jours, la perle d'or sur ce qui attend un
  geste, le trait qui glisse sous les onglets, et « Nouveau chantier » qui monte
  en feuille pendant que la liste recule.
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

## Ce qui reste, et que je peux faire seul

Voir `TODO.md` pour le détail et l'ordre.

- **Agenda Google** — la connexion du compte demande des identifiants que je n'ai
  pas ; le reste (lecture des disponibilités, écriture de l'intervention) est
  codable.
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
