import * as THREE from 'three';

// ---------- Seasons on the farm ----------
// The farm's year goes round in four seasons of SEASON_DAYS game days each:
// fresh green in spring, deep green in summer, orange and red in autumn, and
// frosted pale in winter. Its trees' leaves and needles, its grass and its
// ground take the season's colors (the farm's own materials, from its map:
// src/maps.js HOME, so the lobbies' islands keep theirs), and on a season's
// last day they turn, a little at a time, into the next one's. The clock
// says which season it is. Just for looks: crops grow the same all year.
export const SEASON_DAYS = 7;

// leaves: the farm's four leaf colors; pines: its three needle colors;
// grass: the tufts'; ground: what the ground's colors are multiplied by;
// frost: how much white goes on top (by day: less at night)
export const SEASONS = [
  {
    name: 'Spring',
    leaves: [0x4f9e3c, 0x5aa83f, 0x3f8a3a, 0x6cbf4a],
    pines: [0x2c6b3f, 0x24603a, 0x34784a],
    grass: 0x6fb043,
    ground: [1, 1, 1],
    frost: 0,
  },
  {
    name: 'Summer',
    leaves: [0x3a8034, 0x2f7a45, 0x4a9038, 0x357a30],
    pines: [0x285f38, 0x215634, 0x306c42],
    grass: 0x82a83a,
    ground: [1.04, 1, 0.82],
    frost: 0,
  },
  {
    name: 'Autumn',
    leaves: [0xd9822b, 0xc4502b, 0xe3a832, 0x9e8a34],
    pines: [0x2a5a38, 0x245034, 0x33663f],
    grass: 0xc29a3a,
    ground: [1.4, 1, 0.48],
    frost: 0,
  },
  {
    name: 'Winter',
    leaves: [0xdfe9ee, 0xc4d4dc, 0xeef3f5, 0xb2c4cc],
    pines: [0x3d6656, 0x355c4e, 0x47705f],
    grass: 0xc9d8d2,
    ground: [0.9, 0.95, 1.02],
    frost: 0.32,
  },
];

// The season on game day `day` (1, 2, ...) at `hour`: { now, next, blend }
// (blend: how far it has turned into the next one, 0 till its last day)
export function seasonAt(day, hour) {
  const days = day - 1 + hour / 24;
  const i = Math.floor(days / SEASON_DAYS);
  const into = days - i * SEASON_DAYS; // (days into this one)
  return {
    now: SEASONS[i % SEASONS.length],
    next: SEASONS[(i + 1) % SEASONS.length],
    blend: THREE.MathUtils.clamp(into - (SEASON_DAYS - 1), 0, 1),
  };
}

// map: the farm's map (its leafMats, pineMats, tuftMat, groundMat)
export function createSeasons(map) {
  const a = new THREE.Color();
  const b = new THREE.Color();
  const mix = (from, to, t, out) => out.copy(a.setHex(from)).lerp(b.setHex(to), t);

  return {
    // Every frame on the farm: the colors for game day `day` at `hour`
    // (night: 0 by day, 1 at night, for the frost's shine). The season's name.
    update(day, hour, night) {
      const { now, next, blend } = seasonAt(day, hour);
      map.leafMats.forEach((m, i) => mix(now.leaves[i % now.leaves.length], next.leaves[i % next.leaves.length], blend, m.color));
      map.pineMats.forEach((m, i) => mix(now.pines[i % now.pines.length], next.pines[i % next.pines.length], blend, m.color));
      mix(now.grass, next.grass, blend, map.tuftMat.color);
      const ground = now.ground.map((v, i) => THREE.MathUtils.lerp(v, next.ground[i], blend));
      map.groundMat.color.setRGB(...ground);
      const frost = THREE.MathUtils.lerp(now.frost, next.frost, blend) * (1 - night * 0.85);
      map.groundMat.emissive.setRGB(frost, frost * 1.03, frost * 1.08);
      map.tuftMat.emissive.setRGB(frost * 0.6, frost * 0.62, frost * 0.65);
      return blend < 0.5 ? now.name : next.name;
    },
  };
}
