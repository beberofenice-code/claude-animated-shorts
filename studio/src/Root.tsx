import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { GhostShort, GHOST_FRAMES } from "./videos/ghost/Ghost";

export const Root: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="GhostShort" component={GhostShort} durationInFrames={GHOST_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
