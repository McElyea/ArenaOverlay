import { scoreCard, willWheel } from "../../shared/weights";
import { CardMetrics, DraftContext } from "../../shared/types";

// Renderer process
console.log("Overlay Renderer Loaded");

const root = document.getElementById("root");
let cardDatabase: Record<string, CardMetrics> = {};

async function loadCardData() {
  try {
    const data = await (window as any).api.loadArtifact("BRO");
    if (data) {
      cardDatabase = data;
      console.log("Loaded card database", cardDatabase);
    } else {
      throw new Error("Artifact not found");
    }
  } catch (e) {
    console.error("Failed to load card database", e);
    // Fallback/Mock data
    cardDatabase = {
      "123": { zGih: 1.2, zIwd: 0.8, zAlsa: -0.5, confidence: 0.9 },
      "456": { zGih: 1.1, zIwd: 0.9, zAlsa: -0.4, confidence: 0.85 },
      "789": { zGih: 0.5, zIwd: 0.2, zAlsa: 0.1, confidence: 0.95 }
    };
  }
}

function render(content: string) {
  if (root) {
    root.innerHTML = content;
  }
}

const UI_CONTAINER = `
  <div style="
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 10px;
    border-radius: 5px;
    font-family: sans-serif;
    pointer-events: auto;
    z-index: 1000;
    min-width: 200px;
  ">
    <div style="font-weight: bold; color: #00ff00; margin-bottom: 5px;">Arena Overlay</div>
    <div id="status" style="font-size: 0.8em; margin-bottom: 10px;">Initializing...</div>
    
    <div style="font-size: 0.7em; font-weight: bold; color: #aaa; margin-bottom: 5px; border-top: 1px solid #444; padding-top: 5px;">MANA CURVE</div>
    <div id="mana-curve" style="display: flex; align-items: flex-end; height: 60px; gap: 4px; margin-bottom: 10px;">
      <!-- Bars will be injected here -->
    </div>

    <button id="mockBtn" style="margin-top: 5px; font-size: 0.7em; width: 100%; cursor: pointer;">Mock Pack</button>
  </div>
  <div id="card-grid" style="
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    grid-template-rows: repeat(2, 1fr);
    pointer-events: none;
    padding: 100px 50px;
    box-sizing: border-box;
    gap: 20px;
  "></div>
`;

render(UI_CONTAINER);

loadCardData().then(() => {
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.innerText = "Ready for Draft";
});

document.getElementById("mockBtn")?.addEventListener("click", () => {
  (window as any).api.sendMockRequest();
});

function updateManaCurve(pickedCards: string[]) {
  const curveEl = document.getElementById("mana-curve");
  if (!curveEl) return;

  const counts = [0, 0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5, 6+
  pickedCards.forEach(id => {
    const card = cardDatabase[id];
    if (card) {
      const index = Math.min(card.cmc, 6);
      counts[index]++;
    }
  });

  const max = Math.max(...counts, 1);
  curveEl.innerHTML = counts.map((count, i) => {
    const height = (count / max) * 100;
    return `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;">
        <div style="width: 100%; background: #00ff00; height: ${height}%; min-height: ${count > 0 ? '2px' : '0'}; opacity: 0.7;"></div>
        <div style="font-size: 8px; color: #aaa; margin-top: 2px;">${i === 6 ? '6+' : i}</div>
      </div>
    `;
  }).join('');
}

(window as any).api.onDraftEvent((event: any) => {
  const grid = document.getElementById("card-grid");
  const statusEl = document.getElementById("status");
  
  // Determine current pool metrics for synergy
  const currentPool: CardMetrics[] = event.pickedCards
    .map((id: string) => cardDatabase[id])
    .filter((m: any) => !!m);

  updateManaCurve(event.pickedCards);

  // Determine current colors in pool
  const poolColors = new Set<string>();
  currentPool.forEach((card: CardMetrics) => {
    if (card.colors) {
      card.colors.forEach(c => poolColors.add(c));
    }
  });
  const currentColors = Array.from(poolColors);

  if (statusEl) {
    statusEl.innerText = `Pack detected: ${event.pack.length} cards | Pool: ${currentColors.join('') || 'None'}`;
  }

  if (grid) {
    grid.innerHTML = event.pack.map((id: string) => {
      const metrics = cardDatabase[id];
      
      // Determine best pair for this specific card for display
      let bestPair = "N/A";
      let bestWR = 0;
      if (metrics && metrics.colorPairScores) {
        Object.entries(metrics.colorPairScores).forEach(([pair, wr]) => {
          if (wr > bestWR) {
            bestWR = wr;
            bestPair = pair;
          }
        });
      }

      const ctx: DraftContext = { 
        pick: event.pick, 
        colors: currentColors,
        setCode: "LOR",
        pool: currentPool,
        activeColorPair: currentColors.length >= 2 ? currentColors.slice(0, 2).sort().join('') : undefined
      };
      
      const score = metrics ? scoreCard(metrics, ctx).toFixed(1) : "??";
      const wheels = metrics ? willWheel(metrics.zAlsa, event.pick) : false;
      const proGrade = metrics ? metrics.proScore.toFixed(1) : "-";
      const statsGih = metrics ? (metrics.zGih * 10).toFixed(0) : "-"; // Scaled for display

      return `
        <div style="
          border: 2px solid ${wheels ? '#a020f0' : (metrics ? '#00ff00' : '#ff0000')};
          background: rgba(0, 0, 0, 0.7);
          color: white;
          display: flex;
          flex-direction: column;
          border-radius: 8px;
          height: 180px;
          position: relative;
          box-shadow: ${wheels ? '0 0 15px #a020f0' : 'none'};
          overflow: hidden;
        ">
          ${wheels ? '<div style="position: absolute; top: 0; right: 0; background: #a020f0; color: white; font-size: 0.5em; padding: 2px 4px; font-weight: bold;">WHEEL</div>' : ''}
          
          <div style="background: rgba(0,255,0,0.2); text-align: center; padding: 5px; font-size: 1.5em; font-weight: bold;">
            ${score}
          </div>

          <div style="padding: 8px; font-size: 0.7em; flex-grow: 1;">
             <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #aaa;">Pro Grade (LSV):</span>
                <span style="color: #00ff00; font-weight: bold;">${proGrade}</span>
             </div>
             <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #aaa;">17Lands GIH:</span>
                <span style="color: #00ff00; font-weight: bold;">${statsGih}</span>
             </div>
             <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #aaa;">Best Pair:</span>
                <span style="color: #00ff00; font-weight: bold;">${bestPair} (${bestWR.toFixed(0)}%)</span>
             </div>
             <div style="display: flex; justify-content: space-between;">
                <span style="color: #aaa;">ID:</span>
                <span style="color: #666;">${id}</span>
             </div>
          </div>
        </div>
      `;
    }).join('');
  }
});
