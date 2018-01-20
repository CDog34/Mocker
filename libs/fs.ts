import * as fs from 'fs'
import { promisify } from 'util'

const existAsync = promisify(fs.exists)
const readFileAsync = promisify(fs.readFile)

export {
  existAsync,
  readFileAsync
}
