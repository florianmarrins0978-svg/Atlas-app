#!/usr/bin/env bash
# Rendre le port 3000 joignable depuis un téléphone — À CHAQUE ALLUMAGE.
#
# ─────────────────────────────────────────────────────────────────────────────
# **Pourquoi ce script existe alors que `devcontainer.json` le déclare déjà.**
#
# `portsAttributes.3000.visibility = "public"` y est écrit depuis le 6 août 2026.
# Le 10 août au soir, le port du patron était pourtant PRIVÉ : son diagnostic a
# rapporté une page de connexion GitHub (`/pf-signin?...`) là où Atlas aurait dû
# répondre. Depuis son téléphone, non connecté à GitHub, il n'y avait rien à
# voir — et rien ne le disait.
#
# La cause n'est pas une erreur de syntaxe : **`devcontainer.json` est appliqué à
# la CRÉATION de l'espace de travail.** Le sien est plus ancien que la ligne. La
# déclaration était donc inerte, exactement comme `ATLAS_BANC_ESSAI` dans
# `docker-compose.yml` (voir `src/profil-banc.ts`) : c'est la troisième fois que
# ce piège coûte une soirée. Une déclaration ne répare pas un espace déjà né ;
# seul un geste rejoué à chaque allumage le fait.
#
# **Ce que cela expose, et ce que cela n'expose pas.** L'application garde son
# écran de connexion ; la page du client reste tenue par un jeton imprévisible.
# Ce qui devient joignable, c'est la porte, pas le contenu. Le mot de passe de
# démonstration étant public, ce banc ne doit contenir que des données inventées
# — c'est écrit dans `docs/ESSAYER.md`, et c'est la décision du 6 août 2026.
#
# ─────────────────────────────────────────────────────────────────────────────
# Écrit UN SEUL MOT sur sa sortie, pour que `demarrer.sh` sache quoi dire :
#
#   ouvert         le port vient d'être rendu public
#   hors-codespace on n'est pas dans un espace GitHub : il n'y a rien à ouvrir
#   sans-gh        l'outil `gh` est absent — le patron devra le faire à la main
#   échec          `gh` a refusé ; la raison est sur la sortie d'erreur
#
# Ne fait JAMAIS échouer le démarrage : un port privé rend le banc pénible, une
# erreur ici le rendrait mort.
set -uo pipefail

PORT="${1:-3000}"

# Hors d'un espace GitHub — essai en local, autre machine — il n'y a aucun port
# à publier, et prétendre le contraire enverrait chercher au mauvais endroit.
if [ -z "${CODESPACE_NAME:-}" ]; then
  echo "hors-codespace"
  exit 0
fi

if ! command -v gh > /dev/null 2>&1; then
  echo "sans-gh"
  exit 0
fi

# Le délai est là pour le cas où `gh` attend une authentification qui ne viendra
# pas : le démarrage ne doit pas rester suspendu à cette commande de confort.
if timeout 30 gh codespace ports visibility "${PORT}:public" -c "$CODESPACE_NAME" > /dev/null 2>&1; then
  echo "ouvert"
else
  echo "échec"
fi
exit 0
