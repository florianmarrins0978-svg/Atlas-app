import type { SalarieDuMois } from "@/server/repositories/jours-travailles";
import { phraseDeLAbsence } from "@/lib/jours-travailles";
import { cleDeCase, phraseDuJourSansZone, villeDeLAdresse } from "@/lib/zones-deplacement";

/** Un jour dans une zone, prêt à lire : la date, la ville, la rue, la distance. */
export type JourDeZone = { jour: string; depot: boolean; ville: string; rue: string | null; chez: string | null; km: number | null };

/** Ce que l'écran reçoit d'un salarié : des phrases et des nombres, rien à décider. */
export type SalarieVu = {
  rang: number;
  nom: string;
  calcul: number;
  saisi: number | null;
  motif: SalarieDuMois["motif"];
  absences: { texte: string; jours: number }[];
  zones: null | {
    /** Ce que le planning compte, case par case (« z0 »… « hors »). */
    calcul: Record<string, number>;
    corrigees: Record<string, number>;
    jours: Record<string, JourDeZone[]>;
    sansZone: string[];
  };
};

export function vueDuMois(s: SalarieDuMois): SalarieVu {
  let zones: SalarieVu["zones"] = null;
  if (s.zones) {
    const calcul: Record<string, number> = { hors: s.zones.hors };
    s.zones.parZone.forEach((n, i) => (calcul[`z${i}`] = n));
    const jours: Record<string, JourDeZone[]> = {};
    for (const p of s.zones.jours) {
      if (p.case === null) continue;
      const cle = cleDeCase(p.case);
      const { ville, rue } = p.depot ? { ville: "Au dépôt", rue: null } : villeDeLAdresse(p.chantier?.adresse ?? null);
      (jours[cle] ??= []).push({ jour: p.jour, depot: p.depot, ville, rue, chez: p.chantier?.nom ?? null, km: p.km });
    }
    zones = { calcul, corrigees: s.zonesCorrigees, jours, sansZone: s.zones.sansZone.map(phraseDuJourSansZone) };
  }
  return {
    rang: s.rang,
    nom: s.nom,
    calcul: s.compte.calcul,
    saisi: s.saisi,
    motif: s.motif,
    absences: s.compte.absences.map((a) => ({ texte: phraseDeLAbsence(a), jours: a.jours })),
    zones,
  };
}
