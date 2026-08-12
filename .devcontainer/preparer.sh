#!/usr/bin/env bash
# Prépare l'environnement d'essai : dépendances, schéma, données de
# démonstration. Joué une seule fois, à la création du conteneur.
#
# S'arrête à la première erreur (`-e`) : une préparation à moitié faite donne
# une application qui démarre puis échoue à la première page, et le message
# d'erreur ne pointe alors jamais vers la vraie cause.
set -euo pipefail

echo "→ Installation des dépendances…"
npm ci

echo "→ Application du schéma de la base…"
# Les migrations créent les tables : elles passent par le rôle PROPRIÉTAIRE,
# jamais par le rôle applicatif, qui n'a délibérément aucun droit de DDL.
DATABASE_URL="$DATABASE_ADMIN_URL" npm run db:migrate

# ─────────────────────────────────────────────────────────────────────────────
# **Un agent QUI VOIT CETTE MACHINE, et pas seulement le dépôt.**
#
# Demandé par le patron le 12 août 2026 : *« comment on peut faire pour que tu
# aies accès à mon espace, pour que tu sois autonome ? »*
#
# La question vient de deux journées perdues sur des pannes qui n'étaient PAS
# dans le code : des services couchés, des restes de construction périmés, un
# message qui accusait son mot de passe. Depuis l'extérieur, chacune a coûté un
# aller-retour — parfois trois — parce qu'il fallait lui faire taper une
# commande et recopier ce qu'elle affichait, depuis un téléphone.
#
# Un agent lancé ICI n'a plus besoin de lui : il lit les journaux, relance les
# services, rebâtit, et essaie l'application. C'est la seule des deux réponses
# qui répare pendant qu'il dort ; l'autre — les contrôles joués par une machine
# GitHub avant que le code ne l'atteigne — vit dans `.github/workflows/`.
#
# **Best-effort, et jamais bloquant.** L'installation traverse le réseau : si
# elle échoue, l'espace doit rester parfaitement utilisable. Le patron n'a pas à
# perdre son banc parce qu'un registre npm a hoqueté — d'où le `|| true`, et un
# message qui dit ce qui manque plutôt que de laisser deviner.
# ─────────────────────────────────────────────────────────────────────────────
echo "→ Installation de l'agent (Claude Code)…"
if npm install -g @anthropic-ai/claude-code >/dev/null 2>&1; then
  echo "   ✅ Tapez « claude » dans ce terminal pour lui confier cet espace."
else
  echo "   ⚠ Installation impossible (réseau ?). L'espace fonctionne quand même ;"
  echo "     pour réessayer plus tard : npm install -g @anthropic-ai/claude-code"
fi

echo "→ Insertion des données de démonstration…"
# Le seed vide puis reconstruit : il lui faut un rôle qui traverse RLS.
DATABASE_URL="$DATABASE_SUPER_URL" npx tsx src/server/db/seed.ts

cat <<'FIN'

  ─────────────────────────────────────────────────────────────
   Atlas est prêt.

     npm run essai        démarre l'application

   Attendez la ligne « L'application répond » : elle donne
   l'adresse exacte à ouvrir. Puis connectez-vous avec :

     demo@atlas.local  /  demo1234

   Et si quelque chose cloche, vous n'êtes pas seul devant :

     claude               confie cet espace à l'agent

   Il voit les journaux, relance les services et rebâtit —
   sans que vous ayez à recopier quoi que ce soit.

   Cette adresse s'ouvre aussi depuis un téléphone, sans rien
   régler. Elle est donc ouvrable par qui la possède, et ce mot
   de passe est public : n'y saisissez que des données inventées.
  ─────────────────────────────────────────────────────────────

FIN
