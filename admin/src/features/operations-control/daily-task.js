const focusedTasks = new WeakSet();

export function taskValue(categories, name, search = globalThis.location?.search ?? '') {
  const params = new URLSearchParams(search);
  if (!categories.split('|').includes(params.get('daily'))) return null;
  const value = params.get(name);
  if (!value || value.length > 256) return null;
  if (['applicationId','qualificationId','orderId','run','group'].includes(name)) {
    return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value) ? value : null;
  }
  return value;
}

export function focusTaskElement(element) {
  if (!element || focusedTasks.has(element)) return;
  focusedTasks.add(element);
  requestAnimationFrame(() => {
    if (!element.isConnected) return;
    element.focus({preventScroll: true});
    element.scrollIntoView({block: 'center', behavior: 'instant'});
  });
}
