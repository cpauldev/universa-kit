"use client";

import { mountExampleDashboard } from "@example/shared/dashboard-client";
import { useEffect, useRef } from "react";

export function ClientPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      throw new Error("Missing dashboard root");
    }

    const cleanup = mountExampleDashboard({
      root,
      frameworkId: "nextjs",
    });
    return () => {
      cleanup();
    };
  }, []);

  return <div ref={rootRef} />;
}
