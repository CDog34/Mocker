"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const handler_1 = require("./libs/handler");
const server = http_1.createServer(handler_1.handler);
server.listen(80, (error) => {
    if (error) {
        console.error('[Error] Error occured when creating server:', error);
        process.exit(1);
    }
    console.log('Server Started!');
});
