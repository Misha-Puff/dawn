if (!customElements.get('recently-viewed-products')) {
  customElements.define(
    'recently-viewed-products',
    class RecentlyViewedProducts extends HTMLElement {
      observer = undefined;

      connectedCallback() {
        let entries = [];
        try {
          entries = JSON.parse(localStorage.getItem('MPRecentlyViewed')) || [];
        } catch (e) {
          entries = [];
        }
        if (!Array.isArray(entries)) entries = [];

        const seen = new Set();
        const ids = [];
        entries.forEach((entry) => {
          const id = entry && entry.productID ? String(entry.productID) : '';
          if (!id || id === this.dataset.currentProductId || seen.has(id)) return;
          seen.add(id);
          ids.push(id);
        });

        const maxProducts = parseInt(this.dataset.productsToShow, 10);
        this.productIds = maxProducts > 0 ? ids.slice(0, maxProducts) : ids;

        if (!this.productIds.length) {
          this.hideSection();
          return;
        }

        this.observer?.unobserve(this);
        this.observer = new IntersectionObserver(
          (ioEntries, observer) => {
            if (!ioEntries[0].isIntersecting) return;
            observer.unobserve(this);
            this.loadCards();
          },
          { rootMargin: '0px 0px 400px 0px' }
        );
        this.observer.observe(this);
      }

      loadCards() {
        const query = this.productIds.map((id) => `id:${id}`).join(' OR ');
        const url = `${this.dataset.searchUrl}?section_id=recently-viewed-cards&type=product&options%5Bunavailable_products%5D=show&q=${encodeURIComponent(
          query
        )}`;

        fetch(url)
          .then((response) => {
            if (!response.ok) throw new Error(`Recently viewed fetch failed: ${response.status}`);
            return response.text();
          })
          .then((text) => {
            const html = new DOMParser().parseFromString(text, 'text/html');
            const cards = new Map();
            html.querySelectorAll('li[data-product-id]').forEach((li) => cards.set(li.dataset.productId, li));

            const slider = this.querySelector('[id^="Slider-"]');
            let index = 0;
            this.productIds.forEach((id) => {
              const card = cards.get(id);
              if (!card) return;
              card.id = `Slide-${this.dataset.sectionId}-${index}`;
              slider.appendChild(card);
              index++;
            });

            if (!index) {
              this.hideSection();
              return;
            }

            customElements.whenDefined('slider-component').then(() => {
              this.querySelector('slider-component')?.resetPages();
            });
          })
          .catch(() => {
            this.hideSection();
          });
      }

      hideSection() {
        const section = this.closest('.shopify-section');
        if (section) section.style.display = 'none';
      }
    }
  );
}
