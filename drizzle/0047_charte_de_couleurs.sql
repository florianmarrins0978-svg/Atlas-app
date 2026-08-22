-- La charte de couleurs choisie par la personne.
--
-- Choisie par le patron le 14 août 2026, planche en main
-- (`docs/maquettes/11-ecran-retenu-seize-couleurs.html`, seize propositions) :
-- « garde seulement pour l'instant nuit, beurre, moka, pierre, sylve » plus la
-- rose-violet — Prune —, puis « oui garde Origine en défaut, fais les sept ».
--
-- SUR `users`, ET PAS SUR `entreprises`. La rubrique « Apparence » appartient à
-- l'ensemble « Moi » du sommaire des réglages : c'est le goût de la personne,
-- pas une décision d'entreprise. Un salarié qui préfère le sombre n'a pas à
-- l'imposer à son patron, ni à le lui demander.
--
-- NULLE VEUT DIRE « ORIGINE », et c'est ce qui rend cette migration sans effet
-- visible : tant que personne n'a choisi, l'application affiche exactement les
-- couleurs qu'elle affichait la veille. Poser « origine » en défaut aurait dit
-- la même chose en moins clair — on n'aurait plus distingué « jamais choisi »
-- de « a choisi origine », et une future charte par défaut aurait écrasé le
-- choix délibéré des uns comme le silence des autres.
--
-- AUCUNE CONTRAINTE SUR LES VALEURS, délibérément. La liste des chartes vit
-- dans `src/lib/chartes.ts` et bougera ; un nom inconnu retombe sur l'origine
-- (`charte()`), ce qui est le bon comportement. Une contrainte en base
-- refuserait au contraire l'écriture, et l'artisan verrait une panne pour un
-- nom retiré de la liste entre-temps.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS charte text;

COMMENT ON COLUMN users.charte IS
  'La charte de couleurs choisie (src/lib/chartes.ts). NULL = origine, celle du départ.';
