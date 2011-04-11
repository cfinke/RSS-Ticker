var ticker;

function observeFeeds(){
	var items = document.getElementById('feeds').selectedItems;
	
	var len = items.length;
	
	for (var i = 0; i < len; i++){
		var item = items[i];
		
		if (item.nodeName == 'listitem'){
			ticker.observeFeed(item.getAttribute("value"));
			item.setAttribute("ignored","false");
		}
	}
	
	ticker.prefs.setBoolPref("updateToggle", !ticker.prefs.getBoolPref("updateToggle"));
}

function ignoreFeeds(){
	var items = document.getElementById('feeds').selectedItems;
	
	var len = items.length;
	
	for (var i = 0; i < len; i++){
		var item = items[i];
		
		if (item.nodeName == 'listitem'){
			ticker.ignoreFeed(item.getAttribute("value"));
			item.setAttribute("ignored","true");
		}
	}
	
	ticker.prefs.setBoolPref("updateToggle", !ticker.prefs.getBoolPref("updateToggle"));
}

var TICKER_PREFS = {
	prefs : null,
	browserPrefs : null,
	
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
	},
	
	onload : function () {
		TICKER_PREFS.findTicker();
		TICKER_PREFS.getFeeds();
		
		TICKER_PREFS.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.rssticker.");
		TICKER_PREFS.browserPrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("browser.preferences.");
		
		TICKER_PREFS.scales();
		
		var featuredFeeds = TICKER_PREFS.prefs.getCharPref("featuredFeeds");
		
		if (!featuredFeeds) {
			document.getElementById("featured-pane").style.display = "none";
		}
		else {
			featuredFeeds = JSON.parse(featuredFeeds);
			
			if (featuredFeeds.length > 0) {
				function sorter(a, b) {
					return 0.5 - Math.random();
				}
				
				featuredFeeds.sort(sorter);
				
				for (var i = 0; i < featuredFeeds.length; i++) {
					var box = document.createElement("groupbox");
					box.setAttribute("orient", "horizontal");
					
					if ("image" in featuredFeeds[i]) {
						var image = document.createElement("image");
						image.style.height = "64px";
						image.style.width = "64px";
						image.style.maxHeight = "64px";
						image.style.marginRight = "10px";
						image.setAttribute("src", featuredFeeds[i].image);
						
						var ibox = document.createElement("vbox");
						var s1 = document.createElement("spring");
						s1.setAttribute("flex", 1);
						var s2 = document.createElement("spring");
						s2.setAttribute("flex", 1);
						
						ibox.appendChild(s1);
						ibox.appendChild(image);
						ibox.appendChild(s2);
						box.appendChild(ibox);
					}
					
					var vbox = document.createElement("vbox");
					vbox.setAttribute("flex", 1);
					
					var label = document.createElement("label");
					label.setAttribute("value", featuredFeeds[i].name);
					label.setAttribute("class", "text-link");
					label.setAttribute("href", featuredFeeds[i].siteUrl);
					label.style.paddingLeft = 0;
					label.style.marginLeft = 0;
					
					var description = document.createElement("description");
					description.appendChild(document.createTextNode(featuredFeeds[i].description));
					
					var isSubscribed = this.isSubscribed(featuredFeeds[i].url);
					
					var button = document.createElement("button");
					
					button.feedUrl = featuredFeeds[i].url;
					button.siteUrl = featuredFeeds[i].siteUrl;
					button.name = featuredFeeds[i].name;
					button.description = featuredFeeds[i].description;
					
					if (isSubscribed) {
						button.setAttribute("label", TICKER_PREFS.strings.getString("rssticker.featured.unsubscribe"));
					}
					else {
						button.setAttribute("label", TICKER_PREFS.strings.getString("rssticker.featured.subscribe"));
					}
					
					button.setAttribute("oncommand", "if (TICKER_PREFS.isSubscribed(this.feedUrl)) { this.setAttribute('label', TICKER_PREFS.strings.getString('rssticker.featured.subscribe')); TICKER_PREFS.unsubscribe(this.feedUrl); } else { this.setAttribute('label', TICKER_PREFS.strings.getString('rssticker.featured.unsubscribe')); TICKER_PREFS.subscribe(this.name, this.feedUrl, this.siteUrl, this.description); }");
					
					vbox.appendChild(label);
					vbox.appendChild(description);
					vbox.appendChild(button);
					
					box.appendChild(vbox);
					
					document.getElementById("featured-feeds").appendChild(box);
				}
				
				sizeToContent();
			}
		}
		/*
		if (window.arguments[0]) {
			setTimeout(function () {
				document.documentElement.showPane(document.getElementById(window.arguments[0]));
			}, 1000);
		}
		*/
	},
	
	unload : function () {
		var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("");
		var browserPrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("browser.preferences.");
		
		if (!browserPrefs.getBoolPref("instantApply")) {
			var prefs = document.getElementsByTagName("preference");
			
			for (var i = 0; i < prefs.length; i++) {
				switch (prefs[i].getAttribute("type")) {
					case 'bool':
						prefService.setBoolPref(prefs[i].getAttribute("name"), prefs[i].value);
					break;
					case 'int':
						prefService.setIntPref(prefs[i].getAttribute("name"), prefs[i].value);
					break;
				}
			}
		}
		
		// @todo
	},
	
	findTicker : function () {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
		var enumerator = wm.getEnumerator(null);

		while(enumerator.hasMoreElements()) {
			var win = enumerator.getNext();

			if (win.RSSTICKER) {
				ticker = win.RSSTICKER;
				break;
			}
		}
	},
	
	getFeeds : function () {
		var livemarkService = Components.classes["@mozilla.org/browser/livemark-service;2"].getService(Components.interfaces.nsILivemarkService);
		
		var feedList = document.getElementById('feeds');
		
		var livemarks = [];
		
		var anno = Components.classes["@mozilla.org/browser/annotation-service;1"].getService(Components.interfaces.nsIAnnotationService);
		var livemarkIds = anno.getItemsWithAnnotation("livemark/feedURI", {});

		var len = livemarkIds.length;

		for (var i = 0; i < len; i++){
			var livemarkId = livemarkIds[i];

			var feedURL = livemarkService.getFeedURI(livemarkId).spec;
			var feedTitle = ticker.bookmarkService.getItemTitle(livemarkId);

			livemarks.push(
				{
					"feedURL" : feedURL,
					"feedTitle" : feedTitle
				}
			);
		}

		var len = livemarks.length;

		for (var i = 0; i < len; i++){
			var livemark = livemarks[i];

			var opt = document.createElement('listitem');
			var o1 = document.createElement('listcell');
			var o2 = document.createElement('listcell');
			o1.setAttribute("label", livemark.feedTitle);
			o2.setAttribute("label", livemark.feedURL);

			opt.setAttribute("value", livemark.feedURL);

			opt.appendChild(o1);
			opt.appendChild(o2);

			feedList.appendChild(opt);
		}

		var ignore = ticker.readIgnoreFile();

		var len = feedList.childNodes.length;

		for (var i = 0; i < len; i++){
			var node = feedList.childNodes[i];

			if (ignore.indexOf(node.getAttribute("value")) != -1){
				node.setAttribute("ignored","true");
			}
		}
	},
	
	scales : function () {
		var sliders = {
			"speed" : "p_tickSpeed",
			"smoothness" : "p_ticksPerItem"
		};

		for (var i in sliders) {
			document.getElementById(i).value = document.getElementById(sliders[i]).value;
			document.getElementById(i).setAttribute("preference", sliders[i]);
		}
	},
	
	isSubscribed : function (url) {
		var anno = Components.classes["@mozilla.org/browser/annotation-service;1"].getService(Components.interfaces.nsIAnnotationService);
		var livemarkIds = anno.getItemsWithAnnotation("livemark/feedURI", {});
		
		var len = livemarkIds.length;
		
		for (var i = 0; i < len; i++){
			var livemarkId = livemarkIds[i];
			
			var feedURL = ticker.livemarkService.getFeedURI(livemarkId).spec;
			
			if (url == feedURL) {
				return true;
			}
		}
		
		return false;
	},
	
	subscribe : function (title, feedUrl, siteUrl, description) {
		var annotationService = Components.classes["@mozilla.org/browser/annotation-service;1"].getService(Components.interfaces.nsIAnnotationService);
		var livemarkService = Components.classes["@mozilla.org/browser/livemark-service;2"].getService(Components.interfaces.nsILivemarkService);
		var menu = Application.bookmarks.menu;
		var uri = ticker.ioService.newURI(siteUrl, null, null);
		var feedUri = ticker.ioService.newURI(feedUrl, null, null);
		var lm = livemarkService.createLivemarkFolderOnly(Application.bookmarks.menu.id, title, uri, feedUri, -1);
		annotationService.setItemAnnotation(lm, "bookmarkProperties/description", description, 0, Components.interfaces.nsIAnnotationService.EXPIRE_NEVER);
	},
	
	unsubscribe : function (url) {
		var anno = Components.classes["@mozilla.org/browser/annotation-service;1"].getService(Components.interfaces.nsIAnnotationService);
		var livemarkIds = anno.getItemsWithAnnotation("livemark/feedURI", {});
		var livemarkService = Components.classes["@mozilla.org/browser/livemark-service;2"].getService(Components.interfaces.nsILivemarkService);
		
		for (var i = 0; i < livemarkIds.length; i++){
			var feedURL = livemarkService.getFeedURI(livemarkIds[i]).spec;
			
			if (feedURL == url) {
				var bookmarkService = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Components.interfaces.nsINavBookmarksService);
				bookmarkService.removeFolder(livemarkIds[i]);
			}
		}
	}
};