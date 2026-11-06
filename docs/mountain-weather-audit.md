# Mountain weather location audit — November 6, 2026

All 105 canonical destinations now have weather points separate from the map pins. 104 are reproducible spatial samples on a mapped ski trail: select one vertex midpoint per trail segment, take median latitude/longitude, then choose the closest candidate. This locates weather on actual terrain without inventing a mid-mountain height or favoring the summit. Whistler uses the Whistler endpoint of PEAK 2 PEAK and the resort-published Roundhouse elevation of 1,850 m.

These are **terrain samples, not observed weather stations**, and spatial centrality does not guarantee an average elevation or representative snow across a broad ski area. Multi-mountain destinations remain one sample; separate mountain/elevation forecasts are future work. Open-Meteo supplies DEM elevation for the 104 samples. Its response grid center can differ from the requested point. Keep requested coordinates, returned grid center and elevation distinct.

The table records the actual freshly fetched model elevation and the movement from each previous catalog point. The existing catalog/map coordinates are unchanged. Exact feature IDs and source files are retained in js/weather-locations-data.js; the 104 map source links show the sampled location on OpenSkiMap, not fabricated OSM feature URLs. Generator: node scripts/build_weather_locations.mjs. No forecast or historical totals were used to select points. The coarse ERA5 season history remains at its existing coordinates and is outside this correction.

