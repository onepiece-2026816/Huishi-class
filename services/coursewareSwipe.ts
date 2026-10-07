export type PageDirection = 'previous' | 'next';
type Point = { x: number; y: number; z?: number };
type Sample = Point & { at: number };

export const SWIPE_CONFIG = {
  directionDistance: .02,
  straightAngle: 140, parallelAngle: 35, joinEnter: .38, joinExit: .54,
  confirmMs: 80, minMoveMs: 100, maxMoveMs: 800, gapMs: 160, missingGraceMs: 100,
  palmDistance: .40, screenDistance: .04, horizontalRatio: 1.5,
  cooldownMs: 600, settleMs: 180, settleRadius: .09, smoothingMs: 30,
} as const;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a: Point, b: Point, c: Point) => {
  const ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y;
  const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  return length < 1e-8 ? 0 : Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / length))) * 180 / Math.PI;
};

export class CoursewareSwipe {
  private anchor: Sample | null = null;
  private smooth: Point | null = null;
  private settled: Sample | null = null;
  private contact = false;
  private phase: 'preparing' | 'ready' | 'sliding' | 'triggered' | 'rearming' = 'preparing';
  private lockedDirection: PageDirection | null = null;
  private motionSign = 0;
  private peakX = 0;
  private cooldownUntil = 0;
  private lastAt = -Infinity;
  private missing = false;

  private clearTracking() {
    this.anchor = this.smooth = this.settled = null;
    this.contact = false;
    this.phase = 'preparing';
    this.lockedDirection = null;
    this.motionSign = 0;
    this.missing = false;
  }

  reset() {
    this.clearTracking();
    this.cooldownUntil = 0;
    this.lastAt = -Infinity;
  }

  private result(active: boolean, reason: string, direction: PageDirection | null = null) {
    return { active, direction, phase: this.phase, lockedDirection: this.lockedDirection, reason };
  }

  private cancel() {
    this.phase = 'rearming';
    this.anchor = this.settled = null;
    this.lockedDirection = null;
    this.motionSign = 0;
  }

  private retainDuringGap(at: number) {
    if (this.contact && at >= this.lastAt && at - this.lastAt <= SWIPE_CONFIG.missingGraceMs) {
      this.missing = true;
      return true;
    }
    return false;
  }

