# Reprendre le travail

**À lire en premier, dans une nouvelle conversation.** Ce fichier suppose que
vous ne savez rien de ce qui précède — c'est exactement le cas de figure qu'il
sert.

**Point de reprise :** 2026-08-08 · `claude/migrate-app-atlas-zz31ac`
(l'historique fait foi : `git log --oneline -20`)

---

## En trois phrases

Atlas est un agent au service de l'artisan patron : il prépare les devis, les
envoie au client avec une proposition de date, recueille la réponse, planifie le
chantier, construit la facture à la fin et tient le relevé de TVA. Le parcours
complet est décrit dans **`docs/AGENT.md`** — c'est la référence du produit, à
lire avant toute décision de conception. Le socle technique est une application
Next.js avec PostgreSQL, isolée par entreprise via *row level security*.

## Ce qui vient d'être terminé

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

## Où reprendre

`TODO.md`, dans l'ordre. Le premier point codable seul aujourd'hui est
l'**agenda Google** — et encore, partiellement : la connexion du compte demande
des identifiants que le patron doit fournir.

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

### Les dix-huit pièges de ce dépôt

0. **Une action serveur refusée ne dit rien d'utile.** Next.js compare `Origin`
   à l'hôte : derrière un proxy (Codespaces), ils diffèrent et TOUTE action est
   rejetée — connexion comprise — avec pour seul message « Invalid Server
   Actions request. ». Aucune suite ne le voit : elles interrogent toutes
   `127.0.0.1`, où les deux coïncident. C'est le rôle de
   `scripts/verifier-connexion.mjs`, qui pose exprès une origine étrangère.
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

## Le compte de démonstration

`demo@atlas.local` / `demo1234`. Il accepte les documents légaux dans le seed,
avec la mention explicite « consentement fictif » — sans quoi toutes les suites
navigateur échouent sur la garde d'acceptation.
