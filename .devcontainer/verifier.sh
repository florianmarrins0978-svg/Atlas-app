#!/usr/bin/env bash
# Éprouve le banc d'essai comme s'en sert le patron : la base est-elle montée,
# le compte de démonstration utilisable, et surtout — l'application répond-elle
# SANS que personne ait rien tapé ?
#
# Joué DANS le conteneur, après `preparer.sh` et `demarrer.sh`, par
# .github/workflows/banc-essai.yml.
#
# Pourquoi ce script existe : l'environnement de développement de l'agent n'a
# ni démon Docker, ni GitHub CLI. Le banc d'essai y était donc invérifiable, et
# a été livré plusieurs fois de suite avec un défaut que seul le patron
# rencontrait. Ce qui ne peut pas être éprouvé là où on développe doit l'être
# ailleurs, par une machine.
set -euo pipefail

echec() { echo "❌ $1" >&2; exit 1; }

echo "→ La base"
npx tsx scripts/verifier-banc-essai.ts

echo
echo "→ L'application démarre SEULE, sans commande"
# Rien n'est lancé ici, délibérément : c'est `demarrer.sh`, joué à l'allumage de
# l'espace, qui doit avoir mis l'application en écoute. Si ce contrôle échoue,
# c'est que le patron devrait taper quelque chose — et c'est précisément ce
# qu'on ne veut plus lui demander depuis un téléphone.
pret=""
for _ in $(seq 1 90); do
  if curl -sf http://127.0.0.1:3000/api/health/live > /dev/null 2>&1; then pret=1; break; fi
  sleep 2
done
if [ -z "$pret" ]; then
  echo "--- journal du démarrage automatique ---" >&2
  tail -40 /tmp/essai.log >&2 2>/dev/null || echo "(aucun journal : demarrer.sh n'a pas tourné)" >&2
  echec "l'application n'a pas démarré toute seule en trois minutes"
fi
echo "   ✅ La page de santé répond, sans qu'on ait rien lancé"

# Un 200 sur la page de santé ne prouve rien d'un écran : elle ne touche ni la
# base, ni le rendu. C'est /login qui dit si l'application est utilisable.
code=$(curl -s -o /tmp/login.html -w "%{http_code}" http://127.0.0.1:3000/login)
[ "$code" = "200" ] || { tail -40 /tmp/essai.log >&2; echec "/login répond $code"; }
grep -q 'name="password"' /tmp/login.html || echec "/login ne présente aucun formulaire"
echo "   ✅ L'écran de connexion s'affiche"

# L'adresse reste annoncée dans le journal : c'est là que le patron la retrouve
# s'il ne voit pas la notification de l'éditeur.
grep -q "L'application répond" /tmp/essai.log || echec "l'adresse à ouvrir n'est annoncée nulle part"
echo "   ✅ L'adresse à ouvrir est écrite dans /tmp/essai.log"

echo
echo "✅ Banc d'essai vérifié de bout en bout, sans une seule commande tapée."
