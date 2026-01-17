import { CardMetrics, DraftContext } from "./types";

export function scoreCard(metrics: CardMetrics, ctx: DraftContext): number {
  // 1. Bayesian Adjustment (Stabilize 17Lands GIH)
  const BAYESIAN_CONSTANT = 100;
  const SET_MEAN_Z = 0.0;
  const adjustedGih = ( (metrics.zGih * metrics.gamesPlayed) + (SET_MEAN_Z * BAYESIAN_CONSTANT) ) / (metrics.gamesPlayed + BAYESIAN_CONSTANT);

  // 2. Base Power (Combine GIH, OHWR, and GPWR for a robust 17Lands "Next 3" score)
  // Weights: GIH (50%), OHWR (30%), GPWR (20%)
  const power17Lands = (0.5 * adjustedGih) + (0.3 * metrics.ohwr) + (0.2 * metrics.gpwr);

  // 3. Archetype specific bonus
  let colorPairBonus = 0;
  if (ctx.activeColorPair && metrics.colorPairScores[ctx.activeColorPair]) {
    // If we are in a specific archetype, prioritize that pair's win rate
    colorPairBonus = (metrics.colorPairScores[ctx.activeColorPair] - 50) / 10; // Simple normalization
  }

  // 4. Scarcity (ALSA)
  const scarcity = -0.3 * metrics.zAlsa;

  // Final Weighted Composition
  // 60% 17Lands Stats, 30% Color Pair Fit, 10% Scarcity
  let score = (0.6 * power17Lands) + (0.3 * colorPairBonus) + (0.1 * scarcity);
  
  score *= metrics.confidence;

  // Synergy Logic
  const synergyBoost = calculateSynergy(metrics, ctx);
  score *= synergyBoost;

  // Color Affinity Boost
  if (ctx.colors.length > 0) {
    const matchesColor = metrics.colors.some(color => ctx.colors.includes(color));
    if (matchesColor) {
      score *= 1.20;
    } else {
      // Slight penalty or neutral for off-color cards late in the draft? 
      // For now, just a smaller boost if they are colorless/generic
      if (metrics.colors.length === 0) score *= 1.05;
    }
  }

  return score;
}

export function willWheel(alsa: number, pick: number): boolean {
  // If the Average Last Seen At is significantly higher than the current pick,
  // it's likely to 'wheel' (be available when the pack returns at pick 9).
  // Standard logic from reference: if ALSA > 8 + current_pick
  return alsa > (8 + pick);
}

function calculateSynergy(metrics: CardMetrics, ctx: DraftContext): number {
  let boost = 1.0;

  switch (ctx.setCode) {
    case "ECL": // Lorwyn Eclipsed - High Tribal Synergy
      // For every card in our pool that shares a type with this card, add a 2% boost
      const matchingTypes = ctx.pool.filter(p => 
        p.types.some(t => t !== "Creature" && metrics.types.includes(t))
      ).length;
      boost += (matchingTypes * 0.02);
      break;

    case "TLA": // Avatar - Ally Synergy only
      if (metrics.types.includes("Ally")) {
        const alliesInPool = ctx.pool.filter(p => p.types.includes("Ally")).length;
        // Allies get exponentially better
        boost += (alliesInPool * 0.05);
      }
      break;

    default:
      // Generic mechanical synergy could go here
      break;
  }

  return Math.min(boost, 1.5); // Cap synergy at 50%
}
