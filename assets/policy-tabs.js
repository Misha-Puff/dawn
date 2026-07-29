/**
 * <policy-tabs> — tab switcher for the consolidated-policies page.
 *
 * Each tab is an in-page anchor to a .policy-block panel; exactly one panel is
 * shown at a time (the rest carry [hidden], server-rendered with the first
 * visible). Clicking a tab swaps panels and rewrites the URL hash so
 * /pages/policies#<slug> deep links — including the /policies/* redirects —
 * open the matching tab; hashchange (back/forward, in-page links) re-syncs.
 * Without JS a noscript style unhides every panel and the tabs fall back to
 * plain anchor jumps. The active tab carries aria-current="page", mirroring
 * <collection-tabs>' contract so the shared tab styling applies.
 */
class PolicyTabs extends HTMLElement {
  connectedCallback() {
    this.tabs = Array.from(this.querySelectorAll('a[href^="#"]'));
    this.panels = this.tabs
      .map((tab) => document.getElementById(decodeURIComponent(tab.getAttribute('href').slice(1))))
      .filter(Boolean);
    if (this.panels.length < 2) return;

    this.tabs.forEach((tab, i) => {
      tab.addEventListener('click', (event) => {
        event.preventDefault();
        this.select(i);
        history.replaceState(null, '', tab.getAttribute('href'));
        // A tall previous panel can leave the viewport stranded below the
        // swapped-in content; pull the tab row back into view if it's above.
        if (this.getBoundingClientRect().top < 0) this.scrollIntoView();
      });
    });

    this.onHashChange = () => this.selectFromHash();
    window.addEventListener('hashchange', this.onHashChange);
    this.selectFromHash();
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.onHashChange);
  }

  selectFromHash() {
    const slug = decodeURIComponent(window.location.hash.slice(1));
    const index = this.panels.findIndex((panel) => panel.id === slug);
    this.select(index === -1 ? 0 : index);
  }

  select(activeIndex) {
    this.panels.forEach((panel, i) => {
      panel.toggleAttribute('hidden', i !== activeIndex);
    });
    this.tabs.forEach((tab, i) => {
      if (i === activeIndex) {
        tab.setAttribute('aria-current', 'page');
      } else {
        tab.removeAttribute('aria-current');
      }
    });
  }
}

customElements.define('policy-tabs', PolicyTabs);
