import Entity from './entity.mjs'
import Missile from './missile.mjs'

const TURN_SPEED = 1
const SPEED = 150
const TELEPORT_LIMIT = 100
const BULLET_DAMAGE = 0.008
const BULLET_DISTANCE = 1000
const TARGETING_ANGLE = Math.PI / 32

export default class Ship extends Entity {
  constructor(state) {
    super(state)
    this.t = 1  // type
    this.a = 0  // angle
    this.f = 0  // firing
    this.h = 1  // health
    Object.assign(this, state)
  }
  interpolate(prev, next, t) {
    // create or destroy
    if (!prev) return next
    if (!next) return prev

    this.f = next.f
    this.h = next.h

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
  }
  interact(tick, other) {
    if (!this.f) return
    if (other.t !== 1) return
    if (!other.h) return

    const dx = other.x - this.x
    const dy = other.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > BULLET_DISTANCE) return

    const angleToEnemy = Math.atan2(dy, dx)
    const angleFacing = this.a - Math.PI / 2
    const targetAngle = Math.abs(angleFacing - angleToEnemy)
    if (targetAngle > TARGETING_ANGLE) return

    other.h = Math.max(other.h - BULLET_DAMAGE, 0)
  }
}