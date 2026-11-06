// Official access/lodging sources reviewed 2026-11-06. These are planning
// guides, not live schedules. Airport verification is explicit: false means a
// geographic flight-search starting point, not an airport named by the resort.
const entries = {};
const vailAccess = domain => `https://www.${domain}/explore-the-resort/about-the-resort/getting-here.aspx`;
const areaLodging = domain => `https://www.${domain}/explore-the-resort/during-your-stay/lodging.aspx`;
const resortLodging = (domain, slug) => `https://www.${domain}/plan-your-trip/stay/${slug}`;
const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function add(name, airport, accessUrl, stayUrl, place, areas, note, airportVerified = false, service = null, localTransport = null) {
  entries[name] = {
    reviewedAt:'2026-11-06', airport, airportVerified, accessUrl, stayUrl, note,
    transfers: service ? [{ name:service[0], url:service[1], sourceUrl:service[2] || accessUrl,
      kind:service[3] || 'Airport transfer · reservation required', duration:null,
      season:'Confirm operating dates, both directions and availability with the operator.',
      pickup:service[4] || `${airport}: confirm the terminal and meeting point when reserving.`,
      dropoff:service[5] || `${place}: confirm your exact hotel or stop before booking.`,
      baggage:'Confirm ski-bag space, dimensions and extra-luggage charges directly.',
      timing:'Allow airport processing time and winter delays. A listed service does not guarantee a connection to your flight.' }] : [],
    localTransport: localTransport ? {name:localTransport[0],url:localTransport[1],note:localTransport[2]} : null,
    areas:areas.map(([label, access, transfer]) => ({id:slug(label),name:label,query:`${label}, ${place}`,access,
      transfer:transfer || 'Check the final journey from your arrival stop to this address, and transport to your chosen lifts.'}))
  };
}
const eme = ['Epic Mountain Express','https://www.epicmountainexpress.com/schedules/'];

