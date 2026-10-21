export function icon(name, className = '') {
  return `<img class="ui-icon ${className}" src="assets/mountain-icons/${name}.svg" width="24" height="24" alt="" aria-hidden="true">`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((element) => {
    element.innerHTML = icon(element.dataset.icon);
  });
}
