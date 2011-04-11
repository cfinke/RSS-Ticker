var TICKER_PREFS = {
	browserPrefs : null,
	
	onload : function () {
		TICKER_PREFS.getFeeds();
		
		TICKER_PREFS.browserPrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("browser.preferences.");
		
		TICKER_PREFS.scales();
		
		var featuredFeeds = RSSTICKER_UTIL.prefs.getCharPref("featuredFeeds");
		
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
						button.setAttribute("label", RSSTICKER_UTIL.strings.getString("rssticker.featured.unsubscribe"));
					}
					else {
						button.setAttribute("label", RSSTICKER_UTIL.strings.getString("rssticker.featured.subscribe"));
					}
					
					button.setAttribute("oncommand", "if (TICKER_PREFS.isSubscribed(this.feedUrl)) { this.setAttribute('label', RSSTICKER_UTIL.strings.getString('rssticker.featured.subscribe')); TICKER_PREFS.unsubscribe(this.feedUrl); } else { this.setAttribute('label', RSSTICKER_UTIL.strings.getString('rssticker.featured.unsubscribe')); TICKER_PREFS.subscribe(this.name, this.feedUrl, this.siteUrl, this.description); }");
					
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
	
	observeFeeds : function () {
		var items = document.getElementById('feeds').selectedItems;

		var len = items.length;

		for (var i = 0; i < len; i++){
			var item = items[i];

			if (item.nodeName == 'listitem'){
				RSSTICKER_UTIL.unignoreFeed(item.getAttribute("value"));
				item.setAttribute("ignored","false");
			}
		}

		RSSTICKER_UTIL.prefs.setBoolPref("updateToggle", !RSSTICKER_UTIL.prefs.getBoolPref("updateToggle"));
	},
	
	ignoreFeeds : function () {
		var items = document.getElementById('feeds').selectedItems;

		var len = items.length;

		for (var i = 0; i < len; i++){
			var item = items[i];

			if (item.nodeName == 'listitem'){
				RSSTICKER_UTIL.ignoreFeed(item.getAttribute("value"));
				item.setAttribute("ignored","true");
			}
		}

		RSSTICKER_UTIL.prefs.setBoolPref("updateToggle", !RSSTICKER_UTIL.prefs.getBoolPref("updateToggle"));
	},
	
	getFeeds : function () {
		var feedList = document.getElementById('feeds');
		
		var livemarks = [];
		
		var anno = Components.classes["@mozilla.org/browser/annotation-service;1"].getService(Components.interfaces.nsIAnnotationService);
		var livemarkIds = anno.getItemsWithAnnotation("livemark/feedURI", {});

		var len = livemarkIds.length;

		for (var i = 0; i < len; i++){
			var livemarkId = livemarkIds[i];

			var feedURL = RSSTICKER_UTIL.livemarkService.getFeedURI(livemarkId).spec;
			var feedTitle = RSSTICKER_UTIL.bookmarkService.getItemTitle(livemarkId);

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
		
		var len = feedList.childNodes.length;

		for (var i = 0; i < len; i++){
			var node = feedList.childNodes[i];

			if (RSSTICKER_UTIL.isFeedIgnored(node.getAttribute("value"))) {
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
			
			var feedURL = RSSTICKER_UTIL.livemarkService.getFeedURI(livemarkId).spec;
			
			if (url == feedURL) {
				return true;
			}
		}
		
		return false;
	},
	
	subscribe : function (title, feedUrl, siteUrl, description) {
		var annotationService = Components.classes["@mozilla.org/browser/annotation-service;1"].getService(Components.interfaces.nsIAnnotationService);
		var menu = Application.bookmarks.menu;
		var uri = RSSTICKER_UTIL.ioService.newURI(siteUrl, null, null);
		var feedUri = RSSTICKER_UTIL.ioService.newURI(feedUrl, null, null);
		var lm = RSSTICKER_UTIL.livemarkService.createLivemarkFolderOnly(Application.bookmarks.menu.id, title, uri, feedUri, -1);
		annotationService.setItemAnnotation(lm, "bookmarkProperties/description", description, 0, Components.interfaces.nsIAnnotationService.EXPIRE_NEVER);
	},
	
	unsubscribe : function (url) {
		var anno = Components.classes["@mozilla.org/browser/annotation-service;1"].getService(Components.interfaces.nsIAnnotationService);
		var livemarkIds = anno.getItemsWithAnnotation("livemark/feedURI", {});
		
		for (var i = 0; i < livemarkIds.length; i++){
			var feedURL = RSSTICKER_UTIL.livemarkService.getFeedURI(livemarkIds[i]).spec;
			
			if (feedURL == url) {
				var bookmarkService = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Components.interfaces.nsINavBookmarksService);
				bookmarkService.removeFolder(livemarkIds[i]);
			}
		}
	}
};