#!/usr/bin/env python3
# AtlasForge — generate an ORIGINAL mid-level region layer over the province grid.
#
# The HOI4 state-region file is used ONLY for two things:
#   1) georeferencing: ~80 compact, unambiguous anchor states (islands, cities)
#      calibrate the pixel<->lat/lon mapping of the map;
#   2) sanity validation of the result.
# The region groupings, borders and names below are authored independently:
# a hand-written list of ~500 seed regions (geographic / historical / cultural
# balance), grown over the real province-adjacency graph.
import json, math, heapq, sys
from collections import Counter, defaultdict
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

PROV = "data/hoi4_provinces_simplified_075px.geojson"
REF  = "data/hoi4_state_regions_simplified_0_75px.geojson"   # anchors + validation only
OUT  = "data/atlasforge_regions_075px.geojson"
W, H = 5632.0, 2048.0

# ---------------------------------------------------------------- anchors
# name in REF -> (lat, lon). Compact features only (islands, small states).
ANCHORS = {
    "Ceylon": (7.9, 80.7), "Crete": (35.2, 24.9), "Sicily": (37.5, 14.2),
    "Sardinia": (40.0, 9.0), "Iceland": (64.9, -18.6), "Jutland": (56.2, 9.2),
    "Holland": (52.3, 4.8), "Brittany": (48.2, -3.0), "Normandy": (49.1, 0.2),
    "Catalonia": (41.8, 1.6), "Wales": (52.3, -3.7), "Cornwall": (50.4, -4.8),
    "Crimea": (45.2, 34.2), "Cyprus": (35.1, 33.3), "Lebanon": (33.9, 35.8),
    "Israel": (31.5, 34.9), "Kuwait": (29.3, 47.6), "Qatar": (25.3, 51.2),
    "Bahrain": (26.0, 50.55), "Sinai": (29.6, 33.8), "Tunisia": (34.8, 9.5),
    "HongKong": (22.35, 114.15), "Macau": (22.16, 113.55), "Hainan": (19.2, 109.7),
    "Formosa": (23.8, 121.0), "Okinawa": (26.4, 127.9), "Hokkaido": (43.3, 142.8),
    "Luzon": (16.2, 121.1), "Delhi": (28.6, 77.2), "Calcutta": (22.6, 88.4),
    "Goa": (15.4, 74.0), "Nepal": (28.2, 84.0), "Cambodia": (12.5, 105.0),
    "Jamaica": (18.1, -77.3), "Cuba": (21.9, -78.8), "Puerto Rico": (18.2, -66.4),
    "Panama": (8.6, -80.4), "Costa Rica": (10.0, -84.1), "El Salvador": (13.7, -88.9),
    "Yucatan": (20.3, -89.0), "Hawaii": (20.6, -157.2), "Newfoundland": (48.7, -56.5),
    "Nova Scotia": (45.1, -63.2), "Tasmania": (-42.0, 146.8),
    "New Caledonia": (-21.3, 165.5), "Fiji": (-17.8, 178.0), "Tahiti": (-17.6, -149.4),
    "Samoa": (-13.8, -172.1), "Madagascar": (-19.4, 46.7), "Reunion": (-21.1, 55.5),
    "Mauritius": (-20.3, 57.5), "Socotra": (12.5, 53.9),
    "Tierra del Fuego": (-54.0, -68.5), "Uruguay": (-32.8, -56.0),
    "Azores": (38.5, -28.0), "Madeira": (32.7, -17.0), "Canary islands": (28.3, -16.0),
    "Cape Verde": (15.5, -23.9), "Malta": (35.9, 14.4), "Bornholm": (55.1, 14.9),
    "Gotland": (57.5, 18.5), "Shetland": (60.3, -1.3), "Faroe Islands": (62.0, -6.9),
    "Attu Island": (52.9, 173.1), "Midway Island": (28.2, -177.35),
    "Wake Island": (19.3, 166.6), "Guam": (13.45, 144.78), "Saipan": (15.2, 145.75),
    "Iwo Jima": (24.78, 141.32), "Easter Island": (-27.1, -109.35),
    "Galapagos Islands": (-0.7, -90.4), "Falkand Islands": (-51.7, -59.2),
    "South Georgia": (-54.4, -36.6), "Kerguelen": (-49.35, 69.35),
    "JanMayen": (70.98, -8.5), "Diego Garcia": (-7.31, 72.41),
    "Cocos Islands": (-12.15, 96.85), "Christmas Island": (-10.45, 105.69),
    "Seychelles": (-4.6, 55.45), "Comoro Islands": (-11.9, 43.9),
    "Sao Tome": (0.2, 6.6), "Saint Helena": (-15.95, -5.7), "Ascension": (-7.95, -14.36),
    "Bermuda": (32.3, -64.78), "Curacao": (12.2, -69.0), "Trinidad": (10.4, -61.3),
    "Gibralter": (36.13, -5.35), "Isle of Man": (54.2, -4.5),
    "Petsamo": (69.4, 31.1), "South Sakhalin": (46.8, 142.5), "Greenland": (72.0, -40.0),
}

