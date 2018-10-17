import Sprite from './sprite.mjs'

const SHADOW_DISTANCE = 128
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
    this.planeLayer = newCanvas(WIDTH + 512, HEIGHT + 512)

    this.load()
    this.drawBg()
    this.resize()
    window.addEventListener('resize', e => this.resize())
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
  async drawBg() {
    const ctx = this.bgLayer.ctx
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    const grassSprite = new Sprite(['/img/grass-0.png', '/img/grass-1.png', '/img/grass-2.png', '/img/grass-3.png'], 1)
    await grassSprite.load()
    let w = grassSprite.frame(0).width
    let h = grassSprite.frame(0).height
    for (let y = 0; y < HEIGHT; y += h) {
      for (let x = 0; x < WIDTH; x += w) {
        const i = Math.floor(Math.random() * grassSprite.frames() + 1) % grassSprite.frames()
        const tile = grassSprite.frame(i)
        ctx.drawImage(tile, x, y)
      }
    }
  }
  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }
  render(entities, id, time, events, debug) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    const planes = entities.filter(en => en.t === 1)
    const player = planes.find(en => en.id === id)
    this.frame++

    // draw planes
    this.renderPlanes(planes, this.planeLayer.el, this.planeLayer.ctx, debug.viewState)

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
    this.ctx.drawImage(this.bgLayer.el, -this.bgLayer.el.width, -this.bgLayer.el.height)  // upper-left
    this.ctx.drawImage(this.bgLayer.el, 0, -this.bgLayer.el.height) // upper-right
    this.ctx.drawImage(this.bgLayer.el, -this.bgLayer.el.width, 0)  // lower-left
    this.ctx.drawImage(this.bgLayer.el, 0, 0) // lower-right

    // draw boundary
    this.renderBoundary(ctx)

    // draw shadows & smoke
    if (debug.viewState) {
      this.renderShadows(planes, ctx)
      this.renderPuffs(ctx)
    } else {
      this.puffs.clear()
    }

    // copy plane layer
    ctx.drawImage(this.planeLayer.el, -this.planeLayer.el.width * 0.5, -this.planeLayer.el.height * 0.5)

    // draw bullets
    if (debug.viewState) {
      this.renderBullets(ctx, this.planeLayer.el, this.planeLayer.ctx)
    } else {
      this.bullets.clear()
    }

    // transform back from player orientation
    ctx.restore()

    // draw debug info
    this.renderDebug(ctx, w, h, time, debug)

    // draw pilot name
    this.renderPlayer(player, ctx, w)

    // draw events
    this.renderEvents(events, ctx)
  }
  renderPlanes(planes, canvas, ctx, viewState) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(canvas.width * 0.5, canvas.height * 0.5)

    planes.forEach(plane => {
      // dead planes
      if (plane.h <= 0) {
        if (plane.h < -1) return
        if (!viewState) return

        const fireIm = this.fireSprite.frame(this.frame)
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
            x: plane.x + Math.cos(angle - Math.PI / 2 * 1.1) * planeIm.width * 0.25,
            y: plane.y + Math.sin(angle - Math.PI / 2 * 1.1) * planeIm.width * 0.25,
            life: PUFF_LIFE,
            i: Math.floor(Math.random() * 3),
          })
        } else if ((this.frame + 4) % 8 === 0) {
          const angle = plane.a - Math.PI / 2
          this.puffs.add({
            x: plane.x + Math.cos(angle + Math.PI / 2 * 1.1) * planeIm.width * 0.25,
            y: plane.y + Math.sin(angle + Math.PI / 2 * 1.1) * planeIm.width * 0.25,
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

    ctx.restore()
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
  renderBullets(ctx, hitCanvas, hitCtx) {
    const x0 = hitCanvas.width * 0.5
    const y0 = hitCanvas.height * 0.5
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
        const pix = hitCtx.getImageData(x0 + b.x, y0 + b.y, 1, 1).data
        if (pix[3] > 0) {
          ctx.drawImage(sparkIm, b.x - sparkIm.width * 0.5, b.y - sparkIm.height * 0.5)
          this.bullets.delete(b)
        }
      }
    })
  }
  renderBoundary(ctx) {
    ctx.save()
    ctx.lineWidth = 8
    ctx.strokeStyle = '#f90'
    ctx.beginPath()
    ctx.rect(-WIDTH * 0.5, -HEIGHT * 0.5, WIDTH, HEIGHT)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }
  renderDebug(ctx, w, h, time, debug) {
    ctx.save()
    if (this.frame % 20 === 0) {
      this.histT = Math.round(time.history)
      this.predT = Math.round(time.predict)
      this.lateT = Math.round(time.latest)
    }
    const predict = debug.prediction ? this.predT - this.histT : 0
    const behind = debug.interpolation ? this.lateT - this.histT : 0
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fff'
    ctx.font = '18px sans-serif'
    const stats = [
      `1. Authority: ${debug.authority ? '✅' : '❌'}`,
      `2. Prediction: ${debug.prediction ? '✅' : '❌'}`,
      `3. Interpolation: ${debug.interpolation ? '✅' : '❌'}`,
      `4. View-Model: ${debug.viewState ? '✅' : '❌'}`,
      '',
      `predicting: ${predict} ms`,
      `${behind >= 0 ? 'interpolating' : 'extrapolating'}: ${Math.abs(behind)} ms`,
    ]
    stats.forEach((str, i) => {
      ctx.fillText(str, w - 32, 64 + i * 32)
    })
    ctx.restore()
  }
  renderEvents(events, ctx) {
    ctx.save()
    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'
    ctx.font = '18px sans-serif'
    events.forEach((e, i) => {
      ctx.fillText(e.msg, 32, 64 + i * 32)
    })
    ctx.restore()
  }
  renderPlayer(player, ctx, w) {
    if (!player) return
    const name = `Capt. ${player.name}`
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 4
    ctx.font = '24px serif'
    ctx.textAlign = 'center'
    ctx.strokeText(name, w * 0.5, 33)
    ctx.fillText(name, w * 0.5, 32)
  }
  bounds() {
    const w = this.canvas.width
    const h = this.canvas.height
    return { left: w * -0.5, right: w * 0.5, top: h * -0.5, bottom: h * 0.5 }
  }
}
