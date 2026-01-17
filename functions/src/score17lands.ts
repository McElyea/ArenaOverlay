// functions/src/score17lands.ts

import { Raw17LandsCard } from "./ingest17lands";
import { mean, stddev, zScore } from "./normalize";

export interface ScoredCard extends Raw17LandsCard {
  score: number;
  confidence: number;
}

export function scoreCards(cards: Raw17LandsCard[]): ScoredCard[] {
  const gihWRs = cards.map(c => c.gih_wr);
  const iwd = cards.map(c => c.iwd);
  const alsa = cards.map(c => c.alsa);

  const stats = {
    gih: { m: mean(gihWRs), s: stddev(gihWRs) },
    iwd: { m: mean(iwd), s: stddev(iwd) },
    alsa: { m: mean(alsa), s: stddev(alsa) }
  };

  return cards.map(card => {
    const gihZ = zScore(card.gih_wr, stats.gih.m, stats.gih.s);
    const iwdZ = zScore(card.iwd, stats.iwd.m, stats.iwd.s);
    const alsaZ = -zScore(card.alsa, stats.alsa.m, stats.alsa.s); // lower ALSA is better

    // Weighting (tunable)
    const rawScore =
      gihZ * 0.55 +
      iwdZ * 0.25 +
      alsaZ * 0.20;

    // Confidence curve (log-based, stable)
    const confidence = Math.min(
      1,
      Math.log10(card.games_played + 1) / 4
    );

    return {
      ...card,
      score: rawScore * confidence,
      confidence
    };
  });
}
