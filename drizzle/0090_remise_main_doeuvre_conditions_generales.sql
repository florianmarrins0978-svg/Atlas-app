-- LA PLANCHE DU 12 SEPTEMBRE 2026, LA B — codée le 13
-- (appli/devis-remise-main-d-oeuvre-conditions.html).
--
-- Trois demandes ; deux touchent la base. La troisième — « Prix accordé au
-- client » devient « Remise de N % » — n'est qu'un mot, et il vit dans
-- src/lib/reduction-devis.ts.
--
-- ════════════════════════════════════════════════════════════════════════════
-- « DONT MAIN D'ŒUVRE HT » — sa lecture B. Elle est DÉJÀ dans les lignes : le
-- papier la nomme sous le total HT, rien ne bouge aux totaux. NULL = pas de
-- ligne. Facultative, retirable, bornée au total HT (src/lib/main-doeuvre-devis.ts).
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "main_doeuvre_ht" numeric(12, 2);

-- ════════════════════════════════════════════════════════════════════════════
-- LES CONDITIONS GÉNÉRALES DE VENTE ET DE RÈGLEMENT — « une case remplie d'un
-- texte par défaut qu'il peut effacer et réécrire, imprimée après le bon pour
-- accord ».
--
-- **L'encodage est INVERSÉ par rapport au texte de pied (0064)**, et c'est sa
-- demande : la case arrive REMPLIE.
--
--   NULL   = jamais réglé → le texte d'origine d'Atlas (src/lib/conditions-generales.ts)
--   ''     = il a tout effacé → rien ne s'imprime, pas même le titre
--   texte  = le sien
--
-- Aucune ligne n'est réécrite : NULL suffit à dire « le texte d'origine », et
-- c'est ce que toute entreprise existante lit dès aujourd'hui.
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "conditions_generales" text;

-- Figées sur le devis à sa création, comme les cinq conditions de la 0064 :
-- corriger un réglage ne réécrit pas ce qu'un client a déjà lu. NULL sur les
-- devis d'avant : ils lisent le texte d'origine — un brouillon régénéré le
-- porte, un devis envoyé reste le fichier figé à l'envoi.
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "conditions_generales" text;
