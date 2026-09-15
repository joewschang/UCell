/** Browser UI lifecycle only; not a substitute for server token verification/revocation. */
export class SessionGuard {
  private expired = false;
  private listeners = new Set<() => void>();
  private requests = new Set<AbortController>();
  getSnapshot = () => this.expired;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  register(controller: AbortController) {
    if (this.expired) controller.abort(); else this.requests.add(controller);
    return () => { this.requests.delete(controller); };
  }
  expire() {
    if (this.expired) return;
    this.expired = true;
    // Even unavailable browser storage must not prevent the UI from locking.
    for (const key of ['ucell_member_token', 'ucell_line_id_token', 'ucell_qualification_id']) {
      try { sessionStorage.removeItem(key); } catch { /* Fail closed independently of storage. */ }
    }
    for (const controller of this.requests) controller.abort();
    this.requests.clear();
    for (const notify of this.listeners) notify();
  }
}
export const sessionGuard = new SessionGuard();
