# La base phytosanitaire d'Atlas

Ce dossier porte les **fiches réelles**, versées par
`scripts/importer-fiches-phyto.ts`. Il est **vide aujourd'hui, et c'est
délibéré.**

## Pourquoi il est vide

Règle du patron, le 20 août 2026 :

> Tu ne dois inventer aucune fiche phytosanitaire. Les données seront
> constituées séparément à partir de sources fiables et validées : DSF/ministère
> de l'Agriculture, INRAE, FREDON, Plante & Cité, ONF, BSV et autres références
> reconnues.

Une fiche inventée pour « faire marcher la démonstration » serait servie à un
vrai chantier le jour où elle serait oubliée là. Le module fonctionne
parfaitement avec une base vide : il répond **« la base ne contient encore
aucune fiche validée »**, ce qui est vrai, plutôt qu'un diagnostic qui ne
l'est pas.

## Ce qui doit être vrai d'une fiche pour qu'elle soit SERVIE

L'import refuse tout le reste (`src/lib/import-fiches-phyto.ts`) :

1. `niveauValidation: "validee"` — une fiche en brouillon n'atteint jamais un
   chantier ;
2. **au moins une source**, et chaque champ qui engage (conduite recommandée,
   gravité, traitement, statut réglementaire) rattaché nommément à une source
   par son tableau `champs` ;
3. **au moins un symptôme**, dans le vocabulaire fermé de
   `src/lib/diagnostic-vegetal.ts` — un mot hors vocabulaire ne remonterait
   jamais, sans la moindre erreur ;
4. un `traitement`, s'il y en a un, appuyé par une source **réglementaire,
   officielle ou technique**.

## Verser un lot

```bash
# Toujours sous le rôle PROPRIÉTAIRE : atlas_app n'a que SELECT (migration 0056).
npx tsx scripts/importer-fiches-phyto.ts donnees/phyto --verifier   # ne rien écrire
DATABASE_URL="$DATABASE_ADMIN_URL" npx tsx scripts/importer-fiches-phyto.ts donnees/phyto
```

## `fixtures/` — des données d'ESSAI, et rien d'autre

Elles existent uniquement pour éprouver le moteur, et **ne décrivent aucun
végétal réel** : les noms sont fictifs, sans nom scientifique, et volontairement
absurdes pour que personne ne les prenne pour des données.

Trois barrières les empêchent d'atteindre une production, et il en faut trois
parce que chacune couvre un chemin différent :

| Barrière | Où | Ce qu'elle couvre |
|---|---|---|
| `--fixtures` refusé si `NODE_ENV=production` | `scripts/importer-fiches-phyto.ts` | l'import |
| lecture filtrée sur `origine = 'reelle'` | `src/server/repositories/fiches-phyto.ts` | le service |
| `CHECK ((origine='fixture_test') = (code LIKE 'zz-test-%'))` | migration 0056 | l'écriture directe en SQL |

Pour vérifier qu'une base n'en porte aucune :

```sql
SELECT count(*) FROM fiches_phyto WHERE origine = 'fixture_test';
```
