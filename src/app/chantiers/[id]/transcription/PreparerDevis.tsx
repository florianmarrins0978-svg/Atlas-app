"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import type { ResultatTapis } from "@/server/orchestrateur/tapis-roulant";
import { preparerDevisDepuisDicteeAction } from "./tapis-actions";

// « Préparer le devis » — le geste unique de la dictée au devis.
//
// Ce que cet écran doit dire, et que le patron ne pardonnerait pas d'ignorer :
// ce qui a été fait, et surtout **ce qui manque**. Il a choisi de voir le devis
// avec ses trous signalés plutôt qu'un aller-retour de questions ; c'est donc
// ici que les trous se montrent, pas ailleurs.

const LIBELLE_CATEGORIE: Record<ResultatTapis["trous"][number]["categorie"], string> = {
  information_manquante: "Il manque",
  ambiguite: "À lever",
  prix_absent: "Prix",
  choix_a_faire: "À trancher",
};

export default function PreparerDevis({ chantierId, actif }: { chantierId: string; actif: boolean }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<ResultatTapis | null>(null);
  const [resume, setResume] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function lancer() {
    setEnCours(true);
    setErreur(null);
    setResultat(null);
    try {
      const r = await preparerDevisDepuisDicteeAction(chantierId);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      setResultat(r.resultat);
      setResume(r.resume);
      router.refresh();
    } catch {
      setErreur("La préparation n'a pas pu aboutir. Votre dictée est intacte.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="px-6 pt-8">
      <button
        type="button"
        onClick={lancer}
        disabled={!actif || enCours}
        className="w-full rounded-full py-4 text-[15px] font-medium"
        style={{
          backgroundColor: actif && !enCours ? colors.rust : colors.rustTint,
          color: actif && !enCours ? colors.cream : colors.muted,
        }}
      >
        {enCours ? "Préparation du devis…" : "Préparer le devis"}
      </button>

      {!actif && (
        <p className="text-[13px] leading-snug" style={{ color: colors.muted, marginTop: 8 }}>
          Disponible dès qu&apos;une dictée est transcrite. Sans prestataire de transcription raccordé, écrivez le texte
          ci-dessus : le devis se prépare aussi bien à partir de là.
        </p>
      )}

      {enCours && (
        <p className="text-[13px]" style={{ color: colors.inkSoft, marginTop: 10 }}>
          Comprendre la dictée, chercher dans vos tarifs, chiffrer, monter le devis. Une minute environ.
        </p>
      )}

      {erreur && (
        <p className="text-[13px]" style={{ color: colors.rust, marginTop: 10 }}>
          {erreur}
        </p>
      )}

      {resultat && (
        <div className="rounded-xl p-4" style={{ backgroundColor: colors.card, marginTop: 14 }}>
          <p className="text-[15px] font-medium" style={{ color: colors.ink }}>
            {resume}
          </p>

          <ul className="mt-3 flex flex-col gap-1">
            {resultat.etapes.map((e) => (
              <li key={e.nom} className="text-[13px]" style={{ color: colors.inkSoft }}>
                {e.statut === "reussie" ? "✓" : "—"} {e.libelle}
                {e.detail ? <span style={{ color: colors.muted }}> · {e.detail}</span> : null}
              </li>
            ))}
          </ul>

          {/* Les trous ne sont jamais comblés par une supposition : ils se disent. */}
          {resultat.trous.length > 0 && (
            <div className="mt-4">
              <p className="text-[13px] font-medium" style={{ color: colors.ink, marginBottom: 4 }}>
                À vérifier avant d&apos;envoyer
              </p>
              <ul className="flex flex-col gap-1">
                {resultat.trous.map((t, i) => (
                  <li key={i} className="text-[13px] leading-snug" style={{ color: colors.inkSoft }}>
                    <span style={{ color: colors.rust }}>{LIBELLE_CATEGORIE[t.categorie]}</span> · {t.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultat.statut === "devis_pret" && (
            <a
              href={`/chantiers/${chantierId}/export`}
              className="mt-4 inline-block text-[14px] font-medium"
              style={{ color: colors.rust }}
            >
              Voir le devis →
            </a>
          )}
        </div>
      )}
    </section>
  );
}
