-- NOTER QU'ON A PRÉVENU LE CLIENT, SANS RIEN CHANGER À LA FACTURE
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **LE MUR QU'ON VIENT DE RENCONTRER, ET IL AVAIT RAISON.**
--
-- `trg_facture_immuable` (migration 0018) refuse TOUTE écriture sur une facture
-- émise. C'est ce qui garantit que le relevé de TVA — qui n'est pas une table,
-- mais un calcul sur les factures émises — ne peut pas diverger de ce qui a été
-- facturé. La colonne `iban_signale` (migration 0078) s'est heurtée à lui, et
-- c'est exactement ce qu'on attend d'une protection.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QU'ON OUVRE, ET POURQUOI ÇA NE ROUVRE RIEN D'AUTRE.**
--
-- `iban_signale` ne dit rien de la facture : ni montant, ni date, ni identité,
-- ni ligne. Elle dit ce que l'ARTISAN a fait — avoir prévenu son client d'un
-- changement de compte. Aucun calcul ne la lit, le relevé de TVA l'ignore, et le
-- PDF archivé ne la connaît pas.
--
-- **La comparaison se fait en JSON, et c'est le point.** Écrire « toutes les
-- autres colonnes doivent être égales » à la main, c'est une liste — et une
-- liste vieillit : la colonne ajoutée demain n'y serait pas, donc silencieusement
-- modifiable sur une facture émise. Ici, on retire la seule colonne pardonnée
-- des deux images de la ligne et on exige que le reste soit identique. **Toute
-- colonne future est protégée sans que personne ait à y penser** — et c'est
-- précisément ce genre d'oubli qui coûte un relevé de TVA faux.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QUI A ÉTÉ ÉCARTÉ : une table à part**, sur le modèle de
-- `paiements_facture` — qui existe justement pour que noter un règlement ne
-- touche pas la facture. Elle aurait évité de rouvrir le trigger, au prix d'une
-- table, d'une politique d'isolation, de droits, et d'une jointure sur la
-- lecture qui sert déjà les deux écrans. Pour un seul texte que rien ne calcule,
-- la dépense n'était pas juste — et le garde-fou ci-dessous rend l'ouverture
-- plus étroite que la table ne l'aurait été.
--
-- La suppression, elle, ne bouge pas : une facture émise ne se supprime pas.

CREATE OR REPLACE FUNCTION empecher_modification_facture_emise() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.statut = 'emise' THEN
      RAISE EXCEPTION 'Une facture émise ne peut pas être supprimée (id=%)', OLD.id;
    END IF;
    RETURN OLD;
  ELSE
    IF OLD.statut = 'emise' THEN
      -- Tout, SAUF ce qu'on a dit au client à propos du compte à créditer.
      IF (to_jsonb(NEW) - 'iban_signale') IS DISTINCT FROM (to_jsonb(OLD) - 'iban_signale') THEN
        RAISE EXCEPTION 'Une facture émise est immuable (id=%)', OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;
