# Cardash

Cardash uses a Raspberry Pi witha 2.8" TFT touchscreen to display ECU data via the OBD-II protocol.

The data is processed by Nodejs and sent to a webpage that uses Socket.io to update
in real time. Chromium is used to display the web page. Tapping the touchscreen display allows you to cycle
through different gauges.

## Hardware

* [Raspberry Pi](http://www.raspberrypi.org) (Model B or B+)
* [Adafruit PiTFT Touchscreen Display](http://www.adafruit.com/products/1601)
* [Plugable USB Bluetooth 4.0 Low Energy Micro Adapter](http://www.amazon.com/gp/product/B009ZIILLI/ref=oh_details_o00_s00_i00?ie=UTF8&psc=1)
* [ELM327 Bluetooth Adapter](http://www.amazon.com/Bluetooth-Available-CAN-BUS-Supports-Protocols/dp/B00EQ4J93K/ref=sr_1_11?s=electronics&ie=UTF8&qid=1401569383&sr=1-11&keywords=ELM327+bluetooth)
* Micro USB Car Charger

## Software

* [Raspbian OS](http://www.raspbian.org)
* [Node.js](http://nodejs.org)
* [Socket.io](http://socket.io)
* [Chromium](http://www.chromium.org)

## Credits

The idea was based heavily on [this](http://www.cowfishstudios.com/blog/obd-pitft-display-car-diagnostics-obd-ii-data-on-adafruits-pitft-touchscreen-display-for-raspberry-pi)
and the code was based heavily on [this](https://github.com/EricSmekens/node-serial-obd).
