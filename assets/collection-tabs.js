/**
 * <collection-tabs> — lateral collection tabs that either filter the CURRENT
 * collection in place (AJAX grid swap via FacetFiltersForm.renderPage, no
 * reload) or link to another collection with a filter pre-applied. Mixed freely
 * within one tab group. This generalizes the search-tabs "results" flow
 * (assets/search-tabs.js initResults) to collection pages.
 *
 * The tabs are rendered OUTSIDE #ProductGridContainer (so facet AJAX and the
 * Collection/Campaign toggle never disturb them), which means the server
 * re-render never refreshes their aria-current for us — this element sets it
 * itself on click and recomputes it from the URL on load and on popstate.
 *
 * Graceful degradation: with facets.js / FacetFiltersForm absent, every tab is
 * a plain <a> and the browser just navigates.
 *
 * Guarded because the section can render more than once in the theme editor.
 */
if (!customElements.get('collection-tabs')) {
  class CollectionTabs extends HTMLElement {
    connectedCallback() {
      this.onClick = this.onClick.bind(this);
      this.onPopState = this.syncFromLocation.bind(this);
      this.addEventListener('click', this.onClick);
      window.addEventListener('popstate', this.onPopState);
      // SSR aria-current is best-effort (value/space encoding can differ from
      // the merchant's fragment) — recompute from the real URL on load.
      this.syncFromLocation();
    }

    disconnectedCallback() {
      window.removeEventListener('popstate', this.onPopState);
    }

    get tabs() {
      return Array.from(this.querySelectorAll('a.collection-tabs__tab'));
    }

    onClick(event) {
      const link = event.target.closest('a.collection-tabs__tab');
      if (!link) return;
      // FacetFiltersForm is a top-level class declaration in facets.js — a
      // global lexical binding, not a window property.
      if (typeof FacetFiltersForm === 'undefined') return; // no in-place filtering → browser navigates
      const url = new URL(link.href, window.location.origin);
      // A tab pointing at another collection stays a plain full-page link.
      if (url.pathname !== window.location.pathname) return;
      // Same collection → always handle in place, never a full reload.
      event.preventDefault();
      if (link.getAttribute('aria-current') === 'page') return; // already showing this view
      url.searchParams.delete('page');
      FacetFiltersForm.renderPage(url.searchParams.toString());
      this.setActive(link);
    }

    // Move aria-current onto the clicked tab and off its siblings. Required
    // because the tabs sit outside #ProductGridContainer, so the facet
    // re-render never touches them.
    setActive(activeLink) {
      this.tabs.forEach((link) => {
        if (link === activeLink) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    // Recompute the active tab by comparing each tab's filter params to the
    // current URL's — used on load and on back/forward. Only a same-path tab
    // (a current-collection filter) can be active; cross-collection tabs never
    // are on this page. At most ONE tab is marked active: when two tabs resolve
    // to the same URL (a group shared across collections, where an "other" tab's
    // collection == the current one), the MOST SPECIFIC wins — a tab that
    // explicitly names this collection (data-explicit-collection) beats a
    // blank/implicit-current one; ties keep the first. Mirrors the SSR ranking.
    syncFromLocation() {
      const locKey = CollectionTabs.filterKey(new URLSearchParams(window.location.search));
      let best = null;
      let bestSpec = 0;
      this.tabs.forEach((link) => {
        const url = new URL(link.href, window.location.origin);
        if (url.pathname !== window.location.pathname) return;
        if (CollectionTabs.filterKey(url.searchParams) !== locKey) return;
        const spec = link.hasAttribute('data-explicit-collection') ? 2 : 1;
        if (spec > bestSpec) {
          bestSpec = spec;
          best = link;
        }
      });
      this.tabs.forEach((link) => {
        if (link === best) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    // Order-independent representation of the facet filters in a query string:
    // the sorted filter.* pairs. Non-filter params (sort_by, q, page) are
    // ignored so a tab stays active regardless of sort order.
    static filterKey(searchParams) {
      const pairs = [];
      searchParams.forEach((value, key) => {
        if (key.startsWith('filter.')) pairs.push(`${key}=${value}`);
      });
      return pairs.sort().join('&');
    }
  }

  customElements.define('collection-tabs', CollectionTabs);
}
