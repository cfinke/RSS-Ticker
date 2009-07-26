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
				
							if (itemObject.uri.match(/\/\/news\.google\.com\/.*\?/)){
								var q = itemObject.uri.indexOf("?");
								itemObject.uri = itemObject.uri.match(/url=(https?:\/\/.*)$/i)[1];
								itemObject.uri = decodeURIComponent(itemObject.uri.split("&")[0]);
			//					itemObject.uri = itemObject.uri.substring(0, q) + ("&" + itemObject.uri.substring(q)).replace(/&(ct|cid|ei)=[^&]* /g, "").substring(1);
							}
				
							if (!itemObject.id) itemObject.id = itemObject.uri;
				
							if (!itemObject.uri.match(/\/~r\//i)) {
								if (itemObject.uri.match(/\/\/news\.google\.com\//)){
									// Google news
									var root = itemObject.uri.match(/url=(https?:\/\/[^\/]+\/)/i)[1];
									itemObject.favicon = root + "favicon.ico";
									delete root;
								}
								else {
									itemObject.image = itemObject.uri.substr(0, (itemObject.uri.indexOf("/", 9) + 1)) + "favicon.ico";
								}
							}
							else {
								// Feedburner
								itemObject.image = feedObject.siteUri.substr(0, (feedObject.siteUri.indexOf("/", 9) + 1)) + "favicon.ico";
							}
			
							itemObject.published = Date.parse(item.updated);
				
							if (!itemObject.published) {
								itemObject.published = new Date();
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
				
							itemObject.visited = RSSTICKER.history.isVisitedURL(itemObject.uri, itemObject.id, "q");
				
							feedObject.items.push(itemObject);
						} catch (e) {
							RSSTICKER.logMessage(e);
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
					RSSTICKER.logMessage(e);
				}
			}
		}
		
		RSSTICKER.getFavicon(feedObject);
		
		delete feedObject;
	}
};










/*****************************************  
 * Feed class from Sage RSS Reader.      *
 *****************************************/

function TickerFeed(feedXML, feedURL) {
	this.feedXML = feedXML;
	this.feedFormat = null;

	this.title = null;
	this.feedURL = feedURL;
	this.link = null;
	this.description = null;
	this.items = new Array();
	this.lastPubDate = null;
	this.rootLink = null;
	
	if(!feedXML) {
		throw "Empty Feed";
	}

	var rootNodeName = feedXML.documentElement.localName.toLowerCase();
	if(rootNodeName == "feed") {
		this.parseAtom();
	} else if(rootNodeName == "rss" || rootNodeName == "rdf") {
		this.parseRSS();
	} else {
		throw "Feed has invalid root element";
	}
}

