# Reprendre le travail

**À lire en premier, dans une nouvelle conversation.** Ce fichier suppose que
vous ne savez rien de ce qui précède — c'est exactement le cas de figure qu'il
sert.

**Point de reprise :** 2026-08-25 · `main`
(l'historique fait foi : `git log --oneline -20`)

---

## LES SALARIÉS NE SONT PLUS LES ÉQUIPES — à savoir avant d'y toucher (26 août 2026)

**La chose à comprendre en trente secondes**, parce que le nommage n'a pas suivi :

| Ce qu'on lit dans le code | Ce que ça veut dire depuis le 26 août |
|---|---|
| `entreprises.nombre_equipes` | la CAPACITÉ — combien de chantiers par jour |
| `entreprises.nombre_salaries` | combien de GENS — donc de noms cochables |
| table `equipes` | **les salariés** (rang + nom facultatif) |
| table `equipes_du_chantier` | **qui part**, demi-journée par demi-journée |

⚠ **La table `equipes` porte les gars, pas des files de planning.** Le renommage
est une tâche à part (`TODO.md`) : vingt-trois fichiers, les politiques RLS, les
contraintes. Ne pas le mêler à autre chose.

**Ce qu'il a interdit de changer, mot pour mot :** *« il ne faut pas changer la
méthode d'affiliation des gars sur les chantiers […] on garde la même façon de
faire »*, et *« 2 équipes = 2 chantiers par jour, comme avant, ça ne bouge
pas »*.

**LE PIÈGE, si l'on touche à la charge du planning.** On coche désormais des
GENS : trois gars peuvent tenir sur une entreprise à deux chantiers par jour.
`equipesMobilisees` plafonne donc la charge à la capacité. Retirer ce plafond
ferait fermer par un seul chantier une journée qui en accepte deux — et l'écran
d'envoi refuserait au client des jours réellement libres, pendant que le
planning les annonce.

`compterOccupation` exige `nombreEquipes` **sans valeur par défaut**, et c'est
délibéré : un appelant oublié compterait sans plafond en silence. Ne pas ajouter
de défaut « pour simplifier ».

**Et le plancher des salariés est ZÉRO**, pas un : un artisan seul n'a personne.
Le remonter ferait apparaître une case « Salarié 1 » à cocher sur chacune de ses
demi-journées.

Le détail : `ARCHITECTURE.md` §192, migration `drizzle/0067_salaries_a_part.sql`.

---

## UNE RÉPONSE ENCORE ATTENDUE DE LUI — planche 96 (26 août 2026)

Rien n'est codé dans `src/` pour ces deux-là, et il ne faut pas commencer sans
sa réponse (`CLAUDE.md` §3 bis).

- **Planche 96** — `appli/ecran-equipe.html`. Il a répondu **C** pour le titre
  et la synthèse. Reste à savoir si la phrase sur les congés reste sur l'écran
  Équipe ou retourne dans « Absences ». **Non codée.**
- **Planche 97** — `appli/salaries-et-equipes.html`. **Répondue (A) et codée le
  26 août** : voir le paragraphe ci-dessus.
## PIÈGE : UN BOUTON RADIO NE SE DÉCOCHE PAS (26 août 2026)

Sa plainte du 26 août, sur la page de son client : *« je ne peux plus le
désélectionner »*. Ce n'était pas le produit — **le navigateur ne sait pas
décocher un radio**, il ne connaît que « passer de l'un à l'autre ».

Ce qu'il faut savoir avant d'y retoucher, et qui ne se devine pas :

- **`onChange` ne part JAMAIS** sur une case déjà cochée : le navigateur ne
  signale un changement que s'il y en a un. C'est `onClick` qui attrape ce
  geste-là, et lui seul ;
- **React ne repeint pas entre deux gestionnaires d'un même événement** : à
  l'entrée de `onClick`, l'état porte encore la valeur d'avant l'appui. La
  comparaison « c'est déjà celle-ci ? » suffit donc, sans drapeau — un drapeau
  survivrait à un rendu et défairait le choix suivant ;
- **le contrôle qui compte n'est pas « ça se défait »**, c'est *« un appui sur
  une AUTRE ligne choisit toujours »* : défaire à chaque appui passe le premier
  et rend le formulaire inutilisable.

`src/app/devis/[jeton]/formulaire.tsx`, `ARCHITECTURE.md` §191. Le même piège
dort sur `PropositionPrixSection.tsx` (`TODO.md`).

---

## PIÈGE : UNE SUITE QUI LIT LE MOIS AFFICHÉ ROUGIT EN FIN DE MOIS (26 août 2026)

`test-envoi-client-e2e` a rougi le 26 août — **et à l'identique sur `main`**. Elle
cherchait deux jours libres au-delà du délai minimal (J+3) dans le mois AFFICHÉ,
qui commence toujours au 1er. À deux jours de la fin du mois, il n'en restait
qu'un. Le produit était sain ; c'est le contrôle qui n'avait pas prévu la date du
jour.

**Devant une suite de calendrier rouge, regarder d'abord le quantième.** Le
remède est écrit : `joursRetenables` tourne la page du mois quand celui-ci est
trop court. Toute suite neuve qui compte des jours doit faire de même.

## PIÈGE : UN MESSAGE QUI ACCUSE LE PATRON (26 août 2026)

**« L'assistant a mal formé sa demande à un outil interne. Reformulez votre
question. »** — il a reformulé trois fois, et c'est exactement ce qu'on lui
demandait de faire. La faute était le nom d'un champ, côté modèle.

| | |
|---|---|
| **Un outil mal appelé n'est pas une panne** | le refus part AU MODÈLE, avec les champs qui manquent, et il rappelle. Ne pas remettre un `return` d'erreur à cet endroit |
| **Les alias sont volontaires** | `nom`, `motCle` et `question` désignent la même idée selon l'outil : les quatre acceptent les trois. Ne pas « nettoyer » ça |
| **Jamais de JSON à l'écran** | une erreur d'outil est adressée au MODÈLE. `direEnFrancais` s'en charge côté fournisseur d'essai |
| **Le point d'injection de `fabrique.ts`** | sert à éprouver un modèle qui SE TROMPE. Sans lui, ce défaut ne se retient pas |

## L'ASSISTANT EST UN AGENT : CE QU'IL FAUT SAVOIR AVANT D'Y TOUCHER (26 août 2026)

| | |
|---|---|
| **Rien en direct, jamais** | tout geste est une proposition cochée. Sa règle : *« très important que ça reste le doigt du patron »*. Ne pas « simplifier » en exécutant un geste anodin |
| **Envoyer, valider, émettre** | ne sont PAS des gestes de l'assistant, et ne le deviendront pas sans qu'il le redemande en face |
| **On vise par identifiant** | jamais par nom. Un geste qui accepterait un nom corrigerait le mauvais Martin |
| **La cible se relit à l'ÉCRITURE** | pas à la proposition. Entre les deux, il a pu la supprimer |
| **Le périmètre a DEUX conditions** | marque du dehors **et** aucun mot d'Atlas. Retirer la seconde ferait taire l'assistant sur de vraies questions — c'est le piège, pas le refus |
| **« temps » n'est pas un mot du dehors** | il dit aussi le temps passé sur un chantier. Les mots ambigus restent hors de la liste, délibérément |
| **Une proposition peut n'avoir aucun chantier** | migration 0067. La réclamation compare avec `IS NOT DISTINCT FROM` : `= NULL` ne retrouverait rien |

## L'ASSISTANT RÉCITE UN MODE D'EMPLOI ÉCRIT (25 août 2026)

Avant d'y toucher :

| | |
|---|---|
| **Les gestes vivent dans un fichier, pas dans le modèle** | `src/lib/mode-emploi.ts`. L'assistant les récite **tels quels** : ne pas lui laisser reformuler, ce serait une seconde version du mode d'emploi |
| **Une fiche se PROUVE** | elle porte `source` (un fichier) et `preuves` (des morceaux de texte qui doivent s'y trouver). Vous changez un libellé d'écran ? `npx tsx scripts/test-mode-emploi.ts` vous dira quelle fiche vient de mentir |
| **Rougir est le comportement voulu** | ne « réparez » pas une fiche en retirant sa preuve : corrigez le geste. Une fiche sans preuve n'est plus confrontable, et le contrôle l'interdit |
| **La recherche doit savoir NE RIEN trouver** | deux mots communs minimum, un mot-clé plein minimum. Relâcher ces seuils fait répondre à des questions qui n'en sont pas, et l'on cesse alors de croire l'assistant |
| **Le mode d'emploi passe EN TÊTE de la chaîne du fournisseur** | sinon « comment je supprime un client ? » repart dans la branche des suppressions et propose de modifier ses données. C'est le défaut qui a motivé l'ordre actuel de `src/server/ai/providers/llm/dev.ts` |
| **Regarder l'écran, pas seulement le vert** | `npx tsx scripts/capture-assistant-mode-emploi.mts <dossier>` (serveur démarré). C'est lui qui a montré la réponse à trois gestes que douze tests verts ne voyaient pas |
| **L'assistant est réservé au propriétaire** | le bouton disparaît, mais la barrière est dans les deux actions serveur. Ne pas la retirer « parce que le bouton n'est pas là » |

## PHOTOGRAPHIER UN DEVIS POUR EN REPRENDRE L'ALLURE (25 août 2026)

Nouvelle brique, sur l'écran Réglages → Documents. Avant d'y toucher :

| | |
|---|---|
| **La lecture vit dans un service** | `src/server/ai/services/lire-allure-devis.ts`. `lireReponseAllure` est PURE et éprouvée sans clé (`scripts/test-lecture-allure-devis.ts`) ; `lireAllureDevis` appelle le fournisseur de vision — **non vérifié ici**, à jouer sur son espace avec sa clé, comme la dictée |
| **L'action fusionne, elle n'écrase pas** | `reprendreAllurePhotoAction` (`actions.ts`) : un champ non lu (`null`) laisse la valeur d'avant. On ne pose une police que sur une famille reconnue ; une couleur mal lue vaut `null` ; un acompte hors bornes tombe |
| **Le logo n'est JAMAIS repris** | un modèle décrit une image, il ne la découpe pas. La réserve le dit toujours — ne pas « améliorer » ça en croyant reprendre le logo |
| **La photo passe par la porte unique** | `preparerPhotoEntrante`, comme le logo : métadonnées GPS retirées avant tout envoi |
| **Vu à l'écran** | `npx tsx scripts/capture-documents-photo.mts <dossier>` (serveur bâti + connecté). Le `next dev` de ce conteneur ne découvre pas les routes — servir une version **bâtie** (`next build` + `next start`, `ATLAS_PROFIL=banc AUTH_TRUST_HOST=true`) |

## RÔLES ET ACCÈS : ce qu'il faut savoir avant d'y toucher (25 août 2026)

Le cloisonnement par rôle existe depuis ce jour-là. Trois choses à connaître
avant d'écrire un écran ou une route :

| | |
|---|---|
| **La règle est UNE fonction pure** | `src/lib/acces-roles.ts`. Elle dessine la barre du bas, filtre le sommaire des réglages, ET refuse les adresses. Ne pas en écrire une seconde |
| **Un ÉCRAN neuf n'a rien à faire** | il traverse `layout.tsx`, donc `GardeAcces`. Fermé d'office au salarié (liste blanche), ouvert au commercial |
| **Une ROUTE d'API neuve, SI** | elle ne traverse aucune mise en page. `const refus = await exigerOuverture(ctx); if (refus) return refus;` en tête du handler. `scripts/test-acces-routes-gardees.ts` rougit sinon |

**Le piège à connaître, et il a coûté un rouge pendant ce lot :** écrire dans
`membres_entreprise` par `db` en direct, hors `withEntreprise`. La RLS refuse
**sans erreur** — zéro ligne touchée, aucun message —, et le contrôle rougit
alors en accusant tout autre chose. C'est `CLAUDE.md` §3, rencontré dans un test.

**Ce qu'un salarié ATTEINT, et rien d'autre :** `/planning`, ses quatre réglages
personnels, `/documents-legaux`, et `/api/chantiers/<id>/feuille/pdf` — le devis
sans un seul montant. Ouvrir un cinquième chemin se fait dans `OUVERT_AU_SALARIE`
et se paie d'une ligne dans `scripts/test-acces-roles.ts`, à la main. C'est
voulu : c'est le seul moment où quelqu'un regarde.

---

## LOT 2B FERMÉ, ET SEPT CONTRÔLES RÉPARÉS AVEC LUI (25 août 2026)

M3 et M6 sont clos. Ce qu'il faut savoir avant d'y toucher :

| | |
|---|---|
| **Une seule porte pour les images** | `src/server/photo-entrante.ts`. Cinq chemins la traversent, **le logo d'entreprise compris**. Trois contrôles structurels empêchent qu'un sixième fasse sa propre cuisine |
| **Si le nettoyage échoue, on REFUSE** | c'est l'inverse de la règle du matin même, et le revirement est assumé : un fichier illisible était rangé avec ses coordonnées GPS |
| **Le corps est borné PENDANT sa lecture** | `src/server/corps-borne.ts`. `content-length` est un premier refus, jamais la garantie — il est écrit par le client |

**Et le piège qui a coûté cinq batteries.** Sept suites navigateur sont tombées
en chemin, **aucune à cause du lot**, toutes vertes rejouées seules. Deux causes,
et elles reviendront :

1. **un délai fixe à la place d'un signal** — `waitForTimeout(300)` après une
   action serveur, `waitForURL` suivi d'un `innerText` alors que la page porte
   encore « Chargement… ». Sous la batterie complète, ces délais sont dépassés,
   et le contrôle accuse alors le produit ;
2. **une formulation à la place d'une règle** — la date « 1 mars » quand
   le français écrit « 1er mars », ou l'une des deux phrases d'un écran qui en
   a deux selon son état.

Devant une suite navigateur rouge, **la jouer seule d'abord** :
`npm run test:e2e -- --seulement "<un bout du nom>"`. Verte seule, rouge en
batterie : c'est l'une de ces deux causes, jamais un défaut du produit.

---

## LE CALENDRIER D'ENVOI : TOUCHER, C'EST PROPOSER (25 août 2026)

Sa demande — *« je dois pouvoir sélectionner les jours juste en les touchant,
pas besoin de cliquer sur proposer »* — a retiré « Proposer ce jour » de la
fiche du jour, sur l'écran d'envoi au client.

**Le piège si vous touchez à ces suites :** deux d'entre elles refermaient la
fiche par un SECOND appui sur la même case. Ce geste retire aujourd'hui la date
qu'on vient de poser — une suite qui le garde compte une date sur deux, et
accuse le code. Détail : `ARCHITECTURE.md` §170.


---

## PIÈGE : « TOUT REMONTE » N'EST PAS UN DÉFILEMENT (23 août 2026)

**Si un écran d'Atlas saute sous le doigt, ne cherchez pas de `scrollTo` — il
n'y en a pas.** Sur le planning, ouvrir une fiche en REFERME une autre
(`carteListe` n'en porte qu'une). Quand la fiche refermée était plus haut dans
la page, tout ce qui suit remonte de sa hauteur : 422 px mesurés, et la ligne
touchée sort de l'écran.

**Safari n'implémente pas `overflow-anchor`** — et c'est Safari qu'il a dans la
main. Le rattrapage est donc à notre charge : `useAncrageDuGeste` relève la
position de la ligne dans le gestionnaire, et la restaure en `useLayoutEffect`
(jamais `useEffect` : le second peint d'abord, et l'on verrait le saut).

Le même piège guette partout où un panneau se referme au-dessus du point
regardé. Détail : `ARCHITECTURE.md` §157.
## PIÈGE : UN LIEN ENVOYÉ AU CLIENT PREND L'ADRESSE DU NAVIGATEUR (24 août 2026)

**Devant « le client ne reçoit rien » ou « connexion au serveur impossible » :
regarder d'abord PAR QUELLE ADRESSE il a ouvert Atlas.**

Un lien fabriqué depuis `http://localhost:3000` — la redirection de port de son
éditeur — désigne le téléphone du client. Le rapport, le devis ou la facture
existent, leur jeton est bon ; seule l'adresse ne mène nulle part.

Atlas refuse maintenant de composer le message et le DIT (`ouvrableParLeClient`,
`src/lib/adresse-du-client.ts`). Deux choses à savoir :

- **`ATLAS_URL_PUBLIQUE`** est la réponse d'un déploiement derrière un mandataire
  muet — posée, elle commande. Son banc ne la pose pas, et n'en a pas besoin tant
  qu'il ouvre Atlas par l'adresse de son espace.
- **Les suites navigateur DÉCLARENT une adresse publique** (`run-e2e-tests.ts`) :
  sans cela, tournant sur `localhost`, elles rougiraient toutes en accusant
  l'envoi. Le refus lui-même s'éprouve sans navigateur
  (`test-adresse-du-client.ts`).

Détail : `ARCHITECTURE.md` §169.

---

## Fiche de chantier : ce que le 24 août a changé (aucune migration)

Deux plaintes de sa part, un même mécanisme derrière : **un écran qui retire ce
dont on se sert au moment où l'on commence à s'en servir.**

- **Un brouillon se supprime** depuis la liste — croix, puis « Annuler » pendant
  six secondes (`useRetraits`, sa règle du 10 août). **Un rapport parti, non** :
  son lien vit chez le client, et l'effacer changerait cette adresse en page
  morte. `supprimerPassage` refuse, et l'écran ne pose pas de croix dessus.
- **L'endroit où la fiche se compose n'avait pas disparu** : son lien vivait
  dans l'encart de la fiche VIDE, qui s'efface à la première prestation posée.
  Il est désormais en bas de `/paysage/fiche`, en permanence, pour le seul
  propriétaire.
- **Les catégories se créent nommées et se retirent d'un geste** — avant, créer
  rangeait dans « Divers » et retirer n'existait pas.

**Rien en base** : aucune migration, la table `passages_entretien` portait déjà
son `GRANT DELETE` et sa politique d'isolation (migration 0055).

**Et ce qui vaut d'être retenu :** trois défauts de ce lot sont sortis de
CAPTURES REGARDÉES, aucun d'une suite rouge — un titre resté seul, deux croix
identiques aux conséquences très différentes, une ligne serrée contre la barre
d'onglets. C'est la sixième fois dans ce dépôt. Détail : `ARCHITECTURE.md` §168.

---

## QUATRE MIGRATIONS, DEUX NUMÉROS EN DOUBLE — et ce n'est pas cassé

Le 23-24 août 2026, plusieurs sessions ont travaillé en parallèle et se sont
croisées sur la numérotation :

| Numéro | Les deux fichiers |
|---|---|
| **0062** | `message_client` · `tentatives_connexion` |
| **0063** | `allure_documents` · `cles_appareil` |

**Rien ne casse** : `run-migrations.ts` trie par nom de fichier complet et
retient chaque nom séparément dans `_migrations`. Les quatre s'appliquent,
toujours dans le même ordre, et aucune ne dépend d'une autre.

**Ce qu'il ne faut PAS faire : en renommer une.** Le suivi est keyé sur le nom
du fichier ; le changer ferait rejouer la migration sur toute base qui l'a déjà.

**Et la leçon, elle, se retient :** un numéro de migration ne se réserve pas.
Avant d'en poser un, regarder `git branch -r --sort=-committerdate` et le
`drizzle/` des branches vivantes (`CLAUDE.md` §6, point A). La suite reprend à
**0064**.

---

## FACE ID : CODÉ LE 24 AOÛT 2026 — SA RÉPONSE EST **B**

Planche 94 (`appli/face-id.html`), tranchée : la porte d'aujourd'hui, **plus une
ligne au-dessus**. Rien n'a changé de place — `name="email"`, `name="password"`
et `type="submit"` sont où ils étaient, ce dont dépendent vingt scripts de
capture et `verifier-connexion.mjs`. Détail complet : `ARCHITECTURE.md` §163.

**À POSER LE JOUR DU DÉPLOIEMENT : `ATLAS_RP_ID`** (le domaine nu, `atlas.fr`).
Sans elle, Atlas **refuse** d'enregistrer une clé en production — et le dit dans
son journal, pas à l'écran. C'est volontaire : deviner le domaine depuis
l'en-tête `Host` reviendrait à croire ce que le client écrit.

**Le piège de ce lot, et il est déjà désamorcé : `next-auth` porte un
fournisseur `passkey` tout fait, il est dans `node_modules`, et le prendre
paraît évident. `@auth/core` refuse le WebAuthn **sans adaptateur de base**
(« WebAuthn requires an adapter ») ; Atlas n'en a aucun, sa session est un JWT
sans table. En brancher un ferait naître `accounts`/`sessions`, changerait la
façon dont chaque requête retrouve l'utilisateur, et remettrait en jeu le
contexte d'entreprise, `middleware.ts` et la déconnexion partout — **pour un
bouton sur la porte**. Le chemin retenu est un **second fournisseur
`Credentials`** qui vérifie l'assertion avec `@simplewebauthn/server` : la couche
session ne bouge pas (`ARCHITECTURE.md` §163).

**Trois choses viennent de lui et ne se rouvrent pas :** le mot de passe ne se
retire jamais, le compte se crée au mot de passe, et **un échec de visage ne
compte aucune tentative ratée** — appeler `noterEchec` sur ce chemin ferait
temporiser son compte parce que son téléphone ne l'a pas reconnu, c'est-à-dire la
panne du 6 août 2026 refaite par un autre bord.

**Et un piège de CONTRÔLE, payé le 24 août.** La suite qui garde cette
troisième règle a d'abord été écrite avec un appareil simulé réglé pour refuser
le visage. Elle est restée **verte contre un `noterEchec` posé exprès** : le
navigateur refusait de lui-même, le serveur n'était jamais atteint, et
l'assertion ne mesurait rien. Le cas qui prouve quelque chose est celui où le
téléphone signe **correctement** et où c'est Atlas qui ne connaît plus la clé —
la clé retirée depuis un autre appareil. Avant d'écrire un contrôle sur ce
chemin : *le serveur est-il seulement atteint ?*

---

## SÉCURITÉ : CE QUI A CHANGÉ LE 23 AOÛT 2026, ET LES TROIS PIÈGES À NE PAS REFAIRE

Un audit hostile a été mené, et son **lot 1** est corrigé. Le détail est en
`ARCHITECTURE.md` §162 ; la suite est dans `TODO.md`. Ce qu'il faut avoir en
tête avant de toucher à ces zones :

**Ce qui a changé, en une ligne chacun :**

| | |
|---|---|
| `src/lib/tentatives-connexion.ts` + migration 0062 | la temporisation par compte, **en base** — elle survit à une panne de Redis |
| `src/lib/source-visiteur.ts` | `x-forwarded-for` n'est cru que derrière `ATLAS_PROXY_SAUTS` |
| `src/lib/garde-seed.ts` | `db:seed` doit prouver sa cible avant tout `TRUNCATE` |
| `src/lib/destination-caldav.ts` | où Atlas a le droit d'aller frapper en CalDAV |
| `src/lib/confiance-hote.ts` | `trustHost`, **une seule fois** |
| `src/server/env.ts` | refuse « profil banc + déploiement réel » |

**LES TROIS PIÈGES — ils se re-tendront, et chacun casse quelque chose qui
marche :**

1. **Ne pas tirer au hasard le mot de passe de démonstration.** `demo1234` est
   attendu par **136 fichiers**, dont `verifier-connexion.mjs` — la dernière
   étape de la batterie de livraison. Il reste le défaut, et la garde du seed
   fait qu'il ne peut s'appliquer que sur une base d'essai.
2. **Ne pas interdire les redirections CalDAV.** iCloud renvoie `301` de
   `caldav.icloud.com` vers `p42-caldav.icloud.com` : l'interdire casserait
   **tout raccordement Apple**. Ce qui est interdit, c'est de SORTIR du domaine.
3. **Ne pas refuser le banc sur `NODE_ENV=production`.** Le banc EST
   « production + profil banc » — `next start` l'impose. Le critère est la
   contradiction : profil banc **et** S3, ou profil banc **et**
   `ATLAS_DEPLOIEMENT=production`.

**Et une règle qui vaut au-delà de ce lot :** une garde de rôle se pose sur
**l'action et l'écran**, jamais dans le dépôt. `apprendre-grille.ts` écrit des
prix tout seul pendant qu'un devis s'établit ; une garde posée trop bas aurait
empêché un salarié d'établir un devis, et personne n'aurait relié la panne à un
contrôle de rôle.


---

## LE PLAN D'ARROSAGE EST DESSINÉ — CE QU'IL FAUT SAVOIR AVANT D'Y TOUCHER (23 août 2026)

**Trois fichiers purs, et aucun ne recalcule ce qui existait :**

| | |
|---|---|
| `src/lib/arrosage/terrain.ts` | le contour, **union** des zones (jamais leur juxtaposition) |
| `src/lib/arrosage/trace.ts` | par où passe le tuyau — graphe + plus-court-chemin |
| `src/lib/arrosage/plan-dessine.ts` | l'assemblage, les réserves et **les deux refus** |

`calcul.js` n'a gagné que `dessin` : la mise au jour des points que `poser()`
calculait déjà, en coordonnées absolues. **Ne pas en écrire un second** — la
divergence que `CLAUDE.md` §3 interdit se paie en matériel commandé de travers.

### Les deux refus sont durs, et c'est voulu

Pas d'endroit **définitif** de la nourrice → aucun plan : ni dessin, **ni liste
de pièces**. Une liste sans tracé se commande quand même. Idem si le croquis ne
situe pas les zones les unes par rapport aux autres : le calcul rend alors
`x = 0, y = 0`, deux pelouses se superposeraient exactement, et rien ne le
dirait.

**La nourrice n'est jamais déduite** (sa règle du 22 août). `lire-croquis.ts` la
cherche et rend `null` si elle n'est pas dessinée.

### Ce qui n'a PAS pu être éprouvé ici

La lecture réelle d'une photo : le modèle doit désormais rendre `x_m`, `y_m` par
zone et l'endroit de la nourrice. **Aucune clé de vision dans cet
environnement** — la fonction pure `lireReponseCroquis` est éprouvée
(`test-lecture-croquis.ts`), l'appel au fournisseur ne l'est pas. Premier essai à
faire sur son banc.

### LA DISCUSSION POSE UN PARAMÈTRE, ELLE NE DESSINE PAS (23 août 2026)

Ce qui sort d'un message est **une consigne** prise dans une liste fermée
(`consignes.ts`) : marque, corps, matériel d'une zone, buse d'une zone, sonde.
Rien d'autre. C'est le calcul qui refait le plan.

**Ne pas élargir cette liste sans y réfléchir** : un plan retouché à la main ne
se recalcule plus, et la fois d'après le tracé, les métrés et les pièces ne
viennent plus de la même source.

**La nourrice n'y est pas, et ne doit pas y entrer** (`CLAUDE.md` §4 bis). Elle
voyage dans les paramètres parce que le DESSIN en a besoin, pas parce qu'elle
serait réglable.

**Le fil ne s'affiche qu'avec un plan** — sa borne : *« la discussion ne doit
jamais créer un plan »*. C'est l'absence qui est éprouvée en e2e.

### DEUX ÉCHELLES, ET NE PAS LES CONFONDRE (23 août 2026)

| | Ce qu'elle sert | Devant un dessin approximatif |
|---|---|---|
| `echelleDuCroquis` | le trajet du regard → la pression → l'espacement | **refuse** |
| `echelleTolerante` | le dessin | **conclut**, et le dit en réserve |

**Ne pas « harmoniser » les deux.** Une pelouse placée de travers se voit à
l'œil ; une pression fausse ne se voit qu'en juillet. C'est sa correction :
*« les utilisateurs ne vont pas s'amuser à faire des croquis à l'échelle »*.

**Et l'agencement n'est pas l'un des trois éléments obligatoires** (métrés,
piquage, nourrice). Un agencement illisible ne retire que le DESSIN : le plan
sort quand même, avec une réserve qui dit pourquoi.

### LE CROQUIS SE LIT EN FRACTIONS, ET UN SEUL ENDROIT LES CONVERTIT

`lire-croquis.ts` rend des places **en fraction du dessin** (0 à 1), jamais des
mètres — c'est tout ce qu'une image permet. `poserSurLeTerrain()`, dans
`geometrie-croquis.ts`, en fait des mètres pour le dessin ; c'est le même module
qui déduit l'échelle pour le trajet du regard, **et il ne doit pas y en avoir un
second**. Les côtés viennent des cotes lues, la place vient du dessin.

**Le défaut à craindre est muet** : oublier la conversion laisse un plan
cohérent avec lui-même, dessiné sur un jardin d'un mètre de large. Il est
éprouvé sur une mesure (`test-geometrie-croquis.ts`), pas sur une forme.

### DEUX RÈGLES ONT CHANGÉ LE 23 AOÛT — ne pas les « corriger »

**La pluviométrie n'est plus dans la clé de secteur.** Elle y était depuis le
17 août, mise par LUI ; retirée le 23 par LUI (*« ne prends pas en compte la
pluviométrie »*). Deux turbines de buses différentes peuvent donc partager une
vanne, avec des mm/h différents pour une même durée d'ouverture. **C'est voulu,
il arbitre à l'arrosage** — le remettre serait défaire sa décision.

Ce qui tient toujours : une turbine et une tuyère ne partagent JAMAIS une vanne.
Les deux faces sont éprouvées dans `test-arrosage-calcul.ts`.

**Les pièces se comptent en « 13x », pas « 13 u ».** L'unité reste dans les
données (`{ q, u }`) ; seul l'affichage change, par `quantiteEcrite(q, u)`, qui
vit dans la partie PARTAGÉE de `calcul.js` — donc à recopier dans les deux
copies si on y touche. Les mètres restent des mètres.

### Regarder le dessin sans serveur ni clé

```bash
npx tsx scripts/capture-plan-arrosage.ts /tmp/captures
```

Il a déjà attrapé quatre défauts qu'aucun test ne voyait (`ARCHITECTURE.md`
§150). **S'en servir avant de dire qu'un changement de dessin va bien.**

## PRÉVENIR N'EST PAS REFUSER — et « proposée » n'est pas « forcée »

Posé le 23 août 2026. **Deux de ses règles se ressemblent et disent le
contraire ; ce qui les sépare est la délibération.**

| Sa phrase | Ce qu'elle exige |
|---|---|
| 22 août — *« je peux proposer le 24 alors qu'un client a validé le 24, ça ne doit jamais se reproduire »* | l'application ne suggère **jamais** d'elle-même un jour plein |
| 23 août — *« s'il juge qu'il peut rajouter un chantier, il doit pouvoir le faire quand même »* | il peut **forcer** un jour plein, en le voyant écrit « complet » |

Les deux tiennent ensemble parce que `premiersJoursLibres` ne suggère aucun jour
plein, tandis que `verifierJourPropose` **prévient sans refuser**.

**Le piège, et il a été payé :** à la réponse du client, « la date figure dans
l'envoi » ne suffit PAS à l'autoriser. Un jour proposé alors qu'il était LIBRE,
puis rempli entre-temps, passerait sans que personne n'ait rien décidé — le
double chantier du 22 août, dans sa version course. Seule `envois_devis.
dates_forcees` (migration 0059) distingue les deux : c'est la photographie,
prise à l'envoi, de ce qui était déjà plein. Elle se calcule **au serveur** ;
reçue de l'écran, elle serait un moyen de forcer n'importe quel jour.

**Ce qui reste refusé partout**, parce que ce n'est pas un jugement d'artisan :
une date passée, ou au-delà de dix-huit mois.

---

## UNE RÉFÉRENCE, OU RIEN — et le sûr, c'est MOINS d'arroseurs par vanne

**Deux consignes du 22 août 2026 au soir, toutes deux à ne jamais rouvrir.**

**1. Ne jamais afficher une référence non relevée.** La colonne « référence »
montrait les clés internes du catalogue (`te-taraude-25-34-25`,
`electrovanne-100dv`). Ce sont des noms de variables : on ne commande pas avec.
`CATALOGUE.referenceDe(cle)` est le seul juge — elle rend la référence
seulement si l'entrée porte un `releve`. L'écran affiche `reference`, jamais
`ref`. Un contrôle de la planche interdit d'en réafficher.

**2. Le sûr, c'est MOINS d'arroseurs par vanne — pas plus.** La règle du
`CLAUDE.md` §4 ter était écrite à l'envers, et c'est lui qui l'a redressée :
*« un arroseur de trop fait que le réseau ne peut pas se lever ! »* Une tête de
plus sur une vanne, c'est du débit en plus sur la même conduite. Devant un
doute : moins d'arroseurs par vanne, plus de réseaux, la perte la plus forte, la
portée la plus courte.

---

## LE CROQUIS PORTE LES PLACES — en fraction, jamais en mètres (22 août 2026)

`lire-croquis.ts` demande maintenant, pour chaque zone et pour la nourrice, une
place entre 0 et 1 (`x`, `y`, `largeur_fraction`, `hauteur_fraction`).
`geometrie-croquis.ts` en tire les mètres.

**L'échelle sort des cotes déjà lues** — 16 m sur 0,40 du croquis = 40 m par
unité — en prenant la **médiane** des estimations. Au-delà du double d'écart
entre zones, elle REFUSE de conclure et rend une raison.

**Ne jamais rogner une place hors de [0, 1]** : un « 12 » pour un x n'est pas
une fraction, et le ramener à 1 fabrique une distance de tuyau fausse.

**La distance est en Manhattan, jusqu'au BORD de la zone** — pas au centre : la
longueur dans la zone est déjà comptée par la ligne d'arroseurs.

**Sans nourrice dessinée, aucun trajet**, et surtout aucune supposition : elle
ne se déduit jamais du point d'eau (`CLAUDE.md` §4 bis).

**Elle vit hors de `calcul.js`** parce que ce fichier est une copie partagée
avec `appli/` : la distance est passée en entrée (`regardVersZone`).

Détail : `ARCHITECTURE.md` §149.
## « LE SERVEUR N'A JAMAIS RÉPONDU » ALORS QU'IL DIT « READY » : `rm -rf .next` (24 août 2026)

**Symptôme, et il ment sur sa cause.** Les suites navigateur s'arrêtent net :

```
Démarrage du serveur (mode développement)...
❌ Le serveur n'a jamais répondu — abandon.
--- Dernières lignes du serveur de développement ---
  ✓ Ready in 391ms
```

Le journal dit « prêt », le socket **écoute vraiment** (`/proc/net/tcp`, état
`0A`), et aucune requête n'obtient de réponse — **même au bout de cinq
minutes**, mesuré. Ce n'est donc pas une compilation lente : c'est un blocage.

**La cause : le cache `.next` corrompu.** Un `rm -rf .next` suffit, et la
première requête répond alors en sept secondes, cache vide compris.

**Ce qui envoie chercher au mauvais endroit**, et m'a coûté trois tentatives :
`npm run verifier:connexion` passe au vert dans la même batterie, juste après —
il démarre un `next start` (version bâtie), qui n'emprunte pas ce cache. On croit
donc que le serveur va bien et que ce sont les suites qui échouent.

**Devant ce message, dans cet ordre :**

1. `rm -rf .next`, puis relancer — c'est presque toujours cela ;
2. vérifier qu'aucun **orphelin** ne tient le port 3000 : `next start` laissé par
   l'étape « connexion derrière un proxy » d'une batterie précédente ne se
   nettoie pas toujours ;
3. et ne pas viser `pkill -f next` : le motif se trouve dans la ligne de commande
   du shell qui l'exécute, et l'on tue sa propre session. Viser
   `next-server` et `next dev -p 3000`, en s'excluant soi-même.

---

## UNE COULEUR ÉCRITE EN CLAIR EST JUSTE SUR CINQ CHARTES ET FAUSSE SUR DEUX (22 août 2026)

**Sa capture du planning en « Nuit », six mots :** *« Le mode nuit est
illisible. Corrige ça. »*

**La règle à retenir avant d'écrire une couleur.** Sept chartes cohabitent, dont
**deux sombres** — Nuit et Sylve. Sur celles-là, `rust` (l'accent) est CLAIR,
`cream` et `card` sont SOMBRES : les pôles s'inversent. Une valeur écrite en
clair est donc juste cinq fois sur sept, et personne ne s'en aperçoit tant qu'on
ne pose pas la charte.

| Ce qu'on veut | Ce qu'il faut écrire | Ce qu'il ne faut PLUS écrire |
|---|---|---|
| du texte sur l'accent plein ou sur l'alerte | `surPlein` | `#faf9f5`, `#fff`, `fill="white"` |
| un voile d'encre | `voile(colors.ink, 0.42)` | `rgba(28,28,26,0.42)` |
| un voile sur un aplat plein | `voile(surPlein, 0.22)` | `rgba(250,249,245,0.22)` |
| une couleur de signal | `colors.alert`, `colors.bordeaux`, `colors.vertPale` | leur valeur hexadécimale |

**Devant un doute, la commande qui répond** — dix secondes, sans base ni
serveur :

```bash
npx tsx scripts/test-chartes-lisibles.ts
```

Et celle qui REGARDE l'écran, Origine contre Nuit, sur six parcours (il lui faut
le serveur et la base) :

```bash
npx tsx scripts/test-mode-sombre-lisible-e2e.ts
```

Le pourquoi de chaque choix, et ce qui reste non couvert : `ARCHITECTURE.md`
§160.

---

## LA PRESSION QUI DIMENSIONNE EST CELLE DU DERNIER ARROSEUR (22 août 2026)

**Avant de toucher à `decouper` ou à `buseALaPression`, sachez ceci :** le
calcul tourne **deux fois**.

1. un plan à la pression de la SOURCE ;
2. on mesure ce que perdent l'amenée et le pire réseau, on retire, on REFAIT.

`pressionDeCalcul` (globale) porte la pression de la passe 2. Elle est remise à
`null` au début de chaque `decouper` **et** dans le `finally` de `calculerPlan` —
deux gardes, parce que sur un serveur deux artisans calculent en même temps.

**Ne pas ajouter de troisième passe.** Elle irait dans le mauvais sens : moins
de pression → moins de débit → moins de perte → la pression remonterait. On
tournerait autour de la valeur. Deux passes gardent les pertes des débits les
plus forts, donc le côté sûr.

**Ce qui est compté :** ligne (débit décroissant, Manhattan), antenne Ø16,
électrovanne (0,25 bar, **non relevé**), raccords (+15 %, **non relevé**).
**Ce qui ne l'est pas :** le trajet regard → première tête. Les deux écrans le
disent ; ne pas le taire si vous y touchez.

**Les chiffres affichés viennent tous de la passe 2** — sinon deux pertes
d'amenée différentes cohabiteraient dans le même écran.

**Et `test-arrosage-calcul.ts` fige la perte à 0,442 bar ± 0,005.** Ce n'est pas
une rigidité gratuite : ce chiffre décide du nombre d'arroseurs par ligne. S'il
change, c'est SCIEMMENT, avec la raison dans le commit.

Détail : `ARCHITECTURE.md` §147.

---

## UN RÉSEAU EST PLAFONNÉ PAR SON TUYAU (22 août 2026)

`decouper()` coupe un réseau au **plus petit** de deux chiffres :

| | |
|---|---|
| la source | débit au seau × 0,85 |
| le tuyau | 1,76 m³/h — le Ø25 à 1,5 m/s |

Toutes ses lignes de réseau sont en Ø25 (té 25×3/4"×25, coude 25×3/4"). Avant le
22 août, seule la source comptait : à 3 m³/h mesurés, un réseau tirait 2,55 m³/h
dans un tuyau qui n'en passe que 1,76.

**Ce défaut ne se voyait pas chez lui** — son compteur donne 1,80, la source
commandait toujours. C'est la leçon à retenir : une règle éprouvée sur un seul
chantier n'est pas éprouvée.

**Conséquence sur un contrôle existant :** le critère de vitesse d'`amenee()`
n'est plus atteignable par `calculerPlan`, puisque le plafond agit en amont. Il
reste en place comme garde-fou, et `test-arrosage-calcul.ts` le DIT plutôt que
de laisser croire qu'il veille encore.

---

## LES BUSES SONT CORRIGÉES À LA PRESSION — NE PAS GONFLER LA PORTÉE (22 août 2026)

**Avant de retoucher `modelePour` :** les buses du catalogue sont ramenées à la
pression du chantier avant tout choix, puis **retriées** par portée décroissante
(deux buses de pressions de référence différentes ne se réduisent pas du même
facteur, et tout le choix « la plus grande qui tient » repose sur cet ordre).

| | La loi | Statut | Sens |
|---|---|---|---|
| débit | `√(P/P_ref)` — Torricelli | physique | les deux sens |
| portée | `P^(1/3)` | **estimation** | **vers le bas uniquement** |

**Ne jamais gonfler la portée**, même si la pression est supérieure à celle du
catalogue : l'exposant n'est pas relevé de ses catalogues, et espacer les
arroseurs sur un chiffre supposé fabrique un trou d'arrosage qu'on ne voit qu'en
juillet. Une portée réduite est signalée sous le plan (`porteeEstimee`).

**La pression retenue est celle de la SOURCE**, pas celle du dernier arroseur :
les pertes du réseau ne sont pas calculées (`TODO.md`). C'est un progrès, pas
une garantie — ne pas l'annoncer autrement.

Détail : `ARCHITECTURE.md` §145.

---

## UNE LÉGENDE DE PLAN SE VÉRIFIE CONTRE LE CATALOGUE (22 août 2026)

**Ce qui s'est passé.** Le patron a lu sur le plan « 4 arroseurs en 5004 buse
3.0 » et a demandé si c'était tenable. Ça ne l'était pas — 2,84 m³/h là où le
Ø25 en passe 1,76 — **mais le plan ne posait pas de 5004** : neuf 3504 buse 0,75
et quatre tuyères. Seule la **légende** était restée sur le matériel de la
première version de la planche.

**Le pire :** `verifier-maquette-arrosage-plan.mjs` **exigeait** cette légende,
libellés en dur. Elle ne pouvait donc pas être corrigée sans faire rougir la
batterie. Un contrôle qui fixe un libellé fige une erreur (`CLAUDE.md` §5 bis).

**La règle, valable pour toute planche :** une légende se vérifie contre le
catalogue (le nom exact de la buse, sa portée) **et** contre la liste des pièces
de la même page. Si les trois ne s'accordent pas, l'un ment et rien ne dit
lequel au moment de commander.

**Le calcul, lui, n'était pas en cause** — il coupe bien les réseaux sous le
débit disponible. Devant une plainte sur un chiffre d'arrosage : regarder
d'abord si le chiffre vient du CALCUL ou d'un libellé écrit à la main.

---

## LE DIAMÈTRE DU TUYAU D'ARROSAGE : DEUX CRITÈRES, PAS UN (22 août 2026)

**Si vous touchez au calcul d'arrosage, lisez ceci d'abord.** Le choix Ø25 / Ø32
ne dépend PAS que de la longueur, et c'est le piège qui était dans le code :

| Ce qui impose le Ø32 | Pourquoi on ne peut pas l'oublier |
|---|---|
| le **débit** (vitesse ≤ 1,5 m/s) | un tuyau court ne perd presque rien : sur la seule perte de charge, un Ø25 « passe » à n'importe quel débit pourvu qu'il soit assez court |
| la **longueur** (perte de charge) | au-delà du seuil, la marge de pression est mangée avant les arroseurs |

Débits maximaux qui en découlent : **Ø25 → 1,76 m³/h**, **Ø32 → 2,91**. Le
chiffre du Ø25 recoupe sa propre mesure au seau sur son compteur (1,80 m³/h) —
c'est ce qui permet de le croire.

**Le débit prime sur la longueur** : aucune longueur ne rattrape un débit trop
fort, alors qu'une amenée trop longue se raccourcit parfois en déplaçant le
regard. Quand le débit interdit le Ø25, `longueurMax25` rend **0**, jamais un
nombre de mètres — un seuil qu'on croit et qui ne tient pas coûte une tranchée.

**Les deux copies du calcul doivent rester identiques** (`appli/arrosage-calcul.js`
et `src/lib/arrosage/calcul.js`) : `npm run verifier:maquette` rougit sinon.

**Ce qui n'a pas pu être éprouvé ici :** la ligne du seuil dans l'écran de
l'application (`ArrosageClient.tsx`) n'apparaît qu'après lecture d'un croquis,
donc avec une clé d'IA. Elle a été vue au navigateur sur `appli/arrosage.html`,
dans ses deux cas. À regarder sur son espace au premier plan calculé.

Détail complet : `ARCHITECTURE.md` §144.

---

## LA PLACE SE COMPTE EN ÉQUIPES — et QUATRE lectures doivent s'accorder

Posé le 22 août 2026, sur sa règle : *« oui si c'est des journées complètes, non
si c'est des demi-journées »*.

Un chantier prend **autant d'équipes qu'on lui en coche, au moins une**
(`equipesMobilisees`, `src/server/disponibilites.ts`). Toute nouvelle lecture de
la place doit passer par là — jamais par un `pris.length`.

**Elles sont quatre, et elles doivent rendre le même verdict** (`CLAUDE.md` §3) :

| Où | Ce qu'elle décide |
|---|---|
| `preparerEnvoi` | les jours suggérés et les jours barrés de SON calendrier |
| `verifierJourPropose` | la date qu'il pose lui-même au calendrier |
| `contrainteDuPlanning` | ce que le CLIENT peut retenir |
| `PlanningClient` → `occupationDemi` | la couleur des pastilles |

Les trois premières lisent les affectations par `equipesParChantier`
(`occupation-chantiers.ts`) ; la quatrième les a déjà à l'écran. **N'en corriger
qu'une déplace le défaut au lieu de le réparer** : le planning dirait « complet »
pendant que l'écran d'envoi offrirait le jour.

**Le piège de l'assertion muette, payé ici :** `preparerEnvoi().joursLibres` ne
rend que les **six premiers** jours suggérés. Une assertion du type
« tel jour n'est pas dans joursLibres » sur un jour plus lointain est vraie par
construction et ne prouve rien. Interroger `joursOccupes`, qui couvre douze mois.

---

## L'OCCUPATION SE BORNE SUR LA FIN DU CHANTIER, JAMAIS SUR SON DÉPART

Corrigé le 22 août 2026, après *« je peux proposer le 24 alors qu'un client a
validé le 24 »*. **Toute nouvelle requête d'occupation doit passer par
`encoreEnCoursDepuis`** (`src/server/repositories/occupation-chantiers.ts`) —
jamais par un `gte(chantiers.datePlanifiee, …)` réécrit à la main.

La raison tient en une phrase : un chantier de trois jours parti le jeudi tient
encore le lundi, et borner sur son jour de départ le rend **invisible**. Le jour
paraît libre, l'écran le propose, et — c'est ce qui rendait le défaut grave — la
revérification de la réponse du client lisait la même occupation tronquée, donc
**rien ne rattrapait la faute en aval**.

Trois chemins la partagent, et ils doivent continuer de la partager
(`CLAUDE.md` §3) : l'écran d'envoi, la validation de la date que le patron pose
au calendrier, la revérification de la réponse du client.

**Et la leçon de méthode, qui vaut partout :** un contrôle qui attend un refus
doit **nommer le motif attendu**. Le troisième contrôle de ce lot n'affirmait
que « ça échoue » — il était vert des deux côtés de la correction, parce que le
refus venait en réalité d'un lien expiré.

---

## « RIEN N'EST VISIBLE SUR MON PLANNING » — DIAGNOSTIQUÉ, pas encore réglé

Sa panne du 22 août 2026. **Si elle revient, la réponse est déjà là — ne pas la
rechercher :**

| | |
|---|---|
| La date est-elle perdue ? | **Non.** `enregistrerReponse` écrit `date_planifiee` sur le chantier dans la MÊME transaction que la réponse du client |
| Le chantier est-il sur le planning ? | **Oui**, le jour porte sa barre pleine dans le mois |
| Alors pourquoi ne le voit-il pas ? | La liste des planifiés s'ouvre sur **la semaine du jour**, la trouve vide, et écrit « Aucun chantier posé cette semaine » — pendant que le chantier attend la semaine d'après |
| Ce qui le débloque tout de suite | toucher le jour dans le calendrier, ou la flèche **›** de la semaine |

**Rien n'est codé** : la planche 87 (`appli/planning-semaine-ouverte.html`)
attend qu'il choisisse entre A, B et C. Voir `TODO.md`.

**La leçon à garder même quand ce cas sera réglé :** un écran qui montre une
**fenêtre** — une semaine, un mois, une page — doit dire ce qu'il y a **hors de
sa fenêtre** quand elle est vide. Sinon son « aucun » se lit « il n'y en a nulle
part », et c'est le produit qu'on croit cassé. Chercher les autres endroits qui
ont ce défaut avant qu'il ne les trouve.

---

## « TERMINÉS » : UNE PLANCHE ATTEND SA RÉPONSE — ne pas coder l'écran
## « TERMINÉS » A ÉTÉ REFAIT LE 22 AOÛT 2026 — ce qu'il faut savoir avant d'y toucher

Sa plainte, capture à l'appui : *« je la trouve beaucoup trop compliquée. Un
utilisateur qui ne connaît pas l'application et qui arrive sur cette page ne
comprend rien. »* Trois propositions dessinées, et **il a pris la B** —
`appli/termines-simple.html`, planche 90. **Elle reste la référence** : toute
correction de cet écran s'y porte d'abord, sinon les deux divergent, et c'est
elle qu'il ouvre sur son téléphone.

**Ce qui a disparu de l'écran, et qu'il ne faut pas ramener :** le fil vertical
et ses perles pleines ou creuses, la pastille dorée, le **volet replié** qui
cachait les chantiers à facturer, « Facturé, tous mois confondus », le surtitre
et le cheveu. Une suite qui réclamerait l'un d'eux rendrait l'écran impossible à
changer (`CLAUDE.md` §5 bis) — c'est déjà arrivé, et `test-planning-vers-facture-e2e.ts`
a été adapté : il passe désormais par l'onglet **« À facturer »**.

**Deux choses gouvernent le nouvel écran, et elles se paient si on les ignore :**

1. **Un seul mois à la fois, qu'on feuillette** — `‹ Août 2026 ›`. On se déplace
   sur le **calendrier**, pas sur la liste des mois qui portent quelque chose :
   un mois vide répond « Rien en juillet 2026 ». La flèche du futur se ferme sur
   le mois le plus récent.
2. **CE QUI RESTE À FACTURER NE SUIT PAS LE MOIS.** Sa demande : *« il faut
   pouvoir revenir dans le passé si jamais on a du retard sur la facturation »*.
   L'onglet « À facturer » ignore le mois affiché — un chantier de juillet jamais
   facturé se voit encore en août. `aFacturerPartout` porte cette règle, et la
   suite pure la fixe.

**Le piège qui a coûté deux suites rouges** : un chantier **clôturé avant sa
date** reste dans « Terminés » avec une date **à venir**. Ouvrir sur « le mois
le plus récent qui porte quelque chose » menait donc au mois prochain, vide, et
le travail du mois en cours avait disparu. `bornesDuFeuilletage` s'ouvre sur le
mois courant dès qu'il existe quelque chose de plus tard. Ne pas revenir à
`moisLePlusRecent` pour l'entrée : c'est exactement le défaut.

**Les règles sont dans `src/lib/termines-par-mois.ts`**, pures et éprouvées sans
base (`scripts/test-termines-par-mois.ts`). L'écran n'y décide de rien.

Le détail — ce qui se comprenait mal, et pourquoi — est dans `CHANGELOG.md` du
22 août.

---

## LE PLANNING A ÉTÉ REFAIT LE 21 AOÛT 2026 — ce qu'il faut savoir avant d'y toucher

**L'écran suit `appli/planning-simple.html` (planche 84) trait pour trait**, sur
sa consigne : *« code trait pour trait cette maquette. Ne modifie rien ! Ne
change rien ! »*. Toute correction du planning se porte **d'abord sur la
planche**, sinon les deux divergent — et c'est elle qu'il ouvre sur son
téléphone.

**Trois choses ont changé sous l'écran, et elles se paient si on les ignore :**

1. **`chantiers.equipe_id` N'EXISTE PLUS.** Les équipes vivent dans
   `equipes_du_chantier (chantier_id, demi, equipe_id)` — plusieurs par
   demi-journée, et le matin indépendant de l'après-midi
   (`drizzle/0058_equipes_par_demi_journee.sql`). Un `UPDATE chantiers SET
   equipe_id = …` dans une suite ne compilera plus ; c'est voulu.
2. **Le patron ne se voit plus refuser un créneau.** `CreneauIndisponible` et
   `EquipeIndisponible` ont disparu : *« il ne doit pas y avoir de limite [...]
   nous, on prévient juste »*. **Le chemin du CLIENT, lui, garde toutes ses
   limites** (`jourRetenable`, `premiersJoursLibres`) — ne pas les relâcher.
3. **Les règles sont dans `src/lib/planning-jour.ts`**, pures et éprouvées sans
   base (`scripts/test-planning-jour.ts`). L'écran n'y décide de rien.

**Ce qui a quitté l'écran**, la planche ne le portant pas : « Créer la facture »
(le fil des « Terminés » y mène toujours), la liste « Dans mon agenda », et la
proposition de chantier voisin. Le code serveur des trois est intact — `TODO.md`
dit où, et ce qu'il faut lui demander.

### Une batterie qui rougit d'un coup : regarder si la BASE n'a pas été coupée sous elle

**Le cluster PostgreSQL local est PARTAGÉ entre les sessions.** Le patron en fait
tourner deux ou trois en parallèle (`CLAUDE.md` §6), et elles travaillent toutes
sur `/tmp/atlas-pgdata`. Une session qui l'arrête et le relance coupe la batterie
d'une autre en plein vol.

**Ce que ça donne à l'écran, et c'est trompeur :** une suite rougit sur des
assertions d'affichage — « le nom du client manque », l'écran ne portant plus que
« ATLAS ». On cherche alors dans le rendu, alors que la page n'a simplement plus
de session : la connexion s'est faite refuser.

**Le geste qui tranche, en dix secondes :**

```bash
grep -n "shutdown request\|terminating connection" /tmp/atlas-pgdata/log | tail
```

Une ligne `received fast shutdown request` à l'heure de l'échec, et c'est réglé :
la base a été arrêtée sous la batterie. Le journal du serveur de développement
(`/tmp/atlas-serveur-e2e.log`) porte la même chose vue de l'autre bord —
« terminating connection due to administrator command », puis un
`CallbackRouteError` sur la connexion.

**Ce qu'on fait alors :** rejouer la suite seule. Ce qu'on ne fait PAS : corriger
un écran qui n'a rien. Vécu le 21 août 2026, sur `test-fiche-client-e2e` — trois
cas rouges, zéro défaut.

### Le piège qui a coûté deux heures : `export type { … }` dans un « use server »

**Ne jamais réexporter un type depuis un fichier d'actions serveur.** Le lot
portait, dans `src/app/planning/actions.ts`, un innocent :

```ts
export type { FeuilleDuChantier };   // ⛔ tue TOUT le module
```

Le chargeur d'actions de Next réécrit ce fichier en une liste d'exports de
**valeurs**, une par action. Le nom exporté « type » y survit sous forme de
référence à une chose que TypeScript vient d'effacer, et le module meurt à son
évaluation :

```
⨯ ReferenceError: FeuilleDuChantier is not defined
    at .next-internal/server/app/planning/page/actions.js (server actions loader)
```

**Toutes les actions de l'écran répondent alors 500** — poser une date, désigner
une équipe, déplacer, retirer : plus rien n'atteignait la base. Et **rien ne le
disait** : `tsc --noEmit` vert, `eslint` vert (le code source est juste, c'est la
réécriture qui ne l'est pas), et le geste « réussissait » à l'écran sans un mot,
puisqu'une action serveur ne rend jamais son erreur au patron (§0 ter).

**Ce qui a fait perdre les deux heures :** avoir cru à un défaut de décor de
suite, et cherché dans le contrôle plutôt que dans le journal du serveur. Il y
était, en toutes lettres, dès la première minute. **Devant une action qui
n'écrit rien : lire `/tmp/atlas-serveur-e2e.log` AVANT de toucher au contrôle.**

Le type se prend à sa source, avec `import type` — qui s'efface à la compilation,
et c'est déjà la convention du dépôt (`Notifications.tsx`, `PrixClient.tsx` et
cinq autres écrans le font). `scripts/test-actions-serveur-sans-export-de-type.ts`
rend la faute impossible : il balaie les 32 fichiers « use server », refuse les
deux orthographes, et sait rougir sur la faute même du 21 août.

---

## Les suites navigateur échouent TOUTES à la connexion : vider `.next` (21 août 2026)

**Le symptôme trompe** : cent une suites tombent l'une après l'autre sur
`page.waitForURL` après avoir soumis le formulaire de connexion. On cherche
alors du côté de l'authentification, de la limitation de débit, du jeu de
démonstration — trois pistes, aucune bonne.

**Le vrai signe est deux lignes plus haut, dans le journal du lanceur :**

```
Préchauffage de 27 écrans (compilation à la demande)...
Préchauffage terminé : 3 écran(s) prêts, 24 en échec — 10 s.
```

Un préchauffage sain prend **soixante à quatre-vingts secondes** et rend tous
les écrans prêts. Dix secondes et vingt-quatre échecs veulent dire que le
serveur ne compile plus rien dans les temps — et un écran qui met plus de trente
secondes à se bâtir fait expirer la connexion de la première suite, puis de
toutes les autres.

**La cause, mesurée :** le cache de développement `.next/` avait enflé à
**4,3 Go** au fil des passages. Le geste : arrêter ce qui tient le port
(`fuser -n tcp 3000`, puis `kill -9`), `rm -rf .next .next-verification`, et
relancer. Le premier passage est plus long ; les suivants redeviennent normaux.

**Ce n'est pas un défaut du produit**, et il ne faut pas le chercher là : la
construction (`npm run build`) et les cent quatre-vingt-onze suites base étaient
vertes dans le même passage.

## « L'application ne s'ouvre plus » : LIRE LA FICHE JUSQU'AU BOUT (22 août 2026)

**Payé le matin du 22 août, et c'est la faute que `CLAUDE.md` §1 bis existe pour
empêcher.** Il signale une panne. La fiche est lue — mais seulement sa DATE :
périmée de dix heures, donc « ton espace est éteint, rallume-le ». Il le rallume.
*« Ça marche toujours pas. »*

**L'avertissement était dans la même fiche, dix lignes plus bas, et il y était
déjà la veille :**

> ⚠ LE PORT 3000 EST PRIVÉ : GitHub répond par sa page de connexion à la place
> d'Atlas. Depuis un téléphone non connecté à GitHub, il n'y a rien à voir, et
> l'application paraît « ne plus se lancer » alors qu'elle tourne.

**Pourquoi cela n'apparaît que certains matins.** Un port privé reste joignable
tant que le navigateur porte une session GitHub valide — c'est pourquoi il a
travaillé toute la soirée du 21 sans rien remarquer. La session expire dans la
nuit ; le lendemain, GitHub renvoie sa page de connexion, et Atlas semble mort.

**La règle qui en sort :** la fiche se lit **en entier**, et sa section « Ce
qu'il faut en conclure » se lit AVANT de formuler quoi que ce soit. Sa date
tranche sur l'espace ; elle ne tranche pas sur la panne.

**Le remède définitif est de recréer son espace** : `devcontainer.json` publie le
port et installe `gh`, mais **seulement pour un espace à naître**
(`ARCHITECTURE.md` §55). Le sien est antérieur, d'où le `sans-gh` qui revient à
chaque allumage. Tant qu'il le garde, c'est trois clics : onglet PORTS → clic
droit sur 3000 → Visibilité → Public.

---

## La dictée mène AU DEVIS, et le devis se prépare tout seul (21 août 2026)

**Sa panne, qu'il a lui-même qualifiée de « point le plus important » :** il
dicte chez Madame Lucie, rappuie sur l'anneau, **ferme l'application**, revient,
clique le nom dans la liste — et n'arrive pas sur son devis.

Deux choses ont changé, et il faut connaître les deux :

1. `getNextAction` mène au **devis** dès qu'une dictée existe, et cette ligne
   passe **avant** `informationsVerifieesAt` — la chaîne pose ce jalon avant son
   arrêt d'avant-chiffrage, et l'ordre inverse renvoie sur l'écran « Prix » ;
2. **la page du devis prépare la dictée elle-même en arrivant**
   (`src/lib/devis-a-preparer.ts`, `src/app/chantiers/[id]/devis-complet/PreparationDictee.tsx`). Pas
   au relâchement de l'anneau : il ferme l'application dans la seconde qui suit,
   l'appel partirait avec l'onglet.

Le détail et les partis pris sont dans `ARCHITECTURE.md` §142. La séquence
entière est rejouée par `scripts/test-madame-lucie-e2e.ts`.

---
## « La page ne s'ouvre plus » : REGARDER LA PUBLICATION AVANT DE CHERCHER (21 août 2026)

**Payé le 21 août au soir.** Trois corrections de maquette poussées coup sur
coup, trois messages « c'est poussé, recharge » — et lui : *« la page ne s'ouvre
plus »*. La maquette était juste, le dépôt était juste. **C'est la publication
qui n'avait pas eu lieu.**

`.github/workflows/pages.yml` porte `concurrency: pages` avec
`cancel-in-progress: true` : **chaque poussée ANNULE la publication en cours.**
Une rafale de trois poussées en cinq minutes laisse donc deux déploiements
« cancelled » et un seul qui aboutit — et entre les deux, l'adresse ne sert rien
de neuf, voire ne répond pas.

**Donc, avant de lui dire de regarder :** attendre que la publication soit verte
(onglet Actions → « Publication de l'appli sur GitHub Pages »). Elle interroge
elle-même chaque page à son adresse publique après déploiement — quand elle est
verte, la page répond pour de bon.

**Et devant la plainte :** regarder la dernière exécution AVANT de chercher dans
la page. Une maquette qu'on vient de corriger trois fois est bien plus souvent
non publiée que cassée.

## « L'application est lente » : REGARDER QUI CONSTRUIT (20 août 2026)

**Le produit n'est pas lent** — mesuré ce soir-là sur le code du jour, version
bâtie : connexion à l'accueil 890 ms, chaque écran entre 0,6 et 1,1 s. Devant
cette plainte, ne pas partir chercher une requête coûteuse.

**Ce qui est lent, c'est son banc quand il sert la VERSION LENTE** — le mode
développement, où chaque écran se compile à l'ouverture. Trois questions, dans
cet ordre :

1. **sa fiche d'état est-elle encore écrite ?** Le publieur meurt avec le
   veilleur (`veiller.sh`) : une fiche muette plus de vingt minutes dit que **le
   veilleur est tombé** — donc que plus personne ne construit la version rapide,
   et qu'il restera lent indéfiniment. Le geste : rallumer l'espace ;
2. `Code SERVI` sur la fiche : un commit = version rapide en place ; « aucune
   version bâtie » = construction en cours ou échouée, la fiche le distingue ;
3. l'écran **Réglages** le dit maintenant lui-même, et sans mentir
   (`src/lib/version-lente.ts`) : il n'annonce « ça vient tout seul » que si
   quelqu'un construit vraiment, sinon il l'envoie rallumer.

**Ce qui reste ouvert :** pourquoi son veilleur meurt. Le journal de démarrage
n'est délibérément pas publié, et la fiche ne peut rien dire quand c'est le
veilleur qui tombe. La piste — une trace d'agonie publiée à l'allumage suivant —
est dans `TODO.md`.

## Le retour de la fiche client dépend d'où l'on vient (20 août 2026)

*« Ça ne me fait pas un retour, mais deux retours. »* La fiche renvoyait à
l'accueil ; elle renvoie maintenant à la liste des clients, ou **au chantier**
quand on vient de là. L'origine voyage dans `?de=`, traduite par
`src/lib/retour-fiche-client.ts`.

**Ne pas « simplifier » en remettant un lien fixe** : la fiche s'ouvre depuis
deux endroits, et un retour fixe se trompe pour l'un des deux
(`ARCHITECTURE.md` §135). Et **ne pas retirer le filtre** : la valeur vient de
l'adresse, donc de n'importe qui.

## Diagnostic végétal : ce qu'il faut savoir avant d'y toucher (20 août 2026)

**Le module est complet ; sa base est presque vide, et c'est le bon état.**
Trois fiches réelles au 20 août 2026 (fomès des résineux, les deux anthracnoses)
sur ~50 visées. Hors de ce périmètre, l'écran répond « je ne peux pas
confirmer » — **rien n'est cassé** : les fiches se recopient de sources
officielles, jamais inventées, et c'est une règle du patron
(`ARCHITECTURE.md` §135.10).

**Pour voir le parcours fonctionner ici**, chargez les fixtures d'essai :

```bash
source scripts/monter-base-locale.sh
DATABASE_URL="$DATABASE_ADMIN_URL" npx tsx scripts/importer-fiches-phyto.ts donnees/phyto/fixtures --fixtures
```

Elles ne sortiront **que** si `ATLAS_FIXTURES_PHYTO=1` est posé dans le
processus qui lit — c'est une double garde délibérée. Sans elle, la lecture les
filtre, exactement comme en production.

**Six pièges, dans l'ordre où on les rencontre :**

1. **L'import exige le rôle PROPRIÉTAIRE.** `atlas_app` n'a que `SELECT` sur la
   base phytosanitaire (migration 0056). Le script le vérifie et le dit ; sans
   ce contrôle, l'erreur tomberait au milieu de l'import.
2. **Une lecture SQL brute d'une table à RLS rend ZÉRO ligne sans contexte**, et
   *silencieusement*. Trois cas de `test-diagnostic-base.ts` en sont morts avant
   d'être corrigés : ils lisaient `0` et concluaient « rien n'a été écrit » alors
   que tout l'était. Employez `withEntreprise`, ou `set_config(..., true)` dans
   une transaction — jamais `pool.query` nu.
3. **Une confusion peut viser une fiche d'un AUTRE fichier**, et c'est le cas
   courant — voir `ARCHITECTURE.md` §136. Deux choses en découlent : le contrôle
   d'import relève les codes de **tous** les lots avant de valider, et les liens
   qui n'ont pas pu être posés sont raccordés à la fin. Ne pas revenir à un
   `INSERT … SELECT` posé dans la foulée : sur une fiche pas encore écrite, il
   n'insère rien **sans se plaindre**, et la relance photo disparaît de l'écran.
4. **L'import n'écrit JAMAIS « validee » directement**, et la contrainte
   `fiches_phyto_integrite_ck` le rend impossible (migration 0057). Une fiche
   entre `en_revue` ; seule la comparaison champ par champ, réussie dans la même
   transaction, la promeut. Si vous ajoutez une colonne à `fiches_phyto`,
   **écrivez-la dans `CHAMPS_SCALAIRES`** (`src/lib/import-fiches-phyto.ts`) :
   la liste est tenue à la main précisément pour qu'un oubli d'`INSERT` ne passe
   pas inaperçu (`ARCHITECTURE.md` §138).
5. **Le moteur exige une essence établie avant de conclure.** Une observation
   sans taxon reconnu, ou avec `certitude: "incertaine"`, ne rend jamais de
   diagnostic — elle demande une photo d'identification, puis refuse. Une suite
   qui construirait une `Observation` sans `essence` obtiendrait donc un
   `complement` là où elle attend une conclusion, et cela n'a rien à voir avec ce
   qu'elle croit éprouver.
6. **Le vocabulaire est PARTAGÉ** entre les fiches et la consigne du modèle
   (`src/lib/diagnostic-vegetal.ts`). Ajouter un mot d'un seul côté ne produit
   aucune erreur : simplement une fiche qui ne sort plus jamais. Deux contrôles
   l'attrapent — `verifierVocabulaire()` à l'import, et une suite qui vérifie
   que chaque mot figure bien dans la consigne.

**Où sont les choses :**

| | |
|---|---|
| Règles pures (score, arbitrage, confiance, mentions) | `src/lib/diagnostic-vegetal.ts` |
| Appel au modèle + lecture de sa réponse | `src/server/diagnostic/observation.ts` |
| Orchestration | `src/server/diagnostic/moteur.ts` |
| Base commune (lecture seule) | `src/server/repositories/fiches-phyto.ts` |
| Diagnostics (RLS) | `src/server/repositories/diagnostics.ts` |
| EXIF, conservation, import | `src/lib/exif.ts`, `retention-diagnostic.ts`, `import-fiches-phyto.ts` |
| Écrans | `src/app/paysage/diagnostic/` |

**Ce qui n'a PAS été vérifié, et doit s'écrire ainsi :** l'appel réel au
fournisseur de vision, **depuis cet environnement-ci** — il n'y a pas de clé sur
le poste de l'agent, comme pour la lecture des tickets de gazole. Tout le reste
l'a été.

**Attention à ne pas en tirer la mauvaise conclusion :** chez lui, les clés sont
posées et l'IA tourne (`CLAUDE.md` §1 ter). Ce qui manque ici est un moyen de
mesure, pas une fonctionnalité — et cela se joue sur son espace.

---


## La recherche de clients est CODÉE (20 août 2026)

Sa demande du matin : *« il faut une barre de recherche où je peux taper le nom
d'un client »*. Faite, éprouvée, sur `main`. La règle est dans
`src/lib/recherche-client.ts` et l'écran ne la refait pas — un contrôle le
vérifie en lisant le fichier de l'écran.

**Le piège, et il ressort d'une capture, pas d'une suite :** `type="search"`
fait poser au navigateur une croix d'effacement **bleu vif**, seule tache de
couleur de l'écran. Ne pas remettre `type="search"` en croyant bien faire —
`ARCHITECTURE.md` §134.

## ⏸ « TROP DE MOTS » — mesuré le 19 août, il n'a pas encore répondu

**Sa plainte, et c'est la troisième :** *« il y a beaucoup trop de mots dans
tous les sens […] des entrepreneurs qui n'ont pas de temps […] il y a des
boomers dessus »*. Le 11 et le 17 août, la même chose avait été dite et un écran
avait été corrigé au jugé ; la gêne est revenue ailleurs à chaque fois.

**Ce qui existe :** `appli/moins-de-mots.html` — **Atlas dépouillé, qui se
sert** : la barre du bas marche, « Créer un devis » ouvre la fiche, les champs
se remplissent au clavier, le devis part. Un bouton « Avant » remet l'écran
d'aujourd'hui. Sans une ligne de JavaScript. Liée depuis `appli/essais.html`.
`docs/QUESTIONS.md` §23.

**⚠ DEUX VERSIONS ONT ÉTÉ REFUSÉES AVANT CELLE-LÀ.** *« Je t'ai dit de rien
coder »* — la première portait deux scripts autour de la maquette ; une demande
de maquette n'autorise pas l'outillage qui va avec, même hors de `src/`. Puis
*« une maquette dynamique QUE JE PUISSE UTILISER »* — la deuxième était une
planche avant/après à REGARDER. **Une maquette, ici, est un bout d'application
qui marche**, pas une présentation de ce qu'elle serait. Les autres essayables
de `appli/` le sont déjà : s'en inspirer.

**Fusionné sur `main` le 19 août 2026.** Il avait d'abord répondu non, puis
demandé : *« si tu fusionnes, l'application actuelle ne sera plus ? »*. **Poser
la question de la fusion sans dire ce qu'elle change chez lui, c'est lui faire
porter un risque qu'il ne peut pas évaluer.** La réponse — zéro fichier de
`src/` touché, une page de plus dans `appli/` — a suffi. À dire d'emblée la
prochaine fois.

**CE QU'ON ATTEND DE LUI, et rien ne se code avant :** la planche 82 lui
va-t-elle ? (`CLAUDE.md` §3 bis.)

**LA CHOSE À NE PAS OUBLIER SI L'ON REPREND CE SUJET.** Corriger trois écrans de
plus ne réglera rien — ce serait la quatrième fois. Ce qui manque, c'est **un
contrôle qui compte les mots de chaque écran et rougit quand un écran en
gagne**. Sans lui, l'application regrossira, parce que chaque décision juste
ajoute une ligne et que personne n'en retire jamais.

## Le plan DESSINÉ attend sa validation — 21 août 2026

**`appli/arrosage-plan.html`** : son croquis (pelouse en L, 176 m²), le plan à
ses cotes, 13 arroseurs, 3 réseaux de couleurs sous 1,80 m³/h.
**NE RIEN CODER dans l'application avant sa réponse** — c'est sa consigne
explicite : *« je veux d'abord voir, analyser, et une fois que j'aurai validé,
on pourra commencer à coder »*. Ce qui attend sa décision est dans `TODO.md`,
§« Le plan DESSINÉ ».

**Le contrôle recalcule le plan, il ne regarde pas une mise en page** : surface
relue depuis le polygone, couverture maillée tous les 50 cm (un trou = une tache
jaune en juillet), débit par voie, métrés mesurés sur le tracé, et **aucun nom de
réseau répété ni coupé** — le défaut exact de sa capture.

**Son adresse directe** (jamais via `essais.html`, sa demande du 20 août) :
`https://florianmarrins0978-svg.github.io/Atlas-app/arrosage-plan.html`

## L'arrosage est DANS l'application — 20 août 2026 au soir

**AUCUN ÉCRAN NE FORCE L'APPAREIL PHOTO** (21 août) : `capture="environment"`
est retiré du croquis d'arrosage et du diagnostic végétal. Sa règle : *« soit je
peux mettre une photo de ma bibliothèque, soit prendre une photo »*. Le retirer
ne coûte rien, le garder interdit la photo prise la veille. Deux contrôles le
tiennent, et celui du diagnostic — qui réclamait l'inverse — a été retourné.

**LA CLÉ D'IA : IL A EU RAISON TROIS FOIS, ET LE DÉPÔT AVAIT TORT.** *« Les clés
sont posées, elles fonctionnent pour la rédaction du devis. Utilise-la. »*
L'écran demandait « une clé existe-t-elle ? » au lieu de « celui qui va LIRE
l'image a-t-il la sienne ? ». Deux questions différentes depuis que
`VISION_PROVIDER` existe. Conséquences trouvées en tirant le fil :

- `lireCroquis` appelait `getFournisseurLLM()` — celui qui RÉDIGE — alors que
  `getFournisseurVision()` existait pour ça. **Silencieux.**
- `etatVision` (`src/lib/etat-ia.ts`) tranche désormais, et son motif est celui
  que l'écran affiche : jamais deux façons de dire la même règle.
- **`npm run verifier:croquis`** dessine un croquis, le photographie et le fait
  lire pour de bon. À jouer **depuis son espace**, où ses clés sont posées :
  ici, la commande refuse de rendre un vert et nomme ce qui manque.

**SES SEUILS, ET ILS DIFFÈRENT SELON LE PIQUAGE** (21 août) : compteur → 3 bar ;
seau seul → **2,5 bar** (`BAR_SUPPOSE_AU_SEAU`), parce qu'à un robinet rien ne
garantit le Ø25 ; kit à 2,5 ou 3 bar → impeccable, aucune réserve. Le seuil est
atteint **à** 2,5, pas dépassé.

**QUATRE CORRECTIONS DE SA PART LE MÊME SOIR, et la première est une leçon.**

1. **La photo ne partait pas.** Le bouton ouvrait l'appareil, rien ne soumettait
   ensuite. **La suite ne l'avait pas vu parce qu'elle ne posait jamais de
   photo.** Devant un geste, éprouver le geste ENTIER — pas ses pièces.
2. **Rien ne s'affiche au compteur.** En Ø25 après compteur, on a au moins 3 bar
   en dynamique comme en statique : *« tu sais d'office que tu es bien »*. Donc
   ni mesure demandée, **ni réserve écrite** — un avertissement inutile
   s'apprend à être ignoré.
3. **La pression utile est la DYNAMIQUE, buse taille 5.** La statique, robinet
   fermé, est toujours flatteuse.
4. **Deux libellés :** pas de piquage sur pompe ; « Robinet de jardin » et non
   « Ailleurs (…) », qui se coupait dans le menu à 390 px.

5. **Le kit porte les DEUX pressions, et le seuil est 2,5 bar.** *« Kit de
   mesure débit/pression avec buse taille 5, nb de bar statique, nb de bar
   dynamique. Si il y a 2,5 bar, 3 bar en dynamique, alors c'est parfait. »*
   `BAR_MINIMUM_DYNAMIQUE = 2,5` dans `src/lib/arrosage/mesure-debit.ts`.
   La statique n'est pas décorative : **l'écart** entre les deux (> 1,5 bar)
   accuse une conduite trop maigre — c'est le réseau qu'on retaille, pas la
   pression qu'on force. Les deux réserves s'empilent quand les deux sont vraies.

6. **Le seau et le kit sont DEUX encarts** (21 août) — *« la mesure au seau ne
   doit pas rentrer dans le kit débit/pression »*. Deux gestes, deux outils,
   deux fiabilités ; le seau porte sous son champ une mention qui **déconseille**
   et désigne le kit — une simple nuance (« peu précis ») se franchit sans y
   penser, il l'a fait retirer pour cela. `data-atlas="seau"` et `data-atlas="kit"` tiennent la RÈGLE — ni
   l'ordre des blocs, ni leurs titres exacts.

**LA RÈGLE À NE PAS PERDRE :** la pression **ne donne pas** le débit. Deux
robinets à 3 bar délivrent l'un 1 m³/h, l'autre 3.
`src/lib/arrosage/mesure-debit.ts` en fait une règle pure : mesure au seau, ou
estimation **signalée**, ou refus. Jamais un chiffre supposé qui se présente
comme mesuré.



*« Code le tout dans l'appli. »* `/paysage/arrosage` : le piquage, la mesure au
seau, le croquis photographié — puis le plan et le détail des pièces. L'écran
Paysage n'ouvre plus de page extérieure.

**TROIS PIÈGES À CONNAÎTRE AVANT D'Y TOUCHER :**

1. **`src/lib/arrosage/calcul.js` est une copie octet pour octet de
   `appli/arrosage-calcul.js`.** Une correction se porte **des deux côtés** —
   `scripts/verifier-arrosage-une-seule-source.mjs` refuse qu'elles divergent.
2. **Aucune fonction NOMMÉE dans un `page.evaluate`.** Le compilateur y injecte
   un helper `__name` qui n'existe pas dans le navigateur : l'évaluation tombe
   sur « __name is not defined », et la panne n'a rien à voir avec l'écran.
3. **`innerText`, jamais `textContent`, pour compter ce qui est à l'écran.** Le
   second rend tout le document, menus repliés compris : il annonçait 270 mots
   là où l'écran en montre 21.

**Ce qui est à lui, et qui reste ouvert :** le **reste dû** revient-il sur la
fiche d'un client ? Il est parti avec « tout le reste » le 20 août.

## Deux maquettes attendent sa réponse — 20 août 2026

- **`appli/arrosage-simple.html`** : la maquette qui a servi à l'arrêter.
  **Codée depuis** — voir la section ci-dessus. Le débit a été remis, sur sa
  décision. `appli/arrosage.html` (l'ancienne page) n'a pas été touchée.
- **`appli/fiche-client.html`** : la fiche client refondue, **déjà codée**.
  Reste ouvert : le **reste dû** revient-il sur cet écran ?

**Il ne veut plus passer par `essais.html`** — *« arrête de me le mettre dans
Atlas app essai »*. Lui donner **l'adresse directe** de la page :
`https://florianmarrins0978-svg.github.io/Atlas-app/<page>.html`

`arrosage-simple.html` n'est donc liée nulle part : elle figure **nommément**
dans la liste vérifiée de `pages.yml`, sans quoi la liste déduite d'`essais.html`
ne la verrait pas et on lui donnerait une adresse non éprouvée.

## La fiche client est refondue, et le troisième PDF existe — 20 août 2026

**Ses trois décisions, le 20 août :** une **colonne Facture** en plus des deux
premières, le **PDF de fiche de chantier** fabriqué pour de bon, et *« on va
modifier la vraie application »* — le feu vert pour coder.

**Ce qui est fait et poussé :** `src/app/clients/[id]/page.tsx` (dernière
prestation en titre noir gras, trois colonnes de PDF du plus récent au plus
ancien, le reste retiré), `src/server/pdf/fiche-chantier-pdf.ts`,
`/api/chantiers/[chantierId]/fiche/pdf`, `src/lib/documents-du-client.ts` (la
règle de tri, une seule pour les trois colonnes).

**Ce qui reste ouvert, et qui est à lui :**

- **Le reste dû ne figure plus sur la fiche d'un client.** Il se regarde dans
  Terminés → En attente de paiement. La maquette lui demande s'il le veut ici
  aussi ; il n'a pas répondu.
- **On n'ouvre plus un chantier depuis un client** — on ouvre sa fiche en PDF.
  Il a été prévenu et a tranché, mais c'est le genre de perte qui se sent à
  l'usage, pas à la lecture.
- **La fiche de chantier ne s'ENVOIE pas encore.** Elle se télécharge. Le jour
  où elle partira chez un client, il faudra la **figer** comme le devis et la
  facture : ce qui est parti ne se réécrit pas. C'est écrit dans la route.

**Et il ne veut plus passer par `essais.html` pour ses maquettes** — lui donner
l'adresse directe de la page.

## ⏸ « TROP DE MOTS » — mesuré le 19 août, il n'a pas encore répondu

**Sa plainte, et c'est la troisième :** *« il y a beaucoup trop de mots dans
tous les sens […] des entrepreneurs qui n'ont pas de temps […] il y a des
boomers dessus »*. Le 11 et le 17 août, la même chose avait été dite et un écran
avait été corrigé au jugé ; la gêne est revenue ailleurs à chaque fois.

**Ce qui existe :** `appli/moins-de-mots.html` — **Atlas dépouillé, qui se
sert** : la barre du bas marche, « Créer un devis » ouvre la fiche, les champs
se remplissent au clavier, le devis part. Un bouton « Avant » remet l'écran
d'aujourd'hui. Sans une ligne de JavaScript. Liée depuis `appli/essais.html`.
`docs/QUESTIONS.md` §23.

**⚠ DEUX VERSIONS ONT ÉTÉ REFUSÉES AVANT CELLE-LÀ.** *« Je t'ai dit de rien
coder »* — la première portait deux scripts autour de la maquette ; une demande
de maquette n'autorise pas l'outillage qui va avec, même hors de `src/`. Puis
*« une maquette dynamique QUE JE PUISSE UTILISER »* — la deuxième était une
planche avant/après à REGARDER. **Une maquette, ici, est un bout d'application
qui marche**, pas une présentation de ce qu'elle serait. Les autres essayables
de `appli/` le sont déjà : s'en inspirer.

**Fusionné sur `main` le 19 août 2026.** Il avait d'abord répondu non, puis
demandé : *« si tu fusionnes, l'application actuelle ne sera plus ? »*. **Poser
la question de la fusion sans dire ce qu'elle change chez lui, c'est lui faire
porter un risque qu'il ne peut pas évaluer.** La réponse — zéro fichier de
`src/` touché, une page de plus dans `appli/` — a suffi. À dire d'emblée la
prochaine fois.

**CE QU'ON ATTEND DE LUI, et rien ne se code avant :** la planche 82 lui
va-t-elle ? (`CLAUDE.md` §3 bis.)

**LA CHOSE À NE PAS OUBLIER SI L'ON REPREND CE SUJET.** Corriger trois écrans de
plus ne réglera rien — ce serait la quatrième fois. Ce qui manque, c'est **un
contrôle qui compte les mots de chaque écran et rougit quand un écran en
gagne**. Sans lui, l'application regrossira, parce que chaque décision juste
ajoute une ligne et que personne n'en retire jamais.

## ⏸ La fiche client allégée — dessinée le 20 août, il tranche avant qu'on code

**Une réponse à trois questions**, posées dans la maquette
`appli/fiche-client.html` et détaillées en tête de `TODO.md` : fabrique-t-on le
PDF « fiche chantier » (il n'existe pas), où vont les **factures** qui n'ont
plus d'encadré, et perd-on le chemin d'un client vers un chantier.

**Ne rien coder de la fiche client avant sa réponse** (`CLAUDE.md` §3 bis).

**L'adresse qu'on lui a donnée**, et la seule :
`https://florianmarrins0978-svg.github.io/Atlas-app/essais.html`
Toute maquette neuve s'y inscrit — voir `PROJECT_STATE.md`, « Les maquettes
essayables ».

## Ne JAMAIS attendre une publication en interrogeant `github.io`

**Payé le 18 août 2026.** Après une fusion sur `main`, une boucle interrogeait
`https://…github.io/Atlas-app/…` toutes les 30 s pour annoncer la mise en ligne.
Au bout de vingt minutes elle a conclu *« la publication a peut-être échoué »* —
et c'était **faux** : la publication avait réussi onze minutes plus tôt.

Le mandataire réseau de cet environnement **refuse `github.io`**
(`CLAUDE.md` §5). La boucle ne mesurait donc pas le déploiement, elle mesurait
un `CONNECT tunnel failed, response 403` — et rendait `000` à chaque tour. Elle
ne pouvait pas réussir, quel que soit l'état du site. C'est le piège du contrôle
qui mesure zéro, dans sa version la plus traître : il ne rend pas un faux vert,
il rend un faux ROUGE, et l'on part chercher une panne qui n'existe pas.

**Ce qu'on interroge à la place :** l'état du flux `pages.yml`, par l'outil
GitHub (`actions_list`, `list_workflow_runs`) — `conclusion: success` sur le
commit qu'on vient de pousser. C'est l'observable qu'on a vraiment.

**Et la règle générale :** avant d'écrire une boucle d'attente, se demander si
son test peut réussir ici. Un `curl` vers une adresse que le mandataire refuse
n'attend rien — il échoue en boucle.

## Voir la machine du patron sans y avoir accès

**Il n'y a aucun accès, et il ne faut pas en fabriquer un.** La question a été
posée le 12 août 2026 (*« trouve un moyen pour que tu aies accès à mon
espace »*) et tranchée : une boucle qui exécuterait chez lui des ordres lus dans
le dépôt serait une porte dérobée sur une machine portant ses identifiants. Ne
pas la rouvrir en croyant bien faire.

Ce qui existe à la place : **son espace publie son état**, à chaque allumage, sur
une fiche GitHub dont le titre est fixe (`TITRE_FICHE` dans
`scripts/rapporter-espace.mjs`). Elle porte le commit récupéré, le commit
réellement SERVI, l'état des services et la fin du journal de démarrage.

**Si la fiche est introuvable, ne pas conclure qu'il n'a pas redémarré.** Le
12 août 2026 elle est restée vide après deux redémarrages, parce que la
publication passait par `gh` — absent de son conteneur, et impossible à y faire
entrer : tout ce que `devcontainer.json` déclare est posé **à la naissance** de
l'espace, et le sien est plus ancien. Redémarrer récupère le code, jamais les
outils (`ARCHITECTURE.md` §69). La publication passe désormais par l'API avec le
jeton que Codespaces pose dans chaque terminal, donc sans rien à installer — et
`scripts/eprouver-publication-fiche.mjs`, joué en CI, vérifie qu'elle part pour
de bon.

**Devant un « ça ne marche pas », lire cette fiche AVANT de faire taper quoi que
ce soit au patron.** C'est exactement ce qui a coûté quatre allers-retours dans
la nuit du 11 au 12 août : des hypothèses formulées à distance, toutes fausses,
pendant que sa machine savait tout.

**Et une fiche FIGÉE ne veut pas dire « espace arrêté » sur les anciens
espaces.** Défaut trouvé le 16 août 2026 : la publication vivait au bas de la
boucle de `veiller.sh`, qui cesse d'avancer dès qu'elle appelle `npm run banc`
— un appel qui ne rend la main qu'à la mort du serveur suivant. La fiche se
figeait donc **au moment exact où le veilleur se mettait au travail**, et sa
propre règle de lecture (« passé vingt minutes, l'espace est arrêté ») envoyait
rallumer une machine qui tournait. Corrigé : la publication vit dans un
processus séparé. **Mais un espace allumé avant cette correction porte encore
l'ancien veilleur** — devant une fiche figée, regarder le commit qu'elle annonce
avant d'en conclure quoi que ce soit.

Cette phrase-là n'est plus à retenir : `.claude/settings.json` branche
`scripts/rappel-panne.mjs` sur chaque message reçu, et le rappel réapparaît de
lui-même dès qu'il signale une panne — dans cette session comme dans les trois
ou quatre autres qu'il fait tourner en parallèle. Il ajoute du contexte, il ne
bloque rien, et devant le moindre doute il se tait : un rappel qui parle à tort
finit ignoré, et le garde-fou se perd sans bruit.

---

## ⚠ « ELLE NE SE LANCE PLUS » sur une fiche VERTE : regarder le port

**Le 21 août 2026.** Sa fiche disait « le serveur répond », « tout concorde » —
et il ne pouvait pas ouvrir l'application. Un **port privé** donne exactement ce
symptôme : GitHub répond par sa page de connexion à la place d'Atlas, et depuis
un téléphone non connecté il n'y a rien à voir.

La fiche porte désormais une ligne `Port 3000`. **La lire avant toute
hypothèse.** Si elle dit PRIVÉ, le remède est chez lui, en trois clics : onglet
PORTS → clic droit sur 3000 → « Visibilité du port » → « Public ».

Pourquoi ça revient : `devcontainer.json` déclare le port public, mais ce
fichier n'est appliqué qu'à la CRÉATION de l'espace — le sien est plus ancien.
Le geste est rejoué à chaque allumage par `ouvrir-port.sh`, qui a besoin de `gh`,
absent de cette image.

## ⚠ « PAGE BLANCHE » : lire la ligne « Code SERVI » avant tout (16 août 2026)

Sur la fiche, deux lignes ensemble tranchent la question sans hypothèse :

| Ce que la fiche montre | Ce que ça veut dire |
|---|---|
| `Serveur : répond` **+** `Code SERVI : … construction en cours` | **rien à réparer, c'est passager** — le banc compile chaque écran à l'ouverture (30-100 s) et le mandataire de GitHub renonce à 60 s. Recharger une minute plus tard suffit |
| `Code SERVI : … la construction a ÉCHOUÉ` | **ça ne se répare pas tout seul** — le banc restera lent tant que `next build` ne passe pas. Le bloc « Au moment de l'échec » porte l'heure, le disque, la mémoire **et ce que la construction a dit** : lire cette dernière ligne EN PREMIER, c'est elle qui tranche |

**« Another next build process is already running » : ne pas effacer le
verrou.** Le message parle d'une construction « qui n'est pas sortie
proprement », ce qui fait croire à un fichier périmé. **Éprouvé le 16 août
2026 : faux.** Un `lock` posé à la main n'empêche aucune construction — le
verrou est pris auprès du système et relâché par le noyau à la mort du
processus. Quand ce message apparaît, **une construction tourne pour de bon**,
et l'effacer en lancerait une seconde à côté. La vraie cause était ailleurs :
`demarrer.sh` n'incluait pas `build` dans son `pkill`, et orphelinait une
construction à chaque démarrage (`CHANGELOG.md` du 16 août).

**LE MÊME MESSAGE EST REVENU LE 17 AOÛT AU SOIR, et ce n'était pas la même
panne.** *« Même problème qu'hier, l'appli est super lente. »* Le `pkill` du
démarrage tient toujours — mais il ne protège QUE le démarrage. Son espace n'a
que 8 Go (181 Mo libres au moment de la panne) : quand la mémoire manque, le
noyau tue un processus, le banc part, et **sa construction lui survit**. Le
veilleur relance un banc, qui tombe sur le verrou de l'orpheline.

**Ce qui est posé depuis** (`ARCHITECTURE.md` §129) :

- **le banc déloge l'orpheline avant de bâtir** (`scripts/verrou-construction.mjs`)
  — on ne double pas une construction, on retire celle qui n'a plus de
  destinataire : le banc qui aurait basculé dessus est mort ;
- **il réessaie une fois** quand c'est ce refus-là qui a parlé ;
- **le verrou de banc se prend en création exclusive** (`wx`) : deux bancs qui
  démarrent dans la même seconde ne pouvaient PAS se voir — ils repartaient tous
  les deux, avec deux constructions.

**Ce qui reste vrai et ne doit pas être défait :** on n'efface jamais le fichier
`lock`. Tuer le processus, oui ; effacer sa trace, jamais.
| `Serveur : NE RÉPOND PAS`, fiche écrite **à l'allumage** | normal à cet instant, le veilleur relève dans quinze secondes |
| `Serveur : NE RÉPOND PAS`, fiche écrite **par le veilleur** | vraie panne |

Le 16 août au soir, une page blanche a été traitée comme un défaut de produit
pendant une soirée. La page de connexion s'affichait parfaitement sur son commit
exact, et la construction réussissait : il était simplement dans la fenêtre de
construction. `TODO.md` 0 quadragies ter.

---

## ⚠ LE PREMIER RÉFLEXE, DEMANDÉ PAR LE PATRON LE 12 AOÛT 2026

**À faire juste après avoir lu la fiche ci-dessus** : la fiche dit dans quel
état est sa machine, la question ci-dessous dit dans quel état est son onglet.
Les deux se lisent avant la moindre hypothèse, et pour la même raison — regarder
coûte une minute, supposer a coûté deux jours.

> *« Retiens ce problème, et la prochaine fois qu'on a un souci, commence par
> regarder si ce n'est pas ça. »*

**Devant tout défaut qu'il signale et qui ne se reproduit pas ici, la PREMIÈRE
question n'est pas « quel écran ? » mais : SA PAGE A-T-ELLE SURVÉCU À SON
SERVEUR ?**

Son banc redémarre plusieurs fois par soirée — mise à jour automatique, bascule
développement / version bâtie, veilleur qui relève un serveur tombé. Son onglet,
lui, reste ouvert des heures. **Tout ce qui a été fabriqué au moment de la
construction et inscrit dans sa page devient alors périmé sous ses doigts.**

Trois défauts en deux jours, trois symptômes sans rapport apparent, **une seule
racine** — et deux jours perdus à les traiter séparément :

| Ce qu'il voit | Ce qui a vieilli | Où c'est écrit |
|---|---|---|
| « Cette page n'a pas pu s'afficher », et « Réessayer » n'y peut rien | les adresses des morceaux de code | `ARCHITECTURE.md` §63 |
| « L'enregistrement n'a pas pu être transmis » | l'identifiant de l'action serveur | `ARCHITECTURE.md` §65 |
| « Atlas prépare le devis… » sans fin, il recharge et le devis est là | rien — la réponse s'est perdue en route | `CHANGELOG.md` 12 août |

**Ce qu'il faut faire, dans cet ordre :**

1. **Lui demander deux choses**, avant toute hypothèse : *depuis combien de
   temps la page était-elle ouverte ?* et *est-ce qu'un rechargement répare ?*
   Si recharger répare, la cause est ici — inutile de chercher ailleurs.
2. **Reproduire sa séquence, pas la nôtre.** Les suites ouvrent une page et
   agissent dans la seconde ; lui laisse passer du temps.
   `npx tsx scripts/eprouver-page-vieillie.mts` fait exactement cela : ouvrir,
   redémarrer le serveur, agir.
3. **Chercher ce qui est fabriqué à la construction** dans le chemin en cause —
   identifiant d'action serveur, nom de fichier de code, réponse attendue d'un
   aller-retour tenu ouvert.

**La règle qui en découle, et qui vaut d'avance :** tout ce qu'on déclenche
depuis un écran où l'on STATIONNE doit passer par une adresse stable (une URL),
et ne jamais dépendre d'une seule réponse tenue ouverte. Voir `ARCHITECTURE.md`
§65.

---

## ⚠ Plusieurs conversations travaillent sur ce dépôt EN MÊME TEMPS

**Sa décision du 13 août 2026 — ne PAS rejouer la batterie à chaque fusion.**
*« Seulement quand le code touche. »* Un lot déjà éprouvé au vert n'a pas à
repasser soixante suites parce qu'une autre session a poussé du code sans
rapport. Le tableau qui dit ce qui compte comme « ça touche » est dans
`CLAUDE.md` §6 — et **une migration arrivée par la fusion s'applique d'abord**,
sans quoi la batterie rend des dizaines de rouges qui n'accusent que la base.

**Ce que ça ne relâche pas** : la batterie complète reste obligatoire avant la
PREMIÈRE poussée d'un lot, sur son propre code.


**Dit par le patron le 11 août 2026 :** *« sur d'autres sessions, je demande de
faire d'autres corrections. »* Ce n'est donc pas une hypothèse : `main` bouge
pendant qu'on travaille, et il a bougé de trois commits en une après-midi.

Trois conséquences, à appliquer sans y réfléchir :

1. **Avant de fusionner, ramener `main` chez soi et REJOUER la batterie.**
   Fusionner sans cela livre un mélange que personne n'a éprouvé : chaque côté
   était vert seul, ce qui ne dit rien de leur somme.
2. **Attendre des conflits dans les six fichiers de mémoire, et les garder tous
   les deux.** `ARCHITECTURE.md`, `CHANGELOG.md` et `TODO.md` conflictent à
   chaque fois — les deux sessions écrivent à la suite. Renuméroter sa propre
   section (celle qui est déjà sur `main` garde son numéro) et **corriger les
   renvois « §NN » des autres fichiers**, sinon ils désignent le travail de
   quelqu'un d'autre.
3. **Si deux sessions touchent le même écran, regarder avant de fusionner.**
   Ici, la session voisine a bâti PAR-DESSUS le travail de la fiche chantier,
   pas à la place — mais rien ne le garantissait, et chacune était verte de son
   côté. Deux verts ne font pas un vert.

Ne jamais forcer une poussée : ce serait effacer le travail d'une autre
conversation, sans qu'elle en sache rien.

---

## En trois phrases

Atlas est un agent au service de l'artisan patron : il prépare les devis, les
envoie au client avec une proposition de date, recueille la réponse, planifie le
chantier, construit la facture à la fin et tient le relevé de TVA. Le parcours
complet est décrit dans **`docs/AGENT.md`** — c'est la référence du produit, à
lire avant toute décision de conception. Le socle technique est une application
Next.js avec PostgreSQL, isolée par entreprise via *row level security*.

## ⚠ À RESSORTIR AU PATRON quand le sujet arrive

**Sa consigne du 9 août 2026, à propos de la validation Google :** *« quand on
sera arrivé à la partie commercialisation, je veux que tu me le ressortes
automatiquement parce que je ne vais pas m'en souvenir. »*

Ce bloc est le mécanisme. Il est **en tête de ce fichier**, que `CLAUDE.md` §1
fait lire au début de **chaque** conversation. Ne pas le déplacer plus bas, ne
pas le résumer : il n'a de valeur que s'il est impossible à manquer.

**La règle : dès qu'un des déclencheurs ci-dessous apparaît dans la
conversation, le point correspondant se dit AVANT de répondre au reste.** Le
patron n'a pas à s'en souvenir — c'est le rôle de ce fichier, et sa défaillance
serait une défaillance du dépôt.

| Si le patron parle de… | Lui ressortir |
|---|---|
| **commercialiser, vendre, premiers clients payants, lancement, mise sur le marché, plusieurs artisans** | **La validation de l'application par Google** (`docs/A-FAIRE.md` §8). Sans elle, l'agenda ne fonctionne que pour **une centaine de comptes inscrits à la main** — et le mur arrive d'un coup, sans prévenir. La vérification demande un domaine, une politique de confidentialité **publiée**, une page d'accueil, une vidéo, et **plusieurs semaines**. Le délai ne se rattrape pas : la demande se lance bien avant la date de vente. Détail complet dans `docs/QUESTIONS.md` §12 |
| **« avant il y avait… », « où c'est passé ? », « je ne retrouve plus… »** | **NE PAS DEVINER : fouiller l'historique AVANT de répondre**, et lui rendre la liste des candidats plutôt qu'une hypothèse. Le 15 août 2026 — *« avant il y avait le Nombre de jour en doré »* —, la fouille a rendu trois choses différentes, dont **une qui n'a jamais été codée** : une ligne dorée de la maquette 51, qu'il avait manipulée la veille. Répondre de mémoire aurait fait coder ce qui existait déjà ailleurs. Et **penser d'abord aux maquettes qu'on lui a envoyées** : il les essaie en vrai, elles ressemblent à l'application, et rien ne les en distingue sur son téléphone (`TODO.md` §0 novemvicies quinquies) |

Un point traité ici se **barre** avec sa date plutôt qu'il ne se supprime :
savoir qu'il a été dit évite de le redire, et savoir quand évite de croire qu'il
est encore valable.

---

## Le piège du 12 août : à jour, et pourtant vieux

**Le patron envoie une capture de l'écran de création. C'est celui d'AVANT** —
bouton pleine largeur, lien en capitales, phrase de pied. Tout ce qui a été
livré la veille est invisible chez lui.

**La cause n'est ni son téléphone ni un cache.** `.devcontainer/mettre-a-jour.sh`
récupère **la branche sur laquelle l'espace se trouve déjà** :

```sh
BRANCHE="$(git rev-parse --abbrev-ref HEAD)"
git fetch --quiet origin "$BRANCHE"
```

Le travail était sur `claude/new-session-a1l4v9` ; son espace est ailleurs. La
mise à jour fonctionne donc parfaitement, **et rend « à jour »** — sur une
branche qui ne recevra jamais ce travail. C'est exactement la classe de
malentendus que « Chercher les dernières corrections » existait pour éteindre
(voir l'en-tête de `BoutonMiseAJour.tsx`, trois soirées perdues), revenue par une
autre porte : ce n'est plus le code qui est vieux, c'est la BRANCHE qui n'est pas
la bonne.

**Ce qu'il faut faire avant de livrer quoi que ce soit à essayer :**

1. **Vérifier où est son espace.** Une capture de l'écran Réglages donne la
   version (`versionExecutee`) — mais **pas la branche**. C'est le trou : une
   capture ne peut pas répondre à « suis-je sur la bonne branche ? ». Poser le
   nom de la branche à côté de la version fermerait ce trou définitivement.
2. **Ne jamais dire « c'est livré » sans dire OÙ.** Une branche poussée n'est pas
   une application mise à jour. Tant que le travail n'est pas sur la branche que
   son espace suit, il n'existe pas pour lui.

## Le 12 août : deux défauts sur une seule capture

**« Je ne peux pas envoyer mon devis, ni par SMS ni par mail. »** La feuille
d'envoi affichait *« Stockage local sélectionné en production — configuration
refusée »*. `src/server/storage/index.ts` ne regardait que `NODE_ENV`, alors que
le banc **sert une version bâtie** et que `next start` impose
`NODE_ENV=production` sans rien déployer. La configuration connaissait la
distinction (`bancDEssai`) ; cette barrière-là l'ignorait.

**La leçon, plus large que le correctif :** son commentaire affirmait « le module
d'environnement refuse déjà… », ce qui était FAUX sur le banc. Une barrière qui
se croit redondante et ne l'est plus est invisible — personne ne relit une
duplication supposée fidèle. `CLAUDE.md` §3 : jamais de règle dupliquée.

**« Le bouton, ce n'est pas le même. »** La feuille d'envoi dessinait son bouton
à la main. **Une action principale dessinée sur place échappe à toute décision
d'ensemble.** Avant de dire « le bouton est partout », chercher les boutons
peints à la main :

```sh
grep -rn "backgroundColor: colors.rust" src/app src/components --include="*.tsx"
```

**Et le trou du script de capture :** `capture-bouton-partout.mjs` parcourt des
ADRESSES. Une feuille qui monte sur un geste n'en a pas — elle était donc hors
de son champ, et le compte « dix-sept écrans » ne comptait que ce qu'il savait
atteindre. Les conversions restantes sont listées dans `TODO.md` §0 octies, non
faites d'office : sa règle est *« montre-moi avant de faire »*.

## Tous les boutons sont arrondis (12 août)

Seize boutons dessinés à la main portaient encore un rayon de 4 px. **Seul le
rayon a changé** — deux d'entre eux sont des `type="submit"` (connexion,
documents légaux) et `PrimaryButton` impose `type="button"` : les y faire passer
casserait leur formulaire, en silence.

`scripts/test-boutons-arrondis.ts` garde la forme et nomme le coupable. Il porte
un témoin : un motif devenu aveugle passerait au vert sur une application
entièrement carrée.

**Et une trouvaille, non traitée :** l'écran de connexion est le seul resté dans
l'ancienne identité — terre cuite `#B5502F` écrite en dur, carte blanche, aucune
serif. C'est le premier écran qu'il voit. `TODO.md` §0 nonies.

## La porte est refaite (12 août) — et deux pièges à connaître

`src/app/login/page.tsx` porte ses trois choix : ligne d'imprimé, sceau à la
**rose des vents**, et **le tour** pendant la vérification. `ARCHITECTURE.md` §71.

**Piège A — le serveur de développement n'hydrate pas cet écran, ICI.** Sa
liaison de rechargement à chaud est refusée par le mandataire réseau, le
formulaire part en HTML pur, la page se recharge et **tout champ redevient vide
quel que soit le code**. Quatre correctifs justes ont été déclarés morts pour
cette raison. Avant d'accuser le code : mesurer sur la version BÂTIE
(`npm run banc`), pas sur `next dev`. `test-porte-e2e.ts` compte désormais les
navigations complètes et annonce « non concluant » plutôt que rouge.

**Piège B — React remet le formulaire à zéro APRÈS le rendu qui suit l'action.**
Ni un champ contrôlé, ni un effet, ni `defaultValue` ne font survivre une valeur
à cette remise. Ce qui tient : une `ref` qui met la valeur par défaut à jour
**et** une `key` qui remonte le champ à chaque envoi. Ne pas « simplifier » l'un
des deux.

## Mon compte et Connexion : CODÉS le 14 août — trois pièges

Dix rubriques sur treize sont codées. Ce lot a ouvert les deux dernières
(`ARCHITECTURE.md` §107), et il laisse trois choses à ne pas découvrir à froid :

1. **`src/server/repositories/compte.ts` n'appelle PAS `withEntreprise`**, contre
   la règle de `CLAUDE.md` §3. `users` est la seule table sans RLS : elle ne
   porte pas d'`entreprise_id`. Ce qui protège à la place, c'est que chaque
   requête est bornée par `ctx.utilisateurId` — **un `where` oublié changerait le
   mot de passe de tout le monde, et rien d'autre ne le verrait**.
   `scripts/test-compte-db.ts` monte deux comptes exprès pour ça.
2. **« Me déconnecter partout » se fait dans `getCurrentCtx`**, pas dans le
   middleware (Edge, pas de base). Il compare `session.user.emisLe` — recopié de
   `token.iat` par `auth.config.ts` — à `users.jetons_valides_depuis`. Un jeton
   **sans** `iat` passe : refuser par défaut aurait déconnecté tout le monde au
   déploiement.
3. **La suite navigateur ne change JAMAIS le mot de passe de démonstration.**
   Il sert aux 75 suites de la batterie : le changer fermerait la porte à toutes
   les suivantes, et l'échec accuserait la page de connexion.

## Les treize rubriques ont toutes leur planche (14 août)

`maquettes/atlas-reglages-moi.html` a fermé la série : **Mon compte** et
**Connexion** étaient les deux dernières jamais dessinées. Huit rubriques sont
codées, cinq attendent.

**La planche pose DEUX QUESTIONS, et il faut les lui poser avant de coder** —
parce que le sommaire promet deux choses qui n'existent nulle part :

| La promesse du sommaire | Ce que la base porte vraiment |
|---|---|
| « Nom, e-mail et **téléphone** » | `users` : `email`, `nom`, `image`, `password_hash`. **Pas de téléphone**, et rien ne l'appellerait — ni SMS ni e-mail sortant (tranché le 4 août) |
| « Mot de passe et **appareils** » | `src/auth.ts` : `session: {strategy: "jwt"}`. **Aucune session en base**, donc rien à lister — il faudrait l'écrire |

**Ne pas dessiner d'appareils plausibles en attendant sa réponse.** « iPhone ·
Mantes-la-Jolie · il y a 2 h » se valide en dix secondes, et le défaut
n'apparaît qu'au moment de coder. Le contrôle de la planche le refuse
explicitement, et il sait rougir.

Le détail, les deux réponses possibles et leur coût sont dans `TODO.md`
§0 octovicies.

## Les réglages : le PLAN posé, les rubriques EN ATTENTE (13 août)

`maquettes/atlas-reglages-plan.html` — quatre écrans : les réglages vus par le
**patron**, par le **commercial**, par le **salarié**, et **l'interrupteur**.
Contrôlé par `maquettes/verifier-atlas-reglages-plan.mjs`, branché dans
`npm run verifier:maquette`. **Rien dans `src/`** — sa règle du 11 août.

**Ce que ce lot tranche, et qui vaut pour les neuf rubriques suivantes :** les
deux ensembles « Moi » / « Mon entreprise » ; le fait qu'une rubrique interdite
soit **absente** et non masquée ; et la liste de ce qui n'aura **jamais**
d'interrupteur (mentions légales de la facture, identité de l'émetteur,
numérotation continue, conservation légale).

**Trois choses à ne pas croire acquises :**

1. **Le rôle « commercial » n'existe nulle part** — ni en base
   (`membres_entreprise.role` : `proprietaire` | `membre`), ni dans
   `docs/QUESTIONS.md` §10, qui connaît l'éditeur, le patron et le salarié.
   Il est dessiné pour être tranché.
2. **Le cloisonnement par rôle n'est pas codé.** Ne pas conclure de la maquette
   qu'un salarié ne voit pas les prix : `QUESTIONS.md` §10 exige que la donnée
   ne SORTE pas du serveur, et rien de tel n'est en place aujourd'hui.
3. **Le logo existe depuis le 24 août 2026** — `document-commun.ts` le pose
   au-dessus du nom (`imageDuLogo`), et l'écran de rédaction aussi depuis le
   25 (`ARCHITECTURE.md` §173). Cette ligne affirmait le contraire : elle a été
   corrigée le 25 août, elle envoyait chercher au mauvais endroit.
   Ce qui reste vrai : remplacer le devis entier par un **modèle importé** n'est
   pas possible sans perdre les totaux, la TVA et la numérotation — à dire avant
   d'y revenir.

   **Les conditions, elles, se règlent depuis le 14 août 2026**
   (`ARCHITECTURE.md` §102) : « 30 jours » n'est plus en dur dans
   `devis-pdf.ts`, il vient de la rubrique « Devis & factures » et se **fige**
   dans `devis.validite_jours` à la création — corriger le réglage ne réécrit
   pas un devis déjà parti. **Attention : seule la validité atteint le PDF.**
   L'acompte, le délai, les moyens de paiement, le rappel des pénalités et le
   texte de pied sont enregistrés et montrés en aperçu, mais ne s'impriment pas
   encore (`TODO.md` §0 quinvicies bis). Les mentions légales de la FACTURE
   restent scellées en dur dans `facture-pdf.ts`, et c'est délibéré.

**⚠ LE PREMIER JOUR D'UN ARTISAN N'A JAMAIS ÉTÉ VU.** Sa remarque du 13 août :
*« quand l'application sera commercialisée, le devis sera vierge, et c'est avec
ces informations-là qu'il devra se remplir automatiquement ».* Ne pas la sous-
estimer : `seed.ts` pose une entreprise **complète** (« Atelier Démo », SIRET,
IBAN), donc tout ce qui est éprouvé ici et sur son banc part d'un état rempli.
Or **il n'existe aucun parcours d'inscription**, **l'identité ne se saisit que
dans le devis écrit à la main**, et **rien ne la vérifie avant l'envoi**. Le
premier devis d'un vrai artisan partirait sans SIRET ni IBAN, sans un mot. Le
détail des six faits est dans `ARCHITECTURE.md` §87, la liste de travail dans
`TODO.md` §0 tricies.

**La saisie de « Mon entreprise » a été refaite le 14 août 2026**
(`ARCHITECTURE.md` §99) : adresse qui propose, téléphone à drapeau, forme
juridique en liste, bouton d'enregistrement. **Trois choses à ne pas casser :**

1. **`src/lib/telephone.ts` définit la découpe SANS le zéro de tête.** Le
   national le recolle au premier groupe, l'international ne le met pas — c'est
   ce qui rend le numéro joignable depuis l'étranger. Deux tables auraient
   divergé.
2. **Rien n'a changé en base.** Le numéro reste rangé tel qu'il s'écrit, et
   l'indicatif se relit de la valeur. Ne pas ajouter de colonne « pays ».
3. **Le bouton d'enregistrement ne remplace pas l'écriture automatique**, il la
   dit. Les champs s'écrivent toujours seuls en quittant la ligne.

**Le blocage de l'envoi sans SIRET a été codé PUIS RETIRÉ le 14 août 2026**
(`ARCHITECTURE.md` §97). Le patron l'avait choisi le matin, planche en main ; en
voyant l'écran il a tranché l'inverse : *« rien de plus, rien de moins »* — les
réglages alimentent le devis, ils ne commandent pas l'écran d'envoi.

**Ne pas le recoder en croyant réparer un oubli.** Aujourd'hui un devis part
sans SIRET si le patron n'en a pas saisi, et rien ne l'en avertit : c'est un
risque qu'il assume, l'argument lui ayant été donné.

**Ce qu'il voulait, en revanche, existe déjà** : `getOuCreerDevisBrouillon`
recopie l'entreprise dans le devis, et un brouillon rafraîchit sa copie à chaque
ouverture — un SIRET saisi ce soir apparaît dès qu'on rouvre le devis.

**Les réglages ont été REFONDUS le 14 août 2026** (`ARCHITECTURE.md` §96), à sa
demande : *« je veux que tu recrées entièrement la page de réglage »*. L'écran
est devenu un **sommaire** de treize rubriques en deux ensembles, et tout ce qui
s'y empilait est parti dans sa rubrique. **Quatre choses à savoir avant d'y
toucher :**

1. **Les adresses ont bougé.** Les tarifs sont sur `/reglages/tarifs`, les
   équipes du planning sur `/reglages/planning`, l'IA sur `/reglages/ia`, les
   données sur `/reglages/donnees`, et la périodicité de TVA a rejoint le régime
   sur `/reglages/identite`. Cinq suites navigateur ont dû être redirigées.
2. **La liste vit dans `src/lib/rubriques-reglages.ts`**, pas dans l'écran. Y
   ajouter une rubrique la fait apparaître ; changer son rôle change ce que le
   serveur rend. Ne pas dupliquer cette liste ailleurs.
3. **C'est le premier écran où `getRole` décide de ce qui est RENDU**, et cela
   ne vaut QUE pour les réglages : chantiers, devis et factures montrent encore
   tous les montants à un membre. Ne pas lire ce lot comme si le cloisonnement
   était fait.
4. **Six rubriques sont marquées « Bientôt »** et ne sont pas des liens : mon
   compte, notifications, connexion, apparence, l'équipe au sens des comptes, et
   « Devis & factures ». Leur donner un `href` suffit à les ouvrir.

**Le sommaire lui-même, dessiné le 14 août** — et il vient d'une planche que le
patron a envoyée sans qu'on la demande, noir et or, avec ce seul mot : « c'est
ça que je voulais ! ». `maquettes/atlas-reglages-sommaire.html`,
`ARCHITECTURE.md` §95. **Trois choses à ne pas rater si l'on reprend ce sujet
à froid :**

1. **Il reste un choix à obtenir : filets ou cartes.** Les deux registres sont
   sur la planche, côte à côte, avec la même liste. Ne pas trancher à sa place.
2. **Les couleurs ont été demandées, pas devinées.** Sa planche était sombre ;
   il a répondu « crème, comme le reste ». Le mode sombre reste « Apparence »,
   marquée *Bientôt*. Ne pas rouvrir sans lui.
3. **Les deux ensembles « Moi » / « L'entreprise » ne sont pas décoratifs** : sa
   liste de dix était plate, et sans eux il n'y a nulle part où couper pour le
   salarié. Coder cet écran suppose donc le cloisonnement par rôle EN LECTURE,
   qui n'existe pas encore (`getRole` n'est appelé dans aucun écran).

**Lot 2 fait le 13 août : l'identité de l'entreprise**
(`maquettes/atlas-reglages-identite.html`, `ARCHITECTURE.md` §87). Il a révélé
**trois manques qui sont du code, pas du dessin** : le régime de TVA est deviné
d'après le taux appliqué et se trompe dans les deux sens ; le numéro de TVA
intracommunautaire n'existe nulle part ; le téléphone et l'e-mail sont saisis et
ne s'impriment sur aucun document. Ils sont dans `TODO.md` §0 tricies.

**Lot 3 fait le 13 août : l'équipe et les rôles**
(`maquettes/atlas-reglages-equipe.html`, `ARCHITECTURE.md` §88). Deux choses à
ne pas rater : **« équipe » désigne déjà une FILE DU PLANNING**, pas un compte —
la rubrique tient donc deux listes séparées ; et **le cloisonnement en lecture
n'existe pas** : `getRole` n'est appelé dans aucun écran, un membre voit tous
les montants.

**Lot 4 fait le 13 août : tarifs et catalogue** — les quatre priorités du
patron sont dessinées (`ARCHITECTURE.md` §89). À retenir : **ses tarifs** lui
appartiennent, **le catalogue est partagé** et ne porte aucun prix, et **les
cinq grilles apprennent de ses devis** au lieu de se saisir.

**LA DIRECTION DU PRODUIT, posée le 13 août 2026 :** *« créer un deuxième
cerveau au sein de l'application — elle doit apprendre, enregistrer, s'améliorer,
s'auto-alimenter »*. Ce qui apprend déjà : `lecons_prix`, les cinq grilles, la
base documentaire. Ce qui manque le plus : **le temps réel d'un chantier n'est
enregistré nulle part**, donc Atlas ignore si ses estimations de durée sont
justes — alors que c'est la durée qui fait le prix. **Et la leçon qui commande
tout :** `historique_prix` était lue et jamais écrite ; devant toute idée
d'apprentissage, demander **qui l'écrit et à quel moment**, jamais « avons-nous
une table ? » (`ARCHITECTURE.md` §90, `docs/QUESTIONS.md` §17).

**⚠ `parametres_chiffrage` agit sans être visible.** Cinq valeurs par
entreprise — 200 €/jour l'ouvrier, 280 € le chef, 35 € le déplacement, 20 % de
marge, 20 % de TVA — décident du prix proposé dès qu'aucun tarif ne correspond,
et **aucun écran ne permet de les changer**. Trouvé le 13 août en répondant à sa
question « l'IA se servira de ces infos ? ». Ne pas le redécouvrir
(`ARCHITECTURE.md` §83).

L'ordre des lots est dans `TODO.md` §0 tricies ; le pourquoi dans
`ARCHITECTURE.md` §80 à §83.

**Deux conventions posées le 13 août, qui valent pour toutes les planches à
venir.** Les couleurs sont **recopiées de `src/lib/design-tokens.ts`** et le
contrôle lit ce fichier pour les comparer (les neuf planches antérieures gardent
l'ancien nuancier : elles passeront à la charte quand leur sujet sera rouvert).
Et le gros plan se fait à la **loupe** (`zoom` au-dessus de 1000 px), jamais en
élargissant le téléphone : sinon les libellés tiendraient sur une ligne et les
cibles paraîtraient confortables, sans que ce soit vrai sur son iPhone. La loupe
est éteinte en iPhone 13, ce qui laisse les contrôles mesurer juste — un contrôle
le vérifie, et c'est lui qu'il ne faut pas retirer.

**Et la grammaire est celle des ÉCRANS, relevée dans le code des composants :**
retrait de **26 px** (et non les 24 de `spacing.pageX`, qui est l'ancienne
échelle — seuls `error.tsx`, `loading.tsx` et `Notifications.tsx` y sont
restés), titre de 36 px, **un cheveu qui ferme l'en-tête**, titres de section
**gris précédés d'un trait**, barre basse à 9,5 px / 0,28 em. Et l'écran de la
planche doit mesurer **390 px** : sous 520 px la coque du téléphone s'efface,
sinon il n'en fait que 336 et la barre basse de l'application n'y tient pas —
c'est ce qui avait fait rapetisser sa chasse dans les planches précédentes
(`ARCHITECTURE.md` §86).

**Piège payé sur cette planche :** éprouver qu'un contrôle sait échouer écrit
ses captures dans `maquettes/vues/` comme une exécution normale. La planche a
été relue sur une image produite par la version **cassée**. Relancer le contrôle
sur le fichier sain avant de regarder.

---

## L'écran de connexion : maquette posée, choix EN ATTENTE (12 août)

`docs/maquettes/35-l-ecran-de-connexion.html` — l'avant reproduit, puis quatre
après (la carte gardée, sans carte, le sceau, la ligne d'imprimé). **Ne rien
poser dans `src/app/login/` avant qu'il ait désigné laquelle**, sa règle du
11 août.

**FAIT le 12 août au soir** — ce qui suit est conservé pour la trace du chemin.

**Il a déjà tranché la mise en page, le 12 août au soir :** la **4** (les champs
en ligne d'imprimé), **sans le titre « Connexion » ni la sous-ligne**, avec **le
sceau et ATLAS de la 3** au-dessus. Ce qui reste ouvert est **l'animation de la
marque à l'entrée** — six propositions dans
`docs/maquettes/36-le-logo-qui-sanime.html`, son numéro attendu.

**Puis il a retenu « le tour »** (maquette 36, proposition 3) et demandé
d'autres gravures : `docs/maquettes/37-le-motif-du-sceau.html`, huit motifs,
**son numéro attendu**. Le rond d'or, l'écran et l'animation n'y bougent plus.

**La leçon de la 34, qui vaut pour toute icône de ce dépôt :** un motif se juge
**à sa taille réelle**, jamais agrandi. La bande en tête de cette maquette est
là pour ça, et elle a tué trois propositions — à 29 px avec un trait d'1,5, une
tige et trois ovales se rejoignent en pâté quel que soit l'écartement. Une seule
grande forme tient toujours ; trois petites, jamais.

**Trois choses à ne pas défaire, dans la maquette comme dans l'écran :**

1. **`pointer-events:none` sur `.conn` une fois entré.** Les deux écrans
   occupent la même case de grille ; un écran à `opacity:0` continue
   d'intercepter le doigt, et « Recommencer » ne répondait pas. Invisible sur
   toute capture.
2. **La demi-seconde est un plancher, pas une attente.** Voir `TODO.md`
   §0 nonies : au moment de coder, décider ce que fait l'animation quand le
   serveur tarde. Les six bouclent dans la maquette, exprès.
3. **`scripts/verifier-maquette-logo.mjs` doit rester joué** après toute
   retouche : il éprouve les douze écrans (fichier seul et page unique)
   JavaScript coupé, et il sait échouer.

**Ce qui ne dépend PAS de son choix, et qui part avec n'importe laquelle :**

1. **Les champs passent à 16 px.** Ils sont en 15, et en dessous de 16 **iOS
   agrandit la page dès qu'un champ prend le focus** — le jeton
   `styleChampPlage` existe depuis le 10 août pour cette raison exacte, et cet
   écran ne s'en sert pas. C'est un défaut de son téléphone, pas une préférence.
2. **Le refus passe de `text-red-600` à `colors.alert`.**
3. **La place du message reste réservée** (`min-height`), sinon le bouton
   descend d'une ligne au moment où il appuie dessus.

**Pourquoi cet écran échappe à tout :** c'est le seul vu **avant** d'être
connecté, donc le seul qu'aucun parcours de l'application ne traverse. Le même
raisonnement vaut pour `src/app/documents-legaux/formulaire.tsx`.

## L'agenda iCloud : CODÉ le 12 août — et ce qui reste à éprouver chez lui

**La maquette a été montrée, puis il a tranché :** *« code pour qu'on puisse
lire et écrire dans cet agenda »*. C'est fait — `ARCHITECTURE.md` §75 porte le
détail et le pourquoi.

**⚠ CE QUI N'A JAMAIS PARLÉ À APPLE.** Aucun échange réel avec iCloud n'a eu
lieu : le mandataire réseau d'ici refuse `caldav.icloud.com`. Les trois appels
HTTP de `src/server/agenda/apple.ts` sont donc **non éprouvés**, et tout le
reste — ce qui décide — l'est entièrement (`test-ics.ts`, `test-caldav.ts`,
`test-agenda-apple-base.ts`). **Ne pas lui dire que le raccordement est vérifié
avant qu'il l'ait branché une fois.**

Si ça échoue chez lui, regarder dans cet ordre : la **découverte** (iCloud
redirige vers le serveur du compte, et un `PROPFIND` transformé en `GET` rend
une page au lieu d'un `multistatus`), la **double authentification** (sans elle,
Apple n'émet pas de mot de passe pour les apps, et refuse en 401 comme un mot de
passe faux), puis le **dépôt**. Dans les trois cas, la phrase d'Apple est
affichée telle quelle sur l'écran des réglages : la lire avant de supposer.

**Le contexte, pour ne pas le redécouvrir.** Il a envoyé une capture du
Calendrier d'Apple : *« je peux connecter ce calendrier à mon appli ? »* Le
Calendrier n'étant qu'une **vitrine** — il affiche iCloud comme Gmail —, la
question a été posée avant de répondre. Ses deux réponses : le compte est
**iCloud**, et il veut **les deux sens**. Réponse complète et chiffrée dans
`docs/QUESTIONS.md` §14, chemin de mise en œuvre dans `TODO.md` §0 unvicies.

**Ce qui change tout par rapport à Google** : Apple n'a **aucun** bouton
« accepter » pour l'agenda. Il faut CalDAV et un **mot de passe spécifique à
l'app**, généré sur son compte Apple — et ce mot de passe **ouvre tout
l'iCloud**, mail et fichiers compris, parce qu'Apple ne sait pas le restreindre
à un service. Ce n'est pas un détail à ranger en petits caractères : c'est la
raison pour laquelle l'avertissement est **au-dessus** du champ dans la
maquette, et pourquoi le contrôle le vérifie **par sa position**.

**Trois choses à ne pas défaire dans cette maquette-là :**

1. **L'interrupteur d'écriture reste éteint au départ**, et le choix du
   calendrier n'existe pas tant qu'il l'est. Écrire dans son agenda personnel
   est une décision ; un réglage allumé d'office la lui prend.
2. **Le repli est un calendrier « Atlas » séparé**, pas « Perso ». Ce qu'Atlas a
   posé se retire alors d'un geste au débranchement — semé dans « Perso », il se
   reprend un par un.
3. **Pas de raccourci `font:` avec `inherit`.** `font:400 16px/1.4 inherit` est
   **invalide** et la déclaration entière tombe : les champs repassaient à
   13,3 px (donc le zoom de Safari) et les boutons à 43 px, sous les 44 px du
   doigt. Trouvé par le contrôle, invisible à l'écran. Le même piège dort dans
   les autres maquettes du dossier.

**Un quatrième piège, propre au JSX et trouvé sur une capture :** l'écran
affichait « votre iCloud**—** pas seulement l'agenda ». Le JSX avale l'espace
qui suit une balise fermante à cet endroit — l'écran de Google portait déjà un
`{" "}` pour cette raison, sans que personne l'ait écrit. Quatre phrases du même
écran portaient le piège. **Aucun test de texte ne l'attrape** : le contrôle
vise désormais le texte RENDU (`test-agenda-reglages-e2e.ts`).

**⚠ Le faux rouge qui a coûté quatre batteries le 12 août n'était PAS le
préchauffage.** `run-e2e-tests.ts` recueillait la sortie du serveur par un
tuyau, et lance chaque suite avec `spawnSync` — qui bloque sa boucle
d'événements. Personne ne vidait le tuyau pendant une suite ; à 64 Ko, **le
serveur se bloquait en écriture** et ne répondait plus. Le rouge tombait alors
sur l'écran suivant, au hasard. La sortie va dans un fichier depuis. Si un
dépassement de délai inexplicable revient sur une suite lourde, vérifier
d'abord que rien n'est repassé en `pipe`.

**Pour diagnostiquer une suite navigateur sans rejouer la batterie :**
`npm run test:e2e -- --seulement <motif>`. Écrit le 12 août après avoir rejoué
vingt-cinq minutes pour observer UNE suite — c'est ce coût-là qui pousse à
supposer une cause au lieu d'aller la lire. Le script dit à voix haute qu'il
n'est pas la batterie.

## L'ASSISTANT A QUITTÉ LE COIN FLOTTANT (13 août)

*« La B mais de la même couleur qu'elle est déjà »* — le bouton est dans
l'en-tête, à côté du titre, en vert pin plein. `ARCHITECTURE.md` §106.

**⚠ Ne jamais le remettre en `fixed`.** C'était la cause : cinq écrans ont été
déplacés cet été pour éviter cette bulle. Et **ne pas lui donner une ligne à
lui** au-dessus du titre : essayé, mesuré, défait — 72 px en tête de chaque
écran, et la dernière semaine du planning passait sous la barre.

`scripts/test-assistant-en-tete-e2e.ts` tient les deux, plus les lignes du titre.

**⚠ Le groupe qui porte l'assistant est `self-stretch`, et ça compte.** « Modifier »,
posé par une autre session à la même place, s'aligne par `self-end` : enfermé dans
un groupe haut de 44 px, il descendait de 21 px sous la ligne du titre. Une fusion
propre ne prouve rien sur la mise en page — deux gestes peuvent se disputer le
même espace sans qu'aucun conflit ne se déclare.

## L'ATTENTE DE LA DICTÉE EST CODÉE — « le souffle » (13 août)

Il a répondu **« code la C »**. Les points enflent et se rétractent l'un après
l'autre, sans se déplacer. `ARCHITECTURE.md` §80 porte le détail.

**Quatre choses à ne pas défaire**, listées dans `TODO.md` §0 tricies — dont
le bouton qui **ne redevient pas** à demi effacé, et la phrase « Atlas rédige… »,
qui est la seule des trois moitiés à parvenir à qui n'a pas les yeux sur l'écran.

**L'attente qui s'éternise rend la main** (« oui fait ça ») : « Atlas rédige… »,
puis à 12 s « C'est plus long que d'habitude. », puis à 45 s « Pas de réponse.
Réessayez. » et le micro revient. **Renoncer n'interrompt pas l'appel** — et
comme il peut redicter pendant que la première réponse court encore, un numéro
de tour empêche celle-ci de remettre l'écran au repos au milieu du nouvel
enregistrement.

**⚠ Une phrase d'attente tient sur UNE LIGNE — 31 caractères, mesurés.** Au-delà
elle prend toute la colonne de 190 px et casse « Un chantier » en deux, en plein
milieu de l'attente. Deux contrôles la gardent, et le second existe parce que le
premier a dormi (`TODO.md` §0 tricies quater). **Le message de fin de dictée
a le même défaut, et il est antérieur** : 47 caractères, non touché, c'est son
choix.

**La photo souffle aussi**, tranché par lui le jour même : *« oui souffle aussi
pour la photo »*. Le bouton d'ajout portait le même caractère immobile. Les
points y sont **or** et non vert sans qu'une mesure ait été recopiée — ils
prennent `currentColor`. C'est pour cela que la couleur n'est pas écrite dans le
composant : ne pas l'y remettre.

**⚠ Un piège d'outillage à connaître avant d'écrire une suite qui RALENTIT le
serveur** (les deux le font, pour rendre l'attente observable) : router une
adresse dans Playwright **désactive le cache HTTP de toute la page**. La
visionneuse des photos repartait du réseau pour une image déjà affichée, son
`<img>` n'avait pas fini de charger, et **l'échec accusait la visionneuse** qui
n'y était pour rien. Relâcher la route dès la mesure faite, et seulement une fois
l'échange retenu terminé — la couper en vol donne « Route is already handled! ».
`TODO.md` §0 tricies ter.

*Ce qui suit est l'historique du choix, gardé pour ne pas rouvrir ce qui est clos.*

## Les cinq attentes proposées (13 août)

**Sa demande :** *« une fois qu'on a appuyé sur le dictaphone, on ne sait pas ce
qui se passe. Les trois petits points sont fixes […] on ne sait pas si ça bug ou
non. »*

Deux planches — la **42** expose les cinq gestes côte à côte, la **43** est celle
qu'il a MANIPULÉE (il appuie sur le micro, arrête, les points bougent), et c'est
elle qui a tranché. Cinq attentes : A la vague, B la vague ample, **C le
souffle** (retenue), D le point qui court, E l'anneau qui tourne. Les quatre
écartées restent dans les planches : s'il rouvre le sujet, repartir de là plutôt
que de redessiner.

**Trois choses à ne pas redécouvrir :**

1. **Ce n'étaient pas des points arrêtés, c'était le caractère « … »** — un seul
   glyphe. Il n'y avait rien à remettre en marche ; trois points séparés étaient
   à écrire. Devant un « ça ne bouge plus », vérifier d'abord qu'une animation
   a seulement existé.
2. **Le vrai silence n'était pas l'animation, c'était la PHRASE ABSENTE.**
   L'écran parle quand il écoute et quand il a fini, et se taisait pendant le
   seul moment où l'on se demande s'il est en panne. Le bouton passait en plus à
   `opacity: 0.5` — le vocabulaire d'un bouton éteint. Ces deux points-là
   n'étaient pas dans sa demande ; ils lui ont été montrés dans les cinq
   propositions, et il ne les a pas refusés.
3. **Une image fixe ne montre pas un mouvement.** `animer-maquette-points.mjs`
   fabrique un GIF par proposition (sans ffmpeg, absent d'ici) — et il **relit
   sa sortie**, parce qu'au premier jet il certifiait « ✓ » une image fixe.
## ⚠ Rouvrir un chantier, c'est REPRENDRE (13 août) — et la leçon qui va avec

La liste des chantiers ne mène plus à la fiche mais **à l'écran où le travail
s'est arrêté** (`lienDeReprise`, `ARCHITECTURE.md` §98). Sa demande, mot pour
mot : *« que ça me renvoie à l'étape où je me suis arrêté ».*

**La leçon, et elle vaut au-delà de ce point.** Le premier correctif a traité un
défaut RÉEL mais pas le sien : la fiche annonçait « Brouillon » et proposait
« Ajouter des photos » sur un devis prêt à partir. C'était juste à corriger, et
ce n'était pas ce qu'il demandait. Il a dû le redire : *« non non, mais ne
touche pas au centre en fait. Tu n'as pas compris ma requête. »*

Ce qui l'avait fait dévier : sa plainte décrivait un SYMPTÔME (« je suis obligé
de refaire toutes les étapes »), et le premier écran regardé portait bien un
défaut. **Trouver un défaut sur le chemin ne prouve pas que c'est le sien.** La
phrase qui tranchait était pourtant dans son message : *« si je reclique sur mon
chantier »* — c'est la LIGNE DE LA LISTE qu'il désignait, pas la fiche.

**Ne pas rouvrir le centre de la fiche** sans qu'il le demande. La maquette
`maquettes/atlas-centre-de-la-fiche.html` reste au placard, et n'a rien changé
dans `src/`.

## ⚠ Faire le ménage des serveurs dans un appel SÉPARÉ de la batterie

**Payé quatre batteries, le 17 août 2026.** `test-fiche-pendant-relance` rougit
si la commande qui lance la batterie contient elle-même
`pgrep -af "next-server|next dev"` — le ménage des serveurs orphelins.

`veiller.sh` ne conclut « serveur mort » que si `pgrep -f '[n]ext(…)'` ne trouve
**rien**, et `pgrep -f` compare la **ligne de commande entière de tout processus
vivant**. Le shell qui porte à la fois le ménage et la batterie reste vivant
pendant toute celle-ci : sa propre ligne de commande contient « next dev », le
veilleur croit voir un serveur, et la suite échoue sur un montage qui n'a pas
reproduit son cas.

**Donc : deux appels, jamais un.** Le ménage d'abord, qui se termine ; la
batterie ensuite, dans une commande qui ne nomme aucun de ces motifs.

**Et la leçon générale :** une commande de diagnostic qui NOMME un motif
surveillé par le produit devient elle-même ce qu'elle cherche. Le rouge était
reproductible quatre fois, « sous charge » était une explication plausible — et
fausse. `TODO.md` §0 trigies quater.

## ⚠ Un contrôle qui CLIQUE n'éprouve pas qu'une cible est ATTEIGNABLE

**Payé le 17 août 2026, et deux fois par le patron.** Il ne pouvait pas poser de
date à la main sur le planning ; toutes les suites du planning étaient vertes, et
l'une d'elles parcourt le geste entier.

**Playwright fait défiler un élément jusqu'à lui AVANT de cliquer dessus.** Un
contrôle qui clique éprouve donc qu'une cible EXISTE, jamais qu'elle est sous les
yeux. Chez lui, le calendrier était 231 px au-dessus du haut de l'écran après
l'appui : rien ne bougeait, aucune journée ne s'ouvrait, et il concluait que la
fonctionnalité n'existait pas.

**Devant un « je ne peux pas faire X » alors que la suite de X est verte :
MESURER la position de la cible dans la fenêtre**, jamais se fier au fait que le
clic passe. `test-poser-une-date-e2e` le fait, et refuse de conclure si la scène
n'est pas la sienne. `ARCHITECTURE.md` §127.

**Et la cause était lisible sans exécuter :** `amenerAuCalendrier` annonçait dans
son propre commentaire servir « depuis deux endroits », et n'était appelée que
d'un seul. Une fonction dont la note promet deux appelants et qui n'en a qu'un
est un défaut qui ne rougit nulle part.

## Piège d'outillage : une page SUPPRIMÉE laisse un validateur qui rougit

**Payé le 17 août 2026, vingt minutes.** La batterie est tombée sur deux étapes
— **Types** et **Construction** — avec ce message :

> `.next-batie/types/validator.ts(440,39): Cannot find module
> '../../src/app/reglages/planning/page.js'`

**Aucune source ne mentionnait cette page.** Une autre session l'avait
supprimée à dessein (« Supprimer la rubrique Planning, qui doublait Équipe »).
Ce qui restait, c'était le **validateur engendré** par une construction
antérieure — et `tsconfig.json` inclut `.next-batie/types/**/*.ts`
délibérément, pour que les défauts de route se voient ici plutôt que chez le
patron.

**L'erreur accuse le mauvais coupable :** elle envoie chercher une page
disparue, alors que le fautif est un dossier de construction périmé. Et elle est
circulaire — la construction se type-vérifie contre le reste qu'elle devrait
remplacer.

**Le geste, et il ne coûte rien :**

```bash
rm -rf .next-batie .next-verification   # engendrés, ignorés par git
```

**Ce qui reste à faire, et n'a PAS été fait ici** (ce lot ne touchait que des
planches) : la batterie devrait nettoyer ces dossiers avant l'étape
« Construction » de `scripts/verifier-avant-livraison.ts`. Sans quoi le piège
reviendra à la prochaine page supprimée.

## ⚠ UNE CAPTURE PLEINE PAGE MENT SUR LA BARRE DU BAS

Posé le 25 août 2026, après avoir signalé au patron un défaut qui n'existait pas.

`page.screenshot({ fullPage: true })` dessine les éléments **fixés** une seule
fois, à la place qu'ils occupent dans le CADRE — donc au milieu d'une longue
page. La barre du bas paraît alors couper un paragraphe en deux, et l'image est
convaincante.

**Ce n'est pas ce que voit le patron.** Pour savoir si un texte passe vraiment
dessous : dérouler jusqu'en bas, puis comparer le `bottom` de chaque texte au
`top` de `.atlas-nav-basse`. Mesuré ainsi sur l'écran Équipe : **rien n'était
recouvert**.

**Le vrai recouvrement existe pourtant** — `.atlas-contenu` et les `pb-*` sont là
pour ça, et `IdentiteClient` porte `pb-40` pour une raison. Ne pas conclure du
faux au vrai : **mesurer, chaque fois.**

## ⚠ LANCER UNE SUITE NAVIGATEUR À LA MAIN : DEUX PIÈGES QUI FONT ACCUSER LE CODE

Posé le 25 août 2026, après une heure perdue à croire `main` cassé.

**1. `ATLAS_URL_PUBLIQUE` n'est PAS optionnelle.** `run-e2e-tests.ts` la pose
lui-même (`https://atlas-suites.test`) sur le serveur qu'il démarre. Lancée
contre un `npm run dev` ordinaire, une suite d'envoi voit une adresse LOCALE :
Atlas refuse alors d'ouvrir la messagerie — à juste titre, le lien ne mènerait
nulle part (`ARCHITECTURE.md` §169) — et renvoie vers l'écran du devis parti au
lieu de l'accueil. `test-envoi-client-e2e` rendait **5 sur 11**, et le produit
n'y était pour rien. Sur le banc du patron, dont l'adresse est publique, tout
fonctionne.

```bash
ATLAS_URL_PUBLIQUE=https://atlas-suites.test npm run dev   # pour jouer une suite à la main
```

**2. Le PREMIER passage sur un écran compile.** Un serveur qui vient de démarrer
peut dépasser le délai d'une suite sur la seule compilation de la route. La même
suite, rejouée sur le serveur chaud, passe. **Avant d'accuser son propre lot :
rejouer.** J'ai bien failli défaire un changement juste pour cette raison.

## Ce qui vient d'être terminé

**LE JOUR SE COMPTE CHEZ LUI, PLUS À GREENWICH (25 août).** `jourIso` rendait le
jour UTC : entre minuit et 2 h du matin, l'été, Atlas croyait qu'on était encore
la veille. Il l'a trouvé en demandant quand son chantier passerait dans
Terminés. **Une seule fonction porte la définition du jour** — c'est ce qui a
permis de tout corriger d'un coup, et ce qu'il faut préserver : ne jamais
recopier un `toISOString().slice(0, 10)` quelque part. `ARCHITECTURE.md` §182.


**L'EN-TÊTE DU DEVIS, DEUX LOTS DE SUITE (25 août).**

1. **Son logo sur l'écran du devis.** Il l'avait posé dans « Devis & factures »
   et ne le voyait pas là où il rédige. Le PDF le portait déjà ; c'est l'écran
   qui compose son en-tête à la main, sans passer par la fabrique de documents.
   `ARCHITECTURE.md` §173.
2. **L'émetteur n'apparaît plus deux fois, et une ligne par information.**
   *« Pourquoi il y a deux fois l'émetteur sur l'aperçu ? »* — le bloc
   « ÉMETTEUR » du bas est retiré, l'en-tête prend tout (nom, adresse,
   téléphone, e-mail, SIRET, **une ligne chacun**), le client passe à gauche.
   `ARCHITECTURE.md` §174.

**Deux écritures du même en-tête, et c'est le piège du coin** — `document-commun.ts`
(devis *et* facture) et `DevisCompletClient.tsx`. Le premier lot l'a découvert,
le second l'a payé le lendemain. Si un troisième élément arrive un jour (une
mention, un cachet), **penser aux DEUX** — et regarder l'image, pas seulement le
vert des suites : c'est une capture qui dit si une ligne de plus vient toucher
les références du devis (`scripts/capture-allure-devis.mts`).


**LE PENSE-BÊTE DE LA FEUILLE DE CHANTIER (23 août).** *« Entre "Copier
l'adresse" et "Ouvrir le PDF", un petit encadré où marquer quelque chose. »*
Proposition A retenue : cadre ouvert en permanence. Colonne `chantiers.note`,
migration 0061, règle pure dans `src/lib/note-chantier.ts`.

**⚠ IL A ÉTÉ CODÉ DEUX FOIS LE MÊME JOUR, par deux sessions qui ne se voyaient
pas.** Celle arrivée la première sur `main` fait foi ; la seconde a été retirée
en entier — deux colonnes pour la même note auraient été les deux vérités que
`CLAUDE.md` §3 interdit. **Ne pas ressusciter `note_feuille` ni la migration
0060 du même nom** en la retrouvant dans l'historique : elle a été abandonnée
délibérément, pas oubliée.

*La leçon, et elle vaut pour la suite : il fait tourner trois ou quatre sessions
en parallèle, et aucune ne lit les autres. Devant une demande qui vient de lui,
`git fetch origin main` AVANT de coder coûte dix secondes et peut épargner un
lot entier.*

**Trois choses à ne pas défaire :**

1. **Elle ne part sur AUCUN document** — sa décision. Ni devis, ni facture, ni
   PDF sans les prix. C'est cette promesse qui l'autorise à y écrire ce qu'il ne
   dirait pas devant le client, et `scripts/test-note-hors-documents-e2e.ts` la
   tient.
2. **Enregistré en sortant du cadre**, jamais par un bouton.
3. **Le champ à 16 px** : en dessous, iOS zoome et l'écran saute sous son doigt.
   Contrainte du système, pas choix de charte.

**⚠ ET LE LECTEUR DE PDF DE CETTE SUITE, deux fois faux avant d'être juste :** le
texte d'un PDF est comprimé, puis écrit en hexadécimal. Chercher des mots en
clair y trouve toujours zéro — donc toujours vert, y compris confronté à une note
délibérément versée dans le document. Le contrôle prouve désormais d'abord qu'il
sait LIRE ce PDF, en y retrouvant une ligne du devis. **Ne pas retirer cette
vérification préalable** en croyant simplifier (`ARCHITECTURE.md` §154).

**⚠ ET LE LECTEUR DE PDF DE LA SUITE, deux fois faux avant d'être juste :** le
texte d'un PDF est comprimé, puis écrit en hexadécimal. Chercher des mots en
clair y trouve toujours zéro — donc toujours vert. Le contrôle prouve maintenant
d'abord qu'il sait lire ce PDF, en y retrouvant une ligne du devis. **Ne pas
retirer cette vérification préalable** en croyant simplifier.


**LA TVA SE LIT EN TÊTE, LES GESTES TOUCHENT LEUR CHIFFRE (23 août).** Ses deux
remarques : *« l'outil Ma TVA à déclarer, il est caché »* et *« on ne comprend
pas trop que scanner ou écrire à la main, c'est pour la TVA déductible »*. Deux
planches essayables, deux choix — **« Pour ma TVA la B / Et pour les achats la
C »** (`ARCHITECTURE.md` §149).

**Trois choses à ne pas défaire :**

1. **Le montant se lit dans `src/server/tva-courante.ts`**, jamais recomposé dans
   l'écran : deux additions de la même somme lui montreraient deux chiffres à
   deux écrans d'intervalle, sans savoir lequel croire.
2. **La carte nomme sa période, et dit « Reste à payer »** — jamais « À payer ».
   Ce montant n'est pas dû le jour où il le lit.
3. **La couture entre l'encadré des chiffres et les deux gestes** est tout ce
   qui dit le lien : aucun mot ne le dit. L'arrondi bas appartient au bloc des
   gestes, plus à l'encadré.

**⚠ ET LE PIÈGE, QUI A ÉTÉ PAYÉ DEUX FOIS ICI :** ces deux choix sont des choix
de **place**, et une place ne casse pas. `scripts/test-tva-en-tete-e2e.ts` mesure
donc des places. Deux de ses mesures étaient fausses avant d'être justes — l'une
comparait la carte à sa **propre mention** (qui descend avec elle) et restait
**verte sur le défaut dont elle portait le nom** ; l'autre comptait le
rembourrage d'une carte comme une brèche et **accusait à tort**. Les repères
`data-atlas="contenu-termines"` et `data-atlas="encadre-tva"` existent pour ça :
ne pas les retirer en croyant nettoyer.


**« IL PEUT PROPOSER UNE AUTRE DATE » (17 août, au soir).** Un interrupteur sous
les dates, avant le bouton d'envoi : le patron décide, envoi par envoi, si le
client peut sortir des dates offertes. `ARCHITECTURE.md` §132, migration 0055.

**Trois choses à ne pas défaire :**

1. **Le choix est FIGÉ dans l'envoi**, pas lu dans un réglage — l'écran du
   client doit dire demain ce qu'il disait aujourd'hui.
2. **Vrai par défaut**, à la colonne comme à l'écran : les liens déjà partis
   gardent leur promesse.
3. **Le refus vit dans `enregistrerReponse`**, pas seulement à l'écran. La page
   du client est publique et son formulaire se rejoue ; cacher le calendrier ne
   ferme rien.


**⚠ « ENCORE LA VERSION LENTE » : LE VEILLEUR RETENTE MAINTENANT (18 août).**
Une construction ratée laisse le banc en mode développement — et ce mode
**répond** à la santé. Le veilleur, qui ne relançait que sur un port muet, se
déclarait donc content pour la soirée entière. Il lit désormais le témoin
d'échec : trois tentatives espacées de dix minutes, jamais deux constructions à
la fois (`ARCHITECTURE.md` §131).

**LA MÉTHODE, ET ELLE A TRANCHÉ EN DIX SECONDES :** lire la fiche d'état
(issue #47) AVANT toute hypothèse. Elle portait le message exact de l'échec et
le commit réellement servi — sans elle, on aurait cherché du côté du réseau.

**LA RUBRIQUE « PLANNING » DES RÉGLAGES N'EXISTE PLUS (16 août).** Sa question :
*« quelle est la différence entre planning et équipe ? »* — il n'y en avait
aucune, les deux rendaient le même composant. Tout est dans **« Équipe »** :
combien partent en même temps, leurs noms, leurs absences. **Ne pas la recréer**
le jour où les horaires viendront (`ARCHITECTURE.md` §129, `docs/QUESTIONS.md`
§21).

**LES RETOURS DES RÉGLAGES (17 août).** Les réglages ont **deux étages**, et un
écran du second doit ramener à **sa rubrique**, pas à la racine — sa remarque :
*« lorsque je vais dans mes prix et que je fais un retour, je retourne
directement dans l'application et pas dans la catégorie tarif »*. Trois écrans
étaient fautifs (Mes prix, Le catalogue — qui n'avait **aucune** flèche —, Le
vocabulaire).

**Avant d'ajouter un écran sous une rubrique :** l'inscrire dans la table de
`scripts/test-retours-reglages-e2e.ts`. Aucun test ne voyait ce défaut parce
qu'aucun ne PARCOURAIT le chemin — chaque écran s'ouvrait par son adresse, où la
question ne se pose pas.

*(Le catalogue a été refait en parallèle par une autre session — voir plus bas —
et porte sa propre flèche : c'est cette version-là qui a été gardée.)*
**LA LISTE DES CLIENTS (17 août, au soir) — sa remarque : « la catégorie client
n'a pas été créée ».** Elle s'ouvre depuis l'accueil (« Vos clients », sous le
compteur), pas depuis un cinquième onglet : celui-ci est réservé aux outils
métier (`ARCHITECTURE.md` §125), et la barre déborde déjà à cinq colonnes.

**Deux choses à ne pas défaire :**

1. **La liste et la fiche partagent `composerFicheClient`.** Un second calcul du
   reste dû se contredirait d'un écran à l'autre, et c'est lui qui le verrait.
2. **Quatre requêtes, pas cinq par client.** Charger la fiche complète de chaque
   client à tour de rôle rendrait la liste plus lente à mesure qu'il en a — et
   c'est un écran d'accueil.

**« ADRESSE NON RENSEIGNÉE » OUVRE L'ÉCRAN DU CHANTIER (17 août).** La mention de
l'accueil est un lien vers `/chantiers/[id]/coordonnees` — l'écran de création
rouvert, prérempli, qui enregistre au lieu de créer. `ARCHITECTURE.md` §124.

**Trois choses à savoir avant d'y toucher :**

1. **UNE LIGNE DE L'ACCUEIL = UN SEUL `<a>`, et cet invariant a été découvert
   en le cassant.** La mention seule est la cible ; le nom du chantier garde sa
   reprise du 13 août. Un lien dans un lien n'étant pas valide, la première
   version avait coupé le lien de la ligne en trois — **et trois suites sont
   tombées d'un coup** : `test-dashboard` compte `a.atlas-brin`,
   `test-suivi-devis` remonte à `ancestor::a[1]`, `test-transcription` clique au
   milieu de `.atlas-ligne`. La mention est donc un `<span role="link">` posé
   DANS l'ancre, qui détourne le geste. **Ne pas la « rétablir » en vrai lien.**
2. **Le nom du chantier se RECALCULE à l'enregistrement**, avec la date de
   CRÉATION du chantier et non celle du jour. Sans ce recalcul, la ligne
   afficherait « Chantier du … » pour toujours — le défaut corrigé partout sauf
   là où il l'a vu. Avec la date du jour, le chantier se renommerait et il ne le
   reconnaîtrait plus.
3. **Deux mots seulement changent** entre créer et reprendre : le surtitre et le
   bouton. Ils changent parce qu'ils mentiraient, pas par décoration.

**LA LEÇON DE MÉTHODE, ET ELLE A COÛTÉ DEUX ALLERS-RETOURS.** Une première
planche avait dessiné une « fiche client » de toutes pièces ; il a répondu
*« rien de plus, rien de moins »* en renvoyant la capture de l'écran qui
existait. **Devant une demande qui touche à un écran, chercher d'abord si
l'écran existe.** Ce qui avait égaré : le code annonce lui-même qu'il manque une
fiche client — c'est vrai, et ce n'était pas sa demande.

**LE CATALOGUE EST ÉCRIVABLE (17 août) — CODÉ, arrangement B.** Il a posé deux
fois la même question (14 puis 17 août) : *« À quoi sert cette page ?? On peut
rien modifier rajouter »*. Ses mots s'accrochent désormais aux entrées d'Atlas,
en or. Planche `docs/maquettes/72-mes-mots-au-catalogue.html`, récit complet
dans `ARCHITECTURE.md` §123, migration 0052.

**Quatre choses à savoir avant d'y toucher :**

1. **Le catalogue reste PARTAGÉ et intouchable** (migration 0007, aucune RLS).
   Ses mots vivent dans `mots_catalogue`, isolée par RLS, et se superposent au
   commun à la lecture. Rien ne retire jamais un mot d'Atlas : ce serait le
   retirer chez tous les autres artisans.
2. **Un mot visible DOIT être un mot reconnu.** Les quatre chemins de recherche
   passent par `rechercherCartes` — les deux outils de l'agent, celui des
   synonymes, le service de chiffrage. En débrancher un rendrait des mots
   affichés et muets : il croirait avoir appris quelque chose à Atlas, et rien
   ne le détromperait. La suite base rougit exactement là.
3. **Le rapprochement se fait par INCLUSION**, comme pour le commun : « écime »
   attrape « écime-moi le tilleul », « écimage » ne l'attrape pas. Le champ de
   saisie le dit. Ne pas inventer une seconde règle pour ses mots — deux règles
   divergent toujours.
4. **Ne pas remettre de prix sur cet écran sans trancher le rapprochement.**
   `lecons_prix` range par nature de chantier, pas par mot de catalogue : un
   prix d'abattage sous « Élagage » serait pire que la phrase retirée.

**L'AUTO-ALIMENTATION EXISTE DEPUIS LE MÊME JOUR** (`ARCHITECTURE.md` §123,
« Ce qu'Atlas PROPOSE de retenir », migration 0053) : Atlas **propose** de retenir un mot entendu quand il sait à
quoi il se rapporte — la ligne retenue sur le devis doit être reconnue par le
catalogue, faute de quoi rien n'est proposé. Deux choses à ne pas défaire :

- **le « non » est définitif** (colonne `refuse`) : une proposition qui revient
  après un refus n'est plus une proposition ;
- **mais un mot écarté puis écrit à la main se relève** (`ajouterMot`). Sans ce
  relèvement, l'index unique le refuse en SILENCE : il tape le mot, rien
  n'apparaît, et rien ne dit que c'est son propre « non » qui le bloque.

**Le vocabulaire d'Atlas, lui, ne s'alimente jamais tout seul** — il est commun
à toutes les entreprises.

**LA FICHE DU CLIENT (16 août).** Elle s'ouvre depuis le tiroir d'un chantier et
montre ce que l'application savait déjà : combien de chantiers, combien facturé,
combien reste dû, et ce qu'on lui fait d'habitude.

**UN CLIENT EST DÉSORMAIS RETROUVÉ, PLUS RECRÉÉ (17 août).** La fiche était
vide par construction — `creerClient` insérait toujours, et deux chantiers pour
« M. Martins » faisaient deux fiches. Il l'a tranché le lendemain, en écartant
qu'on lui **propose** des correspondances : le rapprochement est **automatique**
(`trouverOuCreerClient`, règle dans `src/lib/rapprochement-client.ts`).

**Ce qu'il faut savoir avant d'y toucher :** une coordonnée qui **contredit**
interdit le rapprochement — deux « Martins » aux téléphones différents restent
deux fiches. Rien n'est jamais écrasé : la saisie complète les cases vides, pas
les autres. Un client effacé (RGPD) n'est jamais réutilisé. Et **une fiche est
maintenant partagée** : corriger l'adresse du client depuis un devis la corrige
sur les autres chantiers du même client. `ARCHITECTURE.md` §122.

Trois pièges de ce lot : « 0 € » ne doit jamais s'afficher pour un client non
facturé (« — » et une phrase) ; les prestations se comptent en chantiers et non
en lignes ; et un contrôle qui cherche « 0,00 € » dans une page le trouve dans
« 450,00 € ». `ARCHITECTURE.md` §121.

**LE PRIX ACCORDÉ NE VIT PAS SUR UNE LIGNE (17 août).** Il vit sur l'EN-TÊTE du
devis (`reduction_pourcent`), et c'est le prix de l'arrangement B qu'il a choisi
le 16. Conséquence pratique : **tout ce qui recopie « les lignes » et rien
d'autre l'oublie en silence.** C'est ce qui a produit ses deux défauts du
17 août — la dictée qui retirait la remise puis la voyait revenir, et le « 0 % »
qui laissait une ligne or sur un devis dont le PDF n'imprimait rien. Avant de
toucher à quoi que ce soit qui relise le devis après une écriture, se demander
si l'en-tête repart avec.

**⚠ UN CONTRÔLE QUI RECHARGE N'ÉPROUVE PAS L'ÉCRAN, IL ÉPROUVE LA BASE (17 août).**
`test-reduction-devis-e2e` était vert sur un retrait de remise… en rechargeant la
page juste avant de vérifier. Le défaut vivait précisément dans l'état de
l'écran. Le nouveau cas mesure **sans rechargement**, et il est rouge sans le
correctif.

**ET IL FAUT ÉPROUVER SON GESTE, PAS LE NÔTRE.** La suite vidait la case ; lui
écrit « 0 » par-dessus — viser un champ de 36 px sur un téléphone, sélectionner
un chiffre et le supprimer n'est pas ce qu'on fait. Les deux chemins mènent à
« aucune réduction », un seul était éprouvé.

**LE « PETIT MOINS » EST CODÉ (17 août) — sa proposition B.** Un rond de 26 px
devant le libellé du prix accordé. **Il partage le tiroir des lignes**, sous la
clé réservée `prix-accorde-au-client` : ne pas lui fabriquer un second tiroir,
c'est ce que le patron a fait disparaître le 10 août. Et **le total montre le
prix plein dès l'appui**, alors que rien n'est encore écrit — un geste sans effet
visible pendant six secondes se lit comme une panne.

**⚠ UNE COULEUR POSÉE SUR `<html>` NE PEUT PAS SUIVRE UNE NAVIGATION (16 août).**
Il choisit « Nuit », rien ne change — et c'était exact. Les variables de charte
sont posées par le gabarit RACINE ; une navigation côté client ne le rejoue pas,
donc l'attribut `style` de `<html>` reste celui du chargement initial. **Ni
`revalidatePath` ni `router.refresh()` ne règlent cela** : c'est le navigateur qui
doit repeindre le même élément. Réparé et éprouvé sur SA séquence — appui, onglet,
onglet, sans rechargement (`ARCHITECTURE.md` §119).

**ET LA LEÇON, LA MÊME QUE LE 12 AOÛT :** le contrôle existant était **vert** — il
rechargeait la page entre chaque écran. Le seul chemin où le défaut existe, les
onglets du bas, n'était parcouru nulle part. **Rejouer sa séquence, pas le geste
isolé.**


**LE RAPPEL « FACTURE IMPAYÉE » (16 août) — le quatrième, et le premier qui a un
RYTHME.** Il paraît à l'échéance (envoi **+ le délai de paiement** réglé dans
« Devis & factures », ou le jour de l'envoi si aucun délai ne l'est — son
« A plus B »), montre le **reste dû**, et s'éteint tout seul dès que le règlement
est noté dans « Terminés › TVA ». `ARCHITECTURE.md` §115.

**Trois choses à savoir avant d'y toucher :**

1. **La date de report vit sur le CHANTIER**
   (`chantiers.rappel_facture_repousse_le`), pas sur la facture.
   `trg_facture_immuable` refuse TOUTE écriture sur une facture émise, y compris
   une date d'affichage — l'affaiblir serait le contournement que `CLAUDE.md` §4
   interdit. La relation est de un à un, rien ne se perd.
2. **« Plus tard » est le SEUL moteur du rythme.** Sans geste, la carte reste,
   tous les jours. C'est voulu : une carte qui s'endormirait seule pourrait
   passer un jour où il n'ouvre pas l'application. Et « Plus tard » ne classe
   rien — la facture reste en attente de paiement, ce n'est pas « J'ai vu ».
3. **Les trois rythmes sont une CONTRAINTE, pas un menu.** Une case de saisie
   rouvrirait le « tous les jours » qu'il a explicitement exclu.

**Et le piège de méthode que ce lot a payé, qui vaut pour n'importe quel écran :
la valeur d'un `<input>` ne figure pas dans `innerText`.** Un contrôle qui
cherchait « 1 jours » dans le texte de la page ne pouvait jamais le trouver — il
était vert sur l'écran fautif. C'est la cinquième fois que ce dépôt paie un
contrôle qui mesure zéro. **La capture aussi peut mentir** : `fullPage` a
photographié le milieu du cadre qui défile (`.atlas-fil-defile`), sans une seule
carte, et un montage a écrit `WHERE id = NULL` sans se plaindre — d'où une image
annonçant « 60 jours » au lieu de 30, faute qui était celle du montage et non de
l'application.

**⚠ CHAQUE ARROSEUR PORTE DEUX SBE, PAS UN (17 août) — le bas (toujours 3/4",
sur la ligne) et le haut (au diamètre du corps). Compté depuis ce lot.**

**⚠ LE TRACÉ DU RÉSEAU LATÉRAL EST TRANCHÉ ET CALCULÉ (17 août, planche 73,
répondue par un croquis plutôt qu'en mots).** Plusieurs lignes parallèles
depuis le regard — **avec une règle physique à ne pas oublier** : une
jonction (té 25×25×25) là où le tronc CONTINUE vers une autre rangée (on doit
couper le tuyau), mais RIEN à la toute dernière rangée — le tronc s'y arrête
en se courbant, sans pièce à couper. `listeMateriel()` calcule maintenant
`nombre − ny` tés de ligne, `ny` coudes de fin, `ny − 1` jonctions (jamais
`ny`) à partir de `poser()`. **Ne jamais compter `ny` jonctions** : c'est
l'erreur qu'un lecteur pressé ferait, et c'est exactement celle que sa
correction du 17 août visait.

**LA RÈGLE GÉNÉRALE DERRIÈRE, donnée en croquis le 17 août : compter les
PORTIONS DE TUYAU qui se rejoignent en un point.** Deux portions → coude (le
tuyau se courbe, aucune pièce). Trois portions → té/jonction (on doit couper
le tuyau pour insérer la pièce). C'est le même principe qui classe Départ et
Milieu (3 portions : ça entre, ça continue, ça monte vers l'arroseur) en té,
Fin (2 portions : ça entre, ça monte) en coude, et la jonction du tronc (3
tant qu'une rangée suit, 2 à la dernière) — **à réutiliser tel quel pour
tout futur point de raccordement**, plutôt que de retrouver un cas par cas.

**ET LE NOMBRE QUI EN DÉCOULE, ÉPROUVÉ PAR LUI SUR UN TRACÉ LIBRE (planche
74) : `N` arroseurs sur un réseau ⇒ `N − 1` TÉS, toujours.** Un réseau part
d'une seule ligne et finit sur `N` bouts ; chaque té ajoute un bout. **Ni la
forme du terrain ni l'ordre de raccordement ne changent ce compte.** Il l'a
vérifié en envoyant un croquis délibérément irrégulier (six arroseurs
dispersés, courbes, branches inégales) et en demandant de placer les tés —
c'était un contrôle du raisonnement, pas une demande de dessin. **La formule
de `listeMateriel()` passe ce contrôle sans être modifiée** : sur une grille,
`(nombre − ny)` tés + `(ny − 1)` jonctions **= `nombre − 1`**. Devant tout
doute futur sur un comptage de tuyauterie, c'est le repère qui tranche en une
soustraction.

**⚠ LES FICHES DE NOURRICE EXISTENT MAINTENANT (1 à 6 voies, 17 août) et
REMPLACENT les lignes génériques (électrovanne/regard/programmateur) dès
qu'elles s'appliquent — dans la liste ET dans le registre de prix.
`CATALOGUE.piecesNourrice` porte chaque pièce une seule fois ; **ne jamais
retaper un nom de pièce dans une fiche**, toujours référencer par `ref`.

**⚠ UNE VOIE GOUTTE-À-GOUTTE MODIFIE SA NOURRICE, LES AUTRES VOIES NON
(17 août).** Sa règle : électrovanne MM standard → FF, plus régulateur FF
3/4", plus deux mamelons réduits MM 1"-3/4" et un mamelon fileté MM 1" — par
voie concernée seulement. `CATALOGUE.ficheNourrice(n, combienGoutte)` fait
cette bascule au-dessus de la fiche de base, jamais `CATALOGUE.nourrices[n]`
directement — **les trois endroits qui lisaient la fiche brute
(`dessinerNourrice`, `listeMateriel`, `texteDeLaListe`) passent maintenant
tous par cette fonction**, sans quoi l'un des trois afficherait la fiche
non modifiée. Elle fusionne aussi les lignes de même référence en sortie :
sans cette fusion, le mamelon réduit de la bascule s'affichait à côté de
celui de la fiche de base au lieu de s'additionner avec lui — deux lignes
« 2 u » plutôt qu'une « 4 u ».

**⚠ LE QUINCONCE RETIRE UN ARROSEUR, IL NE LE DÉPLACE PAS (17 août — trouvé
par lui, capture cerclée).** Une rangée décalée porte UNE tête de moins que la
rangée alignée. Le plan et le calcul partagent une seule fonction
(`pointsDeLaPose`) — **ne jamais réintroduire un second calcul de position**,
c'est exactement ce qui a produit le défaut.

**⚠ MESURER UNE COLONNE DE GRILLE : DEUX FAÇONS DE SE TROMPER, payées le
17 août.** (1) Diviser la largeur de la rangée par le nombre de colonnes compte
les marges intérieures comme de la place — 72 px annoncés pour 66,4 réels.
(2) Mesurer la boîte de la CELLULE ne marche pas non plus : une cellule `1fr`
**s'élargit quand son contenu déborde**, donc « déborde » ne se voit jamais.
**La mesure juste est la PART** : contenu de la rangée moins ses marges, divisé
par le nombre de colonnes. Et la leçon générale : **deux mesures qui devraient
tomber pareil valent mieux qu'une seule** — ici le trait d'or et la colonne,
identiques par construction, et c'est leur écart qui a révélé l'erreur.

**⚠ LA BARRE DU BAS PORTE CINQ ONGLETS DEPUIS LE 17 AOÛT, ET ELLE EST JUSTE
À LA LIMITE.** « Paysage » s'ajoute à Chantiers/Planning/Terminés/Réglages, et
la lettre est passée à 8,5 px / 0,14em pour que « CHANTIERS » rentre encore sur
un écran de 360 (sa variante C : 59,8 px pour 66,4 de part, soit 6,2 px de
marge — sans ce changement il débordait de 12,4 px).
**Trois pièges si l'on y retouche :** la largeur du trait d'or est écrite en
dur (`/ 5`) et doit suivre tout ajout d'onglet ; remonter la lettre à 9,5 px
fait déborder à nouveau ; et un sixième onglet ne rentre pas.
`scripts/test-barre-basse-e2e.ts` mesure tout cela à 360 px et exige 6 px de
marge — **ce défaut est invisible en développant sur un grand écran.**

**⚠ NE JAMAIS ÉCRIRE `charger() || {défauts}` — le piège a frappé le 17 août.**
Dès qu'une sauvegarde existe, l'objet de défauts est entièrement sauté : tout
champ ajouté au produit APRÈS sa première visite lui arrive `undefined`, à lui
seul, et sans un mot. On part toujours de `DEFAUTS` et on pose la sauvegarde
par-dessus champ par champ (`arrosage.html`). **Le même piège guette partout
où un état persistant s'étoffe** — et il est invisible en développant, puisque
le navigateur y part vide.

**⚠ L'OUTIL N'A PLUS QUE TROIS SECTIONS (17 août) : point d'eau, CROQUIS,
liste. Le découpage PUIS le plan ont été retirés, sur sa demande** (*« à quoi
sert le 3 ? »* → « enlevez-le »). Le plan de zones dessinait des rectangles
abstraits, utiles au développeur, pas à lui — le sien est celui de la planche
75. **La pose, le découpage et l'affectation aux vannes tournent toujours**,
invisibles, et décident des électrovannes, de la nourrice et des tés. Sa consigne : *« tu supprimes la 3, et la 2 ça doit être la
photo du croquis ».* **Le découpage en secteurs ne s'AFFICHE plus, mais il se
CALCULE toujours** — il donne les couleurs du plan, le nombre d'électrovannes
et la fiche de nourrice. Sont partis avec l'écran : les durées, le cycle total,
et le sélecteur de saison (`etat.saison` reste, à « juillet »). Les contrôles
correspondants lisent maintenant `decouper()` — **ne pas les réécrire sur des
sélecteurs DOM qui n'existent plus.**

**⚠ LA PHOTO DU CROQUIS EST REDIMENSIONNÉE AVANT D'ÊTRE GARDÉE, et c'est
vital :** une photo de téléphone (3 à 8 Mo) ferait sauter `localStorage`
(~5 Mo pour tout le jardin) — et c'est le JARDIN ENTIER qui disparaîtrait au
rechargement, pas seulement l'image. 1400 px, JPEG 0,75. En cas d'échec malgré
tout, on remet l'état d'avant et on le dit. **Et l'écran annonce qu'il ne lit
pas encore les cotes** : page statique, pas de serveur, la lecture demande
`src/server/ai/`.

**⚠ UNE PLANCHE NE RECOPIE JAMAIS UN CALCUL QUE L'OUTIL SAIT FAIRE.** Payé le
17 août : la planche 75 portait une liste de fournitures tapée à la main, avec
un « regard 3 voies » composé de pièces piochées dans plusieurs de ses fiches.
Il l'a lue et a tout de suite vu le mélange. **Le code refusait déjà cette
composition** (§4) — c'est la planche qui l'a faite. Une planche montre ce qui
n'existe pas encore ; tout ce qui tourne déjà se lit dans l'outil.

**⚠ LES TUYÈRES SONT POUR LES PETITS ESPACES : 4 m DE PETIT CÔTÉ, GRAND MAX
(17 août).** Sa règle — « un carré de douze par dix, c'est que des arroseurs ;
les tuyères, c'est un carré de trois par trois, ou un couloir de dix sur
deux ». Le seuil de l'outil était à 8 m : **il était faux du simple au
double**, et faisait partir des pelouses entières en tuyères, donc en
pluviométrie triple. C'est le PETIT CÔTÉ qui décide, et lui seul.
`TUYERE_JUSQUA` dans `arrosage.html`. **Le repli vers les tuyères au-delà de
4 m est interdit** : si aucune turbine ne pave, l'écran le dit plutôt que de
rendre un plan posable et faux.

**⚠ UN SECTEUR, UNE PLUVIOMÉTRIE — et le TYPE ne suffit pas à le garantir.**
La clé de groupe de `decouper()` porte le type, la famille **et la
pluviométrie**. Sans elle, deux turbines de buses différentes (5,9 et
6,1 mm/h) se retrouvaient sur la même vanne, ouverte pour une seule durée.
Le défaut est resté invisible tant que les deux pelouses d'exemple étaient de
familles différentes ; **c'est le coloriage par réseau qui l'a montré**, en
leur donnant la même couleur. Ne pas retirer la pluviométrie de cette clé.

**⚠ Ø25 PAR DÉFAUT DU COMPTEUR AU REGARD, Ø32 SEULEMENT SI LE CALCUL LE
DÉMONTRE (17 août).** Hazen-Williams sur le débit du PLUS GROS SECTEUR — les
vannes s'ouvrent l'une après l'autre, prendre la somme surdimensionnerait
chaque chantier. **Le calcul ne couvre QUE l'amenée** : ni antennes, ni
raccords, ni électrovanne — un « le Ø25 suffit » est un plancher, pas une
garantie, et l'écran le dit. **Les diamètres INTÉRIEURS sont `provisoire`** :
ils dépendent de la pression nominale (PN6/PN10/PN16), non précisée, et se
tromper de gamme fausse le verdict dans le sens dangereux.

**⚠ UN CONTRÔLE DOIT GARDER UNE RÈGLE, PAS UN JARDIN.** Trois cas ont rougi le
17 août sans qu'aucun défaut existe, simplement parce que ses règles avaient
changé le jardin d'exemple : une portée de 3,6 écrite en dur, une référence de
buse nommée, une boucle de cinq clics pour vider six zones. Ils lisent
désormais la portée réelle de chaque zone, **demandent au plan quelle
référence il commande**, et retirent jusqu'à ce qu'il n'en reste plus. Devant
un cas qui rougit après un changement de règle métier, se demander d'abord
s'il gardait un nombre plutôt qu'un invariant.

**⚠ LE PARCOURS COMPLET DU PRODUIT EST ÉCRIT — il l'a dicté le 17 août, et il
est dans `TODO.md` § « 0 quaterquadragies AA », en dix étapes avec leur état.**
À lire avant de décider quoi coder ensuite : sept des dix sont faites, et les
confondre ferait refaire ce qui existe. **Deux blocages de structure y sont
nommés, à ne pas contourner par une invention :** la page publiée est statique,
donc elle ne peut pas LIRE une photo (l'IA vit dans `src/server/ai/`) ; et il
n'existe pas de plan d'ensemble du jardin, donc **le regard n'a nulle part où
se poser** — chaque zone est dessinée seule, l'outil ignore où la pelouse est
par rapport au massif. Le placer « quelque part » serait inventer un jardin.

**⚠ `decouper()` DIT MAINTENANT QUEL ARROSEUR EST SUR QUELLE VANNE
(`reseauDuPoint`), et le plan colorie d'après CETTE liste.** Ne jamais
recalculer l'affectation dans le rendu — c'est la divergence qui avait produit
l'arroseur en trop du quinconce. Trois règles tiennent ce découpage, chacune
gardée par un contrôle vu rouge : la coupe suit **l'ordre de pose** et reste
**d'un seul tenant** (une vanne dessert une bande, jamais un arroseur sur
deux) ; elle se fait **au point près et non à la rangée** (une rangée peut
dépasser la limite à elle seule) ; et le **débit annoncé d'un secteur est
celui de ses arroseurs réels**, jamais le total divisé en parts égales.

**⚠ LE DÉBIT D'UNE TURBINE NE DÉPEND PAS DE L'ARC — sa règle du 17 août, et
c'est elle qui a débloqué les six familles.** *« Les débits, portées qui sont
dans le tableau sont donnés pour les arroseurs en 360 degrés ; c'est les mêmes
données que pour 90 ou 180 degrés. »* Le chiffre unique du tableau vaut donc à
tous les arcs, et un passage d'`arrosage-catalogue.js` le recopie sur le 90° et
le 180° — **des turbines SEULEMENT**. Les tuyères gardent leurs valeurs par
angle, qui diffèrent vraiment (6-VAN : 0,27 à 90°, 0,32 à 360°). **Ne jamais
diviser par l'arc, et ne jamais étendre l'uniformisation aux tuyères** : deux
contrôles opposés gardent ce couple, et chacun a été vu rouge sur son défaut.

**⚠ UNE TURBINE NE PREND PAS UN CORPS DE TUYÈRE — défaut vu sur une CAPTURE,
par aucun des 39 contrôles d'alors.** Le jour où les turbines sont devenues
posables, la liste comptait encore 22 corps 1800 et 22 SBE 1/2" pour un jardin
dont 11 arroseurs étaient des turbines. `listeMateriel()` compte maintenant le
corps **par famille** et le SBE du haut **par diamètre de corps**. Et le corps
d'une turbine **ne se choisit pas** (la buse 0,75 du 3504 ne va que dans un
corps 3504) : `CATALOGUE.corpsDeLaBuse` les apparie par la référence
(`RA3504-B075` → `RA3504`). **Cette convention de référence est une dette** —
un contrôle exige que chaque buse de turbine posable trouve son corps, sinon
une transcription future ferait manquer un corps en silence. **Reste à faire :
le deuxième sélecteur de corps**, pour qu'il choisisse hauteur et options des
turbines comme il le fait des tuyères. Rien n'est faux en attendant.

**⚠ UNE BUSE SANS SES TROIS ANGLES (90°/180°/360°) N'EST JAMAIS CHOISIE SEULE
(17 août).** Les R-VAN Rain Bird se vendent en DEUX références par taille — une
réglable 45°-270° (jamais 360°), une fixe 360° (jamais autre chose). `busesDe()`
exige les trois angles sur une même référence avant de la rendre poseable ; les
deux restent visibles dans le registre de prix. **Ne pas relâcher cette
exigence à deux angles** : une version antérieure du filtre a laissé passer la
réglable seule, et le calcul de l'intérieur d'une pelouse (qui a besoin du
360°) a produit « Mesures à compléter » au lieu d'un plan.

**⚠ LES CORPS SONT ENTRÉS (Rain Bird 1800, Hunter Pro-Spray/I-Spray), MAIS
AUCUN N'EST CHOISI PAR DÉFAUT.** Quatre hauteurs, trois options — un choix de
chantier qu'il n'a pas encore tranché. Ne pas en supposer un « raisonnable » :
c'est exactement le genre de décision qu'il a réservée depuis le début.

**⚠ SA RÈGLE DE POSE (17 août), et l'outil faisait l'inverse.** « 80 % minimum
entre chaque arroseur. Portée 5 m : ~5,50 m, 6 m max, 5 m étant la perfection.
Jamais moins. 4 m, 3 m : JAMAIS. » Donc **écart ∈ [portée ; 1,2 × portée]** — le
recouvrement se mesure sur l'écart, pas sur la portée. **Ne pas resserrer sous
la portée par prudence** : c'est un arroseur de trop tous les quatre mètres, donc
un secteur de plus et un devis plus cher.

**⚠ ET LE CHOIX DE BUSE OBÉIT À CETTE RÈGLE.** Une turbine de 9 m ne pave pas une
pelouse de 12 m de large ; l'outil prend la plus grande buse qui pave les deux
côtés (`paveSelonSaRegle`). Ne pas revenir à « la plus grande qui rentre » suivie
d'une alerte : cette version-là criait sur toutes les zones, y compris les
bonnes, et une alerte qui parle à tort s'apprend à être ignorée.

**⚠ SES PRIX NE SONT JAMAIS DANS LE CATALOGUE (17 août).** Sa consigne : les
tarifs imprimés sont des prix CLIENT, ils ne s'enregistrent pas — pas même en
commentaire. Ses prix négociés se saisissent dans `appli/arrosage-tarifs.html`
et vivent dans son navigateur. **Une case vide reste vide** : le total du plan
annonce les lignes manquantes plutôt que de les combler. Les mélanger ferait
chiffrer un devis au prix public, et ça ne se verrait pas — le total reste
plausible.

**⚠ UN ARROSEUR = UN CORPS + UNE BUSE, et le débit se LIT par arc.** Sa page du
17 août (Aqua Plus 2026 p. 8, buses VAN) : le débit d'un quart de tour n'est pas
le quart du tour complet sur les petites buses. Ne pas « simplifier » en
divisant — un contrôle mesure 1,64 m³/h sur une zone qui retient la 6-VAN, et
1,62 trahirait la division. Les corps escamotables manquent encore.

**⚠ LE CATALOGUE D'ARROSAGE EST À LUI, PAS À NOUS (17 août).** Il a dit
« plusieurs choses sont fausses », et il envoie ses photos d'arroseurs et ses
nomenclatures. `appli/arrosage-catalogue.js` les reçoit ; **chaque entrée porte
une `source`** (`'patron'` ou `'provisoire'`), et l'écran compte ce qui reste
provisoire. **Ne jamais présenter une valeur provisoire comme acquise**, et ne
jamais composer une **nourrice** absente : `CATALOGUE.nourrices` est vide parce
qu'il en donnera les fiches. **Aucun plafond à six voies** (sa réponse du
17 août) — et **ne pas fabriquer une nourrice de douze en doublant celle de
six** : une seule grande ou deux petites, il ne l'a pas tranché. L'écran annonce la fiche
manquante — c'est voulu, ce n'est pas un trou à boucher. Détail complet dans
`TODO.md` § « 0 quaterquadragies ».

**⚠ LE RECOUVREMENT (80 %) EST UNE LECTURE À CONFIRMER.** Sa phrase : « il faut
un recouvrement d'au moins quatre-vingt pour cent ». Lu comme *écart = 80 % de
la portée*. Réglable à l'écran, et l'écart en mètres y est écrit pour qu'il
tranche d'un regard. Passer de 100 à 80 % fait passer le jardin d'exemple de 8 à
9 secteurs : ce réglage décide du nombre d'arroseurs, donc de la facture.

**⚠ DEUX PAGES ESSAYABLES, ET LE CALCUL EST DANS UN TROISIÈME FICHIER (18 août).**

- `appli/arrosage.html` — l'outil complet : le point d'eau, le croquis, la liste.
- `appli/arrosage-croquis.html` — sa demande du 18 août : **la photo et la
  marque, rien d'autre**, puis le plan en couleur et les pièces en casiers.
- `appli/arrosage-calcul.js` — **le calcul, partagé par les deux.** Ni l'une ni
  l'autre ne calcule quoi que ce soit : elles dessinent ce qu'il rend.

**Le piège de ce partage, payé le jour même.** `corpsCourant()` était resté dans
`arrosage.html` : toute page AUTRE que celle-là partait en `ReferenceError` dès
qu'un jardin posait une tuyère, et l'écran rendait *« la liste se remplit dès
qu'un jardin est lu »* — un vide qui ressemble à un état normal. Les 73 et les
105 suites étaient vertes ; aucune ne demandait la liste d'un jardin MIXTE.
**À toute extraction, relire le fichier de DÉPART, pas celui d'arrivée**
(`ARCHITECTURE.md` §126).

**Et la clé de sauvegarde sépare les deux pages.** Le module lit
`window.CLE_ETAT` ; la maquette pose `atlas-arrosage-croquis`. Sans cela,
l'essayer effacerait le jardin qu'il a saisi dans l'outil.

**⚠ LE PLAN D'ARROSAGE : LA PAGE ESSAYABLE EST `appli/arrosage.html` (17 août).**
Sa consigne, après les trois planches : *« je veux que tu code rien, d'abord des
maquettes dynamiques en .html que je puisse essayer, pas de photo »*.

- **Elle vit dans `appli/` et NON dans `docs/maquettes/`, et ce n'est pas un
  rangement.** Les planches y sont sans JavaScript parce que son lecteur n'en
  exécute pas ; or il demande à essayer. `appli/` est le seul dossier PUBLIÉ du
  dépôt (`pages.yml`) : c'est le seul endroit où la page s'ouvre dans un vrai
  navigateur, au téléphone, avec le calcul qui tourne. **Ne pas la « ranger »
  dans `docs/maquettes/` : elle y arriverait vide.**
- **AUCUN PRIX, et c'est SA décision du 17 août** : *« il faut simplement créer
  le plan et la liste du matos à acheter, ensuite moi j'envoie à mes
  fournisseurs, ils me font un devis, puis je repasse par le circuit normal de
  l'application »*. La sortie est une liste de QUANTITÉS. Un contrôle refuse
  tout montant en euros — ne pas le contourner par bonne volonté.
- **Elle est gardée par TROIS suites, toutes jouées avant publication** depuis
  le 18 août : `appli/tests/e2e.js` (105), `essai-arrosage-detaille.cjs` (73) et
  `essai-croquis.cjs` (25). Les deux dernières avaient leur adresse écrite en
  dur et ne barraient donc **aucune** mise en ligne — c'est ce qui a laissé
  passer le défaut de `corpsCourant`. Elles lisent `BASE_URL` maintenant.
- **Ce que l'essai apprend et qu'aucune planche ne disait** : sur « au mieux »,
  les deux pelouses passent en turbines et le jardin tombe de huit secteurs à
  quatre. Le jardin de départ garde les tuyères pour que la bascule se voie.
- **Les prix fournisseurs : ne pas tenter d'aller les chercher.** Chausson et
  Aqua Plus sont refusés par le mandataire réseau (vérifié), et leurs sites
  n'auraient que des prix publics. La voie est ailleurs, et elle existe déjà :
  Chausson laisse **télécharger le tarif négocié en Excel/CSV** depuis le compte
  client, et Atlas sait importer un tarif Excel/CSV.
- **Il a proposé de joindre ses devis fournisseurs** : ils serviront au
  catalogue de matériel (désignations, références), pas aux prix.

**LE PLAN D'ARROSAGE AUTOMATIQUE (17 août) — TROIS MAQUETTES, RIEN N'EST CODÉ.**
Sa demande : *« un outil pour les paysagistes pour réaliser des plans d'arrosage
automatique »*. Terrain neuf — rien dans le produit ne parlait d'arrosage.

- **Les planches** : `docs/maquettes/69-le-plan-darrosage.html` (par où il entre
  son jardin), `70-le-debit-ne-se-partage-pas.html` (le découpage en secteurs,
  **rien à y choisir**), `71-ce-qui-sort-du-plan.html` (devis, carte du coffret,
  plan client). **Sa décision est attendue sur deux points**, listés dans
  `TODO.md` § « 0 quaterquadragies ».
- **TOUS LES NOMBRES SONT CALCULÉS**, pas écrits : cinq mesures entrent
  (dimensions des zones, débit au seau), le reste en découle — arroseurs,
  débits, secteurs, durées, cycle, nomenclature. **Ne pas retoucher les planches
  à la main**, elles divergeraient : `scripts/engendrer-maquette-arrosage.mjs`.
- **Le calcul qui commande tout** : le robinet donne 1,80 m³/h, le jardin en
  demande 8,47 → huit secteurs, cycle de 3 h 14. **Deux règles passent avant le
  remplissage** — une seule pluviométrie par secteur (une vanne ouvre son
  secteur entier, pour la même durée) et un seul rythme par secteur. Les
  mélanger, c'est trois fois trop d'eau d'un côté, quoi qu'on règle ensuite.
- **Le défaut à ne pas recommettre, il a été commis ici** : le champ `materiel`
  (une chaîne) écrasé par l'objet du catalogue fondait les deux pelouses —
  turbines et tuyères — dans le même secteur. La planche s'affichait
  parfaitement. C'est un cas de contrôle depuis.
- **Deux défauts sortis d'une CAPTURE et d'aucun test** (les 6ᵉ et 7ᵉ de ce
  dépôt) : le matériel affiché en clé technique (« tuyere »), et la cote « 12 m »
  rognée en **« 2 m »** par le cadre du plan — texte entier dans la page, donc
  invisible à tout contrôle de DOM. Le contrôle compare maintenant les **boîtes**.
- **Ce qui n'est PAS ouvert, et qu'il faut dire** : pertes de charge et
  dimensionnement des tuyaux. Sans effet sur un pavillon en PE 32, déterminants
  sur une longue ligne.
- **L'arrosage rejoint la fiche d'entretien** (mise en route, hivernage) : deux
  lignes de modèle, pas un quatrième parcours.

**LA FICHE DE CHANTIER TOURNE (18 août) — le parcours entier est codé.** Il a
demandé le 16 août de recréer les fiches de chantier d'une autre application
(paysagistes en contrat d'entretien : cocher ce qui a été fait, envoyer au
client). Le modèle, l'écran des réglages, le passage et le rapport du client
existent. Le détail, et les deux versions du repli qui ont été refusées par leur
propre contrôle, sont dans `ARCHITECTURE.md` §128.

**Ce qu'il faut savoir avant d'y toucher :**

- **le repli lit TOUT l'historique envoyé du client**, pas son dernier passage.
  Ne pas « simplifier » vers le dernier passage : une taille de haie d'automne
  disparaîtrait dès le passage de mars, et il ne pourrait plus la cocher en
  octobre ;
- **les lignes d'un passage sont une COPIE du modèle**, le nom du client aussi
  (recopié à l'envoi). Une jointure serait plus courte et fausse au premier
  retrait ;
- **le tri « seulement ce qui a été fait » est en BASE**, pas à l'affichage. Le
  faire à l'écran laisserait les dix-sept autres lignes dans le HTML du client ;
- **il reste deux conforts non faits** : le PDF du rapport, et le « J'ai bien
  reçu » horodaté sur la page du client (`TODO.md` § « La fiche d'entretien »).

Ce qui suit décrit l'état du 16 août et reste vrai sur les décisions :

- **LE MODÈLE EST EN BASE depuis le 16 août** (migration `0051`). Un seul par
  entreprise, aucune fiche rangée par client. Il ne se sème PAS tout seul à
  l'ouverture d'un écran : la pose est un geste (`poserModeleFourni`). L'écran
  des Réglages reste à écrire.
- **TOUT EST TRANCHÉ le 16 août** : familles sur le chantier, seulement ce qui
  a été fait chez le client, la molette du TÉLÉPHONE (« la A »), et **un seul
  modèle** pré-rempli à chaque envoi — rien n'est rangé par client. L'ordre de
  construction est dans `TODO.md` § « La fiche d'entretien ».
- **Une lecture à confirmer d'un mot** : le pré-remplissage se fait d'après le
  DERNIER PASSAGE du client, pas depuis le modèle à chaque fois — sinon il
  réajusterait douze fois par an.
- **PAS DE SIGNATURE, décidé le 16 août.** Ne pas la rouvrir par bonne volonté :
  le client est absent onze fois sur douze, et sur sa propre capture de l'autre
  application les deux signatures étaient « Non signé ». La preuve tient à
  l'horodatage et à l'empreinte du contenu, comme pour l'acceptation d'un devis.
  **Et un rapport sans signature ne doit pas AVOIR L'AIR incomplet** : pas de
  « Non signé » en gris — un contrôle le tient.
- **L'envoi est celui du devis, et RIEN NE PART TOUT SEUL** (`docs/A-FAIRE.md`
  §5, tranché le 3 août). Le mot « automatique » qu'il emploie désigne le message
  préparé, pas l'expédition.
- **L'invariant à ne pas perdre** : un rapport déjà envoyé ne change plus jamais
  quand le modèle change. Il est signé et parti chez le client.
- **Le temps passé se choisit à la MOLETTE, pas au clavier** (16 août) —
  `docs/maquettes/65-choisir-l-heure.html`. La molette Atlas y est faite sans
  JavaScript (accroche + repère collé) : le procédé, et ses trois pièges, sont
  décrits dans `PROJECT_STATE.md`. Ne pas la refaire en suivant le défilement
  image par image, ça se désynchronise sur un téléphone chargé.
- **C'est un TROISIÈME parcours**, pas une case en plus : contrat → passages →
  rapport, à côté de devis → facture.
- **Le piège à ne pas recopier** : l'autre application liste les vingt
  prestations avec « Vrai »/« Faux ». Quatre étant faites, le client lit seize
  fois « Faux » sur un passage qu'il paie.
- **Les planches sont ENGENDRÉES** (`scripts/engendrer-maquette-fiche-entretien.mjs`)
  d'une seule liste : ne pas les retoucher à la main, elles divergeraient.

**« LE NOUVEAU CHANTIER » A GROSSI (16 août) — dessiné le matin, choisi et codé
dans la journée.** Sa réponse devant `docs/maquettes/67` : **« les capitales,
gros et très gras »** — 13 px, graisse 800, interlettrage 0,22 em, rond de
42 px, signe inchangé à 20. Les valeurs vivent dans `globals.css`
(`.atlas-mot`, `.atlas-rond`).

**⚠ `docs/maquettes/24-le-bouton-retenu.html` n'est PLUS la référence du
libellé** — elle porte un bandeau qui le dit, et renvoie à la 67. Elle reste
celle de l'onde, des trois tours et des onze grains, qui n'ont pas bougé. Ne pas
« ré-harmoniser » le reste sur ses chiffres.

**Et ne pas rétrécir le mot pour faire tenir autre chose à côté :** à 360 px, le
mot, l'écart et le rond font 237 px pour 308 disponibles.
`test-bouton-nouveau-chantier-e2e.ts` mesure les deux dérives — le retour au
libellé minuscule et la coupure en « … ».

**Et un piège de la page unique, corrigé au passage.**
`scripts/fusionner-maquettes.mjs` préfixe les identifiants pour qu'ils ne se
marchent pas dessus d'une maquette à l'autre. Il ne le faisait **que dans le
corps** : `#t-3:checked ~ …` et `label[for="t-3"]` restaient nus dans la feuille
de style et ne désignaient plus rien. La planche s'affichait parfaitement et ne
répondait à rien — aucune capture ne le montre. Les deux sont réécrits ensemble
depuis, et la fusion refuse toute référence orpheline.

**LE PRIX ACCORDÉ AU CLIENT (16 août).** « Fais cinq pour cent sur le montant du
devis » : une remise en pourcentage, sous le total, qui suit jusqu'à la facture
et au relevé de TVA. Son choix : l'arrangement **B** de `docs/maquettes/61`, le
plus cher des trois — **ne pas le rouvrir**, le coût lui a été annoncé avant.

**⚠ TROIS PIÈGES DE CE LOT, tous payés une fois :**

1. **Ne JAMAIS recalculer un total ailleurs qu'en appelant
   `totauxAvecReduction`** (`src/lib/reduction-devis.ts`). B n'est pas une ligne
   du tableau : tout endroit qui additionne des lignes à la main oublie la
   remise, et c'est un montant faux sur un document parti chez un client.
2. **`total_ht` est le montant NET**, réduction déduite. Le relevé de TVA,
   l'export comptable et les paiements y cherchent ce qui est dû.
3. **Pas de « moins » typographique dans un PDF.** `−` (U+2212) fait lever
   `pdf-lib` et plus aucun devis ne se génère. L'écran, lui, l'affiche très
   bien — le défaut est invisible partout ailleurs.

**Ce qui n'a pas été parcouru ici** : le geste à la VOIX, faute de transcription
et de modèle sur cette machine. `ARCHITECTURE.md` §116.

**UN JOUR BARRÉ N'EST PAS UN JOUR PRIS (16 août).** Sa capture de l'écran
d'envoi, et un défaut de PHRASE, pas de règle.

1. **Ce qu'il voyait.** Le 18 refusé, sans savoir pourquoi — et l'écran écrivait
   « les jours barrés sont déjà pris » alors qu'il n'y avait rien dessus.
2. **Ce qui se passe vraiment.** Un jour barré répond à « un chantier de CETTE
   durée peut-il y COMMENCER ? ». Deux jours partis du 18 déborderaient sur le
   19, qui est plein. **Reproduit avant de corriger**, et la règle est juste.
3. **Ce qui a changé.** La phrase nomme la durée — et ce faisant, elle montre le
   levier : la durée se change juste au-dessus du calendrier.
   `src/lib/jours-barres.ts`, `ARCHITECTURE.md` §115.
4. **`dureeDemiJournees` n'a pas de valeur par défaut sur `Calendrier`**
   (`number | null`), et il faut que ça le reste : le patron a droit à la durée,
   **son client non** — consigne tenue par `test-creneaux-planning.ts`, qui a
   refusé la première version de ce lot (*« la durée du chantier a fuité vers la
   page du client »*). Un défaut silencieux ferait pencher un écran du mauvais
   côté sans que personne ne le décide.
5. **Aucune règle de réservation n'a bougé.** Si un jour paraît mal barré,
   chercher dans `disponibilites.ts`, pas dans cette correction.

**ET UN RAPPEL QUI VIENT DE RESSERVIR (16 août).** Il signale « la demi-journée
ne s'affiche pas sur le planning » : c'était vrai la veille, corrigé la nuit même
(§111), et **son banc avait une version de retard** — sa fiche d'état le disait
en toutes lettres. Lire la fiche AVANT de chercher dans le produit a fait gagner
la moitié de l'échange.


**LE MICRO DU DEVIS (15 août) — et le seul piège qu'il porte.** Il peut
désormais dicter des corrections dans le devis : « supprime la deuxième ligne »,
« monte la taille de haie à 350 », « rajoute le broyage à 500 », « fondage du
bois » pour « Fendage du bois ». Elle **propose**, il **coche** — sa proposition
A (`docs/maquettes/54`). Rien ne bouge avant son appui.

**⚠ LE PIÈGE, ET IL EST À DIRE PLUTÔT QU'À TAIRE :** la feuille de confirmation
**remplie n'a jamais été parcourue de bout en bout ici**. Cet environnement n'a
ni service de transcription ni modèle. Ce qui est éprouvé : la règle sans
navigateur (`scripts/test-retouches-devis.ts`, 27 cas) et le micro au navigateur
(`scripts/test-dicter-dans-le-devis-e2e.ts`, 5 cas). Le raccord voix → feuille ne
l'est pas. **Si le patron signale que « ça ne comprend rien », commencer par
vérifier qu'une clé est bien posée sur son banc** (`npm run verifier:ia`) avant
de chercher dans la règle.

Trois refus sont dans le code et ne se négocient pas : aucun prix ne s'invente,
deux lignes qui se ressemblent rendent « à préciser », un nom reconnu nulle part
ne se rabat pas sur le numéro de ligne. `ARCHITECTURE.md` §113.

**ET DEPUIS LE 20 AOÛT, LE MÊME MICRO PREND LE CHANTIER ENTIER.** Sa demande :
*« qu'il appuie sur la note vocale, qu'il parle en expliquant les tâches à
faire, et que l'intelligence artificielle comprenne et rédige ça sous forme de
belles phrases »*. Il raconte — « j'aimerais tailler ma haie, enfin je ne sais
plus, je crois vingt mètres linéaires […] couper les inflorescences des
hortensias, et tondre la pelouse » — et il obtient trois lignes à cocher :
**Taille de haie** (20 ml), **Taille des inflorescences d'hortensias**, **Tonte
de la pelouse**. Rien n'a changé à l'écran : c'est l'invite du modèle qui tient
les deux façons de parler, parce qu'elles arrivent mêlées dans la même dictée.

**⚠ ET LE MÊME PIÈGE, EN PIRE.** « Belles phrases » est une promesse tenue par
un modèle de langage, et **rien ici ne peut la mesurer** — ni cet environnement,
ni la CI, qui pose une clé de remplacement. `npm run verifier:dictee` envoie sa
dictée entière au vrai modèle et vérifie les trois lignes, la mesure retenue et
l'absence de prix inventé ; **il n'a pas encore été joué**, faute de clé, et il
sort en erreur plutôt que de rendre un vert vide. À jouer depuis son espace
avant de considérer la promesse tenue. Ce qui EST éprouvé ici : tout ce que le
dépôt fait de la réponse du modèle, et la règle qui dit ce qui trahit une phrase
recopiée (`src/lib/redaction-lignes.ts`, confrontée à ses propres phrases).

**LA LIGNE DU PLANNING PORTE SES TROIS INFOS (15 août).** « 14 août · journée »,
« 17 août · matin · ½ journée », « 21 août · matin · 3 jours » — la date, le
moment de départ, la durée, **toute la ligne en or**. Sa demande sur la
maquette 59 : *« je veux journée et toute la ligne »*.

**L'INVARIANT À NE JAMAIS PERDRE, et il n'est pas d'écriture :** « matin » ne
s'écrit **jamais sans sa durée**. Seul, il redit le défaut du 13 août — *« ça
laisse à penser que juste le matin est bloqué »*. C'est le nombre accolé qui le
rend honnête. Un contrôle balaie les deux cents durées pour qu'un allègement
futur ne les sépare pas en silence (`ARCHITECTURE.md` §111).

**Et ce qui a été perdu au passage, sciemment :** « du 21 au 25 août ». La ligne
ne dit plus quand un chantier long **finit**, et les week-ends sautés interdisent
de le recalculer de tête. **Ne pas le remettre sur la ligne sans qu'il le
demande** — il y a été retiré pour faire tenir le nombre de jours ; sa place
serait la feuille du chevron.


**LA TVA AU PAIEMENT (16 août).** Sa question : *« si un client ne me paie pas,
la facture rentre quand même dans mon relevé »*. Elle était fondée : pour une
prestation de services, la TVA est due **à l'encaissement** (CGI art. 269-2-c),
et les débits — ce que faisait Atlas — sont une **option** qui se demande.

Quatre choses à savoir avant d'y toucher :

1. **Le défaut a CHANGÉ** (`entreprises.tva_exigibilite` = `encaissements`). Ne
   pas le remettre aux débits « pour retrouver l'ancien comportement » : c'est
   l'ancien comportement qui était faux.
2. **La migration 0045 a posé un règlement sur chaque facture déjà émise**, daté
   de son émission. C'est ce qui empêche un trimestre déjà déclaré de retomber à
   zéro. Ces lignes portent `origine='reprise'` et l'écran le dit — ne pas les
   effacer, et ne pas les faire passer pour des observations.
3. **Un acompte se compte au PRORATA du TTC**, et le règlement qui solde reçoit
   le reliquat. Sans cela, la somme des lignes du relevé ne tombe plus sur la
   facture, à un ou deux centimes près — et personne ne sait expliquer l'écart.
4. **Les refus ne LÈVENT jamais.** `new Decimal("zéro")` jette : une exception
   en action serveur devient un identifiant opaque chez lui. Tout refus passe
   par une valeur de retour, avec sa phrase.

Ce qui n'est PAS fait, et qu'il a choisi : le **rapprochement bancaire**
(`docs/A-FAIRE.md` §13, maquette `atlas-banque-rapprochement.html`). Il demande
un prestataire agréé, donc un contrat. La saisie à la main reste de toute façon
nécessaire — l'accès bancaire se coupe tous les 90 jours.

Le reste : `ARCHITECTURE.md` §110.


**⚠ UNE DATE CALCULÉE DEPUIS « AUJOURD'HUI » EST UNE BOMBE À RETARDEMENT (16 août).**
`test-pastille-equipe-e2e` visait `+ 20 jours` : jeudi le jour où il a été écrit,
**samedi** deux jours plus tard — et le planning refuse le week-end par
construction, donc ni journée rendue, ni bouton. Le message accusait le bouton ;
le bouton allait très bien. **Devant un rouge sur une suite qui touche au
planning, regarder d'abord quel jour de la semaine elle vise.** Corrigé avec
`estWeekEndIso`, et éprouvé dans les deux sens.

**LE DEVIS QUI TARDE : CODÉ (16 août).** Ses trois mots — *« la B et 4 »* puis
*« le G »* — sont appliqués : carte teintée avec le compte des jours, 4 jours par
défaut, libellé **« Chantier sans devis »**, premier des trois réglages. Détail et
deux points laissés en suspens : `TODO.md` §0 novivicies.

**⚠ L'ORDRE DES CARTES DE L'ACCUEIL EST UNE RÈGLE, PAS UNE CONCATÉNATION** —
`src/lib/ordre-notifications.ts`, deux décisions du 16 août : les rappels passent
devant (« fait la B »), ET une place est garantie aux réponses de clients
(« ok alors fait le »). La règle d'origine — *« les réponses d'abord, quelqu'un a
agi, cela prime sur un silence »* — est datée : ne pas la restaurer en la lisant
quelque part. `ARCHITECTURE.md` §112.

**⚠ IL Y A MAINTENANT TROIS RAPPELS, PAS DEUX** — `src/lib/rappels.ts`. Le
troisième se lit sur le CHANTIER (`created_at`, `devis_envoye_at`) et non sur un
envoi : un devis jamais parti ne laisse aucune ligne dans `envois_devis`.

**PHOTOGRAPHIER PLUTÔT QUE DÉCRIRE, ET LE FAIRE SUR LA BONNE SCÈNE.** Deux fois
dans ce lot, la description était fausse et l'image l'a dit : (1) j'ai annoncé
que sa carte passait derrière dès UNE réponse en attente — il en faut deux ;
(2) « montrer trois cartes » semblait résoudre le rang, et l'image montre la
troisième sous le bord de l'écran. `scripts/capture-rang-trois-cas.sh` monte la
scène minimale et rend le code même en cas d'échec.

**LA LEÇON DE CE PASSAGE, ET ELLE VAUT AU-DELÀ :** une confusion entre deux
libellés **n'existe qu'en contexte**. Montrer une ligne seule ne prouve rien —
c'est côte à côte avec sa voisine qu'elle se juge, et la règle tenue porte donc
sur les VOISINES, pas sur toutes les paires. C'est le patron qui l'a vu, pas un
contrôle.

**ET UN PIÈGE DE PLUS, LE 22e : UNE PROPRIÉTÉ VALIDE QUI NE FAIT RIEN.**
`.atlas-fil-defile` déclarait `scroll-snap-type: y proximity` depuis le premier
jour, et aucun enfant n'avait jamais déclaré `scroll-snap-align`. La propriété
était inerte, et rien ne pouvait le dire — elle est parfaitement valide. Sa
conséquence : une carte s'arrêtait où le doigt la laissait, son étiquette effacée
par le fondu de 18 px du cadre. *« Le premier message est trop haut et le début
n'est pas visible. »* Corrigé, et mesuré : une carte s'arrête à 24 px du bord.

**⚠ LA RUBRIQUE NOTIFICATIONS EST CODÉE DEPUIS LE 14 AOÛT** — `src/lib/rappels.ts`,
`src/app/reglages/notifications/`, `drizzle/0043_rappels_notifications.sql`. Deux
rappels réglables (« devis sans réponse », 7 j ; « chantier fini pas facturé »,
3 j), un interrupteur chacun, et le délai qui se tape : « Au bout de [ N ] jours »,
bornes 1–90, rangé sur `entreprises`. **Ne pas le redessiner.** Sa demande n'y est
pas : ces deux-là parlent d'un devis PARTI, lui d'un devis JAMAIS parti.

**LA LEÇON DE CE LOT, ET ELLE A COÛTÉ DEUX RÉÉCRITURES : CHERCHER CE QUI EXISTE
AVANT DE DESSINER.** La planche a décrit deux fois un monde disparu — d'abord un
écran de notifications déjà dessiné le 13, puis un délai déjà codé le 14. **Le
dossier `maquettes/` (l'application) et `docs/maquettes/` (les décisions) sont
deux endroits distincts, et le code en est un troisième** — regarder les trois
avant de dessiner, jamais un seul.

**ET HUIT MAQUETTES N'ÉTAIENT ATTEIGNABLES PAR AUCUN CHEMIN** (38, 39, 41, 42,
43, 46, puis 47 et 53 apportées par la fusion) : ni page unique, ni sommaire. `TODO.md` l'affirmait sans conséquence ; c'était
faux. `fusionner-maquettes.mjs` refuse désormais une maquette orpheline, un lien
mort dans le sommaire, et un numéro porté deux fois. **Avant d'écrire une
nouvelle planche, jouer `node scripts/fusionner-maquettes.mjs` : il donne le
prochain numéro libre en refusant le doublon.**


**« L'APPLI NE MARCHE PLUS » — ELLE MARCHAIT (14 août, tard).** Son iPhone
proposait de télécharger un fichier au lieu d'ouvrir Atlas. **Son espace de
travail s'était éteint** : GitHub arrête un espace inactif au bout d'une
trentaine de minutes, l'adresse survit, plus personne ne répond, et Safari
propose d'enregistrer ce silence.

**COMMENT ÇA S'EST DIAGNOSTIQUÉ SANS LUI, ET À REFAIRE PAREIL :** la fiche
d'état que son espace publie tout seul —
[issue #47](https://github.com/florianmarrins0978-svg/Atlas-app/issues/47).
Elle donnait la branche suivie, le commit récupéré (`08a5377` : le correctif
était bien arrivé) et « serveur : répond ». **Sa date est le premier
diagnostic** : réécrite tous les quarts d'heure, un silence de plus de vingt
minutes signifie « espace arrêté », pas « serveur en panne ».

**Ne pas conclure « c'est sa machine » sans avoir éprouvé le code**, parce que
la batterie tourne en mode DÉVELOPPEMENT et que son banc sert du **bâti** :
`npm run build`, puis `npx next start` avec `ATLAS_PROFIL=banc` — et vérifier
que `/` et `/login` rendent `200 text/html`. Sans ce profil, on obtient deux
erreurs qui n'accusent que le poste d'essai (`UntrustedHost`, puis
`LLM_PROVIDER vaut « dev » en production`).

**Ce qui a été ajouté pour lui :** `docs/ESSAYER.md` porte une section
« L'application ne s'ouvre plus du tout », avec sa capture décrite dans ses
mots et le remède en deux gestes. Elle reste lisible quand son espace est
éteint — c'est tout l'intérêt.

**LE DEVIS SE REPREND AVANT DE PARTIR (13 août).** « Modifier », en or, en face
du titre de l'écran d'envoi. Sa capture : *« si je veux modifier mon devis avant
de l'envoyer, je peux pas »* — et c'était vrai, le lien n'existait qu'APRÈS
l'envoi.

**Deux choses à ne pas défaire :**

1. **Le lien n'existe qu'avant l'envoi.** Un devis parti ne se modifie plus (la
   base refuse) : il se *reprend*, et l'écran d'après l'envoi porte déjà ce
   geste-là. `ARCHITECTURE.md` §104.
2. **`self-end` sur le lien.** `EnTeteEcran` aligne ses enfants par le haut :
   sans lui, le mot remonte à côté du surtitre au lieu de se poser sur la ligne
   du titre — et **rien ne rougirait**, d'où la mesure des rectangles dans
   `test-modifier-avant-envoi-e2e`.

**Et la façon dont ça s'est décidé, à imiter :** cinq maquettes avant tout code
(`docs/maquettes/45-…`). Sa première idée — le mot « Devis » cliquable — y
figure telle qu'il l'a dite ; il l'a écartée lui-même en voyant les autres.

**AJOUTER ET RETIRER DES CASES DANS « MES PRIX » (14 août).** Sa demande :
*« je dois pouvoir ajouter ou retirer des cases »*, puis, devant les trois
formes dessinées : *« code les toutes »*.

Cinq choses à savoir avant d'y toucher :

1. **Une case ne s'ajoute pas toute seule.** Elle naît du croisement de deux
   tranches : un diamètre de plus en pose DIX (1 dessouchage, 3 abattage,
   6 fendage). L'écran l'annonce avant qu'il valide, et le nombre est calculé
   (`casesParTranche`) — ne jamais l'écrire en dur.
2. **`axes` est un paramètre OBLIGATOIRE** de toutes les fonctions de
   `grille-prix.ts`. Ne pas y remettre de valeur par défaut « pour simplifier » :
   un devis chiffré contre les tranches d'origine pendant qu'il remplit les
   siennes est un prix faux qu'aucune erreur ne signale.
3. **Rien n'est semé en base.** Une entreprise sans ligne reçoit les valeurs de
   départ ; le PREMIER geste sur un axe recopie les tranches d'origine avant
   d'appliquer le geste. Retirer cette recopie effacerait ses huit tranches d'un
   coup, au premier ajout.
4. **Retirer n'efface aucun prix.** `retiree_le`, jamais un `DELETE` : les cases
   de `grille_prix` restent, sont ignorées à la lecture, et reviennent avec la
   tranche. Et la clé n'est jamais réemployée — sinon un prix hériterait d'une
   case qui n'était pas la sienne.
5. **Un travail ajouté par lui n'est PAS reconnu par le chiffrage.** L'écran le
   dit sous son titre. Ne pas retirer cette phrase en croyant faire propre : il
   le découvrirait sur un devis.

Le reste : `ARCHITECTURE.md` §105.

**L'UNITÉ D'UN TARIF SE CHOISIT (14 août).** Sa demande du 13 : *« crée-moi un
bandeau déroulant avec infos à choisir, jours/hommes, m² etc. »*, puis *« fais
celle-là »* devant la forme 1 de `maquettes/atlas-unite-deroulante.html`.

Ce qu'il faut retenir avant d'y toucher :

1. **La case DOIT rester libre.** Le bandeau se termine par une ligne
   d'écriture. Un élagueur a le stère, l'arbre, la tonne de grumes — une liste
   fermée lui retirerait ce qu'il a aujourd'hui. Deux suites montent la garde.
2. **La graphie des unités proposées n'est pas décorative.** « jour/homme » est
   exactement ce que `tarif-main-oeuvre.ts` reconnaît, à la lettre près. La
   renommer ferait disparaître son prix de main d'œuvre de la grille sans
   qu'aucun type ne bronche : `test-unites-tarif.ts` garde ce point précis.
3. **Le bandeau ne peut PAS être posé en surimpression sur la carte du tarif.**
   La carte vit dans un `LigneRetirable` qui masque ce qui dépasse : le bandeau
   y était tranché (mesuré : coupé à 504 px quand il en demandait 863). D'où
   deux pièces — `CaseUnite` dedans, `BandeauUnites` juste en dessous. Ne pas
   « ranger » l'un dans l'autre en croyant simplifier.
4. **Ce qui n'est pas fait, et c'est délibéré :** les unités déjà saisies ne
   sont pas corrigées. « m2 » enregistré reste « m2 » — réécrire ses données à
   son insu changerait des prix qu'il n'a pas demandé de changer.

Le reste : `ARCHITECTURE.md` §101.

**LE NUMÉRO DU DEVIS N'EST PLUS UN NUMÉRO DE TÉLÉPHONE (13 août).** Deuxième
passe sur le même défaut, et la première ne pouvait pas marcher.

1. **Ce qui s'est passé.** Il ouvre le lien de son devis reçu **par SMS** et
   reçoit « Hydration failed », avec la signature d'iOS
   (`x-apple-data-detectors-type="telephone"`) — la veille, un correctif avait
   été annoncé pour exactement cela.
2. **Son banc n'était pas en retard.** Vérifié avant toute hypothèse, par la
   fiche d'état (§ ci-dessus) : réécrite à 14 h 55, `main` à `5a6e999`, donc le
   correctif de la veille bel et bien servi. **C'est ce contrôle-là qui a évité
   de repartir sur une fausse piste.**
3. **Pourquoi l'en-tête ne suffisait pas.** `format-detection` est une DEMANDE
   au navigateur. Safari l'écoute ; la vue intégrée qui s'ouvre depuis Messages,
   non — et c'est le seul chemin par lequel son client arrive sur le devis.
4. **Ce qui répare est `inline-flex`, pas le découpage.** Un détecteur lit le
   texte APLATI de la page, pas le DOM. Entourer chaque moitié du numéro d'un
   `<span>` — la recette qui circule — ne change RIEN à ce texte ; mesuré avant
   d'écrire le composant. Seuls les blocs le coupent, et les enfants d'une boîte
   flexible sont blockifiés. **Ne pas « simplifier » `NumeroDeDocument` :** le
   rendu serait identique au pixel près et le défaut reviendrait en silence.
5. **Ce que ça coûte, et qu'il faut savoir avant qu'il le remarque :** un numéro
   copié depuis l'écran emporte des retours à la ligne. Intact dans le PDF, le
   SMS et la base.
6. **Ce qui reste à éprouver chez lui.** La détection appartient à un logiciel
   fermé d'Apple, absent d'ici. Les suites vérifient que le texte offert à ce
   logiciel ne contient plus de suite de chiffres appelable ; elles ne peuvent
   pas vérifier ce qu'il en fera. **Lui demander de rouvrir le lien depuis ses
   SMS**, et de dire ce qu'il voit. Détail : `ARCHITECTURE.md` §81.
**LA CIVILITÉ EST DEVENUE UNE DONNÉE (13 août, au soir).** Deux pastilles
« Mr » / « Mme » au-dessus du nom, **à la création seulement**.
`clients.civilite`, recopiée sur le devis et la facture (migration 0038).

**Elles ont été posées sur l'écran du devis, puis retirées le jour même, à sa
demande** — *« il ne faut pas qu'il y ait les pastilles cliquables sur le
devis »*. Le devis est le DOCUMENT, pas la fiche : le mot y est du texte, écrit
devant le nom. **Ne pas les y remettre sans lui.** Conséquence assumée, et qu'il
connaît : une civilité choisie de travers ne se corrige plus après la création,
faute d'écran de fiche client.

**Quatre choses à savoir avant d'y toucher :**

1. **NULL est un état normal, et le plus courant.** Une société n'est ni l'un ni
   l'autre. Ce que NULL vaut à l'écran est décidé dans `avecCivilite`, jamais en
   base : la règle d'avant s'y applique encore, et **c'est ce qui a évité que
   tous ses clients existants changent d'apparence du jour au lendemain**.
2. **L'ordre des questions dans `avecCivilite` n'est pas indifférent** : une
   civilité déjà écrite prime sur tout, puis son choix, puis la détection de
   société. Inverser les deux premiers redonne « Mme Mme Roux ».
3. **Le document garde une COPIE.** Corriger une fiche client ne doit pas
   réécrire un devis déjà parti.
4. **Le placeholder du nom vaut « Bernard », plus « M. Bernard »** — 54 fichiers
   de contrôle le visaient. `getByPlaceholder("Bernard")` attrape aussi
   « bernard@exemple.fr » : viser `input[placeholder="Bernard"]`.

**Ce qui reste ouvert et lui appartient** (`TODO.md`) : il n'y a que deux
pastilles, donc rien pour dire « c'est une société » autrement qu'en n'en
touchant aucune. Suffisant aujourd'hui ; à rouvrir s'il facture des entreprises.

Détail complet : `ARCHITECTURE.md` §81.

---

### La TVA due, les achats et la lecture des tickets (13 août 2026)

`src/lib/achat-tva.ts`, `drizzle/0036_achats_tva.sql`,
`src/server/repositories/achats-tva.ts`, l'écran `src/app/termines/tva/` et
`src/server/ai/services/lire-ticket.ts`.

**Six choses à ne pas défaire :**

1. **La TVA d'un ticket se RETIRE du total, elle ne s'y ajoute pas.** 120 € à
   20 % contiennent 20 € de TVA, pas 24. Un contrôle affirme l'inégalité
   explicitement — le corriger « dans l'autre sens » fausserait tout le relevé
   sans que rien ne se voie.
2. **`tva_deductible` est le seul montant obligatoire.** Exiger le total
   reviendrait à refuser les tickets qui n'affichent qu'une ligne de TVA, donc à
   perdre cette TVA.
3. **Aucune règle de déductibilité n'est encodée, et il ne faut pas en
   ajouter.** Elles dépendent de la dépense et du véhicule ; le comptable
   tranche.
4. **Le reste à payer peut être négatif** — c'est un crédit de TVA, et il
   s'affiche. Le borner à zéro cacherait le mois qui compte le plus.
5. **Ce que la lecture rend est une PROPOSITION.** Les champs arrivent
   pré-remplis ; c'est la valeur CONFIRMÉE qui part en base. Ne jamais
   enregistrer directement ce que le modèle a lu.
6. **Un achat daté hors de la période regardée doit se DIRE, puis EMMENER**
   (ajouté le 13 août 2026, sur son signalement). La feuille annonce la
   destination avant l'appui, et l'écran navigue vers elle après. Sans ça,
   l'achat est enregistré au bon endroit et **disparaît** : l'écran ne montre
   qu'une période, aucun des trois chiffres ne bouge, et le patron conclut que
   rien n'a été pris — c'est exactement ce qui s'est produit avec son ticket du
   24 juillet ajouté en août. `scripts/test-achat-hors-periode-e2e.ts` le garde,
   et **piège 19** dit pourquoi le premier correctif ne corrigeait rien.

**NON VÉRIFIÉ, et ça ne peut pas l'être ici :** la lecture d'un vrai ticket.
Aucune clé dans cet environnement. Si le patron signale une lecture fautive, le
plus utile est **la photo du ticket ET ce que l'écran a proposé** : c'est
l'écart entre les deux qui dit quoi corriger. Tout ce qui entoure la lecture est
éprouvé (`scripts/test-lecture-ticket.ts`, onze cas, sans réseau).

**Un piège d'outillage payé deux fois le 13 août :** ne jamais jouer une suite
base ni éditer un fichier PENDANT `verifier:avant-livraison`. `nettoyerBase()`
vide la base sous les pieds des cinquante autres suites, et une édition en cours
casse la compilation de celles qui n'ont pas encore démarré. Les deux batteries
rouges de la journée étaient cela, pas des défauts du code.

---


**« MONSIEUR MARTINS », ET LE TIRET RETIRÉ (13 août).** Sa capture de l'écran
Devis. Le nom du chantier ne dit plus « Chez … », la ligne du client porte sa
civilité, et le détail passe **sous** le nom au lieu d'être collé par un tiret.

**Quatre choses à savoir avant d'y toucher :**

1. **La civilité vit dans `src/lib/civilite.ts`, et nulle part ailleurs.** Trois
   endroits l'appellent — dont le message qui part chez le client. Le MOT vit
   dans `CIVILITE_PAR_DEFAUT` et a déjà changé une fois en une journée
   (« Monsieur », puis « Mr. ») : les contrôles le demandent à la règle plutôt
   que de le recopier, sauf un qui l'épingle en clair. La civilité est un
   **défaut, pas une donnée** : il n'y
   a aucun champ de civilité dans la fiche client, donc une cliente sera mal
   nommée. Le vrai remède — un choix à la création — n'a pas été ajouté sans son
   accord. **À lui poser.**
2. **Un invariant a été levé, pas oublié.** `nom-chantier.ts` tenait que chaque
   mot du nom venait de la saisie ; « Monsieur » rompt cette règle, et le patron
   l'a demandé en connaissance de cause. Ne pas la rétablir sans lui.
3. **UNE MIGRATION DE DONNÉES SUR UNE TABLE SOUS RLS NE FAIT RIEN, EN SILENCE.**
   C'est la leçon qui ressert le plus. `chantiers` et `clients` portent la RLS
   en mode **forcé** : le propriétaire y est soumis, et sans `app.entreprise_id`
   posé, `current_setting` rend une chaîne vide, le prédicat vaut NULL et
   **aucune ligne n'est visible**. Le premier `UPDATE` écrit s'est appliqué sans
   erreur, a rapporté un succès, et n'a touché aucune ligne. La migration 0036
   boucle donc sur les entreprises en posant le contexte de chacune — jamais en
   désactivant la RLS. Les migrations d'avant ne modifiaient que
   `termes_metier`, sans RLS forcée : ce cas était neuf.
4. **Un « 1 migration appliquée » ne prouve rien.** Le contrôle rejoue la
   migration et vérifie le résultat. Il a d'abord été un **faux vert** : il
   posait lui-même le contexte pour ses insertions, la migration en héritait, et
   il passait au vert sur la version défaillante. Il efface maintenant le
   contexte avant de jouer la migration.

**Et un rappel que cette journée redonne :** trois suites navigateur recopiaient
« Chez … » au lieu d'appeler la règle. Elles sont passées au rouge le jour où le
mot a changé. Elles appellent maintenant `nomDuChantier` / `avecCivilite`.

Détail complet : `ARCHITECTURE.md` §77.

**SIX BRANCHES RÉUNIES DANS `main` (13 août).** Sa demande : *« Fusionne. »*
`main` porte désormais l'agenda iCloud, l'écran de la facture (SMS **ou**
e-mail, et le téléchargement), le lien cliquable du message au client, et toute
la mémoire qui vivait à côté. Plus aucune branche `claude/*` ne détient de
travail que `main` n'ait pas.

**Trois pièges à connaître avant la prochaine fusion**, tous payés celle-ci :

1. **Deux branches numérotent la même section d'`ARCHITECTURE.md`.** Il y avait
   deux §67 et deux §68. Renuméroter ne suffit pas — **onze renvois** les
   visaient depuis quatre fichiers de mémoire et jusque dans un commentaire de
   suite. Chercher `§NN` dans tout le dépôt après toute renumérotation, et
   trancher renvoi par renvoi : ceux de `main` ne bougent pas.
2. **Le même bloc rangé à deux endroits fait un doublon silencieux**, parce que
   `git` voit deux ajouts et non un déplacement. Avant de « garder les deux
   côtés » d'un conflit de mémoire, vérifier que ce ne sont pas deux
   exemplaires du même texte.
3. **Une mémoire fusionnée peut se contredire.** Ici, `scroll-snap-stop:
   always` était donné pour règle par une branche et **retiré depuis le 11
   août** dans `main` (le patron lisait l'arrêt comme du saccadé) ; et
   `HANDOVER.md` annonçait encore « rien n'est codé » pour une refonte livrée.
   La question n'est pas « lequel garder » mais **« lequel est encore vrai »**.

Batterie entière au vert avant de pousser : types, lint, mémoire, 124/124
suites base, 65/65 suites navigateur, 23 contrôles de maquette, et la connexion
réelle derrière une origine étrangère.

**⚠ LE NOM DU CHANTIER A ÉTÉ CORRIGÉ DEUX FOIS LE MÊME JOUR, PAR DEUX
SESSIONS.** Il l'a demandé aux deux. La version retenue est celle de `main` —
« Monsieur Martins » (`ARCHITECTURE.md` §77, `src/lib/civilite.ts`) — et non la
mienne, qui rendait le nom nu. **Ne pas la « rétablir »** : il a levé la règle
du « rien d'inventé » pour la civilité, en le sachant.

**Ce que la collision a appris, et qui vaut pour toute migration à venir :** un
`UPDATE` de données sans contexte d'entreprise ne voit AUCUNE ligne sous la RLS
forcée. Il s'applique, rapporte un succès, et ne change rien — en silence. Ma
migration faisait exactement cela. Traiter entreprise par entreprise.

**LA LIGNE SOUS LE NOM EST TRANCHÉE ET CODÉE** — le D, avec la date d'envoi
(`ARCHITECTURE.md` §77). Trois choses à ne pas défaire :

- **la date d'envoi ne se devine pas.** Sans envoi enregistré, pas de seconde
  ligne. Le repli tentant — `majAt`, la date affichée à gauche — n'est PAS la
  date d'envoi : une photo ajoutée la déplace ;
- **l'or sur un devis parti est SA décision**, contre la règle d'avant (l'or
  pour ce qui attend un geste de lui). C'était écrit sur la planche qu'il a
  choisie. Si la liste devient trop dorée, `APPELLE_UN_GESTE` se défait sur une
  ligne ;
- **le lieu ne répète jamais le nom.** Défaut né du retrait de « Chez », vu à
  l'œil sur une capture : retirer un mot d'un libellé peut faire entrer deux
  autres en collision.

**Et une règle qui vaut au-delà de ce lot : un libellé se mesure SUR L'ÉCRAN.**
Une maquette HTML rend les mots plus larges qu'Inter dans l'application — la
première planche faisait passer sur deux lignes un libellé qui tient sur une
chez lui, et aurait donc écarté les bons libellés pour une raison fausse.
`scripts/engendrer-maquette-ligne-chantier.mts` joue chaque libellé dans
l'application et le photographie à 430 px (son téléphone) **et** à 390 px. La
largeur de son téléphone fait partie de la décision : le libellé actuel est
déjà à la limite.

**LE CALENDRIER D'ENVOI NE MARQUAIT QU'UN JOUR (12 août).** Il ne pouvait
proposer qu'une date dès qu'il la prenait au calendrier, alors que son client
doit pouvoir choisir entre deux (`ARCHITECTURE.md` §74).

**Deux leçons qui resserviront, et qui ne sont pas propres à cet écran :**

1. **Un état parallèle à la vérité finit toujours par mentir.** L'écran gardait
   la date du calendrier dans une chaîne à part, à côté de la sélection réelle.
   Le symptôme visible n'était pas le pire : rappuyer sur un jour retenu le
   **remettait** au lieu de l'enlever, parce que le geste se comparait à l'état
   parallèle. Devant un écran où « ça ne se désélectionne pas », chercher
   d'abord s'il existe deux états pour une seule chose.
2. **Un parcours à moitié joué ne prouve que la moitié qu'on joue.**
   `test-date-lointaine-e2e` choisissait UNE date au calendrier, et passait.
   Quand un écran offre un maximum — deux dates, trois photos, cinq lignes —
   l'éprouver à un seul exemplaire ne dit rien du second, et c'est au second que
   les états parallèles se révèlent.

**Et la règle des deux dates était écrite en double** : `basculerJour` existait
depuis le 9 août dans `src/lib/calendrier.ts`, pure et éprouvée, sans que
personne s'en serve. L'écran avait sa copie. C'est le §3 de `CLAUDE.md` — devant
une règle métier dans un composant, vérifier d'abord si le dépôt ne la porte pas
déjà.

**⚠ Deux suites voisines ont dû être réparées au passage, et la seconde vaut un
réflexe.** `test-retour-messagerie-e2e` **empruntait** son chantier à une autre
suite (`WHERE reponse IS NULL LIMIT 1`, sans `ORDER BY` ni propriétaire) : il ne
savait pas tourner seul, et ajouter une suite ailleurs a suffi à changer l'ordre
des lignes et à le faire rougir — en accusant le retour de messagerie, qui n'y
était pour rien. **Devant une suite qui rougit sans rapport avec ce qu'on vient
de toucher, regarder d'abord si elle possède ses données ou si elle les
emprunte.** Chacune fabrique désormais les siennes.


**LA FACTURE PART PAR E-MAIL, ET SE TÉLÉCHARGE (12 août).** Deux des trois
manques qu'il avait signalés le 10 août (`TODO.md` §8, `ARCHITECTURE.md` §73).

**Cinq choses à savoir avant d'y toucher :**

1. **Les TROIS manques sont réglés.** Le bouton a pris la capsule le 12 août —
   *« code la A »*, après deux planches (`docs/maquettes/38-…` puis `31-…`, cinq
   gestes qui se pressent). Il passe par `PrimaryButton`, **jamais par un
   dessin recopié sur place** : c'est le défaut qu'on répare, et le repeindre à
   la main le ferait revenir au prochain changement de charte. Deux suites
   mesurent son rayon calculé et rougissent si cela arrive.

   **Les quatre gestes écartés restent dans la maquette 39** — la lueur, le
   cachet, l'encre, le trait. S'il rouvre le sujet, repartir de là plutôt que
   de redessiner. Et se souvenir que **le cachet était la seule proposition qui
   ne reposait pas sur un goût** : c'est le geste de « Nouveau chantier », donc
   un vocabulaire partagé entre deux écrans.

   **⚠ UNE MAQUETTE NE PORTE PAS DE SCRIPT.** La première version de la 31
   engendrait ses cinq téléphones en JavaScript : chez le patron, page vide —
   *« rien apparaît sur ta maquette »*. Elle passait ici, dans un navigateur
   complet ; script coupé, zéro écran. La règle existait déjà pour les
   maquettes 25 et 26 (`scripts/verifier-maquette-bascule.mjs` joue les huit
   bascules JavaScript COUPÉ) et n'a pas été appliquée. **Tout contrôle de
   maquette tourne désormais `javaScriptEnabled: false`** — une case à cocher
   et des règles `:checked ~` suffisent à tout, y compris à une demi-seconde
   d'attente (`transition-delay`).

   **Un piège de MESURE qui a failli faire livrer un geste mort**, et qui
   resservira à chaque maquette animée : `locator.screenshot()` attend que
   l'élément soit **stable**, c'est-à-dire que l'animation soit finie — il
   photographie donc toujours l'après, jamais le pendant. Passer par
   `page.screenshot({ clip })`. Et surtout : **le contrôle de la lueur est
   passé au vert deux fois sur un geste que l'œil ne voyait jamais** (opacité
   et transform étaient irréprochables ; la lumière traversait le bouton en
   quatre-vingts millisecondes). Ce qu'il faut mesurer, c'est **combien de
   temps** une chose est visible, pas qu'elle bouge.
2. **Ce bouton était passé au travers parce qu'il est peint à la main dans
   l'écran** — même cause que la feuille d'envoi du devis (§66). Devant un
   bouton qui « n'est pas le même », chercher d'abord s'il est dessiné sur
   place plutôt qu'issu de `PrimaryButton`.
3. **Le nom du fichier PDF vit à DEUX endroits** — l'attribut `download` du lien
   et l'en-tête du serveur — et rien ne les relie dans le code. Deux suites les
   comparent, et elles ont trouvé l'écart au premier jet : après l'arrêt de la
   facture, sans rechargement, l'écran annonçait un brouillon quand le serveur
   servait la pièce définitive. **Ne pas retirer cette comparaison.**
4. **C'est le serveur qui décide du téléchargement**, pas l'attribut `download`
   du lien : iOS l'ignore selon les versions, et le PDF s'ouvrirait alors dans
   un onglet — le défaut d'origine, déguisé en correctif.
5. **Le point §8 n'était nulle part sur `main`.** Il avait été consigné sur
   `claude/migrate-app-atlas-zz31ac`, restée deux commits derrière, et aucune
   conversation lisant `TODO.md` ne pouvait le voir. Le patron a dû le
   redemander. `CLAUDE.md` §6 vaut aussi pour la mémoire : **une ligne poussée
   sur une branche n'existe pour personne.**

**La carte de réponse mène là où est le geste (12 août).** Le patron : *« si
c'est accepté, ouvrir le devis validé, pas le devis en construction ; si le
client demande une modification, ouvrir le devis pour pouvoir le modifier. »*

**Trois choses à savoir :**

1. **La règle vit dans `src/lib/suite-de-la-reponse.ts`**, pas dans le
   composant : accepté → `devis-complet` figé, tel que le client l'a reçu ;
   **correction → `devis-complet` AUSSI, mais après reprise** (drapeau
   `reprendreAvant`) ; refus et lien périmé → l'écran d'envoi, qui laisse le
   choix. **Ne jamais mener un devis à corriger sur `devis-complet` SANS la
   reprise** : il est immuable une fois parti, et le patron se retrouverait
   devant un document qui refuse sa frappe.
2. **Corrigé le 13 août 2026, par lui :** *« lorsque je clique sur corriger le
   devis, je dois arriver directement sur la page du devis pour pouvoir le
   corriger. »* La veille, la correction passait par l'écran d'envoi, au nom de
   « ne jamais reprendre à sa place ». Le principe reste juste — **mais il ne
   s'appliquait pas ici : c'est LUI qui appuie**, sur un bouton qui annonce
   « Corriger le devis ». Le geste est le sien ; l'en priver lui coûtait un
   écran et un second appui.

   Il vaut toujours ailleurs : un devis **accepté** ne se reprend jamais
   d'office (ce serait remplacer sans le dire le document sur lequel les deux
   se sont mis d'accord), et un **refus** ou un **silence** n'appellent pas
   forcément un nouveau devis — la suite peut être d'abandonner le chantier.
3. **Une acceptation sur une date PROPOSÉE ne fait aucune carte**, et c'est
   voulu (`notificationsPatron`). Seuls un refus, une correction, une
   contre-proposition de date ou un message du client en font une. Un contrôle
   qui l'ignore cherche une carte qui n'existera jamais — vécu le jour même.

---

### La TVA au mois ou au trimestre (12 août 2026)

`src/server/periode-tva.ts` (règle pure), `drizzle/0035_periodicite_tva.sql`,
Réglages → « Votre TVA », et le calendrier
`src/app/termines/tva/CalendrierPeriodes.tsx`.

**Trois choses à ne pas défaire :**

1. **Le mois est le défaut LÉGAL, pas une préférence.** La déclaration CA3 est
   mensuelle ; le trimestre est une option ouverte sous 4 000 € de TVA due.
   Repasser le défaut au trimestre serait un retour au défaut d'avant.
2. **Atlas ne calcule JAMAIS le droit au trimestre.** Le seuil porte sur la TVA
   *due* — collectée moins déductible — et ce produit ne voit aucune facture
   d'achat. Un écran qui conseillerait inventerait une donnée ; une suite
   (`test-periodicite-tva-e2e.ts`) rougit s'il s'y met.
3. **`lirePeriode` dépend de la périodicité** : « 12 » est un mois valide et un
   trimestre absurde. Lire l'adresse sans le réglage laisserait passer un
   douzième trimestre.

`src/server/trimestre.ts` subsiste, employé par `test-factures.ts` seul. Il n'a
plus d'appelant dans `src/`.

---

**Les pages du CLIENT ne portent plus la navigation du patron (12 août).** Sa
facture affichait « Chantiers · Planning · Terminés · Réglages » au bas de
l'écran de son client.

**Trois choses à savoir :**

1. **Il n'y a jamais eu de fuite** — un appui menait à la page de connexion, et
   le contrôle qui le prouve était vert avant même le correctif. Le dire
   d'emblée si le sujet revient : c'était une gêne d'affichage, pas un défaut de
   confidentialité.
2. **La liste des chemins publics vit dans `src/lib/chemins-publics.ts`, et
   nulle part ailleurs.** Elle était tenue en double — middleware d'un côté,
   mise en page de l'autre — et les deux ont divergé. **Ne pas en recréer une
   seconde** : un écran public ajouté plus tard n'entrerait que dans l'une.
3. **`test-pages-publiques-sans-navigation-e2e.ts` lit cette liste à sa source**
   et rougit si un chemin déclaré n'y est pas éprouvé. Il visite de vrais
   jetons : un jeton inventé rendrait « lien inconnu », et le contrôle serait
   vert sur du vide.
**L'ÉCRAN DU DEVIS PARTI EST CODÉ — « le signet d'or » (12 août).** Il a répondu
« code le 5 ». Un filet d'or pour l'état, le nom du devis et le montant seuls au
centre, « Modifier mon devis » sous le total, et en bas le geste puis les trois
actions en encre. Les lignes de prestations restent AVANT l'envoi et disparaissent
après : ce sont deux écrans, pas un avec des variantes.

**Cinq choses à ne pas défaire** sont listées dans `TODO.md` 0 septdecies — dont
`atlas-ecran` (deux tentatives de hauteur écrite à la main ont débordé de 100 puis
68 px) et l'avertissement de « Modifier mon devis », qui protège un engagement
réel : rouvrir un devis parti n'annule pas l'envoi, le client peut encore accepter
l'ancien prix.

**Ce qui reste ouvert :** le rayon du bouton (4, 8, 12 ou pilule — bande au bas de
la maquette 33). Son choix vaudra pour vingt-sept écrans. Il a demandé la maquette en toutes lettres : *« fabrique-
**⚠ SI LE PATRON MONTRE « An unexpected response was received from the server. »**
Regarder d'abord **quelle version son banc sert**. Si la pile d'appel contient
`.next/dev`, il est sur la version LENTE : chaque écran s'y compile au premier
appel, et le relais de GitHub abandonne au bout d'une minute en rendant sa
propre page d'erreur — le navigateur reçoit du HTML là où il attendait une
réponse. Ce n'est pas un défaut du code, c'est un banc qui n'a pas fini de se
construire. Depuis le 12 août, l'écran Réglages le dit lui-même, et un veilleur
(`src/components/atlas/VeilleReponseServeur.tsx`) pose une phrase française avec
un bouton « Recharger ».

**Ne pas élargir ce veilleur.** Il ne reconnaît que quatre formulations, et il
doit continuer de REFUSER tout le reste : habiller un défaut du code en
« le serveur se prépare » ferait recharger une page qui ne guérira pas, et
masquerait le défaut. `scripts/test-reponse-illisible.ts` tient ce refus.


**⚠ L'ÉCRAN DU DEVIS ATTEND UNE LETTRE — ne rien coder avant (12 août).**
Le CONTENU est arrêté (nom du devis, total, « Modifier mon devis », trois actions
en encre) ; c'est la MISE EN PAGE qui attend un numéro —
`docs/maquettes/26-le-devis-sur-sa-base.html`, cinq propositions. Le détail et les
trois points ouverts sont dans `TODO.md` 0 septdecies. Il a demandé la maquette en toutes lettres : *« fabrique-
moi la maquette et montre-la-moi avant de coder quoi que ce soit »*.

**Et NE PAS chercher une panne d'envoi de devis.** Elle a été signalée puis
démentie par lui le même jour : sa messagerie s'ouvrait bien, l'adresse du
client était fausse. `TODO.md` 0 quindecies bis dit ce qui a été vérifié — CSP,
longueur de l'adresse — pour qu'on ne le refasse pas.

---

### Les gestes de « Y aller » — désormais dans la feuille de chantier

Ils sont nés le 12 août 2026 dans un panneau qu'un chevron doré faisait
remonter : Plans, Google Maps, Waze, copier l'adresse, appeler le client.
**Depuis le 21 août 2026 ils vivent dans la FEUILLE DE CHANTIER**, posée dans la
page du planning refait (planche 84) — et ils ne sont plus que quatre : *« pas
besoin d'en mettre trois »*, Google Maps est sorti.

- `src/lib/itineraire.ts` — la règle pure (liens universels, jamais `waze://`).
- `src/app/planning/PlanningClient.tsx` — la feuille (`FeuilleChantier`), qui
  lit `liensItineraire` et `lienAppel` plutôt que de recomposer les adresses.
- `listerChantiersPourPlanning` remonte `adresseChantier` et `clientTelephone`.
- Contrôles : `scripts/test-itineraire.ts` (10), la section « feuille de
  chantier » de `scripts/test-planning-e2e.ts`, quatre de plus dans
  `scripts/test-nom-chantier.ts`, deux cas de plus dans
  `scripts/test-planning-repo.ts`. Tous ont été confrontés au défaut qu'ils
  prétendent voir avant d'être retenus.

**Deux choses à savoir avant d'y toucher :**

1. **La case « Toujours celle-là » de la maquette n'est PAS implémentée**, et
   c'est délibéré : mémoriser un choix de GPS sans nulle part où le défaire
   enferme le patron dans une application touchée par erreur. Elle attend son
   interrupteur dans Réglages. Ne pas l'ajouter en croyant combler un oubli.
2. **« Créer la facture » est dans la FEUILLE, plus sur la ligne** — sa
   décision du 12 août, prise en regardant la capture. Le chemin du planning
   vers la facture, ouvert le 8 août parce que l'écran était un cul-de-sac,
   coûte donc un appui de plus. Trois suites le parcourent en entier, et l'une
   vérifie qu'il a bien quitté la ligne : **le remettre là romprait deux
   contrôles**, pas un.

**Une question lui est posée et attend sa réponse :** un chantier sans adresse
n'a plus de chemin pour aller la saisir, la feuille se contentant de dire « à
saisir sur la fiche du chantier ». Faut-il un bouton « Saisir l'adresse » à cet
endroit ? Rien ne sera ajouté sans lui.

---


**⚠ SI LE PATRON DIT « ce n'est toujours pas là » : REGARDER LA BRANCHE
D'ABORD.** C'est le défaut du 11 août au soir, et il coûterait le même
aller-retour à chaque fois. Son espace de travail suit **`main`**, et rien ne
l'en fera sortir : `.devcontainer/mettre-a-jour.sh` fait un
`git merge --ff-only origin/<branche courante>`, à l'allumage **et** derrière le
bouton « Chercher les dernières corrections » de Réglages. **Un travail livré
sur une branche ne lui parviendra jamais**, quelle que soit la date affichée,
quel que soit le nombre de fois qu'il presse le bouton.

Ce soir-là il a dit : *« la modification n'est pas effectuée. Et pourtant, j'ai
la nouvelle dernière mise à jour, celle de dix-neuf heures et quelques. »* Il
avait raison sur les deux points — `main` avait bien bougé à 19 h 37, et le
bouton était ailleurs. **Avant de chercher un défaut dans le code, jouer :**

```bash
git show origin/main:<le fichier> | grep <la marque du travail>
```

La ligne « Version » de Réglages nomme désormais la branche
(`11/08/2026 19:37 · b45cd5d · main`) : une capture suffit à trancher, sans
avoir à le lui demander. Elle ne le disait pas, et c'est ce qui a permis le
malentendu.

**Le bouton « Nouveau chantier » a été fusionné dans `main` le 11 août au soir**,
sur son accord explicite (`6059641`). Il est donc chez lui. Ce qui reste utile
ici, c'est le piège : il resservira au prochain travail livré sur une branche.

**Douze remplaçants au gros bouton, en deux tournées (11 août).** Le patron ne
veut plus de l'aplat vert « Nouveau chantier » au milieu de l'écran Chantiers ;
le reste lui convient. Maquettes 14 et 15 dans `docs/maquettes/`, sur la dalle
réelle (390 × 664). **Rien n'est codé, et rien ne doit l'être avant son choix**
— `TODO.md`, 0 terdecies. Ne pas trancher à sa place : c'est le troisième
arbitrage graphique qu'il garde pour lui.

**La troisième tournée est la sienne** : il a décrit le geste lui-même — une
pastille ronde qui tourne, jette une onde et des éclats, et ouvre la feuille une
demi-seconde plus tard. Maquette 16, la seule des seize **qui se presse** :
`node scripts/verifier-maquette-pastille.mjs` la met à l'épreuve au doigt.

**Où en est son choix, exactement.** Le sceau de papier a d'abord plu, puis a
été écarté : *« le fond blanc me dérange »*. Ce qui tient encore : un objet
rond, à la place de l'aplat, la gerbe et la demi-seconde. Ce qui est ouvert : la
**matière** (maquette 18 — laque, or brossé, cire, encre vivante, ou pas de
disque du tout) et la **façon dont la page arrive** — deux propositions font
grandir le bouton jusqu'à ce qu'il DEVIENNE la page.

**Le bouton « Nouveau chantier » est CODÉ (11 août, au soir).** L'aplat vert a
disparu de `EcranChantiers.tsx` : à sa place, le mot écrit et un anneau d'un
cheveu qui bat tant qu'on ne l'a pas touché ; à l'appui, trois tours, onze
grains d'or, et la feuille 520 ms plus tard. Toutes les mesures viennent de
`docs/maquettes/24-le-bouton-retenu.html` — **les reprendre de là si on y
retouche**, jamais de mémoire.

**Quatre choses à ne pas défaire**, chacune payée par un défaut réel :
l'enfoncement immédiat (140 ms) sans lequel la demi-seconde passe pour une
panne ; l'ignorance du second appui, sans laquelle deux chantiers naissent au
lieu d'un ; le respect de « mouvement réduit », qui ouvre alors tout de suite ;
et le `href` conservé, qui mène à l'écran entier avant l'hydratation.

*Ce qui suit est l'historique du choix, gardé pour ne pas rouvrir ce qui est
clos.*

**LE BOUTON EST ARRÊTÉ, ET CHIFFRÉ — c'est par là qu'on reprend.**
`docs/maquettes/24-le-bouton-retenu.html` : « Nouveau chantier » écrit, le rond
qui bat à sa droite, trois tours et onze grains d'or à l'appui, la feuille une
demi-seconde plus tard. Le tableau au bas de la maquette donne toutes les
mesures. **Rien n'est codé** — c'est la seule chose qui reste (`TODO.md`,
0 terdecies).

*Ce qui suit est l'historique du choix, gardé pour ne pas rouvrir ce qui est
clos.*

**LE BOUTON EST CHOISI, et c'est là qu'il faut reprendre.** C'est **l'anneau
d'un cheveu avec son « + »**, qui doit **tourner à fond puis ouvrir la page**.
Il est **au centre**, à la place de l'ancien aplat vert, avec **un petit trait
de chaque côté qui s'écarte à l'appui**. Quinze déclinaisons attendent son verdict : huit du tour seul (maquette 22 ; la
version en haut à droite est restée dans la 21) et sept qui ajoutent **le mot**
et un **battement d'attente** (maquette 23 — c'est la dernière, et celle qu'il a
décrite pièce par pièce). Deux d'entre elles reprennent **l'anneau de la
note vocale** — c'est la piste la plus solide, parce que c'est la seule qui ne
repose pas sur un goût : les deux écrans partageraient enfin le même
vocabulaire. Rien n'est codé.

**Ce qui précède n'est plus d'actualité, et ne doit pas être ressorti :**

**Où en est le choix au 11 août au soir.** Il a fini par décrire le bouton
lui-même : *« un rond avec un plus, et lorsque j'appuie, une dynamique un peu
style explosion, de débris, avec le rond qui s'agrandit »*. Ce squelette est
acquis — disque plein, « + », gerbe, agrandissement jusqu'à la page, aucun fond
clair. Six gerbes sont à l'essai (maquette 20) ; il ne reste qu'à en désigner
une.

**Quatre refus de suite disent deux choses.** D'abord, décliner un même objet ne
le sauve pas : ce qui a débloqué la conversation à chaque fois, c'est de changer
d'axe — la nature du geste (16), la gravure (17), la matière et l'ouverture
(18), la retenue (19). Ensuite, et c'est la correction la plus utile qu'il ait
faite : *« tu as primé sur l'originalité au détriment de l'élégance »*. Chercher
l'inédit **contre** la tenue est un mauvais échange ; la maquette 19 retire la
gerbe, les matières imitées et les mouvements simultanés, et n'en garde qu'un
seul à la fois.

**Et une règle en est sortie, qui prime sur l'envie d'aider** (`CLAUDE.md`
§3 bis) : une demande d'apparence ou de geste se **dessine** d'abord. La
pastille avait été portée d'un coup dans l'application ; il l'a arrêté net —
*« crée-moi une maquette avant de changer quoi que ce soit »*. Le changement a
été défait, `src/` est intact.

**Ce que la première tournée a appris, et qui resservira :** proposer six
variantes du même geste, ce n'est pas proposer six idées. Il l'a renvoyée d'un
« je ne suis pas encore hyper convaincu ». La seconde change de **nature** à
chaque proposition, et c'est ce qu'il faudra refaire si une troisième est
demandée.

**Le contact du client se saisit dans la feuille d'envoi (11 août, tard).**
`ARCHITECTURE.md` §62. Le patron : *« l'encart qui permet d'envoyer aux clients
par SMS, par e-mail, a disparu. »*

**Trois choses à savoir avant d'y toucher :**

1. **Ne jamais rétablir le renvoi « sur sa fiche ».** L'écran « Informations » a
   quitté le tiroir du chantier le même soir : cette phrase désigne une porte
   qui n'existe plus, et un chantier dicté (client « non renseigné ») ne pouvait
   alors plus jamais partir. La règle vaut pour tout arrêt du parcours : **un
   écran qui refuse d'avancer offre de lever ce qui l'arrête, ou nomme un
   endroit qui existe.** Jamais l'un sans l'autre.
2. **La coordonnée est écrite SUR LE CLIENT**, pas retenue pour cet envoi — même
   information que la fiche portait. Et la feuille **rejoue la préparation**
   après l'enregistrement : l'état vient du serveur, jamais d'un blocage effacé
   à la main.
3. **`devis_absent` reste un arrêt sec, et c'est juste** : aucune saisie ne le
   lève. Ne pas l'aligner sur les deux autres par symétrie.

**« Mon devis » n'attend plus une réponse perdue (12 août).** Le patron :
*« il s'est passé plus de six minutes et j'ai dû recharger la page. »*

**Trois choses à savoir :**

1. **La chaîne n'est PAS lente — c'est mesuré**, 96 ms et 42 ms sans modèle
   raccordé, et chaque appel à un modèle est borné à 30 s. Ce qui durait, c'était
   l'attente d'une réponse qui ne revenait pas. La chaîne journalise désormais sa
   durée et son statut : **regarder le journal avant de la soupçonner.**
2. **Quand la réponse se perd, l'écran interroge `/api/chantiers/<id>/devis-pret`**
   et va au devis dès qu'il existe (`src/lib/attente-devis.ts`). L'attente
   **renonce** au bout de cinq minutes — ne pas retirer cette limite, une attente
   sans fin est le défaut qu'on répare.
3. **Même famille que §63 et §65** : un long aller-retour tenu ouvert est fragile
   par nature. Devant un quatrième symptôme de ce genre, chercher là.

**⚠ LA NOTE VOCALE PART PAR UNE URL, PLUS JAMAIS PAR UNE ACTION SERVEUR
(12 août).** C'est la cause — reproduite, pas supposée — des trois signalements
du patron : *« L'enregistrement n'a pas pu être transmis. »*

Une action serveur porte un **identifiant fabriqué à la construction** et
inscrit dans la page. Son banc se met à jour tout seul ; une page restée ouverte
appelle alors un identifiant disparu, et l'envoi échoue **sans atteindre le
serveur** — donc sans trace, sans refus, avec une phrase qui accuse le réseau.

**La preuve :** `npx tsx scripts/eprouver-page-vieillie.mts` ouvre la fiche,
redémarre le serveur, puis dicte. Code d'avant → `500` et le message du patron
mot pour mot, base vide. Par la route → `200`, note rangée.

**Trois choses à ne pas défaire :**

1. **Ne pas ramener l'enregistrement dans une action serveur.**
   `test-note-vocale-par-url-e2e.ts` rougit si on le fait.
2. **La règle vit dans `src/server/services/note-vocale-entrante.ts`**, partagée
   par l'anneau, l'écran de dictée et l'import. Trois copies divergeraient.
3. **Le raisonnement vaut pour tout envoi de fichier depuis un écran où l'on
   stationne.** Les photos passent encore par une action : si le patron signale
   un jour la même chose sur elles, la cause est écrite ici.
4. **C'est le MÊME phénomène que le §63** — les morceaux de code disparus,
   trouvés le même soir par une session voisine, sans concertation. Deux
   symptômes, une seule cause : **son onglet survit à son serveur.** Devant un
   troisième symptôme du même genre, chercher là, et non dans le réseau ni dans
   le produit.

**Les refus de note vocale disent pourquoi (11 août, tard).** Le patron voyait
*« Impossible d'enregistrer la note pour l'instant. Réessayez. »* sans que
personne puisse savoir ce qui s'était passé.

**Cinq choses à savoir avant d'y toucher :**

1. **Un refus ATTENDU est une valeur de retour, jamais une exception.**
   `enregistrerNoteVocaleAction` rend `{ ok: false, raison }`. Ce n'est pas un
   goût de style : **Next.js remplace en production le message d'une action
   serveur par un identifiant opaque**, et le banc du patron sert une version
   bâtie. Une exception ne lui parvient donc jamais lisible. La documentation du
   cadre le prescrit (`node_modules/next/dist/docs/01-app/01-getting-started/
   10-error-handling.md`). **Ne pas revenir à `throw` pour un refus.**
2. **CORRIGÉ LE 12 AOÛT : les pannes imprévues ne lèvent plus non plus.** La
   veille, elles levaient encore — et le patron a rapporté le lendemain la
   phrase de secours, *« la connexion a été interrompue »*. Le correctif était à
   moitié fait, et la moitié manquante était celle qui se produisait. Toute
   panne rend maintenant une phrase qui **nomme le maillon**
   (`src/lib/panne-note-vocale.ts` : session · cadence · lecture · stockage ·
   base). Le détail technique reste au journal, jamais à l'écran. **Ne pas
   revenir à `throw` ici non plus.**
3. **L'écran ne conclut plus « c'est le réseau », il demande au serveur.**
   `src/lib/diagnostic-liaison.ts` : si le serveur répond, l'appel a échoué pour
   une autre raison — presque toujours une **page vieillie** (l'espace se
   reconstruit, les actions changent d'identifiant, une page déjà ouverte appelle
   une action disparue ; recharger suffit). Accuser le réseau sans avoir demandé,
   c'était envoyer chercher au mauvais endroit.
4. **Le défaut n'a PAS été reproduit ici**, et c'est écrit tel quel. La dictée a
   été rejouée avec un micro simulé en développement, puis sur la version bâtie
   derrière une origine étrangère : elle passe à chaque fois. Ce qui est corrigé,
   c'est le silence, pas la panne. **Demander la phrase exacte plutôt que de
   supposer** — le tableau des phrases est dans `TODO.md` §0.
5. **Un fichier de zéro octet est refusé à l'entrée.** Avant, il descendait
   jusqu'à la base, qui le rejetait, et l'écran affichait la requête SQL
   entière — noms de tables et identifiant d'entreprise compris.

**Le défilement du fil, et la barre grise (11 août, au soir).** Le patron :
*« c'est saccadé »*, *« je ne veux pas voir cette bande grise du tout, je veux
juste que ça slide. »*

**Quatre choses à savoir avant d'y toucher :**

1. **`scroll-snap-stop: always` a été retiré de `.atlas-ligne`, et il ne faut
   pas le remettre sans le patron.** Il avait été posé le 10 août pour qu'un
   geste vif n'avance que d'un chantier ; c'est lui qui bloquait l'élan. Reste
   `proximity` sur le cadre et `center` sur la ligne : la perle se recale à
   l'arrêt, sans arrêter le doigt. L'arbitrage — « un geste = un chantier »
   contre « ça glisse » — a été tranché en faveur du second, dans ses mots.
2. **Le masque en dégradé et l'animation d'opacité sont HORS DE CAUSE, c'est
   mesuré.** `npx tsx scripts/mesurer-fluidite-fil.mts [--sans-masque]
   [--sans-animation] [--sans-accroche]` : les quatre combinaisons donnent 60
   images par seconde, médiane 16,7 ms. Ce sont les deux suspects évidents ; les
   retirer abîmerait l'écran sans rien gagner. **Relancer la mesure avant de les
   accuser à nouveau.**
3. **CONFIRMÉ SUR SON IPHONE, le soir même :** *« la fluidité de l'iPhone, ça
   aussi, ça a été corrigé. »* Le retrait de l'accroche a suffi. La mesure faite
   ici ne portait que sur Chromium sans tête — le navigateur ne produit pas
   l'élan d'un vrai doigt — et ce point restait donc ouvert par honnêteté ; il
   est clos par l'appareil lui-même. **Le `mask-image` est hors de cause, sur le
   vrai téléphone**, et non plus seulement dans une mesure de laboratoire : ne
   pas le déplacer « au cas où ». Le repli reste décrit dans `TODO.md` §0 bis,
   pour une plainte NOUVELLE, pas pour celle-là.
4. **Aucune zone qui défile ne montre sa barre, et un balayage y veille.**
   `test-aucune-barre-de-defilement-e2e.ts` parcourt douze écrans et exige
   `scrollbar-width: none` sur toute zone qui déborde vraiment. Il lit la
   propriété calculée, pas les pixels : ici la barre est en surimpression, elle
   ne prend aucune largeur et n'apparaît jamais sur une capture.

**Le devis coupait le texte, trouvé par ce même balayage (11 août).** Les trois
zones de `devis-complet` estimaient leur hauteur ; elles la **mesurent**
désormais (`ZoneQuiGrandit`, `scrollHeight`). Deux choses à retenir :

1. **La barre grise était le symptôme, la coupure était le défaut.** La masquer
   aurait rendu le balayage vert et la perte de texte silencieuse. C'est
   pourquoi `test-aucun-texte-coupe-e2e.ts` existe : il écrit un texte long pour
   de bon et vérifie qu'il tient dans sa boîte, et rien de caché ne le contente.
2. **Il lui faut un devis NON envoyé en base.** Un devis parti est figé, ses
   zones sont en lecture seule et rien ne s'y écrit — le contrôle le dit et
   rougit plutôt que de passer vert sans avoir rien éprouvé.

**La bascule et la capsule sont EN PLACE sur l'écran de création (11 août, tard).**
Deux mots en serif, un trait d'or qui glisse, un seul bouton dont le libellé se
fond. « Je l'écris » puis le bouton mène directement au devis entier, client déjà
en en-tête. `ARCHITECTURE.md` §64.

**Quatre choses à ne pas défaire :**

1. **Un seul bouton, et c'est tout l'enjeu.** Deux boutons à égalité
   obligeraient tout le monde à trancher avant d'avoir vu le chantier, alors que
   neuf fois sur dix la réponse est « je dicterai ». La bascule existe pour
   garder les deux chemins visibles SANS ajouter ce coût.
2. **La capsule est partout, et c'est tranché** (« partout », 11 août au soir).
   `PrimaryButton` est sur **dix-sept écrans** — 8 du produit, 9 d'erreur via
   `CorpsErreur` — et il n'existe **plus qu'une seule forme** d'action
   principale : la variante « plaque » a été retirée, pas mise de côté. **Ne pas
   se fier à un chiffre écrit dans un commentaire** : celui-ci a annoncé
   « vingt-sept » pendant deux jours sans que rien ne le vérifie, et il a été
   répété au patron. La commande qui recompte est dans l'en-tête de
   `PrimaryButton.tsx`.

   **Sa règle, à respecter pour tout changement qui touche plusieurs écrans :**
   *« montre-moi avant de faire, plutôt que de faire pour revenir en arrière »*.
   `scripts/capture-bouton-partout.mjs` photographie l'action principale sur les
   écrans réels sans rien modifier ; l'« après » s'obtient dans une copie de
   travail qu'on remet ensuite. **Et la planche se cadre à largeur d'écran
   constante** : deux captures de largeurs différentes se remettent à la même
   taille, et la comparaison dit alors l'inverse de la vérité — c'est arrivé.
3. **Le chantier est créé AVANT le devis**, toujours, par la même fonction
   (`creerPuisAller`). C'est ce qui permet au devis de relire le client. Sauter
   la création produirait le devis orphelin qu'il redoutait.
4. **Le repère `data-atlas="action-creation"`** sur le bouton n'est pas
   décoratif : les DEUX libellés vivent dans le bouton, l'un à `opacity:0`, et un
   sélecteur par le texte les trouverait tous les deux.

**Le piège, payé deux fois maintenant :** `innerText` ne connaît pas l'opacité.
Un contrôle qui lit le libellé du bouton par le texte passe au vert **même sur
une bascule morte** — il ne sait pas échouer, donc il ne prouve rien. Lire le
style calculé, et attendre la fin du fondu (260 ms) avant de conclure.

**La phrase de pied de la création est retirée, et six façons de montrer les
deux portes sont proposées (11 août, tard).** Sa demande, capture à l'appui :
*« on ne voit que création de chantier, on ne voit pas devis à la main »*.

- **Retiré** : « Le nom crée la fiche du client. Le reste se corrige ensuite,
  sur le devis. » La ligne subsiste mais ne parle qu'en cas d'erreur — sa place
  reste **réservée** (`min-h-[19px]`), sinon l'apparition d'un message ferait
  sauter la mise en page sous le doigt qui vient d'appuyer.
- **Proposé** : `docs/maquettes/25-les-deux-portes.html`, six mises en page où
  les deux sorties se voient d'un coup. **Il a retenu la n° 4, la bascule**, et
  demandé plus élégant : six déclinaisons de cette seule idée sont dans
  `docs/maquettes/26-la-bascule-affinee.html`, et
  `docs/maquettes/27-banc-dessai-bascule.html` les fait **essayer** (champs où
  l'on tape, bascule, bouton qui mène vraiment à deux écrans différents).
  **Il a retenu la déclinaison 1, le trait qui glisse.** Reste le BOUTON, qu'il
  trouve « trop gros, carré » : huit formes dans
  `docs/maquettes/28-le-bouton.html`, **non tranchées** — voir `TODO.md`
  §0 septies.

  **Deux choses à ne pas oublier de lui dire s'il choisit :** ce bouton est sur
  **vingt-sept écrans** (`PrimaryButton.tsx`), donc le changer ici le change
  partout ; et la proposition 8 **revient sur la décision du 10 août** — le
  rayon droit avait été retenu pour ne pas ressembler à un bouton
  d'application.

  **Le banc n'est PAS dans la page unique, et c'est délibéré** : il navigue
  entre plusieurs écrans et prend tout le téléphone, deux choses qu'une page de
  comparaison ne sait pas accueillir. Ne pas l'ajouter à `MAQUETTES` dans
  `fusionner-maquettes.mjs` en croyant réparer un oubli.

  **Le point fragile du banc, s'il faut y toucher :** le bouton est **deux liens
  superposés**, et seul celui qu'on lit reçoit le doigt. Retirer le
  `pointer-events:none` du lien invisible ferait mener le bouton toujours au même
  écran, **en silence**, pendant que son libellé aurait changé — un contrôle qui
  lit seulement le libellé passerait au vert dessus. Le nôtre appuie pour de bon.

  **Et un défaut de mise en page à ne pas repayer :** `.champ` est un `<label>`,
  donc **inline** — sans `display:block`, ses marges latérales ne s'appliquent
  pas et les champs partent à ras bord du téléphone, pendant que le bouton reste
  en retrait. Invisible sur un écran d'ordinateur, invisible pour tout contrôle,
  visible sur une capture au format de son téléphone.

**Deux choses à ne pas défaire dans cette maquette :**

1. **Aucun script, et c'est éprouvé** — `node scripts/verifier-maquette-bascule.mjs`
   joue les **huit** bascules des maquettes 25 et 26 **JavaScript coupé**, dans
   les fichiers seuls ET dans la page unique, où la fusion réécrit les
   sélecteurs. C'est là que ça casserait sans bruit. Il est générique : il
   cherche les blocs marqués `data-bascule` et les mots marqués `data-mot` —
   une déclinaison de plus est donc éprouvée sans qu'on touche au contrôle, et
   le NOMBRE attendu par fichier y est écrit pour qu'une déclinaison oubliée ne
   passe pas en silence. Il sait échouer : casser la règle `:checked ~` rend
   douze rouges.

   **Et le piège qu'il a coûté :** lire le libellé du bouton juste après le clic
   donne l'état d'AVANT. Pendant la première moitié d'un fondu de 260 ms,
   l'ancien mot est encore au-dessus de 0,5 d'opacité — deux lectures identiques
   d'affilée y sont la norme. Six maquettes justes ont été déclarées rouges pour
   cela. On exige donc une valeur **tenue plus longtemps que la plus longue
   transition**, jamais deux lectures d'affilée.
2. **Le geste unique reste la question de fond.** Deux boutons à égalité
   obligent tout le monde à trancher, alors que neuf fois sur dix la réponse est
   « je dicterai » — c'est ce qui avait fait retenir le lien discret le 11 août
   au matin. Seule la proposition 4 montre les deux **sans** rien demander.

**L'écran d'erreur se relève tout seul d'un morceau de code disparu
(11 août, au soir).** Sa capture de 18 h 02 : `ChunkLoadError`, « Failed to load
chunk », et un bouton « Réessayer » qui ne pouvait pas marcher — `reset()` refait
le même rendu avec les mêmes adresses mortes. `ARCHITECTURE.md` §63.

**Quatre choses à savoir avant d'y toucher :**

1. **La décision est une fonction pure**, `src/lib/reprise-erreur.ts`, et le
   corps commun des dix écrans est `src/components/atlas/CorpsErreur.tsx`. Ne
   pas recopier un `<PrimaryButton onClick={reset}>` dans un `error.tsx` : c'est
   très exactement le défaut réparé, et il reviendrait par là.
2. **Une seule fois par fenêtre de cinq minutes**, et cette borne vaut le
   correctif. Sans elle, une panne qui dure donne un téléphone qui recharge sans
   fin — il n'afficherait alors *jamais* le message qui lui dit quoi faire.
   `sessionStorage` (pas `localStorage`), lecture enveloppée : **Safari en
   navigation privée lève à la simple lecture**, et il n'y a pas d'écran
   d'erreur derrière un écran d'erreur.
3. **On note AVANT de recharger.** Noter après, c'est ne jamais noter : la page
   est déjà partie.
4. **`pb-40` sous le bouton n'est pas de l'espacement.** Mesuré : la bulle de
   l'assistant recouvrait 48 px du bouton dès que le message dépassait deux
   lignes. Un contrôle rougit si la réserve disparaît.

**Et un piège de mesure, qui a d'abord fait passer un contrôle pour rien :**
Playwright émet `framenavigated` sur les navigations `pushState` du routeur,
sans qu'aucune page n'ait rechargé. **C'est la requête de DOCUMENT qui signe un
rechargement**, et elle seule.

**« Terminés » et la facturation (10 août, au soir).** L'écran est un fil par
mois ; l'encart « à facturer » vit dans le mois et se déplie d'un appui.
`ARCHITECTURE.md` §53.

**Trois choses à savoir avant d'y toucher :**

1. **« Créer la facture » a remplacé « Fin de chantier »** partout — décision du
   patron du 10 août. Le geste n'a pas changé : il bâtit la facture à partir du
   devis, et **n'envoie rien**. Créer n'est pas envoyer, et ça ne se plie pas.
2. **À zéro chantier en attente, la chaîne « à facturer » ne doit apparaître
   nulle part.** Un contrôle de capture échoue si elle revient.
3. **Un montant inconnu n'est pas zéro.** Un chantier sans devis chiffré affiche
   « — », et l'encart tait son total plutôt que d'annoncer « 0,00 € ».

**Le planning au mois et les équipes nommées (10 août, au soir).** Le planning
est un calendrier de sept colonnes ; toucher un jour ouvre sa journée dessous,
avec une ligne par équipe. Réglages laisse nommer les équipes.
`ARCHITECTURE.md` §51 et §52.

**Quatre choses à savoir avant d'y toucher :**

1. **À UNE seule équipe, le mot « équipe » ne s'écrit nulle part** — ni au
   planning, ni dans une phrase d'explication, et Réglages ne propose aucun
   champ. C'est la demande du patron, pas un détail d'affichage. Un contrôle de
   capture échoue si la chaîne « quipe » réapparaît.
2. **Le repli « Équipe A » est un AFFICHAGE.** `equipes.nom` est nullable et n'a
   aucune valeur par défaut ; `libelleEquipe` (`src/lib/equipes.ts`) est la
   seule à décider, pour l'écran comme pour le serveur.
3. **`entreprises.nombre_equipes` fait autorité sur le nombre** ; la table ne
   porte que des noms. Une ligne survit au-delà du compteur, à dessein :
   redescendre puis remonter ne doit pas perdre un nom saisi à la main.
4. **La grille se cale sur LUNDI** — `(getUTCDay() + 6) % 7`. Le 1er août 2026
   est un samedi : un calage sur dimanche fait glisser tout le mois d'un jour,
   sans qu'aucun chiffre ne manque.

**L'anneau de la dictée est au centre de la fiche, dès l'arrivée (11 août).**
Demandé par le patron. Sans note il est un micro (un appui dicte, un second
enregistre) ; avec, il redevient le lecteur. Le magnétophone est partagé
(`src/app/chantiers/[id]/magnetophone.ts`) — ne pas le recopier dans un
troisième écran.

**Avant de raisonner sur l'espace du patron, le regarder :
`npm run diagnostiquer:espace`.** Il rend la branche suivie, le code récupéré,
**le code réellement servi**, l'état du serveur et du veilleur. Deux hypothèses
ont été avancées à distance le 11 août pour expliquer un « ça ne marche pas », et
les deux étaient fausses — chacune lui a coûté un aller-retour. Cette commande
existe pour que la troisième ne le soit pas.

**La version bâtie ne se recompile JAMAIS (11 août, soir).** `next start` sert
un dossier figé : tirer du code sous ses pieds n'y change rien. Le bouton
« Chercher les dernières corrections » promettait une recompilation impossible,
et le patron a passé une soirée à recharger un écran qui ne pouvait pas changer.

La règle est dans `src/lib/issue-mise-a-jour.ts`, en fonction pure. **Ne jamais
la ramener à un message unique** : les trois cas sont distincts, et le troisième
— version bâtie *sans veilleur* — doit rester sans coupure, sous peine
d'éteindre l'application du patron sans personne pour la relever.

**Pour savoir si un espace a vraiment pris le code :** le démarrage affiche
`⚠ MISE À JOUR impossible : <raison>`. Les causes les plus fréquentes sont un
dépôt sale et une branche qui n'est pas celle qu'on pousse.

**« Mon devis » sous l'anneau enchaîne tout jusqu'au devis (11 août, soir).**
Cinq choses à savoir avant d'y toucher :

- **La chaîne lance la transcription elle-même** (`devis-depuis-dictee.ts`,
  étape 1). C'était le maillon manquant ; le retirer renverrait ce geste sur
  l'écran Transcription, à quatre écrans de la dictée.
- **`variante="anneau"` de `DevisDepuisDictee`** — l'écriture nue, en OR et non
  en vert pin. Dérogation assumée à la charte : en vert elle faisait un second
  centre à côté de l'anneau.
- **Informations, Prix et Devis ont quitté le tiroir**, mais **leurs écrans
  répondent toujours** à leur adresse. Un contrôle l'exige.
- **Le bandeau du tiroir se tait dès qu'une note existe** : l'étape suivante
  calculée vaut souvent l'une des lignes retirées, et l'annoncer enverrait
  chercher une porte condamnée.
- **Sans service de transcription raccordé, le geste s'arrête en le disant.**
  C'est l'état réel de l'application, pas un défaut — et c'est éprouvé.

**Le devis à la main s'ouvre aussi depuis l'écran de création (11 août, soir).**
`creerPuisAller("fiche" | "devis")` — **une seule fonction de création**, deux
destinations. Le chantier est créé d'abord : c'est ce qui permet à
`devis-complet` de relire le client. Deux fonctions auraient divergé au premier
champ ajouté.

Trois choses à savoir avant d'y toucher :

- **La porte du tiroir reste**, et ce n'est pas un doublon : deux *moments*, pas
  deux chemins (« je sais déjà » vs « finalement je l'écris »).
- **Sans nom de client, aucune fiche client n'est créée**, et le devis n'offre
  pas d'en rattacher un. **Ce n'est plus écrit nulle part à l'écran** depuis le
  11 août au soir : le patron a fait retirer la phrase de pied qui le disait
  (« Le nom crée la fiche du client… »), l'écran étant plus net sans elle. Le cas
  reste vrai ; s'il devait un jour se voir, c'est **sur l'écran du devis** qu'il
  faudrait le dire — pas en remettant une phrase permanente sur la création.
- **La réserve de bas d'écran (`pb-40`) ne vaut qu'en page.** En feuille, celle-ci
  est `fixed` en `z-[50]` et recouvre déjà la bulle : y ajouter la même réserve
  ne protège de rien et laisse quatre-vingts pixels de vide.

**La pellicule ajoute sur place, et l'écran Photos a été supprimé (11 août,
soir).** Le « + » du tiroir n'est plus un lien : il ouvre le menu du téléphone,
sur la fiche. `src/app/chantiers/[id]/Pellicule.tsx`, `ARCHITECTURE.md` §60.
Quatre choses à savoir avant d'y toucher :

- **Aucun champ de fichier ne doit porter `capture`.** Sur un iPhone, il impose
  l'appareil photo, retire l'accès à la photothèque, et le menu à trois entrées
  — celui que le patron a photographié — n'apparaît jamais. Une suite compte les
  champs et refuse `capture` : c'est le seul garde-fou, aucune machine de test
  ne rendra ce menu.
- **La visionneuse sort par un portail, et il le faut.** Le tiroir porte un
  `z-index` : rendue dedans, elle passe **sous** la barre de navigation, qui se
  peint en travers de la photo.
- **Le tiroir mesure sa hauteur par `ResizeObserver`.** La pellicule ne passe
  plus par ses propriétés : une liste de dépendances ne verrait plus rien, et le
  tiroir des retirés resterait derrière le bord, « Annuler » hors d'atteinte.
- **`/chantiers/[id]/photos` n'existe plus** (404, vérifié). Les liens de
  `chantier-etat.ts` pointent désormais sur la fiche elle-même.

**Le corps de la fiche ne porte QUE l'anneau (11 août, après-midi).** Sa
maquette (`maquettes/atlas-note-vocale.html`) ne montre aucun bouton, et il l'a
redemandé deux fois : *« exactement, respecte strictement ma maquette »*. Ce
qu'il faut savoir avant d'y toucher :

- **L'étape suivante vit désormais dans le bandeau du tiroir**, et la rédaction
  à la main dans sa liste. Vider le corps sans les descendre a fait tomber six
  suites d'un coup — c'étaient deux demandes à lui, des 3 et 4 août.
  `getSecondarySteps` est donc appelé **sans** `nextAction.key` : l'exclure
  ferait disparaître l'étape suivante de l'application entière.
- **`EnTeteEcran` a trois réglages facultatifs** (`precisionPlacee`, `cheveu`,
  `actionPlacee`), employés par cette seule fiche. Leurs valeurs par défaut
  gardent la grammaire commune du 10 août : ne pas les inverser.

**L'écran des suites vit à UN endroit : `ECRAN_DU_PATRON`, dans
`scripts/e2e-browser.ts`** (11 août, après-midi). Ne pas réécrire de
`viewport: { width: 393, height: 852 }` dans une suite : c'était la dalle d'un
iPhone 14, pas la place réelle d'une page (390 × **664**, barre du navigateur
déduite), et ces 190 px de trop ont laissé passer un lien recouvert chez lui.
Une suite qui a VRAIMENT besoin d'un autre cadre en passe un explicitement — il
est alors conservé, et c'est un choix visible dans son code.

**Le cadre honnête n'a révélé aucun défaut caché** : 46/47, l'unique rouge étant
un dépassement de délai du serveur de développement (la suite rejouée seule
passe). Ce n'est pas une déception, c'est un résultat.

**`scripts/test-rien-de-recouvert-e2e.ts` cherche, sur quatorze écrans, ce qui
est hors d'atteinte du doigt.** Avant d'y toucher, savoir que trois précautions
y sont *indispensables*, chacune payée par une volée de fausses accusations :
on amène la cible au centre avant de juger (sinon tout ce qui est sous la barre
du bas est accusé à tort), on écarte ce qu'un parent **rogne** (l'encart « à
facturer » replié garde ses liens dans la page), et on écarte la parenté
directe. Les retirer rendrait cette suite bruyante, donc ignorée.

**Le seed conserve les identifiants Google (11 août, matin).** `agendas_externes`
porte `entreprise_id … ON DELETE CASCADE` : le `TRUNCATE … entreprises` du seed
emportait ce que le patron avait tapé à la main. On garde les **identifiants**
(il est allé les créer chez Google), pas les **jetons** (l'accord valait pour
l'entreprise disparue) — sinon l'écran annoncerait un raccordement qui ne vaut
plus. Attention en y touchant : la RLS est en `FORCE`, il faut POSER
`app.entreprise_id` pour lire, sinon la conservation ne conserve rien **en
silence** — c'est arrivé au premier jet, contrôle au vert compris.

**Le banc attend la VIE DU SERVEUR, pas une montre (11 août, nuit).** Il
concluait « l'application n'a pas répondu après trois minutes — cause la plus
fréquente : la base n'est pas montée » … trois secondes avant qu'elle réponde,
et la base allait bien. Sur ce disque, une compaction de cache prend quinze
secondes. **Ne jamais remettre de délai fixe ni d'accusation par défaut** : un
contrôle échoue si « base de données » revient dans ce message.

**Le banc déloge un orphelin au démarrage (11 août, nuit).** Un `next-server`
d'une exécution précédente tenait le port et faisait échouer le démarrage avant
tout. Distinction à ne pas casser : *quelque chose répond à la santé* = Atlas
sert, on n'y touche pas ; *port pris et rien ne répond* = orphelin, délogé.

**Le serveur du banc est DÉTACHÉ, et c'est son groupe qu'on tue (11 août, nuit).**
La vraie cause des quatre `EADDRINUSE` : `npx next dev` est une pile
d'enveloppes, et `next-server` **survit à la mort de son père**. Tuer l'enfant
ne libère pas le port ; `pkill -f` visait un motif, pas des processus — ça
marchait ici et pas chez lui. `detached: true` + `process.kill(-pid)` emporte
tout le groupe. **Ne jamais retirer l'un sans l'autre** : détaché sans mort du
groupe, chaque Ctrl+C laisserait un orphelin sur le port — ce qui empoisonnait
justement chacune de ses tentatives suivantes.

**La bascule déloge d'abord, vérifie ensuite, réessaie — et ne meurt plus
(10 août, très tard).** `serveur.kill()` ne tue que l'enveloppe `npx` : le
processus qui écoute se renomme `next-server` et lui survit. Le `pkill` était
appelé en dernier recours ; il est maintenant le **premier geste, sans
condition**. Et si la reprise du port échoue malgré tout, le banc **relance un
serveur de développement** au lieu de mourir : un banc lent reste un banc.

**Le remède de la session fantôme a tourné en rond (10 août, très tard).** Deux
causes, dont la première invisible à `curl` :

1. **`__Secure-` / `__Host-` exigent l'attribut `Secure`** — sans lui le
   NAVIGATEUR jette le Set-Cookie, en silence. Derrière le relais (HTTPS), c'est
   ce nom-là qui porte la session : l'effacement échouait, le fantôme survivait.
   L'attribut suit le NOM, jamais une supposition d'environnement — le poser sur
   un nom sans préfixe le rendrait inopérant en clair.
2. **`/login` ne doit JAMAIS être soumis au contrôle du compte** : c'est ce qui
   transformait la panne en boucle infinie.

Et `portRendu` posait la mauvaise question : la santé, au lieu du port. Un
serveur tué cesse de répondre bien avant de rendre sa socket — d'où le retour
d'« EADDRINUSE ». Il essaie maintenant d'écouter sur le port.

**La construction mourait en rendant la main (10 août, tard).**
« setRawMode EIO » puis « Segmentation fault », APRÈS un « Compiled
successfully ». Next.js prend le contrôle du terminal quand son entrée en est
un ; dans un espace distant ce terminal peut disparaître sous lui. **Aucun
enfant du banc ne reçoit plus d'entrée** (`["ignore","inherit","inherit"]`) —
la sortie reste héritée, et Ctrl+C marche toujours, il passe par le groupe de
processus. Ne pas remettre `stdio: "inherit"` : un contrôle échoue.

**Deux bancs se tuaient l'un l'autre — « EADDRINUSE », errno -98 (10 août, tard).**
Le veilleur ne pouvait pas distinguer une BASCULE d'une MORT : pendant que
`banc.mjs` remplace son serveur, la santé se tait et aucun `next` ne tourne —
ses deux conditions de relance, mot pour mot. Il lançait un second banc, qui
prenait le port. Et rien n'empêchait le patron d'en lancer un troisième à la
main. Deux gardes désormais :

- `.devcontainer/bascule-en-cours.sh` — un drapeau, **qui expire en 3 min**.
  Ne jamais le rendre permanent : un banc tué rendrait le veilleur muet pour
  toujours, et le 404 du 9 août reviendrait sans que rien ne l'y relie.
- `scripts/verrou-banc.mjs` — un seul banc à la fois, **par identifiant de
  processus** et non par simple drapeau, pour la même raison.

Regarder le PORT ne suffit pas : pendant sa construction, un banc n'y répond pas
encore. C'est l'existence d'un autre banc qu'il faut voir.
`scripts/test-bascule-veilleur.ts`, douze contrôles.

**L'annonce n'affirme plus que l'adresse est joignable (10 août, tard).** Elle
écrivait « Ouvrable depuis un téléphone, telle quelle » alors que le port était
privé : le terminal affirmait le contraire de ce que le patron voyait. Ce module
ne peut pas le savoir — seul `diagnostiquer-banc.mjs` interroge l'adresse du
dehors. **Règle : ne rien affirmer qu'on n'a pas vérifié ; décrire la panne et
sa sortie.** Un contrôle échoue si la promesse revient.

**`npm run essai` dit maintenant qu'il est l'atelier (10 août, tard).** Le patron
l'a lancé sur son espace et a attendu plus de trois minutes sur la plus petite
route du dépôt : `next dev` compile chaque écran à l'ouverture, et le disque
d'un espace distant est lent. **Troisième fois** que cette lenteur coûte une
soirée, alors que `npm run banc` existe pour ça depuis deux fois. La règle qui
en sort : **une commande qui laisse prendre le mauvais chemin sans un mot vaut
un défaut.** Texte dans `scripts/annonce-atelier.mjs` (pas enfoui dans
`essai.mjs` : un message enfoui n'est jamais vu échouer), tenu par
`test-annonce-atelier.ts`. Il se tait en local, où l'atelier est le bon outil.

**Le port du banc, ouvert à chaque allumage (10 août, tard).** Le diagnostic du
patron a rapporté une page de connexion **GitHub** à la place d'Atlas :
`devcontainer.json` déclare le port public depuis le 6 août, mais ce fichier
n'est appliqué **qu'à la création** de l'espace, et le sien est plus ancien.
Troisième fois que ce piège coûte une soirée — le même qu'`ATLAS_BANC_ESSAI`
dans `docker-compose.yml`. **Une déclaration ne répare pas un espace déjà né :
tout correctif d'environnement doit être rejoué à chaque allumage**, dans
`.devcontainer/demarrer.sh`, qui descend avec le code. Fait par
`ouvrir-port.sh`, tenu par `scripts/test-ouvrir-port.ts` avec un faux `gh` —
`gh` n'existe pas dans l'espace de l'agent, et un contrôle qu'on ne peut pas
jouer ne prouve rien.

**Et attention au remède qu'on indique :** `gh` n'existe PAS dans ce conteneur
(image `typescript-node:22`), contrairement à l'image Codespaces par défaut. Le
premier message renvoyait vers `gh …` et le patron a reçu « command not found ».
Partout, c'est l'onglet **PORTS** de l'éditeur qui passe devant.

**La session fantôme, close et tenue par un test (10 août, tard).** Le remède
posé plus tôt dans la soirée fonctionnait sur le papier et **pas dans un
navigateur** : le contrôle écrit pour le tenir a trouvé trois défauts d'affilée.
Le détail est dans `CHANGELOG.md` du 2026-08-10 ; ce qui compte pour la suite du
travail, en trois points qui ne concernent pas que ce coin du code :

1. **Une redirection lancée depuis une PAGE ne peut pas être un 307.** Elle rend
   sous la frontière de `src/app/loading.tsx`, où l'enveloppe HTML est déjà
   partie : Next.js répond **200**, et le renvoi est joué en JavaScript. Vu à
   l'essai — 23 ko de page, `NEXT_REDIRECT` enfoui dans la charge React, pendant
   que le contrôle passait au vert. **Un contrôle d'accès qui doit valoir sans
   JavaScript vit dans le layout**, jamais dans la page.
2. **`NextResponse.redirect` renvoie vers l'adresse d'ÉCOUTE.** Elle fabrique une
   adresse absolue depuis `request.url`, soit `http://0.0.0.0:3000/…`. Derrière
   le relais du patron, elle ne mène nulle part — le remède l'aurait laissé
   devant une page blanche, comme le défaut. **Renvoyer relatif.**
3. **`no-undef` était éteint sur tout le JavaScript du dépôt.** `banc.mjs` lisait
   une variable `bati` qui n'existait pas : types verts, lint vert, et le banc
   mourait **après la construction**, une fois annoncé prêt. La règle est
   activée, avec les globales lues sur Node lui-même.

**Et un piège d'environnement, pas de code :** Redis démarré depuis un dossier
qui a ensuite disparu refuse toute écriture (`MISCONF … unable to persist`), et
sept suites échouent alors en accusant la taille des fichiers ou l'IA. Le
démarrer avec `--dir` sur un dossier stable.

**L'anneau muet et la pellicule, sur la fiche chantier (10 août, au soir).** La
ligne « Note vocale » devient un anneau qu'on touche pour écouter et qu'on
pousse vers le haut pour retirer ; les photos deviennent une pellicule dans le
tiroir du bas, case « + » en tête. `ARCHITECTURE.md` §49.

**Cinq choses à savoir avant d'y toucher :**

1. **Le compteur et l'onde sont réels**, pas décoratifs : `currentTime` pour
   l'un, un `AnalyserNode` sur l'élément audio pour l'autre. Le contexte audio
   naît **suspendu** et se rendort en arrière-plan — `resume()` à chaque appui,
   sinon l'onde mesure un silence qu'on a soi-même créé en intercalant
   l'analyseur.
2. **`display: flex` n'étire pas un `<button>`.** La maquette pose un
   `<label>` ; « Retirer » se retrouvait collé au bord gauche, **visible,
   touchable, et tous les contrôles au vert**. `width: 100%` est obligatoire ici.
3. **`--atlas-barre` est une réserve de place (68 px), pas la hauteur que la
   barre dessine (49 px).** Le tiroir mesure donc la barre réelle. Ne pas
   « corriger » la variable : cela déplacerait le cheveu du bandeau sur tous les
   écrans, dont l'accueil, que le patron a arrêté.
4. **Le jeu de démonstration contient de vrais fichiers** depuis ce lot (PNG et
   WAV fabriqués dans `seed.ts`). Avant, il déclarait des clés sans octets
   derrière : l'anneau restait inerte sans rien dire.
5. **Les cinq états se capturent en une commande** :
   `npx tsx scripts/capture-fiche-note-vocale.mts <dossier> <id-chantier>`.

**Le retrait est le même partout (10 août, au soir).** Le texte glisse vers la
gauche, « Retirer » se découvre, la ligne tombe, un tiroir la retient :
« Retiré à l'instant — Annuler ». Huit endroits, une seule mécanique là où il
y en avait trois.

**Quatre choses à savoir avant d'y toucher — les trois premières sont des
promesses, pas des détails :**

1. **Rien n'est écrit tant que le tiroir est ouvert.** La photo et la note
   vocale mettent leur fichier en file de purge dans la MÊME transaction que la
   suppression : appeler le serveur au moment du geste rendrait « Annuler »
   menteur — la ligne reviendrait, le fichier non. `useRetraits` masque la
   ligne et n'écrit qu'à la fermeture (minuteur, `pagehide`, démontage).
2. **Le fond ne glisse jamais.** Seule la colonne du texte bouge ; la date, le
   fil et la plage restent en place (`avant`, `plage`). Laisser la carte partir
   avec son fond la tire hors de l'écran, bordure tranchée — vu en capture sur
   le planning et les tarifs.
3. **« Annuler » vise le DERNIER retrait.** Un libellé unique pointant toujours
   la même ligne rendrait la première quand on retire la deuxième :
   l'annulation supprimerait.
4. **Les photos ne prennent pas le glissement**, et ce n'est pas un oubli : une
   vignette carrée n'est pas une ligne. Elles gardent le reste du geste et se
   retirent depuis la visionneuse.

**Et le piège qui a coûté une heure, sur du code juste :** une capture qui vise
`127.0.0.1` obtient une page **jamais hydratée** — Next refuse d'y servir ses
ressources de développement. Les boutons existent sans écouteur, on clique dans
le vide, et tout accuse l'écran. **Viser `localhost`.**

**Les corps d'Informations et de Prix sont refaits (10 août) — étape 2 de
`TODO.md` §7.** Reste l'étape 3 : Devis, Export, Facture.

**Avant de reprendre la refonte, quatre choses qui font gagner une heure :**

1. **Les deux voix sont des jetons**, plus des valeurs à retaper :
   `libelleCaps` et `texteSituation` dans `src/lib/design-tokens.ts`.
   `smallCaps` est l'ANCIENNE voix — un écran qui l'importe encore n'est pas
   refait, et elle ne survit que pour les maquettes `/design/*`.
2. **`innerText` rend le texte tel qu'il s'affiche.** Trois contrôles
   cherchaient « Prix Calculé » ou « Déjà au détail » et sont devenus rouges le
   jour où ces libellés sont passés en capitales — sans qu'aucun défaut
   n'existe. Deux l'étaient déjà avant ce lot. Avant de corriger le produit,
   regarder si le contrôle lit du **rendu** ou de la **donnée**.
3. **Prendre la capture, en haut ET en bas :**
   `npx tsx scripts/capture-etape.mts <dossier> <chantierId> <étape…>`.
   Les deux seuls défauts réels de ce lot n'étaient visibles que là : la croix
   qui retire une ligne de prix **sortait de l'écran** (elle existait dans la
   page, donc les contrôles la trouvaient), et la bulle de l'assistant mordait
   sur « Préparer le devis ».
4. **Le jeu de démonstration ne pose aucun brouillon**, et sa dictée ne
   s'analyse pas ici : pour regarder l'écran Informations plein, insérer soi-même
   une ligne dans `brouillons_informations`. Sinon on juge un écran vide.

**Les maquettes tiennent sur une seule page (9 août, tard).**
`docs/maquettes/toutes-les-maquettes.html` porte toutes les propositions et un
sommaire à ancres. **Ne pas la modifier à la main** : elle est engendrée par
`node scripts/fusionner-maquettes.mjs` à partir des fichiers numérotés voisins,
qui restent la source — une maquette neuve s'ajoute à la liste `MAQUETTES` du
script, et ses identifiants de gabarit à `IDS_A_PREFIXER`. Après toute
retouche, régénérer puis jouer `node scripts/verifier-maquettes-page-unique.mjs`
— il clique chaque titre dans un navigateur.

**Et surtout : ne pas repartager un sommaire de liens externes.** Une page
publiée s'exécute confinée et ne peut naviguer nulle part ; le patron a cliqué
huit fois dans le vide avant qu'on s'en aperçoive. Et lui envoyer les
**fichiers** plutôt que des adresses : un artefact lui demande de se connecter,
un fichier ne demande rien à personne.

**L'écran des chantiers est celui qu'il a retenu (10 août 2026) — c'est fait.**
Le fil, la perle, le trait d'or qui glisse, la feuille qui monte. **Avant d'y
toucher, lire l'en-tête de `src/app/EcranChantiers.tsx`** : il liste les trois
choses qu'il a explicitement refusées, et les remettre reviendrait à défaire ce
qu'il a validé.

**La perle se tient à mi-hauteur du fil, et descend sur le dernier jour quand on
arrive au bout.** Elle ne désigne PAS le chantier qui attend un geste — cette
intention est celle d'avant la maquette du 10 août, et l'avoir « restaurée » a
mis un point de couleur immuablement en bas de l'écran du patron. C'est écrit
trois fois maintenant (`ARCHITECTURE.md` §59, `docs/INTEGRER-ORIGINE.md` §3, ici)
parce que ça a été défait deux fois. La descente finale est la seule part
calculée (`src/lib/perle-descente.ts`) : `sticky` ne sait pas descendre pendant
que le contenu monte. Le contrôle qui tient l'ensemble — et qui MESURE au lieu
de constater une présence — est `npx tsx scripts/capture-accueil-perle.mts`,
serveur en écoute.

**Deux pièges de ce lot, qui coûteront une heure à qui les redécouvre :**
1. `npm run banc` **ne rebâtit que si le commit a changé**. Tant que le travail
   n'est pas commité, il ressert la version d'avant — et l'on mesure du code qui
   n'est pas sur le disque. `rm .next/atlas-version-batie.txt` force le rebâti.
2. Les suites base **abîment le jeu de démonstration** : après `npm test`, la
   connexion `demo@atlas.local` échoue jusqu'à un nouveau
   `DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:seed`.

**Le chemin qui y a mené**, si la question se repose : `docs/maquettes/`, de la
reproduction de sa première capture (01) jusqu'au fil en couleurs (11 à 13). La
charte retenue est **Origine** — celle que l'application portait déjà.

**Ce qu'il a explicitement refusé, et qui ne doit pas revenir :** le trait entre
ATLAS et « Bonjour Florian », la boîte autour d'un chantier, et toute couleur
qui ne désigne rien.

**La grammaire est portée par TROIS pièces partagées** — les toucher change
toute l'application d'un coup, et c'est voulu : `PrimaryButton` (27 écrans),
`EnTeteEcran` (nouveau) et les jetons de `src/lib/design-tokens.ts`
(`radius`, `cardShadow` qui vaut « none »). Ne pas recopier une allure dans un
écran : l'ajouter à ces pièces.

**Où en est la refonte, au 10 août au soir.** Faits : l'accueil, Planning,
Terminés, Réglages, le relevé de TVA, la fiche chantier, et les écrans d'étape
— tous à `EnTeteEcran`, aux jetons resserrés et au bouton commun. Les CORPS de
Photos, Note vocale, Informations et Prix le sont aussi. **Ce qui reste :** les
corps de **Devis, Export et Facture**.

**Un angle mort à connaître :** « les six écrans d'étape » ne comptaient pas
Informations, dont l'en-tête était donc resté à l'ancienne grammaire jusqu'au
soir du 10. Vérifier que **Transcription** ne dort pas dans le même angle mort
avant de déclarer la refonte finie.

**La fiche chantier sert de modèle** : en-tête commun avec `retour` et
`action`, intitulés en serif 19 px, lignes du dessous en capitales espacées,
séparateurs d'un cheveu, aucune pilule. Et deux règles tirées de l'étape 2 :
une **plage** occupe la largeur entière, une **action en toutes lettres**
s'aligne à gauche (`self-start`, sans quoi elle s'étire et se centre seule) ;
et une action en capitales espacées prend **deux fois** la place de la même en
bas de casse — c'est ce qui a chassé « Voir la transcription » de l'en-tête.

**Deux familles ne doivent PAS suivre**, et ce n'est pas un oubli : les
maquettes `/design/*` (découplées du produit) et les pages que le CLIENT reçoit
(`devis/[jeton]`, `factures/[jeton]`). Un devis n'est pas un écran.

**Une règle de charte, née de la 12 et qui vaut pour tout l'écran :** une
couleur qui ne veut rien dire est une couleur en trop. L'accent d'attente ne se
pose que sur ce qui réclame un geste du patron — nulle part ailleurs.

**Comment lui montrer une maquette. Deux règles, apprises à ses dépens.**

1. **Une maquette ne doit contenir AUCUN script.** C'est la vraie cause de
   *« Je ne peux pas ouvrir ça »*, répété trois fois : les maquettes 06, 10 et
   11 engendraient leurs écrans en JavaScript, la 09 est du HTML pur — et la 09
   est la seule qu'il ait ouverte, du premier coup, sur son téléphone. Son
   lecteur n'exécute pas les scripts. La garantie « rien ne diverge d'un écran
   à l'autre » se tient donc dans le script qui ÉCRIT la page
   (`scripts/engendrer-maquette-couleurs.mjs`), pas dans la page.
   **Les maquettes 03, 04, 05, 06 et 10 ont encore des scripts** : les
   convertir avant de les lui renvoyer.
2. **Lui envoyer aussi des images.** Une planche PNG s'affiche dans la
   conversation sans rien à ouvrir. Le fichier HTML complète, l'adresse d'un
   artefact ne suffit jamais.

**L'écran Chantiers est refait d'après une maquette du patron (9 août).** Il a
demandé une reproduction, pas une interprétation.

**Avant de toucher à l'écran d'accueil ou à la charte :** la charte a désormais
DEUX accents. Le vert pin porte ce qu'on fait (action principale, onglet actif),
l'or ce qu'on lit (salut, statuts, filets, sceau) — et sur les cartes, l'or
signale les états qui attendent un geste du patron. Les mélanger rend l'écran
bavard, c'est-à-dire l'aspect « tableau de bord » qu'il refuse.

Les mesures ne sont pas approximatives : filet 1 px, accent de bord 2 px, rayon
14 px, ombre 4 %, écart entre cartes 10 px. Et le conteneur du titre garde son
`overflow-hidden` — sans lui la branche élargit le document et la page glisse
latéralement. `npx tsx scripts/capture-accueil.mts <fichier.png>` prend les
captures et imprime la boîte de la barre basse. `ARCHITECTURE.md` §46.

**Le démarrage lance le serveur AVANT la mise à jour (9 août, au soir).** Son
journal s'arrêtait sur « migrations : faites » et rien n'écoutait : le lancement
venait en dernier, et `postStartCommand` était interrompu avant. Deux heures
perdues à chercher ailleurs.

**Avant de toucher à `.devcontainer/demarrer.sh` :** `lancer_veilleur` doit
rester AVANT `mettre-a-jour.sh`, et l'`exec bash "$0"` ne doit pas revenir —
c'était l'endroit exact où le démarrage mourait. Le code neuf prend effet par le
redémarrage du veilleur, pas par une relance du script. Éprouvé en tuant le
démarrage à cinq secondes. `ARCHITECTURE.md` §45.

**Le banc sert une version BÂTIE, plus un serveur de développement (9 août).**
Après dix-sept heures de 504, 404, 502 et ports en conflit, le patron : *« On
arrête de tourner en rond, corrige-moi ça une bonne fois pour toutes. »* Tous
ces symptômes venaient de `next dev`, qui compile chaque écran à l'ouverture.
Mesuré après : **36 à 80 ms par écran** contre 38,7 s.

**Avant de toucher au démarrage du banc ou à `src/server/env.ts` :**
`npm run banc` bâtit puis sert (repli sur `next dev` si la construction échoue).
`next start` impose `NODE_ENV=production` : le profil `ATLAS_PROFIL=banc`
(`src/profil-banc.ts`, posé par `demarrer.sh`) relâche **exactement deux
choses** — IA simulée et stockage local. AUTH_SECRET, CRON_SECRET, Redis restent
exigés, l'isolation ne bouge pas. Quatre fichiers en dépendent : la
configuration, le proxy, l'environnement, Auth.js. `ARCHITECTURE.md` §45.

**Et `npm run verifier:connexion` monte maintenant `npm run banc`**, pas
`npm run essai` : c'est lui, et lui seul, qui a trouvé `UntrustedHost` — Auth.js
refusant l'hôte du mandataire en production, pendant que l'artisan lisait « Une
erreur ». Éprouver autre chose que ce qu'on livre, c'est ne rien éprouver.

**Une page d'état lisible au téléphone (9 août).** *« Va regarder toi-même, je
peux pas te l'envoyer. »* Il travaille au téléphone ; le terminal de l'éditeur
ne lui est pas offert, et je n'ai aucun accès à son espace.

**Avant de diagnostiquer un banc muet :** lui faire ouvrir
`<adresse>/api/health/banc`. Elle répond sans session, sans base, en quelques
millisecondes, et donne la version exécutée, l'avancement du préchauffage et ce
qui bloque. `ARCHITECTURE.md` §44.

**La cause première du 404, et elle était là depuis le début (9 août).**
`npx next dev` n'est qu'une pile d'enveloppes : le processus qui écoute se
**renomme** `next-server`. Le `pkill -f "next dev"` du démarrage tuait donc les
enveloppes et laissait le vrai serveur orphelin, accroché au port — le suivant
ne pouvait plus s'y attacher, et l'orphelin servait un cache périmé : toutes les
pages en 404, santé comprise.

**Avant de toucher à un `pkill` dans ce dépôt :** viser `[n]ext(-server| dev)`,
jamais `next dev` seul. Et ne jamais mettre le motif et une occurrence littérale
dans la même commande — le shell qui la porte se tue lui-même (arrivé deux fois
en une soirée). `ARCHITECTURE.md` §44.

**Le banc se relève seul, et compile ses écrans d'avance (9 août).** Le patron
a lu deux pages d'erreur coup sur coup, et **aucune n'était une lenteur** :
« HTTP ERROR 504 » parce que `next dev` compilait l'écran pendant qu'il
attendait (38,7 s pour `/termines`, 373 ms ensuite), et « HTTP ERROR 404 »
parce que **le serveur était mort** — sur cette adresse, 404 veut dire « plus
rien n'écoute ».

**Avant de toucher au démarrage du banc :** `.devcontainer/demarrer.sh` ne lance
plus le serveur, il lance `.devcontainer/veiller.sh`, qui le relance quand il
tombe. Le veilleur exige **deux** conditions (santé muette ET aucun `next dev`)
— sur la seule santé, une grosse compilation ferait lancer un second serveur qui
tuerait le premier. `scripts/prechauffer.mjs` compile ensuite seize écrans, à la
file, avec une session **fabriquée** et non ouverte par le formulaire : le
limiteur autorise cinq connexions par quart d'heure et par adresse IP, et
quelques redémarrages auraient verrouillé le patron hors de son application.
Jamais en production. `ARCHITECTURE.md` §44.

**L'application ne pouvait pas être bâtie (9 août).** Il s'inquiétait de la
lenteur ; pour lui répondre avec des chiffres il fallait une version optimisée —
et `npm run build` échouait. `next build` se déclare `NODE_ENV=production`,
`src/auth.ts` lit le secret de session dès l'import, et **tous** les refus de
`src/server/env.ts` tombaient pendant la compilation. Bâtir exigeait une clé
d'IA facturée, un compartiment S3 et un secret de tâche planifiée : personne ne
l'avait donc jamais fait.

**Avant de toucher à `src/server/env.ts` :** les refus sont suspendus pendant la
construction **et pendant elle seule** (`NEXT_PHASE`). `scripts/test-env.ts`
l'éprouve dans les deux sens, et le second cas est le plus important —
construction acceptée sans aucun secret, **exécution et démarrage du serveur
bâti toujours refusés**. Sans lui, `NEXT_PHASE` serait un interrupteur ouvrant
toutes les protections de production. `ARCHITECTURE.md` §43.

**Les chiffres, enfin mesurés** (version bâtie, 4 cœurs) : démarrage 212 ms,
écrans entre 50 et 100 ms, première ouverture au même prix que la deuxième.
Non mesurés, et dits comme tels : les PDF et la dictée.

**Les migrations du banc tournaient sous le mauvais rôle, en silence (9 août).**
`atlas_app` n'a aucun droit de DDL : elles échouaient à chaque mise à jour, et
les deux appelants avalaient l'échec. Le patron voyait « Mise à jour
récupérée », puis un écran tombait sur une table absente.

**Avant de toucher à la mise à jour du banc :** les migrations passent par
`.devcontainer/appliquer-migrations.sh`, et **par lui seul** — un contrôle
interdit de relancer `db:migrate` ailleurs, parce que c'est par là que le
mauvais rôle reviendrait. Le script choisit `DATABASE_ADMIN_URL` puis
`DATABASE_URL`, et rend « faites » ou « échec : <ce que la base a répondu> ».
`ARCHITECTURE.md` §42.


**La note vocale lit un numéro sans qu'on l'annonce (9 août).** Il signalait que
sans dire « numéro de téléphone », rien n'était reconnu. **Le défaut n'était pas
celui-là** : la transcription écrit parfois les chiffres en toutes lettres, et
aucune recherche de chiffres ne pouvait les voir. Son annonce ne faisait que
déclencher le rattrapage du modèle de langue.

**Avant de toucher à `src/lib/nombres-dictes.ts` :** deux régimes de lecture, et
c'est la transcription qui choisit. Avec traits d'union, on la suit mot à mot
(elle a déjà découpé) ; sans aucun tiret, on recolle au plus long. Inverser
l'un des deux casse l'autre — les deux ont été mesurés sur des dictées réelles.
70 et 90 n'acceptent pas d'unité derrière eux, et « cent » est délibérément
absent du vocabulaire reconnu. `ARCHITECTURE.md` §40.

**Deux défauts trouvés en cherchant le sien, tous deux du même genre** — un
champ faux mais crédible plutôt qu'un champ vide : `0033 6 12 34 56 78` rendait
`0336123456`, et « florian tiret martins arobase… » rendait `martins@gmail.com`.
C'est la forme de défaut la plus coûteuse du produit : personne ne relit un
champ qui a l'air juste.


**Les identifiants Google se saisissent DANS l'application (9 août).** Écran
« Mon agenda », trois cases. Ceux de l'entreprise priment sur les variables
d'installation, qui restent en repli. **Trois règles à ne pas défaire** :
« configuré » n'est pas « relié » (entre le collage et le retour de Google, rien
n'est autorisé) ; changer d'identifiants efface les jetons (ils appartiennent à
l'autre projet Google) ; un secret vide conserve l'ancien (Google ne le remontre
jamais). `ARCHITECTURE.md` §41.

**L'agenda lit aussi les intitulés (9 août).** La portée est passée de
`freebusy` à `events.readonly` sur sa demande. **Ce qui n'est pas négociable :**
l'intitulé est FACULTATIF dans `PeriodeOccupee` et n'entre dans aucun calcul —
c'est ce qui garantit qu'il ne peut pas se glisser vers la page du client, qui
ne reçoit que des dates. Attention aux trois pièges d'`events.list` :
`singleEvents` pour déplier les séries, la fin exclusive des événements « toute
la journée », et les événements annulés ou « disponible » à écarter.

**L'agenda extérieur, au choix de l'artisan (9 août).** Atlas peut tenir compte
d'un agenda Google, si l'artisan le relie. **Avant ce lot, un rendez-vous noté
ailleurs était invisible** : Atlas proposait ce jour-là et le client le
choisissait.

**Trois choses à savoir avant d'y toucher :**

1. **Une seule carte d'occupation.** Les rendez-vous se fondent dans la même
   `Map` que les chantiers (`fusionnerOccupationExterne`), et les quatre chemins
   qui décident ensuite la lisent sans savoir d'où vient l'occupation. **Ne
   jamais ajouter un second calcul à côté** — c'est ce dédoublement qui avait
   rangé un chantier dans deux onglets à la fois. `ARCHITECTURE.md` §39.
2. **Le client passe par là aussi**, parce que c'est lui qui retient la date.
   Ses deux chemins publics dérivent l'entreprise du **jeton**, et lisent
   l'agenda AVANT d'ouvrir leur transaction — un appel HTTP dans une transaction
   immobiliserait une connexion du pool pendant une panne de Google.
3. **Ce qui n'est pas éprouvé, et pourquoi.** L'aller-retour réel avec Google —
   autorisation, échange du code, renouvellement — n'a pas pu l'être : pas de
   compte ici, et le mandataire refuse Google. Tout ce qui décide a été sorti de
   ce chemin exprès ; il ne reste que trois appels HTTP. Cela se vérifiera chez
   le patron, avec ses identifiants (`docs/A-FAIRE.md` §7).

**Deux pièges rencontrés, à ne pas repayer.** Un module `"use server"` ne peut
exporter QUE des fonctions asynchrones : une constante y fait perdre **tous** les
exports du fichier, types et lint verts, écran mort. Et le titre de l'écran
mentait — cas de panne traité après le cas nominal ; la phrase vit maintenant
dans `titreEtatAgenda()`, une fonction pure, avec son contrôle.


**Le vocabulaire d'un vrai devis d'élagueur (9 août).** Huit règles de rédaction
et dix-neuf mots du métier, tirés de six documents d'un confrère —
`termes_metier` en compte vingt-sept.

**À savoir avant d'en ajouter, et c'est mesuré, pas supposé :** la consigne
envoyée avec chaque dictée a un budget de **9 000 caractères**, dont un quart est
RÉSERVÉ à ses corrections. Tout tient aujourd'hui — 8 512 caractères, 27 termes
sur 27, 5 corrections sur 5 — mais il n'y a plus qu'environ cinq cents
caractères de marge. **Le prochain qui ajoute du vocabulaire doit remesurer**
(`construireConsigneMetier(termes, corrections)` rend `termesRetenus` et
`ecartes`) : au-delà, des termes repartent au vestiaire en silence pour qui ne
regarde pas. L'ordre des termes décide de qui part : d'abord ce qui change un
prix ou crée une ligne détachable. `ARCHITECTURE.md` §37 et §38.

**Et une leçon qui n'est pas technique** : la définition « le gros bois se débite
en 40 ou 50 cm » a été écrite le matin à partir de deux exemples, et démentie
l'après-midi par un devis à 33 cm. Deux occurrences ne fondent pas une
énumération — un champ sans source fiable reste ouvert (`docs/AGENT.md` §3).

**Un calendrier des deux côtés (9 août).** Le client ne peut plus choisir un jour
déjà pris — il est barré et ne répond pas. Le patron a le même : ses journées
prises sont barrées sur **douze mois** (`HORIZON_OCCUPATION_PATRON_JOURS`, 365
jours), alors qu'il peut proposer une date jusqu'à **dix-huit mois**
(`HORIZON_PATRON_JOURS`, 550 jours) — deux horizons distincts, ne pas les
confondre. Un seul composant sert les deux écrans, et il ne décide de rien : tout
vient de `src/lib/calendrier.ts`. **L'ordre des raisons dans `etatDuJour` n'est
pas indifférent** — un jour hors fenêtre ne doit jamais se dire « déjà pris »
chez le client, sinon sa page laisse filtrer le planning. `ARCHITECTURE.md` §36.

**Une règle de travail, avant tout le reste :** les suites navigateur tournent
sous un rôle qui **traverse la RLS**, donc elles ne peuvent pas voir un défaut
d'isolation. Le 8 août, le lien de facture et le PDF du devis étaient morts en
production — vus par hasard, jamais par un contrôle. **Tout chemin public par
jeton s'éprouve dans une suite base, sous `atlas_app`**
(`scripts/test-facture-jeton-rls.ts`). `ARCHITECTURE.md` §34.

**Du planning à la facture, sans détour.** Le patron ne pouvait pas atteindre le
devis d'un chantier planifié : toucher sa carte n'ouvrait qu'un sélecteur de
date. Elle mène maintenant au chantier et porte un bouton « Fin de chantier ».

**À savoir avant de toucher au rangement des chantiers :** la règle vit dans
`src/lib/onglet-chantier.ts` et **nulle part ailleurs**. Elle y était déjà, mais
seul l'écran Chantiers l'appelait — le planning et le dépôt des terminés en
gardaient chacun une copie, avec un signe d'écart. Résultat : un chantier prévu
aujourd'hui dans deux onglets, et un chantier clôturé avant sa date dans aucun,
sa facture perdue de vue. Ne jamais recopier ce filtre dans un écran : trois
portes existent (`ongletDuChantier`, `ongletDepuisJalons`, `estAuPlanning`),
elles couvrent les trois formes de donnée. `ARCHITECTURE.md` §33.

**Trois grilles de prix, et son devis de référence enfin juste.** Il a répondu
le 8 août au soir : on garde les 8 × 6 tranches du fendage, la haie prend sa
ligne avec un prix au mètre, l'abattage a sa grille à la technique × le
diamètre. Son devis du 5 août — haie 350, abattage 600, fendage 300 — sort
maintenant tel qu'il l'avait écrit. **La règle à connaître avant de toucher au
chiffrage :** dès que la ligne principale a un prix de grille, le total devient
la somme des postes au lieu du tarif à la journée (`ARCHITECTURE.md` §32).

**Il peut déposer sa liste de prix Excel ou CSV**, au lieu de la retaper :
`Réglages → J'ai déjà mes prix ailleurs`. Lue sans aucune bibliothèque, et
surtout **montrée avant d'être écrite** — ce qui s'ajoute, ce qui change, ce qui
n'a pas été compris. Le PDF est refusé, à dessein : voir `TODO.md` §0 sexies
avant de le reproposer.

**Le patron peut proposer une date à dix-huit mois.** Il ne pouvait proposer que
les six prochains jours ouvrés — il l'a signalé avant que ça ne lui coûte un
client. Deux horizons désormais, et **ne pas les confondre est la décision qui
compte** : le sien va à dix-huit mois, celui du client reste à trois mois ou à
trois semaines autour de la date proposée. La page publique reçoit la liste des
jours occupés ; lui ouvrir dix-huit mois reviendrait à lui donner le carnet de
commandes. Voir `ARCHITECTURE.md` §30.

**Le devis se découpe enfin en lignes vendables.** C'est le défaut que le patron
a signalé trois fois en deux jours — *« tout ce que je dicte arrive sur la même
ligne »* —, et qui avait survécu à un diagnostic sans correction. L'abattage, le
broyage et l'évacuation vont ensemble ; la fente fait sa ligne ; le billonnage
n'en fait aucune ; il n'y a plus de point-virgule. La règle est pure et éprouvée
sur ses dictées : `src/lib/lignes-vendables.ts`.

Avec elle, **sa grille de prix pour fendre le bois** : hauteur de l'arbre ×
diamètre du tronc, 8 × 6 cases, **née vide**. Aucune case ne se devine depuis ses
voisines — une case vide est une question posée. Elle se remplit à la main
(`Réglages → Mes prix pour fendre le bois`) et toute seule, à chaque prix de
fente écrit sur un vrai devis. Voir `ARCHITECTURE.md` §29, et `TODO.md`
§0 quinquies pour les trois questions restées ouvertes — **notamment les bornes
des tranches, faciles à changer aujourd'hui, coûteuses après trente devis**.

Avant cela : le parcours **devis → réponse du client → chantier → facture →
TVA**, de bout en bout, avec ses trois points d'arrêt. Plus le suivi de ce que devient un devis une
fois parti : en attente, à relancer, caduc, retourné, accepté.

Et, en dernier lieu, **le devis PDF** : il reproduit désormais
`appli/devis-modele.html`, le modèle que le patron avait construit lui-même pour
Arborea. C'est le seul document que son client reçoit, et ce n'était pas le sien.
Voir `ARCHITECTURE.md` §16 pour les choix, dont la trace qui rend la mise en page
vérifiable.

**Et, en dernier, le patron peut emporter ses données.** `Réglages → Télécharger
mes données` produit un ZIP : les vingt-trois tables de son entreprise, ses
photos, ses enregistrements, ses PDF, et un mode d'emploi. Ce n'est pas un
confort — c'est la condition qu'il a posée lui-même avant de nourrir la mémoire
de l'agent : *« le jour où je mets ça en ligne, est-ce que je perds toute la
mémoire ? »* Voir `ARCHITECTURE.md` §26 pour les choix, dont ce qui a été
écarté (`pg_dump`, un privilège d'export, une bibliothèque d'archivage).

La sauvegarde **automatique**, elle, reste bloquée sur le choix d'un hébergeur :
elle a besoin d'une destination extérieure. Ne pas la reproposer sans lire
`TODO.md` §0(b).

**Et une correction qui change la façon de travailler ici.** Le dépôt affirmait
que la batterie base de données ne pouvait pas tourner dans l'environnement de
l'agent. C'est faux : Docker manque, pas PostgreSQL ni Redis.

```bash
source scripts/monter-base-locale.sh   # cluster, rôles, Redis, migrations
npm test
```

Croire l'inverse a fait dire trois fois « c'est la CI qui vérifiera » alors que
la CI n'avait jamais tourné. **Jouer la batterie avant de livrer**, sans
attendre.

**Et, avant cela, l'IA.** La production refuse désormais de démarrer sur l'IA
simulée — c'était le dernier repli silencieux vers un comportement de
développement que `src/server/env.ts` laissait passer. Au passage, les tarifs
des fournisseurs se relèvent maintenant à leur source depuis une machine GitHub
(`relever-tarifs-ia.yml`), le réseau de l'agent les refusant : un mois d'Atlas
au volume du patron coûterait **2 à 8 $**, transcription comprise.

Détail dans `CHANGELOG.md`, état complet dans `PROJECT_STATE.md`.

**Et, en dernier lieu, l'esthétique — sur maquettes, pas dans le code.** Le
patron a arrêté **cinq** choix le 2026-08-10 : la charte **Origine** (ivoire et
bronze, qui remplace le vert pin d'Arborea), le **trait G** au bandeau, la
**perle** qui suit le défilement, l'**écran qui recule** à l'ouverture de
« Nouveau chantier », et le **tiroir des retirés** pour supprimer une ligne.

S'y ajoutent, le même jour, deux écrans : le **planning** (le mois, les
demi-journées, une ligne par équipe) et **Réglages · vos équipes**. Ce dernier
porte une règle à ne pas défaire : **à une seule équipe, le planning n'écrit
aucun nom d'équipe** — le patron l'a demandé mot pour mot. À deux et plus, le
champ vide affiche déjà « Équipe A » en gris. On n'invente jamais un nom, et on
ne laisse jamais deux lignes indiscernables (`docs/INTEGRER-ORIGINE.md` §6 ter).

**Ce paragraphe décrivait un état révolu, et le laisser tel quel aurait coûté :**
au 10 août la refonte n'était que sur maquettes, mais elle est **portée dans
l'application depuis le 11 août 2026** — `design-tokens.ts` est en Origine, le
fil, la perle, le tiroir des retirés et le bandeau y sont. Une conversation qui
lirait « rien n'est encore codé » referait le travail. Le détail est dans
`PROJECT_STATE.md` et `CHANGELOG.md` ; `docs/INTEGRER-ORIGINE.md` reste la
spécification d'origine, pas l'état du code.

Deux contraintes à ne pas redécouvrir : **les maquettes envoyées au patron ne
doivent contenir aucun JavaScript** (son lecteur n'en exécute pas — les pages
engendrées en script lui arrivaient vides), et **il faut regarder les captures**.
Sur ce lot, quatre défauts se sont vus à l'écran et aucun aux contrôles : des
cases à cocher bleues d'iOS en pleine page ivoire, une ligne d'en-tête effacée
par une classe homonyme, un nom coupé en plein mot par le glissement, et
« CHANTIERS » qui touchait « PLANNING ».

## Où reprendre

**`TODO.md` §0 bis — l'agent qui apprend. Le patron l'a demandé expressément le
6 août 2026 :** *« Ok, garde ça en mémoire et on fera ça après. N'oublie pas de
le faire. »*

Ce n'est donc pas une liste d'idées : c'est le prochain travail, et il ne doit
pas avoir à le redemander. Dans l'ordre — l'**entretien de départ**, l'**écart
devis / facture**, puis **photos ↔ prix**. Le rapport entre techniques (×1,67,
×2,33) vient après, quand `lecons_prix` aura de quoi le calculer.

Ce qui est déjà fait de cette série : le tapis roulant, l'arrêt d'avant-chiffrage
(§0 ter) et la mémoire des corrections (§0 quater).

Le reste de `TODO.md` ensuite. L'**agenda Google** est partiellement bloqué : la
connexion du compte demande des identifiants que le patron doit fournir.

**Avant de proposer autre chose,** lire `docs/A-FAIRE.md` : **cinq** points
bloquent un usage réel et **aucun ne s'avance en codant**. Ne pas les
redécouvrir ni les reposer au patron : ils sont écrits, avec leur coût et leur
propriétaire.

Le dernier arrivé est le point 6, **choisir l'outil qui émet les factures**
(8 août 2026). Deux choses y sont à ne pas confondre. La première est acquise
et ne se rouvre pas : **Atlas prépare les factures, il ne les émet pas au sens
légal** — `docs/AGENT.md` §6, acté le 31 juillet, « hors périmètre
définitivement ». Ce qui est ouvert, c'est seulement *sur quel outil se
brancher*, et le patron n'en a aucun à ce jour. Tant que le choix n'est pas
fait, écrire du code de branchement serait écrire du code à jeter.

Le cinquième — brancher un fournisseur SMS et e-mail — a été **tranché le
2026-08-04 : il n'y en aura pas.** Le devis part de la messagerie du patron.
Lire `ARCHITECTURE.md` §13 avant de proposer quoi que ce soit sur l'envoi : deux
choses y sont écartées **pour de bon**, un prestataire d'envoi et la pièce
jointe au message. Les reproposer serait rouvrir un débat déjà clos.

---

## Ce qu'il faut savoir avant de toucher au code

### La règle qui prime : éprouver avant d'acter

Rien ne se déclare valide sans avoir été parcouru en entier, dans les conditions
du patron. Trois bancs d'essai livrés « prêts » ont échoué chez lui alors que le
code était juste. Le détail est dans `AGENTS.md`, en tête — et il est lu à chaque
conversation. Ce qui ne peut pas être éprouvé ici part en CI :
`banc-essai.yml` monte l'espace de travail et s'en sert, `pages.yml` vérifie le
site publié à son adresse réelle.

### Les vingt-deux pièges de ce dépôt

0. **Une action serveur refusée ne dit rien d'utile.** Next.js compare `Origin`
   à l'hôte : derrière un proxy (Codespaces), ils diffèrent et TOUTE action est
   rejetée — connexion comprise — avec pour seul message « Invalid Server
   Actions request. ». Aucune suite ne le voit : elles interrogent toutes
   `127.0.0.1`, où les deux coïncident. C'est le rôle de
   `scripts/verifier-connexion.mjs`, qui pose exprès une origine étrangère.
0 ter. **Le message d'une exception levée par une action serveur N'ARRIVE PAS
   jusqu'à l'écran du patron.** Next.js le remplace en production par un
   identifiant opaque, et le banc sert une version bâtie : un code qui affiche
   `err.message` en croyant montrer la cause ne montre qu'un digest. C'est le
   piège qui a rendu « Impossible d'enregistrer la note » indéchiffrable le 11
   août 2026. **Tout refus attendu se rend en valeur de retour** —
   `{ ok: false, raison }` — jamais en exception ; les pannes imprévues lèvent,
   mais se journalisent AVANT (`logger.error`), sans quoi elles ne laissent
   aucune trace nulle part. Le cadre le prescrit noir sur blanc :
   `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`.
0 bis. **Les fabriques d'IA retombent sur `dev` par leur `default:`.** Une faute
   de frappe dans `LLM_PROVIDER` ou `TRANSCRIPTION_PROVIDER` donnait donc l'IA
   simulée, sans un mot, et la dictée rendait « [Transcription simulée — … ] ».
   `src/server/env.ts` refuse maintenant de démarrer en production sur un nom
   inconnu, sur « dev », ou sur un fournisseur privé de sa clé. En développement
   rien ne change : le mode simulé y est le fonctionnement normal — mais l'écran
   `Réglages` dit désormais lequel des trois états s'applique (`src/lib/etat-ia.ts`),
   parce qu'un refus muet vaut moins qu'un refus qui s'explique.
1. **Une requête hors `withEntreprise()` ne renvoie rien, silencieusement.** Pas
   d'erreur : zéro ligne. Un traitement qui ne trouve rien à faire paraît
   fonctionner. C'est déjà arrivé une fois (la purge d'audio).
2. **Un devis envoyé et une facture émise sont immuables**, par trigger
   PostgreSQL. Toute correction passe par une nouvelle version ou un avoir.
3. **Le relevé de TVA n'est pas stocké**, il se recalcule. Sa stabilité dépend du
   point 2 : casser l'un casse l'autre.
4. **Ne jamais formater une date via `new Date(iso)`.** Utiliser
   `src/lib/jour.ts`. Le décalage de fuseau affiche « dimanche 22 » pour un
   chantier calé le lundi 23.
5. **Les suites de bout en bout tournent sous un rôle qui traverse la RLS** parce
   qu'elles inspectent la base. Les suites de dépôt, non — c'est ce qu'elles
   démontrent.
6. **Une suite `scripts/test-*.ts` s'exécute en CommonJS** : pas d'`await` au
   premier niveau, sinon esbuild refuse le fichier entier. Envelopper dans
   `async function main()` puis `main().catch(...)`, comme les suites voisines.
   Un script de mise au point qui a besoin de l'`await` de premier niveau prend
   l'extension `.mts` — et n'est alors plus découvert par le lanceur.
7. **Un fichier `"use server"` n'exporte que des fonctions asynchrones.** Y
   exporter une classe, une constante ou un type annule **tous** les exports du
   module : l'application entière répond 500, et **ni `tsc` ni `eslint` ne le
   voient**. Le message ne parle même pas du coupable — il dit qu'un autre
   fichier importe une action « qui n'existe pas ». Les règles métier et les
   classes d'erreur vivent dans `src/lib/`, jamais dans un fichier d'actions.
8. **Un PDF ne connaît que WinAnsi.** Les polices standard de pdf-lib refusent
   tout caractère hors de cet encodage, et l'appel échoue sur la ligne entière.
   L'espace fine insécable (U+202F) que `toLocaleString('fr-FR')` glisse dans
   « 1 400,00 € » en fait partie : utiliser l'insécable ordinaire (U+00A0), qui,
   elle, existe. Le symbole € passe, les accents aussi.
9. **L'analyse d'une dictée jette ce qu'elle ne sait pas classer, sans le dire.**
   `src/server/orchestrateur/analyse-demande.ts` ne comprend rien : il découpe.
   Un segment mal découpé ne produit pas d'erreur — il produit un écran plus
   court, que personne ne peut distinguer d'une dictée pauvre. Le patron y a
   perdu une prestation et trois machines d'un coup. D'où l'invariant que tient
   `scripts/test-analyse-dictee.ts` : **aucun mot dicté ne disparaît**, et la
   liste des mots qu'on s'autorise à absorber est écrite en toutes lettres dans
   la suite. Toucher au découpage sans relancer cette suite, c'est refaire le
   défaut. Corollaire éprouvé : dans ces expressions rationnelles, les
   frontières de mot ne sont pas décoratives — sans `\b`, `jours?` se déclenche
   à l'intérieur de « journée » et ampute le segment.
10. **Un état d'écriture qui vit dans le navigateur ment au premier retour
    arrière.** « Ajouté au détail » était un `useState` : il mourait à chaque
    navigation, l'écran reproposait une ligne déjà écrite, et un seul appui
    doublait le devis du patron (1 674 € → 3 348 € HT). La règle : **tout ce qui
    dit « c'est déjà fait » se déduit des données, jamais d'un drapeau local** —
    et le serveur applique la même fonction, parce qu'un écran ne protège rien.
    Motif à réutiliser : `src/lib/proposition-au-detail.ts`.

11. **Le planning ne se lit plus en jours pleins.** Un jour porte deux
    demi-journées, chacune tenant autant de chantiers que l'entreprise a
    d'équipes (`ARCHITECTURE.md` §22). Deux conséquences à ne pas défaire : un
    chantier planifié **avant** la migration 0019 n'a ni créneau ni durée et
    doit continuer d'occuper la journée entière — le relâcher rendrait
    proposables des après-midis déjà pris ; et le **week-end reste retenable**,
    il n'est qu'exclu des jours *suggérés*, parce qu'un client peut demander un
    samedi. Avoir confondu les deux a cassé deux suites d'un coup.

12. **Une donnée enregistrée n'est pas une donnée montrée.** `precision_client`
    existait depuis le premier jour, le client y écrivait, et **aucun écran ne
    l'affichait**. Le patron lisait « le client n'a pas donné suite » sans jamais
    savoir qu'on lui avait écrit « le devis comprend une faute ». Rien ne le
    signalait — ni erreur, ni test : le champ était simplement absent de toutes
    les requêtes. Avant d'ajouter un champ que l'utilisateur remplit, écrire le
    contrôle qui vérifie qu'il **ressort** quelque part
    (`scripts/test-correction-devis.ts`).

13. **Une règle juste que l'écran n'applique pas ne protège personne.**
    `lienTransmission()` composait `sms:0679…` correctement, et sa suite était
    verte ; l'écran, lui, passait par `navigator.share`, qui sur iPhone ne
    transmet **qu'un texte** — le patron ouvrait Messages avec un champ « À : »
    vide. Deux leçons à ne pas défaire : ce que la page **propose réellement**
    se contrôle à l'endroit où le patron appuie (`test-transmission-e2e.ts`), et
    une adresse portée par un `href` est **lisible dans la page**, donc
    vérifiable — c'est pour cela que c'est un `<a>` et non un
    `window.location.href`. Corollaire trouvé par ce contrôle neuf : l'écran
    lisait la coordonnée dans **l'instantané figé du devis**, si bien qu'une
    adresse tout juste saisie n'apparaissait jamais. Une donnée que
    l'utilisateur vient d'écrire se relit sur la **fiche vivante**.

14. **Des maillons tous verts ne font pas une chaîne.** Brouillon,
    confirmation, chiffrage, ligne de prix, devis : chacun avait sa suite, et
    chacune passait. Aucune ne les parcourait **à la file** — et le parcours, lui,
    ne menait nulle part : cinq gestes sur quatre écrans, dont aucun ne menait au
    suivant, avec un devis à 0,00 € au bout si l'un était oublié. Le patron l'a
    dit deux fois avant qu'on l'entende. Quand un lot ajoute une étape à un
    parcours, la suite qui compte est celle qui va **du premier écran au
    dernier** (`test-devis-depuis-dictee-e2e.ts`). Corollaire de conception :
    quand deux chemins font la même chose, la règle sort dans un service et les
    deux l'appellent — `confirmerBrouillon()`, `appliquerPropositionPrix()` — car
    c'est le chemin le moins relu qui garde le vieux défaut.

15. **Un service qui ne sait pas échouer proprement bloque tout le reste.**
    `JSON.parse(reponseDuModele)` sans filet : une réponse encadrée en
    ```` ```json ```` suffisait à afficher « Réponse du fournisseur non conforme
    (JSON invalide). » et à arrêter net le chantier du patron. Deux règles en
    sont sorties : **tolérer l'emballage, jamais le fond** (le schéma reste seul
    juge), et **ne jamais laisser l'utilisateur devant rien** — ici, la dictée est
    relue mot à mot, sans réseau ni clé. Un repli doit se **dire** : le brouillon
    porte `lecture = 'litterale'` et l'écran l'annonce, sans quoi le patron relit
    une recopie en la croyant analysée.

16. **Un espace de travail ne récupère jamais le code neuf tout seul.** Le
    patron a réessayé, un jour plus tard, des correctifs livrés la veille, et
    conclu qu'ils ne marchaient pas. Trois échanges perdus sur des défauts déjà
    réparés. Depuis : `.devcontainer/mettre-a-jour.sh` avance à chaque allumage
    (jamais en écrasant du travail non enregistré, jamais en forçant), et
    **l'application affiche sa version dans les Réglages**. Règle générale :
    avant de chercher un défaut qu'un correctif devait fermer, **demander la
    version** — une capture de l'écran Réglages y répond.

17. **Une configuration par défaut qui ignore ce qu'on lui donne.** Le patron
    avait posé ses clés Anthropic et OpenAI ; l'IA restait débranchée, et rien
    ne disait pourquoi. `LLM_PROVIDER` valait `dev` par défaut, le conteneur
    d'essai écrivait `dev` en dur sans transmettre les clés, et le fournisseur
    OpenAI n'était qu'une ébauche répondant « non implémenté » — trois causes
    cumulées, aucune visible. Trois règles en sont sorties, à ne pas défaire :
    **une variable vide vaut une variable absente** (`?? défaut` ne rattrape pas
    la chaîne vide, et un conteneur transmet volontiers `${X:-}`) ; **ce qui ne
    figure pas dans `.devcontainer/docker-compose.yml` n'existe pas dans le
    conteneur**, secrets compris ; et **une ébauche ne se fait jamais passer
    pour un fournisseur** — elle est refusée à la configuration, pas au premier
    appui du patron. L'état réel se lit désormais à l'écran Réglages, au
    démarrage, et par `npm run verifier:ia` (`ARCHITECTURE.md` §26).

    *Corollaire sur les données :* la protection ne tient plus à une valeur par
    défaut mais à **l'absence de clé**. C'est pourquoi la batterie retire les
    clés d'IA de toute étape qui exécute le produit — **et pose
    `LLM_PROVIDER=dev` explicitement** : retirer les variables ne suffit pas,
    Next.js charge `.env.local` de lui-même, et c'est justement là que le patron
    est invité à coller les siennes.

    *Corollaire sur l'espace d'essai :* un conteneur construit avant le
    correctif garde l'ancien réglage figé. `.devcontainer/reglage-ia.sh` le
    neutralise plutôt que d'exiger une reconstruction — introuvable sur un
    téléphone.

    *Et le piège du remède :* `.env.local` est désormais écrit d'avance, **vide**,
    pour que le patron n'ait qu'à coller ses clés. Le charger naïvement
    (`set -a ; . .env.local`) écrase alors avec du vide les clés venues des
    secrets de la plateforme — le correctif recréait le défaut. Une seule règle
    de chargement, dans `.devcontainer/charger-cles.sh` : rien de vide n'est
    exporté, et ce qui existe déjà l'emporte toujours sur le fichier.

18. **Un aperçu qui n'imprime pas ce que montre l'écran.** Le devis à la main
    modifie `lignes_prix` ; le PDF imprime `lignes_devis`, l'instantané du
    document. Cet instantané n'était rafraîchi qu'au **chargement de la page** —
    le patron écrivait ses lignes, touchait « Aperçu du PDF », et recevait un
    document vide : « rien n'a été enregistré ». Ses lignes étaient pourtant
    bien là. Règle qui en sort : **partout où l'on imprime, on rafraîchit
    d'abord** (`src/app/api/devis/[id]/pdf/route.ts`), et toute règle d'affichage
    partagée entre l'écran et le papier vit dans une fonction commune —
    `src/lib/adresses.ts` en est née.

    *Deux corollaires trouvés le même jour, tous deux invisibles aux tests :* un
    champ de saisie **vide, sans repère et haut de 24 px** se lit comme « pas
    cliquable » alors qu'un contrôle répond « éditable : oui » — la taille d'une
    cible tactile se mesure (44 px), elle ne se déduit pas. Et `innerText`
    **n'inclut pas le contenu des champs** : un contrôle qui l'interroge pour
    vérifier l'ordre d'un formulaire ne voit rien du tout.

19. **`router.refresh()` juste après `router.push()` ANNULE la navigation.**
    `refresh` redemande au serveur l'adresse **courante** ; le `push` en cours
    retombe dessus. Aucune erreur, aucune trace : l'écran ne bouge simplement
    pas. Le 13 août 2026, ce doublet a rendu inopérant le correctif du ticket
    daté d'un autre mois — le code était écrit, la ligne bien en base, et le
    défaut du patron intact. Il a fallu une sonde imprimant l'adresse et le
    titre après l'appui pour le voir. **Un `push` suffit** : une page
    `force-dynamic` est refaite côté serveur à chaque navigation. Le `refresh`
    ne se garde que sur la branche qui reste sur place. `ARCHITECTURE.md` §106.

    *Corollaire de méthode, et c'est le vrai enseignement :* un écran qui écrit
    dans une période et en affiche une autre ne se voit dans **aucune** suite
    qui regarde une moitié. Le dépôt était juste, les bornes étaient justes,
    tout était vert — le trou était dans le raccord. Là où deux couches se
    passent une valeur, il faut une suite qui traverse **du doigt jusqu'au
    chiffre** (`scripts/test-achat-hors-periode-e2e.ts`).

20. **Une liste d'écrans écrite à la main vieillit en silence.**
    `ECRANS_A_PRECHAUFFER` (`scripts/prechauffer.mjs`) dit quels écrans le banc
    compile d'avance. Réglages a été découpé en sept sous-écrans (§96) sans que
    la liste bouge : **aucun des sept n'était préchauffé**, et le patron a trouvé
    le défaut avant nous — *« Surtout la page équipe »*, le 14 août 2026. Sur ses
    deux cœurs, un écran non préchauffé ouvert pendant la construction dépasse la
    minute que le relais de GitHub accepte d'attendre : la page n'arrive jamais.
    Rien ne rougissait, et rien ne pouvait rougir. `test-prechauffage.ts`
    confronte désormais la liste aux dossiers réels de `src/app/reglages`.
    **Ajouter un écran de premier rang, c'est l'ajouter à cette liste** —
    `ARCHITECTURE.md` §106.

    *Deux corollaires du même jour.* **Une fonction prévue et jamais branchée ne
    se voit pas :** `prechauffer.mjs` portait un rappel `avancer` et
    `/api/health/banc` savait lire le fichier qu'il devait produire — personne ne
    le lui passait, et la page de diagnostic répondait « pas encore commencé »
    depuis cinq jours. Et **`nice` ne règle rien ici :** faire bâtir en priorité
    basse a été mesuré (16,2 s → 17,4 s à la connexion, construction 69 s → 67 s)
    et **écarté** — la contention est le disque, pas le processeur.

21. **Une date calculée depuis « aujourd'hui » finit par tomber un samedi.**
    `test-pastille-equipe-e2e` visait `Date.now() + 20 jours` pour trouver un
    jour libre. Écrit le 14 août 2026 : un jeudi, tout vert. Joué le 16 : un
    **samedi** — et le planning refuse le week-end par construction, écrit
    « Jamais proposé » et ne rend même pas la journée, donc ni cases d'équipe ni
    bouton. Le message accusait alors le bouton d'un défaut qui n'était pas le
    sien, et le contrôle serait redevenu vert tout seul le lundi.

    **La règle :** un contrôle qui touche au planning vise le **premier jour
    ouvrable**, jamais un décalage fixe — et il emprunte `estWeekEndIso`
    (`src/lib/mois.ts`) plutôt que de réécrire la règle, sans quoi les deux
    finissent par diverger. Plus large : **un rouge qui n'apparaît que certains
    jours de la semaine n'est presque jamais le défaut qu'il annonce.**

22. **Une propriété CSS valide qui ne fait rien.**
    `.atlas-fil-defile` déclarait `scroll-snap-type: y proximity` depuis le
    premier jour — et **aucun de ses enfants n'avait jamais déclaré
    `scroll-snap-align`**. Sans cible, la propriété est inerte : elle est
    parfaitement valide, aucun outil ne la signale, et le fil ne s'accrochait
    nulle part. Conséquence vue par le patron le 16 août 2026 : *« le premier
    message est trop haut et le début n'est pas visible »* — une carte
    s'arrêtait où le doigt la laissait, et le fondu de 18 px du cadre effaçait
    son étiquette.

    **La règle :** une propriété qui a besoin d'une CONTREPARTIE (snap/align,
    `grid-template` sans `grid-area`, `aria-controls` sans cible) se vérifie des
    deux côtés. Et le point d'accroche porte un `scroll-margin-top` plus grand
    que le fondu — sinon la carte s'accroche pile dans le fondu, c'est-à-dire à
    moitié effacée : le même défaut, réparé à l'identique.

### Le vocabulaire

Tout est en français, y compris en base : `chantiers`, `devis`, `envois_devis`,
`factures`, `lignes_facture`, `entreprise_id`. Un `withEntreprise`, pas un
`withCompany`. S'y tenir.

### Les deux documents du patron

`docs/QUESTIONS.md` et `docs/A-FAIRE.md` sont écrits **pour lui**, en langage
courant. Règles de tenue dans `AGENTS.md` : les consulter avant de répondre à une
question de fond, citer le passage plutôt que reformuler, et **proposer** un
ajout sans jamais l'imposer. Après modification, régénérer la page consultable :

```bash
node scripts/md-en-page.mjs docs/QUESTIONS.md docs/questions.html
node scripts/md-en-page.mjs docs/A-FAIRE.md
```

---

## Voir l'application tourner, sans rien monter

Le plus court chemin est [`docs/ESSAYER.md`](docs/ESSAYER.md) : un espace de
travail GitHub monte la base, applique le schéma, insère les données de
démonstration, **démarre l'application tout seul** et l'expose sur une adresse
publique ouvrable depuis un téléphone. Tout est dans `.devcontainer/`.

**Ne jamais y remettre une commande à taper.** Quatre échecs d'ouverture
d'affilée l'ont été sur le terminal, aucun sur l'application : le patron essaie
Atlas depuis un téléphone, où viser un curseur et faire un `Ctrl+C` n'existent
pas. `demarrer.sh` (joué par `postStartCommand`) est la réponse, et
`verifier.sh` contrôle en CI que l'application répond **sans commande**.

C'est aussi ce qu'il faut donner au patron quand il demande à essayer : le site
publié ne montre que des maquettes.

## Monter l'environnement à la main

PostgreSQL 16 et Redis doivent tourner. Les rôles attendus sont créés par
`scripts/bootstrap-postgres-ci.sql`.

```bash
# Migrations (rôle propriétaire)
DATABASE_URL=postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test \
  npm run db:migrate

# Données de démonstration (compte demo@atlas.local / demo1234)
DATABASE_URL=postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test \
  AUTH_SECRET=ci-secret-not-a-real-production-value-000000000000 \
  npx tsx src/server/db/seed.ts

# Suites base de données (rôle applicatif, soumis à RLS)
DATABASE_URL=postgresql://atlas_app:atlas_app_ci_pw@localhost:5432/atlas_test \
  DATABASE_ADMIN_URL=postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test \
  AUTH_SECRET=ci-secret-not-a-real-production-value-000000000000 \
  npm test

# Suites navigateur (démarre son propre serveur sur le port 3000)
DATABASE_URL=postgresql://postgres:postgres_ci_pw@localhost:5432/atlas_test \
  AUTH_SECRET=ci-secret-not-a-real-production-value-000000000000 \
  CRON_SECRET=ci-placeholder-cron-secret-0000000000 \
  REDIS_URL=redis://localhost:6379 \
  npm run test:e2e
```

**Deux pièges d'exécution :**

- **Ne jamais donner `REDIS_URL` à `npm test`.** La suite des propositions IA
  ouvre alors une connexion qui n'est jamais refermée : le processus ne se
  termine plus, et la série entière reste bloquée **sans le moindre message**.
  Isolé : code 124 avec la variable, code 0 sans. La CI ne la fournit qu'aux
  suites navigateur, qui en ont besoin pour remettre à zéro la limitation de
  débit. `verifier-avant-livraison.ts` la retire explicitement.
- `npm test` **efface la base** entre les suites : le compte de démonstration
  disparaît. Réamorcer avant de relancer les suites navigateur.
- Un serveur de développement déjà en écoute sur le port 3000 fait échouer
  `test:e2e` de façon détournée. Vérifier avant de lancer.

## Repères dans le code

| Question | Fichier |
|---|---|
| Comment le parcours doit se comporter | `docs/AGENT.md` |
| Isolation par entreprise | `src/server/db/with-entreprise.ts` |
| Où en est un devis parti | `src/lib/etat-envoi.ts` |
| Jours libres du patron | `src/server/disponibilites.ts` |
| Cycle d'envoi et réponse du client | `src/server/repositories/envois-devis.ts` |
| Facture, fin de chantier, relevé de TVA | `src/server/repositories/factures.ts` |
| Conservation, purge, effacement | `src/server/retention.ts`, `src/server/repositories/donnees-client.ts` |
| Schéma complet | `src/server/db/schema.ts` + `drizzle/*.sql` |
| Le message qui part chez son client | `src/lib/message-client.ts` |
| L'allure de ses devis (typo, fond, accent, logo) | `src/lib/allure-documents.ts` |
| Les polices embarquées dans les PDF | `src/server/pdf/polices/LISEZ-MOI.md` — **réduites, et embarquées entières** |

## Le compte de démonstration

`demo@atlas.local` / `demo1234`. Il accepte les documents légaux dans le seed,
avec la mention explicite « consentement fictif » — sans quoi toutes les suites
navigateur échouent sur la garde d'acceptation.
