# Décisions d'architecture, et pourquoi

Chaque entrée dit **ce qui a été décidé**, **ce qui a été écarté**, et **ce que
ça coûterait de revenir en arrière**. Une décision sans son pourquoi se repose
trois mois plus tard, et se tranche différemment.

Documents voisins, plus détaillés :
`docs/ARCHITECTURE_DONNEES.md`, `docs/ARCHITECTURE_DONNEES_v2.1_corrections.md`,
`docs/AGENT.md`, `docs/RGPD.md`.

---

## Socle technique

Next.js 16.2 (App Router, Turbopack), React 19.2, TypeScript, Tailwind.
Drizzle ORM sur PostgreSQL 16. Auth.js. Redis pour la limitation de débit.
Stockage de fichiers abstrait (`src/server/storage`), S3 ou disque local.

L'application-coque mobile est un jeu de pages statiques (`appli/`) empaquetées
par Capacitor. Elle est **distincte** de l'application Next.js — même produit,
deux cibles.

---

## 1. Isolation par entreprise : la RLS, jamais le code applicatif

**Décidé.** Chaque table métier porte `entreprise_id`, avec
`ENABLE` + `FORCE ROW LEVEL SECURITY`. Le contexte est posé par transaction via
`set_config('app.entreprise_id', …, true)`. Tout passe par
`withEntreprise(utilisateurId, entrepriseId, fn)`, qui **revalide l'adhésion à
chaque appel** — même quand l'identifiant vient d'un jeton signé, une adhésion a
pu être révoquée entre-temps.

**Écarté :** filtrer par `WHERE entreprise_id = …` dans le code. Un seul oubli
dans une seule requête expose les données d'un autre artisan, et rien ne le
signale.

**Le piège à connaître :** une requête faite hors de ce cadre ne renvoie pas une
erreur — elle renvoie **zéro ligne, silencieusement**. Un traitement qui ne
trouve rien à faire paraît fonctionner. C'est exactement ce qui est arrivé à la
purge d'audio (voir §5).

**Coût du retour arrière :** total. Toute la posture de sécurité, et ce que la CI
vérifie (`NOBYPASSRLS`, rôles applicatifs restreints), repose là-dessus.

## 2. Rôles PostgreSQL séparés

**Décidé.** `atlas_owner` possède le schéma et applique les migrations.
`atlas_app` est le rôle applicatif : `SELECT/INSERT/UPDATE/DELETE` seulement,
`NOBYPASSRLS`, jamais de DDL, pas de `TRUNCATE`. La CI **vérifie** qu'aucun des
deux n'est superutilisateur ni `BYPASSRLS`.

**Conséquence à retenir :** le nettoyage entre suites de tests emprunte
`DATABASE_ADMIN_URL` (le propriétaire), tandis que les tests eux-mêmes tournent
en `atlas_app` — c'est précisément ce qu'ils cherchent à démontrer.

## 3. La page publique du client : une politique RLS supplémentaire, pas une brèche

**Décidé.** Le client répond **sans session**, donc sans `entreprise_id` connu.
Deux politiques `PERMISSIVE` supplémentaires sur `envois_devis` autorisent la
lecture et l'écriture de la réponse **pour un jeton exact**, posé par le code
juste avant la requête (`app.jeton_envoi`).

**Pourquoi ça tient :** les politiques permissives se combinent en `OR` — celle-ci
s'ajoute, elle n'affaiblit pas l'isolation par entreprise. Sans le jeton, aucune
ligne. Le jeton porte 256 bits d'aléa et **n'est jamais dérivé d'un identifiant
existant** : sinon un seul lien reçu rendrait tous les autres devinables.

**Écarté :** une route serveur qui contournerait la RLS après avoir vérifié le
jeton en code. Ça marche, jusqu'au jour où quelqu'un ajoute une requête dans
cette route sans repenser à la vérification.

## 4. Les règles métier sont des fonctions pures, dans `src/lib/`

**Décidé.** `src/lib/etat-envoi.ts`, `src/lib/chantier-etat.ts`, `src/lib/jour.ts`,
`src/server/disponibilites.ts`, `src/server/trimestre.ts` : aucune n'accède à la base. Elles se testent sans monter un
chantier.

**Le cas qui l'a imposé :** l'état d'un devis parti est lu par trois écrans — la
liste, la fiche devis, le planning. Trois déductions séparées auraient fini par
se contredire, et c'est sur cet état que le patron décide s'il relance ou
replanifie.

**Corollaire :** la **même** fonction sert à construire un écran et à revalider
ce qu'il renvoie. `dateRetenable()` borne le calendrier du client *et* revérifie
la date au moment de la soumission — l'affichage n'est qu'un instantané, deux
clients peuvent viser le même jour.

## 5. Les traitements de maintenance passent par une file, jamais par un contournement

**Décidé.** La purge de l'audio transcrit lit `audios_a_purger`, une file
alimentée **au moment où la transcription réussit**, dans le contexte de
l'entreprise. Chaque entrée porte son `entreprise_id`, que le planificateur
adopte successivement.

**Ce qui a failli être livré :** un balayage direct de `notes_vocales`. Il aurait
purgé **zéro** ligne — le planificateur n'a le contexte d'aucune entreprise — et
la purge aurait paru fonctionner indéfiniment.

**Écarté :** donner `BYPASSRLS` au planificateur. Ça résout le symptôme en
ouvrant une porte permanente.

## 6. Les pièces qui engagent sont immuables, verrouillées en base

**Décidé.** Un devis `envoye` et une facture `emise` ne peuvent plus être
modifiés ni supprimés — par **trigger PostgreSQL**, pas par convention de code.
La transition initiale reste autorisée (`OLD.statut` vaut encore l'état
précédent à cet instant).

**Pourquoi en base :** une règle applicative se contourne par une migration
oubliée, un script d'exploitation, une correction « rapide ». Un trigger, non.

## 7. Le relevé de TVA n'est pas une table

**Décidé.** Il se **calcule** à partir des factures émises, à chaque affichage.

**Écarté :** une table de TVA alimentée à l'émission. Deux écritures pour une
même vérité finissent par diverger, et c'est exactement l'écart qu'un contrôle
cherche.

**Ce qui rend le calcul stable :** l'immuabilité d'une facture émise (§6). Sans
elle, le relevé changerait sous les pieds du patron après sa déclaration. Le lien
entre les deux décisions est réel — casser §6 casse §7.

## 8. L'effacement d'un client trie, il ne supprime pas

**Décidé.** Le droit à l'effacement cède devant l'obligation légale de
conservation (RGPD art. 17(3)(b), Code de commerce L123-22 : dix ans). Alors :

- **Ce qui part** : chantiers, photos, notes vocales et leur audio,
  transcriptions, brouillons, prestations, matériel, lignes de prix, propositions
  de l'assistant, envois de devis, et sur la fiche client tout ce qui sert à
  recontacter.
- **Ce qui reste** : les devis **acceptés**, et le nom du client — sans lequel la
  pièce ne vaut plus rien.
- **Toujours détruit** : le lien public du devis. Un lien qui survivrait à un
  effacement rouvrirait l'accès aux données qu'on vient de retirer.

Le rapport d'effacement dit ce qui a été conservé et jusqu'à quand.

## 9. La facture naît du devis, et rien ne part sans un appui

**Décidé.** « Fin de chantier » bâtit une facture **en brouillon** depuis le
dernier devis envoyé : mêmes lignes, mêmes montants. L'opération est
**idempotente** — un double appui redonne la facture déjà bâtie.

**Pourquoi l'idempotence n'est pas un luxe :** deux factures pour un chantier
doubleraient la TVA collectée, et un double appui est le geste le plus banal qui
soit sur un téléphone. Contrainte `UNIQUE (chantier_id)` en renfort.

**À l'émission, les totaux sont recalculés depuis les lignes**, jamais recopiés :
le patron a pu corriger une ligne à l'écran de confirmation, et un total qui ne
correspond pas à son détail ne se rattrape que par un avoir.

## 10. Un envoi par envoi, jamais un par devis

**Décidé.** `envois_devis` porte une ligne par **envoi**. Un devis refusé, puis
corrigé et renvoyé, produit un nouvel envoi avec un nouveau jeton.

**Pourquoi :** l'ancien reste comme trace de ce qui avait été proposé et de la
réponse obtenue. Un refus est une information de négociation, pas un déchet.

**Conséquence de lecture :** partout où l'on veut savoir « où en est ce devis »,
c'est le **dernier** envoi qui compte — d'où les sous-requêtes corrélées dans
`src/server/repositories/chantiers.ts` plutôt qu'une jointure, qui dupliquerait la ligne du chantier.

## 11. Les dates sont des jours, jamais des instants

**Décidé.** `src/lib/jour.ts` formate une date `AAAA-MM-JJ` **sans jamais passer
par `new Date(iso)`**. `src/server/trimestre.ts` calcule en UTC de bout en bout.

**Ce que ça évite :** un chantier calé le lundi 23 s'affichait « dimanche 22 »
chez une partie des clients — sur un devis, l'erreur est fatale à la confiance.
Et le 1er janvier bascule au 31 décembre pour tout l'ouest de Greenwich, rangeant
une facture dans le mauvais trimestre.

## 12. Le lien public est composé côté serveur

**Décidé.** L'adresse complète du lien remis au patron est bâtie dans le
composant serveur, depuis les en-têtes de la requête (`x-forwarded-host`, puis
`host`).

**Ce que ça évite :** composée depuis `window.location.origin`, elle diffère de
ce que le serveur a rendu — React détecte l'écart et régénère tout l'arbre. Le
défaut était invisible à l'œil et faisait échouer les tests par un chemin
détourné.

**Réserve honnête :** l'en-tête `Host` n'est pas une source de vérité absolue. Ici
il ne sert qu'à afficher un lien au patron authentifié ; le jour où l'application
sera hébergée, une variable d'environnement d'origine publique serait plus sûre.

