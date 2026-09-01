#!/bin/bash

# Nettoyer les artefacts de build Turbopack et les caches
# Corrige les pages blanches dues à des fichiers en cache après un merge vers main

echo "🧹 Nettoyage des artefacts de build..."

# Supprimer le répertoire .next complet
if [ -d ".next" ]; then
  rm -rf .next
  echo "✓ Répertoire .next supprimé"
fi

# Supprimer le cache Turbopack
if [ -d ".turbo" ]; then
  rm -rf .turbo
  echo "✓ Cache Turbopack supprimé"
fi

# Supprimer le cache Node
if [ -d "node_modules/.cache" ]; then
  rm -rf node_modules/.cache
  echo "✓ Cache Node supprimé"
fi

# Vider les fichiers temporaires Typescript
if [ -d ".tsbuildinfo" ]; then
  rm -rf .tsbuildinfo
  echo "✓ Fichiers TypeScript temporaires supprimés"
fi

echo "✅ Nettoyage terminé"
echo ""
echo "À faire ensuite :"
echo "  1. npm ci               (réinstaller les dépendances si nécessaire)"
echo "  2. npm run dev          (redémarrer le serveur)"
echo "  3. Vider le cache du navigateur (Ctrl+Maj+Delete) ou ouvrir en navigation privée"
