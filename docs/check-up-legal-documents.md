# Check-up légal : devis et facture, particulier et sous-traitance

*4 octobre 2026, à sa demande : « vérifier s'il y a toutes les informations
légales et obligatoires sur le devis, sur la facture normale, ensuite sur le
devis lorsque l'on passe par une entreprise et pareil pour la facture. Je veux
un check-up complet. Que toutes tes informations soient sourcées et je veux
aucune erreur. »*

## En cinq lignes

1. **La facture en sous-traitance est complète.** Rien n'y manque d'après les
   textes trouvés.
2. **Le devis en sous-traitance est complet.** Seule l'assurance (point 1
   ci-dessous) le concerne aussi.
3. **Trois manques valent pour les quatre documents ou pour le particulier** :
   l'adresse de l'assureur, l'attestation décennale jointe, le téléphone et
   le courriel qui ne bloquent rien.
4. **Les conditions générales d'origine portent trois phrases contraires au
   droit du particulier** : l'acompte à la commande, « aucune réclamation
   ultérieure », le délai « indicatif ». Et la facture du particulier lui
   réclame une indemnité de 40 € qu'il ne doit pas.
5. **Rien n'est corrigé** : c'est un relevé. Les corrections attendent son
   choix, et deux points relèvent du comptable.

## Comment ça a été vérifié, et la limite

| | |
|---|---|
| **Les documents** | les quatre PDF ont été produits par le vrai code d'Atlas, depuis une base locale, avec une entreprise en règle : devis et facture pour « Mr. Bernard », devis et facture en sous-traitance pour « Paysages Lebrun » (Entreprise, SIRET, n° TVA). Chaque ligne imprimée a été lue |
| **Les textes** | Code de la consommation, Code de commerce, Code général des impôts, Code des assurances, Code civil, loi 96-603, loi 75-1334, arrêtés de 1983, 1987, 2016 et 2017, BOFiP |
| **La limite** | Légifrance, le BOFiP et service-public sont **bloqués depuis cet environnement**. Les textes ont été lus par les extraits que donne un moteur de recherche, avec l'adresse officielle de chaque article. Ce qui n'a pas été vu dans une source est marqué « à confirmer ». **Une relecture par son comptable reste nécessaire** |

## Ce qui est JUSTE, document par document

| Mention | Devis particulier | Facture particulier | Devis sous-traitance | Facture sous-traitance | Texte |
|---|---|---|---|---|---|
| Nom suivi de « EI » | oui | oui | oui | oui | C. com. R526-27 |
| Adresse, SIRET | oui | oui | oui | oui | C. com. R123-237 ; CGI ann. II 242 nonies A |
| N° de TVA de l'artisan | non exigé | oui | non exigé | oui | CGI ann. II 242 nonies A |
| Date, numéro unique | oui | oui | oui | oui | CGI ann. II 242 nonies A |
| Nom et adresse du client | oui | oui | oui | oui | 242 nonies A ; arrêté du 3 octobre 1983 |
| SIRET et n° TVA du client | sans objet | sans objet | oui | oui | 242 nonies A (n° TVA du preneur en autoliquidation) |
| Date des travaux | début et durée | « Travaux réalisés » | début et durée | « Travaux réalisés » | C. conso L216-1 ; 242 nonies A |
| Lieu des travaux | oui | oui | oui | oui | arrêté du 3 octobre 1983 |
| Détail : quantité, prix unitaire HT, taux | oui | oui | oui | oui | 242 nonies A ; arrêté du 3 octobre 1983 |
| Total HT, TVA par taux, TTC | oui | oui | HT, « Total à payer » | HT, « Total à payer » | 242 nonies A ; arrêté du 3 décembre 1987 |
| Mention « Autoliquidation » | sans objet | sans objet | oui | oui | CGI 283-2 nonies ; 242 nonies A |
| Échéance, pénalités, escompte | sans objet | oui | sans objet | oui | C. com. L441-9, L441-10 |
| Indemnité de 40 € | sans objet | **à retirer** (point 5) | sans objet | oui | C. com. L441-10, D441-5 |
| Durée de validité | oui | sans objet | oui | sans objet | bonne pratique DGCCRF |
| Médiateur | oui | oui (non exigé) | oui (non exigé) | oui (non exigé) | C. conso L616-1, R616-1 |
| Formulaire de rétractation | oui | sans objet | **non, à juste titre** | sans objet | C. conso L221-5, R221-1 ; B2B : L221-3 |
| Assurance décennale | nom, contrat, zone | nom, contrat, zone | nom, contrat, zone | nom, contrat, zone | loi 96-603, art. 22-2 : **il manque l'adresse** (point 1) |
| 293 B en franchise | oui | oui | oui | oui | CGI 293 B |

