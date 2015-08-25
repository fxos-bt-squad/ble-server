/* global BluetoothGattService */
'use strict';

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded and parsed');

  var initialized = false;
  var bluetooth = window.navigator.mozBluetooth;
  var defaultAdapter = null;
  defaultAdapter = bluetooth.defaultAdapter;
  var server = null;
  var services = [];
  var connectionCount = 0;
  var foundDeviceAddrs;
  var discoveryHandler;
  var deviceList = document.getElementById('device-list');
  var serviceList = document.getElementById('service-list');
  var includedServiceList = document.getElementById('inc-service-list');
  var characteristicList = document.getElementById('characteristic-list');
  var descriptorList = document.getElementById('descriptor-list');
  var connectionButtons = document.querySelectorAll('.disconnected');
  var currentService = null;
  var currentCharacteristic = null;
  var currentDescriptor = null;
  var specMap = {
    services: {},
    characteristics: {},
    descriptors: {}
  };

  loadJSON('/res/gatt_specs.json', function(data) {
    for (var specKey in data) {
      if (data.hasOwnProperty(specKey)) {
        for (var spec of data[specKey]) {
          var sn = spec.number.substr(2).toLowerCase();
          specMap[specKey][sn] = spec.name;
        }
      }
    }
  }, function(err) {
    console.error(err);
  });

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
  var DEFAULT_PROPERTIES = {
    read: false, broadcast: false, writeNoResponse: false,
    write: false, notify: false, indicate: false, signedWrite: false,
    extendedProps: false
  };

  function arrayToFlags(array, defaultFlags) {
    var flags = {};
    if (defaultFlags) {
      flags = defaultFlags;
    }
    for (var elem of array) {
      flags[elem] = true;
    }
    return flags;
  }

  function parseHexString(str) {
    var arrayBuffer = new ArrayBuffer(Math.ceil(str.length / 2));
    var uint8Array = new Uint8Array(arrayBuffer);

    for (var i = 0, j = 0; i < str.length; i += 2, j++) {
      uint8Array[j] = parseInt(str.substr(i, 2), 16);
    }
    return arrayBuffer;
  }

  function valueToBuffer(value) {
    if (typeof(value) == 'string') {
      return parseHexString(value);
    } else if (value instanceof Array) {
      return new Uint8Array(value).buffer;
    }
    return new ArrayBuffer(0);
  }

  function createService(json) {
    var promises = [];
    var service = new BluetoothGattService({
      uuid: json.uuid,
      isPrimary: json.isPrimary
    });
    promises.push(service);
    json.characteristics.forEach(function(char) {
      promises.push(service.addCharacteristic(
        char.uuid,
        arrayToFlags(char.permissions),
        arrayToFlags(char.properties, DEFAULT_PROPERTIES),
        valueToBuffer(char.value)
      ).then(function(characteristic) {
          char.descriptors.forEach(function(desc) {
            console.log(desc);
            promises.push(characteristic.addDescriptor(
              desc.uuid,
              arrayToFlags(desc.permissions),
              valueToBuffer(desc.value)
            ));
          });
        }
      ));
    });
    json.includedServices.forEach(function(incService) {
      promises.push(createService(incService));
    });
    return Promise.all(promises);
  }

  function init() {
    initialized = true;

    loadJSON('/res/preload_services.json', function(response) {
      response.forEach(function(serviceJson) {
        createService(serviceJson).then(function(values) {
          if (values && values.length > 0) {
            var service = values[0];
            if (service) {
              services.push(service);
              addServiceToList(service);
            }
          }
        });
      });
    });

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
      var path = location.hash.substr(1);
      if (path == '/service') {
        updateServiceState();
      } else if (path == '/characteristic') {
        updateCharacteristicState();
      } else if (path == '/descriptor') {
        updateDescriptorState();
      }
      pages.navigate(path || '/');
    };
    addEventListener('hashchange', update);
    update();
  }

  var serviceUuid = document.getElementById('service-uuid');
  var serviceIsPrimary = document.getElementById('service-is-primary');
  var serviceInstanceId = document.getElementById('service-instance-id');
  var charUuid = document.getElementById('char-uuid');
  var charInstanceId = document.getElementById('char-instance-id');
  var charValue = document.getElementById('char-value');
  var charPermissions = document.getElementById('char-permissions');
  var charProperties = document.getElementById('char-properties');
  var descUuid = document.getElementById('desc-uuid');
  var descValue = document.getElementById('desc-value');
  var descPermissions = document.getElementById('desc-permissions');

  function updateServiceState() {
    serviceUuid.textContent = currentService.uuid;
    serviceIsPrimary.textContent = currentService.isPrimary;
    serviceInstanceId.textContent = currentService.instanceId;
    characteristicList.innerHTML = '';
    for (var char of currentService.characteristics) {
      addCharacteristicToList(char);
    }
    for (var inc of currentService.includedServices) {
      addIncludedServiceToList(inc);
    }
  }

  function updateCharacteristicState() {
    charUuid.textContent = currentCharacteristic.uuid;
    charInstanceId.textContent = currentCharacteristic.instanceId;
    charValue.textContent = valueToHexString(currentCharacteristic.value);
    charPermissions.textContent =
      permissionsToString(currentCharacteristic.permissions);
    charProperties.textContent =
      propertiesToString(currentCharacteristic.properties);
    descriptorList.innerHTML = '';
    for (var desc of currentCharacteristic.descriptors) {
      addDescriptorToList(desc);
    }
  }

  function updateDescriptorState() {
    descUuid.textContent = currentDescriptor.uuid;
    descValue.textContent = valueToHexString(currentDescriptor.value);
    descPermissions.textContent =
      permissionsToString(currentDescriptor.permissions);

  }

  function findServiceName(uuid) {
    var num = uuid.substr(4, 4);
    var name = specMap.services[num];
    if (name) {
      return name;
    }
    return '';
  }

  function findCharacteristicName(uuid) {
    var num = uuid.substr(4, 4);
    var name = specMap.characteristics[num];
    if (name) {
      return name;
    }
    return '';
  }

  function findDescriptorName(uuid) {
    var num = uuid.substr(4, 4);
    var name = specMap.descriptors[num];
    if (name) {
      return name;
    }
    return '';
  }

  function permissionsToString(permissions) {
    if (permissions) {
      return Array.join(Array.filter(Object.keys(permissions), function(k) {
        return permissions[k];
      }), ', ');
    }
    return '';
  }

  function propertiesToString(properties) {
    if (properties) {
      return Array.join(Array.filter(Object.keys(properties), function(k) {
        return properties[k];
      }), ', ');
    }
    return '';
  }

  function valueToHexString(value) {
    var str = '';
    if (value) {
      var uint8Array = new Uint8Array(value);
      for (var i = 0; i < uint8Array.length; i++) {
        var b = uint8Array[i].toString(16);
        if (b.length == 1) {
          str += '0';
        }
        str += b;
      }
    }
    return str;
  }

  function addServiceToList(service) {
    var serviceName = findServiceName(service.uuid);
    var serviceElem = document.createElement('div');
    serviceElem.className = 'no-before';
    serviceElem.style.justifyContent = 'space-between';
    serviceElem.innerHTML = '<a href="#/service">' +
      (serviceName ? '<h3>' + serviceName + '</h3>' : '') +
      '<p><b>' + service.uuid + '</b></p>' +
      '<p>Is Primary: <b>' + service.isPrimary + '</b>, ' +
      'Instance ID: <b>' + service.instanceId + '</b></p></a>';
    var serviceSwitch = document.createElement('gaia-switch');
    serviceSwitch.addEventListener('change', function() {
      if (this.checked) {
        addService(service);
      } else {
        removeService(service);
      }
    });
    serviceElem.appendChild(serviceSwitch);
    serviceElem.addEventListener('click', function() {
      currentService = service;
    });
    serviceList.appendChild(serviceElem);
  }

  function addIncludedServiceToList(service) {
    var serviceName = findServiceName(service.uuid);
    var serviceElem = document.createElement('div');
    serviceElem.className = 'no-before';
    serviceElem.style.justifyContent = 'space-between';
    serviceElem.innerHTML = '<a href="#/service">' +
      (serviceName ? '<h3>' + serviceName + '</h3>' : '') +
      '<p><b>' + service.uuid + '</b></p>' +
      '<p>Is Primary: <b>' + service.isPrimary + '</b>, ' +
      'Instance ID: <b>' + service.instanceId + '</b></p></a>';
    serviceElem.addEventListener('click', function() {
      currentService = service;
    });
    includedServiceList.appendChild(serviceElem);
  }

  function addCharacteristicToList(char) {
    var charName = findCharacteristicName(char.uuid);
    var charElem = document.createElement('a');
    charElem.href = '#/characteristic';
    charElem.className = 'no-before';
    charElem.style.justifyContent = 'space-between';
    charElem.innerHTML = '<div>' +
      (charName ? '<h3>' + charName + '</h3>' : '') +
      '<p><b>' + char.uuid + '</b></p>' +
      '<p>Properties: <b>' + propertiesToString(char.properties) + '</b></p>' +
      '<p>Value: <b>' + valueToHexString(char.value) + '</b>, ' +
      'Instance ID: <b>' + char.instanceId + '</b></p></div>';
    charElem.addEventListener('click', function() {
      currentCharacteristic = char;
    });
    characteristicList.appendChild(charElem);
  }

  function addDescriptorToList(desc) {
    var descName = findDescriptorName(desc.uuid);
    var descElem = document.createElement('a');
    descElem.href = '#/descriptor';
    descElem.className = 'no-before';
    descElem.style.justifyContent = 'space-between';
    descElem.innerHTML = '<div>' +
      (descName ? '<h3>' + descName + '</h3>' : '') +
      '<p><b>' + desc.uuid + '</b></p>' +
      '<p>Permissions: <b>' +
      permissionsToString(desc.permissions) + '</b></p>' +
      '<p>Value: <b>' + valueToHexString(desc.value) + '</b></p></div>';
    descElem.addEventListener('click', function() {
      currentDescriptor = desc;
    });
    descriptorList.appendChild(descElem);
  }

  function startDiscoverDevices() {
    deviceList.innerHTML = '';
    foundDeviceAddrs = [];
    defaultAdapter.startLeScan([]).then(function onResolve(handle) {
      console.info('Scan started');
      discoveryHandler = handle;
      discoveryHandler.ondevicefound = function onDeviceFound(evt) {
        if (evt.device.gatt &&
          foundDeviceAddrs.indexOf(evt.device.address) < 0) {
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
    deviceElem.style.justifyContent = 'space-between';
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

  function addService(service) {
    server.addService(service).then(function() {
      console.log('Service added!');
    }).catch(function(e) {
      console.error(e);
    });
  }

  function removeService(service) {
    server.removeService(service).then(function() {
      console.log('Service removed!');
    }).catch(function(e) {
      console.error(e);
    });
  }

  function loadJSON(url, successHandler, errorHandler) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      successHandler && successHandler(xhr.response);
    };
    xhr.onerror = function() {
      errorHandler && errorHandler(xhr.statusText);
    };
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.send();
  }
}); //DOMContentLoaded
