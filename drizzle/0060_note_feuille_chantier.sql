-- UN PENSE-BÊTE SUR LA FEUILLE DE CHANTIER
--
-- Sa demande du 23 août 2026 : « entre "Copier l'adresse" et "Ouvrir le PDF",
-- j'aimerais avoir un petit encadré où l'utilisateur peut marquer quelque chose
-- — penser à prendre le broyeur, client plus disponible à partir de neuf
-- heures ».
--
-- Rien de tel n'existait, vérifié plutôt que supposé : `notes_vocales` porte la
-- dictée qui devient un devis, et le `note` du schéma appartient aux paiements.
-- Ce sont deux autres objets ; les réemployer aurait fait porter à la dictée un
-- texte qui n'a pas vocation à être lu par l'IA.
--
-- CE QUI SE JOUE DANS LE CHOIX DE LA COLONNE, et il est à lui : le 23 août, il
-- a tranché que cette note NE PART PAS sur le PDF sans les prix — celui que ses
-- gars emportent. Elle reste dans l'application. Sur le PDF, elle serait
-- devenue un document qui sort de l'entreprise et se relit sur un chantier :
-- « client pas disponible avant neuf heures » se serait alors écrit en sachant
-- que le client peut le lire.
--
-- Elle vit donc sur `chantiers`, comme le reste de ce qui décrit UN chantier,
-- et non sur les documents qui en sortent.
ALTER TABLE chantiers
  ADD COLUMN IF NOT EXISTS note_feuille text;

COMMENT ON COLUMN chantiers.note_feuille IS
  'Le pense-bête du patron sur la feuille de chantier — « prendre le broyeur ». Ne figure sur AUCUN document qui sort de l''entreprise : ni devis, ni facture, ni PDF sans les prix (son choix du 23 août 2026).';
