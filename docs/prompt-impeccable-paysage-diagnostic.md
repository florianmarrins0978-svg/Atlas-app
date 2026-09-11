# Le prompt `/impeccable` pour la reconnaissance des maladies

À coller après `/impeccable` dans une session neuve. Il tient seul.

Écrit le 11 septembre 2026, à sa demande, après celui du plan d'arrosage. Dans
l'application, l'outil s'appelle **« Diagnostic végétal »** — `/paysage/diagnostic`.
Il n'a pas été touché depuis son entrée, le 20 août 2026.

## Le rangement est là aussi DÉJÀ fait

Vérifié dans le code avant d'écrire (`CLAUDE.md` §1, *le code fait foi*) :

| | |
|---|---|
| la route | `src/app/paysage/diagnostic/page.tsx` |
| l'entrée dans la catégorie | `src/app/paysage/page.tsx` — « Diagnostic végétal », troisième outil |
| l'onglet | `AtlasBottomNav.tsx` — « Paysage », monté dans `src/app/layout.tsx` |

## Une correction faite en passant

`ARCHITECTURE.md` §135.10 affirmait encore *« la base phytosanitaire ne contient
aucune fiche réelle »*. Il y en a **trois** depuis le 20 août
(`donnees/phyto/fiches/`), et `HANDOVER.md` le disait déjà. Le paragraphe est
corrigé dans le même commit que ce prompt : une documentation périmée est pire
qu'absente, on s'y fie encore.

---

