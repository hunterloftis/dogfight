import Entity from './entity.mjs'
import Missile from './missile.mjs'

const TURN_SPEED = 1
const SPEED = 150
const TELEPORT_LIMIT = 100
const BULLET_DAMAGE = 0.01
const BULLET_NEAR = 300
const BULLET_FAR = 1000
const TARGET_SIZE = 256

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

    if (this.h <= 0) {
      this.h -= secs
    } else {
      if (inputs.L) this.a -= secs * TURN_SPEED
      if (inputs.R) this.a += secs * TURN_SPEED
    }

    const angle = this.a - Math.PI / 2
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)

    if (this.h > 0) {
      const speed = secs * SPEED
      this.x += dx * speed
      this.y += dy * speed
    } else if (this.h > -4) {
      const speed = secs * SPEED * (4 + this.h) / 4
      this.x += dx * speed
      this.y += dy * speed
    }

    if (this.x <= -1000) this.x += 2000
    else if (this.x >= 1000) this.x -= 2000
    if (this.y <= -1000) this.y += 2000
    else if (this.y >= 1000) this.y -= 2000

    this.f = inputs.F
  }
  interact(tick, other) {
    if (!this.f) return
    if (other.t !== 1) return
    if (other.h <= 0 || this.h <= 0) return
    if (other === this) return

    const dx = other.x - this.x
    const dy = other.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > BULLET_FAR) return

    const hitAngle = Math.atan(TARGET_SIZE / (2 * dist))
    const angleToEnemy = boundAngle(Math.atan2(dy, dx))
    const angleFacing = boundAngle(this.a - Math.PI / 2)
    const targetAngle = Math.abs(angleFacing - angleToEnemy)
    if (targetAngle > hitAngle) return

    const falloff = 1 - (dist - BULLET_NEAR) / (BULLET_FAR - BULLET_NEAR)
    const damage = BULLET_DAMAGE * Math.min(falloff, 1)
    other.h = Math.max(other.h - damage, 0)
  }
}

function boundAngle(a) {
  while (a < 0) a += Math.PI * 2
  return a % (Math.PI * 2)
}