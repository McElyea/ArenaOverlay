import urllib.request
import json
import ssl
import os
import numpy as np
import time
from urllib.parse import quote

SET_CODE = "TLA"
FORMAT = "PremierDraft"
BASE_URL = "https://www.17lands.com/card_ratings/data"
COLOR_PAIRS = ["WU", "UB", "BR", "RG", "GW", "WB", "UR", "BG", "RW", "GU"]

def fetch_json(url):
    print(f"Fetching: {url}")
    context = ssl.create_default_context()
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=context) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def fetch_scryfall_metadata(set_code):
    url = f"https://api.scryfall.com/cards/search?q=set%3A{set_code.lower()}+is%3Abooster"
    all_cards = []
    while url:
        data = fetch_json(url)
        if not data: break
        all_cards.extend(data.get('data', []))
        if data.get('has_more'):
            url = data.get('next_page')
        else:
            url = None
        time.sleep(0.1) # Scryfall is fast but let's be polite
    
    # Map by arena_id
    metadata = {}
    for card in all_cards:
        if 'arena_id' in card:
            # Handle double faced cards
            types = []
            if 'card_faces' in card:
                for face in card['card_faces']:
                    types.extend(face.get('type_line', '').split(' — ')[0].split(' '))
            else:
                types = card.get('type_line', '').split(' — ')[0].split(' ')
            
            # Filter empty types and common filler
            types = [t for t in types if t and t not in ['—', '//']]
            
            metadata[str(card['arena_id'])] = {
                "cmc": int(card.get('cmc', 0)),
                "types": types,
                "mana_cost": card.get('mana_cost', '')
            }
    return metadata

def calculate_z_score(data_list):
    arr = np.array(data_list)
    if len(arr) == 0: return []
    mean = np.mean(arr)
    std = np.std(arr)
    if std == 0:
        return [0.0] * len(data_list)
    return ((arr - mean) / std).tolist()

def analyze():
    # 1. Fetch metadata from Scryfall
    print("Fetching Scryfall metadata...")
    scryfall_map = fetch_scryfall_metadata(SET_CODE)
    
    # 2. Fetch "All Decks" as the base
    all_decks = fetch_json(f"{BASE_URL}?expansion={SET_CODE}&format={FORMAT}")
    if not all_decks:
        print("Failed to fetch base data. Exiting.")
        return

    # Extract base metrics for Z-scoring
    gih_wrs = [c.get('ever_drawn_win_rate', 0) or 0 for c in all_decks]
    iwds = [c.get('drawn_improvement_win_rate', 0) or 0 for c in all_decks]
    alsas = [c.get('avg_seen', 8) or 8 for c in all_decks]
    
    z_gih = calculate_z_score(gih_wrs)
    z_iwd = calculate_z_score(iwds)
    z_alsa = calculate_z_score(alsas)

    artifact = {}
    
    # Initialize artifact with base data
    for i, card in enumerate(all_decks):
        mid = str(card['mtga_id'])
        meta = scryfall_map.get(mid, {})
        
        games = card.get('ever_drawn_game_count', 0) or 0
        confidence = min(1.0, np.log10(games + 1) / 4.0) if games > 0 else 0
        
        card_colors = list(card.get('color', ''))
        
        artifact[mid] = {
            "name": card['name'],
            "rarity": card.get('rarity', 'common'),
            "url": card.get('url', ''), # 17Lands image URL
            "zGih": z_gih[i],
            "zIwd": z_iwd[i],
            "zAlsa": z_alsa[i],
            "confidence": confidence,
            "gamesPlayed": games,
            "colors": card_colors,
            "cmc": meta.get('cmc', 0),
            "types": meta.get('types', card.get('types', [])),
            "mechanics": [],
            "proScore": 3.0, # Placeholder
            "ohwr": (card.get('opening_hand_win_rate', 0.5) or 0.5 - 0.5) * 10,
            "gpwr": (card.get('win_rate', 0.5) or 0.5 - 0.5) * 10,
            "ata": card.get('avg_pick', 8) or 8,
            "colorPairScores": {}
        }

    # 3. Fetch each color pair to populate colorPairScores
    for cp in COLOR_PAIRS:
        time.sleep(1)
        cp_data = fetch_json(f"{BASE_URL}?expansion={SET_CODE}&format={FORMAT}&colors={cp}")
        if not cp_data: continue
        for card in cp_data:
            mid = str(card['mtga_id'])
            if mid in artifact:
                wr = card.get('ever_drawn_win_rate', 0) or 0
                artifact[mid]["colorPairScores"][cp] = wr * 100

    # Ensure artifacts directory exists
    os.makedirs("artifacts", exist_ok=True)
    
    output_path = f"artifacts/cards_{SET_CODE}.json"
    with open(output_path, "w") as f:
        json.dump(artifact, f, indent=2)
        
    print(f"Artifact created: {output_path} with {len(artifact)} cards.")

if __name__ == "__main__":
    analyze()