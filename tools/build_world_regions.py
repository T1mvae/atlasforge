#!/usr/bin/env python3
# AtlasForge — build an ORIGINAL one-level world region grid from scratch.
#
# Sources: Natural Earth only (public domain) — no HOI4 / MapChart / prior files.
#   atoms     : NE 10m admin-1 polygons (real coastlines; internal lines often
#               follow rivers & ranges). Atoms are RAW MATERIAL, not the result:
#               they are split and re-aggregated freely.
#   rivers    : NE 50m river centerlines — used to CUT oversized wilderness
#               polygons along real rivers, and exported as a display layer.
#   lakes     : NE 50m lakes — display layer.
#   mountains : NE 50m geography polys (Range/mtn) — terrain metadata + display.
#
# Method: ~800 hand-authored seed regions (geography+history+culture names with
# real coordinates) grow over the atom-adjacency graph (within one modern
# country, so modern political maps stay reproducible). Oversized results are
# re-split; tiny slivers merge into neighbours. One flat layer, no hierarchy.
import json, math, heapq, sys
from collections import Counter, defaultdict
from shapely.geometry import shape, mapping, LineString, MultiLineString, Polygon, MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union, split as shp_split
from shapely.strtree import STRtree

# d3.geoPath uses spherical winding: exterior rings must be CLOCKWISE in planar
# lon/lat (the reverse of RFC 7946), else the polygon is read as "the whole
# sphere minus the shape". shapely output winding is arbitrary -> normalize.
def orient_for_d3(geom):
    if geom.geom_type == "Polygon":
        return orient(geom, sign=-1.0)
    if geom.geom_type == "MultiPolygon":
        return MultiPolygon([orient(g, sign=-1.0) for g in geom.geoms])
    return geom

CACHE = "tools/cache"
OUT_REGIONS   = "data/atlasforge_world_regions.geojson"
OUT_RIVERS    = "data/world_rivers.geojson"
OUT_LAKES     = "data/world_lakes.geojson"
OUT_MOUNTAINS = "data/world_mountains.geojson"

MAX_KM2_SETTLED = 190_000   # split settled regions bigger than this
MAX_KM2_WILD    = 460_000   # tundra/desert tolerance
MIN_KM2         = 7_000     # merge smaller (non-island) into neighbours
ATOM_SPLIT_KM2  = 350_000   # pre-split single atoms bigger than this

# ---------------------------------------------------------------- seeds
src = open("tools/generate_regions.py").read()
prefix = src.split("# ---------------------------------------------------------------- helpers")[0]
ns = {}
exec(prefix, ns)
SEEDS = list(ns["SEEDS"])

