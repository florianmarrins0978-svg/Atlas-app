/**
 * CE QUE LES SUITES ONT DIT, SUITE PAR SUITE — lu dans ce qu'elles écrivent.
 *
 * **Sa règle du 16 septembre 2026 :** *« état de référence connu + nouveau lot
 * → aucun nouveau rouge autorisé. Un test qui était vert avant et devient
 * rouge doit bloquer. Un nouveau test rouge doit bloquer. Un rouge préexistant
 * identique ne doit pas empêcher éternellement toutes les futures fusions. »*
 *
 * Pour comparer deux batteries, il faut savoir QUELLES suites ont rougi — pas
 * seulement « deux étapes en échec ». Les deux moteurs (`run-all-tests.ts`,
 * `run-e2e-tests.ts`) l'écrivent déjà, une ligne par suite tombée, et une
 * ligne de compte à la fin. C'est cette écriture que la batterie relit.
 *
 * **Une seule phrase, écrite ici et nulle part ailleurs.** Les moteurs
 * l'empruntent pour l'écrire, la batterie l'emprunte pour la lire : deux
 * copies auraient fini par diverger, et un rouge mal orthographié serait
 * devenu invisible — c'est-à-dire toléré (`CLAUDE.md` §3).
 *
 * **Et un compte qui ne tombe pas juste n'est pas un bilan.** Quand le serveur
 * meurt, le moteur navigateur compte les suites restantes comme perdues sans
 * les nommer : le bilan dit alors « incomplet », et un bilan incomplet ne
 * tolère rien. L'absence de matière à mesurer n'est pas un succès.
 */

/** La ligne d'une suite tombée, telle que les moteurs l'écrivent. */
export function phraseDEchec(fichier, pourquoi) {
  return `❌ ${fichier} a échoué (${pourquoi})`;
}

/** La ligne d'une suite qui ne rend pas la main — tuée, pas rouge d'elle-même. */
export function phraseDeBlocage(fichier, minutes) {
  return `❌ ${fichier} n'a pas rendu la main en ${minutes} minutes — tué.`;
}

/**
 * La ligne d'une suite qui ne peut pas mesurer ICI — ni verte, ni rouge.
 *
 * **Elle doit NOMMER l'outil qui manque.** « Non applicable » tout court se
 * lirait comme une dispense, et la prochaine session l'ajouterait à la
 * sienne ; « `gh` est absent de cette machine » se vérifie en dix secondes, et
 * cesse d'être vrai dès qu'on installe l'outil.
 */
export function phraseDeNonMesurable(fichier, raison) {
  return `⏭️  ${fichier} n'a rien pu mesurer ici (${raison})`;
}

/**
 * La ligne de compte, en fin de moteur.
 *
 * **Les non mesurables sortent du total**, et se disent à part. Les fondre
 * dans les réussies rendrait un vert qui ne prouve rien — la faute exacte du
 * 15 août 2026, où `0 − 0 = 0` annonçait « rien n'est coupé » sur un écran où
 * trois noms l'étaient (`CLAUDE.md` §5).
 */
export function phraseDeCompte(reussies, total, nonMesurables = 0) {
  const base = `${reussies}/${total} suites réussies.`;
  return nonMesurables > 0
    ? `${base} ${nonMesurables} non mesurable(s) ici.`
    : base;
}

// Pas de `\b` après « échoué » : pour JavaScript, « é » n'est pas une lettre
// de mot, et la frontière n'y existe pas — la ligne ne se lisait jamais.
const LIGNE_ROUGE = /^\s*❌ (\S+\.ts) (?:a échoué|n'a pas rendu la main)(?=\s|$)/gmu;
const LIGNE_COMPTE = /^\s*(\d+)\/(\d+) suites réussies\.(?: (\d+) non mesurable\(s\) ici\.)?/gmu;
const LIGNE_NON_MESURABLE = /^\s*⏭️\s+(\S+\.ts) n'a rien pu mesurer ici(?=\s|$)/gmu;

/**
 * Relit la sortie d'un moteur de suites.
 *
 * Rend `null` si aucune ligne de compte n'y est : ce n'était pas un moteur de
 * suites, ou il n'est pas allé au bout. Sinon, la liste des suites rouges, et
 * `complet` — vrai seulement si le compte des rouges nommés est exactement
 * celui que le moteur annonce.
 */
export function bilanDuJournal(texte) {
  const comptes = [...String(texte ?? "").matchAll(LIGNE_COMPTE)];
  if (comptes.length === 0) return null;
  // Le DERNIER compte : un moteur n'en écrit qu'un, mais une sortie de
  // batterie peut en enchaîner plusieurs, et c'est le dernier qui conclut.
  const [, reussies, total, muettes] = comptes[comptes.length - 1];
  const rouges = [...new Set([...String(texte).matchAll(LIGNE_ROUGE)].map((m) => m[1]))].sort();
  const nonMesurables = [
    ...new Set([...String(texte).matchAll(LIGNE_NON_MESURABLE)].map((m) => m[1])),
  ].sort();
  // **Le compte est le seul témoin croisé d'un « non mesurable ».** Une suite
  // qui se déclarerait muette sans que le moteur l'annonce serait une dispense
  // que personne ne voit passer — la liste qu'on refuse, écrite autrement.
  const annonces = Number(total) - Number(reussies);
  const complet =
    rouges.length + nonMesurables.length === annonces &&
    nonMesurables.length === Number(muettes ?? 0);
  return { rouges, nonMesurables, complet };
}
