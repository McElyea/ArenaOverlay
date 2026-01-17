import json
import re
import os

html_path = r"V:\Downloads\lorwyn-eclipsed-cfb.html"
output_path = "artifacts/pro_grades.json"

def extract_ratings():
    if not os.path.exists(html_path):
        print(f"Error: {html_path} not found")
        return

    with open(html_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_ratings = {}
    current_name = None
    
    # Process lines to find name followed by ratingLabel
    for line in lines:
        # Look for "name": "..."
        name_match = re.search(r'"name":\s*"([^"]+)"', line)
        if name_match:
            current_name = name_match.group(1)
            # Clean name immediately
            current_name = re.sub(r'\s*\([^)]+\)', '', current_name).strip()
            continue
            
        # Look for "ratingLabel": "..."
        if current_name:
            label_match = re.search(r'"ratingLabel":\s*"([^"]+)"', line)
            if label_match:
                label = label_match.group(1)
                try:
                    rating = float(label)
                    # Use highest rating if duplicates (e.g. borderless/normal)
                    if current_name not in new_ratings or rating > new_ratings[current_name]:
                        new_ratings[current_name] = rating
                except ValueError:
                    pass
                current_name = None # Reset after finding rating

    print(f"Extracted {len(new_ratings)} unique card ratings.")
    
    if not new_ratings:
        print("No ratings found. Check formatting.")
        return

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
    
    print(f"Updated {output_path} with new ratings.")

if __name__ == "__main__":
    extract_ratings()