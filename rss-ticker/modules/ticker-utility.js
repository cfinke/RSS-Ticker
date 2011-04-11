var RSSTICKER_UTIL = {
	_livemarkService : null,
	get livemarkService() { if (!RSSTICKER_UTIL._livemarkService) { RSSTICKER_UTIL._livemarkService = Components.classes["@mozilla.org/browser/livemark-service;2"].getService(Components.interfaces.nsILivemarkService); } return RSSTICKER_UTIL._livemarkService; },

	_bookmarkService : null,
	get bookmarkService() { if (!RSSTICKER_UTIL._bookmarkService) { RSSTICKER_UTIL._bookmarkService = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Components.interfaces.nsINavBookmarksService); } return RSSTICKER_UTIL._bookmarkService; },

	_ioService : null,
	get ioService() { if (!RSSTICKER_UTIL._ioService) { RSSTICKER_UTIL._ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService); } return RSSTICKER_UTIL._ioService; },
	
	strings : {
		_backup : null,
		_main : null,
		
		initStrings : function () {
			if (!this._backup) { this._backup = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).createBundle("chrome://rss-ticker-default-locale/content/locale.properties"); }
			if (!this._main) { this._main = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).createBundle("chrome://rss-ticker/locale/locale.properties"); }
		},
		
		getString : function (key) {
			this.initStrings();
			
			var rv = "";
			
			try {
				rv = this._main.getString(key);
			} catch (e) {
			}
			
			if (!rv) {
				try {
					rv = this._backup.getString(key);
				} catch (e) {
				}
			}
			
			return rv;
		},
		
		getFormattedString : function (key, args) {
			this.initStrings();
			
			var rv = "";
			
			try {
				rv = this._main.getFormattedString(key, args);
			} catch (e) {
			}
			
			if (!rv) {
				try {
					rv = this._backup.getFormattedString(key, args);
				} catch (e) {
				}
			}
			
			return rv;
		}
	}
};

var EXPORTED_SYMBOLS = ["RSSTICKER_UTIL"];