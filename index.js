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
    backupValuesFile: process.env.BACKUP_VALUES_FILE || 'data/values.json',
    backupChangesFile: process.env.BACKUP_CHANGES_FILE || 'data/changes.json',
    backupInterval: process.env.BACKUP_INTERVAL || 60000,
    changesLimit: process.env.CHANGES_LIMIT || 8640
};

var valuesMap = {

};

var changesMap = {

};

var daily = {
    dir: null,
    key: null,
    changes: {

    }
};

if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir);
}

if (fs.existsSync(config.backupValuesFile)) {
    valuesMap = JSON.parse(fs.readFileSync(config.backupValuesFile));
}

if (fs.existsSync(config.backupChangesFile)) {
    changesMap = JSON.parse(fs.readFileSync(config.backupChangesFile));
}

initRotate();

app.post('/set', function (req, res) {
    for (let i in req.body) {
        valuesMap[i] = {
            value: req.body[i],
            updated: (new Date()).getTime()
        };
        process.nextTick(function () {
            addChange(i);
        });
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

app.get('/changes/:key', function (req, res) {
    let key = req.params.key;
    if (key in daily.changes) {
        res.send({
            changes: daily.changes[key]
        });
    } else {
        res.send({
            changes: []
        });
    }
});

app.get('/today/:key', function (req, res) {
    let key = req.params.key;
    if (key in changesMap) {
        res.send({
            changes: changesMap[key]
        });
    } else {
        res.send({
            changes: []
        });
    }
});

app.listen(config.servicePort, function () {
  console.log('Listening on port ' + config.servicePort);
});

function addChange(key){
    if (!(key in changesMap)) {
        changesMap[key] = [];
    } else {
        if (changesMap[key].length >= config.changesLimit) {
            changesMap[key].splice(0, values.length - config.changesLimit + 1);
        }
    }
    changesMap[key].push(valuesMap[key]);
    checkRotate();
    if (!(key in daily.changes)) {
        daily.changes[key] = [];
    }
    daily.changes[key].push(valuesMap[key]);
}

function getDailyKey() {
    let d = new Date();
    function pad(x) {
        return (x > 9 ? '' : '0') + x;
    }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function checkRotate(){
    let curKey = getDailyKey();
    if (curKey != daily.key) {
        backupDaily();
        daily.dir = config.dataDir + '/' + curKey;
        daily.key = curKey;
        daily.changes = {};
        loadRotateIfExists();
    }
}

function initRotate(){
    let curKey = getDailyKey();
    daily.dir = config.dataDir + '/' + curKey + '/';
    daily.key = curKey;
    loadRotateIfExists();
}

function loadRotateIfExists(){
    if (!fs.existsSync(daily.dir)) {
        fs.mkdirSync(daily.dir);
        return false;
    }
    fs.readdirSync(daily.dir).forEach(function (name) {
        let segs = name.split('.');
        daily.changes[segs[0]] = JSON.parse(fs.readFileSync(daily.dir + name));
    });
    return true;
}

function backupDaily(){
    if (!fs.existsSync(daily.dir)) {
        fs.mkdirSync(daily.dir);
    }
    for (let key in daily.changes) {
        fs.writeFileSync(daily.dir + key + '.json', JSON.stringify(daily.changes[key]));
    }
}

function backupRuntime(){
    fs.writeFileSync(config.backupValuesFile, JSON.stringify(valuesMap));
    fs.writeFileSync(config.backupChangesFile, JSON.stringify(changesMap));
}

function quickBackup(){
    fs.writeFile(
        config.backupValuesFile, 
        JSON.stringify(valuesMap), 
        function (err1) {
            if (err1) {
                console.log('Backup values failed:' + err1);
            }
            fs.writeFile(
                config.backupChangesFile,
                JSON.stringify(changesMap),
                function (err2) {
                    if (err2) {
                        console.log('Backup values failed:' + err2);
                    }
                    setTimeout(quickBackup, config.backupInterval);
                } 
            )
        }
    );
}

setTimeout(quickBackup, config.backupInterval);

process.on('SIGINT', (code) => {
    backupRuntime();
    backupDaily();
    console.log('Process exit.')
    process.exit('SIGINT');
});