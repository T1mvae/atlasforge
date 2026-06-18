#!/usr/bin/env python3
# AtlasForge — build tools/atlas_seeds.json: the canonical, self-contained list of
# hand-authored region seeds (name EN/RU, real lat/lon, region type).
# The seed list itself is original authorship (no game data involved); this script
# just snapshots it out of tools/generate_regions.py and tags each seed with a type.
import json

src = open("tools/generate_regions.py").read()
prefix = src.split("# ---------------------------------------------------------------- helpers")[0]
ns = {}
exec(prefix, ns)
SEEDS = ns["SEEDS"]

# Regions named after historical polities, provinces of empires, or classic
# historical areas. Everything not listed in HISTORICAL/CULTURAL is geographical.
HISTORICAL = {
 "Northumbria","Wessex","Mercia","East Anglia","Ulster","Connacht","Leinster","Munster",
 "Brittany","Normandy","Ile-de-France","Picardy","Champagne","Lorraine","Alsace","Burgundy",
 "Anjou","Poitou","Aquitaine","Gascony","Languedoc","Provence","Auvergne","Savoy",
 "Galicia","Asturias","Old Castile","New Castile","Aragon","Catalonia","Valencia","Murcia",
 "Andalusia","Extremadura","Northern Portugal","Southern Portugal",
 "Piedmont","Lombardy","Venetia","Liguria","Emilia","Tuscany","Latium","Umbria","Abruzzo",
 "Campania","Apulia","Calabria","Flanders","Wallonia","Holland","Frisia",
 "Rhineland","Westphalia","Lower Saxony","Schleswig-Holstein","Mecklenburg","Brandenburg",
 "Saxony","Thuringia","Hesse","Franconia","Swabia","Bavaria","Pomerania","Silesia",
 "East Prussia","Tyrol","Austria","Styria","Scania","Gotaland","Svealand",
 "Estonia","Livonia","Courland","Lithuania","Greater Poland","Mazovia","Lesser Poland",
 "Bohemia","Moravia","Slovakia","Transdanubia","Transylvania","Banat","Slovenia","Croatia",
 "Dalmatia","Bosnia","Serbia","Montenegro","Macedonia","Albania","Epirus","Thessaly",
 "Central Greece","Peloponnese","Thrace","Moesia","Rumelia","Wallachia","Moldavia","Dobruja",
 "Bessarabia","Carpathian Ruthenia","Eastern Galicia","Volhynia","Podolia","White Ruthenia",
 "Dnieper Ukraine","Sloboda Ukraine","Zaporizhia","Tavria","Crimea",
 "Smolensk Land","Novgorod Land","Ingria","Muscovy","Ryazan Land",
 "Ionia","Bithynia","Pontus","Cappadocia","Cilicia","Aleppo","Damascus","Phoenicia",
 "Palestine","Transjordan","Upper Mesopotamia","Mesopotamia","Lower Mesopotamia",
 "Hejaz","Nejd","Trucial Coast","Media","Isfahan","Fars","Kerman","Khorasan","Sistan",
 "Herat","Bactria","Kabulistan","Kandahar","Khwarezm","Transoxiana","Fergana Valley",
 "Punjab","Sindh","Rajputana","Gujarat","Doab","Awadh","Bihar","Bengal","Malwa","Gondwana",
 "Kalinga","Golconda","Mysore","Ceylon","Kashgaria",
 "Arakan","Siam","Lanna","Khmer","Tonkin","Annam","Cochinchina","Aceh","Mataram",
 "Zhili","Guanzhong","Jiangnan","Lingnan","Sichuan","Yunnan","Shandong","Shanxi",
 "Northern Korea","Southern Korea","Kanto","Kansai","Tohoku","Kyushu","Ryukyu",
 "Nubia","Upper Egypt","Abyssinia","Dahomey","Ashanti","Bornu","Wadai","Buganda",
 "Lower Congo","Barotseland","Mashonaland","Matabeleland","Transvaal","Orange Free State",
 "Natal","Cape","Benguela",
 "New Granada","Banda Oriental","Cusco","Quito","Anahuac","Deseret",
 "Acadia","Upper Canada","Lower Canada","New England",
}
CULTURAL = {
 "Wales","Cornwall","Scottish Highlands","Basque Country","Kurdistan",
 "Yorubaland","Hausaland","Manding","Mossi","Swahili Coast","Afar","Somaliland","Benadir",
 "Ogaden","Tamilakam","Malabar","Konkan","Minangkabau","Sunda","Khalkha","Tibet","Kham",
 "Amdo","Araucania","Mixteca","Maya Highlands","Mosquito Coast","Grain Coast",
 "Kivu","Rwanda-Burundi","Ovamboland","Adamawa","Senegambia","Futa Jallon",
 "Hadhramaut","Yemen Highlands","Gilan","Mazandaran","Tabriz","Baluchistan","Kashmir",
 "Assam","Nepal","Shan Highlands","Visayas","Moluccas","Dagestan","Georgia","Armenia",
 "Azerbaijan","Bashkiria","Tuva","Chukotka","Hispaniola",
}

out = []
for ne, nr, lat, lon in SEEDS:
    t = "historical" if ne in HISTORICAL else ("cultural" if ne in CULTURAL else "geographical")
    out.append({"name": ne, "name_ru": nr, "lat": lat, "lon": lon, "type": t})

json.dump(out, open("tools/atlas_seeds.json", "w"), ensure_ascii=False, indent=0)
from collections import Counter
print("seeds:", len(out), dict(Counter(s["type"] for s in out)))
missing_h = HISTORICAL - {s["name"] for s in out}
missing_c = CULTURAL - {s["name"] for s in out}
if missing_h: print("WARN historical names not in seeds:", sorted(missing_h))
if missing_c: print("WARN cultural names not in seeds:", sorted(missing_c))