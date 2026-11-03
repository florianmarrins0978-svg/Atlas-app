-- LES CLÉS COMPOSITES DE 0149 EFFACENT COMME LE LIEN QU'ELLES DOUBLENT
-- (panne du 1er novembre 2026 : « je peux pas supprimer tous les clients »).
--
-- **Ce que 0149 croyait, et qui était faux.** Son en-tête dit de la clé
-- composite : « La seconde n'agit qu'à l'écriture. » Une clé étrangère agit
-- AUSSI quand on efface la ligne visée. Posée sans ON DELETE, elle est en
-- NO ACTION : elle refuse l'effacement d'un chantier tant qu'un créneau le
-- vise, pendant que l'ancien lien, en CASCADE, s'apprête à effacer ce créneau.
--
-- **Qui gagne dépend d'un numéro interne.** PostgreSQL tire les deux
-- déclencheurs dans l'ordre ALPHABÉTIQUE de leur nom, qui porte un numéro
-- d'objet : « RI_ConstraintTrigger_a_100231 » passe avant
-- « RI_ConstraintTrigger_a_18235 ». Sur une base neuve (les essais, la CI), la
-- cascade passe la première et tout est vert. Sur une base qui a vécu des
-- mois, la clé composite peut passer la première, et l'effacement tombe :
-- « violates foreign key constraint creneaux_chantier_chantier_id_meme_entreprise ».
-- C'est ce qu'il a vu, six fois, sur la suppression de ses clients.
--
-- **La correction tient sur toutes les bases, quel que soit l'ordre** : la clé
-- composite reçoit la même règle d'effacement que le lien qu'elle double.
-- Deux cascades ou deux mises à vide, l'ordre ne change plus rien. Les mises à
-- vide ne visent que la colonne du lien : vider aussi `entreprise_id`, qui
-- n'est jamais vide, ferait tomber l'effacement autrement.
--
-- **Ce qui ne bouge pas.** L'ancien lien reste : tant que la clé composite
-- n'est pas validée sur les lignes anciennes (TODO.md), c'est lui qui garantit
-- qu'aucune ligne ancienne ne reste orpheline. Toujours NOT VALID, donc aucune
-- ligne relue ni écrite : rien à voir sous FORCE RLS, rien qui dépende de ce
-- que contient sa base. `scripts/test-liens-dans-l-entreprise-db.ts` refuse
-- désormais toute clé composite qui n'efface pas comme son lien.

DO $$
DECLARE
  l record;
BEGIN
  FOR l IN
    SELECT * FROM (VALUES
      ('membres_entreprise',          'membres_entreprise_equipe_id_meme_entreprise',          'equipe_id',     'equipes',              'SET NULL (equipe_id)'),
      ('membres_entreprise',          'membres_entreprise_salarie_id_meme_entreprise',         'salarie_id',    'equipes',              'SET NULL (salarie_id)'),
      ('fragments_documents',         'fragments_documents_document_id_meme_entreprise',       'document_id',   'documents',            'CASCADE'),
      ('audios_a_purger',             'audios_a_purger_note_id_meme_entreprise',               'note_id',       'notes_vocales',        'CASCADE'),
      ('absences_equipe',             'absences_equipe_equipe_id_meme_entreprise',             'equipe_id',     'equipes',              'CASCADE'),
      ('paiements_facture',           'paiements_facture_facture_id_meme_entreprise',          'facture_id',    'factures',             'CASCADE'),
      ('mots_catalogue',              'mots_catalogue_parent_id_meme_entreprise',              'parent_id',     'mots_catalogue',       'CASCADE'),
      ('passages_entretien',          'passages_entretien_client_id_meme_entreprise',          'client_id',     'clients',              'SET NULL (client_id)'),
      ('lignes_passage',              'lignes_passage_passage_id_meme_entreprise',             'passage_id',    'passages_entretien',   'CASCADE'),
      ('photos_diagnostic',           'photos_diagnostic_diagnostic_id_meme_entreprise',       'diagnostic_id', 'diagnostics',          'CASCADE'),
      ('hypotheses_diagnostic',       'hypotheses_diagnostic_diagnostic_id_meme_entreprise',   'diagnostic_id', 'diagnostics',          'CASCADE'),
      ('photos_diagnostic_a_purger',  'photos_diagnostic_a_purger_photo_id_meme_entreprise',   'photo_id',      'photos_diagnostic',    'CASCADE'),
      ('equipes_du_chantier',         'equipes_du_chantier_equipe_id_meme_entreprise',         'equipe_id',     'equipes',              'CASCADE'),
      ('rappels_vus',                 'rappels_vus_chantier_id_meme_entreprise',               'chantier_id',   'chantiers',            'CASCADE'),
      ('retours_intervention',        'retours_intervention_chantier_id_meme_entreprise',      'chantier_id',   'chantiers',            'CASCADE'),
      ('retours_intervention_taches', 'retours_intervention_taches_retour_id_meme_entreprise', 'retour_id',     'retours_intervention', 'CASCADE'),
      ('retours_intervention_photos', 'retours_intervention_photos_photo_id_meme_entreprise',  'photo_id',      'photos',               'CASCADE'),
      ('retours_intervention_photos', 'retours_intervention_photos_retour_id_meme_entreprise', 'retour_id',     'retours_intervention', 'CASCADE'),
      ('retours_intervention_vus',    'retours_intervention_vus_retour_id_meme_entreprise',    'retour_id',     'retours_intervention', 'CASCADE'),
      ('creneaux_chantier',           'creneaux_chantier_chantier_id_meme_entreprise',         'chantier_id',   'chantiers',            'CASCADE'),
      ('acomptes_devis',              'acomptes_devis_devis_id_meme_entreprise',               'devis_id',      'devis',                'CASCADE'),
      ('fiches_securite',             'fiches_securite_chantier_id_meme_entreprise',           'chantier_id',   'chantiers',            'CASCADE'),
      ('fiches_securite_photos',      'fiches_securite_photos_fiche_id_meme_entreprise',       'fiche_id',      'fiches_securite',      'CASCADE'),
      ('fiches_securite_photos',      'fiches_securite_photos_photo_id_meme_entreprise',       'photo_id',      'photos',               'CASCADE'),
      ('acceptations_defaites',       'acceptations_defaites_envoi_id_meme_entreprise',        'envoi_id',      'envois_devis',         'CASCADE'),
      ('virements_recus',             'virements_recus_paiement_id_meme_entreprise',           'paiement_id',   'paiements_facture',    'SET NULL (paiement_id)')
    ) AS v(enfant, nom, colonne, parent, effacement)
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', l.enfant, l.nom);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I, entreprise_id) REFERENCES %I (id, entreprise_id) ON DELETE %s NOT VALID',
      l.enfant, l.nom, l.colonne, l.parent, l.effacement
    );
  END LOOP;
END $$;
