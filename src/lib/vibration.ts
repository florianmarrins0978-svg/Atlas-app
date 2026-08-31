/**
 * Le retour vibrant sous le doigt, quand le téléphone veut bien.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 31 août 2026 :** *« quand je clique sur les boutons
 * j'aimerais avoir une mini vibration, que l'utilisateur soit sûr d'avoir
 * appuyé »*, puis, après une soirée d'essais : *« code-moi la vibration sur le
 * bouton créer le devis de la première page chantier, je vais essayer »*.
 *
 * **UN SEUL ENDROIT, ET C'EST LE SUJET DE CE FICHIER.** Deux appels écrits à
 * deux endroits divergeront sur la durée, et l'un des deux oubliera le jour où
 * un réglage viendra les couper. Tout ce qui vibre dans Atlas passe par ici.
 *
 * ── CE QU'IL FAUT SAVOIR AVANT DE CROIRE QUE ÇA MARCHE ─────────────────────
 *
 * | Où | Ce qui se passe |
 * |---|---|
 * | Android, navigateur | vibre pour de bon |
 * | **iPhone, Safari** | **rien** : l'API n'existe pas — ce n'est pas un défaut d'ici |
 * | l'application emballée (`appli/CAPACITOR.md`) | `@capacitor/haptics`, retour natif et réglable |
 *
 * **Le 31 août, il a touché sur une planche un interrupteur natif d'iOS et
 * rien n'a vibré** (`ARCHITECTURE.md` §222). Cette fonction ne changera donc
 * rien sur son iPhone tant qu'Atlas est servi dans un navigateur ; elle est
 * écrite pour être déjà en place quand l'application emballée arrivera, et
 * pour qu'il puisse essayer chez lui plutôt que d'attendre notre verdict.
 *
 * **Une réserve qui n'est pas levée :** son réglage iOS « Retour haptique
 * système » n'a jamais été vérifié. Éteint, il rend tout muet — y compris
 * l'application native.
 *
 * ── POURQUOI AUCUN ÉCRAN N'ANNONCE UNE VIBRATION ───────────────────────────
 *
 * **Aucune page web ne peut savoir si le téléphone a bougé** : `vibrate()` rend
 * `true` dès que l'appel est accepté, jamais que quelque chose s'est produit.
 * Une planche a compté des « vibrations » pendant une soirée entière alors que
 * rien ne bougeait, et ce chiffre rassurant a coûté trois allers-retours. On
 * n'affiche donc jamais de compteur, de voyant ni de confirmation.
 */

/**
 * La durée du retour, en millisecondes.
 *
 * **14 ms est le réglage du milieu de sa planche** — celui appelé « le vôtre »
 * (`appli/le-bouton-qui-repond.html`), entre 8 (discret) et 22 (marqué). Il n'a
 * pas encore tranché : cette valeur est un point de départ à changer d'un
 * chiffre, pas un choix acté.
 */
export const DUREE_APPUI_MS = 14;

/**
 * Fait vibrer le téléphone, si et seulement si le navigateur sait le faire.
 *
 * **Ne lève jamais, et ne rend rien.** Un retour tactile est un agrément : il
 * ne doit sous aucun prétexte empêcher le geste qu'il accompagne. Le jour où
 * un navigateur refusera l'appel — écran verrouillé, économie d'énergie, page
 * en arrière-plan —, le devis doit se créer quand même.
 *
 * Séparée de son appelant pour être éprouvable sans navigateur : c'est
 * `scripts/test-vibration.ts` qui lui pose un faux `navigator`.
 */
export function vibrer(duree: number = DUREE_APPUI_MS): void {
  // `globalThis` plutôt que `window` : ce module est importé par des écrans
  // rendus côté serveur, où `window` n'existe pas et où le seul fait de le
  // nommer casse le rendu.
  const nav = (globalThis as { navigator?: { vibrate?: (m: number) => boolean } }).navigator;
  if (typeof nav?.vibrate !== "function") return;
  try {
    nav.vibrate(duree);
  } catch {
    // Un refus du navigateur n'est pas une panne du produit.
  }
}
