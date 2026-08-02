type OrderOverlayBackHandler = () => boolean;

const handlers: OrderOverlayBackHandler[] = [];

export function pushOrderOverlayBackHandler(handler: OrderOverlayBackHandler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index >= 0) {
      handlers.splice(index, 1);
    }
  };
}

export function consumeOrderOverlayBackPress(): boolean {
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    if (handlers[index]()) {
      return true;
    }
  }
  return false;
}

export function hasOpenOrderOverlay(): boolean {
  return handlers.length > 0;
}
