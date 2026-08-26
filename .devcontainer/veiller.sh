#!/usr/bin/env bash
# Garde le serveur du banc d'essai debout, et le relève quand il tombe.
#
# **Le défaut du 9 août 2026, et il n'était pas une lenteur.** Le patron ouvre
# l'application : « Cette page … est introuvable — HTTP ERROR 404 ». Son
# terminal montrait l'invite revenue sous `npm run essai` : **le serveur était
# mort**. Un 404 sur cette adresse ne veut pas dire « page absente », il veut
# dire « plus rien n'écoute sur le port 3000 ».
#
# Rien ne le relevait. Le démarrage de l'espace lance le serveur une fois, et
# une seule ; s'il meurt ensuite — un `pkill` du démarrage rejoué, une commande
# tapée dans le mauvais terminal, une compilation qui épuise la mémoire des deux
# cœurs — l'application reste morte jusqu'à ce que le patron s'en aperçoive et
# aille taper une commande. C'est-à-dire jusqu'à ce qu'il perde une demi-heure.
#
# Ce veilleur regarde toutes les quinze secondes, et relance ce qu'il faut.
#
# **Deux conditions avant de relancer, pas une.** Le serveur peut mettre
# longtemps à répondre pendant une grosse compilation : sur ce seul critère, on
# lancerait un second serveur qui se battrait avec le premier pour le port —
# exactement le désordre qui a tué celui du patron. On exige donc que la santé
# ne réponde plus ET qu'aucun `next dev` ne tourne.
#
# Ne rend jamais la main : lancé par `demarrer.sh` avec `setsid`, détaché.
set -uo pipefail

DEPOT="${1:-$(pwd)}"
PORT="${PORT:-3000}"
JOURNAL="${JOURNAL:-/tmp/essai.log}"
VERROU=/tmp/atlas-veilleur.pid
# Détournables uniquement pour les ÉPROUVER : une suite ne peut pas attendre un
# quart d'heure pour vérifier qu'une publication a lieu, ni dix minutes pour
# voir une construction se retenter.
INTERVALLE="${ATLAS_INTERVALLE_VEILLE:-15}"
INTERVALLE_RAPPORT="${ATLAS_INTERVALLE_RAPPORT:-900}"

# ─────────────────────────────────────────────────────────────────────────────
# **LA CONSTRUCTION QUI A ÉCHOUÉ N'ÉTAIT JAMAIS RETENTÉE.**
#
# Le patron, le 18 août 2026 : *« je crois que j'ai encore la version lente »*.
# Sa fiche disait exactement pourquoi :
#
#     Code SERVI : AUCUNE — la construction a ÉCHOUÉ (05:13:44Z)
#     dit: ⨯ Another next build process is already running.
#
# Tout le reste avait déjà été réparé : la construction orpheline est délogée
# avant de bâtir, le verrou de banc se prend en création exclusive, et une
# seconde tentative part quand c'est ce refus-là qui a parlé
# (`ARCHITECTURE.md` §126). **Et pourtant il était encore lent** — parce
# qu'aucun de ces correctifs ne couvre le cas où les deux tentatives tombent.
#
# **Le trou était ICI, et il est béant :** ce veilleur ne relance `npm run banc`
# que lorsque RIEN ne répond sur le port. Or une construction qui échoue laisse
# le banc en mode développement, et ce mode-là **répond très bien**. Les deux
# conditions ci-dessous étaient donc satisfaites, le veilleur se déclarait
# content, et le patron passait sa soirée sur la version lente — sans que rien,
# nulle part, ne retente quoi que ce soit.
#
# La cause de l'échec, elle, est souvent PASSAGÈRE : son espace a 8 Go et 132 Mo
# libres au moment de la panne. Dix minutes plus tard, la mémoire est rendue et
# la même construction passe. C'est exactement le cas où réessayer coûte
# quelques minutes de processeur et rapporte une soirée entière.
#
# **C'est le RYTHME qui est borné, plus le nombre — corrigé le 20 août 2026.**
#
# Ce compteur s'arrêtait à trois, et la fiche du patron disait alors, mot pour
# mot : *« il est LENT, et le restera »*. Ce matin-là, à 06 h 10, la
# construction tombe sur le verrou ; à 06 h 40 il écrit *« l'application est
# lente corrige ça »*. Les trois tentatives étaient passées, et **plus rien au
# monde n'allait retenter quoi que ce soit** avant qu'il rallume son espace —
# un geste que personne ne lui avait demandé, pour une panne qu'il ne pouvait
# pas voir.
#
# Trois tentatives, c'est le bon rythme pour une panne passagère : sa mémoire
# se libère en dix minutes, et la construction repasse. Mais la cause peut
# durer plus longtemps que trente minutes — un autre banc qui bâtit, une
# journée de travail qui occupe les 8 Go —, et une demi-heure de patience ne
# doit pas condamner la journée entière.
#
# **Donc : après la salve rapide, on continue AU RALENTI.** Une construction
# toutes les demi-heures ne maintient personne à genoux — c'est deux ou trois
# minutes de processeur par demi-heure —, et elle finit par tomber sur le
# moment où la machine peut la faire passer. Ce qui reste interdit est
# inchangé : jamais deux constructions à la fois, et jamais avant que le délai
# soit écoulé.
TEMOIN_ECHEC="${ATLAS_TEMOIN_ECHEC:-/tmp/atlas-construction-echouee.txt}"
RELANCE_APRES="${ATLAS_RELANCE_CONSTRUCTION_S:-600}"
RELANCES_MAX="${ATLAS_RELANCES_CONSTRUCTION_MAX:-3}"
# Le pas lent, une fois la salve rapide épuisée.
RELANCE_LENTE="${ATLAS_RELANCE_LENTE_S:-1800}"
RELANCES=0
PROCHAINE_RELANCE=$(( $(date +%s) + RELANCE_APRES ))

