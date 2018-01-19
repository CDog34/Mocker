import { createServer } from 'http'
import { handler } from './libs/handler'

const server = createServer(handler)
server.listen(80, (error: Error) => {
  if (error) {
    console.error('[Error] Error occured when creating server:', error)
    process.exit(1)
  }
  console.log('Server Started!')
})
