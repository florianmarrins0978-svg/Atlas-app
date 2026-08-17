-- Le « non » se retient aussi.
--
-- **Sa demande du 17 août 2026**, après avoir vu le catalogue s'écrire :
-- *« le document s'autoalimente à chaque fois qu'on rajoute un nouveau mot dans
-- un devis et qu'il comprend ce que c'est ? »*. La réponse était non ; il a
-- répondu « fais-le ».
--
-- **Atlas PROPOSE, il n'écrit pas.** Une dictée qui contient un mot inconnu, et
-- dont on sait à quoi il se rapporte, fait apparaître une proposition sur
-- l'écran du catalogue. Il répond oui ou non.
--
-- **Ce que cette colonne existe pour éviter : reproposer indéfiniment un mot
-- qu'il a refusé.** Sans elle, le « non » ne durerait que jusqu'au prochain
-- affichage — et une proposition qui revient après un refus n'est plus une
-- proposition, c'est un harcèlement. Le mot écarté reste donc en base, marqué :
-- il ne s'affiche pas, ne se cherche pas, et ne se propose plus jamais.
--
-- **Un mot écarté puis écrit à la main redevient un mot ordinaire** — c'est
-- `ajouterMot` qui le relève. Refuser une proposition n'est pas s'interdire le
-- mot pour toujours.
ALTER TABLE "mots_catalogue" ADD COLUMN "refuse" boolean NOT NULL DEFAULT false;

-- Les mots écartés ne se lisent qu'à la question « l'a-t-il déjà refusé ? ».
CREATE INDEX "mots_catalogue_refuse_idx" ON "mots_catalogue" ("entreprise_id", "refuse");
