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

	timers : {},

	load : function () {
		++RSS_TICKER_FEED_MANAGER.loadCount;

		if ( 1 == RSS_TICKER_FEED_MANAGER.loadCount ) {
			RSS_TICKER_FEED_MANAGER.setTimeout( function __delayedStartup() {
				Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
					.getService( Ci.nsINavBookmarksService )
					.addObserver( RSS_TICKER_FEED_MANAGER, false );

				var livemarkIDs = PlacesUtils.annotations.getItemsWithAnnotation( "livemark/feedURI", {} );

				for ( var i = 0, _len = livemarkIDs.length; i < _len; i++ )
					RSS_TICKER_FEED_MANAGER.addLivemark( livemarkIDs[i] );

				RSS_TICKER_FEED_MANAGER.setTimeout( RSS_TICKER_FEED_MANAGER.updateNextFeed, 1000 * 15 );
				RSS_TICKER_FEED_MANAGER.setInterval( RSS_TICKER_FEED_MANAGER.updateNextFeed, 1000 * 60 * 5 );
			}, 8000 );
		}
	},

	unload : function () {
		--RSS_TICKER_FEED_MANAGER.loadCount;

		if ( 0 == RSS_TICKER_FEED_MANAGER.loadCount ) {
			Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
				.getService( Ci.nsINavBookmarksService )
				.removeObserver( RSS_TICKER_FEED_MANAGER );
		}
	},

	setTimeout : function ( callback, interval ) {
		var cb = {
			notify : function () {
				callback.apply( RSS_TICKER_FEED_MANAGER, arguments );
				RSS_TICKER_FEED_MANAGER.clearTimeout( callback.name );
			}
		};

		var timer = Cc["@mozilla.org/timer;1"].createInstance( Ci.nsITimer );
		timer.initWithCallback( cb, interval, timer.TYPE_ONE_SHOT );
		RSS_TICKER_FEED_MANAGER.timers[callback.name] = timer;

		return callback.name;
	},

	setInterval : function ( callback, interval ) {
		var cb = {
			notify : function () {
				callback.apply( RSS_TICKER_FEED_MANAGER, arguments );
			}
		};

		var timer = Cc["@mozilla.org/timer;1"].createInstance( Ci.nsITimer );
		timer.initWithCallback( cb, interval, timer.TYPE_REPEATING_SLACK );
		RSS_TICKER_FEED_MANAGER.timers[callback.name] = timer;

		return callback.name;
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

	addLivemark : function ( livemark ) {
		PlacesUtils.livemarks.getLivemark( { id : livemark }, function ( status, livemark ) {
			if ( Components.isSuccessCode( status ) ) {
				RSS_TICKER_FEED_MANAGER.livemarks.push( livemark );
			}
		} );
	},

	removeLivemark : function ( livemarkId ) {
		for ( var i = 0, _len = this.livemarks.length; i < _len; i++ ) {
			if ( livemarkId == this.livemarks[i].id ) {
				this.livemarks.splice( i, 1 );
				break;
			}
		}
	},

	updateNextFeed : function () {
		if ( 0 == this.livemarks.length )
			return;

		if ( this.updateIndex >= this.livemarks.length )
			this.updateIndex = 0;

		var feedURL = this.livemarks[this.updateIndex].feedURI.spec;

		++this.updateIndex;

		var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance( Ci.nsIXMLHttpRequest );
		req.open( "GET", feedURL, true );
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
		if ( feedText.length ) {
			var parser = Cc["@mozilla.org/feed-processor;1"].createInstance( Ci.nsIFeedProcessor );
			var listener = new TickerParseListener();

			try {
				parser.listener = listener;
				parser.parseFromString( feedText, PlacesUtils._uri( feedURL, null, null ) );
			} catch ( e ) {
				this.log( "Parse error for " + feedURL + ": " + e );
			}
		}

		return this;
	},

	feedParsed : function ( feed ) {
		this.log( "Finished feed parsing: " + feed );
	},

	log : function () {
		for ( var i = 0, _len = arguments.length; i < _len; i++ ) {
			var message = arguments[i];

			if ( typeof message !== 'string' ) {
				try {
					message = JSON.stringify( message );
				} catch ( e ) {
					this.log( 'Exception in logging.' );
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
		this.log( 'onBeginUpdateBatch', arguments );

		// This method is notified when a batch of changes are about to occur.
		// Observers can use this to suspend updates to the user-interface, for example
		// while a batch change is occurring.

		this._nsINavBookmarksService_inBatch = true;
	},

	onEndUpdateBatch : function () {
		this.log( 'onEndUpdateBatch', arguments );
		this._nsINavBookmarksService_inBatch = false;
	},

	onItemAdded : function ( id, folder, index, type, uri, title, time, guid, parentGUID ) { },

	onBeforeItemRemoved : function ( id, type, folder, guid, parentGUID ) { },

	onItemRemoved : function ( id, folder, index ) {
		this.log( 'onItemRemoved', arguments );

		this.removeLivemark( id );
	},

	onItemChanged : function ( id, property, isAnnotationProperty, value ) {
		this.log( 'onItemChanged', arguments );

		if ( property == "livemark/feedURI" )
			this.addLivemark( id );
	},

	onItemVisited : function ( id, visitID, time ) {
		this.log( 'onItemVisited', arguments );

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
		var feedDataKey = resolvedUri.toLowerCase();

		if ( ! result.bozo ) {
			var feed = result.doc;

			if ( feed ) {
				try {
					feed.QueryInterface( Components.interfaces.nsIFeed );

					var feedObject = {
						label : "",
						image : "",
						description : "",
						uri : "",
						siteUri : "",
						items : [],
						id : "",
						rootUri : ""
					};

					feedObject.id = resolvedUri;
					feedObject.uri = resolvedUri;

					try {
						feedObject.siteUri = feed.link.resolve( "" );
					} catch ( e ) {
						feedObject.siteUri = feedObject.uri;
					}

					var parts = feedObject.siteUri.split( "/" );

					try {
						feedObject.rootUri = parts[0] + "//" +  parts[2] + "/";
					} catch ( e ) {
						feedObject.rootUri = "";
					}

					feedObject.label = feed.title.plainText();

					if ( ! feedObject.label ) {
						feedObject.label = feed.title.plainText();
					}

					if ( feed.summary && feed.summary.text ) {
						feedObject.description = feed.summary.text;
					}
					else if ( feed.content && feed.content.text ) {
						feedObject.description = feed.content.text;
					}
					else if ( feed.subtitle && feed.subtitle.text ) {
						feedObject.description = feed.subtitle.text;
					}
					else {
						feedObject.description = "No summary.";
					}

					feedObject.description = tickerEntityDecode( feedObject.description );
					feedObject.label = tickerEntityDecode( feedObject.label );
					feedObject.image = feedObject.siteUri.substr( 0, ( feedObject.siteUri.indexOf( "/", 9 ) + 1 ) ) + "favicon.ico";

					for ( var i = 0, _len = feed.items.length; i < _len; i++ ) {
						var item = feed.items.queryElementAt( i, Components.interfaces.nsIFeedEntry );

						var itemObject = {
							uri : "",
							published : "",
							label : "",
							description : "",
							image : "",
							id : "",
						};

						try {
							itemObject.id = item.id;
							itemObject.uri = item.link.resolve( "" );
							itemObject.displayUri = item.displayUri ? item.displayUri : itemObject.uri;

							itemObject.trackingUri = item.trackingUri ? item.trackingUri : "";

							if ( ! itemObject.id )
								itemObject.id = itemObject.uri;

							if ( ! itemObject.uri.match( /\/~r\//i ) ) {
								if ( item.image )
									itemObject.image = item.image;
								else
									itemObject.image = itemObject.uri.substr( 0, ( itemObject.uri.indexOf( "/", 9 ) + 1 ) ) + "favicon.ico";
							}
							else {
								// Feedburner
								itemObject.image = feedObject.siteUri.substr( 0, ( feedObject.siteUri.indexOf( "/", 9 ) + 1 ) ) + "favicon.ico";
							}

							itemObject.published = Date.parse( item.updated );

							if ( ! itemObject.published )
								itemObject.published = new Date().getTime();

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

							itemObject.description = this.entityDecode( itemObject.description );
							itemObject.label = this.entityDecode( itemObject.label );

							if ( item.enclosures && item.enclosures.length > 0 ) {
								for ( var j = 0, _len = item.enclosures.length; j < _len; j++ ) {
									var enc = item.enclosures.queryElementAt( j, Components.interfaces.nsIWritablePropertyBag2 );

									if ( enc.hasKey( "type" ) && enc.get( "type" ).indexOf( "image" ) != 0 )
										itemObject.description += '<br /><a href="' + enc.get("url") + '">Download</a>';
									else if ( enc.hasKey( "url" ) )
										itemObject.description += '<br /><img src="' + enc.get("url") + '" />';
								}
							}

							itemObject.description = itemObject.description.replace( /<script[^>]*>[\s\S]+<\/script>/gim, "" );

							feedObject.items.push(itemObject);
						} catch ( e ) {
							RSS_TICKER_FEED_MANAGER.log(e);
						}

						item = null;
						itemObject = null;
					}

					resolvedUri = null;
					feedDataKey = null;
					feed = null;
					result = null;
				} catch (e) {
					RSS_TICKER_FEED_MANAGER.log( e );
				}
			}
		}

		RSS_TICKER_FEED_MANAGER.feedParsed( feedObject );
		feedObject = null;
	},

	entityDecode : function ( aStr ) {
		var formatConverter = Components.classes["@mozilla.org/widget/htmlformatconverter;1"]
			.createInstance( Components.interfaces.nsIFormatConverter );
		var fromStr = Components.classes["@mozilla.org/supports-string;1"]
			.createInstance( Components.interfaces.nsISupportsString );
		fromStr.data = aStr;
		var toStr = { value: null };

		try {
			formatConverter.convert( "text/html", fromStr, fromStr.toString().length, "text/unicode", toStr, {} );
		} catch ( e ) {
			return aStr;
		}

		if ( toStr.value )
			return toStr.value.QueryInterface(Components.interfaces.nsISupportsString).toString();

		return aStr;
	}
};

var EXPORTED_SYMBOLS = ["RSS_TICKER_FEED_MANAGER"];