// Colorado and Utah
add('Vail','EGE',vailAccess('vail.com'),'https://www.vail.com/plan-your-trip/stay/vail-lodging','Vail, Colorado, USA',[
  ['Vail Village','Choose the main village for its lift portals and town services.'],['Lionshead','A separate pedestrian base near the Eagle Bahn Gondola.']
],'Eagle County and Denver are listed access airports. Reserve ground transport; I-70 winter conditions can change the journey.',true,eme);
add('Beaver Creek','EGE','https://www.beavercreek.com/explore-the-resort/planning-your-stay/for-first-timers.aspx','https://www.beavercreek.com/plan-your-trip/stay/beaver-creek-lodging.aspx','Beaver Creek and Avon, Colorado, USA',[
  ['Beaver Creek Village','A mountain village base; check each property’s lift access.'],['Avon','A valley base; allow an onward bus, hotel shuttle or drive up to the resort.']
],'The resort lists Eagle County Airport and Epic Mountain Express. Avon and the mountain village are different drop-off locations.',true,eme);
add('Breckenridge','DEN',vailAccess('breckenridge.com'),'https://gobreck.com/plan/breckenridge-vacation-faqs/','Breckenridge, Colorado, USA',[
  ['Downtown Breckenridge','Town services and the BreckConnect Gondola connection; check the property’s location.'],['Peak 8 base','A mountain base rather than downtown; confirm your lift and shuttle access.']
],'Use a reserved airport transfer or a winter-equipped car from Denver. Town buses and the gondola are separate from the airport journey.',true,['Summit Express','https://www.summitexpress.com/scheduled-shuttle-service/breckenridge-airport-shuttle/','https://www.summitexpress.com/scheduled-shuttle-service/breckenridge-airport-shuttle/']);
add('Keystone','DEN',vailAccess('keystoneresort.com'),resortLodging('keystoneresort.com','keystone-lodging.aspx'),'Keystone, Colorado, USA',[
  ['River Run','A village base for River Run Gondola and services.'],['Mountain House','A separate base served by the Peru lift; check the shuttle to River Run.']
],'Denver is the main flight gateway. Match the airport drop-off to River Run, Mountain House or your exact lodging address.',true,eme);
add('Crested Butte','GUC','https://www.skicb.com/explore-the-resort/during-your-stay/first-timers-guide.aspx','https://www.skicb.com/Plan-Your-Trip/Stay/Lodging%20Results.aspx','Crested Butte, Colorado, USA',[
  ['Mount Crested Butte','Mountain-base lodging; confirm the walk to the lifts.'],['Crested Butte town','A town base below the ski area; check the local bus connection.']
],'Gunnison–Crested Butte Airport is the resort’s listed regional gateway. Ask Crested Butte Vacations to confirm a reserved airport transfer.',true,null,['Mountain Express / valley transit','https://www.skicb.com/the-mountain/about-the-mountain/epicpromise-at-cbmr.aspx','The town/mountain bus and Gunnison Valley RTA are local or valley legs; check their stops and current timetables separately.']);
add('Park City','SLC',vailAccess('parkcitymountain.com'),'https://www.parkcitymountain.com/explore-the-resort/about-the-resort/park-city-basecamp.aspx','Park City, Utah, USA',[
  ['Mountain Village','The Park City Mountain base; confirm the property’s lift or bus connection.'],['Canyons Village','A separate arrival portal; use this address when booking transport.'],['Old Town','Town dining and lodging; check access to Town Lift and local buses.']
],'Salt Lake City airport is listed by the resort. Reserve airport transport to your actual base; local buses are a separate part of the trip.',true);
add('Telluride','MTJ','https://townofmountainvillage.com/explore/plan-your-trip/getting-here/','https://tellurideskiresort.com/stay/','Telluride, Colorado, USA',[
  ['Telluride town','A town base; check gondola hours for access to Mountain Village.'],['Mountain Village','Mountain-side lodging; confirm the walk or shuttle to your lift.']
],'Compare regional flights and a prearranged road transfer. Confirm the winter journey and hotel drop-off before choosing an arrival time.',true,['TelluRides','https://tellurides.com/airport-transportation','https://tellurides.com/airport-transportation']);
add('Aspen Snowmass','ASE','https://www.aspensnowmass.com/visit/getting-here','https://www.aspensnowmass.com/visit/lodging','Aspen and Snowmass Village, Colorado, USA',[
  ['Aspen','A town base for Aspen Mountain; the other ski areas require onward travel.'],['Snowmass Village','Lodging at Snowmass rather than Aspen town; check hotel shuttle arrangements.']
],'Aspen/Pitkin Airport is the local flight gateway. Some properties provide airport pickup; confirm eligibility, hours and ski luggage with the property.',true);
add('Steamboat','HDN','https://www.steamboat.com/explore/first-timers','https://www.steamboat.com/plan-your-trip/lodging/steamboat-grand','Steamboat Springs, Colorado, USA',[
  ['Steamboat ski base','Stay near the ski-area base; confirm the property’s lift access.'],['Downtown Steamboat Springs','A town base; plan the onward journey to the ski area.']
],'Yampa Valley Regional Airport at Hayden is the listed gateway. Airport transfers can fill up; reserve before committing to a tight connection.',true);
add('Winter Park','DEN','https://www.winterparkresort.com/plan-your-trip/getting-here.aspx','https://www.winterparkresort.com/plan-your-trip/hotel-lodging','Winter Park, Colorado, USA',[
  ['Winter Park Resort Village','A mountain-base stay near the resort portals.'],['Winter Park town / Fraser','A separate town stay; check The Lift bus route and operating hours.']
],'The resort lists Home James airport transport from Denver. Rail and town buses are separate options with their own seasonal timetables.',true,['Home James Transportation','https://www.winterparkresort.com/plan-your-trip/getting-here.aspx']);
add('Copper Mountain','DEN','https://www.coppercolorado.com/the-mountain/getting-to-around-copper/how-to-get-here/','https://www.coppercolorado.com/lodging-amenities/lodging-overview/','Copper Mountain, Colorado, USA',[
  ['Center Village','A central resort base; check the exact building and lift connection.'],['West Village','Useful for the Schoolhouse and beginner-area lifts.'],['East Village','A separate base; match transport and lodging to this village.']
],'Denver is a listed flight gateway. Check road conditions and arrange your airport-to-village journey; village circulation is not an airport shuttle.',true);
add('Eldora','DEN','https://www.rtd-denver.com/routes-services/other-services/ski-n-ride','https://www.eldora.com/activities-amenities/lodging-partners/','Nederland and Boulder, Colorado, USA',[
  ['Boulder','The resort lists Boulder lodging partners; allow a separate mountain journey.'],['Nederland','A nearby town base; verify the final road or bus leg and lodging availability.']
],'Arrange transport to Eldora’s base before booking flights. A Denver flight search is a regional starting point; no direct airport transfer has been verified here.',false,null,['RTD Ski-n-Ride','https://www.rtd-denver.com/routes-services/other-services/ski-n-ride','Seasonal NB-family services connect Boulder/Nederland with Eldora when the ski area is open. Arrange airport-to-Boulder travel separately.']);
add('Arapahoe Basin','DEN','https://www.arapahoebasin.com/parking/','https://www.arapahoebasin.com/lodging/','Summit County, Colorado, USA',[
  ['Keystone','A nearby lodging base; staying by Keystone’s lifts does not put you at A-Basin.'],['Frisco','A town base with lodging partners; confirm the onward ski-area journey.']
],'A-Basin has no on-site lodging. Arrange the final trip from your lodging to the ski area and check pass/road conditions rather than assuming an airport shuttle.',true);
add('Big Sky','BZN','https://www.bigskyresort.com/getting-here','https://www.bigskyresort.com/lodging','Big Sky, Montana, USA',[
  ['Mountain Village','A mountain base; verify the walk or shuttle to your lift.'],['Big Sky Town Center','A different base below the resort; check the local bus route.']
],'Bozeman is the listed flight gateway. Reserve ground transport; the resort cautions against relying on rideshare and notes some lodging needs a car.',true);
add('Jackson Hole','JAC','https://www.jacksonhole.com/by-air','https://www.jacksonhole.com/lodging/resorts','Jackson Hole, Wyoming, USA',[
  ['Teton Village','The mountain-resort base, separate from Jackson town.'],['Jackson town','A town base; check START bus or hotel ski-shuttle access to Teton Village.']
],'Jackson Hole Airport is the listed gateway. Book airport transport to your actual lodging; START’s valley routes are a separate leg.',true,null,['START / valley transport','https://www.jacksonhole.com/getting-around','Check the current town-to-village route and operating hours; do not assume a local bus meets your flight.']);
add('Alta','SLC','https://www.alta.com/getting-here/slc-airport-to-alta','https://www.alta.com/lodging','Alta, Utah, USA',[
  ['Alta lodges','Check meal plans, lift access and the lodge’s airport-transfer arrangements.'],['Sandy / Cottonwood Heights','A valley stay requires a separate trip up Little Cottonwood Canyon.']
],'Alta recommends reserving transport from Salt Lake City airport for mountain lodging. Canyon restrictions and road closures can affect arrival.',true);
add('Snowbird','SLC','https://www.snowbird.com/the-mountain/visitors-guide/getting-here/','https://www.snowbird.com/lodging-amenities/lodging/the-lodge-at-snowbird/','Snowbird, Utah, USA',[
  ['Snowbird resort','Choose a resort lodge and confirm access to your intended lift.'],['Sandy / Cottonwood Heights','A valley stay requires a separate canyon journey.']
],'Check Little Cottonwood Canyon road status before travel. The resort links Alta/Snowbird Shuttle for lodging and airport transportation.',true,['Alta / Snowbird Shuttle','https://www.snowbird.com/the-mountain/visitors-guide/getting-here/']);
add('Deer Valley','SLC','https://www.deervalley.com/plan-your-trip/getting-here','https://www.deervalley.com/plan-your-trip/hotels-lodging','Park City, Utah, USA',[
  ['Snow Park / Lower Deer Valley','Choose a property for this base and confirm its shuttle or walking route.'],['Silver Lake','An upper-mountain base; use the exact hotel address for a transfer.'],['Park City town','Check the onward bus or hotel shuttle to the Deer Valley portal you will use.']
],'Salt Lake City is the listed airport. Deer Valley has several arrival portals: use the lodging address, not just the resort name, for transport.',true);
add('Brighton Resort','SLC','https://www.brightonresort.com/getting-here-and-parking','https://www.brightonresort.com/lodging','Brighton, Utah, USA',[
  ['Brighton base','Confirm lodge availability and its walking access to the lifts.'],['Cottonwood Heights / Midvale','A valley base needs a separate Big Cottonwood Canyon journey.']
],'Plan Big Cottonwood Canyon access, parking and any ski-bus leg separately. A Salt Lake City flight search does not confirm an airport-to-resort connection.');
add('Solitude','SLC','https://www.solitudemountain.com/discover-solitude/getting-here-parking','https://www.solitudemountain.com/plan-your-trip/lodging','Solitude, Utah, USA',[
  ['Solitude Village','Village lodging differs from the Moonbeam day-use entrance.'],['Cottonwood Heights / Midvale','A valley base; confirm ski-bus stops or your winter road journey.']
],'Solitude names Salt Lake City airport. Check Big Cottonwood Canyon restrictions and reserve transport or parking before travel.',true);
add('Snowbasin','SLC','https://www.snowbasin.com/about/getting-here/','https://www.snowbasin.com/lodging/','Ogden Valley, Utah, USA',[
  ['Huntsville / Eden','Valley lodging requires a road or local bus journey to the resort.'],['Ogden','A city base; check the seasonal ski-bus route rather than assuming lift access.']
],'Salt Lake City airport is listed by the resort. Lodging is in surrounding communities; check the seasonal UTA route and its connection from your hotel.',true,null,['UTA ski bus','https://www.snowbasin.com/about/faqs/','Seasonal service starts in the valley. Check current dates, stops and airport-to-valley connections separately.']);

