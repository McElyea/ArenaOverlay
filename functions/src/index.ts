import { onSchedule } from "firebase-functions/v2/scheduler";

export const ingest17lands = onSchedule("every 24 hours", async () => {
  console.log("Ingest job placeholder");
});
