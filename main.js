/* global BluetoothGattService */
'use strict';

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded and parsed');

  var initialized = false;
  var bluetooth = window.navigator.mozBluetooth;
  var defaultAdapter = null;
  defaultAdapter = bluetooth.defaultAdapter;
  var server = null;

  if (defaultAdapter) {
    console.log('defaultAdapter get!');
    if (!initialized) {
      server = defaultAdapter.gattServer;
      init();
    }
  } else {
    console.log('defaultAdapter not get! We need to wait adapter added');
  }

  bluetooth.onattributechanged = function onManagerAttributeChanged(evt) {
    console.log('register adapterchanged');
    evt.attrs.forEach(function(evtAttr) {
      console.log('--> onattributechanged(): evt.attrs[i] = ' + evtAttr);

      if (evtAttr == 'defaultAdapter') {
        console.log('!!!defaultAdapter changed. address:',
          bluetooth.defaultAdapter.address);
        defaultAdapter = bluetooth.defaultAdapter;
        if (!initialized) {
          server = defaultAdapter.gattServer;
          init();
        }
      }
    });
  };

  function init() {
    initialized = true;

    defaultAdapter.onattributechanged = function(evt) {
      console.log('--> _onAdapterAttributeChanged.... ');
      evt.attrs.forEach(function(evtAttr) {
        console.log('---> _onAdapterAttributeChanged.... ' + evtAttr);
        switch (evtAttr) {
          case 'state':
            if (defaultAdapter.state === 'enabled') {
              console.log('bluetooth enabled!!!!!');
            }
            break;
          case 'address':
            console.log('adapter address' + defaultAdapter.address);
            break;
          case 'name':
            console.log('adapter name: ' + defaultAdapter.name);
            break;
          case 'discoverable':
            console.log('discoverable state: ' + defaultAdapter.discoverable);
            break;
          case 'discovering':
            console.log('discovering' + defaultAdapter.discovering);
            break;
          default:
            break;
        }
      });
    };

    var els = document.querySelectorAll('gaia-header');
    [].forEach.call(els, function(el) {
      el.addEventListener('action', function(e) {
        if (e.detail.type == 'back') {
          window.history.back();
        }
      });
    });
    var ansSwitchBtn = document.getElementById('ans-switch');
    ansSwitchBtn.addEventListener('change', function() {
      if (this.checked) {
        addANS();
      } else {
        removeANS();
      }
    });

    var scanSwitch = document.getElementById('scan-switch');
    scanSwitch.addEventListener('change', function() {
      if (this.checked) {
        startDiscoverDevices();
      } else {
        stopDiscoverDevices();
      }
    });

    var pages = document.querySelector('gaia-pages');
    var update = function() {
      pages.navigate(location.hash.substr(1) || '/');
    };
    addEventListener('hashchange', update);
    update();
  }

  var connectionCount = 0;
  var foundDeviceAddrs;
  var discoveryHandler;
  var deviceList = document.getElementById('device-list');
  var connectionButtons = document.querySelectorAll('.disconnected');

  function startDiscoverDevices() {
    deviceList.innerHTML = '';
    foundDeviceAddrs = [];
    defaultAdapter.startLeScan([]).then(function onResolve(handle) {
      console.info('Scan started');
      discoveryHandler = handle;
      discoveryHandler.ondevicefound = function onDeviceFound(evt) {
        if (evt.device.gatt && foundDeviceAddrs.indexOf(evt.device.address) < 0) {
          addDeviceToList(evt.device);
          foundDeviceAddrs.push(evt.device.address);
        }
      }; // ondevice found
    }).catch(function onReject(reason) {
      console.error('--> startDiscovery failed', reason);
    }); //startdiscovery resolve
  }

  function stopDiscoverDevices() {
    if (discoveryHandler) {
      defaultAdapter.stopLeScan(discoveryHandler).then(function onResolve() {
        console.info('Scan stopped');
      }).catch(function onReject(reason) {
        console.log('--> stopDiscovery failed', reason);
      }); //stopdiscoverty resolve
    }
  }

  function updateConnectionState(connectionState) {
    for (var btn of connectionButtons) {
      btn.setAttribute('class', connectionState ? 'connected' : 'disconnected');
    }
  }

  function addDeviceToList(device) {
    console.log('Found device', device);
    var deviceElem = document.createElement('a');
    var deviceId = 'device-' + device.address.replace(/:/g, '');
    deviceElem.setAttribute('style', 'justify-content: space-between;');
    deviceElem.innerHTML = '<label for="' + deviceId + '">' +
      '<h3>' + device.name + '</h3>' +
      '<p>Address: <b>' + device.address + '</b></p></label>';
    var connectSwitch = document.createElement('gaia-switch');
    connectSwitch.setAttribute('id', deviceId);
    connectSwitch.addEventListener('change', function() {
      if (this.checked) {
        device.gatt.connect().then(function() {
          console.log('Device connected');
          connectionCount++;
          updateConnectionState(true);
        }).catch(function(e) {
          console.log('Device connect failed', e);
        });
      } else {
        device.gatt.disconnect().then(function() {
          console.log('Device disconnected');
          connectionCount--;
          if (connectionCount <= 0) {
            updateConnectionState(false);
          }
        }).catch(function(e) {
          console.log('Device disconnect failed', e);
        });
      }
    });
    deviceElem.appendChild(connectSwitch);
    deviceList.appendChild(deviceElem);
  }

  function addANS() {
    var service = new BluetoothGattService({
      isPrimary: true,
      uuid: '00001811-0000-1000-8000-00805f9b34fb'
    });
    service.addCharacteristic(
      '00002a47-0000-1000-8000-00805f9b34fb',
      {
        read: true
      },
      {
        read: true, broadcast: false, writeNoResponse: false,
        write: false, notify: false, indicate: false, signedWrite: false,
        extendedProps: false
      },
      new Uint8Array(0).buffer
    ).then(function() {
        return service.addCharacteristic(
          '00002a46-0000-1000-8000-00805f9b34fb',
          {
            notify: true
          },
          {
            read: false, broadcast: false, writeNoResponse: false,
            write: false, notify: true, indicate: false, signedWrite: false,
            extendedProps: false
          },
          new Uint8Array(0).buffer
        );
      }).then(function(c) {
        return c.addDescriptor(
          '00002902-0000-1000-8000-00805f9b34fb',
          {
            read: true, write: true
          },
          new Uint8Array([0x00, 0x00]).buffer
        );
      }).then(function() {
        return service.addCharacteristic('00002a48-0000-1000-8000-00805f9b34fb',
          {
            read: true
          },
          {
            read: true, broadcast: false, writeNoResponse: false,
            write: false, notify: false, indicate: false, signedWrite: false,
            extendedProps: false
          },
          new Uint8Array(0).buffer
        );
      }).then(function() {
        return service.addCharacteristic(
          '00002a45-0000-1000-8000-00805f9b34fb',
          {
            notify: true
          },
          {
            read: false, broadcast: false, writeNoResponse: false,
            write: false, notify: true, indicate: false, signedWrite: false,
            extendedProps: false
          },
          new Uint8Array(0).buffer
        );
      }).then(function(c) {
        return c.addDescriptor(
          '00002902-0000-1000-8000-00805f9b34fb',
          {
            read: true, write: true
          },
          new Uint8Array([0x00, 0x00]).buffer
        );
      }).then(function() {
        return service.addCharacteristic('00002a44-0000-1000-8000-00805f9b34fb',
          {notify: true},
          {
            read: false, broadcast: false, writeNoResponse: false,
            write: true, notify: false, indicate: false, signedWrite: false,
            extendedProps: false
          },
          new Uint8Array(0).buffer
        );
      }).then(function(c) {
        c.addDescriptor(
          '00002900-0000-1000-8000-00805f9b34fb',
          {
            read: true, write: true
          },
          new Uint8Array([0x00, 0x00]).buffer
        );
      }).then(function() {
        console.log('ANS creation all done!');
        window.ans = service;
        return server.addService(window.ans);
      }).then(function(s) {
        console.log('ANS added!');
      }).catch(function(e) {
        console.error(e);
      });
  }

  function removeANS() {
    server.removeService(window.ans).then(function() {
      console.log('ANS removed!');
    }).catch(function(e) {
      console.error(e);
    });
  }

}); //DOMContentLoaded
