# Problème : Pages blanches après un merge vers main

## Symptômes

Après que du code soit fusionné dans `main` et que vous en tiriez les changements, vous voyez une page blanche au lieu du formulaire de connexion ou du contenu attendu.

## Causes

Il y a généralement trois causes :

1. **Artefacts de build stale** — Les fichiers `.next` d'une version antérieure interfèrent avec la nouvelle version
2. **Cache du navigateur** — Le navigateur sert des fichiers JavaScript/CSS obsolètes
3. **Cache des modules** — Les dépendances npm peuvent avoir changé

## Solutions

### Solution rapide (immédiate)

```bash
# 1. Nettoyer les artefacts de build
bash scripts/nettoyer-build.sh

# 2. Redémarrer le serveur
npm run dev

# 3. Vider le cache du navigateur
# Chrome/Edge : Ctrl+Maj+Delete (Cmd+Maj+Delete sur Mac)
# Firefox : Ctrl+Maj+Delete (Cmd+Shift+Delete sur Mac)
# Puis rechargez la page avec Ctrl+Shift+R (Cmd+Shift+R sur Mac)
```

### Solution complète (après un merge important)

```bash
# Récupérer main et nettoyer automatiquement
bash scripts/recuperer-main-proprement.sh

# Puis redémarrer
npm run dev
```

### Avant de fusionner vers main

```bash
# Valider que tout fonctionne correctement
bash scripts/valider-avant-merge-main.sh

# Si tout est vert, vous pouvez pusher
git push -u origin <votre-branche>
```

## Qu'est-ce qui se nettoie

| Répertoire | Raison |
|---|---|
| `.next/` | Cache de build Next.js/Turbopack |
| `.turbo/` | Cache Turbopack |
| `node_modules/.cache` | Cache des outils Node |
| `.tsbuildinfo` | Fichiers temporaires TypeScript |

## Prévention

### Pour le développeur

Avant chaque commit fusionné vers main :

```bash
npm run typecheck  # Vérifier les types
npm run lint       # Vérifier le linting
npm run build      # Vérifier que la build réussit
npm test           # Vérifier que les tests passent
npm run verifier:avant-livraison  # La batterie complète
```

### Pour les autres

Après un merge vers main, si vous voyez une page blanche :

1. **N'attendez pas** que ça se corrige tout seul
2. **Nettoyez les artefacts** avec le script ci-dessus
3. **Videz le cache du navigateur** complètement
4. **Rechargez** avec Ctrl+Shift+R (pas juste F5)

## Pourquoi ça arrive

Quand le code change, les noms des fichiers générés par Turbopack changent aussi. Si le `.next` cache contient d'anciens noms, le navigateur cherche des fichiers qui n'existent plus → page blanche.

Le navigateur ne sait pas que les fichiers ont changé parce que les URLs incluent un hash qui change, mais si le `.next` est stale, le hash n'existe plus et le fichier ne se charge pas.

## Vérifier que ça fonctionne

Après avoir appliqué une solution :

```bash
# Le serveur doit afficher "compiled client successfully" ou "built successfully"
npm run dev

# Ouvrir http://localhost:3000/login dans le navigateur
# Vous devez voir le formulaire de connexion avec :
# - Logo Atlas
# - Champ "Adresse"
# - Champ "Mot de passe"
# - Bouton "Entrer"

# Si la page est blanche :
# 1. Ouvrez la console du navigateur (F12)
# 2. Cherchez les erreurs en rouge
# 3. Rapportez-les
```

## Si rien n'a marché

```bash
# Nuclear option : tout réinitialiser
rm -rf .next node_modules
npm ci
bash scripts/monter-base-locale.sh
npm run dev
```

## Rapporter un bug

Si le problème persiste après avoir nettoyé :

1. **Notez** le hash du commit (`git log -1 --format=%H`)
2. **Ouvrez la console** (F12) et cherchez des erreurs en rouge
3. **Copiez** l'erreur complète
4. **Lancez** une session Claude avec le repo attaché
5. **Incluez** le hash du commit et l'erreur

---

**Dernière mise à jour** : 2026-09-01
