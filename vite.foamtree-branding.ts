import type { Plugin } from "vite";

/** Demo FoamTree always injects a Carrot Search attribution cell; strip it. */
const ATTRIBUTION_INJECT =
  /\(function\(r\)\{if\(!r\.empty\(\)\)\{var x=\s*k\(\{attribution:!0\}\);x\.index=r\.m\.length;x\.parent=r;x\.level=r\.level\+1;x\.attribution=!0;r\.m\.push\(x\)\}\}\)\(b\);/g;

export function stripFoamTreeBranding(): Plugin {
  return {
    name: "strip-foamtree-branding",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("@carrotsearch/foamtree") || !id.includes("foamtree")) {
        return null;
      }
      if (!ATTRIBUTION_INJECT.test(code)) {
        return null;
      }
      ATTRIBUTION_INJECT.lastIndex = 0;
      return {
        code: code.replace(ATTRIBUTION_INJECT, "(function(r){})(b);"),
        map: null,
      };
    },
  };
}
