-- Ce que deux documents de plus corrigent dans le vocabulaire écrit la veille.
--
-- **Le patron, le 9 août 2026**, a transmis une facture et un devis de plus du
-- même confrère. Ils n'ajoutent pas seulement du vocabulaire : ils **démentent
-- une définition posée quelques heures plus tôt**, et c'est la partie qui
-- compte.
--
-- =========================================================================
-- 1. Une définition trop étroite, corrigée par un document réel
-- =========================================================================
--
-- La migration 0030 affirmait : *« Le gros bois se débite en 40 ou 50 cm. »*
-- Le devis du frêne dit **33 cm**.
--
-- Ce n'est pas une exception : c'est la preuve qu'il n'y a pas de valeur par
-- défaut, et que l'énumération était une invention déguisée en observation.
-- Deux devis avaient montré 40 et 50 ; j'en ai conclu une liste fermée. C'est
-- exactement ce que `docs/AGENT.md` §3 interdit — un champ sans source fiable
-- reste ouvert, il ne se remplit pas par extrapolation.
--
-- La consigne, elle, était déjà juste : « reprendre la longueur dictée telle
-- quelle, ne jamais l'arrondir ni la supposer ». C'est la définition qui la
-- contredisait, et un modèle qui lit les deux croit à la liste.

UPDATE "termes_metier" SET
  "definition" = 'Le gros bois se débite à la longueur qui convient au client — 33, 40, 50 cm. Il n''y a pas de valeur par défaut.',
  "consigne"   = 'Reprendre la longueur dictée telle quelle. Ne jamais l''arrondir, ni la supposer, ni la choisir dans une liste.'
WHERE "intitule" = 'La longueur de débit se dit en centimètres';

-- =========================================================================
-- 2. Le devenir du bois dit aussi OÙ il est rangé
-- =========================================================================
--
-- 0030 s'arrêtait à « débité, broyé, ou évacué ». Le devis du frêne va plus
-- loin, et c'est ce que le client veut savoir :
--
--   « Les branches sont évacuées par broyage. Le gros bois est ramené sur
--     l'arrière du jardin. Gros bois débité en 33 cm et fendu en tas rangé le
--     long de la haie. »
--
-- L'endroit où le bois finit fait partie de la prestation : « ramené sur
-- l'arrière du jardin » est du portage, et il se paie.

UPDATE "termes_metier" SET
  "definition" = 'Aucune ligne d''abattage ne finit sans dire où va la matière : débitée, broyée, évacuée — et à quel endroit elle est rangée.',
  "consigne"   = 'Reprendre la destination quand elle est dictée : « ramené sur l''arrière du jardin », « en tas rangé le long de la haie ». Le portage se paie. Si la dictée le tait, le signaler comme manquant.'
WHERE "intitule" = 'Dire toujours ce que devient le bois';

-- =========================================================================
-- 3. Le débroussaillage a deux machines, et elles ne font pas le même travail
-- =========================================================================
--
-- La facture de débroussaillage les distingue explicitement :
--
--   « Toutes les parties accessibles débroussaillage au broyeur forestier.
--     Rendu herbe hachée finement.
--     Talus débroussaillé à la débroussailleuse + contours maison + contours
--     arbres. »
--
-- Le broyeur forestier passe où l'on peut rouler ; la débroussailleuse fait ce
-- qu'il ne peut pas atteindre — talus, pieds de mur, pieds d'arbres. C'est
-- l'accessibilité du terrain qui décide, et donc le temps passé.

UPDATE "termes_metier" SET
  "definition" = 'Nettoyer une zone envahie de ronces et de rejets. Deux machines : le broyeur forestier sur les parties accessibles, la débroussailleuse sur les talus et les contours.',
  "consigne"   = 'Ligne à part, titrée par la zone. Dire la machine employée et le rendu attendu — « rendu herbe hachée finement ». Ce qui n''est pas accessible au broyeur coûte plus cher.'
WHERE "intitule" = 'Débroussaillage';

-- =========================================================================
-- 4. Une règle de plus : ce qui reste à décider s'écrit
-- =========================================================================
--
-- Le devis du frêne porte cette ligne, en clair, au milieu du descriptif :
--
--   « Hauteur du tronc à définir ensemble au moment de l'abattage »
--
-- C'est la règle du dépôt, écrite par un professionnel sur un document qui part
-- chez un client : un point qu'on ne peut pas trancher depuis le bureau ne
-- s'invente pas, il **s'annonce**. Atlas savait laisser un champ vide et le
-- signaler au patron (`docs/AGENT.md` §3) ; il ne savait pas que cette réserve
-- a sa place sur le devis lui-même, et sa formulation.

INSERT INTO "termes_metier" ("nature", "intitule", "definition", "consigne", "ordre") VALUES
(
  'regle',
  'Ce qui reste à décider s''écrit sur le devis',
  'Un point qui se tranchera sur place se met noir sur blanc : « Hauteur du tronc à définir ensemble au moment de l''abattage ».',
  'Ne jamais choisir à la place du patron ni du client. Écrire la phrase d''attente dans le descriptif, plutôt que d''inventer une valeur ou de la taire.',
  7
);
