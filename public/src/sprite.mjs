export default class Sprite {
  constructor(srcList, duration = 1) {
    this.waiting = 0
    this.duration = duration
    this.images = srcList.map(src => {
      this.waiting++
      const img = new Image()
      img.src = src
      img.addEventListener('load', () => this.waiting--)
      return img
    })
  }
  ready() {
    return this.waiting === 0
  }
  frame(n) {
    if (!this.ready()) return
    const i = Math.floor(n / this.duration) % this.images.length
    return this.images[i]
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
  console.log(canvas.width, canvas.height)  // TODO: remove this hack
  return canvas.toDataURL()
}