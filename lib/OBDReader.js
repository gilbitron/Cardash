/*
 * A lot of this is borrowed from Eric Smekens https://github.com/EricSmekens/node-serial-obd
 */

'use strict';
var EventEmitter = require('events').EventEmitter,
	util = require('util'),
	async = require('async'),
	ODBData = require('./OBDData.js');

var defaults = {
	serialOptions: {
		baudRate: 57600,
		dataBits: 8,
		stopBits: 1,
		parity: 'none'
	},
	bluetoothOptions: {}
};

// Constant for defining delay between writes
var writeDelay = 50;
// Queue for writing
var queue = [];

function getPIDByName(name) {
    for(var i = 0; i < ODBData.length; i++){
        if(ODBData[i].name === name){
            if(ODBData[i].pid !== undefined){
                return (ODBData[i].mode + ODBData[i].pid);
            }
            //There are modes which don't require a extra parameter ID.
            return (ODBData[i].mode);
        }
    }
}

function parseOBDCommand(hexString) {
    var reply,
        byteNumber,
        valueArray; //New object

    reply = {};
    if (hexString === "NO DATA" || hexString === "OK" || hexString === "?") { //No data or OK is the response.
        reply.value = hexString;
        return reply;
    }

    hexString = hexString.replace(/ /g, ''); //Whitespace trimming //Probably not needed anymore?
    valueArray = [];

    for (byteNumber = 0; byteNumber < hexString.length; byteNumber += 2) {
        valueArray.push(hexString.substr(byteNumber, 2));
    }

    if (valueArray[0] === "41") {
        reply.mode = valueArray[0];
        reply.pid = valueArray[1];
        for (var i = 0; i < ODBData.length; i++) {
            if(ODBData[i].pid == reply.pid) {
                var numberOfBytes = ODBData[i].bytes;
                reply.name = ODBData[i].name;
				reply.description = ODBData[i].description;
				reply.min = ODBData[i].min;
				reply.max = ODBData[i].max;
				reply.unit = ODBData[i].unit;
                switch (numberOfBytes)
                {
                    case 1:
                        reply.value = ODBData[i].convertToUseful(valueArray[2]);
                        break;
                    case 2:
                        reply.value = ODBData[i].convertToUseful(valueArray[2], valueArray[3]);
                        break;
                    case 4:
                        reply.value = ODBData[i].convertToUseful(valueArray[2], valueArray[3], valueArray[4], valueArray[5]);
                        break;
                    case 8:
                        reply.value = ODBData[i].convertToUseful(valueArray[2], valueArray[3], valueArray[4], valueArray[5], valueArray[6], valueArray[7], valueArray[8], valueArray[9]);
                        break;
                }
                break; //Value is converted, break out the for loop.
            }
        }
    } else if (valueArray[0] === "43") {
        reply.mode = valueArray[0];
        for (var i = 0; i < ODBData.length; i++) {
            if(ODBData[i].mode == "03") {
                reply.name = ODBData[i].name;
				reply.description = ODBData[i].description;
				reply.min = ODBData[i].min;
				reply.max = ODBData[i].max;
				reply.unit = ODBData[i].unit;
                reply.value = ODBData[i].convertToUseful(valueArray[1], valueArray[2], valueArray[3], valueArray[4], valueArray[5], valueArray[6]);
            }
        }
    }
    return reply;
}

var OBDReader = function(debug) {
	EventEmitter.call(this);

	if(!debug){
		this.debug = false;
	} else {
		this.debug = debug;
	}

    this.connected = false;
	this.port = null;
	this.portType = null; // serial/bluetooth

    return this;
};
util.inherits(OBDReader, EventEmitter);

OBDReader.prototype.getPort = function() {
	return this.port.path;
};

OBDReader.prototype.autoConnect = function(options) {
	var self = this,
		possiblePorts = [];
	if(!options) options = defaults;

	var SerialPort = require('serialport').SerialPort;
	// Bluetooth
	for(var i = 0; i < 10; i++){
		possiblePorts.push('/dev/rfcomm'+ i);
	}
	// USB
	for(var i = 0; i < 256; i++){
		possiblePorts.push('/dev/ttyUSB'+ i);
	}
	// OBDsim
	for(var i = 0; i < 256; i++){
		possiblePorts.push('/dev/pts/'+ i);
	}
	for(var i = 0; i < 5; i++){
		possiblePorts.push('/dev/ttys'+ String('00'+ i).slice(-3));
	}

	var SerialPort = require('serialport').SerialPort;
	async.detectSeries(possiblePorts, function(port, callback) {
		self.port = new SerialPort(port, options.serialOptions, true, function(err){
			if(err){
				callback(false);
			} else {
				self.port.close();
				callback(true);
			}
		});
	},function(result){
		console.log(result);
		self.connectSerial(result, options.serialOptions);
	});
};

