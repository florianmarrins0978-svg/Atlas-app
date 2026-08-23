-- LA NOTE DU CHANTIER — ce qu'il ne faut pas oublier en partant
--
-- Sa demande du 23 août 2026 : « entre "Copier l'adresse" et "Ouvrir le PDF",
-- j'aimerais avoir un petit encadré où l'utilisateur peut marquer quelque
-- chose — penser à prendre le broyeur, client plus disponible à partir de neuf
-- heures ».
--
-- **Elle ne va PAS sur le PDF sans les prix, et c'est sa décision** : « elle
-- peut rester là, car les salariés auront accès au planning ; justement, c'est
-- pour cela que je voulais le devis sans les prix ». Le PDF est le devis
-- expurgé ; la note, elle, vit sur la feuille de chantier, que ses gars
-- ouvrent depuis le planning.
--
-- Bornée à 2 000 caractères : c'est un pense-bête, pas un cahier de chantier.
-- Sans borne, un copier-coller malheureux ferait grossir chaque lecture du
-- planning — la note descend avec la liste entière.
ALTER TABLE chantiers
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE chantiers
  DROP CONSTRAINT IF EXISTS chantiers_note_bornee;
ALTER TABLE chantiers
  ADD CONSTRAINT chantiers_note_bornee CHECK (note IS NULL OR length(note) <= 2000);

COMMENT ON COLUMN chantiers.note IS
  'Le pense-bête du patron pour ce chantier — lu par ses équipes sur la feuille, jamais imprimé sur le devis ni le PDF sans les prix.';
