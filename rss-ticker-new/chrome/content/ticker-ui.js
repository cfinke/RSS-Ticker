var RSS_TICKER_UI = {
	viewKey : null,
	
	load : function () {
		var ticker = document.getElementById( 'rss-ticker-item-container' );
		
		ticker.addEventListener( 'mouseover', function () {
			this.hover = true;
		}, false );
		
		ticker.addEventListener( 'mouseout', function () {
			this.hover = false;
		}, false );
		
		ticker.addEventListener( 'click', function ( event ) {
			if ( event.target.nodeName != 'toolbarbutton' )
				return;
			
			var element = event.target;
			
			if ( event.ctrlKey ) {
				// Mark as read.
				RSS_TICKER_FEED_MANAGER.markAsRead( element.url, element.guid );
			}
			else if ( event.which != 3 ) {
				// Not a right-click.
				if (event.which == 4 || event.shiftKey){
					// Shift
					window.open( element.url );
				}
				else {
					// Left-click
					RSS_TICKER_UI.launchUrl( element.url, event );
					RSS_TICKER_FEED_MANAGER.markAsRead( element.url, element.guid );
				}
			}
		}, false );
		
		this.tick();
		
		this.viewKey = RSS_TICKER_FEED_MANAGER.registerView( this );
	},
	
	unload : function () {
		RSS_TICKER_FEED_MANAGER.unregisterView( this.viewKey );
	},
	
	launchUrl : function ( url, event ) {
		if ( RSS_TICKER_UTILS.prefs.getBoolPref( "alwaysOpenInNewTab" ) || ( event.which == 2 ) || ( event.which == 1 && ( event.ctrlKey || event.metaKey ) && ( event.ctrlKey || event.metaKey ) ) )
			this._addTab( url );
		else if ( event.which == 1 || ( event.which == 13 && ! event.shiftKey ) )
			this._inTab( url );
		else if ( event.which == 4 || ( event.which == 13 && event.shiftKey ) )
			window.open( url );
	},
	
	_addTab : function ( url ) {
		var browser = gBrowser;
		var theTab = browser.addTab( url );
		
		var loadInBackground = false;
			
		try {
			loadInBackground = Cc["@mozilla.org/preferences-service;1"]
				.getService( Ci.nsIPrefBranch )
				.getBoolPref( "browser.tabs.loadInBackground" );
		} catch (e) { }
		
		if ( ! loadInBackground )
			browser.selectedTab = theTab;
	},
	
	_inTab : function ( url ) {
		content.document.location.href = url;
	},
	
	/* RSS_TICKER_FEED_MANAGER view interface */
	
	feedParsed : function ( feed ) {
		this.writeFeed( feed );
	},
	
	itemVisited : function ( url, guid ) {
		if ( document.getElementById( 'rss-ticker-item-' + guid ) )
			document.getElementById( 'rss-ticker-item-container' ).removeChild( document.getElementById( 'rss-ticker-item-' + guid ) );
		
		RSS_TICKER_FEED_MANAGER.log( "Front-end visit: " + url + " " + guid );
	},
	
	/* End interface */
	
	writeFeed : function ( feed ) {
		var feedItems = feed.items,
			ticker = document.getElementById( 'rss-ticker-item-container' );

		if ( ! ticker )
			return;

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
			element.setAttribute( 'label', item.label );
			element.setAttribute( 'image', item.image );
			
			ticker.appendChild( element );
		}
	},
	
	tick : function () {
		var ticker = document.getElementById( 'rss-ticker-item-container' );
		
		if ( ticker && ! ticker.hover ) {
			// Animation!
			var currentMargin = parseInt( ticker.style.marginLeft, 10 );
			
			if ( ! currentMargin )
				currentMargin = 0;
			
			if ( currentMargin < ( ticker.scrollWidth * -1 ) ) {
				ticker.style.marginLeft = document.getElementById( 'rss-ticker-toolbar-item' ).scrollWidth + 'px';
			}
			else {
				ticker.style.marginLeft = currentMargin - 1 + 'px';
			}
		}
		
		setTimeout( RSS_TICKER_UI.tick, 50 );
	}
};