import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { Overlay, type OverlayProps } from "./Overlay";

const calculate: CalculateMetadataFunction<any> = ({ props }) => {
  const frames = Math.max(90, Math.round(props?.durationInFrames ?? 480));
  return { durationInFrames: frames, fps: 30, width: 1080, height: 1920 };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Overlay"
      component={Overlay as any}
      durationInFrames={480}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={
        {
          hook: "Hook",
          kicker: "kicker",
          cta: "CTA",
          accent: "#f0b3c7",
          brand: "giftsqr",
          captions: [],
          template: {},
          particle: "gold-dust",
          showProgress: true,
        } as any
      }
      calculateMetadata={calculate}
    />
  );
};
