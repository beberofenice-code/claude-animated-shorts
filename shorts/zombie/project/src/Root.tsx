import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { ZombieShort, ZOMBIE_FRAMES } from "./videos/zombie/Zombie";
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="ZombieShort" component={ZombieShort} durationInFrames={ZOMBIE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
