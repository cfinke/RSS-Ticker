var RSSTICKER = {
	livemarkService : Components.classes["@mozilla.org/browser/livemark-service;2"].getService(Components.interfaces.nsILivemarkService),
	bookmarkService : Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Components.interfaces.nsINavBookmarksService),
	ioService : Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService),
	
	
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
		this.loadPrefs();
		
		var db = this.getDB();
		
		if (!db.tableExists("history")) {
			db.executeSimpleSQL("CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, date INTEGER)");
		}
		
		this.strings = document.getElementById("RSSTICKER-bundle");
		this.customizeContextMenus();
		
		this.ticker = this.ce('toolbar');
		this.ticker.setAttribute("id","RSSTICKER" + this.strings.getString("toolbar"));
		this.ticker.setAttribute("class","chromeclass-toolbar");
		this.ticker.setAttribute("hidden",false);
		this.ticker.setAttribute("iconsize","small");
		this.ticker.setAttribute("inherits","collapsed,hidden");
		this.ticker.setAttribute("mode","full");
		this.ticker.setAttribute("persist","collapsed,hidden");
		this.ticker.setAttribute("toolbarname",this.strings.getString("extension.name"));
		this.ticker.style.maxHeight = '24px';
	
		this.toolbar = this.ce('hbox');
		this.toolbar.spacer = this.ce('spacer');
		this.toolbar.appendChild(this.toolbar.spacer);
		this.toolbar.style.maxHeight = '24px';
	
		this.ticker.setAttribute("contextmenu","RSSTICKERCM");
	
		this.ticker.setAttribute("onmouseover","RSSTICKER.mouseOverFlag = true;");
		this.ticker.setAttribute("onmouseout","RSSTICKER.mouseOverFlag = false;");

		document.getElementById("RSSTICKERItemCM").setAttribute("onmouseover","RSSTICKER.mouseOverFlag = true;");
		document.getElementById("RSSTICKERItemCM").setAttribute("onmouseout","RSSTICKER.mouseOverFlag = false;");
	
		this.ticker.appendChild(this.toolbar);
		
		this.loadingNoticeParent = this.ce('toolbaritem');
		this.loadingNoticeParent.setAttribute("tooltip","RSSTICKERLoadingNoticeTooltip");
		this.loadingNoticeParent.id = "RSSTICKER-throbber-box";
		this.loadingNoticeParent.setAttribute("title","RSS Ticker Activity Indicator");
		this.loadingNoticeParent.setAttribute("align","center");
		this.loadingNoticeParent.setAttribute("pack","center");
	
		this.loadingNotice = this.ce('image');
		this.loadingNotice.setAttribute("src","chrome://rss-ticker/content/skin-common/throbber.gif");
		this.loadingNotice.id = "RSSTICKER-throbber";
		this.loadingNotice.setAttribute("busy","false");
		this.loadingNotice.style.marginRight = '4px';
		this.loadingNoticeParent.appendChild(this.loadingNotice);
	
		try {
			document.getElementById("nav-bar").appendChild(this.loadingNoticeParent);
		} catch (e) {
			if (this.DEBUG) this.logMessage(e);
		}
		
		if (this.prefs.getBoolPref("disabled")){
			this.disable();
			return;
		}
		else {
			this.enable();
		}
		
		setTimeout(function () { RSSTICKER.showFirstRun(); }, 1500);
	},
	
	showFirstRun : function () {
	    var version = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID("{1f91cde0-c040-11da-a94d-0800200c9a66}").version;

		if (RSSTICKER.prefs.getCharPref("lastVersion") != version) {
			RSSTICKER.prefs.setCharPref("lastVersion",version);
			var theTab = gBrowser.addTab("http://www.chrisfinke.com/firstrun/rss-ticker.php");
			gBrowser.selectedTab = theTab;
		}
		
		// Ask if they want the trending terms feed.
		
		if (!this.prefs.getBoolPref("trendRequest")) {
            this.prefs.setBoolPref("trendRequest", true);
            
		    setTimeout(
		        function () {
					window.openDialog("chrome://rss-ticker/content/one-riot-suggestion.xul", "trends", "chrome,dialog,centerscreen,titlebar,alwaysraised,modal");
                }, 5000
			);
        }
	},
		
	observe: function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "disabled":
				if (this.prefs.getBoolPref("disabled")) {
					this.disable();
				}
				else {
					this.enable();
				}
			break;
			case "hideWhenEmpty":
				this.hideWhenEmpty = this.prefs.getBoolPref("hideWhenEmpty");
			break;
			case "tickerPlacement":
				this.attachTicker();
			break;
			case "randomizeItems":
				this.randomizeItems = this.prefs.getBoolPref("randomizeItems");
			break;
			case "limitItemsPerFeed":
				this.limitItemsPerFeed = this.prefs.getBoolPref("limitItemsPerFeed");
			break;
			case "itemsPerFeed":
				if (this.prefs.getIntPref("itemsPerFeed") < 0) {
					this.prefs.setIntPref("itemsPerFeed", 0);
				}
				else {
					this.limitItemsPerFeed = this.prefs.getIntPref("itemsPerFeed");
				}
			break;
			case "alwaysOpenInNewTab":
				this.alwaysOpenInNewTab = this.prefs.getBooPref("alwaysOpenInNewTab");
			break;
			case "tickSpeed":
				this.tickLength = this.prefs.getIntPref("tickSpeed") * (500 / this.ticksPerItem);
			break;
			case "updateFrequency":
				RSSTICKER.setReloadInterval(this.prefs.getIntPref("updateFrequency"));
			break;
			case "ticksPerItem":
				this.ticksPerItem = this.prefs.getIntPref("ticksPerItem");
				this.tickLength = this.prefs.getIntPref("tickSpeed") * (500 / this.ticksPerItem);
			break;
			case "dw.limitWidth":
				this.displayWidth.limitWidth = this.prefs.getBoolPref("dw.limitWidth");
			break;
			case "dw.isMaxWidth":
				this.displayWidth.isMaxWidth = this.prefs.getBoolPref("dw.isMaxWidth");
			break;
			case "smoothness":
				if (this.prefs.getIntPref("smoothness") <= 0) {
					this.prefs.setIntPref("smoothness", 1);
				}
			break;
			case "updateToggle":
				this.updateAllFeeds();
			break;
		}
		
		this.customizeContextMenus();
		this.checkForEmptiness();
	},
	
	attachTicker : function () {
		if (this.ticker.parentNode) {
			this.ticker.parentNode.removeChild(this.ticker);
		}
		
		var tickerPlacement = this.prefs.getIntPref("tickerPlacement");
		
		if (tickerPlacement == 1){
			// Beneath the status bar
			document.getElementById('browser-bottombox').insertBefore(this.ticker, document.getElementById('status-bar').nextSibling);
			if (this.DEBUG) this.logMessage("Placed after status bar.");
		}
		else if (tickerPlacement == 2){
			// Up by the Bookmarks Toolbar
			document.getElementById('navigator-toolbox').appendChild(this.ticker);
			if (this.DEBUG) this.logMessage("Placed in navigator toolbox.");
		}
	},
	
	enable : function () {
		this.disabled = false;
		
		if (document.getElementById("RSSTICKER-button")){
			document.getElementById("RSSTICKER-button").setAttribute("greyed","false");
		}
		
		this.attachTicker();
		this.startFetchingFeeds();
	},
	
	disable : function () {
		if (this.DEBUG) this.logMessage("Ticker disabled.");
		
		this.disabled = true;
		
		if (this.ticker.parentNode){
			this.ticker.parentNode.removeChild(this.ticker);
		}
		
		while (this.toolbar.childNodes.length > 0){
			this.toolbar.removeChild(this.toolbar.lastChild);
		}
		
		this.toolbar.appendChild(this.toolbar.spacer);
		
		if (document.getElementById("RSSTICKER-button")) {
			document.getElementById("RSSTICKER-button").setAttribute("greyed","true");
		}
		
		this.prefs.setIntPref("lastUpdate", 0);
		this.stopFetchingFeeds();
	},
	
	loadingNoticeTimeout : null,
	
	addLoadingNotice : function (message) {
		clearTimeout(RSSTICKER.loadingNoticeTimeout);
		
		if (!message || this.disabled) {
			this.loadingNotice.setAttribute("busy", "false");
		}
		else {
			if (this.DEBUG) this.logMessage("Setting loading notice.");
			
			var text = document.createTextNode(message);
			
			while (document.getElementById("RSSTICKERLoadingNoticeText").childNodes.length > 0){
				document.getElementById("RSSTICKERLoadingNoticeText").removeChild(document.getElementById("RSSTICKERLoadingNoticeText").lastChild);
			}
			
			document.getElementById("RSSTICKERLoadingNoticeText").appendChild(text);
			
			this.loadingNotice.setAttribute("busy", "true");
		}
		
		RSSTICKER.loadingNoticeTimeout = setTimeout(function () { RSSTICKER.addLoadingNotice(); }, 5000);
	},
	
	loadPrefs : function () {
		if (this.DEBUG) this.logMessage("Loading prefs.");
	
		this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.rssticker.");
		this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.prefs.addObserver("", this, false);
	
		this.disabled = this.prefs.getBoolPref("disabled");
		this.hideWhenEmpty = this.prefs.getBoolPref("hideWhenEmpty");
		this.randomizeItems = this.prefs.getBoolPref("randomizeItems");
		this.ticksPerItem = this.prefs.getIntPref("ticksPerItem");
		this.displayWidth.itemWidth = this.prefs.getIntPref("dw.itemWidth");
		this.limitItemsPerFeed = this.prefs.getBoolPref("limitItemsPerFeed");
		this.itemsPerFeed = this.prefs.getIntPref("itemsPerFeed");
		this.boldUnvisited = this.prefs.getBoolPref("boldUnvisited");
		this.hideVisited = this.prefs.getBoolPref("hideVisited");
		this.alwaysOpenInNewTab = this.prefs.getBoolPref("alwaysOpenInNewTab");
		this.displayWidth.limitWidth = this.prefs.getBoolPref("dw.limitWidth");
		this.displayWidth.isMaxWidth = this.prefs.getBoolPref("dw.isMaxWidth");
		
		this.tickLength = this.prefs.getIntPref("tickSpeed") * (500 / this.prefs.getIntPref("ticksPerItem"));
	},
	
	customizeContextMenus : function () {
		this.cmOptions.open = this.prefs.getBoolPref("cm.open");
		this.cmOptions.openInTab = this.prefs.getBoolPref("cm.openInTab");
		this.cmOptions.openInWindow = this.prefs.getBoolPref("cm.openInWindow");
		this.cmOptions.openAllInTabs = this.prefs.getBoolPref("cm.openAllInTabs");
		this.cmOptions.openUnreadInTabs = this.prefs.getBoolPref("cm.openUnreadInTabs");
		this.cmOptions.openFeedInTabs = this.prefs.getBoolPref("cm.openFeedInTabs");
		this.cmOptions.openFeedUnreadInTabs = this.prefs.getBoolPref("cm.openFeedUnreadInTabs");
		this.cmOptions.copyLinkTitle = this.prefs.getBoolPref("cm.copyLinkTitle");
		this.cmOptions.copyLinkURL = this.prefs.getBoolPref("cm.copyLinkURL");
		this.cmOptions.refreshFeeds = this.prefs.getBoolPref("cm.refreshFeeds");
		this.cmOptions.manageFeeds = this.prefs.getBoolPref("cm.manageFeeds");
		this.cmOptions.markAsRead = this.prefs.getBoolPref("cm.markAsRead");
		this.cmOptions.markFeedAsRead = this.prefs.getBoolPref("cm.markFeedAsRead");
		this.cmOptions.markAllAsRead = this.prefs.getBoolPref("cm.markAllAsRead");
		this.cmOptions.options = this.prefs.getBoolPref("cm.options");
		this.cmOptions.disableTicker = this.prefs.getBoolPref("cm.disableTicker");
			
		this.customizeContextMenu("RSSTICKERItemCM");
		this.customizeContextMenu("RSSTICKERCM");
		this.customizeContextMenu("RSSTICKERButtonCM");
	},
	
	customizeContextMenu : function(menuID){
		var menu = document.getElementById(menuID);
		var separator = null;
		var firstOption = false;
		
		for (var i = 0; i < menu.childNodes.length; i++){
			var option = menu.childNodes[i];
			
			if (option.nodeName == 'menuitem'){
				if (eval("RSSTICKER.cmOptions." + option.getAttribute("option") + " == false")){
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
		this.prefs.setIntPref("lastUpdate", 0);
	},
	
	feedsToFetch : [],
	feedIndex : 0,
	feedUpdateTimeout : null,
	secondsBetweenFeeds : 0,
	
	stopFetchingFeeds : function () {
		clearTimeout(RSSTICKER.feedUpdateTimeout);
		
		this.feedsToFetch = [];
		this.feedIndex = 0;
	},
	
	startFetchingFeeds : function () {
		if (this.DEBUG) this.logMessage("Updating feeds " + new Date().toString());
		
		if (this.disabled) {
			return;
		}
		
		var ignore = this.readIgnoreFile();

		this.internalPause = true;

		for (var i = this.toolbar.childNodes.length - 1; i >= 0; i--){
			if (this.toolbar.childNodes[i].nodeName == 'toolbarbutton'){
				if (this.inArray(ignore, this.toolbar.childNodes[i].feedURL)){
					this.toolbar.removeChild(this.toolbar.childNodes[i]);
				}
			}
		}

		this.checkForEmptiness();

		this.internalPause = false;

	    RSSTICKER.feedsToFetch = [];
	    RSSTICKER.feedIndex = 0;
	    
		var anno = Components.classes["@mozilla.org/browser/annotation-service;1"].getService(Components.interfaces.nsIAnnotationService);
		var livemarkIds = anno.getItemsWithAnnotation("livemark/feedURI", {});

		for (var i = 0; i < livemarkIds.length; i++){
			var feedURL = RSSTICKER.livemarkService.getFeedURI(livemarkIds[i]).spec;
			var feedName = RSSTICKER.bookmarkService.getItemTitle(livemarkIds[i]);
			
			if (!this.inArray(ignore, feedURL)){
				RSSTICKER.feedsToFetch.push({ name : feedName, feed : feedURL, livemarkId : livemarkIds[i] });
			}
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
			showWindow = !this.prefs.getBoolPref("noFeedsFoundFlag.1.7");
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
	    var lastUpdate = this.prefs.getIntPref("lastUpdate") * 1000; 
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

        if (this.disabled || RSSTICKER.feedsToFetch.length == 0 || (!RSSTICKER.rapidUpdate && RSSTICKER.secondsBetweenFeeds == 0)){
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
        
        if (indexOverride) {
            feedIndex = indexOverride;
        }
        else {
            ++RSSTICKER.feedIndex;
        }
        
        if (feedIndex == 0) {
            this.prefs.setIntPref("lastUpdate", Math.round(new Date().getTime() / 1000));
        }
        
        var feed = RSSTICKER.feedsToFetch[feedIndex];
        
	    var url = feed.feed;
		
		/* START FEED FETCH HERE */
		
		if (this.DEBUG) this.logMessage("Loading " + url);
		
		var req = new XMLHttpRequest();
		req.parent = this;
		req.parent.addLoadingNotice("Updating " + feed.name + " (" + parseInt(RSSTICKER.feedIndex + 1, 10) + ")...");
		
		RSSTICKER.currentRequest = req;
		
		try {
			req.open("GET", url, true);
			
			req.onreadystatechange = function (event) {
				if (req.readyState == 4) {
					clearTimeout(req.parent.loadTimer);
					
					req.parent.currentRequest = null;
					setTimeoutForNext();
					
					try {
						if (req.status == 200){
							var feedOb = null;
							
							try {
								req.parent.queueForParsing(req.responseText.replace(/^\s\s*/, '').replace(/\s\s*$/, ''), url);
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
		
		this.checkForEmptiness();
		this.tick();
    },
	
	removeFeed : function (livemarkId) {
		var len = RSSTICKER.feedsToFetch.length;
		
		for (var i = 0; i < len; i++) {
			if (RSSTICKER.feedsToFetch[i].livemarkId == livemarkId) {
				var label = RSSTICKER.feedsToFetch[i].name;
				RSSTICKER.feedsToFetch.splice(i, 1);

				for (var i = this.toolbar.childNodes.length - 1; i >= 0; i--){
					var item = this.toolbar.childNodes[i];
					
					if (item.nodeName == 'toolbarbutton') {
						if (item.feed == label) {
							this.toolbar.removeChild(item);
						}
					}
				}
				
				return true;
			}
		}
		
		return false;
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
	
	writeFeed : function (feed) {
		var doTick, i, j;
		
		if (this.disabled) {
			return;
		}
		
		var feedItems = feed.items;
		
		this.internalPause = true;
		
		// Remove items that are no longer in the feed.
		for (var i = this.toolbar.childNodes.length - 1; i >= 0; i--){
			var item = this.toolbar.childNodes[i];
			
			if ((item.nodeName == 'toolbarbutton') && (item.feed == feed.label)){
				var itemFound = false;
				
				for (var j = 0; j < feedItems.length; j++){
					if (feedItems[j].uri == item.uri){
						itemFound = true;
						break;
					}
				}
				
				if (!itemFound){
					this.toolbar.removeChild(item);
				}
			}
		}
		
		var itemsShowing = this.itemsInTicker(feed.label);
		
		for (j = 0; j < feedItems.length; j++){
			if (!document.getElementById("RSSTICKER" + feedItems[j].uri)){
				if (this.limitItemsPerFeed && (this.itemsPerFeed <= itemsShowing.length)){
					// Determine if this item is newer than the oldest item showing.
					if ((this.itemsPerFeed > 0) && feedItems[j].published && itemsShowing[0].published && (feedItems[j].published > itemsShowing[0].published)){
						this.toolbar.removeChild(document.getElementById("RSSTICKER" + itemsShowing[0].href));
						itemsShowing.shift();
					}
					else {					
						continue;
					}
				}

				var itemIsVisited = this.history.isVisitedURL(feedItems[j].uri, feedItems[j].id, 1);

				if (itemIsVisited && this.hideVisited){
					continue;
				}

				doTick = true;

				feedItems[j].description = feedItems[j].description.replace(/<[^>]+>/g, "");

				if ((feedItems[j].label == '') && (feedItems[j].description != '')){
					if (feedItems[j].description.length > 40){
						feedItems[j].label = feedItems[j].description.substr(0,40) + "...";
					}
					else {
						feedItems[j].label = feedItems[j].description;
					}
				}

				var tbb = this.ce('toolbarbutton');
				tbb.uri = feedItems[j].uri;
				tbb.id = "RSSTICKER" + feedItems[j].uri;

				tbb.setAttribute("label",feedItems[j].label);
				tbb.setAttribute("tooltip","RSSTICKERTooltip");
				tbb.setAttribute("image",feedItems[j].image);
				tbb.setAttribute("contextmenu","RSSTICKERItemCM");

				tbb.setAttribute("onclick","return RSSTICKER.onTickerItemClick(event, this.uri, this);");

				if (this.displayWidth.limitWidth){
					if (this.displayWidth.isMaxWidth){
						tbb.style.maxWidth = this.displayWidth.itemWidth + "px";
					}
					else {
						tbb.style.width = this.displayWidth.itemWidth + "px";
					}
				}

				tbb.description = feedItems[j].description;
				tbb.visited = itemIsVisited;

				tbb.feed = feed.label;
				tbb.feedURL = feed.uri;
				tbb.href = feedItems[j].uri;
				tbb.parent = this;
				tbb.published = feedItems[j].published;
				tbb.guid = feedItems[j].id;

				if (this.hideVisited){
					tbb.markAsRead = function (addToHist, dontAdjustSpacer) {
						this.parentNode.removeChild(this);
						this.visited = true;

						if (!dontAdjustSpacer) this.parent.adjustSpacerWidth();

						if (addToHist){
							this.parent.history.addToHistory(this.guid);
						}

						this.parent.checkForEmptiness();
					};
				}
				else if (this.boldUnvisited){
					if (!itemIsVisited){
						tbb.style.fontWeight = 'bold';
					}

					tbb.markAsRead = function (addToHist, dontAdjustSpacer) {
						this.style.fontWeight = '';
						this.visited = true;

						if (!dontAdjustSpacer) this.parent.adjustSpacerWidth();

						if (addToHist){
							this.parent.history.addToHistory(this.guid);
						}
					};
				}
				else {
					tbb.markAsRead = function (addToHist, dontAdjustSpacer) {
						this.visited = true;
						if (addToHist){
							this.parent.history.addToHistory(this.guid);
						}
					};
				}

				if (this.boldUnvisited){
					// Don't move this.
					if (!itemIsVisited){
						tbb.style.fontWeight = 'bold';
					}
				}

				tbb.onContextOpen = function (target) {
					if (!target) {
						window._content.document.location.href = this.href;
					}
					else if (target == 'window'){
						window.open(this.href);
					}
					else if (target == 'tab') {
						this.parent.browser.openInNewTab(this.href);
					}

					this.markAsRead(true);
				};

				// Determine where to add the item

				if (this.randomizeItems){
					if (this.toolbar.childNodes.length == 1){
						// Only the spacer is showing
						this.toolbar.appendChild(tbb);
					}
					else {
						if ((this.toolbar.firstChild.nodeName == 'spacer') && ((this.currentFirstItemMargin * -1) < (this.toolbar.firstChild.nextSibling.boxObject.width))){
							var randomPlace = Math.floor(Math.random() * (this.toolbar.childNodes.length - 1)) + 1;
						}
						else {
							// Add after the 5th one just to avoid some jumpiness
							var randomPlace = Math.floor(Math.random() * (this.toolbar.childNodes.length - 1)) + 6;
						}

						if (randomPlace >= this.toolbar.childNodes.length){
							this.toolbar.appendChild(tbb);
						}
						else {
							this.toolbar.insertBefore(tbb, this.toolbar.childNodes[randomPlace]);
						}
					}
				}
				else {
					// Check for another item from this feed, if so place at end of that feed.

					if (itemsShowing.length > 0){
						for (i = this.toolbar.childNodes.length - 1; i >= 0; i--){
							if (this.toolbar.childNodes[i].nodeName == 'toolbarbutton'){
								if (this.toolbar.childNodes[i].feed == tbb.feed){
									if (i == (this.toolbar.childNodes.length - 1)){
										this.toolbar.appendChild(tbb);
										addedButton = true;
									}
									else {
										this.toolbar.insertBefore(tbb, this.toolbar.childNodes[i+1]);
										addedButton = true;
									}

									break;
								}
							}
						}
					}
					else {
						// None of this feed is showing; add after another feed.
						if ((this.toolbar.firstChild.nodeName == 'spacer') || (this.toolbar.lastChild.nodeName == 'spacer')){
							this.toolbar.appendChild(tbb);
						}
						else {
							if (this.toolbar.firstChild.feed != this.toolbar.lastChild.feed){
								// We're in luck - a feed just finished scrolling
								this.toolbar.appendChild(tbb);
							}
							else {
								var addedButton = false;

								for (i = this.toolbar.childNodes.length - 2; i >= 0; i--){
									if (this.toolbar.childNodes[i].nodeName == 'spacer'){
										this.toolbar.insertBefore(tbb, this.toolbar.childNodes[i+1]);
										addedButton = true;
										break;
									}
									else if (this.toolbar.childNodes[i].feed != this.toolbar.childNodes[i+1].feed){
										this.toolbar.insertBefore(tbb, this.toolbar.childNodes[i+1]);
										addedButton = true;
										break;
									}
								}

								if (!addedButton){
									this.toolbar.appendChild(tbb);
								}
							}
						}
					}
				}
				
				itemsShowing.push(tbb);
				
				itemsShowing.sort(RSSTICKER.sortByPubDate);
			}
		}
		
		this.internalPause = false;
		
		this.adjustSpacerWidth();
		this.checkForEmptiness();
		this.tick();
	},
	
	onTickerItemClick : function (event, url, node) {
		if (event.ctrlKey) {
			node.markAsRead(true); 
			return false;
		}
		else if (event.which == 3){
			// Discard right-clicks
			return;
		}
		else if (event.which == 4 || event.shiftKey){
			// Shift
			window.open(url);
		}
		else {
			// Left-click
			this.launchUrl(url, event);
			node.markAsRead(true);
		}
	},
	
	launchUrl : function (url, event) {
		if (this.prefs.getBoolPref("alwaysOpenInNewTab") || (event.which == 2) || (event.which == 1 && (event.ctrlKey || event.metaKey) && (event.ctrlKey || event.metaKey))){
			this._addTab(url);
		}
		else if (event.which == 1 || (event.which == 13 && !event.shiftKey)){
			this._inTab(url);
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
		if (this.toolbar && !this.disabled){
			var extraPadding;
			
			try {
				if (this.displayWidth.limitWidth){
					extraPadding = this.displayWidth.itemWidth;
				}
				else {
					extraPadding = 250;
				}
				
				var windowWidth = parseInt(this.ticker.boxObject.width);
				
				var tickerWidth = 0;
				
				for (var i = 0; i < this.toolbar.childNodes.length; i++){
					if (this.toolbar.childNodes[i].nodeName == 'toolbarbutton'){
						tickerWidth += this.toolbar.childNodes[i].boxObject.width;
					}
				}
				
				var spacerWidth;
				
				if (parseInt(windowWidth) > parseInt(tickerWidth - extraPadding)) {
					spacerWidth = parseInt(windowWidth) - parseInt(tickerWidth) + parseInt(extraPadding);
				}
				else {
					spacerWidth = 0;
				}
				
				this.toolbar.spacer.style.width = spacerWidth + "px";
			} catch (e) {
				// Tried to adjust spacer when there wasn't one.
				// Could happen depending on when the disable button was pressed
				if (this.DEBUG) this.logMessage(e);
			}
		}
	},
	
	tick : function () {
		if (this.disabled) {
			return;
		}
		
		clearTimeout(this.tickTimer);
		
		if (this.internalPause){
			this.tickTimer = setTimeout(function () { RSSTICKER.tick(); }, this.tickLength);
		}
		else {
			var node, nodeWidth, marginLeft;
			
			if (this.mouseOverFlag){
				if (this.toolbar.childNodes.length > 1){
					if (this.currentFirstItemMargin <= (this.toolbar.firstChild.boxObject.width * -1)){
						node = this.toolbar.firstChild;
						this.toolbar.removeChild(node);
						this.currentFirstItemMargin = 0;
						node.style.marginLeft = '0px';
						this.toolbar.appendChild(node);
						
						if (node.nodeName == 'toolbarbutton' && !node.visited){
							if (this.history.isVisitedURL(node.href, node.guid, 2)){
								node.markAsRead(true);
							}
						}
					}
					else if (this.currentFirstItemMargin > 0){
						// Move the last child back to the front.
						node = this.toolbar.lastChild;
						nodeWidth = node.boxObject.width;
						this.toolbar.removeChild(node);
						
						// Set the correct margins
						marginLeft = parseInt((0 - nodeWidth) + this.currentFirstItemMargin);
						
						node.style.marginLeft = marginLeft + "px";
						this.currentFirstItemMargin = marginLeft;
						this.toolbar.firstChild.style.marginLeft = 0;
						this.toolbar.insertBefore(node, this.toolbar.firstChild);
					}
				}
				
				this.tickTimer = setTimeout(function () { RSSTICKER.tick(); }, this.tickLength);
			}
			else {
				if (this.toolbar.childNodes.length > 1){
					if (this.currentFirstItemMargin <= (this.toolbar.firstChild.boxObject.width * -1)){
						node = this.toolbar.firstChild;
						this.toolbar.removeChild(node);
						this.currentFirstItemMargin = 0;
						node.style.marginLeft = '0px';
						this.toolbar.appendChild(node);
						
						if (node.nodeName == 'toolbarbutton' && !node.visited){
							if (this.history.isVisitedURL(node.href, node.guid, 3)){
								node.markAsRead(true);
							}
						}
					}
					else if (this.currentFirstItemMargin > 0){
						// Move the last child back to the front.
						node = this.toolbar.lastChild;
						this.toolbar.removeChild(node);
						
						// Set the correct margins
						nodeWidth = node.boxObject.width;
						marginLeft = parseInt((0 - nodeWidth) + this.currentFirstItemMargin);

						node.style.marginLeft = marginLeft + "px";
						this.currentFirstItemMargin = marginLeft;
						this.toolbar.firstChild.style.marginLeft = 0;
						this.toolbar.insertBefore(node, this.toolbar.firstChild);
					}
					else {
						this.currentFirstItemMargin -= (200 / this.ticksPerItem);
						this.toolbar.firstChild.style.marginLeft = this.currentFirstItemMargin + "px";
					}
				}
				
				this.tickTimer = setTimeout(function () { RSSTICKER.tick(); }, this.tickLength);
			}
		}
	},
	
	markAllAsRead : function (feed) {
		this.internalPause = true;
		
		for (var i = this.toolbar.childNodes.length - 1; i >= 0; i--){
			if (this.toolbar.childNodes[i].nodeName == 'toolbarbutton'){
				if (!feed || (this.toolbar.childNodes[i].feed == feed)){
					this.history.addToHistory(this.toolbar.childNodes[i].guid);
					this.toolbar.childNodes[i].markAsRead(true, true);
				}
			}
		}
		
		this.internalPause = false;
		
		this.adjustSpacerWidth();
	},
	
	openAllInTabs : function (unreadOnly, feed) {
		for (var i = this.toolbar.childNodes.length - 1; i >= 0; i--){
			if (this.toolbar.childNodes[i].nodeName == 'toolbarbutton'){
				if ((!feed || (this.toolbar.childNodes[i].feed == feed)) &&	(!unreadOnly || (!this.toolbar.childNodes[i].visited))){
					this.toolbar.childNodes[i].onContextOpen('tab');
				}
			}
		}
	},
	
	// Each scroll of the mouse should move the ticker items 
	
	scrollTicker : function (event) {
		if (this.mouseOverFlag && !this.internalPause){
			if (this.toolbar.childNodes.length > 1){
				if (event.detail > 0){
					// Scroll Down
					if (this.toolbar.firstChild){
						this.currentFirstItemMargin -= 40;
						this.toolbar.firstChild.style.marginLeft = this.currentFirstItemMargin + "px";
					}
				}
				else if (event.detail < 0){
					// Scroll Up
					if (this.toolbar.firstChild){
						this.currentFirstItemMargin += 40;
						this.toolbar.firstChild.style.marginLeft = this.currentFirstItemMargin + "px";
						
						if (this.currentFirstItemMargin > 0){
							// Move the last child back to the front.
							var node = this.toolbar.lastChild;
							var nodeWidth = node.boxObject.width;
							this.toolbar.removeChild(node);
							
							// Set the correct margins
							var marginLeft = (0 - nodeWidth) + this.currentFirstItemMargin;
							
							node.style.marginLeft = marginLeft + "px";
							this.currentFirstItemMargin = marginLeft;
							this.toolbar.firstChild.style.marginLeft = 0;
							this.toolbar.insertBefore(node, this.toolbar.firstChild);
						}
					}
				}
			}
		}
	},
	
	toggleDisabled : function () {
		this.prefs.setBoolPref("disabled", !this.prefs.getBoolPref("disabled"));
	},
	
	fillInTooltip : function (item, tt){
		var maxLength = 60;
		
		var descr = item.description;
		var title = item.getAttribute("label");
		var url = item.href;
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
		
		document.getElementById("RSSTICKERTooltipURL").value = this.strings.getString("URL") + ": " + url;
		
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
			for (var i = 0; i < document.getElementById("RSSTICKERTooltipSummary").childNodes.length; i++){
				document.getElementById("RSSTICKERTooltipSummary").removeChild(document.getElementById("RSSTICKERTooltipSummary").lastChild);
			}
			
			if (descr.length > 200){
				descr = descr.substring(0, descr.indexOf(" ",200)) + "...";
			}
			
			var text = document.createTextNode(descr);
			
			document.getElementById("RSSTICKERTooltipSummary").appendChild(text);
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
		if (!this.theFile) {
			this.theFile = Components.classes["@mozilla.org/file/directory_service;1"]
		                     .getService(Components.interfaces.nsIProperties)
		                     .get("ProfD", Components.interfaces.nsIFile);
			this.theFile.append("rssticker.sqlite");
		}
		
		if (!this.theDB) {
			this.theDB = Components.classes["@mozilla.org/storage/service;1"]
		                 .getService(Components.interfaces.mozIStorageService).openDatabase(this.theFile);
		}
		
		return this.theDB;
	},
	
	closeDB : function () {
		this.theDB.close();
		delete this.theDB;
		this.theDB = null;
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
	
	ce : function (name){
		return document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", name);
	},
	
	observeFeed : function (url) {
		var feeds = this.readIgnoreFile();
		var newFeeds = [];
		
		var foundFeed = false;
		
		for (var i = 0; i < feeds.length; i++){
			if (feeds[i] == url){
				foundFeed = true;
			}
			else {
				newFeeds.push(feeds[i]);
			}
		}
	
		if (foundFeed){
			// Rewrite the ignore file.
			var DIR_SERVICE = new Components.Constructor("@mozilla.org/file/directory_service;1", "nsIProperties");
			var profilePath = (new DIR_SERVICE()).get("ProfD", Components.interfaces.nsIFile).path; 
		
			if (profilePath.search(/\\/) != -1) profilePath += "\\";
			else profilePath += "/";
						
			var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(profilePath + this.ignoreFilename);

			var outputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance( Components.interfaces.nsIFileOutputStream );

			outputStream.init(file, 0x02 | 0x08 | 0x20, 0600, null);
		
			var data = "";
			
			for (var i = 0; i < newFeeds.length; i++){
				data += newFeeds[i] + "\r\n";
			}
			
			this.writeBytes(outputStream, data);
			
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
		var feeds = this.readIgnoreFile();
		var foundFeed = false;
		
		for (var i = 0; i < feeds.length; i++){
			if (feeds[i] == url){
				foundFeed = true;
				break;
			}
		}
		
		if (!foundFeed){
			var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(this.getProfilePath() + this.ignoreFilename);

			var outputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance( Components.interfaces.nsIFileOutputStream );
			outputStream.init(file, 0x02 | 0x08 | 0x10, 0600, null);
		
			var data = url + "\r\n";
			
			this.writeBytes(outputStream, data);
			
			outputStream.close();
		}
	},
	
	readIgnoreFile : function () {
		var file, inputStream, lineStream, stillInFile, parts;
		var feeds = [];
		var line = { value: "" };
		
		file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		
		file.initWithPath(this.getProfilePath() + this.ignoreFilename);
		
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
		if (!this.profilePath){
			var DIR_SERVICE = new Components.Constructor("@mozilla.org/file/directory_service;1", "nsIProperties");
			this.profilePath = (new DIR_SERVICE()).get("ProfD", Components.interfaces.nsIFile).path; 
		
			if (this.profilePath.search(/\\/) != -1) this.profilePath += "\\";
			else this.profilePath += "/";
		}
		
		return this.profilePath;
	},
	
	inArray : function (arr, needle){
		var i;
		
		for (i = 0; i < arr.length; i++){
			if (arr[i] == needle){
				return true;
			}
		}
		
		return false;
	},
	
	itemsInTicker : function (feed) {
		var items = [];
		var ip = this.internalPause;
		
		this.internalPause = true;
		
		for (var i = this.toolbar.childNodes.length - 1; i >= 0; i--){
			var tbb = this.toolbar.childNodes[i];
			
			if (tbb.nodeName != "spacer" && tbb.feed == feed){
				if (this.limitItemsPerFeed && (items.length == this.itemsPerFeed)){
					this.toolbar.removeChild(tbb);
				}
				else {
					items.push(tbb);
				}
			}
		}
		
		// Sort the array by time
		
		items.sort(RSSTICKER.sortByPubDate);
		
		this.internalPause = ip;
		
		this.checkForEmptiness();
		
		return items;
	},
	
	checkForEmptiness : function(){
		if (this.toolbar) {
			if ((this.toolbar.childNodes.length <= 1) && (this.hideWhenEmpty)){
				this.ticker.style.display = 'none';
				this.toolbar.firstChild.style.marginLeft = '0px';
				this.currentFirstItemMargin = 0;
				this.mouseOverFlag = false;
			}
			else {
				this.ticker.style.display = '';
				
				if (this.toolbar.childNodes.length <= 1){
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