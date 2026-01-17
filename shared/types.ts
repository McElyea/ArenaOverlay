export interface CardMetrics {
  name: string;
  rarity: string;
  url: string;
  zGih: number;
  zIwd: number;
  zAlsa: number;
  confidence: number;
  gamesPlayed: number;
  colors: string[];
  cmc: number;
  types: string[];
  mechanics: string[];
  
  // New metrics requested
  proScore: number;                 // e.g. 0-5 scale or normalized
  colorPairScores: Record<string, number>; // e.g. {"WU": 55.2, "UB": 48.1, ...}
  ohwr: number;                     // Opening Hand Win Rate
  gpwr: number;                     // Games Played Win Rate
  ata: number;                      // Average Taken At
}

export interface DraftContext {
  pick: number;
  colors: string[];
  setCode: string;
  pool: CardMetrics[];
  activeColorPair?: string;        // e.g. "BR" if the user has committed to an archetype
}
