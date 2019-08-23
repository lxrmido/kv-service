require('dotenv').config();
var express = require('express');
var bodyParser = require("body-parser");
var fs = require('fs');
var app = express();
var canvas = require('canvas');

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

app.get('/today/:key', function (req, res) {
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

app.get('/changes/:key', function (req, res) {
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

app.get('/graph/:key', function (req, res) {
    let width  = 800;
    let height = 600;
    if (req.query.width && req.query.width > 0) {
        width = parseInt(req.query.width);
    }
    if (req.query.height && req.query.height > 0) {
        height = parseInt(req.query.height);
    }
    let showText = !!req.query.showtext;
    let key   = req.params.key;
    let datas = [];
    if (key in changesMap) {
        datas = changesMap[key];
    }
    let cvs = canvas.createCanvas(width, height);
    let ctx = cvs.getContext('2d');
    let calcValues = [];
    let pixWidth = 1, pixHeight = 1;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#000000';
    ctx.beginPath();

    let numberDatas = [];
    let lastUpdate = 0;

    for (let i = 0; i < datas.length; i ++) {
        if (isNaN(datas[i].value)) {
            continue;
        }
        numberDatas.push(parseFloat(datas[i].value));
        lastUpdate = datas[i].updated;
    }

    if (numberDatas.length <= 1) {
        ctx.moveTo(0, Math.floor(height / 2));
        ctx.lineTo(width - 1, Math.floor(height / 2));
    } else {
        if (width > numberDatas.length) {
            pixWidth = Math.floor(width / numberDatas.length);
            calcValues = numberDatas;
        } else {
            let valsPerPix = Math.floor(numberDatas.length / width);
            let cx = 0;
            while (cx < width) {
                let subGroup = numberDatas.slice(cx * valsPerPix, cx * valsPerPix + valsPerPix);
                if (subGroup.length > 0) {
                    calcValues.push(Math.round(subGroup.reduce((a, b) => a + b) / subGroup.length));
                }
                cx ++;
            }
        }
        let minValue = Math.min(...calcValues);
        let maxValue = Math.max(...calcValues);
        
        if (minValue == maxValue) {
            ctx.moveTo(0, Math.floor(height / 2));
            ctx.lineTo(width - 1, Math.floor(height / 2));
        } else {
            let scaleY = height / (maxValue - minValue);
            for (let i = 0; i < calcValues.length; i ++) {
                ctx.lineTo(pixWidth * i, Math.floor(scaleY * (maxValue - calcValues[i])));
            }
        }
        ctx.stroke();

        if (showText) {
            let text = numberDatas[numberDatas.length - 1] + ' / (' + Math.min(...numberDatas) + ', ' + Math.max(...numberDatas) + ')';
            let date = new Date(lastUpdate);
            let dateText = (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHour() + ':' + date.getMinute();
            ctx.font = 'bold 20px serif';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, 6, 6);
            ctx.fillText(text, 2, 2);
            ctx.fillStyle = '#000000';
            ctx.fillText(text, 4, 4);
            ctx.fillText(dateText, 4, 24);
        }


    }
    
    

    let img = cvs.toBuffer('image/jpeg', {quality: 1});
    res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': img.length
    });
    res.end(img); 
});

app.listen(config.servicePort, function () {
  console.log('Listening on port ' + config.servicePort);
});

function addChange(key){
    if (!(key in changesMap)) {
        changesMap[key] = [];
    } else {
        if (changesMap[key].length >= config.changesLimit) {
            changesMap[key].splice(0, changesMap[key].length - config.changesLimit + 1);
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
