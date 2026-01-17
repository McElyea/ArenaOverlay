import { scoreCard, willWheel } from "../../shared/weights";
import { CardMetrics, DraftContext } from "../../shared/types";

// Renderer process
console.log("Overlay Renderer Loaded");

const root = document.getElementById("root");
let cardDatabase: Record<string, CardMetrics> = {};
let currentExpansion: string | undefined;

async function loadExpansion(setName: string) {
  if (currentExpansion === setName) return;
  
  try {
    const data = await (window as any).api.loadArtifact(setName);
    if (data) {
      cardDatabase = data;
      currentExpansion = setName;
      console.log(`Loaded card database for ${setName}`, Object.keys(cardDatabase).length, "cards");
      const statusEl = document.getElementById("status");
      if (statusEl) statusEl.innerText = `Set: ${setName} | Ready`;
    }
  } catch (e) {
    console.error(`Failed to load card database for ${setName}`, e);
  }
}

function render(content: string) {
  if (root) {
    root.innerHTML = content;
  }
}

const UI_CONTAINER = `
  <style>
    .interaction-layer:hover ~ .card-image-container {
      z-index: 5000;
    }
    .interaction-layer:hover ~ .card-image-container .card-image {
      transform: scale(1.75);
      box-shadow: 0 0 35px rgba(0,0,0,1);
      z-index: 5001;
      border-radius: 10px;
    }
    .interaction-layer:hover {
      z-index: 5002;
    }
  </style>
  <div id="ui-container" style="
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: #fff;
    padding: 15px;
    border: 2px solid #ff00ff; /* Bright Magenta Border for Visibility */
    border-radius: 5px;
    font-family: sans-serif;
    pointer-events: auto;
    z-index: 1000;
    min-width: 200px;
    cursor: grab;
  ">
    <div id="drag-handle" style="font-weight: bold; color: #00ff00; margin-bottom: 5px; border-bottom: 1px solid #333; padding-bottom: 5px;">Arena Overlay</div>
    <div id="status" style="font-size: 0.8em; margin-bottom: 10px;">Initializing...</div>
    
    <div style="font-size: 0.7em; font-weight: bold; color: #aaa; margin-bottom: 5px; border-top: 1px solid #444; padding-top: 5px;">MANA CURVE</div>
    <div id="mana-curve" style="display: flex; align-items: flex-end; height: 60px; gap: 4px; margin-bottom: 10px;">
      <!-- Bars will be injected here -->
    </div>

    <div style="display: flex; gap: 4px; margin-top: 5px;">
      <button id="mockTlaBtn" style="font-size: 0.7em; flex: 1; cursor: pointer;">Mock Avatar P1P1</button>
      <button id="mockEclBtn" style="font-size: 0.7em; flex: 1; cursor: pointer;">Mock Lorwyn P1P1</button>
    </div>
    <div style="display: flex; gap: 4px; margin-top: 5px; border-top: 1px solid #333; padding-top: 5px;">
      <button id="simTlaBtn" style="font-size: 0.7em; flex: 1; cursor: pointer; background: #224; color: #fff;">Sim Log: TLA</button>
      <button id="simEclBtn" style="font-size: 0.7em; flex: 1; cursor: pointer; background: #224; color: #fff;">Sim Log: ECL</button>
    </div>
    <button id="clearBtn" style="font-size: 0.7em; width: 100%; margin-top: 5px; cursor: pointer; background: #422; color: #fff;">Clear Pack</button>
  </div>
  <div id="card-grid" style="
    position: absolute;
    top: 200px; /* Move down to avoid overlapping the header */
    left: 0;
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    pointer-events: auto; /* Enable clicks on cards */
    padding: 20px;
    box-sizing: border-box;
    gap: 15px;
    min-height: 450px;
  "></div>
`;

render(UI_CONTAINER);

// Attach listeners AFTER render
document.getElementById("mockTlaBtn")?.addEventListener("click", () => {
  console.log("Mock TLA clicked");
  (window as any).api.sendMockRequest("TLA_P1P1");
});

document.getElementById("mockEclBtn")?.addEventListener("click", () => {
  console.log("Mock ECL clicked");
  (window as any).api.sendMockRequest("ECL_P1P1");
});

document.getElementById("simTlaBtn")?.addEventListener("click", () => {
  console.log("Sim TLA clicked");
  (window as any).api.runSimulation("TLA");
});

document.getElementById("simEclBtn")?.addEventListener("click", () => {
  console.log("Sim ECL clicked");
  (window as any).api.runSimulation("ECL");
});

document.getElementById("clearBtn")?.addEventListener("click", () => {
  const grid = document.getElementById("card-grid");
  if (grid) grid.innerHTML = "";
});

// Drag Logic
const uiContainer = document.getElementById("ui-container");
if (uiContainer) {
  let isDragging = false;
  let offset = { x: 0, y: 0 };

  uiContainer.addEventListener("mousedown", (e) => {
    isDragging = true;
    offset = {
      x: uiContainer.offsetLeft - e.clientX,
      y: uiContainer.offsetTop - e.clientY,
    };
    uiContainer.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      uiContainer.style.left = e.clientX + offset.x + "px";
      uiContainer.style.top = e.clientY + offset.y + "px";
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    if (uiContainer) uiContainer.style.cursor = "grab";
  });
}

const statusEl_initial = document.getElementById("status");
if (statusEl_initial) statusEl_initial.innerText = "Waiting for draft...";

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

