/**
 * <collection-tabs> — collection tab groups (content.tab_group). Each tab is a
 * real <a href>; this element progressively enhances the group so tabs update
 * the product grid IN PLACE instead of a full navigation. Two cases, keyed on
 * the tab's target path vs the current URL:
 *
 *   - Same collection (a filter tab: blank collection, or collection == current)
 *     → FacetFiltersForm.renderPage swaps the grid via the Section-Render API,
 *       exactly like applying a facet.
 *   - Different collection (a sibling / cross-collection tab, optionally with a
 *     pre-applied filter) → fetch the target's FULL page and swap
 *     #ProductGridContainer + the facet UI in place (no reload).
 *
 * The tabs render OUTSIDE #ProductGridContainer (so facet AJAX and the
 * Collection/Campaign toggle never disturb them), so the server re-render never
 * refreshes aria-current for us — we set it on click and recompute it from the
 * URL on load and on popstate.
 *
 * Progressive enhancement: with FacetFiltersForm absent, on a modifier / middle
 * click, on a campaign-view page, or on any fetch failure, the <a href> just
 * navigates. Loaded BEFORE facets.js so this file's popstate listener registers
 * first and can reconcile FacetFiltersForm's history state before facets' own
 * listener fires on a cross-collection back/forward (see the popstate handler).
 *
 * Guarded because the section can render more than once in the theme editor.
 */