TickerFeed.prototype.parseRSS = function() {

	var feedXML = this.feedXML;

	const nsIURIFixup = Components.interfaces.nsIURIFixup;
	const URIFixup = Components.classes["@mozilla.org/docshell/urifixup;1"].getService(nsIURIFixup);

	var firstElement = feedXML.documentElement;

	if (firstElement.localName.toLowerCase() == "rdf") {
		this.feedFormat = "RSS (1.0)";
	} else if (firstElement.localName.toLowerCase() == "rss") {
		if(firstElement.hasAttribute("version")) {
			this.feedFormat = "RSS (" + firstElement.getAttribute("version") + ")";
		} else {
			this.feedFormat = "RSS (?)";
		}
	}

	var i, j;

	var channelNode;
	for (i = firstElement.firstChild; i != null; i = i.nextSibling) {
		if(i.nodeType != i.ELEMENT_NODE) continue;
		if(i.localName.toLowerCase() == "channel") {
			channelNode = i;
		}
	}
	if (!channelNode) {
		throw "No channel element where expected";
	}

	if (feedXML.getElementsByTagName("channel").length != 0) {
		channelNode = feedXML.getElementsByTagName("channel")[0];
	} else {
		throw "No elements in channel tag";
	}

	for (i = channelNode.firstChild; i != null; i = i.nextSibling) {
		if (i.nodeType != i.ELEMENT_NODE) continue;
		switch(i.localName) {
			case "title":
				this.title = this.entityDecode(this.getInnerText(i));
				break;
			case "link":
				this.link = this.getInnerText(i);
				this.setRootLink();
				break;
			case "description":
				this.description = this.entityDecode(this.getInnerText(i));
				break;
		}
	}

	var itemNodes = feedXML.getElementsByTagName("item");
	var item, guid;
	for(i = 0; itemNodes.length > i; i++) {
		item = {title:"", link:"", content:"", pubDate:""};
		guid = null;

		for (j = itemNodes[i].firstChild; j!=null; j=j.nextSibling) {
			if (j.nodeType != j.ELEMENT_NODE) continue;
			switch(j.localName) {
				case "title":
					item.title = this.entityDecode(this.getInnerText(j));
					break;
				case "link":
					if (!item.link) {
						item.link = this.link ? URIFixup.createFixupURI(this.link, nsIURIFixup.FIXUP_FLAG_NONE).resolve(this.getInnerText(j)) : this.getInnerText(j);
						this.setRootLink();
					}
					break;
				case "guid":
					if(!guid) {
						guid = this.getInnerText(j);
					}
					break;
				case "description":
					if (!item.content) {
						item.content = this.entityDecode(this.getInnerText(j));
					}
					break;
				case "encoded":
					item.content = this.entityDecode(this.getInnerText(j));
					break;
				case "pubDate":
					tmp_str = this.getInnerText(j);
					tmp_date = this.rfc822ToJSDate(tmp_str);
					if(tmp_date) {
						item.pubDate = tmp_date;
					} else {
					}
					break;
				case "date":
					tmp_str = this.getInnerText(j);
					tmp_date = this.iso8601ToJSDate(tmp_str);
					if(tmp_date) {
						item.pubDate = tmp_date;
					} else {
					}
					break;
			}
		}

		if (!item.link && guid) {
			item.link = this.link ? URIFixup.createFixupURI(this.link, nsIURIFixup.FIXUP_FLAG_NONE).resolve(guid) : guid;
		}

		var tmpFeedItem = new TickerFeedItem(item.title, item.link, item.content, item.pubDate, null);

		if (tmpFeedItem.hasPubDate()) {
			if (tmpFeedItem.getPubDate() > this.lastPubDate) {
				this.lastPubDate = tmpFeedItem.getPubDate();
			}
		}

		this.items.push(tmpFeedItem);
	}
}

TickerFeed.prototype.getInnerText = function (aNode) {
	if (!aNode.hasChildNodes()) {
		return "";
	}
	
	var resultArray = new Array();
	
	var walker = aNode.ownerDocument.createTreeWalker(aNode, NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_TEXT, null, false);
	
	while (walker.nextNode()) {
		resultArray.push(walker.currentNode.nodeValue);
	}
	
	return resultArray.join('').replace(/^\s+|\s+$/g, "");
}

TickerFeed.prototype.setRootLink = function() {
	this.rootLink = this.link.substr(0, this.link.indexOf("/",10)) + "/";
	
	if (this.rootLink == '/'){
		var links = this.feedXML.getElementsByTagName("link");
		
		for (var i = 0; i < links.length; i++){
			x = links[i];
			
			if (x.childNodes.length == 0){
				if (x.getAttribute("href")){
					if (x.getAttribute("rel")){
						if (x.getAttribute("rel") == "alternate"){
							if (x.getAttribute("type")){
								if (x.getAttribute("type") == "text/html"){
									x = x.getAttribute("href") + "/";
									this.rootLink = x;
									break;
								}
							}
						}
					}
				}
			}
			else {
				x = x.firstChild;
				x = x.nodeValue + "/";
				this.rootLink = x;
				break;
			}
		}
	}
	
	if (this.rootLink == '/'){
		this.rootLink = this.feedURL.substr(0, this.feedURL.indexOf("/",10)) + "/";
	}
}

