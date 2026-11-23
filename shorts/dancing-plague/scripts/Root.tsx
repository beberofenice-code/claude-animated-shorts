import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { DancingShort, DANCING_FRAMES } from "./videos/dancing/Dancing";

export const Root: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="DancingShort" component={DancingShort} durationInFrames={DANCING_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="DancingShort2K" component={DancingShort} durationInFrames={DANCING_FRAMES} fps={30} width={1440} height={2560} />
  </>
);
