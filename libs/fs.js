"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const util_1 = require("util");
const existAsync = util_1.promisify(fs.exists);
exports.existAsync = existAsync;
const readFileAsync = util_1.promisify(fs.readFile);
exports.readFileAsync = readFileAsync;