## 13. Aucun fournisseur d'envoi n'est branché — et on le dit

**Décidé.** Faute de fournisseur SMS ou e-mail, le lien du devis est **remis au
patron** à l'écran, avec un bouton de copie.

**Écarté :** un envoi qui échouerait en silence.

**Révisé le 2026-08-04, et c'est une inversion assumée.** Le partage mobile
(`navigator.share`) était le chemin principal ; il ne l'est plus. Sur iPhone, la
feuille de partage transmet un **texte** — et rien d'autre : ni numéro, ni
adresse. Le patron ouvrait donc Messages avec le message tout écrit et un champ
« À : » vide, alors qu'Atlas connaissait le numéro. Sa phrase : « l'ajout
automatique du numéro ne fonctionne pas ».

Le chemin principal est désormais une adresse `sms:` ou `mailto:` **portée par
un `<a href>`**, qui elle emporte le destinataire. Deux raisons au lien plutôt
qu'à un `window.location.href` :

1. l'adresse devient **lisible dans la page**, donc vérifiable par une suite ;
   le défaut ci-dessus ne se voyait que dans la messagerie du patron, c'est-à-dire
   trop tard ;
2. le navigateur gère lui-même l'appui long, la copie, le retour arrière.

L'objection de 2026-08-01 — « `mailto:` ne peut pas joindre de pièce, et le
partage l'exclut » — ne tient plus : le message ne porte pas le PDF mais **le
lien** vers la page du client, qui donne accès au devis complet ; et les deux
voies coexistent, le partage restant offert en second pour WhatsApp ou Signal.

**Le canal se choisit au dernier moment.** Celui de la fiche du client n'est
qu'un défaut : le patron change d'avis en envoyant, pas en créant le chantier.
Si la coordonnée manque, elle se saisit sur cet écran et est conservée sur la
fiche — c'est le seul endroit de l'application qui permet de la renseigner, et
renvoyer le patron « sur la fiche du client » l'enverrait vers une porte qui
n'existe pas.

**Une coordonnée se relit toujours sur la fiche vivante**, jamais dans
l'instantané figé du devis : l'écran lisait `devis.clientEmail`, si bien qu'une
adresse tout juste enregistrée n'apparaissait pas. Éprouvé par
`scripts/test-transmission-e2e.ts`.

**Le numéro est compacté avant d'entrer dans l'adresse.** La fiche enregistre
« 06 12 34 56 78 » — c'est la forme que propose le champ de saisie. Laissés tels
quels, ces espaces deviennent `%20` et l'application de messagerie n'y reconnaît
plus un numéro : elle rouvre un message **sans destinataire**, c'est-à-dire
exactement le défaut ci-dessus, après l'avoir corrigé à l'écran. Aucun contrôle
ne le voyait, tous employant un numéro collé. Éprouvé par
`scripts/test-message-client.ts`, sur la forme réelle — espaces, points, tirets.

> *Corollaire, valable au-delà de ce cas :* un contrôle qui n'emploie pas la
> donnée **sous la forme où l'utilisateur la saisit** ne prouve rien de ce qui
> lui arrive.

**Et il n'y aura pas de fournisseur d'envoi. Décidé par le patron le
2026-08-04**, contre ce qui était prévu jusque-là : *« ça sera plus rassurant,
même pour les patrons, de passer par leur e-mail et par leur numéro de
téléphone. »* Ce montage n'est donc plus un pis-aller en attendant un
prestataire — c'est le chemin retenu. Quatre raisons, dans l'ordre où elles
pèsent :

- le client **reconnaît l'expéditeur** et peut répondre directement ; un
  expéditeur commercial se lit comme de la publicité ;
- **aucune donnée de client ne transite chez un tiers** : pas de sous-traitant
  ultérieur à autoriser, à lister dans `docs/RGPD.md` §3, ni à faire relire par
  le juriste du point 2 de `docs/A-FAIRE.md`. Cette décision **allège** deux
  autres points bloquants ;
- ni abonnement, ni nom de domaine, ni configuration anti-usurpation ;
- rien ne part sans un geste du patron, ce qui est déjà la règle du produit.

**Écarté du même coup, et pour de bon : joindre le PDF au message.** Impossible
d'abord — ni `sms:` ni `mailto:` ne portent de pièce jointe, et l'API de partage
qui, elle, le peut n'a pas de destinataire (`docs/QUESTIONS.md` §3). Indésirable
ensuite, et c'est la vraie raison : **chez Atlas le devis est la page, pas le
PDF**. Le client qui reçoit une pièce jointe la lit et répond « d'accord » par
retour de message, sans jamais ouvrir la page — donc sans choisir sa date, sans
empreinte du devis accepté, sans horodatage ni adresse IP. Tout l'aval du
parcours retombe à la saisie manuelle. La pièce jointe ne complète pas le lien :
elle lui fait concurrence.

**Ce qui reste au point 5 de `docs/A-FAIRE.md`, qui ne bloque plus :** Atlas ne
sait pas que le message est parti, ni s'il a été délivré. Donc pas de relance
automatique à sept jours, pas de départ automatique de la facture, pas de code
SMS à usage unique à l'acceptation. Ce sont des conforts, à rouvrir seulement si
le volume les justifie un jour.

## 14. Le lanceur de tests doit dire quand le serveur meurt

**Décidé.** `scripts/run-e2e-tests.ts` conserve la sortie du serveur de
développement, vérifie qu'il répond avant chaque suite, et s'arrête net s'il ne
répond plus — après **six tentatives réparties sur une minute**.

**Les deux erreurs qui ont mené là :** d'abord un lanceur muet, qui a produit cinq
suites en échec accusant chacune un écran différent alors qu'aucune n'avait pu
charger la page de connexion. Puis un contrôle **trop impatient** (dix secondes),
qui a déclaré mort un serveur simplement occupé à compiler et a fait échouer un
passage entier. Un contrôle impatient fait pire que pas de contrôle.

## 15. Ce qui n'est pas éprouvable ici est éprouvé par une machine

**Décidé.** Deux workflows vérifient ce que l'environnement de développement ne
peut pas atteindre : `pages.yml` interroge le site publié à son adresse réelle,
`banc-essai.yml` monte l'espace de travail complet et s'en sert.

**Ce qui l'a imposé :** l'environnement de l'agent n'a ni démon Docker, ni
GitHub CLI, et son mandataire réseau refuse `github.io` et la documentation
GitHub. Le banc d'essai y était donc invérifiable — et il a été livré trois
fois de suite avec un défaut que seul le patron rencontrait : un script
manquant, une application pas encore prête, un port fermé.

**Écarté :** contourner le mandataire, ou se contenter d'un contrôle de syntaxe
en déclarant l'ensemble vérifié. Le premier est interdit ; le second revient à
faire porter le test par le patron, ce qui est arrivé et ne doit pas se
reproduire.

**Ce que le contrôle éprouve, et pourquoi :** la base montée, les rôles restés
bridés — un banc d'essai en superutilisateur contournerait la RLS sans le dire —
le compte de démonstration, l'acceptation des documents légaux sans laquelle
chaque écran renvoie vers la garde, et enfin `/login` plutôt que la page de
santé, qui ne touche ni la base ni le rendu.

**Un contrôle qui ne sait pas échouer ne vaut rien.** Celui-ci a été confronté à
une base vide et à une base migrée mais non amorcée avant d'être acté.

---

## 16. Le devis reproduit le modèle du patron, et sa mise en page se teste

**Décidé.** `src/server/pdf/devis-pdf.ts` reproduit `appli/devis-modele.html` —
le modèle que le patron avait construit lui-même pour Arborea. En-tête,
titre centré, colonnes émetteur/client, tableau réglé, bloc de totaux, notes,
modalités de paiement, mention légale et cadre de signature : même ordre, mêmes
libellés, mêmes montants à la française (« 1 400,00 € »).

**Ce qui l'a imposé :** le patron a ouvert le PDF d'Atlas à côté du sien —
« le devis n'a rien à voir avec celui qu'on a fait pour arborea ». C'est le seul
document que son client reçoit ; il porte son sérieux, et il n'était pas le sien.

**Ce qui diffère du modèle, et pourquoi :** le nom vient de l'entreprise et
jamais « Arborea » en dur, car Atlas sert n'importe quel artisan. Les polices
sont Times et Helvetica : le modèle charge Playfair Display et Inter depuis le
web, aucune police n'est embarquée dans le dépôt, et un PDF ne va pas les
chercher. La répartition est respectée — serif là où le modèle met Playfair (le
titre, les intertitres « Émetteur »/« Client » qui sont des `h3`, le total TTC),
sans ailleurs, **y compris le nom de l'entreprise** : `.brand-name` est un
`span`, hors de la règle `h1,h2,h3`.

**Le devis peut tenir sur plusieurs pages.** Le modèle est une page web que le
navigateur découpe seul ; ici c'est à nous de le faire. Sans cela un devis d'une
vingtaine de lignes — un chantier sur plusieurs arbres, rien d'extravagant —
écrivait par-dessus la mention légale et le cadre de signature. Chaque page du
tableau reporte son en-tête de colonnes, et la numérotation n'apparaît qu'à
partir de deux pages : le modèle n'en porte pas, mais un devis papier peut
perdre une feuille sans que personne ne s'en aperçoive.

**Chaque geste est consigné dans une trace** (`composerDevisPdf` renvoie le PDF
*et* ce qu'il a déposé : textes, traits, cadres, avec leurs coordonnées et leur
page). C'est ce qui rend la mise en page vérifiable : un PDF ne se relit pas, et
un intertitre écrit lettre par lettre — le modèle espace les siennes, pdf-lib ne
sait pas le faire autrement — ne se retrouverait même pas dans le flux.
`scripts/test-devis-pdf.ts` interroge cette trace, y compris pour la seule chose
qu'un coup d'œil sur la première page ne voit jamais : qu'aucune ligne ne
descend sur le cadre de signature.

