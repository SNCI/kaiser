/**
 * Created by Roy on 21/05/2016.
 */

'use strict';

// npm modules
var sinon          = require('sinon');

// lib modules
require('./spec_helper');

var ResourceWorker = require('../lib/resource_worker');

module.exports = {
	beforeEach: function() {
		this.sinon.stub(ResourceWorker, 'init');
	}
};