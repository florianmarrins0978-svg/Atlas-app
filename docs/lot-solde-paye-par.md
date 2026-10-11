# Le solde et le moyen de règlement

9 octobre 2026. Sur `main` le soir même, dans une batterie commune avec le
numéro RM d'une autre session.

## Ce qui est fait

| Point | Verdict | Où |
|---|---|---|
| La ligne posée par « Facture acquittée » s'appelle « Solde » | fait, à la seule source du nom | `nomAcompte`, `src/lib/acomptes-facture.ts` |
| Les acomptes versés gardent leur nom (« Acompte 30 % », « Acompte 50 % ») | inchangé, et maintenant épinglé par un contrôle | `test-papier-devis-facture` |
| Dans Terminés, le versement qui termine le paiement s'appelle « Solde » | fait, que ce soit par « J'ai reçu le paiement » ou en tapant le reste | `noterPaiement` |
| « Payé par » dans Terminés, au-dessus des deux boutons | fait, Virement d'office, rien d'obligatoire | `EnAttenteDePaiement.tsx` |
| La ligne enregistrée dit le moyen (« Acompte payé le … par chèque ») | fait | même écran |
| Un moyen inconnu envoyé au serveur | refusé en valeur, rien n'est écrit | `estUnMoyenDePaiement` |

## Ce qui a été dit et qui était faux

- J'ai écrit que l'écran de la facture ne savait pas saisir un paiement en deux
  moyens. Il le sait, sur la page où la facture se compose (« + Règlement
  reçu »). Seule la page de la facture elle-même fige ses lignes.
- Le « Acompte 80 % » montré sur une capture venait de mes données d'essai,
  pas d'une addition de l'appli. L'appli écrit le taux cumulé saisi sur le
  devis : 30 %, 50 %, 75 %.

## Ce qui n'est pas fait

| Point | Pourquoi | Qui |
|---|---|---|
| Cesu et Avance immédiate dans « Payé par » | viendront avec le crédit d'impôt, qui n'est pas codé | à coder après la planche du crédit d'impôt |
| Relier Atlas à l'Urssaf | sa décision : pas pour l'instant | lui, si des artisans le demandent |

## La batterie

460/460 suites base, 181/183 suites navigateur, connexion derrière un proxy
verte. Les deux rouges ont le même sort sur la base de `main` (l'un rouge des
deux côtés, l'autre vert des deux côtés en le rejouant) : aucun ne vient de ce
lot. Après la reprise de `main`, le complément a rejoué ces deux suites : 2/2
vertes.