**La référence est ce que le patron a sous les yeux, jamais notre copie de sa
référence.** Le premier jet reproduisait fidèlement `appli/devis-modele.html`,
qui donne aux intertitres « Émetteur » et « Client » un vert foncé
(`--clay:#2f3b2f`). Le patron a envoyé une capture de son devis : ces mêmes
intertitres y sont **terre cuite**, `#a95c35` mesuré sur plus de mille pixels.
C'est à l'antialiasing près le `rust` `#B25A2E` de `src/lib/design-tokens.ts`,
l'accent unique d'Atlas. Le devis s'y tient, et un contrôle le constate — deux
valeurs pour un seul accent finissent toujours par se contredire.

**Une affirmation fausse a été poussée en chemin, et sa correction vaut d'être
lue.** Il avait été écrit que « la copie versée dans `appli/` avait divergé de
son original ». Le relevé automatisé (§17) a montré l'inverse : la page publiée
calcule bien `#2f3b2f`, et la copie porte ce vert **depuis son tout premier
commit** — elle n'a jamais été modifiée. Et il n'existe aucune page de devis à
la racine du site du patron : le relevé y reçoit un 404. Sa version terre cuite
n'est donc plus en ligne nulle part.

Il avait alors été supposé que la capture venait de son Arborea d'origine, dont
la copie se serait écartée avant d'entrer ici. **Cette explication-là est fausse
elle aussi.** Le patron a fourni l'adresse manquante — `…/Arborea-/`, un dépôt
distinct — et le relevé a comparé les deux sites : ils sont **identiques**,
variable par variable. `--clay` vaut `#2f3b2f` des deux côtés. Rien n'a divergé
entre Arborea et sa copie.

**L'origine de la terre cuite de sa capture reste inexpliquée.** Aucune teinte
chaude n'existe dans `appli/`, ni sur l'un ni sur l'autre site publié. Le seul
`#B25A2E` du projet est l'accent d'Atlas lui-même
(`src/lib/design-tokens.ts`). On l'écrit sans le résoudre plutôt que d'inventer
une troisième explication : **deux ont déjà été affirmées puis démenties, chacune
parce qu'elle allait au-delà de ce qui avait été mesuré.**

**Le patron a tranché, les deux versions sous les yeux.** Le 3 août 2026, les
deux devis lui ont été rendus côte à côte — même contenu, seule la teinte
changeant — avec l'origine de chacune : « je veux terre cuite ». La couleur du
devis n'est donc plus une déduction tirée d'une capture, c'est une décision. Ne
pas la rouvrir au motif que la page encore en ligne, elle, est verte.

**Le papier est crème (`#faf9f5`), pas blanc.** C'est celui du modèle. Un
navigateur n'imprime pas les fonds sans qu'on le lui demande ; un PDF, lui, les
imprime toujours — cette teinte partira donc sur la feuille du client. C'est le
prix du « exactement le même », assumé plutôt que découvert à la cartouche.

**Les couleurs posées sont consignées dans la trace**, en hexadécimal : c'est ce
qui permet à un contrôle de constater une teinte, au lieu de la répéter dans le
test et de dériver avec elle.

**Un contrôle qui ne sait pas échouer ne vaut rien.** Chacun de ces contrôles a
été confronté au défaut qu'il prétend détecter — accent raboté, montant en
« 1400.00 EUR », pagination retirée, nom d'entreprise figé — et chacun a rougi
en désignant le bon coupable. Le premier jet cherchait « EUR » n'importe où dans
le document : il accusait « ÉMETTEUR », qui se termine par ces trois lettres.


---

## 17. Ce qui n'est pas joignable d'ici se fait relever par une machine

**Décidé.** `.github/workflows/relever-palette.yml` ouvre le devis d'origine
**à son adresse publique**, dans un vrai navigateur, et rapporte les couleurs et
les polices que celui-ci **calcule**. Le rapport se lit par l'API GitHub.

**Ce qui l'a imposé :** le mandataire réseau de l'environnement de développement
répond `403 à CONNECT — policy denial` sur `github.io` (essayé, pas supposé), et
la fenêtre d'autorisation qui donnerait accès au dépôt du site ne s'affiche pas
chez le patron. Sans ce relevé, la seule source restait une capture d'écran — et
c'est en raisonnant sur elle seule qu'une conclusion fausse a été tirée (§16).

**Pourquoi lire le calculé et non le déclaré :** une variable surchargée, une
règle plus spécifique ou une feuille distante changeraient la couleur sans
toucher au `:root`. C'est la couleur à l'écran qui fait foi, puisque c'est elle
que le patron regarde.

**Il cherche la page au lieu de la supposer**, et refuse de relever quoi que ce
soit s'il ne la trouve pas. Une mesure prise sur la mauvaise page serait pire
que pas de mesure : elle donnerait une réponse fausse avec l'autorité d'un
chiffre.

**Deux sites comparés valent mieux qu'un relevé isolé.** Tant qu'une seule page
était relevée, chaque écart appelait une hypothèse. Mises côte à côte, les pages
d'Arborea et d'Atlas se sont révélées identiques — ce qu'aucune mesure isolée
n'aurait pu établir, et ce qui a démenti l'hypothèse en cours.

**Attention à ce que compare le rapport.** Il met en regard toutes les pages
qu'on lui donne, y compris de types différents : une variable propre au devis
apparaît « absente » sur un écran d'application, et se compte à tort comme un
écart. Comparer page à page de même nature, jamais le total.

**Ce qu'il a rapporté du premier coup, et qui n'était pas vérifiable autrement :**
la moitié basse du devis, que la capture du patron ne montrait pas — mention
légale `#7a7a6a`, légende de signature `#6b6b5c`, total final en Playfair 600,
en-têtes de colonnes `#6b6b5c` en Inter 700. Le devis d'Atlas s'y conformait
déjà. Et le 404 à la racine, qui a permis de dater l'écart de couleur.


---

## 18. Une seule charte pour l'application : celle d'Arborea

**Décidé le 3 août 2026, par le patron.** L'application reprend l'identité
visuelle d'Arborea — vert pin `#2f3b2f`, fond os `#f5f3ee`, Playfair Display
pour les titres, Inter pour le texte. **Les documents font exception** : devis et
facture gardent la terre cuite `#B25A2E`.

**Ce qui l'a imposé.** Deux chartes coexistaient sans que personne l'ait décidé.
Atlas s'était donné en chemin un accent terre cuite et les polices du système ;
les maquettes reprises d'Arborea gardaient le vert pin, Playfair et Inter. Le
patron a fini par le voir : « le style graphique et les couleurs qui apparaissent
sur ce site ne correspondent en rien à l'application ». Il avait raison, et le
choix ne lui avait jamais été soumis.

**Les valeurs ne sont pas approchées à l'œil.** Elles ont été relevées sur
`…github.io/Arborea-/app.html` par un navigateur (§17), variable par variable.

**Pourquoi le jeton s'appelle encore `rust` alors qu'il vaut un vert.**
Soixante-quatre fichiers l'importent. Le renommer dans le même lot aurait mêlé un
changement d'identité à un changement mécanique de grande ampleur, chacun
masquant les erreurs de l'autre. Le nom sera corrigé seul, plus tard. En
attendant, le commentaire du jeton le dit.

**Pourquoi les documents gardent la terre cuite.** Un devis n'est pas un écran :
c'est la pièce que le client garde, imprime et signe. Le patron a choisi cette
teinte les deux versions sous les yeux, puis l'a maintenue en demandant que le
reste reprenne Arborea. `couleursDocument` porte cette exception, séparément de
`colors`, pour qu'elle ne se dilue pas au prochain ajustement.

**Les polices sont rapatriées au build** par `next/font`, et servies depuis notre
origine. Les charger chez Google serait bloqué par la politique de sécurité
(`default-src 'self'`) — l'artisan verrait alors les polices de repli de son
téléphone, c'est-à-dire pas Arborea.

**Ce qui n'a pas été aligné, et pourquoi.** Arborea navigue par une barre haute
portant son nom ; Atlas par une barre basse, pensée pour le pouce et pour une
application installée sur l'écran d'accueil. Remplacer l'une par l'autre est une
décision d'usage, pas de couleur : elle n'a pas été prise seule. Voir `TODO.md`.


---

## 19. Devis et facture partagent une seule mise en page

**Décidé.** `src/server/pdf/document-commun.ts` dessine les deux pièces ;
`devis-pdf.ts` et `facture-pdf.ts` ne portent que ce qui les distingue.

**Ce qui l'a imposé :** le modèle du patron donne au devis et à la facture
exactement la même feuille. Les copier aurait produit deux implémentations qui
divergent — ce que `CLAUDE.md` §3 interdit — et l'écart ne se serait vu que sur
les pièces déjà envoyées au client.

**Ce que le moteur ne décide pas**, et qui passe par `OptionsDocument` : le
titre, les références d'en-tête, l'intertitre des notes, la mention légale, le
cadre de signature, et le rappel du devis d'origine.

**Ce qui distingue une facture, et n'est pas cosmétique :**

- **Trois références au lieu d'une validité** : numéro, date d'émission, date
  d'échéance — c'est l'échéance qui fait courir les pénalités, et son absence
  rendrait la mention légale creuse. Absente, sa ligne reste vide (`CLAUDE.md` §4).
- **Aucun cadre de signature.** Une facture ne se signe pas, elle se règle. En
  proposer un inviterait le client à croire qu'il lui reste à accepter.
- **La franchise de l'article 293 B ne s'imprime que si le taux est nul.** Le
  modèle du patron porte la consigne « à retirer si vous êtes assujetti » : on
  ne peut pas laisser cette décision à l'impression. Une facture qui affiche
  « TVA (10 %) » **et** « TVA non applicable » est fausse.

**La pièce est figée à l'émission**, archivée dans le même geste que le
changement de statut — comme le devis à l'envoi, et pour la même raison : une
facture émise est immuable (trigger PostgreSQL), et un PDF reconstruit depuis
les données du jour ne serait plus celui que le client a reçu.