# Extra density so the grid lands in the 1000–3000 band with atlas-grade names.
EXTRA_SEEDS = [
 # Europe — France/Benelux/Alps
 ("Maine","Мэн (Франция)",48.3,-0.3),("Berry","Берри",46.9,2.3),
 ("Limousin","Лимузен",45.8,1.6),("Dauphine","Дофине",44.9,5.6),
 ("Roussillon","Руссильон",42.6,2.6),("Bourbonnais","Бурбонне",46.4,3.2),
 ("Artois","Артуа",50.4,2.6),("Bearn","Беарн",43.2,-0.6),
 ("Franche-Comte","Франш-Конте",47.2,6.0),("Nivernais","Нивернэ",47.1,3.6),
 ("Luxembourg","Люксембург",49.7,6.1),("Limburg","Лимбург",51.2,5.9),
 ("Gelderland","Гелдерланд",52.1,6.0),("Zeeland","Зеландия",51.5,3.8),
 ("Valais","Вале",46.2,7.6),("Grisons","Граубюнден",46.6,9.6),
 ("Salzburg","Зальцбург",47.5,13.1),("Carinthia","Каринтия",46.7,14.1),
 # Iberia / Italy
 ("Leon","Леон",42.3,-5.8),("Navarre","Наварра",42.7,-1.6),
 ("La Mancha","Ла-Манча",39.0,-3.0),("Algarve","Алгарве",37.2,-8.0),
 ("Beira","Бейра",40.5,-7.8),("Rioja","Риоха",42.3,-2.5),
 ("Romagna","Романья",44.2,12.1),("Friuli","Фриули",46.0,13.0),
 ("Trentino","Трентино",46.1,11.1),("Molise","Молизе",41.7,14.6),
 ("Basilicata","Базиликата",40.5,16.1),("Marche","Марке",43.3,13.2),
 # Britain & Ireland & Nordics
 ("Kent","Кент",51.2,0.7),("Cumbria","Камбрия",54.6,-3.0),
 ("Orkney and Shetland","Оркни и Шетланд",59.5,-2.0),("Hebrides","Гебриды",57.7,-7.0),
 ("Midlands","Мидлендс",52.9,-1.5),("Devon","Девон",50.8,-3.8),
 ("Halland","Халланд",56.9,12.8),("Varmland","Вермланд",59.8,13.2),
 ("Dalarna","Даларна",60.9,14.8),("Uppland","Уппланд",60.0,17.8),
 ("Agder","Агдер",58.5,7.8),("Rogaland","Ругаланн",58.9,6.0),
 ("Nordland","Нурланн",66.8,14.5),("Finnmark","Финнмарк",70.0,25.0),
 ("Aland","Аланды",60.2,20.0),("Gotland","Готланд",57.5,18.5),
 # Central & Eastern Europe
 ("Palatinate","Пфальц",49.4,7.8),("Baden","Баден",48.5,8.2),
 ("Oldenburg","Ольденбург",53.1,8.2),("Lusatia","Лужица",51.5,14.3),
 ("Kuyavia","Куявия",52.9,18.4),("Podlachia","Подляшье",53.3,23.0),
 ("Spis","Спиш",49.0,20.5),("Burgenland","Бургенланд",47.5,16.4),
 ("Bukovina","Буковина",47.9,25.9),("Maramures","Марамуреш",47.7,24.0),
 ("Oltenia","Олтения",44.5,23.5),("Muntenia","Мунтения",44.8,26.5),
 ("Herzegovina","Герцеговина",43.3,17.8),("Slavonia","Славония",45.4,18.0),
 ("Istria","Истрия",45.2,13.9),("Kosovo","Косово",42.6,21.0),
 ("Pomerelia","Помералия",54.0,18.2),("Warmia","Вармия",53.9,20.5),
 ("Samogitia","Жемайтия",55.7,22.2),("Latgale","Латгалия",56.3,27.0),
 # Russia / Ukraine / Caucasus
 ("Pskov Land","Псковщина",57.3,29.0),("Tver Land","Тверская земля",57.0,35.0),
 ("Meshchera","Мещёра",55.2,40.3),("Mordovia","Мордовия",54.4,44.3),
 ("Chuvashia","Чувашия",55.5,47.2),("Udmurtia","Удмуртия",57.2,52.7),
 ("Mari Land","Марий Эл",56.6,48.0),("Penza Land","Пензенский край",53.2,45.0),
 ("Saratov Volga","Саратовское Поволжье",51.6,46.0),
 ("Orenburg Steppe","Оренбургская степь",51.8,55.1),
 ("Stavropol Upland","Ставрополье",45.0,42.0),
 ("Circassia","Черкесия",44.3,40.5),("Ossetia","Осетия",43.0,44.3),
 ("Chechnya","Чечня",43.3,45.7),("Bryansk Forests","Брянские леса",52.8,33.5),
 ("Kursk Land","Курская земля",51.7,36.2),("Voronezh Land","Воронежская земля",51.0,39.5),
 ("Bessarabian Budjak","Буджак",45.8,29.5),("Pokuttia","Покутье",48.7,25.0),
 ("Chernihiv Land","Черниговщина",51.4,31.8),("Poltava Land","Полтавщина",49.6,34.0),
 ("Kherson Steppe","Херсонщина",46.8,32.8),
 # Central Asia & Siberia densify
 ("Zhetysu Alatau","Джетысуский Алатау",45.5,80.0),("Betpak-Dala","Бетпак-Дала",46.0,70.0),
 ("Ustyurt","Устюрт",43.5,55.5),("Kyzylkum","Кызылкум",42.5,63.5),
 ("Badakhshan","Бадахшан",37.0,71.5),("Wakhan","Вахан",37.0,73.5),
 ("Salair","Салаир",54.0,85.5),("Khakassia","Хакасия",53.5,90.0),
 ("Minusinsk Hollow","Минусинская котловина",53.8,92.0),
 ("Evenkia","Эвенкия",64.0,98.0),("Olyokma","Олёкма",58.5,121.0),
 ("Aldan Highlands","Алданское нагорье",57.5,127.0),
 ("Indigirka","Индигирка",67.5,143.0),("Yana Valley","Долина Яны",68.0,135.0),
 ("Anadyr Valley","Анадырская низменность",65.0,172.0),
 ("Koryak Highlands","Корякское нагорье",61.5,167.0),
 ("Stanovoy Range","Становой хребет",55.5,125.0),
 ("Bureya","Бурея",50.5,131.0),("Ussuri","Уссури",46.5,134.5),
 ("Zeya","Зея",53.5,127.5),("Tobol","Тоболье",56.5,66.0),
 ("Vasyugan Marshes","Васюганские болота",58.5,76.5),
 ("Narym","Нарым",59.0,81.5),("Surgut Ob","Сургутское Приобье",61.5,73.0),
 ("Konda","Конда",60.0,69.0),("Northern Sosva","Северная Сосьва",63.0,62.0),
 # Middle East / South Asia densify
 ("Lycia","Ликия",36.5,29.5),("Paphlagonia","Пафлагония",41.3,33.5),
 ("Commagene","Коммагена",37.5,38.0),("Assyria","Ассирия",36.3,43.2),
 ("Khuzestan","Хузестан",31.5,48.7),("Luristan","Луристан",33.5,48.2),
 ("Dasht-e Kavir","Деште-Кевир",34.5,54.5),("Dasht-e Lut","Деште-Лут",31.0,58.5),
 ("Makran","Мекран",26.0,62.5),("Quetta Highlands","Кветтское нагорье",30.2,67.0),
 ("Waziristan","Вазиристан",32.5,69.8),("Swat","Сват",35.0,72.3),
 ("Ladakh","Ладакх",34.3,77.5),("Garhwal","Гархвал",30.3,79.0),
 ("Bundelkhand","Бундельханд",25.3,79.3),("Chhattisgarh","Чхаттисгарх",21.3,82.0),
 ("Jharkhand","Джаркханд",23.6,85.5),("Telangana","Телангана",17.8,79.0),
 ("Rayalaseema","Раяласима",14.5,78.5),("Coromandel","Коромандель",12.5,79.8),
 ("Saurashtra","Саураштра",21.8,71.0),("Kutch","Кач",23.5,69.8),
 ("Mewar","Мевар",24.8,73.8),("Marwar","Марвар",26.3,72.5),
 ("Chittagong Hills","Читтагонгские холмы",22.5,92.2),("Sylhet","Силхет",24.7,91.7),
 # East & SE Asia densify
 ("Qinling","Циньлин",33.8,108.0),("Hanzhong","Ханьчжун",33.0,107.0),
 ("Gan Highlands","Ганьчжоу",25.8,114.9),("Hakka Hills","Хакка",24.5,116.0),
 ("Chaoshan","Чаошань",23.4,116.6),("Leizhou","Лэйчжоу",20.8,110.1),
 ("Wuling Mountains","Улин",28.8,110.0),("Daba Mountains","Даба",32.0,109.0),
 ("Liupan","Люпань",35.7,106.2),("Hetao","Хэтао",40.8,107.5),
 ("Greater Khingan","Большой Хинган",49.5,122.5),("Lesser Khingan","Малый Хинган",48.5,128.5),
 ("Changbai","Чанбайшань",42.2,128.0),("Liaodong","Ляодун",40.3,122.8),
 ("Jeju","Чеджу",33.4,126.5),("Honam","Хонам",35.3,126.9),
 ("Chubu Coast","Хокурику",36.8,137.2),("Okayama San'yo","Санъё",34.6,133.8),
 ("Tohoku North","Северный Тохоку",40.5,141.0),
 ("Red River Delta","Дельта Красной реки",20.5,106.0),
 ("Mekong Delta","Дельта Меконга",9.8,105.8),
 ("Champasak","Тямпасак",15.0,105.8),("Luang Prabang","Луангпхабанг",20.0,102.5),
 ("Kachin","Качин",25.8,97.5),("Chin Hills","Чинские холмы",22.8,93.6),
 ("Karen Hills","Каренские холмы",17.5,97.5),
 ("Pattani","Паттани",6.8,101.3),("Kedah","Кедах",6.1,100.4),
 ("Johor","Джохор",2.0,103.3),("Riau","Риау",0.5,102.0),
 ("Lampung","Лампунг",-5.0,105.2),("Banten","Бантен",-6.5,106.1),
 ("Madura","Мадура",-7.0,113.3),("Bali","Бали",-8.4,115.2),
 ("Lombok","Ломбок",-8.6,116.3),("Flores","Флорес",-8.6,121.0),
 ("Timor","Тимор",-9.2,124.8),("Banda Islands","Банда",-4.5,129.9),
 ("Halmahera","Хальмахера",0.6,128.0),("Bird's Head","Чендравасих",-1.5,133.5),
 ("Sepik","Сепик",-4.2,143.0),("Papuan Highlands","Папуасское нагорье",-5.8,143.5),
 ("Bougainville","Бугенвиль",-6.2,155.3),
 # Africa densify
 ("Tafilalt","Тафилальт",31.3,-4.3),("Draa Valley","Долина Драа",30.0,-6.5),
 ("Kabylia","Кабилия",36.6,4.5),("Aures","Орес",35.3,6.5),
 ("Mzab","Мзаб",32.5,3.7),("Tassili","Тассили",25.5,8.5),
 ("Air Mountains","Аир",18.0,8.5),("Tenere","Тенере",17.5,11.0),
 ("Adrar des Ifoghas","Адрар-Ифорас",19.5,2.0),("Ennedi","Эннеди",17.0,22.5),
 ("Borkou","Борку",18.0,19.0),("Batha","Бата",13.5,18.5),
 ("Casamance","Казаманс",12.7,-15.5),("Fouta Toro","Фута-Торо",16.3,-14.0),
 ("Bambuk","Бамбук",13.3,-11.3),("Gourma","Гурма",14.8,-1.0),
 ("Dendi","Денди",11.8,3.2),("Borgu","Боргу",10.3,3.5),
 ("Jos Plateau","Плато Джос",9.8,8.9),("Tiv Lands","Земли тив",7.3,9.0),
 ("Cross River","Кросс-Ривер",5.8,8.6),("Bamileke","Бамилеке",5.5,10.3),
 ("Sangha","Санга",2.0,16.5),("Ituri","Итури",1.8,28.8),
 ("Uele","Уэле",3.5,24.5),("Lomami","Ломами",-2.5,24.5),
 ("Kwango","Кванго",-6.5,17.5),("Lunda","Лунда",-9.0,20.5),
 ("Bie Plateau","Плато Бие",-12.5,17.0),("Cuando Cubango","Квандо-Кубанго",-15.5,19.5),
 ("Caprivi","Каприви",-17.9,23.3),("Okavango","Окаванго",-19.3,22.8),
 ("Hereroland","Гереро",-21.5,18.5),("Great Karoo","Большое Кару",-32.3,22.5),
 ("Zululand","Зулуленд",-28.3,31.5),("Basutoland","Басутоленд",-29.5,28.2),
 ("Swaziland","Свазиленд",-26.5,31.5),("Limpopo Valley","Долина Лимпопо",-23.0,29.5),
 ("Manica Highlands","Маника",-19.0,33.0),("Tete Corridor","Тете",-16.0,33.6),
 ("Rovuma","Рувума",-11.5,38.0),("Kilimanjaro","Килиманджаро",-3.2,37.4),
 ("Serengeti","Серенгети",-2.5,34.8),("Unyamwezi","Уньямвези",-5.0,32.8),
 ("Rufiji","Руфиджи",-8.0,38.0),("Turkana","Туркана",3.5,35.8),
 ("Jubba Valley","Долина Джуббы",2.0,42.5),("Majerteen","Маджиртин",8.5,49.5),
 ("Danakil","Данакиль",13.5,40.8),("Simien","Сымен",13.3,38.0),
 ("Kaffa","Каффа",7.3,36.2),("Sidamo","Сидамо",6.5,38.5),
 ("Nuba Mountains","Нубийские горы",11.5,30.5),("Bahr el Ghazal","Бахр-эль-Газаль",8.0,27.5),
 ("White Nile","Белый Нил",12.5,32.5),("Equatoria","Экватория",4.5,31.5),
 ("Antananarivo Highlands","Имерина",-19.0,47.5),("Betsimisaraka Coast","Бецимисарака",-17.5,49.3),
 ("Androy","Андруй",-24.8,45.7),
 # Americas densify
 ("Gaspesie","Гаспези",48.8,-65.5),("Saguenay","Сагеней",48.4,-71.1),
 ("Abitibi","Абитиби",48.6,-78.1),("Athabasca","Атабаска",57.5,-112.0),
 ("Peace River","Пис-Ривер",56.2,-117.5),("Okanagan","Оканаган",49.9,-119.5),
 ("Vancouver Island","Остров Ванкувер",49.7,-125.5),("Haida Gwaii","Хайда-Гуай",53.0,-132.0),
 ("Klondike","Клондайк",64.0,-139.4),("Kodiak","Кадьяк",57.5,-153.4),
 ("Seward Peninsula","Сьюард",65.2,-164.5),("Adirondacks","Адирондак",44.1,-74.2),
 ("Catskills","Катскилл",42.1,-74.4),("Tidewater","Тайдуотер",37.3,-76.5),
 ("Piedmont Carolina","Пидмонт",35.8,-81.0),("Bluegrass","Блюграсс",38.0,-84.5),
 ("Cumberland Plateau","Камберленд",36.0,-84.8),("Black Hills","Блэк-Хилс",44.0,-103.6),
 ("Badlands","Бэдлендс",43.8,-102.3),("Sandhills","Сандхилс",41.9,-101.0),
 ("Flint Hills","Флинт-Хилс",38.3,-96.5),("Llano Estacado","Льяно-Эстакадо",33.7,-102.3),
 ("Big Bend","Биг-Бенд",29.8,-103.3),("Mojave","Мохаве",35.0,-115.5),
 ("Wasatch","Уосатч",40.6,-111.5),("Yellowstone","Йеллоустон",44.5,-110.4),
 ("Bitterroot","Биттеррут",46.5,-114.3),("Palouse","Палус",46.8,-117.3),
 ("Klamath","Кламат",42.2,-122.8),("Big Sur Coast","Биг-Сур",36.2,-121.5),
 ("Tehuantepec","Теуантепек",16.5,-95.0),("Tabasco","Табаско",18.0,-92.8),
 ("Huasteca","Уастека",21.5,-98.5),("Jalisco Coast","Халиско",20.2,-104.0),
 ("Durango Sierra","Сьерра Дуранго",24.5,-105.5),("Peten","Петен",16.8,-89.9),
 ("Darien","Дарьен",8.2,-77.5),("Choco","Чоко",5.5,-77.0),
 ("Antioquia","Антьокия",6.8,-75.5),("Magdalena Valley","Долина Магдалены",7.5,-73.8),
 ("Zulia","Сулия",9.5,-72.0),("Margarita","Маргарита",11.0,-64.0),
 ("Roraima","Рорайма",3.5,-61.3),("Rio Negro","Риу-Негру",-1.0,-65.0),
 ("Madeira Valley","Долина Мадейры",-6.5,-62.0),("Acre","Акри",-9.5,-69.5),
 ("Beni","Бени",-14.0,-65.5),("Chiquitania","Чикитания",-17.0,-61.5),
 ("Potosi","Потоси",-20.0,-66.5),("Tarija","Тариха",-21.5,-64.5),
 ("Salta","Сальта",-24.8,-65.5),("Misiones","Мисьонес",-26.9,-54.5),
 ("Corrientes","Корриентес",-28.7,-57.8),("Neuquen","Неукен",-38.8,-69.8),
 ("Chubut Valley","Долина Чубут",-43.5,-68.5),("Santa Cruz Plateau","Плато Санта-Крус",-49.0,-70.0),
 ("Magallanes","Магальянес",-52.8,-71.5),("Chiloe","Чилоэ",-42.7,-73.9),
 ("Valdivia","Вальдивия",-39.9,-73.1),("Coquimbo","Кокимбо",-30.5,-71.1),
 ("Tocantins Valley","Долина Токантинс",-9.5,-48.3),("Caatinga","Каатинга",-9.8,-42.5),
 ("Espirito Santo","Эспириту-Санту",-19.8,-40.7),("Campos Gerais","Кампус-Жерайс",-25.0,-50.5),
 # Oceania densify
 ("Kimberley","Кимберли",-16.5,126.0),("Pilbara","Пилбара",-21.5,118.5),
 ("Gibson Desert","Пустыня Гибсона",-24.5,125.5),("Great Sandy Desert","Большая Песчаная пустыня",-21.0,123.5),
 ("Eyre Peninsula","Полуостров Эйр",-33.8,135.8),("Barossa","Баросса",-34.5,139.0),
 ("Riverina","Риверайна",-34.8,146.0),("Darling Downs","Дарлинг-Даунс",-27.5,151.0),
 ("Gulf Country","Галф-Кантри",-17.5,139.0),("Arnhem Land","Арнем-Ленд",-13.2,134.5),
 ("Otago","Отаго",-45.5,169.5),("Canterbury","Кентербери",-43.7,171.8),
 ("Westland","Уэстленд",-43.0,170.0),("Waikato","Уаикато",-37.8,175.3),
 ("Bay of Plenty","Бей-оф-Пленти",-38.0,177.0),("Vanuatu","Вануату",-16.5,167.5),
 ("Tonga","Тонга",-21.2,-175.2),("Tuvalu and Gilberts","Тувалу и Гилберта",-1.5,176.0),
]
SEEDS += EXTRA_SEEDS

