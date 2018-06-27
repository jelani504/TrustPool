const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const db = require(path.join('${__dirname}', './../../database'));
const {
  findOrCreate,
  findOrCreateUser,
} = require(path.join('${__dirname}', './../../database/helpers.js'));

const setupRouters = require('./routers');
const setupPassport = require('./passport');
const { PUBLIC_PATH } = require('./config');

const app = express();
const server = http.Server(app);
app.use(cors());
app.use(bodyParser.json());

setupRouters(app);
setupPassport(app);

app.use(express.static(PUBLIC_PATH));
module.exports.server = server;