export function bindTVMode({ render, hidePreview }) {
  const button = document.getElementById('tv-toggle');
  const chrome = [...document.querySelectorAll('.heatmap-header, .heatmap-controls, .heatmap-footer, .heatmap-data-note')];
  const header = document.querySelector('.heatmap-header');
  new ResizeObserver(() => {
    document.body.style.setProperty('--tv-header-height', `${header.getBoundingClientRect().height}px`);
  }).observe(header);
  let enabled = false;
  let timer;
  function hide() {
    document.body.classList.add('tv-idle');
    chrome.forEach(element => { element.inert = true; });
    if (chrome.some(element => element.contains(document.activeElement))) document.activeElement.blur();
    hidePreview();
  }
  function reveal() {
    if (!enabled) return;
    clearTimeout(timer);
    document.body.classList.remove('tv-idle');
    chrome.forEach(element => { element.inert = false; });
    timer = setTimeout(hide, 5000);
  }
  function toggle(value) {
    enabled = value;
    clearTimeout(timer);
    document.body.classList.toggle('tv-mode', enabled);
    document.body.classList.remove('tv-idle');
    chrome.forEach(element => { element.inert = false; });
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? 'Exit TV mode' : 'TV mode';
    hidePreview();
    if (enabled) hide();
    render();
  }
  button.addEventListener('click', () => toggle(!enabled));
  document.addEventListener('pointermove', reveal);
  document.addEventListener('pointerdown', reveal);
  document.addEventListener('focusin', reveal);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && enabled) { toggle(false); return; }
    reveal();
  });
}
