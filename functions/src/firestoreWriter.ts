// functions/src/firestoreWriter.ts

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";
import { ScoredCard } from "./score17lands";

initializeApp();
const db = getFirestore();

export async function writeSnapshot(
  setCode: string,
  format: string,
  cards: ScoredCard[],
  weights: Record<string, number>
) {
  const snapshotRef = db
    .collection("sets")
    .doc(setCode)
    .collection("snapshots")
    .doc();

  const batch = db.batch();

  batch.set(snapshotRef, {
    createdAt: Timestamp.now(),
    format,
    weights,
    cardCount: cards.length
  });

  for (const card of cards) {
    const cardRef = db
      .collection("sets")
      .doc(setCode)
      .collection("cards")
      .doc(card.card_name);

    batch.set(cardRef, {
      score: card.score,
      confidence: card.confidence,
      snapshotId: snapshotRef.id,
      lastUpdated: Timestamp.now()
    });
  }

  await batch.commit();
}