# historical / cultural zone points (metadata only — nearest zone wins)
HIST_AREAS = [
 ("British Isles",54,-3),("Gaul",47,2.5),("Iberia",40,-4),("Italia",43,12),
 ("Hellas",38.5,23),("Germania",51,10),("Scandinavia",62,15),("Baltica",56.5,24),
 ("Pannonia",47,19),("Dacia",46,25),("Illyria",43.7,18),("Thracia",42.3,26),
 ("Rus",55.5,35),("Novgorod Lands",60,33),("Polonia",52,19),("Lithuania",55,24.5),
 ("Pontic Steppe",47.5,35),("Volga Bulgaria",55.5,49.5),("Ural",56,58),
 ("Anatolia",39,33),("Levant",33.5,36.5),("Mesopotamia",33,43.5),("Arabia",24,45),
 ("Persia",32,53),("Khorasan",35,60),("Transoxiana",40.5,65.5),("Scythia",48,66),
 ("Caucasus",42.5,44.5),("Egypt",27,31),("Nubia",18,32),("Maghreb",33,3),
 ("Sahara",23,10),("Sahel",14.5,5),("Guinea Coast",7,0),("Mali-Songhai",15,-4),
 ("Kanem-Bornu",13,15),("Aksum-Ethiopia",11,39),("Swahili Coast",-6,39.5),
 ("Kongo",-5.5,15.5),("Great Zimbabwe",-19,30.5),("Cape Frontier",-32,24),
 ("Madagascar",-19,47),("Hindustan",27,79),("Deccan",17,77),("Bengal",24,89),
 ("Ceylon",7.8,80.7),("Tibet",31,89),("Tarim",39.5,81),("Mongolia",46.5,104),
 ("China Proper",33,112),("Manchuria",45,125),("Korea",37.5,127.5),("Japan",36.5,138),
 ("Indochina",16,104),("Nusantara",-2,112),("Philippines",12,122.5),
 ("New Guinea",-5.5,142),("Australia",-25,134),("Aotearoa",-41,173),("Polynesia",-16,-160),
 ("Siberia",60,95),("Yakutia",64,128),("Far East",55,135),("Chukotka-Kamchatka",62,165),
 ("New France",47,-72),("Thirteen Colonies",39,-77),("Louisiana",34,-93),
 ("Oregon Country",45,-120),("New Spain",22,-101),("Maya Lands",17,-90),
 ("Caribbean",18,-72),("New Granada",5,-74),("Peru",-11,-74),("Inca Highlands",-15,-70),
 ("Brazil",-12,-48),("Amazonia",-4,-64),("La Plata",-33,-60),("Patagonia",-45,-69),
 ("Rupert's Land",56,-95),("Alaska",63,-152),("Greenland",70,-41),
 ("Great Plains",43,-100),("Aegean",38.3,26.8),("Appalachia",37.5,-81),
]
CULT_AREAS = [
 ("Anglo-Celtic",53,-3),("French",47,2.5),("Iberian",40,-4),("Italian",43,12),
 ("Greek",38.5,23.5),("German",50.5,10),("Dutch",52.2,5.3),("Nordic",62,13),
 ("Baltic",56,24),("West Slavic",51,18),("East Slavic",53,32),("South Slavic",44,19.5),
 ("Romanian",46,25.5),("Hungarian",47,19.3),("Albanian",41.2,20),
 ("Turkish",39.5,33.5),("Kurdish",37.3,43.5),("Levantine Arab",33.8,36.3),
 ("Mesopotamian Arab",32.5,44.5),("Peninsular Arab",23.5,45),("Egyptian",28,31),
 ("Maghrebi",33.5,2),("Berber",30,-6),("Sahelian",14.5,2),("West African",8.5,-2),
 ("Hausa-Fulani",12,8),("Bantu Central",-3,22),("Bantu East",-5,36),
 ("Bantu Southern",-26,28),("Khoisan",-26,19),("Horn African",8.5,42),
 ("Nilotic",6,32),("Malagasy",-19,47),("Persian",32.5,53),("Pashtun",32.5,67),
 ("Caucasian",42.7,44.5),("Armenian",40.2,44.8),("Georgian",42,43.5),
 ("Turkic Steppe",47,68),("Uzbek-Tajik",40,66.5),("Mongolic",46.5,104),
 ("Tibetan",31,89),("Han Chinese",33,112),("Cantonese",23,113),
 ("Manchu-Tungusic",47,127),("Korean",37,127.5),("Japanese",36.5,138),
 ("Vietnamese",17,107),("Khmer-Mon",12.5,104.5),("Thai-Lao",16,102),
 ("Burmese",20,95.5),("Malay",2,103),("Javanese",-7.3,110),("Filipino",12,122.5),
 ("Melanesian",-7,147),("Polynesian",-17,-165),("Micronesian",8,153),
 ("Aboriginal Australian",-23,133),("Maori",-39,176),("Alpine German",47.3,12.5),
 ("Indo-Aryan",26,80),("Dravidian",13,78),("Bengali",24,89.5),("Sinhalese",7.5,80.7),
 ("Russian",56,40),("Ukrainian",49.5,31),("Finno-Ugric",62,30),("Siberian Native",63,105),
 ("Inuit",68,-95),("First Nations",54,-110),("Anglo-American",39,-90),
 ("Franco-Canadian",47,-72),("Mexican",22,-101),("Central American",13.5,-86.5),
 ("Caribbean Creole",18,-72),("Andean",-13,-72),("Amazonian Native",-4,-64),
 ("Brazilian",-15,-47),("Platine",-33,-59),("Patagonian",-44,-69),
]

