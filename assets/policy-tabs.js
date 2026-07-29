/**
 * <policy-tabs> — tab switcher for policy content.
 *
 * Runs in two contexts with one code path: on the consolidated policies page
 * tab hrefs are #<slug> anchors, on the /policies/* pages they are the real
 * sibling policy URLs. Each tab carries data-slug matching its panel's id;
 * exactly one .policy-block panel is shown at a time (the rest carry
 * [hidden]). Clicking a tab swaps panels and history.replaceState's the tab's
 * href — keeping the hash in sync on the consolidated page and the canonical
 * /policies/<slug> path on policy pages — so deep links open the matching tab
 * (hash wins over path) and hashchange re-syncs. Without JS a noscript style
 * unhides every panel and the tabs fall back to plain links. The active tab
 * carries aria-current="page", mirroring <collection-tabs>' contract so the
 * shared tab styling applies.
 */
class PolicyTabs extends HTMLElement {
  connectedCallback() {
    this.tabs = Array.from(this.querySelectorAll('a[data-slug]'));
    this.slugs = this.tabs.map((tab) => tab.dataset.slug);
    this.panels = this.slugs.map((slug) => document.getElementById(slug)).filter(Boolean);
    if (this.panels.length < 2 || this.panels.length !== this.tabs.length) return;

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

    this.onHashChange = () => this.selectFromLocation();
    window.addEventListener('hashchange', this.onHashChange);
    this.selectFromLocation();
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.onHashChange);
  }

  selectFromLocation() {
    const hashSlug = decodeURIComponent(window.location.hash.slice(1));
    const pathSlug = decodeURIComponent(window.location.pathname.split('/').pop());
    let index = this.slugs.indexOf(hashSlug);
    if (index === -1) index = this.slugs.indexOf(pathSlug);
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
