var RSS_TICKER_UI = {
	viewKey : null,
	
	load : function () {
		this.viewKey = RSS_TICKER_FEED_MANAGER.registerView( this );
	},
	
	unload : function () {
		RSS_TICKER_FEED_MANAGER.unregisterView( this.viewKey );
	},
	
	feedParsed : function ( feed ) {
		RSS_TICKER_FEED_MANAGER.log( "Feed parsed and sent to view: " + JSON.stringify( feed ) );
	}
};