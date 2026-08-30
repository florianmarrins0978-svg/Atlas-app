# La note vocale « à la manière de WhatsApp » — ce qui a été fait

*30 août 2026 · branche `claude/voice-note-ui-simplify-8mwebk`*

---

## Ce qui a été demandé, et ce que ça donne

| Sa demande | État | Le fichier qui la porte |
|---|---|---|
| La note vocale comme celle de WhatsApp : poubelle ou avion | fait | `src/app/chantiers/[id]/AnneauNoteVocale.tsx` |
| L'avion mène directement au devis | fait | `DevisDepuisDictee.tsx` (`auto`, `surLeDevis={false}`) |
| Le bouton « Je rédige mon devis » moins large — sa largeur 4 (66 %) | fait | `PrimaryButton.tsx` (`part`), `FormulaireNouveauChantier.tsx` |
| Le bouton DISPARAÎT dès qu'on appuie sur la note | fait | `FormulaireNouveauChantier.tsx` (`dicteeEnCours`) |
| Il devient secondaire et s'appelle « Je rédige à la main » | fait | `PrimaryButton.tsx` (`secondaire`) |
| Le geste 2 : l'objet au centre, poubelle à gauche, avion à droite | fait | `globals.css`, bloc « LA NOTE VOCALE À LA MESSAGERIE » |
| Le repos B : micro plein, petites ondes de 1,5 cm de chaque côté | fait | `.atlas-frange { width: 1.5cm }` |
| Tout tient sur une page, sans faire défiler | fait | mesuré : 604 px de feuille, 601 de contenu |
| Pas de vide en bas | fait | 3 px au repos |
| L'écran ne se balade plus de droite à gauche | fait | deux causes trouvées, les deux corrigées |

---

## Les trois exigences de la fin, mesurées

Rien de tout cela ne se voit dans une suite fonctionnelle : c'est de la
géométrie. Un script les mesure sur **son** écran — 390 × 664, un iPhone 13
barre d'adresse déduite — en entrant **par son parcours** (accueil → « Nouveau
chantier », qui ouvre la fiche en feuille, pas en page) :

```
npx tsx scripts/capture-dictee-fiche-client.mts /tmp/captures
```

Ce qu'il rend aujourd'hui :

```
au repos  : la feuille montre 604 px et en contient 604 · à faire défiler rien ✓ · vide en bas 3 px ✓
     ✓ la page ne glisse pas latéralement
     ✓ rien ne dépasse à droite ni à gauche
en dictée : la feuille montre 604 px et en contient 604 · à faire défiler rien ✓ · vide en bas 40 px ✓
le bouton « Je rédige à la main » est PARTI ✓
après la poubelle, il est REVENU ✓
```

**Au départ, la feuille débordait de 492 px** — l'anneau et le bouton étaient
sous le pli, et il fallait faire défiler pour les atteindre.

**Les 40 px de vide pendant la dictée sont l'empreinte du bouton parti**, et
c'est voulu : il a demandé qu'il disparaisse. Faire grandir la zone de dictée
pour les combler ferait descendre le micro d'une vingtaine de pixels **sous le
doigt qui vient de l'appuyer** — le seul moment où l'écran doit être immobile.

---

## Le défilement latéral : deux causes, pas une

1. **Le champ du nom.** Il était `flex-shrink-0` sans `flex-1` : il gardait la
   largeur naturelle d'un `<input>`, 273 px, et poussait le téléphone à 421 —
   soit 31 px hors d'un écran qui en fait 390. Toute la page suivait.
2. **La pellicule de photos.** `-mx-[26px]` sur un écran qui a 24 px de retrait
   : deux pixels de débordement de chaque côté. Invisibles, et suffisants.

---

## Ce qui a été fait AUTREMENT que prévu, et pourquoi

**Les valeurs de resserrement viennent de SA planche, pas de mon jugement.**
Premier réflexe : rogner au petit bonheur — 46 px de case, 66 px de carré photo,
10 px de pastille. Puis relecture de `appli/note-vocale-choix.html`, celle qu'il
a validée et à laquelle il a demandé de se référer : **elle porte déjà toutes
ces mesures, et elles sont plus serrées que les miennes.**

