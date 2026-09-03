# Le prompt `/impeccable` pour le devis

À coller tel quel après `/impeccable`. Il tient seul : une session qui n'a rien
lu du dépôt peut travailler avec — c'est ce qui compte, puisque l'outillage
Impeccable relit `PRODUCT.md` et pas nos conversations.

Écrit le 3 septembre 2026. Il vieillit avec le produit : ce qui est marqué
« déjà tranché » ci-dessous se relit avant de le renvoyer.

---

```
Rends impeccable LE DEVIS d'Atlas — de la dictée sur le chantier jusqu'à l'écran
du client. Rien d'autre : ni l'arrosage, ni le planning, ni la facture, sauf
pour dire ce que le devis leur casse.

LE PÉRIMÈTRE, EN QUATRE SURFACES QUI SE TIENNENT

  préparation      src/app/chantiers/[id]/DevisDepuisDictee.tsx
                   src/server/services/devis-depuis-dictee.ts
                   src/lib/devis-a-preparer.ts, src/lib/preparation-devis.ts
  arrêt 1 — il     src/app/chantiers/[id]/devis-complet/
  valide           (DevisCompletClient.tsx fait 1 637 lignes : c'est un signal)
  la pièce qui     src/server/pdf/devis-pdf.ts, src/lib/devis-envoyable.ts
  part             src/server/repositories/devis.ts et envois-devis.ts
  l'écran du       src/app/devis/[jeton]/ — le devis ET le choix de date au
  client           même endroit ; seule surface publique du produit

CE QUE « IMPECCABLE » VEUT DIRE ICI, ET ÇA SE MESURE

1. Vingt minutes de bureau doivent devenir trente secondes de relecture.
   Compte les gestes qu'il fait aujourd'hui entre la fin de la dictée et
   « Envoyer le devis », et dis-moi lesquels tombent.
2. Il relit debout, une main, en plein soleil, sur un téléphone — puis le soir
   au calme. Les deux scènes, pas une.
3. Aucun prix, aucune durée, aucune quantité affirmés sans source. Un champ sans
   source reste vide ET le dit. L'IA prépare, elle ne décide jamais.
4. Huit chartes de couleurs, dont deux sombres (Nuit, Sylve) où l'accent est
   CLAIR et le fond SOMBRE. Aucune couleur écrite en clair : jetons de
   design-tokens.ts, `surPlein` pour ce qu'on pose sur un aplat. Contrôle :
   npx tsx scripts/test-chartes-lisibles.ts
5. Ce qui part chez le client ne suit PAS sa charte : un devis ne part pas en
   noir parce qu'il a choisi Nuit.
6. Tout refus nomme sa raison ET le geste qui le débloque. Un bouton grisé sans
   phrase est un défaut, pas une protection.
7. Le moins de mots possible à l'écran. Aucune phrase qui explique ce que fait
   le bouton d'à côté. Aucune flèche décorative en fin de libellé.

DÉJÀ TRANCHÉ PAR LE PATRON — ne pas rouvrir, même si ça paraît mieux

- Deux arrêts seulement : avant l'envoi du devis, avant le départ de la facture.
  Un troisième a été retiré parce qu'il ne pouvait mener qu'à « oui ».
- L'application n'envoie pas le devis elle-même : il part de SA messagerie, avec
  le lien. Ne propose pas de fournisseur d'envoi comme correctif.
- On ne demande PAS au client de renvoyer un devis signé : il accepte en ligne,
  on garde l'empreinte du PDF, l'heure, l'adresse.
- Le devis est accepté même si aucune date n'est retenue. L'acceptation est
  l'événement commercialement décisif ; la date se rattrape.
- L'envoi n'est PAS bloqué quand SIRET, adresse ou IBAN manquent. Il l'a codé,
  vu, puis fait retirer le 14 août 2026 : « rien de plus, rien de moins ». Les
  informations se recopient toutes seules dans un devis pas encore envoyé.
- Un devis envoyé est figé, identité comprise : une pièce comptable ne se
  réécrit pas après coup. Ce qui manque, c'est la phrase qui l'explique.
- Les écrans de retour « refus » et « correction » ne proposent pas de
  télécharger le devis. C'est délibéré.

CE QUI EST DÉJÀ CONNU COMME BANCAL — pars de là plutôt que de le redécouvrir

- « Atlas prépare toujours votre devis… (96 s) » et rien ne vient : signalé le
  1er septembre 2026, JAMAIS reproduit sur un poste de développement (TODO.md).
  Le parcours est vert en test. Cherche d'abord ce qui rendrait ce défaut
  bavard, avant de deviner une cause.
- DevisCompletClient.tsx, 1 637 lignes dans un seul écran client.
- Un artisan qui arrive les mains vides n'a jamais été essayé : le jeu de
  démonstration démarre avec une entreprise déjà remplie (docs/A-FAIRE.md).

LES INVARIANTS TECHNIQUES — un point qui les casse se refuse, et le refus s'écrit

- Toute lecture passe par withEntreprise(utilisateurId, entrepriseId, fn).
  Hors de ce cadre, une requête ne renvoie rien, silencieusement.
- La page par jeton : lien non devinable, expiration 45 jours, lecture seule.
  Elle s'éprouve avec une suite BASE sous le rôle atlas_app — les suites
  navigateur traversent la RLS et ne voient pas les défauts d'isolation.
- Français partout : fonctions, variables, tables, messages, libellés.
- Les règles métier vivent dans src/lib/, en fonctions pures. Jamais deux fois
  la même règle entre l'affichage et la vérification.

LA MÉTHODE, DANS CET ORDRE

1. Lis PRODUCT.md, docs/AGENT.md §2, puis git log -20. Le code fait foi contre
   la documentation ; si les deux divergent, corrige la documentation d'abord.
2. Dis-moi ce que tu as trouvé AVANT d'écrire une ligne : les trois choses qui
   font le plus mal sur ce parcours, chacune avec le fichier qui la prouve, et
   ce que tu refuses de faire.
3. Toute apparence ou tout geste nouveau se DESSINE d'abord : une maquette
   HTML dans appli/, un lien dans appli/essais.html, et tu me donnes l'adresse
   entière — pas une capture d'écran de la maquette.
4. Regarde les écrans que tu touches, en capture. Quatre défauts réels de ce
   dépôt sont sortis d'une image et d'aucun test.
5. npm run verifier:avant-livraison doit être vert avant que tu me rendes quoi
   que ce soit. Ne joue rien à la main pendant qu'elle tourne : elle vide la
   base. Ne la passe pas par tail — le nom de la suite tombée est au milieu.
6. Aucune clé IA sur un poste de développement : ce qui dépend de la rédaction
   ou de la lecture d'image se dit « à jouer sur son espace », avec la commande.
   Jamais « impossible » : l'IA est branchée chez lui.

LE RENDU

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : un verdict par point, le fichier qui le fonde, ce qui a été fait
autrement et pourquoi, ce qui a été refusé et ce que ça aurait coûté, les
chiffres exacts de la batterie, et ce qui reste ouvert avec qui peut le
trancher. Ce qui s'est révélé faux en cours de route s'y corrige noir sur blanc.
```
