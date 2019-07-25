require('dotenv').config();
var express = require('express');
var bodyParser = require("body-parser");
var fs = require('fs');
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var config = {
    servicePort: process.env.SERIVCE_PORT || 3000,
    dataDir: process.env.DATA_DIR || 'data',
    backupFile: process.env.BACKUP_FILE || 'data/values.json',
    backupInterval: process.env.BACKUP_INTERVAL || 60000,
};

var valuesMap = {

};

if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir);
}

if (fs.existsSync(config.backupFile)) {
    valuesMap = JSON.parse(fs.readFileSync(config.backupFile));
}

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

function backup(){
    fs.writeFile(
        config.backupFile, 
        JSON.stringify(valuesMap), 
        function (err) {
            if (err) {
                console.log('Backup failed:' + err);
            }
            setTimeout(backup, config.backupInterval)
        }
    );
}

setTimeout(backup, config.backupInterval);

process.on('SIGINT', (code) => {
    fs.writeFileSync(
        config.backupFile,
        JSON.stringify(valuesMap)
    );
    console.log('Process exit.')
    process.exit('SIGINT');
});