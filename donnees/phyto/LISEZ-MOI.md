# La base phytosanitaire d'Atlas

## Ce que contient ce dossier

| | |
|---|---|
| `fiches/` | Les **lots de fiches réelles**, en JSON. **Deux fiches au 20 août 2026** : le fomès des résineux (document du DSF récolté) et l'anthracnose du platane (page Ephytia transmise par le patron). Toutes deux écrites d'une source lue en entier. |
| `fixtures/` | Des données d'**essai**, qui ne décrivent aucun végétal réel. |
| `sources.json` | La **liste des documents** à aller chercher chez leurs organismes. Aucune donnée phytosanitaire dedans : seulement des adresses et des licences. |
| `sources/` | Le **texte** des documents récoltés. Hors de `main` (voir `.gitignore`) : il vit sur la branche de récolte. |

## Pourquoi il n'y en a que deux

Règle du patron, le 20 août 2026 :

> Tu ne dois inventer aucune fiche phytosanitaire. Les données seront
> constituées séparément à partir de sources fiables et validées : DSF/ministère
> de l'Agriculture, INRAE, FREDON, Plante & Cité, ONF, BSV et autres références
> reconnues.

Et : *« ne remplis pas artificiellement la base avec de fausses données pour
faire fonctionner la démonstration »*.

Le module fonctionne parfaitement avec une base presque vide : hors du périmètre
couvert, il répond **« je ne peux pas confirmer »**, ce qui est vrai, plutôt
qu'un diagnostic qui ne l'est pas.

**Ce qui limite le rythme n'est pas la saisie, c'est le TYPE de document.** Les
bilans régionaux des DRAAF nomment les problèmes et donnent des niveaux
d'impact, mais décrivent rarement les symptômes assez précisément pour les
écrire dans le vocabulaire fermé. Les documents qui le font sont les
**fiches-type** : la plaquette « Le fomes des résineux » en est une, et elle a
suffi à écrire une fiche complète en une lecture. La base d'INRAE (Ephytia) en
contient beaucoup — d'où la question de sa licence, qui est le vrai point
bloquant.

## Le blocage à connaître avant de se lancer

**Aucune de ces sources n'est joignable depuis l'environnement de développement
d'Atlas.** Le mandataire réseau répond `403 à CONNECT — policy denial` sur
`agriculture.gouv.fr`, `inrae.fr`, `fredon-france.org`, `onf.fr`,
`plante-et-cite.fr` et `ephy.anses.fr`. Vérifié le 20 août 2026.

La **recherche web**, elle, passe — mais elle rend un RÉSUMÉ écrit par un
modèle, pas la page. **Écrire une fiche « validée » d'après un résumé, c'est
blanchir une paraphrase en donnée sourcée** : exactement ce que la règle
interdit, avec l'apparence du sérieux en plus. Ne pas le faire.

La sortie est celle que le dépôt emploie déjà pour tout ce qu'il ne peut pas
atteindre (`CLAUDE.md` §5) : **déplacer le travail sur une machine qui a le
réseau**.

## La marche à suivre, dans l'ordre

**1. Déclarer les documents** dans `sources.json` — organisme, titre, adresse,
nature, **licence**. Une source dont la licence n'est pas établie
(`"a_verifier"`) garde son adresse et rien d'autre : son texte n'est pas
rapatrié.

**2. Récolter**, depuis l'onglet Actions de GitHub :
*« Récolter les sources phytosanitaires »*. Le texte est déposé sur la branche
`sources-phyto` et joint au run. Rien n'est poussé sur `main`.

**3. Saisir les fiches**, à partir de ces textes — jamais de mémoire. Un lot par
fichier dans `fiches/`. Chaque champ qui engage cite le code de sa source.

