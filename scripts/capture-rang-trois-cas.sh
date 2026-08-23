#!/usr/bin/env bash
# Les trois façons de placer le rappel sur l'accueil — trois photos du VRAI écran.
#
# Sa demande du 16 août 2026 : « fais-moi la capture des trois cas ».
#
# POURQUOI CE SCRIPT EXISTE, PLUTÔT QU'UNE BOUCLE DANS LE NAVIGATEUR. Les cartes
# repliées ne sont pas rendues : l'écran n'en pose que deux dans le document. On
# ne peut donc ni les réordonner ni les révéler après coup — la première
# tentative l'a montré, le rappel restait absent et l'image aurait illustré A en
# prétendant montrer B.
#
# Les deux variantes changent donc VRAIMENT le code, le temps d'une photo, puis
# le rendent. Le serveur de développement recharge tout seul entre les deux.
#
# LE CODE EST RENDU MÊME EN CAS D'ERREUR (`trap`) : un script qui laisserait le
# produit modifié après un échec est un piège, pas un outil.
set -euo pipefail

DOSSIER="${1:?usage: capture-rang-trois-cas.sh <dossier>}"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
CIBLE="$RACINE/src/app/Notifications.tsx"
SAUVE="$(mktemp)"

cp "$CIBLE" "$SAUVE"
trap 'cp "$SAUVE" "$CIBLE"; rm -f "$SAUVE"; echo "→ code rendu à son état d'"'"'origine"' EXIT

# **Le limiteur de connexion se vide avant chaque photo.** Il bloque au bout de
# cinq connexions par quart d'heure — une protection réelle, et trois photos
# d'affilée la déclenchent. Sans ce vidage, la deuxième image échoue sur un
# « délai dépassé » à la connexion, qui accuse le formulaire alors qu'il va très
# bien. Vu, et perdu dix minutes à chercher ailleurs.
photo() {
  redis-cli FLUSHALL >/dev/null 2>&1 || true
  ATLAS_CAS="$1" ATLAS_REMETTRE_A_NEUF="${ATLAS_REMETTRE_A_NEUF:-0}" \
    npx tsx "$RACINE/scripts/capture-rang-du-rappel.mts" "$DOSSIER"
}

# La base repart du jeu de démonstration pour la PREMIÈRE image seulement : les
# trois doivent montrer la MÊME scène, sinon elles ne comparent rien.
echo "── A · ce qui existe aujourd'hui ────────────────────────────────"
ATLAS_REMETTRE_A_NEUF=1 photo "A-aujourd-hui"

echo "── B · le rappel passe devant ───────────────────────────────────"
python3 - "$CIBLE" <<'PY'
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
s = s.replace("""  const cartes = [
    ...initiales.map(versCarte),
    ...caducs.map(caducVersCarte),
    ...rappels.map(rappelVersCarte),
  ];""", """  const cartes = [
    ...rappels.map(rappelVersCarte),
    ...initiales.map(versCarte),
    ...caducs.map(caducVersCarte),
  ];""")
open(p, "w", encoding="utf-8").write(s)
PY
sleep 4
photo "B-le-rappel-devant"

echo "── C · trois cartes au lieu de deux ─────────────────────────────"
cp "$SAUVE" "$CIBLE"
python3 - "$CIBLE" <<'PY'
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
s = s.replace("const VISIBLES_PAR_DEFAUT = 2;", "const VISIBLES_PAR_DEFAUT = 3;")
open(p, "w", encoding="utf-8").write(s)
PY
sleep 4
photo "C-trois-cartes"
