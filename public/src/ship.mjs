import Entity from './entity.mjs'
import Missile from './missile.mjs'

const TURN_SPEED = 1
const SPEED = 150
const TELEPORT_LIMIT = 100
const BULLET_DAMAGE = 0.008
const BULLET_NEAR = 300
const BULLET_FAR = 1000
const TARGET_SIZE = 256
const FASTER = 1.3
const SLOWER = 0.7
const MAP_HALF_SIZE = 1024

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
    const angle = this.a - Math.PI / 2
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)

    if (this.h <= 0) {
      this.h -= secs
      this.f = 0

      if (this.h > -4) {
        const speed = secs * SPEED * (4 + this.h) / 4
        this.x += dx * speed
        this.y += dy * speed
      }
    } else {
      if (inputs.L) this.a -= secs * TURN_SPEED
      if (inputs.R) this.a += secs * TURN_SPEED

      const speed = secs * SPEED
      this.x += dx * speed
      this.y += dy * speed
      this.f = inputs.F ? 1 : 0

      if (Math.abs(this.x) > MAP_HALF_SIZE || Math.abs(this.y) > MAP_HALF_SIZE) {
        this.h = 0
      }
    }

    // looping
    // if (this.x <= -MAP_HALF_SIZE) this.x += MAP_HALF_SIZE * 2
    // else if (this.x >= MAP_HALF_SIZE) this.x -= MAP_HALF_SIZE * 2
    // if (this.y <= -MAP_HALF_SIZE) this.y += MAP_HALF_SIZE * 2
    // else if (this.y >= MAP_HALF_SIZE) this.y -= MAP_HALF_SIZE * 2
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
    if (other.h === 0) {
      return [{ msg: `${this.name} 💥 ${other.name}!` }]
    }
  }
}

function boundAngle(a) {
  while (a < 0) a += Math.PI * 2
  return a % (Math.PI * 2)
}