# **Un seul veilleur.** Deux veilleurs relanceraient deux serveurs, et le remède
# reproduirait la panne. Le verrou porte un identifiant de processus : un
# fichier resté d'un conteneur précédent ne bloque donc rien.
if [ -f "$VERROU" ]; then
  ANCIEN="$(cat "$VERROU" 2>/dev/null || true)"
  if [ -n "$ANCIEN" ] && kill -0 "$ANCIEN" 2>/dev/null; then
    echo "veilleur déjà en place (pid $ANCIEN)"
    exit 0
  fi
fi
echo $$ > "$VERROU"

cd "$DEPOT" || exit 0

# ─────────────────────────────────────────────────────────────────────────────
# **La fiche se publie À CÔTÉ de la surveillance, jamais dedans.**
#
# Défaut trouvé le 16 août 2026, en cherchant pourquoi le patron ne pouvait plus
# ouvrir l'application et pourquoi sa fiche datait d'une demi-heure.
#
# La publication vivait au bas de la boucle ci-dessous. Or cette boucle **ne
# tourne pas** quand le serveur est tombé : elle appelle `npm run banc`, qui ne
# rend la main qu'à la mort du serveur suivant — des heures, si tout va bien.
# Le compteur n'avançait donc plus, et la fiche se figeait **exactement à
# l'instant où le veilleur se met au travail**, c'est-à-dire au seul moment où
# quelqu'un a besoin de la lire.
#
# Et le piège se refermait deux fois, parce que la fiche porte sa propre règle
# de lecture : « passé vingt minutes sans réécriture, l'espace est arrêté ».
# Elle était donc devenue *fausse* — elle envoyait rallumer une machine qui
# tournait, au lieu de faire chercher la panne. Une consigne qui accuse à tort
# coûte plus cher que pas de consigne du tout (`CLAUDE.md` §5).
#
# Un processus séparé n'a pas ce défaut : rien de ce que fait la surveillance ne
# peut l'endormir. Il s'arrête avec le veilleur — sans quoi un veilleur relancé
# laisserait deux publieurs, et la fiche serait réécrite deux fois par quart
# d'heure sans que personne ne comprenne pourquoi.
VEILLEUR=$$
(
  while true; do
    sleep "$INTERVALLE_RAPPORT"
    kill -0 "$VEILLEUR" 2>/dev/null || exit 0
    ( cd "$DEPOT" && ATLAS_MOMENT=veille node scripts/rapporter-espace.mjs >> "$JOURNAL" 2>&1 )
  done
) &