TickerFeed.prototype.parseAtom = function() {
	var feedXML = this.feedXML;

	const nsIURIFixup = Components.interfaces.nsIURIFixup;
	const URIFixup = Components.classes["@mozilla.org/docshell/urifixup;1"].getService(nsIURIFixup);

	var firstElement = feedXML.documentElement;

	if (firstElement.hasAttribute("xmlns") && firstElement.getAttribute("xmlns") == "http://www.w3.org/2005/Atom") {
		this.feedFormat = "Atom (1.0)";
	} else if (firstElement.hasAttribute("version")) {
		this.feedFormat = "Atom (" + firstElement.getAttribute("version") + ")";
	} else {
		this.feedFormat = "Atom (?)";
	}

	// xml:base support for <feed> element
	var baseURI;
	if (firstElement.hasAttribute("xml:base")) {
		baseURI = firstElement.getAttribute("xml:base");
	}
	
	var i, j, z;

	for (i = feedXML.documentElement.firstChild; i != null; i = i.nextSibling) {
		if (i.nodeType != i.ELEMENT_NODE) continue;
		switch(i.localName) {
			case "title":
				this.title = this.entityDecode(this.getInnerText(i));
				break;
			case "link":
				if ((i.hasAttribute("rel") && i.getAttribute("rel").toLowerCase() == "alternate") || !i.hasAttribute("rel")) {
					if (baseURI) {
						this.link = URIFixup.createFixupURI(baseURI, nsIURIFixup.FIXUP_FLAG_NONE).resolve(i.getAttribute("href"));
					} else {
						this.link = i.getAttribute("href");
					}
					
					this.setRootLink();
				}
				break;
			case "subtitle":
			case "tagline":
				this.description = this.entityDecode(this.getInnerText(i));
				break;
		}
	}

	var entryNodes = feedXML.getElementsByTagName("entry");
	for (i = 0; entryNodes.length > i; i++) {
		var item = {title:"", link:"", content:"", pubDate:"", baseURI:""};

		// xml:base support for <entry> element
		if (entryNodes[i].hasAttribute("xml:base")) {
			if (baseURI) {
				item.baseURI = URIFixup.createFixupURI(baseURI, nsIURIFixup.FIXUP_FLAG_NONE).resolve(entryNodes[i].getAttribute("xml:base"));
			} else {
				item.baseURI = entryNodes[i].getAttribute("xml:base");
			}
		}

		var titleNodes = entryNodes[i].getElementsByTagName("title");
		if (titleNodes.length) {
			item.title = this.entityDecode(this.getInnerText(titleNodes[0]));
		}

		var linkNodes = entryNodes[i].getElementsByTagName("link");
		if (linkNodes.length) {
			for (j = 0; j < linkNodes.length; j++) {
				if (!linkNodes[j].hasAttribute("rel") || linkNodes[j].getAttribute("rel").toLowerCase() == "alternate") {
					item.link = item.baseURI ? URIFixup.createFixupURI(item.baseURI, nsIURIFixup.FIXUP_FLAG_NONE).resolve(linkNodes[j].getAttribute("href")) : linkNodes[j].getAttribute("href");
					break;
				}
			}
		}

		var updatedNodes = entryNodes[i].getElementsByTagName("updated");
		if (updatedNodes.length) {
			tmp_str = this.getInnerText(updatedNodes[0]);
			tmp_date = this.iso8601ToJSDate(tmp_str);
			if (tmp_date) {
				item.pubDate = tmp_date;
			} else {
			}
		}

		var issuedNodes = entryNodes[i].getElementsByTagName("issued");
		if (issuedNodes.length) {
			tmp_str = this.getInnerText(issuedNodes[0]);
			tmp_date = this.iso8601ToJSDate(tmp_str);
			if (tmp_date) {
				item.pubDate = tmp_date;
			} else {
			}
		}

		var aEntryNode = entryNodes[i];

		var contentNodes = aEntryNode.getElementsByTagName("content");
		var contentHash = {};
		var contentString;
		var xmlSerializer = new XMLSerializer();
		for (j = 0; j < contentNodes.length; j++) {
			var contType = contentNodes[j].getAttribute("type");
			if (contType == "application/xhtml+xml" || contType == "xhtml") {
				contentString = "";
				for(z = 0; z < contentNodes[j].childNodes.length; z++) {
					contentString += xmlSerializer.serializeToString(contentNodes[j].childNodes[z]);
				}
			} else {
				contentString = this.getInnerText(contentNodes[j]);
			}
			contentHash[contType] = contentString;
		}

		var summaryNodes = aEntryNode.getElementsByTagName("summary");

		if ("application/xhtml+xml" in contentHash) {
			item.content = this.entityDecode(contentHash["application/xhtml+xml"]);
		} else if ("xhtml" in contentHash) {
			item.content = this.entityDecode(contentHash["xhtml"]);
		} else if ("text/html" in contentHash) {
			item.content = this.entityDecode(contentHash["text/html"]);
		} else if ("html" in contentHash) {
			item.content = this.entityDecode(contentHash["html"]);
		} else if ("text/plain" in contentHash) {
			item.content = contentHash["text/plain"];
		} else if ("text" in contentHash) {
			item.content = contentHash["text"];	
		} else if (summaryNodes.length) {
			item.content = this.entityDecode(this.getInnerText(summaryNodes[0]));
		}

		var tmpFeedItem = new TickerFeedItem(item.title, item.link, item.content, item.pubDate, item.baseURI);

		if (tmpFeedItem.hasPubDate()) {
			if (tmpFeedItem.getPubDate() > this.lastPubDate) {
				this.lastPubDate = tmpFeedItem.getPubDate();
			}
		}

		this.items.push(tmpFeedItem);
	}
}