// Tahoe, California and the Pacific Northwest
add('Kirkwood','RNO',vailAccess('kirkwood.com'),'https://www.kirkwood.com/plan-your-trip/stay/kirkwood-lodging.aspx','Kirkwood, California, USA',[
  ['Kirkwood village','Choose on-mountain lodging to reduce the daily highway journey.'],['South Lake Tahoe','A separate town base with a substantial mountain-road trip to Kirkwood.']
],'The resort lists Reno airport and rental cars. Check Highway 88 conditions and parking requirements; no scheduled direct airport coach is verified here.',true);
add('Northstar','RNO','https://www.northstarcalifornia.com/explore-the-resort/about-the-resort/getting-here/.aspx','https://www.northstarcalifornia.com/plan-your-trip/stay/northstar-lodging','Truckee and Northstar, California, USA',[
  ['Northstar village','Confirm walking or resort-shuttle access from your exact building.'],['Truckee','A town base; check TART or your hotel’s connection to Northstar.']
],'The resort lists scheduled Reno-to-North-Lake-Tahoe transport. Confirm the actual drop-off and local connection to Northstar before booking.',true);
add('Mammoth Mountain','BIH','https://www.mammothmountain.com/discover-mammoth/getting-around/air-travel','https://www.mammothmountain.com/plan-your-trip/mammoth-hotels','Mammoth Lakes, California, USA',[
  ['The Village at Mammoth','Check the gondola or bus link to your chosen ski-area base.'],['Main Lodge','A mountain-base stay; confirm the hotel address and winter access.'],['Juniper Springs / Eagle','A different lift portal; check seasonal lift and shuttle operations.']
],'The resort distinguishes commercial Bishop flights from Mammoth Yosemite flights. Match the airport code and reserved transfer to the flight you actually book.',true);
add('June Mountain','MMH','https://www.junemountain.com/plan-your-trip/getting-here','https://www.junemountain.com/plan-your-trip/lodging','June Lake, California, USA',[
  ['June Lake','A town base; arrange the final road journey to June Mountain.']
],'June Mountain lists Mammoth Yosemite flights. Check limited flight schedules, airport pickup and the separate drive to June Lake.',true);
add('Big Bear Mountain','LAX','https://www.bigbearmountainresort.com/transportation','https://www.bigbearmountainresort.com/lodging','Big Bear Lake, California, USA',[
  ['Big Bear Lake','Choose lodging for Snow Summit or Bear Mountain, then check the local bus.'],['Running Springs / Snow Valley','A different ski area and lodging base; do not assume a Big Bear Lake hotel is beside Snow Valley.']
],'This destination includes separate mountains. The resort describes rail-plus-Mountain Transit connections from Los Angeles; plan all legs and the correct mountain.',true,null,['Mountain Transit / resort shuttles','https://www.bigbearmountainresort.com/transportation/shuttles','Local buses and between-mountain shuttles are not a nonstop airport transfer. Verify each connection.']);
add('Palisades Tahoe','RNO','https://www.palisadestahoe.com/plan-your-visit/travel-here','https://www.palisadestahoe.com/plan-your-visit/lodging','Olympic Valley and Truckee, California, USA',[
  ['Olympic Valley / Palisades village','A base at the Palisades side; confirm your building’s lift access.'],['Truckee / Tahoe City','Town lodging requires a separate road or transit connection.']
],'Palisades recommends North Lake Tahoe Express for airport transport. Confirm the drop-off and which mountain portal you intend to use.',true,['North Lake Tahoe Express','https://www.palisadestahoe.com/plan-your-visit/lodging']);
add('Sugar Bowl','RNO','https://www.sugarbowl.com/directions','https://www.sugarbowl.com/hotel','Donner Summit, California, USA',[
  ['Sugar Bowl village','Confirm arrival and baggage handling with the lodge; village access differs from day parking.'],['Truckee / Donner Lake','Off-mountain lodging requires a separate road or local transit journey.']
],'Check Donner Summit road conditions and the correct village or Judah arrival point. No direct airport shuttle has been verified in this guide.');
add('Stevens Pass','SEA','https://www.stevenspass.com/explore-the-resort/about-the-resort/getting-here-and-parking.aspx','https://www.stevenspass.com/explore-the-resort/during-your-stay/explore-lodging.aspx','Stevens Pass, Washington, USA',[
  ['Skykomish / Sky Valley','Lodging west of the pass; check the Highway 2 journey to the ski area.'],['Leavenworth','An east-side town base; the mountain journey is separate from your airport trip.']
],'Lodging is on either side of Stevens Pass. Check Highway 2 restrictions and parking reservations; a Seattle flight search is only a regional starting point.');
add('Crystal Mountain','SEA','https://www.crystalmountainresort.com/plan-your-trip/parking-and-shuttle-information','https://www.crystalmountainresort.com/plan-your-trip/lodging','Crystal Mountain and Enumclaw, Washington, USA',[
  ['Crystal Mountain base','Check each property’s availability and walk to the resort.'],['Enumclaw','A town base; confirm the reserved Crystal Express connection or a winter drive.']
],'Crystal Express starts at Enumclaw Expo Center, not Seattle airport. Arrange the airport-to-Enumclaw leg separately.',false,null,['Crystal Express','https://www.crystalmountainresort.com/plan-your-trip/parking-and-shuttle-information','The local shuttle requires a reservation. Confirm operating dates and the Expo Center pickup.']);
add('The Summit at Snoqualmie','SEA','https://www.summitatsnoqualmie.com/directions','https://www.summitatsnoqualmie.com/','Snoqualmie Pass, Washington, USA',[
  ['Snoqualmie Pass','Choose a property for the Summit or Alpental base you intend to use.'],['North Bend','A town base west of the pass; allow a separate I-90 journey.']
],'The Summit has multiple arrival areas. Check I-90 pass conditions and the exact ski base; no direct airport transfer is verified here.');
add('Schweitzer','GEG','https://www.schweitzer.com/discover-schweitzer/directions','https://www.schweitzer.com/plan-your-trip/hotels-lodging','Sandpoint, Idaho, USA',[
  ['Schweitzer village','A mountain-base stay; confirm access from your building to the lifts.'],['Sandpoint','A town base; check the final climb to the resort and local shuttle operations.']
],'Schweitzer lists Spokane airport. Arrange airport transport and the final mountain-road leg; do not assume a local ski shuttle meets flights.',true);
add('Sun Valley','SUN','https://www.sunvalley.com/about/getting-here/','https://www.sunvalley.com/plan-your-trip/','Sun Valley and Ketchum, Idaho, USA',[
  ['Sun Valley village','Resort lodging is not at every Bald Mountain lift portal; check local transport.'],['Ketchum','A town base; match lodging to River Run, Warm Springs or the local bus.']
],'Friedman Memorial Airport is the listed local gateway. The resort describes airport shuttles; confirm availability for your lodging and flight.',true);
add('Grand Targhee','JAC','https://www.grandtarghee.com/plan-your-trip/planning-tools/airport-shuttle','https://www.grandtarghee.com/plan-your-trip/lodging-options/lodging-policies-amenities','Alta, Wyoming and Teton Valley, Idaho, USA',[
  ['Grand Targhee base','Stay at the mountain and confirm check-in and baggage arrival.'],['Driggs / Teton Valley','A valley base; check the local town shuttle or road journey.']
],'Grand Targhee lists private transfers from Jackson Hole and Idaho Falls. Confirm the winter route and reservation before booking a tight flight connection.',true,['Grand Targhee private airport shuttle','https://www.grandtarghee.com/plan-your-trip/planning-tools/airport-shuttle/airport-shuttle']);