# **`next dev` ne suffit PAS comme motif, et c'est la cause première du 404.**
#
# Constaté sur cette machine, en regardant les processus : `npx next dev` n'est
# qu'une pile d'enveloppes. Le serveur qui écoute vraiment, lui, **se renomme** :
#
#     27577 npm exec next dev -H 0.0.0.0 -p 3000   ← enveloppe
#     27590 node .../next dev -H 0.0.0.0 -p 3000   ← enveloppe
#     29803 next-server (v16.2.12)                 ← CELUI QUI ÉCOUTE
#
# `pkill -f "next dev"` tue donc les enveloppes et **laisse le vrai serveur
# vivant, orphelin, accroché au port**. Le suivant ne peut plus s'y attacher, et
# l'orphelin sert un cache qui n'existe peut-être plus : toutes les pages
# rendent 404. C'est exactement ce que le patron a lu, et c'est reproductible —
# je l'ai provoqué sans le vouloir en éprouvant ce script.
#
# Les crochets autour du « n » restent indispensables : sans eux, `pgrep -f`
# trouverait la ligne de commande de ce script et conclurait toujours que le
# serveur tourne. Le même piège avait déjà fait que `demarrer.sh` se tuait avant
# de rien lancer.
MOTIF='[n]ext(-server| dev| start)'

BASCULE="$(dirname "$0")/bascule-en-cours.sh"

