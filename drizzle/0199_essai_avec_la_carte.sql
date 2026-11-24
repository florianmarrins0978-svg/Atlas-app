-- L'ESSAI AVEC LA CARTE (le modèle A) — sa validation du 23 novembre 2026, et
-- ses décisions du 24 (planche `appli/soignee/essai-avec-carte.html`) : après
-- les conditions, l'artisan pose sa carte chez le prestataire, avec quinze
-- jours d'essai et rien de débité avant ; sans carte, l'appli reste fermée.
--
-- EXPAND SEUL : trois colonnes, aucune ligne réécrite ; l'ancien code les
-- ignore. `abonnements` est sous FORCE RLS, mais rien ici n'écrit de ligne.
--
-- `carte_requise` : vrai pour un compte créé quand le paiement est branché,
-- tant que sa carte n'est pas posée. **Faux par défaut, et c'est le point** :
-- aucun compte existant ne se voit fermer l'appli pour une carte qu'on ne lui
-- avait jamais demandée ; et un espace sans clé de paiement garde l'essai
-- d'avant (`creerSonCompte`).
ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS carte_requise boolean NOT NULL DEFAULT false;

-- `essai_jusqu_au` : la fin de l'essai que tient le prestataire (son
-- `trial_end`), pour un abonnement qui y est encore. Le statut reste « actif »
-- (l'appli s'ouvre, la résiliation passe par le prestataire) ; c'est cette
-- date qui fait dire au ruban « Essai jusqu'au… ». Vide hors essai.
ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS essai_jusqu_au timestamptz;

-- `session_de_carte` : la session de paiement ouverte pour poser la carte. **Le
-- crochet ne crée jamais un abonnement qu'il ne connaît pas** (migration 0084) :
-- s'il paie puis ferme l'onglet avant le retour, rien ne dirait à l'appli que
-- la carte est posée, et un second appui ouvrirait un second abonnement. La
-- session retenue se relit donc à chaque ouverture de « Il manque votre
-- carte », et avant d'en ouvrir une autre (`src/app/essai`).
ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS session_de_carte text;
