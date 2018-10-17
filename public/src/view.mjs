import Sprite from './sprite.mjs'

const SHADOW_DISTANCE = 100
const BULLET_SPEED = 50
const BULLET_LIFE = 20
const PUFF_LIFE = 60
const WIDTH = 2048
const HEIGHT = 2048

function newCanvas(width, height) {
  const el = document.createElement('canvas')
  const ctx = el.getContext('2d')
  el.width = width
  el.height = height
  return { el, ctx }
}

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

    this.bgLayer = newCanvas(WIDTH, HEIGHT)
    this.planeLayer = newCanvas(WIDTH, HEIGHT)

    this.drawBg()
    this.resize()
    this.load()
    window.addEventListener('resize', e => this.resize())
  }
  async drawBg() {
    const ctx = this.bgLayer.ctx
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    const grassSprite = new Sprite(['/img/grass.png'])
    await grassSprite.load()
    const tile = grassSprite.frame(0)
    for (let y = 0; y < HEIGHT; y += tile.height) {
      for (let x = 0; x < WIDTH; x += tile.width) {
        ctx.drawImage(tile, x, y)
      }
    }
  }
  async load() {
    this.planeSprites = [
      new Sprite(['/img/plane1-0.png', '/img/plane1-1.png', '/img/plane1-2.png'], 4),
      new Sprite(['/img/plane2-0.png', '/img/plane2-1.png', '/img/plane2-2.png'], 4),
      new Sprite(['/img/plane3-0.png', '/img/plane3-1.png', '/img/plane3-2.png'], 4),
    ]
    this.planeSprites.forEach(p => p.load())
    await this.planeSprites[0].load()
    this.shadowSprite = this.planeSprites[0].shadowed(0.7)
    this.shadowSprite.load()
    this.sparkSprite = new Sprite(['/img/spark.png'])
    this.sparkSprite.load()
    this.fireSprite = new Sprite(['/img/fire-0.png', '/img/fire-1.png', '/img/fire-2.png'], 4)
    this.fireSprite.load()
    this.puffSprite = new Sprite(['/img/puff-0.png', '/img/puff-1.png', '/img/puff-2.png', '/img/smoke-0.png', '/img/smoke-1.png', '/img/smoke-2.png'], 1)
    this.puffSprite.load()
  }
  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }
  render(entities, id, historyTime, predictTime, latestTime) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    const planes = entities.filter(en => en.t === 1)
    const player = planes.find(en => en.id === id)
    this.frame++

    // draw planes
    this.renderPlanes(planes, this.planeLayer.el, this.planeLayer.ctx)

    // clear canvas (should be unnecessary eventually)
    ctx.clearRect(0, 0, w, h)
    ctx.save()

    // transform to player orientation
    ctx.translate(w * 0.5, h * 0.6)
    if (player) {
      ctx.rotate(-player.a)
      ctx.translate(-player.x, -player.y)
    }

    // copy background layer
    this.ctx.drawImage(this.bgLayer.el, 0, 0)

    // draw shadows
    this.renderShadows(planes, ctx)

    // draw smoke
    this.renderPuffs(ctx)

    // copy plane layer
    ctx.drawImage(this.planeLayer.el, 0, 0)

    // draw bullets
    this.renderBullets(ctx, this.planeLayer.ctx)

    // transform back from player orientation
    ctx.restore()

    // draw debug info
    this.renderDebug(ctx, w, h, historyTime, predictTime, latestTime)

    // draw pilot name
    this.renderPlayer(player, ctx, w)
  }
  renderPlanes(planes, canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    planes.forEach(plane => {
      // dead planes
      if (plane.h <= 0) {
        if (plane.h < -1) return

        const fireIm = this.fire.frame(this.frame)
        if (!fireIm) return

        ctx.save()
        ctx.translate(plane.x, plane.y)
        ctx.rotate(plane.a)
        ctx.globalAlpha = 1 + plane.h
        ctx.drawImage(fireIm, fireIm.width * -0.5, fireIm.height * -0.4)
        ctx.restore()
        return
      }

      // plane image
      const pi = plane.id % this.planeSprites.length
      const planeIm = this.planeSprites[pi].frame(this.frame)
      if (!planeIm) return

      // add puffs of smoke
      if (plane.h < 0.7) {
        if (this.frame % 8 === 0) {
          const angle = plane.a - Math.PI / 2
          this.puffs.add({
            x: plane.x + Math.cos(angle - Math.PI / 2) * planeIm.width * 0.25,
            y: plane.y + Math.sin(angle - Math.PI / 2) * planeIm.width * 0.25,
            life: PUFF_LIFE,
            i: Math.floor(Math.random() * 3),
          })
        } else if ((this.frame + 4) % 8 === 0) {
          const angle = plane.a - Math.PI / 2
          this.puffs.add({
            x: plane.x + Math.cos(angle + Math.PI / 2) * planeIm.width * 0.25,
            y: plane.y + Math.sin(angle + Math.PI / 2) * planeIm.width * 0.25,
            life: PUFF_LIFE,
            i: Math.floor(Math.random() * 3),
          })
        }
        if (plane.h < 0.3 && this.frame % 2 === 0) {
          const angle = plane.a + Math.PI / 2
          this.puffs.add({
            x: plane.x + Math.cos(angle) * planeIm.height * 0.4,
            y: plane.y + Math.sin(angle) * planeIm.height * 0.4,
            life: PUFF_LIFE,
            i: Math.floor(3 + Math.random() * 3),
          })
        }
      }

      // add bullets
      if (plane.f && this.frame % 3 === 0) {
        const angle = plane.a - Math.PI / 2 + (Math.random() * 0.2 - 0.1)
        this.bullets.add({
          x: plane.x + Math.cos(angle) * planeIm.height * 0.25,
          y: plane.y + Math.sin(angle) * planeIm.height * 0.25,
          vx: Math.cos(angle) * (BULLET_SPEED + Math.random() * 25),
          vy: Math.sin(angle) * (BULLET_SPEED + Math.random() * 25),
          life: BULLET_LIFE,
        })
      }

      // draw plane
      ctx.save()
      ctx.translate(plane.x, plane.y)
      ctx.rotate(plane.a)
      ctx.drawImage(planeIm, planeIm.width * -0.5, planeIm.height * -0.4)
      ctx.restore()
    })
  }
  renderShadows(planes, ctx) {
    planes.forEach(p => {
      if (p.h <= 0) return

      const shadowIm = this.shadowSprite.frame(this.frame)
      if (!shadowIm) return

      ctx.save()
      ctx.translate(p.x, p.y + SHADOW_DISTANCE)
      ctx.rotate(p.a)
      ctx.globalAlpha = 0.33
      ctx.drawImage(shadowIm, shadowIm.width * -0.5, shadowIm.height * -0.4)
      ctx.restore()
    })
  }
  renderPuffs(ctx) {
    this.puffs.forEach(p => {
      p.life -= 1
      if (p.life <= 0) {
        this.puffs.delete(p)
        return
      }

      const puffIm = this.puffSprite.frame(p.i)
      if (!puffIm) return

      ctx.save()
      ctx.globalAlpha = p.life / PUFF_LIFE * 0.5
      ctx.drawImage(puffIm, p.x - puffIm.width * 0.5, p.y - puffIm.height * 0.5)
      ctx.restore()
    })
  }
  renderBullets(ctx, hitCtx) {
    const sparkIm = this.sparkSprite.frame(0)
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

      if (sparkIm) {
        const pix = hitCtx.getImageData(b.x, b.y, 1, 1).data
        if (pix[3] > 0) {
          ctx.drawImage(sparkIm, b.x - sparkIm.width * 0.5, b.y - sparkIm.height * 0.5)
          this.bullets.delete(b)
        }
      }
    })
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
  renderPlayer(player, ctx, w) {
    if (!player) return
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 4
    ctx.font = '24px serif'
    ctx.textAlign = 'center'
    ctx.strokeText(player.name, w * 0.5, 33)
    ctx.fillText(player.name, w * 0.5, 32)
  }
  bounds() {
    const w = this.canvas.width
    const h = this.canvas.height
    return { left: w * -0.5, right: w * 0.5, top: h * -0.5, bottom: h * 0.5 }
  }
}
