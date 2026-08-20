# La base phytosanitaire d'Atlas

## Ce que contient ce dossier

| | |
|---|---|
| `fiches/` | Les **lots de fiches réelles**, en JSON. **Vide aujourd'hui**, et c'est voulu. |
| `fixtures/` | Des données d'**essai**, qui ne décrivent aucun végétal réel. |
| `sources.json` | La **liste des documents** à aller chercher chez leurs organismes. Aucune donnée phytosanitaire dedans : seulement des adresses et des licences. |
| `sources/` | Le **texte** des documents récoltés. Hors de `main` (voir `.gitignore`) : il vit sur la branche de récolte. |

## Pourquoi `fiches/` est vide

Règle du patron, le 20 août 2026 :

> Tu ne dois inventer aucune fiche phytosanitaire. Les données seront
> constituées séparément à partir de sources fiables et validées : DSF/ministère
> de l'Agriculture, INRAE, FREDON, Plante & Cité, ONF, BSV et autres références
> reconnues.

Et : *« ne remplis pas artificiellement la base avec de fausses données pour
faire fonctionner la démonstration »*.

Le module fonctionne parfaitement avec une base vide : il répond **« la base ne
contient encore aucune fiche validée »**, ce qui est vrai, plutôt qu'un
diagnostic qui ne l'est pas.

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
