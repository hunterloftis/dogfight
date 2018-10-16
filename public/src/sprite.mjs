export default class Sprite {
  constructor(srcList, duration = 1) {
    this.pending = srcList
    this.duration = duration
    this.images = []
  }
  async load() {
    return new Promise((resolve, reject) => {
      let loading = this.pending.length
      if (!loading) return resolve()

      this.images = this.pending.map(src => {
        const img = new Image()
        img.addEventListener('load', () => {
          if (--loading === 0) {
            this.pending = []
            resolve()
          }
        })
        img.src = src
        return img
      })
    })
  }
  frame(n) {
    if (this.pending.length) return
    const i = Math.floor(n / this.duration) % this.images.length
    return this.images[i]
  }
  frames() {
    return this.images.length
  }
  shadowed(scale = 1) {
    const srcList = this.images.map(img => shadow(img, scale))
    return new Sprite(srcList, this.duration)
  }
}

function shadow(img, scale) {
  const canvas = document.createElement('canvas')
  canvas.width = img.width * scale
  canvas.height = img.height * scale
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas.toDataURL()
}