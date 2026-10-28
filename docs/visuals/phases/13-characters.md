# 13 Characters

Goal: Characters that sit in the new light: retuned rim, rim on NPCs and animals, an outline on high.

- Rim retuned after tone mapping; rim on NPCs and animals; optional back-face
  outline hull (merged parts, `BasicMaterial` `BackSide`, normal push 0.018,
  high tier only); cloth textures a little higher contrast.
- Done when: one extra draw per character at most; looks right in `plaza-morning`.

## Pointers
(Line numbers as of the plan: grep the names if they moved.)
- `character.js` rim :58-76
- hooks that assign `onBeforeCompile`: `world.js` `addWind` :37-49, `addRipples` :60-85, foam :96-113, `character.js` rim :58-76, `itemmesh.js` :18-24
