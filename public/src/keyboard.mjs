const KEY_CODES = {
  38: 'U',
  40: 'D',
  37: 'L',
  39: 'R',
  32: 'F',
}

export default class Keyboard {
  constructor() {
    this.state = { U: false, D: false, L: false, R: false, F: false }
    document.addEventListener('keydown', this.onKey.bind(this, true))
    document.addEventListener('keyup', this.onKey.bind(this, false))
  }
  onKey(state, e) {
    const name = KEY_CODES[e.keyCode]
    if (!name) return
    this.state[name] = state
  }
  pressed() {
    const p = {}
    for (let key in this.state) {
      if (this.state[key]) p[key] = 1
    }
    return p
  }
}