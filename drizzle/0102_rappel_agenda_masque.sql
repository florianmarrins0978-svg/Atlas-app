-- LA PHRASE « VOUS POUVEZ RELIER VOTRE AGENDA » SE MASQUE, POUR TOUJOURS.
--
-- Sa remarque du 26 septembre 2026, devant son Planning : *« ceux qui vont
-- jamais remplir leur agenda, ils vont voir la phrase tous les jours, c'est
-- chiant »*. Puis son choix, planche `appli/mon-agenda-simple.html` (C) : une
-- touche « Masquer », et *« une fois qu'on a choisi masquer, faut pas qu'il
-- reste de phrase »*.
--
-- **SUR L'ENTREPRISE, PAS DANS LE NAVIGATEUR.** Rangé dans le téléphone, le
-- choix se perdrait sur l'iPad, au premier effacement de l'historique, et la
-- phrase reviendrait sans qu'il comprenne pourquoi. Sur l'entreprise, et pas
-- sur la personne : relier l'agenda est un réglage du patron, et seul le patron
-- voit cette phrase.
--
-- **Une colonne qu'on AJOUTE, rien d'autre.** `NOT NULL DEFAULT false` : chaque
-- entreprise existante reçoit « pas masqué », ce qui est exactement l'écran
-- d'aujourd'hui. Aucune ligne n'est réécrite (donc rien à prouver sous FORCE
-- RLS), et le code d'avant ignore la colonne : il peut tourner sur ce schéma.
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS rappel_agenda_masque boolean NOT NULL DEFAULT false;