if (!customElements.get('collection-tabs')) {
  // Path of the collection currently rendered in the grid. Only changes on a
  // cross-collection swap; same-collection filters keep the same path — this
  // lets popstate tell "changed collection" from "changed filters".
  let lastRenderedPath = window.location.pathname;
  let currentAbort = null;

  const originOf = (url) => new URL(url, window.location.origin);

  class CollectionTabs extends HTMLElement {
    connectedCallback() {
      this.onClick = this.onClick.bind(this);
      this.addEventListener('click', this.onClick);
      // SSR aria-current is best-effort (value/space encoding can differ from
      // the merchant's fragment) — recompute from the real URL on load.
      this.syncFromLocation();
    }

    get tabs() {
      return Array.from(this.querySelectorAll('a.collection-tabs__tab'));
    }

    onClick(event) {
      const link = event.target.closest('a.collection-tabs__tab');
      if (!link) return;
      // Let the browser open the href natively on new-tab / middle-click intents.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      // FacetFiltersForm is a top-level class declaration in facets.js — a global
      // lexical binding, not a window property. Absent → plain navigation.
      if (typeof FacetFiltersForm === 'undefined') return;
      if (link.getAttribute('aria-current') === 'page') {
        event.preventDefault();
        return; // already showing this view
      }

      const url = originOf(link.href);

      if (url.pathname === window.location.pathname) {
        // Same collection → filter in place via the Section-Render API.
        event.preventDefault();
        url.searchParams.delete('page');
        FacetFiltersForm.renderPage(url.searchParams.toString());
        this.setActive(link);
        return;
      }

      // Cross-collection → swap the grid in place, unless a campaign view is
      // present (its DOM lives outside #ProductGridContainer and wouldn't swap).
      if (document.querySelector('.collection-views')) return; // navigate
      event.preventDefault();
      CollectionTabs.swapCollection(link.href, { push: true, activeLink: link });
    }

    // Move aria-current onto the clicked tab and off its siblings. Required
    // because the tabs sit outside #ProductGridContainer, so a re-render never
    // touches them.
    setActive(activeLink) {
      this.tabs.forEach((link) => {
        if (link === activeLink) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    // Recompute the active tab from the current URL — on load and on back/forward.
    // Only a tab whose path matches the current path AND whose filter params
    // match can be active; at most ONE is marked. When two tabs resolve to the
    // same URL (a group shared across collections, where an "other" tab's
    // collection == the current one), the MOST SPECIFIC wins — a tab that
    // explicitly names a collection (data-explicit-collection) beats a
    // blank/implicit-current one; ties keep the first. Mirrors the SSR ranking.
    syncFromLocation() {
      const locKey = CollectionTabs.filterKey(new URLSearchParams(window.location.search));
      let best = null;
      let bestSpec = 0;
      this.tabs.forEach((link) => {
        const url = originOf(link.href);
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
    // the sorted filter.* pairs. Non-filter params (sort_by, q, page) are ignored
    // so a tab stays active regardless of sort order.
    static filterKey(searchParams) {
      const pairs = [];
      searchParams.forEach((value, key) => {
        if (key.startsWith('filter.')) pairs.push(`${key}=${value}`);
      });
      return pairs.sort().join('&');
    }
  }

  // Loading state mirrors FacetFiltersForm.renderPage's: show the facet spinners
  // and mark the grid + count containers .loading. Cleared automatically when the
  // swap replaces those elements below.
  CollectionTabs.showLoading = function () {
    document
      .querySelectorAll('.facets-container .loading__spinner, facet-filters-form .loading__spinner')
      .forEach((spinner) => spinner.classList.remove('hidden'));
    const grid = document.getElementById('ProductGridContainer');
    const collectionEl = grid && grid.querySelector('.collection');
    if (collectionEl) collectionEl.classList.add('loading');
    ['ProductCount', 'ProductCountDesktop'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add('loading');
    });
  };

  // Cross-collection in-place swap: fetch the target's FULL page, swap the grid
  // via the stock renderProductGridContainer, and replace the facet UI regions
  // wholesale. We fetch the full page (not ?section_id=…) because the target's
  // grid section id (template--<collectionId>__product-grid) isn't derivable from
  // here; renderProductGridContainer DOMParses the string and extracts the node,
  // so a full page works exactly like a section response, and the target's own
  // #ProductGridContainer carries its correct pagination.
  //
  // We deliberately do NOT reuse FacetFiltersForm.renderFilters: it does an
  // incremental per-.js-filter merge that assumes the fetched facets belong to
  // the SAME collection and throws (`…before()` on a null match) when the target
  // has different facet groups. Replacing each facet region's outerHTML re-parses
  // and re-upgrades every custom element inside (facet-filters-form / price-range
  // / facet-remove / menu-drawer / show-more-button) exactly as on initial page
  // load, so all listeners re-bind and filters/sort reset cleanly.
  CollectionTabs.swapCollection = async function (href, options) {
    const push = Boolean(options && options.push);
    const activeLink = options && options.activeLink;
    const target = originOf(href);

    if (currentAbort) currentAbort.abort();
    currentAbort = new AbortController();
    const signal = currentAbort.signal;

    CollectionTabs.showLoading();

    let text;
    try {
      const response = await fetch(href, { signal });
      if (!response.ok) throw new Error(response.status);
      text = await response.text();
    } catch (error) {
      if (error && error.name === 'AbortError') return; // superseded by a newer click
      window.location.href = href; // graceful fallback to full navigation
      return;
    }

    const parsedDoc = new DOMParser().parseFromString(text, 'text/html');
    if (!parsedDoc.getElementById('ProductGridContainer')) {
      window.location.href = href; // not a normal collection page
      return;
    }

    FacetFiltersForm.renderProductGridContainer(text);
    ['.facets-vertical-sort', '.facets-container'].forEach((selector) => {
      const current = document.querySelector(selector);
      const fetched = parsedDoc.querySelector(selector);
      if (current && fetched) current.outerHTML = fetched.outerHTML;
    });
    if (typeof initializeScrollAnimationTrigger === 'function') initializeScrollAnimationTrigger();

    lastRenderedPath = target.pathname;
    // Keep FacetFiltersForm's history bookkeeping consistent so a later
    // same-collection filter/sort — and its popstate — compare correctly.
    FacetFiltersForm.searchParamsPrev = target.search.slice(1);

    if (push) {
      history.pushState({ collectionTab: target.pathname, searchParams: target.search.slice(1) }, '', href);
    }

    const el = document.querySelector('collection-tabs');
    if (el) {
      if (activeLink) el.setActive(activeLink);
      else el.syncFromLocation();
      // Clean hook for a later Klaviyo/GA collection-view follow-up.
      el.dispatchEvent(new CustomEvent('collection:tab-changed', { bubbles: true, detail: { url: target.href } }));
    }

    if (push) {
      const nav = document.querySelector('.collection-tabs');
      if (nav) nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  customElements.define('collection-tabs', CollectionTabs);

  // Back/forward. Registered once, BEFORE facets.js's own popstate listener (this
  // script is loaded first) and only when tabs are present. facets.js keys history
  // purely off searchParams and assumes the collection path never changes; a
  // cross-collection pop would make it fetch the CURRENT grid's section id against
  // the popped-to path (a guaranteed 404 → it wipes the facet UI). We disarm that
  // by pre-setting searchParamsPrev to the exact value its handler computes, so it
  // early-returns, then swap ourselves. Same-collection pops (pure filter/sort)
  // keep the same path — facets.js restores the grid, we just re-sync the tab.
  if (document.querySelector('collection-tabs')) {
    window.addEventListener('popstate', (event) => {
      if (typeof FacetFiltersForm !== 'undefined' && window.location.pathname !== lastRenderedPath) {
        FacetFiltersForm.searchParamsPrev = event.state
          ? event.state.searchParams
          : FacetFiltersForm.searchParamsInitial;
        CollectionTabs.swapCollection(window.location.pathname + window.location.search, { push: false });
        return;
      }
      const el = document.querySelector('collection-tabs');
      if (el) el.syncFromLocation();
    });
  }
}
