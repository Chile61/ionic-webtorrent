'use strict';

var Constants = {};

Constants.DERIVATION_STRATEGIES = {
  BIP44: 'BIP44',
  BIP48: 'BIP48',
};


Constants.UNITS = {
  one: {
    value: 1
  },
  kilo: {
    value: 1000
  },
  mega: {
    value: 1000000
  },
  giga: {
    value: 1000000000
  }
};

module.exports = Constants;
