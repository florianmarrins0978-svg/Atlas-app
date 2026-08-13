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
| Les tranches, les bornes, l'absence d'interpolation | `scripts/test-grille-prix.ts` |
| Les questions posées — et surtout celles qui se taisent | `scripts/test-questions-chiffrage.ts` |
| Le chemin complet : tarif → découpage → grille → détail, et l'isolation | `scripts/test-devis-grilles.ts` |

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


---

## 32. Trois grilles, et le chiffrage bascule au poste

**Décidé le 2026-08-08 au soir**, par ses réponses à trois questions posées avec
leurs options :

| Question | Sa réponse |
|---|---|
| Les 8 × 6 tranches de la grille de fendage vous vont ? | **oui, on garde** |
| La taille de haie doit-elle avoir sa propre ligne ? | **oui — grille au mètre linéaire** |
| L'abattage mérite-t-il la même grille ? | **oui — technique × diamètre** |
| Faut-il lire les PDF de listes de prix ? | **non, le tableur suffit** |

### Une table, trois natures

`grille_fendage` ne connaissait que la fente, jusque dans son nom. La migration
0027 la renomme `grille_prix` et lui ajoute une colonne `nature` :

| Nature | Axes | Cases | Pourquoi ces axes |
|---|---|---|---|
| `abattage` | technique × diamètre | 24 | chez lui le même chêne vaut 600, 1 000 ou 1 400 € selon la technique. La hauteur ne décide de rien |
| `fendage` | hauteur × diamètre | 48 | on fend du VOLUME, et le volume va comme le diamètre au carré fois la hauteur |
| `haie` | aucun — un prix au ml | 1 | son devis dit « 350 € pour 20 ml », sans hauteur. Inventer une seconde dimension ferait quarante cases vides |

Trois tables auraient imposé trois écrans, trois dépôts et trois façons de se
tromper. Une colonne suffit, et la mécanique reste unique : c'est elle qui
garantit qu'aucune case ne s'invente, quelle que soit la nature.

### La bascule : au temps, ou au poste

C'est la décision de conception de ce lot, et elle vient de ses deux façons de
chiffrer.

- **Au temps** — « deux hommes, une journée » : le tarif au jour/homme donne le
  total, chaque ligne détachable prend son prix de grille, et la principale
  garde le reste. Sa règle du 7 août : **850 + 250**, jamais 1 000 + 100.
- **Au poste** — son devis du 5 août : haie 350 €, abattage 600 €, fendage
  300 €, total 1 250 €. Aucun tarif journalier là-dedans.

**La règle qui les départage tient en une phrase : dès que la ligne PRINCIPALE a
un prix dans sa grille, le total devient la somme des postes.** Autrement dit,
le jour où il a posé ses prix d'abattage, sa grille prend la main sur le tarif
journalier — et l'écran le dit (« Chiffré poste par poste »), parce qu'un total
qui change de méthode sans un mot se lit comme une erreur.

**Sans grille d'abattage, rien ne bouge, et en silence.** L'absence n'est pas
signalée comme un manque : c'est le fonctionnement d'hier, et le rappeler à
chaque devis ferait du bruit pour rien.

### La haie s'apprend au mètre, jamais au montant

Quand il écrit 350 € sur une ligne de haie de 20 ml, c'est **17,50 €/ml** qui se
range dans la grille. Retenir 350 € ferait facturer 350 € la haie suivante,
quelle que soit sa longueur — et personne ne verrait d'où vient le chiffre.
Sans longueur connue, **on n'apprend rien** plutôt qu'un prix faux.

### Ce que la répartition est devenue

`repartir` prend désormais N lignes au lieu de deux : la principale, la haie, la
fente. Elle reste pure et éprouvée à part (`scripts/test-lignes-vendables.ts`) —
c'est elle qui encode sa règle du 850 + 250, et la sortir du service est ce qui
permet de la discuter sans lire une requête.

### Où c'est éprouvé

| Quoi | Fichier |
|---|---|
| Le découpage en trois lignes, la répartition à N | `scripts/test-lignes-vendables.ts` |
| Les tranches, les techniques, la case unique de la haie | `scripts/test-grille-prix.ts` |
| **Son devis du 5 août, ligne par ligne**, et la bascule au poste | `scripts/test-devis-grilles.ts` |
| Les trois grilles à l'écran, dans un téléphone | `scripts/test-grille-prix-e2e.ts` |

---

## 33. Un chantier, un seul onglet — et le planning mène quelque part

**Le patron, le 8 août 2026 :** *« lorsque le client m'avait retourné la date
validée, il se range dans les chantiers planifiés, mais comment moi je fais pour
avoir accès au devis ? Je dois pouvoir cliquer directement sur le client qui est
planifié, avoir un bouton à côté fin de chantier pour que ça crée
automatiquement la facturation, puis l'envoi de la facturation, puis
l'automatisation vers la TVA. Toute cette branche-là n'est pas faite. »*

### Ce qui était vrai, et ce qui ne l'était pas

**La chaîne était construite.** Facture bâtie depuis le devis, arrêt 3, émission,
relevé de TVA, message tout prêt : tout existait et fonctionnait, éprouvé par
`test-facture-e2e.ts`.

**Et elle était injoignable depuis là où il se trouvait.** Sur le planning,
toucher un chantier planifié n'ouvrait qu'un sélecteur de date. Ni le devis, ni
la fiche, ni la clôture. La clôture n'était atteignable que par la fiche du
chantier — dont aucun lien ne partait du planning — ou par l'onglet Terminés,
où un chantier n'entre qu'une fois sa date passée.

**Une chaîne qu'on ne peut pas atteindre vaut une chaîne qu'on n'a pas écrite.**
De son côté de l'écran, il avait raison, et répondre « c'est déjà fait » aurait
été exact et inutile.

### La carte du planning, désormais

Trois destinations, une seule mise en avant :

| Geste | Où il mène | Pourquoi |
|---|---|---|
| La carte (date, nom, client) | La fiche du chantier | De là partent le devis, les photos, le prix — tout ce qu'il cherchait |
| **Fin de chantier** | L'écran facture | Sa demande, mot pour mot. Aucune barrière de date : c'est lui qui sait quand un chantier est fait |
| Changer la date | Le sélecteur, comme avant | Le geste le plus rare des trois une fois le client d'accord — donc le plus discret |

Le mot « Voir le devis et le chantier → » est porté par la carte. Sans lui, rien
ne disait qu'elle s'ouvrait : il cherchait son devis sur un écran qui n'avait
l'air de mener nulle part.

### La cause commune : une règle écrite trois fois

`src/lib/onglet-chantier.ts` existait depuis le 6 août et disait juste. Mais
**seul l'écran Chantiers l'appelait**. Le planning comparait
`datePlanifiee < aujourd'hui` dans son composant ; le dépôt des terminés
comparait `date_planifiee <= aujourd'hui` en SQL. Deux recopies, un signe
d'écart, et deux défauts observés à l'écran :

| Défaut | Ce que voyait le patron |
|---|---|
| Un chantier prévu **aujourd'hui** | Affiché au planning **et** dans les terminés |
| Un chantier **clôturé avant sa date** | Toujours au planning comme si de rien n'était, absent des terminés, et **sa facture en brouillon joignable seulement par son adresse** |

Le second comptait double : clôturer un chantier plus tôt que prévu est un geste
délibérément autorisé depuis le 3 août, et il faisait disparaître la facture.

**Ce qui a changé structurellement.** Un seul cœur, `rangement()`, et deux portes
selon la donnée dont on dispose :

- `ongletDuChantier(statut, date)` — pour les écrans, qui ont le statut affiché ;
- `ongletDepuisJalons(date, termineAt, factureEnvoyeeAt)` — pour les dépôts, qui
  ont les jalons datés. Leur faire dériver le statut aurait été la troisième
  recopie.
- `estAuPlanning(...)` — **le filtre du planning, sorti du composant.** C'est le
  vrai correctif : tant qu'il vivait dans l'écran, aucun contrôle ne pouvait
  constater qu'il contredisait la règle.

Le SQL des terminés ne garde qu'un filtre de **volume** — un sur-ensemble sûr.
Élargir y est sans danger ; restreindre serait reprendre la règle.

### Ce que les contrôles d'avant ne pouvaient pas voir

`test-onglet-chantier.ts` éprouvait la fonction pure, qui était juste, pendant
que les écrans en appliquaient une copie fautive à côté. Son dernier cas
vérifiait que l'onglet rendu figurait parmi trois chaînes — une tautologie, verte
quoi qu'il arrive.

**Un contrôle qui ne peut pas atteindre le code qui décide ne prouve rien.** Il
compte désormais les onglets qui retiennent chaque état, et les compare à
l'onglet **attendu**, écrit à la main : trois fonctions qui se trompent ensemble
restent cohérentes entre elles.

Et `test-planning-vers-facture-e2e.ts` lit **les trois écrans** dans un vrai
navigateur : c'est le seul contrôle capable de voir un écran réinventer la règle
dans son coin. Sur le code d'avant, 4 de ses 7 cas rougissent.

### Un contrôle qui mesure, parce qu'un contrôle qui lit serait vert

Dernier défaut du lot, trouvé sur une capture : à l'arrêt 3, les travaux réunis
d'une même ligne s'affichaient « Abattage d'un chêne mort Br… ». La coupe venait
d'un `truncate`, c'est-à-dire du CSS — **le texte entier restait dans la page**,
et toute assertion sur le contenu passait.

L'écran qui sert à vérifier avant que la facture parte en cachait donc les deux
tiers. Le PDF du client, lui, a toujours respecté les retours à la ligne
(`enLignes` dans `document-commun.ts`).

Le contrôle compare la **hauteur rendue** de la ligne groupée à celle d'une ligne
simple. C'est le seul angle qui rougisse sur l'ancien code.

| Ce qui est tenu | Par quoi |
|---|---|
| Le rangement, état par état, et l'onglet attendu | `scripts/test-onglet-chantier.ts` |
| Le parcours planning → devis → facture → TVA | `scripts/test-planning-vers-facture-e2e.ts` |
| La carte planifiée mène au chantier, la date se change à part | `scripts/test-planning-e2e.ts` |

---

## 34. Le client ne pouvait ni voir sa facture ni télécharger son devis

**Trouvé le 8 août 2026, en cherchant tout autre chose.** Une suite navigateur a
échoué parce que je l'avais lancée, par inadvertance, contre un serveur démarré
sous le **rôle applicatif** au lieu du rôle de test. L'erreur de manipulation a
révélé un défaut de production que rien n'attrapait.

### Ce qui était cassé

| Chemin | Sous `postgres` (les suites) | Sous `atlas_app` (la production) |
|---|---|---|
| La page de la facture, par jeton | s'affiche | **« Ce lien n'est plus valable »** |
| Le PDF de la facture, par jeton | se télécharge | **redirigé vers la même erreur** |
| La page du devis, par jeton | s'affiche | s'affiche |
| **Le PDF du devis, par jeton** | se télécharge | **échoue en silence** |

Toute la branche « envoi de la facture » — celle que le patron demandait le jour
même — était **morte en production**. Et le PDF du devis avec, alors que c'est
le document que son client lit, promis noir sur blanc dans `docs/A-FAIRE.md` §5 :
« il voit son devis, télécharge le PDF s'il le veut ».

### La cause

Deux tables portent une politique de lecture par jeton : `envois_devis` et
`envois_factures`. **Ni `devis` ni `factures` n'en portent** — elles restent
protégées par l'isolation d'entreprise, ce qui est correct.

Retrouver l'envoi avec le jeton marchait donc ; lire le document derrière ne
marchait pas. La fonction rendait `null`, et `null` veut dire « lien inconnu ou
expiré » : le client recevait un message honnête sur un lien parfaitement
valide.

`lireParJeton` (la page du devis) faisait déjà la bonne chose et personne ne
l'avait remarqué : elle **pose le contexte d'entreprise déduit de l'envoi** avant
de lire la suite. Les trois autres fonctions ne le faisaient pas.

### Le correctif, et pourquoi il n'affaiblit pas la RLS

```ts
await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);
```

L'entreprise vient de **l'envoi retrouvé par un jeton secret**, jamais d'une
entrée du client. C'est le motif déjà en place pour le devis, et il respecte
`CLAUDE.md` §4 : on ne contourne pas l'isolation, on établit le contexte auquel
le porteur du jeton a droit. Le contrôle qui le rend défendable vérifie qu'un
jeton d'une entreprise n'ouvre rien chez une autre.

### **Ce qu'il faut retenir, et qui dépasse ce défaut**

> **Les suites navigateur ne peuvent pas voir un défaut d'isolation.**

Elles démarrent leur serveur sous un rôle qui **traverse la RLS**, parce
qu'elles inspectent la base pour vérifier ce qu'elles affirment
(`.github/workflows/ci.yml`). C'est délibéré et nécessaire — et cela veut dire
qu'un chemin public éprouvé *uniquement* au navigateur n'est pas éprouvé du
tout de ce point de vue.

`test-facture-au-client-e2e.ts` parcourait exactement ce chemin, dans un vrai
navigateur, et il était vert depuis le 6 août.

**Règle qui en découle : tout chemin public par jeton doit être éprouvé par une
suite base, sous `atlas_app`.** C'est ce que fait
`scripts/test-facture-jeton-rls.ts` — six cas, dont deux qui rougissent sur le
code d'avant, et un qui vérifie qu'aucune porte n'a été ouverte au passage.

C'est la version la plus coûteuse de la règle de `CLAUDE.md` §5 : un
environnement de vérification qui diffère du vrai ne vérifie pas ce qu'on croit.

---

## 35. Ce qui se détache d'un chantier : la liste est close, et c'est lui qui l'a close

**Sa réponse du 8 août 2026**, à la question laissée ouverte depuis la veille —
« autre chose se détache-t-il : le dessouchage, l'évacuation seule, l'enlèvement
des grumes ? » :

> *« Le dessouchage oui. Et les grumes aussi. »*

**Deux sur trois — et le troisième compte autant que les deux autres.**
L'évacuation seule **ne se détache pas**. Elle reste sur la ligne principale avec
l'abattage et le broyage, comme sur son devis de référence du 5 août. Un
contrôle le tient dans les deux sens (`test-lignes-vendables.ts`), parce qu'un
jour quelqu'un trouvera « logique » de la détacher aussi.

La différence n'est pas de vocabulaire : **une grume a de la valeur**. Le client
peut vouloir la garder, la vendre, ou la faire enlever par un autre. Les
branches broyées, elles, ne se gardent pas — les détacher n'offrirait au client
aucun choix réel.

### Cinq natures, trois formes de grille

| Nature | Ce qui décide le prix | Cases | Forme à l'écran |
|---|---|---|---|
| `abattage` | technique × diamètre | 24 | deux axes, dépliés par technique |
| `grumes` | *(rien — au poids)* | 1 | une case, à la tonne |
| `fendage` | hauteur × diamètre | 48 | deux axes, dépliés par hauteur |
| `dessouchage` | diamètre | 8 | un axe, tout visible |
| `haie` | *(rien — au mètre linéaire)* | 1 | une case |

**Le dessouchage se chiffre au diamètre, et à rien d'autre.** La hauteur de
l'arbre qui n'est plus là ne décide de rien. Il réemploie **les tranches de
l'abattage** : ce sont les mêmes troncs, et deux jeux de tranches pour la même
réalité finiraient par ranger le même chêne dans deux cases (`CLAUDE.md` §3).

### La réserve des grumes, levée en moins de vingt-quatre heures

Le 8 août, le patron avait dit que les grumes se détachent — pas à quoi elles se
chiffrent. La case portait donc un forfait, et **l'écran disait la réserve** :
« Un seul prix pour l'instant. Si vous les facturez au mètre cube ou au voyage,
dites-le et la grille suivra. »

Le 9 août : *« à la tonne. »*

**C'est exactement ce à quoi servait la réserve**, et la raison de l'avoir mise
à l'écran plutôt que dans un commentaire : elle n'existe que si celui qui décide
peut la lire. Cachée dans le code, elle aurait dormi jusqu'à ce qu'un devis
sorte faux.

La case s'appelle maintenant `tonne`, porte un prix unitaire, et se multiplie
par le tonnage lu dans la dictée — même mécanique que la haie au mètre linéaire.

**L'ancienne valeur n'a pas été convertie, elle a été effacée** (migration
0029). Un forfait de 300 € pour un enlèvement n'est pas 300 € la tonne : le
reconduire ferait facturer dix fois trop sur un gros arbre, et sur un devis
parti chez un client. On ne sait pas combien pesait le chantier qui a produit ce
forfait — il n'existe donc aucune conversion honnête. **Une case vide est une
question posée ; une case fausse est un devis faux.**

### Deux détails qui ont failli passer

**Un ordre de reconnaissance, pas une liste.** « Enlèvement des grumes et
dessouchage » est une seule prestation que deux règles reconnaissent. Sans ordre
explicite, elle se rangerait deux fois — et se facturerait deux fois. Le
découpage et l'apprentissage partagent le même ordre, et les deux listes se
corrigent ensemble : ranger un prix dans une case que le chiffrage n'ira pas
chercher revient à ne rien ranger.

**Un libellé visible ne suffit plus à nommer un champ.** « 40 à 50 cm » désigne
désormais deux cases à l'écran : un tronc à fendre, une souche à arracher. Le
nom **accessible** porte donc la grille et la rangée entières. Sans cela, une
personne qui n'utilise pas ses yeux entend cinq fois le même libellé — et le
contrôle navigateur, lui, ne savait plus lequel il visait.

### Un contrôle lourd doit accuser le bon coupable

`test-planning-vers-facture-e2e.ts` bâtit **sept chantiers de bout en bout**,
chacun avec son devis envoyé et son PDF archivé. C'est la suite la plus lourde de
la batterie, et son dernier cas s'exécute sur un serveur de développement déjà
sollicité par une vingtaine d'autres.

Une navigation y a dépassé les 45 secondes par défaut — **deux fois sur cinq
batteries, jamais quand la suite tourne seule**. Mesuré hors batterie, avec la
même base pleine : 333 ms pour cet écran précis. Ce n'est donc pas le code qui
est lent, c'est le montage qui est chargé.

Un contrôle qui rougit là-dessus **accuse à tort**, et une erreur qui envoie
chercher au mauvais endroit coûte plus cher que pas d'erreur du tout
(`AGENTS.md`). D'où une seconde tentative, et un message qui dit que le serveur
n'a pas répondu plutôt que de laisser croire à un défaut d'affichage. Le
garde-fou a été éprouvé contre un serveur arrêté : il rougit, et il nomme la
bonne cause.

| Ce qui est tenu | Par quoi |
|---|---|
| Ce qui se détache, et ce qui ne se détache pas | `scripts/test-lignes-vendables.ts` |
| Les cinq natures, leurs cases, leurs clés | `scripts/test-grille-prix.ts` |
| Les cinq grilles à l'écran, dans un téléphone | `scripts/test-grille-prix-e2e.ts` |

---

## 36. Un calendrier des deux côtés, où les jours pris ne se touchent pas

**Sa demande du 8 août 2026 :** *« passe au calendrier pour le choix des dates à
proposer au client, mais également qu'il ait accès au calendrier pour pouvoir
proposer une date, avec un système pour qu'il n'ait pas accès aux dates déjà
prises par un autre client. »*

### Ce qui existait, et pourquoi ça ne suffisait pas

Les deux écrans employaient le sélecteur du téléphone, `<input type="date">`. Il
accepte une fenêtre (`min`, `max`) — mais **il ne sait pas griser des jours au
milieu**. Le client pouvait donc choisir un mardi déjà pris, et ne l'apprenait
qu'**après coup**, par un message d'erreur.

Ce n'est pas un détail d'affichage : un client qui bute sur un refus rappelle,
ou renonce. Le refus arrivait au pire moment — celui où il venait de décider.

### Le même composant des deux côtés

`src/components/atlas/Calendrier.tsx`, employé par la page du client et par
l'écran d'envoi du patron. Deux calendriers écrits séparément finiraient par ne
pas griser les mêmes jours, et **l'écart se verrait chez le client, jamais
ici** (`CLAUDE.md` §3).

Le composant ne décide de rien : la grille du mois, l'état de chaque jour et la
règle « une ou deux dates, jamais trois » vivent dans `src/lib/calendrier.ts`,
**fonctions pures éprouvées sans navigateur** (`scripts/test-calendrier.ts`,
vingt cas).

### Trois décisions qui ne se devinent pas

**1. Un jour hors fenêtre ne dit PAS qu'il est pris.** L'ordre des raisons dans
`etatDuJour` n'est pas indifférent : un jour à la fois hors fenêtre et occupé se
dit « hors fenêtre ». Dire au client qu'un jour de l'an prochain est « déjà
pris » lui apprendrait quelque chose sur le planning du patron — et sa page ne
reçoit que **des dates, rien d'autre** (`docs/AGENT.md` §2.2 bis).

**2. Un jour déjà retenu se dit « retenu », jamais « occupé ».** Sinon il
s'afficherait barré, et le patron croirait ne plus pouvoir le décocher.

**3. La troisième date chasse la plus ancienne**, elle n'est pas refusée en
silence. Un bouton qui ne répond pas se lit comme une panne : il appuierait
trois fois avant de comprendre.

### Douze mois d'occupation pour lui, trois pour son client

**Sa réponse du 9 août 2026**, à la réserve posée la veille : *« tu peux aller
jusqu'à douze mois d'occupation. »* Son calendrier barre donc ses journées
complètes sur **365 jours** (`HORIZON_OCCUPATION_PATRON_JOURS`).

**À ne surtout pas confondre avec `FENETRE_PROPOSITION_JOURS`**, qui borne ce
que voit LE CLIENT et n'a pas bougé. Les deux nombres décrivent deux personnes ;
les réunir un jour « pour simplifier » livrerait le carnet de commandes à des
inconnus (`docs/AGENT.md` §2.2 bis).

Ce qui rend l'élargissement sûr n'est pas la vigilance mais la **séparation des
chemins** : la liste du patron vient de `preparerEnvoi`, celle du client est
recalculée par `lireParJeton` au moment où il ouvre son lien. Aucune valeur ne
transite de l'une à l'autre — vérifié en mutant l'une pour constater que l'autre
ne bouge pas.

Au-delà de douze mois, le calendrier ne barre rien et **le serveur tranche** :
seul `verifierJourPropose` sait si la journée tient. Le calendrier propose, il ne
décide pas. Un contrôle tient cette borne, pour qu'on ne l'élargisse pas en
silence à chaque ouverture d'écran.

Même principe chez le client : l'affichage est un **instantané**, deux clients
peuvent viser le même jour, et `enregistrerReponse` revérifie de toute façon.

### Ce que les contrôles visaient, et ce qu'ils visent maintenant

Les deux suites navigateur regardaient `min` et `max` d'un champ natif. C'était
la mauvaise question : **un champ correctement borné laissait quand même choisir
un jour pris.** Elles regardent désormais ce que la personne peut *toucher* —
un jour barré est `disabled`, et le contrôle le vérifie.

Les cases portent `data-jour` et `data-etat` : viser « mardi 12 août » rendrait
les contrôles dépendants de la langue et du fuseau, et un contrôle qui échoue
pour cette raison-là accuse à tort.

| Ce qui est tenu | Par quoi |
|---|---|
| La grille, février bissextile, le passage d'année, la borne des mois | `scripts/test-calendrier.ts` |
| Un jour pris ne se choisit pas, chez le client | `scripts/test-devis-client-e2e.ts` |
| Le patron navigue jusqu'à six mois et la date part | `scripts/test-date-lointaine-e2e.ts` |

---

## 37. Le vocabulaire d'un vrai devis d'élagueur, et la place qu'il ne doit pas prendre

**Le patron, le 9 août 2026**, en transmettant quatre devis d'un confrère :
*« inspire-toi, apprends les phrases, les mots clés, les tournures de phrase,
sauts de ligne par rapport aux différentes tâches à effectuer. »*

### Ce que ces devis confirment

Ils valident la règle qu'il avait énoncée seul le 7 août — *« chaque ligne doit
pouvoir se vendre seule »*. Le confrère fait exactement cela : la fente du gros
bois, le rognage des souches et le débroussaillage ont chacun leur ligne. Son
intuition était la pratique du métier.

Ils en montrent en plus la **forme**, que rien dans le dépôt ne disait :

| Ce qu'on croyait | Ce que font les vrais devis |
|---|---|
| Une ligne = une prestation | Une ligne = **un arbre ou une zone** — « Hêtre », « Espace Hangar », « Bouleau (près de la clôture du voisin) » |
| Le libellé décrit le geste | Le titre nomme la cible ; **les gestes vont dessous**, un par ligne |
| Le bois est un détail | **Aucune ligne d'abattage ne finit sans dire où va la matière** — débité en 40 cm, broyé au pied, évacué par camion |

### Ce qui n'est PAS entré, et ce n'est pas de la prudence en plus

Les quatre devis portent le nom, l'adresse et la commune de **vrais clients**,
plus la raison sociale, le SIRET, l'IBAN et le téléphone d'une **entreprise
tierce**. Rien n'est reproduit.

C'est la règle déjà écrite : ce vocabulaire est **partagé**, il part avec
l'application chez tous les artisans (`docs/QUESTIONS.md` §10 — *« ce sont des
mots, pas des données de client : aucun nom, aucune adresse, aucun prix »*), et
le dépôt est public depuis le 1ᵉʳ août.

Les prix non plus, pour une autre raison : ce sont les prix d'un confrère. Les
verser dans les grilles du patron lui ferait facturer les tarifs de quelqu'un
d'autre.

### **Le défaut que ce lot a créé, et qu'il fallait mesurer**

Vingt-quatre entrées sont entrées dans `termes_metier`. La consigne envoyée avec
chaque dictée est passée à **6 044 caractères** — au-dessus du budget. Le compte,
fait juste après :

| | Avant la réserve | Après |
|---|---|---|
| Termes retenus | 15 / 26 | 18 / 26 |
| **Ses corrections** | **0 / 5** | **4 / 5** |

**Zéro sur cinq.** Le vocabulaire avait mangé toute la place de ce que le patron
avait corrigé de sa main. Or un vocabulaire est écrit **une fois, par l'éditeur,
pour tous les artisans** ; une correction est ce que **ce** patron a changé sur
**son** devis — *« je fais plein de devis et tu enregistres toutes mes
modifications »*. Jeter les secondes pour faire tenir la définition de
« jumelle » travaille contre lui.

`PART_RESERVEE_CORRECTIONS` met un quart du budget de côté avant que les mots ne
se servent. La réserve ne se prélève **que s'il y a quelque chose à y mettre** :
un artisan qui débute n'a rien corrigé, et sa consigne n'a aucune raison d'être
plus courte.

### L'ordre des termes n'est pas alphabétique, il est conséquentiel

C'est lui qui décide de ce qui part quand le budget se resserre. Passent en
premier ceux qui changent un **prix** — les deux techniques d'abattage, l'état
de l'arbre qui les impose — ou qui créent une **ligne détachable** : fente,
rognage, débroussaillage, échenillage. Le vocabulaire de description vient
après : mal compris, il coûte un libellé, pas un montant.

Les huit termes qui restent aujourd'hui au vestiaire quand il a cinq corrections
sont exactement ceux-là : houppier, charpentière, rehaussement, réduction sur
bois sain, taille de cohabitation, jumelle, rejets, fût.

| Ce qui est tenu | Par quoi |
|---|---|
| La réserve, et son retour aux mots quand elle ne sert pas | `scripts/test-consigne-metier.ts` |
| Le budget tenu, réserve comprise | idem |

---

## 38. Deux documents de plus, qui démentent une définition écrite la veille

**Le patron, le 9 août 2026**, transmet une facture de débroussaillage et un
devis de frêne, du même confrère, sans un mot d'accompagnement. Ils ajoutent du
vocabulaire — mais ce n'est pas leur apport principal.

### Une invention déguisée en observation

La migration 0030, écrite quelques heures plus tôt, affirmait : *« Le gros bois
se débite en 40 ou 50 cm. »* Le devis du frêne dit **33 cm**.

Deux devis avaient montré 40, puis 50. J'en ai conclu une liste fermée et je
l'ai écrite comme un fait. C'est exactement ce que `docs/AGENT.md` §3 interdit —
un champ sans source fiable reste ouvert, il ne se remplit pas par
extrapolation. Le piège est qu'ici la source *existait* : elle était juste trop
mince pour porter une énumération.

Le détail qui aggrave : la **consigne** attachée au terme était déjà juste
(« reprendre la longueur dictée telle quelle, ne jamais l'arrondir ni la
supposer »). C'est la définition qui la contredisait — et un modèle qui lit les
deux croit à la liste, parce qu'une liste est plus concrète qu'une interdiction.

**Ce qu'on en retient, au-delà de ce terme :** une définition qui énumère est
une affirmation sur le monde. Deux exemples ne la fondent pas. 0031 la remplace
par *« la longueur qui convient au client — 33, 40, 50 cm. Il n'y a pas de
valeur par défaut. »*

### Ce que les deux documents ajoutent vraiment

| Apport | Ce que le document dit | Pourquoi ça compte |
|---|---|---|
| Le bois a une **destination**, pas seulement un sort | « ramené sur l'arrière du jardin », « en tas rangé le long de la haie » | Le portage est du travail, et il se paie |
| Le débroussaillage a **deux machines** | broyeur forestier sur l'accessible, débroussailleuse sur talus et contours | C'est l'accessibilité qui décide du temps passé, donc du prix |
| Ce qui reste à décider **s'écrit** | « Hauteur du tronc à définir ensemble au moment de l'abattage » | Atlas savait laisser un champ vide et le signaler au patron ; il ne savait pas que cette réserve a sa place **sur le devis** |

Le troisième est devenu une règle (`ordre` 7), pas un mot. C'est la règle du
dépôt — ne rien inventer — écrite par un professionnel sur un document qui part
chez un client, avec sa formulation.

### Le budget : un en-tête payé après coup, et un plafond posé à vide

Deux défauts distincts, trouvés en mesurant plutôt qu'en relisant.

**1. Le calcul était faux de trois en-têtes.** `ajouter()` déduisait le titre du
bloc *après* avoir accepté ses lignes. Avec trois blocs, la consigne dépassait de
leurs trois titres : **6 020 caractères pour un budget de 6 000**.

Le contrôle qui affirmait le contraire était vert, et **pour une mauvaise
raison** : son scénario à deux cents termes épuise le budget dès le premier bloc,
si bien que les deux en-têtes suivants n'existent jamais. Un scénario extrême
cachait le cas ordinaire — `CLAUDE.md` §5, *un contrôle jamais vu rouge ne
prouve rien*. Le contrôle ajouté se cale sur le contenu réel (huit règles,
dix-neuf mots, cinq corrections) et se donne un budget d'un cheveu trop court,
pour que les trois blocs existent et que la coupe tombe dans le dernier.

**2. Le plafond lui-même ne correspondait plus à rien.** Six mille caractères
avaient été choisis à vide, quand le vocabulaire tenait en dix termes. Mesure du
jour : tout dire coûte **8 512 caractères**, et le budget écartait **douze termes
sur vingt-sept**.

Ajouter du vocabulaire à un document dont la moitié ne part jamais, c'est faire
semblant de l'ajouter — et c'est précisément ce que le patron avait demandé la
veille. Le plafond passe à **9 000**, avec un point de comparaison plutôt qu'une
intuition : la consigne d'extraction générique fait à elle seule ~7 300
caractères. Ce que cet artisan a appris à Atlas n'a pas à peser moins que
l'instruction générique qu'il vient corriger.

| | Avant | Après |
|---|---|---|
| Longueur | 6 020 / 6 000 — **dépassement** | 8 512 / 9 000 |
| Termes retenus | 15 / 27 | **27 / 27** |
| Ses corrections | 4 / 5 | **5 / 5** |

Le garde-fou n'est pas levé, il est recalé : quand le vocabulaire passera neuf
mille à son tour, il écartera de nouveau — par ordre d'importance, et **en
disant ce qu'il écarte**.

| Ce qui est tenu | Par quoi |
|---|---|
| Les trois en-têtes tiennent dans le budget, à la coupe près | `scripts/test-consigne-metier.ts` |
| Le contrôle sait échouer | Vérifié en remettant la déduction après coup : deux cas rouges |

---

## 39. L'agenda extérieur : le seul endroit où Atlas pouvait promettre à vide

**Le patron, le 9 août 2026 :** *« ce qui serait bien, c'est que l'utilisateur
puisse, s'il le souhaite ou non, connecter son planning à son agenda Google. »*

### Le défaut, et pourquoi il était d'une autre nature que les autres

Atlas déduisait les jours libres des **seuls chantiers qu'il connaissait**. Un
rendez-vous noté ailleurs était invisible : Atlas proposait ce jour-là, le
client le choisissait, et l'artisan découvrait le doublon le matin même — devis
parti, date acceptée, promesse faite.

Partout ailleurs dans le parcours, quand Atlas ne sait pas, **il s'arrête et
demande** (`docs/AGENT.md` §3). Ici, il ne savait pas qu'il ne savait pas. C'est
le seul point où il engageait l'artisan sur une information qu'il n'avait pas.

### Ce que sa phrase a tranché, et qui commande toute la conception

