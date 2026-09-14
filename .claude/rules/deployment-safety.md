# Livrer sans casser — code et base au même niveau

Chargé dans **toutes** les sessions Atlas (importé par `CLAUDE.md`).

---

## L'invariant, en une phrase

**Une version du code n'est compatible que si le schéma qu'elle suppose est
présent.** Servir du code neuf sur une base ancienne ne produit pas une
application « un peu en retard » : elle fait **tomber** des écrans, au hasard de
la colonne qu'ils touchent, derrière un identifiant opaque de six chiffres.

C'est exactement ce que le patron a vu le 13 septembre 2026 : Planning,
Terminés et Réglages par terre, les cinq autres écrans debout.

## Ce que le dépôt sait déjà faire

| | |
|---|---|
| `scripts/etat-de-la-base.ts` | compare ce que le code attend (`drizzle/*.sql`) à ce que la base déclare (`_migrations`) |
| la fiche de son espace | porte `Base : EN RETARD DE N — …`, et **ce que la base refuse** (`scripts/_raison-migration.mjs`) |
| l'écran Réglages | le dit aussi, là où il vient demander « est-ce que j'ai les corrections ? » |
| `.devcontainer/demarrer.sh` | applique les migrations **à chaque allumage**, pas seulement quand le code bouge |

**Quand une mesure est impossible, elle le dit** — jamais « à jour » par défaut.
L'absence de matière à mesurer n'est pas un succès.

## Ce qui n'est pas encore tenu, et qu'il ne faut pas croire tenu

Rien n'empêche aujourd'hui une version neuve d'être **servie** alors que les
migrations ont échoué : le démarrage construit et bascule sans regarder leur
verdict. La conception d'un mécanisme sûr (migrations vertes → construction →
bascule ; sinon l'ancienne version continue de servir) est **en attente de sa
décision**, et n'est pas codée.

Tant que ce n'est pas fait : après une migration en échec, l'espace sert du code
incompatible et **seule la fiche le dit**.

## Un changement de schéma incompatible se fait en DEUX temps (expand/contract)

Jamais en un seul déploiement, parce qu'entre la migration et la bascule il
existe toujours un instant où l'ancien code tourne sur le nouveau schéma.

1. **Étendre** — ajouter la colonne/table, *nullable*, sans rien retirer.
   L'ancien code continue de fonctionner tel quel ;
2. **déployer** le code qui l'écrit et la lit ;
3. **transiter** les données existantes, si nécessaire (voir
   `.claude/rules/migrations.md` : base habitée, FORCE RLS) ;
4. **contracter** — retirer l'ancienne colonne, ajouter le `NOT NULL` ou la
   contrainte — **dans un déploiement ULTÉRIEUR**, quand plus aucun code servi
   ne dépend de l'ancienne forme.

Un `DROP COLUMN` ou un `NOT NULL` dans le même lot que le code qui l'introduit
casse l'ancienne version à la seconde où la migration passe.

## Rien n'est livré tant que ce n'est pas sur `main`

Son espace ne suit que `main`, en ligne droite. Pousser sur une branche de
session est une étape, pas une livraison — et la fusion se demande (`CLAUDE.md`
§6).

## Ce qu'on ne lui propose jamais

Aucun geste qui peut effacer ses données : reconstruire le conteneur, supprimer
l'espace, rejouer le seed, `db:push --force`. Il a dû l'interdire deux fois
(`CLAUDE.md` §4 septies). **Rallumer l'espace ne détruit rien** — c'est le geste
sûr, et c'est celui qu'on donne.
