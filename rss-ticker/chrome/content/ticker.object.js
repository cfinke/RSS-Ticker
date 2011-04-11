var RSSTICKER = {
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
	
	// Current width of the first feed item (the one that is being shrunk)
	currentFirstItemMargin : 0,
	
	tickLength : 0,
	
	rtl : false,
	
	onload : function () {
		removeEventListener("load", RSSTICKER.onload, false);
		
		addEventListener("unload", RSSTICKER.unload, false);

		if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Loading prefs.");
	
		RSSTICKER.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.rssticker.");
		RSSTICKER.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		RSSTICKER.prefs.addObserver("", RSSTICKER, false);
	
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
		
		var db = RSSTICKER.getDB();
		
		if (!db.tableExists("history")) {
			db.executeSimpleSQL("CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, date INTEGER)");
		}
		
		document.getElementById("RSSTICKERItemCM").addEventListener("popupshowing", RSSTICKER.customizeContextMenus, false);
		document.getElementById("RSSTICKERCM").addEventListener("popupshowing", RSSTICKER.customizeContextMenus, false);
		document.getElementById("RSSTICKERButtonCM").addEventListener("popupshowing", RSSTICKER.customizeContextMenus, false);
		
		RSSTICKER.rtl = RSSTICKER.prefs.getBoolPref("rtl");
		
		RSSTICKER.ticker = document.createElement('toolbar');
		RSSTICKER.ticker.setAttribute("id", "RSSTICKERToolbar");
		RSSTICKER.ticker.setAttribute("class", "chromeclass-toolbar");
		RSSTICKER.ticker.setAttribute("hidden", false);
		RSSTICKER.ticker.setAttribute("iconsize", "small");
		RSSTICKER.ticker.setAttribute("inherits", "collapsed,hidden");
		RSSTICKER.ticker.setAttribute("mode", "full");
		RSSTICKER.ticker.setAttribute("persist", "collapsed,hidden");
		RSSTICKER.ticker.setAttribute("toolbarname", RSSTICKER_UTIL.strings.getString("extension.name"));
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
		
		if (RSSTICKER.prefs.getBoolPref("disabled")){
			RSSTICKER.disable();
			return;
		}
		else {
			RSSTICKER.enable(5000);
		}
		
		RSSTICKER.showFirstRun();
		
		if (!RSSTICKER.prefs.getBoolPref("subscribeIconCheck")) {
			RSSTICKER.prefs.setBoolPref("subscribeIconCheck", true);
			
			RSSTICKER.addToolbarButton("feed-button");
		}
	},
	
	addToolbarButton : function (buttonId) {
		// Add the subscribe toolbar button, as Firefox 4 removes it.

		if (!document.getElementById(buttonId)){
			// Determine which toolbar to place the icon onto
			if (document.getElementById("nav-bar").getAttribute("collapsed") != "true"){
				var toolbar = document.getElementById("nav-bar");
			}
			else {
				var toolbar = document.getElementById("toolbar-menubar");
			}

			var currentSet = toolbar.currentSet;
			var newSet = currentSet;
			var setItems = currentSet.split(',');

			var toolbox = document.getElementById("navigator-toolbox");
			var toolboxDocument = toolbox.ownerDocument;

			function getIndex(array, val){
				for (var i = 0; i < array.length; i++){
					if (array[i] == val) {
						return i;
					}
				}

				return -1;
			}

			// Order of adding:
				// before urlbar-container
				// after home-button
				// after reload-button
				// after stop-button
				// after forward-button
				// before search-container
				// at the end

			if (getIndex(setItems, "urlbar-container") != -1){
				newSet = currentSet.replace("urlbar-container","urlbar-container,"+buttonId);
			}
			else if (getIndex(setItems, "search-container") != -1){
				newSet = currentSet.replace("search-container",buttonId+",search-container");
			}
			else if (getIndex(setItems, "home-button") != -1){
				newSet = currentSet.replace("home-button","home-button,"+buttonId);
			}
			else if (getIndex(setItems, "reload-button") != -1){
				newSet = currentSet.replace("reload-button","reload-button,"+buttonId);
			}
			else if (getIndex(setItems, "stop-button") != -1){
				newSet = currentSet.replace("stop-button","stop-button,"+buttonId);
			}
			else if (getIndex(setItems, "forward-button") != -1){
				newSet = currentSet.replace("forward-button","forward-button,"+buttonId);
			}
			else {
				newSet = toolbar.currentSet + ","+buttonId;
			}

			toolbar.currentSet = newSet;
			toolbar.setAttribute("currentset",newSet);

			toolboxDocument.persist(toolbar.id, "currentset");

			try {
				BrowserToolboxCustomizeDone(true);
			} catch (e) { }
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
				// Not showing firstrun on updates for now.
				return false;
				
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
		
		switch (data) {
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
				
				var u = RSSTICKER_UTIL.ioService.newURI(data, null, null);
				
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
			case "rtl":
				RSSTICKER.rtl = RSSTICKER.prefs.getBoolPref("rtl");
			break;
		}
		
		if (data.indexOf("cm.") === 0) {
			RSSTICKER.customizeContextMenus();
		}
		
		RSSTICKER.checkForEmptiness();
	},
	
	attachTicker : function () {
		if (RSSTICKER.ticker.parentNode) {
			RSSTICKER.ticker.parentNode.removeChild(RSSTICKER.ticker);
		}
		
		var tickerPlacement = RSSTICKER.prefs.getIntPref("tickerPlacement");
		
		if (tickerPlacement == 1){
			// Beneath the status bar
			document.getElementById('browser-bottombox').appendChild(RSSTICKER.ticker);
			if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Placed after status bar.");
		}
		else if (tickerPlacement == 2){
			// Up by the Bookmarks Toolbar
			document.getElementById('navigator-toolbox').appendChild(RSSTICKER.ticker);
			if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Placed in navigator toolbox.");
		}
	},
	
	enable : function (deferLength) {
		addEventListener("resize", RSSTICKER.adjustSpacerWidth, false);
		addEventListener("DOMMouseScroll", RSSTICKER.scrollTicker, false)
		
		RSSTICKER.disabled = false;
		
		if (document.getElementById("RSSTICKER-button")){
			document.getElementById("RSSTICKER-button").setAttribute("greyed","false");
		}
		
		RSSTICKER.attachTicker();
		RSSTICKER.adjustSpacerWidth();
		
		if (deferLength) {
			RSSTICKER.setTimeout(RSSTICKER.startFetchingFeeds, deferLength);
		}
		else {
			RSSTICKER.startFetchingFeeds();
		}
	},
	
	disable : function () {
		removeEventListener("resize", RSSTICKER.adjustSpacerWidth, false);
		removeEventListener("DOMMouseScroll", RSSTICKER.scrollTicker, false)
		
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
	
	customizeContextMenus : function () {
		document.getElementById("RSSTICKERItemCM").removeEventListener("popupshowing", RSSTICKER.customizeContextMenus, false);
		document.getElementById("RSSTICKERCM").removeEventListener("popupshowing", RSSTICKER.customizeContextMenus, false);
		document.getElementById("RSSTICKERButtonCM").removeEventListener("popupshowing", RSSTICKER.customizeContextMenus, false);
		
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
				if (!RSSTICKER.prefs.getBoolPref("cm." + option.getAttribute("option"))){
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
		removeEventListener("unload", RSSTICKER.unload, false);
		
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
						tbb.description = RSSTICKER_UTIL.strings.getString("rssticker.featured.description");
						tbb.feed = RSSTICKER_UTIL.strings.getString("rssticker.specialItem.feedName");
						tbb.feedURL = "rssticker";
						tbb.href = "chrome://rss-ticker/content/options.xul";
						tbb.displayHref = RSSTICKER_UTIL.strings.getString("rssticker.specialItem.displayHref");
						tbb.published = "";
						tbb.guid = "RSSTICKER-feature-feeds-subscribe";
						
						tbb.setAttribute("label", RSSTICKER_UTIL.strings.getString("rssticker.featured.label"));
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
		RSSTICKER.clearTimeout(RSSTICKER.feedUpdateTimeout);
		
		RSSTICKER.feedsToFetch = [];
		RSSTICKER.feedIndex = 0;
	},
	
	startFetchingFeeds : function () {
		// RSSTICKER.showFeaturedFeeds();
		
		if (RSSTICKER.DEBUG) RSSTICKER.logMessage("Updating feeds " + new Date().toString());
		
		if (RSSTICKER.disabled) {
			return;
		}
		
		RSSTICKER.internalPause = true;
		
		for (var i = RSSTICKER.toolbar.childNodes.length - 1; i >= 0; i--){
			var node = RSSTICKER.toolbar.childNodes[i];
			
			if (node.nodeName == 'toolbarbutton'){
				if (RSSTICKER_UTIL.isFeedIgnored(node.feedURL)) {
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
			
			var feedURL = RSSTICKER_UTIL.livemarkService.getFeedURI(livemarkId).spec;
			
			var feedName = RSSTICKER_UTIL.bookmarkService.getItemTitle(livemarkId);
		
			if (!RSSTICKER_UTIL.isFeedIgnored(feedURL)){
				RSSTICKER.feedsToFetch.push({ name : feedName, feed : feedURL, livemarkId : livemarkId });
			}
		}
		
		if (RSSTICKER.feedsToFetch.length == 0) {
		    RSSTICKER.setTimeout(RSSTICKER.notifyNoFeeds, 3000);
		}
		
		RSSTICKER.setTimeout(RSSTICKER.setReloadInterval, 5000, RSSTICKER.prefs.getIntPref("updateFrequency"));
    },
	
	notifyNoFeeds : function () {
		var showWindow = !RSSTICKER.prefs.getBoolPref("noFeedsFoundFlag.1.7");
		
		if (showWindow){
			var url = "chrome://rss-ticker/content/noFeedsFound.xul";
			var browser = gBrowser;
			var theTab = browser.addTab(url);
			browser.selectedTab = theTab;
		}
	},
	
	setReloadInterval : function (minutes) {
    	RSSTICKER.clearTimeout(RSSTICKER.feedUpdateTimeout);
    	
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
            
		    RSSTICKER.feedUpdateTimeout = RSSTICKER.setTimeout(RSSTICKER.updateAFeed, interval * 1000);
	    }
		
        RSSTICKER.clearTimeout(RSSTICKER.feedUpdateTimeout);
		
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
	
		RSSTICKER.currentRequest = req;
		
		/* START FEED FETCH HERE */
	
		try {
			req.open("GET", url, true);
			req.overrideMimeType('text/plain; charset=x-user-defined');
			
			req.onreadystatechange = function (event) {
				if (req.readyState == 4) {
					RSSTICKER.clearTimeout(RSSTICKER.loadTimer);
				
					RSSTICKER.currentRequest = null;
					setTimeoutForNext();
					
					try {
						if (req.status == 200){
							try {
								var data = req.responseText;
								
								var encoding_matches = data.match(/<?xml[^>]+encoding=['"]([^"']+)["']/i); //"
								
								if (!encoding_matches) {
									encoding_matches = [null, "UTF-8"];
								}
								
								var converter = Components.classes['@mozilla.org/intl/scriptableunicodeconverter'].getService(Components.interfaces.nsIScriptableUnicodeConverter);
								
								try {
									converter.charset = encoding_matches[1];
									data = converter.ConvertToUnicode(data);
								} catch (e) {
									RSSTICKER.logMessage(e);
								}
								
								RSSTICKER.queueForParsing(data.replace(/^\s\s*/, '').replace(/\s\s*$/, ''), url);
							} catch (e) {
								// Parse error
								RSSTICKER.logMessage(e);
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
			
			RSSTICKER.loadTimer = RSSTICKER.setTimeout(RSSTICKER.killCurrentRequest, 1000 * 15);
		}
		catch (e) {
			setTimeoutForNext();
		}
		
		RSSTICKER.checkForEmptiness();
		RSSTICKER.tick();
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
	
	updateSingleFeed : function (livemarkId) {
		var feedURL = RSSTICKER_UTIL.livemarkService.getFeedURI(livemarkId).spec;
		var feedName = RSSTICKER_UTIL.bookmarkService.getItemTitle(livemarkId);
		
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
		
		var uri = RSSTICKER_UTIL.ioService.newURI(feedURL, null, null);

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
		
		RSSTICKER.clearTimeout(RSSTICKER.tickTimer);
		
		if (RSSTICKER.internalPause){
			RSSTICKER.tickTimer = RSSTICKER.setTimeout(RSSTICKER.tick, RSSTICKER.tickLength);
		}
		else {
			var node, nodeWidth, marginLeft;
			
			if (RSSTICKER.toolbar.childNodes.length > 1){
				if (RSSTICKER.rtl) {
					if (RSSTICKER.currentFirstItemMargin >= 0) {
						node = RSSTICKER.toolbar.lastChild;
						nodeWidth = node.boxObject.width;

						RSSTICKER.toolbar.removeChild(node);

						marginLeft = parseInt((0 - nodeWidth) + RSSTICKER.currentFirstItemMargin);

						node.style.marginLeft = marginLeft + "px";
						RSSTICKER.currentFirstItemMargin = marginLeft;

						RSSTICKER.toolbar.firstChild.marginLeft = "0px";
						RSSTICKER.toolbar.insertBefore(node, RSSTICKER.toolbar.firstChild);

						if (node.nodeName == 'toolbarbutton' && (node.getAttribute("visited") == "false")) {
							if (RSSTICKER.history.isVisitedURL(node.uri, node.guid, 3)){
								RSSTICKER.markAsRead(node);
							}
						}
						else if (RSSTICKER.mouseOverFlag && node.nodeName == 'spacer') {
							RSSTICKER.adjustSpacerWidth();
						}
					}
					else if (RSSTICKER.currentFirstItemMargin < (RSSTICKER.toolbar.firstChild.boxObject.width * -1)) {
						var difference = RSSTICKER.currentFirstItemMargin - (RSSTICKER.toolbar.firstChild.boxObject.width * -1);

						// Move the first child to the end
						node = RSSTICKER.toolbar.firstChild;
						RSSTICKER.toolbar.removeChild(node);

						node.style.marginLeft = "0px";
						RSSTICKER.toolbar.appendChild(node);
						RSSTICKER.currentFirstItemMargin = difference;
						RSSTICKER.toolbar.firstChild.style.marginLeft = difference + "px";
					}
					else if (!RSSTICKER.mouseOverFlag) {
						RSSTICKER.currentFirstItemMargin += (200 / RSSTICKER.ticksPerItem);
						RSSTICKER.toolbar.firstChild.style.marginLeft = RSSTICKER.currentFirstItemMargin + "px";
					}
				}
				else {
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
						else if (RSSTICKER.mouseOverFlag) {
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
					else if (!RSSTICKER.mouseOverFlag) {
						RSSTICKER.currentFirstItemMargin -= (200 / RSSTICKER.ticksPerItem);
						RSSTICKER.toolbar.firstChild.style.marginLeft = RSSTICKER.currentFirstItemMargin + "px";
					}
				}
			}
			
			RSSTICKER.tickTimer = RSSTICKER.setTimeout(RSSTICKER.tick, RSSTICKER.tickLength);
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
						if (RSSTICKER.rtl) {
							RSSTICKER.currentFirstItemMargin += 40;
						}
						else {
							RSSTICKER.currentFirstItemMargin -= 40;
						}
						
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
				else if (event.detail < 0){
					// Scroll Up
					if (RSSTICKER.toolbar.firstChild){
						if (RSSTICKER.rtl) {
							RSSTICKER.currentFirstItemMargin -= 40;
						}
						else {
							RSSTICKER.currentFirstItemMargin += 40;
						}

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
		
		document.getElementById("RSSTICKERTooltipURL").value = RSSTICKER_UTIL.strings.getString("URL") + ": " + url;
		
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
		_hService : null,
		get hService() { if (!RSSTICKER.history._hService) { RSSTICKER.history._hService = Components.classes["@mozilla.org/browser/global-history;2"].getService(Components.interfaces.nsIGlobalHistory2); } return RSSTICKER.history._hService; },
		
		URI : null,
		
		isVisitedURL : function(url, guid){
			try {
				RSSTICKER.history.URI = RSSTICKER_UTIL.ioService.newURI(url, null, null);
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
				
				if (RSSTICKER.rtl) {
					RSSTICKER.toolbar.lastChild.style.marginRight = '0px';
				}
				else {
					RSSTICKER.toolbar.firstChild.style.marginLeft = '0px';
				}
				
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
	},
	
	setTimeout : function (callback, timeout, arg1, arg2, arg3, arg4) {
		var cb = {
			notify : function (timer) {
				callback(arg1, arg2, arg3, arg4);
			}
		};
		
		var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
		timer.initWithCallback(cb, timeout, timer.TYPE_ONE_SHOT);
		return timer;
	},
	
	clearTimeout : function (timer) {
		if (timer) {
			timer.cancel();
		}
	}
};