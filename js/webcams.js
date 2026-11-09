export const webcamCatalogState = { status: 'loading', error: null };

// Camera catalogs contain only audited media, never inferred base/summit cameras.
export function selectWebcams(feeds = [], page = null) {
  const seen = new Set();
  const cameras = feeds.filter(feed => {
    if (!feed?.url?.startsWith('https://') || seen.has(feed.url)) return false;
    if (!['iframe', 'image', 'video', 'hls', 'mjpeg'].includes(feed.kind)) return false;
    if (/cam-control|camera-viewers|camera-controller|analytics|ipredictive|webcam-offline/i.test(feed.url)) return false;
    seen.add(feed.url);
    return true;
  }).slice(0, 8).map((feed, index) => ({
    ...feed, title: feed.title || `Camera ${index + 1}`,
    description: feed.kind === 'image' ? 'Camera snapshot · check the image timestamp for freshness.' : 'Camera player · availability is controlled by the resort.',
    sourceUrl: page || feed.url
  }));
  if (page) cameras.push({title:'Official webcam page',description: cameras.length
    ? 'All cameras and current camera status from the resort.'
    : 'An in-app feed could not be verified. Open the official camera page.',url:page,kind:'page',sourceUrl:page});
  return cameras;
}

export function attachCameraError(media, message = 'Camera unavailable. Try the official camera page below.') {
  const fail = () => {
    if (!media.isConnected || media.parentElement?.querySelector('.webcam-error')) return;
    const error = document.createElement('p');
    error.className = 'webcam-error';
    error.setAttribute('role', 'status');
    error.textContent = message;
    media.hidden = true;
    media.parentElement?.appendChild(error);
    media._snowScoutHls?.destroy();
  };
  media.addEventListener('error', fail);
  media.addEventListener('load', () => {
    media.hidden = false;
    media.parentElement?.querySelector('.webcam-error')?.remove();
  });
  return fail;
}
