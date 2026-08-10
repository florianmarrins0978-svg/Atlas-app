# Poser la charte Origine dans l'application

> **État au 10 août 2026, au soir.** Cette fiche a été écrite sur une branche
> qui ne portait pas encore la refonte. Depuis, sont **faits** : §1 à §3 et §5
> (la charte, la liste en fil, la perle, le bandeau), **§4 — le retrait**, sur
> les huit endroits qui suppriment, et **§6 bis — la note vocale et les photos
> de la fiche chantier**.
>
> Deux corrections au recensement du §4, payées à l'essai : ils sont **huit et
> non sept** (le planning supprimait lui aussi, par `CarteGlissante`), et
> **l'un des huit ne prend pas le glissement, à dessein** — une vignette carrée
> dans une grille de trois n'est pas une ligne ; la photo garde le mot, la
> couleur, le tiroir et l'écriture différée, et se retire depuis la
> visionneuse. Un troisième morceau non prévu ici porte tout cela :
> `useRetraits` (délai, pile des retraits, écriture différée).
>
> Le §2 décrit encore `ListeChantiers` comme « une pile de cartes » : ce n'est
> plus vrai. **Reste ouvert : §6, l'ouverture de « Nouveau chantier »**, et le
> point de produit qu'il faut poser au patron avant de coder.
>
> Ce qu'il faut savoir pour reprendre : `ARCHITECTURE.md` §48 (le retrait) et
> §49 (l'anneau et le tiroir de la fiche).

Fiche de reprise pour la conversation qui fera le travail. Elle décrit **ce que
le patron a retenu le 2026-08-10**, le code exact des maquettes, et les pièges
déjà payés à l'essai.

La maquette de référence est `maquettes/atlas-origine.html` (dans ce dépôt).
Elle s'ouvre dans un navigateur, sans rien monter.

**Ce n'est pas du code à recopier tel quel.** La maquette n'a aucun JavaScript
parce que le lecteur du patron n'en exécute pas ; l'application, elle, est du
Next.js dans Safari. Ce qui doit être reproduit à l'identique, c'est **l'aspect
et les gestes** — pas les cases à cocher qui les simulent.

---

## 1. Les cinq choix

| | Retenu | Ce que ça veut dire |
|---|---|---|
| Charte | **Origine** | fond `#edece6`, plage `#f7f6f2`, encre `#16170f`, gris `#83867c`, bronze `#8f7130`, filets `rgba(22,23,15,.13)`, plein `#2a3a2e` |
| Trait du bandeau | **G** | il dépasse sa cible et revient ; le mot choisi monte de 2 px |
| La perle du fil | **elle suit** | devant le 22 juillet au repos, accrochée à mi-hauteur dès que ce chantier remonte, **un chantier par glissement** |
| « Nouveau chantier » | **l'écran recule** | la liste passe à 93 % et s'assombrit, la feuille monte devant |
| Retirer une ligne | **le tiroir des retirés** | le texte glisse, la ligne tombe, un tiroir s'ouvre : « Retiré à l'instant — Annuler » |

Deux refus explicites, à ne pas défaire :

- **Aucun cheveu sous « ATLAS »** — seul reste celui qui ferme l'en-tête,
  au-dessus de « Nouveau chantier ».
- **Aucun champ « nom du chantier »** — supprimé le 5 août 2026 : c'était le
  seul qui demandait au patron d'inventer quelque chose. Le nom se déduit du
  client, sinon de l'adresse, sinon de la date.

---

## 2. La liste « en fil »

C'est le vrai chantier : `src/app/ListeChantiers.tsx` empile aujourd'hui des
cartes (`CarteGlissante`), sans tige ni dates en marge. Tout le reste en dépend.

```css
.liste{flex:1;min-height:0;overflow-y:auto;
       scroll-snap-type:y mandatory;scroll-padding-top:44px;
       -webkit-overflow-scrolling:touch;padding:10px 0 14px;
       mask-image:linear-gradient(180deg,transparent 0,#000 20px,
                                  #000 calc(100% - 20px),transparent 100%)}

/* La marge de fin est ICI, sur le fil, jamais sur le cadre. */
.tige{position:relative;margin:0 26px;padding-bottom:104px}
.tige::before{content:"";position:absolute;left:47px;top:12px;bottom:116px;
              width:1px;background:var(--trait)}

.ligne{position:relative;overflow:hidden;max-height:170px;
       scroll-snap-align:center;scroll-snap-stop:always}
.brin{display:grid;grid-template-columns:47px 1fr;gap:0 26px;padding:17px 0}
.jour{grid-row:1 / span 3;text-align:right;padding-right:13px;color:var(--gris)}
.jour b{display:block;font:400 19px/1 ui-serif,Georgia,serif;color:var(--encre)}
```

**`scroll-snap-stop: always` est ce qui fait « un chantier à la fois ».** Sans
lui, un geste vif en saute trois et la perle paraît sauter.

---

## 3. La perle

```css
.perle{position:sticky;top:calc(50% - 23px);height:0;z-index:2;pointer-events:none}
.perle i{position:absolute;left:47px;top:23px;width:7px;height:7px;
         border-radius:99px;transform:translate(-50%,-50%);
         background:var(--attente);box-shadow:0 0 0 4px var(--fond)}
```

Le repère est **posé dans le flux** juste avant la ligne qu'il désigne au repos.
Trois pièges, tous payés :

1. **La marge de fin va sur `.tige`, pas sur `.liste`.** Sur le cadre, elle
   rétrécit la zone de défilement, et le `50 %` du `sticky` se résout contre
   elle : la perle part **54 px trop haut**.
2. **Les 23 px** font tomber le point à mi-hauteur exacte une fois accroché.
   **À recalibrer** sur les vraies dimensions (haut de ligne → ligne du nom).
3. **Si la page reste le conteneur de défilement**, retrancher aussi la moitié
   de la barre basse, sans quoi le « centre » n'est pas le centre visible.

**Conséquence assumée, signalée deux fois et maintenue :** la perle ne désigne
plus le chantier dont le devis est revenu, puisqu'elle suit le doigt. Seul reste
le libellé « Devis retourné », en bronze. Ne pas « corriger » cela en croyant
retrouver l'intention d'origine.

---

## 4. Le retrait — le tiroir des retirés

### Le glissement ne prend que la colonne du texte

```css
/* Le voile de 16 px : le texte qui sort se DISSOUT au lieu d'être tranché en
   plein mot. La marge négative et le retrait intérieur s'annulent, si bien
   qu'au repos la première lettre est intacte. */
.glisse{display:flex;min-width:0;margin-left:-16px;overflow-x:auto;
        scroll-snap-type:x mandatory;scrollbar-width:none;
        overscroll-behavior-x:contain;
        mask-image:linear-gradient(90deg,transparent 0,#000 16px)}
.glisse::-webkit-scrollbar{display:none}
.volet{flex:0 0 100%;scroll-snap-align:start;padding-left:16px}
.decouvre{flex:0 0 92px;scroll-snap-align:end;display:flex;align-items:center;
          justify-content:flex-end;color:var(--bronze);
          font-size:10px;letter-spacing:.26em;text-transform:uppercase}
```

**La date et le fil ne bougent pas.** Faire partir la ligne d'un bloc coupe le
nom en plein mot et laisse le fil traverser les lettres : ça se lit comme un
défaut d'affichage, pas comme un geste.

### La chute et le tiroir

```css
.ligne{transition:max-height .44s .2s cubic-bezier(.4,0,.2,1)}
.brin{transition:transform .44s cubic-bezier(.4,0,.6,1),opacity .34s .1s}
/* état « retirée » */
.ligne.partie{max-height:0}
.ligne.partie .brin{transform:translateY(46px);opacity:0}

.tiroir{flex:none;display:flex;justify-content:space-between;align-items:center;
        margin:0 26px;padding:0;max-height:0;overflow:hidden;opacity:0;
        border-top:1px solid transparent;
        transition:max-height .42s cubic-bezier(.22,.61,.36,1),opacity .3s,
                   padding .42s,border-color .3s}
.tiroir.ouvert{max-height:60px;opacity:1;padding:15px 0 4px;
               border-top-color:var(--trait)}
.tiroir .quoi{font-size:11.5px;color:var(--gris)}
.tiroir .agir{font-size:10px;letter-spacing:.24em;text-transform:uppercase;
              color:var(--bronze)}
```

Le tiroir se place **entre la liste et le bandeau**, dans le même conteneur en
colonne : il pousse la liste vers le haut au lieu de la recouvrir.

### Ce que la maquette ne peut pas montrer

- **« Annuler » doit viser la ligne réellement retirée.** Un libellé unique
  pointant toujours la même ligne rend la première quand on retire la deuxième :
  l'annulation *supprime*. Dans l'application, le tiroir porte l'identifiant du
  dernier retrait.
- **Il faut un vrai délai avant l'écriture en base** — la maquette ne fait que
  cacher. Le tiroir se referme quand le délai passe, et c'est à ce moment que le
  retrait devient définitif.
- **Le décompte suit ce qui reste.** « Huit en cours » au-dessus de six lignes
  est le genre de détail qui décide seul du sentiment de soin.
- **Un chantier facturé ne se retire pas** — sa facture figure au relevé de TVA.
  Il n'apparaît pas sur cet écran (il vit sous « Terminés ») : c'est **là-bas**
  que le refus doit s'écrire, et il doit dire pourquoi.

### 4 bis. Le même retrait partout — les sept endroits

Le patron, le 2026-08-10 : *« je veux qu'il applique ce style à tout ce qu'on
peut supprimer dans l'appli »*. Aujourd'hui, sept endroits suppriment, avec
**trois mécaniques différentes** — glissement, croix nue, panneau de
confirmation. C'est cette dispersion qu'il faut faire disparaître.

| Où | Quoi | Comment aujourd'hui |
|---|---|---|
| `src/app/ListeChantiers.tsx` | un chantier | `CarteGlissante` : glissement + corbeille |
| `src/app/chantiers/[id]/photos/PhotosClient.tsx` | une photo | croix, puis panneau « Supprimer cette photo ? » |
| `src/app/chantiers/[id]/note-vocale/NoteVocaleClient.tsx` | la note vocale | bouton, puis panneau « Supprimer cette note vocale ? » |
| `src/app/chantiers/[id]/prix/PrixClient.tsx` | une ligne de prix | `AnimatedRow` : croix nue |
| `src/app/chantiers/[id]/informations/InformationsClient.tsx` | une prestation, un matériel | `AnimatedRow` : croix nue |
| `src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx` | une ligne du devis | croix nue |
| `src/app/reglages/ReglagesClient.tsx` | un tarif | bouton « Supprimer » |

**Deux composants partagés, et aucun geste réinventé sur place :**

- `LigneRetirable` — remplace `AnimatedRow` **et** `CarteGlissante`. Elle porte
  le glissement (colonne du texte seule), la chute, et signale le retrait.
- `TiroirDesRetires` — un par écran, posé entre le contenu et le bas de page.

**Ce que ce changement déplace, et qui doit être décidé en le sachant :** la
sécurité passe d'une **confirmation avant** à une **réversibilité après**. Les
deux panneaux « Supprimer cette photo ? » et « Supprimer cette note vocale ? »
disparaissent donc — sinon l'écran demande deux fois. C'est le cœur du geste
retenu ; ne pas le garder « au cas où ».

**Trois conséquences à ne pas manquer :**

1. **Le délai d'annulation précède l'écriture destructrice.** Tant que le tiroir
   est ouvert, rien n'est effacé pour de bon. La note vocale et les photos ont
   un fichier derrière elles : leur purge passe déjà par `audios_a_purger` —
   ne pas la déclencher avant la fermeture du tiroir.
2. **Un chantier facturé refuse toujours**, et dit pourquoi. `CarteGlissante`
   portait déjà `desactive` pour cela : la nouvelle ligne doit garder l'idée,
   avec le motif visible plutôt qu'un simple blocage.
3. **Le décompte de l'écran suit le retrait** partout où il en existe un
   (« Huit en cours », « 6 photos », le total du devis). Un compteur qui ne
   bouge pas fait douter que le retrait ait eu lieu.

Les maquettes `src/app/design/photos` et `src/app/design/informations` montrent
les anciens gestes : les mettre à jour ou les retirer, mais ne pas les laisser
contredire l'application.

---

## 5. Le bandeau — trait G

```css
.bas{position:relative;display:grid;grid-template-columns:repeat(4,1fr);
     border-top:1px solid var(--trait);padding:18px 14px 30px;background:var(--fond)}
/* La chasse de la charte ne tient PAS ici : « CHANTIERS » en .28em mesure
   86 px pour une colonne de 85 et vient coller « PLANNING ». C'est le seul
   endroit de l'écran où quatre mots doivent tenir côte à côte. */
.bas label{font-size:9px;letter-spacing:.15em;text-transform:uppercase;
           text-align:center;color:var(--gris);padding-bottom:8px;
           transition:color .32s cubic-bezier(.22,.61,.36,1),
                      transform .34s cubic-bezier(.34,1.4,.5,1)}
.bas label.actif{color:var(--encre);transform:translateY(-2px)}

.trait{position:absolute;left:14px;bottom:30px;width:calc((100% - 28px) / 4);
       pointer-events:none;
       transition:transform .54s cubic-bezier(.34,1.4,.5,1)}
.trait i{display:block;height:1px;background:var(--bronze)}
/* onglet n : transform:translateX((n-1) * 100%) */
```

Le rebond de `cubic-bezier(.34,1.4,.5,1)` **est** l'effet G : le trait dépasse
sa cible et revient. Ne pas l'adoucir.

`src/components/atlas/AtlasBottomNav.tsx` perd ses icônes.

---

## 6. « Nouveau chantier » — l'écran recule

```css
.dessous{transition:transform .56s cubic-bezier(.22,.61,.36,1),filter .56s}
.dessous.recule{transform:scale(.93) translateY(-10px);filter:brightness(.78)}

.feuille{position:absolute;left:0;right:0;bottom:0;top:60px;z-index:5;
         display:flex;flex-direction:column;overflow:hidden;
         background:var(--fond);border-radius:26px 26px 0 0;
         box-shadow:0 -22px 50px rgba(20,18,14,.22);
         transform:translateY(100%);visibility:hidden;
         transition:transform .56s cubic-bezier(.22,.61,.36,1),visibility 0s .56s}
.feuille.ouverte{transform:translateY(0);visibility:visible;
         transition:transform .56s cubic-bezier(.22,.61,.36,1),visibility 0s 0s}

/* Le contenu entre APRÈS la feuille, dans l'ordre de lecture. */
.dedans > *{opacity:0;transform:translateY(12px);transition:opacity .4s,transform .4s}
.feuille.ouverte .dedans > *{opacity:1;transform:none}
/* puis transition-delay croissant : .24s, .30s, .36s, .40s, .44s… */
```

**C'est la profondeur qui dit « on est passé au-dessus », pas le voile.**

Le décalage porte sur les **enfants** (`.dedans > *:nth-child(n)`). Viser
« le premier bloc portant telle classe » ne désignait personne pour n = 1 et 2 :
deux champs arrivaient alors sans délai — donc avant les autres, en laissant des
trous à leur place.

**Réserve non levée :** « Nouveau chantier » est aujourd'hui une **page**
(`/chantiers/nouveau`, avec sa flèche de retour), pas une feuille modale.
L'ouverture retenue raconte une feuille. Soit l'écran devient une vraie feuille
— et la flèche cède la place à un geste de fermeture vers le bas —, soit
l'ouverture devra changer. **Le patron a tranché sur le style ; ce point de
produit reste ouvert : le lui poser avant de coder cette étape.**

---

## 6 bis. La note vocale sur la fiche chantier

**Choisi par le patron le 2026-08-10.** Maquette :
`maquettes/atlas-note-vocale.html`, contrôlée par
`npm run verifier:maquette`.

Un **anneau muet** remplace la ligne « Note vocale » comme accès direct : il se
pose entre le pavé de bas de fiche et le tiroir, seul et centré. Aucun libellé
visible — mais un nom accessible « Écouter la note vocale ».

```css
/* Le vert tient le tour, l'or se pose dedans. Trois traits au centre. */
.vert{width:74px;height:74px;border:1.5px solid var(--plein)}   /* #2a3a2e */
.or  {width:56px;height:56px;border:1px solid var(--bronze)}    /* #8f7130 */
.anneaux{min-width:76px;min-height:76px}                        /* la prise */
```

**À la lecture** : les trois traits battent, les secondes apparaissent, et de
chaque côté des barreaux partent du centre vers l'extérieur en s'effaçant au
bout — hauteurs inégales et départs décalés, sinon l'onde ressemble à un décor.
Dans l'application, ces hauteurs suivent le **volume réellement enregistré**, et
le compteur la **lecture réelle** (la maquette n'a qu'une horloge CSS).

**Trois règles qui ne se voient pas mais se sentent :**

1. **Tout est en pause au repos.** Une onde qui bat quand rien ne joue fait
   croire qu'un son sort du téléphone.
2. **Les ailes ne prennent jamais le doigt** (`pointer-events:none`). Un barreau
   qui passe sous le pouce volerait l'appui destiné à l'anneau.
3. **La prise vaut 76 px** quand le trait n'en dessine que 56. Une icône fine
   qu'on rate deux fois sur trois n'est pas élégante, elle est ratée.

### Retirer la note — on fait MONTER l'anneau

Le doigt pousse l'anneau vers le haut, « Retirer » se découvre dessous.
L'issue est **celle des chantiers** : les traits rentrent dans l'anneau — la
voix se ramasse au lieu de s'évaporer —, l'anneau se contracte et part, et
« Note vocale retirée — Annuler » vient à sa place.

- **La consigne doit dire le geste réel.** La première version annonçait
  « faites descendre » alors que le doigt fait monter : une consigne fausse
  coûte plus cher qu'aucune consigne.
- **Le déclencheur s'efface avec la note.** « Retirer » restait allumé et
  s'imprimait par-dessus « Annuler ». Le contrôle qui aurait dû le voir lisait
  l'opacité de l'élément seul, pas celle héritée de son parent : interroger
  `Element.checkVisibility({opacityProperty:true})`.
- **`overscroll-behavior: contain`** sur le glisseur, sinon le doigt emporte
  toute la page avec l'anneau.
- **Rien n'est effacé tant qu'« Annuler » est à l'écran** : la purge du fichier
  part après, jamais avant (voir §4 bis).

### La pellicule, dans le tiroir

Les vignettes deviennent des boutons — on les touche pour ouvrir — et la
**case « + » vient en PREMIER** : posée à la fin, il fallait faire défiler six
photos pour la trouver. La ligne « Photos · 6 » disparaît : elle comptait ce qui
est désormais sous les yeux.

`scroll-padding-left: 26px` sur la pellicule, sinon l'accroche vise le bord du
cadre et le glisseur se décale seul de 26 px au chargement — la première photo
arrive déjà coupée.

### L'en-tête de la fiche ne suit PAS la maquette — décidé le 10 août 2026

La maquette montre, autour de l'anneau, une **scène** entière : grand titre
serif, phrase de situation, à la place de l'en-tête commun. **Elle n'a pas été
reprise, et c'est une décision du patron, pas un oubli** — la question lui a
été posée en image, sa réponse : *« N'y touche pas. »*

`EnTeteEcran` est une **pièce partagée** par la fiche, le planning, les
terminés, les réglages et les six écrans d'étape. La refaire pour la seule
fiche désaccorderait cet écran de tous les autres ; la refaire partout serait un
lot en soi, touchant l'accueil — que le patron a arrêté.

**Ne pas « corriger » cet écart en le découvrant.** Il est connu et voulu.

### Fait le 10 août 2026 — et trois pièges que la maquette ne pouvait pas poser

Tout ce qui précède est en place (`AnneauNoteVocale.tsx`, `TiroirFiche.tsx`).
Trois défauts sont apparus au passage à l'application, tous **trouvés à l'œil
sur capture**, aucun par un contrôle :

1. **`display: flex` n'étire pas un `<button>`.** La maquette pose un
   `<label>` pour « Retirer » ; l'application pose un vrai bouton, et un
   contrôle de formulaire garde une largeur au contenu même déclaré `flex`. Le
   mot se retrouvait collé au bord gauche, son R à moitié dehors, pendant que
   tous les contrôles passaient : il existait, il était visible, il répondait
   au doigt. **`width: 100%` est donc obligatoire ici, et ne l'était pas là-bas.**
2. **`--atlas-barre` est une réserve de place (68 px), pas la hauteur que la
   barre dessine (49 px).** Le tiroir posé dessus laissait dépasser 84 px au
   lieu de 65, et une bande de pellicule affleurait sous le résumé. Le tiroir
   mesure donc la barre réelle. **Corriger la variable aurait déplacé le cheveu
   du bandeau sur tous les écrans, dont l'accueil, que le patron a arrêté.**
3. **L'écran de dessous doit reculer** quand le tiroir monte
   (`scale(.955) translateY(-16px)` + `brightness(.9)`), comme la feuille
   « Nouveau chantier ». Sans ce recul, le tiroir tranche l'anneau par le
   milieu et l'écran a l'air cassé, pas superposé.

Les cinq états de la fiche se capturent en une commande :
`npx tsx scripts/capture-fiche-note-vocale.mts <dossier> <id-chantier>`.

## 6 ter. Nommer les équipes — et se taire quand il n'y a personne

**Demandé par le patron le 2026-08-10.** Maquette :
`maquettes/atlas-equipes.html`, contrôlée par `npm run verifier:maquette`.

*« Il faut que dans le fichier réglages on puisse mettre le nom des équipes —
soit équipe A équipe B, soit des noms et prénoms. Mais s'il n'a pas d'équipe et
qu'il ne met rien, il ne faut pas qu'il y ait quand même écrit équipe A équipe
B. »*

**La règle, et elle n'est pas cosmétique :**

| Combien d'équipes | Ce que Réglages propose | Ce que le planning écrit |
|---|---|---|
| **1** | rien à nommer — le bloc « leurs noms » n'existe pas | **aucun nom d'équipe.** Une demi-journée est libre, ou elle porte le nom de son chantier |
| **2 et plus** | une ligne par équipe, un champ libre par ligne | le nom écrit ; **à défaut**, « Équipe A », « Équipe B » |

Le principe qui tient les deux lignes du tableau : **on n'invente jamais un nom,
et on ne laisse jamais deux lignes indiscernables.** À une équipe il n'y a
personne à distinguer, donc rien à écrire ; à deux, la lettre est un repli
assumé — elle ne prétend rien savoir de personne. C'est le même arbitrage que
pour les prix (`docs/AGENT.md` §3) : sans source fiable, on n'écrit pas.

**Le repli se montre, il ne s'explique pas.** Le champ vide affiche déjà
« Équipe A » en gris : ce qui sera écrit à sa place est sous les yeux avant
d'être subi. Aucune phrase n'a à le raconter.

**Le compteur va de 1 à 20**, comme `entreprises.nombre_equipes` aujourd'hui —
et le nombre de lignes de noms le suit exactement. Le − est inerte à 1, le + à
20 : la borne se voit avant d'être rencontrée.

**Trois pièges déjà payés :**

- **Ne pas proposer de nommer ce qui ne sera jamais lu.** Laisser le bloc des
  noms à une seule équipe serait un piège : le patron y écrirait un prénom qui
  n'apparaîtrait nulle part.
- **Le champ fait 17 px.** En dessous de 16, Safari zoome à la mise au point et
  l'écran saute sous le doigt.
- **Un contrôle de visibilité ne lit pas `display` sur l'élément seul.** Les
  vingt lignes de noms gardaient `display:flex` alors que leur bloc parent était
  caché : le contrôle lisait vingt lettres sur un écran vide, et il est resté
  vert pendant que l'écran ne montrait rien au-delà de trois équipes. Seule la
  capture l'a vu. Interroger `Element.checkVisibility()`, jamais le style propre.

**Côté code, ce que cela suppose** — c'est `TODO.md` §5, et rien n'est écrit
encore : une table `equipes` (`nom` **nullable** — un nom absent est un état
normal, pas une donnée manquante), une colonne `chantiers.equipe_id`, et
**une seule fonction pure** qui décide du libellé à afficher, appelée par le
planning comme par la revalidation. Deux implémentations de cette règle
divergeraient, et le jour où elles divergent l'écran promet une équipe que le
serveur ne connaît pas.

---

## 6 quater. Le planning — le mois, et la journée qui s'ouvre dessous

**Choisi par le patron le 2026-08-10** (variante « le mois »). Maquette :
`maquettes/atlas-planning.html`, contrôlée par `npm run verifier:maquette`.
La règle de nommage des équipes est au §6 ter ci-dessus ; cette section décrit
l'écran.

L'écran remplace `src/app/planning/PlanningClient.tsx`.

### Le mois

Un calendrier de sept colonnes, et **rien qui ressemble à un tableau** : pas de
bordure, pas de fond de case, un chiffre en serif de 15 px par jour.

```css
.sem7 span{font-size:8px;letter-spacing:.16em;text-transform:uppercase} /* lun…dim */
.grille{display:grid;grid-template-columns:repeat(7,1fr);gap:2px 0}
.case{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:5px;border-radius:99px;
      font:400 15px/1 ui-serif,Georgia,serif}
```

**Cinq marques, pas quatre** — un point de 5 px sous le chiffre. Quatre ne
suffisaient plus dès qu'il y a plusieurs équipes :

| Marque | Ce qu'elle dit |
|---|---|
| rien | journée entièrement libre |
| **anneau creux** | il reste de la place — au moins une équipe libre |
| **demi-disque haut** | le matin est complet pour toutes les équipes |
| **demi-disque bas** | l'après-midi est complet |
| **disque plein** | journée pleine |

```css
.occ{width:5px;height:5px;border-radius:99px;background:transparent}
.occ.reste{box-shadow:inset 0 0 0 1px var(--bronze)}
.occ.m{background:linear-gradient(180deg,var(--bronze) 50%,transparent 50%)}
.occ.a{background:linear-gradient(180deg,transparent 50%,var(--bronze) 50%)}
.occ.p{background:var(--bronze)}
```

Aujourd'hui est **en bronze**, pas en pavé. Les samedis et dimanches sont
estompés **par la couleur** (`rgba(22,23,15,.28)`), jamais par l'opacité :
l'animation d'arrivée finit à `opacity:1` et l'emporterait.

**Ces marques se recalculent** à partir de `src/server/disponibilites.ts` —
`creneauxDuChantier` pour les demi-journées, `departPossible` pour « complet »
qui se compte **par équipe**, `jourSuivantOuvre` pour les week-ends. Dans la
maquette elles sont figées : c'est la seule chose qu'elle ne peut pas montrer.

### La journée s'ouvre par une ANCRE, jamais par une case à cocher

**Deux fois de suite le patron a écrit « rien ne s'ouvre quand je touche un
jour »**, avec quarante contrôles au vert. Le couple `<label>` + case à cocher
fonctionne en laboratoire et se dérobe sur son iPhone (voir §7 bis). Un lien
ordinaire est honoré partout — et il **amène** la journée à l'écran :

```html
<a class="case" href="#j20">20<span class="occ reste"></span></a>
...
<div class="journee" id="j20">…</div>
```
```css
.journee{display:none;scroll-margin-top:190px}
.journee:target{display:block}
```

**La journée se pose directement sous le calendrier**, pas après la légende :
posée plus bas, elle s'ouvrait hors du champ et l'écran paraissait mort.

Dans l'application, ce sera de l'état React ordinaire — mais **le comportement
doit rester celui-là** : ouvrir *et* amener à l'écran.

### Ce que la journée contient

1. La date en serif 23 px — « Jeudi 20 août ».
2. Une ligne grise : « Où poser « Chez M. Martins » ? »
3. **MATIN**, puis **APRÈS-MIDI**, en capitales espacées suivies d'un filet.
4. Sous chacun, **une ligne par équipe** — un filet dessous, jamais un cadre.
   Une équipe prise **nomme son chantier** en gris ; une équipe libre affiche
   « Libre » en bronze. (À une seule équipe : ni ligne ni nom, voir §6 ter.)
5. Choisir une ligne libre : une **perle bronze** paraît devant le nom, le filet
   passe au bronze, « Libre » passe à l'encre.
6. **Un seul bouton**, jamais trois lignes : « Poser · matin · Théo → ».
7. Une ligne grise : « Touchez un chantier posé pour changer son équipe. »

**Poser, c'est dire à la fois QUAND et QUI.** Le bouton ne s'arme qu'une fois
l'équipe choisie ; une date sans équipe laisse le travail à moitié fait.

Un jour **plein** ne propose aucune ligne et dit quoi faire : « Journée pleine —
Portail coulissant et Dalle de garage. Il faudrait une troisième équipe. » Un
**samedi** rappelle la règle qui surprend : un chantier de deux jours parti
vendredi matin finit **lundi**.

### Sous le calendrier

Une légende des cinq marques, une phrase qui dit ce que « complet » veut dire,
puis **« SANS DATE »** — les chantiers acceptés qui attendent encore un jour,
nom en serif à gauche, état à droite (« Devis accepté » en bronze).

### Trois pièges déjà payés

- **Le calendrier doit dire vrai.** Le 1er août 2026 est un **samedi** : j'avais
  quatre cases de juillet au lieu de cinq, et tout le mois glissait d'un jour.
  Écrire des contrôles sur les colonnes du 1er, du 10, du 15 et du 31.
- **Un sélecteur de frère ne sort jamais de son parent.** Ce piège a mordu
  **quatre fois** : les boutons radio qui commandent les créneaux doivent être
  **frères** de ce qu'ils commandent, jamais enfermés dans un conteneur.
- **`label:nth-of-type(n)` compte dans son propre bloc.** La ligne choisie
  s'allumait sur le matin **et** l'après-midi à la fois. Donner à chaque ligne
  son rang en clair (`.r1`…`.r4`), et vérifier qu'**une seule** s'allume.

### Le trait du bandeau

Il doit tomber sous **l'onglet actif**. Recopié depuis un écran où le premier
onglet était choisi, il est resté sous « CHANTIERS » pendant que « PLANNING »
était le mot allumé — 77 px d'écart, **vu par le patron sur une capture**
pendant que le contrôle du libellé actif restait vert. Le contrôle mesure
désormais l'écart entre le centre du trait et le centre du **texte** de l'onglet
(`Range.getBoundingClientRect`) : la boîte du libellé vaut sa colonne entière et
masquait le décalage.

---

## 7. Ordre de travail

Chaque étape est utilisable seule.

1. **La charte** — `src/lib/design-tokens.ts`, `src/app/globals.css`,
   `public/manifest.json`, `docs/DESIGN_SYSTEM.md`. **Les quatre ensemble**,
   sinon deux chartes coexistent comme en juillet.
2. **La liste en fil** — `ListeChantiers.tsx`. La perle en dépend entièrement.
3. **La perle**, avec ses trois pièges et ses deux valeurs à recalibrer.
4. **Le bandeau** — `AtlasBottomNav.tsx`.
5. **Le retrait** — il remplace la corbeille de `CarteGlissante`.
6. **L'ouverture** — après avoir tranché le point de produit ci-dessus.
7. **La note vocale sur la fiche chantier** — l'anneau, la lecture, le retrait
   par le haut, la pellicule (§6 bis). Indépendante des autres étapes.
8. **Le planning** (§6 quater) — le mois, les cinq marques, la journée qui
   s'ouvre dessous. Ne dépend d'aucune des étapes précédentes.
9. **Les équipes nommées** (§6 ter) — Réglages d'abord, planning ensuite. Cette
   étape-là touche la base : elle ne se fait pas en même temps que les autres.

---

## 7 bis. Le défaut que les contrôles ne peuvent pas voir

**Safari sur iPhone n'active pas un `<label>` qui n'a pas `cursor: pointer`.**
Chromium s'en passe. Toutes les maquettes de ce dépôt portent donc :

```css
label{cursor:pointer}
```

Le patron, le 2026-08-10, devant le calendrier : *« rien ne s'ouvre quand je
touche un jour »* — quarante contrôles au vert, et l'écran muet sous son doigt.
Le contrôle qui l'attrape ne se joue pas dans un navigateur : il **lit le
style**. Aucun essai en Chromium ne pouvait voir ce défaut.

La leçon dépasse ce cas : quand un mécanisme repose sur un `<label>` et une case
à cocher, l'essai automatique ne prouve rien sur l'appareil du patron. Sur
l'application, ces mécanismes deviennent du vrai JavaScript et le problème
disparaît — mais **les maquettes doivent rester touchables chez lui**, sinon il
juge un écran qui ne répond pas.

---

## 8. Ce qu'il faudra vérifier, et qui n'est pas facultatif

`npm run verifier:avant-livraison` avant toute demande au patron
(`CLAUDE.md` §5). Et, en plus, **regarder les captures des écrans touchés** :
sur ce lot de maquettes, quatre défauts se sont vus à l'œil et **aucun** aux
contrôles.

- des cases à cocher **bleues d'iOS** en pleine page ivoire ;
- une ligne d'en-tête **effacée** par une classe homonyme (`.compte` servait à
  la fois au décompte et à un filet d'un pixel) ;
- un nom **coupé en plein mot** par le glissement ;
- « CHANTIERS » qui **touchait** « PLANNING ».

Trois contrôles à écrire, parce que l'œil ne sera pas toujours là :

- l'écart entre les libellés du bandeau — en mesurant l'étendue du **texte**
  (`Range.getBoundingClientRect`), la boîte du libellé valant sa colonne
  entière, sinon le contrôle reste vert pendant que les mots se touchent ;
- **le centre visible d'une cible tactile doit tomber dans la cible** : une
  pastille dessinée à côté de sa zone donne un « rien ne se passe » que rien
  d'autre ne détecte ;
- **une seule ligne part** quand on en retire une : le sélecteur général (`~`)
  frappe toutes les suivantes, et le défaut est invisible tant qu'on ne regarde
  qu'une ligne à la fois.

**Un risque à éprouver au doigt, pas au test :** le glissement horizontal du
texte et l'accroche verticale (`scroll-snap-stop: always`) ne portent pas sur le
même axe, mais ils se disputent un mouvement en **diagonale** — le cas ordinaire
d'un pouce. À essayer sur un vrai téléphone.
