-- LE TEMPS PASSÉ, MONTRÉ OU NON SUR LE COMPTE RENDU DU CLIENT
--
-- Sa demande du 22 août 2026, capture de la fiche d'entretien à l'appui :
-- « il faudrait mettre un petit bouton on/off pour si l'utilisateur ne veut pas
-- que le temps apparaisse sur la fiche, pouvoir l'effacer — on, le temps
-- apparaîtrait sur la fiche ; off, il n'apparaîtrait pas. » Dessiné en planche
-- 92 (`appli/temps-sur-la-fiche.html`), puis codé le 23 août.
--
-- **« Effacer » ne veut pas dire OUBLIER, et c'est tout l'objet de cette
-- colonne.** La durée reste sur le passage — elle est à lui, elle dit ce qu'a
-- coûté un chantier —, seul le compte rendu l'ignore. Réutiliser `minutes IS
-- NULL` pour masquer aurait confondu deux choses différentes : « je n'ai pas
-- chronométré » et « je ne veux pas le lui dire ». Le patron aurait perdu son
-- chiffre en masquant, et l'aurait ressaisi au passage suivant.
--
-- **Le défaut est `true` : c'est ce que l'application faisait déjà.** Tous les
-- rapports partis avant aujourd'hui montraient le temps ; les repeindre en
-- masqués changerait rétroactivement ce que des clients ont déjà lu, alors que
-- l'empreinte de leur rapport, elle, ne bouge pas. Un rapport figé doit rester
-- ce qu'il était (l'invariant du 16 août).
ALTER TABLE passages_entretien
  ADD COLUMN IF NOT EXISTS temps_visible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN passages_entretien.temps_visible IS
  'Le temps passé paraît-il sur le compte rendu du client ? Faux ne l''efface pas : la durée reste en base pour le patron, et c''est la lecture publique qui la tait.';