# ---------------------------------------------------------------- seeds
# (name_en, name_ru, lat, lon) — original regions: geography+history+culture mix.
SEEDS = [
 # --- Europe: British Isles & Atlantic
 ("Iceland","Исландия",64.9,-18.6),
 ("Faroe Islands","Фарерские острова",62.0,-6.9),
 ("Svalbard","Шпицберген",78.5,18.0),
 ("Scottish Highlands","Шотландское высокогорье",57.3,-4.7),
 ("Scottish Lowlands","Шотландская низменность",55.7,-3.8),
 ("Northumbria","Нортумбрия",54.9,-2.0),
 ("Yorkshire","Йоркшир",53.9,-1.2),
 ("Lancashire","Ланкашир",53.7,-2.7),
 ("Wales","Уэльс",52.3,-3.7),
 ("Mercia","Мерсия",52.6,-1.6),
 ("East Anglia","Восточная Англия",52.4,0.8),
 ("Wessex","Уэссекс",51.0,-2.4),
 ("Cornwall","Корнуолл",50.4,-4.8),
 ("Greater London","Большой Лондон",51.5,-0.1),
 ("Ulster","Ольстер",54.7,-6.9),
 ("Connacht","Коннахт",53.6,-8.9),
 ("Leinster","Ленстер",53.0,-6.9),
 ("Munster","Манстер",52.2,-8.6),
 # --- France
 ("Brittany","Бретань",48.2,-3.0),
 ("Normandy","Нормандия",49.0,0.2),
 ("Ile-de-France","Иль-де-Франс",48.8,2.5),
 ("Picardy","Пикардия",49.9,2.8),
 ("Champagne","Шампань",48.9,4.3),
 ("Lorraine","Лотарингия",48.8,6.2),
 ("Alsace","Эльзас",48.4,7.5),
 ("Burgundy","Бургундия",47.2,4.6),
 ("Anjou","Анжу",47.4,-0.6),
 ("Poitou","Пуату",46.6,-0.4),
 ("Aquitaine","Аквитания",44.8,0.2),
 ("Gascony","Гасконь",43.6,-0.2),
 ("Languedoc","Лангедок",43.6,3.0),
 ("Provence","Прованс",43.7,5.8),
 ("Auvergne","Овернь",45.4,3.1),
 ("Savoy","Савойя",45.6,6.4),
 ("Corsica","Корсика",42.1,9.1),
 # --- Iberia
 ("Galicia","Галисия",42.7,-8.1),
 ("Asturias","Астурия",43.3,-6.0),
 ("Basque Country","Страна Басков",43.0,-2.6),
 ("Old Castile","Старая Кастилия",41.7,-4.2),
 ("New Castile","Новая Кастилия",39.8,-3.5),
 ("Aragon","Арагон",41.7,-0.8),
 ("Catalonia","Каталония",41.8,1.6),
 ("Valencia","Валенсия",39.4,-0.6),
 ("Murcia","Мурсия",38.0,-1.6),
 ("Andalusia","Андалусия",37.4,-4.7),
 ("Extremadura","Эстремадура",39.2,-6.2),
 ("Northern Portugal","Северная Португалия",41.3,-8.0),
 ("Southern Portugal","Южная Португалия",38.3,-8.0),
 ("Balearic Islands","Балеарские острова",39.6,2.9),
 # --- Italy & Alps
 ("Piedmont","Пьемонт",45.0,7.9),
 ("Lombardy","Ломбардия",45.5,9.6),
 ("Venetia","Венеция",45.6,11.9),
 ("Liguria","Лигурия",44.3,8.7),
 ("Emilia","Эмилия",44.6,11.0),
 ("Tuscany","Тоскана",43.4,11.1),
 ("Latium","Лацио",41.9,12.7),
 ("Umbria","Умбрия",43.1,12.7),
 ("Abruzzo","Абруццо",42.2,13.8),
 ("Campania","Кампания",40.9,14.8),
 ("Apulia","Апулия",40.9,16.6),
 ("Calabria","Калабрия",39.0,16.4),
 ("Sicily","Сицилия",37.5,14.2),
 ("Sardinia","Сардиния",40.0,9.0),
 ("Malta","Мальта",35.9,14.4),
 ("Switzerland","Швейцария",46.8,8.2),
 ("Tyrol","Тироль",47.2,11.4),
 ("Austria","Австрия",48.1,15.3),
 ("Styria","Штирия",47.1,15.1),
 # --- Low Countries & Germany
 ("Flanders","Фландрия",51.0,3.8),
 ("Wallonia","Валлония",50.4,4.9),
 ("Holland","Голландия",52.3,4.9),
 ("Frisia","Фризия",53.1,5.9),
 ("Rhineland","Рейнланд",50.7,7.1),
 ("Westphalia","Вестфалия",51.8,7.9),
 ("Lower Saxony","Нижняя Саксония",52.8,9.3),
 ("Schleswig-Holstein","Шлезвиг-Гольштейн",54.3,9.8),
 ("Mecklenburg","Мекленбург",53.7,12.0),
 ("Brandenburg","Бранденбург",52.5,13.3),
 ("Saxony","Саксония",51.1,13.4),
 ("Thuringia","Тюрингия",50.9,11.0),
 ("Hesse","Гессен",50.5,9.0),
 ("Franconia","Франкония",49.8,10.8),
 ("Swabia","Швабия",48.4,9.8),
 ("Bavaria","Бавария",48.7,12.0),
 ("Pomerania","Померания",53.7,15.5),
 ("Silesia","Силезия",51.0,17.2),
 ("East Prussia","Восточная Пруссия",54.2,21.0),
 # --- Scandinavia & Baltic
 ("Danish Isles","Датские острова",55.4,11.8),
 ("Jutland","Ютландия",56.2,9.2),
 ("Scania","Сконе",55.9,13.6),
 ("Gotaland","Гёталанд",57.8,13.8),
 ("Svealand","Свеаланд",59.7,15.5),
 ("Norrland","Норрланд",64.0,18.0),
 ("Western Norway","Западная Норвегия",60.9,6.4),
 ("Eastern Norway","Восточная Норвегия",60.5,10.5),
 ("Trondelag","Трёнделаг",63.6,10.8),
 ("Northern Norway","Северная Норвегия",69.0,18.5),
 ("Southern Finland","Южная Финляндия",60.7,24.8),
 ("Finnish Lakeland","Озёрная Финляндия",62.3,28.0),
 ("Ostrobothnia","Остроботния",64.3,26.5),
 ("Lapland","Лапландия",67.8,25.5),
 ("Estonia","Эстония",58.8,25.5),
 ("Livonia","Ливония",57.2,25.0),
 ("Courland","Курляндия",56.7,22.5),
 ("Lithuania","Литва",55.3,24.0),
 # --- Central & Eastern Europe
 ("Greater Poland","Великая Польша",52.3,17.0),
 ("Mazovia","Мазовия",52.4,21.0),
 ("Lesser Poland","Малая Польша",50.4,20.4),
 ("Bohemia","Богемия",50.0,14.6),
 ("Moravia","Моравия",49.3,17.0),
 ("Slovakia","Словакия",48.8,19.5),
 ("Transdanubia","Задунавье",47.0,17.8),
 ("Alfold","Альфёльд",47.1,20.5),
 ("Transylvania","Трансильвания",46.6,24.2),
 ("Banat","Банат",45.7,21.2),
 ("Slovenia","Словения",46.1,14.8),
 ("Croatia","Хорватия",45.7,16.4),
 ("Dalmatia","Далмация",43.8,16.5),
 ("Bosnia","Босния",44.2,17.8),
 ("Serbia","Сербия",44.1,20.8),
 ("Montenegro","Черногория",42.8,19.3),
 ("Macedonia","Македония",41.6,21.7),
 ("Albania","Албания",41.1,20.1),
 ("Epirus","Эпир",39.7,20.8),
 ("Thessaly","Фессалия",39.5,22.2),
 ("Central Greece","Средняя Греция",38.5,23.0),
 ("Peloponnese","Пелопоннес",37.5,22.3),
 ("Aegean Islands","Эгейские острова",37.5,25.3),
 ("Crete","Крит",35.2,24.9),
 ("Thrace","Фракия",41.5,26.8),
 ("Moesia","Мёзия",43.4,25.2),
 ("Rumelia","Румелия",42.2,24.8),
 ("Wallachia","Валахия",44.5,25.5),
 ("Moldavia","Молдавия",47.0,27.5),
 ("Dobruja","Добруджа",44.4,28.3),
 ("Bessarabia","Бессарабия",46.5,29.0),
 ("Carpathian Ruthenia","Закарпатье",48.4,23.2),
 ("Eastern Galicia","Восточная Галиция",49.6,24.6),
 ("Volhynia","Волынь",50.9,25.9),
 ("Podolia","Подолье",48.9,27.8),
 ("Polesia","Полесье",52.0,27.0),
 ("White Ruthenia","Белая Русь",53.9,28.0),
 ("Dnieper Ukraine","Поднепровье",49.9,31.0),
 ("Sloboda Ukraine","Слобожанщина",49.9,36.0),
 ("Zaporizhia","Запорожье",47.6,35.4),
 ("Tavria","Таврия",46.5,33.5),
 ("Crimea","Крым",45.2,34.2),
 ("Donets Basin","Донбасс",48.2,38.0),
 # --- European Russia & Caucasus
 ("Smolensk Land","Смоленщина",54.8,32.5),
 ("Novgorod Land","Новгородчина",58.4,31.5),
 ("Ingria","Ингрия",59.6,30.5),
 ("Karelia","Карелия",62.5,33.5),
 ("Kola Peninsula","Кольский полуостров",67.8,36.0),
 ("Muscovy","Московия",55.7,37.7),
 ("Upper Volga","Верхневолжье",57.5,40.0),
 ("Ryazan Land","Рязанщина",54.4,40.5),
 ("Black Earth","Черноземье",51.8,37.0),
 ("Don Steppe","Донская степь",47.8,41.0),
 ("Kuban","Кубань",45.2,39.7),
 ("North Caucasus","Северный Кавказ",43.9,43.5),
 ("Dagestan","Дагестан",42.8,47.0),
 ("Kalmyk Steppe","Калмыцкая степь",46.3,45.3),
 ("Lower Volga","Нижневолжье",49.0,45.5),
 ("Middle Volga","Средневолжье",53.3,49.5),
 ("Volga-Kama","Волго-Камье",55.6,50.5),
 ("Vyatka Land","Вятский край",58.5,50.0),
 ("Pomorye","Поморье",64.0,41.0),
 ("Pechora","Печора",65.5,53.5),
 ("Kama Urals","Прикамье",58.2,56.5),
 ("Bashkiria","Башкирия",54.5,56.5),
 ("Middle Urals","Средний Урал",57.2,60.5),
 ("Southern Urals","Южный Урал",53.3,59.0),
 ("Georgia","Грузия",42.0,43.5),
 ("Armenia","Армения",40.3,44.9),
 ("Azerbaijan","Азербайджан",40.5,48.0),
 # --- Siberia & Russian Far East
 ("Polar Urals","Полярный Урал",66.5,63.0),
 ("Yamal","Ямал",68.0,72.0),
 ("Ob-Irtysh","Обь-Иртышье",58.5,70.0),
 ("Baraba Steppe","Барабинская степь",55.0,78.0),
 ("Altai","Алтай",51.0,86.0),
 ("Kuznetsk Basin","Кузбасс",54.8,87.0),
 ("Yenisei Siberia","Енисейская Сибирь",57.5,92.5),
 ("Tuva","Тува",51.7,94.4),
 ("Angara Land","Приангарье",56.5,101.5),
 ("Baikal","Прибайкалье",53.0,108.0),
 ("Transbaikalia","Забайкалье",51.5,115.0),
 ("Taimyr","Таймыр",73.0,98.0),
 ("Putorana","Путорана",69.0,94.0),
 ("Vilyuy","Вилюй",64.0,121.0),
 ("Central Yakutia","Центральная Якутия",62.5,130.0),
 ("Verkhoyansk Range","Верхоянский хребет",67.0,133.0),
 ("Kolyma","Колыма",66.0,152.0),
 ("Chukotka","Чукотка",66.5,-175.0),
 ("Kamchatka","Камчатка",55.5,158.5),
 ("Okhotsk Coast","Охотское побережье",58.5,141.5),
 ("Amur Land","Приамурье",50.5,128.0),
 ("Primorye","Приморье",44.8,133.5),
 ("Sakhalin","Сахалин",50.0,142.8),
 ("Kuril Islands","Курильские острова",46.5,151.0),
 # --- Central Asia
 ("Turgai Steppe","Тургайская степь",50.5,64.0),
 ("Kazakh Uplands","Казахский мелкосопочник",48.5,72.0),
 ("Irtysh Steppe","Прииртышская степь",52.0,77.5),
 ("Semirechye","Семиречье",44.5,77.5),
 ("Syr Darya","Сырдарья",43.5,67.0),
 ("Aral Region","Приаралье",45.5,60.0),
 ("Mangyshlak","Мангышлак",43.8,52.5),
 ("Khwarezm","Хорезм",41.5,60.5),
 ("Transoxiana","Мавераннахр",40.0,66.0),
 ("Fergana Valley","Ферганская долина",40.6,71.5),
 ("Pamir","Памир",38.4,73.0),
 ("Tian Shan","Тянь-Шань",42.0,75.5),
 ("Karakum","Каракумы",39.0,59.0),
 # --- Middle East
 ("Ionia","Иония",38.5,27.5),
 ("Bithynia","Вифиния",40.2,29.8),
 ("Pontus","Понт",40.9,38.5),
 ("Cappadocia","Каппадокия",38.7,35.0),
 ("Central Anatolia","Центральная Анатолия",39.2,32.8),
 ("Cilicia","Киликия",37.0,35.2),
 ("Eastern Anatolia","Восточная Анатолия",39.5,41.5),
 ("Kurdistan","Курдистан",37.3,43.5),
 ("Cyprus","Кипр",35.1,33.3),
 ("Aleppo","Алеппо",36.2,37.3),
 ("Damascus","Дамаск",33.5,36.5),
 ("Phoenicia","Финикия",34.0,35.8),
 ("Palestine","Палестина",31.8,35.1),
 ("Transjordan","Трансиордания",31.0,36.5),
 ("Sinai","Синай",29.6,33.8),
 ("Upper Mesopotamia","Верхняя Месопотамия",36.0,40.5),
 ("Mesopotamia","Месопотамия",33.0,44.0),
 ("Lower Mesopotamia","Нижняя Месопотамия",30.8,47.3),
 ("Syrian Desert","Сирийская пустыня",32.5,39.5),
 ("Hejaz","Хиджаз",24.5,39.0),
 ("Nejd","Неджд",25.0,45.5),
 ("Rub al Khali","Руб-эль-Хали",20.5,50.0),
 ("Al-Hasa","Эль-Хаса",26.5,49.0),
 ("Yemen Highlands","Йеменское нагорье",15.4,44.2),
 ("Hadhramaut","Хадрамаут",15.7,48.8),
 ("Oman","Оман",22.5,57.0),
 ("Socotra","Сокотра",12.5,53.9),
 # --- Iran & Afghanistan
 ("Tabriz","Тебриз",38.0,46.3),
 ("Gilan","Гилян",37.0,49.5),
 ("Mazandaran","Мазендеран",36.5,53.0),
 ("Media","Мидия",34.8,48.0),
 ("Isfahan","Исфахан",32.7,51.7),
 ("Fars","Фарс",29.6,52.6),
 ("Kerman","Керман",30.0,57.0),
 ("Khorasan","Хорасан",36.0,59.0),
 ("Sistan","Систан",30.8,61.5),
 ("Baluchistan","Белуджистан",27.5,64.5),
 ("Herat","Герат",34.3,62.2),
 ("Bactria","Бактрия",36.7,67.5),
 ("Kabulistan","Кабулистан",34.4,69.3),
 ("Kandahar","Кандагар",31.6,65.8),
 # --- South Asia
 ("Punjab","Пенджаб",31.2,73.5),
 ("Sindh","Синд",26.0,68.7),
 ("Rajputana","Раджпутана",26.5,73.5),
 ("Gujarat","Гуджарат",22.7,72.2),
 ("Kashmir","Кашмир",34.3,75.0),
 ("Doab","Доаб",28.3,78.0),
 ("Awadh","Авадх",26.8,81.2),
 ("Bihar","Бихар",25.3,85.6),
 ("Bengal","Бенгалия",23.6,89.0),
 ("Assam","Ассам",26.3,92.7),
 ("Nepal","Непал",28.2,84.0),
 ("Tibet","Тибет",30.5,88.0),
 ("Kham","Кам",30.8,97.5),
 ("Amdo","Амдо",35.5,98.5),
 ("Malwa","Мальва",23.4,76.5),
 ("Gondwana","Гондвана",21.5,79.5),
 ("Kalinga","Калинга",20.4,84.8),
 ("Deccan","Декан",17.6,76.5),
 ("Golconda","Голконда",16.8,79.5),
 ("Konkan","Конкан",16.8,73.7),
 ("Mysore","Майсур",13.0,76.5),
 ("Malabar","Малабар",10.8,76.2),
 ("Tamilakam","Тамилакам",10.6,78.5),
 ("Ceylon","Цейлон",7.8,80.7),
 ("Maldives","Мальдивы",3.0,73.0),
 ("Andaman Islands","Андаманские острова",11.5,92.7),
 # --- Southeast Asia
 ("Irrawaddy","Иравади",19.8,95.2),
 ("Arakan","Аракан",19.8,94.0),
 ("Shan Highlands","Шанское нагорье",21.8,98.0),
 ("Tenasserim","Тенассерим",13.0,98.5),
 ("Siam","Сиам",15.0,100.3),
 ("Isan","Исан",16.3,103.5),
 ("Lanna","Ланна",19.0,99.2),
 ("Laos","Лаос",19.5,103.0),
 ("Khmer","Кхмер",12.6,105.0),
 ("Tonkin","Тонкин",21.2,105.5),
 ("Annam","Аннам",16.5,107.5),
 ("Cochinchina","Кохинхина",10.6,106.3),
 ("Malaya","Малайя",4.5,102.0),
 ("Aceh","Ачех",4.6,96.8),
 ("Minangkabau","Минангкабау",-0.5,100.8),
 ("Southern Sumatra","Южная Суматра",-3.6,104.2),
 ("Sunda","Сунда",-6.8,107.3),
 ("Mataram","Матарам",-7.5,110.3),
 ("Eastern Java","Восточная Ява",-7.8,112.9),
 ("Sarawak","Саравак",2.0,112.5),
 ("Sabah","Сабах",5.4,117.0),
 ("Kalimantan","Калимантан",-1.0,114.5),
 ("Celebes","Целебес",-2.0,120.5),
 ("Moluccas","Молуккские острова",-3.2,128.3),
 ("Lesser Sunda Islands","Малые Зондские острова",-8.8,119.5),
 ("Luzon","Лусон",16.2,121.0),
 ("Visayas","Висайи",10.7,123.5),
 ("Mindanao","Минданао",7.8,124.8),
 ("Western New Guinea","Западная Новая Гвинея",-3.9,137.0),
 ("Eastern New Guinea","Восточная Новая Гвинея",-6.6,145.5),
 # --- East Asia
 ("Dzungaria","Джунгария",45.0,86.0),
 ("Kashgaria","Кашгария",39.0,80.0),
 ("Hexi Corridor","Коридор Хэси",39.5,98.5),
 ("Khalkha","Халха",47.5,103.0),
 ("Gobi","Гоби",43.0,106.0),
 ("Ordos","Ордос",39.0,108.5),
 ("Hulunbuir","Хулун-Буир",49.0,120.0),
 ("Northern Manchuria","Северная Маньчжурия",47.5,127.0),
 ("Southern Manchuria","Южная Маньчжурия",42.0,124.5),
 ("Zhili","Чжили",39.5,116.0),
 ("Shanxi","Шаньси",37.6,112.3),
 ("Guanzhong","Гуаньчжун",34.4,108.8),
 ("Shandong","Шаньдун",36.3,118.5),
 ("Central Plain","Центральная равнина",34.0,113.6),
 ("Jiangnan","Цзяннань",31.3,119.8),
 ("Huai Valley","Долина Хуайхэ",32.8,116.8),
 ("Middle Yangtze","Среднее Янцзы",30.7,112.8),
 ("Hunan","Хунань",27.8,111.7),
 ("Jiangxi","Цзянси",28.4,115.8),
 ("Zhejiang","Чжэцзян",29.2,120.3),
 ("Fujian","Фуцзянь",26.0,118.0),
 ("Lingnan","Линнань",23.4,113.4),
 ("Guangxi","Гуанси",23.6,108.8),
 ("Guizhou","Гуйчжоу",26.8,106.8),
 ("Yunnan","Юньнань",25.0,102.0),
 ("Sichuan","Сычуань",30.6,104.2),
 ("Hainan","Хайнань",19.2,109.7),
 ("Formosa","Формоза",23.8,121.0),
 ("Northern Korea","Северная Корея",40.0,127.2),
 ("Southern Korea","Южная Корея",36.2,127.8),
 ("Hokkaido","Хоккайдо",43.4,142.8),
 ("Tohoku","Тохоку",39.6,140.8),
 ("Kanto","Канто",36.1,139.7),
 ("Chubu","Тюбу",36.0,137.7),
 ("Kansai","Кансай",34.8,135.6),
 ("Chugoku","Тюгоку",34.9,132.9),
 ("Shikoku","Сикоку",33.7,133.4),
 ("Kyushu","Кюсю",32.7,130.9),
 ("Ryukyu","Рюкю",26.5,127.9),
 # --- North Africa & Sahara
 ("Morocco","Марокко",33.4,-6.5),
 ("Sous","Сус",30.4,-8.5),
 ("Western Sahara","Западная Сахара",24.5,-13.5),
 ("Tell Atlas","Телль-Атлас",36.0,2.5),
 ("Algerian Sahara","Алжирская Сахара",27.5,2.5),
 ("Tunisia","Тунис",35.0,9.5),
 ("Tripolitania","Триполитания",31.0,13.5),
 ("Cyrenaica","Киренаика",31.0,21.8),
 ("Fezzan","Феццан",26.0,14.5),
 ("Libyan Desert","Ливийская пустыня",24.0,25.0),
 ("Nile Delta","Дельта Нила",30.6,31.0),
 ("Upper Egypt","Верхний Египет",26.0,32.0),
 ("Nubia","Нубия",19.5,31.0),
 ("Gezira","Гезира",14.3,33.3),
 ("Kordofan","Кордофан",13.0,29.5),
 ("Darfur","Дарфур",13.5,24.5),
 ("Ahaggar","Ахаггар",23.0,5.5),
 ("Tibesti","Тибести",21.0,17.5),
 ("Azawad","Азавад",18.5,-1.5),
 ("Adrar","Адрар",20.3,-11.5),
 # --- West & Central Africa
 ("Senegambia","Сенегамбия",14.5,-15.0),
 ("Futa Jallon","Фута-Джаллон",10.8,-12.0),
 ("Sierra Leone","Сьерра-Леоне",8.5,-11.8),
 ("Grain Coast","Перцовый берег",6.4,-9.5),
 ("Ivory Coast","Берег Слоновой Кости",6.8,-5.5),
 ("Ashanti","Ашанти",6.8,-1.5),
 ("Dahomey","Дагомея",8.0,2.2),
 ("Yorubaland","Земля йоруба",8.0,4.5),
 ("Hausaland","Страна хауса",12.0,8.0),
 ("Bornu","Борну",12.3,13.0),
 ("Niger Delta","Дельта Нигера",5.5,6.5),
 ("Manding","Мандинг",12.8,-8.0),
 ("Mossi","Моси",12.3,-1.3),
 ("Chad Basin","Чадская котловина",13.0,16.5),
 ("Wadai","Вадаи",13.3,20.8),
 ("Adamawa","Адамава",7.2,12.2),
 ("Cameroon","Камерун",4.5,10.2),
 ("Ubangi-Shari","Убанги-Шари",6.3,20.0),
 ("Gabon","Габон",-0.6,11.7),
 ("Lower Congo","Нижнее Конго",-5.2,14.5),
 ("Congo Basin","Бассейн Конго",0.5,22.0),
 ("Kasai","Касаи",-5.5,22.5),
 ("Katanga","Катанга",-10.5,26.5),
 ("Kivu","Киву",-2.5,28.0),
 ("Sao Tome","Сан-Томе",0.2,6.6),
 # --- East & Southern Africa
 ("Buganda","Буганда",0.8,32.4),
 ("Rwanda-Burundi","Руанда-Бурунди",-2.8,29.9),
 ("Kenya Highlands","Кенийское нагорье",0.3,36.8),
 ("Swahili Coast","Берег суахили",-5.5,39.0),
 ("Tanganyika","Танганьика",-6.0,34.5),
 ("Eritrea","Эритрея",15.3,38.8),
 ("Abyssinia","Абиссиния",11.0,38.8),
 ("Afar","Афар",12.0,41.3),
 ("Ogaden","Огаден",7.0,44.5),
 ("Somaliland","Сомалиленд",9.7,46.0),
 ("Benadir","Бенадир",3.0,45.0),
 ("Zambezi Valley","Долина Замбези",-16.0,33.5),
 ("Mozambique Coast","Мозамбикское побережье",-14.0,39.5),
 ("Nyasaland","Ньясаленд",-13.3,34.0),
 ("Barotseland","Баротселенд",-15.8,23.5),
 ("Zambia Plateau","Замбийское плато",-13.5,28.5),
 ("Mashonaland","Машоналенд",-17.8,31.0),
 ("Matabeleland","Матабелеленд",-20.0,28.5),
 ("Kalahari","Калахари",-23.0,23.0),
 ("Ovamboland","Овамболенд",-18.5,16.5),
 ("Namib","Намиб",-23.5,15.5),
 ("Cape","Капская земля",-32.5,21.0),
 ("Natal","Наталь",-29.0,30.5),
 ("Transvaal","Трансвааль",-25.5,29.0),
 ("Orange Free State","Оранжевая республика",-29.0,26.5),
 ("Angola Coast","Ангольское побережье",-10.5,14.0),
 ("Benguela","Бенгела",-12.8,16.0),
 ("Madagascar","Мадагаскар",-19.5,46.8),
 ("Mascarenes","Маскаренские острова",-20.5,56.5),
 ("Comoros","Коморы",-12.0,44.3),
 ("Seychelles","Сейшелы",-4.6,55.45),
 # --- North America: Canada & Arctic
 ("Greenland","Гренландия",70.0,-42.0),
 ("Arctic Archipelago","Арктический архипелаг",72.5,-95.0),
 ("Newfoundland","Ньюфаундленд",48.7,-56.5),
 ("Acadia","Акадия",46.0,-64.5),
 ("Lower Canada","Нижняя Канада",46.9,-71.8),
 ("Upper Canada","Верхняя Канада",44.3,-79.8),
 ("Ungava","Унгава",55.5,-71.0),
 ("Labrador","Лабрадор",54.0,-62.0),
 ("Canadian Shield","Канадский щит",49.5,-86.0),
 ("Manitoba","Манитоба",51.0,-98.0),
 ("Saskatchewan","Саскачеван",52.0,-106.0),
 ("Alberta","Альберта",53.0,-114.0),
 ("British Columbia","Британская Колумбия",53.0,-123.0),
 ("Yukon","Юкон",63.5,-136.0),
 ("Mackenzie","Маккензи",63.0,-120.0),
 ("Barren Grounds","Бесплодные земли",64.0,-98.0),
 ("Alaska","Аляска",64.0,-152.0),
 ("Aleutians","Алеутские острова",54.0,-166.5),
 # --- USA
 ("New England","Новая Англия",43.6,-71.5),
 ("Hudson Valley","Долина Гудзона",42.8,-74.8),
 ("Mid-Atlantic","Среднеатлантические штаты",40.7,-77.5),
 ("Chesapeake","Чесапик",37.8,-77.8),
 ("Carolinas","Каролина",35.0,-79.8),
 ("Deep South","Глубокий Юг",32.8,-85.0),
 ("Florida","Флорида",28.5,-81.8),
 ("Appalachia","Аппалачи",37.3,-82.0),
 ("Ohio Valley","Долина Огайо",40.0,-83.5),
 ("Michigan","Мичиган",44.0,-85.0),
 ("Upper Midwest","Верхний Средний Запад",45.3,-90.5),
 ("Corn Belt","Кукурузный пояс",41.0,-90.5),
 ("Missouri Valley","Долина Миссури",38.8,-93.0),
 ("Tennessee Valley","Долина Теннесси",35.8,-86.8),
 ("Mississippi Delta","Дельта Миссисипи",32.8,-90.8),
 ("Louisiana","Луизиана",30.8,-91.8),
 ("Ozarks","Озарк",36.3,-92.8),
 ("East Texas","Восточный Техас",31.5,-95.3),
 ("Texas Plains","Техасские равнины",32.5,-100.5),
 ("South Texas","Южный Техас",27.8,-98.5),
 ("High Plains","Высокие равнины",36.0,-101.8),
 ("Northern Plains","Северные равнины",46.0,-100.5),
 ("Central Plains","Центральные равнины",38.8,-98.5),
 ("Montana","Монтана",47.0,-109.5),
 ("Snake River Plain","Равнина Снейк",43.5,-114.5),
 ("Southern Rockies","Южные Скалистые горы",39.0,-106.0),
 ("Great Basin","Большой Бассейн",39.8,-116.8),
 ("Deseret","Дезерет",39.5,-111.5),
 ("Arizona","Аризона",34.2,-111.8),
 ("Rio Grande Valley","Долина Рио-Гранде",34.5,-106.3),
 ("Washington","Вашингтон",47.5,-120.6),
 ("Oregon","Орегон",43.9,-120.6),
 ("Northern California","Северная Калифорния",40.0,-122.3),
 ("Central Valley","Центральная долина",36.8,-119.8),
 ("Southern California","Южная Калифорния",34.2,-117.0),
 # --- Mexico, Central America, Caribbean
 ("Baja California","Нижняя Калифорния",27.5,-113.3),
 ("Sonora","Сонора",29.5,-110.7),
 ("Chihuahua","Чиуауа",28.7,-106.0),
 ("Rio Bravo","Рио-Браво",26.5,-100.5),
 ("Sinaloa","Синалоа",24.5,-107.0),
 ("Bajio","Бахио",21.0,-101.6),
 ("Anahuac","Анауак",19.4,-99.0),
 ("Michoacan","Мичоакан",19.2,-101.8),
 ("Mixteca","Миштека",17.5,-99.3),
 ("Veracruz","Веракрус",19.5,-96.7),
 ("Oaxaca","Оахака",16.9,-96.5),
 ("Yucatan","Юкатан",20.3,-89.0),
 ("Maya Highlands","Нагорье майя",15.8,-91.5),
 ("Honduras","Гондурас",14.8,-87.0),
 ("Mosquito Coast","Москитовый берег",13.0,-84.0),
 ("Nicaragua","Никарагуа",12.3,-86.0),
 ("Costa Rica","Коста-Рика",10.0,-84.2),
 ("Panama","Панама",8.8,-80.3),
 ("Cuba","Куба",21.8,-79.0),
 ("Hispaniola","Эспаньола",19.0,-71.0),
 ("Jamaica","Ямайка",18.1,-77.3),
 ("Puerto Rico","Пуэрто-Рико",18.2,-66.4),
 ("Lesser Antilles","Малые Антильские острова",15.3,-61.3),
 ("Bahamas","Багамы",24.2,-76.0),
 ("Bermuda","Бермуды",32.3,-64.8),
 # --- South America
 ("Caribbean Colombia","Карибская Колумбия",10.0,-74.8),
 ("New Granada","Новая Гранада",4.8,-74.3),
 ("Venezuelan Coast","Венесуэльское побережье",10.3,-67.0),
 ("Llanos","Льянос",7.5,-68.0),
 ("Guiana Highlands","Гвианское нагорье",5.0,-62.5),
 ("Guiana Coast","Гвианское побережье",5.8,-57.5),
 ("Orinoco Delta","Дельта Ориноко",9.0,-61.5),
 ("Quito","Кито",-1.0,-78.6),
 ("Peruvian Coast","Перуанское побережье",-9.0,-78.3),
 ("Lima","Лима",-12.2,-76.8),
 ("Cusco","Куско",-13.5,-72.2),
 ("Altiplano","Альтиплано",-16.8,-68.5),
 ("Atacama","Атакама",-23.5,-69.8),
 ("Central Chile","Центральное Чили",-34.0,-71.0),
 ("Araucania","Араукания",-38.8,-72.5),
 ("Gran Chaco","Гран-Чако",-22.0,-61.0),
 ("Paraguay","Парагвай",-25.0,-57.3),
 ("Pampas","Пампа",-35.5,-61.0),
 ("Entre Rios","Энтре-Риос",-31.5,-59.0),
 ("Cuyo","Куйо",-33.0,-68.3),
 ("Tucuman","Тукуман",-26.8,-65.3),
 ("Patagonia","Патагония",-44.0,-69.0),
 ("Tierra del Fuego","Огненная Земля",-54.0,-68.5),
 ("Falklands","Фолклендские острова",-51.8,-59.3),
 ("Banda Oriental","Банда Орьенталь",-33.0,-56.0),
 ("Para","Пара",-2.8,-50.5),
 ("Amazonia","Амазония",-3.8,-62.5),
 ("Upper Amazon","Верхняя Амазония",-5.5,-72.0),
 ("Maranhao","Мараньян",-4.5,-44.8),
 ("Sertao","Сертан",-8.5,-40.5),
 ("Bahia","Баия",-12.5,-39.5),
 ("Pernambuco","Пернамбуку",-7.8,-36.5),
 ("Minas Gerais","Минас-Жерайс",-19.0,-44.5),
 ("Rio de Janeiro","Рио-де-Жанейро",-22.4,-43.5),
 ("Sao Paulo","Сан-Паулу",-23.0,-47.8),
 ("Southern Brazil","Южная Бразилия",-28.0,-52.0),
 ("Mato Grosso","Мату-Гросу",-14.0,-56.0),
 ("Cerrado","Серраду",-16.0,-49.0),
 ("Galapagos","Галапагос",-0.6,-90.4),
 # --- Oceania & Pacific
 ("New South Wales","Новый Южный Уэльс",-33.0,148.0),
 ("Victoria","Виктория",-37.0,144.5),
 ("Queensland","Квинсленд",-22.5,146.5),
 ("Cape York","Кейп-Йорк",-14.5,143.0),
 ("Top End","Топ-Энд",-14.5,132.5),
 ("Red Centre","Красный центр",-24.5,133.5),
 ("Western Australia","Западная Австралия",-27.0,121.0),
 ("Swan River","Суон-Ривер",-32.5,116.5),
 ("South Australia","Южная Австралия",-32.0,137.0),
 ("Nullarbor","Налларбор",-31.0,128.5),
 ("Tasmania","Тасмания",-42.0,146.8),
 ("North Island","Северный остров",-38.3,175.8),
 ("South Island","Южный остров",-43.9,170.5),
 ("Bismarck Archipelago","Архипелаг Бисмарка",-5.0,150.0),
 ("Solomon Islands","Соломоновы острова",-9.5,160.3),
 ("New Caledonia","Новая Каледония",-21.3,165.5),
 ("Fiji","Фиджи",-17.8,178.0),
 ("Samoa","Самоа",-13.8,-172.0),
 ("Society Islands","Острова Общества",-17.6,-149.5),
 ("Hawaii","Гавайи",20.7,-157.0),
 ("Marianas","Марианские острова",15.2,145.7),
 ("Carolines","Каролинские острова",7.4,151.5),
 ("Marshalls","Маршалловы острова",8.5,168.5),
]

