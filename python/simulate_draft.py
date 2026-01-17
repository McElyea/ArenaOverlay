import time
import os
import json
import platform
import random

def get_log_path():
    home = os.path.expanduser('~')
    if platform.system() == "Windows":
        return os.path.join(home, 'AppData', 'LocalLow', 'Wizards Of The Coast', 'MTGA', 'Player.log')
    elif platform.system() == "Darwin":
        return os.path.join(home, 'Library', 'Logs', 'Wizards Of The Coast', 'MTGA', 'Player.log')
    return "/tmp/Player.log"

LOG_PATH = get_log_path()

def write_line(line):
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def generate_play_booster(set_code):
    artifact_path = f"artifacts/cards_{set_code}.json"
    if not os.path.exists(artifact_path):
        return []
    
    with open(artifact_path, "r") as f:
        cards = json.load(f)
    
    buckets = {
        "common": [],
        "uncommon": [],
        "rare": [],
        "mythic": []
    }
    
    for mid, data in cards.items():
        r = data.get("rarity", "common").lower()
        if r in buckets:
            buckets[r].append(mid)
        else:
            buckets["common"].append(mid)

    def pick(rarity, count=1):
        if not buckets[rarity]: return []
        return random.sample(buckets[rarity], min(count, len(buckets[rarity])))

    pack = []
    
    # 1. Rare/Mythic slot (1 in 7 is Mythic)
    if random.random() < 0.14 and buckets["mythic"]:
        pack.extend(pick("mythic", 1))
    else:
        pack.extend(pick("rare", 1))
        
    # 2. 3 Uncommons
    pack.extend(pick("uncommon", 3))
    
    # 3. 6 Commons
    pack.extend(pick("common", 6))
    
    # 4. 1 Wildcard (Weights: C 18%, U 58%, R 19%, M 2% - roughly)
    w_roll = random.random()
    if w_roll < 0.02: pack.extend(pick("mythic", 1))
    elif w_roll < 0.21: pack.extend(pick("rare", 1))
    elif w_roll < 0.79: pack.extend(pick("uncommon", 1))
    else: pack.extend(pick("common", 1))
    
    # 5. 1 Foil (Any rarity)
    f_roll = random.random()
    if f_roll < 0.01: pack.extend(pick("mythic", 1))
    elif f_roll < 0.05: pack.extend(pick("rare", 1))
    elif f_roll < 0.25: pack.extend(pick("uncommon", 1))
    else: pack.extend(pick("common", 1))
    
    # 6. Land slot (using a common for now)
    pack.extend(pick("common", 1))
    
    # 7. Final slot (Token/Special Guest/Common)
    pack.extend(pick("common", 1))
    
    # Shuffle pack for realism
    random.shuffle(pack)
    return pack

def simulate_draft(set_code):
    print(f"Simulating {set_code} draft in {LOG_PATH}...")
    
    # Event Join
    event_join = {
        "InternalEventName": f"PremierDraft_{set_code}_20260117"
    }
    write_line(f"[UnityCrossThreadLogger]==> Event_Join {json.dumps(event_join)}")
    
    time.sleep(0.5)
    
    # Generate 14-card pack
    pack_ids = generate_play_booster(set_code)
    
    draft_notify = {
        "DraftPack": pack_ids,
        "PickNumber": 1,
        "PickedCards": []
    }
    write_line(f"[UnityCrossThreadLogger]==> Draft.Notify {json.dumps(draft_notify)}")
    print(f"Realistic 14-card {set_code} pack sent to log.")

if __name__ == "__main__":
    import sys
    set_to_sim = sys.argv[1] if len(sys.argv) > 1 else "TLA"
    simulate_draft(set_to_sim)