while true; do
  # **Ne pas prendre une bascule pour une mort.** Quand `banc.mjs` remplace son
  # serveur de développement par la version bâtie, il tue le premier avant de
  # lancer le second : pendant ce battement, la santé ne répond plus ET aucun
  # `next` ne tourne — les deux conditions ci-dessous, mot pour mot. Le veilleur
  # lançait donc un SECOND banc, qui prenait le port, et le `next start` du
  # premier tombait sur « EADDRINUSE ». Constaté chez le patron le 10 août 2026,
  # `errno: -98`, après une construction pourtant réussie.
  #
  # Le drapeau expire tout seul (voir `bascule-en-cours.sh`) : un banc tué au
  # mauvais moment ne peut pas endormir ce veilleur pour toujours.
  if bash "$BASCULE" 2>/dev/null; then
    sleep "$INTERVALLE"
    continue
  fi

  if ! curl -fsS -o /dev/null --max-time 10 "http://127.0.0.1:${PORT}/api/health/live" 2>/dev/null; then
    if ! pgrep -f "$MOTIF" >/dev/null 2>&1; then
      echo "$(date '+%d/%m %H:%M:%S') — plus rien n'écoute sur le port ${PORT}, relance du serveur" >> "$JOURNAL"
      # Rend la main seulement quand le serveur meurt : la boucle le relèvera.
      npm run banc >> "$JOURNAL" 2>&1
      echo "$(date '+%d/%m %H:%M:%S') — le serveur s'est arrêté" >> "$JOURNAL"
    else
      # **Un serveur présent mais muet est pire qu'un serveur absent** : il tient
      # le port, et rien ne pourra le remplacer tant qu'il n'a pas été délogé.
      # On lui laisse deux tours — une compilation lourde peut faire taire la
      # santé un instant — puis on le déloge et la boucle repart proprement.
      MUET=$((${MUET:-0} + 1))
      if [ "$MUET" -ge 2 ]; then
        echo "$(date '+%d/%m %H:%M:%S') — un serveur tient le port ${PORT} sans répondre : on le déloge" >> "$JOURNAL"
        pkill -f "$MOTIF" 2>/dev/null
        sleep 2
        MUET=0
      fi
    fi
  else
    MUET=0

    # ─────────────────────────────────────────────────────────────────────────
    # **LE PORT S'OUVRE QUAND LE SERVEUR RÉPOND, PAS AVANT.**
    #
    # Le patron, le 26 août 2026, capture de son onglet PORTS à l'appui :
    # *« problème pas de port connecté »*. Sa fiche disait pourquoi, et le mot
    # exact compte : *« error updating port 3000 to public: error getting
    # tunnel port: […] 404 Not Found »*.
    #
    # **Le relais ne connaissait pas encore le port.** `demarrer.sh` demande son
    # ouverture à la ligne 271 ; le veilleur, lui, vient d'être posé à la 212 et
    # sa construction dure des minutes. Au moment de la demande, RIEN n'écoute
    # sur 3000 — GitHub n'a donc aucun port à rendre public, et répond 404. Puis
    # le serveur démarre, le port se déclare tout seul… **et reste PRIVÉ**,
    # parce que plus rien ne redemande. C'est le symptôme du 10 août :
    # GitHub sert sa page de connexion à la place d'Atlas, et depuis un
    # téléphone non connecté il n'y a rien à voir.
    #
    # **Une seule tentative au démarrage ne pouvait pas marcher** : elle avait
    # lieu au seul moment où elle ne pouvait pas aboutir.
    #
    # On redemande donc ICI, où l'on sait que le serveur répond — donc que le
    # port existe. Une fois obtenu, on n'y revient plus : `gh` interroge le
    # réseau, et l'appeler toutes les quinze secondes pour rien userait un
    # quota sans rien apprendre.
    if [ "${PORT_OUVERT:-non}" != "oui" ]; then
      MOT_PORT="$(bash "$(dirname "$0")/ouvrir-port.sh" "$PORT" 2>/dev/null)"
      # **La fiche lit ce fichier** (`diagnostiquer-espace.mjs`) : sans cette
      # ligne, elle continuerait d'annoncer le refus du démarrage alors que le
      # port est ouvert — et sa règle enverrait le patron réparer ce qui marche.
      printf '%s\n' "$MOT_PORT" > /tmp/atlas-port.txt 2>/dev/null || true
      case "$MOT_PORT" in
        # Ces trois-là ne se retentent pas : hors Codespaces il n'y a pas de
        # port à ouvrir, et sans `gh` aucune tentative n'aboutira jamais.
        ouvert|hors-codespace|sans-gh)
          PORT_OUVERT=oui
          [ "$MOT_PORT" = "ouvert" ] && \
            echo "$(date '+%d/%m %H:%M:%S') — port ${PORT} ouvert au public, une fois le serveur debout" >> "$JOURNAL"
          ;;
        # `non-declare` et les refus se retentent au tour suivant : le relais
        # peut mettre quelques secondes de plus à enregistrer le port.
        *)
          echo "$(date '+%d/%m %H:%M:%S') — port ${PORT} pas encore public (${MOT_PORT}), on retentera" >> "$JOURNAL"
          ;;
      esac
    fi

    # **Le serveur répond — mais sert-il la version rapide ?**
    #
    # `banc.mjs` efface ce témoin dès qu'une construction réussit : sa présence
    # veut donc dire « la dernière tentative a échoué, et nous sommes lents ».
    # C'est le seul signal qui distingue un banc rapide d'un banc lent, et les
    # deux répondent pareil à la santé.
    if [ -f "$TEMOIN_ECHEC" ] && [ "$(date +%s)" -ge "$PROCHAINE_RELANCE" ]; then
      # **Jamais deux constructions à la fois.** C'est la panne d'origine : une
      # seconde construction lancée à côté d'une première tombe sur son verrou,
      # et les deux échouent. Si une construction tourne déjà — la nôtre de tout
      # à l'heure, ou celle d'un banc relancé ailleurs — on la laisse finir.
      if ! pgrep -f '[n]ext build' >/dev/null 2>&1; then
        RELANCES=$((RELANCES + 1))
        echo "$(date '+%d/%m %H:%M:%S') — la version rapide manque encore : on retente la construction (${RELANCES}/${RELANCES_MAX})" >> "$JOURNAL"
        # Bloque jusqu'à la mort du serveur suivant, comme la relance ci-dessus.
        # Si la construction passe, `banc.mjs` remplace le mode développement
        # par la version bâtie et le patron cesse d'attendre ses écrans.
        npm run banc >> "$JOURNAL" 2>&1
        echo "$(date '+%d/%m %H:%M:%S') — le serveur s'est arrêté" >> "$JOURNAL"
      fi
      # La salve rapide d'abord — une panne passagère se répare là. Puis le pas
      # lent, indéfiniment : ce qui a échoué trois fois de suite peut très bien
      # passer dans une heure, et la journée du patron ne doit pas dépendre de
      # ce qu'il pense à rallumer son espace.
      if [ "$RELANCES" -lt "$RELANCES_MAX" ]; then
        PROCHAINE_RELANCE=$(( $(date +%s) + RELANCE_APRES ))
      else
        PROCHAINE_RELANCE=$(( $(date +%s) + RELANCE_LENTE ))
        if [ "$RELANCES" -eq "$RELANCES_MAX" ]; then
          echo "$(date '+%d/%m %H:%M:%S') — ${RELANCES_MAX} tentatives rapprochées ont échoué : on continue, une toutes les ${RELANCE_LENTE} s" >> "$JOURNAL"
        fi
      fi
    fi
  fi

  # La fiche, elle, se publie dans le processus séparé ouvert plus haut : cette
  # boucle-ci s'arrête de tourner dès que le serveur tombe, et c'est précisément
  # là qu'il faut continuer à publier.

  sleep "$INTERVALLE"
done
