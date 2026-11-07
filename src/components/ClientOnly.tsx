import { useEffect, useState, type ReactNode } from "react";

/** Renderiza os filhos só depois da hidratação: WebGL/Rapier nunca rodam no SSR. */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : fallback;
}
