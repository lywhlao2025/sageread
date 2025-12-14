import { useAppSettingsStore } from "@/store/app-settings-store";
import type { ViewSettings } from "@/types/book";
import type { FoliateView } from "@/types/view";
import { eventDispatcher } from "@/utils/event";
import { useRef } from "react";
import { useReaderStoreApi } from "../components/reader-provider";

export type ScrollSource = "touch" | "mouse";

export const viewPagination = (
  view: FoliateView | null,
  viewSettings: ViewSettings | null | undefined,
  side: "left" | "right",
) => {
  if (!view || !viewSettings) return;
  const renderer = view.renderer;
  if (renderer.scrolled) {
    if (view.book.dir === "rtl") {
      side = side === "left" ? "right" : "left";
    }
    const { size } = renderer;
    const showHeader = viewSettings.showHeader && viewSettings.showBarsOnScroll;
    const showFooter = viewSettings.showFooter && viewSettings.showBarsOnScroll;
    const scrollingOverlap = viewSettings.scrollingOverlap;
    const distance = size - scrollingOverlap - (showHeader ? 44 : 0) - (showFooter ? 44 : 0);
    return side === "left" ? view.prev(distance) : view.next(distance);
  }
  return side === "left" ? view.goLeft() : view.goRight();
};

export const usePagination = (bookId: string, containerRef: React.RefObject<HTMLDivElement>) => {
  const { settings } = useAppSettingsStore();
  const store = useReaderStoreApi();
  const globalViewSettings = settings.globalViewSettings!;

  const view = store.getState().view;
  const getView = () => store.getState().view;
  const swipeAccumXRef = useRef(0);
  const lastWheelEventAtRef = useRef(0);
  const lastSwipeFlipAtRef = useRef(0);
  const swipeLockedRef = useRef(false);
  const lastIframeWheelAtRef = useRef(0);
  const SWIPE_THRESHOLD = 12; // px accumulated deltaX to flip
  const SWIPE_TIMEOUT = 1200; // ms to reset accumulation
  const SWIPE_COOLDOWN = 600; // ms to prevent multi-flip per gesture
  const SWIPE_GESTURE_WINDOW = 900; // ms: treat a burst as one gesture

  const handlePageFlip = async (msg: MessageEvent | CustomEvent | React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (msg instanceof MessageEvent) {
      if (msg.data && msg.data.bookId === bookId) {
        if (msg.data.type === "iframe-single-click") {
          const viewElement = containerRef.current;
          if (viewElement) {
            const { screenX } = msg.data;
            const viewRect = viewElement.getBoundingClientRect();
            const windowStartX = window.screenX;
            const viewStartX = windowStartX + viewRect.left;
            const viewCenterX = viewStartX + viewRect.width / 2;
            const consumed = eventDispatcher.dispatchSync("iframe-single-click");
            if (!consumed) {
              const centerStartX = viewStartX + viewRect.width * 0.375;
              const centerEndX = viewStartX + viewRect.width * 0.625;
              if (globalViewSettings.disableClick! || (screenX >= centerStartX && screenX <= centerEndX)) {
                // Center area - no action needed
              } else {
                if (!globalViewSettings.disableClick! && screenX >= viewCenterX) {
                  if (globalViewSettings.swapClickArea) {
                    viewPagination(view, globalViewSettings, "left");
                  } else {
                    viewPagination(view, globalViewSettings, "right");
                  }
                } else if (!globalViewSettings.disableClick! && screenX < viewCenterX) {
                  if (globalViewSettings.swapClickArea) {
                    viewPagination(view, globalViewSettings, "right");
                  } else {
                    viewPagination(view, globalViewSettings, "left");
                  }
                }
              }
            }
          }
        } else if (msg.data.type === "iframe-wheel") {
          // Match Apple Books style:
          // - paginated mode: lock vertical wheel, only allow horizontal swipe to flip
          // - scrolled mode: allow vertical scroll, disable swipe-to-flip to avoid mixed gestures
          if (globalViewSettings.scrolled) return;

          const { deltaX, deltaY } = msg.data;
          const now = Date.now();
          lastIframeWheelAtRef.current = now;
          if (now - lastWheelEventAtRef.current > SWIPE_GESTURE_WINDOW) swipeLockedRef.current = false;
          if (now - lastWheelEventAtRef.current > SWIPE_TIMEOUT) swipeAccumXRef.current = 0;
          lastWheelEventAtRef.current = now;

          // Paginated mode: treat wheel as horizontal swipe; ignore vertical delta to avoid mixed gestures.
          // Some trackpads emit small deltaX values; accumulate them and flip once a threshold is reached.
          if (Math.abs(deltaX) > 0.1) {
            if (swipeLockedRef.current) {
              return;
            }
            if (swipeAccumXRef.current !== 0 && Math.sign(swipeAccumXRef.current) !== Math.sign(deltaX)) {
              swipeAccumXRef.current = 0;
            }
            swipeAccumXRef.current += deltaX;
            if (now - lastSwipeFlipAtRef.current > SWIPE_COOLDOWN) {
              if (swipeAccumXRef.current >= SWIPE_THRESHOLD) {
                swipeAccumXRef.current = 0;
                lastSwipeFlipAtRef.current = now;
                swipeLockedRef.current = true;
                setTimeout(() => {
                  swipeLockedRef.current = false;
                }, SWIPE_GESTURE_WINDOW);
                return viewPagination(getView(), globalViewSettings, "right");
              }
              if (swipeAccumXRef.current <= -SWIPE_THRESHOLD) {
                swipeAccumXRef.current = 0;
                lastSwipeFlipAtRef.current = now;
                swipeLockedRef.current = true;
                setTimeout(() => {
                  swipeLockedRef.current = false;
                }, SWIPE_GESTURE_WINDOW);
                return viewPagination(getView(), globalViewSettings, "left");
              }
            }
          } else if (Math.abs(deltaY) > 0.5) {
            // If it's essentially vertical, don't accumulate; keep it inert.
            swipeAccumXRef.current = 0;
          }

          // Intentionally ignore vertical wheel in paginated mode.
        } else if (msg.data.type === "iframe-mouseup") {
          if (msg.data.button === 3) {
            view?.history.back();
          } else if (msg.data.button === 4) {
            view?.history.forward();
          }
        }
      }
    } else if (msg instanceof CustomEvent) {
      const { keyName } = msg.detail;
      if (globalViewSettings?.volumeKeysToFlip) {
        if (keyName === "VolumeUp") {
          viewPagination(view, globalViewSettings, "left");
        } else if (keyName === "VolumeDown") {
          viewPagination(view, globalViewSettings, "right");
        }
      }
    } else {
      if (msg.type === "click") {
        const { clientX } = msg;
        const width = window.innerWidth;
        const leftThreshold = width * 0.5;
        const rightThreshold = width * 0.5;
        if (clientX < leftThreshold) {
          viewPagination(view, globalViewSettings, "left");
        } else if (clientX > rightThreshold) {
          viewPagination(view, globalViewSettings, "right");
        }
      } else if (msg.type === "wheel") {
        const event = msg as React.WheelEvent<HTMLDivElement>;
        if (globalViewSettings.scrolled) return;

        const { deltaX, deltaY } = event;
        const now = Date.now();
        // Avoid double-processing when iframe already forwarded a wheel message for the same gesture.
        if (now - lastIframeWheelAtRef.current < 80) return;
        if (now - lastWheelEventAtRef.current > SWIPE_GESTURE_WINDOW) swipeLockedRef.current = false;
        if (now - lastWheelEventAtRef.current > SWIPE_TIMEOUT) swipeAccumXRef.current = 0;
        lastWheelEventAtRef.current = now;

        // Prevent accidental vertical scrolling of the outer container/window in paginated mode.
        event.preventDefault();

        if (Math.abs(deltaX) > 0.1) {
          if (swipeLockedRef.current) {
            return;
          }
          if (swipeAccumXRef.current !== 0 && Math.sign(swipeAccumXRef.current) !== Math.sign(deltaX)) {
            swipeAccumXRef.current = 0;
          }
          swipeAccumXRef.current += deltaX;
          if (now - lastSwipeFlipAtRef.current > SWIPE_COOLDOWN) {
            if (swipeAccumXRef.current >= SWIPE_THRESHOLD) {
              swipeAccumXRef.current = 0;
              lastSwipeFlipAtRef.current = now;
              swipeLockedRef.current = true;
              setTimeout(() => {
                swipeLockedRef.current = false;
              }, SWIPE_GESTURE_WINDOW);
              viewPagination(getView(), globalViewSettings, "right");
            } else if (swipeAccumXRef.current <= -SWIPE_THRESHOLD) {
              swipeAccumXRef.current = 0;
              lastSwipeFlipAtRef.current = now;
              swipeLockedRef.current = true;
              setTimeout(() => {
                swipeLockedRef.current = false;
              }, SWIPE_GESTURE_WINDOW);
              viewPagination(getView(), globalViewSettings, "left");
            }
          }
        } else if (Math.abs(deltaY) > 0.5) {
          swipeAccumXRef.current = 0;
        }
      }
    }
  };

  const handleContinuousScroll = (mode: ScrollSource, scrollDelta: number, threshold: number) => {
    const renderer = view?.renderer;
    if (renderer && globalViewSettings.scrolled && globalViewSettings.continuousScroll) {
      const doScroll = () => {
        // may have overscroll where the start is greater than 0
        if (renderer.start <= scrollDelta && scrollDelta > threshold) {
          setTimeout(() => {
            view?.prev(renderer.start + 1);
          }, 100);
          // sometimes viewSize has subpixel value that the end never reaches
        } else if (Math.ceil(renderer.end) - scrollDelta >= renderer.viewSize && scrollDelta < -threshold) {
          setTimeout(() => {
            view?.next(renderer.viewSize - Math.floor(renderer.end) + 1);
          }, 100);
        }
      };
      if (mode === "mouse") {
        // we can always get mouse wheel events
        doScroll();
      } else if (mode === "touch") {
        // when the document height is less than the viewport height, we can't get the relocate event
        if (renderer.size >= renderer.viewSize) {
          doScroll();
        } else {
          // scroll after the relocate event
          renderer.addEventListener("relocate", () => doScroll(), { once: true });
        }
      }
    }
  };

  return {
    handlePageFlip,
    handleContinuousScroll,
  };
};