| Sa décision | Ce qu'elle impose dans le code |
|---|---|
| *« s'il le souhaite ou non »* | Une **table par entreprise** (`agendas_externes`), pas une variable d'environnement — qui vaudrait pour tout le monde et supprimerait le « ou non » |
| Le raccordement appartient à l'artisan | Le jeton vit en base sous RLS, comme toute donnée d'entreprise |
| Rien n'est imposé | Sans ligne, **aucun appel réseau, aucun changement** — l'Atlas d'avant, à l'octet près |

### Une seule carte d'occupation, et trois portes qui la lisent

Les rendez-vous se fondent dans la **même** `Map` que les chantiers, via
`fusionnerOccupationExterne`. Tout ce qui décide ensuite — jours suggérés, jours
barrés sur son calendrier, revérification de la réponse du client — la lit sans
savoir d'où vient l'occupation.

Ce n'est pas de l'élégance : un second calcul posé à côté finit toujours par
diverger, et c'est exactement ce dédoublement qui avait rangé un chantier dans
deux onglets à la fois (§33).

**Le client aussi passe par là**, et il le fallait : c'est lui qui retient la
date. Ne consulter l'agenda que du côté du patron laissait le trou ouvert par
l'autre bout. Les deux chemins publics — lire le lien, enregistrer la réponse —
dérivent l'entreprise **du jeton**, jamais d'une donnée envoyée par le client.

### Trois choix qui se discutent, et qui sont donc écrits

**1. Le moindre chevauchement condamne la demi-journée.** Un rendez-vous de
trente minutes à 10 h ne laisse pas une matinée exploitable à un élagueur —
charger, rouler, grimper. Le risque n'est pas symétrique : bloquer un peu trop
coûte un créneau proposé en moins ; ne pas bloquer assez coûte une promesse.

**2. Un rendez-vous SATURE le créneau**, là où un chantier n'y consomme qu'une
équipe. Le nombre d'équipes dit combien de chantiers tournent en parallèle, pas
combien de fois l'artisan peut être à deux endroits. Atlas ne sait pas si une
équipe part sans lui, et le supposer reprendrait le pari qu'on supprime.

**3. Hors 8 h – 18 h, rien n'est bloqué.** Un dîner à 20 h ne coûte pas une
journée : Atlas ne planifie pas de chantier à ces heures-là.

### Ce qui n'est jamais demandé, ni stocké, ni exporté

| | Décision |
|---|---|
| **Portée Google** | `calendar.freebusy` seule — elle ne rend que des intervalles. `calendar.readonly` aurait été plus simple et aurait donné à Atlas le contenu de tous les rendez-vous. Une permission qu'on ne demande pas est une fuite qui ne peut pas arriver |
| **En base** | Aucun événement, aucun intitulé, aucune heure. Atlas interroge et ne garde rien |
| **Les jetons** | Chiffrés en AES-256-GCM avant écriture. La RLS protège d'un autre artisan, pas d'une sauvegarde recopiée — et un jeton de rafraîchissement n'est pas une donnée, il **ouvre un compte**, durablement |
| **L'export téléchargeable** | Les colonnes de jetons ne sont **pas sélectionnées** — pas filtrées après coup. Ce fichier s'envoie par courriel |

Ce que le chiffrement ne fait **pas** : la clé se dérive d'`AUTH_SECRET`. Qui
obtient la base *et* la configuration lit tout. Ce n'est pas un coffre-fort,
c'est une protection contre le cas courant où **seule la base** fuit.

### La panne se voit, elle ne se tait pas

Une lecture qui échoue — accès révoqué, quota, réseau — n'interrompt jamais le
parcours : Atlas revient à son comportement d'avant. **Mais l'échec s'écrit**
(`derniere_erreur`) et l'écran l'affiche. Un raccordement mort en silence est
pire que pas de raccordement : l'artisan se croit protégé du doublon et ne
l'est plus.

### Ce que ce lot a coûté d'apprendre

**Un module `"use server"` ne peut exporter QUE des fonctions asynchrones.** Y
avoir ajouté la constante du témoin anti-rejeu n'a pas produit une erreur sur
elle seule : le module a perdu **tous** ses exports, et l'écran est tombé sur
« The module has no exports at all ». Ni `tsc` ni le lint ne l'ont vu — les deux
étaient verts. Seule la suite navigateur l'a attrapé, en ouvrant vraiment la
page. La constante vit désormais dans `temoin.ts`.

**Et le titre de l'écran mentait.** La capture montrait « Atlas tient compte de
votre agenda » avec, trois lignes dessous, « Atlas n'arrive plus à lire votre
agenda » : le cas de panne était traité *après* le cas nominal, donc jamais
atteint. Aucun test ne pouvait le voir — la phrase vivait dans le JSX. Elle est
maintenant `titreEtatAgenda()`, une fonction pure, et **l'ordre des cas est la
règle** : panne, puis pause, puis nominal.

| Ce qui est tenu | Par quoi |
|---|---|
| Quelles demi-journées un rendez-vous occupe, fuseau et heure d'hiver compris | `scripts/test-agenda-externe.ts` |
| La fusion : bloque, ne double-compte pas, n'écrase pas le planning, ne mute rien | idem |
| Le titre de l'écran ne ment pas sur l'état réel | idem |
| Isolation entre artisans, jetons jamais en clair, export sans jetons | `scripts/test-agenda-externe-rls.ts` |
| La lecture d'une réponse `freeBusy`, et la portée minimale | `scripts/test-agenda-google-lecture.ts` |
| L'écran se trouve, dit le risque, et ne propose rien qui mène à une erreur | `scripts/test-agenda-reglages-e2e.ts` |

**Ce qui n'est PAS éprouvé, et doit être dit :** l'aller-retour réel avec Google
— autorisation, échange du code, renouvellement du jeton. Cet environnement n'a
pas de compte Google et son mandataire refuse ses adresses. Cela se vérifiera
sur la machine du patron, le jour où il aura créé les identifiants
(`docs/A-FAIRE.md` §7). Tout ce qui *décide* de quelque chose a été sorti de ce
chemin-là exprès, pour que la part non vérifiable se réduise à trois appels HTTP
et à la lecture de leurs réponses.

---

## 40. La note vocale et les chiffres dits en toutes lettres

**Le patron, le 9 août 2026 :** *« lorsque je remplis avec la note vocale, si je
ne dis pas "numéro de téléphone 0670…", il ne comprend pas que c'est un numéro
de téléphone. Pareil pour le mail et les autres infos. Il faut qu'il capte même
si je ne précise pas. »*

### Le défaut n'était pas celui qu'il décrivait — et c'est le point

Il attribuait l'échec à l'absence d'annonce. **La reconnaissance de forme ne
l'a jamais exigée** : elle cherche un motif de chiffres, pas une phrase
d'introduction.

Ce qui manquait est ailleurs : le service de transcription écrit parfois les
chiffres **en toutes lettres**. « Zéro six douze trente-quatre cinquante-six
soixante-dix-huit » ne contient aucun chiffre, donc aucune expression régulière
ne pouvait y voir un numéro. Quand il annonçait « numéro de téléphone », le
**modèle de langue** comprenait et rattrapait ; sans l'annonce, plus rien ne
rattrapait — et l'échec paraissait venir de l'annonce.

C'est un rappel de la règle du dépôt : *reproduire le message du serveur, jamais
l'idée qu'on s'en fait* (`AGENTS.md`). Ici, corriger « le défaut annoncé »
aurait consisté à améliorer la consigne du modèle, ce qui n'aurait rien réglé
pour les dictées où il n'annonce pas.

### La règle de lecture, et pourquoi le trait d'union commande

`src/lib/nombres-dictes.ts` rend les chiffres aux mots-nombres, **avant** toute
reconnaissance de forme. Un numéro se dit par groupes, et chaque groupe vaut un
ou deux chiffres selon sa valeur : « zéro / six / douze » → `0`, `6`, `12`.

Deux régimes, et c'est **la transcription qui choisit**, jamais nous :

| Ce qu'elle écrit | Ce qu'on en fait | Pourquoi |
|---|---|---|
| Avec traits d'union — « soixante-dix quatre-vingts » | On la suit mot à mot : 70, 80 | Elle a déjà découpé. Recoller par-dessus donnait « quatre-vingts quatre » → 84, et un numéro faux de bout en bout |
| Sans aucun tiret — « soixante dix huit » | On recolle, au plus long | Elle n'a pas découpé : « zero six douze trente quatre… » n'a de sens qu'en regroupant |

**Deux pièges de la langue, payés chacun d'une correction :** 70 et 90 sont déjà
composés, leur ajouter une unité produisait 74 au lieu de deux nombres ; et
« cent » a été retiré du vocabulaire reconnu — aucun numéro ne se dicte en
centaines, et l'accepter réécrivait « mille deux cents » en « mille 2100 ».

**Ce que la réécriture ne touche pas :** la transcription montrée au patron et
celle envoyée au modèle. Elle ne sert qu'à la reconnaissance de forme. Deux
nombres séparés par un mot ordinaire restent séparés — « deux chênes de vingt
mètres » ne produit jamais de numéro.

### Deux défauts trouvés en cherchant le sien, de la pire espèce

Ni l'un ni l'autre ne laissait un champ vide : tous deux remplissaient le champ
avec quelque chose de **faux et de vraisemblable**. Un champ vide se voit et se
corrige ; un champ crédible part avec le devis.

| Dictée | Avant | Après |
|---|---|---|
| `0033 6 12 34 56 78` | **0336123456** — dix chiffres, pas ceux du client | `+33612345678` |
| « florian tiret martins arobase gmail point com » | **martins@gmail.com** — le prénom saute | `florian-martins@gmail.com` |

Le premier venait de l'ordre des branches d'une alternance : `0` était essayé
avant `0033`, et la lecture démarrait au deuxième zéro. Le second, de l'absence
des mots « tiret » et « souligné » dans les signes épelés à voix haute.

| Ce qui est tenu | Par quoi |
|---|---|
| Numéro dicté en lettres, avec ou sans traits d'union, panaché de chiffres | `scripts/test-coordonnees-dictees.ts` |
| Les nombres du chantier ne deviennent jamais un numéro | idem |
| `0033` non raboté, un numéro trop long refusé plutôt que coupé | idem |
| Tiret et souligné épelés, sous leurs trois noms | idem |
| Les contrôles savent échouer | Vérifié sur l'ancienne lecture : 9 cas rouges |

---

## 41. Les intitulés de l'agenda, et les identifiants entre ses mains

Deux corrections apportées par le patron, le 9 août 2026, sur le lot de la
veille (§39).

### « Si, il doit lire les intitulés aussi ! »

J'avais choisi la portée `calendar.freebusy` — celle qui ne rend que des
intervalles — en me disant qu'une permission qu'on ne demande pas est une fuite
qui ne peut pas arriver. Le raisonnement tenait ; **il répondait à une question
que personne n'avait posée.**

Un artisan qui note « élagage chez Mme Roux » dans son agenda veut le retrouver
sur son planning. Une case grise sans nom lui apprend qu'il est pris, pas
*pourquoi* — et c'est ce pourquoi qui lui sert à décider. La portée passe donc à
`calendar.events.readonly`, et l'appel de `freeBusy` à `events.list`.

**Ce que l'élargissement ne prend pas :** `calendar.readonly`, plus large
encore, donnerait aussi la liste de ses agendas, leurs partages et leurs
réglages. Une portée en écriture permettrait à Atlas de modifier son agenda, ce
que personne n'a demandé. Un contrôle fige la chaîne exacte, pour que le
prochain élargissement soit décidé et non subi.

**Ce que l'élargissement ne change PAS, et qui n'est pas à sa main.** La page du
client continue de ne recevoir que des dates (`docs/AGENT.md` §2.2 bis). Ce
n'est pas sa vie privée qui est en jeu là, c'est celle de ses autres clients.
Le type `PeriodeOccupee` porte l'intitulé en **facultatif**, et aucun calcul ne
le lit : tout ce qui décide — demi-journées prises, jours proposables — se fait
sur `debut` et `fin`. Ce qui n'entre dans aucun calcul ne peut pas ressortir
par un chemin oublié.

**Trois pièges d'`events.list` que `freeBusy` masquait :**

| Cas | Ce qu'il fallait faire | Ce qu'un oubli coûtait |
|---|---|---|
| Événement récurrent | `singleEvents=true` déplie la série | Une réunion hebdomadaire n'occupe qu'une semaine ; les autres s'affichent libres, donc proposables |
| Événement « toute la journée » | Google rend une fin **exclusive** (14→15 pour un seul jour) | Barrer le 15, une journée qu'il aurait acceptée |
| Événement annulé, ou marqué « disponible » | Les écarter | Barrer une journée qu'il vient de libérer, ou perdre une matinée pour un anniversaire |

### « Un petit bouton connecter son agenda Google » — dans le Planning

Deux choses dans cette phrase, et la seconde débloquait tout.

**L'endroit.** Le raccordement se proposait au fond des réglages. Le planning
est l'écran où le manque se constate ; y mettre le lien, c'est offrir la
solution là où le problème apparaît. **Le bandeau disparaît quand tout va
bien** : un bandeau permanent sur l'écran le plus consulté devient du décor, et
le jour où il annonce une panne, personne ne le lit.

**Les identifiants.** *« Pour rentrer ses identifiants »* — la veille, ils
s'attendaient dans trois variables d'environnement. Conséquence : il créait son
projet chez Google, obtenait ses identifiants, **et restait bloqué** faute de
pouvoir les poser lui-même. Le point dormait chez moi alors qu'il avait fait sa
part.

Ils se collent maintenant dans l'écran, et vivent sur la ligne du raccordement
(migration 0033). Trois décisions qui vont avec :

- **Ceux de l'entreprise priment sur ceux de l'installation.** Les variables
  restent en repli — banc d'essai, ou installation qui fournirait les
  identifiants pour tous ses artisans.
- **Configuré n'est pas relié.** Entre le collage des identifiants et le retour
  de chez Google, il n'a encore rien autorisé. Confondre les deux afficherait
  « agenda relié » à quelqu'un qui n'a rien fait.
- **Changer d'identifiants efface les jetons.** Ils appartiennent à l'autre
  projet Google et ne valent plus rien ; les garder afficherait « relié » sur un
  raccordement mort, et le doublon reviendrait en silence.
- **Le secret peut rester vide à la modification.** Google ne le remontre jamais
  après l'avoir créé : exiger de le ressaisir pour corriger une faute de frappe
  dans l'adresse de retour serait une impasse dont on ne sort qu'en refaisant un
  projet.

Le `client_secret` est chiffré comme les jetons ; le `client_id` reste en clair —
il figure dans l'adresse de consentement que son navigateur affiche, et le
chiffrer donnerait l'illusion de protéger une donnée publique par construction.

| Ce qui est tenu | Par quoi |
|---|---|
| Intitulé rendu, événement annulé ou « disponible » écarté, journée entière sans déborder | `scripts/test-agenda-google-lecture.ts` |
| La portée reste `events.readonly`, ni plus large ni en écriture | idem |
| Identifiants saisis, secret jamais en clair, secret conservé si vide, jetons effacés au changement | `scripts/test-agenda-externe-rls.ts` |
| Les identifiants d'un artisan restent invisibles pour un autre | idem |
| Le planning propose le raccordement, l'écran offre les trois cases, le secret est masqué | `scripts/test-agenda-reglages-e2e.ts` |
| **Le bouton « Enregistrer » n'est couvert ni par la barre ni par la bulle** | idem — mesuré, pas supposé |

---

## 42. Une base restée en arrière, et personne pour le dire

**Le 9 août 2026**, le patron met à jour son banc d'essai sur mon conseil, lit
« Mise à jour récupérée », ouvre le Planning — et l'écran tombe. Rien ne relie
les deux événements.

### La cause tenait en une variable, et elle était là depuis le début

Deux chemins appliquent les migrations sur le banc : le démarrage de l'espace
(`demarrer.sh`) et le bouton « Chercher les dernières corrections »
(`mettreAJourApplicationAction`). Tous deux lançaient `npm run db:migrate`
**avec la variable ambiante `DATABASE_URL`**.

