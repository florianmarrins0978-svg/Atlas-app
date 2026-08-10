# Poser la charte Origine dans l'application

> **État au 10 août 2026, au soir.** Cette fiche a été écrite sur une branche
> qui ne portait pas encore la refonte. Depuis, **§1 à §3 et §5 sont faits** —
> la charte, la liste en fil, la perle, le bandeau — et **§4 (le retrait) l'est
> aussi**, sur les huit endroits qui suppriment. Le §2 décrit encore
> `ListeChantiers` comme « une pile de cartes » : ce n'est plus vrai.
> **Reste ouvert : §6, l'ouverture de « Nouveau chantier »**, et le point de
> produit qu'il faut poser au patron avant de coder.
>
> Ce qu'il faut savoir pour reprendre le retrait est dans `ARCHITECTURE.md` §48.

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

**Fait le 10 août 2026.** Les deux existent, plus un troisième morceau que
cette fiche n'avait pas prévu : `useRetraits`, qui porte le délai, la pile des
retraits et l'écriture différée. Sans lui, chaque écran aurait réinventé le
minuteur — et c'est exactement la dispersion qu'on venait de supprimer.

**Le recensement était incomplet : ils sont HUIT, pas sept.** Le planning
(`src/app/planning/PlanningClient.tsx`) supprime lui aussi, sur ses trois
listes, et il passait par `CarteGlissante`. L'oublier aurait laissé la moitié
de l'ancienne mécanique en place.

**Et l'un des huit ne prend pas le glissement, à dessein :** les photos. Une
vignette carrée dans une grille de trois n'est pas une ligne. Elle garde le
reste du geste — le mot, la couleur, le tiroir, l'écriture différée — et se
retire depuis la visionneuse, là où on la regarde.

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
