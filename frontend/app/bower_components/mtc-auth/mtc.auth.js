// Add css for hiding body if desired :)
// Disable JSCS for $oauth2 properties
// jscs:disable requireCamelCaseOrUpperCaseIdentifiers

(function (angular) {
	'use strict';

	angular.module('angular-oauth2', []);

	// Configure service that will handle redirectURIs and ClientIds
	function oauth2($httpProvider, oauthKey) {

		$httpProvider.defaults.useXDomain = true;
		delete $httpProvider.defaults.headers.common['X-Requested-With'];

		$httpProvider.interceptors.push(['$injector', function ($injector) {
			return {
				request: function (config) {
					// Ignore requests not going to api urls
					if (isProtectedUrl(config.url)) {
						if (!$injector.get('$oauth2').isAuthenticated() &&
							($injector.get('$oauth2').wasAuthenticated() || settings.auto_auth) && !settings.redirecting) {
							var promise = $injector.get('$oauth2').updateToken().then(function gotToken(token) {
								config.headers.Authorization = 'Bearer ' + token.access_token;
								saveToken(token);
								return config;
							}, function failedToGetToken() {
								return config;
							});
							return promise;
						}
					}
					return config;
				}
			};
		}]);

		// Check url against protected urls
		function isProtectedUrl(url) {
			var protect = false;
			angular.forEach(settings.content_urls, function (prefix) {
				if (~url.indexOf(prefix)) {
					protect = true;
				}
			});
			return protect;
		}

		var tokenRefreshReduction = (60 * 1000 * 5); // 5 minutes

		function saveToken(token) {
			// Save to session storage
			var now = new Date().getTime();
			token.expires_at = token.expires_at || new Date(now + ((token.expires_in * 1000) - tokenRefreshReduction)).getTime();
			window.sessionStorage[oauthKey + '-' + oauth.client_id] = angular.toJson(token);
			$httpProvider.defaults.headers.common.Authorization = 'Bearer ' + token.access_token;
			return token;
		}

		var oauth = {
			response_type: 'token' // We only support token currently
		}, settings = {
			redirecting: false // Help with not trying to renew token when redirect is about to happen
		};

		// Configure the OAuth2 object
		oauth2.prototype.configure = function (config) {

			// Set state param in oauth2 to match the angular route
			if (angular.isDefined(config.state)) {
				if (typeof config.state === 'boolean') {
					settings.state = config.state;
					delete config.state;
				}
			}

			// Set redirect uri to the current location
			// WARNING: Allows flexibility in development, but still must be registered as valid redirect uri on auth server
			if (angular.isDefined(config.redirect_uri)) {
				if (typeof config.redirect_uri === 'boolean') {
					settings.auto_redirect = config.redirect_uri;
					delete config.redirect_uri;
				}
			}

			// URLs to check for authentication on
			if (angular.isDefined(config.content_urls) && angular.isArray(config.content_urls)) {
				settings.content_urls = settings.content_urls || [];
				angular.forEach(config.content_urls, function (url) {
					settings.content_urls.push(url);
				});
				delete config.content_urls;
			}

			// Whether to login with popup or redirect
			// Default redirect (false)
			if (angular.isDefined(config.popup) && config.popup) {
				settings.popup = config.popup;
				delete config.popup;
			}

			// If two different config functions call configure, scope
			// could potential be messed up.  Handle that here
			if (angular.isDefined(oauth.scope) && config.scope) {
				oauth.scope += ' ' + config.scope;
				delete config.scope;
			}

			// Prevent issues of overwriting values
			if (!angular.isDefined(config.oauth2_url)) {
				config.oauth2_url = oauth.oauth2_url;
			}
			if (!angular.isDefined(config.client_id)) {
				config.client_id = oauth.client_id;
			}

			settings.options = angular.extend(settings.options || {}, config.options || {});
			delete config.options;
			settings.auto_auth = (config.auto_auth != null) ? config.auto_auth : (settings.auto_auth != null  ? settings.auto_auth : true);

			delete config.auto_auth;
			angular.extend(oauth, config);
		};

		oauth2.prototype.$get = ['$injector', '$q', '$location', '$window',
		function ($injector, $q, $location, $window) {

			function buildUrl(config) {

				var oauth = angular.copy(config);
				var url = oauth.oauth2_url + '?';
				delete oauth.oauth2_url;

				var state = $window.location.hash.substring(1);
				var redirect = $window.location.protocol + '//' + $window.location.hostname +
					($window.location.port === '' ? '' : ':' + $window.location.port) + ($window.location.pathname || '');
				url += 'client_id=' + oauth.client_id;
				url = oauth.scope ? (url + '&scope=' + oauth.scope) : url;
				url = (settings.state && state) ? (url + '&state=' + encodeURIComponent(state)) :
					(oauth.state ? (url + '&state=' + encodeURIComponent(oauth.state)) : url);
				url += '&response_type=token'; // Force token auth type for now
				url = (settings.auto_redirect && redirect) ? (url + '&redirect_uri=' + redirect) : (url + '&redirect_uri=' + oauth.redirect_uri);

				angular.forEach(settings.options, function (value, key) {
					url += '&' + key + '=' + value;
				});
				return url;
			}

			function stripToken(path) {
				var params, queryString = '', regex = /([^&=]+)=([^&]*)/g, m;
				var pathChunks = path.split('#');

				if (pathChunks.length > 1) {

					if (pathChunks[1].charAt(0) === '/') { // if hash was found, this shouldnt be undefined
						pathChunks[1] = pathChunks[1].substring(1);
					}

					queryString = pathChunks[1];
					while ((m = regex.exec(queryString))) {
						if (!angular.isDefined(params)) {
							params = {};
						}
						params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);// save out each query param
					}
				}
				return (params && params.access_token && params.expires_in) ? params : null;
			}

			var foundOnPath = false;
			function findToken() {

				// If user added oauth attribute to body, we remove it once authentication is complete
				function showBody() {
					angular.element($window.document).find('body').removeAttr('oauth-hide');
				}

				// Throw error for missing required pieces
				if ((!angular.isDefined(oauth.redirect_uri) && !settings.auto_redirect) ||
					!angular.isDefined(oauth.client_id) ||
					!angular.isDefined(oauth.oauth2_url)) {
					throw new Error('Missing required configuration options');
				}

				// Try to find access token on path
				var token;
				if ((token = stripToken(String($window.location)))) {
					foundOnPath = true;
					saveToken(token);
					showBody();
					if (token.state) {
						var pieces = token.state.split('?');
						// Check for hash (either side of potential '?')
						var hashLeft = (pieces[0] || '').split('#');
						var hashRight = (pieces[1] || '').split('#');
						var hash = hashLeft[1] ? hashLeft[1] : (hashRight[0] ?  hashRight[0] : null);
						$location.path(pieces[0]).search(pieces.slice(1).join('?'));
						if (hash) {
							$location.hash(hash);
						}
					} else if (~window.location.hash.indexOf('/access_token')) {
						window.location.hash = ''; // Clear hash if we aren't using routing or state
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
				var url = buildUrl(oauth);

				// TODO: Popup style
				if (!settings.popup) {
					$window.location.href = url;
					settings.redirecting = true;
				}
			};

			// Access to modify config later
			service.lateConfig = oauth2.prototype.configure;

			service.isAuthenticated = function () {
				// Verify user is authenticated
				var token = angular.fromJson($window.sessionStorage[oauthKey + '-' + oauth.client_id]);
				var now = new Date().getTime();
				var valid = (angular.isDefined(token) && parseInt(token.expires_at) > now);

				if (valid) {
					saveToken(token);
				}

				return valid;
			};

			service.wasAuthenticated = function () {
				// Were you ever logged in?
				return angular.isDefined(angular.fromJson($window.sessionStorage[oauthKey + '-' + oauth.client_id]));
			};

			service.updateToken = function () {

				var defer = $q.defer();

				// Try async authentication
				$injector.get('$http')({url: buildUrl(oauth), method: 'GET', withCredentials: true, headers: {Accept: 'application/json'}})
				.success(function (data) {
					if (angular.isObject(data)) {
						defer.resolve(saveToken(data));
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
				return angular.extend(angular.copy(settings), angular.copy(oauth));
			};

			service.getToken = function () {
				return angular.fromJson($window.sessionStorage[oauthKey + '-' + oauth.client_id]);
			};

			// Kick off auth by calling function and configure auto token refresh
			findToken();

			return service;
		}];
	}

	angular.module('angular-oauth2').provider('$oauth2', ['$httpProvider', 'oauth2-key', oauth2]);
	angular.module('angular-oauth2').constant('oauth2-key', 'angular-oauth2');

	// jscs:disable requireCamelCaseOrUpperCaseIdentifiers
})(angular);
