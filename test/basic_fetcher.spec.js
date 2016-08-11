/**
 * Created by Roy on 14/05/2016.
 */

// core modules
var util          = require('util');

// npm modules
var chai          = require('chai'),
	chai_things   = require('chai-things'),
	sinon         = require('sinon'),
	request       = require('request');

// lib modules
require('./spec_helper');

var kaiser        = require('../index'),
	Resource      = require('../lib/resource'),
	PolicyChecker = require('../lib/policy_checker');


var Fetcher       = kaiser.Fetcher,
	BasicFetcher  = kaiser.BasicFetcher;

chai.should();
chai.use(chai_things);

describe('BasicFetcher', function() {
	before(function() {
		this.requestGetStub = this.sinon.stub(request, 'get');
	});
	describe('constructor', function() {
		it('should call BasicFetcher.init() function', function() {
			var basicFetcherInitSpy = this.sinon.spy(BasicFetcher, 'init');
			new BasicFetcher('crawler', 'options', 'requestSettings');
			sinon.assert.calledOnce(basicFetcherInitSpy);
			sinon.assert.calledWithExactly(basicFetcherInitSpy, 'crawler', 'options', 'requestSettings');
		});
	});
	describe('.init()', function() {
		it('should default initialize BasicFetcher', function() {
			var basicFetcher = {};
			var fetcherInitSpy = this.sinon.spy(Fetcher, 'init');
			BasicFetcher.init.call(basicFetcher, 'crawler', 'options', 'requestSettings');
			sinon.assert.calledOnce(fetcherInitSpy);
			sinon.assert.calledWithExactly(fetcherInitSpy, 'crawler');
			basicFetcher.should.have.property('policyChecker').and.to.be.instanceof(PolicyChecker);
			basicFetcher.should.have.property('maxAttempts').and.to.equal(10);
			basicFetcher.should.have.property('retryDelay').and.to.equal(5000);
			basicFetcher.should.have.property('maxConcurrentRequests').and.to.equal(100);
			basicFetcher.should.have.property('fetchedUris').and.to.be.instanceof(Array).and.to.be.empty;
			basicFetcher.should.have.property('pendingRequests').and.to.be.instanceof(Array).and.to.be.empty;
			basicFetcher.should.have.property('activeRequests').and.to.equal(0);
			basicFetcher.should.have.property('totalBytesFetched').and.to.equal(0);
		});
		it('should custom initialize BasicFetcher', function() {
			var basicFetcher = {};
			var fetcherInitSpy = this.sinon.spy(Fetcher, 'init');
			BasicFetcher.init.call(basicFetcher, 'crawler', {
				maxAttempts: 1,
				retryDelay: 1,
				maxConcurrentRequests: 1
			}, 'requestSettings');
			sinon.assert.calledOnce(fetcherInitSpy);
			sinon.assert.calledWithExactly(fetcherInitSpy, 'crawler');
			basicFetcher.should.have.property('policyChecker').and.to.be.instanceof(PolicyChecker);
			basicFetcher.should.have.property('maxAttempts').and.to.equal(1);
			basicFetcher.should.have.property('retryDelay').and.to.equal(1);
			basicFetcher.should.have.property('maxConcurrentRequests').and.to.equal(1);
			basicFetcher.should.have.property('fetchedUris').and.to.be.instanceof(Array).and.to.be.empty;
			basicFetcher.should.have.property('pendingRequests').and.to.be.instanceof(Array).and.to.be.empty;
			basicFetcher.should.have.property('activeRequests').and.to.equal(0);
			basicFetcher.should.have.property('totalBytesFetched').and.to.equal(0);
		});
	});
	describe('#logic()', function() {
		it ('should fail to create a resource request because crawler is stopping', function() {
			var basicFetcher = new BasicFetcher({
				isStopping: true
			}, {}, {});
			const resource = Resource.instance('https://www.google.com', null);
			var logicDoneSpy = this.sinon.spy();
			basicFetcher.logic(resource, logicDoneSpy);
			sinon.assert.calledOnce(logicDoneSpy);
			sinon.assert.calledWithExactly(logicDoneSpy, new Error('Fetch failed because crawler is stopping'));
		});
		it('should fail to create a resource request because resource is not permitted by policy checker robots txt check', function() {
			var basicFetcher = new BasicFetcher({}, {}, {});
			const resource = Resource.instance('https://www.google.com', null);
			var logicDoneSpy = this.sinon.spy();
			var isRobotsTxtAllowsResourceStub = this.sinon.stub(PolicyChecker.prototype, 'isRobotsTxtAllowsResource');
			isRobotsTxtAllowsResourceStub.returns(false);
			basicFetcher.logic(resource, logicDoneSpy);
			sinon.assert.calledOnce(logicDoneSpy);
			sinon.assert.calledWithExactly(logicDoneSpy, new Error('Fetch failed because of robots txt'));
		});
		it('should fail to create a resource request because a limit pass', function() {
			var basicFetcher = new BasicFetcher({
				isStopping: false
			}, {}, {});
			const resource = Resource.instance('https://www.google.com', null);
			var logicDoneSpy = this.sinon.spy();
			var isMaxTimeOverallPassedStub = this.sinon.stub(PolicyChecker.prototype, 'isMaxTimeOverallPassed');
			isMaxTimeOverallPassedStub.returns(true);
			basicFetcher.logic(resource, logicDoneSpy);
			sinon.assert.calledOnce(logicDoneSpy);
			sinon.assert.calledWithExactly(logicDoneSpy, new Error('Fetch failed because a crawler limit was passed'));
			basicFetcher.crawler.isStopping.should.be.equal(true);
		});
		it('should fail to create a resource request because the resource was already fetched', function() {
			var basicFetcher = new BasicFetcher({}, {}, {});
			const resource = Resource.instance('https://www.google.com', null);
			var logicDoneSpy = this.sinon.spy();
			basicFetcher.fetchedUris.push(resource.uri.toString());
			basicFetcher.logic(resource, logicDoneSpy);
			sinon.assert.calledOnce(logicDoneSpy);
			sinon.assert.calledWithExactly(logicDoneSpy, new Error('Fetch failed because resource was already fetched'));
		});
		it('should create a resource request', function() {
			var basicFetcher = new BasicFetcher({}, {}, {});
			var logicDoneSpy = this.sinon.spy();
			const resource = Resource.instance('https://www.google.com', null);
			var runRequestSpy = this.sinon.spy(basicFetcher, 'runRequest');
			basicFetcher.logic(resource, logicDoneSpy);
			basicFetcher.fetchedUris.should.deep.have.members([resource.uri.toString()]);
			basicFetcher.pendingRequests.should.deep.have.members([{
				"arguments": [{
					uri: resource.uri.toString()
				}, basicFetcher.maxAttempts, resource, logicDoneSpy],
				"function": basicFetcher.requestLoop
			}]);
			sinon.assert.calledOnce(runRequestSpy);
		});
	});
	describe('#requestLoop()', function() {
		it('should fail to request a resource due to passing `attemptsLeft` maximum count without error', function() {
			var basicFetcher = new BasicFetcher({}, {}, {});
			var handleRequestStub = this.sinon.stub(basicFetcher, 'handleResponse');
			var resource = null;
			var callback = function() {

			};
			basicFetcher.requestLoop({}, 0, resource, callback, null);
			sinon.assert.calledOnce(handleRequestStub);
			sinon.assert.calledWithExactly(handleRequestStub, new Error('No attempts to fetch the URL were made'), null, null, resource, callback);
		});
		it('should fail to request a resource due to passing `attemptsLeft` maximum count with error', function() {
			var basicFetcher = new BasicFetcher({}, {}, {});
			var handleRequestStub = this.sinon.stub(basicFetcher, 'handleResponse');
			var resource = null;
			var callback = function() {

			};
			var error = new Error('My custom error');
			basicFetcher.requestLoop({}, 0, resource, callback, error);
			sinon.assert.calledOnce(handleRequestStub);
			sinon.assert.calledWithExactly(handleRequestStub, error, null, null, resource, callback);
		});
		describe('handleResponseErrors()', function() {
			before(function() {
				this.clock = sinon.useFakeTimers();
			});
			it('should fail to request a resource due to getting recoverable error and using all attempts', function() {
				var requestCallbackError = new Error();
				requestCallbackError.code = 'ESOCKETTIMEDOUT';
				this.requestGetStub.yields(requestCallbackError, { statusCode: 400 }, 'body');

				var basicFetcher = new BasicFetcher({}, {
					retryDelay: 0
				}, {});
				var requestLoopSpy = this.sinon.spy(basicFetcher, 'requestLoop');
				const resource = Resource.instance('https://www.google.com', null);
				var requestOptions = {
					uri: resource.uri.toString()
				};
				var callback = function() {

				};
				var error = new Error('ESOCKETTIMEDOUT error on https://www.google.com/');
				error.code = 'ESOCKETTIMEDOUT';
				basicFetcher.requestLoop(requestOptions, 1, resource, callback, null);
				sinon.assert.calledOnce(requestLoopSpy);
				sinon.assert.calledWithExactly(requestLoopSpy, requestOptions, 1, resource, callback, null);
				this.clock.tick(0);
				sinon.assert.calledTwice(requestLoopSpy);
				sinon.assert.calledWithExactly(requestLoopSpy.secondCall, requestOptions, 0, resource, callback, error);
			});
		});
	});
});