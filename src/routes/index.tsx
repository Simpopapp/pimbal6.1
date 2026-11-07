import { createFileRoute } from "@tanstack/react-router";

import { ClientOnly } from "@/components/ClientOnly";
import { PinballGame } from "@/components/game/PinballGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova Strike — 3D Pinball" },
      {
        name: "description",
        content:
          "A physics-driven 3D pinball table in your browser: real flippers, a spring plunger, ramps and missions.",
      },
      { property: "og:title", content: "Nova Strike — 3D Pinball" },
      {
        property: "og:description",
        content:
          "Physics-driven 3D pinball in your browser: flippers, plunger, missions and multiball.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PinballPage,
});

function PinballPage() {
  return (
    <ClientOnly
      fallback={
        <div className="flex h-dvh items-center justify-center bg-background">
          <p className="animate-pulse font-mono text-sm tracking-[0.35em] text-muted-foreground uppercase">
            Loading table…
          </p>
        </div>
      }
    >
      <PinballGame />
    </ClientOnly>
  );
}
