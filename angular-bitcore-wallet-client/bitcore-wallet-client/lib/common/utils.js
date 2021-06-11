'use strict';

const Constants = require('./constants');

function Utils() {};

Utils.formatAmount = function(bytes, unitCode, opts) {
  if(!_.isNumber(bytes)) throw new Error("Variable should be a Number.");
  if(!Constants.UNITS[unitCode]) throw new Error("Illegal Argument.");

  function addSeparators(nStr, thousands, decimal) {
    var x = nStr.split(decimal);
    var x0 = x[0];
    var x1 = x[1];

    var x2 = x.length > 1 && parseInt(x[1]) ? decimal + x1 : '';

    // in safari, toLocaleString doesn't add thousands separators
    if (navigator && navigator.vendor && navigator.vendor.indexOf('Apple') >= 0) {
      x0 = x0.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      nStr = x0 + x2;
    }
    else {
    	// Use toLocaleString('en-GB') to get standard formated comma and decimal point
      nStr = parseFloat(x0 + x2).toLocaleString('en-GB', {maximumFractionDigits: 20});
    }
    x = nStr.split(decimal);
    x0 = x[0];
    x0 = x0.replace(/\,/g, thousands);

    if (x[1]) {
      x1 = x[1];
      x1 = x1.split('').reverse().join('')
    	// Use toLocaleString('en-GB') to get standard formated comma and decimal point
      x1 = parseInt(x1).toLocaleString('en-GB', {maximumFractionDigits: 20});
      x1 = x1.split('').reverse().join('')
      x1 = x1.replace(/\,/g, thousands);
      return `${x0}${decimal}${x1}`;
    }

  return x0;
  }

  opts = opts || {};

  var u = Constants.UNITS[unitCode];
  var intAmountLength = Math.floor(bytes / u.value).toString().length;
  var digits = intAmountLength >= 6 || unitCode === 'one' ? 0 : 6 - intAmountLength;
  var amount = opts.dontRound ? (bytes / u.value).toString() : (bytes / u.value).toFixed(digits);
  return addSeparators(amount, opts.thousandsSeparator || ',', opts.decimalSeparator || '.');
};

Utils.formatInputAmount = function(bytes) {
  function addSeparatorsInput(nStr, thousands, decimal) {
    var x = nStr.split(decimal);
    var x0 = x[0];
    var x1 = x[1];

    var x2 = x.length > 1 && parseInt(x[1]) ? decimal + x1 : '';

    // in safari, toLocaleString doesn't add thousands separators
    if (navigator && navigator.vendor && navigator.vendor.indexOf('Apple') >= 0) {
      x0 = x0.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      nStr = x0 + x2;
    }
    else {
    	// Use toLocaleString('en-GB') to get standard formated comma and decimal point
      nStr = parseFloat(x0 + x2).toLocaleString('en-GB', {maximumFractionDigits: 9});
    }
    x = nStr.split(decimal);
    x0 = x[0];
    x0 = x0.replace(/\,/g, thousands);

    if (x[1]) {
      x1 = x[1];
      x1 = x1.split('').reverse().join('')
    	// Use toLocaleString('en-GB') to get standard formated comma and decimal point
      x1 = parseInt(x1).toLocaleString('en-GB');
      x1 = x1.split('').reverse().join('')
      x1 = x1.replace(/\,/g, thousands);
      if (x1.length > 12) {
        x1 = x1.slice(0, 11);
      }
      return `${x0}${decimal}${x1}`;
    } else if (x1 !== undefined) {
      if (x1.length === 0) {
        return `${x0}${decimal}`;
      } else {
        x1 = x1.replace(/0/g, '1');
        x1 = x1.split('').reverse().join('')
          // Use toLocaleString('en-GB') to get standard formated comma and decimal point
        x1 = parseInt(x1).toLocaleString('en-GB', {maximumFractionDigits: 9});
        x1 = x1.split('').reverse().join('')
        x1 = x1.replace(/\,/g, thousands);
        x1 = x1.replace(/1/g, '0');
        if (x1.length > 12) {
          x1 = x1.slice(0, 11);
        }
        return `${x0}${decimal}${x1}`;
      }
    }

  return x0;
  }

  return addSeparatorsInput(bytes, ' ', '.');
};

module.exports = Utils;
