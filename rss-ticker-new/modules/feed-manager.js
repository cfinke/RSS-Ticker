var Ci = Components.interfaces,
	Cc = Components.classes,
	Cr = Components.results,
	Cu = Components.utils;

Cu.import("resource://gre/modules/PlacesUtils.jsm");

var RSS_TICKER_FEED_MANAGER = {
	loadCount : 0,
	updateIndex : 0,
	livemarks : [],
	feeds : {},
	views : {},
	
	timers : {},

	initialFetch : true,
	
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
				
				Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
					.getService( Ci.nsINavBookmarksService )
					.addObserver( RSS_TICKER_FEED_MANAGER, false );

				var livemarkIDs = PlacesUtils.annotations.getItemsWithAnnotation( "livemark/feedURI", {} );

				for ( var i = 0, _len = livemarkIDs.length; i < _len; i++ )
					RSS_TICKER_FEED_MANAGER.addLivemark( livemarkIDs[i] );

				RSS_TICKER_FEED_MANAGER.setTimeout( RSS_TICKER_FEED_MANAGER.updateNextFeed, 1000 * 5 );
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
			
			Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
				.getService( Ci.nsINavBookmarksService )
				.removeObserver( this );
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
		}, 0 );
		
		return viewKey;
	},
	
	unregisterView : function ( viewKey ) {
		delete this.views[viewKey];
	},
	
	getCacheFile : function () {
		var file = Cc['@mozilla.org/file/directory_service;1'].getService( Ci.nsIProperties ).get( 'ProfD', Ci.nsIFile );
		file.append( "rss-ticker.cache" );
		
		return file;
	},

	addLivemark : function ( livemark ) {
		PlacesUtils.livemarks.getLivemark( { id : livemark }, function ( status, livemark ) {
			if ( Components.isSuccessCode( status ) ) {
				RSS_TICKER_FEED_MANAGER.livemarks.push( livemark );
				
				RSS_TICKER_FEED_MANAGER.updateSingleFeed( livemark.feedURI.spec );
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
				
				delete this.feeds[feedGUID];
				
				this.livemarks.splice( i, 1 );
				
				break;
			}
		}
	},

	updateNextFeed : function () {
		RSS_TICKER_FEED_MANAGER.log( "updateNextFeed" );
		
		if ( this.updateIndex >= this.livemarks.length ) {
			this.updateIndex = 0;
			this.initialFetch = false;
			RSS_TICKER_FEED_MANAGER.log( "Not initial fetch" );
		}

		if ( this.livemarks.length > 0 ) {
			var feedURL = this.livemarks[this.updateIndex].feedURI.spec;

			++this.updateIndex;
		
			this.updateSingleFeed( feedURL );
		}
		
		var interval = 1000 * 60 * 5;
	
		if ( RSS_TICKER_FEED_MANAGER.initialFetch )
			interval = 1000 * 5;
		
		RSS_TICKER_FEED_MANAGER.setTimeout( RSS_TICKER_FEED_MANAGER.updateNextFeed, interval );
	},
	
	updateSingleFeed : function ( feedURL ) {
		var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance( Ci.nsIXMLHttpRequest );
		req.open( "GET", feedURL, true );
		req.timeout = 15000;
		req.overrideMimeType( 'text/plain; charset=x-user-defined' );
		req.onreadystatechange = function ( event ) {
			if ( req.readyState == 4 ) {
				if ( req.status == 200 ){
					var data = req.responseText;

					var encoding_matches = data.match( /<?xml[^>]+encoding=['"]([^"']+)["']/i ); //"

					if ( ! encoding_matches )
						encoding_matches = [ null, "UTF-8" ];

					var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter'].getService( Ci.nsIScriptableUnicodeConverter );

					try {
						converter.charset = encoding_matches[1];
						data = converter.ConvertToUnicode( data );
					} catch ( e ) {
						RSS_TICKER_FEED_MANAGER.log( e );
					}

					RSS_TICKER_FEED_MANAGER.queueForParsing( data.replace( /^\s\s*/, '' ).replace( /\s\s*$/, '' ), feedURL );
				}
				else {
					RSS_TICKER_FEED_MANAGER.log( "Received a status " + req.status + " for " + feedURL );
				}
			}
		};
		
		req.send( null );
	},

	queueForParsing : function ( feedText, feedURL ) {
		RSS_TICKER_FEED_MANAGER.log( "queueForParsing" );
		if ( feedText.length ) {
			var parser = Cc["@mozilla.org/feed-processor;1"].createInstance( Ci.nsIFeedProcessor );
			var listener = new TickerParseListener();

			try {
				parser.listener = listener;
				parser.parseFromString( feedText, PlacesUtils._uri( feedURL, null, null ) );
			} catch ( e ) {
				RSS_TICKER_FEED_MANAGER.log( "Parse error for " + feedURL + ": " + e );
			}
		}

		return this;
	},

	feedParsed : function ( feed ) {
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
			
			Cc["@mozilla.org/browser/history;1"].getService( Ci.mozIAsyncHistory ).isURIVisited(
				PlacesUtils._uri( feed.items[itemIndex].url, null, null ),
				function ( uri, visited ) {
					feed.items[itemIndex].visited = visited;
					markNextVisited( itemIndex + 1 );
				}
			);
		}
		
		markNextVisited( 0 );
	},
	
	markAsRead : function ( url, guid ) {
		// @todo Update this.feeds too so that the restart cache stays in sync
		RSS_TICKER_FEED_MANAGER.log( "GUID: " + guid );
		
		let place = {
			uri : PlacesUtils._uri( url, null, null ),
			title : url,
			visits : [ { visitDate : Date.now() * 1000, transitionType : Ci.nsINavHistoryService.TRANSITION_LINK } ],
		};
		
		RSS_TICKER_FEED_MANAGER.log( place );
		
		Cc["@mozilla.org/browser/history;1"]
			.getService( Ci.mozIAsyncHistory )
			.updatePlaces( place, {
				handleError : function () { },
				handleResult : function () { },
				handleCompletion : function () {
					for ( var viewKey in RSS_TICKER_FEED_MANAGER.views ) {
						RSS_TICKER_FEED_MANAGER.views[viewKey].itemVisited( url, guid );
					}
				}
			} );
	},
	
	notifyNoFeeds : function () {
		for ( var viewKey in RSS_TICKER_FEED_MANAGER.views ) {
			RSS_TICKER_FEED_MANAGER.views[viewKey].notifyNoFeeds();
		}
	},

	log : function () {
		for ( var i = 0, _len = arguments.length; i < _len; i++ ) {
			var message = arguments[i];

			if ( typeof message !== 'string' ) {
				try {
					message = JSON.stringify( message );
				} catch ( e ) {
					RSS_TICKER_FEED_MANAGER.log( 'Exception in logging.' );
					continue;
				}
			}

			Cc["@mozilla.org/consoleservice;1"]
				.getService(Ci.nsIConsoleService)
				.logStringMessage( "RSSTICKER: " + message );
		}
	},

	QueryInterface : function ( iid ) {
		if ( iid.equals( Ci.nsINavBookmarkObserver ) || iid.equals( Ci.nsISupports ) )
			return this;

		throw Cr.NS_ERROR_NO_INTERFACE;
	},

	/* nsINavBookmarksService interface */

	_nsINavBookmarksService_inBatch : false,

	onBeginUpdateBatch : function () {
		RSS_TICKER_FEED_MANAGER.log( 'onBeginUpdateBatch', arguments );

		// This method is notified when a batch of changes are about to occur.
		// Observers can use this to suspend updates to the user-interface, for example
		// while a batch change is occurring.

		this._nsINavBookmarksService_inBatch = true;
	},

	onEndUpdateBatch : function () {
		RSS_TICKER_FEED_MANAGER.log( 'onEndUpdateBatch', arguments );
		this._nsINavBookmarksService_inBatch = false;
	},

	onItemAdded : function ( id, folder, index, type, uri, title, time, guid, parentGUID ) { },

	onBeforeItemRemoved : function ( id, type, folder, guid, parentGUID ) { },

	onItemRemoved : function ( id, folder, index ) {
		RSS_TICKER_FEED_MANAGER.log( 'onItemRemoved', arguments );
		
		this.removeLivemark( id );
	},

	onItemChanged : function ( id, property, isAnnotationProperty, value ) {
		RSS_TICKER_FEED_MANAGER.log( 'onItemChanged', arguments );

		if ( property == "livemark/feedURI" )
			this.addLivemark( id );
	},

	onItemVisited : function ( id, visitID, time ) {
		RSS_TICKER_FEED_MANAGER.log( 'onItemVisited', arguments );

		// The visit id can be used with the History service to access other properties of the visit.
		// The time is the time at which the visit occurred, in microseconds.
	},

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
					};

					itemObject.guid = item.id;
					itemObject.url = item.link.resolve( "" );
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