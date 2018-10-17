import Socket from './socket.mjs'
import Ship from './ship.mjs'
import Missile from './missile.mjs'
import Keyboard from './keyboard.mjs'
import View from './view.mjs'

const MAX_LAG = 200
const TICK = 16
const INPUT_LIMIT = 32

export default class Client {
  constructor(url, canvas) {
    this.update = this.update.bind(this)
    this.sock = new Socket(url)
    this.keys = new Keyboard()
    this.view = new View(canvas)
    this.id = undefined
    this.name = ''
    this.entities = {}
    this.history = []
    this.inputs = []
    this.sequence = 0
    this.inputTime = performance.now()
    this.frameTime = this.inputTime
    this.historyTime = 0
    this.debug = {
      authority: true,
      prediction: true,
      interpolation: true,
      viewState: true,
    }
    document.addEventListener('keypress', this.onKey.bind(this))
    requestAnimationFrame(this.update)
  }
  onKey(e) {
    if (e.keyCode === 49) this.debug.authority = !this.debug.authority
    if (e.keyCode === 50) this.debug.prediction = !this.debug.prediction
    if (e.keyCode === 51) this.debug.interpolation = !this.debug.interpolation
    if (e.keyCode === 52) this.debug.viewState = !this.debug.viewState
  }
  update() {
    const now = performance.now()

    this.processInput(now)
    this.processMessages()
    this.updateHistory(now)
    this.updateEntities()
    this.predictLocal()
    this.render()

    requestAnimationFrame(this.update)
  }
  // TODO: some way to gradually dampen new input when
  // the queue is beyond a certain point, without jarring.
  processInput(now) {
    const keys = this.keys.pressed()
    const isNull = Object.keys(keys).length ? 0 : 1
    const ticks = Math.floor((now - this.inputTime) / TICK)

    this.inputTime += ticks * TICK

    // add new input for this frame and send a copy to the host
    for (let t = 0; t < ticks; t++) {
      if (this.inputs.length < INPUT_LIMIT) {
        const input = { ...keys, n: this.sequence++, z: isNull } // state, sequence, isNull
        this.inputs.push(input)
        this.sock.send(input) // TODO: is there a way to send less data? for example, send the # of empty inputs before a new input and have them filled in on the other side
      }
    }
  }
  processMessages() {
    this.sock.receive().forEach(msg => {
      if (msg.type === 'hello') {
        this.id = msg.id
        this.name = msg.name
        return
      }
      if (msg.type === 'state') { // state: { time, entities, sequence }
        this.history.push(msg.state)
        return
      }
    })
  }
  updateHistory(now) {
    const delta = now - this.frameTime
    this.frameTime = now
    if (this.history.length < 2) return

    if (!this.historyTime) {
      this.historyTime = this.history[0].time
    }

    // advance the "playback time" playing through authoritative state snapshots
    const max = this.history.length - 1
    const last = this.history[max]
    this.historyTime = Math.max(this.historyTime + delta, last.time - MAX_LAG)

    // discard old history (always keep the most recent 2 states)
    this.history = this.history.slice(-2)
  }
  updateEntities() {
    const prev = this.history[0]
    const next = this.history[1]
    if (!prev || !next) return

    // ensure that entities all have counterparts in the prev state
    this.entities = matchOrCreate(this.entities, prev.entities)

    // interpolate non-controlled entities between the last two authoritative states
    const tween = (this.historyTime - prev.time) / (next.time - prev.time)
    const entities = Object.values(this.entities)
    entities.forEach(en => {
      if (en.id === this.id) {  // don't interpolate controlled entities
        en.setState(next.entities[en.id])
        return
      }
      if (this.debug.interpolation) {
        en.interpolate(prev.entities[en.id], next.entities[en.id], tween)
      } else {
        en.setState(next.entities[en.id])
      }
    })
  }
  predictLocal() {
    if (!this.debug.prediction) {
      this.inputs = []
      return
    }

    const next = this.history[1]
    const controlled = this.entities[this.id]
    if (!next) return
    if (!controlled) return

    // clear acknowledged inputs
    this.inputs = this.inputs.filter(i => i.n > next.sequence)

    // simulate controlled entity
    for (let i = 0; i < this.inputs.length; i++) {
      controlled.simulate(TICK, this.inputs[i])
    }
  }
  render() {
    const prev = this.history[0]
    const next = this.history[1]
    if (!prev || !next) return

    const entities = Object.values(this.entities)
    const time = {
      history: this.historyTime,
      predict: next.time + this.inputs.length * TICK,
      latest: next.time,
    }
    this.view.render(entities, this.id, time, this.debug)
  }
}

// TODO: de-hack. Central createEntity() system that has Ship & Missile?
function matchOrCreate(entities1, entities2) {
  const ids = Object.keys(entities2)
  return ids.reduce((obj, id) => {
    const e = entities1[id]
    if (e) obj[id] = e
    else {
      const state = entities2[id]
      if (state.t === 1) obj[id] = new Ship(state)
      else if (state.t === 2) {
        obj[id] = new Missile(state)
      }
    }
    return obj
  }, {})
}

function between(n, lower, upper) {
  return Math.min(Math.max(n, lower), upper)
}