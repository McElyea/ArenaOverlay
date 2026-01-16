import { CardMetrics, DraftContext } from "./types";

export function scoreCard(metrics: CardMetrics, ctx: DraftContext): number {
  const power = 0.6 * metrics.zGih + 0.4 * metrics.zIwd;
  const scarcity = -0.3 * metrics.zAlsa;

  let score = power + scarcity;
  score *= metrics.confidence;

  if (ctx.colors.length > 0) score *= 1.05;

  return score;
}