TickerFeed.prototype.getTitle = function() {
	return this.title.replace(/<.*?>/g,'');
}

TickerFeed.prototype.hasDescription = function() {
	if(!this.description) {
		return false;
	} else {
		return true;
	}
}

TickerFeed.prototype.getDescription = function() {
	if(this.hasDescription()) {
		return this.description;
	} else {
		return "";
	}
}

TickerFeed.prototype.getLink = function() {
	return this.link;
}

TickerFeed.prototype.hasLastPubDate = function() {
	if(!this.lastPubDate) {
		return false;
	} else {
		return true;
	}
}

TickerFeed.prototype.getLastPubDate = function() {
	if(this.hasLastPubDate()) {
		return this.lastPubDate;
	} else {
		return null;
	}
}

TickerFeed.prototype.getItemCount = function() {
	return this.items.length;
}

TickerFeed.prototype.getItem = function(itemIndex) {
	return this.items[itemIndex];
}

TickerFeed.prototype.getItems = function(sort) {
	if(sort == "chrono" && !this.hasLastPubDate()) {  // if the feed doesn't have pub dates, we're going to do a source sort
		sort = "source";
	}
	var items_array;
	switch(sort) {
		case "chrono":
			var items = new Array();
			for(var c = 0; c < this.items.length; c++) {
				items.push(this.items[c]);
			}
			function chronoSort(a, b) {
				var a_ts = a.hasPubDate() ? a.getPubDate() : 0;
				var b_ts = b.hasPubDate() ? b.getPubDate() : 0;
				return b_ts - a_ts;
			}
			items.sort(chronoSort);
			items_array = items;
			break;
		case "source":
			items_array = this.items;
			break;
		default:
			items_array = this.items;
			break;
	}
	return items_array;
}

TickerFeed.prototype.getFormat = function() {
	return this.feedFormat;
}

TickerFeed.prototype.getSignature = function() {
	var hashText = "";
	for(var c = 0; c < this.getItemCount(); c++) {
		hashText += this.getItem(c).getTitle();
	}
	sig ="[" + b64_sha1(hashText) + "]";
	return sig;
}



/**
 * FeedItem class
 *
 */

function TickerFeedItem(title, link, content, pubDate, baseURI) {
	this.title = title;
	this.link = this.fixLink(link);
	this.content = content;
	this.pubDate = pubDate;
	this.baseURI = baseURI;
}

TickerFeedItem.prototype.fixLink = function(link) {
	const nsIURIFixup = Components.interfaces.nsIURIFixup;
	const URIFixup = Components.classes["@mozilla.org/docshell/urifixup;1"].getService(nsIURIFixup);

	var host = URIFixup.createFixupURI(link, nsIURIFixup.FIXUP_FLAG_NONE).host;
	var i = link.indexOf("?") + 1;

	// remove HTTP GET variables that screw up the "hide visited" option
	if ("news.google.com" == host && 0 != i) {
		link = link.substring(0, i) + ("&" + link.substring(i)).replace(/&(ct|cid|ei)=[^&]*/g, "").substring(1);
	}

	return link;
}

