/**
 * LES MOTS DU PLAN — un mot, une phrase, et seulement les mots présents.
 *
 * *« Que tu nous expliques ce que ça veut dire quand il y a marqué tuyère, SAM,
 * PRS, tous les petits trucs à côté »* (18 octobre 2026). Chaque phrase vient
 * du catalogue Aqua Plus 2026 (la page est en commentaire) ou d'une de ses
 * règles ; un mot absent de l'écran ne s'affiche pas, pour ne pas expliquer ce
 * qu'on ne voit pas. La planche validée est `appli/arrosage-plan.html`.
 */
export type Mot = { quand: RegExp; mot: string; sens: string };

export const MOTS: Mot[] = [
  { quand: /Turbine/, mot: "Turbine", sens: "Un seul jet qui tourne et balaie l’angle réglé. Elle arrose loin et doucement." }, // ses règles du 21 août
  { quand: /Tuyère/, mot: "Tuyère", sens: "Un arroseur qui sort du sol et arrose tout son angle d’un coup, plus près et plus vite qu’une turbine." }, // « environ trois fois plus vite »
  { quand: /\d-VAN|VAN\b/, mot: "VAN", sens: "Une buse de tuyère dont on règle l’angle. Sa portée en mètres est écrite à côté." }, // p. 8
  { quand: /R-VAN/, mot: "R-VAN", sens: "Une buse rotative : plusieurs filets qui tournent et arrosent plus lentement. Réglable de 45° à 270°, ou fixe à 360°." }, // p. 8
  { quand: /MP Rotator|MP\d000/, mot: "MP Rotator", sens: "Une buse rotative multijets qui se visse sur un corps de tuyère à la place d’une buse. Secteur réglable à la clé MP ou plein cercle, de 2 à 3,5 bar." }, // p. 10
  { quand: /SAM/, mot: "SAM", sens: "Un clapet anti-vidange : l’eau ne ressort pas par l’arroseur le plus bas quand la vanne se ferme." }, // p. 7 et 13
  { quand: /PRS/, mot: "PRS", sens: "Un régulateur de pression intégré à la tuyère, réglé à 2,1 bar." }, // p. 7, « SAM-PRS (2,1 bar) »
  { quand: /\b18(02|04|06|12)\b|Tuyère 1800/, mot: "1802, 1804, 1806, 1812", sens: "La hauteur dont la tuyère sort du sol : 5, 10, 15 ou 30 cm." }, // p. 7
  { quand: /buse \d/, mot: "Buse 0,75, 2,0…", sens: "Le numéro de la buse vissée dans la turbine. Plus il est grand, plus elle arrose loin et plus elle prend d’eau." }, // p. 11
  { quand: /bridée/, mot: "Bridée", sens: "La portée est réduite à la vis, sur la turbine, pour ne pas arroser au delà de la pelouse." }, // sa règle du 16 octobre
  { quand: /SBE/, mot: "Coude SBE", sens: "Le petit coude qui relie l’antenne Ø16 : celui du bas se visse sur le té ou le coude de la ligne, celui du haut sous l’arroseur." }, // ses règles du 21 août
  { quand: /PEBD/, mot: "PEBD Ø16 rigide", sens: "L’antenne qui va de la ligne à l’arroseur, 2 m au plus." }, // sa règle du 11 septembre
  { quand: /PEHD/, mot: "PEHD Ø25", sens: "Le tuyau de la ligne, enterré dans la tranchée." },
  { quand: /taraudé/, mot: "Taraudé", sens: "Fileté à l’intérieur : on y visse une pièce." },
];

/** Les mots qui apparaissent dans ce texte, dans l'ordre de la table. */
export function motsPresents(texte: string): Mot[] {
  return MOTS.filter((m) => m.quand.test(texte));
}
