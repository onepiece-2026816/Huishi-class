import assert from 'node:assert/strict';
import test from 'node:test';
import { CoursewareSwipe } from './coursewareSwipe.ts';
import { CoursewareSwipeInput } from './coursewareSwipeInput.ts';
import { describeHandCandidate } from './handTargetTracker.ts';

const hand = (x = .5, y = .5, scale = 1, rotation = 0, joined = true) => {
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: .2 }));
  for (const [base, offset] of [[5, -.04], [9, joined ? -.02 : .12]]) {
    for (let joint = 0; joint < 4; joint++) points[base + joint] = { x: offset, y: .15 - joint * .08 };
  }
  points[17] = { x: .16, y: .15 };
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return points.map((p) => ({ x: x + scale * (p.x * c - p.y * s), y: y + scale * (p.x * s + p.y * c) }));
};

const sequence = (options: { scale?: number; rotation?: number; side?: string; joined?: boolean } = {}) => {
  const detector = new CoursewareSwipe();
  const events: string[] = [];
  let at = 0;
  const sample = (x = .5, y = .5) => {
    const result = detector.update(hand(x, y, options.scale, options.rotation, options.joined), at, options.side);
    at += 40;
    if (result.direction) events.push(result.direction);
    return result;
  };
  const hold = (x = .5, y = .5, frames = 8) => { for (let i = 0; i < frames; i++) sample(x, y); };
  const move = (from: number, to: number, yFrom = .5, yTo = .5, frames = 10) => {
    for (let i = 1; i <= frames; i++) sample(from + (to - from) * i / frames, yFrom + (yTo - yFrom) * i / frames);
  };
  return { detector, events, sample, hold, move, time: () => at };
};

test('input can select the flipped semantic side while preserving the swipe contract', () => {
  const input = new CoursewareSwipeInput('Right');
  const events: string[] = [];
  const update = (side: 'Left' | 'Right', x: number, at: number) => {
    const candidate = describeHandCandidate(hand(x), side, .95);
    assert.ok(candidate);
    const result = input.update([candidate], at, 1);
    if (result.direction) events.push(result.direction);
  };

  for (let at = 0; at <= 320; at += 40) update('Left', .5, at);
  assert.deepEqual(events, []);
  for (let at = 400; at <= 720; at += 40) update('Right', .5, at);
  for (let index = 1; index <= 10; index += 1) update('Right', .5 - .028 * index, 720 + index * 40);
  assert.deepEqual(events, ['next']);
});

test('preview-left goes back and preview-right advances with tilted hands and different distances', () => {
  for (const rotation of [0, .6, -.6, 1.2]) {
    for (const scale of [.55, 1, 1.3]) {
      const s = sequence({ rotation, scale });
      s.hold();
      s.move(.5, .78);
      assert.deepEqual(s.events, ['previous']);
      const r = sequence({ rotation, scale });
      r.hold();
      r.move(.5, .22);
      assert.deepEqual(r.events, ['next']);
    }
  }
});

test('stationary jitter, vertical, diagonal, small, right-hand and open fingers do not navigate', () => {
  for (const [dx, dy] of [[0, 0], [0, .25], [.03, 0], [.22, .22]]) {
    const s = sequence();
    s.hold();
    s.move(.5, .5 + dx, .5, .5 + dy);
    assert.deepEqual(s.events, []);
  }
  for (const options of [{ side: 'Right' }, { joined: false }]) {
    const s = sequence(options);
    s.hold(); s.move(.5, .8);
    assert.deepEqual(s.events, []);
  }
  const jitter = sequence();
  for (let i = 0; i < 100; i++) jitter.sample(.5 + Math.sin(i) * .004);
  assert.deepEqual(jitter.events, []);
});

test('joined fingers can repeat ten times each direction after settling', () => {
  const s = sequence();
  s.hold();
  for (let i = 0; i < 10; i++) {
    s.move(.5, .75); s.hold(.75, .5, 25);
    s.move(.75, .5); s.hold(.5, .5, 25);
  }
  assert.equal(s.events.length, 20);
  assert.equal(s.events.filter((value) => value === 'previous').length, 10);
  assert.equal(s.events.filter((value) => value === 'next').length, 10);
});