| | Planche du 22 août | **Sa planche du 30 août** | Ce qui est codé |
|---|---|---|---|
| hauteur d'une case | 50 px | **44 px** | 44 px |
| retrait d'une case | 15/16 | **11/14** | 11/14 |
| rayon d'une case | 14 | **12** | 12 |
| carré photo | 74 px | **58 px** | 58 px |
| pastille Mr/Mme | 13/30 | **7/28** | 7/28 |
| interligne du formulaire | 16 px | **7 px** | 7 px |
| titre | 32 px | **27 px** | 27 px |

Il avait déjà resserré cet écran lui-même en choisissant sa planche. Le
travail était de le lire, pas de le refaire.

**Les intitulés en petites capitales sont partis — sauf deux.** « E-mail »,
« Adresse du chantier », « Comment lui envoyer son devis ? » et « Photos du
chantier » redisaient ce que la case montre déjà : 108 px pour rien. « Nom du
client » et « Téléphone » restent, **parce que sa planche les garde** : une case
vide de 152 px alignée à droite ne dit pas d'elle-même qu'elle attend un numéro.

Les quatre noms retirés ne sont pas perdus : ils passent en `aria-label`. Les
retirer vraiment fermerait l'écran à qui l'écoute.

**La place réservée sous le bouton a été rendue.** Dix-neuf pixels étaient
gardés en permanence pour qu'un message d'erreur ne fasse pas sauter la mise en
page. Cette ligne est la **dernière** de l'écran : rien ne la suit, donc rien ne
bouge quand elle paraît. C'était une protection qui ne protégeait rien.

---

## Ce qui a été corrigé en cours de route, et qui était faux

**Le script de mesure rendait un vert qui ne prouvait rien.** Il cherchait « ce
qui est dessiné » dans la feuille entière — or le cadre qui défile l'occupe
entièrement, donc le bas du contenu tombait toujours pile sur le bas de l'écran
et « vide en bas : aucun » sortait en vert **quoi qu'il arrive**. Corrigé : on
mesure à l'intérieur du cadre, jamais la feuille.

**Et il mesurait le mauvais écran, deux fois.** D'abord `/chantiers/nouveau` en
page, qu'il ne voit jamais — 200 px de contrainte qui n'existent pas. Puis le
document entier, alors que c'est la feuille qui défile en elle-même : la hauteur
du document ne bouge pas d'un pixel pendant que la moitié basse est sous le pli.

**Le contrôle sait rougir**, et cela a été éprouvé : `HAUTEUR=560` rend un écran
trop court, et il annonce alors les 101 px qui passent sous le pli.

**Deux classes CSS ont été baptisées avec des noms DÉJÀ PRIS**, et c'est le
défaut le plus sérieux de ce lot :

| Le nom repris | Ce qu'il servait déjà | Ce que ça cassait |
|---|---|---|
| `atlas-souffle` | les trois points de l'attente | des barreaux de 2 px invisibles |
| `atlas-aile` | les barreaux du lecteur de note | des ailes larges de 1,5 cm, en absolu |

**Aucun test ne l'aurait dit.** Une feuille de style n'a pas de portée : la
règle écrite le plus bas gagne, sur tous les écrans. L'écran qu'on code est
juste ; c'est l'autre qui casse, ailleurs, sans témoin. La classe s'appelle
maintenant `atlas-frange`, et `scripts/test-classes-atlas-uniques.ts` refuse
désormais tout nom repris — éprouvé en lui rendant l'ancien.

**Et le renommage a fait un second dégât, plus grave encore** : en changeant le
nom, j'ai aussi renommé les ailes du **lecteur** de note vocale, qui portaient le
même libellé. Elles ont pris les mesures de la dictée — 1,5 cm en absolu — et
sont parties **66 px hors de l'écran**. Chrome élargit alors le viewport de mise
en page de 390 à 456 px : tout rapetisse, et **la poignée du tiroir de la fiche
chantier passe sous le pli**, injoignable au doigt.

