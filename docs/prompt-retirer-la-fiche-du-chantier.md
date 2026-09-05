# Le prompt du lot suivant : retirer la fiche du chantier

À coller tel quel dans une session neuve. Il tient seul : elle n'a rien lu du
dépôt et doit pouvoir travailler avec.

Écrit le 4 septembre 2026, juste après avoir codé son allure C. Le lot d'avant a
donné une maison à la facture ; celui-ci retire l'écran qu'elle retenait.

---

```
Retire la fiche du chantier d'Atlas — l'écran /chantiers/[id] — et redirige tout
ce qui y mène encore. Rien d'autre : ni le devis, ni le planning, ni la facture,
sauf ce qu'il faut toucher pour que cet écran puisse partir.

POURQUOI, ET DEPUIS QUAND

Le patron l'a demandé deux fois.

  21 août 2026 : « la fiche chantier, on la supprime pour de bon. »
  1er septembre : « toutes ces infos sont déjà sur cette page — on la garde,
  donc ça fait des doublons si on garde l'autre aussi. »

Ce qu'il refuse n'est pas un écran de trop : ce sont DEUX ÉCRANS QUI MONTRENT LA
MÊME CHOSE. La fiche client porte les photos, la dictée et les coordonnées
depuis le 31 août ; la fiche du chantier les montrait une seconde fois.

Le 31 août, on lui a répondu « elle ne se supprime pas » : elle portait encore la
sortie vers la facture. CETTE RÉPONSE EST PÉRIMÉE. Le 4 septembre, la facture a
déménagé sur les chantiers du planning — son allure C, choisie sur
appli/facture-au-planning.html : le chevron d'une ligne fait monter une feuille
qui porte la facture, le devis et la fiche client
(src/lib/portes-du-planning.ts, src/app/planning/PortesDuChantier.tsx,
ARCHITECTURE.md §253).

CE QUI MÈNE ENCORE À CET ÉCRAN — relevé dans le code, pas de mémoire

  src/lib/chantier-etat.ts       lienDeReprise (photos, dictée, chantier
                                 planifié) · getNextActionHref (photos) · la
                                 ligne « Photos » de getSecondarySteps
  src/lib/retour-du-devis.ts     le repli quand aucune provenance n'est donnée
  src/app/Notifications.tsx      la suite d'une réponse de devis (ligne ~277)
  cinq flèches de retour         informations, prix, note-vocale, transcription,
                                 export — « Retour à la fiche du chantier »
  nouveau/FormulaireNouveauChantier.tsx   après création, quand il choisit de
                                 dicter (ligne ~282)
  revalidatePath                 coordonnees/actions.ts, informations/actions.ts
  src/app/design/d/page.tsx      une maquette de démonstration

LE PIÈGE QUI TE FERA PERDRE UNE HEURE, ET IL EST DANS lienDeReprise

Ne redirige PAS /chantiers/[id] vers lienDeReprise() sans l'avoir corrigé
d'abord : cette fonction RENVOIE /chantiers/[id] dans trois cas (photos, dictée,
chantier planifié) et deux fois en repli. Tu obtiendrais une boucle de
redirection — et sur un chantier planifié, c'est-à-dire précisément le cas du
patron.

L'ordre qui marche : corriger lienDeReprise et getNextActionHref d'abord, la
route ensuite.

CE QUI EST DÉJÀ TRANCHÉ — ne pas rouvrir

- Photos et dictée vivent sur la FICHE CLIENT (/chantiers/[id]/coordonnees), pas
  sur un écran à eux. C'est là que doivent mener « photos » et « note-vocale ».
- Un chantier planifié se reprend au PLANNING : sa ligne y porte désormais ses
  trois portes. Ne le renvoie pas vers le planning général sans sa journée.
- Les étapes ont chacune leur écran (/informations, /prix, /devis-complet,
  /note-vocale) : la fiche n'en était que la LISTE. Ne les déplace pas.
- Le devis parti mène à /export, le devis en cours à /devis-complet
  (getSecondarySteps, 20 août). Ne fais pas une troisième règle.
- Les deux arrêts du parcours ne bougent pas : avant l'envoi du devis, avant le
  départ de la facture.

CE QUE TU DOIS DÉCIDER, ET DIRE

Que devient l'adresse /chantiers/[id] ? Un lien profond, un signet, une
notification déjà partie la portent encore. Une page qui disparaît sans
redirection rend un 404 à quelqu'un qui avait raison de cliquer. Propose, et dis
ce que ça coûte — ne supprime pas la route en silence.

LES SUITES QUI PASSENT PAR CET ÉCRAN, ET QUI VONT ROUGIR

  _creer-chantier-e2e.ts (le socle de 73 suites), test-anneau-dictee-e2e,
  test-anneau-vers-devis-e2e, test-devis-a-la-main-e2e, test-devis-complet-e2e,
  test-photos-e2e, test-rapprochement-client-e2e, test-reprise-chantier-e2e,
  test-retrait-differe-e2e, test-retour-du-devis

ADAPTE-LES, ne remets pas l'écran. Une suite fixe la RÈGLE, pas la façon dont un
écran la montrait (CLAUDE.md §5 bis) : vise une adresse d'arrivée, un
identifiant, un compte en base — jamais un libellé que le patron peut faire
retirer demain.

Et note que deux suites rougissent DÉJÀ sans rapport avec ce lot :
test-reprise-chantier-e2e et test-attente-dictee-e2e tombent une batterie sur
deux et sont vertes jouées seules (TODO.md). Mesure avant d'accuser ton code.

LES INVARIANTS — un point qui les casse se refuse, et le refus s'écrit

- Toute lecture passe par withEntreprise(utilisateurId, entrepriseId, fn). Hors
  de ce cadre, une requête ne renvoie rien, silencieusement.
- Français partout : fonctions, variables, tables, messages, libellés.
- Les règles métier vivent dans src/lib/, en fonctions pures. Jamais deux fois la
  même règle entre l'affichage et la vérification.
- Huit chartes, dont deux sombres (Nuit, Sylve) où l'accent est CLAIR : aucune
  couleur écrite en clair, `surPlein` sur un aplat.
  Contrôle : npx tsx scripts/test-chartes-lisibles.ts

LA MÉTHODE

1. Lis CLAUDE.md, TODO.md (le bloc « la fiche client qui dicte le devis ») et
   ARCHITECTURE.md §253, puis git log -20.
2. Dis-moi ce que tu comptes faire AVANT d'écrire une ligne : où mène chaque
   chemin après ton lot, et ce que tu refuses de faire.
3. Regarde les écrans que tu touches, en capture, à 390 × 664. Quatre défauts
   réels de ce dépôt sont sortis d'une image et d'aucun test.
4. npm run verifier:avant-livraison doit être vert. Ne joue rien à la main
   pendant qu'elle tourne : elle vide la base. Ne la passe pas par tail.
5. Sur le poste Windows du patron : .env pointe sur atlas_dev, que les suites
   videraient — joue la batterie sur atlas_test avec un fichier d'environnement
   dérivé (npx tsx --env-file=…), et vérifie que Docker Desktop tourne : sa base
   vit dans les conteneurs atlas-postgres et atlas-redis, et un Docker éteint
   fait rougir la batterie entière sans que le code y soit pour rien.

LE RENDU

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : ce qui a été fait, où mène désormais chaque chemin, ce qui a été
refusé et pourquoi, les chiffres exacts de la batterie, et ce qui reste ouvert.
```

---

## Ce que le lot d'avant a déjà fait, et qu'il ne faut pas refaire

| | |
|---|---|
| la facture a une maison | la feuille du chevron, au planning — son allure C |
| la règle | `src/lib/portes-du-planning.ts`, pure, éprouvée sans base |
| le chevron du planning | ne mène plus à `/chantiers/[id]` |
| le nom du chantier | déplie la journée — **et une suite refuse qu'on y accroche la feuille**, sa consigne du 4 septembre |
