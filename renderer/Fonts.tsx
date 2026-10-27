import React from "react";
import { staticFile } from "remotion";

const CSS = `
@font-face{font-family:"InterTight";src:url("${staticFile("fonts/InterTight.ttf")}") format("truetype");font-weight:100 900;font-display:block;}
@font-face{font-family:"InstrumentSerif";src:url("${staticFile("fonts/InstrumentSerif-Regular.ttf")}") format("truetype");font-weight:400;font-display:block;}
@font-face{font-family:"InstrumentSerif";src:url("${staticFile("fonts/InstrumentSerif-Italic.ttf")}") format("truetype");font-weight:400;font-style:italic;font-display:block;}
`;

export const Fonts: React.FC = () => <style dangerouslySetInnerHTML={{ __html: CSS }} />;
