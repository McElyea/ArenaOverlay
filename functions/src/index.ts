import { onSchedule } from "firebase-functions/v2/scheduler";
import { fetch17LandsData } from "./ingest17lands";
import { scoreCards } from "./score17lands";
import { writeSnapshot } from "./firestoreWriter";

const SET_CODE = "BRO";
const FORMAT = "PremierDraft";

export const ingest17lands = onSchedule("every 24 hours", async () => {
  console.log("Starting 17Lands ingestion…");

  const cards = await fetch17LandsData();
  const scored = scoreCards(cards);

  await writeSnapshot(SET_CODE, FORMAT, scored, {
    gih: 0.55,
    iwd: 0.25,
    alsa: 0.20
  });

  console.log(`Snapshot written for ${SET_CODE}`);
});