```
Rends impeccable LA RECONNAISSANCE DES MALADIES d'Atlas — l'outil s'appelle
« Diagnostic végétal » dans l'application, /paysage/diagnostic. Il n'a pas été
touché depuis le 20 août 2026.

COMMENCE PAR NE PAS REFAIRE CE QUI EST FAIT

L'écran est DÉJÀ dans la catégorie Paysage : route src/app/paysage/diagnostic/,
entrée « Diagnostic végétal » dans src/app/paysage/page.tsx, onglet « Paysage »
monté par src/app/layout.tsx. Vérifie-le en trente secondes, puis passe à la
suite — ne le redéplace pas.

LES DEUX CONTRAINTES QUI PRIMENT SUR TOUT LE RESTE

1. MIEUX VAUT REFUSER DE CONCLURE QUE PRODUIRE UN FAUX DIAGNOSTIC. Ses mots, le
   20 août 2026, en tête de drizzle/0057 : « aucune interprétation silencieuse,
   aucune donnée inventée, aucune perte d'information, aucun diagnostic forcé ;
   en cas de doute, bloquer plutôt que deviner ». Et : « Atlas ne doit JAMAIS
   inventer un diagnostic ».

   Ce n'est pas une préférence de prudence. Un faux diagnostic fait traiter un
   arbre pour ce qu'il n'a pas, ou laisse un lignivore travailler au collet d'un
   arbre qui tombera sur quelqu'un. Le modèle, lui, nommera toujours une maladie
   si on lui en laisse la place : c'est ce qu'il sait faire, et c'est exactement
   ce qu'il ne faut pas.

2. « DES VIEUX QUI ONT DU MAL AVEC LEUR TÉLÉPHONE » (PRODUCT.md, sa consigne du
   5 septembre 2026). Ici, elle se double de sa règle produit du 20 août, mot
   pour mot : « 1 photo → 1 résultat principal → 3 informations essentielles →
   1 action recommandée. La complexité doit être dans le moteur et la base de
   données, jamais dans l'interface. »

LE PÉRIMÈTRE

  l'écran      src/app/paysage/diagnostic/ : page.tsx (58 l.),
               PrendreUnePhoto.tsx (101), actions.ts (265),
               [id]/page.tsx (445), [id]/RattacherAUnChantier.tsx (97)
  le moteur    src/lib/diagnostic-vegetal.ts — vocabulaire fermé, score,
               seuils, refus ; entièrement déterministe, aucun appel réseau
  autour       src/lib/diagnostic-liaison.ts, src/lib/retention-diagnostic.ts,
               src/lib/exif.ts
  le serveur   src/server/diagnostic/observation.ts (261 l.), moteur.ts (254),
               src/server/repositories/diagnostics.ts (293)
  la base      drizzle/0056_diagnostic_vegetal.sql et
               0057_diagnostic_hote_et_integrite.sql — à LIRE, leurs en-têtes
               portent le raisonnement
  les données  donnees/phyto/ : LISEZ-MOI.md, fiches/ (3 réelles),
               fixtures/, sources.json

DÉJÀ TRANCHÉ PAR LE PATRON — ne pas rouvrir, ne pas « simplifier »

Le principe, et il commande tout : LE MODÈLE OBSERVE, LA BASE DÉCIDE. Trois
barrières, et il faut les trois :
- le schéma de sortie du modèle n'a AUCUN champ où nommer un problème. Pas de
  « diagnostic », pas d'« hypothèse ». On ne conclut pas dans un formulaire qui
  n'a pas de case pour ça ;
- le vocabulaire est FERMÉ et PARTAGÉ entre l'observation et les fiches, et il
  est INJECTÉ dans la consigne, jamais recopié. Recopié, il divergerait au
  premier mot ajouté — et en silence : une fiche qui ne sort plus ne lève
  aucune erreur ;
- tout texte affiché sort d'une colonne de fiches_phyto. Aucune chaîne rendue
  par un modèle n'atteint l'écran.
Ajouter un mot au vocabulaire est donc un geste qui engage : il faut le proposer
au modèle (observation.ts) ET pouvoir l'écrire dans une fiche.

L'écran (sa règle produit du 20 août) :
- aucun formulaire, aucun choix d'essence, aucune saison à cocher ;
- aucun questionnaire : « je ne veux PAS d'un formulaire complexe ni d'un
  questionnaire systématique » ;
- aucune liste des diagnostics passés — elle viendra s'il la demande ;
- photographier OU choisir dans la bibliothèque : capture="environment" a été
  RETIRÉ, et sa règle du 21 août le dit pour les deux outils. Un feuillage qui
  jaunit se photographie quand on le voit, pas quand on ouvre Atlas ;
- l'attente est DITE et le bouton se désarme : sans ça, il appuie deux fois et
  deux analyses partent pour une seule photo.

Le moteur :
- QUATRE issues, et les trois dernières comptent autant que la première :
  un résultat · une photo de plus · « je ne peux pas confirmer » · « personne
  n'a regardé ». Les deux derniers ne se confondent JAMAIS : le premier dit que
  la base ne sait pas, le second que rien n'a regardé — les mêler envoie
  chercher un défaut dans les fiches alors qu'il est dans la configuration ;
- une seule relance photo, jamais deux, et l'invariant vit à trois endroits
  (le code qui lit la BASE, une contrainte CHECK, l'écran) ;
- sans ligne de confusions_phyto, PAS de relance : une consigne inventée
  enverrait photographier ce qui ne tranche rien ;
- AUCUN POURCENTAGE. Sa règle : « ne pas afficher de faux pourcentages du type
  93 % ». Trois mots, trois plafonds (photo floue, fiche indicative, essence non
  reconnue) ; le score interne est rangé en millièmes entiers exprès, pour
  décourager de l'afficher ;
- quatre risques jamais confondus : santé du végétal, mécanique de l'arbre,
  humain/animal, réglementaire. La phrase sur la stabilité vient du CODE, pas de
  la fiche — et elle SE TAIT quand l'impact est inconnu et la gravité faible.
  Corrigé le 20 août en regardant le résultat : un avertissement qui parle à
  tort s'apprend à être ignoré, et le jour où il compte il est devenu du décor ;
- une exclusion n'est pas un score bas : hôte strict d'une autre essence, partie
  non concernée — la fiche sort du jeu.

Les données :
- la base phyto est COMMUNE, sans RLS, en GRANT SELECT seul : une faille de
  l'application ne peut pas y écrire une maladie inventée. Ses diagnostics à lui
  sont isolés par RLS comme tout le reste ;
- NE PAS INVENTER DE FICHES pour que la démonstration tourne. Sa règle : « ne
  remplis pas artificiellement la base avec de fausses données ». Trois fiches
  réelles sur ~50, et l'écran qui refuse est le bon état ;
- les fixtures (zz-test-) sont tenues à l'écart par trois barrières sur trois
  chemins différents. Ne pas les affaiblir pour se simplifier un essai.

Les photos :
- l'EXIF est retiré AVANT tout — avant le rangement, avant l'envoi au
  fournisseur : une photo de jardin porte le GPS du domicile du client ;
- un fichier qu'on n'a pas su nettoyer est REFUSÉ, jamais rangé ;
- conservation configurable, jamais gravée : 90 jours pour une photo libre,
  aucune échéance une fois versée au dossier d'un chantier, et le rattachement
  RECALCULE l'échéance ;
- le diagnostic survit à sa photo, comme une note vocale survit à son audio.

CE QUI EST OUVERT — à lui montrer ou à lui demander, jamais à trancher seul

- TROIS FICHES RÉELLES sur la cinquantaine visée (fomès des résineux, les deux
  anthracnoses). Ce qui manque est la BIBLIOTHÈQUE, pas le moteur : hors de ces
  trois, l'outil répond « je ne peux pas confirmer », et rien n'est cassé.
- LA LICENCE INRAE (Ephytia) n'est pas tranchée — c'est la source la plus riche
  en descriptions de symptômes, donc celle qui permettrait d'écrire vite. Le
  courriel est PRÊT depuis le 20 août (docs/courriel-inrae.md) ; personne ne
  sait ici s'il a été envoyé. La réponse complète est dans docs/QUESTIONS.md
  §24, à citer plutôt qu'à reformuler.
- L'APPEL RÉEL DE VISION n'a jamais été joué sur une vraie photo : ce poste n'a
  pas de clé, les siennes sont posées (CLAUDE.md §1 ter). Ça se joue chez lui, et
  il envoie une capture. VISION_PROVIDER retombe sur le fournisseur de
  rédaction : sa clé Anthropic suffit, sans réglage de plus.
- LA RÈGLE « HÔTE D'ABORD » n'a jamais été mesurée : sans essence identifiée,
  Atlas ne conclut plus du tout. C'est voulu, mais personne n'a vu combien de
  photos réelles échouent à l'identification. C'est la PREMIÈRE chose à regarder
  le jour où la clé de vision tourne sur son banc.
- LES SEUILS (SEUIL_PLANCHER 0,35 · ECART_NET 0,15 · les plafonds de confiance)
  sont un point de départ assumé et nommé, pas mesuré. Ne les bouge pas au
  jugé : il faudrait de vraies photos et de vraies fiches.
- LA DURÉE DE CONSERVATION DES PHOTOS reste à trancher par lui. Attention,
  TODO.md est en retard là-dessus : le fournisseur de vision EST déjà au
  registre des sous-traitants (docs/RGPD.md, ligne « Vision (diagnostic
  végétal) », ajoutée le 20 août). Ce qui reste, c'est la durée, et ce que le
  fournisseur garde de la photo.
- LE NOM. Il appelle cet outil « reconnaissance des maladies » ; l'écran dit
  « Diagnostic végétal », et le vocabulaire couvre aussi les ravageurs (galerie,
  sciure, amas d'insectes, toile) et les champignons. Ne renomme pas sans lui —
  et si tu proposes, propose les deux sens.

CE QUE « IMPECCABLE » VEUT DIRE ICI

1. LE REFUS EST L'ÉCRAN PRINCIPAL, pas un cas d'erreur. Trois fiches en base :
   « je ne peux pas confirmer » est ce qu'il verra le plus souvent. Il doit dire
   ce qui a été vu, pourquoi ça ne suffit pas, et le geste qui débloque — jamais
   un message qui ressemble à une panne.
2. « Personne n'a regardé » se lit comme un défaut de configuration, pas comme
   un verdict sur la plante. Regarde les deux écrans côte à côte.
3. Ce qui s'affiche se TRACE : quelle fiche, quelle source, quelle date de
   consultation. Un conseil phytosanitaire sans sa source ne vaut rien devant un
   client — et c'est ce qui distingue Atlas d'un moteur de recherche.
4. Des mots de paysagiste. Un nom latin sans conduite à tenir n'aide personne.
5. Deux chartes sombres (Nuit, Sylve) où l'accent est CLAIR : aucune couleur
   écrite en clair, surPlein sur un aplat, voile() pour un voile. Aucune flèche
   décorative. Le moins de mots possible.

LES INVARIANTS

- Toute lecture des diagnostics passe par withEntreprise(utilisateurId,
  entrepriseId, fn). Hors de ce cadre, une requête ne renvoie rien,
  silencieusement.
- src/lib/diagnostic-vegetal.ts reste PUR : aucun appel réseau, aucune base,
  éprouvable sans clé. C'est là que vivent les vrais pièges.
- Français partout. Les couches ne remontent pas (CLAUDE.md §4 sexies).
- Pas de pansement, pas de code mort.

LA MÉTHODE

1. Lis ARCHITECTURE.md §135 EN ENTIER (135.1 à 135.11), les en-têtes de
   drizzle/0056 et 0057, donnees/phyto/LISEZ-MOI.md, la section « Diagnostic
   végétal » de HANDOVER.md, docs/QUESTIONS.md §24, PRODUCT.md, puis git log -20.
2. Dis-moi ce que tu as trouvé AVANT d'écrire une ligne : les trois choses les
   moins compréhensibles pour quelqu'un qui n'aime pas les téléphones, et les
   trois endroits où le module peut afficher quelque chose qu'aucune source ne
   fonde — chacun avec le fichier et la ligne qui le prouvent.
3. VOIS LE PARCOURS AVANT DE LE JUGER. Ici, avec les fixtures :

   source scripts/monter-base-locale.sh
   DATABASE_URL="$DATABASE_ADMIN_URL" npx tsx scripts/importer-fiches-phyto.ts donnees/phyto/fixtures --fixtures

   Elles ne sortent que si ATLAS_FIXTURES_PHYTO=1 est posé dans le processus qui
   lit : c'est une double garde délibérée, ne la retire pas.
4. Capture les QUATRE issues, à 390 × 664, en Origine ET en Nuit : un résultat,
   une demande de photo complémentaire, « je ne peux pas confirmer », « personne
   n'a regardé ». Les trois dernières sont celles qu'il verra.
5. Toute apparence ou tout geste nouveau se DESSINE d'abord : une maquette HTML
   dans appli/, un lien dans appli/essais.html, et l'adresse ENTIÈRE une fois
   qu'elle répond 200 — jamais une capture de la maquette.

LA BATTERIE, SUR SON POSTE WINDOWS

- Préviens-le AVANT de la lancer ; son accord vaut ensuite pour toute la
  séquence.
- Sa base vit dans Docker : docker start atlas-postgres atlas-redis
- Puis :

  export ATLAS_BASE_SUPER="postgresql://postgres:postgres_dev_pw@localhost:5432/atlas_test"
  npm run verifier:avant-livraison

- Les contrôles propres au diagnostic, à lire un par un dans le journal :
  test-diagnostic-vegetal (le moteur, sans base ni clé), test-diagnostic-base,
  test-observation-diagnostic, test-import-fiches-phyto, test-exif-diagnostic,
  test-diagnostic-sans-secret, test-diagnostic-ecrans-e2e.
- Ne joue rien à la main pendant qu'elle tourne : nettoyerBase() vide la base
  sous les pieds des suites navigateur, et elles accusent alors le produit.

LE RENDU

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : un verdict par point, le fichier qui le fonde, ce qui a été fait
autrement et pourquoi, ce qui a été refusé et ce que ça aurait coûté, les
chiffres exacts de la batterie, et ce qui reste ouvert avec qui peut le
trancher.
```

---

## Ce qui restera dans la catégorie Paysage

| | |
|---|---|
| La **fiche de chantier** — `/paysage/fiche` | le premier outil qui vit dans Atlas, rien depuis le 18 août |
| La **terrasse bois** | annoncée le 17 août, jamais commencée |
| Le **plan d'arrosage** | son prompt : `docs/prompt-impeccable-paysage-arrosage.md` |