// Northeast, Mid-Atlantic and Midwest day-trip resorts
add('Stowe','BTV',vailAccess('stowe.com'),resortLodging('stowe.com','stowe-lodging.aspx'),'Stowe, Vermont, USA',[
  ['Spruce Peak','A mountain-base stay; check access to your chosen portal.'],['Stowe village / Mountain Road','A town or roadside stay; verify the seasonal local bus or hotel shuttle.']
],'The access page describes airport taxis and car rentals. Confirm private pickup or your lodge’s arrangements; local ski buses are not airport transfers.');
add('Okemo','RUT',vailAccess('okemo.com'),'https://www.okemo.com/Plan-Your-Trip/Stay/Lodging%20Results.aspx','Ludlow, Vermont, USA',[
  ['Jackson Gore','A separate resort base; use the exact lodging address for arrival.'],['Ludlow / Clock Tower base','Check the property’s walk, shuttle or drive to the correct base.']
],'Okemo lists Rutland Regional Airport as a gateway. Limited regional flights and onward transport need to be checked together.',true);
add('Mount Sunapee','BOS',vailAccess('mountsunapee.com'),'https://www.mountsunapee.com/lodging/find-lodging/hotels-and-motels.aspx','Newbury and Sunapee, New Hampshire, USA',[
  ['Newbury / Mount Sunapee','Nearby hotels still require an address-specific check for slope access.'],['Sunapee','A lakeside town base; plan the road journey to the ski area.']
],'The resort gives driving directions from Boston Logan. Arrange a car or confirmed private transfer; no scheduled direct airport coach is verified here.',true);
add('Afton Alps','MSP',vailAccess('aftonalps.com'),areaLodging('aftonalps.com'),'St Croix Valley, Minnesota, USA',[
  ['Afton / St Croix Valley','Nearby lodging is separate from the ski-area base.'],['Woodbury / Stillwater','The resort lists regional lodging partners; check the final road journey.']
],'Afton lists Minneapolis airport and recommends a rental car or rideshare. Confirm your return pickup rather than relying on a car being available at closing.',true);
add('Mt. Brighton','DTW',vailAccess('mtbrighton.com'),areaLodging('mtbrighton.com'),'Brighton, Michigan, USA',[
  ['Brighton','The resort lists nearby hotels rather than lift-side accommodation.']
],'Use the resort’s road/parking instructions. Detroit is a geographic flight-search starting point; arrange both directions of ground travel.');
add('Wilmot Mountain','MKE',vailAccess('wilmotmountain.com'),areaLodging('wilmotmountain.com'),'Wilmot and Kenosha County, Wisconsin, USA',[
  ['Wilmot / Kenosha County','Check the listed hotel’s distance from the ski base; local lodging is off the slopes.']
],'This is a road-access ski hill. Confirm transport to ski school versus tubing; no scheduled airport-to-hill service is verified here.');
add('Attitash','MHT',vailAccess('attitash.com'),areaLodging('attitash.com'),'Bartlett and North Conway, New Hampshire, USA',[
  ['Bartlett / Attitash base','Check whether your lodging serves Attitash or Bear Peak.'],['North Conway','A town base; arrange the drive or confirmed hotel transfer to the ski area.']
],'Manchester is one of the airports listed by the resort. Attitash and Bear Peak have distinct base addresses; use the one matching your stay.',true);
add('Wildcat Mountain','MHT',vailAccess('skiwildcat.com'),areaLodging('skiwildcat.com'),'Pinkham Notch and Gorham, New Hampshire, USA',[
  ['Pinkham Notch / Glen House','A nearby lodging option; verify the final journey to Wildcat.'],['Gorham / Mount Washington Valley','A town base requires a separate drive to the mountain.']
],'The official access guide lists Manchester and Portland airports. Reserve road transport and allow for White Mountain winter conditions.',true);
add('Crotched Mountain','MHT',vailAccess('crotchedmtn.com'),areaLodging('crotchedmtn.com'),'Bennington and Francestown, New Hampshire, USA',[
  ['Bennington / Francestown','Use the official local lodging list and check your hotel-to-hill journey.']
],'Follow the resort’s Route 47 approach and base-lodge parking instructions. No direct airport shuttle is verified; confirm a return ride after night skiing.');
add('Hunter Mountain','ALB',vailAccess('huntermtn.com'),'https://www.huntermtn.com/Plan-Your-Trip/stay/Lodging%20Results.aspx','Hunter, New York, USA',[
  ['Hunter / Liftside Village','Check the property’s walking access to the mountain base.'],['Tannersville','A nearby town stay requires a separate road journey.']
],'The resort lists bus services from New York City, not a guaranteed airport pickup. If using a city bus, arrange the airport-to-terminal leg separately.',false,null,['NYC bus options','https://www.huntermtn.com/Explore%20the%20Resort/About%20the%20Resort/Getting%20Here.aspx','Confirm the current operator, terminal, travel date and return departure; city departures are not airport transfers.']);
add('Mount Snow','ALB',vailAccess('mountsnow.com'),'https://www.mountsnow.com/Plan-Your-Trip/stay/Lodging%20Results.aspx','West Dover, Vermont, USA',[
  ['Main Base / Grand Summit','Confirm the property’s lift or shuttle access.'],['West Dover / Carinthia','Match lodging to the Main Base or Carinthia area and check local bus stops.']
],'The resort warns that GPS can send drivers onto unsuitable back roads. Follow its highway approach and check winter road conditions.',false,null,['MOOver local transit',vailAccess('mountsnow.com'),'MOOver is a local connection; check current stops and hours and arrange airport travel separately.']);
add('Jack Frost / Big Boulder','AVP',vailAccess('jfbb.com'),areaLodging('jfbb.com'),'Lake Harmony, Pennsylvania, USA',[
  ['Lake Harmony / Split Rock','A base between the two ski areas; neither mountain is automatically within walking distance.']
],'Jack Frost and Big Boulder are separate ski areas. Choose the correct arrival address and arrange your own journey between them.');
add('Roundtop Mountain','MDT',vailAccess('skiroundtop.com'),areaLodging('skiroundtop.com'),'Lewisberry and Mechanicsburg, Pennsylvania, USA',[
  ['Lewisberry / Mechanicsburg','Regional hotels require a separate road journey to Roundtop.']
],'The official guide describes driving and Harrisburg rail access. Harrisburg airport is a geographic search option; confirm a car or private transfer.');
add('Liberty Mountain','BWI',vailAccess('libertymountainresort.com'),resortLodging('libertymountainresort.com','liberty-mountain-lodging.aspx'),'Carroll Valley, Pennsylvania, USA',[
  ['Liberty Mountain resort','Check the Fairway Hotel or other resort lodging against the ski-base address.'],['Gettysburg / Fairfield','A town base requires a separate road journey.']
],'Follow the official driving guide to Carroll Valley. No scheduled airport transfer is verified; book road transport and confirm late return arrangements.');
add('Whitetail Resort','BWI',vailAccess('skiwhitetail.com'),areaLodging('skiwhitetail.com'),'Mercersburg, Pennsylvania, USA',[
  ['Mercersburg / nearby towns','Whitetail says it has no on-site lodging; verify the hotel-to-resort drive.']
],'Whitetail is a road-access ski hill with off-site lodging. An airport search does not confirm a direct transfer or lift-side hotel.');
add('Seven Springs','PIT',vailAccess('7springs.com'),resortLodging('7springs.com','seven-springs-lodging.aspx'),'Seven Springs, Pennsylvania, USA',[
  ['Seven Springs resort','Check hotel check-in versus the day-skier entrance.'],['Somerset','A town base requires a separate road journey to the resort.']
],'Follow the resort’s main-entrance and hotel check-in directions. Arrange a rental car or confirmed private transfer; no direct airport coach is verified here.');
add('Hidden Valley','PIT',vailAccess('hiddenvalleyresort.com'),resortLodging('7springs.com','seven-springs-lodging.aspx'),'Hidden Valley and Somerset, Pennsylvania, USA',[
  ['Hidden Valley','Check address-specific vacation rentals and road access to this mountain.'],['Somerset / Seven Springs','Regional lodging is not at Hidden Valley’s lifts; allow a separate drive.']
],'The Pennsylvania resort lists Pittsburgh airport. Hidden Valley and Seven Springs are separate mountains; book transport to the correct one.',true);
add('Laurel Mountain','PIT',vailAccess('laurelmountainski.com'),resortLodging('7springs.com','seven-springs-lodging.aspx'),'Laurel Highlands, Pennsylvania, USA',[
  ['Ligonier / Laurel Highlands','A regional lodging base; confirm the mountain-road journey.'],['Seven Springs area','Official regional resort lodging requires a separate drive to Laurel Mountain.']
],'Use the Route 30 and Laurel Summit Road approach in the official guide. The linked regional lodging is not at Laurel Mountain’s ski base.');
add('Killington','RUT','https://killington.com/transportation-parking-and-shuttles','https://www.killington.com/plan-your-trip/lodging','Killington, Vermont, USA',[
  ['Killington base areas','Check which lodge and ski portal your property serves.'],['Killington Road / Rutland','Allow a separate road or confirmed local bus journey to the resort.']
],'Killington lists Rutland Regional Airport and warns that airport rentals or shuttles need advance arrangements; do not assume walk-up pickup.',true);
add('Sugarbush','BTV','https://www.sugarbush.com/guest-services/directions','https://www.sugarbush.com/plan-your-trip/lodging','Warren and Waitsfield, Vermont, USA',[
  ['Lincoln Peak','Check Clay Brook or other properties against the Lincoln Peak base.'],['Warren / Waitsfield','A Mad River Valley stay requires a separate trip to the mountain.']
],'Choose lodging and transport for Lincoln Peak or Mt Ellen. Do not assume a regional flight includes an airport transfer or a between-mountain connection.');
add('Stratton','ALB','https://www.stratton.com/plan-your-trip/getting-here','https://www.stratton.com/plan-your-trip/hotels-lodging','Stratton Mountain, Vermont, USA',[
  ['Stratton village','Check your property’s lift or village-shuttle access.'],['Manchester','A town base; verify the local MOOver connection or drive.']
],'Use the resort’s travel and parking guide, and confirm your airport-to-lodging journey. Local buses are not a nonstop airport transfer.');
add('Loon Mountain','BOS','https://www.loonmtn.com/visitors-guide/getting-here','https://www.loonmtn.com/lodging','Lincoln, New Hampshire, USA',[
  ['Loon base / Mountain Club','The resort lists the Mountain Club as a slopeside lodging option.'],['Lincoln','Town lodging needs a checked shuttle stop or separate drive.']
],'Loon’s guide describes road access and local lodging shuttles. Reserve airport ground travel separately; do not assume those shuttles serve Logan.');
add('Sugarloaf','PWM','https://www.sugarloaf.com/experience/directions','https://www.sugarloaf.com/lodging/guest-guide','Carrabassett Valley, Maine, USA',[
  ['Sugarloaf base village','Check the hotel or condo’s walk or local shuttle to the lifts.'],['Kingfield / Carrabassett Valley','Off-mountain properties require a separate road journey.']
],'Check the official air-travel and driving options and arrange the final rural road journey. Regional airport facilities do not imply scheduled international flights.');
add('Sunday River','PWM','https://www.sundayriver.com/the-mountain/parking-and-shuttles','https://www.sundayriver.com/trip-resources/area-lodging','Newry and Bethel, Maine, USA',[
  ['Sunday River slopeside','Check which of the resort’s base areas your lodging serves.'],['Bethel','A town base; arrange the onward mountain trip and confirm shuttle dates.']
],'Plan a reserved road journey to the correct Sunday River base. A Portland airport search is a regional starting point, not a verified direct transfer.');
add('Boyne Highlands','TVC','https://www.highlandsharborsprings.com/getting-here','https://www.highlandsharborsprings.com/lodging/lodging-faq','Harbor Springs, Michigan, USA',[
  ['The Highlands resort','Check your room or condo’s lift access and guest-shuttle eligibility.'],['Harbor Springs / Petoskey','Off-property lodging requires a separate road journey.']
],'The Highlands lists Traverse City flights. Its complimentary guest shuttle serves on-property destinations, not an automatic airport pickup.',true);
add('Boyne Mountain','TVC','https://www.boynemountain.com/getting-here','https://www.boynemountain.com/guest-directory-mountain-grand-lodge','Boyne Falls, Michigan, USA',[
  ['Boyne Mountain resort','Check your building’s ski access and guest-shuttle hours.'],['Boyne City / Boyne Falls','A town stay is separate from the resort’s on-property transport.']
],'The resort lists Traverse City and Pellston commercial gateways. Its on-property shuttle does not establish an airport connection.',true);
add('Taos','ABQ','https://www.skitaos.com/getting-here','https://www.skitaos.com/deals','Taos Ski Valley, New Mexico, USA',[
  ['Taos Ski Valley / The Blake','A mountain-base stay; ask the property about any eligible shuttle.'],['Taos town','A separate town base; confirm the road journey to the ski valley.']
],'Compare the resort’s limited regional flight options with a longer Albuquerque road journey. Any Blake guest shuttle must be confirmed with the hotel.');
add('Snowshoe','LWB','https://www.snowshoemtn.com/discover-snowshoe/getting-here','https://www.snowshoemtn.com/plan-your-trip/lodging/check-in-information','Snowshoe, West Virginia, USA',[
  ['Snowshoe summit village','Many arrivals are at the summit; check the exact lodging check-in point.'],['Silver Creek / Inn at Snowshoe','Separate lodging zones; verify the local resort shuttle and hours.']
],'The resort lists Greenbrier Valley Airport and local transport providers. Confirm a booked airport pickup and your actual lodge check-in location.',true);
add('Windham Mountain','ALB','https://www.windhammountainclub.com/getting-here/','https://www.windhammountainclub.com/arealodging/','Windham, New York, USA',[
  ['Windham','Choose an official area-lodging partner and check the final ski-area journey.']
],'Use the official Route 23 approach and ski-area address. Confirm guest access and road transport before booking a trip; no airport shuttle is verified here.');
add('Whiteface','SLK','https://whiteface.com/plan-your-visit/directions/','https://whiteface.com/plan-your-visit/lodging/','Wilmington and Lake Placid, New York, USA',[
  ['Wilmington','A town base near Whiteface; check the final road or local transit journey.'],['Lake Placid','A separate lodging centre; confirm your ski-area transport and return time.']
],'Use the official transport guide to compare regional arrivals. Confirm limited regional flight schedules and the onward trip to Wilmington or Lake Placid.');

