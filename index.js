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

app.post('/set/:key', function (req, res) {
    console.log(req.params);
    console.log(req.body);
    res.send({
        result: 'success'
    });
});

app.get('/get/:key', function (req, res) {
    let key = req.params.key;
    if (key in valuesMap) {
        req.send(valuesMap[key]);
    } else {
        req.send({
            value: null
        });
    }
});

app.get('/raw/:key', function (req, res) {
    let key = req.params.key;
    if (key in valuesMap) {
        req.send(valuesMap[key].value);
    } else {
        req.send('');
    }
});

app.listen(config.servicePort, function () {
  console.log('Listening on port ' + config.servicePort);
});