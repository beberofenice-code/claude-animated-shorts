import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/baychimo/Bridge";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="BaychimoShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
