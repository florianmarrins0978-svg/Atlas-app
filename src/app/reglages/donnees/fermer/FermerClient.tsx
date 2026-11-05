"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, surPlein } from "@/lib/design-tokens";
import Paquet from "@/components/atlas/reglages/Paquet";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import Picto, { type NomPicto } from "@/components/atlas/reglages/Picto";
import DemanderPreuve from "@/components/atlas/DemanderPreuve";
import type { CommentRouvrir, EtatFermeture } from "@/lib/fermeture-compte";
import BoutonTelecharger from "../BoutonTelecharger";
import { fermerLeCompteAction, rouvrirLeCompteAction, type ReponseFermeture } from "./actions";

/**
 * L'écran de la planche `fermer-mon-compte.html`, tel qu'il l'a choisi : ce
 * qui reste dix ans, ce qui part et quand, la copie proposée, la fermeture
 * sous le pouce. Fermé, le même écran dit où il en est et rouvre.
 *
 * **Les clients gardés ne gardent que leur nom** : c'est l'effacement d'un
 * client qui s'applique (sa décision du 27 août 2026), et une facture sans
 * nom ne vaut rien. La ligne le dit tel quel plutôt que « les clients ».
 */
const RESTE: [NomPicto, string][] = [
  ["facture", "Vos factures et vos avoirs"],
  ["document", "Vos devis et contrats acceptés"],
  ["carton", "Les chantiers et le nom des clients qui les portent"],
  ["etiquette", "Vos réglages"],
];
const PART: [NomPicto, string][] = [
  ["document", "Les devis jamais acceptés"],
  ["croix", "Les clients sans facture"],
  ["photo", "Les photos, les notes, les dictées"],
];

function Liste({ lignes, teinte }: { lignes: [NomPicto, string][]; teinte: string }) {
  return (
    <ul>
      {lignes.map(([picto, texte], i) => (
        <li
          key={texte}
          className="flex min-h-[54px] items-center gap-3.5 py-2.5 text-[16px] leading-[1.4]"
          style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}
        >
          <span className="flex-none" style={{ color: teinte }}>
            <Picto nom={picto} />
          </span>
          <span>{texte}</span>
        </li>
      ))}
    </ul>
  );
}

function Quand({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-6 mt-2 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
      {children}
    </p>
  );
}

const bouton = "flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full px-[22px] text-[17px] font-semibold no-underline";

export default function FermerClient({
  statut,
  commentRouvrir,
  effetEnMots,
  resteOuvert,
  effacementEnMots,
  nomFichier,
}: {
  statut: EtatFermeture["statut"];
  commentRouvrir: CommentRouvrir | null;
  effetEnMots: string;
  /** La fermeture prend effet plus tard : la fin de ce qui est payé. */
  resteOuvert: boolean;
  effacementEnMots: string | null;
  nomFichier: string;
}) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [preuve, setPreuve] = useState<string | null>(null);

  async function agir(geste: () => Promise<ReponseFermeture>) {
    setEnCours(true);
    setRefus(null);
    try {
      const r = await geste();
      if (r.ok) {
        router.refresh();
        return;
      }
      if (r.preuveExigee) setPreuve(r.message);
      else setRefus(r.message);
    } finally {
      setEnCours(false);
    }
  }

  const ouvert = statut === "ouvert";
  const ferme = statut === "fermee" || statut === "archivee";

  return (
    <>
      {statut === "programmee" && (
        <div className="mx-[22px] mt-6">
          <PlageTon ton="ambre" dataAtlas="fermeture-programmee">
            Votre compte se ferme le {effetEnMots}.
          </PlageTon>
        </div>
      )}
      {ferme && (
        <div className="mx-[22px] mt-6">
          <PlageTon ton="ambre" dataAtlas="compte-ferme">
            {statut === "fermee"
              ? `Compte fermé. Le reste s'efface le ${effacementEnMots}.`
              : "Compte fermé. Vos pièces restent dix ans."}
          </PlageTon>
        </div>
      )}

      <Paquet titre="Reste dix ans">
        <Liste lignes={RESTE} teinte={colors.or} />
      </Paquet>
      <Quand>Vous les lisez et les téléchargez avec votre mot de passe.</Quand>

      {statut !== "archivee" && (
        <>
          <Paquet titre={`S'efface le ${effacementEnMots}`}>
            <Liste lignes={PART} teinte={colors.inkSoft} />
          </Paquet>
          <Quand>
            {ouvert && resteOuvert
              ? `Votre compte reste ouvert jusqu'au ${effetEnMots}.`
              : "D'ici là, Rouvrir mon compte rend tout."}
          </Quand>
        </>
      )}

      <div className="mx-[22px] mt-6">
        <BoutonTelecharger nomFichier={nomFichier} allure="creux" />
      </div>

      {refus && (
        <p role="alert" className="mx-6 mt-4 text-[15px] leading-[1.45]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}

      <ActionBas>
        {ouvert && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => agir(fermerLeCompteAction)}
            data-atlas="fermer-mon-compte"
            className={bouton}
            style={{ backgroundColor: colors.alert, color: surPlein }}
          >
            {enCours ? "Un instant…" : "Fermer mon compte"}
          </button>
        )}
        {statut === "programmee" && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => agir(rouvrirLeCompteAction)}
            data-atlas="ne-pas-fermer"
            className={`atlas-plein ${bouton}`}
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            {enCours ? "Un instant…" : "Ne pas fermer"}
          </button>
        )}
        {ferme && commentRouvrir === "se-reabonner" && (
          <Link
            href="/reglages/abonnement"
            data-atlas="rouvrir-mon-compte"
            className={`atlas-plein ${bouton}`}
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            Rouvrir mon compte
          </Link>
        )}
        {ferme && commentRouvrir === "rouvrir" && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => agir(rouvrirLeCompteAction)}
            data-atlas="rouvrir-mon-compte"
            className={`atlas-plein ${bouton}`}
            style={{ backgroundColor: colors.plein, color: surPlein }}
          >
            {enCours ? "Un instant…" : "Rouvrir mon compte"}
          </button>
        )}
      </ActionBas>

      <DemanderPreuve
        ouvert={preuve !== null}
        motif={preuve ?? ""}
        onAbandon={() => setPreuve(null)}
        onProuve={() => {
          setPreuve(null);
          void agir(fermerLeCompteAction);
        }}
      />
    </>
  );
}
