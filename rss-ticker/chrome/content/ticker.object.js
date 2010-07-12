var RSSTICKER = {
	livemarkService : Components.classes["@mozilla.org/browser/livemark-service;2"].getService(Components.interfaces.nsILivemarkService),
	bookmarkService : Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Components.interfaces.nsINavBookmarksService),
	ioService : Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService),
	
	trendingNewsUrl : "http://api.ads.oneriot.com/search?appId=rssticker01&version=1.1&format=XML",
	trendingNewsExpiration : 0,
	
	ignoreFilename : "rss-ticker.ignore.txt",
	
	strings : null,
	
	profilePath : null,
	
	tickTimer : null,
	internalPause : false,
	
	/*****************************
	 * Default preference values *
	 *****************************/
	
	// Disable ticker
	disabled : false,
	
	// Should the ticker be hidden when empty?
	hideWhenEmpty : false,
	
	// Speed of the ticker: 1 is fastest, a million is the slowest (not really,
	// but it would be close
	tickSpeed : 12,
	
	// How often are the feeds updated (in minutes)?
	updateFrequency : 30,
	
	// Should the ticker items be shuffled?
	randomizeItems : false,
		
	// Number of ticks that it takes to remove one item completely
	// Set higher for a smoother scroll
	ticksPerItem : 200,
	
	hideVisited : true,
	boldUnvisited : false,
	
	// Item width options
	
	displayWidth : {
		// Should there be a limit for item width?
		limitWidth : true,
		
		// Should the width set a max width or a width?
		isMaxWidth : false,
		
		// Width in pixels
		itemWidth : 250
	},
	
	// Context Menu options
	cmOptions : {
		open : true,
		openInTab : true,
		openInWindow : false,
		
		openAllInTabs : true,
		openUnreadInTabs : false,
		openFeedInTabs : true,
		openFeedUnreadInTabs : false,
		
		copyLinkTitle : false,
		copyLinkURL : true,
		
		refreshFeeds : true,
		manageFeeds : true,
		
		markAsRead : true,
		markFeedAsRead : true,
		markAllAsRead : true,
		
		options : true,
		disableTicker : false
	},
	
	// Always open in new tab
	alwaysOpenInNewTab : false,
	
	// Limit number of items per feed
	limitItemsPerFeed : false,
	itemsPerFeed : 5, 
	
	/*****************************
	 * End def preference values *
	 *****************************/
	
	// True when the mouse is over the ticker
	mouseOverFlag : false,
	
	// Reference to the actual physical toolbar
	toolbar : null,
	
	// Reference to container for toolbar and other info
	ticker : null,
	
	// Toggles on/off debugging messages in the console.
	DEBUG : false,
	
	// Button on the toolbar that shows status messages when the feeds are loading
	loadingNotice : null,
	
	// Current width of the first feed item (the one that is being shrunk)
	currentFirstItemMargin : 0,
	
	tickLength : 0,
	
	onload : function () {
		RSSTICKER.loadPrefs();
		
		var db = RSSTICKER.getDB();
		
		if (!db.tableExists("history")) {
			db.executeSimpleSQL("CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, date INTEGER)");
		}
		
		RSSTICKER.strings = document.getElementById("RSSTICKER-bundle");
		RSSTICKER.customizeContextMenus();
		
		RSSTICKER.ticker = document.createElement('toolbar');
		RSSTICKER.ticker.setAttribute("id", "RSSTICKERToolbar");
		RSSTICKER.ticker.setAttribute("class", "chromeclass-toolbar");
		RSSTICKER.ticker.setAttribute("hidden", false);
		RSSTICKER.ticker.setAttribute("iconsize", "small");
		RSSTICKER.ticker.setAttribute("inherits", "collapsed,hidden");
		RSSTICKER.ticker.setAttribute("mode", "full");
		RSSTICKER.ticker.setAttribute("persist", "collapsed,hidden");
		RSSTICKER.ticker.setAttribute("toolbarname", RSSTICKER.strings.getString("extension.name"));
		RSSTICKER.ticker.style.maxHeight = '24px';
	
		RSSTICKER.toolbar = document.createElement('hbox');
		RSSTICKER.toolbar.spacer = document.createElement('spacer');
		RSSTICKER.toolbar.appendChild(RSSTICKER.toolbar.spacer);
		RSSTICKER.toolbar.style.maxHeight = '24px';
		
		RSSTICKER.observe(null, "nsPref:changed", "boldUnvisited");
		RSSTICKER.observe(null, "nsPref:changed", "dw.limitWidth");
		
		RSSTICKER.ticker.setAttribute("contextmenu","RSSTICKERCM");
		
		RSSTICKER.ticker.setAttribute("onmouseover","RSSTICKER.mouseOverFlag = true;");
		RSSTICKER.ticker.setAttribute("onmouseout","RSSTICKER.mouseOverFlag = false;");

		document.getElementById("RSSTICKERItemCM").setAttribute("onmouseover","RSSTICKER.mouseOverFlag = true;");
		document.getElementById("RSSTICKERItemCM").setAttribute("onmouseout","RSSTICKER.mouseOverFlag = false;");
	
		RSSTICKER.ticker.appendChild(RSSTICKER.toolbar);
		
		RSSTICKER.loadingNoticeParent = document.createElement('toolbaritem');
		RSSTICKER.loadingNoticeParent.setAttribute("tooltip","RSSTICKERLoadingNoticeTooltip");
		RSSTICKER.loadingNoticeParent.id = "RSSTICKER-throbber-box";
		RSSTICKER.loadingNoticeParent.setAttribute("title","RSS Ticker Activity Indicator");
		RSSTICKER.loadingNoticeParent.setAttribute("align","center");
		RSSTICKER.loadingNoticeParent.setAttribute("pack","center");
	
		RSSTICKER.loadingNotice = document.createElement('image');
		RSSTICKER.loadingNotice.setAttribute("src","chrome://rss-ticker/content/skin-common/throbber.gif");
		RSSTICKER.loadingNotice.id = "RSSTICKER-throbber";
		RSSTICKER.loadingNotice.setAttribute("busy","false");
		RSSTICKER.loadingNotice.style.marginRight = '4px';
		RSSTICKER.loadingNoticeParent.appendChild(RSSTICKER.loadingNotice);
	
		try {
			document.getElementById("nav-bar").appendChild(RSSTICKER.loadingNoticeParent);
		} catch (e) {
			if (RSSTICKER.DEBUG) RSSTICKER.logMessage(e);
		}
		
		if (RSSTICKER.prefs.getBoolPref("disabled")){
			RSSTICKER.disable();
			return;
		}
		else {
			RSSTICKER.enable();
		}
		
		RSSTICKER.showFirstRun();
		
		// Ask if they want the trending terms feed.
		if (!RSSTICKER.prefs.getBoolPref("trendRequest")) {
			RSSTICKER.prefs.setBoolPref("trendRequest", true);
			
			setTimeout(
				function () {
					window.openDialog("chrome://rss-ticker/content/one-riot-suggestion.xul", "trends", "chrome,dialog,centerscreen,titlebar,alwaysraised");
				}, 5000
			);
		}
	},
	
	getVersion : function (callback) {
		var addonId = "{1f91cde0-c040-11da-a94d-0800200c9a66}";
		
		if ("@mozilla.org/extensions/manager;1" in Components.classes) {
			// < Firefox 4
			var version = Components.classes["@mozilla.org/extensions/manager;1"]
				.getService(Components.interfaces.nsIExtensionManager).getItemForID(addonId).version;
			
			callback(version);
		}
		else {
			// Firefox 4.
			Components.utils.import("resource://gre/modules/AddonManager.jsm");  
			
			AddonManager.getAddonByID(addonId, function (addon) {
				callback(addon.version);
			});
		}
	},
	
	showFirstRun : function () {
		function isMajorUpdate(version1, version2) {
			if (!version1) {
				return true;
			}
			else {
				var oldParts = version1.split(".");
				var newParts = version2.split(".");
		
				if (newParts[0] != oldParts[0] || newParts[1] != oldParts[1]) {
					return true;
				}
			}
			
			return false;
		}
		
		function doShowFirstRun(version) {
			if (isMajorUpdate(RSSTICKER.prefs.getCharPref("lastVersion"), version)) {
				var theTab = gBrowser.addTab("http://www.chrisfinke.com/firstrun/rss-ticker.php?v="+version);
				gBrowser.selectedTab = theTab;
			}
			
			RSSTICKER.prefs.setCharPref("lastVersion", version);
		}
		
		RSSTICKER.getVersion(doShowFirstRun);
	},
	
	observe : function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "boldUnvisited":
				RSSTICKER.boldUnvisited = RSSTICKER.prefs.getBoolPref("boldUnvisited");
				RSSTICKER.ticker.setAttribute("boldUnvisited", RSSTICKER.boldUnvisited);
			break;
			case "dw.limitWidth":
			case "dw.itemWidth":
			case "dw.isMaxWidth":
				RSSTICKER.displayWidth.limitWidth = RSSTICKER.prefs.getBoolPref("dw.limitWidth");
				RSSTICKER.displayWidth.itemWidth = RSSTICKER.prefs.getIntPref("dw.itemWidth");
				RSSTICKER.displayWidth.isMaxWidth = RSSTICKER.prefs.getBoolPref("dw.isMaxWidth");
				
				RSSTICKER.ticker.setAttribute("limitWidth", RSSTICKER.displayWidth.limitWidth);
				RSSTICKER.ticker.setAttribute("isMaxWidth", RSSTICKER.displayWidth.isMaxWidth);
				
				if (!RSSTICKER.displayWidth.limitWidth) {
					var css = '#RSSTICKERToolbar toolbarbutton { width: auto !important; max-width: none !important; }';
				}
				else {
					if (RSSTICKER.displayWidth.isMaxWidth) {
						var css = '#RSSTICKERToolbar toolbarbutton { width: auto !important; max-width: '+RSSTICKER.displayWidth.itemWidth+'px !important; }';
					}
					else {
						var css = '#RSSTICKERToolbar toolbarbutton { width: '+RSSTICKER.displayWidth.itemWidth+'px !important; max-width: none !important; } ';
					}
				}
				
				var data = 'data:text/css;charset=utf-8,' + encodeURI(css);
				var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"].getService(Components.interfaces.nsIStyleSheetService);
				var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
				
				var u = ios.newURI(data, null, null);
				
				if (sss.sheetRegistered(u, sss.USER_SHEET)) {
					sss.unregisterSheet(u, sss.USER_SHEET);
				}
				
				sss.loadAndRegisterSheet(u, sss.USER_SHEET);
				
				RSSTICKER.adjustSpacerWidth();
			break;
			case "disabled":
				if (RSSTICKER.prefs.getBoolPref("disabled")) {
					RSSTICKER.disable();
				}
				else {
					RSSTICKER.enable();
				}
			break;
			case "hideWhenEmpty":
				RSSTICKER.hideWhenEmpty = RSSTICKER.prefs.getBoolPref("hideWhenEmpty");
			break;
			case "tickerPlacement":
				RSSTICKER.attachTicker();
			break;
			case "randomizeItems":
				RSSTICKER.randomizeItems = RSSTICKER.prefs.getBoolPref("randomizeItems");
			break;
			case "limitItemsPerFeed":
				RSSTICKER.limitItemsPerFeed = RSSTICKER.prefs.getBoolPref("limitItemsPerFeed");
			break;
			case "itemsPerFeed":
				if (RSSTICKER.prefs.getIntPref("itemsPerFeed") < 0) {
					RSSTICKER.prefs.setIntPref("itemsPerFeed", 0);
				}
				else {
					RSSTICKER.limitItemsPerFeed = RSSTICKER.prefs.getIntPref("itemsPerFeed");
				}
			break;
			case "alwaysOpenInNewTab":
				RSSTICKER.alwaysOpenInNewTab = RSSTICKER.prefs.getBooPref("alwaysOpenInNewTab");
			break;
			case "tickSpeed":
				RSSTICKER.tickLength = RSSTICKER.prefs.getIntPref("tickSpeed") * (500 / RSSTICKER.ticksPerItem);
			break;
			case "updateFrequency":
				RSSTICKER.setReloadInterval(RSSTICKER.prefs.getIntPref("updateFrequency"));
			break;
			case "ticksPerItem":
				RSSTICKER.ticksPerItem = RSSTICKER.prefs.getIntPref("ticksPerItem");
				RSSTICKER.tickLength = RSSTICKER.prefs.getIntPref("tickSpeed") * (500 / RSSTICKER.ticksPerItem);
			break;
			case "smoothness":
				if (RSSTICKER.prefs.getIntPref("smoothness") <= 0) {
					RSSTICKER.prefs.setIntPref("smoothness", 1);
				}
			break;
			case "updateToggle":
				RSSTICKER.updateAllFeeds();
			break;
			case "trendingNews":
				if (!RSSTICKER.prefs.getBoolPref("trendingNews")) {
					RSSTICKER.removeTrendingFeed();
				}
				else {
					RSSTICKER.addTrendingFeed();
				}
			break;
		}
		
		RSSTICKER.customizeContextMenus();
		RSSTICKER.checkForEmptiness();
	},
	
	attachTicker : function () {
		if (RSSTICKER.ticker.parentNode) {
			RSSTICKER.ticker.parentNode.removeChild(RSSTICKER.ticker);
		}
		
		var tickerPlacement = RSSTICKER.prefs.getIntPref("tickerPlacement");
		
		if (tickerPlacement == 1){
			// Beneath the status bar
			document.getElementById('browser-bottombox').insertBefore(RSSTICKER.ticker, document.getElementById('status-bar').nextSibling);
			if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Placed after status bar.");
		}
		else if (tickerPlacement == 2){
			// Up by the Bookmarks Toolbar
			document.getElementById('navigator-toolbox').appendChild(RSSTICKER.ticker);
			if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Placed in navigator toolbox.");
		}
	},
	
	enable : function () {
		RSSTICKER.disabled = false;
		
		if (document.getElementById("RSSTICKER-button")){
			document.getElementById("RSSTICKER-button").setAttribute("greyed","false");
		}
		
		RSSTICKER.attachTicker();
		RSSTICKER.adjustSpacerWidth();
		RSSTICKER.startFetchingFeeds();
	},
	
	disable : function () {
		if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Ticker disabled.");
		
		RSSTICKER.disabled = true;
		
		if (RSSTICKER.ticker.parentNode){
			RSSTICKER.ticker.parentNode.removeChild(RSSTICKER.ticker);
		}
		
		while (RSSTICKER.toolbar.childNodes.length > 0){
			RSSTICKER.toolbar.removeChild(RSSTICKER.toolbar.lastChild);
		}
		
		RSSTICKER.toolbar.appendChild(RSSTICKER.toolbar.spacer);
		
		if (document.getElementById("RSSTICKER-button")) {
			document.getElementById("RSSTICKER-button").setAttribute("greyed","true");
		}
		
		RSSTICKER.prefs.setIntPref("lastUpdate", 0);
		RSSTICKER.stopFetchingFeeds();
	},
	
	loadingNoticeTimeout : null,
	
	addLoadingNotice : function (message) {
		clearTimeout(RSSTICKER.loadingNoticeTimeout);
		
		if (!message || RSSTICKER.disabled) {
			RSSTICKER.loadingNotice.setAttribute("busy", "false");
		}
		else {
			if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Setting loading notice.");
			
			var text = document.createTextNode(message);
			
			while (document.getElementById("RSSTICKERLoadingNoticeText").childNodes.length > 0){
				document.getElementById("RSSTICKERLoadingNoticeText").removeChild(document.getElementById("RSSTICKERLoadingNoticeText").lastChild);
			}
			
			document.getElementById("RSSTICKERLoadingNoticeText").appendChild(text);
			
			RSSTICKER.loadingNotice.setAttribute("busy", "true");
		}
		
		RSSTICKER.loadingNoticeTimeout = setTimeout(function () { RSSTICKER.addLoadingNotice(); }, 5000);
	},
	
	loadPrefs : function () {
		if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Loading prefs.");
	
		RSSTICKER.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.rssticker.");
		RSSTICKER.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		RSSTICKER.prefs.addObserver("", this, false);
	
		RSSTICKER.disabled = RSSTICKER.prefs.getBoolPref("disabled");
		RSSTICKER.hideWhenEmpty = RSSTICKER.prefs.getBoolPref("hideWhenEmpty");
		RSSTICKER.randomizeItems = RSSTICKER.prefs.getBoolPref("randomizeItems");
		RSSTICKER.ticksPerItem = RSSTICKER.prefs.getIntPref("ticksPerItem");
		RSSTICKER.displayWidth.itemWidth = RSSTICKER.prefs.getIntPref("dw.itemWidth");
		RSSTICKER.limitItemsPerFeed = RSSTICKER.prefs.getBoolPref("limitItemsPerFeed");
		RSSTICKER.itemsPerFeed = RSSTICKER.prefs.getIntPref("itemsPerFeed");
		RSSTICKER.boldUnvisited = RSSTICKER.prefs.getBoolPref("boldUnvisited");
		RSSTICKER.hideVisited = RSSTICKER.prefs.getBoolPref("hideVisited");
		RSSTICKER.alwaysOpenInNewTab = RSSTICKER.prefs.getBoolPref("alwaysOpenInNewTab");
		RSSTICKER.displayWidth.limitWidth = RSSTICKER.prefs.getBoolPref("dw.limitWidth");
		RSSTICKER.displayWidth.isMaxWidth = RSSTICKER.prefs.getBoolPref("dw.isMaxWidth");
		
		RSSTICKER.tickLength = RSSTICKER.prefs.getIntPref("tickSpeed") * (500 / RSSTICKER.prefs.getIntPref("ticksPerItem"));
	},
	
	customizeContextMenus : function () {
		RSSTICKER.cmOptions.open = RSSTICKER.prefs.getBoolPref("cm.open");
		RSSTICKER.cmOptions.openInTab = RSSTICKER.prefs.getBoolPref("cm.openInTab");
		RSSTICKER.cmOptions.openInWindow = RSSTICKER.prefs.getBoolPref("cm.openInWindow");
		RSSTICKER.cmOptions.openAllInTabs = RSSTICKER.prefs.getBoolPref("cm.openAllInTabs");
		RSSTICKER.cmOptions.openUnreadInTabs = RSSTICKER.prefs.getBoolPref("cm.openUnreadInTabs");
		RSSTICKER.cmOptions.openFeedInTabs = RSSTICKER.prefs.getBoolPref("cm.openFeedInTabs");
		RSSTICKER.cmOptions.openFeedUnreadInTabs = RSSTICKER.prefs.getBoolPref("cm.openFeedUnreadInTabs");
		RSSTICKER.cmOptions.copyLinkTitle = RSSTICKER.prefs.getBoolPref("cm.copyLinkTitle");
		RSSTICKER.cmOptions.copyLinkURL = RSSTICKER.prefs.getBoolPref("cm.copyLinkURL");
		RSSTICKER.cmOptions.refreshFeeds = RSSTICKER.prefs.getBoolPref("cm.refreshFeeds");
		RSSTICKER.cmOptions.manageFeeds = RSSTICKER.prefs.getBoolPref("cm.manageFeeds");
		RSSTICKER.cmOptions.markAsRead = RSSTICKER.prefs.getBoolPref("cm.markAsRead");
		RSSTICKER.cmOptions.markFeedAsRead = RSSTICKER.prefs.getBoolPref("cm.markFeedAsRead");
		RSSTICKER.cmOptions.markAllAsRead = RSSTICKER.prefs.getBoolPref("cm.markAllAsRead");
		RSSTICKER.cmOptions.options = RSSTICKER.prefs.getBoolPref("cm.options");
		RSSTICKER.cmOptions.disableTicker = RSSTICKER.prefs.getBoolPref("cm.disableTicker");
			
		RSSTICKER.customizeContextMenu("RSSTICKERItemCM");
		RSSTICKER.customizeContextMenu("RSSTICKERCM");
		RSSTICKER.customizeContextMenu("RSSTICKERButtonCM");
	},
	
	customizeContextMenu : function(menuID){
		var menu = document.getElementById(menuID);
		var separator = null;
		var firstOption = false;
		
		var len = menu.childNodes.length;
		
		for (var i = 0; i < len; i++){
			var option = menu.childNodes[i];
			
			if (option.nodeName == 'menuitem'){
				if (RSSTICKER.cmOptions[option.getAttribute("option")] == false){
					option.style.display = 'none';
				}
				else {
					option.style.display = '';
					firstOption = true;
					
					if (separator) {
						separator.style.display = '';
					}
					
					separator = null;
				}
			}
			else {
				option.style.display = 'none';
				
				if (firstOption && !separator){
					separator = option;
				}
			}
		}
	},
	
	unload : function () {
		RSSTICKER.prefs.setIntPref("lastUpdate", 0);
	},
	
	options : function (panel) {
		var features = "";
		
		try {
			var instantApply = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("").getBoolPref("browser.preferences.instantApply");
			features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : "");
		}
		catch (e) {
			features = "chrome,titlebar,toolbar,centerscreen";
		}
		
		var optWin = openDialog("chrome://rss-ticker/content/options.xul", "", features);
		
		if (panel) {
			optWin.addEventListener("load", function (evt) {
				var win = evt.currentTarget;
				win.document.documentElement.showPane(win.document.getElementById(panel));
			}, false);
		}
		
		return optWin;
	},
	
	showFeaturedFeeds : function () {
		var allowedToShow = RSSTICKER.prefs.getBoolPref("featuredFeeds.notify");
		
		if (allowedToShow) {
			var needToShow = RSSTICKER.prefs.getBoolPref("featuredFeeds.new");
			
			if (needToShow) {
				var feedsToShow = RSSTICKER.prefs.getCharPref("featuredFeeds");
				
				if (feedsToShow) {
					// Add an item.
					
					if (!document.getElementById("RSSTICKER-feature-feeds-subscribe")){
						RSSTICKER.internalPause = true;
						
						var tbb = document.createElement('toolbarbutton');
						tbb.uri = "chrome://rss-ticker/content/options.xul";
						tbb.id = "RSSTICKER-feature-feeds-subscribe";
						tbb.description = RSSTICKER.strings.getString("rssticker.featured.description");
						tbb.feed = "A Message From RSS Ticker";
						tbb.feedURL = "rssticker";
						tbb.href = "chrome://rss-ticker/content/options.xul";
						tbb.displayHref = "Just around the corner here.";
						tbb.published = "";
						tbb.guid = "RSSTICKER-feature-feeds-subscribe";
						
						tbb.setAttribute("label", RSSTICKER.strings.getString("rssticker.featured.label"));
						tbb.setAttribute("tooltip", "RSSTICKERTooltip");
						tbb.setAttribute("image", "chrome://rss-ticker/content/skin-common/thumbs-up.png");
						tbb.setAttribute("onclick", "RSSTICKER.openFeaturedFeeds();");
						tbb.setAttribute("visited", "false");
						
						RSSTICKER.toolbar.appendChild(tbb);
						
						RSSTICKER.internalPause = false;
						
						RSSTICKER.adjustSpacerWidth();
						RSSTICKER.checkForEmptiness();
						RSSTICKER.tick();
					}
				}
			}
		}
	},
	
	openFeaturedFeeds : function () {
		RSSTICKER.prefs.setBoolPref("featuredFeeds.new", false);
		
		var tickerItem = document.getElementById("RSSTICKER-feature-feeds-subscribe");
		
		if (tickerItem) {
			RSSTICKER.internalPause = true;
			
			tickerItem.parentNode.removeChild(tickerItem);
			
			RSSTICKER.internalPause = false;
			
			RSSTICKER.adjustSpacerWidth();
			RSSTICKER.checkForEmptiness();
			RSSTICKER.tick();
		}
		
		RSSTICKER.options('featured-pane');
	},
	
	feedsToFetch : [],
	feedIndex : 0,
	feedUpdateTimeout : null,
	secondsBetweenFeeds : 0,
	
	stopFetchingFeeds : function () {
		clearTimeout(RSSTICKER.feedUpdateTimeout);
		
		RSSTICKER.feedsToFetch = [];
		RSSTICKER.feedIndex = 0;
	},
	
	startFetchingFeeds : function () {
		RSSTICKER.showFeaturedFeeds();
		
		if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Updating feeds " + new Date().toString());
		
		if (RSSTICKER.disabled) {
			return;
		}
		
		var ignore = RSSTICKER.readIgnoreFile();

		RSSTICKER.internalPause = true;
		
		for (var i = RSSTICKER.toolbar.childNodes.length - 1; i >= 0; i--){
			var node = RSSTICKER.toolbar.childNodes[i];
			
			if (node.nodeName == 'toolbarbutton'){
				if (RSSTICKER.inArray(ignore, node.feedURL)){
					RSSTICKER.toolbar.removeChild(node);
				}
			}
		}

		RSSTICKER.checkForEmptiness();

		RSSTICKER.internalPause = false;

	    RSSTICKER.feedsToFetch = [];
	    RSSTICKER.feedIndex = 0;
	    
		var anno = Components.classes["@mozilla.org/browser/annotation-service;1"].getService(Components.interfaces.nsIAnnotationService);
		var livemarkIds = anno.getItemsWithAnnotation("livemark/feedURI", {});
		
		var len = livemarkIds.length;
		
		for (var i = 0; i < len; i++){
			var livemarkId = livemarkIds[i];
			
			var feedURL = RSSTICKER.livemarkService.getFeedURI(livemarkId).spec;
			
			if (feedURL == "http://www.oneriot.com/rss/trendingtopics?&spid=86f2f5da-3b24-4a87-bbb3-1ad47525359d&p=rss-ticker&ssrc=ticker") {
				// This is the old trending news feed. Use the new subscription method.
				RSSTICKER.prefs.setBoolPref("trendingNews", true);
				
				var bookmarkService = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Components.interfaces.nsINavBookmarksService);
				bookmarkService.removeFolder(livemarkId);
			}
			else {
				var feedName = RSSTICKER.bookmarkService.getItemTitle(livemarkId);
			
				if (!RSSTICKER.inArray(ignore, feedURL)){
					RSSTICKER.feedsToFetch.push({ name : feedName, feed : feedURL, livemarkId : livemarkId });
				}
			}
		}
		
		if (RSSTICKER.prefs.getBoolPref("trendingNews")) {
			RSSTICKER.feedsToFetch.unshift(
				{
					"name" : "Trending News",
					"feed" : RSSTICKER.trendingNewsUrl,
					"livemarkId" : -1
				}
			);
		}
		
		if (RSSTICKER.feedsToFetch.length == 0) {
		    RSSTICKER.notifyNoFeeds();
		}
		
		setTimeout(function () {
		    RSSTICKER.setReloadInterval(RSSTICKER.prefs.getIntPref("updateFrequency"));
		}, 5000);
    },
	
	notifyNoFeeds : function () {
		var showWindow = true;
		
		try {
			showWindow = !RSSTICKER.prefs.getBoolPref("noFeedsFoundFlag.1.7");
		} catch (e) {
		}
		
		if (showWindow){
			var url = "chrome://rss-ticker/content/noFeedsFound.xul";
			var browser = gBrowser;
			var theTab = browser.addTab(url);
			browser.selectedTab = theTab;
		}
	},
	
	setReloadInterval : function (minutes) {
    	clearTimeout(RSSTICKER.feedUpdateTimeout);
    	
    	var numFeeds = RSSTICKER.feedsToFetch.length;
		var interval = minutes;
		
		if (numFeeds == 0) {
		    numFeeds = interval;
		}
		
		RSSTICKER.secondsBetweenFeeds = Math.ceil((interval * 60) / numFeeds);
        
        // Check if it's been more than $minutes minutes since the last full update.
	    var lastUpdate = RSSTICKER.prefs.getIntPref("lastUpdate") * 1000; 
	    var now = new Date().getTime();
	    
	    var minutesSince = (now - lastUpdate) / 1000 / 60;
	    
	    if ((minutes != 0) && (minutesSince > minutes)) {
	        RSSTICKER.updateAllFeeds();
        }
        else {
    	    RSSTICKER.updateAFeed();
        }
    },
	
	updateAFeed : function (indexOverride) {
        function setTimeoutForNext() {
            if (RSSTICKER.rapidUpdate) {
                var interval = 0.5;
            }
            else {
                if (RSSTICKER.secondsBetweenFeeds == 0) {
                    var interval = 60;
                }
                else {
                    var interval = RSSTICKER.secondsBetweenFeeds;
                }
            }
            
		    RSSTICKER.feedUpdateTimeout = setTimeout(function () { RSSTICKER.updateAFeed(); }, interval * 1000);
	    }
		
        clearTimeout(RSSTICKER.feedUpdateTimeout);
		
        if (RSSTICKER.disabled || RSSTICKER.feedsToFetch.length == 0 || (!RSSTICKER.rapidUpdate && RSSTICKER.secondsBetweenFeeds == 0)){
		    setTimeoutForNext();
		    return;
		}
		
		if (RSSTICKER.rapidUpdate) {
		    RSSTICKER.rapidUpdate--;
		    
		    if (!RSSTICKER.rapidUpdate) {
                RSSTICKER.stopUpdate();
	        }
		}
		
        if (RSSTICKER.feedIndex >= RSSTICKER.feedsToFetch.length) {
			RSSTICKER.feedIndex = 0;
        }
                
        var feedIndex = RSSTICKER.feedIndex;
        
		if (RSSTICKER.DEBUG) RSSTICKER.logMessage("indexOverride: " + indexOverride);

        if (typeof(indexOverride) != "undefined") {
            feedIndex = indexOverride;
        }
        else {
            ++RSSTICKER.feedIndex;
        }
        
        if (feedIndex == 0) {
            RSSTICKER.prefs.setIntPref("lastUpdate", Math.round(new Date().getTime() / 1000));
        }
        
		if (RSSTICKER.DEBUG) RSSTICKER.logMessage("feedIndex: " + feedIndex);
		if (RSSTICKER.DEBUG) RSSTICKER.logMessage("feedsToFetch: " + RSSTICKER.feedsToFetch);
		

        var feed = RSSTICKER.feedsToFetch[feedIndex];

		if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Feed: " + feed.toSource());
		
	    var url = feed.feed;
			
		if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Url: " + url);
		
		if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Loading " + url);
		
		var req = new XMLHttpRequest();
		req.parent = this;
		req.parent.addLoadingNotice("Updating " + feed.name + " (" + parseInt(feedIndex + 1, 10) + ")...");
	
		RSSTICKER.currentRequest = req;
		
		if (url == RSSTICKER.trendingNewsUrl) {
			if (RSSTICKER.trendingNewsExpiration > (new Date()).getTime()) {
				RSSTICKER.checkForEmptiness();
				RSSTICKER.tick();
				setTimeoutForNext();
			
				return;
			}
			
			req.overrideMimeType("text/xml");
		}
		
		/* START FEED FETCH HERE */
	
		try {
			req.open("GET", url, true);
		
			req.onreadystatechange = function (event) {
				if (req.readyState == 4) {
					clearTimeout(req.parent.loadTimer);
				
					req.parent.currentRequest = null;
					setTimeoutForNext();
					
					try {
						if (req.status == 200){
							try {
								if (url == RSSTICKER.trendingNewsUrl) {
									req.parent.parseTrendingNews(req.responseXML, url);
								}
								else {
									req.parent.queueForParsing(req.responseText.replace(/^\s\s*/, '').replace(/\s\s*$/, ''), url);
								}
							} catch (e) {
								// Parse error
							}
						}
						else {
						}
					}
					catch (e) {
					}
				}
			};
		
			req.send(null);
			RSSTICKER.loadTimer = setTimeout(function () { RSSTICKER.killCurrentRequest(); }, 1000 * 15);
		}
		catch (e) {
			setTimeoutForNext();
		}
		
		RSSTICKER.checkForEmptiness();
		RSSTICKER.tick();
    },

	parseTrendingNews : function (xml, url) {
		// Cache for an hour.
		var cache = 60;// xml.getElementsByTagName("max-age")[0].textContent;
		RSSTICKER.trendingNewsExpiration = (new Date()).getTime() + (cache * 60 * 1000);
		
		var listener = new TickerParseListener();
		
		var result = {
			bozo : false,
			
			doc : {
				QueryInterface : function () { },
				
				link : {
					resolve : function () {
						return "http://www.oneriot.com/";
					}
				},
				
				title : {
					plainText : function () {
						return "Trending News";
					}
				},
				
				summary : {
					text : "Trending news courtesy of RSS Ticker"
				},
				
				items : {
					get length() { return this._items.length; },
					
					queryElementAt : function (index) {
						return this._items[index];
					},
					
					_items : []
				}
			},
			
			uri : {
				_uri : url,
				
				resolve : function () {
					return this._uri;
				}
			}
		};
		
		var items = xml.getElementsByTagName("featured-result");
		var updated = new Date();
		updated.setTime( xml.getElementsByTagName("time")[0].textContent * 1000);
		
		var len = items.length;
		
		for (var i = 0; i < len; i++) {
			var item_i = items[i];
			
			var itemUrl = item_i.getElementsByTagName("redirect-url")[0].textContent;
			
			var item = {
				id : "http://" + item_i.getElementsByTagName("display-url")[0].textContent,
				
				uri : itemUrl,
				
				displayUri : item_i.getElementsByTagName("display-url")[0].textContent,
				trackingUri : item_i.getElementsByTagName("tracking-url")[0].textContent,
				
				link : {
					_link : item_i.getElementsByTagName("redirect-url")[0].textContent,
				
					resolve : function () {
						return this._link;
					}
				},
				
				updated : updated,
				
				title : {
					_title : item_i.getElementsByTagName("title")[0].textContent,
				
					plainText : function () {
						return this._title.replace(/<[^>]+>/g, "");
					}
				},
			
				summary : {
					_summary : item_i.getElementsByTagName("snippet")[0].textContent,
				
					get text() {
						return this._summary.replace(/<[^>]+>/g, "");
					} 
				},
			
				image : "chrome://rss-ticker/content/skin-common/feed-icon-16.png"//item_i.getElementsByTagName("source-logo")[0].getElementsByTagName("url")[0].textContent
			};
			
			result.doc.items._items.push(item);
		}
		
		listener.handleResult(result);
	},
	
	removeFeed : function (livemarkId) {
		var len = RSSTICKER.feedsToFetch.length;
		
		for (var i = 0; i < len; i++) {
			var feedToFetch = RSSTICKER.feedsToFetch[i];
			
			if (feedToFetch.livemarkId == livemarkId) {
				var label = feedToFetch.name;
				RSSTICKER.feedsToFetch.splice(i, 1);

				for (var i = RSSTICKER.toolbar.childNodes.length - 1; i >= 0; i--){
					var item = RSSTICKER.toolbar.childNodes[i];
					
					if (item.nodeName == 'toolbarbutton') {
						if (item.feed == label) {
							RSSTICKER.toolbar.removeChild(item);
						}
					}
				}
				
				return true;
			}
		}
		
		return false;
	},
	
	addTrendingFeed : function () {
		RSSTICKER.feedsToFetch.unshift(
			{
				"name": "Trending News",
				"feed" : RSSTICKER.trendingNewsUrl,
				"livemarkId": -1
			}
		);
		
		RSSTICKER.updateAFeed(0);
	},
	
	removeTrendingFeed : function () {
		for (var i = RSSTICKER.toolbar.childNodes.length - 1; i >= 0; i--){
			var item = RSSTICKER.toolbar.childNodes[i];
			
			if (item.nodeName == 'toolbarbutton') {
				if (item.feedURL == RSSTICKER.trendingNewsUrl) {
					RSSTICKER.toolbar.removeChild(item);
				}
			}
		}
		
		RSSTICKER.feedsToFetch.shift();
		
		RSSTICKER.trendingNewsExpiration = 0;
	},

	updateSingleFeed : function (livemarkId) {
		var feedURL = RSSTICKER.livemarkService.getFeedURI(livemarkId).spec;
		var feedName = RSSTICKER.bookmarkService.getItemTitle(livemarkId);
		
		RSSTICKER.feedsToFetch.push({ name : feedName, feed : feedURL, livemarkId : livemarkId });
	    RSSTICKER.updateAFeed(RSSTICKER.feedsToFetch.length - 1);
	},

	rapidUpdate : 0,
	
	updateAllFeeds : function () {
	    RSSTICKER.rapidUpdate = RSSTICKER.feedsToFetch.length;
	    RSSTICKER.updateAFeed();
	},
	
	stopUpdate : function () {
		RSSTICKER.rapidUpdate = 0;
		RSSTICKER.killCurrentRequest();
	},
	
	killCurrentRequest : function () {
		try { RSSTICKER.currentRequest.abort(); } catch (noCurrentRequest) { }
	},
	
	queueForParsing : function (feedText, feedURL) {
		var data = feedText;
		var uri = RSSTICKER.ioService.newURI(feedURL, null, null);

		if (data.length) {
			var parser = Components.classes["@mozilla.org/feed-processor;1"]
							.createInstance(Components.interfaces.nsIFeedProcessor);
			var listener = new TickerParseListener();

			try {
				parser.listener = listener;
				parser.parseFromString(data, uri);
			} catch (e) {
				throw (e);
			}
		}

		return this;
	},
	
	markAsRead : function (node, dontAdjustSpacer) {
		node.setAttribute("visited", "true");
		
		if (RSSTICKER.hideVisited){
			node.parentNode.removeChild(node);
			
			if (!dontAdjustSpacer) RSSTICKER.adjustSpacerWidth();
			
			RSSTICKER.checkForEmptiness();
		}
		else if (RSSTICKER.boldUnvisited){
			if (!dontAdjustSpacer) RSSTICKER.adjustSpacerWidth();
		}
		
		RSSTICKER.history.addToHistory(node.guid);
	},
	
	onContextOpen : function (node, target) {
		var url = node.href;
		
		if (!target) {
			window._content.document.location.href = url;
		}
		else if (target == 'window'){
			window.open(url);
		}
		else if (target == 'tab') {
			RSSTICKER.browser.openInNewTab(url);
		}
		
		RSSTICKER.markAsRead(node);
	},
	
	writeFeed : function (feed) {
		if (RSSTICKER.disabled) {
			return;
		}
		
		var feedItems = feed.items;
		
		RSSTICKER.internalPause = true;
		
		// Remove items that are no longer in the feed.
		for (var i = RSSTICKER.toolbar.childNodes.length - 1; i >= 0; i--){
			var item = RSSTICKER.toolbar.childNodes[i];
			
			if ((item.nodeName == 'toolbarbutton') && (item.feed == feed.label)){
				var itemFound = false;
				
				var len = feedItems.length;
				
				for (var j = 0; j < len; j++){
					if ((feedItems[j].uri == item.uri) && (feedItems[j].id == item.guid)){
						itemFound = true;
						break;
					}
				}
				
				if (!itemFound){
					RSSTICKER.toolbar.removeChild(item);
				}
			}
		}
		
		var itemsShowing = RSSTICKER.itemsInTicker(feed.label);
		
		var len = feedItems.length;
		
		for (var j = 0; j < len; j++){
			var feedItem = feedItems[j];
			
			if (!document.getElementById("RSSTICKER" + feedItem.uri)){
				if (RSSTICKER.limitItemsPerFeed && (RSSTICKER.itemsPerFeed <= itemsShowing.length)){
					// Determine if this item is newer than the oldest item showing.
					if ((RSSTICKER.itemsPerFeed > 0) && feedItem.published && itemsShowing[0].published && (feedItem.published > itemsShowing[0].published)){
						RSSTICKER.toolbar.removeChild(document.getElementById("RSSTICKER" + itemsShowing[0].href));
						itemsShowing.shift();
					}
					else {
						continue;
					}
				}
				
				var itemIsVisited = RSSTICKER.history.isVisitedURL(feedItem.uri, feedItem.id, 1);
				
				if (itemIsVisited && RSSTICKER.hideVisited) {
					continue;
				}
				
				feedItem.description = feedItem.description.replace(/<[^>]+>/g, "");
				
				if ((feedItem.label == '') && (feedItem.description != '')){
					if (feedItem.description.length > 40){
						feedItem.label = feedItem.description.substr(0,40) + "...";
					}
					else {
						feedItem.label = feedItem.description;
					}
				}
				
				var tbb = document.createElement('toolbarbutton');
				tbb.uri = feedItem.uri;
				tbb.id = "RSSTICKER" + feedItem.uri;
				tbb.description = feedItem.description;
				tbb.feed = feed.label;
				tbb.feedURL = feed.uri;
				tbb.href = feedItem.uri;
				tbb.displayHref = feedItem.displayUri;
				tbb.published = feedItem.published;
				tbb.guid = feedItem.id;
				
				tbb.setAttribute("label", feedItem.label);
				tbb.setAttribute("tooltip", "RSSTICKERTooltip");
				tbb.setAttribute("image", feedItem.image);
				tbb.setAttribute("contextmenu", "RSSTICKERItemCM");
				tbb.setAttribute("onclick", "return RSSTICKER.onTickerItemClick(event, this.uri, this);");
				
				tbb.onclick = function (event) {
					return RSSTICKER.onTickerItemClick(event, this.uri, this);
				};
				
				tbb.setAttribute("visited", itemIsVisited);
				
				if (feedItem.trackingUri) {
					tbb.style.background = 'url('+feedItem.trackingUri+') no-repeat';
				}
				
				// Determine where to add the item
				if (RSSTICKER.randomizeItems){
					if (RSSTICKER.toolbar.childNodes.length == 1){
						// Only the spacer is showing
						RSSTICKER.toolbar.appendChild(tbb);
					}
					else {
						if ((RSSTICKER.toolbar.firstChild.nodeName == 'spacer') && ((RSSTICKER.currentFirstItemMargin * -1) < (RSSTICKER.toolbar.firstChild.nextSibling.boxObject.width))){
							var randomPlace = Math.floor(Math.random() * (RSSTICKER.toolbar.childNodes.length - 1)) + 1;
						}
						else {
							// Add after the 5th one just to avoid some jumpiness
							var randomPlace = Math.floor(Math.random() * (RSSTICKER.toolbar.childNodes.length - 1)) + 6;
						}
						
						if (randomPlace >= RSSTICKER.toolbar.childNodes.length){
							RSSTICKER.toolbar.appendChild(tbb);
						}
						else {
							RSSTICKER.toolbar.insertBefore(tbb, RSSTICKER.toolbar.childNodes[randomPlace]);
						}
					}
				}
				else {
					// Check for another item from this feed, if so place at end of that feed.
					if (itemsShowing.length > 0){
						for (var i = RSSTICKER.toolbar.childNodes.length - 1; i >= 0; i--){
							var node = RSSTICKER.toolbar.childNodes[i];
							
							if (node.nodeName == 'toolbarbutton'){
								if (node.feed == tbb.feed){
									if (i == (RSSTICKER.toolbar.childNodes.length - 1)){
										RSSTICKER.toolbar.appendChild(tbb);
										addedButton = true;
									}
									else {
										RSSTICKER.toolbar.insertBefore(tbb, node.nextSibling);
										addedButton = true;
									}
									
									break;
								}
							}
						}
					}
					else {
						// None of this feed is showing; add after another feed.
						if ((RSSTICKER.toolbar.firstChild.nodeName == 'spacer') || (RSSTICKER.toolbar.lastChild.nodeName == 'spacer')){
							RSSTICKER.toolbar.appendChild(tbb);
						}
						else {
							if (RSSTICKER.toolbar.firstChild.feed != RSSTICKER.toolbar.lastChild.feed){
								// We're in luck - a feed just finished scrolling
								RSSTICKER.toolbar.appendChild(tbb);
							}
							else {
								var addedButton = false;
								
								for (var i = RSSTICKER.toolbar.childNodes.length - 2; i >= 0; i--){
									var node = RSSTICKER.toolbar.childNodes[i];
									
									if (node.nodeName == 'spacer'){
										RSSTICKER.toolbar.insertBefore(tbb, node.nextSibling);
										addedButton = true;
										break;
									}
									else if (node.feed != node.nextSibling.feed){
										RSSTICKER.toolbar.insertBefore(tbb, node.nextSibling);
										addedButton = true;
										break;
									}
								}
								
								if (!addedButton){
									RSSTICKER.toolbar.appendChild(tbb);
								}
							}
						}
					}
				}
				
				itemsShowing.push(tbb);
				
				itemsShowing.sort(RSSTICKER.sortByPubDate);
			}
		}
		
		RSSTICKER.internalPause = false;
		
		RSSTICKER.adjustSpacerWidth();
		RSSTICKER.checkForEmptiness();
		RSSTICKER.tick();
	},
	
	onTickerItemClick : function (event, url, node) {
		if (event.ctrlKey) {
			RSSTICKER.markAsRead(node);
			return false;
		}
		else if (event.which == 3){
			// Discard right-clicks
			return;
		}
		else {
			if (event.which == 4 || event.shiftKey){
				// Shift
				window.open(url);
			}
			else {
				// Left-click
				RSSTICKER.launchUrl(url, event);
				RSSTICKER.markAsRead(node);
			}
		}
	},
	
	launchUrl : function (url, event) {
		if (RSSTICKER.prefs.getBoolPref("alwaysOpenInNewTab") || (event.which == 2) || (event.which == 1 && (event.ctrlKey || event.metaKey) && (event.ctrlKey || event.metaKey))){
			RSSTICKER._addTab(url);
		}
		else if (event.which == 1 || (event.which == 13 && !event.shiftKey)){
			RSSTICKER._inTab(url);
		}
		else if (event.which == 4 || (event.which == 13 && event.shiftKey)){
			window.open(url);
		}
	},
	
	_addTab : function (url) {
		var browser = gBrowser;
		var theTab = browser.addTab(url);
		
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			
		var loadInBackground = false;
			
		try {
			loadInBackground = prefs.getBoolPref("browser.tabs.loadInBackground");
		} catch (e) {
		}
		
		if (!loadInBackground){
			browser.selectedTab = theTab;
		}
	},
	
	_inTab : function (url) {
		content.document.location.href = url;
	},
	
	adjustSpacerWidth : function () {
		if (RSSTICKER.toolbar && !RSSTICKER.disabled){
			var extraPadding;
			
			try {
				if (RSSTICKER.displayWidth.limitWidth){
					extraPadding = RSSTICKER.displayWidth.itemWidth;
				}
				else {
					extraPadding = 250;
				}
				
				var windowWidth = parseInt(RSSTICKER.ticker.boxObject.width);
				
				var tickerWidth = 0;
				
				var len = RSSTICKER.toolbar.childNodes.length;
				
				for (var i = 0; i < len; i++){
					var node = RSSTICKER.toolbar.childNodes[i];
					
					if (node.nodeName == 'toolbarbutton'){
						tickerWidth += node.boxObject.width;
					}
				}
				
				var spacerWidth;
				
				if (parseInt(windowWidth) > parseInt(tickerWidth - extraPadding)) {
					spacerWidth = parseInt(windowWidth) - parseInt(tickerWidth) + parseInt(extraPadding);
				}
				else {
					spacerWidth = 0;
				}
				
				if (spacerWidth < parseInt(RSSTICKER.toolbar.spacer.style.width.replace("px", ""), 10) && RSSTICKER.toolbar.firstChild.nodeName == 'spacer') {
					// Don't shrink the spacer if it's the first item; it makes for a poor UX
					return;
				}
				
				RSSTICKER.toolbar.spacer.style.width = spacerWidth + "px";
			} catch (e) {
				// Tried to adjust spacer when there wasn't one.
				// Could happen depending on when the disable button was pressed
				if (RSSTICKER.DEBUG) RSSTICKER.logMessage(e);
			}
		}
	},
	
	tick : function () {
		if (RSSTICKER.disabled) {
			return;
		}
		
		clearTimeout(RSSTICKER.tickTimer);
		
		if (RSSTICKER.internalPause){
			RSSTICKER.tickTimer = setTimeout(function () { RSSTICKER.tick(); }, RSSTICKER.tickLength);
		}
		else {
			var node, nodeWidth, marginLeft;
			
			if (RSSTICKER.mouseOverFlag){
				if (RSSTICKER.toolbar.childNodes.length > 1){
					if (RSSTICKER.currentFirstItemMargin <= (RSSTICKER.toolbar.firstChild.boxObject.width * -1)){
						node = RSSTICKER.toolbar.firstChild;
						RSSTICKER.toolbar.removeChild(node);
						
						// Add an item to the end of the ticker.
						
						RSSTICKER.currentFirstItemMargin = 0;
						node.style.marginLeft = '0px';
						RSSTICKER.toolbar.appendChild(node);
						
						if (node.nodeName == 'toolbarbutton' && (node.getAttribute("visited") == "false")) {
							if (RSSTICKER.history.isVisitedURL(node.uri, node.guid, 2)){
								RSSTICKER.markAsRead(node);
							}
						}
						else if (node.nodeName == 'spacer') {
							RSSTICKER.adjustSpacerWidth();
						}
					}
					else if (RSSTICKER.currentFirstItemMargin > 0){
						// Move the last child back to the front.
						node = RSSTICKER.toolbar.lastChild;
						nodeWidth = node.boxObject.width;
						RSSTICKER.toolbar.removeChild(node);
						
						// Set the correct margins
						marginLeft = parseInt((0 - nodeWidth) + RSSTICKER.currentFirstItemMargin);
						
						node.style.marginLeft = marginLeft + "px";
						RSSTICKER.currentFirstItemMargin = marginLeft;
						RSSTICKER.toolbar.firstChild.style.marginLeft = 0;
						RSSTICKER.toolbar.insertBefore(node, RSSTICKER.toolbar.firstChild);
					}
				}
				
				RSSTICKER.tickTimer = setTimeout(function () { RSSTICKER.tick(); }, RSSTICKER.tickLength);
			}
			else {
				if (RSSTICKER.toolbar.childNodes.length > 1){
					if (RSSTICKER.currentFirstItemMargin <= (RSSTICKER.toolbar.firstChild.boxObject.width * -1)){
						node = RSSTICKER.toolbar.firstChild;
						RSSTICKER.toolbar.removeChild(node);
						RSSTICKER.currentFirstItemMargin = 0;
						node.style.marginLeft = '0px';
						RSSTICKER.toolbar.appendChild(node);
						
						if (node.nodeName == 'toolbarbutton' && (node.getAttribute("visited") == "false")) {
							if (RSSTICKER.history.isVisitedURL(node.uri, node.guid, 3)){
								RSSTICKER.markAsRead(node);
							}
						}
					}
					else if (RSSTICKER.currentFirstItemMargin > 0){
						// Move the last child back to the front.
						node = RSSTICKER.toolbar.lastChild;
						RSSTICKER.toolbar.removeChild(node);
						
						// Set the correct margins
						nodeWidth = node.boxObject.width;
						marginLeft = parseInt((0 - nodeWidth) + RSSTICKER.currentFirstItemMargin);

						node.style.marginLeft = marginLeft + "px";
						RSSTICKER.currentFirstItemMargin = marginLeft;
						RSSTICKER.toolbar.firstChild.style.marginLeft = 0;
						RSSTICKER.toolbar.insertBefore(node, RSSTICKER.toolbar.firstChild);
					}
					else {
						RSSTICKER.currentFirstItemMargin -= (200 / RSSTICKER.ticksPerItem);
						RSSTICKER.toolbar.firstChild.style.marginLeft = RSSTICKER.currentFirstItemMargin + "px";
					}
				}
				
				RSSTICKER.tickTimer = setTimeout(function () { RSSTICKER.tick(); }, RSSTICKER.tickLength);
			}
		}
	},
	
	markAllAsRead : function (feed) {
		RSSTICKER.internalPause = true;
		
		for (var i = RSSTICKER.toolbar.childNodes.length - 1; i >= 0; i--){
			var node = RSSTICKER.toolbar.childNodes[i];
			
			if (node.nodeName == 'toolbarbutton'){
				if (!feed || (node.feed == feed)){
					RSSTICKER.history.addToHistory(node.guid);
					RSSTICKER.markAsRead(node, true);
				}
			}
		}
		
		RSSTICKER.internalPause = false;
		
		RSSTICKER.adjustSpacerWidth();
	},
	
	openAllInTabs : function (unreadOnly, feed) {
		for (var i = RSSTICKER.toolbar.childNodes.length - 1; i >= 0; i--){
			var node = RSSTICKER.toolbar.childNodes[i];
			
			if (node.nodeName == 'toolbarbutton'){
				if ((!feed || (node.feed == feed)) && (!unreadOnly || (node.getAttribute("visited") == "false"))){
					RSSTICKER.onContextOpen(node, 'tab');
				}
			}
		}
	},
	
	// Each scroll of the mouse should move the ticker items 
	
	scrollTicker : function (event) {
		if (RSSTICKER.mouseOverFlag && !RSSTICKER.internalPause){
			if (RSSTICKER.toolbar.childNodes.length > 1){
				if (event.detail > 0){
					// Scroll Down
					if (RSSTICKER.toolbar.firstChild){
						RSSTICKER.currentFirstItemMargin -= 40;
						RSSTICKER.toolbar.firstChild.style.marginLeft = RSSTICKER.currentFirstItemMargin + "px";
					}
				}
				else if (event.detail < 0){
					// Scroll Up
					if (RSSTICKER.toolbar.firstChild){
						RSSTICKER.currentFirstItemMargin += 40;
						RSSTICKER.toolbar.firstChild.style.marginLeft = RSSTICKER.currentFirstItemMargin + "px";
						
						if (RSSTICKER.currentFirstItemMargin > 0){
							// Move the last child back to the front.
							var node = RSSTICKER.toolbar.lastChild;
							var nodeWidth = node.boxObject.width;
							RSSTICKER.toolbar.removeChild(node);
							
							// Set the correct margins
							var marginLeft = (0 - nodeWidth) + RSSTICKER.currentFirstItemMargin;
							
							node.style.marginLeft = marginLeft + "px";
							RSSTICKER.currentFirstItemMargin = marginLeft;
							RSSTICKER.toolbar.firstChild.style.marginLeft = 0;
							RSSTICKER.toolbar.insertBefore(node, RSSTICKER.toolbar.firstChild);
						}
					}
				}
			}
		}
	},
	
	toggleDisabled : function () {
		RSSTICKER.prefs.setBoolPref("disabled", !RSSTICKER.prefs.getBoolPref("disabled"));
	},
	
	fillInTooltip : function (item, tt){
		var maxLength = 60;
		
		var descr = item.description;
		var title = item.getAttribute("label");
		var url = item.displayHref;
		
		var feedName = item.feed;
		
		if (title.length > maxLength){
			title = title.substring(0,maxLength) + "...";
		}
		
		if (url.length > maxLength){
			url = url.substring(0,maxLength) + "...";
		}
		
		var image = item.getAttribute("image");
		
		tt.removeAttribute("height");
		tt.removeAttribute("width");
		
		document.getElementById("RSSTICKERTooltipImage").src = image;
		
		document.getElementById("RSSTICKERTooltipURL").value = RSSTICKER.strings.getString("URL") + ": " + url;
		
		var maxw = document.getElementById("RSSTICKERTooltipURL").boxObject.width;
		
		document.getElementById("RSSTICKERTooltipFeedName").value = feedName;
		
		maxw = Math.max(maxw, document.getElementById("RSSTICKERTooltipFeedName").boxObject.width);
		
		if (title != ''){
			document.getElementById("RSSTICKERTooltipName").value = title;;
			document.getElementById("RSSTICKERTooltipName").style.display = '';
			
			maxw = Math.max(document.getElementById("RSSTICKERTooltipName").boxObject.width, maxw);
		}
		else {
			document.getElementById("RSSTICKERTooltipName").style.display = 'none';
		}
				
		if (descr != ''){
			var summary = document.getElementById("RSSTICKERTooltipSummary");
			
			while (summary.lastChild) {
				summary.removeChild(summary.lastChild);
			}
			
			if (descr.length > 200){
				descr = descr.substring(0, descr.indexOf(" ",200)) + "...";
			}
			
			var text = document.createTextNode(descr);
			
			summary.appendChild(text);
			document.getElementById("RSSTICKERTooltipSummaryGroupbox").setAttribute("hidden",false);
		}
		else {
			document.getElementById("RSSTICKERTooltipSummaryGroupbox").setAttribute("hidden",true);
		}
  
		return true;
	},
	
	logMessage : function (message) {
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		consoleService.logStringMessage("RSSTICKER: " + message);
	},
	
	theFile : null,
	theDB : null,
	
	getDB : function () {
		if (!RSSTICKER.theFile) {
			RSSTICKER.theFile = Components.classes["@mozilla.org/file/directory_service;1"]
		                     .getService(Components.interfaces.nsIProperties)
		                     .get("ProfD", Components.interfaces.nsIFile);
			RSSTICKER.theFile.append("rssticker.sqlite");
		}
		
		if (!RSSTICKER.theDB) {
			RSSTICKER.theDB = Components.classes["@mozilla.org/storage/service;1"]
		                 .getService(Components.interfaces.mozIStorageService).openDatabase(RSSTICKER.theFile);
		}
		
		return RSSTICKER.theDB;
	},
	
	closeDB : function () {
		RSSTICKER.theDB.close();
		delete RSSTICKER.theDB;
		RSSTICKER.theDB = null;
	},
	
	history : {
		hService : Components.classes["@mozilla.org/browser/global-history;2"].getService(Components.interfaces.nsIGlobalHistory2),
		ioService : Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService),
		
		URI : null,
		
		isVisitedURL : function(url, guid){
			try {
				RSSTICKER.history.URI = this.ioService.newURI(url, null, null);
				var visited = RSSTICKER.history.hService.isVisited(RSSTICKER.history.URI);
				var db = RSSTICKER.getDB();
				
				if (!visited) {
					var select = db.createStatement("SELECT id FROM history WHERE id=?1");
					select.bindStringParameter(0, guid);
					
					try {
						while (select.executeStep()) {
							visited = true;
							break;
						}
					} catch (e) {
						RSSTICKER.logMessage(e);
					} finally {
						select.reset();
					}
					
					select.finalize();
				}
				else {
					// Add to DB
					var insert = db.createStatement("INSERT INTO history (id, date) VALUES (?1, ?2)");
					insert.bindUTF8StringParameter(0, guid);
					insert.bindInt64Parameter(1, (new Date().getTime()));
					try { insert.execute(); } catch (alreadyExists) { }
				}
				
				return visited;
			} catch (e) {
				// Malformed URI, probably
				RSSTICKER.logMessage(e + " " + url);
				return false;
			}
		},
		
		addToHistory : function (guid) {
			var db = RSSTICKER.getDB();
			
			// Add to DB
			var insert = db.createStatement("INSERT INTO history (id, date) VALUES (?1, ?2)");
			insert.bindUTF8StringParameter(0, guid);
			insert.bindInt64Parameter(1, (new Date().getTime()));
			
			try { insert.execute(); } catch (alreadyExists) { }
		},
	},
	
	clipboard : {
		copyString : function (str){
			try {
				var oClipBoard = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
				oClipBoard.copyString(str);
			} catch (e) {
			}
		}
	},
	
	browser : {
		openInNewTab : function(url){
			var browser = window.gBrowser || window.parent.gBrowser;
			
			var theTab = browser.addTab(url);
			
			var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			
			var loadInBackground = false;
			
			try {
				loadInBackground = prefs.getBoolPref("browser.tabs.loadInBackground");
			} catch (e) {
			}
			
			if (!loadInBackground){
				browser.selectedTab = theTab;
			}
		}
	},
	
	observeFeed : function (url) {
		var feeds = RSSTICKER.readIgnoreFile();
		var newFeeds = [];
		
		var foundFeed = false;
		
		var len = feeds.length;
		
		for (var i = 0; i < len; i++){
			var feed = feeds[i];
			
			if (feed == url){
				foundFeed = true;
			}
			else {
				newFeeds.push(feed);
			}
		}
	
		if (foundFeed){
			// Rewrite the ignore file.
			var DIR_SERVICE = new Components.Constructor("@mozilla.org/file/directory_service;1", "nsIProperties");
			var profilePath = (new DIR_SERVICE()).get("ProfD", Components.interfaces.nsIFile).path; 
		
			if (profilePath.search(/\\/) != -1) profilePath += "\\";
			else profilePath += "/";
						
			var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(profilePath + RSSTICKER.ignoreFilename);

			var outputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance( Components.interfaces.nsIFileOutputStream );

			outputStream.init(file, 0x02 | 0x08 | 0x20, 0600, null);
		
			var data = "";
			
			var len = newFeeds.length;
			
			for (var i = 0; i < len; i++){
				data += newFeeds[i] + "\r\n";
			}
			
			RSSTICKER.writeBytes(outputStream, data);
			
			outputStream.close();
		}
	},

	writeBytes : function (outputStream, data) {
		var bytes, bytesWritten, bytesRemaining = data.length;
		var offset = 0;
		
		while (bytesRemaining) {
			bytesWritten = outputStream.write(data.substring(offset), bytesRemaining);
			bytesRemaining -= bytesWritten;
			offset += bytesWritten;
		}
	},
	
	ignoreFeed : function (url) {
		var feeds = RSSTICKER.readIgnoreFile();
		var foundFeed = false;
		
		var len = feeds.length;
		
		for (var i = 0; i < len; i++){
			if (feeds[i] == url){
				foundFeed = true;
				break;
			}
		}
		
		if (!foundFeed){
			var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(RSSTICKER.getProfilePath() + RSSTICKER.ignoreFilename);

			var outputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance( Components.interfaces.nsIFileOutputStream );
			outputStream.init(file, 0x02 | 0x08 | 0x10, 0600, null);
		
			var data = url + "\r\n";
			
			RSSTICKER.writeBytes(outputStream, data);
			
			outputStream.close();
		}
	},
	
	readIgnoreFile : function () {
		var file, inputStream, lineStream, stillInFile, parts;
		var feeds = [];
		var line = { value: "" };
		
		file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		
		file.initWithPath(RSSTICKER.getProfilePath() + RSSTICKER.ignoreFilename);
		
		if (!file.exists()) {
			// File doesn't exist yet
			return [];
		}

		inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
		inputStream.init(file, 0x01, 0600, null);
		
		lineStream = inputStream.QueryInterface(Components.interfaces.nsILineInputStream);
		
		do {
			stillInFile = lineStream.readLine(line);
			
			if (line.value == "") {
				continue;
			}
			else {
				feeds.push(line.value);
			}
		} while (stillInFile);
		
		lineStream.close();
		inputStream.close();
		
		return feeds;
	},
	
	getProfilePath : function () {
		if (!RSSTICKER.profilePath){
			var DIR_SERVICE = new Components.Constructor("@mozilla.org/file/directory_service;1", "nsIProperties");
			RSSTICKER.profilePath = (new DIR_SERVICE()).get("ProfD", Components.interfaces.nsIFile).path; 
		
			if (RSSTICKER.profilePath.search(/\\/) != -1) RSSTICKER.profilePath += "\\";
			else RSSTICKER.profilePath += "/";
		}
		
		return RSSTICKER.profilePath;
	},
	
	inArray : function (arr, needle){
		var i;
		var len = arr.length;
		
		for (i = 0; i < len; i++){
			if (arr[i] == needle){
				return true;
			}
		}
		
		return false;
	},
	
	itemsInTicker : function (feed) {
		var items = [];
		var ip = RSSTICKER.internalPause;
		
		RSSTICKER.internalPause = true;
		
		for (var i = RSSTICKER.toolbar.childNodes.length - 1; i >= 0; i--){
			var tbb = RSSTICKER.toolbar.childNodes[i];
			
			if (tbb.nodeName != "spacer" && tbb.feed == feed){
				if (RSSTICKER.limitItemsPerFeed && (items.length == RSSTICKER.itemsPerFeed)){
					RSSTICKER.toolbar.removeChild(tbb);
				}
				else {
					items.push(tbb);
				}
			}
		}
		
		// Sort the array by time
		
		items.sort(RSSTICKER.sortByPubDate);
		
		RSSTICKER.internalPause = ip;
		
		RSSTICKER.checkForEmptiness();
		
		return items;
	},
	
	checkForEmptiness : function(){
		if (RSSTICKER.toolbar) {
			if ((RSSTICKER.toolbar.childNodes.length <= 1) && (RSSTICKER.hideWhenEmpty)){
				RSSTICKER.ticker.style.display = 'none';
				RSSTICKER.toolbar.firstChild.style.marginLeft = '0px';
				RSSTICKER.currentFirstItemMargin = 0;
				RSSTICKER.mouseOverFlag = false;
			}
			else {
				RSSTICKER.ticker.style.display = '';
				
				if (RSSTICKER.toolbar.childNodes.length <= 1){
					document.getElementById("rss-ticker_cmd_openAllInTabs").setAttribute("disabled","true");
					document.getElementById("rss-ticker_cmd_openUnreadInTabs").setAttribute("disabled","true");
					document.getElementById("rss-ticker_cmd_markAllAsRead").setAttribute("disabled","true");
				}
				else {
					document.getElementById("rss-ticker_cmd_openAllInTabs").removeAttribute("disabled","true");
					document.getElementById("rss-ticker_cmd_openUnreadInTabs").removeAttribute("disabled","true");
					document.getElementById("rss-ticker_cmd_markAllAsRead").removeAttribute("disabled","true");
				}
			}
		}
	},
	
	sortByPubDate : function (a, b){
		var atime, btime;

		if (a.published){
			atime = a.published;
		}

		if (b.published){
			btime = b.published;
		}

		if (!atime && !btime){
			return 0;
		}
		else if (!btime){
			return 1;
		}
		else if (!atime){
			return -1;
		}
		else {
			return atime - btime;
		}
	}
};