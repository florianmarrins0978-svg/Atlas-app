# Le prompt `/impeccable` pour l'écran des prix

À coller après `/impeccable` dans une session neuve. Il tient seul.

Écrit le 4 septembre 2026. C'est **le seul écran du parcours où le patron engage
de l'argent avant de l'annoncer**, et il n'a jamais été repris — seulement sa
flèche de retour, la veille.

**Deux sessions tournent à côté. Ce prompt ne les touche pas :**

| Elle fait | N'y touche pas |
|---|---|
| la page du devis | `chantiers/[id]/devis-complet/`, et **la règle « à chiffrer » côté devis** |
| la facture | `chantiers/[id]/facture/`, `factures/[jeton]/`, `repositories/factures.ts` |

**Le point de friction à connaître :** la session du devis travaille en ce moment
sur le refus « une ligne attend son prix » (commit *Refuser la date avant qu'il la
choisisse…*). La règle pure est partagée. **Lis son code avant d'y toucher, et
n'écris pas une seconde version de la même règle** (`CLAUDE.md` §3).

---

```
Rends impeccable L'ÉCRAN DES PRIX d'Atlas — /chantiers/[id]/prix, là où le patron
pose ce que le chantier va coûter, ligne par ligne. Un seul écran, et les règles
pures qui le nourrissent.

  src/app/chantiers/[id]/prix/PrixClient.tsx            284 lignes
  src/app/chantiers/[id]/prix/PropositionPrixSection.tsx 296 lignes
  src/app/chantiers/[id]/prix/page.tsx et actions.ts
  les règles pures : src/lib/lecons-prix.ts, prix-attribuable.ts,
  arrondi-prix.ts, comparabilite-prix.ts, grille-prix.ts, tarif-main-oeuvre.ts,
  unites-tarif.ts, mesures-prestation.ts

CE QUI EST HORS PÉRIMÈTRE

  le devis, la facture       deux autres sessions y travaillent
  la fiche du chantier       retirée le 4 septembre : /chantiers/[id] n'est plus
                             qu'une redirection, ne la ressuscite pas
  « Mes prix » (Réglages)    son registre de tarifs est un autre écran

Si tu trouves un défaut dans l'une de ces zones, DIS-LE et n'y touche pas.

CE QUE « IMPECCABLE » VEUT DIRE ICI, ET ÇA SE MESURE

1. C'est de l'ARGENT, et c'est LUI qui le signe. Aucun prix affirmé sans source :
   une proposition dit d'où elle vient — un tarif de sa grille, un chantier
   passé, un calcul de main-d'œuvre — ou elle reste vide et le dit.
2. « À chiffrer » est un état à part entière (migration 0070) : le travail est
   identifié, son prix ne l'est pas. Il doit se voir d'un regard, et l'écran doit
   dire combien de lignes l'attendent encore.
3. Il pose ses prix debout, une main, en plein soleil — puis le soir au calme.
   Les deux scènes, pas une. Une case de montant qui ne se voit pas au soleil est
   un défaut, pas un détail de dessin.
4. Huit chartes, dont deux sombres (Nuit, Sylve) où l'accent est CLAIR : aucune
   couleur écrite en clair, `surPlein` sur un aplat, `voile()` pour un voile.
   Attention : `test-chartes-lisibles.ts` lit les CHARTES, pas les classes d'un
   écran — un `focus:bg-[rgba(0,0,0,0.03)]` lui échappe et devient invisible sur
   Nuit. C'est la faute du 22 août, et elle est déjà revenue une fois.
5. Tout refus nomme sa raison ET le geste qui le débloque.
6. Le moins de mots possible. Aucune phrase qui explique le bouton d'à côté,
   aucune flèche décorative (scripts/test-aucune-fleche.ts).

DÉJÀ TRANCHÉ PAR LE PATRON — ne pas rouvrir

- L'IA PROPOSE, elle ne décide jamais. Un prix proposé se relit et se corrige ;
  aucun n'entre en base sans son geste.
- Le retrait d'une ligne est RÉVERSIBLE : elle est masquée, un tiroir permet
  d'annuler, et rien n'est écrit tant qu'il est ouvert. Ne remets pas de fenêtre
  de confirmation avant l'action — c'est sa règle de produit (réversibilité
  après, plutôt que confirmation avant).
- Arrivé par « Écrire le devis », la proposition part REPLIÉE (`saisieManuelle`).
- Ses prix à lui priment sur tout barème : le registre de ses tarifs et ses
  chantiers passés sont la source, pas un prix public.
- Les étapes ont chacune leur écran ; celui-ci ne doit pas absorber le devis.

CE QUI EST OUVERT, ET QU'IL FAUT LUI POSER PLUTÔT QUE TRANCHER

**La qualité des propositions.** Il a relevé trois choses, et elles ne sont pas
corrigées (TODO.md) :

  · certaines prestations sont mal organisées ;
  · certaines quantités ou unités sont mal interprétées ;
  · certaines propositions de prix, ou reprises de prix historiques, sont
    incohérentes.

**Ne corrige pas ça à l'aveugle.** Le dépôt le dit lui-même : il faut des
exemples RÉELS de ses dictées et du devis produit, sinon on répare une qualité
imaginée. Si tu veux t'y attaquer, DEMANDE-LES — c'est lui qui les a. Et ce
parcours-là (transcription → prestations → quantités → prix) est un lot à part
entière : ne le mélange pas à la reprise de l'écran.

CE QUI EST DÉJÀ CONNU COMME BANCAL — pars de là plutôt que de le redécouvrir

- Un prix tapé pouvait partir à ZÉRO en gardant l'air juste à l'écran
  (CHANGELOG, 2458). **Corrigé sur le devis, jamais ici** : regarde ce que
  `montantEcrivable` (montant-ecrivable.ts) et `montantSaisi` (achat-tva.ts) font
  déjà, et emploie-les — n'en écris pas une troisième version.
- `test-lecons-prix-e2e` **n'est PAS sur cet écran** : elle saisit « Prix
  unitaire 1 » sur `/devis-complet`. Ne la compte pas dans ton lot. (Une
  première version de ce prompt l'attribuait à l'écran des prix : c'était faux,
  et c'est la session du 4 septembre qui l'a relevé.)

LES INVARIANTS — un point qui les casse se refuse, et le refus s'écrit

- Toute lecture passe par withEntreprise(utilisateurId, entrepriseId, fn). Hors
  de ce cadre, une requête ne renvoie rien, silencieusement.
- Français partout. Les règles métier vivent dans src/lib/, en fonctions pures,
  testables sans base. Jamais deux fois la même règle entre l'affichage et la
  vérification — un écran ne décide de rien.
- Un montant ne se recalcule pas à deux endroits : deux additions divergent, et
  c'est celle qu'on lit qui ment.

LA MÉTHODE

1. Lis PRODUCT.md, CLAUDE.md, docs/AGENT.md, puis git log -20. Le code fait foi
   contre la documentation ; si les deux divergent, corrige la documentation.
2. Dis-moi ce que tu as trouvé AVANT d'écrire une ligne : les trois choses qui
   font le plus mal sur cet écran, chacune avec le fichier qui la prouve, et ce
   que tu refuses de faire.
3. Toute apparence ou tout geste nouveau se DESSINE d'abord : une maquette HTML
   dans appli/, un lien dans appli/essais.html, et l'adresse ENTIÈRE une fois
   qu'elle répond 200 — jamais une capture de la maquette.
4. Regarde l'écran, en capture, à 390 × 664, Origine ET Nuit.
5. **AUCUNE EXCUSE D'IA ICI, et c'est vérifiable :** `preparerPropositionPrix`
   (server/chiffrage/proposition-prix.ts) ne lit que ses tarifs, ses
   prestations, son matériel et le chiffrage — aucun fournisseur, aucun modèle.
   Tout ce lot s'éprouve sur ce poste, avec la base. « À jouer sur ton espace »
   ne s'applique à rien de ce que tu touches.
   (Une première version de ce prompt recopiait cette clause à tort ; la session
   du 4 septembre l'a relevé, code à l'appui.)

LA BATTERIE, SUR SON POSTE WINDOWS — quatre pièges payés le 4 septembre

- **Préviens-le AVANT de la lancer.** Toutes ses sessions travaillent dans le
  MÊME dossier : si une autre modifie les fichiers pendant qu'elle tourne, le
  serveur tombe en route et les chiffres ne veulent rien dire.
- Sa base vit dans Docker : `docker start atlas-postgres atlas-redis`.
- Son `.env` pointe sur `atlas_dev`, que les suites videraient : joue sur
  `atlas_test`.
- Pour les suites NAVIGATEUR, `DATABASE_URL` doit porter le rôle `postgres` avec
  le mot de passe **`postgres_dev_pw`** — et non `postgres_ci_pw` que
  `verifier:avant-livraison` code en dur. Ses trois dernières étapes tombent donc
  toujours sur ce poste : rejoue-les à la main avec la bonne adresse plutôt que
  de toucher au script (sa valeur est celle de la CI).

LE RENDU

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : un verdict par point, le fichier qui le fonde, ce qui a été fait
autrement et pourquoi, ce qui a été refusé et ce que ça aurait coûté, les
chiffres exacts de la batterie, et ce qui reste ouvert avec qui peut le
trancher.
```

---

## Ce qui restera après celui-ci, sur le trajet `chantier → terminé`

| Écran | État |
|---|---|
| La transcription | jamais reprise |
| Les informations | jamais reprises |
| La dictée → le devis (l'attente, la qualité des propositions) | un lot à soi, qui demande ses exemples réels |