**La refonte a été prouvée sans effet sur le devis** : le PDF rendu avant et
après extraction du moteur est identique **au pixel près** (même empreinte
SHA-256 de l'image). Un moteur partagé qui déplace un trait de deux points
abîmerait une pièce déjà éprouvée sans qu'aucun test ne le dise.


---

## 20. Les copies de `appli/` sont conformes à leur source, et c'est vérifié

**Constaté le 3 août 2026** par `scripts/comparer-modeles.mjs`, qui télécharge
les six modèles publiés sur `…github.io/Arborea-/` et les compare octet par
octet aux fichiers de `appli/`.

| Modèle | Verdict |
|---|---|
| `facture-modele.html` | **identique** — 26 445 octets |
| `tva-modele.html` | identique — 34 531 octets |
| `mes-tarifs.html` | identique — 18 775 octets |
| `app.html` | identique — 7 409 octets |
| `devis-vocal.html` | identique — 21 005 octets |
| `devis-modele.html` | **en avance** — 39 864 ici contre 37 147 en ligne |

**Le seul écart est une avance, pas une dérive.** Les 2 717 octets
supplémentaires du modèle de devis sont le message d'accompagnement de l'envoi
(`.send-status`, `copierDestinataire`) — un ajout fait ici à dessein, absent du
site du patron. Reprendre le fichier en ligne le supprimerait.

**Ce que cela clôt.** Deux explications d'un écart de couleur ont été affirmées
puis démenties, toutes deux parce qu'elles raisonnaient sur la copie sans
jamais consulter l'original. La question ne se pose plus par hypothèse : elle se
mesure, et le contrôle se rejoue.

**Ce que cela ne dit pas.** Le PDF n'est pas le modèle : c'est sa transposition.
Les polices diffèrent (§16), un PDF n'ayant pas accès à Playfair Display ni à
Inter. La conformité porte sur la source, pas sur le rendu.


---

## 21. La barre de navigation reste en bas — décidé, pas subi

**Décidé le 3 août 2026 par le patron**, les deux formes sous les yeux :
Atlas garde sa barre basse à quatre onglets, là où Arborea navigue par une
barre haute portant son nom.

**Pourquoi c'est écrit alors que rien ne change.** Le reste de l'application a
repris la charte d'Arborea (§18). Sans cette ligne, la prochaine conversation
verrait une incohérence et « corrigerait » la barre pour aligner — en défaisant
un choix délibéré. Une décision de ne rien faire se perd plus vite qu'une autre.

**Le motif, dans ses mots :** la barre basse se touche d'une main, sur un
chantier, sans lâcher le téléphone ni remonter la page. La barre haute d'Arborea
défile avec le contenu et sort de l'écran. Atlas est une application installée
sur un écran d'accueil, pas un site que l'on parcourt.

**L'action principale, elle, prend la forme d'Arborea** : carte vert pin, rond
d'icône, titre en Playfair, sous-ligne et flèche
(`src/components/atlas/ActionPrincipale.tsx`).

Deux écarts assumés avec le modèle, et notés dans le composant :

- **La sous-ligne décrit le parcours réel** — « Le client, l'adresse, puis la
  dictée sur place » — au lieu du « Dictez votre chantier sur place » d'Arborea.
  Chez lui la carte ouvre l'écran de dictée ; ici elle ouvre un formulaire, et
  la dictée vient un écran plus tard.
- **L'icône est un `+`, pas un micro**, pour la même raison. Un micro qui ouvre
  un formulaire serait une petite tromperie, répétée à chaque ouverture.

---

## 22. Le planning compte en demi-journées, et le client n'en sait rien

**La demande, dans ses mots** (2026-08-03) :

> « J'ai déjà un chantier le 6 août, donc pour mon nouveau client on ne propose
> pas le 6 août. Mais si mon 1er chantier du 6 ne dure que le matin, je ne peux
> pas caler une autre demi-journée l'après-midi. »
> « Si j'ai deux équipes dans ma boîte, je peux avoir deux chantiers, voire plus,
> le 6 août. »

Et, sur la forme, une consigne qui commande tout le reste :

> « Mon client ne doit pas être informé de la demi-journée, seulement moi ; lui
> verra le 6 août. »

### Le modèle retenu

Un jour porte **deux demi-journées**. Chacune tient autant de chantiers que
l'entreprise déclare d'**équipes** (`entreprises.nombre_equipes`, 1 par défaut).
Un chantier occupe une suite de demi-journées à partir d'un départ
(`chantiers.creneau_debut`) et pour une durée réservée
(`chantiers.duree_demi_journees`). Migration `0019_creneaux_et_equipes.sql`.

**Trois pistes avaient été présentées au patron** — un simple créneau, une durée
en demi-journées, des heures réelles. Il a retenu la deuxième et écarté les
heures : « la demi-journée suffit ». Le noter évite de rouvrir le débat, et
surtout évite qu'une prochaine conversation prenne les heures pour un oubli.

### Le troisième défaut, que personne n'avait signalé

La durée dictée (« 2 jours ») **n'entrait nulle part dans la planification** :
seule `duree_prevue`, un texte libre, la portait, et seul le chiffrage la lisait.
Un chantier de deux jours calé le 6 laissait donc le 7 proposable au client
suivant. `duree_demi_journees` est la donnée calculable, distincte du texte :
faire dépendre un planning d'une chaîne de caractères, c'est le rendre faux au
premier mot mal orthographié.

### Une seule règle, quatre chemins

`src/server/disponibilites.ts` porte tout le calcul, sans base. Quatre chemins
l'emploient — l'écran d'envoi, la création de l'envoi, la revérification de la
réponse du client, et la planification à la main. Quatre calculs distincts
finiraient par diverger, et c'est le client qui découvrirait l'écart.

Le créneau est **choisi par le planning, jamais par le client** : il retient un
jour, `departPossible()` lui trouve la demi-journée — le matin de préférence,
l'après-midi sinon.

### Ce que le client reçoit, et ce qu'il ne reçoit pas

La page publique continue de ne recevoir que des **dates**. La nuance introduite
est ailleurs : la liste des jours indisponibles n'est plus « les jours où un
chantier est posé » mais « les jours où **ce** chantier ne tient pas » — elle
dépend donc de sa durée. `test-creneaux-planning.ts` vérifie sur le contenu
sérialisé qu'aucun « matin », « après-midi », « créneau » ni « durée » ne
traverse la frontière.

### Le piège de la migration, et comment il est fermé

Les chantiers planifiés **avant** cette migration n'ont ni créneau ni durée. Les
lire comme « rien de réservé » aurait libéré, du jour au lendemain, des
après-midis déjà pris — et le patron se serait retrouvé avec deux clients au même
endroit. `compterOccupation()` les traite donc comme **une journée entière à
partir du matin**, c'est-à-dire exactement ce qu'ils étaient. Un contrôle dédié
le vérifie sur une ligne remise à l'état d'avant.

### Ce qui reste ouvert

Les **équipes nommées** (qui va où) et la **capacité en hommes** n'ont pas été
retenues : le patron a choisi le compteur. Elles restent dans `TODO.md` si son
entreprise grandit.

## 23. De la dictée au devis : un seul geste, et rien n'est jamais mort

**Décidé le 2026-08-04**, après : « toujours pas de devis créé tout seul à partir
de la note vocale ! Problème qui traîne. »

### Ce qui était en cause, et ce qui ne l'était pas

Le message affiché — « Réponse du fournisseur non conforme (JSON invalide). » —
n'était que le symptôme du jour. Le fond était ailleurs : **chaque maillon
existait, aucun ne menait au suivant.** Brouillon, confirmation, chiffrage,
ligne de prix, devis : cinq gestes sur quatre écrans, tous éprouvés
séparément, et aucune suite ne les parcourait à la file. Un contrôle par maillon
peut rester vert pendant que le parcours ne mène nulle part.

`docs/AGENT.md` §2 décrivait pourtant l'agent qui « transcrit, structure, cherche
les tarifs, **rédige le devis** », avec **un seul arrêt**. Ce lot construit
l'enchaînement décrit ; il n'invente aucune règle.

### Deux principes, tenus dans le code

**1. Aucun chemin ne laisse le patron devant rien.**
`extraction-service.ts` ne renvoie plus d'échec sur une réponse de fournisseur :
il tolère l'emballage (`lireObjetJson` — bloc de code, prose autour), et si rien
n'est exploitable — réponse à côté, hors schéma, clé absente, quota, panne — il
**lit la dictée mot à mot** (`lecture-litterale.ts`), sans réseau ni clé.

Le découpage littéral a quitté le fournisseur de développement pour vivre seul :
les deux s'en servent, et deux copies auraient fini par diverger — c'est le
chemin de secours, le moins souvent relu, qui serait resté en arrière.

Cette lecture **recopie, elle ne comprend pas** : elle ignore qu'un chêne mort
s'abat et qu'une haie se taille. Le brouillon porte donc `lecture = 'litterale'`
(migration 0021, persistée pour survivre au rechargement), et les écrans le
disent. Une recopie présentée comme une analyse serait un mensonge sur ce que le
patron relit.

**2. Un raccourci n'est pas une dispense.**
`preparerDevisDepuisDictee()` enchaîne tout, mais :

| Ce qu'il fait | Ce qu'il ne fera jamais |
|---|---|
| Écrit prestations, matériel, durée, équipe | Envoyer quoi que ce soit — l'arrêt avant l'envoi est intact |
| Applique un tarif, ou un chiffrage calculé | Inventer un prix : sans tarif ni durée/équipe, aucune ligne, et le rapport dit pourquoi |
| Trancher entre deux tarifs concurrents | Non — le choix reste au patron, comme sur l'écran Prix |
| S'arrêter si le brouillon a été corrigé à la main | Écraser une correction humaine |

Il n'implémente rien de neuf : `confirmerBrouillon()` et
`appliquerPropositionPrix()` ont été **sortis des actions d'écran vers des
services**, précisément pour que les deux chemins appliquent la même règle
(`CLAUDE.md` §3). Sans cela, le raccourci aurait rouvert le devis doublé du
3 août sur la voie la moins relue.

### Ce que les contrôles tiennent

- `test-lecture-dictee.ts` : le fournisseur est **injectable**, donc une réponse
  mal formée est fabricable — sans quoi le défaut du patron restait
  intestable. Réponse encadrée, prose, hors schéma, panne, quota : à chaque fois
  la dictée ressort.
- `test-devis-depuis-dictee-e2e.ts` : un appui, un devis chiffré, **zéro envoi**,
  et rejouer le geste n'ajoute pas une seconde ligne de prix.

## 24. L'espace d'essai se met à jour, et l'application dit sa version

**Décidé le 2026-08-04**, après le défaut le plus coûteux de la série — et il
n'était pas dans l'application.

### Ce qui s'est passé

Le patron signale deux correctifs qui « ne marchent toujours pas » : la bande de
durées « a disparu », le numéro du client « ne se met toujours pas ». Les deux
étaient corrigés, éprouvés, fusionnés la veille. Son espace de travail gardait
le code du jour de sa création : **un espace ne récupère jamais rien tout seul.**
Rien à l'écran ne le lui disait. Trois échanges perdus à chercher des défauts
déjà réparés.

### Ce qui est décidé

**1. L'espace se met à jour à chaque allumage.** `.devcontainer/mettre-a-jour.sh`,
appelé par `demarrer.sh`, puis `npm ci` et les migrations si quelque chose a
bougé — un code neuf sur une base ancienne serait une panne, pas un correctif.

Trois prudences, dans cet ordre, et aucune n'est négociable :

| Situation | Ce qui se passe |
|---|---|
| Travail non enregistré | on ne touche à rien, et on le dit |
| Historique divergent | refus — jamais de `--force` |
| Distant injoignable | refus explicite, le démarrage continue |

*Écraser le travail du patron pour lui livrer une mise à jour serait un remède
pire que le mal.*

**2. Le script vit dans son propre fichier.** Non par goût du découpage : ainsi
il est **éprouvable**. `scripts/test-mise-a-jour-espace.ts` monte de vrais
dépôts git et le confronte aux quatre états qu'il prétend distinguer. Enfoui
dans `demarrer.sh`, il n'aurait jamais été vu échouer — et c'est exactement ce
que `AGENTS.md` interdit.

**3. L'application annonce la version qu'elle exécute** (Réglages, en bas).

C'est le contrôle le moins spectaculaire du dépôt et l'un des plus utiles : une
capture d'écran répond désormais à « quelle version essayez-vous ? » sans qu'il
faille poser la question.

**Corrigé le 2026-08-07 : elle est lue dans le dépôt servi, pas dans une
variable.** Elle venait de `ATLAS_VERSION`, posée par `demarrer.sh` juste avant
de lancer le serveur. Une variable est figée à la naissance du processus, et
c'était faux deux fois :

| Situation | Ce que l'écran disait | La vérité |
|---|---|---|
| Serveur lancé autrement que par `demarrer.sh` | « inconnue » | le commit servi |
| Après « Chercher les dernières corrections » | l'**ancien** commit | le nouveau |

Le second cas est le plus grave : le bouton tire du code neuf *sans redémarrer*,
donc celui qui existait pour éteindre le malentendu « rien n'a été corrigé »
l'alimentait. Le patron a lu le premier cas le 7 août 2026, sur un espace neuf.

`src/server/version-executee.ts` interroge donc le dépôt à chaque affichage —
quelques millisecondes, sur un écran consulté trois fois par semaine.
`safe.directory` est passé à l'appel : dans un conteneur, le dossier de travail
appartient souvent à un autre compte, et git refuserait en silence, ramenant
« inconnue » par un autre chemin. Si git ne répond pas, on retombe sur la
variable plutôt que de faire tomber l'écran.

**Hors banc d'essai, rien ne change** : une application déployée n'a pas de dépôt
sous la main, et sa version vient de sa chaîne de livraison (`ATLAS_VERSION`,
`RELEASE_VERSION`). Y lancer une commande git serait au mieux inutile.

Et le bouton de mise à jour **nomme la version obtenue** : « Vous étiez déjà à
jour » ne prouve rien tout seul — c'est précisément la phrase qu'affiche un
espace resté en arrière.

**4. L'issue de la mise à jour ne voyage pas dans la réponse.** Corrigé le
2026-08-07, après que le patron a lu « La mise à jour n'a pas abouti » sur une
mise à jour qui avait abouti.

Tirer le code neuf remplace des centaines de fichiers **sous le serveur en train
de tourner**. Il se recompile aussitôt, et la réponse en cours de route est
coupée : le navigateur ne reçoit rien, quel que soit le résultat réel. Une
réponse HTTP est donc le plus mauvais support possible pour l'issue de
l'opération qui la détruit.

L'issue est écrite dans `/tmp/atlas-mise-a-jour.txt` **avant** que la migration
puisse couper quoi que ce soit, et l'écran la relit au rendu suivant. Le bouton
rafraîchit l'écran de lui-même (`router.refresh()`), et son message d'échec ne
prétend plus savoir : il renvoie à la ligne Version, qui ne peut pas se tromper.

**Dans `/tmp`, jamais dans le dépôt.** Un fichier déposé à la racine rendrait
l'arbre git sale, et `mettre-a-jour.sh` refuserait alors *toutes* les mises à
jour suivantes en disant « des modifications non enregistrées sont présentes » :
le remède aurait créé la panne, pour de bon.
`scripts/test-issue-mise-a-jour.ts` le **démontre** sur un vrai dépôt git — il
crée le fichier à la racine et vérifie que le script refuse — plutôt que de se
contenter de lire le code.

### Ce que ça ne résout pas

Un espace créé sur une branche qui n'existe plus, ou dont l'historique a été
réécrit, reste en arrière — le script refuse d'avancer, à raison. Il le dit ;
c'est alors un nouvel espace qu'il faut, pas une mise à jour.

---

## 25. Emporter ses données passe par l'isolation, jamais à côté

Le patron a perdu ses chantiers une fois, en supprimant l'espace de travail. Il
a ensuite posé la question qui commande la suite du produit : *« le jour où je
mets ça en ligne, est-ce que je perds toute la mémoire de l'agent ? »* Tant que
la réponse honnête restait « peut-être », il avait raison de ne rien vouloir
saisir — et l'agent qui apprend ne pouvait pas commencer.

`Réglages → Télécharger mes données` répond : un fichier, sur son téléphone.

### Ce qui a été écarté, et pourquoi

**`pg_dump`.** C'est la réponse évidente, et elle est mauvaise ici. Elle exige
le rôle propriétaire de la base, un terminal, et la connaissance de la commande
— trois choses que le patron n'a pas et n'a pas à avoir. Elle exporterait de
surcroît *toutes* les entreprises, ce qui est un contresens pour un bouton
placé dans les réglages d'une seule.

**Un privilège d'export.** Tentant, puisque « c'est pour sauvegarder ». Refusé :
`CLAUDE.md` §4 interdit d'affaiblir la RLS pour se simplifier la vie, et l'export
est justement l'endroit où une fuite ne se verrait pas — personne ne relit trois
mille lignes de JSON pour vérifier qu'aucun client d'une autre société n'y est.
`exporterEntreprise` passe donc par `withEntreprise`, comme une lecture
ordinaire.

**Conséquence assumée :** ce fichier ne restaure pas une base entière, plusieurs
sociétés comprises. Ce n'est pas son objet — `PRODUCTION_BACKUP_RESTORE.md`
garde le sien.

**Une bibliothèque d'archivage.** Le format ZIP est publié depuis 1989 et figé.
`src/lib/archive-zip.ts` l'écrit en quatre-vingts lignes, méthode « stockage » :
photos et PDF sont déjà compressés, la compression ne gagnerait que quelques
pour cent — contre un chemin de code capable de se tromper en silence, dans le
seul fichier dont l'unique qualité qui compte est de se relire.

### Trois propriétés tenues par le code, pas par la vigilance

**1. L'export est exhaustif, et ça s'éprouve.** `test-export-entreprise.ts`
interroge `information_schema` : toute table portant un `entreprise_id` doit
figurer dans l'export, sans quoi la suite rougit. Une table ajoutée demain et
oubliée disparaîtrait autrement des sauvegardes sans un bruit — et le trou ne se
découvrirait que le jour où l'on en aurait besoin. Le contrôle inverse existe
aussi : une exclusion qui ne correspond plus à aucune table est signalée, car
une dispense périmée couvre la prochaine omission.

**2. L'archive s'ouvre avec l'outil du système, pas avec le nôtre.** Un format
écrit à la main ne se prouve pas en se relisant : la suite écrit l'archive sur
disque et la donne à `unzip`. Un décalage d'un octet, un CRC faux, un catalogue
mal placé s'y voient — et ne se verraient nulle part ailleurs.

**3. Un fichier absent n'interrompt pas la sauvegarde.** L'audio est purgé après
transcription (`docs/RGPD.md` §4) : l'absence est le cas *normal*. Faire échouer
l'export dessus reviendrait à interdire toute sauvegarde à qui a laissé tourner
la purge une fois. `fichiers-absents.txt` liste ce qui manque **et dit lequel
des deux cas s'applique** — une photo absente, elle, signale un espace de
travail supprimé puis recréé.

### Un lien, pas une action serveur

Le téléchargement est un `GET` sur `/api/mes-donnees`, atteint par une simple
balise `<a download>`. Rien à voir avec un choix esthétique : une action serveur
aurait rouvert la porte du défaut qui a coûté vingt échanges au patron —
« Invalid Server Actions request. » derrière un proxy (`CLAUDE.md` §5). Un
téléchargement n'a aucune raison de traverser ce mécanisme.

L'archive est produite **au fil de l'eau** : une seule entrée est tenue en
mémoire à la fois. Tout construire d'un bloc ferait tomber le serveur au moment
précis où le patron essaie de sauver ses données.

### Ce que ça ne fait pas

**La sauvegarde automatique.** Elle reste bloquée, et pas par manque de code :
elle doit déposer son fichier quelque part. Pas dans le dépôt, qui est public —
y écrire les noms et adresses des clients serait une fuite, pas une sauvegarde.
Pas sur le disque de l'espace de travail, qui est précisément ce dont on se
protège. Il faut une destination extérieure, donc l'hébergeur, donc le point 3
de `docs/A-FAIRE.md`. Écrit dans `TODO.md` §0(b), et redit à l'écran sous le
bouton pour que la question ne se repose pas à chaque fois.

---

## 26. Une clé posée branche l'IA — et l'application dit laquelle

**Décidé le 2026-08-06**, après une journée perdue sur une question sans
réponse : « les clés sont mises, pourquoi l'IA n'est-elle pas branchée ? »

### Ce qui s'est passé

Le patron avait enregistré ses clés Anthropic et OpenAI. L'application
continuait de recopier sa dictée mot à mot. **Trois causes se cumulaient**, et
la véritable difficulté n'était aucune des trois : c'est qu'aucune n'était
visible. Ni l'écran, ni le démarrage, ni aucune commande ne disait quel
fournisseur tournait réellement. Reconstituer la réponse a demandé la lecture de
quatre fichiers du dépôt.

| Cause | Pourquoi elle était invisible |
|---|---|
| `LLM_PROVIDER` valait `dev` par défaut | poser une clé ne changeait rien, et rien ne le disait |
| Le conteneur écrivait `dev` en dur, sans transmettre les clés | un secret d'espace vit côté hôte ; le conteneur ne voit que ce qui est listé |
| `openai.ts` n'était qu'une ébauche | son « non implémenté » ressortait en devis recopié mot à mot |

### Ce qui est décidé

**1. La présence d'une clé décide du fournisseur.** `ANTHROPIC_API_KEY` branche
la rédaction, `OPENAI_API_KEY` la transcription — Anthropic ne prend pas
d'audio. La variable explicite reste souveraine : `LLM_PROVIDER=dev` coupe l'IA
sans qu'il faille retirer les clés, ce dont on a besoin pour rejouer un parcours
sans qu'une donnée d'essai ne sorte.

*Conséquence à comprendre : la protection ne repose plus sur une valeur par
défaut, mais sur l'absence de clé* (`docs/RGPD.md` §3). D'où le retrait
systématique des clés d'IA dans `scripts/verifier-avant-livraison.ts` — une
batterie lancée dans l'espace du patron enverrait sinon les dictées d'essai chez
les fournisseurs, et les lui ferait payer.

**2. Une variable vide vaut une variable absente.** `optionnel()` dans
`src/server/env.ts`, et rien d'autre ne lit une variable optionnelle. Le
conteneur transmet `${ANTHROPIC_API_KEY:-}` : sans ce garde-fou, une clé
inexistante se présentait comme renseignée. Le nom du fournisseur est ramené en
minuscules pour la même raison — `LLM_PROVIDER=Anthropic` retombait en mode
déterministe sans un mot.

**3. Une ébauche ne se fait jamais passer pour un fournisseur.** Soit elle est
implémentée — ce qu'est devenu `openai.ts` —, soit elle est **refusée à la
configuration**, pas au premier appui du patron sur un bouton.

**4. L'état se lit à trois endroits, et c'est délibéré.** `decrireEtatIA()`
(`src/lib/etat-ia.ts`) est la **seule** source ; l'écran Réglages, le bandeau de
démarrage et `npm run verifier:ia` la présentent. Une seconde description a
existé quelques heures, écrite en parallèle d'une autre session : deux avis sur
la même configuration auraient fini par se contredire, et c'est celui qu'on
relit le moins qui serait resté faux (`CLAUDE.md` §3). Elle a été fondue dans
celle-ci. Seuls les **noms** des variables renseignées y entrent, jamais leurs
valeurs — ces états s'affichent et se recopient dans des captures.

**5. Les fournisseurs s'éprouvent sans clé et sans facture.**
`ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` existent pour qu'une suite lance un
serveur local et vérifie ce qui part vraiment : la clé dans le bon en-tête, le
texte dicté dans le corps, l'appel d'outil relu correctement — sa forme diffère
d'un fournisseur à l'autre, objet chez l'un, texte JSON chez l'autre.

**6. Le fichier de clés est écrit d'avance, et son chargement a une seule
règle.** « Créez un fichier `.env.local` à la racine » n'a pas été compris — et
c'était une consigne mal posée. `demarrer.sh` l'écrit donc vide au premier
démarrage, une ligne par clé. Conséquence immédiate, et qui aurait tout cassé :
charger ce modèle vide par `. .env.local` **écrase** les clés venues des secrets
de la plateforme. `.devcontainer/charger-cles.sh` porte donc la règle unique —
rien de vide n'est exporté, ce qui existe déjà l'emporte — et `demarrer.sh`
comme `verifier:ia` l'appellent tous les deux plutôt que d'en réécrire une
variante.

**7. Un correctif livré une fois ne demande pas deux redémarrages.**
`demarrer.sh` récupère le code neuf puis continuait de s'exécuter dans sa
version ancienne : tout ce qu'un lot change au démarrage n'entrait en vigueur
qu'au démarrage suivant. Le patron aurait redémarré, n'aurait rien vu changer,
et conclu — encore une fois — que le correctif ne marche pas. Après une mise à
jour effective, le script se rejoue donc dans sa version neuve, **une fois et
une seule** (`ATLAS_DEMARRAGE_RELANCE`). Éprouvé sur de vrais dépôts git par
`scripts/test-relance-demarrage.ts`, garde-fou anti-boucle compris.

### Ce que ça ne prouve pas

Qu'une **vraie** clé fonctionne chez le vrai fournisseur. Cela ne s'éprouve
qu'avec une clé : `npm run verifier:ia -- --reseau`. Ce qui a été vérifié ici,
sans clé, c'est que l'appel part réellement chez Anthropic et que son refus est
correctement interprété — `api.openai.com` est, lui, injoignable depuis cet
environnement, et cette moitié-là n'a été éprouvée que contre un serveur local.

---

## 27. La facture parvient au client, par le même chemin que le devis

**Décidé le 2026-08-06**, sur un constat du patron : « la facture s'affiche
partie, mais le client ne la reçoit pas ».

### Ce qui s'est passé

Il arrête sa facture. L'écran répond « Facture F2026-0001 arrêtée » — exact
comptablement — puis ne dit plus rien. **Rien ne portait la facture jusqu'au
client** : ni lien, ni message, ni moyen. Le devis avait ce chemin depuis des
semaines ; la facture n'en avait aucun, et l'écran laissait croire le contraire.

### Ce qui est décidé

**1. Le même mécanisme que le devis, en plus simple.** Une table
`envois_factures` (migration `0024`), un jeton de 256 bits, une lecture RLS
limitée à ce jeton exact, une page publique `/factures/[jeton]` et le PDF
**archivé** servi tel quel. Pas de dates proposées, pas de réponse, pas
d'acceptation à tracer : une facture ne se négocie pas.

**2. Une page, pas un PDF nu.** Un lien qui ouvre directement un PDF sur un
téléphone ne dit ni de qui il vient, ni ce qu'il faut en faire — et un lien
périmé y répond par une erreur brute. Le client reconnaît d'abord sa facture,
puis la télécharge.

**3. « Arrêtée » n'est pas « partie », et l'écran le dit.** Tant que rien n'a été
transmis, la facture annonce « votre client ne l'a pas encore reçue ». Le jalon
`facture_envoyee_at` suit l'ENVOI, jamais l'arrêt comptable — c'est la
distinction que le patron avait relevée.

**4. Atlas prépare, le patron expédie.** Aucun prestataire de SMS ni d'e-mail
n'est raccordé, et il a été tranché qu'il n'y en aurait pas (`docs/A-FAIRE.md`
§5). Le message part de sa messagerie, comme pour le devis, et rien ne quitte
l'application sans son geste.

