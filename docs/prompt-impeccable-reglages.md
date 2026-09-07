# Le prompt `/impeccable` pour les Réglages

À coller après `/impeccable` dans une session neuve. Il tient seul.

Écrit le 5 septembre 2026, après que **le trajet `chantier → terminé` a été
entièrement repris**. Les Réglages sont la plus grosse zone jamais retravaillée :
un sommaire et quatorze rubriques, un peu plus de neuf mille lignes.

**Il porte une consigne neuve du patron, du 5 septembre**, qui vaut pour toute
l'application et qui est désormais dans `PRODUCT.md` :

> *« Imagine que la plupart des patrons qui vont utiliser l'app sont des vieux
> qui ont du mal à se servir de leur téléphone ; il faut que ce soit hyper
> intuitif et simple. »*

---

```
Rends impeccable LES RÉGLAGES d'Atlas — /reglages et ses quatorze rubriques.
C'est la plus grosse zone du produit qui n'a jamais été reprise.

LA CONTRAINTE QUI PRIME SUR TOUTES LES AUTRES

Sa consigne du 5 septembre 2026 : « la plupart des patrons qui vont utiliser
l'app sont des vieux qui ont du mal à se servir de leur téléphone ; il faut que
ce soit hyper intuitif et simple ».

Ce n'est pas une préférence de style. C'est la contrainte la plus forte du
produit, et elle prime sur l'élégance, sur la densité, et sur le nombre d'écrans
qu'on aurait pu économiser. Elle est écrite dans PRODUCT.md, section
« Accessibility & Inclusion ». Ce qu'elle impose ici :

  un écran, un geste     ce qu'on vient y faire se voit sans chercher, et se
                         fait sans apprendre
  rien de caché          aucun geste à découvrir — pas de glissement, pas
                         d'appui long, pas de double appui. Ce qui compte est
                         VISIBLE
  des cibles grandes     on vise mal avec un doigt épais, sur un écran sale, à
                         contre-jour
  des mots du métier     jamais un mot d'informaticien
  une erreur se rattrape on se trompe, et on doit pouvoir revenir
  rien qui presse        aucun geste qui expire, aucune fenêtre qui se referme

LE TEST QUI TRANCHE, et il vaut pour chaque écran que tu touches : un homme de
soixante-cinq ans, qui n'a jamais rien installé sur son téléphone, comprend-il
cet écran SANS qu'on le lui explique ? S'il faut une phrase d'explication,
l'écran n'est pas juste — et la phrase est du bruit (CLAUDE.md §3).

LE PÉRIMÈTRE

  le sommaire      src/app/reglages/page.tsx, Sommaire.tsx, ReglagesClient.tsx
  les rubriques    identite (969 l.) · tarifs (131) · prix (1 473) ·
                   equipe (907) · documents (1 858) · apparence (307) ·
                   agenda (1 159) · ia (145) · donnees (194) ·
                   abonnement (104) · compte (269) · connexion (976) ·
                   notifications (460) · vocabulaire (404)
  les pièces       AbsencesEquipe, ImportTarifs, PeriodiciteTva, VosEquipes,
                   VosSalaries, CompteurRond, RubriqueReservee, icones.tsx

C'EST TROP GROS POUR UN SEUL LOT — DÉCOUPE-LE, ET DIS COMMENT

Ne touche pas quatorze rubriques d'un coup : personne ne pourra relire ça, et
une batterie rouge ne dira plus laquelle accuser. Propose-lui un ordre, en
partant de ce qu'il ouvre le plus souvent et de ce qui coûte le plus cher quand
c'est mal compris. Commence par le SOMMAIRE — c'est la porte, et c'est là que
« hyper intuitif » se joue d'abord.

CE QUI EST HORS PÉRIMÈTRE

  tout le trajet chantier → terminé   repris entre le 2 et le 5 septembre
  le pôle Paysage                     un lot à lui, plus tard
  « Mes prix » vu depuis un chantier  c'est l'écran des prix, refait le 5

DÉJÀ TRANCHÉ PAR LE PATRON — ne pas rouvrir

- **Le sommaire vient de SA planche du 14 août 2026**, qu'il a dessinée :
  icône, titre, ligne. Sa demande était de tout RANGER, pas de jeter — « soit tu
  crées les catégories qu'il y a besoin, soit s'il va y avoir des doublons, tu
  supprimes ».
- **Les regroupements sont les siens**, et ils ont une raison :
  · tarifs, grilles de prix et catalogue sous « Tarifs & catalogue » ;
  · le régime de TVA ET sa périodicité ensemble, dans « Mon entreprise » — ils
    vivaient à deux endroits séparés par tout le reste ;
  · les équipes du planning sous « Planning » : le mot y désigne une FILE DU
    PLANNING, pas un compte ;
  · le vocabulaire du métier sous « Atlas IA », puisque c'est ce qu'elle
    reconnaît d'une dictée ;
  · le téléchargement des données sous « Sécurité & données ».
- **La version exécutée reste sur le sommaire.** Ce n'est pas un réglage : c'est
  la réponse à « mes correctifs sont-ils arrivés ». Ne la range pas ailleurs.
- Le modèle de documents ne se remplace pas (lot 6 des Réglages, août 2026).
- Un commercial ne facture pas, un salarié ne voit ni prix ni facturation : le
  modèle des rôles est figé depuis le 30 août. Une rubrique fermée se DIT
  (`RubriqueReservee`), elle ne disparaît pas en silence.

CE QUI EST PROPOSÉ MAIS PAS TRANCHÉ — à lui montrer, jamais à appliquer

La maquette `appli/moins-de-mots.html` propose de retirer des Réglages :
  · les treize phrases d'explication sous les treize titres ;
  · le mot « Intégrations », qui est un mot d'informaticien — il existe encore
    (`reglages/agenda/page.tsx`, et `src/lib/mode-emploi.ts` qui le nomme deux
    fois).
`docs/QUESTIONS.md` §23 se termine sur une question restée SANS RÉPONSE. Dessine,
montre, attends sa lettre. (Deux prompts précédents ont rangé ce genre de
proposition dans « déjà tranché » : c'était faux les deux fois.)

CE QUE « IMPECCABLE » VEUT DIRE ICI, EN PLUS DE LA CONTRAINTE DU HAUT

1. Un réglage se trouve en moins de dix secondes, sans savoir dans quelle
   catégorie on l'a rangé. Mesure le chemin : combien d'appuis pour changer son
   numéro de TVA, son logo, le prix de sa main-d'œuvre ?
2. Ce qui est écrit doit être ce qui est appliqué. Un réglage enregistré qui ne
   change rien à l'écran suivant est pire qu'un réglage absent.
3. Huit chartes, dont deux sombres (Nuit, Sylve) où l'accent est CLAIR : aucune
   couleur écrite en clair, `surPlein` sur un aplat, `voile()` pour un voile.
   Attention : `test-chartes-lisibles.ts` lit les CHARTES, pas les classes d'un
   écran — un `bg-[rgba(0,0,0,0.03)]` lui échappe et disparaît sur Nuit.
4. Tout refus nomme sa raison ET le geste qui le débloque.
5. Aucune flèche décorative (scripts/test-aucune-fleche.ts).

LES INVARIANTS

- Toute lecture passe par withEntreprise(utilisateurId, entrepriseId, fn). Hors
  de ce cadre, une requête ne renvoie rien, silencieusement.
- Français partout. Les règles métier vivent dans src/lib/, en fonctions pures.
- Ce qui touche l'identité, les rôles, la connexion, les données et l'abonnement
  est une ZONE SENSIBLE : on n'y simplifie pas un refus en le supprimant.

LA MÉTHODE

1. Lis PRODUCT.md (surtout « Accessibility & Inclusion »), CLAUDE.md,
   docs/QUESTIONS.md, puis git log -20.
2. Dis-moi ce que tu as trouvé AVANT d'écrire une ligne : les trois écrans les
   moins compréhensibles pour quelqu'un qui n'aime pas les téléphones, chacun
   avec le fichier qui le prouve, et l'ordre que tu proposes pour le reste.
3. Toute apparence ou tout geste nouveau se DESSINE d'abord : une maquette HTML
   dans appli/, un lien dans appli/essais.html, et l'adresse ENTIÈRE une fois
   qu'elle répond 200 — jamais une capture de la maquette.
4. Regarde les écrans, en capture, à 390 × 664, Origine ET Nuit.

LA BATTERIE, SUR SON POSTE WINDOWS

- **Préviens-le AVANT de la lancer** ; son accord vaut ensuite pour toute la
  séquence, sans le relancer à chaque étape.
- Sa base vit dans Docker : `docker start atlas-postgres atlas-redis`.
- Elle se joue telle quelle, avec une variable :

  ```bash
  export ATLAS_BASE_SUPER="postgresql://postgres:postgres_dev_pw@localhost:5432/atlas_test"
  npm run verifier:avant-livraison
  ```

LE RENDU

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : un verdict par point, le fichier qui le fonde, ce qui a été fait
autrement et pourquoi, ce qui a été refusé et ce que ça aurait coûté, les
chiffres exacts de la batterie, et ce qui reste ouvert avec qui peut le
trancher.
```

---

## Ce qui restera après les Réglages

| | |
|---|---|
| **Paysage** — arrosage, diagnostic, fiches d'entretien | le pôle métier, jamais repris |
| La note vocale et l'attente du devis | le moment entre son micro et le devis |
| Le catalogue (« Mes mots ») | 1 écran |
| La connexion | reprise en août, jamais depuis |
| La fiche d'entretien du client | rien depuis le 18 août |
