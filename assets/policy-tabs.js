/**
 * <policy-tabs> — scrollspy for the consolidated-policies jump-nav.
 *
 * The tabs are plain in-page anchors (fully functional without JS); this
 * element only maintains the active underline: the tab whose policy block is
 * nearest the top of the viewport gets aria-current="page", mirroring
 * <collection-tabs>' active-state contract so the shared tab styling applies.
 */
class PolicyTabs extends HTMLElement {
  connectedCallback() {
    this.tabs = Array.from(this.querySelectorAll('a[href^="#"]'));
    this.blocks = this.tabs
      .map((tab) => document.getElementById(decodeURIComponent(tab.getAttribute('href').slice(1))))
      .filter(Boolean);
    if (this.blocks.length < 2) return;

    this.onScroll = this.update.bind(this);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        // Reflect the choice immediately; the scroll handler re-syncs after the jump.
        this.setActive(tab);
      });
    });
    this.update();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll);
  }

  update() {
    // Active block = the last one whose top has passed the spy line (30% down
    // the viewport); before the first block, the first tab is active.
    const spyLine = window.innerHeight * 0.3;
    let activeIndex = 0;
    this.blocks.forEach((block, i) => {
      if (block.getBoundingClientRect().top <= spyLine) activeIndex = i;
    });
    this.setActive(this.tabs[activeIndex]);
  }

  setActive(activeTab) {
    this.tabs.forEach((tab) => {
      if (tab === activeTab) {
        tab.setAttribute('aria-current', 'page');
      } else {
        tab.removeAttribute('aria-current');
      }
    });
  }
}

customElements.define('policy-tabs', PolicyTabs);
