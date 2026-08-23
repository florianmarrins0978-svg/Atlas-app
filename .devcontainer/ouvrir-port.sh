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
#   ouvert          le port vient d'être rendu public
#   hors-codespace  on n'est pas dans un espace GitHub : il n'y a rien à ouvrir
#   sans-gh         l'outil `gh` est absent — le patron devra le faire à la main
#   non-declare     `gh` répond, mais le RELAIS NE CONNAÎT PAS le port 3000
#   échec:<raison>  `gh` a refusé, et la raison est recopiée derrière les deux points
#
# **`non-declare` est né le 23 août 2026, et il valait une soirée.** Le patron a
# écrit trois fois « ça ne marche pas » pendant que la fiche l'envoyait rendre
# public un port… qui n'existait pas pour le relais. Rendre public et être
# DÉCLARÉ sont deux choses : `gh codespace ports visibility` règle la première
# et se tait sur la seconde, si bien qu'un port jamais enregistré recevait le
# même verdict qu'un port simplement privé — et le même geste, qui ne pouvait
# rien. On pose donc la question qui manquait : le relais connaît-il ce port ?
#
# **Et `échec` porte désormais SA RAISON.** Elle partait à `/dev/null` : le
# refus de `gh` — jeton absent, espace introuvable, réseau — se lisait
# « échec », un mot qui ne désigne personne. Un défaut muet se rend bavard
# avant de se corriger (`AGENTS.md`).
#
# **`sans-gh` n'est PAS un cas d'école, c'est le cas courant ici.** L'image de ce
# conteneur est `mcr.microsoft.com/devcontainers/typescript-node:22`, qui
# n'embarque pas `gh` — contrairement à l'image Codespaces par défaut, d'où la
# méprise. Le patron a reçu « bash: gh: command not found ». Le remède qui marche
# sans rien installer est l'onglet PORTS de l'éditeur, et c'est LUI que
# `demarrer.sh` met en avant. `gh` arrive par une fonctionnalité déclarée dans
# `devcontainer.json` — donc seulement pour les espaces à naître, une fois de
# plus (voir `ARCHITECTURE.md` §55).
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
RAISON="$(timeout 30 gh codespace ports visibility "${PORT}:public" -c "$CODESPACE_NAME" 2>&1 >/dev/null)"
CODE=$?

if [ "$CODE" -eq 0 ]; then
  echo "ouvert"
  exit 0
fi

# **La question qui manquait : le relais CONNAÎT-IL ce port ?**
#
# `gh codespace ports` liste ce qui est enregistré. Le port absent de cette
# liste, aucun réglage de visibilité ne peut aboutir — et l'onglet PORTS ne
# servira qu'à le REMETTRE, pas à le basculer. Distinguer les deux, c'est la
# différence entre un geste qui répare et un geste qu'on refait trois fois.
#
# La liste peut elle-même échouer (jeton, réseau) : on ne conclut alors PAS
# « non déclaré », on rend le refus initial. Une supposition présentée comme une
# mesure coûte plus cher qu'un « je ne sais pas ».
LISTE="$(timeout 30 gh codespace ports -c "$CODESPACE_NAME" 2>/dev/null)"
if [ -n "$LISTE" ] && ! printf '%s' "$LISTE" | grep -qE "(^|[^0-9])${PORT}([^0-9]|$)"; then
  echo "non-declare"
  exit 0
fi

# Une raison tient sur une ligne : la fiche est lue sur un téléphone, et un pavé
# d'erreur y noie ce qu'il faut en retenir.
RAISON="$(printf '%s' "$RAISON" | tr '\n' ' ' | tr -s ' ' | cut -c1-160)"
echo "échec:${RAISON:-sans raison donnée}"
exit 0
