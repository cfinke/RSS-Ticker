var RSSTICKER_UTIL = {
	loadStack : 0,
	
	load : function () {
		RSSTICKER_UTIL.loadStack++;
		
		if (RSSTICKER_UTIL.loadStack == 1) {
		}
	},
	
	unload : function () {
		RSSTICKER_UTIL.loadStack--;
		
		if (RSSTICKER_UTIL.loadStack == 0) {
			RSSTICKER_UTIL.closeDB();
		}
	},
	
	_prefs : null,
	get prefs() { if (!RSSTICKER_UTIL._prefs) { RSSTICKER_UTIL._prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.rssticker."); } return RSSTICKER_UTIL._prefs; },
	
	_livemarkService : null,
	get livemarkService() { if (!RSSTICKER_UTIL._livemarkService) { RSSTICKER_UTIL._livemarkService = Components.classes["@mozilla.org/browser/livemark-service;2"].getService(Components.interfaces.nsILivemarkService); } return RSSTICKER_UTIL._livemarkService; },

	_annotationService : null,
	get annotationService() { if (!RSSTICKER_UTIL._annotationService) { RSSTICKER_UTIL._annotationService = Components.classes["@mozilla.org/browser/annotation-service;1"].getService(Components.interfaces.nsIAnnotationService); } return RSSTICKER_UTIL._annotationService; },

	_bookmarkService : null,
	get bookmarkService() { if (!RSSTICKER_UTIL._bookmarkService) { RSSTICKER_UTIL._bookmarkService = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Components.interfaces.nsINavBookmarksService); } return RSSTICKER_UTIL._bookmarkService; },

	_ioService : null,
	get ioService() { if (!RSSTICKER_UTIL._ioService) { RSSTICKER_UTIL._ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService); } return RSSTICKER_UTIL._ioService; },
	
	_historyService : null,
	get historyService() { if (!RSSTICKER_UTIL._historyService) { RSSTICKER_UTIL._historyService = Components.classes["@mozilla.org/browser/global-history;2"].getService(Components.interfaces.nsIGlobalHistory2); } return RSSTICKER_UTIL._historyService; },
	
	clipboard : {
		copyString : function (str){
			try {
				var oClipBoard = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
				oClipBoard.copyString(str);
			} catch (e) {
			}
		}
	},
	
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
				rv = this._main.GetStringFromName(key);
			} catch (e) {
				RSSTICKER_UTIL.log(e);
			}
			
			if (!rv) {
				try {
					rv = this._backup.GetStringFromName(key);
				} catch (e) {
					RSSTICKER_UTIL.log(e);
				}
			}
			
			return rv;
		},
		
		getFormattedString : function (key, args) {
			this.initStrings();
			
			var rv = "";
			
			try {
				rv = this._main.formatStringFromName(key, args);
			} catch (e) {
			}
			
			if (!rv) {
				try {
					rv = this._backup.formatStringFromName(key, args);
				} catch (e) {
				}
			}
			
			return rv;
		}
	},
	
	get windows() {
		var windows = [];
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		                   .getService(Components.interfaces.nsIWindowMediator);
		
		var enumerator = wm.getEnumerator("navigator:browser");
		
		while (enumerator.hasMoreElements()) {
			windows.push(enumerator.getNext());
		}
		
		return windows;
	},
	
	get window() {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		                   .getService(Components.interfaces.nsIWindowMediator);
		return wm.getMostRecentWindow("navigator:browser");
	},
	
	history : {
		URI : null,
		
		isVisitedURL : function(url, guid){
			try {
				RSSTICKER_UTIL.history.URI = RSSTICKER_UTIL.ioService.newURI(url, null, null);
				var visited = RSSTICKER_UTIL.historyService.isVisited(RSSTICKER_UTIL.history.URI);
				var db = RSSTICKER_UTIL.getDB();
				
				if (!visited) {
					var select = db.createStatement("SELECT id FROM history WHERE id=?1");
					select.bindStringParameter(0, guid);
					
					try {
						while (select.executeStep()) {
							visited = true;
							break;
						}
					} catch (e) {
						RSSTICKER_UTIL.log(e);
					} finally {
						select.reset();
					}
					
					select.finalize();
				}
				else {
					RSSTICKER_UTIL.history.addToHistory(guid);
				}
				
				return visited;
			} catch (e) {
				// Malformed URI, probably
				RSSTICKER_UTIL.log(e + " " + url);
				return false;
			}
		},
		
		addToHistory : function (guid) {
			var db = RSSTICKER_UTIL.getDB();
		
			// Add to DB
			var insert = db.createStatement("INSERT INTO history (id, date) VALUES (?1, ?2)");
			insert.bindUTF8StringParameter(0, guid);
			insert.bindInt64Parameter(1, (new Date().getTime()));
			insert.executeAsync();
		}
	},
	
	dbConnection : null,
	
	getDB : function () {
		if (!RSSTICKER_UTIL.dbConnection) {
			var dbFile = Components.classes["@mozilla.org/file/directory_service;1"]
			                     .getService(Components.interfaces.nsIProperties)
			                     .get("ProfD", Components.interfaces.nsIFile);
			dbFile.append("rssticker.sqlite");
		
			RSSTICKER_UTIL.dbConnection = Components.classes["@mozilla.org/storage/service;1"]
			                                      .getService(Components.interfaces.mozIStorageService)
			                                      .openDatabase(dbFile);
			
			if (!RSSTICKER_UTIL.dbConnection.tableExists("history")) {
				RSSTICKER_UTIL.dbConnection.executeSimpleSQL("CREATE TABLE history (id TEXT PRIMARY KEY, date INTEGER)");
			}
		}
		
		return RSSTICKER_UTIL.dbConnection;
	},
	
	closeDB : function () {
		RSSTICKER_UTIL.dbConnection.close();
		delete RSSTICKER_UTIL.dbConnection;
		RSSTICKER_UTIL.dbConnection = null;
	},
	
	ignoreList : null,
	ignoreListFilename : "rss-ticker.ignore.txt",
	
	readIgnoreFile : function () {
		RSSTICKER_UTIL.ignoreList = [];
		
		var file, inputStream, lineStream, stillInFile, parts;
		var line = { value: "" };
		
		file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		
		file.initWithPath(RSSTICKER_UTIL.getProfilePath() + RSSTICKER_UTIL.ignoreListFilename);
		
		if (!file.exists()) {
			// File doesn't exist yet
			return;
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
				RSSTICKER_UTIL.ignoreList.push(line.value);
			}
		} while (stillInFile);
		
		lineStream.close();
		inputStream.close();
	},
	
	writeIgnoreFile : function () {
		Components.utils.import("resource://gre/modules/NetUtil.jsm");
		
		var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
		file.append(RSSTICKER_UTIL.ignoreListFilename);
		file.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
		
		var ostream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
		ostream.init(file, -1, -1, 0);
		
		var data = RSSTICKER_UTIL.ignoreList.join("\r\n");
		
		let istream = Components.classes["@mozilla.org/io/string-input-stream;1"].createInstance(Components.interfaces.nsIStringInputStream);
		istream.setData(data, data.length);
		
		NetUtil.asyncCopy(istream, ostream, function (aResult) {
			if (!Components.isSuccessCode(aResult)) {
				RSSTICKER_UTIL.log("An error occurred.");
			}
			else {
				RSSTICKER_UTIL.log("Success!");
			}
		});
	},
	
	getProfilePath : function () {
		var DIR_SERVICE = new Components.Constructor("@mozilla.org/file/directory_service;1", "nsIProperties");
		var profilePath = (new DIR_SERVICE()).get("ProfD", Components.interfaces.nsIFile).path; 
		if (profilePath.search(/\\/) != -1) profilePath += "\\";
		else profilePath += "/";
		
		return profilePath;
	},
	
	isFeedIgnored : function (url) {
		if (RSSTICKER_UTIL.ignoreList === null) {
			RSSTICKER_UTIL.readIgnoreFile();
		}
		
		return (RSSTICKER_UTIL.ignoreList.indexOf(url) != -1);
	},
	
	ignoreFeed : function (url) {
		if (RSSTICKER_UTIL.ignoreList === null) {
			RSSTICKER_UTIL.readIgnoreFile();
		}
		
		if (RSSTICKER_UTIL.ignoreList.indexOf(url) == -1) {
			RSSTICKER_UTIL.ignoreList.push(url);
			
			RSSTICKER_UTIL.writeIgnoreFile();
		}
	},
	
	unignoreFeed : function (url) {
		if (RSSTICKER_UTIL.ignoreList === null) {
			RSSTICKER_UTIL.readIgnoreFile();
		}
		
		var urlIndex = -1;
		
		if ((urlIndex = RSSTICKER_UTIL.ignoreList.indexOf(url)) != -1) {
			RSSTICKER_UTIL.ignoreList.splice(urlIndex, 1);
			
			RSSTICKER_UTIL.writeIgnoreFile();
		}
	},
	
	log : function (message) {
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		consoleService.logStringMessage("RSSTICKER: " + message);
	}
};

var EXPORTED_SYMBOLS = ["RSSTICKER_UTIL"];