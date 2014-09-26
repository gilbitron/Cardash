var express = require('express'),
    app = express(),
    server = require('http').Server(app),
    io = require('socket.io')(server),
    async = require('async'),
    config = require('./config.js');
    OBDReader = require('./lib/OBDReader.js');

var obdReader = new OBDReader(config.debug || false),
    monitors = [
        'vss',
        'rpm',
        'temp',
        'iat',
        'maf'
    ];

obdReader.on('connected', function() {
    console.log('Connected to OBD on '+ obdReader.getPort());
    var self = this;

    monitors.forEach(function(mon){
        self.addMonitor(mon);
    });
    this.startMonitors();

    io.emit('connected');
});

obdReader.on('dataReceived', function(reply) {
    io.emit(reply.name, reply);
});

if(config.useBluetooth){
    if(config.bluetoothAutoConnect){
        obdReader.autoConnectBluetooth('obd');
    } else {
        obdReader.connectBluetooth(config.bluetoothAddress, config.bluetoothChannel);
    }
} else {
    if(config.port){
        obdReader.connectSerial(config.port);
    } else {
        obdReader.autoConnect();
    }
}

// Handle Interrupts / Signals
process.on('SIGINT', function() {
    obdReader.disconnect();
});

obdReader.on('disconnected', function() {
    io.emit('disconnected');
    process.exit(1);
});

// Server
io.on('connection', function(socket){
    socket.emit('connection', monitors);
});

server.listen(3000, function() {
    console.log('Server: http://localhost:%d', server.address().port);
});

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/views/index.html');
});
