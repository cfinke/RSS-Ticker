Components.utils.import("resource://gre/modules/PlacesUtils.jsm");

var RSSTICKER_FEED_MANAGER_TREE_VIEW = {
	nodeHash : {},
	visibleData : [],
	
	treebox : null,
	
	load : function () {
		var ignore = ticker.readIgnoreFile();
		
		this.visibleData = [];
		
		var livemarkService = Components.classes["@mozilla.org/browser/livemark-service;2"].getService(Components.interfaces.nsILivemarkService);
		var self = this;

		function iterate(root, level, parentId) {
			if (root.type == 'folder' && root.children) {
				var row = {};
				row.level = level;
				row.container = true;
				row.title = root.title;

				var rootEntry = {
					level : level,
					container : true,
					title : root.title,
					id : root.id,
					open : true,
					children : []
				};
				
				if (parentId)
					rootEntry.parent = parentId;
				
				self.nodeHash[rootEntry.id] = rootEntry;
				
				if (parentId)
					self.nodeHash[parentId].children.push(rootEntry.id);
				
				self.visibleData.push(rootEntry);
				
				var rc = root.children;
				
				for (var i = 0, _len = root.children.length; i < _len; i++) {
					if (root.children[i].type == "folder") {
						if (!livemarkService.isLivemark(root.children[i].id)) {
							var lengthBefore = self.visibleData.length;
							
							iterate(root.children[i], level + 1, root.id);
							
							if (self.visibleData.length == lengthBefore + 1) {
								self.nodeHash[rootEntry.id].children.pop();
								delete self.nodeHash[root.children[i].id];
								self.visibleData.pop();
							}
						}
						else {
							var feedURI = livemarkService.getFeedURI(root.children[i].id).spec;
							
							var entry = {
								id : root.children[i].id,
								title : root.children[i].title,
								url : feedURI,
								container : false,
								level : level + 1,
								parent : root.id,
								ignored : ignore.indexOf(feedURI) != -1
							};
							
							self.nodeHash[entry.id] = entry;
							self.nodeHash[entry.parent].children.push(entry.id);
							self.visibleData.push(entry);
						}
					}
				}
				
				var lastOne = RSSTICKER_FEED_MANAGER_TREE_VIEW.visibleData[RSSTICKER_FEED_MANAGER_TREE_VIEW.visibleData.length - 1];
			}
		}
		
		var rootFolders = [Application.bookmarks.menu, Application.bookmarks.toolbar, Application.bookmarks.unfiled];
		var lengthBefore = 0;
		for (var i = 0; i < rootFolders.length; i++) {
			iterate(rootFolders[i], 0, 0);
			
			// No empty folders.
			if (this.visibleData.length == lengthBefore + 1) {
				this.visibleData.pop();
				delete this.nodeHash[rootFolders[i].id];
			}
			
			lengthBefore = this.visibleData.length;
		}
		
		this.rowCount = this.visibleData.length;
		
		this.treebox.rowCountChanged(0, this.rowCount);
	},

	canDrop : function () { return false; },
	cycleCell : function () { },
	cycleHeader : function () { },
	drop : function () { },
	getCellProperties: function (row, col, props) {
	},
	
	getCellText : function (row,column) {
		if (column.id == "rssticker-feed-manager-feedcol")
			return ' ' + this.visibleData[row].title;

		if (column.id == "rssticker-feed-manager-feedurlcol" && ! this.visibleData[row].container)
			return this.visibleData[row].url;
		
		return '';
	},
	
	getCellValue : function (row, column) {
		if (this.visibleData[row].container)
			return false;
		
		return !this.visibleData[row].ignored;
	},
	
	getColumnProperties : function (colid, col, props) {
	},
	
	getImageSrc: function(row, col){ 
		if (col.id == 'rssticker-feed-manager-feedcol' && this.isContainer(row))
			return 'chrome://rss-ticker/content/skin-common/folder.png';
		
		return '';
	},
	
	getLevel: function (row) {
		return this.visibleData[row].level;
	},
	
	getParentIndex : function (row) {
		if ('parent' in this.visibleData[row]) {
			var parentId = this.visibleData[row].parent;
			
			for (var i = 0; i < this.visibleData.length; i++) {
				if (this.visibleData[i].id == parentId)
					return i;
			}
		}

		return -1;
	},
	
	getProgressMode : function (row, col) { },
	getRowProperties: function (row,props) {
	},
	
	hasNextSibling : function (row) {
		if (this.visibleData.length == (row+1))
			return false;
		
		return this.visibleData[row+1].level == this.visibleData[row].level;
	},

	isContainer: function (row) {
		return this.visibleData[row].container;
	},

	isContainerEmpty : function (row) {
		return false;
	},
	
	isContainerOpen : function (row) {
		return this.visibleData[row].open;
	},
	
	isEditable : function (row, col) {
		return false;
	},
	
	isSelectable : function (row, col) {
		return true;
	},

	isSeparator: function (row) { return false; },
	isSorted : function () { return false; },
	
	performAction : function (action) {
		alert(action);
	},
	
	performActionOnCell : function (row, col, action) {
		alert("Cell action: " + action);
	},

	performActionOnRow : function (row, action) {
		alert("Row action: " + action);
	},
	
	selectionChanged : function () { },
	setCellText : function (row, col, value) { },
	setCellValue : function (row, col, value) { },
	
	setTree : function (treebox) {
		if (treebox)
			this.treebox = treebox;
		else
			delete this.treebox;
	},

	toggleOpenState : function (idx) {
		var item = this.visibleData[idx];
		
		if (!item.container) return;
		
		if (this.visibleData[idx].open) {
			// Container is open, we need to close it.
			this.visibleData[idx].open = !this.visibleData[idx].open;
//			this.nodeHash[this.visibleData[idx].id].open = this.visibleData[idx].open;
			
			var thisLevel = this.getLevel(idx);
			var deleteCount = 0;
			
			for (var t = idx + 1; t < this.visibleData.length; t++){
				if (this.getLevel(t) <= thisLevel)
					break;
					
				deleteCount++;
			}
			
			if (deleteCount) {
				this.visibleData.splice(idx + 1, deleteCount);
				this.treebox.rowCountChanged(idx + 1, -deleteCount);
			}
		}
		else {
			this.visibleData[idx].open = !this.visibleData[idx].open;
//			this.nodeHash[this.visibleData[idx].id].open = this.visibleData[idx].open;
			
			var self = this;
			var toggledItem = self.nodeHash[this.visibleData[idx].id];
			var childrenIds = toggledItem.children;
			var itemsInserted = 0;
			
			function addItem(itemId) {
				var item = self.nodeHash[itemId];
				self.visibleData.splice(idx + itemsInserted + 1, 0, item);
				++itemsInserted;
				
				if (item.container && item.open && item.children.length) {
					for (var j = 0; j < item.children.length; j++) {
						addItem(item.children[j]);
					}
				}
			}
			
			for (var i = 0; i < childrenIds.length; i++){
				addItem(childrenIds[i]);
			}
			
			this.treebox.rowCountChanged(idx + 1, itemsInserted);
		}
	},

	getSelectedIndexes : function () {
		var start = new Object();
		var end = new Object();
		var numRanges = this.selection.getRangeCount();
		var values = [];
		
		for (var t = 0; t < numRanges; t++) {
			this.selection.getRangeAt(t,start,end);
			
			for (var v = start.value; v <= end.value; v++){
				values.push( v );
			}
		}
		
		return values;
	},
	
	
	getSelectedFeeds : function (ignored) {
		var targetIDs = this.getSelectedIndexes();
		
		var urls = [];
		
		for (var i = 0; i < targetIDs.length; i++) {
			if ('url' in this.visibleData[targetIDs[i]]) {
				urls.push(this.visibleData[targetIDs[i]].url);
				this.visibleData[targetIDs[i]].ignored = ignored;
			}
		}
		
		return urls;
	},
	
	observeSelectedFeeds : function () {
		var urls = this.getSelectedFeeds( false );
		
		for (var i = 0; i < urls.length; i++)
			ticker.observeFeed(urls[i]);

		ticker.prefs.setBoolPref("updateToggle", !ticker.prefs.getBoolPref("updateToggle"));
		
		this.treebox.invalidate();
	},
	
	ignoreSelectedFeeds : function () {
		var urls = this.getSelectedFeeds( true );
		
		for (var i = 0; i < urls.length; i++)
			ticker.ignoreFeed(urls[i]);
		
		ticker.doFunctionWhilePaused( function () {
			for (var i = ticker.toolbar.childNodes.length - 1; i >= 0; i--) {
				var item = ticker.toolbar.childNodes[i];

				if ((item.nodeName == 'toolbarbutton') && (urls.indexOf(item.feedURL) != -1)) {
					ticker.toolbar.removeChild(item);
				}
			}
		} );
		
		this.treebox.invalidate();
	}
};

var ticker;

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
		
		document.getElementById("rssticker-feed-manager").view = RSSTICKER_FEED_MANAGER_TREE_VIEW;
		RSSTICKER_FEED_MANAGER_TREE_VIEW.load();
		
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