### Ce que ça ne résout pas

Atlas ne sait pas que le message est parti, ni quand : il sait seulement qu'un
lien a été préparé. Pas de relance automatique à échéance, donc — la même limite
que pour le devis, et pour la même raison.

---

## 28. L'adresse se propose, sans confier les clients à Google

**Décidé le 2026-08-07**, à la demande du patron : *« comme quand on passe une
commande — on commence à taper l'adresse et il nous propose tout un tas de
listes, et plus on écrit, plus l'adresse se réduit ; ensuite il n'y a plus qu'à
cliquer sur notre adresse et ça la valide. »*

### La source : l'État, pas Google

C'est la décision qui compte, et elle n'est pas technique.

| | Google Places | Base Adresse Nationale |
|---|---|---|
| Compte, clé, carte bancaire | oui | **non** |
| Coût | payant au volume | **gratuit** |
| Sous-traitant à nommer au contrat | **oui** | non — service public français |
| Où partent les adresses des clients | hors UE | **France** |

Retenir Google aurait ajouté un sous-traitant ultérieur à faire autoriser par
l'artisan et relire par un juriste : précisément le contrat qui bloque déjà tout
(`docs/A-FAIRE.md` point 2). Pour une commodité de saisie, le prix était
absurde.

### Ce qui part, et ce qui ne part pas

