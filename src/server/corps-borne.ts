/**
 * Lire le corps d'une requête **sans jamais dépasser une borne**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LA PROPRIÉTÉ GARANTIE :**
 *
 * > Un client, même authentifié, ne peut pas obliger Atlas à mettre en mémoire
 * > un corps arbitrairement grand avant que la limite s'applique.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE LA PILE FAIT VRAIMENT — vérifié, pas supposé (24 août 2026).**
 *
 * | Question | Réponse constatée |
 * |---|---|
 * | `serverActions.bodySizeLimit` couvre-t-il ces routes ? | **Non.** La documentation de Next dit « the request body sent to a **Server Action** ». Une *route handler* n'en voit rien |
 * | Une limite native existe-t-elle pour les *route handlers* ? | **Non.** La doc précise même qu'aucune configuration n'est nécessaire — il n'y en a aucune |
 * | Où le multipart est-il décodé ? | Dans `request.formData()`, c'est-à-dire dans `undici`, **après** que le corps a été consommé |
 * | Le flux peut-il être lu avec une borne stricte ? | **Oui**, et c'est ce que fait ce fichier |
 *
 * **Le défaut que cela répare, et pourquoi le correctif précédent ne suffisait
 * pas.** Le 24 août au matin, la route des dictées refusait sur `content-length`
 * avant d'appeler `formData()`. C'est un bon premier rempart et **ce n'est pas
 * une preuve** : cet en-tête est annoncé par le client. Le sous-déclarer — ou
 * employer `Transfer-Encoding: chunked`, qui n'en porte aucun — laissait
 * `formData()` avaler ce qu'on voulait.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **COMMENT LA BORNE TIENT, concrètement.**
 *
 * Le flux d'origine traverse un `TransformStream` qui compte les octets et
 * **casse le flux** dès que le total dépasse la limite. `formData()` ne lit
 * donc jamais que ce que ce compteur a laissé passer : au pire la limite, plus
 * le morceau en cours.
 *
 * **Il n'y a pas de double copie géante** — c'était le risque à éviter. On ne
 * rassemble pas le corps pour le mesurer puis le re-parser : on borne **en
 * passant**, et le parseur travaille sur le flux borné.
 *
 * Éprouvé pour de vrai — `scripts/test-corps-borne.ts` envoie des corps
 * au-dessus et en dessous, avec et sans `content-length` honnête.
 */

/** Ce qu'on lève quand le corps dépasse. Reconnaissable, pour répondre 413. */
export class CorpsTropGros extends Error {
  constructor() {
    super("Le corps de la requête dépasse la limite autorisée.");
    this.name = "CorpsTropGros";
  }
}

/**
 * Le flux, coupé net au-delà de la borne.
 *
 * Exporté pour être éprouvé seul : c'est la pièce qui porte la garantie, et un
 * contrôle doit pouvoir la mettre en défaut sans monter un serveur.
 */
export function fluxBorne(flux: ReadableStream<Uint8Array>, limiteOctets: number): ReadableStream<Uint8Array> {
  let vus = 0;
  return flux.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(morceau, controleur) {
        vus += morceau.byteLength;
        if (vus > limiteOctets) {
          // **On casse le flux plutôt que de tronquer.** Tronquer rendrait un
          // multipart amputé, que le parseur lirait comme un fichier valide
          // mais incomplet — un fichier corrompu rangé en silence.
          controleur.error(new CorpsTropGros());
          return;
        }
        controleur.enqueue(morceau);
      },
    })
  );
}

/**
 * Le `FormData` d'une requête, avec la garantie que le corps n'a jamais dépassé
 * la borne.
 *
 * **`content-length` reste le premier refus**, et c'est utile : il évite de
 * commencer à lire un corps qu'on sait déjà trop gros. Mais il n'est plus la
 * seule protection — c'est tout l'objet de ce fichier.
 *
 * Lève `CorpsTropGros` dans les deux cas, pour que l'appelant réponde `413`
 * sans avoir à distinguer.
 */
export async function formDataBornee(requete: Request, limiteOctets: number): Promise<FormData> {
  const annonce = Number(requete.headers.get("content-length") ?? "");
  if (Number.isFinite(annonce) && annonce > limiteOctets) throw new CorpsTropGros();

  const corps = requete.body;
  // Pas de corps du tout : `formData()` rendra son propre refus, qui nomme
  // mieux le problème que nous ne le ferions.
  if (!corps) return requete.formData();

  const typeContenu = requete.headers.get("content-type");
  const reponse = new Response(fluxBorne(corps, limiteOctets), {
    headers: typeContenu ? { "content-type": typeContenu } : undefined,
  });

  try {
    return await reponse.formData();
  } catch (erreur) {
    /**
     * **La cause est enterrée par le parseur**, et il faut aller la chercher.
     * `undici` emballe l'erreur du flux dans un `TypeError` de haut niveau ;
     * sans ce déballage, un corps trop gros se présenterait comme un multipart
     * malformé — une erreur qui accuse le mauvais coupable (`AGENTS.md`).
     */
    if (erreur instanceof CorpsTropGros) throw erreur;
    let cause: unknown = (erreur as { cause?: unknown })?.cause;
    for (let profondeur = 0; profondeur < 5 && cause; profondeur++) {
      if (cause instanceof CorpsTropGros) throw cause;
      cause = (cause as { cause?: unknown })?.cause;
    }
    throw erreur;
  }
}
