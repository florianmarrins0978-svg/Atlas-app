/**
 * L'adresse d'un chantier, portée jusqu'au GPS du patron.
 *
 * **Retenu sur maquette le 12 août 2026** (`docs/maquettes/32-le-chevron.html`).
 * Sur le planning, un chevron doré au bout de chaque ligne ouvre une feuille :
 * Plans, Google Maps, Waze. Le doigt part, l'adresse est déjà posée.
 *
 * ## Laquelle est nommée « Maps » sur la feuille de chantier
 *
 * **Sa demande du 31 août 2026 : « pour Maps c'est Google Maps que je veux ».**
 * La feuille n'en porte que deux (« pas besoin d'en mettre trois », 21 août), et
 * le bouton « Maps » servait jusque-là Plans d'Apple. C'est `google` qu'il ouvre
 * désormais. `plans` reste calculée : elle ne coûte rien, et le jour où un
 * écran veut proposer les trois, elle est là — mais aucun écran ne la sert.
 *
 * ## Pourquoi des liens universels, et jamais les schémas propres
 *
 * `waze://` et `comgooglemaps://` existent, et sont plus courts. Ils ont un
 * défaut qu'on ne voit pas en les essayant sur une machine qui possède les
 * applications : **quand l'application est absente, le lien échoue en silence**.
 * Le doigt appuie, rien ne bouge, et rien ne dit pourquoi. Sur un chantier, ce
 * n'est pas un désagrément : c'est une adresse qu'on n'a plus.
 *
 * Les liens ci-dessous ouvrent l'application quand elle est installée, et son
 * site quand elle ne l'est pas. Jamais d'écran mort.
 *
 * ## Ce qu'on ne peut pas faire, et qu'il vaut mieux savoir
 *
 * Un téléphone **ne dit pas** quelles applications il possède. On ne peut donc
 * pas n'afficher que Waze parce que le patron n'a que Waze : les trois sont
 * proposées, et c'est à lui de choisir.
 *
 * ## Aucune donnée ne sort d'Atlas
 *
 * Rien n'est envoyé à Google ni à Waze depuis nos serveurs : l'adresse part
 * dans l'application que le patron touche, sur son téléphone, exactement comme
 * s'il l'avait tapée lui-même.
 */
export type LiensItineraire = {
  /** Plans (Apple) — ouvre l'application sur iPhone, le site ailleurs. */
  plans: string;
  google: string;
  waze: string;
};

/**
 * Les trois adresses de destination pour une adresse de chantier.
 *
 * Rend `null` quand il n'y a pas d'adresse — **et c'est le cœur de la règle** :
 * un chantier dicté à la va-vite n'en a pas toujours, et on n'en invente pas
 * (`CLAUDE.md` §4). L'écran lit ce `null` et éteint les trois destinations au
 * lieu de proposer un départ vers nulle part.
 */
export function liensItineraire(adresse: string | null | undefined): LiensItineraire | null {
  const propre = (adresse ?? "").trim();
  if (propre === "") return null;

  // `encodeURIComponent` et non `encodeURI` : une adresse porte des virgules,
  // des espaces et des accents (« 12 chemin des Chênes, 33600 Pessac »), et
  // `encodeURI` laisse passer la virgule — qui sépare alors deux paramètres
  // chez Waze, et tronque l'adresse au numéro de rue.
  const q = encodeURIComponent(propre);

  return {
    // `dirflg=d` demande un itinéraire EN VOITURE. Sans lui, Plans ouvre le
    // dernier mode utilisé — à pied, s'il a cherché une adresse en ville la
    // veille, et l'estimation devient absurde pour trente kilomètres.
    plans: `https://maps.apple.com/?daddr=${q}&dirflg=d`,
    // `travelmode=driving` pour la MÊME raison que `dirflg=d` chez Plans :
    // sans lui, Google Maps rouvre le dernier mode utilisé. Le piège est plus
    // vicieux ici, car ce mode se retient d'une session à l'autre — un trajet
    // cherché à pied en ville la veille, et le chantier de trente kilomètres
    // s'annonce à six heures de marche.
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`,
    // `navigate=yes` démarre la navigation au lieu de poser un point sur la
    // carte : c'est un geste de moins, et c'est ce qu'on veut à 7 h du matin.
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
  };
}

/**
 * Le lien d'appel d'un numéro, ou `null` s'il n'y en a pas.
 *
 * Les espaces et les points d'un numéro écrit à la main (« 05 56 00 00 12 »)
 * sont retirés : `tel:` les tolère, mais certains téléphones s'arrêtent au
 * premier caractère qui n'est pas un chiffre — et on compose alors « 05 ».
 */
export function lienAppel(telephone: string | null | undefined): string | null {
  const propre = (telephone ?? "").replace(/[^\d+]/g, "");
  if (propre === "") return null;
  return `tel:${propre}`;
}
