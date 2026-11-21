/**
 * Les mots d'un dossier d'arrosage, tels que sa planche du 21 novembre 2026
 * les écrit (`appli/arrosage-dossiers.html`) : « 2 plans, le dernier
 * aujourd'hui », « 1 plan, le 14 novembre 2026 », « Aujourd'hui, 9 h 41 ».
 * À l'heure de Paris, quel que soit le serveur.
 */
const PARIS = "Europe/Paris";

const jourDe = (d: Date) => d.toLocaleDateString("fr-CA", { timeZone: PARIS });

export function dateLongue(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: PARIS });
}

/** « 9 h 41 » : l'heure se dit, elle ne s'écrit pas « 09:41 ». */
export function heureDite(d: Date): string {
  const [h, m] = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: PARIS }).split(":");
  return `${Number(h)} h ${m}`;
}

/** Le moment d'un enregistrement : « Aujourd'hui, 9 h 41 », ou « 14 novembre 2026, 17 h 05 ». */
export function quandEnregistre(d: Date, maintenant: Date): string {
  return `${jourDe(d) === jourDe(maintenant) ? "Aujourd’hui" : dateLongue(d)}, ${heureDite(d)}`;
}

/** Sous le nom d'un dossier : combien de plans, et de quand date le dernier. */
export function resumeDuDossier(plans: number, dernier: Date | null, maintenant: Date): string {
  if (plans === 0 || !dernier) return "Aucun plan encore";
  const quand = jourDe(dernier) === jourDe(maintenant) ? "aujourd’hui" : `le ${dateLongue(dernier)}`;
  return plans === 1 ? `1 plan, ${quand}` : `${plans} plans, le dernier ${quand}`;
}

/** Le bandeau d'un plan revu : « Enregistré aujourd'hui à 9 h 41 », ou « Enregistré le 14 novembre 2026 à 17 h 05 ». */
export function enregistreLe(d: Date, maintenant: Date): string {
  return `Enregistré ${jourDe(d) === jourDe(maintenant) ? "aujourd’hui" : `le ${dateLongue(d)}`} à ${heureDite(d)}`;
}

/**
 * « Supprimer ce dossier ? » : ce qui disparaît, et ce qui est effacé. Ne
 * nomme que ce qui existe : promettre d'effacer une photo qu'un plan dessiné
 * n'a jamais eue ferait douter du reste de la phrase.
 */
export function ceQueLaSuppressionEfface({ plans, photo, client }: { plans: number; photo: boolean; client: boolean }): string {
  const part = plans === 0 ? "Il disparaît" : plans === 1 ? "Son plan disparaît" : `Ses ${plans} plans disparaissent`;
  const efface = ["Le nom du dossier", ...(photo ? ["la photo du croquis"] : []), ...(client ? ["le lien à la fiche"] : [])];
  const liste = efface.length === 1 ? efface[0] : `${efface.slice(0, -1).join(", ")} et ${efface[efface.length - 1]}`;
  return `${part} de vos dossiers. ${liste} ${efface.length === 1 ? "est effacé" : "sont effacés"}.`;
}
