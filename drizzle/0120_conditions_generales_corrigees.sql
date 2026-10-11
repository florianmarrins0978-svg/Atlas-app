-- LES CONDITIONS GÉNÉRALES D'ORIGINE, CORRIGÉES — check-up légal du
-- 4 octobre 2026 (`docs/check-up-legal-documents.md`, points 3 à 8).
--
-- Le texte d'origine vit dans le code (`src/lib/conditions-generales.ts`) et
-- `NULL` en base veut dire « celui d'Atlas ». Mais l'écran des réglages en
-- rangeait une COPIE dès qu'on rallumait la case ou qu'on quittait le champ :
-- ces entreprises auraient gardé l'ancien texte, et ses quatre clauses
-- contraires au droit du particulier (acompte avant sept jours hors
-- établissement, « aucune réclamation ultérieure », délai indicatif sans
-- annulation, 40 € réclamés à tous).
--
-- **Seule une copie EXACTE de l'ancien texte revient à NULL.** Un texte qu'il
-- a retouché, même d'une virgule, est le sien : il ne se réécrit pas sans lui.
-- Les devis déjà envoyés ne bougent pas : ils ont figé leur propre copie
-- (`devis.conditions_generales`), et c'est ce qui a été accepté.
--
-- `entreprises` n'est pas sous RLS : le propriétaire voit toutes les lignes,
-- et le compte ci-dessous le prouve (`.claude/rules/migrations.md`).
DO $$
DECLARE
  touchees integer;
BEGIN
  UPDATE "entreprises"
  SET "conditions_generales" = NULL
  WHERE "conditions_generales" = 'L’acceptation de nos devis implique l’adhésion aux conditions générales de vente et de règlement ci-après, qui prévalent sur toute autre condition, sauf dérogation écrite et expresse de notre part.

1. Commande. Le devis, retourné daté et signé avec la mention « bon pour accord », vaut commande ferme des travaux qu’il décrit. Toute prestation non prévue fait l’objet d’un devis complémentaire accepté avant exécution.

2. Prix et validité. Les prix sont établis selon les conditions économiques connues à la date du devis. Ils sont fermes pendant la durée de validité indiquée en tête ; au-delà, ils sont révisables.

3. Règlement. Acompte à la commande selon le pourcentage indiqué, solde à réception de la facture. Aucun escompte n’est accordé pour paiement anticipé. Tout retard entraîne de plein droit des pénalités au taux de trois fois le taux d’intérêt légal et une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du code de commerce).

4. Délai d’exécution. Le délai indiqué sur le devis est donné à titre indicatif ; il est prolongé de plein droit en cas d’intempéries, de sol impraticable ou de cause indépendante de l’entreprise, sans que ce report puisse justifier l’annulation de la commande.

5. Chantier. Le client assure l’accès au chantier, signale les réseaux enterrés et fait exécuter, sauf mention contraire au devis, les travaux relevant d’autres corps de métier. Les pertes de temps dues à des causes qui ne nous sont pas imputables font l’objet d’un supplément sur devis.

6. Réception. La réception des travaux est faite par le client, ou son représentant, à la fin du chantier et en présence de l’entreprise. Les réserves sont formulées par écrit à ce moment ; aucune réclamation sur l’aspect des travaux n’est admise ultérieurement.

7. Végétaux. Les végétaux fournis sont garantis à la plantation. Leur reprise dépend de l’arrosage et de l’entretien assurés par le client après réception. La garantie légale des vices cachés (art. 1641 et suivants du code civil) s’applique aux fournitures.

8. Réserve de propriété. Les fournitures et végétaux restent la propriété de l’entreprise jusqu’au paiement intégral, en principal et intérêts. Nonobstant les articles 551 et 552 du code civil, l’entreprise demeure propriétaire de l’ouvrage exécuté jusqu’à complet paiement.

9. Assurances. L’entreprise est titulaire d’une assurance responsabilité civile professionnelle et, pour les travaux qui y sont soumis, d’une assurance décennale : [assureur, n° de contrat, couverture géographique].

10. Rétractation. Pour un devis signé hors de l’établissement de l’entreprise, le client particulier dispose d’un délai de rétractation de 14 jours (art. L221-18 du code de la consommation). Les travaux commencés avant ce terme le sont à sa demande écrite.

11. Médiation et litiges. En cas de litige, le client particulier peut saisir gratuitement le médiateur de la consommation : [nom et coordonnées]. À défaut d’accord, les tribunaux compétents sont ceux désignés par le code de procédure civile.';
  GET DIAGNOSTICS touchees = ROW_COUNT;
  RAISE NOTICE 'Conditions générales rendues au texte d''origine : % entreprise(s)', touchees;
END $$;
