"use client";

import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { type CleAppareil } from "@/lib/cle-appareil";
import { retirerCleAction } from "./actions";
import { useActiverFaceId } from "./useActiverFaceId";
import DemanderPreuve from "@/components/atlas/DemanderPreuve";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import Trace from "@/components/atlas/reglages/Trace";

/**
 * « Ouvrir avec Face ID » — l'endroit où on l'allume.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa règle du 23 août 2026 :** *« l'utilisateur va commencer par créer son
 * compte avec son mot de passe et ensuite il décidera s'il veut ouvrir sa
 * session avec le mot de passe ou le Face ID »*. On n'arrive donc ici qu'une
 * fois entré — et le mot de passe reste, quoi qu'il fasse.
 *
 * **CE QUE L'ÉCRAN DISAIT, ET QU'IL NE DIT PLUS — 31 août 2026.** Quatre lignes
 * grises promettaient ici que c'est par appareil, que le visage ne quitte
 * jamais le téléphone, et que le mot de passe reste actif. Il les a fait
 * retirer avec toutes les autres : *« supprime toutes les petites phrases en
 * gris sous les boutons, garde que les titres »*.
 *
 * **Les faits n'ont pas bougé** — `drizzle/0063_cles_appareil.sql` ne porte
 * aucune donnée biométrique, et c'est la base, pas une phrase, que
 * `test-face-id-e2e.ts` interroge. Ce qui a disparu, c'est la promesse écrite :
 * un artisan méfiant n'a plus de quoi se rassurer à l'écran. Le lui redire
 * demanderait un autre endroit que cette rubrique — pas ces quatre lignes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **RIEN NE S'AFFICHE SI L'APPAREIL NE SAIT PAS LE FAIRE**, sauf s'il a déjà
 * des clés ailleurs — auquel cas la liste doit rester atteignable pour qu'il
 * puisse retirer le téléphone qu'il vient de perdre. Un interrupteur qui ne
 * peut pas aboutir se tairait ; une liste qu'on ne peut plus ouvrir enfermerait
 * une porte ouverte.
 */
