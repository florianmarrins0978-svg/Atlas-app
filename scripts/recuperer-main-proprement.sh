#!/bin/bash

# Récupérer main et nettoyer après un merge
# À lancer après: git pull origin main

set -e

echo "📥 Récupération de main et nettoyage..."
echo ""

# Véri fier qu'on est sur la bonne branche et à jour
echo "Branche actuelle: $(git branch --show-current)"
echo "Commit: $(git rev-parse HEAD | cut -c1-7)"
echo ""

# Nettoyer les artefacts de build
echo "🧹 Nettoyage des artefacts de build..."
bash scripts/nettoyer-build.sh
echo ""

# Réinstaller les dépendances si package.json a changé
echo "📦 Vérification des dépendances..."
npm ci || {
  echo "❌ Erreur lors de l'installation des dépendances"
  exit 1
}
echo "✓ Dépendances OK"
echo ""

# Appliquer les migrations si elles ont changé
if git diff --name-only HEAD~1 HEAD | grep -q "drizzle/"; then
  echo "🔄 Migrations détectées, application en cours..."
  bash scripts/monter-base-locale.sh || {
    echo "❌ Erreur lors de l'application des migrations"
    exit 1
  }
  echo "✓ Migrations appliquées"
  echo ""
fi

echo "✅ Nettoyage terminé"
echo ""
echo "Vous pouvez maintenant faire :"
echo "  npm run dev"
echo ""
echo "Si vous voyez toujours une page blanche :"
echo "  1. Attendez que le serveur finisse de compiler (environ 30s)"
echo "  2. Videz le cache du navigateur (Ctrl+Maj+Delete)"
echo "  3. Rechargez la page (Ctrl+Maj+R ou Cmd+Maj+R)"