test('return movement and uninterrupted oscillation do not double-trigger', () => {
  const s = sequence();
  s.hold(); s.move(.5, .75);
  for (let i = 0; i < 5; i++) { s.move(.75, .5); s.move(.5, .75); }
  assert.deepEqual(s.events, ['previous']);
  s.hold(.75, .5, 25); s.move(.75, .5);
  assert.deepEqual(s.events, ['previous', 'next']);
});

test('loss, delayed frames, hand switch and invalid points discard old movement', () => {
  for (const kind of ['loss', 'delay', 'right', 'invalid']) {
    const s = sequence();
    s.hold();
    s.move(.5, .6);
    if (kind === 'loss') s.detector.update(null, s.time());
    if (kind === 'right') s.detector.update(hand(.8), s.time(), 'Right');
    if (kind === 'invalid') s.detector.update(hand().map((p) => ({ ...p, x: NaN })), s.time());
    assert.equal(s.detector.update(hand(.8), s.time() + (kind === 'delay' ? 300 : 40)).direction, null);
  }
});

test('bent fingers and transient pose do not arm', () => {
  const detector = new CoursewareSwipe();
  const bent = hand();
  bent[7].x += .15;
  for (let at = 0; at < 600; at += 40) assert.equal(detector.update(bent, at).active, false);
  detector.reset();
  detector.update(hand(), 0);
  assert.equal(detector.update(hand(.8), 80).direction, null);
});

test('slow drift does not accumulate outside the movement window', () => {
  const s = sequence();
  s.hold();
  s.move(.5, .8, .5, .5, 100);
  assert.deepEqual(s.events, []);
});

test('short swipes work after stable preparation in either direction', () => {
  for (const direction of [-1, 1]) {
    const detector = new CoursewareSwipe();
    const events = [];
    for (let at = -120; at < 0; at += 40) detector.update(hand(), at);
    for (let at = 0; at <= 160; at += 40) {
      const result = detector.update(hand(.5 + direction * .11 * at / 160), at);
      if (result.direction) events.push(result.direction);
    }
    assert.deepEqual(events, [direction > 0 ? 'previous' : 'next']);
  }
});

test('slightly bent fingers and modest diagonal swipes are accepted', () => {
  const detector = new CoursewareSwipe();
  const events = [];
  for (let at = -120; at <= 240; at += 40) {
    const points = hand(.5 + .12 * Math.max(0, at) / 240, .5 + .06 * Math.max(0, at) / 240);
    for (const base of [5, 9]) {
      points[base + 2].x += .08 * Math.sin(Math.PI / 6);
      points[base + 2].y += .08 * (1 - Math.cos(Math.PI / 6));
      points[base + 3].x += .16 * Math.sin(Math.PI / 6);
      points[base + 3].y += .16 * (1 - Math.cos(Math.PI / 6));
    }
    const result = detector.update(points, at);
    if (result.direction) events.push(result.direction);
  }
  assert.deepEqual(events, ['previous']);
});

test('brief loss preserves observed movement but excludes the recovery jump', () => {
  const detector = new CoursewareSwipe();
  for (let at = -120; at < 0; at += 40) detector.update(hand(), at);
  detector.update(hand(.5), 0);
  detector.update(hand(.53), 40);
  detector.update(hand(.55), 80);
  assert.equal(detector.update(null, 120).direction, null);
  assert.equal(detector.update(hand(.8), 160).direction, null);
  assert.equal(detector.update(hand(.81), 200).direction, null);
  assert.equal(detector.update(hand(.87), 240).direction, 'previous');
});

test('an early reversal cancels the stroke instead of navigating in the opposite direction', () => {
  for (const sign of [-1, 1]) {
    const s = sequence();
    s.hold();
    s.sample(.5 + sign * .04);
    s.sample(.5 + sign * .06);
    s.move(.5 + sign * .06, .5 - sign * .2, .5, .5, 6);
    assert.deepEqual(s.events, []);
    s.hold(.5 - sign * .2, .5, 25);
    s.move(.5 - sign * .2, .5);
    assert.deepEqual(s.events, [sign > 0 ? 'previous' : 'next']);
  }
});

