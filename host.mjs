import Ship from './public/src/ship.mjs'
import WebSocket from 'ws'
import { performance } from 'perf_hooks'
import words from './words.json'

const TICK = 16
const UPDATE_INTERVAL = process.env.INTERVAL || 100
const MAX_APPLIED_NULLS = 10

export default class Host {
  constructor(server) {
    this.wss = new WebSocket.Server({ server, clientTracking: true })
    this.entities = {}
    this.nextId = 0
    this.time = 0
    this.events = []

    this.wss.on('connection', socket => this.addClient(socket))

    this.time = performance.now()
    setInterval(this.update.bind(this), UPDATE_INTERVAL)
  }
  addClient(socket) {
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
    this.events.push({ msg: `${name} joined.` })

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
      this.events.push({ msg: `${name} left.` })
    })
  }
  update() {
    const now = performance.now()
    const sockets = Array.from(this.wss.clients.values())
    const simTime = now - this.time
    const ticks = Math.floor(simTime / TICK)
    this.time += ticks * TICK

    if (!sockets.length) return

    for (let t = 0; t < ticks; t++) {
      const entities = Object.values(this.entities)
      const children = []
      entities.forEach(en => this.simulate(en, sockets, children))
      entities.forEach(en1 => {
        entities.forEach(en2 => this.interact(en1, en2))
      })
      children.forEach(child => this.createDelete(child))
    }

    this.wss.clients.forEach(socket => this.sendState(socket))
    this.events = []
  }
  simulate(en, sockets, children) {
    const socket = sockets.find(s => s.id === en.id)
    if (!socket) {
      const ch = en.simulate(TICK) || []
      children.push(...ch)
      return
    }

    const input = socket.inputs.shift()
    if (!input) {
      const ch = en.simulate(TICK) || []
      children.push(...ch)
      socket.appliedNulls = Math.min(socket.appliedNulls + 1, MAX_APPLIED_NULLS)
      return
    }

    if (input.z && socket.appliedNulls > 0) { // ignorable input
      socket.appliedNulls--
    } else {                                  // unignorable input
      const ch = en.simulate(TICK, input) || []
      children.push(...ch)
    }
    socket.applied = input.n
  }
  interact(en1, en2) {
    const ev = en1.interact(TICK, en2) || []
    this.events.push(...ev)
  }
  createDelete(child) {
    if (child.id && this.entities[child.id]) {
      delete this.entities[child.id]
      return
    }
    child.id = this.nextId++
    this.entities[child.id] = child
  }
  sendState(socket) {
    if (socket.readyState !== WebSocket.OPEN) return

    const state = {
      time: this.time,
      entities: this.entities,
      sequence: socket.applied,
      events: this.events,
    }
    const msg = JSON.stringify({ type: 'state', state })
    socket.send(msg)
  }
}

function pilotName() {
  const fi = Math.floor(Math.random() * words.adjectives.length)
  const first = words.adjectives[fi][0].toUpperCase() + words.adjectives[fi].slice(1)
  const animals = words.animals.filter(n => n[0].toLowerCase() === first[0].toLowerCase())
  if (!animals.length) return pilotName()

  const li = Math.floor(Math.random() * animals.length)
  const last = animals[li][0].toUpperCase() + animals[li].slice(1)
  return `${first} ${last}`
}