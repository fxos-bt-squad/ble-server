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

    var connectBtn = document.getElementById('connect');
    connectBtn.addEventListener('click', function() {
      alert('Not yet implemented!');
    });
    var ansSwitchBtn = document.getElementById('ans-switch');
    ansSwitchBtn.addEventListener('change', function() {
      if (this.checked) {
        addANS();
      } else {
        removeANS();
      }
    });
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
