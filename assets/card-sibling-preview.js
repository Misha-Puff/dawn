/**
 * <sibling-swatches> — click-to-preview colorway swatches on product cards.
 *
 * Wraps the swatch row rendered by snippets/product-sibling-swatches.liquid.
 * Clicking a swatch swaps the card in place (image, title, price, link, size
 * overlay availability, quick-add target) to the sibling product using the
 * swatch's server-rendered payloads; clicking the card's own swatch restores
 * it. While a sibling is previewed the card root carries
 * `card--sibling-preview`; badges follow the previewed colorway via the
 * swatch's server-rendered badge payload (`card--sibling-badges`), the size
 * overlay stays up with the sibling's own availability when its payload
 * exists (`card--sibling-availability`) and quick add stays up retargeted
 * at the sibling's product URL (`card--sibling-quick-add`) — each hides
 * instead when its swap couldn't happen. Swatches without a payload (no featured image) keep their default
 * link navigation, as does everything when JS is unavailable.
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

        // Badges follow the previewed colorway: swap in the sibling's
        // server-rendered badge row (sale, RWS, made-to-order, custom tags).
        // Without a payload the row hides via the card--sibling-badges class
        // gate in component-card.css — a stale badge never describes the
        // wrong product.
        const badgesPayload = swatch.querySelector('template.card__swatch-badges');
        const badgeRow = card.querySelector('.card__badges');
        let badgesSwapped = false;
        if (badgesPayload && badgeRow) {
          const next = badgesPayload.content.firstElementChild;
          if (next) {
            badgeRow.replaceWith(next.cloneNode(true));
            badgesSwapped = true;
          }
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

        // Quick add follows the previewed colorway too. Modal path: the
        // standard quick-add modal fetches its content from the opener's
        // data-product-url on every open, so retargeting that URL is all it
        // takes. Direct-form path (single-variant card): swap the form's
        // variant id to the sibling's (carried on the swatch) and mirror its
        // availability on the submit button — but only when the sibling is
        // itself direct-capable (single variant, no quantity rules); a sized
        // sibling has no picker here, so the card keeps the preview-state
        // hide via the class gate below.
        let quickAddSwapped = false;
        const quickAddOpener = card.querySelector('modal-opener[data-modal^="#QuickAdd-"] [data-product-url]');
        if (quickAddOpener) {
          quickAddOpener.setAttribute('data-product-url', swatch.dataset.swapUrl);
          quickAddSwapped = true;
        } else if (swatch.dataset.swapDirect === 'true' && swatch.dataset.swapVariantId) {
          const directForm = card.querySelector('.quick-add product-form');
          const directInput = directForm && directForm.querySelector('.product-variant-id');
          const directButton = directForm && directForm.querySelector('.quick-add__submit');
          if (directInput && directButton) {
            directInput.value = swatch.dataset.swapVariantId;
            directButton.disabled = swatch.dataset.swapAvailable === 'false';
            quickAddSwapped = true;
          }
        }

        card.classList.toggle('card--sibling-preview', swatch.dataset.swapSelf !== 'true');
        card.classList.toggle('card--sibling-badges', badgesSwapped);
        card.classList.toggle('card--sibling-availability', availabilitySwapped);
        card.classList.toggle('card--sibling-quick-add', quickAddSwapped);
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
