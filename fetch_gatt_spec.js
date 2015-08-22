var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');

var specs = {
  services: [],
  characteristics: [],
  descriptors: []
};
var spec_header = ['name', 'type', 'number', 'level'];
var spec_pages = {
  services: 'https://developer.bluetooth.org/gatt/services/Pages/ServicesHome.aspx',
  characteristics: 'https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicsHome.aspx',
  descriptors: 'https://developer.bluetooth.org/gatt/descriptors/Pages/DescriptorsHomePage.aspx'
};
var spec_count = Object.keys(specs).length;
var spec_file = 'gatt_specs.json';

function fetch_spec(page, url) {
  return new Promise(function(resolve) {
    request({uri: url}, function(err, response, body) {
      //Just a basic error check
      if (err && response.statusCode !== 200) {
        console.error('Request error', err);
        return;
      }

      $ = cheerio.load(body);

      $('#onetidDoclibViewTbl0 > tr').each(function(rowIdx, row) {
        var spec = {};
        $(row).children().each(function(colIdx, col) {
          spec[spec_header[colIdx]] = $(col).text();
        });
        specs[page].push(spec);
      });
      resolve();
    });
  });
}

var fetchPromisies = [];

for (var page in spec_pages) {
  fetchPromisies.push(fetch_spec(page, spec_pages[page]));
}

Promise.all(fetchPromisies).then(function() {
  fs.writeFile(spec_file, JSON.stringify(specs, null, 2), function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log("Spec file saved to " + spec_file);
    }
  });
});

