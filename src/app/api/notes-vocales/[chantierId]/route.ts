import { NextResponse } from "next/server";
import { recevoirNoteVocale } from "@/server/services/note-vocale-entrante";
import { LIMITE_TELEVERSEMENT_OCTETS, MESSAGE_FICHIER_TROP_VOLUMINEUX } from "@/server/upload-limits";

/**
 * Ce que le corps entier a le droit de peser.
 *
 * La même valeur que pour un fichier, plus une marge : un envoi multipart porte
 * ses frontières, ses en-têtes de partie et les autres champs du formulaire.
 * Serrer au ras du fichier refuserait des dictées parfaitement valables.
 */
const LIMITE_CORPS_OCTETS = LIMITE_TELEVERSEMENT_OCTETS + 1024 * 1024;

export const dynamic = "force-dynamic";

/**
 * Recevoir un enregistrement dicté — **par une URL, pas par une action serveur.**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le pourquoi tient en une phrase, et il vient du patron :** trois fois de
 * suite, sa note ne partait pas — *« L'enregistrement n'a pas pu être transmis
 * — la connexion a été interrompue. »*
 *
 * Une action serveur n'a pas d'adresse : elle a un identifiant fabriqué à la
 * construction et inscrit dans la page. Son banc se reconstruit tout seul ; une
 * page restée ouverte avant appelle donc un identifiant que le nouveau serveur
 * ne connaît plus, et l'appel échoue sans jamais l'atteindre. Une URL, elle, ne
 * vieillit pas. Le raisonnement complet est dans `note-vocale-entrante.ts`.
 *
 * **La règle métier n'est pas ici** : elle vit dans le service, que l'écran de
 * dictée, l'anneau et l'import partagent. Cette route ne fait que traduire un
 * résultat en réponse HTTP.
 *
 * **Les codes sont choisis pour que le client puisse les distinguer**, ce qu'une
 * action ne permettait pas : 401 se répare en se reconnectant, 409 en corrigeant
 * l'envoi, 500 en regardant le serveur. Une seule catégorie d'échec, c'était
 * une seule réponse possible — « réessayez » — pour trois pannes différentes.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ chantierId: string }> }
) {
  const { chantierId } = await params;

  /**
   * **UNE BORNE AVANT DE LIRE LE CORPS** — audit du 23 août 2026, constat M6.
   *
   * `bodySizeLimit` de `next.config.ts` ne couvre **que les actions serveur** :
   * une route comme celle-ci n'en voit rien. `formData()` mettait donc en
   * mémoire tout ce qu'on voulait bien lui envoyer, sans qu'aucune ligne ne
   * l'arrête — et cette route est ouverte par une URL, précisément pour
   * survivre à une reconstruction du serveur.
   *
   * **On lit l'en-tête plutôt que le corps.** `content-length` est annoncé par
   * le client, donc il ne fait pas foi — mais un envoi honnête l'annonce juste,
   * et un envoi malveillant qui le sous-déclare se heurte de toute façon à la
   * vérification de taille du service, qui lit `fichier.size` après coup. Ce
   * refus-ci est le premier rempart, pas le seul.
   */
  const annonce = Number(requete.headers.get("content-length") ?? "");
  if (Number.isFinite(annonce) && annonce > LIMITE_CORPS_OCTETS) {
    return NextResponse.json(
      { ok: false, raison: MESSAGE_FICHIER_TROP_VOLUMINEUX },
      { status: 413 }
    );
  }

  let formData: FormData;
  try {
    formData = await requete.formData();
  } catch {
    // Le corps n'est pas arrivé entier : coupure en cours d'envoi, ou format
    // inattendu. Ce n'est pas la faute de l'enregistrement.
    return NextResponse.json(
      { ok: false, raison: "L'envoi s'est interrompu en chemin. Réessayez." },
      { status: 400 }
    );
  }

  const resultat = await recevoirNoteVocale(chantierId, formData);
  if (resultat.ok) return NextResponse.json(resultat, { status: 200 });

  // **Une session expirée n'est pas un refus d'enregistrement**, et le client
  // doit pouvoir les séparer : l'une se répare en se reconnectant, l'autre en
  // refaisant la note. Le service nomme l'étape ; on la relit ici.
  const perimee = /étape : session/.test(resultat.raison);
  return NextResponse.json(resultat, { status: perimee ? 401 : 409 });
}
