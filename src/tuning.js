// Every number the game is judged on lives here (prototype-fast: retune = one line).
export const T = {
  // corridor
  SECTOR_H: 60,
  HALF_W0: 12, HALF_W_MIN: 7.5, HALF_W_SHRINK: 0.45,  // per sector
  // comet
  CRUISE: 9, MAX_SPEED: 24, DRAG_RATE: 0.35,
  PERI_K: 7.5,            // dv/dt = K / r while tethered
  REACH: 5.5,             // tether reach beyond a well's surface
  PERI_RATIO: 1.35,       // release below r < ratio*R => perihelion bonus
  NEAR_RATIO: 1.12,       // slow-mo near miss threshold
  // tide
  TIDE_V0: 4.6, TIDE_V_PER_SECTOR: 0.5, TIDE_MAX_GAP: 20, TIDE_START_GAP: 12,
  ORBIT_SLOWMO: 0.55,     // time scale at max speed while tethered (bullet time makes tight orbits readable)
  AIM_ASSIST_DEG: 11, AIM_ASSIST_RANGE: 16,
  // gen
  WELLS_PER_SECTOR0: 5, WELLS_PER_SECTOR_MAX: 9,
  WELL_R_MIN: 0.9, WELL_R_MAX: 2.2, WELL_GAP: 4.2,
  SPARKS_PER_SECTOR: 10, MINES_PER_SECTOR0: 1, MINES_MAX: 6,
  // scoring
  PICKUP_R: 1.25, MAGNET_R: 3.2, MAGNET_V: 14,
  COMBO_WINDOW: 1.4, COMBO_MAX: 10, SPARK_SCORE: 10, PERI_SCORE: 60, HEIGHT_SCORE: 1,
  // camera
  CAM_Z: 26, CAM_FOLLOW: 7, LOOK_AHEAD: 0.38, CAM_SPEED_ZOOM: 0.22,
  // feel
  HITSTOP_PERI: 0.05, HITSTOP_DEATH: 0.13, SLOWMO_NEAR: 0.12,
};
