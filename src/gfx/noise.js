// ---------- Noise for painted detail, in shaders ----------
// GLSL helpers for a hook's fragment shader (patch them in at 'common'),
// each set guarded so two hooks on one material can both bring them. All in
// highp on world coordinates, with no sin() hash (SwiftShader and phones
// lose it on big inputs), and with constant loop bounds.
//
// NOISE:
//   gfxHash(p), gfxHash2(p)  0..1 (and a vec2 of them) for a point
//   gfxNoise(p)              smooth value noise, 0..1, one lump a unit of p
//   gfxFootprint(p)          how much of p one pixel covers (its larger side)
//   gfxShow(freq, px)        how much of a pattern of freq lumps a unit of p
//                            a pixel covering px can show: 1 while a lump
//                            spans 4 pixels or more, 0 below 2 (fade the
//                            finer octaves by it, and nothing shimmers)
// VORONOI (needs NOISE):
//   gfxVoronoi(p)            x: the distance to the nearest cell's edge (in
//                            cells), y: that cell's own 0..1. Cracks, slabs, cells.

export const NOISE = /* glsl */ `
#ifndef GFX_NOISE
#define GFX_NOISE
highp float gfxHash(highp vec2 p) {
  highp vec3 q = fract(p.xyx * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
highp vec2 gfxHash2(highp vec2 p) {
  highp vec3 q = fract(p.xyx * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
float gfxNoise(highp vec2 p) {
  highp vec2 i = floor(p);
  highp vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gfxHash(i), gfxHash(i + vec2(1.0, 0.0)), u.x),
             mix(gfxHash(i + vec2(0.0, 1.0)), gfxHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float gfxFootprint(highp vec2 p) {
  vec2 w = fwidth(p);
  return max(max(w.x, w.y), 1e-5);
}
float gfxShow(float freq, float px) {
  return 1.0 - smoothstep(0.25, 0.5, freq * px);
}
#endif
`;

export const VORONOI = /* glsl */ `
#ifndef GFX_VORONOI
#define GFX_VORONOI
highp vec2 gfxVoronoi(highp vec2 p) {
  highp vec2 i = floor(p);
  highp vec2 f = p - i;
  highp vec2 mg = vec2(0.0);
  highp vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      highp vec2 g = vec2(float(x), float(y));
      highp vec2 r = g + 0.15 + gfxHash2(i + g) * 0.7 - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  }
  float edge = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      highp vec2 g = mg + vec2(float(x), float(y));
      highp vec2 r = g + 0.15 + gfxHash2(i + g) * 0.7 - f;
      highp vec2 dr = r - mr;
      if (dot(dr, dr) > 1e-5) edge = min(edge, dot(0.5 * (mr + r), normalize(dr)));
    }
  }
  return vec2(edge, gfxHash(i + mg + 0.5));
}
#endif
`;