# ---------------------------------------------------------------- helpers
def km2(geom):
    c = geom.centroid
    coslat = max(0.08, math.cos(math.radians(c.y)))
    return abs(geom.area) * 111.32 * 111.32 * coslat

def gdist(ax, ay, bx, by):
    dx = abs(ax - bx); dx = min(dx, 360 - dx)
    coslat = max(0.15, math.cos(math.radians((ay + by) / 2)))
    return math.hypot(dx * coslat, ay - by)

def polys_of(geom):
    if geom.is_empty: return []
    if geom.geom_type == "Polygon": return [geom]
    if geom.geom_type == "MultiPolygon": return list(geom.geoms)
    if geom.geom_type == "GeometryCollection":
        return [g for g in geom.geoms if g.geom_type in ("Polygon", "MultiPolygon")
                for g in (g.geoms if g.geom_type == "MultiPolygon" else [g])]
    return []

def straight_cut(poly):
    minx, miny, maxx, maxy = poly.bounds
    if maxx - minx >= maxy - miny:
        x = (minx + maxx) / 2
        line = LineString([(x, miny - 1), (x, maxy + 1)])
    else:
        y = (miny + maxy) / 2
        line = LineString([(minx - 1, y), (maxx + 1, y)])
    try:
        return polys_of(shp_split(poly, line))
    except Exception:
        return []

