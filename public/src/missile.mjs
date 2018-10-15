import Entity from './entity.mjs'

const SPEED = 500

export default class Missile extends Entity {
  constructor(state) {
    super(state)
    this.t = 2 // type
    this.a = 0 // angle
    this.l = 5 // lifetime
    Object.assign(this, state)
  }
  simulate(tick) {
    const secs = tick / 1000

    this.l -= secs
    if (this.l <= 0) return [this]

    const dx = Math.cos(this.a)
    const dy = Math.sin(this.a)

    this.x += dx * secs * SPEED
    this.y += dy * secs * SPEED
  }
}