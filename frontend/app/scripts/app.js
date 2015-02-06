'use strict';

angular.module('foursquare', [
	'ngSanitize',
	'angular-oauth2'
])
.config(['$oauth2Provider', function ($oauth2) {

	$oauth2.configure({
		clientId: 'DU0NBQTNEANSZ0PZVQT5VKEPGJQK0DJYZHHUA1UUV1WJZGK0',
		redirectUri: true,
		autoAuth: false,
		oauth2Url: 'https://foursquare.com/oauth2/authorize',
		contentUrls: ['https://api.foursquare.com']
	});
}])

.run(['$rootScope', '$http', '$oauth2', function ($scope, $http, $oauth2) {

	// Expose app version info
	$http.get('version.json').success(function (v) {
		$scope.version = v.version;
		$scope.appName = v.name;
	});

	var data = {};

	$scope.$oauth2 = $oauth2;


	// Get info about existing users
	$http.get('https://52.0.30.223/api/users')
	.success(function (users) {
		data.allusers = users;
	});

	// Check if someone is logged in
	if (window.localStorage.foursquareuser) {
		data.loggedInUser = JSON.parse(window.localStorage.foursquareuser);

		// Is there foursquare sign in stuf?
		if ($oauth2.getToken() && !data.loggedInUser.id) {
			// Bind
			$http.get('https://api.foursquare.com/v2/users/self').
			success(function (user) {
				data.loggedInUser.id = user.id;
				updateUser(data.loggedInUser);
			});
		}
	}

	function updateUser(user) {
		return $http.put('https://52.0.30.223/api/users/' + user.username, user);
	}
	function saveNewUser(user) {
		return $http.post('https://52.0.30.223/api/users', user);
	}

	$scope.logout = function () {
		window.localStorage.clear();
		window.sessionStorage.clear();
		window.location.reload();
	};

	$scope.signup = function () {
		var found = false;
		data.allusers.forEach(function (user) {
			if (user.username === $scope.signin.name) {
				found = true;
			}
		});

		if (!found) {
			var user = {
				username: $scope.signin.name
			};
			saveNewUser(user).then(function () {
				data.loggedInUser = user;
				data.allusers.push(user);
				window.localStorage.foursquareuser = JSON.stringify(user);
			});
		}
	};

	$scope.data = data;

}]);
