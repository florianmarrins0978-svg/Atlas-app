#!/bin/bash

# Valider que tout fonctionne avant de fusionner vers main
# Cette script vérifie que le build est correct et que les pages se chargent

set -e

echo "🔍 Validation préalable à la fusion vers main..."
echo ""

# 1. Vérifier que le code compile
echo "📦 Étape 1: Vérification des types..."
npm run typecheck || {
  echo "❌ Erreur de compilation TypeScript"
  exit 1
}
echo "✓ Types OK"
echo ""

# 2. Vérifier le linting
echo "🎯 Étape 2: Vérification du linting..."
npm run lint || {
  echo "❌ Erreurs de linting"
  exit 1
}
echo "✓ Linting OK"
echo ""

# 3. Vérifier la mémoire du dépôt
echo "📝 Étape 3: Vérification de la mémoire du dépôt..."
npm run verifier:memoire || {
  echo "❌ Documentation périmée"
  exit 1
}
echo "✓ Mémoire OK"
echo ""

# 4. Nettoyer les artefacts de build
echo "🧹 Étape 4: Nettoyage des artefacts..."
bash scripts/nettoyer-build.sh
echo ""

# 5. Construire l'application
echo "🔨 Étape 5: Build de production..."
npm run build || {
  echo "❌ Erreur lors du build"
  exit 1
}
echo "✓ Build OK"
echo ""

echo "✅ Validation réussie - prêt à fusionner vers main"
echo ""
echo "Prochaines étapes :"
echo "  git push -u origin claude/<branche>"
echo "  Ouvrir une Pull Request vers main"
