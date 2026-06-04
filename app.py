from datetime import datetime
import os
import requests
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from dotenv import load_dotenv
from riotwatcher import ApiError, LolWatcher, RiotWatcher

load_dotenv()

app = Flask(__name__)
CORS(app)  

API_KEY = os.getenv("RIOT")

watcher = LolWatcher(API_KEY)
rWatcher = RiotWatcher(API_KEY)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/mastery', methods=['GET'])
def get_mastery():
    game_name = request.args.get('name')
    tag_line = request.args.get('tag')
    routing_region = request.args.get('routing', 'europe')
    platform_region = request.args.get('platform', 'euw1')
    
    if not game_name or not tag_line:
        return jsonify({"error": "Game name and tag line are required"}), 400

    try:
        ddragon_url = "https://ddragon.leagueoflegends.com/cdn/16.11.1/data/en_US/champion.json"
        response = requests.get(ddragon_url).json()
        champ_mapping = {int(data["key"]): data["name"] for data in response["data"].values()}

        account_data = rWatcher.account.by_riot_id(routing_region, game_name, tag_line)
        puuid = account_data['puuid']
        raw_mastery = watcher.champion_mastery.by_puuid(platform_region, puuid)

        cleaned_list = []
        played_champions = set()

        for entry in raw_mastery:
            champ_id = entry.get("championId")
            champ_name = champ_mapping.get(champ_id, f"Unknown ({champ_id})")
            played_champions.add(champ_name)

            ms_timestamp = entry.get("lastPlayTime", 0)
            readable_time = datetime.fromtimestamp(ms_timestamp / 1000).strftime("%Y-%m-%d %H:%M:%S")

            cleaned_list.append({
                "championName": champ_name,
                "championLevel": entry.get("championLevel", 0),
                "championPoints": entry.get("championPoints", 0),
                "championPointsUntilNextLevel": entry.get("championPointsUntilNextLevel", 0),
                "lastPlayTime": readable_time,
            })

        all_champs = set(data["name"] for data in response["data"].values())
        for champ_name in all_champs:
            if champ_name not in played_champions:
                cleaned_list.append({
                    "championName": champ_name,
                    "championLevel": 0,
                    "championPoints": 0,
                    "championPointsUntilNextLevel": 1800,
                    "lastPlayTime": "-"
                })
                played_champions.add(champ_name)

        return jsonify(cleaned_list)

    except ApiError as err:
        return jsonify({"error": f"Riot API Error: {err.response.status_code}"}), err.response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)