**Uniquement la rue en cours de frappe.** Ni le nom du client, ni le chantier,
ni rien qui permette de rattacher l'adresse à quelqu'un.
`scripts/test-recherche-adresse.ts` vérifie qu'aucun autre paramètre ne s'ajoute
à la requête — sans ce contrôle, la phrase ci-dessus serait rassurante plutôt
que vraie.

**La requête part du serveur d'Atlas, jamais du navigateur.** Deux raisons, et
la première n'est pas contournable : la politique de sécurité interdit à un
écran de joindre un hôte extérieur (`connect-src 'self'`). Ce n'est pas une gêne
à contourner, c'est ce qui garantit qu'aucun écran ne peut envoyer quoi que ce
soit ailleurs sans qu'on l'ait décidé. La seconde : un seul endroit à lire, à
limiter et à couper, plutôt qu'autant de téléphones qu'il y a d'utilisateurs.

### Le champ reste libre — ce n'est pas un détail

Un lieu-dit, un chemin de campagne, « derrière la scierie » ne figurent dans
aucune base. **C'est là que le patron travaille.** Une liste qui l'enfermerait
dans ce que la base connaît serait une régression, pas une aide. De même, une
panne du service laisse un champ ordinaire : le chantier se crée quand même,
sans message rouge.

### Ce qu'on peut éprouver ici, et ce qu'il faut éprouver ailleurs

