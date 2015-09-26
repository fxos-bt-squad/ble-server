/* global require */
'use strict';

var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');

var specs = {
  services: [],
  characteristics: [],
  descriptors: []
};
var SPEC_HEADER = ['name', 'type', 'number', 'level'];
var SPEC_PAGES = {
  services:
    'https://developer.bluetooth.org/gatt/services/Pages/ServicesHome.aspx',
  characteristics:
    'https://developer.bluetooth.org/gatt/' +
    'characteristics/Pages/CharacteristicsHome.aspx',
  descriptors:
    'https://developer.bluetooth.org/gatt/' +
    'descriptors/Pages/DescriptorsHomePage.aspx'
};
var SPEC_FILE = '../res/gatt_specs.json';

function fetchSpec(page, url) {
  return new Promise(function(resolve) {
    request({uri: url}, function(err, response, body) {
      //Just a basic error check
      if (err && response.statusCode !== 200) {
        console.error('Request error', err);
        return;
      }

      var $ = cheerio.load(body);

      $('#onetidDoclibViewTbl0 > tr').each(function(rowIdx, row) {
        var spec = {};
        $(row).children().each(function(colIdx, col) {
          spec[SPEC_HEADER[colIdx]] = $(col).text();
        });
        specs[page].push(spec);
      });
      resolve();
    });
  });
}

var fetchPromisies = [];

for (var page in SPEC_PAGES) {
  fetchPromisies.push(fetchSpec(page, SPEC_PAGES[page]));
}

Promise.all(fetchPromisies).then(function() {
  fs.writeFile(SPEC_FILE, JSON.stringify(specs, null, 2), function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log('Spec file saved to ' + SPEC_FILE);
    }
  });
});

