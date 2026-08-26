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

La section « feuille de chantier » de `scripts/test-planning-e2e.ts` vérifie
**le raccord** : que l'adresse arrive vraiment jusqu'au `href`. La règle pure resterait verte même si l'écran oubliait
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

`Row` (`ExportClient.tsx`) rendait donc **deux paragraphes** — le nom, puis le
détail — et non un texte à retour à la ligne : la coupure ne devait pas dépendre
de la largeur. Sa suite mesurait les rectangles, au pixel près.

> **CADUC depuis le 20 août 2026 (§136).** L'écran de synthèse d'avant l'envoi a
> été supprimé, et `Row` avec lui : le patron voit désormais le devis entier, où
> le client est une pile de champs. La suite qui mesurait cette géométrie a été
> supprimée aussi — elle n'avait plus de sujet. Ce qui reste vivant de cette
> décision est éprouvé ailleurs : la règle de nommage sans navigateur
> (`scripts/test-civilite.ts`, `scripts/test-nom-chantier.ts`), le mot devant le
> nom sur le devis (`scripts/test-choix-civilite-e2e.ts`), et le non-débordement
> sur son téléphone (`scripts/test-choisir-la-date-e2e.ts`).

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

### Une attente sans fin ne renseigne pas plus qu'une attente immobile

La question était restée ouverte, et le patron l'a tranchée d'un « oui fait ça » :
*une vague qui souffle depuis trente secondes redevient une vague qui ne dit
rien.* Un geste rassure les dix premières secondes, puis il inquiète — parce
qu'il dit exactement la même chose à la trentième qu'à la première.

L'écran a donc **trois temps** (`src/lib/attente-longue.ts`) : il travaille, puis
il reconnaît que c'est anormalement long, puis il rend la main. Les seuils et les
phrases vivent dans une fonction pure — l'écran affiche, il ne décide pas — et
l'étape se calcule sur le **temps écoulé**, jamais posée en dur : un téléphone
qui s'endort étire ses minuteries, et un réveil de douze secondes qui tombe à la
cinquantième doit rendre la main, pas annoncer « c'est un peu long ».

**Renoncer n'annule rien**, et c'est la décision qui compte ici. L'appel continue ;
s'il finit par répondre, les champs vides se remplissent. Le couper aurait obligé
à tout redicter alors que la réponse était peut-être à une seconde. En revanche,
rendre la main crée un cas qui n'existait pas : le patron peut redicter pendant
que la première réponse court encore, et celle-ci, en revenant, remettrait l'écran
au repos **au milieu du nouvel enregistrement**. D'où un numéro de tour : une
réponse ne touche l'écran que si elle est encore celle qu'on attend.

### La place d'une phrase est une contrainte, au même titre que son sens

**Le défaut, et il ne s'est vu qu'à la capture.** La première phrase des douze
secondes disait aussi « vous pouvez déjà saisir, rien ne sera écrasé » — vrai,
utile, et cent caractères. Dans la colonne de 190 px où vivent ces phrases, elle
prenait toute la largeur et **cassait « Un chantier » en deux lignes**, en plein
milieu de l'attente. Un écran qui se réorganise pendant qu'on patiente inquiète
plus qu'il ne rassure.

Mesuré ensuite dans la vraie page, sur son écran de 390 px : **31 caractères font
163 px et tiennent sur une ligne ; 33 en font 181 et passent à deux.** La règle
n'est donc pas « soyez concis » : c'est *une ligne*, et elle se mesure.

Deux contrôles gardent la règle, et **le second existe parce que le premier a
dormi** :

| Contrôle | Où | Ce qu'il a appris |
|---|---|---|
| plafond de 31 caractères | `test-attente-longue.ts`, sans navigateur | posé d'abord à 60, il laissait passer la phrase de l'abandon — **un plafond trop généreux est un contrôle qui dort** |
| nombre de lignes du titre | `test-attente-dictee-e2e.ts`, sur son écran | posé au seul état des douze secondes, il n'a rien vu de l'abandon — **un contrôle posé à un seul endroit d'un parcours n'éprouve que cet endroit-là** |

**Et la mesure a dénoncé un défaut plus ancien que ce travail :** le message de
fin, « 1 information reprise — relisez avant de créer. », fait 47 caractères et
casse le titre à **chaque dictée réussie**. Il n'a pas été touché — c'est une
phrase que le patron voit depuis des jours sans s'en plaindre, et la raccourcir
change ce qu'elle lui dit (`TODO.md`).

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

### UNE seule porte, et c'est lui qui l'a tranché

Les pastilles avaient d'abord été posées à **deux** endroits : à la création, et
sur l'écran du devis — pour offrir une seconde porte, celle qui corrige un
client déjà créé. Il les a fait retirer du devis le jour même :

> *« Il ne faut pas qu'il y ait les pastilles cliquables sur le devis. En gros
> quand on rentre les informations dans la fiche client, si on clique sur
> monsieur, sur le devis ça sera marqué monsieur. »*

**Son raisonnement se tient, et il vaut au-delà de ce champ :** le devis est le
DOCUMENT, pas la fiche. Il montre ce qui partira ; il ne se remplit pas comme un
formulaire. Un réglage posé là fait douter de la nature de l'écran.

- **À la création** (`FormulaireNouveauChantier`), au-dessus du nom : les
  pastilles, et rien qu'ici (`src/components/atlas/ChoixCivilite.tsx`).
- **Sur le devis** (`DevisCompletClient`), le mot est **du texte**, écrit devant
  le nom sur la même ligne — `ChampNu`, propriété `prefixe`.

**Le mot est À CÔTÉ du champ, jamais dedans.** Dans le champ, il deviendrait
modifiable et s'enregistrerait comme nom du client : le document suivant
porterait « Mme Mme Roux ». `items-baseline`, pour que les deux reposent sur la
même ligne d'écriture comme sur le papier.

**Ce que ce retrait coûte, et qui est assumé :** faute d'écran de fiche client,
une civilité choisie de travers **ne se corrige plus** après la création. Il en
a été informé ; c'est dans `TODO.md`.

Une trace de l'aller-retour, gardée parce qu'elle resservira : tant que les
pastilles étaient sur le devis, il a fallu leur retirer leur étiquette
(« CIVILITÉ (FACULTATIF) » en petites capitales au milieu du bloc « Client »)
parce que cet écran est « à l'image du papier » et que tous ses champs y sont
nus. **Vu en capture, jamais par un contrôle** — d'où
`scripts/capture-choix-civilite.mts`. Le retrait complet a rendu la question
sans objet, mais la règle demeure : **rien de ce qui ressemble à un formulaire
n'a sa place sur cet écran.**

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

---

## 82. Une en-tête n'est qu'une demande — le SMS ne la lit pas

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

---

## 83. La TVA se découpe au mois — et le trimestre devient une option

**Sa remarque du 12 août 2026 :** *« la TVA collectée, ça doit être mois par
mois et pas trimestre par trimestre. Après tu peux essayer de te renseigner,
mais pour moi la TVA on doit la donner tous les mois. […] Et si jamais c'est à
nous de choisir, dans ce cas-là il faut que l'utilisateur ait le choix.
Renseigne-toi d'abord et ensuite reviens me voir. »*

Il avait raison, et le dépôt n'avait rien à opposer : **l'écran ne connaissait
que le trimestre, et aucune ligne n'expliquait pourquoi.** C'était un défaut par
défaut — le genre qui survit parce que personne ne l'a jamais écrit noir sur
blanc.

### La règle, vérifiée avant d'être codée

La déclaration au régime réel normal (formulaire CA3) est **mensuelle par
défaut**. Le trimestre est une **option**, ouverte seulement quand la TVA due de
l'année précédente est inférieure à 4 000 € ; au-delà, la périodicité redevient
mensuelle.

Le régime réel simplifié — déclaration annuelle et deux acomptes — **disparaît
au 1er janvier 2027** (article 38 de la loi de finances pour 2025, loi
n° 2025-127 du 14 février 2025 ; modalités ajustées par la loi de finances pour
2026). À partir de là, « mensuel ou trimestriel » est la seule question qui se
pose : l'axe retenu ici couvre donc l'après-2027 sans rien à reprendre.

### Ce que l'application refuse de calculer, et pourquoi c'est structurant

**Le droit au trimestre.** Le seuil porte sur la TVA *due* — collectée moins
déductible — et **Atlas ne connaît que la collectée**. Il ne voit ni le gazole,
ni la tronçonneuse, ni l'assurance : aucune facture d'achat n'entre dans ce
produit.

Il serait tentant de « rendre service » en signalant un franchissement de seuil
à partir de la seule TVA collectée. Ce serait faux la moitié du temps, et faux
d'une façon coûteuse : le patron déclarerait au mauvais rythme sur la foi d'un
écran. La colonne `entreprises.periodicite_tva` enregistre donc une
**déclaration du patron**, faite sur la foi de son comptable, jamais une
déduction (`CLAUDE.md` §4). L'écran de Réglages le dit en toutes lettres, et une
suite vérifie qu'il ne se met pas à conseiller.

### Ce qui a été généralisé, et ce qui reste

`src/server/periode-tva.ts` remplace `trimestre.ts` : mêmes bornes en UTC, mais
paramétrées par la périodicité. Deux détails qui ne se devinent pas :

- **`lirePeriode` dépend de la périodicité.** « 12 » est un mois valide et un
  trimestre absurde. Lire l'adresse sans connaître le réglage laisserait passer
  un douzième trimestre le jour où le patron change de rythme.
- **L'invariant qui compte n'est pas la borne, c'est la couverture.** Une
  facture émise n'importe quel jour doit tomber dans exactement une période.
  `test-periode-tva.ts` parcourt l'année entière et vérifie que chaque période
  commence où la précédente s'arrête, et que décembre se referme au 31 — un trou
  d'un jour ne se verrait sur aucune capture.

### Le calendrier, et ce qu'il remplace

Retenu sur maquette (`docs/maquettes/35`). Remonter au 1er trimestre 2025
depuis le 3e trimestre 2026 demandait **sept appuis** sur « ← » — et sept
chargements d'écran, chaque flèche étant un lien. Deux appuis suffisent.

**Sa forme suit la périodicité et ne se règle pas** : douze pavés en mensuel,
quatre en trimestriel. Un réglage de plus n'apporterait rien — personne ne
cherche un mois dans une grille de trimestres. Le pavé plein dit ce qu'on
REGARDE, le point doré ce qui est aujourd'hui : deux repères qui ne se
confondent pas.

### Trouvé en chemin, et corrigé

**« Facturé ce trimestre », au pied de « Terminés », mentait.**
`totalFacture(mois)` additionne TOUS les mois du fil, depuis toujours — jamais
un trimestre. Le chiffre était juste, sa légende ne l'était pas, et rien ne
pouvait le révéler sans aller lire la fonction. Il dit désormais ce qu'il
compte.

---

## 84. La TVA due : les achats du patron, et le ticket qu'on photographie

**Sa demande du 12 août 2026 :** *« je veux également qu'on puisse intégrer la
TVA due, donc les essences, les tronçonneuses. Et pour ça j'avais pensé à un
petit scanner en ouvrant l'appareil photo : on passe les tickets gazoil devant,
il les scanne et les intègre automatiquement. »*

Retenu sur maquette (`docs/maquettes/36` puis `37`), après quatre corrections de
sa main : les deux colonnes, tous les chiffres en gras, la pastille au lieu du
rectangle, et le petit carré qui copie.

### Le piège qui coûte un cinquième

La TVA d'un ticket de 120 € à 20 % **n'est pas 24 € mais 20 €**. Le total est
TTC : la taxe est dedans, pas dessus. C'est le calcul qu'on fait de tête, et il
est faux.

Un relevé faux de ce facteur affiche un total parfaitement plausible — rien, à
l'écran, ne distingue 20,00 € de 24,00 €. On s'en aperçoit devant le comptable,
un an plus tard. D'où `tvaDepuisTtc` en fonction pure, et un contrôle qui
affirme explicitement l'inégalité (`scripts/test-achat-tva.ts`).

### Ce que cette table n'est pas, et ne deviendra pas

Elle ne porte pas les achats du patron : elle porte **la TVA de ses achats,
telle qu'il l'a confirmée**. Pas de catégorie de dépense, pas de rapprochement
bancaire, pas de plan comptable — Atlas prépare un relevé, il ne tient pas les
comptes (`docs/AGENT.md` §6).

Et **aucune règle de déductibilité n'y est encodée.** Ce qui est déductible
dépend de la dépense et du véhicule ; Atlas n'a pas de source pour en juger. Il
additionne ce que le patron confirme, son comptable fait le tri (`CLAUDE.md`
§4).

`tva_deductible` est le seul montant obligatoire. Un ticket de station n'affiche
pas toujours son total ni son taux, et certains n'ont qu'une ligne « TVA
3,20 € » : exiger davantage reviendrait à **refuser l'achat plutôt qu'à
l'enregistrer incomplet**, et un achat refusé est une TVA qu'il ne récupérera
pas.

### Le crédit de TVA, et pourquoi il s'affiche

`tvaDue` peut rendre un montant négatif, et l'écran l'écrit — *« si le reste à
payer est négatif, il faut qu'il le marque négativement »*, le 13 août. Le mois
où l'on achète une machine sans facturer donne un crédit. Le borner à zéro
cacherait précisément le mois où le patron a le plus besoin de savoir.

Deux détails, tous deux nés d'une capture : un **vrai signe moins** (U+2212) et
non le trait d'union du formatage, deux fois plus court et posé plus bas — à
26 px, au soleil, il se lit comme une poussière ; et une phrase qui dit ce que
ça veut dire, « Reste à payer − 90 € » se lisant mal puisqu'on ne paie rien.
Calée à GAUCHE : à droite, sa fin passait sous la bulle de l'assistant.

### La lecture d'un ticket : ce que l'IA du dépôt ne savait pas faire

Le patron a posé ses clés Anthropic et OpenAI. Restait que **la couche IA ne
manipulait que du texte** — `genererTexte(systeme, message)`, aucun passage
d'image. La vision existe chez les deux fournisseurs ; notre code ne la leur
demandait pas.

`lireImage` est **optionnelle**, comme `genererAvecOutils` avant elle : un
fournisseur qui ne la porte pas reste valide, et l'écran retombe sur la saisie à
la main — un parcours entier, pas une panne. Les deux implémentations diffèrent
sur un détail que l'interface commune existe pour cacher : Anthropic veut les
octets nus, OpenAI une URL `data:`.

`temperature: 0` dans les deux. Lire un chiffre n'est pas une tâche créative, et
deux lectures du même ticket doivent donner le même montant — sans quoi le
patron verrait son total changer en rescannant.

### Trois travers de modèles, trois défenses

Éprouvés sans clé ni réseau (`scripts/test-lecture-ticket.ts`), parce que c'est
là que vivent les vrais pièges — pas dans l'appel HTTP :

1. **Il entoure son objet** de balises ou d'une phrase de politesse. On extrait
   le premier objet accoladé plutôt que d'exiger un JSON nu.
2. **Il rend des chaînes** là où on attend des nombres — « 96,00 € ». On les
   convertit plutôt que de jeter une lecture juste.
3. **Il invente pour ne pas laisser un champ vide.** Montant négatif, taux à
   250 %, date de l'an 3000 : chacun retombe à `null`. Et **une TVA supérieure
   au total est écartée** — la laisser passer ferait grossir le relevé d'un
   montant imaginaire.

Une TVA absente du ticket est recalculée depuis le taux, **et l'écran le dit** :
le patron doit savoir que ce chiffre-là vient d'un calcul et non de son papier.

### Ce qui n'a pas pu être éprouvé ici

**La lecture d'un vrai ticket.** Cet environnement n'a aucune clé ; celles du
patron sont sur son espace. La transformation de la réponse en champs l'est
entièrement, le repli sans clé aussi. Le reste attend son banc, et s'écrit
« non vérifié » jusque-là (`AGENTS.md`).

### Ce que le contrôle d'exhaustivité a rattrapé

`achats_tva` manquait à l'export RGPD. Le patron a le droit d'emporter TOUTES
ses données, et ses tickets sont parmi les plus personnelles — ils disent où il
fait le plein et quand il travaille. `test-export-entreprise.ts` a réclamé la
table avant que quiconque y pense : l'omission serait partie en silence.

---

## 85. Le ticket de juillet ajouté depuis août : rangé juste, et invisible

**Son signalement du 13 août 2026, avec la photo du ticket :** *« J'ai ajouté ce
ticket via phototech dans l'application TVA, mais il n'est jamais apparu dans la
TVA déductible. Corrige ce problème. »*

Le ticket : une station LAFON, **le 24 juillet**, 97,39 € de gazole, 16,23 € de
TVA. Il l'a photographié le 13 août, depuis l'écran d'**août**.

**Rien n'était perdu.** L'achat était en base, avec sa date, dans la bonne
période — juillet — exactement là où il devait aller (§84 : *la date de l'ACHAT,
jamais celle de la saisie*). Le défaut n'était pas dans l'enregistrement, il
était dans ce que l'écran laissait croire.

### Un écran qui ne montre qu'une période, et ne le dit pas

L'écran de TVA affiche **une** période à la fois : le total collecté, le total
déductible, la liste des achats — les trois tirés des mêmes bornes. Un achat
daté hors de ces bornes ne peut donc apparaître nulle part, et **aucun des trois
chiffres ne bouge**. Du point de vue du patron, le geste n'a rien produit.

Il avait raison de conclure ça. C'est le seul retour que l'application lui
donnait.

**Pourquoi aucun contrôle ne l'a vu.** Les suites étaient vertes, et justes :
`test-achats-tva-repo.ts` éprouvait que le dépôt rend un achat entre deux bornes
et jamais au-delà, `test-periode-tva.ts` que les bornes sont bonnes. Chacune
regardait sa moitié. Le défaut vivait dans le raccord — l'écran écrivait dans
une période et en affichait une autre — et un raccord ne se voit qu'en
traversant le parcours entier, du doigt jusqu'au chiffre.

### La réparation : le dire avant, et l'emmener après

Deux gestes, et il faut les deux :

1. **Avant l'appui**, la feuille annonce la destination : « Ce ticket est daté du
   24 juillet : il ira dans **Juillet 2026**, pas dans Août 2026. L'écran vous y
   emmènera. » Un ticket du mois dernier n'est pas une faute — c'est le cas
   normal, on ne saisit pas ses tickets le jour même. Ce qui serait fautif, c'est
   de le laisser partir à l'aveugle.
2. **Après l'ajout**, l'écran navigue vers cette période. Pas un message qu'il
   faudrait lire puis suivre : le chiffre est sous ses yeux. Ce qui a coûté
   l'aller-retour, c'est précisément d'avoir laissé le patron devant l'écran
   qu'il regardait déjà.

Les deux s'appuient sur `periodeContenant` et `dansLaPeriode`
(`src/server/periode-tva.ts`), fonctions pures — la même paire sert à écrire
l'avertissement et à décider la navigation, jamais deux implémentations
(`CLAUDE.md` §3).

### Le piège qui a failli laisser passer un correctif qui ne corrigeait rien

La première version enchaînait :

```ts
router.push(`/termines/tva?annee=${cible.annee}&t=${cible.numero}`);
router.refresh();   // ← annule le push
```

**Les deux se sont annulés.** `router.refresh()` redemande au serveur l'adresse
**courante** ; la navigation en cours retombait dessus. L'écran restait sur
août, le ticket restait invisible — le correctif était écrit, poussé nulle part,
et **il ne corrigeait rien**.

Rien ne le disait : pas d'erreur, pas de trace, la ligne bien en base. Il a
fallu une sonde qui imprime l'adresse et le titre après l'appui pour le voir.
C'est exactement le cas décrit dans `AGENTS.md` — *devant un défaut muet, la
première livraison est de rendre le défaut bavard*. Le commentaire est resté
dans le code : la ligne supprimée est celle qu'on rajoute par réflexe.

### Le contrôle qui manquait, et qu'on a vu rougir

`scripts/test-achat-hors-periode-e2e.ts` traverse le parcours : depuis l'écran
du mois en cours, on écrit un achat daté du 24 du mois précédent, on vérifie que
l'avertissement nomme les deux périodes, que l'écran emmène, que l'achat est
dans la liste, que le total déductible l'a pris — **et qu'il ne compte pas
double** dans le mois d'où il vient.

Deux précautions sans lesquelles il serait vert pour rien :

- **il pose la périodicité au mois** avant de commencer. Au trimestre, le
  24 juillet et le 13 août tombent dans la même période : le défaut ne se
  produirait pas, et la suite passerait sans rien traverser. Une autre suite
  déplace ce réglage — on ne suppose pas son état ;
- **la date est calculée depuis aujourd'hui**, jamais figée au 24 juillet 2026,
  qui cesserait d'être « le mois dernier » dès septembre.

Confronté au défaut — navigation retirée, avertissement éteint — il rougit sur
quatre cas, dont « la colonne Déductible affiche 0.00 € : le ticket n'y est
pas ». C'est le mot exact du patron, rendu par une machine.

---

## 86. Les réglages : deux niveaux, quatre rôles, et ce qui n'a pas d'interrupteur

**Maquette du 13 août 2026, premier lot d'une série** —
`maquettes/atlas-reglages-plan.html`, contrôlée par
`maquettes/verifier-atlas-reglages-plan.mjs`. Aucune ligne de `src/` n'a été
touchée : c'est la règle `CLAUDE.md` §3 bis.

### Pourquoi le plan d'abord, et pas la première rubrique

Le patron a listé dix rubriques d'un coup, puis : *« à toi de décider si on
fait tout d'un coup ou rubrique par rubrique pour qu'il n'y ait pas de
problème »*. Les dix héritent des trois mêmes choix — les deux niveaux, le rôle
qui voit, la forme de l'interrupteur. Dessiner une rubrique d'abord aurait figé
ces trois choix sans qu'ils soient regardés, et les neuf suivantes auraient été
à refaire le jour où l'un d'eux bougeait.

### Les deux niveaux

Sa phrase : *« un salarié peut changer ses notifications ou son mot de passe,
mais il ne doit évidemment pas pouvoir modifier les tarifs de l'entreprise ou
les coordonnées bancaires. »* D'où **« Moi »** et **« Mon entreprise »**, dans
cet ordre : ce qui appartient à la personne vient avant ce qui appartient à
l'entreprise, parce que c'est le seul ensemble que tout le monde possède.

### Une rubrique absente n'est pas une rubrique masquée

`docs/QUESTIONS.md` §10 a tranché le 7 août que « sans les prix » ne peut pas
être un masquage à l'écran : ce qu'un rôle n'a pas le droit de voir **ne doit
pas sortir du serveur**. La même règle vaut ici, et le contrôle la tient : il
cherche les mots interdits dans **tout le texte** de l'écran, pas dans ses
lignes visibles. Une rubrique rendue puis grisée le ferait rougir.

C'est aussi pourquoi la liste du salarié est **courte, et dit pourquoi**. Une
rubrique d'entreprise grisée serait pire que son absence : elle annoncerait
qu'il existe quelque chose à obtenir.

### Le quatrième rôle n'est acquis nulle part

`membres_entreprise.role` ne connaît que `proprietaire` et `membre` ;
`QUESTIONS.md` §10 décrit trois niveaux (l'éditeur, le patron, le salarié). Le
**commercial** demandé le 13 août n'existe ni en base, ni dans les décisions
écrites. Il est **dessiné pour être tranché**, et la maquette le dit en toutes
lettres sous son écran. Le voir sur une planche ne vaut pas décision.

### Ce qui porte un interrupteur, et ce qui n'en portera jamais

Sa règle : *« seulement à celles où la désactivation n'entraîne pas de problème
juridique ou moral ou de dysfonctionnement à l'appli »*.

| Porte un interrupteur | N'en portera jamais |
|---|---|
| Ce qui s'imprime **en plus** : acompte, durée de validité, conditions particulières, texte de bas de page, logo | Les mentions légales de la **facture** — pénalités au taux de trois fois le taux légal, indemnité forfaitaire de 40 €, franchise de l'art. 293 B quand le taux est nul (`src/server/pdf/facture-pdf.ts`) |
| Une notification, canal par canal | Le nom, l'adresse et le SIRET de l'émetteur |
| Une intégration extérieure | La numérotation continue des factures (`entreprise_compteurs`) |
| Une suggestion de l'agent | La conservation légale et les traces du RGPD |

**La ligne scellée est posée DANS la liste, à sa place**, avec le mot
« Obligatoire » et sa raison en une phrase. La reléguer en pied d'écran l'aurait
rendue invisible là où il ira chercher le bouton — et un réglage introuvable se
lit comme un réglage oublié.

### Deux leçons payées sur cette maquette

**Un exemple chiffré à côté d'un champ est un mensonge en attente.** Le champ de
l'acompte affichait « soit 1 044 € sur 3 480 € ». Une maquette sans script ne
recalcule pas : taper 15 laissait le montant de 30 % à côté. **Vu en regardant
la capture, jamais par un contrôle vert** (`CLAUDE.md` §5) — les cinquante
contrôles étaient au vert pendant que l'écran se contredisait. Un contrôle
existe maintenant pour que ça ne revienne pas : rien, à côté d'un champ, ne doit
contenir un montant, un chiffre ou un mois.

**Une capture peut être écrite par une casse volontaire.** Éprouver qu'un
contrôle sait échouer écrit ses captures dans `maquettes/vues/` comme une
exécution normale. La planche a été relue sur une image produite par la version
cassée, où la ligne scellée portait un interrupteur — exactement ce qu'elle
interdit. **Regarder l'écran suppose de savoir quelle exécution l'a écrit :**
relancer le contrôle sur le fichier sain avant de conclure.


### Les planches portent désormais la charte de l'application, valeur pour valeur

**Sa consigne, le 13 août 2026 :** *« toujours en respectant le style de l'appli
ultra luxe et très moderne ».*

Les maquettes du dépôt portaient jusque-là **un nuancier à elles** — crème
`#edece6`, bronze `#8f7130` — proche des jetons sans leur être égal. Deux crèmes
côte à côte, ça se voit ; et surtout, une planche qui n'est pas dans la couleur
de l'écran fait **valider une allure qui ne sera pas la sienne**.

`atlas-reglages-plan.html` recopie donc les jetons de `src/lib/design-tokens.ts`
— crème `#f5f3ee`, plage `#faf9f5`, encre `#1c1c1a`, gris `#8a8578`, or
`#b98b47`, vert pin `#2f3b2f`, filet `rgba(28,28,26,.12)` — et **le contrôle lit
le fichier de jetons pour les comparer**. Changer une couleur ici sans la
changer là-bas rougit, en nommant le jeton et la valeur attendue.

**Ce que « ultra luxe » veut dire dans CETTE charte, et c'est contre-intuitif :**
ce qu'elle refuse. `cardShadow` vaut « none » depuis le 10 août — l'écran qu'il a
retenu n'a pas une seule ombre ; `radius.card` vaut 4 px ; `champPlage` n'a
aucune bordure ; il y a deux accents, et le partage de leurs rôles n'est pas
décoratif (le vert pin pour ce qu'on FAIT, l'or pour ce qu'on LIT). Un dégradé
ou une ombre portée ajoutés « pour faire haut de gamme » iraient donc **contre**
son choix. Un second contrôle interdit toute ombre dans l'écran — celle du
cadre du téléphone, qui n'est pas l'écran, est nommée comme exception.

**Trois retouches qui en découlent, et qui valent pour les planches suivantes :**
les plages de saisie perdent leur liseré (la charte tient par des filets, jamais
par des cadres) ; la ligne grise sous un intitulé passe de 12,5 à 11,5 px
(`texteSituation`), sans quoi elle dispute la place au serif ; les marges de
page passent de 26 à 24 px (`spacing.pageX`).

**Dette laissée en l'état, et assumée :** les neuf planches antérieures gardent
l'ancien nuancier. Les reprendre d'un coup mêlerait un changement d'identité à
un changement mécanique sur des écrans déjà validés — c'est exactement ce que
`design-tokens.ts` a refusé de faire pour le nom `rust`. Elles passeront à la
charte quand leur sujet sera rouvert. `TODO.md` §0 quatervicies le porte.

**Corrigé au passage, parce qu'on ne respecte pas une charte dont la
documentation ment :** `docs/DESIGN_SYSTEM.md` annonçait encore Playfair Display
et Inter rapatriées par `next/font` (faux depuis le 10 août : polices du
système), et la terre cuite `#B25A2E` sur les documents (faux depuis le 10 août :
l'or). Le code fait foi, `CLAUDE.md` §1.


### Le gros plan : une loupe, jamais un téléphone élargi

**Sa demande, le 13 août 2026 :** *« fais-moi les planches en gros plan que je
les voie mieux, mais tout dans un .html comme d'habitude ».*

**La solution évidente était la mauvaise.** Élargir le téléphone à 560 px aurait
donné exactement la même impression de confort — et un mensonge : les libellés
auraient tenu sur une ligne, les cibles auraient paru généreuses, et rien de
cela n'aurait été vrai sur son iPhone. C'est le piège de §78, sous un autre
visage : mesurer sur une planche au lieu de mesurer sur l'écran.

`zoom` agrandit l'écran **entier, dans ses proportions**. L'écran continue de
mesurer 390 px pour lui-même : une cible de 44 px reste une cible de 44 px, un
libellé qui passe à la ligne y passe encore.

**La loupe ne s'applique qu'au-dessus de 1000 px, et c'est ce qui protège les
soixante contrôles.** Ils tournent en iPhone 13, où elle est éteinte, et
mesurent donc les vraies dimensions. Un contrôle le vérifie explicitement —
c'est le plus important des deux : une loupe étendue par mégarde ferait passer
une cible de 30 px pour 44 sans que rien ne rougisse. Un second contexte, en
1600 px, vérifie qu'elle agit bel et bien et écrit la capture en gros plan.

**Une planche par rangée, son texte à côté.** Quatre téléphones de front
restent quatre miniatures, loupe ou pas. La colonne de droite reprend la hauteur
que la loupe a gagnée, au lieu de laisser un vide.

**Le défaut vu à l'œil, encore une fois :** sans une troisième rangée souple
sous le texte, la grille répartissait la hauteur du téléphone entre ses deux
rangées et le libellé flottait à mi-écran, seul au milieu du vide. Le `1fr` le
plaque en haut ; le décalage qui l'aligne sur le **surtitre** de l'écran — et
non sur le bord du cadre — se calcule à 37 px multipliés par la loupe, puisque
celle-ci agrandit le téléphone et pas la colonne de texte. Deux contrôles neufs
tiennent l'un et l'autre.


### « Le style de toutes les pages, pas du devis et facture »

**Sa consigne du 13 août 2026.** Elle a valu quatre corrections, toutes vraies,
et **aucune n'avait été vue par un contrôle** — la planche était verte sur
soixante-deux points pendant qu'elle parlait une autre grammaire que les écrans.

**Ce qui a été relevé dans le code, et non approché à l'œil**
(`src/components/atlas/EnTeteEcran.tsx`, `AtlasBottomNav.tsx`,
`src/app/planning/PlanningClient.tsx`, `src/app/termines/ListeTermines.tsx`) :

| | La planche disait | Les écrans disent |
|---|---|---|
| Retrait de page | 24 px | **26 px** |
| Titre | 34 px / 1,0 / −0,02 em | **36 px / 1,02 / −0,018 em** |
| Fin de l'en-tête | rien | **un cheveu**, en retrait de 26 px des deux bords |
| Titre de section | or, suivi d'un filet qui s'étire à droite | **gris**, précédé d'un trait sur toute la largeur |
| Barre basse | 9 px / 0,15 em | **9,5 px / 0,28 em**, l'onglet actif monté de 2 px |

**Le retrait de 26 px contredit `spacing.pageX`, qui vaut `px-6` — 24 px.** Ce
n'est pas une erreur des écrans : `spacing` est l'ANCIENNE échelle, et les
écrans refondus le 10 août emploient tous `px-[26px]`. Seuls les écrans jamais
repris (`error.tsx`, `loading.tsx`, `Notifications.tsx`) sont restés à 24. Une
prochaine session qui lirait `spacing.pageX` de bonne foi se tromperait — d'où
cette ligne.

**La cause commune des libellés rétrécis : l'écran de la planche était trop
étroit.** Le cadre du téléphone lui prenait 54 px — 32 de marge de page, 22 de
coque — et il ne mesurait plus que 336 px au lieu de 390. La barre basse de
l'application n'y tenait pas, alors les planches successives ont rapetissé sa
chasse jusqu'à 9 px / 0,15 em, en le justifiant par un commentaire recopié de
planche en planche. **On validait une barre plus petite que la vraie.** Sous
520 px, la coque s'efface donc et l'écran occupe toute la largeur du téléphone
qui le regarde ; la chasse de l'application y tient sans rien rétrécir.

**Deux filets qui se suivent dessinent une bande vide.** Le cheveu de l'en-tête
tombait 30 px au-dessus du trait du premier bloc, et le filet de la dernière
ligne d'une liste 30 px au-dessus du trait de la section suivante. Le premier
bloc ne porte donc plus de trait, et la dernière ligne plus de filet — un filet
qui ne sépare plus rien n'est pas un filet. **Vu sur la capture, jamais par un
contrôle** ; il en existe un désormais, qui mesure l'écart entre filets
successifs.

**Une règle juste, placée trop tôt, ne s'applique pas.** La règle qui efface la
coque avait été posée avant `.tel{padding:11px}` : à spécificité égale, la
dernière déclaration l'emporte, et l'écran restait à 368 px. Le contrôle a
désigné le bon coupable en une ligne — « 368 px » — parce qu'il mesurait la
largeur au lieu de vérifier la présence de la règle.


---

## 87. L'identité de l'entreprise : trois manques que la maquette a révélés

**Deuxième lot des réglages, dessiné le 13 août 2026** —
`maquettes/atlas-reglages-identite.html`, cinq écrans, contrôlée par
`maquettes/verifier-atlas-reglages-identite.mjs`. Rien dans `src/`.

Dessiner cette rubrique a obligé à relire ce que la base porte et ce que le PDF
imprime. **Trois écarts en sont sortis, et aucun n'est cosmétique.**

### 1. Le régime de TVA est DEVINÉ, et une pièce comptable en dépend

`facture-pdf.ts` imprime « TVA non applicable, art. 293 B du CGI » quand le taux
appliqué vaut zéro. Le régime fiscal de l'entreprise est donc **déduit d'un
chiffre saisi chantier par chantier**.

Les deux sens sont faux : un artisan en franchise qui laisse 20 % par mégarde
perd une mention obligatoire ; un assujetti qui pose 0 % voit s'imprimer sur sa
facture une phrase qui ne le concerne pas. Le régime doit être **déclaré une
fois** et commander le reste — c'est ce que dessine le troisième écran.

### 2. Le numéro de TVA intracommunautaire n'existe pas

Ni en base, ni sur le document. Pour une entreprise assujettie, c'est une
mention attendue sur la facture.

**Réserve, et elle est de la même nature que celle de `docs/A-FAIRE.md` §6 :**
le détail des mentions obligatoires n'a pas pu être vérifié à sa source depuis
cet environnement — le mandataire réseau refuse les sites publics. La maquette le
dit à l'écran, et renvoie à son comptable. Ne pas coder sur la foi de cette
planche.

### 3. Le téléphone et l'e-mail sont saisis, et ne s'impriment nulle part

Le bloc ÉMETTEUR de `document-commun.ts` porte trois lignes : le nom, l'adresse,
« SIRET … ». C'est tout. Les deux coordonnées sont donc saisies dans les
réglages, stockées, et invisibles pour le client — **qui n'a aucun moyen
d'appeler l'artisan depuis le devis qu'il vient de recevoir**.

### Deux décisions de forme, qui valent pour les rubriques suivantes

**Le SIREN ne se saisit pas.** Il EST les neuf premiers chiffres du SIRET.
L'écran le montre sous le champ plutôt que de le redemander : deux saisies, ce
serait deux façons de se contredire, et c'est celui qui saisit qui paierait
l'écart. Le contrôle vérifie la correspondance des neuf chiffres.

**Le manque se signale sur la LIGNE, et dit ce qu'il empêche.** Un champ vide
garde son étiquette (« SIRET — manquant »), son trait passe à la couleur
d'alerte, et la phrase dit « vos factures ne sont pas conformes » plutôt que
« champ requis » — qui ne fait agir personne. Et le champ **reste vide** : un
exemple plausible glissé à la place d'une donnée absente finirait imprimé sur
une pièce comptable (`docs/AGENT.md` §3).

**Conséquence sur les filets :** la règle « la dernière ligne d'une liste perd
son filet » vaut pour un SÉPARATEUR. Sur une ligne en manque, le trait n'est plus
un séparateur mais le signalement lui-même — il reste. Deux lignes vides dont une
seule soulignée se lisaient comme un défaut d'affichage.

### La charte est désormais un module, pas une copie par planche

`maquettes/charte.mjs` porte les trois contrôles communs — couleurs comparées
aux jetons, absence d'ombre, grammaire des écrans — et le retrait de 26 px.
Recopier ces règles dans chaque vérificateur aurait produit ce que `CLAUDE.md`
§3 interdit : deux implémentations qui divergent. Le jour où un jeton change, un
seul fichier bouge.

**Un défaut vu à l'œil, encore :** l'encart d'alerte, posé hors d'un bloc,
touchait les deux bords de l'écran pendant que tout le reste s'arrêtait à 26 px.
Le contrôle du retrait est né de là, et il balaie tous les écrans des deux
planches.

**Et un contrôle juste qui accusait à tort :** la mesure des cibles de 44 px
comptait les lignes REPLIÉES — le numéro de TVA, caché tant que la franchise est
choisie, mesurait 0 px et faisait rougir un écran sain. Une ligne qu'on ne peut
pas toucher n'a pas de cible à tenir. Une alerte qui accuse à tort coûte plus
cher que pas d'alerte (`AGENTS.md`).


### Le premier jour d'un artisan : six faits qui rendent ce lot urgent

**Sa remarque du 13 août 2026 :** *« quand l'application sera commercialisée, le
devis ne comportera aucune information, il sera vierge, et c'est avec ces
informations-là que le devis devra se remplir automatiquement ».*

Elle a été vérifiée dans le code, et elle est plus lourde qu'elle n'en a l'air.
**Six faits, tous constatés, qui s'enchaînent :**

1. **Son banc ne montre JAMAIS l'état vierge.** `src/server/db/seed.ts` crée
   « Atelier Démo » avec SIRET, adresse, téléphone, e-mail **et** IBAN. Tout ce
   qu'il éprouve part donc d'une entreprise complète — l'écran du premier jour
   n'a jamais été vu par personne, ni par lui, ni par nous.
2. **Il n'existe aucun parcours d'inscription.** `creerEntreprise` n'est appelé
   que par le jeu de départ et les suites de tests. `src/app/` ne porte que
   `/login`. Un artisan ne peut pas créer son entreprise depuis l'application.
3. **L'identité ne se saisit nulle part dans les réglages.** Les seuls champs
   qui écrivent `entreprises` sont dans
   `src/app/chantiers/[id]/devis-complet/` — c'est-à-dire **au milieu de la
   rédaction d'un devis à la main**. Un artisan qui suit le parcours normal
   (dictée → prix → devis) n'a jamais l'occasion de saisir son SIRET.
4. **Rien ne vérifie l'identité avant l'envoi.** Aucun garde-fou dans
   `chantiers/[id]/export/`. Le premier devis peut partir sans SIRET, sans
   adresse et sans IBAN, **sans un mot**.
5. **Un repli poli masque déjà le manque :** `src/app/chantiers/[id]/export/page.tsx` écrit
   `entrepriseNom ?? "Votre entreprise"` dans le message au client. Le devis
   d'un artisan sans nom part donc au nom de « Votre entreprise ».
6. **Le devis FIGE l'identité au moment de sa création** (`devis.ts`, le devis
   recopie `entreprise.nom`, `.siret`, `.iban`…). C'est **la bonne décision** —
   une pièce comptable doit garder l'identité qu'elle portait le jour de son
   émission, et non suivre les corrections d'après. Mais la conséquence n'est
   écrite nulle part : **compléter son SIRET ce soir ne répare aucun devis déjà
   créé**. Sans avertissement, l'artisan corrige, rouvre son ancien devis, et
   conclut à une panne.

### Ce que la planche en tire

Deux écrans de plus dans `atlas-reglages-identite.html` :

- **« Le premier jour »** — les réglages d'un compte neuf. Trois rubriques
  marquées « À REMPLIR », et une phrase qui dit le mécanisme dans ses mots :
  *« votre devis se remplira tout seul avec ce que vous mettez ici »*. Ce qui
  peut attendre — tarifs, équipe — n'est **pas** mis sur le même plan : tout
  marquer en rouge ferait un écran qui crie, et qu'on cesse de lire.
- **« Ce qui est figé »** — un devis déjà créé, son SIRET absent nommé sur sa
  ligne, et l'avertissement qui dit que la correction vaudra pour les
  **prochains** devis.

**Ce lot cesse d'être une rubrique de confort.** Tant que l'identité ne se
saisit qu'au détour d'un devis manuel, Atlas ne peut pas être confié à un
artisan : son premier document partirait irrégulier. `TODO.md` §0 quatervicies
le porte, et c'est désormais le point le plus lourd de la série.


---

## 88. L'équipe et les rôles : le mot était déjà pris, et le cloisonnement n'existe pas

**Troisième lot des réglages, dessiné le 13 août 2026** —
`maquettes/atlas-reglages-equipe.html`, quatre écrans, contrôlée par
`maquettes/verifier-atlas-reglages-equipe.mjs`. Rien dans `src/`.

### « Équipe » désigne déjà autre chose, et les fondre serait une faute

Dans Atlas, une **équipe** est une FILE DE PLANNING : combien de chantiers
partent en même temps (`entreprises.nombre_equipes`, 1 à 20), avec un nom
facultatif (§51). **Ce n'est pas un compte.**

Les deux ne se recouvrent pas, et c'est structurel : une file peut s'appeler
« Malik » — une personne — ou « Équipe B », deux ouvriers qui n'ouvriront jamais
l'application ; à l'inverse un commercial a un compte et ne conduit aucun
chantier. La rubrique tient donc **deux listes séparées**, et l'écran le dit :
« une équipe n'est pas un compte ». Les fondre aurait produit la question
insoluble *« pourquoi mon commercial apparaît-il dans le planning ? »*.

Le contrôle tient la distinction par une mesure simple : **une file du planning
ne porte aucun rôle.** Si un jour les deux listes fusionnent, il rougit.

### Trois réserves, toutes vérifiées dans le code

1. **Le rôle « commercial » n'existe pas.** `membres_entreprise.role` ne connaît
   que `proprietaire` et `membre`.
2. **Aucun parcours d'invitation.** `src/server/repositories/membres-entreprise.ts`
   sait ajouter et retirer un membre ; aucun écran ne l'appelle, et rien
   n'envoie d'invitation. Un patron ne peut pas donner un accès.
3. **Le cloisonnement en LECTURE n'est pas codé, et c'est le plus grave.**
   `exigerProprietaire` protège vingt-trois points d'écriture ; `getRole` n'est
   appelé dans **aucun** écran. **Un « membre » voit aujourd'hui tous les prix,
   tous les devis, tous les montants.** C'est exactement ce que
   `docs/QUESTIONS.md` §10 refuse.

### Deux décisions de forme, qui portent la règle du §10

**Un rôle dit ce qu'il FERME, pas seulement ce qu'il ouvre.** Une liste qui
n'énumère que les droits laisse croire que le reste est permis. Le patron, lui,
n'a aucune ligne de refus — une croix chez lui serait fausse — mais l'écran
prévient qu'un second patron peut tout défaire, coordonnées bancaires
comprises.

**L'écran d'un salarié ne laisse AUCUNE PLACE pour un montant.** Pas de colonne
de prix, pas de total, et surtout **pas d'emplacement vide** : un blanc à la
place d'un chiffre dirait « il y a un montant ici, on te le refuse », et le
premier réflexe serait d'ouvrir le PDF — qui, lui, s'ouvre. La phrase de
clôture le dit dans ces termes : *le serveur ne les a pas envoyés*.

### Seul, on ne parle pas de rôles

Même arbitrage que pour les équipes (§51) : à une seule personne, aucun choix de
rôle n'est proposé et le bloc des files disparaît. Proposer d'arbitrer des
permissions quand il n'y a personne à distinguer serait un piège.

### La question du 7 août, tranchée le 13 — et autrement que prévu

*« Le salarié voit-il le planning de toute l'entreprise, ou seulement ses
chantiers à lui ? »* — réponse remise le 7 août, donnée le 13 :

> *« Accès à tout, mais le patron choisira s'il a accès qu'à ses chantiers ou à
> tout. »*

**Ce n'est ni l'une ni l'autre des deux options proposées**, et c'est la leçon :
la question posée en « ou bien / ou bien » appelait un troisième terme. C'est un
**réglage par personne**, posé sous le rôle du salarié — deux salariés peuvent
ne pas voir la même chose.

**Le défaut est « tout le planning ».** Un salarié invité ce matin voit
l'ensemble tant que son patron n'a rien restreint : restreindre est un geste,
pas un état de départ. Le contrôle tient ce défaut explicitement — inverser la
valeur par défaut le ferait rougir, parce qu'un réglage de confidentialité qui
change de sens en silence ne se remarque jamais.

**Le rôle « commercial » est validé le même jour**, tel qu'il est dessiné.
`docs/QUESTIONS.md` §10 porte désormais le tableau des quatre rôles, et
`docs/A-FAIRE.md` §10 ce qui bloque la commercialisation.

### Le défaut vu à l'œil, et le contrôle qui en naît

Un `.bloc` imbriqué dans un autre reprenait sa marge de 26 px et se retrouvait à
**52** — la liste « ce que ça change » était décalée à droite de tout le reste.
`controlerRetrait` ne regardait que les enfants directs du corps et ne pouvait
pas l'attraper ; il mesure désormais **tous** les blocs, imbriqués compris, et
la règle vaut pour les trois planches.

Corrigé au passage : le titre disait « ce que ça ouvre » au-dessus d'une liste
qui contient aussi des refus. Il dit « ce que ça change ».


---

## 89. Tarifs et catalogue : trois familles, et ce qui n'appartient pas à l'artisan

**Quatrième lot des réglages, dessiné le 13 août 2026** —
`maquettes/atlas-reglages-tarifs.html`, quatre écrans, contrôlée par
`maquettes/verifier-atlas-reglages-tarifs.mjs`. Rien dans `src/`. C'est la
dernière des quatre priorités du patron.

### Trois choses existaient déjà, et elles n'étaient pas distinguées

| | Où c'est | Ce que c'est |
|---|---|---|
| **Ses tarifs** | `tarifs` (intitulé, prix, unité) | Une liste **plate**, à lui, éditée sur l'écran des réglages |
| **Cinq grilles de prix** | `src/lib/grille-prix.ts`, `/reglages/prix` | Elles naissent **vides** et apprennent de ses devis (`lecons-prix.ts`) |
| **Le catalogue** | `catalogue_prestations`, `catalogue_materiels` | **Partagé**, tenu par l'éditeur, le même chez tous — les mots, jamais les prix |

**La distinction entre le premier et le troisième n'était écrite nulle part**, et
l'écran des réglages les mettait côte à côte sans le dire : un artisan qui
modifie « ses tarifs » ne savait pas s'il touchait quelque chose qui lui
appartient. La planche le dit à l'écran plutôt que dans une documentation que
personne n'ouvre.

### Ce que la planche tranche

**Trois familles — prestations, main-d'œuvre, matériel — et la colonne n'existe
pas en base.** `tarifs` porte un intitulé, un prix et une unité, rien qui les
range.

**L'unité SUIT la famille.** Une main-d'œuvre se compte en temps (heure,
demi-journée, journée), un matériel à la journée, une prestation au forfait ou à
l'unité. Proposer les mêmes vingt unités aux trois obligerait à chercher
« heure » dans une liste longue, et à se tromper une fois sur dix — l'erreur ne
se voyant que sur le devis du client. Le contrôle vérifie que **les jeux
diffèrent** : s'ils devenaient identiques, la famille ne servirait plus à rien.

**Un prix sans unité n'est pas un prix.** « Évacuation 90 € » ne dit pas si
c'est par mètre cube ou par voyage. Le manque est signalé **sur la ligne**, dans
la couleur d'alerte — même grammaire que le SIRET manquant du §87.

**Une grille vide se dit vide, et dit pourquoi.** C'est l'état normal du premier
jour : Atlas n'a pas encore vu de haie passer. Sans un mot, une grille vide se
lit comme une panne — et la phrase reprend la règle du produit dans ses termes :
*il préfère se taire qu'inventer*.

### Le contrôle des bandes vides, élargi — et le faux positif qu'il a fallu ôter

Il ne surveillait qu'UN écran par planche, et la planche des tarifs en a laissé
passer une sur un autre. Élargi à tous les écrans, **il a immédiatement trouvé
un vrai défaut sur la planche de l'équipe** (30 px de vide entre le dernier
choix de rôle et le bloc suivant) — mais aussi **cinq faux positifs** : une
liste dont chaque ligne porte un filet met 39 px entre deux traits, et c'est
normal.

Le contrôle regarde donc désormais **s'il y a du texte entre les deux filets**,
et pas seulement l'écart. Sans cette précaution il accusait à tort sur une
planche saine — et une alerte qui désigne le mauvais coupable coûte plus cher
que pas d'alerte (`AGENTS.md`).


### Ajouter et supprimer un tarif — et ce que la suppression ne casse pas

**Sa demande du 13 août 2026 :** *« pouvoir aussi ajouter ou supprimer du
matériel, ou un prix, ou un machin ».* Les deux gestes manquaient à la planche.

**UN GESTE D'AJOUT PAR FAMILLE, et qui nomme la famille.** « Ajouter un
matériel » ferme la liste du matériel ; « Ajouter » tout court, en tête d'écran,
obligerait à choisir la famille sur un écran de plus — alors que c'est
précisément elle qui commande les unités proposées ensuite (§89). Le contrôle
vérifie que chaque geste **nomme** ce qu'il ajoute et **ferme** la liste de sa
famille.

**LA SUPPRESSION VIT AU BAS DE LA FICHE, jamais dans la liste.** Une corbeille
posée sur chaque ligne se touche du pouce en faisant défiler. Elle est en texte
et non en aplat : un bouton rouge plein dans un écran de réglages attire l'œil
avant tout le reste, et le rouge de cette charte est réservé à **une seule
chose** — confirmer une action destructive.

**Et elle demande confirmation, en disant ce qu'elle NE casse PAS.** C'est le
point qui compte, et il est vérifié dans le code plutôt que supposé :

- `supprimerTarif` pose `deletedAt` — **rien n'est réellement effacé** ;
- **aucune ligne de devis ne pointe vers un tarif** : `lignes_prix` copie le
  libellé et le prix au moment où elle est écrite. Un devis déjà fait ne bouge
  donc pas, et une facture non plus.

La feuille l'écrit avant le geste : *« Vos devis et vos factures n'en seront pas
touchés : ils gardent le prix qu'ils portaient le jour où ils ont été écrits. »*
**Le taire aurait suffi à bloquer l'artisan** — personne n'ose supprimer un
tarif dans le doute, et il aurait gardé une liste qui grossit sans jamais
maigrir.


### « L'IA se servira de ces infos pour constituer les devis ? » — oui, et quatre chiffres invisibles avec

**Sa question du 13 août 2026.** Y répondre a demandé de lire le pipeline, et a
mis au jour un réglage qui agit sans être visible nulle part.

### L'ordre exact, tel que `proposition-builder.ts` l'exécute

1. **Il cherche dans ses tarifs.** Un seul correspond → il le prend, tel quel
   (`sourcePrix: "tarif"`).
2. **Plusieurs correspondent → il ne choisit pas** (`"tarifs_ambigus"`), il les
   énumère et laisse trancher. Le commentaire du fichier le dit :
   *« jamais de prix inventé, jamais de choix arbitraire »*.
3. **Aucun ne correspond → le moteur calcule** (`"chiffrage"`) : durée × nombre
   d'ouvriers × coût journalier, + le chef s'il y en a un, + le déplacement,
   + la marge.
4. **Il ne peut pas calculer → il se tait** (`"aucun"`) : « Prix à renseigner ».

### Ce qui sert au modèle, et ce qui ne lui est jamais envoyé

| Ce qu'il règle | Ce que ça fait |
|---|---|
| **Ses tarifs** | Cherchés en premier, repris tels quels |
| **Les cinq grilles** | Apprises de ses devis, rappelées sur un chantier comparable |
| **Le vocabulaire du métier** | Les mots, pour comprendre la dictée |
| **Son identité — SIRET, IBAN, adresse** | **Jamais envoyée au modèle.** Elle est recopiée dans le document au moment de sa création (§87) |

Ce dernier point mérite d'être su : ce qui identifie l'entreprise et sa banque ne
part chez aucun fournisseur d'IA.

### Le réglage qui agit sans exister à l'écran

**`parametres_chiffrage` porte cinq valeurs par entreprise** — 200 €/jour
l'ouvrier, 280 € le chef d'équipe, 35 € le déplacement, 20 % de marge, 20 % de
TVA par défaut — **et aucun écran ne permet de les changer.**

Ces chiffres décident du prix proposé chaque fois qu'aucun tarif ne correspond.
Un artisan dont l'ouvrier coûte 260 € par jour verra donc des prix trop bas,
**sans jamais savoir d'où ils viennent**. C'est pire qu'un réglage manquant :
c'est un réglage qui existe, qui agit, et qu'on ne peut pas voir.

Un cinquième écran est ajouté à la planche des tarifs — « Mes coûts » — avec
l'ordre de recherche en quatre pas, parce que c'est la seule chose qui réponde
vraiment à sa question.

### Un mot en gras détaché de sa phrase

`display:flex` posé sur un `li` fait de chaque `<b>` un élément de la boîte : le
texte s'éclate en colonnes, avec des trous entre les mots. **Vu sur la capture,
jamais par un contrôle.**

Le contrôle qui en naît a d'abord été écrit faux : il exigeait que le gras soit à
la **même hauteur** que la fin du texte voisin. Or, éclaté, le texte voisin se
replie sur deux lignes et le gras se retrouve plus haut — le contrôle laissait
donc passer exactement ce qu'il devait attraper. Il mesure désormais le
**chevauchement vertical**, et il a été confronté à la version cassée pour
qu'on sache qu'il rougit.


---

## 90. Le « deuxième cerveau » : la direction, et l'état réel de la mémoire

**Posé par le patron le 13 août 2026 :**

> *« L'idée, c'est de créer un deuxième cerveau au sein de l'application, pour
> qu'elle s'utilise comme un assistant de gestion / devis, facture, planning.
> Elle doit apprendre, enregistrer, s'améliorer, s'auto-alimenter. »*

À lire avec sa phrase antérieure, qui dit la même chose autrement : *« si l'appli
n'a aucune mémoire, comment l'IA va enregistrer et se souvenir ? Pour s'améliorer
elle a besoin de mémoire. »*

### LA LEÇON DÉJÀ PAYÉE, et qui commande tout le reste

`historique_prix` existait. Le chiffrage la **lisait**. **L'application ne
l'écrivait jamais** (`src/lib/lecons-prix.ts`). Une mémoire que personne
n'alimente n'est pas une mémoire.

**La question à poser devant toute proposition d'apprentissage n'est donc pas
« avons-nous une table ? » mais « QUI L'ÉCRIT, ET À QUEL MOMENT ? »** Un lot
d'apprentissage qui ne désigne pas un geste du parcours — une clôture, un
paiement, un refus — est un lot qui produira du décor.

### Ce qui apprend, vérifié dans le code le 13 août 2026

| Où | Ce qui est retenu | Écrit par |
|---|---|---|
| `lecons_prix` | Le prix réellement facturé, rapproché par signature de métier | `src/server/repositories/lecons-prix.ts` |
| `grille_prix` | Les cinq grilles, remplies par les devis réels | `src/server/services/apprendre-grille.ts` |
| `fragments_documents` | Fragments indexés de la base documentaire | `src/server/repositories/documents.ts` |

**Le prix retenu est rendu comme un RAPPEL, jamais comme un calcul**
(`docs/EXEMPLE-DICTEE.md` §9c) : *« vous aviez facturé 180 € »* se vérifie d'un
coup d'œil ; *« ça fait 180 € »* demande qu'on fasse confiance. Cette nuance est
la différence entre un second cerveau et une boîte noire.

### Ce qui ne retient rien — les manques, par ordre de poids

1. **LE TEMPS RÉEL D'UN CHANTIER.** Aucune colonne de durée réelle nulle part.
   Atlas ne peut donc pas savoir si ses estimations sont justes — **or c'est la
   durée qui fait le prix** quand aucun tarif ne correspond (§89). C'est le
   manque le plus lourd, et le moins coûteux à combler : une question à la
   clôture suffit, et le moment existe déjà dans le parcours.
2. **Les coûts de chiffrage** (§83) : figés aux valeurs d'usine, ni réglables ni
   appris.
3. **Les délais de paiement réels** : rien ne retient qu'un client règle à
   45 jours quand il en a promis 30.
4. **Ce qu'un client refuse ou fait corriger** : l'information de prix que porte
   un devis retourné n'est pas retenue, alors que l'état existe déjà
   (`src/lib/etat-envoi.ts`).

### Ce que cette direction change pour les lots à venir

Elle ne change pas les écrans déjà dessinés, mais elle **ajoute un critère de
relecture** : devant chaque rubrique de réglages, se demander *ce qu'Atlas
pourrait apprendre à la place de le demander*. Les cinq grilles sont le modèle —
elles ne se saisissent pas, elles se remplissent. Un réglage qu'on peut déduire
d'un geste déjà fait ne devrait pas être un champ de formulaire.


---

## 91. Les documents : ce qui se règle, et le modèle qu'on ne remplace pas

**Cinquième lot, dessiné le 13 août 2026** —
`maquettes/atlas-reglages-documents.html`, quatre écrans, contrôlée par
`maquettes/verifier-atlas-reglages-documents.mjs`. Rien dans `src/`.

### L'état du code, à ne pas redécouvrir

- La validité « 30 jours » est **écrite en dur** (`devis-pdf.ts`, constante
  `VALIDITE`).
- Les mentions de la facture sont **en dur** (`facture-pdf.ts`), et c'est bien.
- Il n'existe qu'**un seul champ libre**, `conditionsPaiement` — tout ce qu'il
  demande y tiendrait en vrac, ce qu'il refuse explicitement.
- **Aucune image n'est posée dans le PDF** : `document-commun.ts` n'écrit que du
  texte et des traits.

### Sa question sur le modèle : la réponse est NON, et l'écran dit pourquoi

*« Ou alors de complètement changer son devis par le devis par défaut, si c'est
possible sans casser toute la structure automatisée créée. »* **Il avait posé
lui-même la bonne réserve**, et elle tranche : ce n'est pas possible.

Un devis n'est pas une feuille : c'est un document **calculé**. Le nombre de
lignes change, les totaux se déplacent, la TVA se recalcule, la page suivante
reprend l'en-tête. Un modèle importé ne saurait pas où poser un total qui bouge,
et le premier devis de dix lignes sortirait faux.

**L'écran ne se contente pas de refuser** : il nomme d'abord ce qui EST possible
— logo, conditions, textes —, puis l'unique point refusé, puis **les deux côtés
de l'échange** : ce qu'on y gagne (numérotation intacte, totaux justes, même
pièce impeccable à chaque fois) et ce qu'on y perd (la mise en page n'est pas la
sienne). Un refus sans raison se lit comme une paresse ; un refus qui s'échange
se comprend.

**« Extraire le logo d'une photo » revient à déposer une image**, sans l'étape
incertaine du découpage automatique. C'est le même geste pour lui, et un pas de
moins qui peut rater.

### Deux décisions de forme

**Le logo est montré à sa taille RÉELLE** — 26 mm sur le papier, environ 74 px à
l'écran. Un aperçu deux fois trop grand ferait valider un logo illisible une fois
imprimé : c'est le piège de §78 sous un autre visage, et le contrôle borne la
taille.

**Les deux textes libres ne vont pas au même endroit, et l'écran le dit.** Les
conditions particulières valent pour CE devis et se lisent avec les prix ; le
texte de bas de page revient sur TOUTES les pièces, devis comme factures. Les
fondre en un seul champ produirait un texte imprimé deux fois, ou nulle part.

**Le rappel des pénalités sur le devis part éteint, et l'écran dit pourquoi** :
certains clients le lisent comme une méfiance. Un défaut choisi se justifie —
sans quoi il passe pour un oubli.


---

## 92. Les notifications : huit familles, et une seule qui existe

**Sixième lot, dessiné le 13 août 2026** —
`maquettes/atlas-reglages-notifications.html`, trois écrans. Rien dans `src/`.

### L'état réel, qui change la lecture de cet écran

**Aucune notification ne sort de l'application aujourd'hui.** Il en existe UNE
famille (`src/app/Notifications.tsx`) : ce qu'est devenu un devis parti. Elle
s'affiche **sur l'écran d'accueil**, et seulement là. Rien n'est envoyé, ni sur
le téléphone ni par e-mail.

**Le SMS est écarté, et c'était déjà tranché** — `docs/A-FAIRE.md` §5, le
4 août 2026. Le porter comme « bientôt » serait promettre ce qui a été refusé.
Il ne figure donc nulle part, et l'écran dit pourquoi plutôt que de laisser
chercher.

### Ce que la planche tranche

**Huit familles, rangées en trois groupes — l'argent d'abord.** Huit
interrupteurs à la file font une liste qu'on parcourt sans lire. Groupés par ce
qu'ils servent (son argent, ses journées, ses clients), ils se choisissent d'un
coup d'œil. L'ordre n'est pas neutre : ce qu'un artisan vient chercher en
premier, c'est ce qui lui coûte cher de rater.

**Le canal se lit sur la ligne**, en or, à côté de l'interrupteur. Une grille
famille × canal serait illisible sur un téléphone, et personne ne remplit un
tableau de seize cases.

**La phrase exacte est montrée, pas décrite.** « Une alerte d'impayé » ne se juge
pas ; *« Facture Martin, 1 240 €. En retard depuis 7 jours. »* si — c'est elle
qu'il lira à sept heures du matin.

**Une alerte qui coûte de l'argent se coupe avec un mot.** L'impayé n'est pas
verrouillé — sa règle dit « seulement ce qui pose un problème juridique ou
moral », et une notification ne pose ni l'un ni l'autre — mais l'écran prévient :
l'éteindre, c'est accepter de ne plus savoir qu'on n'est pas payé.

**Tout éteindre ne coupe pas d'Atlas.** Le troisième écran le dit : les cartes
de l'accueil restent, c'est seulement Atlas qui cesse de déranger. Sans cette
phrase, un artisan qui veut le calme croirait avoir tout perdu et rallumerait au
hasard.


---

## 93. Les cinq dernières rubriques, et pourquoi elles tiennent sur une planche

**Septième et dernier lot de dessin, le 13 août 2026** —
`maquettes/atlas-reglages-reste.html` : Atlas IA, intégrations, apparence,
sécurité, abonnement. Rien dans `src/`. **Les dix rubriques demandées sont
désormais toutes dessinées.**

Les réunir n'est pas de la paresse : deux existent déjà presque entièrement
(l'IA et les intégrations), deux sont marquées « bientôt » depuis le lot 1, et la
cinquième est faite de gestes rares. Aucune ne demandait quatre écrans.

### Les quatre arbitrages

**LES TROIS ARRÊTS DE L'AGENT NE SE COUPENT PAS.** `docs/AGENT.md` les pose comme
non négociables : envoyer un devis, poser une date au client, émettre une
facture. Ils portent la marque « Toujours vous », à la place où l'on chercherait
leur interrupteur — même grammaire que les mentions légales du lot 1. Un
interrupteur qui les supprimerait ferait partir un devis sans qu'il l'ait vu, ce
que `CLAUDE.md` §4 interdit.

**UN INTERRUPTEUR MORT EST PIRE QU'UNE ABSENCE.** Le mode sombre n'existe pas :
il porte donc « Bientôt » et **aucune bascule**. Un bouton qu'on touche et qui ne
fait rien se lit comme une panne, et fait douter du reste de l'écran.

**L'APPARENCE MONTRE, ELLE NE DÉCRIT PAS.** Quatre pastilles de couleur réelles,
44 px, sans un mot. Personne ne choisit une teinte sur l'adjectif « sobre ». Le
fond crème, lui, ne change pas — c'est lui qui donne son calme à l'application,
et le dire évite qu'on cherche à le changer.

**« TOUT EST EFFACÉ » SERAIT FAUX.** La suppression de l'entreprise est le seul
geste vraiment irréversible : il vit **seul, en bas, après un trait**, séparé de
ce qui se règle. Et il dit ce que la loi impose de garder — **dix ans pour les
factures** — avant le geste, pas après. Une promesse d'effacement total serait un
mensonge, et se découvrirait au pire moment.

**Un mot qui trompe, désamorcé :** sur l'écran d'abonnement, « vos factures »
désigne celles qu'Atlas lui envoie, pas celles de ses clients. Les confondre
serait le premier appel au secours ; l'écran le dit sur place.

### Les dix rubriques, et où elles en sont

| Rubrique | Planche | État du code |
|---|---|---|
| Le plan, les rôles, l'interrupteur | `atlas-reglages-plan.html` | rien |
| Identité, TVA, banque | `atlas-reglages-identite.html` | **bloquant** (§87) |
| Équipe et rôles | `atlas-reglages-equipe.html` | rien, et le cloisonnement manque (§88) |
| Tarifs, grilles, coûts | `atlas-reglages-tarifs.html` | partiel (§89) |
| Documents | `atlas-reglages-documents.html` | rien (§91) |
| Notifications | `atlas-reglages-notifications.html` | une famille sur huit (§92) |
| IA, intégrations, apparence, sécurité, abonnement | `atlas-reglages-reste.html` | IA et intégrations partiels |


---

## 94. Premier lot CODÉ : l'identité de l'entreprise, et le régime de TVA qui cesse d'être deviné

**13 août 2026, en autonomie** — migration `0039_identite_entreprise.sql`,
écran `/reglages/identite`, suite `scripts/test-identite-entreprise.ts`.
C'est le premier lot des réglages qui passe du dessin au code, et c'est celui
qui **bloquait la commercialisation** (§87).

### Ce que la migration ajoute, et pourquoi chaque colonne

| Colonne | Pourquoi |
|---|---|
| `forme_juridique` | Figure sur les documents, ne se saisissait nulle part |
| `regime_tva` | **Le point qui compte** — voir ci-dessous |
| `numero_tva` | Attendu sur la facture d'un assujetti |
| `titulaire_compte` | Un IBAN à un autre nom inquiète au lieu de rassurer |

### LE RÉGIME DE TVA SE DÉCLARE, IL NE SE DEVINE PLUS

`facture-pdf.ts` imprimait « TVA non applicable, art. 293 B du CGI » **quand le
taux appliqué valait zéro**. La situation fiscale de l'entreprise se déduisait
donc d'un chiffre saisi chantier par chantier, et **se trompait dans les deux
sens** : un artisan en franchise qui laissait 20 % par mégarde perdait une
mention obligatoire ; un assujetti qui posait 0 % voyait s'imprimer, sur une
pièce comptable, une phrase qui ne le concernait pas.

**Trois décisions autour de ce changement :**

1. **Le défaut est `assujettie`**, et ce n'est pas anodin : c'est celui qui ne
   change RIEN au comportement observé jusqu'ici pour une entreprise qui
   facture la TVA. Poser « franchise » aurait fait apparaître la mention sur les
   prochaines factures d'artisans qui la facturent.
2. **Le régime est FIGÉ DANS LA FACTURE** (`factures.entreprise_regime_tva`),
   comme le reste de l'identité (§87) : une facture émise sous franchise garde
   sa mention même si l'artisan devient assujetti l'année suivante. La lire en
   direct réécrirait le passé sur une pièce comptable.
3. **Le repli sur le taux demeure, et doit demeurer.** Les factures antérieures
   à la migration n'ont pas de régime figé ; le retirer réécrirait leur
   historique. La migration recopie d'ailleurs la déduction une dernière fois
   (`UPDATE … CASE WHEN taux_tva = 0`) pour que les factures déjà émises gardent
   exactement ce qu'elles ont imprimé.

### L'écran, et ce qu'il refuse

`/reglages/identite` **refuse un non-propriétaire plutôt que de masquer** : les
valeurs ne sont pas lues du tout. Une rubrique cachée ne protège rien
(`docs/QUESTIONS.md` §10).

**Le SIREN se montre, il ne se demande pas** — `sirenDepuisSiret` prend les neuf
premiers chiffres et les affiche sous le champ. **Un champ manquant reste vide
et se signale sur SA ligne**, en disant ce que l'absence empêche : « Vos factures
ne sont pas conformes sans lui », jamais « champ requis ».

**Le refus est rendu en VALEUR, jamais levé.** Le message d'une exception d'action
serveur n'arrive jamais au patron — Next.js le remplace par un identifiant
opaque (`HANDOVER.md`, piège 0 ter). Et la panne imprévue est journalisée **avant**
d'être rendue : un défaut muet ne se répare pas.

### Deux erreurs de MA suite de tests, et ce qu'elles enseignent

**Elle lisait `t.texte` là où la trace écrit `t.contenu`.** Deux cas rougissaient
à tort — et un TROISIÈME passait pour une mauvaise raison : il vérifiait une
absence dans un texte qui n'avait jamais été lu. **Un test vert sur une chaîne
vide ne prouve rien**, et c'est le plus dangereux des deux symptômes.

**Elle comparait une FONCTION au lieu de son résultat** (`test(mots)` au lieu de
`test(mots(trace))`), après une réécriture automatique maladroite. Le message
accusait la facture ; le coupable était le test.

La suite a ensuite été confrontée à l'ancien code — la déduction par le taux
remise en place — et elle rougit sur les deux cas exacts que ce lot corrige.


### Et deux défauts vus sur l'écran RÉEL, que les planches interdisaient déjà

L'écran codé a été **regardé**, pas seulement compilé — `scripts/capture-identite.mts`
prend trois vues : rempli, en franchise, et **vierge**. Cette dernière compte
autant que les autres : c'est celle du premier jour d'un artisan, et personne ne
l'avait jamais vue (§87).

Deux défauts en sont sortis, **tous deux déjà interdits sur les planches** et
qu'aucun test ne voyait :

1. **Le dernier champ d'un bloc gardait son filet**, que le trait du bloc suivant
   redoublait trente pixels plus bas. La correction n'est pas cosmétique dans sa
   forme : la bordure passe en CLASSE (`border-b`) pour que
   `[&>*:last-child]:border-b-0` puisse l'effacer — un style en ligne l'aurait
   emporté, et la règle n'aurait jamais rien fait.
2. **Le premier bloc portait un trait** sous le cheveu qui ferme déjà l'en-tête.

**Ce que cela apprend, et qui vaut pour les lots de code à venir :** les règles
tenues par `maquettes/charte.mjs` ne se transportent pas toutes seules dans
`src/`. Les planches sont contrôlées, l'application ne l'est pas — et les mêmes
défauts y reviennent. Le seul rempart est celui que `CLAUDE.md` §5 nomme :
prendre une capture des écrans touchés fait partie du travail, pas de la
finition.

---

## 95. Le sommaire des réglages : sa planche à lui, et le seul choix qui restait

**Le 14 août 2026, le patron a envoyé une planche qu'il n'avait pas demandée** —
un sommaire noir et or, dix rubriques, une icône chacune — avec ce seul mot :
« c'est ça que je voulais ! ». Ses libellés ne figuraient nulle part dans le
dépôt : elle vient d'ailleurs, et c'est une consigne, pas une livraison.

**Ce qu'elle apporte, et que mes sept planches n'avaient pas :**

| Sa planche | Ce qu'elle corrige |
|---|---|
| une **icône par rubrique** | treize lignes de texte se parcourent mal ; le pictogramme est ce qui permet de retrouver « Tarifs » sans lire |
| « **Devis & factures** » | personne ne cherche « Documents » pour changer un acompte |
| « **Planning** » | il figurait dans ses quatre priorités du 13 août, et j'avais oublié de lui donner une rubrique |

**Ce qu'elle ne dit pas, et qui a dû être demandé : les couleurs.** Un écran
sombre au milieu de vingt écrans crème se lit comme un écran d'une autre
application. Interrogé, il a répondu **« crème, comme le reste »**. Le mode
sombre reste donc la rubrique « Apparence », marquée *Bientôt* — et
`design-tokens.ts` porte déjà la note qui dit où l'empêcher de partir jusque
sur le devis du client.

**Ce qu'elle ne dit pas non plus, et qui ne se demande pas : QUI VOIT QUOI.**
Sa liste de dix est plate. Or c'est lui qui a posé la règle le 13 août — « un
salarié peut changer ses notifications ou son mot de passe, mais il ne doit
évidemment pas pouvoir modifier les tarifs ou les coordonnées bancaires » — et
`docs/QUESTIONS.md` §10 va plus loin : ce qu'un rôle n'a pas le droit de voir ne
doit pas **sortir du serveur**. D'où les deux ensembles, « Moi » et
« L'entreprise », qui n'existent pas sur sa planche : sans eux, il n'y a nulle
part où couper. Les quatre lignes de « Moi » sont exactement ce qu'un salarié
garde ; les neuf autres ne lui sont pas grisées, elles lui sont **absentes**.

**`maquettes/atlas-reglages-sommaire.html` — trois écrans, dont deux à choisir :**

1. **en filets**, la grammaire de tous les écrans refaits ;
2. **en cartes**, sa planche traduite en crème — chaque rubrique posée sur
   `colors.card`, sans ombre et au rayon de 4 px ;
3. **le même écran pour un salarié**, qui n'est pas une variante d'affichage.

**Les deux registres portent la MÊME liste, et c'est le contrôle le plus
important du vérificateur.** S'ils divergeaient d'une rubrique, la comparaison
porterait sur autre chose que le registre, et il choisirait une allure en
croyant en choisir une autre.

**Le deuxième contrôle qui mérite son existence :** *aucune icône n'est le
doublon d'une autre*. Dix pictogrammes recopiés passeraient tout le reste — la
liste serait complète, alignée, dorée, et parfaitement illisible.

**Un contrôle a d'abord accusé à tort, et la correction est instructive.** La
recherche de la coquille de sa planche (« confidentbilité », qu'il ne fallait
pas recopier) portait sur le FICHIER : elle rougissait sur le commentaire
d'en-tête qui cite la faute pour dire qu'on l'a vue. Elle porte désormais sur le
**texte affiché**. Une règle qui interdit un mot doit regarder là où le mot
serait lu, pas là où on en parle.

---

## 96. Les réglages refondus : un sommaire, et chaque chose rangée dessous

**Le 14 août 2026, le patron :** *« je veux que tu recrées entièrement la page
de réglage. La modifier totalement. Et ce qu'on a déjà, soit tu crées les
catégories qu'il y a besoin pour les implémenter, soit s'il va y avoir des
doublons, tu supprimes. Exemple, les prix de main-d'œuvre et de machine, eh bien
ça, tu l'intègres directement dans la partie tarif. »*

### Ce que l'écran était devenu

Une page à défilement où s'empilait tout ce qui n'avait trouvé sa place nulle
part : un lien vers l'identité, le nombre d'équipes, la périodicité de TVA, la
liste des tarifs, un lien vers le catalogue, un lien vers les grilles de prix,
un lien vers l'agenda, un lien vers le vocabulaire, l'état de l'IA, le
téléchargement des données, la version, le bouton de mise à jour. **Douze blocs,
sans hiérarchie**, chacun ajouté au bas du précédent le jour où il est né.

Le coût n'était pas esthétique. Changer un prix demandait de faire défiler
quatre écrans ; et deux réglages fiscaux — *suis-je en franchise* et *à quel
rythme je déclare* — vivaient à deux endroits séparés par tout le reste.

### Où chaque chose est partie, et pourquoi là

| Ce qui traînait sur l'écran | Sa rubrique | La raison |
|---|---|---|
| identité, SIRET, TVA, IBAN | **Mon entreprise** (`/reglages/identite`) | déjà un écran (§94) |
| **périodicité de TVA** | **Mon entreprise** | c'est la moitié de la même question que le régime — les séparer obligeait à savoir lequel était où |
| tarifs, import de tarifs | **Tarifs & catalogue** (`/reglages/tarifs`) | sa demande, mot pour mot |
| **grilles de prix**, **catalogue** | **Tarifs & catalogue** | « combien je facture ça » posait trois adresses |
| nombre et noms d'équipes | **Planning** (`/reglages/planning`) | « équipe » désigne ici une FILE DU PLANNING, pas un compte (§88) |
| état de l'IA, **vocabulaire du métier** | **Atlas IA** (`/reglages/ia`) | le vocabulaire est ce que l'IA reconnaît d'une dictée |
| agenda | **Intégrations** (`/reglages/agenda`) | inchangé, seulement renommé dans le sommaire |
| téléchargement des données | **Sécurité & données** (`/reglages/donnees`) | — |
| version, mise à jour | **reste sur le sommaire** | ce n'est pas un réglage : c'est la réponse à « mes correctifs sont-ils arrivés », et une capture doit y répondre sans qu'on pose la question (`CLAUDE.md` §6) |

**Les trois façons de dire un prix n'ont PAS été fusionnées**, et c'est
délibéré : un tarif est une ligne libre qu'il écrit ; une grille de prix
s'apprend de ses devis, case par case ; le catalogue est du vocabulaire partagé
entre tous les artisans et ne porte aucun prix (§89). Les mêler ferait croire
qu'un prix du catalogue est le sien — c'est-à-dire inventerait une donnée.

### La liste est une fonction pure, et ce n'est pas du rangement

`src/lib/rubriques-reglages.ts` porte les rubriques, leur ordre, leur icône et
**qui les voit**. La même liste dessine le sommaire et dit quelles adresses un
rôle peut ouvrir : deux implémentations d'une même règle finissent toujours par
diverger (`CLAUDE.md` §3), et ici la divergence serait un salarié qui voit les
coordonnées bancaires.

**Premier endroit d'Atlas où `getRole` décide de ce qu'un écran RESTITUE.**
Jusqu'ici il n'était appelé dans aucun écran (§88) : un membre voyait tout. Le
sommaire ne rend à un membre que l'ensemble « Moi » — pas grisé, pas masqué :
absent. Et chaque rubrique de l'entreprise refuse un non-propriétaire **avant de
lire la moindre valeur**, parce qu'une adresse se tape (`docs/QUESTIONS.md`
§10).

**Ce que cela ne règle pas, et qu'il ne faut pas croire acquis :** le reste de
l'application ne cloisonne toujours rien. Un membre voit encore tous les
montants sur les chantiers, les devis et les factures. Ce lot pose la pièce, il
ne ferme pas le sujet.

### Deux choix d'écran qui s'écartent de sa planche

1. **L'entreprise passe AVANT « Moi ».** Sur sa planche, les rubriques
   personnelles ouvraient la liste ; à l'écran, leurs quatre lignes sont encore
   à venir, et quatre rubriques inertes en tête font paraître l'écran cassé. Le
   patron ouvre les réglages pour ses tarifs et son identité. Pour un salarié,
   « Moi » est le seul ensemble et ouvre donc naturellement.
2. **Une rubrique non codée n'est pas un lien.** Elle garde son icône, en
   retrait, et porte « Bientôt » à la place du chevron. Un chevron sur une ligne
   qui ne mène nulle part promet une page — et le patron a déjà appuyé deux fois
   sur des choses qui ne répondaient pas.

### Ce que la refonte a révélé dans les suites

**`/reglages/mes-donnees` n'a jamais existé.** Deux suites navigateur —
« aucune barre de défilement » et « rien de recouvert » — la parcouraient dans
leur liste d'écrans : elles éprouvaient une page d'erreur en croyant éprouver un
écran, et elles étaient vertes. La bonne adresse est `/reglages/donnees`.

**Et le contrôle du vocabulaire serait devenu vert par accident.** Il vérifie
qu'un compte ordinaire ne se voit pas proposer le vocabulaire du métier, en
lisant l'écran des réglages ; le renvoi ayant déménagé sous « Atlas IA », le
contrôle aurait continué à passer en cherchant à un endroit où plus personne ne
le met. Il regarde désormais là où le renvoi serait.

### Le piège qui a coûté vingt rouges pour rien

**Lancer les suites navigateur sans `REDIS_URL` sabote la batterie à la sixième
suite, et pas un seul message ne le dit.** Le limiteur de connexion n'accepte
que **cinq connexions par quart d'heure** pour un même couple (compte, adresse
IP) ; toutes les suites se connectent avec `demo@atlas.local` depuis
`127.0.0.1`. Le lanceur remet le compteur à zéro entre deux suites — mais il ne
peut le faire que si le compteur vit dans Redis : celui de l'adaptateur mémoire
est enfermé dans le processus serveur, hors d'atteinte. Sans la variable,
`reinitialiserLimiteConnexion` se taisait et rendait la main.

Le 14 août 2026, vingt suites sont donc tombées **en disant toutes la même
chose** : « dépassement de délai en attendant la redirection après la
connexion ». C'est-à-dire : *le formulaire de connexion est cassé*. Il allait
très bien. Vingt minutes de batterie pour un verdict faux qui envoyait chercher
au mauvais endroit — précisément ce que `AGENTS.md` interdit.

`run-e2e-tests.ts` **refuse désormais de partir** sans `REDIS_URL`, et son
message nomme le vrai coupable. La batterie officielle
(`verifier-avant-livraison.ts`) et la CI la posaient déjà : c'est l'appel à la
main qui ne l'avait pas.

Et `monter-base-locale.sh` continue de ne PAS la poser, ce qui n'est pas une
contradiction : avec elle, les suites BASE laissent une connexion ioredis
ouverte et ne rendent jamais la main. C'est à l'appelant des suites navigateur
de la fournir.

---

## 97. Bloquer l'envoi sans SIRET : décidé, codé, puis RETIRÉ le même jour

**Ce paragraphe existe pour qu'on ne le recode pas dans trois mois.** La question
« faut-il empêcher l'envoi d'un devis dont l'identité est incomplète ? » a été
posée au patron, tranchée par lui, codée, montrée — et retirée à sa demande dans
la journée. Sans cette trace, une session la rouvrirait en croyant réparer un
oubli.

**Le 14 août 2026 au matin**, planche `atlas-trois-questions.html` en main,
question 3 : il répond **« A »**, bloquer l'envoi. C'est codé — quatre champs
bloquants, refus côté serveur, écran qui liste les manques — et deux captures
lui sont envoyées.

**Le même jour, en voyant l'écran, il tranche l'inverse :** *« il ne faut pas
commencer à modifier les autres rubriques. L'IBAN et le SIRET, c'est des choses
que l'utilisateur va devoir renseigner dans la bonne catégorie. Une fois que
c'est enregistré, il faut que ça s'ajoute automatiquement à la page du devis,
mais c'est tout. Rien de plus, rien de moins. »*

**Ce qu'il refuse n'est pas le garde-fou, c'est le PÉRIMÈTRE.** Les réglages
alimentent le devis ; ils ne commandent pas ce que l'écran d'envoi a le droit de
faire. Un lot parti des réglages qui finit par modifier le parcours d'envoi est
un lot qui a débordé, quelle que soit la qualité de ce qu'il ajoute.

**Ce qu'il demande existe déjà, et c'est vérifié dans le code** —
`getOuCreerDevisBrouillon` (`src/server/repositories/devis.ts`) recopie
`entreprises` dans le devis : nom, adresse, SIRET, e-mail, téléphone, IBAN. Et
**un brouillon rafraîchit sa copie à chaque ouverture** : un SIRET saisi ce soir
apparaît sur le devis dès qu'on le rouvre. Seuls les devis DÉJÀ ENVOYÉS gardent
ce qu'ils portaient — c'est voulu, une pièce comptable ne se réécrit pas (§94).

**Ce qui a été retiré, intégralement :** la règle pure qui listait les manques,
le blocage `identite_incomplete` de `preparerEnvoi`, le refus de
`envoyerAuClientAction`, la liste des manques sur l'écran d'envoi, et leurs
suites. `test-preparation-envoi.ts` retrouve son entreprise minimale.

**Ce qui reste vrai et n'a pas bougé :** un devis part toujours sans SIRET si le
patron n'en a pas saisi, et **rien ne l'en avertit**. C'est un risque assumé par
lui, en connaissance de cause — l'argument lui a été donné (un devis fige son
émetteur, le corriger ensuite ne rattrape rien) et il a tranché. Ne pas le
rouvrir sans qu'il le demande.

**Ce qui n'a PAS été touché, et c'est délibéré** : le message qui part chez le
client dit toujours « Bonjour <nom> » (`src/lib/message-client.ts`). Changer la
façon dont ses clients sont abordés est un geste qui lui appartient, et il ne
l'a pas demandé.

---

---

## 98. La chaîne se lit à l'envers : on repart du plus avancé

**Son défaut, le 13 août 2026 :** *« il n'y a pas de mémoire dans les actions.
J'étais en train de rédiger le devis, [...] j'ai fait retour sans faire exprès.
Si maintenant je reclique sur mon chantier, je suis obligé de refaire toutes les
étapes une à une, alors que j'étais déjà arrivé à la toute fin, il ne me
manquait plus qu'à envoyer le devis. »*

### Ce qui se passait, et pourquoi ce n'était pas un défaut d'enregistrement

**Rien n'était perdu.** `devisGenereAt` n'est jamais remis à zéro, et son devis
était bien en base. Ce qu'il avait perdu, c'était **sa place** — et le pire des
deux, parce que rien ne le lui disait.

`getNextAction` et `getStatutAffiche` lisaient la chaîne **depuis le début** et
s'arrêtaient au premier maillon manquant :

```
informations ? → non → photos ? → non → « Ajouter des photos »
```

Or il avait rédigé son devis **à la main**, sans passer par l'écran
« Informations » : `informationsVerifieesAt` était donc resté vide. La fiche
d'un chantier dont le devis n'attendait plus que son envoi proposait donc
« Ajouter des photos », et la liste l'annonçait **« Brouillon »**.

**Reproduit et vu à l'écran avant d'être corrigé** : le devis était bien là,
rangé dans le tiroir sous « généré, non envoyé », pendant que l'écran invitait à
dicter un chantier déjà chiffré.

### La règle qui remplace : le premier jalon FRANCHI commande

Les deux fonctions parcourent désormais la chaîne **à l'envers**, du plus avancé
au plus ancien. Ce qui manque en amont ne ramène plus personne au départ.

| Jalon franchi | Ce qui reste à faire |
|---|---|
| planifié | rien |
| devis envoyé | planifier le chantier |
| **devis généré** | **envoyer le devis au client** |
| prix validé | préparer le devis |
| informations vérifiées | calculer le prix |
| note vocale | vérifier les informations |
| photos | enregistrer une note vocale |
| rien | ajouter des photos |

**Sauter des étapes n'est pas une anomalie, c'est la voie normale** depuis que la
chaîne va de la dictée au devis d'un seul geste — et depuis qu'on peut rédiger
son devis entièrement à la main. Une règle qui lit depuis le début punit
exactement les chemins que le produit encourage.

La règle qui existait déjà — « une fois les informations vérifiées, supprimer la
note vocale ne doit pas ramener à la dictée » — n'est pas supprimée : elle
devient un **cas particulier** de celle-ci, qui la généralise à tous les jalons.

### Un état manquait, et son absence mentait

`devis_pret` — « Devis prêt à envoyer ». Sans lui, `getStatutAffiche` sautait de
`devisEnvoyeAt` à `informationsVerifieesAt` : un devis écrit mais pas parti
n'avait **aucun état à lui** et retombait sur « Brouillon », c'est-à-dire « rien
n'a été fait ». C'est ce que le patron a lu sur sa propre liste.

**`devisGenereAt` est devenu OBLIGATOIRE dans `EtatPourStatutAffiche`**, à
rebours de la convention du fichier (les ajouts y étaient facultatifs pour ne
pas casser les anciens appels). La raison : un appelant qui l'oublierait
rejouerait le défaut en silence. Le compilateur a d'ailleurs immédiatement
désigné le coupable — `src/app/page.tsx`, l'écran de sa capture : **la liste des
chantiers ne lisait même pas ce jalon**.

### Ce qu'il demandait vraiment : ne plus repasser par la fiche

**Le premier correctif traitait le mauvais symptôme.** Ce qui précède est un vrai
défaut — la fiche mentait sur l'état et sur l'étape — mais ce n'était pas sa
demande. Il l'a redite, plus précisément : *« il faut absolument que si je me
suis arrêté à l'étape d'envoyer le devis, si je fais retour et que je retombe
sur la catégorie chantier puis que je reclique sur mon client en attente, que ça
me renvoie à l'étape où je me suis arrêté. [...] Si je me suis arrêté à mettre
des photos et à rédiger la note vocale, il faut que ça me remette à cette
page-là. Et ainsi de suite. »*

Il ne veut pas que la fiche dise mieux. **Il veut ne plus y repasser.**

`lienDeReprise` porte cette règle : la liste des chantiers ne mène plus à la
fiche, mais **à l'écran où le travail s'est arrêté**.

| Où il s'est arrêté | Où la ligne le ramène |
|---|---|
| rien, ou des photos, ou une dictée | la fiche — **la pellicule et l'anneau y sont** |
| informations vérifiées | l'écran du prix |
| prix posé, ou devis écrit | **l'écran d'envoi** |
| devis parti, chantier planifié | la fiche — il n'y a rien à reprendre |

**Bâtie SUR `getNextAction`, jamais à côté.** Deux règles pour une même question
finiraient par se contredire : la fiche proposerait un geste et la liste en
ouvrirait un autre. Un contrôle tient cette promesse
(`test-reprendre-ou-il-en-etait.ts`).

**Le planning général n'est pas un écran de reprise**, et c'est le seul endroit
où l'on s'écarte de l'étape suivante : y envoyer quelqu'un qui touche SON
chantier l'éloignerait au lieu de l'y ramener.

**Et la fiche reste à un doigt** : la flèche de retour de chaque écran y mène.
Reprendre au bon endroit ne ferme aucune porte — un contrôle navigateur le
vérifie, sur sa séquence exacte, retour par mégarde compris
(`test-reprise-chantier-e2e.ts`).

### Ce qui reste ouvert, et qui ne se décide pas ici

Le corps de la fiche continue d'afficher l'anneau de dictée — « Appuyez et
décrivez le chantier » — sur un chantier dont le devis est écrit. **Il a dit de
ne pas y toucher** (« ne touche pas au centre en fait »), et la maquette
`maquettes/atlas-centre-de-la-fiche.html` reste au placard : elle n'a rien
changé dans `src/`. Le sujet peut se rouvrir un jour ; il n'est pas ouvert
aujourd'hui.

---

---

## 99. La saisie de « Mon entreprise » : quatre demandes, et ce qu'elles cachaient

**Le 14 août 2026, capture de son écran à l'appui**, le patron demande quatre
choses sur l'écran d'identité : l'adresse qui propose comme chez le client, un
téléphone avec drapeau et espacement automatique, la forme juridique en liste,
et un bouton d'enregistrement. Planche `maquettes/atlas-identite-saisie.html`.

### L'adresse n'était pas un développement, c'était un oubli

`ChampAdresse` existait depuis le 7 août et n'avait **jamais été posé sur cet
écran-ci** : le patron saisissait son propre siège à la main pendant que ses
clients avaient la liste. Le composant a reçu une **seconde apparence**
(`apparence="ligne"`) au lieu d'être recopié — la règle des suggestions (ne pas
interroger à chaque lettre, se taire quand le réseau tombe, ne jamais enfermer
la saisie) reste écrite une seule fois (`CLAUDE.md` §3).

### Le téléphone : deux pièges, et le second est invisible ici

`src/lib/telephone.ts`, fonction pure, éprouvée sans navigateur.

1. **L'espacement français n'est pas universel.** « 06 79 98 45 14 » en France,
   « 0471 12 34 56 » en Belgique, « 912 345 678 » au Portugal. Écrire un numéro
   belge à la française le rend méconnaissable à son propriétaire. Chaque pays
   porte donc sa découpe.
2. **Le zéro de tête disparaît devant l'indicatif.** « +33 06 79 … » est
   *injoignable* depuis l'étranger, et c'est la faute la plus fréquente sur les
   documents. La découpe est donc définie **sans le zéro**, et le national le
   recolle au premier groupe. Une table par affichage aurait divergé.

**Rien n'est stocké de neuf.** Le numéro est rangé tel qu'il s'écrit — c'est ce
qui s'imprime, et la base contient déjà des numéros. L'indicatif **n'a pas de
colonne** : il se relit du numéro. Un « + » en tête porte son pays, le reste est
français, comme depuis toujours. Aucune migration, aucun document abîmé.

**L'indicatif le plus long gagne** à la relecture : « +33 » et « +352 » se
ressemblent, et comparer dans l'ordre de la liste ferait lire un Luxembourgeois
comme un Français — donc l'espacerait selon la mauvaise règle.

### La forme juridique : « Autre » est la ligne qui compte

Dix formes, sigle **et** nom complet — « EURL » ne se retient pas, et sans son
nom il faudrait chercher ailleurs pour choisir. L'ordre suit ce qu'on rencontre
dans le bâtiment, pas l'alphabet.

**« Autre » n'est pas une valeur, c'est une issue** : elle rouvre le champ
libre. Une liste fermée finirait par exclure une société civile, une
association, un GAEC — et l'artisan exclu ne pourrait plus rien saisir du tout.

**Ce qui est déjà en base n'est jamais écrasé** : « Sas », « S.A.S », « sasu »
retrouvent leur entrée (comparaison sans casse ni points), et ce que la liste
ignore reste affiché sous « Autre ». Sans cela, le patron aurait vu sa saisie
disparaître.

### Le bouton d'enregistrement DIT l'état, il ne crée pas un second mécanisme

**Son choix, planche en main : « A ».** Les champs s'écrivent déjà seuls en
quittant la ligne — c'est ce qui protège une saisie interrompue par un chantier.
Un bouton qui prétendrait « sauver » par-dessus donnerait **deux vérités**, et
il croirait perdre ce qui est déjà écrit. Le bouton porte donc « Enregistrer »
tant qu'une frappe attend le serveur, puis « Enregistré ✓ ».

**Il ne se déclare écrit que sur accord du serveur** : vider la liste des
changements sur un refus afficherait « Enregistré » au-dessus d'une valeur
perdue.

**Et il se pose sur `--atlas-barre`, jamais sur un nombre écrit à la main.** La
hauteur de la barre du bas comprend `env(safe-area-inset-bottom)` : nulle sur un
ordinateur, une vingtaine de pixels sur un iPhone à encoche. Un `bottom-[76px]`
aurait recouvert les onglets chez lui et nulle part ici — le pire des défauts,
invisible là où on le cherche.

### Ce que la capture a révélé sur elle-même

`capture-identite.mts` vidait l'identité pour montrer l'écran du premier jour
**et ne la rendait pas**. Deux prises de suite ont donc affiché « SIRET —
manquant » sur un jeu de démonstration complet, et j'ai failli chercher le
défaut dans l'écran. Elle restaure désormais ce qu'elle a vidé : une capture qui
laisse la base modifiée fait mentir la suivante.

### Les équipes, cherchées là où elles n'étaient plus

**Le 14 août au soir, le patron :** *« les équipes n'apparaissent plus,
pourquoi ? Faut les rajouter dans la catégorie équipe aussi. »* Deux causes
sans rapport, et la première est la mienne.

**Dans les réglages.** Le matin même, le sommaire (§96) avait rangé le bloc des
équipes sous « Planning ». Le raisonnement tenait — ici « équipe » désigne une
FILE DU PLANNING, pas un compte (§88) — mais **il ne tient pas devant l'usage** :
il les a cherchées sous « Équipe », et c'est là qu'elles doivent être. Le même
composant est servi aux deux adresses ; deux listes qui divergeraient seraient
deux vérités sur le nombre de chantiers qui partent le même jour.

**Sur le planning, rien n'était cassé.** À une seule équipe, aucun nom ne
s'écrit : c'est sa règle du 10 août, et elle est juste — il n'y a personne à
distinguer. Mais une règle oubliée ressemble à une panne. L'écran « Équipe » la
dit désormais : *« Les noms apparaissent à partir de deux. »*

**Ce que cela apprend, et qui vaut pour les rangements à venir :** une rubrique
peut être logiquement bien placée et introuvable quand même. Le libellé de
« Équipe » promettait par ailleurs « Utilisateurs, rôles et permissions » —
trois choses qui n'existent pas. Il dit maintenant ce qu'on y trouve.

---

## 100. Affilier une équipe à un chantier déjà posé, sans toucher à sa date

**Le patron, le 14 août 2026** (planche `maquettes/atlas-planning-equipe.html`,
approuvée) : *« on devait pouvoir affilier une équipe à un chantier ajouté au
planning une fois que le client a validé le devis »*.

**Le geste existait à moitié.** `planifierChantier` choisit déjà l'équipe — mais
seulement au moment de poser le chantier sur un jour. Or **un chantier que le
client a validé est justement celui qu'on ne veut plus déplacer** : changer
d'équipe passait donc par un changement de date, c'est-à-dire par un mensonge au
client. `changerEquipeChantier` ne touche ni au jour, ni à la demi-journée, et
l'écran le promet en toutes lettres.

### Le refus porte sur les CRÉNEAUX, pas sur le jour

Deux chantiers d'une demi-journée tiennent sur la même équipe le même jour —
l'un le matin, l'autre l'après-midi. Un chantier d'une journée entière, non :
il occupe les deux. La comparaison se fait donc créneau par créneau, et le
chantier courant est exclu du décompte, sinon **se remettre sur sa propre équipe
se refuserait lui-même**.

**`EquipeIndisponible` est distinct de `CreneauIndisponible`**, et les confondre
serait une erreur qui accuse à tort : le premier dit que CETTE équipe est prise,
le second que l'entreprise entière est pleine. Le patron lirait « aucune place ce
matin » devant un planning à moitié vide et chercherait du mauvais côté.

**Une suite a rougi, et elle avait raison** : elle posait deux chantiers sans
durée et s'attendait à ce que l'après-midi reste libre. Sans durée dictée, un
chantier occupe la **journée entière** (`DUREE_PAR_DEFAUT_DEMI_JOURNEES` vaut 2).
C'est le test qui se trompait. Le contrôle inverse a été ajouté pour que le
premier ne passe pas par hasard.

### La ligne du planning, ramenée de 24 px

Sa seconde demande : *« il faut déplacer d'un cm le "Déplacer" avec le chevron
vers la gauche, le chevron doit être légèrement plus gros aussi »*. Le carré
touchable passe de `-mr-[26px]` à `-mr-[2px]` — il tombait jusqu'au bord de
l'écran — et le signe de 17 à 21 px.

**Les 44 px du carré ne bougent pas.** Grossir le signe ne doit pas rétrécir la
cible : on la rate deux fois sur trois avec des gants, et il le rapporterait
comme « ça ne marche pas ».

**Ces 24 px sont pris à la colonne du nom**, et c'est le piège que le code notait
depuis le 12 août : à 390 px, « Chez M. Bernard » devenait « Chez M. … ». Le
contrôle de la planche mesure donc l'écart ET vérifie qu'aucun nom n'est coupé.
La ligne s'est allégée entre-temps — « Créer la facture » est parti dans la
feuille — ce qui rend la place disponible.

---

## 101. L'unité d'un tarif se choisit, et la case reste libre

**Sa demande, le 13 août 2026**, capture des tarifs à l'appui : *« crée-moi un
bandeau déroulant avec infos à choisir, jours/hommes, m² etc. »* Deux formes ont
été dessinées (`maquettes/atlas-unite-deroulante.html`) ; il a répondu *« fais
celle-là »* devant la **forme 1**, le bandeau qui se déplie.

### Ce que la case libre coûtait, et qui ne se voyait nulle part

L'unité n'est pas décorative. C'est elle qui autorise la multiplication par une
quantité confirmée au moment du chiffrage (`proposition-prix.ts`), et c'est elle
— **elle seule** — qui désigne un tarif de main d'œuvre : le rapprochement par
intitulé ne trouve rien entre « Main d'œuvre (jour/homme) » et « Abattage d'un
cèdre mort », d'où `tarif-main-oeuvre.ts` (§ du 7 août 2026).

Or ce rapprochement se fait **sur le texte, à la lettre près**. « jour/homme »
est reconnu ; « jours/homme » ne l'est pas. Une faute de frappe ne produit donc
aucune erreur : elle produit un tarif qui cesse d'être trouvé, **en silence**,
sur un devis qui part chez le client. « m2 », « m² », « M2 » sont trois unités
distinctes pour la machine.

### Ce qui ne se discute pas : la liste ne ferme rien

Un élagueur a des unités qu'aucune liste ne devinera — le stère, l'arbre, la
tonne de grumes. Le bandeau se termine donc par une ligne libre. Enfermer le
choix lui **retirerait ce qu'il a aujourd'hui** : un recul déguisé en confort,
et le seul vrai risque de ce lot. `test-unites-tarif.ts` et la suite navigateur
montent la garde dessus, chacune de son côté.

### Deux corrections que la maquette ne pouvait pas voir

**« forfait — ne se multiplie pas » était FAUX.** La maquette le disait ainsi ;
le code ne le tient pas — un forfait porté par une quantité confirmée se
multiplie comme les autres. L'écran aurait installé une croyance que le produit
dément. Ce qui ne se multiplie jamais, c'est un tarif **sans** unité : d'où la
ligne « Aucune unité — le tarif est repris tel quel », qui rend au passage un
geste qui manquait (le champ est facultatif, et rien ne pouvait le vider).

**Le bandeau ne peut PAS être posé en surimpression sur la carte.** La maquette
le dessinait ainsi ; impossible ici. La carte d'un tarif vit dans un
`LigneRetirable`, dont l'enveloppe masque ce qui dépasse (`.atlas-ligne
{overflow:hidden}`) pour pouvoir se refermer au retrait, et dont la colonne du
texte est une zone qui défile (`.atlas-glisse {overflow-x:auto}`). Posé dedans,
il est **tranché aux deux bords** — mesuré : coupé à 504 px quand il en
demandait 863, les trois dernières unités hors d'atteinte.

D'où la séparation en deux pièces (`ChoixUnite.tsx`) : `CaseUnite` dans la
carte, `BandeauUnites` juste en dessous, **hors** de l'enveloppe. L'autre voie —
relever la hauteur de repli de la ligne pendant l'ouverture — a été essayée et
écartée : cette hauteur s'anime (0,44 s après 0,2 s d'attente), le bandeau se
serait dévoilé par le haut une demi-seconde après le doigt.

### Et une troisième, trouvée sur une capture

Un tarif se règle en bas de la liste aussi souvent qu'en haut. Le bandeau
s'ouvrait alors **sous le bord de l'écran** : toucher la case ne montrait rien,
le geste paraissait sans effet. Il se fait donc venir tout seul
(`scrollIntoView`), avec une marge basse de 96 px — sans quoi la barre de
navigation, posée par-dessus la page, recouvre la ligne libre : celle qui sert
justement à écrire son unité à soi.

### Une exception à la capsule, et pourquoi elle est légitime

`test-boutons-arrondis.ts` a dénoncé la case de l'unité : c'est un `<button>`,
et la charte veut la capsule sur les boutons. **L'exception a été nommée plutôt
que la forme changée**, parce que la charte elle-même tranche dans ce sens :
« elle ne donne la capsule qu'à ce qu'on APPUIE, jamais à ce qu'on remplit ». La
case est un **champ** — elle se tient dans la même grille que « Prix (€) » et
porte ses 4 px comme lui ; en capsule, elle serait le seul galet d'une rangée de
champs droits.

Elle est écrite en `<button>` et non en `<input>` parce que sa valeur se
**choisit** : c'est ce que la balise doit dire à qui n'emploie pas ses yeux. La
forme et la balise ne se commandent pas l'une l'autre.

Ce que l'exception coûte : elle porte sur le fichier entier, donc un vrai bouton
d'action écrit un jour dans `ChoixUnite.tsx` ne serait plus dénoncé.

### Ce qui est éprouvé, et par quoi

| Ce qui est tenu | Où |
|---|---|
| « jour/homme » proposé EST celui que le chiffrage reconnaît | `test-unites-tarif.ts` |
| « m2 » n'est pas confondu avec « m² » | `test-unites-tarif.ts` |
| le stère, l'arbre, la tonne restent écrivables | les deux suites |
| le bandeau n'est pas tranché par l'enveloppe | `test-unite-tarif-e2e.ts` |
| il ne passe pas sous la barre basse (sur SON écran, 390 × 664) | `test-unite-tarif-e2e.ts` |
| le choix arrive en base et survit au rechargement | `test-unite-tarif-e2e.ts` |

**Ce qui n'est PAS fait, et c'est délibéré :** les unités déjà saisies ne sont
pas corrigées. « m2 » enregistré reste « m2 ». Réécrire ses données à son insu
pour les faire entrer dans notre liste changerait des prix sans qu'il l'ait
demandé.

---

## 102. Les conditions du devis : réglées au lieu d'être en dur, et FIGÉES

*Dessiné le 13 août 2026 (`maquettes/atlas-reglages-documents.html`), codé le
14. Rubrique « Devis & factures », migration `0040`.*

**Ce que ça remplace.** `const VALIDITE = "30 jours"` — une constante de
`devis-pdf.ts`, la même pour tous les artisans, qu'aucun écran ne montrait. Un
couvreur qui tient ses prix quinze jours envoyait un devis qui l'engageait
trente.

### La validité est RECOPIÉE dans le devis, pas relue

C'est le point qui compte, et il n'était pas évident : lire le réglage au moment
de composer le PDF ferait **changer la durée d'engagement d'un devis déjà
envoyé**, simplement parce que l'artisan a corrigé ses réglages entre-temps —
pendant que le client a une autre feuille sous les yeux. `devis.validite_jours`
se remplit à la création, comme l'identité (§94). Le rattrapage pose 30 sur les
devis existants : c'est ce que la constante écrivait, donc ce qu'ils disaient.

### « Jamais réglé » et « éteint » ne sont pas la même chose

Une colonne nulle veut dire **éteint** — rien ne s'imprime. Une colonne absente
de la lecture veut dire **jamais réglé** — le défaut d'Atlas s'applique. Les
confondre remettrait « 30 jours » sur le devis d'un artisan qui l'a délibérément
retiré. `lireConditions` distingue `null` de `undefined` pour cette seule
raison.

**Aucune colonne « actif » à côté de chaque nombre**, et c'est délibéré : deux
champs pour une seule idée finissent par se contredire — un acompte à 30 % et un
interrupteur éteint, et plus personne ne sait ce qui s'imprime.

### On borne, on ne refuse pas

Une saisie hors bornes vient d'un doigt qui a glissé, pas d'une intention.
Refuser laisserait le champ vide, donc le réglage **éteint** — l'inverse de ce
qu'il voulait. Les bornes sont posées **aussi en base** (`CHECK`) : une adresse
d'action se tape, et un acompte de 4 000 % s'imprimerait sur un document que le
client garde.

### Ce qui ne se coupe pas, dit là où on le chercherait

Sa règle du 13 août : des interrupteurs *« seulement à celles où la
désactivation n'entraîne pas de problème juridique ou moral »*. Les mentions
légales de la FACTURE — pénalités au taux légal, indemnité de 40 €, franchise de
l'art. 293 B — restent écrites en dur dans `facture-pdf.ts`. L'écran porte la
ligne, marquée « Obligatoire », **dans la même liste** : c'est là qu'il
chercherait le bouton, et c'est donc là que la réponse doit être.

### Une seule rédaction pour l'aperçu et pour le PDF

`lignesConditionsDevis` sert aux deux. Deux rédactions finiraient par diverger,
et c'est le client qui lirait la mauvaise. **L'aperçu ne porte aucun montant** :
le total d'un devis à venir n'existe pas, et un chiffre inventé là finirait
imprimé — le même piège que le « soit 1 044 € » retiré de la planche le 13 août.

### Ce qui reste à faire, et qu'il ne faut pas croire acquis

**Seule la validité atteint le PDF pour l'instant.** L'acompte, le délai, les
moyens de paiement, le rappel des pénalités et le texte de pied sont réglés,
enregistrés et montrés en aperçu — mais ils ne s'impriment pas encore : ils
doivent d'abord passer par le même figement que la validité, sans quoi corriger
un réglage réécrirait les conditions d'un devis déjà parti. C'est le lot suivant.

---

## 103. « Surtout la page équipe » : une liste de préchauffage qui avait vieilli

**Son signalement du 14 août 2026 :** *« La connexion est au ralenti sur
l'appli. Les nouvelles pages ne chargent mal ou pas du tout. »* Puis, à la
question de savoir lesquelles : ***« Surtout la page équipe. »***

**Sa précision était exacte, et c'est elle qui a désigné le défaut.** Rien
n'était lent « en général ».

### Ce qui se passe pendant qu'un banc bâtit

Quand le code change, `scripts/banc.mjs` sert d'abord en mode développement et
construit la version rapide à côté (§ *servir d'abord, bâtir ensuite*). En mode
développement, un écran n'est compilé **qu'au moment où on l'ouvre**. Mesuré ici,
sur quatre cœurs au repos, en première ouverture :

| Écran | À froid | Ensuite |
|---|---|---|
| Connexion | 6,6 s | — |
| Planning | 2,8 s | 0,6 s |
| Réglages | 1,9 s | 0,2 s |
| Terminés | 1,8 s | 0,3 s |
| TVA | 1,4 s | 0,2 s |

Sur ses **deux** cœurs, avec la construction qui les occupe, ces secondes
deviennent des dizaines — au-delà de la minute que le relais de GitHub accepte
d'attendre. D'où la règle qui décide tout : **un écran déjà ouvert répond ; un
écran ouvert pour la première fois peut ne jamais arriver.**

C'est précisément ce que `prechauffer.mjs` existe pour éviter : il ouvre les
écrans depuis l'intérieur, où rien n'abandonne, pour que le patron n'ait plus à
payer cette première fois.

### Le défaut : une liste écrite à la main, et une refonte ailleurs

`ECRANS_A_PRECHAUFFER` nommait `/reglages`, `/reglages/agenda`,
`/reglages/prix`, `/reglages/vocabulaire`. Entre-temps, Réglages a été **découpé
en sept sous-écrans** (§96) : `identite`, `equipe`, `tarifs`, `documents`,
`planning`, `ia`, `donnees`. **Aucun des sept n'était préchauffé.**

Il ouvrait donc « Équipe » à froid, pendant la construction, et la page
n'arrivait pas. Sa phrase désignait le seul écran que la liste ne connaissait
pas.

**Et rien ne pouvait rougir.** Une liste écrite à la main ne se met pas à jour
quand on ajoute un écran ailleurs ; le seul symptôme est une page qui ne s'ouvre
pas, chez lui. `scripts/test-prechauffage.ts` la confronte désormais aux
dossiers réellement présents sous `src/app/reglages` et refuse qu'un sous-écran
y manque. Confronté au défaut — `/reglages/equipe` retiré — il nomme l'écran :
*« jamais compilé(s) d'avance, donc hors d'atteinte sur son banc :
/reglages/equipe »*.

### Ce qui manquait aussi : une phrase

Depuis son téléphone, **rien ne distingue « ça bâtit » de « c'est en panne »**.
Le seul endroit qui le savait était le terminal de l'éditeur — celui où il ne va
pas : *« Va regarder toi-même, je peux pas te l'envoyer »* (9 août 2026).

Un bandeau le dit désormais, en haut de l'écran, avec le compte :
« Version rapide en construction — 12 écrans sur 19 déjà prêts. » Retenu sur
maquette (`docs/maquettes/46`, proposition A). Il est **dans le flux** — il
pousse le contenu de quarante pixels au lieu de le couvrir, trois défauts réels
de ce dépôt venant d'éléments flottants qui cachaient un geste — et il
**s'efface tout seul** dès que tout est prêt.

**Le chiffre existait déjà et n'était écrit nulle part.** `prechauffer.mjs`
portait un rappel `avancer` depuis le 9 août, `/api/health/banc` savait lire le
fichier qu'il devait produire — et **personne ne le lui passait**. La page de
diagnostic répondait « le préchauffage n'a pas encore commencé » du début à la
fin. Une fonction prévue, documentée, éprouvée, et jamais branchée : une ligne
manquait.

### Ce qui a été essayé, mesuré, et ÉCARTÉ

Faire bâtir en priorité basse (`nice -n 19`), pour que la construction cesse de
disputer ses deux cœurs au serveur. Éprouvé en bornant les deux processus à deux
cœurs :

| | Priorité normale | Priorité basse |
|---|---|---|
| Connexion | 16,2 s | **17,4 s** |
| Planning | 3,8 s | 3,6 s |
| Réglages | 3,3 s | 3,3 s |
| La construction elle-même | 69 s | 67 s |

**Aucun gain.** La contention n'est pas le processeur mais le disque — que
Next.js signale lui-même comme lent sur ces machines. L'idée était plausible et
fausse ; elle n'est pas livrée. Une réparation supposée présentée comme acquise
coûte au patron l'essai, puis l'aller-retour (`AGENTS.md`).

---

## 104. « Modifier », en or, en face du titre — et seulement avant l'envoi

**Le patron, le 13 août 2026, capture à l'appui :**

> *« J'ai un devis sur le feu. En cliquant sur Mme Félicie, voilà où j'arrive,
> mais si je veux modifier mon devis avant de l'envoyer, je peux pas. Fais en
> sorte qu'en cliquant sur le mot devis en haut à gauche j'arrive sur la page de
> mon devis pour la modifier. Crée-moi des visuels avant de coder, et il faut
> que ce soit intuitif. »*

### Le trou, et pourquoi personne ne l'avait vu

`ExportClient` offrait « Modifier mon devis » — mais sur `EcranDevisParti`,
c'est-à-dire **après** l'envoi. Avant, aucun chemin ne menait d'ici à
`devis-complet`. Le seul moyen d'y arriver était de repasser par la création
d'un chantier.

Le défaut se cachait derrière une symétrie apparente : les deux moments du même
écran se ressemblent assez pour qu'on croie qu'ils portent les mêmes gestes.

### Cinq propositions, et pourquoi ce n'est pas la sienne qui a été codée

`docs/maquettes/45-modifier-son-devis.html`, dessinées avant tout code
(`CLAUDE.md` §3 bis). Sa première idée — le mot « Devis » lui-même cliquable —
y figure telle qu'il l'a dite, avec la seule chose qui la rende trouvable : un
crayon et un filet d'or. **Un titre qui est secrètement un lien ne s'annonce
pas.**

Il a tranché après avoir vu les cinq : *« le modifier en or à droite du mot
devis est parfait, code celui-là »*. C'est la B.

### Ce qui tient le dessin, et qu'un `items-start` défait sans rien casser

L'action passe par `EnTeteEcran` (`action`, `actionPlacee="titre"`), qui
existait déjà. Mais cet en-tête aligne ses enfants **par le haut**, où se trouve
le surtitre : sans `self-end`, le mot se poserait à côté de « MME FÉLICIE » et
non sur la ligne d'écriture du titre. Rien ne rougirait — c'est pourquoi sa
suite **mesurait** les deux rectangles.

> **CADUC depuis le 20 août 2026 (§136).** Ce lien ne s'affichait que sur un
> devis NON parti ; or cet écran n'est plus atteignable dans ce cas — il renvoie
> au devis. Le lien a donc été retiré, et sa suite supprimée. Le trou qu'il
> bouchait ne peut plus se rouvrir : avant l'envoi, l'écran EST le devis
> modifiable.

### Et la règle qui compte plus que la place du mot

**Le lien n'existe qu'avant l'envoi** (`devisRow.statut === "envoye" ? null`).
Un devis parti ne se modifie plus : le déclencheur
`empecher_modification_devis_envoye` refuse la première frappe. Il se
**reprend**, ce qui ouvre une nouvelle version, et c'est un geste que le patron
décide (§66) — l'écran d'après l'envoi le porte déjà sous son propre libellé.
Offrir « Modifier » là mènerait à un document mort, sans dire pourquoi.

Le rafraîchissement est déjà là : `onEnvoye` appelle `router.refresh()`, donc
l'en-tête rendu côté serveur perd son lien dès l'envoi, sans rechargement.

**Le contrôle a été confronté aux deux états dégradés** — lien absent, puis lien
survivant à l'envoi — et il rougit sur chacun, en nommant le bon coupable. Il
vérifie aussi que l'écran d'après l'envoi garde SON geste : sans cela, on
passerait au vert en retirant le lien partout, et le patron n'aurait plus
d'issue du tout.


## 105. Ses tranches et ses travaux, au lieu des nôtres

**Sa demande, le 14 août 2026**, capture de l'écran « Mes prix » à l'appui :
*« je dois pouvoir ajouter ou retirer des cases. »* Trois formes ont été
dessinées (`maquettes/atlas-grilles-cases.html`) ; sa réponse : *« code les
toutes »*. Les trois sont donc en place, et elles ne se remplacent pas.

### Le fait qui commande tout le reste

**Une case ne s'ajoute pas toute seule.** Elle naît du croisement de deux
tranches. Ajouter un diamètre — « 90 à 120 cm » — n'ajoute pas une case : elle
en ajoute **dix** (1 pour dessoucher, 3 pour abattre, 6 pour fendre). En retirer
une en range autant.

C'est pourquoi le geste n'existe pas au niveau de la case, mais à trois niveaux :
la **tranche** (une mesure), la **façon de faire** (une rangée d'abattage), le
**travail** (une grille entière). Et c'est pourquoi l'écran **annonce le nombre
avant de valider** : dix cases posées sans prévenir, ce sont dix questions
surprises au chantier suivant. Le nombre est calculé (`casesParTranche`), jamais
écrit à la main — un nombre faux y serait pire que pas de nombre du tout.

### Ce qui a changé dans le code

Les huit diamètres, six hauteurs, trois façons et cinq travaux étaient des
constantes de `src/lib/grille-prix.ts`. Ils y restent, **comme point de départ**,
et deux tables portent ce qu'une entreprise a réglé : `tranches_grille` et
`natures_grille` (migration 0041).

**Le paramètre `axes` est OBLIGATOIRE**, et c'est délibéré : une valeur par
défaut silencieuse aurait chiffré un devis contre les tranches d'origine pendant
que le patron remplissait les siennes. Le compilateur oblige chaque appelant à
dire quelles tranches il emploie — c'est ainsi que `proposition-prix.ts`,
`apprendre-grille.ts` et `questions-chiffrage.ts` ont été repris un par un.

**La question d'abattage propose SES façons**, et plus les trois d'origine. Elle
les écrivait une seconde fois dans `questions-chiffrage.ts` : sa quatrième
rangée serait restée vide pour toujours, la case existant sans que rien ne
puisse la désigner. C'est la règle dupliquée que `CLAUDE.md` §3 interdit.

### Rien n'est semé, et le premier geste recopie

Une entreprise qui n'a jamais rien touché **n'a aucune ligne** : ce sont les
valeurs de départ du code qui servent. Les écrire à la migration les aurait
figées une seconde fois — corriger une borne d'origine aurait demandé une
migration de plus pour la porter à ceux qui n'y avaient jamais touché.

Les lignes n'apparaissent qu'au **premier geste sur un axe** : on recopie alors
les tranches de départ, puis on applique le geste. **Sans cette recopie, son
premier ajout aurait effacé les huit autres** — un axe sans ligne veut dire
« les tranches de départ », et y insérer une seule ligne le ferait basculer sur
« une seule tranche, la sienne ». `test-cases-reglables-db.ts` monte la garde
sur ce point précis.

### Retirer n'efface JAMAIS un prix

C'est la promesse du lot, et la seule qui coûterait vraiment cher : ces prix
sont ses décisions, et certains viennent de devis réels que rien ne
reconstituerait.

Une tranche retirée porte `retiree_le` ; sa ligne reste. Les cases de
`grille_prix` restent en place — une clé qu'aucune tranche ne reconnaît est
ignorée à la lecture, jamais supprimée (`lireGrillePrix`, comportement antérieur
à ce lot). Remettre la tranche fait revenir les prix tels quels, et **c'est ce
retour qui prouve qu'ils n'ont pas été effacés** : la suite base le vérifie
ainsi, plutôt qu'en interrogeant la table — le rôle applicatif ne traverse pas
la RLS, et c'est exactement ce qu'on veut de lui.

**La clé ne peut pas être réemployée.** Si la ligne partait, une tranche neuve
pourrait reprendre `d90` et hériter du prix d'une tranche qui n'était pas la
sienne : 1 400 € posés pour « plus de 90 cm » se retrouveraient sur des troncs
de 90 à 120 cm sans que personne ne l'ait décidé.

### Deux refus, et pourquoi ils sont des réponses

**Le recouvrement.** `trancheDe` retient la PREMIÈRE tranche qui contient la
mesure : deux tranches qui se chevauchent ne produisent pas une erreur, elles
produisent un prix pris dans la mauvaise case. Un tronc de 95 cm chiffré au
tarif des 20 cm ne se voit sur aucun écran — il se voit sur le devis du client.

**La dernière tranche est ouverte**, et c'est le cas de tous les jours : « plus
de 90 cm » n'a pas de borne haute, donc tout ce qui dépasse 90 y tombe déjà, et
aucune tranche plus haute ne peut s'ajouter tant qu'elle est là. Le refus le dit
**et dit quoi faire** : retirer d'abord, reposer ensuite. On ne repousse pas sa
borne à sa place — un prix posé pour « plus de 90 cm » deviendrait celui des
« plus de 120 cm » sans qu'il l'ait décidé.

### La limite d'un travail ajouté, dite plutôt que découverte

`proposition-prix.ts` sait retrouver un abattage ou une fente dans une dictée ;
il ne sait pas retrouver « le broyage des branches ». Une nature ajoutée par le
patron **n'est pas reconnue par le chiffrage** : sa grille se remplit et se
relit, mais Atlas ne la proposera pas de lui-même. L'écran l'écrit sous le titre
du travail — le lui laisser découvrir sur un devis serait pire.

### Ce qui est éprouvé, et par quoi

| Ce qui est tenu | Où |
|---|---|
| deux tranches ne se chevauchent jamais, et le refus nomme la coupable | `test-cases-reglables.ts` |
| une clé retirée n'est jamais rendue à une autre tranche | les deux suites |
| le nombre de cases annoncé est le vrai, et suit ses tranches | `test-cases-reglables.ts` |
| la question d'abattage propose SES façons | `test-cases-reglables.ts` |
| le premier geste ne fait pas disparaître les huit autres | `test-cases-reglables-db.ts` |
| retirer n'efface aucun prix, et « Annuler » les rend | `test-cases-reglables-db.ts` |
| rien ne déborde d'une entreprise sur une autre | `test-cases-reglables-db.ts` |
| la conséquence est sous ses yeux avant qu'il valide | `test-cases-reglables-e2e.ts` |
| le refus lui parvient, et dit quoi faire | `test-cases-reglables-e2e.ts` |
| les trois formes existent, et l'écran repart comme il a été trouvé | `test-cases-reglables-e2e.ts` |

## 106. L'assistant cesse de flotter — et c'est l'écran qui cesse de reculer

**Le patron, le 13 août 2026 :** *« l'onglet de l'assistant est hyper mal placé,
propose des choses pour plus qu'il gêne »*. Puis, devant les cinq propositions de
`docs/maquettes/47-ou-mettre-l-assistant.html` : *« la B mais de la même couleur
qu'elle est déjà »*.

### Le vrai défaut n'était pas sa position, c'était qu'il flottait

Mesuré dans l'application, sur son écran de 390 × 664 : la bulle occupait
56 × 56 px à (318, 512) — donc, sur le planning, **par-dessus les dimanches 23
et 30**, deux cases qu'on touche pour ouvrir une journée.

Et ce n'était pas le premier écran qu'elle mordait. **Cinq fois cet été, c'est
l'ÉCRAN qu'on a déplacé pour l'éviter :**

| Ce qui a cédé | Où |
|---|---|
| « ou rédiger le devis à la main », recouvert | §49 |
| « Préparer le devis » : 64 px de talon insuffisants, il en a fallu 112 | §46 |
| un bouton de reprise, 48 px mangés dès deux lignes de message | §63 |
| une capsule qu'il a fallu **centrer** pour qu'elle lui échappe | §67 |
| « Reste à payer » calé à gauche, sa fin passant dessous | §84 |

Chaque correction était juste, et aucune n'a traité la cause. **Un élément qui
flotte finit toujours par recouvrir quelque chose** — y compris sur les écrans
qui n'existent pas encore. C'est pourquoi aucune des cinq propositions ne
consistait à le déplacer de vingt pixels.

### Le bouton part, le panneau reste

Le panneau doit toujours couvrir tout l'écran : il reste dans le gabarit racine.
Le bouton, lui, vit désormais dans l'en-tête de chaque écran. Les deux ne sont
plus voisins dans l'arbre, d'où `assistant-contexte.tsx` — vingt lignes dont la
seule fonction est de leur donner un état commun.

`useAssistant()` rend `null` hors du fournisseur au lieu de lever : le bouton est
posé par `EnTeteEcran`, une pièce que onze écrans emploient, et qu'une page hors
gabarit pourrait employer demain. Faire tomber une page entière pour un bouton
d'agrément serait un mauvais échange — et le patron n'en verrait qu'un
identifiant opaque (`HANDOVER.md`, piège 0 ter).

### Le déplacement s'est trompé une fois, et la mesure l'a dit

Le bouton a d'abord été posé **sur une ligne à lui**, au-dessus du titre. C'était
défendable : cette ligne existait déjà pour la flèche de retour, et le dépôt
avait mesuré le 11 août qu'une pastille posée à côté du titre lui prenait la
moitié de sa largeur.

**Sauf que cette ligne ajoutait 72 px en tête de CHAQUE écran.** Sur le planning,
la dernière semaine du mois passait de 626 px à 698 — sous la barre du bas. On
aurait échangé « deux jours recouverts » contre « une semaine hors de l'écran »,
et personne ne l'aurait vu sans capture.

Posé à côté du titre, il ne coûte rien : mesuré sur les quatre écrans de la
barre, **aucun titre ne se casse en deux et le calendrier finit exactement où il
finissait** (626 px). Le risque du 11 août reste réel — il tenait à une *précision*
de deux lignes sous un titre, pas au titre lui-même — et `test-assistant-en-tete-e2e.ts`
compte désormais les lignes du titre sur chaque écran.

### Ce que le contrôle a dû apprendre, et qui vaut au-delà d'ici

**Un contrôle qui dénonce un défaut préexistant sous le nom du changement en
cours envoie chercher au mauvais endroit.** Écrit d'abord « la dernière semaine
tient au-dessus de la barre », il rougissait — mais elle débordait **déjà** de
onze pixels avant qu'on ne touche à quoi que ce soit. Le repère est donc devenu
la mesure prise AVANT le déplacement, et le débordement de onze pixels est allé
dans `TODO.md`, sous son propre nom.

### Deux sessions ont visé la même ligne le même jour

Le lendemain de ce travail, la fusion avec `main` a rougi sur une suite qui
n'était pas la mienne : *« Modifier » n'est pas sur la ligne du titre : 21 px
d'écart*. Une autre session venait de poser ce mot d'or à droite du titre de
l'écran d'envoi — exactement la place que l'assistant venait de prendre.

**Ce n'était pas un conflit de texte** : `git` avait fusionné sans rien signaler.
Les deux modifications étaient justes séparément, et fausses ensemble. Leur mot
s'aligne par `self-end` — sur le BAS de son conteneur, choisi pour tomber sur la
ligne d'écriture du titre plutôt qu'à côté du surtitre. En le mettant dans un
groupe haut de 44 px pour qu'il tienne à côté du bouton, son « bas » avait changé
de sens.

`self-stretch` sur le groupe rend au repère sa hauteur d'origine. Mais la leçon
n'est pas dans le correctif :

- **une fusion propre ne prouve rien sur la mise en page.** Deux fichiers
  différents, aucun conflit, et pourtant deux gestes qui se disputent le même
  espace ;
- **c'est leur suite qui l'a dit, pas la mienne** — et elle l'a dit au pixel.
  Vingt et un pixels sur un mot d'or ressemblent à une marge : ni relecture ni
  capture ne l'auraient relevé ;
- **d'où la valeur d'un contrôle qui mesure une POSITION plutôt qu'une
  présence.** « Le lien existe » serait resté vert.

---

---

## 107. « Me déconnecter partout » sans table de sessions, et un e-mail qu'on ne peut pas encore changer

*Dessiné le 14 août 2026 (`maquettes/atlas-reglages-moi.html`), codé le même
jour sur ses deux réponses — **« A A »**. Rubriques « Mon compte » et
« Connexion », les deux dernières du sommaire (§96).*

### Ce que la planche a servi à trouver, et qui n'était pas une question de dessin

Les deux écrans sont simples. Ce qui ne l'était pas, c'est que **leur libellé
promettait deux choses qui n'existaient nulle part** :

| Le sommaire annonçait | Ce que la base porte |
|---|---|
| « Nom, e-mail et **téléphone** » | `users` : `email`, `nom`, `image`, `password_hash`. Aucun téléphone, et rien ne l'appellerait — ni SMS ni e-mail sortant (tranché le 4 août) |
| « Mot de passe et **appareils** » | `src/auth.ts` : `session: {strategy: "jwt"}`. **Aucune session en base**, donc rien à lister |

Le patron a tranché les deux fois pour le retrait : le libellé dit désormais
« Nom et e-mail », et « Mot de passe et sécurité ». **Ne pas les rouvrir sans
qu'il le demande.**

### La déconnexion générale : une colonne au lieu d'une table

Atlas ne garde aucune session : il n'y a **rien à supprimer** pour fermer une
session ouverte sur un téléphone perdu. Mais chaque jeton porte son instant
d'émission (`iat`), et il suffit de **refuser ceux qui précèdent une coupure** —
`users.jetons_valides_depuis` (migration 0042).

Trois pièces, et l'ordre importe :

1. `src/auth.config.ts` recopie `token.iat` dans `session.user.emisLe`. Sans
   cette ligne l'instant existe et reste inatteignable : `auth()` ne rend que la
   session, jamais le jeton brut ;
2. `getCurrentCtx` compare, **et c'est le seul endroit possible**. Le
   `middleware` tourne en Edge et ne peut pas lire la base ; cette fonction, en
   revanche, est la porte unique de toutes les pages et de toutes les actions ;
3. sur refus, on part vers `/api/session-perimee`, qui **efface les cookies**.
   Lever une erreur afficherait un écran de panne en laissant le cookie mort
   dans le navigateur — le piège du 10 août 2026, une soirée perdue.

**Deux choix qui paraissent des détails et n'en sont pas :**

- **Un jeton sans `iat` est laissé passer.** Ceux d'avant cette version n'en
  portent pas : refuser par défaut aurait déconnecté tout le monde au
  déploiement, un geste que personne n'a demandé.
- **La coupure est arrondie à la seconde SUPÉRIEURE.** Les `iat` sont en
  secondes entières : un jeton signé à 12:00:00,900 s'annonce à 12:00:00. Posée
  à la milliseconde, la coupure serait antérieure à sa propre seconde et le
  jeton du moment survivrait — le patron appuierait sur « me déconnecter
  partout » en restant connecté sur l'appareil qui vient d'appuyer, ce que
  l'écran promet pourtant explicitement. Éprouvé par `test-compte-db.ts`.

### L'e-mail se lit, il ne se change pas — et l'écran le dit

C'est l'identifiant de connexion, et **Atlas n'a aucun canal pour vérifier une
nouvelle adresse** : ni e-mail sortant, ni SMS, ni parcours d'inscription, ni
réinitialisation par courriel. Une lettre de travers, et le compte devient
inaccessible sans le moindre moyen de revenir en arrière.

Un champ dont la faute de frappe est **irréparable** ne s'ouvre pas tant qu'il
n'y a pas de quoi la rattraper. L'écran l'écrit en toutes lettres plutôt que de
laisser croire à une panne — une absence muette se lit comme un oubli.

### `users` est la seule table sans RLS, et les suites en tiennent lieu

`src/server/repositories/compte.ts` n'appelle **pas** `withEntreprise`, contre
la règle générale de `CLAUDE.md` §3 — et c'est délibéré : la table
d'authentification ne porte pas d'`entreprise_id`, aucune politique ne s'y
applique, et la même personne appartiendra demain à deux entreprises sans
changer de nom. Poser un contexte d'entreprise pour lire son propre nom ferait
croire à une isolation qui n'existe pas ici (même raisonnement que
`catalogue-prestations.ts`).

**Ce qui protège à la place : chaque requête est bornée par
`ctx.utilisateurId`.** Un `where` oublié ne rougirait nulle part ailleurs — il
changerait le mot de passe de tout le monde d'un coup. `scripts/test-compte-db.ts`
monte donc **deux comptes** partageant le même mot de passe de départ, et vérifie
qu'aucun geste ne touche le voisin. Les deux contrôles ont été vus rouges avant
d'être laissés verts.

### Les règles du mot de passe : une seule fonction, deux appelants

`src/lib/mot-de-passe.ts` décide **et** de l'allumage du bouton, **et** de
l'acceptation par le serveur. Deux rédactions divergeraient, et l'écart se
paierait dans le mauvais sens : un bouton allumé sur une saisie refusée, ou un
artisan qui croit son mot de passe changé alors qu'il ne l'est pas.

**Aucune exigence de majuscule ni de caractère spécial**, délibérément : elles
ne valent pas une phrase longue, et sur un chantier elles produisent des mots de
passe notés sur un carnet.

**Sa demande du 14 août, et elle corrige la mienne :** *« il faut pouvoir
confirmer son mdp 2× avant de le changer et met le petit œil à côté »*. Ma
planche proposait l'œil **à la place** de la seconde saisie ; il veut les deux,
et il a raison — l'œil se touche après coup, la confirmation attrape la faute au
moment où elle se fait. L'œil est sur **les trois champs** : une confirmation
qu'on ne peut pas relire ne confirme rien.

### Ce que la suite navigateur n'éprouve PAS, et pourquoi

`test-compte-connexion-e2e.ts` ne change **jamais** le mot de passe pour de bon :
le compte de démonstration sert aux soixante-quinze suites de la batterie, et le
changer fermerait la porte à toutes les suivantes — l'échec accuserait alors la
page de connexion, qui n'y serait pour rien. Le chemin éprouvé au navigateur est
celui du **refus**, qui n'écrit rien ; l'écriture est tenue par la suite base.

---

## 108. Les trois dernières rubriques : les rappels réels, et deux écrans qui disent ce qui manque

*Codées le 14 août 2026 sur sa consigne — **« Fini toutes les rubriques »**.
Les treize du sommaire (§96) sont désormais ouvertes ; plus aucune ne porte
« Bientôt ».*

### Notifications : les rappels RÉELS, et pas les huit de la planche

> **Ils sont TROIS depuis le 16 août 2026** — voir §112. Ce qui suit décrit les
> deux premiers, et les trois choix qu'ils ont posés : le troisième s'y range,
> à une exception près, dite là-bas.

`maquettes/atlas-reglages-notifications.html` listait huit familles d'alertes.
**Une seule existait**, et la planche le disait déjà — *« rien ne part encore
sur votre téléphone »*. Dessiner les sept autres avec un interrupteur aurait
fait valider un écran de réglages qui ne règle rien.

Deux se calculaient **avec ce que la base porte déjà**, sans nouveau jalon ni
nouveau geste (migration 0043) :

| Rappel | Ce qu'il lit | Défaut |
|---|---|---|
| **Devis sans réponse** | `envois_devis.envoye_at`, `reponse IS NULL`, lien encore valable | 7 jours |
| **Chantier fini, pas facturé** | `chantiers.termine_at`, `facture_envoyee_at IS NULL` | 3 jours |

**Ils apparaissent sur l'ACCUEIL, à côté des réponses de clients.** Un réglage
qui ne produirait rien à l'écran est exactement ce que le patron a interdit sur
la planche : *« on le touche, rien ne bouge, et on croit à une panne »*.

**Trois choix qui paraissent des détails :**

1. **Un rappel n'a pas de « J'ai vu ».** Une réponse de client s'acquitte — elle
   a été lue. Un rappel décrit une situation qui DURE, et il s'en va quand elle
   cesse : le client répond, la facture part. Lui donner un bouton d'acquit
   ferait croire qu'on peut le classer sans rien faire, et le chantier
   retomberait dans l'oubli qu'on cherchait à éviter.
2. **Un devis EXPIRÉ n'est pas rappelé** : il a déjà sa carte de devis caduc.
   Deux cartes pour un même devis feraient chercher la différence.
3. **Jamais « urgent ».** Le fond teinté est réservé à ce qui appelle une
   décision — un refus, un lien mort. Un confort qui crierait aussi fort ferait
   baisser le volume de tous les autres. **Le troisième rappel y déroge, et
   c'est SA décision** : voir §112.

**Ce qui n'a PAS d'interrupteur, et l'écran le dit :** la réponse d'un client et
le lien expiré. Sa règle du 13 août 2026 — *« [des interrupteurs] seulement à
celles où la désactivation n'entraîne pas de problème juridique ou moral ou de
dysfonctionnement à l'appli »*. Les couper, ce serait ne plus savoir qu'on a été
refusé.

**Et ce qui manque est écrit sur l'écran** : « facture impayée » est le rappel le
plus utile, et il est impossible — **rien n'enregistre qu'une facture a été
payée**. Bâti sans cette donnée, il crierait sur toutes les factures, pour
toujours. C'est le prochain lot, et c'est un geste à ajouter au produit, pas une
requête à écrire.

### Apparence et Abonnement : des écrans qui ne règlent rien, et l'assument

Aucun des deux ne porte d'interrupteur, **délibérément**.

- **Apparence** : ni mode sombre ni accent au choix. `colors.rust` et
  `colors.or` sont écrits en clair dans plus de trois cents endroits, en style
  en ligne : les rendre réglables demande de les faire passer par une variable
  CSS — un balayage de toute l'application, à faire et à éprouver d'un coup. Ce
  n'est pas un écran de réglages, c'est un lot. L'écran le dit et lui demande
  lequel des deux il veut d'abord.
- **Abonnement** : ni prix ni offre ne sont décidés — ce sont ses décisions à
  lui, pas des lots de code. **Aucun montant n'est affiché**, et c'est la règle
  de `docs/AGENT.md` §3 : un chiffre sans source, sur une page qui parle
  d'argent, finirait par être cru.

**Pourquoi les ouvrir quand même**, plutôt que de laisser « Bientôt » : une
ligne inerte dans le sommaire ne dit ni ce qui viendra, ni pourquoi ce n'est pas
là, ni ce qui débloque. Ces écrans le disent — et pour l'abonnement, ils
préviennent d'un piège de vocabulaire qui coûterait un appel affolé : ici,
« factures » désigne celles qu'**Atlas** enverrait, pas celles de ses clients,
qui sont dans « Terminés ».

### Le piège payé en prenant les captures

`capture-trois-rubriques.mts` lisait la base sous `DATABASE_ADMIN_URL` et
annonçait « aucun chantier » sur une base qui en portait quatre. **Les tables
portent `FORCE ROW LEVEL SECURITY` : la RLS s'applique même au rôle
PROPRIÉTAIRE.** La capture concluait tranquillement qu'il n'y avait rien à
montrer — un contrôle qui n'a jamais rien vu ne prouve rien. Les captures
emploient désormais le rôle qui traverse la RLS, comme les suites navigateur
(`CLAUDE.md` §5).

## 109. Une équipe part cinq jours : l'absence, et pourquoi elle n'est qu'une occupation

**Le patron, le 14 août 2026 :** *« Comment on fait si jamais il y a une équipe
qui doit partir en déplacement pour cinq jours ? Est-ce qu'il y a un moyen de
l'ajouter au planning ? »*

Retenu sur maquette (`docs/maquettes/55`, **proposition A**) : les absences se
posent sous les noms, dans Réglages → Équipe. Sa réponse, en un mot : *« La
A »*.

### Ce qui existait déjà, et qu'on n'a pas refait

**Si TOUTE l'entreprise part, l'agenda extérieur suffit** : une période de
plusieurs jours occupe toutes les demi-journées qu'elle traverse, week-ends
compris (`src/lib/agenda-externe.ts`). Rien n'a été écrit pour ce cas — le dire
valait mieux que de lui vendre du travail inutile.

**Ce qui manquait, c'est l'autre cas : une équipe sur deux.** L'agenda bloque
tout le monde — délibérément, `fusionnerOccupationExterne` pose
`Math.max(…, nombreEquipes)` parce qu'Atlas ne peut pas deviner si une équipe
sait partir sans le patron — et le nombre d'équipes est **un nombre sans
dates**.

### La décision qui a tout tenu : une absence EST une occupation

Le réflexe était de faire varier le nombre d'équipes jour par jour, donc de
passer une fonction là où passe aujourd'hui un nombre. Il aurait fallu toucher
`departPossible`, `jourRetenable` et leurs appelants — **c'est-à-dire les trois
chemins qui décident d'une date**, dont la revérification de la réponse du
client. Beaucoup de surface pour un défaut qui ne se verrait qu'en production,
chez un client ayant retenu un jour impossible.

Une équipe qui n'est pas là **occupe exactement la place qu'un chantier lui
aurait prise**. La capacité restante se calcule alors toute seule, avec la
comparaison qui existait déjà — `occupation < nombreEquipes` — et **aucune
signature ne change**.

Deux différences avec l'agenda extérieur, et elles comptent :

| | Agenda extérieur | Absence d'équipe |
|---|---|---|
| Qui part | inconnu | **connu** |
| Effet | `Math.max(…, nombreEquipes)` — bloque tout le monde | **`+1`** — une unité, une seule |
| Ordre d'application | après | avant |

L'ordre n'est pas indifférent : les absences **additionnent**, l'agenda **pose
un plafond**. Dans l'autre sens, l'addition dépasserait le plafond que l'agenda
venait d'établir.

### Les quatre endroits où la règle entre, et pourquoi les quatre

`fusionnerAbsences` est appelée dans **quatre** calculs d'occupation, et en
oublier un aurait produit deux vérités sur la même capacité :

1. `envois-devis.ts` — les trois chemins du client (écran d'envoi, création,
   **revérification de sa réponse**) ;
2. `preparation-envoi.ts` — l'écran qui propose les dates au patron ;
3. `chantiers.ts` — le chemin par lequel il pose une date **lui-même** ;
4. `PlanningClient.tsx` — le calendrier, qui doit marquer le même jour occupé.

Sans le 4, le planning aurait montré un jour libre que l'écran d'envoi refusait,
**sur deux écrans qui se suivent**.

### Ce que la table n'est pas

Ni solde de congés, ni validation, ni salarié. **Une équipe est une file du
planning, pas une personne** (§88), et Atlas prépare des devis — il ne tient pas
la paie. Le motif est un texte libre, pour que le patron se souvienne ; **aucun
calcul ne le lit**.

**Des jours entiers, pas des demi-journées.** Personne ne part « du mardi
après-midi au jeudi matin ». Offrir la demi-journée ici, c'est offrir un réglage
à remplir sans en avoir besoin, et deux champs de plus sur six pouces. Les deux
colonnes étant des DATES, la précision s'ajoutera sans se contredire le jour où
elle sera demandée.

**Le bloc n'existe pas à une seule équipe**, et ce n'est pas un oubli : seul,
noter son absence reviendrait à fermer l'entreprise. L'écran renvoie alors à
l'agenda, qui est le bon geste dans ce cas.

### Trois gardes, à trois niveaux, pour la même règle

Une absence **à l'envers** n'occuperait aucun jour et rendrait la capacité fausse
**en silence** — le pire des défauts, celui qui ne se voit qu'au moment où un
client retient une date impossible. Elle est donc refusée :

1. à l'écran, qui éteint son bouton et **dit lequel des deux champs le gêne** ;
2. dans l'action serveur, qui rejoue la même fonction pure — un écran n'est pas
   une garde ;
3. dans la base (`absences_equipe_ordre_ck`), pour le jour où le code changerait.

Les trois appellent **la même** fonction, `refusDeLAbsence` : deux règles
finiraient par diverger (`CLAUDE.md` §3).

### Ce que les contrôles ont appris

**Le message d'un contrôle doit désigner le bon coupable.** Le premier jet de la
suite base posait ses `INSERT` bruts sur le pool : **la RLS les refusait avant
que la contrainte n'ait son mot à dire**, la suite passait au vert, et son
message accusait `absences_equipe_ordre_ck` — qui n'avait jamais parlé. Elle
pose désormais le contexte d'isolation avant d'écrire, et vérifie **aussi** que
la même absence, dans le bon sens, est acceptée : sans ce second cas, une
politique refusant TOUT passerait pour une contrainte qui marche.

**Une colonne `date` remonte en objet `Date`.** `String(...)` en tire
« Sat Sep 12 2026 » : le contrôle comparait deux écritures du même jour et
accusait la saisie. Le formatage est fait par la base (`to_char`).

**Et l'ordre des deux champs n'est pas indifférent** : avancer le premier jour
pousse le dernier avec lui — c'est voulu, sinon le patron reste devant un bouton
éteint sans savoir lequel le gêne. L'état inversé ne s'atteint donc qu'en
reculant le DERNIER jour, en second. La suite de bout en bout s'y est cassé les
dents avant de le comprendre.

**Confrontée au défaut** — la fusion retirée du calendrier — la suite rougit en
nommant le jour : *« le 2026-09-08 est annoncé libre alors qu'une équipe sur
deux est partie »*.

### Ce qui reste, et qui n'est PAS dans ce lot

**L'équipe inscrite sur un chantier reste une étiquette, pas une contrainte.**
`compterOccupation` compare un total au nombre d'équipes et ne regarde jamais
`equipeId` : deux chantiers le même matin, tous deux sur « Équipe 1 », passent.
Sans conséquence tant que le patron répartit lui-même. Le régler obligerait à
choisir l'équipe **avant** de proposer une date au client, donc à toucher au
parcours du devis — c'est un autre chantier, inscrit dans `TODO.md`, et il n'a
de sens que si le télescopage se produit vraiment. **Question posée au patron le
14 août, sans réponse à ce jour.**

---


---

## 110. La TVA quand le client paie — et l'endroit où les factures attendent

**Sa question, le 14 août 2026 :** *« si demain un client décide de ne pas me
payer une facture… à partir du moment où j'envoie la facture, elle rentre
automatiquement dans mon relevé de TVA. Est-ce qu'il y a une possibilité pour
qu'elle rentre seulement une fois que le client m'a payé ? »* Puis, sur la
forme : *« elle arrive dans un endroit en attente ; lorsque j'ai reçu le
paiement, je retourne dessus, je clique sur valider, et boum, elle va dans le
relevé. »*

### Il avait raison, et Atlas avait tort

Pour une **prestation de services**, la TVA est exigible **à l'encaissement**
(CGI art. 269-2-c). Le régime des **débits** — celui que `releveTvaCollectee`
appliquait depuis toujours, en prenant la `date_emission` — est une **OPTION**
qui se demande à l'administration. Un artisan qui ne l'a jamais demandée était
donc invité par l'application à **avancer la TVA d'un client qui n'avait pas
payé**.

Le défaut est donc devenu `encaissements` (migration 0045), et le réglage existe
parce que les deux régimes existent : `docs/QUESTIONS.md` §20, `docs/A-FAIRE.md`
§12.

### Ce qui aurait pu tout casser, et ne l'a pas fait

**Changer le régime sans rien d'autre aurait vidé les relevés déjà déclarés.**
Un trimestre affiché à 400 € serait retombé à 0 €, et l'écran aurait contredit
un formulaire déjà envoyé aux impôts.

Chaque facture déjà émise reçoit donc, à la migration, **un règlement daté du
jour de son émission, pour son total TTC**. Elle apporte exactement ce qu'elle
apportait hier, dans la même période — quel que soit le régime. Ces règlements
portent `origine = 'reprise'` et **l'écran le dit** (« supposé réglé à
l'émission ») : une supposition annoncée reste une supposition, et il peut la
retirer d'un doigt si la facture n'a jamais été payée.

### Deux portes, parce qu'il les a demandées toutes les deux

| Geste | Où | Pour quoi |
|---|---|---|
| **« Payée »** | l'endroit en attente | Solde en un appui, à la date du jour. Le cas de cinquante factures par an |
| **« Noter un règlement »** | la même ligne, dépliée | Une date, un montant — l'acompte, ou un règlement d'il y a trois semaines |

Une saisie en deux champs pour un geste qu'on fait cinquante fois serait un
impôt sur le temps ; une seule touche pour un acompte serait faux. Les deux.

### Un acompte n'apporte que SA part de TVA

500 € sur une facture de 1 440 € TTC dont 240 € de TVA apportent **83,33 €** —
ni 240, ni zéro : au prorata du TTC. C'est la règle comptable, et c'est la seule
qui ne fasse pas dépendre la déclaration de l'ordre dans lequel le client paie.

**Le règlement qui SOLDE reçoit le reliquat.** Trois acomptes arrondis chacun de
leur côté perdent un ou deux centimes ; la somme des lignes du relevé ne
tomberait plus sur le total de la facture, et personne ne saurait expliquer
l'écart. `test-exigibilite-tva.ts` monte la garde dessus.

### Trois refus, et ce qu'ils empêchent

| Refusé | Ce que ça évite |
|---|---|
| Un montant plus grand que le reste dû | Le relevé porterait **plus de TVA que la facture n'en contient** |
| Un règlement daté d'avant la facture | Un acompte sur DEVIS porte sa propre TVA ; le ranger là le daterait du mauvais trimestre |
| Un montant illisible | — et surtout, **il ne lève pas** : `new Decimal("zéro")` jette, et une exception en action serveur devient un identifiant opaque chez lui (`AGENTS.md`). Le refus est une valeur de retour, toujours |

### Ce que l'écran ne dit plus

**« Elle figure au relevé de TVA collectée »**, sous une facture qu'on vient
d'arrêter. C'était vrai aux débits, c'est faux aux encaissements — et il aurait
cherché dans son relevé un montant qui n'y est pas, pour finir par douter de
l'application au lieu de noter son paiement. L'écran dit maintenant qu'elle
**entrera** au relevé le jour du règlement.

### Comment Atlas saura qu'il a été payé

**Il ne le sait pas** : aucun accès bancaire. Trois réponses possibles, et son
choix du 14 août est **la banque** — `docs/A-FAIRE.md` §13 et
`maquettes/atlas-banque-rapprochement.html`. Ce lot code la première : **la
saisie à la main**, qui ne dépend d'aucun contrat et qui restera de toute façon
le jour où l'accès bancaire dort (il se coupe tous les 90 jours).

### Ce qui est éprouvé, et par quoi

| Ce qui est tenu | Où |
|---|---|
| une facture impayée n'entre pas au relevé | les trois suites |
| elle y entre à la date du RÈGLEMENT, pas de l'émission | `test-exigibilite-tva.ts`, `test-paiements-facture-db.ts` |
| un acompte n'apporte que sa part, au centime | `test-exigibilite-tva.ts` |
| un montant trop grand est refusé, avec sa phrase | les trois suites |
| le passé ne bouge pas (reprise de la migration) | `test-paiements-facture-db.ts` |
| rien ne déborde d'une entreprise sur une autre | `test-paiements-facture-db.ts` |
| l'écran ne promet plus le relevé, et porte le geste | `test-tva-au-paiement-e2e.ts` |

---

---

## 111. La ligne du planning porte enfin les trois choses — et « matin » cesse de mentir sans qu'on le retire

*Sa demande du 15 août 2026, sur `docs/maquettes/59-la-ligne-qui-dit-tout.html` :
**« il doit y avoir le nombre de jour, le matin, l'après-midi et la journée comme
infos possible »**, puis **« je veux journée et toute la ligne »**.*

### Ce que la ligne dit maintenant

| Le chantier | La ligne |
|---|---|
| une journée pleine, partie le matin | **14 août · journée** |
| une vraie demi-journée | **17 août · matin · ½ journée** |
| trois jours | **21 août · matin · 3 jours** |
| une journée partie l'après-midi | **24 août · après-midi · 1 journée** |

Trois choses : **la date, le moment de départ, la durée** — et le tout **en or**,
là où c'était gris.

### L'invariant, et c'est le cœur de cette section

**« matin » ne s'écrit JAMAIS sans sa durée.** Ce n'est pas une préférence
d'écriture : seul, ce mot redit exactement le défaut qu'il a signalé le 13 août —
*« ça laisse à penser que juste le matin est bloqué alors que c'est la
journée »*. Accolé au nombre, il ne dit plus ce qui est bloqué mais **quand ça
part** : « matin · 3 jours » ne se lit pas comme une demi-journée.

Ce qui a été retiré la veille pour réparer ce défaut revient donc — mais
**escorté**. Et l'escorte est tenue par un contrôle qui balaie les deux cents
durées, non par trois cas choisis : un allègement futur qui oublierait la durée
sur une seule valeur passerait entre trois cas, jamais entre deux cents.

**« journée » est le seul mot qui se passe de durée**, parce qu'il la porte.
« journée · 1 journée » a été écarté avant même de lui être soumis : dire deux
fois la même chose sur une ligne de 204 px n'est pas un choix.

### Ce qui se perd, et il faut le savoir plutôt que le découvrir

**« du 21 au 25 août » disparaît**, alors qu'il l'avait choisi la veille sur la
planche 53. La ligne ne dit donc plus **quand le chantier finit** — et il ne peut
pas le recalculer de tête, les week-ends étant sautés. C'est le prix du nombre de
jours, qu'aucune plage de dates ne donnait ; il a vu les deux écritures et tranché
pour celle-ci. Si la date de fin lui manque à l'usage, sa place est **la feuille
du chevron**, qui a la largeur que la ligne n'a pas.

### Deux doublons corrigés au passage, tous deux invisibles séparément

- **L'équipe s'écrivait deux fois** dès qu'il y en a plusieurs : dans la phrase
  *et* sur la pastille posée le 14 août, côte à côte. Aucune suite ne le voyait —
  chacune ne regardait que sa moitié. La phrase ne la porte plus **sur la ligne** ;
  les deux feuilles la gardent, elles n'ont pas de pastille.
- **La date était tombée de la liste le matin même**, sur sa consigne *« pas la
  date, elle est déjà présente juste au-dessus »*. Elle vaut du panneau d'un jour
  ouvert, qui se titre « Lundi 17 août ». Elle ne vaut pas de cette liste-ci, qui
  couvre **tout le mois** : sans date, deux chantiers de semaines différentes se
  lisaient pareil.

### Le vocabulaire vient de `DUREES`, et c'est un contrôle, pas une convention

`libelleDureeCourt()` **lit** `src/lib/durees-chantier.ts` plutôt que de recopier
ses mots. La raison est datée : le patron a corrigé « jour » en « journée » le
**4 août 2026** sur la liste elle-même, puis a dû le redire le **15 août** sur une
maquette qui l'avait réenfreinte — *« 1/2 journée pas jour ! »*. Une règle écrite
dans le dépôt et enfreinte deux fois n'est pas une règle : c'est un contrôle qui
manque. `test-libelle-occupation.ts` compare désormais chaque entrée de la liste
au mot que la ligne écrit.

**Deux registres subsistent, et c'est voulu :** `libelleDuree` écrit de la prose
(« une journée ne tient pas ce jour-là ») ; `libelleDureeCourt` écrit une
étiquette (« 1 journée »). Les fondre donnerait « une journée » au milieu d'une
colonne où l'on compte.

### Ce que chaque contrôle voit, et ce qu'aucun ne verrait seul

| Le contrôle | Ce qu'il tient | Ce qu'il ne peut PAS voir |
|---|---|---|
| `test-libelle-occupation.ts` | la phrase est juste, sur 200 durées et les deux départs | qu'elle soit grise, coupée ou repliée |
| `test-ligne-planning-e2e.ts` | **à 390 px** : l'or, une seule ligne, rien de coupé, l'équipe écrite une fois | la justesse du mot sur les cas rares |
| `verifier-maquette-ligne-qui-dit-tout.mjs` | la planche qu'il a manipulée dit ce qu'elle prétend | ce que le produit fait |

La colonne de droite est la raison d'être des trois : le 12 août, un nom de
chantier coupé à 390 px — « Chez M. … » — a été trouvé sur une capture et par
rien d'autre. La suite navigateur mesure donc **le débordement en pixels**, pas
la présence d'un mot.

---

## 112. Le troisième rappel : un devis qui n'est JAMAIS parti

*Demandé le 14 août 2026, codé le 16 sur ses trois réponses.*

**Sa demande :** *« il faudrait créer un rappel lorsque le chantier a été ouvert
mais le devis n'a pas été envoyé […] comme la Mme Félicie, vue il y a quatorze
jours, aucun devis envoyé »*.

### Pourquoi il ne se déduit d'aucun des deux autres

C'est le cœur, et ça décide de toute l'implémentation. « Devis sans réponse »
(§108) part d'un **envoi** — `envois_devis.envoye_at`. Un devis qui n'est jamais
parti ne laisse **aucune ligne** dans cette table : il n'y a rien à interroger.

Celui-ci se lit donc sur le **chantier** lui-même : `created_at` pour le point de
départ, `devis_envoye_at IS NULL` pour la condition. Migration
`drizzle/0046_rappel_chantier_sans_devis.sql`, colonne
`rappel_chantier_sans_devis_jours`, allumée d'origine à **4 jours**.

### Deux règles qui sont gratuites, et c'est ce qui a décidé de la forme

1. **Il s'efface seul dès que le devis part.** La condition se CALCULE ; rien
   n'est rangé nulle part, donc il n'y a rien à effacer. C'était la première
   règle que le patron voulait tenir, et elle ne coûte rien.
2. **Un chantier TERMINÉ sans devis ne réclame plus rien.** Un dépannage fait et
   clos de la main à la main est justement le cas où il a eu raison de ne pas
   faire de devis : le lui rappeler pour toujours serait le punir.

Il n'y a **pas de date de visite** dans Atlas — vérifié : le compte ne peut donc
partir que de l'ouverture du chantier. La faire partir de la visite demanderait
un champ de plus à remplir, et c'est un arbitrage qui lui appartient.

### Ce qui déroge au §108, et pourquoi

**La carte est TEINTÉE**, là où les deux autres rappels ne le sont jamais. Le
§108 réservait le fond teinté à ce qui appelle une décision — un refus, un lien
mort. **C'est sa décision du 16 août**, prise devant les deux tons dessinés
(`docs/maquettes/56-…`, § 1) : *« la B et 4 »*. Sa raison, écrite sur la
planche : au quatorzième jour, ça ne doit pas se rater.

Et l'étiquette porte **le compte des jours avant le nom** — « DEVIS EN ATTENTE ·
14 JOURS » —, l'autre moitié de sa proposition B. Le nombre et la phrase
viennent du même calcul (`joursEcoules`) : deux calculs du même délai finiraient
par se contredire sur une seule carte.

**La réserve lui a été posée, et il a tranché — le 16 août 2026, capture de
l'accueil à l'appui : « le B ».** La question était réelle : en place, ce ton est
exactement celui de « CORRECTION DEMANDÉE », et il avait choisi sur une planche
où les deux tons étaient seuls. **Il les a maintenant vus voisins, et il garde le
sien.** Ne pas rouvrir : le point a coûté un aller-retour, et il est clos.

Ce que cela dit de la règle du §108 — *« jamais urgent »* — n'est pas qu'elle est
morte, mais qu'elle vaut pour un **confort**. Celui-ci n'en est pas un à ses
yeux : c'est le seul des trois où **rien n'est encore parti au client**. Les deux
autres décrivent un travail déjà fait qui attend ; celui-ci, un travail pas
commencé.

### Le libellé, et la règle qu'il a fait naître

Écrit d'abord **« Devis pas encore parti »**. Sa réaction, le 16 août : *« j'ai
peur que la façon dont tu l'as écrit ne soit pas compréhensible — qu'on ne
comprenne pas que cette ligne sert à ça, le devis non envoyé. »*

**La cause n'était pas le libellé mais sa VOISINE.** Posé au-dessus de « Devis
sans réponse », deux réglages commençaient par le même mot : il fallait lire la
ligne grise pour les séparer. Quatre mots lui ont été montrés **chacun avec sa
voisine** — une confusion entre deux libellés n'existe qu'en contexte, et une
ligne montrée seule ne prouve rien. Il a retenu **« Chantier sans devis »**.

**La règle tenue par `test-devis-qui-tarde-e2e` porte donc sur les VOISINS :**
deux réglages qui se touchent ne commencent pas par le même mot. Comparer toutes
les paires serait plus dur et **faux** — « Chantier sans devis » et « Chantier
fini, pas facturé » partagent leur premier mot sans jamais se toucher, une ligne
entière les sépare, et leurs sens sont aux deux bouts du chantier.

Les trois lignes racontent alors le chantier dans l'ordre : **pas de devis →
devis sans réponse → fini, pas facturé.**

### Le rang sur l'accueil : les rappels D'ABORD

*Sa décision du 16 août 2026 — **« fait la B »** — après trois photos.*

**La règle d'avant :** *« les réponses d'abord : quelqu'un a agi, cela prime sur
un silence. Les rappels ferment la marche — ils décrivent une attente, pas un
événement. »* Elle se défendait. Elle avait un défaut que **seule une photo a
montré** : l'accueil ne pose que `VISIBLES_PAR_DEFAUT` cartes (deux), et dès
**deux réponses en attente**, le rappel passait derrière « N autres devis à
regarder ». Un rappel qu'il faut déplier n'est plus un rappel.

**Ce qui a été mesuré avant de décider**, et qui a corrigé une exagération de ma
part : avec **UNE seule** réponse en attente, son rappel prend la seconde place
et se voit très bien. Il en faut **deux ou plus** pour le repousser. Le lui
annoncer comme un défaut permanent aurait été le faire décider sur du faux — la
scène des photos a donc dû être fabriquée exprès
(`scripts/capture-rang-trois-cas.sh`).

**Trois dispositions photographiées sur la MÊME scène**, jamais dessinées :

| | Ce que l'image montre | |
|---|---|---|
| A | Deux corrections demandées | son rappel derrière le repli |
| **B** | Ses rappels en tête | **retenu** |
| C | Trois cartes au lieu de deux | **écarté par l'image elle-même** : la troisième tombe sous le bord de l'écran |

**Ce que B coûte, et il l'a accepté en le voyant :** une acceptation ou un refus
peut désormais attendre derrière un rappel. Ce qu'il gagne : ce qu'il doit FAIRE
passe avant ce qu'on lui a répondu.

`scripts/test-devis-qui-tarde-e2e.ts` tient l'ordre — et il vérifie l'ordre, pas
le compte : la règle vaut quel que soit le nombre de cartes.

#### Et une place garantie à chaque sorte

*Sa seconde décision du même jour — **« ok alors fait le »** —, après que la
batterie ET une photo ont montré le défaut symétrique.*

**Ce que B seul produisait :** les rappels se fabriquant tout seuls, il suffisait
de trois chantiers sans devis pour que **toutes** les réponses de clients passent
derrière le repli. Trois suites l'ont dit en rougissant, avant même l'image —
elles cherchaient une réponse qui n'était plus à l'écran.

**Le partage retenu :** la première place reste au rappel (son choix B ne bouge
pas) ; **la dernière place visible revient à une réponse**, et seulement s'il en
existe une. À deux cartes visibles cela donne « un rappel, une réponse » ; à
trois, « deux rappels, une réponse ».

**Pourquoi ce n'est pas symétrique, et pourquoi c'est juste :** un rappel
s'accumule et attendra demain sans que rien ne soit perdu ; une réponse de client
est un événement périssable — quelqu'un attend une réaction. Une sorte qui
grossit toute seule ne doit pas pouvoir enterrer une sorte rare et urgente.

**La règle est pure** — `src/lib/ordre-notifications.ts` —, et elle est éprouvée
là où l'écran ne sait pas aller : zéro d'une sorte, une seule place visible, et
surtout **aucune carte perdue ni dupliquée** sur les 108 combinaisons de zéro à
cinq de chaque. Cette dernière garde contre le pire défaut possible ici : un
refus de client qui disparaîtrait sans que rien ne le signale.

**Le tressage se fait APRÈS le retrait des cartes acquittées.** Dans l'autre
sens, une place serait réservée à une réponse que le patron vient de marquer
« J'ai vu » — une place vide, au profit de rien.
---

---

## 113. Retoucher un devis à la voix : elle propose, il coche

*Demandé le 15 août 2026. Dessiné (`docs/maquettes/54-dicter-dans-le-devis.html`),
puis codé sur sa réponse — la proposition A, « elle propose, vous cochez ».*

**Sa demande, en deux temps.** D'abord le geste : *« Rajoutes-moi un petit
dictaphone en haut à droite comme il y a pour les infos clients quand tu fais un
nouveau chantier, pour pouvoir dicter à l'intérieur du devis s'il y a des choses
à reprendre ou à modifier. Et je veux que tu mettes exactement les mêmes trois
petits points quand ils chargent. »* Puis le vocabulaire, qui décide de tout le
reste : *« supprime-moi la deuxième ligne, modifie-moi le prix de la taille de
haie, remplace-moi le deux cent cinquante par trois cent cinquante, rajoute-moi
une ligne, broyage des branches et tu mets cinq cents euros, corrige-moi telle
ligne, supprime-moi fondage du bois, mais en échange je veux que tu mettes
débitage du bois, tu as fait une faute à tel endroit, corrige la faute. **Je vais
pouvoir lui parler comme ça et qu'elle comprenne.** »*

### Trois étages, et ce qui vit dans chacun

| Étage | Fichier | Ce qu'il sait |
|---|---|---|
| La règle | `src/lib/retouches-devis.ts` | Sur quelle ligne tombe une désignation, et ce qu'un changement dira en toutes lettres. **Aucune base, aucun modèle** : éprouvé sans rien monter (`scripts/test-retouches-devis.ts`) |
| Le modèle | `src/server/ai/services/retouches-devis-service.ts` | Transcrit, puis demande une liste de retouches en donnant le devis comme contexte. Sans clé, il rend la transcription et **aucune** proposition |
| L'écran | `src/app/chantiers/[id]/devis-complet/DicterDansLeDevis.tsx` | Montre, laisse décocher, applique ce qui reste |

**Rien ne s'applique sans son appui**, et c'est l'arrêt qui justifie l'étage du
milieu : ces lignes SONT le devis que son client recevra. Une lecture qui se
trompe d'un chiffre se rattrape par un avoir.

### Les quatre décisions de la règle, et ce que chacune évite

1. **Le libellé bat le rang.** On se trompe plus souvent de numéro que de nom —
   surtout après avoir soi-même ajouté une ligne. Le rang ne sert qu'à départager
   deux noms qui se valent (« la deuxième, l'élagage »).
2. **Un nom dit mais reconnu nulle part ne se rabat PAS sur le rang.** Il a nommé
   quelque chose : prendre la ligne n° 1 « puisqu'il a dit première » modifierait
   une ligne au hasard sans qu'il s'en aperçoive.
3. **Deux lignes qui se valent rendent `ambigu`.** Son devis porte « Élagage
   chêne » et « Élagage frêne » : choisir la première parce qu'elle arrive en tête
   retirerait la mauvaise une fois sur deux. La feuille les montre toutes les
   deux, décochées, et il redit.
4. **Les rangs ne se décalent pas d'une retouche à l'autre.** « Supprime la
   deuxième et change la troisième » se lit sur le devis QU'IL VOIT, pas sur
   celui qu'on obtiendrait après le premier retrait.

**Et « fondage du bois » trouve « Fendage du bois ».** C'est son exemple, et
c'est le cas courant : une syllabe avalée par le micro. La ressemblance regarde
l'inclusion d'abord (« le prix de la taille de haie » contre « Taille de haie —
12 m »), puis les mots communs, puis la distance d'édition — dans cet ordre,
parce qu'une distance brute déclare éloignés deux textes dont l'un est trois fois
plus long que l'autre.

### Aucun prix ne s'invente — deux gardes, pas une

« Rajoute le broyage » sans montant rend une ligne dont le prix est `null`, et la
feuille l'écrit **en rouge** : « Aucun prix dicté — la ligne arrive vide, à vous
de la chiffrer ». Le premier garde est dans la consigne donnée au modèle ; le
second est `montantDicte`, qui refuse tout ce qui n'est pas un nombre — « environ
500 », « le prix habituel », « à voir ». Le jour où l'un des deux cède, l'autre
tient (`CLAUDE.md` §4).

**Une retouche bancale est jetée, jamais rattrapée.** Il verra qu'un changement
manque et le redira ; il ne verrait pas, en revanche, qu'un chiffre a été mal
repris. C'est ce déséquilibre-là qui décide.

### Deux détails d'écran trouvés à la capture, pas à la mesure

- **Le rond du micro est `card` ici, `rustTint` sur la fiche du client.** Cette
  page-ci est teintée : un rond `rustTint` sur un fond `rustTint` disparaît
  purement et simplement. Ce n'est pas un second micro — c'est le même, sur un
  autre fond.
- **Le retour et le micro partagent une rangée**, ce qui a fait descendre le
  retour de `page.tsx` dans l'écran client : le micro touche aux lignes, donc à
  leur état.

### Ce qui n'a PAS pu être éprouvé ici, et qu'il faut savoir

Cet environnement n'a **ni service de transcription ni modèle**. La feuille de
confirmation **remplie** n'a donc jamais été parcourue de bout en bout : les
phrases de chaque changement sont éprouvées sans navigateur
(`scripts/test-retouches-devis.ts`), et la feuille elle-même n'a été vue qu'avec
des données posées à la main. Le raccord entre la voix et la feuille n'aura été
parcouru qu'avec une clé — sur son banc, ou en production.

Faute de transcription, l'écran ne fait pas semblant : il dit « Aucun service de
transcription n'est branché sur cette installation ». Montrer le texte de
remplacement comme une dictée reviendrait à corriger un devis d'après une phrase
que personne n'a prononcée (`src/server/ai/providers/transcription/dev.ts`).

### Le 20 août 2026 : il ne corrige plus, il DICTE le chantier

**Sa demande, devant un devis vide :** *« Je sais qu'il existe un petit logiciel
que certains étudiants utilisent pour les cours, doté d'une intelligence
artificielle. Ils le posent sur leur table, ils parlent, ça enregistre et
ensuite ça synthétise. Sur la page du devis, j'aimerais que ça soit un peu la
même chose : que l'utilisateur appuie sur la note vocale, qu'il se mette à
parler en expliquant les différentes tâches à faire, que l'intelligence
artificielle comprenne et rédige ça sous forme de belles phrases. »* Avec son
exemple, hésitations comprises :

> « j'aimerais tailler ma haie, c'est une haie qui fait, enfin je ne sais plus,
> mais je crois que c'est quelque chose comme vingt mètres linéaires. Alors mon
> client, qu'est-ce qu'il me disait déjà ? […] il y avait également couper les
> inflorescences des hortensias, et tondre la pelouse, je crois, mais je ne suis
> plus sûr. »

Trois travaux noyés dans une réflexion à voix haute, un seul portant une mesure,
aucun portant de prix. Ce qu'il attend au bout : **trois lignes de devis
rédigées**, pas trois phrases recopiées.

**Le même micro, pas un second.** Ces deux façons de parler — corriger et
raconter — arrivent mêlées dans la même dictée (« rajoute la tonte de la
pelouse, et supprime-moi la deuxième ligne »). Deux micros côte à côte
l'auraient obligé à choisir lequel toucher *avant* de savoir ce qu'il allait
dire. L'invite du modèle porte donc les deux cas, et rien n'a bougé à l'écran.

**Ce que la rédaction n'autorise pas pour autant.** Une ligne bien écrite est
plus crédible qu'une ligne bancale — c'est exactement pourquoi les deux gardes
sur le prix ne bougent pas d'un pouce : une dictée sans montant donne des lignes
**à chiffrer**, jamais des lignes chiffrées au jugé. Un devis en belles phrases
mais faux est plus dangereux qu'un devis vide.

**Les mesures traversent, l'unité comprise.** « Vingt mètres linéaires » arrive
en `quantite: "20"`, `unite: "ml"` jusqu'à la ligne du devis. Le passage par
`uniteDictee` (`src/lib/unites-tarif.ts`) n'est pas cosmétique : le moteur de
prix reconnaît « jour/homme » **à la lettre près**, et enregistrer « jours
homme » parce qu'il l'a dit au pluriel ferait cesser une multiplication en
silence. Ce que la liste ignore — le stère, l'arbre — reste écrit tel quel : la
liste ne ferme rien.

**Une unité ne s'écrit jamais sans sa quantité.** « Des mètres linéaires » sans
nombre donnerait « 1 ml » sur le devis, c'est-à-dire un chiffre que personne n'a
prononcé. Et une quantité recopiée dans l'unité (« 20 mètres ») est refusée
plutôt que gardée : elle aurait doublé sa haie.

**Une mesure hésitante se garde ; un prix hésitant, non.** Asymétrie voulue :
« je crois que ça fait vingt mètres » est un chiffre qu'il ira vérifier sur
place, et le lui redemander ne lui apprend rien. Un prix approximatif, lui, part
chez le client.

### Prouver « les belles phrases » sans clé : la règle d'un côté, le modèle de l'autre

La rédaction est faite par un modèle de langage. Elle ne peut donc être mesurée
ni ici, ni en CI (`ci.yml` pose une clé de remplacement) — et **un contrôle qui
mesure zéro est pire qu'absent** (`CLAUDE.md` §5). Le contrôle est donc coupé en
deux :

| | Où | Ce que ça prouve |
|---|---|---|
| La **règle** | `src/lib/redaction-lignes.ts`, jouée par `scripts/test-retouches-devis.ts` | Ce qui trahit une phrase recopiée : première personne, verbe de la demande, hésitation, ponctuation de phrase, minuscule initiale, longueur. **Confrontée à ses propres phrases**, qui doivent la faire rougir |
| Le **modèle** | `npm run verifier:dictee` (`scripts/verifier-dictee-devis.mts`) | Sa dictée entière envoyée au vrai modèle : trois lignes, rédigées, la mesure retenue, aucun prix inventé — et ses corrections du 15 août toujours comprises |

`verifier:dictee` **refuse de rendre un vert sans clé** : il sort en erreur en
disant qu'il n'a rien vérifié. C'est la seule façon d'éviter qu'une commande
verte fasse croire à une vérification qui n'a jamais eu lieu.

**Au 20 août 2026, il n'a donc pas encore été joué** : cet environnement n'a
aucune clé. Ce qui est éprouvé ici, c'est tout ce que le dépôt fait de la
réponse du modèle ; ce qui ne l'est pas, c'est la réponse elle-même.

---

---

## 114. Sept chartes de couleurs, dont deux sombres — et pourquoi ce n'est qu'UN réglage

*Choisies par le patron le 14 août 2026, sur une planche de seize qui dormait
depuis le début du projet (`docs/maquettes/11-ecran-retenu-seize-couleurs.html`,
engendrée par `scripts/engendrer-maquette-couleurs.mjs`) :* ***« garde seulement
pour l'instant nuit, beurre, moka, pierre, sylve »***, *plus la rose-violet —
Prune —, puis* ***« oui garde Origine en défaut, fais les sept »***.

### Le mode sombre n'est pas un second interrupteur

Il demandait « le mode sombre » **et** les couleurs de la planche. Ce sont la
même chose : **Nuit** et **Sylve** SONT sombres. Deux réglages séparés — un
pour la couleur, un pour le sombre — se seraient contredits à la première
combinaison venue : « Nuit » avec le sombre éteint ne veut rien dire, et il
aurait fallu inventer une règle pour trancher. Une liste, sept lignes, deux
marquées « Sombre ».

### Ce qui rend ce changement sans effet par défaut

`colors.*` ne porte plus de valeur en clair : chaque jeton vaut
`var(--atlas-<nom>, <valeur d'origine>)`. **Le repli EST la charte d'origine, au
caractère près** — relevée jadis au navigateur sur le site d'Arborea (§17). Une
page qui ne poserait aucune variable retombe donc exactement sur ce que
l'application portait la veille.

`scripts/test-chartes.ts` le tient de deux façons : la charte `origine` est
comparée aux treize valeurs d'avant le lot, **et** le repli écrit dans
`design-tokens.ts` est relu et comparé aux mêmes. Une seule valeur recopiée de
travers repeindrait toute l'application, et rien d'autre ne le verrait.

### LE PIÈGE : l'écran se coupait en deux

Premier essai, capture à l'appui : tout l'accueil était passé au noir **et la
bande sous la barre de navigation restait blanche**.

Atlas a **deux** vocabulaires de couleur, et il fallait les brancher tous les
deux :

| Ce qui l'emploie | D'où ça vient |
|---|---|
| les styles en ligne (`style={{ backgroundColor: colors.cream }}`) | `src/lib/design-tokens.ts` |
| les classes Tailwind (`bg-paper`, `text-ink`, `border-line`) | les variables de `src/app/globals.css` |

D'où la seconde moitié du lot : `globals.css` relit `--atlas-*` avec les mêmes
replis. **Et les variables sont posées sur `<html>`, pas sur `<body>`** — une
variable définie sur le corps n'est pas visible d'une déclaration faite à
`:root`, et les sept lignes de `globals.css` seraient silencieusement retombées
sur leur repli. Le contrôle qui garde ce point vise nommément `div.bg-paper`.

### Sur la PERSONNE, pas sur l'entreprise

`users.charte` (migration 0047), pas `entreprises`. « Apparence » appartient à
l'ensemble « Moi » du sommaire : c'est un goût, et un salarié qui préfère le
sombre n'a pas à l'imposer à son patron. `null` = origine, ce qui distingue
« jamais choisi » de « a choisi origine ».

**Aucune contrainte en base sur la valeur**, délibérément : la liste vivra et
un nom retiré ferait alors échouer l'écriture. `charte()` retombe sur l'origine
devant un nom inconnu — c'est le bon comportement, et il est éprouvé.

### Trois choses qui NE suivent pas la charte, et c'est voulu

1. **Les documents.** `couleursDocument` reste en clair : un devis ne part pas
   en noir chez le client parce que l'artisan a choisi « Nuit ». Le commentaire
   de `design-tokens.ts` l'avait prévu de longue date.
2. **Les deux pages du client** — devis et facture. Le gabarit ne pose aucune
   variable dessus : elles portent l'identité d'Atlas, pas le goût de l'artisan.
3. **`alert`, `sage`, `sageLight`.** Une alerte ne change pas de sens avec la
   couleur du fond.

### Ce qui reste à faire

**La couleur de l'interface du navigateur** (`themeColor` dans les métadonnées)
vaut toujours le crème : sur « Nuit », la barre d'adresse de l'iPhone reste
claire au-dessus d'un écran noir. Ce n'est pas dans le rendu de la page mais
dans les métadonnées, qui ne connaissent pas la personne connectée — à traiter à
part (`TODO.md`).

---

---

## 115. Un jour barré n'est pas un jour pris — et la phrase disait le contraire

**Le patron, le 16 août 2026**, capture de l'écran d'envoi à l'appui :

> *« J'ai l'impression que lorsque je veux remettre une journée sur le dix-huit,
> je ne peux pas ou alors c'est parce que je n'ai pas sectionné la
> demi-journée. »*

Il cherchait la cause du mauvais côté. **L'écran l'y envoyait.**

### Ce qu'un jour barré signifie vraiment

`joursSansPlace` ne répond pas à « ce jour est-il pris ? » mais à **« un chantier
de CETTE durée peut-il y COMMENCER ? »**. Les deux ne coïncident pas, et l'écart
n'a rien d'exotique. Reproduit avant d'écrire une ligne, avec un seul jour
réellement plein — le 19 — et deux équipes :

| Jour | Durée demandée | Verdict | Pastille du planning |
|---|---|---|---|
| 18 août | ½ journée | proposable | **libre** |
| 18 août | 1 journée | proposable | **libre** |
| 18 août | 2 jours | **BARRÉ** | **libre** |

Le 18 est **vide** et pourtant barré : deux jours partis du 18 déborderaient sur
le 19, qui est plein. **La règle est juste** — sans elle, le chantier mordrait
sur une journée déjà prise. C'est la phrase qui mentait.

### La phrase, et pourquoi c'est un vrai défaut

Elle écrivait : *« Les jours barrés sont déjà pris et ne peuvent pas être
choisis. »* Sur le 18, c'est faux — il n'y a rien dessus. Elle désignait donc une
occupation inexistante et envoyait chercher au mauvais endroit : exactement ce
que `AGENTS.md` proscrit — *une erreur qui accuse à tort coûte plus cher que pas
d'erreur du tout*.

`src/lib/jours-barres.ts` la rend honnête, **et la durée y est la clé** :

> « Les jours barrés ne peuvent pas accueillir **2 jours** : soit ils sont pris,
> soit le chantier déborderait sur un jour qui l'est. »

Nommer la durée ne fait pas que dire vrai : **cela montre le levier**. Sur
l'écran d'envoi, la durée se change juste au-dessus du calendrier — passer à
« 1 journée » rouvre le 18. Le refus cesse d'être une impasse.

**La demi-journée a sa propre phrase**, et ce n'est pas une coquetterie : elle
tient dans un seul créneau, donc elle ne peut déborder sur rien. Lui servir
« soit le chantier déborderait » rouvrirait le défaut en sens inverse.

### Ce que ça touche, et ce que ça ne touche pas

- **Les deux écrans**, parce que c'est **le même composant** : celui du patron et
  celui du client. Le client aussi voyait des jours barrés sans savoir pourquoi.
- **Mais pas la même phrase — et c'est la batterie qui l'a imposé.** La première
  version envoyait la durée jusqu'à la page du client, en toute bonne foi :
  c'est son chantier, après tout. `test-creneaux-planning.ts` l'a refusée —
  *« la durée du chantier a fuité vers la page du client »*. La consigne est
  ancienne et appartient au patron : **rien du découpage de son planning ne part
  chez le client**, ni créneau, ni durée ; il ne reçoit que des dates. Ce n'était
  pas à une session de rouvrir cet arbitrage, et rien dans le raisonnement qui a
  conduit à l'enfreindre ne l'aurait signalé — seul le contrôle l'a fait.
  Le client lit donc : *« Les jours barrés ne peuvent pas accueillir votre
  chantier. »* Vrai, et muet sur le reste.
- **`dureeDemiJournees` n'a AUCUNE valeur par défaut sur `Calendrier`** (elle vaut
  `number | null`). Chaque écran doit trancher : un défaut silencieux ferait
  pencher l'un des deux du mauvais côté sans que personne ne le décide.
- **Le lecteur d'écran dit la même chose que la phrase**, de chaque côté. Deux
  publics, une seule vérité, sinon l'un des deux garde la version fausse et
  personne ne le voit.
- **Aucune règle de réservation n'a changé.** `jourRetenable`, `joursSansPlace`,
  l'occupation : rien n'est touché. Seule la phrase l'est.

### Ce qui le garde

`scripts/test-jours-barres.ts` tient les trois choses : **le fait** — un jour
vide se barre bel et bien quand la durée déborde —, **la phrase**, qui ne doit
plus jamais prétendre « déjà pris » pour aucune durée, et **la consigne** : celle
du client ne chiffre rien. Confrontée à l'ancienne formulation, la suite passe
quatre cas au rouge en nommant le bon coupable.

---

## 116. « Fais cinq pour cent » : le prix accordé au client

*Demandé le 16 août 2026, dessiné (`docs/maquettes/61-la-reduction-au-client.html`),
puis codé sur sa réponse — **« sous le total et prix accordé au client »**,
l'arrangement B et son libellé.*

**Sa demande :** *« si jamais un client me demande une réduction, [pouvoir] lui
demander "fais cinq pour cent sur le montant du devis" et il ajoute une petite
ligne réduction ou prix accordé au client — cinq pour cent, ou dix, ou quinze.
C'est moi qui choisis le nombre de pourcentage. »*

### Ce que B coûte, et pourquoi il l'a choisi quand même

Trois arrangements lui ont été montrés, **avec leur prix écrit en face** :

| | Où | Coût annoncé |
|---|---|---|
| A | une ligne du tableau | presque rien — une ligne voyage seule jusqu'à la facture |
| **B** ✔ | sous le total | **une colonne de plus partout**, et chaque endroit oublié est un montant faux |
| C | le prix barré | même coût que B, et le vocabulaire de la promotion |

Il a choisi B en connaissance de cause. **Ne pas rouvrir ce choix** ; ce qui suit
n'existe que pour rendre ce coût tenable.

### La parade : un seul calcul, appelé partout

`src/lib/reduction-devis.ts` porte `totauxAvecReduction` — et **personne ne
recalcule un total ailleurs**. Cinq endroits l'appellent : le devis
(`src/server/repositories/devis.ts`), la facture
(`src/server/repositories/factures.ts`, à la création ET à l'émission), le PDF
commun (`src/server/pdf/document-commun.ts`), et l'écran
(`DevisCompletClient.tsx`). Le jour où l'un d'eux additionne des lignes à la
main, il oubliera la remise.

### Trois décisions qui ne sont pas des préférences

1. **La réduction s'applique sur le HT, la TVA se calcule après.** Sur le TTC,
   elle rendrait une déclaration fausse. Annoncé comme non soumis à son choix.
2. **`total_ht` porte le montant NET.** Tout ce qui existe déjà — relevé de TVA,
   export comptable, exigibilité, paiements — y cherche ce qui est *dû*. Y
   laisser le prix plein aurait demandé de corriger chacun de ces endroits sans
   en oublier un seul. Le prix plein vaut `total_ht + reduction_montant`.
3. **Deux colonnes, pas une.** Le pourcentage suffirait à recalculer le montant…
   tant que les lignes ne bougent pas. Elles bougent. Le montant est donc figé
   avec le document, comme les totaux qui l'entourent.

**Et deux gardes plutôt qu'un** : `pourcentValide` borne à l'entrée, et la
migration 0048 pose des contraintes SQL — bornes, et les deux colonnes
ensemble ou pas du tout. L'écran n'est pas le seul chemin : une action serveur
ou une reprise de données passeraient à côté de la première.

### Ce que les contrôles ont trouvé, et qu'aucune relecture n'aurait vu

- **`pdf-lib` refusait le « moins » typographique.** `−` (U+2212) n'existe pas en
  WinAnsi : `WinAnsi cannot encode "−"`, et **plus aucun devis ne se générait**.
  L'écran, lui, l'affichait très bien. Un trait d'union règle tout
  (`test-reduction-pdf.ts`).
- **Le champ disparaissait sous le doigt.** Vider la case ramenait la réduction
  à `null`, ce qui démontait la ligne — donc le champ — AVANT que `onBlur` ait pu
  enregistrer. Le retrait n'arrivait jamais au serveur et la remise revenait au
  rechargement, sans un mot. D'où `remiseOuverte`, un état qui ne dépend pas du
  montant calculé (`test-reduction-devis-e2e.ts`).
- **`chargerDevisPourEcran` rend `null` sur un brouillon**, par construction : il
  sert à relire un devis ENVOYÉ. La retouche dictée l'appelait, et n'aurait donc
  jamais rien appliqué — le seul cas qui compte étant justement le brouillon
  (`test-reduction-parcours-db.ts`).
- **Une ligne vide traînait sur les devis sans remise**, pendant que le PDF
  n'imprimait rien : l'écran et le document se contredisaient. Vu à la capture,
  pas au test.

### La voix, et le chemin de secours

« Fais cinq pour cent sur le montant du devis » est la **sixième** retouche
dictée (`retouches-devis.ts`), et la seule qui ne vise aucune ligne. « Enlève la
remise » la retire. Elle propose, il coche — comme les cinq autres.

**Et une ligne discrète « + Prix accordé au client » sous les totaux**, qui n'a
pas été demandée : sans elle, une remise dictée par erreur ne pourrait pas être
retirée sans redicter, et l'installation sans clé d'IA ne saurait pas en poser.
Elle ouvre à 5 %, qu'il corrige.


---

## 117. Deux demi-journées qui font une journée — et la route, pas le vol d'oiseau

**Sa demande du 13 août 2026 :** *« lorsqu'on a fini des chantiers en
demi-journée, que le planning soit en mesure de proposer deux demi-journées pour
faire une journée, mais de deux chantiers qui sont les plus proches. […] Je vais
lui demander s'il veut que je mette ce chantier-là plutôt qu'un autre
l'après-midi ou le matin. »*

Puis sa question, qui a commandé tout le reste : *« Quel est le problème si on
fait par la route ? Je n'ai pas compris. »* — et sa décision du 16, une fois la
réponse revenue : *« Si c'est possible de faire par la route, code par la
route. »*

### Le problème n'était pas technique, il était juridique

Un service d'itinéraire reçoit les adresses des clients : il devient un
**sous-traitant ultérieur** au sens du RGPD, à nommer dans un contrat qui
n'existe pas encore (`docs/A-FAIRE.md` points 1 et 2). C'est le raisonnement qui
avait déjà fait préférer la Base Adresse Nationale à Google (§ sur l'aide à la
saisie d'adresse).

**Sauf que l'État publie aussi un service d'itinéraire.** `.github/workflows/itineraire.yml`
est allé le lui demander depuis une machine qui a le réseau — l'environnement de
développement, lui, refuse les services extérieurs. Ce qu'il a rapporté le
16 août 2026 :

| Mesuré | Résultat |
|---|---|
| Clé, compte | **Aucun.** Le service répond 200 sans rien |
| Écart vol d'oiseau → route | **×1,33 à ×1,56** (monts du Lyonnais) |
| Rafale de dix appels | 1858 ms, **tous en 200**, 186 ms de moyenne |
| En-têtes de limite d'usage | **Aucun** — donc on ne sait pas, donc on se retient |

Ce que ces chiffres tranchent : le vol d'oiseau se trompe d'un tiers à la
moitié, et l'erreur n'est **pas la même d'un trajet à l'autre** — elle peut donc
inverser le classement. Un chantier « à 8 km » derrière une colline se paie plus
cher qu'un chantier « à 11 km » par la vallée.

### L'ordre imposé, et pourquoi il ne se négocie pas

`src/lib/appariement-demi-journees.ts` :

1. **le vol d'oiseau classe et écarte** — instantané, chez nous, aucun appel ;
2. **la route ne départage que les trois premiers.**

Trois appels par proposition, pas quinze. Aucun en-tête n'annonce de limite :
dix appels ne prouvent pas qu'il en supporte mille, et un écran qui arroserait
un service public à chaque ouverture finirait par s'en voir fermer la porte —
c'est l'artisan qui perdrait la fonction.

**Ce qui part chez l'IGN : deux paires de nombres, rien d'autre.** Pas de nom,
pas d'adresse en clair, pas d'identifiant. Des coordonnées ne se remontent pas à
une personne sans le fichier qui va avec, et ce fichier ne quitte jamais Atlas.
Un contrôle le tient plutôt qu'une phrase rassurante
(`scripts/test-itineraire-ign.ts`).

### Ce qu'il a fallu construire avant, et qui ne se voit pas

**Atlas ne connaissait aucune distance.** L'adresse d'un chantier est du texte
libre, et le restera : on ne va pas empêcher de créer un chantier faute d'un
numéro de rue. Mais la Base Adresse Nationale rend les coordonnées à chaque
frappe, dans la réponse que `lireSuggestions` lisait — et qui n'en gardait que
le libellé. Le reste partait à la poubelle.

- **migration 0049** : `latitude`, `longitude` (`numeric(9,6)`) et
  **`adresse_situee`** sur `chantiers` ;
- **`adresse_situee` est la colonne qui compte.** Elle porte l'adresse EXACTE
  qui a produit les coordonnées. Le jour où le patron corrige l'adresse, des
  coordonnées posées sur l'ancienne seraient **pires que pas de coordonnées** —
  elles ne se signalent pas. Comparer les deux attrape d'un coup les chantiers
  jamais situés et ceux dont l'adresse a changé ;
- **le rattrapage se fait au fil de l'eau**, huit par ouverture de planning
  (`situerQuelquesChantiers`). Trois cents chantiers d'un coup feraient trois
  cents appels et une page d'une minute ;
- **une panne du service ne s'écrit PAS en base.** Marquer `adresse_situee`
  pendant une coupure condamnerait l'adresse à ne plus jamais être retentée : le
  chantier resterait « non situé » pour toujours, sans que rien ne l'explique.
  Une adresse *refusée* (« derrière l'église »), elle, laisse sa trace — sinon
  elle repartirait à chaque ouverture, indéfiniment.

### L'écran : sa composition 2, avec les propositions de la 3

*« je veux la 2 par la route mais avec plusieurs proposition comme la 3 »*
(`docs/maquettes/57-apparier-deux-demi-journees.html`).

Le bandeau vit **sous la journée**, et n'apparaît que là où la question se pose :
une demi-journée prise, l'autre libre, pour la même équipe. Sur une journée vide
il n'y a rien à compléter ; sur une journée pleine, rien à ajouter.

**Ses trois états muets comptent autant que le premier** — un écran qui ne dit
rien passe pour une panne, ce dépôt l'a déjà payé trois fois :

| Situation | Ce que l'écran écrit |
|---|---|
| Rien d'assez proche | Combien, et à quelle distance est le plus proche — puis « Voir quand même » |
| Départ non situable | L'adresse en cause, nommée, et le chemin pour la corriger |
| Candidat sans adresse | Nommé sous les propositions, jamais tu |
| Aucun candidat du tout | **Rien** : le bandeau ne s'affiche pas. Le cas ordinaire ne mérite pas du bruit |

**Et la phrase ne ment jamais sur ce qu'elle mesure** : « à 12 km, 20 min de
route » quand on a la route, « à 8 km à vol d'oiseau » sinon. Écrire « à 8 km »
tout court laisserait croire à une distance routière, et le patron partirait
pour un quart d'heure de trajet qui en fait vingt-cinq.

**Atlas propose, le patron décide.** Aucune demi-journée ne se cale toute seule.

### Un défaut trouvé en chemin : « ½ journée » valait une journée entière

`dureeEnDemiJournees("½ journée")` rendait **2**. Le motif reconnaissait
« demi-journée » et « 1/2 journée », pas le caractère `½` — qui est pourtant
**le libellé que la molette affiche au patron** (`src/lib/durees-chantier.ts`),
donc celui qu'il redit et qu'il dicte. La phrase tombait alors sur la règle
suivante — « journée » sans chiffre reconnu — et réservait la journée entière.

Sans conséquence par l'écran Informations, qui enregistre `libelleDuree(1)` =
« une demi-journée ». Réel dès qu'il **dicte** sa durée. Corrigé, avec son cas
dans `scripts/test-creneaux.ts`.

### Ce qui reste, et qui n'est PAS dans ce lot

**Le bandeau ne propose qu'un trou à la fois.** À plusieurs équipes, plusieurs
demi-journées dépareillées peuvent coexister ; en afficher autant de bandeaux
ferait trois pavés sous une journée déjà chargée. On complète le premier, le
suivant apparaît.

**Et la proposition 4 de la maquette — proposer au moment où l'on pose la date —
n'est pas codée.** Elle se combine avec celle-ci sans la contredire ; elle
attend son geste.

---

---

## 118. Le quatrième rappel : une facture impayée, et le premier qui porte un RYTHME

**Sa demande du 16 août 2026, en deux temps.** D'abord la question du point de
départ, à laquelle il répond lui-même devant la maquette
(`maquettes/atlas-rappel-facture-impayee.html`, cinq écrans) : ***« faut faire
a plus b »*** — l'échéance quand un délai de paiement est réglé, le jour de
l'envoi sinon. Puis, dans la même phrase, ce qui fait de ce rappel un cas à
part : ***« il faut également qu'on puisse régler, par exemple, je veux un
rappel toutes les semaines ou tous les quinze jours, mais pas qu'il y ait la
notification tous les jours. »***

### Pourquoi celui-ci a besoin d'un rythme, et pas les trois autres

Les trois premiers rappels **s'éteignent d'eux-mêmes** dès que le geste attendu
est fait : le devis part, le client répond, la facture est émise. Leur durée de
vie est bornée par une action qui dépend de lui.

Celui-ci ne dépend pas de lui. Une facture peut rester impayée des mois, et
aucun geste de sa part ne l'éteint — c'est le client qui décide. Sans rythme, la
carte se serait posée sur son accueil **chaque jour jusqu'au paiement**, et une
carte qu'on voit tous les jours cesse d'être lue au bout d'une semaine. Le
rythme n'est donc pas un confort : c'est ce qui empêche le rappel de se détruire
lui-même.

### « A plus B » : d'où court le compte

`echeanceFacture(envoyeeLe, delaiPaiementJours)`, dans `src/lib/rappels.ts` :

| Cas | L'échéance |
|---|---|
| un délai de paiement est réglé (« Devis & factures ») | envoi **+ le délai** |
| aucun délai réglé | **le jour de l'envoi** |

Puis le délai du rappel se compte **à partir de cette échéance**, jamais de
l'envoi. C'est écrit à l'écran — « 1 jour après l'échéance » — parce qu'un délai
sans son point de départ se comprend spontanément comme partant de l'envoi, et
il aurait cru le rappel en retard de trente jours.

### Trois rythmes, jamais une case à remplir

`RYTHMES_RAPPEL` n'offre que **chaque jour, chaque semaine, tous les 15 jours**,
en pastilles. Une case de saisie aurait été plus souple et **aurait rouvert ce
qu'il a exclu** : rien n'y aurait empêché « tous les jours », ni « tous les
3 jours ». La contrainte est le sujet de sa demande, pas un effet de bord.

### « Plus tard » est le seul moteur du rythme — et ce n'est pas « J'ai vu »

Le rythme ne s'applique **qu'après un geste**. Tant qu'il n'a rien touché, la
carte reste, tous les jours. C'est délibéré : une carte qui s'endormirait toute
seule pourrait passer un jour où il n'ouvre pas l'application, et il ne saurait
jamais qu'elle est passée.

« Plus tard » **ne classe rien** : la facture reste dans « Terminés › TVA › En
attente de paiement », le rappel revient au bout du rythme. C'est ce qui le
distingue d'un acquittement — et pourquoi la carte ne porte pas « J'ai vu ».

### La date de report vit sur le CHANTIER, et ce n'est pas un rangement

`chantiers.rappel_facture_repousse_le`, migration 0050 — et non
`factures.rappel_repousse_le`, qui était le choix naturel.

**`trg_facture_immuable` (migration 0018) refuse TOUTE écriture sur une facture
émise**, y compris une date qui ne sert qu'à l'affichage. La première version
l'a appris par un rouge : *« Failed query: update "factures" set
"rappel_repousse_le" »*. Affaiblir le déclencheur pour une commodité d'écran
aurait été exactement ce que `CLAUDE.md` §4 interdit ; la relation
chantier ↔ facture étant de un à un (`factures_chantier_uk`), rien ne se perd à
l'écrire de l'autre côté.

### Le montant affiché est le RESTE dû, jamais le total

Le rappel additionne `paiements_facture.montant` et n'affiche que ce qui manque.
Réclamer le total sur une facture partiellement réglée l'aurait fait redemander
une somme déjà encaissée — le premier des pièges de sa planche. Le total
l'accompagne (« 1 880,00 € restant sur 2 880,00 € ») pour qu'une facture entamée
ne passe pas pour une petite facture. Une facture soldée sort du rappel **le jour
même**, sans geste.

**Et c'est la somme des règlements qui décide, jamais un état posé à la main.**
Un « payée » et une somme de règlements peuvent se contredire ; une somme ne se
contredit pas elle-même.

### Ce que la capture a trouvé, et qu'aucun test ne voyait

Cinquième fois dans ce dépôt qu'un défaut sort d'une image
(`scripts/capture-facture-impayee.mts`) :

- **« 1 jours après l'échéance »** — le défaut de ce rappel vaut UN, c'était donc
  la première chose qu'il lisait sur cette ligne ;
- **deux espaces mangées** par JSX autour d'un `<b>` : « tout seuldès que »,
  « reste dûqui ».

Et le contrôle écrit pour empêcher le retour du premier **ne mesurait rien** : il
cherchait « 1 jours » dans `innerText`, où la valeur d'un `<input>` ne figure
pas. Il passait au vert sur l'écran fautif. L'unité porte donc maintenant son
propre repère (`data-atlas="rappel-unite"`), et le contrôle la lit là.

**La capture elle-même a menti d'abord, deux fois** — et les deux mensonges
valent d'être retenus :

1. `fullPage` photographiait le **milieu du cadre qui défile**
   (`.atlas-fil-defile`), sans une seule carte, pendant que le contrôle lisait le
   DOM et se déclarait vert. Ce qu'on vérifie doit être ce qu'on **montre** : le
   contrôle mesure désormais la position de la carte dans le cadre.
2. Le montage posait le délai de paiement avec `ctx.entreprise` là où le champ
   s'appelle `entrepriseId` — `WHERE id = NULL`, **zéro ligne, aucune erreur**.
   L'image annonçait « échéance dépassée depuis 60 jours » au lieu de 30, et
   c'était le montage qui était faux, pas l'application. Toute écriture de
   montage vérifie maintenant son `rowCount`.

---

## 119. « L'apparence ne change pas » — une couleur posée sur `<html>` ne peut pas suivre une navigation

*Le patron, le 16 août 2026, capture de l'écran Apparence à l'appui, la pastille
« Nuit » cochée : **« l'apparence ne change pas »**. Il avait raison.*

### Ce qui se passait, mesuré avant d'être réparé

Sa séquence rejouée telle quelle — choisir Nuit, puis toucher les onglets du bas,
sans jamais recharger :

| Le moment | Le fond que `<html>` portait |
|---|---|
| l'écran Apparence, avant l'appui | `#f5f3ee` (Origine) |
| **juste après l'appui sur Nuit** | `#f5f3ee` — **rien n'a bougé** |
| après l'onglet « Chantiers » | `#f5f3ee` |
| après l'onglet « Planning » | `#f5f3ee` |
| après un **rechargement complet** | `#101210` (Nuit) |

Le choix partait donc bien en base — la dernière ligne le prouve. C'est l'écran
qui ne le suivait pas.

### La cause, et pourquoi aucune invalidation de cache ne l'aurait réglée

Les variables de couleur sont posées par le **gabarit racine**, sur l'élément
`<html>`. Ce gabarit est partagé par tous les écrans : **une navigation côté
client ne le rejoue pas** — elle remplace le contenu, pas le document. L'attribut
`style` de `<html>` reste donc celui du chargement initial, quoi qu'on invalide
au serveur.

C'est pourquoi ni `revalidatePath("/", "layout")` ni `router.refresh()` n'étaient
la réponse. Le premier avait d'ailleurs été retiré la veille pour une **bonne**
raison : il vidait le cache de toute l'application à chaque appui, au point de
faire tomber une suite voisine par ralentissement.

### La réparation : le navigateur repeint le même élément

`ApparenceClient` écrit les jetons de la charte sur `document.documentElement`,
dès l'appui. C'est **le même élément pendant toute la visite** : la couleur suit
le doigt sans aller-retour, et survit à toutes les navigations qui suivent.

**Le serveur garde son rôle, et il ne fait pas double emploi :** c'est lui qui
pose la charte au PREMIER rendu, sans quoi chaque page s'afficherait en couleurs
d'origine avant de se repeindre — un clignotement à chaque écran, sur un
téléphone lent, qui se lit comme un défaut.

**Un refus rend AUSSI la couleur d'avant.** Laisser l'écran repeint alors que
rien n'est enregistré lui ferait croire le contraire du message qu'il lit.

### Le contrôle était vert sur un chemin qu'il ne prend pas

`test-chartes-e2e.ts` vérifiait la couleur — et elle était juste — mais avec un
`page.goto()` entre chaque écran, c'est-à-dire **un rechargement complet à chaque
fois**. Le seul chemin où le défaut existe, la navigation par les onglets, n'était
parcouru nulle part.

`test-charte-suit-le-doigt-e2e.ts` rejoue **sa séquence** : appui, onglet, onglet,
et le rechargement seulement à la fin — pour distinguer « pas enregistré » de
« enregistré mais pas peint ». Confronté au défaut, il tombe en donnant les deux
couleurs.

C'est la leçon du 12 août, une fois de plus : **reproduire la séquence du patron,
pas le geste isolé.**

---

## 120. Retirer le prix accordé — trois défauts, dont deux qu'aucun test ne voyait

**Son constat du 17 août 2026, capture à l'appui :** *« Il n'y a aucun moyen de
retirer les cinq pour cent. Si ce n'est en écrivant zéro pour cent à la place de
cinq. Et lorsqu'on l'a dicté, je dis "retire-moi la ligne des cinq pour cent",
je vois bien le message écrit "vous voulez retirer cinq pour cent", et quand on
valide, ça ne le retire pas. »*

Trois choses dans une seule phrase. **Deux étaient des défauts, et ils tenaient
tous les deux à la même cause : le prix accordé n'est pas une ligne du tableau.**

### La cause commune, et elle vaut pour tout ce qui vivra dans l'en-tête

`reduction_pourcent` vit sur **l'en-tête du devis**, pas sur une ligne de prix.
C'est le prix de l'arrangement B qu'il a choisi le 16 août (§116), et il lui
avait été annoncé : la réduction ne voyage pas toute seule. Chaque endroit qui
recopie « les lignes » et rien d'autre l'oublie donc **en silence**.

### 1. « Retire-moi les cinq pour cent » à la voix : compris, enregistré, défait

Le chemin était juste jusqu'au bout : le modèle rendait `reduction: null`, la
feuille de confirmation l'annonçait avec sa phrase, `appliquerRetouchesAction`
appelait bien `mettreAJourEnTeteDevis`. **La base retirait la remise.**

Puis l'action rendait **les seules lignes**, et l'écran ne recalait que les
lignes. Le pourcentage restait affiché — et, au premier passage suivant dans la
case, `onBlur` le **réécrivait en base**. Le retrait était donc annoncé, fait,
puis annulé sans un mot.

L'action rend désormais `{ lignes, reductionPourcent }`, et l'écran se recale
sur les deux.

### 2. Écrire « 0 » ne la retirait pas non plus

`pourcentValide` traite zéro comme « aucune réduction » — c'est juste, et
volontaire (§116). Mais l'écran, lui, ne refermait la ligne que si la chaîne
tapée était **vide**. Écrire 0 laissait donc une ligne or « Prix accordé au
client 0 % », sans montant, sur un devis dont le PDF n'imprimait rien.

**L'écran affirmait une remise que le document ne portait pas.** Il se referme
maintenant sur ce que le serveur a **retenu** (`pourcentValide`), jamais sur ce
qui a été tapé.

### Pourquoi aucune suite ne l'avait vu

`test-reduction-devis-e2e.ts` éprouvait le retrait **en vidant la case**, puis en
**rechargeant la page** — deux gestes qu'il ne fait ni l'un ni l'autre. Vider un
champ de 36 px sur un téléphone demande de viser, sélectionner, supprimer ;
écrire 0 par-dessus est le geste naturel. Et le rechargement masquait
exactement le défaut, puisqu'il repartait de la base.

**La leçon, et elle dépasse cet écran :** un contrôle qui recharge avant de
vérifier n'éprouve pas l'écran, il éprouve la base. Le nouveau cas mesure
**sans rechargement**.

Quant à la dictée, elle reste **inéprouvable ici** : ni service de transcription
ni modèle (`src/server/ai/providers/transcription/dev.ts`). La cause a été trouvée en lisant le
code, et le raccord n'aura été parcouru qu'avec une clé — c'est écrit tel quel
dans `test-dicter-dans-le-devis-e2e.ts` depuis le 15 août.

### 3. Le « petit moins » — dessiné, choisi, codé

*« Tout comme on ajoute une ligne avec un petit plus, il faudrait qu'on ait un
petit moins. »* Dessiné d'abord (`CLAUDE.md` §3 bis) :
`docs/maquettes/68-retirer-le-prix-accorde.html`, trois formes sur **ses**
chiffres, 24 contrôles. **Il a choisi B** le 17 août — le rond en face de la
ligne — et c'est ce qui est codé.

**Le « + » et le « − » ne sont pas symétriques**, et il l'a choisi en le sachant :
le « + » ajoute une ligne **au tableau**, ce « − » retire un **total**. Rien
d'autre dans ce bloc ne portait de bouton.

**Il passe par LE MÊME tiroir que les lignes**, sous une clé réservée
(`prix-accorde-au-client`, impossible à confondre avec un UUID de ligne). Une
seconde mécanique de retrait sur le même écran est exactement ce que le patron a
fait disparaître le 10 août 2026 — et cela lui donne « Annuler » sans une ligne
de plus.

**Rien n'est écrit tant que le tiroir est ouvert**, mais le total, lui, montre le
prix plein **dès l'appui**. Un geste qui ne changerait rien à l'écran pendant six
secondes se lirait comme sans effet — c'est précisément sa plainte du 17 août.
Et les deux états de l'écran sont posés **avant** l'attente du serveur : les
repousser après laisserait une image où la ligne or revient avec son ancien
pourcentage.

### Un contrôle de maquette que personne ne jouait

`verifier-maquette-reduction.mjs` existait depuis le 16 août et **n'était branché
nulle part** — ni dans `verifier:maquette`, ni ailleurs. Un contrôle que
personne ne joue ne prouve rien (`CLAUDE.md` §5). Il est raccroché, avec celui
de la 68.

### Ce qui est éprouvé, et par quoi

| Ce qui est tenu | Où |
|---|---|
| écrire 0 % retire la remise à l'écran **sans rechargement** | `test-reduction-devis-e2e.ts` |
| et la base ne garde alors aucun reliquat | `test-reduction-devis-e2e.ts` |
| vider la case la retire aussi, et le devis revient au prix plein | `test-reduction-devis-e2e.ts` |
| la TVA suit toujours le net, jamais le prix plein | les trois suites de §116 |
| le « − » existe, fait 26 px, et n'est pas sur un devis parti | `test-reduction-devis-e2e.ts` |
| un appui rend le prix plein **tout de suite**, sans rien écrire encore | `test-reduction-devis-e2e.ts` |
| « Annuler » rend la remise avec son pourcentage | `test-reduction-devis-e2e.ts` |
| le tiroir fermé, l'écran et la base disent la même chose | `test-reduction-devis-e2e.ts` |
| la planche tombe juste sur les deux états, et le geste ne survit pas à son effet | `verifier-maquette-retirer-remise.mjs` |
| **non éprouvé ici** : le raccord dictée → écran | il faut une clé de transcription et un modèle |

---

## 121. La fiche du client : montrer ce que l'application savait déjà

*Demandé le 16 août 2026, dessiné (`docs/maquettes/66-ce-que-je-sais-du-client.html`),
puis codé sur son choix — **l'arrangement B**, la fiche atteinte depuis le
chantier.*

**D'où ça vient, et la réponse qu'il faut garder.** Le patron a montré la photo
d'un « graphe de connaissances » : *« tu peux m'expliquer et me dire si ça peut
me servir pour mon appli ? »* La réponse a été **non, deux fois** :

- **comme mémoire de travail**, le dépôt la tient déjà (`CLAUDE.md`,
  `HANDOVER.md`, `ARCHITECTURE.md`…). Un graphe à côté serait une seconde
  vérité, et c'est exactement ce que ces fichiers existent pour empêcher ;
- **comme fonction**, ses données sont déjà reliées dans une base SQL, qui
  répond mieux qu'un graphe à « combien j'ai facturé chez les Ledoux ? ».

**Ce qu'il restait à en prendre** — et c'est cet écran : l'application SAIT
qu'un client est venu quatre fois, qu'il doit encore 740 €, qu'on lui fait
toujours de l'élagage… **et elle ne le montrait nulle part.**

### Pourquoi B, et pas un onglet « Clients »

Le seul avantage de l'onglet aurait été de répondre à « qui me doit de
l'argent ? ». **Cet écran existe déjà** — « En attente de paiement », dans
Terminés → TVA (§110). Un cinquième onglet aurait coûté de la place au pouce
pour redire ce qui est là. Ne pas le rouvrir sans qu'il le demande.

### Trois étages, et ce que chacun refuse

| Étage | Fichier | Ce qu'il fait |
|---|---|---|
| La règle | `src/lib/fiche-client.ts` | compte, additionne, regroupe. **Aucune base** : éprouvé sans rien monter |
| La lecture | `src/server/repositories/fiche-client.ts` | lit sous `withEntreprise`, et **ne calcule rien** |
| L'écran | `src/app/clients/[id]/page.tsx` | affiche, et ne décide de rien |

**« 0 € » est le chiffre le plus dangereux de cette fiche.** Un client dont
aucun chantier n'est facturé n'a pas rapporté zéro euro : il n'a pas encore été
facturé. Affiché « 0 € », il se lit comme un mauvais payeur, et le patron
déciderait sur une phrase fausse. La règle rend donc `null`, l'écran écrit
« — », et une phrase dit pourquoi (`CLAUDE.md` §4).

**Les prestations se comptent en CHANTIERS, pas en lignes.** Un devis portant
« Élagage — chêne » et « Élagage — frêne » ne fait pas deux visites.

**Ce que la règle refuse de faire, et c'est écrit pour que ce soit un choix :**
sans séparateur, « Élagage chêne » et « Élagage frêne » restent deux
prestations. Les regrouper demanderait de deviner que le premier mot porte le
métier — c'est le travail de `signatureLecon`, qui le fait déjà pour les prix.
Le refaire ici en moins bien créerait deux vérités.

### La porte, et pourquoi elle n'est pas sur le nom du client

Elle vit dans le **tiroir de la fiche du chantier**, avec les autres
destinations. Le nom du client, en tête d'écran, passe par `precision` —
**une simple chaîne** d'`EnTeteEcran`, partagé par tous les écrans. Le rendre
cliquable aurait demandé de toucher une pièce commune pour un seul écran.

Elle n'existe **que si le chantier a un client** : une fiche de personne n'a
rien à montrer.

### ⚠ CE QUI LIMITE CETTE FICHE AUJOURD'HUI, ET QUI N'EST PAS DE SON FAIT

**Un client n'est JAMAIS réutilisé.** `creerClient` insère toujours, et il n'est
appelé que depuis la création d'un chantier ; `listerClients` existe et n'est
appelé par aucun écran. Deux chantiers pour « M. Bernard » créent donc **deux
clients** — et la fiche affichera « 1 chantier » à chaque fois.

La fiche est juste ; c'est sa matière qui manque. **Le corriger est une décision
du patron, pas une correction technique** : rapprocher deux clients sur leur nom
fusionnerait deux personnes réellement homonymes, et il n'existe aucun moyen de
défaire cela. Consigné dans `TODO.md`, à lui poser.

### Trois défauts trouvés en regardant, pas en relisant

- **« ENCORE DUS » se cassait en deux lignes** dans sa case à 390 px. Devenu
  « reste dû ». Vu à la capture ; une suite le mesure désormais.
- **« 1 fois · 0,00 € »** s'affichait pour une prestation écrite mais pas encore
  chiffrée — cela se lit comme un travail fait pour rien. Le prix ne s'écrit
  plus qu'au-dessus de zéro.
- **Le contrôle accusait à tort** : il cherchait « 0,00 € » dans la page, et le
  trouvait dans « 45**0,00 €** ». Une erreur qui accuse à tort coûte plus cher
  que pas de contrôle (`CLAUDE.md` §5).


---

## 122. « C'est monsieur Martins » : retrouver un client au lieu d'en refaire un

**Le patron, le 17 août 2026**, une journée après avoir reçu sa fiche client et
l'avoir vue annoncer « 1 chantier » chez quelqu'un qu'il connaît depuis des
mois : *« si je crée un nouveau chantier, mais que c'est monsieur Martins et
qu'on a déjà une fiche client monsieur Martins, [il faut que] le devis, la
facture s'ajoute à la fiche client de monsieur Martins qui est déjà créé. »*

C'est la suite directe du §121, et le défaut y était déjà écrit noir sur blanc :
`creerClient` **insérait toujours**. La fiche était juste ; sa matière ne
pouvait pas exister.

### Le chemin qu'il a écarté, et il faut le savoir avant d'y revenir

Trois chemins lui avaient été soumis — lui **proposer** les clients qui
ressemblent, **rapprocher seul**, ou **fusionner après coup**. Le premier lui
avait été recommandé, comme le seul qui n'invente rien.

Il l'a refusé en une phrase : *« non justement, il ne faut pas »*. Le
rapprochement se fait **sans geste de sa part**. Ne pas rouvrir cette porte sans
lui : ce n'est pas un oubli, c'est un choix.

### Ce qui borne le risque : une contradiction interdit le rapprochement

Le danger de ce chemin est unique et il ne se répare pas d'un clic — verser le
chiffre d'affaires d'un homme sur la fiche d'un autre, et lui montrer une dette
qui n'est pas la sienne. La règle vit dans `src/lib/rapprochement-client.ts`,
pure et éprouvée sans base :

| La saisie… | face à un homonyme… | Alors |
|---|---|---|
| porte un téléphone ou un e-mail **qui concorde** | — | c'est lui, sans discussion |
| porte une coordonnée **qui diffère** | l'homonyme en porte une aussi | **deux fiches** : ce n'est pas lui |
| ne porte rien | l'homonyme porte ce qu'il veut | c'est lui — le cas courant |
| — | plusieurs homonymes indiscernables | le **plus récent** |

**L'homonyme qui contredit est écarté seul, pas en bloc.** Deux « Martins » en
base dont un seul porte un autre numéro laissent le bon disponible ; les écarter
ensemble aurait fabriqué un troisième Martins — exactement ce qu'on répare.

**Le nom se compare sans sa civilité**, via `aDejaUneCivilite` et non une
seconde liste de graphies (`CLAUDE.md` §3) : « Martins » et « M. Martins » sont
le même homme, et c'est précisément l'écart qui fabriquait les doublons. Le
garde-fou de `civilite.ts` sert ici aussi — « Merlin » et « Mathieu Dubois » ne
sont pas amputés de leur première syllabe.

**Le téléphone se compare sur ses chiffres, indicatif ramené au zéro** :
« +33 6 12 34 56 78 » et « 06.12.34.56.78 » sont le même numéro. Sans cela, le
même homme noté de deux façons serait passé pour une contradiction et aurait
fabriqué la fiche en double.

### Ce qui n'est jamais fait : écraser

Ce qu'il tape à la volée **complète les cases vides** de la fiche retrouvée —
téléphone, e-mail, adresse, civilité, canal — et **ne touche à rien d'autre**.
Il crée un chantier entre deux rendez-vous et tape un portable là où il avait
noté le fixe : garder les deux est impossible, choisir le nouveau lui ferait
perdre le sien sans un mot.

### Les effacés et les supprimés sont hors du jeu

Un effacement RGPD (`donnees-client.ts`) pose `efface_le` **et** `deleted_at`.
Rattacher un chantier neuf à cette fiche-là ressusciterait un dossier que le
client a demandé de faire disparaître. Le filtre porte les deux colonnes, bien
qu'une seule suffise : c'est une garantie qu'on veut pouvoir lire.

### La conséquence à connaître, et qui est le prix de ce qu'il a demandé

Une fiche client est désormais **partagée entre plusieurs chantiers**. Corriger
l'adresse du client depuis le devis du chantier B la corrige aussi sur le devis
du chantier A. C'est le sens même d'une fiche client — et l'adresse **du
chantier** reste, elle, propre à chaque chantier (`chantiers.adresse_chantier`).

**Ce qui n'existe pas, et qu'il faudra peut-être un jour :** aucun geste ne
permet de dire « ce chantier n'est pas ce client-là ». Deux homonymes que rien
ne distingue sont rapprochés définitivement. Consigné dans `TODO.md` plutôt que
codé à l'avance : une commande de démixage jamais employée coûterait plus cher à
tenir qu'à attendre.

### Éprouvé

- `scripts/test-rapprochement-client.ts` — 19 cas, la règle sans base. Le
  père et le fils, la civilité, les graphies de téléphone, le non-écrasement.
- `scripts/test-rapprochement-client-db.ts` — 8 cas, dont **l'isolation** : le
  rapprochement parcourt la liste des clients, et une suite navigateur (qui
  traverse la RLS) ne verrait jamais un chantier rattaché chez le voisin.
- `scripts/test-rapprochement-client-e2e.ts` — son parcours : deux chantiers
  créés au formulaire, une seule fiche, et **« 2 chantiers »** sur l'écran.

**La suite base sait rougir** : confrontée à l'ancien comportement — un
rapprochement qui ne trouve jamais rien — elle rend quatre échecs, dont le cas
du patron. Un contrôle jamais vu rouge ne prouve rien (`AGENTS.md`).

**Et un piège payé en l'écrivant** : la préparation d'un cas passait par
`db.update(…)` plutôt que par `withEntreprise`. La RLS annule ces écritures
**silencieusement** — la ligne n'était pas supprimée, et le cas « un client
supprimé n'est pas réutilisé » passait au vert sans avoir rien supprimé
(`CLAUDE.md` §3).

---

## 123. Ses mots au catalogue : écrire dans un vocabulaire qui appartient à tout le monde

**Il a posé la même question deux fois, à trois jours d'écart, sur le même
écran** — le 14 puis le 17 août 2026, capture à l'appui : *« À quoi sert cette
page ?? On peut rien modifier rajouter »*. La première fois a produit une
explication (`docs/QUESTIONS.md` §18) et deux défauts inscrits dans `TODO.md`.
La seconde a produit ce lot. **Un écran qu'il faut expliquer deux fois n'est pas
mal compris : il ne dit pas ce qu'il fait.**

### Le problème, et il n'était pas d'interface

Le catalogue est le vocabulaire du métier : quand il dicte « faut me démonter le
sapin du fond », aucun mot de la phrase n'est « élagage » — c'est lui qui fait
le rapprochement. Mais `catalogue_prestations` et `catalogue_materiels` sont
**partagés entre toutes les entreprises** (migration 0007, aucun `entreprise_id`,
aucune RLS). Y écrire depuis son téléphone changerait le vocabulaire de tous les
autres artisans, sans qu'ils l'aient demandé ni qu'ils puissent le corriger.

L'écran était donc en lecture seule **pour une bonne raison**, et ne la disait
pas. Ce n'est pas un bouton qui manquait : c'est un endroit où poser ses mots.

### Ce qui a été retenu : l'arrangement B de la planche 72

Trois arrangements lui ont été montrés
(`docs/maquettes/72-mes-mots-au-catalogue.html`). Il a choisi **B**, et le choix
n'était pas cosmétique — il décide de ce que la dictée comprend ensuite :

| | Où vivent ses mots | Ce que ça coûte |
|---|---|---|
| A | une liste « Mes mots » sous celle d'Atlas | « écime » vit **à côté** d'« Élagage » : une dictée « écime-moi le tilleul » ouvrirait une prestation neuve au lieu de reconnaître l'élagage déjà chiffrable |
| **B** *(retenu)* | **dans** les cartes d'Atlas, en or, suivis de « vous » | un geste par carte, une couleur à tenir |
| C | tout mélangé | il croit corriger le commun, l'application refuse au moment du geste |

### La table, et ses quatre formes

`mots_catalogue` (migration 0052) porte `entreprise_id`, sa politique RLS et
rien d'autre que ses mots. Une seule table pour quatre formes, ce qui la rend
lisible d'un coup d'œil :

1. un mot posé sur une prestation d'Atlas → `prestation_id` ;
2. un mot posé sur un matériel d'Atlas → `materiel_id` ;
3. **son** entrée à lui → les trois renvois à `NULL`, `mot` porte le nom ;
4. un mot posé sur son entrée à lui → `parent_id`.

Deux contraintes tiennent l'ensemble : un seul ancrage à la fois, et une
famille accordée à son ancrage. Un index unique sur
`(entreprise_id, famille, lower(mot))` empêche le même mot de désigner deux
choses — « écimage » sous « Élagage » *et* sous « Taille de haie » ferait
hésiter le rapprochement au lieu de l'aider.

### Ce qui compte vraiment : un mot visible est un mot RECONNU

**C'est le piège que ce lot devait éviter, et il aurait été muet.** Un mot ajouté
à l'écran mais ignoré par la recherche donnerait le pire des deux mondes : il
croirait avoir appris quelque chose à Atlas, la dictée continuerait de ne pas
comprendre, et **rien ne le lui dirait**. Les quatre chemins de recherche
passent donc par la même fonction (`rechercherCartes`) : les deux outils de
l'agent, celui des synonymes, et le service de chiffrage.

**Les entrées d'Atlas passent devant les siennes**, et ce n'est pas un détail
d'affichage : quand « écime » a été posé SUR « Élagage », c'est « Élagage » qui
ressort — avec son historique de prix et ses questions de chiffrage. Une entrée
à lui n'a rien de tout cela.

**Le mot se pose court, et l'écran le dit.** Le rapprochement se fait par
inclusion, comme pour le vocabulaire commun : « écime » attrape « écime-moi le
tilleul », « écimage » ne l'attrape pas. Deux règles de rapprochement — une pour
le commun, une pour ses mots — auraient fini par diverger, et il aurait vu un
mot reconnu et l'autre non sans pouvoir deviner pourquoi.

### Ce que le même lot répare, et qui venait de ses captures

- **La flèche de retour existe enfin.** `ScreenHeader` savait l'afficher ;
  l'écran ne la lui avait jamais demandée. On arrivait ici depuis « Tarifs &
  catalogue » et on n'en repartait que par la barre du bas.
- **« Aucun prix encore constaté par votre entreprise » est retiré.** Cette
  phrase interrogeait `historique_prix` — l'ancienne mémoire, celle que
  l'application **n'écrit nulle part** — et **ne se serait donc jamais
  éteinte**, quoi qu'il fasse. Aucun montant ne la remplace : `lecons_prix`,
  la mémoire vivante, range par nature de chantier
  (`abattage|demontage_retention|d70`) et non par mot de catalogue. Afficher un
  prix d'abattage sous « Élagage » serait pire que la phrase d'hier, qui au
  moins n'inventait rien. **La question reste ouverte au bas de la planche.**
- **« Synonymes » et « Variantes » sont fondus en « Aussi appelé ».** Les deux
  lignes de sa capture disaient la même chose sous deux mots de jargon, et
  personne n'a jamais su ce qui allait dans lequel.
- **L'écran est passé à la charte** (`EnTeteEcran`, `design-tokens`). Il portait
  encore l'échelle de juillet (`p-4`, `text-ink/40`, `rounded-md`) : le réparer
  sans le redessiner aurait laissé un écran d'avant au milieu des autres.

### Un geste qui n'est PAS sur la planche, et pourquoi il existe quand même

**Retirer un de ses mots.** La planche ne le montrait pas ; sans lui, un mot mal
tapé resterait pour toujours et fausserait la dictée sans recours. Rien
n'atteint le vocabulaire commun — seuls ses mots à lui sont dans cette table, et
la RLS empêche d'effacer ceux d'une autre entreprise.

### Ce qu'Atlas PROPOSE de retenir — l'auto-alimentation, et sa limite

**Sa question, le 17 août, une heure après le lot ci-dessus :** *« ça veut dire
que le document s'autoalimente à chaque fois qu'on rajoute un nouveau mot dans
un devis ET QU'IL COMPREND CE QUE C'EST ? »*. La réponse était non ; il a
répondu « fais-le ».

**Sa condition est dans sa phrase, et elle commande tout le mécanisme.** Un mot
inconnu n'est proposé que si l'on sait à quoi il se rapporte. Concrètement
(`src/lib/mots-a-retenir.ts`), pour chacune des dix dernières dictées :

1. **de quoi parlait-elle ?** — la ligne qu'il a RETENUE sur son devis, et non
   ce qu'Atlas avait cru lire, doit être reconnue par le catalogue. Sinon, rien
   n'est proposé : retenir un mot dont on ignore le sens, c'est inventer une
   donnée (`CLAUDE.md` §4) ;
2. **quels mots restent inconnus ?** — ceux d'au moins quatre lettres, absents
   de la liste des mots ordinaires, et que rien du vocabulaire (celui d'Atlas
   comme le sien) ne reconnaît déjà.

**Atlas propose, il n'écrit pas.** Deux boutons sur l'écran du catalogue, et
l'extrait de la dictée au-dessus — « écime » seul ne lui dit rien trois semaines
plus tard ; *« faut m'écimer le tilleul du fond »* lui rend la scène.

**Le « non » se retient aussi** (migration 0053, colonne `refuse`). Sans lui, la
proposition reviendrait à chaque affichage — et une proposition qui revient
après un refus n'est plus une proposition. Le mot écarté reste en base, marqué :
il ne s'affiche pas, ne se cherche pas, ne se propose plus. **Mais il peut
changer d'avis** : écrire le mot à la main le relève (`ajouterMot`), sans quoi
l'index unique le refuserait en silence — il taperait « écime », rien
n'apparaîtrait, et aucune phrase ne dirait que c'est son propre « non » d'il y a
trois semaines qui le bloque.

**La liste des mots ordinaires vient de ses vraies dictées, pas d'un
dictionnaire.** *« Il FAUDRA écimer le GRAND tilleul du FOND »* proposait trois
mots pour un seul qui apprend quelque chose. Elle ne cherche pas
l'exhaustivité : un mot ordinaire qui passe au travers coûte un « non », et le
« non » est définitif.

### Ce que ce lot ne fait toujours PAS

**Le vocabulaire d'ATLAS ne s'alimente jamais tout seul**, et cette limite n'est
pas technique : il est commun à toutes les entreprises. Un mot appris chez un
artisan changerait les devis d'un autre, sans qu'il l'ait demandé ni qu'il
puisse le corriger. Tout ce qui est retenu entre dans SES mots, isolés par RLS.

**Et rien ne s'écrit sans son geste** — le dépôt le refuse depuis toujours
(`creerPrestationCatalogue` : « toujours déclenchée après confirmation explicite
de l'utilisateur »).
---

### L'or marque un MOT, jamais une prestation (corrigé le 17 août 2026)

**Sa correction, capture à l'appui** — « Entretient », qu'il venait d'ajouter, en
doré juste sous « Élagage » en noir : *« les nouvelles prestations doivent
toujours être en noir, pas en doré »*.

La couleur du titre marquait la **provenance** : le catalogue commun en noir, ses
entrées à lui en or. C'était cohérent avec l'or de ses mots — et c'est
précisément ce qui rendait la chose fausse. **Deux couleurs de titre dans la même
liste ne se lisent pas comme deux provenances, mais comme deux NATURES de
prestation** ; or il cochera les deux de la même façon sur un chantier, et le
rapprochement d'une dictée les traite de la même façon aussi.

**Où l'or garde son sens :** dans la ligne « Aussi appelé ». Là, il sépare deux
choses réellement différentes — le mot du commun, qu'on ne peut pas retirer, et
le sien, qu'un « × » enlève. Une distinction qui porte un geste mérite une
couleur ; une distinction qui n'en porte aucun ne fait que semer le doute.

Éprouvé sur la **couleur calculée**, pas sur un nom de classe : un jeton de
charte qui changerait de valeur passerait au travers d'un contrôle qui ne
regarde que la règle CSS (`test-catalogue-mes-mots-e2e.ts`). Rouge en remettant
l'or, et son message donne les deux couleurs lues.


## 124. « Adresse non renseignée » devient une porte — et rien d'autre ne bouge

**Sa demande du 17 août 2026**, capture de son accueil à l'appui : *« j'ai oublié
de rentrer les infos du client. Il faut qu'à partir de cette page, il y a marqué
adresse non renseignée, que je puisse cliquer dessus »*.

**Puis sa correction, le même jour, et c'est elle qui compte.** Une première
planche avait dessiné une « fiche client » de toutes pièces, avec ses champs et
ses questions. Il a répondu : ***« je ne suis pas sûr que tu aies bien compris
[…] que ça m'amène sur la page que je t'ai envoyée sur la deuxième photo. RIEN
DE PLUS, RIEN DE MOINS. »*** — sa seconde photo montrait l'écran de création.

### La leçon, et elle a coûté deux allers-retours

**Devant une demande qui touche à un écran, chercher d'abord SI L'ÉCRAN
EXISTE.** Ici la réponse était sous la main, dans sa propre capture. En dessiner
un neuf lui a fait relire une planche entière pour dire « ce n'est pas ça ».

Ce qui avait égaré : le code lui-même annonçait qu'il manquait une fiche client
— *« la civilité ne se corrige plus après coup, faute d'écran de fiche client »*
(`DevisCompletClient.tsx`). C'était vrai, et ce n'était pas sa demande. **Un
manque réel du produit n'autorise pas à le combler dans le lot d'à côté**
(`CLAUDE.md` §3 bis).

**Et il ne manque plus :** une autre session a codé la fiche du client le même
jour (§121), atteinte depuis le chantier. Les deux écrans ne se marchent pas
dessus et ne doivent pas être confondus — **celui-ci corrige les coordonnées d'un
chantier**, celui-là **montre ce que l'application sait d'un client** (combien de
fois il est venu, ce qu'il doit). C'est la meilleure preuve que la fiche
inventée ici aurait été un troisième écran de trop.

### Un seul composant, deux chemins d'écriture

`FormulaireNouveauChantier` reçoit une entrée `reprise` : présente, il préremplit
et **enregistre** au lieu de créer. Un formulaire jumeau aurait divergé au
premier champ ajouté — l'un garderait le canal d'envoi, l'autre l'aurait oublié.
C'est la raison qui l'avait déjà fait extraire de sa page le 10 août.

| | Créer | Reprendre |
|---|---|---|
| Route | `/chantiers/nouveau` | `/chantiers/[id]/coordonnees` |
| Action | `creerChantierAction` | `reprendreChantierAction` |
| Titre | « Fiche client » | « Fiche client » |
| Bouton | « Créer le chantier » | « Enregistrer » |

**Il ne reste qu'UN mot qui change**, et c'est le bouton : « Créer le chantier »
annoncerait une action que l'écran ne fait pas, et le patron chercherait ensuite
pourquoi il a deux chantiers.

**Le surtitre a disparu le 16 août 2026**, sur sa demande — *« Enlève nouveau un
chantier et remplace par fiche client »*, capture à l'appui. Il portait
« Nouveau » à la création, et « Les coordonnées » en reprise **pour la seule
raison que « nouveau » aurait été faux** au-dessus d'un chantier ouvert trois
jours plus tôt. Le titre ne disant plus « nouveau », ce contre-mot n'a plus rien
à contrer : « Fiche client » est vrai des deux côtés. Lui garder une ligne
au-dessus aurait obligé à inventer un mot qu'il n'a pas demandé (`CLAUDE.md` §4).

*Ce que le contrôle garde encore, et qui suffit :*
`test-coordonnees-depuis-accueil-e2e.ts` refuse que « NOUVEAU » reparaisse sur un
chantier qui existe — la garde tient, quel que soit l'endroit d'où le mot
reviendrait.

*Détail vu à l'écran, pas dans le code :* le micro de la dictée était aligné par
le haut (`items-start`), ce qui le posait au-dessus d'un titre devenu seul sur sa
ligne. Passé en `items-center` — les deux centres tombent désormais sur le même
pixel.

### Le client est RETROUVÉ, jamais recréé

Un chantier sans client en gagne un dès qu'un nom est saisi — et ce nom passe par
`trouverOuCreerClient` (§122), arrivé le même jour : *« si c'est monsieur Martins
et qu'on a déjà une fiche client monsieur Martins, le devis, la facture s'ajoute
à la fiche de monsieur Martins »*.

**Passer par `creerClient` ici aurait fabriqué le doublon que l'autre porte vient
d'apprendre à éviter**, et le patron aurait vu deux fiches Martins selon qu'il a
rempli le chantier à sa création ou après coup. Un chantier qui a DÉJÀ un client
voit le sien mis à jour : le recréer laisserait un orphelin derrière, et les
devis déjà partis pointent sur le premier.

### Le nom du chantier se RECALCULE, et c'est tout l'intérêt du geste

`chantiers.nom` n'est pas saisi : il se déduit du client, sinon de l'adresse,
sinon de la date (`nom-chantier.ts` — le champ « nom du chantier » a été retiré
le 5 août 2026, *« un élagueur ne baptise pas ses chantiers »*).

**Sans ce recalcul, remplir « Martins » aurait laissé la ligne afficher
« Chantier du lundi 17 août » pour toujours** — le défaut corrigé partout sauf à
l'endroit exact d'où il est parti. La règle appliquée est la MÊME qu'à la
création : une seconde règle de nommage aurait fini par diverger.

**Et la date employée est celle de la CRÉATION**, jamais aujourd'hui. Un chantier
ouvert le 17 et repris le 20 ne doit pas devenir « Chantier du jeudi 20 août » :
il ne se reconnaîtrait plus.

### La mention seule est la cible — et la ligne reste UN SEUL lien

Le nom du chantier garde sa reprise, et **sa règle du 13 août n'est pas
touchée** : *« que ça me renvoie à l'étape où je me suis arrêté »*. Il a dit
« cliquer DESSUS », pas « sur la ligne ».

**UNE LIGNE = UN SEUL `<a>`, ET CET INVARIANT A ÉTÉ DÉCOUVERT EN LE CASSANT.**
Un lien dans un lien n'étant pas du HTML valide, la première version avait coupé
le lien de la ligne en trois — le nom, la mention, l'état. C'était valide, et
**trois suites sont tombées d'un coup à la batterie** :

| Suite | Ce qu'elle supposait |
|---|---|
| `test-dashboard-e2e` | compte les lignes par `a.atlas-brin` — il n'y avait plus d'ancre portant cette classe |
| `test-suivi-devis-e2e` | remonte du nom à `ancestor::a[1]` pour y lire l'état — l'état était dans une AUTRE ancre |
| `test-transcription-e2e` | clique au milieu de `.atlas-ligne` — le milieu tombait entre deux ancres |

Aucune des trois n'avait tort : **la ligne EST un lien, et ce qu'on lit dedans
doit rester dedans.** La mention est donc un `<span role="link">` posé DANS
l'ancre — contenu de phrasé, parfaitement légal — qui détourne le geste vers le
routeur. Un contrôle dédié compte les ancres de la ligne pour que personne ne
recommence sans le voir (`test-coordonnees-depuis-accueil-e2e`).

**Ce que ça enseigne au-delà de ce lot :** un changement de STRUCTURE dans un
composant partagé casse des suites qui ne parlent pas de lui. Trois rouges dont
aucun ne nommait la mention — c'est la batterie complète qui les a montrés,
et c'est exactement ce pour quoi elle existe (`CLAUDE.md` §5).

**Une seule source décide de ce qu'est une cible** : `lieuEstManquant`, comparée
à `LIEU_MANQUANT`. L'accueil qui aurait comparé le texte de son côté aurait
refait la règle une seconde fois — et le jour où le repli change de mots, la
mention cesserait silencieusement d'être cliquable.

### Ce que la capture a trouvé, et qu'aucun test ne voyait

**Sixième fois dans ce dépôt qu'un défaut sort d'une image.** La cible fait 34 px
de haut — un texte de 11,5 px ne s'attrape pas sous un pouce ganté —, et le trait
pointillé était porté par le lien : il se posait donc au **bas des 34 px**, à dix
pixels sous le mot. Ce n'était plus un soulignement, c'était un trait perdu. Il
vit désormais sur un `<span>` intérieur.

**La capture elle-même a menti une fois de plus** : l'image « après » visait
`.atlas-fil-defile`, c'est-à-dire le cadre lui-même. Le calcul de position valait
zéro, et la photo montrait le HAUT du fil au lieu de la ligne corrigée. Une
capture qui cadre autre chose que ce qu'elle annonce ne prouve rien.

---

## 125. Les outils métier : un cinquième onglet, et ce qu'il coûte à la barre

**Sa question du 17 août 2026 :** *« L'idée, c'est de créer des outils comme
celui-là pour les paysagistes ; après je ferai la même chose pour les terrasses
bois. Pour toi le mieux c'est de créer une nouvelle catégorie paysage ? Ou
alors on range ça dans les réglages, sous une catégorie paysage ? »*

**Ce qui a été écarté, et pourquoi.**

- **Les Réglages, non.** On y règle ce qui vaut une fois pour toutes — tarifs,
  équipe, TVA, identité. Un plan d'arrosage se refait à chaque client, comme un
  devis. L'y ranger le nommerait mal et l'enterrerait sous quinze rubriques.
- **Une catégorie « Paysage », non plus.** Le paysage est son métier ENTIER :
  le mot ne distingue rien de ce que l'application fait déjà. Ce qu'il sépare
  en réalité, ce sont des **outils de calcul** — arrosage, terrasse bois — face
  au parcours commercial (chantier, devis, facture).
- **Attaché au chantier seul** — ma recommandation — **écartée par lui.** Elle
  avait pour elle que le plan est toujours fait *pour quelqu'un* et se
  retrouverait six mois plus tard chez le bon client. Son objection tient : un
  outil qui exige un chantier ne sert pas en visite de devis, quand le client
  n'existe pas encore.

**Sa décision : un cinquième onglet.** Nommé « Outils » d'abord, puis
**« Paysage »** le soir même — voir §125 bis, plus bas.

**LE COÛT EST MESURABLE, ET IL A ÉTÉ MESURÉ** (`docs/maquettes/76-le-cinquieme-onglet.html`).
La barre porte quatre onglets depuis le 10 août, en capitales de 9,5 px
espacées de 0,28em, sans icône — son choix d'alors (*« quatre pictogrammes
sous quatre mots répétaient la même information »*). Passer à cinq fait tomber
la colonne de 89,5 à **71,6 px** sur un écran de 360. Or « CHANTIERS », le plus
long des cinq mots, en demande 78,8.

| Variante | Largeur de « CHANTIERS » | Verdict |
|---|---|---|
| A · cinq onglets, rien d'autre changé | 78,8 px | **déborde de 7,2** |
| B · espacement resserré à 0,18em | 70,3 px | tient de **1,3 px** — faux confort |
| C · lettre à 8,5 px, espacement 0,14em | 59,8 px | tient, 11,8 px de marge |
| D · icône au-dessus du mot | 56,8 px | tient, 14,8 px de marge |

**A est donc à écarter, et B aussi :** 1,3 px de marge ne survit pas à un
changement de police entre téléphones, et le défaut serait invisible ici pour
apparaître chez lui. **D revient sur sa décision du 10 août** (les icônes
retirées) — recevable, puisque le service rendu n'est plus le même à cinq
colonnes qu'à quatre : viser sans lire. Mais c'est à lui de le dire.

**La réponse dans sa langue est dans `docs/QUESTIONS.md` §22**, avec son
accord explicite — pour que la question ne se repose pas dans trois mois.

**Ce qui reste à trancher avec lui**, et qui n'est pas de la place : l'onglet
porte une LISTE d'outils (arrosage, puis terrasse bois), donc il s'appelle
« Outils » et non « Arrosage » ; et il faudra pouvoir **rattacher un plan à un
chantier après coup**, sans quoi un plan fait en visite de devis se perdra —
c'est précisément ce que l'accès sans chantier fait gagner et risque de coûter.

---

---

## 125 bis. « Paysage » plutôt qu'« Outils » — il revient sur son choix, et il a raison

**Le 17 août au soir, après avoir vu l'onglet posé :** *« As-tu créé la fiche
outils ? Je préférerais qu'elle s'appelle Paysage finalement. »*

**J'avais écarté ce mot le matin même**, et voici l'argument que j'avais donné :
le paysage est son métier ENTIER, donc le mot ne distingue rien de ce qu'Atlas
fait déjà. **Cet argument était faux, et il faut dire pourquoi** — sans quoi
quelqu'un le ressortira.

Il partait d'une prémisse implicite : qu'Atlas restera l'application d'un
paysagiste. Or ce n'est pas le produit — Atlas sert des artisans, et lui-même
prépare déjà la terrasse bois. **Dans une application multi-métiers, « Paysage »
distingue exactement ce qu'il faut** : le jour où un menuisier s'en sert, il
aura un onglet « Menuiserie » à côté. Deux listes d'« Outils » auraient au
contraire demandé de les départager en entrant.

**Et le mot vaut mieux pour une seconde raison, qui touche à ce qu'il montre.**
« Outils » nomme la NATURE de ce qu'il y a dedans — des calculateurs.
« Paysage » nomme le MÉTIER servi. Le second se lit sans savoir ce qu'on va y
trouver ; le premier demande d'ouvrir pour comprendre.

**Ce qui ne change pas :** l'onglet porte une LISTE (l'arrosage, puis la
terrasse bois), et c'est pourquoi il ne s'appelle pas « Arrosage » — il faudrait
le renommer au second occupant, et un onglet qui change de nom fait perdre le
repère de celui qui l'ouvre vingt fois par jour.

**La place n'est pas un sujet ici** : « PAYSAGE » fait sept lettres contre neuf
à « CHANTIERS », qui reste le mot qui décide. `test-barre-basse-e2e.ts` le
vérifie à 360 px, et un cas de plus exige que le libellé et l'adresse aillent
ensemble — renommer l'un sans l'autre donnerait un onglet « Paysage » qui ouvre
`/outils`, donc un 404 que personne n'aurait voulu.

---

## 126. « L'appli est super lente », deux soirs de suite — et deux causes différentes

**Le 16 août, puis le 17 : le même message, la même lenteur, et pourtant deux
pannes distinctes.** Le piège de ce genre de défaut est là : le symptôme est
identique, le remède de la veille est toujours en place, et il ne suffit plus.

### Ce que sa fiche disait, et qui a tranché en dix secondes

```
Code SERVI : AUCUNE — la construction a ÉCHOUÉ (2026-08-17T19:34:24Z)
dit: ⨯ Another next build process is already running.
```

C'est la fiche d'état publiée par son espace (`CLAUDE.md` §1 bis) qui a donné
cette ligne, sans qu'il ait rien à recopier depuis son téléphone. **Sans elle,
la première hypothèse aurait porté sur le réseau ou sur la base** — et le
message tenait en une phrase.

### La cause du 16 : une construction orphelinée AU DÉMARRAGE

`demarrer.sh` pose un veilleur avant la mise à jour ; ce veilleur lance un banc,
donc une construction. La mise à jour remplace ensuite veilleur et serveur — et
laissait la construction derrière. Corrigé le 16 en ajoutant `build` au motif du
`pkill` de démarrage. **Ce correctif tient toujours, et il reste nécessaire.**

### La cause du 17 : la même chose, mais N'IMPORTE QUAND après

Son espace a **8 Go de mémoire, dont 181 Mo libres** au moment de la panne.
Quand la mémoire manque, le noyau tue un processus. S'il tue le banc, **sa
construction lui survit** : elle garde le verrou du système, le veilleur
constate qu'aucun serveur ne répond, relance un banc, et celui-là se heurte à
l'orpheline. Le `pkill` du démarrage n'y peut rien — le démarrage est passé.

**Et un second trou, plus discret, ouvrait la même porte :** le verrou de banc
(`/tmp/atlas-banc.pid`) regardait si le fichier existait, *puis* l'écrivait.
Deux bancs qui démarrent dans la même seconde — l'espace à l'allumage, le
veilleur qui croit le serveur mort — ne trouvaient donc rien ni l'un ni l'autre.
Deux bancs, deux constructions, un seul verrou chez Next.

### Ce qui est posé

| | Ce que ça fait |
|---|---|
| `scripts/verrou-construction.mjs` | déloge les constructions **orphelines** avant de bâtir, et attend que le noyau rende le verrou |
| `banc.mjs` | une **seconde tentative**, et une seule, quand c'est ce refus-là qui a parlé |
| `verrou-banc.mjs` | le verrou se prend en **création exclusive** (`wx`) : un seul des deux bancs peut réussir |

**Pourquoi tuer l'orpheline ne contredit pas la règle « ne jamais effacer le
verrou ».** Les deux gestes n'ont rien à voir. Effacer le fichier `lock` ne
libère rien — Next prend un verrou auprès du système — et lancerait une SECONDE
construction à côté de la première : le remède qui tue, déjà payé deux fois.
Ici, on ne double pas, **on retire ce qui n'a plus de destinataire** : la
construction orpheline chauffe un processeur que son voisin attend, garde le
verrou, et son succès ne servirait personne, puisque le banc qui aurait basculé
dessus est mort.

**Les contrôles tuent un vrai processus** (`scripts/test-verrou-construction.ts`,
`scripts/test-bascule-veilleur.ts`), sur un motif d'essai distinctif qui ne peut
pas toucher une construction réelle. Éprouvés rouges avant d'être livrés :
délogement neutralisé → le premier rougit ; création exclusive retirée → deux
cas rougissent, dont celui du 10 août.

### Ce que ça ne règle PAS, et qu'il faut savoir

**La mémoire reste étroite.** Bâtir Next sur 8 Go pendant qu'un serveur de
développement tourne est près de la limite ; si le noyau tue à nouveau le banc,
le prochain démarrage repartira proprement — mais il repartira. Le vrai remède,
si cela revient, est d'augmenter la machine ou de cesser de servir en mode
développement pendant la construction.
---

## 127. « Toujours pas poser de date » — une fonction écrite, jamais branchée

**Le patron, le 17 août 2026**, capture de son planning à l'appui : *« je peux
toujours pas poser de date sur les chantiers test, corrige ça ! »*

**« TOUJOURS » N'EST PAS UNE FIGURE DE STYLE.** Une autre session l'avait déjà
constaté le même jour et l'a écrit dans le journal : *« le patron s'est retrouvé
bloqué, la pose à la main lui échappant »*. Sa réponse a été de faire **pré-poser
un chantier par un script**, pour que la fonctionnalité qu'elle éprouvait ait un
point de départ. Le contournement a marché ; le geste, lui, est resté cassé.

### Ce qui était cassé, et ce qui ne l'était pas

**Le geste marchait de bout en bout.** Toucher le chantier, toucher un jour,
choisir la demi-journée, poser : `test-planning-e2e` le parcourt entièrement, et
il était vert.

Ce qui manquait n'était pas une fonction, c'était **le raccord**. Mesuré sur son
écran de 664 px, après l'appui sur un chantier de « Sans date » :

| | |
|---|---|
| Le calendrier | à **231 px AU-DESSUS** du haut de la fenêtre |
| Ce qui en dépassait | sa dernière rangée — les « 31 1 2 3 4 5 6 » de sa capture |
| Journée ouverte | aucune |
| Ce que l'écran disait de faire | rien |

La ligne annonçait « À poser » et **l'écran n'offrait aucun chemin.** De là, un
artisan conclut que la fonctionnalité n'existe pas. Il a conclu deux fois.

### La fonction existait déjà — elle n'était appelée que d'un seul endroit

`amenerAuCalendrier` était écrite, et sa propre note annonçait sa raison d'être :
*« le geste part maintenant de DEUX endroits — la liste "Sans date" et la feuille
du chevron »*. Elle pose le chantier à placer, referme la journée ouverte, et
**amène le calendrier sous les yeux**.

La feuille du chevron l'appelait. **La liste « Sans date » ne l'a jamais
appelée** : elle faisait `setAPoserId` en direct. Un mot dans un `onClick`.

**Ce que ça enseigne, et qui vaut au-delà :** une fonction dont le commentaire
annonce deux appelants et qui n'en a qu'un est un défaut visible à la lecture,
pas à l'exécution. Rien ne rougit ; l'intention est écrite et démentie par le
code d'à côté.

### Pourquoi aucune suite ne le voyait, et le contrôle qui le tient maintenant

**Playwright fait défiler un élément jusqu'à lui AVANT de cliquer dessus.** Un
contrôle qui « clique » n'éprouve donc jamais si la cible était ATTEIGNABLE — il
éprouve qu'elle existe. Toutes les suites du planning cliquaient ; toutes
étaient vertes ; et le patron, lui, ne voyait pas le calendrier.

`test-poser-une-date-e2e` ne clique pas pour vérifier : il **mesure la position
du calendrier dans la fenêtre** avant et après l'appui, ce qu'aucun clic ne peut
dire. Il exige aussi que la scène soit bien la sienne — si le calendrier était
déjà visible avant l'appui, il refuse de conclure plutôt que de rendre un vert
qui ne prouve rien (`CLAUDE.md` §5).

**Remis à `setAPoserId`, il rougit et nomme le coupable :** *« le calendrier
n'est pas venu sous les yeux : −13 → 287 pour 664 px d'écran (il était à −13
avant l'appui) »*.

---

## 128. « La catégorie client n'a pas été créée » — la liste, et pourquoi pas un onglet

**Sa remarque du 17 août 2026 au soir**, une heure après la livraison de la
fiche client : *« la catégorie client n'a pas été créée »*. Elle était juste, et
elle disait quelque chose que la planche 66 n'avait pas vu.

**Ce qui existait, et ce qui manquait.** L'arrangement B — retenu par lui la
veille — donne une **fiche** par client, atteinte en touchant son nom depuis un
chantier. Elle répond à « que sais-je de ce client-là ? ». Elle ne répond pas à
« qui sont mes clients ? », ni à « comment je retrouve celui dont je ne me
rappelle plus le chantier ? ». C'est la moitié de C — la liste — qui manquait,
sans son coût.

### Pourquoi pas le cinquième onglet, cette fois encore

Le 16 août, C avait été écarté parce que « qui me doit de l'argent ? » a déjà
son écran (Terminés → TVA). Le 17, un second argument s'y ajoute et il est
définitif : **le cinquième onglet est pris.** Il revient aux outils métier
(§125), et à cinq colonnes sur 360 px « CHANTIERS » déborde déjà de 7,2 px —
mesuré, pas supposé. Un sixième onglet ne se discute même pas.

**La liste s'ouvre donc depuis l'accueil**, sous le compteur « quatre en
cours », en or et en petites capitales : la grammaire de ce bloc est celle de
ce qu'on LIT. L'action de l'écran reste « Nouveau chantier », et rien ne doit
lui disputer l'œil (§ sur le bouton retenu).

### Ce qui tient les deux écrans d'accord

`composerFicheClient` sert la liste **et** la fiche. Deux façons d'additionner
ce qu'un client doit finiraient par se contredire — et c'est lui qui verrait la
différence en passant de l'une à l'autre, sur le même client, à trois secondes
d'intervalle.

**Quatre requêtes, pas cinq par ligne.** Charger la fiche complète de chaque
client à tour de rôle aurait rendu la liste d'autant plus lente qu'il a de
clients : l'écran serait devenu inutilisable au moment précis où il devient
utile. Les chantiers, les factures émises, les règlements et les lignes de prix
sont lus en bloc, puis regroupés en mémoire.

**Et rien ne s'invente** : un client sans facture affiche « rien de facturé »,
jamais « 0 € ». Un zéro se lit comme un mauvais payeur (`CLAUDE.md` §4).

### Le contrôle qui gardera la barre du bas

`scripts/test-fiche-client-e2e.ts` compte les onglets après avoir ouvert la
liste : à cinq, il rougit. C'est le genre de dérive qui arrive par petits pas,
et personne ne la mesure au moment où elle passe.

---

---

## 129. Deux rubriques pour la même chose — « Planning » supprimée des réglages

*Sa question du 16 août 2026, capture à l'appui : **« quelle est la différence
entre planning et équipe ? »**. Il n'y en avait pas.*

| La rubrique | Ce qu'elle rendait |
|---|---|
| Réglages ▸ **Planning** | `<VosEquipes>` — combien partent en même temps, leurs noms |
| Réglages ▸ **Équipe** | `<VosEquipes>` **+** `<AbsencesEquipe>` |

Le même composant, aux mêmes valeurs. « Planning » était donc un **sous-ensemble
strict** de « Équipe » : deux portes vers le même réglage, et rien pour dire
laquelle ouvrir.

### Pourquoi le doublon a pu naître, et ce qui le rendait invisible

La rubrique promettait *« horaires, équipes et disponibilités »* — trois choses,
dont **une seule existe**. Les horaires ne se règlent pas : le planning raisonne
en demi-journées, et chaque jour est libre ou porte le nom de son chantier. Les
disponibilités, ce sont les absences — arrivées le 15 août **dans l'autre
rubrique**, sur sa maquette 55. Le jour où elles y sont entrées, « Planning »
n'avait plus rien à lui.

**Aucun contrôle ne pouvait le voir**, et il ne faut pas en attendre un : les
deux écrans étaient corrects, chacun de son côté. C'est une question de sens, et
elle s'est posée en ouvrant la rubrique — comme les quatre défauts sortis d'une
capture plutôt que d'un test.

### Ce qui a été retiré, et ce qui ne l'est pas

`src/app/reglages/planning/` disparaît, avec son entrée de sommaire et ses
quatre mentions d'outillage (préchauffage, deux suites de mise en page, le script
de captures). **Aucune règle métier n'est touchée** : `VosEquipes`,
`AbsencesEquipe` et tout ce qui les alimente restent où ils sont, dans « Équipe ».

**La garde du préchauffage l'aurait attrapée si on l'avait oubliée** :
`test-prechauffage.ts` compare la liste écrite à la main aux écrans réellement
présents sur le disque, et nomme celui qui diverge.

### Ce qu'il ne faut pas refaire

Le jour où les horaires viendront — « on commence à 8 h » —, **ne pas recréer une
rubrique « Planning » qui remontrerait les équipes**. Soit ils rejoignent
« Équipe », soit ils ont une rubrique qui ne parle QUE d'horaires. La réponse est
écrite dans la langue du patron : `docs/QUESTIONS.md` §21.

---

## 130. Le calcul d'arrosage sort de l'écran — `appli/arrosage-calcul.js`

**Le problème, posé le 18 août 2026.** Il a demandé un second écran : *« une
fois que j'ai envoyé la photo [...] tout ce qu'il y a en dessous, tu peux le
supprimer. Et tu me fais le plan en couleur [...] et la liste des pièces à
acheter. »* Deux pages devaient donc rendre **le même plan et la même liste**,
à partir du même catalogue.

**Ce qu'on n'a PAS fait : recopier le calcul dans la seconde page.** Le §3 du
dépôt l'interdit — *« jamais de règle dupliquée entre l'affichage et la
vérification »* — et la raison est ici très concrète : cette liste est ce qu'il
commande chez son fournisseur. Deux versions qui divergent, ce sont deux
camions de pièces différents pour le même jardin.

Le calcul vit donc dans **`appli/arrosage-calcul.js`** : mise en forme, état et
sauvegarde, règles de pose (`pointsDeLaPose`, `poser`), découpage en réseaux
(`decouper`), hydraulique (`amenee`, `perteDeCharge`), et la liste
(`listeMateriel`). `arrosage.html` et `arrosage-croquis.html` ne font plus que
**dessiner** ce qu'il rend.

**La clé de sauvegarde est la seule chose qui les sépare.** Le module lit
`window.CLE_ETAT` avant de se charger ; la maquette pose
`atlas-arrosage-croquis`. Sans cela, l'essayer effacerait le jardin qu'il a
saisi dans l'outil — et rien ne le lui aurait dit.

### Le défaut que cette extraction a fabriqué, et ce qu'il enseigne

`corpsCourant()` est resté dans `arrosage.html`. `listeMateriel` l'appelle pour
compter un corps sous chaque tuyère : **toute page autre que celle-là partait
donc en `ReferenceError` dès qu'un jardin posait une tuyère.** L'écran, lui,
rendait *« la liste se remplit dès qu'un jardin est lu »* — un vide qui
ressemble à un état normal.

Les 73 suites de l'arrosage et les 105 de l'appli étaient vertes. **Aucune ne
demandait la liste d'un jardin MIXTE** — turbines sur la grande pelouse,
tuyères dans le couloir étroit —, le seul cas qui traverse cette ligne.

Deux règles en sortent, et elles valent au-delà de ce fichier :

1. **Une pièce de calcul qui reste dans un écran est une pièce que le second
   écran n'a pas.** À l'extraction, ce n'est pas le fichier d'arrivée qu'il
   faut relire, c'est le fichier de DÉPART : ce qui y reste et que le module
   appelle est un piège armé.
2. **Un écran qui ne sait pas dire « je suis tombé » ment.** La liste vide
   parlait comme une liste pas encore remplie. C'est le corollaire du piège 0
   ter de `HANDOVER.md`, en version statique.

## §126 bis. Le plan : ce que le dessin doit prouver

Le plan de `arrosage-croquis.html` reprend le sien (sa photo du 17 août) : les
réseaux séparés par la couleur, la nourrice dans son regard, le PE en
pointillés, les arroseurs en ronds — **et la dripline non tracée**, sa
consigne.

**Trois défauts du dessin, tous trouvés sur une capture, jamais par un test.**

| Ce qui était dessiné | Ce que ça donnait à lire | Corrigé par |
|---|---|---|
| Une ligne de tuyau par RANGÉE | Une rangée avec une seule tête de ce réseau n'avait pas de ligne : l'arroseur flottait, relié à rien | Un tracé de proche en proche, à angle droit, depuis la tête la plus près du regard |
| Un serpentin dans l'ordre de pose (première correction) | Le tuyau repartait du bout d'une rangée chercher une tête à l'autre bout, **en traversant les arroseurs d'un autre réseau** — un té à lire là où il n'y a rien | idem |
| Bande de massif grise et anonyme | Deux couleurs au dessin, trois voies à la nourrice, et rien ne disait où passait la troisième | `reseauxDeZone`, ajouté à `decouper()` : la bande porte la couleur de SA vanne |
| Contour de pelouse tracé APRÈS les tuyaux | La rangée du bas — dont les têtes sont posées sur la bordure — voyait son tuyau repeint par le trait noir | Le contour passe avant |

**`reseauxDeZone` mérite son existence.** `reseauDuPoint` ne répond que pour une
TÊTE, et un massif n'en a aucune : le goutte-à-goutte occupait donc une voie de
la nourrice qu'aucun trait du plan ne justifiait.

**Et le piège de la feuille de style s'est présenté une seconde fois.** Une
règle CSS l'emporte sur un attribut de présentation : `.massif{stroke:…}`
écrasait la couleur portée par l'attribut, exactement comme `.gazon{fill:…}`
avait effacé les cercles de portée de la planche 75. Les deux propriétés qui
arrivent par attribut ont été retirées de la feuille, avec le commentaire qui
dit pourquoi.

## §126 ter. Une suite qui ne barre pas la publication ne barre rien

`appli/tests/essai-arrosage-detaille.cjs` (73 contrôles) avait son adresse
écrite en dur — `127.0.0.1:8099`. Elle ne pouvait donc être jouée qu'à la main,
et `pages.yml` ne l'appelait pas : **elle ne barrait aucune mise en ligne.**
C'est exactement ce qui a laissé passer le défaut de `corpsCourant`.

Elle lit désormais `BASE_URL`, et le flux de publication l'enchaîne avec
`appli/tests/essai-croquis.cjs` (25 contrôles). Les trois suites barrent la
publication ; un rouge, et la version en ligne reste celle d'avant.

**Les six contrôles de la nouvelle suite ont été vus ROUGE avant d'être
gardés**, en réintroduisant chaque fois le défaut qu'ils prétendent attraper —
`corpsCourant` retiré, le tuyau redessiné par rangée, la bande redevenue grise,
une pièce composée à la main dans un casier, la clé de sauvegarde de l'outil
reprise, un texte qui déborde. Aucun ne regarde un identifiant d'écran : ils
interrogent le calcul et le tracé, et survivront au prochain remaniement de la
page — il en a déjà demandé deux.

## §126 quater. La liste dit ce qu'on achète, pas pourquoi

**Sa consigne du 18 août au soir**, devant la capture du casier « Le réseau
enterré » : *« Départ milieu de ligne, fin de ligne et jonction, ce sont des
données pour toi, pour que tu comprennes les endroits où doit y avoir des tés
et les autres où c'est des tés taraudés. Mais pour l'utilisateur, il n'a pas
besoin de ces infos-là. Donc tu peux les supprimer, mais tu les gardes pour
toi. »*

**La règle qui en sort :** une ligne de la liste porte la **désignation du
catalogue**, et rien d'autre. Il commande sur cette désignation ; ce qui s'y
ajoute est une invitation à chercher chez son fournisseur une pièce qui
n'existe pas sous ce nom. Le raisonnement, lui, reste en commentaire dans
`listeMateriel` — le supprimer serait le reperdre à la prochaine conversation.

| Retiré | Ce que c'était |
|---|---|
| `(départ/milieu de ligne)` | l'emploi du té taraudé |
| `(fin de ligne)` | l'emploi du coude taraudé |
| `(jonction, non taraudé)` | l'emploi du té 25×25×25 — et c'était dans le CATALOGUE |
| `(~2 m par arroseur)` | la règle du compte du PEBD Ø16 |
| `(haut, au corps)` / `(bas, sur la ligne)` | les deux emplois du coude SBE |

**Les références ne se confondent pas pour autant** : le té de ligne est taraudé
(25×3/4"×25), la jonction ne l'est pas (25×25×25), le coude de fin est un
coude. Trois produits différents, pas trois emplois d'un même.

### Sauf les SBE — et c'est pourquoi ils fusionnent

Les deux coudes SBE, eux, **sont** deux emplois d'un même produit dès que le
corps est en 3/4" (les grosses turbines : PGP, I-20). Retirer les mentions sans
plus aurait donné **deux lignes identiques**, ce qui se lit comme un défaut de
comptage. Les emplois s'additionnent donc par **référence** : un produit, une
ligne, une quantité. C'est aussi ce qu'il commande.

### Ce que cette consigne a coûté aux contrôles, et ce qu'elle leur apprend

**Trois contrôles lisaient ces étiquettes**, sur deux suites — deux dans
`essai-arrosage-detaille.cjs` (« le SBE du haut suit le diamètre de chaque
corps », « le SBE du bas reste un par arroseur »), un dans `e2e.js`. Ils sont
devenus rouges sur du code juste.

Ils vérifient maintenant la **règle en quantités** : un SBE 1/2" par corps de
tuyère, un SBE 3/4" par corps de turbine plus un par arroseur, deux SBE par
arroseur au total. **Un contrôle accroché à un libellé meurt au premier
changement de libellé** — la même leçon que le 17 août, quand la section 3 a
disparu de l'écran et que ses contrôles ont dû être reportés sur `decouper()`.

**Et une garde nouvelle refuse de conclure sur un cas jamais rencontré.** Le
contrôle « une référence n'apparaît qu'une fois » ne pouvait pas rougir : les
trois jardins d'exemple posent tous des corps en 1/2" (3504, SRM, PGJ), où les
deux SBE sont deux références distinctes. La suite **provoque** donc le cas —
une pelouse de 40 × 30 en Hunter, qui pose une PGP Ultra en 3/4" — et un
contrôle vérifie que ce corps a bien été posé, faute de quoi elle le dit au lieu
de rendre un vert vide. C'est le piège du 15 août dans sa version « jamais
atteint » : mesurer zéro et mesurer rien se ressemblent trop.

---

## 131. La construction qui a échoué n'était jamais retentée — le dernier trou de la version lente

*Le patron, le 18 août 2026 : **« je crois que j'ai encore la version lente »**.
Sa fiche disait pourquoi, sans qu'il ait rien à recopier :*

```
Code SERVI : AUCUNE — la construction a ÉCHOUÉ (2026-08-18T05:13:44Z)
dit: ⨯ Another next build process is already running.
```

### Ce qui était DÉJÀ réparé, et qui ne suffisait pas

Le même refus avait été traité deux fois (§126) : l'orpheline est délogée avant
de bâtir, le verrou de banc se prend en création exclusive, et une seconde
tentative part quand c'est ce message-là qui a parlé. **Son espace portait bien
ces correctifs** — le commit récupéré, `757ab1d`, les contient tous.

Il était lent quand même, et c'est ce qui désigne le trou : **aucun de ces
remèdes ne couvre le cas où les deux tentatives tombent.**

### Le trou, et pourquoi personne ne le voyait

`veiller.sh` ne relance `npm run banc` que lorsque **rien ne répond** sur le
port. Or une construction qui échoue laisse le banc en mode développement — et
ce mode-là **répond très bien**. Les deux conditions du veilleur étaient donc
satisfaites, il se déclarait content, et plus rien nulle part ne retentait quoi
que ce soit : le patron passait la soirée sur la version lente.

**Le témoin d'échec existait déjà** (`/tmp/atlas-construction-echouee.txt`,
écrit par `banc.mjs`, effacé dès qu'une construction réussit) — mais **personne
ne le lisait**, sinon la fiche, pour le raconter.

### Ce qui est posé

Le veilleur gagne une seconde raison d'agir : *le serveur répond, mais sert-il
la version rapide ?* Témoin présent ⇒ on retente, **au plus trois fois, espacées
de dix minutes**, et jamais si une construction tourne déjà.

**Pourquoi réessayer marche ici, alors qu'insister est d'ordinaire une faute :**
la cause est passagère. Son espace a 8 Go et **132 Mo libres** au moment de la
panne ; dix minutes plus tard la mémoire est rendue, et la même construction
passe. Réessayer coûte quelques minutes de processeur et rapporte une soirée.

**Et pourquoi c'est BORNÉ.** Une erreur de types ne se répare pas en insistant,
et rebâtir sans fin sur une machine qui manque de mémoire la maintient à genoux
— le remède qui tue, déjà payé deux fois dans ce dépôt. Après trois échecs, le
veilleur se tait et l'abandon s'écrit dans le journal.

### Le contrôle, et son témoin

`test-relance-construction.ts` fait tourner le vrai veilleur devant un serveur
qui répond, avec un faux `npm` en tête de `PATH` pour ne pas bâtir pour de vrai.

| Ce qu'il mesure | Pourquoi |
|---|---|
| témoin présent ⇒ on retente | la panne du 18 août |
| **témoin absent ⇒ on ne relance RIEN** | le TÉMOIN : sans lui, un veilleur qui rebâtirait en boucle passerait pour correct |
| le compte est borné, et l'abandon se dit | ne pas maintenir l'espace à genoux |
| une construction en cours n'en déclenche pas une seconde | la panne d'origine, précisément |

Confronté au veilleur d'avant, il tombe sur le premier et le troisième — et le
témoin, lui, reste vert : la différence porte bien sur ce qu'on a changé.

---

## 133. « Il est LENT, et le restera » — la phrase qui était vraie, et le trou qu'elle avouait

**Le 20 août 2026 à 6 h 40, le patron écrit : *« l'application est lente corrige
ça »*.** Sa fiche disait tout, et sans qu'il ait rien à recopier :

```
Code SERVI : AUCUNE — la construction a ÉCHOUÉ (06:10:13Z)
dit: ⨯ Another next build process is already running.
Serveur    : répond sur le port 3000
Mémoire    : 8,3 G au total, 7,3 G pris, 980 M disponibles
```

Le serveur répondait — c'est le mode développement, qui répond très bien et
compile chaque écran à l'ouverture. **L'application n'était donc pas en panne :
elle était lente, et c'est pire, parce que rien n'a l'air cassé.**

### Ce qui était déjà réparé, et qui ne suffisait pas

Tout le mécanisme existait (§126, §131) : la construction orpheline est délogée
avant de bâtir, le verrou de banc est exclusif, une seconde tentative part quand
c'est le verrou qui a parlé, et le veilleur relance la construction même quand le
serveur répond.

**Le trou était dans le mot « borné ».** Le veilleur s'arrêtait après **trois**
tentatives espacées de dix minutes. Passé une demi-heure, plus rien au monde ne
retentait quoi que ce soit — et la fiche l'écrivait noir sur blanc : *« il est
LENT, et le restera »*. Le seul remède était que le patron rallume son espace,
un geste que personne ne lui avait demandé, pour une panne qu'il ne pouvait pas
voir.

Trente minutes de patience, c'était le bon ordre de grandeur pour la cause qu'on
avait en tête le 18 août : une mémoire saturée qui se libère. Ce n'est pas le
bon ordre de grandeur pour **une journée de travail** : la machine a 8 Go, il
l'occupe du matin au soir, et la fenêtre où une construction peut passer arrive
quand elle arrive.

### Ce qui a changé : c'est le RYTHME qui est borné, plus le nombre

Après la salve rapide — trois tentatives à dix minutes —, le veilleur continue
**indéfiniment, une par demi-heure**. Deux ou trois minutes de processeur toutes
les trente minutes ne maintiennent personne à genoux, et l'on finit par tomber
sur le moment où la machine peut faire passer la construction.

Ce qui reste interdit n'a pas bougé : **jamais deux constructions à la fois**
(`pgrep -f '[n]ext build'` avant chaque tentative), et jamais avant que le délai
soit écoulé.

### Et la fiche a cessé de mentir

« Il est LENT, et le restera » était exact tant que le veilleur renonçait. Le
laisser après le correctif ferait conclure qu'il n'y a rien à attendre, et
enverrait rallumer un espace en train de se réparer tout seul — une consigne qui
accuse à tort coûte plus cher que pas de consigne du tout (`CLAUDE.md` §5). Elle
dit maintenant que le veilleur retente, à quel rythme, et que rallumer reste le
geste le plus rapide.

### Le contrôle, et il sait rougir

`scripts/test-relance-construction.ts` gagne un cas : pas lent à zéro, salve d'une
seule tentative, et l'on exige **plus d'une** relance. Confronté à l'ancienne
borne, il rend « 1 tentative(s) : le veilleur s'est arrêté après la salve » —
vérifié dans les deux sens avant d'écrire ces lignes.

**Ce qui n'est PAS réglé, et qu'il ne faut pas croire acquis :** *pourquoi* deux
constructions se marchaient dessus à 6 h 10. La mémoire était encore ample à cet
instant (4,3 Gio disponibles) : ce n'est donc pas la saturation du 17 août. La
cause n'a pas été reproduite ici, et elle reste ouverte dans `TODO.md`.

## 136. Deux constructions au démarrage : on ATTEND la première, on ne la tue pas

**Le patron, le 21 août 2026 au réveil : *« l'appli est hyper lente »*.**
Troisième matinée de suite, et sa fiche portait le même refus :

```
Code SERVI : AUCUNE — la construction a ÉCHOUÉ (05:17:26Z)
dit: ⨯ Another next build process is already running.
memoire: 4,5 Gio disponibles au moment de l'échec
```

**Ce n'est donc pas la mémoire** — c'était l'explication du 17 août, et elle ne
tient pas ici : la machine avait 4,5 Gio de reste. Ce sont bien deux
constructions qui se rencontrent.

### Elles se rencontrent PAR CONSTRUCTION, et c'est le prix d'un choix assumé

`demarrer.sh` pose un veilleur **avant** la mise à jour, délibérément (§24) :
c'est ce qui donne au patron une application qui répond même si la mise à jour
échoue. Ce premier veilleur lance un banc, donc une construction. Si la mise à
jour aboutit, on remplace veilleur et serveur — et le banc suivant en lance une
seconde. **Deux constructions par allumage** : ce n'est pas un défaut, c'est le
prix d'un serveur qui répond tout de suite.

### Ce qui manquait : quoi faire quand on tombe sur l'autre

On délogeait, puis on relançait aussitôt. **Déloger n'a de sens que contre une
ORPHELINE** — une construction dont le destinataire est mort (§131). Contre une
construction VIVANTE, qui fait exactement le travail qu'on s'apprête à faire,
c'est le pire des gestes : on jette plusieurs minutes de calcul et l'on
recommence sur une machine qui n'en a pas les moyens.

`attendreLaConstructionEnCours()` l'attend donc — dix minutes au plus, avec un
signe de vie chaque minute — puis déloge ce qui reste (là, c'est bien une
orpheline) et bâtit. Quelques minutes de patience contre une journée en mode
développement : c'est le même arbitrage que la relance du veilleur (§133), déjà
tranché dans ce sens.

### Et l'on cesse de chercher le détenteur du verrou PAR SON NOM

Tout ce qui délogeait visait un motif — `pkill -f "[n]ext(…| build)"` au
démarrage, `pgrep -af "next build"` dans le banc. Or une construction Next n'est
pas trois processus, elle en est cinq, relevés sur cette machine :

```
npm exec next build                          ← le motif l'attrape
sh -c next build                             ← le motif l'attrape
node …/node_modules/.bin/next build          ← le motif l'attrape
node …/<dist>/build/<empreinte>.js 43027     ← IL NE L'ATTRAPE PAS
node …/jest-worker/processChild.js           ← IL NE L'ATTRAPE PAS
```

`detenteursDuVerrou()` demande donc au système **qui a le fichier `<dist>/lock`
ouvert**, en lisant `/proc/<pid>/fd`. C'est exact, indépendant des noms, et cela
survivra à la prochaine façon dont Next découpera ses processus.

### CE QUI N'EST PAS PROUVÉ, et il ne faut pas le croire acquis

**La panne n'a pas été reproduite ici.** Deux hypothèses ont été éprouvées et
écartées le 21 août : le `sleep 1` de `demarrer.sh` (après `pkill`, plus rien ne
tenait le verrou et la construction suivante partait) et l'orphelin invisible
(le `jest-worker` survivant ne tenait pas le verrou). Ce qui est livré rend le
mécanisme **sûr**, pas la panne **corrigée** : c'est une différence qui compte
(`AGENTS.md`), et `TODO.md` la garde ouverte.

## 135. Un écran atteint depuis deux endroits ne peut pas avoir un retour fixe

**Sa remarque du 20 août 2026 :** *« quand j'appuie sur retour, ça ne me fait pas
un retour, mais deux retours »*. La fiche d'un client renvoyait à l'accueil, quel
que soit l'endroit d'où on l'avait ouverte.

**Le réflexe qu'il faut éviter : « mettons `/clients` à la place ».** Ce serait
juste pour lui aujourd'hui et faux dès demain — la fiche s'ouvre AUSSI depuis le
tiroir d'un chantier, et l'on ferait alors sortir du chantier celui qui y était.
Un retour fixe se trompe forcément pour l'un des deux appelants.

**L'origine voyage donc dans l'adresse** (`?de=/chantiers/<id>`), et
`src/lib/retour-fiche-client.ts` la traduit en un couple `{href, libelle}`. Les
deux appelants la posent ou l'omettent ; l'écran, lui, ne décide de rien.

### Le filtre n'est pas une précaution de principe

Cette valeur vient de l'adresse — donc de n'importe qui. Sans filtre,
`?de=https://ailleurs.example` ferait de la flèche « retour » une sortie vers un
site étranger, et `?de=javascript:…` pire encore. On n'accepte donc **qu'une
forme connue** — un chemin de chantier — et tout le reste retombe sur la liste
des clients. Jamais une erreur, jamais un écran vide : une sortie de secours qui
casse est pire que pas de sortie.

### Deux sessions ont corrigé ce défaut le même jour, et pas de la même façon

**À savoir avant de « simplifier ».** Le 20 août 2026, une autre conversation a
posé `retour={{ href: "/clients", … }}` — un lien fixe — pendant que celle-ci
posait l'origine dans l'adresse. À la fusion, c'est **la version qui sait d'où
l'on vient** qui a été gardée, et ce n'est pas une préférence de style : le lien
fixe est juste depuis la liste des clients et faux depuis le tiroir d'un
chantier, où il fait sortir du chantier celui qui y était.

Le lien fixe reviendra sous les doigts de quelqu'un qui trouvera le paramètre
`?de=` inutilement compliqué. Il ne l'est pas — il est le seul moyen de ne pas
se tromper pour l'un des deux appelants. La suite sans navigateur refuse
d'ailleurs de voir revenir un retour en dur dans cet écran.

### La flèche reste un vrai lien, et c'est ce qui la sauve

`EnTeteEcran` rend un `<a href>`. Elle fonctionne donc **même sur une page qui
ne s'est pas animée** — le navigateur suit le lien tout seul. C'est exactement ce
qu'on veut d'une sortie de secours, et c'est pourquoi sa suite navigateur tient
là où celle de la recherche doit s'abstenir (§134).

## 134. Chercher un client : la règle vit hors de l'écran, et la croix aussi

**Sa demande du 20 août 2026, capture à l'appui :** *« Il faut une barre de
recherche où je peux taper le nom d'un client pour le retrouver plus
facilement. »* Sur sa capture : **vingt et un clients**, dont **quatre
Martins**, et le sien quelque part au milieu. La chose avait été dessinée le
17 août — `appli/clients-recherche.html`, proposition B, « la recherche par
frappe ».

### Où vit la règle, et pourquoi pas dans l'écran

`src/lib/recherche-client.ts` — fonction pure, éprouvable sans base ni
navigateur (`CLAUDE.md` §3). L'écran l'appelle, il ne la refait pas.

Ce qu'elle tient, et chaque point vient de SA liste :

| Il tape | Il doit trouver | Pourquoi |
|---|---|---|
| `martins` | `Martins`, `Monsieur Martins` | la casse ne décide de rien |
| `renard` | `Mme Renard (test)` | le nom cherché n'est presque jamais au début |
| `moreau` | `Moréau` | il ne maintient pas la touche « e » de son téléphone |
| `dupont` | `M. Dupont`, `Mr. Dupont` | le point et l'apostrophe ne séparent rien |
| `martins monsieur` | `Monsieur Martins` | l'ordre des mots est le sien, pas le nôtre |

**Une saisie vide rend TOUT**, et ce n'est pas un détail : l'écran s'ouvre sur
le champ vide, et rendre zéro lui ferait croire qu'il a perdu ses clients.

**Un contrôle interdit à l'écran de refaire la règle.** `test-recherche-client.ts`
lit `ListeClients.tsx` et refuse d'y voir un `.toLowerCase().includes(...)` : le
jour où quelqu'un en remet un, « moreau » cesserait de trouver « Moréau » sans
qu'aucune autre suite ne le voie.

### Le filtrage se fait dans le NAVIGATEUR

Vingt et un noms tiennent dans une page. Les faire chercher au serveur à chaque
lettre, c'est un aller-retour réseau par frappe, en 5G au bord d'un chantier. Le
jour où un artisan en aura deux mille, ce choix se révisera — et la règle ne
bougera pas, elle est déjà hors de l'écran.

### La croix bleue : trouvée sur une capture, par aucune suite

**`type="search"` fait poser au navigateur sa propre croix d'effacement, et elle
est d'un BLEU VIF.** Sur une page de crème et de bronze, c'était la seule tache
de couleur de l'écran — et la cinquième fois dans ce dépôt qu'un défaut sort
d'une image et d'aucun test (`CLAUDE.md` §5).

Le champ est donc un `type="text"` avec `inputMode="search"`, et la croix est la
nôtre : couleur `muted`, 46 px de large sur toute la hauteur du champ, et
**présente seulement quand il y a quelque chose à effacer** — un bouton qui ne
fait rien est un bouton de trop. `test-recherche-client-e2e.ts` tient les trois :
le type, la taille de la cible, et le fait qu'elle efface pour de bon.

### Sur CETTE machine, aucune page ne s'anime en mode développement

**Découvert en éprouvant la recherche, et c'est plus large qu'elle.** La suite
navigateur passait seule et tombait en batterie, sur « la liste n'a pas été
réduite (71 sur 71) ». Le message accusait la recherche.

Elle n'y était pour rien. Les suites navigateur démarrent un `npm run dev`
(`run-e2e-tests.ts`), et sur cette machine **React ne s'attache à aucune page**
en mode développement — l'accueil non plus, vérifié en cherchant les fibres
React sur `document.body.firstElementChild`. La liaison permanente que Next
ouvre en développement (`webpack-hmr`) est refusée par le mandataire réseau :
`ERR_INVALID_HTTP_RESPONSE`. Le HTML s'affiche, rien ne l'écoute.

Ce n'est donc pas un défaut du produit : **contre un serveur bâti
(`next start`), les huit contrôles passent**, et c'est ce que le banc du patron
sert. La suite pose la question avant d'accuser, et le dit quand la page est
morte.

**L'échappatoire est étroite, et c'est ce qui la rend acceptable :** elle ne
s'ouvre que si React n'est attaché nulle part. Un vrai défaut de la recherche
laisse la page vivante, et la suite reste rouge — éprouvé en débranchant le
filtre pour de bon (`filtrerClientsParNom(clients, "")`) : deux contrôles au
rouge, avec le bon message.

**Et deux pièges d'outillage, payés là :**

- **`waitUntil: "networkidle"` n'arrive JAMAIS contre un serveur de
  développement** : la liaison de rechargement à chaud garde le réseau occupé,
  et l'attente expire sur une page pourtant affichée. On attend un élément, pas
  un silence ;
- **une sabotage qui ne s'applique pas fait croire à un contrôle faible.** La
  première tentative visait une ligne que Prettier avait reformatée sur trois
  lignes : `replace` n'a rien remplacé, en silence, et la suite est passée au
  vert sur un code prétendument cassé. Toute substitution de vérification doit
  être suivie d'une assertion qu'elle a bien eu lieu.

### Le champ est toujours affiché, et c'est un choix

Une première version ne le montrait qu'à partir de cinq clients — moins de
meuble sur un écran presque vide. Mais **une barre qui apparaît et disparaît est
une règle de plus à deviner** : le jour où il en a quatre, il la cherche et
conclut qu'elle a été retirée. Un champ vide ne coûte rien à lire ; une règle
invisible coûte un message.

## §127. Le quinconce est un damier, et il se vérifie au lieu de se supposer

**Son croquis du 18 août 2026**, deux couloirs superposés sur du papier
quadrillé : le premier porte **14** arroseurs en deux rangées face à face, le
second **7** — une tête sur deux, en alternant les bords, avec les arcs tracés
en couleur pour montrer que chacune atteint bien la suivante en diagonale. Sa
phrase : *« dans les couloirs, le but c'est de poser les tuyères en quinconce,
car le but c'est que celle de gauche recouvre quasi 100 % jusqu'à celle de
droite »*, et pour les grands espaces *« l'idée est de faire la même »*.

**Ce que le code faisait, et pourquoi c'était invisible.** `pointsDeLaPose` ne
décalait que les rangées **intérieures** d'un demi-écart, en gardant tout le
pourtour. Un couloir n'ayant que deux rangées, toutes deux en bord, il n'y avait
**aucun quinconce du tout** — la grille alignée, et ses 12 tuyères là où il en
pose 7. Le drapeau `quinconce` valait pourtant `true` : l'écran l'annonçait, le
dessin le démentait, et aucun contrôle ne regardait le dessin.

**La règle, désormais :** on garde le point (i, j) quand **i + j est pair**. Sur
deux rangées, c'est son alternance ; sur davantage, le quinconce triangulaire.

### Ce qui rend la règle sûre : on mesure la couverture

Retirer une tête sur deux **double la distance entre voisins d'une même
rangée**. Si l'écart de départ était au maximum de sa tolérance du 17 août
(1,20 × portée), le coin abandonné se retrouve à sec — vérifié, ce n'est pas une
crainte théorique.

`couvreTout(points, portée, L, l)` échantillonne le terrain au **dixième de la
portée** et répond : tout point est-il à portée d'une tête ? `poser` s'en sert
comme d'un garde-fou : il essaie le damier sur la grille la plus large, et
**resserre tant que ce n'est pas couvert**, en allongeant du côté où l'écart est
le plus grand. La boucle s'arrête d'elle-même — dès que le damier ne coûte plus
moins que l'aligné, on garde l'aligné, qui couvre par construction.

**Sur son couloir de 10 × 2 m, cette boucle tombe sur 7.** Exactement son
croquis, par un chemin qui ne le connaissait pas.

| Zone | Aligné | Quinconce |
|---|---|---|
| 10 × 2 (son couloir) | 12 | **7** |
| 18 × 12 | 20 | **10** |
| 22 × 14 | 20 | **10** |
| 30 × 22 | 16 | **8** |

### Ce que cela révise, et ce que cela a coûté aux contrôles

**Sa règle du 17 août — « les derniers arroseurs toujours dans les coins » —
vaut pour la pose ALIGNÉE.** Sur un damier, deux coins opposés portent un
i + j impair et n'ont pas de tête. Ils restent arrosés (`couvreTout` l'exige) ;
il l'a validé le 18 août : *« oui, ça me va »*.

**Sept contrôles sont devenus rouges sur du code juste**, et aucun ne visait une
règle — tous visaient un nombre ou un mot :

| Ce qu'il regardait | Ce qu'il regarde maintenant |
|---|---|
| « le quinconce compte 11 arroseurs » | il en pose **strictement moins** que la grille alignée, **et il couvre** |
| « le jardin donne 7 secteurs » | témoin, mis à jour à 5 avec sa raison |
| « la fiche contient le mot Clarinette » | la fiche est la SIENNE (`source: 'patron'`) et **remplace** les lignes génériques |
| « le débit lu vaut 0,58 m³/h » | le débit par table **diffère** de celui obtenu par division |
| « 8 zones dépassent six voies » | on **grossit** le jardin jusqu'à dépasser six voies, et l'on dit si on n'y arrive pas |
| « le jardin d'exemple se coupe en plusieurs réseaux » | on **agrandit** une pelouse jusqu'à ce qu'une vanne ne suffise plus |

**La leçon, la troisième fois en deux jours :** un contrôle accroché à un
nombre ou à un libellé meurt à la première règle métier qui change — et il meurt
en accusant du code juste, ce qui coûte plus cher qu'un contrôle absent. Deux
d'entre eux étaient pires : ils continuaient de passer **en éprouvant le cas
d'à côté**, silencieusement. D'où la parade, appliquée partout ici : quand un
contrôle a besoin d'un cas particulier, il le **construit en visant la
condition**, et il **échoue s'il n'y arrive pas**.

---

## 132. « Il peut proposer une autre date » — un interrupteur avant l'envoi

**Sa demande du 17 août 2026 :** *« pour le lien du planning qui part au client,
il faut que l'utilisateur puisse choisir avant d'envoyer s'il autorise ou non le
client à choisir une date si celles proposées ne lui conviennent pas »*.

**Ce que l'application faisait jusque-là, et qu'il n'avait pas choisi.** La page
publique offrait TOUJOURS un calendrier sous les dates proposées. Sur un
chantier serré, une contre-proposition à six mois ne l'arrange pas — et le seul
moyen de l'éviter était de n'envoyer aucune date, c'est-à-dire de perdre le
parcours entier.

### Où le choix se pose, et pourquoi là

**Sous les dates, juste avant le bouton d'envoi.** C'est le dernier regard avant
que le lien parte, et le seul endroit où les deux décisions se voient ensemble :
quelles dates, et si le client peut en sortir. **La phrase récapitulative suit
l'interrupteur** — « Le client choisira entre ces deux dates, et rien d'autre »
—, sans quoi il enverrait sans savoir ce que son client va lire.

### Ce qui est FIGÉ, et ce qui ne l'est pas

Le choix est écrit dans l'envoi (`envois_devis.autre_date_autorisee`,
migration 0055), **pas lu dans un réglage**. Même raison que les dates proposées
et la fenêtre du client (migration 0027) : l'écran du client doit dire demain ce
qu'il disait aujourd'hui. Un réglage relu à l'ouverture changerait après coup la
promesse faite à quelqu'un qui a le lien ouvert.

**Vrai par défaut**, à la colonne comme à l'écran. Les liens déjà partis
continuent de se comporter comme leurs destinataires les ont reçus, et un patron
qui n'y touche pas envoie ce qu'il a toujours envoyé.

### La règle vit à UN endroit, et ce n'est pas l'écran

**Cacher le calendrier ne suffit pas.** Cette page est publique : elle s'ouvre
sans compte, et son formulaire se rejoue. `enregistrerReponse` refuse donc toute
date hors des propositions quand l'envoi ne l'autorise pas
(motif `autre_date_refusee`), et le message rendu au client lui dit quoi faire
plutôt que de l'accuser : choisir une des dates, ou demander une correction.

C'est la règle du dépôt — jamais de règle dupliquée entre l'affichage et la
vérification (`CLAUDE.md` §3). Le contrôle correspondant poste une
contre-proposition **sans passer par l'écran** : c'est le seul qui prouve que la
porte est fermée pour de bon.

### Ce que ça ne fait pas

**Aucun réglage par défaut dans les Réglages.** Il choisit envoi par envoi, et
c'est ce qu'il a demandé. Si l'habitude s'installe — toujours ouvert, ou
toujours fermé —, un réglage « Devis & factures » pourra porter la position de
départ ; il n'y a rien à décider tant qu'il ne l'a pas dit.

---

## §128. La fiche de chantier : ce qui a été fait, un jour, chez quelqu'un

*Sa demande du 16 août 2026, capture d'une application concurrente à l'appui :
« une fiche où ils cochent ce qu'ils ont fait ou non sur le chantier et ensuite
qu'ils peuvent enregistrer et envoyer directement au client ». Puis, le 17,
après quatre planches et six arbitrages : **« Fait la C ».***

### Ce que « C » veut dire, et pourquoi les deux autres ont été écartées

Deux de ses décisions se rencontraient sur un même point et paraissaient se
contredire :

- **16 août** — *« chaque client aura sa fiche »* : le passage suivant chez le
  même client doit retrouver son ajustement, sinon il retrie vingt lignes douze
  fois par an. Pré-remplir exige donc de savoir QUI, tôt.
- **17 août** — l'outil vit dans « Paysage », à côté de l'arrosage, donc il
  s'ouvre **sans client** : un outil qui exige un client ne sert pas en visite,
  chez quelqu'un qui n'existe pas encore dans Atlas.

| | Quand le client est nommé | Ce que ça coûte |
|---|---|---|
| A | À l'ouverture | L'outil ne s'ouvre plus sans client — **exactement ce qu'il avait refusé le matin même** pour l'arrosage |
| B | À la fin, pour envoyer | Plus de pré-remplissage : la fiche repart des vingt lignes du modèle au douzième passage chez le même client |
| **C** | **Quand il veut** | **Un état de plus à tenir** : la fiche doit se recomposer en cours de route sans effacer ce qui vient d'être coché |

Elles ne se contredisent pas : elles se rencontrent sur le **moment**. C'est ce
que fait `recomposerPourClient` (`src/lib/passage-entretien.ts`), et c'est la
clause « sans effacer » qui porte tout le travail — perdre trois coches parce
qu'on a nommé le client au milieu serait pire que ne rien pré-remplir du tout.

### Le repli regarde TOUT l'historique du client, pas son dernier passage

**Écrit après que le contrôle a refusé les deux premières versions**, avant
qu'elles n'atteignent le patron. Les deux se trompaient, en sens inverse :

| Ce qu'on regardait | Le défaut |
|---|---|
| Les lignes **présentes** du dernier passage | Ne converge jamais : au premier passage la fiche porte le modèle entier, donc le second le reprend entier, et ainsi de suite. Le repli ne replie rien |
| Les lignes **cochées** du seul dernier passage | Replie trop fort : une taille de haie d'automne se fait une fois l'an. Au passage de mars elle n'aurait pas été cochée en février, elle disparaîtrait — et il ne pourrait plus la cocher en octobre, faute de ligne |

D'où **ce que ce client a déjà pris au moins une fois**, tous rapports envoyés
confondus. Il se construit tout seul, garde les gestes saisonniers, et ne rend
jamais une fiche plus longue que le modèle du jour. Le prix assumé : une
prestation cochée par erreur chez un client y reste proposée. Une ligne de trop
se saute des yeux ; une ligne manquante bloque le geste sur un chantier.

**Envoyés seulement** : un brouillon ouvert par erreur puis abandonné ne dit
rien de ce que ce client prend.

### Les lignes sont COPIÉES, jamais lues dans le modèle

C'est l'invariant qu'il a posé le 16 août, et celui qui ne se rattrape pas s'il
est manqué : **un rapport déjà envoyé ne change plus jamais.** Retirer
« Scarification » du modèle en octobre ne doit rien changer au rapport de
juillet, qui est parti chez le client et fait preuve de passage.

Une jointure vers `prestations_entretien` aurait été plus courte à écrire et
fausse au premier retrait. Les lignes sont donc copiées à l'ouverture du
passage — libellé **et** famille, parce qu'un renommage doit lui aussi rester
sans effet sur le passé. Le nom du client suit la même règle : il est recopié
**à l'envoi**, pas relu à la lecture (`client_nom`, migration 0055).

### Pas de signature — l'horodatage et l'empreinte à la place

*Sa question du 16 août : « pour les signatures, on peut faire des signatures
électroniques ? »* Puis son propre constat : *« s'il n'est pas là, on ne peut
pas le faire signer »*. C'est le cas ordinaire d'un entretien : on tond pendant
que le client est au travail.

La preuve est donc la date, l'heure et l'**empreinte SHA-256 du contenu exact**
— la même mécanique que l'acceptation d'un devis. Plus solide qu'un trait au
doigt, et qui n'exige personne sur place.

### Ce que le client reçoit, et ce qu'il ne reçoit pas

**Seules les prestations FAITES**, sa décision « B » du 16 août. Et le tri se
fait **en base**, pas à l'affichage : une page qui recevrait tout et n'en
montrerait qu'une part laisserait le reste dans le HTML, à portée d'un clic
droit. La suite navigateur le vérifie sur le HTML servi, pas sur ce qui se voit.

La page `/entretien/[jeton]` rejoint `/devis` et `/factures` dans
`CHEMINS_PUBLICS` **et** `CHEMINS_DU_CLIENT` — sans quoi son client verrait les
onglets de l'outil de travail de son artisan au bas du rapport (sa remarque du
12 août, §68).

**Aucun fournisseur d'envoi, et c'est un choix** (`docs/A-FAIRE.md` §5) : le
rapport se fige, puis l'écran ouvre le SMS ou le courriel de SA messagerie, avec
le lien dedans.

### Le temps passé : la molette du téléphone

*« Ce serait bien de ne pas avoir à l'écrire, mais d'avoir une petite molette ou
un truc sympa […] je veux une application ultra luxe et moderne. »* Trois
propositions lui ont été montrées (`docs/maquettes/65-choisir-l-heure.html`) ; il
a retenu **la A**, deux listes natives.

C'est le bon choix, et meilleur que la molette dessinée qui lui était proposée à
côté : sur son iPhone, une liste native **est** la molette qu'il connaît — celle
du réveil, celle de l'agenda. Aucune imitation ne rendra la friction d'un vrai
tambour, et une molette faite par nous serait une molette de plus à apprendre.
Le pas est de cinq minutes : personne ne facture un entretien à la minute, et à
la minute près la molette ferait deux cent quarante crans pour quatre heures.

**Une molette ne peut produire qu'une valeur juste** : il n'y a rien à refuser,
donc rien à expliquer. C'est ce qui la sépare d'un champ de saisie — et le
dépôt refuse quand même les valeurs aberrantes côté serveur, parce qu'une action
serveur s'appelle sans écran.

### Deux jardins dans la même journée font deux fiches

La reprise d'un brouillon existe pour ne pas empiler des fiches vides : il
appuie sur « Ouvrir », rien ne semble répondre, il rappuie. La première version
rendait **le brouillon du jour**, quel qu'il soit — et **il fait quatre ou cinq
jardins dans une journée**. Au deuxième, l'écran lui aurait rendu la fiche du
premier, client nommé et cases cochées : il aurait envoyé chez Martin ce qu'il a
fait chez Durand.

Seule une fiche **que personne n'a touchée** se reprend : ni client, ni coche,
ni temps, ni observation. Dès qu'elle porte une trace, elle appartient à son
chantier.

### Ce qui a été mesuré plutôt que supposé

L'écran a été parcouru en entier, du geste des réglages jusqu'à la page du
client ouverte **dans un contexte sans session** — `test-fiche-chantier-e2e.ts`,
qui prend ses captures en passant (`ATLAS_CAPTURES`). C'est là qu'on voit ce
qu'aucune suite base ne peut voir : que l'écran appelle bien les règles, et que
le client ne reçoit pas les dix-sept lignes qu'il n'a pas payées.


## 134. Le troisième document : une option dans le moteur, pas un moteur de plus

*Sa demande du 20 août 2026 : « fais en sorte que les fiches chantiers soient au
format PDF maintenant ».*

### Le vocabulaire d'abord, parce qu'il trompe — y compris ce fichier

**Quatre choses de ce dépôt s'appellent « fiche ».** Les confondre fait dessiner
un document qui existe déjà, ou en coder un qui n'existera jamais.

| Le mot | Ce que c'est | Où |
|---|---|---|
| **fiche de chantier (PDF)** | le document décrit ici, né le 20 août 2026 | `src/server/pdf/fiche-chantier-pdf.ts` |
| **fiche chantier (écran)** | l'écran d'un chantier — photos, note vocale, étapes | `src/app/chantiers/[id]/` |
| **fiche d'entretien** | un MODÈLE de prestations à cocher, un par entreprise | `reglages/fiche-entretien`, migration 0051 |
| **fiche de passage** | ce qui a été coché un jour chez quelqu'un, envoyé au client | **§128**, `src/lib/passage-entretien.ts` |

**§128 s'intitule « La fiche de chantier » et parle de la QUATRIÈME.** Le titre
est resté ; il désigne le passage d'entretien, pas ce document-ci. Ne pas les
rapprocher : l'un rend compte de travaux et ne s'envoie pas encore, l'autre est
un rapport de passage envoyé au client depuis « Paysage ».

### Pourquoi une option, et non un troisième fichier

Le devis et la facture partagent déjà une seule feuille (`document-commun.ts`) :
même papier, même en-tête, même bloc émetteur/client, même pied. La fiche ne
diffère que par ce qu'elle **ne porte pas**.

Un troisième moteur aurait produit une troisième mise en page, qui aurait dérivé
des deux autres au premier changement d'identité — et c'est le client qui aurait
vu la différence entre les feuilles d'un même artisan (`CLAUDE.md` §3).

`sansChiffrage` retire donc le tableau de prix, les totaux, la TVA, les
modalités de paiement et l'IBAN. `blocsTexte` ajoute les intertitres dont elle a
besoin. Les deux sont **additifs** : absents, le devis et la facture sont
exactement ce qu'ils étaient.

### Ce que « sans prix » achète, et ce n'est pas de la place

**La fiche est transmissible.** Un locataire, un syndic, l'assurance d'un
voisin peuvent la recevoir sans apprendre ce que le propriétaire a payé. Un
montant imprimé là-dessus rendrait le document indonnable — et c'est justement
celui qu'on ressort deux ans après, quand quelqu'un rappelle.

C'est aussi pourquoi la mention du pied ne promet rien : *« ne vaut ni devis ni
facture, et n'appelle aucun paiement »*. Lui prêter la force de l'un des deux
tromperait celui qui la reçoit.

### Ce qui garde les deux pièces qui portent l'argent

**Une empreinte de leur trace entière**, figée dans
`scripts/test-fiche-chantier-pdf.ts` : chaque texte, sa position au centième de
point, sa taille, sa couleur, sa page. Relevée **avant** la première ligne de
`sansChiffrage`, et éprouvée rouge en décalant le moteur d'un seul point.

Sans elle, un `if` mal placé aurait décalé un total sans que personne le voie
avant l'impression — et c'est ce que le client paie.

### Régénérée à chaque ouverture, et il faudra que ça change

Le devis et la facture servent le fichier **figé au moment de l'envoi** : ce sont
des engagements. La fiche, elle, est recomposée à chaque demande — si le patron
ajoute une prestation oubliée, c'est la version corrigée qu'il veut imprimer.

**Le jour où elle s'ENVERRA à un client, il faudra la figer comme les deux
autres.** Ce qui est parti ne se réécrit pas. C'est écrit dans la route, et
ouvert dans `TODO.md`.

### Le piège de Next.js, payé une heure

La route a d'abord été écrite sous `/api/chantiers/[id]/`, alors que le dossier
voisin emploie `[chantierId]`. Next.js refuse deux noms pour le même segment
dynamique — et **le serveur entier ne démarre plus**. Cinq écrans échouaient au
préchauffage, et la suite accusait un bouton introuvable trois écrans plus loin.

Le message du serveur, lui, disait exactement : *« You cannot use different slug
names for the same dynamic path ('id' !== 'chantierId') »*. **Aller le lire a
pris trente secondes.** C'est la règle d'`AGENTS.md` : reproduire le message du
serveur, jamais l'idée qu'on s'en fait.

---

## 135. Le diagnostic végétal : le modèle observe, la base décide

**Sa demande du 20 août 2026 :** photographier une anomalie sur un végétal et
obtenir un diagnostic probable avec une conduite à tenir, en quatre gestes —
ouvrir, photographier, attendre, lire. Sa règle produit : *« 1 photo → 1 résultat
principal → 3 informations essentielles → 1 action recommandée. La complexité
doit être dans le moteur et la base de données, jamais dans l'interface. »*

### 135.1 La décision qui commande tout le reste

**Un modèle à qui l'on demande de nommer une maladie en nommera toujours une.**
C'est ce qu'il sait faire, et c'est précisément ce qu'il ne faut pas : sa
consigne était *« Atlas ne doit JAMAIS inventer un diagnostic »*.

Une consigne écrite dans un prompt n'aurait pas suffi. Le pipeline ne demande
donc jamais au modèle de nommer quoi que ce soit — **il lui demande ce qu'il
voit**, et c'est du code déterministe qui conclut.

Trois barrières, et il faut les trois :

1. **Le schéma de sortie ne comporte AUCUN champ où nommer un problème.** Pas
   de « diagnostic », pas d'« hypothèse ». Un modèle ne peut pas conclure dans
   un formulaire qui n'a pas de case pour ça. C'est la seule des trois qui soit
   vraiment structurelle.
2. **Le vocabulaire est fermé et PARTAGÉ** entre l'observation et les fiches :
   les mêmes mots décrivent ce que le modèle voit et ce que la fiche annonce.
   « feutrage_blanc » se constate, « oïdium » se conclut — et le second n'est
   pas dans la liste. Deux vocabulaires auraient exigé une traduction entre les
   deux, donc une interprétation, donc un endroit où se tromper.
3. **Tout texte affiché sort d'une colonne de `fiches_phyto`.** Aucune chaîne
   rendue par un modèle n'atteint l'écran.

**Conséquence :** une maladie, une gravité ou un traitement inventés sont
impossibles **par construction**.

### 135.2 Le partage du vocabulaire, et le défaut qu'il rend visible

Le vocabulaire vit dans `src/lib/diagnostic-vegetal.ts`, et il est **injecté**
dans la consigne du modèle — jamais recopié.

**Recopié, il aurait divergé au premier mot ajouté, et la divergence aurait été
SILENCIEUSE.** Une fiche écrivant « moisissure » là où le modèle rend
« feutrage_blanc » ne remonterait jamais : aucune erreur, aucun message,
simplement une fiche qui ne sort plus. C'est le défaut le plus cher de cette
architecture, et deux contrôles le rendent détectable : `verifierVocabulaire()`
à l'import, et une suite qui vérifie que **chaque** mot du vocabulaire figure
bien dans la consigne.

### 135.3 Deux mondes de données, qui ne se mélangent jamais

| | La base phytosanitaire | Les diagnostics |
|---|---|---|
| Appartient à | personne — c'est un savoir commun | une entreprise |
| RLS | **aucune** | activée et forcée |
| Droits d'`atlas_app` | `SELECT` seul | lecture et écriture |
| Écrite par | l'import, sous le rôle propriétaire | le produit |
| Précédent | `catalogue_prestations` (0007), `documents_legaux` (0014) | `notes_vocales`, `audios_a_purger` |

**`GRANT SELECT` seul est un point de sécurité, pas une commodité :** une faille
dans l'application ne peut pas écrire une maladie inventée dans la base commune
de tout le monde, parce qu'il n'y a aucun droit d'écriture à voler.

### 135.4 Le score, et pourquoi il croise DEUX couvertures

`rapprocher()` calcule, pour chaque fiche :

- **la couverture de la fiche** — ce qu'elle annonce est-il visible ? Seule,
  elle favorise les fiches maigres : une fiche à un seul symptôme banal
  sortirait toujours première ;
- **la couverture de l'observation** — ce qu'on voit, la fiche l'explique-t-il ?
  Seule, elle favorise les fiches fourre-tout, qui couvrent tout parce qu'elles
  annoncent tout.

Chacune prise isolément produit un classement faux d'une manière différente ;
ensemble, elles se corrigent. La formule est
`0,55 × couvertureFiche + 0,35 × couvertureObservation + 0,10 si un SIGNE est reconnu`.

**Les trois parts font exactement 1, et c'est ce qui rend le signe décisif.**
Une première version ajoutait le bonus APRÈS coup (`min(1, score + 0,15)`) : sur
deux fiches également bien couvertes, il était avalé par le plafond et ne
départageait plus rien — c'est-à-dire précisément dans le cas où il sert. Une
fiche sans aucun signe plafonne donc à 0,90, et c'est voulu : elle ne repose que
sur des symptômes, qui se partagent entre dix causes.

**Une exclusion n'est pas un score bas.** Partie non concernée, hôte `strict`
d'une autre essence : la fiche sort du jeu. La confondre avec un malus la
laisserait remonter le jour où tout le reste est faible.

### 135.5 Quatre issues, et les trois dernières comptent autant que la première

| Issue | Quand | Ce qui l'écrit |
|---|---|---|
| **Résultat** | une candidate nettement devant, dont la fiche n'interdit pas le diagnostic photo | recopie de la fiche |
| **Une photo de plus** | deux candidates au coude à coude, **et** une ligne `confusions_phyto` qui les relie | la consigne est recopiée mot pour mot de `photo_qui_tranche` |
| **« Je ne peux pas confirmer »** | rien de reconnu, trop faible, trop proches sans confusion, ou fiche `diagnostic_photo: impossible` | liste fermée de phrases, dans le code |
| **« Personne n'a regardé »** | aucun fournisseur de vision branché, ou en panne | le message du fournisseur |

**Les deux derniers ne se confondent pas** : le premier dit « la base ne sait
pas », le second « personne n'a regardé ». Les mêler enverrait chercher un
défaut dans les fiches alors qu'il est dans la configuration.

**Une seule relance, jamais deux.** L'invariant vit à trois endroits : le code
(`complementDejaDemande`, lu depuis la BASE et jamais depuis l'écran — le
laisser décider par le navigateur permettrait de le remettre à zéro en
rechargeant), une contrainte `CHECK (complements_demandes <= 1)`, et l'écran qui
ne propose plus la relance.

**Sans ligne de confusion, pas de relance.** On refuse plutôt qu'improviser une
consigne : une consigne inventée enverrait photographier ce qui ne tranche rien.

### 135.6 La confiance : trois mots, et trois plafonds

Sa règle : *« ne pas afficher de faux pourcentages du type 93 % si le modèle
utilisé ne fournit pas une probabilité réellement calibrée »*. Aucun modèle
employé ici n'en fournit — et le score interne n'en est pas une non plus : c'est
une somme pondérée d'indices, ce qui n'a rien à voir.

Les plafonds sont le cœur de `confiancePour()` : une **photo floue**, une fiche
qui se déclare seulement **« indicative »**, une **essence non reconnue** —
chacun abaisse d'office, quel que soit le score. Sans eux, la confiance affichée
serait un mensonge exactement dans les cas où elle compte le plus.

Le score interne est rangé en **millièmes entiers** dans
`hypotheses_diagnostic` : une échelle inhabituelle, délibérément choisie pour
décourager de l'afficher comme un pourcentage.

### 135.7 Quatre risques, jamais confondus

Sa consigne distinguait : santé du végétal, risque mécanique de l'arbre, risque
humain/animal, risque réglementaire. Chacun a sa colonne et sa mention.

**La phrase sur la stabilité mécanique vient du CODE, pas de la fiche** — une
règle générale de sécurité ne doit pas pouvoir manquer parce qu'une fiche est
mal remplie : c'est la fiche bâclée qui en a le plus besoin.

**Quand `impact_mecanique` vaut `inconnu`, elle dépend de la gravité — et cette
règle a été CORRIGÉE le 20 août 2026, en regardant le résultat.**

La première version l'affichait dès que l'impact n'était pas « aucun », donc
aussi sur `inconnu`. Puis la deuxième fiche réelle est arrivée : l'anthracnose du
platane, maladie du feuillage que sa source qualifie de « spectaculaire mais
rarement grave ». Sous « Surveiller l'évolution », Atlas affichait *« Une photo
ne permet pas de juger la solidité de l'arbre. »*

C'est le travers que `CLAUDE.md` nomme à propos du rappel de panne : **un
avertissement qui parle à tort s'apprend à être ignoré**, et le garde-fou se
perd sans qu'on s'en aperçoive. Le jour où la mention compte — un lignivore au
collet —, elle serait devenue du décor.

| `impact_mecanique` | Gravité | La mention |
|---|---|---|
| `avere` ou `possible` | n'importe laquelle | **s'affiche** — la source a vu quelque chose, on ne la relativise pas |
| `inconnu` | `vigilance` ou `importante` | **s'affiche** — on ne sait pas, et ça compte |
| `inconnu` | `faible` | **se tait** — ce n'est pas un oubli de la source, c'est un jugement : elle a regardé le problème, l'a trouvé mineur, et n'a pas soulevé la structure |
| `aucun` | n'importe laquelle | se tait |

### 135.8 La porte du classement sémantique, et son verrou

Sa demande : ne pas empêcher l'ajout ultérieur d'un classement sémantique ou
visuel des candidates — mais *« le modèle ne devra jamais pouvoir créer une
maladie ou une recommandation absente de la base »*.

`ClasseurCandidats` est l'interface ; `classeurDeterministe` (qui ne fait rien)
est l'implémentation d'aujourd'hui. **Le verrou est `appliquerClassement`**, et
c'est la moitié importante : il ne garde d'un classement que des fiches déjà
entrées, **reprend la fiche d'ORIGINE** — jamais celle rendue par le classeur,
dont le contenu pourrait être falsifié sous un identifiant valide —, refuse les
doublons, borne le score à [0, 1], et **remet en fin de liste** ce qu'un
classeur aurait tronqué. Une consigne dans un prompt aurait été une prière ;
ceci est une garantie, éprouvée contre un classeur volontairement malveillant.

### 135.9 Les photos : EXIF, conservation, rattachement

**Les métadonnées sont retirées AVANT tout** — avant le rangement, avant l'envoi
au fournisseur. Une photo de jardin porte les coordonnées GPS du domicile du
client, l'horodatage, parfois une vignette ayant survécu à un recadrage.

`src/lib/exif.ts` nettoie JPEG, PNG et WebP **sans réencoder** : pas de
dépendance de plus, pas de perte de qualité au moment où le détail compte (une
pustule fait deux millimètres). Deux subtilités qui coûtent cher si on les
manque — APP0 (JFIF) et APP14 (Adobe) **survivent** chez JPEG, faute de quoi les
couleurs d'une image CMJN se décodent faux ; et chez WebP, les **drapeaux VP8X**
doivent être éteints en même temps que les blocs, sinon un décodeur peut refuser
l'image entière.

**Un fichier qu'on n'a pas su nettoyer est REFUSÉ, jamais rangé** : le laisser
passer conserverait des métadonnées en croyant les avoir retirées, et la colonne
`exif_retire` affirmerait alors quelque chose de faux.

**La conservation est configurable**, jamais gravée (sa consigne). 90 jours pour
une photo libre, aucune échéance pour une photo versée au dossier d'un chantier
— et le rattachement **recalcule** l'échéance, sans quoi la pièce d'un dossier
en cours disparaîtrait au bout de trois mois sans que personne l'ait demandé.

**Le diagnostic survit à sa photo**, comme une note vocale survit à son audio :
il garde son nom de problème, sa date, sa fiche et sa traçabilité.

### 135.10 Ce qui reste vide, et pourquoi c'est le bon état

**La base phytosanitaire ne contient aucune fiche réelle.** Sa règle : *« ne
constitue pas toi-même une liste fictive de maladies pour remplir la base »* et
*« ne remplis pas artificiellement la base avec de fausses données pour faire
fonctionner la démonstration »*.

Le module fonctionne parfaitement dans cet état : il répond « la base ne contient
encore aucune fiche validée », ce qui est vrai — plutôt qu'un diagnostic qui ne
l'est pas.

Ce qu'il faut pour l'alimenter est prêt et éprouvé : le schéma d'import avec ses
six refus, les contrôles de sources champ par champ, le versionnement, la
traçabilité. Le détail est dans `donnees/phyto/LISEZ-MOI.md`.

**Les fixtures d'essai** (`donnees/phyto/fixtures/`) ne décrivent aucun végétal
réel et sont tenues à l'écart par **trois barrières**, chacune sur un chemin
différent : l'import les refuse en production, la lecture les filtre sur
`origine = 'reelle'` (double garde `NODE_ENV` + variable posée par la suite), et
une contrainte CHECK lie l'origine au préfixe `zz-test-` **dans les deux sens**.

### 135.11 Ne pas s'enfermer chez un fournisseur

`VISION_PROVIDER` et `VISION_MODELE` — le second existe parce que le nom du
modèle était **écrit en dur** dans le fournisseur Anthropic, ce qui obligeait à
rebâtir l'application pour en changer. Sans valeur, les deux retombent sur la
configuration existante : rien ne change pour une installation en place.

`VISION_PROVIDER` est validé en production comme les deux autres — sans quoi
`VISION_PROVIDER=dev` y serait passé pendant que `LLM_PROVIDER=dev` était
refusé, et le diagnostic aurait rendu des observations fabriquées sur de vraies
photos.

`lireImages` est une extension **additive** de l'interface, comme `lireImage`
l'avait été : plusieurs images (la photo initiale et son complément partent
ENSEMBLE — séparée, la seconde perdrait le contexte de la première) et un modèle
réglable. `lireImage` en est désormais un raccourci : les deux portaient la même
requête à un tableau près.

### 135.12 Les sources sont hors d'atteinte d'ici — et ce qu'on en fait

**Constaté le 20 août 2026, en cherchant à écrire les premières fiches.** Aucune
des sources que le patron a nommées n'est joignable depuis l'environnement de
développement : `agriculture.gouv.fr`, `inrae.fr`, `fredon-france.org`,
`onf.fr`, `plante-et-cite.fr` et `ephy.anses.fr` répondent tous
`403 à CONNECT — policy denial` au mandataire.

**La recherche web, elle, passe.** Et c'est précisément le piège : elle rend un
RÉSUMÉ écrit par un modèle, pas la page. Écrire une fiche « validée » d'après un
résumé aurait produit quelque chose qui a l'apparence d'une donnée sourcée — un
organisme, un titre, une adresse, une date de consultation — sans que personne
ait lu le document. **C'est pire qu'une fiche vide** : une fiche vide se voit,
une fiche mal sourcée se croit.

**La sortie est celle que le dépôt emploie déjà**, et elle est écrite dans
`CLAUDE.md` §5 : ce qui ne peut pas être fait ici se fait ailleurs. Le workflow
`recolter-sources-phyto.yml` va chercher les documents depuis une machine qui a
le réseau, en extrait le texte, et le dépose sur une branche à lui — jamais sur
`main`. La saisie se fait ensuite, sur des documents qu'on a réellement sous les
yeux. Même famille que `pages.yml`, `relever-palette.yml` et `banc-essai.yml`.

**Deux garde-fous sont posés en même temps, et ils comptent plus que le
workflow :**

- **rien n'est rapatrié sans licence déclarée.** Une source en `a_verifier`
  garde son adresse et rien d'autre. Recopier un document sans savoir s'il peut
  l'être est un risque qui ne se voit qu'à la mise en demeure ;
- **la CI contrôle `donnees/phyto/fiches` à chaque poussée**
  (`importer-fiches-phyto.ts --verifier`). Les fiches arrivent par des fichiers
  de données, pas par du code : sans ce contrôle, une fiche validée sans source
  entrerait sur `main` sans que rien ne s'y oppose. Le contrôle a été confronté
  à une fiche volontairement fautive avant d'être branché — il rougit, et il
  nomme le champ en cause.

**Ce que cela veut dire pour la suite :** le module est prêt, le blocage n'est
pas technique. Il faut soit lancer la récolte, soit que le patron fournisse les
documents. Tant que ni l'un ni l'autre n'est fait, la base reste vide — et
Atlas le dit.

---

## 136. « Choisir la date » : l'écran du milieu disparaît, trois deviennent deux

**Le patron, le 20 août 2026, trois captures à l'appui :**

> *« Le bouton envoyer au client, tu vas me le modifier par "Choisir la date"
> […] sous forme de bouton vert comme tous les autres […] j'arrive directement
> sur la page où je peux choisir la date pour envoyer au client […] on supprime
> la page qui est entre les deux. On va raccourcir les étapes. […] Et je ne veux
> pas de flèche. »*

Retenu sur planche (`docs/maquettes/82-choisir-la-date.html`, **proposition A**),
puis sa réponse : *« A et la 2 »*.

### Le doublon qu'il a vu, et qui était réel

Envoyer un devis coûtait **trois écrans** :

| | Écran | Ce qu'il montrait |
|---|---|---|
| 1 | `/devis-complet` | le devis entier — client, lignes, totaux, conditions |
| 2 | `/export` | **le même devis, résumé** : client, lignes, total |
| 3 | la feuille | le calendrier, l'interrupteur, « Envoyer le devis » |

**Le deuxième redisait ce que le premier venait d'afficher en entier.** On ne
relit pas un devis qu'on vient de fermer. Il en reste deux.

### La découverte qui a rendu la chose petite

Le calendrier de sa capture n'est pas une page : c'est une **feuille**
(`EnvoiAuClient`), qui s'ouvrait par-dessus l'écran 2. La monter sur le devis,
c'est l'ouvrir plus tôt — elle ne demande que `chantierId`, `devisId` et
`clientNom`, tous trois présents là. **La copier aurait donné deux calendriers à
tenir d'accord** (`CLAUDE.md` §3).

### Une adresse, deux écrans — et c'est ce qui a décidé de la condition

`/export` n'était pas un écran mais **deux, sous la même adresse** :

- **avant l'envoi**, la synthèse et son bouton — c'est elle qu'il supprime ;
- **après l'envoi**, `EcranDevisParti`, le « signet d'or » qu'il a lui-même
  retenu sur planche (`docs/maquettes/34`) : l'état, le montant, le message du
  client, le lien à transmettre, la reprise.

Le premier jet renvoyait sur `!envoi && statut !== "envoye"`. **Faux après une
reprise** : l'envoi existe encore et le devis est redevenu brouillon — l'écran se
serait rendu sur sa face supprimée, bouton d'envoi compris. La condition suit
donc ce que l'écran sait rendre : `statut !== "envoye"` renvoie au devis, un
point c'est tout.

### Ce que la suppression a emporté, et ce qu'elle a révélé

Le code devenu inatteignable est **retiré, pas laissé** : 110 lignes de JSX,
quatre entrées du composant, la fonction `Row`, deux requêtes de la page. Un code
mort qui ne peut plus s'exécuter trompe la session suivante, qui le corrigera ou
s'interrogera.

**Deux effets qu'aucun raisonnement n'avait prévus, et que le navigateur a
montrés :**

1. **La phrase du moment se perdait.** « Devis prêt pour Mr. Martins. » venait
   d'un état local posé par l'envoi *sur cet écran*. L'envoi partant d'ailleurs,
   on arrivait par une navigation et l'état était vide : l'écran annonçait
   « en attente de réponse » une seconde après l'appui. Vrai, et froid. Le
   moment voyage désormais dans l'adresse (`?envoye=1`) — et un rechargement le
   perd, ce qui est juste : la deuxième fois, ce n'est plus « à l'instant ».
2. **Deux « Annuler » sur le même écran.** Le devis en portait déjà un — celui
   qui reprend le retrait d'une ligne. La feuille en a apporté un second, sans
   nom qui les distingue : un lecteur d'écran annonce deux fois la même chose, et
   une suite vise le mauvais des deux. Le mot affiché ne bouge pas ; l'étiquette
   accessible dit « Annuler l'envoi ».

### Ce que le contrôle garde, et qu'aucun autre ne voyait

Les suites d'envoi éprouvent ce que fait la feuille **une fois ouverte**. Elles
resteraient toutes vertes si l'écran du milieu se réintercalait : elles y
passeraient, cliqueraient, et le parcours redeviendrait long sans que rien ne
rougisse — jusqu'à ce que lui le remarque.

`scripts/test-choisir-la-date-e2e.ts` garde donc **le raccourci lui-même** : le
bouton plein et sans flèche, son ordre au-dessus de l'aperçu, l'ouverture de la
feuille **sans changer d'adresse**, et le fait que l'ancienne adresse renvoie au
devis. Confronté au défaut — la redirection retirée — il rougit en le nommant :
*« l'écran du milieu existe encore »*.

**Vingt-six suites ont dû suivre** : elles passaient toutes par `/export` pour
cliquer « Envoyer au client ». C'est le coût réel d'un raccourci sur un parcours
central, et il se paie une fois.

### Et une vingt-septième, que la batterie seule a trouvée

`lienDeReprise` — la règle qui décide où mène la ligne d'un chantier dans la
liste (§77 bis) — pointait encore sur `/export` pour un devis préparé mais non
parti. **Rien ne cassait à l'écran** : l'adresse existe toujours et renvoie au
devis. Il serait simplement arrivé au bon endroit par un rebond, et la
divergence serait restée invisible jusqu'à ce qu'un des deux chemins bouge sans
l'autre.

Ce sont les deux suites de la reprise — la pure et sa jumelle navigateur — qui
l'ont dit. Elles portent maintenant `devis-complet`, et leur commentaire
explique **pourquoi l'attente a changé** : ce n'est pas un contrôle plié au
code, c'est l'écran d'envoi qui a déménagé.

**Au passage, une attente fixe de trop.** `test-reprise-chantier-e2e.ts`
attendait 900 ms après avoir saisi le prix, puis naviguait. Jouée seule elle
gagnait ; enchaînée, la navigation avortait l'enregistrement en vol, le devis
s'ouvrait sur une ligne vide, et le rouge accusait l'écran d'arrivée — *« le
total n'est pas montré avant l'envoi »* — alors que c'est le montant qui n'était
jamais arrivé. Elle **relit jusqu'à voir le prix persisté**, comme
`test-prix-e2e.ts` : attendre ce qu'on affirme, jamais une durée.

### Ce que la batterie complète a corrigé, et que onze suites vertes cachaient

Le lot a d'abord été annoncé prêt sur la foi de **deux** suites jouées seules.
La batterie entière en a fait rougir **onze**, et trois d'entre elles disaient
quelque chose de vrai sur le produit, pas sur elles-mêmes. C'est la démonstration
la plus nette qu'on ait de la règle d'`AGENTS.md` : jouer ce qu'on transmet, en
entier, avant de le transmettre.

**1 · « Devis prêt pour … » revenait à chaque rechargement.** Le moment de
l'envoi voyage dans l'adresse (`?envoye=1`) — et une adresse, contrairement à un
état de navigateur, **survit au rechargement**. Le commentaire du code affirmait
le contraire, et `test-devis-e2e.ts` a montré qu'il se trompait. Le drapeau se
**consomme** donc à l'arrivée : la mention reste pour cette visite-là, puis
`replaceState` nettoie l'adresse derrière elle. Un signet rouvert le lendemain
tombe sur l'état réel du devis parti.

**2 · Un « Modifier » en or devenu inatteignable.** Il ne s'affichait que sur un
devis NON parti ; or ce cas ne peut plus atteindre cet écran. Le ternaire ne
rendait donc plus jamais rien. Retiré, comme les 110 lignes de JSX : un code mort
trompe la session suivante. Le trou qu'il bouchait — *« si je veux modifier mon
devis avant de l'envoyer, je peux pas »* — ne peut plus se rouvrir, puisque
l'écran d'avant l'envoi EST le devis modifiable.

**3 · Une adresse renommée trop largement.** Le remplacement en masse de
`/export` par `/devis-complet` a emporté des navigations qui visaient l'écran
d'APRÈS l'envoi — le signet d'or, le retour de la messagerie, la réponse du
client. Ces trois-là ne bougent pas : seule la face d'avant a disparu. **La règle
à retenir : sur cette adresse, se demander de quel côté de l'envoi on se
trouve**, jamais remplacer au fil du texte.

**Deux suites ont été supprimées, et c'est le bon geste.**
`test-synthese-devis-e2e.ts` mesurait la géométrie de l'écran supprimé ;
`test-modifier-avant-envoi-e2e.ts` gardait le lien devenu impossible. Ce qu'elles
tenaient encore de vivant ne se perd pas : la règle de nommage
(« Mr. Martins », jamais « Chez Martins ») est éprouvée sans navigateur par
`test-civilite.ts` et `test-nom-chantier.ts` ; le mot devant le nom se relit
maintenant sur le devis (`test-choix-civilite-e2e.ts`) ; et la garde de
débordement sur son téléphone a **changé de sujet plutôt que de disparaître** —
elle vit dans `test-choisir-la-date-e2e.ts`, sur le dernier écran qu'il voit
avant d'envoyer.

---

---

## 137. Une confusion relie deux fiches, pas deux lignes d'un même fichier

**Écrit le 20 août 2026, en écrivant la troisième fiche réelle.**

C'est la confusion (`confusions_phyto`) qui autorise la demande de photo
complémentaire : sans elle, deux hypothèses au coude à coude donnent un refus,
et le module perd la moitié de ce qu'il sait faire. Or les fiches qui se
confondent sont précisément celles qu'on écrit **à des moments différents** :
l'anthracnose du platane vient d'une page d'Ephytia lue un jour, celle du chêne
et du hêtre d'une autre page lue le lendemain. Deux lots, deux fichiers.

**Deux obstacles se tenaient l'un derrière l'autre, et le second était muet.**

1. **Le contrôle** (`validerLot`) refusait tout renvoi vers une fiche absente du
   fichier courant. Il accepte désormais un jeu de `codesConnus` — tous les
   codes déclarés par l'import en cours, relevés avant la moindre validation. Le
   contrôle ne disparaît pas : il porte sur l'ensemble au lieu d'un fichier, et
   un renvoi vers un code qu'aucun lot ne déclare reste refusé.

2. **L'écriture se perdait en silence.** Le lien était posé en
   `INSERT … SELECT … FROM fiches_phyto WHERE code = $2` : sur une fiche pas
   encore écrite, cette requête n'insère **rien**, sans erreur ni message.
   L'ordre alphabétique des fichiers décidait donc de ce qui marchait — un
   renvoi vers un lot écrit *plus tard* disparaissait, et on ne l'aurait
   découvert que sur un chantier, devant une relance photo qui ne vient pas.
   Ce cas n'était pas atteignable avant le point 1 : c'est l'élargissement qui
   l'a ouvert.

   L'import garde donc une file des confusions non posées et les **raccorde à la
   fin**, tous les lots écrits. Ce qui échoue encore là fait tomber l'import :
   la validation ayant déjà refusé les codes inconnus, un lien manquant à ce
   stade est une faute d'écriture, et un import « réussi » à qui il manque une
   relance est pire qu'un import rouge.

**Le contrôle a été vu rouge avant d'être cru** (`CLAUDE.md` §5) :
`test-diagnostic-base.ts` monte deux lots temporaires — l'un renvoyant vers
l'autre, écrit plus tard — et, l'ancienne écriture rétablie, il rougit en disant
« il s'est perdu en silence ».

**Ce que cela a coûté par ailleurs**, et qui est instructif : un cas voisin
affirmait `base.confusions.length === 1`. C'était vrai **par accident**, la base
ne portant que les fixtures. La première fiche réelle qui déclare une confusion
l'a fait rougir sur du code juste — le défaut du §5 bis de `CLAUDE.md`, à
nouveau. Il vérifie maintenant la règle : la confusion d'alpha existe et nomme
la photo qui tranche, quoi que la base porte d'autre.

**Et une duplication a été retirée dans la foulée.** La suite navigateur
recopiait à la main le `resultat` qu'affiche l'écran de diagnostic, champ par
champ — la règle dupliquée entre l'affichage et la vérification qu'interdit
`CLAUDE.md` §3. `composerResultat` est désormais exportée, et la suite l'appelle.


---

## 138. « Bloquer plutôt que deviner » : l'hôte d'abord, et l'intégrité prouvée

**Sa consigne du 20 août 2026**, en deux moitiés qui tiennent chacune en une
phrase :

> *« Mieux vaut refuser de conclure que produire un faux diagnostic. »*
> *« Aucune interprétation silencieuse. Aucune donnée inventée. Aucune perte
> d'information. Aucun diagnostic forcé. En cas de doute, bloquer plutôt que
> deviner. »*

Le module respectait déjà l'essentiel : le schéma de sortie du modèle n'a **aucun
champ** pour nommer une maladie (§135), tout ce qui s'affiche sort d'une colonne,
l'outil sait refuser et sait demander une photo de plus. Ce qui suit est ce qui
manquait.

### 1. L'hôte d'abord — la règle la plus coûteuse, et la plus juste

> *« Identifier l'hôte avant la maladie. Si l'espèce est incertaine, ne pas
> diagnostiquer. »*

`arbitrer()` exige désormais une essence **établie** — un taxon reconnu par la
base, avec une certitude autre qu'« incertaine » — avant de regarder le moindre
candidat. Sans elle : une relance qui demande la vue qui **identifie un arbre**
(feuille entière posée à plat, puis l'arbre entier), et au second passage un
refus nommé `hote_incertain`.

**Le contrôle est placé AVANT la lecture des candidats, et ce n'est pas
cosmétique.** Plus bas dans la fonction, `premier` existe déjà ; un code qui a un
premier candidat sous la main finit toujours par le rendre « quand même, puisqu'il
est loin devant ». Là où il est, il n'y a rien à rendre.

**Le prix est réel et assumé** : un symptôme parfaitement caractéristique sur une
essence non reconnue ne conclut plus. C'est exactement ce qu'il a demandé.

**« probable » suffit, « incertaine » bloque.** Exiger « sure » rendrait l'outil
inutilisable : un modèle de vision dit rarement qu'il est sûr.

### 2. La liste d'hôtes : c'est la SOURCE qui dit si elle est close

> *« Ne comparer qu'aux maladies compatibles avec l'hôte et l'organe atteint. »*

Le moteur n'écartait que les fiches à hôte `strict`, et se contentait ailleurs
d'un malus — parce qu'une liste d'hôtes de source est rarement exhaustive, et
qu'exclure sur une liste incomplète fait rater un diagnostic juste, **en
silence**. Les deux positions se défendent, et c'était un arbitrage pris dans le
code sur une question qui appartient au document.

**La sortie a été de le demander à la source.** L'exclusion devient la règle ;
`hotes_non_exhaustifs` recopie la mention contraire quand elle existe —
l'anthracnose du chêne dit « de nombreuses espèces », le fomès dit que les
feuillus sont touchés « de manière anecdotique ». Ces deux fiches portent donc le
drapeau, l'anthracnose du platane non (sa page dit « Hôtes habituels :
Platanes »).

Un hôte `strict` l'emporte toujours sur le drapeau : deux mentions qui se
contredisent, c'est une fiche mal remplie, et le doute doit fermer, jamais ouvrir.

### 3. Le plafond que la source autorise

> *« Le niveau de certitude affiché ne doit jamais dépasser celui permis par les
> données scientifiques. »*
> *« Si la source exige une analyse en laboratoire, Atlas ne doit jamais afficher
> "confirmé". »*

Deux champs neufs : `certitude_max` (plafond dur, appliqué **en dernier** dans
`confiancePour`, après tous les autres) et `methode_confirmation` (la phrase de la
source, recopiée). L'import **refuse** la combinaison qui ment : une méthode de
confirmation exigée avec une certitude `elevee`.

Un plafond ne relève jamais rien — une fiche qui autorise `elevee` sur une photo
floue reste « incertaine ». Sinon le champ deviendrait un moyen de forcer une
certitude, c'est-à-dire l'inverse de ce qu'il demande.

`methode_confirmation` s'affiche **en pleine page**, sous « Ce qui reste à
confirmer », jamais dans le tiroir des détails : la cacher reviendrait à laisser
croire qu'il n'y en a pas.

### 4. La comparaison champ par champ — et ce qu'elle a trouvé le jour même

> *« après chaque import, effectue automatiquement une comparaison champ par
> champ entre la fiche source et les données réellement enregistrées ; […] si une
> différence, une perte d'information ou une ambiguïté apparaît, bloque la
> validation et indique précisément l'écart ; une fiche ne passe au statut
> VALIDÉE qu'après réussite de ce contrôle. »*

`comparerFicheSourceEtEnregistree()` est une fonction **pure** : deux objets de
même forme entrent, la liste des écarts sort. Elle ne connaît ni la base ni le
disque, ce qui la rend éprouvable contre des altérations fabriquées — donc
possible à voir rouge.

**Le schéma Zod ne la rendait pas redondante.** Il vérifie la forme du fichier et
se tait sur ce qui arrive ensuite : une colonne oubliée dans l'`INSERT`, un
`text[]` réordonné, un `null` devenu chaîne vide, une valeur tronquée. Tous ces
défauts sont silencieux — l'import finit en vert et la fiche servie ne dit plus
tout à fait ce que le document disait.

**Les champs sont listés à la main, jamais balayés par `Object.keys`.** Un
balayage compare ce que les deux objets ont en commun : le jour où une colonne est
ajoutée au schéma mais oubliée dans l'`INSERT`, elle manque des **deux** côtés, et
le contrôle reste vert sur une information perdue. C'est précisément le défaut
qu'il existe pour attraper.

**Deux prises réelles dans l'heure qui a suivi son écriture :**

- **le chemin des images.** Une fiche déclare `fichier` ; l'import en tirait une
  clé de stockage et **jetait le chemin**. Rien n'échouait, l'écran affichait bien
  la photo — mais la base ne savait plus ce qu'une clé représentait. Colonne
  ajoutée, plutôt que champ écarté du contrôle : l'écarter aurait rendu le
  contrôle muet sur sa première vraie prise ;
- **l'ordre des listes.** Les symptômes et les images portaient un `ordre` ; les
  hôtes, les sources et les confusions non — relus par ordre alphabétique de code,
  c'est-à-dire dans un ordre qui n'est celui d'aucun document. Sa consigne dit
  « déplacée » à côté de « perdue » et « modifiée », et l'ordre d'une liste
  d'hôtes est une information : la plaquette du DSF nomme d'abord les essences les
  plus touchées.

Dans les deux cas la tentation était d'assouplir le contrôle pour qu'il passe. Un
contrôle qu'on assouplit pour qu'il passe ne contrôle plus rien.

**Un seul champ est délibérément dérivé** : `storage_key`, régénérée à chaque
écriture. La comparer littéralement ferait rougir le contrôle sur toutes les
fiches à photo, à chaque import — et un contrôle qui rougit toujours s'apprend à
être ignoré. « Dérivé » ne veut pas dire « non vérifié » pour autant : une clé est
**exigée** dès qu'un fichier était déclaré, sans quoi une photo disparaîtrait de
l'écran en silence.

### 5. « VALIDÉE » est devenu impossible sans contrôle

L'import n'écrit **jamais** `validee` : la fiche entre au mieux `en_revue`, et
seule la comparaison réussie la promeut, dans la même transaction. La contrainte
`fiches_phyto_integrite_ck` en fait une impossibilité plutôt qu'une intention —
aucune écriture, par aucun chemin, y compris un `UPDATE` en SQL direct par le
propriétaire de la table, ne peut poser `validee` sans le drapeau. Éprouvé comme
tel (`test-diagnostic-base.ts`).

Toute réécriture d'une fiche **annule** le contrôle précédent : sans cela, une
fiche modifiée garderait le vert obtenu par sa version d'avant.

### 6. L'import est passé à UNE SEULE transaction

Chaque lot avait la sienne : un fichier fautif tombait seul, les autres entraient.
Deux choses l'ont rendu intenable. D'abord les confusions traversent les fichiers
(§137) : un renvoi vers un lot écrit plus tard est raccordé à la fin, donc absent
au moment où la transaction du premier lot se ferme — le contrôle le comptait
comme une perte et faisait tomber un import parfaitement sain. Ensuite, une base à
moitié importée est exactement l'état ambigu qu'il refuse.

L'ordre est donc : tout écrire → raccorder les renvois → contrôler chaque fiche →
promouvoir → un seul `COMMIT`. **La validation de forme, elle, reste par fichier
et tout entière avant la première écriture** : un fichier mal formé est toujours
signalé nommément, sans qu'on ait rien tenté d'écrire.

### 7. Ce que l'écran dit, et ce qu'il ne dit plus

- **« Une ressemblance n'est pas une preuve »**, sous les photos de référence.
  Sa règle : *« les photos de référence sont uniquement des indices, jamais une
  preuve suffisante »*. Une image posée sans un mot se lit comme une
  confirmation, surtout quand elle ressemble à celle qu'on vient de prendre.
- **« Ce qui reste à confirmer »**, avec la phrase de la source et les vues qui
  manquent.

**Un défaut trouvé sur la capture, et pas par un test** — le cinquième de ce
dépôt (`CLAUDE.md` §5) : la phrase du laboratoire s'affichait deux fois de suite,
comme méthode de confirmation puis comme première information requise. Une
consigne répétée se lit comme deux consignes, et sur un chantier on cherche la
différence entre les deux. L'import refuse désormais cette répétition.

---

## 139. La ligne « Version » répondait à une autre question que celle posée

**Le patron, le 21 août 2026 :** *« Ça n'a pas marché, j'ai encore l'ancienne
version. Pourtant j'ai rechargé les mises à jour. »*

Les deux moitiés de sa phrase étaient vraies **en même temps**, et c'est ce qui
rend le défaut coûteux : la mise à jour avait bien eu lieu, et son écran servait
bien l'ancienne application.

### Ce qui se passait

Son banc, une fois qu'il a réussi à construire, sert une version **bâtie** —
du code figé au moment de la construction. C'est ce qui la rend rapide. Or :

| | Ce qui avance | Ce qui est servi |
|---|---|---|
| `git` récupère le code neuf | le disque | inchangé |
| l'espace redémarre | le disque **et** la construction | le code neuf |

Le bouton « Chercher les dernières corrections » fait la première ligne, pas la
seconde — sauf quand un veilleur est là pour relever le serveur, cas où il coupe
et laisse reconstruire (`src/lib/issue-mise-a-jour.ts`). Sans veilleur, il
**dit** qu'il faut rouvrir l'espace. Mais rien ne le rattrapait ensuite.

### Le vrai défaut n'était pas là : il était dans le témoin

`versionExecutee` lisait le **dépôt** (`git log -1` dans le dossier). La ligne
« Version » annonçait donc le commit du jour pendant que les écrans dataient de
la veille.

**Cette ligne existe pour répondre à « qu'est-ce que j'exécute ? »** — c'est
même la raison pour laquelle elle a été ajoutée (§6 de `CLAUDE.md` : *« une
capture répond à la question sans qu'on ait à la poser »*). Elle répondait à
« qu'est-ce qui est sur le disque ? ». Les deux réponses ne divergent **que**
dans la situation où on l'interroge. Un témoin qui ment exactement au moment où
l'on s'en sert coûte plus cher que pas de témoin : il a envoyé chercher la panne
du côté de la livraison, qui était irréprochable, et m'y a envoyé aussi.

### Ce qui est posé

`src/lib/version-servie.ts` — une règle pure, sans base ni serveur :

- **en développement**, le dépôt EST ce qui s'exécute (chaque écran se recompile
  à l'ouverture) : sa version est la bonne, et rien ne peut être « en retard » ;
- **en version bâtie**, seule la marque posée au démarrage (`ATLAS_VERSION`) dit
  la vérité — et si le dépôt a avancé depuis, **l'écran le dit**, nomme le code
  qui attend, et donne le geste : rouvrir l'espace.

Deux refus délibérés, parce qu'un avertissement qui parle à tort s'apprend à
ignorer : pas de retard annoncé en développement, et **aucun** quand la marque
de démarrage manque — on ne sait alors pas avec quoi l'application a été bâtie,
et deviner serait exactement la faute qu'on répare.

`scripts/test-version-servie.ts` rejoue son cas ligne à ligne. Confronté à
l'ancien comportement — annoncer le dépôt quoi qu'il arrive — il rougit sur ce
cas précis et sur celui de la branche, et reste vert partout ailleurs.

### Ce que ça ne répare pas, et qu'il faut dire

Cela ne fait pas arriver le code neuf plus vite : **cela cesse de prétendre
qu'il est là.** Le geste reste le sien — rouvrir l'espace de travail. Rendre la
reconstruction automatique dans tous les cas est une autre question, ouverte
dans `TODO.md`.

---

## 140. L'envoi ramène à l'accueil : le dernier écran de trop

**Le patron, le 21 août 2026, capture à l'appui :** *« Quand je clique sur
envoyer le devis, il y a bien l'application SMS qui s'ouvre automatiquement, ça
c'est bien. Par contre juste derrière, il y a cette page-là qui s'affiche et je
n'ai pas besoin qu'elle s'affiche […] il faut qu'une fois que le devis est
envoyé, on retourne directement sur la première page, l'accueil. »*

### Pourquoi il avait raison

Cet écran ne lui apprenait rien : il venait d'appuyer, et sa messagerie s'était
ouverte par-dessus. Au retour de Messages, il tombait sur un récapitulatif à
refermer avant de reprendre son travail. L'accueil, lui, porte l'état du
chantier — « devis parti, en attente de réponse » — au milieu des autres.

C'est le deuxième écran supprimé du même parcours en deux jours (§136). Les deux
avaient la même infirmité : exister pour dire ce que l'on venait de faire.

### L'ordre des deux gestes, et il ne se négocie pas

L'ouverture de la messagerie reste **avant** la navigation. Un navigateur refuse
une ouverture de `sms:` qui ne suit pas le doigt d'assez près, et sur iOS il la
refuse **sans un mot**. Le lien touché pour lui vit sur `document.body`, hors de
l'arbre React : il survit donc au changement d'écran, ce qui était déjà vrai
avant et le reste.

### Ce que la suppression a emporté

Tout ce qui distinguait « ça vient de partir » : le drapeau `?envoye=1`, la
mention « Devis prêt pour … », l'état « Devis prêt », et l'effet qui nettoyait
l'adresse (§139, corrigé la veille). Plus aucun chemin ne les atteignait.

**Conséquence qu'aucun raisonnement n'avait prévue, et que la batterie a
montrée :** cet écran ne se voit désormais qu'en y REVENANT, sur un devis déjà
parti. Le geste y est donc une **relance**, et le libellé le dit — « Relancer par
SMS » et non « Ouvrir le SMS tout prêt ». Ce n'était pas un défaut : c'est la
règle du 13 août (le libellé annonce ce que le geste fait) qui devient enfin
visible, le premier envoi n'atterrissant plus jamais là.

### La rangée d'actions, et ce que le patron a tranché

Sur cet écran, il ne veut que deux gestes. « Télécharger le PDF · Partager » est
retiré.

**Ce qui reste, contre la lettre de sa réponse :** la bascule de canal
(« Plutôt par e-mail »). Ce n'est pas un troisième bouton mais **le seul endroit
où une coordonnée manquante se saisit** — il n'existe aucun écran de fiche
client — et son absence était sa plainte du 13 août : *« si je veux l'envoyer par
e-mail, je ne peux pas revenir le choisir »*. La retirer rouvrirait un défaut
déjà payé. Signalé, et il peut trancher autrement.

**Ce que le retrait du PDF ne coûte pas, et c'est LUI qui l'a rappelé :** *« une
fois le devis envoyé, il doit s'enregistrer normalement en PDF dans la catégorie
client […] il y a trois colonnes devis, factures et fiches chantiers »*.
Vérifié plutôt que cru : `chargerFicheClient` ne retient que les devis au statut
`envoye` et les range en vignettes PDF dans la colonne « Devis ». Un devis parti
s'y classe tout seul.

**Une nuance dite au patron :** ces vignettes OUVRENT le PDF, elles ne proposent
pas de l'enregistrer — ce n'est pas le geste « télécharger » du 7 août 2026, qui
lui, reste éprouvé sur la facture (`test-facture-au-client-e2e.ts`). Question
posée, réponse non reçue.

---

## 141. Enregistrer une pièce : la feuille qui ne décide de rien

**Le patron, le 21 août 2026 :** *« Alors oui, je veux pouvoir l'enregistrer,
mais avant que tu codes quoi que ce soit, fais-moi une maquette visuelle que je
voie exactement ce que tu veux me dire. »*

Puis, devant la planche : **« La C »**
(`docs/maquettes/83-enregistrer-le-pdf.html`).

### Ce qui manquait

Sa fiche client range tout ce qui le concerne en trois colonnes — devis,
factures, fiches de chantier — et c'est lui qui l'a rappelé : *« une fois le
devis envoyé, il doit s'enregistrer normalement en PDF dans la catégorie
client »*. Vérifié plutôt que cru : seuls les devis au statut `envoye` y
entrent.

Mais ces vignettes **ouvraient** le document dans un onglet. Rien ne proposait
de le garder — le défaut exact du 7 août, sur un autre écran.

### Pourquoi la C, et pas la plus courte

La **A** (la vignette enregistre) coûtait un geste de moins. Elle décidait à sa
place : ouvrir la fiche d'un client pour relire un montant lui aurait téléchargé
un fichier à chaque coup d'œil.

La question lui a donc été posée telle quelle sur la planche — **vient-il
regarder, ou garder ?** — et sa réponse est celle qui ne tranche pas pour lui :
un appui, trois choix.

**La B a été dessinée et écartée avec son coût dit :** un rond de 30 px contre
un lien de 56 px, dans une colonne large de 118 px. Cet écran tient une règle —
*« un lien qu'il touche d'une main, dehors, parfois avec des gants »* — et deux
cibles voisines de tailles inégales la défont.

### Les trois conditions, et aucune ne suffit seule

Le remède du 7 août tient à trois choses **réunies**, et c'est ce qui rend le
défaut si facile à faire revenir :

| | Sans elle |
|---|---|
| `?telecharger=1` (le serveur pose `attachment`) | Chrome **affiche** le document |
| l'attribut `download` (le NOM) | Safari le nomme d'après la page, **sans extension** |
| **pas** de `target="_blank"` | l'onglet neuf prive Safari de sa demande d'enregistrement |

« Ouvrir » veut exactement l'inverse : pas de `?telecharger=1`, et un onglet à
part pour ne pas perdre la fiche. Si les deux gestes servaient la même adresse,
l'un des deux mentirait — et c'est ce que le contrôle vérifie.

### Le nom du fichier est une RÈGLE, pas une chaîne recopiée

`nomDuFichierDeLaPiece` (`src/lib/documents-du-client.ts`), éprouvée sans base :

- **la nature se lit dans l'ADRESSE, jamais dans le titre.** Le titre est ce
  qu'il lit ; l'adresse est ce que le serveur sert. Deviner « c'est un devis »
  à partir d'un libellé, c'est se fier à un mot que la prochaine demande peut
  changer ;
- le « n° » et son espace ne traversent pas — un tel nom se recopie mal et se
  cherche encore plus mal ;
- une fiche de chantier n'a pas de numéro : elle porte son **jour au format de
  tri** (`AAAA-MM-JJ`), de sorte que dix fichiers se rangent d'eux-mêmes dans
  l'ordre du temps ;
- sans numéro ni jour, **aucune date n'est inventée**.

### Le contrôle, et le fait qu'il sache échouer

`scripts/test-enregistrer-piece-e2e.ts` a été confronté aux trois défauts, un
par un — adresse sans `?telecharger=1`, lien sans nom, onglet neuf ajouté. Il
rougit sur chacun, en nommant lequel. Une suite qui se serait contentée de
compter les boutons serait restée verte le jour où l'une des trois saute, et
c'est lui qui l'aurait découvert : un fichier sans nom dans son dossier.

**« Partager » revient ici**, après avoir été retiré de l'écran d'envoi le même
matin. C'était le seul chemin vers WhatsApp, et sa place est plutôt sur le
document rangé que sur le geste d'envoi.

---

## §129. Le planning refait : le chantier passe avant la demi-journée

*Sa demande du 19 août 2026 — « cette page est beaucoup trop compliquée à
comprendre pour les utilisateurs » — puis deux soirées de maquette, neuf
corrections, et sa décision du 21 août : « maintenant tu peux coder cette
version de la maquette ! Ne modifie rien ! Ne change rien ! Code trait pour
trait cette maquette. »*

La planche retenue est `appli/planning-simple.html` (planche 84). Ce §
n'expose pas ce qu'elle montre — l'écran et la planche le disent mieux — mais
**les trois décisions de structure** qu'il a fallu prendre pour la coder, et
qui ne se voient pas.

### 1. Une table pour les équipes, et la colonne `chantiers.equipe_id` retirée

**Ce qu'il a demandé, et que la colonne ne pouvait pas porter :**

> *« Lorsque je choisis une équipe je dois pouvoir mettre TOUTES les équipes si
> je le souhaite, le même jour ou même sur la même demi-journée. Je dois
> pouvoir mettre tout le monde le matin puis tout le monde l'aprem. »*

> *« Sur Mr. Leroy, qui dure toute la journée, je ne peux pas mettre juste Paul
> le matin et Julien et Paul l'après-midi — si je mets les deux l'après-midi, ça
> me les met aussi le matin. Il faut que tout soit INDÉPENDANT. »*

Une colonne porte **une** équipe, et elle la porte pour le chantier **entier** :
ni l'une ni l'autre des deux demandes. La migration 0058 pose donc
`equipes_du_chantier (entreprise_id, chantier_id, demi, equipe_id)`, avec sa
politique d'isolation et son `GRANT`.

**Et la colonne est RETIRÉE, pas doublée.** La garder aurait été la solution
courte — les écrans qui la lisaient continuaient de fonctionner. Elle aurait
aussi été la faute de `CLAUDE.md` §3 : le patron retire Paul de l'après-midi sur
le planning, la colonne dit encore « Paul », et la feuille de route imprimée
l'envoie sur place. Les lignes existantes sont recopiées sur les **deux**
demi-journées — c'est exactement ce que la colonne voulait dire — puis elle
disparaît.

Ce qui la lisait et lit désormais la table : la fiche de chantier PDF (elle
écrit toutes les équipes du chantier, matin et après-midi confondus) et l'export
d'entreprise (une sauvegarde qui l'oublierait rendrait un planning dont toutes
les pastilles seraient vides).

### 2. Le quota prévient, il n'interdit plus

**Sa proposition du 21 août, meilleure que les trois qu'on lui avait
soumises :**

> *« Une fois qu'on a mis deux chantiers avec deux gars, on dit que c'est
> complet. Et si l'utilisateur en rajoute un troisième, on met une autre couleur
> pour lui signaler qu'il a dépassé le quota — mais il peut quand même le faire.
> [...] Nous, on prévient juste. »*

Quatre états, dans `src/lib/planning-jour.ts` : `libre`, `dispo`, `plein`,
`dela`. Le dernier est un **avertissement**, jamais un refus.

Conséquence côté serveur, et elle est réelle : `planifierChantier` ne lève plus
`CreneauIndisponible`, et `basculerEquipeDuChantier` ne lève plus
`EquipeIndisponible`. Les deux classes ont disparu. **Ce que cela ne relâche
PAS :** le chemin par lequel le CLIENT choisit sa date garde toutes ses limites
(`jourRetenable`, `premiersJoursLibres`). Un client n'a pas à forcer une
journée, ni même à savoir qu'on le peut.

**Les absences d'équipe entrent dans la charge** au même titre qu'un chantier
(`occupationDemi(pris, nombreEquipes, equipesAbsentes)`). Sans cela le planning
montrerait un jour libre que l'écran d'envoi refuse au client — deux vérités sur
la même capacité, sur deux écrans qui se suivent.

### 3. La fiche du jour est bâtie sur le CHANTIER, pas sur la demi-journée

C'est sa dernière correction, capture à l'appui :

> *« Mr. Leroy au-dessus du carré vert clair matin ; supprime le Mr. Leroy pour
> l'aprem, c'est le même chantier, pas besoin de répéter ; pareil pour "1
> chantier" ; et supprime le trait entre le matin et l'après-midi, là on a
> l'impression que c'est deux chantiers différents. »*

L'écran était bâti sur les demi-journées : deux blocs séparés par un filet,
chacun rejouant le nom du client et son compte. Un chantier qui dure la journée
s'y écrivait **deux fois**, avec une barre au milieu — l'écran FABRIQUAIT deux
chantiers là où il n'y en a qu'un.

`blocsDeLaJournee` rend donc, dans l'ordre : les chantiers (chacun avec les
demi-journées qu'il occupe), puis ce qui reste libre. *« Fais pareil pour les
autres, le nom toujours en premier ! »* — une demi-journée vide ouvrait la
fiche, et l'on lisait ce qui MANQUE avant de savoir de qui il s'agit.

### Ce que la planche ne portait pas, et qui a quitté l'écran

Trois choses existaient et **ne figurent pas** sur la planche qu'il a validée :
« Créer la facture » dans la feuille du chevron, la liste « Dans mon agenda », et
la proposition de chantier voisin pour combler une demi-journée. Elles ont été
retirées — *« trait pour trait »* — et le tableau de `TODO.md` dit ce qui reste
en place côté serveur, pour qu'un simple rebranchement suffise s'il les
redemande. Le chemin vers la facture n'est pas fermé : le fil des « Terminés » y
mène toujours.

### LE PIÈGE QUI A FAILLI COÛTER SES ÉQUIPES — une migration ne voit rien

**Le plus cher de ce lot, et il ne se voyait pas.** La reprise de données de la
migration 0058 — recopier `chantiers.equipe_id` dans la table neuve, puis
retirer la colonne — était écrite en un seul `INSERT … SELECT FROM chantiers`.
Elle recopiait **zéro ligne, sans la moindre erreur.**

`chantiers` porte `FORCE ROW LEVEL SECURITY` : la politique s'applique **même au
propriétaire de la table**, et les migrations tournent justement sous
`atlas_owner` — chez lui (`.devcontainer/preparer.sh`), en CI (`ci.yml`) et en
local (`monter-base-locale.sh`). Sans `app.entreprise_id`, la lecture ne rend
rien. La colonne aurait été retirée juste après, et **toutes les équipes déjà
affectées auraient disparu de sa base, en silence.**

**Comment il a été trouvé, et c'est la seule façon qui marche** : en rejouant la
migration sur une base remontée à l'état d'avant, **avec des données dedans**.
Le SQL est parfaitement correct à la relecture — c'est le contexte d'exécution
qui manque, et aucune relecture ne le montre.

La migration boucle donc sur `entreprises` et pose le contexte, comme 0036 et
0037 le faisaient déjà, et elle annonce son compte (`RAISE NOTICE`) : une reprise
qui ne recopie rien doit se voir dans le journal, pas se deviner.

**`scripts/test-migrations-sous-rls.ts` garde la porte** pour les suivantes : il
éprouve le piège en base — le propriétaire sans contexte ne voit rien, avec
contexte voit tout — puis refuse toute migration qui écrit à partir d'une table
d'entreprise sans poser son contexte.

**Et il en a trouvé trois autres, déjà appliquées** : `0039` (le régime de TVA
des factures), `0040` (la validité des devis) et `0045` (la reprise des
paiements). Les deux premières ont une conséquence bornée, que leur propre
fichier annonçait déjà. **La troisième est réelle** : les factures émises avant
elle ne comptent pas au relevé de TVA à l'encaissement. Elles sont nommées dans
le contrôle, avec leur coût, et le point est dans `TODO.md` — une écriture
comptable se décide, elle ne se glisse pas dans un lot d'écran.

### Ce qui a été appris, et qui vaut au-delà de ce lot

**Un contrôle qui épingle un NOMBRE relevé sur un écran meurt avec cet écran.**
`test-assistant-en-tete-e2e.ts` mesurait « la dernière case du mois finit
au-dessus de 626 px » : le planning refait l'a fait rougir sur une demande
exaucée. Relever le nombre l'aurait fait suivre l'écran au lieu de le tenir ; il
mesure désormais que le bouton de l'assistant **partage la ligne du titre** —
ce qui était le défaut d'origine, et ne dépend d'aucun calendrier.

Même leçon pour `test-absence-equipe-e2e.ts`, qui lisait « il reste de la
place » dans le libellé accessible d'une case. Il lit maintenant l'`data-etat`
que le calendrier ET la fiche du jour calculent par la même fonction.

## 142. Une dictée mène au devis, et le devis se prépare tout seul en arrivant

**Sa panne du 21 août 2026, et il l'a qualifiée lui-même :** *« c'est le point
le plus important. Je veux absolument que ça fonctionne. »*

> *« J'ai ouvert un chantier, Madame Lucie. J'ai rentré ces informations,
> j'appuie sur note vocale, j'ai dicté la prestation du chantier. J'ai rappuyé
> sur la note vocale, ça a enregistré. J'ai quitté l'application. Je suis
> retourné dessus. J'ai cliqué sur Madame Lucie qui était enregistrée dans mes
> chantiers. Or, je ne suis pas arrivé directement sur la page du devis comme
> demandé, avec mes informations remplies que j'avais dictées. »*

### Deux défauts, et le second était le vrai

**Le chemin.** `getNextAction` renvoyait une dictée sur l'écran
« Informations » : un écran de contrôle dont il ne veut plus depuis le 5 août
(*« je ne veux pas tous les autres trucs intermédiaires »*). Il mène désormais
au devis.

**L'ordre des jalons compte, et ce n'est pas un détail.** La ligne
`aUneNoteVocale` passe **avant** `informationsVerifieesAt`. La chaîne pose ce
second jalon dès qu'elle a rangé les prestations — c'est-à-dire **avant** son
arrêt d'avant-chiffrage. S'il ferme l'application pendant cet arrêt, ce qu'il
fait puisqu'il est chez sa cliente, l'ordre inverse le renverrait sur l'écran
« Prix » : un écran de plus entre lui et son devis, et la même panne sous un
autre nom.

**Le devis lui-même.** Plus grave, et invisible depuis le chemin :
**enregistrer une dictée ne fabriquait aucun devis.** La chaîne — transcription,
prestations, tarifs, lignes — attendait qu'il appuie sur « Mon devis → ». Il ne
l'a pas fait. Corriger le seul chemin l'aurait mené droit sur une feuille vide,
c'est-à-dire sur la panne du 7 août (*« le devis ne comporte aucune ligne, gros
bug »*), resservie par un autre bout.

### Pourquoi à l'ARRIVÉE, et pas au relâchement de l'anneau

Le réflexe est de lancer la chaîne dès qu'il relâche l'anneau : c'est plus
rapide, quand ça marche. Mais **il ferme l'application dans la seconde qui
suit** — c'est le geste même qu'il décrit — et l'appel part alors avec l'onglet.
Il n'en resterait rien, et l'on aurait un correctif qui ne se déclenche jamais
dans les conditions où il est nécessaire.

Le seul moment où l'on est **sûr** qu'un navigateur est présent pour attendre le
résultat, c'est celui où il rouvre le devis. La préparation vit donc là, et elle
survit à tout ce qu'il peut fermer entre-temps.

### Trois partis pris de l'écran

| | |
|---|---|
| **Le voile couvre le devis, il ne le remplace pas** | Si la chaîne échoue — pas de transcription, aucun tarif, une panne réseau —, « Ouvrir le devis tel quel » lui rend sa feuille et son crayon. Un écran qui n'aurait que l'échec à montrer serait un cul-de-sac |
| **On écarte sans naviguer** | Un renvoi vers une autre adresse ramènerait ici, où la préparation repartirait aussitôt. Le voile se referme en mémoire, le temps d'une visite ; rien n'est écrit pour désarmer la suivante |
| **Aucune règle dans l'écran** | Ce qui décide de la présence du voile est pur (`src/lib/devis-a-preparer.ts`) ; ce qui mène la chaîne est le composant qui la menait déjà (`DevisDepuisDictee`, mode `auto`). Une seconde implémentation aurait divergé au premier ajustement |

### Ce qui garde la promesse

`scripts/test-madame-lucie-e2e.ts` rejoue sa séquence entière : dicter, **fermer
l'application sans rien appuyer d'autre**, revenir par la liste, cliquer le nom.
Deux suites voisines ne pouvaient pas voir ce trou —
`test-reprendre-ou-il-en-etait` tient la règle mais ne clique nulle part, et
`test-anneau-vers-devis-e2e` **appuie sur « Mon devis → »**, c'est-à-dire fait
précisément le geste qu'il n'a pas fait.

Elle sait échouer : confrontée à l'ancien code, elle rougit sur trois cas et
nomme le coupable — *« la liste l'envoie sur /informations »*.

---

## 143. Le calendrier du planning sert aussi à proposer une date

**Sa demande du 22 août 2026**, validée sur planche 91
(`appli/choisir-la-date.html`) : *« lorsqu'on clique sur "Choisir la date" […]
on devrait avoir le visuel du calendrier qui se trouve dans la catégorie
planning, avec la possibilité de cliquer sur les jours pour voir quels chantiers
y sont déjà affectés — comme ça on peut savoir si oui ou non on peut rajouter
des clients sur les jours. »*

### Ce que l'écran d'avant ne pouvait pas dire

Il montrait un calendrier NU — des ronds, et les jours impossibles éteints. Il
refusait un jour **sans jamais dire pourquoi ni ce qu'il portait** : le patron
ne pouvait pas juger s'il était possible de s'y glisser quand même. Devant un
jour refusé, il n'avait qu'à le croire sur parole.

### Regarder n'est plus retenir

C'est le changement de fond, et il tient en deux gestes :

| Le geste | Ce qu'il fait |
|---|---|
| toucher une case | **ouvre la journée** — qui est là, à quelle demi-journée, avec quelle équipe, et le verdict du serveur pour ce chantier-ci |
| « Proposer ce jour » | **engage la date** auprès du client |

Auparavant, les deux n'en faisaient qu'un : un jour consulté par erreur partait
chez quelqu'un. Sur un devis, cela ne se rattrape pas d'un clic.

**Un jour complet reste TOUCHABLE**, à sa demande explicite — *« c'est justement
celui sur lequel vous voulez regarder avant de décider »*. Il ne se propose
simplement pas au client tant que la place manque, et la fiche dit laquelle.

### Trois pièces en partage, jamais en copie

| Pièce | Ce qu'elle porte | Pourquoi elle est partagée |
|---|---|---|
| `src/components/atlas/MoisCharge.tsx` | le dessin du mois — barres de charge, week-end teinté, aujourd'hui cerclé d'or | deux calendriers divergeraient au premier réglage |
| `src/components/atlas/useOccupation.ts` | qui occupe quelle demi-journée, absences et équipes cochées comprises | deux calculs finiraient par ne pas dire la même chose de la même journée |
| `src/server/contexte-planning.ts` | le chargement : chantiers datés, équipes, absences | deux lectures séparées finiraient par ne pas lire les mêmes absences |

**Le prix de ne pas les partager est connu**, et ce dépôt l'a déjà payé : le
planning annonçant libre une journée que l'écran d'envoi refuse — deux vérités
sur la même capacité, à deux écrans d'écart (`CLAUDE.md` §3).

### Ce que le serveur garde pour lui

Le calendrier peint la charge des douze mois chargés ; **c'est
`verifierJourPropose` qui tranche**, y compris au-delà de cette fenêtre. Le
calendrier montre, le serveur décide — le retirer rendrait le geste plus joli et
moins sûr.

**Et rien de ce planning ne part chez le client.** Sa page reçoit sa propre
liste, recalculée sur SA fenêtre au moment où il ouvre le lien (`lireParJeton`).
Les deux horizons ne se rejoignent nulle part : élargir celui du patron n'ouvre
pas son carnet de commandes (`docs/AGENT.md` §2.2 bis).

### Ce que la batterie a trouvé, et que la capture ne montrait pas

Trois suites tenaient l'ancien geste, et il fallait les adapter — pas le code
(`CLAUDE.md` §5 bis) :

- **la case éteinte n'existe plus** : le refus s'écrit sous la case, et c'est le
  bouton qui reste hors d'atteinte ;
- **l'exception « tuile de calendrier »** du contrôle des boutons arrondis
  visait `PlanningClient` ; le dessin ayant déménagé, elle dénonçait une
  décision du patron qui n'avait pas bougé d'un pixel ;
- **la fiche du jour portait `data-jour`**, comme les cases : deux éléments pour
  le même jour, et une suite qui ne savait plus lequel viser. Elle porte
  désormais `data-journee`.

---

## 144. Le diamètre du tuyau d'arrosage : deux critères, et un seuil en mètres

**Sa demande du 22 août 2026.** *« Ils sont également en capacité de me dire,
passé un certain nombre de mètres linéaires, qu'il faut passer du PEHD en
diamètre vingt-cinq à celui en diamètre trente-deux. J'aimerais que mon outil
arrosage puisse faire la même chose. »*

### Ce qui existait, et ce qui manquait

`amenee()` (dans `src/lib/arrosage/calcul.js`, copie de
`appli/arrosage-calcul.js`) calculait déjà la perte de charge de l'amenée
compteur → regard par Hazen-Williams, et tranchait Ø25 / Ø32 sur **la longueur
saisie**. Deux manques :

1. **aucun seuil.** Pour savoir où la bascule se produit, il fallait ressaisir
   la longueur jusqu'à la trouver. Or c'est le seuil qui sert sur le terrain :
   il se compare au mètre ruban avant de creuser ;
2. **un seul critère.** La perte de charge d'un tuyau court est presque nulle —
   donc un Ø25 « passait » à n'importe quel débit pourvu qu'il soit assez court.

### La décision

**Deux critères, et le débit prime.**

| | Formule | Ce qu'elle donne |
|---|---|---|
| vitesse | `Q = π(D/2)² × 1,5 m/s × 3600` | Ø25 : 1,76 m³/h · Ø32 : 2,91 |
| longueur | `L = budget × 10,2 × D^4,87 / (10,67 × (Q/150)^1,852)` | le seuil en mètres |

Le débit prime parce qu'**aucune longueur ne le rattrape**, alors qu'une amenée
trop longue se raccourcit parfois en déplaçant le regard. Quand le débit interdit
le Ø25, `longueurMax25` vaut **0** et non le seuil calculé : annoncer « Ø25
jusqu'à 12 m » sur un tuyau où l'eau filerait à 2 m/s serait un chiffre qu'on
croit et qui ne tient pas.

**Le budget de perte, c'est `pression source − pression exigée par la buse`** —
celle à laquelle sa portée et son débit sont donnés au catalogue. Une 5004
donnée à 2,8 bar sur une source à 3 bar ne laisse que 0,2 bar : d'où des seuils
courts, et ils sont justes. C'est exactement pourquoi le métier réclame 3 bar
dynamiques au minimum.

### Ce qui a validé le chiffre de la vitesse

1,5 m/s en Ø25 donne **1,76 m³/h**. Au seau, sur son compteur en Ø25, le patron
avait relevé **1,80 m³/h** (`mesure-debit.ts`, `DEBIT_COMPTEUR`). Les deux
chiffres ne viennent pas de la même source — l'un d'un abaque, l'autre d'un seau
et d'un chronomètre — et ils tombent à 2 % l'un de l'autre. C'est ce qui permet
de croire la formule plutôt que de la supposer.

### L'écran de l'application ne montre QUE le seuil

`actions.ts` remonte `tuyau: { seuil25, seuil32, debit, insuffisantMemeEn32 }`,
et **pas** le verdict. Raison : cet écran ne demande pas la longueur de l'amenée,
et le calcul en prendrait une par défaut (30 m). Un « il vous faut du Ø32 » tiré
d'une longueur que personne n'a saisie serait un chiffre inventé (`CLAUDE.md`
§4). Le seuil, lui, ne dépend d'aucune saisie.

La page publiée `appli/arrosage.html`, elle, demande la longueur : elle affiche
le verdict **et** le seuil.

### Ce que la suite a appris

Le premier contrôle disait `seuil > 0`. Confronté à la formule retournée de
travers — multiplier au lieu de diviser —, il est resté **vert** en affichant
« 0 m » : le seuil valait quatre dix-millièmes de mètre. C'est le contrôle qui
mesure zéro du `CLAUDE.md` §5, dans sa version la plus sournoise, puisqu'il
affichait le bon chiffre et concluait le contraire. `test-arrosage-calcul.ts`
exige maintenant une longueur **plausible** (5 à 500 m), un rapport Ø32/Ø25 d'au
moins 2, et éprouve la bascule un mètre avant et un mètre après le seuil. Les
trois défauts plausibles — formule retournée, diamètres inversés, critère de
vitesse retiré — ont chacun été joués et font rougir la suite.

---

## 145. La buse se calcule à la pression du chantier — et la portée ne se gonfle pas

**Sa demande du 22 août 2026 : « oui code le ».**

### Le problème

`CATALOGUE.buses` ne porte qu'**une** valeur de portée et de débit par buse, à
**une** pression de référence (2,5 bar pour les turbines Rain Bird, 2 bar pour
les tuyères VAN) — c'est écrit noir sur blanc dans le catalogue lui-même :
*« PARTOUT LE MÊME TROU »*. Le calcul les prenait telles quelles.

### Deux lois, deux statuts, et c'est le coeur de la décision

| | La loi | Son statut | Sens de la correction |
|---|---|---|---|
| **débit** | `Q ∝ √P` (Torricelli) | **physique** | les deux sens |
| **portée** | `R ∝ P^(1/3)` | **estimation** | vers le bas seulement |

Le débit d'un orifice suit la racine carrée de la pression : ce n'est pas un
abaque, c'est de la mécanique des fluides. Sous-estimer un débit chargerait trop
un réseau — le défaut même qu'on corrige — donc on l'applique **dans les deux
sens**.

La portée n'a pas d'équivalent. La balistique pure donnerait `R ∝ P`, mais l'air
freine le jet et l'écrase : les tables des constructeurs montrent une variation
bien plus douce, de l'ordre de la racine cubique. **Cet exposant n'est pas
relevé de ses catalogues** — c'est une estimation, et elle est traitée comme
telle :

1. **jamais vers le haut.** Au-dessus de la pression de référence, la portée du
   catalogue est conservée. Gonfler une portée sur un chiffre supposé ferait
   espacer les arroseurs, et un espacement trop large est un trou d'arrosage
   qu'on ne découvre qu'en juillet ;
2. **vers le bas, oui.** C'est le sens où se tromper coûte un arroseur de plus,
   jamais une tache sèche ;
3. **elle se dit.** `calculerPlan` rend `porteeEstimee`, et `actions.ts` en fait
   une réserve affichée sous le plan (`CLAUDE.md` §4).

### Où la correction s'applique, et pourquoi là

Dans `modelePour`, **avant tout choix** : les buses sont corrigées puis
**retriées** par portée décroissante. Deux raisons :

- le pavage, le débit et la pluviométrie travaillent ensuite sur les mêmes
  valeurs. Corriger plus tard reviendrait à choisir une buse sur sa fiche et à
  la poser sur autre chose ;
- deux buses de pressions de référence différentes ne se réduisent pas du même
  facteur : l'ordre décroissant du catalogue peut cesser de l'être après
  correction, et tout le choix « la plus grande qui tient » repose sur cet ordre.

### Ce que cela change, et ce que cela ne règle pas

Son jardin d'exemple à 3 bar passe de **trois à quatre réseaux** : les buses
données à 2,5 bar débitent 9,5 % de plus à 3 bar. Les plans d'avant tenaient sur
des débits sous-estimés.

**La pression retenue est celle de la SOURCE.** Les pertes du réseau lui-même —
la ligne, l'électrovanne, les raccords — ne sont toujours pas calculées : le
dernier arroseur d'une longue ligne voit moins que ce chiffre. Ouvert dans
`TODO.md`. Le faire demanderait une boucle (la pression dépend du débit, qui
dépend de la buse, qui dépend de la pression) ; ce n'est pas fait, et le taire
aurait été présenter un progrès comme une garantie.

### Les contrôles

`test-arrosage-calcul.ts` tient l'égalité **exacte** : à quatre fois la
pression, la demande vaut exactement le double (√4 = 2). Une tolérance large
laisserait passer un exposant de travers. Trois défauts ont été joués et font
chacun rougir la suite : correction retirée, portée gonflée vers le haut, loi
linéaire au lieu de la racine. Un quatrième contrôle tient la non-régression :
à la pression du catalogue, le plan doit être **identique** à ce qu'il était.

---

## 146. Un réseau est plafonné par son tuyau, pas seulement par le compteur

**Sa déduction du 22 août 2026**, en lisant le §144 : *« tu ne viens pas de me
dire qu'en diamètre vingt-cinq c'était 1,76 m³/h ? Donc dans tous les cas le
calcul doit se faire là-dessus, peu importe qu'on ait 2 ou 1,80, non ? »*

### Le trou

`decouper()` coupait un réseau à `débit du seau × 0,85` — la SOURCE, et rien
d'autre. Le débit maximal du tuyau, calculé au §144, ne servait qu'à choisir le
diamètre de l'amenée. Or **toutes les lignes de réseau sont en Ø25** : c'est le
diamètre de tous les raccords du catalogue (té 25×3/4"×25, coude 25×3/4").

| Source mesurée | Ancienne limite | Ce que le Ø25 passe | |
|---|---|---|---|
| 1,80 m³/h | 1,53 | 1,76 | la source commande |
| 3,00 | 2,55 | 1,76 | **dépassé de 45 %** |
| 4,50 | 3,82 | 1,76 | **plus du double** |

### Pourquoi personne ne l'avait vu

**Le compteur du patron donne 1,80 m³/h.** À ce débit, la source commande
toujours : `1,80 × 0,85 = 1,53 < 1,76`. Le défaut était donc structurellement
invisible sur le seul chantier dont ce dépôt dispose, et il serait apparu chez
le premier utilisateur mieux alimenté — l'eau à plus de 2 m/s dans la ligne, la
pression qui tombe avant le dernier arroseur, un gazon jauni en juillet.

**C'est la leçon, et elle dépasse l'arrosage : une règle éprouvée sur un seul
chantier n'est pas une règle éprouvée.** Les suites montent désormais la source
jusqu'à 9 m³/h — un régime que le patron ne rencontrera jamais — parce que c'est
le seul où le défaut existait.

### La décision

`limite = min(débit du seau × 0,85, débit maximal du Ø25)`.

Le plafond du tuyau **ne porte pas la marge de 0,85 en plus** : les 1,5 m/s sont
déjà une limite de bonne pratique, pas un maximum physique. L'empiler
reviendrait à payer deux fois la même prudence, en vannes et en devis.

`decouper()` rend `limitePar` (`'source'` ou `'tuyau'`), remonté jusqu'à
l'écran : un artisan qui a mesuré 3 m³/h et voit ses réseaux coupés plus tôt
qu'il ne s'y attend doit lire que c'est son Ø25 qui commande, sinon il croit à
un défaut de calcul.

### Effet de bord assumé sur un contrôle

Le critère de vitesse d'`amenee()` (§144) **n'est plus atteignable** par
`calculerPlan` : le plafond agit en amont, donc aucun secteur ne peut plus
l'armer. Il reste en place comme défense en profondeur, mais
`test-arrosage-calcul.ts` l'écrit noir sur blanc plutôt que de laisser croire
qu'il veille — **un contrôle qui ne peut plus rougir ne prouve rien**
(`CLAUDE.md` §5), et le prétendre serait pire que de l'avoir retiré. Ce que la
suite éprouve à sa place, c'est la garantie qui l'a rendu inatteignable.

---

## 147. Ce qui arrive au dernier arroseur : le calcul en deux passes

**Sa demande du 22 août 2026 au soir : « oui corrige la 1 ».** C'était le
dernier trou connu du calcul d'arrosage.

### Le problème

Seule l'amenée compteur → regard était comptée (§144), et l'écran l'avouait :
*« ce calcul ne compte QUE l'amenée — ni les antennes, ni les raccords, ni
l'électrovanne »*. Or c'est la pression au pied du DERNIER arroseur qui décide
de sa portée, et donc de l'espacement de toute la ligne.

Sur son jardin d'exemple à 3 bar : 0,27 bar perdus dans l'amenée, **0,44 dans
le réseau**, il arrive **2,28 bar**. Les buses étaient dimensionnées sur 3.

### Ce qui est compté, et d'où ça vient

| | Valeur | Source |
|---|---|---|
| la ligne, tronçon par tronçon | Hazen-Williams | formule, déjà au dépôt |
| l'antenne PEBD Ø16 | calculée, 2 m par tête | longueur de sa nomenclature |
| l'électrovanne | 0,25 bar | **non relevée** — majorant |
| les raccords | +15 % du linéaire | **non relevée** — règle de l'art |

Les deux valeurs non relevées sont posées **en majorant** : une perte
surestimée conclut plus tôt, donc pose un arroseur de plus — le sens où se
tromper coûte 30 € au lieu d'un chantier (`CLAUDE.md` §4 ter). Le jour où il les
relève, elles se corrigent en un seul endroit.

### Le débit décroît le long de la ligne

Entre la vanne et la première tête passe le débit du réseau entier ; entre la
première et la deuxième, ce débit moins une tête. Le calcul parcourt donc les
têtes **dans l'ordre où le tuyau les visite** — celui que `decouper` a déjà
établi pour colorier le plan — et somme tronçon par tronçon, en distance de
Manhattan (un tuyau suit les axes).

Compter le débit total sur toute la longueur donnerait **0,77 bar au lieu de
0,44** : assez pour condamner des plans qui tiennent, et un avertissement qui
parle à tort s'apprend à être ignoré.

### Deux passes, et pourquoi jamais trois

La pression au bout dépend des débits, qui dépendent de la pression. On ne peut
pas commencer par la fin :

1. un plan à la pression de la SOURCE — ce que faisait le calcul jusqu'ici ;
2. on mesure ce que perdent l'amenée et le pire réseau, on retire, on REFAIT.

**Une troisième passe irait dans le mauvais sens.** La seconde passe baisse les
débits (moins de pression, moins de débit), donc ses pertes sont plus faibles,
donc la troisième passe *remonterait* la pression. On tournerait autour de la
valeur au lieu de s'en approcher. S'arrêter à deux garde les pertes des débits
les plus forts : le côté prudent.

**La pire perte vaut pour tout le jardin.** Dimensionner chaque réseau à sa
propre pression donnerait des buses différentes d'une vanne à l'autre sur une
même pelouse — deux portées, deux espacements, un plan qu'on ne sait pas poser.

**Sous un demi-bar de reste** (`PLANCHER_UTILE`), on ne raffine plus : ce n'est
plus un ajustement de portée, c'est un réseau qui ne fonctionne pas, et cela
s'écrit à l'écran.

### Ce qui reste dehors

Le trajet du regard à la première tête. Il dépend de l'endroit où la nourrice
est posée, et aucune saisie ne le donne aujourd'hui. La pression annoncée est
donc un **plafond**, et les deux écrans le disent.

### Les chiffres affichés viennent tous de la passe 2

Les deux passes ne donnent pas les mêmes pertes. Publier celles de la passe 1 à
côté d'un plan issu de la passe 2 mettrait deux pertes d'amenée différentes dans
le même écran — on relit sans méfiance, on ne retombe pas sur ses pieds, et
c'est toute la liste dont on doute (`CLAUDE.md` §4 bis). La pression qui a servi
à choisir les buses reste, elle, celle de la passe 1, plus basse de quelques
centièmes : l'écart va dans le sens sûr.

### Un contrôle pris en flagrant délit

Le premier contrôle de la perte bornait le résultat à « moins du double du pire
débit ». La version juste **et** la version fausse y passaient au vert : il a
fallu injecter le défaut pour s'en apercevoir. La valeur est désormais figée à
cinq millièmes près, et le message nomme les deux nombres — 0,442 attendu, 0,773
si la décroissance saute. Sévère à dessein : ce chiffre décide du nombre
d'arroseurs par ligne.

**Deux autres contrôles ont dû être réécrits**, parce que le raffinement les a
rendus faux :

- le seuil Ø25 → Ø32 **n'est plus une constante** : allonger l'amenée baisse la
  pression au bout, donc change la buse et le débit, donc le seuil. C'est un
  point fixe, pas une frontière fixe ; la suite éprouve l'existence de la
  bascule, plus son emplacement au mètre ;
- la loi en √P ne peut plus s'éprouver entre 2,5 et 10 bar : à 10 bar de source
  il n'en arrive plus 10 au bout, et à 2,5 la portée réduite fait changer de
  buse. Deux choses bougeaient à la fois. Elle s'éprouve désormais entre 3 et
  3,2 bar, où la même buse est retenue, contre les pressions réellement
  reçues.


## 148. Le temps passé se masque au client — et ce qui est masqué ne sort pas du serveur

**Sa demande du 22 août 2026**, capture de la fiche d'entretien à l'appui :
*« il faudrait mettre un petit bouton on/off pour si l'utilisateur ne veut pas
que le temps apparaisse sur la fiche, pouvoir l'effacer — on, le temps
apparaîtrait sur la fiche ; off, il n'apparaîtrait pas. »* Dessiné en planche 92
(`appli/temps-sur-la-fiche.html`), codé le 23 après deux corrections de sa part.

### Une colonne à part, et non `minutes IS NULL`

La solution qui n'écrit rien de neuf était tentante : masquer en remettant
`minutes` à NULL. Elle confond deux choses qui n'ont rien à voir —

| | |
|---|---|
| `minutes IS NULL` | **je n'ai pas chronométré** |
| `temps_visible = false` | **je ne veux pas le lui dire** |

— et elle coûte au patron le chiffre qui dit ce qu'a coûté un chantier. Il le
ressaisirait au passage suivant, et l'application lui aurait fait perdre une
information qu'il avait prise. D'où `passages_entretien.temps_visible`
(migration `0060`), défaut `true` : c'est ce que l'application faisait déjà, et
repeindre en masqués les rapports déjà partis changerait ce que des clients ont
lu — alors que leur empreinte, elle, ne bouge pas (l'invariant du 16 août).

### Le masquage se décide au SERVEUR

`lireRapportParJeton` rend `minutes: null` quand c'est masqué. Rendre la durée
puis la cacher au rendu la laisserait dans le HTML du client, à portée d'un clic
droit — le défaut exact que le tri des prestations faites évite depuis le
16 août, dans la même fonction. **Ce qui est masqué ne quitte pas le serveur.**

### L'empreinte scelle ce que le client A LU

Un temps masqué n'entre pas dans le contenu haché par `figerPassage`. Ce n'est
pas un détail de forme : cette empreinte remplace une signature (décision du
16 août). Y sceller une durée absente de la page du client la rendrait
indéfendable le jour où il conteste le passage — on lui opposerait un chiffre
qu'il n'a jamais vu. **Pour cette preuve, un temps caché est un temps qui
n'existe pas**, et deux fiches par ailleurs identiques portent donc deux
empreintes différentes selon qu'elles montrent leur temps ou non.

### Ce qu'il a fait retirer

- **Le total gris à droite de la molette** (« 1 h 45 ») : les deux listes disent
  déjà « 1 h » et « 45 ». Sa demande du 23 août.
- **La phrase longue sous la molette**, qui annonçait aussi que la durée restait
  enregistrée. Elle est réduite à ce qu'il a dicté : *« Votre client ne le verra
  pas sur son compte rendu. »* Le contrôle qui exigeait la version longue a été
  adapté, pas contourné (`CLAUDE.md` §5 bis).

### Ce qui reste ouvert

Il ne s'est pas prononcé sur le **réglage de départ** — codé sur « Visible ».
Passer à « Masqué » est le défaut de la colonne à retourner. Voir `TODO.md`.

## 150. Le plan se DESSINE : du croquis lu au tracé de la tranchée

**Sa demande du 21 août 2026 :** *« il manque la photo, le schéma avec les
réseaux, et l'implantation des arroseurs — les différents réseaux de
couleurs »*. Puis son feu vert du 23 : *« très bien, tu peux coder la
maquette »*.

### Ce qui manquait, et qui n'était pas ce qu'on croyait

Le calcul savait déjà **tout ce qu'il faut** : `poser()` engendre les têtes
depuis le 17 août, `decouper()` sait depuis le 19 laquelle va sur quelle vanne.
Rien ne SORTAIT : `calculerPlan` rendait des comptes et une liste de pièces, pas
des coordonnées. Le plan des maquettes portait donc le contour de SON jardin,
écrit en dur — un outil ne peut pas fonctionner ainsi.

Trois pièces ont été ajoutées, et **aucune ne recalcule ce qui existait** :

| Fichier | Ce qu'il tient |
|---|---|
| `src/lib/arrosage/terrain.ts` | la forme du terrain, **union** des zones |
| `src/lib/arrosage/trace.ts` | par où passe le tuyau, et donc la tranchée |
| `src/lib/arrosage/plan-dessine.ts` | l'assemblage, et les deux refus |

`calcul.js` n'a gagné qu'une chose : `dessin`, la mise au jour des points déjà
calculés, en coordonnées **absolues** (`poser()` les rend relatifs au coin de la
zone — ce qui suffit pour compter, jamais pour dessiner).

### Le contour est une UNION, jamais une juxtaposition

Deux pelouses qui se touchent forment **un seul terrain**, et la ligne qui les
sépare n'existe pas sur place. La laisser dans le contour ferait croire au tracé
qu'il longe un bord alors qu'il coupe en plein milieu — et toute la règle « on
ne traverse pas le jardin » reposerait sur une frontière imaginaire.

Les zones étant des rectangles à côtés droits — un croquis de jardin ne donne
rien d'autre —, l'union se fait par la méthode la plus simple qui soit juste :
découper le plan sur toutes les abscisses et toutes les ordonnées présentes,
marquer les cases couvertes, suivre le bord des cases marquées. Le **signe de
l'aire** sépare ensuite un contour d'un trou, sans test d'inclusion.

**Plusieurs contours n'est pas une anomalie** : une pelouse devant et une
derrière, séparées par la maison, c'est le cas le plus courant. Chaque morceau
se trace pour lui-même, et le cheminement entre les deux — qui passe hors de la
pelouse, sur un chemin que le croquis ne montre pas — est dessiné **en
pointillé** et porté en réserve. Un trait plein ferait croire à un métré.

### Le tracé : un graphe, et deux poids

L'arbre le plus court reliant des points est un arbre de Steiner, qu'on ne
résout pas exactement. On construit donc un graphe — arroseurs, nourrice,
**sommets du contour** et projections —, on ne relie que des points alignés dont
le segment reste dans le terrain, et l'on cherche le plus-court-chemin depuis
tout ce que le réseau atteint déjà.

Deux poids, et non un seul :

- un segment qui **longe** un bord est facturé sa longueur ;
- un segment qui **coupe** l'intérieur est facturé sa longueur × 2.

**Et un segment déjà creusé coûte ZÉRO.** C'est là que la règle du patron se
joue — *« lorsque c'est égal il faut privilégier de réutiliser la tranchée, car
c'est moins fatigant »* : le mètre de tuyau se pose, le mètre de tranchée se
creuse et se remblaie. Un réseau a donc raison de rallonger son tuyau pour
rester dans une saignée déjà ouverte.

**Une première version a été jetée**, et c'est instructif : elle reliait chaque
arroseur au point atteint le plus proche par un simple coude. Elle ne savait pas
CONTOURNER — pour aller de la nourrice au coin opposé, elle traversait, faute de
pouvoir passer par les sommets du terrain. Elle rendait 76 ml de tranchée là où
le tracé fait à la main en demandait 64.

### Du croquis au terrain : un seul passage, et il est ailleurs

**La lecture ne rend pas des mètres, elle rend des FRACTIONS du dessin** (§149,
sa demande du 22 août : *« oui fais-le lire les proportions »*). C'est tout ce
qu'une image permet de dire sûrement : le modèle voit qu'une pelouse occupe le
tiers gauche du croquis, il ne voit pas qu'elle est à douze mètres du regard.

Le tracé et le contour, eux, travaillent en mètres. Il fallait donc un passage,
et **il vit dans `geometrie-croquis.ts`, pas ici** : `poserSurLeTerrain()`.
C'est le même module qui déduit déjà l'échelle pour le trajet du regard, et l'y
laisser garantit qu'une seule échelle sert aux deux. Deux conversions
finiraient par poser la même pelouse à deux endroits — `CLAUDE.md` §3.

**Les CÔTÉS viennent des cotes lues, jamais du rectangle dessiné.** Seule la
PLACE vient du dessin. Un trait tracé de travers ne doit pas changer un métré.

**Le défaut que ce passage évite est muet**, et c'est pour cela qu'il est
éprouvé sur une mesure et non sur une forme : une conversion oubliée passe la
fraction telle quelle, le plan reste cohérent avec lui-même, et il est
simplement dessiné sur un jardin d'un mètre de large. Aucun total ne bouge,
aucune alerte ne parle. `test-geometrie-croquis.ts` mesure donc la largeur du
terrain obtenu et vérifie que **deux zones voisines ne se chevauchent pas** —
c'est ce second contrôle qui a d'abord attrapé un jeu d'essai dont les
proportions n'étaient pas, elles-mêmes, à l'échelle.

### Les deux refus, et pourquoi ils sont durs

`CLAUDE.md` §4 bis : *« sans ça il ne doit rien proposer »*. Ce n'est pas le
dessin qu'on retire, c'est **le plan entier** — une liste de pièces sans tracé
se commande quand même.

| Ce qui manque | Ce qu'on fait |
|---|---|
| l'endroit **définitif** de la nourrice | refus, en le nommant |
| la position des zones les unes par rapport aux autres | **le plan sort sans son dessin**, et l'on dit pourquoi |

**La seconde ligne a changé le 23 août 2026**, et c'est lui qui l'a corrigée.
Ses trois éléments obligatoires sont les métrés, le piquage et la nourrice ;
l'AGENCEMENT n'en fait pas partie. Un croquis qui porte les trois donne un plan
juste — le compte d'arroseurs, les réseaux, les pièces — même si le dessin ne
peut pas être reconstitué. Tout refuser dans ce cas, c'est ce qu'il a vu :
*« il n'arrive pas à me lire mon croquis... là, il y a tous les métrés »*.

Le second mérite son existence : le calcul rend `x = 0, y = 0` quand le croquis
ne situe pas la zone. Deux pelouses se superposeraient alors **exactement**, et
le plan sortirait — juste au sens du compte, faux au sens du terrain, et rien à
l'écran ne le dirait.

**La nourrice n'est jamais déduite.** Elle est LUE sur le croquis
(`lire-croquis.ts` la cherche ; s'il ne la trouve pas, il rend `null` et le dit).
L'endroit du regard dépend de ce que lui seul sait — un point d'eau existant, un
passage de voiture, l'accès pour l'hivernage — et une tranchée ne se déplace pas.

### Les pièces se LISENT sur le dessin, elles ne se comptent pas à part

Le **degré** d'un point décide de sa pièce, et rien d'autre :

| Degré | Ce que c'est |
|---|---|
| 1 — la ligne s'arrête | **coude** taraudé 25×3/4" (tête creuse) |
| ≥ 2 — la ligne continue | **té** taraudé 25×3/4"×25 (tête pleine) |
| ≥ 3 sans arroseur | **té égal** 25×25×25 (losange) |

C'est la seule lecture qui ne puisse pas diverger du dessin. `tés + coudes =
arroseurs` tient donc **par construction, réseau par réseau** — et la suite le
vérifie réseau par réseau, jamais au total : au total, un té de trop d'un côté
et un coude de trop de l'autre s'annulent, ce qu'il avait justement relevé.

### Quatre défauts trouvés à la capture, aucun par un test

`CLAUDE.md` §5 : *« et surtout, regarder l'écran »*. Le plan ne s'atteint pas
normalement ici — il faut une photo et une clé de vision, que cet environnement
n'a pas. `scripts/capture-plan-arrosage.ts` rend donc le seul composant du
dessin, avec les données que le calcul produit vraiment.

1. Les cercles de portée **débordaient de la pelouse** et noyaient le dessin →
   découpés sur le contour (`clipPath`).
2. Le mot « nourrice » tombait **sur la cote du côté** → les cotes vivent
   dehors, ce mot vit dedans.
3. Deux réseaux qui partagent une tranchée dessinaient **le même trait**, et le
   second effaçait le premier — un réseau entier réduit à un point, sans qu'aucun
   chiffre soit faux. Chaque réseau est désormais écarté de l'axe, comme deux
   tuyaux le sont au fond de la saignée.
4. La tranchée était **du même jaune** que le troisième réseau (`#D8B45E` contre
   `#D9A520`). La maquette validée le 21 août ne portait que deux réseaux, bleu
   et vert : le défaut ne pouvait pas s'y voir. La tranchée est passée à une
   terre neutre, qui ne peut se confondre avec aucune des huit couleurs.

Le troisième et le quatrième ne se voient QUE sur un jardin à trois réseaux :
une règle éprouvée sur un seul cas n'est pas éprouvée (§146).

### Ce qui reste ouvert

**Deux têtes peuvent tomber au même endroit** — deux zones qui se touchent
posent chacune son arroseur sur l'arête commune. Le cas n'est pas soluble ici :
elles sont sur des vannes différentes, donc l'une ne peut pas remplacer l'autre.
C'est un coup de bêche à décaler sur place, et le plan le **dit** en réserve.


---

## 151. La pluviométrie ne coupe plus les secteurs — et « 13x », pas « 13 u »

**Ses deux décisions du 23 août 2026**, en une phrase chacune : *« ne prends pas
en compte la pluviométrie »* et *« pour le calcul des pièces, 13x et pas
13 u »*.

### La pluviométrie sort de la clé de secteur

Elle y était depuis le 17 août, et **c'est lui qui l'y avait mise** — *« ça ne
se mélange jamais »*. C'est donc lui qui l'en retire, et il n'y a rien à rouvrir
ici : la question a été posée et tranchée deux fois, dans les deux sens.

```
avant : p.cle + '|' + famille + '|' + pluvio
après : p.cle + '|' + famille
```

**Ce que cela change concrètement.** Deux turbines de buses différentes peuvent
désormais partager une vanne. Elles versent alors des millimètres/heure
différents, et la vanne les ouvre pour la même durée : la durée calculée
convient à l'une et pas à l'autre. Sur son jardin, l'écart mesuré était de 3 % ;
entre une 3504 fine et une grosse PGP, il se compterait en multiples. **Il le
sait, il arbitre à l'arrosage** — ce n'est pas un défaut à corriger dans son dos.

**Ce qui NE change pas :** la pluviométrie sert toujours aux durées (`poser()`),
et le MATÉRIEL sépare toujours. Une turbine et une tuyère ne s'ouvrent jamais
ensemble : l'une verse environ trois fois plus vite, et cette règle-là, il ne
l'a pas retirée. `test-arrosage-calcul.ts` éprouve **les deux faces** — que deux
buses peuvent se retrouver ensemble, et que deux matériels ne le peuvent pas.

**Conséquence dans le plan dessiné (§150) :** un réseau ne porte plus forcément
un seul modèle. `ReseauDessine.materiels` est devenu une LISTE, comptée par
modèle. N'en nommer qu'un ferait commander de travers, et c'était exactement le
raccourci que le code prenait tant que la pluviométrie garantissait l'unicité.

### « 13x », et non « 13 u »

**L'unité reste dans les données**, et c'est ce qui rend ce changement anodin
plutôt que dangereux : `{ q, u }` distingue une pièce qu'on compte d'un tuyau
qu'on mesure. Seul le mot affiché change — `quantiteEcrite(q, u)`, rendue « 13x »
pour une pièce et « 80 ml » pour un tuyau. *« 80x de PE Ø25 » ne se commande
pas.*

**Une seule fonction pour les deux écrans**, la page publiée et l'application :
elle vit dans la partie PARTAGÉE de `calcul.js`, donc identique des deux côtés
au caractère près (`verifier-arrosage-une-seule-source.mjs`). Deux façons
d'écrire la même quantité auraient fini par diverger — `CLAUDE.md` §3.

Deux contrôles la tiennent, et tous deux savent échouer : la suite du calcul sur
la fonction elle-même, et le vérificateur de la maquette sur **ce qui est
écrit** dans les trois tableaux — parce que c'est ce qu'il lit chez son
fournisseur.
---

## 152. Envoyer la facture : trois appuis deviennent un, et le mot dit ce qu'il engage

**Le patron, le 22 août 2026, capture à l'appui :** *« Quand je clique sur
confirmer le départ de la facture, ça me l'arrête. Après, je clique pour
l'envoyer. Ensuite, je dois recliquer pour ouvrir l'application SMS. Ça fait
beaucoup trop de clics. »*

Retenu sur planche (`docs/maquettes/84-envoyer-la-facture.html`) : **la B**,
et *« le choix SMS ou e-mail, mais de la même forme que sur la page fiche
client »*.

### Il comptait juste, et le premier appui mentait

| | Ce que ça faisait |
|---|---|
| « Confirmer le départ de la facture → » | l'**arrête** — numéro définitif, TVA, plus aucune modification |
| « Envoyer la facture au client → » | fabrique le lien du client |
| « Ouvrir le SMS tout prêt → » | ouvre enfin la messagerie |

**Le premier ne faisait partir rien du tout.** Le code le savait déjà et le
disait en commentaire — *« le patron a lu "facture arrêtée" et compris que son
client l'avait reçue »* — sans que le libellé en tire la conséquence. Son mot à
lui, « Envoyer la facture », est plus juste pour l'envoi ; mais il ne dit plus
l'arrêt, qui est **sans retour**.

### Pourquoi la B, et ce qu'elle coûte

La **A** faisait exactement ce qu'il demandait, et rien de plus. Le risque n'est
pas théorique : si la messagerie refuse de s'ouvrir — iOS le fait, sans un mot —
la facture est **arrêtée quand même**, dans sa TVA, sans que le client ait rien
reçu.

Deux gestes séparés le lui rappelaient. Avec un seul, **la phrase est tout ce
qui reste** : deux lignes sous le bouton, qui disent l'arrêt et nomment la
sortie (l'avoir). Il ne les lira qu'une fois ; elles seront là le jour où il se
demandera pourquoi sa facture ne se modifie plus.

La **C** — n'arrêter qu'une fois le message parti — a été dessinée pour être
**écartée**, et le dépôt savait déjà pourquoi : aucun navigateur ne distingue
« expédié » de « ouvert puis abandonné » ni de « refusé sans un mot »
(`src/lib/depart-messagerie.ts`). Elle laisserait des factures faites, envoyées,
jamais entrées en comptabilité.

### L'ordre des opérations n'est pas un détail

Arrêter, préparer le lien, **ouvrir la messagerie, puis seulement rafraîchir**.
Un navigateur peut refuser une navigation vers `sms:` qui ne suit pas le doigt
d'assez près ; rafraîchir d'abord, c'est perdre le geste. Même ordre que l'envoi
du devis, pour la même raison.

Et si le lien manque après l'émission, l'écran **dit que la facture est arrêtée
quand même** : le taire lui ferait croire que rien n'a eu lieu, et rappuyer sur
un bouton qui a déjà engagé sa comptabilité.

### La capsule du canal est EXTRAITE, pas recopiée

`ChoixCanal` vivait dans `FormulaireNouveauChantier`, taillée aux mesures de sa
maquette. Elle vit maintenant dans `src/components/atlas/` : deux dessins du
même geste auraient divergé au premier ajustement, et c'est lui qui aurait vu
deux capsules différentes pour la même question à deux écrans d'intervalle
(`CLAUDE.md` §3).

**Un canal sans coordonnée reste INERTE, jamais masqué** — sa règle, dictée le
même jour : *« refuse l'envoi : ça veut dire qu'il communique avec le client par
SMS, donc il enverra par SMS »*. Aucun champ de saisie ici : il a écarté l'idée.

### Le contrôle, et ce qu'il a fallu corriger pour qu'il accuse juste

`scripts/test-envoyer-la-facture-e2e.ts` attendait le bouton par son **libellé**.
Confronté à l'ancien mot, il mourait sur un délai dépassé — il échouait, mais
n'apprenait rien. Il vise désormais un repère stable (`data-atlas`), trouve le
bouton, puis **cite ce qu'il a lu** : *« le bouton dit "Confirmer le départ de la
facture →" »*. Éprouvé aussi sans la phrase d'engagement : il rougit en disant
que rien n'avertit de l'arrêt.

## 153. La TVA se lit en tête, et les gestes touchent le chiffre qu'ils font monter

**Deux remarques du patron, le 23 août 2026, sur deux écrans voisins**, et une
seule cause : *« je trouve que l'outil Ma TVA à déclarer, il est caché, on ne le
voit pas trop »*, puis *« on ne comprend pas trop que scanner ou écrire à la
main, c'est pour la TVA déductible »*.

Dans les deux cas, rien ne fonctionnait mal. C'est la **place** qui mentait.

### Ce qui a été retenu, et par qui

Six propositions dessinées, essayables au doigt — pas des captures :
`docs/maquettes/86-ou-mettre-ma-tva.html` et
`docs/maquettes/85-achats-tva-deductible.html`. Sa réponse, mot pour mot :
**« Pour ma TVA la B / Et pour les achats la C »**.

- **86 · B** — une carte, en tête de « Terminés », **portant le montant**. Pas un
  lien : ce qu'il vient y chercher. Le chiffre se lit sans ouvrir, et donne la
  raison d'ouvrir.
- **85 · C** — « Scanner un ticket » et « Écrire à la main » remontent **contre
  l'encadré des chiffres**, avec un liseré haut en pointillé et l'arrondi bas que
  l'encadré a perdu. Le lien ne se dit par **aucun mot de plus** : il se dit par
  la continuité de la pièce.

### Pourquoi le montant se lit dans `src/server/tva-courante.ts`, et pas dans l'écran

L'écran du relevé compose déjà collectée, déductible et reste. Les recomposer
dans « Terminés » aurait donné **deux additions de la même somme** — et c'est LUI
qui aurait vu deux montants différents à deux écrans d'intervalle, sans savoir
lequel croire (`CLAUDE.md` §3 : jamais de règle dupliquée).

Le prix est assumé et a été dit devant la planche avant qu'il ne choisisse :
**trois requêtes de plus** sur un écran qu'il ouvre souvent.

### La réserve que la carte doit porter

Ce montant **n'est pas dû le jour où il le lit**. Il dépend du rythme (mois ou
trimestre) et du régime (encaissements ou débits), et n'est exigible qu'à
l'échéance. Affiché seul, il se lirait « ce que je dois aujourd'hui ». D'où deux
précautions dans la carte elle-même : elle **nomme sa période**, et la mention
sous elle dit **« Reste à payer sur la période »** — jamais « À payer ».

### Ce qu'un contrôle doit tenir ici, et pourquoi c'est difficile

**Les deux choix sont des choix de place, et une place ne casse pas.** La carte
peut redescendre en pied de liste, les deux boutons peuvent repasser sous les
achats : tout continue de fonctionner, et tout resterait vert. Ce sont
exactement les défauts qu'aucune autre suite ne peut voir.

`scripts/test-tva-en-tete-e2e.ts` mesure donc des **places**, pas des présences,
et chacune de ses six mesures a été **confrontée au défaut qu'elle nomme** avant
d'être gardée.

**Et c'est ainsi qu'un contrôle faux a été trouvé.** Le premier jet vérifiait que
la carte précédait « le dernier de ses frères » — or son frère, c'est sa propre
mention, qui descend avec elle. La carte remise en pied d'écran, le contrôle
**restait vert sur le défaut même dont il portait le nom**. D'où le repère
`data-atlas="contenu-termines"` : la carte se mesure contre la **liste**, jamais
contre ce qu'elle traîne derrière elle.

Deuxième faux départ, même leçon : la couture se mesurait depuis le bas des
**mots** « Reste à payer » et annonçait 25 px de brèche alors que les deux pièces
se touchaient — le rembourrage de la carte compté comme un écart. Un contrôle qui
accuse à tort coûte plus cher que pas de contrôle du tout (`AGENTS.md`). D'où le
repère `data-atlas="encadre-tva"`, et une mesure d'encadré à encadré — largeur et
bord gauche compris, car deux marges différentes feraient un décrochement visible
que rien d'autre ne dirait.

## 154. Ce qui ne doit sortir sur AUCUN document : le contrôle qui ne savait pas lire

**La note de la feuille de chantier a été codée DEUX FOIS, le même jour, par deux
sessions qui ne se voyaient pas.** Celle qui est arrivée la première sur `main`
fait foi (`chantiers.note`, migration 0061) ; la seconde a été retirée — deux
colonnes pour la même chose auraient été les deux vérités que `CLAUDE.md` §3
interdit. Ce qui suit est la seule chose que la seconde apportait, et elle vaut
d'être gardée.

### La promesse qui l'autorise à écrire librement

Sa décision du 23 août 2026 : la note **ne part sur aucun document** — ni devis,
ni facture, ni PDF sans les prix. Sur le papier que ses gars emportent, elle
serait devenue un écrit qui sort de l'entreprise, et *« client pas disponible
avant neuf heures »* se serait rédigé en sachant que le client peut le lire.

**C'est cette promesse qui l'autorise à y écrire ce qu'il ne dirait pas devant le
client — donc elle a besoin d'un contrôle, pas d'un commentaire.**

### Deux fois où ce contrôle ne POUVAIT PAS échouer

`scripts/test-note-hors-documents-e2e.ts` télécharge le PDF et y cherche les mots de la
note. Ses deux premières versions étaient **vertes en confrontation avec une note
délibérément versée dans le document** :

1. elle cherchait dans les **octets bruts** — or le texte d'un PDF est comprimé
   (`FlateDecode`), et rien n'y est jamais trouvé, y compris quand le mot est
   bel et bien imprimé ;
2. les flux décomprimés, elle cherchait des mots **en clair** — or le texte s'y
   écrit en hexadécimal, `<4174656C696572> Tj`.

Deux fois, le contrôle promettait le silence d'un document qu'il ne savait pas
ouvrir. C'est la faute de `CLAUDE.md` §5 : *un contrôle qui mesure zéro ne mesure
rien, et il est pire qu'absent* — parce qu'on cesse de regarder.

### La mesure qui garde les deux

**Le contrôle prouve d'abord qu'il sait LIRE ce PDF**, en y retrouvant une ligne
du devis, et refuse de conclure autrement. Ne pas retirer cette vérification
préalable en croyant simplifier : elle est tout ce qui sépare une promesse tenue
d'une promesse récitée.

**Et il cherche les mots un par un** — « broyeur », « dispo » —, jamais la phrase
entière : un PDF découpe son texte en fragments, et une recherche exacte ne
trouverait rien pour une raison qui n'a rien à voir avec la fuite.

## 155. Atlas SIGNE ses réponses, pour que le diagnostic cesse de deviner

**Le 23 août 2026, le patron ouvre Atlas depuis son téléphone : son navigateur
lui propose de TÉLÉCHARGER un fichier.** Sa fiche d'état annonce alors *« réponse
404 d'ATLAS lui-même — le port est bien ouvert, c'est l'application qui refuse »*
et l'envoie lire le journal du serveur.

**C'était faux, et deux hypothèses fausses lui ont été livrées avant qu'on ne le
voie** : l'espace éteint (démenti par sa capture), puis le port privé (démenti
par un *« je suis déjà en public »*).

### Le verdict devinait, et son indice ne valait rien

`_verdict-port.mjs` tranchait sur la présence du mot « github » dans l'en-tête
`Server` de la réponse. Un refus du relais arrivé **nu** — sans en-tête, sans
type, ce qui est exactement ce qu'il a reçu — tombait donc du côté d'Atlas.

C'est le travers que cette fiche avait été écrite pour éviter (`AGENTS.md` :
*une erreur qui envoie chercher au mauvais endroit coûte plus cher que pas
d'erreur du tout*), et il coûtait ici deux gestes inutiles au patron.

### Une signature ne se devine pas

`/api/health/live` pose désormais **`x-atlas-vivant: 1`**. Le relais de GitHub ne
peut pas l'inventer : présente, c'est Atlas qui a répondu ; absente, la requête
n'est jamais arrivée jusqu'à lui. Les marques de GitHub restent lues, mais
seulement pour **nommer** le relais — plus pour décider.

Et le conseil suit la certitude : la fiche ne propose plus *« deux causes
possibles, dans cet ordre »* — devant laquelle il essayait la première et
revenait dire qu'il l'avait déjà faite — mais **le geste**, un seul.

### Ce que ça a exigé, et qu'il ne faut pas défaire

**La signature doit être sur LE FIL, pas dans le code.** Éprouvée d'abord sur un
binaire pas reconstruit, elle paraissait absente : le contrôle interroge donc le
serveur pour de bon (`scripts/test-health.ts`), et il a été **vu rouge** contre
une route dont on avait retiré l'en-tête.

**Le perdre ne casserait rien à l'écran** — c'est tout le danger. Le diagnostic
se remettrait simplement à accuser le relais en toutes circonstances, et
personne ne le saurait avant la prochaine soirée perdue.

### Et devant un refus NU, la fiche dit ce que la réponse portait

Un 404 sans en-tête ni type ne laisse rien à examiner : la fiche décrivait un
vide, et l'agent en était réduit à supposer — deux allers-retours au patron, un
soir où il allait se coucher. Elle publie donc les **noms** des en-têtes reçus,
ou « AUCUN » quand il n'y en avait pas.

**Les noms, jamais les valeurs** : ce dépôt est public, et une valeur d'en-tête
peut porter un jeton. Un contrôle le tient, et il a été vu rouge dans les deux
sens — sur la disparition des noms, et sur la fuite d'une valeur.

## 156. Le dossier du client ne porte que ce qu'il a reçu

**Sa règle du 23 août 2026**, après avoir facturé M. Bernard : *« il y a une
fiche chantier qui s'est créée en même temps. Cette catégorie est réservée
lorsque les paysagistes créent une fiche chantier avec les informations type la
tonte, la taille, ce qu'ils ont fait. À aucun moment, lorsqu'une facture doit
être envoyée, une fiche chantier doit être créée. »*

### Deux erreurs se cachaient l'une derrière l'autre

| | |
|---|---|
| **Quand** | la colonne listait les chantiers `termine_at IS NOT NULL`, et **émettre une facture pose cette date** (`factures.ts` : `COALESCE(termine_at, now())`). Facturer fabriquait donc une pièce que personne n'avait écrite |
| **Quoi** | le document servi était la feuille **interne** — équipe, créneau, note vocale, adresse — que ses salariés ouvrent dans la camionnette. Rangée au dossier d'un client, elle donnait à croire qu'il l'avait reçue |

La seconde est la plus grave, et c'est celle qu'on ne voyait pas : une colonne
qui se remplit toute seule finit par être crue.

### La règle, et elle vaut pour les trois colonnes

**Une pièce du dossier est un document que le client A REÇU.** Un devis envoyé,
une facture émise, une fiche d'entretien partie. Ni brouillon, ni document
interne, ni pièce déduite d'un état.

La colonne porte donc les `passages_entretien` **figés** (`envoye_le` et `jeton`
non nuls), à l'adresse même que le client a reçue — `/entretien/{jeton}`.

### Une pièce n'est plus forcément un PDF

`PieceDuClient.format` (`"pdf"` par défaut) le dit à la carte. Sur une page :
la vignette annonce « FICHE », « Enregistrer » disparaît et « Ouvrir » devient
le geste principal. Rien ne fige ce rapport en fichier : proposer de
l'enregistrer aurait fait descendre une page web nommée `.pdf`, que rien
n'ouvre — le défaut du 7 août 2026, retourné.

### LE PIÈGE DRIZZLE, ET IL RESSERVIRA

Une sous-requête corrélée écrite `${passagesEntretien.id}` se rend en **`"id"`
NU** dès qu'aucune jointure n'oblige Drizzle à qualifier ses colonnes :

```
select count(*)::int from "lignes_passage" l
 where l.passage_id = "id" and l.faite     -- « id » = celui de l, jamais vrai
```

Chaque fiche s'annonçait « 0 prestation » sur une base qui en portait deux ou
trois. **Le voisin `listerPassages` écrit exactement la même chose et
fonctionne** — il porte un `leftJoin`, qui force la qualification : le motif
paraissait donc éprouvé. Écrire `passages_entretien.id` en toutes lettres.

**Aucun test ne l'a vu ; c'est la CAPTURE qui l'a montré** — la cinquième fois
dans ce dépôt qu'un défaut sort d'une image et d'aucun vert (`CLAUDE.md` §5). Le
contrôle qui manquait exige désormais **deux fiches à comptes différents** : un
seul compte juste peut l'être par hasard.

## 149. Le croquis dit où sont les choses : les proportions, et l'échelle déduite

**Sa demande du 22 août 2026 au soir : « oui fais-le lire les proportions ».**

### Ce que je lui avais dit, et pourquoi c'était faux

Le §147 avait fermé le calcul de pression sauf un morceau : le trajet du regard
à la PREMIÈRE tête. Je le lui ai présenté comme hors d'atteinte — *« aucune
saisie ne le donne »*. Sa réponse : *« j'ai pas besoin de lui dire, il a tous
les métrés du terrain, il a juste à calculer »*.

**Il avait raison sur le fond, je me trompais sur le fait.** Le croquis porte la
nourrice (c'est même obligatoire, `CLAUDE.md` §4 bis), les zones, et leurs
cotes. Ce qui manquait n'était pas l'information : c'était la LECTURE, qui ne
rendait que des dimensions et jamais des places. C'est le §5 ter du dépôt dans
sa version la plus coûteuse — déclarer impossible ce qui n'était qu'à écrire.

### Les places en fraction, jamais en mètres

Le modèle rend, pour chaque zone et pour la nourrice, `x`, `y`,
`largeur_fraction`, `hauteur_fraction`, tous entre 0 et 1. C'est tout ce qu'une
image permet de dire sûrement : il voit qu'une pelouse occupe le tiers gauche du
dessin, il ne voit pas qu'elle est à douze mètres du regard.

**Hors de [0, 1], la valeur est refusée, pas rognée.** Un « 12 » pour un x n'est
pas une fraction : c'est des mètres, un pixel, ou une confusion de champ. Le
ramener à 1 fabriquerait une position plausible et fausse — et c'est une
distance de tuyau qui en sortirait.

### L'échelle se DÉDUIT des cotes

`echelleDuCroquis` (dans `geometrie-croquis.ts`) croise les deux : une pelouse
de 16 m qui occupe 0,40 du croquis donne 40 m par unité de fraction. Chaque zone
cotée fournit jusqu'à **deux** estimations — une par côté, ce qui corrige une
zone dessinée de travers dans un seul sens.

**Médiane, pas moyenne.** Un modèle qui se trompe sur une zone tirerait la
moyenne vers son erreur ; la médiane l'ignore.

**Et le refus est la bonne réponse quand les zones se contredisent.** Au-delà de
`ECART_MAX_ENTRE_ZONES` (2), le croquis n'est pas à l'échelle ou la lecture est
fausse : on rend une raison, jamais une distance moyenne qui n'existe nulle
part. Deux, parce qu'un croquis à main levée n'est jamais exact — refuser plus
tôt ferait parler le garde-fou à tort, et un avertissement qui parle à tort
s'apprend à être ignoré.

### La distance : Manhattan, jusqu'au bord

Un tuyau suit les axes. À vol d'oiseau, on sous-estimerait à la fois le tuyau à
acheter et la perte qu'il subit — le mauvais sens des deux.

**Et elle vise le BORD de la zone, pas son centre.** La première tête est sur le
pourtour ; compter jusqu'au milieu ajouterait la moitié de la pelouse à un
trajet que la ligne parcourt déjà — cette longueur-là est comptée par
`perteDuReseau`, et la compter deux fois resserrerait la pose sans raison.

**Le trajet retenu est LE PLUS LONG** de toutes les zones : elles sont
dimensionnées sur une seule pression, qui doit être celle du point le plus mal
servi.

### Ce que ça change, et les garde-fous

Sur le jardin d'exemple, trente mètres de trajet coûtent **0,29 bar** : la
pression au dernier arroseur tombe de 2,28 à 2,01. Ce n'était pas un détail.

Deux refus supplémentaires, parce que ce calcul repose sur une lecture
approximative : au-delà de 200 m de trajet, ce n'est plus un jardin de
particulier mais une échelle lue de travers ; et sans nourrice dessinée, aucun
trajet — elle ne se déduit jamais du point d'eau (`CLAUDE.md` §4 bis).

### Pourquoi un fichier à part, et pas dans `calcul.js`

`calcul.js` est une copie octet pour octet partagée avec `appli/`
(`verifier-arrosage-une-seule-source.mjs`). Y mettre cette géométrie l'aurait
dupliquée dans une page qui n'en a pas l'usage. La distance est donc calculée
côté serveur et **passée en entrée** (`regardVersZone`), comme la longueur
d'amenée l'était déjà.

### Un contrôle a rougi sur mon erreur

`test-geometrie-croquis.ts` figeait « 8 m » pour une distance en diagonale ;
le calcul rendait 11. C'est moi qui avais lu les demi-côtés de travers — refaire
l'opération à la main était le seul moyen de trancher, et c'est exactement ce
que vaut une valeur figée dans une suite plutôt qu'une borne large.

Les deux défauts plausibles ont été joués : vol d'oiseau au lieu de Manhattan,
moyenne au lieu de médiane. Chacun fait rougir la suite en nommant le chiffre.

---

### Un croquis à main levée se lit quand même (23 août 2026)

**Sa correction, et elle allait au fond :** *« il n'arrive pas à me lire mon
croquis sous prétexte qu'il n'est pas à l'échelle. Ce qui serait bien, c'est
qu'il arrive à le lire même s'il n'est pas totalement à l'échelle, car les
utilisateurs ne vont pas s'amuser à faire des croquis à l'échelle à chaque fois.
Là, il y a tous les métrés. »*

Il avait raison. **Les COTES commandent, le dessin ne fait qu'ordonner.** Un
croquis à main levée dit avec certitude qui est à gauche de qui et qui touche
quoi ; il ne dit rien de fiable sur les longueurs — c'est justement pour cela
qu'on y écrit les métrés. Refuser le plan parce que le dessin n'est pas
proportionné, c'était refuser le croquis pour ce qu'il n'a jamais eu à être.

**Deux règles, désormais, et la sévérité reste où elle sert :**

| | Ce qu'elle sert | Devant un dessin approximatif |
|---|---|---|
| `echelleDuCroquis` | le **trajet du regard**, donc la pression, donc l'espacement | refuse — un chiffre faux y coûte un plan faux |
| `echelleTolerante` | le **dessin** | conclut, et le dit en réserve |

Une pelouse placée un peu de travers se voit et se corrige à l'œil ; une
pression fausse ne se voit qu'en juillet.

**Trois sources d'échelle, dans cet ordre :** les zones qui portent à la fois
leur cote et leur proportion ; **la haie**, qui porte sa longueur et dont on
prend le plus grand côté dessiné ; et, en dernier recours, la plus grande cote
du croquis rapportée à l'étendue du dessin — un ordre de grandeur, rendu marqué
« approchée ».

**Ce qui reste refusé, et doit l'être :** un croquis qui ne situe RIEN. Là, il
n'y a pas d'agencement à reconstituer, seulement à inventer.

**Et le refus n'accuse plus les cotes.** Le message qu'il a vu — *« aucune zone
du croquis ne porte à la fois ses cotes et sa place »* — désignait ses métrés
alors qu'ils étaient tous là : le fautif était la lecture, qui n'avait rendu
aucune proportion. Une erreur qui accuse à tort coûte plus cher que pas d'erreur
du tout (`CLAUDE.md` §5).

**La consigne au modèle a été reprise en conséquence.** « Tu ne devines jamais »
ne s'applique PAS aux places : une cote se LIT (illisible = null), une place se
MESURE sur l'image et se voit toujours dès que la zone est dessinée.


## 157. Ouvrir une fiche referme une autre — et la ligne touchée doit rester sous le doigt

**Son défaut du 22 août 2026, capture à l'appui :** *« lorsque le client se
trouve sur la partie haute de l'écran comme sur la photo, monsieur Pornic, et
que je clique dessus pour pouvoir afficher sa fiche chantier, le client remonte
et la fiche chantier aussi. […] tout remonte d'un bloc et je suis perdu, je ne
sais plus où est mon client. Il disparaît sous mes yeux. »*

### Ce n'était pas un défilement, et c'est ce qui rendait le défaut sournois

Aucun `scrollTo`, aucun `scrollIntoView` : chercher un appel de défilement dans
`PlanningClient.tsx` ne donne rien, et l'on conclut trop vite que l'écran est
innocent.

La cause est ailleurs, et elle vient d'une règle qu'il a lui-même demandée le
22 août — *« le même nom referme ce qu'il a ouvert »* : `carteListe` ne porte
**qu'une** fiche ouverte à la fois. Toucher un client en referme donc un autre.
Quand la fiche refermée se trouvait **plus haut dans la page**, tout ce qui la
suit remonte de sa hauteur — mesuré : **422 px** —, et la ligne touchée passe
au-dessus du bord de l'écran pendant que le doigt est encore dessus.

D'où la forme du symptôme, qu'aucune autre hypothèse n'explique : le défaut
n'apparaît **que** lorsque le client visé est haut sur l'écran, jamais au milieu
ni en bas. Au milieu, la fiche refermée est encore visible et l'on voit la page
se recomposer ; en haut, la ligne sort du cadre.

### Le navigateur ne le rattrape pas

Les navigateurs savent ancrer le défilement quand du contenu disparaît
au-dessus du point regardé (`overflow-anchor`). **Safari ne l'implémente pas** —
et c'est Safari qu'il a dans la main. Compter dessus, c'était livrer un écran
juste sur une machine et faux sur la sienne.

### La réparation : mesurer avant, rattraper après

`src/components/atlas/useAncrageDuGeste.ts` — un crochet, volontairement
minuscule :

1. dans le gestionnaire, **avant** tout changement d'état, on relève la position
   de la ligne dans la fenêtre (`getBoundingClientRect().top`) ;
2. `useLayoutEffect` la restaure une fois React repeint, par un `scrollBy` de
   l'écart.

**`useLayoutEffect`, jamais `useEffect`.** Le second s'exécute après que le
navigateur a peint : on verrait la page sauter, puis revenir. Le premier
s'intercale avant la peinture, et le saut n'existe jamais à l'œil.

**Ce qu'on ancre, c'est la LIGNE, pas la fiche.** Le nom du client est ce qu'il
cherche des yeux ; la fiche s'ouvre dessous et peut grandir sans le gêner.

**Ce que le crochet ne fait pas :** amener une ligne à l'écran quand elle n'y
est pas. Ce n'est pas son besoin — il touche ce qu'il voit — et un défilement de
confort par-dessus le sien lui reprendrait la main.

Un écart de moins d'un pixel est ignoré : c'est l'arrondi du rendu, pas un saut,
et le rattraper ferait vibrer la page à chaque geste.

### Le contrôle rejoue la SÉQUENCE, pas le geste

`scripts/test-ligne-planning-e2e.ts`, cas « Le client touché ne remonte pas ».
Une suite qui se contenterait de toucher une ligne sur une page fraîche ne
fermerait rien au-dessus d'elle, ne bougerait rien, et serait **verte sur le
défaut même qu'elle prétend attraper**. Elle ouvre donc une première fiche plus
haut, fait défiler jusqu'à ce qu'un autre client soit sous l'en-tête, puis le
touche.

Elle a été **confrontée à l'état dégradé** (`CLAUDE.md` §5) : l'ancrage
neutralisé, elle rougit en nommant le bon coupable — *« le client touché a bougé
de 422 px (145 → -277) »*. Et elle refuse de conclure si le montage n'a pas pu
amener la ligne assez haut, plutôt que de rendre un vert qui ne prouve rien.
## 158. Un devis vide ne part pas — la barrière porte sur les lignes, pas sur l'euro

**Le patron, le 23 août 2026 :** *« Le devis part à zéro euro chez la cliente,
alors qu'il y a un arbre à tailler et un à démonter. Rien n'apparaît chez elle. »*

Sa cliente avait donc sous les yeux un document qui n'énonçait **rien** — ni
prestation, ni prix — et un bouton « J'accepte ce devis » sous ce vide.

### Ce n'était pas une perte de données

Les lignes du devis viennent des lignes de **PRIX** (`genererDevis`), jamais des
prestations. Deux arbres décrits mais jamais chiffrés donnent un devis
authentiquement vide : le document était juste. **C'est de l'avoir laissé PARTIR
qui ne l'était pas.**

L'envoi savait refuser un devis absent, un canal non choisi, une coordonnée
manquante. Jamais un devis sans une seule ligne.

### Zéro LIGNE, et non zéro euro

Un devis à **0,00 €** peut être légitime — un geste commercial, un déplacement
offert. Le refuser interdirait au patron quelque chose qu'il a le droit de faire,
et ce serait une règle inventée (`CLAUDE.md` §4).

Un devis **sans une seule ligne** n'est jamais légitime : il n'y a rien à
accepter. La barrière porte donc sur ce qui est **écrit**, pas sur ce qui est
compté (`src/lib/devis-envoyable.ts`).

### Le refus vit aux DEUX bouts, depuis une seule règle

L'écran cache le bouton, et `envoyerAuClientAction` refuse de son côté : cacher
ne ferme rien, l'action reste appelable, et un devis vide parti est sans retour.
La phrase vient du même fichier des deux côtés — deux recopies finiraient par
diverger (`CLAUDE.md` §3).

**Et le blocage passe AVANT le canal** : à quoi bon lui faire choisir comment
joindre sa cliente pour lui envoyer un document qui n'énonce rien ?

### Le contrôle qui ne pouvait pas échouer, et comment on l'a vu

Le premier jet attendait le mot « aucune ligne » à l'écran — or l'éditeur de
devis porte déjà *« Aucune ligne pour l'instant »*. Le contrôle restait donc
**vert le garde-fou retiré** : il regardait le mauvais texte.

Il vise désormais une phrase qui n'appartient qu'au refus — *« recevrait un
document vide »* —, et il a été vu rouge contre l'absence du garde-fou. C'est la
troisième fois de la journée qu'un contrôle passait au vert sur le défaut même
dont il portait le nom ; le remède est toujours le même : **le confronter**.

## 159. Le devis se recompose au moment d'envoyer, pas au chargement de l'écran

**Le patron, le 23 août 2026 :** *« Le devis part à zéro euro chez la cliente,
alors qu'il y a un arbre à tailler et un à démonter. »* Puis, quand on lui a
répondu que rien n'était chiffré : *« j'avais mis des prix, cinq cent cinquante
et je ne sais plus combien, un devis à mille trois cents euros »*.

**Il avait raison, et la première explication était fausse.** Elle est consignée
telle quelle en §156 : elle concluait à des prestations jamais chiffrées, et
posait un garde-fou contre les devis vides. Le garde-fou reste utile ; le
diagnostic, lui, était à côté.

### Rien ne se perdait — rien n'arrivait

Ses prix étaient bien en base, dans `lignes_prix`. Ce sont les lignes du
**DOCUMENT** qui manquaient. Le devis ne se recompose que dans
`getOuCreerDevisBrouillon`, appelé au **chargement** de l'écran
(`src/app/chantiers/[id]/devis-complet/page.tsx`). Tout prix tapé ensuite — c'est-à-dire tous ceux qu'on
tape vraiment — restait dehors.

**Mesuré avant correction, sur son geste exact :** écran à **660,00 €**,
`lignes_prix` à 1 ligne, et le devis à **0,00 € et zéro ligne**.

### Deux nœuds, et le second était le plus discret

1. `envoyerAuClientAction` figeait le devis **sans le recomposer** ;
2. `creerEnvoi` retenait le `devisId` **venu du navigateur** — celui du
   chargement de la page. Or la page publique du client lit les lignes de CE
   devis-là. Le document recomposé pouvait donc être juste pendant que le lien
   pointait toujours sur le vide.

L'identifiant vient désormais du serveur, qui reprend la version courante du
chantier qu'il vient lui-même de recomposer. Le paramètre reçu est conservé dans
la signature mais ignoré : le retirer ferait glisser les arguments suivants et
transformerait une correction en panne.

### Le garde-fou de §156 accusait à tort, et c'est ce qui l'a révélé

Posé contre les devis vides, il comptait les lignes du **document périmé** — donc
il refusait un envoi parfaitement légitime : écran à 660 €, refus affiché. *Un
contrôle qui accuse à tort coûte plus cher que pas de contrôle du tout*
(`AGENTS.md`).

La recomposition a été portée dans `preparerEnvoiAction`, c'est-à-dire **à
l'ouverture de la feuille d'envoi**. Ce que l'écran compte, ce qu'il montre et ce
qui partira sont enfin la même chose.

### Ce que le contrôle doit faire, et qu'aucun autre ne faisait

Toutes les suites d'envoi chiffraient **avant** d'ouvrir l'écran du devis — par
`/prix` —, si bien que la recomposition du chargement suffisait et que le défaut
restait invisible. Le nouveau cas chiffre **sur l'écran du devis, après son
ouverture** : c'est le geste réel du patron, et le seul qui prenne le défaut. Il
a été vu rouge contre l'ancien code.
---

## 160. Le mode nuit : ce qui rendait deux chartes sur sept illisibles

*Payé le 22 août 2026, sur sa capture du planning en « Nuit » et six mots :*
***« Le mode nuit est illisible. Corrige ça. »***

### Le diagnostic, mesuré et non supposé

Le dépôt refuse les correctifs imaginés (`AGENTS.md`) : avant de toucher une
ligne, chaque écran a été ouvert dans un navigateur sous les deux chartes
sombres, et le contraste de **chaque texte visible** calculé contre son fond
réellement composé — pas contre le fond qu'on suppose, qui est presque toujours
transparent sur l'élément lui-même.

Trois familles de fautes en sont sorties, et **aucune ne pouvait se voir sur les
cinq chartes claires** :

| | Ce qui était écrit | Ce que ça donne en Nuit |
|---|---|---|
| **1. un crème sur l'accent** | `#faf9f5`, `#fff`, `fill="white"` sur `colors.rust` | **1,05** — un crème sur un crème |
| **2. un voile d'encre** | `rgba(28,28,26,0.42)` sur un fond noir | **1,04** — du noir sur du noir |
| **3. trois signaux figés** | `alert`, `bordeaux`, `vertPale` en clair | **1,5 / 1,76 / 2,5** |

### 1. `surPlein` — ce qu'on écrit sur un aplat

Sur les cinq chartes claires, l'accent est un vert pin sombre : un crème s'y lit
très bien, et huit endroits du dépôt l'écrivaient en clair. **Sur Nuit et Sylve,
l'accent EST l'encre** — la charte inverse les pôles, et le crème se retrouve
sur du crème.

`design-tokens.ts` expose donc `surPlein`, et **il vaut `card`**. Ce n'est pas
un raccourci : dans chacune des sept chartes, la plage et l'accent sont aux deux
bouts de l'échelle — l'un clair et l'autre sombre, ou l'inverse. Ce qui se lit
sur la plage se lit sur l'accent, retourné. Et sur « Origine », `card` vaut
`#faf9f5` **au caractère près** : les cinq claires ne bougent pas d'un pixel.

La garantie n'est pas une intuition. `test-chartes-lisibles.ts` mesure le couple
`card` / `rust` sur les sept chartes et refuse la moindre sous 4,5 — c'est ce
qui autorise l'affirmation ci-dessus, et ce qui la défendra le jour où une
huitième charte arrivera.

### 2. `voile()` — un voile qui suit la charte

Un `rgba(28,28,26,α)` dit « l'encre d'Origine, à α ». Sur une charte sombre,
l'encre n'est plus celle-là, et le voile devient une teinte pleine posée sur son
propre fond. `voile(colors.ink, 0.42)` s'écrit en `color-mix` et suit la
variable.

**Ce qui se passe si le navigateur ne connaît pas `color-mix`** — avant
iOS 16.2 : la déclaration est ignorée et la couleur retombe sur celle qu'elle
hérite, c'est-à-dire l'encre pleine. Le chiffre est alors **trop vu, jamais
invisible**. La dégradation va du bon côté, et c'est délibéré : le défaut qu'on
répare est l'effacement.

### 3. Alerte, bordeaux, vert pâle : ce qui les figeait exigeait qu'elles bougent

`design-tokens.ts` affirmait que ces trois-là n'avaient pas à suivre la charte,
et donnait sa raison : dérivées de chaque charte, deux d'entre elles finiraient
par se ressembler, et le mois cesserait de se lire d'un coup d'œil.

**Le raisonnement était juste et la conclusion fausse.** C'est précisément parce
que leur rôle est de se distinguer qu'elles doivent suivre : sur les deux
sombres, l'accent plein DEVIENT clair, si bien qu'« incomplet » (vert pâle) et
« complet » (l'accent) se lisaient tous deux comme deux blancs — **1,5 l'un
contre l'autre**, quand les cinq claires tiennent de 6,6 à 9,5.

Elles deviennent donc des jetons de charte, dérivés par `detacher()` :

- **la teinte et la saturation du patron ne bougent pas**, seule la clarté se
  décale. Mêler vers l'encre — le réflexe — tire le rouge d'alerte vers le
  gris-vert : on obtient un brun terne qui ne dit plus « attention » et qui se
  confond avec le bordeaux, c'est-à-dire exactement les deux couleurs qu'il
  fallait garder distinctes ;
- **elle ne bouge que si elle en a besoin.** Sur un fond clair le premier essai
  passe déjà le seuil, et la valeur sort intacte : `#9C3B2E`, `#6E2433`,
  `#b9c6b4`. Les cinq chartes claires sont donc identiques au caractère près,
  et une suite le fixe ;
- **le vert pâle descend là où les deux autres montent.** Sur un écran sombre,
  plus la demi-journée est pleine, plus la barre est claire — l'inverse exact
  d'un écran clair, et la même règle.

### Deux contrôles, et aucun ne remplace l'autre

| | Ce qu'il attrape | Ce qu'il ne peut pas voir |
|---|---|---|
| `test-chartes-lisibles.ts` | une charte dont un couple ne se lit plus — sept palettes, sans navigateur, dix secondes | une couleur écrite en clair DANS un écran |
| `test-mode-sombre-lisible-e2e.ts` | exactement cela : il ouvre chaque écran en Origine puis en Nuit et compare **le même texte à lui-même** | ce qui n'est pas sur son parcours |

Le second est celui qui aurait vu « Julien ＋ ». Les deux ont été confrontés à
l'état d'avant le lot et rougissent en nommant le texte fautif et ses deux
mesures — 1,17 en Nuit contre 11,15 en Origine.

**Aucun seuil n'a été inventé, et c'est la §5 bis de `CLAUDE.md`.** Sur Origine,
le bordeaux et le vert pin tiennent **1,10** l'un contre l'autre — ils se
distinguent par la teinte, rouge contre vert — et le chevron de navigation
2,6. Ce sont ses choix, relevés sur son site. Une suite qui exigerait 4,5
partout accuserait le dessin qu'il a validé et rendrait son écran impossible à
changer. La règle retenue est donc : **le sombre ne fait pas moins bien que le
clair**, et le clair se mesure au lieu de s'écrire — le plancher de `muted` est
celui de Moka (3,24), calculé, jamais recopié.

### Ce qui reste non couvert, et qu'il faut savoir

Le parcours de la suite navigateur porte six écrans — l'accueil, le planning
avec une journée ouverte, les terminés, le paysage, les réglages, l'apparence.
**Ce qui n'y est pas n'est pas éprouvé** : les états qui ne s'ouvrent qu'au
doigt (feuilles, tiroirs, listes déroulantes) et les écrans plus profonds. La
suite refuse de conclure sur moins de six textes comparables — un contrôle qui
mesure zéro ne mesure rien (`CLAUDE.md` §5) —, mais elle ne prétend pas couvrir
l'application entière.

## 161. Le message au client : un gabarit, et la phrase du document

**Sa demande du 23 août 2026**, et ses trois réponses : le réglage dans « Devis
& factures », le lien obligatoire, un seul message pour les trois documents.

### Pourquoi une pastille `[document]` et pas quatre textes

Un texte unique et littéral ne peut pas servir les trois envois : la facture
porte un numéro et une échéance, le devis se répond, le compte rendu ne se paie
pas. **Il l'a vu en images avant de choisir** (`appli/mon-message-au-client.html`,
six bulles) et a retenu la « façon 1 » : il écrit le cadre, `phraseDuDocument`
pose le milieu.

| Où | Quoi |
|---|---|
| `MESSAGE_PAR_DEFAUT` | le gabarit d'origine — celui qu'il recevait avant |
| `refusDuMessage` | **la même fonction pour l'écran ET le serveur.** Deux règles pour un refus finiraient par diverger, et il verrait un bouton allumé sur un message rejeté |
| `phraseDuDocument` | ce qui distingue les trois envois, et rien d'autre |
| `rendreMessage` | **une seule fonction pour l'aperçu et pour l'envoi.** Une copie ferait mentir l'aperçu, et c'est l'envoi que le client lit |

### `null` suit le produit, un texte lui appartient

La colonne `entreprises.message_client` est nulle tant qu'il n'a rien écrit —
et **le texte d'Atlas retapé à l'identique y redevient nul**. Sans cette règle,
un aller-retour par « Remettre celui d'Atlas » figerait l'entreprise sur la
version du jour, et une correction ultérieure ne l'atteindrait plus.

### `modeleMessage`, jamais `messageClient`

Le nom `messageClient` était **déjà pris** dans l'écran du devis parti, où il
désigne l'inverse : le mot que le CLIENT a laissé en répondant. La collision a
été trouvée par le compilateur ; deux choses opposées sous un même nom, sur le
même écran, se confondent à la première relecture.

### Ce qui ne se règle pas, et pourquoi

L'**objet** du courriel : il doit rester reconnaissable dans une boîte de
réception, et un objet vide ou trompeur envoie le message aux indésirables. Il
ne se lit d'ailleurs jamais par SMS.

### Le seul contrôle qui prouve le câblage

`test-message-au-client-e2e.ts` va de l'écran des réglages jusqu'à l'adresse
`sms:` du client. Les suites pures de `message-client` diraient vert même si
l'écran n'enregistrait rien, ou si l'écran d'envoi ignorait ce qui est
enregistré : c'est le FIL qu'il faut tenir, et lui seul le traverse.
---

## 162. Audit de sécurité, lot 1 : ce qui a été décidé, et ce qui a failli casser

**23 août 2026.** Un audit hostile complet a été mené (base montée, RLS attaquée
directement en SQL sous `atlas_app`, historique Git balayé, `npm audit`). Le
rapport nomme trente constats ; ce lot en corrige six. Ce §-ci ne les répète
pas — `CHANGELOG.md` le fait — il garde **les décisions structurantes et leur
pourquoi**, c'est-à-dire ce qu'une prochaine session refera de travers faute de
le savoir.

### Ce qui a tenu, et qu'il ne faut pas croire fragile

L'isolation entre entreprises a été attaquée, pas relue : 42 tables sur 42
portant `entreprise_id` sont en `FORCE ROW LEVEL SECURITY`, l'écriture croisée
est refusée par la base, la lecture sans contexte rend zéro ligne, et les 189
appels à `withEntreprise` passent tous `ctx`. **Aucun correctif de ce lot ne
touche à ce mécanisme**, et c'est délibéré : on ne remanie pas ce qui tient
pendant qu'on répare ce qui ne tient pas.

### La décision qui commande C1 : le compteur d'échecs vit EN BASE

La limitation de débit d'Atlas vit dans Redis, et Redis tombe — il est tombé le
12 août sur l'espace du patron. La réparation d'alors laissait tout passer quand
le magasin ne répondait plus : juste dans son intention (ne pas enfermer
l'artisan dehors), trop loin dans sa conclusion. **Il suffisait donc d'attendre
une panne de Redis pour n'avoir plus aucune limite de connexion.**

D'où la migration 0062 : le compteur d'échecs consécutifs est une table. Il ne
dépend d'aucun service annexe, il est là tant qu'Atlas sert. Trois conséquences
qu'il faut garder en tête :

| | |
|---|---|
| le blocage est **plafonné** à un quart d'heure | sans plafond, taper trois fois à côté sur l'adresse d'un artisan l'empêcherait d'entrer chez lui — on aurait remplacé une porte trop faible par une porte murée |
| il s'**oublie** au bout d'une heure sans échec | sinon, cinq fautes réparties sur trois mois temporiseraient quelqu'un pour des gestes sans rapport |
| une connexion réussie l'**efface** | celui qui retrouve son mot de passe ne doit pas rester à un doigt de la temporisation |

Et le magasin de limitation, lui, bascule désormais sur son compteur **mémoire**
quand le principal ne répond pas : dégradé (un compteur par instance), jamais
absent. Personne n'est enfermé dehors, personne n'entre en rafale.

### La règle générale que ce lot pose : ne jamais croire un en-tête du client

`x-forwarded-for` est écrit par celui qui frappe. Le lire naïvement, c'était
offrir un compteur neuf à chaque essai. La règle vaut au-delà de la connexion :
**une valeur transmise ne vaut que par le mandataire qui l'a écrite**, et sans
savoir combien de mandataires de confiance nous précèdent, aucune position dans
la liste n'est fiable. `ATLAS_PROXY_SAUTS` dit ce nombre ; à défaut, on ne tire
rien de l'en-tête. Voir `src/lib/source-visiteur.ts`.

*(Deux autres endroits lisent encore cet en-tête à titre de PREUVE — l'adresse
consignée sur l'acceptation d'un devis, sur celle des documents légaux. C'est
un autre usage : elle documente, elle ne décide de rien, et les commentaires le
disent déjà. Ne pas les « corriger » sans y penser.)*

### Les trois endroits où la correction évidente cassait quelque chose

C'est la partie la plus importante de ce §, parce que ces pièges se
re-tendront.

**1. Le mot de passe de démonstration.** L'audit demandait qu'il cesse d'être
fixe et public. Le tirer au hasard aurait cassé **136 fichiers** — les trente-
trois suites navigateur et `verifier-connexion.mjs`, c'est-à-dire la dernière
étape de la batterie de livraison. Il reste donc `demo1234` **par défaut**, et
ce défaut ne peut s'appliquer que là où effacer est sans conséquence : dès
qu'il faut forcer la garde, `ATLAS_MDP_DEMO` devient obligatoire.

**2. Les redirections CalDAV.** Interdire tout changement d'hôte aurait cassé
**tout raccordement Apple** : iCloud répond `301` depuis `caldav.icloud.com`
vers le serveur qui héberge réellement le compte (`p42-caldav.icloud.com`), et
le code suit ce renvoi exprès. La règle juste n'est pas « aucune redirection »
mais « aucune SORTIE du domaine ».

**3. Le profil banc en production.** Le critère ne peut pas être `NODE_ENV` :
le banc d'essai **est**, littéralement, « production + profil banc », puisque
`next start` impose `NODE_ENV=production` et que `.devcontainer/demarrer.sh`
pose `ATLAS_PROFIL=banc` juste à côté. Refuser là-dessus aurait éteint la
machine du patron à la seconde, pour une correction censée le protéger. Ce
qu'on cherche est une **contradiction** — le profil d'une machine d'essai posé
en même temps qu'un signe qu'aucun banc ne peut produire : un compartiment S3,
ou `ATLAS_DEPLOIEMENT=production`.

### Où une garde de rôle se pose, et où elle ne se pose JAMAIS

E3 réservait les prix de vente au propriétaire. La garde est sur **l'action et
l'écran**, jamais dans le dépôt — parce que `src/server/services/apprendre-grille.ts`
appelle `poserPrixGrille` tout seul, pendant qu'un devis s'établit, avec
l'origine `devis`. La poser un cran plus bas aurait empêché un salarié
d'établir un devis, et personne n'aurait relié cette panne à un contrôle de
rôle. **Règle générale : une garde de rôle appartient au geste de l'utilisateur,
pas à l'écriture qu'il déclenche.**

### Ce qui reste dépendant de l'infrastructure

Deux variables doivent être posées le jour du déploiement, et leur absence se
paie différemment :

| | Sans elle |
|---|---|
| `AUTH_TRUST_HOST` (ou `AUTH_URL`) | **plus personne ne se connecte** — Auth.js refuse l'hôte, l'artisan lit « une erreur » |
| `ATLAS_PROXY_SAUTS` | le seuil par visiteur redevient commun à tout le monde : il protège encore, moins finement |

La temporisation par compte, elle, ne dépend d'aucune des deux.

---

## 163. Face ID : pourquoi le fournisseur `passkey` d'Auth.js est ÉCARTÉ

**Sa demande du 23 août 2026 :** *« je veux bien que tu me codes le Face ID pour
le mot de passe, et bien entendu qu'il faut conserver le mot de passe.
L'utilisateur va commencer par créer son compte avec son mot de passe et ensuite
il décidera s'il veut ouvrir sa session avec le mot de passe ou le Face ID. »*

### Le chemin évident, et pourquoi il casserait la session de tout le monde

`next-auth` porte un fournisseur tout fait — `next-auth/providers/passkey`, il
est déjà dans `node_modules`. Le prendre paraît être le choix par défaut. Il ne
l'est pas, et ce n'est **pas une supposition** : `@auth/core/lib/utils/assert.js`
refuse le WebAuthn sans adaptateur de base de données —

    if (!adapter) return new MissingAdapter("WebAuthn requires an adapter")

Or Atlas n'a **aucun adaptateur** : la session est un **JWT**, sans table.
Brancher un adaptateur ferait naître `accounts`, `sessions`,
`verificationTokens`, changerait la façon dont chaque requête retrouve
l'utilisateur, et **remettrait en jeu tout ce qui pend au jeton** — le contexte
d'entreprise, `middleware.ts`, `session-ctx.ts`, la déconnexion partout. Pour un
bouton sur la porte.

### Ce qui est retenu : un SECOND fournisseur `Credentials`

Le fournisseur reçoit l'assertion WebAuthn, la vérifie avec
`@simplewebauthn/server`, et rend l'utilisateur. **Rien d'autre ne bouge** :
même jeton, même cookie, mêmes rappels, même `middleware`. La couche session
ignore qu'un second chemin existe.

Ce que ça coûte : la vérification de l'assertion est à notre charge — le
`challenge`, l'origine, le compteur anti-rejeu. Ce que ça évite : réécrire
l'authentification d'une application qui marche.

### Trois règles qui viennent de LUI, et qui ne se négocient pas

| | Pourquoi |
|---|---|
| **le mot de passe ne se retire jamais** | c'est ce qui fait entrer sur un téléphone neuf ; une clé d'appareil perdue avec le téléphone murerait le compte |
| **le compte se crée au mot de passe** | Face ID s'active ensuite, depuis un écran déjà connecté — sans quoi l'inscription dépendrait d'un matériel |
| **un échec de visage ne compte AUCUNE tentative ratée** | sinon un visage mal reconnu ferait temporiser son propre compte : la faute du 6 août 2026, refaite par un autre bord |

### Ce qu'il a tranché, et ce que le code en a fait

**Sa réponse du 24 août 2026 : B.** La porte d'aujourd'hui, plus une ligne
au-dessus — `src/app/login/LigneFaceId.tsx`. `name="email"`, `name="password"`
et `type="submit"` n'ont pas bougé d'un pixel : vingt scripts de capture et
`verifier-connexion.mjs` en dépendent.

| Où | Quoi |
|---|---|
| `src/lib/origine-webauthn.ts` | sous quel **domaine** une clé est posée — règle pure |
| `src/lib/cle-appareil.ts` | ce que l'artisan lit, et ce qu'il ne lit jamais |
| `src/server/cle-appareil.ts` | les deux échanges avec le téléphone, et le défi |
| `src/server/repositories/cles-appareil.ts` | la base, sans RLS et avec ce qui la remplace |
| migration `0063` | la table, et ce qu'elle ne contient pas |

**Le défi vit dans un cookie `httpOnly`, `sameSite: strict`, effacé dès qu'il a
servi.** Pas de table : une table de défis se remplirait de lignes que personne
n'utilise — il suffit de toucher le bouton puis de partir — et il faudrait la
balayer. Le cookie meurt tout seul.

**`ATLAS_RP_ID` est obligatoire en production, et son absence REFUSE.** Une clé
WebAuthn est attachée à un domaine ; le déduire de l'hôte annoncé reviendrait à
croire un en-tête que le client écrit — la faute que le lot 1 vient de fermer sur
`x-forwarded-for`. Le dégât resterait borné (le navigateur refuserait de créer
une clé pour un domaine qui n'est pas celui de la page), mais **le résultat pour
l'artisan serait une porte muette**, et personne ne saurait pourquoi.

**Un défaut trouvé par la suite, pas par une relecture** : `domaineDe` découpait
sur le premier `:` avant de valider. Sur `https://atlas.fr`, le morceau restant
valait `https` — un mot fait de lettres, donc accepté. Atlas aurait enregistré
des clés sous le domaine « https », et aucune ne se serait jamais rouverte.
**Découper avant de valider, c'est valider autre chose que ce qu'on a reçu.**

### La planche d'abord — `appli/face-id.html` (planche 94)

`CLAUDE.md` §3 bis : c'est un **geste** sur la porte, il se dessine avant de
toucher à `src/`. Deux places sont proposées, **A** le visage d'abord, **B**
l'écran d'aujourd'hui plus une ligne ; tout le reste est identique dans les deux,
et c'est la seule question posée.

**La fenêtre Face ID de la planche est un DESSIN, et elle l'écrit.** Aucune page
web n'affiche celle d'iOS — et surtout, appeler `navigator.credentials` depuis
une maquette **poserait une vraie clé sur son téléphone**, pour un domaine qui
n'est pas celui d'Atlas. On ne pose pas de clé chez lui pour une image.

`appli/tests/essai-face-id.mjs` la parcourt en entier avant publication, et
**barre le déploiement** : elle a été vue rouge contre une porte A privée de son
chemin vers le mot de passe, et contre un échec de visage qui accusait le mot de
passe.

---

## 164. L'allure de ses documents : une typographie, deux couleurs, un logo

*Sa demande du 23 août 2026 : « il faudrait que l'utilisateur puisse avoir un
endroit dédié à la modification de son devis. S'il veut rajouter son logo,
changer la typographie, changer le fond de page. » Puis, devant la planche
`appli/allure-de-mes-devis.html` : **B** (dans « Devis & factures »), « juste
pour devis facture », « fais-en une dizaine », et « le fond teinté fais-le
modifiable […] les réglages actuels doivent être par défaut ».*

### Le défaut est le document d'avant, et c'est le contrôle le plus important

Un réglage neuf ne doit changer l'allure d'aucun devis tant qu'il n'y a pas
touché. C'est sa règle, et elle est plus fragile qu'elle n'en a l'air : elle
s'est cassée **deux fois** dans la même journée.

| Ce qui l'a cassée | Ce qui l'a rattrapée |
|---|---|
| `ALLURE_PAR_DEFAUT.fond` écrit « #ece9e1 » — une teinte lue sur la maquette, que ses devis n'ont jamais portée (c'est `#faf9f5`) | `test-allure-pdf.ts`, en comparant deux devis **octet pour octet** |
| les teintes calculées ne retombent pas d'elles-mêmes sur les six constantes d'origine : ouvrir le réglage et le refermer suffisait à faire dériver l'encre douce, le trait clair et la mention légale | le même contrôle |

D'où deux règles qui tiennent l'invariant plutôt que d'espérer qu'il coïncide :

1. `ALLURE_PAR_DEFAUT` **reprend `couleursDocument`**, il ne le retape pas ;
2. `teintesDe` a une **porte** : allure absente **ou égale au défaut** → on rend
   exactement la palette d'avant, sans rien calculer.

Et en base, le défaut **s'écrit vide** : trois colonnes `NULL`, jamais la
couleur du jour en clair. Sans quoi ses documents cesseraient de suivre la
charte le jour où elle bougerait, et personne ne saurait pourquoi.

### Le devis et la facture SEULEMENT

La feuille de chantier sort de la **même fabrique** que le devis, par
`sansChiffrage`. Sans filtre, elle aurait pris la marque et les couleurs
réservées à ce que le client garde. D'où, dans `devis-pdf.ts` :

```ts
allure: sansPrix ? null : options.allure,
logo:   sansPrix ? null : options.logo,
```

Ce n'est pas une précaution : c'est la règle, et `test-allure-pdf.ts` la tient.

### L'encre suit le fond, elle ne se choisit pas

Il peut mettre **n'importe quelle** couleur de fond, c'est sa décision. Lui
offrir un second réglage pour l'encre ne ferait que déplacer le piège d'un
cran : un fond nuit avec une encre noire donne un devis illisible, et il ne
s'en apercevrait qu'à l'impression, chez son client. `encreSurFond` tranche
sur la luminosité perçue, et la même fonction sert l'écran et le PDF.

### Les polices sont RÉDUITES dans le dépôt, et embarquées ENTIÈRES

C'est l'inverse de ce qu'on écrit d'ordinaire, et ça a été payé.

| | Ce qui se passe |
|---|---|
| `embedFont(…, { subset: true })` | **perd des caractères en silence** : un devis complet en EB Garamond ne sortait plus que « e e e Roc e e ». Pas d'erreur, pas de journal |
| `embedFont(…, { subset: false })` sur les fichiers d'origine | Archivo Narrow fait **tomber** `pdf-lib` (`RangeError` dans le lecteur de glyphes) |

Ni l'un ni l'autre n'est sûr avec le fontkit que `pdf-lib` embarque. Les
dix-huit fichiers ont donc été réduits **une fois pour toutes**, hors ligne, au
latin dont ses documents ont besoin — 3,9 Mo → 570 ko —, et le PDF les prend
tels quels. Un devis habillé pèse 40 à 60 ko.

La commande est dans `src/server/pdf/polices/LISEZ-MOI.md`.
`scripts/test-polices-documents.ts` monte la garde : chaque caractère qu'un
devis sait écrire doit avoir un dessin, la police doit s'embarquer sans tomber,
et aucun fichier non réduit ne doit être reposé là.

### L'écran servait du Georgia en annonçant « Playfair Display »

Le navigateur ne connaît aucune des neuf familles : les quatre serif
retombaient toutes sur Georgia, les cinq linéales sur la police de l'appareil.
Il aurait choisi en regardant autre chose, et découvert la vraie sur le devis
parti chez son client.

`/api/polices/[fichier]` sert donc **exactement les fichiers que le PDF
embarque** — pas une copie dans `public/`, qui divergerait. Le nom demandé
n'est jamais concaténé au chemin : il est cherché dans `TYPOGRAPHIES`, tout le
reste repart en 404.

**Ce défaut ne s'est vu qu'à la capture.** C'est la sixième fois dans ce dépôt
(`CLAUDE.md` §5). Le contrôle qui le tient désormais mesure la **même phrase**
dans Archivo Narrow et Merriweather : si rien n'est chargé, les deux tombent
sur la même police et la même largeur.

### Le logo : au-dessus du nom, jamais à côté

Les références du devis — numéro, date, validité — occupent le quart droit de
la même bande. Un logo posé à gauche du nom viendrait les toucher dès qu'il est
un peu large, et un numéro de devis illisible coûte plus cher qu'un en-tête
d'un centimètre plus haut. Hauteur fixe (34 pt), largeur libre jusqu'à 150 pt,
proportions gardées : un logo en bandeau et un logo carré n'ont rien à voir.

Le nom **descend** sous l'image ; les références, elles, **ne bougent pas** —
elles ont leur propre colonne.

Et rien de tout cela n'empêche un devis de sortir : un fichier illisible, un
compartiment vidé, une clef écrite par une autre instance donnent un document
**sans logo**, journalisé. Lever priverait son client du devis pour une
question d'apparence.

### Ce que chaque contrôle tient, et pourquoi il en faut quatre

| Suite | Ce qu'elle voit que les autres ne voient pas |
|---|---|
| `test-allure-documents.ts` | la règle seule — la lisibilité de l'encre sur seize fonds, les proportions du logo |
| `test-polices-documents.ts` | qu'une police s'imprime vraiment — le défaut muet |
| `test-allure-pdf.ts` | le document : le devis d'avant inchangé, la feuille non habillée, le logo qui ne mange pas les références |
| `test-allure-documents-db.ts` | les colonnes : le défaut écrit vide, et l'isolation entre entreprises |
| `test-allure-de-mes-devis-e2e.ts` | **le fil** — il choisit, ça s'enregistre, ça survit au rechargement, et l'écran ne ment pas |

Chacune resterait verte si l'écran n'enregistrait rien. C'est la dernière qui
compte, et elle ne remplace aucune des autres.

---

## 165. Audit de sécurité, lot 2 : les fichiers déposés, et le piège de la correction

**24 août 2026.** Six constats de l'audit portaient sur ce qu'un artisan dépose
— photos, tickets, croquis, listes de prix. Ce §-ci garde **ce qui se serait
refait de travers**, pas la liste des corrections (`CHANGELOG.md` la porte).

### Deux constats du brief n'existaient pas comme décrits

**La bombe zip ne venait pas des entrées multiples.** `lireEntreeZip` parcourt
le répertoire central sans rien décompresser et n'inflate **que** l'entrée dont
le nom correspond. Cent entrées piégées ne coûtent rien. Le vrai vecteur tenait
en une seule : `deflate` dépasse mille pour un sur du texte répété, donc les
5 Mo qu'accepte l'écran rendaient plusieurs gigaoctets. Une option —
`maxOutputLength` — et c'est fermé.

**Le plafond d'octets existait déjà**, et le réécrire aurait été du risque
contre rien : `bodySizeLimit` dans `next.config.ts`, et `fichier.size` lu avant
tout `arrayBuffer()`. Next.js met le corps en mémoire avant de rendre la main :
il n'y a **pas de flux à interrompre** à notre niveau.

### `nosniff` ne ferme pas ce qu'on croit

La route des fichiers renvoyait le type MIME **déclaré par le navigateur** au
dépôt. `image/svg+xml` faisait donc servir un document SVG depuis notre propre
domaine — et un SVG porte du script.

**`X-Content-Type-Options: nosniff` était déjà posé sur toutes les routes, et
n'y changeait rien** : il interdit de *deviner* un type, pas d'en *annoncer*
un. La politique de sécurité du contenu ne rattrapait pas davantage — elle
autorise l'inline pour les scripts d'hydratation de Next.js.

Le type se déduit désormais de l'extension de la clé, que **le serveur** a
posée (`src/lib/type-de-fichier.ts`). Une extension inconnue rend
`application/octet-stream` : le navigateur propose d'enregistrer plutôt que
d'ouvrir, ce qui est le défaut sûr.

### LE PIÈGE DE CE LOT : la correction qui aggrave

**Resserrer la liste des types d'image côté serveur, seul, refuse les photos
d'iPhone.** Un iPhone photographie en HEIC ; s'il transcode en JPEG à l'envoi,
c'est **parce que l'attribut `accept` du champ le lui demande**. Trois écrans
portaient `accept="image/*"` — donc aucune raison de transcoder.

D'où **deux listes, et elles ne se confondent pas** :

| | Ce qu'elle répond |
|---|---|
| `TYPES_IMAGE_ACCEPTES` | « sais-je retirer les métadonnées de ce format ? » |
| `TYPES_PHOTO_ACCEPTES` | « ai-je le droit de le ranger ? » — plus large, HEIC compris |
| `ACCEPT_PHOTOS` | ce que l'écran propose — **sans le HEIC**, pour qu'iOS transcode |

**Et la troisième ligne est contre-intuitive au point qu'un contrôle la
garde** : ajouter `image/heic` à l'`accept` ferait *cesser* le transcodage, et
nous recevrions des HEIC bruts — que le nettoyage ne sait pas lire, donc rangés
avec leurs coordonnées GPS. La correction qu'on croirait bonne rendrait la
situation pire qu'avant.

### Un échec de nettoyage ne refuse JAMAIS la photo

`retirerMetadonnees` rend `{ nettoye: false }` et les octets d'origine sur un
format qu'il ne sait pas lire. L'appelant range, et **journalise** — il ne lève
pas. C'est un arbitrage, et il se dit : perdre le cliché d'un artisan qui vient
de le prendre, sur un chantier, coûte plus cher que garder des métadonnées sur
une photo de haie. *Un outil qui refuse la photo qu'on vient de prendre est pire
que le risque qu'il évite.*

### Ce que le brief n'avait pas vu

Le **croquis d'arrosage** envoie la photo à un fournisseur d'IA : il bornait la
taille et rien d'autre — ni type, ni cadence. Il porte désormais les deux, avec
le seuil du diagnostic végétal, parce que ce seuil-là ne protège pas un service :
**il borne une facture**.

---

## 166. Le moins de VANNES, pas le moins d'arroseurs

**Sa colère du 23 août 2026 :** *« cinq réseaux pour ça ??????? »* — devant un
plan de 12 × 12 et 8 × 8, soit 208 m² de pelouse.

### Le critère était à l'envers

`modelePour` prenait **la plus grande buse qui pave**. C'est le moins
d'arroseurs possible — et c'est le mauvais objectif, parce qu'une grosse buse
boit. Sur son carré de 12 m :

| | Arroseurs | Débit | Vannes |
|---|---|---|---|
| 5000 Plus buse 3,0 (l'ancien choix) | 4 | 2,79 m³/h | **3** |
| 3504 buse 0,75 (sa pose du 21 août) | 9 | 1,24 m³/h | **1** |

**Neuf arroseurs se posent une fois. Une vanne coûte une électrovanne, une
station de programmateur, sa tranchée et son créneau d'arrosage** — et elle
revient chaque été dans la durée totale d'arrosage.

Le critère est donc : **le moins de vannes d'abord, le moins d'arroseurs
ensuite**. L'ancien critère n'est pas jeté, il devient le départage.

### Comment, sans écrire une seconde façon de poser

`poser()` s'appelle **lui-même** avec une buse imposée, pour chaque buse qui
pave. Recalculer un pavage dans `modelePour` aurait fabriqué une seconde
implémentation du quinconce et du débit par angle — exactement ce que le §3
interdit. La récursion est de profondeur un : l'appel qui porte une buse imposée
ne relance pas la boucle.

`limiteParVoie()` est sortie de `decouper()` pour être partagée : choisir une
buse pour un plafond que le découpage n'applique pas serait le pire des deux
mondes.

### Le tour de vis de trop, qui cachait la bonne réponse

**Et c'est le vrai fond du défaut.** Le quinconce resserrait les arroseurs
**tant que le damier ne couvrait pas**, sans plancher. Sur le carré de 12 m en
buse 0,75, il finissait à 4 m d'écart pour une portée de 5,14 — donc une pose
marquée « trop serrée », donc écartée au moment de comparer les buses. La seule
qui tenait sur une vanne était disqualifiée par un resserrement qui enfreignait
déjà sa règle du 17 août : *« jamais moins que la portée »*.

Le damier ne se resserre plus sous la portée. Quand il ne couvre pas à cet
écart-là, on garde la **grille alignée**, qui couvre par construction — et c'est
elle qui rend les neuf arroseurs qu'il avait dessinés.

### Deux valeurs de référence ont bougé, sciemment

La perte de charge du réseau passe de 0,436 à 0,386 bar : des buses plus fines
font des lignes qui portent moins de débit, donc qui perdent moins. Ce n'est pas
la formule qui a changé, c'est le plan qu'on lui donne — et la ligne de la suite
porte la raison à côté d'elle (`CLAUDE.md` §4 ter).

Un contrôle figeait aussi *« deux vannes, nommées Devant et Derrière »* : il
éprouve désormais la RÈGLE — une vanne ne s'annonce jamais sous le nom d'une
zone qu'elle n'arrose pas — et non la mise en page, qui dépend du choix de buse.

---

## 167. Discuter le plan : Atlas ne dessine pas, il pose un paramètre

**Sa demande du 21 août 2026 :** *« j'ai besoin que si l'utilisateur a besoin de
te demander de faire une modification, qu'il puisse le faire — une petite
interface pour qu'il puisse discuter avec toi »*. Codée le 23 au soir, sur sa
maquette validée (`appli/arrosage-discuter.html`).

### La phrase qui commande toute l'architecture

Elle est de la maquette qu'il a validée : **« Atlas ne dessine pas le plan : il
lit votre demande, pose un paramètre du calcul, et c'est le calcul qui refait le
schéma et les pièces. »**

Ce qui sort d'un message n'est donc jamais un tracé, jamais un métré, jamais une
liste de pièces — c'est **une consigne** prise dans une liste fermée :

| Consigne | Ce qu'elle change |
|---|---|
| `marque` | Rain Bird, Toro, Hunter |
| `corps` | une référence de corps du catalogue |
| `materiel` | turbine, tuyère ou « au mieux », sur UNE zone |
| `buse` | une référence de buse du catalogue, sur UNE zone |
| `sonde` | la sonde de pluie |

**Pourquoi cette borne tient tout.** Un plan retouché à la main ne se recalcule
plus : la fois d'après, le tracé, les métrés et les pièces ne viennent plus de
la même source, et deux d'entre eux finissent par se contredire
(`CLAUDE.md` §3). En passant par les paramètres, tout ce qui s'affiche reste issu
du même calcul — y compris ce que sa demande casse ailleurs, qu'on peut alors
lui DIRE.

### Ses deux bornes, appliquées à la lettre

**« La discussion ne doit JAMAIS créer un plan avec des réseaux. »** Le fil ne
s'affiche qu'AVEC un plan, donc à partir d'un croquis déjà complet. Sans plan, ni
fil ni champ — un « Écrire à Atlas… » posé là inviterait à demander un plan par
la conversation. C'est l'ABSENCE qui est éprouvée, parce que c'est elle la règle.

**« Il ne faut pas mettre les phrases pré-écrites. »** La maquette en montrait
trois, et le disait — *« trois demandes déjà écrites, pour montrer »*. L'écran
n'en porte aucune : des suggestions apprennent à ne demander que ce qui est
proposé.

**Et la nourrice ne se discute pas** (`CLAUDE.md` §4 bis). Elle voyage dans les
paramètres parce que le DESSIN en a besoin à chaque recalcul, pas parce qu'elle
serait réglable. Pour la déplacer : corriger le croquis et le renvoyer — et
l'écran le dit sous le champ, pour qu'il ne l'essaie pas et n'y voie une panne.

### Rien n'est enregistré, et les paramètres voyagent

Les paramètres partent vers l'écran avec le plan et reviennent avec chaque
message. **Aucune persistance** : un plan d'arrosage se refait à chaque client,
comme un devis. Le jour où il vivra en base, ce sera une décision, pas un effet
de bord.

Les zones y portent un **identifiant stable**, parce que les consignes les
désignent par lui (« passe la zone 2 en tuyères »). Le laisser au calcul le
ferait dépendre de l'ordre de lecture, et un message d'hier viserait demain une
autre pelouse.

### Les chiffres ne viennent jamais du modèle

On lui donne l'état du plan en clair — débit disponible, plafond d'une voie,
débit de chaque réseau, buses du catalogue — **pour qu'il n'ait pas à les
inventer**. C'est la leçon du 21 août : laissé libre, il avait écrit « 5004 buse
3.0, portée 6 m », qui n'existe pas, et tout le maillage en dépendait.

**Une référence hors catalogue est refusée, jamais rapprochée de la plus
proche.** Mais le refus ne jette pas sa réponse : ce qu'il a expliqué reste
utile, seule la modification tombe — et il lit pourquoi, dans la réponse
elle-même.

### Ce qui n'est pas éprouvé ici

La règle pure l'est, sans clé et sans réseau : la liste fermée
(`test-consignes-arrosage.ts`) et la lecture de ce que le modèle rend
(`test-discussion-plan.ts`), avec ses travers observés — référence inventée,
texte vide, JSON noyé dans de la prose, consigne hors liste.

**Le parcours entier ne l'est pas** : le fil n'apparaît qu'avec un plan, donc
après une lecture de croquis, donc avec une clé de vision que cet environnement
n'a pas (`AGENTS.md`). Premier essai à faire sur son banc.


## 168. La fiche en cours se supprime — et l'endroit où elle se compose cesse de disparaître

**Ses deux phrases du 24 août 2026**, sur une capture de « Fiche de chantier » :
*« Je ne peux pas supprimer les fiches en cours. Il faut pouvoir les
supprimer. »* Et : *« Avant, il y avait un endroit où je pouvais créer ma fiche
sur mesure. Ajouter des catégories, en enlever, en créer. Aujourd'hui, cet
endroit a disparu. »*

Deux plaintes, deux défauts sans rapport apparent — et pourtant le même
mécanisme : **un écran qui retire ce dont on se sert au moment où l'on commence
à s'en servir.**

### 1. Rien n'effaçait un brouillon

Une fiche s'ouvre à chaque geste, et rien ne la refermait. Il en fait quatre ou
cinq par jour ; une ouverte sur le mauvais jour, une autre pour un jardin qu'il
n'a finalement pas fait, et l'écran qu'il ouvre chaque matin devient une pile.
Sur sa capture, deux brouillons attendaient déjà.

`supprimerPassage` retire la fiche et ses lignes. Trois choses en font le tour :

| | |
|---|---|
| **le geste** | celui du 10 août — la ligne part, « Annuler » reste, rien n'est écrit tant que le tiroir est ouvert (`useRetraits`) |
| **le refus** | un rapport PARTI ne se supprime pas |
| **les lignes** | effacées explicitement, sous contexte d'entreprise |

**Le refus est le cœur, pas une précaution.** Le lien d'un rapport envoyé vit
chez le client, dans un SMS qu'il a peut-être gardé : effacer la fiche
changerait cette adresse en page morte, sans que personne ne l'ait voulu ni ne
puisse le savoir. C'est l'invariant du 16 août — un rapport parti ne change plus
— poussé jusqu'à sa conséquence : il ne disparaît pas non plus. L'écran ne pose
donc pas de croix sur la section « Rapports envoyés », et une suite navigateur
le tient : sans elle, la croix se poserait sur les deux au premier remaniement.

**Les lignes ne s'en remettent pas à la cascade** de la migration 0055. Elle
tient, mais elle s'exécute hors de la politique d'isolation : lui confier la
suppression reviendrait à retirer la RLS du chemin le plus destructeur de cette
table. Deux `delete` sous contexte coûtent une ligne de code.

### 2. L'endroit n'avait pas disparu : il ne s'affichait plus

Il existe, et il n'a jamais bougé — Réglages → Fiche d'entretien. Mais le lien
qui y menait depuis « Fiche de chantier » vivait dans l'encart de la fiche VIDE,
celui qui s'efface dès la première prestation posée.

**L'écran retirait donc sa propre porte à l'instant précis où le patron
commençait à s'en servir.** Il l'a vue une fois, le premier jour, puis plus
jamais — et sa conclusion était la bonne, vue de sa place : l'endroit avait
disparu.

Une ligne permanente le rouvre, **en bas de la liste** : ce qu'il vient faire
ici neuf fois sur dix, c'est ouvrir une fiche, pas la recomposer. Elle ne paraît
que pour le propriétaire — la rubrique lui est réservée, et un lien qui n'ouvre
qu'un « Rubrique réservée » est pire qu'aucun lien. Et le contrôle vise
l'ADRESSE, jamais le libellé (`CLAUDE.md` §5 bis).

### 3. Les catégories : deux verbes sur trois ne tenaient pas

Sa phrase décrit l'écran par ce qu'il y fait — *« ajouter des catégories, en
enlever, en créer »*. Vérification faite, l'écran n'en tenait qu'un :

| Son mot | Ce que l'écran faisait |
|---|---|
| ajouter une prestation | ✓ |
| **créer** une catégorie | rangeait la ligne dans « Divers », à lui de renommer le titre au-dessus |
| **enlever** une catégorie | rien — six retraits au pouce, et la famille tombait avec sa dernière ligne |

Le nom se saisit désormais **avec** sa première prestation, et un bouton retire
la famille entière par le même tiroir que les lignes. Une famille n'étant pas
une ligne en base mais une colonne de texte (§ sur `renommerFamille`), la
retirer c'est supprimer ses prestations — et `lower()` compare les noms, sinon
une casse différente couperait la famille en deux sans un mot.

### Ce que les captures ont attrapé, et qu'aucune suite ne voyait

Trois défauts, tous sortis d'une image — la sixième fois dans ce dépôt
(`CLAUDE.md` §5) :

1. **« EN COURS » restait seul**, sans une ligne dessous, pendant les six
   secondes du délai d'annulation. Un écran qui paraît cassé à l'instant précis
   où il vient de toucher une croix, et où il se demande s'il a effacé plus que
   prévu. Le titre part maintenant avec sa dernière ligne ; le tiroir reste,
   c'est lui qui raconte.
2. **La croix d'une FAMILLE était le jumeau exact de celle d'une ligne** — même
   signe, même taille, même colonne. Rien à l'œil ne disait que l'une retire une
   prestation et l'autre en emporte six. Elle s'écrit désormais : « Retirer la
   famille ».
3. **La porte du modèle butait sur la barre d'onglets** — 60 px, contre 116 px
   avec la marge des réglages. Mesuré, pas supposé : elle n'était pas cachée, et
   la dire cachée aurait été annoncer une panne corrigée là où seul le confort
   l'était.

### 4. Le rapport figé : deux paragraphes gris en moins, un bouton qui dit ce qu'il fait

**Ses mots, le même soir, sur une capture de l'écran figé** : *« Ce rapport est
figé en gris supprime, et tout ce qui est en gris en dessous supprime également
! »* Puis : *« Ouvrir le sms tout prêt corrigé par envoyer par sms si on a
sélectionné sms, sinon envoyer par email si on a sélectionné email. »*

**Ce qui est parti :** la phrase « Ce rapport est figé. Il ne se modifie plus —
c'est ce qui en fait une preuve de passage », et l'adresse du rapport recopiée
en toutes lettres sous le bouton. Aucune des deux n'apprenait quoi que ce soit :
l'état figé se lit déjà — les cases ne se cochent plus, la molette ne tourne
plus — et l'adresse est DANS le message que le bouton compose.

**L'adresse en clair survit à un seul endroit**, et il faut le savoir avant de
la retirer tout à fait : le client qui n'a ni téléphone ni e-mail. Là, elle
n'est plus un doublon du bouton — elle est le seul moyen de transmettre le
rapport.

**Le canal était DÉDUIT, il est maintenant CHOISI.** L'écran figé lisait « un
téléphone existe, donc ce sera un SMS ». Chez un client qui a les deux, choisir
l'e-mail sous son nom ne changeait donc rien : le bouton annonçait un canal que
personne n'avait demandé. Il retombe encore sur ce qui existe — mais seulement
quand le canal choisi n'a plus de coordonnée, une fiche client pouvant changer
entre le jour où le rapport a été figé et celui où on le rouvre.

**Et un contrôle a été ADAPTÉ, pas contourné.** Une suite navigateur exigeait le
mot « figé » à l'écran — celui qu'il vient de faire retirer. Écrire une suite
qui réclame ce qu'il a fait enlever rend son écran impossible à changer
(`CLAUDE.md` §5 bis) : elle vise désormais ce qui restera vrai quel que soit le
mot — plus de bouton d'enregistrement, un et un seul moyen de transmettre, et
c'est celui qu'il a choisi.

### Ce qui n'a PAS été fait, et pourquoi

Aucune maquette n'a précédé ces gestes, et c'est délibéré (`CLAUDE.md` §3 bis) :
aucun n'est neuf. Le retrait réversible avec son tiroir est le SIEN, celui du
10 août, déjà à l'œuvre à huit endroits ; lui en donner une neuvième variante
sur l'écran qu'il ouvre le plus lui ferait apprendre deux fois la même chose.

---

## 169. Le lien qui part chez un client ne peut pas être une adresse de sa machine

**Sa capture du 24 août 2026 : « Connexion au serveur impossible. »** Son client
ouvre le SMS de sa fiche de chantier et tombe sur une page morte, sur
`localhost`.

Le rapport existait, son jeton était bon, la page fonctionnait. **C'est
l'adresse qui désignait le téléphone du client lui-même.**

### Pourquoi cela n'arrivait que par moments

L'adresse d'un lien était celle du navigateur qui l'avait fabriqué :

| Comment il ouvre Atlas | Ce que le client reçoit |
|---|---|
| par l'adresse publique de son espace | un lien qui s'ouvre |
| par la redirection de port de son éditeur — `localhost:3000` | une page morte |

Rien à l'écran ne distinguait les deux, et le message partait pareil. Il a donc
envoyé des rapports valides à des clients qui n'ont rien pu lire — sans qu'aucun
des deux ne sache pourquoi.

### Le dépôt connaissait déjà ce piège — ailleurs

Le 9 août 2026, le retour d'autorisation Google renvoyait l'artisan vers
`localhost:3000` : même cause, même page morte. C'est ce jour-là qu'est né
`adressePublique`. Ce qui manquait, c'est qu'**aucune règle ne DISAIT qu'une
adresse pareille ne se donne pas à quelqu'un d'autre**.

### Trois choses, et la troisième est celle qui protège

1. **`originePublique`** remplace quatre copies. Les mêmes quatre lignes
   vivaient dans le devis parti, le devis complet, la facture et la fiche de
   chantier — chacune avec un commentaire disant qu'elle faisait comme la
   voisine. Quatre endroits à corriger le jour où la règle change, et ce jour
   est arrivé (`CLAUDE.md` §3).
2. **`ATLAS_URL_PUBLIQUE` commande quand elle est posée.** C'est le seul moyen
   qu'a un déploiement derrière un mandataire muet de dire son adresse. Elle
   n'existait pas ; elle est documentée dans `.env.example`.
3. **`ouvrableParLeClient` refuse de composer le message**, et l'écran le dit.
   Parce que le point 2 ne suffit pas : sur son espace de travail, aucune
   variable ne peut deviner par quelle porte il est entré.

**La plus traître n'est pas `localhost`, c'est `192.168.x.x`** — elle s'ouvre au
bureau, donc l'essai réussit, et elle échoue chez tout le monde. Les plages
privées, les adresses de lien local et `.local` sont donc refusées avec elle.

### Le refus vient APRÈS le figeage, et c'est délibéré

Le rapport est enregistré avant que le message se compose. Refuser plus tôt
l'obligerait à recocher toute sa fiche pour une raison qui n'a rien à voir avec
son chantier. **Ce qu'on lui épargne, c'est le message mort ; ce qu'on lui
garde, c'est son travail** — et la phrase le dit, sans quoi il croirait avoir
tout perdu.

Le même refus est posé **sur l'écran figé**, pas seulement sur le premier envoi :
un rapport se rouvre des jours plus tard, depuis l'adresse du moment.

### Ce que les suites peuvent, et ce qu'elles ne peuvent pas

Elles tournent sur `http://localhost:3000` : sans rien faire, chaque écran
d'envoi rendrait le refus et une dizaine de suites rougiraient en accusant
l'envoi. Le serveur des suites **déclare donc une adresse publique**, comme le
ferait un vrai déploiement.

**Conséquence à dire plutôt qu'à taire :** le refus lui-même ne se joue pas au
navigateur — un seul serveur tourne, avec une seule adresse.
`test-adresse-du-client.ts` l'éprouve dans les deux sens, sans navigateur. Et le
garde-fou a bien été vu ROUGE : la suite de la fiche de chantier, rejouée sans
l'adresse déclarée, tombe sur « n'a ouvert aucune messagerie » et « n'offre
aucun moyen de le transmettre » — exactement là où son client est tombé.

### Les QUATRE chemins, et non le seul qu'il a signalé

Il a signalé la fiche de chantier ; le devis et la facture partaient par le même
mauvais chemin. Le refus est donc posé partout où un lien s'en va chez un
client :

| Le geste | Où le refus se lit |
|---|---|
| fiche de chantier — envoyer, ou rouvrir un rapport figé | sous le bouton |
| devis parti — « envoyer », « relancer » | à la place du bouton |
| facture — le message tout prêt | à la place du bouton |
| facture — l'envoi qui ouvre la messagerie dans la foulée | en rouge sur l'écran |
| devis complet — l'envoi qui ouvre la messagerie | voir ci-dessous |

**Le quatrième cas est le pire, et c'est celui qu'on ne voit pas venir :** la
messagerie s'ouvre TOUTE PRÊTE, avec l'adresse d'une machine dedans, et il
appuie sur « Envoyer » sans avoir la moindre raison de se méfier. Ne rien ouvrir
est déjà mieux ; le dire est mieux encore.

**D'où un refus qui REMONTE au lieu d'être avalé.** `ouvrirLaMessagerie` rend
désormais un verdict : c'est l'appelant qui sait où le patron doit atterrir.
L'envoi depuis le devis complet ramenait à l'accueil — qui ne dirait rien — et
mène maintenant à l'écran du devis parti, celui qui porte la phrase. Le devis,
lui, est bien envoyé : on ne défait rien, on barre le message.

**Le même arbitrage vaut pour la facture, et il compte double** : elle est déjà
ARRÊTÉE quand le refus tombe. Son émission a engagé sa comptabilité — on ne la
défait pas pour une histoire d'adresse.

**Et la phrase se termine par un verbe qui ne s'accorde pas** — « votre facture
vous attend ici ». « Est enregistré » aurait obligé à accorder par document, et
« votre facture est enregistré » est exactement le genre de faute que le patron
relève.

### Ce qui n'est PAS réglé ici, et qui lui appartient

Il a écrit : *« Il est sensé recevoir la fiche par pdf ! »* Ce n'est pas ce que
le dépôt fait, et ce n'est pas un oubli — `docs/QUESTIONS.md` §3 porte
l'arbitrage du 3 août 2026 : *« Dans Atlas, la livraison est la page du
client »*, et *« joindre le PDF serait désormais nuisible »*. Le tableau de la
même question dit pourquoi les deux ne se cumulent pas : un lien `sms:` ou
`mailto:` remplit le destinataire mais **ne peut porter aucune pièce jointe** ;
le partage natif joint le fichier mais n'a pas de champ destinataire.

Le destinataire prérempli est ce qu'il a demandé le 3 août. Revenir au PDF, ce
serait le rendre. **La question lui est posée, elle n'est pas tranchée ici.**


---

## 164. Les images d'utilisateur : une seule porte, qui REFUSE

**Ce paragraphe existe parce que la règle a été retournée le 24 août 2026**, et
qu'un retournement non écrit se re-retourne.

### La propriété tenue

> Une image d'utilisateur n'est **jamais** rangée ni envoyée à un fournisseur
> d'IA tant qu'Atlas n'en détient pas une version dont il peut garantir le
> nettoyage.

Autrement dit : **si le nettoyage échoue, on refuse**. `src/server/photo-entrante.ts`
est la seule porte, et les cinq chemins la traversent — photos de chantier,
tickets de TVA, diagnostic végétal, croquis d'arrosage, logo d'entreprise.

### Ce que cela a remplacé, et pourquoi

L'ancienne règle — *« un échec de nettoyage ne refuse JAMAIS la photo »* — venait
d'un principe juste du patron. Elle rangeait pourtant des coordonnées GPS : un
fichier qu'on ne sait pas lire est un fichier dont on ne retire rien.

**Et sa protection était un attribut d'écran.** On comptait sur `accept` pour
faire transcoder iOS en JPEG. C'est vrai d'un iPhone honnête et ne vaut rien
contre qui poste au serveur : `accept` est un confort, pas une frontière. **Ne
jamais rebâtir une garantie de sécurité sur un attribut HTML.**

### Trois règles qui en découlent

1. **La liste serveur ne contient QUE ce qu'on sait nettoyer.** C'est sa seule
   définition tenable. Y remettre le HEIC rouvrirait le trou.
2. **Aucun écran ne lit les octets bruts d'une image.** Un `.arrayBuffer()` dans
   un chemin d'image est un contournement de la porte — un contrôle le refuse.
3. **Un refus donne le geste**, pas seulement le verdict. Le format d'une photo
   est choisi par le téléphone, pas par l'artisan : lui dire « format non pris en
   charge » le laisse sans rien à faire.

---

## 165. Le corps d'une requête : la borne vit DANS la lecture

**`content-length` ne prouve rien** — il est écrit par le client. Le sous-déclarer,
ou employer `Transfer-Encoding: chunked` qui n'en porte aucun, contourne tout
contrôle posé sur lui seul.

### Ce que la pile fait vraiment, constaté le 24 août 2026

| | |
|---|---|
| `serverActions.bodySizeLimit` | ne couvre **que les actions serveur** (documentation de Next, mot pour mot) |
| Route Handlers | **aucune limite native**, et aucune configuration ne l'ajoute |
| `request.formData()` | décode le multipart dans `undici`, **après** avoir consommé le corps |

### La forme retenue

`src/server/corps-borne.ts` fait traverser `request.body` par un
`TransformStream` qui compte et **casse** le flux au-delà de la borne. Le parseur
ne voit jamais plus que la limite.

**Cassé, pas tronqué :** tronquer rendrait un multipart amputé, que le parseur
lirait comme un fichier valide mais incomplet — un fichier corrompu rangé en
silence.

**Pas de double copie :** on ne rassemble pas le corps pour le mesurer puis le
re-parser. On borne en passant.

**Ce que cela ne couvre pas :** ce que Node met en tampon avant de rendre la main
à Next dépend de l'hébergeur. La garantie commence à l'objet `Request` ; une
limite au mandataire reste souhaitable et ne remplace pas celle-ci.

---

## 170. Toucher un jour, c'est le proposer — le geste en deux temps est retiré

**Sa demande du 25 août 2026**, capture à l'appui, sur l'écran d'envoi au
client : *« je dois pouvoir sélectionner les jours juste en les touchant, pas
besoin de cliquer sur proposer »*.

### Ce que ça défait, et pourquoi ce n'est pas un retour en arrière

Le 22 août, les deux gestes avaient été **séparés** à sa demande (planche 91,
§159) : toucher une case OUVRAIT la journée — qui est déjà là, à quelle
demi-journée, avec quelle équipe —, et un bouton « Proposer ce jour » engageait
la date. La raison tenait : *« un jour consulté par erreur partait chez
quelqu'un »*.

**Ce qu'il a demandé le 25 ne remet pas le calendrier nu.** La fiche reste, et
c'est elle qui portait toute la valeur du 22 août : elle montre l'occupation de
la journée, elle dit ce que le serveur en pense. Ce qui disparaît, c'est le
**second appui** — un geste par date, sur chaque devis, pour une confirmation
que la case elle-même donne déjà en s'allumant.

| | Avant le 25 août | Depuis |
|---|---|---|
| toucher une case | ouvre la fiche | ouvre la fiche **et** propose la date |
| retoucher la même | referme la fiche | **retire** la date, la fiche reste |
| « Proposer ce jour » | engage la date | n'existe plus |
| un jour refusé | bouton éteint | la case ne s'allume pas, la fiche dit pourquoi |

Le risque du 22 août — proposer sans avoir voulu — ne disparaît pas, il change
de coût : **il se défait du même doigt**, et la case s'éteint sous les yeux.
C'est ce que le bouton achetait cher.

### Trois partis pris, dans `EnvoiAuClient.toucherLeJour`

1. **Le retrait ne se fait pas attendre.** Le jour est déjà passé par le
   serveur pour entrer ; le redemander pour sortir serait attendre pour rien —
   et une case qui met une seconde à s'éteindre se retouche, donc se remet.
2. **L'ajout, si.** Le calendrier ne connaît que la fenêtre proche ; au-delà,
   seul `verifierJourPropose` sait si la journée tient. Proposer un jour que
   l'envoi refuserait ensuite coûte un aller-retour au client. La case ne
   s'allume donc qu'après le verdict.
3. **Un verdict en retard ne retient plus rien.** Chercher deux dates, c'est
   toucher deux cases coup sur coup ; sur un réseau de chantier, la réponse de
   la première reviendrait cocher un jour qu'il a quitté. `dernierTouche` — une
   `ref`, pas un état : la fonction qui attend le serveur lirait sinon la
   valeur figée au moment de son appel — jette tout verdict périmé.

### Ce qui reste sur la fiche

Le bouton est remplacé par un **mot**, `proposé`, et ce n'est pas décoratif :
la phrase de gauche appartient au serveur et cède la place à un avertissement
dès qu'il y en a un (« ce jour est complet »). Sans ce mot, un jour à la fois
proposé et signalé complet ne se lisait plus que par la teinte de sa case.

### Ce que les contrôles éprouvent maintenant

Trois suites navigateur appuyaient sur `[data-atlas="retenir-le-jour"]`, et
deux d'entre elles **refermaient la fiche par un second appui sur la case** —
ce geste-là retire aujourd'hui la date qu'on vient de poser. Elles visent donc
la règle et non le widget (`CLAUDE.md` §5 bis) : la case porte-t-elle
`data-etat="retenu"` ? Un jour trop proche ne l'obtient pas, **et la fiche dit
pourquoi** — une case qui ne s'allume pas sans un mot se lit comme une panne.

Le contrôle de la planche (`verifier-maquette-choisir-la-date.mjs`) tolérait
l'absence du bouton (`if (await bouton.count())`) : il serait resté vert sur une
planche où toucher un jour ne fait plus rien. Il exige désormais l'inverse — pas
de bouton, et un jour proposé au premier appui —, et il a été **vu rouge** sur
la planche d'avant.

---

## 171. Le brouillon de la dictée après confirmation : ce qui se fige, ce qui s'écrit

*Ses captures du 25 août 2026 : « je peux rien modifier, les cases ne sont pas
cliquables », puis « le à confirmer est trop long, synthétise-le. Moins de
mots ! ».*

### Le verrou protégeait ce qui n'existait qu'ici

Confirmer un brouillon le passait **entièrement** en lecture seule. L'intention
était juste : confirmer RECOPIE les prestations, le matériel, la durée et
l'équipe dans le chantier, et corriger la copie du brouillon ne toucherait plus
l'original — il aurait eu sous les yeux deux versions dont une seule compte.

Ce que l'intention n'avait pas vu : **trois champs n'ont aucune autre case dans
toute l'application.**

| | Après confirmation |
|---|---|
| prestations, matériel, durée, équipe | recopiés dans le chantier, **et éditables juste en dessous** |
| déchets, contraintes d'accès, remarques | **nulle part ailleurs** — figés, donc perdus |

La règle qui en sort, et qui vaut au-delà de cet écran : **ce qu'on fige doit
avoir une autre porte.** Sans elle, figer n'est pas protéger, c'est effacer.

D'où le parti retenu : après confirmation, l'encart **retire** les copies de ce
qui vit ailleurs et **garde, éditables**, les trois notes qui n'ont que lui.
L'écran raccourcit du même geste, ce qu'il demande par ailleurs.

### Un champ en lecture seule n'ouvre pas le clavier sur iPhone

C'est ce qui rendait sa plainte littérale — *« les cases ne sont pas
cliquables »*. Rien n'était grisé, rien ne disait « verrouillé » : il appuyait,
et il ne se passait rien. **Un état qui ne se voit pas se lit comme une panne.**
À retenir avant de reposer un `readOnly` quelque part.

### Le piège caché sous le déverrouillage

`enregistrerCorrectionHumaine` remettait `statut: "brouillon"` et effaçait
`confirmeAt` à chaque écriture. C'était **du code mort** tant que tout était
verrouillé après confirmation. Le déverrouillage le ramenait à la vie, et il
devenait faux : écrire une remarque aurait dé-confirmé le chantier, fait
réapparaître « Confirmer et ajouter au chantier », et un second appui aurait
réécrit sa durée et son équipe depuis la dictée par-dessus ses corrections.

**Une ligne qui ne sert plus n'est pas inoffensive : elle attend.** En retirer
la garde en fait une régression, et rien ne l'annonce.

### « Moins de mots » : deux leviers, parce qu'un seul ne suffit pas

| | Ce qu'il fait | Ce qu'il ne peut pas faire |
|---|---|---|
| la consigne au modèle (`extraction-service.ts`) | des groupes nominaux de six mots, cinq lignes au plus | rien pour les brouillons **déjà enregistrés** |
| `src/lib/brouillon-reserves.ts` | plafonne la liste à cinq, **et dit ce qui reste** | rien pour la longueur d'une ligne |

**Le texte n'est PAS raccourci à l'affichage, et c'est délibéré.** Couper une
réserve à six mots donnerait « Il est mentionné 'des herbages, des massifs' » —
l'entrée en matière sans la question qu'elle pose. Ce qui se coupe proprement,
c'est le NOMBRE ; la brièveté d'une ligne se joue à l'écriture.

**Et ce qui est coupé se dit** (« + 2 autres »). Une liste tronquée en silence
se lit comme une liste complète : il chiffrerait sans la réserve qu'on lui
cache. C'est la règle du plan d'arrosage (`CLAUDE.md` §4 ter), appliquée ici.

### Une question posée sous condition se vérifie avant d'agir

*« Ce bouton ouvre le devis ? Si oui la phrase en-dessous est obsolète, donc la
supprimer. »* La condition était fausse : « Valider et calculer le prix » ouvre
l'écran **Prix**, la proposition de montants. Le lien « Ou écrire le devis
moi-même » saute cette étape — c'est la sortie de secours qu'il avait lui-même
demandée le 3 août 2026. Il reste, et la réponse lui a été donnée en une ligne.

Supprimer sur un « si » non vérifié aurait retiré un chemin qu'il réclame
depuis trois semaines.

## 172. L'en-tête de l'accueil : ni salut, ni trait — et une consigne révoquée

**Ses deux demandes du 24 août 2026**, sur la planche 95
(`appli/premiere-page.html`), puis : *« code la mienne »*.

### Ce qui est parti, et pourquoi

**« Bonjour Compte ».** Ce qu'il lisait n'était pas son prénom mais le mot
« Compte » — le nom du compte, faute de prénom renseigné. Un salut qui se trompe
de nom vaut moins que pas de salut, et il occupait la première ligne de l'écran
qu'il ouvre vingt fois par jour.

Le prénom n'est plus lu **du tout**, et `auth()` a disparu de `page.tsx` avec
lui : il n'y servait qu'à ce salut. Garder la requête pour n'en rien faire aurait
coûté un aller-retour à chaque ouverture, et laissé croire à la prochaine lecture
qu'elle servait encore.

**Le filet qui fermait l'en-tête**, sous « Vos clients ». L'espace suffit.

### Le point qui compte : une consigne de ce dépôt a été RÉVOQUÉE

**Ce trait, il l'avait demandé le 11 août 2026**, et `EcranChantiers.tsx` portait
la consigne inverse en toutes lettres : *« seul reste celui qui FERME l'en-tête ;
il l'a demandé deux échanges plus tôt, et les confondre reviendrait à défaire ce
qu'il venait de valider »*.

Elle a donc été **récrite**, pas simplement contournée. Sans cela, la prochaine
session l'aurait remis de parfaite bonne foi, en citant une consigne devenue
fausse — c'est déjà arrivé deux fois ici.

### Le contrôle lit la SOURCE, et c'est délibéré

`scripts/test-accueil-en-tete.ts`. Un retrait ne se prouve que par une **absence**,
et une absence se mesure là où la chose s'écrirait. Le salut, en particulier, ne
paraît que si le compte porte un nom : une suite navigateur sur un compte sans
prénom serait **verte sans avoir rien mesuré**. Même méthode, et même raison, que
`test-accueil-liste-vide.ts`.

Il ignore les commentaires — une consigne CITÉE ne doit rien déclencher — et il
vérifie aussi que **l'en-tête du fichier dit le retrait**, sans quoi le code et
son mode d'emploi se contrediraient.

Les deux mesures ont été vues rouges, chacune contre son propre défaut.

### Ce qu'il n'a PAS demandé, et qui n'a donc pas été fait

La planche 95 proposait trois autres choses, retenues dans sa proposition B : un
bouton « Créer un devis » en capsule, un intertitre « À voir » séparant les avis
des chantiers, et la phrase d'accueil qui se tait tant que l'écran n'est pas
vide. Sa consigne, après avoir vu la planche : *« pour la mienne, fais seulement
les changements que je t'ai demandés, le reste laisse-le comme il est
aujourd'hui »*.

**Une proposition ne se glisse pas dans la version de quelqu'un sous prétexte
qu'elle l'améliore.** Elles restent sur la planche, où il peut les comparer.

---

---

## 173. Son logo était partout, sauf sur l'écran qu'il regarde

**Sa remarque du 25 août 2026, capture à l'appui :** *« je viens de modifier
l'apparence de mon devis, j'ai rajouté un logo en haut à gauche mais il n'est
pas visible »*.

**Il avait raison, et le logo n'était pourtant pas perdu.** Il partait bien sur
le PDF (`document-commun.ts`, « Le logo, au-dessus du nom ») et s'affichait dans
l'aperçu de « Devis & factures » (`Feuille`). Le seul endroit où il manquait est
celui où l'artisan passe son temps : **l'écran où il rédige son devis**.

### Pourquoi ce trou existait, et ce qu'il enseigne

L'écran du devis compose son en-tête **à la main** — nom, téléphone, e-mail,
références à droite — sans passer par la fabrique de documents. Deux écritures
du même en-tête, donc, et c'est la seconde qui a vieilli : le jour où le logo
est arrivé, elle ne l'a pas su. C'est exactement le piège que `CLAUDE.md` §3
nomme : *jamais de règle dupliquée entre l'affichage et la vérification*, et il
vaut aussi entre deux affichages.

**Ce qui n'a PAS été fait, et pourquoi.** Fusionner cet écran avec la fabrique
de PDF serait la vraie réparation, mais elle est lourde : l'un est modifiable au
doigt, l'autre est figé et paginé. Le logo est donc posé ici avec **les mêmes
règles que le PDF** — au-dessus du nom, hauteur fixe et largeur libre — et le
contrôle mesure les deux propriétés qui comptent.

### Le contrôle, et ce qu'il refuse de croire

`test-allure-de-mes-devis-e2e.ts` **pose le logo comme lui le pose** — dans les
réglages, par le champ de fichier — puis ouvre un devis. Il vérifie trois
choses, et la première est la moins évidente : **l'image est CHARGÉE**
(`naturalWidth > 0`), pas seulement présente. Une balise avec une mauvaise
adresse est une balise : elle passerait au vert et c'est lui qui verrait le
carré vide. Ensuite : le logo est **au-dessus** du nom, et il n'est pas écrasé.

Éprouvé rouge avant d'être livré, en retirant l'image de l'écran.

---

## 174. L'émetteur n'apparaît plus deux fois — et une ligne par information

**Ses deux remarques du 25 août 2026, à la suite de la précédente :**
*« pourquoi il y a deux fois l'émetteur sur l'aperçu ? »* et *« en haut à gauche
il y a un tiret entre le numéro de tél et l'adresse e-mail, change ça, il faut
sauter une ligne, une ligne par information »*.

### Deux fois l'émetteur : ce n'était pas une convention

Le document portait son identité **à deux endroits** : l'en-tête (nom,
téléphone, e-mail) et, dix centimètres plus bas, un bloc « ÉMETTEUR » qui
réécrivait le nom, l'adresse et le SIRET. Rien ne l'exigeait — les mentions
obligatoires d'un devis doivent **figurer**, pas figurer deux fois. C'était un
reste du modèle d'origine, jamais relu depuis que l'en-tête s'était étoffé.

**L'en-tête a donc pris toute l'identité** — nom, adresse, téléphone, e-mail,
SIRET — et le bloc du bas a disparu.

**Le client passe à gauche, seul de sa rangée.** Une colonne « CLIENT » restée
à droite avec un vide en face se serait lue comme un bloc oublié à
l'impression : c'est le genre de détail qu'un client remarque sur le seul papier
qu'il garde.

### Une ligne par information

Le téléphone et l'e-mail tenaient sur la même ligne, joints par un tiret
cadratin (`[tel, email].join(" — ")`). C'est lisible sur un écran large ; c'est
un pâté sur un devis imprimé, et il l'a vu tout de suite. Les coordonnées sont
maintenant une liste — adresse, téléphone, e-mail, SIRET — dont chaque entrée
prend sa ligne, et les absentes ne laissent pas de trou.

### Les deux en-têtes ont bougé ENSEMBLE

C'est la leçon de §173, appliquée le lendemain : l'écran de rédaction compose
son propre en-tête, et il aurait suffi de corriger le PDF pour recréer l'écart.
Les deux ont donc changé dans le même lot — `document-commun.ts` (devis **et**
facture, même moteur) et `DevisCompletClient.tsx`, où l'adresse et le SIRET
descendent de l'ancien bloc « Émetteur » vers l'en-tête, et restent modifiables.

### Ce que les contrôles vérifient maintenant

`test-devis-pdf.ts` et `test-facture-pdf.ts` ne cherchent plus « ÉMETTEUR » : ils
**refusent** qu'il reparaisse (`!textes.includes("ÉMETTEUR")`) et exigent que le
nom de l'entreprise n'apparaisse **qu'une seule fois** dans le corps du
document. Un contrôle qui se contente de lire « CLIENT » aurait laissé revenir
le doublon sans rien dire.

**Et l'image a été regardée** (`scripts/capture-allure-devis.mts`) : sur fond
clair comme sur fond sombre, avec logo carré et logo en bandeau. C'est la seule
manière de voir qu'une ligne de plus dans l'en-tête ne vient pas toucher les
références du devis.

---

## 175. Cinq réglages qui n'atteignaient aucun document

**Son constat du 25 août 2026, et il l'a trouvé seul :** *« les autres qui sont
en ON doivent-ils être visibles sur le devis ? car je ne vois rien, est-ce
normal ? »*

Non. Depuis la migration 0040 — le 14 août —, six conditions se réglaient dans
« Réglages → Documents ». **Une seule atteignait le document** : la validité.

| Le réglage | Avant le 25 août | Depuis |
|---|---|---|
| Validité du devis | sur le devis | inchangé |
| Acompte | nulle part | sur le devis, avec son montant |
| Délai de paiement | nulle part | sur le devis |
| Moyens de paiement | nulle part | sur le devis |
| Rappel des pénalités | nulle part | sur le devis |
| Texte de bas de page | nulle part | sur le devis |

### Ce qui a caché le défaut onze jours

Trois choses, et aucune n'était un mensonge :

1. **`lignesConditionsDevis` existait et composait les bonnes phrases.** Elle
   n'était appelée que par **l'aperçu de l'écran de réglages**. Il réglait, il
   voyait les phrases, et le document ne les portait pas ;
2. **Son écran de devis affiche « Acompte de 30 % à la signature… »** — en gris,
   comme exemple dans un champ libre vide (`placeholder`). Un texte parfaitement
   plausible, à l'endroit exact où le réglage aurait dû apparaître ;
3. **« Modalités de paiement / IBAN » s'imprime bien**, et vient de ses
   coordonnées bancaires. De quoi croire que le bloc des conditions marchait.

### Ce que les contrôles ne pouvaient pas voir, et qui vaut au-delà de ce cas

Une suite éprouvait `lignesConditionsDevis` : les bons réglages donnent les
bonnes phrases. Elle était verte, et elle avait raison — **la fonction n'a
jamais été en cause**. Ce qui manquait, c'est le **chemin** entre le réglage et
le papier.

> Un contrôle qui éprouve la RÈGLE ne voit pas une pièce DÉBRANCHÉE. Il faut, au
> moins une fois, parcourir la chaîne entière : l'écran, la base, le document.

C'est exactement la faute du 8 août sur le lien de facture (§34), sous une autre
forme : chaque morceau juste, et rien qui les relie.

### Les conditions se FIGENT sur le devis

Migration 0064, cinq colonnes sur `devis`, recopiées à la création — comme la
validité (§102) et l'identité (§94). Les relire à l'impression ferait changer
les conditions d'un devis **déjà envoyé** parce qu'un réglage a bougé depuis,
pendant que le client a une autre feuille sous les yeux, et que c'est celle-là
qui l'engage.

**Aucun rattrapage, et c'est délibéré.** La 0040 avait posé 30 jours sur les
devis existants, parce que 30 jours était ce que la constante imprimait déjà.
Ces cinq lignes-ci ne figuraient sur **aucun** devis : les poser rétroactivement
ajouterait des conditions à des documents partis sans elles. `NULL` partout, et
les anciens devis sortent identiques à eux-mêmes.

### Où elles se posent, et pourquoi là

Sous « NOTES / CONDITIONS », **après** ce qu'il a écrit à la main. Ce qu'il écrit
parle de CE chantier — l'accès par le portail de gauche, la cour à dégager la
veille ; les conditions de paiement sont les mêmes sur tous ses devis. Son champ
libre n'est ni remplacé ni réécrit.

Quand il n'a rien écrit, le bloc ne porte que les conditions — ce qui est la
proposition A de la planche 60, sans qu'il ait eu à trancher entre A et B.

**Rien de tout cela sur la feuille de chantier** (`sansChiffrage`) : elle part
chez un salarié, délibérément sans un prix (§133), et « acompte de 30 % — soit
313,20 € » y serait un montant. C'est la règle que suit déjà l'IBAN.

**Le montant de l'acompte s'écrit dans le PDF**, pas dans l'aperçu des réglages :
là seulement le total est connu. Ailleurs la fonction le tait plutôt que
d'inventer un chiffre — un montant supposé à cet endroit finirait imprimé.

### Éteindre en fait disparaître

Sa question, le même jour : *« si je décoche le bouton OFF, ils sont censés
disparaître ? »* Oui, et c'est éprouvé : un réglage qu'on ne pourrait plus
retirer serait pire que pas de réglage du tout.

`scripts/test-conditions-sur-le-devis.ts` lit la **trace du PDF**, et sait
rougir : débrancher le raccordement fait tomber trois cas en nommant la ligne
absente. `scripts/capture-conditions-devis.mts` rend les trois états en image —
parce que ce défaut-là s'est vu à l'œil et par aucun test.

---

## 176. Un jour à moitié pris le dit, il ne se refuse pas

**Sa colère du 22 août 2026 :** *« je peux proposer le 24 alors qu'un client a
validé le 24 — corrige-moi ça ! Ça ne doit jamais se reproduire, c'est une
erreur gravissime !!!! »*

Deux choses se cachaient derrière, et il ne fallait pas les confondre :

| | |
|---|---|
| **un vrai défaut** | un chantier commencé avant la fenêtre et encore en cours dedans n'était compté nulle part — réparé le jour même |
| **un fonctionnement voulu** | avec **deux équipes**, un jour où une seule est prise reste proposable. Mais aucun écran ne le disait |

### Ce qui a été codé, et ce qui ne l'a pas été

**Sa réponse du 25 août : B**, la mention écrite en toutes lettres. Pas
l'interdiction. Choisir une mention plutôt qu'un refus se lit comme « seulement
le voir », et c'est aussi le sens sûr : interdire bloquerait un jour où il peut
réellement envoyer quelqu'un.

### Le libellé, qu'il a redressé lui-même

La planche 88 proposait **« 1 chantier sur 2 équipes »**. Sa remarque en
retenant B : *« on ne comprend pas très bien, comment on peut faire pour
comprendre mieux ? »*

Il avait raison, et la raison est nette : cette phrase compte ce qui est **pris**,
alors que ce qu'il décide dépend de ce qui **reste**. Il est en train de proposer
une date ; sa question est *puis-je encore envoyer quelqu'un ce jour-là*. D'où :

> **Reste 1 équipe sur 2**

Même information, tournée du côté du geste. La planche a été corrigée avec le
code, et **un contrôle interdit aux deux de diverger** — une planche qui
n'annonce plus ce que l'écran écrit lui fait valider une phrase qu'il ne verra
jamais.

### Le pire des deux demi-journées commande

Un jour dont le matin est plein et l'après-midi libre n'a pas « une équipe et
demie » de libre : il a un moment où il n'y a personne, et c'est celui-là qui
contraint. **La moyenne annoncerait de la place là où il n'y en a pas** —
exactement la faute qu'il a signalée, sous une autre forme. Le contrôle a été vu
rouge en remplaçant le maximum par la moyenne.

### Deux silences, et ils sont voulus

- **rien sur un jour entièrement libre** ;
- **rien quand il n'a qu'une équipe** : « Reste 0 équipe sur 1 » n'apprend rien à
  qui n'a personne d'autre à envoyer, et le serveur refuse déjà ce jour-là.

Un avertissement qui parle à tort s'apprend à être ignoré, et l'on perd le
garde-fou sans s'en apercevoir (`CLAUDE.md` §4 ter).

### Où la mention se pose

Sur la **liste des dates retenues**, dans l'écran d'envoi — pas sur la case du
calendrier. C'est le dernier endroit où il peut retirer une date, et le seul
qu'il relit avant d'envoyer.

### Deux contrôles, et pourquoi le second

`test-reste-equipes.ts` balaie la règle pour toutes les combinaisons de *k*
équipes prises sur *n*, virgule flottante comprise. `test-reste-equipes-e2e.ts`
parcourt le chemin : deux équipes en base, un chantier posé, la mention lue à
l'écran — et le jour libre d'à côté qui n'en porte aucune, dans la même liste.

Le second existe à cause du défaut du même jour (§175) : *un contrôle qui éprouve
la règle ne voit pas une pièce débranchée.*
## 177. L'adresse du lien vient du NAVIGATEUR, pas de ce que le serveur croit

*Sa capture du 25 août 2026 : « je ne peux pas l'envoyer au client », devant le
refus posé la veille — et sa barre d'adresse portait `…-3000.app.github.dev`.*

### Le garde-fou avait raison sur ce qu'il savait, et tort sur la réalité

`ouvrableParLeClient` barre un lien qui ne mène qu'à la machine de l'artisan
(§169), et c'est juste : son client avait reçu « Connexion au serveur
impossible ». Mais l'adresse qu'on lui donnait à juger venait du SERVEUR, et
derrière le tunnel de son espace de travail le serveur ne voit que
`localhost:3000` — aucun en-tête ne porte l'adresse publique.

`origine-publique.ts` le disait déjà, noir sur blanc : *« la fonction rend alors
honnêtement `http://localhost:3000` — c'est à celui qui met cette adresse dans
un message de refuser »*. Ce qui manquait, c'est que **celui qui refuse
disposait d'une meilleure source et ne la lisait pas.**

| Source | Ce qu'elle vaut |
|---|---|
| `ATLAS_URL_PUBLIQUE` | juste quand elle est posée — elle ne l'est pas chez lui |
| `x-forwarded-host` / `host` | **`localhost` derrière son tunnel** |
| `window.location.origin` | **l'adresse par laquelle il a ouvert Atlas** — exactement celle qui s'ouvrira chez son client |

### Pourquoi ce n'est pas le retour du défaut d'hydratation

Le dépôt interdit de composer une adresse depuis `window` **pendant le rendu**
(§68, §81) : serveur et navigateur diffèrent, React régénère tout l'arbre, et le
patron a signalé cette erreur le 13 août. La règle tient toujours, et elle est
respectée de deux façons :

- **dans un GESTE** — au moment où il appuie — `window` se lit sans risque :
  rien n'est comparé à un rendu ;
- **pour un texte AFFICHÉ**, le premier rendu reprend l'adresse du serveur, mot
  pour mot, et un `useEffect` la corrige **après** le montage. C'est le seul
  ordre qui ne fasse pas diverger les deux.

### DEUX correctifs, et il faut les deux — ne pas retirer l'un pour l'autre

Le même soir, une autre session a traité le même défaut **par l'autre bout** :
`.devcontainer/demarrer.sh` calcule `ATLAS_URL_PUBLIQUE` depuis `CODESPACE_NAME`
et la donne au serveur au démarrage. C'est juste, et c'est mieux quand ça marche :
le serveur connaît alors la bonne adresse pour TOUT — les PDF, les courriels, ce
qui ne passe par aucun navigateur.

**Ce n'est pas la même règle écrite deux fois** (`CLAUDE.md` §3), ce sont deux
SOURCES pour une seule règle, et leur ordre est déjà écrit dans
`origine-publique.ts` :

| | Quand elle vaut |
|---|---|
| `ATLAS_URL_PUBLIQUE` (leur correctif) | l'espace a redémarré depuis, et `CODESPACE_NAME` y est |
| les en-têtes | un vrai déploiement derrière un mandataire qui parle |
| **le navigateur** (celui-ci) | **toujours** — et c'est le seul filet quand les deux premiers manquent |

**Pourquoi le navigateur reste nécessaire.** `CODESPACE_NAME` manque dans un
espace créé avant que la variable n'y soit écrite : *« deux correctifs de suite
ont échoué chez le patron pour ce motif »* (`src/middleware.ts`). Un espace qu'il
n'a pas recréé garde donc l'ancien démarrage — et sans ce filet, il resterait
bloqué sans un mot.

**Et ils ne se contredisent jamais.** L'adresse du navigateur ne remplace celle
du serveur que si elle est ouvrable : ouvert par `localhost` alors que
`ATLAS_URL_PUBLIQUE` est posée, c'est celle du serveur qui gagne, et le lien
reste bon.

### Le refus reste entier

C'est le contrôle qui compte le plus dans ce lot : prendre l'adresse du
navigateur ne doit pas rouvrir la porte que le 24 août a fermée. Ouvert par la
redirection de port de son éditeur, `window.location.origin` vaut
`http://localhost:3000` — le lien est barré, comme avant.

### Et le refus ne s'écrit plus DEUX FOIS

Sa capture le montrait en double : `RapportParti` porte le sien une fois le
rapport figé, et celui de la tentative précédente restait affiché. **Deux fois
la même phrase se lit comme un écran cassé**, et c'est un défaut à part entière.

---

---

## 178. `git log` ne date pas le début du projet — l'historique a été remis à plat

**Sa question du 25 août 2026 :** *« combien d'heures avons-nous passé à créer
cette application ? »* — puis, devant la première réponse : *« on a commencé
avant le 10 août »*. Il avait raison, et le dépôt disait le contraire.

### Ce qui s'est passé

Le premier commit de l'historique, `b1ceb76` du 10 août 2026 à 22 h 12, n'est
pas un début de projet : c'est **un écrasement**. 684 fichiers, 129 867 lignes
d'un coup — l'application entière, déjà écrite, réenregistrée en un bloc. Les
onze jours qui précèdent ont perdu leurs dates à cette occasion.

`git log --reverse | head -1` répond donc **10 août** à la question « depuis
quand ? », et cette réponse est fausse de onze jours. Le `CHANGELOG.md`, lui,
remonte au **31 juillet**, et `docs/PRODUCTION_BACKUP_RESTORE.md` porte des
exercices du **29 juillet**.

### La règle qui en découle

| Pour dater… | Ne pas se fier à | Lire |
|---|---|---|
| le début du projet | `git log --reverse` | `CHANGELOG.md`, sa plus ancienne en-tête |
| l'âge d'un fichier | `git log --follow` | il ne remonte pas avant l'écrasement |
| le rythme depuis le 10 août | — | `git log`, qui est exact **à partir de là** |

Ce n'est pas un défaut à réparer — réécrire un historique effacé n'est pas
possible, et le code, lui, n'a rien perdu. C'est un piège à connaître : toute
question de chronologie posée à `git` avant le 10 août 2026 reçoit une réponse
plausible et fausse.

### Ce que le dépôt sait quand même en dire

`scripts/compter-heures.mjs` mesure la période visible (regroupement des commits
en séances, une pause de deux heures les sépare) et **estime** la période
effacée par trois règles de trois indépendantes — volume de code déjà présent au
moment de l'écrasement, lots notés au journal, jours travaillés. Elles ne
tombent pas d'accord : le script les affiche toutes les trois plutôt que d'en
moyenner une quatrième, fausse et rassurante.

Au 25 août 2026 : **122 h mesurées**, 31 à 76 h estimées avant, soit un total de
153 à 198 h. La réponse en langage courant est en `docs/QUESTIONS.md` §26.

**Et ce compte ne remonte pas plus loin qu'Atlas.** Le produit est la reprise
d'**Arborea** (`CHANGELOG.md`, 31 juillet 2026) : écrans, calculs et tests
repris d'un dépôt précédent. Le temps passé là-bas n'est dans aucun fichier
d'ici, et aucun calcul fait ici ne peut l'inventer.

---

## 179. Les flèches décoratives sont parties, et un contrôle les empêche de revenir

**Sa correction du 25 août 2026, capture à l'appui :** *« Retire la flèche ! Il
m'avait semblé t'avoir demandé de supprimer toutes les flèches de
l'application ! »* — devant « Créer la facture → », sur l'écran de facture.

Il avait déjà posé la règle **le matin même** (`CLAUDE.md` §3, *« arrête de
mettre des flèches, c'est moche »*). Elle était écrite, et vingt-huit libellés
en portaient encore une le soir : la règle avait été appliquée là où on
regardait, pas là où elle valait.

### Ce qui est parti

Le « → » et le « › » ajoutés **au bout d'un bouton ou d'un lien** — « Créer la
facture → », « Préparer le devis → », « Modifier mon devis › », « Enregistrer
→ », « Composer ma fiche → »… La carte d'action `ActionPrincipale` portait la
sienne dans un `<span>` séparé, héritée du modèle d'Arborea — ce composant
n'est monté nulle part aujourd'hui, et sa flèche serait revenue à l'écran le
jour où on le remonte.

Sont partis aussi les chemins de navigation écrits **dans une phrase** —
« dans Réglages → Mes prix », « Réglages › Appareil photo › Formats »,
« Terminés › TVA › En attente de paiement » : la virgule dit la même chose sans
ornement. Et la légende du plan d'arrosage, où la flèche voulait dire « donc »
(« la ligne continue → té taraudé »), porte maintenant un point médian.

### Ce qui reste, et pourquoi ce n'est pas une exception de confort

| Où | Quoi | Sa fonction |
|---|---|---|
| calendriers, planning, terminés | `‹` `›` | feuilleter — le chevron EST le geste |
| TVA, période précédente/suivante | `←` `→` | sa demande du 12 août : *« le calendrier se glisse ENTRE les deux flèches »* |
| carte du mois | `← Aujourd'hui` | revenir au mois courant |
| discussion du plan d'arrosage | `↑` seul, dans un rond | le bouton d'envoi : la flèche est TOUT le bouton, il n'y a pas de libellé à décorer |
| retouches de devis | `250 € → 350 €` | avant/après — retirer la flèche retirerait le sens |

La ligne de partage n'est pas « on y tient » mais : **la flèche fait-elle
quelque chose, ou suit-elle un mot qui le dit déjà ?**

### Le contrôle, et ce qu'il refuse de croire

`scripts/test-aucune-fleche.ts` lit tout `src/`, **commentaires retirés** — sans
quoi il rougirait sur les explications de ce dépôt, qui citent les libellés
d'hier pour dire pourquoi ils sont partis, et un contrôle qui interdit
d'expliquer se fait contourner.

Trois choix qui comptent :

- **La liste des flèches permises vise la LIGNE, pas le fichier.** Autoriser
  `Calendrier.tsx` en entier laisserait passer un libellé fléché ajouté
  dedans demain.
- **Chaque flèche permise porte sa raison, en français, dans le fichier.** Une
  liste d'exceptions sans motif s'allonge toute seule.
- **Il refuse de conclure sur une lecture vide.** Moins de dix mille lignes lues
  et il rougit : sans cela, un `src/` illisible rendrait « aucune flèche » en
  vert — la faute du 15 août 2026 (`CLAUDE.md` §5, « un contrôle qui mesure ZÉRO
  ne mesure rien »).

Il a été vu rouge avant d'être cru : il a trouvé deux flèches que la recherche
faite à la main avait manquées (le `← Aujourd'hui` de la carte du mois, le `↑`
du bouton d'envoi), puis il a rougi de nouveau quand « Créer la facture → » a
été remis pour l'éprouver.

**Ce qu'il ne couvre pas :** les maquettes d'`appli/`, qui en portent encore.
Elles ne sont pas l'application, et certaines sont des planches archivées dont
le patron a déjà tranché le contenu — les réécrire changerait ce qu'il a validé.

---

---

## 180. Trois rôles, trois sessions — et le refus est au serveur

*Demandé le 25 août 2026 : « je voudrais que l'utilisateur principal puisse
donner accès qu'au planning à ses salariés […] chaque utilisateur possède son
propre compte et sa propre session. Les restrictions d'accès doivent être
appliquées côté serveur, et pas uniquement en masquant des boutons. »*

La règle elle-même n'est pas neuve : elle est tranchée dans `docs/QUESTIONS.md`
§10 depuis le 13 août, précisée le 23. Ce qui manquait, c'était **tout le code**.

### Ce qu'il y avait avant, et pourquoi c'était pire que rien

La base connaissait deux rôles, `proprietaire` et `membre`, et `membre` ne
restreignait **rien** : un compte non propriétaire atteignait tous les écrans
sauf les quatre ou cinq qui avaient reçu une garde écrite à la main. Le sommaire
des réglages, lui, cachait des rubriques — donc l'application *avait l'air*
cloisonnée. C'est l'état que §10 nomme d'avance : *« pire que pas de restriction
du tout, puisque vous vous croyiez protégé »*.

### Où la règle vit, et pourquoi elle est seule

`src/lib/acces-roles.ts`, fonction pure. La même fonction dessine la barre du
bas, filtre le sommaire des réglages, et **refuse une adresse tapée à la main**.
Deux rédactions de cette règle divergeraient au premier écran neuf, et la
divergence porterait un nom : un onglet caché dont l'adresse répond quand même.

### Deux sens opposés, et c'est délibéré

| Rôle | Comment la liste se lit |
|---|---|
| commercial | **tout, SAUF** les cinq adresses nommées |
| salarié | **rien, SAUF** ce qui lui est ouvert |

Le salarié se garde par liste blanche pour qu'un écran ajouté demain, par une
autre session, lui soit **fermé d'office**. Une liste noire l'aurait ouvert en
silence, et personne ne l'aurait su avant qu'il y lise un prix.

### Trois endroits refusent, et il en faut trois

| Quoi | Qui refuse | Pourquoi pas les autres |
|---|---|---|
| un écran | `GardeAcces`, dans `layout.tsx` | tout écran le traverse — impossible à oublier |
| une route d'API | `exigerOuverture()`, dans le handler | **une route ne traverse aucune mise en page** |
| une action serveur | `exigerProprietaire(ctx, …)` | une action se poste à l'adresse de la PAGE qui l'a rendue — la garder par le chemin reviendrait à la garder par l'écran d'où l'on croit qu'elle vient |

`scripts/test-acces-routes-gardees.ts` lit les routes du dossier `src/app/api` et
rougit dès qu'une route neuve n'appelle pas la garde et n'est pas inscrite,
raison écrite, dans sa liste d'exemptions. C'est le seul des trois qui puisse
s'oublier ; c'est donc le seul qui a besoin d'un contrôle.

### Ce que le commercial n'atteint pas, et les trois lignes qui ne sont pas dans sa phrase

Ses mots du 23 août : la mise en page des devis, les informations de
l'entreprise. S'y ajoutent, et il faut le dire plutôt que de le glisser :

- **les accès** — un commercial qui donne les accès se nomme patron en deux
  appuis, et le rôle entier cesse de vouloir dire quelque chose. Ce n'est pas
  une restriction de plus, c'est ce qui rend les autres vraies ;
- **l'abonnement** et **l'export des données** — le contrat Atlas, le moyen de
  paiement, l'export intégral. Même famille que « les informations liées à
  l'entreprise », et sa table du 13 août les excluait déjà mot pour mot.

### « Ses chantiers autorisés » : la portée du planning

Réglage **par personne**, pas par rôle (sa décision du 13 août : *« le patron
choisira s'il a accès qu'à ses chantiers ou à tout »*). Le défaut est « tout » —
restreindre est un geste. Le tamis est posé dans `contextePlanning`, c'est-à-dire
**au chargement**, jamais à l'écran : filtrer au navigateur laisserait descendre
les noms de clients, les adresses et les pense-bêtes de tous les chantiers.

**Une portée resserrée sans équipe rattachée ne montre RIEN, jamais tout.**
L'inverse rendrait le resserrement silencieusement inopérant — et il y a un
chemin réel vers cet état : supprimer une file du planning met `equipe_id` à NULL
en laissant la portée resserrée. Sans ce choix, supprimer une équipe rouvrirait
le planning entier à un salarié restreint, sans un mot.

### Un mot de passe provisoire, et pas une invitation par courriel

Atlas n'envoie aucun courriel à un utilisateur d'Atlas — les envois existants
vont au CLIENT de l'artisan, par un canal qu'il a choisi. Un parcours
d'invitation demanderait une table de jetons, une expiration, une page publique
de plus, et surtout **un envoi qui, s'il n'arrive pas, laisse le salarié dehors
sans que personne le sache**. Le patron est à côté de son salarié : il tape un
mot de passe et le lui dit. Le salarié le change ensuite dans « Mon compte », qui
lui reste ouvert.

Le mot de passe suit la règle commune (douze caractères) : un compte de salarié
ouvre le planning de l'entreprise, il n'a aucune raison d'être moins tenu.

### `membre` a disparu, et il est devenu `salarie`

Migration 0065. **Le rôle le plus fermé, pas le plus ouvert** : une reprise qui
aurait laissé un compte existant plus large qu'avant serait exactement la faute
que ce lot répare. La contrainte `CHECK` qui tient les trois rôles est posée en
base — elle n'existait pas, l'énumération vivant dans TypeScript seul.

### Ce qui reste ouvert

Le commercial **ne lit pas encore les tarifs**, alors que la règle du 13 août dit
qu'il les lit sans les changer. `/reglages/tarifs` et `/reglages/prix` restent
réservés au patron, comme avant ce lot : les rendre lisibles sans être modifiables
est un travail d'écran, qui demande son œil. Voir `TODO.md`.

## 181. L'assistant explique l'application — et il ne sert que le patron

**Ses trois demandes du 25 août 2026**, dans un même message : *« j'aimerais que
l'assistant qui se trouve dans l'application puisse expliquer chaque
fonctionnalité de l'appli »* — avec son exemple, *« comment je fais pour
supprimer un client en attente de rédaction de son devis sur la page chantier »*
→ *« slide de droite à gauche puis appuie sur retire »* — ; *« qu'il soit en
mesure d'aller chercher une ligne dans un devis de n'importe quel client et la
poser sur un devis déjà ouvert »* ; et *« qu'il se comporte comme un vrai
assistant au service de l'utilisateur principal seulement le principal »*.

### Un mode d'emploi ÉCRIT, pas un modèle qui devine

`src/lib/mode-emploi.ts` porte une soixantaine de fiches : l'écran, où il se
trouve, ce qu'on cherche à faire, **le geste**, sa réserve, et les mots par
lesquels il le demandera. L'outil `RechercherModeEmploi` y cherche ; le service
impose de réciter le geste tel qu'il est écrit.

**Pourquoi une liste, et pas le modèle seul.** Un modèle de langage qui n'a pas
l'écran sous les yeux invente un geste *plausible* — « allez dans les réglages,
puis Supprimer ». L'artisan le cherche cinq minutes, puis conclut que
l'application est cassée. C'est la règle des prix, appliquée aux gestes : ce qui
n'a pas de source ne se dit pas.

**Et une fiche se PROUVE contre le code.** Chacune porte son fichier source et
des `preuves` — des morceaux de texte qui doivent s'y trouver.
`scripts/test-mode-emploi.ts` les confronte, et le contrôle sait échouer : il est
retourné, dans la même suite, contre une fiche qui invente un bouton et contre
une fiche dont le fichier a disparu. **Il a d'ailleurs rougi à son premier
passage** — une fiche annonçait un bouton « Connecter » pour l'agenda, quand
l'écran dit « Relier mon agenda Google ». Le geste était faux avant même d'avoir
servi.

**Le refus fait la moitié du travail.** `chercherFiches` rend un tableau **vide**
plutôt qu'une fiche au hasard, et l'assistant dit alors qu'il ne connaît pas ce
geste. Deux règles le tiennent : au moins un mot-clé plein, et **deux mots
communs, pas un** — « quel temps fait-il ? » partageait « temps » avec la fiche
de la durée d'un chantier, et sortait une réponse à une question qui n'en était
pas une. Une réponse qui parle à tort s'apprend à être ignorée, et l'on perd le
garde-fou entier.

**Trois détails de la recherche, payés en essais :** les mots se comparent **par
préfixe au-delà de quatre lettres** (il tape « facture », la fiche dit
« facturer ») ; les trois sources de score **s'ajoutent** au lieu de s'exclure
(sinon deux fiches à égalité se départageaient par ordre alphabétique — « comment
on fait une facture » sortait la fiche des clients avant celle qui facture) ; et
les mots vides sont écartés, sans quoi « pour », « un », « je » décident du
classement.

### UNE fiche à l'écran, et c'est la capture qui l'a dit

La recherche rend jusqu'à trois fiches — pour que le modèle CHOISISSE, pas pour
qu'il les énumère. La première version les enchaînait toutes : « comment je
supprime un client ? » répondait le retrait, puis la création d'un chantier,
puis la saisie du client. **Trois gestes pour une question, sur un téléphone**,
alors que sa règle du 25 août dit l'inverse : *« mets le moins de mots possible
sinon on se perd dans toutes ces lignes »*.

**Aucune suite ne le voyait** — chacune vérifiait que le bon geste était là, et
il l'était. C'est la capture (`scripts/capture-assistant-mode-emploi.mts`) qui
l'a montré, la cinquième fois dans ce dépôt qu'un défaut sort d'une image et
d'aucun test. Un contrôle garde la porte fermée depuis : il compte les titres de
la réponse, et il rougit quand on lui remet les trois.

### Le piège que cela a failli créer

« Comment je fais pour supprimer un client ? » tombait dans la branche des
suppressions du fournisseur : il allait lire les prestations du chantier et
proposait d'en retirer une. **Il demandait un geste, on lui modifiait ses
données.** La détection du mode d'emploi passe donc **en tête** de la chaîne du
fournisseur, avant les suppressions et avant la préparation d'un devis ; un test
garde la porte fermée.

### Reprendre une ligne du devis d'un autre client

`RechercherLignesDevis` cherche dans les devis de **toute l'entreprise**, par un
mot du libellé et/ou par le nom du client — jamais sans l'un des deux : rendre
trois cents lignes reviendrait à choisir au hasard.

**Ce qui borne la recherche, c'est la RLS**, pas un `WHERE entreprise_id` écrit à
la main : `withEntreprise` pose le contexte, et une société voisine ne remonte
rien, silencieusement. Deux tests l'exigent, sous le rôle `atlas_app`, avec deux
lignes homonymes à des prix différents dans deux entreprises.

**Le montant ne voyage jamais.** La proposition `copier_ligne_devis` ne porte que
`ligneOrigineId` ; le libellé et le prix sont relus en base au moment où il
valide (`getLigneDevisPourCopie`). Un montant qui traverse le modèle puis le
navigateur est un montant qu'on peut changer en chemin, sur un document qui part
chez un client — c'est le même remède que pour un tarif, et pour la même raison.
Un test vérifie que `donnees` ne contient **que** cette clé.

### « Seulement le principal »

Ce n'est pas une préférence d'usage, c'est un cloisonnement. L'assistant lit les
tarifs, les marges, l'historique des prix — et il sait désormais chercher dans le
devis de n'importe quel client. Ouvert à un salarié, il rendrait par la
conversation exactement ce que les réglages lui refusent écran par écran (§ la
liste des rubriques, sa règle du 13 août 2026).

**Trois barrières, et la première ne compte pas.** Le bouton disparaît de
l'en-tête (décidé au serveur, dans le gabarit racine : posé puis retiré au
navigateur, on l'aurait vu apparaître une seconde). Mais un écran ne protège
rien : `poserQuestionAction` **et** `appliquerPropositionsAction` relisent le
rôle en base à chaque appel. Sans la seconde, il aurait suffi de rejouer l'action
avec les identifiants de propositions préparées pour le patron.

**Et la règle elle-même vit dans `acces-roles.ts` (§180), pas ici.** Deux
sessions ont écrit ce cloisonnement le même jour, chacune de son côté — l'une
pour les rôles en général, l'autre pour l'assistant. Ce qui a été gardé, c'est
**leur** modèle : les trois rôles, une seule fonction pure, un seul endroit où la
question se tranche. `peutUtiliserLAssistant` s'y est ajoutée à côté de
`peutVoirLesMontants`, et elle est **plus stricte** — le commercial voit les
montants, et n'a pourtant pas l'assistant.

**ELLE A CHANGÉ TROIS FOIS EN DEUX JOURS, et son dernier mot revient au
premier.** Il faut les écrire toutes les trois : une décision dont on ne garde
que le dernier état se repose trois mois plus tard, et l'on refait le chemin.

| Quand | Ses mots | Ce que ça donnait |
|---|---|---|
| 25 août | *« seulement le principal »* | patron seul |
| 26 août, dans la journée | *« oui tu peux l'ouvrir aux commerciaux »* | patron + commercial |
| **26 août, le soir** | *« les salariés et commerciaux ne doivent pas avoir accès à l'assistant IA »* | **patron seul, à nouveau** |

**Et `peutUtiliserLAssistant` N'APPELLE PLUS `peutVoirLesMontants`.** Tant que
les deux disaient la même chose, l'une appelait l'autre, et c'était juste. Elles
disent maintenant deux choses différentes — garder l'appel aurait été pire
qu'une erreur : le jour où quelqu'un élargirait la règle des montants,
l'assistant s'ouvrirait avec, en silence.

**La différence n'est pas le prix, c'est la PORTÉE.** Un commercial voit les
montants écran par écran, parce que c'est son métier de vendre. L'assistant, lui,
parcourt l'entreprise entière et répond en une phrase, sans qu'on ait à savoir où
regarder. C'est un accès transversal, et seul celui qui a déjà tout l'a.

**Ce qui avait fait hésiter**, et qui a fini par donner raison à l'hésitation :
§10 a été tranché le 13 août, quand l'assistant ne savait lire que le chantier
courant. Depuis le 25, il cherche dans le devis de N'IMPORTE QUEL client — un
commercial y lirait ce que chacun a payé pour la même prestation. La question lui
a été posée ; il a d'abord jugé que cela ne changeait rien, puis il a refermé le
soir même.

**Ce que ça a coûté d'y penser, et pourquoi ce n'était pas perdu :** la question
lui a été posée en une ligne, et la réponse tenait en un mot. Le contraire —
ouvrir d'office et le découvrir sur un chantier — se serait payé chez un client.

`peutUtiliserLAssistant` **appelle** donc `peutVoirLesMontants` plutôt que de la
recopier : tant que les deux règles disent la même chose, elles ne s'écrivent
qu'une fois. Elle garde son nom parce qu'elles peuvent rediverger demain, et
qu'il faut alors UN endroit où le dire.

---

## 182. Ses journées se comptaient à Greenwich

**Sa question du 25 août 2026, au soir :** *« on est le 25 au soir, donc le
chantier Eric est terminé — quand est-ce qu'il passe automatiquement dans la
catégorie Terminés ? »*, puis : *« donc ce soir à 00 h 00 il passe dans
Terminés ? »*.

**Non : à 2 h du matin.** Et personne dans le dépôt ne le savait.

### Le défaut

`jourIso` — la seule définition du « jour » de tout le dépôt — rendait
`instant.toISOString().slice(0, 10)`, c'est-à-dire le jour **UTC**. La France
est à UTC+2 l'été, UTC+1 l'hiver : entre minuit et deux heures, Atlas croyait
qu'on était encore la veille.

Ce que cela produisait, dans cette fenêtre-là :

| | |
|---|---|
| un chantier dont la journée est finie | reste au **planning** |
| une facture faite en rentrant | porte la **date d'hier** |
| le jour marqué « aujourd'hui » au calendrier | est le **mauvais** |

Deux heures paraissent peu. C'est exactement l'heure à laquelle un artisan finit
sa journée et range ses papiers — la seule fenêtre où l'erreur se voit, et il
l'a vue.

### La correction

`jourIso` passe par `Intl.DateTimeFormat` sur `Europe/Paris`
(`FUSEAU_DU_PATRON`, `src/lib/jour.ts`). **Un décalage figé — `+1`, `+2` — se
serait trompé la moitié de l'année**, et l'erreur n'aurait sauté aux yeux qu'au
changement d'heure : `Intl` est la seule source qui connaisse les vraies règles
d'un fuseau. Le dépôt le savait déjà pour les agendas (`src/lib/fuseau.ts`,
`FUSEAU_ARTISAN`) ; c'est le calcul du jour qui était resté en arrière.

**Une seule fonction change, et tout suit** — le rangement des onglets, les
dates d'émission et d'échéance, le relevé de TVA, le calendrier. C'est le
bénéfice de la définition unique : la corriger à un endroit les corrige tous, là
où douze `toISOString()` recopiés auraient laissé la moitié du produit en UTC.

### Ce que le contrôle refuse

`scripts/test-jour-du-patron.ts` prend l'été **et** l'hiver, des deux côtés de
minuit, puis vérifie ce qu'il demandait vraiment : son chantier du 25 est encore
au planning à 23 h 59, et dans Terminés à 00 h 30. **Éprouvé rouge contre
l'ancienne version** : trois cas sur sept tombent.

### Ce qui n'a PAS changé, et c'est voulu

La bascule vers « Terminés » reste **calculée à l'affichage**
(`src/lib/onglet-chantier.ts`), jamais écrite en base et jamais déclenchée par
une tâche de fond. Rien ne tourne la nuit : l'écran range au moment où on
l'ouvre. Un chantier « passe » donc dans Terminés dès la première ouverture
après minuit — il n'y a pas d'instant où quelque chose se déclenche, et c'est ce
qui rend la règle sûre : aucune tâche à réveiller, rien à rattraper.

## 183. L'assistant sait enfin partir d'un NOM — et il ne prétend plus qu'un ancien devis a disparu

**Sa capture du 25 août 2026.** Il demande : *« Peux-tu me ressortir le premier
devis de M. Bernard ? »* L'assistant répond qu'il n'a *« aucun chantier
ouvert »*, lui explique comment aller ouvrir la fiche lui-même, et ajoute :
*« Atlas conserve uniquement le dernier devis par chantier »*. Sa réponse :
**« c'est justement ça que je veux qu'il soit capable de faire »**.

Deux défauts, et le second est le plus grave.

### 1. Aucun outil ne partait d'un nom

Tous les outils de l'assistant lisent `ContexteOutil.chantierId` — le chantier
d'où l'on a ouvert le panneau. Ouvert depuis la LISTE, il est nul, et chacun
refuse à son tour. Le modèle n'inventait rien : il n'avait littéralement aucun
chemin entre « M. Bernard » et un dossier.

`RechercherChantier` est le seul outil qui fonctionne **sans** chantier courant,
et il est en tête du registre pour cette raison. Il cherche dans le nom du
client **et** dans celui du chantier — il dit « le chantier de la mairie » aussi
souvent qu'il dit un nom de client, et l'outil doit suivre sa façon de parler,
pas la colonne où c'est rangé.

**La règle de comparaison est CELLE DE L'ÉCRAN** (`src/lib/recherche-client.ts`,
`filtrerClientsParNom`) : casse et accents ignorés, n'importe où dans la ligne,
mots dans le désordre. En écrire une seconde ici, c'est promettre à l'assistant
de trouver ce que l'écran ne trouve pas — ou l'inverse (`CLAUDE.md` §3).

### 2. Un outil muet fait inventer une explication

**« Atlas conserve uniquement le dernier devis » est FAUX.** Un brouillon se
réécrit en place, mais **un devis envoyé est conservé** et le suivant devient
une version 2 (`getOuCreerDevisBrouillon`). Ses anciens devis étaient là.

Ce qui a produit la phrase fausse n'est pas le modèle : c'est l'outil. Il rendait
la dernière version, sans jamais dire qu'il en existait d'autres. **Le modèle ne
dispose que de ce qu'on lui rend** — le reste, il le comble.

D'où deux changements qui vont ensemble :

| | |
|---|---|
| `LireDevis` prend une `version` | « le premier » = la version 1 |
| il rend **toujours** `versionsDisponibles` | même quand on ne demande rien : c'est ce qui empêche de conclure qu'il n'y en a qu'une |

`listerVersionsDevis` trie en **croissant**, contre l'usage du reste du dépôt :
ici on lit une histoire, on ne cherche pas l'état courant, et « le premier » doit
être le premier de la liste.

### Ce qu'un refus doit dire

Sans chantier, `LireDevis` ne répond plus « aucun chantier dans le contexte » —
il nomme **la suite à donner** : employer `RechercherChantier`, puis rappeler
avec l'identifiant obtenu. Une suite le vérifie, et vérifie aussi que le refus
ne renvoie **plus** le patron ouvrir une fiche à la main : c'est précisément ce
qu'il a reproché.

La consigne système va dans le même sens, en toutes lettres : *ne demande jamais
au patron d'aller ouvrir une fiche pour te donner accès — c'est ton travail de
la trouver.*

### Éprouvé contre la version qui lui a répondu

`test-ia-09-chercher-par-nom.ts` monte le décor exact de sa capture : un client
« Mr. Bernard », un premier devis **envoyé** — l'envoi seul fige la version 1 —,
puis un second. Rejouée contre l'ancien outil, elle rougit sur trois cas : la
version 1, les versions annoncées, et le refus d'une version absente.

**Et un confrère au même nom.** Une seconde entreprise porte elle aussi un
« Mr. Bernard » : c'est le seul décor où un défaut d'isolation se verrait, et il
montrerait les devis de quelqu'un d'autre. Les deux sens sont vérifiés — sans
quoi le cas serait vert avec une recherche qui ne rend jamais rien.


---

## 184. L'assistant OUVRE une fiche chantier — la seule écriture qu'on lui accorde

> **REFERMÉE LE 26 AOÛT 2026, LE LENDEMAIN.** À la question posée de face —
> *« y a-t-il des gestes sans risque que tu veux qu'il fasse directement, sans
> te demander ? »* —, le patron a répondu : **« Je pense qu'il ne doit pas
> pouvoir le faire. Très important que ça reste le doigt du patron. »**
>
> L'outil `CreerChantier` a donc quitté le registre, et le geste est devenu la
> proposition `creer_chantier` (§188). **Ses deux demandes tiennent ensemble** :
> celle du 25 août était *« ça aussi il doit pouvoir le faire »* — il le peut
> toujours —, celle du 26 dit seulement qui appuie.
>
> **Ce qui suit reste vrai et vaut d'être lu** : les deux règles que cet outil
> portait — un chantier ne se baptise pas, un doublon ne se crée pas en silence
> — ont été reprises telles quelles dans la proposition. Changer de mécanique
> n'était pas une raison de les perdre.

**Sa demande du 25 août 2026**, capture à l'appui : *« Crée-moi une nouvelle
fiche chantier du nom de Fernandez »*. Réponse de l'assistant : *« je ne suis
pas en mesure de créer une fiche chantier »*, suivie de trois étapes à faire à
la main. Sa réponse : **« Ça aussi il doit pouvoir le faire »**.

### Pourquoi la mécanique existante ne pouvait pas servir

Depuis le lot IA-03, l'assistant n'écrit jamais : il PROPOSE, et le patron
confirme d'un doigt. C'est le bon patron, et il n'a pas bougé pour le reste.

Mais une proposition est rangée **sous un chantier** — `propositions_ia.
chantier_id` est non nul — et il s'agit précisément d'en créer un. La faire
vivre sans chantier demandait une migration, une seconde action de
confirmation, et un second chemin dans le panneau : beaucoup de machinerie pour
un geste qui n'engage rien.

### L'exception, et ce qui la rend tenable

| Ce que `CreerChantier` fait | Ce qu'il ne fait pas |
|---|---|
| ouvre une fiche VIDE pour un client | écrire un prix, une prestation, une durée |
| reprend un client existant | envoyer, valider, facturer |

**Rien n'est inventé** — le nom vient de sa phrase. **Rien n'est engagé** — une
fiche vide n'a ni montant ni destinataire, et elle se supprime. Les trois gestes
que `CLAUDE.md` §4 réserve à son doigt restent hors d'atteinte, et toute autre
écriture passe encore par une proposition.

**C'est SA décision, pas un arbitrage technique.** L'invariant « l'assistant n'écrit
jamais » a été posé par le dépôt, pas par lui ; il vient de le lever pour ce
cas-là. Ne pas l'élargir sans lui.

### Deux règles reprises, jamais réécrites

**Un chantier ne se baptise pas.** Sa demande du 5 août 2026 — *« retire la case
nom du chantier »* — parce qu'un élagueur ne baptise pas ses chantiers. Le nom
se déduit du client, sinon de l'adresse, sinon du jour (`nom-chantier.ts`).
« Une fiche du nom de Fernandez » veut donc dire « une fiche pour le client
Fernandez », et l'étiquette sort de la même fonction que l'écran de création.

**Le client se cherche avec la règle de l'écran** (`filtrerClientsParNom`) : il
dit « bernard » là où sa fiche porte « Mr. Bernard ». Une comparaison stricte
ouvrirait un second dossier au même nom, et son historique resterait dans le
premier.

### Le doublon se refuse AVANT d'être créé

Un paysagiste repasse chez les mêmes gens. Si le client a déjà des chantiers,
l'outil **ne crée rien** et les rend : c'est au patron de dire s'il en veut un de
plus. `confirmerDoublon` est la seconde intention explicite qui débloque.

Deux fiches pour un même jardin, c'est un désordre qu'on ne défait plus — et
c'est exactement ce qu'un modèle serviable ferait sans cette garde.


---

## 185. « Peu importe où je l'ouvre » — les outils suivent enfin le panneau

**Sa demande du 25 août 2026**, juste après avoir obtenu la recherche par nom et
la création de fiche : *« Je veux pouvoir faire ça peu importe où je
l'ouvre. »*

### Le panneau était déjà partout — les outils, non

`AssistantSidebar` est monté dans `src/app/layout.tsx` : le bouton existe sur
tous les écrans, et c'était déjà le cas. Ce qui ne suivait pas, ce sont ses
OUTILS. Cinq d'entre eux portaient la même ligne, recopiée :

    if (!chantierId) return { erreur: "Aucun chantier dans le contexte courant." };

Ouvert depuis la liste, le planning ou les réglages, ce chantier est nul et
chacun refusait à son tour. **L'assistant n'était donc utile que là où il
l'ouvrait le moins** — sur une fiche déjà ouverte, où il a l'information sous
les yeux.

### Une règle, un fichier, six outils

`chantier-vise.ts` porte les deux moitiés : le champ que le modèle peut
remplir, et le verdict. Chaque outil de lecture s'y branche —
`LireInformationsChantier`, `LirePrestations`, `LireMateriels`, `LireNotes`,
`LireTranscription`, `LireDevis`.

| | |
|---|---|
| un `chantierId` est donné | c'est lui qui commande |
| aucun, mais un chantier est ouvert | c'est l'ouvert — **l'usage d'avant ne bouge pas** |
| ni l'un ni l'autre | le refus nomme `RechercherChantier` |

**Cinq copies d'une même règle, c'est cinq endroits à corriger le jour où elle
change** (`CLAUDE.md` §3) — et elle vient de changer.

### Le refus ne renvoie plus le patron travailler à notre place

« Aucun chantier dans le contexte courant » ne dit rien à un modèle : il en
tirait ce qu'il pouvait, c'est-à-dire trois étapes à faire à la main. Il apprend
maintenant qu'un chemin existe, et lequel. Une suite le vérifie dans les deux
sens : la phrase cite `RechercherChantier`, et ne dit plus « contexte courant ».

### Le contrôle qui empêche de casser l'usage courant

Un cas éprouve que **le chantier ouvert reste le défaut**. Sans lui, tout le
reste serait vert avec des outils qui EXIGERAIENT désormais un identifiant :
l'assistant ouvert sur une fiche cesserait de répondre, et c'est le parcours le
plus fréquent.

### La description compte autant que le code

Les libellés que le modèle lit disaient « pour le chantier courant ». Les
laisser tels quels, c'était brancher une capacité que rien ne lui annonçait —
il ne se serait jamais servi du champ. Ils disent désormais : *sans chantierId,
celui qui est ouvert ; sinon, celui que RechercherChantier a rendu.*

---
---
## 186. Face ID était muet chez lui : Atlas se nommait « localhost »

**Sa capture du 26 août 2026 :** *« le Face ID ne fonctionne pas »* — l'écran
Réglages › Connexion portait un bandeau rouge, et sa barre d'adresse
`…-3000.app.github.dev`.

### La cause, et c'est la MÊME que celle du §177

Une clé WebAuthn est attachée à un domaine, et ne s'ouvre que là. Atlas doit
donc dire au téléphone sous quel domaine il enregistre — le `rpId`. Il le
déduisait de l'en-tête `Host`.

Or derrière la redirection de port de son espace de travail, **le serveur ne
reçoit que `localhost:3000`** : aucun en-tête ne porte l'adresse publique. Atlas
demandait donc une clé pour « localhost » à une page servie depuis
`…app.github.dev`, et le navigateur refusait — à juste titre.

| Source | Ce qu'elle vaut chez lui |
|---|---|
| `ATLAS_RP_ID` | non posée — elle n'a de sens qu'en production |
| `x-forwarded-host` / `host` | **`localhost`** |
| `window.location.origin` | **l'adresse par laquelle il a ouvert Atlas** |

C'est la troisième fois que ce tunnel coûte un défaut (§169, §177) ; c'est la
première fois qu'il coûte une fonctionnalité entière.

### Ce qui a été ajouté, et les deux bornes qui l'encadrent

L'écran transmet `window.location.origin` **dans le geste** — jamais pendant le
rendu, ce que §68 et §81 interdisent. La règle pure décide, et elle ne suit le
navigateur que dans un seul cas :

| | |
|---|---|
| en production | `ATLAS_RP_ID` commande ; rien de ce que le client envoie ne le déplace |
| hors production, en-tête déjà public | l'en-tête garde la main — le navigateur n'est qu'un filet |
| hors production, en-tête **local** | l'adresse du navigateur fait foi |

Et elle est filtrée : une adresse en clair, locale, ou illisible est ignorée
plutôt que suivie — le navigateur refuserait ensuite, sans un mot.

**Pourquoi ce n'est pas un affaiblissement.** Là où l'adresse du navigateur est
suivie, la seule autre source est l'en-tête `Host` — écrit lui aussi par le
client. On ne remplace pas une source sûre par une source faible : on remplace
une source faible et fausse par une source faible et juste. En production, où
la question devient une question de sécurité, rien n'a bougé.

### Le défi retient SON origine

L'enregistrement se fait en deux requêtes : le défi, puis la vérification. La
seconde recalculait l'origine — donc pouvait vérifier sous un domaine différent
de celui qui a servi à fabriquer la clé. Le cookie du défi (`httpOnly`, non
modifiable depuis la page) porte désormais l'origine avec lui, et c'est elle qui
sert à vérifier.

### Deux défauts trouvés en RENDANT LA PANNE BAVARDE

`AGENTS.md` demande de faire parler un défaut muet avant de le corriger. Le
journal posé sur les deux écrans a rendu deux choses qu'aucun test ne voyait :

1. **Le message des Réglages était le mauvais.** Il disait *« Entrez votre mot
   de passe »* — sur un écran où l'on est déjà entré, donc un geste impossible.
   `messageRefusCle("panne-activation")` existait pour exactement ce cas, et
   n'était pas employé.
2. **La porte prenait une RÉUSSITE pour une panne.** Une action serveur qui
   redirige le fait en levant ; cette levée tombait dans le `catch` de
   `LigneFaceId`, qui affichait « Face ID n'a pas pu aboutir » **au moment même
   où l'on entrait**. La navigation ayant lieu quand même, aucune suite ne
   pouvait le voir : il a fallu écouter la console de la page, ce que la suite
   fait maintenant.

### Ce qui est éprouvé ici, et ce qui ne peut pas l'être

| | |
|---|---|
| la règle du domaine, tous les cas y compris le tunnel | `scripts/test-origine-webauthn.ts` — vu rouge contre le défaut |
| le parcours entier, enregistrer puis ouvrir | `scripts/test-face-id-e2e.ts` |
| **que Face ID s'ouvre sur SON iPhone, derrière SON tunnel** | **impossible ici** — aucun visage, aucun tunnel |

Le dernier point se vérifie chez lui, et nulle part ailleurs.

---

## 187. « Changer mon mot de passe » a rejoint ses propres champs

**Sa demande du 26 août 2026, dans le même message :** *« le bouton changer mon
mdp doit se trouver au-dessus de ouvrir avec Face ID »*.

Il vivait sur une barre **fixe**, en bas de l'écran. Entre ses trois champs et
lui s'intercalaient deux rubriques — Face ID, puis « Ailleurs » —, et il restait
affiché pendant qu'on réglait Face ID : à cet endroit, il ne se lisait plus
comme le bouton du mot de passe mais comme celui de l'écran entier.

Sous ses champs, l'ambiguïté n'existe plus. Le talon de la page passe de `pb-40`
à `pb-24` : il n'a plus que les onglets à loger.

**Le contrôle mesure DEUX ORDONNÉES, il ne lit aucun libellé** (`CLAUDE.md`
§5 bis) : le jour où l'un des deux textes change, il défendra encore l'ordre.
Il refuse de conclure sur une boîte de zéro pixel — sans quoi une page non mise
en page rendrait « 0 < 0 », c'est-à-dire un vert qui ne prouve rien
(`CLAUDE.md` §5).

---

## 188. Le numéro de ses documents : un format choisi, et un millésime qui n'est plus écrit en dur

**Sa demande du 26 août 2026**, capture d'une autre application à l'appui :
*« dans la catégorie facture il faut rajouter le format de numéro, c'est
obligatoire il me semble »*. Puis, devant la planche
`appli/format-de-numero.html` : *« garde le F »*, *« 6 chiffres »*, *« oui
remettre à 0 chaque début d'année »*, et enfin *« l'utilisateur peut choisir
entre ces 5 façons ? Si oui code ça »*.

### Ce qui est obligatoire, et ce qui ne l'est pas

Il le disait avec un doute — *« il me semble »* — et il avait raison à moitié.
Ce que la loi exige d'une facture, c'est un numéro pris dans une **suite
chronologique, sans trou ni doublon**. **Aucun format particulier n'est
imposé.** Atlas tenait déjà la suite : un compteur atomique par entreprise,
posé en base, incrémenté dans la transaction qui crée le document. Ce qui
manquait, c'était le choix de l'habillage — et, sous cet habillage, un défaut.

### CE QUI ÉTAIT CASSÉ, et qu'aucune suite ne voyait

Le millésime était **écrit en dur** :

| Fichier | Ce qu'il écrivait |
|---|---|
| `src/server/repositories/devis.ts` | `` `2026-${…}` `` |
| `src/server/repositories/factures.ts` | `` `F2026-${…}` `` |

**En janvier 2027, ses factures auraient encore dit 2026.** Un défaut à
retardement : aucune suite ne pouvait le voir, puisqu'elles tournent
aujourd'hui et qu'aujourd'hui la constante tombe juste. Il ne serait apparu
qu'au premier document de l'année suivante — c'est-à-dire chez son client, sur
une facture qu'on ne réémet pas.

C'est le même piège que la portée d'arroseur supposée (§4 ter de `CLAUDE.md`) :
une valeur plausible, jamais confrontée, qui ne se démentira qu'une fois posée.

### La remise à zéro est ATOMIQUE, et elle ne s'écrit pas en deux temps

Sa décision — *« oui remettre à 0 chaque début d'année »* — se joue dans le même
`UPDATE … RETURNING` que l'incrément, jamais dans un `if` au-dessus :

```sql
UPDATE entreprise_compteurs
SET prochain_numero_facture = CASE
      WHEN <remise> AND annee_facture IS DISTINCT FROM <annee> THEN 2
      ELSE prochain_numero_facture + 1
    END,
    annee_facture = <annee>
WHERE entreprise_id = …
RETURNING prochain_numero_facture - 1 AS numero
```

**Lire l'année, décider, puis écrire** aurait ouvert exactement la fenêtre que
le compteur atomique existait pour fermer : deux factures émises à la même
seconde le 1ᵉʳ janvier auraient toutes deux lu « année différente », toutes deux
remis le compteur à 1, et **porté le même numéro**. Un doublon dans la suite est
précisément ce que la loi interdit. La colonne `annee_devis` / `annee_facture`
est là pour ça, et pour rien d'autre.

### La règle qui repart n'est PAS un réglage à part

`repartChaqueAnnee(clef)` se **déduit** du format et ne s'expose jamais comme un
second interrupteur. Sur « une suite sans année », cocher « repartir chaque
année » ferait succéder `0148` à `0147` puis repartir à `0001` : deux documents
du même numéro à un an d'écart. Un réglage qu'on peut poser dans un état
interdit finit toujours par y être posé.

L'écran **dit** la conséquence (`data-atlas="format-consequence"`) au lieu de la
proposer.

### Une seule fonction écrit le numéro, pour l'écran comme pour la base

`ecrireNumero(clef, genre, {annee, mois, numero})` sert l'aperçu des réglages
**et** le numéro réellement attribué. Deux écritures d'une même règle finissent
par diverger (`CLAUDE.md` §3), et ici la divergence serait invisible : l'écran
montrerait fièrement `2026-08-012` pendant que le client recevrait `2026-0148`.

**Et l'exemple de l'écran prend son année à l'horloge**, jamais un millésime
tapé à la main — refaire à l'écran la faute qu'on vient de corriger dans le
dépôt aurait été le comble. `test-format-numero-e2e.ts` l'exige.

### Ce qui a coûté deux faux verts, et qui n'est pas dans le produit

Le compteur se vieillit pour éprouver le 1ᵉʳ janvier. Deux versions de ce
vieillissement ont rendu un vert qui ne prouvait rien :

| Version | Ce qui se passait |
|---|---|
| `pool.query` sous `atlas_app` | la RLS bloquait l'`UPDATE`, `rowCount` valait 0, **sans erreur** |
| `pool.query` sous `atlas_owner` | bloqué aussi — `FORCE ROW LEVEL SECURITY` s'applique **au propriétaire** |

Trois cas rougissaient en accusant le produit, qui était juste. Corrigé en
jouant l'`UPDATE` dans `withEntreprise` **et en exigeant `rowCount === 1`** :
un contrôle qui ne peut pas mesurer doit refuser de conclure, jamais rendre un
vert (`CLAUDE.md` §5).

### Un contrôle qui épinglait l'ancien format, et ce qu'il a appris

`test-facture-au-client-e2e.ts` exigeait que le PDF téléchargé s'appelle
`F\d{4}-\d{4}.pdf`. Le format choisi passé à six chiffres, il a rougi — sur du
code juste, pour un réglage exaucé. C'est `CLAUDE.md` §5 bis mot pour mot : on
adapte le contrôle, on ne remet pas ce que le patron a fait changer.

**Et l'on vise plus profond que la forme.** Ce qui compte n'a jamais été le
nombre de chiffres : c'est qu'il retrouve SA facture dans son dossier de
téléchargements. Le contrôle compare donc le nom du fichier au
`numero_commercial` **relu en base**. Il survivra au prochain format, et il
attrape en plus ce que la regex laissait passer — un nom qui aurait la bonne
forme et le mauvais numéro.

### Ce que le format ne fait pas

Il ne renumérote **rien**. Les documents déjà émis gardent leur numéro — les
réécrire creuserait un trou dans la suite, ce que la loi interdit — et l'écran
le dit en une phrase. La suite reprend là où elle en était, dans le nouvel
habillage.

## 189. L'agent : dix gestes de plus, un périmètre fermé, et toujours son doigt

**Ses deux demandes du 26 août 2026**, dans le même message : *« je veux que ce
soit un vrai agent IA avec toutes les capacités possibles et imaginables sur
l'appli »*, et — *« seulement pour l'appli : si on lui demande est-ce que le CGR
de Mantes est ouvert, il ne doit pas y répondre »*.

**Et sa réponse à la seule question que je lui ai posée** : rien en direct.
*« Je pense qu'il ne doit pas pouvoir le faire. Très important que ça reste le
doigt du patron. »* Tout ce qui suit est donc une PROPOSITION, cochée et
confirmée — sans exception, y compris pour un numéro de téléphone.

### Ce qu'il savait faire, et ce qui manquait

Il lisait beaucoup et n'agissait qu'ici : prestations, matériel, durée, équipe,
lignes de prix — **et toujours sur le chantier ouvert**, le seul qu'il connût.
S'ajoutent dix gestes et trois lectures :

| Lire | Faire (proposé) |
|---|---|
| `RechercherChantier` — par nom de client ou de chantier | créer un chantier, corriger son adresse, y laisser une note |
| `LireClients` — avec l'identifiant | corriger une fiche client |
| `LirePlanning` — le posé ET ce qui attend un jour | poser, déplacer, retirer du planning |
| (`LireTarifs`, déjà là) | créer et corriger un tarif ; préparer une facture |

**On vise par IDENTIFIANT, jamais par nom** — deux clients peuvent s'appeler
Martin, et corriger le téléphone du mauvais, c'est un devis qui part chez
quelqu'un d'autre. D'où les trois lectures : elles existent pour rendre l'id.

**Chaque geste relit sa cible en base au moment d'ÉCRIRE**, pas au moment de
proposer. Entre la proposition et son doigt, le chantier a pu disparaître ;
l'écrire quand même serait une erreur silencieuse. Un client effacé, un tarif
supprimé, un chantier d'une autre société : le même conflit, en français.

### Une proposition peut ne concerner AUCUN chantier (migration 0067)

`propositions_ia.chantier_id` était obligatoire — normal quand tout geste visait
le chantier ouvert. Créer un chantier n'en a pas encore ; régler un tarif n'en
concerne aucun. La colonne est donc nullable, et la réclamation compare avec
**`IS NOT DISTINCT FROM`** : écrite avec `=`, elle n'aurait jamais retrouvé une
proposition à `NULL` — `NULL = NULL` est faux — et le geste aurait été
« introuvable » sans que rien ne dise pourquoi.

**Ce que ça n'ouvre pas** : c'est `entreprise_id` que la RLS regarde, et il
reste obligatoire.

### Le périmètre : DEUX verrous, parce qu'une consigne ne se vérifie pas

La consigne du service dit au modèle de s'en tenir à Atlas. Nécessaire, et
insuffisant : une consigne se contourne, change avec le fournisseur, et surtout
**ne s'éprouve pas**. `src/lib/perimetre-assistant.ts` décide donc du refus
**avant** que le modèle soit appelé — gratuit, identique quel que soit le
fournisseur, et éprouvable sans clé.

**Il ne refuse que si les DEUX sont vraies** : la question porte une marque
franche du dehors (cinéma, météo, recette, capitale…) **et** aucun mot d'Atlas.
C'est là qu'est tout l'art : refuser sur le seul mot « cinéma » ferait taire
l'assistant devant *« j'ai un chantier au cinéma de Mantes »* — une vraie
question. Et un garde-fou qui parle à tort s'apprend à être ignoré : on perd
alors le garde-fou entier.

Les mots ambigus sont dehors de la liste, délibérément : « ouvert », « horaire »
et surtout **« temps »**, qui dit aussi le temps PASSÉ sur un chantier. La météo
s'attrape par des tournures entières — « quel temps fait-il » —, jamais par ce
mot seul.

**Le doute profite à la question** : elle part au modèle, qui a la consigne. Ce
filtre attrape le cas franc — le sien —, pas la totalité, et c'est assumé.

**La suite éprouve les DEUX moitiés**, et la seconde compte davantage : douze
questions qui doivent passer, dont *« combien de temps a pris le chantier »*,
*« la facture de l'hôtel des Voyageurs »*, *« j'ai un chantier au cinéma de
Mantes »*. Une suite qui n'éprouverait que le refus laisserait passer un filtre
qui refuse tout — et on ne s'en apercevrait qu'à l'usage.

### Trois gestes ne sont jamais les siens

**Envoyer** un devis ou une facture, **valider** un devis, **émettre** une
facture. `preparer_facture` s'arrête au brouillon : la facture existe, elle n'est
pas partie. C'est la règle de toujours (§4 de `CLAUDE.md`), et il l'a
reconfirmée le 26 août. Un devis parti chez un client ne se rattrape pas.

### L'assistant ouvert aux commerciaux le matin, refermé le midi

**Deux paroles opposées, le même jour, à deux sessions différentes.** À moi,
sur la question du périmètre : *« oui tu peux l'ouvrir aux commerciaux »*. À une
autre, quelques heures plus tard, en majuscules : **« LES SALARIÉS ET
COMMERCIAUX NE DOIVENT PAS AVOIR ACCÈS À L'ASSISTANT IA »**.

**C'est la seconde qui vaut** — la dernière, la plus nette, et celle qui est sur
`main`. Écrit ici pour que personne ne la rouvre en croyant retrouver un oubli.

**Et la règle n'appelle plus `peutVoirLesMontants`**, ce qui est le vrai point :
un commercial voit les prix écran par écran sans avoir l'assistant. Les faire
suivre l'une l'autre rouvrirait l'assistant en silence le jour où l'on
élargirait les montants — une porte qu'on ne verrait pas s'ouvrir.

### Deux sessions, le même jour, sur le même agent

**§183, §184 et §185 sont d'une autre session**, écrits le 25 août pendant que
celui-ci se montait. Les deux se sont rencontrés à la fusion, et il fallait
trancher plutôt que garder deux façons de faire (`CLAUDE.md` §3) :

| | Ce qui a été gardé |
|---|---|
| `RechercherChantier` | **leur version** — elle emploie `recherche-client.ts`, la règle de l'ÉCRAN : accents, casse, mots dans le désordre. La mienne comparait à la main |
| `chantier-vise.ts` | **leur version** — une règle partagée, là où j'avais mis la même logique dans chaque geste |
| `CreerChantier` (outil qui ÉCRIT) | **refermé**, sur sa réponse du 26 août — devenu la proposition `creer_chantier` |
| les deux règles de leur outil | **reprises telles quelles** : un chantier ne se baptise pas, un doublon ne se crée pas en silence |

**Ce qui aurait été perdu sans y regarder :** en changeant de mécanique, le nom
du chantier serait redevenu ce que le modèle écrit, et un second jardin se
serait ouvert au même nom sans un mot. Leur suite les défendait ; elle a été
adaptée au geste proposé, pas supprimée (`CLAUDE.md` §5 bis).

### Ce que la capture a trouvé, et aucun test

Depuis l'accueil, *« crée un chantier pour Madame Lucie »* répondait **« Aucun
chantier dans le contexte courant »** — un message technique, et faux : créer un
chantier ne demande justement aucun chantier ouvert. Le refus datait de l'époque
où tout geste en visait un ; il survivait à la migration 0067.

**Aucune suite ne le voyait**, parce que toutes posaient leurs questions depuis
un chantier. C'est la sixième fois dans ce dépôt qu'un défaut sort d'une image et
d'aucun test. Le même appui rendait d'ailleurs le bouton « Appliquer » inerte
côté écran — un bouton qui s'enfonce sans rien faire se lit comme une panne.

---

## 190. « Mon compte » : quarante mots de moins, et rien de perdu

**Ses quatre demandes du 26 août 2026, sur capture :** *« supprime la phrase
sous enregistrer »*, *« supprime ce compte sous compte démo »*, et — pour les
deux lignes grises sous Nom et E-mail — *« elles me semblent inutiles, qu'en
penses-tu ? Si tu es d'accord on les supprime, sinon il faut les raccourcir,
elles sont beaucoup beaucoup trop longues pour rien »*.

### Ce qui est parti, et ce qui reste

| Ligne | Verdict |
|---|---|
| « Ce compte », sous son nom | **partie** — l'écran s'appelle « Mon compte » |
| « Ce nom ne part pas chez le client… » | **partie** — et elle se lisait de travers : « c'est celui de votre entreprise » se comprend à l'envers en diagonale |
| « C'est aussi l'identifiant… il ne se change pas encore… » (40 mots) | **raccourcie à 7** : « Sert aussi à vous connecter. Pas encore modifiable. » |
| « Pas de téléphone ici, et c'est voulu… » (4 lignes) | **partie** |

### Pourquoi la ligne de l'e-mail n'a PAS été supprimée

C'est le seul désaccord, et il tient en une phrase : **un champ qui ne s'ouvre
pas quand on le touche se lit comme une panne.** Sans cette ligne, il appuierait,
rien ne se passerait, et il chercherait ce qu'il a mal fait — exactement le
genre de silence que ce dépôt paie cher.

Ce qui a été retiré, c'est le POURQUOI : rien ne permettrait de vérifier une
nouvelle adresse, et une faute de frappe fermerait le compte pour de bon. Cela
reste vrai, et c'est ici que ça vit, pas sous ses yeux.

### La décision du téléphone n'a pas bougé, seule son explication est partie

Le paragraphe disait pourquoi il n'y a pas de champ téléphone — sa réponse « A »
du 14 août. Il vivait **sous le bouton**, donc à moitié caché par la barre
d'enregistrement : une explication qu'on ne lit pas ne protège de rien.

**Aucun champ téléphone ici**, et `test-compte-connexion-e2e.ts` le refuse
toujours. Le contrôle qui réclamait la PHRASE, lui, aurait rougi sur du code
juste pour une demande exaucée (`CLAUDE.md` §5 bis) : il refuse désormais
qu'elle revienne, au lieu de l'exiger. Trois libellés retirés sont gardés de la
même façon.

---

## 191. Un choix fait par erreur doit pouvoir se défaire

**Sa demande du 26 août 2026**, capture de la page que reçoit son client à
l'appui : *« si par erreur j'ai sélectionné un des 3 champs je ne peux plus le
désélectionner ! Faut corriger ça, je dois pouvoir désélectionner. »*

**Ce n'était pas un défaut du produit, c'était le navigateur.** Un bouton radio
ne se décoche pas : par construction, il ne connaît que « passer de l'un à
l'autre ». Le client qui touchait la mauvaise ligne restait donc engagé sur une
date qu'il n'avait pas choisie, sans aucun moyen de revenir en arrière — et
cette date est celle où l'artisan se déplace.

### Pourquoi `onClick`, et pas `onChange`

| L'appui | `onChange` | `onClick` |
|---|---|---|
| sur une ligne neuve | part | part |
| sur la ligne DÉJÀ cochée | **ne part jamais** | part |

Le navigateur ne signale un changement que s'il y en a un ; c'est précisément le
cas qu'on doit attraper. `onClick` est donc le seul geste qui existe ici.

### Et la comparaison tient sans drapeau

React ne repeint pas entre deux gestionnaires d'un même événement : à l'entrée
de `onClick`, l'état porte encore la valeur **d'avant** l'appui.

- ligne neuve : elle diffère de l'état → on ne défait rien, `onChange` choisit ;
- ligne déjà cochée : elle est égale → on vide, et `onChange` ne partira pas.

Les deux cas passent par la même ligne. Un drapeau « je viens de cocher » aurait
survécu à un rendu et défait le choix suivant.

Le clavier continue de passer par `onChange` : les flèches changent de ligne
sans jamais rien défaire, ce qui est le comportement attendu d'un groupe radio.

### Ce que le contrôle garde, et ce qu'il empêche

`scripts/test-devis-client-e2e.ts`, cas « UN CHOIX FAIT PAR ERREUR SE DÉFAIT ».
Vu rouge contre la version d'avant, sur l'assertion attendue.

Il tient quatre choses, et la deuxième est la plus importante :

1. le second appui défait, et **rien ne se coche à la place** ;
2. **un appui sur une AUTRE ligne choisit toujours** — « défaire à chaque
   appui » passerait le point 1 et rendrait le formulaire inutilisable ;
3. la case de rétractation **s'en va avec la date qui l'a fait naître** : sans
   cela, l'écran garderait une autorisation légale de démarrage anticipé
   rattachée à une date effacée ;
4. « une autre date » se défait pareil, et **referme son calendrier**.

### Ce qui n'a pas bougé, et qui est déjà tenu

Le serveur refusait déjà une acceptation sans date (`date_manquante`,
`repondreAction`) : tout défaire puis appuyer sur « J'accepte ce devis » rend
un message clair, pas un enregistrement muet. La règle n'existe qu'à un endroit.

**Le même piège dort ailleurs**, sur le choix entre deux tarifs ambigus
(`PropositionPrixSection.tsx`). Il ne l'a pas signalé et l'enjeu y est moindre —
il peut toucher l'autre tarif —, mais c'est le même `type="radio"` et le même
appui sans retour possible. Noté dans `TODO.md`.

---

## 192. Un seul nombre faisait deux métiers : les salariés se comptent à part des équipes

**Sa demande du 26 août 2026, éprouvée sur la planche 97
(`appli/salaries-et-equipes.html`) avant d'être codée — il a répondu **A** :**

> *« Il faut avoir un curseur + ou − qui définit le nombre de salariés que
> possède l'entreprise et pouvoir affilier des noms. Ceux-là permettront
> d'ajouter ces noms au chantier, et plus les équipes A ou B. Néanmoins les
> équipes doivent toujours servir à définir le niveau de remplissage du
> planning : 2 équipes = 2 chantiers par jour, comme avant, ça ne bouge pas. »*

Puis, en tranchant :

> *« Il ne faut pas changer la méthode d'affiliation des gars sur les
> chantiers — juste, au lieu que ce soit les équipes, ce sera les noms qu'on
> affilie. On garde la même façon de faire. »*

### Ce que `nombre_equipes` faisait de trop

Un seul chiffre portait deux responsabilités sans rapport :

| | Ce qu'il décidait |
|---|---|
| **la capacité** | combien de chantiers tiennent dans une journée |
| **les gens** | combien de noms se règlent, et se cochent sur une demi-journée |

Régler l'un déréglait donc l'autre, en silence. Monter la capacité à trois
faisait apparaître une « Équipe C » que personne n'employait ; et un paysagiste
à quatre salariés qui ne mène qu'un chantier à la fois n'avait **aucun moyen de
le dire** — il devait choisir entre nommer ses gars et dire la vérité sur son
planning.

`entreprises.nombre_salaries` (migration 0067) porte désormais le second métier.
`nombre_equipes` garde le premier, et rien de plus.

### Ce qui N'A PAS bougé, parce qu'il l'a interdit

La façon d'affilier quelqu'un à un chantier est **exactement** celle d'avant :
la pastille sur la demi-journée, la liste qui s'ouvre, les cases qu'on coche
une à une, « Terminé ». Même action serveur, même table
(`equipes_du_chantier`), même indépendance matin / après-midi (migration 0058).
Seuls les libellés changent.

**Aucune table n'a été créée.** Ouvrir une table `salaries` aurait fabriqué une
seconde liste de gens à côté de celle qui existe — deux vérités sur qui
travaille dans l'entreprise (`CLAUDE.md` §3). La table `equipes` porte déjà un
rang, un nom facultatif, et c'est elle que `equipes_du_chantier` relie à une
demi-journée : **ces lignes ont toujours été les gars**, puisqu'il y écrit des
prénoms depuis le 10 août 2026.

⚠ **La dette de nommage est assumée et écrite** : la table s'appelle encore
`equipes` alors qu'elle porte les salariés. Le renommage touche vingt-trois
fichiers de `src/`, les politiques RLS et les contraintes ; le mêler à un
changement de comportement aurait mis en risque une application qu'il utilise
tous les jours (sa consigne du 24 août : *« ne fais rien qui peut endommager
l'appli »*). C'est une tâche à part, dans `TODO.md`.

### « Équipe A » a disparu du vocabulaire, et le repli est le rang

Sa demande est explicite — *« et plus les équipes A ou B »*. `libelleEquipe` est
devenue `libelleSalarie` : le nom écrit, sinon **« Salarié 3 »**.

**Le repli EXISTE, et ce n'est pas du confort.** Le supprimer — c'est-à-dire ne
montrer que les gens nommés, comme la proposition C de la planche — ferait
disparaître les cases à cocher de tous ceux qui n'ont pas encore tapé les
prénoms de leurs gars : leurs chantiers deviendraient du jour au lendemain
impossibles à attribuer, sans un mot pour le dire.

`LETTRES_EQUIPES` et `lettreDeRepli` ont été **retirées** : garder de quoi
écrire « Équipe A » invitait à le refaire.

### LE POINT DÉLICAT : la charge d'une demi-journée

C'est le seul endroit où les deux nombres se rencontrent, et c'est là que se
joue le « ça ne bouge pas ».

Avant la coupure, l'écran cochait des ÉQUIPES : leur nombre ÉTAIT la charge, et
il ne pouvait pas dépasser la capacité — il n'existait pas plus de cases que
d'équipes. Maintenant qu'on coche des GENS, les deux se décollent : trois gars
dans une entreprise à deux chantiers par jour, c'est possible.

`equipesMobilisees(salariesCoches, nombreEquipes)` plafonne donc le compte à la
capacité, plancher à un. **Le plafond n'est pas un ajustement, c'est ce qui
évite la régression :** sans lui, un chantier à trois gars fermerait à lui seul
une journée qui en accepte deux, et l'écran d'envoi refuserait au client des
jours réellement libres.

**Et à effectif égal, le résultat est identique à celui d'avant** — ce qui est
exactement le cas de son entreprise, dont le compteur de salariés a été repris
du nombre d'équipes par la migration. Sa correction du 22 août 2026 tient donc
toujours : Julien ET Antoine chez Mr Eric ferment bien la demi-journée.

**La même fonction sert à l'écran et au serveur.** `compterOccupation` la
traverse désormais, et **son paramètre `nombreEquipes` est OBLIGATOIRE à
dessein** : avec une valeur par défaut, un appelant oublié aurait continué de
compter sans plafond, en silence — le planning plafonnant la charge et l'écran
d'envoi non, si bien qu'un jour annoncé libre au patron aurait été refusé au
client trois secondes plus tard (`CLAUDE.md` §3). Le compilateur a désigné les
quatre appelants, plutôt que la production.

### Le plancher est ZÉRO, et c'est ce qui distingue les deux compteurs

Un artisan seul n'a **aucun** salarié — ce n'est pas un défaut de saisie. Lui
proposer une ligne « Salarié 1 » l'inviterait à se nommer lui-même, et ferait
apparaître une case à cocher sur chacune de ses demi-journées.

La migration en tient compte dans sa reprise : `nombre_equipes = 1` sans nom
écrit devient **zéro salarié**, et non un. Sans cette ligne, tous les artisans
seuls auraient vu apparaître du jour au lendemain une organisation qu'ils n'ont
pas.

### Ce que les contrôles défendent

| Où | Ce qui rougirait |
|---|---|
| `scripts/test-equipes.ts` | le repli qui réécrirait « Équipe », le plancher remonté à un, le plafond retiré |
| `scripts/test-creneaux.ts` | trois gars sur un chantier qui fermeraient une journée à deux places |
| `scripts/test-equipes-repo.ts` | un nom perdu en redescendant le compteur |

**Confrontés à l'état dégradé** (`CLAUDE.md` §5) : plafond retiré de
`equipesMobilisees`, les deux premières suites rougissent — et sur la bonne
ligne, pas sur un effet de bord trois écrans plus loin.

---

## 193. « Rien ne se passe » : `force-dynamic` ne fait pas partir la demande

**Sa plainte du 26 août 2026 :** *« quand je change entre tous les mois et tous
les trois mois, c'est pareil, rien ne se passe »*. Il avait raison, et le défaut
était réel : sur l'écran de TVA, basculer le rythme laissait « Août 2026 » sous
ses yeux au lieu d'afficher le trimestre.

### Ce qui marchait, et ce qui ne marchait pas

| | |
|---|---|
| la base | **écrite** — le réglage revenait au rechargement suivant |
| le calcul | **juste** — `test-periode-tva.ts` était vert, et le reste |
| l'écran | **figé** sur la période d'avant |

### Le piège, et il est contre-intuitif

`src/app/termines/tva/page.tsx` porte `export const dynamic = "force-dynamic"`.
On lit cette ligne comme « cette page est toujours fraîche » — elle ne dit rien
de tel. Elle commande au **serveur** de recalculer à chaque demande ; encore
faut-il **qu'une demande parte**. Le routeur du navigateur garde sa propre copie
de `/termines/tva`, et sans revalidation il la reservait sans appeler personne.

`revalidatePath` n'est donc pas une précaution de fin de fonction ici : c'est la
moitié du geste. Le voisin immédiat le faisait déjà — `reglerExigibiliteAction`,
écrite le même mois pour le régime de TVA, appelle `revalidatePath` ; celle de la
périodicité, plus ancienne, ne l'avait jamais fait.

### Pourquoi AUCUN contrôle ne le voyait

`test-periodicite-tva-e2e.ts` couvrait pourtant le rythme depuis le 12 août, et
il était vert. Son `choisir()` passe par **Réglages**, puis rouvre le relevé par
une navigation neuve — et **une page rouverte est toujours juste**.

Lui bascule depuis l'écran de TVA, sans le quitter. C'est sa **séquence** qu'il
fallait rejouer, pas son geste (`AGENTS.md`) — la même leçon que la page vieillie
du 12 août, sur un autre mécanisme.

Le cas ajouté ne recharge rien : il touche les deux mots soulignés du haut,
attend que le titre change, et refait le chemin en sens inverse — une correction
qui ne fonctionnerait que dans un sens laisserait la moitié du défaut. Vu rouge
sur « l'écran dit toujours "Août 2026" » avant d'être vert.

### Ce qui n'était PAS un défaut, et qu'il a signalé le même soir

*« Et lorsque je change entre les deux régimes, rien ne se passe, c'est
normal ? »* — **oui.** Quand toutes les factures d'un mois ont été payées dans
le mois, encaissements et débits tombent sur le même chiffre : c'est le calcul,
pas le cache. Ce qui manque là est une **phrase** qui le dise, et elle est en
maquette (`appli/quand-je-reverse-la-tva.html`), pas un correctif.

Les deux plaintes se ressemblaient mot pour mot ; une seule était un bogue. Les
séparer a demandé de rejouer chacune plutôt que de traiter la seconde comme la
première.

---
## 194. L'écran d'envoi du devis perd trois phrases, et n'apprend rien de moins

**Ses trois demandes du 26 août 2026, capture à l'appui :** *« supprime la
phrase par SMS au + repris de votre dictée + le client pourra aussi en proposer
une »*.

### Ce qui part, et ce que ça coûte

| Phrase | Ce qu'elle disait | Ce qui la remplace |
|---|---|---|
| « Par SMS au 0679984514 » | le canal et le destinataire | **rien** — sa messagerie les lui montre juste après |
| « Repris de votre dictée. Corrigez-le si besoin… » | que la molette se tourne | la molette |
| « Le client pourra aussi en proposer une autre… » | ce que l'interrupteur d'à côté dit déjà | l'interrupteur, et son sous-titre |

**Le seul vrai coût est le premier**, et c'est un arbitrage qu'il a déjà rendu :
le 24 août, sur l'écran de la facture, il a fait retirer le destinataire pour la
même raison (`TransmettreLaFacture`). Il ne voit plus à qui le devis part avant
d'ouvrir sa messagerie — laquelle le lui montre, et où il peut encore reculer :
**rien n'est envoyé par Atlas**.

### Les phrases sœurs partent avec elles, et c'est délibéré

Chacune de ces lignes avait des variantes qui ne se montraient que dans
d'autres états — deux dates plutôt qu'une, interrupteur fermé, durée saisie à
la main. Les laisser, c'était les lui faire découvrir demain et payer le même
aller-retour. Une seule survit, parce qu'elle APPREND quelque chose :
« 4 jours ouvrés d'affilée seront réservés à partir de la date retenue » — un
chantier long bloque le planning, et rien d'autre ne le dit.

### Trois contrôles visaient les libellés ; ils visent maintenant la règle

C'est le vrai travail de ce lot (`CLAUDE.md` §5 bis) :

| Ce qu'il lisait | Ce qu'il éprouve maintenant |
|---|---|
| « Par e-mail au dupuis@exemple.fr » | la messagerie qui s'ouvre est bien `mailto:` sur cette adresse |
| « Le client choisira entre ces deux dates » | **deux** dates sont listées à l'envoi |
| la phrase qui suivait l'interrupteur | le **sous-titre de l'interrupteur** suit l'interrupteur — et l'ancienne phrase ne revient pas |

Le premier est le plus important : il éprouve désormais le défaut du 20 août
2026 lui-même — *« j'ai choisi d'envoyer par e-mail, et c'est le SMS qui s'est
ouvert »* — au lieu d'une phrase qui l'annonçait.

---
---

## 195. « Composer ma fiche » quitte les Réglages pour Paysage

**Sa proposition du 26 août 2026**, une fois compris que les deux écrans n'en
font pas un : *« est-ce qu'on peut la déplacer dans la fiche de chantier, dans
la catégorie Paysage, sous une rubrique type "création des rubriques de ma fiche
de chantier" ? Et comme ça on ne la voit plus dans la catégorie Réglages. »*
Puis, devant les deux emplacements proposés : *« la B, mais il faut que la
rubrique se trouve sous le titre en premier, et son titre doré doit être
"composer ma fiche" ou "ma fiche perso". »*

### Ce qui a bougé

| | Avant | Après |
|---|---|---|
| l'écran | `/reglages/fiche-entretien` | `/paysage/fiche/composer` |
| son titre | « Fiche d'entretien » | « Composer ma fiche » |
| la porte | en bas de la liste des passages | **en tête**, sous le titre de l'écran |
| les Réglages | une rubrique de plus | **plus rien** |

Rien d'autre : la table `prestations_entretien`, le dépôt, les gestes, les
refus, la réserve au propriétaire — tout est déplacé tel quel. Un déplacement
qui en profite pour changer une règle est un déplacement qu'on ne peut plus
relire.

### Pourquoi il a fallu une planche AVANT

Sa première formulation était *« la fiche d'entretien c'est la fiche de
chantier »*, et il proposait de **supprimer** celle des Réglages. C'était faux
d'un cheveu, et le cheveu comptait : l'une tient LA LISTE, l'autre la fiche d'un
JOUR qui en naît. Supprimer la première aurait laissé la seconde sans rien à
cocher — elle refuse d'ailleurs de s'ouvrir sur une liste vide
(`passages-entretien.ts`, refus `modele_vide`).

`appli/deux-fiches.html` a montré la différence en trois onglets ; il a alors
reformulé lui-même la bonne solution — déplacer, pas supprimer. **Une planche
vaut mieux qu'un « non ».**

### La consigne qu'il a fallu RÉCRIRE, pas contourner

La porte avait été mise « en bas et permanent » le 24 août, et le fichier
portait le motif en toutes lettres : *neuf fois sur dix il vient ouvrir une
fiche, pas la recomposer*. Ce raisonnement était le nôtre ; sa place est la
sienne, et elle l'emporte. Le commentaire a donc été récrit **au moment du
déplacement** — laissé tel quel, il aurait fait redescendre la rubrique par la
prochaine session, de bonne foi, en citant un texte devenu faux. C'est
exactement la faute du trait gris (§172).

Même précaution dans `rubriques-reglages.ts` : à la place de l'entrée retirée,
un commentaire dit **pourquoi elle est partie** et interdit de la remettre — son
motif d'origine (sa demande du 16 août) reste vrai dans l'historique et suffirait
à l'y ramener.

### Ce que les contrôles tiennent maintenant

- `test-rubriques-reglages.ts` : « Fiche d'entretien » **n'est plus** dans le
  sommaire, ni pour le patron ni pour un salarié — un contrôle qui l'exigeait
  aurait rendu son écran impossible à changer (`CLAUDE.md` §5 bis).
- `test-fiche-entretien-e2e.ts` : le chemin part de la **fiche de chantier**, et
  la rubrique est **mesurée au-dessus** de « Jour du passage » — l'ordre du HTML
  ne prouve rien, une mise en page peut le renverser. Le contrôle refuse de
  conclure sur une boîte de zéro pixel, exige 44 px de haut pour le pouce, et
  **a été vu rouge** en décalant la rubrique de 900 px.
- Une capture est prise au passage : quatre défauts réels de ce dépôt sont sortis
  d'une image et d'aucun test.

### La forme a suivi, une heure plus tard

*« C'est bien mais juste une phrase, on la trouve difficilement ; je pense qu'un
onglet carré serait le mieux »*, puis *« une carte mais fais-la moins large »*.

La première version était **une ligne de texte au milieu d'un écran de texte** :
rien ne la distinguait d'un intertitre — ni fond, ni cadre, ni couleur d'action
—, et un chevron de huit pixels pour seul aveu qu'on peut appuyer. C'est une
carte depuis, **à la largeur de son texte** : pleine largeur, elle aurait fait
jeu égal avec « Ouvrir une fiche », qui est le geste de tous les jours. Le
plafond (`max-w-[270px]`) tient chez qui grossit les caractères de son
téléphone.

Trois formes lui ont été montrées avant de coder (`appli/ou-composer-ma-fiche.html`) :
la carte, deux carrés côte à côte, un bouton d'en-tête. **La place, elle, ne se
rouvrait pas** — il l'avait tranchée une heure plus tôt, et la planche le disait,
sans quoi on lui redemandait ce qu'il venait de décider.

### Un piège de charte, trouvé à l'image

Le titre demandé « doré » avait d'abord été écrit `colors.rust` — le nom promet
une terre cuite, la valeur vaut le **vert pin** depuis la reprise de la charte
d'Arborea. À l'écran, un titre presque noir. L'or de la charte est `colors.or`,
celui du surtitre juste au-dessus. Aucun test ne l'aurait vu.