def river_cut(poly, rivers_tree, rivers_list):
    cands = []
    for idx in rivers_tree.query(poly):
        r = rivers_list[idx]
        try:
            if not r.intersects(poly): continue
            pieces = polys_of(shp_split(poly, r))
            if len(pieces) >= 2:
                pieces.sort(key=lambda g: -g.area)
                ratio = pieces[1].area / max(1e-12, pieces[0].area)
                if ratio > 0.12:
                    cands.append((ratio, pieces))
        except Exception:
            continue
    if not cands: return []
    cands.sort(key=lambda t: -t[0])
    return cands[0][1]

def subdivide(poly, max_km2, rivers_tree, rivers_list, depth=0):
    if km2(poly) <= max_km2 or depth > 7:
        return [poly]
    pieces = river_cut(poly, rivers_tree, rivers_list)
    if len(pieces) < 2:
        pieces = straight_cut(poly)
    if len(pieces) < 2:
        return [poly]
    out = []
    for p in pieces:
        if p.area <= 0: continue
        out.extend(subdivide(p, max_km2, rivers_tree, rivers_list, depth + 1))
    return out or [poly]

def round_coords(o):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)):
            return [round(o[0], 3), round(o[1], 3)]
        return [round_coords(x) for x in o]
    return o

# ---------------------------------------------------------------- load
print("loading Natural Earth…", flush=True)
adm = json.load(open(f"{CACHE}/ne_admin1_10m.json"))
riv = json.load(open(f"{CACHE}/ne_rivers_50m.json"))
lak = json.load(open(f"{CACHE}/ne_lakes_50m.json"))
geo = json.load(open(f"{CACHE}/ne_geogregions_50m.json"))