Sources: [Open-Meteo coordinates, DEM and grid-cell documentation](https://open-meteo.com/en/docs), [Whistler official elevation reference](https://www.whistlerblackcomb.com/the-mountain/mountain-conditions/snow-and-weather-report), and existing data/trails snapshots and their js/trail-catalog.js attribution.

| Destination | Previous → terrain distance | Modeled elevation | Sample / source |
|---|---:|---:|---|
| Vail | 3.0 km | 3096 m | [Unnamed trail](https://openskimap.org/#15/39.6138484/-106.3655914) |
| Beaver Creek | 1.5 km | 2780 m | [Thresher Glade](https://openskimap.org/#15/39.5957945/-106.5299183) |
| Breckenridge | 3.1 km | 3222 m | [Sawmill](https://openskimap.org/#15/39.4726291/-106.0723234) |
| Keystone | 4.7 km | 3355 m | [Mozart](https://openskimap.org/#15/39.5718987/-105.9415005) |
| Crested Butte | 1.7 km | 3112 m | [Kubler](https://openskimap.org/#15/38.8991029/-106.9459868) |
| Park City | 3.7 km | 2507 m | [Snowdancer](https://openskimap.org/#15/40.6532953/-111.5519363) |
| Kirkwood | 0.6 km | 2430 m | [Buckboard](https://openskimap.org/#15/38.6793544/-120.0665551) |
| Heavenly | 3.1 km | 2900 m | [Unnamed trail](https://openskimap.org/#15/38.9329708/-119.9041407) |
| Northstar | 2.3 km | 2293 m | [Christmas Tree](https://openskimap.org/#15/39.2560502/-120.1331377) |
| Stowe | 0.7 km | 534 m | [Sepp's Run](https://openskimap.org/#15/44.5287469/-72.7903656) |
| Okemo | 1.6 km | 745 m | [Upper Arrow](https://openskimap.org/#15/43.4090594/-72.7339354) |
| Mount Sunapee | 0.7 km | 629 m | [Byway](https://openskimap.org/#15/43.3225407/-72.0758098) |
| Stevens Pass | 0.7 km | 1302 m | [Easy Street](https://openskimap.org/#15/47.7391511/-121.0910689) |
| Whistler Blackcomb | 5.3 km | 1850 m | [Peak 2 Peak Gondola](https://www.whistlerblackcomb.com/the-mountain/mountain-conditions/snow-and-weather-report) |
| Afton Alps | 9.4 km | 277 m | [Unnamed trail](https://openskimap.org/#15/44.8545907/-92.7843951) |
| Mt. Brighton | 0.4 km | 293 m | [Cheetah](https://openskimap.org/#15/42.5400434/-83.8091995) |
| Wilmot Mountain | 0.3 km | 272 m | [Upper Cat Trail](https://openskimap.org/#15/42.497365/-88.1908964) |
| Attitash | 1.0 km | 277 m | [Bear Notch Pass](https://openskimap.org/#15/44.0758673/-71.2357713) |
| Wildcat Mountain | 0.8 km | 800 m | [Panther](https://openskimap.org/#15/44.2578657/-71.2325266) |
| Crotched Mountain | 1.1 km | 440 m | [Equinox](https://openskimap.org/#15/43.0066412/-71.8791615) |
| Hunter Mountain | 0.4 km | 737 m | [Times Square](https://openskimap.org/#15/42.2017885/-74.2209801) |
| Mount Snow | 0.8 km | 888 m | [South Bowl](https://openskimap.org/#15/42.9608203/-72.9105097) |
| Jack Frost / Big Boulder | 5.9 km | 574 m | [Telstar](https://openskimap.org/#15/41.1079225/-75.6461284) |
| Roundtop Mountain | 0.3 km | 337 m | [Minuteman](https://openskimap.org/#15/40.1059225/-76.9264733) |
| Liberty Mountain | 0.7 km | 338 m | [Upper Heavenly](https://openskimap.org/#15/39.7579748/-77.3676378) |
| Whitetail Resort | 0.2 km | 348 m | [Homerun](https://openskimap.org/#15/39.7439192/-77.9365506) |
| Seven Springs | 0.5 km | 880 m | [Blitzen Slope](https://openskimap.org/#15/40.0241293/-79.3038826) |
| Hidden Valley | 1.0 km | 795 m | [Viper](https://openskimap.org/#15/40.0583938/-79.2506384) |
| Laurel Mountain | 0.6 km | 773 m | [Lynx Trail](https://openskimap.org/#15/40.1664273/-79.1683635) |
| Perisher | 1.5 km | 1883 m | [Copperhead Road](https://openskimap.org/#15/-36.3958188/148.3998425) |
| Falls Creek | 0.7 km | 1632 m | [Stiletto](https://openskimap.org/#15/-36.8682263/147.2725566) |
| Hotham | 2.1 km | 1604 m | [D8](https://openskimap.org/#15/-36.9763067/147.1473077) |
| Hakuba Valley | 1.2 km | 843 m | [咲花ゲレンデ北](https://openskimap.org/#15/36.7093521/137.8318951) |
| Rusutsu | 28.9 km | 614 m | [連絡コース, Joint](https://openskimap.org/#15/42.7270763/140.9188572) |
| Andermatt-Sedrun | 6.2 km | 2431 m | [Platten](https://openskimap.org/#15/46.66652/8.6604613) |
| Verbier (4 Vallées) | 5.5 km | 2210 m | [Chassoure-Tortin](https://openskimap.org/#15/46.1139976/7.2960635) |
| Crans-Montana | 2.4 km | 2093 m | [Charly](https://openskimap.org/#15/46.3366708/7.4944537) |
| Les 3 Vallées | 1.2 km | 1720 m | [Stade](https://openskimap.org/#15/45.3724841/6.5832676) |
| Paradiski | 5.7 km | 1985 m | [La Forêt](https://openskimap.org/#15/45.5506521/6.7798996) |
| Tignes | 2.0 km | 2572 m | [Creux](https://openskimap.org/#15/45.4552075/6.9243798) |
| Val d'Isère | 4.5 km | 2572 m | [Creux](https://openskimap.org/#15/45.4552075/6.9243798) |
| Telluride | 2.8 km | 3175 m | [Boomerang](https://openskimap.org/#15/37.9222314/-107.8373065) |
| Aspen Snowmass | 8.5 km | 2694 m | [Golden Barrel](https://openskimap.org/#15/39.1737078/-106.860729) |
| Steamboat | 3.5 km | 2753 m | [Twister](https://openskimap.org/#15/40.4558486/-106.7628259) |
| Winter Park | 1.7 km | 3237 m | [Sober Englishman](https://openskimap.org/#15/39.871376/-105.7731009) |
| Copper Mountain | 2.4 km | 3353 m | [EZ Road](https://openskimap.org/#15/39.4826059/-106.1625641) |
| Eldora | 0.9 km | 3060 m | [Psychopath](https://openskimap.org/#15/39.9377354/-105.5929664) |
| Arapahoe Basin | 1.3 km | 3680 m | [Cornice Run](https://openskimap.org/#15/39.631033/-105.8759631) |
| Big Sky | 2.3 km | 2680 m | [Harbor's Natural Halfpipe](https://openskimap.org/#15/45.2814781/-111.429624) |
| Jackson Hole | 1.3 km | 2259 m | [Nez Perce](https://openskimap.org/#15/43.5957601/-110.8397713) |
| Alta | 1.4 km | 3089 m | [Unnamed trail](https://openskimap.org/#15/40.5775898/-111.6310717) |
| Snowbird | 1.7 km | 3070 m | [Cirque Traverse](https://openskimap.org/#15/40.568144/-111.6524494) |
| Deer Valley | 2.4 km | 2572 m | [Reward](https://openskimap.org/#15/40.6161529/-111.4784186) |
| Brighton Resort | 0.5 km | 2764 m | [Hawkeye Access](https://openskimap.org/#15/40.5947523/-111.5794813) |
| Solitude | 1.0 km | 2673 m | [Fleet Street](https://openskimap.org/#15/40.615436/-111.6028406) |
| Mammoth Mountain | 1.7 km | 2811 m | [Unnamed trail](https://openskimap.org/#15/37.642456/-119.0207208) |
| June Mountain | 2.6 km | 2783 m | [Schatzi](https://openskimap.org/#15/37.7484366/-119.0742445) |
| Big Bear Mountain | 1.7 km | 2492 m | [Unnamed trail](https://openskimap.org/#15/34.2207853/-116.8925272) |
| Palisades Tahoe | 1.4 km | 2308 m | [GS Bowl](https://openskimap.org/#15/39.1847087/-120.2404866) |
| Killington | 1.6 km | 993 m | [Old Superstar](https://openskimap.org/#15/43.6111717/-72.8029328) |
| Sugarbush | 1.1 km | 713 m | [Castlerock Connection](https://openskimap.org/#15/44.138712/-72.91363) |
| Stratton | 1.2 km | 874 m | [Rimeline](https://openskimap.org/#15/43.1037042/-72.9141521) |
| Tremblant | 2.7 km | 816 m | [Dunzee](https://openskimap.org/#15/46.2208333/-74.5555786) |
| Blue Mountain (Ontario) | 0.3 km | 392 m | [Tranquility](https://openskimap.org/#15/44.4985412/-80.3180409) |
| SkiBig3 (Banff) | 14.9 km | 1661 m | [Banff Avenue](https://openskimap.org/#15/51.1149043/-115.7628381) |
| Revelstoke | 7.3 km | 1857 m | [Critical Path](https://openskimap.org/#15/50.967896/-118.1161302) |
| Cypress Mountain | 0.1 km | 919 m | [Howe Sound Crest Trail](https://openskimap.org/#15/49.3964038/-123.2028791) |
| Red Mountain | 0.1 km | 1786 m | [Shoulder](https://openskimap.org/#15/49.1053567/-117.8449066) |
| Sun Peaks | 1.8 km | 1691 m | [Sting](https://openskimap.org/#15/50.8962784/-119.8993922) |
| Crystal Mountain | 1.1 km | 1769 m | [Greg's Gulch](https://openskimap.org/#15/46.9326263/-121.4920782) |
| The Summit at Snoqualmie | 1.7 km | 1019 m | [Alpine](https://openskimap.org/#15/47.4054959/-121.4191999) |
| Loon Mountain | 1.2 km | 646 m | [Bear Island Bypass](https://openskimap.org/#15/44.0436957/-71.6321535) |
| Sugarloaf | 1.3 km | 792 m | [Lower Competition Hill](https://openskimap.org/#15/45.0427207/-70.3151289) |
| Sunday River | 1.3 km | 559 m | [Last Tango](https://openskimap.org/#15/44.466984/-70.8711457) |
| Boyne Highlands | 1.3 km | 326 m | [K-2](https://openskimap.org/#15/45.4713074/-84.9418274) |
| Boyne Mountain | 0.6 km | 253 m | [Easy Access](https://openskimap.org/#15/45.1656888/-84.939432) |
| Taos | 1.6 km | 3358 m | [Upper Powderhorn](https://openskimap.org/#15/36.5817177/-105.4543192) |
| Snowshoe | 0.7 km | 1378 m | [Whistlepunk](https://openskimap.org/#15/38.4169262/-79.9930215) |
| Windham Mountain | 0.9 km | 712 m | [Wall Street](https://openskimap.org/#15/42.2903305/-74.2625064) |
| Chamonix (Mont Blanc) | 6.0 km | 1914 m | [Remuaz](https://openskimap.org/#15/45.9600479/6.9268744) |
| Zermatt | 8.8 km | 3285 m | [Bontadini](https://openskimap.org/#15/45.9467835/7.7084565) |
| St. Moritz (Diavolezza) | 2.2 km | 2531 m | [Diavolezza](https://openskimap.org/#15/46.4247006/9.9744515) |
| Kitzbühel | 5.1 km | 1696 m | [Direttissima](https://openskimap.org/#15/47.4063902/12.3672765) |
| Lech Zürs am Arlberg | 1.9 km | 1547 m | [Skiroute - Wiesele, Lech - Zürs](https://openskimap.org/#15/47.1917139/10.1488098) |
| Dolomiti Superski | 1.2 km | 1717 m | [Sellaronda Arancione, Sellaronda orange, Frara Variante](https://openskimap.org/#15/46.5462236/11.8371947) |
| Thredbo | 1.6 km | 1700 m | [Bunny Walk](https://openskimap.org/#15/-36.4945743/148.2954772) |
| Niseko United | 1.1 km | 851 m | [白樺コース, Shirakaba](https://openskimap.org/#15/42.8667392/140.6752229) |
| Lotte Arai | 6.0 km | 534 m | [六本木ロード](https://openskimap.org/#15/36.991523/138.160851) |
| Valle Nevado | 2.2 km | 3145 m | [Unnamed trail](https://openskimap.org/#15/-33.3439581/-70.2515694) |
| Panorama | 1.7 km | 1535 m | [Moose Trail](https://openskimap.org/#15/50.4452447/-116.2285727) |
| Schweitzer | 1.4 km | 1686 m | [Shoot The Moon](https://openskimap.org/#15/48.3798339/-116.6231124) |
| Sun Valley | 4.8 km | 2446 m | [Unnamed trail](https://openskimap.org/#15/43.6685164/-114.3958529) |
| Snowbasin | 2.0 km | 2357 m | [Bullwinkle](https://openskimap.org/#15/41.1986884/-111.8632121) |
| Grand Targhee | 0.7 km | 2614 m | [Sweetwater](https://openskimap.org/#15/43.7886343/-110.9488752) |
| Sugar Bowl | 0.7 km | 2185 m | [Von Ruiten's Run](https://openskimap.org/#15/39.2989907/-120.3313343) |
| Whiteface | 2.1 km | 742 m | [Lower Mackenzie](https://openskimap.org/#15/44.3589988/-73.8784111) |
| Banff Sunshine | 0.6 km | 2173 m | [Schoolmarm](https://openskimap.org/#15/51.0789665/-115.7739043) |
| Bromont | 1.3 km | 505 m | [Albany](https://openskimap.org/#15/45.2904218/-72.6359584) |
| Lake Louise | 2.4 km | 2271 m | [Flight Chutes 2](https://openskimap.org/#15/51.4558059/-116.1359811) |
| Le Massif de Charlevoix | 2.0 km | 494 m | [La Vieille-Côte](https://openskimap.org/#15/47.2795332/-70.5933856) |
| Marmot Basin | 1.5 km | 2034 m | [Show Off Cat Track](https://openskimap.org/#15/52.7991823/-118.1056701) |
| Megève | 4.0 km | 1692 m | [Chaillettes](https://openskimap.org/#15/45.8470567/6.6673843) |
| Mt Buller | 1.0 km | 1707 m | [Rossignol Racecourse](https://openskimap.org/#15/-37.1477863/146.4387072) |
| Coronet Peak | 0.4 km | 1379 m | [Duncan's Dance](https://openskimap.org/#15/-44.9225906/168.736897) |
| The Remarkables | 0.7 km | 1728 m | [Huka](https://openskimap.org/#15/-45.0568316/168.8211147) |
