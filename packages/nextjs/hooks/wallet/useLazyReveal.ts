"use client";

import { useEffect, useRef, useState } from "react";

export function useLazyReveal(total: number, initial = 12, step = 12) {
  const [count, setCount] = useState(Math.min(initial, total));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCount(c => Math.min(Math.max(c, initial), total));
  }, [total, initial]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setCount(c => Math.min(c + step, total));
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [total, step]);

  return { count, sentinelRef, hasMore: count < total };
}
