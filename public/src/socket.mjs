export default class Socket {
  constructor(url, limit = 60) {
    this.ws = new WebSocket(url)
    this.received = []

    this.ws.addEventListener('message', e => {
      const msg = JSON.parse(e.data)
      this.received.push(msg)
      this.received = this.received.slice(-limit)
    })
    this.ws.addEventListener('close', e => {
      console.log('socket closed')
    })
  }
  receive() {
    const r = this.received
    this.received = []
    return r
  }
  send(msg) {
    if (this.ws.readyState !== WebSocket.OPEN) return false
    const str = JSON.stringify(msg)
    this.ws.send(str)
    return true
  }
}