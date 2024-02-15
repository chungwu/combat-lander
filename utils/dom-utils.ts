export function blurActive() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

export function isFullScreenMode() {
  return !!document.fullscreenElement;
}