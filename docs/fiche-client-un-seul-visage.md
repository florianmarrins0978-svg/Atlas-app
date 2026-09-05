# La fiche client, une seule et même page

*5 septembre 2026 — ce qui a été trouvé, ce qui a été corrigé, ce que ça coûte.*

---

## Ce que vous avez signalé

> « J'ai fait nouveau chantier. Je suis arrivé sur la page de la fiche client,
> j'ai dicté mon chantier, mais j'ai oublié de remplir les informations de mes
> clients. Je suis ensuite allé sur la page du devis, j'ai rempli mon devis,
> j'ai fait retour, donc je suis arrivé sur la page de la fiche client […] Le
> problème, c'est que ce n'est pas la même que lorsque j'ai cliqué sur nouveau
> chantier. […] la note vocale a changé. »

**Vous aviez raison.** Votre séquence a été rejouée à l'identique dans un
navigateur, et les deux écrans ont été photographiés côte à côte.

---

## Ce qui se passait

| Quand | Ce que la fiche montrait |
|---|---|
| **à la création** | le micro vert, sous-titré « Appuyez et décrivez le chantier » |
| **au retour du devis** | l'anneau creux, sous-titré « Poussez l'anneau vers le haut » — c'est-à-dire *retirer* |
| **quelques jours plus tard** | plus rien du tout |

Le troisième cas n'avait été vu par personne, et il serait arrivé tout seul :
l'audio d'une dictée est effacé quelques jours après avoir été transcrit (c'est
la règle de conservation, `docs/RGPD.md`). Ce jour-là, l'anneau **disparaissait
entièrement** de votre fiche client, sans qu'un mot le dise.

Trois écrans différents, donc, pour une seule page.

---

## Ce qui a été corrigé

**La fiche client ne porte plus qu'un objet : celui de la dictée.** À la
création, au retour du devis, et le mois suivant — le même micro, à la même
place.

Pourquoi celui-là, et pas l'anneau :

- cette page sert à **renseigner le client et à dire le chantier** ; écouter et
  relire, c'est la fiche du chantier ;
- c'est l'objet que vous laissez deux minutes plus tôt : après l'envoi de la
  note, la fiche de création redevient le micro. Le retrouver au retour est la
  seule continuité lisible.

**Et l'écran ne vous invite plus à parler par-dessus.** Devant un chantier qui
porte déjà sa dictée, la phrase « Appuyez et décrivez le chantier » ne
s'affiche pas — c'est votre règle du 1ᵉʳ septembre, appliquée ici pour la même
raison. Le micro reste appuyable : si vous redictez volontairement, la nouvelle
note remplace l'ancienne, et un devis déjà corrigé à la main vous le dit avant
d'être refait.

---

## Ce que ça coûte, et il faut le savoir

**Depuis la fiche client, on ne peut plus écouter ni retirer la note.** Ces deux
gestes sont sur la **fiche du chantier**, où l'anneau et son « Retirer »
existent toujours, inchangés.

Si vous voulez les deux sur la fiche client, c'est une décision d'apparence : on
vous fera une maquette avant de coder quoi que ce soit. Dites-le.

---

## Ce qui empêche que ça revienne

`scripts/test-fiche-client-un-seul-visage-e2e.ts` rejoue votre séquence entière
— créer, dicter, envoyer, ouvrir le devis, faire retour — avec un micro simulé,
et vérifie que l'objet est le même aux deux visites. Elle a été **vue rouge sur
la version d'avant**, avec les deux messages qui nomment les deux visages de
trop : un contrôle qui n'a jamais échoué ne prouve rien.

Le détail technique est dans `ARCHITECTURE.md` §249.

---

## La batterie, chiffres exacts

| | |
|---|---|
| types, lint, mémoire du dépôt | **vert** |
| suites base de données | **vert** |
| suites navigateur | **125 / 126** |
| connexion derrière un proxy | **vert** |

Le seul rouge est `test-planning-vers-facture-e2e` — *« un chantier à date
passée est AUSSI au planning »* —, **déjà rouge sur `main` avant ce lot** et
noté comme tel dans `TODO.md` depuis le 3 septembre. Il ne touche rien de ce
qui est corrigé ici.

*(À la première passe, six suites sont aussi tombées d'un coup : le serveur de
développement s'est arrêté sur un défaut interne de Turbopack, en compilant la
feuille de chantier en PDF. Rejouées seules : 6/6. Ce n'est pas l'application,
c'est l'outil qui la sert ici.)*

---

## Ce qui reste ouvert

Rien sur ce point. Deux réponses vous attendent toujours sur l'écran de votre
client (le calendrier qui déborde, et les couleurs du devis) :
https://florianmarrins0978-svg.github.io/Atlas-app/ecran-de-son-client.html