Le mandataire réseau de l'environnement de développement refuse
`api-adresse.data.gouv.fr`. La vérification est donc coupée en deux :

| Où | Quoi | Fichier |
|---|---|---|
| Ici | ce qu'Atlas retient d'une réponse — illisible, tronquée, en double | `scripts/test-suggestions-adresse.ts` |
| Ici | l'appel face à un service qui répond, répond mal, ou ne répond pas | `scripts/test-recherche-adresse.ts` |
| Ici | le geste entier dans un navigateur | `scripts/test-adresse-suggestions-e2e.ts` |
| **Ailleurs** | le VRAI service rend-il encore ce qu'on croit ? | `.github/workflows/adresses.yml` |

La dernière ligne n'est pas un luxe : si le service changeait de format, l'aide
s'éteindrait **sans un mot** — la liste resterait simplement vide, ce qui
ressemble à « aucune adresse ne correspond ». Le patron chercherait longtemps.

### Ce que ça ne résout pas

L'adresse arrive sur une seule ligne, telle que la base la rend. Le jour où un
document exigera le code postal et la commune séparés — une déclaration, un
format d'export comptable — il faudra les redemander à la base, qui les fournit
déjà (`postcode`, `city`). Rien n'est perdu, mais rien n'est stocké non plus.

---

## 29. Le devis se découpe en lignes vendables, et la fente a sa grille

**Décidé les 2026-08-07 et 2026-08-08**, après trois signalements du même défaut
par le patron — dont un où il a dû rappeler qu'on l'avait déjà diagnostiqué la
veille sans le corriger : *« on avait déjà travaillé sur ce défaut-là hier et je
croyais que tu l'avais corrigé. »*

### Ce qui était faux, en une ligne de code

`prestations.map((p) => p.libelle).join(" ; ")`, à deux endroits de
`src/server/chiffrage/proposition-prix.ts`. Tout ce qu'il dictait arrivait sur
**une seule ligne** du devis, collé par des points-virgules — et un client qui
ne veut qu'une partie du chantier ne pouvait rien refuser.

### La règle, dans ses mots

*« L'abattage, le broyage et l'évacuation, c'est sur une ligne, et la fente, ça
doit être séparé. »*

Et le pourquoi, qui ne se devine pas : *« si le client ne veut pas la fente, il
va trouver le reste cher ; et s'il fait faire le reste par un autre artisan et
qu'il nous prend juste pour la fente, 100 € ce n'est pas assez cher. »*

**Une ligne de devis n'est pas une rubrique comptable : c'est une chose que le
client peut accepter ou refuser seule.** Ce qu'il ne peut pas détacher n'a
aucune raison d'occuper sa propre ligne ; ce qu'il peut détacher doit porter son
propre déplacement. D'où sa répartition : **850 + 250**, et non 1 000 + 100.

La règle vit dans `src/lib/lignes-vendables.ts` — pure, éprouvée sur ses dictées
réelles — et non dans un service. Elle est aussi inscrite dans `termes_metier`
(migrations 0025 et 0026), pour que le modèle qui LIT la dictée la connaisse
autant que le code qui écrit le devis. Les deux se corrigent ensemble.

### Le billonnage ne fait pas de ligne

*« Le devis compte trois lignes, pas quatre : le billonnage est compris dans
l'abattage »* (`docs/EXEMPLE-DICTEE.md`, 5 août). Tronçonner le tronc d'un arbre
qu'on vient d'abattre n'est pas détachable — c'est la fin du geste d'abattre.

Deux précautions, apprises de ce qui a déjà mal tourné :

- **sans abattage dicté, le billonnage reste** : billonner du bois déjà à terre
  est un vrai chantier, et le faire disparaître produirait le devis vide du
  7 août ;
- **ce qui est absorbé est signalé** dans le détail du chiffrage. Une prestation
  qui s'évapore sans un mot est exactement ce qui lui a fait perdre « on le
  coupe en 50, on le fend ».

### La grille de fendage : hauteur × diamètre, 48 cases

*« Pour la fente, ils devraient demander la hauteur de l'arbre et son diamètre,
et on crée une liste de prix en fonction de la hauteur et du diamètre, comme ça
il n'invente rien. »* Puis, sur une première grille à 3 × 3 : *« par contre il
faut faire plus de tranche. »*

|  | Tranches | Pourquoi ce découpage |
|---|---|---|
| Diamètre | 8 : ≤20, 20-30, 30-40, 40-50, 50-60, 60-70, 70-90, >90 | serré là où se trouve l'essentiel de ce qui s'abat chez un particulier ; la charnière de 70 cm vient de son dossier du 5 août |
| Hauteur | 6 : ≤5, 5-10, 10-15, 15-20, 20-25, >25 | cinq mètres est la maille qu'un élagueur estime à l'œil, sans mesurer |

**Les bornes hautes sont incluses** : un tronc de 50 cm est « 40 à 50 », pas
« 50 à 60 ». Les valeurs rondes — 40, 50, 60 — sont précisément celles qu'un
artisan annonce ; se tromper de côté déplacerait la majorité des cas.

**Ce qu'on ne fait jamais : interpoler.** Une case vide entourée de cases
pleines pourrait « se deviner ». Un prix deviné se présenterait avec l'autorité
des voisins, et il n'aurait aucun moyen de voir qu'il n'a jamais été décidé. La
case vide reste vide, la ligne s'écrit à 0 € — visible comme un prix à poser — et
la raison est dite, en nommant la case.

### Elle se remplit toute seule

Une grille de 48 cases qu'il devrait remplir avant de s'en servir ne serait
jamais remplie : il a un métier, et ce n'est pas celui-là. Deux entrées, donc :

| Origine | Qui écrit | L'emporte sur |
|---|---|---|
| `saisi` | lui, dans `Réglages → Mes prix pour fendre le bois` | tout |
| `devis` | un prix de fente écrit sur un vrai devis | une observation plus ancienne, jamais une saisie |

C'est sa propre idée : *« le mieux, c'est que je fasse plein de devis et que tu
enregistres toutes mes modifications, et dans un mois tu sauras les remplir tout
seul. »*

### Par entreprise, contrairement au vocabulaire

`termes_metier` est partagé — ce sont des mots, ils partent avec l'application
chez tous les artisans (`docs/QUESTIONS.md` §10). `grille_fendage` ne l'est pas :
ce sont des **prix de vente**, et les partager reviendrait à donner ses tarifs à
ses concurrents. RLS `FORCE`, comme le reste.

### Le piège qu'il a fallu désamorcer : deux lectures du même texte

La question « quelle hauteur fait l'arbre ? » ne se pose que si la dictée ne la
donne pas. Le chiffrage, lui, doit retrouver cette hauteur pour désigner la case.
**Si l'un lisait moins que l'autre, la question serait tue ET la case
introuvable** — la fente n'aurait jamais de prix, sans qu'aucune erreur ne le
signale.

Or la table `prestations` ne garde qu'un libellé : « vingt mètres de haut »,
dicté dans la *description*, y disparaît. Le chiffrage relit donc les lignes du
brouillon confirmé, descriptions comprises, et les deux passent par le même
module — `src/lib/mesures-arbre.ts`. Les formulations écrites sur le devis
(« ⌀ 45 cm », « 12 m de haut ») sont celles que ce module sait relire, et un
contrôle le vérifie.

### Ce qui a été supprimé au passage

`appliquerProposition`, dans `proposition-prix.ts` : une **seconde** écriture de
la proposition au détail, exportée et appelée par personne. Elle ignorait le
contrôle de doublon, et n'aurait pas su écrire deux lignes. Deux implémentations
d'une même règle divergent toujours (`CLAUDE.md` §3) — celle-ci avait déjà
commencé.

### Où c'est éprouvé

| Quoi | Fichier |
|---|---|
| Le découpage et la répartition, sans base | `scripts/test-lignes-vendables.ts` |
| Les tranches, les bornes, l'absence d'interpolation | `scripts/test-grille-fendage.ts` |
| Les questions posées — et surtout celles qui se taisent | `scripts/test-questions-chiffrage.ts` |
| Le chemin complet : tarif → découpage → grille → détail, et l'isolation | `scripts/test-devis-fendage.ts` |

### Une batterie qui ne finit pas ne prouve rien

Trouvé le 8 août 2026 en voulant simplement jouer `npm test` avant de livrer.

`test-ia-03-propositions.ts` affichait « 8 test(s) réussi(s), 0 échoué(s) » puis
ne rendait **jamais** la main : le limiteur de débit avait ouvert une connexion
Redis que personne ne fermait. La batterie s'arrêtait là — sans un mot, sans
rouge — et les cinquante suites suivantes n'étaient jamais jouées.

**Pourquoi la CI ne l'a jamais vu :** son étape `npm test` ne posait pas
`REDIS_URL`, alors que `CLAUDE.md` §5 la demande en local. La CI ne jouait donc
pas ce que le dépôt dit de jouer. C'est le même piège que les contrôles qui
interrogeaient `127.0.0.1` pendant que le patron passait par un proxy (`CLAUDE.md`
§5) : **un environnement de vérification qui diffère de l'environnement réel ne
vérifie pas ce qu'on croit.**

