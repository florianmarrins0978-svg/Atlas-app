# Le prompt `/impeccable` pour LA PAGE DU DEVIS

À coller après `/impeccable` dans une session neuve. Il tient seul.

Écrit le 4 septembre 2026, **resserré le jour même à sa demande** : *« le choix
de la date à la fin du devis a déjà été fait, je pense qu'il faut faire seulement
la page devis. »* Il a raison — la préparation, l'envoi et l'écran du client ont
chacun leur histoire, et un lot qui les prend tous les quatre ne finit pas.

Il remplace le prompt du 3 septembre (`docs/prompt-impeccable-devis.md`, jamais
joué, resté sur la branche `claude/prompt-impeccable-devis-ipaftf`), dont le
périmètre couvrait les quatre.

**Trois sessions tournent à côté. Ce prompt ne les touche pas :**

| Elle fait | N'y touche pas |
|---|---|
| retirer la fiche du chantier | `lienDeReprise`, `chantier-etat.ts`, `Notifications.tsx`, les cinq flèches de retour |
| la facture | `chantiers/[id]/facture/`, `factures/[jeton]/`, `facture-pdf.ts`, `repositories/factures.ts` |
| — | l'écran du client `/devis/[jeton]`, **refait le 4 septembre** |

---

```
Rends impeccable LA PAGE DU DEVIS d'Atlas — l'écran /chantiers/[id]/devis-complet,
là où le patron relit, corrige et valide son devis avant qu'il parte. Un seul
écran, et ce qu'il faut pour qu'il tienne.

  src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx   1 657 lignes
  src/app/chantiers/[id]/devis-complet/page.tsx et actions.ts
  les règles pures qu'il lit : src/lib/devis-envoyable.ts, src/lib/tva.ts
  et src/server/repositories/devis.ts, POUR LIRE ce qu'il affiche

CE QUI EST HORS PÉRIMÈTRE, ET POURQUOI

  la dictée → le devis          un autre moment, un autre lot
  (DevisDepuisDictee, devis-depuis-dictee.ts, preparation-devis.ts)

  l'ENVOI                       il vit sur /export (EnvoiAuClient.tsx), et sa
                                feuille a été dessinée dans ses onze états puis
                                corrigée sur les huit chartes le 4 septembre

  l'écran du CLIENT             REFAIT le 4 septembre, et mesuré : le calendrier
  (/devis/[jeton])              monte en feuille (990 → 664 px), les dates se
                                replient une fois l'une retenue (790 → 717), la
                                case de rétractation reste dans la page à sa
                                demande, et 53 px ont été pris dans les
                                espacements sans retirer un mot. Trois pistes
                                ÉCARTÉES par lui : raccourcir la formule légale,
                                retirer l'invitation à signaler une erreur,
                                retirer la mention de preuve. NE ROUVRE RIEN.

  la facture, la fiche du chantier   deux autres sessions y travaillent.

Si tu trouves un défaut dans l'une de ces zones, DIS-LE et n'y touche pas.

CE QUE « IMPECCABLE » VEUT DIRE ICI, ET ÇA SE MESURE

1. C'est le PREMIER ARRÊT du parcours : le seul moment où il relit ce qu'il va
   engager. Il doit le franchir en quelques secondes quand tout est juste — et
   voir ce qu'il signe. Compte les gestes entre l'ouverture de la page et le
   moment où il peut envoyer, et dis-moi lesquels tombent.
2. 1 657 lignes dans un écran client : c'est le signal. Ce qui se découpe se
   découpe, mais AUCUN comportement ne change en passant.
3. Aucun prix, aucune durée, aucune quantité affirmés sans source. Un champ sans
   source reste vide ET le dit. L'IA prépare, elle ne décide jamais.
4. Il relit debout, une main, en plein soleil — puis le soir au calme. Les deux
   scènes, pas une.
5. Huit chartes, dont deux sombres (Nuit, Sylve) où l'accent est CLAIR : aucune
   couleur écrite en clair, `surPlein` sur un aplat.
   Contrôle : npx tsx scripts/test-chartes-lisibles.ts
6. Tout refus nomme sa raison ET le geste qui le débloque. Un bouton grisé sans
   phrase est un défaut, pas une protection.
7. Le moins de mots possible. Aucune phrase qui explique le bouton d'à côté,
   aucune flèche décorative (scripts/test-aucune-fleche.ts).

DÉJÀ TRANCHÉ PAR LE PATRON — ne pas rouvrir, même si ça paraît mieux

- Deux arrêts seulement dans tout le parcours : ici, avant l'envoi du devis, et
  avant le départ de la facture. Un troisième a été retiré parce qu'il ne
  pouvait mener qu'à « oui ».
- L'envoi n'est PAS bloqué quand SIRET, adresse ou IBAN manquent. Il l'a codé,
  vu, puis fait retirer le 14 août 2026 : « rien de plus, rien de moins ». Les
  informations se recopient toutes seules dans un devis pas encore envoyé.
- Un devis envoyé est FIGÉ, identité comprise : une pièce comptable ne se
  réécrit pas après coup. Ce qui manque, c'est la phrase qui l'explique.
- Le devis parti mène à /export, le devis en cours à /devis-complet
  (getSecondarySteps, 20 août). Ne fais pas une troisième règle.
- Une ligne se déplace d'une TVA à l'autre par un appui long (1er septembre).

CE QUI EST PROPOSÉ MAIS PAS TRANCHÉ — à lui montrer, jamais à appliquer

- **« Le document entier passe derrière Voir le document »** n'est PAS une
  décision : cela n'existe que dans la maquette `appli/moins-de-mots.html`, et
  `docs/QUESTIONS.md` §23 se termine sur une question restée sans réponse. Le
  défaut, lui, est réel et mesuré — 2,6 hauteurs d'écran avant d'atteindre le
  premier arrêt (TODO.md ligne 3943). Le remède lui appartient : dessine, montre,
  attends sa lettre.

  (Une première version de ce prompt le rangeait dans « déjà tranché ». C'était
  faux, et c'est la session du 4 septembre qui l'a relevé.)

CE QUI EST DÉJÀ CONNU COMME BANCAL — pars de là plutôt que de le redécouvrir

- **« Atlas prépare toujours votre devis… (96 s) » et rien ne vient** : signalé
  le 1er septembre 2026, JAMAIS reproduit sur un poste de développement. Les
  cinq issues de l'attente ont été traitées le 4 septembre. Vérifie ce qui reste
  muet AVANT de deviner une cause : un défaut qu'on ne peut pas reproduire se
  rend d'abord BAVARD, il ne se corrige pas à l'aveugle.
- Un artisan qui arrive les mains vides n'a jamais été essayé : le jeu de
  démonstration démarre avec une entreprise déjà remplie (docs/A-FAIRE.md).

LES INVARIANTS — un point qui les casse se refuse, et le refus s'écrit

- Toute lecture passe par withEntreprise(utilisateurId, entrepriseId, fn). Hors
  de ce cadre, une requête ne renvoie rien, silencieusement.
- Français partout. Les règles métier vivent dans src/lib/, en fonctions pures,
  testables sans base. Jamais deux fois la même règle entre l'affichage et la
  vérification — un écran ne décide de rien.

LA MÉTHODE

1. Lis PRODUCT.md, CLAUDE.md, docs/AGENT.md, puis git log -20. Le code fait foi
   contre la documentation ; si les deux divergent, corrige la documentation.
2. Dis-moi ce que tu as trouvé AVANT d'écrire une ligne : les trois choses qui
   font le plus mal sur cet écran, chacune avec le fichier qui la prouve, et ce
   que tu refuses de faire.
3. Toute apparence ou tout geste nouveau se DESSINE d'abord : une maquette HTML
   dans appli/, un lien dans appli/essais.html, et l'adresse ENTIÈRE une fois
   qu'elle répond 200 — jamais une capture de la maquette.
4. Regarde l'écran, en capture, à 390 × 664, Nuit comprise. Quatre défauts réels
   de ce dépôt sont sortis d'une image et d'aucun test.
5. Aucune clé IA sur un poste de développement : ce qui dépend de la rédaction
   se dit « à jouer sur ton espace », avec la commande. Jamais « impossible » :
   l'IA est branchée chez lui.

LA BATTERIE, SUR SON POSTE WINDOWS — trois pièges payés le 4 septembre

- **Préviens-le AVANT de la lancer.** Toutes ses sessions travaillent dans le
  MÊME dossier : si une autre modifie les fichiers pendant qu'elle tourne, le
  serveur tombe en route et les chiffres ne veulent rien dire.
- Son `.env` pointe sur `atlas_dev`, que les suites videraient : dérive un
  fichier d'environnement sur `atlas_test` (npx tsx --env-file=…). Pour les
  suites NAVIGATEUR, `DATABASE_URL` doit porter le rôle `postgres` (mot de
  passe `postgres_dev_pw`) — le seul qui traverse la RLS.
- Sa base vit dans Docker : `docker start atlas-postgres atlas-redis`.

LE RENDU

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : un verdict par point, le fichier qui le fonde, ce qui a été fait
autrement et pourquoi, ce qui a été refusé et ce que ça aurait coûté, les
chiffres exacts de la batterie, et ce qui reste ouvert avec qui peut le
trancher.
```

---

## Ce qui restera après celui-ci

| Écran | État |
|---|---|
| La dictée → le devis (la préparation) | jamais reprise en tant que telle |
| Les prix (`/chantiers/[id]/prix`) | jamais repris |
| La transcription | jamais reprise |
| Les informations | jamais reprises |