**4. Vérifier** (n'écrit rien) :

```bash
npx tsx scripts/importer-fiches-phyto.ts donnees/phyto/fiches --verifier
```

La CI le rejoue à chaque poussée : une fiche mal sourcée ne peut pas atteindre
`main`.

**5. Verser en base**, sous le rôle **propriétaire** — `atlas_app` n'a que
`SELECT` sur ces tables (migration 0056) :

```bash
DATABASE_URL="$DATABASE_ADMIN_URL" npx tsx scripts/importer-fiches-phyto.ts donnees/phyto/fiches
```

## Ce qu'une fiche doit prouver pour être SERVIE

L'import refuse tout le reste (`src/lib/import-fiches-phyto.ts`, six refus) :

1. `niveauValidation: "validee"` — une fiche en brouillon n'atteint jamais un
   chantier ;
2. **au moins une source**, et chaque champ qui engage — `conduite_recommandee`,
   `gravite`, `traitement`, `statut_reglementaire` — rattaché **nommément** à
   une source par son tableau `champs`. Une bibliographie générale ne dit pas
   QUI affirme quoi ;
3. un `traitement`, s'il y en a un, appuyé par une source **réglementaire,
   officielle ou technique** — recommander un produit engage l'artisan ;
4. **au moins un symptôme**, dans le vocabulaire fermé de
   `src/lib/diagnostic-vegetal.ts`. Un mot hors vocabulaire est refusé ici parce
   qu'il ne produirait, sinon, **aucune erreur** : simplement une fiche qui ne
   sortirait plus jamais ;
5. une période d'observation entière, ou aucune ;
6. une confusion qui promet une photo doit dire **laquelle**.

## Les photos de référence — d'où elles viennent

**Sa demande du 20 août 2026 :** *« Il faut absolument mettre des photos.
L'utilisateur a besoin de comparer avec une vraie photo qui comporte la
maladie. »* L'écran de résultat les affiche donc **sur l'écran principal**, sous
« À quoi ça ressemble », avant la conduite à tenir — comparer suppose de voir
les deux ensemble.

**Le seul point dur, c'est leur provenance.** Les photos des organismes portent
presque toutes un crédit nominatif — sur la seule fiche de l'anthracnose du
platane : *CHAMONT S. (INRA)*, *© GIRAUDEL Arnaud*, *© Jean-Pierre Henry*. Un
« © » suivi d'un nom de personne est la réserve de droits la plus explicite qui
soit, et aucune licence publique ne la couvre.

**Trois sources propres, par ordre de facilité :**

| Source | Ce qu'elle vaut |
|---|---|
| **Les photos du patron** | Aucune question de droits, et **les meilleures** : prises au téléphone, dans les conditions réelles — exactement ce que l'utilisateur photographiera |
| **Les banques sous licence libre** | Creative Commons, domaine public. Utilisables, à condition d'inscrire l'auteur et la licence — ce que l'écran affiche |
| **Demander aux auteurs** | Lent, et nécessaire seulement pour une photo qu'on ne peut pas remplacer |

### Ce qu'il faut fournir AVEC chaque photo

**La ligne de crédit telle qu'elle est écrite sous la figure**, sur la page
d'origine. Pas un avis, pas un résumé : le texte imprimé.

C'est le seul moyen de savoir. Sur la fiche de l'anthracnose du platane, les
trois figures portent respectivement *CHAMONT S. (INRA)*, *© GIRAUDEL Arnaud* et
*© Jean-Pierre Henry* — les deux dernières sont des réserves de droits
explicites, sur une page pourtant en libre accès. **Libre d'accès ne veut pas
dire libre de droits**, et c'est précisément la confusion qui coûte cher.

**Un modèle de langage ne peut pas trancher cette question.** Il ne voit pas les
métadonnées de l'image, ne lit pas les conditions générales du site, et répondra
avec assurance dans tous les cas. Ce qui tranche, c'est la mention écrite à
côté de la photo.

| Ce qui est écrit sous la photo | Utilisable ? |
|---|---|
| « CC BY 4.0 », « CC BY-SA 4.0 », « domaine public », « Licence Ouverte » | **Oui**, en affichant l'auteur et la licence |
| « © Prénom Nom », « Tous droits réservés » | **Non** — c'est l'inverse d'une licence |
| Un nom seul, sans mention de licence | **À demander.** Un crédit n'est pas une autorisation |

L'import refuse d'ailleurs une mention de copyright écrite dans le champ
`licence` : elle passerait sinon tous les contrôles en affirmant précisément ce
qui interdit l'usage.

### Verser une photo

Le fichier va dans `donnees/phyto/images/`, et la fiche le désigne :

```json
"images": [
  {
    "fichier": "donnees/phyto/images/fomes-carpophore.jpg",
    "licence": "CC BY-SA 4.0",
    "credit": "Prénom Nom",
    "partie": "collet",
    "legende": "Sporophore au collet d'un épicéa"
  }
]
```

L'import range le fichier dans le stockage et refuse :

- **une image de plus de 500 Ko** — elle est versionnée dans Git, où rien ne
  s'efface, et affichée sur un téléphone au bord d'une route. Redimensionner à
  1200 px de large suffit largement ;
- **une licence qui est un aveu** — « à vérifier », « inconnue », « ? ». Le champ
  est obligatoire en base, mais rien n'empêchait d'y écrire n'importe quoi : le
  contrôle existe pour que l'obligation protège au lieu de rassurer ;
- **une image qui ne désigne ni fichier ni adresse.**

## Les confusions : ce qu'on oublie, et qui coûte le plus

`confusions_phyto` est ce qui permet à Atlas de demander **une** photo
complémentaire au lieu de refuser. Sans ligne de confusion entre deux fiches
proches, deux hypothèses au coude à coude donnent un refus.

Une confusion se renseigne **une seule fois**, sur l'une des deux fiches : la
lecture est symétrique.

## `fixtures/` — des données d'ESSAI, et rien d'autre

Noms fictifs, aucun nom scientifique, conduites vides de sens. Trois barrières
les empêchent d'atteindre une production, chacune sur un chemin différent :

| Barrière | Où | Ce qu'elle couvre |
|---|---|---|
| `--fixtures` refusé si `NODE_ENV=production` | `scripts/importer-fiches-phyto.ts` | l'import |
| lecture filtrée sur `origine = 'reelle'` | `src/server/repositories/fiches-phyto.ts` | le service |
| `CHECK ((origine='fixture_test') = (code LIKE 'zz-test-%'))` | migration 0056 | l'écriture directe en SQL |

Pour vérifier qu'une base n'en porte aucune :

```sql
SELECT count(*) FROM fiches_phyto WHERE origine = 'fixture_test';
```
