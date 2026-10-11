import { getEnv } from "./env";
import type { ClesFournisseurs } from "@/lib/fournisseurs-connexion";

/**
 * LES QUATRE CLÉS DE GOOGLE ET D'APPLE, LUES EN UN SEUL ENDROIT.
 *
 * Le même objet se composait à trois endroits — l'écran, `src/auth.ts`, et la
 * porte de sortie de `entrerAvecAction` — chacun retapant les quatre noms de
 * champs. Trois rédactions d'une même question finissent par diverger
 * (`CLAUDE.md` §3), et la divergence s'appellerait ici : un bouton qui se
 * dessine branché d'un côté et refuse de l'autre.
 *
 * **Au serveur, et nulle part ailleurs** : `getEnv()` n'existe qu'ici. Un écran
 * qui devinerait la réponse se tromperait sans que rien ne le dise.
 */
export function clesFournisseurs(): ClesFournisseurs {
  const env = getEnv();
  return {
    googleId: env.googleClientId,
    googleSecret: env.googleClientSecret,
    appleId: env.appleClientId,
    appleSecret: env.appleClientSecret,
  };
}
