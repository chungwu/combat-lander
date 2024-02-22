import React from "react";
import { LanderGameState } from "@/game/game-state";
import type CanvasRenderer from "@/game/canvas-renderer";
import { useClientEngine } from "./contexts";

export function GameCanvas(props: {
  game: LanderGameState;
  playerId: string;
}) {
  const { game, playerId } = props;

  const canvasContainerRef = React.useRef<HTMLDivElement>(null);
  const engine = useClientEngine();

  const [ renderer, setRenderer ] = React.useState<null | CanvasRenderer>(null);

  React.useEffect(() => {
    import("@/game/canvas-renderer").then(mod => setRenderer(new mod.CanvasRenderer()))
  }, []);

  React.useEffect(() => {
    const container = canvasContainerRef.current;
    if (container && renderer) {
      container.appendChild(renderer.canvasElement);
    }
  }, [renderer]);

  React.useEffect(() => {
    if (renderer) {
      const handler = () => {
        renderer.resize();
      };
      window.addEventListener("resize", handler, false);
      return () => window.removeEventListener("resize", handler);
    }
  }, [renderer]);

  React.useEffect(() => {
    if (game && renderer) {
      renderer.render(game, playerId, engine.timestep);
      const id = setInterval(() => {
        if (!(globalThis as any).PAUSE_RENDER) {
          renderer.render(game, playerId, engine.timestep);
        }
      }, 1000/60);
      return () => clearInterval(id)
    }
  }, [renderer, game])

  return (
    <div ref={canvasContainerRef} />
  );
}