test('moving immediately on acquisition cannot turn the return stroke into a page', () => {
  const s = sequence();
  s.move(.5, .75, .5, .5, 5);
  s.move(.75, .4, .5, .5, 7);
  assert.deepEqual(s.events, []);
  s.hold(.4, .5, 30);
  s.move(.4, .65);
  assert.deepEqual(s.events, ['previous']);
});

test('one second of rest refreshes the origin without consuming either direction', () => {
  for (const sign of [-1, 1]) {
    const s = sequence();
    s.hold(.5, .5, 30);
    s.move(.5, .5 + sign * .12, .5, .5, 6);
    assert.deepEqual(s.events, [sign > 0 ? 'previous' : 'next']);
  }
});

test('timed out motion cannot rebase while the hand keeps moving', () => {
  const s = sequence();
  s.hold();
  s.move(.5, .54, .5, .5, 2);
  // Move vertically enough to prevent settling while staying below horizontal trigger distance.
  for (let i = 0; i < 30; i++) s.sample(.55, .5 + Math.sin(i * .4) * .1);
  s.move(.55, .2, .5, .5, 6);
  assert.deepEqual(s.events, []);
});

test('loss beyond 100ms resets movement and brief loss cannot bypass return protection', () => {
  const detector = new CoursewareSwipe();
  detector.update(hand(.5), 0);
  detector.update(hand(.55), 40);
  detector.update(null, 80);
  assert.equal(detector.update(hand(.8), 160).direction, null);
  assert.equal(detector.update(hand(.8), 200).direction, null);
  const s = sequence();
  s.hold(); s.move(.5, .75);
  s.detector.update(null, s.time());
  s.sample(.75);
  s.move(.75, .5);
  assert.deepEqual(s.events, ['previous']);
});

test('joined fingertips swipe both ways while the palm remains stationary', () => {
  for (const sign of [-1, 1]) {
    const detector = new CoursewareSwipe();
    const events: string[] = [];
    for (let at = 0; at <= 1200; at += 40) {
      const points = hand();
      const rotation = sign * Math.max(0, Math.min(.6, (at - 320) / 600));
      for (const base of [5, 9]) {
        for (let joint = 1; joint <= 3; joint++) {
          const length = joint * .08;
          points[base + joint] = {
            x: points[base].x + length * Math.sin(rotation),
            y: points[base].y - length * Math.cos(rotation),
          };
        }
      }
      const result = detector.update(points, at);
      if (result.direction) events.push(result.direction);
    }
    assert.deepEqual(events, [sign > 0 ? 'previous' : 'next']);
  }
});

test('one uncertain pose frame preserves the stroke without triggering on recovery', () => {
  const detector = new CoursewareSwipe();
  for (let at = -120; at <= 0; at += 40) detector.update(hand(), at);
  detector.update(hand(.53), 40);
  detector.update(hand(.55), 80);
  const uncertain = hand(.57);
  uncertain[7].x += .15;
  const gap = detector.update(uncertain, 120);
  assert.equal(gap.reason, 'pose-grace');
  assert.equal(gap.direction, null);
  assert.equal(detector.update(hand(.55), 160).direction, null);
  detector.update(hand(.60), 200);
  assert.equal(detector.update(hand(.67), 240).direction, 'previous');
});

test('sustained invalid pose releases the gesture instead of extending grace forever', () => {
  const detector = new CoursewareSwipe();
  for (let at = 0; at <= 160; at += 40) detector.update(hand(), at);
  const invalid = hand();
  invalid[7].x += .15;
  assert.equal(detector.update(invalid, 200).reason, 'pose-grace');
  assert.equal(detector.update(invalid, 240).reason, 'pose-grace');
  const released = detector.update(invalid, 280);
  assert.equal(released.reason, 'pose-invalid');
  assert.equal(released.active, false);
  assert.equal(detector.update(hand(.8), 320).direction, null);
});
