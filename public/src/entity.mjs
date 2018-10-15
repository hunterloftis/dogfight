
export default class Entity {
  constructor(state) {
    this.x = 0
    this.y = 0
    Object.assign(this, state)
  }
  interpolate(start, end, t) {
    if (!start) return end
    if (!end) return start
    this.x = start.x + (end.x - start.x) * t
    this.y = start.y + (end.y - start.y) * t
  }
  setState(state) {
    Object.assign(this, state)
  }
  simulate(tick, inputs = {}) {

  }
  interact(tick, other) {

  }
}
