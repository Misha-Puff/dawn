/**
 * horizon-blocks Phase 13: Dawn-glue, NOT a Horizon port (serve-gate finding,
 * punchlist §3.4 FAIL 2026-07-06: Dawn's header cart bubble stayed flat after
 * hz adds — the pre-designed deferred listener, activated by the probe).
 *
 * Why Dawn needs it: Dawn's own add paths re-render #cart-icon-bubble via the
 * `sections` param on the /cart/add POST (cart-notification.js:60 /
 * cart.js:130). The ported Horizon form (hz-product-form.js) never populates
 * `sections` (it's sourced from cart-items-component ids, absent in Dawn —
 * see its header), so nothing refreshed the bubble. Rebuy Smart Cart
 * intercepts the add for its drawer but doesn't touch Dawn's bubble either.
 *
 * How: listen for the standard cart-lines-update event every hz add
 * dispatches (hz-product-form.js:448/:612, gift-card recipient path
 * included — the event bubbles to document, same channel quick-add.js
 * listens on); after its settle-promise resolves without error, refetch
 * Dawn's own sections/cart-icon-bubble.liquid via the Section Rendering API
 * and swap the anchor's innerHTML — byte-identical end state to Dawn's
 * native add path (cart-notification.js getSectionInnerHTML idiom).
 *
 * Loaded per-render (browser dedupes; module body runs once) by the three
 * hz add sources: snippets/quick-add.liquid, snippets/quick-add-modal.liquid,
 * blocks/buy-buttons.liquid.
 */
import { StandardEvents } from '@shopify/events';

const BUBBLE_ID = 'cart-icon-bubble';

async function refreshBubble() {
  const target = document.getElementById(BUBBLE_ID);
  if (!target) return;

  try {
    const root = window.Shopify?.routes?.root || '/';
    const response = await fetch(`${root}?section_id=${BUBBLE_ID}`);
    if (!response.ok) return;

    const html = await response.text();
    const section = new DOMParser().parseFromString(html, 'text/html').querySelector('.shopify-section');
    if (section) target.innerHTML = section.innerHTML;
  } catch (error) {
    // Non-fatal: the bubble catches up on the next full render.
    console.warn('[hz-cart-bubble-sync] refresh failed:', error);
  }
}

document.addEventListener(StandardEvents.cartLinesUpdate, (event) => {
  const promise = /** @type {{ promise?: Promise<{ detail?: { didError?: boolean } }> }} */ (event).promise;

  if (promise?.then) {
    promise
      .then((result) => {
        if (!result?.detail?.didError) refreshBubble();
      })
      .catch(() => {});
  } else {
    refreshBubble();
  }
});