**Fausse alerte, écrite pour qu'on ne la refasse pas :** un premier essai a
imprimé le devis en sous-traitance avec « TVA 0 % » et « Total TTC 1 200 ».
C'était mon script qui sautait la porte du PDF : la vraie
(`src/app/api/devis/[id]/pdf/route.ts`, ligne 74) recalcule le devis avant
de l'imprimer, et le papier est alors juste. Même chose pour l'envoi
(`src/app/chantiers/[id]/export/actions.ts`).

## Ce qui MANQUE ou est FAUX

| # | Défaut | Où | Texte | Confiance | Correction proposée |
|---|---|---|---|---|---|
| 1 | **L'adresse de l'assureur** n'est imprimée nulle part : la loi exige ses « coordonnées », Atlas n'a qu'un champ « Assureur » (un nom) | les 4 documents | loi 96-603, art. 22-2 : « sur chacun de leurs devis et sur chacune de leurs factures », assurance, coordonnées de l'assureur, couverture géographique | **élevée** | un champ « Adresse de l'assureur » dans Réglages, imprimé à la suite du nom |
| 2 | **L'attestation décennale n'est pas jointe.** La loi demande l'attestation elle-même (modèle officiel de 2016), pas seulement une ligne | les 4 documents, **quand les travaux relèvent de la décennale** | C. ass. L243-2 ; arrêté du 5 janvier 2016 | **élevée** sur la règle ; **à confirmer** pour quels travaux paysagers | déposer son attestation (PDF) dans Réglages, jointe en dernière page du devis et de la facture |
| 3 | **Acompte à la commande** pour un devis signé au domicile du client : interdit avant 7 jours | conditions générales, article 3 | C. conso L221-10 : aucun paiement avant 7 jours pour un contrat hors établissement | **élevée** | une phrase : « Pour un devis signé à votre domicile, aucun acompte n'est encaissé avant 7 jours. » Un devis accepté par le lien en ligne n'est pas concerné (contrat à distance) |
| 4 | **« Aucune réclamation sur l'aspect des travaux n'est admise ultérieurement »** : clause noire face à un particulier, et contraire à la garantie de parfait achèvement d'un an | conditions générales, article 6 | C. conso R212-1, 6° ; C. civ. 1792-6 | **élevée** sur la clause noire ; parfait achèvement à confirmer selon les travaux | retirer la fin de phrase |
| 5 | **Indemnité de 40 € réclamée à un particulier** : elle n'est due qu'entre professionnels | facture particulier ; conditions générales, article 3 | C. com. L441-10, D441-5 (achats « pour une activité professionnelle ») | **élevée** | l'imprimer seulement pour un client Entreprise |
| 6 | **Délai « donné à titre indicatif », report sans annulation possible** : le particulier a droit à une date ou un délai, et peut résoudre le contrat s'il n'est pas tenu | conditions générales, article 4 | C. conso L216-1 et suivants | **moyenne** | « prolongé en cas d'intempéries » reste ; retirer « à titre indicatif » et « sans que ce report puisse justifier l'annulation » |
| 7 | **Téléphone et courriel** : imprimés s'ils sont remplis, mais rien ne bloque s'ils manquent | devis particulier | C. conso R111-1, 1° | **élevée** | les ajouter à la liste de ce qui manque avant l'envoi |
| 8 | **Garanties légales** : seuls les vices cachés des fournitures sont cités | conditions générales, article 7 | C. conso L111-1, R111-1 | **moyenne** | une phrase sur la garantie de conformité et les vices cachés |
| 9 | **TVA à 10 %** : depuis le 16 février 2025, plus d'attestation, mais une mention de certification sur le devis ou la facture. Atlas ne l'imprime pas | devis et facture particulier, **seulement s'il facture à 10 %** | loi 2025-127, art. 41 ; CGI 279-0 bis ; BOI-LETTRE-000280 | élevée sur la règle ; seuil de 1 000 € à confirmer | **sa réponse d'abord** : le 10 % ne s'applique pas, en principe, à l'aménagement ni à l'entretien d'espaces verts (BOI-TVA-LIQ-30-20-90-30) |
| 10 | **Le bouton « Sous-traitance, sans TVA » s'offre à toute Entreprise**, mairie comprise. L'autoliquidation exige que le client ait lui-même le marché d'un maître d'ouvrage. Une mairie ou une entreprise qui commande pour elle paie la TVA | devis et facture d'une Entreprise | CGI 283-2 nonies ; BOI-TVA-DECLA-10-10-20 | **élevée** sur la règle ; « mairie = TVA normale » est une déduction | il est décoché d'office (son choix B) ; ajouter sous le bouton : « Seulement si votre client a lui-même le chantier d'un autre. » |

## Ce qui reste incertain, et qui peut le trancher

