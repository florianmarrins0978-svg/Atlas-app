#!/bin/bash
# =======================================================================
# Le serveur de l'appli pour un tournage : la version bâtie, sur la base
# d'essai locale, à l'heure du récit.
#
#   bash appli/scripts/tournage/serveur.sh demarrer [jour]
#   bash appli/scripts/tournage/serveur.sh arreter
#   bash appli/scripts/tournage/serveur.sh etat
#
# « jour » est l'instant que le serveur doit croire au PREMIER démarrage, par
# exemple 2026-11-06T08:00:00+01:00 (le vendredi du chantier Lemaire). L'écart
# avec l'heure du poste est gardé dans $TOURNAGE/ecart-ms et resservi tel quel
# aux démarrages suivants : l'heure du récit avance alors comme la vraie, et
# rien n'y recule. Un récit tient dans sa journée : passé minuit, on efface ce
# fichier et l'on repart d'un état gardé (etat.sh).
#
# Avant : source scripts/monter-base-locale.sh (la base), npm ci si besoin,
# et NODE_ENV=production npx next build (la version bâtie).
#
# Il s'arrête par SON numéro de processus, jamais par son nom : d'autres
# serveurs peuvent tourner sur ce poste (CLAUDE.md §6). « next start » lance
# un enfant, next-server, qui tient le port et vit dans son propre groupe : on
# arrête l'enfant par son numéro, puis le parent.
# =======================================================================
source "$(dirname "${BASH_SOURCE[0]}")/_lieu.sh"
port_tenu() { (exec 3<>/dev/tcp/127.0.0.1/3000) 2>/dev/null; }
case "${1:-etat}" in
  demarrer)
    if port_tenu; then echo "REFUS : le port 3000 est déjà tenu." >&2; exit 1; fi
    if [ ! -f "$TOURNAGE/ecart-ms" ]; then
      jour="${2:?Premier démarrage : donner l instant du récit, par exemple 2026-11-06T08:00:00+01:00}"
      node -e 'const j = Date.parse(process.argv[1]); if (isNaN(j)) { console.error("instant illisible : " + process.argv[1]); process.exit(1); } process.stdout.write(String(j - Date.now()));' "$jour" > "$TOURNAGE/ecart-ms" || { rm -f "$TOURNAGE/ecart-ms"; exit 1; }
    fi
    export ATLAS_TOURNAGE_ECART_MS="$(cat "$TOURNAGE/ecart-ms")"
    export NODE_OPTIONS="--require=$ICI/horloge.cjs"
    export DATABASE_URL="postgresql://atlas_app:atlas_app_ci_pw@localhost:5432/$BASE_D_ESSAI"
    export DATABASE_ADMIN_URL="postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/$BASE_D_ESSAI"
    export AUTH_SECRET="ci-secret-not-a-real-production-value-000000000000"
    export CRON_SECRET="ci-placeholder-cron-secret-0000000000"
    export REDIS_URL="redis://localhost:6379"
    export ATLAS_URL_PUBLIQUE="https://cause.test" ATLAS_PROFIL="banc" ATLAS_EDITEUR_EMAIL="" AUTH_TRUST_HOST="true"
    export TRANSCRIPTION_PROVIDER="essai" LLM_PROVIDER="dev"
    cd "$DEPOT" && NODE_ENV=production setsid node node_modules/next/dist/bin/next start -p 3000 > "$TOURNAGE/serveur.log" 2>&1 < /dev/null &
    echo $! > "$TOURNAGE/serveur.pid"
    for i in $(seq 1 60); do
      # L'heure du récit se lit sans l'horloge du tournage (NODE_OPTIONS la chargerait, et l'écart compterait deux fois).
      curl -s -o /dev/null -m 2 http://localhost:3000/login && { echo "serveur prêt (processus $(cat "$TOURNAGE/serveur.pid")), à l'heure du récit : $(NODE_OPTIONS= node -e 'console.log(new Date(Date.now() + Number(process.env.ATLAS_TOURNAGE_ECART_MS)).toISOString())')"; exit 0; }
      sleep 0.5
    done
    echo "le serveur ne répond pas : voir $TOURNAGE/serveur.log" >&2; exit 1 ;;
  arreter)
    [ -f "$TOURNAGE/serveur.pid" ] || { echo "pas de serveur noté"; exit 0; }
    pid=$(cat "$TOURNAGE/serveur.pid"); enfants=$(pgrep -P "$pid" | tr '\n' ' ')
    [ -n "$enfants" ] && kill $enfants 2>/dev/null
    kill "$pid" 2>/dev/null
    for i in $(seq 1 40); do port_tenu || { rm -f "$TOURNAGE/serveur.pid"; echo "serveur arrêté"; exit 0; }; sleep 0.25; done
    echo "le port 3000 est encore tenu : regarder avec pgrep -af next" >&2; exit 1 ;;
  etat)
    port_tenu && echo "port 3000 tenu (processus noté : $(cat "$TOURNAGE/serveur.pid" 2>/dev/null || echo aucun))" || echo "port 3000 libre" ;;
  *) echo "demarrer, arreter ou etat" >&2; exit 2 ;;
esac
