# 11 Water

Goal: Water with sky fresnel, sun glints and turquoise shallows.

- Sea hook `water`: fresnel toward `uSkyHorizon`, sun glints (`pow(…, 180)` ×
  sparkle noise, > 1 so bloom catches them), shallows hook tinting turquoise
  with sky by fresnel; ripples and foam kept; sea stays opaque.
- Done when: glints at sunset without bloom blow-out. Proof: `lake-sunset`.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- water `main.js` :375-382
- hooks that assign `onBeforeCompile`: `world.js` `addWind` :37-49, `addRipples` :60-85, foam :96-113, `character.js` rim :58-76, `itemmesh.js` :18-24
