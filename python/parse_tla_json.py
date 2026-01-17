import json
import os

json_path = r"V:\Downloads\TLAProScore.json"
output_path = "artifacts/pro_grades.json"

def extract_tla_ratings():
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "cards" not in data:
        print("Error: 'cards' key not found in JSON")
        return

    new_ratings = {}
    for card in data["cards"]:
        name = card.get("name")
        rating = card.get("lsv_rating")
        if name and rating is not None:
            new_ratings[name] = float(rating)

    print(f"Extracted {len(new_ratings)} TLA card ratings.")

    # Load existing ratings
    existing_ratings = {}
    if os.path.exists(output_path):
        try:
            with open(output_path, "r") as f:
                existing_ratings = json.load(f)
        except:
            pass

    # Update with new ratings
    existing_ratings.update(new_ratings)

    with open(output_path, "w") as f:
        json.dump(existing_ratings, f, indent=2)
    
    print(f"Updated {output_path} with TLA ratings.")

if __name__ == "__main__":
    extract_tla_ratings()
