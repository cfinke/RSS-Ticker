var RSSTICKER_UTIL = {
	_prefs : null,
	get prefs() { if (!RSSTICKER_UTIL._prefs) { RSSTICKER_UTIL._prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.rssticker."); } return RSSTICKER_UTIL._prefs; },
	
	_livemarkService : null,
	get livemarkService() { if (!RSSTICKER_UTIL._livemarkService) { RSSTICKER_UTIL._livemarkService = Components.classes["@mozilla.org/browser/livemark-service;2"].getService(Components.interfaces.nsILivemarkService); } return RSSTICKER_UTIL._livemarkService; },

	_bookmarkService : null,
	get bookmarkService() { if (!RSSTICKER_UTIL._bookmarkService) { RSSTICKER_UTIL._bookmarkService = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Components.interfaces.nsINavBookmarksService); } return RSSTICKER_UTIL._bookmarkService; },

	_ioService : null,
	get ioService() { if (!RSSTICKER_UTIL._ioService) { RSSTICKER_UTIL._ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService); } return RSSTICKER_UTIL._ioService; },
	
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
	
	ignoreList : null,
	ignoreListFilename : "rss-ticker.ignore.txt",
	
	readIgnoreFile : function () {
		RSSTICKER_UTIL.ignoreList = [];
		
		var file, inputStream, lineStream, stillInFile, parts;
		var feeds = [];
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
				feeds.push(line.value);
			}
		} while (stillInFile);
		
		lineStream.close();
		inputStream.close();
		
		return feeds;
	},
	
	writeIgnoreFile : function () {
		var profilePath = RSSTICKER_UTIL.getProfilePath();
		
		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(profilePath + RSSTICKER_UTIL.ignoreListFilename);

		var outputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance( Components.interfaces.nsIFileOutputStream );

		outputStream.init(file, 0x02 | 0x08 | 0x20, 0600, null);
		
		var data = RSSTICKER_UTIL.ignoreList.join("\r\n") + "\r\n";
		
		var bytes, bytesWritten, bytesRemaining = data.length;
		var offset = 0;
		
		while (bytesRemaining) {
			bytesWritten = outputStream.write(data.substring(offset), bytesRemaining);
			bytesRemaining -= bytesWritten;
			offset += bytesWritten;
		}
		
		outputStream.close();
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
	}
};

var EXPORTED_SYMBOLS = ["RSSTICKER_UTIL"];