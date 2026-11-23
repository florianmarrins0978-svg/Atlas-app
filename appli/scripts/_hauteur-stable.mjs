// LA HAUTEUR STABLE DE L'ÉCRAN, ET NON LA HAUTEUR VIVANTE, pour une planche
// faite d'écrans figés. Sa remarque du 23 novembre 2026 : « quand je monte et
// je descends, elle frise et elle saute ». Les écrans de l'appli prennent
// `100dvh`, la hauteur visible, qui change en continu sur iPhone quand Safari
// rentre ou ressort sa barre d'adresse ; dans l'appli installée il n'y a pas
// de barre, mais une planche se lit dans Safari, et son en-tête la fait
// défiler. `100svh`, la petite hauteur, ne bouge pas. Seules les VALEURS
// changent : le nom de la classe (`min-h-[100dvh]`, précédé de « [ ») reste
// celui que l'appli pose.
export const enHauteurStable = (texte) => texte.replace(/(?<=[:(\s])(\d+)dvh/g, "$1svh");