| Correction | Ce qu'elle empêche de revenir |
|---|---|
| `fermerLimiteur()`, appelé en fin des neuf suites qui traversent une action limitée | la connexion oubliée |
| `REDIS_URL` posé sur l'étape `npm test` de la CI | l'écart entre ce qui est documenté et ce qui est joué |
| Le lanceur tue toute suite muette depuis huit minutes, **en nommant la vraie cause** | qu'un blocage repasse pour un silence normal |

Le troisième point est le seul qui protège contre la **prochaine** fuite, quelle
qu'en soit la source. Il a été éprouvé contre une suite volontairement bloquée —
il la voit — et contre une suite saine — il ne se déclenche pas. Un garde-fou
jamais vu rouge ne prouve rien (`AGENTS.md`).

**Et la première suite ne paie plus pour toutes les autres.** Même jour, même
sorte de défaut : `test-adresse-suggestions-e2e` échouait en batterie et passait
seule. Elle passe la première dans l'ordre alphabétique, et attendait donc la
compilation à la demande de `/login`, de l'accueil ET de la fiche de chantier —
son message accusait alors l'adresse, qui n'y était pour rien. Le lanceur
préchauffe désormais les écrans les plus traversés avant de lancer quoi que ce
soit. Répondre sur `/api/health/live` ne suffisait pas : cette route-là est
minuscule et se compile en quelques centaines de millisecondes, quand un écran
réel en demande des dizaines de secondes.

---

## 30. Deux horizons pour une date : le sien, et celui du client

**Décidé le 2026-08-08**, sur un défaut que le patron a vu venir avant qu'il ne
lui coûte quoi que ce soit : *« la proposition des dates au client, on a une
visibilité que sur une semaine. Comment je fais si je dois lui proposer une date
dans six mois ? »* — et il ajoutait : *« c'est un problème qui va se produire à
coup sûr. »*

### Ce qui manquait

L'écran suggérait les six prochains jours ouvrés, et **aucune autre porte
n'existait**. Le calcul des jours libres était juste, la base acceptait
n'importe quelle date, la page du client fonctionnait — il n'y avait simplement
pas de geste. Un défaut invisible depuis le code, visible en deux secondes sur
l'écran.

### La décision : deux horizons, jamais un seul

|  | Portée | Pourquoi |
|---|---|---|
| **Le patron** (`fenetrePatron`) | après-demain → **18 mois** | l'élagage est saisonnier : une haie « à la fin de l'hiver prochain » demande quatorze mois. Douze le renverraient au téléphone |
| **Le client** (`bandesVisibles`) | 3 mois, **ou** trois semaines autour d'une date lointaine | la page publique reçoit la liste des jours occupés. Lui donner dix-huit mois, c'est lui donner le carnet de commandes |

Les confondre coûte cher **dans les deux sens**, et un contrôle veille sur
l'écart (`test-fenetre-lointaine.ts`).

### Enveloppe et bandes : la nuance qui protège le planning

Une première version ne connaissait qu'une fenêtre, et le cas mixte l'a montrée
fausse : « soit jeudi, soit à la Toussaint » l'étirait sur six mois — et livrait
six mois de jours occupés au client, ce que tout ce mécanisme sert à éviter.

D'où la séparation :

- l'**enveloppe** (`fenetrePourDates`) dit ce qui est **recevable**. Elle court
  bien de jeudi à la Toussaint : les deux dates doivent rester retenables ;
- les **bandes** (`bandesVisibles`) disent ce qui se **montre**. Deux blocs, et
  le semestre du milieu ne regarde pas le client.

Une date lointaine **seule** ne rouvre pas les trois prochains mois : s'il ne
propose que la Toussaint, montrer octobre inviterait à une contre-proposition
qu'il n'a pas voulue.

### La fenêtre s'ancre à l'ENVOI, plus à aujourd'hui

Défaut latent que personne n'avait signalé, et que la date lointaine rendait
certain : la fenêtre était recalculée à chaque ouverture du lien, depuis la date
du jour. Un devis parti un lundi et ouvert trois semaines plus tard n'offrait
plus les mêmes jours ; une date à six mois en serait carrément sortie, et le
client aurait lu **« date indisponible » sur la date qu'on venait de lui
proposer**.

L'ancre est `envoye_at`, posé explicitement à la création plutôt que laissé au
`now()` de la base. Avec `dates_proposees`, tous deux immuables, la fenêtre se
recalcule à l'identique — **sans colonne de plus**. Réserve assumée : changer la
règle des bandes déplacerait ce que voient les liens déjà partis. C'est le prix
d'une seule source de vérité, plus faible que celui de deux qui divergent
(`CLAUDE.md` §3).

Trois barrières se dressaient sur ce chemin, toutes calées sur la même fenêtre
glissante : la création de l'envoi, la lecture du lien, et **la revérification
de la réponse** — la plus coûteuse, celle qui aurait perdu le devis à l'instant
où le client disait oui.

### L'année s'affiche quand ce n'est pas la nôtre

« Lundi 8 février » ne désigne plus rien quand on peut proposer à dix-huit
mois : février prochain, ou celui d'après ? Le patron enverrait une date à un an
d'écart de ce qu'il croit. `jourLisible` ajoute donc le millésime — et lui seul,
pour ne pas alourdir les quatre-vingt-dix-neuf devis sur cent qui parlent de la
semaine prochaine.

### Où c'est éprouvé

| Quoi | Fichier |
|---|---|
| Les deux horizons, les bandes, le cas mixte — sans base | `scripts/test-fenetre-lointaine.ts` |
| Le parcours complet : création, lecture, acceptation, planification | `scripts/test-envois-devis.ts` |
| **Que le geste existe à l'écran**, et que le client reçoit la date | `scripts/test-date-lointaine-e2e.ts` |

---

## 31. Reprendre une liste de prix déjà écrite ailleurs

**Décidé le 2026-08-08**, à sa demande : *« si l'utilisateur a déjà un fichier
Excel ou un PDF avec ces lignes de prix, il doit pouvoir le rentrer dans la
catégorie réglages via une touche, et que les prix s'ajoutent
automatiquement. »*

### « Automatiquement » s'arrête avant l'écriture

Le fichier est lu, et l'écran montre **ce qui serait fait** : ce qui s'ajoute,
ce qui change — l'ancien prix barré à côté du nouveau —, ce qui est déjà là, et
ce qui n'a pas été compris. Rien n'est enregistré avant son appui.

Ce n'est pas de la prudence de principe. Ces tarifs commandent le prix de ses
devis : un fichier mal lu écraserait sa grille sans qu'il l'ait vu passer, et il
ne le découvrirait que sur un devis déjà parti. Deux actions séparées portent
cette garantie — `analyserFichierTarifsAction` **n'écrit rien**,
`appliquerImportTarifsAction` écrit ce qu'il a validé — et un contrôle vérifie
en base que déposer un fichier ne change aucun tarif.

### Sans aucune dépendance, y compris pour Excel

Un `.xlsx` est un ZIP de fichiers XML. On en ouvre deux —
`xl/worksheets/sheet1.xml` et `xl/sharedStrings.xml` — avec le `zlib` de Node.
Même raisonnement que l'archive ZIP de la sauvegarde (§25) : embarquer une
bibliothèque qui lit *tout* le format Office — formules, macros, styles, images
— pour en tirer trois colonnes serait une surface d'attaque considérable en
échange de rien.

Ce qu'on lit : le **résultat** des formules (`<v>`), c'est-à-dire ce que le
patron voit à l'écran. Ce qu'on ne lit pas : les styles, les autres feuilles, et
rien d'exécutable.

### Ce qui a été appris des vraies feuilles

| Le piège | Ce qu'il aurait coûté |
|---|---|
| Le BOM d'Excel colle à la première cellule | l'en-tête « Intitulé » n'est plus reconnu, et personne ne voit pourquoi |
| Le séparateur est un `;`, la virgule décime | « 400,00 » lu comme deux colonnes |
| Un CSV en Latin-1 (vieux Excel français) | « Élagage » devient « �lagage » |
| Excel coupe un texte en plusieurs `<t>` | « Main d'œuvre » revient en « Main d' » |
| Une cellule vide au milieu d'une ligne | les colonnes glissent, les prix passent dans les désignations |
| Une colonne de numéros d'article en tête | « 1 » et « 2 » sont d'excellents montants — d'où le choix de la **dernière** colonne la plus riche en nombres, pas la première |
| Une ligne de titre (« ABATTAGE »), un « sur devis » | un tarif à 0 €, qui se proposerait ensuite comme « gratuit » |
| Le même intitulé deux fois | deux tarifs concurrents, et le chiffrage qui s'arrête à chaque chantier |

**Rien n'est deviné, et tout ce qui est écarté est dit** — ligne par ligne, avec
sa raison. Une ligne qui disparaît sans un mot ferait croire à un import
complet, et le manque ne se verrait que sur un devis.

### Le PDF est refusé, et le refus porte la sortie

Un PDF n'est pas un tableau : c'est une **image** de tableau. Les colonnes n'y
existent plus, seulement des morceaux de texte posés à des coordonnées, souvent
avec un encodage propre au document. On peut deviner ; deviner un prix est
exactement ce que ce produit ne fait jamais (`docs/AGENT.md` §3).

Le message dit donc quoi faire : *« Ouvrez la liste dans Excel puis Enregistrer
sous → CSV »*. Un refus sans issue renvoie le patron à sa saisie manuelle sans
qu'il sache pourquoi. La reprise par le modèle reste ouverte — `TODO.md`
§0 sexies.

### Où c'est éprouvé

| Quoi | Fichier |
|---|---|
| Les montants, les colonnes, le rapprochement — sans base | `scripts/test-import-tarifs.ts` |
| Que lire n'écrit rien, et que l'import d'une entreprise ne déborde pas | `scripts/test-import-tarifs-db.ts` |
| **Que la touche existe**, et que rien n'entre avant son appui | `scripts/test-import-tarifs-e2e.ts` |
