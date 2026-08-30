#!/usr/bin/env bash
# COMPARER CE QU'UNE SAUVEGARDE CONTIENT À CE QUE LA BASE CONTIENT.
#
# ═════════════════════════════════════════════════════════════════════════════
# **POURQUOI CE CONTRÔLE EXISTE — mesuré le 27 août 2026, et c'est le défaut le
# plus grave trouvé dans ce lot.**
#
# `pg_dump` désactive la RLS pendant la copie et REFUSE de continuer si une
# politique s'applique — c'est un bon réflexe, il ne ment pas. Mais on peut le
# lui interdire avec `--enable-row-security`, et il devient alors OBÉISSANT :
# il copie ce que le rôle a le droit de voir, sans un mot.
#
# Trois mesures sur la même base, le même jour :
#
# | Ce qu'on fait | code | lignes copiées |
# |---|---|---|
# | superutilisateur | 0 | **189** |
# | rôle de sauvegarde + politique de lecture + `--enable-row-security` | 0 | **189** |
# | **le même rôle SANS la politique** | **0** | **136** |
#
# Le dernier cas rend un fichier de 223 Ko, code de sortie 0, et **il manque
# 28 % des données**. Ni la taille, ni le code de sortie, ni « au moins une
# ligne » ne l'attrapent. C'est exactement la sauvegarde qu'on découvre le jour
# où on en a besoin.
#
# **Le seul contrôle qui l'attrape est celui-ci : compter table par table, et
# comparer à la base vivante.**
#
#   bash scripts/_compter-lignes-sauvegarde.sh <fichier.sql> <url-de-la-base>
#
# Rend 0 si tout concorde, 1 sinon, et DIT les tables qui divergent.

set -uo pipefail
FICHIER="${1:?fichier de sauvegarde attendu}"
URL="${2:?adresse de la base attendue}"

# ═════════════════════════════════════════════════════════════════════════════
# **D'ABORD : AI-JE LE DROIT DE COMPTER ?**
#
# **Ce garde-fou est né d'un faux vert de ce script même, le 27 août 2026.**
# Il comparait le fichier à la base en interrogeant la base AVEC LE MÊME RÔLE
# qui avait fait la copie. Sous un rôle qui ne voit qu'une partie des lignes,
# les deux comptes tombaient d'accord — 136 dans le fichier, 136 vus en base —
# et il annonçait « autant qu'en base, table par table » sur une sauvegarde
# amputée de 28 %. Un aveugle qui se compare à lui-même conclut toujours qu'il
# voit tout.
#
# On ne peut donc pas se contenter de la CONSÉQUENCE (les comptes). Il faut
# vérifier la CONDITION : ce rôle voit-il réellement toutes les lignes ?
#
# Deux façons d'y avoir droit, et une seule suffit :
#   · le rôle traverse la RLS (superutilisateur ou BYPASSRLS) ;
#   · chaque table sous RLS porte une politique de lecture pour ce rôle —
#     c'est le chemin sans superutilisateur, celui de Scaleway.
DROIT=$(psql "$URL" -tAc "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user" 2>/dev/null | tr -d ' ')

