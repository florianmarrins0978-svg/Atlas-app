import { diagnostiquerLiaison, phraseDeLiaison } from "./diagnostic-liaison";

/**
 * Envoyer un enregistrement au serveur, depuis le navigateur.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Écrit une fois pour les trois écrans** qui envoient une note — l'anneau de
 * la fiche, l'écran de dictée, l'import d'un fichier. Trois copies de ce
 * traitement finiraient par ne pas dire la même chose du même échec, et c'est
 * exactement ce que `CLAUDE.md` §3 interdit.
 *
 * **Pourquoi ce n'est plus une action serveur** (12 août 2026) : une action est
 * adressée par un identifiant fabriqué à la construction, et le banc du patron
 * se reconstruit tout seul. Une page ouverte avant appelle alors un identifiant
 * disparu, et l'appel échoue sans jamais atteindre le serveur — trois fois de
 * suite chez lui. Une URL ne vieillit pas. Voir
 * `src/server/services/note-vocale-entrante.ts`.
 */
export type EnvoiNote =
  | { ok: true; storageKey: string | null; dureeSecondes: number | null }
  | { ok: false; raison: string; sessionPerimee?: true };

export async function envoyerNoteVocale(
  chantierId: string,
  formData: FormData,
  poster: (url: string, corps: FormData) => Promise<Response> = (url, corps) =>
    fetch(url, { method: "POST", body: corps }),
): Promise<EnvoiNote> {
  let reponse: Response;
  try {
    reponse = await poster(`/api/notes-vocales/${chantierId}`, formData);
  } catch {
    // Le serveur n'a pas été joint. **On lui demande s'il est vivant avant de
    // conclure** : accuser le réseau sans avoir demandé, c'est envoyer chercher
    // au mauvais endroit — le défaut du 12 août.
    return { ok: false, raison: phraseDeLiaison(await diagnostiquerLiaison()) };
  }

  // **Une réponse qui n'est pas du JSON n'est pas une réponse de cette route.**
  // Derrière le mandataire d'un espace d'essai, une session expirée peut rendre
  // une page HTML de connexion avec un code 200 : la lire comme un succès
  // laisserait croire que la note est rangée alors qu'elle est perdue.
  let corps: unknown = null;
  try {
    corps = await reponse.json();
  } catch {
    return {
      ok: false,
      raison:
        "Le serveur a répondu autre chose que prévu — la page a sans doute vieilli. " +
        "Rechargez-la, puis refaites la note.",
      ...(reponse.status === 401 || reponse.status === 403 ? { sessionPerimee: true as const } : {}),
    };
  }

  const rendu = corps as EnvoiNote | null;
  if (reponse.ok && rendu?.ok) return rendu;

  const raison =
    rendu && !rendu.ok && typeof rendu.raison === "string"
      ? rendu.raison
      : `Le serveur a refusé l'enregistrement (code ${reponse.status}).`;

  return { ok: false, raison, ...(reponse.status === 401 ? { sessionPerimee: true as const } : {}) };
}
