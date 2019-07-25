require('dotenv').config();
var express = require('express');
var bodyParser = require("body-parser");
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var config = {
    servicePort: process.env.SERIVCE_PORT || 3000
};

var valuesMap = {

};

app.post('/set', function (req, res) {
    for (let i in req.body) {
        valuesMap[i] = {
            value: req.body[i],
            updated: (new Date()).getTime()
        };
    }
    res.send({
        result: 'success'
    });
});

app.get('/get/:key', function (req, res) {
    let key = req.params.key;
    if (key in valuesMap) {
        res.send(valuesMap[key]);
    } else {
        res.send({
            value: null
        });
    }
});

app.get('/raw/:key', function (req, res) {
    let key = req.params.key;
    if (key in valuesMap) {
        res.send(valuesMap[key].value);
    } else {
        res.send('');
    }
});

app.listen(config.servicePort, function () {
  console.log('Listening on port ' + config.servicePort);
});