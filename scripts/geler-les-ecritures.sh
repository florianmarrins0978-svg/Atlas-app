#!/usr/bin/env bash
# GELER LES ÉCRITURES D'ATLAS, LE TEMPS D'UNE RESTAURATION.
#
# ═════════════════════════════════════════════════════════════════════════════
# **POURQUOI CE GESTE EXISTE, ET POURQUOI IL EST LE PREMIER.**
#
# Pendant qu'on restaure, l'application continue de tourner. Un artisan crée un
# chantier, dicte un devis, envoie une facture — et tout cela s'écrit dans la
# base qu'on est en train de remplacer. Au moment de basculer, ces écritures-là
# sont **perdues, et personne ne sait lesquelles**.
#
# Geler d'abord, c'est accepter une demi-heure de gêne pour ne rien perdre du
# tout. Ne pas geler, c'est perdre en silence.
#
# ═════════════════════════════════════════════════════════════════════════════
# **POURQUOI CE N'EST PAS DU CODE DANS ATLAS.**
#
# La tentation serait d'ajouter un « mode lecture seule » dans l'application :
# une variable, un écran, un bandeau. C'est une mauvaise idée pour ce cas-ci,
# et le brief du 27 août 2026 pose lui-même la règle — ne coder dans Atlas que
# ce que l'hébergeur ne sait pas faire.
#
# | | |
# |---|---|
# | un mode dans l'application | il faut que l'application tourne, qu'elle soit joignable, et que la variable soit prise en compte. Trois conditions, un jour où justement tout va mal |
# | ce gel-ci | il tient **dans la base**. Il vaut pour toutes les instances à la fois, y compris celles qu'on a oubliées, et il survit à un redémarrage de l'application |
#
# Et il ne se contourne pas : même une instance restée branchée par accident ne
# peut plus écrire.
#
# ═════════════════════════════════════════════════════════════════════════════
# **CE QUE ÇA FAIT, EXACTEMENT — ET CE QUE ÇA NE TOUCHE SURTOUT PAS.**
#
# On pose `default_transaction_read_only` sur le RÔLE de l'application. Toute
# nouvelle connexion ouvre alors des transactions en lecture seule : les SELECT
# passent, les INSERT/UPDATE/DELETE sont refusés par le moteur.
#
# **On ne touche AUCUN droit, et c'est le cœur du sujet.**
#
# La première version de ce script retirait les droits d'écriture
# (`REVOKE INSERT, UPDATE, DELETE`) et les rendait au dégel
# (`GRANT … ON ALL TABLES`). Elle a CASSÉ M9, et la batterie l'a prouvé le
# 27 août 2026 : « le rôle applicatif peut encore ÉCRIRE un condensat ».
#
# Le mécanisme du défaut mérite d'être écrit, parce qu'il est contre-intuitif :
# M9 retire à `atlas_app` l'accès à la COLONNE `users.password_hash`. Un
# `GRANT … ON ALL TABLES` accorde le droit sur la TABLE ENTIÈRE — et un droit de
# table écrase la restriction de colonne. Le dégel rendait donc plus que ce que
# le gel avait retiré, et rouvrait en silence la porte que M9 avait fermée.
#
# **Un outil de secours qui affaiblit la sécurité en revenant à la normale est
# pire que pas d'outil du tout.** D'où ce mécanisme-ci, qui n'a rien à
# reconstruire : on pose un réglage, on l'enlève.
#
# **On ne coupe PAS l'application**, et c'est délibéré : un artisan devant une
# page morte appelle. Un artisan qui voit ses données et lit « enregistrement
# indisponible » attend.
#
#     bash scripts/geler-les-ecritures.sh          # geler
#     bash scripts/geler-les-ecritures.sh --degeler  # rendre l'écriture
#     bash scripts/geler-les-ecritures.sh --etat     # où en est-on ?
#
# ═════════════════════════════════════════════════════════════════════════════
# **CE QUI RESTE À FAIRE, ET QUI N'EST PAS DANS CE LOT.**
#
# Une écriture refusée remonte aujourd'hui comme une erreur technique, pas
# comme une phrase que l'artisan comprend. C'est acceptable pour une urgence
# rare et annoncée ; ça ne le serait pas pour un usage courant. Écrit dans
# `TODO.md` plutôt que bâclé ici : ce lot porte la sauvegarde, pas la refonte
# des messages d'erreur.

set -uo pipefail

ROLE="${ATLAS_ROLE_APPLICATIF:-atlas_app}"
URL="${DATABASE_SUPER_URL:-${DATABASE_ADMIN_URL:-${DATABASE_URL:-}}}"

