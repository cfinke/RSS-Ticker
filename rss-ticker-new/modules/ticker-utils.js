var Ci = Components.interfaces,
	Cc = Components.classes,
	Cr = Components.results,
	Cu = Components.utils;

var RSS_TICKER_UTILS = {
	prefs : Cc["@mozilla.org/preferences-service;1"].getService( Ci.nsIPrefService ).getBranch( "extensions.rssticker." ),
	
	log : function () {
		for ( var i = 0, _len = arguments.length; i < _len; i++ ) {
			var message = arguments[i];

			if ( typeof message !== 'string' ) {
				try {
					message = JSON.stringify( message );
				} catch ( e ) {
					this.log( 'Exception in logging.' );
					continue;
				}
			}

			Cc["@mozilla.org/consoleservice;1"]
				.getService(Ci.nsIConsoleService)
				.logStringMessage( "RSSTICKER: " + message );
		}
	},
};

var EXPORTED_SYMBOLS = ["RSS_TICKER_UTILS"];