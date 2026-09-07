/**
 * Ce qu'on répond quand un fichier doit **descendre**, et non s'afficher.
 *
 * ─── LE DÉFAUT QUI A DONNÉ CE FICHIER (7 septembre 2026) ────────────────────
 *
 * Le patron, capture à l'appui, sous « Voir la facture en PDF » : *« quand je
 * clique sur télécharger ça ne la télécharge pas — un clic, une action, ça doit
 * la télécharger direct »*.
 *
 * La route répondait pourtant `Content-Disposition: attachment`, et un vrai
 * clic dans Chromium range bien le fichier (éprouvé). **Ce qui manquait, c'est
 * le TYPE.** Servi en `application/pdf`, un PDF est un document que Safari sait
 * peindre : sur iPhone, il l'ouvre dans son lecteur et n'enregistre rien. Le
 * geste paraît sans effet — il ne l'est pas, il montre au lieu de ranger.
 *
 * **Ce n'est pas une supposition sur iOS, c'est un écart déjà relevé ICI.** Le
 * 7 août 2026, `scripts/test-mes-donnees-e2e.ts` a consigné que son Safari
 * ignore le `filename` de cet en-tête (le fichier arrivait nommé « reglages »,
 * d'après la page). Un navigateur qui ne lit pas le nom de l'en-tête n'a aucune
 * raison d'en respecter la disposition. La sauvegarde, elle, descendait quand
 * même — parce qu'un `.zip` ne s'affiche pas.
 *
 * D'où la règle : **quand on télécharge, on sert `application/octet-stream`.**
 * Le navigateur n'a alors plus de lecteur à proposer, et il ne lui reste qu'à
 * enregistrer. C'est exactement ce que `src/lib/type-de-fichier.ts` dit déjà de
 * son côté : « une extension inconnue rend `application/octet-stream` : le
 * navigateur propose alors de télécharger plutôt que d'afficher ».
 *
 * `X-Content-Type-Options: nosniff` est posé pour toutes les routes
 * (`next.config.ts`) : aucun navigateur ne peut deviner le vrai type derrière
 * ce type générique, ni décider de l'afficher quand même.
 *
 * ─── POURQUOI UN SEUL ENDROIT ──────────────────────────────────────────────
 *
 * Cinq routes servaient ce même en-tête, chacune à sa façon, et elles avaient
 * déjà divergé : la lecture du paramètre (`.has("telecharger")` ici,
 * `=== "1"` là), et le nom accentué que seule la fiche de chantier savait
 * porter. Une règle écrite cinq fois se corrige une fois sur cinq
 * (`CLAUDE.md` §3).
 *
 * Éprouvé sans base ni réseau — `scripts/test-remise-de-fichier.ts`.
 */

/**
 * Le geste que l'adresse demande.
 *
 * `?telecharger=1` range le fichier ; tout le reste l'ouvre. La forme nue
 * (`?telecharger`) était acceptée par la route du devis du client et par elle
 * seule : aucun écran ne l'écrit, et deux lectures du même paramètre finissent
 * toujours par se contredire.
 */
export function veutTelecharger(url: string): boolean {
  return new URL(url).searchParams.get("telecharger") === "1";
}

/**
 * Les deux en-têtes qui décident du sort du fichier.
 *
 * `type` est le type RÉEL — celui qu'on sert quand on ouvre. Il n'est employé
 * que dans ce cas : télécharger le remplace par le type générique, pour la
 * raison dite en tête de fichier.
 */
export function enTetesDeRemise({
  telecharger,
  nom,
  type,
}: {
  telecharger: boolean;
  nom: string;
  type: string;
}): { "Content-Type": string; "Content-Disposition": string } {
  return {
    "Content-Type": telecharger ? "application/octet-stream" : type,
    "Content-Disposition": `${telecharger ? "attachment" : "inline"}; ${nomDansLEnTete(nom)}`,
  };
}

/**
 * Le nom du fichier, écrit deux fois — et c'est nécessaire.
 *
 * Un en-tête HTTP n'accepte que l'ASCII : un accent dans `filename` fait tomber
 * la réponse entière chez certains serveurs, ou arrive en charabia. `filename*`
 * porte donc le vrai nom, et `filename` sa version dégradée pour les
 * navigateurs anciens. La fiche de chantier faisait déjà cela seule dans son
 * coin ; les quatre autres routes, non.
 *
 * **Les guillemets et les retours à la ligne sont retirés, pas échappés** : un
 * nom vient parfois de ce que le patron a tapé (le nom d'un chantier), et une
 * valeur d'en-tête qui se referme trop tôt laisse écrire l'en-tête suivant.
 */
function nomDansLEnTete(nom: string): string {
  const propre = nom.replace(/[\u0000-\u001f\u007f"\\]/g, "").trim() || "fichier";
  const ascii = propre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "");
  return `filename="${ascii || "fichier"}"; filename*=UTF-8''${encodeURIComponent(propre)}`;
}
