# Prompt `/impeccable` — la feuille des dates

À copier tel quel dans une session Claude Code du dépôt.

---

```
/impeccable

ÉCRAN VISÉ — la feuille « Envoyer à <client> », celle qui monte du bas quand on
appuie sur « Choisir la date », tout en bas du devis.

Où il vit :
- composant : src/app/chantiers/[id]/export/EnvoiAuClient.tsx
- monté par : src/app/chantiers/[id]/devis-complet/DevisCompletClient.tsx (~l.1210),
  dans le BottomSheet de la maison
- ce n'est plus une page : l'écran récapitulatif a été supprimé le 20 août 2026,
  la feuille s'ouvre sur le devis lui-même. Ne pas le recréer.

QUI L'UTILISE — le patron artisan paysagiste, debout sur le chantier ou le soir
au calme, sur un téléphone de 390 x 664, une main, souvent en plein soleil.
C'est le premier des deux arrêts du parcours : ce qu'il appuie ici part chez son
client et engage sa parole.

CE QUE LA FEUILLE PORTE, de haut en bas :
1. « Envoyer à <nom du client> »
2. « Préparation… » tant que le serveur n'a pas répondu
3. si le client n'a ni numéro ni e-mail : deux capsules SMS / E-mail, un champ,
   « Enregistrer et continuer » — on répare ici, on ne renvoie pas ailleurs
4. la bande de durée « Ce chantier prend » (demi-journées) — elle décide quels
   jours sont proposables
5. « Proposez une ou deux dates » + le calendrier du planning (MoisCharge), qui
   peint la charge de chaque journée
6. la fiche du jour touché : qui est déjà là, à quelle demi-journée, avec quelle
   équipe, et le verdict du serveur ; si le jour est refusé, « Proposer le … »
7. la liste des dates retenues (2 au maximum), chacune avec ce qu'il reste
   d'équipes ce jour-là ; un appui la retire
8. l'interrupteur « Il peut proposer une autre date », dont le sous-titre change
   avec lui
9. « Envoyer le devis » + « Annuler »

CE QUE JE VEUX — une passe impeccable sur CET écran, à mon niveau d'exigence
habituel : hiérarchie, densité, rythme vertical, tailles de touche, contraste,
lisibilité au soleil, cohérence avec le reste d'Atlas.

TOUS LES ÉTATS, pas seulement le nominal — un défaut d'affichage vit toujours
dans celui qu'on n'a pas regardé :
- préparation en cours
- client sans coordonnée (bloc de réparation ouvert), et chantier sans client
- blocage serveur (MESSAGES_BLOCAGE) : le bouton s'éteint, la phrase est en haut
- aucune date retenue (agenda plein, chantier long, ou il décoche sa seule date)
- une date · deux dates (le maximum)
- chantier long : la phrase « X jours ouvrés d'affilée seront réservés »
- jour touché libre · jour touché refusé avec une alternative proposée
- interrupteur ouvert · fermé
- envoi en cours (« Envoi… ») · erreur d'envoi
- les huit chartes, dont les deux sombres (Nuit, Sylve) où les pôles s'inversent

CE QUI NE SE TOUCHE PAS :
- la feuille est celle de la maison (BottomSheet) ; l'action principale est
  PrimaryButton. Rien ne se redessine sur place.
- aucune couleur écrite en clair : jetons de src/lib/design-tokens.ts, surPlein
  pour ce qu'on pose sur un aplat, voile() pour un voile.
- le moins de mots possible : une phrase qui décrit le bouton d'à côté se
  supprime. Trois l'ont déjà été le 26 août 2026, ne pas les rétablir.
- aucune flèche décorative en bout de libellé (test-aucune-fleche.ts).
- toute action est ronde (test-boutons-arrondis.ts).
- le calendrier est le MÊME composant que le planning et que l'écran du client :
  pas de second calendrier, pas de second calcul de charge.
- le serveur tranche (verifierJourPropose), le calendrier montre : ne pas
  supprimer l'aller-retour d'ajout d'une date.
- un refus nomme sa raison ET le geste qui le débloque ; jamais un bouton grisé
  muet.
- le repère data-atlas="invite-dates" et data-atlas="reste-equipes" servent aux
  suites : si un libellé change, viser le repère, pas le mot.
- 2 dates au maximum (DATES_AU_MAXIMUM).

LA MÉTHODE, dans cet ordre :
1. lire l'écran et ses commentaires avant de proposer : chaque parti pris y porte
   sa date et la demande du patron qui l'a produit. Ne pas défaire une décision
   sans dire laquelle.
2. si l'apparence ou un geste change : une maquette d'abord, dans appli/, liée
   depuis appli/essais.html, et me donner l'adresse ENTIÈRE
   (https://florianmarrins0978-svg.github.io/Atlas-app/<la-planche>.html).
   Aucune capture de maquette : je veux pouvoir la toucher.
3. le code ensuite, une fois choisi.
4. regarder les écrans produits, capture à l'appui, dans une charte claire ET
   dans Nuit.
5. batterie complète avant de me demander quoi que ce soit :
   npm run verifier:avant-livraison
   et les suites qui gardent cet écran : test-choisir-la-date-e2e.ts,
   test-deux-dates-calendrier-e2e.ts, test-envoi-client-e2e.ts,
   test-envoi-contact-sur-place-e2e.ts, test-date-lointaine-e2e.ts,
   test-dates-envoi.ts.
6. mémoire du dépôt à jour dans le même commit (CLAUDE.md §2).

Tu es le décisionnaire de ce qui est utile : refuse ce qui n'améliore rien, dis
pourquoi, et ajoute ce que je n'ai pas vu.
```
