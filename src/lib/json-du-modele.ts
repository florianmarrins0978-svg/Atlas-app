// Retrouver l'objet JSON dans ce qu'un modèle de langage a réellement écrit.
//
// **Pourquoi cette fonction existe.** Le service d'extraction faisait
// `JSON.parse(reponse)` sans filet, et rendait « Réponse du fournisseur non
// conforme (JSON invalide). » à la moindre différence. Or un modèle, même bien
// instruit, encadre volontiers sa réponse : ```json … ```, ou « Voici le
// résultat : { … } ». Le contenu est juste ; c'est l'emballage qui coince — et
// le chantier du patron s'arrêtait là.
//
// **Ce qu'elle ne fait pas.** Elle ne répare rien, n'ajoute rien, ne devine
// rien : elle isole le premier objet `{…}` équilibré et le laisse être validé
// par le schéma strict, qui reste seul juge. Un modèle qui répond à côté
// continue donc d'être rejeté — simplement, il l'est pour la bonne raison.

/**
 * Isole et analyse le premier objet JSON de `texte`.
 * Renvoie `null` si rien d'exploitable ne s'y trouve — jamais une exception.
 */
export function lireObjetJson(texte: string | null | undefined): unknown | null {
  if (!texte) return null;

  const direct = analyser(texte.trim());
  if (direct !== null) return direct;

  // Encadré en bloc de code, avec ou sans langage annoncé.
  const bloc = texte.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (bloc) {
    const dansLeBloc = analyser(bloc[1].trim());
    if (dansLeBloc !== null) return dansLeBloc;
  }

  // Noyé dans de la prose : on découpe au premier `{` et à l'accolade qui le
  // referme réellement — compter les accolades ne suffit pas, une accolade
  // dans une chaîne de caractères fausserait le compte.
  const extrait = premierObjetEquilibre(texte);
  return extrait === null ? null : analyser(extrait);
}

function analyser(candidat: string): unknown | null {
  if (!candidat.startsWith("{")) return null;
  try {
    return JSON.parse(candidat);
  } catch {
    return null;
  }
}

function premierObjetEquilibre(texte: string): string | null {
  const debut = texte.indexOf("{");
  if (debut === -1) return null;

  let profondeur = 0;
  let dansUneChaine = false;
  let echappe = false;

  for (let i = debut; i < texte.length; i++) {
    const c = texte[i];

    if (dansUneChaine) {
      if (echappe) echappe = false;
      else if (c === "\\") echappe = true;
      else if (c === '"') dansUneChaine = false;
      continue;
    }

    if (c === '"') dansUneChaine = true;
    else if (c === "{") profondeur++;
    else if (c === "}") {
      profondeur--;
      if (profondeur === 0) return texte.slice(debut, i + 1);
    }
  }
  return null;
}

/**
 * Ce texte est-il un JSON **coupé en plein milieu** ?
 *
 * ─── Pourquoi cette question mérite sa fonction ─────────────────────────────
 *
 * Une réponse tronquée à `max_tokens` et une réponse hors sujet tombent toutes
 * les deux dans le même repli — la lecture mot à mot. Vues du dehors, elles
 * sont indiscernables : le patron reçoit un brouillon pauvre, et **rien nulle
 * part ne dit laquelle des deux s'est produite**. C'est le défaut muet
 * d'`AGENTS.md` : on ne peut ni le mesurer, ni le corriger, ni le lui dire.
 *
 * Le fournisseur SAIT (`stop_reason: "max_tokens"`), et c'est la source qui
 * fait foi. Mais tous les fournisseurs ne le disent pas, et un texte peut être
 * relayé sans son enveloppe : cette lecture de FORME sert de second filet.
 *
 * **Elle ne conclut que sur du certain :** un objet qui commence et ne se
 * referme jamais. Un texte qui ne ressemble à aucun JSON n'est pas tronqué —
 * c'est un modèle qui a répondu à côté, et les deux ne se réparent pas pareil.
 */
export function estJsonTronque(texte: string | null | undefined): boolean {
  if (!texte) return false;
  const sansBloc = texte.replace(/```(?:json|JSON)?/g, "");
  const debut = sansBloc.indexOf("{");
  if (debut === -1) return false;
  // Un objet complet se trouve : rien n'a été coupé, quoi qu'il y ait autour.
  if (premierObjetEquilibre(sansBloc) !== null) return false;
  // Une accolade ouverte, jamais refermée, et le texte s'arrête : c'est une
  // coupure. Ce serait un JSON malformé si la réponse se poursuivait après.
  return true;
}
