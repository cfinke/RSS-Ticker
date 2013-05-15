var Ci = Components.interfaces,
	Cc = Components.classes,
	Cr = Components.results,
	Cu = Components.utils;

var RSS_TICKER_UTILS = {
	prefs : Cc["@mozilla.org/preferences-service;1"].getService( Ci.nsIPrefService ).getBranch( "extensions.rssticker." ),
	
	log : function () {
		if ( ! this.prefs.getBoolPref( 'debug' ) )
			return;

		for ( var i = 0, _len = arguments.length; i < _len; i++ ) {
			var message = arguments[i];

			if ( typeof message !== 'string' ) {
				try {
					var tryAgain = false;
					
					var children = '';

					for ( var j in message ) {
						try {
							children += j + ": " + message[j] + "\n";
						} catch ( e ) {
							tryAgain = true;
						}
					}
					
					if ( tryAgain ) {
						this.log( children );
						throw "Trying again...";
					}
					
					message = children;
				} catch ( e ) {
					this.log( 'First exception in logging: ' + e);
					
					try {
						message = JSON.stringify( message );
					} catch ( e ) {
						this.log( 'JSON exception in logging: ' + e);
						
						try {
							message = message.toSource();
						} catch ( e ) {
							this.log( 'Final exception in logging: ' + e);
							continue;
						}
					}
				}
			}

			Cc["@mozilla.org/consoleservice;1"]
				.getService(Ci.nsIConsoleService)
				.logStringMessage( "RSSTICKER: (" + ( new Date() ).toUTCString() + ") " + message );
		}
	},
};

RSS_TICKER_UTILS.prefs.QueryInterface( Ci.nsIPrefBranch2 );

var EXPORTED_SYMBOLS = ["RSS_TICKER_UTILS"];