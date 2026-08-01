#!/usr/bin/env bash
# Éprouve le banc d'essai comme s'en sert le patron : la base est-elle montée,
# le compte de démonstration utilisable, l'application réellement joignable ?
#
# Joué DANS le conteneur, après `preparer.sh`, par
# .github/workflows/banc-essai.yml.
#
# Pourquoi ce script existe : l'environnement de développement de l'agent n'a
# ni démon Docker, ni GitHub CLI. Le banc d'essai y était donc invérifiable, et
# a été livré trois fois de suite avec un défaut que seul le patron
# rencontrait. Ce qui ne peut pas être éprouvé là où on développe doit l'être
# ailleurs, par une machine.
set -euo pipefail

echec() { echo "❌ $1" >&2; exit 1; }

echo "→ La base"
npx tsx scripts/verifier-banc-essai.ts

echo
echo "→ L'application démarre et répond"
npm run essai > /tmp/essai.log 2>&1 &
essai=$!
trap 'kill -TERM "$essai" 2>/dev/null || true' EXIT

pret=""
for _ in $(seq 1 90); do
  if curl -sf http://127.0.0.1:3000/api/health/live > /dev/null 2>&1; then pret=1; break; fi
  sleep 2
done
[ -n "$pret" ] || { tail -40 /tmp/essai.log >&2; echec "aucune réponse en trois minutes"; }
echo "   ✅ La page de santé répond"

# Un 200 sur la page de santé ne prouve rien d'un écran : elle ne touche ni la
# base, ni le rendu. C'est /login qui dit si l'application est utilisable.
code=$(curl -s -o /tmp/login.html -w "%{http_code}" http://127.0.0.1:3000/login)
[ "$code" = "200" ] || { tail -40 /tmp/essai.log >&2; echec "/login répond $code"; }
grep -q 'name="password"' /tmp/login.html || echec "/login ne présente aucun formulaire"
echo "   ✅ L'écran de connexion s'affiche"

# C'est cette ligne que le patron attend pour savoir qu'il peut ouvrir
# l'adresse. Sans elle, il ouvre trop tôt et voit une page blanche.
grep -q "L'application répond" /tmp/essai.log || echec "l'adresse à ouvrir n'est pas annoncée"
echo "   ✅ L'adresse à ouvrir est annoncée"

echo
echo "✅ Banc d'essai vérifié de bout en bout."
