import urllib.request
import json
import ssl

context = ssl.create_default_context()
url = "https://www.17lands.com/data/filters"

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=context) as response:
        data = json.loads(response.read().decode())
        print("Expansions:", data.get("expansions"))
except Exception as e:
    print(f"Failed: {e}")
