Components.utils.import("resource://gre/modules/PlacesUtils.jsm");

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
	
	var ignoreFeeds = [];
	
	for (var i = 0; i < len; i++){
		var item = items[i];
		if (item.nodeName == 'listitem'){
			ticker.ignoreFeed(item.getAttribute("value"));
			item.setAttribute("ignored","true");
			
			ignoreFeeds.push(item.getAttribute("value"));
		}
	}
	
	ticker.doFunctionWhilePaused( function () {
		for (var i = ticker.toolbar.childNodes.length - 1; i >= 0; i--) {
			var item = ticker.toolbar.childNodes[i];
		
			if ((item.nodeName == 'toolbarbutton') && (ignoreFeeds.indexOf(item.feedURL) != -1)) {
				ticker.toolbar.removeChild(item);
			}
		}
	} );
}

var TICKER_PREFS = {
	prefs : null,
	browserPrefs : null,
	
	strings : {
		_backup : null,
		_main : null,
		
		initStrings : function () {
			if (!this._backup) { this._backup = document.getElementById("RSSTICKER-backup-bundle"); }
			if (!this._main) { this._main = document.getElementById("RSSTICKER-bundle"); }
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
		TICKER_PREFS.getFeeds(function () {
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
					var livemarkIds = PlacesUtils.annotations.getItemsWithAnnotation("livemark/feedURI", {});
					
					RSSTICKER.getLivemarks(livemarkIds, function (livemarks) {
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
					
							var button = document.createElement("button");
					
							button.feedUrl = featuredFeeds[i].url;
							button.siteUrl = featuredFeeds[i].siteUrl;
							button.name = featuredFeeds[i].name;
							button.description = featuredFeeds[i].description;
							button.isSubscribed = false
							button.setAttribute("label", TICKER_PREFS.strings.getString("rssticker.featured.subscribe"));
							
							for (var j = 0; j < livemarks.length; j++) {
								if (livemarks[j].feedURI.spec == featuredFeeds[i].url) {
									button.isSubscribed = true;
									button.setAttribute("label", TICKER_PREFS.strings.getString("rssticker.featured.unsubscribe"));
									break;
								}
							}
							
							button.setAttribute("oncommand", "if (this.isSubscribed) { this.setAttribute('label', TICKER_PREFS.strings.getString('rssticker.featured.subscribe')); TICKER_PREFS.unsubscribe(this.feedUrl); } else { this.setAttribute('label', TICKER_PREFS.strings.getString('rssticker.featured.unsubscribe')); TICKER_PREFS.subscribe(this.name, this.feedUrl, this.siteUrl, this.description); } this.isSubscribed = !this.isSubscribed;");
					
							vbox.appendChild(label);
							vbox.appendChild(description);
							vbox.appendChild(button);
					
							box.appendChild(vbox);
					
							document.getElementById("featured-feeds").appendChild(box);
						}
				
						sizeToContent();
					});
				}
			}
		});
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
	
	getFeeds : function (callback) {
		var livemarkIds = PlacesUtils.annotations.getItemsWithAnnotation("livemark/feedURI", {});
		
		RSSTICKER.getLivemarks(livemarkIds, function (livemarks) {
			var feedList = document.getElementById('feeds');
			
			for (var j = 0; j < livemarks.length; j++){
				var livemark = livemarks[j];

				var opt = document.createElement('listitem');
				var o1 = document.createElement('listcell');
				var o2 = document.createElement('listcell');
				o1.setAttribute("label", livemark.title);
				o2.setAttribute("label", livemark.feedURI.spec);

				opt.setAttribute("value", livemark.feedURI.spec);

				opt.appendChild(o1);
				opt.appendChild(o2);

				feedList.appendChild(opt);
			}

			var ignore = ticker.readIgnoreFile();

			for (var j = 0, _len = feedList.childNodes.length; j < _len; j++){
				var node = feedList.childNodes[j];

				if (ignore.indexOf(node.getAttribute("value")) != -1){
					node.setAttribute("ignored","true");
				}
			}
			
			callback(livemarks);
		});
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
	
	isSubscribed : function (url, callback) {
		var livemarkIds = PlacesUtils.annotations.getItemsWithAnnotation("livemark/feedURI", {});
		
		RSSTICKER.getLivemarks(livemarkIds, function (livemarks) {
			for (var i = 0; i < livemarks.length; i++) {
				if (livemarks[i].feedURI.spec == url) {
					callback(true);
					break;
				}
			}
			
			callback(false);
		});
	},
	
	subscribe : function (title, feedUrl, siteUrl, description) {
		var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
		
		PlacesUtils.livemarks.addLivemark(
			{
				title : title,
				parentId : Application.bookmarks.menu.id,
				feedURI : ioService.newURI(feedUrl, null, null),
				siteURI : ioService.newURI(siteUrl, null, null),
				index : 0
			}
		);
	},
		
	unsubscribe : function (url) {
		var livemarkIds = PlacesUtils.annotations.getItemsWithAnnotation("livemark/feedURI", {});
		
		RSSTICKER.getLivemarks(livemarkIds, function (livemarks) {
			for (var i = 0; i < livemarks.length; i++) {
				if (livemarks[i].feedURI.spec == url) {
					PlacesUtils.bookmarks.removeItem(livemarks[i].id);
				}
			}
		});
	}
};