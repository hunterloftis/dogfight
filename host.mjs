import Ship from './public/src/ship.mjs'
import WebSocket from 'ws'
import { performance } from 'perf_hooks'
import words from './words.json'

const TICK = 16
const UPDATE_INTERVAL = 100

export default class Host {
  constructor(server) {
    this.wss = new WebSocket.Server({ server, clientTracking: true })
    this.entities = {}
    this.nextId = 0
    this.time = 0

    this.wss.on('connection', socket => {
      const id = this.nextId++
      const name = pilotName()
      const entity = new Ship({ id, name })
      const msg = JSON.stringify({ type: 'hello', id, name })

      this.entities[id] = entity
      socket.id = id
      socket.inputs = []
      socket.applied = 0
      socket.appliedNulls = 0
      socket.send(msg)

      socket.on('message', str => {
        const input = JSON.parse(str)
        // For demo purposes only.
        // The whole point of an authoritative server is so clients can only send input, not state.
        if (input.type === 'hacked-state') {
          entity.name = input.name
        } else {
          socket.inputs.push(input)
        }
      })

      socket.on('close', () => {
        socket.removeAllListeners()
        delete this.entities[id]
      })
    })

    this.time = performance.now()
    setInterval(this.update.bind(this), UPDATE_INTERVAL)
  }
  update() {
    const now = performance.now()
    const sockets = Array.from(this.wss.clients.values())

    const simTime = now - this.time
    const ticks = Math.floor(simTime / TICK)

    this.time += ticks * TICK

    if (!sockets.length) return

    // TODO: make clearer that every tick, we apply some kind of input
    // it's either explicit (in the queue) or implied (implied null)
    for (let t = 0; t < ticks; t++) {
      const entities = Object.values(this.entities)
      const children = []
      entities.forEach(en => {
        const socket = sockets.find(s => s.id === en.id)
        const input = socket ? socket.inputs.shift() : undefined
        if (input) {
          if (input.z && socket.appliedNulls > 0) { // ignorable input
            socket.appliedNulls--
          } else {  // unignorable input
            const ch = en.simulate(TICK, input) || []
            children.push(...ch)
          }
          socket.applied = input.n
        } else {
          const ch = en.simulate(TICK) || []
          children.push(...ch)
          if (socket) {
            socket.appliedNulls++
          }
        }
      })
      entities.forEach(en1 => {
        entities.forEach(en2 => en1.interact(TICK, en2))
      })
      children.forEach(child => {
        if (child.id && this.entities[child.id]) {
          delete this.entities[child.id]
          return
        }
        child.id = this.nextId++
        this.entities[child.id] = child
      })
    }

    this.wss.clients.forEach(socket => {
      if (socket.readyState !== WebSocket.OPEN) return

      const state = {
        time: this.time,
        entities: this.entities,
        sequence: socket.applied,
      }
      const msg = JSON.stringify({ type: 'state', state })
      socket.send(msg)
    })
  }
}

function pilotName() {
  const fi = Math.floor(Math.random() * words.adjectives.length)
  const first = words.adjectives[fi][0].toUpperCase() + words.adjectives[fi].slice(1)
  const nouns = words.nouns.filter(n => n[0].toLowerCase() === first[0].toLowerCase())
  const li = Math.floor(Math.random() * nouns.length)
  const last = nouns[li][0].toUpperCase() + nouns[li].slice(1)
  return `Capt. ${first} ${last}`
}