C'est très exactement la panne qu'il a fait corriger le même jour — *« l'écran
ne doit plus pouvoir se balader de droite à gauche »* —, réintroduite ailleurs
par ma propre correction. Trouvée par une suite (`test-retrait-differe`), puis
établie en rejouant la même suite sur le code d'avant : verte là, rouge ici. Le
lecteur a retrouvé son nom, et la zone de dictée refuse désormais d'élargir la
page quoi qu'il arrive (`overflow-x: clip`).

**Une suite a rougi pour rien pendant la première batterie**
(`test-fiche-pendant-relance.ts`). Cause : un serveur de développement tournait
à côté et tenait le port 3000. C'est exactement ce que `CLAUDE.md` §5 interdit —
la batterie est une machine à un seul occupant. Rejouée seule : verte. Rejouée
dans une batterie propre : verte.

---

## Ce qui n'a PAS été touché, et pourquoi

- **La réserve de 104 px sous la note vocale.** Elle empêche l'écran de sauter
  au moment de l'appui. La rogner aurait rendu 12 px et coûté la stabilité du
  seul geste qui compte sur cet écran.
- **Le liseré doré en tirets du carré photo.** C'est ce qu'il montrait du doigt
  le 22 août ; seule la taille a suivi sa nouvelle planche.
- **Le débit, la portée, l'arrosage.** Rien de ce lot n'y touche.

---

## Les suites qui rougissaient, et pourquoi on les a ADAPTÉES

Cinq suites visaient l'ancien dessin plutôt que la règle. Aucune n'a été
écartée, aucune assertion supprimée :

| La suite | Ce qu'elle visait | Ce qu'elle vise maintenant |
|---|---|---|
| `test-anneau-dictee-e2e` | l'anneau creux, et « arrêter » écrit sous lui | le disque, et les trois signes qui naissent : poubelle, avion, compteur |
| `test-anneau-vers-devis-e2e` | le second appui pour envoyer | l'avion, qui envoie |
| `test-madame-lucie-e2e` | le bouton « Mon devis » | le chantier CRÉÉ, lu en base |
| `test-nouveau-chantier-e2e` | le texte « Comment lui envoyer son devis ? » | la place des capsules sous l'adresse |
| `test-coordonnees-depuis-accueil-e2e` | quatre intitulés écrits à l'écran | les quatre CASES, par leur nom accessible |

C'est la règle du dépôt, et elle était déjà écrite dans deux de ces fichiers :
*« quand une suite rougit après un retrait qu'il a demandé, on adapte le
contrôle, on ne remet pas le libellé »*. Une assertion posée sur un mot rend
l'écran impossible à changer.

## Ce qui n'est PAS vérifiable ici, et qu'il faudra regarder sur votre espace

**L'avion mène au devis** — le chemin est codé (`DevisDepuisDictee`, `auto` et
`surLeDevis={false}` : la chaîne part seule, puis va sur la page du devis). Mais
il ne se parcourt pas jusqu'au bout sur cette machine : **elle n'a aucune clé
d'IA**, le mandataire refuse les fournisseurs, et la transcription s'arrête donc
sur « la note n'a pas été transcrite ». Ce qui est éprouvé ici, c'est que la
note part, que le chantier se crée, et que la chaîne démarre toute seule ; ce
qui reste à voir chez vous, c'est la dernière marche.

Le geste à faire, une fois le lot arrivé : ouvrir une fiche client, appuyer,
dire deux phrases, appuyer sur l'avion — et dire si le devis s'ouvre.

## Ce qui reste ouvert

| Point | Qui peut le trancher |
|---|---|
| Sur un écran plus court qu'un iPhone 13 (un SE, 667 − barre = 560), la feuille déborde encore de 101 px | lui — dire si ce téléphone-là compte |
| Les 40 px libérés par le bouton pendant la dictée restent vides | lui — c'est un choix d'apparence, pas un défaut |
