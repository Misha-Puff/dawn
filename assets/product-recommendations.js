/**
 * horizon-blocks Phase 12: adapted port of Horizon 68760d9 assets/product-recommendations.js.
 *
 * Dawn deviation (the ONLY one — class body byte-verbatim): the custom element
 * registers as `hz-product-recommendations` instead of stock
 * `product-recommendations` (source lines 153–154). Dawn's assets/global.js:1177
 * already owns the `product-recommendations` tag for its own — architecturally
 * different, innerHTML-swap — recommendations class (consumed by
 * sections/related-products.liquid and main-product.liquid's complementary slot).
 * Stock's define is guarded by `customElements.get(...)`, so under the collision
 * this module would silently SKIP registration and Dawn's class would drive the
 * ported markup; the rename keeps the two systems fully disjoint. (hz- element
 * rename precedent: media.js:154 hz-deferred-media, slideshow.js:950
 * hz-slideshow-component.)
 *
 * Consumers: sections/hz-product-recommendations.liquid +
 * blocks/product-recommendations.liquid (Phase 12) — both emit
 * <hz-product-recommendations>.
 */
import { Component } from '@theme/component';
import { morphSection } from '@theme/section-renderer';

class ProductRecommendations extends Component {
  /**
   * The observer for the product recommendations
   * @type {IntersectionObserver}
   */
  #intersectionObserver = new IntersectionObserver(
    (entries, observer) => {
      if (!entries[0]?.isIntersecting) return;

      observer.disconnect();
      this.#loadRecommendations();
    },
    { rootMargin: '0px 0px 400px 0px' }
  );

  /**
   * Observing changes to the elements attributes
   * @type {MutationObserver}
   */
  #mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Only attribute changes are interesting
      if (mutation.target !== this || mutation.type !== 'attributes') continue;

      // Ignore error attribute changes
      if (mutation.attributeName === 'data-error') continue;

      // Ignore addition of hidden class because it means there's an error with the display
      if (mutation.attributeName === 'class' && this.classList.contains('hidden')) continue;

      // Ignore when the data-recommendations-performed attribute has been set to 'true'
      if (
        mutation.attributeName === 'data-recommendations-performed' &&
        this.dataset.recommendationsPerformed === 'true'
      )
        continue;

      // All other attribute changes trigger a reload
      this.#loadRecommendations();
      break;
    }
  });

  /**
   * The cached recommendations
   * @type {Record<string, string>}
   */
  #cachedRecommendations = {};

  /**
   * An abort controller for the active fetch (if there is one)
   * @type {AbortController | null}
   */
  #activeFetch = null;

  connectedCallback() {
    super.connectedCallback();
    this.#intersectionObserver.observe(this);
    this.#mutationObserver.observe(this, { attributes: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#intersectionObserver.disconnect();
    this.#mutationObserver.disconnect();
  }

  /**
   * Load the product recommendations
   */
  #loadRecommendations() {
    const { productId, recommendationsPerformed, sectionId, intent } = this.dataset;

    if (!productId || !sectionId) {
      throw new Error('Product ID and a section ID are required');
    }

    // If the recommendations have already been loaded, accounts for the case where the Theme Editor
    // is loaded the section from the editor's visual preview context.
    if (recommendationsPerformed === 'true') {
      return;
    }

    this.#fetchCachedRecommendations(productId, sectionId, intent)
      .then((result) => {
        if (!result.success) {
          // The Theme Editor will place a section element element in the DOM whose section_id is not available
          // to the Section Renderer API. In this case, we can safely ignore the error.
          if (!Shopify.designMode) {
            this.#handleError(new Error(`Server returned ${result.status}`));
          }
          return;
        }

        if (result.data?.trim().length) {
          this.dataset.recommendationsPerformed = 'true';
          morphSection(sectionId, result.data, { mode: 'hydration', injectStylesheet: true });
        } else {
          this.#handleError(new Error('No recommendations available'));
        }
      })
      .catch((e) => {
        this.#handleError(e);
      });
  }

  /**
   * Fetches the recommendations and cached the result for future use
   * @param {string} productId
   * @param {string | undefined} sectionId
   * @param {string | undefined} intent
   * @returns {Promise<{ success: true, data: string } | { success: false, status: number }>}
   */
  async #fetchCachedRecommendations(productId, sectionId, intent) {
    const url = `${this.dataset.url}&product_id=${productId}&section_id=${sectionId}&intent=${intent}`;

    const cachedResponse = this.#cachedRecommendations[url];
    if (cachedResponse) {
      return { success: true, data: cachedResponse };
    }

    this.#activeFetch?.abort();
    this.#activeFetch = new AbortController();

    try {
      const response = await fetch(url, { signal: this.#activeFetch.signal });
      if (!response.ok) {
        return { success: false, status: response.status };
      }

      const text = await response.text();
      this.#cachedRecommendations[url] = text;
      return { success: true, data: text };
    } finally {
      this.#activeFetch = null;
    }
  }

  /**
   * Handle errors in a consistent way
   * @param {Error} error
   */
  #handleError(error) {
    console.error('Product recommendations error:', error.message);
    this.classList.add('hidden');
    this.dataset.error = 'Error loading product recommendations';
  }
}

if (!customElements.get('hz-product-recommendations')) {
  customElements.define('hz-product-recommendations', ProductRecommendations);
}
