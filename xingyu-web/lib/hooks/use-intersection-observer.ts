"use client";

import { useEffect, useState, useRef, type RefObject } from "react";

type UseIntersectionObserverOptions = IntersectionObserverInit;

/**
 * 检测元素是否进入视口
 * 用于懒加载和动画触发
 */
export function useIntersectionObserver(
  ref: RefObject<Element>,
  options: UseIntersectionObserverOptions = {}
): boolean {
  const [isIntersecting, setIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}

/**
 * 检测元素是否进入视口（一次性）
 * 进入后不再监听，适合懒加载
 */
export function useIntersectionObserverOnce(
  ref: RefObject<Element>,
  options: UseIntersectionObserverOptions = {}
): boolean {
  const [hasIntersected, setHasIntersected] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (hasIntersected) return;

    const element = ref.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasIntersected(true);
          observerRef.current?.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
        ...options,
      }
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [ref, options, hasIntersected]);

  return hasIntersected;
}