rivers_list = []
for f in riv["features"]:
    if not f.get("geometry"): continue
    g = shape(f["geometry"])
    if g.geom_type == "MultiLineString":
        rivers_list.extend(g.geoms)
    elif g.geom_type == "LineString":
        rivers_list.append(g)
rivers_tree = STRtree(rivers_list)

ranges = [shape(f["geometry"]).buffer(0) for f in geo["features"]
          if f.get("geometry") and f["properties"].get("featurecla") == "Range/mtn"]
deserts = [shape(f["geometry"]).buffer(0) for f in geo["features"]
           if f.get("geometry") and f["properties"].get("featurecla") == "Desert"]
tundras = [shape(f["geometry"]).buffer(0) for f in geo["features"]
           if f.get("geometry") and f["properties"].get("featurecla") == "Tundra"]
ranges_tree = STRtree(ranges)
deserts_tree = STRtree(deserts)
tundras_tree = STRtree(tundras)

def terrain_at(geom):
    c = geom.centroid
    lat = c.y
    for t, tree, lst in (("mountain", ranges_tree, ranges), ("desert", deserts_tree, deserts)):
        for idx in tree.query(c):
            if lst[idx].contains(c): return t
    for idx in tundras_tree.query(c):
        if tundras[idx].contains(c): return "tundra"
    if abs(lat) > 64: return "tundra"
    if abs(lat) < 16: return "jungle"
    if 48 < abs(lat) <= 64: return "forest"
    return "plains"

# ---------------------------------------------------------------- atoms
print("preparing atoms…", flush=True)
atoms = []   # {geom, c(x,y), country, km2}
skipped = 0
for f in adm["features"]:
    p = f["properties"]
    country = p.get("admin") or p.get("geonunit") or "?"
    if country == "Antarctica" or not f.get("geometry"):
        skipped += 1; continue
    try:
        g = shape(f["geometry"])
        if not g.is_valid: g = g.buffer(0)
    except Exception:
        skipped += 1; continue
    if g.is_empty: continue
    a = km2(g)
    pieces = [g] if a <= ATOM_SPLIT_KM2 else subdivide(g, ATOM_SPLIT_KM2, rivers_tree, rivers_list)
    for piece in pieces:
        if piece.is_empty: continue
        c = piece.centroid
        atoms.append({"geom": piece, "x": c.x, "y": c.y, "country": country,
                      "km2": km2(piece), "name": p.get("name") or country})
