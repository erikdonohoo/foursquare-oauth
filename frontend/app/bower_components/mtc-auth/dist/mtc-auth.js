(function (angular, undefined) { 'use strict';

angular.module('angular-oauth2', []);

// Define auth configuration
var settings = {
	redirecting: false, // Help with not trying to renew token when redirect is about to happen
	content_urls: [],
	popup: false,
	scope: [],
	options: {},
	auto_auth: true
},

tokenRefreshReduction = (60 * 1000 * 5), // 5 minutes

AUTH_SESSION_STORAGE_KEY = 'angular-oauth2';

// Save a token when it is found
function saveToken(token, $window) {
		// Save to session storage
	$window.sessionStorage[AUTH_SESSION_STORAGE_KEY + '-' + settings.client_id] = angular.toJson(token);
	return token;
}

// Using the config, build the auth redirect url
function buildUrl(config, location) {
		var configCopy = angular.copy(config);
	var url = configCopy.oauth2_url + '?';
	var state = location.hash.substring(1);
	var redirect = location.origin + location.pathname;

	// Add clientId
	url += 'client_id=' + configCopy.client_id;

	// Add scopes
	url = configCopy.scope.length ?
		url + '&scope=' + configCopy.scope.join(' ').replace(/\s/g, '%20') :
		url;

	// Add state
	// If config is true, set to current location
	// otherwise set to the string they passed or nothing
	url = configCopy.state === true ?
		url + '&state=' + encodeURIComponent(state) :
		angular.isString(configCopy.state) ?
			url + '&state=' + encodeURIComponent(configCopy.state) :
			url;

	// Add response type (force token for now)
	url += '&response_type=token';

	// Add redirectUri
	url = configCopy.redirect_uri === true ?
		url + '&redirect_uri=' + redirect :
		url + '&redirect_uri=' + configCopy.redirect_uri;

	// Add additional non-standard query params
	angular.forEach(configCopy.options, function (value, key) {
		url += '&' + key + '=' + value;
	});

	return url;
}

// Remove auth info from url
// TODO Does this work in html5 mode?
var tokenRegex = /([^&=]+)=([^&]*)/g;
function stripToken(path) {
		var params = {}, queryString = '', m;
	var pathChunks = path.split('#');

	if (pathChunks.length > 1) {

		if (pathChunks[1].charAt(0) === '/') { // if hash was found, this shouldnt be undefined
			pathChunks[1] = pathChunks[1].substring(1);
		}

		queryString = pathChunks[1];
		while ((m = tokenRegex.exec(queryString))) {
			params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);// save out each query param
		}
	}

	return params;
}

// Check url against protected urls
function urlRequiresAuth(url, settings) {
		var protect = false;
	angular.forEach(settings.content_urls, function (prefix) {
		if (~url.indexOf(prefix)) {
			protect = true;
		}
	});
	return protect;
}

// Configure function
function configure (config) {
		// We need to blow up somewhere else if these are bad values
	// This allows multiple calls to configure

	// Set state param in oauth2 to match the angular route
	settings.state = config.state || settings.state;

	// Set redirect uri to the current location
	// WARNING: Allows flexibility in development, but still must be registered as valid redirect uri on auth server
	settings.redirect_uri = config.redirectUri || settings.redirect_uri;

	// URLs to check for authentication on
	if (angular.isArray(config.contentUrls)) {
		angular.forEach(config.contentUrls, function (url) {
			if (settings.content_urls.indexOf(url) === -1) settings.content_urls.push(url);
		});
	}

	// Whether to login with popup or redirect
	settings.popup = config.popup || settings.popup;

	// Set scopes
	if (angular.isArray(config.scope)) {
		angular.forEach(config.scope, function (s) {
			if (settings.scope.indexOf(s) === -1) settings.scope.push(s);
		});
	}

	// ClientID and OAuth2 url
	settings.oauth2_url = config.oauth2Url || settings.oauth2_url;
	settings.client_id = config.clientId || settings.client_id;

	// Query param options
	settings.options = angular.extend({}, settings.options, (config.options || {}));

	// Auto-auth
	settings.auto_auth = config.autoAuth == null ? settings.auto_auth : config.autoAuth;
}

// Run-time service
function oauth2Service($injector, $q, $location, $window) {
		var foundOnPath = false;
	function findToken() {

		// If user added oauth attribute to body, we remove it once authentication is complete
		function showBody() {
			angular.element($window.document).find('body').removeAttr('oauth-hide');
		}

		// Throw error for missing required pieces
		if (!settings.client_id || !settings.redirect_uri || !settings.oauth2_url) {
			throw new Error('Missing required configuration options');
		}

		// Try to find access token on path
		var token = stripToken($window.location.href);
		if (token.access_token) {
			foundOnPath = true;
			saveToken(token, $window);
			showBody();
			if (token.state) {

				var pieces = token.state.split('?');

				// Set path
				$location.path(pieces[0]);

				// Set query
				$location.search(stripToken(pieces.slice(1).length ? '#' + pieces.slice(1)[0] : ''));

				// Set hash
				var hash = decodeURIComponent($window.location.href.split('#')[2]);
				if (hash && hash !== 'undefined') {
					$location.hash(hash);
				}

			} else if (~$window.location.hash.indexOf('/access_token') && $injector.has('$route')) {
				$window.location.hash = ''; // Clear hash if we aren't using routing or state
			}

			return;
		}

		// If we were logged in, but have an expired token, re-authenticate
		if (!service.isAuthenticated() && angular.isObject(service.getToken())) {
			service.authenticate();
			return;
		}

		// See if a login has occurred before forcing authentication
		// If we are authenticated, we are good
		if (service.isAuthenticated()) {
			showBody();
			return;
		}

		// Try to authenticate
		if (settings.auto_auth) {
			service.authenticate();
		}
	}

	// Configure the service
	var service = {};

	// Register a function to call when authentication occurs
	service.registerCallback = function (func) {
		return !foundOnPath || func();
	};

	service.authenticate = function () {
		// Start Oauth2 flow
		var url = buildUrl(settings, $window.location);

		// TODO: Popup style
		$window.location.href = url;
		settings.redirecting = true;
	};

	// Access to modify config later
	service.lateConfig = configure;

	service.isAuthenticated = function () {
		// Verify user is authenticated
		var token = angular.fromJson($window.sessionStorage[AUTH_SESSION_STORAGE_KEY + '-' + settings.client_id]);
		// var now = new Date().getTime();
		// var valid = (angular.isDefined(token) && parseInt(token.expires_at) > now);
		var valid = false;
		if (token) {
			valid = true;
		}

		return valid;
	};

	service.wasAuthenticated = function () {
		// Were you ever logged in?
		return angular.isDefined(angular.fromJson($window.sessionStorage[AUTH_SESSION_STORAGE_KEY + '-' + settings.client_id]));
	};

	service.updateToken = function () {

		var defer = $q.defer();

		// Try async authentication
		$injector.get('$http')({
			url: buildUrl(settings, $window.location),
			method: 'GET',
			withCredentials: true,
			headers: {
				Accept: 'application/json'
			}
		})
		.success(function (data) {
			if (angular.isObject(data)) {
				defer.resolve(saveToken(data, $window));
				return;
			}

			defer.reject('Token was not received as JSON');
		})
		.error(function () {
			// Authenticate normally
			console.warn('Attempted to retrieve token async, fallback to default method');
			defer.reject('Couldn\'t get token, re-authenticate');
			service.authenticate();
		});

		return defer.promise;
	};

	service.getConfig = function () {
		return angular.copy(settings);
	};

	service.getToken = function () {
		return angular.fromJson($window.sessionStorage[AUTH_SESSION_STORAGE_KEY + '-' + settings.client_id]);
	};

	// Kick off auth by calling function and configure auto token refresh
	findToken();

	return service;
}

function oauth2($provide, $httpProvider) {
		// Set up interceptor
	$httpProvider.defaults.useXDomain = true;
	delete $httpProvider.defaults.headers.common['X-Requested-With'];

	$provide.factory('authInterceptor', ['$oauth2', '$q', '$window', function ($oauth2, $q, $window) {
		return {
			request: function (config) {
				// Ignore requests not going to api urls
				if (urlRequiresAuth(config.url, settings)) {

					// Add token
					if ($oauth2.isAuthenticated()) {
						// config.headers.Authorization = 'Bearer ' + $oauth2.getToken().access_token;
						config.url += '?v=20140805&oauth_token=' + $oauth2.getToken().access_token;
						return config;
					} else if (!$oauth2.isAuthenticated() &&
					($oauth2.wasAuthenticated() || settings.auto_auth) && !settings.redirecting) {
						var promise = $oauth2.updateToken().then(function gotToken(token) {
							config.headers.Authorization = 'Bearer ' + token.access_token;
							saveToken(token, $window);
							return $q.when(config);
						}, function failedToGetToken() {
							return $q.reject('Invalid token cant be used for request');
						});
						return promise;
					}
				}
				return config;
			}
		};
	}]);

	$httpProvider.interceptors.push('authInterceptor');
}

oauth2.prototype.$get = ['$injector', '$q', '$location', '$window', oauth2Service];

// Configure the OAuth2 object
oauth2.prototype.configure = configure;

angular.module('angular-oauth2').provider('$oauth2', ['$provide', '$httpProvider', oauth2]);
angular.module('angular-oauth2').constant('oauth2-key', AUTH_SESSION_STORAGE_KEY);

})(angular);
