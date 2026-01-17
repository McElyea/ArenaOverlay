# ArenaOverlay

A professional-grade Magic Arena draft overlay that combines real-time log monitoring with expert ratings and 17Lands statistical analysis.

## Tech Stack & Philosophy

This project is built on a "TypeScript as Truth" philosophy, ensuring that all production logic is type-safe and consistent across the application.

- **Frontend/Overlay:** **Electron** with **TypeScript**. We chose Electron for its robust support for transparent, "Always-on-Top" windows and its ability to interact directly with the local file system.
- **Data Pipeline:** **Python**. Isolated for data scraping, ML analysis, and artifact generation. It merges 17Lands win rates with Scryfall metadata into optimized JSON artifacts.
- **Styling:** CSS-in-JS for rapid UI iteration, enabling glassmorphism effects and complex hover interactions.

## Key Features

- **Intelligent Scoring:** 
    - Weighted composition of 17Lands stats (GIHWR, OHWR, GPWR).
- **Advanced UI/UX:**
    - **Hover Zoom:** Cards scale to 175% on hover for clear art and text reading.
    - **Smart Sorting:** Packs are automatically sorted by Rarity (Mythic > Rare > etc.) and then by Score.
    - **Draggable Interface:** The status HUD can be repositioned live to avoid obscuring game elements.
- **Efficient Caching:** A "Canary Fetch" system fingerprints 17Lands data. It only performs expensive color-pair network requests if it detects that the global game counts have changed.

## Testing Strategy

To ensure high-fidelity integration without the cost of real drafting, we utilize a multi-tiered test harness:

1. **Virtual Log Simulation (`simulate_draft.py`):** A Python utility that appends authentic-format MTGA strings to the actual `Player.log`. It includes a **Play Booster Algorithm** that mimics real 2026 pack distributions (wildcards, foils, etc.).
2. **UI Mocking:** Dedicated IPC handlers allow the renderer to bypass the file system entirely for rapid UI testing.
3. **Set-Specific Seeds:** Pre-defined test cases for **Avatar: The Last Airbender (TLA)** and **Lorwyn Eclipsed (ECL)** to verify tribal and ally synergy weights.

## Setup

1. **Install Dependencies:**
   ```bash
   cd overlay && npm install
   pip install -r python/requirements.txt
   ```
2. **Generate Artifacts:**
   ```bash
   python python/analyze.py
   ```
3. **Launch Overlay:**
   ```bash
   npm start
   ```