print("atoms:", len(atoms), "(skipped:", skipped, ")")

# ---------------------------------------------------------------- adjacency (same country)
print("adjacency…", flush=True)
atom_geoms = [a["geom"] for a in atoms]
tree = STRtree(atom_geoms)
adjm = [set() for _ in atoms]
for i, a in enumerate(atoms):
    for j in tree.query(a["geom"]):
        j = int(j)
        if j <= i: continue
        b = atoms[j]
        if b["country"] != a["country"]: continue
        try:
            if a["geom"].distance(b["geom"]) < 0.05:
                adjm[i].add(j); adjm[j].add(i)
        except Exception:
            continue
print("avg degree:", sum(len(s) for s in adjm) / max(1, len(adjm)))

# ---------------------------------------------------------------- grow
print("growing regions…", flush=True)
seed_pos = [(ne, nr, lon, lat) for ne, nr, lat, lon in SEEDS]
# seed -> nearest atom
owner = [-1] * len(atoms)
seed_atom = []
taken = set()
for si, (ne, nr, sx, sy) in enumerate(seed_pos):
    best, bd = None, 1e18          # nearest free atom
    abest, abd = None, 1e18        # nearest atom overall
    for i, a in enumerate(atoms):
        d = gdist(sx, sy, a["x"], a["y"])
        if d < abd: abd, abest = d, i
        if d < bd and i not in taken: bd, best = d, i
    if best is None or bd > 12.0:
        seed_atom.append(None); continue
    # if the seed's true location is taken, don't let it jump into another
    # country or far away — drop it (neighbouring seeds cover the area)
    if abest is not None and abest in taken:
        if atoms[best]["country"] != atoms[abest]["country"] or bd > abd + 2.0:
            seed_atom.append(None); continue
    taken.add(best); seed_atom.append(best)

heap = []
for si, ai in enumerate(seed_atom):
    if ai is not None:
        heap.append((0.0, ai, si))
heapq.heapify(heap)
while heap:
    d, i, si = heapq.heappop(heap)
    if owner[i] != -1: continue
    owner[i] = si
    for j in adjm[i]:
        if owner[j] == -1:
            w = gdist(atoms[i]["x"], atoms[i]["y"], atoms[j]["x"], atoms[j]["y"])
            heapq.heappush(heap, (d + w, j, si))

# orphans: nearest seed, same country preferred
for i in range(len(atoms)):
    if owner[i] != -1: continue
    best, bd = None, 1e18
    for si, (ne, nr, sx, sy) in enumerate(seed_pos):
        if seed_atom[si] is None: continue
        d = gdist(atoms[i]["x"], atoms[i]["y"], sx, sy)
        if atoms[seed_atom[si]]["country"] != atoms[i]["country"]: d *= 3.0
        if d < bd: bd, best = d, si
    owner[i] = best

# regions = (seed, country) so one seed never spans two countries
groups = defaultdict(list)
for i, si in enumerate(owner):
    groups[(si, atoms[i]["country"])].append(i)

# ---------------------------------------------------------------- size control
OCT_EN = ["East","Northeast","North","Northwest","West","Southwest","South","Southeast"]
OCT_RU = ["Восток","Северо-Восток","Север","Северо-Запад","Запад","Юго-Запад","Юг","Юго-Восток"]

def kmeans_atoms(members, k):
    pts = [(atoms[i]["x"], atoms[i]["y"]) for i in members]
    cents = [pts[0]]
    while len(cents) < k:
        far, fd = None, -1
        for pt in pts:
            d = min((pt[0]-c[0])**2 + (pt[1]-c[1])**2 for c in cents)
            if d > fd: fd, far = d, pt
        cents.append(far)
    assign = [0]*len(pts)
    for _ in range(14):
        ch = False
        for i, pt in enumerate(pts):
            bi = min(range(len(cents)), key=lambda c:(pt[0]-cents[c][0])**2 + (pt[1]-cents[c][1])**2)
            if assign[i] != bi: assign[i] = bi; ch = True
        for c in range(len(cents)):
            mem = [pts[i] for i in range(len(pts)) if assign[i] == c]
            if mem: cents[c] = (sum(m[0] for m in mem)/len(mem), sum(m[1] for m in mem)/len(mem))
        if not ch: break
    out = defaultdict(list)
    for i, a in enumerate(assign): out[a].append(members[i])
    return [v for v in out.values() if v]

proto = []   # (seedIdx, [atomIdx])
def push_sized(si, members, cap, depth=0):
    total = sum(atoms[i]["km2"] for i in members)
    if total <= cap or len(members) < 2 or depth > 5:
        proto.append((si, members)); return
    k = min(len(members), max(2, math.ceil(total / (cap * 0.75))))
    for part in kmeans_atoms(members, k):
        push_sized(si, part, cap, depth + 1)

for (si, country), members in groups.items():
    terr = terrain_at(unary_union([atoms[i]["geom"] for i in members[:30]]))
    cap = MAX_KM2_WILD if terr in ("tundra", "desert") else MAX_KM2_SETTLED
    push_sized(si, members, cap)

# ---- merge dust: tiny mainland regions join their smallest same-country neighbour
atom_proto = {}
for pi, (si, members) in enumerate(proto):
    for i in members: atom_proto[i] = pi
parent = list(range(len(proto)))
set_area = {pi: sum(atoms[i]["km2"] for i in m) for pi, (_, m) in enumerate(proto)}
set_members = {pi: list(m) for pi, (_, m) in enumerate(proto)}
def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]; x = parent[x]
    return x
