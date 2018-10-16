import Sprite from './sprite.mjs'

const SHADOW_DISTANCE = 100
const BULLET_SPEED = 50
const BULLET_LIFE = 30
const PUFF_LIFE = 60

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
    this.puffs = new Set()
    this.hitMask = document.createElement('canvas')
    this.hitMask.width = 2000
    this.hitMask.height = 2000
    this.hitCtx = this.hitMask.getContext('2d')
    this.resize()
    this.load()
    window.addEventListener('resize', e => this.resize())
  }
  async load() {
    this.planes = [
      new Sprite(['/img/plane1-0.png', '/img/plane1-1.png', '/img/plane1-2.png'], 4),
      new Sprite(['/img/plane2-0.png', '/img/plane2-1.png', '/img/plane2-2.png'], 4),
      new Sprite(['/img/plane3-0.png', '/img/plane3-1.png', '/img/plane3-2.png'], 4),
    ]
    this.planes.forEach(p => p.load())
    this.grass = new Sprite(['/img/grass.png'])
    this.grass.load()
    await this.planes[0].load()
    this.shadow = this.planes[0].shadowed(0.7)
    this.shadow.load()
    this.spark = new Sprite(['/img/spark.png'])
    this.spark.load()
    this.fire = new Sprite(['/img/fire-0.png', '/img/fire-1.png', '/img/fire-2.png'], 4)
    this.fire.load()
    this.puff = new Sprite(['/img/puff-0.png', '/img/puff-1.png', '/img/puff-2.png', '/img/smoke-0.png', '/img/smoke-1.png', '/img/smoke-2.png'], 1)
    this.puff.load()
  }
  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }
  render(entities, id, historyTime, predictTime, latestTime) {
    const ctx = this.ctx
    const hit = this.hitCtx
    const w = this.canvas.width
    const h = this.canvas.height

    this.frame++

    ctx.clearRect(0, 0, w, h) // TODO: should be unnecessary
    ctx.save()

    hit.clearRect(0, 0, this.hitMask.width, this.hitMask.height)

    const player = entities.find(en => en.id === id)

    ctx.translate(w * 0.5, h * 0.6)

    if (player) {
      ctx.rotate(-player.a)
      ctx.translate(-player.x, -player.y)
    }

    // render tiles
    const tile = this.grass.frame(0)
    if (tile) {
      for (let y = -1000; y < 1000; y += tile.height) {
        for (let x = -1000; x < 1000; x += tile.width) {
          ctx.drawImage(tile, x, y)
        }
      }
    }

    // render shadows
    entities.forEach(e => {
      if (e.t === 1) {
        if (e.h <= 0) return

        const shadow = this.shadow.frame(this.frame)
        if (!shadow) return

        ctx.save()
        ctx.translate(e.x, e.y + SHADOW_DISTANCE)
        ctx.rotate(e.a)
        ctx.globalAlpha = 0.33
        ctx.drawImage(shadow, shadow.width * -0.5, shadow.height * -0.4)
        ctx.restore()
      }
    })

    // render puffs
    this.puffs.forEach(p => {
      p.life -= 1
      if (p.life <= 0) {
        this.puffs.delete(p)
        return
      }

      const puff = this.puff.frame(p.i)
      if (!puff) return

      ctx.save()
      ctx.globalAlpha = p.life / PUFF_LIFE * 0.5
      ctx.drawImage(puff, p.x - puff.width * 0.5, p.y - puff.height * 0.5)
      ctx.restore()
    })

    // render entities
    entities.forEach(e => {
      if (e.t === 1) {
        if (e.h <= 0) {
          if (e.h < -1) return
          const fire = this.fire.frame(this.frame)
          if (!fire) return
          ctx.save()
          ctx.translate(e.x, e.y)
          ctx.rotate(e.a)
          ctx.globalAlpha = 1 + e.h
          ctx.drawImage(fire, fire.width * -0.5, fire.height * -0.4)
          ctx.restore()
          return
        }

        const pi = e.id % this.planes.length
        const plane = this.planes[pi].frame(this.frame)
        if (!plane) return

        if (e.h < 0.7) {
          if (this.frame % 8 === 0) {
            const angle = e.a - Math.PI / 2
            this.puffs.add({
              x: e.x + Math.cos(angle - Math.PI / 2) * plane.width * 0.25,
              y: e.y + Math.sin(angle - Math.PI / 2) * plane.width * 0.25,
              life: PUFF_LIFE,
              i: Math.floor(Math.random() * 3),
            })
          } else if ((this.frame + 4) % 8 === 0) {
            const angle = e.a - Math.PI / 2
            this.puffs.add({
              x: e.x + Math.cos(angle + Math.PI / 2) * plane.width * 0.25,
              y: e.y + Math.sin(angle + Math.PI / 2) * plane.width * 0.25,
              life: PUFF_LIFE,
              i: Math.floor(Math.random() * 3),
            })
          }
          if (e.h < 0.3 && this.frame % 2 === 0) {
            const angle = e.a + Math.PI / 2
            this.puffs.add({
              x: e.x + Math.cos(angle) * plane.height * 0.4,
              y: e.y + Math.sin(angle) * plane.height * 0.4,
              life: PUFF_LIFE,
              i: Math.floor(3 + Math.random() * 3),
            })
          }
        }

        if (e.f && this.frame % 3 === 0) {
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

        hit.save()
        hit.translate(e.x + 1000, e.y + 1000)
        hit.rotate(e.a)
        hit.drawImage(plane, plane.width * -0.5, plane.height * -0.4)
        hit.restore()
      } else if (e.t === 2) {
        ctx.save()
        ctx.translate(e.x, e.y)
        ctx.fillStyle = '#00ffff'
        ctx.fillRect(-8, -8, 16, 16)
        ctx.restore()
      }
    })

    // render bullets
    const spark = this.spark.frame(0)
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
      const bx2 = b.x - b.vx * 1
      const by2 = b.y - b.vy * 1
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(bx2, by2)
      ctx.closePath()
      ctx.stroke()

      if (spark) {
        const pix = hit.getImageData(b.x + 1000, b.y + 1000, 1, 1).data
        if (pix[3] > 0) {
          ctx.drawImage(spark, b.x - spark.width * 0.5, b.y - spark.height * 0.5)
          this.bullets.delete(b)
        }
      }
    })

    ctx.restore()

    this.renderDebug(ctx, w, h, historyTime, predictTime, latestTime)

    // pilot name
    if (player) {
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 4
      ctx.font = '24px serif'
      ctx.textAlign = 'center'
      ctx.strokeText(player.name, w * 0.5, 33)
      ctx.fillText(player.name, w * 0.5, 32)
    }
  }
  renderDebug(ctx, w, h, historyTime, predictTime, latestTime) {
    ctx.save()
    if (this.frame % 20 === 0) {
      this.histT = Math.round(historyTime)
      this.predT = Math.round(predictTime)
      this.lateT = Math.round(latestTime)
    }
    const predict = this.predT - this.histT
    const behind = this.lateT - this.histT
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fff'
    ctx.font = '14px sans-serif'
    const stats = [`prediction (ahead): ${predict}`, `interpolation (behind): ${behind}`]
    stats.forEach((str, i) => {
      ctx.fillText(str, w - 32, 64 + i * 32)
    })
    ctx.restore()
  }
  bounds() {
    const w = this.canvas.width
    const h = this.canvas.height
    return { left: w * -0.5, right: w * 0.5, top: h * -0.5, bottom: h * 0.5 }
  }
}
