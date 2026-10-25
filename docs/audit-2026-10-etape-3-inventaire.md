# Audit de sécurité d'octobre 2026, étape 3 : l'inventaire

*25 octobre 2026. Quatre relevés en lecture seule (routes, actions serveur, base, flux extérieurs et CI). Chaque point classé « confirmé » a été relu dans le code par moi, pas seulement rapporté.*

## Le verdict

**Le cloisonnement ENTRE artisans tient.** 86 tables sous RLS forcée, le contexte posé de façon transactionnelle, aucune action ne prend l'entreprise dans la requête, aucun jeton public n'ouvre plus que son document. Aucune fuite d'une entreprise vers une autre n'a été trouvée.

**Les failles sont DANS une même entreprise** (quel rôle peut faire quoi, quels champs une action accepte), **et sur ton espace lui-même**.

## Ce qui est à corriger, par gravité

| # | Faille | Gravité | État |
|---|---|---|---|
| **E1** | La clé qui signe les sessions de ton espace (`AUTH_SECRET`) est écrite dans le dépôt public (`.devcontainer/docker-compose.yml`). Avec elle, on fabrique un cookie de connexion ; elle chiffre aussi les mots de passe d'agenda Apple et les codes de double vérification. Il faut en plus l'identifiant interne d'un compte, impossible à deviner, et l'adresse de ton espace, qui figure dans chaque lien de devis envoyé | **élevée** | confirmé, lot à part (te déconnecte une fois) |
| **E2** | Un commercial ou la facturation réécrit l'identité de l'entreprise et son **IBAN** depuis l'écran du devis : l'action accepte n'importe quel champ, et la preuve d'identité se fait avec SON propre mot de passe | **élevée** | **corrigé le 25 octobre** |
| **E3** | N'importe quel rôle, salarié compris, pose une **remise** sur le devis de n'importe quel chantier : la branche « réduction » des retouches n'a aucune garde | **élevée** | **corrigé le 25 octobre** |
| **E4** | « Durée et équipe » d'un chantier accepte n'importe quelle colonne du chantier (date planifiée, autoliquidation, dates de facture…) | **élevée** | **reproduit, corrigé le 25 octobre** |
| **E5** | La feuille de chantier en PDF s'ouvre pour tout rôle, sur tout chantier de l'entreprise, sans contrôle de portée | moyenne | **corrigé le 25 octobre** |
| **E6** | Un salarié peut effacer une photo d'un chantier qui n'est pas le sien, par la fiche de sécurité | moyenne | **reproduit, corrigé le 25 octobre** |
| **E7** | Deux autres écritures acceptent des champs en trop (client du devis, lignes de prix : déplacer une ligne vers un autre chantier) | moyenne | **corrigé le 25 octobre** |
| **E8** | La garde des rôles des PAGES vit dans le gabarit racine, que Next.js ne rejoue pas à la navigation interne : un commercial pourrait recevoir les données d'une page qui lui est fermée | à mesurer | à reproduire avant de conclure |
| **E9** | Droits de la base plus larges que le besoin : l'application peut écrire le registre des migrations, les conditions générales, supprimer une entreprise entière | moyenne (défense en profondeur) | vague 3 |
| **E10** | Liens entre tables non composites (paiement et facture, acompte et devis…) : la base n'empêche pas de rattacher un élément à une autre entreprise | moyenne (défense en profondeur) | vague 3 |
| **E11** | Donner un accès, changer un rôle (jusqu'à créer un second patron), résilier : sans redemander le mot de passe | moyenne | vague 3 |
| **E12** | Liens clients en clair en base, certains sans expiration (contrat, passages) ; lien du comptable valable un an | moyenne | vague 3 |
| **E13** | Les libellés des lignes de devis entrent dans la consigne système de l'IA (retouches) ; aucun plafond de dépense d'IA par mois | moyenne | vague 3 |
| **E14** | Sans `ATLAS_PROXY_SAUTS`, les seuils par source deviennent communs à tous : un inconnu peut bloquer les inscriptions ou le mot de passe oublié de tout le monde, ou verrouiller un compte dont il connaît l'adresse | moyenne | dépend du déploiement |
| **E15** | Chaîne logicielle : actions GitHub épinglées par étiquette, `pages.yml` donne ses droits de publication à l'étape qui installe les paquets, aucun délai avant d'installer une version neuve, `demarrer.sh` retombe sur `npm install` | moyenne | vague 3 |
| **E16** | `/api/health/diagnostic` et `/api/health/banc` répondent sans compte (en-têtes reçus, version servie) | faible | vague 3 |
| **E17** | Petits défauts : `choisirLeMotDePasse` sans cadence, une adresse e-mail se devine par le mot de passe oublié, un GET qui écrit, un 500 au lieu d'un refus | faible | vague 3 |

## Ce qui a été vérifié et qui tient

| | |
|---|---|
| Isolation par la base | 86 tables cloisonnées et forcées, contexte transactionnel, rôles sans `BYPASSRLS` |
| Fonctions privilégiées | 5 fonctions de mot de passe, chemin de recherche épinglé, aucune ne rend le condensat |
| Jetons publics | 256 bits, chacun borné à son document |
| Crochet de paiement | signature vérifiée en temps constant, rejeu refusé |
| Requêtes vers l'extérieur | une seule destination venue d'une donnée (agenda Apple), filtrée et revérifiée à chaque redirection |
| Rendu des réponses d'IA | ni HTML, ni lien, ni image chargée |
| En-têtes | CSP, HSTS, anti-cadre, `nosniff` |

## Ce qui n'a pas été vérifié

- les cookies de session réels (valeurs par défaut d'Auth.js supposées) ;
- les droits par défaut des workflows GitHub du dépôt (réglage du site GitHub) ;
- la protection de la branche `main` sur GitHub ;
- tout ce qui dépend de l'hébergeur de production, qui n'existe pas encore.

## La vague 2, faite le 25 octobre

E2 à E7 sont corrigés. Chaque faille a été reproduite sous le vrai rôle (commercial, salarié réglé sur son équipe), avec la requête qu'un attaquant écrirait, vue rouge, corrigée là où la donnée s'écrit, puis vue verte : `scripts/test-roles-dans-l-entreprise-db.ts`, onze cas. Sur l'écran du devis, un commercial lit l'en-tête de l'entreprise sans pouvoir l'écrire (vérifié à l'écran). Le contrôle des gardes refuse désormais une garde qui vit dans une seule branche.