OBDReader.prototype.connectSerial = function(portName, options) {
	var self = this;

	// Defaults
	if(!options){
		options = defaults.serialOptions;
	}

	if(this.connected){
    	throw new Error('Can\'t connect to serial port, there is already a live connection.');
	} else {
		var SerialPort = require('serialport').SerialPort;
		this.port = new SerialPort(portName, options);

		this.port.on('close', function(err) {
	        if(self.debug) console.log('Serial port ['+ portName +'] was closed');
	    });

	    this.port.on('error', function(err) {
	        if(self.debug) console.log('Serial port ['+ portName +'] error: '+ err);
	    });

	    this.port.on('open', function() {
	        self.connected = true;
			self.portType = 'serial';

			if(self.debug) console.log('Serial port ['+ portName +'] open');

			self.port.on('data', function(data) {
		        var currentString = data.toString('utf8'), // making sure it's a utf8 string
		        	arrayOfCommands = currentString.split('>'),
					forString;

	            for(var commandNumber = 0; commandNumber < arrayOfCommands.length; commandNumber++) {
	                forString = arrayOfCommands[commandNumber];
	                if(forString === '') {
	                    continue;
	                }

	                var multipleMessages = forString.split('\r');
	                for(var messageNumber = 0; messageNumber < multipleMessages.length; messageNumber++) {
	                    var messageString = multipleMessages[messageNumber];
	                    if(messageString === '') {
	                        continue;
	                    }

	                    var reply = parseOBDCommand(messageString);
						self.emit('dataReceived', reply);
	                    if(self.debug) console.log('Data recieved: '+ reply.name +' = '+ reply.value);
	                }
	            }
			});

	        //self.write('ATZ');
	        //Turns off extra line feed and carriage return
	        self.write('ATL0');
	        //This disables spaces in in output, which is faster!
	        self.write('ATS0');
	        //Turns off headers and checksum to be sent.
	        self.write('ATH0');
	        //Turns off echo.
	        self.write('ATE0');
	        //Turn adaptive timing to 2. This is an aggressive learn curve for adjusting the timeout. Will make huge difference on slow systems.
	        self.write('ATAT2');
	        //Set timeout to 10 * 4 = 40msec, allows +20 queries per second. This is the maximum wait-time. ATAT will decide if it should wait shorter or not.
	        //self.write('ATST0A');
	        //Set the protocol to automatic.
	        self.write('ATSP0');

			self.emit('connected');
	    });

		// Setup write queue
		this.intervalWriter = setInterval(function(){
	        if(queue.length > 0 && self.connected){
	            try {
					var command = queue.shift();
	                self.port.write(command);
					self.emit('write', command);
	            }
				catch(err) {
	                console.log('Error while writing: ' + err);
	                clearInterval(self.intervalWriter);
	                self.removeAllMonitors();
	            }
			}
	    }, writeDelay);
	}
};

OBDReader.prototype.autoConnectBluetooth = function(query, options) {
	var self = this;

	if(this.connected){
		throw new Error('Can\'t connect to bluetooth port, there is already a live connection.');
	} else {
		var btSerial = new (require('bluetooth-serial-port')).BluetoothSerialPort();
		var search = new RegExp(query.replace(/\W/g, ''), 'gi');

		btSerial.on('found', function(address, name) {
			var addrMatch = !query || address.replace(/\W/g, '').search(search) != -1;
			var nameMatch = !query || name.replace(/\W/g, '').search(search) != -1;

			if(addrMatch || nameMatch){
				btSerial.removeAllListeners('finished');
				btSerial.removeAllListeners('found');
				if(self.debug) console.log('Bluetooth: Found device: ' + name + ' (' + address + ')');

				btSerial.findSerialPortChannel(address, function(channel) {
					if(self.debug) console.log('Bluetooth: Found device channel: ' + channel);
					self.connectBluetooth(address, channel, options);
				}, function(err) {
					if(self.debug) console.log('Bluetooth error: '+ err);
				});
			} else {
				if(self.debug) console.log('Bluetooth: Ignoring device: ' + name + ' (' + address + ')');
			}
		});

		btSerial.on('finished', function() {
			if(self.debug) console.log('Bluetooth error: No suitable devices found');
		});

		btSerial.inquire();
	}
};

