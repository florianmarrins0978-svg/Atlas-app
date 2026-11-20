# Le chantier passe au 18 novembre : Terminés ne montre qu'un chantier dont la date est passée.
P="psql -qtA postgresql://postgres@localhost:5432/atlas_test"; C=$(cat ${VISITE_TRAVAIL:-/tmp/visite-guidee}/chantier.txt)
$P -c "update chantiers set date_planifiee='2026-11-18' where id='$C'"
$P -c "update creneaux_chantier set jour='2026-11-18' where chantier_id='$C'"
$P -c "update envois_devis set date_retenue='2026-11-18', jours_retenus='[\"2026-11-18\"]' where chantier_id='$C'"