# ---------------------------------------------------------------- helpers
def wrap_dx(x1, x2):
    dx = abs(x1 - x2)
    return min(dx, W - dx)

def wdist(p, q):
    return math.hypot(wrap_dx(p[0], q[0]), p[1] - q[1])

def solve_normal(ata, atb):
    n = len(atb)
    M = [row[:] + [atb[i]] for i, row in enumerate(ata)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[piv] = M[piv], M[c]
        for r in range(n):
            if r != c and M[r][c]:
                f = M[r][c] / M[c][c]
                for k in range(c, n + 1):
                    M[r][k] -= f * M[c][k]
    return [M[i][n] / M[i][i] for i in range(n)]

def polyfit(xs, ys, deg):
    n = deg + 1
    ata = [[sum(x ** (i + j) for x in xs) for j in range(n)] for i in range(n)]
    atb = [sum((x ** i) * y for x, y in zip(xs, ys)) for i in range(n)]
    return solve_normal(ata, atb)

def polyval(c, x):
    return sum(ci * x ** i for i, ci in enumerate(c))

# ---------------------------------------------------------------- load data
print("loading provinces…", flush=True)
prov_gj = json.load(open(PROV))
provs = []      # dicts: pid, c(x,y), area, terrain, continent, geom
for f in prov_gj["features"]:
    p = f["properties"]
    if p.get("type") in ("sea", "lake") or p.get("terrain") in ("ocean", "lakes"):
        continue
    g = shape(f["geometry"])
    c = g.centroid
    provs.append({"pid": p["provinceId"], "x": c.x, "y": c.y, "area": g.area,
                  "terrain": p.get("terrain"), "cont": p.get("continent"), "geom": g})
print("land provinces:", len(provs))

print("loading reference for anchors…", flush=True)
ref_gj = json.load(open(REF))
ref_cent = {}
for f in ref_gj["features"]:
    nm = f["properties"]["name"]
    if nm in ANCHORS and nm not in ref_cent:
        c = shape(f["geometry"]).centroid
        ref_cent[nm] = (c.x, c.y)
print("anchors found:", len(ref_cent), "of", len(ANCHORS))

# ---------------------------------------------------------------- calibrate
def fit_projection(anchor_items):
    xs  = [px for (_, (px, _py)) in anchor_items]
    ys  = [py for (_, (_px, py)) in anchor_items]
    lons = [ANCHORS[nm][1] for (nm, _) in anchor_items]
    lats = [ANCHORS[nm][0] for (nm, _) in anchor_items]
    lon_c = polyfit(xs, lons, 1)
    lat_c = polyfit(ys, lats, 3)
    return lon_c, lat_c

items = list(ref_cent.items())
lon_c, lat_c = fit_projection(items)
# iteratively drop outliers (bad ref centroids of sprawling states), refit
def residual(nm, px, py):
    la, lo = ANCHORS[nm]
    dlon = abs(polyval(lon_c, px) - lo)
    dlon = min(dlon, 360 - dlon)
    return max(dlon, abs(polyval(lat_c, py) - la))
for thresh in (6.0, 3.0, 2.0):
    items = [(nm, c) for nm, c in items if residual(nm, c[0], c[1]) < thresh]
    lon_c, lat_c = fit_projection(items)
res = [residual(nm, c[0], c[1]) for nm, c in items]
print(f"calibration: kept {len(items)} anchors, max residual {max(res):.2f}°, "
      f"mean {sum(res)/len(res):.2f}°")

def lonlat_to_px(lat, lon):
    a, b = lon_c
    x = (lon - a) / b
    x %= W
    lo, hi = -64.0, H + 64.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if polyval(lat_c, mid) > lat:
            lo = mid
        else:
            hi = mid
    return x, (lo + hi) / 2

# ---------------------------------------------------------------- adjacency
print("building adjacency…", flush=True)
BUCK = 64
buckets = defaultdict(list)
for i, p in enumerate(provs):
    buckets[(int(p["x"] // BUCK), int(p["y"] // BUCK))].append(i)
nbx = int(W // BUCK) + 1

def candidates(i, radius):
    p = provs[i]
    bx, by = int(p["x"] // BUCK), int(p["y"] // BUCK)
    r = int(radius // BUCK) + 1
    out = []
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            out.extend(buckets.get(((bx + dx) % nbx, by + dy), ()))
    return out

adj = [[] for _ in provs]
for i, p in enumerate(provs):
    cand = []
    for j in candidates(i, 260):
        if j == i:
            continue
        q = provs[j]
        d = wdist((p["x"], p["y"]), (q["x"], q["y"]))
        cap = max(50.0, 2.4 * (math.sqrt(p["area"]) + math.sqrt(q["area"])))
        if d <= cap:
            cand.append((d, j))
    cand.sort()
    for d, j in cand[:8]:
        adj[i].append((j, d))
# symmetrize
adjset = [dict() for _ in provs]
for i in range(len(provs)):
    for j, d in adj[i]:
        adjset[i][j] = d
        adjset[j][i] = d
adj = [list(m.items()) for m in adjset]
print("avg degree:", sum(len(a) for a in adj) / len(adj))

# ---------------------------------------------------------------- seeds → provinces
names_seen = Counter(n for n, *_ in SEEDS)
dups = [n for n, k in names_seen.items() if k > 1]
if dups:
    print("WARNING duplicate seed names:", dups)

seed_px = []
for name_en, name_ru, lat, lon in SEEDS:
    x, y = lonlat_to_px(lat, lon)
    seed_px.append((name_en, name_ru, x, y))

taken = set()
seed_prov = []   # provIdx per seed (None = skipped)
for si, (ne, nr, x, y) in enumerate(seed_px):
    best, bd = None, 1e18
    # nearest free land province (global scan is fine at this scale)
    for j, p in enumerate(provs):
        if j in taken:
            continue
        d = wdist((x, y), (p["x"], p["y"]))
        if d < bd:
            bd, best = d, j
    if best is None or bd > 600:
        print(f"  seed '{ne}' nearest province {bd:.0f}px away — skipped")
        seed_prov.append(None)
        continue
    taken.add(best)
    seed_prov.append(best)

# ---------------------------------------------------------------- grow (multi-source dijkstra)
print("growing regions…", flush=True)
INF = float("inf")
dist = [INF] * len(provs)
owner = [-1] * len(provs)
heap = []
for si, pi in enumerate(seed_prov):
    if pi is None:
        continue
    heap.append((0.0, pi, si))
heapq.heapify(heap)
while heap:
    d, i, si = heapq.heappop(heap)
    if owner[i] != -1:
        continue
    owner[i] = si
    dist[i] = d
    ci = provs[i]["cont"]
    for j, w in adj[i]:
        if owner[j] == -1:
            penalty = 1.0 if provs[j]["cont"] == ci else 2.0
            heapq.heappush(heap, (d + w * penalty, j, si))

orphans = [i for i in range(len(provs)) if owner[i] == -1]
for i in orphans:
    p = provs[i]
    best, bd = 0, 1e18
    for si, (ne, nr, x, y) in enumerate(seed_px):
        if seed_prov[si] is None:
            continue
        d = wdist((p["x"], p["y"]), (x, y))
        if d < bd:
            bd, best = d, si
    owner[i] = best
print("orphans attached directly:", len(orphans))

# ---------------------------------------------------------------- split oversized
groups = defaultdict(list)
for i, si in enumerate(owner):
    groups[si].append(i)

MAXN, TARGET = 26, 15
OCT_EN = ["East", "Northeast", "North", "Northwest", "West", "Southwest", "South", "Southeast"]
OCT_RU = ["Восток", "Северо-Восток", "Север", "Северо-Запад", "Запад", "Юго-Запад", "Юг", "Юго-Восток"]

def unwrap_xs(members):
    x0 = provs[members[0]]["x"]
    out = []
    for i in members:
        x = provs[i]["x"]
        if x - x0 > W / 2: x -= W
        elif x0 - x > W / 2: x += W
        out.append((x, provs[i]["y"]))
    return out

def kmeans(members, k):
    pts = unwrap_xs(members)
    cents = [pts[0]]
    while len(cents) < k:
        far, fd = None, -1
        for pt in pts:
            d = min((pt[0]-c[0])**2 + (pt[1]-c[1])**2 for c in cents)
            if d > fd: fd, far = d, pt
        cents.append(far)
    assign = [0]*len(pts)
    for _ in range(15):
        changed = False
        for i, pt in enumerate(pts):
            bi = min(range(len(cents)), key=lambda c: (pt[0]-cents[c][0])**2 + (pt[1]-cents[c][1])**2)
            if assign[i] != bi: assign[i] = bi; changed = True
        for c in range(len(cents)):
            mem = [pts[i] for i in range(len(pts)) if assign[i] == c]
            if mem:
                cents[c] = (sum(m[0] for m in mem)/len(mem), sum(m[1] for m in mem)/len(mem))
        if not changed: break
    clusters = defaultdict(list)
    for i, a in enumerate(assign):
        clusters[a].append(members[i])
    return [v for v in clusters.values() if v]

regions = []   # (name_en, name_ru, [prov indices])
for si, members in sorted(groups.items()):
    ne, nr, sx, sy = seed_px[si]
    if len(members) <= MAXN:
        regions.append((ne, nr, members))
        continue
    k = math.ceil(len(members) / TARGET)
    clusters = kmeans(members, k)
    pts_all = unwrap_xs(members)
    mx = sum(p[0] for p in pts_all)/len(pts_all)
    my = sum(p[1] for p in pts_all)/len(pts_all)
    used = Counter()
    for cl in clusters:
        pts = unwrap_xs(cl)
        cx = sum(p[0] for p in pts)/len(pts); cy = sum(p[1] for p in pts)/len(pts)
        ang = math.degrees(math.atan2(-(cy - my), cx - mx))
        oct_i = int(round(ang / 45.0)) % 8
        sufE, sufR = OCT_EN[oct_i], OCT_RU[oct_i]
        used[sufE] += 1
        n = used[sufE]
        if n > 1:
            sufE = f"{sufE} {n}"
            sufR = f"{sufR} {n}"
        regions.append((f"{ne} ({sufE})", f"{nr} ({sufR})", cl))

print("regions after split:", len(regions))
sizes = sorted(len(m) for _, _, m in regions)
print(f"sizes: min {sizes[0]}, median {sizes[len(sizes)//2]}, max {sizes[-1]}")

# ---------------------------------------------------------------- geometry + output
print("building geometries…", flush=True)
def round_coords(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], 1), round(obj[1], 1)]
        return [round_coords(o) for o in obj]
    return obj

features = []
for rid, (ne, nr, members) in enumerate(regions, start=1):
    geoms = [provs[i]["geom"] for i in members]
    try:
        u = unary_union(geoms)
    except Exception:
        u = unary_union([g.buffer(0) for g in geoms])
    if u.is_empty:
        continue
    terr = Counter(provs[i]["terrain"] for i in members).most_common(1)[0][0]
    gm = mapping(u)
    gm["coordinates"] = round_coords(gm["coordinates"])
    features.append({
        "type": "Feature",
        "geometry": gm,
        "properties": {
            "regionId": rid, "stateId": rid, "id": rid,
            "name": ne, "name_ru": nr,
            "provinceIds": sorted(provs[i]["pid"] for i in members),
            "provinceCount": len(members),
            "stateCategory": terr,
            "source": "AtlasForge original regions v1",
            "coordinateSystem": "pixel", "mapWidth": int(W), "mapHeight": int(H),
            "origin": "top-left"
        }
    })

out = {"type": "FeatureCollection", "features": features}
json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
import os
print(f"wrote {OUT}: {len(features)} regions, {os.path.getsize(OUT)/1e6:.1f} MB")

# ---------------------------------------------------------------- validation vs reference names
ref_by_name = {}
for f in ref_gj["features"]:
    nm = f["properties"]["name"].lower()
    if nm not in ref_by_name:
        c = shape(f["geometry"]).centroid
        ref_by_name[nm] = (c.x, c.y)
checked = []
for ne, nr, members in regions:
    base = ne.split(" (")[0].lower()
    if base in ref_by_name:
        xs = unwrap_xs(members)
        cx = sum(p[0] for p in xs)/len(xs); cy = sum(p[1] for p in xs)/len(xs)
        checked.append((ne, wdist((cx % W, cy), ref_by_name[base])))
checked.sort(key=lambda t: -t[1])
if checked:
    ds = [d for _, d in checked]
    print(f"validation vs reference (same-name regions): n={len(checked)}, "
          f"median {sorted(ds)[len(ds)//2]:.0f}px, worst 5:")
    for nm, d in checked[:5]:
        print(f"  {nm}: {d:.0f}px")
