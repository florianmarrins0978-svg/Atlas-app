# Check-up devis et facture (7 octobre 2026)

Sa demande : *« Si on fait une modification sur un devis il faut que ça suive
sur les factures ! Fais un check-up complet. »* Lecture du code, aucune
batterie jouée. Les écrans n'ont pas été ouverts : ce qui suit est vrai du
code, **pas vérifié à l'écran ICI**.

## Corrigé dans ce lot

| | Ce qui se passait | Ce qui se passe maintenant |
|---|---|---|
| Acompte retiré du devis | Les notes du devis, puis celles de la facture, réclamaient encore « 30 % à la commande ». | La phrase part du devis et de la facture. Un devis déjà envoyé garde ce qu'il portait. |

Fondé sur `envoyerDevis` (`src/server/repositories/devis.ts`) et
`phrasesAcomptesDuDevis` (`src/lib/acomptes-devis.ts`). Éprouvé du geste au
papier de la facture : `scripts/test-acomptes-nouvelle-version.ts`.

**Ce qui a été dit et qui était faux.** Mon premier correctif ne tenait que
pour le brouillon : à l'envoi, la phrase revenait sur le devis comme sur la
facture. Trouvé en préparant la correction de la facture, corrigé avant toute
livraison.

## Les écarts trouvés, à corriger

Chacun a été relu dans le code (pas seulement rapporté).

| # | L'écart | Exemple | Gravité |
|---|---|---|---|
| 1 | **Une facture en retard sur le devis peut partir.** Le bandeau « Reprendre ce devis » prévient, rien ne bloque l'envoi (`emettreFacture`). | Facture née du devis v1 à 10 000 €, devis corrigé v2 à 8 000 €. « Envoyer la facture » : elle part à 10 000 €, et ne se corrige plus que par un avoir. | argent, légal |
| 2 | **L'échéance de la facture vient des Réglages, pas du devis.** | Devis accepté « paiement comptant », Réglages à 30 jours : la facture dit 30 jours. | légal, argent |
| 3 | **Le règlement proposé d'office se calcule sur le total de la facture.** | Devis 10 000 € avec 30 % payés (3 000 €), plus 1 000 € de travaux en plus : « + Règlement » propose 3 300 € nommé « Acompte 30 % ». | argent |
| 4 | **« Corriger le devis » perd des choses dans la nouvelle version** : la remise, le taux de TVA (retour à 20 %), le titre, la main d'œuvre, les notes. La facture reprise les perd aussi. | Remise de 10 % sur la v1 : la v2 et sa facture sont à plein tarif. | argent |
| 5 | **La remise de la facture s'applique aussi aux lignes du devis, et se modifie** depuis l'écran des travaux supplémentaires. | Passer la remise à 0 sur la facture refacture le devis plein tarif. | argent, à trancher avec lui |
| 6 | **« Main d'œuvre TTC pour information » n'existe que sur la facture**, calculée au taux du document. | Main d'œuvre à 10 %, document à 20 % : le TTC annoncé est faux, et c'est lui que le client reprend pour son crédit d'impôt. | argent |
| 7 | **Le n° de TVA de l'entreprise n'est pas imprimé sur le devis**, il l'est sur la facture. | Même client pro, un numéro d'un côté, rien de l'autre. | à vérifier en droit |
| 8 | **La facture cite le devis sans sa version.** | Factures de la v1 et de la v2 : même référence. | traçabilité |
| 9 | **Les coordonnées de paiement ne s'écrivent pas pareil** (IBAN brut sur le devis, groupé avec l'ordre du chèque sur la facture). | | forme |

## Vérifié cohérent

Lignes, quantités, unités, prix, TVA par ligne et regroupement par taux ; la
sous-traitance sans TVA et sa mention ; les pénalités et les 40 € réservés aux
professionnels ; les moyens de paiement, le texte de pied et les notes ; le
client et le lieu des travaux ; une facture envoyée qui ne bouge plus.

## Ce qui reste ouvert, et qui peut le trancher

| | Qui |
|---|---|
| Les points 1 à 4 et 6 : corrections du code, sans choix à faire | l'assistant, avec son accord |
| Le point 5 : la remise d'une facture peut-elle toucher les lignes du devis ? | lui |
| Le point 7 : obligation légale du n° de TVA sur un devis | son comptable |
| La batterie entière, avant que rien parte sur `main` | à lancer avec son accord |
