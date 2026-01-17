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

def fetch_mtgjson_metadata(set_code):
    url = f"https://mtgjson.com/api/v5/{set_code.upper()}.json"
    cache_path = os.path.join(CACHE_DIR, f"mtgjson_{set_code.upper()}.json")
    
    data = fetch_json(url, cache_path=cache_path)
    if not data:
        print(f"MTGJSON for {set_code} not found, falling back to Scryfall...")
        return fetch_scryfall_metadata(set_code)
    
    # Map by identifiers.arenaId
    metadata = {}
    cards = data.get('data', {}).get('cards', [])
    for card in cards:
        arena_id = card.get('identifiers', {}).get('arenaId')
        if arena_id:
            metadata[str(arena_id)] = {
                "cmc": int(card.get('manaValue', 0)),
                "types": card.get('types', []),
                "mana_cost": card.get('manaCost', ''),
                "colors": card.get('colors', []),
                "rarity": card.get('rarity', 'common'),
                "name": card.get('name', ''),
                # Store full MTGJSON object for future expansion
                "mtgjson": card 
            }
    return metadata

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

def clip(val, min_val, max_val):
    return max(min_val, min(val, max_val))

CACHE_DIR = "python/cache"

def get_cache_path(colors=None):
    os.makedirs(CACHE_DIR, exist_ok=True)
    suffix = f"_{colors}" if colors else "_all"
    return os.path.join(CACHE_DIR, f"{SET_CODE}_{FORMAT}{suffix}.json")

def fetch_json(url, cache_path=None, force=False):
    if not force and cache_path and os.path.exists(cache_path):
        # Check if cache is fresh (less than 8 hours old to support 3x daily update check)
        mtime = os.path.getmtime(cache_path)
        if (time.time() - mtime) < (8 * 3600):
            print(f"Using fresh cache: {cache_path}")
            with open(cache_path, "r") as f:
                return json.load(f)

    print(f"Fetching: {url}")
    context = ssl.create_default_context()
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=context) as response:
            data = json.loads(response.read().decode())
            if cache_path:
                with open(cache_path, "w") as f:
                    json.dump(data, f)
            return data
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def get_data_fingerprint(data):
    """Calculate a fingerprint based on total seen counts to detect updates."""
    if not data: return 0
    return sum(c.get('seen_count', 0) or 0 for c in data)

def analyze():
    # 1. Fetch metadata (MTGJSON preferred, Scryfall fallback)
    print(f"Fetching metadata for {SET_CODE}...")
    metadata_map = fetch_mtgjson_metadata(SET_CODE)
    
    # 2. Fetch "All Decks" - This is our Canary fetch
    canary_url = f"{BASE_URL}?expansion={SET_CODE}&format={FORMAT}"
    cache_path_all = get_cache_path()
    
    # Load old cache to compare
    old_data = None
    if os.path.exists(cache_path_all):
        with open(cache_path_all, "r") as f:
            old_data = json.load(f)
    
    # Always fetch fresh canary data to see if 17Lands updated
    all_decks = fetch_json(canary_url, cache_path=cache_path_all, force=True)
    if not all_decks:
        print("Failed to fetch base data. Exiting.")
        return

    # Compare fingerprints
    old_fp = get_data_fingerprint(old_data)
    new_fp = get_data_fingerprint(all_decks)
    
    needs_update = (old_fp != new_fp)
    if not needs_update:
        print(f"Data fingerprint matches ({new_fp}). Skipping color pair fetches.")
    else:
        print(f"Data update detected! Fingerprint: {old_fp} -> {new_fp}")

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
        meta = metadata_map.get(mid, {})
        
        games = card.get('ever_drawn_game_count', 0) or 0
        confidence = min(1.0, np.log10(games + 1) / 4.0) if games > 0 else 0
        
        artifact[mid] = {
            "name": meta.get('name', card['name']),
            "rarity": meta.get('rarity', card.get('rarity', 'common')).lower(),
            "url": card.get('url', ''), # 17Lands image URL
            "zGih": z_gih[i],
            "zIwd": z_iwd[i],
            "zAlsa": z_alsa[i],
            "confidence": confidence,
            "gamesPlayed": games,
            "colors": meta.get('colors', list(card.get('color', ''))),
            "cmc": meta.get('cmc', 0),
            "types": meta.get('types', card.get('types', [])),
            "mechanics": meta.get('mtgjson', {}).get('mechanics', []),
            "ohwr": (card.get('opening_hand_win_rate', 0.5) or 0.5 - 0.5) * 10,
            "gpwr": (card.get('win_rate', 0.5) or 0.5 - 0.5) * 10,
            "ata": card.get('avg_pick', 8) or 8,
            "colorPairScores": {},
            # Standardized MTGJSON fields
            "manaCost": meta.get('mana_cost', ''),
            "manaValue": meta.get('cmc', 0),
            "key": meta.get('mtgjson', {}).get('uuid', mid)
        }

    # 3. Fetch each color pair to populate colorPairScores
    for cp in COLOR_PAIRS:
        cp_cache_path = get_cache_path(cp)
        # Use cache if fingerprint matched, otherwise force a fetch if we are in update mode
        cp_data = fetch_json(f"{BASE_URL}?expansion={SET_CODE}&format={FORMAT}&colors={cp}", 
                            cache_path=cp_cache_path, 
                            force=needs_update)
        
        if not cp_data: continue
        for card in cp_data:
            mid = str(card['mtga_id'])
            if mid in artifact:
                wr = card.get('ever_drawn_win_rate', 0) or 0
                artifact[mid]["colorPairScores"][cp] = wr * 100
        
        if needs_update:
            time.sleep(1) # Only throttle if we are actually hitting the network

    # Ensure artifacts directory exists
    os.makedirs("artifacts", exist_ok=True)
    
    output_path = f"artifacts/cards_{SET_CODE}.json"
    with open(output_path, "w") as f:
        json.dump(artifact, f, indent=2)
        
    print(f"Artifact created: {output_path} with {len(artifact)} cards.")

if __name__ == "__main__":
    analyze()