// functions/src/ingest17lands.ts

export interface Raw17LandsCard {
  card_name: string;
  color: string;
  rarity: string;
  gih_wr: number;
  iwd: number;
  alsa: number;
  games_played: number;
}

export async function fetch17LandsData(): Promise<Raw17LandsCard[]> {
  // Example endpoint (we will refine this)
  const url =
    "https://www.17lands.com/card_data?expansion=BRO&format=PremierDraft";

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ArenaOverlay/0.1 (research tool)"
    }
  });

  if (!response.ok) {
    throw new Error(
      `17Lands fetch failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Unexpected 17Lands response shape");
  }

  return data as Raw17LandsCard[];
}
