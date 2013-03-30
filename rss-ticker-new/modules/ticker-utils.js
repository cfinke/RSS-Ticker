var Ci = Components.interfaces,
	Cc = Components.classes,
	Cr = Components.results,
	Cu = Components.utils;

var RSS_TICKER_UTILS = {
	prefs : Cc["@mozilla.org/preferences-service;1"].getService( Ci.nsIPrefService ).getBranch( "extensions.rssticker." ),
};

var EXPORTED_SYMBOLS = ["RSS_TICKER_UTILS"];