OBDReader.prototype.connectBluetooth = function(address, channel, options) {
	var self = this;

	// Defaults
	if(!options){
		options = defaults.bluetoothOptions;
	}

	if(this.connected){
		throw new Error('Can\'t connect to bluetooth port, there is already a live connection.');
	} else {
		var btSerial = new (require('bluetooth-serial-port')).BluetoothSerialPort();

	    btSerial.connect(address, channel, function() {
	        self.connected = true;
			self.portType = 'bluetooth';

	        btSerial.on('failure', function(error) {
				if(self.debug) console.log('Bluetooth error: '+ err);
			});

	        btSerial.on('data', function(data) {
	            var currentString = data.toString('utf8'), // making sure it's a utf8 string
					arrayOfCommands = currentString.split('>'),
					forString;

				for(var commandNumber = 0; commandNumber < arrayOfCommands.length; commandNumber++) {
					forString = arrayOfCommands[commandNumber];
					if(forString === '') {
						continue;
					}

					var multipleMessages = forString.split('\r');
					for(var messageNumber = 0; messageNumber < multipleMessages.length; messageNumber++) {
						var messageString = multipleMessages[messageNumber];
						if(messageString === '') {
							continue;
						}

						var reply = parseOBDCommand(messageString);
						self.emit('dataReceived', reply);
						if(self.debug) console.log('Data recieved: '+ reply.name +' = '+ reply.value);
					}
				}
	        });

			//self.write('ATZ');
			//Turns off extra line feed and carriage return
			self.write('ATL0');
			//This disables spaces in in output, which is faster!
			self.write('ATS0');
			//Turns off headers and checksum to be sent.
			self.write('ATH0');
			//Turns off echo.
			self.write('ATE0');
			//Turn adaptive timing to 2. This is an aggressive learn curve for adjusting the timeout. Will make huge difference on slow systems.
			self.write('ATAT2');
			//Set timeout to 10 * 4 = 40msec, allows +20 queries per second. This is the maximum wait-time. ATAT will decide if it should wait shorter or not.
			//self.write('ATST0A');
			//Set the protocol to automatic.
			self.write('ATSP0');

			self.emit('connected');
	    }, function (err) { //Error callback!
	        if(self.debug) console.log('Bluetooth error: '+ err);
	    });

	    this.port = btSerial; //Save the connection in OBDReader object.

	    // Setup write queue
		this.intervalWriter = setInterval(function(){
			if(queue.length > 0 && self.connected){
				try {
					var command = queue.shift();
					self.port.write(command);
					self.emit('write', command);
				}
				catch(err) {
					console.log('Error while writing: ' + err);
					clearInterval(self.intervalWriter);
					self.removeAllMonitors();
				}
			}
		}, writeDelay);
	}
};

OBDReader.prototype.disconnect = function() {
	var self = this;

	clearInterval(this.intervalWriter);
	if(this.port){
		this.port.close(function() {
			self.connected = false;
			self.emit('disconnected');
		});
	} else {
		self.connected = false;
		self.emit('disconnected');
	}
};

OBDReader.prototype.write = function(message, replies) {
    if(!replies) replies = 0;

    if(this.connected){
        if(queue.length < 256){
            if(replies !== 0){
                queue.push(message + replies + '\r');
            } else {
                queue.push(message + '\r');
            }
        } else {
            console.log('Error: queue overflow');
        }
    }
};

var activeMonitors = [];

OBDReader.prototype.addMonitor = function(name) {
    activeMonitors.push(getPIDByName(name));
};

OBDReader.prototype.removeMonitor = function(name) {
    var index = activeMonitors.indexOf(getPIDByName(name));
    activeMonitors.splice(index, 1);
};

OBDReader.prototype.removeAllMonitors = function() {
	// This does not delete the array, it just clears every element.
    activeMonitors.length = 0;
};

OBDReader.prototype.writeMonitors = function() {
    for(var i = 0; i < activeMonitors.length; i++){
        this.write(activeMonitors[i], 1);
    }
};

var pollerInterval;
OBDReader.prototype.startMonitors = function(interval) {
    if(interval === undefined) {
        interval = activeMonitors.length * (writeDelay * 2); // Double the delay, so there's room for manual requests.
    }

    var self = this;
    pollerInterval = setInterval(function() {
        self.writeMonitors();
    }, interval);
};

OBDReader.prototype.stopMonitors = function() {
    clearInterval(pollerInterval);
};

var exports = module.exports = OBDReader;
