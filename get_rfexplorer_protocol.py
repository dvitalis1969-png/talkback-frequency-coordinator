import urllib.request
import json
try:
    url = "https://raw.githubusercontent.com/jeroen-/rfexplorer/master/rfexplorer/serial_parser.py"
    req = urllib.request.urlopen(url)
    print(req.read().decode('utf-8'))
except Exception as e:
    print(e)
