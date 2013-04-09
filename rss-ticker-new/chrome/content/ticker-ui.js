// @todo When the ticker is empty, shrink it to an optimal size.
// @todo Have the context menu appear when right-clicking an empty ticker.
// @todo Ticker shrinks as items scroll.

var RSS_TICKER_UI = {
	viewKey : null,
	ticker : null,
	
	tickLength : null,
	rtl : false,
	
	load : function () {
		Application.getExtensions( function ( extensions ) {
			let extension = extensions.get( '{1f91cde0-c040-11da-a94d-0800200c9a66}' );

			if ( extension.firstRun ) {
				// Add the subscribe toolbar button, as Firefox 4 removes it.
				RSS_TICKER_UI.addToolbarButton( "feed-button" );
			}
		})

		this.ticker = document.getElementById( 'rss-ticker-item-container' );
		
		if ( ! this.ticker ) {
			// @todo Watch for browser customization.
			return;
		}
		
		this.ticker.parentNode.setAttribute( 'contextmenu', 'rss-ticker-context-menu' );
		
		this.ticker.parentNode.addEventListener( 'mouseover', function () {
			RSS_TICKER_UI.ticker.hover = true;
		}, false );
		
		this.ticker.parentNode.addEventListener( 'mouseout', function () {
			RSS_TICKER_UI.ticker.hover = false;
		}, false );
		
		document.getElementById( 'rss-ticker-context-menu' ).addEventListener( 'mouseover', function () {
			RSS_TICKER_UI.ticker.hover = true;
		}, false );
		
		document.getElementById( 'rss-ticker-context-menu' ).addEventListener( 'mouseout', function () {
			RSS_TICKER_UI.ticker.hover = false;
		}, false );
		
		this.ticker.addEventListener( 'click', function ( event ) {
			var element = event.target;
			
			if ( event.ctrlKey ) {
				// Mark as read.
				RSS_TICKER_FEED_MANAGER.markAsRead( element.itemData );
			}
			else if ( event.which != 3 ) {
				// Not a right-click.
				RSS_TICKER_UI.launchURL( element.url, event );
				RSS_TICKER_FEED_MANAGER.markAsRead( element.itemData );
			}
		}, false );
		
		window.addEventListener( 'DOMMouseScroll', function ( event ) {
			if ( document.getElementById( 'rss-ticker-item-container' ).hover ) {
				if ( event.detail > 0 ) {
					// Scroll Down
					RSS_TICKER_UI.scrollTicker( 40 );
				}
				else if ( event.detail < 0 ) {
					// Scroll Up
					RSS_TICKER_UI.scrollTicker( -40 );
				}
			}
		}, false)
		
		document.getElementById( 'rss-ticker-tooltip' ).addEventListener( 'popupshowing', function ( event ) {
			var tickerItem = document.tooltipNode;
			
			document.getElementById( 'rss-ticker-tooltip-url' ).setAttribute( 'value', tickerItem.itemData.url );
			document.getElementById( 'rss-ticker-tooltip-item-name' ).setAttribute( 'value', tickerItem.itemData.label ); 
			document.getElementById( 'rss-ticker-tooltip-image' ).setAttribute( 'src', tickerItem.getAttribute( 'image' ) );
			document.getElementById( 'rss-ticker-tooltip-feed-name' ).setAttribute( 'value', tickerItem.feedData.label );
			
			if ( tickerItem.itemData.description ) {
				var summary = document.getElementById( 'rss-ticker-tooltip-summary' );
				while ( summary.lastChild )
					summary.removeChild( summary.lastChild );
				summary.appendChild( document.createTextNode( tickerItem.itemData.description ) );
				document.getElementById( 'rss-ticker-tooltip-summary' ).style.display = '';
			}
			else {
				document.getElementById( 'rss-ticker-tooltip-summary' ).style.display = 'none';
			}
		} );
		
		document.getElementById( 'rss-ticker-context-menu' ).addEventListener( 'popupshowing', function ( event ) {
			var context = document.popupNode;
			var menuitems = this.childNodes;
			
			for ( var i = 0, _len = menuitems.length; i < _len; i++ ) {
				if ( menuitems[i].getAttribute( 'context' ) && menuitems[i].getAttribute( 'context' ) != context.nodeName )
					menuitems[i].style.display = 'none';
				else
					menuitems[i].style.display = '';
			}
		} );
		
		this.loadCommands();
		
		RSS_TICKER_UTILS.prefs.QueryInterface( Ci.nsIPrefBranch2 );
		RSS_TICKER_UTILS.prefs.addObserver( "", this, false );
		
		RSS_TICKER_UI.observe( null, "nsPref:changed", "hideWhenEmpty" );
		RSS_TICKER_UI.observe( null, "nsPref:changed", "tickSpeed" );
		RSS_TICKER_UI.observe( null, "nsPref:changed", "rtl" );
		
		this.tick();
		
		this.viewKey = RSS_TICKER_FEED_MANAGER.registerView( this );
	},
	
	unload : function () {
		RSS_TICKER_FEED_MANAGER.unregisterView( this.viewKey );
		
		RSS_TICKER_UTILS.prefs.removeObserver( "", this );
	},
	
	loadCommands : function () {
		document.getElementById( 'rss-ticker_cmd_open' ).addEventListener( 'command', function ( event ) {
			openUILink( document.popupNode.url, event );
			
			RSS_TICKER_FEED_MANAGER.markAsRead( document.popupNode.itemData );
		} );

		document.getElementById( 'rss-ticker_cmd_openInNewWindow' ).addEventListener( 'command', function ( event ) {
			openUILinkIn( document.popupNode.url, 'window' );
			
			RSS_TICKER_FEED_MANAGER.markAsRead( document.popupNode.itemData );
		} );

		document.getElementById( 'rss-ticker_cmd_openInTab' ).addEventListener( 'command', function ( event ) {
			openUILinkIn( document.popupNode.url, 'tab' );
			
			RSS_TICKER_FEED_MANAGER.markAsRead( document.popupNode.itemData ); 
		} );

		document.getElementById( 'rss-ticker_cmd_openAllInTabs' ).addEventListener( 'command', function ( event ) {
			if ( PlacesUIUtils._confirmOpenInTabs( RSS_TICKER_UI.ticker.childNodes.length, window ) ) {
				// Open all in tabs.
				var itemsToOpen = [];
				
				// Save the URLs first, since items may disappear during the opening process.
				for ( var i = 0, _len = RSS_TICKER_UI.ticker.childNodes.length; i < _len; i++ ) {
					var element = RSS_TICKER_UI.ticker.childNodes[i];
					itemsToOpen.push( element.itemData );
				}
				
				if ( PlacesUIUtils._confirmOpenInTabs( itemsToOpen.length, window ) ) {
					for ( var i = 0, _len = itemsToOpen.length; i < _len; i++ ) {
						openUILinkIn( itemsToOpen[i].url, 'tab' );
						RSS_TICKER_FEED_MANAGER.markAsRead( itemsToOpen[i] );
					}
				}
			}
		} );
		
		document.getElementById( 'rss-ticker_cmd_openFeedInTabs' ).addEventListener( 'command', function ( event ) {
			var feed = document.popupNode.feedGUID;
			
			// Open all in tabs.
			var itemsToOpen = [];
			
			// Save the URLs first, since items may disappear during the opening process.
			for ( var i = 0, _len = RSS_TICKER_UI.ticker.childNodes.length; i < _len; i++ ) {
				var element = RSS_TICKER_UI.ticker.childNodes[i];
				
				if ( feed == element.feedGUID )
					itemsToOpen.push( element.itemData );
			}
			
			if ( PlacesUIUtils._confirmOpenInTabs( itemsToOpen.length, window ) ) {
				for ( var i = 0, _len = itemsToOpen.length; i < _len; i++ ) {
					openUILinkIn( itemsToOpen[i].url, 'tab' );
					RSS_TICKER_FEED_MANAGER.markAsRead( itemsToOpen[i] );
				}
			}
		} );
		
		document.getElementById( 'rss-ticker_cmd_copyLinkTitle' ).addEventListener( 'command', function ( event ) {
			Cc["@mozilla.org/widget/clipboardhelper;1"]
				.getService( Ci.nsIClipboardHelper )
				.copyString( document.popupNode.getAttribute( 'label' ) );
		} );
		
		document.getElementById( 'rss-ticker_cmd_copyLinkURL' ).addEventListener( 'command', function ( event ) {
			Cc["@mozilla.org/widget/clipboardhelper;1"]
				.getService( Ci.nsIClipboardHelper )
				.copyString( document.popupNode.url );
		} );

		document.getElementById( 'rss-ticker_cmd_markAsRead' ).addEventListener( 'command', function ( event ) {
			RSS_TICKER_FEED_MANAGER.markAsRead( document.popupNode.itemData );
		} );

		document.getElementById( 'rss-ticker_cmd_markFeedAsRead' ).addEventListener( 'command', function ( event ) {
			var feed = document.popupNode.feedGUID;
			
			for ( var i = RSS_TICKER_UI.ticker.childNodes.length - 1; i >= 0; i-- ) {
				var element = RSS_TICKER_UI.ticker.childNodes[i];
				
				if ( feed == element.feedGUID )
					RSS_TICKER_FEED_MANAGER.markAsRead( element.itemData );
			}
		} );

		document.getElementById( 'rss-ticker_cmd_markAllAsRead' ).addEventListener( 'command', function ( event ) {
			for ( var i = RSS_TICKER_UI.ticker.childNodes.length - 1; i >= 0; i-- ) {
				var element = RSS_TICKER_UI.ticker.childNodes[i];
				RSS_TICKER_FEED_MANAGER.markAsRead( element.itemData );
			}
		} );

		document.getElementById( 'rss-ticker_cmd_options' ).addEventListener( 'command', function ( event ) {
			// @todo RSSTICKER.options();
		} );

		document.getElementById( 'rss-ticker_cmd_disableTicker' ).addEventListener( 'command', function ( event ) {
			// @todo RSSTICKER.toggleDisabled();
		} );
	},
	
	addToolbarButton : function ( buttonId ) {
		if ( document.getElementById( buttonId ) )
			return;
		
		var toolbar = document.getElementById( "nav-bar" );
			
		if ( toolbar.getAttribute( "collapsed" ) == "true" )
			return;

		toolbar.currentSet = toolbar.currentSet + ',' + buttonId;
		toolbar.setAttribute( "currentset", newSet );
		document.getElementById( "navigator-toolbox" ).ownerDocument.persist( toolbar.id, "currentset" );

		try {
			BrowserToolboxCustomizeDone(true);
		} catch ( e ) { }
	},
	
	launchURL : function ( url, event ) {
		if ( RSS_TICKER_UTILS.prefs.getBoolPref( "alwaysOpenInNewTab" ) )
			openUILinkIn( url, 'tab' )
		else
			openUILink( url, event );
	},
	
	observe : function ( subject, topic, data ) {
		if ( topic != "nsPref:changed" )
			return;
		
		switch ( data ) {
			case 'tickSpeed':
				RSS_TICKER_UI.tickLength = RSS_TICKER_UTILS.prefs.getIntPref( 'tickSpeed' ) * ( 500 / 200 ); // 200 = ticks per item
			break;
			case 'rtl':
				RSS_TICKER_UI.rtl = RSS_TICKER_UTILS.prefs.getBoolPref( 'rtl' );
			break;
			case 'hideWhenEmpty':
				if ( RSS_TICKER_UTILS.prefs.getBoolPref( 'hideWhenEmpty' ) )
					RSS_TICKER_UI.maybeHideTicker();
				else
					RSS_TICKER_UI.showTicker();
			break;
		}
	},
	
	/* RSS_TICKER_FEED_MANAGER view interface */
	
	feedParsed : function ( feed ) {
		this.writeFeed( feed );
	},
	
	itemVisited : function ( url, guid ) {
		if ( document.getElementById( 'rss-ticker-item-' + guid ) ) {
			document.getElementById( 'rss-ticker-item-container' ).removeChild( document.getElementById( 'rss-ticker-item-' + guid ) );
			
			this.maybeHideTicker();
		}
	},
	
	removeFeed : function ( feedGUID ) {
		for ( var i = RSS_TICKER_UI.ticker.childNodes.length - 1; i >= 0; i-- ) {
			var element = RSS_TICKER_UI.ticker.childNodes[i];
			
			if ( feedGUID == element.feedGUID )
				RSS_TICKER_UI.ticker.removeChild( element );
		}
		
		this.maybeHideTicker();
	},
	
	notifyNoFeeds : function () {
		if ( ! RSS_TICKER_UTILS.prefs.getBoolPref( 'noFeedsFoundFlag.1.7' ) )
			openUILinkIn( "chrome://rss-ticker/content/noFeedsFound.xul", 'tab' );
	},
	
	/* End interface */
	
	writeFeed : function ( feed ) {
		var feedItems = feed.items;

		for ( var i = 0, _len = feedItems.length; i < _len; i++ ) {
			var item = feedItems[i];
			
			if ( document.getElementById( 'rss-ticker-item-' + item.guid ) )
				continue;
			
			if ( item.visited )
				continue;
			
			var element = document.createElement( 'toolbarbutton' );
			element.id = 'rss-ticker-item-' + item.guid;
			element.guid = item.guid;
			element.url = item.url;
			element.feedGUID = feed.guid;
			
			element.itemData = item;
			element.feedData = feed;
			
			element.setAttribute( 'label', item.label );
			element.setAttribute( 'image', item.image );
			element.setAttribute( 'tooltip', 'rss-ticker-tooltip' );
			
			this.ticker.appendChild( element );
		}
		
		if ( this.ticker.firstChild )
			this.showTicker();
	},
	
	showTicker : function () {
		var tickerContainer = RSS_TICKER_UI.ticker.parentNode;
		
		tickerContainer.style.display = '';
		tickerContainer.parentNode.collapsed = false;
	},
	
	hideTickerTimer : null,
	
	maybeHideTicker : function () {
		clearTimeout( this.hideTickerTimer );
		
		this.hideTickerTimer = setTimeout( function () {
			var ticker = RSS_TICKER_UI.ticker;
			
			if ( ! ticker.firstChild && RSS_TICKER_UTILS.prefs.getBoolPref( 'hideWhenEmpty' ) ) {
				ticker.parentNode.style.display = 'none';
				
				if ( ticker.parentNode.parentNode.childNodes.length == 1 )
					ticker.parentNode.parentNode.collapsed = true;
			}
		}, 200 );
	},
	
	tick : function () {
		if ( ! RSS_TICKER_UI.ticker.hover )
			RSS_TICKER_UI.scrollTicker();
		
		setTimeout( RSS_TICKER_UI.tick, RSS_TICKER_UI.tickLength );
	},
	
	scrollTicker : function ( distance ) {
		if ( ! distance )
			distance = 1;

		var currentMargin = parseInt( this.ticker.style.marginLeft, 10 );

		if ( ! currentMargin )
			currentMargin = 0;

		if ( RSS_TICKER_UI.rtl ) {
			currentMargin += distance;
			
			if ( currentMargin > document.getElementById( 'rss-ticker-toolbar-item' ).clientWidth ) {
				this.ticker.style.marginLeft = ( this.ticker.scrollWidth * -1 ) + 'px';
			}
			else if ( currentMargin < ( this.ticker.scrollWidth * -1 ) ) {
				// Being scrolled back manually.
				this.ticker.style.marginLeft = ( document.getElementById( 'rss-ticker-toolbar-item' ).clientWidth * -1 ) + 'px';
			}
			else {
				this.ticker.style.marginLeft = currentMargin + 'px';
			}
		}
		else {
			currentMargin -= distance;
			
			if ( currentMargin < ( this.ticker.scrollWidth * -1 ) ) {
				this.ticker.style.marginLeft = document.getElementById( 'rss-ticker-toolbar-item' ).clientWidth + ( 1 - distance ) + 'px';
			}
			else if ( currentMargin > this.ticker.scrollWidth ) {
				// Being scrolled back manually.
				this.ticker.style.marginLeft = ( this.ticker.scrollWidth * -1 ) + ( currentMargin - this.ticker.scrollWidth ) + 'px';
			}
			else {
				this.ticker.style.marginLeft = currentMargin + 'px';
			}
		}
	},
};