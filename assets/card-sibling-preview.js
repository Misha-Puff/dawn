/**
 * <sibling-swatches> — click-to-preview colorway swatches on product cards.
 *
 * Wraps the swatch row rendered by snippets/product-sibling-swatches.liquid.
 * Clicking a swatch swaps the card in place (image, title, price, link, size
 * overlay availability) to the sibling product using the swatch's
 * server-rendered payloads; clicking the card's own swatch restores it. While
 * a sibling is previewed the card root carries `card--sibling-preview`, which
 * hides quick-add and badges (they still describe the original product); the
 * size overlay stays up with the sibling's own availability when its payload
 * exists (`card--sibling-availability`), else it hides too. Swatches without
 * a payload (no featured image) keep their default link navigation, as does
 * everything when JS is unavailable.
 */
if (!customElements.get('sibling-swatches')) {
  customElements.define(
    'sibling-swatches',
    class SiblingSwatches extends HTMLElement {
      connectedCallback() {
        this.addEventListener('click', this.onClick);
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onClick);
      }

      onClick = (event) => {
        const swatch = event.target.closest('a.card__swatch');
        if (!swatch || !this.contains(swatch) || !swatch.dataset.swapUrl) return;

        const card = this.closest('.card-wrapper');
        if (!card) return;

        event.preventDefault();

        const media = card.querySelector('.card__media .media');
        if (media) {
          const images = media.querySelectorAll('img');
          const primary = images[0];
          const secondary = images[1];
          if (primary) {
            primary.srcset = swatch.dataset.swapImgSrcset || '';
            primary.src = swatch.dataset.swapImgSrc;
            primary.alt = swatch.dataset.swapImgAlt || '';
          }
          if (secondary) {
            if (swatch.dataset.swapImg2Src) {
              secondary.srcset = swatch.dataset.swapImg2Srcset || '';
              secondary.src = swatch.dataset.swapImg2Src;
              secondary.hidden = false;
            } else {
              secondary.hidden = true;
            }
          }
        }

        card.querySelectorAll('.card__heading a.full-unstyled-link, a.full-unstyled-link[aria-labelledby^="CardLink"]').forEach((link) => {
          link.href = swatch.dataset.swapUrl;
        });
        // Both headings (Dawn renders a hidden no-media fallback first) — the
        // first-match-only update left the visible title stale during preview.
        card.querySelectorAll('.card__heading a.full-unstyled-link').forEach((link) => {
          link.textContent = swatch.dataset.swapTitle || link.textContent;
        });

        const payload = swatch.querySelector('template.card__swatch-payload');
        const price = card.querySelector('.card__heading-row > .price');
        if (payload && price) {
          const next = payload.content.firstElementChild;
          if (next) price.replaceWith(next.cloneNode(true));
        }

        // Size overlay follows the previewed colorway: swap in the sibling's
        // server-rendered availability. Without a payload (excluded type,
        // default-variant-only sibling) the overlay stays hidden via the
        // card--sibling-availability class gate in component-card.css.
        const availability = swatch.querySelector('template.card__swatch-availability');
        const overlay = card.querySelector('.popup-overlay');
        let availabilitySwapped = false;
        if (availability && overlay) {
          const next = availability.content.firstElementChild;
          const current = overlay.querySelector('.variant-availability');
          if (next && current) {
            current.replaceWith(next.cloneNode(true));
            availabilitySwapped = true;
          }
        }

        card.classList.toggle('card--sibling-preview', swatch.dataset.swapSelf !== 'true');
        card.classList.toggle('card--sibling-availability', availabilitySwapped);
        this.querySelectorAll('.card__swatch--current').forEach((current) => {
          current.classList.remove('card__swatch--current');
          current.removeAttribute('aria-current');
        });
        swatch.classList.add('card__swatch--current');
        swatch.setAttribute('aria-current', 'true');
      };
    }
  );
}
