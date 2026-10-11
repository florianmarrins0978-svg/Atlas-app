# La décennale et le médiateur rappellent, ils ne bloquent plus

**Le 7 octobre 2026.** Sa demande : *« il ne faut pas que ces éléments bloquent
les devis, il faut que ça rappelle à l'utilisateur qu'il faut qu'il y souscrive ;
s'il veut être hors la loi, c'est son problème »*. Puis, devant la photo
quelconque acceptée comme attestation : la lecture par l'IA, *« jamais de
blocage »*.

## Verdict, point par point

| Point | Verdict | Le fichier qui le fonde |
|---|---|---|
| l'adresse de l'assureur ne bloque plus | fait, devis et facture | `src/lib/mentions-manquantes.ts` |
| l'attestation absente ne bloque plus | fait, devis et facture | idem |
| le médiateur absent ne bloque plus | fait | idem |
| un crochet de décennale resté dans ses conditions ne bloque plus | fait, et c'est ma décision : il l'a voulu pour « la décennale » en entier | idem |
| un rappel à l'envoi du devis | fait, au-dessus du bouton « Envoyer le devis », chaque ligne avec « Compléter » | `EnvoiAuClient.tsx` |
| Réglages ne dit plus « ne partent pas » | fait, « Obligatoire sur vos devis et vos factures. », à la même place | `IdentiteClient.tsx` |
| l'IA lit l'attestation déposée | fait, au dépôt : attestation ou non, assureur, fin de validité | `src/lib/attestation-lue.ts`, `src/server/ai/services/lire-attestation.ts` |
| ce qu'elle trouve se rappelle | fait, sous « Déposée » et sur la feuille d'envoi | `remarquesSurLAttestation` |

## Ce qui a été fait autrement, et pourquoi

- **Le rappel est placé au-dessus du bouton d'envoi**, pas sous la phrase du
  blocage : posé là, il coupait « Comment joindre ce client ? » de ses deux
  boutons. Vu sur la capture, corrigé avant livraison.
- **La facture n'a pas de rappel au moment d'émettre.** Son écran ne liste ce
  qui manque qu'après un refus ; Réglages le dit en rouge, et la feuille du
  devis l'a déjà dit.
- **Une lecture illisible se tait.** Elle n'accuse jamais un vrai papier.

## Ce qui bloque toujours

SIRET, nom, adresse, forme juridique, capital et RCS d'une société, numéro de
TVA d'un assujetti, téléphone et e-mail sur un devis de particulier, adresse du
client sur une facture. Il n'a visé que la décennale et le médiateur.

## Les chiffres

| Contrôle | Résultat |
|---|---|
| types, style | au vert |
| `test-documents-en-regle.ts` | 29 vertes, vu rougir contre l'ancienne règle |
| `test-attestation-lue.ts` | 9 vertes, vu rougir |
| `test-documents-en-regle-db.ts` (sous la RLS) | 24 vertes |
| tirets, pansements, couches, code mort, flèches, chartes | au vert |
| écrans regardés | Réglages et la feuille d'envoi, dans un vrai navigateur |
| **batterie complète, commune à six lots** | **au vert le 7 octobre 2026** : 458/458 suites base, 182/182 suites navigateur, connexion derrière un proxy réussie |

## Ce qui reste ouvert

| | Qui |
|---|---|
| déposer une vraie attestation, puis une photo, sur son espace : la lecture réelle n'a pas pu être jouée ici (aucune clé) | lui, sur son espace |

## La batterie commune du 7 octobre

À sa demande, une seule batterie pour six lots finis : ce lot, le n° TVA « FR »
d'office (avec le téléphone et le n° TVA justes), Supprimer du planning et
« Le client s'est trompé », les travaux d'un client posé sans devis, la double
vérification, et les mots de passe courants. Quatre migrations portaient le
numéro 0123 : elles sont devenues 0123 (acceptation défaite), 0124 (attestation
lue), 0125 (double vérification), 0126 (travaux à la main), toutes rejouables.

**La première batterie a rougi sur 5 suites base sur 458, aucune de ce lot** :
l'export des données oubliait les acceptations défaites, un contrôle prenait
« Enlever » pour un retour, et la double vérification manquait de trois
déclarations (son interrupteur, ses actions, sa fiche du mode d'emploi, qui
disait encore qu'Atlas n'avait pas de code en deux étapes). Corrigés à la
racine, puis la seconde batterie : tout au vert.

Laissés de côté, leurs sessions tournant encore : `acompte-retire-des-notes`,
`sous-traitance-phrase`, `devis-expires-planche`.