if [ "$DROIT" != "t" ]; then
  AVEUGLES=$(psql "$URL" -tAc "
    SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
      FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relrowsecurity
       AND NOT EXISTS (
         SELECT 1 FROM pg_policies p
          WHERE p.tablename = c.relname
            AND p.cmd IN ('SELECT', 'ALL')
            AND p.qual = 'true'
            AND current_user = ANY(p.roles)
       )" 2>/dev/null)

  if [ -n "$AVEUGLES" ]; then
    echo "❌ CE RÔLE NE VOIT PAS TOUTE LA BASE — la sauvegarde serait amputée."
    echo
    echo "   Il ne traverse pas la RLS, et ces tables ne lui accordent aucune"
    echo "   politique de lecture complète :"
    echo "     $(echo "$AVEUGLES" | fold -s -w 66 | sed 's/^/     /')"
    echo
    echo "   Comparer les comptes ne servirait à RIEN ici : la base lui"
    echo "   répondrait la même chose tronquée qu'au moment de la copie, et"
    echo "   les deux tomberaient d'accord sur une sauvegarde incomplète."
    echo
    echo "   La parade, sans superutilisateur :"
    echo "     CREATE POLICY sauvegarde_lit_tout ON <table>"
    echo "       FOR SELECT TO <role> USING (true);"
    exit 1
  fi
fi

# Ce que le FICHIER porte, table par table. Le format de `pg_dump` est stable :
# `COPY public.<table> (…) FROM stdin;`, les lignes, puis `\.` seul.
awk '
  /^COPY public\.[a-z_]+ .* FROM stdin;$/ {
    t = $2; sub(/^public\./, "", t); dedans = 1; if (!(t in n)) n[t] = 0; next
  }
  /^\\\.$/ { dedans = 0; next }
  dedans   { n[t]++ }
  END      { for (k in n) print k "\t" n[k] }
' "$FICHIER" | sort > /tmp/atlas-sauvegarde-fichier.tsv

# **REFUS DE CONCLURE SUR RIEN — et ce garde-fou est né d'un vrai faux vert.**
# La première version de l'awk ci-dessus portait une faute de frappe. Il
# rendait une erreur de syntaxe, zéro table, et ce script annonçait alors
# « 0 ligne(s) copiée(s) — autant qu'en base » : un VERT PARFAIT sur une mesure
# qui n'avait pas eu lieu. Exactement ce que ce lot combat.
if [ ! -s /tmp/atlas-sauvegarde-fichier.tsv ]; then
  echo "❌ Aucun bloc de données lu dans le fichier."
  echo "   Ce contrôle n'a RIEN mesuré — ce n'est pas un succès."
  echo "   Soit le fichier ne contient aucune donnée, soit sa lecture a échoué."
  exit 1
fi

# Ce que la BASE porte. On ne demande que les tables présentes dans le fichier :
# une table vide n'écrit pas de bloc COPY, et la réclamer ferait rougir à tort.
: > /tmp/atlas-sauvegarde-base.tsv
while IFS=$'\t' read -r TABLE _; do
  N=$(psql "$URL" -tAc "SELECT count(*) FROM \"$TABLE\"" 2>/dev/null | tr -d ' ')
  [ -n "$N" ] && printf '%s\t%s\n' "$TABLE" "$N" >> /tmp/atlas-sauvegarde-base.tsv
done < /tmp/atlas-sauvegarde-fichier.tsv
sort -o /tmp/atlas-sauvegarde-base.tsv /tmp/atlas-sauvegarde-base.tsv

ECARTS=$(join -t $'\t' /tmp/atlas-sauvegarde-fichier.tsv /tmp/atlas-sauvegarde-base.tsv \
  | awk -F'\t' '$2 != $3 { print "     · " $1 " : " $2 " copiée(s), " $3 " en base" }')

TOTAL_FICHIER=$(awk -F'\t' '{s+=$2} END {print s+0}' /tmp/atlas-sauvegarde-fichier.tsv)
TOTAL_BASE=$(awk -F'\t' '{s+=$2} END {print s+0}' /tmp/atlas-sauvegarde-base.tsv)

if [ -n "$ECARTS" ]; then
  echo "❌ LA SAUVEGARDE EST INCOMPLÈTE — et elle n'en a pas l'air."
  echo
  echo "   $TOTAL_FICHIER ligne(s) copiée(s) pour $TOTAL_BASE en base."
  echo "   Les tables qui divergent :"
  echo "$ECARTS"
  echo
  echo "   La cause la plus fréquente : le rôle employé ne voit qu'une PARTIE"
  echo "   des lignes à cause de la RLS, et pg_dump a obéi sans se plaindre"
  echo "   (option --enable-row-security). Un fichier de bonne taille, un code"
  echo "   de sortie 0, et des données manquantes."
  exit 1
fi

echo "  ✓ $TOTAL_FICHIER ligne(s) copiée(s) — autant qu'en base, table par table."
exit 0
