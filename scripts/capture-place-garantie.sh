#!/usr/bin/env bash
# Deux photos : ce qui est codé aujourd'hui, et la « place garantie ».
#
# Sa demande du 16 août 2026 : « fais les deux captures », après avoir dit
# « pas compris la différence » — la description ne suffisait pas.
#
# CE QUE LES DEUX IMAGES COMPARENT, sur la MÊME scène (trois chantiers sans
# devis, deux clients qui ont répondu) :
#
#   B  · ce qui tourne depuis sa décision « fait la B » : ses rappels passent
#        devant, et sur un écran chargé ils prennent LES DEUX places ;
#   G  · la place garantie : la première reste au rappel — son choix B tient —,
#        la seconde revient à une réponse de client s'il en existe une.
#
# La variante change VRAIMENT le code, le temps de la photo, et le rend ensuite
# (`trap`) : un script qui laisserait le produit modifié après une erreur serait
# un piège, pas un outil.
set -euo pipefail

DOSSIER="${1:?usage: capture-place-garantie.sh <dossier>}"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
CIBLE="$RACINE/src/app/Notifications.tsx"
SAUVE="$(mktemp)"

cp "$CIBLE" "$SAUVE"
trap 'cp "$SAUVE" "$CIBLE"; rm -f "$SAUVE"; echo "→ code rendu à son état d'"'"'origine"' EXIT

# Le limiteur de connexion bloque au bout de cinq connexions par quart d'heure.
photo() {
  redis-cli FLUSHALL >/dev/null 2>&1 || true
  ATLAS_CAS="$1" ATLAS_REMETTRE_A_NEUF="${ATLAS_REMETTRE_A_NEUF:-0}" \
    npx tsx "$RACINE/scripts/capture-rang-du-rappel.mts" "$DOSSIER"
}

echo "── B · ce qui est codé aujourd'hui ──────────────────────────────"
ATLAS_REMETTRE_A_NEUF=1 photo "B-aujourd-hui"

echo "── G · la place garantie ────────────────────────────────────────"
python3 - "$CIBLE" <<'PY'
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
avant = """  const cartes = [
    ...rappels.map(rappelVersCarte),
    ...initiales.map(versCarte),
    ...caducs.map(caducVersCarte),
  ];"""
apres = """  const cartes = (() => {
    const lesRappels = rappels.map(rappelVersCarte);
    const lesReponses = [...initiales.map(versCarte), ...caducs.map(caducVersCarte)];
    if (lesRappels.length === 0 || lesReponses.length === 0) {
      return [...lesRappels, ...lesReponses];
    }
    return [lesRappels[0], lesReponses[0], ...lesRappels.slice(1), ...lesReponses.slice(1)];
  })();"""
assert avant in s, "l'ordre attendu n'est plus dans Notifications.tsx"
open(p, "w", encoding="utf-8").write(s.replace(avant, apres, 1))
PY
sleep 4
photo "G-place-garantie"