export default function SectionFaceId({ clesInitiales }: { clesInitiales: CleAppareil[] }) {
  const [cles, setCles] = useState(clesInitiales);
  // Le geste d'activer vit dans `useActiverFaceId`, partagé avec la fin de la
  // porte (`/creer-un-compte/pret`) : deux copies finiraient par diverger.
  const { disponible, teste, refus, setRefus, fait, setFait, enCours, demarrer, activer, preuveDemandee, setPreuveDemandee } =
    useActiverFaceId(setCles);

  function retirer(id: string) {
    setRefus(null);
    setFait(null);
    demarrer(async () => {
      const r = await retirerCleAction(id);
      if (!r.ok) {
        if (r.preuveExigee) {
          setPreuveDemandee({ motif: r.raison, reprendre: () => retirer(id) });
          return;
        }
        setRefus(r.raison);
        return;
      }
      setCles(r.cles);
      setFait("Cet appareil ne peut plus ouvrir Atlas. Votre mot de passe, lui, marche toujours.");
    });
  }

  // Ni disponible ici, ni de clé ailleurs : la rubrique n'aurait rien à dire.
  if (teste && !disponible && cles.length === 0) return null;
  if (!teste) return null;

  // **Des lignes, pas une rubrique** — sa planche soignée du 26 octobre 2026 :
  // Face ID partage la plage de « Me déconnecter partout », que l'écran pose
  // autour. Le titre « Ouvrir avec Face ID » devient le nom de la ligne quand
  // aucun appareil n'est enregistré ; un appareil enregistré porte, lui, sa
  // pastille verte.
  return (
    <>
      {refus && (
        <div role="alert" className="py-2.5">
          <PlageTon ton="rouge">{refus}</PlageTon>
        </div>
      )}
      {fait && (
        <div role="status" className="py-2.5">
          <PlageTon ton="vert">{fait}</PlageTon>
        </div>
      )}

      {cles.length === 0 ? (
        disponible && (
          <button type="button" onClick={activer} disabled={enCours} className={LIGNE}>
            <Filet />
            <PastilleIcone>{VISAGE}</PastilleIcone>
            <span className="min-w-0 flex-1">
              <span className="block" style={NOM}>
                Ouvrir avec Face ID
              </span>
              <span className="mt-0.5 block text-[15px] font-semibold" style={{ color: colors.or }}>
                {enCours ? "En cours…" : "Enregistrer cet appareil"}
              </span>
            </span>
            <span className="flex" style={{ color: colors.or }}>
              <Trace taille={20} epaisseur={2}>
                {PLUS}
              </Trace>
            </span>
          </button>
        )
      ) : (
        <>
          {cles.map((cle) => (
            <div key={cle.id} className={LIGNE}>
              <Filet />
              <PastilleIcone ton="vert">{VISAGE}</PastilleIcone>
              <span className="min-w-0 flex-1">
                <span className="block" style={NOM}>
                  {cle.nomAppareil}
                </span>
                {/* **Une DATE, toujours — jamais « Jamais encore servi » seul.**
                    La capture du 24 août montrait deux lignes « iPhone / Jamais
                    encore servi » strictement identiques : impossible de savoir
                    laquelle retirer. Or c'est le seul moment où l'on ouvre cet
                    écran — un téléphone vient d'être perdu. Deux téléphones du
                    même modèle portent le même nom deviné ; leur date
                    d'enregistrement, elle, les sépare. */}
                <span className="mt-0.5 block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                  {cle.dernierUsageLe
                    ? `Dernière ouverture le ${cle.dernierUsageLe.toLocaleDateString("fr-FR")}`
                    : `Enregistré le ${cle.creeLe.toLocaleDateString("fr-FR")}, jamais encore servi`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => retirer(cle.id)}
                disabled={enCours}
                className="min-h-[44px] flex-none px-1 text-[15px] font-semibold disabled:opacity-60"
                style={{ color: colors.alert }}
              >
                Retirer
              </button>
            </div>
          ))}
          {disponible && (
            // Sous les appareils, alignée sur leurs noms : enregistrer CELUI-CI
            // reste à un appui, sans répéter le titre.
            <button
              type="button"
              onClick={activer}
              disabled={enCours}
              className="relative flex min-h-[50px] w-full items-center gap-3.5 py-1 pl-[54px] text-left"
            >
              <Filet />
              <span className="min-w-0 flex-1 text-[15px] font-semibold" style={{ color: colors.or }}>
                {enCours ? "En cours…" : "Enregistrer cet appareil"}
              </span>
              <span className="flex" style={{ color: colors.or }}>
                <Trace taille={20} epaisseur={2}>
                  {PLUS}
                </Trace>
              </span>
            </button>
          )}
        </>
      )}

      {/* **LA GLOSE EST PARTIE — sa demande du 31 août 2026 :** *« supprime
          toutes les petites phrases en gris sous les boutons, garde que les
          titres »*. Quatre lignes vivaient ici : c'est par appareil, le visage
          ne quitte pas le téléphone, le mot de passe reste actif.

          **Ce que ce retrait coûte, et il faut le savoir avant de le défaire :**
          l'écran ne promet plus rien à celui qui hésite à donner son visage.
          Rien ne change dans les faits — `drizzle/0063_cles_appareil.sql` ne
          porte aucune donnée biométrique, et `test-face-id-e2e.ts` le vérifie
          en base plutôt que dans une phrase. C'est la promesse ÉCRITE qui a
          disparu, pas la garantie. */}

      {/* **La feuille n'autorise rien** : elle obtient une preuve côté serveur,
          puis on REPREND le geste. Sans cette reprise, l'artisan taperait son
          mot de passe et devrait réappuyer — un geste qu'on refait est un geste
          qu'on abandonne. */}
      <DemanderPreuve
        ouvert={preuveDemandee !== null}
        motif={preuveDemandee?.motif ?? ""}
        onAbandon={() => setPreuveDemandee(null)}
        onProuve={() => {
          const reprendre = preuveDemandee?.reprendre;
          setPreuveDemandee(null);
          reprendre?.();
        }}
      />
    </>
  );
}

/** Une ligne de la plage : 62 px au moins, sous le pouce. */
const LIGNE = "relative flex min-h-[62px] w-full items-center gap-3.5 py-[9px] text-left";

const NOM: React.CSSProperties = { fontFamily: font.display, fontSize: 17.5, lineHeight: 1.25, color: colors.ink };

/** Le filet au-dessus de chaque ligne ; la plage, qui rogne, efface le premier. */
function Filet() {
  return <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />;
}

const VISAGE = (
  <Trace>
    <path d="M4 8.5V6.5A2.5 2.5 0 0 1 6.5 4h2M15.5 4h2A2.5 2.5 0 0 1 20 6.5v2M20 15.5v2a2.5 2.5 0 0 1-2.5 2.5h-2M8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-2" />
    <path d="M9 9.5v1.2M15 9.5v1.2M12.2 9.5v3.6h-1M9.4 15.6c1.5 1.1 3.7 1.1 5.2 0" />
  </Trace>
);

const PLUS = <path d="M12 5v14M5 12h14" />;
