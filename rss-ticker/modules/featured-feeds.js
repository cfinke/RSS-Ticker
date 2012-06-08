var FEATURED_TICKER_FEEDS = {
	"apiUrl" : "http://www.chrisfinke.com/files/updaters/featured-feeds.json",
	
	loadStack : 0,
	
	load : function () {
		FEATURED_TICKER_FEEDS.loadStack++;
		
		if (FEATURED_TICKER_FEEDS.loadStack == 1) {
			FEATURED_TICKER_FEEDS.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.rssticker.");	
			FEATURED_TICKER_FEEDS.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
			FEATURED_TICKER_FEEDS.prefs.addObserver("", FEATURED_TICKER_FEEDS, false);
			
			var feeds = FEATURED_TICKER_FEEDS.prefs.getCharPref("featuredFeeds");
			
			if (!feeds || FEATURED_TICKER_FEEDS.prefs.getCharPref("featuredFeeds.lastUpdate") < (new Date().getTime() - (1000 * 60 * 60 * 24 * 3))) {
				FEATURED_TICKER_FEEDS.prefs.setCharPref("featuredFeeds.lastUpdate", (new Date().getTime()));
				
				// Get feeds.
				FEATURED_TICKER_FEEDS.fetchTimer = FEATURED_TICKER_FEEDS.setTimeout(FEATURED_TICKER_FEEDS.fetchFeaturedFeeds, 15000);
			}
		}
	},
	
	unload : function () {
		FEATURED_TICKER_FEEDS.loadStack--;
		
		if (FEATURED_TICKER_FEEDS.loadStack == 0) {
			FEATURED_TICKER_FEEDS.prefs.removeObserver("", FEATURED_TICKER_FEEDS);
			FEATURED_TICKER_FEEDS.clearTimeout(FEATURED_TICKER_FEEDS.fetchTimer);
		}
	},
	
	observe : function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "featuredFeeds":
				FEATURED_TICKER_FEEDS.prefs.setBoolPref("featuredFeeds.new", true);
			break;
		}
	},
	
	setTimeout : function (callback, timeout, arg1, arg2, arg3, arg4) {
		var cb = {
			notify : function (timer) {
				callback(arg1, arg2, arg3, arg4);
			}
		};
		
		var timer = Components.classes["@mozilla.org/timer;1"]
		            .createInstance(Components.interfaces.nsITimer);
		timer.initWithCallback(cb, timeout, timer.TYPE_ONE_SHOT);
		return timer;
	},
	
	clearTimeout : function (timer) {
		if (timer) {
			timer.cancel();
		}
	},
	
	fetchTimer : null,
	
	fetchFeaturedFeeds : function () {
		var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Components.interfaces.nsIXMLHttpRequest);
		req.open("GET", FEATURED_TICKER_FEEDS.apiUrl, "true");
		
		req.onreadystatechange = function () {
			if (req.readyState == 4) {
				var text = req.responseText;
				
				var json = JSON.parse(text);
				
				for (var i = 0; i < json.length; i++) {
					var url = json[i].url;
					var siteUrl = json[i].siteUrl;
					
					if (url.indexOf("?") != -1) {
						url += "&app=rss-ticker";
					}
					else {
						url += "?app=rss-ticker";
					}
					
					if (siteUrl.indexOf("?") != -1) {
						siteUrl += "&app=rss-ticker";
					}
					else {
						siteUrl += "?app=rss-ticker";
					}
					
					json[i].url = url;
					json[i].siteUrl = siteUrl;
				}
				
				FEATURED_TICKER_FEEDS.prefs.setCharPref("featuredFeeds", JSON.stringify(json));
			}
		};
		
		req.send(null);
	},
	
	log : function (m) {
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		consoleService.logStringMessage("RSSTICKER: " + m);
	}
};

var EXPORTED_SYMBOLS = ["FEATURED_TICKER_FEEDS"];