import * as dns from 'dns'
import { IncomingMessage, request as httpRequest, ServerResponse } from 'http'
import * as path from 'path'
import * as urlParse from 'url-parse'
import { promisify } from 'util'
import { existAsync } from './fs'

const DATA_JSON_FILE_PATH = path.resolve(__dirname, '../data/data.json')
const dnsLookup = promisify(dns.lookup)

/**
 * Mocking server handler.
 *
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 */
async function handler (req: IncomingMessage, res: ServerResponse) {
  // Check whether incoming hostname or url is undefined.
  const requestHost = req.headers.host
  const requestUrl = req.url

  if (typeof requestHost === 'undefined') {
    return responseToClient(res, 500, 'Incoming hostname is undefined')
  }

  if (typeof requestUrl === 'undefined') {
    return responseToClient(res, 500, 'Incoming url is undefined')
  }

  console.log('Request Coming', req.url)

  // Check whether config file exists.
  const { data: mockConfigFileExist } = await checkMockConfigFile()
  if (!mockConfigFileExist) {
    return responseToClient(res, 500, 'Mock config file is not exist')
  }

  // Read its content.
  const dataJsonContent = require(DATA_JSON_FILE_PATH)
  const mockConfig: IMockConfig = dataJsonContent.mockConfigs || {}

  if (!checkHostIsKnown(requestHost, mockConfig)) {
    return responseToClient(res, 404, 'No mocking data found')
  }

  const hostMocks = mockConfig[requestHost] || {}
  const requestPath = urlParse(requestUrl).pathname
  const matchedResult = hostMocks[requestPath]

  // Mocking data found, send to client.
  if (matchedResult) {
    console.log(`Hit ${req.url}`)
    return sendMockData(res, JSON.stringify(matchedResult))
  }

  // No mocking data found, try to proxy to remote.
  const isLocalHost = await checkIfLocalHost(requestHost)
  if (isLocalHost) {
    return responseToClient(res, 403, 'Refuse to proxy a local host')
  }

  // Proxy.
  proxying(req, res)
}

export {
  handler,
}

/**
 * Send response to client.
 *
 * @param {"http".ServerResponse} res
 * @param {number} statusCode
 * @param {string} content
 */
function responseToClient (res: ServerResponse, statusCode = 500, content: string) {
  res.statusCode = statusCode
  res.end(content)
}

/**
 * Check whether config json exists.
 *
 * @return {Promise<IAsyncData<boolean>>}
 */
async function checkMockConfigFile (): Promise<IAsyncData<boolean>> {
  const isDataFileExist = await existAsync(DATA_JSON_FILE_PATH)
  return {
    data: isDataFileExist,
    error: null
  }
}

/**
 * Send mock data to client.
 *
 * @param {"http".ServerResponse} res
 * @param {string} mockingData
 */
function sendMockData (res: ServerResponse, mockingData: string) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Powered-By', 'Mocker')
  responseToClient(res, 200, mockingData)
}

/**
 * Check if a host is targeted to a local address.
 *
 * @param {string} requestHost
 * @return {Promise<IAsyncData<boolean>>}
 */
async function checkIfLocalHost (requestHost: string): Promise<IAsyncData<boolean>> {
  let data: boolean = null
  let error: Error = null

  try {
    const { address } = await dnsLookup(requestHost, {
      family: 4
    })

    data = address === '127.0.0.1'
  } catch (err) {
    error = err
  }

  return {
    data, error
  }
}

/**
 * Chcek wheter a hostname is known.
 *
 * @param {string} hostname
 * @param {IMockConfig} mockConfig
 */
function checkHostIsKnown (hostname: string, mockConfig: IMockConfig) {
  const knownHostnames = Object.keys(mockConfig)
  return knownHostnames.indexOf(hostname) > -1
}

function proxying (req: IncomingMessage, res: ServerResponse): void {
  const options = {
    headers: req.headers,
    host: req.headers.host,
    method: req.method,
    path: req.url
  }

  const proxyRequest = httpRequest(options, (response) => {
    response.pause()
    res.writeHead(response.statusCode, response.headers)
    response.pipe(res, { end: true })
    response.resume()

    response.on('end', () => {
      console.log(`Proxy ${req.url}`)
    })

    response.on('error', (error) => {
      responseToClient(
        res,
        500,
        'Error occurred when receiving proxy response: ' + error.message
      )
    })
  })

  proxyRequest.on('error', (error) => {
    responseToClient(
      res,
      500,
      'Error occurred when sending proxy request: ' + error.message
    )
  })

  req.pipe(proxyRequest, {
    end: true
  })
}

interface IMockConfig {
  [hostname: string]: IHostMocks
}

interface IHostMocks {
  [url: string]: IHostMockItem
}

interface IHostMockItem {
  code: number
  msg: string
  data: any
}

interface IAsyncData <T> {
  data: T
  error: Error
}
