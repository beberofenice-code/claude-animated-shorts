import React from "react";
import { Composition } from "remotion";
import { PelikulaShort, PELIKULA_FRAMES } from "./videos/pelikula/Pelikula";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="PelikulaShort" component={PelikulaShort} durationInFrames={PELIKULA_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
