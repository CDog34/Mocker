"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const dns = require("dns");
const http_1 = require("http");
const path = require("path");
const urlParse = require("url-parse");
const util_1 = require("util");
const fs_1 = require("./fs");
const DATA_JSON_FILE_PATH = path.resolve(__dirname, '../data/data.json');
const dnsLookup = util_1.promisify(dns.lookup);
/**
 * Mocking server handler.
 *
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 */
function handler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        // Check whether incoming hostname or url is undefined.
        const requestHost = req.headers.host;
        const requestUrl = req.url;
        if (typeof requestHost === 'undefined') {
            return responseToClient(res, 500, 'Incoming hostname is undefined');
        }
        if (typeof requestUrl === 'undefined') {
            return responseToClient(res, 500, 'Incoming url is undefined');
        }
        console.log('Request Coming', req.url);
        // Check whether config file exists.
        const { data: mockConfigFileExist } = yield checkMockConfigFile();
        if (!mockConfigFileExist) {
            return responseToClient(res, 500, 'Mock config file is not exist');
        }
        // Read its content.
        const dataJsonContent = require(DATA_JSON_FILE_PATH);
        const mockConfig = dataJsonContent.mockConfigs || {};
        if (!checkHostIsKnown(requestHost, mockConfig)) {
            return responseToClient(res, 404, 'No mocking data found');
        }
        const hostMocks = mockConfig[requestHost] || {};
        const requestPath = urlParse(requestUrl).pathname;
        const matchedResult = hostMocks[requestPath];
        // Mocking data found, send to client.
        if (matchedResult) {
            console.log(`Hit ${req.url}`);
            return sendMockData(res, JSON.stringify(matchedResult));
        }
        // No mocking data found, try to proxy to remote.
        const isLocalHost = yield checkIfLocalHost(requestHost);
        if (isLocalHost) {
            return responseToClient(res, 403, 'Refuse to proxy a local host');
        }
        // Proxy.
        proxying(req, res);
    });
}
exports.handler = handler;
/**
 * Send response to client.
 *
 * @param {"http".ServerResponse} res
 * @param {number} statusCode
 * @param {string} content
 */
function responseToClient(res, statusCode = 500, content) {
    res.statusCode = statusCode;
    res.end(content);
}
/**
 * Check whether config json exists.
 *
 * @return {Promise<IAsyncData<boolean>>}
 */
function checkMockConfigFile() {
    return __awaiter(this, void 0, void 0, function* () {
        const isDataFileExist = yield fs_1.existAsync(DATA_JSON_FILE_PATH);
        return {
            data: isDataFileExist,
            error: null
        };
    });
}
/**
 * Send mock data to client.
 *
 * @param {"http".ServerResponse} res
 * @param {string} mockingData
 */
function sendMockData(res, mockingData) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Powered-By', 'Mocker');
    responseToClient(res, 200, mockingData);
}
/**
 * Check if a host is targeted to a local address.
 *
 * @param {string} requestHost
 * @return {Promise<IAsyncData<boolean>>}
 */
function checkIfLocalHost(requestHost) {
    return __awaiter(this, void 0, void 0, function* () {
        let data = null;
        let error = null;
        try {
            const { address } = yield dnsLookup(requestHost, {
                family: 4
            });
            data = address === '127.0.0.1';
        }
        catch (err) {
            error = err;
        }
        return {
            data, error
        };
    });
}
/**
 * Chcek wheter a hostname is known.
 *
 * @param {string} hostname
 * @param {IMockConfig} mockConfig
 */
function checkHostIsKnown(hostname, mockConfig) {
    const knownHostnames = Object.keys(mockConfig);
    return knownHostnames.indexOf(hostname) > -1;
}
function proxying(req, res) {
    const options = {
        headers: req.headers,
        host: req.headers.host,
        method: req.method,
        path: req.url
    };
    const proxyRequest = http_1.request(options, (response) => {
        response.pause();
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res, { end: true });
        response.resume();
        response.on('end', () => {
            console.log(`Proxy ${req.url}`);
        });
        response.on('error', (error) => {
            responseToClient(res, 500, 'Error occurred when receiving proxy response: ' + error.message);
        });
    });
    proxyRequest.on('error', (error) => {
        responseToClient(res, 500, 'Error occurred when sending proxy request: ' + error.message);
    });
    req.pipe(proxyRequest, {
        end: true
    });
}
