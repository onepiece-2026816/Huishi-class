import { CoursewareSwipe } from './coursewareSwipe.ts';
import { HandTargetTracker, type HandCandidate } from './handTargetTracker.ts';

/** Shared camera-to-navigation pipeline, also exercised by browser replay tests. */
export class CoursewareSwipeInput {
  private tracker = new HandTargetTracker({ confirmationMs: 180 });
  private swipe = new CoursewareSwipe();
  private targetSide: HandCandidate['side'];

  constructor(targetSide: HandCandidate['side'] = 'Left') {
    this.targetSide = targetSide;
  }

  reset() {
    this.tracker.reset('single');
    this.swipe.reset();
  }

  update(candidates: HandCandidate[], at: number, aspect: number) {
    const swipeCandidates = candidates
      .filter((hand) => hand.side === this.targetSide && hand.confidence >= .75)
      // CoursewareSwipe intentionally owns the left-hand gesture contract.
      // Normalize a caller's semantic label after selecting the physical hand.
      .map((hand) => hand.side === 'Left' ? hand : { ...hand, side: 'Left' as const });
    const hands = this.tracker.update(swipeCandidates, at, 'single');
    const left = hands.active.left;
    const result = this.swipe.update(left && !left.stale && hands.phase === 'locked' ? left.landmarks : null, at, left?.side || 'Left', aspect);
    return { ...result, tracking: hands.phase };
  }
}
