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

	$scope.$oauth2 = $oauth2;

	$scope.getStuff = function () {
		$http.get('https://api.foursquare.com/v2/users/self/checkins')
		.success(function (data) {
			console.log(data);
		});
		$http.get('https://api.foursquare.com/v2/users/self')
		.success(function (data) {
			console.log(data);
		});
	};
}]);