const shell = '.app[data-app="member"]';
const dockSelector = `${shell} .uc-cart-shop > .cart-checkout-bar, ${shell} .product-detail > .product-mobile-buy`;
const root = document.getElementById('root');

if (root) {
  let dock;
  let section;
  let sizeObserver;

  function measure() {
    if (!dock?.isConnected) return;
    const height = dock.getBoundingClientRect().height;
    if (!height) return;
    const bounds = section.getBoundingClientRect();
    const sizes = {
      '--mall-dock-center': bounds.left + bounds.width / 2,
      '--mall-dock-width': bounds.width,
      '--mall-dock-height': height,
    };
    for (const [name, value] of Object.entries(sizes)) {
      const px = value + 'px';
      if (section.style.getPropertyValue(name) !== px) section.style.setProperty(name, px);
    }
  }

  function attach(element) {
    dock = element;
    section = dock.parentElement;
    measure();
    if (window.ResizeObserver) {
      sizeObserver = new ResizeObserver(measure);
      sizeObserver.observe(dock);
      sizeObserver.observe(section);
    }
    window.addEventListener('resize', measure);
  }

  function detach() {
    sizeObserver?.disconnect();
    sizeObserver = undefined;
    window.removeEventListener('resize', measure);
    for (const name of ['--mall-dock-center', '--mall-dock-width', '--mall-dock-height']) {
      section.style.removeProperty(name);
    }
    dock = section = undefined;
  }

  const initial = root.querySelector(dockSelector);
  if (initial) attach(initial);
  new MutationObserver(records => {
    if (dock?.isConnected) {
      if (!sizeObserver && records.some(record => dock.contains(record.target))) measure();
      return;
    }
    if (dock) detach();
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE || !node.isConnected) continue;
        const next = node.matches(dockSelector) ? node : node.querySelector(dockSelector);
        if (next) {
          attach(next);
          return;
        }
      }
    }
  }).observe(root, { childList: true, subtree: true });
}
