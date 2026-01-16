# Magic Arena Draft Overlay (Firebase + TypeScript + Python)

This project is a serverless Magic Arena draft overlay using:
- Firebase (Firestore, Functions, Hosting)
- TypeScript for all production logic
- Isolated Python for analysis / ML artifacts

## Structure
- functions/  Firebase Cloud Functions (TypeScript)
- shared/     Shared types and weighting logic
- overlay/    Client overlay (placeholder)
- python/     Offline analysis & ML (isolated)
- artifacts/  Generated JSON artifacts

## Philosophy
TypeScript is the source of truth.
Python only produces artifacts.
