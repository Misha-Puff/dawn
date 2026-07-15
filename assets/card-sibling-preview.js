/**
 * <sibling-swatches> — click-to-preview colorway swatches on product cards.
 *
 * Wraps the swatch row rendered by snippets/product-sibling-swatches.liquid.
 * Clicking a swatch swaps the card in place (image, title, price, link) to the
 * sibling product using the swatch's server-rendered payload; clicking the
 * card's own swatch restores it. While a sibling is previewed the card root
 * carries `card--sibling-preview`, which hides quick-add, badges and the
 * availability strip (they still describe the original product). Swatches
 * without a payload (no featured image) keep their default link navigation,
 * as does everything when JS is unavailable.
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
        const titleLink = card.querySelector('.card__heading a.full-unstyled-link');
        if (titleLink) titleLink.textContent = swatch.dataset.swapTitle || titleLink.textContent;

        const payload = swatch.querySelector('template.card__swatch-payload');
        const price = card.querySelector('.card__heading-row > .price');
        if (payload && price) {
          const next = payload.content.firstElementChild;
          if (next) price.replaceWith(next.cloneNode(true));
        }

        card.classList.toggle('card--sibling-preview', swatch.dataset.swapSelf !== 'true');
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
