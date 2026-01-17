import urllib.request
import json
import ssl

context = ssl.SSLContext()
SET_CODE = "DSK"
FORMAT = "PremierDraft"
url = f"https://www.17lands.com/card_ratings/data?expansion={SET_CODE}&format={FORMAT}"

try:
    url_data = urllib.request.urlopen(url, context=context).read()
    data = json.loads(url_data)
    if data:
        print("Success! Keys:", data[0].keys())
        print("First card sample:", data[0])
    else:
        print("Success, but data is empty.")
except Exception as e:
    print(f"Failed: {e}")