| Question | Pourquoi c'est incertain | Qui |
|---|---|---|
| Quels travaux paysagers relèvent de la décennale (arrosage enterré, murets, terrasses, plantations) ? | aucune source officielle trouvée. C'est ce qui décide si les points 1 et 2 s'appliquent à chaque chantier | son assureur |
| L'autoliquidation sur l'**entretien** d'espaces verts | exclue selon INTIA et la FNTP (contrat séparé) ; incluse si elle suit des travaux dans le même contrat (rescrit BOI-RES-TVA-000269 du 9 septembre 2026) | son comptable |
| La mention exacte pour un artisan au RNE à côté du SIREN | le libellé remplaçant « RM » depuis 2023 n'a pas été confirmé par un texte | son comptable ou sa CMA |
| Est-il déclaré « services à la personne » ? | si oui, son numéro SAP doit figurer sur devis et factures (C. trav. D7233-1, à confirmer) | **lui** |
| Facture-t-il à 10 % ? | décide du point 9 | **lui** |
| « Devis gratuit » | exigé par l'arrêté du 24 janvier 2017, qui vise les métiers du bâtiment ; le paysage n'y figure pas, sauf peut-être la maçonnerie. Coûte une ligne à ajouter | à décider |

## Ce qui arrive et n'est pas encore dû

| | Date | Texte |
|---|---|---|
| **Recevoir** les factures de ses fournisseurs en électronique | **depuis le 1er septembre 2026**, pour toute entreprise : il doit avoir choisi une plateforme agréée. Ce n'est pas Atlas | loi 2023-1322, art. 91 |
| **Émettre** ses factures aux entreprises en électronique, avec 4 mentions neuves (SIREN du client, nature de l'opération, option TVA sur les débits, adresse de livraison) | 1er septembre 2027 | ordonnance 2021-1190 ; décret 2022-1299 |

## Ce qui était faux dans ce que j'ai dit, et se corrige ici

| Ce qui a été dit (`docs/lot-mentions-facture-devis.md`) | Ce qui est vrai |
|---|---|
| Facture : « les mêmes mentions sauf médiateur et décennale » | **la loi 96-603 (art. 22-2) vise aussi les factures.** Atlas l'imprime sur la facture quand elle est remplie, mais ne la réclame pas avant d'émettre |
| « Atlas ne distingue pas un particulier d'une entreprise » (raison de joindre le formulaire à tous les devis) | vrai le 3 octobre, plus depuis le 4. Le formulaire reste sur le devis d'une Entreprise hors sous-traitance : inutile, sans danger |

## Les sources

- loi 96-603, art. 22-2 : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000038587815 ; CAPEB : https://www.capeb.fr/actualites/la-mention-de-lassurance-est-obligatoire-sur-les-devis-et-facture
- C. ass. L243-2 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031010272 ; arrêté du 5 janvier 2016 : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000031824672
- C. conso L221-10 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226864
- C. conso R212-1 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032807196
- C. conso R111-1 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045987238
- C. conso L111-1 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041598850/
- C. conso L216-1 : https://www.legifrance.gouv.fr/loda/article_lc/JORFARTI000032209933
- C. conso L221-5 et suivants : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032221365/
- C. conso L221-3 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226882
- C. conso L616-1 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032808378
- C. com. L441-9 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414397 ; L441-10 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414392
- C. com. R526-27 : https://www.doctrine.fr/l/texts/codes/LEGITEXT000005634379/articles/LEGIARTI000045697814
- CGI ann. II 242 nonies A : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050811276 ; BOFiP : https://bofip.impots.gouv.fr/bofip/140-PGP.html/identifiant=BOI-TVA-DECLA-30-20-20-10-20131018
- Autoliquidation, BOFiP : https://bofip.impots.gouv.fr/bofip/3218-PGP.html/identifiant=BOI-TVA-DECLA-10-10-20-20210421 ; FAQ impots.gouv : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/210_declarer_payer/autoliquidation_travaux_construction.pdf ; INTIA : https://intia.fr/fr/ressources/autoliquidation-sous-traitance-btp/
- TVA à 10 % : https://bofip.impots.gouv.fr/bofip/14834-PGP.html/identifiant=BOI-LETTRE-000280-20251022 ; espaces verts : https://bofip.impots.gouv.fr/bofip/1733-PGP.html/identifiant=BOI-TVA-LIQ-30-20-90-30-20251022
- Arrêté du 3 octobre 1983 : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000032459194
- Arrêté du 3 décembre 1987 : https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006057893/
- Arrêté du 24 janvier 2017 : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000033935513
- Facturation électronique : https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises
- Mentions des factures, ministère : https://www.economie.gouv.fr/entreprises/factures-mentions-obligatoires