// Canada
add('Tremblant','YUL','https://www.tremblant.ca/plan/getting-here','https://www.tremblant.ca/plan/hotels-condos','Mont-Tremblant, Quebec, Canada',[
  ['Tremblant pedestrian village','A resort base; confirm the exact hotel and lift access.'],['Mont-Tremblant / Saint-Jovite','A separate town base; check the onward local journey.']
],'Tremblant lists a direct Montreal–Trudeau airport shuttle and private transport. Confirm date-specific service and the actual hotel stop.',true,['Tremblant airport shuttle','https://www.tremblant.ca/plan/getting-here/ground-transportation-montreal-airport/shuttle-montreal-trudeau-international-airport-mont-tremblant']);
add('Blue Mountain (Ontario)','YYZ','https://www.bluemountain.ca/discover-blue/getting-here','https://www.bluemountain.ca/plan-your-trip/lodging/accommodation-partners','Blue Mountains, Ontario, Canada',[
  ['Blue Mountain village','Check your building’s lift and village access.'],['Collingwood','A separate town base; arrange the onward ski-area journey.']
],'The official page lists Toronto Pearson transport, but describes the FlixBus offer as summer travel. Do not assume it operates for a winter trip.',true);
add('SkiBig3 (Banff)','YYC','https://www.skibig3.com/explore/getting-here/','https://www.skibig3.com/stay/accommodation/','Banff and Lake Louise, Alberta, Canada',[
  ['Banff','A town base; check the ski bus for the particular SkiBig3 mountain.'],['Lake Louise village','A separate base, convenient for a Lake Louise-focused stay.'],['Canmore','Check which ski buses or private transfers actually serve your hotel.']
],'Calgary airport transfers take you to Banff/Lake Louise lodging. The onward ski-area buses are separate legs; confirm coverage for the mountain you choose.',true);
add('Revelstoke','YLW','https://www.revelstokemountainresort.com/discover/getting-here/getting-to-revelstoke/','https://www.revelstokemountainresort.com/discover/lodging/stay/','Revelstoke, British Columbia, Canada',[
  ['Revelstoke Mountain Resort base','Check Sutton Place or other property-specific mountain access.'],['Revelstoke town','A town base requires the local resort shuttle or a separate drive.']
],'The resort names Kelowna airport and Revelstoke Transfers. Confirm the actual pickup, hotel stop and winter schedule.',true,['Revelstoke Transfers','https://www.revelstokemountainresort.com/discover/getting-here/getting-to-revelstoke/']);
add('Cypress Mountain','YVR','https://www.cypressmountain.com/getting-here','https://www.destinationvancouver.com/vancouver-hotels','Vancouver, British Columbia, Canada',[
  ['West Vancouver / North Shore','A city-side stay; arrange the mountain journey and check shuttle pickup.'],['Downtown Vancouver','A city base, not on-mountain lodging. Confirm the connection to any mountain bus.']
],'Cypress names Vancouver airport. Airport transit and a city-to-mountain shuttle are separate journeys; confirm winter tires if driving.',true);
add('Red Mountain','GEG','https://www.redresort.com/getting-here/','https://www.redresort.com/lodging/','Rossland, British Columbia, Canada',[
  ['RED Mountain base','Choose a base-area property and check the final walk with luggage.'],['Rossland','A town base; confirm the local ski-area shuttle or road connection.']
],'The resort lists a Spokane airport shuttle. This route crosses the US–Canada border: confirm documents, timing and the exact lodging drop-off.',true,['Spokane airport shuttle listed by RED','https://www.redresort.com/getting-here/']);
add('Sun Peaks','YKA','https://www.sunpeaksresort.com/explore/getting-here-around/airport-shuttles-transfers','https://www.sunpeaksresort.com/places-to-stay','Sun Peaks, British Columbia, Canada',[
  ['Sun Peaks village','A pedestrian village base; check the property’s lift and luggage access.'],['Ski-in / ski-out condos','Confirm the exact trail access and the bus or road alternative when it is closed.']
],'Sun Peaks identifies Kamloops as its primary airport. Reserve a service for your flight and exact accommodation.',true,['Peak Shuttles','https://www.sunpeaksresort.com/explore/business-directory/peak-shuttles']);
add('Panorama','YXC','https://www.panoramaresort.com/public/planning/getting-here','https://www.panoramaresort.com/planning/lodging-at-panorama','Panorama and Invermere, British Columbia, Canada',[
  ['Panorama village','Mountain-side lodging; confirm the arrival/check-in point.'],['Invermere','A valley town base; arrange the separate mountain journey.']
],'Compare regional airport access with the current transfer options on Panorama’s planning page. Book road transport and check winter route conditions.');
add('Banff Sunshine','YYC','https://www.skibanff.com/index.php/plan-stay/getting-here/getting-here','https://www.skibig3.com/stay/accommodation/','Banff, Alberta, Canada',[
  ['Banff town','Check the winter town-to-Sunshine bus stop near your hotel.'],['Sunshine Mountain Lodge','An on-mountain stay needs confirmed gondola and baggage-transfer arrangements.']
],'Take a confirmed Calgary-to-Banff transfer, then the separate Sunshine ski bus or road/gondola journey. Airport transport does not take you directly to the mountain lodge.',true,null,['Sunshine town shuttle','https://www.skibanff.com/plan/first-time-visitors/faqs','Check current winter dates, Banff stops, last return and the final gondola connection.']);
add('Bromont','YUL','https://www.bromontmontagne.com/en/parking-and-shuttle/','https://www.bromontmontagne.com/en/lodging/','Bromont, Quebec, Canada',[
  ['Bromont mountain base','Check the exact hotel or rental’s access to the ski area.'],['Bromont town','A town base; arrange the final road journey to your chosen mountain side.']
],'The listed P4 shuttle connects parking to the mountain, not Montreal airport. Arrange airport travel separately.');
add('Lake Louise','YYC','https://www.skilouise.com/getting-here/by-air/','https://www.skibig3.com/stay/accommodation/','Lake Louise, Alberta, Canada',[
  ['Lake Louise village','A village stay needs a separate ski-area bus or drive.'],['Banff','A different town base; check the longer ski-bus journey and return schedule.']
],'The resort lists Calgary airport and Brewster airport transport. Distinguish airport-to-hotel travel from the bus to the ski area.',true,['Brewster Lake Louise Airport Express','https://www.skilouise.com/getting-here/by-bus/']);
add('Le Massif de Charlevoix','YQB','https://www.lemassif.com/en/the-mountain/winter/getting-here','https://www.lemassif.com/en/accommodations-charlevoix','Petite-Riviere-Saint-Francois, Quebec, Canada',[
  ['Petite-Rivière-Saint-François','Base-of-mountain accommodation; distinguish it from summit arrival.'],['Le Massif summit area','Confirm the lodging address and which mountain entrance to use.']
],'Le Massif lists Quebec City airport. Summit and riverside arrivals are different; arrange transport to the exact property or ski entrance.',true);
add('Marmot Basin','YEG','https://www.skimarmot.com/plan-your-visit/getting-here/','https://www.skimarmot.com/plan-your-visit/where-stay/','Jasper, Alberta, Canada',[
  ['Jasper','A town base; book or confirm the separate Marmot ski shuttle.'],['Hinton','The resort lists lodging here, but this is a different town with a longer onward journey.']
],'Marmot identifies Edmonton as its closest international gateway. Airport-to-Jasper travel and the Jasper-to-mountain ski bus are separate reservations/legs.',true,null,['Jasper–Marmot ski shuttle','https://www.skimarmot.com/plan-your-visit/getting-here/','Check the current SunDog-operated ski shuttle, pickup stop and return time separately from airport transport.']);

