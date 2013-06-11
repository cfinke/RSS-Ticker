var Ci = Components.interfaces,
	Cc = Components.classes,
	Cr = Components.results,
	Cu = Components.utils;

Cu.import( "resource://gre/modules/PlacesUtils.jsm" );
Cu.import( "resource:///modules/PlacesUIUtils.jsm" );
Cu.import( "resource://rss-ticker-modules/ticker-utils.js" );

var RSS_TICKER_FEED_MANAGER = {
	loadCount : 0,
	updateIndex : 0,
	livemarks : [],
	feeds : {},
	views : {},

	timers : {},
	
	rootFolderId : null,

	initialFetch : true,
	feedFetchTimeout : null,

	load : function () {
		++RSS_TICKER_FEED_MANAGER.loadCount;

		if ( 1 == RSS_TICKER_FEED_MANAGER.loadCount ) {
			RSS_TICKER_FEED_MANAGER.setTimeout( function __delayedStartup() {
				var file = this.getCacheFile();

				if ( file.exists() ) {
					var data = new String();
					var fiStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance( Ci.nsIFileInputStream );
					var siStream = Cc['@mozilla.org/scriptableinputstream;1'].createInstance( Ci.nsIScriptableInputStream );
					fiStream.init( file, 1, 0, false );
					siStream.init( fiStream );
					data += siStream.read( -1 );
					siStream.close();

					// The JSON is stored as UTF-8, but JSON only works properly with Unicode
					var unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance( Ci.nsIScriptableUnicodeConverter );
					unicodeConverter.charset = "UTF-8";
					data = unicodeConverter.ConvertToUnicode( data );

					try {
						this.feeds = JSON.parse( data );
					} catch ( e ) {
						// Syntax error
					} finally {
						file.remove( false );
					}
				}

				PlacesUtils.bookmarks.addObserver( RSS_TICKER_FEED_MANAGER, false );

				var livemarkIDs = RSS_TICKER_FEED_MANAGER.getLivemarks();

				for ( var i = 0, _len = livemarkIDs.length; i < _len; i++ )
					RSS_TICKER_FEED_MANAGER.addLivemark( livemarkIDs[i], true );
			}, 0 );
		}
	},

	unload : function () {
		--RSS_TICKER_FEED_MANAGER.loadCount;

		if ( 0 == RSS_TICKER_FEED_MANAGER.loadCount ) {
			for ( var timerKey in this.timers )
				this.clearTimeout( timerKey );

			var data = JSON.stringify( this.feeds );

			if ( '{}' != data ) {
				var file = this.getCacheFile();

				// Store the data as UTF-8, not the Unicode that JSON outputs.
				var unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance( Ci.nsIScriptableUnicodeConverter );
				unicodeConverter.charset = "UTF-8";
				data = unicodeConverter.ConvertFromUnicode( data );

				var foStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance( Ci.nsIFileOutputStream );
				var flags = 0x02 | 0x08 | 0x20; // wronly | create | truncate
				foStream.init( file, flags, 0664, 0 );
				foStream.write( data, data.length );
				foStream.close();
			}

			this.updateIndex = 0;
			this.livemarks = [];
			this.feeds = {};

			PlacesUtils.bookmarks.removeObserver( this );
		}
	},

	setTimeout : function ( callback, interval ) {
		var timerKey = callback.name + ":" + Date.now();

		var cb = {
			notify : function () {
				callback.apply( RSS_TICKER_FEED_MANAGER, arguments );
				RSS_TICKER_FEED_MANAGER.clearTimeout( timerKey );
			}
		};

		var timer = Cc["@mozilla.org/timer;1"].createInstance( Ci.nsITimer );
		timer.initWithCallback( cb, interval, timer.TYPE_ONE_SHOT );
		RSS_TICKER_FEED_MANAGER.timers[timerKey] = timer;

		return timerKey;
	},

	setInterval : function ( callback, interval ) {
		var timerKey = callback.name + ":" + Date.now();

		var cb = {
			notify : function () {
				callback.apply( RSS_TICKER_FEED_MANAGER, arguments );
			}
		};

		var timer = Cc["@mozilla.org/timer;1"].createInstance( Ci.nsITimer );
		timer.initWithCallback( cb, interval, timer.TYPE_REPEATING_SLACK );
		RSS_TICKER_FEED_MANAGER.timers[timerKey] = timer;

		return timerKey;
	},

	clearTimeout : function ( timerKey ) {
		if ( timerKey in RSS_TICKER_FEED_MANAGER.timers ) {
			RSS_TICKER_FEED_MANAGER.timers[timerKey].cancel();
			delete RSS_TICKER_FEED_MANAGER.timers[timerKey];
		}
	},

	clearInterval : function ( timerKey ) {
		return RSS_TICKER_FEED_MANAGER.clearTimeout( timerKey );
	},

	registerView : function ( view ) {
		var viewKey = (new Date()).getTime();

		this.views[viewKey] = view;

		for ( var feedId in this.feeds )
			view.feedParsed( this.feeds[feedId] );

		this.setTimeout( function __delayFeedNotificationUntilRegistrationCompletes() {
			var notifyNoFeeds = true;

			for ( var feedId in RSS_TICKER_FEED_MANAGER.feeds ) {
				view.feedParsed( RSS_TICKER_FEED_MANAGER.feeds[feedId] );
				notifyNoFeeds = false;
			}

			if ( notifyNoFeeds )
				view.notifyNoFeeds();

			if ( RSS_TICKER_FEED_MANAGER.viewCount() == 1 )
				RSS_TICKER_FEED_MANAGER.feedFetchTimeout = RSS_TICKER_FEED_MANAGER.setTimeout( RSS_TICKER_FEED_MANAGER.updateNextFeed, 1000 * 5 );
		}, 0 );

		return viewKey;
	},

	unregisterView : function ( viewKey ) {
		delete this.views[viewKey];

		if ( RSS_TICKER_FEED_MANAGER.viewCount() == 0 )
			RSS_TICKER_FEED_MANAGER.clearTimeout( RSS_TICKER_FEED_MANAGER.feedFetchTimeout );
	},

	viewCount : function () {
		var count = 0;

		for ( var view in RSS_TICKER_FEED_MANAGER.views )
			count++;

		return count;
	},

	getCacheFile : function () {
		Cu.import( "resource://gre/modules/FileUtils.jsm" );
		
		return FileUtils.getFile( "ProfD", [ "rss-ticker.cache" ]);
	},

    getLivemarks : function () {
		//return PlacesUtils.annotations.getItemsWithAnnotation( "livemark/feedURI", {} )

		var bookmarksService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService( Ci.nsINavBookmarksService );
		var gBundle = Cc["@mozilla.org/intl/stringbundle;1"].getService( Ci.nsIStringBundleService );
		var strings = gBundle.createBundle( "chrome://rss-ticker/locale/locale.properties" );
		var folderName = strings.GetStringFromName( "extension.root" );
		var folderId = RSS_TICKER_FEED_MANAGER.findFolderId( folderName );

		var annotationService = Cc["@mozilla.org/browser/annotation-service;1"].getService( Ci.nsIAnnotationService );
		var results = annotationService.getItemsWithAnnotation( "rss-ticker/root" , {} );
			
		if (results.length == 0) {
			// Root folder doesn't exists			
			
			if (folderId == null)
				var folderId = bookmarksService.createFolder( bookmarksService.bookmarksMenuFolder, folderName, bookmarksService.DEFAULT_INDEX );
			
			annotationService.setItemAnnotation( folderId, "rss-ticker/root", "RSS Ticker Root Folder", 0, annotationService.EXPIRE_NEVER );
			rootFolderId = folderId;
		} else {
			// Duplicated root folders
			for (var i = 1; i < results.length; i++)
				annotationService.removeItemAnnotation( results[i], "rss-ticker/root" );
			
			rootFolderId = results[0];
		
			if ( rootFolderId != folderId ) {
				annotationService.removeItemAnnotation( results[0], "rss-ticker/root" );
				if (folderId == null)
					var folderId = bookmarksService.createFolder( bookmarksService.bookmarksMenuFolder, folderName, bookmarksService.DEFAULT_INDEX );
				
				annotationService.setItemAnnotation( folderId, "rss-ticker/root", "RSS Ticker Root Folder", 0, annotationService.EXPIRE_NEVER );
				rootFolderId = folderId;
			}
		}
		
		var historyService = Cc["@mozilla.org/browser/nav-history-service;1"].getService( Ci.nsINavHistoryService );
		var options = historyService.getNewQueryOptions();
		var query = historyService.getNewQuery();
		query.setFolders( [rootFolderId], 1 );
		var result = historyService.executeQuery( query, options );

		return RSS_TICKER_FEED_MANAGER.getLivemarkIds ( result.root, [] );
	},

	getLivemarkIds : function ( rootNode, livemarksIds ) {
		// iterate over the immediate children of this folder
		rootNode.containerOpen = true;
		
		var j = rootNode.childCount;
		
		for (var i = 0; i < rootNode.childCount; i ++) {
			var node = rootNode.getChild( i );
			
			var bookmarksService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService( Ci.nsINavBookmarksService );
			var livemarkService = Cc["@mozilla.org/browser/livemark-service;2"].getService( Ci.mozIAsyncLivemarks );
			var annotationService = Cc["@mozilla.org/browser/annotation-service;1"].getService( Ci.nsIAnnotationService );
			if (bookmarksService.getItemType(node.itemId) == bookmarksService.TYPE_FOLDER) {
				if (annotationService.itemHasAnnotation(node.itemId, "livemark/feedURI") || annotationService.itemHasAnnotation( node.itemId, "livemark/siteURI" )) 
					livemarksIds.push(node.itemId);
				else {
					var historyService = Cc["@mozilla.org/browser/nav-history-service;1"].getService( Ci.nsINavHistoryService );
					var options = historyService.getNewQueryOptions();
					var query = historyService.getNewQuery();
					var bookmarksService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService( Ci.nsINavBookmarksService );
					query.setFolders( [node.itemId], 1 );
					var result = historyService.executeQuery( query, options );
					livemarksIds = RSS_TICKER_FEED_MANAGER.getLivemarkIds( result.root, livemarksIds );
				}						
			}    
		}
		rootNode.containerOpen = false;
		return livemarksIds;
	},
	
	findFolderId : function ( folderName ) {
		var historyService = Cc["@mozilla.org/browser/nav-history-service;1"].getService( Ci.nsINavHistoryService );
		var options = historyService.getNewQueryOptions();
		var query = historyService.getNewQuery();

		var bookmarksService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService( Ci.nsINavBookmarksService );
		var bookmarksMenuFolder = bookmarksService.bookmarksMenuFolder;

		query.setFolders([bookmarksMenuFolder], 1);

		var result = historyService.executeQuery( query, options );
		var rootNode = result.root;
		rootNode.containerOpen = true;

		// iterate over the immediate children of this folder
		for (var i = 0; i < rootNode.childCount; i ++) {
			var node = rootNode.getChild( i );
			if ( node.title == folderName ) {
				rootNode.containerOpen = false;
				return node.itemId;
			}
		}

		// close a container after using it!
		rootNode.containerOpen = false;
		return null;
	},

	addLivemark : function ( livemarkId, startup ) {
		PlacesUtils.livemarks.getLivemark( { id : livemarkId }, function ( status, livemark ) {
			if ( Components.isSuccessCode( status ) ) {
				if ( RSS_TICKER_FEED_MANAGER.livemarks.indexOf( livemark ) < 0 ) {
					RSS_TICKER_UTILS.log( "addLivemark callback: " + livemark.feedURI.spec );

					RSS_TICKER_FEED_MANAGER.livemarks.push( livemark );

					if ( ! startup )
						RSS_TICKER_FEED_MANAGER.updateSingleFeed( livemark.feedURI.spec );
				}
			}
		} );
	},

	removeLivemark : function ( livemarkId ) {
		for ( var i = 0, _len = this.livemarks.length; i < _len; i++ ) {
			if ( livemarkId == this.livemarks[i].id ) {
				var feedGUID = this.livemarks[i].feedURI.spec;

				for ( var viewKey in this.views ) {
					this.views[viewKey].removeFeed( feedGUID );
				}

				if ( feedGUID in this.feeds )
					delete this.feeds[feedGUID];

				this.livemarks.splice( i, 1 );

				break;
			}
		}
	},

	updateNextFeed : function () {
		RSS_TICKER_UTILS.log( "updateNextFeed" );
		
		if ( this.updateIndex >= this.livemarks.length ) {
			this.updateIndex = 0;
			this.initialFetch = false;
		}

		if ( this.livemarks.length > 0 ) {
			var feedURL = this.livemarks[this.updateIndex].feedURI.spec;

			++this.updateIndex;

			this.updateSingleFeed( feedURL );
		}

		if ( RSS_TICKER_FEED_MANAGER.initialFetch ) {
			// On the initial fetch, grab a feed every 15 seconds.
			var secondsUntilNextFeedUpdated = 15;
		}
		else {
			// By default, get every feed updated within two hours.
			var secondsUntilNextFeedUpdated = 60 * ( 120 / this.livemarks.length );

			// But if there are few enough feeds, update them as often as every 8 minutes.
			if ( secondsUntilNextFeedUpdated > ( 60 * 8 ) )
			 	secondsUntilNextFeedUpdated = 60 * 8;
		}
		
		var interval = secondsUntilNextFeedUpdated * 1000;

		RSS_TICKER_FEED_MANAGER.feedFetchTimeout = RSS_TICKER_FEED_MANAGER.setTimeout( RSS_TICKER_FEED_MANAGER.updateNextFeed, interval );
	},

	updateSingleFeed : function ( feedURL ) {
		RSS_TICKER_UTILS.log( "Updating " + feedURL );
		
		var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance( Ci.nsIXMLHttpRequest );
		req.open( "GET", feedURL, true );
		req.timeout = 15000;
		req.overrideMimeType( 'text/plain; charset=x-user-defined' );
		req.onreadystatechange = function ( event ) {
			if ( req.readyState == 4 ) {
				if ( req.status == 200 ){
					RSS_TICKER_UTILS.log( "Received " + feedURL );
					
					var data = req.responseText;

					var encoding_matches = data.match( /<?xml[^>]+encoding=['"]([^"']+)["']/i ); //"

					if ( ! encoding_matches )
						encoding_matches = [ null, "UTF-8" ];

					var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter'].getService( Ci.nsIScriptableUnicodeConverter );

					try {
						converter.charset = encoding_matches[1];
						data = converter.ConvertToUnicode( data );
					} catch ( e ) {
						RSS_TICKER_UTILS.log( e );
					}

					RSS_TICKER_FEED_MANAGER.queueForParsing( data.replace( /^\s\s*/, '' ).replace( /\s\s*$/, '' ), feedURL );
				}
				else {
					RSS_TICKER_UTILS.log( "Received a status " + req.status + " for " + feedURL );
				}
			}
		};

		req.send( null );
	},

	queueForParsing : function ( feedText, feedURL ) {
		if ( feedText.length ) {
			var parser = Cc["@mozilla.org/feed-processor;1"].createInstance( Ci.nsIFeedProcessor );
			var listener = new TickerParseListener();

			try {
				parser.listener = listener;
				parser.parseFromString( feedText, PlacesUIUtils.createFixedURI( feedURL ) );
			} catch ( e ) {
				RSS_TICKER_UTILS.log( "Parse error for " + feedURL + ": " + e );
			}
		}

		return this;
	},
	
	feedParsed : function ( feed ) {
		RSS_TICKER_UTILS.log( "Feed parsed: " + feed.uri );
		
		// Set visited states.
		function markNextVisited( itemIndex ) {
			if ( itemIndex == feed.items.length ) {
				// Done. Alert the views if anything changed.
				if ( ! ( feed.uri in RSS_TICKER_FEED_MANAGER.feeds ) || ( JSON.stringify( feed ) != JSON.stringify( RSS_TICKER_FEED_MANAGER.feeds[feed.uri] ) ) ) {
					RSS_TICKER_FEED_MANAGER.feeds[feed.uri] = feed;

					for ( var viewKey in RSS_TICKER_FEED_MANAGER.views ) {
						RSS_TICKER_FEED_MANAGER.views[viewKey].feedParsed( feed );
					}
				}

				return;
			}

			PlacesUtils.asyncHistory.isURIVisited(
				PlacesUIUtils.createFixedURI( feed.items[itemIndex].url ),
				function ( uri, visited ) {
					feed.items[itemIndex].visited = visited;
					markNextVisited( itemIndex + 1 );
				}
			);
		}

		markNextVisited( 0 );
	},

	markAsRead : function ( item ) {
		// Add the URL to the browser history.
		let place = {
			uri : PlacesUIUtils.createFixedURI( item.url ),
			title : item.label,
			visits : [ { visitDate : Date.now() * 1000, transitionType : Ci.nsINavHistoryService.TRANSITION_LINK } ],
		};

		PlacesUtils.asyncHistory.updatePlaces( place, {
			handleError : function () { },
			handleResult : function () { },
			handleCompletion : function () {
				for ( var viewKey in RSS_TICKER_FEED_MANAGER.views )
					RSS_TICKER_FEED_MANAGER.views[viewKey].itemVisited( item.url, item.guid );
			}
		} );

		// Update this.feeds too so that the restart cache stays in sync
		for ( var i = 0, _len = this.feeds[item.feedGUID].items.length; i < _len; i++ ) {
			if ( this.feeds[item.feedGUID].items[i].guid == item.guid ) {
				this.feeds[item.feedGUID].items[i].visited = true;
				break;
			}
		}
	},

	notifyNoFeeds : function () {
		for ( var viewKey in RSS_TICKER_FEED_MANAGER.views )
			RSS_TICKER_FEED_MANAGER.views[viewKey].notifyNoFeeds();
	},
	
	getAllFeeds : function () {
		var feedArray = [];
		
		for ( feedKey in RSS_TICKER_FEED_MANAGER.feeds )
			feedArray.push( RSS_TICKER_FEED_MANAGER.feeds[feedKey] );
		
		return feedArray;
	},

	QueryInterface : function ( iid ) {
		if ( iid.equals( Ci.nsINavBookmarkObserver ) || iid.equals( Ci.nsISupports ) )
			return this;

		throw Cr.NS_ERROR_NO_INTERFACE;
	},

	/* nsINavBookmarksService interface */

	_nsINavBookmarksService_inBatch : false,

	onBeginUpdateBatch : function () {
		this._nsINavBookmarksService_inBatch = true;
	},

	onEndUpdateBatch : function () {
		this._nsINavBookmarksService_inBatch = false;
	},

	onItemRemoved : function ( id, folder, index ) {
		this.removeLivemark( id );
	},

	onItemChanged : function ( id, property, isAnnotationProperty, value ) {
		var livemarkIDs = RSS_TICKER_FEED_MANAGER.getLivemarks();

		for ( var i = 0, _len = livemarkIDs.length; i < _len; i++ )
			RSS_TICKER_FEED_MANAGER.addLivemark( livemarkIDs[i], false );
	},

	onItemAdded : function ( id, folder, index, type, uri, title, time, guid, parentGUID ) { },
	onItemVisited : function ( id, visitID, time ) { },
	onItemMoved : function ( id, oldParent, oldIndex, newParent, newIndex ) { },
};

function TickerParseListener() {
	return this;
}

TickerParseListener.prototype = {
	handleResult : function ( result ) {
		var resolvedUri = result.uri.resolve( "" );

		if ( ! result.bozo ) {
			var feed = result.doc;

			if ( feed ) {
				feed.QueryInterface( Ci.nsIFeed );

				// @todo Check lastBuildDate and sy:updatePeriod+sy:updateFrequency to determine the next update time.

				var feedObject = {
					uri : "",
					siteUri : "",
					label : "",
					image : "",
					items : [],
					guid : "",
				};

				feedObject.uri = resolvedUri;
				feedObject.guid = resolvedUri;

				try {
					feedObject.siteUri = feed.link.resolve( "" );
				} catch ( e ) {
					feedObject.siteUri = feedObject.uri;
				}

				feedObject.label = this.entityDecode( feed.title.plainText() );

				feedObject.image = feedObject.siteUri.substr( 0, ( feedObject.siteUri.indexOf( "/", 9 ) + 1 ) ) + "favicon.ico";

				for ( var i = 0, _len = feed.items.length; i < _len; i++ ) {
					var item = feed.items.queryElementAt( i, Ci.nsIFeedEntry );

					var itemObject = {
						url : "",
						label : "",
						description : "",
						image : "",
						guid : "",
						feedGUID : "",
					};

					itemObject.guid = item.id;
					itemObject.url = item.link.resolve( "" );
					itemObject.feedGUID = feedObject.guid;
					itemObject.displayUri = item.displayUri ? item.displayUri : itemObject.url;
					itemObject.trackingUri = item.trackingUri ? item.trackingUri : "";

					if ( ! itemObject.guid )
						itemObject.guid = itemObject.url;

					if ( itemObject.url.match( /\/~r\//i ) ) {
						// Feedburner
						itemObject.image = feedObject.siteUri.substr( 0, ( feedObject.siteUri.indexOf( "/", 9 ) + 1 ) ) + "favicon.ico";
					}
					else {
						if ( item.image )
							itemObject.image = item.image;
						else
							itemObject.image = itemObject.url.substr( 0, ( itemObject.url.indexOf( "/", 9 ) + 1 ) ) + "favicon.ico";
					}

					if ( item.title )
						itemObject.label = item.title.plainText();
					else
						itemObject.label = item.updated;

					itemObject.label = itemObject.label.replace( /\s+/, " " );

					if ( item.summary && item.summary.text )
						itemObject.description = item.summary.text;
					else if ( item.content && item.content.text )
						itemObject.description = item.content.text;
					else
						itemObject.description = "No summary.";

					itemObject.description = this.entityDecode( itemObject.description ).replace( /<[^>]+>/g, '' );

					if ( itemObject.description.length > 305 )
						itemObject.description = itemObject.description.substr( 0, itemObject.description.indexOf( ' ', 300 ) - 1 ) + '...';

					itemObject.label = this.entityDecode( itemObject.label );

					feedObject.items.push( itemObject );
				}
			}
		}

		RSS_TICKER_FEED_MANAGER.feedParsed( feedObject );
	},

	entityDecode : function ( aStr ) {
		var formatConverter = Cc["@mozilla.org/widget/htmlformatconverter;1"]
			.createInstance( Ci.nsIFormatConverter );
		var fromStr = Cc["@mozilla.org/supports-string;1"]
			.createInstance( Ci.nsISupportsString );
		fromStr.data = aStr;
		var toStr = { value: null };

		try {
			formatConverter.convert( "text/html", fromStr, fromStr.toString().length, "text/unicode", toStr, {} );
		} catch ( e ) {
			return aStr;
		}

		if ( toStr.value )
			return toStr.value.QueryInterface(Ci.nsISupportsString).toString();

		return aStr;
	}
};

var EXPORTED_SYMBOLS = ["RSS_TICKER_FEED_MANAGER"];
