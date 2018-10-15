import { PLANE_1, PLANE_2, PLANE_3, GRASS } from './images.mjs'
import Sprite from './sprite.mjs'

const PLANES = [
  new Sprite(PLANE_1, 4),
  new Sprite(PLANE_2, 4),
  new Sprite(PLANE_3, 4),
]
const GRASS_TILE = new Sprite(GRASS)
const SHADOWS = PLANES[0].shadowed(0.7)
const SHADOW_DISTANCE = 100
const BULLET_SPEED = 40
const BULLET_LIFE = 30

export default class View {
  constructor(canvas) {
    this.canvas = canvas
    this.canvas.style.background = '#000'
    this.canvas.style.position = 'absolute'
    this.canvas.style.left = 0
    this.canvas.style.top = 0
    this.ctx = canvas.getContext('2d')
    this.frame = 0
    this.bullets = new Set()
    this.resize()
    window.addEventListener('resize', e => this.resize())
  }
  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }
  render(entities, id, historyTime, predictTime, latestTime) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    this.frame++

    // ctx.fillStyle = 'rgb(0, 0, 0, 0.7)'
    // ctx.fillRect(0, 0, w, h)
    ctx.clearRect(0, 0, w, h) // TODO: should be unnecessary
    ctx.save()

    const player = entities.find(en => en.id === id)

    ctx.translate(w * 0.5, h * 0.6)
    if (player) {
      ctx.rotate(-player.a)
      ctx.translate(- player.x, - player.y)
    }

    // render tiles
    const tile = GRASS_TILE.frame(0)
    for (let y = -1000; y < 1000; y += tile.height) {
      for (let x = -1000; x < 1000; x += tile.width) {
        ctx.drawImage(tile, x, y)
      }
    }

    // render shadows
    entities.forEach(e => {
      if (e.t === 1) {
        const shadow = SHADOWS.frame(this.frame)
        if (shadow) {
          ctx.save()
          ctx.translate(e.x, e.y + SHADOW_DISTANCE)
          ctx.rotate(e.a)
          ctx.globalAlpha = 0.33
          ctx.drawImage(shadow, shadow.width * -0.5, shadow.height * -0.4)
          ctx.restore()
        }
      }
    })

    // render entities
    entities.forEach(e => {
      if (e.t === 1) {
        const pi = e.id % PLANES.length
        const plane = PLANES[pi].frame(this.frame)
        if (plane) {
          if (e.f && this.frame % 2 === 0) {
            const angle = e.a - Math.PI / 2 + (Math.random() * 0.2 - 0.1)
            this.bullets.add({
              x: e.x + Math.cos(angle) * plane.height * 0.25,
              y: e.y + Math.sin(angle) * plane.height * 0.25,
              vx: Math.cos(angle) * (BULLET_SPEED + Math.random() * 25),
              vy: Math.sin(angle) * (BULLET_SPEED + Math.random() * 25),
              life: BULLET_LIFE,
            })
          }
          ctx.save()
          ctx.translate(e.x, e.y)
          ctx.rotate(e.a)
          ctx.drawImage(plane, plane.width * -0.5, plane.height * -0.4)
          ctx.restore()
        }
      } else if (e.t === 2) {
        ctx.save()
        ctx.translate(e.x, e.y)
        ctx.fillStyle = '#00ffff'
        ctx.fillRect(-8, -8, 16, 16)
        ctx.restore()
      }
    })

    // render bullets
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#ffff99'
    ctx.lineCap = 'round'
    ctx.lineWidth = 2
    this.bullets.forEach(b => {
      b.life -= 1
      if (b.life <= 0) {
        this.bullets.delete(b)
        return
      }
      b.x += b.vx
      b.y += b.vy
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x - b.vx * 1, b.y - b.vy * 1)
      ctx.closePath()
      ctx.stroke()
    })

    ctx.restore()

    // debug info
    if (this.frame % 20 === 0) {
      this.histT = Math.round(historyTime)
      this.predT = Math.round(predictTime)
      this.lateT = Math.round(latestTime)
    }
    const predict = this.predT - this.histT
    const behind = this.lateT - this.histT
    ctx.fillStyle = '#fff'
    ctx.font = '14px sans-serif'
    ctx.fillText(`host: ${this.histT}  client: ${this.predT}  predict ahead: ${predict}  behind latest: ${behind}`, 20, 20)
  }
  bounds() {
    const w = this.canvas.width
    const h = this.canvas.height
    return { left: w * -0.5, right: w * 0.5, top: h * -0.5, bottom: h * 0.5 }
  }
}
