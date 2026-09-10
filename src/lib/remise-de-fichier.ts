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
 * ─── ET CE CORRECTIF-LÀ ÉTAIT FAUX : IL A RENDU LES PDF ILLISIBLES ─────────
 *
 * **Sa capture du 10 septembre 2026, deux fois :** *« j'ai essayé de télécharger
 * la facture. Une fois que je l'ouvre, page blanche »*, puis *« même problème
 * avec le devis »*. Le fichier, lui, était intact — téléchargé par la vraie
 * route et relu ici, il portait le document entier.
 *
 * Le 7 septembre, pour forcer l'enregistrement, cette fonction s'était mise à
 * **mentir sur le type** : `application/octet-stream` au lieu de
 * `application/pdf`. Le mensonge ne s'arrête pas à la réponse — **il colle au
 * fichier enregistré**. iOS retient le type annoncé, et
 * `X-Content-Type-Options: nosniff` lui interdit ensuite de deviner qu'il tient
 * un PDF : rouvert depuis les téléchargements, le document n'a plus de lecteur.
 * Page blanche, sans le moindre message.
 *
 * **La règle qui reste : on ne ment jamais sur le type d'un fichier.** Ce qui
 * fait descendre un fichier, c'est `Content-Disposition: attachment` — la
 * norme, et rien d'autre. Un type générique n'est pas un levier de plus : c'est
 * une identité qu'on retire au document, et elle lui manque plus tard, ailleurs,
 * chez le client.
 *
 * *(Ce que le 7 septembre croyait savoir d'iOS était une déduction, pas un
 * relevé : elle partait du `filename` ignoré sur un `.zip` le 7 août. Un `.zip`
 * descend de toute façon, faute de lecteur — il ne prouvait rien de la
 * disposition.)*
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
 * `type` est le type RÉEL, et il est servi **dans les deux cas** : c'est la
 * disposition, seule, qui dit s'il faut ouvrir ou ranger. Un fichier rangé
 * garde ainsi son identité, et se rouvre.
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
    "Content-Type": type,
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
