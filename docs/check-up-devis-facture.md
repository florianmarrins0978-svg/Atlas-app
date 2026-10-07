# Check-up devis et facture (7 octobre 2026)

Sa règle : *« Si on fait une modification sur un devis il faut que ça suive
sur les factures ! »* Neuf écarts trouvés, **tous corrigés**. Aucune batterie
jouée, comme il l'a demandé. Les écrans n'ont pas été ouverts : ce qui suit
est éprouvé par les suites, **pas vérifié à l'écran ICI**.

## Ce qui est corrigé

| # | L'écart | Ce qui se passe maintenant | Fondé sur |
|---|---|---|---|
| 0 | Acompte retiré du devis, encore réclamé dans les notes du devis et de la facture | La phrase part des deux. Un devis déjà envoyé garde ce qu'il portait. | `envoyerDevis`, `phrasesAcomptesDuDevis` |
| 1 | Une facture partait sur une version du devis que le client n'avait plus | L'envoi est refusé : « Le devis a été corrigé (v2) : reprenez-le sur la facture avant de l'envoyer. » | `emettreFacture` |
| 2 | L'échéance venait des Réglages | Elle vient du délai du devis, et suit le devis repris. Les Réglages ne servent qu'à une facture sans devis. | `poserLaFactureBrouillon` |
| 3 | L'acompte proposé se comptait sur le total de la facture (3 300 € au lieu de 3 000 €) | Il se compte sur le total du devis. | `PromesseDuDevis` |
| 4 | « Corriger le devis » perdait la remise, le taux, le titre, la main d'œuvre, les notes | La version corrigée garde tout ce que la précédente portait. | `getOuCreerDevisBrouillon` |
| 5 | La remise s'étendait aux travaux en plus et se changeait sur la facture | **Sa « A »** : la remise reste sur les lignes du devis, se lit sur la facture et ne s'y change plus. Les travaux en plus gardent leur prix. | `recoitLaRemise` |
| 6 | Main d'œuvre TTC calculée au taux du document | Au taux de ses lignes quand il n'y en a qu'un ; sinon la ligne se tait. | `facture-pdf.ts` |
| 7 | Le n° de TVA de l'artisan absent du devis | Imprimé sur le devis, comme sur la facture. Migration 0123, sans réécrire aucun devis existant. | `snapshotEnTete` |
| 8 | La facture citait le devis sans sa version | « 2026-000014 v2 », comme le devis l'imprime. | `numeroDuDevisSurLePapier` |
| 9 | L'IBAN écrit brut sur le devis, groupé sur la facture | Groupé par quatre sur les deux. | `ibanEnGroupes` |

## Ce qui a été dit et qui était faux

- **Mon premier correctif de l'acompte ne tenait que sur le brouillon** : à
  l'envoi, la phrase revenait sur le devis et sur la facture. Corrigé avant
  livraison.
- **Le contrôle du papier exigeait le chiffre faux du point 6** : il imposait
  une main d'œuvre TTC sur une facture à deux taux. Le contrôle a été corrigé
  avec le calcul.

## Fait autrement que proposé

- **Point 5** : j'avais écrit « sauf si tu leur poses une remise à part ». Il
  n'y a pas de seconde remise : pour faire un prix sur des travaux en plus, on
  baisse le prix de leur ligne. Une seconde remise aurait demandé une colonne
  de plus en base pour un geste que la ligne fait déjà.
- **Point 9** : seul l'IBAN est aligné. L'ordre du chèque n'est pas ajouté au
  devis : le devis ne garde pas le titulaire du compte, et l'écrire au nom de
  l'entreprise aurait pu être faux.

## Chiffres

Suites jouées au vert dans ce lot : `test-facture-suit-le-devis` (9 cas, dont
chacun a été vu rouge sur l'ancien code), `test-acomptes-nouvelle-version`
(8), `test-reduction-devis`, `test-papier-devis-facture`, et les suites base
de la facture, de la remise, des travaux en plus, de la TVA, des avoirs, des
règlements et du devis. **La batterie entière n'a pas été jouée.**

## Ce qui reste ouvert

| | Qui tranche |
|---|---|
| Le rappel d'impayé compte depuis le délai des Réglages (sa règle du 16 août), pas depuis l'échéance imprimée | lui |
| La batterie entière, avant que rien parte sur `main` | à lancer avec son accord |
