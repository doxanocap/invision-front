"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Tooltip({ content, children, className }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isHoveringTooltip, setIsHoveringTooltip] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number; placement: "bottom" | "top" } | null>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipId = useId();

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const computePosition = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 12;

    const tooltipEl = tooltipRef.current;
    const tooltipW = tooltipEl?.offsetWidth ?? 320;
    const tooltipH = tooltipEl?.offsetHeight ?? 160;

    // Preferred: centered below anchor
    let left = rect.left + rect.width / 2 - tooltipW / 2;
    left = Math.max(margin, Math.min(left, viewportW - tooltipW - margin));

    const belowTop = rect.bottom + 10;
    const aboveTop = rect.top - tooltipH - 10;
    const fitsBelow = belowTop + tooltipH + margin <= viewportH;

    const placement: "bottom" | "top" = fitsBelow ? "bottom" : "top";
    const top = placement === "bottom" ? belowTop : Math.max(margin, aboveTop);

    setCoords({ left, top, placement });
  };

  useEffect(() => {
    if (!isOpen) return;
    computePosition();
    const onScroll = () => computePosition();
    const onResize = () => computePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const open = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      if (!isHoveringTooltip) setIsOpen(false);
    }, 80);
  };

  const tooltipNode = useMemo(() => {
    if (!mounted || !isOpen) return null;
    if (!coords) return null;

    return createPortal(
      <div
        ref={tooltipRef}
        id={tooltipId}
        role="tooltip"
        onMouseEnter={() => setIsHoveringTooltip(true)}
        onMouseLeave={() => {
          setIsHoveringTooltip(false);
          scheduleClose();
        }}
        className="fixed z-[9999] w-max max-w-[520px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg max-h-[360px] overflow-auto"
        style={{ left: coords.left, top: coords.top }}
      >
        {content}
      </div>,
      document.body
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isOpen, coords, content, tooltipId]);

  return (
    <>
      <span
        ref={anchorRef}
        className={`inline-flex items-center ${className ?? ""}`}
        onMouseEnter={() => {
          open();
          // Recompute after open so width/height is known.
          requestAnimationFrame(() => computePosition());
        }}
        onMouseLeave={() => scheduleClose()}
        aria-describedby={isOpen ? tooltipId : undefined}
      >
        {children}
      </span>
      {tooltipNode}
    </>
  );
}
