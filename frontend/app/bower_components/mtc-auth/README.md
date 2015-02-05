# Angular OAuth2

This module aims to help apps with OAuth2 authentication in angular apps.

### Setup
1. `bower install --save git@gitlab.mtc.byu.edu:mtc-angular-modules/mtc-auth.git`
2. Make sure you have the file referenced in your `index.html` (i.e `<script src="bower_components/mtc-auth/dist/mtc.auth.js"></script>`)

### Usage
First, make sure you include the module in your app.

```javascript
angular.module('myModule', ['angular-oauth2']);
```

Configure your client with the following options on your `config` function:

* **clientId** ( _required_ ) : Id of your client
* **oauth2Url** ( _required_ ) : url to redirect to for authentication (for MTC Auth, it's `https://auth.mtc.byu.edu/oauth2/auth`)
* **scope** : (*[string, string]*) array of scope strings
* **autoAuth** : if `true`, the app will redirect to authenticate when it loads, if `false` you will have to manually call `$oauth2.authenticate()` at some point in your app with the `$oauth2` service.  Defaults to `true`.
* **state** : a string representing the state of your app you wish to return to.  If you are using `ngRoute` you can set this value to `true` to use the angular path part of the route as your state, and you will return directly to where you started in your app after authentication.
* **contentUrls** : (*[string, string]*) an array of API prefixes that need to be protected by auth.  The module will ensure that a valid token is possessed by the user before getting content from these API's and will even automatically refresh your token in the background when it expires.
* **redirectUri** ( *required* ) : the URL you want auth to take the user back to after authentication.  If you just want to user to go back to where they started, set this as `true`
* **options** : a map of additional key/value pairs to include on the request to auth

**Example**

```javascript
.config(['$oauth2Provider', function ($oauth2Provider) {
	$oauth2Provider.configure({
		clientId: '12345',
		redirect_uri: true,
		state: true,
		oauth2_url: 'https://auth.mtc.byu.edu/oauth2/auth',
		scope: 'https://api.mtc.byu.edu/myapp https://api.mtc.byu.edu/myotherapp'
	});
}]);
```

### BYU Sign In
If you need to require BYU signin in addition to LDS signin, you can use the `options` in the `$oauth2Provider.configure()` call like so:

```javascript
options: {
	request_auths: 'byulogin'
}
```

The possible options are as follows:

* **byulogin**
	* Require a user to signin to BYU every time they visit your app in addition to LDS account
* **byurequired**
	* This option ensures a user has bound their BYU account to their LDS account by making sure they signin to BYU at least once if they never have, other wise signing into byu isn't necessary
* **byu**
	* The option to signin to byu is given to the user, but they don't have to

### Pro Tips

If you want to run a function when a user actually authenticates to your app, you can do so.  Using the `$oauth2` service (likely in a `$rootScope.run` function), register your callback function like so:

```javascript
$oauth2.registerCallback(function () {
	// Do something
});
```

Multiple modules can register with the auth client at once.  Only one module should supply the required options in the configuration, but if other modules have their own `.config()` function, they too can supply configuration options to the auth module.  This can be useful if you want to extrapolate away your backend code into its own module, and have it register the required scopes and content_urls with auth.  For an example, please see the [personnel api module](http://gitlab.mtc.byu.edu/mtc-angular-modules/mtc-ng-personnel/blob/master/mtc.personnel.js#L7).  The example shows it registers additional scopes and content_urls.  The auth module is smart enough to handle this.