TickerFeedItem.prototype.hasTitle = function() {
	if(!this.title) {
		return false;
	} else {
		return true;
	}
}

TickerFeedItem.prototype.getTitle = function() {
	var title;
	if (this.hasTitle()) {
		title = this.title.replace(/<.*?>/g,'');
	} else {
		if (this.hasContent()) {
			temp = this.getContent();
			temp = temp.replace(/<.*?>/g,'');
			title = temp.substring(0, 30) + "...";
		} else {
			title = "No Title";
		}
	}
	return title;
}

TickerFeedItem.prototype.getLink = function() {
	return this.link;
}

TickerFeedItem.prototype.hasContent = function() {
	if(!this.content) {
		return false;
	} else {
		return true;
	}
}

TickerFeedItem.prototype.getContent = function() {
	if(this.hasContent()) {
		return this.content;
	} else {
		return "No content";
	}
}

TickerFeedItem.prototype.hasPubDate = function() {
	if(!this.pubDate) {
		return false;
	} else {
		return true;
	}
}

TickerFeedItem.prototype.getPubDate = function() {
	if(this.hasPubDate()) {
		return this.pubDate;
	} else {
		return null;
	}
}

TickerFeedItem.prototype.hasBaseURI = function() {
	return Boolean(this.baseURI);
}

TickerFeedItem.prototype.getBaseURI = function() {
	return this.hasBaseURI() ? this.baseURI : null;
}


/**
 * Utility functions
 *
 */
 
// Parses an RFC 822 formatted date string and returns a JavaScript Date object, returns null on parse error
// Example inputs:  "Sun, 08 May 05 15:19:37 GMT"  "Mon, 09 May 2005 00:50:19 GMT"
TickerFeed.prototype.rfc822ToJSDate = function(date_str) {
	date_array = date_str.split(" ");
	// check for two digit year
	if(date_array.length == 6 && date_array[3].length == 2) {
		// convert to four digit year with a pivot of 70
		if(date_array[3] < 70) {
			date_array[3] = "20" + date_array[3];
		} else {
			date_array[3] = "19" + date_array[3];
		}
	}
	date_str = date_array.join(" ");
	date = new Date(date_str);
	if(date != "Invalid Date") {
		return date;
	} else {
		return null
	}
}

// Parses an ISO 8601 formatted date string and returns a JavaScript Date object, returns null on parse error
// Example inputs:  "2004-06-17T18:00Z" "2004-06-17T18:34:12+02:00"
TickerFeed.prototype.iso8601ToJSDate = function(date_str) {
	var tmp = date_str.split("T");
	var date = tmp[0];

	date = date.split("-");
	var year = date[0];
	var month = date[1];
	var day = date[2];

	var hours = 0;
	var minutes = 0;
	var seconds = 0;
	var tz_mark = "Z";
	var tz_hours = 0;
	var tz_minutes = 0;
	var time, whole_time, tz;

	if(tmp.length == 2) {
		whole_time = tmp[1];
		tz_mark = whole_time.match("[Z+-]{1}");
		if(tz_mark) {
			tmp = whole_time.split(tz_mark);
			time = tmp[0];
			if(tz_mark == "+" || tz_mark == "-") {
				tz = tmp[1];
				tmp = tz.split(":");
				tz_hours = tmp[0];
				tz_minutes = tmp[1];
			}
		} else {
			tz_mark = "Z";
			time = whole_time;
		}
		tmp = time.split(":");
		hours = tmp[0];
		minutes = tmp[1];
		if(tmp.length == 3) {
			seconds = tmp[2];
		}
	}

	var utc = Date.UTC(year, month - 1, day, hours, minutes, seconds);
	var tmp_date;
	if(tz_mark == "Z") {
		tmp_date = new Date(utc);
	} else if(tz_mark == "+") {
		tmp_date = new Date(utc - tz_hours*3600000 - tz_minutes*60000);
	} else if(tz_mark == "-") {
		tmp_date = new Date(utc + tz_hours*3600000 + tz_minutes*60000);
	} else {
		tmp_date = "Invalid Date";
	}

	if (tmp_date == "Invalid Date") {
		return null;
	} else {
		return tmp_date;
	}
}

TickerFeed.prototype.entityDecode = function (aStr) {
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