  update(landmarks: Point[] | null, at: number, side = 'Left', aspect = 1) {
    if (landmarks === null && side === 'Left' && Number.isFinite(at)
      && Number.isFinite(aspect) && aspect > 0 && this.retainDuringGap(at)) {
      return this.result(true, 'missing-grace');
    }
    if (side !== 'Left' || !landmarks || landmarks.length < 21 || !Number.isFinite(at)
      || !Number.isFinite(aspect) || aspect <= 0 || landmarks.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      this.clearTracking();
      this.lastAt = -Infinity;
      return this.result(false, side !== 'Left' ? 'wrong-hand' : 'hand-lost');
    }
    const elapsed = at - this.lastAt;
    if (elapsed > SWIPE_CONFIG.gapMs || elapsed <= 0
      || (this.missing && elapsed > SWIPE_CONFIG.missingGraceMs)) this.clearTracking();
    const p = landmarks.map((point) => ({ x: point.x * aspect, y: point.y }));
    const width = distance(p[5], p[17]);
    const straight = (base: number) => angle(p[base], p[base + 1], p[base + 2]) >= SWIPE_CONFIG.straightAngle
      && angle(p[base + 1], p[base + 2], p[base + 3]) >= SWIPE_CONFIG.straightAngle;
    const parallel = angle({ x: p[8].x - p[5].x, y: p[8].y - p[5].y }, { x: 0, y: 0 },
      { x: p[12].x - p[9].x, y: p[12].y - p[9].y }) <= SWIPE_CONFIG.parallelAngle;
    const joined = width > .02 && straight(5) && straight(9) && parallel
      && distance(p[8], p[12]) / width < (this.contact ? SWIPE_CONFIG.joinExit : SWIPE_CONFIG.joinEnter);
    if (!joined) {
      if (this.retainDuringGap(at)) return this.result(true, 'pose-grace');
      this.clearTracking();
      return this.result(false, 'pose-invalid');
    }
    this.lastAt = at;
    // The joined fingertips can swipe while the palm remains stationary.
    const point = { x: aspect - (p[8].x + p[12].x) / 2, y: (p[8].y + p[12].y) / 2 };
    if (this.missing && this.smooth) {
      // Keep pre-gap movement, but exclude all unobserved displacement.
      if (this.anchor) {
        this.anchor.x += point.x - this.smooth.x;
        this.anchor.y += point.y - this.smooth.y;
      }
      this.peakX += point.x - this.smooth.x;
      this.smooth = point;
      this.settled = null;
      this.missing = false;
      return this.result(true, 'recovered');
    }
    if (!this.contact) {
      this.contact = true;
      this.smooth = point;
    }
    const alpha = 1 - Math.exp(-Math.max(1, elapsed) / SWIPE_CONFIG.smoothingMs);
    this.smooth = this.smooth ? { x: this.smooth.x + alpha * (point.x - this.smooth.x), y: this.smooth.y + alpha * (point.y - this.smooth.y) } : point;
    if (!this.settled || distance(point, this.settled) > width * SWIPE_CONFIG.settleRadius) this.settled = { ...point, at };
    const stableFor = at - this.settled.at;
    if (this.phase === 'preparing' || this.phase === 'triggered' || this.phase === 'rearming') {
      const required = this.phase === 'preparing' ? SWIPE_CONFIG.confirmMs : SWIPE_CONFIG.settleMs;
      if (at < this.cooldownUntil) return this.result(true, 'cooldown');
      if (stableFor < required) return this.result(true, 'waiting-stable');
      this.phase = 'ready';
      this.anchor = { ...this.smooth, at };
      this.lockedDirection = null;
      return this.result(true, 'ready');
    }
    if (!this.anchor) return this.result(true, 'waiting-stable');
    const dx = this.smooth.x - this.anchor.x, dy = this.smooth.y - this.anchor.y;
    const directionDistance = aspect * SWIPE_CONFIG.directionDistance;
    if (this.phase === 'ready') {
      if (Math.abs(dx) >= directionDistance) {
        if (Math.abs(dx) <= Math.abs(dy) * SWIPE_CONFIG.horizontalRatio) {
          this.cancel();
          return this.result(true, 'cancelled-diagonal');
        }
        this.phase = 'sliding';
        // Match the mirrored preview: left goes back, right advances.
        this.lockedDirection = dx < 0 ? 'previous' : 'next';
        this.motionSign = Math.sign(dx);
        this.anchor.at = at;
        this.peakX = this.smooth.x;
      } else {
        if (stableFor >= SWIPE_CONFIG.confirmMs) this.anchor = { ...this.smooth, at };
        return this.result(true, 'below-direction-distance');
      }
    }
    const sign = this.motionSign;
    this.peakX = sign > 0 ? Math.max(this.peakX, this.smooth.x) : Math.min(this.peakX, this.smooth.x);
    if ((this.peakX - this.smooth.x) * sign >= directionDistance) {
      this.cancel();
      return this.result(true, 'cancelled-reversal');
    }
    if (at - this.anchor.at > SWIPE_CONFIG.maxMoveMs) {
      this.cancel();
      return this.result(true, 'cancelled-timeout');
    }
    if (at - this.anchor.at >= SWIPE_CONFIG.minMoveMs
      && Math.abs(dx) >= Math.max(width * SWIPE_CONFIG.palmDistance, aspect * SWIPE_CONFIG.screenDistance)
      && Math.abs(dx) > Math.abs(dy) * SWIPE_CONFIG.horizontalRatio) {
      this.phase = 'triggered';
      this.cooldownUntil = at + SWIPE_CONFIG.cooldownMs;
      this.anchor = this.settled = null;
      return this.result(true, 'triggered', this.lockedDirection);
    }
    return this.result(true, 'below-trigger-threshold');
  }
}
