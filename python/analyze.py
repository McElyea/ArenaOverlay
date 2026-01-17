import requests
import json
import os
import numpy as np

SET_CODE = "BRO"
FORMAT = "PremierDraft"
URL = f"https://www.17lands.com/card_data/data?expansion={SET_CODE}&format={FORMAT}"

def fetch_data():
    print(f"Fetching data for {SET_CODE}...")
    headers = {"User-Agent": "ArenaOverlay/0.1 (research tool)"}
    response = requests.get(URL, headers=headers)
    response.raise_for_status()
    return response.json()

def calculate_z_score(data_list):
    arr = np.array(data_list)
    mean = np.mean(arr)
    std = np.std(arr)
    if std == 0:
        return [0.0] * len(data_list)
    return ((arr - mean) / std).tolist()

def analyze():
    raw_data = fetch_data()
    
    # 17Lands returns a list of card objects
    # We need to extract the metrics for normalization
    names = [c['name'] for c in raw_data]
    gih_wrs = [c['gih_wr'] if c['gih_wr'] is not None else 0 for c in raw_data]
    iwds = [c['iwd'] if c['iwd'] is not None else 0 for c in raw_data]
    alsas = [c['alsa'] if c['alsa'] is not None else 0 for c in raw_data]
    
    z_gih = calculate_z_score(gih_wrs)
    z_iwd = calculate_z_score(iwds)
    z_alsa = calculate_z_score(alsas)
    
    # New metrics to extract and normalize
    ohwrs = [c.get('oh_wr', 50.0) for c in raw_data]
    gpwrs = [c.get('gp_wr', 50.0) for c in raw_data]
    atas = [c.get('ata', 8.0) for c in raw_data]
    
    artifact = {}
    for i, card in enumerate(raw_data):
        games = card.get('games_played', 0)
        confidence = min(1.0, np.log10(games + 1) / 4.0) if games > 0 else 0
        
        # Build the structured artifact
        artifact[card['name']] = {
            "name": card['name'],
            "zGih": z_gih[i],
            "zIwd": z_iwd[i],
            "zAlsa": z_alsa[i],
            "confidence": confidence,
            "gamesPlayed": games,
            "colors": card.get('colors', []),
            "cmc": card.get('cmc', 0),
            "types": card.get('types', ["Creature"]),
            "mechanics": [],
            # New multi-source metrics
            "proScore": 3.0, # Placeholder for Pro Grade (LSV)
            "ohwr": (ohwrs[i] - 50) / 10, # Normalized
            "gpwr": (gpwrs[i] - 50) / 10, # Normalized
            "ata": atas[i],
            "colorPairScores": {
                "WU": card.get('wu_wr', 50.0),
                "UB": card.get('ub_wr', 50.0),
                "BR": card.get('br_wr', 50.0),
                "RG": card.get('rg_wr', 50.0),
                "GW": card.get('gw_wr', 50.0),
                "WB": card.get('wb_wr', 50.0),
                "UR": card.get('ur_wr', 50.0),
                "BG": card.get('bg_wr', 50.0),
                "RW": card.get('rw_wr', 50.0),
                "GU": card.get('gu_wr', 50.0)
            }
        }
        
    # Ensure artifacts directory exists
    os.makedirs("artifacts", exist_ok=True)
    
    output_path = f"artifacts/cards_{SET_CODE}.json"
    with open(output_path, "w") as f:
        json.dump(artifact, f, indent=2)
        
    print(f"Artifact created: {output_path} with {len(artifact)} cards.")

if __name__ == "__main__":
    analyze()