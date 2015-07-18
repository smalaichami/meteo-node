var express = require('express');
var moment = require('moment');
var app  = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');
var addon = require('./build/Release/meteonetwork');
var SensorModel = require('./server/sensor-model');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + "/public/index.html");
});

function SensorDataHndler() {
  this.handlers = []; // observers
}

SensorDataHndler.prototype = {
  subscribe: function(fn) {
    this.handlers.push(fn);
  },
  unsubscribe: function(fn) {
    this.handlers = this.handlers.filter(function(item) {
      if (item !== fn) { return item; }
    });
  },
  fire: function(o) {
    this.handlers.forEach(function(item) {
      item(o);
    });
  }
};

var sensorDataHndler = new SensorDataHndler();

addon(function(data) {
  console.log("Data received : ", data);
  sensorDataHndler.fire(data);
}, {
    sensor_temp: {
        type      : "DHT22",
        frequence : 6,
        pin       : 0x7
    },
    sensor_light: {
        type      : "TSL2561",
        frequence : 6,
        address   : 0x39
    },
    sensor_press_temp : {
        type      : "BMP180",
        frequence : 6,
        address   : 0x77
    }
});

var storeDataHandler = function (data) {
  SensorModel.insert(data).then(function (sensor) {
    console.log("sensor stored", sensor);
  }).fail(function (err) {
    console.log(err);
  });
};

sensorDataHndler.subscribe(storeDataHandler);

io.on('connection', function(socket) {
  var handler = function (data) {
    socket.emit("data", data);
  };

  SensorModel.findAllLastHour().then(function (sensors) {
    socket.emit('historyLastHour', sensors);
  }).fail(function (err) {
    console.log(err);
  });

  sensorDataHndler.subscribe(handler);
  socket.on('disconnect', function() {
    sensorDataHndler.unsubscribe(handler);
  });
});

http.listen(8011, function(){
  console.log('listening on ' + 8011);
});
