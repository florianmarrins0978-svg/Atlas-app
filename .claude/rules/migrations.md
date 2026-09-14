# Migrations — ce qui a déjà coûté une soirée

Chargé dans **toutes** les sessions Atlas (importé par `CLAUDE.md`).

---

## Une migration de données s'éprouve sur une base HABITÉE

Dès que des lignes existantes peuvent changer son résultat — `UPDATE`, `DELETE`,
backfill, conversion, normalisation, contrainte ajoutée sur des données déjà là.

**Pourquoi ce n'est pas une précaution de confort.** Une base vide ne peut
violer aucune contrainte et ne cache aucune ligne. Une migration éprouvée là
est verte **par construction**, et ne prouve rien de la seule base qui compte.

Le 13 septembre 2026, la migration 0087 était verte en CI, verte dans la
batterie, et **infranchissable sur la base du patron** : trois écrans par terre,
quatre migrations bloquées derrière elle, une soirée perdue.

Modèle à recopier : `scripts/test-migration-0087-base-habitee.ts`.

## Une migration qui écrit sous FORCE RLS doit PROUVER qu'elle voit les lignes

C'est le piège qui a tout causé, et il est silencieux.

`atlas_owner` — le rôle qui applique les migrations — n'a **pas** `BYPASSRLS`,
et c'est délibéré (la CI le vérifie). Sur une table sous `FORCE ROW LEVEL
SECURITY`, sans contexte d'entreprise posé, **il ne voit aucune ligne** :

- l'`UPDATE` touche **zéro ligne** ;
- **aucune erreur n'est levée** ;
- la migration continue, et se déclare réussie.

Puis une contrainte ajoutée juste après, elle, est vérifiée par PostgreSQL sur
**toutes** les lignes — RLS ou pas. C'est ainsi que le défaut se révèle, quand
il se révèle. **Les migrations qui n'ajoutent pas de contrainte échouent sans
rien dire du tout.**

### Avant d'écrire un `UPDATE` dans une migration

```bash
# la table est-elle sous FORCE RLS ?
grep -rn "FORCE ROW LEVEL SECURITY" drizzle/ | grep <la_table>
```

Si oui, **une des deux formes**, jamais un `UPDATE` nu :

| | |
|---|---|
| **boucler par entreprise** (préférée) | `FOR ent IN SELECT id FROM entreprises LOOP PERFORM set_config('app.entreprise_id', ent.id::text, true); …` — modèle : `drizzle/0037_mr_plutot_que_monsieur.sql`, et la RLS n'est jamais levée |
| **`NO FORCE` / `FORCE`** | le propriétaire seul voit sa table, le temps de la transaction, et le `FORCE` est **rendu à la fin** — modèle : `drizzle/0087_diagnostic_refus_par_cle.sql` |

Dans les deux cas : `GET DIAGNOSTICS` ou une vérification qui **compte** ce qui
a été touché. Une migration de données qui ne compte rien ne sait pas si elle a
travaillé.

**`DISABLE ROW LEVEL SECURITY` ne se propose jamais** : il ouvre la table à tous
les rôles, `atlas_app` compris (`CLAUDE.md` §4).

## Un fichier de migration se corrige EN PLACE quand il n'est jamais passé

Une migration qui a échoué n'est pas enregistrée dans `_migrations` : elle sera
rejouée. La corriger dans son propre fichier est donc juste, et sans effet sur
les bases où elle est déjà passée. Ajouter une migration suivante n'aiderait
pas — le runner s'arrête au premier échec.

## Ce qu'une migration ne suppose jamais

« Il n'en existe pas » n'est pas une vérification. C'est le commentaire exact de
0087, et il était faux. Une migration traite le cas ou refuse de conclure ; elle
ne parie pas sur le contenu d'une base qu'elle n'a pas regardée.

**Et rien ne s'invente** : une ligne qu'on ne sait pas convertir reçoit ce qui
est vrai — « non enregistré » —, jamais une valeur plausible (`docs/AGENT.md` §3).
