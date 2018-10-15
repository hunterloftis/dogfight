import Entity from './entity.mjs'
import Missile from './missile.mjs'

const TURN_SPEED = 1
const SPEED = 150
const TELEPORT_LIMIT = 100

export default class Ship extends Entity {
  constructor(state) {
    super(state)
    this.t = 1  // type
    this.a = 0  // angle
    this.m = 0  // missile cooldown
    this.f = 0  // firing
    Object.assign(this, state)
  }
  interpolate(prev, next, t) {
    // create or destroy
    if (!prev) return next
    if (!next) return prev

    // teleport
    if (Math.abs(prev.x - next.x) > TELEPORT_LIMIT) {
      Object.assign(this, next)
      return
    }
    if (Math.abs(prev.y - next.y) > TELEPORT_LIMIT) {
      Object.assign(this, next)
      return
    }

    this.x = prev.x + (next.x - prev.x) * t
    this.y = prev.y + (next.y - prev.y) * t
    this.a = prev.a + (next.a - prev.a) * t
    this.f = next.f
  }
  simulate(tick, inputs = {}) {
    const secs = tick / 1000

    this.m = Math.max(this.m - secs, 0)

    if (inputs.L) this.a -= secs * TURN_SPEED
    if (inputs.R) this.a += secs * TURN_SPEED

    const angle = this.a - Math.PI / 2
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)

    const speed = secs * SPEED
    this.x += dx * speed
    this.y += dy * speed

    if (this.x <= -1000) this.x += 2000
    else if (this.x >= 1000) this.x -= 2000
    if (this.y <= -1000) this.y += 2000
    else if (this.y >= 1000) this.y -= 2000

    this.f = inputs.F
    // if (inputs.F && !this.m) {
    //   this.m = 0.5
    //   return [new Missile({
    //     x: this.x + dx * 32,
    //     y: this.y + dy * 32,
    //     a: this.a
    //   })]
    // }
  }
  interact(tick, other) {

  }
}