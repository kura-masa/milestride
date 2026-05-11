import { useCallback, useRef } from "react";

export function useLongPress({
  onTap,
  onLongPress,
  ms = 450,
}: {
  onTap?: () => void;
  onLongPress?: () => void;
  ms?: number;
}) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (x: number, y: number) => {
      fired.current = false;
      startPos.current = { x, y };
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        if (navigator.vibrate) navigator.vibrate(30);
        onLongPress?.();
      }, ms);
    },
    [ms, onLongPress]
  );

  const cancel = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    startPos.current = null;
    // Mark as handled so a subsequent touchend doesn't fire onTap.
    // (Scrolling: touchstart → touchmove cancels → touchend should NOT tap.)
    fired.current = true;
  }, []);

  const finish = useCallback(() => {
    if (!fired.current) {
      onTap?.();
    }
    cancel();
  }, [onTap, cancel]);

  const move = useCallback(
    (x: number, y: number) => {
      if (!startPos.current) return;
      const dx = x - startPos.current.x;
      const dy = y - startPos.current.y;
      if (dx * dx + dy * dy > 100) cancel();
    },
    [cancel]
  );

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      finish();
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      move(t.clientX, t.clientY);
    },
    onTouchCancel: cancel,
    onMouseDown: (e: React.MouseEvent) => start(e.clientX, e.clientY),
    onMouseUp: () => finish(),
    onMouseLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