// Alps: regional destinations require choosing a specific village before transport.
add('Andermatt-Sedrun','ZRH','https://www.andermatt-sedrun-disentis.ch/en/stories/arrival','https://www.andermatt-sedrun-disentis.ch/andermatt/en/pages/a-z','Andermatt and Sedrun, Switzerland',[
  ['Andermatt','A village base; check access to Gütsch or Gemsstock for the skiing you plan.'],['Sedrun / Disentis','A separate valley base; check train/lift connections and the last return.']
],'The official guide describes rail access via Göschenen or Chur and the Matterhorn Gotthard Railway. Plan train changes; do not assume mountain road passes are open in winter.');
add('Verbier (4 Vallées)','GVA','https://www.verbier.ch/en/practice/move-transport-and-mobility/getting-to-verbier/','https://www.verbier.ch/en/practice/stay-accommodation-and-workation/online-booking/','Verbier and Le Chable, Switzerland',[
  ['Verbier','Mountain-village lodging; check the exact lift and hotel transfer.'],['Le Châble','A valley rail/gondola base; confirm gondola hours before choosing late arrival.']
],'The tourism guide describes Geneva Airport rail connections to Le Châble. The final gondola or taxi leg to Verbier needs its own timing check.',true);
add('Crans-Montana','GVA','https://www.crans-montana.ch/en/access/plane','https://www.crans-montana.ch/Montana/ukv/search?lang=en&reset=1','Crans-Montana, Switzerland',[
  ['Crans / Montana','Check the property’s lift and local-bus connection.'],['Sierre','A valley rail base; allow a funicular/bus or road journey to the resort.']
],'The official guide lists Geneva among several airports. Plan airport rail, the Sierre connection and the final resort leg together.',true);
add('Les 3 Vallées','GVA','https://www.les3vallees.com/en/guide/travel-to-les-3-vallees/by-plane','https://reservation.les3vallees.com/en/holidays-offers/hotels-les-3-vallees','Les Trois Vallees, Savoie, France',[
  ['Courchevel','Select the exact village/altitude before reserving a transfer.'],['Méribel','A separate valley base; check your property’s lift or shuttle access.'],['Val Thorens / Les Menuires','A different valley branch; confirm your actual drop-off village.']
],'This is a group of resorts, not one hotel destination. Choose the village first; airport and Moûtiers connections branch into different valleys.',true);
add('Paradiski','GVA','https://en.la-plagne.com/discover/practical/how-to-get-there/getting-to-la-plagne','https://www.lesarcs.com/en/your-stay/finding-place-stay','Paradiski, Savoie, France',[
  ['Les Arcs / Bourg-Saint-Maurice','Choose the Arc village or valley base and check the final funicular/bus leg.'],['La Plagne','Choose the exact La Plagne village; transfers from Aime differ from Les Arcs.'],['Montchavin / Les Coches','A specific base between the larger resort groups; confirm your drop-off.']
],'Paradiski spans different arrival routes. La Plagne’s guide lists Geneva-to-Aime transport with an onward bus/taxi; do not book that route for a Les Arcs address.',true);
add('Tignes','GVA','https://en.tignes.net/resort-guide/mobility/go-tignes/come-by-plane','https://en.tignes.net/resort-guide/directory/accommodation','Tignes, Savoie, France',[
  ['Tignes Le Lac','Check the property’s lift and village-bus access.'],['Val Claret','A separate high-altitude village; specify it for your transfer.'],['Les Brévières / Tignes 1800','Lower villages require different drop-offs and lift/bus connections.']
],'Tignes lists Geneva and other airports. Coordinate airport travel, any Bourg-Saint-Maurice connection and the bus to your specific village.',true);
add("Val d'Isère",'GVA','https://www.valdisere.com/en/prepare-for-your-stay/how-do-i-get-there/','https://booking.valdisere.com/transport-parking.html',"Val d'Isere, Savoie, France",[
  ["Val d’Isère centre",'A village base; check the property’s walking or shuttle route to your lift.'],['La Daille','A separate arrival portal; use the exact lodging stop.']
],'The tourism office lists winter/weekend airport buses from Geneva and Lyon. Verify the actual operating day and onward connection before choosing a flight.',true,['Altibus airport services','https://www.valdisere.com/en/val-disere/faq/']);
add('Zermatt','ZRH','https://zermatt.swiss/en/plan-book','https://zermatt.swiss/en/plan-book','Zermatt, Switzerland',[
  ['Zermatt village','Check the hotel’s station pickup and the lift portal you intend to use.'],['Täsch / Randa','Valley lodging requires a train/taxi connection to Zermatt and then the lifts.']
],'Zermatt is reached by train, or by parking at Täsch and continuing by shuttle train/taxi. Do not plan to drive a rental car to a village hotel.');
add('St. Moritz (Diavolezza)','ZRH','https://www.rhb.ch/en/information/stations/bernina-diavolezza/','https://www.pontresina.ch/en/guide/shopping/services/service-berghaus-diavolezza','Pontresina and St Moritz, Switzerland',[
  ['Pontresina / St. Moritz','A valley stay; confirm rail or bus access to Diavolezza’s own base.'],['Berghaus Diavolezza','An on-mountain stay requires confirmed cable-car hours and luggage arrangements.']
],'Diavolezza is a separate ski area from St. Moritz’s other mountains. Confirm the rail/bus journey to its base and the final cable car for a mountain stay.');
add('Kitzbühel','INN','https://www.kitzbuehel.com/en/holiday/getting-here/flying/','https://www.kitzbuehel.com/en/summer-accommodation/','Kitzbuhel, Austria',[
  ['Kitzbühel','Choose lodging for your intended lift and station connection.'],['Kirchberg / Jochberg','Separate base villages; specify the correct one in transport reservations.']
],'The tourism office lists Innsbruck, Munich and Salzburg airports. Coordinate rail or private transfers with the specific base village.',true);
add('Lech Zürs am Arlberg','ZRH','https://www.lechzuers.com/en/arriving/airplane','https://www.lechzuers.com/en/booking/accommodations/','Lech Zurs, Austria',[
  ['Lech / Oberlech','Check Oberlech’s final access arrangements and lift/cable-car hours with your property.'],['Zürs','A separate village; confirm the correct transfer drop-off.']
],'The official guide describes Zurich-airport rail access to the Arlberg. Confirm the final bus/taxi from the station and winter road restrictions.',true);
add('Dolomiti Superski','VCE','https://www.dolomitisuperski.com/en/experience-the-dolomites/journey','https://www.dolomitisuperski.com/en/plan-and-book/accommodation','Dolomites, Italy',[
  ['Val Gardena','Pick a specific village and confirm its airport/rail transfer route.'],['Alta Badia / Arabba','Different valleys need different drop-offs; check road pass conditions.'],['Cortina d’Ampezzo','A separate destination; do not assume lodging here serves every Dolomiti Superski area.']
],'Dolomiti Superski spans many valleys. Pick the actual ski area first: Venice is one flight-search option, not the best airport for every valley.');
add('Megève','GVA','https://www.megeve-tourisme.fr/en/informations-pratiques/acces-et-mobilite/en-avion/','https://www.megeve-tourisme.fr/en/organiser-mon-sejour/','Megeve, France',[
  ['Megève centre','Check the walk or local shuttle to your intended ski portal.'],['Demi-Quartier','A different lodging area; verify lift and village connections.']
],'Megève tourism identifies Geneva as a convenient airport. Confirm the reserved transfer or rail-plus-bus connection to the exact property.',true);

