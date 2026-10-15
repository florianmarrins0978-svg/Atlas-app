"use client";

import { useState } from "react";
import { dansDelaiRetractation, jourIso } from "@/lib/jour";
import { colors } from "@/lib/design-tokens";
import type { JourIso } from "@/lib/disponibilites";
import type { ChantierPlanning, GestesCarte } from "./types-du-planning";
import { jourEnLettres } from "./outils-du-planning";
import { Choisir, Petit } from "./ElementsDuPlanning";

/**
 * COMMENT IL SIGNERA — son choix B du 7 octobre 2026.
 *
 * *« Le client est âgé, il n'arrive pas à choisir ses dates via mon lien. »*
 * Le patron le pose, et dit comment l'accord viendra :
 *
 * - **« Signe sur son lien »** : son lien ne montre plus que ces jours et
 *   « J'accepte ce devis ». Le planning écrit « Pas encore signé ».
 * - **« Signé sur papier »** : il a le devis papier signé, l'accord s'enregistre
 *   à ce titre et son lien se ferme.
 *
 * **Poser ne vaut jamais accord** — il l'a proposé, c'est refusé, et il l'a
 * accepté le même jour (`pose-a-sa-place.ts`).
 *
 * **La case des 14 jours n'apparaît que sur le papier, et que dans le délai** :
 * sur le lien, c'est le client qui la coche lui-même. Sa présence suit la même
 * règle que la page du client (`dansDelaiRetractation`), et le serveur la
 * revérifie.
 */
/**
 * UN DEVIS EXPIRÉ QUI REVIENT — sa planche du 7 octobre 2026
 * (`appli/relancer-un-devis-expire.html`), retenue telle quelle.
 *
 * Trois gestes. **Relire** : ses lignes aux prix du jour, sur la page du devis.
 * **Renvoyer tel quel** : un lien neuf, puis comment il signe. **Poser sans le
 * renvoyer** : sa décision, et rien n'écrit ensuite « Pas encore signé » ; c'est
 * lui qui a l'accord du client en main.
 */
export function RelanceDuDevisExpire({
  jour,
  chantier,
  onRenvoyer,
  onPoser,
  relire,
  onAnnuler,
}: {
  jour: JourIso;
  chantier: ChantierPlanning | null;
  onRenvoyer: () => void;
  onPoser: (chantierId: string) => void;
  relire: GestesCarte["relireLeDevisExpire"];
  onAnnuler: () => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  if (!chantier) {
    return (
      <div className="mt-3.5 pt-3">
        <p data-atlas="refus-du-geste" className="text-[13px]" style={{ color: colors.bordeaux }}>
          Ce devis n&apos;est plus expiré.
        </p>
        <div className="mt-2 flex justify-end">
          <Petit data-atlas="annuler-ajout" onClick={onAnnuler}>
            Annuler
          </Petit>
        </div>
      </div>
    );
  }
  const c = chantier;
  return (
    <div className="mt-3.5 pt-3" data-atlas="relance-du-devis">
      <p className="text-[14px]" style={{ color: colors.inkSoft }}>
        Le lien de son devis a expiré{c.envoiExpireAt ? ` le ${jourEnLettres(c.envoiExpireAt)}` : ""}.
      </p>
      <Choisir>
        <Petit
          data-atlas="relire-le-devis"
          onClick={() => {
            if (enCours) return;
            setEnCours(true);
            setRefus(null);
            relire(c.id, jour).then((erreur) => {
              setEnCours(false);
              if (erreur) setRefus(erreur);
            });
          }}
        >
          {enCours ? "…" : "Relire le devis"}
        </Petit>
        <Petit data-atlas="renvoyer-tel-quel" onClick={onRenvoyer}>
          Le renvoyer tel quel
        </Petit>
        <Petit data-atlas="poser-sans-renvoyer" onClick={() => onPoser(c.id)}>
          Le poser sans le renvoyer
        </Petit>
      </Choisir>
      {refus && (
        <p data-atlas="refus-du-geste" className="mt-2 text-[13px]" style={{ color: colors.bordeaux }}>
          {refus}
        </p>
      )}
      <div className="mt-2 flex justify-end">
        <Petit data-atlas="annuler-ajout" onClick={onAnnuler}>
          Annuler
        </Petit>
      </div>
    </div>
  );
}

export function CommentIlSigne({
  jour,
  chantier,
  onAnnuler,
  poserALaPlace,
}: {
  jour: JourIso;
  chantier: ChantierPlanning | null;
  onAnnuler: () => void;
  poserALaPlace: GestesCarte["poserALaPlace"];
}) {
  const [papier, setPapier] = useState(false);
  const [demandeEcrite, setDemandeEcrite] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const dansLeDelai = dansDelaiRetractation(jour, jourIso(new Date()));

  // Le client a répondu entre-temps : il n'est plus dans la liste.
  if (!chantier) {
    return (
      <div className="mt-3.5 pt-3">
        <p data-atlas="refus-du-geste" className="text-[13px]" style={{ color: colors.bordeaux }}>
          Ce client a déjà répondu.
        </p>
        <div className="mt-2 flex justify-end">
          <Petit data-atlas="annuler-ajout" onClick={onAnnuler}>
            Annuler
          </Petit>
        </div>
      </div>
    );
  }

  function envoyer(signature: Parameters<GestesCarte["poserALaPlace"]>[2]) {
    if (enCours || !chantier) return;
    setEnCours(true);
    setRefus(null);
    poserALaPlace(chantier.id, jour, signature).then((erreur) => {
      setEnCours(false);
      if (erreur) setRefus(erreur);
    });
  }

  return (
    <div className="mt-3.5 pt-3">
      <p className="text-[14px]" style={{ color: colors.inkSoft }}>
        {chantier.nom} n&apos;a pas encore signé son devis.
      </p>
      <Choisir>
        <Petit data-atlas="signe-sur-son-lien" onClick={() => envoyer({ maniere: "lien" })}>
          Signe sur son lien
        </Petit>
        <Petit
          data-atlas="signe-sur-papier"
          retenue={papier}
          onClick={() => {
            if (!dansLeDelai) envoyer({ maniere: "papier", demarrageAnticipe: false });
            else setPapier(true);
          }}
        >
          Signé sur papier
        </Petit>
      </Choisir>
      {papier && dansLeDelai && (
        <>
          <label className="mt-2.5 flex items-start gap-2.5 text-[13px]" style={{ color: colors.inkSoft }}>
            <input
              type="checkbox"
              data-atlas="demande-ecrite"
              checked={demandeEcrite}
              onChange={(e) => setDemandeEcrite(e.target.checked)}
              className="mt-0.5 h-5 w-5 flex-none"
            />
            <span>Il a demandé par écrit de commencer avant la fin de ses 14 jours de rétractation.</span>
          </label>
          <div className="mt-2 flex justify-end">
            <Petit
              data-atlas="poser-sur-papier"
              retenue={demandeEcrite}
              onClick={() => {
                if (demandeEcrite) envoyer({ maniere: "papier", demarrageAnticipe: true });
              }}
            >
              {enCours ? "…" : "Poser"}
            </Petit>
          </div>
        </>
      )}
      {refus && (
        <p data-atlas="refus-du-geste" className="mt-2 text-[13px]" style={{ color: colors.bordeaux }}>
          {refus}
        </p>
      )}
      <div className="mt-2 flex justify-end">
        <Petit data-atlas="annuler-ajout" onClick={onAnnuler}>
          Annuler
        </Petit>
      </div>
    </div>
  );
}
