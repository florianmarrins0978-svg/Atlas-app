# Les polices embarquées dans les documents

**Sa demande du 23 août 2026 :** *« un endroit dédié à la modification de son
devis — s'il veut rajouter son logo, changer la typographie, changer le fond de
page »*, puis *« fais-en une dizaine »*.

## Pourquoi des fichiers ici, et pas un lien vers Google Fonts

Un PDF ne « charge » pas une police : il l'**embarque**. `pdf-lib` n'en connaît
que deux nativement — Times et Helvetica, les polices standard du format — et
c'est tout ce que ses devis portaient jusqu'ici.

Et l'écran ne doit pas dépendre d'un domaine tiers non plus : l'allure d'un
document qui se met à changer parce qu'un serveur ne répond pas, c'est un devis
qu'il envoie sans savoir de quoi il a l'air.

## D'où elles viennent, et sous quelle licence

Toutes récupérées depuis `fonts.gstatic.com` (Google Fonts), en **instances
statiques** — pas les fichiers variables. C'est important : sur une police
variable, le fichier « 700 » est le même que le « 400 », et le gras ne serait
pas gras.

Les neuf familles sont sous **SIL Open Font License 1.1**, qui autorise la
redistribution avec le logiciel. Elle est reproduite dans `OFL.txt`.

| Famille | Fichiers |
|---|---|
| Inter | `inter-400.ttf`, `inter-700.ttf` |
| Lato | `lato-400.ttf`, `lato-700.ttf` |
| Source Sans 3 | `source-sans-400.ttf`, `source-sans-700.ttf` |
| Work Sans | `work-sans-400.ttf`, `work-sans-700.ttf` |
| Archivo Narrow | `archivo-narrow-400.ttf`, `archivo-narrow-700.ttf` |
| EB Garamond | `eb-garamond-400.ttf`, `eb-garamond-700.ttf` |
| Libre Baskerville | `libre-baskerville-400.ttf`, `libre-baskerville-700.ttf` |
| Merriweather | `merriweather-400.ttf`, `merriweather-700.ttf` |
| Playfair Display | `playfair-400.ttf`, `playfair-700.ttf` |

**La dixième n'est pas ici**, et c'est voulu : « celle d'aujourd'hui » reste
Times et Helvetica, servies par le format lui-même. C'est son réglage par
défaut — *« les réglages actuels doivent être par défaut »*.

## Elles sont RÉDUITES, et ce n'est pas une optimisation

**Payé le 24 août 2026.** `pdf-lib` sait découper une police lui-même
(`subset: true`) — et son découpeur ment. Sur EB Garamond, un devis complet ne
sortait plus que « e e e Roc e e » : les caractères ne s'imprimaient pas, sans
une erreur ni une ligne de journal. Un devis illisible part quand même chez le
client. Dans l'autre sens, Archivo Narrow faisait **tomber** `pdf-lib` dès
qu'on lui demandait la police entière.

Les fichiers ici ont donc été réduits **une fois pour toutes**, hors ligne, au
latin dont ses documents ont besoin — et le PDF les embarque **entiers**, sans
rien retoucher à l'exécution.

| | Avant | Après |
|---|---|---|
| les dix-huit fichiers | 3,9 Mo | **570 ko** |
| un devis en EB Garamond | illisible | **≈ 60 ko** |

### Refaire la réduction

Le jeu de caractères couvre l'ASCII, le latin-1, le latin étendu A (les noms
polonais ou tchèques de ses clients), la ponctuation typographique et le « € ».
Il faut `fonttools` (`pip install fonttools`), et les fichiers d'origine
récupérés depuis `fonts.gstatic.com` :

```bash
python3 -m fontTools.subset ENTREE.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0100-017F,U+0192,U+02C6,U+02DC,\
U+2013,U+2014,U+2018-201A,U+201C-201E,U+2020-2022,U+2026,U+2030,U+2039,U+203A,\
U+2044,U+2122,U+2202,U+2212,U+202F,U+20AC,U+FB01,U+FB02" \
  --layout-features='' \
  --drop-tables+=GSUB,GPOS,GDEF,STAT,BASE,DSIG,gasp,prep,fpgm,cvt \
  --notdef-outline --recommended-glyphs \
  --output-file=SORTIE.ttf
```

Les tables de composition (`GSUB`, `GPOS`) partent : `pdf-lib` ne les lit pas,
et elles pèsent la moitié du fichier.

**`scripts/test-polices-documents.ts` monte la garde** — il vérifie que chaque
caractère qu'un devis sait écrire a bien un dessin, que la police s'embarque
entière sans tomber, et qu'aucun fichier non réduit n'a été reposé ici. Il sait
échouer : confronté aux fichiers d'origine, il les refuse.
