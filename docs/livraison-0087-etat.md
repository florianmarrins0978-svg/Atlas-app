# Réparation des trois écrans — état de la livraison

*13 septembre 2026, 21 h. Fait suite à `docs/diagnostic-trois-ecrans.md` et
`docs/correction-0087.md`.*

---

## En une phrase

**Le correctif est sur `main`. Il n'est pas encore sur votre espace, et un seul
geste manque : rallumer l'espace.**

---

## Ce qui est terminé

| | |
|---|---|
| correctif 0087 | ✅ fusionné sur `main` — `a3a40a6` |
| lot propre et isolé | ✅ **0 fichier de `src/`**, 0 changement du veilleur, 0 refactoring |
| test de non-régression | ✅ `scripts/test-migration-0087-base-habitee.ts` — rouge avant, vert après, et **restera dans la suite** |
| migrations 0087→0090 sur base **habitée** | ✅ `faites : 4 migration(s) rattrapée(s)` |
| schéma vérifié | ✅ `conditions_generales`, `main_doeuvre_ht`, `acomptes_devis`, `refus`/`panne` : toutes présentes |
| données | ✅ 1 entreprise, 1 utilisateur, 1 membre, 1 diagnostic — **mêmes identifiants avant et après** |
| garde RLS | ✅ remise : `rowsecurity=true force=true` |
| les écrans, après migration | ✅ les 8 répondent — dont Planning, Terminés et Réglages |
| erreurs `conditions_generales` | ✅ **3 avant, 0 après**, même base, même parcours |

## Ce qui n'est pas terminé, et pourquoi

**Votre espace n'a pas encore le correctif.** Sa fiche, à 19 h 41 :

```
Code récupéré    : de4f1c9      ← le correctif (a3a40a6) n'est pas encore arrivé
Base             : EN RETARD DE 4 — 0087, 0088, 0089, 0090
Port 3000        : INJOIGNABLE DE L'EXTÉRIEUR — renvoi vers github.dev
```

**Le blocage, précisément :** il n'existe aucun chemin d'ici vers votre machine.
Le réseau de cet environnement refuse `*.app.github.dev`, et aucun canal
d'exécution vers votre espace n'existe — c'est un refus de conception, pas une
limite technique : une boucle qui lirait des ordres dans le dépôt serait une
porte dérobée sur une machine qui porte vos identifiants GitHub et vos clés
d'IA. Le canal est à sens unique : votre espace publie, je lis.

Je ne peux donc ni lancer vos migrations, ni ouvrir vos écrans.

## Le geste qui reste

**Rallumez l'espace** — github.com/codespaces, l'arrêter puis le rouvrir.

Au démarrage, il récupère le code neuf **et** applique les migrations : c'est
déjà sur `main` depuis cet après-midi. **Aucune donnée n'est touchée** —
rallumer n'est pas reconstruire.

Ce geste est de toute façon nécessaire : votre port public s'est perdu, et votre
application est actuellement injoignable de l'extérieur pour cette raison-là,
indépendamment de la base.

## Comment vous saurez que c'est fini

Sans rien taper : la fiche de l'espace se réécrit tous les quarts d'heure et
affichera

```
Base             : à jour
```

et l'avertissement « LA BASE N'A PAS SUIVI LE CODE » aura disparu de ses
conclusions.

---

## Les cinq réponses demandées

| | |
|---|---|
| fusion effectuée | **oui** |
| migrations 0087→0090 appliquées | **oui** sur base habitée ici · **non** sur votre espace |
| base/code synchronisés | **non** — votre base reste en 0086 |
| 6 écrans vérifiés | **oui** ici après migration · **non** dans votre espace |
| erreur `conditions_generales` restante | **non** ici · **oui chez vous** tant que la base n'a pas migré |
