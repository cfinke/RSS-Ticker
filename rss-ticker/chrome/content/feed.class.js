function TickerParseListener() {
	return this;
}

TickerParseListener.prototype = {
	handleResult: function(result) {
		var resolvedUri = result.uri.resolve("");
		var feedDataKey = resolvedUri.toLowerCase();
		
		if (!result.bozo) {
			var feed = result.doc;
		
			if (feed) {
				try {
					feed.QueryInterface(Components.interfaces.nsIFeed);
		
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
						feedObject.siteUri = feed.link.resolve("");
					} catch (e) {
						feedObject.siteUri = feedObject.uri;
					}
					
					var parts = feedObject.siteUri.split("/");
					
					try {
						feedObject.rootUri = parts[0] + "//" +  parts[2] + "/";
					} catch (e) {
						feedObject.rootUri = "";
					}
		
					feedObject.label = feed.title.plainText();
		
					if (!feedObject.label) {
						feedObject.label = feed.title.plainText();
					}
		
					if (feed.summary && feed.summary.text) {
						feedObject.description = feed.summary.text;//plainText();
					}
					else if (feed.content && feed.content.text) {
						feedObject.description = feed.content.text;//plainText();
					}
					else if (feed.subtitle && feed.subtitle.text) {
						feedObject.description = feed.subtitle.text;
					}
					else {
						feedObject.description = "No summary."; // TODO
					}
					
					feedObject.description = tickerEntityDecode(feedObject.description);
					feedObject.label = tickerEntityDecode(feedObject.label);
					
					feedObject.image = feedObject.siteUri.substr(0, (feedObject.siteUri.indexOf("/", 9) + 1)) + "favicon.ico";
		
					var numItems = feed.items.length;
		
					for (var i = 0; i < numItems; i++) {
						var item = feed.items.queryElementAt(i, Components.interfaces.nsIFeedEntry);
			
						var itemObject = {
							uri : "",
							published : "",
							label : "",
							description : "",
							image : "",
							id : ""
						};
			
						try {
							itemObject.id = item.id;
				
							itemObject.uri = item.link.resolve("");
							itemObject.displayUri = item.displayUri ? item.displayUri : itemObject.uri;
							
							itemObject.trackingUri = item.trackingUri ? item.trackingUri : "";
							
							/*
							if (itemObject.uri.match(/\/\/news\.google\.com\/.*\?/)){
								var q = itemObject.uri.indexOf("?");
								itemObject.uri = itemObject.uri.match(/url=(https?:\/\/.*)$/i)[1];
								itemObject.uri = decodeURIComponent(itemObject.uri.split("&")[0]);
			//					itemObject.uri = itemObject.uri.substring(0, q) + ("&" + itemObject.uri.substring(q)).replace(/&(ct|cid|ei)=[^&]* /g, "").substring(1);
							}
							*/
							
							if (!itemObject.id) itemObject.id = itemObject.uri;
				
							if (!itemObject.uri.match(/\/~r\//i)) {
								/*
								if (itemObject.uri.match(/\/\/news\.google\.com\//)){
									// Google news
									var root = itemObject.uri.match(/url=(https?:\/\/[^\/]+\/)/i)[1];
									itemObject.image = root + "favicon.ico";
									delete root;
								}
								else {
									*/
									if (item.image) {
										itemObject.image = item.image;
									}
									else {
										itemObject.image = itemObject.uri.substr(0, (itemObject.uri.indexOf("/", 9) + 1)) + "favicon.ico";
									}
									/*
								}
								*/
							}
							else {
								// Feedburner
								itemObject.image = feedObject.siteUri.substr(0, (feedObject.siteUri.indexOf("/", 9) + 1)) + "favicon.ico";
							}
							
							itemObject.published = Date.parse(item.updated);
							
							if (!itemObject.published) {
								itemObject.published = new Date().getTime();
							}
							
							if (item.title) {
								itemObject.label = item.title.plainText();
							}
							else {
								itemObject.label = item.updated;
							}
				
							itemObject.label = itemObject.label.replace(/\s+/, " ");
				
							if (item.summary && item.summary.text) {
								itemObject.description = item.summary.text;
							}
							else if (item.content && item.content.text) {
								itemObject.description = item.content.text;
							}
							else {
								itemObject.description = "No summary."; // TODO
							}
							
							itemObject.description = tickerEntityDecode(itemObject.description);
							itemObject.label = tickerEntityDecode(itemObject.label);
							
							if (item.enclosures && item.enclosures.length > 0) {
								var len = item.enclosures.length;
								var imgs = "";
					
								for (var j = 0; j < len; j++) {
									var enc = item.enclosures.queryElementAt(j, Components.interfaces.nsIWritablePropertyBag2);
						
									if (enc.hasKey("type") && enc.get("type").indexOf("image") != 0) {
										imgs += '<br /><a href="' + enc.get("url") + '">Download</a>'; // TODO
									}
									else if (enc.hasKey("url")) {
										imgs += '<br /><img src="' + enc.get("url") + '" />';
									}
								}
					
								itemObject.description = itemObject.description + imgs;
					
								delete len;
								delete imgs;
							}
				
							itemObject.description = itemObject.description.replace(/<script[^>]*>[\s\S]+<\/script>/gim, "");
				
							itemObject.visited = RSSTICKER_UTIL.history.isVisitedURL(itemObject.id, "q");
				
							feedObject.items.push(itemObject);
						} catch (e) {
							RSSTICKER_UTIL.log(e);
						}
			
						delete item;
						delete itemObject;
					}
	
					delete unread;
					delete resolvedUri;
					delete feedDataKey;
					delete feed;
					delete numItems;
					delete result;
				} catch (e) {
					RSSTICKER_UTIL.log(e);
				}
			}
		}
		
		RSSTICKER.writeFeed(feedObject);
		
		delete feedObject;
	}
};

function tickerEntityDecode(aStr) {
	var	formatConverter = Components.classes["@mozilla.org/widget/htmlformatconverter;1"].createInstance(Components.interfaces.nsIFormatConverter);
	var fromStr = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
	fromStr.data = aStr;
	var toStr = { value: null };

	try {
		formatConverter.convert("text/html", fromStr, fromStr.toString().length, "text/unicode", toStr, {});
	} catch(e) {
		return aStr;
	}
	
	if(toStr.value) {
		toStr = toStr.value.QueryInterface(Components.interfaces.nsISupportsString);
		return toStr.toString();
	}
	
	return aStr;
}
