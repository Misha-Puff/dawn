/**
 * <search-tabs> — search tier tabs backed by the Search & Discovery "Line"
 * filter (filter.p.m.taxonomy.division). Two modes, keyed by data-context:
 *
 * - "results": SSR'd <a> tabs inside #ProductGridContainer on /search.
 *   Clicks route through FacetFiltersForm.renderPage() (same flow as facet
 *   pills) so the grid re-renders without a full reload. When the page loads
 *   with a tier active, the ALL count is backfilled with one probe fetch.
 * - "modal": <button> tabs inside the header quick-search modal. Counts come
 *   from tiny Section Rendering API probes (sections/search-tab-counts.liquid);
 *   tier product lists from sections/search-modal-results.liquid. The ALL tab
 *   restores the untouched predictive markup.
 *
 * Probe/result responses are cached per URL in static Maps shared across
 * instances (the header renders two modal instances). The whole file is
 * guarded because header-search.liquid emits the script tag once per modal
 * instance (and main-search.liquid once more on /search).
 */
if (!customElements.get('search-tabs')) {
  class SearchTabs extends HTMLElement {
    connectedCallback() {
      this.context = this.dataset.context;
      this.searchUrl = this.dataset.searchUrl || '/search';
      this.filterParam = this.dataset.filterParam || 'filter.p.m.taxonomy.division';
      this.showCounts = !this.hasAttribute('data-hide-counts');

      if (this.context === 'modal') {
        this.initModal();
      } else {
        this.initResults();
      }
    }

    disconnectedCallback() {
      if (this.abortController) this.abortController.abort();
      if (this.openObserver) this.openObserver.disconnect();
    }

    /* -------------------------------- shared -------------------------------- */

    // Shopify-side re-serialization (seen from the live theme's app-rendered
    // search) can turn options[prefix]=last into a single mangled
    // options={"prefix" => "last"} param; hrefs derived from such a URL
    // propagate it. Normalize back to the canonical form so tab clicks and
    // probes self-heal the URL.
    static cleanParams(searchParams) {
      if (searchParams.has('options')) {
        searchParams.delete('options');
        searchParams.set('options[prefix]', 'last');
      }
      return searchParams;
    }

    countUrl(term, value) {
      const params = new URLSearchParams();
      params.set('q', term);
      params.set('options[prefix]', 'last');
      if (value) params.set(this.filterParam, value);
      params.set('section_id', 'search-tab-counts');
      return `${this.searchUrl}?${params.toString()}`;
    }

    resultsUrl(term, value) {
      const params = new URLSearchParams();
      params.set('q', term);
      params.set('options[prefix]', 'last');
      params.set(this.filterParam, value);
      params.set('section_id', 'search-modal-results');
      return `${this.searchUrl}?${params.toString()}`;
    }

    fetchCount(url, signal) {
      if (SearchTabs.countsCache.has(url)) return Promise.resolve(SearchTabs.countsCache.get(url));
      return fetch(url, signal ? { signal } : undefined)
        .then((response) => {
          if (!response.ok) throw new Error(response.status);
          return response.text();
        })
        .then((text) => {
          const countElement = new DOMParser().parseFromString(text, 'text/html').querySelector('[data-tab-count]');
          const count = countElement ? parseInt(countElement.textContent, 10) || 0 : 0;
          SearchTabs.countsCache.set(url, count);
          return count;
        });
    }

    paintCount(button, count) {
      if (this.showCounts) {
        const countSpan = button.querySelector('[data-count]');
        if (countSpan) countSpan.textContent = `(${count})`;
      }
      // Every tier tab hides at 0 results; the active tab stays visible so an
      // empty composed view (tier + facets) keeps its escape hatch.
      if (button.dataset.tabValue) {
        const isActive =
          button.getAttribute('aria-pressed') === 'true' || button.getAttribute('aria-current') === 'page';
        button.hidden = count === 0 && !isActive;
      }
    }

    /* -------------------------------- modal --------------------------------- */

    initModal() {
      this.parent = this.closest('predictive-search');
      this.form = this.closest('form');
      if (!this.parent || !this.form) return;

      this.tabButtons = Array.from(this.querySelectorAll('button.search-tabs__tab'));
      this.activeValue = '';
      this.currentTerm = '';
      this.savedAllList = null;

      this.parent.addEventListener('predictive-search:rendered', this.onPredictiveRendered.bind(this));
      this.form.addEventListener('reset', () => this.resetToAll(false));
      this.addEventListener('click', (event) => {
        const button = event.target.closest('button.search-tabs__tab');
        if (button) this.onTabClick(button);
      });
      // "Show all results" button inside an injected zero-result state
      this.parent.addEventListener('click', (event) => {
        if (event.target.closest('.search-tabs__show-all')) this.resetToAll(true);
      });
      // Closing the modal resets to ALL so a reopen shows a consistent state
      this.openObserver = new MutationObserver(() => {
        if (!this.parent.hasAttribute('open') && this.activeValue) this.resetToAll(true);
      });
      this.openObserver.observe(this.parent, { attributes: true, attributeFilter: ['open'] });
    }

    onPredictiveRendered(event) {
      // Fresh predictive markup IS the ALL list — reset tab state to match it
      this.savedAllList = null;
      this.setActiveState('');
      this.currentTerm = ((event.detail && event.detail.term) || '').trim();
      if (!this.currentTerm) return;
      this.refreshCounts(this.currentTerm);
    }

    refreshCounts(term) {
      if (this.abortController) this.abortController.abort();
      this.abortController = new AbortController();
      const signal = this.abortController.signal;

      const values = [''].concat(
        this.tabButtons.map((button) => button.dataset.tabValue).filter((value) => value)
      );
      values.forEach((value) => {
        const button = this.buttonFor(value);
        if (!button) return;
        this.fetchCount(this.countUrl(term, value), signal)
          .then((count) => {
            if (this.currentTerm === term) this.paintCount(button, count);
          })
          .catch(() => {});
      });
    }

    buttonFor(value) {
      return this.tabButtons.find((button) => (button.dataset.tabValue || '') === value);
    }

    productsList() {
      // Scoped to this instance — both modal copies render the same list id
      return this.parent.querySelector('#predictive-search-results-products-list');
    }

    onTabClick(button) {
      const value = button.dataset.tabValue || '';
      if (value === this.activeValue) return;
      if (!value) {
        this.resetToAll(true);
        this.announce(button.textContent.trim());
        return;
      }
      const term = this.currentTerm;
      const list = this.productsList();
      if (!term || !list) return;
      if (this.savedAllList === null) this.savedAllList = list.innerHTML;

      const url = this.resultsUrl(term, value);
      const cached = SearchTabs.resultsCache.get(url);
      if (cached) {
        this.applyTierResults(value, cached);
        return;
      }
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(response.status);
          return response.text();
        })
        .then((text) => {
          const doc = new DOMParser().parseFromString(text, 'text/html');
          const countElement = doc.querySelector('[data-tab-count]');
          const count = countElement ? parseInt(countElement.textContent, 10) || 0 : 0;
          const items = doc.querySelectorAll('li.predictive-search__list-item');
          const payload = { listHTML: Array.from(items).map((item) => item.outerHTML).join(''), count };
          SearchTabs.resultsCache.set(url, payload);
          // A tier fetch doubles as that tier's count probe
          SearchTabs.countsCache.set(this.countUrl(term, value), count);
          if (this.currentTerm === term) this.applyTierResults(value, payload);
        })
        .catch(() => {});
    }

    applyTierResults(value, payload) {
      const list = this.productsList();
      const button = this.buttonFor(value);
      if (!list || !button) return;
      // Activate BEFORE painting the count: paintCount hides zero-count tabs
      // unless active, and a just-clicked tier must never hide itself.
      this.setActiveState(value);
      this.paintCount(button, payload.count);
      list.innerHTML = payload.listHTML || this.emptyStateHTML(value);
      this.announce(`${value} (${payload.count})`);
    }

    resetToAll(restoreList) {
      if (restoreList && this.savedAllList !== null) {
        const list = this.productsList();
        if (list) list.innerHTML = this.savedAllList;
      }
      this.setActiveState('');
    }

    setActiveState(value) {
      this.activeValue = value;
      if (this.tabButtons) {
        this.tabButtons.forEach((button) => {
          button.setAttribute('aria-pressed', String((button.dataset.tabValue || '') === value));
        });
      }
      this.syncHiddenInput(value);
    }

    // Keeps a hidden division input in the search form while a tier is active
    // so Enter / "Search for …" lands on /search with the tab preserved.
    syncHiddenInput(value) {
      let input = this.form.querySelector(`input[name="${this.filterParam}"]`);
      if (value) {
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = this.filterParam;
          this.form.appendChild(input);
        }
        input.value = value;
      } else if (input) {
        input.remove();
      }
    }

    emptyStateHTML(value) {
      const template = this.querySelector('[data-search-tabs-empty-template]');
      if (!template || !template.content.firstElementChild) return '';
      const item = template.content.firstElementChild.cloneNode(true);
      const message = (this.dataset.emptyText || '').replace('__LABEL__', value).replace('__TERMS__', this.currentTerm);
      const messageElement = item.querySelector('[data-empty-message]');
      if (messageElement) messageElement.textContent = message;
      return item.outerHTML;
    }

    announce(text) {
      if (this.parent && typeof this.parent.setLiveRegionText === 'function' && this.parent.statusElement) {
        this.parent.setLiveRegionText(text);
      }
    }

    /* ------------------------------- results -------------------------------- */

    initResults() {
      this.addEventListener('click', (event) => {
        const link = event.target.closest('a.search-tabs__tab');
        if (!link) return;
        // FacetFiltersForm is a top-level class declaration in facets.js — a
        // global lexical binding, not a window property.
        if (typeof FacetFiltersForm === 'undefined') return; // fall back to plain navigation
        event.preventDefault();
        if (link.getAttribute('aria-current') === 'page') return;
        const url = new URL(link.href, window.location.origin);
        url.searchParams.delete('page');
        SearchTabs.cleanParams(url.searchParams);
        FacetFiltersForm.renderPage(url.searchParams.toString());
      });
      this.refreshResultsCounts();
    }

    // SSR can only trust results_count for the CURRENT view: value.count
    // proved unreliable on this store (serve-verified 223 vs 417 actual for
    // Child), so every non-active tab count — including ALL when a tier is
    // active — is probed. Each probe derives from the tab's own href so other
    // active facets stay in scope; responses are cached per URL.
    refreshResultsCounts() {
      Array.from(this.querySelectorAll('a.search-tabs__tab')).forEach((link) => {
        const span = link.querySelector('[data-count], [data-all-count-pending]');
        if (!span || span.textContent) return;
        const url = new URL(link.href, window.location.origin);
        url.searchParams.delete('page');
        SearchTabs.cleanParams(url.searchParams);
        url.searchParams.set('section_id', 'search-tab-counts');
        this.fetchCount(url.toString())
          .then((count) => {
            span.textContent = `(${count})`;
            if (link.dataset.tabValue) {
              link.hidden = count === 0 && link.getAttribute('aria-current') !== 'page';
            }
          })
          .catch(() => {});
      });
    }
  }

  SearchTabs.countsCache = new Map();
  SearchTabs.resultsCache = new Map();

  customElements.define('search-tabs', SearchTabs);
}
