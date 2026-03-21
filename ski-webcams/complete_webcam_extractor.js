const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * COMPLETE SKI RESORT WEBCAM STREAM EXTRACTOR
 * 
 * Automatically extracts webcam stream URLs from all Epic and Ikon Pass resorts
 * 
 * Requirements:
 *   - Node.js (v14+)
 *   - npm install puppeteer
 * 
 * Usage:
 *   node complete_webcam_extractor.js
 * 
 * Output:
 *   - webcam_streams_complete.json (all results)
 *   - webcam_streams_epic.json (Epic Pass only)
 *   - webcam_streams_ikon.json (Ikon Pass only)
 */

// ============================================================================
// EPIC PASS RESORTS
// ============================================================================

const EPIC_RESORTS = [
    // ROCKIES
    { name: "Vail, CO", url: "https://www.vail.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Rockies" },
    { name: "Beaver Creek, CO", url: "https://www.beavercreek.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Rockies" },
    { name: "Breckenridge, CO", url: "https://www.breckenridge.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Rockies" },
    { name: "Keystone, CO", url: "https://www.keystoneresort.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Rockies" },
    { name: "Crested Butte, CO", url: "https://www.skicb.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Rockies" },
    { name: "Park City, UT", url: "https://www.parkcitymountain.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Rockies" },
    
    // WEST
    { name: "Heavenly, CA/NV", url: "https://www.skiheavenly.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "West" },
    { name: "Northstar, CA", url: "https://www.northstarcalifornia.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "West" },
    { name: "Kirkwood, CA", url: "https://www.kirkwood.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "West" },
    { name: "Stevens Pass, WA", url: "https://www.stevenspass.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "West" },
    
    // NORTHEAST
    { name: "Stowe, VT", url: "https://www.stowe.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Northeast" },
    { name: "Okemo, VT", url: "https://www.okemo.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Northeast" },
    { name: "Mount Snow, VT", url: "https://www.mountsnow.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Northeast" },
    { name: "Hunter, NY", url: "https://www.huntermtn.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Northeast" },
    { name: "Attitash, NH", url: "https://www.attitash.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Northeast" },
    { name: "Wildcat, NH", url: "https://www.skiwildcat.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Northeast" },
    { name: "Mount Sunapee, NH", url: "https://www.mountsunapee.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Northeast" },
    { name: "Crotched, NH", url: "https://www.crotchedmtn.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Northeast" },
    
    // MID-ATLANTIC
    { name: "Seven Springs, PA", url: "https://www.7springs.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Mid-Atlantic" },
    { name: "Liberty Mountain, PA", url: "https://www.libertymountainresort.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Mid-Atlantic" },
    { name: "Roundtop Mountain, PA", url: "https://www.skiroundtop.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Mid-Atlantic" },
    { name: "Whitetail Resort, PA", url: "https://www.skiwhitetail.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Mid-Atlantic" },
    { name: "Jack Frost, PA", url: "https://www.jfbb.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Mid-Atlantic" },
    { name: "Big Boulder, PA", url: "https://www.jfbb.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Mid-Atlantic" },
    { name: "Hidden Valley, PA", url: "https://www.hiddenvalleyresort.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Mid-Atlantic" },
    { name: "Laurel Mountain, PA", url: "https://www.laurelmountainski.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Mid-Atlantic" },
    
    // MIDWEST
    { name: "Wilmot Mountain, WI", url: "https://www.wilmotmountain.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Midwest" },
    { name: "Afton Alps, MN", url: "https://www.aftonalps.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Midwest" },
    { name: "Mt Brighton, MI", url: "https://www.mtbrighton.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Midwest" },
    { name: "Alpine Valley, OH", url: "https://www.alpinevalleyohio.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Midwest" },
    { name: "Boston Mills/Brandywine, OH", url: "https://www.bmbw.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Midwest" },
    { name: "Mad River Mountain, OH", url: "https://www.skimadriver.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Midwest" },
    { name: "Hidden Valley, MO", url: "https://www.hiddenvalleyski.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Midwest" },
    { name: "Snow Creek, MO", url: "https://www.skisnowcreek.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Midwest" },
    { name: "Paoli Peaks, IN", url: "https://www.paolipeaks.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Midwest" },
    
    // CANADA
    { name: "Whistler Blackcomb, BC", url: "https://www.whistlerblackcomb.com/the-mountain/mountain-conditions/mountain-cams.aspx", region: "Canada" },
];

// ============================================================================
// IKON PASS RESORTS
// ============================================================================

const IKON_RESORTS = [
    // ALTERRA-OWNED (Unlimited)
    { name: "Aspen Snowmass, CO", url: "https://www.aspensnowmass.com/while-you-are-here/webcams", region: "Colorado" },
    { name: "Big Sky Resort, MT", url: "https://bigskyresort.com/explore-the-resort/the-mountain/mountain-report-webcams", region: "Montana" },
    { name: "Crystal Mountain, WA", url: "https://crystalmt.com/mountain/report-webcams/", region: "Washington" },
    { name: "Deer Valley, UT", url: "https://www.deervalley.com/explore/weather-cams", region: "Utah" },
    { name: "Jackson Hole, WY", url: "https://www.jacksonhole.com/live-mountain-cams", region: "Wyoming" },
    { name: "Killington, VT", url: "https://www.killington.com/the-mountain/mountain-report/webcams", region: "Vermont" },
    { name: "Mammoth Mountain, CA", url: "https://www.mammothmountain.com/things-to-do/activities/webcams", region: "California" },
    { name: "Palisades Tahoe, CA", url: "https://www.palisadestahoe.com/mountain-info/mountain-cams", region: "California" },
    { name: "Snowbird, UT", url: "https://www.snowbird.com/mountain-info/webcams/", region: "Utah" },
    { name: "Solitude, UT", url: "https://www.solitudemountain.com/mountain-information/web-cams/", region: "Utah" },
    { name: "Steamboat, CO", url: "https://www.steamboat.com/the-mountain/mountain-report/webcams", region: "Colorado" },
    { name: "Stratton, VT", url: "https://www.stratton.com/the-mountain/mountain-conditions/webcams", region: "Vermont" },
    { name: "Sugarbush, VT", url: "https://www.sugarbush.com/webcams/", region: "Vermont" },
    { name: "Tremblant, QC", url: "https://www.tremblant.ca/mountain-village/webcam", region: "Quebec" },
    { name: "Winter Park, CO", url: "https://www.winterparkresort.com/the-mountain/mountain-report/webcams", region: "Colorado" },
    
    // ALTERRA-OWNED (Limited/Regional)
    { name: "Big Bear Mountain Resort, CA", url: "https://www.bigbearmountainresort.com/the-mountain/mountain-report/webcams", region: "California" },
    { name: "Blue Mountain, ON", url: "https://www.bluemountain.ca/conditions-and-weather/live-mountain-cam", region: "Ontario" },
    { name: "Copper Mountain, CO", url: "https://www.coppercolorado.com/the-mountain/conditions-weather/webcams", region: "Colorado" },
    { name: "Eldora, CO", url: "https://www.eldora.com/the-mountain/mountain-report/webcams", region: "Colorado" },
    { name: "June Mountain, CA", url: "https://www.junemountain.com/mountain-info/webcams", region: "California" },
    { name: "Snowshoe, WV", url: "https://www.snowshoemtn.com/the-mountain/webcams", region: "West Virginia" },
    
    // MAJOR PARTNERS
    { name: "Alta, UT", url: "https://www.alta.com/conditions/webcams", region: "Utah" },
    { name: "Arapahoe Basin, CO", url: "https://arapahoebasin.com/webcams/", region: "Colorado" },
    { name: "Alyeska, AK", url: "https://www.alyeskaresort.com/winter/mountain-report/webcams", region: "Alaska" },
    { name: "Brighton, UT", url: "https://brightonresort.com/webcams", region: "Utah" },
    { name: "Cypress Mountain, BC", url: "https://www.cypressmountain.com/webcam", region: "British Columbia" },
    { name: "Lake Louise, AB", url: "https://www.skilouise.com/conditions-and-weather/web-cams", region: "Alberta" },
    { name: "Loon, NH", url: "https://www.loonmtn.com/explore/webcams/", region: "New Hampshire" },
    { name: "Mt. Bachelor, OR", url: "https://www.mtbachelor.com/the-mountain/webcams/", region: "Oregon" },
    { name: "Pico Mountain, VT", url: "https://www.picomountain.com/mountain-information/webcams", region: "Vermont" },
    { name: "Red Mountain, BC", url: "https://www.redresort.com/conditions/webcams/", region: "British Columbia" },
    { name: "Revelstoke, BC", url: "https://www.revelstokemountainresort.com/mountain-report/mountain-cams", region: "British Columbia" },
    { name: "Snowbasin, UT", url: "https://www.snowbasin.com/conditions-grooming/webcams/", region: "Utah" },
    { name: "Sugarloaf, ME", url: "https://www.sugarloaf.com/conditions-weather/live-cams", region: "Maine" },
    { name: "Sunday River, ME", url: "https://www.sundayriver.com/the-mountain/mountain-report/webcams", region: "Maine" },
    { name: "Sunshine Village, AB", url: "https://www.skibanff.com/conditions-and-weather/webcams/", region: "Alberta" },
    { name: "Sun Valley, ID", url: "https://www.sunvalley.com/plan-your-trip/mountain-report/web-cams", region: "Idaho" },
    { name: "Taos, NM", url: "https://www.skitaos.com/mountain-conditions-weather/mountain-info/webcams/", region: "New Mexico" },
    { name: "Summit at Snoqualmie, WA", url: "https://summitatsnoqualmie.com/mountain-report/mountain-cams", region: "Washington" },
];

// ============================================================================
// STREAM DETECTION PATTERNS
// ============================================================================

const STREAM_PATTERNS = [
    /\.m3u8(?:\?[^\s'"]*)?/i,
    /\.mjpe?g(?:\?[^\s'"]*)?/i,
    /\.mp4(?:\?[^\s'"]*)?/i,
    /\.webm(?:\?[^\s'"]*)?/i,
    /camstreamer\.com\/embed\/[^/?#]+/i,
    /(?:player|live\d*)\.brownrice\.com\/embed\/[^/?#]+/i,
    /skaping\.com\//i,
    /youtube(?:-nocookie)?\.com\/embed\/[^/?#]+/i,
    /manage\.hdrelay\.com\/snapshot/i,
    /manage\.hdrelay\.com\/player/i,
    /img\.hdrelay\.com\/frames/i,
    /backend\.roundshot\.com\/cams/i,
    /storage\.roundshot\.com\//i,
    /app\.prismcam\.com\/public\/helpers\/realtime_preview\.php/i,
    /media\.[^/]+\/cams\//i
];

const PAGE_HINT_PATTERNS = [
    /webcam/i,
    /live-cam/i,
    /live-cams/i,
    /mountain-cams/i,
    /web-cams?/i,
    /camera/i,
    /cams?(?:\/|$|\?)/i
];

const KNOWN_CAMERA_HOST_PATTERNS = [
    /camstreamer\.com$/i,
    /brownrice\.com$/i,
    /youtube(?:-nocookie)?\.com$/i,
    /hdrelay\.com$/i,
    /roundshot\.com$/i,
    /prismcam\.com$/i,
    /skaping\.com$/i,
    /mammothresorts\.com$/i
];

const JUNK_URL_PATTERNS = [
    /_Incapsula_Resource/i,
    /google\./i,
    /doubleclick/i,
    /googletagmanager/i,
    /google-analytics/i,
    /analytics/i,
    /bat\.bing/i,
    /twitter\.com\/i\/adsct/i,
    /sp\.analytics\.yahoo/i,
    /quantserve/i,
    /pages\d+\.net/i,
    /insight\.adsrvr/i,
    /demdex/i,
    /fareharbor/i,
    /page-data\.json/i,
    /collect\?/i,
    /activityi;/i,
    /pixel/i,
    /pingdom\.net\/img\/beacon\.gif/i,
    /satis\.fi/i,
    /reddit/i,
    /webcam-offline/i,
    /flashtalking/i,
    /everesttech/i,
    /strapiapp\.com/i
];

const NOT_FOUND_PATTERNS = [
    /page not found/i,
    /\b404\b/i,
    /not found/i,
    /errors\/not-found/i
];

const RESORT_PAGE_OVERRIDES = {
    'alta': 'https://www.alta.com/weather',
    'arapahoe basin': 'https://www.arapahoebasin.com/mountain-cams/',
    'aspen snowmass': 'https://www.aspensnowmass.com/four-mountains/mountain-cams',
    'big bear': 'https://www.bigbearmountainresort.com/webcams',
    'big sky': 'https://www.bigskyresort.com/current-conditions/webcams',
    'blue': 'https://www.bluemountain.ca/mountain/webcams',
    'copper': 'https://www.coppercolorado.com/the-mountain/webcams/',
    'crystal': 'https://www.crystalmountainresort.com/the-mountain/mountain-report-and-webcams/webcams',
    'cypress': 'https://www.cypressmountain.com/webcams',
    'deer valley': 'https://www.deervalley.com/explore-the-mountain/webcams',
    'eldora': 'https://www.eldora.com/the-mountain/webcams/snow-stake-cam/',
    'june': 'https://www.junemountain.com/mountain-information/live-cams',
    'killington': 'https://www.killington.com/the-mountain/conditions-weather/webcam/',
    'lake louise': 'https://www.skilouise.com/mountain-cam/',
    'loon': 'https://www.loonmtn.com/mountain-report',
    'mammoth': 'https://www.mammothmountain.com/on-the-mountain/mammoth-webcam',
    'palisades tahoe': 'https://www.palisadestahoe.com/mountain-information/webcams',
    'pico': 'https://www.picomountain.com/the-mountain/conditions-weather/webcams/',
    'red': 'https://www.redresort.com/report?cams',
    'revelstoke': 'https://www.revelstokemountainresort.com/mountain/conditions/webcams/',
    'snowbasin': 'https://www.snowbasin.com/the-mountain/web-cams',
    'snowbird': 'https://www.snowbird.com/the-mountain/webcams/view-all-webcams/',
    'snowshoe': 'https://www.snowshoemtn.com/media-room/web-cams',
    'solitude': 'https://www.solitudemountain.com/mountain-and-village/webcams',
    'sugarbush': 'https://www.sugarbush.com/mountain/webcams',
    'sugarloaf': 'https://www.sugarloaf.com/mountain-report',
    'sun valley': 'https://www.sunvalley.com/the-mountain/web-cams',
    'sunday river': 'https://www.sundayriver.com/mountain-report',
    'summit at snoqualmie': 'https://www.summitatsnoqualmie.com/webcams',
    'taos': 'https://www.skitaos.com/lifts?section=weather-forecast',
    'winter park': 'https://www.winterparkresort.com/the-mountain/mountain-cams'
};

const MANUAL_FEED_OVERRIDES = {
    'blue': [
        { kind: 'iframe', url: 'https://www.skaping.com/blue-mountain/village', title: 'Village Cam' },
        { kind: 'iframe', url: 'https://www.skaping.com/blue-mountain/mountain-top', title: 'Mountain Top Cam' },
        { kind: 'iframe', url: 'https://www.youtube-nocookie.com/embed/52ar9bJWTIA', title: 'Orchard Cam' },
        { kind: 'iframe', url: 'https://www.youtube-nocookie.com/embed/hPpsWGYXqok', title: 'South Cam' },
        { kind: 'iframe', url: 'https://www.youtube-nocookie.com/embed/fVzgIfHAG3U', title: 'Village Cam 2' },
        { kind: 'iframe', url: 'https://www.youtube-nocookie.com/embed/wQqLdKmGkYc', title: 'North Cam' },
        { kind: 'iframe', url: 'https://www.youtube-nocookie.com/embed/yYxZrTBne3I', title: 'Valley Cam' },
        { kind: 'iframe', url: 'https://www.youtube-nocookie.com/embed/68mi8QqjbDE', title: 'Apple Bowl Cam' },
        { kind: 'iframe', url: 'https://www.youtube-nocookie.com/embed/vEo7zDF5BFc', title: 'South Base Cam' },
        { kind: 'iframe', url: 'https://www.youtube-nocookie.com/embed/ezyjNLLIUh0', title: 'Village Plaza Cam' }
    ],
    'stratton': [
        { kind: 'iframe', url: 'https://www.youtube.com/embed/9E00W9R_Cnc?autoplay=1&mute=1', title: 'Summit Cam' },
        { kind: 'iframe', url: 'https://camstreamer.com/embed/6d876e50aed9a9f/S-10051?autoplay=1&mute=1', title: 'Base Cam' },
        { kind: 'iframe', url: 'https://www.youtube.com/embed/ildHe_RG1Mk?autoplay=1&mute=1', title: 'Snow Bowl Cam' },
        { kind: 'iframe', url: 'https://camstreamer.com/embed/70ccf46040b5642/S-19241?autoplay=1&mute=1', title: 'Village Cam' },
        { kind: 'iframe', url: 'https://www.youtube.com/embed/lE1B_VyAbZI?autoplay=1&mute=1', title: 'Sun Bowl Cam' },
        { kind: 'iframe', url: 'https://camstreamer.com/embed/51a3cf116dea6bf/S-61347?autoplay=1&mute=1', title: 'Mid-Mountain Cam' },
        { kind: 'iframe', url: 'https://www.youtube.com/embed/AhcH03HwuH0?autoplay=1&mute=1', title: 'Learning Zone Cam' },
        { kind: 'iframe', url: 'https://www.youtube.com/embed/SqWPtm63rJc?autoplay=1&mute=1', title: 'Sunrise Cam' },
        { kind: 'iframe', url: 'https://www.youtube.com/embed/H-_sGi4Sbtk?autoplay=1&mute=1', title: 'Snow Stake Cam' }
    ],
    'taos': [
        { kind: 'iframe', url: 'https://live2.brownrice.com/embed/tsv', title: 'Taos Base Cam' },
        { kind: 'iframe', url: 'https://live2.brownrice.com/embed/tsvridge', title: 'Taos Ridge Cam' },
        { kind: 'iframe', url: 'https://live3.brownrice.com/embed/tsvbav', title: 'Taos Bavarian Cam' },
        { kind: 'iframe', url: 'https://live3.brownrice.com/embed/tsvlonestar', title: 'Taos Lone Star Cam' },
        { kind: 'image', url: 'https://tsvweather.brownrice.com/img/poco.jpg', title: 'Taos Snapshot' }
    ],
    'tremblant': [
        { kind: 'iframe', url: 'https://www.skaping.com/tremblant/versant-sud', title: 'Versant Sud Cam' },
        { kind: 'iframe', url: 'https://www.skaping.com/tremblant/pic-flying-mile', title: 'Flying Mile Cam' },
        { kind: 'iframe', url: 'https://www.youtube.com/embed/NRa3BChsknE?autoplay=1&mute=1', title: 'Village Cam' }
    ],
    'lake louise': [
        { kind: 'iframe', url: 'https://skilouise.roundshot.com/ptarmigan/', title: '360 Super Cam' },
        { kind: 'image', url: 'https://cams.skilouise.com/cam1.jpg', title: 'Gondola Top' },
        { kind: 'image', url: 'https://cams.skilouise.com/cam2.jpg', title: 'Ski Resort Base Area' },
        { kind: 'image', url: 'https://cams.skilouise.com/cam3.jpg', title: 'New Ptarmigan' },
        { kind: 'image', url: 'https://cams.skilouise.com/cam5.jpg', title: 'Ptarmigan Top Perm Fence' },
        { kind: 'image', url: 'https://cams.skilouise.com/cam6.jpg', title: 'Base Area Alternate' },
        { kind: 'image', url: 'https://cams.skilouise.com/cam7.jpg', title: 'Whitehorn Lodge' },
        { kind: 'image', url: 'https://cams.skilouise.com/cam8.jpg', title: 'Paradise Summit' },
        { kind: 'image', url: 'https://cams.skilouise.com/cam13.jpg', title: 'Paradise Backside' }
    ]
};

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeResortName(name) {
    return name
        .toLowerCase()
        .replace(/\(.*?\)/g, '')
        .replace(/\b(resort|mountain|ski area)\b/g, '')
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getResortKey(name) {
    return normalizeResortName(name.split(',')[0].trim());
}

function resolveWebcamPage(resort) {
    return RESORT_PAGE_OVERRIDES[getResortKey(resort.name)] || resort.url;
}

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&#x2F;/gi, '/')
        .replace(/&#47;/g, '/')
        .replace(/&#x3A;/gi, ':')
        .replace(/&#58;/g, ':');
}

function sanitizeUrl(value, baseUrl = null) {
    if (!value) return null;

    try {
        const decoded = decodeHtmlEntities(String(value).trim());
        const parsed = baseUrl ? new URL(decoded, baseUrl) : new URL(decoded);
        return parsed.toString();
    } catch {
        return null;
    }
}

function isJunkUrl(url) {
    if (!url) return true;
    return JUNK_URL_PATTERNS.some((pattern) => pattern.test(url));
}

function isLikelyFeedUrl(url) {
    if (!url || isJunkUrl(url)) return false;
    return STREAM_PATTERNS.some((pattern) => pattern.test(url)) || PAGE_HINT_PATTERNS.some((pattern) => pattern.test(url));
}

function extractCandidateLinks(baseUrl, html) {
    const matches = Array.from(
        html.matchAll(/href=["']([^"']*(?:webcam|webcams|live-cam|live-cams|mountain-cams|weather-cams|web-cams|web-cam|camera|cams?)[^"']*)["']/ig)
    );

    return [...new Set(
        matches
            .map((match) => sanitizeUrl(match[1], baseUrl))
            .filter((url) => url && !isJunkUrl(url))
    )];
}

function classifyFeed(url, tagName = '', title = '') {
    const lower = url.toLowerCase();
    const host = (() => {
        try {
            return new URL(url).hostname;
        } catch {
            return '';
        }
    })();

    if (
        (tagName === 'iframe' && STREAM_PATTERNS.some((pattern) => pattern.test(url))) ||
        /camstreamer\.com\/embed\/[^/?#]+|(?:player|live\d*)\.brownrice\.com\/embed\/[^/?#]+|youtube(?:-nocookie)?\.com\/embed\/[^/?#]+|manage\.hdrelay\.com\/player|skaping\.com\//i.test(lower)
    ) {
        return 'iframe';
    }
    if (/\.m3u8(?:\?|$)/i.test(lower)) return 'hls';
    if (/\.mp4(?:\?|$)/i.test(lower) || /\.webm(?:\?|$)/i.test(lower)) return 'video';
    if (/\.mjpe?g(?:\?|$)/i.test(lower)) return 'mjpeg';
    if (
        /\.(?:jpe?g|png|gif|webp)(?:\?|$)/i.test(lower) ||
        /hdrelay|roundshot|prismcam|\/cams\//i.test(lower) ||
        KNOWN_CAMERA_HOST_PATTERNS.some((pattern) => pattern.test(host))
    ) {
        return 'image';
    }
    if (/webcam|camera|cam|live-cam|mountain-cams|web-cams/i.test(lower) || /cam/i.test(title)) {
        return 'page';
    }
    return 'page';
}

function prettifyTitle(rawTitle, fallbackUrl) {
    const cleaned = String(rawTitle || '').replace(/\s+/g, ' ').trim();
    if (cleaned) return cleaned;

    try {
        const parsed = new URL(fallbackUrl);
        const tail = parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname;
        return tail
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    } catch {
        return 'Live Webcam';
    }
}

function scoreCandidate(url, baseOrigin = '') {
    let score = 0;
    if (!url || isJunkUrl(url)) return -1;
    if (url.startsWith(baseOrigin)) score += 4;
    if (/webcam|webcams/i.test(url)) score += 5;
    if (/mountain-cams|web-cams|live-cams/i.test(url)) score += 4;
    if (/conditions|mountain-report|weather|report/i.test(url)) score += 1;
    if (/snow-stake|summit|base|village|peak|cam\//i.test(url)) score += 2;
    if (/\?.+/.test(url)) score -= 1;
    if (/account|ticket|deal|package|shop/i.test(url)) score -= 6;
    return score;
}

function looksLikeNotFound(pageState, pageUrl) {
    const text = `${pageState.title || ''}\n${pageState.bodyText || ''}\n${pageUrl || ''}`;
    return NOT_FOUND_PATTERNS.some((pattern) => pattern.test(text));
}

function chooseDisplayPage(initialUrl, resolvedPage, feeds) {
    const pageFeeds = feeds
        .filter((feed) => feed.kind === 'page' && !isJunkUrl(feed.url))
        .filter((feed) => !/page-data\.json/i.test(feed.url))
        .filter((feed) => !/opensnow\.com\/location\/.+\/snow-summary/i.test(feed.url));

    if (/page-data\.json/i.test(resolvedPage) || /opensnow\.com\/location\/.+\/snow-summary/i.test(resolvedPage)) {
        return pageFeeds[0]?.url || initialUrl;
    }

    if (/^https?:\/\/[^/]+\/?$/i.test(resolvedPage)) {
        const moreSpecificPage = pageFeeds.find((feed) => {
            try {
                const pageUrl = new URL(feed.url);
                const resolvedUrl = new URL(resolvedPage);
                return pageUrl.origin === resolvedUrl.origin && pageUrl.pathname !== '/';
            } catch {
                return false;
            }
        });
        if (moreSpecificPage) return moreSpecificPage.url;
    }

    return resolvedPage;
}

async function collectPageState(page) {
    const snapshot = await page.evaluate(() => {
        const media = [];
        const links = [];
        const pushMedia = (tag, url, title = '') => {
            if (!url) return;
            media.push({ tag, url, title });
        };

        document.querySelectorAll('img').forEach((element) => {
            pushMedia('img', element.currentSrc || element.src, element.alt || element.getAttribute('title') || '');
        });

        document.querySelectorAll('video').forEach((element) => {
            pushMedia('video', element.currentSrc || element.src, element.getAttribute('title') || '');
        });

        document.querySelectorAll('source').forEach((element) => {
            pushMedia('source', element.src, element.getAttribute('title') || '');
        });

        document.querySelectorAll('iframe').forEach((element) => {
            pushMedia('iframe', element.src, element.getAttribute('title') || '');
        });

        document.querySelectorAll('a[href]').forEach((element) => {
            const href = element.href || element.getAttribute('href');
            const title = (element.textContent || '').replace(/\s+/g, ' ').trim() || element.getAttribute('title') || '';
            links.push({ href, title });
            if (/webcam|camera|cam|live-cam|live-cams|mountain-cams|web-cams/i.test(`${href} ${title}`)) {
                pushMedia('link', href, title);
            }
        });

        if (window.Alta?.weather?.mountainCams) {
            window.Alta.weather.mountainCams.forEach((camera) => {
                pushMedia('inline-json', camera.url, camera.name || '');
            });
        }

        return {
            title: document.title || '',
            bodyText: (document.body?.innerText || '').slice(0, 4000),
            html: document.documentElement.outerHTML.slice(0, 300000),
            media,
            links
        };
    });

    const htmlMatches = snapshot.html.match(/https?:[^"'<>\s]+(?:m3u8|mp4|webm|jpe?g|png|gif|mjpeg|mjpg|camstreamer\.com\/embed\/[^"'<>\s]+|(?:player|live\d*)\.brownrice\.com\/embed\/[^"'<>\s]+|youtube(?:-nocookie)?\.com\/embed\/[^"'<>\s]+|manage\.hdrelay\.com\/(?:snapshot|player)|img\.hdrelay\.com\/frames|backend\.roundshot\.com\/cams|storage\.roundshot\.com\/[^\s"'<>]+|app\.prismcam\.com\/public\/helpers\/realtime_preview\.php[^\s"'<>]*|skaping\.com\/[^\s"'<>]+)/ig) || [];

    return {
        title: snapshot.title,
        bodyText: snapshot.bodyText,
        cameraLinks: [...new Set(snapshot.links
            .map((link) => sanitizeUrl(link.href, page.url()))
            .filter((url) => url && PAGE_HINT_PATTERNS.some((pattern) => pattern.test(url)))
        )],
        candidates: [
            ...snapshot.media.map((item) => ({
                url: sanitizeUrl(item.url, page.url()),
                title: item.title,
                tag: item.tag,
                source: 'dom'
            })),
            ...htmlMatches.map((url) => ({
                url: sanitizeUrl(url, page.url()),
                title: '',
                tag: 'html',
                source: 'html'
            }))
        ].filter((item) => item.url && !isJunkUrl(item.url))
    };
}

function normalizeFeeds(candidates) {
    const feeds = [];
    const seen = new Set();

    for (const candidate of candidates) {
        const url = candidate.url;
        if (!isLikelyFeedUrl(url)) continue;

        const kind = classifyFeed(url, candidate.tag, candidate.title);
        if (kind === 'page' && !PAGE_HINT_PATTERNS.some((pattern) => pattern.test(url))) continue;

        const key = `${kind}:${url}`;
        if (seen.has(key)) continue;
        seen.add(key);

        feeds.push({
            title: prettifyTitle(candidate.title, url),
            kind,
            url,
            source: candidate.source || 'unknown'
        });
    }

    return feeds;
}

function applyManualFeedOverrides(sourceKey, feeds) {
    const manualFeeds = MANUAL_FEED_OVERRIDES[sourceKey] || [];
    if (!manualFeeds.length) return feeds;

    const normalizedManualFeeds = manualFeeds.map((feed) => ({
        title: feed.title || prettifyTitle('', feed.url),
        kind: feed.kind || classifyFeed(feed.url, 'iframe', feed.title || ''),
        url: feed.url,
        source: 'manual'
    }));

    return [...feeds, ...normalizedManualFeeds];
}

function reduceFeeds(feeds) {
    const nonPageFeeds = feeds.filter((feed) => feed.kind !== 'page');
    const selected = nonPageFeeds.length ? nonPageFeeds : feeds.filter((feed) => {
        try {
            const parsed = new URL(feed.url);
            return !parsed.hash;
        } catch {
            return true;
        }
    });

    const grouped = new Map();

    for (const feed of selected) {
        let groupKey = `${feed.kind}:${feed.url}`;

        if (feed.kind === 'hls') {
            groupKey = feed.url
                .replace(/\/chunklist_[^/]+\.m3u8(?:\?.*)?$/i, '/stream')
                .replace(/\/main_playlist\.m3u8(?:\?.*)?$/i, '/stream');
        }

        const existing = grouped.get(groupKey);
        if (!existing) {
            grouped.set(groupKey, feed);
            continue;
        }

        const preferCurrent =
            /main_playlist\.m3u8/i.test(feed.url) ||
            (existing.kind === 'page' && feed.kind !== 'page');

        if (preferCurrent && !/main_playlist\.m3u8/i.test(existing.url)) {
            grouped.set(groupKey, feed);
        }
    }

    return [...grouped.values()];
}

async function loadPage(page, url) {
    await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });
    await delay(7000);
    await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight * 0.5);
    }).catch(() => null);
    await delay(1800);
    await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
    }).catch(() => null);
    await delay(2200);
}

async function discoverFallbackCandidates(page, originalUrl) {
    const currentHtml = await page.content();
    const currentCandidates = extractCandidateLinks(page.url(), currentHtml);

    try {
        const homeResponse = await fetch(new URL(originalUrl).origin, {
            redirect: 'follow',
            headers: { 'user-agent': 'Mozilla/5.0' }
        });
        const homeHtml = await homeResponse.text();
        return [...new Set([...currentCandidates, ...extractCandidateLinks(homeResponse.url, homeHtml)])];
    } catch {
        return currentCandidates;
    }
}

async function collectChildFeeds(page, parentUrl, cameraLinks, limit = 4) {
    const feeds = [];
    const origin = new URL(parentUrl).origin;
    const ranked = [...cameraLinks]
        .filter((url) => url.startsWith(origin) && url !== parentUrl)
        .sort((left, right) => scoreCandidate(right, origin) - scoreCandidate(left, origin))
        .slice(0, limit);

    for (const candidateUrl of ranked) {
        try {
            await loadPage(page, candidateUrl);
            const state = await collectPageState(page);
            const childFeeds = normalizeFeeds(state.candidates)
                .filter((feed) => feed.kind !== 'page')
                .map((feed) => ({ ...feed, parentPage: candidateUrl, source: 'child-page' }));
            feeds.push(...childFeeds);
        } catch {
            // Ignore child-page failures and keep moving.
        }
    }

    return feeds;
}

async function extractStreamsFromResort(browser, resort, passType) {
    const page = await browser.newPage();
    const networkCandidates = [];
    const requestUrls = [];
    const sourceKey = getResortKey(resort.name);
    const initialUrl = resolveWebcamPage(resort);

    await page.setViewport({ width: 1600, height: 1000 });
    page.on('request', (request) => {
        const url = sanitizeUrl(request.url());
        if (!url) return;
        requestUrls.push(url);
        if (isLikelyFeedUrl(url)) {
            networkCandidates.push({
                url,
                title: '',
                tag: 'network',
                source: 'network'
            });
        }
    });

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${passType.toUpperCase()}] ${resort.name} - ${resort.region}`);
    console.log(`URL: ${initialUrl}`);
    console.log('='.repeat(80));

    let resolvedPage = initialUrl;
    let state = null;
    let error = null;

    try {
        await loadPage(page, initialUrl);
        resolvedPage = page.url();
        state = await collectPageState(page);

        const fallbackCandidates = await discoverFallbackCandidates(page, initialUrl);
        const usableFeeds = normalizeFeeds([...state.candidates, ...networkCandidates]);

        if (looksLikeNotFound(state, resolvedPage) || usableFeeds.length === 0) {
            const rankedFallbacks = fallbackCandidates
                .filter((url) => url !== resolvedPage)
                .sort((left, right) => scoreCandidate(right, new URL(initialUrl).origin) - scoreCandidate(left, new URL(initialUrl).origin));

            for (const fallbackUrl of rankedFallbacks.slice(0, 3)) {
                await loadPage(page, fallbackUrl);
                const nextState = await collectPageState(page);
                const nextFeeds = normalizeFeeds([...nextState.candidates, ...networkCandidates]);
                if (!looksLikeNotFound(nextState, page.url()) || nextFeeds.length > usableFeeds.length) {
                    resolvedPage = page.url();
                    state = nextState;
                    break;
                }
            }
        }

        let feeds = normalizeFeeds([...state.candidates, ...networkCandidates]);
        const pageLinks = [...new Set(state.cameraLinks)];
        const mediaFeeds = feeds.filter((feed) => feed.kind !== 'page');

        if ((mediaFeeds.length < 2 || looksLikeNotFound(state, resolvedPage)) && pageLinks.length) {
            const childFeeds = await collectChildFeeds(page, resolvedPage, pageLinks, 4);
            feeds = normalizeFeeds([
                ...feeds.map((feed) => ({ ...feed, tag: feed.kind, source: feed.source })),
                ...childFeeds.map((feed) => ({ ...feed, tag: feed.kind, source: feed.source }))
            ]);
        }

        feeds = applyManualFeedOverrides(sourceKey, feeds);

        const finalFeeds = reduceFeeds(feeds)
            .sort((left, right) => {
                const rank = { iframe: 0, video: 1, mjpeg: 2, image: 3, hls: 4, page: 5 };
                return (rank[left.kind] || 9) - (rank[right.kind] || 9);
            })
            .slice(0, 12);

        const displayPage = chooseDisplayPage(initialUrl, resolvedPage, finalFeeds);

        console.log(`Resolved page: ${displayPage}`);
        console.log(`Request count: ${requestUrls.length}`);
        console.log(`Feeds found: ${finalFeeds.length}`);

        return {
            resort: resort.name,
            sourceKey,
            region: resort.region,
            pass: passType.toLowerCase(),
            webcamPage: displayPage,
            feedCount: finalFeeds.length,
            feeds: finalFeeds,
            streamUrls: finalFeeds
                .filter((feed) => feed.kind !== 'page')
                .map((feed) => feed.url),
            totalRequests: requestUrls.length,
            timestamp: new Date().toISOString(),
            status: finalFeeds.length ? 'SUCCESS' : 'NO_FEEDS_FOUND'
        };
    } catch (caughtError) {
        error = caughtError;
        console.error(`Error: ${caughtError.message}`);
        return {
            resort: resort.name,
            sourceKey,
            region: resort.region,
            pass: passType.toLowerCase(),
            webcamPage: resolvedPage,
            feedCount: 0,
            feeds: [],
            streamUrls: [],
            totalRequests: requestUrls.length,
            timestamp: new Date().toISOString(),
            status: 'ERROR',
            error: caughtError.message
        };
    } finally {
        await page.close().catch(() => null);
        if (error) {
            await delay(250);
        }
    }
}

function buildPageCatalog(results = []) {
    const catalog = {};
    const resolvedPages = new Map();

    results.forEach((entry) => {
        const key = entry.sourceKey || getResortKey(entry.resort || '');
        if (key && entry.webcamPage) {
            resolvedPages.set(key, entry.webcamPage);
        }
    });

    const allResorts = [
        ...EPIC_RESORTS.map((resort) => ({ ...resort, pass: 'epic' })),
        ...IKON_RESORTS.map((resort) => ({ ...resort, pass: 'ikon' }))
    ];

    for (const resort of allResorts) {
        const cleanedName = resort.name.split(',')[0].trim();
        const key = getResortKey(cleanedName);
        const resolvedPage = resolvedPages.get(key) || resolveWebcamPage(resort);

        if (!catalog[key]) {
            catalog[key] = {
                resort: cleanedName,
                passes: [resort.pass],
                webcamPage: resolvedPage,
                region: resort.region
            };
            continue;
        }

        if (!catalog[key].passes.includes(resort.pass)) {
            catalog[key].passes.push(resort.pass);
        }

        if (resolvedPage) {
            catalog[key].webcamPage = resolvedPage;
        }
    }

    return catalog;
}

function writePageCatalog(results = []) {
    const catalog = buildPageCatalog(results);
    fs.writeFileSync('webcam_pages.json', JSON.stringify(catalog, null, 2));
    console.log(`Saved webcam_pages.json with ${Object.keys(catalog).length} resorts.`);
}

async function main() {
    if (process.argv.includes('--export-pages')) {
        writePageCatalog();
        return;
    }

    console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║           SKI RESORT WEBCAM STREAM EXTRACTOR - COMPLETE EDITION              ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
    console.log(`\nStarted: ${new Date().toISOString()}`);
    console.log(`Total Resorts: ${EPIC_RESORTS.length} Epic + ${IKON_RESORTS.length} Ikon = ${EPIC_RESORTS.length + IKON_RESORTS.length}`);
    console.log('\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--window-size=1600,1000'
        ]
    });

    const epicResults = [];
    const ikonResults = [];

    console.log('\n🎿 PROCESSING EPIC PASS RESORTS...\n');
    for (const resort of EPIC_RESORTS) {
        const result = await extractStreamsFromResort(browser, resort, 'Epic');
        epicResults.push(result);
        await delay(500);
    }

    console.log('\n🏔️  PROCESSING IKON PASS RESORTS...\n');
    for (const resort of IKON_RESORTS) {
        const result = await extractStreamsFromResort(browser, resort, 'Ikon');
        ikonResults.push(result);
        await delay(500);
    }

    await browser.close();

    const allResults = { epic: epicResults, ikon: ikonResults };
    const flatResults = [...epicResults, ...ikonResults];

    writePageCatalog(flatResults);
    fs.writeFileSync('webcam_streams_complete.json', JSON.stringify(allResults, null, 2));
    fs.writeFileSync('webcam_streams_epic.json', JSON.stringify(epicResults, null, 2));
    fs.writeFileSync('webcam_streams_ikon.json', JSON.stringify(ikonResults, null, 2));

    const epicSuccess = epicResults.filter((result) => result.feedCount > 0).length;
    const ikonSuccess = ikonResults.filter((result) => result.feedCount > 0).length;
    const epicTotalStreams = epicResults.reduce((sum, result) => sum + (result.feedCount || 0), 0);
    const ikonTotalStreams = ikonResults.reduce((sum, result) => sum + (result.feedCount || 0), 0);

    console.log('\n\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                              FINAL SUMMARY                                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
    console.log(`\nEPIC PASS:`);
    console.log(`  Resorts Processed: ${epicResults.length}`);
    console.log(`  Resorts with Feeds Found: ${epicSuccess}`);
    console.log(`  Total Feeds Found: ${epicTotalStreams}`);
    console.log(`\nIKON PASS:`);
    console.log(`  Resorts Processed: ${ikonResults.length}`);
    console.log(`  Resorts with Feeds Found: ${ikonSuccess}`);
    console.log(`  Total Feeds Found: ${ikonTotalStreams}`);
    console.log(`\nOVERALL:`);
    console.log(`  Total Resorts: ${epicResults.length + ikonResults.length}`);
    console.log(`  Successful Extractions: ${epicSuccess + ikonSuccess}`);
    console.log(`  Total Feeds: ${epicTotalStreams + ikonTotalStreams}`);
    console.log(`\nFiles Created:`);
    console.log('  ✓ webcam_pages.json');
    console.log('  ✓ webcam_streams_complete.json');
    console.log('  ✓ webcam_streams_epic.json');
    console.log('  ✓ webcam_streams_ikon.json');
    console.log(`\nCompleted: ${new Date().toISOString()}`);
    console.log('\nDone!\n');
}

main().catch(console.error);
