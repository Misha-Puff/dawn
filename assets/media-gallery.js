if (!customElements.get('media-gallery')) {
  // Scroll target offset for thumb clicks: the sticky-column offset
  // (--header-height, mirrored in section-main-product.css) + breathing room.
  // Read at click time so it tracks the live header height.
  const STACKED_SCROLL_BREATHING = 13;
  const stackedScrollTopOffset = () =>
    (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height'), 10) || 55) +
    STACKED_SCROLL_BREATHING;

  customElements.define(
    'media-gallery',
    class MediaGallery extends HTMLElement {
      constructor() {
        super();
        this.elements = {
          liveRegion: this.querySelector('[id^="GalleryStatus"]'),
          viewer: this.querySelector('[id^="GalleryViewer"]'),
          thumbnails: this.querySelector('[id^="GalleryThumbnails"]'),
        };
        this.mql = window.matchMedia('(min-width: 750px)');
        this.railMql = window.matchMedia('(min-width: 1100px)');
        this.isStackedScroll = this.dataset.desktopLayout === 'stacked_scroll';
        if (!this.elements.thumbnails) return;

        this.elements.viewer.addEventListener('slideChanged', debounce(this.onSlideChanged.bind(this), 500));
        this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
          mediaToSwitch
            .querySelector('button')
            .addEventListener('click', this.setActiveMedia.bind(this, mediaToSwitch.dataset.target, false));
        });
        if (this.dataset.desktopLayout.includes('thumbnail') && this.mql.matches) this.removeListSemantic();
        if (this.isStackedScroll) this.initScrollSpy();
      }

      initScrollSpy() {
        const observer = new IntersectionObserver(
          (entries) => {
            if (this.scrollSpySuppressed || !this.railMql.matches) return;
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const thumbnail = this.elements.thumbnails.querySelector(
                `[data-target="${entry.target.dataset.mediaId}"]`
              );
              this.setActiveThumbnail(thumbnail);
            });
          },
          { rootMargin: '-25% 0px -65% 0px' }
        );
        this.elements.viewer.querySelectorAll('li[data-media-id]').forEach((item) => observer.observe(item));
      }

      // A scroll-spy scrollIntoView mid-animation can cancel the smooth page
      // scroll in some engines, so the spy stays quiet until scrolling settles.
      suppressScrollSpyUntilSettled() {
        this.scrollSpySuppressed = true;
        clearTimeout(this.scrollSpyReleaseTimer);
        this.scrollSpyRelease =
          this.scrollSpyRelease ||
          (() => {
            this.scrollSpySuppressed = false;
            clearTimeout(this.scrollSpyReleaseTimer);
            window.removeEventListener('scrollend', this.scrollSpyRelease);
          });
        window.addEventListener('scrollend', this.scrollSpyRelease);
        this.scrollSpyReleaseTimer = setTimeout(this.scrollSpyRelease, 1500); // no-scrollend fallback
      }

      onSlideChanged(event) {
        const thumbnail = this.elements.thumbnails.querySelector(
          `[data-target="${event.detail.currentElement.dataset.mediaId}"]`
        );
        this.setActiveThumbnail(thumbnail);
      }

      setActiveMedia(mediaId, prepend) {
        const activeMedia =
          this.elements.viewer.querySelector(`[data-media-id="${mediaId}"]`) ||
          this.elements.viewer.querySelector('[data-media-id]');
        if (!activeMedia) {
          return;
        }
        this.elements.viewer.querySelectorAll('[data-media-id]').forEach((element) => {
          element.classList.remove('is-active');
        });
        activeMedia?.classList?.add('is-active');

        if (prepend) {
          activeMedia.parentElement.firstChild !== activeMedia && activeMedia.parentElement.prepend(activeMedia);

          if (this.elements.thumbnails) {
            const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
            activeThumbnail.parentElement.firstChild !== activeThumbnail && activeThumbnail.parentElement.prepend(activeThumbnail);
          }

          if (this.elements.viewer.slider) this.elements.viewer.resetPages();
        }

        this.preventStickyHeader();
        window.setTimeout(() => {
          if (!prepend && this.isStackedScroll && this.railMql.matches) {
            const top = activeMedia.getBoundingClientRect().top + window.scrollY - stackedScrollTopOffset();
            if (Math.abs(top - window.scrollY) < 2) return;
            this.suppressScrollSpyUntilSettled();
            window.scrollTo({ top: top, behavior: 'smooth' });
            return;
          }
          if (!this.mql.matches || this.elements.thumbnails) {
            activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft });
          }
          const activeMediaRect = activeMedia.getBoundingClientRect();
          // Don't scroll if the image is already in view
          if (activeMediaRect.top > -0.5) return;
          const top = activeMediaRect.top + window.scrollY;
          window.scrollTo({ top: top, behavior: 'smooth' });
        });
        this.playActiveMedia(activeMedia);

        if (!this.elements.thumbnails) return;
        const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
        this.setActiveThumbnail(activeThumbnail);
        this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
      }

      setActiveThumbnail(thumbnail) {
        if (!this.elements.thumbnails || !thumbnail) return;

        this.elements.thumbnails
          .querySelectorAll('button')
          .forEach((element) => element.removeAttribute('aria-current'));
        thumbnail.querySelector('button').setAttribute('aria-current', true);
        if (this.isStackedScroll && this.railMql.matches) {
          // scoped to the rail's own overflow — scrollIntoView could also move the page
          const list = this.elements.thumbnails.slider;
          const listRect = list.getBoundingClientRect();
          const thumbRect = thumbnail.getBoundingClientRect();
          if (thumbRect.top < listRect.top) {
            list.scrollTop += thumbRect.top - listRect.top;
          } else if (thumbRect.bottom > listRect.bottom) {
            list.scrollTop += thumbRect.bottom - listRect.bottom;
          }
          return;
        }
        if (this.elements.thumbnails.isSlideVisible(thumbnail, 10)) return;

        this.elements.thumbnails.slider.scrollTo({ left: thumbnail.offsetLeft });
      }

      announceLiveRegion(activeItem, position) {
        const image = activeItem.querySelector('.product__modal-opener--image img');
        if (!image) return;
        image.onload = () => {
          this.elements.liveRegion.setAttribute('aria-hidden', false);
          this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace('[index]', position);
          setTimeout(() => {
            this.elements.liveRegion.setAttribute('aria-hidden', true);
          }, 2000);
        };
        image.src = image.src;
      }

      playActiveMedia(activeItem) {
        window.pauseAllMedia();
        const deferredMedia = activeItem.querySelector('.deferred-media');
        if (deferredMedia) deferredMedia.loadContent(false);
      }

      preventStickyHeader() {
        this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
        if (!this.stickyHeader) return;
        this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
      }

      removeListSemantic() {
        if (!this.elements.viewer.slider) return;
        this.elements.viewer.slider.setAttribute('role', 'presentation');
        this.elements.viewer.sliderItems.forEach((slide) => slide.setAttribute('role', 'presentation'));
      }
    }
  );
}