Or sur le banc, `DATABASE_URL` vaut `atlas_app` — le rôle applicatif, qui n'a
**délibérément aucun droit de créer une table**
(`docker/init/01-bootstrap-atlas.sql`, même posture qu'en production). La
commande échouait donc sur `permission denied for schema public`.

**Et l'échec était avalé, des deux côtés** : `|| true` dans le script,
`.catch(() => undefined)` dans l'action. Le code neuf arrivait, la base restait
vieille, et l'écran affichait un succès.

`CLAUDE.md` §5 dit déjà, pour les essais locaux : *« Les migrations tournent
sous le rôle propriétaire : `atlas_app` n'a aucun droit de DDL, et l'oublier
produit un "permission denied for schema public" qui envoie chercher au mauvais
endroit. »* La règle était écrite. Le banc ne la suivait pas.

### Ce qui est réparé, et pourquoi les deux moitiés comptent

| | Avant | Après |
|---|---|---|
| **Le rôle** | `DATABASE_URL` (applicatif) | `DATABASE_ADMIN_URL` d'abord, `DATABASE_URL` à défaut |
| **L'échec** | Avalé, deux fois | Rendu en une phrase, affiché au démarrage ET sur l'écran de mise à jour |
| **Le code** | Deux appels séparés | Un seul script, `.devcontainer/appliquer-migrations.sh` |

**Un seul script pour les deux appelants**, et un contrôle qui interdit à
quiconque de relancer `db:migrate` directement : deux copies auraient divergé,
et l'une des deux serait restée sur le mauvais rôle. C'est la même règle que
partout ailleurs ici (`CLAUDE.md` §3).

**L'écran ne dit plus « Mise à jour récupérée » quand la base a échoué.** Il
écrit : *« Code récupéré, mais LA BASE N'A PAS SUIVI — <ce que la base a
répondu>. Les écrans qui touchent une table neuve vont tomber : c'est ça, et
rien d'autre. »* Une demi-vérité sur cet écran envoie chercher la panne au
mauvais endroit, ce qui coûte plus cher que pas de message.

### Le message a dû être corrigé deux fois, et c'est instructif

Premier jet : prendre la **dernière** ligne correspondant à un motif d'erreur.
Résultat réel, mesuré :

```
échec :   routine: 'aclcheck_error'
```

Le nom d'une fonction interne de PostgreSQL. La vraie phrase — `permission
denied for schema public` — se trouvait douze lignes plus haut. Un message qui
accuse à tort coûte plus cher que pas de message du tout (`CLAUDE.md` §5) :
c'est la **première** ligne parlante qu'il faut, pas la dernière.

Le correctif cherche maintenant les formulations que PostgreSQL et son pilote
écrivent vraiment — `permission denied`, `does not exist`, `ECONNREFUSED`… — et
prend la première.

### Un contrôle existant est passé au rouge, et il avait raison de le faire

`test-issue-mise-a-jour.ts` vérifie que l'issue est notée **avant** la
migration, pour survivre à une réponse coupée (défaut du 7 août). Il repérait
la migration par la chaîne `"db:migrate"`, que le correctif supprime :
`indexOf` a rendu `-1`, et le cas a échoué.

**Aucune régression n'avait eu lieu** — mais c'est exactement ce qu'on veut
d'un repère disparu : qu'il fasse du bruit plutôt que de se taire. Le cas
accepte désormais les deux marqueurs et refuse explicitement qu'il n'y en ait
aucun.

| Ce qui est tenu | Par quoi |
|---|---|
| L'échec est dit, jamais avalé — y compris base injoignable ou adresse absente | `scripts/test-migrations-banc.ts` |
| Le message nomme le bon coupable (`permission denied for schema public`), joué pour de bon sous `atlas_app` | idem |
| Le rôle propriétaire est choisi en premier | idem |
| Aucun appelant ne relance `db:migrate` directement | idem |
| L'avertissement remonte au démarrage ET à l'écran | idem |
| Les contrôles savent échouer | Vérifié sur les deux défauts d'origine : 1 rouge pour le rôle, 3 pour le silence |

---

## 43. Bâtir n'est pas déployer — et personne n'avait jamais bâti Atlas

**Le 9 août 2026**, le patron : *« Mais en fait, ça me fait peur parce que
l'application là, elle est super lente. Les utilisateurs, ils ne voudront jamais
utiliser une application aussi lente que ça. »*

La réponse tenait en une phrase — ce qu'il mesure, c'est `next dev`, qui compile
chaque écran au moment où on l'ouvre. Mais l'affirmer sans chiffre n'avait aucune
valeur. Il a donc fallu bâtir l'application pour de bon. **Et c'était
impossible.**

```
ErreurConfiguration: LLM_PROVIDER vaut « dev » en production…
Failed to collect page data for /api/agenda/google/retour
```

### Pourquoi les refus de production tombaient sur un compilateur

`next build` se déclare `NODE_ENV=production` et **importe chaque module** pour
collecter les données de page. Or `src/auth.ts` lit le secret de session dès
l'import — NextAuth en a besoin pour se construire. Tous les refus de
`src/server/env.ts` s'appliquaient donc **pendant la compilation** :

| Refus | Ce qu'il exigeait pour compiler |
|---|---|
| `LLM_PROVIDER` ≠ `dev` | une clé d'IA facturée |
| `STORAGE_PROVIDER = s3` | un compartiment S3 et ses accès |
| `CRON_SECRET` ≥ 16 caractères | un secret de tâche planifiée |
| `REDIS_URL` | un Redis joignable |

Produire une version optimisée supposait donc de **détenir tous les secrets de
production**. Ni la CI, ni le banc d'essai, ni personne cherchant simplement à
mesurer la vitesse ne le pouvaient. C'est pourquoi le défaut a vécu si
longtemps : il ne se voyait qu'en faisant une chose que personne ne faisait.

### La correction, et pourquoi ce n'est pas un affaiblissement

Ces refus protègent une application **qui sert des clients**, pas un compilateur
qui produit des fichiers. Ils sont suspendus pendant la construction — et
pendant elle seule, sur `NEXT_PHASE === "phase-production-build"`, que Next.js
pose lui-même.

`scripts/test-env.ts` l'éprouve **dans les deux sens**, et le second cas est le
plus important :

| Cas | Attendu |
|---|---|
| Construction, aucun secret | accepté |
| **Exécution, même configuration** | **refusé** |
| **Démarrage du serveur bâti (`phase-production-server`)** | **refusé** |

Sans ces deux derniers, `NEXT_PHASE` deviendrait un interrupteur ouvrant toutes
les protections de production, et rien ne le dirait.

`src/server/storage/index.ts` violait par ailleurs le contrat de `getEnv()`
(« validé au premier accès ») en résolvant sa configuration à l'import. Il la
résout désormais au premier stockage réel ; la seconde barrière contre le
stockage local en production reste entière.

### Ce que la mesure a donné

Version bâtie, vrai navigateur, base réelle sous le rôle applicatif, machine à
4 cœurs :

| | Version bâtie | `next dev`, 1re ouverture |
|---|---:|---:|
| Démarrage du serveur | 212 ms | plusieurs minutes |
| Écran de connexion | 333 ms | 104 s (mesuré chez le patron) |
| Vérification du mot de passe | 489 ms | — |
| Accueil, Planning, Terminés, Réglages… | **50 à 100 ms** | 38,7 s (Terminés, chez lui) |

**La première ouverture coûte la même chose que la deuxième.** C'est toute la
différence : plus rien ne se compile à l'ouverture.

Non mesuré, et dit plutôt que supposé : les PDF (exigent un vrai stockage) et la
dictée (exige de vraies clés, donc un appel facturé).

---

## 44. Un serveur mort que personne ne relève, et des écrans compilés sous ses yeux

Même journée, deux pages d'erreur que le patron a lues coup sur coup. Elles
n'avaient pas la même cause, et aucune n'était une lenteur.

### « HTTP ERROR 504 » — l'écran se compilait pendant qu'il attendait

Il clique « Connecter » sur le Planning. Rien. Une minute plus tard, le
mandataire de GitHub abandonne. Son terminal disait pourquoi :

```
o Compiling /reglages/agenda ...
GET /termines 200 in 38.7s
GET /planning 200 in 373ms
```

Le même écran : **38,7 s** la première fois, **373 ms** ensuite. `next dev` ne
compile rien d'avance. Chaque écran neuf était donc une page d'erreur, et il en
concluait — légitimement — que l'application était cassée.

### « HTTP ERROR 404 » — le serveur était mort, et rien ne le relevait

Sur cette adresse, un 404 ne veut pas dire « page absente » : il veut dire
**« plus rien n'écoute sur le port 3000 »**. Son terminal montrait l'invite
revenue sous `npm run essai`.

Le démarrage de l'espace lançait le serveur **une fois, et une seule**. Quand il
mourait — un `pkill` du démarrage rejoué, une commande tapée dans le mauvais
terminal, deux serveurs se disputant le port — l'application restait morte
jusqu'à ce que le patron s'en aperçoive et aille taper une commande.

### Les trois pièces, et ce que chacune tient

| Pièce | Ce qu'elle empêche |
|---|---|
| `.devcontainer/veiller.sh` | qu'un serveur mort le reste : contrôle toutes les 15 s, relance |
| Garde dans `scripts/essai.mjs` | qu'une commande tapée par erreur lance un second serveur qui tue le premier |
| `scripts/prechauffer.mjs` | que le patron subisse la première compilation de chaque écran |

**Le veilleur exige deux conditions avant de relancer** : que la santé ne
réponde plus **et** qu'aucun `next dev` ne tourne. Sur le seul critère de la
santé, une grosse compilation aurait fait lancer un second serveur — c'est-à-dire
exactement le désordre à réparer.

### Le préchauffage a besoin d'une session, et pas de celle qu'on croit

Le middleware redirige toute requête sans session vers `/login` **avant** que la
page ne soit compilée. Vérifié, pas supposé : une requête anonyme sur
`/planning` rend un 307 en 147 ms et ne compile rien.

Se connecter pour de bon était le premier réflexe, et c'était un piège. Le
limiteur autorise **cinq tentatives par quart d'heure et par adresse IP**
(posé le 6 août après que les parents du patron se soient vu refuser le bon mot
de passe). Sur un banc, tout arrive par la même adresse : quelques redémarrages
auraient **verrouillé le patron hors de sa propre application**. Le remède
aurait créé une panne pire que celle qu'il répare.

Le jeton est donc fabriqué directement, avec la même clé et la même fonction que
le serveur. Il ne consomme aucune tentative, ne quitte jamais le processus, et
**n'est jamais fabriqué en production** — refus en tête de fonction, éprouvé.

### Deux pièges rencontrés en le construisant, et gardés ici

**La RLS, encore.** Le premier jet cherchait un chantier à préchauffer par
`select id from chantiers` sous le rôle applicatif. Zéro ligne, **aucune
erreur** : le préchauffage annonçait « 11 écrans prêts » en sautant en silence
les cinq plus lourds — ceux que le patron ouvre en premier. L'identifiant est
maintenant lu **sur l'écran d'accueil**, ce qui respecte l'isolation au lieu de
la contourner.

**Une redirection n'a rien compilé.** Compter un 307 comme une réussite aurait
fait annoncer « 16 écrans prêts » alors qu'aucun ne l'était. Un contrôle qui
affirme au lieu de vérifier est pire que pas de contrôle.

### Mesuré de bout en bout, cache vidé

| Étape | Durée (4 cœurs) |
|---|---:|
| Départ à froid → 16 écrans prêts | **43 s** |
| Serveur tué → relevé par le veilleur | **16 s** |
| Écrans après préchauffage | 125 à 680 ms |

Contre 38,7 s pour un seul écran avant. Sur les deux cœurs du banc, compter
environ le double — mais le préchauffage se joue **pendant que personne ne
regarde**.

### Ce que l'`exec` effaçait, et qui annulait le correctif du matin

Trouvé **en jouant `demarrer.sh` pour de bon**, sur un banc de simulation
volontairement resté en arrière — jamais en le relisant.

Le script se relance dans sa version neuve après une mise à jour
(`exec bash "$0"`, §24). Le second passage **recalcule tout** : la mise à jour
répond alors « à jour » — le code vient d'être tiré — et `MIGRATIONS` n'existe
plus du tout, puisque le bloc qui la pose est sauté.

| Conséquence | Gravité |
|---|---|
| Le démarrage affichait « Déjà à jour. » juste après avoir mis à jour | trompeur, sur un banc dont l'histoire est faite de versions d'avant |
| **L'avertissement « LA BASE N'A PAS SUIVI LE CODE » ne pouvait plus jamais s'afficher** | il ne se déclenche qu'après une mise à jour : exactement le cas où l'`exec` effaçait la variable |

Le correctif du matin même (§42) était donc **mort-né**, et aucun contrôle ne le
voyait. Les deux constats traversent désormais la relance
(`ATLAS_MISE_A_JOUR`, `ATLAS_MIGRATIONS`) et sont repris après elle.

**Le contrôle qui tient ça a d'abord été un faux vert.** Écrit avec `indexOf`,
il trouvait la ligne même **mise en commentaire** : la transmission retirée, il
restait au vert. Il ne cherche plus que dans les lignes qui s'exécutent, et
raisonne en numéros de ligne. Éprouvé rouge sur les deux moitiés — transmission
absente, reprise absente.

### Le compte du préchauffage, et pourquoi « le plus ancien » ne suffit pas

Même banc de simulation, même méthode : le préchauffage n'a compilé **2 écrans
sur 11**, les neuf autres partant vers `/documents-legaux`.

La cause n'était pas dans le préchauffage : sur une base ayant servi aux suites
de tests, `order by created_at asc limit 1` ne désigne pas le compte de
démonstration mais un compte d'essai — sans chantier, et sans acceptation des
documents légaux. Le compte est désormais choisi **nommément**.

Mais le bilan, lui, disait « 9 en échec » sans dire de quoi. Il nomme maintenant
l'obstacle quand un même renvoi explique le gros des échecs : documents légaux à
accepter, session refusée (`AUTH_SECRET` différent), ou autre. Une ligne d'échec
qui laisse chercher la cause coûte plus cher que pas de ligne du tout.

### La cause première du 404 : tuer les enveloppes et laisser le serveur

Trouvée en dernier, et c'est la plus importante — **en regardant la liste des
processus de la machine**, jamais en relisant le script. Reproduite sans le
vouloir en éprouvant le veilleur, ce qui est la meilleure preuve qu'elle est
réelle.

`npx next dev` n'est qu'une pile d'enveloppes. Le processus qui écoute
vraiment **se renomme** :

```
27577 npm exec next dev -H 0.0.0.0 -p 3000   ← enveloppe
27590 node …/next dev -H 0.0.0.0 -p 3000     ← enveloppe
29803 next-server (v16.2.12)                 ← CELUI QUI ÉCOUTE
```

`pkill -f "next dev"` — présent dans `demarrer.sh` **depuis le début** — tue
donc les enveloppes et laisse le vrai serveur vivant, orphelin, **accroché au
port 3000**. Deux conséquences, et la seconde explique tout :

1. le serveur suivant ne peut plus s'attacher au port ;
2. l'orphelin continue de répondre, mais avec un cache de compilation qui
   n'existe peut-être plus — **toutes les pages rendent 404**, y compris
   `/api/health/live`, ce qui rend le diagnostic incompréhensible.

Le motif couvre désormais les deux (`[n]ext(-server| dev)`), dans les deux
scripts, et le démarrage laisse une seconde au port pour se libérer.

**Et le veilleur traite le cas le plus vicieux**, qu'il ne voyait pas dans sa
première version : un serveur **présent mais muet**. `pgrep` le trouvait, donc
aucune relance — la boucle aurait tourné indéfiniment sans rien faire. Deux
tours de patience, puis il est délogé.

| Cas | Avant | Après |
|---|---|---|
| Serveur absent | relancé | relancé |
| Serveur muet qui tient le port | **boucle infinie sans rien faire** | délogé après 30 s, puis relancé |
| Orphelin `next-server` | survivait à chaque démarrage | tué avec les enveloppes |

Vérifié de bout en bout sur un banc de simulation remis neuf commits en
arrière : mise à jour, migrations, relance du script, veilleur, seize écrans
préchauffés en 30 s, serveur tué et relevé. Et l'avertissement « LA BASE N'A PAS
SUIVI LE CODE » s'affiche enfin, pour de bon.

### Une page d'état, parce qu'il travaille au téléphone

**Sa phrase, le 9 août 2026 :** *« Va regarder toi-même, je peux pas te
l'envoyer. »* Il attendait depuis trois minutes devant un écran qui ne s'ouvrait
pas, et la seule chose capable de dire pourquoi était le terminal de l'éditeur —
qu'il ne pouvait ni lire confortablement ni photographier depuis son téléphone.

Je n'ai aucun accès à son espace de travail. L'information devait donc **venir à
lui**, et non l'inverse.

`/api/health/banc` répond en quelques millisecondes, sans session, et dit les
trois seules choses qui comptent quand rien ne s'ouvre :

| | Pourquoi c'est celle-là |
|---|---|
| **La version exécutée** | « le correctif est-il descendu ? » a déjà coûté plusieurs journées (§24) |
| **Où en est le préchauffage** | s'il compile encore, ses clics passent derrière la file, et il n'y a rien à faire qu'attendre |
| **Ce qui bloque** | base arrêtée, documents à accepter, session refusée |

Trois choix qui ne sont pas des détails :

- **En HTML, pas en JSON.** Sur un téléphone, du JSON brut se lit sur une ligne
  minuscule. Celui qui consulte cette page cherche pourquoi rien ne marche : ce
  n'est pas le moment de lui demander un effort.
- **Aucune requête en base.** Elle sert quand tout est mort ; une seule requête
  et elle tomberait exactement au moment où on en a besoin. Un contrôle interdit
  d'y importer `db` ou un dépôt.
- **Aucune donnée d'entreprise.** Une version, un compteur, une durée. Cette
  adresse est ouverte à qui connaît le nom de l'espace.

L'avancement transite par `/tmp/atlas-prechauffage.json` — le préchauffage vit
dans le processus de démarrage, pas dans le serveur. Dans `/tmp` et jamais à la
racine : un fichier neuf salirait l'arbre git et `mettre-a-jour.sh` refuserait
alors **toutes** les mises à jour suivantes. Même piège, même règle que le
journal de mise à jour.

### Le silence qui accusait le mauvais coupable

Trouvé en éprouvant cette page : PostgreSQL s'était arrêté sur la machine, et le
démarrage annonçait :

```
(Préchauffage impossible : pas de session — les écrans se compileront à l'ouverture.)
```

Ce qui envoie chercher du côté des comptes et des jetons. La vraie phrase était
`ECONNREFUSED 127.0.0.1:5432` : **la base ne répondait pas, donc aucun écran ne
pouvait fonctionner** — le préchauffage n'était que le premier à s'en apercevoir.
Un `catch` muet avait tout avalé.

Le message dit maintenant, en toutes lettres, que c'est la base, et que ce n'est
pas le préchauffage. Éprouvé contre une adresse injoignable.

**Et un troisième défaut, vu à l'écran et nulle part ailleurs :** le premier jet
de la page écrivait `**…**` au milieu d'une phrase, croyant à du gras. Le patron
aurait lu des astérisques. Un contrôle interdit désormais les astérisques dans
les textes destinés à l'écran.

### Le retour de Google renvoyait le téléphone… vers le téléphone

Trouvé **pendant** que le patron autorisait Atlas chez Google, le 9 août 2026.
Il était arrivé jusqu'à l'écran de consentement — donc les identifiants étaient
enregistrés, l'URI de redirection accepté, le champ d'application correct. Tout
le difficile était fait.

Le retour, lui, construisait son adresse ainsi :

```ts
process.env.NEXTAUTH_URL ?? process.env.ATLAS_URL_PUBLIQUE ?? "http://localhost:3000"
```

**Aucune de ces deux variables n'est posée sur le banc d'essai.** Le navigateur
de son téléphone était donc renvoyé vers `localhost:3000` — c'est-à-dire vers le
téléphone lui-même.

Le pire n'est pas la page morte. C'est que **le raccordement aboutissait** : les
jetons étaient échangés et enregistrés, l'agenda était relié pour de bon — et
rien ne le lui disait. Il aurait conclu à un échec devant une réussite.

`src/server/agenda/adresse-publique.ts` part maintenant de ce que le **navigateur
a demandé** : `x-forwarded-host`, à défaut `host`, et les variables en dernier
secours. C'est exactement l'hôte que Google vient d'utiliser pour nous joindre,
puisque l'adresse de retour lui a été donnée à l'identique.

La règle vit dans son propre fichier, et non dans la route : un fichier de route
Next.js ne peut exporter que ses verbes HTTP, et une règle enfouie là n'aurait
jamais pu être éprouvée. `scripts/test-adresse-publique.ts` couvre les deux
sens — l'hôte annoncé l'emporte toujours, et `localhost` n'apparaît que
lorsqu'il n'y a strictement rien d'autre.

**C'est la même famille de défaut que l'origine des actions serveur** (§30) :
une valeur devinée côté serveur là où seule la requête du navigateur fait foi.
Deux fois le même piège, deux fois une journée perdue.

---

## 45. Le banc cesse d'être un atelier : il sert une version bâtie

**Le 9 août 2026, dix-sept heures.** « HTTP ERROR 504 », « 404 », « 502 », deux
serveurs qui se disputaient le port 3000, un écran à 38,7 secondes. Sa phrase, à
la fin : *« On arrête de tourner en rond, corrige-moi ça une bonne fois pour
toutes. »*

Il avait raison. Chaque correctif de la journée visait un symptôme. Ils avaient
**tous la même cause** : le banc faisait tourner `next dev`, qui ne compile rien
d'avance et attend qu'on ouvre un écran pour le compiler. Un serveur de
développement est un atelier, pas un produit.

### Ce que la version bâtie change, mesuré

| Écran, premier accès | `next dev` | Version bâtie |
|---|---:|---:|
| Accueil | 38,7 s (constaté chez lui) | **46 ms** |
| Planning | 5,4 s | **47 ms** |
| Terminés | 38,7 s | **80 ms** |
| Mon agenda | > 60 s, puis 504 | **38 ms** |
| Fiche chantier | — | **41 ms** |
| Devis complet | — | **70 ms** |

Plus rien à compiler à l'ouverture : donc plus de 504, plus de préchauffage à
inventer, plus de course entre lui et le compilateur. La construction coûte deux
à cinq minutes au démarrage — une attente déplacée **du moment où il clique vers
le moment où il met à jour**, c'est-à-dire au bon endroit, et sans lui.

### Le verrou qui l'en empêchait, et comment il est levé

`next build` et `next start` imposent `NODE_ENV=production`, et
`src/server/env.ts` refuse alors — à juste titre — une IA simulée et un stockage
local. Un banc n'a ni clé d'IA facturée ni compartiment S3 : la version bâtie
lui était donc **structurellement interdite**.

D'où `src/profil-banc.ts` : un profil **déclaré, jamais deviné**.

| | Sans le profil | Avec `ATLAS_PROFIL=banc` |
|---|---|---|
| IA simulée en production | refusée | acceptée |
| Stockage local en production | refusé | accepté |
| Alignement hôte/origine du proxy | éteint | maintenu |
| Hôte transmis par le mandataire | refusé par Auth.js | accepté |
| **AUTH_SECRET, CRON_SECRET, Redis** | **exigés** | **exigés** |
| **Isolation entre entreprises (RLS)** | **entière** | **entière** |

Les deux dernières lignes sont l'essentiel : le profil ne relâche **que** ce
qu'un banc ne peut pas avoir. Ce qu'il possède déjà reste exigé, et rien de ce
qui touche à l'isolation ne bouge. `scripts/test-env.ts` tient les deux sens —
ce que le profil autorise, et ce qu'il refuse toujours, y compris pour une
valeur approchante (`bancs`, `banc-essai`, `1`).

Le profil est posé par `.devcontainer/demarrer.sh`, qui vit dans le dépôt et
descend avec le code — jamais par `docker-compose.yml`, dont une variable
n'existe pas dans un espace créé avant qu'elle n'y soit écrite. Deux correctifs
sont déjà restés inertes pour ce motif.

### `UntrustedHost` : le défaut que seul le contrôle de connexion pouvait voir

En passant le banc en version bâtie, la connexion s'est cassée — et pas au
même endroit que la fois précédente :

```
[auth][error] UntrustedHost: Host must be trusted.
URL was: http://…-3000.app.github.dev/api/auth/session
```

L'artisan, lui, ne voyait qu'un écran « Une erreur. Cette page n'a pas pu
s'afficher. » Auth.js, en production, cesse de faire confiance à l'hôte transmis
par un mandataire. C'est la **même famille** que « Invalid Server Actions
request. » (§30) : une protection pensée pour un serveur joignable en direct,
appliquée à un serveur qui ne l'est jamais.

`trustHost` suit désormais la même règle que le reste : hors production, ou sur
un banc déclaré. Une vraie mise en production retrouve le refus entier et devra
poser `AUTH_TRUST_HOST` en connaissance de cause.

**Aucune autre suite ne pouvait le voir.** Les suites base n'ouvrent pas de
navigateur ; les suites navigateur démarrent leur propre serveur en
développement. Seul `npm run verifier:connexion` monte ce que le patron exécute
et se connecte pour de bon derrière une origine étrangère — et il a été changé
pour monter `npm run banc`, la version bâtie, plutôt que `npm run essai`.
**Éprouver autre chose que ce qu'on livre, c'est ne rien éprouver.**

### Le repli, qui n'est pas une décoration

Si la construction échoue, `scripts/banc.mjs` repart sur `next dev` en le
disant. Un banc lent reste un banc ; un banc mort lui coûte sa soirée.

### Le lancement passait en dernier — donc il ne passait pas

**Le défaut qui a coûté la soirée entière du 9 août 2026**, et qu'aucune des
corrections précédentes n'avait touché.

Son journal s'arrêtait net :

```
migrations : faites
```

Et `curl localhost:3000` ne répondait rien. L'application n'était ni lente ni
cassée : **elle n'avait jamais été lancée.** Pendant deux heures il a lu des
pages blanches, des 502 et des 404, et moi j'ai cherché du côté du mandataire,
de la visibilité du port, du navigateur — partout sauf au bon endroit.

`demarrer.sh` faisait, dans cet ordre :

1. mise à jour du code
2. `npm ci` — **plusieurs minutes**
3. migrations
4. relance du script dans sa version neuve (`exec`)
5. **lancement du serveur**

Or il est joué par `postStartCommand`, que l'environnement peut interrompre. Le
lancement venait **en dernier** : tout ce qui suivait l'interruption mourait
avec elle, et il ne restait rien.

### L'ordre inversé, et ce que cela garantit

Le veilleur est posé **en premier**, avant toute opération longue. Il monte le
serveur avec le code présent sur le disque — celui d'hier s'il le faut. Si la
mise à jour aboutit ensuite, veilleur et serveur sont remplacés par leurs
versions neuves.

**Quoi qu'il arrive après cette ligne, l'artisan a une application qui répond.**

`exec bash "$0"` disparaît, et c'est délibéré : c'était l'endroit précis où le
démarrage mourait. Ce que §24 protégeait — que le code neuf entre en vigueur
tout de suite — reste tenu autrement : `veiller.sh`, `banc.mjs` et
l'application sont relus depuis le disque quand le veilleur redémarre. Seule la
fin de `demarrer.sh` reste, pour un allumage, dans sa version d'avant. Un
bandeau, contre une application qui démarre.

### Éprouvé en le tuant

Le contrôle n'est pas une lecture de code : le script est **tué au bout de cinq
secondes** (`SIGKILL`, le cas le plus brutal), sur un banc de simulation.

| | Avant | Après |
|---|---|---|
| Démarrage interrompu à 5 s | rien ne répond, jamais | **serveur debout 26 s plus tard, version bâtie** |

Deux contrôles de source complètent la démonstration : le lancement précède la
mise à jour, et l'`exec` ne peut pas revenir.

**Une réserve, dite plutôt que tue :** l'allumage qui *récupère* ce correctif
exécute encore l'ancien script, donc l'ancien ordre. C'est la dernière fois. Si
cet allumage-là est interrompu, `bash .devcontainer/demarrer.sh` relance tout.

---

## 46. L'écran Chantiers refait d'après une maquette du patron

**Le 9 août 2026, tard.** Il envoie une capture d'un écran Chantiers redessiné
et demande, en toutes lettres, une *reproduction* et non une interprétation :
« proportions, espacements, alignements, hiérarchie typographique, finesse des
bordures, ombres extrêmement discrètes ». Puis, après un premier jet : « je ne
veux pas une nouvelle proposition graphique ».

### L'or, second accent — et le partage des rôles

La charte n'avait qu'un accent, le vert pin (§17). La maquette en introduit un
second, un or, et il ne se pose pas au hasard :

| | Porte |
|---|---|
| **Vert pin** | ce qu'on FAIT — l'action principale, l'onglet où l'on se trouve |
| **Or** | ce qu'on LIT — l'accueil, les statuts, les filets, le sceau |

Les mélanger rendrait l'écran bavard, c'est-à-dire exactement le « tableau de
bord » qu'il refuse. L'or sert en outre d'**information** sur les cartes : les
états qui attendent un geste de lui — devis retourné, correction demandée,
relance, caducité — portent l'or ; les autres restent verts. La couleur dit
alors quoi regarder, elle ne décore pas.

### Les mesures, et pourquoi elles sont celles-là

Sa liste de refus se traduit en chiffres, tous relisibles dans le code :

| | Avant | Après |
|---|---:|---:|
| Filet de carte | aucun | 1 px |
| Accent de bord | aucun | 2 px |
| Rayon de carte | 22 px | 14 px |
| Diffusion de l'ombre | 26 px à 6 % | 14 px à 4 % |
| Écart entre cartes | 16 px | 10 px |
| Hauteur d'une carte | ~150 px | ~94 px |
| Texte secondaire | 14 px | 12,5 px |

Au-delà de 18 px de rayon la carte devient un galet et l'écran perd sa tenue ;
en deçà de 4 % d'ombre elle se décolle du fond crème. Ces deux bornes ont été
trouvées à l'écran, pas au raisonnement.

### Deux dessins, et pas une image

Le sceau (`MarqueAtlas`) et la branche (`BrancheEucalyptus`) sont **tracés**.
Une photo détourée aurait pesé des centaines de kilo-octets, se serait affichée
floue sur un écran dense et aurait fait clignoter la page à chaque ouverture.
La branche définit **une** foliole dans `<defs>` et la rappelle onze fois : la
corriger les corrige toutes.

La feuille de l'onglet actif est **le même composant** que le sceau de
l'en-tête. Deux dessins voisins auraient divergé au premier retouchage.

`public/icone-source.svg` n'est pas réutilisable ici : c'est l'icône
d'installation, un chevron explicitement provisoire, avec un fond opaque.

### Le défaut que seule une mesure pouvait voir

La branche déborde à droite du titre. Sans `overflow-hidden` sur son conteneur,
elle **élargit le document** : la barre basse mesurait **425 px sur un écran de
393**, et toute la page glissait latéralement au doigt.

Invisible sur une capture — le débordement est hors cadre. Il est apparu en
demandant au navigateur la **boîte** de la barre plutôt qu'en regardant l'image.
`scripts/capture-accueil.mts` imprime désormais cette boîte à chaque capture.

### Ce que la maquette ne pouvait pas décider

- **La date des cartes** n'existait pas dans les données : `updatedAt` est
  remontée, et `libelleDateRelative` la rend lisible. `updatedAt` et non
  `createdAt` — ce qu'on cherche est le chantier touché en dernier.
- **« Équipe »** mène aux Réglages, où les équipes vivent déjà. Créer un écran
  pour honorer une maquette aurait ouvert une porte sur rien.
- **Le prénom** vient de la session ; absent, le salut disparaît plutôt que
  d'afficher « Bonjour ».
- **La note vocale quitte les cartes** — sa maquette n'affiche que les photos.
  C'est une perte d'information, signalée et assumée.

### Comment il a été vérifié

`scripts/capture-accueil.mts` monte un vrai navigateur en 393 × 852, se connecte
avec le compte du banc, attend les polices, et capture le haut, le bas et la
barre isolée. Trois passages ont été nécessaires : la branche trop épaisse, puis
mal placée, puis le débordement. **Aucun de ces trois défauts n'aurait été vu
sans regarder.**

---

## 47. Les deux voix de l'écran retenu, et deux défauts que seule la capture voyait

*Étape 2 de la fin de refonte (`TODO.md` §7) : les corps d'Informations et de
Prix, 10 août 2026.*

### Pourquoi deux jetons de plus, et pas une valeur recopiée

La grammaire retenue le 10 août tient en quatre mesures — 9,5 px et 0,28 em
d'écartement pour un libellé, 11,5 px pour une phrase de situation. Elles
étaient **recopiées à la main dans chaque écran refait**, six fois. Un `0.28em`
mal retapé ne se voit pas en relecture, et `CLAUDE.md` §3 dit exactement ce
qu'il fallait faire : une allure s'ajoute aux pièces partagées, elle ne se
recopie pas dans un écran.

D'où `libelleCaps` et `texteSituation` dans `src/lib/design-tokens.ts`.

**`smallCaps` reste, et c'est délibéré.** C'est l'ANCIENNE voix (11 px, 0,18 em)
et elle sert encore les maquettes `/design/*`, découplées du produit depuis le
1er août. La renommer ou la changer aurait réécrit des pages qui ne sont plus
des écrans du patron. Conséquence utile pour la suite : **un écran qui importe
encore `smallCaps` n'est pas refait** — c'est le repère le moins cher pour
savoir où l'on en est.

### La couleur qui ne désignait rien

Trois encarts teintés en vert pâle disparaissent (la provenance des
informations, la mention « recopiée mot à mot », le brouillon obsolète). Aucun
ne demandait un geste au patron : ils décrivaient. La règle née de la maquette
12 s'applique — *une couleur qui ne veut rien dire est une couleur en trop*.

Ce qui **reste** en couleur d'attente, et rien d'autre : « à confirmer », « à
compléter », « prix à poser », l'avertissement de relecture, et le motif qui
grise « Préparer le devis ». Leur forme est l'« ourlet » de la maquette — un
cheveu d'or à gauche, sans fond.

### Deux défauts réels, tous deux invisibles aux suites

1. **La croix qui retire une ligne de prix sortait de l'écran.** Une ligne du
   détail porte deux champs ; le conteneur intérieur d'`AnimatedRow` n'avait pas
   de `min-w-0` et refusait donc de descendre sous la largeur intrinsèque de ses
   enfants. Le bouton était **bien dans la page** — les contrôles le trouvaient,
   le cliquaient, et passaient au vert — mais il se dessinait à 371 px sur un
   écran de 393, marge comprise : le doigt du patron ne pouvait pas l'atteindre,
   et c'est la seule façon de retirer une ligne.

   *La leçon, et elle n'est pas nouvelle :* un contrôle qui clique par sélecteur
   ne dit rien de l'atteignabilité. Ce qui l'a montré est une **mesure** —
   `getBoundingClientRect` sur la croix, comme la boîte de la barre basse au §46.

2. **La bulle de l'assistant mordait sur « Préparer le devis ».** Soixante-quatre
   pixels de talon en bas de page ne suffisaient pas ; il en faut cent douze.
   Vu sur la capture du bas, jamais autrement.

### Un contrôle qui accusait au hasard

`verifier:memoire` déclarait `ARCHITECTURE.md` menteur parce qu'il y cite
`/tmp/atlas-prechauffage.json` — un chemin **d'exécution**, écrit par le
préchauffage du banc, donc présent ou absent selon qu'une machine tourne. Le
contrôle ne regarde plus que les chemins relatifs, c'est-à-dire ceux de ce
dépôt. Il sait toujours échouer : un chemin de dépôt inventé le fait rougir.

### Et trois contrôles rouges qui n'accusaient rien de réel

`innerText` rend le texte **tel qu'il s'affiche**. Depuis que les libellés sont
en capitales, ni « Prix Calculé » ni « Déjà au détail » ne s'y trouvent tels
qu'ils sont écrits dans le code. Deux de ces trois suites étaient rouges depuis
le matin du 10 août, avant ce lot. La troisième accusait le compteur de
l'accueil, alors que son sélecteur — `a[href^="/chantiers/"]` — comptait aussi
le lien d'une notification, qui défile avec la liste depuis le même jour ; il
vise désormais `a.atlas-brin`, une étiquette de code et non un libellé.

**Le réflexe à garder :** devant un contrôle rouge après une refonte, regarder
d'abord s'il lit du **rendu** ou de la **donnée**. Corriger le produit pour
satisfaire un contrôle qui lit du rendu, c'est défaire ce qui vient d'être
validé.

---

## 48. Le tiroir des retirés — une seule façon de supprimer, partout

*Cinquième et dernier choix arrêté par le patron sur les maquettes du 10 août
2026 : « je veux qu'il applique ce style à tout ce qu'on peut supprimer dans
l'appli ». `docs/INTEGRER-ORIGINE.md` §4 et §4 bis portent le dessin.*

### Ce que le geste déplace, et qu'il faut décider en le sachant

**La sécurité passe d'une confirmation AVANT à une réversibilité APRÈS.** Les
panneaux « Supprimer cette photo ? » et « Supprimer cette note vocale ? »
disparaissent : garder les deux ferait demander deux fois, et c'est le cœur de
ce que le patron a retenu. Ce n'est pas un allègement — c'est un déplacement,
et il ne tient qu'à une condition, celle du paragraphe suivant.

### Rien n'est écrit tant que le tiroir est ouvert

**C'est la seule promesse qui ne se vérifie pas à l'écran, et la seule dont
tout dépend.** La photo et la note vocale ont un fichier derrière elles, et
`supprimerPhoto` / `supprimerNoteVocale` mettent ce fichier en file de purge
**dans la même transaction** que la suppression (`fichiers_a_purger`). Appeler
le serveur au moment du geste aurait rendu « Annuler » menteur : la ligne
serait revenue, le fichier non. *Une annulation qui ne rend rien est pire que
pas d'annulation.*

D'où `useRetraits` : la ligne est **masquée**, jamais retirée de l'état de
l'écran, et l'écriture attend la fermeture du tiroir. Annuler n'est alors qu'un
oubli. L'ancienne mécanique — supprimer, puis RECRÉER à l'annulation — rendait
une ligne neuve avec un identifiant neuf, ce qui n'est pas la même chose.

**Trois sorties, et il en faut trois** : le minuteur (six secondes), le départ
de la page (`pagehide`), et le démontage. Sans les deux dernières, quitter
l'écran pendant le délai annulerait le retrait en silence, et le patron
retrouverait la ligne qu'il croit supprimée.

### Le glissement est un défilement natif, pas un suivi du doigt

`CarteGlissante` mesurait l'élan à la main — `touchstart`/`touchmove`/
`touchend`, une fonction de freinage, un seuil de chiquenaude : cent lignes
pour refaire ce que le système fait mieux. `.atlas-glisse` est un conteneur à
`overflow-x: auto` avec deux points d'accroche.

Quatre choses viennent avec, et aucune n'existait avant : l'inertie et le
rebond de la plateforme, `prefers-reduced-motion`, la molette et le pavé
tactile, et surtout un « Retirer » **atteignable au clavier** — le focus fait
défiler la colonne tout seul, là où l'ancienne carte devait sortir son bouton
de l'ordre de tabulation tant qu'elle était fermée.

### Seule la colonne du texte glisse — et le fond ne glisse jamais

La date et le fil ne bougent pas (`avant`), et le voile de 16 px fait
**dissoudre** le texte qui sort au lieu de le trancher en plein mot.

**Le fond est porté par l'enveloppe, qui reste en place** (`plage`). Vu en
capture, et c'est le seul vrai défaut de ce lot : sur le planning et les
tarifs, où la ligne est une carte, laisser le fond partir avec le texte tirait
le rectangle clair hors de l'écran, bordure tranchée net, « Retirer » posé sur
le fond de page. Ça se lisait comme un défaut d'affichage, pas comme un geste.

### Huit endroits, pas sept — et un qui ne prend pas le glissement

Le recensement de la fiche en comptait sept. **Le planning est le huitième** :
ses trois listes supprimaient par `CarteGlissante`. L'oublier aurait laissé la
moitié de l'ancienne mécanique debout.

**Les photos ne prennent pas le glissement, et c'est délibéré :** une vignette
carrée dans une grille de trois n'est pas une ligne, et y faire glisser un
texte qui n'existe pas n'aurait aucun sens. Elles gardent tout le reste — le
mot « Retirer », sa couleur, le tiroir, l'écriture différée — et se retirent
depuis la visionneuse, là où on les regarde.

### Ce qui reste refusé, et le dit

Un chantier facturé ne se retire pas : sa facture figure au relevé de TVA.
`CarteGlissante` portait `desactive` et ne faisait alors **rien du tout** — un
geste sans effet ressemble à une panne. Le glissement découvre désormais le
**motif** à la place du bouton. Et si le serveur refuse malgré tout — c'est lui
qui tranche —, la ligne revient avec sa raison plutôt que de disparaître à tort.

### Deux défauts que seule l'exécution pouvait trouver

1. **« Cannot access 'retraits' before initialization ».** Sur le devis complet,
   les totaux lisaient le crochet déclaré plus bas : zone morte temporelle,
   écran en 500, et **ni `tsc` ni `eslint` ne la voient**. Trouvé en ouvrant
   l'écran, pas autrement.
2. **Une heure perdue sur un défaut qui n'existait pas.** Les captures visaient
   `127.0.0.1` ; Next **refuse de servir ses ressources de développement à une
   origine qu'il juge étrangère**. La page arrivait rendue par le serveur et
   n'était jamais hydratée : les boutons existaient sans le moindre écouteur,
   on cliquait dans le vide, et tout accusait le retrait. C'est `localhost`
   qu'il faut viser. `scripts/capture-retrait.mts` attend désormais un marqueur
   posé **après** le premier effet (`data-atlas-vivant`), et **échoue** si ce
   marqueur n'arrive pas — en nommant le bon coupable.

### Ce qui n'a pas pu être éprouvé ici, et qui doit l'être au doigt

Le glissement horizontal du texte et l'accroche verticale du fil
(`scroll-snap-stop: always`) ne portent pas sur le même axe, mais ils se
disputent un mouvement en **diagonale** — le cas ordinaire d'un pouce. Un
navigateur piloté ne le reproduit pas. À essayer sur un vrai téléphone.

---

## 49. L'anneau muet et la pellicule — la fiche chantier

**Retenu par le patron le 10 août 2026, sur maquette**
(`maquettes/atlas-note-vocale.html`, `docs/INTEGRER-ORIGINE.md` §6 bis).

Sur la fiche, deux choses changent de nature. La ligne « Note vocale » devient
un **anneau muet** — un accès direct, sans libellé visible : on le touche, la
note se lit ; on le retouche, elle s'arrête ; on le pousse **vers le haut**,
« Retirer » se découvre dessous. Et les photos, qui n'étaient qu'un compteur
dans une liste, deviennent une **pellicule** dans le tiroir du bas.

`src/app/chantiers/[id]/AnneauNoteVocale.tsx` et `TiroirFiche.tsx`.

### Pourquoi un anneau plutôt qu'une ligne

Une ligne « Note vocale · 1 min 42 » annonce une note ; elle ne la joue pas. Il
fallait un écran de plus pour entendre ce que le patron venait de dire. L'anneau
supprime cet écran : la chose la plus fréquente — réécouter — devient le geste
le plus court.

**Aucun libellé visible, mais un nom accessible** (« Écouter la note vocale »).
Une icône muette pour l'œil ne doit pas l'être pour qui n'a pas l'usage de ses
yeux.

**La prise vaut 76 px quand le trait n'en dessine que 56.** Une icône fine qu'on
rate deux fois sur trois n'est pas élégante, elle est ratée.

### Ce que la maquette ne pouvait pas rendre, et qui est vrai ici

La maquette n'a **aucun JavaScript** — le lecteur du patron n'en exécute pas.
Son compteur est une horloge CSS et son onde un décor vraisemblable. Recopier
l'un ou l'autre aurait donné un écran qui ment.

- **Le compteur suit la lecture réelle** (`currentTime` / `duration`).
- **La hauteur des barreaux suit le volume réellement enregistré** : un
  `AnalyserNode` posé sur l'élément audio, l'écart quadratique moyen du signal
  — le volume *perçu*, pas le pic, qui ferait sauter l'onde sur un claquement.
- **L'ampleur se pose sur le CONTENEUR, jamais barreau par barreau** : une
  variable CSS (`--atlas-ampleur`) et un `scaleY`. Seize éléments remis en page
  soixante fois par seconde coûteraient plus que tout le reste de l'écran.
- **Le glissement est un défilement natif**, avec l'inertie de la plateforme :
  la maquette, elle, s'accrochait d'un cran.

### Cinq pièges, tous payés

1. **Un contexte audio naît suspendu, et se rendort en arrière-plan.** Suspendu,
   il ne laisse rien passer : la lecture avançait, le compteur courait, et
   l'onde mesurait un silence **que nous avions nous-mêmes créé** en intercalant
   l'analyseur. `resume()` à chaque appui, pas seulement au premier. Et
   `noeud.connect(destination)`, sinon le son se tait pour de bon.
2. **Le jeu de démonstration ne déposait aucun fichier** : il déclarait des
   clés de stockage sans octets derrière. `play()` était refusé, l'anneau
   restait inerte, et rien ne disait pourquoi. `seed.ts` fabrique désormais de
   vraies photos PNG et une vraie note WAV — une voix de synthèse à modulation
   syllabique, parce qu'un signal plat donne une onde plate.
3. **Le raccourci `animation:` remet `animation-play-state` à `running`.**
   Déclaré avant, il était silencieusement annulé : l'onde battait au repos, et
   un écran qui bat fait croire qu'un son sort du téléphone. La déclaration
   vient **après** le raccourci, dans la même règle.
4. **`display: flex` n'étire pas un `<button>`.** La maquette pose un
   `<label>` ; un contrôle de formulaire, lui, garde une largeur au contenu.
   « Retirer » se dessinait collé au bord gauche, son R à moitié hors de
   l'écran — **visible, touchable, et tous les contrôles au vert**. D'où
   `width: 100%`, et un contrôle qui mesure désormais l'écart au centre.
5. **`--atlas-barre` est une réserve de place (68 px), pas la hauteur que la
   barre dessine (49 px).** Le tiroir posé dessus laissait dépasser 84 px au
   lieu de 65 : une bande de pellicule affleurait sous le résumé, on voyait le
   haut de deux photos sans pouvoir les toucher. **Le tiroir mesure la barre
   réelle** plutôt que de corriger la variable — la corriger aurait déplacé le
   cheveu du bandeau sur tous les écrans, dont l'accueil, que le patron a
   arrêté.

### Le tiroir : il se clippe, et l'écran de dessous recule

Le tiroir ne se **déplace** pas sous l'écran, il **borne sa hauteur** : ce qui
dépasse au repos est exactement la prise, quelle que soit l'encoche du
téléphone. Et quand il monte, la scène du dessus recule
(`scale(.955) translateY(-16px)`, `brightness(.9)`) — même geste que la feuille
« Nouveau chantier » sur l'accueil, et pour la même raison : **c'est la
profondeur qui dit « on est passé au-dessus », pas un voile.** Sans ce recul, le
tiroir tranchait l'anneau par le milieu et l'écran avait l'air cassé.

L'état passe par un attribut sur la racine (`data-tiroir`), et non par une
propriété : la fiche est un composant serveur, et le faire descendre obligerait
à la rendre cliente entière pour un `transform`.

**La case « + » vient en PREMIER**, et la ligne « Photos · 6 photos »
disparaît. Posée en fin de pellicule, la case demandait de faire défiler six
photos pour ajouter la septième : sur un téléphone, ajouter une photo ne doit
pas se mériter. Quant à la ligne, elle comptait ce qui est désormais sous les
yeux — deux fois la même information sur un écran, c'est une de trop.

### Le retrait obéit au vocabulaire commun (§48)

L'anneau se retire comme une ligne se retire : **rien n'est effacé tant
qu'« Annuler » est à l'écran.** Le fichier ne part en file de purge qu'à la
fermeture du tiroir — une annulation qui ne rendrait que le texte serait pire
que pas d'annulation. C'est `useRetraits` qui porte le délai, ici comme partout
ailleurs.

**Et la consigne dit le geste RÉEL** — « Poussez l'anneau vers le haut ». Une
première version annonçait « faites descendre » alors que le doigt fait monter :
une consigne fausse coûte plus cher qu'aucune consigne.

### Ce qui n'a PAS été repris de la maquette, et par décision

La maquette montre autour de l'anneau une **scène** entière — grand titre serif,
phrase de situation — à la place de l'en-tête commun. **Elle n'est pas
appliquée, et c'est un choix du patron du 10 août 2026 :** *« N'y touche pas. »*

La raison tient en une ligne : `EnTeteEcran` est une pièce **partagée** par la
fiche, le planning, les terminés, les réglages et les six écrans d'étape. La
refaire pour la seule fiche désaccorderait cet écran de tous les autres ; la
refaire partout est un lot en soi, qui toucherait l'accueil — arrêté et non
rouvrable. **Cet écart avec la maquette est connu et voulu : ne pas le
« corriger ».**

### Ce que ce lot dit des contrôles

**Tous les défauts de ce lot ont été trouvés à l'œil, aucun par un contrôle** :
un libellé imprimé par-dessus un autre, une consigne inversée, une poignée qui
ne se dessinait pas, une cible tactile de zéro pixel, un mot centré qui ne
l'était pas. Les cinq états se capturent en une commande —
`npx tsx scripts/capture-fiche-note-vocale.mts <dossier> <id-chantier>` — et
ce script mesure ce que l'œil venait de voir, pour que la prochaine fois il le
voie avant nous.

Un point de méthode qui vaut au-delà de cet écran : **`Element.checkVisibility({
opacityProperty: true })`**. L'opacité propre d'un élément ne dit rien de celle
qu'il hérite de son parent — un libellé effacé passe sinon pour visible.

---

## 50. Deux phrases qui divergent, un banc rouge deux jours

**Le défaut.** Depuis le 9 août 2026 au soir, `banc-essai.yml` échouait à chaque
exécution sur `main`, avec ce message :

```
❌ l'adresse à ouvrir n'est annoncée nulle part
```

**Et l'adresse était annoncée**, mot pour mot, deux lignes plus haut dans le
même journal. Le message accusait le mauvais coupable — exactement ce que
`AGENTS.md` interdit : *« une erreur qui envoie chercher au mauvais endroit
coûte plus cher que pas d'erreur du tout »*.

**La cause.** Il y a deux façons de démarrer le banc, et elles ne disaient pas
la même chose :

| Ce qui démarre | Ce qu'il écrivait |
|---|---|
| `npm run essai` — l'atelier, tapé à la main | « L'application répond » |
| `npm run banc` — la version bâtie, démarrée SEULE à l'allumage | « Atlas répond » |

`.devcontainer/verifier.sh` cherchait la **première** phrase dans un journal
produit par le **second** script. Le basculement du banc de `essai` vers `banc`
(§45) a donc cassé ce contrôle sans que personne n'ait touché au contrôle.

**Ce n'est pas un accident, c'est une règle enfreinte.** `CLAUDE.md` §3 :
*« Jamais de règle dupliquée entre l'affichage et la vérification. Deux
implémentations finissent toujours par diverger. »* Elles ont divergé — et pas
seulement sur la phrase : `adressePubliquePossible()` était recopiée à
l'identique dans les deux fichiers.

**Le correctif.** `scripts/annonce-adresse.mjs` porte désormais l'annonce
entière, et les deux scripts l'appellent. Le marqueur cherché par le conteneur
y est **exporté** (`MARQUEUR_PRET`), et `scripts/test-annonce-adresse.ts` **lit
le fichier `.devcontainer/verifier.sh`** pour vérifier que la phrase qu'il y
cherche est celle que le module écrit. Recopier la phrase dans le test aurait
reproduit la duplication qu'on venait de supprimer.

Le test vise la ligne du `grep` **par ce qu'elle fait** — chercher dans
`/tmp/essai.log` — et non par son message d'échec : première version, il visait
le message, et reformuler celui-ci a suffi à lui faire contrôler la mauvaise
ligne. Vu en le jouant, pas en le relisant.

**Et le message désigne maintenant le bon coupable :** en cas d'échec, la fin du
journal de démarrage est recrachée. Sans elle, on part chercher une adresse
absente au lieu de lire ce que le démarrage a réellement dit.

---

## 51. Nommer les équipes — et se taire quand il n'y a personne

**Demandé par le patron le 10 août 2026 :** *« il faut que dans le fichier
réglages on puisse mettre le nom des équipes — soit équipe A équipe B, soit des
noms et prénoms. Mais s'il n'a pas d'équipe et qu'il ne met rien, il ne faut pas
qu'il y ait quand même écrit équipe A équipe B. »*

**Le principe qui tient tout le reste :** on n'invente jamais un nom, et on ne
laisse jamais deux lignes indiscernables.

| Combien d'équipes | Ce que Réglages propose | Ce que le planning écrit |
|---|---|---|
| **1** | rien à nommer — le bloc n'existe pas | **aucun nom d'équipe** |
| **2 et plus** | une ligne par équipe, un champ libre | le nom écrit ; à défaut « Équipe A », « Équipe B »… |

À une équipe il n'y a personne à distinguer, donc rien à écrire ; à deux, la
lettre est un repli assumé — elle ne prétend rien savoir de personne. C'est le
même arbitrage que pour les prix (`docs/AGENT.md` §3) : **sans source fiable, on
n'écrit pas.**

### Le repli est un AFFICHAGE, jamais une donnée

`equipes.nom` est **nullable et sans valeur par défaut**. Écrire « Équipe A » en
base au moment de l'insertion serait le piège exact que le patron désigne : la
lettre deviendrait indiscernable d'un nom qu'il aurait choisi, et le jour où il
repasse à une seule équipe, le planning aurait un nom à écrire là où il ne doit
rien écrire.

**Une seule fonction décide** — `libelleEquipe` dans `src/lib/equipes.ts`,
appelée par le planning comme par la revalidation serveur. Elle rend `null` pour
dire « n'écris rien », jamais une chaîne vide. Deux implémentations de cette
règle divergeraient, et le jour où elles divergent l'écran promet une équipe que
le serveur ne connaît pas — c'est exactement ce qui est arrivé aux deux phrases
d'annonce du banc d'essai (§50).

### Qui fait autorité sur le NOMBRE

**`entreprises.nombre_equipes`**, et la table `equipes` ne porte que des noms.

Le compteur existe déjà, il commande la planification (`departPossible`,
`jourRetenable`) et il est éprouvé. Lui substituer un `COUNT(*)` ferait dépendre
le calcul des disponibilités de lignes qu'aucun écran n'oblige à créer.

**Conséquence assumée : une ligne survit au-delà du compteur.** Redescendre de
trois à deux ne supprime rien ; remonter rend le nom écrit pour la troisième.
Effacer aurait été une perte silencieuse sur une donnée saisie à la main que
rien ne reconstitue.

### Trois pièges déjà payés

- **Ne pas proposer de nommer ce qui ne sera jamais lu.** À une équipe, le bloc
  des noms n'existe pas — il ne se grise pas. Le laisser serait un piège : le
  patron y écrirait un prénom qui n'apparaîtrait nulle part.
- **Le champ fait 17 px.** En dessous de 16, Safari zoome à la mise au point et
  l'écran saute sous le doigt.
- **Un contrôle de visibilité ne lit jamais `display` sur l'élément seul.** Les
  vingt lignes gardaient `display:flex` sous un parent caché, et le contrôle
  restait vert sur un écran vide. `Element.checkVisibility()`, jamais le style
  propre.

---

## 52. Le planning — le mois, et la journée qui s'ouvre dessous

**Variante « le mois », retenue par le patron le 10 août 2026 sur maquette**
(`maquettes/atlas-planning.html`, `docs/INTEGRER-ORIGINE.md` §6 quater).

Sept colonnes, **rien qui ressemble à un tableau** : pas de bordure, pas de fond
de case, un chiffre en serif de 15 px et un point de 5 px dessous. Le calendrier
doit se lire d'abord comme des chiffres.

### Cinq marques, pas quatre

| Marque | Ce qu'elle dit |
|---|---|
| rien | journée entièrement libre |
| anneau creux | il reste de la place — au moins une équipe libre |
| demi-disque haut | le matin est complet **pour toutes les équipes** |
| demi-disque bas | l'après-midi est complet |
| disque plein | journée pleine |

**Quatre ne suffisaient plus dès qu'il y a plusieurs équipes** : sans l'anneau
creux, un jour à moitié pris se lisait comme un jour libre, et la collision se
découvrait en ouvrant la journée. Les marques se calculent dans
`marqueDuJour` (`src/lib/mois.ts`) à partir de l'occupation réelle — et
**« complet » se compte PAR ÉQUIPE**, ce qui est tout l'objet du compteur de
Réglages.

### La grille doit dire vrai

`grilleDuMois` cale la semaine sur **lundi** : `(getUTCDay() + 6) % 7`. Le 1er
août 2026 est un **samedi** ; un calage sur dimanche pose quatre cases de
juillet au lieu de cinq et **tout le mois glisse d'un jour**. Tous les chiffres
sont là, aucun n'est en trop, et le calendrier est faux — invisible à la
relecture, évident sur une capture. D'où des contrôles sur les colonnes du 1er,
du 10, du 15 et du 31 (`scripts/test-mois.ts`), confrontés au défaut qu'ils
prétendent détecter.

### La journée s'ouvre SOUS le calendrier, et s'amène à l'écran

Deux fois de suite le patron a écrit « rien ne s'ouvre quand je touche un jour »,
avec quarante contrôles au vert : posée plus bas, la journée s'ouvrait hors du
champ et l'écran paraissait mort. Elle se pose donc **directement sous la
grille**, et un `scrollIntoView` l'amène au centre — c'est ce que la maquette
obtenait par une ancre et `scroll-margin-top`.

**Une case du mois voisin fait basculer le calendrier sur son mois.** Sans cela
l'écran affichait « Lundi 27 juillet » sous un titre « août » : les deux se
contredisaient et rien ne disait lequel croire. Vu en capture.

### Poser, c'est dire à la fois QUAND et QUI

Une ligne par équipe sous chaque demi-journée, un filet dessous, jamais un
cadre. Le bouton **ne s'arme qu'une fois l'équipe choisie** — une date sans
équipe laisse le travail à moitié fait — et il n'y en a **qu'un seul**, jamais
trois lignes : « Poser · matin · Théo → ».

**Deux colonnes quand il y a une équipe à nommer, une seule sinon.** À une
équipe, « Libre » — ou le nom du chantier — tient la place du nom et la colonne
de droite n'existe pas. L'écrire des deux côtés mettait « Libre » deux fois sur
la même ligne. Vu en capture, comme le reste.

**Le choix est revalidé au serveur**, jamais cru sur parole : entre l'affichage
et l'appui, un client a pu retenir ce créneau. `CreneauIndisponible` porte le
jour et le moment, pour que l'écran DISE lequel vient de partir — sinon le
patron réessaie le même et ne comprend pas pourquoi rien ne se passe.

### Le rang est écrit en clair

Sur la maquette, `label:nth-of-type(n)` comptait dans son propre bloc et allumait
la ligne choisie sur le matin **et** l'après-midi à la fois. Ici la clé porte le
moment ET le rang, et un contrôle vérifie qu'**une seule** ligne s'allume.

### Le trait du bandeau

Il doit tomber sous **l'onglet actif**. Recopié depuis un écran où le premier
onglet était choisi, il est resté sous « CHANTIERS » pendant que « PLANNING »
était le mot allumé — 77 px d'écart, vu par le patron sur une capture pendant
que le contrôle du libellé restait vert. Le contrôle mesure désormais l'écart
entre le centre du trait et le centre du **texte** de l'onglet
(`Range.getBoundingClientRect`) : la boîte du libellé vaut sa colonne entière et
masquait le décalage.

---

## 53. « Terminés » — le fil par mois, et facturer en trois appuis

**Choisi par le patron le 10 août 2026 sur maquette**
(`maquettes/atlas-facturer.html`, `docs/INTEGRER-ORIGINE.md` §6 quinquies).

### Ce qui clochait, et qui n'était pas une affaire de goût

L'écran empilait **trois sortes de pavés arrondis** — le relevé de TVA, les
chantiers à facturer, les factures. Le relevé de TVA était le **seul cadre
plein**, si bien que l'œil allait d'abord sur ce qu'on consulte une fois par
trimestre. « Rien à facturer » s'affichait comme un **titre de section suivi de
rien** : l'écran avait l'air amputé au lieu d'avoir l'air calme. Et il **ne
disait jamais combien**, alors que c'est la seule question qu'on lui pose.

### Le fil, et l'encart posé DANS le mois

Le même fil que la liste des chantiers — deux écrans qui se ressemblent
s'apprennent une seule fois. **Des filets, jamais de pavé** : aucun fond plein
ni coin arrondi dans le corps.

**Un chantier non facturé reste dans SON mois.** Le chantier du 20 août est un
chantier d'août ; le sortir dans un bloc à part casserait le fil, qui ne
raconterait plus le temps mais deux listes empilées. Une pastille bronze posée
**sur le fil** porte le nombre, et une ligne de 44 px l'annonce en toutes
lettres — « Deux à facturer · 1 940,00 € ». **Repliée au repos** : l'écran
s'appelle « Terminés », il montre d'abord ce qui est fait ; l'encart appelle, il
n'occupe pas.

**À zéro, l'encart n'existe pas.** Jamais de « 0 », jamais de compte au
singulier bancal.

**Le montant vient du devis, et l'écran le dit** — « Montants prévus aux
devis », jamais « à encaisser ». Un devis n'est pas une facture, et le montant
peut encore bouger (`docs/AGENT.md` §3). La source se dit **une fois**, sous les
lignes : la répéter sur chacune y ajoutait une étiquette insécable, et une
étiquette insécable dans une piste `1fr` élargit la piste.

### Créer n'est pas envoyer

La facture naît d'un appui, elle part d'un autre : c'est l'envoi qui la rend
définitive et la porte au relevé de TVA. Fondre les deux ferait partir un
document chez le client sur un geste destiné à le préparer. L'écran le dit **aux
deux étapes**, et `terminerChantier` reste **idempotente** — rappuyer redonne la
facture bâtie au lieu d'en créer une seconde.

**« Fin de chantier » devient « Créer la facture »**, décidé par le patron le
10 août 2026. L'ancien nom ne disait pas ce que la touche fabrique. Le mot est
changé sur les **trois** écrans qui le portaient — fiche du chantier, planning,
écran de facture : un même geste ne peut pas s'appeler de deux façons selon
l'endroit d'où on l'atteint.

### Deux défauts que seule la capture a vus

- **Une ligne trop longue déborde toujours du côté de la fin de ligne**, quel
  que soit `text-align`. « juillet » ne tient pas dans les 47 px de la marge : il
  débordait **à droite**, sous la pastille, dont le fond opaque lui mangeait sa
  dernière lettre. `justify-self: end` fait tenir la boîte au texte et la colle à
  la fin de colonne — ce qui dépasse part alors dans la marge de 26 px, où il y a
  la place. Mesuré au pixel, pas supposé.
- **Un montant inconnu s'écrivait « 0,00 € ».** Un chantier sans devis chiffré
  n'attend pas zéro euro : on ne sait pas. L'encart n'affiche donc son montant
  que si au moins un est connu — sinon il dirait au patron qu'il n'y a rien à
  encaisser là où il y a peut-être tout.

### Ce que les contrôles doivent savoir faire

- **`Element.checkVisibility()` ignore le rognage** : les lignes d'un volet
  fermé lui paraissent visibles. On mesure l'**intersection réelle** avec la
  boîte du volet.
- **Un contrôle de mise en page ne voit que ce qui lui est donné à voir** :
  interroger le document entier ramenait le bandeau du bas et la bulle de
  l'assistant, et accusait « Terminés » de pavés qui ne lui appartiennent pas.
  La sonde est bornée à `[data-atlas="ecran-termines"]`.
- **Les montants d'une même colonne finissent au même pixel**, et rien ne
  s'ajoute après : un chevron en bout de ligne leur volerait 24 px.

### Ce qui a été vérifié et n'était pas un défaut

`listerChantiersTermines` compte un chantier du 20 comme terminé **le 21**, pas
le 20 à minuit : `ongletDepuisJalons` range sur `datePlanifiee < aujourdHui`, et
la journée entière reste au planning. C'est de là que le patron clôture en
rentrant.

---

## 54. Une session dont le compte n'existe plus, et là où ce contrôle doit vivre

**Le fait.** Un cookie de session Auth.js est **signé** : il reste valide même
quand la ligne `users` qu'il désigne a disparu. Refaire le jeu de démonstration
suffit à fabriquer un fantôme. `auth()` rend alors un `utilisateurId`,
l'application laisse entrer, et **toute écriture** est refusée — clé étrangère,
puis politique RLS. Le patron a vu « aucune adhésion d'entreprise », puis un
`insert` en échec, sans que rien ne relie ces messages.

**La décision : le contrôle vit dans le LAYOUT, pas dans la page.**

Écrit d'abord dans `src/app/documents-legaux/page.tsx`, il **ne fonctionnait
pas**, et rien ne le disait. Une page rend sous la frontière de
`src/app/loading.tsx` : quand elle décide, l'enveloppe HTML est déjà partie. Le
`redirect()` ne peut plus devenir un 307 — Next.js répond **200** et enfouit
`NEXT_REDIRECT;replace;/api/session-perimee` dans la charge React, que seul le
navigateur rejoue, **en JavaScript**. Mesuré à `curl` : 23 ko de page, et le
contrôle au vert.

`GardeDocumentsLegaux`, rendu dans `src/app/layout.tsx`, précède le premier
octet : son renvoi est un vrai 307. La règle qui en découle dépasse ce cas —
**tout contrôle d'accès qui doit valoir sans JavaScript appartient au layout.**

**La deuxième décision : un `Location` relatif.** `NextResponse.redirect` exige
une adresse absolue, qu'on ne peut fabriquer que depuis `request.url` — soit
l'adresse d'**écoute**, `http://0.0.0.0:3000`. La route répondait donc
`location: http://0.0.0.0:3000/login`, une adresse morte derrière le relais d'un
espace de travail distant. `/login?session=perimee`, relatif, est résolu par le
navigateur contre l'adresse qu'il a lui-même ouverte : aucun relais ne peut le
tromper.

**La troisième : deux situations, deux remèdes.** « Le compte n'existe plus » et
« le compte n'a aucune entreprise » se ressemblent à l'endroit du code où on les
rencontre (`resoudreEntrepriseId`), et n'appellent pas du tout la même réponse.
Effacer la session du second l'enferme : il se reconnecte, n'a toujours pas
d'entreprise, repart vers l'effacement. Les deux cas sont distingués par
l'existence du compte ; l'anomalie de données lève `AucuneEntrepriseError`,
comme avant.

**Ce que le test tient** (`scripts/test-session-perimee-e2e.ts`, cinq contrôles) :
le **statut** du renvoi et pas seulement sa destination — un 200 y est un échec,
puisque c'est la forme exacte qu'avait le défaut ; le caractère relatif du
`Location` ; l'effacement des deux familles de cookies ; qu'une session **valide**
n'est jamais renvoyée là ; et le parcours entier dans un vrai navigateur,
**JavaScript coupé**. Chaque contrôle a été vu échouer sur l'état dégradé qu'il
prétend détecter, et sur lui seul.

**Et la règle d'outillage qui manquait.** `no-undef` est éteint par défaut sur
les fichiers JavaScript, et TypeScript — qui joue ce rôle ailleurs — ne les
regarde pas. `scripts/banc.mjs` lisait une variable `bati` inexistante : le banc
mourait **après la construction**, une fois annoncé prêt. La règle est activée
dans `eslint.config.mjs` pour tout le JavaScript du dépôt, avec les globales
lues sur `globalThis` du processus qui joue ESLint — les énumérer à la main
condamnerait à un faux positif le jour où un script emploie `structuredClone`,
et un contrôle qui accuse à tort coûte plus cher que pas de contrôle.

---

## 55. Une déclaration ne répare pas un espace déjà né

**Le fait, constaté trois fois.** `devcontainer.json` et `docker-compose.yml`
sont lus à la **création** de l'espace de travail. Une ligne ajoutée après coup
y est exacte et **sans le moindre effet** sur un espace existant — et rien ne le
signale, ni au démarrage, ni dans l'éditeur.

| Ce qui a été déclaré | Où | Ce que ça a coûté |
|---|---|---|
| `ATLAS_BANC_ESSAI=1` | `docker-compose.yml` | deux correctifs de suite restés inertes, sans message |
| `CODESPACE_NAME` | `docker-compose.yml` | l'adresse publique introuvable |
| `portsAttributes.3000.visibility: "public"` | `devcontainer.json` | une soirée : GitHub répondait `/pf-signin` à la place d'Atlas, et le téléphone ne voyait rien |

**La règle qui en découle.** Tout réglage d'environnement dont dépend le banc se
rejoue **à chaque allumage**, depuis `.devcontainer/demarrer.sh` — un fichier du
dépôt, qui descend avec le code. La déclaration reste, pour les espaces à naître ;
le geste la double, pour ceux qui existent déjà. Les deux ne font pas double
emploi : ils couvrent deux populations différentes.

C'est ce que font `ATLAS_PROFIL=banc` (§45) et, depuis le 10 août 2026,
`ouvrir-port.sh`.

**Et le verdict se dit.** Le taire était la moitié du défaut : l'application
répondait parfaitement, et c'est GitHub qui parlait à sa place. Sans `gh`, ou si
`gh` refuse, le démarrage affiche la commande de secours plutôt que de laisser
croire que tout va bien.

**Éprouvé avec un FAUX `gh`.** L'agent n'a ni espace GitHub ni `gh` : un contrôle
qu'on ne peut pas jouer ne prouve rien. `scripts/test-ouvrir-port.ts` pose un
`gh` factice devant le vrai dans le `PATH` et vérifie la commande exacte envoyée
— une commande approchante ne ferait rien, en silence — puis les deux modes de
panne, puis **que `demarrer.sh` l'appelle vraiment**.

Ce dernier point mérite son existence : un script juste que personne n'appelle
ne répare rien, ce qui est précisément le défaut d'origine. Et il a commencé par
rester **vert alors que l'appel avait été supprimé** — il lisait le commentaire
qui le surplombe, où le nom du script figure. Les commentaires sont maintenant
retirés avant de regarder. Même piège que le test de l'annonce d'adresse (§50) :
un contrôle qui vise un texte au lieu d'un geste ne contrôle rien.

**Et le remède indiqué doit exister sur la machine qui le lit.** Le premier
message donnait `gh codespace ports visibility …` ; le patron a reçu
**« bash: gh: command not found »**. L'image de ce conteneur,
`mcr.microsoft.com/devcontainers/typescript-node:22`, n'embarque pas `gh` —
l'image Codespaces par défaut si, et c'est de là que venait la méprise. Le geste
à la souris (onglet **PORTS** → clic droit → « Visibilité du port » → « Public »)
passe donc devant partout : il ne demande d'installer rien. `gh` est réclamé par
une fonctionnalité de `devcontainer.json`, ce qui ne vaut — encore une fois —
que pour les espaces à naître.

Le diagnostic recopiait ce remède quatre fois. Il est désormais écrit une seule
fois (`OUVRIR_LE_PORT`), et `test-ouvrir-port.ts` échoue s'il réapparaît en
double : deux copies d'un message finissent toujours par diverger, et c'est
celle qu'on a oublié de corriger que le patron lira.

---

## 56. La bascule et le veilleur : deux scripts justes qui se tuaient l'un l'autre

**Le fait, lu chez le patron le 10 août 2026 :**

```
Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
errno: -98, syscall: 'listen'
```

suivi, deux lignes plus bas, d'une **seconde** construction qui démarrait.

**Ni `banc.mjs` ni `veiller.sh` n'avait tort. C'est leur rencontre qui tuait
l'application** — et aucun contrôle ne les regardait ensemble. C'est la leçon
générale de cette section : un défaut peut n'exister dans aucun des fichiers où
on le cherche.

### La fenêtre de quinze secondes

1. `banc.mjs` tue son `next dev` pour libérer le port ;
2. pendant ce battement, la santé ne répond plus **et** aucun processus `next`
   ne tourne — les deux conditions que `veiller.sh` exige, mot pour mot, pour
   conclure « le serveur est mort » ;
3. le veilleur lance `npm run banc`. Un second banc démarre et prend le port ;
4. le `next start` du premier tombe sur `EADDRINUSE`.

Le veilleur ne **peut pas** distinguer une mort d'un remplacement : les deux se
ressemblent trait pour trait. Il faut le lui dire — c'est tout l'objet de
`.devcontainer/bascule-en-cours.sh`, seul à connaître le chemin du drapeau.

**Le drapeau EXPIRE, et ce n'est pas un détail de confort.** Un banc tué pendant
sa bascule laisserait sinon un drapeau éternel, et le veilleur ne relèverait plus
jamais rien — le 404 du 9 août reviendrait, sans que rien ne le relie à ce
fichier. Trois minutes : au-delà, on préfère une bascule bousculée à un veilleur
muet. Même raisonnement pour un contenu illisible : on retombe toujours du côté
du veilleur actif.

### Et rien n'empêchait d'en lancer un second à la main

L'espace démarre un banc tout seul à chaque allumage. Ne voyant rien venir, le
patron en a lancé un autre. `essai.mjs` refuse ce doublon depuis le 9 août, mais
**en regardant le port** — ce qui ne suffit pas ici : pendant sa construction, un
banc n'y répond pas encore. Ce n'est pas le port qu'il faut regarder, c'est
l'existence d'un autre banc.

`scripts/verrou-banc.mjs` porte donc un **identifiant de processus**, jamais un
simple drapeau : un verrou laissé par un banc tué, ou par un conteneur précédent,
bloquerait sinon tout démarrage ultérieur — et l'application ne reviendrait plus.
C'est la prudence déjà prise par `veiller.sh` pour son propre verrou.

### Ce qui a été éprouvé, et comment

Le geste exact du patron a été rejoué : veilleur en place, un banc lancé par lui,
puis un second à la main. Le second est refusé avec un message qui dit pourquoi ;
le premier va au bout de sa bascule — « Version rapide en place », **zéro
`EADDRINUSE`**, `/login` servi en 68 ms.

`scripts/test-bascule-veilleur.ts` tient douze points, chacun vu échouer sur
l'état dégradé qu'il prétend détecter. L'un d'eux est resté **vert alors que la
consultation du drapeau avait été remplacée par `if false`** : il cherchait
`$BASCULE` n'importe où, et la ligne qui *déclare* le chemin le satisfaisait. Il
vise maintenant l'appel. Deuxième fois dans la même soirée qu'un contrôle
regarde une mention au lieu d'un geste — c'est le piège de §50, et il se
reproduit chaque fois qu'on éprouve un branchement par une chaîne de caractères.

**Et une troisième panne, le même soir, au même endroit : le terminal.**

```
✓ Compiled successfully in 62s
> Build error occurred
Error: setRawMode EIO   (errno -5, syscall 'setRawMode')
Segmentation fault (core dumped)
```

La construction avait **réussi** ; elle est morte en rendant la main. Quand son
entrée est un vrai terminal, Next.js tente d'en prendre le contrôle pour écouter
les touches — et dans un espace distant, ce terminal peut disparaître sous lui.
L'appel échoue en `EIO`, que la couche native ne rattrape pas.

Aucun enfant du banc ne reçoit plus d'entrée : `["ignore", "inherit", "inherit"]`
partout. `isTTY` devient faux et l'opération n'est même plus tentée ; la sortie
reste héritée, et **Ctrl+C continue de fonctionner** — il passe par le groupe de
processus du terminal, jamais par l'entrée de l'enfant.

Mesuré plutôt que supposé : un enfant lancé avec l'entrée héritée depuis un vrai
terminal voit `isTTY=true` et obtient `setRawMode` ; entrée coupée, `isTTY=false`
et l'appel n'est plus possible. Puis le banc entier a été joué **dans un vrai
terminal** (`script -qec`) : construction menée à son terme, aucun `setRawMode`,
aucune segmentation fault, application servie en 7 ms.

**Et le remède lui-même a tourné en rond — la panne la plus coûteuse du lot,
parce qu'elle rendait l'application inutilisable là où le défaut d'origine ne
faisait qu'agacer.**

```
GET /login?session=perimee  307 → /api/session-perimee
GET /api/session-perimee    303 → /login?session=perimee
```

Il fallait **deux** causes, et chacune masquait l'autre :

1. **`__Secure-` et `__Host-` exigent l'attribut `Secure`.** Sans lui, le
   navigateur **jette** le `Set-Cookie` — la règle des préfixes le lui impose.
   Derrière le relais d'un espace de travail, tout est en HTTPS : c'est donc
   `__Secure-authjs.session-token` qui porte la session, et c'est lui qui n'était
   pas effacé. **Vu à `curl`, l'en-tête paraissait parfait** : le serveur ne
   l'oubliait pas, c'est le navigateur qui refusait. Le contrôle regardait la
   présence du cookie dans la réponse, jamais ses attributs.
   L'inverse compte autant : poser `Secure` sur un nom sans préfixe le rendrait
   inopérant en clair, c'est-à-dire sur le banc local. **L'attribut suit le NOM**,
   jamais une supposition d'environnement.
2. **`/login` était soumis au contrôle du compte.** C'est ce qui transformait une
   panne en boucle : renvoyée vers l'effacement, la page de connexion y
   retournait au tour suivant. Elle en est exemptée — il n'y a rien à y protéger,
   et la connexion remplace le cookie de toute façon.

**Ce qu'on en retient au-delà de ce cas :** un parcours de redirections doit être
éprouvé **jusqu'à son terme**, jamais saut par saut. `test-session-perimee-e2e`
échoue désormais si une adresse est traversée deux fois, et son message affiche
le chemin exact.

**Et `portRendu` posait la mauvaise question.** Il interrogeait
`/api/health/live` et concluait « port rendu » dès qu'il ne répondait plus. Un
serveur qu'on vient de tuer cesse de répondre bien avant de rendre sa socket, et
un processus qui tient le port sans servir Atlas ne répond à cette route dans
aucun cas — d'où le retour d'« EADDRINUSE » malgré le verrou et le drapeau. On
demande maintenant au système, en essayant d'écouter dessus : c'est la seule
question dont la réponse engage `next start`. Éprouvé dans les trois états —
port vide, port occupé, port relâché.

**Et la cause première, trouvée après quatre correctifs : le serveur n'est pas
l'enfant qu'on croit.**

`npx next dev` est une pile d'enveloppes ; le processus qui ÉCOUTE se renomme
`next-server` et **survit à la mort de son père**. Tuer l'enfant qu'on connaît ne
libère donc pas le port. Le dépôt le savait — c'est écrit dans `veiller.sh`
depuis le 9 août — et s'en remettait à `pkill -f "[n]ext-server"` : on ne visait
pas des processus, on visait un **motif**. Ça marchait sur la machine de l'agent,
et pas chez le patron.

Le serveur est donc lancé `detached: true`. Il devient chef de son propre groupe,
et `process.kill(-pid)` emporte l'enveloppe et le serveur, sans dépendre d'un nom
de processus ni de la présence de `pkill`.

Mesuré hors d'Atlas, en isolant le mécanisme :

| | port pris avant | port libéré après |
|---|---|---|
| enfant tué seul | oui | **non — l'orphelin tient le port** |
| groupe tué | oui | **oui** |

**Les deux moitiés vont ensemble, et un contrôle l'exige.** Détaché sans
transmission du signal, le serveur ne meurt plus avec le banc : chaque Ctrl+C
laisserait un orphelin accroché au port — c'est-à-dire la panne qu'on répare.
C'est aussi, rétrospectivement, ce qui condamnait chaque tentative suivante du
patron : il avait fait plusieurs Ctrl+C dans la soirée.

---

## 57. L'anneau au centre de la fiche — et ce qu'un écran vidé emporte avec lui

**Le patron, le 11 août 2026, devant la fiche d'un chantier qu'il venait de
créer :** *« pourquoi on est encore sur cette page, il manque la note vocale au
milieu »*. Puis, deux fois de suite, la même demande : *« ça ressemble toujours
pas à la maquette »*, *« exactement, respecte strictement ma maquette »*.

### L'anneau n'était pas absent : il était un lecteur

Le défaut était plus profond qu'un anneau manquant. L'anneau ne naissait
qu'**après** la dictée — il servait à réécouter — et la dictée arrivait en
**deuxième** action, derrière les photos (`src/lib/chantier-etat.ts`). Sur un
chantier neuf, c'est-à-dire au moment précis où l'artisan veut parler, le cœur
du produit était donc caché derrière autre chose.

Il est désormais **un objet à deux états**, jamais deux boutons :

| État | Ce qu'il est | Le geste |
|---|---|---|
| pas de note | un micro | un appui dicte, un second arrête et enregistre |
| une note, audio présent | un lecteur | une poussée joue |
| une note, audio purgé | absent | la ligne du tiroir mène à l'écran qui l'explique |

Le troisième cas est une exception vraie, pas un oubli : l'audio est effacé une
fois la transcription obtenue (`docs/RGPD.md` §4). La note **existe** encore ;
proposer d'en dicter une autre à cet endroit effacerait le travail déjà fait.

**Le magnétophone est écrit une seule fois** (`src/app/chantiers/[id]/magnetophone.ts`).
L'écran de dictée savait déjà capter le son ; recopier ces trente lignes dans
l'anneau, c'était s'assurer qu'un jour l'un corrige un défaut que l'autre garde
(`CLAUDE.md` §3). Le module capte, compte et rend un `Blob` — ce qu'on en fait
ensuite regarde l'appelant, sans quoi il ne servirait qu'un seul des deux.

### Ce qu'un écran vidé emporte, et qu'il faut rattraper

Sa maquette (`maquettes/atlas-note-vocale.html`) ne montre **aucun bouton** :
un statut, un titre, une phrase calme, l'anneau. Le corps de la fiche a donc été
vidé — et **six suites sont tombées d'un coup**, toutes sur la même phrase
manquante.

Ce n'était pas du bruit. Le bouton portait la **seule** indication de la marche
à suivre, et le tiroir fermé ne montre qu'un état. Un écran qui ne dit pas où
l'on va se lit comme une application en panne — c'est déjà écrit dans le cas
« rien à faire », trois lignes plus haut dans le même fichier.

Deux règles en sont sorties, et elles valent pour tout allègement d'écran :

1. **Alléger, c'est déplacer, pas supprimer.** L'étape suivante est passée dans
   le bandeau du tiroir (`Ajouter des photos →`), la rédaction à la main dans
   sa liste. Les deux étaient des demandes du patron, des 3 et 4 août ; ce lot
   les aurait défaites en silence.
2. **`getSecondarySteps` est appelé SANS `nextAction.key`.** Il excluait
   l'étape suivante parce qu'elle vivait dans le bouton. Le bouton parti, le
   tiroir est le seul endroit où elle vive : l'exclure la ferait disparaître de
   l'application entière.

Un contrôle garde cette frontière dans les deux sens
(`test-anneau-dictee-e2e.ts`, *« le corps ne porte que l'anneau, et le tiroir
garde tout le reste »*) : il échoue si l'on remet un bouton dans le corps, et il
échoue si l'on oublie de descendre une entrée dans le tiroir.

### Trois réglages facultatifs plutôt qu'un en-tête de plus

La maquette pose le client **avant** le titre, en serif gris, la pastille de
facturation sur la ligne de la flèche, et ne ferme pas l'en-tête d'un trait.
Rien de tout cela n'est du goût pur : à côté du titre, la pastille lui prend la
moitié de la largeur et casse « Intervention prévue vendredi 15 août. » en
**quatre** lignes au lieu de deux.

`EnTeteEcran` reçoit donc `precisionPlacee`, `cheveu` et `actionPlacee`, **avec
les valeurs par défaut d'avant**. La grammaire commune posée le 10 août pour
tous les écrans n'est pas touchée ; seule la fiche demande autre chose. Un
composant partagé qu'on fait diverger par ses défauts fait diverger tous ses
appelants — c'est le contraire de ce pour quoi il existe.

### La leçon qui dépasse cet écran : supposer n'est pas comparer

Il a fallu qu'il le dise **deux fois**. Entre les deux, j'avais relu la maquette
au lieu de la **rendre** : côte à côte avec l'écran, une seule capture a montré
ce que trois lectures n'avaient pas vu — l'anneau portait un point là où le sien
porte trois barres, et sa maquette ne montre aucun bouton.

Deux défauts de mise en page ont été trouvés de la même façon, et par aucun
contrôle : sans note, l'anneau réservait encore la place du glissement
« Retirer », du compteur et du tiroir « note retirée » — trois choses qui
n'existent pas encore — ce qui poussait « ou rédiger le devis à la main » sous
la bulle de l'assistant. Le lien existait, il était touchable, il était
illisible.

**Et le contrôle qui aurait dû le voir mesurait un écran que personne ne
possède.** Les suites posaient 393 × 852 ; la hauteur utile d'un vrai iPhone 13,
barre du navigateur déduite, est de 390 × **664**. Sur ce cadre trop haut, la
bulle tombait 190 px plus bas et ne recouvrait rien. `test-anneau-dictee-e2e.ts`
emploie `devices["iPhone 13"]`, et sa version rouge a été vérifiée sur la mise
en page d'avant. **Les autres suites ont encore l'ancien cadre** : elles peuvent
donc rater les défauts de bas d'écran.

---

## 58. L'écran des suites : un seul endroit, et un contrôle qui cherche ce que le doigt n'atteint pas

**Le patron, le 11 août 2026 :** *« fais tout ce que tu penses qu'il faut faire
pour que l'application fonctionne »*, après avoir appris qu'il restait
trente-trois suites cadrant un écran que personne ne possède.

### Le cadre était faux, et de la pire façon : trop grand

| | Ce qu'on posait | Ce que le patron a |
|---|---|---|
| largeur | 393 | **390** |
| hauteur | 852 | **664** |

852, c'est la **dalle** d'un iPhone 14. La page, elle, n'a que ce qui reste une
fois la barre d'adresse du navigateur installée. Cent quatre-vingt-dix pixels de
bas d'écran fantômes — assez pour qu'une bulle flottante tombe dans le vide au
lieu de recouvrir un lien. C'est exactement ce qui s'est produit la veille
(§57) : le contrôle existait, il était juste, et il mesurait un écran imaginaire.

**Un contrôle qui mesure un écran que personne ne possède ne prouve pas qu'il
n'y a pas de défaut : il prouve qu'il ne sait pas le voir.**

### Posé à un seul endroit, comme le délai d'attente

`ECRAN_DU_PATRON` vit dans `scripts/e2e-browser.ts`, à côté de
`DELAI_PAR_DEFAUT_MS`, et pour la raison qui y est déjà écrite : *« une valeur
par site d'appel, c'est trente endroits à corriger et vingt-neuf oublis. »*
Quarante-et-une suites et vingt-neuf scripts de capture ont perdu leur cadre
écrit à la main.

**Il se propose, il ne s'impose pas.** `newContext()` applique le téléphone
seulement quand l'appelant ne dit rien. Une suite qui passe son propre
`viewport` le garde — `test-devis-complet-e2e.ts` ouvre délibérément le devis
sur 1024 × 900, parce qu'un devis se lit aussi sur un écran d'ordinateur. Lui
refuser ce cadre remplacerait un mensonge par un autre.

C'est `devices["iPhone 13"]` de Playwright, et non trois nombres recopiés : la
valeur est tenue à jour par des gens dont c'est le métier.

**Deux tolérances inventées sont tombées avec le cadre**, et elles méritent
d'être nommées parce qu'elles se ressemblent : un contrôle de débordement
mesurait contre « 400 px » sur un écran de 393 — sept pixels de marge qu'on
s'accordait à soi-même —, et la grille des prix se cadrait à 393 là où le vrai
téléphone en fait 390. Une tolérance écrite à la main finit toujours par couvrir
un débordement véritable ; on mesure désormais contre la largeur **réelle** de
la fenêtre.

### Ce que le cadre honnête a trouvé : rien — et c'est un résultat

46 suites sur 47, l'unique rouge étant un dépassement de délai du serveur de
développement (rejouée seule, elle passe). Aucun écran n'a bronché.

Il fallait pourtant le faire, et le dire tel quel plutôt que d'annoncer une
moisson qui n'a pas eu lieu.

**Mais « aucune suite n'a bronché » ne veut pas dire « rien n'est recouvert ».**
Ça veut dire qu'aucun contrôle existant ne l'aurait remarqué — et un seul écran
vérifiait ce genre de chose, pour un seul bouton
(`test-agenda-reglages-e2e.ts`). C'est le vrai trou, et le cadre juste ne le
bouchait pas.

### `test-rien-de-recouvert-e2e.ts` — le trou bouché

Quatorze écrans du parcours. Sur chacun, pour chaque lien, bouton et champ, une
question au navigateur : **qui répondrait au doigt en son centre ?** Si ce n'est
pas lui, quelque chose flotte au-dessus.

C'est la famille des trois défauts réels de ce dépôt — une barre de navigation
sur la page publique du client, une pile de notifications qui poussait le
contenu dehors, un lien sous la bulle — et **aucun des trois n'a été trouvé par
un test**. Ils se ressemblent tous : l'élément est dans le HTML, il répond même
au clic programmé, et le doigt ne l'atteint pas. Toute vérification par le texte
reste verte.

**L'essentiel du travail a consisté à l'empêcher d'accuser à tort.** Trois
versions successives criaient sur des écrans parfaitement sains :

1. **Un bouton sous la barre du bas n'est pas hors d'atteinte : il suffit de
   défiler.** On amène donc chaque cible au centre de l'écran *avant* de juger.
   Ce qui reste recouvert après ce geste l'est pour de bon — il n'existe aucune
   position où l'artisan l'atteindrait. Sans cela : une vingtaine d'accusations
   par écran.
2. **Un parent qui rogne cache sans masquer.** L'encart « à facturer », replié
   au repos, garde ses liens dans la page ; `checkVisibility` les dit visibles,
   puisqu'ils ne sont ni masqués ni transparents — ils sont seulement découpés
   par un `overflow: hidden`. Onze accusations pour des éléments qui n'étaient
   pas à l'écran du tout.
3. **La parenté directe n'est pas un recouvrement.** `elementFromPoint` rend
   l'élément le plus profond : un lien dont le centre tombe sur son propre
   libellé se dénonçait lui-même.

Chacune de ces trois exceptions écarte quelque chose qui **n'est pas** le défaut
cherché. Aucune n'a été ajoutée pour faire taire un rouge gênant — la distinction
est mince à l'écriture et décisive à l'usage : une suite bruyante finit ignorée,
et une suite complaisante ne sert à rien.

### Il sait échouer — vérifié sur les deux défauts qu'il vise

Le défaut du 11 août a été **reconstitué** dans la fiche chantier : un lien posé
là où flotte la bulle. La suite le nomme par son propre libellé, désigne le
coupable, et reste muette sur les treize autres écrans.

Et son garde-fou — *« la fenêtre est-elle bien celle d'un téléphone ? »* —
rougit dès qu'on lui repose l'ancien cadre :

```
✗ l'écran mesuré est celui d'un vrai téléphone (393×852)
  la fenêtre fait 393×852 : plus haute que la place réelle d'un téléphone
  (390 × 664). Sur ce cadre, cette suite ne peut RIEN attraper.
```

Ce garde-fou n'est pas un ornement. Sans lui, quelqu'un remettra un jour un
`viewport` dans cette suite, elle passera au vert d'un bout à l'autre sans rien
avoir éprouvé, et personne ne s'en apercevra — c'est mot pour mot ce qui est
arrivé au contrôle de la bulle.

---

## 59. La perle du fil désigne ce qu'on regarde, jamais un état

**Le patron, capture de son téléphone à l'appui, le 11 août 2026 :** *« Lorsqu'on
est tout en haut, elle devrait être au niveau du vingt-deux, donc bien centré sur
l'écran. Et en fait là, elle se retrouve constamment tout en bas. »*

Deux intentions se sont succédé, et l'application avait gardé la première :

| | Ce que la perle désigne | Où elle se trouve |
|---|---|---|
| Avant le 10 août | le premier chantier **qui attend un geste** | n'importe où — selon la liste |
| Retenu sur maquette | **le chantier qu'on regarde** | à mi-hauteur |

`docs/INTEGRER-ORIGINE.md` §3 signalait le changement et disait de ne pas le
« corriger ». Le portage l'a fait quand même. Chez le patron, le chantier qui
attend est le dernier de la liste : le point de couleur s'est donc installé tout
en bas, à demeure, et n'a plus rien désigné de ce qu'il regardait.

**Pourquoi la deuxième intention est la bonne, et pas seulement « celle qui a été
retenue » :** un repère qui change de place à chaque liste ne s'apprend pas. Il
faut le chercher avant de savoir ce qu'il dit — c'est-à-dire l'inverse d'un
repère. Fixé au milieu, il ne demande rien : les chantiers passent dessous.

Ce que cela coûte, et qui est assumé pour la troisième fois : le chantier dont le
devis est revenu n'a plus de point de couleur. Il garde son libellé
« Correction demandée », en bronze.

### Le maintien au milieu : deux lignes de CSS et une place dans l'arbre

La perle est **première fille du fil** (`src/app/ListeChantiers.tsx`). Sa place
naturelle étant au-dessus du point d'accroche, `position: sticky;
top: calc(50% - 23px)` l'y descend dès le premier pixel et l'y maintient. Aucun
calcul, aucun écouteur de défilement — le navigateur suit le doigt mieux que
nous, et gratuitement.

Un piège de placement : la perle doit être fille **directe** du fil. Enfermée
dans un conteneur haut d'une ligne, elle ne pourrait s'accrocher que sur cette
ligne-là.

### La descente sur le dernier jour : la seule chose que le CSS ne sait pas faire

**Le patron, même échange, sur la fin de liste :** *« Quand on arrive au dernier,
là, elle descend et elle se met en face du dernier jour. »*

Cela veut dire que, sur les derniers pixels, la perle doit **descendre pendant
que le contenu monte**. `position: sticky` ne cloue que dans un sens : son
accroche pousse vers le bas jusqu'au point d'arrêt, jamais au-delà, et la
contrainte du bloc conteneur ne fait que la tirer vers le haut. Trois montages
ont été essayés avant de le reconnaître — perle en dernier enfant, accroche par
le bas, conteneur raccourci — et tous ramènent la perle au milieu ou au-dessus.

La descente se **calcule** donc, dans `src/lib/perle-descente.ts`, en fonction
pure : elle vaut zéro tant qu'il reste plus de chemin à parcourir que de descente
à faire, puis croît sur les derniers pixels jusqu'à poser la perle au milieu de
la dernière ligne. L'écran mesure trois grandeurs et applique le résultat à une
variable CSS ; il ne décide de rien.

Deux propriétés de ce montage valent d'être dites :

- **La variable vaut zéro par défaut.** Si le JavaScript ne tourne pas, la perle
  reste au milieu : la dégradation est encore juste, ce qui ne serait pas le cas
  si la position entière était écrite par le code.
- **La cible est le MILIEU de la dernière ligne, pas la rangée du nom.** Partout
  ailleurs, le point d'accroche centre la ligne dans le cadre et la perle y tombe
  au milieu ; viser autre chose sur la dernière se lirait comme un décalage.

**Une alternative a été construite puis écartée par le patron** : allonger la
marge de fin du fil (`max(3.5rem, calc(50cqh - 61px))`) pour que le dernier
chantier puisse monter au milieu rejoindre la perle. Cela marchait, mesuré, mais
laissait un grand blanc sous le dernier chantier. Il a préféré que la perle aille
au chantier plutôt que la liste s'allonge — et une fin de liste ressemble alors à
une fin de liste.

### Le second défaut, et le plus instructif : une suite verte sur une règle fausse

**Le patron, le soir même, après la fusion :** *« la perle reste accolée en bas
au numéro dix-huit. »*

La première version de la descente la faisait plonger sur les `descenteEntiere`
derniers pixels de défilement — **sans se demander s'il y en avait autant**. Deux
conséquences, et il les a vues toutes les deux :

| Situation | Ce qui se passait |
|---|---|
| liste qui défile à peine (écran haut, peu de chantiers) | la plongée commençait avant le départ : la perle arrivait **déjà tombée** |
| liste qui tient dans l'écran | une règle écrite exprès la collait au **dernier** chantier |

Mesuré pour le reproduire : écran de 1100 px, 77 px à défiler pour 226 px de
descente à faire, perle 148 px sous le milieu **alors qu'on était tout en haut**.

Le correctif tient en un `min` : la plongée occupe les derniers pixels, **au plus
tout ce qu'on peut défiler**. Quand le chemin manque, elle s'étale dessus au lieu
de déborder avant le départ. Et quand la liste ne défile pas du tout, la perle ne
bouge plus — sauf si le dernier chantier est lui-même au-dessus du milieu, auquel
cas elle remonte le rejoindre.

**Ce qu'il faut retenir dépasse ce correctif.** La suite de cas éprouvait cette
règle fausse et la trouvait juste, parce que **tous ses cas donnaient une liste
au chemin confortable**. Le contrôle au navigateur ne mesurait qu'un seul écran,
852 px, où la liste de démonstration a 325 px devant elle — quatre fois ce qu'il
faut. Deux contrôles verts, un défaut visible à l'œil nu sur le téléphone du
patron.

Un cas manquant ne rougit pas. Quand une règle porte sur un RAPPORT — ici entre
le chemin à défiler et la descente à faire — il faut l'éprouver des deux côtés du
rapport, pas seulement du côté confortable. Le contrôle mesure désormais **deux
hauteurs d'écran**, dont une où la liste ne défile presque plus, et la suite de
cas a gagné la liste courte.

### Un défaut à connaître : calculé juste, jamais dessiné

La descente a d'abord été **calculée correctement et pas affichée**.
`.atlas-perle` est un `span` — une boîte **en ligne** — et une transformation ne
s'applique pas à une boîte en ligne non remplacée. `position: sticky` ne rend pas
une boîte de bloc, à la différence de `absolute` : il ne rattrapait donc rien.
`getComputedStyle` renvoyait pourtant la bonne matrice, et le contrôle accusait
le calcul, qui était innocent. Un `display: block` a suffi.

C'est le genre de défaut que seule la mesure sur l'écran départage : le code
était juste, la valeur était juste, et le rendu était faux.

### Le contrôle : mesurer, pas constater la présence

`npx tsx scripts/capture-accueil-perle.mts` relève la perle à quatre positions
de défilement — arrivée, sommet forcé, milieu, bas — et refuse sur quatre
points : elle quitte le milieu ailleurs qu'au bout ; elle ne tombe sur aucun
chantier ; tout en bas elle n'est pas en face du dernier jour ; elle ne vise pas
le même endroit dans la ligne selon l'endroit où l'on se trouve. Il écrit aussi
les captures : l'œil juge ce que la mesure ne dit pas.

**Une suite qui vérifiait la présence du point n'aurait rien vu** : le point
était bien là, au mauvais endroit. C'est le même défaut de fond que le relevé de
la barre basse (§34) — un contrôle qui n'interroge pas la bonne grandeur est un
contrôle vert sur une panne réelle.

**Et son message doit désigner le bon coupable.** Deux pannes très différentes
donnent le même symptôme — descente mal calculée, ou descente non dessinée — et
les confondre coûte une heure. Le contrôle relève donc la variable posée sur
l'écran et dit laquelle des deux est en cause.

Confronté trois fois avant d'être cru : perle déplacée à 20 % → rouge en nommant
l'écart ; `display: block` retiré → rouge en nommant le CSS et non le calcul ;
descente supprimée dans la fonction pure → rouge sur le cas proportionnel.

---

## 60. Ajouter une photo sans changer de page — et l'écran Photos qui disparaît

**Le patron, le 11 août 2026, deux captures à l'appui :** *« lorsque je suis sur
la page chantier et que je clique sur l'encadré doré avec le petit plus doré
pour ajouter des photos, je veux que ça arrête de me faire changer de page et je
veux voir apparaître directement la photothèque / prendre une photo /
bibliothèque […] et que tu me supprimes toutes les autres étapes »*.

### Ce que coûtait l'ancien chemin

Ajouter une photo demandait **quatre gestes et un changement de page** :

| Geste | Ce qui se passait |
|---|---|
| 1 | toucher le « + » de la pellicule |
| 2 | *l'écran change* — `/chantiers/[id]/photos` se charge |
| 3 | toucher « Ajouter une photo » |
| 4 | choisir dans **notre** feuille : « Prendre une photo » / « Choisir dans ma bibliothèque » |
| 5 | et **enfin** le menu du téléphone |

Il en coûte deux : le « + », puis le menu du téléphone. Le reste a été supprimé,
pas déplacé.

### La décision de fond : laisser le système faire le choix

Le 6 août, le patron exigeait les deux chemins : *« il faut bien évidemment
pouvoir faire les deux »*. La réponse d'alors était **deux champs de fichier**
(l'un avec `capture`, l'autre sans) et une feuille maison pour les départager.

Elle était juste, et elle est devenue inutile : un champ `accept="image/*"`
**sans `capture`** fait afficher par iOS un menu qui porte déjà les trois
entrées — *Photothèque*, *Prendre une photo*, *Choisir les fichiers*. Le système
pose le choix mieux que nous, et un geste plus tôt.

**`capture` reste interdit dans la pellicule, et ce n'est pas un réglage.** Sur
un iPhone il n'exprime aucune préférence : il **impose** l'appareil photo, retire
l'accès à la photothèque — et le menu ci-dessus n'apparaît jamais. Un artisan qui
a photographié le chantier le matin ne pourrait rien joindre l'après-midi.

### L'écran `/chantiers/[id]/photos` n'existe plus

Décision prise avec le patron le 11 août : *« on le supprime entièrement — tout
se passe dans la pellicule du tiroir : ajouter, regarder, retirer »*. La route
répond **404**, et une suite le vérifie : un écran à moitié supprimé, c'est un
chemin mort qu'on retrouve trois mois plus tard sans savoir s'il compte encore.

Ce qui a déménagé dans `src/app/chantiers/[id]/Pellicule.tsx` :

| Ce qui vivait sur l'écran Photos | Où c'est maintenant |
|---|---|
| l'ajout | le « + » de la pellicule, qui ouvre le menu du téléphone |
| la visionneuse plein écran | la même, ouverte depuis la vignette |
| « Retirer » + le tiroir des retirés | identiques, sous la pellicule |
| le décompte « 6 photos » | **supprimé** — il comptait ce qu'on a sous les yeux |
| « Passer à la note vocale » | **supprimé** — l'anneau est au centre de la fiche (§57) |

Les actions serveur, elles, n'ont pas bougé d'un octet : le fichier d'actions du
dossier supprimé est devenu
`src/app/chantiers/[id]/photos-actions.ts`, au même niveau que la fiche.

### Trois pièges, et pourquoi ils ne se voient pas en lisant le code

1. **La visionneuse doit sortir du tiroir par un portail.** Le tiroir porte un
   `z-index`, donc il ouvre son propre contexte d'empilement : une visionneuse
   « plein écran » rendue à l'intérieur reste plafonnée au niveau du tiroir, et
   la barre de navigation — posée plus loin dans le document, au même `z-20` —
   se peint **par-dessus la photo**. `createPortal(document.body)` la sort de
   là. Une suite mesure le point central de la barre et exige qu'elle soit
   couverte.

2. **Le tiroir mesure sa hauteur par `ResizeObserver`, plus par une liste de
   dépendances.** Il se dimensionnait sur `[photos.length, etapes.length]` —
   deux propriétés. Depuis que la pellicule ajoute et retire sans changer de
   page, son contenu ne passe plus par les propriétés du tiroir : la mesure ne
   voyait plus rien, le tiroir gardait sa hauteur d'avant, et le tiroir des
   retirés apparu sous la pellicule restait **derrière le bord — « Annuler »
   hors d'atteinte**.

3. **La fiche se rafraîchit après un ajout et après un retrait.** Le statut du
   chantier et l'étape suivante se déduisent du **nombre** de photos : sans
   `router.refresh()`, le résumé du tiroir continuerait de réclamer « Ajouter
   des photos » au-dessus d'une pellicule qui en montre une. L'état local, lui,
   n'est jamais resynchronisé depuis le serveur : ce qu'on vient d'ajouter ou de
   retirer ne doit pas être écrasé par un rendu arrivé en retard.

### Ce que la suite tient, et qu'aucun contrôle d'affichage ne verrait

`scripts/test-photos-e2e.ts` compare l'adresse **avant et après** l'ajout. C'est
la demande elle-même : tout le reste peut être vert pendant que le patron change
d'écran. Elle exige aussi qu'il n'y ait **qu'un** champ de fichier et qu'il soit
**sans `capture`** — sinon le menu à trois entrées ne s'ouvre pas, et le défaut
serait invisible sur une machine de test, où aucun iPhone ne décide.

---

## 61. L'espace du patron suit une BRANCHE, et la ligne « Version » doit la nommer

**Le défaut, le 11 août 2026 au soir.** Le bouton « Nouveau chantier » venait
d'être codé, éprouvé et poussé. Le patron : *« la modification du bouton nouveau
chantier n'est pas effectuée. Corrige ça. Et pourtant, j'ai la nouvelle dernière
mise à jour, celle de dix-neuf heures et quelques. »*

Les deux moitiés de la phrase étaient vraies en même temps, et c'est ce qui a
rendu le diagnostic long.

### Ce qui se passait vraiment

Son espace de travail se met à jour tout seul — c'est le correctif du 6 août
(`.devcontainer/mettre-a-jour.sh`, §24). Mais il le fait ainsi :

```sh
BRANCHE="$(git rev-parse --abbrev-ref HEAD)"
git fetch origin "$BRANCHE"
git merge --ff-only "origin/$BRANCHE"
```

**Il suit la branche courante, et rien d'autre.** L'espace du patron est né sur
`main` ; il suivra `main` jusqu'à sa mort. Le bouton, lui, vivait sur
`claude/nouveau-chantier-button-design-2vuu9h`. Aucun allumage, aucune pression
sur « Chercher les dernières corrections » — qui appelle **le même script** —
ne pouvait le lui apporter. Le bouton répondait fidèlement « vous étiez déjà à
jour », et c'était exact.

Et `main` avançait ce soir-là en parallèle : 19:02, 19:11, 19:13, 19:37. Sa
« mise à jour de dix-neuf heures » existait donc bel et bien. Elle n'était
simplement pas celle qu'on lui annonçait.

### Pourquoi l'écran ne pouvait pas l'arbitrer

La ligne « Version » de Réglages existe depuis le 7 août précisément pour
répondre à « est-ce que j'ai les corrections ? » (§24). Elle affichait
`11/08/2026 19:37 · b45cd5d`. Une date et sept caractères.

**Deux branches vivantes le même soir portent la même heure.** Et une empreinte
courte ne se compare pas de tête, sur six pouces, à une empreinte annoncée dans
un message. La ligne a donc répondu **oui** à une question dont la réponse était
**non** — le pire état possible pour un dispositif de confiance : plus nuisible
qu'une ligne absente, parce qu'on s'y fie.

### La décision

**La ligne nomme la branche** — `11/08/2026 19:37 · b45cd5d · main` — dans les
deux endroits qui l'écrivent : `src/server/version-executee.ts` (l'écran, lu
dans le dépôt à chaque affichage) et `.devcontainer/demarrer.sh` (le bandeau du
terminal). Une phrase sous la ligne dit ce que ce mot engage : *un correctif
livré sur une autre branche n'arrivera pas ici, même en cherchant les
corrections.*

**On n'invente jamais de branche.** Hors dépôt git, la version reste
« inconnue » ; sur une tête détachée, la ligne perd son dernier mot plutôt que
d'affirmer un nom faux. Une ligne incomplète se voit ; une ligne fausse se croit.

**Et le bandeau du terminal cesse de mentir sur le même sujet.**
`ATLAS_VERSION` était calculée avant la mise à jour et affichée après : le
bandeau annonçait « Le code a été mis à jour au démarrage » puis « Version
exécutée : *celle d'avant* ». Elle est relue juste après `mettre-a-jour.sh`,
donc **avant** que le veilleur ne soit relancé — sinon le serveur neuf héritait
lui aussi de la variable périmée.

### Ce que cela ne résout pas, et qu'il ne faut pas confondre

Nommer la branche ne livre rien. **Un travail sur une branche reste hors de sa
portée tant qu'il n'est pas dans `main`**, et l'y porter n'appartient pas à
l'agent (`CLAUDE.md` §6 : jamais de poussée ailleurs sans accord explicite).

Ce qui change, c'est qu'une capture de son écran tranche désormais la question
en une seconde, au lieu d'un aller-retour et d'une soirée à chercher un défaut
dans du code qui n'a jamais tourné chez lui.

**La règle générale, puisqu'elle se répète :** avant de chercher un défaut dans
un travail que le patron dit ne pas voir, vérifier qu'il l'a. Une commande :

```sh
git show origin/main:<le fichier> | grep <la marque du travail>
```

---

## 62. Ce qui bloque un envoi se répare là où ça bloque

**Le patron, le 11 août 2026 au soir :** *« l'encart qui permet d'envoyer aux
clients par SMS, par e-mail, a disparu. »* Sa capture montre la feuille d'envoi
réduite à une phrase — « Indiquez d'abord comment joindre ce client — par SMS ou
par e-mail — sur sa fiche » — et un bouton grisé.

**L'encart n'avait pas disparu : la porte qu'on lui désignait, si.** L'écran
« Informations » — le seul endroit où saisir un téléphone ou un e-mail — avait
quitté le tiroir de la fiche quelques heures plus tôt, à sa demande (« il faut
juste photo et note vocale »). La feuille renvoyait donc vers un écran devenu
inatteignable, et **un chantier né d'une dictée ne pouvait plus jamais partir** :
son client reste « non renseigné » jusqu'à ce que quelqu'un le renseigne, et
plus personne ne le pouvait.

**Ce que ce défaut apprend, et qui dépasse cet écran.** Le dépôt avait déjà
tranché ce point exact le 4 août, pour l'écran d'APRÈS l'envoi
(`TransmettreAuClient`) : *« si la coordonnée manque, elle se saisit sur place —
il n'existe aucun autre écran pour la renseigner, et renvoyer le patron sur la
fiche du client l'enverrait vers une porte qui n'existe pas »*. La règle était
juste et écrite ; elle n'avait été appliquée qu'à un seul des deux écrans. Un
mois plus tard, le second l'a payée.

**La règle, donc, et pour tout arrêt du parcours :** un écran qui refuse
d'avancer offre de lever ce qui l'arrête, ou nomme un endroit qui existe. Jamais
l'un sans l'autre. Un renvoi vers « sa fiche », « les réglages », « l'écran
précédent » se périme dès que la navigation bouge — et rien ne le signale, parce
qu'aucun test ne suit un lien écrit dans une phrase.

**Ce qui est en place :**

- `PreparationEnvoi` porte `clientId`, sans quoi l'écran ne peut rien réparer ;
- `EnvoiAuClient` offre les deux canaux et le champ, puis **rejoue la
  préparation** — l'état affiché vient toujours du serveur, jamais d'un blocage
  qu'on aurait effacé à la main ;
- la coordonnée est écrite **sur le client**, pas retenue pour cet envoi : c'est
  la même information que la fiche portait, et la saisir deux fois serait la
  saisir une fois de trop ;
- `devis_absent` reste un arrêt sec, et c'est juste : aucune saisie ne le lève.

**Pourquoi aucune suite ne l'avait vu.** Toutes créaient leur chantier **avec**
un numéro — `test-envoi-raison-e2e` remplit le champ téléphone dès la création.
Le chemin le plus courant chez le patron — créer, laisser le contact vide,
envoyer — n'était emprunté par personne.
`scripts/test-envoi-contact-sur-place-e2e.ts` l'emprunte, par l'écran, et va
jusqu'à vérifier que la coordonnée est **rangée en base** : un écran qui
accepterait la saisie sans la ranger serait vert à l'œil et faux — elle serait à
ressaisir au prochain envoi. Confronté au code livré : trois rouges.

---
## 63. « Réessayer » ne pouvait pas réparer un morceau de code disparu

**Le 11 août 2026, 18 h 02.** Le patron envoie deux captures de son téléphone.
La première est l'indicateur de Next.js, marqué **(stale)** :

```
Runtime ChunkLoadError
Failed to load chunk /_next/static/chunks/src_06hhplf._.js from module
[project]/node_modules/next/dist/compiled/react-server-dom-turbopack/cjs/
react-server-dom-turbopack-client.browser.development.js [app-client] (ecmascript)
```

La seconde est l'écran d'Atlas : « Une erreur — Cette page n'a pas pu
s'afficher », la cause, et **un seul bouton : « Réessayer »**.

### Ce bouton ne pouvait pas le sauver, et c'est le défaut

`reset()` refait le rendu du même arbre React. Les adresses des morceaux sont
gravées dans le code déjà chargé — celui d'une version que le serveur ne sert
plus. Il redemande donc le même fichier absent, obtient le même 404, et retombe
sur le même écran. **Autant de fois qu'on appuie.** Le patron avait un écran
d'erreur poli, un bouton, et aucune issue.

### Pourquoi cela lui arrive à lui, et jamais ici

Son espace redémarre son serveur plusieurs fois par soirée : mise à jour du
code, bascule du mode développement vers la version bâtie (§45, `banc.mjs`),
veilleur qui relève un serveur tombé (§44). À chaque redémarrage, les morceaux
changent de nom. Son onglet, lui, reste ouvert des heures — dix onglets sur la
capture. Le premier lien qu'il touche ensuite demande un fichier qui n'existe
plus.

Aucune suite ne pouvait le voir : elles ouvrent une page et la referment dans la
même minute, sur un serveur qui ne bouge pas. **C'est la durée de vie de son
onglet qui fabrique la panne**, pas le code.

### Le remède : recharger, une fois, et savoir s'arrêter

`src/lib/reprise-erreur.ts` — fonction pure, donc éprouvable sans navigateur.

1. **Reconnaître.** Les formulations diffèrent d'un navigateur à l'autre, et le
   patron est sur Safari : `Failed to load chunk` (Turbopack), `Loading chunk 42
   failed` (webpack), `Failed to fetch dynamically imported module` (Chrome),
   `error loading dynamically imported module` (Firefox), `Importing a module
   script failed` (**Safari**). Le nom `ChunkLoadError` suffit aussi. La cause
   est suivie sur quelques niveaux — React enveloppe volontiers l'erreur
   d'origine — avec une profondeur bornée, une chaîne de causes pouvant boucler.
2. **Recharger tout seul.** Un rechargement complet va rechercher la page et ses
   morceaux auprès du serveur d'aujourd'hui. On ne le demande pas : on le fait.
3. **Une seule fois par fenêtre de cinq minutes.** C'est la garde, et elle vaut
   le correctif : recharger sur une panne qui revient donnerait un téléphone qui
   tourne en rond pour toujours — la pire des pannes, parce qu'elle n'affiche
   **jamais rien à lire**. Passé cette borne, on rend la main avec une phrase.

**Et cette phrase ne désigne pas un coupable qu'on ignore.** Après un
rechargement resté sans effet, deux causes tiennent encore : une mise à jour en
cours, ou une connexion coupée. Le message nomme les deux. Trancher au hasard
enverrait chercher au mauvais endroit — ce que ce dépôt paie le plus cher.

### La phrase de l'écran s'efface, et c'est délibéré

Chaque écran d'erreur dit sa propre panne : « Impossible de charger le
planning », « Photos indisponibles ». Sur un morceau manquant, **ces phrases
mentent** : le planning n'y est pour rien, c'est la page entière qui a vieilli.
Elles ne servent donc que lorsque la cause leur appartient vraiment.

### Un corps commun pour les neuf écrans d'erreur

`src/components/atlas/CorpsErreur.tsx`. Dix `error.tsx` portaient dix copies du
même corps ; le jour où l'un d'eux apprend à se relever, les neuf autres ne
l'auraient pas su. Chaque écran garde son en-tête — son titre, son retour — et
délègue la carte, la cause, la référence et le bouton.

**Au passage, la cause n'était affichée que sur l'écran racine.** Le
raisonnement était pourtant déjà écrit dans `src/app/error.tsx` : le patron
diagnostique depuis un téléphone, sans terminal sous les yeux, et c'est là — et
là seulement — qu'il peut lire ce que le serveur a écrit. Il ne s'appliquait
qu'à un dixième de l'application. En production, la cause reste tue : un message
d'erreur serveur peut divulguer la structure de la base.

### Trois choses à ne pas défaire

1. **`sessionStorage`, pas `localStorage`.** La mémoire meurt avec l'onglet : un
   onglet neuf a droit à son rechargement, et rien ne traîne sur son téléphone.
   Sa lecture est enveloppée — **Safari en navigation privée lève à la simple
   lecture**, et il n'y a pas d'écran d'erreur derrière un écran d'erreur. Sans
   mémoire, on refuse le rechargement automatique plutôt que de risquer la
   boucle.
2. **On note AVANT de recharger.** Noter après, c'est ne jamais noter : la page
   part. La garde ne garderait rien.
3. **La réserve `pb-40` sous le bouton.** Mesurée, pas supposée : la bulle de
   l'assistant est `fixed` en bas à droite et recouvrait 48 px du bouton dès que
   le message dépassait deux lignes — ce qui est le cas ici, et de tout écran
   affichant une cause en développement. Sans la réserve, la page ne défile pas
   et le bouton reste sous la bulle, sans recours.

### Ce que les contrôles éprouvent — et qu'ils savent échouer

- `scripts/test-reprise-erreur.ts` — 14 contrôles purs, dont le message **exact**
  de sa capture, les cinq formulations de navigateurs, la garde, et surtout le
  cas qui rend les autres crédibles : **une panne ordinaire ne doit PAS être
  prise pour un morceau manquant**. Sabotée (reconnaissance neutralisée, soit
  l'ancien comportement), la suite rend 8 rouges sur 14.
- `scripts/test-reprise-morceau-e2e.ts` — la panne rejouée dans un vrai
  navigateur, à l'écran du patron. Le 404 est posé par le navigateur plutôt
  qu'en redémarrant le serveur : au niveau du réseau c'est la même chose — le
  morceau demandé n'est pas là — et c'est reproductible à la seconde. Deux cas :
  la page se relève et l'écran revient ; la page **ne** recharge **pas** quand un
  rechargement vient d'avoir lieu. Sabotée de la même façon, le premier cas
  expire sur soixante secondes — exactement ce que le patron a vécu.
- Le contrôle de recouvrement du bouton rougit dès qu'on retire `pb-40`.

**Un piège de mesure, qui a d'abord fait passer un contrôle pour rien.**
`framenavigated` est émis par Playwright sur les navigations `pushState` du
routeur, sans qu'aucune page n'ait rechargé. Compter cela, c'était prendre la
navigation qu'on provoque pour le rechargement qu'on veut prouver. **C'est la
requête de DOCUMENT qui signe un rechargement**, et elle seule.

### Ce qui n'est pas couvert, et qui le sera chez lui

La panne d'origine — un serveur qui redémarre sous un onglet ouvert des heures —
n'est pas rejouée telle quelle : elle demanderait de faire vieillir un onglet
pendant une bascule complète du banc. Le 404 sur le morceau en est l'effet
exact au niveau du réseau, et c'est lui qui est éprouvé. La différence est
mince, mais elle est dite plutôt que tue.

---

## 64. Les deux portes de la création : une bascule, et une capsule

**Trois demandes du patron, le 11 août 2026 au soir, dans cet ordre.**

1. *« Retire la petite écriture sous devis à la main. »*
2. *« On ne voit que création de chantier, on ne voit pas devis à la main. Il
   faut qu'on puisse voir les deux. »*
3. *« Le bouton, je le trouve un peu trop gros, carré, pas esthétique. »*

Puis, maquettes en main : la **bascule** (déclinaison 1, le trait qui glisse) et
la **capsule** (proposition 5).

### Pourquoi une bascule et non deux boutons

C'est la question de fond, et elle avait déjà été tranchée le matin même : **deux
boutons à égalité obligent TOUT LE MONDE à trancher** avant même d'avoir vu le
chantier, alors que neuf fois sur dix la réponse est « je dicterai ». C'est pour
cela qu'un lien discret avait d'abord été retenu.

Le lien réglait le mauvais problème : il ne se voyait pas. La bascule garde les
deux propriétés à la fois — les deux chemins sont lisibles, et il n'y a
**toujours qu'un seul bouton à toucher**. Le geste ordinaire n'a pas changé de
coût.

### Le dessin, et ce qui le tient

- **La serif, pas les capitales.** Un mot en capitales espacées est un panneau ;
  le même en serif est une phrase. On choisit entre deux façons de travailler.
- **Le trait GLISSE, il ne saute pas.** `translateX` sur trois dixièmes de
  seconde — déplacer coûte moins cher au navigateur que repeindre, et le
  mouvement reste fluide sur son téléphone.
- **La couleur désigne, jamais le gras.** Un mot qui grossit décale son voisin.
- **Les deux libellés du bouton sont superposés** dans la même case de grille et
  se croisent en opacité. Les afficher l'un OU l'autre ferait changer le bouton
  de largeur au moment du choix, et un bouton qui bouge sous le doigt est la
  façon la plus sûre de faire douter de ce qu'on vient de toucher.

### La capsule : ce qui l'allège n'est pas le rayon

La masse venait de **trois** choses à la fois — la hauteur (58 px), l'aplat, et
la **pleine largeur**. Un bouton qui touche les deux marges n'est contenu par
rien. La capsule lâche la pleine largeur : elle est tenue par le blanc autour
d'elle, et cesse aussitôt de peser. L'aplat, lui, reste plein — c'est ce qui la
sépare des formes sans fond, plus élégantes mais qui **se cherchent au lieu de
se trouver** sur un écran qu'on parcourt vite.

**Elle ne contredit pas la décision du 10 août.** Celle-ci visait le rayon
MOYEN : « le même arrondi à 16 px se lit comme un bouton d'application ». Un
demi-cercle franc est une forme en soi — un jeton, pas une tuile.

**Elle est sur les dix-sept écrans depuis le 11 août au soir**, et il n'existe
plus qu'une seule forme d'action principale. Le chemin pour y arriver compte
autant que la décision : le patron a d'abord dit *« montre-moi avant de faire,
plutôt que de faire pour revenir en arrière »*. La capsule a donc été posée dans
une copie de travail, photographiée **sur ses vrais écrans**, retirée — puis
posée pour de bon quand il a répondu « partout ». `capture-bouton-partout.mjs`
existe pour cela, et resservira.

**Aucune variante « plaque » n'est conservée.** Elle a vécu une journée, le temps
de la comparaison. Garder le dessin d'avant « au cas où » aurait laissé dans le
dépôt une seconde forme d'action que plus rien n'emploie — et qu'un écran futur
aurait fini par reprendre au hasard. L'historique la garde ; le code, non.

**Les largeurs, mesurées et non supposées** (390 px d'écran, sa place réelle) :
de 141 px pour « Réessayer » à 316 px pour « Confirmer le départ de la facture ».
Aucun libellé ne déborde. Le dernier occupe 92 % et redevient pleine largeur de
fait — ce n'est pas un défaut, c'est le geste le plus irréversible de
l'application.

**Un effet de bord heureux, vu en capture :** sur l'écran d'erreur, la bulle de
l'assistant mordait sur le bouton (§63). Une capsule centrée ne l'atteint plus.
La réserve `pb-40` reste : elle protège d'un message plus long, pas d'une
largeur.

### Où mène « Ouvrir le devis », et pourquoi le chantier est créé d'abord

Vers `/chantiers/<id>/devis-complet` — la page où **il n'y a que le devis**, celle
qu'il avait demandée le 5 août. Et le chantier est créé **avant** : c'est ce qui
permet à la page du devis de relire le client rattaché. Sauter la
création pour « gagner du temps » produirait le devis orphelin qu'il redoutait
le 11 août au matin. **Une seule fonction crée**, `creerPuisAller`, deux
destinations en sortent — deux fonctions auraient divergé au premier champ
ajouté.

### « Entrée » suit désormais la bascule

Tant que le devis à la main était un lien discret, valider un champ au clavier ne
devait surtout pas y mener : on n'aurait pas choisi cette sortie, on serait tombé
dedans. Depuis que le choix est explicite et affiché **au-dessus** du bouton,
l'ignorer serait l'inverse du défaut.

### Deux pièges de mesure, dans la même soirée

Les deux libellés vivent **en même temps** dans le bouton, l'un à `opacity:0`.
`innerText` ne connaît pas l'opacité : il les rend TOUJOURS tous les deux. Un
contrôle écrit dessus passerait au vert quel que soit l'état, **y compris sur une
bascule morte** — il ne saurait pas échouer, donc il ne prouverait rien.
`test-devis-main-depuis-creation-e2e.ts` lit donc le style calculé, et attend que
le fondu soit fini : pendant sa première moitié, l'ancien libellé est encore
au-dessus de 0,5. Le même piège avait déjà fait déclarer rouges six maquettes
justes (`scripts/verifier-maquette-bascule.mjs`).

Éprouvé en sabotant : figer le libellé sur « Créer le chantier » rend un rouge, et
un seul — celui qui doit tomber.

**Le second piège n'était pas dans un contrôle mais dans une PLANCHE.** La
première comparaison avant/après cadrait chaque bouton au plus près. Deux
captures de largeurs différentes, posées côte à côte, se remettent à la même
taille : la capsule — plus étroite en réalité — s'y affichait **plus grosse** que
le rectangle qu'elle remplace. La planche disait exactement l'inverse de la
vérité, et elle serait partie ainsi si personne ne l'avait regardée. Le cadre
prend désormais toute la largeur de l'écran, jamais celle du bouton : à échelle
constante, la place laissée autour — qui est tout le sujet — se voit.

### La phrase de pied, retirée

« Le nom crée la fiche du client. Le reste se corrige ensuite, sur le devis. » La
ligne subsiste mais ne parle qu'en cas d'erreur, et **sa place reste réservée** :
sans cela, l'apparition d'un message ferait sauter la mise en page d'une ligne
sous le doigt qui vient d'appuyer. Ce qu'elle disait reste vrai et n'est plus
écrit nulle part à l'écran — c'est le NOM qui crée la fiche client. Le jour où ce
cas doit se voir, c'est **sur l'écran du devis** qu'il faudra le dire.

## 65. Un envoi de fichier passe par une URL, jamais par une action serveur

> **À lire avec le §63, qui décrit LE MÊME phénomène par un autre symptôme.**
> Une session voisine, le même soir et sans concertation, a trouvé que l'onglet
> du patron réclamait des morceaux de code disparus après un redémarrage. Ici,
> c'est un identifiant d'action serveur qui a disparu de la même façon. Deux
> symptômes, une seule cause : **son onglet survit à son serveur.** Le jour où
> un troisième symptôme apparaîtra, c'est là qu'il faudra le chercher — et non
> dans le réseau, ni dans le produit.

**Trois signalements du patron, les 11 et 12 août 2026, la même phrase :**
*« L'enregistrement n'a pas pu être transmis — la connexion a été
interrompue. »* Et un défaut qui ne se reproduisait jamais ici — en
développement, sur la version bâtie, derrière une origine étrangère, avec un
micro simulé, la dictée passait à chaque essai.

**Ce qui manquait aux essais, c'était le temps.** Les suites ouvrent une page et
agissent dans la seconde. Le patron, lui, ouvre la fiche, regarde, réfléchit — et
pendant ce temps son banc se met à jour tout seul, comme il est fait pour.

Or **une action serveur n'a pas d'adresse** : elle porte un identifiant fabriqué
à la construction et inscrit dans la page. Après une reconstruction, la page
déjà ouverte appelle un identifiant que le nouveau serveur ne connaît plus.
L'envoi échoue **sans jamais l'atteindre**.

Cela explique chacun des traits qui rendaient le défaut insaisissable :

| Ce qu'on observait | Pourquoi |
|---|---|
| irreproductible ici | l'identifiant était toujours frais |
| le reste de l'application marchait | naviguer recharge la page, donc les identifiants |
| rien au journal du serveur | rien ne l'atteignait |
| aucun refus affiché | il n'y avait pas de refus, il y avait une absence |
| la phrase accusait le réseau | c'est ce que l'écran supposait, faute de mieux |

**Reproduit, pas supposé.** `scripts/eprouver-page-vieillie.mts` ouvre la fiche,
redémarre le serveur, puis dicte. Sur le code d'avant : `500`, le message du
patron mot pour mot, base vide. Par la route : `200`, note rangée.

**La règle qui en sort, et qui dépasse la note vocale :** tout envoi déclenché
depuis un écran où l'on **stationne** passe par une URL. Une action serveur
convient à un geste qui suit immédiatement l'arrivée sur la page ; elle ne
convient pas à un geste qu'on fera « quand on sera prêt ».

Trois bénéfices s'ajoutent, indépendants de cette cause, et qui suffiraient :

1. le client reçoit un **vrai code HTTP** — 401 se répare en se reconnectant,
   409 en corrigeant l'envoi, 500 en regardant le serveur ; une action ne rend
   qu'un échec sans nature ;
2. la limite de corps des actions serveur (15 Mo) ne s'applique plus ;
3. l'envoi survit à une reconstruction du serveur.

**Ce qui est en place :**

- `src/server/services/note-vocale-entrante.ts` porte la règle, **écrite une
  fois** pour l'anneau, l'écran de dictée et l'import (`CLAUDE.md` §3) ;
- `src/app/api/notes-vocales/[chantierId]/route.ts` ne fait que traduire un
  résultat en réponse HTTP ;
- `src/lib/envoi-note-vocale.ts` porte le côté navigateur, et **ne lève jamais** :
  une réponse qui n'est pas du JSON — page de connexion rendue par un mandataire,
  par exemple — est traitée comme un échec, jamais comme un succès ;
- `test-note-vocale-par-url-e2e.ts` tient l'invariant en continu.

**Ce qui reste à faire, et qui n'est pas un détail :** les photos passent encore
par une action serveur, depuis le même écran où l'on stationne. Le raisonnement
vaut pour elles ; rien ne le prouve encore de leur côté.

---
---

## 66. Le devis qui ne partait pas, et le bouton qui n'était pas le bon

**Le patron, le 12 août 2026, capture à l'appui.** Deux défauts sur la même
image, sans rapport l'un avec l'autre — et c'est justement ce qui les rendait
tous deux invisibles.

### « Je ne peux pas envoyer mon devis, ni par SMS ni par mail »

Sur la feuille d'envoi, à la place de son devis :

```
Stockage local sélectionné en production — configuration refusée (voir src/server/env.ts)
```

Sa configuration était juste. **`src/server/storage/index.ts` ne regardait que
`NODE_ENV === "production"`** — or le banc d'essai SERT UNE VERSION BÂTIE, et
`next start` impose `NODE_ENV=production` sans que rien ne soit déployé.

`src/server/env.ts` connaissait pourtant la distinction depuis le 10 août :
`exigencesDeDeploiement = exigencesDeProduction && !bancDEssai`, « les deux
seules choses qu'un banc ne peut pas avoir : une clé d'IA facturée et un
compartiment S3 ». La seconde barrière l'ignorait.

**Et son commentaire affirmait le contraire de la réalité** — « le module
d'environnement refuse déjà de démarrer en production » — ce qui est faux sur le
banc. C'est ce qui a caché la divergence pendant des semaines : la barrière se
croyait redondante alors qu'elle était devenue **plus stricte que la première**.
`CLAUDE.md` §3 le nomme : « jamais de règle dupliquée, deux implémentations
finissent toujours par diverger ». On ne recopie donc plus la règle, on reprend
la même notion.

**Ce qui n'est pas relâché :** un déploiement réel exige toujours S3. Le stockage
local ne persiste pas entre instances, et un devis envoyé dont le PDF a disparu
est pire qu'un envoi refusé. `scripts/test-stockage-banc.ts` tient les deux
bouts — et sa deuxième vérification pose une configuration de production
**valide de bout en bout**, sinon le refus viendrait d'ailleurs (« LLM_PROVIDER
vaut dev en production ») et l'on croirait éprouver le stockage en éprouvant
autre chose.

### « Le bouton, ce n'est pas le même »

Il avait raison. La capsule avait été posée sur `PrimaryButton` — et la feuille
d'envoi **dessinait son bouton à la main** :

```tsx
<button className="rounded-[4px] py-3.5 …" style={{ backgroundColor: colors.rust }}>
```

**Une action principale dessinée sur place échappe à toute décision d'ensemble :
elle ne change que si quelqu'un pense à elle.** C'est le composant qui porte la
forme, jamais l'écran.

**Pourquoi la planche du 11 août ne l'avait pas vue :**
`capture-bouton-partout.mjs` parcourt des ADRESSES. La feuille d'envoi n'en a
pas — c'est un tiroir qui monte sur un geste. Tout ce qui ne s'ouvre pas par une
URL était donc hors de son champ, et le compte « dix-sept écrans » ne comptait
que ce qu'elle savait atteindre.

### Ce qui reste vrai, et ce qui reste à faire

D'autres actions principales sont encore dessinées à la main
(`DevisDepuisDictee`, `BrouillonSection`, `PropositionPrixSection`, les écrans
de réglages). Elles ne sont pas converties d'office : le patron a posé la règle
inverse — *« montre-moi avant de faire, plutôt que de faire pour revenir en
arrière »*. Voir `TODO.md`.

---

## 67. Une seule forme de bouton, et un contrôle pour qu'elle le reste

**Le patron, le 12 août 2026 :** *« remplace tous les boutons rectangulaires par
les boutons arrondis »*. Seize boutons du produit portaient encore un rayon de
4 px, à côté des capsules posées la veille.

### Pourquoi il en restait seize

La capsule avait été posée sur `PrimaryButton`, et **seize boutons dessinaient
le leur à la main**. Une action dessinée sur place échappe à toute décision
d'ensemble : elle ne change que si quelqu'un pense à elle. Le balayage règle
l'instant ; il ne tient pas tout seul — un écran écrit dans six mois reprendra le
`rounded-[4px]` du voisin.

D'où `scripts/test-boutons-arrondis.ts`, qui nomme le fichier et la ligne du
coupable. Il porte aussi un **témoin** : un bouton rectangulaire écrit en dur
qu'il doit continuer de reconnaître. Sans lui, une façon d'écrire les classes qui
changerait rendrait le contrôle vert sur une application entièrement carrée —
un contrôle qui ne trouve plus rien ressemble à un contrôle qui passe.

### Ce qui a été changé, et ce qui ne l'a pas été

**Seulement le rayon.** Ni la couleur, ni la taille, ni le composant. Deux de ces
boutons sont des `type="submit"` — la connexion et les documents légaux — et
`PrimaryButton` impose `type="button"` : les y faire passer aurait cassé leur
formulaire sans qu'aucun type ne s'en aperçoive. La connexion a donc été jouée
pour de vrai après le changement, dans un navigateur.

**Les plages gardent leurs 4 px.** Cartes, champs et tuiles ne sont pas des
boutons : la charte les veut presque droits, « au-delà de 6 px une plage devient
un galet ». Le contrôle ne regarde que `<button>` et `<a>`.

### Ce que la capture a révélé, et qui n'était pas demandé

**L'écran de connexion est le seul resté dans l'ancienne identité.** Son bouton
est en terre cuite `#B5502F` — la couleur abandonnée le 3 août quand
l'application est passée à Arborea — sur une carte blanche à bordures grises,
sans serif de titre. C'est le PREMIER écran que le patron voit, et le seul qui
ne ressemble pas à Atlas. Rien n'a été changé : il n'a pas demandé cet écran, et
sa règle est de montrer avant de faire. Voir `TODO.md`.

---

## 68. Le navigateur du client réécrivait nos pages avant React

**Le 12 août 2026, sur son iPhone :** la page publique d'une facture rend
« Hydration failed ». Le diff de React ne laissait aucune place à
l'interprétation — le DOM portait `<a href="tel:2026-0003">` là où le composant
ne rend que le texte `2026-0003`.

**Aucune page de ce dépôt n'écrit de `tel:` sur un numéro de facture.** Le lien
ne pouvait donc venir que du navigateur : iOS reconnaît d'office ce qui
ressemble à un téléphone, une adresse ou un courriel, et **réécrit le HTML avant
que React ne s'installe dessus**. Un numéro de facture — quatre chiffres, un
tiret, quatre chiffres — lui ressemble assez.

### Pourquoi ce n'était pas qu'une alerte de développement

React s'en remet (« Recoverable Error ») en refabriquant l'arbre côté client.
Mais dans l'intervalle, **le numéro devenait un lien d'appel sous le doigt du
client de l'artisan** — sur les deux écrans qu'il voit, la facture et le devis,
qui portent tous deux ce numéro en titre. Un client qui appuie sur son numéro de
devis et voit son téléphone proposer d'appeler « 2026-0003 » n'a pas affaire à
un outil sérieux.

### Le remède, et son coût

`formatDetection: { telephone: false, address: false, email: false }` dans les
métadonnées du gabarit racine — donc sur toutes les pages, y compris celles du
client.

**Les trois, pas seulement le téléphone.** Les deux autres cassent exactement de
la même façon, et attendre qu'il découvre la suivante lui coûterait un
aller-retour de plus.

**Rien n'est perdu.** Cela n'éteint que la détection AUTOMATIQUE : les `tel:`
qu'Atlas écrit lui-même — « appeler » sur la fiche du client — et le bouton
« Y aller » continuent de fonctionner. C'est éprouvé, et pas seulement affirmé.

### Ce qui ne peut pas être éprouvé ici, et qui est dit comme tel

**La détection est propre à Safari ; cet environnement n'a que Chromium.** La
panne d'origine ne peut donc pas être rejouée ici, et le correctif ne peut pas
être vu la faire disparaître. `scripts/test-detection-automatique-e2e.ts` garde
ce qui peut l'être : l'en-tête part bien sur `/factures/<jeton>`,
`/devis/<jeton>` et `/login`, un témoin vérifie que ces pages posent toujours un
numéro nu — sans quoi le contrôle garderait le vide —, et un dernier cas
constate qu'un `tel:` explicite survit au refus. Confronté au correctif retiré :
quatre cas passent au rouge, en nommant le bon coupable.

---

## 69. Une déclaration ne répare pas un espace déjà né

**Quatrième fois que ce piège coûte une soirée, et la première où il l'a coûtée
au patron lui-même.** Le 12 août 2026, il redémarre son espace deux fois pour
qu'une fiche d'état parte enfin. Elle ne pouvait pas.

### La règle, énoncée une bonne fois

Tout ce que `devcontainer.json` déclare — fonctionnalités, attributs de port —
et tout ce que `preparer.sh` installe est posé **à la création** d'un espace.
Un espace existant ne les recevra jamais, quoi qu'on pousse : **redémarrer
récupère le code, jamais les outils.**

En découlent trois défauts déjà payés :

| Ce qu'il voit | Ce qui manquait | Quand |
|---|---|---|
| « bash: gh: command not found » | la fonctionnalité `github-cli` | 10 août |
| une page blanche depuis son téléphone | le port 3000 revenu privé, faute de `gh` | 11 août |
| aucune fiche d'état après deux redémarrages | `gh`, encore | 12 août |

**Ce qu'il faut en faire, à chaque fois qu'on ajoute une dépendance
d'outillage :** se demander *« est-ce que ça marche dans SON espace, celui qui
existe déjà ? »* Si la réponse est non, soit on supprime la dépendance, soit on
le lui dit — jamais on ne laisse croire que ça fonctionnera.

### Ce qui a été fait ici : supprimer la dépendance

La fiche est publiée par l'API GitHub avec le jeton que Codespaces pose dans
chaque terminal. Plus aucun outil à installer, donc plus rien qui dépende de
l'âge de l'espace. `gh` reste en second recours, pour les machines où un jeton
n'est pas posé mais où l'on s'est authentifié à la main.

**L'ordre compte, et il est gardé** : tenter `gh` d'abord reviendrait à ne rien
publier chez la seule personne pour qui la fiche existe.

### Le vrai coupable : rien n'avait jamais joué l'envoi

Les contrôles éprouvaient la censure des secrets et la forme du corps. **Aucun
n'avait jamais publié quoi que ce soit.** Un contrôle qui ne parcourt pas ce que
parcourt le patron ne prouve rien — c'est écrit dans `AGENTS.md`, et cela vaut
pour l'outillage autant que pour le produit.

`scripts/eprouver-publication-fiche.mjs` joue l'envoi pour de bon : il crée une
fiche jetable, vérifie que le second passage la MET À JOUR au lieu d'en ouvrir
une seconde — le défaut qui remplirait le dépôt d'une fiche par quart d'heure —,
puis la referme dans tous les cas, échec compris.

**Il ne peut pas tourner sur la machine de l'agent** : le jeton qu'elle expose
est un substitut de son mandataire réseau, et GitHub le refuse (401 « Bad
credentials », constaté). D'où un travail séparé dans `ci.yml`, sans base ni
navigateur — vingt secondes, et une panne de PostgreSQL ne le fait pas passer
pour cassé.

### Et la fiche part maintenant AVANT le serveur

La version d'origine attendait jusqu'à dix minutes que l'application réponde
avant d'écrire quoi que ce soit. Or le cas pour lequel cette fiche existe est
celui où l'application **ne répond pas** : elle se taisait exactement quand on
avait besoin d'elle. Elle est désormais publiée deux fois — tout de suite, puis
à nouveau une fois le serveur debout.

### Le dépôt est PUBLIC — ce que la fiche a le droit de dire

**Découvert le 12 août 2026, et cela a changé une décision.** La fiche est une
*issue* de ce dépôt : lisible par n'importe qui, et indexée.

La première version y recopiait les quarante dernières lignes du démarrage, en
censurant au jugé ce qui ressemblait à un secret. Cette censure était
délibérément grossière, et c'était le bon arbitrage — **tant que le dépôt était
supposé fermé**. Public, l'arbitrage s'inverse : une censure au jugé laisse
forcément passer l'imprévu, et le prix d'un oubli n'est plus une gêne de lecture
mais une clé publiée sur la place.

Mis devant le choix, le patron a tranché : **retirer le journal.**

Ce que la fiche porte désormais : branche suivie, commit récupéré, commit
réellement SERVI, état des services, et ce que le diagnostic en conclut.

**Ce qu'on y perd, écrit ici pour qu'on ne le redécouvre pas :** devant un
serveur qui refuse de démarrer, la fiche dira qu'il ne répond pas, **pas
pourquoi**. C'est assumé — ce qui reste répond à la question qui a coûté le plus
cher, *sur quelle version est-il et son serveur tourne-t-il ?*

**Et la tentation qui reviendra :** devant un serveur muet, on voudra « juste
les dernières lignes ». Ce qu'il faudra écrire alors est une extraction
**structurée** — le nom de l'erreur, pas les lignes autour. Jamais un retour du
journal brut. `scripts/test-rapport-espace.ts` garde la décision, et porte un
témoin : un journal passé de force à la fonction ne doit pas ressortir.

La censure, elle, **reste en place** : le diagnostic recopie des noms de
fichiers modifiés, et rien n'interdit qu'un jour l'un d'eux porte un secret. Une
ceinture ne se retire pas parce qu'on a mis des bretelles.

---

## 70. Le chevron doré du planning : l'adresse portée jusqu'au GPS

**Sa demande, le 12 août 2026 :** *« lorsque je vais sur planning et qu'il y a un
chantier qui est planifié, en cliquant dessus je puisse avoir un petit truc genre
accéder à l'adresse, et en cliquant dessus ça met l'adresse toute seule dans le
GPS, soit Maps, soit Waze »*.

Et, dans le même message : *« avant de faire quoi que ce soit, fais-moi une
maquette visuelle […] en point HTML cliquable »* — la règle `CLAUDE.md` §3 bis,
appliquée. Quatre maquettes ont été nécessaires avant l'accord
(`docs/maquettes/29` à `32`).

### Ce que les quatre versions ont coûté, et appris

| | Ce qui était proposé | Ce qu'il a répondu |
|---|---|---|
| 29 | Un bouton « Y aller » en toutes lettres | — |
| 30 | Un « + » sur la ligne, et la feuille | *« il manque tout là en fait »* — la feuille était prisonnière du téléphone dessiné, illisible sur son écran |
| 31 | La feuille sortie du cadre, mots entiers | *« sans le plus, tu mets une petite flèche »* |
| 32 | Une flèche de navigation | *« pas cette flèche, je veux la même que celle à côté de maps, le petit `>` »*, puis *« tu mets le chevron en doré »* |

**Sa correction du signe n'était pas une préférence de dessin.** Une flèche de
navigation promet un DÉPART — et sur un chantier sans adresse, elle ne peut pas
le tenir : il fallait alors l'éteindre, donc traiter un cas de plus sur la ligne.
Un chevron promet que QUELQUE CHOSE S'OUVRE, ce qui reste vrai de toutes les
lignes. **Le cas particulier a disparu avec le choix du signe** — c'est le genre
d'économie qu'une maquette trouve et qu'un débat d'architecture manque.

### Des liens universels, jamais les schémas propres

`src/lib/itineraire.ts` — fonction pure, éprouvée sans base ni navigateur
(`scripts/test-itineraire.ts`).

```
https://maps.apple.com/?daddr=…&dirflg=d
https://www.google.com/maps/dir/?api=1&destination=…
https://waze.com/ul?q=…&navigate=yes
```

`waze://` et `comgooglemaps://` sont plus courts, et ils ont un défaut qu'on ne
voit pas en les essayant sur une machine qui possède les applications :
**absente, l'application les fait échouer EN SILENCE**. Le doigt appuie, rien ne
bouge, rien ne dit pourquoi. Sur un chantier, ce n'est pas un désagrément : c'est
une adresse qu'on n'a plus. Les liens ci-dessus ouvrent l'application quand elle
est là, son site sinon.

Deux détails qui ne se devinent pas :

- **`encodeURIComponent`, jamais `encodeURI`.** Une adresse porte une virgule
  (« 12 chemin des Chênes, 33600 Pessac ») ; `encodeURI` la laisse passer, elle
  sépare alors deux paramètres chez Waze, et l'adresse est tronquée au numéro de
  rue. Le GPS s'ouvre — dans une autre commune.
- **`dirflg=d`.** Sans lui, Plans rouvre le dernier mode utilisé. À pied, s'il a
  cherché une rue en ville la veille : trente kilomètres, et une estimation
  absurde qu'il ne pense pas à corriger.

**Un téléphone ne dit pas quelles applications il possède.** Impossible donc de
n'afficher que Waze parce que c'est la seule installée : les trois sont
proposées, et le doigt choisit. La case « Toujours celle-là » de la maquette
n'est **pas** reprise en v1 — mémoriser un choix sans offrir nulle part de le
défaire enferme le patron dans une application qu'il aura touchée par erreur.
Elle reviendra avec son interrupteur dans Réglages, ou pas du tout.

### L'adresse descend AVEC la liste

`listerChantiersPourPlanning` remonte désormais `adresseChantier` et
`clientTelephone`. Pas par confort : le patron ouvre « Y aller » **en voiture**,
souvent sans réseau. Une feuille qui doit aller chercher l'adresse au moment du
geste arrive vide exactement là où elle sert.

Les oublier de ce `select` ne casserait rien de visible — la feuille dirait
« Adresse non renseignée » sur un chantier qui en a une, et il croirait sa base
vide. D'où un contrôle qui les nomme (`test-planning-repo.ts`), confronté à leur
absence avant d'être retenu.

### Ce que la capture a corrigé, et qu'aucun test ne voyait

La ligne « Planifiés » portait déjà « Déplacer » et « Créer la facture ». Le
carré touchable de 44 px du chevron, posé sans précaution, **rognait la seule
chose qui dit de quel chantier il s'agit** : à 390 px, « Chez M. Bernard »
devenait « Chez M. … ». Les huit contrôles étaient verts — le nom ÉTAIT là, et
c'est bien pourquoi aucun ne pouvait le voir.

Les 44 px sont donc pris sur les marges et non sur le nom : la hauteur de la
ligne (`-my-3`), la gouttière (`-ml-2`) et le retrait droit de l'écran
(`-mr-[26px]`). La cible reste entière, et elle tombe au bord — là où le pouce
arrive le plus vite.

**La ligne reste chargée**, et ce n'est pas réparé : trois gestes et un nom sur
390 px, c'est un de trop. La maquette qu'il a validée ne montrait pas les deux
autres. Rien n'a été restructuré sans lui (`CLAUDE.md` §3 bis) — la capture lui
est transmise, la décision est la sienne.

### « Créer la facture » quitte la ligne pour la feuille

**Le même jour, après la première capture :** *« il faut que le créer la
facture, tu le mettes dans le chevron. Il faut cliquer sur le chevron, la page
s'ouvre avec le GPS et tout machin, et là tu mets créer la facture. »*

C'est sa réponse à l'encombrement décrit plus haut, et elle règle le fond : la
ligne ne porte plus que le nom, la date, « Déplacer » et le chevron. Le nom
passe d'environ 110 px à plus de 250 — mesuré sur capture, avant et après.

**Ce qui ne doit pas se perdre en le déplaçant.** Le planning a été un
cul-de-sac jusqu'au 8 août 2026 — *« comment je fais pour avoir accès au
devis ? »* — et ce bouton avait été posé pour cela. Il coûte désormais un appui
de plus, ce qui est son choix ; il ne doit pas devenir introuvable. **Trois
suites parcourent le nouveau chemin en entier** (`test-planning-e2e`,
`test-planning-vers-facture-e2e`, `test-y-aller-e2e`), et la première vérifie
en plus que le lien a bien QUITTÉ la ligne — sans quoi les deux coexisteraient
sans que rien ne le dise.

Dans la feuille, il est **séparé des deux rangs au-dessus** par un filet, et
porté en vert pin. Copier et appeler ne touchent à rien ; celui-ci bâtit un
document. Collé aux autres, il se toucherait par erreur en visant « Appeler ».

### « M. Bernard — Chez M. Bernard », et la capture qui l'a vu

La feuille collait le nom du client devant le nom du chantier. Or un chantier
qu'on n'a pas nommé s'appelle **« Chez <le client> »** (`src/lib/nom-chantier.ts`,
posé le 5 août 2026 quand le champ « nom du chantier » a été retiré) : le cas le
plus courant du produit était donc le plus laid.

`intituleDuChantier` ne recolle le client que si le nom ne le porte pas déjà.
La comparaison ignore accents et casse — le nom du client est recopié à la
création, et l'un des deux peut avoir été corrigé depuis.

**Aucun test ne pouvait le voir** : les deux textes étaient exacts, c'est leur
mise bout à bout qui ne l'était pas. Quatrième défaut de ce dépôt trouvé en
regardant l'écran (`CLAUDE.md` §5).

### Ce que les contrôles prouvent, et ce qu'ils ne prouvent pas

`scripts/test-y-aller-e2e.ts` vérifie **le raccord** : que l'adresse arrive
vraiment jusqu'au `href`. La règle pure resterait verte même si l'écran oubliait
de la lui passer — c'est le raccord qui se casse, jamais la formule.

Il ne prouve **pas** que le GPS s'ouvre : un navigateur d'essai n'a ni Plans, ni
Waze. Ce qui est vérifiable ici, c'est que le lien est universel — donc qu'il
retombe sur un site au lieu d'échouer en silence.

---

## 71. La porte : pourquoi elle avait été oubliée, et ce qu'elle porte maintenant

**L'écran de connexion est resté neuf jours dans une identité abandonnée** — le
terre cuite `#B5502F` du 3 août, une carte blanche, aucune serif — pendant que
tout le reste passait à Arborea. Ce n'est pas un oubli de paresse, et la raison
mérite d'être écrite parce qu'elle se reproduira :

> **C'est le seul écran qu'on voit AVANT d'être connecté.** Chaque refonte s'est
> faite en parcourant l'application, donc en partant d'un écran déjà franchi. La
> porte ne fait pas partie du couloir.

Le même raisonnement vaut pour `src/app/documents-legaux/formulaire.tsx`, qui
n'est pas encore repris — et pour tout écran futur situé hors du parcours
ordinaire. **Un balayage d'identité doit partir de la liste des fichiers, jamais
d'une promenade dans l'application.**

### Ce qu'il a choisi, et en combien d'étapes

Trois maquettes, trois décisions, dans cet ordre (`docs/maquettes/`) :

| | Ce qui était en jeu | Ce qu'il retient |
|---|---|---|
| **32** | Quatre mises en page | La **ligne d'imprimé**, sans le titre « Connexion » ni la sous-ligne |
| **33** | Six animations de la marque à l'entrée | **Le tour** |
| **34** | Huit gravures dans le rond d'or | **La rose des vents** |

**La rose des vents ne remplace pas la feuille ailleurs.** L'en-tête et la barre
basse gardent la feuille : c'est une décision de marque, elle n'a pas été prise,
et `SceauAtlas` porte donc un `motif` dont la valeur par défaut reste la
feuille.

### Le tour n'a pas de plancher, et c'est un arbitrage

La maquette annonçait une demi-seconde. Ce qui est posé est **un tour d'une
demi-seconde, répété tant que la vérification n'a pas répondu** :

- **`infinite` est nécessaire.** Le serveur répond quand il répond ; sur un
  réseau de chantier, deux secondes sont plausibles. Une marque qui s'arrête au
  bout d'un demi-tour pendant que la page attend encore ressemble à une
  application plantée.
- **Le plancher n'est PAS tenu.** Si la vérification répond en cent
  millisecondes, le geste est coupé en son milieu. Le tenir supposerait de
  retarder la navigation côté client, alors que `connexionAction` redirige côté
  serveur : on paierait une demi-seconde d'attente **réelle** à chaque connexion
  pour une question d'allure. Refusé, et écrit ici pour qu'on ne le « corrige »
  pas par mégarde.

### Trois corrections qui ne dépendaient d'aucun choix

Elles sont parties avec la refonte, et chacune répare un défaut mesurable :

1. **Les champs passent de 15 à 16 px.** En dessous de 16, iOS agrandit la page
   dès qu'un champ prend le focus — le patron tapait son adresse et l'écran lui
   sautait au visage, à charge pour lui de le rétablir. Le jeton
   `styleChampPlage` l'interdit depuis le 10 août ; cet écran ne s'en servait
   pas, faute d'avoir été repris.
2. **Le refus quitte `text-red-600`** — un rouge de bibliothèque — pour
   `colors.alert`, celui de la charte.
3. **La place du message est réservée en permanence** (`min-h-[19px]`). Sans
   elle, l'apparition du refus pousse le bouton d'une ligne, et l'appui suivant
   tombe à côté.

### L'adresse qui s'effaçait à chaque refus

**Défaut ANTÉRIEUR à cette refonte, jamais signalé, trouvé sur une capture.**
Sur un mot de passe faux, l'écran répondait « Email ou mot de passe incorrect »
**et vidait le champ de l'adresse** : il fallait la retaper en entier, sur un
téléphone, pour un caractère raté ailleurs — et s'il réappuyait sans le voir, le
navigateur lui opposait un « Please fill out this field » en anglais.

Personne ne l'avait vu parce que **aucune suite ne se trompe de mot de passe** :
toutes entrent par une session fabriquée, parce que c'est plus rapide.
`scripts/test-porte-e2e.ts` est la première à passer par où il passe.

**Quatre correctifs sont tombés avant le bon, et la raison vaut d'être écrite :**
React remet le formulaire à zéro *dans le DOM* après une action, et cette remise
arrive **après** le rendu qui suit. Ne tiennent donc pas :

| Essai | Pourquoi il tombe |
|---|---|
| Champ contrôlé (`value=`) | La propriété `value` n'ayant pas changé d'un rendu à l'autre, React n'écrit rien — le DOM reste vide |
| Remise en place dans un effet | L'effet passe avant l'effacement |
| `defaultValue={…}` | React ne pose cette valeur **qu'au montage** et ignore ses changements ensuite |
| Écrire `champ.defaultValue` par une `ref` | Juste, mais dépendant de l'ordre des opérations |

Ce qui tient : **la `ref` qui tient la valeur par défaut à jour, ET une `key`
qui remonte le champ à chaque envoi**. Un champ neuf naît avec la bonne valeur
par défaut ; qu'une remise à zéro arrive avant ou après ne change alors plus
rien. Le mot de passe, lui, reste effacé — c'est celui qu'on vient de rater.

**Ce qui a fait gagner du temps à la fin :** aller lire l'état réel du
navigateur (`value`, `defaultValue`, présence des clés React) au lieu de
raisonner sur ce qu'il aurait dû faire.

### Le serveur de développement n'hydrate pas cet écran, ici

**À savoir avant d'accuser un correctif.** Dans cet environnement, la liaison de
rechargement à chaud de `next dev` est refusée par le mandataire réseau
(`ERR_INVALID_HTTP_RESPONSE`). L'écran de connexion n'est alors **pas hydraté** :
le formulaire part en HTML pur, la page se recharge entièrement, et tout champ
redevient vide **quel que soit le code**. Sur la version BÂTIE — celle du banc du
patron — l'interception a bien lieu : le sceau tourne, le bouton se désactive, et
l'adresse survit. Mesuré, pas supposé.

`test-porte-e2e.ts` **compte les navigations complètes** et annonce les deux
contrôles concernés « non concluants » plutôt que rouges. Un contrôle qui accuse
à tort coûte plus cher que pas de contrôle du tout — et celui-ci aurait accusé
un correctif qui fonctionne.

### Ce qu'on ne touche pas sans regarder ailleurs

`name="email"`, `name="password"` et `type="submit"`. **Vingt scripts de capture
et `scripts/verifier-connexion.mjs`** — le seul contrôle qui éprouve une vraie
connexion derrière une origine étrangère — passent par ces trois sélecteurs.

Et le bouton reste **écrit à la main** : `PrimaryButton` impose `type="button"`,
ce qui casserait l'envoi du formulaire sans qu'aucun type ne s'en aperçoive.
Seule sa **forme** est partagée, et `scripts/test-boutons-arrondis.ts` la garde
(voir §67).
## 72. L'écran d'un devis parti : deux écrans, pas un avec des variantes

**Le 12 août 2026, capture à l'appui :** *« je trouve qu'il y a trop d'infos sur
cette page »*. Mesuré avant de dessiner : **onze blocs**, et **382 px de
débordement** sur sa dalle. La carte d'état portait à elle seule six choses,
dont l'adresse complète du lien sur trois lignes illisibles.

### La décision, et elle n'est pas graphique

Le même écran servait deux moments qui n'ont rien en commun :

- **avant l'envoi**, le patron VÉRIFIE — il a besoin des lignes, du total, de
  l'aperçu, du rappel du client ;
- **après l'envoi**, il ATTEND — il vient voir où ça en est, et relancer.

Un empilement de cartes qui sert les deux sert mal les deux. `ExportClient` rend
donc désormais **deux mises en page distinctes**, et non une avec des conditions.
Les lignes de prestations vivent du côté « avant » : c'est là qu'on vérifie ce
qui part, pas après.

La mise en page de l'écran d'attente est **la sienne** — idée 5 de
`docs/maquettes/34-le-devis-sur-sa-base.html`, « le signet d'or » : un filet d'or
vertical pour l'état, le nom du devis et le montant seuls au centre, « Modifier
mon devis » sous le total, le geste et les trois actions en bas sous le pouce.

### La hauteur ne s'écrit pas à la main — deux échecs pour l'apprendre

Le geste doit être **en bas**, sous le pouce. Deux tentatives ont débordé, et
**c'est la suite qui les a trouvées, pas l'œil** :

| Tentative | Ce qu'elle valait |
|---|---|
| `min-height: calc(100vh - 232px)` | 232 = l'en-tête « mesuré ». Débordait de **100 px**, et serait devenu faux au premier mot ajouté à un titre |
| `min-h-screen` + `pb-16` | Comptait **deux fois** la barre du bas : `main.atlas-contenu` réserve déjà `--atlas-barre`. Débordait de **68 px** |

La bonne réponse existait depuis toujours : **`atlas-ecran`**, la classe de
l'écran des chantiers — `height: calc(100dvh - var(--atlas-barre) -
env(safe-area-inset-top))`, colonne, rien qui dépasse. Une seule définition à
tenir à jour, et elle est déjà juste.

Ce qu'elle impose, et qui est fait : `overflow: hidden` signifie qu'une zone
doit défiler à l'intérieur, sinon le bas est **coupé sans que rien ne le dise**.
D'où `.atlas-colonne-defile` — écrite pour être réutilisée, parce que la
cinquième zone recopiée aurait fini par oublier de masquer sa barre grise, comme
c'est déjà arrivé au fil des chantiers le 11 août.

**Règle générale, puisqu'elle s'est vérifiée deux fois de suite :** un nombre qui
décrit la hauteur d'un autre élément est un défaut en attente. Faire partager la
hauteur, ne pas la soustraire.

### « Modifier mon devis » engage quelque chose, donc il prévient

Le patron a demandé un lien sous le total. Ce lien n'existait pas : jusqu'ici,
« Devis à la main » **disparaissait** une fois le devis parti, et le rouvrir
passait par « Corriger et renvoyer » — réservé à un refus.

Vérifié dans le dépôt avant d'écrire l'écran, et c'est ce qui a décidé de la
forme : `getOuCreerDevisBrouillon` crée bien une nouvelle version dès que la
dernière est partie, **mais l'envoi déjà fait n'est pas annulé**. La page
publique sert `envoi.devis` — la version que le client a reçue. Il continue donc
de la voir, et **peut l'accepter au prix d'avant**, tant qu'une nouvelle n'est
pas envoyée.

Le taire, c'est laisser le patron croire qu'il a corrigé un prix que son client
peut encore accepter à l'ancien. Une feuille le dit en trois lignes, une seule
fois, et se refuse — **et refuser ne crée aucune version**, ce que la suite
vérifie explicitement (`CLAUDE.md` §4 : rien ne s'engage sans un geste).

**Deux portes vers la même pièce seraient une de trop.** Quand le client a
refusé, demandé une correction, ou laissé le lien expirer, reprendre le devis EST
l'action principale : elle garde son bouton plein et « Modifier mon devis »
s'efface. Tant qu'il réfléchit, c'est l'inverse.

### Ce que la maquette avait perdu, et que le code a rattrapé

**« Plutôt par e-mail » ne figurait dans AUCUNE des cinq propositions.** Ni lui
ni moi ne l'avions vu. Le livrer ainsi aurait défait sa demande du 4 août —
*« si je veux l'envoyer par e-mail, je ne peux pas revenir le choisir »*. Il
reprend sa place sous la ligne du destinataire, qui nomme déjà le canal : c'est
là qu'on s'aperçoit qu'on s'est trompé de voie.

**Leçon : une maquette validée n'est pas un cahier des charges complet.** Ce
qu'elle ne montre pas peut être ce qu'on efface sans le savoir. Avant de coder
d'après une maquette, relire ce que l'écran portait — et nommer ce qui disparaît.

### Le numéro se relit, ou il ne sert à rien

`src/lib/numero-lisible.ts` espace le numéro du destinataire : `0679984514` →
`06 79 98 45 14`. Ce n'est pas une coquetterie. Cette ligne est **la dernière
chose que le patron voit avant d'ouvrir sa messagerie**, et le 12 août son devis
n'est pas parti à cause d'une faute dans une adresse qu'il n'avait pas relue.

**Elle refuse de grouper tout ce qu'elle ne reconnaît pas** — indicatif
international, poste à quatre chiffres, saisie en cours. Un numéro étranger
découpé par paires aurait l'apparence d'un numéro français normal tout en étant
faux : sur une ligne dont l'unique rôle est la vérification, c'est le pire
résultat possible, pire que de ne rien faire.

**Le lien `sms:` continue de porter le numéro brut** : c'est `lienTransmission`
qui retire les séparateurs, et jamais l'affichage. Les deux assertions
coexistent dans `test-transmission-e2e` — le jour où l'affichage contaminerait le
lien, la première rougirait.

### Ce qu'un écran retire, six contrôles le pleurent

Retirer l'adresse affichée a fait tomber **six contrôles** répartis dans deux
suites — et aucun ne portait sur l'affichage. Ils lisaient simplement le jeton
du devis là où il était commode de le lire : à l'écran.

C'est un défaut de contrôle, pas de produit. Un contrôle qui prélève une donnée
sur un détail d'affichage se lie à ce détail, et rougira le jour où il change —
en accusant l'écran, jamais lui-même.

**La règle qui en sort :** un contrôle prend ce dont il a besoin **là où la
chose existe pour de bon** — la base, ou le geste que le doigt touche. Jamais
dans un texte affiché à côté, à moins que ce texte ne soit précisément ce qu'il
éprouve.

Et quand un contrôle tombe sur un changement voulu, la question n'est pas
« comment le faire repasser » mais **« que défendait-il, au juste ? »**. Ici,
« un devis en attente affiche son lien » défendait en réalité *relancer ne doit
pas obliger à regénérer un devis*. Réécrit ainsi, il éprouve le geste de relance
et le nombre de versions en base — et il ne dépend plus de rien qui puisse
changer sans qu'on le veuille.
### Une classe niée `[^>]` ne traverse pas une flèche

**Le 12 août 2026 au soir**, `test-boutons-arrondis.ts` laissait passer douze
boutons carrés sur treize. Son motif — `<(?:button|a)\b[^>]*?rounded-\[…\]` —
s'arrête au premier chevron, **et `() =>` en porte un**. Tout bouton muni d'un
`onClick` lui était donc invisible.

C'est le piège général, et il vaut au-delà de ce contrôle : **en JSX, une classe
niée sur `>` ne délimite pas une balise.** Les accolades y contiennent du
JavaScript, donc des flèches, des comparaisons, des génériques. Écrire
`(?:[^>]|=>)` couvre le cas courant ; au-delà, il faut analyser, pas filtrer.

**Et la leçon qui compte davantage :** ce contrôle avait déjà rougi une fois, sur
le seul bouton sans `onClick`. Il paraissait donc fonctionner. Un contrôle
confronté à un unique cas — surtout s'il est atypique — n'a rien prouvé : il faut
l'éprouver sur le cas COURANT, celui qui représente la population qu'il surveille.
Ici, le témoin porte désormais les deux formes, avec flèche et sans.

---

## 73. La facture part par SMS **ou** par e-mail, et se télécharge

**Le patron, le 10 août 2026, capture à l'appui** (`TODO.md` §8). Trois manques
sur l'écran Facture, dont deux sont réparés ici. Le troisième — le dessin du
bouton — se dessine avant de se coder, et attend son choix.

### « On ne propose que le SMS »

C'était le plus grave des trois, et il se chiffre : **un client sur deux n'a
pas de portable enregistré**, et l'écran de la facture n'offrait aucune autre
voie. Le canal venait de la fiche du client et ne se rediscutait plus.

**Le même défaut avait déjà été réparé sur le devis le 4 août** (§13,
`TransmettreAuClient.tsx`), après une phrase presque identique : *« si je veux
l'envoyer par e-mail, je ne peux pas revenir le choisir »*. Il est resté ici
deux semaines de plus, et personne ne l'a vu — parce que **rien ne relie deux
écrans qui font la même chose**. C'est la leçon utile : quand un défaut est
corrigé à un endroit, chercher aussitôt son jumeau ailleurs.

`src/app/chantiers/[id]/facture/TransmettreLaFacture.tsx` offre donc les deux voies, à tout moment :

- **la bascule est toujours là**, avant comme après la préparation du lien.
  Jamais présélectionnée : la voie normale reste celle convenue sur la fiche ;
- **la coordonnée manquante se saisit sur place**, et elle est écrite **sur le
  client** — pas retenue pour ce seul envoi. Renvoyer le patron « sur la fiche
  du client » l'enverrait vers une porte qui n'existe pas (§62) ;
- **rien n'est recopié du devis** : le message vient de `composerMessageFacture`,
  l'adresse de `lienTransmission`, l'enregistrement de la coordonnée de
  `enregistrerCoordonneeClientAction` — la même action que l'écran du devis.
  Deux implémentations d'un même geste divergent toujours, et c'est le client
  qui lit la mauvaise (`CLAUDE.md` §3).

**Un seul lien, un registre qui dit vrai.** Basculer après avoir préparé le lien
ne fabrique pas un second envoi : le client aurait deux adresses pour la même
facture. Mais le canal inscrit, lui, est corrigé
(`corrigerCanalEnvoiFacture`) — sans quoi une facture partie par courriel
resterait inscrite « SMS » pour toujours, et c'est le genre de mensonge
tranquille qu'on découvre six mois plus tard en cherchant une preuve d'envoi.

### « Impossible d'enregistrer la facture »

Il ne pouvait qu'**ouvrir** le PDF. Un lien « Télécharger (F2026-0001.pdf) » se
pose sous « Voir la facture en PDF » — les deux gestes coexistent, le second ne
remplace pas le premier.

**Trois choses à ne pas défaire :**

1. **C'est le SERVEUR qui range le fichier**, pas l'attribut `download` du lien.
   `?telecharger=1` fait répondre `Content-Disposition: attachment`. L'attribut
   seul est ignoré par certaines versions d'iOS, et le PDF s'ouvre alors dans un
   onglet sans que rien ne soit enregistré — c'est-à-dire le défaut d'origine,
   déguisé en correctif.
2. **Le nom porte le numéro** — « F2026-0001.pdf », jamais « facture.pdf ». Il
   en aura des centaines dans le même dossier, et « facture (17).pdf » ne se
   retrouve pas.
3. **Le nom vit à DEUX endroits** — l'attribut du lien et l'en-tête du serveur —
   et rien dans le code ne les relie : l'un ne traverse pas jusqu'à l'autre.
   Deux suites les comparent (`test-facture-au-client-e2e.ts`,
   `capture-facture.mts`). **Elles ont trouvé l'écart au premier jet** : après
   l'arrêt de la facture, sans rechargement, l'écran annonçait encore
   « F2026-0001-brouillon.pdf » pendant que le serveur servait
   « F2026-0001.pdf » — parce que le libellé lisait le rendu d'arrivée et non
   l'état vivant de l'écran.

### Le bouton : dessiné, montré, puis codé — dans cet ordre

« Ouvrir le SMS tout prêt » gardait ses 4 px de rayon parce qu'il était **peint
à la main dans l'écran** : c'est ce qui lui avait fait manquer la capsule du
11 août, exactement comme la feuille d'envoi du devis (§66). Une action
principale dessinée sur place échappe à toute décision d'ensemble.

Une demande d'apparence se **dessine** avant de se coder (`CLAUDE.md` §3 bis).
Deux planches l'ont précédé : `38-le-bouton-de-la-facture.html` (deux dessins
immobiles) puis, à sa demande, `39-le-bouton-de-la-facture-a-lessai.html` —
cinq gestes qui se pressent. **Il a retenu A, la capsule nue**, et le bouton
passe désormais par `PrimaryButton`.

**Deux réglages facultatifs ont été ajoutés à `PrimaryButton`, et aucun ne
touche au dessin** — en ajouter un d'apparence rouvrirait « une seule forme
d'action », qui est le sujet même de ce composant :

- **`onClick` est honoré sur la variante `href`.** Elle le perdait en silence.
  Ce bouton-là est un lien (`sms:`, `mailto:`) qui doit AUSSI retenir le départ
  vers la messagerie ; sans ce correctif, le retour n'aurait plus ramené à
  l'accueil avec un mot (`src/lib/annonce-transmission.ts`).
- **`repere` pose un `data-atlas`.** Sans lui, une suite ne peut désigner ce
  lien que par son texte — et « Ouvrir le SMS tout prêt » ressemble assez à
  « Ouvrir l'e-mail tout prêt » pour qu'un contrôle passe au vert sur le
  mauvais.

**Deux suites mesurent le RAYON CALCULÉ** (`test-facture-au-client-e2e.ts`,
`capture-facture.mts`) : un retour au dessin local les rend rouges. Le
recensement des actions encore dessinées sur place est dans `TODO.md` §0 octies.

**Les quatre gestes écartés restent dans la maquette 39** — la lueur, le cachet,
l'encre, le trait. Si le sujet se rouvre, c'est de là qu'il faut repartir : les
redessiner serait refaire un chemin déjà parcouru.

---

## 74. Le calendrier ne marquait qu'un jour, et il en fallait deux

**Le patron, le 12 août 2026, capture à l'appui :** *« je ne peux pas choisir
deux jours à partir du planning […] En fait je ne peux choisir que deux jours si
c'est les premières propositions qu'il y a tout en haut. Mais dès que je choisis
à même le planning, je ne peux choisir qu'un seul jour. Or je dois pouvoir
proposer deux jours au client. »*

### Deux états pour une seule vérité

`EnvoiAuClient` portait la sélection à **deux endroits** :

- `selection`, un tableau — ce qui part réellement au client ;
- `autreDate`, **une chaîne**, pour le jour choisi au calendrier.

Et le calendrier ne recevait que la seconde : `retenus={autreDate ? [autreDate] : []}`.
Choisir un second jour effaçait donc le premier **sous ses yeux**. Rien ne lui
disait que les deux étaient retenus — et il en concluait, à raison, qu'il ne
pouvait en proposer qu'un.

**La conséquence la plus traître était l'autre :** rappuyer sur le premier jour
pour le retirer le **remettait**. Le geste de retrait ne fonctionnait que sur le
dernier jour touché, parce qu'il se comparait à `autreDate` et non à ce qui était
réellement retenu.

**`selection` fait désormais foi, et elle seule.** Ce qui reste de `autreDate`
— renommé `jourInterroge` — ne sert plus qu'à afficher la phrase du serveur sous
le calendrier. Le calendrier reçoit `retenus={selection}` : ce que le patron voit
est exactement ce que son client recevra, jours de la liste du haut compris.

### La règle des deux dates était écrite deux fois

`src/lib/calendrier.ts` porte `basculerJour(retenus, jour, maximum)` depuis le
9 août — pure, éprouvée sans navigateur, et **personne ne s'en servait**.
L'écran avait sa propre copie, à trois lignes près la même. C'est très exactement
ce que `CLAUDE.md` §3 interdit : *« deux implémentations finissent toujours par
diverger »*. L'écran appelle maintenant la fonction du dépôt.

### Pourquoi aucune suite ne l'avait vu

`test-date-lointaine-e2e` choisit **une** date au calendrier et vérifie qu'elle
part — ce qu'elle faisait parfaitement. Personne n'avait jamais essayé d'en
choisir deux.

**Un parcours à moitié joué ne prouve que la moitié qu'on joue.** Quand un écran
offre un maximum (deux dates, trois photos, cinq lignes), l'éprouver à un seul
exemplaire ne dit rien du second — et c'est au second que les états parallèles se
révèlent. `test-deux-dates-calendrier-e2e.ts` rejoue son geste entier : deux
jours pris au calendrier, un retiré, un troisième qui chasse le plus ancien, et
les deux qui partent en base. Confronté au code d'avant, il échoue sur sa phrase
exacte — « le calendrier ne marque que […] ».

### Deux suites voisines ont dû être corrigées, et pour deux raisons opposées

**`test-envoi-client-e2e` accusait à tort.** Il comptait `button[aria-pressed="true"]`
sur tout l'écran et annonçait « 4 dates retenues au lieu de 2 » — sur une
sélection parfaitement juste. Depuis que le calendrier marque la sélection, un
même jour est légitimement pressé à deux endroits : sa ligne dans la liste, et
sa case au calendrier. Il compte désormais des **jours** (les lignes portant
« proposée »), pas des boutons.

**`test-retour-messagerie-e2e` tirait au sort.** Il empruntait un chantier à une
autre suite — `SELECT … WHERE reponse IS NULL LIMIT 1`, sans `ORDER BY` ni
propriétaire — et le jeu de démonstration n'en fournit aucun : son unique devis
envoyé porte déjà une réponse. Il ne pouvait donc pas tourner seul, et **ajouter
une suite ailleurs a suffi à changer l'ordre physique des lignes** et à le faire
tomber sur un chantier dont l'écran d'envoi ne monte pas le mécanisme du retour.
Il accusait alors le retour de messagerie, qui n'y était pour rien. Il fabrique
maintenant son propre chantier, du client au devis parti.

**La règle qui en sort :** une suite qui dépend des restes d'une autre n'éprouve
pas ce qu'elle croit — et le jour où elle rougit, elle désigne le mauvais
coupable.
---

## 75. L'agenda iCloud : pourquoi ce n'est pas le raccordement de Google

**Sa demande du 12 août 2026**, capture du Calendrier d'Apple à l'appui : *« je
peux connecter ce calendrier à mon appli ? »* — puis, aux deux questions
posées : le compte derrière la vitrine est **iCloud**, et il veut **les deux
sens**. Enfin : *« code pour qu'on puisse lire et écrire dans cet agenda »*.

### La distinction qui commande tout : le Calendrier d'Apple est une vitrine

Il affiche aussi bien iCloud que Gmail ou un compte professionnel. **Ce qu'on
relie, c'est le compte derrière**, jamais l'application — et selon lequel, le
travail va de zéro (Google : le code existait) à un fournisseur entier.

C'est pour cela que la question a été posée **avant** de répondre. Une prochaine
session qui verrait la même capture doit poser la même question, et non déduire
« Apple » de l'icône.

### Ce qu'Apple n'a pas, et qui explique le reste

| | Google | iCloud |
|---|---|---|
| Consentement | Une page, un bouton, rien à taper | **Aucun équivalent pour l'agenda** |
| Ce qui autorise | Un jeton, restreint à une portée | Un **mot de passe pour les apps**, recopié à la main |
| Ce que ça ouvre | L'agenda seul | **Tout l'iCloud** — mail, contacts, fichiers |
| Révocation | Depuis le compte Google, par application | Depuis le compte Apple |
| Engagement du fournisseur | Interface publique et versionnée | **Aucun** — CalDAV chez Apple n'est pas documenté publiquement |

« Se connecter avec Apple » existe, mais ne rend qu'une identité : il ne donne
jamais accès au calendrier. Il n'y a donc **pas** de chemin plus propre à
trouver — c'était la première hypothèse, et elle est fausse.

**Trois conséquences, écrites dans le code plutôt que dans un commentaire :**

1. le mot de passe est **chiffré au repos** (`secret-au-repos.ts`), comme les
   jetons Google, et **jamais renvoyé à l'écran** — même dans un message
   d'erreur (`test-agenda-apple-base.ts` le vérifie sur les octets stockés) ;
2. l'écran **prévient avant de faire taper**, et le contrôle le vérifie **par la
   position** du bloc, pas par la présence du texte : une phrase juste placée
   sous le champ est une phrase lue trop tard ;
3. l'écriture reste **éteinte** tant que l'artisan ne l'a pas allumée.

### Où vivent les décisions, et pourquoi elles n'ont pas pu vivre ailleurs

Le mandataire réseau de l'environnement de développement refuse
`caldav.icloud.com`. Tout ce qui *interprète* quelque chose a donc été mis hors
d'atteinte du réseau :

| Module | Ce qu'il décide | Éprouvé par |
|---|---|---|
| `src/lib/ics.ts` | Quelles périodes porte un texte iCalendar, et ce qu'Atlas y écrit | `scripts/test-ics.ts` |
| `src/lib/caldav.ts` | Quel agenda est le sien, lequel n'est qu'un abonnement, lequel accepte qu'on y écrive | `scripts/test-caldav.ts` |
| `src/lib/fuseau.ts` | L'heure de pendule → l'instant | les deux |
| `src/server/agenda/apple.ts` | **Rien.** Trois appels HTTP | *non éprouvé ici* |

Ce qui reste non vérifié chez Apple, ce sont donc des appels réseau — pas une
seule décision. C'est le même partage que pour Google (`google.ts`), et il n'est
pas cosmétique : c'est ce qui rend une panne d'Apple diagnosticable.

### Les cinq pièges du format, et ce qu'ils coûtaient

- **Le repliage à 75 octets.** Ne pas déplier ne casse pas bruyamment : cela
  produit un intitulé coupé au milieu d'un mot et une ligne parasite.
- **La fin d'un événement « toute la journée » est EXCLUSIVE.** Un congé du 14
  au 14 s'écrit `DTSTART:20260814`/`DTEND:20260815`. Ne pas reculer d'une
  seconde barre un jour de plus, à chaque congé de l'année.
- **`Date.UTC` ne refuse rien, il reporte.** `20261332` — mois treize, jour
  trente-deux — devenait le 1er février 2027, en silence : une journée barrée un
  an plus tard, sans raison visible. **Trouvé par le contrôle, pas à la
  lecture.** Une donnée mal formée doit produire MOINS d'occupation, jamais une
  occupation inventée.
- **Les séries récurrentes sont dépliées PAR LE SERVEUR** (`<C:expand>`), qui
  connaît les exceptions et les occurrences déplacées. Sans lui, une réunion
  hebdomadaire ne rendrait qu'une occurrence, et toutes les autres semaines
  paraîtraient libres — donc proposables à un client.
- **Le fuseau se convertit en deux passes.** Le décalage dépend de l'instant, et
  l'instant est ce qu'on cherche. Une seule passe se trompe d'une heure sur les
  dates qui suivent un changement d'heure — deux fois par an, aux seules dates
  où personne ne pense à regarder.

### L'écriture : ce qui la rend réversible

**L'identifiant de l'événement se déduit du chantier** (`atlas-<id>`). Trois
conséquences, et ce sont elles qui rendent l'écriture acceptable :

1. **replanifier réécrit** au lieu d'ajouter — sinon l'agenda se constellerait
   de doublons qu'Atlas serait incapable de retrouver ;
2. **le préfixe `atlas-` dit ce qu'Atlas a le droit d'effacer.** Tout le reste
   de l'agenda lui est étranger et le demeure ;
3. **débrancher retire d'abord, oublie ensuite.** Effacer la ligne en premier
   perdrait le mot de passe, donc le seul moyen d'aller reprendre les
   rendez-vous. Et un ménage qui échoue n'empêche pas de débrancher : ce qui est
   resté est **dit**, ce n'est pas une raison de garder un mot de passe dont
   l'artisan ne veut plus.

**Le repli est un calendrier séparé, pas « Perso ».** Ce qu'Atlas a posé se
retire alors d'un geste ; semé parmi ses rendez-vous, il se reprend un par un.

**L'écriture a lieu APRÈS la transaction, jamais dedans** (`src/app/planning/actions.ts`)
— tenir une transaction PostgreSQL ouverte le temps d'un appel à Apple
immobiliserait une connexion du pool pour la durée d'un service qu'on ne
maîtrise pas. Et elle **ne jette pas** : une panne d'Apple ne doit pas faire
perdre au patron le geste qu'il vient de faire. Ce qui n'a pas pu être écrit est
inscrit, l'écran le montre, et « Renvoyer mes chantiers » le rattrape.

### Un seul point de fusion, et c'est le point important

`periodesOccupeesExterieures` interroge **les deux fournisseurs de front** et
rend une seule liste. Laisser chaque appelant décider lesquels consulter
garantirait qu'un écran en oublie un : le planning tiendrait compte des deux, la
page du client d'un seul, et **le doublon reviendrait par la porte qu'on croyait
fermée** — c'est exactement le défaut que le lot du 9 août avait fermé côté
Google (§ sur `envois-devis`).

`Executeur` a été sorti dans `src/server/repositories/agenda-executeur.ts` pour cela : les
deux raccordements en ont besoin, et le laisser chez Google aurait fait dépendre
Apple de Google — ou produit une seconde copie, ce que ce module existe
justement pour éviter.

### Ce qui n'est PAS vérifié, et qui doit être dit comme tel

**Aucun échange réel avec iCloud n'a eu lieu.** Le réseau d'ici le refuse
(essayé le 12 août 2026 : connexion refusée). Ce qui reste à éprouver sur son
banc, avec un vrai mot de passe : la découverte des agendas, la lecture, le
dépôt, le retrait. Ne pas annoncer le raccordement comme éprouvé avant que cela
ait tourné une fois pour de bon.
## 76. « Une réponse inattendue du serveur » : un état du banc, pas un défaut du code

**Sa capture du 12 août 2026, 14 h 04.** Panneau rouge, anglais, pile d'appel
dans `node_modules` : *« An unexpected response was received from the
server. »*

### Ce que la capture disait, et qu'il fallait lire

Le chemin de la pile commençait par **`.next/dev`** : son banc servait la
version LENTE. Or c'est tout le sujet de `banc.mjs` (§45) — en développement,
Next ne compile un écran qu'au premier appel : trente à cent secondes ici,
davantage sur son disque. **Le relais de GitHub, lui, abandonne au bout d'une
minute** et rend sa propre page d'erreur. Le navigateur reçoit alors du HTML là
où il attendait une réponse d'Atlas, et le cadre dit exactement cette phrase.

Trois causes produisent ce message, dans l'ordre de fréquence sur son banc : le
relais qui abandonne, l'application qui se recompile sous la page ouverte après
une mise à jour, ou le serveur coupé et pas encore relevé. **Aucune n'est
réparable depuis le navigateur, et toutes se résolvent en rechargeant.**

### Ce qui n'a pas été fait, et pourquoi c'est la décision principale

La cause **n'a pas été reproduite ici**. Le bouton de mise à jour, joué dans les
conditions du banc — code changé sous la page ouverte, recompilation, appui —
s'est comporté correctement. Rien n'a donc été corrigé au jugé : c'est la faute
que ce dépôt paie le plus cher, et elle avait déjà été commise deux fois dans la
même journée (voir §72 et le CHANGELOG du 11 août).

Ce qui a été livré, c'est ce que la doctrine prescrit devant un défaut muet :
**le rendre bavard** (`AGENTS.md`).

### Deux dispositifs, et ce qu'ils refusent

**`src/lib/reponse-illisible.ts`** — fonction pure. Quatre formulations
reconnues, selon le navigateur et la version du cadre. Elle **refuse tout le
reste**, et c'est le point important : habiller en « le serveur se prépare » un
défaut venu du code enverrait recharger une page qui ne guérira pas, et
masquerait le défaut. Six messages réels sont éprouvés comme devant rester tels
quels — dont « Invalid Server Actions request. », qui appartient à une autre
famille et appelle un autre geste (§34).

**`VeilleReponseServeur`** — posé dans la coque, **hors du choix
avec/sans barre de navigation**. Il y était d'abord dans la seule branche à
barre : l'écran de connexion en était dépourvu, c'est-à-dire l'écran où une
réponse coupée est la plus probable — premier appel, compilation de tout, et
aucun autre repère pour le patron. La suite navigateur l'a montré avant que
quiconque ne le lise.

**Et l'écran Réglages dit qu'il sert la version lente.** `NODE_ENV` tranche sans
ambiguïté — `next start` impose `production` (`demarrer.sh`), la même règle que
`issueApresMiseAJour`. Sans cette ligne, le patron ne pouvait pas relier son
panneau rouge à l'état de son banc.

### La règle générale

**Un message du cadre en anglais n'est jamais une livraison.** Soit on connaît
la famille d'échec et on la dit en français avec le geste, soit on ne la connaît
pas — et il faut alors la laisser passer intacte plutôt que de l'habiller. Une
phrase rassurante posée sur un vrai défaut vaut moins que pas de phrase du tout.

---

## 77. « Mr. Martins », et la migration qui ne changeait rien en silence

**Le patron, le 13 août 2026, capture de son écran Devis à l'appui :**

> *« Il faut qu'il y ait écrit monsieur Martins et pas chez Martins. Ensuite tu
> me retires le tiret entre le nom et l'adresse et il faut qu'il soit l'un
> au-dessus de l'autre. D'abord le nom, ensuite à la ligne l'adresse. Pour le
> client, c'est pareil. C'est M. Martins, puis le numéro de téléphone en
> dessous, sans les tirets. »*

### La civilité vit dans un seul fichier

`src/lib/civilite.ts` — `avecCivilite(nom)`. Elle sert au nom du chantier à sa
création (`nomDuChantier`), à la ligne « Client » de l'écran Devis, et à la
phrase « Devis prêt pour … ». Trois endroits, une règle : recopiée, on aurait lu
« Mr. Martins » en tête d'un écran et « Martins » trois lignes plus bas.

**Le mot lui-même a changé le jour même, et c'est pour cela qu'il est une
constante.** D'abord « Monsieur », puis, une fois vu à l'écran : *« Mr. Martins,
pas Monsieur. »* `CIVILITE_PAR_DEFAUT` est le seul endroit où il s'écrit, et
**les contrôles construisent leurs attentes à partir d'elle** au lieu de le
recopier — sinon un mot changé par le patron rougirait dix suites sans rien
apprendre à personne. Un cas, et un seul, épingle le mot en clair
(`test-civilite`, « et ce mot est CELUI QU'IL A DEMANDÉ ») : sans lui, la
constante pourrait valoir n'importe quoi et tout resterait vert.

**Ce qu'elle suppose, et qu'il faut assumer plutôt que taire.** Il n'existe
aucun champ de civilité dans `clients`. Quand le patron tape « Martins », rien
ne dit si c'est un homme, une femme ou une société : **la civilité est un
défaut, pas une donnée**. Une cliente sera donc mal nommée. Le patron l'a
demandé en sachant qu'il n'avait saisi qu'un patronyme ; le vrai remède est un
choix de civilité à la création du client, qui n'existe pas encore.

Ce que la fonction sait éviter, en revanche : « Mr. Mme Roux » (une
civilité déjà écrite n'en reçoit pas une seconde, quelle qu'en soit la graphie)
et « Monsieur SARL Untel » (une raison sociale n'est pas une personne). Elle est
**idempotente** — l'appliquer deux fois donne le même résultat, ce qui permet de
la poser sur un nom déjà stocké.

**Un invariant du dépôt a été levé par cette demande, et c'est écrit.**
`nom-chantier.ts` tenait que chaque mot du nom venait de la saisie ; ce n'est
plus vrai. Ne pas « rétablir » l'ancienne règle sans lui : elle a été levée, pas
oubliée (`scripts/test-nom-chantier.ts`, cas INVARIANT).

### La leçon qui vaut au-delà de cet écran : une migration de DONNÉES sur une table sous RLS

`nomDuChantier` ne tourne qu'à la création : le nom est ensuite écrit dans
`chantiers.nom`. Corriger la fonction seule aurait laissé « Chez Martins » sur
tous les chantiers en cours — c'est-à-dire sur l'écran même que le patron
photographiait. D'où `drizzle/0036_monsieur_plutot_que_chez.sql`.

**Première version : un `UPDATE chantiers … FROM clients …` ordinaire. Elle
s'est appliquée sans erreur, a rapporté un succès, et n'a rien changé.**
Constaté sur quatre chantiers d'épreuve, tous restés « Chez … ».

`chantiers` et `clients` portent la RLS en mode **forcé**
(`relforcerowsecurity`), avec la politique `tenant_isolation` :

```sql
entreprise_id = NULLIF(current_setting('app.entreprise_id', true), '')::uuid
```

Le propriétaire lui-même y est soumis. Sans contexte posé, `current_setting`
rend la chaîne vide, le prédicat vaut NULL, **aucune ligne n'est visible**, et
l'UPDATE passe dans le vide sans un mot. C'est le piège que `CLAUDE.md` §3
décrit — *« une requête hors de ce cadre ne renvoie rien, silencieusement »* —
rencontré ici pour la première fois **dans une migration**.

**Ce que fait la version retenue, et ce qu'on ne fait surtout pas.** On ne
désactive pas la RLS (`CLAUDE.md` §4). La migration boucle sur `entreprises` et
pose `app.entreprise_id` pour chacune — la même mécanique que la file
`audios_a_purger`. Elle efface le contexte en sortant.

**Les migrations précédentes qui modifiaient des données ne touchaient que
`termes_metier`, table sans RLS forcée.** Rien dans le dépôt n'avait donc
rencontré ce cas. Toute migration future qui écrit dans une table portant
`entreprise_id` doit faire de même — ou ne rien faire, en silence.

### Deux contrôles, et pourquoi ils sont deux

- **`scripts/test-civilite.ts`, « la migration et la fonction disent la même
  chose »** — la règle existe deux fois, en TypeScript et en SQL, parce que le
  lanceur de migrations ne sait exécuter que du SQL. Ne pouvant n'en garder
  qu'une, on les **confronte** sur un même corpus. Le prédicat SQL n'est pas
  recopié dans le test : il est **extrait du fichier de migration**, entre les
  repères `-- <predicat-civilite>` … `-- </predicat-civilite>`. Ne pas déplacer
  ces repères sans mettre le contrôle au courant.
- **`scripts/test-civilite.ts`, « la migration renomme vraiment »** — rejoue la
  migration dans une transaction annulée et vérifie le RÉSULTAT. Un « 1
  migration appliquée » ne prouve rien : c'est exactement ce que disait la
  version qui ne changeait rien.

  **Ce contrôle-là a d'abord été un faux vert**, et le noter vaut mieux que le
  taire : il posait lui-même `app.entreprise_id` pour ses insertions, la
  migration en héritait (un `set_config` local vaut pour toute la transaction),
  et il passait donc au vert même sur la migration défaillante. Il **efface
  maintenant le contexte avant de jouer la migration**. Confronté à la version
  sans contexte, il rougit et nomme le bon coupable.

### L'écran, et ce qu'un test ne pouvait pas voir

Le tiret cadratin réunissait deux choses de nature différente — qui, et où — en
une phrase qui n'en est pas une. Sur les 390 px du patron, elle se repliait de
toute façon sur deux lignes, mais **au mauvais endroit** : la coupure tombait au
milieu de l'adresse, jamais entre le nom et elle. Un contrôle qui aurait compté
les lignes serait passé au vert sur ce défaut.

`Row` (`ExportClient.tsx`) rend donc **deux paragraphes** — le nom, puis le
détail — et non un texte à retour à la ligne : la coupure ne doit pas dépendre
de la largeur. `scripts/test-synthese-devis-e2e.ts` **mesure les rectangles**
(le détail sous le nom, même marge à un pixel près), et
`scripts/capture-synthese-devis.mts` rend l'image sur son iPhone.

### Le message qui part chez le client, et l'encart qui n'invitait pas

Le même soir, il a demandé les deux dernières pièces :

- **« Bonjour Mr. Martins », et non « Bonjour Martins ».** Le message tout prêt
  passe donc par `avecCivilite`, devis **et** facture. Deux règles séparées
  feraient douter le client que les deux viennent du même artisan.
- **« vous POUVEZ en proposer une autre »**, et non « vous pourrez ». Le futur
  repoussait le geste à plus tard, comme s'il fallait d'abord faire autre chose ;
  le présent dit que c'est possible sur la page qu'il vient d'ouvrir.
- **Une phrase qui invite à écrire, sur l'encart du client.** L'intitulé posait
  une question — « Une erreur, une question, une précision ? » — sans dire qu'on
  avait le droit d'y répondre. Ce n'est pas de la politesse : un client qui
  repère une faute et n'ose pas l'écrire touche « Je ne donne pas suite », et le
  patron lit un refus là où il n'y avait qu'une coquille. La phrase est
  **au-dessus** du champ (une invitation lue après coup n'invite plus personne),
  et elle ne promet **aucune réponse** — le client n'a aucun moyen d'en recevoir
  une ici. La suite mesure les deux : la position, et l'absence de promesse.

---

## 78. Mesurer un libellé sur l'écran, jamais sur une maquette

**Né de sa demande du 13 août** : *« il faut le notifier sous le nom […] je te
laisse libre de proposer des alternatives »*. Cinq libellés étaient en jeu pour
la troisième ligne de la liste des chantiers.

**La première planche était dessinée à la main, et elle mentait.** Une page HTML
ordinaire rend ces mots plus larges qu'Inter dans l'application : au dessin,
même le libellé ACTUEL passait sur deux lignes, alors qu'il tient sur une chez
lui. La maquette aurait donc découragé les libellés longs pour une raison
fausse.

**Ce qui a tranché, c'est la mesure sur l'écran réel** — et elle a révélé mieux
qu'un oui/non :

| Libellé | 390 px | 430 px (son téléphone) |
|---|---|---|
| « En attente de réponse · sans photo » (actuel) | 2 lignes | 1 ligne |
| « Devis envoyé · en attente de réponse » | 2 | 1 |
| « Devis envoyé · sans réponse » | 1 | 1 |
| « Envoyé il y a 3 jours · sans réponse » | 2 | 1 |
| « Envoyé le 10 août · valable jusqu'au 24 » | 2 | 2 |
| « Devis 1 240 € envoyé · sans réponse depuis 3 jours » | 2 | 2 |

**La largeur de son téléphone fait partie de la décision.** Le libellé actuel est
déjà à la limite : il tient sur un 430 px, pas sur un 390. Toute rallonge
déborde ailleurs que chez lui.

`scripts/engendrer-maquette-ligne-chantier.mts` joue donc chaque libellé DANS
l'application, le photographie aux deux largeurs, et embarque les captures dans
la planche (`docs/maquettes/41-la-ligne-sous-le-nom.html`). Ce ne sont pas des
dessins : c'est l'écran.

**Un défaut vu à l'œil sur la planche assemblée**, et qu'aucun contrôle ne
cherchait : la variante E affichait le libellé de D. Le script désignait la
ligne d'état AVANT de retirer celle injectée par la variante précédente —
`p:last-of-type` tombait alors sur cette ligne-là, qu'on retirait aussitôt, et
le texte partait sur un nœud détaché. **Une capture s'inspecte comme un écran.**

---

## 79. La ligne sous le nom : ce qui est parti, et quand

**Son choix du 13 août 2026**, devant les cinq propositions photographiées
(§78) : *« j'aime bien le D, mais en dessous de "devis envoyé" je veux qu'il y
ait marqué la date à laquelle on l'a envoyé. »*

La liste des chantiers porte donc, pour un devis parti sans réponse :

```
Mr Martins
Adresse non renseignée
DEVIS ENVOYÉ · SANS RÉPONSE          ← en or
Envoyé le jeudi 13 août.
```

### Quatre décisions, et elles vivent dans une fonction pure

`ligneEtatChantier` (`src/lib/chantier-etat.ts`) — l'écran n'a qu'à afficher
(`CLAUDE.md` §3), et la règle s'éprouve sans base ni navigateur
(`test-ligne-etat-chantier.ts`).

1. **« En attente de réponse » devient « Devis envoyé · sans réponse ».**
   L'ancienne phrase était vraie mais ne disait pas **ce qui** attend : un devis
   parti, ou un client qu'on n'a pas rappelé ?
2. **La date d'envoi n'est jamais devinée.** Sans envoi enregistré, la seconde
   ligne n'existe pas. Le repli tentant — la dernière modification du chantier
   (`majAt`, celle qui s'affiche à gauche) — n'est PAS la date d'envoi : une
   photo ajoutée la déplace. Il compte ses jours d'attente dessus.
3. **La mention des photos disparaît une fois le devis parti.** Elle sert à
   savoir s'il reste de quoi chiffrer ; après, elle occupe la place.
4. **L'or, contre la règle d'avant.** Il était réservé à ce qui attend un geste
   DE LUI ; un devis parti sans réponse n'en attend aucun. Il a retenu la
   variante dorée en connaissance de cause — c'était écrit sur la planche. Si la
   liste devient trop dorée à l'usage, `APPELLE_UN_GESTE` se défait sur une
   ligne.

### Le doublon né du retrait de « Chez »

Vu **à l'œil sur une capture**, jamais par un contrôle. Quand « Chez Martins »
est devenu « Monsieur Martins » (§77), un chantier SANS adresse affichait le même mot
deux fois de suite — le titre, puis la ligne du lieu, qui se rabattait sur le
nom du client.

`lieuDuChantier` ne se rabat désormais sur le client **que s'il apprend quelque
chose** ; sinon elle écrit « Adresse non renseignée », qui est une information,
et qui appelle un geste.

**La comparaison est un `includes`, pas une égalité**, et c'est tout le point :
depuis §77 le titre PORTE le nom du client sans lui être identique, puisqu'il
lui ajoute « Monsieur ». Une égalité stricte aurait laissé le doublon passer.
`intituleDuChantier`, dans le même fichier, compare déjà ainsi — la leçon avait
été payée une fois, elle ne l'a pas été deux.

**Ce que ce défaut rappelle :** retirer un mot d'un libellé peut faire entrer
deux autres en collision. Un changement d'affichage se REGARDE, sur l'écran, y
compris là où il n'était pas censé porter.

---

## 80. Une attente qui ne dit rien passe pour une panne

**Le patron, le 13 août 2026**, capture de l'écran « Un chantier » à l'appui :
*« une fois qu'on a appuyé sur le dictaphone, on ne sait pas ce qui se passe.
Les trois petits points sont fixes et on attend […] mais on ne sait pas si ça
bug ou non. Or, si les trois petits points se mettent en mouvement et font des
vagues pour dire que c'est en train de rédiger, là, on sait qu'il se passe
quelque chose. »*

### Ce n'était pas une animation arrêtée

`DicterCoordonnees.tsx` affichait `<span>…</span>` : **le caractère de points de
suspension, un seul glyphe**. Il n'y avait rien à remettre en marche — il
fallait trois points séparés pour qu'un geste puisse exister.

La distinction n'est pas une finesse : elle change le diagnostic. Devant « ça ne
bouge plus », le réflexe est de chercher une animation cassée, une classe
perdue, un `prefers-reduced-motion` mal placé. Ici il n'y en avait jamais eu.

### Le silence comptait davantage que l'immobilité

Trois choses tenaient au même instant, et **le patron n'en avait nommé qu'une** :

| Ce que l'écran faisait | Ce que ça racontait |
|---|---|
| trois points immobiles | rien ne travaille |
| le bouton à `opacity: 0.5` | le bouton est **éteint** |
| **aucune phrase** | — |

La troisième est la plus lourde, et c'est la seule qui ne se voyait pas : l'écran
**parle** quand il écoute (« J'écoute — touchez pour arrêter. ») et **parle**
quand il a fini (« 1 information reprise… »), et il se taisait exactement pendant
le seul moment où l'on se demande s'il est en panne. Aucune animation ne dit ce
que des mots disent — et elle est la seule des trois à parvenir à qui n'a pas les
yeux sur l'écran (`role="status"`).

**La règle qui en sort, et qui vaut d'avance :** un écran qui fait attendre dit
ce qu'il fait, en toutes lettres. Le geste accompagne la phrase ; il ne la
remplace pas.

### Le geste retenu, et pourquoi il vit dans un composant

Cinq attentes lui ont été montrées (`docs/maquettes/40-…` et `41-…`), et il a
répondu **« code la C »** : les points enflent et se rétractent l'un après
l'autre, **sans se déplacer**. Rien ne sort du rond de 44 px, donc rien ne peut
cogner le titre d'à côté.

Les mesures vivent dans `globals.css` (`.atlas-souffle`), le geste dans
`src/components/atlas/PointsQuiSoufflent.tsx` — **pas dans l'écran**. Ce dépôt a
payé deux fois le geste dessiné sur place : la feuille d'envoi du devis (§66) et
le bouton de la facture (§73), tous deux passés à côté d'une décision d'ensemble
parce qu'ils étaient peints chez eux.

**Et le composant a servi le jour même.** Le bouton d'ajout de photo
(`Pellicule.tsx`) portait le même caractère « … » immobile, à la lettre près ; le
patron a tranché en une phrase : *« oui souffle aussi pour la photo »*. Les
points y sont **or** et non vert sans qu'une seule mesure ait été recopiée — ils
héritent de `currentColor`, donc de la couleur du bouton qui les porte. C'est la
raison pour laquelle la couleur n'est pas écrite dans le composant : deux
attentes du même produit doivent se dire de la même façon, sans se peindre
pareil.

### Ce que la vérification a dû apprendre

**Un contrôle qui court plus vite que l'attente ne voit jamais l'attente.**
`test-attente-dictee-e2e.ts` retient donc la réponse du serveur trois secondes :
c'est le seul moyen d'observer l'état qu'il prétend éprouver, et c'est aussi la
situation réelle du patron.

**Et il mesure le geste, jamais la présence d'une classe** — une classe posée sur
un élément dont plus aucune règle ne parle est une mort silencieuse. Le souffle
est relevé image par image sur la taille calculée des points, et le déplacement
est exigé **nul** : c'est ce qui distingue la C de la vague, et sans cette
seconde mesure les cinq propositions seraient interchangeables aux yeux du
contrôle.

**Deux leçons de rédaction, payées au premier jet :**

1. **L'instant du relevé fait partie du contrôle.** L'encre du bouton, mesurée
   après l'échantillonnage, arrivait une fois la réponse revenue : l'échec
   sortait en « Timeout » sur un libellé introuvable — une erreur qui accuse le
   sélecteur là où le fautif est le moment.
2. **Une absence se raconte, elle ne se laisse pas expirer.** L'absence des
   points sortait en trace d'outil et **arrêtait tout** : les deux autres
   moitiés du correctif n'étaient plus mesurées. Elle est désormais un défaut
   nommé, et les quatre points rougissent ensemble.

### Ralentir le serveur a un prix, et il se paie ailleurs

Les deux suites — la dictée et les photos — retiennent la réponse du serveur
pour rendre l'attente observable. **Router une adresse dans Playwright désactive
le cache HTTP de la page entière**, pas seulement des requêtes visées.

Sur les photos, la visionneuse repartait donc du réseau pour une image déjà
affichée : au moment du contrôle, son `<img>` n'avait pas fini de charger, sa
boîte faisait zéro pixel, et Playwright la déclarait invisible. **L'échec
accusait la visionneuse, qui n'y était pour rien** — et il n'a été compris qu'en
AFFICHANT les images réellement présentes : elles étaient là, toutes les deux, au
bon endroit. Le supposer aurait coûté la demi-journée que `AGENTS.md` décrit.

Deux règles, pour toute suite qui ralentit volontairement un serveur :

1. **relâcher la route dès la mesure faite** (`page.unroute`), sans quoi son
   effet de bord traverse tout le reste du parcours ;
2. **la relâcher APRÈS la fin de l'échange retenu** — la couper en vol laisse un
   appel à moitié traité, et l'outil répond « Route is already handled! », une
   erreur qui n'apprend rien sur ce qu'on éprouve.

---

<<<<<<< HEAD
## 81. La civilité devient une donnée : « Mr » / « Mme », au-dessus du nom

**Le patron, le 13 août 2026, le soir même où il avait fait poser « Mr. »
partout :** *« Tu as raison, il faut intégrer une case monsieur-madame. Mais je
veux que ça soit sous la forme Mr Mme, en cliquable, on choisit au-dessus du
nom. »*

C'est la réserve du §77 qu'il tranche : jusque-là, « Mr. » était un **défaut**
posé sur tout patronyme nu — y compris dans le SMS qui part chez le client. Une
cliente lisait « Bonjour Mr. Roux ».

### Trois états, et NULL est le plus courant

`clients.civilite` vaut `'mr'`, `'mme'`, ou **NULL** (migration 0038). NULL
n'est pas « inconnu par erreur » : une société n'est ni l'un ni l'autre, et un
client saisi à la volée n'a pas toujours eu droit à un appui de plus. Forcer un
défaut en base rendrait son silence indiscernable d'un choix — la leçon de
`equipes.nom` (§51).

**Ce que NULL vaut à l'affichage est décidé dans `avecCivilite`, jamais en
base** : la règle du matin s'y applique encore (civilité par défaut sur un
patronyme nu, rien sur une société). C'est ce qui fait que **ses clients
existants n'ont pas changé d'apparence du jour au lendemain** — le jour où la
case est apparue, aucune fiche ne la portait.

### L'ordre des questions, et le piège qu'il évite

`avecCivilite(nom, civilite)` tranche dans cet ordre, et il n'est pas
indifférent :

1. **Le nom porte-t-il DÉJÀ une civilité écrite ?** Alors on n'en pose pas une
   seconde, choix ou non. Sans cette priorité, toucher « Mme » sur « Mme Roux »
   écrivait « Mme Mme Roux ».
2. **A-t-il choisi ?** Alors c'est lui qui a raison — y compris contre la
   détection de société. « Mme Boulangerie du Bourg » est une cliente, pas une
   raison sociale, et la détection n'existe que pour combler son silence.
3. **Sinon**, la règle d'avant : défaut sur un patronyme nu, rien sur une
   société.

Les deux questions — « a-t-il sa civilité ? » et « est-ce une société ? » —
étaient mêlées dans une seule fonction ; c'est en donnant la priorité au choix
que le doublon est apparu. D'où `aDejaUneCivilite`, séparée.

### Deux portes, et pourquoi la seconde n'est pas un luxe

- **À la création** (`FormulaireNouveauChantier`), au-dessus du nom, comme il l'a
  demandé.
- **Sur l'écran du devis** (`DevisCompletClient`). Sans elle, une cliente saisie
  « Roux » avant la case — ou avec une pastille oubliée — resterait « Mr. Roux »
  **pour toujours**, y compris dans le message qui part chez elle. Il n'existe
  aucun autre écran de fiche client.

**Le composant est le même** (`src/components/atlas/ChoixCivilite.tsx`), avec
`sansLegende` sur le devis : cet écran est « à l'image du papier », tous ses
champs y sont nus, et une étiquette en petites capitales au milieu du bloc
« Client » y ressemblait à un formulaire collé sur une lettre. **Vu en capture,
jamais par un contrôle** — d'où `scripts/capture-choix-civilite.mts`.

Deux décisions de dessin qui se paieraient si on les défaisait :

- **Rien n'est présélectionné.** Cocher « Mr » d'avance remettrait en base la
  supposition qu'on vient de retirer.
- **Un second appui DÉSÉLECTIONNE.** Il n'y a que deux pastilles — il en a
  demandé deux — donc pas de troisième bouton « ni l'un ni l'autre » ; sans le
  second appui, une pastille touchée par erreur ne se reprendrait plus, et la
  société est très exactement ce cas-là.

### Le document en garde une COPIE

`devis.client_civilite` et `factures.client_civilite` sont recopiées à
l'établissement, comme `client_nom` l'était déjà. Sans cela, corriger une fiche
client réécrirait la façon dont un devis **déjà parti** s'adresse à son
destinataire — ce que le déclencheur `empecher_modification_devis_envoye`
interdit par ailleurs.

Le PDF passe par la même règle (`document-commun.ts`) : recopiée là, elle aurait
fini par dire « Mme Roux » à l'écran et « Mr. Roux » sur le papier qu'elle garde.

### Un effet de bord assumé : le champ d'exemple change

Le nom du client proposait « M. Bernard » en exemple. Sous une pastille
« Mr / Mme », cet exemple invitait à retaper la civilité dans le nom — auquel
cas la pastille ne servait plus à rien (§1 de l'ordre ci-dessus). Il vaut donc
« Bernard », et **54 fichiers de contrôle** visaient ce texte. Ils ont suivi.

**Attention au sélecteur** : `getByPlaceholder("Bernard")` cherche une
sous-chaîne et attrape aussi « bernard@exemple.fr ». Les suites emploient
`input[placeholder="Bernard"]`, qui est exact.
=======
## 81. Une en-tête n'est qu'une demande — le SMS ne la lit pas

**Le même défaut, deux jours de suite, et le second était une leçon.** Le
12 août 2026, iOS transformait le numéro de facture en lien d'appel et React
répondait « Hydration failed » (§68). Le remède posé ce jour-là —
`formatDetection` dans les métadonnées du gabarit racine — était juste, et il a
été annoncé comme réglé.

**Le 13 août, le patron ouvre le lien de son devis reçu par SMS. Même erreur,
même signature :**

```
+ 2026-0007
- <a href="tel:2026-0007" x-apple-data-detectors="true"
     x-apple-data-detectors-type="telephone">
```

Ce n'était pas un banc en retard : sa fiche d'état, réécrite à 14 h 55, donnait
`main` à `5a6e999` — le commit portant l'en-tête, servi pour de bon.

### Ce que le 12 août avait manqué

**Un lien touché depuis Messages ne s'ouvre pas dans Safari.** Il s'ouvre dans
une vue intégrée, dont la détection de données est réglée par l'application
hôte : `format-detection` y est sans effet. Or c'est **le seul chemin par lequel
le client de l'artisan arrive sur ces pages** — le devis et la facture partent
par SMS, et §68 protégeait précisément le chemin que personne n'emprunte.

La leçon dépasse ce défaut : une en-tête HTML est une **demande** au navigateur.
Elle vaut ce que vaut la bonne volonté d'en face. Un correctif qui repose
dessus, et qui ne peut être éprouvé nulle part, ne devrait jamais être écrit
comme acquis — §68 l'avait pourtant été.

### Le remède : ne plus rien avoir à détecter

`src/lib/numero-document.ts` découpe « 2026-0007 » en morceaux dont aucun ne
porte assez de chiffres pour être un téléphone (quatre au plus, contre sept au
minimum pour le plus court des numéros). `NumeroDeDocument` les rend.

**Et c'est `inline-flex` qui répare, pas le découpage.** Un détecteur ne lit pas
le DOM : il lit le TEXTE APLATI de la page. Mesuré dans un navigateur avant
d'écrire le composant, sur « Devis n° 2026-0007 » :

| Écriture | Texte aplati |
|---|---|
| nu | `Devis n° 2026-0007` |
| deux `<span>` en ligne | `Devis n° 2026-0007` |
| deux `<span>` en `inline-block` | `Devis n° 2026-0007` |
| parent en `inline-flex` | `Devis n° ⏎2026-⏎0007` |

**La recette qui circule pour ce défaut — « entourez chaque moitié d'un span » —
ne sert donc à rien.** Seuls les blocs coupent le texte aplati, et les enfants
d'une boîte flexible sont blockifiés par CSS quel que soit leur `display`. C'est
tout ce qui sépare un correctif d'un placebo, et cela ne se voit sur aucun écran.

### Ce que ça coûte, écrit plutôt que tu

Un numéro **copié depuis l'écran** emporte les retours à la ligne
(« 2026-⏎0007 »). C'est le prix exact de ce qui protège — la même coupure sert
les deux — payé sur un geste rare, quand le défaut, lui, frappait chaque client.
Le numéro reste intact partout où il compte : dans le PDF, dans le SMS, en base.

Appliqué aux **six** endroits où un numéro s'affiche, pas aux deux signalés : le
patron consulte son atelier depuis le même iPhone, et attendre qu'il découvre
l'écran suivant coûterait un aller-retour de plus.

### Ce qui garde le remède, et ce qu'aucun contrôle ne prouvera

`test-numero-document.ts` éprouve la règle sans navigateur.
`test-detection-automatique-e2e.ts` ouvre un **vrai** devis et lit le texte que
le navigateur aplatit : remplacer `NumeroDeDocument` par un `<span>` ordinaire —
ou son `inline-flex` par un `display` en ligne — ne se verrait sur aucune
capture, et rend cette suite rouge. Les deux ont été vues échouer sur le vrai
défaut, message à l'appui.

**Ce qui reste non prouvé, et doit être dit :** la détection appartient à un
logiciel fermé d'Apple, absent d'ici. Ce dépôt vérifie que le texte offert à ce
logiciel ne contient plus de suite de chiffres appelable ; il ne peut pas
vérifier ce que le logiciel en fera. Seul le téléphone du patron le dira.
>>>>>>> origin/main