(window as any).api.onDraftEvent(async (event: any) => {
  if (event.expansion) {
    await loadExpansion(event.expansion);
  }

  if (Object.keys(cardDatabase).length === 0) {
    console.warn("Database not loaded yet, skipping render");
    return;
  }

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
    statusEl.innerText = `Pack: ${event.pack.length} | Pool: ${currentColors.join('') || 'None'} | ${event.expansion || 'Unknown Set'}`;
  }

  if (grid) {
    const rarityOrder: Record<string, number> = { "mythic": 4, "rare": 3, "uncommon": 2, "common": 1 };
    
    // Sort pack by rarity descending, then by score descending
    const sortedPack = [...event.pack].sort((a, b) => {
      const metricsA = cardDatabase[a];
      const metricsB = cardDatabase[b];
      const rarityA = metricsA?.rarity?.toLowerCase() || "common";
      const rarityB = metricsB?.rarity?.toLowerCase() || "common";
      
      const rA = rarityOrder[rarityA] || 0;
      const rB = rarityOrder[rarityB] || 0;

      if (rA !== rB) return rB - rA;

      // Tie-breaker: Score (requires recalculating or pre-calculating)
      const ctx: DraftContext = { 
        pick: event.pick, 
        colors: currentColors,
        setCode: event.expansion || "DSK",
        pool: currentPool
      };
      const scoreA = metricsA ? scoreCard(metricsA, ctx) : 0;
      const scoreB = metricsB ? scoreCard(metricsB, ctx) : 0;
      return scoreB - scoreA;
    });

    grid.innerHTML = sortedPack.map((id: string) => {
      const metrics = cardDatabase[id];
      const name = metrics ? metrics.name : `Unknown (${id})`;
      
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
        setCode: event.expansion || "DSK",
        pool: currentPool,
        activeColorPair: currentColors.length >= 2 ? currentColors.slice(0, 2).sort().join('') : undefined
      };
      
      const scoreNum = metrics ? scoreCard(metrics, ctx) : 0;
      const score = metrics ? scoreNum.toFixed(1) : "??";
      const wheels = metrics ? willWheel(metrics.ata, event.pick) : false; // Using ATA for wheeling if zAlsa is unreliable
      const proGrade = metrics && metrics.proScore !== -1 ? metrics.proScore.toFixed(1) : "N/A";
      const statsGih = metrics ? (metrics.zGih * 10).toFixed(0) : "-"; 

      // Color mapping for score
      let scoreColor = "#fff";
      if (scoreNum > 1.5) scoreColor = "#00ff00";
      else if (scoreNum > 0.5) scoreColor = "#adff2f";
      else if (scoreNum < -0.5) scoreColor = "#ff4500";

      return `
        <div style="
          border: 2px solid ${wheels ? '#a020f0' : (metrics ? '#444' : '#ff0000')};
          background: #000;
          display: flex;
          flex-direction: column;
          border-radius: 10px;
          height: 450px; 
          position: relative;
          box-shadow: ${wheels ? '0 0 20px #a020f0' : '0 4px 12px rgba(0,0,0,0.5)'};
          overflow: hidden;
        ">
          <!-- Card Art Background -->
          <div class="card-image-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;">
             ${metrics?.url ? `<img src="${metrics.url}" class="card-image" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.1s ease;" />` : '<div style="width: 100%; height: 100%; background: #222;"></div>'}
          </div>

          <!-- Overlay Elements -->
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 20%, transparent 70%, rgba(0,0,0,0.8) 100%);">
            
            <!-- Top Bar: Score and Wheel -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 8px;">
               <div style="background: rgba(0,0,0,0.8); border: 2px solid ${scoreColor}; color: ${scoreColor}; padding: 4px 12px; border-radius: 6px; font-size: 2.2em; font-weight: 900; box-shadow: 0 0 10px rgba(0,0,0,0.5); text-shadow: 2px 2px 4px #000;">
                 ${score}
               </div>
               ${wheels ? '<div style="background: #a020f0; color: white; font-size: 0.8em; padding: 4px 8px; font-weight: bold; border-radius: 4px; box-shadow: 0 0 10px #a020f0;">WHEEL</div>' : '<div></div>'}
            </div>

            <!-- Bottom Bar: Name and Stats -->
            <div style="padding: 10px; background: rgba(0,0,0,0.85); border-top: 1px solid rgba(255,255,255,0.1);">
               <div style="font-weight: bold; color: #fff; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 1.1em;" title="${name}">
                  ${name}
               </div>
               <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 0.75em;">
                  <div style="color: #aaa;">PRO: <span style="color: #fff; font-weight: bold;">${proGrade}</span></div>
                  <div style="color: #aaa;">GIH: <span style="color: #fff; font-weight: bold;">${metrics ? metrics.zGih.toFixed(2) : '-'}</span></div>
                  <div style="color: #aaa; grid-column: span 2; border-top: 1px solid #444; margin-top: 2px; padding-top: 2px;">
                    PAIR: <span style="color: #adff2f; font-weight: bold;">${bestPair} (${bestWR.toFixed(0)}%)</span>
                  </div>
               </div>
            </div>
          </div>

          <!-- Interaction Layer (Invisible but clickable) -->
          <div class="interaction-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 3; pointer-events: auto; cursor: help;"></div>
        </div>
      `;
    }).join('');
  }
});
