# Le prompt `/impeccable` pour L'ACCUEIL — la liste des chantiers

À coller après `/impeccable` dans une session neuve. Il tient seul.

Écrit le 6 septembre 2026, à sa demande : *« repense entièrement la page
chantier ; tu peux partir sur totalement autre chose, il faut juste que ce soit
facile d'utilisation et intuitif. »*

**Une précision qui change le périmètre.** La *fiche* d'un chantier n'existe
plus depuis le 4 septembre — elle faisait doublon avec la fiche client, et
`/chantiers/[id]` ne fait plus que rediriger (`ARCHITECTURE.md` §254). « La page
chantier » désigne donc **l'accueil** : l'écran qu'il ouvre vingt fois par jour,
le fil de ses chantiers.

**C'est le seul prompt `/impeccable` qui autorise une refonte.** Les cinq
précédents disaient « ne rouvre pas ce qui a été tranché ». Celui-ci porte son
autorisation explicite d'aller ailleurs — et la contrepartie, qui est de ne rien
abandonner en silence.

---

```
Rends impeccable L'ACCUEIL d'Atlas — la liste des chantiers, à l'adresse « / ».
C'est l'écran qu'il ouvre vingt fois par jour, et le premier que voit un
utilisateur neuf.

LE PÉRIMÈTRE

  src/app/page.tsx                          168 l.  lit et compte, rien d'autre
  src/app/EcranChantiers.tsx                471     l'écran, la feuille, le geste
  src/app/ListeChantiers.tsx                337     le fil, la perle, la ligne
  src/app/Notifications.tsx                 573     les bandeaux sous le titre
  src/components/atlas/AtlasBottomNav.tsx   188     les cinq onglets du bas
  src/components/atlas/LigneRetirable.tsx   130     le glissement
  src/components/atlas/TiroirDesRetires.tsx  86     l'annulation
  src/lib/chantier-etat.ts                  499     lienDeReprise, ligneEtatChantier
  src/lib/onglet-chantier.ts                191     dans quel onglet vit un chantier
  src/lib/perle-descente.ts                 106     la plongée de la perle

LA CONTRAINTE QUI PRIME SUR TOUTES LES AUTRES

Sa consigne du 5 septembre 2026, désormais dans PRODUCT.md : « la plupart des
patrons qui vont utiliser l'app sont des vieux qui ont du mal à se servir de
leur téléphone ; il faut que ce soit hyper intuitif et simple ».

  un écran, un geste     ce qu'on vient y faire se voit sans chercher
  rien de caché          aucun geste à découvrir — pas de glissement, pas
                         d'appui long, pas de double appui, pour ce qui COMPTE
  des cibles grandes     on vise mal avec un doigt épais, à contre-jour
  des mots du métier     jamais un mot d'informaticien
  une erreur se rattrape on se trompe, et on doit pouvoir revenir
  rien qui presse        aucun geste qui expire

LE TEST QUI TRANCHE : un homme de soixante-cinq ans, qui n'a jamais rien
installé sur son téléphone, ouvre cet écran pour la première fois. Sait-il, sans
qu'on le lui dise, ce qu'il regarde et où appuyer ? S'il faut une phrase
d'explication, l'écran n'est pas juste — et la phrase est du bruit (CLAUDE.md §3).

CE QU'IL AUTORISE, ET CE QU'IL N'AUTORISE PAS

Sa phrase du 6 septembre : « tu peux partir sur totalement autre chose ». C'est
une autorisation rare, et elle est réelle : le fil, la perle, les cinq onglets,
la feuille qui monte — tout cela peut tomber si tu proposes mieux.

Ce qu'elle N'autorise pas :

1. **Abandonner une de ses décisions en silence.** Chacune de celles listées
   plus bas a été payée — en maquettes, en captures, en allers-retours. Ce que
   tu retires se NOMME, avec ce que ça lui coûte et pourquoi tu crois que ça
   vaut le coup. Un retrait non dit se lit comme un oubli, et il le redemandera.
2. **Coder avant qu'il ait choisi.** Une apparence ou un geste se DESSINE
   d'abord (CLAUDE.md §3 bis). Il n'a pas dit « code-moi ça », il a dit
   « repense ».
3. **Une planche à regarder.** Deux versions de la maquette « moins de mots »
   ont raté sa demande, et il l'a écrit noir sur blanc : « une maquette dynamique
   QUE JE PUISSE UTILISER ». Une maquette, ici, est un bout d'application qui
   marche au pouce — la barre du bas répond, on appuie sur le bouton, la feuille
   monte. Pas des écrans avant/après avec des flèches.

CE QU'IL A TRANCHÉ LUI-MÊME — à connaître AVANT de le jeter

Aucune de ces lignes n'est un interdit ; toutes sont des factures déjà payées.

- **Le fil, pas les cartes** (10 août). Un trait vertical porte les jours ; plus
  aucune boîte autour d'un chantier. Sa raison : une liste de chantiers n'est
  pas un tableau de bord.
- **La perle à mi-hauteur** (11 août). Elle suit le doigt et ne désigne PAS le
  chantier qui attend — il avait la version inverse, et elle apparaissait
  n'importe où. Elle plonge sur le dernier jour aux derniers pixels.
- **« Créer un devis », le mot et l'anneau** (11, 16 et 31 août). L'aplat vert a
  été refusé — « ça ne fait pas très luxe ». Onze maquettes, onze grains d'or,
  520 ms avant la feuille, le mot à 13 px graisse 800. Il a resserré ces
  nombres lui-même.
- **Aucun trait gris dans l'en-tête** (24 août) — il l'avait demandé le 11, il
  l'a fait retirer le 24. Ne pas le remettre en citant l'ancienne consigne.
- **Pas de « Bonjour »** (24 août) : il y lisait « Compte ».
- **Aucune phrase quand la liste est vide** (25 août) : « supprime la phrase
  aucun chantier pour l'instant ».
- **« En cours » puis le chiffre, en gras, et plus rien à droite** (19 août,
  variante C de sa planche). Le compte ne s'écrit plus qu'une fois.
- **« Vos clients » en or sous le compteur** (17 août), plutôt qu'un sixième
  onglet.
- **44 px au-dessus du titre, titre à 40 px, 21 px entre deux chantiers**
  (2 septembre) : « garde l'air, par contre ne touche à rien d'autre ».
- **Toucher une ligne, c'est REPRENDRE** (13 août) — pas revenir au début.
  `lienDeReprise` mène à l'écran où le travail s'est arrêté.
- **« Adresse non renseignée » est cliquable** (17 août) et mène aux
  coordonnées, alors que le reste de la ligne mène à la reprise.
- **Un chantier dans UN SEUL onglet** (6 août) : au planning, ou dans les
  chantiers, ou dans les terminés. Jamais deux.
- **Cinq onglets, sans icônes, à 8,5 px / 0,14 em** (17 août, sa variante C).
  Quatre pictogrammes sous quatre mots disaient la même chose deux fois.
- **L'or sur toutes les lignes d'état** (16 août) : « pour tous les messages je
  veux que cette partie-là apparaisse en doré ».

CE QUI EST OUVERT, ET QU'IL A DEMANDÉ SANS L'OBTENIR

1. **L'accueil de la maquette « moins de mots » n'a JAMAIS été fait.**
   docs/QUESTIONS.md §23, verdict du 6 septembre : les réglages sont faits, la
   fiche client et l'accueil ne le sont pas. Sa mesure du 19 août : 35 mots à
   l'écran, 21 possibles. ATTENTION — une partie de ce que la maquette proposait
   a déjà été corrigée depuis (le compte écrit deux fois est parti le 19 août).
   Confronte `appli/moins-de-mots.html` au code AVANT de le citer.
2. **Le compteur de mots qui empêche l'écran de regrossir n'existe pas.**
   C'était la vraie réponse à « il y aura une quatrième fois ». Trois fois un
   écran a été allégé, trois fois la gêne est revenue ailleurs.
3. **Un chantier prévu hier bascule en silence dans « Terminés ».** Faut-il un
   rappel sur l'accueil ? Question posée dans TODO.md, jamais soumise à lui.
   Ne tranche pas seul : demande.

CE QUE « IMPECCABLE » VEUT DIRE ICI, ET ÇA SE MESURE

1. Compte les MOTS à l'écran, avant et après, à 390 × 664. Sa plainte du
   19 août portait là-dessus, pas sur le nombre de gestes.
2. Compte les GESTES entre l'ouverture et le chantier qu'il cherche. Puis
   demande-toi lequel tombe.
3. Ce qui attend un geste DE LUI doit se voir sans lire. Aujourd'hui l'or est
   sur toutes les lignes, donc il ne distingue plus rien — c'est SA décision,
   mais elle a un coût, et il ne l'a peut-être pas mesuré.
4. Huit chartes, dont deux sombres (Nuit, Sylve) où l'accent est CLAIR : aucune
   couleur écrite en clair, `surPlein` sur un aplat, `voile()` pour un voile.
   Contrôle : npx tsx scripts/test-chartes-lisibles.ts
   Attention, il lit les CHARTES et pas les classes d'un écran : un
   `bg-[rgba(0,0,0,0.03)]` lui échappe et disparaît sur Nuit.
5. Aucune flèche décorative (scripts/test-aucune-fleche.ts).
6. Tout refus nomme sa raison ET le geste qui le débloque.

CE QUE ÇA CASSE, ET IL FAUT LE SAVOIR AVANT DE PROMETTRE

Dix-sept scripts lisent cet écran par ses repères — `a.atlas-brin`,
`.atlas-ligne`, `data-atlas="compteur"`, `data-atlas="nouveau-chantier"` :

  test-dashboard-e2e · test-glisser-supprimer-e2e · test-transcription-e2e ·
  test-coordonnees-depuis-accueil-e2e · test-bouton-nouveau-chantier-e2e ·
  test-unite-tarif-e2e · test-vibration · test-classes-atlas-uniques ·
  mesurer-fluidite-fil · verifier-barre-basse · et sept captures

Une refonte qui change ces repères les fait tomber tous. Ce n'est pas une raison
de ne rien changer : c'est une raison de le CHIFFRER dans ta proposition, et
d'adapter les contrôles plutôt que de remettre le libellé (CLAUDE.md §5 bis).
Vise le profond — une adresse, un identifiant, un compte en base — pas un texte
d'écran.

LES INVARIANTS, QUI NE BOUGENT PAS QUELLE QUE SOIT LA REFONTE

- Toute lecture passe par withEntreprise(utilisateurId, entrepriseId, fn). Hors
  de ce cadre, une requête ne renvoie rien, silencieusement.
- **Une ligne = un seul `<a>`.** Trois suites tombent sinon, et aucune n'a tort :
  la ligne EST un lien, ce qu'on lit dedans doit rester dedans.
- Le statut se calcule UNE fois, au serveur. Deux calculs divergent toujours.
- La règle de rangement vit dans `onglet-chantier.ts` et nulle part ailleurs.
  Elle a déjà été recopiée dans un écran, et un chantier s'est retrouvé dans
  deux onglets.
- Français partout. Les règles métier en fonctions pures, dans src/lib/.

LA MÉTHODE

1. Lis PRODUCT.md (« Accessibility & Inclusion »), CLAUDE.md, docs/QUESTIONS.md
   §23, TODO.md, puis git log -20 et git branch -r --sort=-committerdate.
2. Dis-moi ce que tu as trouvé AVANT d'écrire une ligne : ce qui rend cet écran
   difficile pour quelqu'un qui n'aime pas les téléphones, chaque point avec le
   fichier qui le prouve, et ce que tu proposes de garder, de jeter, et de
   remplacer.
3. DESSINE. Une maquette qui SE SERT, dans appli/, un lien dans
   appli/essais.html, et donne-lui l'adresse ENTIÈRE — jamais tronquée, jamais
   une capture de la maquette — une fois qu'elle répond 200 :
   curl -s -o /dev/null -w '%{http_code}' https://florianmarrins0978-svg.github.io/Atlas-app/<la-planche>.html
   Groupe les poussées : deux à la suite s'annulent (concurrency: cancel-in-progress).
4. Ne code qu'après sa réponse.
5. Regarde les écrans, en capture, à 390 × 664, Origine ET Nuit — liste pleine,
   liste vide, liste avec trois bandeaux de notification.

LA BATTERIE, SUR SON POSTE WINDOWS

- Préviens-le AVANT de la lancer ; son accord vaut ensuite pour toute la
  séquence, sans le relancer à chaque étape.
- Sa base vit dans Docker : docker start atlas-postgres atlas-redis
- Puis :

  export ATLAS_BASE_SUPER="postgresql://postgres:postgres_dev_pw@localhost:5432/atlas_test"
  npm run verifier:avant-livraison

LE RENDU

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : un verdict par point, le fichier qui le fonde, ce qui a été fait
autrement et pourquoi, ce qui a été refusé et ce que ça aurait coûté, les
chiffres exacts de la batterie, et ce qui reste ouvert avec qui peut le
trancher.
```

---

## Ce que ce prompt ne couvre pas

| | |
|---|---|
| **Planning** et **Terminés** | deux onglets voisins, deux écrans à eux |
| La feuille du chantier neuf | `FormulaireNouveauChantier`, 1 036 l., refaite le 21 août |
| Le trajet `chantier → terminé` | repris du 2 au 5 septembre |
| Les Réglages | `docs/prompt-impeccable-reglages.md`, sommaire fait le 6 septembre |
| Le pôle **Paysage** | jamais repris |
