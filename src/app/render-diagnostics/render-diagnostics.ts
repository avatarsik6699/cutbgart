import React from "react";
import whyDidYouRender from "@welldone-software/why-did-you-render";

whyDidYouRender(React, {
  collapseGroups: true,
  include: [/./],
  logOwnerReasons: true,
  trackAllPureComponents: true,
  trackHooks: true,
});

console.info(
  "[render-diagnostics] why-did-you-render is active. Use React Profiler and Chrome Performance for timing evidence.",
);
