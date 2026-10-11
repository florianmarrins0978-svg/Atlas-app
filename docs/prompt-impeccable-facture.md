# Le prompt `/impeccable` pour la facture

À coller après `/impeccable` dans une session neuve. Il tient seul.

Écrit le 4 septembre 2026. C'est **le second arrêt du parcours** — le dernier
écran avant que l'argent parte — et il n'est jamais passé par `/impeccable`.

**Deux lots tournent à côté. Ce prompt ne les touche pas :** une session retire
la fiche du chantier (`/chantiers/[id]`, les chemins de `lienDeReprise` et les
cinq flèches de retour) ; une autre a codé la feuille du planning. Aucun des
fichiers ci-dessous n'est dans leur périmètre — sauf la flèche de retour de
`facture/page.tsx`, qui appartient à l'autre lot : **ne la touche pas**.

---

```
Rends impeccable LA FACTURE d'Atlas — du moment où le chantier est fait jusqu'à
l'écran que le client ouvre. Rien d'autre : ni le devis, ni le planning, ni la
TVA, sauf pour dire ce que la facture leur casse.

LE PÉRIMÈTRE, EN QUATRE SURFACES

  l'écran du patron   src/app/chantiers/[id]/facture/FactureClient.tsx (605 l.)
                      + page.tsx et actions.ts
  l'envoi             src/app/chantiers/[id]/facture/TransmettreLaFacture.tsx (355 l.)
  la pièce qui part   src/server/pdf/facture-pdf.ts, document-commun.ts
                      src/server/repositories/factures.ts (708 l.)
  l'écran du client   src/app/factures/[jeton]/ — page publique par jeton

  les règles pures : src/lib/echeance-facture.ts, exigibilite-tva.ts

CE QUE « IMPECCABLE » VEUT DIRE ICI, ET ÇA SE MESURE

1. C'est le SECOND ARRÊT du parcours, et le seul qui engage son argent. Il doit
   pouvoir le franchir en quelques secondes quand tout est juste — et il doit
   voir ce qu'il signe. Compte les gestes entre « le chantier est fait » et « la
   facture est partie », et dis-moi lesquels tombent.
2. Aucun montant affirmé sans source. Un total qui ne se recompose pas à la main
   est un total qu'on cesse de croire — et c'est lui qui le défend devant son
   client.
3. Ce qui part chez le client ne suit PAS sa charte : une facture ne part pas en
   noir parce qu'il a choisi Nuit. Elle suit l'allure de ses documents
   (Réglages › Devis & factures, migration 0063), et le défaut est son document
   d'aujourd'hui AU PIXEL PRÈS.
4. Huit chartes pour l'écran, dont deux sombres (Nuit, Sylve) où l'accent est
   CLAIR : aucune couleur écrite en clair, `surPlein` sur un aplat.
   Contrôle : npx tsx scripts/test-chartes-lisibles.ts
5. Tout refus nomme sa raison ET le geste qui le débloque.
6. Le moins de mots possible. Aucune phrase qui explique le bouton d'à côté,
   aucune flèche décorative (scripts/test-aucune-fleche.ts).

DÉJÀ TRANCHÉ PAR LE PATRON — ne pas rouvrir, même si ça paraît mieux

Ses sept corrections du 24 août 2026, capture à l'appui, toutes appliquées :
- le lien du PDF n'a pas de flèche, il est SOULIGNÉ ;
- « Total TTC » et « Télécharger » sont en NOIR, pas en gris ;
- le paragraphe gris sous « Facture F2026-… » (avoir, relevé de TVA) est SUPPRIMÉ ;
- sous « ouvrir le SMS tout prêt », le destinataire et le lien en clair sont
  SUPPRIMÉS — il ne voit plus à qui le message part avant d'ouvrir sa
  messagerie, et c'est SON arbitrage ;
- « Envoyer par SMS », sans flèche ; « Envoyer par e-mail » en or, gras, 15 px ;
- et le lien doré ENVOIE, il ne bascule plus. Il ne bascule que dans un cas :
  quand le client n'a pas d'adresse, pour faire apparaître le champ.

Autres arbitrages fermes :
- Atlas N'ENVOIE PAS lui-même : la facture part de SA messagerie, avec le lien.
- L'échéance est proposée et modifiable AVANT l'envoi, pas après.
- Une facture partie est FIGÉE, identité comprise : une pièce comptable ne se
  réécrit pas. Ce qui manque, c'est la phrase qui l'explique.
- Un commercial ne facture pas (modèle des rôles figé le 30 août).
- La facture se crée depuis le planning (feuille du chevron, 4 septembre) ou
  depuis chaque ligne des « Terminés ».

CE QUI EST OUVERT, ET QU'IL FAUT LUI POSER PLUTÔT QUE TRANCHER

**Les travaux supplémentaires.** Il a tranché le SENS le 31 août — *ça se passe
SUR la facture, avant l'envoi* — mais pas la FORME : écran à part, ou encadré
déroulé sur la facture ? Sa planche existe et porte sa vraie facture :
appli/ts-sur-la-facture.html. Dessine, montre, ne code pas avant sa lettre.
Bornes déjà posées : détail par ligne, bloc séparé, trace de l'accord.

CE QUI EST DÉJÀ CONNU COMME BANCAL — pars de là plutôt que de le redécouvrir

- **UN DÉFAUT RÉEL, non corrigé** : `terminerChantier` rend la facture en
  brouillon SANS regarder s'il existe un devis plus récent
  (repositories/factures.ts, autour de la ligne 102). Un devis v2 fait après
  « Fin de chantier » n'atteint donc jamais la facture. C'est de l'argent perdu,
  pas un défaut d'écran.
- Trois suites rougissent DÉJÀ, sans rapport avec un lot :
  test-facture-e2e (« la facture réglée ne figure pas au relevé »),
  test-tva-au-paiement-e2e (le relevé reste à 0 quand une facture passe à PAYÉE),
  test-facture-au-client-e2e (« Envoyer le devis » reste désactivé). Mesure
  avant d'accuser ton code — et si tu les répares, dis-le : ce sont trois
  rouges que le dépôt traîne.
- FactureClient.tsx, 605 lignes dans un seul écran client.

LES INVARIANTS — un point qui les casse se refuse, et le refus s'écrit

- Toute lecture passe par withEntreprise(utilisateurId, entrepriseId, fn). Hors
  de ce cadre, une requête ne renvoie rien, silencieusement.
- La page par jeton (l'écran du client) s'éprouve avec une suite BASE sous le
  rôle atlas_app : les suites navigateur traversent la RLS et NE VOIENT PAS les
  défauts d'isolation. Le 8 août 2026, le lien de facture était mort en
  production pendant que sa suite navigateur était verte.
- Français partout. Les règles métier vivent dans src/lib/, en fonctions pures.
  Jamais deux fois la même règle entre l'affichage et la vérification.

LA MÉTHODE

1. Lis PRODUCT.md, CLAUDE.md, puis git log -20. Le code fait foi contre la
   documentation ; si les deux divergent, corrige la documentation d'abord.
2. Dis-moi ce que tu as trouvé AVANT d'écrire une ligne : les trois choses qui
   font le plus mal sur ce parcours, chacune avec le fichier qui la prouve, et
   ce que tu refuses de faire.
3. Toute apparence ou tout geste nouveau se DESSINE d'abord : une maquette HTML
   dans appli/, un lien dans appli/essais.html, et l'adresse ENTIÈRE une fois
   qu'elle répond 200 — jamais une capture de la maquette.
4. Regarde les écrans que tu touches, en capture, à 390 × 664, en Nuit comprise.
5. npm run verifier:avant-livraison doit être vert avant de rendre quoi que ce
   soit. Sur le poste Windows du patron : .env pointe sur atlas_dev, que les
   suites videraient — dérive un fichier d'environnement sur atlas_test, et pour
   les suites NAVIGATEUR mets DATABASE_URL sur le rôle `postgres` (seul à
   traverser la RLS). Vérifie que Docker tourne : sa base vit dans les
   conteneurs atlas-postgres et atlas-redis.
6. NE TOUCHE PAS à la flèche de retour de facture/page.tsx : elle appartient au
   lot qui retire la fiche du chantier, en cours dans une autre session.

LE RENDU

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : un verdict par point, le fichier qui le fonde, ce qui a été fait
autrement et pourquoi, ce qui a été refusé et ce que ça aurait coûté, les
chiffres exacts de la batterie, et ce qui reste ouvert avec qui peut le
trancher.
```

---

## Ce qui reste après celui-ci, sur le trajet `chantier → terminé`

| | Écran | État |
|---|---|---|
| 1 | Fiche de chantier | **en cours** — une session la retire |
| 2 | **Facture** | **ce prompt** |
| 3 | Le devis complet | son prompt existe : `docs/prompt-impeccable-devis.md` (branche `claude/prompt-impeccable-devis-ipaftf`), jamais joué |
| 4 | Les prix | rien |
| 5 | La transcription | rien |
| 6 | Les informations | rien |
| 7 | La feuille d'envoi | dessinée le 4 septembre, pas codée |
