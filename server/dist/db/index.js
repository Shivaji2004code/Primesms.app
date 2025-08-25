"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
const env_1 = require("../utils/env");
const pool = new pg_1.Pool({
    host: env_1.env.database.host,
    port: env_1.env.database.port,
    database: env_1.env.database.database,
    user: env_1.env.database.user,
    password: env_1.env.database.password,
});
exports.pool = pool;
exports.default = pool;
