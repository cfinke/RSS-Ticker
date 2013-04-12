// @todo When the ticker is empty, shrink it to an optimal size.

var RSS_TICKER_UI = {
	viewKey : null,
	ticker : null,
	
	tickLength : null,
	tickSmoothness : null,
	rtl : false,
	
	load : function () {
		Application.getExtensions( function ( extensions ) {
			let extension = extensions.get( '{1f91cde0-c040-11da-a94d-0800200c9a66}' );

			if ( extension.firstRun ) {
				// Add the subscribe toolbar button, as Firefox 4 removes it.
				RSS_TICKER_UI.addToolbarButton( "feed-button" );
			}
		})

		RSS_TICKER_UI.ticker = document.getElementById( 'rss-ticker-item-container' );
		
		if ( ! RSS_TICKER_UI.ticker )
			return;
		
		RSS_TICKER_UI.showTicker();
		
		RSS_TICKER_UI.ticker.parentNode.setAttribute( 'contextmenu', 'rss-ticker-context-menu' );
		
		RSS_TICKER_UI.ticker.parentNode.addEventListener( 'mouseover', RSS_TICKER_UI.events.ticker_mouseover, false );
		RSS_TICKER_UI.ticker.parentNode.addEventListener( 'mouseout', RSS_TICKER_UI.events.ticker_mouseout, false );
		document.getElementById( 'rss-ticker-context-menu' ).addEventListener( 'mouseover', RSS_TICKER_UI.events.ticker_mouseover, false );
		document.getElementById( 'rss-ticker-context-menu' ).addEventListener( 'mouseout', RSS_TICKER_UI.events.ticker_mouseout, false );
		RSS_TICKER_UI.ticker.addEventListener( 'click', RSS_TICKER_UI.events.ticker_click, false );
		window.addEventListener( 'DOMMouseScroll', RSS_TICKER_UI.events.ticker_scroll, false );
		document.getElementById( 'rss-ticker-tooltip' ).addEventListener( 'popupshowing', RSS_TICKER_UI.events.ticker_tooltip, false );
		document.getElementById( 'rss-ticker-context-menu' ).addEventListener( 'popupshowing', RSS_TICKER_UI.events.ticker_context, false );
		
		RSS_TICKER_UI.loadCommands();
		
		RSS_TICKER_UTILS.prefs.addObserver( "", this, false );
		
		RSS_TICKER_UI.observe( null, "nsPref:changed", "hideWhenEmpty" );
		RSS_TICKER_UI.observe( null, "nsPref:changed", "tickSpeed" );
		RSS_TICKER_UI.observe( null, "nsPref:changed", "ticksPerItem" );
		RSS_TICKER_UI.observe( null, "nsPref:changed", "rtl" );
		
		this.tick();
		
		this.viewKey = RSS_TICKER_FEED_MANAGER.registerView( this );
	},
	
	unload : function () {
		RSS_TICKER_FEED_MANAGER.unregisterView( this.viewKey );
		
		clearTimeout( this.tickTimeout );
		
		RSS_TICKER_UTILS.prefs.removeObserver( "", this );
		
		RSS_TICKER_UI.unloadCommands();
		
		document.getElementById( 'rss-ticker-context-menu' ).removeEventListener( 'popupshowing', RSS_TICKER_UI.events.ticker_context, false );
		document.getElementById( 'rss-ticker-tooltip' ).removeEventListener( 'popupshowing', RSS_TICKER_UI.events.ticker_tooltip, false );
		window.removeEventListener( 'DOMMouseScroll', RSS_TICKER_UI.events.ticker_scroll, false );
		RSS_TICKER_UI.ticker.removeEventListener( 'click', RSS_TICKER_UI.events.ticker_click, false );
		document.getElementById( 'rss-ticker-context-menu' ).removeEventListener( 'mouseout', RSS_TICKER_UI.events.ticker_mouseout, false );
		document.getElementById( 'rss-ticker-context-menu' ).removeEventListener( 'mouseover', RSS_TICKER_UI.events.ticker_mouseover, false );
		RSS_TICKER_UI.ticker.parentNode.removeEventListener( 'mouseout', RSS_TICKER_UI.events.ticker_mouseout, false );
		RSS_TICKER_UI.ticker.parentNode.removeEventListener( 'mouseover', RSS_TICKER_UI.events.ticker_mouseover, false );
		
		RSS_TICKER_UI.ticker = null;
	},
	
	beforeCustomization : function () {
		if ( document.getElementById( 'rss-ticker-toolbar-item' ) )
			document.getElementById( 'rss-ticker-toolbar-item' ).setAttribute( 'customizing', 'true' );
	},
	
	afterCustomization : function () {
		if ( document.getElementById( 'rss-ticker-toolbar-item' ) )
			document.getElementById( 'rss-ticker-toolbar-item' ).removeAttribute( 'customizing' );

		if ( ! RSS_TICKER_UI.ticker && document.getElementById( 'rss-ticker-toolbar-item' ) )
			RSS_TICKER_UI.load();
		else if ( RSS_TICKER_UI.ticker && ! document.getElementById( 'rss-ticker-toolbar-item' ) )
			RSS_TICKER_UI.unload();
	},
	
	events : {
		ticker_click : function ( event ) {
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
		},
	
		ticker_mouseover : function () {
			RSS_TICKER_UI.ticker.hover = true;
		},
	
		ticker_mouseout : function () {
			RSS_TICKER_UI.ticker.hover = false;
		},
	
		ticker_scroll : function ( event ) {
			if ( RSS_TICKER_UI.ticker.hover ) {
				if ( event.detail > 0 ) {
					// Scroll Down
					RSS_TICKER_UI.scrollTicker( 40 );
				}
				else if ( event.detail < 0 ) {
					// Scroll Up
					RSS_TICKER_UI.scrollTicker( -40 );
				}
			}
		},
	
		ticker_tooltip : function ( event ) {
			if ( document.popupNode ) {
				// Don't show the tooltip when the context menu is open.
				event.preventDefault();
				event.stopPropagation();
				return false;
			}
		
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
		},
	
		ticker_context : function ( event ) {
			var context = document.popupNode;
			var menuitems = this.childNodes;
		
			for ( var i = 0, _len = menuitems.length; i < _len; i++ ) {
				if ( menuitems[i].getAttribute( 'context' ) && menuitems[i].getAttribute( 'context' ) != context.nodeName )
					menuitems[i].style.display = 'none';
				else
					menuitems[i].style.display = '';
			}
		},
	},
	
	commands : {
		'rss-ticker_cmd_open' : function ( event ) {
			openUILink( document.popupNode.url, event );
			
			RSS_TICKER_FEED_MANAGER.markAsRead( document.popupNode.itemData );
		},
		
		'rss-ticker_cmd_openInNewWindow' : function ( event ) {
			openUILinkIn( document.popupNode.url, 'window' );
			
			RSS_TICKER_FEED_MANAGER.markAsRead( document.popupNode.itemData );
		},
		
		'rss-ticker_cmd_openInTab' : function ( event ) {
			openUILinkIn( document.popupNode.url, 'tab' );
			
			RSS_TICKER_FEED_MANAGER.markAsRead( document.popupNode.itemData ); 
		},
		
		'rss-ticker_cmd_openAllInTabs' : function ( event ) {
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
		},
		
		'rss-ticker_cmd_openFeedInTabs' : function ( event ) {
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
		},
		
		'rss-ticker_cmd_copyLinkTitle' : function ( event ) {
			Cc["@mozilla.org/widget/clipboardhelper;1"]
				.getService( Ci.nsIClipboardHelper )
				.copyString( document.popupNode.getAttribute( 'label' ) );
		},
		
		'rss-ticker_cmd_copyLinkURL' : function ( event ) {
			Cc["@mozilla.org/widget/clipboardhelper;1"]
				.getService( Ci.nsIClipboardHelper )
				.copyString( document.popupNode.url );
		},
		
		'rss-ticker_cmd_markAsRead' : function ( event ) {
			RSS_TICKER_FEED_MANAGER.markAsRead( document.popupNode.itemData );
		},
		
		'rss-ticker_cmd_markFeedAsRead' : function ( event ) {
			var feed = document.popupNode.feedGUID;
			
			for ( var i = RSS_TICKER_UI.ticker.childNodes.length - 1; i >= 0; i-- ) {
				var element = RSS_TICKER_UI.ticker.childNodes[i];
				
				if ( feed == element.feedGUID )
					RSS_TICKER_FEED_MANAGER.markAsRead( element.itemData );
			}
		},
		
		'rss-ticker_cmd_markAllAsRead' : function ( event ) {
			for ( var i = RSS_TICKER_UI.ticker.childNodes.length - 1; i >= 0; i-- ) {
				var element = RSS_TICKER_UI.ticker.childNodes[i];
				RSS_TICKER_FEED_MANAGER.markAsRead( element.itemData );
			}
		},
		
		'rss-ticker_cmd_disableTicker' : function ( event ) {
			// @todo RSSTICKER.toggleDisabled();
		},
	},
	
	loadCommands : function () {
		for ( var commandId in RSS_TICKER_UI.commands )
			document.getElementById( commandId ).addEventListener( 'command', RSS_TICKER_UI.commands[commandId], false );
	},
	
	unloadCommands : function () {
		for ( var commandId in RSS_TICKER_UI.commands )
			document.getElementById( commandId ).removeEventListener( 'command', RSS_TICKER_UI.commands[commandId], false );
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
				if ( RSS_TICKER_UTILS.prefs.getIntPref( 'tickSpeed' ) < 1 ) {
					RSS_TICKER_UTILS.prefs.setIntPref( 'tickSpeed', 1 );
					return;
				}
			case 'ticksPerItem':
				RSS_TICKER_UI.tickSmoothness = RSS_TICKER_UTILS.prefs.getIntPref( 'ticksPerItem' );
				
				if ( RSS_TICKER_UI.tickSmoothness > 200 ) {
					RSS_TICKER_UTILS.prefs.setIntPref( 'ticksPerItem', 200 );
					return;
				}
				
				RSS_TICKER_UI.tickLength = RSS_TICKER_UTILS.prefs.getIntPref( 'tickSpeed' ) * ( 500 / RSS_TICKER_UI.tickSmoothness );
				
				// In the case that a very slow speed has been changed to a very fast speed, then
				// it may not be immediately apparent that the option has taken, since it doesn't
				// come into effect until the next tick.
				RSS_TICKER_UI.tick();
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
			case 'width':
				if ( RSS_TICKER_UI.ticker.parentNode.parentNode.childNodes.length > 1 ) {
					RSS_TICKER_UI.ticker.parentNode.setAttribute( 'width', RSS_TICKER_UTILS.prefs.getIntPref( 'width' ) );
				}
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
			
			RSS_TICKER_UI.ticker.appendChild( element );
		}
		
		if ( RSS_TICKER_UI.ticker.firstChild )
			this.showTicker();
	},
	
	showTicker : function () {
		var tickerContainer = RSS_TICKER_UI.ticker.parentNode;
		
		tickerContainer.style.display = '';
		tickerContainer.parentNode.collapsed = false;
		
		if ( tickerContainer.parentNode.childNodes.length == 1 ) {
			tickerContainer.removeAttribute( 'width' );
			tickerContainer.setAttribute( 'flex', '1' );
		}
		else {
			tickerContainer.removeAttribute( 'flex' );
			tickerContainer.setAttribute( 'width', RSS_TICKER_UTILS.prefs.getIntPref( 'width' ) );
		}
	},
	
	hideTickerTimer : null,
	
	maybeHideTicker : function () {
		clearTimeout( this.hideTickerTimer );
		
		this.hideTickerTimer = setTimeout( function () {
			var ticker = RSS_TICKER_UI.ticker;
			
			if ( ! ticker.firstChild && RSS_TICKER_UTILS.prefs.getBoolPref( 'hideWhenEmpty' ) ) {
				ticker.parentNode.setAttribute( 'width', '0' );
				ticker.parentNode.style.display = 'none';
				
				if ( ticker.parentNode.parentNode.childNodes.length == 1 )
					ticker.parentNode.parentNode.collapsed = true;
			}
		}, 200 );
	},
	
	tickTimeout : null,
	
	tick : function () {
		clearTimeout( this.tickTimeout );
		
		if ( RSS_TICKER_UI.ticker ) {
			if ( ! RSS_TICKER_UI.ticker.hover )
				RSS_TICKER_UI.scrollTicker();
		
			this.tickTimeout = setTimeout( RSS_TICKER_UI.tick, RSS_TICKER_UI.tickLength );
		}
	},
	
	scrollTicker : function ( distance ) {
		if ( ! distance )
			distance = 200 / RSS_TICKER_UI.tickSmoothness;
			
		if ( distance < 1 )
			distance = 1;

		var currentMargin = parseInt( RSS_TICKER_UI.ticker.style.marginLeft, 10 );

		if ( ! currentMargin )
			currentMargin = 0;

		if ( RSS_TICKER_UI.rtl ) {
			currentMargin += distance;
			
			if ( currentMargin > document.getElementById( 'rss-ticker-toolbar-item' ).clientWidth ) {
				RSS_TICKER_UI.ticker.style.marginLeft = ( RSS_TICKER_UI.ticker.scrollWidth * -1 ) + 'px';
			}
			else if ( currentMargin < ( RSS_TICKER_UI.ticker.scrollWidth * -1 ) ) {
				// Being scrolled back manually.
				RSS_TICKER_UI.ticker.style.marginLeft = ( document.getElementById( 'rss-ticker-toolbar-item' ).clientWidth * -1 ) + 'px';
			}
			else {
				RSS_TICKER_UI.ticker.style.marginLeft = currentMargin + 'px';
			}
		}
		else {
			currentMargin -= distance;
			
			if ( currentMargin < ( RSS_TICKER_UI.ticker.scrollWidth * -1 ) ) {
				RSS_TICKER_UI.ticker.style.marginLeft = document.getElementById( 'rss-ticker-toolbar-item' ).clientWidth + ( 1 - distance ) + 'px';
			}
			else if ( currentMargin > RSS_TICKER_UI.ticker.scrollWidth ) {
				// Being scrolled back manually.
				RSS_TICKER_UI.ticker.style.marginLeft = ( RSS_TICKER_UI.ticker.scrollWidth * -1 ) + ( currentMargin - RSS_TICKER_UI.ticker.scrollWidth ) + 'px';
			}
			else {
				RSS_TICKER_UI.ticker.style.marginLeft = currentMargin + 'px';
			}
		}
	},
};