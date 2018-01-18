const http = require('http')
const dns = require('dns')
const fs = require('fs')
const urlParse = require('url-parse')

const server = http.createServer((req, res) => {
  console.log('Request Coming', req.url)
  fs.readFile('./data/data.json', (err, data) => {
    if (err) {
      res.statusCode = 500
      res.end('Err', 500)
      return
    }
    try {
      const config = JSON.parse(data.toString()).mockConfigs
      const requestHost = req.headers.host
      if (Object.keys(config).indexOf(requestHost) === -1) {
        res.statusCode = 404
        res.end('NOT_FOUND')
        return
      }
      const configPaths = config[requestHost]
      let matchedResult = null
      const isMatched = Object.keys(configPaths).some(key => {
        if (urlParse(req.url).pathname === urlParse(key).pathname) {
          matchedResult = configPaths[key]
          return true
        }
        return false
      })
      if (isMatched) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('X-Powered-By', 'Mocker')
        console.log(`Hit ${req.url}`)
        res.end(JSON.stringify(matchedResult))
        return
      }
      dns.lookup(req.headers.host, {
        family: 4
      }, (err, data) => {
        if (err) {
          console.log('DNS Lookup Error')
          res.statusCode = 404
          res.end('NOT_FOUND')
          return
        }
        if (data === '127.0.0.1') {
          console.log('Refuse to do a Local Proxy')
          res.statusCode = 404
          res.end('NOT_FOUND')
          return
        }
        const outRequest = http.request({
          host: req.headers.host,
          headers: req.headers,
          method: req.method,
          path: req.url
        }, function (outResponse) {
          outResponse.pipe(res);
          outResponse.on('end', function () {
            console.log(`Proxy ${req.url}`)
          })
          outResponse.on('error', function (err) {
            console.log(`Proxy Response Error ${err}`)
            res.statusCode = 500
            res.end('Err', 500)
            return
          })
        })
        outRequest.on('error', function (err) {
          console.log(`Proxy Request Error ${err}`)
          res.statusCode = 500
          res.end('Err', 500)
          return
        })
        if (/POST|PUT/i.test(req.method)) {
          req.pipe(outRequest);
        } else {
          outRequest.end();
        }
      })
      return
    } catch (err) {
      res.statusCode = 500
      res.end(err + '', 500)
    }

    res.end('OK', 200)
  })
})

server.listen(80, function (err) {
  console.log('Server Started!')
})