// Japan, Australia, New Zealand and Chile
add('Hakuba Valley','NRT','https://www.hakubavalley.com/en/access_en/','https://hakuba-tourism.com/accommodations/','Hakuba, Nagano, Japan',[
  ['Happo','A village base; check the bus terminal, hotel pickup and chosen ski area.'],['Echoland','Confirm local shuttle stops and evening return options.'],['Goryu / other valley bases','Hakuba Valley covers multiple mountains; match lodging to the one you plan to ski.']
],'The valley lists Narita/Haneda rail and road options. City/airport transport and the inter-resort shuttle are separate legs; check each timetable.',true,null,['Hakuba Valley shuttle','https://www.hakubavalley.com/en/access_en/shuttlebus_en/','An inter-resort service, not an airport bus. Confirm current pass/ticket rules and the last return to your base.']);
add('Rusutsu','CTS','https://rusutsu.com/en/access-shuttle-bus-new-chitose-airport/','https://rusutsu.com/en/dynamic-packages/','Rusutsu, Hokkaido, Japan',[
  ['Rusutsu Resort Hotel / North & South Wings','Check the booked wing and bus drop-off.'],['Westin Rusutsu','A separate hotel arrival point; confirm the shuttle stop and mountain access.']
],'The resort lists Bigruns between New Chitose and Rusutsu. Confirm terminal pickup, your hotel stop and date-specific service.',true,['Bigruns airport bus','https://rusutsu.com/en/access-shuttle-bus-new-chitose-airport/']);
add('Lotte Arai','HND','https://app.lottehotel.com/arai-resort/en/facilities/shuttle-bus-service','https://app.lottehotel.com/arai-resort/en/about/faq?p=1','Myoko, Niigata, Japan',[
  ['Lotte Arai Resort','Confirm the Arai or Lodge building and station-shuttle reservation.'],['Joetsu / Myoko','A separate off-property stay; confirm the onward journey and guest-shuttle eligibility.']
],'The resort’s reserved shuttle starts at Joetsumyoko Station’s west entrance, not an airport. Plan the Tokyo-airport and rail legs separately.',false,null,['Lotte Arai station shuttle','https://app.lottehotel.com/arai-resort/en/facilities/shuttle-bus-service','Reservation required. Confirm guest eligibility, the current timetable, ski luggage and the correct west-entrance pickup.']);
add('Perisher','CBR','https://www.perisher.com.au/plan-your-trip/getting-to-perisher','https://www.perisher.com.au/perisher-valley-hotel/about-us/getting-here','Perisher and Jindabyne, New South Wales, Australia',[
  ['Perisher Valley','Confirm hotel access via the car park or Skitube and any baggage transfer.'],['Jindabyne','An off-mountain base; book the final coach, drive or Skitube journey separately.']
],'Plan the Canberra/Snowy Mountains road connection and the final resort access. Perisher Valley Hotel says Skitube tickets must be booked in advance.');
add('Falls Creek','ABX','https://www.fallscreek.com.au/plan-your-trip-winter/getting-here-winter/','https://www.fallscreek.com.au/listing/st-falls-resort-falls-creek/','Falls Creek, Victoria, Australia',[
  ['Falls Creek village','Check whether your property needs the Accommodation Transfer Service for luggage.'],['Mount Beauty','An off-mountain base with a separate alpine-road journey.']
],'Plan airport-to-resort transport separately from the village Accommodation Transfer Service. Confirm operating hours and late-arrival arrangements.',false,null,['Accommodation Transfer Service','https://www.fallscreek.com.au/plan-your-trip-winter/accommodation-transfer-service/','This is the final village/luggage leg, not an airport shuttle. Check hours and the return connection to your coach.']);
add('Hotham','ABX','https://www.mthotham.com.au/resort/access/coaches-transfers/hotham-bus','https://www.mthotham.com.au/summer/accommodation/accommodation/booking-services/dinner-plain-accommodation','Hotham and Dinner Plain, Victoria, Australia',[
  ['Hotham village','An alpine-road arrival; confirm the correct accommodation drop-off and luggage transfer.'],['Dinner Plain','A separate village; check the ski-bus connection to Hotham.']
],'The Hotham page describes Hotham Hopper transfers meeting Sydney flights at Albury. Confirm the current season and the particular flight before booking.',true,['Hotham Hopper','https://www.mthotham.com.au/resort/access/coaches-transfers/hotham-bus']);
add('Thredbo','CBR','https://www.thredbo.com.au/arrival/','https://www.thredbo.com.au/accommodation/','Thredbo, New South Wales, Australia',[
  ['Thredbo village','Check the property’s stairs, parking and access to your lift or lesson meeting point.'],['Jindabyne','An off-mountain stay needs a separate daily road/coach journey.']
],'Use the official arrival guide for road, coach and parking arrangements. A Canberra flight search does not establish a direct airport connection.');
add('Mt Buller','MEL','https://www.mtbuller.com.au/winter/catch-a-bus','https://www.mtbuller.com.au/winter/plan-your-visit/accommodation/chalet-apartments','Mount Buller, Victoria, Australia',[
  ['Mt Buller village','Village accommodation requires property-specific parking and luggage-arrival checks.'],['Mansfield','An off-mountain base; allow a separate alpine-road or coach journey.']
],'Confirm airport-to-mountain transport, resort entry and the final village/luggage transfer. Do not assume a local village shuttle collects from Melbourne airport.');
add('Coronet Peak','ZQN','https://www.coronetpeak.co.nz/getting-here-guide','https://www.queenstownnz.co.nz/accommodation/','Queenstown, New Zealand',[
  ['Queenstown centre','Confirm the Ski Bus pickup point near your lodging.'],['Arthurs Point','Closer to the Coronet approach, but verify bus pickup or your own road access.']
],'Coronet’s Ski Bus is a town-to-mountain service. Arrange airport-to-lodging travel separately and check rental-car terms for alpine roads.',false,null,['Coronet Peak Ski Bus','https://www.coronetpeak.co.nz/getting-here-guide','Reserve a seat and confirm the current pickup and return timetable. This is not an airport transfer.']);
add('The Remarkables','ZQN','https://www.theremarkables.co.nz/getting-here-guide','https://www.queenstownnz.co.nz/accommodation/','Queenstown, New Zealand',[
  ['Queenstown centre','Check the Ski Bus pickup and allow time to collect equipment before departure.'],['Frankton','Confirm the actual mountain-bus pickup rather than assuming an airport connection.']
],'Book the town-to-mountain Ski Bus or check winter road and rental-car restrictions. The airport-to-town leg is separate.',false,null,['The Remarkables Ski Bus','https://www.theremarkables.co.nz/getting-here-guide','Confirm operating dates, seat reservation and the pickup/return stop for your accommodation.']);
add('Valle Nevado','SCL','https://www.vallenevado.com/en/how-to-get-there/','https://www.vallenevado.com/en/hotels/','Valle Nevado, Chile',[
  ['Valle Nevado resort','Choose the exact hotel or apartment and confirm check-in transport.'],['Santiago','A city base requires a separate mountain-road journey for every ski day.']
],'The official guide lists Santiago airport transfers, taxis and rental cars. Check the road’s directional schedule, chain requirements and your actual hotel pickup.',true);

export const EXTENDED_TRAVEL_GUIDES = entries;
