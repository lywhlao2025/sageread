export class LogicalPosition {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

const noop = async () => {};

export function getCurrentWindow() {
  return {
    close: noop,
    minimize: noop,
    maximize: noop,
    unmaximize: noop,
    toggleMaximize: noop,
    isMaximized: async () => false,
    setDecorations: noop,
    setAlwaysOnTop: noop,
    isAlwaysOnTop: async () => false,
    startDragging: noop,
  };
}
