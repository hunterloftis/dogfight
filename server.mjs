import http from 'http'
import path from 'path'
import url from 'url'
import fs from 'fs'
import __dirname from './dirname.js'
import Host from './host.mjs'

const PORT = process.env.PORT || 3000
const PUB_DIR = path.join(__dirname, 'public')

const server = http.createServer(fileServer(PUB_DIR))
const host = new Host(server)

server.listen(PORT, () => console.log(`Server up on :${PORT}`))

function fileServer(dir) {
  return (req, res) => {
    if (req.url === '/favicon.ico') {
      res.statusCode = 204
      res.end()
      return
    }
    const filepath = pathFrom(req.url, dir, '/index.html')
    if (!filepath) {
      res.statusCode = 404
      res.end('404')
      return
    }
    const mimes = { '.html': 'text/html', '.mjs': 'text/javascript' }
    const ext = path.parse(filepath).ext
    const rs = fs.createReadStream(filepath)
    rs.on('error', err => {
      res.statusCode = 500
      res.end(`Error: ${err}`)
    })
    res.setHeader('Content-type', mimes[ext] || 'text/plain')
    rs.pipe(res)
  }
}

function pathFrom(str, dir, root) {
  const parsed = url.parse(str)
  const pathname = parsed.pathname === '/' ? root : parsed.pathname
  const filepath = path.join(dir, pathname)
  if (!filepath.startsWith(dir)) {
    return undefined
  }
  return filepath
}