for _ in range(4):
    changed = False
    for pi in range(len(proto)):
        rp = find(pi)
        if set_area.get(rp, 0) >= MIN_KM2 or rp not in set_members: continue
        members = set_members[rp]
        country = atoms[members[0]]["country"]
        best, bd = None, None
        for i in members:
            for j in adjm[i]:
                qp = find(atom_proto[j])
                if qp == rp or atoms[j]["country"] != country: continue
                qa = set_area.get(qp, 0)
                if bd is None or qa < bd: bd, best = qa, qp
        if best is not None:
            parent[rp] = best
            set_area[best] += set_area.pop(rp)
            set_members[best].extend(set_members.pop(rp))
            changed = True
    if not changed: break
proto = [(proto[root][0], mems) for root, mems in set_members.items()]

# ---------------------------------------------------------------- assemble + names
print("assembling…", flush=True)
name_use = Counter()
features_out = []
def zone_of(zlist, x, y):
    return min(zlist, key=lambda z: gdist(x, y, z[2], z[1]))[0]

seed_home = {}
for si, ai in enumerate(seed_atom):
    if ai is not None: seed_home[si] = atoms[ai]["country"]
country_km2 = defaultdict(float)
for a in atoms: country_km2[a["country"]] += a["km2"]

for si, members in proto:
    geom = unary_union([atoms[i]["geom"] for i in members])
    if geom.is_empty: continue
    a_km2 = km2(geom)
    c = geom.centroid
    country = atoms[members[0]]["country"]
    ne, nr, sx, sy = seed_pos[si]
    # spillover guard: a group whose seed is homed in another country gets a
    # local name — nearest same-country seed, else its biggest atom's own name
    if seed_home.get(si) != country:
        best, bd = None, 1e18
        for sj, home in seed_home.items():
            if home != country: continue
            d = gdist(c.x, c.y, seed_pos[sj][2], seed_pos[sj][3])
            if d < bd: bd, best = d, sj
        if best is not None and bd < 12.0:
            ne, nr, sx, sy = seed_pos[best]
        else:
            # whole micro-country -> country name; fragment -> its biggest atom's name
            if a_km2 >= 0.6 * country_km2.get(country, 1e18) or a_km2 >= 60_000:
                local = country
            else:
                big = max(members, key=lambda i: atoms[i]["km2"])
                local = atoms[big]["name"]
            ne, nr, sx, sy = local, local, c.x, c.y
    name_e, name_r = ne, nr
    n = name_use[ne]
    if n > 0:
        ang = math.degrees(math.atan2(c.y - sy, c.x - sx))
        oi = int(round(ang / 45.0)) % 8
        name_e = f"{ne} ({OCT_EN[oi]})"; name_r = f"{nr} ({OCT_RU[oi]})"
        m = 2
        while name_use[name_e]:
            name_e = f"{ne} ({OCT_EN[oi]} {m})"; name_r = f"{nr} ({OCT_RU[oi]} {m})"; m += 1
    name_use[ne] += 1; name_use[name_e] += 1
    geom_s = geom.simplify(0.02, preserve_topology=True)
    if geom_s.is_empty or not geom_s.is_valid: geom_s = geom.buffer(0)
    geom_s = orient_for_d3(geom_s)
    gm = mapping(geom_s)
    gm["coordinates"] = round_coords(gm["coordinates"])
    features_out.append({
        "type": "Feature", "id": "w%d" % (len(features_out) + 1),
        "geometry": gm,
        "properties": {
            "id": "w%d" % (len(features_out) + 1),
            "name": name_e, "name_ru": name_r,
            "admin": atoms[members[0]]["country"],
            "terrain": terrain_at(geom),
            "historicalArea": zone_of(HIST_AREAS, c.x, c.y),
            "culturalArea": zone_of(CULT_AREAS, c.x, c.y),
            "areaKm2": int(a_km2),
            "color": None, "ownerCountryId": None, "notes": ""
        }
    })

json.dump({"type": "FeatureCollection", "features": features_out},
          open(OUT_REGIONS, "w"), ensure_ascii=False, separators=(",", ":"))

# ---------------------------------------------------------------- display layers
def export_layer(feats, path, keep):
    out = []
    for f in feats:
        if not f.get("geometry"): continue
        props = {k: f["properties"].get(k) for k in keep}
        gm = f["geometry"]
        out.append({"type": "Feature", "geometry": gm, "properties": props})
    json.dump({"type": "FeatureCollection", "features": out},
              open(path, "w"), ensure_ascii=False, separators=(",", ":"))

export_layer(riv["features"], OUT_RIVERS, ["name", "scalerank"])
export_layer(lak["features"], OUT_LAKES, ["name", "scalerank"])
export_layer([f for f in geo["features"] if f["properties"].get("featurecla") == "Range/mtn"],
             OUT_MOUNTAINS, ["name"])

import os
sizes = sorted(f["properties"]["areaKm2"] for f in features_out)
print(f"\nwrote {OUT_REGIONS}: {len(features_out)} regions, {os.path.getsize(OUT_REGIONS)/1e6:.1f} MB")
print(f"area km2: min {sizes[0]}, median {sizes[len(sizes)//2]}, max {sizes[-1]}")
big = sum(1 for s in sizes if s > MAX_KM2_WILD)
print("regions over wild cap:", big)
for p, lbl in ((OUT_RIVERS,'rivers'),(OUT_LAKES,'lakes'),(OUT_MOUNTAINS,'mountains')):
    print(f"{lbl}: {os.path.getsize(p)/1e6:.1f} MB")
from collections import Counter as C
print("terrain:", dict(C(f["properties"]["terrain"] for f in features_out)))
