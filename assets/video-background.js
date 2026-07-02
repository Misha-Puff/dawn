/* horizon-blocks Phase 2 — <video-background-component>.
 *
 * Dawn rewrite of stock Horizon v4.1.1 (68760d9) assets/video-background.js.
 * Upstream extends Component from '@theme/component' (an importmap module
 * system Dawn lacks) and reads declarative refs; this plain HTMLElement does
 * the same two things: copy each deferred data-video-source onto its <source>
 * and (re)load the video, so the browser only fetches sources once the
 * element is actually connected.
 *
 * Loaded via a per-render defer script tag from snippets/background-media.liquid
 * (Dawn's per-component pattern). The class stays an inline expression inside
 * the guard: duplicate tags re-execute the file, and a top-level class
 * declaration would throw on redeclaration before the guard could run.
 */
if (!customElements.get('video-background-component')) {
  customElements.define(
    'video-background-component',
    class VideoBackgroundComponent extends HTMLElement {
      connectedCallback() {
        this.querySelectorAll('source[data-video-source]').forEach((source) => {
          source.setAttribute('src', source.dataset.videoSource);
        });
        this.querySelector('video')?.load();
      }
    }
  );
}
