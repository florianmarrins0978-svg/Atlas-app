# LA VISITE GUIDÉE DU SITE, refaite de bout en bout (sa demande du 20 novembre 2026).
#
# Rejoue le parcours du patron dans la VRAIE appli, sur la base de démonstration,
# fige chaque écran (`fige.mjs`), puis assemble `appli/visite-guidee.html`.
# Toutes les données sont inventées : numéros de la tranche de fiction de
# l'ARCEP (06 39 98, 02 61 91), domaine réservé example.com (sa consigne).
#
# Avant de le lancer, et avec SON accord (il vide la base d'essai) :
#   source scripts/monter-base-locale.sh
#   DATABASE_URL=postgresql://postgres@localhost:5432/atlas_test npm run db:seed
#   une appli BÂTIE servie sur le port 3001 (`next build` puis `next start -p 3001`),
#   avec TRANSCRIPTION_PROVIDER=essai, LLM_PROVIDER=dev, AUTH_TRUST_HOST=true,
#   ATLAS_URL_PUBLIQUE=https://demo.cause.test, ATLAS_PROFIL=banc.
# Le navigateur ouvre l'appli sous « demo.cause.test » : sur « localhost », le
# devis refuse de partir (`adresse-du-client.ts`), et c'est juste.
set -e
ICI=$(cd "$(dirname "$0")" && pwd)
RACINE=$(cd "$ICI/../../.." && pwd)
export VISITE_TRAVAIL=${VISITE_TRAVAIL:-/tmp/visite-guidee}
export ATLAS_ADRESSE=http://localhost:3001
mkdir -p "$VISITE_TRAVAIL"
P="psql -qtA postgresql://postgres@localhost:5432/atlas_test"
# Une clé jetable pour que « Ma banque » se montre reliée ; jamais commitée (*.pem).
CLE="$RACINE/cles-banque/00000000-0000-4000-8000-000000000000.pem"
mkdir -p "$RACINE/cles-banque"; openssl genrsa -out "$CLE" 2048 2>/dev/null
trap 'rm -f "$CLE"; rmdir "$RACINE/cles-banque" 2>/dev/null || true' EXIT
python3 "$ICI/ticket.py" "$VISITE_TRAVAIL/ticket-carburant.jpg"
$P -f "$ICI/fictif.sql"
rm -f "$VISITE_TRAVAIL/etat.json"
cd "$ICI"
node s0.mjs; node histoire.mjs; node s1.mjs; node s1b.mjs; node s2.mjs; node s3.mjs; node s4.mjs
C=$(cat "$VISITE_TRAVAIL/chantier.txt")
$P -c "select jeton from envois_devis where chantier_id='$C' order by envoye_at desc limit 1" > "$VISITE_TRAVAIL/jeton-devis.txt"
node s5.mjs; node s6.mjs
bash passe.sh
node s7.mjs
$P -c "select jeton from envois_factures order by envoye_at desc limit 1" > "$VISITE_TRAVAIL/jeton-facture.txt"
NUM=$($P -c "select numero_commercial from factures where chantier_id='$C'")
psql -q postgresql://postgres@localhost:5432/atlas_test -v num="$NUM" -f banque.sql
node s8.mjs; node s9.mjs; node s10.mjs; node s11.mjs
# « Ma banque » se fige avant l'arrêt du dossier : après, son relevé repart de zéro.
$P -c "begin; delete from envois_comptable; delete from attestations_comptable; delete from verdicts_comptable; delete from retours_comptable; delete from bilans_comptables; delete from dossiers_comptables; commit;"
$P -c "update liaisons_bancaires set lu_le=now()"
node s12.mjs
node composer-visite.mjs "$RACINE/appli/visite-guidee.html"
node parcourir-visite.mjs "$RACINE/appli/visite-guidee.html" "$VISITE_TRAVAIL/parcours" 390
echo FINI