if [ -z "$URL" ]; then
  echo "❌ Aucune adresse de base (DATABASE_SUPER_URL, DATABASE_ADMIN_URL, DATABASE_URL)."
  echo "   Sans elle il n'y a rien à geler."
  exit 2
fi

# Le rôle qui gèle doit pouvoir retirer des droits : ce n'est pas celui de
# l'application. On le vérifie plutôt que de laisser un REVOKE échouer à moitié.
PEUT=$(psql "$URL" -tAc "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user" 2>/dev/null | tr -d ' ')
if [ "$PEUT" != "t" ]; then
  echo "❌ Le rôle employé n'a pas de quoi geler quoi que ce soit."
  echo "   Il faut un superutilisateur — le rôle de l'application ne peut pas"
  echo "   se retirer ses propres droits, et c'est heureux."
  exit 2
fi

etat() {
  # On lit le réglage posé sur le rôle, pas un drapeau à nous : un drapeau ment
  # dès qu'on l'oublie, le réglage est la vérité que le moteur applique.
  psql "$URL" -tAc \
    "SELECT coalesce((SELECT 'gele' FROM pg_roles WHERE rolname = '$ROLE'
        AND 'default_transaction_read_only=on' = ANY(rolconfig)), 'ecrit')" 2>/dev/null | tr -d ' '
}

# **Les connexions déjà ouvertes gardent leur réglage.** Un serveur applicatif
# tient un bassin de connexions : sans les fermer, il continuerait d'écrire
# pendant des minutes après le gel. On les coupe donc — l'application les
# rouvrira toute seule, en lecture seule cette fois.
couper_les_connexions_ouvertes() {
  psql "$URL" -tAc \
    "SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity
      WHERE usename = '$ROLE' AND pid <> pg_backend_pid()" 2>/dev/null | tr -d ' '
}

case "${1:-}" in
  --etat)
    if [ "$(etat)" = "gele" ]; then
      echo "🔴 Atlas est GELÉ en lecture seule (rôle $ROLE)."
    else
      echo "🟢 Atlas ÉCRIT normalement (rôle $ROLE)."
    fi
    exit 0
    ;;

  --degeler)
    echo "→ On rend l'écriture à $ROLE…"
    if ! psql "$URL" -v ON_ERROR_STOP=1 -q -c \
      "ALTER ROLE \"$ROLE\" RESET default_transaction_read_only;"; then
      echo "❌ Le dégel a échoué. Atlas reste en lecture seule."
      exit 1
    fi
    COUPEES=$(couper_les_connexions_ouvertes)
    if [ "$(etat)" != "ecrit" ]; then
      echo "❌ Le dégel s'est déroulé sans erreur, et le réglage est toujours là."
      echo "   Ne pas remettre Atlas en service sans comprendre pourquoi."
      exit 1
    fi
    echo "🟢 Atlas écrit de nouveau (${COUPEES:-0} connexion(s) rouverte(s))."
    exit 0
    ;;

  *)
    if [ "$(etat)" = "gele" ]; then
      echo "🔴 Déjà gelé — rien à faire."
      exit 0
    fi
    echo "→ On passe $ROLE en lecture seule (aucun droit n'est touché)…"
    if ! psql "$URL" -v ON_ERROR_STOP=1 -q -c \
      "ALTER ROLE \"$ROLE\" SET default_transaction_read_only = on;"; then
      echo "❌ Le gel a échoué. Atlas écrit toujours — ne pas restaurer maintenant."
      exit 1
    fi
    # **On VÉRIFIE que le gel a pris.** Un ordre qui rend 0 sans avoir rien
    # changé laisserait croire à une base figée pendant qu'elle continue
    # d'accepter des écritures — le pire des deux mondes.
    if [ "$(etat)" != "gele" ]; then
      echo "❌ L'ordre s'est déroulé sans erreur, et le réglage n'est pas posé."
      echo "   Atlas ÉCRIT ENCORE. Ne pas restaurer."
      exit 1
    fi
    COUPEES=$(couper_les_connexions_ouvertes)
    echo
    echo "🔴 Atlas est GELÉ. Il lit, il n'écrit plus."
    echo "   ${COUPEES:-0} connexion(s) déjà ouverte(s) ont été coupées : sans cela,"
    echo "   elles auraient continué d'écrire avec leur ancien réglage."
    echo
    echo "   La suite, dans l'ordre :"
    echo "     1. choisir le point de restauration ;"
    echo "     2. restaurer dans une base ISOLÉE, jamais par-dessus celle-ci ;"
    echo "     3. npx tsx scripts/eprouver-restauration.ts <fichier>"
    echo "     4. basculer, puis dégeler :"
    echo "        bash scripts/geler-les-ecritures.sh --degeler"
    exit 0
    ;;
esac
