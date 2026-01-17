import { onSchedule } from "firebase-functions/v2/scheduler";
import { fetch17LandsData } from "./ingest17lands";
import { scoreCards } from "./score17lands";

export const ingest17lands = onSchedule("every 24 hours", async () => {
  console.log("Starting 17Lands ingestion…");

  const cards = await fetch17LandsData();
  const scored = scoreCards(cards);

  console.log(`Scored ${scored.length} cards`);
  console.log("Top card:", scored.sort((a, b) => b.score - a.score)[0]);
});
