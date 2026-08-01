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

   Cette adresse s'ouvre aussi depuis un téléphone, sans rien
   régler. Elle est donc ouvrable par qui la possède, et ce mot
   de passe est public : n'y saisissez que des données inventées.
  ─────────────────────────────────────────────────────────────

FIN
